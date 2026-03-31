import type { ReactNode } from "react";
import { RequireCompleteProfile } from "@/components/RequireCompleteProfile";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <RequireCompleteProfile>{children}</RequireCompleteProfile>;
}
