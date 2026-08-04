"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bus, LucideIcon } from "lucide-react";
import { apiLogout } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationBell from "@/components/NotificationBell";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface SidebarProps {
  role: "parent" | "admin" | "driver";
  items: NavItem[];
  accentColor: string;
  userName?: string;
}

export default function Sidebar({ role, items, accentColor, userName = "User" }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut(e: React.MouseEvent) {
    e.preventDefault();
    await apiLogout();
    router.push("/login");
  }

  return (
    <aside className="hidden md:flex flex-col w-60 min-h-screen border-r" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--navy)" }}>
          <Bus size={16} color="white" />
        </div>
        <div>
          <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>SafeRoute</p>
          <p className="text-xs capitalize" style={{ color: "var(--text-secondary)" }}>{role} portal</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={active
                ? { backgroundColor: `color-mix(in srgb, ${accentColor} 10%, transparent)`, color: accentColor }
                : { color: "var(--text-secondary)" }}
            >
              <Icon size={17} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Appearance + Notifications */}
      <div className="px-4 py-3 border-t flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
        <span className="text-xs font-medium" style={{ color: "var(--slate)" }}>Appearance</span>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <ThemeToggle />
        </div>
      </div>

      {/* User */}
      <div className="px-4 py-4 border-t" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ backgroundColor: accentColor }}>
            {userName[0].toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{userName}</p>
            <button onClick={handleSignOut} className="text-xs cursor-pointer" style={{ color: "var(--slate)" }}>Sign out</button>
          </div>
        </div>
      </div>
    </aside>
  );
}
