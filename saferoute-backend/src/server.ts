import http from "http";
import dotenv from "dotenv";
import app from "./app";
import { initSocket } from "./socket/socketServer";
import { initWebPush } from "./services/pushService";
import pool from "./config/db";

dotenv.config();

const PORT = parseInt(process.env.PORT || "4000", 10);

async function main() {
  // Test DB connection
  try {
    const conn = await pool.getConnection();
    console.log("✅ MySQL connected");
    conn.release();
  } catch (err) {
    console.error("❌ MySQL connection failed:", err);
    process.exit(1);
  }

  // Create HTTP server and attach Socket.io
  const httpServer = http.createServer(app);
  initSocket(httpServer);
  console.log("✅ Socket.io initialised");

  // Configure Web Push
  initWebPush();

  httpServer.on("error", (err: NodeJS.ErrnoException) => {
    console.error("HTTP server failed:", err);
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${PORT} is already in use. Ensure no other backend process is running.`);
    }
    process.exit(1);
  });

  httpServer.listen(PORT, () => {
    console.log(`🚌 SafeRoute backend running on http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health`);
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("SIGTERM received — shutting down");
    httpServer.close(() => pool.end());
  });
}

main();
