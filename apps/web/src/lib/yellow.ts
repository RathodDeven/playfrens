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
