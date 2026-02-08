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
import * as Poker from "poker-ts";
import { GameRoom } from "../GameRoom.js";

/** Map poker-ts HandRanking enum to human-readable name */
function rankingToName(ranking: number | undefined): string | undefined {
  if (ranking == null) return undefined;
  const names: Record<number, string> = {
    0: "High Card",
    1: "Pair",
    2: "Two Pair",
    3: "Three of a Kind",
    4: "Straight",
    5: "Flush",
    6: "Full House",
    7: "Four of a Kind",
    8: "Straight Flush",
    9: "Royal Flush",
  };
  return names[ranking];
}

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
  private pendingLeaves: Set<number> = new Set();
  private pendingLeaveNextHand: Set<number> = new Set();
  private recentlyRemoved: number[] = [];
  private lastActions: Map<number, { action: string; amount?: number }> =
    new Map();
  private foldedSeats: Set<number> = new Set();
  private lastChipSnapshot: Map<number, number> | null = null;
  private lastPlayerSnapshot: Map<number, string> | null = null;
  private showdownCardsCache: Array<{
    seatIndex: number;
    cards: PokerCard[];
  }> | null = null;

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
    this.lastActions.clear();
    this.foldedSeats.clear();

    console.log(
      `[Poker] Hand #${this.handNumber} started — players: ${[...this.players.entries()].map(([s, p]) => `seat${s}=${p.address.slice(0, 8)}`).join(", ")}`,
    );
    console.log(
      `[Poker] Stacks: ${[...this.getChipCounts().entries()].map(([s, c]) => `seat${s}=${c}`).join(", ")}`,
    );
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

    // Get call amount before action is taken (for display purposes)
    let actionAmount = betSize;
    if (action === "call" && !actionAmount) {
      try {
        actionAmount = this.getCallAmount();
      } catch {
        /* ignore */
      }
    }

    // Track the action for display
    this.lastActions.set(seatIndex, {
      action,
      amount: actionAmount,
    });

    // Track folds explicitly for winner detection
    if (action === "fold") {
      this.foldedSeats.add(seatIndex);
    }

    console.log(
      `[Poker] Action: seat${seatIndex} → ${action}${betSize ? ` (${betSize})` : ""} | pot before: ${this.calculateTotalPot()}`,
    );

    this.table.actionTaken(action, betSize);

    console.log(
      `[Poker] After action — isHandInProgress=${this.table.isHandInProgress()}, isBettingRoundInProgress=${this.table.isHandInProgress() ? this.table.isBettingRoundInProgress() : "N/A"}, pot: ${this.calculateTotalPot()}`,
    );

    // poker-ts game loop: keep advancing until hand is over or waiting for player
    this.advanceGameState();
  }

  /** Advance through poker-ts states: endBettingRound → showdown as needed */
  private advanceGameState(): void {
    // Loop because endBettingRound may immediately complete (e.g., fold-win)
    while (this.table.isHandInProgress()) {
      if (this.table.isBettingRoundInProgress()) {
        // Waiting for a player action — stop advancing
        return;
      }

      // Capture fold-win info BEFORE showdown (winners() is empty for fold-wins)
      if (this.table.areBettingRoundsCompleted()) {
        console.log(
          `[Poker] Betting rounds completed — pot: ${this.calculateTotalPot()}, pots: ${JSON.stringify(this.safeGetPots())}`,
        );
        this.captureWinnerBeforeShowdown();
        this.captureHoleCardsForShowdown();
        this.table.showdown();
        // showdown sets isHandInProgress to false — loop will exit
      } else {
        console.log(
          `[Poker] Ending betting round — pot before: ${this.calculateTotalPot()}`,
        );
        this.table.endBettingRound();
        console.log(
          `[Poker] Betting round ended — pot after: ${this.calculateTotalPot()}`,
        );
      }
    }

    // Hand is over
    this.handleHandComplete();
  }

  /**
   * For fold-wins, winners() returns empty after showdown.
   * Capture the sole eligible player from pots before showdown.
   */
  private foldWinnerCache: { seatIndex: number; amount: number } | null = null;
  private potSizesCache: number[] | null = null;

  private captureWinnerBeforeShowdown(): void {
    this.foldWinnerCache = null;
    this.potSizesCache = null;
    try {
      const pots = this.table.pots();
      // Cache pot sizes before showdown (pots may change after showdown)
      this.potSizesCache = pots.map((p: any) => p.size || 0);
      const potTotal = pots.reduce(
        (sum: number, p: any) => sum + (p.size || 0),
        0,
      );
      const totalWithBets = this.calculateTotalPot();
      // Use the larger of pot sizes vs pot+bets (bets may not be gathered yet)
      const amount = Math.max(potTotal, totalWithBets);

      console.log(
        `[Poker] captureWinner: pots=${JSON.stringify(pots.map((p) => ({ size: p.size, eligible: p.eligiblePlayers })))}, potTotal=${potTotal}, totalWithBets=${totalWithBets}, amount=${amount}`,
      );

      if (pots.length >= 1 && pots[0].eligiblePlayers?.length === 1) {
        this.foldWinnerCache = {
          seatIndex: pots[0].eligiblePlayers[0],
          amount,
        };
        console.log(
          `[Poker] Fold-win cached: seat ${this.foldWinnerCache.seatIndex} wins ${amount}`,
        );
      } else {
        // Check if only one non-folded player (fold-win that pots didn't capture)
        const activePlayers: number[] = [];
        for (const [seatIdx] of this.players) {
          if (!this.foldedSeats.has(seatIdx)) {
            activePlayers.push(seatIdx);
          }
        }
        if (activePlayers.length === 1) {
          this.foldWinnerCache = { seatIndex: activePlayers[0], amount };
          console.log(
            `[Poker] Fold-win cached (active scan): seat ${activePlayers[0]} wins ${amount}`,
          );
        }
      }
    } catch (err) {
      console.error("[Poker] captureWinnerBeforeShowdown error:", err);
    }
  }

  private captureHoleCardsForShowdown(): void {
    this.showdownCardsCache = null;
    try {
      const allHoleCards = this.table.holeCards();
      if (!allHoleCards) return;
      const cards: Array<{ seatIndex: number; cards: PokerCard[] }> = [];
      for (const [seatIndex] of this.players) {
        const playerCards = allHoleCards[seatIndex];
        if (playerCards && !this.foldedSeats.has(seatIndex)) {
          cards.push({
            seatIndex,
            cards: playerCards.map((c: any) => this.mapCard(c)),
          });
        }
      }
      if (cards.length > 0) {
        this.showdownCardsCache = cards;
      }
    } catch (err) {
      console.error("[Poker] captureHoleCardsForShowdown error:", err);
    }
  }

  getHandNumber(): number {
    return this.handNumber;
  }

  getNextAvailableSeat(): number {
    for (let i = 0; i < this.config.maxPlayers; i++) {
      if (!this.players.has(i)) return i;
    }
    return -1;
  }

  private handleHandComplete(): void {
    // poker-ts winners() returns [SeatIndex, Hand, HoleCards][][]
    // Outer array = per-pot, inner array = winners for that pot (may be split)
    // Each winner is a tuple: [seatIndex, {ranking, strength, cards}, holeCards[]]
    let parsedWinners: Array<{
      seatIndex: number;
      amount: number;
      handName?: string;
      holeCards?: PokerCard[];
    }> = [];

    try {
      const rawWinners = this.table.winners();
      console.log(`[Poker] winners() raw: ${JSON.stringify(rawWinners)}`);

      if (rawWinners && rawWinners.length > 0) {
        const potSizes = this.potSizesCache ?? [];

        for (let potIdx = 0; potIdx < rawWinners.length; potIdx++) {
          const potWinners = rawWinners[potIdx];
          if (!potWinners || potWinners.length === 0) continue;

          const potSize = potSizes[potIdx] ?? 0;
          const share =
            potWinners.length > 0 ? Math.floor(potSize / potWinners.length) : 0;

          for (const tuple of potWinners) {
            const seatIndex = tuple[0] as number;
            const hand = tuple[1] as any;
            const holeCards = tuple[2] as any[];

            const existing = parsedWinners.find(
              (w) => w.seatIndex === seatIndex,
            );
            if (existing) {
              existing.amount += share;
            } else {
              parsedWinners.push({
                seatIndex,
                amount: share,
                handName: rankingToName(hand?.ranking),
                holeCards: holeCards?.map((c: any) => this.mapCard(c)),
              });
            }
          }
        }
      }
    } catch (err) {
      console.log(`[Poker] winners() threw: ${err}`);
    }

    this.potSizesCache = null;

    // For fold-wins, winners() returns empty — use cached info
    if (parsedWinners.length === 0 && this.foldWinnerCache) {
      parsedWinners = [
        {
          seatIndex: this.foldWinnerCache.seatIndex,
          amount: this.foldWinnerCache.amount,
        },
      ];
      this.foldWinnerCache = null;
      console.log(
        `[Poker] Using foldWinnerCache: ${JSON.stringify(parsedWinners)}`,
      );
    }

    // Fallback: find winner using our foldedSeats tracking
    if (parsedWinners.length === 0) {
      const totalPot = this.calculateTotalPot();
      for (const [seatIndex] of this.players) {
        if (!this.foldedSeats.has(seatIndex)) {
          parsedWinners = [{ seatIndex, amount: totalPot }];
          console.log(
            `[Poker] Fold-win fallback: seat ${seatIndex} wins ${totalPot}`,
          );
          break;
        }
      }
    }

    // Log final chip counts
    console.log(
      `[Poker] Hand #${this.handNumber} complete — stacks: ${[...this.getChipCounts().entries()].map(([s, c]) => `seat${s}=${c}`).join(", ")}`,
    );
    console.log(
      `[Poker] Winners: ${JSON.stringify(parsedWinners.map((w) => ({ seat: w.seatIndex, amount: w.amount, hand: w.handName })))}`,
    );

    const result: HandResult = {
      winners: parsedWinners.map((w) => {
        const player = this.players.get(w.seatIndex);
        return {
          seatIndex: w.seatIndex,
          amount: w.amount,
          hand: w.handName,
          address: player?.address,
          ensName: player?.ensName,
        };
      }),
      pots: this.mapPots(),
      handNumber: this.handNumber,
      chipUnit: this.config.chipUnit,
      showdownCards: this.showdownCardsCache ?? undefined,
    };
    this.showdownCardsCache = null;

    // Snapshot chip counts and player addresses BEFORE removing players
    // so that submitHandAllocations can use accurate data
    this.lastChipSnapshot = this.getChipCounts();
    this.lastPlayerSnapshot = new Map(
      [...this.players].map(([s, p]) => [s, p.address]),
    );

    const removedSeats = this.finalizePendingLeaves();
    if (removedSeats.length > 0) {
      this.recentlyRemoved = removedSeats;
    }

    this.onHandComplete?.(result);
  }

  /** Calculate total pot including ungathered bets (bets not yet in pot) */
  private calculateTotalPot(): number {
    let total = 0;
    try {
      total += this.table
        .pots()
        .reduce((sum: number, p: any) => sum + (p.size || 0), 0);
    } catch {
      /* no pots yet */
    }
    try {
      const seats = this.table.seats();
      for (let i = 0; i < seats.length; i++) {
        if (seats[i]) {
          total += (seats[i] as any).betSize ?? 0;
        }
      }
    } catch {
      /* ignore */
    }
    return total;
  }

  private safeGetPots(): any[] {
    try {
      return this.table
        .pots()
        .map((p: any) => ({ size: p.size, eligible: p.eligiblePlayers }));
    } catch {
      return [];
    }
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
        isAllIn:
          ((seat as any).stack ?? 0) === 0 && !((seat as any).folded ?? false),
        isDealer: this.table.isHandInProgress()
          ? this.table.button() === i
          : false,
        isTurn:
          this.table.isHandInProgress() && this.table.isBettingRoundInProgress()
            ? this.table.playerToAct() === i
            : false,
        lastAction: this.lastActions.get(i) as SeatState["lastAction"],
      });
    }

    let communityCards: PokerCard[] = [];
    let roundOfBetting: PokerGameState["roundOfBetting"] = "preflop";
    let currentPlayerSeat: number | null = null;
    let dealerSeat = 0;

    if (this.table.isHandInProgress()) {
      communityCards = this.table
        .communityCards()
        .map((c: any) => this.mapCard(c));
      roundOfBetting =
        this.table.roundOfBetting() as PokerGameState["roundOfBetting"];
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

  private getCallAmount(): number {
    const tableSeats = this.table.seats();
    let biggestBet = 0;
    let currentPlayerBet = 0;
    const actorIndex = this.table.playerToAct();

    for (let i = 0; i < this.config.maxPlayers; i++) {
      const seat = tableSeats[i];
      if (!seat) continue;
      const bet = (seat as any).betSize ?? 0;
      if (bet > biggestBet) biggestBet = bet;
      if (i === actorIndex) currentPlayerBet = bet;
    }

    return biggestBet - currentPlayerBet;
  }

  private mapLegalActions(legal: any): LegalAction[] {
    const actions: LegalAction[] = [];
    const actionList: string[] = legal.actions ?? [];
    for (const action of actionList) {
      if (action === "fold") {
        actions.push({ action: "fold" });
      } else if (action === "check") {
        actions.push({ action: "check" });
      } else if (action === "call") {
        actions.push({ action: "call", minBet: this.getCallAmount() });
      } else if (action === "bet") {
        actions.push({
          action: "bet",
          minBet: legal.chipRange?.min,
          maxBet: legal.chipRange?.max,
        });
      } else if (action === "raise") {
        actions.push({
          action: "raise",
          minBet: legal.chipRange?.min,
          maxBet: legal.chipRange?.max,
        });
      }
    }
    return actions;
  }

  getPlayerCount(): number {
    return this.players.size;
  }

  isHandInProgress(): boolean {
    return this.table.isHandInProgress();
  }

  requestLeave(seatIndex: number): boolean {
    if (!this.players.has(seatIndex)) return false;
    if (!this.table.isHandInProgress()) return false;

    this.pendingLeaves.add(seatIndex);

    if (
      this.table.isBettingRoundInProgress() &&
      this.table.playerToAct() === seatIndex
    ) {
      this.handleAction(seatIndex, "fold");
    }

    return true;
  }

  autoFoldPendingTurn(): boolean {
    if (!this.table.isHandInProgress()) return false;
    if (!this.table.isBettingRoundInProgress()) return false;

    const seatIndex = this.table.playerToAct();
    if (!this.pendingLeaves.has(seatIndex)) return false;

    this.handleAction(seatIndex, "fold");
    return true;
  }

  consumeRecentlyRemoved(): number[] {
    const removed = [...this.recentlyRemoved];
    this.recentlyRemoved = [];
    return removed;
  }

  private finalizePendingLeaves(): number[] {
    if (this.pendingLeaves.size === 0) return [];
    const removed: number[] = [];
    for (const seatIndex of this.pendingLeaves) {
      if (this.players.has(seatIndex)) {
        this.removePlayer(seatIndex);
        removed.push(seatIndex);
      }
    }
    this.pendingLeaves.clear();
    return removed;
  }

  getPlayerAddresses(): Map<number, string> {
    const addresses = new Map<number, string>();
    for (const [seat, player] of this.players) {
      addresses.set(seat, player.address);
    }
    return addresses;
  }

  getPlayerDetails(): Array<{
    address: string;
    ensName?: string;
    ensAvatar?: string;
    seatIndex: number;
  }> {
    return Array.from(this.players.values()).map((p) => ({
      address: p.address,
      ensName: p.ensName,
      ensAvatar: p.ensAvatar,
      seatIndex: p.seatIndex,
    }));
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

  getChipSnapshot(): Map<number, number> | null {
    return this.lastChipSnapshot;
  }

  getPlayerSnapshot(): Map<number, string> | null {
    return this.lastPlayerSnapshot;
  }

  clearSnapshots(): void {
    this.lastChipSnapshot = null;
    this.lastPlayerSnapshot = null;
  }

  requestLeaveNextHand(seatIndex: number): boolean {
    if (!this.players.has(seatIndex)) return false;
    this.pendingLeaveNextHand.add(seatIndex);
    return true;
  }

  isLeaveNextHandPending(seatIndex: number): boolean {
    return this.pendingLeaveNextHand.has(seatIndex);
  }

  cancelLeaveNextHand(seatIndex: number): void {
    this.pendingLeaveNextHand.delete(seatIndex);
  }

  processLeaveNextHand(): number[] {
    if (this.pendingLeaveNextHand.size === 0) return [];
    const removed: number[] = [];
    for (const seatIndex of this.pendingLeaveNextHand) {
      if (this.players.has(seatIndex)) {
        this.removePlayer(seatIndex);
        removed.push(seatIndex);
      }
    }
    this.pendingLeaveNextHand.clear();
    return removed;
  }
}
