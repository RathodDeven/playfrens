import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { formatYusd } from "../../lib/format";

export function DepositModal({
  isOpen,
  onClose,
  balance,
  onDeposit,
}: {
  isOpen: boolean;
  onClose: () => void;
  balance: string;
  onDeposit: () => Promise<void>;
}) {
  const [isDepositing, setIsDepositing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDeposit = async () => {
    setIsDepositing(true);
    setError(null);
    try {
      await onDeposit();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed";
      setError(message);
    } finally {
      setTimeout(() => setIsDepositing(false), 2000);
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
            className="glass rounded-2xl p-8 max-w-md w-full mx-4 space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-white">
              Get Test Tokens
            </h2>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-4 py-3 rounded-xl bg-surface-light">
                <span className="text-white/60">Yellow Balance</span>
                <span className="font-mono text-neon-green font-bold">
                  {formatYusd(Number(balance))} ytest.usd
                </span>
              </div>
            </div>

            <p className="text-sm text-white/50">
              This is testnet — tokens are free! Hit the faucet to get test
              ytest.usd deposited into your Yellow Network state channel.
            </p>

            {error && (
              <p className="text-sm text-red-400">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleDeposit}
                disabled={isDepositing}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-neon-green/80 to-neon-blue/80 text-black font-bold hover:from-neon-green hover:to-neon-blue transition-all disabled:opacity-50"
              >
                {isDepositing ? "Requesting..." : "Request from Faucet"}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onClose}
                className="px-6 py-3 rounded-xl bg-white/10 text-white/60 hover:bg-white/20 transition-colors"
              >
                Close
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
