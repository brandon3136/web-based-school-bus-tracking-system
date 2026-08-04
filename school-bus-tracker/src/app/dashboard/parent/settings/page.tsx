"use client";
import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { apiFetch, apiLogout } from "@/lib/api";
import {
  MapPin, Bell, Clock, Settings as SettingsIcon, User, Phone, Mail, Lock, Eye, EyeOff,
  KeyRound, AlertTriangle, CheckCircle2, Shield, Calendar,
} from "lucide-react";

const NAV = [
  { href: "/dashboard/parent", label: "Live Tracking", icon: MapPin },
  { href: "/dashboard/parent/alerts", label: "Alerts", icon: Bell },
  { href: "/dashboard/parent/history", label: "Trip History", icon: Clock },
  { href: "/dashboard/parent/settings", label: "Settings", icon: SettingsIcon },
];

interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  created_at: string;
}

export default function ParentSettings() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [profileForm, setProfileForm] = useState({ name: "", email: "", phone: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const [activeSection, setActiveSection] = useState<"profile" | "password">("profile");

  useEffect(() => {
    apiFetch("/api/auth/me")
      .then(res => res.ok ? res.json() : Promise.reject("Failed"))
      .then((data: UserProfile) => {
        setProfile(data);
        setProfileForm({ name: data.name, email: data.email, phone: data.phone || "" });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(""); setProfileSuccess("");
    if (!profileForm.name.trim()) { setProfileError("Name is required."); return; }
    if (profileForm.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileForm.email.trim())) {
      setProfileError("Please enter a valid email address."); return;
    }
    setProfileSaving(true);
    try {
      const res = await apiFetch("/api/auth/me", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profileForm.name.trim(), email: profileForm.email.trim(), phone: profileForm.phone.trim() || null }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setProfileError(data?.error || "Could not update profile."); return; }
      if (profile) {
        const updated = { ...profile, name: profileForm.name.trim(), email: profileForm.email.trim(), phone: profileForm.phone.trim() || null };
        setProfile(updated);
        localStorage.setItem("saferoute_user", JSON.stringify(updated));
      }
      setProfileSuccess("Profile updated successfully.");
      setTimeout(() => setProfileSuccess(""), 5000);
    } catch { setProfileError("Could not connect to the server."); }
    finally { setProfileSaving(false); }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(""); setPwSuccess("");
    if (!pwForm.currentPassword || !pwForm.newPassword) { setPwError("All fields are required."); return; }
    if (pwForm.newPassword.length < 6) { setPwError("New password must be at least 6 characters."); return; }
    if (pwForm.newPassword !== pwForm.confirmPassword) { setPwError("Passwords do not match."); return; }
    setPwSaving(true);
    try {
      const res = await apiFetch("/api/auth/password", {
        method: "PUT", headers: { "Content-Type": "application/json" },
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

  async function handleSignOut() { await apiLogout(); window.location.href = "/login"; }

  const sections = [
    { id: "profile" as const, label: "Profile", icon: User },
    { id: "password" as const, label: "Password", icon: Lock },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--surface)" }}>
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: "var(--teal)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "var(--surface)" }}>
      <Sidebar role="parent" items={NAV} accentColor="#0D9488" userName={profile?.name || "Parent"} />

      <main className="flex-1 min-w-0 p-6 md:p-8 overflow-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Settings</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Manage your account and preferences.</p>
          </div>
</div>

        <div className="grid xl:grid-cols-[240px_1fr] gap-6">
          <div className="rounded-2xl border p-3 h-fit" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <nav className="space-y-1">
              {sections.map(s => {
                const Icon = s.icon;
                const isActive = activeSection === s.id;
                return (
                  <button key={s.id} onClick={() => setActiveSection(s.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left"
                    style={isActive
                      ? { backgroundColor: "color-mix(in srgb, #0D9488 15%, transparent)", color: "#0D9488" }
                      : { color: "var(--text-secondary)" }}>
                    <Icon size={17} />{s.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="space-y-6">
            {activeSection === "profile" && profile && (
              <>
                <div className="rounded-2xl border p-6" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                  <h2 className="text-base font-bold mb-4" style={{ color: "var(--text-primary)" }}>Account Information</h2>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: "color-mix(in srgb, #0D9488 15%, transparent)", color: "#0D9488" }}>
                        <Mail size={16} /></div>
                      <div>
                        <p className="text-xs" style={{ color: "var(--slate)" }}>Email</p>
                        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{profile.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: "color-mix(in srgb, #0D9488 15%, transparent)", color: "#0D9488" }}>
                        <Shield size={16} /></div>
                      <div>
                        <p className="text-xs" style={{ color: "var(--slate)" }}>Role</p>
                        <p className="text-sm font-medium capitalize" style={{ color: "var(--text-primary)" }}>{profile.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: "color-mix(in srgb, #0D9488 15%, transparent)", color: "#0D9488" }}>
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

                <div className="rounded-2xl border p-6" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                  <h2 className="text-base font-bold mb-4" style={{ color: "var(--text-primary)" }}>Edit Profile</h2>
                  <form onSubmit={handleSaveProfile} className="space-y-4 max-w-md">
                    <label className="space-y-1.5 block">
                      <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Full name</span>
                      <div className="relative">
                        <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--slate)" }} />
                        <input value={profileForm.name} onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                          style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "var(--input-bg)" }} />
                      </div>
                    </label>
                    <label className="space-y-1.5 block">
                      <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Email address</span>
                      <div className="relative">
                        <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--slate)" }} />
                        <input type="email" value={profileForm.email} onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))}
                          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                          style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "var(--input-bg)" }} />
                      </div>
                      {profileForm.email !== profile.email && (
                        <p className="text-xs" style={{ color: "#0D9488" }}>This will change your login email.</p>
                      )}
                    </label>
                    <label className="space-y-1.5 block">
                      <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Phone number</span>
                      <div className="relative">
                        <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--slate)" }} />
                        <input value={profileForm.phone} onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                          placeholder="e.g. +255712345678"
                          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                          style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "var(--input-bg)" }} />
                      </div>
                    </label>
                    {profileError && <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: "var(--danger-light)", color: "var(--danger)" }}><AlertTriangle size={14} />{profileError}</div>}
                    {profileSuccess && <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: "var(--teal-light)", color: "var(--teal)" }}><CheckCircle2 size={14} />{profileSuccess}</div>}
                    <button type="submit" disabled={profileSaving}
                      className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-70"
                      style={{ backgroundColor: "#0D9488" }}>
                      {profileSaving ? "Saving..." : "Save Changes"}
                    </button>
                  </form>
                </div>
              </>
            )}

            {activeSection === "password" && (
              <div className="rounded-2xl border p-6" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: "color-mix(in srgb, #0D9488 15%, transparent)", color: "#0D9488" }}>
                    <KeyRound size={18} /></div>
                  <div>
                    <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Change Password</h2>
                    <p className="text-xs" style={{ color: "var(--slate)" }}>Use a strong password with at least 6 characters.</p>
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
                        style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "var(--input-bg)" }} />
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
                        style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "var(--input-bg)" }} />
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
                        style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "var(--input-bg)" }} />
                    </div>
                  </label>
                  {pwError && <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: "var(--danger-light)", color: "var(--danger)" }}><AlertTriangle size={14} />{pwError}</div>}
                  {pwSuccess && <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: "var(--teal-light)", color: "var(--teal)" }}><CheckCircle2 size={14} />{pwSuccess}</div>}
                  <button type="submit" disabled={pwSaving}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-70"
                    style={{ backgroundColor: "#0D9488" }}>
                    {pwSaving ? "Changing..." : "Change Password"}
                  </button>
                </form>
              </div>
            )}

            <div className="rounded-2xl border p-6" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
              <h2 className="text-base font-bold mb-2" style={{ color: "var(--text-primary)" }}>Sign Out</h2>
              <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>Sign out of your account on this device.</p>
              <button onClick={handleSignOut}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border"
                style={{ borderColor: "var(--danger)", color: "var(--danger)", backgroundColor: "var(--danger-light)" }}>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
