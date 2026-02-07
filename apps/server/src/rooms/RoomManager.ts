import type { GameType, HandResult, RoomConfig, RoomInfo } from "@playfrens/shared";
import { GameRoom } from "../games/GameRoom.js";
import { PokerRoom } from "../games/poker/PokerRoom.js";

export class RoomManager {
  private rooms: Map<string, GameRoom> = new Map();

  createRoom(
    config: RoomConfig,
    onHandComplete?: (roomId: string, result: HandResult) => void,
  ): GameRoom {
    const roomId = this.generateRoomId();

    let room: GameRoom;
    switch (config.gameType) {
      case "poker":
        room = new PokerRoom(roomId, config, (result) => {
          onHandComplete?.(roomId, result);
        });
        break;
      default:
        throw new Error(`Unknown game type: ${config.gameType}`);
    }

    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  deleteRoom(roomId: string): boolean {
    return this.rooms.delete(roomId);
  }

  listRooms(gameType?: GameType): RoomInfo[] {
    const rooms: RoomInfo[] = [];
    for (const room of this.rooms.values()) {
      if (gameType && room.gameType !== gameType) continue;

      const players = [];
      for (const [seat, address] of room.getPlayerAddresses()) {
        players.push({
          address,
          seatIndex: seat,
          chipCount: 0,
          isConnected: true,
        });
      }

      rooms.push({
        roomId: room.roomId,
        gameType: room.gameType,
        players,
        status: room.status,
        config: room.config,
        createdAt: room.createdAt,
      });
    }
    return rooms;
  }

  private generateRoomId(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let id = "";
    for (let i = 0; i < 6; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
  }
}
