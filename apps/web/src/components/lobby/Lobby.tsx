import { useState } from "react";
import { motion } from "motion/react";
import { CHIP_UNITS, GAME_DEFAULTS } from "@playfrens/shared";
import { FriendSearch } from "./FriendSearch";
import { DepositModal } from "./DepositModal";
import { formatYusd } from "../../lib/format";

export function Lobby({
  onCreateRoom,
  onJoinRoom,
  balance,
  onDeposit,
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
  onDeposit: () => Promise<void>;
}) {
  const [joinCode, setJoinCode] = useState("");
  const [showDeposit, setShowDeposit] = useState(false);
  const [buyIn, setBuyIn] = useState<number>(GAME_DEFAULTS.DEFAULT_BUY_IN);
  const [smallBlind, setSmallBlind] = useState<number>(GAME_DEFAULTS.DEFAULT_SMALL_BLIND);
  const [bigBlind, setBigBlind] = useState<number>(GAME_DEFAULTS.DEFAULT_BIG_BLIND);
  const [chipUnit, setChipUnit] = useState<number>(
    GAME_DEFAULTS.DEFAULT_CHIP_UNIT,
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] p-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", damping: 20 }}
        className="max-w-lg w-full space-y-8"
      >
        {/* Hero */}
        <div className="text-center space-y-3">
          <motion.h1
            className="text-5xl font-black bg-gradient-to-r from-neon-green via-neon-blue to-neon-pink bg-clip-text text-transparent"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", damping: 10 }}
          >
            PlayFrens
          </motion.h1>
          <p className="text-white/50 text-lg">
            Play poker with your frens. On-chain. Instant.
          </p>
        </div>

        {/* Balance */}
        <motion.div
          className="glass rounded-2xl p-5 flex items-center justify-between"
          whileHover={{ scale: 1.01 }}
        >
          <div>
            <p className="text-sm text-white/50">Yellow Balance</p>
            <p className="text-2xl font-bold font-mono text-neon-green">
              {formatYusd(Number(balance))}{" "}
              <span className="text-sm text-white/40">ytest.usd</span>
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowDeposit(true)}
            className="px-5 py-2.5 rounded-xl bg-neon-green/20 text-neon-green font-semibold hover:bg-neon-green/30 transition-colors"
          >
            Get Tokens
          </motion.button>
        </motion.div>

        {/* Create Room */}
        <div className="glass rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-white">Create a Table</h2>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-white/40">Buy-in</label>
              <input
                type="number"
                value={buyIn}
                onChange={(e) => setBuyIn(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-surface-light border border-white/10 text-white text-sm focus:outline-none focus:border-neon-green"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-white/40">Small Blind</label>
              <input
                type="number"
                value={smallBlind}
                onChange={(e) => setSmallBlind(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-surface-light border border-white/10 text-white text-sm focus:outline-none focus:border-neon-green"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-white/40">Big Blind</label>
              <input
                type="number"
                value={bigBlind}
                onChange={(e) => setBigBlind(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-surface-light border border-white/10 text-white text-sm focus:outline-none focus:border-neon-green"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-white/40">Chip Unit</label>
              <select
                value={chipUnit}
                onChange={(e) => setChipUnit(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-surface-light border border-white/10 text-white text-sm focus:outline-none focus:border-neon-green"
              >
                {CHIP_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    1 chip = {formatYusd(unit)} ytest.usd
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-white/40">Buy-in (ytest.usd)</label>
              <div className="px-3 py-2 rounded-lg bg-surface-light border border-white/10 text-white text-sm">
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
            className="w-full py-3 rounded-xl bg-gradient-to-r from-neon-pink to-neon-purple text-white font-bold text-lg hover:brightness-110 transition-all"
          >
            Create Table
          </motion.button>
        </div>

        {/* Join Room */}
        <div className="glass rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-white">Join a Table</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Enter room code"
              maxLength={6}
              className="flex-1 px-4 py-3 rounded-xl bg-surface-light border border-white/10 text-white placeholder-white/30 font-mono text-lg tracking-wider text-center focus:outline-none focus:border-neon-blue"
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                if (joinCode.length === 6) {
                  onJoinRoom(joinCode, 1);
                }
              }}
              disabled={joinCode.length !== 6}
              className="px-8 py-3 rounded-xl bg-neon-blue/20 text-neon-blue font-bold hover:bg-neon-blue/30 transition-colors disabled:opacity-30"
            >
              Join
            </motion.button>
          </div>
        </div>

        {/* Friend Search */}
        <div className="glass rounded-2xl p-6">
          <FriendSearch
            onInvite={(address, ensName) => {
              console.log("Invite:", address, ensName);
            }}
          />
        </div>
      </motion.div>

      <DepositModal
        isOpen={showDeposit}
        onClose={() => setShowDeposit(false)}
        balance={balance}
        onDeposit={onDeposit}
      />
    </div>
  );
}
