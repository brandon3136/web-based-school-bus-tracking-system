import { Request, Response } from "express";
import pool from "../config/db";

// ─── ROUTES ───────────────────────────────────

export async function getAllRoutes(_req: Request, res: Response): Promise<void> {
  try {
    const [routes] = await pool.query(
      "SELECT * FROM routes WHERE is_active = TRUE ORDER BY id"
    );
    res.json(routes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getRouteById(req: Request, res: Response): Promise<void> {
  try {
    const [routes] = await pool.query(
      "SELECT * FROM routes WHERE id = ? AND is_active = TRUE", [req.params.id]
    );
    const list = routes as unknown[];
    if (!list.length) { res.status(404).json({ error: "Route not found" }); return; }

    // Also fetch stops for this route
    const [stops] = await pool.query(
      "SELECT * FROM stops WHERE route_id = ? ORDER BY stop_order", [req.params.id]
    );
    res.json({ ...((list[0]) as object), stops });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function createRoute(req: Request, res: Response): Promise<void> {
  const { name, description } = req.body;
  try {
    const [result] = await pool.query(
      "INSERT INTO routes (name, description) VALUES (?, ?)", [name, description || null]
    );
    res.status(201).json({ id: (result as { insertId: number }).insertId, name, description });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateRoute(req: Request, res: Response): Promise<void> {
  const { name, description, is_active } = req.body;
  try {
    await pool.query(
      "UPDATE routes SET name=?, description=?, is_active=? WHERE id=?",
      [name, description, is_active ?? true, req.params.id]
    );
    res.json({ message: "Route updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function deleteRoute(req: Request, res: Response): Promise<void> {
  try {
    const routeId = req.params.id;

    // Check if any active students reference stops on this route
    const [studentCheck] = await pool.query(
      "SELECT COUNT(*) AS cnt FROM students s JOIN stops sp ON s.stop_id = sp.id WHERE sp.route_id = ? AND s.is_active = TRUE",
      [routeId]
    );
    const studentCount = (studentCheck as Array<{ cnt: number }>)[0].cnt;
    if (studentCount > 0) {
      res.status(409).json({ error: `Cannot delete: ${studentCount} student(s) have stops on this route. Reassign them first.` });
      return;
    }

    // Unassign buses from this route
    await pool.query("DELETE FROM bus_routes WHERE route_id = ?", [routeId]);

    // Unassign students' stops that belong to this route (set stop_id to NULL)
    await pool.query(
      "UPDATE students SET stop_id = NULL WHERE stop_id IN (SELECT id FROM stops WHERE route_id = ?)",
      [routeId]
    );

    // Delete all stops for this route
    await pool.query("DELETE FROM stops WHERE route_id = ?", [routeId]);

    // Soft-delete the route
    await pool.query("UPDATE routes SET is_active = FALSE WHERE id = ?", [routeId]);

    res.json({ message: "Route deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── STOPS ────────────────────────────────────

export async function getStopsByRoute(req: Request, res: Response): Promise<void> {
  try {
    const [stops] = await pool.query(
      "SELECT * FROM stops WHERE route_id = ? ORDER BY stop_order", [req.params.routeId]
    );
    res.json(stops);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function createStop(req: Request, res: Response): Promise<void> {
  const { route_id, name, latitude, longitude, stop_order, geofence_radius_m } = req.body;
  try {
    const [result] = await pool.query(
      `INSERT INTO stops (route_id, name, latitude, longitude, stop_order, geofence_radius_m)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [route_id, name, latitude, longitude, stop_order, geofence_radius_m || 300]
    );
    res.status(201).json({ id: (result as { insertId: number }).insertId, ...req.body });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateStop(req: Request, res: Response): Promise<void> {
  const { name, latitude, longitude, stop_order, geofence_radius_m } = req.body;
  try {
    await pool.query(
      "UPDATE stops SET name=?, latitude=?, longitude=?, stop_order=?, geofence_radius_m=? WHERE id=?",
      [name, latitude, longitude, stop_order, geofence_radius_m, req.params.id]
    );
    res.json({ message: "Stop updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function deleteStop(req: Request, res: Response): Promise<void> {
  try {
    await pool.query("DELETE FROM stops WHERE id = ?", [req.params.id]);
    res.json({ message: "Stop deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}
