import {
  EVENTS,
  type HandResult,
  type PokerAction,
  type PokerPlayerState,
} from "@playfrens/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { soundManager } from "../lib/sounds";
import type { TransactionEntry } from "../lib/transactions";
import type { YellowRpcClient } from "../lib/yellowRpc";

export interface HandHistoryEntry {
  handNumber: number;
  winners: Array<{
    seatIndex: number;
    amount: number;
    hand?: string;
    address?: string;
    ensName?: string;
  }>;
  pots: Array<{ amount: number; eligibleSeats: number[] }>;
  chipUnit: number;
  timestamp: number;
  heroDelta?: number;
}

interface UseGameStateReturn {
  gameState: PokerPlayerState | null;
  lastHandResult: HandResult | null;
  handHistory: HandHistoryEntry[];
  roomId: string | null;
  seatIndex: number | null;
  error: string | null;
  isSigningSession: boolean;
  isLeaveNextHand: boolean;
  createRoom: (config: {
    buyIn: number;
    smallBlind: number;
    bigBlind: number;
    maxPlayers: number;
    chipUnit: number;
  }) => void;
  joinRoom: (roomId: string, seatIndex: number) => void;
  leaveRoom: () => void;
  leaveNextHand: () => void;
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
  onRecordTransaction?: (entry: Omit<TransactionEntry, "id">) => void,
): UseGameStateReturn {
  const [gameState, setGameState] = useState<PokerPlayerState | null>(null);
  const [lastHandResult, setLastHandResult] = useState<HandResult | null>(null);
  const [handHistory, setHandHistory] = useState<HandHistoryEntry[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [seatIndex, setSeatIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSigningSession, setIsSigningSession] = useState(false);
  const [isLeaveNextHand, setIsLeaveNextHand] = useState(false);
  // Track pending join so we know when to extract seatIndex from PLAYER_JOINED
  const [, setPendingJoin] = useState(false);
  const recordTxnRef = useRef(onRecordTransaction);
  recordTxnRef.current = onRecordTransaction;

  // Refs to avoid side-effects inside state updaters (React strict mode calls them twice)
  const gameStateRef = useRef<PokerPlayerState | null>(null);
  const prevGameStateRef = useRef<PokerPlayerState | null>(null);
  const heroChipsBeforeRef = useRef<number | null>(null);
  const buyInRecordedRef = useRef(false);
  const leftRecordedRef = useRef(false);

  useEffect(() => {
    function onGameState(state: PokerPlayerState) {
      const prev = prevGameStateRef.current;

      // Play deal sound when a new hand starts
      if (state.isHandInProgress && !prev?.isHandInProgress) {
        soundManager.play("deal");

        // Track hero's chip count at hand start for win/loss calculation
        if (seatIndex !== null) {
          const heroSeat = state.seats.find((s) => s.seatIndex === seatIndex);
          heroChipsBeforeRef.current = heroSeat?.chipCount ?? null;
        }
      }

      // Hand just ended — compute win/loss from chip delta
      if (
        !state.isHandInProgress &&
        prev?.isHandInProgress &&
        heroChipsBeforeRef.current !== null &&
        seatIndex !== null
      ) {
        const heroSeat = state.seats.find((s) => s.seatIndex === seatIndex);
        if (heroSeat) {
          const delta = heroSeat.chipCount - heroChipsBeforeRef.current;
          const unit = state.chipUnit || 1;
          if (delta > 0 && recordTxnRef.current) {
            recordTxnRef.current({
              type: "hand_win",
              amount: delta * unit,
              timestamp: Date.now(),
              details: `Hand #${state.handNumber}`,
            });
          } else if (delta < 0 && recordTxnRef.current) {
            recordTxnRef.current({
              type: "hand_loss",
              amount: Math.abs(delta) * unit,
              timestamp: Date.now(),
              details: `Hand #${state.handNumber}`,
            });
          }
          // Update the latest hand history entry with hero's chip delta
          if (delta !== 0) {
            setHandHistory((prev) => {
              if (prev.length === 0) return prev;
              const latest = prev[0];
              return [{ ...latest, heroDelta: delta }, ...prev.slice(1)];
            });
          }
        }
        heroChipsBeforeRef.current = null;
      }

      prevGameStateRef.current = state;
      gameStateRef.current = state;
      setGameState(state);

      // Clear hand result when a new hand starts so overlay hides
      if (state.isHandInProgress) {
        setLastHandResult(null);
        setIsLeaveNextHand(false);
      }

      // If we just joined and are waiting for our seat assignment
      setPendingJoin((pending) => {
        if (pending) {
          return false;
        }
        return pending;
      });
    }

    function onLeaveNextHandAck() {
      setIsLeaveNextHand(true);
    }

    function onRoomCreated(data: { roomId: string; seatIndex?: number }) {
      setRoomId(data.roomId);
      if (data.seatIndex !== undefined) {
        setSeatIndex(data.seatIndex);
      }
      // Reset dedup flags for new room
      buyInRecordedRef.current = false;
      leftRecordedRef.current = false;
    }

    function onPlayerJoined(data: { seatIndex: number; address: string }) {
      // If this is our join (we have a pending join and this matches), set our seat
      setPendingJoin((pending) => {
        if (pending) {
          setSeatIndex(data.seatIndex);
          buyInRecordedRef.current = false;
          leftRecordedRef.current = false;
          return false;
        }
        return pending;
      });
    }

    function onHandComplete(result: HandResult) {
      setLastHandResult(result);
      soundManager.play("win");

      // Auto-clear after 6s as fallback (in case auto-start fails)
      setTimeout(() => setLastHandResult(null), 6000);

      // Add to hand history if it has a hand number (real hand result, not start signal)
      if (result.handNumber && result.winners?.length > 0) {
        const handNum = result.handNumber;
        const unit = result.chipUnit ?? 1;
        setHandHistory((prev) => [
          {
            handNumber: handNum,
            winners: result.winners.map((w) => ({
              seatIndex: w.seatIndex,
              amount: w.amount,
              hand: w.hand,
              address: w.address,
              ensName: w.ensName,
            })),
            pots: result.pots,
            chipUnit: unit,
            timestamp: Date.now(),
          },
          ...prev,
        ]);
        // Win/loss transactions are now recorded in onGameState (chip delta approach)
      }
    }

    function onPlayerLeft(data: { seatIndex: number }) {
      if (data.seatIndex === seatIndex) {
        // Record cash-out for hero leaving (only once)
        if (recordTxnRef.current && !leftRecordedRef.current) {
          leftRecordedRef.current = true;
          const current = gameStateRef.current;
          if (current) {
            const heroSeat = current.seats.find(
              (s) => s.seatIndex === seatIndex,
            );
            if (heroSeat) {
              const unit = current.chipUnit || 1;
              recordTxnRef.current({
                type: "cash_out",
                amount: heroSeat.chipCount * unit,
                timestamp: Date.now(),
                details: `${heroSeat.chipCount} chips`,
              });
            }
          }
        }

        setRoomId(null);
        setSeatIndex(null);
        setGameState(null);
        gameStateRef.current = null;
        prevGameStateRef.current = null;
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
      // Cash-out transaction is recorded in onPlayerLeft (which also fires)
      // Just reset state here
      setRoomId(null);
      setSeatIndex(null);
      setGameState(null);
      gameStateRef.current = null;
      prevGameStateRef.current = null;
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

    function onSessionReady(data: { sessionId?: string }) {
      console.log("[Game] Session ready — hand starting", data?.sessionId);
      setIsSigningSession(false);

      // Record buy-in transaction (only once per session)
      if (recordTxnRef.current && !buyInRecordedRef.current) {
        buyInRecordedRef.current = true;
        const current = gameStateRef.current;
        if (current) {
          const heroSeat = current.seats.find((s) => s.seatIndex === seatIndex);
          if (heroSeat) {
            const unit = current.chipUnit || 1;
            recordTxnRef.current({
              type: "buy_in",
              amount: heroSeat.chipCount * unit,
              timestamp: Date.now(),
              details: `${heroSeat.chipCount} chips`,
            });
          }
        }
      }
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
    socket.on(EVENTS.LEAVE_NEXT_HAND_ACK, onLeaveNextHandAck);

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
      socket.off(EVENTS.LEAVE_NEXT_HAND_ACK, onLeaveNextHandAck);
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

  const leaveNextHand = useCallback(() => {
    if (roomId) {
      socket.emit(EVENTS.LEAVE_NEXT_HAND, { roomId });
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
    isLeaveNextHand,
    createRoom,
    joinRoom,
    leaveRoom,
    leaveNextHand,
    cashOut,
    startHand,
    sendAction,
    sendReaction,
    sendChat,
    clearError,
  };
}
