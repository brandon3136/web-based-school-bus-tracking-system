// Thin client for the Traccar REST API.
// Docs: https://www.traccar.org/api-reference/

const TRACCAR_URL = (process.env.TRACCAR_URL || "").replace(/\/$/, "");
const TRACCAR_EMAIL = process.env.TRACCAR_EMAIL || "";
const TRACCAR_PASSWORD = process.env.TRACCAR_PASSWORD || "";

function authHeader(): string {
  const token = Buffer.from(`${TRACCAR_EMAIL}:${TRACCAR_PASSWORD}`).toString("base64");
  return `Basic ${token}`;
}

export interface TraccarPosition {
  id: number;
  deviceId: number;
  latitude: number;
  longitude: number;
  speed: number;      // knots
  course: number;      // degrees, 0-360
  fixTime: string;      // ISO timestamp
  attributes: Record<string, unknown>;
}

export interface TraccarDevice {
  id: number;
  name: string;
  uniqueId: string; // this is the IMEI / identifier you registered the device with in Traccar
  status: "online" | "offline" | "unknown";
  lastUpdate: string;
}

async function traccarGet<T>(path: string): Promise<T> {
  if (!TRACCAR_URL || !TRACCAR_EMAIL || !TRACCAR_PASSWORD) {
    throw new Error("Traccar is not configured (TRACCAR_URL / TRACCAR_EMAIL / TRACCAR_PASSWORD)");
  }

  const res = await fetch(`${TRACCAR_URL}${path}`, {
    headers: { Authorization: authHeader() },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Traccar API ${path} failed: ${res.status} ${body}`);
  }

  return res.json() as Promise<T>;
}

// Latest known position for every device visible to this Traccar account
export function getPositions(): Promise<TraccarPosition[]> {
  return traccarGet<TraccarPosition[]>("/api/positions");
}

// All devices visible to this Traccar account — handy for a one-off script
// to look up each device's numeric `id` (what you store as traccar_device_id on a bus).
export function getDevices(): Promise<TraccarDevice[]> {
  return traccarGet<TraccarDevice[]>("/api/devices");
}
