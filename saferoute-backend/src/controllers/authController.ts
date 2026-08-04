import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../config/db";
import { UserRole } from "../types";

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  try {
    const [rows] = await pool.query(
      "SELECT id, name, email, password, role, phone FROM users WHERE email = ? AND is_active = TRUE",
      [email]
    );

    const users = rows as Array<{
      id: number; name: string; email: string;
      password: string; role: UserRole; phone: string;
    }>;

    if (!users.length) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const user = users[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
    const token = jwt.sign(
      { userId: user.id, role: user.role, email: user.email },
      process.env.JWT_SECRET || "secret",
      { expiresIn: expiresIn as "7d" }
    );

    // Parse expiry to milliseconds for cookie maxAge
    const days = parseInt(expiresIn) || 7;
    const maxAge = days * 24 * 60 * 60 * 1000;

    // Set HTTP-only cookie with the JWT (not accessible from JavaScript)
    res.cookie("saferoute_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
      path: "/",
    });

    // Set readable role cookie for Next.js middleware route protection
    res.cookie("saferoute_role", user.role, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
      path: "/",
    });

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function register(req: Request, res: Response): Promise<void> {
  const { name, email, password, role, phone } = req.body;

  const allowedRoles: UserRole[] = ["parent", "admin", "driver"];
  if (!allowedRoles.includes(role)) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }

  try {
    const [existing] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
    if ((existing as unknown[]).length > 0) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      "INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)",
      [name, email, hash, role, phone || null]
    );

    const insertId = (result as { insertId: number }).insertId;
    const token = jwt.sign(
      { userId: insertId, role, email },
      process.env.JWT_SECRET || "secret",
      { expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as "7d" }
    );

    res.status(201).json({
      token,
      user: { id: insertId, name, email, role, phone },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getMe(req: Request & { user?: { userId: number } }, res: Response): Promise<void> {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, email, role, phone, created_at FROM users WHERE id = ?",
      [req.user?.userId]
    );
    const users = rows as unknown[];
    if (!users.length) { res.status(404).json({ error: "User not found" }); return; }
    res.json(users[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateProfile(req: Request & { user?: { userId: number } }, res: Response): Promise<void> {
  const { name, phone, email } = req.body;
  if (!name?.trim()) {
    res.status(400).json({ error: "Name is required." });
    return;
  }
  try {
    // If email is being changed, check uniqueness
    if (email?.trim()) {
      const [existing] = await pool.query(
        "SELECT id FROM users WHERE email = ? AND id != ?",
        [email.trim().toLowerCase(), req.user?.userId]
      );
      if ((existing as unknown[]).length > 0) {
        res.status(409).json({ error: "That email is already in use by another account." });
        return;
      }
    }

    if (email?.trim()) {
      await pool.query(
        "UPDATE users SET name = ?, phone = ?, email = ? WHERE id = ?",
        [name.trim(), phone?.trim() || null, email.trim().toLowerCase(), req.user?.userId]
      );
    } else {
      await pool.query(
        "UPDATE users SET name = ?, phone = ? WHERE id = ?",
        [name.trim(), phone?.trim() || null, req.user?.userId]
      );
    }
    res.json({ message: "Profile updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function changePassword(req: Request & { user?: { userId: number } }, res: Response): Promise<void> {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Current password and new password are required." });
    return;
  }
  if (newPassword.length < 6) {
    res.status(400).json({ error: "New password must be at least 6 characters." });
    return;
  }
  try {
    const [rows] = await pool.query("SELECT password FROM users WHERE id = ?", [req.user?.userId]);
    const users = rows as Array<{ password: string }>;
    if (!users.length) { res.status(404).json({ error: "User not found" }); return; }

    const valid = await bcrypt.compare(currentPassword, users[0].password);
    if (!valid) {
      res.status(401).json({ error: "Current password is incorrect." });
      return;
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE users SET password = ?, must_change_password = FALSE WHERE id = ?", [hash, req.user?.userId]);
    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function logout(_req: Request, res: Response): Promise<void> {
  res.clearCookie("saferoute_token", { path: "/" });
  res.clearCookie("saferoute_role", { path: "/" });
  res.json({ message: "Logged out" });
}

export async function resetDatabase(_req: Request, res: Response): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Delete all transactional data
    await connection.query("DELETE FROM gps_logs");
    await connection.query("DELETE FROM boarding_records");
    await connection.query("DELETE FROM emergency_alerts");
    await connection.query("DELETE FROM push_subscriptions");
    await connection.query("DELETE FROM trips");

    // Delete all students
    await connection.query("DELETE FROM students");

    // Remove bus-route assignments
    await connection.query("DELETE FROM bus_routes");

    // Delete non-seed buses (keep bus id=1: T 123 DAR)
    await connection.query("DELETE FROM buses WHERE id != 1");

    // Reset bus 1 to seed state
    await connection.query("UPDATE buses SET driver_id = 2, is_active = TRUE WHERE id = 1");

    // Re-add seed bus-route assignment
    await connection.query("INSERT INTO bus_routes (bus_id, route_id) VALUES (1, 1)");

    // Delete non-seed routes and stops
    await connection.query("DELETE FROM stops WHERE route_id != 1");
    await connection.query("DELETE FROM routes WHERE id != 1");

    // Re-add seed stops for route 1
    await connection.query("DELETE FROM stops WHERE route_id = 1");
    await connection.query(`INSERT INTO stops (route_id, name, latitude, longitude, stop_order, geofence_radius_m) VALUES
      (1, 'Msasani Junction', -6.8150, 39.2650, 1, 300),
      (1, 'Oyster Bay Stop', -6.8050, 39.2750, 2, 300),
      (1, 'Masaki Roundabout', -6.7950, 39.2850, 3, 300),
      (1, 'School Gate', -6.7900, 39.2900, 4, 200)`);

    // Delete non-seed users (keep admin=1, driver=2, parent=3)
    await connection.query("DELETE FROM users WHERE id > 3");

    // Reset seed users to active
    await connection.query("UPDATE users SET is_active = TRUE WHERE id IN (1, 2, 3)");

    await connection.commit();
    res.json({ message: "Database reset to seed state successfully" });
  } catch (err) {
    await connection.rollback();
    console.error("Database reset error:", err);
    res.status(500).json({ error: "Failed to reset database" });
  } finally {
    connection.release();
  }
}
