"use client";
import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--surface)" }}>
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ backgroundColor: "var(--danger-light)" }}>
          <ShieldAlert size={32} style={{ color: "var(--danger)" }} />
        </div>
        <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Access Denied</h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
          You don't have permission to access this page. Your account role doesn't match the required access level.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
            <ArrowLeft size={15} /> Go Home
          </Link>
          <Link href="/login"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ backgroundColor: "var(--navy)" }}>
            Sign in with another account
          </Link>
        </div>
      </div>
    </div>
  );
}
