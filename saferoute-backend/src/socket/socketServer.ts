import { Server as HttpServer } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { JwtPayload } from "../types";

let io: SocketServer;

export function initSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin:      process.env.FRONTEND_URL || "http://localhost:3000",
      methods:     ["GET", "POST"],
      credentials: true,
    },
  });

  // Authenticate every socket connection via JWT (from auth.token or cookies)
  io.use((socket, next) => {
    let token = socket.handshake.auth.token as string | undefined;

    // Fallback: read from cookies
    if (!token) {
      const cookieHeader = socket.handshake.headers.cookie as string | undefined;
      if (cookieHeader) {
        const cookies = cookieHeader.split(";").reduce((acc, c) => {
          const [key, val] = c.trim().split("=");
          acc[key] = decodeURIComponent(val || "");
          return acc;
        }, {} as Record<string, string>);
        token = cookies["saferoute_token"];
      }
    }

    if (!token) { next(new Error("Authentication required")); return; }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || "secret") as JwtPayload;
      (socket as Socket & { user?: JwtPayload }).user = payload;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket: Socket & { user?: JwtPayload }) => {
    const user = socket.user!;
    console.log(`Socket connected: user ${user.userId} (${user.role})`);

    // All admins join a shared admin room for emergency alerts
    if (user.role === "admin") {
      socket.join("room:admin");
    }

    // Parents join their personal room for proximity alerts
    if (user.role === "parent") {
      socket.join(`parent:${user.userId}`);
    }

    // Client subscribes to a specific bus feed
    socket.on("subscribe:bus", (busId: number) => {
      socket.join(`bus:${busId}`);
      console.log(`User ${user.userId} subscribed to bus:${busId}`);
    });

    socket.on("unsubscribe:bus", (busId: number) => {
      socket.leave(`bus:${busId}`);
    });

    socket.on("disconnect", (reason) => {
      console.log(`Socket disconnected: user ${user.userId} — ${reason}`);
    });
  });

  return io;
}

export function getIo(): SocketServer {
  if (!io) throw new Error("Socket.io not initialised");
  return io;
}
