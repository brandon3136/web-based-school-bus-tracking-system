import pool from "../config/db";
import { getIo } from "../socket/socketServer";
import { checkGeofences } from "../services/geofenceService";
import { getPositions } from "../services/traccarService";
import { GpsUpdatePayload } from "../types";

const POLL_INTERVAL_MS = Number(process.env.TRACCAR_POLL_INTERVAL_MS || 10000);

// Remembers the last Traccar position id we already wrote per device,
// so we don't insert the same fix twice between polls.
const lastPositionId = new Map<number, number>();

let timer: NodeJS.Timeout | null = null;

export function startTraccarPoller(): void {
  if (!process.env.TRACCAR_URL) {
    console.log("ℹ️  TRACCAR_URL not set — Traccar GPS polling disabled");
    return;
  }
  if (timer) return; // already running

  console.log(`✅ Traccar poller started (every ${POLL_INTERVAL_MS}ms)`);
  timer = setInterval(() => {
    poll().catch((err) => console.error("Traccar poll error:", err));
  }, POLL_INTERVAL_MS);
}

export function stopTraccarPoller(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

async function poll(): Promise<void> {
  const positions = await getPositions();
  if (!positions.length) return;

  // Only buses that (a) have a Traccar device mapped and (b) currently have an
  // active trip are eligible — this mirrors how the driver-app /trips/gps endpoint works.
  const [busRows] = await pool.query(
    `SELECT b.id AS bus_id, b.traccar_device_id, t.id AS trip_id
     FROM buses b
     JOIN trips t ON t.bus_id = b.id AND t.status = 'in_progress'
     WHERE b.traccar_device_id IS NOT NULL`
  );
  const buses = busRows as Array<{ bus_id: number; traccar_device_id: string; trip_id: number }>;
  if (!buses.length) return;

  const busByDevice = new Map(buses.map((b) => [String(b.traccar_device_id), b]));

  for (const pos of positions) {
    const bus = busByDevice.get(String(pos.deviceId));
    if (!bus) continue; // this device isn't mapped to a bus with an active trip right now

    if (lastPositionId.get(pos.deviceId) === pos.id) continue; // already processed this exact fix
    lastPositionId.set(pos.deviceId, pos.id); // mark as processed either way, so we don't re-warn every poll

    // Skip fixes the tracker itself doesn't trust yet (e.g. cold start, no satellite lock).
    // These commonly report bogus coordinates like (0,0), which shows up as "in the ocean" on the map.
    if (pos.valid === false) {
      console.warn(`Traccar device ${pos.deviceId}: skipping invalid fix (no GPS lock yet)`);
      continue;
    }
    // Extra safety net: (0,0) — "null island" — is never a real bus location for this fleet.
    if (Math.abs(pos.latitude) < 0.0001 && Math.abs(pos.longitude) < 0.0001) {
      console.warn(`Traccar device ${pos.deviceId}: skipping (0,0) fix`);
      continue;
    }

    const latitude = pos.latitude;
    const longitude = pos.longitude;
    const speedKmh = pos.speed * 1.852; // Traccar reports speed in knots
    const headingDeg = pos.course;

    await pool.query(
      `INSERT INTO gps_logs (trip_id, bus_id, latitude, longitude, speed_kmh, heading_deg)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [bus.trip_id, bus.bus_id, latitude, longitude, speedKmh, headingDeg]
    );

    const payload: GpsUpdatePayload = {
      tripId: bus.trip_id,
      busId: bus.bus_id,
      latitude,
      longitude,
      speedKmh,
      headingDeg,
    };

    // Same socket event the frontend map already listens for — no client changes needed.
    getIo().to(`bus:${bus.bus_id}`).emit("gps:update", payload);

    await checkGeofences(bus.bus_id, bus.trip_id, latitude, longitude);
  }
}
