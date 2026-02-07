import type {
  HandResult,
  PokerAction,
  PokerPlayerState,
} from "@playfrens/shared";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { HandHistoryEntry } from "../../../hooks/useGameState";
import { formatYusd } from "../../../lib/format";
import { ActionBar } from "./ActionBar";
import { CommunityCards } from "./CommunityCards";
import { HandHistory } from "./HandHistory";
import { PlayerSeat } from "./PlayerSeat";
import { PotDisplay } from "./PotDisplay";

// 4-seat positions: bottom (hero), left, top, right
const seatPositions = [
  { top: "85%", left: "50%", transform: "translate(-50%, -50%)" }, // 0: bottom center (hero)
  { top: "50%", left: "5%", transform: "translate(0, -50%)" }, // 1: left center
  { top: "5%", left: "50%", transform: "translate(-50%, 0)" }, // 2: top center
  { top: "50%", left: "95%", transform: "translate(-100%, -50%)" }, // 3: right center
];

export function PokerTable({
  gameState,
  lastHandResult,
  handHistory,
  heroSeatIndex,
  onAction,
  onStartHand,
  isSigningSession,
}: {
  gameState: PokerPlayerState;
  lastHandResult: HandResult | null;
  handHistory: HandHistoryEntry[];
  heroSeatIndex: number;
  onAction: (action: PokerAction, betSize?: number) => void;
  onStartHand: () => void;
  isSigningSession?: boolean;
}) {
  const [showConfetti, setShowConfetti] = useState(false);

  const autoStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show confetti when hero wins
  useEffect(() => {
    if (lastHandResult?.winners.some((w) => w.seatIndex === heroSeatIndex)) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    }
  }, [lastHandResult, heroSeatIndex]);

  // Auto-start next hand after showing result (host only)
  useEffect(() => {
    if (autoStartTimerRef.current) {
      clearTimeout(autoStartTimerRef.current);
      autoStartTimerRef.current = null;
    }

    if (
      lastHandResult &&
      !gameState.isHandInProgress &&
      heroSeatIndex === 0 &&
      gameState.seats.length >= 2
    ) {
      autoStartTimerRef.current = setTimeout(() => {
        onStartHand();
        autoStartTimerRef.current = null;
      }, 4000);
    }

    return () => {
      if (autoStartTimerRef.current) {
        clearTimeout(autoStartTimerRef.current);
      }
    };
  }, [
    lastHandResult,
    gameState.isHandInProgress,
    heroSeatIndex,
    gameState.seats.length,
    onStartHand,
  ]);

  // Show confetti when hero wins
  useEffect(() => {
    if (lastHandResult?.winners.some((w) => w.seatIndex === heroSeatIndex)) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    }
  }, [lastHandResult, heroSeatIndex]);

  const isHeroTurn =
    gameState.isHandInProgress && gameState.currentPlayerSeat === heroSeatIndex;

  const chipUnit = gameState.chipUnit || 1;

  // Only host (seat 0) can start hands — show button only for first hand (no lastHandResult yet)
  const canStartHand =
    !gameState.isHandInProgress &&
    gameState.seats.length >= 2 &&
    heroSeatIndex === 0 &&
    !lastHandResult;

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      {/* Table area */}
      <div className="flex-1 relative flex items-center justify-center p-8">
        {/* Felt table */}
        <div className="relative w-full max-w-4xl aspect-[16/10] felt rounded-[60px] border-4 border-amber-900/60 shadow-2xl">
          {/* PlayFrens logo center */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
            <p className="text-white/10 text-3xl font-black">PlayFrens</p>
          </div>

          {/* Deck visual at center-top — shows during hand */}
          {gameState.isHandInProgress && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute top-[15%] left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            >
              <div className="relative w-14 h-20">
                {/* Stacked deck cards */}
                <div className="absolute top-0 left-0 w-full h-full card-back rounded-lg border border-purple-500/30 shadow-md" />
                <div className="absolute top-[2px] left-[2px] w-full h-full card-back rounded-lg border border-purple-500/20 shadow-sm" />
                <div className="absolute top-[4px] left-[4px] w-full h-full card-back rounded-lg border border-purple-400/10" />
              </div>
            </motion.div>
          )}

          {/* Community Cards */}
          <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2">
            <CommunityCards cards={gameState.communityCards} />
          </div>

          {/* Pot — below community cards, clear spacing */}
          <div className="absolute top-[60%] left-1/2 -translate-x-1/2 -translate-y-1/2">
            <PotDisplay pots={gameState.pots} chipUnit={chipUnit} />
          </div>

          {/* Player Seats — hero rotation */}
          <AnimatePresence>
            {gameState.seats.map((seat) => {
              const positionIndex = (seat.seatIndex - heroSeatIndex + 4) % 4;
              return (
                <div
                  key={seat.seatIndex}
                  className="absolute"
                  style={seatPositions[positionIndex]}
                >
                  <PlayerSeat
                    seat={seat}
                    isHero={seat.seatIndex === heroSeatIndex}
                    holeCards={
                      seat.seatIndex === heroSeatIndex
                        ? gameState.holeCards
                        : undefined
                    }
                    chipUnit={chipUnit}
                    isHandInProgress={gameState.isHandInProgress}
                  />
                </div>
              );
            })}
          </AnimatePresence>

          {/* Start hand button — only for host */}
          {canStartHand && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", damping: 10 }}
              onClick={onStartHand}
              disabled={isSigningSession}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-8 py-4 rounded-2xl bg-gradient-to-r from-neon-green to-neon-blue text-black font-black text-xl shadow-lg glow-green disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSigningSession ? "Signing Session..." : "Deal Cards!"}
            </motion.button>
          )}

          {/* Hand result overlay */}
          <AnimatePresence>
            {lastHandResult && !gameState.isHandInProgress && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute top-[50%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 glass rounded-2xl px-8 py-5 text-center shadow-2xl border border-neon-green/30"
              >
                {lastHandResult.winners.map((w, idx) => {
                  const winnerSeat = gameState.seats.find(
                    (s) => s.seatIndex === w.seatIndex,
                  );
                  const shortAddr = (addr?: string) =>
                    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : null;
                  const winnerName =
                    w.seatIndex === heroSeatIndex
                      ? "You"
                      : w.ensName ||
                        winnerSeat?.ensName ||
                        shortAddr(w.address) ||
                        shortAddr(winnerSeat?.address) ||
                        `Player ${(w.seatIndex ?? idx) + 1}`;
                  const winAmount = w.amount || 0;
                  return (
                    <div key={w.seatIndex ?? idx} className="space-y-1">
                      <motion.p
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        className="text-neon-green font-black text-xl"
                      >
                        {w.seatIndex === heroSeatIndex
                          ? "🎉 You won!"
                          : `${winnerName} wins!`}
                      </motion.p>
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-neon-yellow font-mono text-lg font-bold"
                      >
                        +{winAmount} chips ({formatYusd(winAmount * chipUnit)}{" "}
                        ytest.usd)
                      </motion.p>
                      {w.hand && (
                        <p className="text-white/60 text-sm mt-1">{w.hand}</p>
                      )}
                    </div>
                  );
                })}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                  className="text-white/30 text-xs mt-3"
                >
                  Next hand starting...
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Confetti */}
          {showConfetti && <Confetti />}
        </div>

        {/* Hand History sidebar */}
        <HandHistory entries={handHistory} chipUnit={chipUnit} />
      </div>

      {/* Bottom bar */}
      <div className="px-4 py-3 glass">
        <div className="flex items-center justify-center max-w-4xl mx-auto">
          {isHeroTurn ? (
            <ActionBar
              legalActions={gameState.legalActions}
              onAction={onAction}
              chipUnit={chipUnit}
            />
          ) : gameState.isHandInProgress ? (
            <p className="text-white/40 text-sm">
              Waiting for{" "}
              <span className="text-white/60 font-medium">
                {gameState.seats.find(
                  (s) => s.seatIndex === gameState.currentPlayerSeat,
                )?.ensName || "opponent"}
              </span>
            </p>
          ) : !lastHandResult && !canStartHand ? (
            <p className="text-white/40 text-sm">Waiting for players...</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Confetti() {
  const pieces = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.5,
    color: ["#39ff14", "#ff6ec7", "#00f0ff", "#fff01f", "#bf5fff"][
      Math.floor(Math.random() * 5)
    ],
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[60px]">
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          initial={{
            opacity: 1,
            x: `${p.x}%`,
            y: "-10%",
            rotate: 0,
          }}
          animate={{
            opacity: 0,
            y: "110%",
            rotate: Math.random() * 720 - 360,
          }}
          transition={{
            duration: 2 + Math.random(),
            delay: p.delay,
            ease: "easeIn",
          }}
          className="absolute w-2 h-3 rounded-sm"
          style={{ backgroundColor: p.color }}
        />
      ))}
    </div>
  );
}
