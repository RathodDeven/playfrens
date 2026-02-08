import { CustodyAbi, Erc20Abi } from "@erc7824/nitrolite";
import { CONTRACTS } from "@playfrens/shared";
import { useCallback, useEffect, useState } from "react";
import { type Address, formatUnits, parseUnits } from "viem";
import { baseSepolia } from "viem/chains";
import { usePublicClient, useWalletClient } from "wagmi";

const CUSTODY_ADDRESS = CONTRACTS.CUSTODY as Address;
const TOKEN_ADDRESS = CONTRACTS.TOKEN as Address;
const TOKEN_DECIMALS = 6; // ytest.usd uses 6 decimals

export function useCustody(address?: Address) {
  const { data: walletClient } = useWalletClient({ chainId: baseSepolia.id });
  const publicClient = usePublicClient({ chainId: baseSepolia.id });
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [custodyBalance, setCustodyBalance] = useState("0");

  const fetchCustodyBalance = useCallback(async () => {
    if (!publicClient || !address) return;
    try {
      const result = await publicClient.readContract({
        address: CUSTODY_ADDRESS,
        abi: CustodyAbi,
        functionName: "getAccountsBalances",
        args: [[address], [TOKEN_ADDRESS]],
      });
      // result is bigint[][] — result[0][0] for single user/token
      const raw = (result as bigint[][])[0][0];
      setCustodyBalance(formatUnits(raw, TOKEN_DECIMALS));
    } catch {
      setCustodyBalance("0");
    }
  }, [publicClient, address]);

  useEffect(() => {
    fetchCustodyBalance();
  }, [fetchCustodyBalance]);

  const deposit = useCallback(
    async (amount: string) => {
      if (!walletClient || !publicClient || !address) {
        throw new Error("Wallet not connected");
      }

      setIsDepositing(true);
      try {
        const parsedAmount = parseUnits(amount, TOKEN_DECIMALS);

        // Check current allowance
        const allowance = await publicClient.readContract({
          address: TOKEN_ADDRESS,
          abi: Erc20Abi,
          functionName: "allowance",
          args: [address, CUSTODY_ADDRESS],
        });

        // Approve if needed
        if ((allowance as bigint) < parsedAmount) {
          const approveTx = await walletClient.writeContract({
            address: TOKEN_ADDRESS,
            abi: Erc20Abi,
            functionName: "approve",
            args: [CUSTODY_ADDRESS, parsedAmount],
            chain: baseSepolia,
            account: address,
          });
          await publicClient.waitForTransactionReceipt({ hash: approveTx });
        }

        // Deposit to Custody
        const depositTx = await walletClient.writeContract({
          address: CUSTODY_ADDRESS,
          abi: CustodyAbi,
          functionName: "deposit",
          args: [address, TOKEN_ADDRESS, parsedAmount],
          chain: baseSepolia,
          account: address,
        });
        await publicClient.waitForTransactionReceipt({ hash: depositTx });
        await fetchCustodyBalance();
      } finally {
        setIsDepositing(false);
      }
    },
    [walletClient, publicClient, address, fetchCustodyBalance],
  );

  const withdraw = useCallback(
    async (amount: string) => {
      if (!walletClient || !publicClient || !address) {
        throw new Error("Wallet not connected");
      }

      setIsWithdrawing(true);
      try {
        const parsedAmount = parseUnits(amount, TOKEN_DECIMALS);

        const withdrawTx = await walletClient.writeContract({
          address: CUSTODY_ADDRESS,
          abi: CustodyAbi,
          functionName: "withdraw",
          args: [TOKEN_ADDRESS, parsedAmount],
          chain: baseSepolia,
          account: address,
        });
        await publicClient.waitForTransactionReceipt({ hash: withdrawTx });
        await fetchCustodyBalance();
      } finally {
        setIsWithdrawing(false);
      }
    },
    [walletClient, publicClient, address, fetchCustodyBalance],
  );

  return {
    deposit,
    withdraw,
    isDepositing,
    isWithdrawing,
    custodyBalance,
    refetchCustodyBalance: fetchCustodyBalance,
  };
}
