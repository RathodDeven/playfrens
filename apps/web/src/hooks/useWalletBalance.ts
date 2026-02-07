import { CONTRACTS } from "@playfrens/shared";
import { baseSepolia } from "wagmi/chains";
import { useBalance } from "wagmi";

export function useWalletBalance(address?: `0x${string}`) {
  const { data, isLoading, refetch } = useBalance({
    address,
    token: CONTRACTS.TOKEN,
    chainId: baseSepolia.id,
    watch: true,
    enabled: Boolean(address),
  });

  return {
    balance: data?.formatted ?? "0",
    isLoading,
    refetch,
  };
}
