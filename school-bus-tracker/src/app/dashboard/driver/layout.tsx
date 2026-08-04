import RequireRole from "@/components/RequireRole";

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return <RequireRole role="driver">{children}</RequireRole>;
}
