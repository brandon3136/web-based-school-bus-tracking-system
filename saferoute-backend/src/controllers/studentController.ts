import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import pool from "../config/db";
import { AuthRequest } from "../middleware/auth";
import { sendParentCredentialsEmail } from "../services/emailService";

function generatePassword(length = 10): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function getStudentOptions(_req: Request, res: Response): Promise<void> {
  try {
    const [parents] = await pool.query(`
      SELECT id, name, email, phone
      FROM users
      WHERE role = 'parent' AND is_active = TRUE
      ORDER BY name
    `);
    const [buses] = await pool.query(`
      SELECT id, plate_number, model
      FROM buses
      WHERE is_active = TRUE
      ORDER BY plate_number
    `);
    const [routes] = await pool.query(`
      SELECT id, name
      FROM routes
      WHERE is_active = TRUE
      ORDER BY name
    `);
    const [stops] = await pool.query(`
      SELECT sp.id, sp.name, sp.route_id, r.name AS route_name
      FROM stops sp
      JOIN routes r ON sp.route_id = r.id
      WHERE r.is_active = TRUE
      ORDER BY r.name, sp.stop_order
    `);

    res.json({ parents, buses, routes, stops });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getAllStudents(_req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.query(`
      SELECT s.*, u.name AS parent_name, u.email AS parent_email, u.phone AS parent_phone,
             b.plate_number AS bus_plate, sp.name AS stop_name, r.name AS route_name
      FROM students s
      JOIN users u ON s.parent_id = u.id
      LEFT JOIN buses b  ON s.bus_id  = b.id
      LEFT JOIN routes r ON s.route_id = r.id
      LEFT JOIN stops sp ON s.stop_id = sp.id
      WHERE s.is_active = TRUE
      ORDER BY s.name
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getMyStudents(req: AuthRequest, res: Response): Promise<void> {
  try {
    const [rows] = await pool.query(`
      SELECT s.*, b.plate_number AS bus_plate, r.name AS route_name,
             sp.name AS stop_name, sp.latitude AS stop_lat, sp.longitude AS stop_lng,
             sp.geofence_radius_m
      FROM students s
      LEFT JOIN buses b  ON s.bus_id  = b.id
      LEFT JOIN routes r ON s.route_id = r.id
      LEFT JOIN stops sp ON s.stop_id = sp.id
      WHERE s.parent_id = ? AND s.is_active = TRUE
    `, [req.user!.userId]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function createStudent(req: Request, res: Response): Promise<void> {
  const { name, grade, parent_id, bus_id, route_id, stop_id } = req.body;
  try {
    const [result] = await pool.query(
      "INSERT INTO students (name, grade, parent_id, bus_id, route_id, stop_id) VALUES (?, ?, ?, ?, ?, ?)",
      [name, grade || null, parent_id, bus_id || null, route_id || null, stop_id || null]
    );
    res.status(201).json({ id: (result as { insertId: number }).insertId, name, grade, parent_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function registerStudentsWithParent(req: Request, res: Response): Promise<void> {
  const { parent, students } = req.body;

  if (!parent || typeof parent !== "object") {
    res.status(400).json({ error: "Parent information is required." });
    return;
  }

  const parentName = String(parent.name || "").trim();
  const parentEmail = String(parent.email || "").trim().toLowerCase();
  const parentPhone = String(parent.phone || "").trim();

  if (!parentName || !parentEmail || !parentPhone) {
    res.status(400).json({ error: "Parent name, email, and phone are required." });
    return;
  }

  if (!isValidEmail(parentEmail)) {
    res.status(400).json({ error: "Parent email is invalid." });
    return;
  }

  if (!Array.isArray(students) || students.length === 0) {
    res.status(400).json({ error: "At least one student must be provided." });
    return;
  }

  const studentPayloads = students.map((student: any, index: number) => {
    const studentName = String(student.name || "").trim();
    if (!studentName) {
      throw new Error(`Student ${index + 1} name is required.`);
    }
    return {
      name: studentName,
      grade: student.grade ? String(student.grade).trim() : null,
      bus_id: student.bus_id || null,
      route_id: student.route_id || null,
      stop_id: student.stop_id || null,
    };
  });

  let connection;
  let parentId: number;
  let newPassword: string | null = null;
  let createdParent = false;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT id, role, is_active FROM users WHERE email = ?",
      [parentEmail]
    );
    const existingUsers = rows as Array<{ id: number; role: string; is_active: number }>;

    if (existingUsers.length > 0) {
      const existing = existingUsers[0];
      if (existing.role !== "parent") {
        await connection.rollback();
        res.status(409).json({ error: "A non-parent account already exists with that email." });
        return;
      }
      parentId = existing.id;
      if (!existing.is_active) {
        await connection.query("UPDATE users SET is_active = TRUE WHERE id = ?", [parentId]);
      }
    } else {
      newPassword = generatePassword(10);
      const passwordHash = await bcrypt.hash(newPassword, 10);
      const [insertResult] = await connection.query(
        "INSERT INTO users (name, email, password, role, phone, must_change_password) VALUES (?, ?, ?, 'parent', ?, TRUE)",
        [parentName, parentEmail, passwordHash, parentPhone]
      );
      parentId = (insertResult as { insertId: number }).insertId;
      createdParent = true;
    }

    const insertedStudents = [] as Array<{ id: number; name: string; grade: string | null; parent_id: number; bus_id: number | null; route_id: number | null; stop_id: number | null }>;
    for (const student of studentPayloads) {
      const [result] = await connection.query(
        "INSERT INTO students (name, grade, parent_id, bus_id, route_id, stop_id) VALUES (?, ?, ?, ?, ?, ?)",
        [student.name, student.grade || null, parentId, student.bus_id || null, student.route_id || null, student.stop_id || null]
      );
      insertedStudents.push({
        id: (result as { insertId: number }).insertId,
        name: student.name,
        grade: student.grade,
        parent_id: parentId,
        bus_id: student.bus_id || null,
        route_id: student.route_id || null,
        stop_id: student.stop_id || null,
      });
    }

    await connection.commit();

    const responseBody: Record<string, any> = {
      parent: { id: parentId, name: parentName, email: parentEmail, phone: parentPhone },
      students: insertedStudents,
      parentExisting: !createdParent,
      emailSent: false,
    };

    if (createdParent && newPassword) {
      responseBody.generatedPassword = newPassword;
      try {
        await sendParentCredentialsEmail(parentName, parentEmail, newPassword);
        responseBody.emailSent = true;
      } catch (emailErr) {
        console.error("Failed to send parent credentials email:", emailErr);
        responseBody.warning = "Student registered successfully, but credential email could not be sent. Please share login details manually.";
      }
    }

    res.status(201).json(responseBody);
  } catch (err: any) {
    console.error(err);
    if (connection) {
      try { await connection.rollback(); } catch (_rollbackErr) { console.error(_rollbackErr); }
    }
    if (err.message?.startsWith("Student")) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  } finally {
    if (connection) connection.release();
  }
}

export async function updateStudent(req: Request, res: Response): Promise<void> {
  const { name, grade, bus_id, route_id, stop_id, is_active } = req.body;
  try {
    await pool.query(
      "UPDATE students SET name=?, grade=?, bus_id=?, route_id=?, stop_id=?, is_active=? WHERE id=?",
      [name, grade, bus_id || null, route_id || null, stop_id || null, is_active ?? true, req.params.id]
    );
    res.json({ message: "Student updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function deleteStudent(req: Request, res: Response): Promise<void> {
  try {
    // Get the parent_id before deactivating
    const [studentRows] = await pool.query(
      "SELECT parent_id FROM students WHERE id = ?",
      [req.params.id]
    );
    const students = studentRows as Array<{ parent_id: number }>;
    if (students.length === 0) {
      res.status(404).json({ error: "Student not found" });
      return;
    }
    const parentId = students[0].parent_id;

    // Soft-delete the student
    await pool.query("UPDATE students SET is_active = FALSE WHERE id = ?", [req.params.id]);

    // Check if the parent has any remaining active students
    const [remaining] = await pool.query(
      "SELECT COUNT(*) AS cnt FROM students WHERE parent_id = ? AND is_active = TRUE",
      [parentId]
    );
    const count = (remaining as Array<{ cnt: number }>)[0].cnt;

    let parentDeactivated = false;
    if (count === 0) {
      // No active students left — deactivate the parent account
      await pool.query("UPDATE users SET is_active = FALSE WHERE id = ?", [parentId]);
      parentDeactivated = true;
    }

    res.json({ message: "Student deactivated", parentDeactivated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}
