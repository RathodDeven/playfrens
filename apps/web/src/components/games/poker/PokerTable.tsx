import type {
  HandResult,
  PokerAction,
  PokerPlayerState,
  SeatState,
} from "@playfrens/shared";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { HandHistoryEntry } from "../../../hooks/useGameState";
import { formatYusd } from "../../../lib/format";
import { ActionBar } from "./ActionBar";
import { CommunityCards } from "./CommunityCards";
import { HandHistory } from "./HandHistory";
import { PlayerModal } from "./PlayerModal";
import { PlayerSeat } from "./PlayerSeat";
import { PotDisplay } from "./PotDisplay";

// 4-seat positions: bottom (hero), left, top, right — percentage-based
const seatPositions = [
  { top: "82%", left: "50%", transform: "translate(-50%, -50%)" }, // 0: bottom center (hero)
  { top: "50%", left: "3%", transform: "translate(0, -50%)" }, // 1: left center
  { top: "8%", left: "50%", transform: "translate(-50%, 0)" }, // 2: top center
  { top: "50%", left: "97%", transform: "translate(-100%, -50%)" }, // 3: right center
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
  const [showHistory, setShowHistory] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState<SeatState | null>(null);

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

  const isHeroTurn =
    gameState.isHandInProgress && gameState.currentPlayerSeat === heroSeatIndex;

  const chipUnit = gameState.chipUnit || 1;

  // Compute total pot for result display
  const totalPot = lastHandResult?.pots?.reduce((s, p) => s + p.amount, 0) ?? 0;

  // Only host (seat 0) can start hands — show button only for first hand
  const canStartHand =
    !gameState.isHandInProgress &&
    gameState.seats.length >= 2 &&
    heroSeatIndex === 0 &&
    !lastHandResult;

  // Single-player guard: if only 1 seat, show waiting message instead of "Next hand starting"
  const waitingForPlayers =
    !gameState.isHandInProgress && lastHandResult && gameState.seats.length < 2;

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col overflow-hidden">
      {/* Table area */}
      <div className="flex-1 relative flex items-center justify-center p-4">
        {/* Felt table */}
        <div className="relative w-full max-w-5xl aspect-[16/9] felt rounded-[50px] border-[5px] border-amber-800/70 shadow-2xl">
          {/* Inner border glow */}
          <div className="absolute inset-[3px] rounded-[46px] border border-amber-700/20 pointer-events-none" />

          {/* PlayFrens logo center */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
            <p className="text-white/[0.06] text-4xl font-black tracking-widest select-none">
              PlayFrens
            </p>
          </div>

          {/* Community Cards */}
          <div className="absolute top-[38%] left-1/2 -translate-x-1/2 -translate-y-1/2">
            <CommunityCards cards={gameState.communityCards} />
          </div>

          {/* Pot — below community cards */}
          <div className="absolute top-[58%] left-1/2 -translate-x-1/2 -translate-y-1/2">
            <PotDisplay pots={gameState.pots} chipUnit={chipUnit} />
          </div>

          {/* Player Seats — hero rotation */}
          <AnimatePresence>
            {gameState.seats.map((seat) => {
              const positionIndex = (seat.seatIndex - heroSeatIndex + 4) % 4;
              // Show showdown cards when hand result is displayed
              const showdownEntry =
                lastHandResult && !gameState.isHandInProgress
                  ? lastHandResult.showdownCards?.find(
                      (sc) => sc.seatIndex === seat.seatIndex,
                    )
                  : undefined;
              return (
                <div
                  key={seat.seatIndex}
                  className="absolute z-10"
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
                    showdownCards={showdownEntry?.cards}
                    chipUnit={chipUnit}
                    isHandInProgress={gameState.isHandInProgress}
                    onClick={() => setSelectedSeat(seat)}
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
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              transition={{ type: "spring", damping: 12 }}
              onClick={onStartHand}
              disabled={isSigningSession}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 px-10 py-4 rounded-2xl bg-gradient-to-r from-neon-green to-neon-blue text-black font-black text-xl shadow-lg glow-green disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 rounded-2xl px-8 py-5 text-center shadow-2xl bg-black/70 backdrop-blur-md border border-neon-green/30"
              >
                {totalPot > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-center gap-1.5 text-amber-400 font-mono text-sm mb-2"
                  >
                    <svg
                      width="14"
                      height="14"
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
                    <span>
                      Pot: {totalPot} ({formatYusd(totalPot * chipUnit)}{" "}
                      ytest.usd)
                    </span>
                  </motion.div>
                )}
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
                          ? "You won!"
                          : `${winnerName} wins!`}
                      </motion.p>
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="flex items-center justify-center gap-1.5 text-neon-yellow font-mono text-lg font-bold"
                      >
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
                        <span>+{winAmount}</span>
                      </motion.div>
                      <p className="text-white/50 font-mono text-sm">
                        {formatYusd(winAmount * chipUnit)} ytest.usd
                      </p>
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
                  {waitingForPlayers
                    ? "Waiting for players..."
                    : "Next hand starting..."}
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Confetti */}
          {showConfetti && <Confetti />}

          {/* Hand History toggle button */}
          {handHistory.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="absolute top-3 right-3 z-20 px-3 py-1.5 rounded-lg bg-black/50 backdrop-blur text-xs font-bold text-white/50 hover:text-white/80 transition-colors border border-white/10"
            >
              History ({handHistory.length})
            </button>
          )}
        </div>

        {/* Hand History overlay */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="absolute right-2 top-2 z-30"
            >
              <HandHistory
                entries={handHistory}
                chipUnit={chipUnit}
                heroSeatIndex={heroSeatIndex}
                onClose={() => setShowHistory(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom action bar — docked */}
      <div className="h-16 shrink-0 flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm border-t border-white/5">
        {isHeroTurn ? (
          <ActionBar
            legalActions={gameState.legalActions}
            onAction={onAction}
            chipUnit={chipUnit}
            totalPot={
              gameState.pots.reduce((s, p) => s + p.amount, 0) +
              gameState.seats.reduce((s, seat) => s + seat.betAmount, 0)
            }
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

      {/* Player detail modal */}
      <PlayerModal
        seat={selectedSeat}
        chipUnit={chipUnit}
        isOpen={!!selectedSeat}
        onClose={() => setSelectedSeat(null)}
      />
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
    <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[50px]">
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
