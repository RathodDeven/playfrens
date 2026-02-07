import type { GameType, RoomConfig, RoomStatus } from "@playfrens/shared";

export abstract class GameRoom {
  abstract readonly gameType: GameType;

  readonly roomId: string;
  readonly config: RoomConfig;
  status: RoomStatus = "waiting";
  readonly createdAt: number;

  constructor(roomId: string, config: RoomConfig) {
    this.roomId = roomId;
    this.config = config;
    this.createdAt = Date.now();
  }

  abstract addPlayer(
    address: string,
    seatIndex: number,
    buyIn: number,
    ensName?: string,
    ensAvatar?: string,
  ): void;
  abstract removePlayer(seatIndex: number): void;
  abstract handleAction(
    seatIndex: number,
    action: string,
    data?: unknown,
  ): void;
  abstract startHand(): void;
  abstract getPublicState(): unknown;
  abstract getPlayerState(seatIndex: number): unknown;
  abstract getPlayerCount(): number;
  abstract getPlayerAddresses(): Map<number, string>;
}
