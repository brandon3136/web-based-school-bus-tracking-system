"use client";
import { useState, useEffect, useMemo } from "react";
import Sidebar from "@/components/Sidebar";
import StatCard from "@/components/StatCard";
import { apiFetch } from "@/lib/api";
import {
  MapPin, Users, Clock, Search,
  Bus, Route, CheckCircle2, XCircle, Calendar,
  KeyRound, Play,
} from "lucide-react";

const NAV = [
  { href: "/dashboard/driver", label: "My Trip", icon: MapPin },
  { href: "/dashboard/driver/students", label: "Student List", icon: Users },
  { href: "/dashboard/driver/history", label: "Trip History", icon: Clock },
  { href: "/dashboard/driver/settings", label: "Settings", icon: KeyRound },
];

interface Trip {
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

export default function DriverHistory() {
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [driverName, setDriverName] = useState("Driver");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const userStr = localStorage.getItem("saferoute_user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setDriverName(user.name || "Driver");

        // Fetch trip history for this driver
        apiFetch(`/api/trips/history?driverId=${user.id}&limit=100`)
          .then(res => res.ok ? res.json() : [])
          .then((data: Trip[]) => {
            setTrips(Array.isArray(data) ? data : []);
          })
          .catch(() => {})
          .finally(() => setLoading(false));
      } catch {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const filtered = useMemo(() => {
    let list = trips;
    if (statusFilter !== "all") list = list.filter(t => t.status === statusFilter);
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(t =>
        t.plate_number.toLowerCase().includes(q) ||
        t.route_name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [trips, statusFilter, searchTerm]);

  const completed = trips.filter(t => t.status === "completed").length;
  const cancelled = trips.filter(t => t.status === "cancelled").length;
  const totalDuration = trips
    .filter(t => t.status === "completed" && t.ended_at)
    .reduce((sum, t) => sum + (new Date(t.ended_at!).getTime() - new Date(t.started_at).getTime()), 0);
  const avgMinutes = completed > 0 ? Math.round(totalDuration / completed / 60000) : 0;

  function formatDate(dt: string) {
    try {
      return new Date(dt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    } catch { return dt; }
  }
  function formatTime(dt: string) {
    try {
      return new Date(dt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    } catch { return dt; }
  }
  function tripDuration(t: Trip) {
    if (!t.ended_at) return "—";
    const mins = Math.round((new Date(t.ended_at).getTime() - new Date(t.started_at).getTime()) / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

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
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Trip History</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
              View your past trips and their details.
            </p>
          </div>
</div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Trips" value={trips.length} icon={Route} color="#F5A623" sub={`${filtered.length} in view`} />
          <StatCard label="Completed" value={completed} icon={CheckCircle2} color="#0D9488" sub="Finished trips" />
          <StatCard label="Cancelled" value={cancelled} icon={XCircle} color="#DC2626" sub="Cancelled trips" />
          <StatCard label="Avg Duration" value={avgMinutes > 0 ? `${avgMinutes}m` : "—"} icon={Clock} color="#0F2B5B" sub="Per completed trip" />
        </div>

        {/* Search & Filter */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--slate)" }} />
            <input placeholder="Search by bus or route" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "var(--input-bg)" }} />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl text-sm border outline-none appearance-none min-w-[140px]"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "var(--input-bg)" }}>
            <option value="all">All statuses</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Trip list */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border p-8 text-center" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <Clock size={32} className="mx-auto mb-2 opacity-30" style={{ color: "var(--slate)" }} />
            <p className="text-sm" style={{ color: "var(--slate)" }}>
              {trips.length === 0 ? "No trips recorded yet. Start your first trip from the My Trip page." : "No trips match your search."}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                    <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Trip</th>
                    <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Bus</th>
                    <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Route</th>
                    <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Date</th>
                    <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Time</th>
                    <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Duration</th>
                    <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(trip => (
                    <tr key={trip.id} className="border-b hover:bg-slate-50" style={{ borderColor: "var(--border)" }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: "var(--bus-yellow-light)", color: "var(--bus-yellow)" }}>
                            <Play size={13} />
                          </div>
                          <span className="font-medium" style={{ color: "var(--text-primary)" }}>#{trip.id}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--text-primary)" }}>{trip.plate_number}</td>
                      <td className="px-4 py-3" style={{ color: "var(--text-primary)" }}>{trip.route_name}</td>
                      <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{formatDate(trip.started_at)}</td>
                      <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                        {formatTime(trip.started_at)}
                        {trip.ended_at && <span style={{ color: "var(--slate)" }}> – {formatTime(trip.ended_at)}</span>}
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--text-primary)" }}>{tripDuration(trip)}</td>
                      <td className="px-4 py-3">
                        {trip.status === "completed" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                            style={{ backgroundColor: "var(--teal-light)", color: "var(--teal)" }}>
                            <CheckCircle2 size={12} /> Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                            style={{ backgroundColor: "var(--danger-light)", color: "var(--danger)" }}>
                            <XCircle size={12} /> Cancelled
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
