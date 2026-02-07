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
        <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-black/40 border border-neon-yellow/40 backdrop-blur-sm shadow-lg">
          <ChipIcon />
          <div className="flex flex-col items-center leading-tight">
            <span className="font-bold text-neon-yellow font-mono text-base">
              {totalPot} chips
            </span>
            <span className="text-white/50 font-mono text-xs">
              {formatYusd(totalPot * chipUnit)} ytest.usd
            </span>
          </div>
        </div>
        {pots.length > 1 && (
          <div className="flex gap-2 mt-1">
            {pots.map((pot, i) => (
              <span
                key={`pot-${pot.amount}-${i}`}
                className="text-xs text-white/40 px-2 py-0.5 rounded bg-white/5"
              >
                {i === 0 ? "Main" : `Side ${i}`}: {pot.amount}
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
