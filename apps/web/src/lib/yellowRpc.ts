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

export class YellowRpcClient {
  private ws: WebSocket | null = null;
  private authenticated = false;
  private pending = new Map<string, PendingRequest>();
  private connectPromise: Promise<void> | null = null;
  private sessionPrivateKey: `0x${string}`;
  private sessionSigner: ReturnType<typeof createECDSAMessageSigner>;

  // Auth state (event-driven, like server)
  private authResolve: (() => void) | null = null;
  private authReject: ((err: Error) => void) | null = null;
  private authTimeout: NodeJS.Timeout | null = null;
  private authParams: AuthParams | null = null;

  constructor(
    private walletClient: WalletClient,
    private address: `0x${string}`,
  ) {
    // Always generate a fresh session key — never persist
    this.sessionPrivateKey = generatePrivateKey() as `0x${string}`;
    this.sessionSigner = createECDSAMessageSigner(this.sessionPrivateKey);
  }

  async authorize(): Promise<void> {
    await this.ensureConnected();
    if (this.authenticated) return;

    return new Promise<void>(async (resolve, reject) => {
      this.authResolve = resolve;
      this.authReject = reject;

      // Set auth timeout
      this.authTimeout = setTimeout(() => {
        if (!this.authenticated) {
          const error = new Error("Auth timed out");
          console.error("[Yellow] Auth timed out");
          this.authReject?.(error);
          this.authReject = null;
          this.authResolve = null;
        }
      }, 15000);

      try {
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

        console.log("[Yellow] Sending auth_request", {
          address: this.address,
          session_key: authParams.session_key,
          application: APP_NAME,
          scope: authParams.scope,
        });

        this.ws?.send(authRequest);
      } catch (err) {
        if (this.authTimeout) {
          clearTimeout(this.authTimeout);
          this.authTimeout = null;
        }
        this.authResolve = null;
        this.authReject = null;
        reject(err);
      }
    });
  }

  private rotateSessionKey(): void {
    this.sessionPrivateKey = generatePrivateKey() as `0x${string}`;
    this.sessionSigner = createECDSAMessageSigner(this.sessionPrivateKey);
    console.log("[Yellow] Rotated to new session key");
  }

  async getLedgerBalances(): Promise<Array<{ asset: string; amount: string }>> {
    await this.authorize();

    try {
      return await this._fetchLedgerBalances();
    } catch (err: any) {
      // If auth-related error, re-authorize and retry once
      const msg = err?.message?.toLowerCase() ?? "";
      if (
        msg.includes("auth") ||
        msg.includes("expired") ||
        msg.includes("unauthorized")
      ) {
        console.log(
          "[Yellow] Auth error in getLedgerBalances, re-authorizing...",
        );
        this.authenticated = false;
        this.rotateSessionKey();
        this.disconnect();
        await this.authorize();
        return await this._fetchLedgerBalances();
      }
      throw err;
    }
  }

  private async _fetchLedgerBalances(): Promise<
    Array<{ asset: string; amount: string }>
  > {
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

  /**
   * Sign a raw RPC request payload locally using the session key.
   * Does NOT send anything to Clearnode — the server collects all signatures
   * and sends a single multi-sig message.
   */
  async signPayload(payload: any[]): Promise<string> {
    // Ensure authorized so Clearnode knows our session key mapping
    await this.authorize();
    console.log("[Yellow] Signing payload locally with session key");
    const signature = await this.sessionSigner(payload as [any, any, any]);
    console.log("[Yellow] Payload signed:", signature.slice(0, 20) + "...");
    return signature;
  }

  disconnect(): void {
    if (this.authTimeout) {
      clearTimeout(this.authTimeout);
      this.authTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.authenticated = false;
    this.pending.clear();
    this.connectPromise = null;
    this.authResolve = null;
    this.authReject = null;
  }

  private async ensureConnected(): Promise<void> {
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        console.log("[Yellow] Connected to Clearnode");
        resolve();
      };
      this.ws.onerror = () => {
        this.connectPromise = null;
        reject(new Error("Failed to connect to Clearnode"));
      };
      this.ws.onclose = () => {
        console.log("[Yellow] Disconnected from Clearnode");
        this.authenticated = false;
        this.connectPromise = null;
      };
      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    });

    return this.connectPromise;
  }

  private handleMessage(data: any): void {
    try {
      const message = JSON.parse(
        typeof data === "string" ? data : data.toString(),
      );
      const method = message?.res?.[1];
      const result = message?.res?.[2];

      if (!method) return;

      console.log("[Yellow] Received:", method, result);

      // Handle auth challenge — sign and send verify (event-driven, like server)
      if (method === "auth_challenge") {
        const challengeMessage =
          result?.challenge_message ?? result?.challenge ?? "";
        if (challengeMessage) {
          void this.handleAuthChallenge(challengeMessage);
        } else {
          console.error("[Yellow] Empty auth challenge received");
          this.authReject?.(new Error("Empty auth challenge"));
          this.authReject = null;
          this.authResolve = null;
        }
        return;
      }

      // Handle auth verify response
      if (method === "auth_verify") {
        if (result?.success) {
          this.authenticated = true;
          console.log("[Yellow] Authenticated successfully");
          if (this.authTimeout) {
            clearTimeout(this.authTimeout);
            this.authTimeout = null;
          }
          this.authResolve?.();
        } else {
          const error = new Error(result?.error ?? "Authentication failed");
          console.error("[Yellow] Auth failed:", error.message);
          if (this.authTimeout) {
            clearTimeout(this.authTimeout);
            this.authTimeout = null;
          }
          this.authReject?.(error);
        }
        this.authResolve = null;
        this.authReject = null;
        return;
      }

      // Handle error responses — reject any pending waiters
      if (method === "error") {
        const errorMsg = result?.error ?? "Unknown Clearnode error";
        console.error("[Yellow] Error from Clearnode:", errorMsg);

        // If we're waiting for auth, reject the auth promise
        if (this.authResolve || this.authReject) {
          if (this.authTimeout) {
            clearTimeout(this.authTimeout);
            this.authTimeout = null;
          }
          this.authReject?.(new Error(errorMsg));
          this.authResolve = null;
          this.authReject = null;
          return;
        }

        // Reject all pending waiters
        for (const [key, pending] of this.pending.entries()) {
          this.pending.delete(key);
          pending.reject(new Error(errorMsg));
        }
        return;
      }

      // Handle other method responses via pending map
      const pending = this.pending.get(method);
      if (pending) {
        this.pending.delete(method);
        pending.resolve(result);
      }
    } catch (err) {
      console.error("[Yellow] Failed to parse message:", err);
    }
  }

  private async handleAuthChallenge(challenge: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (!this.authParams) return;

    try {
      const signer = createEIP712AuthMessageSigner(
        this.walletClient,
        this.authParams,
        { name: APP_NAME },
      );

      console.log("[Yellow] Signing auth challenge");

      const verifyMsg = await createAuthVerifyMessageFromChallenge(
        signer,
        challenge,
      );

      this.ws?.send(verifyMsg);
      console.log("[Yellow] Sent auth_verify");
    } catch (err) {
      console.error("[Yellow] Failed to sign auth challenge:", err);
      if (this.authTimeout) {
        clearTimeout(this.authTimeout);
        this.authTimeout = null;
      }
      this.authReject?.(err instanceof Error ? err : new Error(String(err)));
      this.authReject = null;
      this.authResolve = null;
    }
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
