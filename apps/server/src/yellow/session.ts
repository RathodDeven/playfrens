import type { AppSessionConfig, AppSessionStatus } from "@playfrens/shared";
import type { Address } from "viem";
import type { AppSessionAllocation, AppSessionDefinition } from "./client.js";

export interface AppSession {
  sessionId: string;
  config: AppSessionConfig;
  status: AppSessionStatus;
  allocations: Map<string, number>;
}

const ASSET = "ytest.usd";

/**
 * Build an RPCAppDefinition for the Clearnode.
 * Server is added as the last participant with weight=100 (trusted judge).
 * Players get weight=0.
 */
export function createSessionDefinition(
  participants: string[],
  serverAddress: string,
  application = "PlayFrens",
): AppSessionDefinition {
  const allParticipants = [...participants, serverAddress] as Address[];
  const weights = participants.map(() => 0);
  weights.push(100); // Server (trusted judge) has full weight

  return {
    protocol: "NitroRPC/0.2",
    participants: allParticipants,
    weights,
    quorum: 100,
    challenge: 0,
    nonce: Date.now(),
    application,
  };
}

/**
 * Legacy config helper (for shared types compatibility).
 */
export function createSessionConfig(
  participants: string[],
  serverAddress: string,
): AppSessionConfig {
  const allParticipants = [...participants, serverAddress];
  const weights = participants.map(() => 0);
  weights.push(100);

  return {
    participants: allParticipants,
    weights,
    quorum: 100,
    challenge: 0,
    nonce: Date.now(),
  };
}

/**
 * Build initial allocations for app session creation.
 * Each player contributes their buy-in; server contributes 0.
 */
export function createInitialAllocations(
  participants: string[],
  serverAddress: string,
  buyIn: number,
  chipUnit: number,
): AppSessionAllocation[] {
  const playerAmount = String(roundAmount(buyIn * chipUnit));
  const allocations: AppSessionAllocation[] = participants.map((p) => ({
    participant: p as Address,
    asset: ASSET,
    amount: playerAmount,
  }));

  // Server participant gets 0
  allocations.push({
    participant: serverAddress as Address,
    asset: ASSET,
    amount: "0",
  });

  return allocations;
}

/**
 * Compute final allocations from chip counts for close/state updates.
 */
export function computeAllocations(
  participants: string[],
  chipCounts: Map<number, number>,
  seatToAddress: Map<number, string>,
  totalDeposit: number,
  chipUnit: number,
): AppSessionAllocation[] {
  const addressToAmount = new Map<string, number>();

  // Initialize all participants with 0
  for (const p of participants) {
    addressToAmount.set(p, 0);
  }

  const totalChips = Array.from(chipCounts.values()).reduce(
    (sum, c) => sum + c,
    0,
  );
  if (totalChips === 0) {
    return participants.map((p) => ({
      participant: p as Address,
      asset: ASSET,
      amount: "0",
    }));
  }

  // Allocate based on chips -> ytest.usd
  let allocatedTotal = 0;
  let topAddress: string | null = null;
  let topChips = -1;

  for (const [seat, chips] of chipCounts) {
    const address = seatToAddress.get(seat);
    if (!address) continue;

    const amount = roundAmount(chips * chipUnit);
    addressToAmount.set(address, amount);
    allocatedTotal = roundAmount(allocatedTotal + amount);

    if (chips > topChips) {
      topChips = chips;
      topAddress = address;
    }
  }

  // Ensure total allocations sum to totalDeposit (fix rounding)
  const diff = roundAmount(totalDeposit - allocatedTotal);
  if (diff !== 0 && topAddress) {
    const current = addressToAmount.get(topAddress) ?? 0;
    addressToAmount.set(topAddress, roundAmount(current + diff));
  }

  return participants.map((p) => ({
    participant: p as Address,
    asset: ASSET,
    amount: String(addressToAmount.get(p) ?? 0),
  }));
}

function roundAmount(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
