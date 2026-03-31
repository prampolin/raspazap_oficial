"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { safeAuthRedirectPath } from "@/lib/auth/safe-redirect";
import { profileNeedsCompletion } from "@/lib/auth/profile-completion";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

function CompleteRegistrationInner() {
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(false);
  const [profileCheckDone, setProfileCheckDone] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeAuthRedirectPath(searchParams.get("next"), "/dashboard");
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent("/completar-cadastro")}`);
      return;
    }
    const meta = user.user_metadata as { business_name?: string } | undefined;
    const fromMeta = typeof meta?.business_name === "string" ? meta.business_name.trim() : "";
    if (fromMeta) {
      setBusinessName(fromMeta);
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
      if (!profileNeedsCompletion(row)) {
        router.replace(next);
        return;
      }
      setProfileCheckDone(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, router, next]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = businessName.trim();
    if (!name) {
      toast.error("Informe o nome do negócio.");
      return;
    }
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("profiles").update({ business_name: name }).eq("user_id", user.id);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Cadastro concluído!");
    router.replace(next);
  };

  if (authLoading || !user || !profileCheckDone) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 bg-emerald-500">
        <div className="w-full max-w-lg bg-white p-12 rounded-2xl">
          <div className="animate-pulse text-muted-foreground text-sm text-center">Carregando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 bg-emerald-500">
      <div className="w-full max-w-lg bg-white p-12 rounded-2xl">
        <div className="mb-8 font-display grid grid-cols-3 items-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Início
          </Link>
          <Logo />
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground mb-2">Complete seu cadastro</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Para continuar, precisamos do nome do seu negócio. Ele aparece nas suas campanhas.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="business-complete">Nome do negócio</Label>
            <Input
              id="business-complete"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Minha Loja"
              required
              autoComplete="organization"
              className="mt-1.5"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Salvando..." : "Concluir cadastro"}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function CompleteRegistration() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-emerald-500 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white p-12 rounded-2xl">
            <p className="text-sm text-muted-foreground text-center">Carregando...</p>
          </div>
        </div>
      }
    >
      <CompleteRegistrationInner />
    </Suspense>
  );
}
