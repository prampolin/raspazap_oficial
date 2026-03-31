import type { ReactNode } from "react";
import { RequireCompleteProfile } from "@/components/RequireCompleteProfile";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <RequireCompleteProfile>{children}</RequireCompleteProfile>;
}
