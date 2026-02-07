import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { RoomManager } from "./rooms/RoomManager.js";
import { setupSocketHandlers } from "./socket/handlers.js";
import { authMiddleware } from "./socket/middleware.js";
import type { Hex } from "viem";
import { createServerWallet, getServerAddress } from "./yellow/auth.js";
import { YellowClient } from "./yellow/client.js";
import { YellowSessionManager } from "./yellow/sessionManager.js";

const PORT = parseInt(process.env.PORT || "3001", 10);

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
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
const yellowClient = new YellowClient(
  serverWallet,
  process.env.CLEARNODE_WS_URL,
);
const yellowSessions = new YellowSessionManager(
  yellowClient,
  serverAddress,
);

yellowClient.connect().catch((err) => {
  console.error("[Yellow] Failed to connect:", err);
});

setupSocketHandlers(io, roomManager, yellowSessions);

httpServer.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║   🎮 PlayFrens Server Running         ║
  ║   Port: ${PORT}                         ║
  ║   Ready for games!                    ║
  ╚═══════════════════════════════════════╝
  `);
});
