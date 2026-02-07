import { useCallback, useEffect, useMemo, useState } from "react";
import { useWalletClient } from "wagmi";
import { requestFaucetTokens } from "../lib/yellow";
import { YellowRpcClient } from "../lib/yellowRpc";

export function useYellow(address?: string) {
  const [balance, setBalance] = useState<string>("0");
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const { data: walletClient } = useWalletClient();

  const client = useMemo(() => {
    if (!walletClient || !address) return null;
    return new YellowRpcClient(walletClient, address as `0x${string}`);
  }, [walletClient, address]);

  useEffect(() => {
    return () => {
      client?.disconnect();
    };
  }, [client]);

  useEffect(() => {
    setIsAuthorized(false);
    setBalance("0");
  }, [address]);

  const authorize = useCallback(async () => {
    if (!client) throw new Error("Wallet not ready");
    setIsAuthorizing(true);
    try {
      await client.authorize();
      setIsAuthorized(true);
    } finally {
      setIsAuthorizing(false);
    }
  }, [client]);

  const fetchBalance = useCallback(async () => {
    if (!address || !client) return;
    if (!isAuthorized) return;
    setIsLoading(true);
    try {
      const balances = await client.getLedgerBalances();
      const match =
        balances.find((b) => b.asset === "ytest.usd") ??
        balances.find((b) => b.asset === "usdc");
      setBalance(match?.amount ?? "0");
    } catch (err) {
      console.error("Failed to fetch Yellow balance:", err);
    } finally {
      setIsLoading(false);
    }
  }, [address, client, isAuthorized]);

  useEffect(() => {
    if (client && isAuthorized) {
      fetchBalance();
    }
  }, [fetchBalance, client, isAuthorized]);

  return {
    balance,
    isLoading,
    isAuthorized,
    isAuthorizing,
    refetchBalance: fetchBalance,
    authorize,
    requestTokens: async () => {
      if (!address) throw new Error("Wallet not connected");
      await requestFaucetTokens(address);
    },
  };
}
