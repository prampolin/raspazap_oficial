"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SIGN_OUT_SESSION_KEY, useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Check,
  Crown,
  Plus,
  LogOut,
  Gift,
  Users,
  Copy,
  ExternalLink,
  CreditCard,
  Shield,
  Power,
  PowerOff,
  TicketCheck,
  ClipboardPaste,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { maxCampaignsForPlan, planLimit, PLAN_LABELS, PLAN_LIMITS, type PlanId } from "@/lib/plans";

type Campaign = Tables<"campaigns">;

function formatPhoneBRDisplay(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  const ddd = d.slice(0, 2);
  if (d.length <= 2) return `(${ddd}`;
  const rest = d.slice(2);
  if (rest[0] === "9") {
    if (rest.length <= 5) return `(${ddd}) ${rest}`;
    return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  }
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
}

type CodeValidationResult =
  | null
  | { status: "not_found" }
  | {
      status: "valid" | "expired" | "already_redeemed";
      customerName: string;
      phoneDisplay: string;
      prizeName: string;
      campaignTitle: string;
      validUntil: Date;
      campaignInactive: boolean;
    };

export default function Dashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [entryCounts, setEntryCounts] = useState<Record<string, number>>({});
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [monthlyUsage, setMonthlyUsage] = useState(0);
  const [showAdminLink, setShowAdminLink] = useState(false);
  const [campaignUpgradeOpen, setCampaignUpgradeOpen] = useState(false);
  const [togglingCampaignId, setTogglingCampaignId] = useState<string | null>(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const planHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [validationCode, setValidationCode] = useState("");
  const [validationLoading, setValidationLoading] = useState(false);
  const [validationResult, setValidationResult] = useState<CodeValidationResult>(null);
  const validationLockRef = useRef(false);

  const clearPlanHoverTimer = () => {
    if (planHoverTimer.current) {
      clearTimeout(planHoverTimer.current);
      planHoverTimer.current = null;
    }
  };

  const scheduleOpenPlanModal = () => {
    clearPlanHoverTimer();
    planHoverTimer.current = setTimeout(() => {
      setPlanModalOpen(true);
      planHoverTimer.current = null;
    }, 400);
  };

  useEffect(() => {
    if (!authLoading && !user) {
      try {
        if (sessionStorage.getItem(SIGN_OUT_SESSION_KEY)) return;
      } catch {
        /* ignore */
      }
      router.replace("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (planModalOpen) clearPlanHoverTimer();
  }, [planModalOpen]);

  useEffect(() => () => clearPlanHoverTimer(), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      toast.success("Pagamento recebido. Seu plano será atualizado em instantes.");
      window.history.replaceState({}, "", "/dashboard");
    }
    if (params.get("checkout") === "canceled") {
      toast.message("Checkout cancelado.");
      window.history.replaceState({}, "", "/dashboard");
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch("/api/admin/check", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { admin?: boolean }) => setShowAdminLink(Boolean(d.admin)))
      .catch(() => setShowAdminLink(false));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      setProfile(profileRow as Tables<"profiles"> | null);

      const { data: usage } = await supabase.rpc("get_my_monthly_scratch_usage");
      setMonthlyUsage(typeof usage === "number" ? usage : 0);

      const { data } = await supabase
        .from("campaigns")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      const rows = (data || []) as Campaign[];
      setCampaigns(rows);

      if (rows.length > 0) {
        const counts: Record<string, number> = {};
        for (const c of rows) {
          const { count } = await supabase
            .from("scratch_entries")
            .select("*", { count: "exact", head: true })
            .eq("campaign_id", c.id);
          counts[c.id] = count || 0;
        }
        setEntryCounts(counts);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const startCheckout = async (plan: "basic") => {
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erro ao iniciar checkout");
      if (data.url) window.location.href = data.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao iniciar checkout");
    }
  };

  const openBillingPortal = async () => {
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erro ao abrir portal");
      if (data.url) window.location.href = data.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao abrir portal");
    }
  };

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/c/${slug}`);
    toast.success("Link copiado!");
  };

  const toggleCampaignActive = async (c: Campaign, next: boolean) => {
    if (!user) return;
    setTogglingCampaignId(c.id);
    const { error } = await supabase
      .from("campaigns")
      .update({ is_active: next })
      .eq("id", c.id)
      .eq("user_id", user.id);
    setTogglingCampaignId(null);
    if (error) {
      toast.error(error.message ?? "Não foi possível atualizar a campanha.");
      return;
    }
    setCampaigns((prev) => prev.map((x) => (x.id === c.id ? { ...x, is_active: next } : x)));
    toast.success(next ? "Campanha reativada." : "Campanha desativada.");
  };

  const handleValidatePrizeCode = async (codeOverride?: string) => {
    const normalized = (codeOverride ?? validationCode).trim().toUpperCase().replace(/\s/g, "");
    if (!normalized) {
      toast.error("Digite o código de validação.");
      return;
    }
    if (validationLockRef.current) return;
    validationLockRef.current = true;
    setValidationLoading(true);
    setValidationResult(null);
    try {
      const { data, error } = await supabase
        .from("scratch_entries")
        .select(
          `
          id,
          redeemed,
          customer_name,
          customer_whatsapp,
          scratched_at,
          campaigns ( validity_days, title, is_active ),
          prizes ( name )
        `,
        )
        .eq("validation_code", normalized)
        .maybeSingle();
      if (error) {
        toast.error(error.message);
        return;
      }
      if (!data) {
        setValidationResult({ status: "not_found" });
        return;
      }
      const camp = data.campaigns as { validity_days: number; title: string; is_active: boolean } | null;
      const prizeRow = data.prizes as { name: string } | null;
      if (!camp || !prizeRow) {
        setValidationResult({ status: "not_found" });
        return;
      }
      const phoneDisplay = formatPhoneBRDisplay(data.customer_whatsapp);
      const scratched = new Date(data.scratched_at);
      const validUntil = addDays(scratched, camp.validity_days);
      const expired = Date.now() > validUntil.getTime();
      const base = {
        customerName: data.customer_name,
        phoneDisplay,
        prizeName: prizeRow.name,
        campaignTitle: camp.title,
        validUntil,
        campaignInactive: !camp.is_active,
      };

      if (data.redeemed) {
        setValidationResult({ status: "already_redeemed", ...base });
        return;
      }
      if (expired) {
        setValidationResult({ status: "expired", ...base });
        return;
      }

      const { data: redeemJson, error: redeemErr } = await supabase.rpc("mark_scratch_entry_redeemed", {
        p_validation_code: normalized,
      });

      if (redeemErr) {
        toast.error(redeemErr.message);
        return;
      }

      const redeem = redeemJson as { ok?: boolean; reason?: string } | null;
      if (!redeem || typeof redeem.ok !== "boolean") {
        toast.error("Não foi possível registrar o resgate. Tente novamente.");
        return;
      }

      if (!redeem.ok) {
        if (redeem.reason === "not_authenticated") {
          toast.error("Sessão expirada. Faça login novamente.");
          return;
        }
        if (redeem.reason === "not_found") {
          setValidationResult({ status: "not_found" });
          return;
        }
        setValidationResult({ status: "already_redeemed", ...base });
        if (redeem.reason === "concurrent") {
          toast.message("Este código já foi registrado em outra conferência.");
        }
        return;
      }

      setValidationResult({ status: "valid", ...base });
      toast.success("Código registrado como utilizado — cada código só vale uma vez.");
    } finally {
      validationLockRef.current = false;
      setValidationLoading(false);
    }
  };

  const planId = (profile?.subscription_plan ?? "free") as PlanId;
  const planLabel = PLAN_LABELS[planId] ?? planId;
  const scratchLimit = planLimit(planId);
  const usagePercent = scratchLimit > 0 ? Math.min(100, (monthlyUsage / scratchLimit) * 100) : 0;
  const hasStripeCustomer = Boolean(profile?.stripe_customer_id);
  const campaignCap = maxCampaignsForPlan(profile?.subscription_plan);
  const atCampaignLimit =
    campaignCap !== null && campaigns.length >= campaignCap;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-card">
        <div className="container flex items-center justify-between h-16 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/dashboard" className="font-display shrink-0">
              <Logo />
            </Link>
            {showAdminLink && (
              <Button variant="outline" size="sm" className="shrink-0" asChild>
                <Link href="/admin">
                  <Shield className="w-4 h-4 mr-1" />
                  Admin
                </Link>
              </Button>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 dark:text-amber-400 dark:hover:text-amber-300"
                  aria-label="Plano e uso de raspadinhas"
                  onClick={() => {
                    clearPlanHoverTimer();
                    setPlanModalOpen(true);
                  }}
                  onPointerEnter={scheduleOpenPlanModal}
                  onPointerLeave={clearPlanHoverTimer}
                >
                  <Crown className="h-5 w-5" strokeWidth={1.75} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px]">
                Plano e raspadinhas do mês — clique ou passe o mouse para abrir
              </TooltipContent>
            </Tooltip>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-1" />
              Sair
            </Button>
          </div>
        </div>
      </nav>

      <Dialog open={planModalOpen} onOpenChange={setPlanModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Plano e uso</DialogTitle>
            <DialogDescription className="sr-only">
              Limite mensal de raspadinhas e opções da sua assinatura
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Plano {planLabel}</p>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  Raspadinhas neste mês (todas as campanhas):{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    {monthlyUsage.toLocaleString("pt-BR")} / {scratchLimit.toLocaleString("pt-BR")}
                  </span>
                </p>
              </div>
            </div>
            <Progress value={usagePercent} className="h-2" />
            <div className="flex flex-wrap gap-2">
              {planId === "free" && (
                <Button size="sm" variant="outline" type="button" onClick={() => startCheckout("basic")}>
                  Assinar Básico
                </Button>
              )}
              {planId === "basic" && (
                <>
                  {hasStripeCustomer && (
                    <Button size="sm" variant="outline" type="button" onClick={openBillingPortal}>
                      Gerenciar assinatura
                    </Button>
                  )}
                </>
              )}
              {planId === "pro" && hasStripeCustomer && (
                <Button size="sm" variant="outline" type="button" onClick={openBillingPortal}>
                  Gerenciar assinatura
                </Button>
              )}
            </div>
            {profile?.subscription_status === "past_due" && (
              <p className="text-xs text-destructive">
                Pagamento em atraso. Use &quot;Gerenciar assinatura&quot; para regularizar.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="container py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Minhas Campanhas</h1>
            <p className="text-sm text-muted-foreground mt-1">Gerencie suas raspadinhas premiadas.</p>
          </div>
          {atCampaignLimit ? (
            <Button
              type="button"
              onClick={() => setCampaignUpgradeOpen(true)}
              title="No plano grátis você pode ter apenas 1 campanha. Faça upgrade para criar mais."
            >
              <Plus className="w-4 h-4 mr-1" />
              Criar campanha
            </Button>
          ) : (
            <Button asChild>
              <Link href="/dashboard/new">
                <Plus className="w-4 h-4 mr-1" />
                Criar campanha
              </Link>
            </Button>
          )}
        </div>

        <div className="bg-card rounded-xl p-5 card-elevated mb-8 border border-border/60">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <TicketCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-foreground">Conferir código no caixa</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Cole o código aqui.</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="relative flex-1">
              <Input
                id="validation-code"
                value={validationCode}
                onChange={(e) => {
                  setValidationCode(e.target.value);
                  setValidationResult(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleValidatePrizeCode();
                }}
                placeholder="A1B2C3"
                autoComplete="off"
                className="font-mono uppercase pe-10"
                aria-label="Código de validação"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0.5 top-1/2 h-9 w-9 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Colar código da área de transferência"
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    const normalized = text.trim().toUpperCase().replace(/\s/g, "");
                    setValidationCode(normalized);
                    setValidationResult(null);
                    await handleValidatePrizeCode(normalized);
                  } catch {
                    toast.error("Não foi possível colar. Permita o acesso à área de transferência ou digite o código.");
                  }
                }}
              >
                <ClipboardPaste className="h-4 w-4" />
              </Button>
            </div>
            <Button type="button" onClick={() => void handleValidatePrizeCode()} disabled={validationLoading}>
              {validationLoading ? "Conferindo..." : "Conferir"}
            </Button>
          </div>

          {validationResult?.status === "not_found" && (
            <p className="text-sm text-destructive mt-4 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3">
              Código não encontrado nas suas campanhas ou inválido.
            </p>
          )}

          {validationResult && validationResult.status !== "not_found" && (
            <div
              className={cn(
                "mt-4 rounded-lg border px-4 py-4 space-y-3",
                validationResult.status === "valid" && "bg-primary/5 border-primary/20",
                validationResult.status === "expired" && "bg-amber-500/5 border-amber-500/25",
                validationResult.status === "already_redeemed" && "bg-muted/50 border-muted-foreground/30",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full",
                    validationResult.status === "valid" && "bg-primary/15 text-primary",
                    validationResult.status === "expired" && "bg-amber-500/15 text-amber-800 dark:text-amber-200",
                    validationResult.status === "already_redeemed" &&
                      "bg-muted-foreground/20 text-muted-foreground",
                  )}
                >
                  {validationResult.status === "valid" && "Prêmio válido no prazo"}
                  {validationResult.status === "expired" && "Fora do prazo de validade"}
                  {validationResult.status === "already_redeemed" && "Código já utilizado"}
                </span>
                {validationResult.campaignInactive && validationResult.status !== "already_redeemed" && (
                  <span className="text-xs font-medium text-muted-foreground">Campanha desativada no painel</span>
                )}
              </div>
              <dl className="grid gap-2 text-sm">
                <div className="flex flex-col sm:flex-row sm:gap-2">
                  <dt className="text-muted-foreground shrink-0 sm:w-28">Nome</dt>
                  <dd className="font-medium text-foreground">{validationResult.customerName}</dd>
                </div>
                <div className="flex flex-col sm:flex-row sm:gap-2">
                  <dt className="text-muted-foreground shrink-0 sm:w-28">WhatsApp</dt>
                  <dd className="font-medium text-foreground tabular-nums">{validationResult.phoneDisplay}</dd>
                </div>
                <div className="flex flex-col sm:flex-row sm:gap-2">
                  <dt className="text-muted-foreground shrink-0 sm:w-28">Ganhou</dt>
                  <dd className="font-medium text-foreground">{validationResult.prizeName}</dd>
                </div>
                <div className="flex flex-col sm:flex-row sm:gap-2">
                  <dt className="text-muted-foreground shrink-0 sm:w-28">Campanha</dt>
                  <dd className="text-foreground">{validationResult.campaignTitle}</dd>
                </div>
                <div className="flex flex-col sm:flex-row sm:gap-2 pt-1 border-t border-border/50">
                  <dt className="text-muted-foreground shrink-0 sm:w-28">
                    {validationResult.status === "valid" && "Válido até"}
                    {validationResult.status === "expired" && "Prazo encerrou em"}
                    {validationResult.status === "already_redeemed" && "Era válido até"}
                  </dt>
                  <dd className="text-foreground tabular-nums">
                    {format(validationResult.validUntil, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </dd>
                </div>
              </dl>
              {validationResult.status === "expired" && (
                <p className="text-xs text-amber-800 dark:text-amber-200/90 pt-1">
                  O código existe, mas a validade configurada na campanha ({validationResult.campaignTitle}) já expirou.
                </p>
              )}
              {validationResult.status === "already_redeemed" && (
                <p className="text-xs text-muted-foreground pt-1">
                  Este código já foi conferido e registrado no caixa. Não é possível validar o mesmo prêmio duas vezes.
                </p>
              )}
            </div>
          )}
        </div>

        <Dialog open={campaignUpgradeOpen} onOpenChange={setCampaignUpgradeOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-xl pr-8">Crie mais campanhas</DialogTitle>
              <DialogDescription>
                No plano Grátis você pode ter apenas <strong>1 campanha</strong>. Assine o Básico para criar campanhas
                ilimitadas e aumentar o limite mensal de raspadinhas.
              </DialogDescription>
            </DialogHeader>
            <div className="grid pt-2 max-w-md mx-auto w-full">
              <div className="rounded-xl border border-border bg-card p-5 flex flex-col text-center">
                <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-3 mx-auto">
                  {PLAN_LABELS.basic}
                </div>
                <div className="mb-3">
                  <span className="font-display text-3xl font-bold text-foreground">R$ 49</span>
                  <span className="text-lg text-muted-foreground">,90</span>
                  <span className="text-muted-foreground text-sm">/mês</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Até {PLAN_LIMITS.basic.toLocaleString("pt-BR")} raspadinhas/mês — campanhas ilimitadas.
                </p>
                <ul className="text-xs text-left space-y-2 mb-5 flex-1 text-foreground">
                  {["Campanhas ilimitadas", "Tudo do plano Grátis", "Limite ampliado de raspadinhas"].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Check className="h-3 w-3 text-primary" />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <Button type="button" className="w-full" onClick={() => void startCheckout("basic")}>
                  Assinar Básico na Stripe
                </Button>
              </div>
              {/* Plano PRO temporariamente oculto — copie o card do Index ou histórico git ao reativar. */}
            </div>
          </DialogContent>
        </Dialog>

        {campaigns.length === 0 ? (
          <div className="bg-card rounded-xl p-12 card-elevated text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Gift className="w-7 h-7 text-primary" />
            </div>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">Nenhuma campanha ainda</h2>
            <p className="text-sm text-muted-foreground mb-6">Crie sua primeira raspadinha premiada e comece a fidelizar clientes!</p>
            <Button asChild>
              <Link href="/dashboard/new">
                <Plus className="w-4 h-4 mr-1" />
                Criar campanha
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {campaigns.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "relative rounded-xl p-5 transition-all duration-300 border",
                  c.is_active
                    ? "bg-card card-elevated hover:card-elevated-hover border-transparent shadow-sm"
                    : "border-dashed border-muted-foreground/40 bg-muted/35 shadow-none ring-1 ring-muted-foreground/10",
                )}
              >
                {!c.is_active && (
                  <div
                    className="pointer-events-none absolute inset-0 rounded-xl bg-[repeating-linear-gradient(-45deg,transparent,transparent_8px,hsl(var(--muted-foreground)_/_0.07)_8px,hsl(var(--muted-foreground)_/_0.07)_16px)]"
                    aria-hidden
                  />
                )}
                <div className={cn("relative flex items-start justify-between", !c.is_active && "opacity-[0.92]")}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3
                        className={cn(
                          "font-display text-lg font-semibold truncate",
                          c.is_active ? "text-foreground" : "text-foreground/75",
                        )}
                      >
                        {c.title}
                      </h3>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium shrink-0",
                          c.is_active ? "bg-primary/10 text-primary" : "bg-muted-foreground/15 text-muted-foreground",
                        )}
                      >
                        {c.is_active ? "Ativa" : "Inativa"}
                      </span>
                    </div>
                    {c.description && (
                      <p
                        className={cn(
                          "text-sm mb-3 truncate",
                          c.is_active ? "text-muted-foreground" : "text-muted-foreground/80",
                        )}
                      >
                        {c.description}
                      </p>
                    )}
                    <div
                      className={cn(
                        "flex items-center gap-4 text-sm",
                        c.is_active ? "text-muted-foreground" : "text-muted-foreground/75",
                      )}
                    >
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {entryCounts[c.id] || 0} leads
                      </span>
                      <span>Mín. R$ {Number(c.min_purchase).toFixed(2)}</span>
                      <span>{c.validity_days} dias</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 ml-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0 rounded-lg"
                          aria-label="Mais ações da campanha"
                        >
                          <span className="inline-flex h-5 w-5 items-center justify-center text-muted-foreground">
                            ···
                          </span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            void router.push(`/dashboard/campaign/${c.id}`);
                          }}
                        >
                          Editar campanha
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            copyLink(c.slug);
                          }}
                        >
                          Copiar link
                        </DropdownMenuItem>
                        {c.is_active ? (
                          <DropdownMenuItem
                            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                            disabled={togglingCampaignId === c.id}
                            onClick={() => void toggleCampaignActive(c, false)}
                          >
                            Desativar campanha
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            disabled={togglingCampaignId === c.id}
                            onClick={() => void toggleCampaignActive(c, true)}
                          >
                            Reativar campanha
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
