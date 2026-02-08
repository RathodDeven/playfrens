import { http, type Hex, type WalletClient, createWalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

export function createServerWallet(privateKey: Hex): WalletClient {
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL),
  });
}

export function getServerAddress(privateKey: Hex): string {
  const account = privateKeyToAccount(privateKey);
  return account.address;
}

export interface AuthChallenge {
  challenge: string;
}

export async function signAuthChallenge(
  wallet: WalletClient,
  challenge: string,
): Promise<string> {
  if (!wallet.account) throw new Error("Wallet has no account");
  return wallet.signMessage({
    account: wallet.account,
    message: challenge,
  });
}
