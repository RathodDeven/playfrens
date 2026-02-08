import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { formatYusd } from "../../lib/format";

export function DepositModal({
  isOpen,
  onClose,
  balance,
  walletBalance,
  onDeposit,
  onCustodyDeposit,
  onCustodyWithdraw,
  custodyBalance,
  isCustodyDepositing,
  isCustodyWithdrawing,
}: {
  isOpen: boolean;
  onClose: () => void;
  balance: string;
  walletBalance: string;
  onDeposit: () => Promise<void>;
  onCustodyDeposit: (amount: string) => Promise<void>;
  onCustodyWithdraw: (amount: string) => Promise<void>;
  custodyBalance?: string;
  isCustodyDepositing: boolean;
  isCustodyWithdrawing: boolean;
}) {
  const [isDepositing, setIsDepositing] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"faucet" | "deposit" | "withdraw">("faucet");

  const custodyNum = Number(custodyBalance ?? "0");

  const handleFaucet = async () => {
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

  const handleDeposit = async () => {
    if (!depositAmount || Number(depositAmount) <= 0) {
      setError("Enter a valid amount");
      return;
    }
    setError(null);
    try {
      await onCustodyDeposit(depositAmount);
      setDepositAmount("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Deposit failed";
      setError(message);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || Number(withdrawAmount) <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (Number(withdrawAmount) > custodyNum) {
      setError(
        `Insufficient Custody balance. Available: ${formatYusd(custodyNum)} ytest.usd`,
      );
      return;
    }
    setError(null);
    try {
      await onCustodyWithdraw(withdrawAmount);
      setWithdrawAmount("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Withdraw failed";
      setError(message);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25 }}
            className="rounded-2xl p-8 max-w-md w-full mx-4 space-y-6 bg-[#12121f] border border-white/10 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-white">Manage Funds</h2>

            {/* Balance display */}
            <div className="flex justify-between items-center px-4 py-3 rounded-xl bg-surface-light">
              <span className="text-white/60">Balance</span>
              <span className="font-mono text-neon-green font-bold">
                {formatYusd(Number(balance))} ytest.usd
              </span>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 rounded-xl bg-surface-light">
              {(["faucet", "deposit", "withdraw"] as const).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => {
                    setTab(t);
                    setError(null);
                  }}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    tab === t
                      ? "bg-neon-green/20 text-neon-green"
                      : "text-white/40 hover:text-white/60"
                  }`}
                >
                  {t === "faucet"
                    ? "Faucet"
                    : t === "deposit"
                      ? "Deposit"
                      : "Withdraw"}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {tab === "faucet" && (
              <div className="space-y-4">
                <p className="text-sm text-white/50">
                  This is testnet — tokens are free! Hit the faucet to get test
                  ytest.usd deposited into your Yellow Network unified balance.
                </p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleFaucet}
                  disabled={isDepositing}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-neon-green/80 to-neon-blue/80 text-black font-bold hover:from-neon-green hover:to-neon-blue transition-all disabled:opacity-50"
                >
                  {isDepositing ? "Requesting..." : "Request from Faucet"}
                </motion.button>
              </div>
            )}

            {tab === "deposit" && (
              <div className="space-y-4">
                <p className="text-sm text-white/50">
                  Deposit ytest.usd from your wallet into the Custody contract
                  (on-chain). Deposited funds can be withdrawn back to your
                  wallet anytime.
                </p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="Amount"
                    step="0.01"
                    min="0"
                    className="flex-1 px-4 py-3 rounded-xl bg-surface-light border border-white/10 text-white placeholder-white/30 font-mono focus:outline-none focus:border-neon-green"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setDepositAmount(String(Number(walletBalance)))
                    }
                    className="px-3 py-3 rounded-xl bg-white/10 text-white/60 text-sm hover:bg-white/20 transition-colors"
                  >
                    Max
                  </button>
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleDeposit}
                  disabled={isCustodyDepositing || !depositAmount}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-neon-blue/80 to-neon-purple/80 text-white font-bold hover:from-neon-blue hover:to-neon-purple transition-all disabled:opacity-50"
                >
                  {isCustodyDepositing ? "Depositing..." : "Deposit to Custody"}
                </motion.button>
              </div>
            )}

            {tab === "withdraw" && (
              <div className="space-y-4">
                <p className="text-sm text-white/50">
                  Withdraw from the Custody contract (on-chain) back to your
                  wallet. Only funds deposited on-chain can be withdrawn —
                  faucet funds are off-chain only.
                </p>
                <div className="flex justify-between items-center px-3 py-2 rounded-lg bg-white/5 text-sm">
                  <span className="text-white/50">Withdrawable</span>
                  <span className="font-mono text-neon-blue font-bold">
                    {formatYusd(custodyNum)} ytest.usd
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="Amount"
                    step="0.01"
                    min="0"
                    className="flex-1 px-4 py-3 rounded-xl bg-surface-light border border-white/10 text-white placeholder-white/30 font-mono focus:outline-none focus:border-neon-green"
                  />
                  <button
                    type="button"
                    onClick={() => setWithdrawAmount(String(custodyNum))}
                    className="px-3 py-3 rounded-xl bg-white/10 text-white/60 text-sm hover:bg-white/20 transition-colors"
                  >
                    Max
                  </button>
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleWithdraw}
                  disabled={
                    isCustodyWithdrawing || !withdrawAmount || custodyNum <= 0
                  }
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-neon-pink/80 to-neon-purple/80 text-white font-bold hover:from-neon-pink hover:to-neon-purple transition-all disabled:opacity-50"
                >
                  {isCustodyWithdrawing
                    ? "Withdrawing..."
                    : "Withdraw to Wallet"}
                </motion.button>
              </div>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-white/10 text-white/60 hover:bg-white/20 transition-colors"
            >
              Close
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
