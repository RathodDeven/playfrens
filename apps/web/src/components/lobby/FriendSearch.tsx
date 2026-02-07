import { useState } from "react";
import { useEnsAddress, useEnsAvatar, useEnsName } from "wagmi";
import { normalize } from "viem/ens";
import { mainnet } from "wagmi/chains";
import { motion, AnimatePresence } from "motion/react";

export function FriendSearch({
  onInvite,
}: {
  onInvite: (address: string, ensName?: string) => void;
}) {
  const [query, setQuery] = useState("");
  const isEnsName = query.includes(".");

  const { data: resolvedAddress, isLoading } = useEnsAddress({
    name: isEnsName ? normalize(query) : undefined,
    chainId: mainnet.id,
  });

  const displayAddress = isEnsName ? resolvedAddress : undefined;

  return (
    <div className="space-y-3">
      <label className="text-sm font-semibold text-white/60">
        Find a fren by ENS
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="vitalik.eth"
          className="flex-1 px-4 py-3 rounded-xl bg-surface-light border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-neon-blue transition-colors"
        />
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            if (displayAddress) {
              onInvite(displayAddress, query);
            }
          }}
          disabled={!displayAddress || isLoading}
          className="px-6 py-3 rounded-xl bg-neon-blue/20 text-neon-blue font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neon-blue/30 transition-colors"
        >
          Invite
        </motion.button>
      </div>

      <AnimatePresence>
        {isLoading && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-sm text-white/40"
          >
            Resolving...
          </motion.p>
        )}
        {displayAddress && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neon-green/10"
          >
            <span className="text-neon-green text-sm">Found:</span>
            <span className="text-xs font-mono text-white/70">
              {displayAddress.slice(0, 6)}...{displayAddress.slice(-4)}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
