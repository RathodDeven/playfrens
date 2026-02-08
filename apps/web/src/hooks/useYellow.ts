import { fromOnChainAmount } from "@playfrens/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWalletClient } from "wagmi";
import { requestFaucetTokens } from "../lib/yellow";
import { YellowRpcClient } from "../lib/yellowRpc";

export function useYellow(address?: string) {
  const [balance, setBalance] = useState<string>("0");
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const { data: walletClient } = useWalletClient();
  const authAttempted = useRef(false);

  const client = useMemo(() => {
    if (!walletClient || !address) return null;
    return new YellowRpcClient(walletClient, address as `0x${string}`);
  }, [walletClient, address]);

  useEffect(() => {
    return () => {
      client?.disconnect();
    };
  }, [client]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset state when address changes
  useEffect(() => {
    setIsAuthorized(false);
    setBalance("0");
    setAuthError(null);
    authAttempted.current = false;
  }, [address]);

  // Auto-authorize when client becomes available
  useEffect(() => {
    if (!client || authAttempted.current) return;
    authAttempted.current = true;

    let cancelled = false;
    setIsAuthorizing(true);
    setAuthError(null);

    client
      .authorize()
      .then(() => {
        if (!cancelled) {
          setIsAuthorized(true);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("[Yellow] Auto-authorize failed:", err);
          setAuthError(err?.message ?? "Authorization failed");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsAuthorizing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [client]);

  const retryAuth = useCallback(async () => {
    if (!client) throw new Error("Wallet not ready");
    setIsAuthorizing(true);
    setAuthError(null);
    try {
      await client.authorize();
      setIsAuthorized(true);
    } catch (err: any) {
      setAuthError(err?.message ?? "Authorization failed");
      throw err;
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
      setBalance(String(fromOnChainAmount(match?.amount ?? "0")));
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
    client,
    balance,
    isLoading,
    isAuthorized,
    isAuthorizing,
    authError,
    retryAuth,
    refetchBalance: fetchBalance,
    requestTokens: async () => {
      if (!address) throw new Error("Wallet not connected");
      await requestFaucetTokens(address);
    },
  };
}
