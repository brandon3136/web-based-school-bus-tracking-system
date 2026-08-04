"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bus, LucideIcon, Menu, X } from "lucide-react";
import { apiLogout } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationBell from "@/components/NotificationBell";

interface NavItem { href: string; label: string; icon: LucideIcon; }
interface SidebarProps { role: "parent" | "admin" | "driver"; items: NavItem[]; accentColor: string; userName?: string; }
const FOCUSABLE = ["a[href]", "button:not([disabled])", "[tabindex]:not([tabindex='-1'])"].join(",");

export default function Sidebar({ role, items, accentColor, userName = "User" }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const restoreFocusRef = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const previousPathname = useRef(pathname);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const closeMenu = useCallback(() => { setIsOpen(false); if (isMounted) document.getElementById("mobile-navigation-trigger")?.focus(); }, [isMounted]);
  const openMenu = () => { setIsMounted(true); requestAnimationFrame(() => setIsOpen(true)); };

  const handleTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    setTouchStartX(event.touches[0]?.clientX ?? null);
  };
  const handleTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    const endX = event.changedTouches[0]?.clientX;
    if (touchStartX !== null && endX !== undefined && touchStartX - endX > 56) closeMenu();
    setTouchStartX(null);
  };

  async function handleSignOut(e: React.MouseEvent) { e.preventDefault(); closeMenu(); await apiLogout(); router.push("/login"); }

  useEffect(() => { if (previousPathname.current !== pathname) closeMenu(); previousPathname.current = pathname; }, [pathname, closeMenu]);
  useEffect(() => {
    if (!isOpen) return;
    const overflow = document.body.style.overflow;
    const paddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    const focusTimer = window.setTimeout(() => dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeMenu(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const nodes = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!nodes.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { window.clearTimeout(focusTimer); document.body.style.overflow = overflow; document.body.style.paddingRight = paddingRight; document.removeEventListener("keydown", onKeyDown); };
  }, [isOpen, closeMenu]);
  useEffect(() => { if (!isMounted || isOpen) return; const timer = window.setTimeout(() => setIsMounted(false), 300); return () => window.clearTimeout(timer); }, [isMounted, isOpen]);
  useEffect(() => {
    if (isOpen || !restoreFocusRef.current) return;
    triggerRef.current?.focus();
    restoreFocusRef.current = false;
  }, [isOpen, closeMenu]);

  const navLinks = (onNavigate?: () => void) => <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Primary navigation">{items.map((item) => {
    const active = pathname === item.href, Icon = item.icon;
    return <Link key={item.href} href={item.href} onClick={onNavigate} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all" style={active ? { backgroundColor: `color-mix(in srgb, ${accentColor} 10%, transparent)`, color: accentColor } : { color: "var(--text-secondary)" }}><Icon size={17} />{item.label}</Link>;
  })}</nav>;

  const accountControls = () => <><div className="px-4 py-3 border-t flex items-center justify-between" style={{ borderColor: "var(--border)" }}><span className="text-xs font-medium" style={{ color: "var(--slate)" }}>Appearance</span><div className="flex items-center gap-1"><NotificationBell /><ThemeToggle /></div></div><div className="px-4 py-4 border-t" style={{ borderColor: "var(--border)" }}><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: accentColor }}>{userName[0].toUpperCase()}</div><div><p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{userName}</p><button onClick={handleSignOut} className="text-xs cursor-pointer" style={{ color: "var(--slate)" }}>Sign out</button></div></div></div></>;

  return <>
    <aside className="hidden md:flex flex-col w-60 min-h-screen border-r" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}><div className="flex items-center gap-3 px-5 py-5 border-b" style={{ borderColor: "var(--border)" }}><div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--navy)" }}><Bus size={16} color="white" /></div><div><p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>SafeRoute</p><p className="text-xs capitalize" style={{ color: "var(--text-secondary)" }}>{role} portal</p></div></div>{navLinks()}{accountControls()}</aside>
    <button id="mobile-navigation-trigger" ref={triggerRef} type="button" onClick={isOpen ? closeMenu : openMenu} className="md:hidden fixed left-4 top-4 z-40 inline-flex h-11 w-11 items-center justify-center rounded-xl border shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--text-primary)", boxShadow: "0 8px 24px var(--shadow)" }} aria-label={isOpen ? "Close navigation" : "Open navigation"} aria-expanded={isOpen} aria-controls="mobile-navigation"><Menu size={22} aria-hidden="true" /></button>
    {isMounted && <div className="md:hidden fixed inset-0 z-50"><button type="button" aria-label="Close navigation" onClick={closeMenu} className={`absolute inset-0 bg-slate-950/45 transition-opacity duration-200 motion-reduce:transition-none ${isOpen ? "opacity-100" : "opacity-0"}`} /><aside id="mobile-navigation" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="mobile-navigation-title" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} className={`absolute inset-y-0 left-0 flex w-[min(20rem,86vw)] flex-col border-r shadow-2xl transition-transform duration-300 motion-reduce:transition-none ${isOpen ? "translate-x-0 ease-[cubic-bezier(.22,1,.36,1)]" : "-translate-x-full ease-[cubic-bezier(.55,0,1,.45)]"}`} style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}><div className="flex items-center justify-between gap-3 px-5 py-5 border-b" style={{ borderColor: "var(--border)" }}><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--navy)" }}><Bus size={16} color="white" /></div><div><p id="mobile-navigation-title" className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>SafeRoute</p><p className="text-xs capitalize" style={{ color: "var(--text-secondary)" }}>{role} portal</p></div></div><button type="button" onClick={closeMenu} className="inline-flex h-10 w-10 items-center justify-center rounded-lg focus:outline-none focus:ring-2" aria-label="Close navigation" style={{ color: "var(--text-primary)" }}><X size={21} aria-hidden="true" /></button></div>{navLinks(closeMenu)}{accountControls()}</aside></div>}
  </>;
}