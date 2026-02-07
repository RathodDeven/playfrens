import type { PokerCard } from "@playfrens/shared";
import { motion } from "motion/react";

const suitSymbols: Record<string, string> = {
  spades: "\u2660",
  hearts: "\u2665",
  diamonds: "\u2666",
  clubs: "\u2663",
};

const suitColors: Record<string, string> = {
  spades: "text-gray-800",
  hearts: "text-red-500",
  diamonds: "text-red-500",
  clubs: "text-gray-800",
};

// Map rank for display (T -> 10)
function displayRank(rank: string): string {
  if (rank === "T") return "10";
  return rank;
}

export function Card({
  card,
  faceDown = false,
  delay = 0,
}: {
  card?: PokerCard;
  faceDown?: boolean;
  delay?: number;
}) {
  const isFaceDown = faceDown || !card;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: "spring",
        damping: 15,
        delay,
      }}
      className="w-14 h-20"
    >
      {isFaceDown ? (
        <div className="w-full h-full rounded-lg shadow-lg card-back border border-purple-500/30 flex items-center justify-center">
          <div className="text-purple-300/50 text-xs font-bold">PF</div>
        </div>
      ) : (
        <div className="w-full h-full rounded-lg shadow-lg bg-white border border-gray-200 flex flex-col items-center justify-center relative">
          {card && (
            <>
              {/* Top-left rank + suit */}
              <span
                className={`absolute top-1 left-1.5 text-[10px] font-bold leading-none ${suitColors[card.suit] ?? "text-gray-800"}`}
              >
                {displayRank(card.rank)}
                {suitSymbols[card.suit] ?? "?"}
              </span>
              {/* Center */}
              <span
                className={`text-2xl leading-none ${suitColors[card.suit] ?? "text-gray-800"}`}
              >
                {suitSymbols[card.suit] ?? "?"}
              </span>
              <span
                className={`text-sm font-bold leading-none ${suitColors[card.suit] ?? "text-gray-800"}`}
              >
                {displayRank(card.rank)}
              </span>
            </>
          )}
        </div>
      )}
    </motion.div>
  );
}
