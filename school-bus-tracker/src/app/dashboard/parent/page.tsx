"use client";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import StatCard from "@/components/StatCard";
import { MapPin, Bell, Clock, Bus, Home, Settings, GraduationCap, AlertTriangle, Radio } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useSocket, GpsUpdate } from "@/hooks/useSocket";
import { usePushNotification } from "@/hooks/usePushNotification";

const BusMap = dynamic(() => import("@/components/BusMap"), { ssr: false });


const NAV = [
  { href: "/dashboard/parent", label: "Live Tracking", icon: MapPin },
  { href: "/dashboard/parent/alerts", label: "Alerts", icon: Bell },
  { href: "/dashboard/parent/history", label: "Trip History", icon: Clock },
  { href: "/dashboard/parent/settings", label: "Settings", icon: Settings },
];

interface Student {
  id: number;
  name: string;
  grade: string | null;
  bus_id: number | null;
  route_id: number | null;
  stop_id: number | null;
  bus_plate: string | null;
  route_name: string | null;
  stop_name: string | null;
  stop_lat: number | string | null;
  stop_lng: number | string | null;
  geofence_radius_m: number | null;
}

interface RouteStop {
  id: number;
  route_id: number;
  name: string;
  latitude: number | string;
  longitude: number | string;
  stop_order: number;
  geofence_radius_m: number;
}

export default function ParentDashboard() {
  const router = useRouter();
  const push = usePushNotification();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [parentName, setParentName] = useState("Parent");
  const [stops, setStops] = useState<RouteStop[]>([]);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [busPos, setBusPos] = useState<{ lat: number; lng: number } | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [gpsLive, setGpsLive] = useState(false);
  const [hasActiveTrip, setHasActiveTrip] = useState(false);
  const [emergencyBanner, setEmergencyBanner] = useState<{ message: string; timestamp: string } | null>(null);
  const [todayAlerts, setTodayAlerts] = useState<Array<{ id: number; title: string; message: string; created_at: string; plate_number?: string }>>([]);

  useEffect(() => { apiFetch("/api/alerts/mine").then(r => r.ok ? r.json() : []).then((rows) => setTodayAlerts(rows.filter((a: { created_at: string }) => new Date(a.created_at).toDateString() === new Date().toDateString()))).catch(() => {}); }, []);

  // Socket.io connection for real-time GPS
  const { connected: socketConnected, subscribeBus, unsubscribeBus, onGpsUpdate, offGpsUpdate, onTripStarted, offTripStarted, onTripEnded, offTripEnded, onEmergencyAlert } = useSocket();

  // Subscribe to bus room and listen for GPS updates
  useEffect(() => {
    const student = students[selectedIdx];
    if (!student?.bus_id) { setHasActiveTrip(false); return; }
    const busId = student.bus_id;

    setGpsLive(false);
    setHasActiveTrip(false);

    // Check whether this bus currently has an in-progress trip at all — this
    // is what actually distinguishes "no active trip" from "trip active but
    // no GPS fix yet", which a missing/last-known position alone can't tell you.
    apiFetch("/api/trips/active")
      .then((res) => (res.ok ? res.json() : []))
      .then((trips) => {
        if (Array.isArray(trips) && trips.some((t: { bus_id: number }) => t.bus_id === busId)) {
          setHasActiveTrip(true);
        }
      })
      .catch(() => {});

    // Get the bus's last known position immediately, in case a trip is
    // already in progress when this page loads (don't wait for the next live update).
    apiFetch(`/api/buses/${busId}/location`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        const lat = Number(data.latitude);
        const lng = Number(data.longitude);
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
          setBusPos({ lat, lng });
          if (data.trip_status === "in_progress") setGpsLive(true);
        }
      })
      .catch(() => {});

    subscribeBus(busId);

    const handleGpsUpdate = (data: GpsUpdate) => {
      if (data.busId === busId) {
        setBusPos({ lat: data.latitude, lng: data.longitude });
        setGpsLive(true);
        setHasActiveTrip(true);
      }
    };
    const handleTripStarted = (data: { busId: number }) => {
      if (data.busId === busId) setHasActiveTrip(true);
    };
    const handleTripEnded = () => {
      // Any trip ending while we're only tracking one bus at a time is
      // effectively this bus's trip ending, from this page's perspective.
      setHasActiveTrip(false);
      setGpsLive(false);
    };

    onGpsUpdate(handleGpsUpdate);
    onTripStarted(handleTripStarted);
    onTripEnded(handleTripEnded);

    return () => {
      unsubscribeBus(busId);
      offGpsUpdate(handleGpsUpdate);
      offTripStarted(handleTripStarted);
      offTripEnded(handleTripEnded);
    };
  }, [selectedIdx, students, subscribeBus, unsubscribeBus, onGpsUpdate, offGpsUpdate, onTripStarted, offTripStarted, onTripEnded, offTripEnded]);

  // Listen for real-time emergency alerts. These arrive on this parent's own
  // socket room (server-side scoped to their children's buses), independent
  // of which student/bus is currently selected in the UI.
  useEffect(() => {
    onEmergencyAlert((data) => {
      setEmergencyBanner({
        message: data.message || "An emergency has been reported on your child's bus.",
        timestamp: data.timestamp,
      });
      // Also drop it straight into "Today's Alerts" so the list updates live
      // instead of only appearing after a page refresh.
      setTodayAlerts((prev) => [
        {
          id: data.alertId,
          title: "Emergency Alert",
          message: data.message || "An emergency has been reported on your child's bus.",
          created_at: data.timestamp,
        },
        ...prev,
      ]);
    });
  }, [onEmergencyAlert]);

  useEffect(() => {
        const userStr = localStorage.getItem("saferoute_user");
if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setParentName(user.name || "Parent");
      } catch { /* ignore */ }
    }

    // Fetch parent's students
    apiFetch("/api/students/mine")
      .then(res => {
        if (!res.ok) throw new Error("Failed to load students");
        return res.json();
      })
      .then(async (data: Student[]) => {
        setStudents(data);
        if (data.length > 0 && data[0].route_id) {
          // Fetch route stops
          const routeRes = await apiFetch(`/api/routes/${data[0].route_id}/stops`, {
            headers: {},
          });
          if (routeRes.ok) {
            const routeStops: RouteStop[] = await routeRes.json();
            setStops(routeStops);
            const coords: [number, number][] = routeStops.map(s => [
              Number(s.latitude),
              Number(s.longitude),
            ]);
            setRouteCoords(coords);
            if (coords.length > 0) {
              setBusPos({ lat: coords[0][0], lng: coords[0][1] });
              setEta(Math.max(1, coords.length * 3));
            }
          }
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [router]);

  // Load stops for selected student when switching between students
  useEffect(() => {
    const student = students[selectedIdx];
    if (!student?.route_id) return;
    apiFetch(`/api/routes/${student.route_id}/stops`)
      .then(res => (res.ok ? res.json() : []))
      .then((routeStops: RouteStop[]) => {
        setStops(routeStops);
        const coords: [number, number][] = routeStops.map(s => [
          Number(s.latitude),
          Number(s.longitude),
        ]);
        setRouteCoords(coords);
        if (coords.length > 0) {
          setBusPos({ lat: coords[0][0], lng: coords[0][1] });
          setEta(Math.max(1, coords.length * 3));
        }
      })
      .catch(() => {});
  }, [selectedIdx, students]);

  const student = students[selectedIdx] || null;
  const mapStops = stops.map(s => ({
    id: String(s.id),
    name: s.name,
    lat: Number(s.latitude),
    lng: Number(s.longitude),
  }));

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--surface)" }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: "var(--teal)", borderTopColor: "transparent" }} />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--surface)" }}>
        <div className="bg-white rounded-2xl border p-8 max-w-sm text-center" style={{ borderColor: "var(--border)" }}>
          <AlertTriangle size={32} className="mx-auto mb-3" style={{ color: "var(--danger)" }} />
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Something went wrong</p>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{error}</p>
          <button onClick={() => router.push("/login?role=parent")} className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: "var(--teal)" }}>
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="flex min-h-screen" style={{ backgroundColor: "var(--surface)" }}>
        <Sidebar role="parent" items={NAV} accentColor="#0D9488" userName={parentName} />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl border p-8 max-w-sm text-center" style={{ borderColor: "var(--border)" }}>
            <GraduationCap size={40} className="mx-auto mb-3" style={{ color: "var(--slate)" }} />
            <p className="text-lg font-bold mb-1" style={{ color: "var(--text-primary)" }}>No students assigned</p>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Your child hasn't been assigned to the system yet. Please contact your school administrator.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "var(--surface)" }}>
      <Sidebar role="parent" items={NAV} accentColor="#0D9488" userName={parentName} />

      <main className="flex-1 p-6 md:p-8">
        {/* Real-time emergency alert banner */}
        {emergencyBanner && (
          <div
            className="mb-6 flex items-start gap-3 rounded-xl px-4 py-3 border"
            style={{ backgroundColor: "var(--danger-light)", borderColor: "var(--danger)" }}
            role="alert"
          >
            <AlertTriangle size={20} style={{ color: "var(--danger)" }} className="mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: "var(--danger)" }}>Emergency Alert</p>
              <p className="text-sm mt-0.5" style={{ color: "var(--danger)" }}>{emergencyBanner.message}</p>
            </div>
            <button
              onClick={() => setEmergencyBanner(null)}
              className="text-xs font-medium shrink-0"
              style={{ color: "var(--danger)" }}
              aria-label="Dismiss alert"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Header */}
        <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Live Tracking</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
              Monitoring bus for <strong>{student?.name || "—"}</strong>
              {student?.route_name ? ` · ${student.route_name}` : ""}
            </p>
          </div>

          <div className="rounded-xl border px-3 py-2" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>Push notifications</p>
            {!push.isSupported ? <p className="text-xs" style={{ color: "var(--slate)" }}>Not supported by this browser</p> : <button type="button" onClick={push.isSubscribed ? push.unsubscribe : push.subscribe} disabled={push.isLoading} className="mt-1 text-xs font-semibold disabled:opacity-60" style={{ color: "var(--teal)" }}>{push.isLoading ? "Updating…" : push.isSubscribed ? "Disable notifications" : "Enable push notifications"}</button>}
            {push.error && <p role="status" className="mt-1 text-xs" style={{ color: "var(--danger)" }}>{push.error}</p>}
            {push.isSubscribed && <p role="status" className="mt-1 text-xs" style={{ color: "var(--teal)" }}>Enabled for this device</p>}
          </div>
          {/* Student selector (if multiple children) */}
          {students.length > 1 && (
            <select
              value={selectedIdx}
              onChange={e => setSelectedIdx(Number(e.target.value))}
              className="px-4 py-2 rounded-xl text-sm border outline-none"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "white" }}
            >
              {students.map((s, i) => (
                <option key={s.id} value={i}>{s.name}{s.grade ? ` (${s.grade})` : ""}</option>
              ))}
            </select>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="ETA to Stop" value={eta !== null ? `${eta}m` : "—"} icon={Clock} color="#0D9488" sub="Your child's stop" />
          <StatCard label="Bus" value={student?.bus_plate || "Unassigned"} icon={Bus} color="#0F2B5B" sub={student?.bus_plate ? "Assigned" : "No bus yet"} />
          <StatCard label="Pickup Stop" value={student?.stop_name || "Unassigned"} icon={MapPin} color="#F5A623" sub={student?.stop_name ? "Assigned" : "No stop yet"} />
          <StatCard label="Grade" value={student?.grade || "—"} icon={GraduationCap} color="#7C3AED" sub="Student grade" />
        </div>

        {/* Map + panel */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", height: "420px" }}>
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: gpsLive ? "#0D9488" : "var(--slate)" }} />
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {gpsLive
                    ? "Live tracking"
                    : routeCoords.length === 0
                    ? "No route assigned yet"
                    : !hasActiveTrip
                    ? "No active trip"
                    : "Waiting for GPS signal..."}
                </p>
              </div>
              {socketConnected && (
                <div className="flex items-center gap-1">
                  <Radio size={12} style={{ color: "#0D9488" }} />
                  <span className="text-xs" style={{ color: "#0D9488" }}>Connected</span>
                </div>
              )}
            </div>
            <div style={{ height: "375px" }}>
              {busPos && mapStops.length > 0 && hasActiveTrip ? (
                <BusMap busPosition={busPos} stops={mapStops} routeCoords={routeCoords} height="375px" />
              ) : routeCoords.length > 0 && !hasActiveTrip ? (
                <div className="flex items-center justify-center h-full" style={{ color: "var(--slate)" }}>
                  <div className="text-center">
                    <MapPin size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>No active trip</p>
                    <p className="mt-1 text-xs">This bus isn't on a trip right now.</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full" style={{ color: "var(--slate)" }}>
                  <div className="text-center">
                    <MapPin size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No route or stops assigned to this student yet.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stop list */}
          <div className="bg-white rounded-2xl border p-5" style={{ borderColor: "var(--border)" }}>
            <h2 className="font-semibold text-sm mb-4" style={{ color: "var(--text-primary)" }}>
              {student?.route_name ? `${student.route_name} – Stops` : "Route Stops"}
            </h2>
            {stops.length > 0 ? (
              <div className="space-y-3">
                {stops.map((stop, i) => {
                  const isChildStop = student?.stop_id === stop.id;
                  return (
                    <div key={stop.id} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{
                            backgroundColor: isChildStop ? "#0D9488" : "var(--border)",
                            color: isChildStop ? "white" : "var(--slate)",
                          }}>
                          {i + 1}
                        </div>
                        {i < stops.length - 1 && <div className="w-px h-6 mt-1" style={{ backgroundColor: "var(--border)" }} />}
                      </div>
                      <div className="pt-0.5">
                        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          {stop.name}
                          {isChildStop && <span className="ml-1.5 text-xs font-semibold" style={{ color: "var(--teal)" }}>· Your stop</span>}
                        </p>
                        <p className="text-xs" style={{ color: "var(--slate)" }}>
                          {isChildStop ? "Pickup / Drop-off" : `Stop ${i + 1}`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6">
                <MapPin size={24} className="mx-auto mb-2 opacity-30" style={{ color: "var(--slate)" }} />
                <p className="text-xs" style={{ color: "var(--slate)" }}>No stops assigned to this route yet.</p>
              </div>
            )}

            {/* Alert badge */}
            {student?.stop_id && (
              <div className="mt-5 rounded-xl p-4 flex gap-3" style={{ backgroundColor: "var(--teal-light)" }}>
                <Bell size={16} style={{ color: "var(--teal)", flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p className="text-xs font-semibold" style={{ color: "var(--teal)" }}>Proximity alert active</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--teal)" }}>
                    You'll be notified when the bus is near {student.stop_name || "your stop"}.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent alerts */}
        <div className="mt-6 bg-white rounded-2xl border p-5" style={{ borderColor: "var(--border)" }}>
          <h2 className="font-semibold text-sm mb-4" style={{ color: "var(--text-primary)" }}>Today's Alerts</h2>
          {todayAlerts.length === 0 ? (
            <div className="text-center py-6">
              <Bell size={24} className="mx-auto mb-2 opacity-30" style={{ color: "var(--slate)" }} />
              <p className="text-sm" style={{ color: "var(--slate)" }}>No alerts today.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayAlerts.map((a) => (
                <article
                  key={a.id}
                  className="flex items-start gap-3 rounded-xl border p-3"
                  style={{ borderColor: "var(--border)" }}
                >
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: "var(--danger)" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{a.title}</p>
                    <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{a.message}</p>
                    <p className="mt-1.5 text-xs" style={{ color: "var(--slate)" }}>
                      {new Date(a.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {a.plate_number ? ` · ${a.plate_number}` : ""}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}