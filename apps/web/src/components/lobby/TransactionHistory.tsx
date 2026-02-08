import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { formatYusd } from "../../lib/format";
import type { TransactionEntry } from "../../lib/transactions";

const typeLabels: Record<string, { label: string; color: string }> = {
  hand_win: { label: "Win", color: "text-neon-green" },
  hand_loss: { label: "Loss", color: "text-red-400" },
  deposit: { label: "Deposit", color: "text-neon-blue" },
  withdraw: { label: "Withdraw", color: "text-amber-400" },
  faucet: { label: "Faucet", color: "text-neon-purple" },
  buy_in: { label: "Buy-in", color: "text-orange-400" },
  cash_out: { label: "Cash Out", color: "text-cyan-400" },
};

export function TransactionHistory({
  entries,
  onClear,
}: {
  entries: TransactionEntry[];
  onClear: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (entries.length === 0) return null;

  return (
    <div className="glass rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm font-bold text-white/60 hover:text-white/80 transition-colors"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`transition-transform ${expanded ? "rotate-90" : ""}`}
            aria-hidden="true"
          >
            <path d="M4 2l4 4-4 4" />
          </svg>
          Transaction History ({entries.length})
        </button>
        {expanded && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-white/30 hover:text-white/50 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="max-h-64 overflow-y-auto space-y-1.5">
              {entries.map((entry) => {
                const info = typeLabels[entry.type] ?? {
                  label: entry.type,
                  color: "text-white/50",
                };
                const isPositive =
                  entry.type === "hand_win" ||
                  entry.type === "deposit" ||
                  entry.type === "faucet" ||
                  entry.type === "cash_out";
                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-white/5"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold ${isPositive ? "text-neon-green" : "text-red-400"}`}
                      >
                        {isPositive ? "+" : "-"}
                      </span>
                      <div>
                        <span className={`text-xs font-semibold ${info.color}`}>
                          {info.label}
                        </span>
                        {entry.details && (
                          <span className="text-[10px] text-white/30 ml-1">
                            {entry.details}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-xs font-mono font-bold ${isPositive ? "text-neon-green" : "text-red-400"}`}
                      >
                        {isPositive ? "+" : "-"}
                        {formatYusd(Math.abs(entry.amount))}{" "}
                        <span className="text-white/30 font-normal">
                          ytest.usd
                        </span>
                      </p>
                      <p className="text-[9px] text-white/25">
                        {new Date(entry.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
