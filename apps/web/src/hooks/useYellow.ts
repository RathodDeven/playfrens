import { useCallback, useEffect, useState } from "react";
import { getYellowBalance } from "../lib/yellow";

export function useYellow(address?: string) {
  const [balance, setBalance] = useState<string>("0");
  const [isLoading, setIsLoading] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);
    try {
      const bal = await getYellowBalance(address);
      setBalance(bal);
    } catch (err) {
      console.error("Failed to fetch Yellow balance:", err);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return {
    balance,
    isLoading,
    refetchBalance: fetchBalance,
  };
}
