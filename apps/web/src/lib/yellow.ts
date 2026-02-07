import { CLEARNODE_WS_URL } from "@playfrens/shared";

const WS_URL =
  import.meta.env.VITE_CLEARNODE_WS_URL || CLEARNODE_WS_URL;

export async function getYellowBalance(address: string): Promise<string> {
  // Query balance via Clearnode WebSocket
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    let requestId = 1;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: requestId,
          method: "get_balance",
          params: { address },
        }),
      );
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.id === requestId) {
          ws.close();
          resolve(msg.result?.balance ?? "0");
        }
      } catch {
        ws.close();
        reject(new Error("Failed to parse response"));
      }
    };

    ws.onerror = () => {
      reject(new Error("WebSocket connection failed"));
    };

    setTimeout(() => {
      ws.close();
      resolve("0");
    }, 5000);
  });
}

export { WS_URL as YELLOW_WS_URL };
