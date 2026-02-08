import { ConnectButton } from "@rainbow-me/rainbowkit";
import { motion } from "motion/react";
import { useState } from "react";
import toast from "react-hot-toast";
import { soundManager } from "../../lib/sounds";

function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback for non-HTTPS contexts
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
  return Promise.resolve();
}

export function Header({
  roomId,
  onLeaveRoom,
  isHandInProgress,
  onLeaveNextHand,
  isLeaveNextHand,
}: {
  roomId: string | null;
  onLeaveRoom: () => void;
  isHandInProgress?: boolean;
  onLeaveNextHand?: () => void;
  isLeaveNextHand?: boolean;
}) {
  const [muted, setMuted] = useState(soundManager.isMuted);

  const handleMuteToggle = () => {
    const newMuted = soundManager.toggleMute();
    setMuted(newMuted);
  };

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-black/40 backdrop-blur-sm border-b border-white/5 h-14">
      <motion.div
        className="flex items-center gap-2"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <span className="text-lg font-black bg-gradient-to-r from-neon-green via-neon-blue to-neon-pink bg-clip-text text-transparent">
          PlayFrens
        </span>
        {roomId && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2"
          >
            {/* Room code + copy code */}
            <button
              type="button"
              onClick={() => {
                copyToClipboard(roomId).then(
                  () => toast.success("Room code copied!", { duration: 2000 }),
                  () => toast.error("Failed to copy"),
                );
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-light hover:bg-white/10 transition-colors group"
              title="Copy room code"
            >
              <span className="text-xs text-neon-blue font-mono font-bold">
                {roomId}
              </span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="text-white/30 group-hover:text-white/60 transition-colors"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>

            {/* Copy invite link */}
            <button
              type="button"
              onClick={() => {
                const url = `${window.location.origin}?code=${roomId}`;
                copyToClipboard(url).then(
                  () =>
                    toast.success("Invite link copied!", { duration: 2000 }),
                  () => toast.error("Failed to copy"),
                );
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neon-blue/10 hover:bg-neon-blue/20 transition-colors text-neon-blue"
              title="Copy invite link"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              <span className="text-xs font-semibold">Copy Link</span>
            </button>
          </motion.div>
        )}
      </motion.div>

      <div className="flex items-center gap-2">
        {/* Mute toggle */}
        <button
          type="button"
          onClick={handleMuteToggle}
          className="p-1.5 rounded-lg text-white/40 hover:text-white/70 transition-colors"
          title={muted ? "Unmute sounds" : "Mute sounds"}
        >
          {muted ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          )}
        </button>

        {/* Leave / Leave After Hand */}
        {roomId && isHandInProgress && onLeaveNextHand && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={isLeaveNextHand ? undefined : onLeaveNextHand}
            disabled={isLeaveNextHand}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              isLeaveNextHand
                ? "bg-amber-500/10 text-amber-400/50 cursor-not-allowed"
                : "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
            }`}
          >
            {isLeaveNextHand ? "Leaving..." : "Leave After Hand"}
          </motion.button>
        )}
        {roomId && !(isHandInProgress && onLeaveNextHand) && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onLeaveRoom}
            className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-xs font-semibold"
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
