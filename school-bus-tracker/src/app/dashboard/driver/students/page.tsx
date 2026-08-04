"use client";
import { useState, useEffect, useMemo } from "react";
import Sidebar from "@/components/Sidebar";
import StatCard from "@/components/StatCard";
import {
  MapPin, Users, Clock, Search,
  Phone, Mail, Bus, GraduationCap, User, KeyRound,
} from "lucide-react";
import { apiFetch } from "@/lib/api";


const NAV = [
  { href: "/dashboard/driver", label: "My Trip", icon: MapPin },
  { href: "/dashboard/driver/students", label: "Student List", icon: Users },
  { href: "/dashboard/driver/history", label: "Trip History", icon: Clock },
  { href: "/dashboard/driver/settings", label: "Settings", icon: KeyRound },
];

interface StudentRecord {
  id: number;
  name: string;
  grade: string | null;
  stop_name: string | null;
  stop_id: number | null;
  parent_name: string;
  parent_phone: string | null;
}

export default function DriverStudentList() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [driverName, setDriverName] = useState("Driver");
  const [busPlate, setBusPlate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [stopFilter, setStopFilter] = useState("all");

  useEffect(() => {
    const userStr = localStorage.getItem("saferoute_user");
    if (userStr) {
      try { setDriverName(JSON.parse(userStr).name || "Driver"); } catch { /* ignore */ }
    }

    apiFetch("/api/buses")
      .then(res => res.ok ? res.json() : [])
      .then(async (buses: any[]) => {
        if (!Array.isArray(buses)) { setError("Could not load bus data."); return; }
        const user = userStr ? JSON.parse(userStr) : null;
        const myBus = buses.find((b: any) => b.driver_name === user?.name) || buses[0];
        if (!myBus) { setError("No bus assigned to your account."); return; }

        setBusPlate(myBus.plate_number);

        const studentsRes = await apiFetch(`/api/buses/${myBus.id}/students`);
        if (studentsRes.ok) {
          const data = await studentsRes.json();
          setStudents(Array.isArray(data) ? data : []);
        }
      })
      .catch(() => setError("Could not connect to the server."))
      .finally(() => setLoading(false));
  }, []);

  // Unique stops for filter
  const stops = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => { if (s.stop_name) set.add(s.stop_name); });
    return Array.from(set).sort();
  }, [students]);

  // Filtered students
  const filtered = useMemo(() => {
    let list = students;
    if (stopFilter !== "all") list = list.filter(s => s.stop_name === stopFilter);
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.parent_name.toLowerCase().includes(q) ||
        (s.grade || "").toLowerCase().includes(q) ||
        (s.stop_name || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [students, stopFilter, searchTerm]);

  // Group by stop
  const grouped = useMemo(() => {
    const groups: Record<string, StudentRecord[]> = {};
    filtered.forEach(s => {
      const key = s.stop_name || "Unassigned";
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

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
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Student List</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {busPlate ? `Students assigned to ${busPlate}` : "No bus assigned"}
            </p>
          </div>
</div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Students" value={students.length} icon={Users} color="#F5A623" sub={`${filtered.length} in view`} />
          <StatCard label="Pickup Stops" value={stops.length} icon={MapPin} color="#0D9488" sub="Assigned stops" />
          <StatCard label="Grades" value={new Set(students.map(s => s.grade).filter(Boolean)).size} icon={GraduationCap} color="#0F2B5B" sub="Different grades" />
          <StatCard label="Parents" value={new Set(students.map(s => s.parent_name)).size} icon={User} color="#7C3AED" sub="Linked guardians" />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5 flex items-center gap-2 rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: "var(--danger-light)", color: "var(--danger)" }}>
            {error}
          </div>
        )}

        {/* Search & Filter */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--slate)" }} />
            <input
              placeholder="Search by name, parent, grade, or stop"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "var(--input-bg)" }}
            />
          </div>
          <select
            value={stopFilter}
            onChange={e => setStopFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl text-sm border outline-none appearance-none min-w-[160px]"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "var(--input-bg)" }}
          >
            <option value="all">All stops</option>
            {stops.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Student list grouped by stop */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border p-8 text-center" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <Users size={32} className="mx-auto mb-2 opacity-30" style={{ color: "var(--slate)" }} />
            <p className="text-sm" style={{ color: "var(--slate)" }}>
              {students.length === 0 ? "No students assigned to this bus." : "No students match your search."}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(([stopName, stopStudents]) => (
              <div key={stopName} className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                {/* Stop header */}
                <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
                  <MapPin size={14} style={{ color: "var(--bus-yellow)" }} />
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{stopName}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full ml-auto" style={{ backgroundColor: "var(--teal-light)", color: "var(--teal)" }}>
                    {stopStudents.length} student{stopStudents.length > 1 ? "s" : ""}
                  </span>
                </div>

                {/* Students in this stop */}
                <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {stopStudents.map(student => {
                    const initials = student.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
                    return (
                      <div key={student.id} className="px-5 py-4 flex items-center gap-4">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                          style={{ backgroundColor: "var(--bus-yellow-light)", color: "var(--bus-yellow)" }}>
                          {initials}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{student.name}</p>
                            {student.grade && (
                              <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: "color-mix(in srgb, var(--navy) 10%, transparent)", color: "var(--navy)" }}>
                                {student.grade}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            <span className="text-xs flex items-center gap-1" style={{ color: "var(--slate)" }}>
                              <User size={11} /> {student.parent_name}
                            </span>
                            {student.parent_phone && (
                              <span className="text-xs flex items-center gap-1" style={{ color: "var(--slate)" }}>
                                <Phone size={11} /> {student.parent_phone}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Stop badge */}
                        <div className="flex-shrink-0 hidden sm:block">
                          <span className="text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: "var(--teal-light)", color: "var(--teal)" }}>
                            {stopName}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
