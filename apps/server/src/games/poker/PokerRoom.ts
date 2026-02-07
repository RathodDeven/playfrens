import * as Poker from "poker-ts";
import type {
  GameType,
  HandResult,
  LegalAction,
  PokerAction,
  PokerCard,
  PokerGameState,
  PokerPlayerState,
  PotInfo,
  RoomConfig,
  SeatState,
} from "@playfrens/shared";
import { GameRoom } from "../GameRoom.js";

interface SeatedPlayer {
  address: string;
  ensName?: string;
  ensAvatar?: string;
  seatIndex: number;
}

export class PokerRoom extends GameRoom {
  readonly gameType: GameType = "poker";

  private table: InstanceType<typeof Poker.Table>;
  private players: Map<number, SeatedPlayer> = new Map();
  private handNumber = 0;
  private onHandComplete?: (result: HandResult) => void;

  constructor(
    roomId: string,
    config: RoomConfig,
    onHandComplete?: (result: HandResult) => void,
  ) {
    super(roomId, config);
    this.onHandComplete = onHandComplete;
    this.table = new Poker.Table(
      {
        smallBlind: config.smallBlind,
        bigBlind: config.bigBlind,
      },
      config.maxPlayers,
    );
  }

  addPlayer(
    address: string,
    seatIndex: number,
    buyIn: number,
    ensName?: string,
    ensAvatar?: string,
  ): void {
    if (this.players.has(seatIndex)) {
      throw new Error(`Seat ${seatIndex} is already taken`);
    }
    if (seatIndex < 0 || seatIndex >= this.config.maxPlayers) {
      throw new Error(`Invalid seat index: ${seatIndex}`);
    }

    this.table.sitDown(seatIndex, buyIn);
    this.players.set(seatIndex, { address, ensName, ensAvatar, seatIndex });
  }

  removePlayer(seatIndex: number): void {
    if (!this.players.has(seatIndex)) return;
    try {
      this.table.standUp(seatIndex);
    } catch {
      // Player may have already stood up
    }
    this.players.delete(seatIndex);
  }

  startHand(): void {
    if (this.players.size < 2) {
      throw new Error("Need at least 2 players to start a hand");
    }
    this.table.startHand();
    this.status = "playing";
    this.handNumber++;
  }

  handleAction(seatIndex: number, action: PokerAction, data?: unknown): void {
    if (!this.table.isHandInProgress()) {
      throw new Error("No hand in progress");
    }

    if (this.table.playerToAct() !== seatIndex) {
      throw new Error("Not your turn");
    }

    const betSize =
      data && typeof data === "object" && "betSize" in data
        ? (data as { betSize: number }).betSize
        : undefined;

    this.table.actionTaken(action, betSize);

    // Check if betting round is over
    if (!this.table.isBettingRoundInProgress()) {
      if (this.table.areBettingRoundsCompleted()) {
        this.table.showdown();
        this.handleHandComplete();
      } else {
        this.table.endBettingRound();
      }
    }
  }

  private handleHandComplete(): void {
    const winners = this.table.winners();
    const result: HandResult = {
      winners: winners.map((w: any) => ({
        seatIndex: w.seatIndex,
        amount: w.amount,
        hand: w.hand?.name,
      })),
      pots: this.mapPots(),
    };

    this.onHandComplete?.(result);
  }

  private mapPots(): PotInfo[] {
    try {
      return this.table.pots().map((p: any) => ({
        amount: p.size,
        eligibleSeats: p.eligiblePlayers,
      }));
    } catch {
      return [];
    }
  }

  private mapCard(card: any): PokerCard {
    return { rank: card.rank, suit: card.suit };
  }

  getPublicState(): PokerGameState {
    const seats: SeatState[] = [];
    const tableSeats = this.table.seats();

    for (let i = 0; i < this.config.maxPlayers; i++) {
      const player = this.players.get(i);
      const seat = tableSeats[i];

      if (!player || !seat) continue;

      seats.push({
        seatIndex: i,
        address: player.address,
        ensName: player.ensName,
        ensAvatar: player.ensAvatar,
        chipCount: (seat as any).stack ?? (seat as any).chipStack ?? 0,
        betAmount: (seat as any).betSize ?? 0,
        isFolded: (seat as any).folded ?? false,
        isAllIn: ((seat as any).stack ?? 0) === 0 && !((seat as any).folded ?? false),
        isDealer: this.table.isHandInProgress()
          ? this.table.button() === i
          : false,
        isTurn: this.table.isHandInProgress()
          ? this.table.playerToAct() === i
          : false,
      });
    }

    let communityCards: PokerCard[] = [];
    let roundOfBetting: PokerGameState["roundOfBetting"] = "preflop";
    let currentPlayerSeat: number | null = null;
    let dealerSeat = 0;

    if (this.table.isHandInProgress()) {
      communityCards = this.table.communityCards().map((c: any) => this.mapCard(c));
      roundOfBetting = this.table.roundOfBetting() as PokerGameState["roundOfBetting"];
      dealerSeat = this.table.button();
      if (this.table.isBettingRoundInProgress()) {
        currentPlayerSeat = this.table.playerToAct();
      }
    }

    return {
      communityCards,
      pots: this.mapPots(),
      seats,
      currentPlayerSeat,
      roundOfBetting,
      dealerSeat,
      handNumber: this.handNumber,
      isHandInProgress: this.table.isHandInProgress(),
      chipUnit: this.config.chipUnit,
    };
  }

  getPlayerState(seatIndex: number): PokerPlayerState {
    const publicState = this.getPublicState();

    let holeCards: PokerCard[] = [];
    let legalActions: LegalAction[] = [];

    if (this.table.isHandInProgress()) {
      const allHoleCards = this.table.holeCards();
      const playerCards = allHoleCards?.[seatIndex];
      if (playerCards) {
        holeCards = playerCards.map((c: any) => this.mapCard(c));
      }

      if (
        this.table.isBettingRoundInProgress() &&
        this.table.playerToAct() === seatIndex
      ) {
        const legal = this.table.legalActions();
        legalActions = this.mapLegalActions(legal);
      }
    }

    return {
      ...publicState,
      holeCards,
      legalActions,
    };
  }

  private mapLegalActions(legal: any): LegalAction[] {
    const actions: LegalAction[] = [];
    if (legal.canFold) {
      actions.push({ action: "fold" });
    }
    if (legal.canCheck) {
      actions.push({ action: "check" });
    }
    if (legal.canCall) {
      actions.push({ action: "call" });
    }
    if (legal.canBet) {
      actions.push({
        action: "bet",
        minBet: legal.chipRange?.min,
        maxBet: legal.chipRange?.max,
      });
    }
    if (legal.canRaise) {
      actions.push({
        action: "raise",
        minBet: legal.chipRange?.min,
        maxBet: legal.chipRange?.max,
      });
    }
    return actions;
  }

  getPlayerCount(): number {
    return this.players.size;
  }

  getPlayerAddresses(): Map<number, string> {
    const addresses = new Map<number, string>();
    for (const [seat, player] of this.players) {
      addresses.set(seat, player.address);
    }
    return addresses;
  }

  getPlayerBySeat(seatIndex: number): SeatedPlayer | undefined {
    return this.players.get(seatIndex);
  }

  getChipCounts(): Map<number, number> {
    const chips = new Map<number, number>();
    const seats = this.table.seats();
    for (const [seatIndex] of this.players) {
      const seat = seats[seatIndex];
      chips.set(seatIndex, (seat as any)?.stack ?? 0);
    }
    return chips;
  }
}
