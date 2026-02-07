import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { WagmiProvider } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { config } from "../lib/wagmi";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          initialChain={baseSepolia}
          theme={darkTheme({
            accentColor: "#39ff14",
            accentColorForeground: "#0d0e1a",
            borderRadius: "large",
          })}
        >
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 4000,
              style: {
                background: "#1a1b2e",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "12px",
                fontSize: "14px",
              },
              error: {
                style: {
                  background: "#1a1b2e",
                  border: "1px solid rgba(239,68,68,0.3)",
                  color: "#f87171",
                },
                iconTheme: {
                  primary: "#f87171",
                  secondary: "#1a1b2e",
                },
              },
              success: {
                style: {
                  background: "#1a1b2e",
                  border: "1px solid rgba(57,255,20,0.3)",
                  color: "#39ff14",
                },
                iconTheme: {
                  primary: "#39ff14",
                  secondary: "#1a1b2e",
                },
              },
            }}
          />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
