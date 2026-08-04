import { Request, Response } from "express";
import pool from "../config/db";
import { AuthRequest } from "../middleware/auth";
import { getIo } from "../socket/socketServer";
import { sendPushToAdmins, sendPushToParent } from "../services/pushService";
import { EmergencyAlertPayload } from "../types";

export async function sendEmergencyAlert(req: AuthRequest, res: Response): Promise<void> {
  const { trip_id, bus_id, latitude, longitude, message } = req.body;
  const driver_id = req.user!.userId;
  const driver_name = req.user!.email; // will be replaced with name below

  try {
    // Get driver name
    const [userRows] = await pool.query("SELECT name FROM users WHERE id = ?", [driver_id]);
    const users = userRows as Array<{ name: string }>;
    const driverName = users[0]?.name || "Unknown Driver";

    const [result] = await pool.query(
      `INSERT INTO emergency_alerts (trip_id, driver_id, bus_id, latitude, longitude, message)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [trip_id, driver_id, bus_id, latitude || null, longitude || null, message || "Emergency reported by driver"]
    );
    const alertId = (result as { insertId: number }).insertId;

    const payload: EmergencyAlertPayload = {
      alertId,
      tripId:     trip_id,
      busId:      bus_id,
      driverId:   driver_id,
      driverName,
      latitude,
      longitude,
      message:    message || "Emergency reported by driver",
      timestamp:  new Date().toISOString(),
    };

    // Broadcast to admin room via Socket.io
    getIo().to("room:admin").emit("emergency:alert", payload);

    // Also send Web Push to all admin subscriptions
    await sendPushToAdmins({
      title: "🚨 Emergency Alert",
      body:  `Driver ${driverName} (Bus ${bus_id}) has reported an emergency.`,
      data:  payload,
    });

    // Notify parents of every active student on this bus — they need to know
    // about an emergency involving their child's bus at least as urgently as admins do.
    const [parentRows] = await pool.query(
      `SELECT DISTINCT s.parent_id
       FROM students s
       WHERE s.bus_id = ? AND s.is_active = TRUE`,
      [bus_id]
    );
    const parents = parentRows as Array<{ parent_id: number }>;

    for (const parent of parents) {
      // Real-time in-app event
      getIo().to(`parent:${parent.parent_id}`).emit("emergency:alert", payload);

      // Web Push notification
      await sendPushToParent(parent.parent_id, {
        title: "🚨 Emergency Alert",
        body:  `An emergency has been reported on your child's bus. ${message || "Please check the app for details."}`,
        data:  payload,
      });
    }

    res.status(201).json({ alertId, message: "Emergency alert sent" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getAlerts(req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.query(`
      SELECT ea.*, u.name AS driver_name, b.plate_number
      FROM emergency_alerts ea
      JOIN users u ON ea.driver_id = u.id
      JOIN buses b ON ea.bus_id = b.id
      ORDER BY ea.created_at DESC
      LIMIT 50
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function resolveAlert(req: Request, res: Response): Promise<void> {
  try {
    await pool.query(
      "UPDATE emergency_alerts SET resolved = TRUE, resolved_at = NOW() WHERE id = ?",
      [req.params.id]
    );
    getIo().to("room:admin").emit("emergency:resolved", { alertId: req.params.id });
    res.json({ message: "Alert resolved" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}
