"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import StatCard from "@/components/StatCard";
import {
  AlertTriangle,
  Bus,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  GraduationCap,
  LayoutDashboard,
  Mail,
  MapPin,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

type Student = {
  id: number;
  name: string;
  grade: string | null;
  parent_id?: number;
  bus_id?: number | null;
  route_id?: number | null;
  stop_id?: number | null;
  parent_name: string;
  parent_email: string;
  parent_phone?: string | null;
  bus_plate: string | null;
  stop_name: string | null;
  is_active?: boolean;
  created_at?: string;
};

type ParentOption = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
};
type BusOption = { id: number; plate_number: string; model?: string | null };
type StopOption = {
  id: number;
  name: string;
  route_id?: number;
  route_name?: string;
};
type RouteOption = { id: number; name: string };

type ParentRegistration = {
  name: string;
  email: string;
  phone: string;
};

type StudentRegistration = {
  name: string;
  grade: string;
  bus_id: string;
  route_id: string;
  stop_id: string;
};

const NAV = [
  { href: "/dashboard/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/admin/fleet", label: "Fleet", icon: Bus },
  { href: "/dashboard/admin/routes", label: "Routes & Stops", icon: MapPin },
  { href: "/dashboard/admin/students", label: "Students", icon: Users },
  { href: "/dashboard/admin/drivers", label: "Drivers", icon: Users },
  { href: "/dashboard/admin/history", label: "GPS Logs", icon: Clock },
  { href: "/dashboard/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedId, setSelectedId] = useState(0);
  const [parents, setParents] = useState<ParentOption[]>([]);
  const [buses, setBuses] = useState<BusOption[]>([]);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [stops, setStops] = useState<StopOption[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [busFilter, setBusFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "assigned" | "unassigned"
  >("all");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [parentForm, setParentForm] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [studentForms, setStudentForms] = useState([
    {
      name: "",
      grade: "",
      bus_id: "",
      route_id: "",
      stop_id: "",
    },
  ] as Array<{
    name: string;
    grade: string;
    bus_id: string;
    route_id: string;
    stop_id: string;
  }>);
  const [matchedParent, setMatchedParent] = useState<ParentOption | null>(null);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    grade: "",
    bus_id: "",
    route_id: "",
    stop_id: "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editingStudentId, setEditingStudentId] = useState(0);

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Row action menu state
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    right: number;
  } | null>(null);

  // Success notification state
  const [successMessage, setSuccessMessage] = useState("");

  async function loadStudents(token: string, preferredSelectedId?: number) {
    try {
      const response = await apiFetch("/api/students", {
        headers: {},
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !Array.isArray(data)) {
        setLoadError(data?.error || "Could not load live student records.");
        return;
      }

      const normalized = data.map((student: Student) => ({
        ...student,
        grade: student.grade || "Unassigned",
        is_active: student.is_active ?? true,
      }));
      setStudents(normalized);
      setSelectedId(preferredSelectedId ?? normalized[0]?.id ?? 0);
      setLoadError("");
    } catch {
      setLoadError("Backend unavailable. Could not load student records.");
    } finally {
      setLoading(false);
    }
  }

  async function loadOptions() {
    try {
      const response = await apiFetch("/api/students/options", {
        headers: {},
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data) return;
      setParents(Array.isArray(data.parents) ? data.parents : []);
      setBuses(Array.isArray(data.buses) ? data.buses : []);
      setRoutes(Array.isArray(data.routes) ? data.routes : []);
      setStops(Array.isArray(data.stops) ? data.stops : []);
    } catch {
      setParents([]);
      setBuses([]);
      setRoutes([]);
      setStops([]);
    }
  }

  useEffect(() => {
    loadStudents();
    loadOptions();
  }, []);

  function resetAddForm() {
    setParentForm({ name: "", email: "", phone: "" });
    setStudentForms([
      { name: "", grade: "", bus_id: "", route_id: "", stop_id: "" },
    ]);
    setMatchedParent(null);
    setSaveError("");
  }

  function openAddModal() {
    resetAddForm();
    setShowAddModal(true);
  }

  function closeAddModal() {
    if (saving) return;
    setShowAddModal(false);
    resetAddForm();
  }

  async function handleAddStudent(e: React.FormEvent) {
    e.preventDefault();
    setSaveError("");

    if (
      !parentForm.name.trim() ||
      !parentForm.email.trim() ||
      !parentForm.phone.trim()
    ) {
      setSaveError("Parent name, email, and phone are required.");
      return;
    }
    if (!studentForms.length) {
      setSaveError("Add at least one student.");
      return;
    }

    setSaving(true);

    try {
      const payloadStudents = studentForms.map((student) => ({
        name: student.name.trim(),
        grade: student.grade.trim() || null,
        bus_id: student.bus_id ? Number(student.bus_id) : null,
        route_id: student.route_id ? Number(student.route_id) : null,
        stop_id: student.stop_id ? Number(student.stop_id) : null,
      }));

      const response = await apiFetch("/api/students/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          parent: {
            name: parentForm.name.trim(),
            email: parentForm.email.trim().toLowerCase(),
            phone: parentForm.phone.trim(),
          },
          students: payloadStudents,
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setSaveError(data?.error || "Could not register students.");
        return;
      }

      setShowAddModal(false);
      resetAddForm();
      await loadStudents();
      await loadOptions();

      const parentEmail = data?.parent?.email || parentForm.email.trim();
      const pw = data?.generatedPassword;
      if (data?.emailSent && pw) {
        setSuccessMessage(
          `Student registered! Credentials sent to ${parentEmail}. Password: ${pw}`,
        );
      } else if (pw) {
        setSuccessMessage(
          `Student registered! Parent login — Email: ${parentEmail} | Password: ${pw}`,
        );
      } else if (data?.parentExisting) {
        setSuccessMessage(
          `Student registered! Parent ${parentEmail} already has an account.`,
        );
      } else {
        setSuccessMessage(
          `Student registered, but email could not be sent to ${parentEmail}. Please share login details manually.`,
        );
      }
      setTimeout(() => setSuccessMessage(""), 12000);
    } catch {
      setSaveError(
        "Could not save student records. Check the backend connection.",
      );
    } finally {
      setSaving(false);
    }
  }

  function openEditModal(student: Student) {
    setEditingStudentId(student.id);
    setEditForm({
      name: student.name,
      grade:
        student.grade && student.grade !== "Unassigned" ? student.grade : "",
      bus_id: student.bus_id ? String(student.bus_id) : "",
      route_id: student.route_id ? String(student.route_id) : "",
      stop_id: student.stop_id ? String(student.stop_id) : "",
    });
    setEditError("");
    setShowEditModal(true);
    setOpenMenuId(null);
  }

  function closeEditModal() {
    if (editSaving) return;
    setShowEditModal(false);
    setEditError("");
  }

  async function handleEditStudent(e: React.FormEvent) {
    e.preventDefault();
    setEditError("");

    if (!editForm.name.trim()) {
      setEditError("Student name is required.");
      return;
    }

    setEditSaving(true);

    try {
      const response = await apiFetch(`/api/students/${editingStudentId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: editForm.name.trim(),
          grade: editForm.grade.trim() || null,
          bus_id: editForm.bus_id ? Number(editForm.bus_id) : null,
          route_id: editForm.route_id ? Number(editForm.route_id) : null,
          stop_id: editForm.stop_id ? Number(editForm.stop_id) : null,
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setEditError(data?.error || "Could not update student.");
        return;
      }

      setShowEditModal(false);
      setEditError("");
      await loadStudents(editingStudentId);
      await loadOptions();
    } catch {
      setEditError("Could not update student. Check the backend connection.");
    } finally {
      setEditSaving(false);
    }
  }

  function openDeleteConfirm(student: Student) {
    setDeleteTarget(student);
    setShowDeleteConfirm(true);
    setDeleteError("");
    setOpenMenuId(null);
  }

  function closeDeleteConfirm() {
    if (deleteSaving) return;
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
    setDeleteError("");
  }

  async function handleDeleteStudent() {
    if (!deleteTarget) return;

    setDeleteSaving(true);
    setDeleteError("");

    try {
      const response = await apiFetch(`/api/students/${deleteTarget.id}`, {
        method: "DELETE",
        headers: {},
      });

      console.log("DELETE response:", response.status, response.statusText);

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const msg = data?.error || `Delete failed (status ${response.status})`;
        console.error("DELETE failed:", msg);
        setDeleteError(msg);
        return;
      }

      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      setDeleteError("");
      await loadStudents();
      await loadOptions();
    } catch (err) {
      console.error("DELETE error:", err);
      setDeleteError("Could not delete student. Check the backend connection.");
    } finally {
      setDeleteSaving(false);
    }
  }

  const busOptions = useMemo(() => {
    return Array.from(
      new Set(students.map((student) => student.bus_plate).filter(Boolean)),
    ).sort() as string[];
  }, [students]);

  const filteredStudents = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();
    return students.filter((student) => {
      const matchesSearch =
        !query ||
        student.name.toLowerCase().includes(query) ||
        student.parent_name.toLowerCase().includes(query) ||
        student.parent_email.toLowerCase().includes(query) ||
        (student.grade || "").toLowerCase().includes(query) ||
        (student.stop_name || "").toLowerCase().includes(query);
      const matchesBus = busFilter === "all" || student.bus_plate === busFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "assigned" &&
          Boolean(student.bus_plate && student.stop_name)) ||
        (statusFilter === "unassigned" &&
          (!student.bus_plate || !student.stop_name));

      return matchesSearch && matchesBus && matchesStatus;
    });
  }, [busFilter, searchTerm, statusFilter, students]);

  const selectedStudent =
    filteredStudents.find((student) => student.id === selectedId) ||
    filteredStudents[0] ||
    students[0];
  const assignedCount = students.filter(
    (student) => student.bus_plate && student.stop_name,
  ).length;
  const unassignedCount = students.length - assignedCount;
  const parentCount = new Set(students.map((student) => student.parent_email))
    .size;

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

      <main className="flex-1 min-w-0 p-6 md:p-8 overflow-auto">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              Students
            </h1>
            <p
              className="text-sm mt-0.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Manage student assignments, guardians, stops, and bus coverage.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="h-10 w-10 rounded-xl border bg-white flex items-center justify-center"
              style={{
                borderColor: "var(--border)",
                color: "var(--text-secondary)",
              }}
              title="Export students"
            >
              <Download size={17} />
            </button>
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--navy)" }}
            >
              <Plus size={15} /> Add Student
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Total Students"
            value={students.length}
            icon={GraduationCap}
            color="#0F2B5B"
            sub={`${filteredStudents.length} in current view`}
          />
          <StatCard
            label="Assigned"
            value={assignedCount}
            icon={CheckCircle2}
            color="#0D9488"
            sub="Bus and stop set"
          />
          <StatCard
            label="Guardians"
            value={parentCount}
            icon={Users}
            color="#F5A623"
            sub="Linked parent accounts"
          />
          <StatCard
            label="Needs Setup"
            value={unassignedCount}
            icon={AlertTriangle}
            color="#DC2626"
            sub="Missing bus or stop"
          />
        </div>

        {loadError && (
          <div
            className="mb-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm bg-white"
            style={{
              borderColor: "var(--border)",
              color: "var(--text-secondary)",
            }}
          >
            <AlertTriangle size={16} color="#F5A623" />
            {loadError}
          </div>
        )}

        {successMessage && (
          <div
            className="mb-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm"
            style={{
              borderColor: "#0D9488",
              backgroundColor: "#f0fdfa",
              color: "#0D9488",
            }}
          >
            <CheckCircle2 size={16} />
            <span className="flex-1">{successMessage}</span>
            <button
              onClick={() => setSuccessMessage("")}
              className="h-6 w-6 rounded-lg flex items-center justify-center hover:bg-teal-100"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className="grid xl:grid-cols-[1fr_340px] gap-6">
          <section
            className="bg-white rounded-2xl border min-w-0"
            style={{ borderColor: "var(--border)" }}
          >
            <div
              className="p-4 border-b"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="grid md:grid-cols-[1fr_170px_170px] gap-3">
                <div className="relative">
                  <Search
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--slate)" }}
                  />
                  <input
                    placeholder="Search student, parent, grade, or stop"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border bg-white"
                    style={{
                      borderColor: "var(--border)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
                <div className="relative">
                  <Filter
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: "var(--slate)" }}
                  />
                  <select
                    value={busFilter}
                    onChange={(e) => setBusFilter(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border bg-white appearance-none"
                    style={{
                      borderColor: "var(--border)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <option value="all">All buses</option>
                    {busOptions.map((bus) => (
                      <option key={bus} value={bus}>
                        {bus}
                      </option>
                    ))}
                  </select>
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(
                      e.target.value as "all" | "assigned" | "unassigned",
                    )
                  }
                  className="w-full px-4 py-2.5 rounded-xl text-sm border bg-white"
                  style={{
                    borderColor: "var(--border)",
                    color: "var(--text-primary)",
                  }}
                >
                  <option value="all">All statuses</option>
                  <option value="assigned">Assigned</option>
                  <option value="unassigned">Needs setup</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-sm">
                <thead>
                  <tr
                    className="border-b text-left"
                    style={{
                      borderColor: "var(--border)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <th className="px-5 py-3 font-medium">Student</th>
                    <th className="px-5 py-3 font-medium">Parent</th>
                    <th className="px-5 py-3 font-medium">Transport</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => {
                    const assigned = Boolean(
                      student.bus_plate && student.stop_name,
                    );
                    const active = selectedStudent?.id === student.id;
                    return (
                      <tr
                        key={student.id}
                        onClick={() => setSelectedId(student.id)}
                        className="border-b cursor-pointer transition-colors hover:bg-slate-50"
                        style={{
                          borderColor: "var(--border)",
                          backgroundColor: active
                            ? "color-mix(in srgb, var(--navy) 5%, var(--card))"
                            : undefined,
                        }}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold"
                              style={{
                                backgroundColor: "var(--bus-yellow-light)",
                                color: "var(--navy)",
                              }}
                            >
                              {student.name
                                .split(" ")
                                .map((part) => part[0])
                                .join("")
                                .slice(0, 2)}
                            </div>
                            <div>
                              <p
                                className="font-semibold"
                                style={{ color: "var(--text-primary)" }}
                              >
                                {student.name}
                              </p>
                              <p
                                className="text-xs"
                                style={{ color: "var(--slate)" }}
                              >
                                {student.grade || "Grade not set"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <p style={{ color: "var(--text-primary)" }}>
                            {student.parent_name}
                          </p>
                          <p
                            className="text-xs"
                            style={{ color: "var(--slate)" }}
                          >
                            {student.parent_email}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <p
                            className="font-medium"
                            style={{
                              color: assigned
                                ? "var(--text-primary)"
                                : "var(--danger)",
                            }}
                          >
                            {student.bus_plate || "No bus assigned"}
                          </p>
                          <p
                            className="text-xs"
                            style={{ color: "var(--slate)" }}
                          >
                            {student.stop_name || "No stop assigned"}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                            style={
                              assigned
                                ? {
                                    backgroundColor: "var(--teal-light)",
                                    color: "var(--teal)",
                                  }
                                : {
                                    backgroundColor: "var(--danger-light)",
                                    color: "var(--danger)",
                                  }
                            }
                          >
                            {assigned ? (
                              <CheckCircle2 size={13} />
                            ) : (
                              <AlertTriangle size={13} />
                            )}
                            {assigned ? "Ready" : "Needs setup"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (openMenuId === student.id) {
                                setOpenMenuId(null);
                                setMenuPosition(null);
                              } else {
                                const rect =
                                  e.currentTarget.getBoundingClientRect();
                                setMenuPosition({
                                  top: rect.bottom + 4,
                                  right: window.innerWidth - rect.right,
                                });
                                setOpenMenuId(student.id);
                              }
                            }}
                            className="h-8 w-8 rounded-lg inline-flex items-center justify-center hover:bg-slate-100"
                            style={{ color: "var(--slate)" }}
                            title="Student actions"
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

            {!filteredStudents.length && (
              <div className="py-12 text-center">
                <p
                  className="font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  No students found
                </p>
                <p
                  className="text-sm mt-1"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Adjust your search or filters.
                </p>
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <div
              className="bg-white rounded-2xl border p-5"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-start justify-between mb-5">
                <div>
                  <p
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "var(--slate)" }}
                  >
                    Selected student
                  </p>
                  <h2
                    className="text-xl font-bold mt-1"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {selectedStudent?.name || "No student"}
                  </h2>
                </div>
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    backgroundColor: "var(--teal-light)",
                    color: "var(--teal)",
                  }}
                >
                  <ShieldCheck size={19} />
                </div>
              </div>

              {selectedStudent && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <InfoTile
                      label="Grade"
                      value={selectedStudent.grade || "Not set"}
                    />
                    <InfoTile
                      label="Bus"
                      value={selectedStudent.bus_plate || "Unassigned"}
                    />
                  </div>

                  <div
                    className="rounded-xl border p-4"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <p
                      className="text-xs font-semibold mb-3"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Pickup Details
                    </p>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{
                          backgroundColor: "var(--bus-yellow-light)",
                          color: "var(--bus-yellow)",
                        }}
                      >
                        <MapPin size={16} />
                      </div>
                      <div>
                        <p
                          className="text-sm font-medium"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {selectedStudent.stop_name || "No stop assigned"}
                        </p>
                        <p
                          className="text-xs"
                          style={{ color: "var(--slate)" }}
                        >
                          {selectedStudent.bus_plate
                            ? `Bus ${selectedStudent.bus_plate}`
                            : "Assign a bus before dispatch"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div
                    className="rounded-xl border p-4"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <p
                      className="text-xs font-semibold mb-3"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Guardian
                    </p>
                    <div className="space-y-3">
                      <ContactRow
                        icon={Users}
                        value={selectedStudent.parent_name}
                      />
                      <ContactRow
                        icon={Mail}
                        value={selectedStudent.parent_email}
                      />
                      <ContactRow
                        icon={Phone}
                        value={
                          selectedStudent.parent_phone || "No phone on record"
                        }
                      />
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      selectedStudent && openEditModal(selectedStudent)
                    }
                    className="w-full py-2.5 rounded-xl text-sm font-semibold text-white"
                    style={{ backgroundColor: "var(--navy)" }}
                  >
                    Edit Assignment
                  </button>
                  <button
                    onClick={() =>
                      selectedStudent && openDeleteConfirm(selectedStudent)
                    }
                    className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 border"
                    style={{
                      borderColor: "var(--danger)",
                      color: "var(--danger)",
                      backgroundColor: "var(--danger-light)",
                    }}
                  >
                    <Trash2 size={14} />
                    Delete Student
                  </button>
                </div>
              )}
            </div>

            <div
              className="bg-white rounded-2xl border p-5"
              style={{ borderColor: "var(--border)" }}
            >
              <h2
                className="font-semibold text-sm mb-4"
                style={{ color: "var(--text-primary)" }}
              >
                Setup Queue
              </h2>
              <div className="space-y-3">
                {students
                  .filter((student) => !student.bus_plate || !student.stop_name)
                  .slice(0, 3)
                  .map((student) => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between gap-3"
                    >
                      <div>
                        <p
                          className="text-sm font-medium"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {student.name}
                        </p>
                        <p
                          className="text-xs"
                          style={{ color: "var(--slate)" }}
                        >
                          Missing {student.bus_plate ? "stop" : "bus"}{" "}
                          assignment
                        </p>
                      </div>
                      <span
                        className="text-xs font-semibold"
                        style={{ color: "var(--danger)" }}
                      >
                        Review
                      </span>
                    </div>
                  ))}
                {students.every(
                  (student) => student.bus_plate && student.stop_name,
                ) && (
                  <p
                    className="text-sm"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    All student transport records are ready.
                  </p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>

      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
          style={{ backgroundColor: "rgba(15, 23, 42, 0.45)" }}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-2xl border shadow-2xl"
            style={{ borderColor: "var(--border)" }}
          >
            <div
              className="flex items-center justify-between px-5 py-4 border-b"
              style={{ borderColor: "var(--border)" }}
            >
              <div>
                <h2
                  className="font-bold text-lg"
                  style={{ color: "var(--text-primary)" }}
                >
                  Add Student
                </h2>
                <p
                  className="text-sm mt-0.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Create a student profile and transport assignment.
                </p>
              </div>
              <button
                type="button"
                onClick={closeAddModal}
                className="h-9 w-9 rounded-xl flex items-center justify-center hover:bg-slate-100"
                style={{ color: "var(--slate)" }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddStudent} className="p-5 space-y-5">
              <div className="grid gap-4">
                <div
                  className="rounded-2xl border bg-slate-50 p-4"
                  style={{ borderColor: "var(--border)" }}
                >
                  <h3
                    className="text-sm font-semibold mb-3"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Parent Information
                  </h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    <label className="space-y-1.5">
                      <span
                        className="text-sm font-medium"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        Full name
                      </span>
                      <input
                        value={parentForm.name}
                        onChange={(e) =>
                          setParentForm((current) => ({
                            ...current,
                            name: e.target.value,
                          }))
                        }
                        placeholder="e.g. Sarah Mwangi"
                        className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                        style={{
                          borderColor: "var(--border)",
                          color: "var(--text-primary)",
                        }}
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span
                        className="text-sm font-medium"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        Email
                      </span>
                      <input
                        value={parentForm.email}
                        onChange={(e) => {
                          const email = e.target.value;
                          setParentForm((current) => ({ ...current, email }));
                          const existing = parents.find(
                            (p) =>
                              p.email.toLowerCase() ===
                              email.trim().toLowerCase(),
                          );
                          setMatchedParent(existing || null);
                        }}
                        placeholder="e.g. parent@school.tz"
                        className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                        style={{
                          borderColor: "var(--border)",
                          color: "var(--text-primary)",
                        }}
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span
                        className="text-sm font-medium"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        Phone number
                      </span>
                      <input
                        value={parentForm.phone}
                        onChange={(e) =>
                          setParentForm((current) => ({
                            ...current,
                            phone: e.target.value,
                          }))
                        }
                        placeholder="e.g. +255712345678"
                        className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                        style={{
                          borderColor: "var(--border)",
                          color: "var(--text-primary)",
                        }}
                      />
                    </label>
                  </div>
                  {matchedParent && (
                    <p
                      className="text-xs mt-2"
                      style={{ color: "var(--teal)" }}
                    >
                      Existing parent will be linked: {matchedParent.name}
                    </p>
                  )}
                </div>

                <div
                  className="rounded-2xl border bg-slate-50 p-4"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3
                      className="text-sm font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      Student Information
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        setStudentForms((current) => [
                          ...current,
                          {
                            name: "",
                            grade: "",
                            bus_id: "",
                            route_id: "",
                            stop_id: "",
                          },
                        ])
                      }
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm"
                      style={{
                        borderColor: "var(--border)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <Plus size={14} /> Add Another Student
                    </button>
                  </div>
                  <div className="space-y-4">
                    {studentForms.map((student, index) => (
                      <div
                        key={index}
                        className="rounded-2xl border bg-white p-4"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <div className="flex items-center justify-between gap-3 mb-4">
                          <span
                            className="text-sm font-semibold"
                            style={{ color: "var(--text-primary)" }}
                          >
                            Student {index + 1}
                          </span>
                          {studentForms.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setStudentForms((current) =>
                                  current.filter((_, idx) => idx !== index),
                                )
                              }
                              className="text-sm font-medium text-danger"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <div className="grid md:grid-cols-3 gap-4">
                          <label className="space-y-1.5">
                            <span
                              className="text-sm font-medium"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              Name
                            </span>
                            <input
                              value={student.name}
                              onChange={(e) =>
                                setStudentForms((current) =>
                                  current.map((item, idx) =>
                                    idx === index
                                      ? { ...item, name: e.target.value }
                                      : item,
                                  ),
                                )
                              }
                              placeholder="e.g. Jamie Mwangi"
                              className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                              style={{
                                borderColor: "var(--border)",
                                color: "var(--text-primary)",
                              }}
                            />
                          </label>
                          <label className="space-y-1.5">
                            <span
                              className="text-sm font-medium"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              Grade
                            </span>
                            <input
                              value={student.grade}
                              onChange={(e) =>
                                setStudentForms((current) =>
                                  current.map((item, idx) =>
                                    idx === index
                                      ? { ...item, grade: e.target.value }
                                      : item,
                                  ),
                                )
                              }
                              placeholder="e.g. Grade 5"
                              className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                              style={{
                                borderColor: "var(--border)",
                                color: "var(--text-primary)",
                              }}
                            />
                          </label>
                          <label className="space-y-1.5">
                            <span
                              className="text-sm font-medium"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              Route
                            </span>
                            <select
                              value={student.route_id}
                              onChange={(e) =>
                                setStudentForms((current) =>
                                  current.map((item, idx) =>
                                    idx === index
                                      ? {
                                          ...item,
                                          route_id: e.target.value,
                                          stop_id: "",
                                        }
                                      : item,
                                  ),
                                )
                              }
                              className="w-full px-4 py-2.5 rounded-xl text-sm border bg-white"
                              style={{
                                borderColor: "var(--border)",
                                color: "var(--text-primary)",
                              }}
                            >
                              <option value="">Select route</option>
                              {routes.map((route) => (
                                <option key={route.id} value={route.id}>
                                  {route.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                          <label className="space-y-1.5">
                            <span
                              className="text-sm font-medium"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              Bus
                            </span>
                            <select
                              value={student.bus_id}
                              onChange={(e) =>
                                setStudentForms((current) =>
                                  current.map((item, idx) =>
                                    idx === index
                                      ? { ...item, bus_id: e.target.value }
                                      : item,
                                  ),
                                )
                              }
                              className="w-full px-4 py-2.5 rounded-xl text-sm border bg-white"
                              style={{
                                borderColor: "var(--border)",
                                color: "var(--text-primary)",
                              }}
                            >
                              <option value="">No bus yet</option>
                              {buses.map((bus) => (
                                <option key={bus.id} value={bus.id}>
                                  {bus.plate_number}
                                  {bus.model ? ` - ${bus.model}` : ""}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="space-y-1.5">
                            <span
                              className="text-sm font-medium"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              Boarding stop
                            </span>
                            <select
                              value={student.stop_id}
                              onChange={(e) =>
                                setStudentForms((current) =>
                                  current.map((item, idx) =>
                                    idx === index
                                      ? { ...item, stop_id: e.target.value }
                                      : item,
                                  ),
                                )
                              }
                              className="w-full px-4 py-2.5 rounded-xl text-sm border bg-white"
                              style={{
                                borderColor: "var(--border)",
                                color: "var(--text-primary)",
                              }}
                            >
                              <option value="">No stop yet</option>
                              {stops
                                .filter(
                                  (stop) =>
                                    !student.route_id ||
                                    stop.route_id === Number(student.route_id),
                                )
                                .map((stop) => (
                                  <option key={stop.id} value={stop.id}>
                                    {stop.name}
                                    {stop.route_name
                                      ? ` - ${stop.route_name}`
                                      : ""}
                                  </option>
                                ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {saveError && (
                <div
                  className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
                  style={{
                    backgroundColor: "var(--danger-light)",
                    color: "var(--danger)",
                  }}
                >
                  <AlertTriangle size={15} />
                  {saveError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeAddModal}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold border bg-white"
                  style={{
                    borderColor: "var(--border)",
                    color: "var(--text-secondary)",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity"
                  style={{
                    backgroundColor: "var(--navy)",
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? "Registering..." : "Register Students"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
          style={{ backgroundColor: "rgba(15, 23, 42, 0.45)" }}
        >
          <div
            className="w-full max-w-lg bg-white rounded-2xl border shadow-2xl"
            style={{ borderColor: "var(--border)" }}
          >
            <div
              className="flex items-center justify-between px-5 py-4 border-b"
              style={{ borderColor: "var(--border)" }}
            >
              <div>
                <h2
                  className="font-bold text-lg"
                  style={{ color: "var(--text-primary)" }}
                >
                  Edit Student
                </h2>
                <p
                  className="text-sm mt-0.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Update student information and transport assignment.
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="h-9 w-9 rounded-xl flex items-center justify-center hover:bg-slate-100"
                style={{ color: "var(--slate)" }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditStudent} className="p-5 space-y-5">
              {(() => {
                const student = students.find((s) => s.id === editingStudentId);
                return student ? (
                  <div
                    className="rounded-xl border bg-slate-50 p-4"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <p
                      className="text-xs font-semibold mb-2"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Guardian
                    </p>
                    <p
                      className="text-sm font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {student.parent_name}
                    </p>
                    <p className="text-xs" style={{ color: "var(--slate)" }}>
                      {student.parent_email}
                    </p>
                  </div>
                ) : null;
              })()}

              <div className="grid grid-cols-2 gap-4">
                <label className="space-y-1.5">
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Student name
                  </span>
                  <input
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm((current) => ({
                        ...current,
                        name: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                    style={{
                      borderColor: "var(--border)",
                      color: "var(--text-primary)",
                    }}
                  />
                </label>
                <label className="space-y-1.5">
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Grade
                  </span>
                  <input
                    value={editForm.grade}
                    onChange={(e) =>
                      setEditForm((current) => ({
                        ...current,
                        grade: e.target.value,
                      }))
                    }
                    placeholder="e.g. Grade 5"
                    className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                    style={{
                      borderColor: "var(--border)",
                      color: "var(--text-primary)",
                    }}
                  />
                </label>
              </div>

              <label className="block space-y-1.5">
                <span
                  className="text-sm font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Bus
                </span>
                <select
                  value={editForm.bus_id}
                  onChange={(e) =>
                    setEditForm((current) => ({
                      ...current,
                      bus_id: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-2.5 rounded-xl text-sm border bg-white"
                  style={{
                    borderColor: "var(--border)",
                    color: "var(--text-primary)",
                  }}
                >
                  <option value="">No bus assigned</option>
                  {buses.map((bus) => (
                    <option key={bus.id} value={bus.id}>
                      {bus.plate_number}
                      {bus.model ? ` - ${bus.model}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="space-y-1.5">
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Route
                  </span>
                  <select
                    value={editForm.route_id}
                    onChange={(e) =>
                      setEditForm((current) => ({
                        ...current,
                        route_id: e.target.value,
                        stop_id: "",
                      }))
                    }
                    className="w-full px-4 py-2.5 rounded-xl text-sm border bg-white"
                    style={{
                      borderColor: "var(--border)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <option value="">No route</option>
                    {routes.map((route) => (
                      <option key={route.id} value={route.id}>
                        {route.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Boarding stop
                  </span>
                  <select
                    value={editForm.stop_id}
                    onChange={(e) =>
                      setEditForm((current) => ({
                        ...current,
                        stop_id: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2.5 rounded-xl text-sm border bg-white"
                    style={{
                      borderColor: "var(--border)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <option value="">No stop</option>
                    {stops
                      .filter(
                        (stop) =>
                          !editForm.route_id ||
                          stop.route_id === Number(editForm.route_id),
                      )
                      .map((stop) => (
                        <option key={stop.id} value={stop.id}>
                          {stop.name}
                          {stop.route_name ? ` (${stop.route_name})` : ""}
                        </option>
                      ))}
                  </select>
                </label>
              </div>

              {editError && (
                <div
                  className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
                  style={{
                    backgroundColor: "var(--danger-light)",
                    color: "var(--danger)",
                  }}
                >
                  <AlertTriangle size={15} />
                  {editError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold border bg-white"
                  style={{
                    borderColor: "var(--border)",
                    color: "var(--text-secondary)",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity"
                  style={{
                    backgroundColor: "var(--navy)",
                    opacity: editSaving ? 0.7 : 1,
                  }}
                >
                  {editSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirm && deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
          style={{ backgroundColor: "rgba(15, 23, 42, 0.45)" }}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl border shadow-2xl"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="p-6 text-center">
              <div
                className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{ backgroundColor: "var(--danger-light)" }}
              >
                <Trash2 size={24} style={{ color: "var(--danger)" }} />
              </div>
              <h2
                className="text-lg font-bold mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                Delete Student
              </h2>
              <p
                className="text-sm mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                Are you sure you want to remove{" "}
                <strong style={{ color: "var(--text-primary)" }}>
                  {deleteTarget.name}
                </strong>{" "}
                from the student records?
              </p>
              <p className="text-xs" style={{ color: "var(--slate)" }}>
                Guardian: {deleteTarget.parent_name} (
                {deleteTarget.parent_email})
              </p>
              <p className="text-xs mt-3" style={{ color: "var(--danger)" }}>
                This action will deactivate the student record. It cannot be
                easily undone.
              </p>
              {deleteError && (
                <div
                  className="flex items-center justify-center gap-2 mt-3 rounded-xl px-4 py-2.5 text-sm"
                  style={{
                    backgroundColor: "var(--danger-light)",
                    color: "var(--danger)",
                  }}
                >
                  <AlertTriangle size={15} />
                  {deleteError}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 px-6 pb-6">
              <button
                type="button"
                onClick={closeDeleteConfirm}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border bg-white"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteStudent}
                disabled={deleteSaving}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity"
                style={{
                  backgroundColor: "var(--danger)",
                  opacity: deleteSaving ? 0.7 : 1,
                }}
              >
                {deleteSaving ? "Deleting..." : "Delete Student"}
              </button>
            </div>
          </div>
        </div>
      )}

      {openMenuId !== null && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => {
            setOpenMenuId(null);
            setMenuPosition(null);
          }}
        />
      )}

      {openMenuId !== null &&
        menuPosition &&
        (() => {
          const menuStudent = students.find((s) => s.id === openMenuId);
          if (!menuStudent) return null;
          return (
            <div
              className="fixed w-40 bg-white rounded-xl border shadow-lg z-30"
              style={{
                borderColor: "var(--border)",
                top: menuPosition.top,
                right: menuPosition.right,
              }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openEditModal(menuStudent);
                  setMenuPosition(null);
                }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-slate-50 rounded-t-xl"
                style={{ color: "var(--text-primary)" }}
              >
                <Pencil size={14} /> Edit student
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openDeleteConfirm(menuStudent);
                  setMenuPosition(null);
                }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-red-50 rounded-b-xl"
                style={{ color: "var(--danger)" }}
              >
                <Trash2 size={14} /> Delete student
              </button>
            </div>
          );
        })()}
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-xl border p-3"
      style={{ borderColor: "var(--border)" }}
    >
      <p className="text-xs" style={{ color: "var(--slate)" }}>
        {label}
      </p>
      <p
        className="text-sm font-semibold mt-1"
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </p>
    </div>
  );
}

function ContactRow({
  icon: Icon,
  value,
}: {
  icon: typeof Users;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: "var(--surface)", color: "var(--slate)" }}
      >
        <Icon size={15} />
      </div>
      <p className="text-sm truncate" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
    </div>
  );
}
