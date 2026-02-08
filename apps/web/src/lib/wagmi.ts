import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { baseSepolia, sepolia } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "PlayFrens",
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "demo",
  // Base Sepolia first = default chain. Sepolia included for ENS resolution.
  // Chain selector is hidden in the ConnectButton (chainStatus="none").
  chains: [baseSepolia, sepolia],
  transports: {
    [baseSepolia.id]: http(
      import.meta.env.VITE_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
    ),
    [sepolia.id]: http(),
  },
});
