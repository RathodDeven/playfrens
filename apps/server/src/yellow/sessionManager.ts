import type { GameRoom } from "../games/GameRoom.js";
import type { PokerRoom } from "../games/poker/PokerRoom.js";
import type { YellowClient } from "./client.js";
import {
  computeAllocations,
  createInitialAllocations,
  createSessionConfig,
  createSessionDefinition,
} from "./session.js";

export interface RoomSession {
  sessionId: string;
  participants: string[];
  serverAddress: string;
  totalDeposit: number;
  chipUnit: number;
  buyIn: number;
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

  async getLedgerBalance(address: string, asset: string): Promise<number> {
    const balances = await this.client.getLedgerBalances(address);
    const target = asset.toLowerCase();
    const match =
      balances.find((b) => b.asset?.toLowerCase() === target) ??
      (target === "ytest.usd"
        ? balances.find((b) => b.asset?.toLowerCase() === "usdc")
        : undefined);
    const value = Number(match?.amount ?? 0);
    if (Number.isNaN(value)) {
      throw new Error("Invalid ledger balance returned from Clearnode");
    }
    return value;
  }

  async getLedgerBalances(
    address: string,
  ): Promise<Array<{ asset: string; amount: string }>> {
    return this.client.getLedgerBalances(address);
  }

  /**
   * Create an app session for a room, allocating each player's buy-in.
   * Uses the SDK's createAppSessionMessage with proper definition + allocations.
   */
  async ensureSession(room: GameRoom): Promise<RoomSession> {
    const existing = this.sessions.get(room.roomId);
    if (existing) return existing;

    const participants = Array.from(room.getPlayerAddresses().values());
    if (participants.length < 2) {
      throw new Error("Need at least 2 players to start a session");
    }

    // Build proper RPCAppDefinition
    const definition = createSessionDefinition(
      participants,
      this.serverAddress,
    );

    // Build initial allocations: each player puts in buyIn * chipUnit
    const allocations = createInitialAllocations(
      participants,
      this.serverAddress,
      room.config.buyIn,
      room.config.chipUnit,
    );

    // Create app session via Clearnode using SDK helper
    const sessionId = await this.client.createAppSession(
      definition,
      allocations,
    );

    const totalDeposit = roundAmount(
      room.config.buyIn * room.config.chipUnit * participants.length,
    );

    const session: RoomSession = {
      sessionId,
      participants,
      serverAddress: this.serverAddress,
      totalDeposit,
      chipUnit: room.config.chipUnit,
      buyIn: room.config.buyIn,
    };

    this.sessions.set(room.roomId, session);
    return session;
  }

  /**
   * Log chip allocations after each hand (checkpoint).
   * The actual fund settlement happens on closeSession.
   * TODO: Use createSubmitAppStateMessage for per-hand state updates.
   */
  async submitHandAllocations(room: PokerRoom): Promise<void> {
    const session = this.sessions.get(room.roomId);
    if (!session) return;

    const allParticipants = [...session.participants, this.serverAddress];
    const allocations = computeAllocations(
      allParticipants,
      room.getChipCounts(),
      room.getPlayerAddresses(),
      session.totalDeposit,
      session.chipUnit,
    );

    console.log(
      `[Yellow] Hand allocations for session ${session.sessionId}:`,
      allocations.map((a) => `${a.participant}: ${a.amount}`).join(", "),
    );
  }

  /**
   * Close the app session with final chip-to-ytest.usd allocations.
   * Uses the SDK's createCloseAppSessionMessage.
   */
  async closeSession(roomId: string, room: PokerRoom): Promise<void> {
    const session = this.sessions.get(roomId);
    if (!session) return;

    // Include server in the participants list for close allocations
    const allParticipants = [...session.participants, this.serverAddress];

    const allocations = computeAllocations(
      allParticipants,
      room.getChipCounts(),
      room.getPlayerAddresses(),
      session.totalDeposit,
      session.chipUnit,
    );

    await this.client.closeAppSession(session.sessionId, allocations);
    this.sessions.delete(roomId);
  }
}
