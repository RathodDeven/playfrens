import { CHIP_UNITS, GAME_DEFAULTS } from "@playfrens/shared";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { formatYusd } from "../../lib/format";
import type { TransactionEntry } from "../../lib/transactions";
import { DepositModal } from "./DepositModal";
import { FriendSearch } from "./FriendSearch";
import { TransactionHistory } from "./TransactionHistory";

export function Lobby({
  onCreateRoom,
  onJoinRoom,
  balance,
  walletBalance,
  onDeposit,
  onCustodyDeposit,
  onCustodyWithdraw,
  isCustodyDepositing,
  isCustodyWithdrawing,
  transactions,
  onClearTransactions,
  inviteCode,
}: {
  onCreateRoom: (config: {
    buyIn: number;
    smallBlind: number;
    bigBlind: number;
    maxPlayers: number;
    chipUnit: number;
  }) => void;
  onJoinRoom: (roomId: string, seatIndex: number) => void;
  balance: string;
  walletBalance: string;
  onDeposit: () => Promise<void>;
  onCustodyDeposit: (amount: string) => Promise<void>;
  onCustodyWithdraw: (amount: string) => Promise<void>;
  isCustodyDepositing: boolean;
  isCustodyWithdrawing: boolean;
  transactions?: TransactionEntry[];
  onClearTransactions?: () => void;
  inviteCode?: string;
}) {
  const [joinCode, setJoinCode] = useState("");
  const [showDeposit, setShowDeposit] = useState(false);
  const [buyIn, setBuyIn] = useState<number>(GAME_DEFAULTS.DEFAULT_BUY_IN);
  const [smallBlind, setSmallBlind] = useState<number>(
    GAME_DEFAULTS.DEFAULT_SMALL_BLIND,
  );
  const [bigBlind, setBigBlind] = useState<number>(
    GAME_DEFAULTS.DEFAULT_BIG_BLIND,
  );
  const [chipUnit, setChipUnit] = useState<number>(
    GAME_DEFAULTS.DEFAULT_CHIP_UNIT,
  );

  // Auto-fill join code from invite link
  useEffect(() => {
    if (inviteCode && inviteCode.length === 6) {
      setJoinCode(inviteCode.toUpperCase());
    }
  }, [inviteCode]);

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col items-center justify-center p-4 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", damping: 20 }}
        className="w-full max-w-4xl space-y-4"
      >
        {/* Balance bar */}
        <motion.div
          className="glass rounded-xl px-5 py-3 flex items-center justify-between"
          whileHover={{ scale: 1.005 }}
        >
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs text-white/50">Yellow Balance</p>
              <p className="text-xl font-bold font-mono text-neon-green">
                {formatYusd(Number(balance))}{" "}
                <span className="text-xs text-white/40">ytest.usd</span>
              </p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <p className="text-xs text-white/50">Wallet Balance</p>
              <p className="text-base font-bold font-mono text-white/80">
                {formatYusd(Number(walletBalance))}{" "}
                <span className="text-xs text-white/40">ytest.usd</span>
              </p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowDeposit(true)}
            className="px-4 py-2 rounded-lg bg-neon-green/20 text-neon-green font-semibold text-sm hover:bg-neon-green/30 transition-colors"
          >
            Manage Funds
          </motion.button>
        </motion.div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left column: Create Table */}
          <div className="glass rounded-xl p-5 space-y-3">
            <h2 className="text-base font-bold text-white">Create a Table</h2>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label htmlFor="buy-in" className="text-xs text-white/40">
                  Buy-in
                </label>
                <input
                  id="buy-in"
                  type="number"
                  value={buyIn}
                  onChange={(e) => setBuyIn(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-surface-light border border-white/10 text-white text-sm focus:outline-none focus:border-neon-green"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="small-blind" className="text-xs text-white/40">
                  Small Blind
                </label>
                <input
                  id="small-blind"
                  type="number"
                  value={smallBlind}
                  onChange={(e) => setSmallBlind(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-surface-light border border-white/10 text-white text-sm focus:outline-none focus:border-neon-green"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="big-blind" className="text-xs text-white/40">
                  Big Blind
                </label>
                <input
                  id="big-blind"
                  type="number"
                  value={bigBlind}
                  onChange={(e) => setBigBlind(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-surface-light border border-white/10 text-white text-sm focus:outline-none focus:border-neon-green"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label htmlFor="chip-unit" className="text-xs text-white/40">
                  Chip Unit
                </label>
                <select
                  id="chip-unit"
                  value={chipUnit}
                  onChange={(e) => setChipUnit(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-surface-light border border-white/10 text-white text-sm focus:outline-none focus:border-neon-green"
                >
                  {CHIP_UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      1 chip = {formatYusd(unit)} ytest.usd
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-white/40">
                  Buy-in (ytest.usd)
                </span>
                <div className="px-2.5 py-1.5 rounded-lg bg-surface-light border border-white/10 text-white text-sm">
                  {formatYusd(buyIn * chipUnit)} ytest.usd
                </div>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() =>
                onCreateRoom({
                  buyIn,
                  smallBlind,
                  bigBlind,
                  maxPlayers: GAME_DEFAULTS.MAX_PLAYERS,
                  chipUnit,
                })
              }
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-neon-pink to-neon-purple text-white font-bold hover:brightness-110 transition-all"
            >
              Create Table
            </motion.button>
          </div>

          {/* Right column: Join + Friend Search */}
          <div className="space-y-4">
            {/* Join Room */}
            <div className="glass rounded-xl p-5 space-y-3">
              <h2 className="text-base font-bold text-white">Join a Table</h2>
              {inviteCode && joinCode === inviteCode.toUpperCase() && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="px-3 py-1.5 rounded-lg bg-neon-blue/10 border border-neon-blue/20 text-sm text-neon-blue"
                >
                  You've been invited to room{" "}
                  <span className="font-mono font-bold">{joinCode}</span>!
                </motion.div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Enter room code"
                  maxLength={6}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-surface-light border border-white/10 text-white placeholder-white/30 font-mono text-lg tracking-wider text-center focus:outline-none focus:border-neon-blue"
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    if (joinCode.length === 6) {
                      onJoinRoom(joinCode, -1);
                    }
                  }}
                  disabled={joinCode.length !== 6}
                  className="px-6 py-2.5 rounded-xl bg-neon-blue/20 text-neon-blue font-bold hover:bg-neon-blue/30 transition-colors disabled:opacity-30"
                >
                  Join
                </motion.button>
              </div>
            </div>

            {/* Friend Search */}
            <div className="glass rounded-xl p-5">
              <FriendSearch
                onInvite={(address, ensName) => {
                  console.log("Invite:", address, ensName);
                }}
              />
            </div>
          </div>
        </div>

        {/* Transaction History — spans full width */}
        {transactions && transactions.length > 0 && onClearTransactions && (
          <TransactionHistory
            entries={transactions}
            onClear={onClearTransactions}
          />
        )}
      </motion.div>

      <DepositModal
        isOpen={showDeposit}
        onClose={() => setShowDeposit(false)}
        balance={balance}
        walletBalance={walletBalance}
        onDeposit={onDeposit}
        onCustodyDeposit={onCustodyDeposit}
        onCustodyWithdraw={onCustodyWithdraw}
        isCustodyDepositing={isCustodyDepositing}
        isCustodyWithdrawing={isCustodyWithdrawing}
      />
    </div>
  );
}
