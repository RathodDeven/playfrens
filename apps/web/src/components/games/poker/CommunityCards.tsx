import { AnimatePresence, motion } from "motion/react";
import type { PokerCard } from "@playfrens/shared";
import { Card } from "./Card";

export function CommunityCards({ cards }: { cards: PokerCard[] }) {
  return (
    <div className="flex gap-2 justify-center">
      <AnimatePresence>
        {cards.map((card, i) => (
          <motion.div
            key={`${card.rank}-${card.suit}`}
            initial={{ opacity: 0, scale: 0.5, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
              type: "spring",
              damping: 12,
              delay: i * 0.1,
            }}
          >
            <Card card={card} delay={0} />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Empty slots */}
      {Array.from({ length: 5 - cards.length }).map((_, i) => (
        <div
          key={`empty-${cards.length + i}`}
          className="w-14 h-20 rounded-lg border border-white/10 bg-white/5"
        />
      ))}
    </div>
  );
}
