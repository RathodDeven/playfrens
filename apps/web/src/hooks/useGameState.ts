import {
  EVENTS,
  type HandResult,
  type PokerAction,
  type PokerPlayerState,
} from "@playfrens/shared";
import { useCallback, useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import type { YellowRpcClient } from "../lib/yellowRpc";

export interface HandHistoryEntry {
  handNumber: number;
  winners: Array<{ seatIndex: number; amount: number; hand?: string }>;
  pots: Array<{ amount: number; eligibleSeats: number[] }>;
  chipUnit: number;
  timestamp: number;
}

interface UseGameStateReturn {
  gameState: PokerPlayerState | null;
  lastHandResult: HandResult | null;
  handHistory: HandHistoryEntry[];
  roomId: string | null;
  seatIndex: number | null;
  error: string | null;
  isSigningSession: boolean;
  createRoom: (config: {
    buyIn: number;
    smallBlind: number;
    bigBlind: number;
    maxPlayers: number;
    chipUnit: number;
  }) => void;
  joinRoom: (roomId: string, seatIndex: number) => void;
  leaveRoom: () => void;
  cashOut: () => void;
  startHand: () => void;
  sendAction: (action: PokerAction, betSize?: number) => void;
  sendReaction: (reaction: string) => void;
  sendChat: (message: string) => void;
  clearError: () => void;
}

export function useGameState(
  socket: Socket,
  yellowClient: YellowRpcClient | null,
  address?: string,
): UseGameStateReturn {
  const [gameState, setGameState] = useState<PokerPlayerState | null>(null);
  const [lastHandResult, setLastHandResult] = useState<HandResult | null>(null);
  const [handHistory, setHandHistory] = useState<HandHistoryEntry[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [seatIndex, setSeatIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSigningSession, setIsSigningSession] = useState(false);
  // Track pending join so we know when to extract seatIndex from PLAYER_JOINED
  const [, setPendingJoin] = useState(false);

  useEffect(() => {
    function onGameState(state: PokerPlayerState) {
      setGameState(state);

      // Clear hand result when a new hand starts so overlay hides
      if (state.isHandInProgress) {
        setLastHandResult(null);
      }

      // If we just joined and are waiting for our seat assignment
      setPendingJoin((pending) => {
        if (pending) {
          return false;
        }
        return pending;
      });
    }

    function onRoomCreated(data: { roomId: string; seatIndex?: number }) {
      setRoomId(data.roomId);
      if (data.seatIndex !== undefined) {
        setSeatIndex(data.seatIndex);
      }
    }

    function onPlayerJoined(data: { seatIndex: number; address: string }) {
      // If this is our join (we have a pending join and this matches), set our seat
      setPendingJoin((pending) => {
        if (pending) {
          setSeatIndex(data.seatIndex);
          return false;
        }
        return pending;
      });
    }

    function onHandComplete(result: HandResult) {
      setLastHandResult(result);

      // Auto-clear after 6s as fallback (in case auto-start fails)
      setTimeout(() => setLastHandResult(null), 6000);

      // Add to hand history if it has a hand number (real hand result, not start signal)
      if (result.handNumber && result.winners?.length > 0) {
        const handNum = result.handNumber;
        setHandHistory((prev) => [
          {
            handNumber: handNum,
            winners: result.winners,
            pots: result.pots,
            chipUnit: result.chipUnit ?? 1,
            timestamp: Date.now(),
          },
          ...prev,
        ]);
      }
    }

    function onPlayerLeft(data: { seatIndex: number }) {
      if (data.seatIndex === seatIndex) {
        setRoomId(null);
        setSeatIndex(null);
        setGameState(null);
        setLastHandResult(null);
        setHandHistory([]);
      }
    }

    function onError(data: { message: string }) {
      setError(data.message);
      // If we had a pending join that failed, clear it
      setPendingJoin(false);
    }

    function onCashedOut() {
      setRoomId(null);
      setSeatIndex(null);
      setGameState(null);
      setLastHandResult(null);
      setHandHistory([]);
    }

    function onSignSessionRequest(data: {
      definition: any;
      allocations: any;
      req: any[];
    }) {
      console.log("[Game] Received SIGN_SESSION_REQUEST", {
        hasReq: !!data.req,
      });
      if (!yellowClient || !address) {
        console.error(
          "[Game] Cannot sign session — no Yellow client or address",
        );
        return;
      }

      setIsSigningSession(true);
      yellowClient
        .signPayload(data.req)
        .then((signature: string) => {
          console.log(
            "[Game] Payload signed locally, sending signature to server",
          );
          socket.emit(EVENTS.SESSION_SIGNED, {
            roomId,
            address,
            signature,
          });
        })
        .catch((err: any) => {
          console.error("[Game] Failed to sign payload:", err);
          setError(`Failed to sign session: ${err?.message ?? "unknown"}`);
        })
        .finally(() => {
          setIsSigningSession(false);
        });
    }

    function onSessionReady() {
      console.log("[Game] Session ready — hand starting");
      setIsSigningSession(false);
    }

    function onSessionError(data: { message: string }) {
      console.error("[Game] Session error:", data.message);
      setIsSigningSession(false);
      setError(`Session error: ${data.message}`);
    }

    socket.on(EVENTS.GAME_STATE, onGameState);
    socket.on(EVENTS.ROOM_CREATED, onRoomCreated);
    socket.on(EVENTS.PLAYER_JOINED, onPlayerJoined);
    socket.on(EVENTS.HAND_COMPLETE, onHandComplete);
    socket.on(EVENTS.PLAYER_LEFT, onPlayerLeft);
    socket.on(EVENTS.ERROR, onError);
    socket.on(EVENTS.CASHED_OUT, onCashedOut);
    socket.on(EVENTS.SIGN_SESSION_REQUEST, onSignSessionRequest);
    socket.on(EVENTS.SESSION_READY, onSessionReady);
    socket.on(EVENTS.SESSION_ERROR, onSessionError);

    return () => {
      socket.off(EVENTS.GAME_STATE, onGameState);
      socket.off(EVENTS.ROOM_CREATED, onRoomCreated);
      socket.off(EVENTS.PLAYER_JOINED, onPlayerJoined);
      socket.off(EVENTS.HAND_COMPLETE, onHandComplete);
      socket.off(EVENTS.PLAYER_LEFT, onPlayerLeft);
      socket.off(EVENTS.ERROR, onError);
      socket.off(EVENTS.CASHED_OUT, onCashedOut);
      socket.off(EVENTS.SIGN_SESSION_REQUEST, onSignSessionRequest);
      socket.off(EVENTS.SESSION_READY, onSessionReady);
      socket.off(EVENTS.SESSION_ERROR, onSessionError);
    };
  }, [socket, seatIndex, yellowClient, address, roomId]);

  const createRoom = useCallback(
    (config: {
      buyIn: number;
      smallBlind: number;
      bigBlind: number;
      maxPlayers: number;
      chipUnit: number;
    }) => {
      socket.emit(EVENTS.CREATE_ROOM, { gameType: "poker", ...config });
    },
    [socket],
  );

  const joinRoom = useCallback(
    (id: string, seat: number) => {
      setRoomId(id);
      setPendingJoin(true);
      // Don't set seatIndex here — wait for server's PLAYER_JOINED
      socket.emit(EVENTS.JOIN_ROOM, { roomId: id, seatIndex: seat });
    },
    [socket],
  );

  const leaveRoom = useCallback(() => {
    if (roomId) {
      socket.emit(EVENTS.LEAVE_ROOM, { roomId });
    }
  }, [socket, roomId]);

  const cashOut = useCallback(() => {
    if (roomId) {
      socket.emit(EVENTS.CASH_OUT, { roomId });
    }
  }, [socket, roomId]);

  const startHand = useCallback(() => {
    if (roomId) {
      socket.emit(EVENTS.START_HAND, { roomId });
    }
  }, [socket, roomId]);

  const sendAction = useCallback(
    (action: PokerAction, betSize?: number) => {
      if (roomId) {
        socket.emit(EVENTS.PLAYER_ACTION, { roomId, action, betSize });
      }
    },
    [socket, roomId],
  );

  const sendReaction = useCallback(
    (reaction: string) => {
      if (roomId) {
        socket.emit(EVENTS.SEND_REACTION, { roomId, reaction });
      }
    },
    [socket, roomId],
  );

  const sendChat = useCallback(
    (message: string) => {
      if (roomId) {
        socket.emit(EVENTS.CHAT_MESSAGE, { roomId, message });
      }
    },
    [socket, roomId],
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    gameState,
    lastHandResult,
    handHistory,
    roomId,
    seatIndex,
    error,
    isSigningSession,
    createRoom,
    joinRoom,
    leaveRoom,
    cashOut,
    startHand,
    sendAction,
    sendReaction,
    sendChat,
    clearError,
  };
}
