"use client";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import StatCard from "@/components/StatCard";
import {
  AlertTriangle, Bus, CheckCircle2, LayoutDashboard, MapPin,
  MoreHorizontal, Phone, Plus, Search, Settings, Trash2,
  Users, X, UserPlus, Mail, Clock, Pencil, ShieldCheck, Truck,
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

interface Driver {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  bus_id: number | null;
  bus_plate: string | null;
  bus_model: string | null;
  route_name: string | null;
  total_trips: number;
  completed_trips: number;
  active_trips: number;
  last_trip_date: string | null;
  created_at: string;
}

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Driver | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Row action menu
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);

  // Add driver form
  const [addForm, setAddForm] = useState({ name: "", email: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function loadDrivers() {
    try {
      const res = await apiFetch("/api/drivers", {
        headers: {},
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(data)) {
        setLoadError(data?.error || "Could not load drivers.");
        return;
      }
      setDrivers(data);
      if (data.length > 0 && !data.find((d: Driver) => d.id === selectedId)) {
        setSelectedId(data[0].id);
      }
    } catch {
      setLoadError("Could not connect to the server.");
    }
  }

  useEffect(() => {
    loadDrivers().finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return drivers;
    const s = searchTerm.toLowerCase();
    return drivers.filter(d =>
      d.name.toLowerCase().includes(s) ||
      d.email.toLowerCase().includes(s) ||
      (d.phone || "").toLowerCase().includes(s) ||
      (d.bus_plate || "").toLowerCase().includes(s)
    );
  }, [drivers, searchTerm]);

  const selected = filtered.find(d => d.id === selectedId) || filtered[0] || null;

  // Stats
  const withBus = drivers.filter(d => d.bus_plate).length;
  const totalTrips = drivers.reduce((sum, d) => sum + d.completed_trips, 0);
  const unassigned = drivers.filter(d => !d.bus_plate).length;

  // Add driver
  async function handleAddDriver(e: React.FormEvent) {
    e.preventDefault();
    setSaveError("");
    if (!addForm.name.trim() || !addForm.email.trim()) {
      setSaveError("Name and email are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch("/api/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addForm.name.trim(),
          email: addForm.email.trim().toLowerCase(),
          phone: addForm.phone.trim() || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setSaveError(data?.error || "Could not create driver."); return; }
      setShowAddModal(false);
      setAddForm({ name: "", email: "", phone: "" });
      await loadDrivers();
      const pw = data?.generatedPassword;
      const driverEmail = data?.email || addForm.email.trim();
      if (data?.emailSent && pw) {
        setSuccessMessage(`Driver added! Credentials sent to ${driverEmail}. Password: ${pw}`);
      } else if (pw) {
        setSuccessMessage(`Driver added! Login — Email: ${driverEmail} | Password: ${pw}`);
      } else {
        setSuccessMessage(`Driver ${addForm.name.trim()} added successfully.`);
      }
      setTimeout(() => setSuccessMessage(""), 12000);
    } catch {
      setSaveError("Could not connect to the server.");
    } finally {
      setSaving(false);
    }
  }

  // Delete driver
  function openDeleteConfirm(driver: Driver) {
    setDeleteTarget(driver);
    setShowDeleteConfirm(true);
    setDeleteError("");
    setOpenMenuId(null);
    setMenuPosition(null);
  }

  async function handleDeleteDriver() {
    if (!deleteTarget) return;
    setDeleteSaving(true);
    setDeleteError("");
    try {
      const res = await apiFetch(`/api/drivers/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setDeleteError(data?.error || "Could not remove driver."); return; }
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      await loadDrivers();
      setSuccessMessage(`Driver ${deleteTarget.name} removed.`);
      setTimeout(() => setSuccessMessage(""), 6000);
    } catch {
      setDeleteError("Could not connect to the server.");
    } finally {
      setDeleteSaving(false);
    }
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
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Drivers</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
              Manage driver accounts, bus assignments, and trip records.
            </p>
          </div>
          <button
            onClick={() => { setShowAddModal(true); setSaveError(""); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--navy)" }}
          >
            <Plus size={15} /> Add Driver
          </button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Drivers" value={drivers.length} icon={Users} color="#0F2B5B" sub={`${filtered.length} in current view`} />
          <StatCard label="With Bus" value={withBus} icon={CheckCircle2} color="#0D9488" sub="Bus assigned" />
          <StatCard label="Total Trips" value={totalTrips} icon={Bus} color="#F5A623" sub="Completed across all drivers" />
          <StatCard label="Unassigned" value={unassigned} icon={AlertTriangle} color="#DC2626" sub="Missing bus assignment" />
        </div>

        {/* Alerts */}
        {loadError && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm bg-white" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
            <AlertTriangle size={16} color="#F5A623" />
            {loadError}
          </div>
        )}

        {successMessage && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "#0D9488", backgroundColor: "#f0fdfa", color: "#0D9488" }}>
            <CheckCircle2 size={16} />
            <span className="flex-1">{successMessage}</span>
            <button onClick={() => setSuccessMessage("")} className="h-6 w-6 rounded-lg flex items-center justify-center hover:bg-teal-100">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Body: Table + Detail */}
        <div className="grid xl:grid-cols-[1fr_340px] gap-6">
          {/* Table */}
          <section className="bg-white rounded-2xl border min-w-0" style={{ borderColor: "var(--border)" }}>
            <div className="p-4 border-b" style={{ borderColor: "var(--border)" }}>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--slate)" }} />
                <input
                  placeholder="Search drivers by name, email, phone, or bus"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                    <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Driver</th>
                    <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Contact</th>
                    <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Bus</th>
                    <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Trips</th>
                    <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Status</th>
                    <th className="text-left px-4 py-3 font-semibold w-16" style={{ color: "var(--text-secondary)" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-12" style={{ color: "var(--slate)" }}>
                        <Users size={28} className="mx-auto mb-2 opacity-40" />
                        <p className="text-sm">No drivers found</p>
                      </td>
                    </tr>
                  )}
                  {filtered.map(driver => {
                    const isActive = driver.id === selected?.id;
                    const initials = driver.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
                    return (
                      <tr
                        key={driver.id}
                        onClick={() => setSelectedId(driver.id)}
                        className="border-b cursor-pointer transition-colors hover:bg-slate-50"
                        style={{
                          borderColor: "var(--border)",
                          backgroundColor: isActive ? "color-mix(in srgb, var(--navy) 5%, var(--card))" : undefined,
                        }}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                              style={{ backgroundColor: "var(--bus-yellow-light)", color: "var(--navy)" }}>
                              {initials}
                            </div>
                            <div>
                              <p className="font-medium" style={{ color: "var(--text-primary)" }}>{driver.name}</p>
                              <p className="text-xs" style={{ color: "var(--slate)" }}>{driver.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p style={{ color: "var(--text-primary)" }}>{driver.phone || "—"}</p>
                          <p className="text-xs" style={{ color: "var(--slate)" }}>{driver.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          {driver.bus_plate ? (
                            <div>
                              <p className="font-medium" style={{ color: "var(--text-primary)" }}>{driver.bus_plate}</p>
                              <p className="text-xs" style={{ color: "var(--slate)" }}>{driver.route_name || "No route"}</p>
                            </div>
                          ) : (
                            <span style={{ color: "var(--slate)" }}>Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium" style={{ color: "var(--text-primary)" }}>{driver.completed_trips}</p>
                          <p className="text-xs" style={{ color: "var(--slate)" }}>
                            {driver.active_trips > 0 ? `${driver.active_trips} active now` : `${driver.total_trips} total`}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {driver.bus_plate ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                              style={{ backgroundColor: "var(--teal-light)", color: "var(--teal)" }}>
                              <CheckCircle2 size={12} /> Assigned
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                              style={{ backgroundColor: "var(--danger-light)", color: "var(--danger)" }}>
                              <AlertTriangle size={12} /> Unassigned
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (openMenuId === driver.id) {
                                setOpenMenuId(null);
                                setMenuPosition(null);
                              } else {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setMenuPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                                setOpenMenuId(driver.id);
                              }
                            }}
                            className="h-8 w-8 rounded-lg inline-flex items-center justify-center hover:bg-slate-100"
                            style={{ color: "var(--slate)" }}
                            title="Driver actions"
                          >
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
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--slate)" }}>Selected Driver</p>
                    <ShieldCheck size={18} style={{ color: "var(--teal)" }} />
                  </div>
                  <h2 className="text-lg font-bold mb-4" style={{ color: "var(--text-primary)" }}>{selected.name}</h2>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
                      <p className="text-xs" style={{ color: "var(--slate)" }}>Bus</p>
                      <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>{selected.bus_plate || "None"}</p>
                    </div>
                    <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
                      <p className="text-xs" style={{ color: "var(--slate)" }}>Route</p>
                      <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>{selected.route_name || "None"}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border p-3 mb-4" style={{ borderColor: "var(--border)" }}>
                    <p className="text-xs mb-2" style={{ color: "var(--slate)" }}>Trip Records</p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{selected.total_trips}</p>
                        <p className="text-xs" style={{ color: "var(--slate)" }}>Total</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold" style={{ color: "var(--teal)" }}>{selected.completed_trips}</p>
                        <p className="text-xs" style={{ color: "var(--slate)" }}>Done</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold" style={{ color: selected.active_trips > 0 ? "var(--bus-yellow)" : "var(--text-primary)" }}>{selected.active_trips}</p>
                        <p className="text-xs" style={{ color: "var(--slate)" }}>Active</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2.5 mb-4">
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--slate)" }}>Contact</p>
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: "color-mix(in srgb, var(--navy) 10%, transparent)", color: "var(--navy)" }}>
                        <Mail size={13} />
                      </div>
                      <p className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{selected.email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: "color-mix(in srgb, var(--navy) 10%, transparent)", color: "var(--navy)" }}>
                        <Phone size={13} />
                      </div>
                      <p className="text-sm" style={{ color: "var(--text-primary)" }}>{selected.phone || "Not provided"}</p>
                    </div>
                    {selected.bus_model && (
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: "color-mix(in srgb, var(--bus-yellow) 15%, transparent)", color: "var(--bus-yellow)" }}>
                          <Bus size={13} />
                        </div>
                        <p className="text-sm" style={{ color: "var(--text-primary)" }}>{selected.bus_model}</p>
                      </div>
                    )}
                  </div>

                  {selected.last_trip_date && (
                    <p className="text-xs" style={{ color: "var(--slate)" }}>
                      Last trip: {new Date(selected.last_trip_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => selected && openDeleteConfirm(selected)}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 border"
                  style={{ borderColor: "var(--danger)", color: "var(--danger)", backgroundColor: "var(--danger-light)" }}
                >
                  <Trash2 size={14} /> Remove Driver
                </button>
              </>
            ) : (
              <div className="bg-white rounded-2xl border p-5 text-center" style={{ borderColor: "var(--border)" }}>
                <Users size={28} className="mx-auto mb-2 opacity-30" style={{ color: "var(--slate)" }} />
                <p className="text-sm" style={{ color: "var(--slate)" }}>Select a driver to view details.</p>
              </div>
            )}
          </aside>
        </div>
      </main>

      {/* Row action menu (fixed position) */}
      {openMenuId !== null && menuPosition && (() => {
        const menuDriver = drivers.find(d => d.id === openMenuId);
        if (!menuDriver) return null;
        return (
          <>
            <div className="fixed inset-0 z-20" onClick={() => { setOpenMenuId(null); setMenuPosition(null); }} />
            <div className="fixed w-40 bg-white rounded-xl border shadow-lg z-30"
              style={{ borderColor: "var(--border)", top: menuPosition.top, right: menuPosition.right }}>
              <button
                onClick={(e) => { e.stopPropagation(); openDeleteConfirm(menuDriver); }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-red-50 rounded-xl"
                style={{ color: "var(--danger)" }}
              >
                <Trash2 size={14} /> Remove driver
              </button>
            </div>
          </>
        );
      })()}

      {/* Add Driver Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6" style={{ backgroundColor: "rgba(15,23,42,0.45)" }}>
          <div className="w-full max-w-lg bg-white rounded-2xl border shadow-2xl" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <div>
                <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Add Driver</h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Create a new driver account.</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-100" style={{ color: "var(--slate)" }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddDriver} className="p-6 space-y-4">
              <div className="space-y-4">
                <label className="space-y-1.5 block">
                  <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Full name</span>
                  <input
                    value={addForm.name}
                    onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. John Mwenda"
                    className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                </label>
                <label className="space-y-1.5 block">
                  <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Email</span>
                  <input
                    type="email"
                    value={addForm.email}
                    onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="e.g. driver@school.tz"
                    className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                </label>
                <label className="space-y-1.5 block">
                  <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Phone number</span>
                  <input
                    value={addForm.phone}
                    onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="e.g. +255712345678"
                    className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                </label>
              </div>
              {saveError && (
                <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: "var(--danger-light)", color: "var(--danger)" }}>
                  <AlertTriangle size={14} /> {saveError}
                </div>
              )}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold border bg-white"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-70"
                  style={{ backgroundColor: "var(--navy)" }}>
                  {saving ? "Creating..." : "Create Driver"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6" style={{ backgroundColor: "rgba(15,23,42,0.45)" }}>
          <div className="w-full max-w-md bg-white rounded-2xl border shadow-2xl p-6" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "var(--danger-light)" }}>
                <AlertTriangle size={20} style={{ color: "var(--danger)" }} />
              </div>
              <div>
                <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Remove Driver</h2>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>This will deactivate the driver account.</p>
              </div>
            </div>
            <p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>
              Are you sure you want to remove <strong style={{ color: "var(--text-primary)" }}>{deleteTarget.name}</strong> from the driver roster?
            </p>
            {deleteTarget.bus_plate && (
              <p className="text-sm mb-3" style={{ color: "var(--slate)" }}>
                Their bus ({deleteTarget.bus_plate}) will become unassigned.
              </p>
            )}
            <p className="text-xs mb-5" style={{ color: "var(--slate)" }}>
              This action will deactivate the driver account. They will no longer be able to log in.
            </p>
            {deleteError && (
              <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm mb-4" style={{ backgroundColor: "var(--danger-light)", color: "var(--danger)" }}>
                <AlertTriangle size={14} /> {deleteError}
              </div>
            )}
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteTarget(null); }}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold border bg-white"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                Cancel
              </button>
              <button onClick={handleDeleteDriver} disabled={deleteSaving}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-70"
                style={{ backgroundColor: "var(--danger)" }}>
                {deleteSaving ? "Removing..." : "Remove Driver"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
