import {
  createAuthRequestMessage,
  createAuthVerifyMessageFromChallenge,
  createECDSAMessageSigner,
  createEIP712AuthMessageSigner,
  createGetLedgerBalancesMessage,
} from "@erc7824/nitrolite";
import { CLEARNODE_WS_URL } from "@playfrens/shared";
import type { WalletClient } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const WS_URL = import.meta.env.VITE_CLEARNODE_WS_URL || CLEARNODE_WS_URL;
const APP_NAME = import.meta.env.VITE_CLEARNODE_APPLICATION || "PlayFrens";
const APP_SCOPE = import.meta.env.VITE_CLEARNODE_SCOPE || "playfrens.app";

const DEFAULT_ALLOWANCES = [
  {
    asset: "ytest.usd",
    amount: "1000000000",
  },
];

type AuthParams = {
  session_key: `0x${string}`;
  allowances: Array<{ asset: string; amount: string }>;
  expires_at: bigint;
  scope: string;
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

function sessionKeyStorageKey(address: string): string {
  return `playfrens.yellow.sessionKey.${address.toLowerCase()}`;
}

function loadSessionKey(address: string): `0x${string}` | null {
  const raw = localStorage.getItem(sessionKeyStorageKey(address));
  if (!raw || !raw.startsWith("0x")) return null;
  return raw as `0x${string}`;
}

function saveSessionKey(address: string, key: `0x${string}`): void {
  localStorage.setItem(sessionKeyStorageKey(address), key);
}

export class YellowRpcClient {
  private ws: WebSocket | null = null;
  private authenticated = false;
  private pending = new Map<string, PendingRequest>();
  private connectPromise: Promise<void> | null = null;
  private authParams: AuthParams | null = null;
  private sessionPrivateKey: `0x${string}`;
  private sessionSigner: ReturnType<typeof createECDSAMessageSigner>;

  constructor(
    private walletClient: WalletClient,
    private address: `0x${string}`,
  ) {
    const stored = loadSessionKey(address);
    this.sessionPrivateKey = stored ?? (generatePrivateKey() as `0x${string}`);
    if (!stored) {
      saveSessionKey(address, this.sessionPrivateKey);
    }
    this.sessionSigner = createECDSAMessageSigner(this.sessionPrivateKey);
  }

  async authorize(): Promise<void> {
    await this.ensureConnected();
    if (this.authenticated) return;

    const sessionAccount = privateKeyToAccount(this.sessionPrivateKey);
    const authParams: AuthParams = {
      session_key: sessionAccount.address,
      allowances: DEFAULT_ALLOWANCES,
      expires_at: BigInt(Math.floor(Date.now() / 1000) + 3600),
      scope: APP_SCOPE,
    };
    this.authParams = authParams;

    const authRequest = await createAuthRequestMessage({
      address: this.address,
      application: APP_NAME,
      ...authParams,
    });

    this.ws?.send(authRequest);

    const challenge = await this.waitFor("auth_challenge", 12000);
    const challengeMessage =
      challenge?.challenge_message ?? challenge?.challenge ?? "";
    if (!challengeMessage) {
      throw new Error("Missing auth challenge");
    }

    const signer = createEIP712AuthMessageSigner(
      this.walletClient,
      authParams,
      { name: APP_NAME },
    );

    const verifyMsg = await createAuthVerifyMessageFromChallenge(
      signer,
      challengeMessage,
    );
    this.ws?.send(verifyMsg);

    const verifyResult = await this.waitFor("auth_verify", 12000);
    if (!verifyResult?.success) {
      throw new Error(verifyResult?.error ?? "Authentication failed");
    }

    this.authenticated = true;
  }

  async getLedgerBalances(): Promise<Array<{ asset: string; amount: string }>> {
    await this.authorize();

    const message = await createGetLedgerBalancesMessage(
      this.sessionSigner,
      this.address,
      Date.now(),
    );
    this.ws?.send(message);

    const result = await this.waitFor("get_ledger_balances", 12000);
    const balances =
      result?.ledger_balances ??
      result?.balances ??
      (Array.isArray(result) ? result : []);

    if (!Array.isArray(balances)) {
      throw new Error("Invalid ledger balances response");
    }

    return balances.map((balance: any) => ({
      asset: String(balance.asset ?? ""),
      amount: String(balance.amount ?? "0"),
    }));
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.authenticated = false;
    this.pending.clear();
    this.connectPromise = null;
  }

  private async ensureConnected(): Promise<void> {
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => resolve();
      this.ws.onerror = () => {
        reject(new Error("Failed to connect to Clearnode"));
      };
      this.ws.onclose = () => {
        this.authenticated = false;
        this.connectPromise = null;
      };
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data.toString());
          const method = message?.res?.[1];
          const result = message?.res?.[2];
          if (!method) return;

          const pending = this.pending.get(method);
          if (pending) {
            this.pending.delete(method);
            pending.resolve(result);
          }
        } catch (err) {
          const pending = this.pending.get("error");
          if (pending) {
            this.pending.delete("error");
            pending.reject(err as Error);
          }
        }
      };
    });

    return this.connectPromise;
  }

  private waitFor(method: string, timeoutMs: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(method);
        reject(new Error(`Timeout waiting for ${method}`));
      }, timeoutMs);

      this.pending.set(method, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
    });
  }
}
