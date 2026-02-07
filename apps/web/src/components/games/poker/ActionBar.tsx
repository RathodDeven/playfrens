import { useState } from "react";
import { motion } from "motion/react";
import type { LegalAction, PokerAction } from "@playfrens/shared";
import { formatYusd } from "../../../lib/format";

const actionStyles: Record<
  PokerAction,
  { bg: string; text: string; label: string }
> = {
  fold: {
    bg: "bg-red-500/20 hover:bg-red-500/30",
    text: "text-red-400",
    label: "Fold",
  },
  check: {
    bg: "bg-blue-500/20 hover:bg-blue-500/30",
    text: "text-blue-400",
    label: "Check",
  },
  call: {
    bg: "bg-green-500/20 hover:bg-green-500/30",
    text: "text-green-400",
    label: "Call",
  },
  bet: {
    bg: "bg-neon-yellow/20 hover:bg-neon-yellow/30",
    text: "text-neon-yellow",
    label: "Bet",
  },
  raise: {
    bg: "bg-neon-pink/20 hover:bg-neon-pink/30",
    text: "text-neon-pink",
    label: "Raise",
  },
};

export function ActionBar({
  legalActions,
  onAction,
  chipUnit,
}: {
  legalActions: LegalAction[];
  onAction: (action: PokerAction, betSize?: number) => void;
  chipUnit: number;
}) {
  const [betSize, setBetSize] = useState<number>(0);

  const betAction = legalActions.find(
    (a) => a.action === "bet" || a.action === "raise",
  );

  if (legalActions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-3"
    >
      {/* Bet slider */}
      {betAction && (
        <div className="flex items-center gap-3 px-4 py-2 rounded-xl glass">
          <span className="text-sm text-white/50 font-mono">
            {formatYusd((betAction.minBet || 0) * chipUnit)}
          </span>
          <input
            type="range"
            min={betAction.minBet || 0}
            max={betAction.maxBet || 1000}
            value={betSize || betAction.minBet || 0}
            onChange={(e) => setBetSize(Number(e.target.value))}
            className="w-40 accent-neon-green"
          />
          <span className="text-sm text-white/50 font-mono">
            {formatYusd((betAction.maxBet || 0) * chipUnit)}
          </span>
          <input
            type="number"
            value={betSize || betAction.minBet || 0}
            onChange={(e) => setBetSize(Number(e.target.value))}
            className="w-20 px-2 py-1 rounded-lg bg-surface-light border border-white/10 text-white text-center text-sm font-mono"
          />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {legalActions.map((la) => {
          const style = actionStyles[la.action];
          return (
            <motion.button
              key={la.action}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", damping: 15 }}
              onClick={() => {
                if (la.action === "bet" || la.action === "raise") {
                  onAction(la.action, betSize || la.minBet);
                } else {
                  onAction(la.action);
                }
              }}
              className={`px-6 py-3 rounded-xl font-bold ${style.bg} ${style.text} transition-colors`}
            >
              {style.label}
              {la.action === "call" && la.minBet
                ? ` ${formatYusd(la.minBet * chipUnit)}`
                : ""}
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
