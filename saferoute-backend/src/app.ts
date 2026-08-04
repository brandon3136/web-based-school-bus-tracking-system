import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

import authRoutes    from "./routes/authRoutes";
import busRoutes     from "./routes/busRoutes";
import routeRoutes   from "./routes/routeRoutes";
import tripRoutes    from "./routes/tripRoutes";
import miscRoutes    from "./routes/miscRoutes";
import driverRoutes  from "./routes/driverRoutes";

dotenv.config();

const app = express();

app.use(cors({
  origin:      process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

// API routes
app.use("/api/auth",   authRoutes);
app.use("/api/buses",  busRoutes);
app.use("/api/routes", routeRoutes);
app.use("/api/trips",    tripRoutes);
app.use("/api/drivers",  driverRoutes);
app.use("/api",          miscRoutes);

// 404 handler
app.use((_req, res) => res.status(404).json({ error: "Route not found" }));

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
