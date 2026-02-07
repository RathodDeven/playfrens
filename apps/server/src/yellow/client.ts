import { CLEARNODE_WS_URL } from "@playfrens/shared";
import type { WalletClient } from "viem";
import WebSocket from "ws";
import { signAuthChallenge } from "./auth.js";

type MessageHandler = (data: any) => void;

export class YellowClient {
  private ws: WebSocket | null = null;
  private wallet: WalletClient;
  private handlers: Map<string, MessageHandler> = new Map();
  private requestId = 0;
  private pendingRequests: Map<
    number,
    { resolve: (v: any) => void; reject: (e: Error) => void }
  > = new Map();
  private authenticated = false;
  private wsUrl: string;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting = false;

  constructor(wallet: WalletClient, wsUrl?: string) {
    this.wallet = wallet;
    this.wsUrl = wsUrl || CLEARNODE_WS_URL;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnecting) return;
      this.isConnecting = true;

      this.ws = new WebSocket(this.wsUrl);

      this.ws.on("open", async () => {
        console.log("[Yellow] Connected to Clearnode");
        try {
          await this.authenticate();
          this.authenticated = true;
          console.log("[Yellow] Authenticated");
          this.isConnecting = false;
          resolve();
        } catch (err) {
          this.isConnecting = false;
          reject(err);
        }
      });

      this.ws.on("message", (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString());
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
        reject(err);
      });
    });
  }

  private async authenticate(): Promise<void> {
    // Step 1: Send auth request
    const authReq = await this.sendRequest("auth_request", {
      address: this.wallet.account?.address,
    });

    // Step 2: Sign the challenge
    const signature = await signAuthChallenge(this.wallet, authReq.challenge);

    // Step 3: Verify
    await this.sendRequest("auth_verify", {
      address: this.wallet.account?.address,
      signature,
    });
  }

  private handleMessage(msg: any): void {
    // Handle response to pending request
    if (msg.id && this.pendingRequests.has(msg.id)) {
      const pending = this.pendingRequests.get(msg.id)!;
      this.pendingRequests.delete(msg.id);
      if (msg.error) {
        pending.reject(new Error(msg.error.message || "Unknown error"));
      } else {
        pending.resolve(msg.result);
      }
      return;
    }

    // Handle push notifications
    if (msg.method && this.handlers.has(msg.method)) {
      this.handlers.get(msg.method)!(msg.params);
    }
  }

  private sendRequest(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error("WebSocket not connected"));
        return;
      }

      const id = ++this.requestId;
      this.pendingRequests.set(id, { resolve, reject });

      this.ws.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id,
          method,
          params,
        }),
      );
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
    const match = balances.find((b) => b.asset === "ytest.usd")
      ?? balances.find((b) => b.asset === "usdc");
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
