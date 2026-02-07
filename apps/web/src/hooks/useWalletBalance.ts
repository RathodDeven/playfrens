import { CONTRACTS } from "@playfrens/shared";
import { useBalance } from "wagmi";
import { baseSepolia } from "wagmi/chains";

export function useWalletBalance(address?: `0x${string}`) {
  const { data, isLoading, refetch } = useBalance({
    address,
    token: CONTRACTS.TOKEN,
    chainId: baseSepolia.id,
    query: { enabled: Boolean(address) },
  });

  return {
    balance: data?.formatted ?? "0",
    isLoading,
    refetch,
  };
}
