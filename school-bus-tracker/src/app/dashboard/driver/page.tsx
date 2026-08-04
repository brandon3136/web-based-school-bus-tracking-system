"use client";
import dynamic from "next/dynamic";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import StatCard from "@/components/StatCard";
import {
  MapPin, Users, AlertTriangle, CheckCircle2,
  Home, Clock, Bus, Route,
  Play, Square, Radio, KeyRound,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

const BusMap = dynamic(() => import("@/components/BusMap"), { ssr: false });


const NAV = [
  { href: "/dashboard/driver", label: "My Trip", icon: MapPin },
  { href: "/dashboard/driver/students", label: "Student List", icon: Users },
  { href: "/dashboard/driver/history", label: "Trip History", icon: Clock },
  { href: "/dashboard/driver/settings", label: "Settings", icon: KeyRound },
];

interface BusInfo {
  id: number;
  plate_number: string;
  model: string | null;
  capacity: number;
  route_id: number | null;
  route_name: string | null;
}

interface StudentRecord {
  id: number;
  name: string;
  grade: string | null;
  stop_name: string | null;
  stop_id: number | null;
  parent_name: string;
  parent_phone: string | null;
}

interface RouteStop {
  id: number;
  name: string;
  latitude: number | string;
  longitude: number | string;
  stop_order: number;
}

export default function DriverDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Driver info
  const [driverName, setDriverName] = useState("Driver");

  // Bus data
  const [bus, setBus] = useState<BusInfo | null>(null);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);

  // Trip state
  const [tripId, setTripId] = useState<number | null>(null);
  const [tripActive, setTripActive] = useState(false);
  const [tripLoading, setTripLoading] = useState(false);
  const [tripError, setTripError] = useState("");
  const [tripStartedAt, setTripStartedAt] = useState<string | null>(null);

  // Boarding state
  const [boardedIds, setBoardedIds] = useState<Set<number>>(new Set());
  const [boardingLoading, setBoardingLoading] = useState<number | null>(null);

  // Emergency
  const [emergencySent, setEmergencySent] = useState(false);
  const [emergencyLoading, setEmergencyLoading] = useState(false);

  // Success message
  const [successMsg, setSuccessMsg] = useState("");

  // GPS tracking state
  const [gpsPosition, setGpsPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsTracking, setGpsTracking] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [gpsSpeed, setGpsSpeed] = useState(0);
  const [lastGpsSent, setLastGpsSent] = useState(0);
  const watchIdRef = useRef<number | null>(null);
  const tripIdRef = useRef<number | null>(null);
  const busIdRef = useRef<number | null>(null);

  // Keep refs in sync with state for use inside geolocation callback
  useEffect(() => { tripIdRef.current = tripId; }, [tripId]);
  useEffect(() => { busIdRef.current = bus?.id ?? null; }, [bus]);

  // Load driver data
  useEffect(() => {
// Get driver name from localStorage
    const userStr = localStorage.getItem("saferoute_user");
    if (userStr) {
      try { setDriverName(JSON.parse(userStr).name || "Driver"); } catch { /* ignore */ }
    }

    // Fetch buses to find the one assigned to this driver
    apiFetch("/api/buses")
      .then(res => res.ok ? res.json() : [])
      .then(async (buses: any[]) => {
        if (!Array.isArray(buses)) { setError("Could not load bus data."); return; }

        // Find bus assigned to this driver (match by user info)
        const user = userStr ? JSON.parse(userStr) : null;
        const myBus = buses.find((b: any) => b.driver_name === user?.name) || buses[0];

        if (!myBus) {
          setError("No bus is assigned to your account. Please contact your administrator.");
          return;
        }

        setBus(myBus);

        // Fetch students for this bus
        const studentsRes = await apiFetch(`/api/buses/${myBus.id}/students`);
        if (studentsRes.ok) {
          const studentData = await studentsRes.json();
          setStudents(Array.isArray(studentData) ? studentData : []);
        }

        // Fetch route stops
        if (myBus.route_id) {
          const stopsRes = await apiFetch(`/api/routes/${myBus.route_id}/stops`, {
            headers: {},
          });
          if (stopsRes.ok) {
            const stopsData = await stopsRes.json();
            setRouteStops(Array.isArray(stopsData) ? stopsData : []);
          }
        }

        // Check for existing active trip on this bus
        const activeRes = await apiFetch("/api/trips/active");
        if (activeRes.ok) {
          const activeTrips = await activeRes.json();
          if (Array.isArray(activeTrips)) {
            const myTrip = activeTrips.find((t: any) => t.bus_id === myBus.id);
            if (myTrip) {
              setTripId(myTrip.trip_id);
              setTripActive(true);
              setTripStartedAt(myTrip.started_at);
            }
          }
        }
      })
      .catch(() => setError("Could not connect to the server."))
      .finally(() => setLoading(false));
  }, []);

  // ── GPS Geolocation Tracking ──
  const sendGpsUpdate = useCallback(async (lat: number, lng: number, speed: number, heading: number) => {
    const currentTripId = tripIdRef.current;
    const currentBusId = busIdRef.current;
    if (!currentTripId || !currentBusId) return;

    // Throttle: only send every 4 seconds
    const now = Date.now();
    if (now - lastGpsSent < 4000) return;
    setLastGpsSent(now);

    try {
      await apiFetch("/api/trips/gps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trip_id: currentTripId,
          bus_id: currentBusId,
          latitude: lat,
          longitude: lng,
          speed_kmh: Math.round(speed * 3.6), // m/s to km/h
          heading_deg: Math.round(heading),
        }),
      });
    } catch { /* Silently ignore GPS send failures */ }
  }, [lastGpsSent]);

  function startGpsTracking() {
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser.");
      return;
    }

    setGpsError("");
    setGpsTracking(true);

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy, speed, heading } = position.coords;
        setGpsPosition({ lat: latitude, lng: longitude });
        setGpsAccuracy(Math.round(accuracy));
        setGpsSpeed(speed ? Math.round(speed * 3.6) : 0);

        // Low accuracy warning
        if (accuracy > 100) {
          setGpsError(`Low GPS accuracy (${Math.round(accuracy)}m). Move to an open area for better signal.`);
        } else {
          setGpsError("");
        }

        // Send to backend
        sendGpsUpdate(latitude, longitude, speed || 0, heading || 0);
      },
      (err) => {
        setGpsTracking(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setGpsError("Location permission denied. Please allow location access in your browser settings.");
            break;
          case err.POSITION_UNAVAILABLE:
            setGpsError("GPS signal unavailable. Make sure GPS is enabled on your device.");
            break;
          case err.TIMEOUT:
            setGpsError("GPS request timed out. Try moving to an area with better signal.");
            break;
          default:
            setGpsError("An unknown GPS error occurred.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 2000, // Accept cached positions up to 2 seconds old
      }
    );

    watchIdRef.current = id;
  }

  function stopGpsTracking() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setGpsTracking(false);
    setGpsPosition(null);
    setGpsAccuracy(null);
    setGpsSpeed(0);
    setGpsError("");
  }

  // Cleanup geolocation on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Stats
  const boardedCount = boardedIds.size;
  const totalStudents = students.length;

  // Group students by stop
  const studentsByStop = useMemo(() => {
    const groups: Record<string, StudentRecord[]> = {};
    students.forEach(s => {
      const stopKey = s.stop_name || "Unassigned";
      if (!groups[stopKey]) groups[stopKey] = [];
      groups[stopKey].push(s);
    });
    return groups;
  }, [students]);

  // Map data
  const mapStops = routeStops.map(s => ({
    id: String(s.id),
    name: s.name,
    lat: Number(s.latitude),
    lng: Number(s.longitude),
  }));
  const routeCoords: [number, number][] = routeStops.map(s => [Number(s.latitude), Number(s.longitude)]);
  const defaultPos = routeCoords.length > 0
    ? { lat: routeCoords[0][0], lng: routeCoords[0][1] }
    : { lat: -6.8, lng: 39.28 };
  const mapPosition = gpsPosition || defaultPos;

  // Start trip
  async function startTrip() {
    if (!bus) return;
    setTripLoading(true);
    setTripError("");
    try {
      const res = await apiFetch("/api/trips/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bus_id: bus.id, route_id: bus.route_id || 1 }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setTripError(data?.error || "Could not start trip.");
        return;
      }
      setTripId(data.tripId);
      setTripActive(true);
      setTripStartedAt(new Date().toISOString());
      setSuccessMsg("Trip started! GPS tracking active.");
      setTimeout(() => setSuccessMsg(""), 4000);

      // Start GPS tracking
      startGpsTracking();
    } catch { setTripError("Could not connect to the server."); }
    finally { setTripLoading(false); }
  }

  // End trip
  async function endTrip() {
    if (!tripId) return;
    setTripLoading(true);
    setTripError("");

    // Stop GPS tracking first
    stopGpsTracking();

    try {
      const res = await apiFetch("/api/trips/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trip_id: tripId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setTripError(data?.error || "Could not end trip.");
        return;
      }
      setTripId(null);
      setTripActive(false);
      setTripStartedAt(null);
      setSuccessMsg("Trip ended successfully.");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch { setTripError("Could not connect to the server."); }
    finally { setTripLoading(false); }
  }

  // Mark student boarded
  async function toggleBoarded(student: StudentRecord) {
    if (!tripActive || !tripId) return;
    if (boardedIds.has(student.id)) return; // Already boarded, can't undo

    setBoardingLoading(student.id);
    try {
      const res = await apiFetch("/api/boarding/boarded", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trip_id: tripId, student_id: student.id, stop_id: student.stop_id }),
      });
      if (res.ok) {
        setBoardedIds(prev => new Set([...prev, student.id]));
      }
    } catch { /* ignore */ }
    finally { setBoardingLoading(null); }
  }

  // Send emergency
  async function sendEmergency() {
    if (!bus || !tripActive || !tripId || emergencySent) return;
    setEmergencyLoading(true);
    try {
      const res = await apiFetch("/api/alerts/emergency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trip_id: tripId, bus_id: bus.id }),
      });
      if (res.ok) {
        setEmergencySent(true);
        setSuccessMsg("Emergency alert sent! Administrators have been notified.");
        setTimeout(() => { setEmergencySent(false); setSuccessMsg(""); }, 8000);
      }
    } catch { /* ignore */ }
    finally { setEmergencyLoading(false); }
  }

  // Trip duration display
  const [elapsed, setElapsed] = useState("0m");
  useEffect(() => {
    if (!tripActive || !tripStartedAt) return;
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - new Date(tripStartedAt).getTime()) / 60000);
      setElapsed(`${diff}m`);
    }, 10000);
    return () => clearInterval(interval);
  }, [tripActive, tripStartedAt]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--surface)" }}>
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: "var(--bus-yellow)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "var(--surface)" }}>
      <Sidebar role="driver" items={NAV} accentColor="#F5A623" userName={driverName} />

      <main className="flex-1 min-w-0 p-6 md:p-8 overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>My Trip</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {bus ? `${bus.plate_number} · ${bus.route_name || "No route"} · ${bus.model || ""}` : "No bus assigned"}
            </p>
          </div>
          <div className="flex items-center gap-3">
{tripActive && (
              <div className="flex items-center gap-2">
                <Radio size={14} style={{ color: gpsTracking ? "#0D9488" : "var(--slate)" }} className={gpsTracking ? "animate-pulse" : ""} />
                <span className="text-xs font-medium" style={{ color: gpsTracking ? "#0D9488" : "var(--slate)" }}>
                  {gpsTracking
                    ? `GPS active${gpsAccuracy ? ` · ±${gpsAccuracy}m` : ""}${gpsSpeed > 0 ? ` · ${gpsSpeed} km/h` : ""}`
                    : gpsError ? "GPS error" : "Waiting for GPS..."}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)", color: "var(--text-secondary)" }}>
            <AlertTriangle size={16} color="#F5A623" />{error}
          </div>
        )}

        {/* Alerts */}
        {tripError && (
          <div className="mb-5 flex items-center gap-2 rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: "var(--danger-light)", color: "var(--danger)" }}>
            <AlertTriangle size={14} />{tripError}
          </div>
        )}
        {successMsg && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "#0D9488", backgroundColor: "var(--teal-light)", color: "var(--teal)" }}>
            <CheckCircle2 size={16} />{successMsg}
          </div>
        )}
        {emergencySent && (
          <div className="mb-5 rounded-2xl p-4 flex items-center gap-3 text-white" style={{ backgroundColor: "var(--danger)" }}>
            <AlertTriangle size={18} />
            <div>
              <p className="font-semibold text-sm">Emergency alert sent!</p>
              <p className="text-xs opacity-80">Administrator and school staff have been notified.</p>
            </div>
          </div>
        )}
        {gpsError && tripActive && (
          <div className="mb-5 flex items-center gap-2 rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: "var(--bus-yellow-light)", color: "var(--bus-yellow)" }}>
            <AlertTriangle size={14} />{gpsError}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Students Boarded" value={`${boardedCount}/${totalStudents}`} icon={Users} color="#F5A623" sub={tripActive ? "Tap to mark" : "Start trip first"} />
          <StatCard label="Route" value={bus?.route_name || "—"} icon={Route} color="#0D9488" sub={`${routeStops.length} stops`} />
          <StatCard label="Speed" value={tripActive ? `${gpsSpeed} km/h` : "—"} icon={Bus} color="#0F2B5B" sub={tripActive && gpsTracking ? "Live GPS speed" : "Not tracking"} />
          <StatCard label="Trip Duration" value={tripActive ? elapsed : "—"} icon={Clock} color="#7C3AED" sub={tripActive ? "In progress" : "No active trip"} />
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Map */}
          <div className="md:col-span-2 rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", height: "380px" }}>
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: tripActive ? "#F5A623" : "var(--slate)" }} />
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {tripActive ? "Your live position" : "Route preview"}
                </p>
              </div>
              {bus && <span className="text-xs" style={{ color: "var(--slate)" }}>{bus.plate_number}</span>}
            </div>
            <div style={{ height: "335px" }}>
              <BusMap busPosition={mapPosition} stops={mapStops} routeCoords={routeCoords} height="335px" />
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            {/* Trip toggle */}
            <div className="rounded-2xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
              <h2 className="font-semibold text-sm mb-3" style={{ color: "var(--text-primary)" }}>Trip Status</h2>
              {!bus ? (
                <p className="text-sm text-center py-3" style={{ color: "var(--slate)" }}>No bus assigned to your account.</p>
              ) : (
                <>
                  <button onClick={tripActive ? endTrip : startTrip} disabled={tripLoading}
                    className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    style={tripActive
                      ? { backgroundColor: "#DC2626", color: "white" }
                      : { backgroundColor: "#0D9488", color: "white" }}>
                    {tripActive ? <><Square size={15} /> End Trip</> : <><Play size={15} /> Start Trip</>}
                  </button>
                  <p className="text-xs text-center mt-2" style={{ color: "var(--slate)" }}>
                    {tripActive ? `Trip in progress · ${elapsed}` : "No active trip"}
                  </p>
                </>
              )}
            </div>

            {/* Emergency */}
            <div className="rounded-2xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
              <h2 className="font-semibold text-sm mb-1" style={{ color: "var(--text-primary)" }}>Emergency Alert</h2>
              <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
                Instantly notifies all school administrators.
              </p>
              <button onClick={sendEmergency} disabled={emergencySent || !tripActive || emergencyLoading}
                className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
                style={{ backgroundColor: "var(--danger-light)", color: "var(--danger)" }}>
                <AlertTriangle size={15} />
                {emergencyLoading ? "Sending..." : emergencySent ? "Alert sent" : "Send Emergency Alert"}
              </button>
            </div>

            {/* Route stops quick view */}
            {routeStops.length > 0 && (
              <div className="rounded-2xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                <h2 className="font-semibold text-sm mb-3" style={{ color: "var(--text-primary)" }}>Route Stops</h2>
                <div className="space-y-2">
                  {routeStops.map((stop, i) => {
                    const hasStudents = students.some(s => s.stop_id === stop.id);
                    const allBoarded = students.filter(s => s.stop_id === stop.id).every(s => boardedIds.has(s.id));
                    return (
                      <div key={stop.id} className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{
                            backgroundColor: allBoarded && hasStudents ? "var(--teal)" : "var(--border)",
                            color: allBoarded && hasStudents ? "white" : "var(--slate)",
                          }}>
                          {allBoarded && hasStudents ? <CheckCircle2 size={12} /> : i + 1}
                        </div>
                        <p className="text-xs flex-1" style={{ color: "var(--text-primary)" }}>{stop.name}</p>
                        {hasStudents && (
                          <span className="text-xs" style={{ color: "var(--slate)" }}>
                            {students.filter(s => s.stop_id === stop.id).filter(s => boardedIds.has(s.id)).length}/
                            {students.filter(s => s.stop_id === stop.id).length}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Student boarding list */}
        <div className="mt-6 rounded-2xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
              Student Boarding List
              <span className="font-normal ml-2" style={{ color: "var(--slate)" }}>({boardedCount} / {totalStudents} boarded)</span>
            </h2>
            {tripActive && (
              <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: "var(--teal-light)", color: "var(--teal)" }}>
                Tap to mark boarded
              </span>
            )}
          </div>

          {totalStudents === 0 ? (
            <div className="text-center py-8">
              <Users size={28} className="mx-auto mb-2 opacity-30" style={{ color: "var(--slate)" }} />
              <p className="text-sm" style={{ color: "var(--slate)" }}>No students assigned to this bus.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(studentsByStop).map(([stopName, stopStudents]) => (
                <div key={stopName}>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--slate)" }}>
                    <MapPin size={12} className="inline mr-1" />{stopName}
                  </p>
                  <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                    {stopStudents.map(s => {
                      const isBoarded = boardedIds.has(s.id);
                      const isLoading = boardingLoading === s.id;
                      return (
                        <div key={s.id} className="flex items-center gap-4 py-3">
                          <button
                            onClick={() => toggleBoarded(s)}
                            disabled={!tripActive || isBoarded || isLoading}
                            className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors disabled:cursor-not-allowed"
                            style={isBoarded
                              ? { backgroundColor: "#0D9488", borderColor: "#0D9488" }
                              : { borderColor: "var(--border)" }}>
                            {isBoarded && <CheckCircle2 size={14} color="white" />}
                            {isLoading && <div className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: "var(--teal)", borderTopColor: "transparent" }} />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate"
                              style={{ color: isBoarded ? "var(--text-secondary)" : "var(--text-primary)", textDecoration: isBoarded ? "line-through" : undefined }}>
                              {s.name}
                            </p>
                            <p className="text-xs truncate" style={{ color: "var(--slate)" }}>
                              {s.grade || ""} · {s.parent_name}{s.parent_phone ? ` · ${s.parent_phone}` : ""}
                            </p>
                          </div>
                          <span className="text-xs font-medium flex-shrink-0"
                            style={{ color: isBoarded ? "#0D9488" : "var(--slate)" }}>
                            {isBoarded ? "Boarded" : "Waiting"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
