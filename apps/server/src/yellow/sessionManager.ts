import { fromOnChainAmount, toOnChainAmount } from "@playfrens/shared";
import type { GameRoom } from "../games/GameRoom.js";
import type { PokerRoom } from "../games/poker/PokerRoom.js";
import type {
  AppSessionAllocation,
  AppSessionDefinition,
  YellowClient,
} from "./client.js";
import {
  computeAllocations,
  createInitialAllocations,
  createSessionDefinition,
} from "./session.js";

export interface RoomSession {
  sessionId: string;
  participants: string[];
  serverAddress: string;
  totalDeposit: number;
  chipUnit: number;
  buyIn: number;
  /** Last known allocations — updated after each hand for reliable close */
  lastAllocations: AppSessionAllocation[];
}

/**
 * Pending session waiting for all participants to co-sign.
 * All signatures are collected and sent as ONE multi-sig message.
 */
export interface PendingSession {
  roomId: string;
  definition: AppSessionDefinition;
  allocations: AppSessionAllocation[];
  /** All participants including server */
  participants: string[];
  /** Player addresses only (no server) */
  playerParticipants: string[];
  buyIn: number;
  chipUnit: number;
  /** Raw RPC request array — all signers sign this same payload */
  req: any[];
  /** Server's signature of the req payload */
  serverSig: string;
  /** Player address (lowercased) → signature hex */
  playerSigs: Map<string, string>;
  onReady: (sessionId: string) => void;
  onError: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

function roundAmount(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export class YellowSessionManager {
  private sessions = new Map<string, RoomSession>();
  private pendingSessions = new Map<string, PendingSession>();
  private client: YellowClient;
  private serverAddress: string;

  constructor(client: YellowClient, serverAddress: string) {
    this.client = client;
    this.serverAddress = serverAddress;
  }

  hasSession(roomId: string): boolean {
    return this.sessions.has(roomId);
  }

  hasPendingSession(roomId: string): boolean {
    return this.pendingSessions.has(roomId);
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
    const value = fromOnChainAmount(match?.amount ?? "0");
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
   * Start the multi-party signing process.
   * 1) Prepares session definition + allocations
   * 2) Server signs the req locally (does NOT send to Clearnode yet)
   * 3) Returns definition, allocations, and the req payload for players to co-sign
   * 4) Players sign the same req payload and send signatures back via Socket.io
   * 5) When all sigs collected, server assembles ONE multi-sig message and sends to Clearnode
   */
  async startSigning(
    room: GameRoom,
    onReady: (sessionId: string) => void,
    onError: (error: Error) => void,
  ): Promise<{
    definition: AppSessionDefinition;
    allocations: AppSessionAllocation[];
    req: any[];
  }> {
    const roomId = room.roomId;

    // Clean up any existing pending
    this.cancelPending(roomId);

    const participants = Array.from(room.getPlayerAddresses().values());
    if (participants.length < 2) {
      throw new Error("Need at least 2 players to start a session");
    }

    const definition = createSessionDefinition(
      participants,
      this.serverAddress,
    );
    const allocations = createInitialAllocations(
      participants,
      this.serverAddress,
      room.config.buyIn,
      room.config.chipUnit,
    );

    const allParticipants = [...participants, this.serverAddress];

    console.log(`[Yellow] Starting signing for room ${roomId}`);
    console.log(
      `[Yellow] Participants: ${allParticipants.map((p) => p.slice(0, 10)).join(", ")}`,
    );
    console.log(
      `[Yellow] Allocations: ${allocations.map((a) => `${a.participant.slice(0, 10)}: ${a.amount} ${a.asset}`).join(", ")}`,
    );

    // Server creates and signs the request locally (no WS send yet)
    const { req, serverSig } = await this.client.prepareAppSessionRequest(
      definition,
      allocations,
    );
    console.log(`[Yellow] Server signed req locally for room ${roomId}`);

    const timeout = setTimeout(() => {
      const p = this.pendingSessions.get(roomId);
      if (p) {
        const missing = p.playerParticipants.filter(
          (addr) => !p.playerSigs.has(addr.toLowerCase()),
        );
        console.error(
          `[Yellow] Signing timed out for room ${roomId}. Missing: ${missing.map((m) => m.slice(0, 10)).join(", ")}`,
        );
        this.pendingSessions.delete(roomId);
        onError(
          new Error(
            `Signing timed out. ${missing.length} player(s) didn't sign.`,
          ),
        );
      }
    }, 30000);

    const pending: PendingSession = {
      roomId,
      definition,
      allocations,
      participants: allParticipants,
      playerParticipants: participants,
      buyIn: room.config.buyIn,
      chipUnit: room.config.chipUnit,
      req,
      serverSig,
      playerSigs: new Map(),
      onReady,
      onError,
      timeout,
    };
    this.pendingSessions.set(roomId, pending);

    return { definition, allocations, req };
  }

  /**
   * Called when a player sends their signature of the req payload.
   * When ALL players have signed, assembles the multi-sig message and sends to Clearnode.
   */
  markSigned(roomId: string, address: string, signature: string): void {
    const pending = this.pendingSessions.get(roomId);
    if (!pending) {
      console.warn(
        `[Yellow] markSigned: no pending session for room ${roomId}`,
      );
      return;
    }

    pending.playerSigs.set(address.toLowerCase(), signature);
    console.log(
      `[Yellow] ${address.slice(0, 10)} signed for room ${roomId} (${pending.playerSigs.size}/${pending.playerParticipants.length} players)`,
    );

    // Check if all PLAYER participants have signed
    const allPlayersSigned = pending.playerParticipants.every((p) =>
      pending.playerSigs.has(p.toLowerCase()),
    );

    if (allPlayersSigned) {
      console.log(
        `[Yellow] All ${pending.playerParticipants.length} players signed for room ${roomId} — assembling multi-sig message`,
      );
      clearTimeout(pending.timeout);
      void this.assembleAndSubmit(roomId, pending);
    }
  }

  /**
   * Assemble all signatures into one message and submit to Clearnode.
   */
  private async assembleAndSubmit(
    roomId: string,
    pending: PendingSession,
  ): Promise<void> {
    const allSigs = [pending.serverSig, ...pending.playerSigs.values()];
    console.log(
      `[Yellow] Sending multi-sig message with ${allSigs.length} signatures for room ${roomId}`,
    );

    try {
      const sessionId = await this.client.submitMultiSigSession(
        pending.req,
        allSigs,
      );
      this.finalizeSession(roomId, pending, sessionId);
    } catch (err: any) {
      console.error(
        `[Yellow] Multi-sig session creation failed: ${err.message}`,
      );
      this.pendingSessions.delete(roomId);
      pending.onError(err);
    }
  }

  private finalizeSession(
    roomId: string,
    pending: PendingSession,
    sessionId: string,
  ): void {
    const playerParticipants = pending.participants.filter(
      (p) => p.toLowerCase() !== this.serverAddress.toLowerCase(),
    );

    const totalDeposit = roundAmount(
      pending.buyIn * pending.chipUnit * playerParticipants.length,
    );

    const session: RoomSession = {
      sessionId,
      participants: playerParticipants,
      serverAddress: this.serverAddress,
      totalDeposit,
      chipUnit: pending.chipUnit,
      buyIn: pending.buyIn,
      lastAllocations: pending.allocations,
    };

    this.sessions.set(roomId, session);
    this.pendingSessions.delete(roomId);

    console.log(
      `[Yellow] Session finalized for room ${roomId}: ${sessionId}, totalDeposit: ${totalDeposit}`,
    );

    pending.onReady(sessionId);
  }

  /**
   * Synchronously compute and store allocations in the session.
   * Call BEFORE removing players to ensure chip data is accurate.
   */
  snapshotAllocations(room: PokerRoom): void {
    const session = this.sessions.get(room.roomId);
    if (!session) return;

    const chipCounts = room.getChipSnapshot() ?? room.getChipCounts();
    const seatToAddress = room.getPlayerSnapshot() ?? room.getPlayerAddresses();
    room.clearSnapshots();

    // Guard: don't overwrite correct allocations if some participants already left
    const addressesInRoom = new Set(
      [...seatToAddress.values()].map((a) => a.toLowerCase()),
    );
    const allPresent = session.participants.every((p) =>
      addressesInRoom.has(p.toLowerCase()),
    );
    if (!allPresent) {
      console.log(
        `[Yellow] snapshotAllocations: not all session participants present in room ${room.roomId} — keeping existing lastAllocations`,
      );
      return;
    }

    const allParticipants = [...session.participants, this.serverAddress];
    const allocations = computeAllocations(
      allParticipants,
      chipCounts,
      seatToAddress,
      session.totalDeposit,
      session.chipUnit,
    );

    session.lastAllocations = allocations;
    this.logAllocations(
      "snapshotAllocations",
      session,
      chipCounts,
      allocations,
    );
  }

  /**
   * Submit chip allocations to Clearnode after each hand.
   * Server is the trusted judge (weight=100) — only server signature needed.
   */
  async submitHandAllocations(room: PokerRoom): Promise<void> {
    const session = this.sessions.get(room.roomId);
    if (!session) {
      console.warn(
        `[Yellow] submitHandAllocations: no session for room ${room.roomId} — skipping`,
      );
      return;
    }

    // Use snapshots when available (taken before finalizePendingLeaves removes players)
    const chipCounts = room.getChipSnapshot() ?? room.getChipCounts();
    const seatToAddress = room.getPlayerSnapshot() ?? room.getPlayerAddresses();
    room.clearSnapshots();

    // Guard: don't overwrite correct allocations if some participants already left
    const addressesInRoom = new Set(
      [...seatToAddress.values()].map((a) => a.toLowerCase()),
    );
    const allPresent = session.participants.every((p) =>
      addressesInRoom.has(p.toLowerCase()),
    );
    if (!allPresent) {
      console.log(
        `[Yellow] submitHandAllocations: not all session participants present in room ${room.roomId} — using existing lastAllocations`,
      );
      // Still submit existing allocations to Clearnode
      try {
        await this.client.submitAppState(
          session.sessionId,
          session.lastAllocations,
        );
        console.log(
          `[Yellow] State submitted (existing allocations) for session ${session.sessionId}`,
        );
      } catch (err: any) {
        console.error(`[Yellow] Submit app state failed: ${err.message}`);
      }
      return;
    }

    const allParticipants = [...session.participants, this.serverAddress];
    const allocations = computeAllocations(
      allParticipants,
      chipCounts,
      seatToAddress,
      session.totalDeposit,
      session.chipUnit,
    );

    session.lastAllocations = allocations;
    this.logAllocations(
      "submitHandAllocations",
      session,
      chipCounts,
      allocations,
    );

    try {
      await this.client.submitAppState(session.sessionId, allocations);
      console.log(
        `[Yellow] State submitted successfully for session ${session.sessionId}`,
      );
    } catch (err: any) {
      console.error(`[Yellow] Submit app state failed: ${err.message}`);
      console.error("[Yellow] Full error:", err);
    }
  }

  /**
   * Close the app session with final allocations.
   * Uses session.lastAllocations — do NOT recompute here because players
   * may have already been removed from the room. Allocations are kept
   * current by snapshotAllocations() and submitHandAllocations().
   */
  async closeSession(roomId: string): Promise<void> {
    const session = this.sessions.get(roomId);
    if (!session) return;

    // Log final allocation details
    console.log(`[Yellow] ══════ CLOSING SESSION ${session.sessionId} ══════`);
    console.log(
      `[Yellow] Total deposit: ${session.totalDeposit} ytest.usd (on-chain: ${toOnChainAmount(session.totalDeposit)})`,
    );

    let allocationSum = 0;
    for (const a of session.lastAllocations) {
      const humanAmount = fromOnChainAmount(a.amount);
      const isServer =
        a.participant.toLowerCase() === this.serverAddress.toLowerCase();
      console.log(
        `[Yellow]   ${isServer ? "SERVER" : "PLAYER"} ${a.participant.slice(0, 10)}: ${a.amount} raw (${humanAmount} ytest.usd)`,
      );
      allocationSum += Number(a.amount);
    }
    console.log(
      `[Yellow]   TOTAL: ${allocationSum} raw (${fromOnChainAmount(String(allocationSum))} ytest.usd)`,
    );
    console.log(
      `[Yellow]   Expected: ${toOnChainAmount(session.totalDeposit)} raw (${session.totalDeposit} ytest.usd)`,
    );
    if (String(allocationSum) !== toOnChainAmount(session.totalDeposit)) {
      console.error(
        `[Yellow]   ⚠ MISMATCH! Allocation sum ${allocationSum} ≠ expected ${toOnChainAmount(session.totalDeposit)}`,
      );
    }

    try {
      await this.client.closeAppSession(
        session.sessionId,
        session.lastAllocations,
      );
      console.log(
        `[Yellow] Session ${session.sessionId} closed — funds distributed`,
      );
    } catch (err: any) {
      console.error(`[Yellow] Close session failed: ${err.message}`);
    }

    this.sessions.delete(roomId);
  }

  cancelPending(roomId: string): void {
    const pending = this.pendingSessions.get(roomId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingSessions.delete(roomId);
      console.log(`[Yellow] Cancelled pending session for room ${roomId}`);
    }
  }

  /** Log detailed allocation info for debugging fund distribution */
  private logAllocations(
    context: string,
    session: RoomSession,
    chipCounts: Map<number, number>,
    allocations: AppSessionAllocation[],
  ): void {
    console.log(`[Yellow] ── ${context} (session ${session.sessionId}) ──`);
    console.log(
      `[Yellow]   Chips: ${[...chipCounts.entries()].map(([s, c]) => `seat${s}=${c}`).join(", ")} | chipUnit=${session.chipUnit}`,
    );

    let allocationSum = 0;
    for (const a of allocations) {
      const humanAmount = fromOnChainAmount(a.amount);
      const isServer =
        a.participant.toLowerCase() === this.serverAddress.toLowerCase();
      console.log(
        `[Yellow]   ${isServer ? "SERVER" : "PLAYER"} ${a.participant.slice(0, 10)}: ${a.amount} raw = ${humanAmount} ytest.usd`,
      );
      allocationSum += Number(a.amount);
    }

    const expectedRaw = toOnChainAmount(session.totalDeposit);
    console.log(
      `[Yellow]   Sum: ${allocationSum} raw | Expected: ${expectedRaw} raw | Match: ${String(allocationSum) === expectedRaw}`,
    );

    // Check server allocation is 0
    const serverAlloc = allocations.find(
      (a) => a.participant.toLowerCase() === this.serverAddress.toLowerCase(),
    );
    if (serverAlloc && serverAlloc.amount !== "0") {
      console.error(
        `[Yellow]   ⚠ SERVER HAS NON-ZERO ALLOCATION: ${serverAlloc.amount}`,
      );
    }
  }
}
