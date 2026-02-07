import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { formatYusd } from "../../../lib/format";
import type { HandHistoryEntry } from "../../../hooks/useGameState";

export function HandHistory({
  entries,
  chipUnit,
}: {
  entries: HandHistoryEntry[];
  chipUnit: number;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (entries.length === 0) return null;

  return (
    <div className="absolute right-0 top-0 bottom-0 flex items-start pt-4">
      {/* Toggle button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-2 rounded-l-xl glass text-xs font-bold text-white/60 hover:text-white/80 transition-colors"
      >
        History ({entries.length})
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="w-64 max-h-[70vh] overflow-y-auto glass rounded-l-xl p-4 space-y-3"
          >
            <h3 className="text-sm font-bold text-white/70">Hand History</h3>
            {entries.map((entry) => (
              <div
                key={entry.handNumber}
                className="p-3 rounded-lg bg-white/5 space-y-1"
              >
                <p className="text-xs font-bold text-white/50">
                  Hand #{entry.handNumber}
                </p>
                {entry.winners.map((w) => (
                  <div key={w.seatIndex} className="text-xs">
                    <span className="text-neon-green font-semibold">
                      Seat {w.seatIndex}
                    </span>{" "}
                    won{" "}
                    <span className="text-neon-yellow font-mono">
                      {w.amount} chips ({formatYusd(w.amount * (entry.chipUnit || chipUnit))})
                    </span>
                    {w.hand && (
                      <span className="text-white/40"> — {w.hand}</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
