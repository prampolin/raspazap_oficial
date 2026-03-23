"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SIGN_OUT_SESSION_KEY, useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  BarChart3,
  LayoutDashboard,
  LogOut,
  Shield,
  Star,
  Users,
  Megaphone,
  UserCircle,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { PLAN_LABELS, type PlanId } from "@/lib/plans";

type OverviewPayload = {
  generatedAt: string;
  counts: {
    authUsers: number;
    profiles: number;
    campaigns: number;
    campaignsActive: number;
    scratchEntries: number;
    prizes: number;
  };
  planByCount: Record<string, number>;
  users: Array<{
    id: string;
    email: string | null;
    createdAt: string;
    lastSignInAt: string | null;
    businessName: string | null;
    subscriptionPlan: string;
    subscriptionStatus: string | null;
    stripeCustomerId: string | null;
  }>;
  campaigns: Array<{
    id: string;
    userId: string;
    title: string;
    slug: string;
    isActive: boolean;
    createdAt: string;
    minPurchase: number;
    validityDays: number;
    entryCount: number;
    ownerEmail: string | null;
    ownerBusinessName: string | null;
    ownerPlan: string;
  }>;
  recentEntries: Array<{
    id: string;
    scratchedAt: string;
    customerName: string;
    customerWhatsapp: string;
    campaignTitle: string;
    prizeName: string;
    redeemed: boolean;
    validationCode: string;
  }>;
};

function planBadge(plan: string) {
  const p = (plan ?? "free") as PlanId;
  const label = PLAN_LABELS[p] ?? plan;
  return <Badge variant={p === "pro" ? "default" : "secondary"}>{label}</Badge>;
}

function fmtDt(iso: string | null) {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return iso;
  }
}

export default function AdminDashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<OverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [legalDraft, setLegalDraft] = useState<{
    terms: string;
    privacy: string;
    updatedAt: string | null;
  } | null>(null);
  const [legalSaving, setLegalSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      try {
        if (sessionStorage.getItem(SIGN_OUT_SESSION_KEY)) return;
      } catch {
        /* ignore */
      }
      router.replace("/login?redirect=/admin");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      setForbidden(false);
      setServerError(null);
      const res = await fetch("/api/admin/overview", { credentials: "include" });
      const json = (await res.json()) as OverviewPayload & { error?: string };
      if (res.status === 403) {
        setForbidden(true);
        setLoading(false);
        return;
      }
      if (res.status === 503) {
        setServerError(json.error ?? "Serviço indisponível");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        toast.error(json.error ?? "Erro ao carregar");
        setLoading(false);
        return;
      }
      setData(json as OverviewPayload);

      const legalRes = await fetch("/api/admin/legal", { credentials: "include" });
      if (legalRes.ok) {
        const lj = (await legalRes.json()) as {
          terms_of_use: string;
          privacy_policy: string;
          updated_at: string | null;
        };
        setLegalDraft({
          terms: lj.terms_of_use ?? "",
          privacy: lj.privacy_policy ?? "",
          updatedAt: lj.updated_at ?? null,
        });
      }

      setLoading(false);
    };
    load();
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando painel admin...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (forbidden) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Shield className="w-12 h-12 text-muted-foreground mb-4" />
        <h1 className="font-display text-xl font-semibold text-foreground mb-2">Acesso restrito</h1>
        <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
          Seu e-mail não está em ADMIN_EMAILS ou o painel admin ainda não foi configurado.
        </p>
        <Button asChild variant="outline">
          <Link href="/dashboard">Voltar ao painel</Link>
        </Button>
      </div>
    );
  }

  if (serverError) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <p className="text-destructive text-sm mb-4 text-center max-w-md">{serverError}</p>
        <Button asChild variant="outline">
          <Link href="/dashboard">Voltar</Link>
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Sem dados.</p>
      </div>
    );
  }

  const { counts, planByCount, users, campaigns, recentEntries } = data;

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-card">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
              Painel
            </Link>
            <div className="h-4 w-px bg-border" />
            <div className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-hero flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              Admin
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => signOut()}>
            <LogOut className="w-4 h-4 mr-1" />
            Sair
          </Button>
        </div>
      </nav>

      <div className="container py-8">
        <div className="mb-8">
          <h1 className="font-display text-2xl font-bold text-foreground">Visão geral do sistema</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Dados agregados em tempo real · Atualizado em {fmtDt(data.generatedAt)}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <div className="bg-card rounded-xl p-5 card-elevated">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-2">
              <UserCircle className="w-4 h-4" />
              Usuários (auth)
            </div>
            <p className="font-display text-3xl font-bold text-foreground">{counts.authUsers}</p>
            <p className="text-xs text-muted-foreground mt-1">Perfis: {counts.profiles}</p>
          </div>
          <div className="bg-card rounded-xl p-5 card-elevated">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-2">
              <Megaphone className="w-4 h-4" />
              Campanhas
            </div>
            <p className="font-display text-3xl font-bold text-foreground">{counts.campaigns}</p>
            <p className="text-xs text-muted-foreground mt-1">Ativas: {counts.campaignsActive}</p>
          </div>
          <div className="bg-card rounded-xl p-5 card-elevated">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-2">
              <Users className="w-4 h-4" />
              Raspadinhas (leads)
            </div>
            <p className="font-display text-3xl font-bold text-foreground">{counts.scratchEntries}</p>
            <p className="text-xs text-muted-foreground mt-1">Prêmios cadastrados: {counts.prizes}</p>
          </div>
          <div className="bg-card rounded-xl p-5 card-elevated">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-2">
              <BarChart3 className="w-4 h-4" />
              Planos
            </div>
            <div className="flex flex-wrap gap-2 mt-1">
              {Object.entries(planByCount).map(([k, v]) => (
                <span key={k} className="text-sm text-foreground">
                  {PLAN_LABELS[k as PlanId] ?? k}: <strong>{v}</strong>
                </span>
              ))}
            </div>
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full max-w-3xl grid-cols-2 sm:grid-cols-5 h-auto gap-1">
            <TabsTrigger value="overview" className="gap-1">
              <LayoutDashboard className="w-3.5 h-3.5" />
              Resumo
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-1">
              <Users className="w-3.5 h-3.5" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="gap-1">
              <Star className="w-3.5 h-3.5" />
              Campanhas
            </TabsTrigger>
            <TabsTrigger value="leads" className="gap-1">
              Leads
            </TabsTrigger>
            <TabsTrigger value="legal" className="gap-1 col-span-2 sm:col-span-1">
              <FileText className="w-3.5 h-3.5" />
              Conteúdo do site
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="bg-card rounded-xl p-6 card-elevated">
              <h2 className="font-display text-lg font-semibold mb-4">Últimas raspadinhas</h2>
              <div className="rounded-md border overflow-x-auto max-h-[420px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Campanha</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead>Prêmio</TableHead>
                      <TableHead>Resgate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentEntries.slice(0, 20).map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="whitespace-nowrap text-xs">{fmtDt(e.scratchedAt)}</TableCell>
                        <TableCell className="max-w-[140px] truncate">{e.campaignTitle}</TableCell>
                        <TableCell>{e.customerName}</TableCell>
                        <TableCell className="font-mono text-xs">{e.customerWhatsapp}</TableCell>
                        <TableCell>{e.prizeName}</TableCell>
                        <TableCell>{e.redeemed ? "Sim" : "Não"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            <div className="bg-card rounded-xl p-6 card-elevated">
              <h2 className="font-display text-lg font-semibold mb-4">Todos os usuários</h2>
              <div className="rounded-md border overflow-x-auto max-h-[560px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Negócio</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Assinatura</TableHead>
                      <TableHead>Stripe</TableHead>
                      <TableHead>Cadastro</TableHead>
                      <TableHead>Último login</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="max-w-[200px] truncate text-xs">{u.email ?? "—"}</TableCell>
                        <TableCell className="max-w-[140px] truncate">{u.businessName ?? "—"}</TableCell>
                        <TableCell>{planBadge(u.subscriptionPlan)}</TableCell>
                        <TableCell className="text-xs">{u.subscriptionStatus ?? "—"}</TableCell>
                        <TableCell className="text-xs">{u.stripeCustomerId ? "Sim" : "—"}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{fmtDt(u.createdAt)}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{fmtDt(u.lastSignInAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="campaigns" className="mt-6">
            <div className="bg-card rounded-xl p-6 card-elevated">
              <h2 className="font-display text-lg font-semibold mb-4">Todas as campanhas</h2>
              <div className="rounded-md border overflow-x-auto max-h-[560px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Dono</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Leads</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criada</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium max-w-[180px] truncate">{c.title}</TableCell>
                        <TableCell className="font-mono text-xs">{c.slug}</TableCell>
                        <TableCell className="max-w-[160px] truncate text-xs">
                          {c.ownerEmail ?? c.userId.slice(0, 8)}
                        </TableCell>
                        <TableCell>{planBadge(c.ownerPlan)}</TableCell>
                        <TableCell>{c.entryCount}</TableCell>
                        <TableCell>
                          <Badge variant={c.isActive ? "default" : "outline"}>
                            {c.isActive ? "Ativa" : "Inativa"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{fmtDt(c.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="leads" className="mt-6">
            <div className="bg-card rounded-xl p-6 card-elevated">
              <h2 className="font-display text-lg font-semibold mb-4">Últimos 100 leads (raspadinhas)</h2>
              <div className="rounded-md border overflow-x-auto max-h-[560px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Campanha</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead>Prêmio</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Resgatado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentEntries.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="whitespace-nowrap text-xs">{fmtDt(e.scratchedAt)}</TableCell>
                        <TableCell className="max-w-[160px] truncate">{e.campaignTitle}</TableCell>
                        <TableCell>{e.customerName}</TableCell>
                        <TableCell className="font-mono text-xs">{e.customerWhatsapp}</TableCell>
                        <TableCell>{e.prizeName}</TableCell>
                        <TableCell className="font-mono text-xs">{e.validationCode}</TableCell>
                        <TableCell>{e.redeemed ? "Sim" : "Não"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="legal" className="mt-6">
            <div className="bg-card rounded-xl p-6 card-elevated space-y-6 max-w-4xl">
              <div>
                <h2 className="font-display text-lg font-semibold text-foreground">Termos e privacidade (landing)</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Textos exibidos em{" "}
                  <Link href="/termos" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    /termos
                  </Link>{" "}
                  e{" "}
                  <Link href="/privacidade" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    /privacidade
                  </Link>
                  . Atualizado no painel: {legalDraft?.updatedAt ? fmtDt(legalDraft.updatedAt) : "—"}
                </p>
              </div>
              {legalDraft === null ? (
                <p className="text-sm text-muted-foreground">
                  Não foi possível carregar os textos (verifique SUPABASE_SERVICE_ROLE_KEY e se a tabela{" "}
                  <code className="text-xs bg-muted px-1 rounded">site_legal</code> existe).
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    <label htmlFor="admin-terms" className="text-sm font-medium text-foreground">
                      Termos de uso
                    </label>
                    <Textarea
                      id="admin-terms"
                      value={legalDraft.terms}
                      onChange={(e) => setLegalDraft((d) => (d ? { ...d, terms: e.target.value } : d))}
                      className="min-h-[200px] font-mono text-sm"
                      placeholder="Termos de uso..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="admin-privacy" className="text-sm font-medium text-foreground">
                      Política de privacidade
                    </label>
                    <Textarea
                      id="admin-privacy"
                      value={legalDraft.privacy}
                      onChange={(e) => setLegalDraft((d) => (d ? { ...d, privacy: e.target.value } : d))}
                      className="min-h-[200px] font-mono text-sm"
                      placeholder="Política de privacidade..."
                    />
                  </div>
                  <Button
                    type="button"
                    disabled={legalSaving}
                    onClick={async () => {
                      if (!legalDraft) return;
                      setLegalSaving(true);
                      try {
                        const res = await fetch("/api/admin/legal", {
                          method: "PUT",
                          credentials: "include",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            terms_of_use: legalDraft.terms,
                            privacy_policy: legalDraft.privacy,
                          }),
                        });
                        const json = (await res.json()) as {
                          error?: string;
                          terms_of_use?: string;
                          privacy_policy?: string;
                          updated_at?: string | null;
                        };
                        if (!res.ok) {
                          toast.error(json.error ?? "Erro ao salvar");
                          return;
                        }
                        setLegalDraft({
                          terms: json.terms_of_use ?? legalDraft.terms,
                          privacy: json.privacy_policy ?? legalDraft.privacy,
                          updatedAt: json.updated_at ?? null,
                        });
                        toast.success("Textos legais salvos.");
                      } finally {
                        setLegalSaving(false);
                      }
                    }}
                  >
                    {legalSaving ? "Salvando..." : "Salvar textos"}
                  </Button>
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
