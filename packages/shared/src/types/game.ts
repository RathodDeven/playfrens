import type { PlayerInfo } from "./player.js";

export type GameType = "poker";

export type RoomStatus = "waiting" | "playing" | "finished";

export interface RoomConfig {
  gameType: GameType;
  maxPlayers: number;
  buyIn: number;
  smallBlind: number;
  bigBlind: number;
}

export interface RoomInfo {
  roomId: string;
  gameType: GameType;
  players: PlayerInfo[];
  status: RoomStatus;
  config: RoomConfig;
  createdAt: number;
}
