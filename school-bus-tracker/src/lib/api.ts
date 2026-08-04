const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

/**
 * Authenticated fetch wrapper.
 * - Automatically includes credentials (cookies) for HTTP-only JWT auth.
 * - Falls back to Bearer token from localStorage for backward compatibility.
 * - On 401 (expired/invalid token): clears localStorage and redirects to login.
 */
export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${API_URL}${path}`;

  // Build headers: include Bearer token if available (backward compat)
  const headers = new Headers(options.headers || {});
  if (!headers.has("Authorization")) {
    const token = typeof window !== "undefined" ? localStorage.getItem("saferoute_token") : null;
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: "include", // Always send cookies
  });

  // Handle 401 globally: token expired or invalid
  if (res.status === 401 && typeof window !== "undefined") {
    localStorage.removeItem("saferoute_token");
    localStorage.removeItem("saferoute_user");
    // Redirect to login with current page as redirect target
    const currentPath = window.location.pathname;
    const redirectParam = currentPath !== "/login" ? `?redirect=${encodeURIComponent(currentPath)}` : "";
    window.location.href = `/login${redirectParam}`;
    // Return the response anyway so callers can handle it
    return res;
  }

  return res;
}

/**
 * Call the logout endpoint to clear auth cookies.
 */
export async function apiLogout(): Promise<void> {
  try {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Ignore errors during logout
  }
  if (typeof window !== "undefined") {
    localStorage.removeItem("saferoute_token");
    localStorage.removeItem("saferoute_user");
  }
}

export { API_URL };
