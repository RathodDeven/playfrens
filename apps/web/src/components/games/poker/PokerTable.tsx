import type {
  HandResult,
  PokerAction,
  PokerPlayerState,
} from "@playfrens/shared";
import { REACTIONS } from "@playfrens/shared";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { formatYusd } from "../../../lib/format";
import type { HandHistoryEntry } from "../../../hooks/useGameState";
import { ActionBar } from "./ActionBar";
import { CommunityCards } from "./CommunityCards";
import { HandHistory } from "./HandHistory";
import { PlayerSeat } from "./PlayerSeat";
import { PotDisplay } from "./PotDisplay";

// 4-seat positions: bottom (hero), left, top, right
const seatPositions = [
  { top: "85%", left: "50%", transform: "translate(-50%, -50%)" }, // 0: bottom center (hero)
  { top: "50%", left: "5%", transform: "translate(0, -50%)" },    // 1: left center
  { top: "5%", left: "50%", transform: "translate(-50%, 0)" },    // 2: top center
  { top: "50%", left: "95%", transform: "translate(-100%, -50%)" }, // 3: right center
];

export function PokerTable({
  gameState,
  lastHandResult,
  handHistory,
  heroSeatIndex,
  onAction,
  onStartHand,
  onReaction,
}: {
  gameState: PokerPlayerState;
  lastHandResult: HandResult | null;
  handHistory: HandHistoryEntry[];
  heroSeatIndex: number;
  onAction: (action: PokerAction, betSize?: number) => void;
  onStartHand: () => void;
  onReaction: (reaction: string) => void;
}) {
  const [showConfetti, setShowConfetti] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<
    Array<{ id: number; reaction: string; x: number }>
  >([]);

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

  // Only host (seat 0) can start hands
  const canStartHand =
    !gameState.isHandInProgress &&
    gameState.seats.length >= 2 &&
    heroSeatIndex === 0;

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

          {/* Deck visual at center — shows during hand */}
          {gameState.isHandInProgress && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute top-[28%] left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
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
          <div className="absolute top-[38%] left-1/2 -translate-x-1/2 -translate-y-1/2">
            <CommunityCards cards={gameState.communityCards} />
          </div>

          {/* Pot */}
          <div className="absolute top-[55%] left-1/2 -translate-x-1/2 -translate-y-1/2">
            <PotDisplay pots={gameState.pots} chipUnit={chipUnit} />
          </div>

          {/* Player Seats — hero rotation */}
          <AnimatePresence>
            {gameState.seats.map((seat) => {
              const positionIndex =
                (seat.seatIndex - heroSeatIndex + 4) % 4;
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
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-8 py-4 rounded-2xl bg-gradient-to-r from-neon-green to-neon-blue text-black font-black text-xl shadow-lg glow-green"
            >
              Deal Cards!
            </motion.button>
          )}

          {/* Hand result overlay */}
          <AnimatePresence>
            {lastHandResult && !gameState.isHandInProgress && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute top-[25%] left-1/2 -translate-x-1/2 glass rounded-2xl px-6 py-4 text-center"
              >
                {lastHandResult.winners.map((w) => (
                  <div key={w.seatIndex}>
                    <p className="text-neon-green font-bold text-lg">
                      {w.seatIndex === heroSeatIndex
                        ? "You won! Big brain move!"
                        : `Seat ${w.seatIndex} wins!`}
                    </p>
                    <p className="text-neon-yellow font-mono">
                      +{w.amount} chips ({formatYusd(w.amount * chipUnit)} ytest.usd)
                    </p>
                    {w.hand && (
                      <p className="text-white/50 text-sm">{w.hand}</p>
                    )}
                  </div>
                ))}
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
      <div className="p-4 glass">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          {/* Reactions */}
          <div className="flex gap-2">
            {REACTIONS.map((r) => (
              <motion.button
                key={r}
                whileHover={{ scale: 1.3 }}
                whileTap={{ scale: 0.8 }}
                onClick={() => {
                  onReaction(r);
                  const id = Date.now();
                  setFloatingReactions((prev) => [
                    ...prev,
                    { id, reaction: r, x: Math.random() * 100 },
                  ]);
                  setTimeout(
                    () =>
                      setFloatingReactions((prev) =>
                        prev.filter((fr) => fr.id !== id),
                      ),
                    2000,
                  );
                }}
                className="text-2xl hover:bg-white/10 rounded-lg p-1 transition-colors"
              >
                {r}
              </motion.button>
            ))}
          </div>

          {/* Action bar */}
          {isHeroTurn && (
            <ActionBar
              legalActions={gameState.legalActions}
              onAction={onAction}
              chipUnit={chipUnit}
            />
          )}

          {/* Status */}
          {!isHeroTurn && gameState.isHandInProgress && (
            <p className="text-white/40 text-sm">
              Waiting for{" "}
              {gameState.seats.find(
                (s) => s.seatIndex === gameState.currentPlayerSeat,
              )?.ensName || "opponent"}
              ...
            </p>
          )}
        </div>
      </div>

      {/* Floating reactions */}
      <AnimatePresence>
        {floatingReactions.map((fr) => (
          <motion.div
            key={fr.id}
            initial={{ opacity: 1, y: 0, x: `${fr.x}vw` }}
            animate={{ opacity: 0, y: -200 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2 }}
            className="fixed bottom-20 text-4xl pointer-events-none"
          >
            {fr.reaction}
          </motion.div>
        ))}
      </AnimatePresence>
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
