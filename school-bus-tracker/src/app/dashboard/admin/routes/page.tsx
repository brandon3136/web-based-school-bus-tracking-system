"use client";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import StatCard from "@/components/StatCard";
import {
  AlertTriangle, Bus, CheckCircle2, LayoutDashboard, MapPin,
  MoreHorizontal, Pencil, Plus, Search, Settings, Trash2,
  Users, X, Clock, Truck, Navigation, Hash, ShieldCheck, Route,
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

interface Stop {
  id: number;
  route_id: number;
  name: string;
  latitude: number | string;
  longitude: number | string;
  stop_order: number;
  geofence_radius_m: number;
}

interface RouteRecord {
  id: number;
  name: string;
  description: string | null;
  is_active: number;
  stops?: Stop[];
}

export default function RoutesPage() {
  const [routes, setRoutes] = useState<RouteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteRecord | null>(null);
  const [stopsLoading, setStopsLoading] = useState(false);

  // Route modals
  const [showAddRoute, setShowAddRoute] = useState(false);
  const [showEditRoute, setShowEditRoute] = useState(false);
  const [routeForm, setRouteForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Stop modals
  const [showAddStop, setShowAddStop] = useState(false);
  const [showEditStop, setShowEditStop] = useState(false);
  const [editingStop, setEditingStop] = useState<Stop | null>(null);
  const [stopForm, setStopForm] = useState({ name: "", latitude: "", longitude: "", stop_order: "1", geofence_radius_m: "300" });

  // Delete stop
  const [showDeleteStop, setShowDeleteStop] = useState(false);
  const [deletingStop, setDeletingStop] = useState<Stop | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Delete route
  const [showDeleteRoute, setShowDeleteRoute] = useState(false);
  const [deleteRouteSaving, setDeleteRouteSaving] = useState(false);
  const [deleteRouteError, setDeleteRouteError] = useState("");

  const [successMessage, setSuccessMessage] = useState("");

  async function loadRoutes() {
    try {
      const res = await apiFetch("/api/routes");
      const data = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(data)) { setLoadError(data?.error || "Could not load routes."); return; }
      setRoutes(data);
      if (data.length > 0 && !data.find((r: RouteRecord) => r.id === selectedId)) {
        setSelectedId(data[0].id);
      }
    } catch { setLoadError("Could not connect to the server."); }
  }

  async function loadRouteStops(routeId: number) {
    setStopsLoading(true);
    try {
      const res = await apiFetch(`/api/routes/${routeId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedRoute(data);
      }
    } catch { /* ignore */ }
    finally { setStopsLoading(false); }
  }

  useEffect(() => {
    loadRoutes().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedId === null) return;
    loadRouteStops(selectedId);
  }, [selectedId]);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return routes;
    const s = searchTerm.toLowerCase();
    return routes.filter(r => r.name.toLowerCase().includes(s) || (r.description || "").toLowerCase().includes(s));
  }, [routes, searchTerm]);

  // Stats
  const totalStops = routes.reduce((sum, r) => sum + (r.stops?.length || 0), 0);
  const avgStops = routes.length > 0 ? Math.round(totalStops / routes.length) : 0;
  const stops = selectedRoute?.stops || [];

  function resetRouteForm() { setRouteForm({ name: "", description: "" }); setSaveError(""); }
  function resetStopForm() { setStopForm({ name: "", latitude: "", longitude: "", stop_order: String(stops.length + 1), geofence_radius_m: "300" }); setSaveError(""); }

  // ── Route CRUD ──
  async function handleCreateRoute(e: React.FormEvent) {
    e.preventDefault();
    setSaveError("");
    if (!routeForm.name.trim()) { setSaveError("Route name is required."); return; }
            setSaving(true);
    try {
      const res = await apiFetch("/api/routes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: routeForm.name.trim(), description: routeForm.description.trim() || null }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setSaveError(data?.error || "Could not create route."); return; }
      setShowAddRoute(false); resetRouteForm();
      await loadRoutes();
      setSelectedId(data.id);
      setSuccessMessage(`Route "${routeForm.name.trim()}" created.`);
      setTimeout(() => setSuccessMessage(""), 6000);
    } catch { setSaveError("Could not connect to the server."); }
    finally { setSaving(false); }
  }

  async function handleEditRoute(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRoute) return;
    setSaveError("");
    if (!routeForm.name.trim()) { setSaveError("Route name is required."); return; }
            setSaving(true);
    try {
      const res = await apiFetch(`/api/routes/${selectedRoute.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: routeForm.name.trim(), description: routeForm.description.trim() || null }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setSaveError(data?.error || "Could not update route."); return; }
      setShowEditRoute(false); resetRouteForm();
      await loadRoutes();
      await loadRouteStops(selectedRoute.id);
      setSuccessMessage(`Route "${routeForm.name.trim()}" updated.`);
      setTimeout(() => setSuccessMessage(""), 6000);
    } catch { setSaveError("Could not connect to the server."); }
    finally { setSaving(false); }
  }

  // ── Delete Route ──
  async function handleDeleteRoute() {
    if (!selectedRoute) return;
            setDeleteRouteSaving(true);
    setDeleteRouteError("");
    try {
      const res = await apiFetch(`/api/routes/${selectedRoute.id}`, {
        method: "DELETE",
        headers: {},
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setDeleteRouteError(data?.error || "Could not delete route.");
        return;
      }
      setShowDeleteRoute(false);
      const deletedName = selectedRoute.name;
      setSelectedRoute(null);
      setSelectedId(null);
      await loadRoutes();
      setSuccessMessage(`Route "${deletedName}" deleted.`);
      setTimeout(() => setSuccessMessage(""), 6000);
    } catch {
      setDeleteRouteError("Could not connect to the server.");
    } finally {
      setDeleteRouteSaving(false);
    }
  }

  // ── Stop CRUD ──
  async function handleCreateStop(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setSaveError("");
    if (!stopForm.name.trim() || !stopForm.latitude || !stopForm.longitude) { setSaveError("Name, latitude, and longitude are required."); return; }
            setSaving(true);
    try {
      const res = await apiFetch("/api/routes/stops", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          route_id: selectedId, name: stopForm.name.trim(),
          latitude: Number(stopForm.latitude), longitude: Number(stopForm.longitude),
          stop_order: Number(stopForm.stop_order), geofence_radius_m: Number(stopForm.geofence_radius_m) || 300,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setSaveError(data?.error || "Could not add stop."); return; }
      setShowAddStop(false); resetStopForm();
      await loadRouteStops(selectedId);
      await loadRoutes();
      setSuccessMessage(`Stop "${stopForm.name.trim()}" added.`);
      setTimeout(() => setSuccessMessage(""), 6000);
    } catch { setSaveError("Could not connect to the server."); }
    finally { setSaving(false); }
  }

  async function handleEditStop(e: React.FormEvent) {
    e.preventDefault();
    if (!editingStop) return;
    setSaveError("");
    if (!stopForm.name.trim() || !stopForm.latitude || !stopForm.longitude) { setSaveError("Name, latitude, and longitude are required."); return; }
            setSaving(true);
    try {
      const res = await apiFetch(`/api/routes/stops/${editingStop.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: stopForm.name.trim(), latitude: Number(stopForm.latitude), longitude: Number(stopForm.longitude),
          stop_order: Number(stopForm.stop_order), geofence_radius_m: Number(stopForm.geofence_radius_m),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setSaveError(data?.error || "Could not update stop."); return; }
      setShowEditStop(false); setEditingStop(null); resetStopForm();
      if (selectedId) await loadRouteStops(selectedId);
      await loadRoutes();
      setSuccessMessage(`Stop "${stopForm.name.trim()}" updated.`);
      setTimeout(() => setSuccessMessage(""), 6000);
    } catch { setSaveError("Could not connect to the server."); }
    finally { setSaving(false); }
  }

  async function handleDeleteStop() {
    if (!deletingStop) return;
            setDeleteSaving(true); setDeleteError("");
    try {
      const res = await apiFetch(`/api/routes/stops/${deletingStop.id}`, {
        method: "DELETE", headers: {},
      });
      if (!res.ok) { const d = await res.json().catch(() => null); setDeleteError(d?.error || "Could not delete stop."); return; }
      setShowDeleteStop(false); setDeletingStop(null);
      if (selectedId) await loadRouteStops(selectedId);
      await loadRoutes();
      setSuccessMessage(`Stop "${deletingStop.name}" removed.`);
      setTimeout(() => setSuccessMessage(""), 6000);
    } catch { setDeleteError("Could not connect to the server."); }
    finally { setDeleteSaving(false); }
  }

  function openEditStopModal(stop: Stop) {
    setEditingStop(stop);
    setStopForm({ name: stop.name, latitude: String(stop.latitude), longitude: String(stop.longitude), stop_order: String(stop.stop_order), geofence_radius_m: String(stop.geofence_radius_m) });
    setSaveError("");
    setShowEditStop(true);
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
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Routes & Stops</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Manage bus routes and their pickup/drop-off stops.</p>
          </div>
          <button onClick={() => { resetRouteForm(); setShowAddRoute(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--navy)" }}><Plus size={15} /> Add Route</button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Routes" value={routes.length} icon={Route} color="#0F2B5B" sub={`${filtered.length} in view`} />
          <StatCard label="Total Stops" value={selectedRoute ? stops.length : "—"} icon={MapPin} color="#0D9488" sub="For selected route" />
          <StatCard label="Avg Stops" value={avgStops} icon={Hash} color="#F5A623" sub="Per route" />
          <StatCard label="Active Routes" value={routes.filter(r => r.is_active).length} icon={CheckCircle2} color="#7C3AED" sub="Currently running" />
        </div>

        {/* Alerts */}
        {loadError && <div className="mb-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm bg-white" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}><AlertTriangle size={16} color="#F5A623" />{loadError}</div>}
        {successMessage && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "#0D9488", backgroundColor: "#f0fdfa", color: "#0D9488" }}>
            <CheckCircle2 size={16} /><span className="flex-1">{successMessage}</span>
            <button onClick={() => setSuccessMessage("")} className="h-6 w-6 rounded-lg flex items-center justify-center hover:bg-teal-100"><X size={14} /></button>
          </div>
        )}

        {/* Body */}
        <div className="grid xl:grid-cols-[1fr_400px] gap-6">
          {/* Route list */}
          <section className="bg-white rounded-2xl border min-w-0" style={{ borderColor: "var(--border)" }}>
            <div className="p-4 border-b" style={{ borderColor: "var(--border)" }}>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--slate)" }} />
                <input placeholder="Search routes" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
              </div>
            </div>
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {filtered.length === 0 && (
                <div className="text-center py-12" style={{ color: "var(--slate)" }}>
                  <Route size={28} className="mx-auto mb-2 opacity-40" /><p className="text-sm">No routes found</p>
                </div>
              )}
              {filtered.map(route => {
                const isActive = route.id === selectedId;
                return (
                  <button key={route.id} onClick={() => setSelectedId(route.id)}
                    className="w-full text-left px-5 py-4 transition-colors hover:bg-slate-50"
                    style={{ backgroundColor: isActive ? "color-mix(in srgb, var(--navy) 5%, var(--card))" : undefined }}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: "var(--bus-yellow-light)", color: "var(--navy)" }}>
                          <Navigation size={15} />
                        </div>
                        <div>
                          <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{route.name}</p>
                          <p className="text-xs mt-0.5" style={{ color: "var(--slate)" }}>{route.description || "No description"}</p>
                        </div>
                      </div>
                      <span className="text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0"
                        style={{ backgroundColor: "var(--teal-light)", color: "var(--teal)" }}>Active</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Stops panel for selected route */}
          <aside className="space-y-5">
            {selectedRoute ? (
              <>
                {/* Route info */}
                <div className="bg-white rounded-2xl border p-5" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--slate)" }}>Selected Route</p>
                    <ShieldCheck size={18} style={{ color: "var(--teal)" }} />
                  </div>
                  <h2 className="text-lg font-bold mb-1" style={{ color: "var(--text-primary)" }}>{selectedRoute.name}</h2>
                  <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>{selectedRoute.description || "No description"}</p>

                  <button onClick={() => { setRouteForm({ name: selectedRoute.name, description: selectedRoute.description || "" }); setSaveError(""); setShowEditRoute(true); }}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 border mb-3"
                    style={{ borderColor: "var(--navy)", color: "var(--navy)", backgroundColor: "white" }}>
                    <Pencil size={14} /> Edit Route
                  </button>

                  <button onClick={() => { setShowDeleteRoute(true); setDeleteRouteError(""); }}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 border"
                    style={{ borderColor: "var(--danger)", color: "var(--danger)", backgroundColor: "var(--danger-light)" }}>
                    <Trash2 size={14} /> Delete Route
                  </button>
                </div>

                {/* Stops list */}
                <div className="bg-white rounded-2xl border p-5" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                      Stops ({stops.length})
                    </h3>
                    <button onClick={() => { resetStopForm(); setStopForm(f => ({ ...f, stop_order: String(stops.length + 1) })); setShowAddStop(true); }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold"
                      style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                      <Plus size={13} /> Add Stop
                    </button>
                  </div>

                  {stopsLoading ? (
                    <div className="text-center py-6"><div className="w-6 h-6 border-2 rounded-full animate-spin mx-auto" style={{ borderColor: "var(--navy)", borderTopColor: "transparent" }} /></div>
                  ) : stops.length === 0 ? (
                    <div className="text-center py-6">
                      <MapPin size={24} className="mx-auto mb-2 opacity-30" style={{ color: "var(--slate)" }} />
                      <p className="text-xs" style={{ color: "var(--slate)" }}>No stops defined yet. Add the first stop.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {stops.map((stop, i) => (
                        <div key={stop.id} className="flex items-start gap-3 group">
                          <div className="flex flex-col items-center">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                              style={{ backgroundColor: "var(--teal)", color: "white" }}>{stop.stop_order}</div>
                            {i < stops.length - 1 && <div className="w-px h-6 mt-1" style={{ backgroundColor: "var(--border)" }} />}
                          </div>
                          <div className="flex-1 pt-0.5">
                            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{stop.name}</p>
                            <p className="text-xs" style={{ color: "var(--slate)" }}>
                              {Number(stop.latitude).toFixed(4)}, {Number(stop.longitude).toFixed(4)} · {stop.geofence_radius_m}m geofence
                            </p>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEditStopModal(stop)}
                              className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-slate-100" style={{ color: "var(--slate)" }}>
                              <Pencil size={12} /></button>
                            <button onClick={() => { setDeletingStop(stop); setShowDeleteStop(true); setDeleteError(""); }}
                              className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-red-50" style={{ color: "var(--danger)" }}>
                              <Trash2 size={12} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-white rounded-2xl border p-5 text-center" style={{ borderColor: "var(--border)" }}>
                <Route size={28} className="mx-auto mb-2 opacity-30" style={{ color: "var(--slate)" }} />
                <p className="text-sm" style={{ color: "var(--slate)" }}>Select a route to manage its stops.</p>
              </div>
            )}
          </aside>
        </div>
      </main>

      {/* ── Route Add Modal ── */}
      {showAddRoute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6" style={{ backgroundColor: "rgba(15,23,42,0.45)" }}>
          <div className="w-full max-w-lg bg-white rounded-2xl border shadow-2xl" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <div><h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Add Route</h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Create a new bus route.</p></div>
              <button onClick={() => setShowAddRoute(false)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-100" style={{ color: "var(--slate)" }}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateRoute} className="p-6 space-y-4">
              <label className="space-y-1.5 block">
                <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Route name</span>
                <input value={routeForm.name} onChange={e => setRouteForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Route 5 – Kinondoni"
                  className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
              </label>
              <label className="space-y-1.5 block">
                <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Description</span>
                <textarea value={routeForm.description} onChange={e => setRouteForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description..." rows={2}
                  className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2 resize-none"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
              </label>
              {saveError && <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: "var(--danger-light)", color: "var(--danger)" }}><AlertTriangle size={14} />{saveError}</div>}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddRoute(false)} className="px-4 py-2.5 rounded-xl text-sm font-semibold border bg-white" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-70" style={{ backgroundColor: "var(--navy)" }}>{saving ? "Creating..." : "Create Route"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Route Edit Modal ── */}
      {showEditRoute && selectedRoute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6" style={{ backgroundColor: "rgba(15,23,42,0.45)" }}>
          <div className="w-full max-w-lg bg-white rounded-2xl border shadow-2xl" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <div><h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Edit Route</h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Update {selectedRoute.name}.</p></div>
              <button onClick={() => setShowEditRoute(false)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-100" style={{ color: "var(--slate)" }}><X size={18} /></button>
            </div>
            <form onSubmit={handleEditRoute} className="p-6 space-y-4">
              <label className="space-y-1.5 block">
                <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Route name</span>
                <input value={routeForm.name} onChange={e => setRouteForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
              </label>
              <label className="space-y-1.5 block">
                <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Description</span>
                <textarea value={routeForm.description} onChange={e => setRouteForm(f => ({ ...f, description: e.target.value }))}
                  rows={2} className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2 resize-none"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
              </label>
              {saveError && <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: "var(--danger-light)", color: "var(--danger)" }}><AlertTriangle size={14} />{saveError}</div>}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowEditRoute(false)} className="px-4 py-2.5 rounded-xl text-sm font-semibold border bg-white" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-70" style={{ backgroundColor: "var(--navy)" }}>{saving ? "Saving..." : "Save Changes"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Stop Add Modal ── */}
      {showAddStop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6" style={{ backgroundColor: "rgba(15,23,42,0.45)" }}>
          <div className="w-full max-w-lg bg-white rounded-2xl border shadow-2xl" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <div><h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Add Stop</h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Add a new stop to {selectedRoute?.name}.</p></div>
              <button onClick={() => setShowAddStop(false)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-100" style={{ color: "var(--slate)" }}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateStop} className="p-6 space-y-4">
              <label className="space-y-1.5 block">
                <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Stop name</span>
                <input value={stopForm.name} onChange={e => setStopForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Msasani Junction"
                  className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1.5 block">
                  <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Latitude</span>
                  <input type="number" step="any" value={stopForm.latitude} onChange={e => setStopForm(f => ({ ...f, latitude: e.target.value }))}
                    placeholder="-6.815"
                    className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
                </label>
                <label className="space-y-1.5 block">
                  <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Longitude</span>
                  <input type="number" step="any" value={stopForm.longitude} onChange={e => setStopForm(f => ({ ...f, longitude: e.target.value }))}
                    placeholder="39.265"
                    className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1.5 block">
                  <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Stop order</span>
                  <input type="number" value={stopForm.stop_order} onChange={e => setStopForm(f => ({ ...f, stop_order: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
                </label>
                <label className="space-y-1.5 block">
                  <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Geofence (m)</span>
                  <input type="number" value={stopForm.geofence_radius_m} onChange={e => setStopForm(f => ({ ...f, geofence_radius_m: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
                </label>
              </div>
              {saveError && <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: "var(--danger-light)", color: "var(--danger)" }}><AlertTriangle size={14} />{saveError}</div>}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddStop(false)} className="px-4 py-2.5 rounded-xl text-sm font-semibold border bg-white" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-70" style={{ backgroundColor: "var(--navy)" }}>{saving ? "Adding..." : "Add Stop"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Stop Edit Modal ── */}
      {showEditStop && editingStop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6" style={{ backgroundColor: "rgba(15,23,42,0.45)" }}>
          <div className="w-full max-w-lg bg-white rounded-2xl border shadow-2xl" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <div><h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Edit Stop</h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Update {editingStop.name}.</p></div>
              <button onClick={() => setShowEditStop(false)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-100" style={{ color: "var(--slate)" }}><X size={18} /></button>
            </div>
            <form onSubmit={handleEditStop} className="p-6 space-y-4">
              <label className="space-y-1.5 block">
                <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Stop name</span>
                <input value={stopForm.name} onChange={e => setStopForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1.5 block">
                  <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Latitude</span>
                  <input type="number" step="any" value={stopForm.latitude} onChange={e => setStopForm(f => ({ ...f, latitude: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
                </label>
                <label className="space-y-1.5 block">
                  <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Longitude</span>
                  <input type="number" step="any" value={stopForm.longitude} onChange={e => setStopForm(f => ({ ...f, longitude: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1.5 block">
                  <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Stop order</span>
                  <input type="number" value={stopForm.stop_order} onChange={e => setStopForm(f => ({ ...f, stop_order: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
                </label>
                <label className="space-y-1.5 block">
                  <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Geofence (m)</span>
                  <input type="number" value={stopForm.geofence_radius_m} onChange={e => setStopForm(f => ({ ...f, geofence_radius_m: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
                </label>
              </div>
              {saveError && <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: "var(--danger-light)", color: "var(--danger)" }}><AlertTriangle size={14} />{saveError}</div>}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowEditStop(false)} className="px-4 py-2.5 rounded-xl text-sm font-semibold border bg-white" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-70" style={{ backgroundColor: "var(--navy)" }}>{saving ? "Saving..." : "Save Changes"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Stop Confirmation ── */}
      {showDeleteStop && deletingStop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6" style={{ backgroundColor: "rgba(15,23,42,0.45)" }}>
          <div className="w-full max-w-md bg-white rounded-2xl border shadow-2xl p-6" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "var(--danger-light)" }}>
                <AlertTriangle size={20} style={{ color: "var(--danger)" }} /></div>
              <div><h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Delete Stop</h2>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>This will permanently remove the stop.</p></div>
            </div>
            <p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>
              Are you sure you want to delete <strong style={{ color: "var(--text-primary)" }}>{deletingStop.name}</strong>?
            </p>
            <p className="text-xs mb-5" style={{ color: "var(--slate)" }}>Students assigned to this stop will become unassigned.</p>
            {deleteError && <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm mb-4" style={{ backgroundColor: "var(--danger-light)", color: "var(--danger)" }}><AlertTriangle size={14} />{deleteError}</div>}
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => { setShowDeleteStop(false); setDeletingStop(null); }} className="px-4 py-2.5 rounded-xl text-sm font-semibold border bg-white" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
              <button onClick={handleDeleteStop} disabled={deleteSaving} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-70" style={{ backgroundColor: "var(--danger)" }}>{deleteSaving ? "Deleting..." : "Delete Stop"}</button>
            </div>
          </div>
        </div>
      )}
      {/* ── Delete Route Confirmation ── */}
      {showDeleteRoute && selectedRoute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6" style={{ backgroundColor: "rgba(15,23,42,0.45)" }}>
          <div className="w-full max-w-md bg-white rounded-2xl border shadow-2xl p-6" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "var(--danger-light)" }}>
                <AlertTriangle size={20} style={{ color: "var(--danger)" }} /></div>
              <div><h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Delete Route</h2>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>This will permanently remove the route and all its stops.</p></div>
            </div>
            <p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>
              Are you sure you want to delete <strong style={{ color: "var(--text-primary)" }}>{selectedRoute.name}</strong>?
            </p>
            {stops.length > 0 && (
              <p className="text-sm mb-1" style={{ color: "var(--slate)" }}>
                {stops.length} stop{stops.length > 1 ? "s" : ""} will also be removed.
              </p>
            )}
            <p className="text-xs mb-5" style={{ color: "var(--slate)" }}>
              Buses assigned to this route will become unassigned. This action cannot be undone.
            </p>
            {deleteRouteError && <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm mb-4" style={{ backgroundColor: "var(--danger-light)", color: "var(--danger)" }}><AlertTriangle size={14} />{deleteRouteError}</div>}
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => { setShowDeleteRoute(false); }} className="px-4 py-2.5 rounded-xl text-sm font-semibold border bg-white" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
              <button onClick={handleDeleteRoute} disabled={deleteRouteSaving} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-70" style={{ backgroundColor: "var(--danger)" }}>{deleteRouteSaving ? "Deleting..." : "Delete Route"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
