import type { AppSessionConfig, AppSessionStatus } from "@playfrens/shared";
import { type Address, getAddress } from "viem";
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
  // Normalize all addresses to EIP-55 checksum format — Clearnode
  // stores wallet addresses in checksum and does case-sensitive comparison.
  const allParticipants = [...participants, serverAddress].map((a) =>
    getAddress(a as `0x${string}`),
  ) as Address[];
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
    participant: getAddress(p as `0x${string}`) as Address,
    asset: ASSET,
    amount: playerAmount,
  }));

  // Server participant gets 0
  allocations.push({
    participant: getAddress(serverAddress as `0x${string}`) as Address,
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

  // Normalize participant addresses to EIP-55 checksum
  const checksumParticipants = participants.map((p) =>
    getAddress(p as `0x${string}`),
  );

  // Initialize all participants with 0
  for (const p of checksumParticipants) {
    addressToAmount.set(p, 0);
  }

  const totalChips = Array.from(chipCounts.values()).reduce(
    (sum, c) => sum + c,
    0,
  );
  if (totalChips === 0) {
    // Safety net: distribute totalDeposit equally among non-server participants
    // rather than returning all zeros (which Clearnode rejects as "not fully redistributed")
    const playerParticipants = checksumParticipants.filter(
      (_, i) => i < checksumParticipants.length - 1,
    );
    const equalShare =
      playerParticipants.length > 0
        ? roundAmount(totalDeposit / playerParticipants.length)
        : 0;
    return checksumParticipants.map((p, i) => ({
      participant: p as Address,
      asset: ASSET,
      amount: i < checksumParticipants.length - 1 ? String(equalShare) : "0",
    }));
  }

  // Allocate based on chips -> ytest.usd
  let allocatedTotal = 0;
  let topAddress: string | null = null;
  let topChips = -1;

  for (const [seat, chips] of chipCounts) {
    const rawAddress = seatToAddress.get(seat);
    if (!rawAddress) continue;
    const address = getAddress(rawAddress as `0x${string}`);

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

  return checksumParticipants.map((p) => ({
    participant: p as Address,
    asset: ASSET,
    amount: String(addressToAmount.get(p) ?? 0),
  }));
}

function roundAmount(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
