import type { SeatState } from "@playfrens/shared";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { formatYusd } from "../../../lib/format";

export function PlayerModal({
  seat,
  chipUnit,
  isOpen,
  onClose,
}: {
  seat: SeatState | null;
  chipUnit: number;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!seat) return null;

  const displayName =
    seat.ensName || `${seat.address.slice(0, 6)}...${seat.address.slice(-4)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(seat.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25 }}
            className="glass rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Avatar */}
            <div className="flex justify-center">
              {seat.ensAvatar ? (
                <img
                  src={seat.ensAvatar}
                  alt={displayName}
                  className="w-20 h-20 rounded-full border-2 border-white/20"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-neon-purple to-neon-pink flex items-center justify-center text-2xl font-bold border-2 border-white/10">
                  {displayName.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            {/* ENS name */}
            {seat.ensName && (
              <p className="text-xl font-bold text-white">{seat.ensName}</p>
            )}

            {/* Address with copy */}
            <div className="flex items-center justify-center gap-2">
              <p className="text-xs font-mono text-white/50 break-all">
                {seat.address}
              </p>
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 px-2 py-1 rounded-md bg-white/10 text-white/50 text-xs hover:bg-white/20 hover:text-white/70 transition-colors"
                aria-label="Copy address"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>

            {/* Chips */}
            <div className="px-4 py-3 rounded-xl bg-surface-light space-y-1">
              <div className="flex items-center justify-center gap-2 text-neon-green font-mono text-lg font-bold">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
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
                <span>{seat.chipCount} chips</span>
              </div>
              <p className="text-sm font-mono text-white/40">
                {formatYusd(seat.chipCount * chipUnit)} ytest.usd
              </p>
            </div>

            {/* Status badges */}
            <div className="flex justify-center gap-2">
              {seat.isAllIn && (
                <span className="px-2 py-1 rounded-md bg-red-500/20 text-red-400 text-xs font-bold">
                  ALL IN
                </span>
              )}
              {seat.isFolded && (
                <span className="px-2 py-1 rounded-md bg-white/10 text-white/40 text-xs font-bold">
                  FOLDED
                </span>
              )}
              {seat.isDealer && (
                <span className="px-2 py-1 rounded-md bg-amber-400/20 text-amber-400 text-xs font-bold">
                  DEALER
                </span>
              )}
            </div>

            {/* Close */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-white/10 text-white/60 hover:bg-white/20 transition-colors"
            >
              Close
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
