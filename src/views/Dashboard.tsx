"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Star, LogOut, Gift, Users, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Campaign = Tables<"campaigns">;

export default function Dashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [entryCounts, setEntryCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("campaigns")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      const rows = (data || []) as Campaign[];
      setCampaigns(rows);

      // Get entry counts for each campaign
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

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/c/${slug}`);
    toast.success("Link copiado!");
  };

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
        <div className="container flex items-center justify-between h-16">
          <Link href="/dashboard" className="font-display text-lg font-bold text-foreground flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-hero flex items-center justify-center">
              <Star className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            RaspaZap
          </Link>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="w-4 h-4 mr-1" />
            Sair
          </Button>
        </div>
      </nav>

      <div className="container py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Minhas Campanhas</h1>
            <p className="text-sm text-muted-foreground mt-1">Gerencie suas raspadinhas premiadas.</p>
          </div>
          <Button asChild>
            <Link href="/dashboard/new">
              <Plus className="w-4 h-4 mr-1" />
              Nova Campanha
            </Link>
          </Button>
        </div>

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
              <div key={c.id} className="bg-card rounded-xl p-5 card-elevated hover:card-elevated-hover transition-shadow duration-300">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-display text-lg font-semibold text-foreground truncate">{c.title}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {c.is_active ? "Ativa" : "Inativa"}
                      </span>
                    </div>
                    {c.description && <p className="text-sm text-muted-foreground mb-3 truncate">{c.description}</p>}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {entryCounts[c.id] || 0} leads
                      </span>
                      <span>Mín. R$ {Number(c.min_purchase).toFixed(2)}</span>
                      <span>{c.validity_days} dias</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button variant="outline" size="sm" onClick={() => copyLink(c.slug)}>
                      <Copy className="w-3.5 h-3.5 mr-1" />
                      Link
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/dashboard/campaign/${c.id}`}>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </Button>
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
