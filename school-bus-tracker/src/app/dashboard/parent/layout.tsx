import RequireRole from "@/components/RequireRole";

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return <RequireRole role="parent">{children}</RequireRole>;
}
