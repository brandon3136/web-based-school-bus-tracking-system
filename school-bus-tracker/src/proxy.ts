import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// NOTE: Route protection can NOT be done here.
//
// The frontend (vercel.app) and backend (onrender.com) are different domains.
// saferoute_token / saferoute_role cookies are set by the BACKEND's Set-Cookie
// header, so they are scoped to onrender.com only — the browser never attaches
// them to requests made to this Next.js server (vercel.app). request.cookies.get()
// here will always return undefined, which previously caused every visit to
// /dashboard/* to redirect back to /login even when the user was authenticated.
//
// Auth/role protection instead happens:
//   1. Client-side: dashboard pages call the backend via apiFetch() (lib/api.ts),
//      which sends the cookie correctly (same domain as the cookie) and redirects
//      to /login on a 401 response.
//   2. Server-side (source of truth): every protected backend route is wrapped
//      with `authenticate` / `authorize(...)` middleware in the Express API.
//
// If you later move both frontend and backend under one parent domain (e.g.
// app.example.com + api.example.com) you can set Domain=.example.com on the
// cookies and restore a cookie check here.

export function proxy(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  // Only run on page routes, not static assets or API routes
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};