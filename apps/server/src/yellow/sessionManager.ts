import type { GameRoom } from "../games/GameRoom.js";
import type { PokerRoom } from "../games/poker/PokerRoom.js";
import type { YellowClient } from "./client.js";
import { computeAllocations, createSessionConfig } from "./session.js";

export interface RoomSession {
  sessionId: string;
  participants: string[];
  totalDeposit: number;
  chipUnit: number;
  buyIn: number;
}

function toRecord(map: Map<string, number>): Record<string, number> {
  const record: Record<string, number> = {};
  for (const [key, value] of map.entries()) {
    record[key] = value;
  }
  return record;
}

function roundAmount(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export class YellowSessionManager {
  private sessions = new Map<string, RoomSession>();
  private client: YellowClient;
  private serverAddress: string;

  constructor(client: YellowClient, serverAddress: string) {
    this.client = client;
    this.serverAddress = serverAddress;
  }

  hasSession(roomId: string): boolean {
    return this.sessions.has(roomId);
  }

  getSession(roomId: string): RoomSession | undefined {
    return this.sessions.get(roomId);
  }

  async getBalance(address: string): Promise<number> {
    return this.client.getBalance(address);
  }

  async ensureSession(room: GameRoom): Promise<RoomSession> {
    const existing = this.sessions.get(room.roomId);
    if (existing) return existing;

    const participants = Array.from(room.getPlayerAddresses().values());
    if (participants.length < 2) {
      throw new Error("Need at least 2 players to start a session");
    }

    const config = createSessionConfig(participants, this.serverAddress);
    const sessionId = await this.client.createAppSession(
      config.participants,
      config.weights,
      config.quorum,
    );

    const totalDeposit = roundAmount(
      room.config.buyIn * room.config.chipUnit * participants.length,
    );

    const allocations = new Map<string, number>();
    for (const address of participants) {
      allocations.set(address, roundAmount(room.config.buyIn * room.config.chipUnit));
    }

    await this.client.submitAppState(sessionId, toRecord(allocations), "operate");

    const session: RoomSession = {
      sessionId,
      participants,
      totalDeposit,
      chipUnit: room.config.chipUnit,
      buyIn: room.config.buyIn,
    };

    this.sessions.set(room.roomId, session);
    return session;
  }

  async submitHandAllocations(room: PokerRoom): Promise<void> {
    const session = this.sessions.get(room.roomId);
    if (!session) return;

    const allocations = computeAllocations(
      session.participants,
      room.getChipCounts(),
      room.getPlayerAddresses(),
      session.totalDeposit,
      session.chipUnit,
    );

    await this.client.submitAppState(
      session.sessionId,
      toRecord(allocations),
      "operate",
    );
  }

  async closeSession(roomId: string, room: PokerRoom): Promise<void> {
    const session = this.sessions.get(roomId);
    if (!session) return;

    const allocations = computeAllocations(
      session.participants,
      room.getChipCounts(),
      room.getPlayerAddresses(),
      session.totalDeposit,
      session.chipUnit,
    );

    await this.client.closeAppSession(session.sessionId, toRecord(allocations));
    this.sessions.delete(roomId);
  }
}
