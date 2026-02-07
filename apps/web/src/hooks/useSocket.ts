import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { EVENTS } from "@playfrens/shared";
import { connectSocket, disconnectSocket, getSocket } from "../lib/socket";

export function useSocket(address?: string, ensName?: string, ensAvatar?: string): {
  socket: ReturnType<typeof getSocket>;
  isConnected: boolean;
  isRegistered: boolean;
} {
  const [isConnected, setIsConnected] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!address) return;

    const socket = connectSocket();
    socketRef.current = socket;

    function onConnect() {
      setIsConnected(true);
      socket.emit(EVENTS.REGISTER, { address, ensName, ensAvatar });
    }

    function onRegistered() {
      setIsRegistered(true);
    }

    function onDisconnect() {
      setIsConnected(false);
      setIsRegistered(false);
    }

    socket.on("connect", onConnect);
    socket.on(EVENTS.REGISTERED, onRegistered);
    socket.on("disconnect", onDisconnect);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off(EVENTS.REGISTERED, onRegistered);
      socket.off("disconnect", onDisconnect);
    };
  }, [address, ensName, ensAvatar]);

  return {
    socket: socketRef.current || getSocket(),
    isConnected,
    isRegistered,
  };
}
