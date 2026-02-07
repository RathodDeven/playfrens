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
      }) => {
        try {
          const address = socket.data.address;
          if (!address) {
            socket.emit(EVENTS.ERROR, { message: "Not registered" });
            return;
          }

          const room = roomManager.createRoom(
            {
              gameType: data.gameType,
              buyIn: data.buyIn,
              smallBlind: data.smallBlind,
              bigBlind: data.bigBlind,
              maxPlayers: data.maxPlayers,
              chipUnit: data.chipUnit,
            },
            (roomId, result) => {
              // Broadcast hand complete to room
              io.to(roomId).emit(EVENTS.HAND_COMPLETE, result);

              // Send updated game state to each player
              broadcastGameState(io, roomId, roomManager);

              const room = roomManager.getRoom(roomId) as PokerRoom | undefined;
              if (room) {
                const removed = room.consumeRecentlyRemoved();
                for (const seatIndex of removed) {
                  handleDeferredRemoval(io, roomId, seatIndex);
                  io.to(roomId).emit(EVENTS.PLAYER_LEFT, { seatIndex });
                }

                yellowSessions
                  .submitHandAllocations(room)
                  .catch((err) =>
                    console.error("[Yellow] Submit failed:", err),
                  );
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
        } catch (err: any) {
          socket.emit(EVENTS.ERROR, { message: err.message });
        }
      },
    );

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
          .closeSession(room.roomId, room)
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
          socket.emit(EVENTS.ERROR, { message: "Only the host can start a hand" });
          return;
        }

        const room = roomManager.getRoom(data.roomId);
        if (!room) {
          socket.emit(EVENTS.ERROR, { message: "Room not found" });
          return;
        }

        if (!yellowSessions.hasSession(room.roomId)) {
          await yellowSessions.ensureSession(room);
        }

        (room as PokerRoom).startHand();
        autoFoldPendingLeavers(io, data.roomId, roomManager, yellowSessions);
        broadcastGameState(io, data.roomId, roomManager);

        console.log(`[Game] Hand started in ${data.roomId}`);
      } catch (err: any) {
        socket.emit(EVENTS.ERROR, { message: err.message });
      }
    });

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

    // Room list
    socket.on(EVENTS.ROOM_LIST, () => {
      const rooms = roomManager.listRooms();
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
        return;
      }
    }

    room.removePlayer(roomInfo.seatIndex);

    io.to(roomId).emit(EVENTS.PLAYER_LEFT, {
      seatIndex: roomInfo.seatIndex,
    });

    // Broadcast updated game state to remaining players
    broadcastGameState(io, roomId, roomManager);

    // Delete room if empty
    if (room.getPlayerCount() === 0) {
      if (yellowSessions.hasSession(roomId)) {
        yellowSessions
          .closeSession(roomId, room as PokerRoom)
          .catch((err) => console.error("[Yellow] Close failed:", err));
      }
      roomManager.deleteRoom(roomId);
      console.log(`[Room] Deleted empty room: ${roomId}`);
    }
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
      handleDeferredRemoval(io, roomId, seatIndex);
      io.to(roomId).emit(EVENTS.PLAYER_LEFT, { seatIndex });
    }

    yellowSessions
      .submitHandAllocations(pokerRoom)
      .catch((err) => console.error("[Yellow] Submit failed:", err));
  }
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
