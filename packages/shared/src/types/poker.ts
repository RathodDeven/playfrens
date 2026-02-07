export type Suit = "spades" | "hearts" | "diamonds" | "clubs";
export type Rank =
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "T"
  | "J"
  | "Q"
  | "K"
  | "A";

export interface PokerCard {
  rank: Rank;
  suit: Suit;
}

export type PokerAction = "fold" | "check" | "call" | "bet" | "raise";

export type RoundOfBetting =
  | "preflop"
  | "flop"
  | "turn"
  | "river"
  | "showdown";

export interface SeatState {
  seatIndex: number;
  address: string;
  ensName?: string;
  ensAvatar?: string;
  chipCount: number;
  betAmount: number;
  isFolded: boolean;
  isAllIn: boolean;
  isDealer: boolean;
  isTurn: boolean;
  holeCards?: PokerCard[];
}

export interface PotInfo {
  amount: number;
  eligibleSeats: number[];
}

export interface LegalAction {
  action: PokerAction;
  minBet?: number;
  maxBet?: number;
}

export interface PokerGameState {
  communityCards: PokerCard[];
  pots: PotInfo[];
  seats: SeatState[];
  currentPlayerSeat: number | null;
  roundOfBetting: RoundOfBetting;
  dealerSeat: number;
  handNumber: number;
  isHandInProgress: boolean;
}

export interface PokerPlayerState extends PokerGameState {
  holeCards: PokerCard[];
  legalActions: LegalAction[];
}

export interface HandResult {
  winners: Array<{
    seatIndex: number;
    amount: number;
    hand?: string;
  }>;
  pots: PotInfo[];
}
