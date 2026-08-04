"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

type Role = "parent" | "admin" | "driver";

interface StoredUser {
  role?: Role;
  name?: string;
  email?: string;
  phone?: string;
}

/**
 * Client-side route guard.
 *
 * Why this exists: auth/role protection can't be done in proxy.ts (Next.js
 * middleware) because the auth cookie is set by the backend on a different
 * domain (onrender.com) and is never visible to requests made to the
 * frontend's own server (vercel.app) — see the comment in src/proxy.ts.
 *
 * This is a UX convenience only, not a security boundary — the backend's
 * `authenticate`/`authorize(...)` middleware is what actually protects data.
 * This component just stops a signed-in user (or one with a stale/missing
 * localStorage entry) from briefly seeing the wrong dashboard's empty shell
 * before its API calls come back 401/403.
 */
export default function RequireRole({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let user: StoredUser | null = null;
    try {
      const raw = localStorage.getItem("saferoute_user");
      user = raw ? (JSON.parse(raw) as StoredUser) : null;
    } catch {
      user = null;
    }

    if (!user?.role) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    if (user.role !== role) {
      router.replace("/unauthorized");
      return;
    }

    setChecked(true);
    // Only re-run if the role this guard expects changes; pathname/router
    // identity churn shouldn't force a re-check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // Render nothing until we've confirmed the stored user matches this
  // dashboard's role, so the wrong-role page shell never flashes on screen.
  if (!checked) return null;

  return <>{children}</>;
}
