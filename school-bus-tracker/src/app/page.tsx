import Link from "next/link";
import { Bus, Shield, Bell, MapPin, Users, Zap } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5" style={{ backgroundColor: "var(--navy)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "var(--bus-yellow)" }}>
            <Bus size={20} color="#0F2B5B" />
          </div>
          <span className="text-white font-bold text-xl tracking-tight">SafeRoute</span>
        </div>
        <nav className="flex gap-2">
          <Link href="/login" className="px-4 py-2 text-sm font-medium rounded-lg text-white/70 hover:text-white transition-colors">Sign in</Link>
          <Link href="/login" className="px-4 py-2 text-sm font-semibold rounded-lg" style={{ backgroundColor: "var(--bus-yellow)", color: "var(--navy)" }}>
            Get started
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center" style={{ backgroundColor: "var(--navy)" }}>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6"
          style={{ backgroundColor: "rgba(245,166,35,0.15)", color: "var(--bus-yellow)", border: "1px solid rgba(245,166,35,0.3)" }}>
          <Zap size={14} />
          Real-time GPS tracking via WebSocket
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-6 leading-tight max-w-3xl">
          Know where your child's bus is — <span style={{ color: "var(--bus-yellow)" }}>always.</span>
        </h1>
        
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/login?role=parent" className="px-8 py-4 rounded-xl font-semibold text-base transition-transform hover:scale-105"
            style={{ backgroundColor: "var(--bus-yellow)", color: "var(--navy)" }}>
            I am a Parent
          </Link>
          <Link href="/login?role=admin" className="px-8 py-4 rounded-xl font-semibold text-base border transition-colors hover:bg-white/10"
            style={{ borderColor: "rgba(255,255,255,0.2)", color: "white" }}>
            School Administrator
          </Link>
          <Link href="/login?role=driver" className="px-8 py-4 rounded-xl font-semibold text-base border transition-colors hover:bg-white/10"
            style={{ borderColor: "rgba(255,255,255,0.2)", color: "white" }}>
            I'm a Driver
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20" style={{ backgroundColor: "var(--surface)" }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-3" style={{ color: "var(--text-primary)" }}>
            Everything your school needs
          </h2>
          <p className="text-center mb-12" style={{ color: "var(--text-secondary)" }}>
            Three tailored dashboards. One unified platform.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <MapPin size={22} />,
                title: "Live Bus Tracking",
                desc: "Parents see the bus move on an interactive Leaflet.js map, updated every few seconds via Socket.io.",
                color: "var(--teal)"
              },
              {
                icon: <Bell size={22} />,
                title: "Proximity Alerts",
                desc: "Push notifications fire when the bus enters the geofence around your child's stop — no more waiting outside.",
                color: "var(--bus-yellow)"
              },
              {
                icon: <Shield size={22} />,
                title: "Emergency Alerts",
                desc: "Drivers send instant emergency notifications to administrators with one tap, bypassing slow phone calls.",
                color: "var(--danger)"
              },
              {
                icon: <Users size={22} />,
                title: "Role-Based Access",
                desc: "Parents, administrators, and drivers each see a dashboard built specifically for their needs.",
                color: "var(--navy)"
              },
              {
                icon: <Bus size={22} />,
                title: "Fleet Management",
                desc: "Administrators manage routes, stops, drivers, and student assignments from one place.",
                color: "var(--teal)"
              },
              {
                icon: <Zap size={22} />,
                title: "Boarding Records",
                desc: "Drivers log student boarding events digitally — creating an auditable history for every trip.",
                color: "var(--bus-yellow)"
              }
            ].map((f) => (
              <div key={f.title} className="rounded-2xl p-6 bg-white border" style={{ borderColor: "var(--border)" }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: `color-mix(in srgb, ${f.color} 12%, transparent)`, color: f.color }}>
                  {f.icon}
                </div>
                <h3 className="font-semibold text-base mb-2" style={{ color: "var(--text-primary)" }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-6 text-sm" style={{ color: "var(--slate)", borderTop: "1px solid var(--border)" }}>
        SafeRoute — Brandon & Joshua, MUST 2026
      </footer>
    </main>
  );
}
