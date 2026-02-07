import {
  RPCMethod,
  createAuthRequestMessage,
  createAuthVerifyMessageFromChallenge,
  createEIP712AuthMessageSigner,
} from "@erc7824/nitrolite";
import { CLEARNODE_WS_URL } from "@playfrens/shared";
import { ethers } from "ethers";
import type { WalletClient } from "viem";
import WebSocket from "ws";

type MessageHandler = (data: any) => void;

type AuthParams = {
  session_key: string;
  allowances: Array<{ asset: string; amount: string }>;
  expires_at: bigint;
  scope: string;
};

interface PendingRequest {
  resolve: (v: any) => void;
  reject: (e: Error) => void;
}

export class YellowClient {
  private ws: WebSocket | null = null;
  private wallet: WalletClient;
  private signer: ethers.Wallet;
  private sessionSigner: ethers.Wallet;
  private handlers: Map<string, MessageHandler> = new Map();
  private requestId = 0;
  private pendingRequests: Map<number, PendingRequest> = new Map();
  private authenticated = false;
  private wsUrl: string;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private connectPromise: Promise<void> | null = null;
  private readonly application: string;
  private readonly scope: string;
  private authResolve: (() => void) | null = null;
  private authReject: ((err: Error) => void) | null = null;
  private authTimeout: NodeJS.Timeout | null = null;
  private lastAuthParams: AuthParams | null = null;

  constructor(
    wallet: WalletClient,
    privateKey: string,
    sessionKey?: string,
    wsUrl?: string,
    application = "console",
    scope?: string,
  ) {
    this.wallet = wallet;
    this.signer = new ethers.Wallet(privateKey);
    this.sessionSigner = sessionKey
      ? new ethers.Wallet(sessionKey)
      : ethers.Wallet.createRandom();
    this.wsUrl = wsUrl || CLEARNODE_WS_URL;
    this.application = application;
    this.scope = scope || application;

    if (!sessionKey) {
      console.warn(
        "[Yellow] Using ephemeral session key for Nitro RPC authentication",
      );
    }
  }

  async connect(): Promise<void> {
    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = new Promise((resolve, reject) => {
      if (this.isConnecting) {
        resolve();
        return;
      }

      this.isConnecting = true;
      this.authResolve = resolve;
      this.authReject = reject;

      this.ws = new WebSocket(this.wsUrl);

      this.ws.on("open", async () => {
        console.log("[Yellow] Connected to Clearnode");
        try {
          await this.authenticate();
        } catch (err) {
          this.isConnecting = false;
          this.connectPromise = null;
          this.authReject?.(err as Error);
          this.authReject = null;
          this.authResolve = null;
        }
      });

      this.ws.on("message", (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg?.res?.[1] === RPCMethod.AuthChallenge) {
            console.log("[Yellow] Auth challenge received");
          }
          if (msg?.res?.[1] === RPCMethod.AuthVerify) {
            console.log("[Yellow] Auth verify response");
          }
          if (msg?.res?.[1] === RPCMethod.Error) {
            console.error("[Yellow] Auth error:", msg?.res?.[2]?.error);
          }
          this.handleMessage(msg);
        } catch (err) {
          console.error("[Yellow] Failed to parse message:", err);
        }
      });

      this.ws.on("close", (code: number, reason: Buffer) => {
        console.log(
          `[Yellow] Disconnected from Clearnode (code ${code}) ${reason.toString()}`,
        );
        this.authenticated = false;
        this.isConnecting = false;
        this.connectPromise = null;
        if (this.authTimeout) {
          clearTimeout(this.authTimeout);
          this.authTimeout = null;
        }
        this.authResolve = null;
        this.authReject = null;

        if (!this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect().catch((err) => {
              console.error("[Yellow] Reconnect failed:", err);
            });
          }, 2000);
        }
      });

      this.ws.on("error", (err: Error) => {
        console.error("[Yellow] WebSocket error:", err);
        this.isConnecting = false;
        this.connectPromise = null;
        if (this.authTimeout) {
          clearTimeout(this.authTimeout);
          this.authTimeout = null;
        }
        this.authReject?.(err);
        this.authReject = null;
        this.authResolve = null;
        reject(err);
      });
    });

    return this.connectPromise;
  }

  private async ensureConnected(): Promise<void> {
    if (this.isConnected()) return;
    await this.connect();
  }

  private async authenticate(): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected");
    }

    const address = this.wallet.account?.address;
    if (!address) {
      throw new Error("Wallet has no account");
    }

    const authParams: AuthParams = {
      session_key: this.sessionSigner.address,
      allowances: [],
      expires_at: BigInt(Math.floor(Date.now() / 1000) + 3600),
      scope: this.scope,
    };
    this.lastAuthParams = authParams;

    const authRequest = await createAuthRequestMessage({
      address,
      application: this.application,
      ...authParams,
    });

    console.log("[Yellow] Sending auth_request", {
      address,
      session_key: authParams.session_key,
      application: this.application,
      scope: authParams.scope,
      expires_at: authParams.expires_at.toString(),
    });

    this.ws.send(authRequest);

    if (this.authTimeout) {
      clearTimeout(this.authTimeout);
    }

    this.authTimeout = setTimeout(() => {
      if (!this.authenticated) {
        const error = new Error("Auth timed out");
        this.authReject?.(error);
        this.authReject = null;
        this.authResolve = null;
      }
    }, 8000);
  }

  private handleMessage(msg: any): void {
    // Handle response to pending request
    if (msg.res && Array.isArray(msg.res)) {
      const [requestId, method, result] = msg.res;

      if (method === RPCMethod.AuthChallenge) {
        void this.handleAuthChallenge(
          result?.challenge_message ?? result?.challenge,
        );
        return;
      }

      if (method === RPCMethod.AuthVerify) {
        if (result?.success) {
          this.authenticated = true;
          console.log("[Yellow] Authenticated");
          this.isConnecting = false;
          this.connectPromise = null;
          if (this.authTimeout) {
            clearTimeout(this.authTimeout);
            this.authTimeout = null;
          }
          this.authResolve?.();
        } else {
          const error = new Error(result?.error ?? "Authentication failed");
          this.authenticated = false;
          this.isConnecting = false;
          this.connectPromise = null;
          if (this.authTimeout) {
            clearTimeout(this.authTimeout);
            this.authTimeout = null;
          }
          this.authReject?.(error);
          console.error("[Yellow] Authentication failed:", error.message);
        }
        this.authResolve = null;
        this.authReject = null;
        return;
      }

      if (method === "error") {
        const pending = this.pendingRequests.get(requestId);
        if (pending) {
          this.pendingRequests.delete(requestId);
          pending.reject(new Error(result?.error ?? "Unknown error"));
        }
        return;
      }

      const pending = this.pendingRequests.get(requestId);
      if (pending) {
        this.pendingRequests.delete(requestId);
        pending.resolve(result);
        return;
      }

      if (this.handlers.has(method)) {
        this.handlers.get(method)!(result);
      }
    }
  }

  private async handleAuthChallenge(challenge: string): Promise<void> {
    if (!challenge) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const address = this.wallet.account?.address;
    if (!address) return;

    const authParams: AuthParams = this.lastAuthParams ?? {
      session_key: this.sessionSigner.address,
      allowances: [],
      expires_at: BigInt(Math.floor(Date.now() / 1000) + 3600),
      scope: this.application,
    };

    const signer = createEIP712AuthMessageSigner(
      this.wallet,
      authParams,
      { name: this.application },
    );

    console.log("[Yellow] Signing auth challenge", challenge);

    const authVerify = await createAuthVerifyMessageFromChallenge(
      signer,
      challenge,
    );

    this.ws.send(authVerify);
  }

  private async sendRequest(method: string, params: any): Promise<any> {
    await this.ensureConnected();
    if (!this.authenticated) {
      throw new Error("Not authenticated with Clearnode");
    }

    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error("WebSocket not connected"));
        return;
      }

      const id = ++this.requestId;
      const timestamp = Date.now();
      const req = [id, method, params, timestamp];
        const payload = { req } as { req: unknown[]; sig?: string[] };
        const message = JSON.stringify(payload);
      const digestHex = ethers.utils.id(message);
      const messageBytes = ethers.utils.arrayify(digestHex);
        const signature = this.sessionSigner
          ._signingKey()
          .signDigest(messageBytes);
      payload.sig = [ethers.utils.joinSignature(signature)];

      this.pendingRequests.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(payload));
    });
  }

  async createAppSession(
    participants: string[],
    weights: number[],
    quorum: number,
  ): Promise<string> {
    const result = await this.sendRequest("create_app_session", {
      participants,
      weights,
      quorum,
    });
    return result.session_id;
  }

  async getBalance(address: string): Promise<number> {
    const balances = await this.getLedgerBalances(address);
    const match =
      balances.find((b) => b.asset === "ytest.usd") ??
      balances.find((b) => b.asset === "usdc");
    const value = Number(match?.amount ?? 0);
    if (Number.isNaN(value)) {
      throw new Error("Invalid ledger balance returned from Clearnode");
    }
    return value;
  }

  async getLedgerBalances(
    accountId?: string,
  ): Promise<Array<{ asset: string; amount: string }>> {
    const params = accountId ? { account_id: accountId } : {};
    const result = await this.sendRequest("get_ledger_balances", params);
    const balances =
      result?.ledger_balances ??
      result?.balances ??
      (Array.isArray(result) ? result : []);
    if (!Array.isArray(balances)) {
      throw new Error("Invalid ledger balances response");
    }
    return balances.map((balance) => ({
      asset: String(balance.asset ?? ""),
      amount: String(balance.amount ?? "0"),
    }));
  }

  async submitAppState(
    sessionId: string,
    allocations: Record<string, number>,
    intent: "operate" | "close" = "operate",
  ): Promise<void> {
    await this.sendRequest("submit_app_state", {
      session_id: sessionId,
      allocations,
      intent,
    });
  }

  async closeAppSession(
    sessionId: string,
    finalAllocations: Record<string, number>,
  ): Promise<void> {
    await this.sendRequest("submit_app_state", {
      session_id: sessionId,
      allocations: finalAllocations,
      intent: "close",
    });
  }

  on(event: string, handler: MessageHandler): void {
    this.handlers.set(event, handler);
  }

  isConnected(): boolean {
    return this.authenticated && this.ws?.readyState === WebSocket.OPEN;
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    this.authenticated = false;
  }
}
