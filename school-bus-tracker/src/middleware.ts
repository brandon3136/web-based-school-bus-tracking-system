import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that don't require authentication
const PUBLIC_PATHS = ["/", "/login", "/unauthorized"];

// Role-based route mapping: which dashboard paths each role can access
const ROLE_PATHS: Record<string, string[]> = {
  admin: ["/dashboard/admin"],
  parent: ["/dashboard/parent"],
  driver: ["/dashboard/driver"],
};

// Paths that require authentication (any role)
const PROTECTED_PREFIXES = ["/dashboard"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some(p => pathname === p) || pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  // Check if this is a protected route
  const isProtected = PROTECTED_PREFIXES.some(prefix => pathname.startsWith(prefix));
  if (!isProtected) {
    return NextResponse.next();
  }

  // Check for auth token cookie (HTTP-only, but middleware can read it)
  const token = request.cookies.get("saferoute_token")?.value;
  if (!token) {
    // Not authenticated — redirect to login with the original URL as redirect param
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Check role-based access
  const role = request.cookies.get("saferoute_role")?.value;
  if (!role) {
    // Token exists but no role cookie — redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verify the user's role has access to this path
  const allowedPrefixes = ROLE_PATHS[role] || [];
  const hasAccess = allowedPrefixes.some(prefix => pathname.startsWith(prefix));

  if (!hasAccess) {
    // Role doesn't have access to this route — redirect to unauthorized
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Only run middleware on page routes, not on static assets or API routes
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
