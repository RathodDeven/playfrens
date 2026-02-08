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
  heroSeatIndex,
  onClose,
}: {
  entries: HandHistoryEntry[];
  chipUnit: number;
  heroSeatIndex: number;
  onClose: () => void;
}) {
  if (entries.length === 0) return null;

  return (
    <div className="w-64 max-h-[60vh] overflow-y-auto bg-black/80 backdrop-blur-md rounded-xl p-3 space-y-2 border border-white/10 shadow-xl">
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
        const unit = entry.chipUnit || chipUnit;
        const heroDelta = entry.heroDelta ?? 0;
        const isHeroWin = heroDelta > 0;
        const isHeroLoss = heroDelta < 0;
        return (
          <div
            key={entry.handNumber}
            className="p-2.5 rounded-lg bg-white/5 space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-white/40">
                Hand #{entry.handNumber}
              </p>
            </div>

            {/* Hero's result */}
            {heroDelta !== 0 && (
              <div
                className={`flex items-center justify-between px-2 py-1 rounded-md ${
                  isHeroWin
                    ? "bg-neon-green/10 border border-neon-green/20"
                    : "bg-red-500/10 border border-red-500/20"
                }`}
              >
                <span
                  className={`text-[11px] font-bold ${isHeroWin ? "text-neon-green" : "text-red-400"}`}
                >
                  {isHeroWin ? "You won" : "You lost"}
                </span>
                <div className="flex items-center gap-1">
                  <span
                    className={`text-[11px] font-mono font-bold flex items-center gap-0.5 ${isHeroWin ? "text-neon-green" : "text-red-400"}`}
                  >
                    <ChipIcon size={9} />
                    {isHeroWin ? "+" : ""}
                    {heroDelta}
                  </span>
                  <span className="text-[9px] text-white/35 font-mono">
                    ({isHeroLoss ? "-" : "+"}
                    {formatYusd(Math.abs(heroDelta) * unit)} ytest.usd)
                  </span>
                </div>
              </div>
            )}

            {/* Winners */}
            {entry.winners.map((w, idx) => {
              const isHero = w.seatIndex === heroSeatIndex;
              const name = isHero
                ? "You"
                : w.ensName ||
                  (w.address
                    ? `${w.address.slice(0, 6)}...${w.address.slice(-4)}`
                    : `Player ${(w.seatIndex ?? idx) + 1}`);
              return (
                <div key={w.seatIndex ?? idx} className="text-[11px]">
                  <span className="text-neon-green font-semibold">{name}</span>{" "}
                  <span className="text-white/35 text-[10px]">won pot</span>{" "}
                  <span className="inline-flex items-center gap-0.5 text-neon-yellow font-mono">
                    <ChipIcon size={9} />
                    {w.amount}
                  </span>
                  <span className="text-white/35 font-mono ml-1 text-[10px]">
                    ({formatYusd(w.amount * unit)} ytest.usd)
                  </span>
                  {w.hand && (
                    <span className="text-white/45 ml-1 text-[10px]">
                      {w.hand}
                    </span>
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
