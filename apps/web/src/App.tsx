import { ConnectButton } from "@rainbow-me/rainbowkit";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useAccount, useEnsAvatar, useEnsName } from "wagmi";
import { sepolia } from "wagmi/chains";
import { PokerTable } from "./components/games/poker/PokerTable";
import { Header } from "./components/layout/Header";
import { Lobby } from "./components/lobby/Lobby";
import { useCustody } from "./hooks/useCustody";
import { useGameState } from "./hooks/useGameState";
import { usePublicRooms } from "./hooks/usePublicRooms";
import { useSocket } from "./hooks/useSocket";
import { useWalletBalance } from "./hooks/useWalletBalance";
import { useYellow } from "./hooks/useYellow";
import { type TransactionEntry, getStore } from "./lib/transactions";

export function App() {
  const { address, isConnected } = useAccount();
  const { data: ensName } = useEnsName({
    address,
    chainId: sepolia.id,
  });
  const { data: ensAvatar } = useEnsAvatar({
    name: ensName ?? undefined,
    chainId: sepolia.id,
  });

  const { socket } = useSocket(
    address,
    ensName ?? undefined,
    ensAvatar ?? undefined,
  );

  const publicRooms = usePublicRooms(socket);

  const {
    client,
    balance,
    isAuthorized,
    authError,
    retryAuth,
    refetchBalance,
    requestTokens,
  } = useYellow(address);

  // Transaction history
  const txnStore = useMemo(
    () => (address ? getStore(address) : null),
    [address],
  );
  const [transactions, setTransactions] = useState<TransactionEntry[]>([]);
  useEffect(() => {
    if (txnStore) setTransactions(txnStore.getAll());
  }, [txnStore]);

  const recordTransaction = useCallback(
    (entry: Omit<TransactionEntry, "id">) => {
      if (!txnStore) return;
      txnStore.add(entry);
      setTransactions(txnStore.getAll());
    },
    [txnStore],
  );

  const clearTransactions = useCallback(() => {
    if (!txnStore) return;
    txnStore.clear();
    setTransactions([]);
  }, [txnStore]);

  const {
    gameState,
    lastHandResult,
    handHistory,
    roomId,
    seatIndex,
    error,
    isSigningSession,
    isLeaveNextHand,
    createRoom,
    joinRoom,
    leaveRoom,
    leaveNextHand,
    startHand,
    sendAction,
    clearError,
  } = useGameState(socket, client, address, recordTransaction);
  const { balance: walletBalance, refetch: refetchWallet } =
    useWalletBalance(address);
  const {
    deposit: custodyDeposit,
    withdraw: custodyWithdraw,
    isDepositing: isCustodyDepositing,
    isWithdrawing: isCustodyWithdrawing,
  } = useCustody(address);

  // Refresh balances when player leaves a room
  const prevRoomId = useRef<string | null>(null);
  useEffect(() => {
    if (prevRoomId.current && !roomId) {
      const timer = setTimeout(() => {
        refetchBalance();
        refetchWallet();
      }, 500);
      return () => clearTimeout(timer);
    }
    prevRoomId.current = roomId;
  }, [roomId, refetchBalance, refetchWallet]);

  // Refresh balance after each hand completes
  useEffect(() => {
    if (lastHandResult) {
      const timer = setTimeout(() => refetchBalance(), 1500);
      return () => clearTimeout(timer);
    }
  }, [lastHandResult, refetchBalance]);

  // Show errors via react-hot-toast
  useEffect(() => {
    if (error) {
      toast.error(error, { id: "game-error" });
      clearError();
    }
  }, [error, clearError]);

  // Read invite code from URL
  const [inviteCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("code")?.toUpperCase() ?? null;
  });

  // Clear URL param once consumed (when user joins a room or dismisses)
  useEffect(() => {
    if (inviteCode && roomId) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [inviteCode, roomId]);

  const isInGame = !!(roomId && gameState);

  // Not connected
  if (!isConnected) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-8 p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <h1 className="text-6xl font-black bg-gradient-to-r from-neon-green via-neon-blue to-neon-pink bg-clip-text text-transparent">
            PlayFrens
          </h1>
          <p className="text-white/50 text-xl max-w-md">
            Play poker with your frens on-chain. Instant, gasless, powered by
            Yellow Network state channels.
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <ConnectButton />
        </motion.div>
      </div>
    );
  }

  // Authorizing with Yellow Network
  if (!isAuthorized) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-6 p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <h1 className="text-4xl font-black bg-gradient-to-r from-neon-green via-neon-blue to-neon-pink bg-clip-text text-transparent">
            PlayFrens
          </h1>
          {authError ? (
            <>
              <p className="text-red-400 text-lg">
                Failed to authorize with Yellow Network
              </p>
              <p className="text-white/40 text-sm max-w-sm">{authError}</p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => retryAuth().catch(() => {})}
                className="px-6 py-3 rounded-xl bg-neon-blue/20 text-neon-blue font-bold hover:bg-neon-blue/30 transition-colors"
              >
                Retry Authorization
              </motion.button>
            </>
          ) : (
            <>
              <p className="text-white/50 text-lg">
                Authorizing with Yellow Network...
              </p>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{
                  duration: 1,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "linear",
                }}
                className="w-8 h-8 border-2 border-neon-blue border-t-transparent rounded-full mx-auto"
              />
            </>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className={
        isInGame
          ? "h-screen overflow-hidden flex flex-col"
          : "min-h-screen flex flex-col"
      }
    >
      <Header
        roomId={roomId}
        onLeaveRoom={leaveRoom}
        isHandInProgress={gameState?.isHandInProgress}
        onLeaveNextHand={leaveNextHand}
        isLeaveNextHand={isLeaveNextHand}
        balance={balance}
        ensName={ensName ?? undefined}
        ensAvatar={ensAvatar ?? undefined}
      />

      {/* Main content */}
      {isInGame ? (
        <PokerTable
          gameState={gameState}
          lastHandResult={lastHandResult}
          handHistory={handHistory}
          heroSeatIndex={seatIndex ?? 0}
          onAction={sendAction}
          onStartHand={startHand}
          isSigningSession={isSigningSession}
        />
      ) : (
        <Lobby
          onCreateRoom={(config) => {
            createRoom(config);
          }}
          onJoinRoom={(id, seat) => {
            joinRoom(id, seat);
          }}
          balance={balance}
          walletBalance={walletBalance}
          onDeposit={async () => {
            await requestTokens();
            await refetchBalance();
            recordTransaction({
              type: "faucet",
              amount: 100,
              timestamp: Date.now(),
              details: "Testnet faucet",
            });
          }}
          onCustodyDeposit={async (amount) => {
            await custodyDeposit(amount);
            await refetchWallet();
            await refetchBalance();
            recordTransaction({
              type: "deposit",
              amount: Number(amount),
              timestamp: Date.now(),
              details: "Custody deposit",
            });
          }}
          onCustodyWithdraw={async (amount) => {
            await custodyWithdraw(amount);
            await refetchWallet();
            await refetchBalance();
            recordTransaction({
              type: "withdraw",
              amount: Number(amount),
              timestamp: Date.now(),
              details: "Custody withdrawal",
            });
          }}
          isCustodyDepositing={isCustodyDepositing}
          isCustodyWithdrawing={isCustodyWithdrawing}
          transactions={transactions}
          onClearTransactions={clearTransactions}
          inviteCode={inviteCode ?? undefined}
          publicRooms={publicRooms}
        />
      )}
    </div>
  );
}
