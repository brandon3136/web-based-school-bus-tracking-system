"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

// Which dashboard prefix each role is allowed to access.
const ROLE_PATHS: Record<string, string> = {
  admin: "/dashboard/admin",
  parent: "/dashboard/parent",
  driver: "/dashboard/driver",
};

/**
 * Client-side auth guard for all /dashboard/* routes.
 *
 * We can't do this in server-side middleware (proxy.ts) because the
 * frontend (Vercel) and backend (Render) live on different domains —
 * an auth cookie set by the backend is never visible to Vercel's edge
 * middleware. The token DOES reach the browser (via localStorage, set at
 * login), so we check it here instead, before rendering any page content.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("saferoute_token");
    const userStr = localStorage.getItem("saferoute_user");

    if (!token || !userStr) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    try {
      const user = JSON.parse(userStr) as { role?: string };
      const role = user.role || "";
      const allowedPrefix = ROLE_PATHS[role];

      if (!allowedPrefix || !pathname.startsWith(allowedPrefix)) {
        router.replace("/unauthorized");
        return;
      }

      setChecked(true);
    } catch {
      router.replace("/login");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--surface)" }}>
        <div
          className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: "var(--teal)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  return <>{children}</>;
}