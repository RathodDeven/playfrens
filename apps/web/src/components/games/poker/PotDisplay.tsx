import type { PotInfo } from "@playfrens/shared";
import { AnimatePresence, motion } from "motion/react";
import { formatYusd } from "../../../lib/format";

export function PotDisplay({
  pots,
  chipUnit,
}: {
  pots: PotInfo[];
  chipUnit: number;
}) {
  const totalPot = pots.reduce((sum, p) => sum + p.amount, 0);

  if (totalPot === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-1"
      >
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-neon-yellow/20 border border-neon-yellow/30">
          <ChipIcon />
          <span className="font-bold text-neon-yellow font-mono">
            {formatYusd(totalPot * chipUnit)} ytest.usd
          </span>
        </div>
        {pots.length > 1 && (
          <div className="flex gap-2">
            {pots.map((pot, i) => (
              <span
                key={`pot-${pot.amount}-${i}`}
                className="text-xs text-white/40"
              >
                {i === 0 ? "Main" : `Side ${i}`}:{" "}
                {formatYusd(pot.amount * chipUnit)} ytest.usd
              </span>
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function ChipIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className="text-neon-yellow"
    >
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="2" />
      <circle cx="8" cy="8" r="4" fill="currentColor" opacity="0.3" />
    </svg>
  );
}
