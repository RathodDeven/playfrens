import type { PokerCard } from "@playfrens/shared";
import { motion } from "motion/react";

const suitSymbols: Record<string, string> = {
  spades: "\u2660",
  hearts: "\u2665",
  diamonds: "\u2666",
  clubs: "\u2663",
};

const suitColors: Record<string, string> = {
  spades: "text-gray-900",
  hearts: "text-red-600",
  diamonds: "text-red-600",
  clubs: "text-gray-900",
};

function displayRank(rank: string): string {
  if (rank === "T") return "10";
  return rank;
}

const sizeClasses = {
  small: "w-10 h-14",
  normal: "w-14 h-20",
};

const rankSizes = {
  small: "text-base",
  normal: "text-2xl",
};

const suitSizes = {
  small: "text-sm",
  normal: "text-xl",
};

export function Card({
  card,
  faceDown = false,
  delay = 0,
  size = "normal",
  community = false,
}: {
  card?: PokerCard;
  faceDown?: boolean;
  delay?: number;
  size?: "small" | "normal";
  community?: boolean;
}) {
  const isFaceDown = faceDown || !card;

  // Community cards: fly from deck position with flip
  // Hole cards: scale up with spring bounce
  const initial = community
    ? { opacity: 0, y: -80, scale: 0.4, rotateY: 180 }
    : { opacity: 0, scale: 0.3 };

  const animate = community
    ? { opacity: 1, y: 0, scale: 1, rotateY: 0 }
    : { opacity: 1, scale: 1 };

  return (
    <motion.div
      initial={initial}
      animate={animate}
      transition={{
        type: "spring",
        damping: community ? 18 : 15,
        stiffness: community ? 200 : 300,
        delay,
      }}
      className={sizeClasses[size]}
      style={{ perspective: "600px" }}
    >
      {isFaceDown ? (
        <div className="w-full h-full rounded-lg shadow-lg card-back border border-purple-500/30 flex items-center justify-center">
          <div className="text-purple-300/50 text-xs font-bold">PF</div>
        </div>
      ) : (
        <div className="w-full h-full rounded-lg shadow-lg bg-white border border-gray-200 flex flex-col items-center justify-center gap-0">
          {card && (
            <div
              className={`flex flex-col items-center leading-none ${suitColors[card.suit] ?? "text-gray-900"}`}
            >
              <span className={`${rankSizes[size]} font-black leading-none`}>
                {displayRank(card.rank)}
              </span>
              <span className={`${suitSizes[size]} leading-none -mt-0.5`}>
                {suitSymbols[card.suit] ?? "?"}
              </span>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
