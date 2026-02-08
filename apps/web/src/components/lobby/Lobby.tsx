import { CHIP_UNITS, GAME_DEFAULTS, type RoomInfo } from "@playfrens/shared";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { normalize } from "viem/ens";
import { useEnsAddress, useEnsAvatar, useEnsName } from "wagmi";
import { sepolia } from "wagmi/chains";
import { formatYusd } from "../../lib/format";
import type { TransactionEntry } from "../../lib/transactions";
import { DepositModal } from "./DepositModal";
import { TransactionHistory } from "./TransactionHistory";

function tryNormalize(name: string): string | undefined {
  try {
    return normalize(name);
  } catch {
    return undefined;
  }
}

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

  const normalizedQuery = useMemo(
    () => (isEnsName ? tryNormalize(query) : undefined),
    [isEnsName, query],
  );

  const { data: resolvedAddress, isLoading: isLoadingAddress } = useEnsAddress({
    name: normalizedQuery,
    chainId: sepolia.id,
  });

  const { data: reverseName } = useEnsName({
    address: isRawAddress ? (query as `0x${string}`) : undefined,
    chainId: sepolia.id,
  });

  const ensNameForAvatar = isEnsName ? query : reverseName;
  const normalizedAvatar = useMemo(
    () => (ensNameForAvatar ? tryNormalize(ensNameForAvatar) : undefined),
    [ensNameForAvatar],
  );
  const { data: avatar } = useEnsAvatar({
    name: normalizedAvatar,
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

function RoomCard({ room, onJoin }: { room: RoomInfo; onJoin: () => void }) {
  const creator = room.players[0];
  const displayName = creator
    ? creator.ensName ||
      `${creator.address.slice(0, 6)}...${creator.address.slice(-4)}`
    : "Unknown";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="glass rounded-xl p-4 flex items-center gap-4"
    >
      {/* Creator avatar */}
      <div className="shrink-0">
        {creator?.ensAvatar ? (
          <img
            src={creator.ensAvatar}
            alt={displayName}
            className="w-10 h-10 rounded-full border border-white/20"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-purple to-neon-pink flex items-center justify-center text-sm font-bold border border-white/10">
            {displayName.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>

      {/* Room info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-white truncate">
            {displayName}
          </p>
          <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-neon-purple/20 text-neon-purple uppercase">
            {room.gameType}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-white/50">
          <span>
            Buy-in:{" "}
            <span className="text-neon-green font-mono">
              {room.config.buyIn}
            </span>{" "}
            chips
            <span className="text-white/30 ml-1">
              ({formatYusd(room.config.buyIn * room.config.chipUnit)} ytest.usd)
            </span>
          </span>
          <span className="text-white/20">|</span>
          <span>
            Blinds: {room.config.smallBlind}/{room.config.bigBlind}
          </span>
        </div>
      </div>

      {/* Players + Join */}
      <div className="shrink-0 flex items-center gap-3">
        <div className="flex items-center gap-1">
          {Array.from({ length: room.config.maxPlayers }, (_, i) => (
            <div
              key={`seat-${room.roomId}-${i}`}
              className={`w-2.5 h-2.5 rounded-full ${
                i < room.players.length ? "bg-neon-green" : "bg-white/10"
              }`}
            />
          ))}
          <span className="text-xs text-white/40 ml-1">
            {room.players.length}/{room.config.maxPlayers}
          </span>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onJoin}
          className="px-4 py-1.5 rounded-lg bg-neon-green/20 text-neon-green text-sm font-bold hover:bg-neon-green/30 transition-colors"
        >
          Join
        </motion.button>
      </div>
    </motion.div>
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
  publicRooms,
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
  publicRooms?: RoomInfo[];
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

  const rooms = publicRooms ?? [];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Balance bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 20 }}
          className="glass rounded-xl px-5 py-3 flex items-center justify-between"
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

        {/* Open Tables */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 20, delay: 0.05 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-base font-bold text-white">Open Tables</h2>
            {rooms.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-neon-green/20 text-neon-green text-xs font-bold">
                {rooms.length}
              </span>
            )}
          </div>

          {rooms.length === 0 ? (
            <div className="glass rounded-xl px-5 py-8 text-center">
              <p className="text-white/30 text-sm">
                No open tables — create one below!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {rooms.map((room) => (
                  <RoomCard
                    key={room.roomId}
                    room={room}
                    onJoin={() => onJoinRoom(room.roomId, -1)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </motion.div>

        {/* Two-column layout: Create + Join by Code */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 20, delay: 0.1 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        >
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

          {/* Right column: Join by Code */}
          <div className="glass rounded-xl p-5 space-y-3">
            <h2 className="text-base font-bold text-white">Join by Code</h2>
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
            <p className="text-xs text-white/40">
              Have a room code? Enter it below to join a private or specific
              table.
            </p>
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
        </motion.div>

        {/* Transaction History — spans full width */}
        {transactions && transactions.length > 0 && onClearTransactions && (
          <TransactionHistory
            entries={transactions}
            onClear={onClearTransactions}
          />
        )}
      </div>

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
