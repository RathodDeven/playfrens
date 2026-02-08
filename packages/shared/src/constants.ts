export const CHAIN_ID = 84532; // Base Sepolia

export const CONTRACTS = {
  CUSTODY: "0x019B65A265EB3363822f2752141b3dF16131b262" as const,
  ADJUDICATOR: "0x7c7ccbc98469190849BCC6c926307794fDfB11F2" as const,
  TOKEN: "0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb" as const,
};

export const CLEARNODE_WS_URL = "wss://clearnet-sandbox.yellow.com/ws";

export const GAME_DEFAULTS = {
  MAX_PLAYERS: 4,
  DEFAULT_BUY_IN: 1000,
  DEFAULT_SMALL_BLIND: 5,
  DEFAULT_BIG_BLIND: 10,
  DEFAULT_CHIP_UNIT: 0.01,
} as const;

export const CHIP_UNITS = [1, 0.01, 0.001] as const;

export const REACTIONS = ["🔥", "🤣", "😭", "👀", "💀"] as const;
export type Reaction = (typeof REACTIONS)[number];

/** ytest.usd (like USDC) uses 6 decimal places on Clearnode */
export const YTEST_DECIMALS = 6;

/** Convert human-readable amount to on-chain smallest units (e.g., 10 → "10000000") */
export function toOnChainAmount(amount: number): string {
  return String(Math.round(amount * 10 ** YTEST_DECIMALS));
}

/** Convert on-chain smallest units to human-readable (e.g., "10000000" → 10) */
export function fromOnChainAmount(raw: string): number {
  return Number(raw) / 10 ** YTEST_DECIMALS;
}
