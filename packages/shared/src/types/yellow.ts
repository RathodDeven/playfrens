export interface YellowBalance {
  token: string;
  amount: string;
}

export interface AppSessionConfig {
  participants: string[];
  weights: number[];
  quorum: number;
  challenge: number;
  nonce: number;
}

export type AppSessionStatus = "open" | "closed" | "challenged";
