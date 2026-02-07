import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { RoomManager } from "./rooms/RoomManager.js";
import { setupSocketHandlers } from "./socket/handlers.js";
import { authMiddleware } from "./socket/middleware.js";

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

setupSocketHandlers(io, roomManager);

httpServer.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║   🎮 PlayFrens Server Running         ║
  ║   Port: ${PORT}                         ║
  ║   Ready for games!                    ║
  ╚═══════════════════════════════════════╝
  `);
});
