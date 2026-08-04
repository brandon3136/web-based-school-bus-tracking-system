"use client";
import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import {
  AlertTriangle, Bus, CheckCircle2, LayoutDashboard, MapPin,
  Search, Settings as SettingsIcon, Users, Clock, Truck, Shield,
  User, Phone, Mail, Lock, Eye, EyeOff, KeyRound, Calendar,
  RefreshCw, Database,
} from "lucide-react";
import { apiFetch, apiLogout } from "@/lib/api";


const NAV = [
  { href: "/dashboard/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/admin/fleet", label: "Fleet", icon: Bus },
  { href: "/dashboard/admin/routes", label: "Routes & Stops", icon: MapPin },
  { href: "/dashboard/admin/students", label: "Students", icon: Users },
  { href: "/dashboard/admin/drivers", label: "Drivers", icon: Truck },
  { href: "/dashboard/admin/history", label: "GPS Logs", icon: Clock },
  { href: "/dashboard/admin/settings", label: "Settings", icon: SettingsIcon },
];

interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  created_at: string;
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadError, setLoadError] = useState("");

  // Profile form
  const [profileForm, setProfileForm] = useState({ name: "", phone: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

  // Password form
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // Active section
  const [activeSection, setActiveSection] = useState<"profile" | "password" | "system" | "database">("profile");

  // Database reset
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");

  useEffect(() => {
    apiFetch("/api/auth/me")
      .then(res => res.ok ? res.json() : Promise.reject("Failed to load profile"))
      .then((data: UserProfile) => {
        setProfile(data);
        setProfileForm({ name: data.name, phone: data.phone || "" });
      })
      .catch(err => setLoadError(typeof err === "string" ? err : "Could not load profile."))
      .finally(() => setLoading(false));
  }, []);

  // Save profile
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");
    if (!profileForm.name.trim()) { setProfileError("Name is required."); return; }
    setProfileSaving(true);
    try {
      const res = await apiFetch("/api/auth/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profileForm.name.trim(), phone: profileForm.phone.trim() || null }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setProfileError(data?.error || "Could not update profile."); return; }
      // Update local profile
      if (profile) setProfile({ ...profile, name: profileForm.name.trim(), phone: profileForm.phone.trim() || null });
      // Update localStorage
      const userStr = localStorage.getItem("saferoute_user");
      if (userStr) {
        try {
          const u = JSON.parse(userStr);
          u.name = profileForm.name.trim();
          u.phone = profileForm.phone.trim() || null;
          localStorage.setItem("saferoute_user", JSON.stringify(u));
        } catch { /* ignore */ }
      }
      setProfileSuccess("Profile updated successfully.");
      setTimeout(() => setProfileSuccess(""), 5000);
    } catch { setProfileError("Could not connect to the server."); }
    finally { setProfileSaving(false); }
  }

  // Change password
  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");
    setPwSuccess("");
    if (!pwForm.currentPassword || !pwForm.newPassword) { setPwError("All fields are required."); return; }
    if (pwForm.newPassword.length < 6) { setPwError("New password must be at least 6 characters."); return; }
    if (pwForm.newPassword !== pwForm.confirmPassword) { setPwError("Passwords do not match."); return; }
    setPwSaving(true);
    try {
      const res = await apiFetch("/api/auth/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setPwError(data?.error || "Could not change password."); return; }
      setPwSuccess("Password changed successfully.");
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setTimeout(() => setPwSuccess(""), 5000);
    } catch { setPwError("Could not connect to the server."); }
    finally { setPwSaving(false); }
  }

  const sections = [
    { id: "profile" as const, label: "Profile", icon: User },
    { id: "password" as const, label: "Password", icon: Lock },
    { id: "system" as const, label: "System", icon: SettingsIcon },
    { id: "database" as const, label: "Database", icon: Database },
  ];

  async function handleResetDatabase() {
    setResetLoading(true);
    setResetError("");
    setResetSuccess("");
    try {
      const res = await apiFetch("/api/auth/reset-db", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setResetError(data?.error || "Failed to reset database."); return; }
      setResetSuccess("Database reset to seed state successfully. All data has been restored to defaults.");
      setResetConfirm(false);
      setTimeout(() => setResetSuccess(""), 8000);
    } catch { setResetError("Could not connect to the server."); }
    finally { setResetLoading(false); }
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
      <Sidebar role="admin" items={NAV} accentColor="var(--navy)" userName={profile?.name || "Admin"} />

      <main className="flex-1 min-w-0 p-6 md:p-8 overflow-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Settings</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Manage your account and system preferences.
          </p>
        </div>

        {loadError && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm bg-white" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
            <AlertTriangle size={16} color="#F5A623" />{loadError}
          </div>
        )}

        <div className="grid xl:grid-cols-[240px_1fr] gap-6">
          {/* Section nav */}
          <div className="bg-white rounded-2xl border p-3 h-fit" style={{ borderColor: "var(--border)" }}>
            <nav className="space-y-1">
              {sections.map(s => {
                const Icon = s.icon;
                const isActive = activeSection === s.id;
                return (
                  <button key={s.id} onClick={() => setActiveSection(s.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left"
                    style={isActive
                      ? { backgroundColor: "color-mix(in srgb, var(--navy) 10%, transparent)", color: "var(--navy)" }
                      : { color: "var(--text-secondary)" }}>
                    <Icon size={17} />{s.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="space-y-6">
            {/* Profile section */}
            {activeSection === "profile" && profile && (
              <>
                {/* Account info (read-only) */}
                <div className="bg-white rounded-2xl border p-6" style={{ borderColor: "var(--border)" }}>
                  <h2 className="text-base font-bold mb-4" style={{ color: "var(--text-primary)" }}>Account Information</h2>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: "color-mix(in srgb, var(--navy) 10%, transparent)", color: "var(--navy)" }}>
                        <Mail size={16} /></div>
                      <div>
                        <p className="text-xs" style={{ color: "var(--slate)" }}>Email</p>
                        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{profile.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: "color-mix(in srgb, var(--teal) 10%, transparent)", color: "var(--teal)" }}>
                        <Shield size={16} /></div>
                      <div>
                        <p className="text-xs" style={{ color: "var(--slate)" }}>Role</p>
                        <p className="text-sm font-medium capitalize" style={{ color: "var(--text-primary)" }}>{profile.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: "color-mix(in srgb, var(--bus-yellow) 15%, transparent)", color: "var(--bus-yellow)" }}>
                        <Calendar size={16} /></div>
                      <div>
                        <p className="text-xs" style={{ color: "var(--slate)" }}>Member since</p>
                        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          {new Date(profile.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Edit profile */}
                <div className="bg-white rounded-2xl border p-6" style={{ borderColor: "var(--border)" }}>
                  <h2 className="text-base font-bold mb-4" style={{ color: "var(--text-primary)" }}>Edit Profile</h2>
                  <form onSubmit={handleSaveProfile} className="space-y-4 max-w-md">
                    <label className="space-y-1.5 block">
                      <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Full name</span>
                      <div className="relative">
                        <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--slate)" }} />
                        <input value={profileForm.name} onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
                      </div>
                    </label>
                    <label className="space-y-1.5 block">
                      <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Phone number</span>
                      <div className="relative">
                        <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--slate)" }} />
                        <input value={profileForm.phone} onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                          placeholder="e.g. +255712345678"
                          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
                      </div>
                    </label>
                    {profileError && <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: "var(--danger-light)", color: "var(--danger)" }}><AlertTriangle size={14} />{profileError}</div>}
                    {profileSuccess && <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: "var(--teal-light)", color: "var(--teal)" }}><CheckCircle2 size={14} />{profileSuccess}</div>}
                    <button type="submit" disabled={profileSaving}
                      className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-70"
                      style={{ backgroundColor: "var(--navy)" }}>
                      {profileSaving ? "Saving..." : "Save Changes"}
                    </button>
                  </form>
                </div>
              </>
            )}

            {/* Password section */}
            {activeSection === "password" && (
              <div className="bg-white rounded-2xl border p-6" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: "color-mix(in srgb, var(--navy) 10%, transparent)", color: "var(--navy)" }}>
                    <KeyRound size={18} /></div>
                  <div>
                    <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Change Password</h2>
                    <p className="text-xs" style={{ color: "var(--slate)" }}>Update your account password. Use a strong password with at least 6 characters.</p>
                  </div>
                </div>
                <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                  <label className="space-y-1.5 block">
                    <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Current password</span>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--slate)" }} />
                      <input type={showCurrentPw ? "text" : "password"} value={pwForm.currentPassword}
                        onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
                        className="w-full pl-9 pr-10 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                        style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
                      <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--slate)" }}>
                        {showCurrentPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </label>
                  <label className="space-y-1.5 block">
                    <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>New password</span>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--slate)" }} />
                      <input type={showNewPw ? "text" : "password"} value={pwForm.newPassword}
                        onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
                        className="w-full pl-9 pr-10 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                        style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
                      <button type="button" onClick={() => setShowNewPw(!showNewPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--slate)" }}>
                        {showNewPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </label>
                  <label className="space-y-1.5 block">
                    <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Confirm new password</span>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--slate)" }} />
                      <input type="password" value={pwForm.confirmPassword}
                        onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))}
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                        style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
                    </div>
                  </label>
                  {pwError && <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: "var(--danger-light)", color: "var(--danger)" }}><AlertTriangle size={14} />{pwError}</div>}
                  {pwSuccess && <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: "var(--teal-light)", color: "var(--teal)" }}><CheckCircle2 size={14} />{pwSuccess}</div>}
                  <button type="submit" disabled={pwSaving}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-70"
                    style={{ backgroundColor: "var(--navy)" }}>
                    {pwSaving ? "Changing..." : "Change Password"}
                  </button>
                </form>
              </div>
            )}

            {/* System section */}
            {activeSection === "system" && (
              <>
                <div className="bg-white rounded-2xl border p-6" style={{ borderColor: "var(--border)" }}>
                  <h2 className="text-base font-bold mb-4" style={{ color: "var(--text-primary)" }}>System Information</h2>
                  <div className="space-y-4">
                    {[
                      { label: "Application", value: "SafeRoute School Bus Tracker" },
                      { label: "Version", value: "1.0.0" },
                      { label: "Backend URL", value: API_URL },
                      { label: "Frontend URL", value: typeof window !== "undefined" ? window.location.origin : "http://localhost:3000" },
                      { label: "Environment", value: "Development" },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{item.label}</span>
                        <span className="text-sm font-medium font-mono" style={{ color: "var(--text-primary)" }}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border p-6" style={{ borderColor: "var(--border)" }}>
                  <h2 className="text-base font-bold mb-4" style={{ color: "var(--text-primary)" }}>Database</h2>
                  <div className="space-y-4">
                    {[
                      { label: "Database", value: "saferoute (MySQL)" },
                      { label: "Auth", value: "JWT with bcrypt password hashing" },
                      { label: "Session", value: "HTTP-only cookie with JWT (7-day expiry)" },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{item.label}</span>
                        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border p-6" style={{ borderColor: "var(--border)" }}>
                  <h2 className="text-base font-bold mb-2" style={{ color: "var(--text-primary)" }}>Danger Zone</h2>
                  <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>Sign out of your account on this device.</p>
                  <a href="/login"
                    onClick={async (e) => { e.preventDefault(); await apiLogout(); window.location.href = "/login"; }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border"
                    style={{ borderColor: "var(--danger)", color: "var(--danger)", backgroundColor: "var(--danger-light)" }}>
                    Sign Out
                  </a>
                </div>
              </>
            )}

            {/* Database section */}
            {activeSection === "database" && (
              <div className="space-y-6">
                <div className="rounded-2xl border p-6" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: "var(--danger-light)", color: "var(--danger)" }}>
                      <Database size={18} /></div>
                    <div>
                      <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Reset Database</h2>
                      <p className="text-xs" style={{ color: "var(--slate)" }}>Restore all data to the original seed state.</p>
                    </div>
                  </div>

                  <div className="rounded-xl border p-4 mb-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
                    <p className="text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>This action will:</p>
                    <ul className="space-y-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                      <li className="flex items-center gap-2"><RefreshCw size={13} /> Delete all students, trips, GPS logs, and boarding records</li>
                      <li className="flex items-center gap-2"><RefreshCw size={13} /> Remove all non-seed buses, routes, stops, and users</li>
                      <li className="flex items-center gap-2"><RefreshCw size={13} /> Restore the seed bus (T 123 DAR), route, stops, and users</li>
                      <li className="flex items-center gap-2"><RefreshCw size={13} /> Reset all seed users to active status</li>
                    </ul>
                  </div>

                  {resetError && <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm mb-4" style={{ backgroundColor: "var(--danger-light)", color: "var(--danger)" }}><AlertTriangle size={14} />{resetError}</div>}
                  {resetSuccess && <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm mb-4" style={{ backgroundColor: "var(--teal-light)", color: "var(--teal)" }}><CheckCircle2 size={14} />{resetSuccess}</div>}

                  {!resetConfirm ? (
                    <button onClick={() => setResetConfirm(true)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border"
                      style={{ borderColor: "var(--danger)", color: "var(--danger)", backgroundColor: "var(--danger-light)" }}>
                      <RefreshCw size={15} /> Reset Database
                    </button>
                  ) : (
                    <div className="rounded-xl border-2 p-4" style={{ borderColor: "var(--danger)" }}>
                      <p className="text-sm font-semibold mb-3" style={{ color: "var(--danger)" }}>
                        Are you sure? This cannot be undone.
                      </p>
                      <div className="flex items-center gap-3">
                        <button onClick={handleResetDatabase} disabled={resetLoading}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-70"
                          style={{ backgroundColor: "var(--danger)" }}>
                          {resetLoading ? <><RefreshCw size={15} className="animate-spin" /> Resetting...</> : <><RefreshCw size={15} /> Confirm Reset</>}
                        </button>
                        <button onClick={() => setResetConfirm(false)}
                          className="px-4 py-2.5 rounded-xl text-sm font-semibold border"
                          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
