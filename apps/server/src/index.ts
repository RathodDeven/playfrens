import "dotenv/config";
import { createServer } from "node:http";
import os from "node:os";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import type { Hex } from "viem";
import { RoomManager } from "./rooms/RoomManager.js";
import { setupSocketHandlers } from "./socket/handlers.js";
import { authMiddleware } from "./socket/middleware.js";
import { createServerWallet, getServerAddress } from "./yellow/auth.js";
import { YellowClient } from "./yellow/client.js";
import { YellowSessionManager } from "./yellow/sessionManager.js";

const PORT = Number.parseInt(process.env.PORT || "3001", 10);

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

app.get("/yellow/ledger-balance/:address", async (req, res) => {
  try {
    const address = req.params.address?.toLowerCase();
    const asset = String(req.query.asset ?? "ytest.usd");
    if (!address || !address.startsWith("0x")) {
      res.status(400).json({ error: "Invalid address" });
      return;
    }

    const balances = await yellowSessions.getLedgerBalances(address);
    if (asset.toLowerCase() === "all") {
      res.json({ address, balances });
      return;
    }

    const match = balances.find(
      (b) => b.asset?.toLowerCase() === asset.toLowerCase(),
    );
    if (!match) {
      res.json({ address, asset, balance: "0", balances });
      return;
    }

    res.json({ address, asset, balance: String(match.amount) });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Unknown error" });
  }
});

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.use(authMiddleware);

const roomManager = new RoomManager();

const privateKey = process.env.PRIVATE_KEY as Hex | undefined;
if (!privateKey) {
  throw new Error("PRIVATE_KEY is required to run the server");
}

const serverWallet = createServerWallet(privateKey);
const serverAddress = getServerAddress(privateKey);
const sessionKey = process.env.SESSION_KEY_PRIVATE_KEY;
if (!sessionKey) {
  console.warn(
    "[Yellow] SESSION_KEY_PRIVATE_KEY not set; generating ephemeral session key",
  );
}

const yellowClient = new YellowClient(
  serverWallet,
  privateKey,
  sessionKey,
  process.env.CLEARNODE_WS_URL,
  process.env.CLEARNODE_APPLICATION || "PlayFrens",
  process.env.CLEARNODE_SCOPE,
);
const yellowSessions = new YellowSessionManager(yellowClient, serverAddress);

yellowClient.connect().catch((err) => {
  console.error("[Yellow] Failed to connect:", err);
});

setupSocketHandlers(io, roomManager, yellowSessions);

httpServer.listen(PORT, () => {
  const interfaces = os.networkInterfaces();
  const addresses = Object.values(interfaces)
    .flat()
    .filter(
      (info): info is os.NetworkInterfaceInfo =>
        info !== undefined && info.family === "IPv4" && !info.internal,
    )
    .map((info: os.NetworkInterfaceInfo) => `http://${info.address}:${PORT}`);

  const networkUrl = addresses[0] || `http://localhost:${PORT}`;
  console.log(`
  ╔═══════════════════════════════════════╗
  ║   🎮 PlayFrens Server Running         ║
  ║   Port: ${PORT}                         ║
  ║   Ready for games!                    ║
  ╚═══════════════════════════════════════╝
  
  VITE_SERVER_URL=${networkUrl}
  `);
});
