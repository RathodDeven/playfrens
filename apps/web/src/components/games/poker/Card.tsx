import { motion } from "motion/react";
import type { PokerCard } from "@playfrens/shared";

const suitSymbols: Record<string, string> = {
  spades: "\u2660",
  hearts: "\u2665",
  diamonds: "\u2666",
  clubs: "\u2663",
};

const suitColors: Record<string, string> = {
  spades: "text-white",
  hearts: "text-red-500",
  diamonds: "text-red-500",
  clubs: "text-white",
};

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
      initial={{ opacity: 0, y: -30, rotateY: 180 }}
      animate={{ opacity: 1, y: 0, rotateY: isFaceDown ? 180 : 0 }}
      transition={{
        type: "spring",
        damping: 15,
        delay,
      }}
      className="relative w-14 h-20 perspective-[600px]"
    >
      <div
        className={`w-full h-full rounded-lg shadow-lg ${
          isFaceDown
            ? "card-back border border-purple-500/30"
            : "bg-white border border-gray-200"
        } flex flex-col items-center justify-center`}
      >
        {!isFaceDown && card && (
          <>
            <span
              className={`text-lg font-bold leading-none ${suitColors[card.suit]}`}
            >
              {card.rank}
            </span>
            <span className={`text-lg leading-none ${suitColors[card.suit]}`}>
              {suitSymbols[card.suit]}
            </span>
          </>
        )}
        {isFaceDown && (
          <div className="text-purple-300/50 text-xs font-bold">PF</div>
        )}
      </div>
    </motion.div>
  );
}
