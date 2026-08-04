"use client";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import StatCard from "@/components/StatCard";
import {
  AlertTriangle, Bus, CheckCircle2, LayoutDashboard, MapPin,
  MoreHorizontal, Pencil, Plus, Search, Settings, Trash2,
  Users, X, Clock, Truck, Hash, ShieldCheck,
} from "lucide-react";
import { apiFetch } from "@/lib/api";


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
  driver_id: number | null;
  driver_name: string | null;
  driver_phone: string | null;
  route_id: number | null;
  route_name: string | null;
  is_active: number;
}

interface Driver {
  id: number;
  name: string;
  bus_plate: string | null;
}

interface RouteOption {
  id: number;
  name: string;
}

export default function FleetPage() {
  const [buses, setBuses] = useState<BusRecord[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBus, setEditingBus] = useState<BusRecord | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BusRecord | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Row action menu
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);

  // Form state
  const [form, setForm] = useState({ plate_number: "", model: "", capacity: "30", driver_id: "", route_id: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function loadBuses() {
    try {
      const res = await apiFetch("/api/buses");
      const data = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(data)) { setLoadError(data?.error || "Could not load buses."); return; }
      setBuses(data);
      if (data.length > 0 && !data.find((b: BusRecord) => b.id === selectedId)) setSelectedId(data[0].id);
    } catch { setLoadError("Could not connect to the server."); }
  }

  async function loadDrivers() {
    try {
      const res = await apiFetch("/api/drivers");
      if (res.ok) { const d = await res.json(); setDrivers(Array.isArray(d) ? d : []); }
    } catch { /* ignore */ }
  }

  async function loadRoutes() {
    try {
      const res = await apiFetch("/api/routes");
      if (res.ok) { const d = await res.json(); setRoutes(Array.isArray(d) ? d : []); }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    Promise.all([loadBuses(), loadDrivers(), loadRoutes()]).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return buses;
    const s = searchTerm.toLowerCase();
    return buses.filter(b =>
      b.plate_number.toLowerCase().includes(s) ||
      (b.model || "").toLowerCase().includes(s) ||
      (b.driver_name || "").toLowerCase().includes(s) ||
      (b.route_name || "").toLowerCase().includes(s)
    );
  }, [buses, searchTerm]);

  const selected = filtered.find(b => b.id === selectedId) || filtered[0] || null;

  // Stats
  const withDriver = buses.filter(b => b.driver_id).length;
  const onRoute = buses.filter(b => b.route_name).length;
  const noDriver = buses.filter(b => !b.driver_id).length;

  function resetForm() { setForm({ plate_number: "", model: "", capacity: "30", driver_id: "", route_id: "" }); setSaveError(""); }

  function openEditModal(bus: BusRecord) {
    setEditingBus(bus);
    setForm({
      plate_number: bus.plate_number,
      model: bus.model || "",
      capacity: String(bus.capacity),
      driver_id: bus.driver_id ? String(bus.driver_id) : "",
      route_id: bus.route_id ? String(bus.route_id) : "",
    });
    setSaveError("");
    setShowEditModal(true);
    setOpenMenuId(null);
    setMenuPosition(null);
  }

  function openDeleteConfirm(bus: BusRecord) {
    setDeleteTarget(bus);
    setShowDeleteConfirm(true);
    setDeleteError("");
    setOpenMenuId(null);
    setMenuPosition(null);
  }

  // Available drivers (no bus assigned, or currently editing this bus's driver)
  const availableDrivers = useMemo(() => {
    return drivers.filter(d => !d.bus_plate || (editingBus && d.bus_plate === editingBus.plate_number));
  }, [drivers, editingBus]);

  // Create
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaveError("");
    if (!form.plate_number.trim()) { setSaveError("Plate number is required."); return; }
    setSaving(true);
    try {
      const res = await apiFetch("/api/buses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plate_number: form.plate_number.trim(),
          model: form.model.trim() || null,
          capacity: Number(form.capacity) || 30,
          driver_id: form.driver_id ? Number(form.driver_id) : null,
          route_id: form.route_id ? Number(form.route_id) : null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setSaveError(data?.error || "Could not add bus."); return; }
      setShowAddModal(false);
      resetForm();
      await loadBuses();
      setSuccessMessage(`Bus ${form.plate_number.trim()} added to fleet.`);
      setTimeout(() => setSuccessMessage(""), 6000);
    } catch { setSaveError("Could not connect to the server."); }
    finally { setSaving(false); }
  }

  // Edit
  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingBus) return;
    setSaveError("");
    if (!form.plate_number.trim()) { setSaveError("Plate number is required."); return; }
    setSaving(true);
    try {
      const res = await apiFetch(`/api/buses/${editingBus.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plate_number: form.plate_number.trim(),
          model: form.model.trim() || null,
          capacity: Number(form.capacity) || 30,
          driver_id: form.driver_id ? Number(form.driver_id) : null,
          route_id: form.route_id ? Number(form.route_id) : null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setSaveError(data?.error || "Could not update bus."); return; }
      setShowEditModal(false);
      setEditingBus(null);
      resetForm();
      await loadBuses();
      await loadDrivers();
      setSuccessMessage(`Bus ${form.plate_number.trim()} updated.`);
      setTimeout(() => setSuccessMessage(""), 6000);
    } catch { setSaveError("Could not connect to the server."); }
    finally { setSaving(false); }
  }

  // Delete
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteSaving(true);
    setDeleteError("");
    try {
      const res = await apiFetch(`/api/buses/${deleteTarget.id}`, {
        method: "DELETE",
        headers: {},
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setDeleteError(data?.error || "Could not remove bus."); return; }
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      await loadBuses();
      await loadDrivers();
      setSuccessMessage(`Bus ${deleteTarget.plate_number} removed from fleet.`);
      setTimeout(() => setSuccessMessage(""), 6000);
    } catch { setDeleteError("Could not connect to the server."); }
    finally { setDeleteSaving(false); }
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
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Fleet</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
              Manage buses, capacity, and driver assignments.
            </p>
          </div>
          <button onClick={() => { resetForm(); setShowAddModal(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--navy)" }}>
            <Plus size={15} /> Add Bus
          </button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Buses" value={buses.length} icon={Bus} color="#0F2B5B" sub={`${filtered.length} in current view`} />
          <StatCard label="With Driver" value={withDriver} icon={CheckCircle2} color="#0D9488" sub="Driver assigned" />
          <StatCard label="On Route" value={onRoute} icon={MapPin} color="#F5A623" sub="Route assigned" />
          <StatCard label="No Driver" value={noDriver} icon={AlertTriangle} color="#DC2626" sub="Needs assignment" />
        </div>

        {/* Alerts */}
        {loadError && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm bg-white" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
            <AlertTriangle size={16} color="#F5A623" />{loadError}
          </div>
        )}
        {successMessage && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "#0D9488", backgroundColor: "#f0fdfa", color: "#0D9488" }}>
            <CheckCircle2 size={16} /><span className="flex-1">{successMessage}</span>
            <button onClick={() => setSuccessMessage("")} className="h-6 w-6 rounded-lg flex items-center justify-center hover:bg-teal-100"><X size={14} /></button>
          </div>
        )}

        {/* Body */}
        <div className="grid xl:grid-cols-[1fr_340px] gap-6">
          {/* Table */}
          <section className="bg-white rounded-2xl border min-w-0" style={{ borderColor: "var(--border)" }}>
            <div className="p-4 border-b" style={{ borderColor: "var(--border)" }}>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--slate)" }} />
                <input placeholder="Search by plate, model, driver, or route" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                    <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Bus</th>
                    <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Capacity</th>
                    <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Driver</th>
                    <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Route</th>
                    <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Status</th>
                    <th className="text-left px-4 py-3 font-semibold w-16" style={{ color: "var(--text-secondary)" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-12" style={{ color: "var(--slate)" }}>
                      <Bus size={28} className="mx-auto mb-2 opacity-40" /><p className="text-sm">No buses found</p>
                    </td></tr>
                  )}
                  {filtered.map(bus => {
                    const isActive = bus.id === selected?.id;
                    const initials = bus.plate_number.slice(0, 2).toUpperCase();
                    return (
                      <tr key={bus.id} onClick={() => setSelectedId(bus.id)}
                        className="border-b cursor-pointer transition-colors hover:bg-slate-50"
                        style={{ borderColor: "var(--border)", backgroundColor: isActive ? "color-mix(in srgb, var(--navy) 5%, var(--card))" : undefined }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                              style={{ backgroundColor: "var(--bus-yellow-light)", color: "var(--navy)" }}>{initials}</div>
                            <div>
                              <p className="font-medium" style={{ color: "var(--text-primary)" }}>{bus.plate_number}</p>
                              <p className="text-xs" style={{ color: "var(--slate)" }}>{bus.model || "No model"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Users size={13} style={{ color: "var(--slate)" }} />
                            <span style={{ color: "var(--text-primary)" }}>{bus.capacity}</span>
                            <span className="text-xs" style={{ color: "var(--slate)" }}>seats</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {bus.driver_name ? (
                            <div>
                              <p className="font-medium" style={{ color: "var(--text-primary)" }}>{bus.driver_name}</p>
                              <p className="text-xs" style={{ color: "var(--slate)" }}>{bus.driver_phone || ""}</p>
                            </div>
                          ) : <span style={{ color: "var(--slate)" }}>Unassigned</span>}
                        </td>
                        <td className="px-4 py-3">
                          {bus.route_name ? <span style={{ color: "var(--text-primary)" }}>{bus.route_name}</span>
                            : <span style={{ color: "var(--slate)" }}>No route</span>}
                        </td>
                        <td className="px-4 py-3">
                          {bus.driver_id ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                              style={{ backgroundColor: "var(--teal-light)", color: "var(--teal)" }}>
                              <CheckCircle2 size={12} /> Ready
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                              style={{ backgroundColor: "var(--danger-light)", color: "var(--danger)" }}>
                              <AlertTriangle size={12} /> No driver
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={(e) => {
                            e.stopPropagation();
                            if (openMenuId === bus.id) { setOpenMenuId(null); setMenuPosition(null); }
                            else { const rect = e.currentTarget.getBoundingClientRect(); setMenuPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right }); setOpenMenuId(bus.id); }
                          }} className="h-8 w-8 rounded-lg inline-flex items-center justify-center hover:bg-slate-100" style={{ color: "var(--slate)" }} title="Bus actions">
                            <MoreHorizontal size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Detail panel */}
          <aside className="space-y-5">
            {selected ? (
              <>
                <div className="bg-white rounded-2xl border p-5" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--slate)" }}>Selected Bus</p>
                    <ShieldCheck size={18} style={{ color: "var(--teal)" }} />
                  </div>
                  <h2 className="text-lg font-bold mb-4" style={{ color: "var(--text-primary)" }}>{selected.plate_number}</h2>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
                      <p className="text-xs" style={{ color: "var(--slate)" }}>Model</p>
                      <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>{selected.model || "—"}</p>
                    </div>
                    <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
                      <p className="text-xs" style={{ color: "var(--slate)" }}>Capacity</p>
                      <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>{selected.capacity} seats</p>
                    </div>
                  </div>

                  <div className="rounded-xl border p-3 mb-4" style={{ borderColor: "var(--border)" }}>
                    <p className="text-xs mb-2" style={{ color: "var(--slate)" }}>Driver</p>
                    {selected.driver_name ? (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                          style={{ backgroundColor: "var(--navy)" }}>{selected.driver_name[0]}</div>
                        <div>
                          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{selected.driver_name}</p>
                          <p className="text-xs" style={{ color: "var(--slate)" }}>{selected.driver_phone || "No phone"}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm" style={{ color: "var(--slate)" }}>No driver assigned</p>
                    )}
                  </div>

                  <div className="rounded-xl border p-3 mb-4" style={{ borderColor: "var(--border)" }}>
                    <p className="text-xs mb-1" style={{ color: "var(--slate)" }}>Route</p>
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{selected.route_name || "No route assigned"}</p>
                  </div>

                  <button onClick={() => selected && openEditModal(selected)}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 border mb-3"
                    style={{ borderColor: "var(--navy)", color: "var(--navy)", backgroundColor: "white" }}>
                    <Pencil size={14} /> Edit Bus
                  </button>
                </div>

                <button onClick={() => selected && openDeleteConfirm(selected)}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 border"
                  style={{ borderColor: "var(--danger)", color: "var(--danger)", backgroundColor: "var(--danger-light)" }}>
                  <Trash2 size={14} /> Remove Bus
                </button>
              </>
            ) : (
              <div className="bg-white rounded-2xl border p-5 text-center" style={{ borderColor: "var(--border)" }}>
                <Bus size={28} className="mx-auto mb-2 opacity-30" style={{ color: "var(--slate)" }} />
                <p className="text-sm" style={{ color: "var(--slate)" }}>Select a bus to view details.</p>
              </div>
            )}
          </aside>
        </div>
      </main>

      {/* Row action menu */}
      {openMenuId !== null && menuPosition && (() => {
        const menuBus = buses.find(b => b.id === openMenuId);
        if (!menuBus) return null;
        return (<>
          <div className="fixed inset-0 z-20" onClick={() => { setOpenMenuId(null); setMenuPosition(null); }} />
          <div className="fixed w-40 bg-white rounded-xl border shadow-lg z-30" style={{ borderColor: "var(--border)", top: menuPosition.top, right: menuPosition.right }}>
            <button onClick={(e) => { e.stopPropagation(); openEditModal(menuBus); }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-slate-50 rounded-t-xl" style={{ color: "var(--text-primary)" }}>
              <Pencil size={14} /> Edit bus</button>
            <button onClick={(e) => { e.stopPropagation(); openDeleteConfirm(menuBus); }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-red-50 rounded-b-xl" style={{ color: "var(--danger)" }}>
              <Trash2 size={14} /> Remove bus</button>
          </div>
        </>);
      })()}

      {/* Shared form fields renderer */}
      {(() => {
        const renderFormFields = () => (
          <div className="space-y-4">
            <label className="space-y-1.5 block">
              <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Plate number</span>
              <input value={form.plate_number} onChange={e => setForm(f => ({ ...f, plate_number: e.target.value }))}
                placeholder="e.g. T 456 DAR"
                className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
            </label>
            <label className="space-y-1.5 block">
              <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Model</span>
              <input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                placeholder="e.g. Toyota Coaster 2023"
                className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
            </label>
            <label className="space-y-1.5 block">
              <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Capacity</span>
              <input type="number" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
            </label>
            <label className="space-y-1.5 block">
              <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Driver</span>
              <select value={form.driver_id} onChange={e => setForm(f => ({ ...f, driver_id: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2 appearance-none"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                <option value="">No driver</option>
                {availableDrivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
            <label className="space-y-1.5 block">
              <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Route</span>
              <select value={form.route_id} onChange={e => setForm(f => ({ ...f, route_id: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2 appearance-none"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                <option value="">No route</option>
                {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
          </div>
        );

        return (<>
          {/* Add Modal */}
          {showAddModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6" style={{ backgroundColor: "rgba(15,23,42,0.45)" }}>
              <div className="w-full max-w-lg bg-white rounded-2xl border shadow-2xl" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
                  <div><h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Add Bus</h2>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Register a new bus in the fleet.</p></div>
                  <button onClick={() => setShowAddModal(false)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-100" style={{ color: "var(--slate)" }}><X size={18} /></button>
                </div>
                <form onSubmit={handleCreate} className="p-6 space-y-4">
                  {renderFormFields()}
                  {saveError && <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: "var(--danger-light)", color: "var(--danger)" }}><AlertTriangle size={14} />{saveError}</div>}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2.5 rounded-xl text-sm font-semibold border bg-white" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
                    <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-70" style={{ backgroundColor: "var(--navy)" }}>{saving ? "Adding..." : "Add Bus"}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit Modal */}
          {showEditModal && editingBus && (
            <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6" style={{ backgroundColor: "rgba(15,23,42,0.45)" }}>
              <div className="w-full max-w-lg bg-white rounded-2xl border shadow-2xl" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
                  <div><h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Edit Bus</h2>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Update {editingBus.plate_number} details.</p></div>
                  <button onClick={() => setShowEditModal(false)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-100" style={{ color: "var(--slate)" }}><X size={18} /></button>
                </div>
                <form onSubmit={handleEdit} className="p-6 space-y-4">
                  {renderFormFields()}
                  {saveError && <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: "var(--danger-light)", color: "var(--danger)" }}><AlertTriangle size={14} />{saveError}</div>}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2.5 rounded-xl text-sm font-semibold border bg-white" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
                    <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-70" style={{ backgroundColor: "var(--navy)" }}>{saving ? "Saving..." : "Save Changes"}</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>);
      })()}

      {/* Delete Confirmation */}
      {showDeleteConfirm && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6" style={{ backgroundColor: "rgba(15,23,42,0.45)" }}>
          <div className="w-full max-w-md bg-white rounded-2xl border shadow-2xl p-6" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "var(--danger-light)" }}>
                <AlertTriangle size={20} style={{ color: "var(--danger)" }} /></div>
              <div><h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Remove Bus</h2>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>This will deactivate the bus.</p></div>
            </div>
            <p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>
              Are you sure you want to remove <strong style={{ color: "var(--text-primary)" }}>{deleteTarget.plate_number}</strong> from the fleet?
            </p>
            <p className="text-xs mb-5" style={{ color: "var(--slate)" }}>This action will deactivate the bus record. Students assigned to it will become unassigned.</p>
            {deleteError && <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm mb-4" style={{ backgroundColor: "var(--danger-light)", color: "var(--danger)" }}><AlertTriangle size={14} />{deleteError}</div>}
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteTarget(null); }} className="px-4 py-2.5 rounded-xl text-sm font-semibold border bg-white" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
              <button onClick={handleDelete} disabled={deleteSaving} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-70" style={{ backgroundColor: "var(--danger)" }}>{deleteSaving ? "Removing..." : "Remove Bus"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
