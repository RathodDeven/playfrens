import type { HandHistoryEntry } from "../../../hooks/useGameState";
import { formatYusd } from "../../../lib/format";

function ChipIcon({ size = 10 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
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
  );
}

export function HandHistory({
  entries,
  chipUnit,
  onClose,
}: {
  entries: HandHistoryEntry[];
  chipUnit: number;
  onClose: () => void;
}) {
  if (entries.length === 0) return null;

  return (
    <div className="w-60 max-h-[60vh] overflow-y-auto bg-black/80 backdrop-blur-md rounded-xl p-3 space-y-2 border border-white/10 shadow-xl">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-white/60">Hand History</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-white/40 hover:text-white/70 text-xs px-1.5"
        >
          Close
        </button>
      </div>
      {entries.map((entry) => {
        const entryPot = entry.pots?.reduce((s, p) => s + p.amount, 0) ?? 0;
        const unit = entry.chipUnit || chipUnit;
        return (
          <div
            key={entry.handNumber}
            className="p-2.5 rounded-lg bg-white/5 space-y-1"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-white/40">
                Hand #{entry.handNumber}
              </p>
              {entryPot > 0 && (
                <div className="flex items-center gap-1 text-[10px] font-mono text-amber-400/70">
                  <ChipIcon size={9} />
                  <span>
                    {entryPot} ({formatYusd(entryPot * unit)})
                  </span>
                </div>
              )}
            </div>
            {entry.winners.map((w) => {
              const name =
                w.ensName ||
                (w.address
                  ? `${w.address.slice(0, 6)}...${w.address.slice(-4)}`
                  : `Seat ${w.seatIndex}`);
              return (
                <div key={w.seatIndex} className="text-[11px]">
                  <span className="text-neon-green font-semibold">{name}</span>{" "}
                  <span className="inline-flex items-center gap-0.5 text-neon-yellow font-mono">
                    <ChipIcon size={9} />+{w.amount}
                  </span>
                  <span className="text-white/35 font-mono ml-1">
                    ({formatYusd(w.amount * unit)} ytest.usd)
                  </span>
                  {w.hand && (
                    <span className="text-white/35 ml-1">{w.hand}</span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
