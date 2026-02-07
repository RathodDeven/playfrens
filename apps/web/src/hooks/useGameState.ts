import { useCallback, useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import {
  EVENTS,
  type HandResult,
  type PokerAction,
  type PokerPlayerState,
} from "@playfrens/shared";

interface UseGameStateReturn {
  gameState: PokerPlayerState | null;
  lastHandResult: HandResult | null;
  roomId: string | null;
  seatIndex: number | null;
  error: string | null;
  createRoom: (config: {
    buyIn: number;
    smallBlind: number;
    bigBlind: number;
    maxPlayers: number;
  }) => void;
  joinRoom: (roomId: string, seatIndex: number) => void;
  leaveRoom: () => void;
  startHand: () => void;
  sendAction: (action: PokerAction, betSize?: number) => void;
  sendReaction: (reaction: string) => void;
  sendChat: (message: string) => void;
  clearError: () => void;
}

export function useGameState(socket: Socket): UseGameStateReturn {
  const [gameState, setGameState] = useState<PokerPlayerState | null>(null);
  const [lastHandResult, setLastHandResult] = useState<HandResult | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [seatIndex, setSeatIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onGameState(state: PokerPlayerState) {
      setGameState(state);
    }

    function onRoomCreated(data: { roomId: string }) {
      setRoomId(data.roomId);
    }

    function onHandComplete(result: HandResult) {
      setLastHandResult(result);
    }

    function onError(data: { message: string }) {
      setError(data.message);
    }

    socket.on(EVENTS.GAME_STATE, onGameState);
    socket.on(EVENTS.ROOM_CREATED, onRoomCreated);
    socket.on(EVENTS.HAND_COMPLETE, onHandComplete);
    socket.on(EVENTS.ERROR, onError);

    return () => {
      socket.off(EVENTS.GAME_STATE, onGameState);
      socket.off(EVENTS.ROOM_CREATED, onRoomCreated);
      socket.off(EVENTS.HAND_COMPLETE, onHandComplete);
      socket.off(EVENTS.ERROR, onError);
    };
  }, [socket]);

  const createRoom = useCallback(
    (config: {
      buyIn: number;
      smallBlind: number;
      bigBlind: number;
      maxPlayers: number;
    }) => {
      socket.emit(EVENTS.CREATE_ROOM, { gameType: "poker", ...config });
    },
    [socket],
  );

  const joinRoom = useCallback(
    (id: string, seat: number) => {
      setRoomId(id);
      setSeatIndex(seat);
      socket.emit(EVENTS.JOIN_ROOM, { roomId: id, seatIndex: seat });
    },
    [socket],
  );

  const leaveRoom = useCallback(() => {
    if (roomId) {
      socket.emit(EVENTS.LEAVE_ROOM, { roomId });
      setRoomId(null);
      setSeatIndex(null);
      setGameState(null);
      setLastHandResult(null);
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
    roomId,
    seatIndex,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
    startHand,
    sendAction,
    sendReaction,
    sendChat,
    clearError,
  };
}
