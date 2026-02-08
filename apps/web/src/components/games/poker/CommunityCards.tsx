import type { PokerCard } from "@playfrens/shared";
import { AnimatePresence, motion } from "motion/react";
import { Card } from "./Card";

export function CommunityCards({ cards }: { cards: PokerCard[] }) {
  return (
    <div className="flex gap-1.5 justify-center">
      <AnimatePresence>
        {cards.map((card, i) => (
          <motion.div
            key={`${card.rank}-${card.suit}`}
            initial={{ opacity: 0, scale: 0.5, y: -40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
              type: "spring",
              damping: 14,
              stiffness: 180,
              delay: i * 0.12,
            }}
          >
            <Card card={card} delay={0} community />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Empty slots */}
      {Array.from({ length: 5 - cards.length }).map((_, i) => (
        <div
          key={`empty-${cards.length + i}`}
          className="w-14 h-20 rounded-lg border border-white/[0.07] bg-white/[0.03]"
        />
      ))}
    </div>
  );
}
