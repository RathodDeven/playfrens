import type { AppSessionConfig, AppSessionStatus } from "@playfrens/shared";

export interface AppSession {
  sessionId: string;
  config: AppSessionConfig;
  status: AppSessionStatus;
  allocations: Map<string, number>;
}

export function createSessionConfig(
  participants: string[],
  serverAddress: string,
): AppSessionConfig {
  // All players + server as participants
  // Server gets weight 100 (trusted judge), players get 0
  const allParticipants = [...participants, serverAddress];
  const weights = participants.map(() => 0);
  weights.push(100); // Server (trusted judge) has full weight

  return {
    participants: allParticipants,
    weights,
    quorum: 100,
    challenge: 0,
    nonce: Date.now(),
  };
}

export function computeAllocations(
  participants: string[],
  chipCounts: Map<number, number>,
  seatToAddress: Map<number, string>,
  totalDeposit: number,
  chipUnit: number,
): Map<string, number> {
  const allocations = new Map<string, number>();

  // Initialize all participants with 0
  for (const p of participants) {
    allocations.set(p, 0);
  }

  const roundAmount = (value: number) =>
    Math.round(value * 1_000_000) / 1_000_000;

  // Calculate total chips in play
  let totalChips = 0;
  for (const [, chips] of chipCounts) {
    totalChips += chips;
  }

  if (totalChips === 0) return allocations;

  // Allocate based on chips -> ytest.usd, then normalize to totalDeposit
  let allocatedTotal = 0;
  let topSeat: number | null = null;
  let topChips = -1;

  for (const [seat, chips] of chipCounts) {
    const address = seatToAddress.get(seat);
    if (!address) continue;

    const amount = roundAmount(chips * chipUnit);
    allocations.set(address, amount);
    allocatedTotal = roundAmount(allocatedTotal + amount);

    if (chips > topChips) {
      topChips = chips;
      topSeat = seat;
    }
  }

  const diff = roundAmount(totalDeposit - allocatedTotal);
  if (diff !== 0 && topSeat !== null) {
    const topAddress = seatToAddress.get(topSeat);
    if (topAddress) {
      const current = allocations.get(topAddress) ?? 0;
      allocations.set(topAddress, roundAmount(current + diff));
    }
  }

  return allocations;
}
