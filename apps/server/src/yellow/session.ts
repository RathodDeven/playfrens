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
): Map<string, number> {
  const allocations = new Map<string, number>();

  // Initialize all participants with 0
  for (const p of participants) {
    allocations.set(p, 0);
  }

  // Calculate total chips in play
  let totalChips = 0;
  for (const [, chips] of chipCounts) {
    totalChips += chips;
  }

  if (totalChips === 0) return allocations;

  // Proportionally allocate based on chip counts
  for (const [seat, chips] of chipCounts) {
    const address = seatToAddress.get(seat);
    if (address) {
      const share = Math.floor((chips / totalChips) * totalDeposit);
      allocations.set(address, share);
    }
  }

  return allocations;
}
