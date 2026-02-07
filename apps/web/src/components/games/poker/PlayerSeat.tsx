import type { PokerCard, SeatState } from "@playfrens/shared";
import { motion } from "motion/react";
import { formatYusd } from "../../../lib/format";
import { Card } from "./Card";
import { ChipStack } from "./ChipStack";

export function PlayerSeat({
  seat,
  isHero,
  holeCards,
  chipUnit,
}: {
  seat: SeatState;
  isHero: boolean;
  holeCards?: PokerCard[];
  chipUnit: number;
}) {
  const displayName =
    seat.ensName || `${seat.address.slice(0, 6)}...${seat.address.slice(-4)}`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: "spring", damping: 15 }}
      className={`flex flex-col items-center gap-2 ${
        seat.isTurn ? "pulse-glow" : ""
      }`}
    >
      {/* Hole Cards */}
      <div className="flex gap-1">
        {isHero && holeCards
          ? holeCards.map((card, i) => (
              <Card
                key={`${card.rank}-${card.suit}`}
                card={card}
                delay={i * 0.15}
              />
            ))
          : seat.isFolded
            ? null
            : [0, 1].map((i) => (
                <Card key={`hidden-${i}`} faceDown delay={i * 0.15} />
              ))}
      </div>

      {/* Bet */}
      {seat.betAmount > 0 && (
        <ChipStack amount={seat.betAmount} chipUnit={chipUnit} />
      )}

      {/* Player Info */}
      <motion.div
        className={`glass rounded-xl px-4 py-2.5 text-center min-w-[120px] ${
          seat.isTurn
            ? "border-neon-blue border-2"
            : seat.isFolded
              ? "opacity-40"
              : "border border-white/10"
        } ${isHero ? "border-neon-green/50" : ""}`}
      >
        {/* Avatar */}
        <div className="flex items-center justify-center mb-1">
          {seat.ensAvatar ? (
            <img
              src={seat.ensAvatar}
              alt={displayName}
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-purple to-neon-pink flex items-center justify-center text-xs font-bold">
              {displayName.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        {/* Name */}
        <p className="text-sm font-semibold text-white truncate max-w-[100px]">
          {displayName}
        </p>

        {/* Chips — dual display */}
        <p className="text-xs font-mono text-neon-green">
          {seat.chipCount} chips
          {seat.isAllIn && (
            <span className="ml-1 text-red-400 font-bold">ALL IN</span>
          )}
        </p>
        <p className="text-[10px] font-mono text-white/40">
          {formatYusd(seat.chipCount * chipUnit)} ytest.usd
        </p>

        {/* Dealer button */}
        {seat.isDealer && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white text-black text-[10px] font-black flex items-center justify-center shadow-lg"
          >
            D
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
