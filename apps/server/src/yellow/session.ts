import {
  type AppSessionConfig,
  type AppSessionStatus,
  toOnChainAmount,
} from "@playfrens/shared";
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
  const playerAmount = toOnChainAmount(buyIn * chipUnit);
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
 * All arithmetic done in on-chain integer units to avoid floating-point issues.
 * Server (last participant) always gets exactly "0".
 */
export function computeAllocations(
  participants: string[],
  chipCounts: Map<number, number>,
  seatToAddress: Map<number, string>,
  totalDeposit: number,
  chipUnit: number,
): AppSessionAllocation[] {
  // Work in on-chain integer units (6 decimals) to avoid floating point
  const DECIMALS = 10 ** 6;
  const expectedTotal = Math.round(totalDeposit * DECIMALS);

  // Normalize participant addresses to EIP-55 checksum
  const checksumParticipants = participants.map((p) =>
    getAddress(p as `0x${string}`),
  );

  // Map address → on-chain integer amount
  const addressToRaw = new Map<string, number>();
  for (const p of checksumParticipants) {
    addressToRaw.set(p, 0);
  }

  const totalChips = Array.from(chipCounts.values()).reduce(
    (sum, c) => sum + c,
    0,
  );

  if (totalChips === 0) {
    // Safety net: distribute equally among players (not server)
    const playerCount = checksumParticipants.length - 1;
    if (playerCount > 0) {
      const share = Math.floor(expectedTotal / playerCount);
      let remainder = expectedTotal - share * playerCount;
      return checksumParticipants.map((p, i) => {
        if (i >= playerCount)
          return { participant: p as Address, asset: ASSET, amount: "0" };
        const extra = remainder > 0 ? 1 : 0;
        remainder -= extra;
        return {
          participant: p as Address,
          asset: ASSET,
          amount: String(share + extra),
        };
      });
    }
    return checksumParticipants.map((p) => ({
      participant: p as Address,
      asset: ASSET,
      amount: "0",
    }));
  }

  // Convert chips to on-chain amounts (integer math)
  let allocatedSum = 0;
  let topAddress: string | null = null;
  let topChips = -1;

  for (const [seat, chips] of chipCounts) {
    const rawAddress = seatToAddress.get(seat);
    if (!rawAddress) continue;
    const address = getAddress(rawAddress as `0x${string}`);

    // chips * chipUnit * 10^6 — round once to integer
    const rawAmount = Math.round(chips * chipUnit * DECIMALS);
    addressToRaw.set(address, rawAmount);
    allocatedSum += rawAmount;

    if (chips > topChips) {
      topChips = chips;
      topAddress = address;
    }
  }

  // Fix rounding: ensure player allocations sum exactly to expectedTotal
  // Server stays at 0 — only adjust player with most chips
  const diff = expectedTotal - allocatedSum;
  if (diff !== 0 && topAddress) {
    const current = addressToRaw.get(topAddress) ?? 0;
    addressToRaw.set(topAddress, current + diff);
  }

  return checksumParticipants.map((p) => ({
    participant: p as Address,
    asset: ASSET,
    amount: String(addressToRaw.get(p) ?? 0),
  }));
}
