import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { baseSepolia, mainnet } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "PlayFrens",
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "demo",
  chains: [baseSepolia, mainnet],
  transports: {
    [baseSepolia.id]: http(
      import.meta.env.VITE_BASE_SEPOLIA_RPC_URL ||
        "https://sepolia.base.org",
    ),
    [mainnet.id]: http(),
  },
});
