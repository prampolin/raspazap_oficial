"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { profileNeedsCompletion } from "@/lib/auth/profile-completion";
import type { Tables } from "@/integrations/supabase/types";

export function RequireCompleteProfile({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setChecking(false);
      setAllowed(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("business_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const row = data as Pick<Tables<"profiles">, "business_name"> | null;
      if (profileNeedsCompletion(row)) {
        router.replace(`/completar-cadastro?next=${encodeURIComponent(pathname)}`);
        setChecking(false);
        return;
      }
      setAllowed(true);
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, router, pathname]);

  if (authLoading || (user && checking)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="animate-pulse text-muted-foreground text-sm">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return <>{children}</>;
  }

  if (!allowed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="animate-pulse text-muted-foreground text-sm">Redirecionando...</div>
      </div>
    );
  }

  return <>{children}</>;
}
