"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import StatCard from "@/components/StatCard";
import {
  AlertTriangle, Bus, CheckCircle2, LayoutDashboard, MapPin,
  Search, Settings, Users, Clock, Truck, Navigation, Activity,
  Zap, Timer, Route,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

const BusMap = dynamic(() => import("@/components/BusMap"), { ssr: false });


const NAV = [
  { href: "/dashboard/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/admin/fleet", label: "Fleet", icon: Bus },
  { href: "/dashboard/admin/routes", label: "Routes & Stops", icon: MapPin },
  { href: "/dashboard/admin/students", label: "Students", icon: Users },
  { href: "/dashboard/admin/drivers", label: "Drivers", icon: Truck },
  { href: "/dashboard/admin/history", label: "GPS Logs", icon: Clock },
  { href: "/dashboard/admin/settings", label: "Settings", icon: Settings },
];

interface ActiveTrip {
  trip_id: number;
  bus_id: number;
  route_id: number;
  driver_id: number;
  started_at: string;
  driver_name: string;
  plate_number: string;
  route_name: string;
  students_onboard: number;
}

interface HistoryTrip {
  id: number;
  bus_id: number;
  route_id: number;
  driver_id: number;
  started_at: string;
  ended_at: string | null;
  status: string;
  driver_name: string;
  plate_number: string;
  route_name: string;
}

interface GpsLog {
  id: number;
  trip_id: number;
  bus_id: number;
  latitude: number | string;
  longitude: number | string;
  speed_kmh: number | string;
  heading_deg: number | string;
  logged_at: string;
}

export default function GpsLogsPage() {
  const [activeTrips, setActiveTrips] = useState<ActiveTrip[]>([]);
  const [historyTrips, setHistoryTrips] = useState<HistoryTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Selected trip
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [selectedTripType, setSelectedTripType] = useState<"active" | "history" | null>(null);
  const [gpsLogs, setGpsLogs] = useState<GpsLog[]>([]);
  const [gpsLoading, setGpsLoading] = useState(false);

  async function loadActiveTrips() {
    try {
      const res = await apiFetch("/api/trips/active");
      if (res.ok) { const d = await res.json(); setActiveTrips(Array.isArray(d) ? d : []); }
    } catch { /* ignore */ }
  }

  async function loadHistory() {
    try {
      const res = await apiFetch("/api/trips/history?limit=50");
      if (res.ok) { const d = await res.json(); setHistoryTrips(Array.isArray(d) ? d : []); }
    } catch { /* ignore */ }
  }

  async function loadGpsLogs(tripId: number) {
    setGpsLoading(true);
    try {
      const res = await apiFetch(`/api/trips/${tripId}/gps`);
      if (res.ok) { const d = await res.json(); setGpsLogs(Array.isArray(d) ? d : []); }
      else setGpsLogs([]);
    } catch { setGpsLogs([]); }
    finally { setGpsLoading(false); }
  }

  useEffect(() => {
    Promise.all([loadActiveTrips(), loadHistory()])
      .catch(() => setLoadError("Could not load trip data."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedTripId === null) return;
    loadGpsLogs(selectedTripId);
  }, [selectedTripId]);

  // Combined trip list for search/filter
  const allTrips = useMemo(() => {
    const active = activeTrips.map(t => ({
      id: t.trip_id, type: "active" as const, bus: t.plate_number,
      driver: t.driver_name, route: t.route_name, started: t.started_at,
      ended: null, status: "in_progress",
    }));
    const history = historyTrips.map(t => ({
      id: t.id, type: "history" as const, bus: t.plate_number,
      driver: t.driver_name, route: t.route_name, started: t.started_at,
      ended: t.ended_at, status: t.status,
    }));
    return [...active, ...history];
  }, [activeTrips, historyTrips]);

  const filteredTrips = useMemo(() => {
    let list = allTrips;
    if (statusFilter !== "all") list = list.filter(t => t.status === statusFilter);
    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase();
      list = list.filter(t =>
        t.bus.toLowerCase().includes(s) || t.driver.toLowerCase().includes(s) || t.route.toLowerCase().includes(s)
      );
    }
    return list;
  }, [allTrips, statusFilter, searchTerm]);

  // Stats
  const totalTrips = allTrips.length;
  const completedTrips = allTrips.filter(t => t.status === "completed").length;
  const activeCount = activeTrips.length;
  const totalLogs = gpsLogs.length;

  // GPS data for map
  const routeCoords: [number, number][] = gpsLogs.map(l => [Number(l.latitude), Number(l.longitude)]);
  const stops: { id: string; name: string; lat: number; lng: number }[] = [];
  const latestPos = gpsLogs.length > 0 ? { lat: Number(gpsLogs[gpsLogs.length - 1].latitude), lng: Number(gpsLogs[gpsLogs.length - 1].longitude) } : null;

  // Max speed
  const maxSpeed = gpsLogs.length > 0 ? Math.max(...gpsLogs.map(l => Number(l.speed_kmh) || 0)).toFixed(0) : "—";
  const avgSpeed = gpsLogs.length > 0 ? (gpsLogs.reduce((sum, l) => sum + (Number(l.speed_kmh) || 0), 0) / gpsLogs.length).toFixed(0) : "—";

  function selectTrip(id: number, type: "active" | "history") {
    setSelectedTripId(id);
    setSelectedTripType(type);
  }

  function formatTime(dt: string) {
    try { return new Date(dt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
    catch { return dt; }
  }

  function statusColor(status: string) {
    if (status === "in_progress") return { bg: "var(--teal-light)", fg: "var(--teal)" };
    if (status === "completed") return { bg: "color-mix(in srgb, #0F2B5B 10%, transparent)", fg: "var(--navy)" };
    return { bg: "var(--danger-light)", fg: "var(--danger)" };
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--surface)" }}>
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: "var(--navy)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "var(--surface)" }}>
      <Sidebar role="admin" items={NAV} accentColor="var(--navy)" userName="Admin User" />

      <main className="flex-1 min-w-0 p-6 md:p-8 overflow-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>GPS Logs</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            View trip history and GPS tracking data.
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Trips" value={totalTrips} icon={Route} color="#0F2B5B" sub={`${activeCount} active now`} />
          <StatCard label="Completed" value={completedTrips} icon={CheckCircle2} color="#0D9488" sub="Finished trips" />
          <StatCard label="GPS Points" value={totalLogs} icon={Activity} color="#F5A623" sub="For selected trip" />
          <StatCard label="Max Speed" value={totalLogs > 0 ? `${maxSpeed} km/h` : "—"} icon={Zap} color="#DC2626" sub={totalLogs > 0 ? `Avg ${avgSpeed} km/h` : "No data"} />
        </div>

        {/* Error */}
        {loadError && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm bg-white" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
            <AlertTriangle size={16} color="#F5A623" />{loadError}
          </div>
        )}

        {/* Body */}
        <div className="grid xl:grid-cols-[340px_1fr] gap-6">
          {/* Trip list */}
          <section className="bg-white rounded-2xl border" style={{ borderColor: "var(--border)" }}>
            <div className="p-4 border-b space-y-3" style={{ borderColor: "var(--border)" }}>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--slate)" }} />
                <input placeholder="Search trips" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
              </div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 rounded-xl text-sm border outline-none appearance-none"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                <option value="all">All trips</option>
                <option value="in_progress">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="max-h-[520px] overflow-y-auto divide-y" style={{ borderColor: "var(--border)" }}>
              {filteredTrips.length === 0 && (
                <div className="text-center py-12" style={{ color: "var(--slate)" }}>
                  <Clock size={28} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No trips found</p>
                </div>
              )}
              {filteredTrips.map(trip => {
                const isSelected = trip.id === selectedTripId;
                const sc = statusColor(trip.status);
                return (
                  <button key={`${trip.type}-${trip.id}`} onClick={() => selectTrip(trip.id, trip.type)}
                    className="w-full text-left px-4 py-3 transition-colors hover:bg-slate-50"
                    style={{ backgroundColor: isSelected ? "color-mix(in srgb, var(--navy) 5%, var(--card))" : undefined }}>
                    <div className="flex items-start justify-between mb-1">
                      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{trip.bus}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: sc.bg, color: sc.fg }}>
                        {trip.status === "in_progress" ? "Active" : trip.status === "completed" ? "Done" : "Cancelled"}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{trip.driver} · {trip.route}</p>
                    <p className="text-xs mt-1" style={{ color: "var(--slate)" }}>{formatTime(trip.started)}</p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Map + GPS table */}
          <div className="space-y-6">
            {/* Map */}
            <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
              <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedTripId && routeCoords.length > 0 ? "#0D9488" : "var(--slate)" }} />
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {selectedTripId ? (routeCoords.length > 0 ? `${routeCoords.length} GPS points` : "No GPS data for this trip") : "Select a trip to view GPS track"}
                  </p>
                </div>
                {selectedTripId && (
                  <span className="text-xs" style={{ color: "var(--slate)" }}>
                    {gpsLoading ? "Loading..." : `Trip #${selectedTripId}`}
                  </span>
                )}
              </div>
              <div style={{ height: "340px" }}>
                {latestPos ? (
                  <BusMap busPosition={latestPos} stops={stops} routeCoords={routeCoords} height="340px" />
                ) : (
                  <div className="flex items-center justify-center h-full" style={{ color: "var(--slate)" }}>
                    <div className="text-center">
                      <MapPin size={32} className="mx-auto mb-2 opacity-40" />
                      <p className="text-sm">{selectedTripId ? "No GPS data recorded for this trip." : "Select a trip from the list to view its GPS track."}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* GPS log table */}
            <div className="bg-white rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>GPS Log Entries</p>
              </div>
              <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                      <th className="text-left px-4 py-2.5 font-semibold" style={{ color: "var(--text-secondary)" }}>Time</th>
                      <th className="text-left px-4 py-2.5 font-semibold" style={{ color: "var(--text-secondary)" }}>Latitude</th>
                      <th className="text-left px-4 py-2.5 font-semibold" style={{ color: "var(--text-secondary)" }}>Longitude</th>
                      <th className="text-left px-4 py-2.5 font-semibold" style={{ color: "var(--text-secondary)" }}>Speed</th>
                      <th className="text-left px-4 py-2.5 font-semibold" style={{ color: "var(--text-secondary)" }}>Heading</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gpsLogs.length === 0 && (
                      <tr><td colSpan={5} className="text-center py-8" style={{ color: "var(--slate)" }}>
                        <Activity size={20} className="mx-auto mb-1.5 opacity-40" />
                        <p className="text-xs">{selectedTripId ? "No GPS logs for this trip." : "Select a trip to view GPS data."}</p>
                      </td></tr>
                    )}
                    {[...gpsLogs].reverse().map(log => (
                      <tr key={log.id} className="border-b hover:bg-slate-50" style={{ borderColor: "var(--border)" }}>
                        <td className="px-4 py-2" style={{ color: "var(--text-primary)" }}>{formatTime(log.logged_at)}</td>
                        <td className="px-4 py-2 font-mono text-xs" style={{ color: "var(--text-primary)" }}>{Number(log.latitude).toFixed(6)}</td>
                        <td className="px-4 py-2 font-mono text-xs" style={{ color: "var(--text-primary)" }}>{Number(log.longitude).toFixed(6)}</td>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center gap-1">
                            <Zap size={12} style={{ color: Number(log.speed_kmh) > 40 ? "var(--danger)" : "var(--teal)" }} />
                            <span style={{ color: "var(--text-primary)" }}>{Number(log.speed_kmh).toFixed(1)} km/h</span>
                          </span>
                        </td>
                        <td className="px-4 py-2" style={{ color: "var(--slate)" }}>
                          <span className="inline-flex items-center gap-1">
                            <Navigation size={12} />
                            {Number(log.heading_deg).toFixed(0)}°
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
