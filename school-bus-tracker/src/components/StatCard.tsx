import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  sub?: string;
}

export default function StatCard({ label, value, icon: Icon, color, sub }: StatCardProps) {
  return (
    <div className="rounded-2xl p-5 border" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{label}</p>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
          <Icon size={17} />
        </div>
      </div>
      <p className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: "var(--slate)" }}>{sub}</p>}
    </div>
  );
}
