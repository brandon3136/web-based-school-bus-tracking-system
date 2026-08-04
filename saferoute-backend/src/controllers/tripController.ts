import { Request, Response } from "express";
import pool from "../config/db";
import { AuthRequest } from "../middleware/auth";
import { getIo } from "../socket/socketServer";
import { checkGeofences, clearTripGeofences } from "../services/geofenceService";
import { sendPushToParent } from "../services/pushService";
import { GpsUpdatePayload } from "../types";

export async function startTrip(req: AuthRequest, res: Response): Promise<void> {
  const { bus_id, route_id } = req.body;
  const driver_id = req.user!.userId;

  try {
    // Check if driver already has an active trip
    const [active] = await pool.query(
      "SELECT id FROM trips WHERE driver_id = ? AND status = 'in_progress'", [driver_id]
    );
    if ((active as unknown[]).length > 0) {
      res.status(409).json({ error: "You already have an active trip" });
      return;
    }

    const [result] = await pool.query(
      `INSERT INTO trips (bus_id, route_id, driver_id, started_at, status)
       VALUES (?, ?, ?, NOW(), 'in_progress')`,
      [bus_id, route_id, driver_id]
    );
    const tripId = (result as { insertId: number }).insertId;

    // Notify all clients watching this bus
    getIo().to(`bus:${bus_id}`).emit("trip:started", { tripId, busId: bus_id, driverId: driver_id });

    res.status(201).json({ tripId, message: "Trip started" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function endTrip(req: AuthRequest, res: Response): Promise<void> {
  const { trip_id } = req.body;
  const driver_id = req.user!.userId;

  try {
    const [rows] = await pool.query(
      "SELECT id, bus_id, route_id FROM trips WHERE id = ? AND driver_id = ? AND status = 'in_progress'",
      [trip_id, driver_id]
    );
    const trips = rows as Array<{ id: number; bus_id: number; route_id: number }>;
    if (!trips.length) { res.status(404).json({ error: "Active trip not found" }); return; }

    const trip = trips[0];

    await pool.query(
      "UPDATE trips SET status = 'completed', ended_at = NOW() WHERE id = ?", [trip_id]
    );

    // Clear geofence cache for this trip
    clearTripGeofences(trip_id);

    // Notify all clients watching this bus
    getIo().to(`bus:${trip.bus_id}`).emit("trip:ended", { tripId: trip_id });

    // Send arrival notifications to all parents of students on this bus
    const [parentRows] = await pool.query(
      `SELECT DISTINCT s.parent_id, b.plate_number
       FROM students s
       JOIN buses b ON s.bus_id = b.id
       WHERE s.bus_id = ? AND s.is_active = TRUE`,
      [trip.bus_id]
    );
    const parents = parentRows as Array<{ parent_id: number; plate_number: string }>;

    for (const parent of parents) {
      // Socket.io event
      getIo().to(`parent:${parent.parent_id}`).emit("arrival:alert", {
        busPlate: parent.plate_number,
        tripId: trip_id,
        busId: trip.bus_id,
        timestamp: new Date().toISOString(),
      });

      // Web Push notification
      await sendPushToParent(parent.parent_id, {
        title: `🏫 Bus has arrived`,
        body: `Bus ${parent.plate_number} has completed its trip. Your child has arrived.`,
        data: { type: "arrival", tripId: trip_id, busId: trip.bus_id },
      });
    }

    res.json({ message: "Trip ended" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function logGps(req: AuthRequest, res: Response): Promise<void> {
  const { trip_id, bus_id, latitude, longitude, speed_kmh, heading_deg } = req.body;

  try {
    // Verify trip belongs to this driver
    const [trips] = await pool.query(
      "SELECT id FROM trips WHERE id = ? AND driver_id = ? AND status = 'in_progress'",
      [trip_id, req.user!.userId]
    );
    if (!(trips as unknown[]).length) {
      res.status(403).json({ error: "Trip not found or not active" });
      return;
    }

    await pool.query(
      `INSERT INTO gps_logs (trip_id, bus_id, latitude, longitude, speed_kmh, heading_deg)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [trip_id, bus_id, latitude, longitude, speed_kmh || 0, heading_deg || 0]
    );

    const payload: GpsUpdatePayload = { tripId: trip_id, busId: bus_id, latitude, longitude, speedKmh: speed_kmh, headingDeg: heading_deg };

    // Broadcast to all clients watching this bus
    getIo().to(`bus:${bus_id}`).emit("gps:update", payload);

    // Check geofences and fire push notifications if crossed
    await checkGeofences(bus_id, trip_id, latitude, longitude);

    res.status(201).json({ message: "Location logged" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getTripHistory(req: Request, res: Response): Promise<void> {
  const { busId, driverId, limit = 20, offset = 0 } = req.query;
  try {
    let query = `
      SELECT t.*, u.name AS driver_name, b.plate_number, r.name AS route_name
      FROM trips t
      JOIN users u ON t.driver_id = u.id
      JOIN buses b ON t.bus_id = b.id
      JOIN routes r ON t.route_id = r.id
      WHERE t.status IN ('completed', 'cancelled')
    `;
    const params: unknown[] = [];
    if (busId)    { query += " AND t.bus_id = ?";    params.push(busId); }
    if (driverId) { query += " AND t.driver_id = ?"; params.push(driverId); }
    query += " ORDER BY t.started_at DESC LIMIT ? OFFSET ?";
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getTripGpsLogs(req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM gps_logs WHERE trip_id = ? ORDER BY logged_at ASC", [req.params.tripId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getActiveTrips(_req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.query(`
      SELECT t.id AS trip_id, t.bus_id, t.route_id, t.driver_id, t.started_at,
             u.name AS driver_name, b.plate_number, r.name AS route_name,
             (SELECT COUNT(*) FROM boarding_records br WHERE br.trip_id = t.id AND br.alighted_at IS NULL) AS students_onboard
      FROM trips t
      JOIN users u  ON t.driver_id = u.id
      JOIN buses b  ON t.bus_id   = b.id
      JOIN routes r ON t.route_id = r.id
      WHERE t.status = 'in_progress'
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}
