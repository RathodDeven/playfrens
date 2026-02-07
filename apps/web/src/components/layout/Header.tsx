import { ConnectButton } from "@rainbow-me/rainbowkit";
import { motion } from "motion/react";

export function Header({
  roomId,
  onLeaveRoom,
}: {
  roomId: string | null;
  onLeaveRoom: () => void;
}) {
  return (
    <header className="flex items-center justify-between px-6 py-4 glass">
      <motion.div
        className="flex items-center gap-3"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <span className="text-2xl font-black bg-gradient-to-r from-neon-green via-neon-blue to-neon-pink bg-clip-text text-transparent">
          PlayFrens
        </span>
        {roomId && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="px-3 py-1 rounded-full bg-surface-light text-sm text-neon-blue font-mono"
          >
            Room: {roomId}
          </motion.span>
        )}
      </motion.div>

      <div className="flex items-center gap-4">
        {roomId && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onLeaveRoom}
            className="px-4 py-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm font-semibold"
          >
            Leave Table
          </motion.button>
        )}
        <ConnectButton
          showBalance={false}
          chainStatus="none"
          accountStatus="avatar"
        />
      </div>
    </header>
  );
}
