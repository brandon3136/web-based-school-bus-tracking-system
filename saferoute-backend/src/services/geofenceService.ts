import pool from "../config/db";
import { sendPushToParent } from "./pushService";
import { getIo } from "../socket/socketServer";

// Haversine formula – distance in metres between two lat/lng points
function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Track which (trip, stop) pairs have already fired to avoid duplicate alerts
const fired = new Set<string>();

export async function checkGeofences(
  busId: number,
  tripId: number,
  busLat: number,
  busLng: number
): Promise<void> {
  try {
    // Get all stops for the route of this trip
    const [stops] = await pool.query(`
      SELECT s.id, s.name, s.latitude, s.longitude, s.geofence_radius_m,
             s.route_id
      FROM stops s
      JOIN routes r ON s.route_id = r.id
      JOIN trips  t ON t.route_id  = r.id
      WHERE t.id = ?
    `, [tripId]);

    const stopList = stops as Array<{
      id: number; name: string; latitude: number; longitude: number;
      geofence_radius_m: number; route_id: number;
    }>;

    for (const stop of stopList) {
      const key = `${tripId}:${stop.id}`;
      if (fired.has(key)) continue; // already fired for this stop this trip

      const dist = haversineMetres(busLat, busLng, stop.latitude, stop.longitude);
      if (dist <= stop.geofence_radius_m) {
        fired.add(key);

        // Find students who board at this stop and get their parent IDs
        const [students] = await pool.query(`
          SELECT s.id AS student_id, s.name AS student_name, s.parent_id
          FROM students s
          WHERE s.stop_id = ? AND s.bus_id = ? AND s.is_active = TRUE
        `, [stop.id, busId]);

        const studentList = students as Array<{
          student_id: number; student_name: string; parent_id: number;
        }>;

        for (const student of studentList) {
          // Emit socket event to parent room
          getIo()
            .to(`parent:${student.parent_id}`)
            .emit("proximity:alert", {
              stopName:    stop.name,
              studentName: student.student_name,
              busId,
              tripId,
              distanceM:   Math.round(dist),
            });

          // Send Web Push notification
          await sendPushToParent(student.parent_id, {
            title: `🚌 Bus approaching ${stop.name}`,
            body:  `The bus is ${Math.round(dist)}m away from ${stop.name}. ${student.student_name} should head to the stop.`,
            data:  { type: "proximity", stopId: stop.id, busId, tripId },
          });
        }
      }
    }
  } catch (err) {
    console.error("Geofence check error:", err);
  }
}

// Clear fired cache when a trip ends (called from trip controller)
export function clearTripGeofences(tripId: number): void {
  for (const key of fired) {
    if (key.startsWith(`${tripId}:`)) fired.delete(key);
  }
}
