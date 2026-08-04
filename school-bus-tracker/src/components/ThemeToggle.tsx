"use client";
import { useTheme } from "@/hooks/useTheme";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const { theme, toggleTheme, mounted } = useTheme();

  if (!mounted) {
    // Render a placeholder during SSR to avoid hydration mismatch
    return (
      <button
        className="relative w-14 h-7 rounded-full border transition-colors duration-300"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
        disabled
        aria-label="Toggle theme"
      />
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      className="relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2"
      style={{
        backgroundColor: isDark ? "#334155" : "#E2E8F0",
        focusRingColor: isDark ? "#6B9FE8" : "#0F2B5B",
      }}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {/* Track background gradient */}
      <span
        className="absolute inset-0 rounded-full transition-opacity duration-300"
        style={{
          background: isDark
            ? "linear-gradient(135deg, #1e293b 0%, #334155 100%)"
            : "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)",
        }}
      />

      {/* Sliding thumb */}
      <span
        className="absolute top-0.5 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ease-in-out shadow-md"
        style={{
          left: isDark ? "calc(100% - 1.625rem)" : "0.125rem",
          backgroundColor: isDark ? "#1e293b" : "#ffffff",
          boxShadow: isDark
            ? "0 1px 4px rgba(0,0,0,0.4), 0 0 8px rgba(107,159,232,0.2)"
            : "0 1px 4px rgba(0,0,0,0.15), 0 0 8px rgba(15,43,91,0.08)",
        }}
      >
        <span className="transition-all duration-300" style={{ transform: isDark ? "rotate(360deg)" : "rotate(0deg)" }}>
          {isDark ? (
            <Moon size={13} style={{ color: "#6B9FE8" }} />
          ) : (
            <Sun size={13} style={{ color: "#F5A623" }} />
          )}
        </span>
      </span>

      {/* Stars decoration (dark mode only) */}
      {isDark && (
        <>
          <span
            className="absolute w-1 h-1 rounded-full transition-opacity duration-500"
            style={{ backgroundColor: "#6B9FE8", top: "0.5rem", left: "0.5rem", opacity: 0.6 }}
          />
          <span
            className="absolute w-0.5 h-0.5 rounded-full transition-opacity duration-500"
            style={{ backgroundColor: "#94A3B8", top: "0.875rem", left: "0.75rem", opacity: 0.4 }}
          />
        </>
      )}
    </button>
  );
}
