import { CLEARNODE_WS_URL } from "@playfrens/shared";

const WS_URL = import.meta.env.VITE_CLEARNODE_WS_URL || CLEARNODE_WS_URL;
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

export async function getYellowBalance(address: string): Promise<string> {
  const response = await fetch(
    `${SERVER_URL}/yellow/ledger-balance/${address}?asset=ytest.usd`,
  );
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to fetch Yellow balance");
  }
  const data = (await response.json()) as { balance?: string };
  return data.balance ?? "0";
}

export async function requestFaucetTokens(address: string): Promise<void> {
  const response = await fetch(
    "https://clearnet-sandbox.yellow.com/faucet/requestTokens",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userAddress: address }),
    },
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Faucet request failed");
  }
}

export { WS_URL as YELLOW_WS_URL };
