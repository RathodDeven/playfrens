import { motion } from "motion/react";
import { formatYusd } from "../../../lib/format";

export function ChipStack({
  amount,
  chipUnit,
}: { amount: number; chipUnit: number }) {
  if (amount === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-1 px-2 py-1 rounded-full bg-neon-yellow/10 border border-neon-yellow/20"
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="text-neon-yellow shrink-0"
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
      <span className="text-xs font-bold font-mono text-neon-yellow">
        {amount}
      </span>
      {chipUnit !== 1 && (
        <span className="text-[10px] font-mono text-neon-yellow/60">
          {formatYusd(amount * chipUnit)}
        </span>
      )}
    </motion.div>
  );
}
