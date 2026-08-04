"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Bus, Eye, EyeOff, ArrowLeft } from "lucide-react";

type Role = "parent" | "admin" | "driver";

const ROLE_META: Record<Role, { label: string; demo: string; color: string }> = {
  parent: { label: "Parent", demo: "parent@school.tz", color: "#0D9488" },
  admin: { label: "Administrator", demo: "admin@school.tz", color: "#0F2B5B" },
  driver: { label: "Driver", demo: "driver@school.tz", color: "#F5A623" },
};

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [role, setRole] = useState<Role>((params.get("role") as Role) || "parent");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const r = params.get("role") as Role;
    if (r && ROLE_META[r]) setRole(r);
  }, [params]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json().catch(() => null) as {
        token?: string;
        user?: { role?: Role; name?: string; email?: string; phone?: string };
        error?: string;
      } | null;

      if (!response.ok || !data?.token || !data.user?.role) {
        setError(data?.error || "Login failed. Please check your credentials.");
        return;
      }

      if (data.user.role !== role) {
        setError(`This account is registered as ${data.user.role}. Select the correct role tab.`);
        return;
      }

      // Store user info in localStorage for display purposes (token is in cookie)
      localStorage.setItem("saferoute_user", JSON.stringify(data.user));

      // Redirect to the originally requested page, or default to dashboard
      const redirect = params.get("redirect");
      if (redirect && redirect.startsWith("/dashboard/")) {
        router.push(redirect);
      } else {
        router.push(`/dashboard/${data.user.role}`);
      }
    } catch {
      setError("Cannot reach the backend. Make sure SafeRoute API is running on port 4000.");
    } finally {
      setLoading(false);
    }
  }

  const meta = ROLE_META[role];

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "var(--navy)" }}>
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "var(--bus-yellow)" }}>
              <Bus size={22} color="#0F2B5B" />
            </div>
            <span className="text-white font-bold text-xl">SafeRoute</span>
          </Link>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm mb-6" style={{ color: "var(--slate)" }}>
            <ArrowLeft size={14} /> Back
          </Link>

          <div className="flex rounded-xl p-1 mb-6" style={{ backgroundColor: "var(--surface)" }}>
            {(Object.keys(ROLE_META) as Role[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className="flex-1 py-2 text-sm font-medium rounded-lg transition-all"
                style={role === r
                  ? { backgroundColor: "white", color: "var(--text-primary)", boxShadow: "0 1px 4px rgba(0,0,0,0.12)" }
                  : { color: "var(--text-secondary)" }}
              >
                {ROLE_META[r].label}
              </button>
            ))}
          </div>

          <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            Sign in as {meta.label}
          </h1>
          <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
            Demo email: <code className="font-mono">{meta.demo}</code>
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Email</label>
              <input
                type="email"
                placeholder={meta.demo}
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm border outline-none focus:ring-2 transition"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="********"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm border outline-none focus:ring-2 transition pr-11"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--slate)" }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && <p className="text-sm font-medium" style={{ color: "var(--danger)" }}>{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-opacity"
              style={{ backgroundColor: meta.color, color: role === "parent" || role === "admin" ? "white" : "var(--navy)", opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Signing in..." : `Sign in as ${meta.label}`}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
