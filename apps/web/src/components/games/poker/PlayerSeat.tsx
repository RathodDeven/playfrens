import type { PokerCard, SeatState } from "@playfrens/shared";
import { motion } from "motion/react";
import { formatYusd } from "../../../lib/format";
import { Card } from "./Card";
import { ChipStack } from "./ChipStack";

const actionBadgeStyle: Record<string, string> = {
  fold: "text-white bg-red-500/90 shadow-red-500/40",
  check: "text-white bg-blue-500/90 shadow-blue-500/40",
  call: "text-white bg-green-500/90 shadow-green-500/40",
  bet: "text-black bg-neon-yellow/90 shadow-neon-yellow/40",
  raise: "text-white bg-neon-pink/90 shadow-neon-pink/40",
};

function formatAction(action: string, amount?: number): string {
  const label = action.charAt(0).toUpperCase() + action.slice(1);
  if (amount && (action === "bet" || action === "raise" || action === "call")) {
    return `${label} ${amount}`;
  }
  return label;
}

export function PlayerSeat({
  seat,
  isHero,
  holeCards,
  chipUnit,
  isHandInProgress,
}: {
  seat: SeatState;
  isHero: boolean;
  holeCards?: PokerCard[];
  chipUnit: number;
  isHandInProgress: boolean;
}) {
  const displayName =
    seat.ensName || `${seat.address.slice(0, 6)}...${seat.address.slice(-4)}`;

  const showCards = isHandInProgress && !seat.isFolded;
  const heroHasCards = isHero && holeCards && holeCards.length > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: "spring", damping: 15 }}
      className="flex flex-col items-center gap-1.5"
    >
      {/* Hole Cards */}
      <div className="flex gap-0.5">
        {showCards && heroHasCards
          ? (holeCards ?? []).map((card, i) => (
              <Card
                key={`${card.rank}-${card.suit}`}
                card={card}
                delay={i * 0.15}
                size="normal"
              />
            ))
          : showCards
            ? [0, 1].map((i) => (
                <Card
                  key={`hidden-${i}`}
                  faceDown
                  delay={i * 0.15}
                  size={isHero ? "normal" : "small"}
                />
              ))
            : null}
      </div>

      {/* Bet */}
      {seat.betAmount > 0 && (
        <ChipStack amount={seat.betAmount} chipUnit={chipUnit} />
      )}

      {/* Player Info Panel */}
      <motion.div
        className={`rounded-xl px-3 py-2 text-center min-w-[110px] relative transition-all ${
          seat.isTurn
            ? "bg-black/70 backdrop-blur-md border-2 border-neon-blue shadow-[0_0_20px_rgba(0,240,255,0.3)]"
            : seat.isFolded
              ? "bg-black/40 backdrop-blur-sm border border-white/5 opacity-40 grayscale"
              : "bg-black/60 backdrop-blur-md border border-white/10"
        } ${isHero && !seat.isFolded ? "border-neon-green/40" : ""}`}
      >
        {/* Avatar */}
        <div className="flex items-center justify-center mb-0.5">
          {seat.ensAvatar ? (
            <img
              src={seat.ensAvatar}
              alt={displayName}
              className="w-7 h-7 rounded-full border border-white/20"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-neon-purple to-neon-pink flex items-center justify-center text-[10px] font-bold border border-white/10">
              {displayName.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        {/* Name */}
        <p className="text-xs font-semibold text-white truncate max-w-[100px]">
          {displayName}
        </p>

        {/* Chips */}
        <div className="flex items-center justify-center gap-1 text-[11px] font-mono text-neon-green leading-tight">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="shrink-0"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="2"
              fill="currentColor"
              fillOpacity="0.2"
            />
            <circle
              cx="12"
              cy="12"
              r="6"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
            />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
          </svg>
          <span>{seat.chipCount}</span>
          {seat.isAllIn && (
            <span className="text-red-400 font-bold text-[10px]">ALL IN</span>
          )}
        </div>
        <p className="text-[9px] font-mono text-white/35 leading-tight">
          {formatYusd(seat.chipCount * chipUnit)} ytest.usd
        </p>

        {/* Last action badge */}
        {seat.lastAction && isHandInProgress && (
          <motion.div
            key={`${seat.lastAction.action}-${seat.lastAction.amount}`}
            initial={{ opacity: 0, scale: 0.5, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className={`absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold rounded-full px-2 py-0.5 whitespace-nowrap shadow-lg ${
              actionBadgeStyle[seat.lastAction.action] ||
              "text-white bg-white/20"
            }`}
          >
            {formatAction(seat.lastAction.action, seat.lastAction.amount)}
          </motion.div>
        )}

        {/* Dealer button */}
        {seat.isDealer && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-400 text-black text-[10px] font-black flex items-center justify-center shadow-lg border border-amber-500"
          >
            D
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
