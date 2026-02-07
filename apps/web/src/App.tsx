import { ConnectButton } from "@rainbow-me/rainbowkit";
import { AnimatePresence, motion } from "motion/react";
import { useAccount, useEnsAvatar, useEnsName } from "wagmi";
import { mainnet } from "wagmi/chains";
import { PokerTable } from "./components/games/poker/PokerTable";
import { Header } from "./components/layout/Header";
import { Lobby } from "./components/lobby/Lobby";
import { useCustody } from "./hooks/useCustody";
import { useGameState } from "./hooks/useGameState";
import { useSocket } from "./hooks/useSocket";
import { useWalletBalance } from "./hooks/useWalletBalance";
import { useYellow } from "./hooks/useYellow";

export function App() {
  const { address, isConnected } = useAccount();
  const { data: ensName } = useEnsName({
    address,
    chainId: mainnet.id,
  });
  const { data: ensAvatar } = useEnsAvatar({
    name: ensName ?? undefined,
    chainId: mainnet.id,
  });

  const { socket, isRegistered } = useSocket(
    address,
    ensName ?? undefined,
    ensAvatar ?? undefined,
  );

  const {
    gameState,
    lastHandResult,
    handHistory,
    roomId,
    seatIndex,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
    cashOut,
    startHand,
    sendAction,
    sendReaction,
    clearError,
  } = useGameState(socket);

  const {
    balance,
    isAuthorized,
    isAuthorizing,
    authError,
    retryAuth,
    refetchBalance,
    requestTokens,
  } = useYellow(address);
  const { balance: walletBalance, refetch: refetchWallet } =
    useWalletBalance(address);
  const {
    deposit: custodyDeposit,
    withdraw: custodyWithdraw,
    isDepositing: isCustodyDepositing,
    isWithdrawing: isCustodyWithdrawing,
  } = useCustody(address);

  // Not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-8 p-6">
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
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
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
                transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                className="w-8 h-8 border-2 border-neon-blue border-t-transparent rounded-full mx-auto"
              />
            </>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header roomId={roomId} onLeaveRoom={leaveRoom} onCashOut={cashOut} />

      {/* Error toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 cursor-pointer"
            onClick={clearError}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      {roomId && gameState ? (
        <PokerTable
          gameState={gameState}
          lastHandResult={lastHandResult}
          handHistory={handHistory}
          heroSeatIndex={seatIndex ?? 0}
          onAction={sendAction}
          onStartHand={startHand}
          onReaction={sendReaction}
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
          }}
          onCustodyDeposit={async (amount) => {
            await custodyDeposit(amount);
            await refetchWallet();
            await refetchBalance();
          }}
          onCustodyWithdraw={async (amount) => {
            await custodyWithdraw(amount);
            await refetchWallet();
            await refetchBalance();
          }}
          isCustodyDepositing={isCustodyDepositing}
          isCustodyWithdrawing={isCustodyWithdrawing}
        />
      )}
    </div>
  );
}
