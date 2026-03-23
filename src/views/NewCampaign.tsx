"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, Trash2, Lock } from "lucide-react";
import { toast } from "sonner";
import type { Database, Tables } from "@/integrations/supabase/types";
import { maxCampaignsForPlan, PLAN_LABELS, PLAN_LIMITS, type PlanId } from "@/lib/plans";

type CampaignInsert = Database["public"]["Tables"]["campaigns"]["Insert"];
type PrizeInsert = Database["public"]["Tables"]["prizes"]["Insert"];

interface PrizeInput {
  name: string;
  percentage: string;
}

export default function NewCampaign() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [minPurchase, setMinPurchase] = useState("50");
  const [validityDays, setValidityDays] = useState("7");
  const [prizes, setPrizes] = useState<PrizeInput[]>([
    { name: "Entrega grátis", percentage: "30" },
    { name: "Refri grátis", percentage: "70" },
  ]);
  const [loading, setLoading] = useState(false);
  const [planGate, setPlanGate] = useState<{
    profile: Tables<"profiles"> | null;
    campaignCount: number;
    ready: boolean;
  }>({ profile: null, campaignCount: 0, ready: false });

  useEffect(() => {
    if (!authLoading && !user) {
      toast.error("Faça login para criar uma campanha.");
      router.replace("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ data: profileRow }, { count }] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase
          .from("campaigns")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id),
      ]);
      setPlanGate({
        profile: profileRow as Tables<"profiles"> | null,
        campaignCount: count ?? 0,
        ready: true,
      });
    };
    load();
  }, [user]);

  const totalPercentage = prizes.reduce((sum, p) => sum + (parseInt(p.percentage) || 0), 0);

  const planId = (planGate.profile?.subscription_plan ?? "free") as PlanId;
  const isFreePlan = planId === "free";
  const cap = maxCampaignsForPlan(planGate.profile?.subscription_plan);

  useEffect(() => {
    if (isFreePlan) setValidityDays("7");
  }, [isFreePlan]);

  const addPrize = () => setPrizes([...prizes, { name: "", percentage: "" }]);
  const removePrize = (i: number) => setPrizes(prizes.filter((_, idx) => idx !== i));
  const updatePrize = (i: number, field: keyof PrizeInput, value: string) => {
    const updated = [...prizes];
    updated[i][field] = value;
    setPrizes(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Sessão inválida. Entre novamente.");
      router.push("/login");
      return;
    }

    if (totalPercentage !== 100) {
      toast.error("A soma dos prêmios deve ser exatamente 100%.");
      return;
    }

    if (prizes.some((p) => !p.name.trim())) {
      toast.error("Todos os prêmios devem ter um nome.");
      return;
    }

    setLoading(true);
    const slug = title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") + "-" + Math.random().toString(36).slice(2, 7);

    const payload: CampaignInsert = {
      user_id: user.id,
      title: title.trim(),
      description: description.trim() || null,
      min_purchase: parseFloat(minPurchase) || 0,
      validity_days: isFreePlan ? 7 : Math.max(1, parseInt(validityDays, 10) || 7),
      slug,
    };
    const { data: campaign, error } = await supabase
      .from("campaigns")
      .insert(payload)
      .select()
      .single();

    if (error || !campaign) {
      const msg = error?.message ?? "";
      if (msg.includes("FREE_PLAN_CAMPAIGN_LIMIT") || msg.includes("plano grátis permite apenas 1")) {
        toast.error("No plano grátis você pode ter apenas 1 campanha. Faça upgrade para criar mais.");
      } else {
        toast.error(msg || "Erro ao criar campanha.");
      }
      setLoading(false);
      return;
    }

    const prizesData: PrizeInsert[] = prizes.map((p) => ({
      campaign_id: campaign.id,
      name: p.name.trim(),
      percentage: parseInt(p.percentage),
    }));

    const { error: prizeError } = await supabase.from("prizes").insert(prizesData);
    setLoading(false);

    if (prizeError) {
      toast.error(prizeError.message ?? "Erro ao criar prêmios.");
      return;
    }

    toast.success("Campanha criada com sucesso!");
    router.push("/dashboard");
  };

  const blockedByPlan =
    planGate.ready && cap !== null && planGate.campaignCount >= cap;

  if (authLoading || !planGate.ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (blockedByPlan) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-lg py-8">
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Link>
          <div className="bg-card rounded-xl p-8 card-elevated text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Lock className="w-7 h-7 text-muted-foreground" />
            </div>
            <h1 className="font-display text-xl font-bold text-foreground mb-2">Limite do plano {PLAN_LABELS[planId]}</h1>
            <p className="text-sm text-muted-foreground mb-6">
              O plano grátis inclui <strong>1 campanha</strong>. Para criar outra, assine o Básico.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button asChild>
                <Link href="/dashboard">Ir ao painel</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-lg py-8">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Link>

        <h1 className="font-display text-2xl font-bold text-foreground mb-2">Nova Campanha</h1>
        <p className="text-sm text-muted-foreground mb-8">Configure sua raspadinha premiada.</p>

        {isFreePlan && (
          <div className="rounded-xl border border-border bg-muted/40 p-4 mb-6 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Plano Grátis</p>
            <ul className="list-disc pl-4 mt-2 space-y-1.5">
              <li>
                Validade da campanha: <strong className="text-foreground">7 dias</strong> (fixo — não é possível alterar).
              </li>
              <li>
                Limite de <strong className="text-foreground">{PLAN_LIMITS.free} raspadinhas por mês</strong> no total da
                conta (todas as campanhas somadas). Esse limite vem do plano e{" "}
                <strong className="text-foreground">não pode ser escolhido por campanha</strong>.
              </li>
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="title">Título da campanha</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Promoção de Aniversário" required className="mt-1.5" />
          </div>

          <div>
            <Label htmlFor="desc">Descrição curta (opcional)</Label>
            <Input id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Raspe e ganhe prêmios incríveis!" className="mt-1.5" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="min">Compra mínima (R$)</Label>
              <Input id="min" type="number" min="0" step="0.01" value={minPurchase} onChange={(e) => setMinPurchase(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor={isFreePlan ? undefined : "days"}>Validade (dias)</Label>
              {isFreePlan ? (
                <>
                  <Input
                    id="days"
                    type="number"
                    value={7}
                    disabled
                    className="mt-1.5 bg-muted"
                    aria-readonly
                  />
                  <p className="text-xs text-muted-foreground mt-1">Fixo em 7 dias no plano Grátis.</p>
                </>
              ) : (
                <Input
                  id="days"
                  type="number"
                  min="1"
                  value={validityDays}
                  onChange={(e) => setValidityDays(e.target.value)}
                  className="mt-1.5"
                />
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <Label>Prêmios</Label>
              <span className={`text-xs font-medium ${totalPercentage === 100 ? "text-primary" : "text-destructive"}`}>
                Total: {totalPercentage}%
              </span>
            </div>
            <div className="space-y-3">
              {prizes.map((p, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <Input
                    value={p.name}
                    onChange={(e) => updatePrize(i, "name", e.target.value)}
                    placeholder="Nome do prêmio"
                    className="flex-1"
                  />
                  <div className="w-20">
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={p.percentage}
                      onChange={(e) => updatePrize(i, "percentage", e.target.value)}
                      placeholder="%"
                    />
                  </div>
                  {prizes.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removePrize(i)} className="shrink-0">
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addPrize} className="mt-3">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Adicionar prêmio
            </Button>
          </div>

          <Button type="submit" className="w-full" disabled={loading || totalPercentage !== 100 || !user}>
            {loading ? "Criando..." : "Criar campanha"}
          </Button>
        </form>
      </div>
    </div>
  );
}
