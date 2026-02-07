import type { LegalAction, PokerAction } from "@playfrens/shared";
import { motion } from "motion/react";
import { useState } from "react";
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3"
    >
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
              className={`px-5 py-2.5 rounded-xl font-bold text-sm ${style.bg} ${style.text} transition-colors`}
            >
              {style.label}
              {la.action === "call" && la.minBet
                ? ` ${la.minBet}`
                : ""}
            </motion.button>
          );
        })}
      </div>

      {/* Bet slider — compact inline */}
      {betAction && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass">
          <input
            type="range"
            min={betAction.minBet || 0}
            max={betAction.maxBet || 1000}
            value={betSize || betAction.minBet || 0}
            onChange={(e) => setBetSize(Number(e.target.value))}
            className="w-28 accent-neon-green"
          />
          <input
            type="number"
            value={betSize || betAction.minBet || 0}
            onChange={(e) => setBetSize(Number(e.target.value))}
            className="w-16 px-2 py-1 rounded-lg bg-surface-light border border-white/10 text-white text-center text-xs font-mono"
          />
          <span className="text-[10px] text-white/30 whitespace-nowrap">
            {formatYusd((betSize || betAction.minBet || 0) * chipUnit)}
          </span>
        </div>
      )}
    </motion.div>
  );
}
