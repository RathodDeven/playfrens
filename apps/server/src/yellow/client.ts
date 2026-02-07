import WebSocket from "ws";
import type { Hex, WalletClient } from "viem";
import { CLEARNODE_WS_URL } from "@playfrens/shared";
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

  constructor(wallet: WalletClient, wsUrl?: string) {
    this.wallet = wallet;
    this.wsUrl = wsUrl || CLEARNODE_WS_URL;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.on("open", async () => {
        console.log("[Yellow] Connected to Clearnode");
        try {
          await this.authenticate();
          this.authenticated = true;
          console.log("[Yellow] Authenticated");
          resolve();
        } catch (err) {
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

      this.ws.on("close", () => {
        console.log("[Yellow] Disconnected from Clearnode");
        this.authenticated = false;
      });

      this.ws.on("error", (err: Error) => {
        console.error("[Yellow] WebSocket error:", err);
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
    const signature = await signAuthChallenge(
      this.wallet,
      authReq.challenge,
    );

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
    const result = await this.sendRequest("get_balance", { address });
    const value = Number(result?.balance ?? 0);
    if (Number.isNaN(value)) {
      throw new Error("Invalid balance returned from Clearnode");
    }
    return value;
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
