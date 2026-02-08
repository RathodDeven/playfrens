import type { LegalAction, PokerAction } from "@playfrens/shared";
import { motion } from "motion/react";
import { useState } from "react";
import { formatYusd } from "../../../lib/format";
import { soundManager } from "../../../lib/sounds";

const actionStyles: Record<
  PokerAction,
  { bg: string; text: string; label: string }
> = {
  fold: {
    bg: "bg-red-500/20 hover:bg-red-500/40 active:bg-red-500/50",
    text: "text-red-400",
    label: "Fold",
  },
  check: {
    bg: "bg-blue-500/20 hover:bg-blue-500/40 active:bg-blue-500/50",
    text: "text-blue-400",
    label: "Check",
  },
  call: {
    bg: "bg-green-500/20 hover:bg-green-500/40 active:bg-green-500/50",
    text: "text-green-400",
    label: "Call",
  },
  bet: {
    bg: "bg-neon-yellow/20 hover:bg-neon-yellow/40 active:bg-neon-yellow/50",
    text: "text-neon-yellow",
    label: "Bet",
  },
  raise: {
    bg: "bg-neon-pink/20 hover:bg-neon-pink/40 active:bg-neon-pink/50",
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

  const handleAction = (action: PokerAction, la: LegalAction) => {
    soundManager.play(action as any);
    if (action === "bet" || action === "raise") {
      onAction(action, betSize || la.minBet);
    } else {
      onAction(action);
    }
  };

  // Preset bet amounts
  const presets =
    betAction?.minBet != null && betAction?.maxBet != null
      ? [
          {
            label: "Min",
            value: betAction.minBet,
          },
          {
            label: "1/2",
            value: Math.min(
              Math.max(
                Math.floor((betAction.maxBet + betAction.minBet) / 4),
                betAction.minBet,
              ),
              betAction.maxBet,
            ),
          },
          {
            label: "Pot",
            value: Math.min(
              Math.max(
                Math.floor((betAction.maxBet + betAction.minBet) / 2),
                betAction.minBet,
              ),
              betAction.maxBet,
            ),
          },
          {
            label: "All In",
            value: betAction.maxBet,
          },
        ]
      : [];

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
              whileHover={{ scale: 1.05, y: -1 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", damping: 15 }}
              onClick={() => handleAction(la.action, la)}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm ${style.bg} ${style.text} transition-colors border border-white/5`}
            >
              {style.label}
              {la.action === "call" && la.minBet ? ` ${la.minBet}` : ""}
            </motion.button>
          );
        })}
      </div>

      {/* Bet slider + presets */}
      {betAction && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 backdrop-blur border border-white/5">
          {/* Presets */}
          <div className="flex gap-1">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setBetSize(p.value)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                  betSize === p.value
                    ? "bg-white/20 text-white"
                    : "bg-white/5 text-white/40 hover:text-white/60"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <input
            type="range"
            min={betAction.minBet || 0}
            max={betAction.maxBet || 1000}
            value={betSize || betAction.minBet || 0}
            onChange={(e) => setBetSize(Number(e.target.value))}
            className="w-24 accent-neon-green"
          />
          <input
            type="number"
            value={betSize || betAction.minBet || 0}
            onChange={(e) => setBetSize(Number(e.target.value))}
            className="w-14 px-1.5 py-0.5 rounded-lg bg-surface-light border border-white/10 text-white text-center text-xs font-mono"
          />
          <span className="text-[9px] text-white/30 whitespace-nowrap">
            {formatYusd((betSize || betAction.minBet || 0) * chipUnit)}
          </span>
        </div>
      )}
    </motion.div>
  );
}
