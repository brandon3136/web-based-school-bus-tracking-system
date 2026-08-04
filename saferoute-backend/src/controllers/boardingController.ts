import { Request, Response } from "express";
import pool from "../config/db";
import { AuthRequest } from "../middleware/auth";
import { getIo } from "../socket/socketServer";
import { sendPushToParent } from "../services/pushService";

export async function getBoardingList(req: Request, res: Response): Promise<void> {
  const { tripId } = req.params;
  try {
    const [rows] = await pool.query(`
      SELECT br.*, s.name AS student_name, s.grade, sp.name AS stop_name
      FROM boarding_records br
      JOIN students s ON br.student_id = s.id
      LEFT JOIN stops sp ON br.stop_id = sp.id
      WHERE br.trip_id = ?
      ORDER BY br.boarded_at ASC
    `, [tripId]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Driver marks a student as boarded
export async function markBoarded(req: AuthRequest, res: Response): Promise<void> {
  const { trip_id, student_id, stop_id } = req.body;
  try {
    // Upsert – if already boarded, ignore
    await pool.query(
      `INSERT INTO boarding_records (trip_id, student_id, stop_id)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE stop_id = VALUES(stop_id)`,
      [trip_id, student_id, stop_id || null]
    );

    // Look up student name and parent for notification
    const [students] = await pool.query(
      "SELECT s.name AS student_name, s.parent_id, b.plate_number FROM students s JOIN buses b ON s.bus_id = b.id WHERE s.id = ?",
      [student_id]
    );
    const studentRows = students as Array<{ student_name: string; parent_id: number; plate_number: string }>;

    if (studentRows.length > 0) {
      const { student_name, parent_id, plate_number } = studentRows[0];

      // Emit Socket.io event to parent room
      getIo().to(`parent:${parent_id}`).emit("boarding:alert", {
        studentName: student_name,
        busPlate: plate_number,
        tripId: trip_id,
        timestamp: new Date().toISOString(),
      });

      // Send Web Push to parent
      await sendPushToParent(parent_id, {
        title: `🧒 ${student_name} boarded the bus`,
        body: `Your child has boarded bus ${plate_number}.`,
        data: { type: "boarding", studentId: student_id, tripId: trip_id },
      });
    }

    res.status(201).json({ message: "Student marked as boarded" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Driver marks a student as alighted
export async function markAlighted(req: Request, res: Response): Promise<void> {
  const { trip_id, student_id } = req.body;
  try {
    await pool.query(
      "UPDATE boarding_records SET alighted_at = NOW() WHERE trip_id = ? AND student_id = ?",
      [trip_id, student_id]
    );
    res.json({ message: "Student marked as alighted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Get students assigned to a bus (for driver's checklist)
export async function getStudentsForBus(req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.query(`
      SELECT s.id, s.name, s.grade, sp.name AS stop_name, sp.id AS stop_id,
             u.name AS parent_name, u.phone AS parent_phone
      FROM students s
      JOIN users u  ON s.parent_id = u.id
      LEFT JOIN stops sp ON s.stop_id = sp.id
      WHERE s.bus_id = ? AND s.is_active = TRUE
      ORDER BY sp.stop_order, s.name
    `, [req.params.busId]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}
