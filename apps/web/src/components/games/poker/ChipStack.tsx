import { motion } from "motion/react";
import { formatYusd } from "../../../lib/format";

export function ChipStack({ amount, chipUnit }: { amount: number; chipUnit: number }) {
  if (amount === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-1 px-2 py-1 rounded-full bg-neon-yellow/10 border border-neon-yellow/20"
    >
      <div className="w-3 h-3 rounded-full bg-gradient-to-br from-neon-yellow to-yellow-600 border border-yellow-500/50" />
      <span className="text-xs font-bold font-mono text-neon-yellow">
        {formatYusd(amount * chipUnit)} ytest.usd
      </span>
    </motion.div>
  );
}
