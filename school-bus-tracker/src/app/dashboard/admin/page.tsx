"use client";
import dynamic from "next/dynamic";
import { useState, useEffect, useMemo } from "react";
import Sidebar from "@/components/Sidebar";
import StatCard from "@/components/StatCard";
import { apiFetch } from "@/lib/api";
import { useSocket, GpsUpdate } from "@/hooks/useSocket";
import {
  LayoutDashboard,
  Bus,
  MapPin,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Settings,
  Search,
  Truck,
  Activity,
} from "lucide-react";

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

interface BusRecord {
  id: number;
  plate_number: string;
  model: string | null;
  capacity: number;
  driver_name: string | null;
  driver_phone: string | null;
  route_name: string | null;
}

interface ActiveTrip {
  trip_id: number;
  bus_id: number;
  driver_name: string;
  plate_number: string;
  route_name: string;
  students_onboard: number;
  started_at: string;
}

interface HistoryTrip {
  id: number;
  driver_name: string;
  plate_number: string;
  route_name: string;
  started_at: string;
  ended_at: string | null;
  status: string;
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [buses, setBuses] = useState<BusRecord[]>([]);
  const [activeTrips, setActiveTrips] = useState<ActiveTrip[]>([]);
  const [historyTrips, setHistoryTrips] = useState<HistoryTrip[]>([]);
  const [studentCount, setStudentCount] = useState(0);
  const [driverCount, setDriverCount] = useState(0);
  const [selectedBusId, setSelectedBusId] = useState<number | null>(null);
  const [busPos, setBusPos] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [searchTerm, setSearchTerm] = useState("");

  const {
    connected: socketConnected,
    subscribeBus,
    unsubscribeBus,
    onGpsUpdate,
    offGpsUpdate,
  } = useSocket();

  // Fetch all data
  useEffect(() => {
    Promise.all([
      apiFetch("/api/buses")
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      apiFetch("/api/trips/active")
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      apiFetch("/api/trips/history?limit=10")
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      apiFetch("/api/students")
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      apiFetch("/api/drivers")
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    ])
      .then(([busData, activeData, historyData, studentData, driverData]) => {
        setBuses(Array.isArray(busData) ? busData : []);
        setActiveTrips(Array.isArray(activeData) ? activeData : []);
        setHistoryTrips(Array.isArray(historyData) ? historyData : []);
        setStudentCount(Array.isArray(studentData) ? studentData.length : 0);
        setDriverCount(Array.isArray(driverData) ? driverData.length : 0);
        if (Array.isArray(busData) && busData.length > 0) {
          setSelectedBusId(busData[0].id);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedBusId) {
      setBusPos(null);
      return;
    }

    let isMounted = true;
    setBusPos(null);

    apiFetch(`/api/buses/${selectedBusId}/location`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data) return;
        if (
          typeof data.latitude === "number" &&
          typeof data.longitude === "number"
        ) {
          setBusPos({ lat: data.latitude, lng: data.longitude });
        }
      })
      .catch(() => {
        if (isMounted) setBusPos(null);
      });

    subscribeBus(selectedBusId);

    const handleGpsUpdate = (data: GpsUpdate) => {
      if (data.busId === selectedBusId) {
        setBusPos({ lat: data.latitude, lng: data.longitude });
      }
    };

    if (typeof onGpsUpdate === "function") {
      onGpsUpdate(handleGpsUpdate);
    }

    return () => {
      isMounted = false;
      if (typeof unsubscribeBus === "function") {
        unsubscribeBus(selectedBusId);
      }
      if (typeof offGpsUpdate === "function") {
        offGpsUpdate(handleGpsUpdate);
      }
    };
  }, [selectedBusId, subscribeBus, unsubscribeBus, onGpsUpdate, offGpsUpdate]);

  // Active trip IDs for highlighting
  const activeBusIds = useMemo(
    () => new Set(activeTrips.map((t) => t.bus_id)),
    [activeTrips],
  );

  const filteredBuses = useMemo(() => {
    if (!searchTerm.trim()) return buses;
    const s = searchTerm.toLowerCase();
    return buses.filter(
      (b) =>
        b.plate_number.toLowerCase().includes(s) ||
        (b.driver_name || "").toLowerCase().includes(s) ||
        (b.route_name || "").toLowerCase().includes(s),
    );
  }, [buses, searchTerm]);

  const selectedBus =
    filteredBuses.find((b) => b.id === selectedBusId) ||
    filteredBuses[0] ||
    null;
  const selectedTrip = activeTrips.find((t) => t.bus_id === selectedBus?.id);

  // Recent activity: combine active trips + recent history
  const recentActivity = useMemo(() => {
    const items: {
      icon: React.ReactNode;
      msg: string;
      time: string;
      color: string;
    }[] = [];

    activeTrips.forEach((t) => {
      items.push({
        icon: <Activity size={15} />,
        msg: `${t.plate_number} on ${t.route_name} (${t.students_onboard} onboard)`,
        time: formatTime(t.started_at),
        color: "#0D9488",
      });
    });

    historyTrips.slice(0, 5).forEach((t) => {
      const isCompleted = t.status === "completed";
      items.push({
        icon: isCompleted ? (
          <CheckCircle2 size={15} />
        ) : (
          <AlertTriangle size={15} />
        ),
        msg: `${t.plate_number} trip ${isCompleted ? "completed" : "cancelled"} — ${t.route_name}`,
        time: formatTime(t.ended_at || t.started_at),
        color: isCompleted ? "#0F2B5B" : "#DC2626",
      });
    });

    return items;
  }, [activeTrips, historyTrips]);

  function formatTime(dt: string) {
    try {
      return new Date(dt).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const activeBuses = activeTrips.length;
  const idleBuses = buses.length - activeBuses;
  const alertCount = historyTrips.filter(
    (t) => t.status === "cancelled",
  ).length;

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: "var(--surface)" }}
      >
        <div
          className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{ borderColor: "var(--navy)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen"
      style={{ backgroundColor: "var(--surface)" }}
    >
      <Sidebar
        role="admin"
        items={NAV}
        accentColor="var(--navy)"
        userName="Admin User"
      />

      <main className="flex-1 p-6 md:p-8 overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              Fleet Overview
            </h1>
            <p
              className="text-sm mt-0.5"
              style={{ color: "var(--text-secondary)" }}
            >
              {today}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Active Buses"
            value={`${activeBuses} / ${buses.length}`}
            icon={Bus}
            color="#0F2B5B"
            sub={`${idleBuses} idle`}
          />
          <StatCard
            label="Total Students"
            value={studentCount}
            icon={Users}
            color="#0D9488"
            sub="Enrolled"
          />
          <StatCard
            label="Drivers"
            value={driverCount}
            icon={Truck}
            color="#F5A623"
            sub="Registered"
          />
          <StatCard
            label="Alerts"
            value={alertCount}
            icon={AlertTriangle}
            color="#DC2626"
            sub={alertCount === 0 ? "All clear" : "Cancelled trips"}
          />
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Bus list */}
          <div className="md:col-span-1 space-y-3">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--slate)" }}
              />
              <input
                placeholder="Search bus or driver…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                  backgroundColor: "var(--input-bg)",
                }}
              />
            </div>

            {filteredBuses.length === 0 && (
              <div
                className="rounded-2xl border p-6 text-center"
                style={{
                  backgroundColor: "var(--card)",
                  borderColor: "var(--border)",
                }}
              >
                <Bus
                  size={24}
                  className="mx-auto mb-2 opacity-30"
                  style={{ color: "var(--slate)" }}
                />
                <p className="text-sm" style={{ color: "var(--slate)" }}>
                  No buses in fleet
                </p>
              </div>
            )}

            {filteredBuses.map((bus) => {
              const isActive = activeBusIds.has(bus.id);
              const isSelected = bus.id === selectedBusId;
              const trip = activeTrips.find((t) => t.bus_id === bus.id);
              return (
                <button
                  key={bus.id}
                  onClick={() => setSelectedBusId(bus.id)}
                  className="w-full text-left rounded-2xl p-4 border transition-all hover:shadow-sm"
                  style={{
                    backgroundColor: "var(--card)",
                    borderColor: isSelected ? "var(--navy)" : "var(--border)",
                    boxShadow: isSelected ? "0 0 0 2px var(--navy)" : undefined,
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p
                        className="font-semibold text-sm"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {bus.plate_number}
                      </p>
                      <p
                        className="text-xs"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {bus.driver_name || "No driver"}
                      </p>
                    </div>
                    <span
                      className="text-xs px-2 py-1 rounded-full font-medium"
                      style={
                        isActive
                          ? {
                              backgroundColor: "var(--teal-light)",
                              color: "var(--teal)",
                            }
                          : {
                              backgroundColor: "var(--surface)",
                              color: "var(--slate)",
                            }
                      }
                    >
                      {isActive ? "On route" : "Idle"}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: "var(--slate)" }}>
                    {bus.route_name || "No route"}
                  </p>
                  {trip && (
                    <p
                      className="text-xs mt-1"
                      style={{ color: "var(--teal)" }}
                    >
                      {trip.students_onboard} students onboard
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Map */}
          <div
            className="md:col-span-2 rounded-2xl border overflow-hidden"
            style={{
              backgroundColor: "var(--card)",
              borderColor: "var(--border)",
              height: "420px",
            }}
          >
            <div
              className="px-4 py-3 border-b flex items-center justify-between"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{
                    backgroundColor: selectedTrip ? "#0D9488" : "var(--slate)",
                  }}
                />
                <p
                  className="text-sm font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  {selectedBus
                    ? `${selectedBus.plate_number} – ${selectedBus.route_name || "No route"}`
                    : "No bus selected"}
                </p>
              </div>
              <span className="text-xs" style={{ color: "var(--slate)" }}>
                {selectedBus?.driver_name || "No driver"}
              </span>
            </div>
            <div style={{ height: "375px" }}>
              {selectedBus ? (
                <BusMap
                  busPosition={busPos ?? { lat: -6.8, lng: 39.28 }}
                  height="375px"
                />
              ) : (
                <div
                  className="flex items-center justify-center h-full"
                  style={{ color: "var(--slate)" }}
                >
                  <div className="text-center">
                    <MapPin size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No bus selected</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent activity */}
        <div
          className="mt-6 rounded-2xl border p-5"
          style={{
            backgroundColor: "var(--card)",
            borderColor: "var(--border)",
          }}
        >
          <h2
            className="font-semibold text-sm mb-4"
            style={{ color: "var(--text-primary)" }}
          >
            Recent Activity
          </h2>
          {recentActivity.length === 0 ? (
            <div className="text-center py-6">
              <Activity
                size={24}
                className="mx-auto mb-2 opacity-30"
                style={{ color: "var(--slate)" }}
              />
              <p className="text-sm" style={{ color: "var(--slate)" }}>
                No recent activity. Trips will appear here once drivers start
                routes.
              </p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {recentActivity.map((a, i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${a.color} 12%, transparent)`,
                      color: a.color,
                    }}
                  >
                    {a.icon}
                  </div>
                  <p
                    className="text-sm flex-1"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {a.msg}
                  </p>
                  <span
                    className="text-xs flex-shrink-0"
                    style={{ color: "var(--slate)" }}
                  >
                    {a.time}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
