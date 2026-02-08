import { EVENTS, type RoomInfo } from "@playfrens/shared";
import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";

export function usePublicRooms(socket: Socket): RoomInfo[] {
  const [rooms, setRooms] = useState<RoomInfo[]>([]);

  useEffect(() => {
    function onRoomList(data: RoomInfo[]) {
      setRooms(data);
    }

    socket.on(EVENTS.ROOM_LIST, onRoomList);

    // Request initial list
    if (socket.connected) {
      socket.emit(EVENTS.ROOM_LIST);
    }

    function onConnect() {
      socket.emit(EVENTS.ROOM_LIST);
    }
    socket.on("connect", onConnect);

    return () => {
      socket.off(EVENTS.ROOM_LIST, onRoomList);
      socket.off("connect", onConnect);
    };
  }, [socket]);

  return rooms;
}
