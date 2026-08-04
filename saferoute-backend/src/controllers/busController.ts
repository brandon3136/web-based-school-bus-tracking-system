import { Request, Response } from "express";
import pool from "../config/db";
import { sendDriverCredentialsEmail } from "../services/emailService";

export async function getAllBuses(_req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.query(`
      SELECT b.*, u.name AS driver_name, u.phone AS driver_phone,
             r.id AS route_id, r.name AS route_name
      FROM buses b
      LEFT JOIN users u ON b.driver_id = u.id
      LEFT JOIN bus_routes br ON br.bus_id = b.id
      LEFT JOIN routes r ON br.route_id = r.id
      WHERE b.is_active = TRUE
      ORDER BY b.id
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getBusById(req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.query(`
      SELECT b.*, u.name AS driver_name, u.phone AS driver_phone
      FROM buses b
      LEFT JOIN users u ON b.driver_id = u.id
      WHERE b.id = ? AND b.is_active = TRUE
    `, [req.params.id]);
    const buses = rows as unknown[];
    if (!buses.length) { res.status(404).json({ error: "Bus not found" }); return; }
    res.json(buses[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function createBus(req: Request, res: Response): Promise<void> {
  const { plate_number, model, capacity, driver_id, route_id } = req.body;
  try {
    const [result] = await pool.query(
      "INSERT INTO buses (plate_number, model, capacity, driver_id) VALUES (?, ?, ?, ?)",
      [plate_number, model || null, capacity || 30, driver_id || null]
    );
    const id = (result as { insertId: number }).insertId;

    // Assign route if provided
    if (route_id) {
      await pool.query(
        "INSERT INTO bus_routes (bus_id, route_id) VALUES (?, ?)",
        [id, route_id]
      );
    }

    res.status(201).json({ id, plate_number, model, capacity, driver_id, route_id: route_id || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateBus(req: Request, res: Response): Promise<void> {
  const { plate_number, model, capacity, driver_id, is_active, route_id } = req.body;
  try {
    await pool.query(
      "UPDATE buses SET plate_number=?, model=?, capacity=?, driver_id=?, is_active=? WHERE id=?",
      [plate_number, model, capacity, driver_id, is_active ?? true, req.params.id]
    );

    // Update route assignment: remove old, insert new
    await pool.query("DELETE FROM bus_routes WHERE bus_id = ?", [req.params.id]);
    if (route_id) {
      await pool.query(
        "INSERT INTO bus_routes (bus_id, route_id) VALUES (?, ?)",
        [req.params.id, route_id]
      );
    }

    res.json({ message: "Bus updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function deleteBus(req: Request, res: Response): Promise<void> {
  try {
    await pool.query("UPDATE buses SET is_active = FALSE WHERE id = ?", [req.params.id]);
    res.json({ message: "Bus deactivated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Get the latest GPS position of a bus
export async function getBusLocation(req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.query(`
      SELECT g.latitude, g.longitude, g.speed_kmh, g.heading_deg, g.logged_at,
             t.id AS trip_id, t.status AS trip_status
      FROM gps_logs g
      JOIN trips t ON g.trip_id = t.id
      WHERE g.bus_id = ?
      ORDER BY g.logged_at DESC
      LIMIT 1
    `, [req.params.id]);
    const logs = rows as unknown[];
    if (!logs.length) { res.status(404).json({ error: "No location data found" }); return; }
    res.json(logs[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ── Driver Management ───────────────────────────────────────────────

export async function getDrivers(_req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.query(`
      SELECT
        u.id, u.name, u.email, u.phone, u.is_active, u.created_at,
        b.id AS bus_id, b.plate_number AS bus_plate, b.model AS bus_model,
        r.name AS route_name,
        (SELECT COUNT(*) FROM trips WHERE driver_id = u.id) AS total_trips,
        (SELECT COUNT(*) FROM trips WHERE driver_id = u.id AND status = 'completed') AS completed_trips,
        (SELECT COUNT(*) FROM trips WHERE driver_id = u.id AND status = 'in_progress') AS active_trips,
        (SELECT MAX(ended_at) FROM trips WHERE driver_id = u.id AND status = 'completed') AS last_trip_date
      FROM users u
      LEFT JOIN buses b ON b.driver_id = u.id AND b.is_active = TRUE
      LEFT JOIN bus_routes br ON br.bus_id = b.id
      LEFT JOIN routes r ON br.route_id = r.id
      WHERE u.role = 'driver' AND u.is_active = TRUE
      ORDER BY u.name
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function createDriver(req: Request, res: Response): Promise<void> {
  const { name, email, phone, password } = req.body;
  if (!name || !email) {
    res.status(400).json({ error: "Name and email are required." });
    return;
  }

  try {
    const bcrypt = require("bcryptjs");
    const driverPassword = password || Array.from({ length: 10 }, () =>
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$"[Math.floor(Math.random() * 66)]
    ).join("");
    const hash = await bcrypt.hash(driverPassword, 10);

    const [result] = await pool.query(
      "INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, 'driver', ?)",
      [name, email.toLowerCase().trim(), hash, phone || null]
    );
    const id = (result as { insertId: number }).insertId;

    // Send credentials email to the new driver
    let emailSent = false;
    if (!password) {
      try {
        await sendDriverCredentialsEmail(name, email.toLowerCase().trim(), driverPassword);
        emailSent = true;
      } catch (emailErr) {
        console.error("Failed to send driver credentials email:", emailErr);
      }
    }

    res.status(201).json({
      id, name, email, phone,
      generatedPassword: !password ? driverPassword : undefined,
      emailSent,
    });
  } catch (err: any) {
    if (err.code === "ER_DUP_ENTRY") {
      res.status(409).json({ error: "A user with that email already exists." });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function deleteDriver(req: Request, res: Response): Promise<void> {
  try {
    // Unassign driver from any buses first
    await pool.query("UPDATE buses SET driver_id = NULL WHERE driver_id = ?", [req.params.id]);
    // Deactivate the driver account
    await pool.query("UPDATE users SET is_active = FALSE WHERE id = ? AND role = 'driver'", [req.params.id]);
    res.json({ message: "Driver deactivated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}
