import { CHIP_UNITS, GAME_DEFAULTS } from "@playfrens/shared";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { normalize } from "viem/ens";
import { useEnsAddress, useEnsAvatar, useEnsName } from "wagmi";
import { sepolia } from "wagmi/chains";
import { formatYusd } from "../../lib/format";
import type { TransactionEntry } from "../../lib/transactions";
import { DepositModal } from "./DepositModal";
import { FriendSearch } from "./FriendSearch";
import { TransactionHistory } from "./TransactionHistory";

interface InvitedPlayer {
  address: string;
  ensName?: string;
  ensAvatar?: string;
}

function InviteInput({
  onAdd,
  existingAddresses,
}: {
  onAdd: (player: InvitedPlayer) => void;
  existingAddresses: string[];
}) {
  const [query, setQuery] = useState("");
  const isEnsName = query.includes(".");
  const isRawAddress = /^0x[a-fA-F0-9]{40}$/i.test(query);

  // Forward resolution: ENS name → address
  const { data: resolvedAddress, isLoading: isLoadingAddress } = useEnsAddress({
    name: isEnsName ? normalize(query) : undefined,
    chainId: sepolia.id,
  });

  // Reverse resolution: address → ENS name
  const { data: reverseName } = useEnsName({
    address: isRawAddress ? (query as `0x${string}`) : undefined,
    chainId: sepolia.id,
  });

  // Avatar from ENS name (either typed or reverse-resolved)
  const ensNameForAvatar = isEnsName ? query : reverseName;
  const { data: avatar } = useEnsAvatar({
    name: ensNameForAvatar ? normalize(ensNameForAvatar) : undefined,
    chainId: sepolia.id,
  });

  const finalAddress = isEnsName
    ? (resolvedAddress ?? undefined)
    : isRawAddress
      ? query
      : undefined;

  const finalEnsName = isEnsName ? query : (reverseName ?? undefined);

  const isDuplicate = finalAddress
    ? existingAddresses.some(
        (a) => a.toLowerCase() === finalAddress.toLowerCase(),
      )
    : false;

  const canAdd = !!finalAddress && !isDuplicate && !isLoadingAddress;

  const handleAdd = () => {
    if (!finalAddress || !canAdd) return;
    onAdd({
      address: finalAddress.toLowerCase(),
      ensName: finalEnsName ?? undefined,
      ensAvatar: avatar ?? undefined,
    });
    setQuery("");
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          placeholder="ENS name or 0x address"
          className="flex-1 px-3 py-1.5 rounded-lg bg-surface-light border border-white/10 text-white text-sm placeholder-white/30 focus:outline-none focus:border-neon-blue"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
          className="px-3 py-1.5 rounded-lg bg-neon-blue/20 text-neon-blue text-sm font-semibold disabled:opacity-30 hover:bg-neon-blue/30 transition-colors"
        >
          Add
        </button>
      </div>

      <AnimatePresence>
        {isLoadingAddress && isEnsName && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-xs text-white/40"
          >
            Resolving...
          </motion.p>
        )}
        {isEnsName &&
          !isLoadingAddress &&
          !resolvedAddress &&
          query.length > 3 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-red-400"
            >
              ENS name not found
            </motion.p>
          )}
        {isDuplicate && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-xs text-yellow-400"
          >
            Already added
          </motion.p>
        )}
        {finalAddress && !isDuplicate && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-neon-green/10 border border-neon-green/20"
          >
            {avatar && (
              <img
                src={avatar}
                alt=""
                className="w-5 h-5 rounded-full border border-white/20"
              />
            )}
            <div className="flex items-center gap-1.5 text-xs">
              {finalEnsName && (
                <span className="text-neon-green font-semibold">
                  {finalEnsName}
                </span>
              )}
              <span className="font-mono text-white/50">
                {finalAddress.slice(0, 6)}...{finalAddress.slice(-4)}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

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
    allowedPlayers?: string[];
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

  // Private room state
  const [isPrivate, setIsPrivate] = useState(false);
  const [invitedPlayers, setInvitedPlayers] = useState<InvitedPlayer[]>([]);

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

            {/* Private Room toggle */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                role="switch"
                aria-checked={isPrivate}
                aria-label="Private Room"
                onClick={() => {
                  setIsPrivate(!isPrivate);
                  if (isPrivate) setInvitedPlayers([]);
                }}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  isPrivate ? "bg-neon-blue/60" : "bg-white/10"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    isPrivate ? "translate-x-5" : ""
                  }`}
                />
              </button>
              <span className="text-xs text-white/40">Invite Only</span>
            </div>

            {/* Invite list */}
            <AnimatePresence>
              {isPrivate && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  <InviteInput
                    onAdd={(player) =>
                      setInvitedPlayers((prev) => [...prev, player])
                    }
                    existingAddresses={invitedPlayers.map((p) => p.address)}
                  />

                  {invitedPlayers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {invitedPlayers.map((p) => (
                        <motion.span
                          key={p.address}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-neon-blue/10 border border-neon-blue/20 text-xs"
                        >
                          {p.ensAvatar && (
                            <img
                              src={p.ensAvatar}
                              alt=""
                              className="w-4 h-4 rounded-full"
                            />
                          )}
                          <span className="text-white/70">
                            {p.ensName ||
                              `${p.address.slice(0, 6)}...${p.address.slice(-4)}`}
                          </span>
                          {p.ensName && (
                            <span className="font-mono text-white/30">
                              {p.address.slice(0, 6)}...{p.address.slice(-4)}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setInvitedPlayers((prev) =>
                                prev.filter((x) => x.address !== p.address),
                              )
                            }
                            className="text-white/30 hover:text-white/70 ml-0.5"
                            aria-label={`Remove ${p.ensName || p.address}`}
                          >
                            &times;
                          </button>
                        </motion.span>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

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
                  ...(isPrivate && invitedPlayers.length > 0
                    ? {
                        allowedPlayers: invitedPlayers.map((p) => p.address),
                      }
                    : {}),
                })
              }
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-neon-pink to-neon-purple text-white font-bold hover:brightness-110 transition-all"
            >
              {isPrivate ? "Create Private Table" : "Create Table"}
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
