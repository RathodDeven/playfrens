import {
  RPCMethod,
  type RPCProtocolVersion,
  createAppSessionMessage,
  createAuthRequestMessage,
  createAuthVerifyMessageFromChallenge,
  createCloseAppSessionMessage,
  createECDSAMessageSigner,
  createEIP712AuthMessageSigner,
  createGetLedgerBalancesMessage,
  createSubmitAppStateMessage,
} from "@erc7824/nitrolite";
import { CLEARNODE_WS_URL, fromOnChainAmount } from "@playfrens/shared";
import type { Address, Hex, WalletClient } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import WebSocket from "ws";

type MessageHandler = (data: any) => void;

type AuthParams = {
  session_key: `0x${string}`;
  allowances: Array<{ asset: string; amount: string }>;
  expires_at: bigint;
  scope: string;
};

interface PendingRequest {
  resolve: (v: any) => void;
  reject: (e: Error) => void;
}

export interface AppSessionDefinition {
  protocol: string;
  participants: Address[];
  weights: number[];
  quorum: number;
  challenge: number;
  nonce: number;
  application: string;
}

export interface AppSessionAllocation {
  participant: Address;
  asset: string;
  amount: string;
}

export class YellowClient {
  private ws: WebSocket | null = null;
  private wallet: WalletClient;
  private sessionPrivateKey: Hex;
  private sessionSigner: ReturnType<typeof createECDSAMessageSigner>;
  private handlers: Map<string, MessageHandler> = new Map();
  private pendingByMethod: Map<string, PendingRequest> = new Map();
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
    _privateKey: string,
    sessionKey?: string,
    wsUrl?: string,
    application = "console",
    scope?: string,
  ) {
    this.wallet = wallet;
    // Use provided session key or generate ephemeral one
    this.sessionPrivateKey = (sessionKey || generatePrivateKey()) as Hex;
    this.sessionSigner = createECDSAMessageSigner(this.sessionPrivateKey);
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

    const sessionAccount = privateKeyToAccount(this.sessionPrivateKey);
    const authParams: AuthParams = {
      session_key: sessionAccount.address,
      allowances: [
        {
          asset: "ytest.usd",
          amount: "1000000000", // Large allowance for server (trusted judge)
        },
      ],
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
    // Log all incoming messages for debugging
    if (msg.res && Array.isArray(msg.res)) {
      const method = msg.res[1];
      if (method !== RPCMethod.Ping && method !== RPCMethod.Pong) {
        console.log(
          `[Yellow] WS received: method=${method}, data=${JSON.stringify(msg.res[2]).slice(0, 200)}`,
        );
      }
    }

    // Handle response to pending request
    if (msg.res && Array.isArray(msg.res)) {
      const [_requestId, method, result] = msg.res;

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
        const errMsg = result?.error ?? "Unknown Clearnode error";
        console.error("[Yellow] Error from Clearnode:", errMsg);
        // Reject all pending method waiters
        for (const [key, pending] of this.pendingByMethod.entries()) {
          this.pendingByMethod.delete(key);
          pending.reject(new Error(errMsg));
        }
        return;
      }

      // Route to pending method waiter
      const pending = this.pendingByMethod.get(method);
      if (pending) {
        this.pendingByMethod.delete(method);
        pending.resolve(result);
        return;
      }

      if (this.handlers.has(method)) {
        this.handlers.get(method)?.(result);
      }
    }
  }

  private async handleAuthChallenge(challenge: string): Promise<void> {
    if (!challenge) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const authParams: AuthParams = this.lastAuthParams ?? {
      session_key: privateKeyToAccount(this.sessionPrivateKey).address,
      allowances: [{ asset: "ytest.usd", amount: "1000000000" }],
      expires_at: BigInt(Math.floor(Date.now() / 1000) + 3600),
      scope: this.scope,
    };

    const signer = createEIP712AuthMessageSigner(this.wallet, authParams, {
      name: this.application,
    });

    console.log("[Yellow] Signing auth challenge", challenge);

    const authVerify = await createAuthVerifyMessageFromChallenge(
      signer,
      challenge,
    );

    this.ws.send(authVerify);
  }

  /**
   * Send a pre-signed message and wait for a specific method response.
   */
  private sendAndWait(
    signedMessage: string,
    waitMethod: string,
    timeoutMs = 15000,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error("WebSocket not connected"));
        return;
      }

      const timeout = setTimeout(() => {
        this.pendingByMethod.delete(waitMethod);
        reject(new Error(`Timeout waiting for ${waitMethod}`));
      }, timeoutMs);

      this.pendingByMethod.set(waitMethod, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      this.ws.send(signedMessage);
    });
  }

  /**
   * Prepare an app session request: create the RPC message, sign it with
   * the server's session key, and return the raw `req` array + server signature.
   * Does NOT send anything to Clearnode.
   */
  async prepareAppSessionRequest(
    definition: AppSessionDefinition,
    allocations: AppSessionAllocation[],
  ): Promise<{ req: any[]; serverSig: string }> {
    await this.ensureConnected();
    if (!this.authenticated) {
      throw new Error("Not authenticated with Clearnode");
    }

    const signedMessage = await createAppSessionMessage(this.sessionSigner, {
      definition: {
        protocol: definition.protocol as any,
        participants: definition.participants as `0x${string}`[],
        weights: definition.weights,
        quorum: definition.quorum,
        challenge: definition.challenge,
        nonce: definition.nonce,
        application: definition.application,
      },
      allocations: allocations.map((a) => ({
        participant: a.participant as Address,
        asset: a.asset,
        amount: a.amount,
      })),
    });

    const parsed = JSON.parse(signedMessage);
    console.log("[Yellow] Prepared app session request, server signed");
    return { req: parsed.req, serverSig: parsed.sig[0] };
  }

  /**
   * Submit a multi-sig app session creation message.
   * All signatures must be bundled in a single `{ req, sig: [...] }` message.
   */
  async submitMultiSigSession(
    req: any[],
    signatures: string[],
  ): Promise<string> {
    await this.ensureConnected();
    if (!this.authenticated) {
      throw new Error("Not authenticated with Clearnode");
    }

    const assembled = JSON.stringify({ req, sig: signatures });
    console.log(
      `[Yellow] Submitting multi-sig app session with ${signatures.length} signatures`,
    );

    const result = await this.sendAndWait(
      assembled,
      "create_app_session",
      15000,
    );
    console.log(
      "[Yellow] create_app_session multi-sig response:",
      JSON.stringify(result),
    );
    const sessionData = Array.isArray(result) ? result[0] : result;
    const sessionId = sessionData?.app_session_id;
    if (!sessionId) {
      throw new Error("No app_session_id returned from Clearnode");
    }
    console.log("[Yellow] App session created (multi-sig):", sessionId);
    return sessionId;
  }

  /**
   * Create an app session using the SDK helper (single-signer, legacy).
   * Returns the app_session_id.
   */
  async createAppSession(
    definition: AppSessionDefinition,
    allocations: AppSessionAllocation[],
  ): Promise<string> {
    await this.ensureConnected();
    if (!this.authenticated) {
      throw new Error("Not authenticated with Clearnode");
    }

    const signedMessage = await createAppSessionMessage(this.sessionSigner, {
      definition: {
        protocol: definition.protocol as any,
        participants: definition.participants as `0x${string}`[],
        weights: definition.weights,
        quorum: definition.quorum,
        challenge: definition.challenge,
        nonce: definition.nonce,
        application: definition.application,
      },
      allocations: allocations.map((a) => ({
        participant: a.participant as Address,
        asset: a.asset,
        amount: a.amount,
      })),
    });

    console.log(
      "[Yellow] Creating app session with definition:",
      JSON.stringify(definition),
    );
    console.log(
      "[Yellow] Initial allocations:",
      allocations
        .map((a) => `${a.participant.slice(0, 10)}: ${a.amount} ${a.asset}`)
        .join(", "),
    );

    const result = await this.sendAndWait(signedMessage, "create_app_session");
    console.log(
      "[Yellow] create_app_session response:",
      JSON.stringify(result),
    );
    const sessionData = Array.isArray(result) ? result[0] : result;
    const sessionId = sessionData?.app_session_id;
    if (!sessionId) {
      throw new Error("No app_session_id returned from Clearnode");
    }
    console.log("[Yellow] App session created:", sessionId);
    return sessionId;
  }

  /**
   * Submit intermediate app state (allocations) after each hand.
   * Uses NitroRPC/0.2 submit_app_state to update Clearnode with current chip distribution.
   */
  async submitAppState(
    sessionId: string,
    allocations: AppSessionAllocation[],
  ): Promise<void> {
    await this.ensureConnected();
    if (!this.authenticated) {
      throw new Error("Not authenticated with Clearnode");
    }

    const signedMessage = await createSubmitAppStateMessage<
      typeof RPCProtocolVersion.NitroRPC_0_2
    >(this.sessionSigner, {
      app_session_id: sessionId as `0x${string}`,
      allocations: allocations.map((a) => ({
        participant: a.participant as Address,
        asset: a.asset,
        amount: a.amount,
      })),
    });

    console.log(
      "[Yellow] Submitting app state for session:",
      sessionId,
      "allocations:",
      allocations
        .map((a) => `${a.participant.slice(0, 10)}: ${a.amount}`)
        .join(", "),
    );
    const result = await this.sendAndWait(signedMessage, "submit_app_state");
    console.log("[Yellow] submit_app_state response:", JSON.stringify(result));
  }

  /**
   * Close an app session with final allocations using the SDK helper.
   */
  async closeAppSession(
    sessionId: string,
    allocations: AppSessionAllocation[],
  ): Promise<void> {
    await this.ensureConnected();
    if (!this.authenticated) {
      throw new Error("Not authenticated with Clearnode");
    }

    const signedMessage = await createCloseAppSessionMessage(
      this.sessionSigner,
      {
        app_session_id: sessionId as `0x${string}`,
        allocations: allocations.map((a) => ({
          participant: a.participant as Address,
          asset: a.asset,
          amount: a.amount,
        })),
      },
    );

    console.log(
      "[Yellow] Closing app session:",
      sessionId,
      "allocations:",
      allocations
        .map((a) => `${a.participant.slice(0, 10)}: ${a.amount}`)
        .join(", "),
    );
    const result = await this.sendAndWait(signedMessage, "close_app_session");
    console.log("[Yellow] close_app_session response:", JSON.stringify(result));
  }

  async getBalance(address: string): Promise<number> {
    const balances = await this.getLedgerBalances(address);
    const match =
      balances.find((b) => b.asset === "ytest.usd") ??
      balances.find((b) => b.asset === "usdc");
    const value = fromOnChainAmount(match?.amount ?? "0");
    if (Number.isNaN(value)) {
      throw new Error("Invalid ledger balance returned from Clearnode");
    }
    return value;
  }

  async getLedgerBalances(
    accountId?: string,
  ): Promise<Array<{ asset: string; amount: string }>> {
    await this.ensureConnected();
    if (!this.authenticated) {
      throw new Error("Not authenticated with Clearnode");
    }

    const message = await createGetLedgerBalancesMessage(
      this.sessionSigner,
      accountId,
      Date.now(),
    );

    const result = await this.sendAndWait(message, "get_ledger_balances");
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
