import { EVENTS, type PokerAction } from "@playfrens/shared";
import type { Server, Socket } from "socket.io";
import type { PokerRoom } from "../games/poker/PokerRoom.js";
import type { RoomManager } from "../rooms/RoomManager.js";
import type { YellowSessionManager } from "../yellow/sessionManager.js";
import { registerSocket, unregisterSocket } from "./middleware.js";

// Track which socket is in which room, and which seat
const socketRooms = new Map<string, { roomId: string; seatIndex: number }>();

export function setupSocketHandlers(
  io: Server,
  roomManager: RoomManager,
  yellowSessions: YellowSessionManager,
): void {
  io.on("connection", (socket: Socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // Register wallet address
    socket.on(
      EVENTS.REGISTER,
      (data: { address: string; ensName?: string; ensAvatar?: string }) => {
        registerSocket(socket.id, data.address);
        socket.data.address = data.address.toLowerCase();
        socket.data.ensName = data.ensName;
        socket.data.ensAvatar = data.ensAvatar;
        socket.emit(EVENTS.REGISTERED, { address: data.address });
        console.log(`[Socket] Registered: ${data.address}`);
      },
    );

    // Create room
    socket.on(
      EVENTS.CREATE_ROOM,
      (data: {
        gameType: "poker";
        buyIn: number;
        smallBlind: number;
        bigBlind: number;
        maxPlayers: number;
        chipUnit: number;
        allowedPlayers?: string[];
      }) => {
        try {
          const address = socket.data.address;
          if (!address) {
            socket.emit(EVENTS.ERROR, { message: "Not registered" });
            return;
          }

          // Build allowedPlayers list (lowercase, auto-include creator)
          const allowedPlayers = data.allowedPlayers
            ? [
                ...new Set([
                  address,
                  ...data.allowedPlayers.map((a: string) => a.toLowerCase()),
                ]),
              ]
            : undefined;

          const room = roomManager.createRoom(
            {
              gameType: data.gameType,
              buyIn: data.buyIn,
              smallBlind: data.smallBlind,
              bigBlind: data.bigBlind,
              maxPlayers: data.maxPlayers,
              chipUnit: data.chipUnit,
              allowedPlayers,
            },
            (roomId, result) => {
              // Broadcast hand complete to room
              console.log(
                `[Socket] Hand complete in ${roomId}:`,
                JSON.stringify(result.winners),
              );
              io.to(roomId).emit(EVENTS.HAND_COMPLETE, result);

              // Send updated game state to each player
              broadcastGameState(io, roomId, roomManager);

              const room = roomManager.getRoom(roomId) as PokerRoom | undefined;
              if (room) {
                const removed = room.consumeRecentlyRemoved();
                for (const seatIndex of removed) {
                  // Emit PLAYER_LEFT to the leaving socket BEFORE removing them from the room
                  emitToSeatInRoom(io, roomId, seatIndex, EVENTS.PLAYER_LEFT, {
                    seatIndex,
                  });
                  handleDeferredRemoval(io, roomId, seatIndex);
                  io.to(roomId).emit(EVENTS.PLAYER_LEFT, { seatIndex });
                }

                // Broadcast updated state after all removals
                if (removed.length > 0) {
                  broadcastGameState(io, roomId, roomManager);
                }

                // Submit hand allocations first
                console.log(
                  `[Socket] Submitting hand allocations to Yellow for room ${roomId}`,
                );
                yellowSessions
                  .submitHandAllocations(room)
                  .catch((err) =>
                    console.error("[Yellow] Submit failed:", err),
                  );

                // Close session + delete room when fewer than 2 players
                if (
                  removed.length > 0 &&
                  room.getPlayerCount() < 2 &&
                  yellowSessions.hasSession(roomId)
                ) {
                  console.log(
                    `[Yellow] Room has ${room.getPlayerCount()} player(s) after removals — closing session for room ${roomId}`,
                  );
                  yellowSessions
                    .closeSession(roomId)
                    .catch((err) =>
                      console.error("[Yellow] Close failed:", err),
                    );
                }

                if (room.getPlayerCount() === 0) {
                  roomManager.deleteRoom(roomId);
                  broadcastPublicRooms(io, roomManager);
                }
              }
            },
          );

          // Auto-join the creator at seat 0
          const seatIndex = 0;
          room.addPlayer(
            address,
            seatIndex,
            room.config.buyIn,
            socket.data.ensName,
            socket.data.ensAvatar,
          );

          socket.join(room.roomId);
          socketRooms.set(socket.id, {
            roomId: room.roomId,
            seatIndex,
          });

          socket.emit(EVENTS.ROOM_CREATED, {
            roomId: room.roomId,
            gameType: room.gameType,
            seatIndex,
          });

          // Send initial game state to the creator
          const playerState = room.getPlayerState(seatIndex);
          socket.emit(EVENTS.GAME_STATE, playerState);

          console.log(
            `[Room] Created: ${room.roomId} (${data.gameType}) — ${address} joined at seat ${seatIndex}`,
          );

          // Broadcast updated public room list to all clients
          broadcastPublicRooms(io, roomManager);
        } catch (err: any) {
          socket.emit(EVENTS.ERROR, { message: err.message });
        }
      },
    );

    // Join room
    socket.on(
      EVENTS.JOIN_ROOM,
      async (data: { roomId: string; seatIndex: number }) => {
        try {
          const address = socket.data.address;
          if (!address) {
            socket.emit(EVENTS.ERROR, { message: "Not registered" });
            return;
          }

          const room = roomManager.getRoom(data.roomId);
          if (!room) {
            socket.emit(EVENTS.ERROR, { message: "Room not found" });
            return;
          }

          if (
            room.status !== "waiting" ||
            yellowSessions.hasSession(room.roomId)
          ) {
            socket.emit(EVENTS.ERROR, { message: "Table already started" });
            return;
          }

          // Access control for private/invite-only rooms
          if (room.config.allowedPlayers) {
            const isAllowed = room.config.allowedPlayers.some(
              (a) => a.toLowerCase() === address.toLowerCase(),
            );
            if (!isAllowed) {
              socket.emit(EVENTS.ERROR, {
                message: "This room is invite-only",
              });
              return;
            }
          }

          // Auto-assign next available seat if client sends -1
          const pokerRoom = room as PokerRoom;
          let assignedSeat = data.seatIndex;
          if (assignedSeat < 0) {
            assignedSeat = pokerRoom.getNextAvailableSeat();
            if (assignedSeat < 0) {
              socket.emit(EVENTS.ERROR, { message: "Table is full" });
              return;
            }
          }

          room.addPlayer(
            address,
            assignedSeat,
            room.config.buyIn,
            socket.data.ensName,
            socket.data.ensAvatar,
          );

          socket.join(data.roomId);
          socketRooms.set(socket.id, {
            roomId: data.roomId,
            seatIndex: assignedSeat,
          });

          // Notify everyone in the room
          io.to(data.roomId).emit(EVENTS.PLAYER_JOINED, {
            seatIndex: assignedSeat,
            address,
            ensName: socket.data.ensName,
            ensAvatar: socket.data.ensAvatar,
          });

          // Broadcast game state to ALL players so host sees the join
          broadcastGameState(io, data.roomId, roomManager);

          console.log(
            `[Room] ${address} joined ${data.roomId} at seat ${assignedSeat}`,
          );

          broadcastPublicRooms(io, roomManager);
        } catch (err: any) {
          socket.emit(EVENTS.ERROR, { message: err.message });
        }
      },
    );

    // Leave on next hand
    socket.on(EVENTS.LEAVE_NEXT_HAND, (data: { roomId: string }) => {
      const roomInfo = socketRooms.get(socket.id);
      if (!roomInfo || roomInfo.roomId !== data.roomId) return;

      const room = roomManager.getRoom(data.roomId);
      if (!room || room.gameType !== "poker") return;

      const pokerRoom = room as PokerRoom;
      if (pokerRoom.requestLeaveNextHand(roomInfo.seatIndex)) {
        socket.emit(EVENTS.LEAVE_NEXT_HAND_ACK, {
          seatIndex: roomInfo.seatIndex,
        });
        console.log(
          `[Room] Seat ${roomInfo.seatIndex} requested leave-next-hand in ${data.roomId}`,
        );
      }
    });

    // Leave room
    socket.on(EVENTS.LEAVE_ROOM, (data: { roomId: string }) => {
      handleLeaveRoom(
        socket,
        io,
        roomManager,
        yellowSessions,
        data.roomId,
        true,
      );
    });

    // Cash out
    socket.on(EVENTS.CASH_OUT, (data: { roomId: string }) => {
      const roomInfo = socketRooms.get(socket.id);
      if (!roomInfo || roomInfo.roomId !== data.roomId) {
        socket.emit(EVENTS.ERROR, { message: "Not in this room" });
        return;
      }

      const room = roomManager.getRoom(data.roomId) as PokerRoom | undefined;
      if (!room) {
        socket.emit(EVENTS.ERROR, { message: "Room not found" });
        return;
      }

      if (room.getPlayerCount() > 1) {
        socket.emit(EVENTS.ERROR, {
          message: "All players must leave before cash out",
        });
        return;
      }

      if (yellowSessions.hasSession(room.roomId)) {
        yellowSessions
          .closeSession(room.roomId)
          .catch((err) => console.error("[Yellow] Close failed:", err));
      }

      socket.emit(EVENTS.CASHED_OUT, { roomId: data.roomId });
      handleLeaveRoom(socket, io, roomManager, yellowSessions, data.roomId);
    });

    // Start hand — only host (seat 0) can start
    socket.on(EVENTS.START_HAND, async (data: { roomId: string }) => {
      try {
        const roomInfo = socketRooms.get(socket.id);
        if (!roomInfo || roomInfo.roomId !== data.roomId) {
          socket.emit(EVENTS.ERROR, { message: "Not in this room" });
          return;
        }

        if (roomInfo.seatIndex !== 0) {
          socket.emit(EVENTS.ERROR, {
            message: "Only the host can start a hand",
          });
          return;
        }

        const room = roomManager.getRoom(data.roomId);
        if (!room) {
          socket.emit(EVENTS.ERROR, { message: "Room not found" });
          return;
        }

        // If session already exists, start hand immediately
        if (yellowSessions.hasSession(room.roomId)) {
          console.log(
            `[Yellow] Session already exists for room ${room.roomId} — starting hand`,
          );

          // Process leave-next-hand requests before starting
          const pokerRoom = room as PokerRoom;
          const leaveNextRemoved = pokerRoom.processLeaveNextHand();
          for (const seatIdx of leaveNextRemoved) {
            emitToSeatInRoom(io, data.roomId, seatIdx, EVENTS.PLAYER_LEFT, {
              seatIndex: seatIdx,
            });
            handleDeferredRemoval(io, data.roomId, seatIdx);
            io.to(data.roomId).emit(EVENTS.PLAYER_LEFT, {
              seatIndex: seatIdx,
            });
          }

          if (pokerRoom.getPlayerCount() < 2) {
            broadcastGameState(io, data.roomId, roomManager);
            console.log(
              `[Game] Not enough players after leave-next-hand in ${data.roomId}`,
            );
            // Close session using already-correct lastAllocations
            if (yellowSessions.hasSession(data.roomId)) {
              console.log(
                `[Yellow] Closing session after leave-next-hand for room ${data.roomId}`,
              );
              yellowSessions
                .closeSession(data.roomId)
                .catch((err) => console.error("[Yellow] Close failed:", err));
            }
            if (pokerRoom.getPlayerCount() === 0) {
              roomManager.deleteRoom(data.roomId);
            }
            return;
          }

          pokerRoom.startHand();
          autoFoldPendingLeavers(io, data.roomId, roomManager, yellowSessions);
          broadcastGameState(io, data.roomId, roomManager);
          broadcastPublicRooms(io, roomManager);
          console.log(`[Game] Hand started in ${data.roomId}`);
          return;
        }

        // If already signing, don't start again
        if (yellowSessions.hasPendingSession(room.roomId)) {
          socket.emit(EVENTS.ERROR, {
            message: "Session signing already in progress",
          });
          return;
        }

        // Start multi-party signing flow
        console.log(
          `[Yellow] Starting multi-party signing for room ${room.roomId}...`,
        );
        try {
          const { definition, allocations, req } =
            await yellowSessions.startSigning(
              room,
              // onReady — session created, start the hand
              (sessionId) => {
                console.log(
                  `[Yellow] Session ready: ${sessionId} — starting hand`,
                );
                io.to(data.roomId).emit(EVENTS.SESSION_READY, { sessionId });
                try {
                  const pr = room as PokerRoom;
                  const leaveRemoved = pr.processLeaveNextHand();
                  for (const seatIdx of leaveRemoved) {
                    emitToSeatInRoom(
                      io,
                      data.roomId,
                      seatIdx,
                      EVENTS.PLAYER_LEFT,
                      { seatIndex: seatIdx },
                    );
                    handleDeferredRemoval(io, data.roomId, seatIdx);
                    io.to(data.roomId).emit(EVENTS.PLAYER_LEFT, {
                      seatIndex: seatIdx,
                    });
                  }

                  if (pr.getPlayerCount() < 2) {
                    broadcastGameState(io, data.roomId, roomManager);
                    // Close session using already-correct lastAllocations
                    if (yellowSessions.hasSession(data.roomId)) {
                      console.log(
                        `[Yellow] Closing session after leave-next-hand (onReady) for room ${data.roomId}`,
                      );
                      yellowSessions
                        .closeSession(data.roomId)
                        .catch((err) =>
                          console.error("[Yellow] Close failed:", err),
                        );
                    }
                    if (pr.getPlayerCount() === 0) {
                      roomManager.deleteRoom(data.roomId);
                    }
                    return;
                  }

                  pr.startHand();
                  autoFoldPendingLeavers(
                    io,
                    data.roomId,
                    roomManager,
                    yellowSessions,
                  );
                  broadcastGameState(io, data.roomId, roomManager);
                  broadcastPublicRooms(io, roomManager);
                  console.log(`[Game] Hand started in ${data.roomId}`);
                } catch (err: any) {
                  console.error(`[Game] Failed to start hand: ${err.message}`);
                  io.to(data.roomId).emit(EVENTS.ERROR, {
                    message: err.message,
                  });
                }
              },
              // onError — session creation failed
              (error) => {
                console.error(
                  `[Yellow] Session signing failed: ${error.message}`,
                );
                io.to(data.roomId).emit(EVENTS.SESSION_ERROR, {
                  message: error.message,
                });
              },
            );

          // Emit signing request to all players in the room (includes req payload to co-sign)
          console.log(
            `[Yellow] Emitting SIGN_SESSION_REQUEST to room ${data.roomId}`,
          );
          io.to(data.roomId).emit(EVENTS.SIGN_SESSION_REQUEST, {
            definition,
            allocations,
            req,
          });
        } catch (yellowErr: any) {
          console.error("[Yellow] startSigning failed:", yellowErr?.message);
          socket.emit(EVENTS.SESSION_ERROR, {
            message: yellowErr?.message ?? "Failed to start session signing",
          });
        }
      } catch (err: any) {
        socket.emit(EVENTS.ERROR, { message: err.message });
      }
    });

    // Player sends their signature of the app session req payload
    socket.on(
      EVENTS.SESSION_SIGNED,
      (data: { roomId: string; address: string; signature: string }) => {
        const roomInfo = socketRooms.get(socket.id);
        if (!roomInfo || roomInfo.roomId !== data.roomId) return;

        const address = socket.data.address || data.address;
        if (!address || !data.signature) return;

        console.log(
          `[Socket] SESSION_SIGNED from ${address.slice(0, 10)} for room ${data.roomId}`,
        );
        yellowSessions.markSigned(data.roomId, address, data.signature);
      },
    );

    // Player action
    socket.on(
      EVENTS.PLAYER_ACTION,
      (data: { roomId: string; action: PokerAction; betSize?: number }) => {
        try {
          const roomInfo = socketRooms.get(socket.id);
          if (!roomInfo || roomInfo.roomId !== data.roomId) {
            socket.emit(EVENTS.ERROR, { message: "Not in this room" });
            return;
          }

          const room = roomManager.getRoom(data.roomId);
          if (!room) {
            socket.emit(EVENTS.ERROR, { message: "Room not found" });
            return;
          }

          room.handleAction(roomInfo.seatIndex, data.action, {
            betSize: data.betSize,
          });

          autoFoldPendingLeavers(io, data.roomId, roomManager, yellowSessions);
          broadcastGameState(io, data.roomId, roomManager);

          console.log(
            `[Game] Seat ${roomInfo.seatIndex} → ${data.action}${data.betSize ? ` (${data.betSize})` : ""} in ${data.roomId}`,
          );
        } catch (err: any) {
          socket.emit(EVENTS.ERROR, { message: err.message });
        }
      },
    );

    // Room list (on-demand request)
    socket.on(EVENTS.ROOM_LIST, () => {
      const rooms = roomManager
        .listRooms()
        .filter((r) => r.status === "waiting" && !r.config.allowedPlayers);
      socket.emit(EVENTS.ROOM_LIST, rooms);
    });

    // Reactions
    socket.on(
      EVENTS.SEND_REACTION,
      (data: { roomId: string; reaction: string }) => {
        const roomInfo = socketRooms.get(socket.id);
        if (roomInfo?.roomId === data.roomId) {
          io.to(data.roomId).emit(EVENTS.REACTION, {
            seatIndex: roomInfo.seatIndex,
            reaction: data.reaction,
          });
        }
      },
    );

    // Chat
    socket.on(
      EVENTS.CHAT_MESSAGE,
      (data: { roomId: string; message: string }) => {
        const roomInfo = socketRooms.get(socket.id);
        if (roomInfo?.roomId === data.roomId) {
          io.to(data.roomId).emit(EVENTS.CHAT, {
            seatIndex: roomInfo.seatIndex,
            address: socket.data.address,
            ensName: socket.data.ensName,
            message: data.message,
            timestamp: Date.now(),
          });
        }
      },
    );

    // Disconnect
    socket.on("disconnect", () => {
      const roomInfo = socketRooms.get(socket.id);
      if (roomInfo) {
        handleLeaveRoom(
          socket,
          io,
          roomManager,
          yellowSessions,
          roomInfo.roomId,
          true,
        );
      }
      unregisterSocket(socket.id);
      console.log(`[Socket] Disconnected: ${socket.id}`);
    });
  });
}

function handleLeaveRoom(
  socket: Socket,
  io: Server,
  roomManager: RoomManager,
  yellowSessions: YellowSessionManager,
  roomId: string,
  deferIfHandInProgress = false,
): void {
  const roomInfo = socketRooms.get(socket.id);
  if (!roomInfo || roomInfo.roomId !== roomId) return;

  const room = roomManager.getRoom(roomId);
  if (room) {
    if (deferIfHandInProgress && room.gameType === "poker") {
      const pokerRoom = room as PokerRoom;
      if (pokerRoom.requestLeave(roomInfo.seatIndex)) {
        // Leave is deferred — player will be removed after hand completes
        return;
      }
    }

    // Snapshot allocations BEFORE removing the player so chip data is preserved
    const hasSession =
      yellowSessions.hasSession(roomId) && room.gameType === "poker";
    if (hasSession) {
      console.log(
        `[Yellow] Snapshotting allocations before removing seat ${roomInfo.seatIndex} from room ${roomId}`,
      );
      // Synchronously capture correct allocations while all players still present
      yellowSessions.snapshotAllocations(room as PokerRoom);
      // Also submit to Clearnode (async, fire-and-forget)
      yellowSessions
        .submitHandAllocations(room as PokerRoom)
        .catch((err) => console.error("[Yellow] Submit failed:", err));
    }

    room.removePlayer(roomInfo.seatIndex);
    console.log(
      `[Room] Removed seat ${roomInfo.seatIndex} from ${roomId}, remaining players: ${room.getPlayerCount()}`,
    );

    // Emit PLAYER_LEFT while the socket is still in the room so they receive it
    io.to(roomId).emit(EVENTS.PLAYER_LEFT, {
      seatIndex: roomInfo.seatIndex,
    });

    // Broadcast updated game state to remaining players
    broadcastGameState(io, roomId, roomManager);

    // Close session + delete room when fewer than 2 players remain
    // (can't continue playing, so distribute funds back to Unified Balances)
    if (room.getPlayerCount() < 2 && hasSession) {
      console.log(
        `[Yellow] Room has ${room.getPlayerCount()} player(s) — closing session for room ${roomId}`,
      );
      yellowSessions
        .closeSession(roomId)
        .catch((err) => console.error("[Yellow] Close failed:", err));
    }

    if (room.getPlayerCount() === 0) {
      roomManager.deleteRoom(roomId);
      console.log(`[Room] Deleted empty room: ${roomId}`);
    }

    broadcastPublicRooms(io, roomManager);
  }

  socket.leave(roomId);
  socketRooms.delete(socket.id);
}

function handleDeferredRemoval(
  io: Server,
  roomId: string,
  seatIndex: number,
): void {
  const targets: string[] = [];
  for (const [socketId, info] of socketRooms.entries()) {
    if (info.roomId === roomId && info.seatIndex === seatIndex) {
      targets.push(socketId);
    }
  }

  for (const socketId of targets) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.leave(roomId);
    }
    socketRooms.delete(socketId);
  }
}

/** Emit an event directly to the socket(s) for a specific seat in a room */
function emitToSeatInRoom(
  io: Server,
  roomId: string,
  seatIndex: number,
  event: string,
  data: unknown,
): void {
  for (const [socketId, info] of socketRooms.entries()) {
    if (info.roomId === roomId && info.seatIndex === seatIndex) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit(event, data);
      }
    }
  }
}

function autoFoldPendingLeavers(
  io: Server,
  roomId: string,
  roomManager: RoomManager,
  yellowSessions: YellowSessionManager,
): void {
  const room = roomManager.getRoom(roomId);
  if (!room || room.gameType !== "poker") return;

  const pokerRoom = room as PokerRoom;
  let didFold = false;
  while (pokerRoom.autoFoldPendingTurn()) {
    didFold = true;
  }

  if (didFold) {
    broadcastGameState(io, roomId, roomManager);

    const removed = pokerRoom.consumeRecentlyRemoved();
    for (const seatIndex of removed) {
      emitToSeatInRoom(io, roomId, seatIndex, EVENTS.PLAYER_LEFT, {
        seatIndex,
      });
      handleDeferredRemoval(io, roomId, seatIndex);
      io.to(roomId).emit(EVENTS.PLAYER_LEFT, { seatIndex });
    }

    yellowSessions
      .submitHandAllocations(pokerRoom)
      .catch((err) => console.error("[Yellow] Submit failed:", err));
  }
}

function broadcastPublicRooms(io: Server, roomManager: RoomManager): void {
  const rooms = roomManager
    .listRooms()
    .filter((r) => r.status === "waiting" && !r.config.allowedPlayers);
  io.emit(EVENTS.ROOM_LIST, rooms);
}

function broadcastGameState(
  io: Server,
  roomId: string,
  roomManager: RoomManager,
): void {
  const room = roomManager.getRoom(roomId);
  if (!room) return;

  // Send personalized state to each player in the room
  const sockets = io.sockets.adapter.rooms.get(roomId);
  if (!sockets) return;

  for (const socketId of sockets) {
    const info = socketRooms.get(socketId);
    if (info) {
      const playerState = room.getPlayerState(info.seatIndex);
      io.to(socketId).emit(EVENTS.GAME_STATE, playerState);
    }
  }
}
