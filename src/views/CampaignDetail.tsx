"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Copy, Users, Gift, QrCode } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type ScratchEntry = Tables<"scratch_entries"> & { prize_name?: string };

export default function CampaignDetail() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : undefined;
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<Tables<"campaigns"> | null>(null);
  const [prizes, setPrizes] = useState<Tables<"prizes">[]>([]);
  const [entries, setEntries] = useState<ScratchEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !user) return;
    const load = async () => {
      const [campRes, prizeRes, entryRes] = await Promise.all([
        supabase.from("campaigns").select("*").eq("id", id).single(),
        supabase.from("prizes").select("*").eq("campaign_id", id),
        supabase.from("scratch_entries").select("*").eq("campaign_id", id).order("scratched_at", { ascending: false }),
      ]);
      setCampaign(campRes.data);
      setPrizes(prizeRes.data || []);

      const prizesList = (prizeRes.data || []) as Tables<"prizes">[];
      const prizeMap = Object.fromEntries(prizesList.map((p) => [p.id, p.name]));
      const entriesRaw = (entryRes.data || []) as Tables<"scratch_entries">[];
      setEntries(
        entriesRaw.map((e) => ({ ...e, prize_name: prizeMap[e.prize_id] || "—" }))
      );
      setLoading(false);
    };
    load();
  }, [id, user]);

  const link = campaign ? `${window.location.origin}/c/${campaign.slug}` : "";

  const copyLink = () => {
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Campanha não encontrada.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl py-8">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Link>

        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">{campaign.title}</h1>
            {campaign.description && <p className="text-sm text-muted-foreground mt-1">{campaign.description}</p>}
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${campaign.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
            {campaign.is_active ? "Ativa" : "Inativa"}
          </span>
        </div>

        {/* Link & QR */}
        <div className="bg-card rounded-xl p-5 card-elevated mb-6">
          <div className="flex items-center gap-2 mb-3">
            <QrCode className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-display font-semibold text-foreground">Link da campanha</h2>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm bg-muted px-3 py-2 rounded-lg truncate text-foreground">{link}</code>
            <Button variant="outline" size="sm" onClick={copyLink}>
              <Copy className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Prizes */}
        <div className="bg-card rounded-xl p-5 card-elevated mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Gift className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-display font-semibold text-foreground">Prêmios</h2>
          </div>
          <div className="space-y-2">
            {prizes.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{p.name}</span>
                <span className="text-muted-foreground font-medium">{p.percentage}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Leads */}
        <div className="bg-card rounded-xl p-5 card-elevated">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-display font-semibold text-foreground">Leads ({entries.length})</h2>
          </div>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum lead capturado ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 font-medium text-muted-foreground">Nome</th>
                    <th className="pb-2 font-medium text-muted-foreground">WhatsApp</th>
                    <th className="pb-2 font-medium text-muted-foreground">Prêmio</th>
                    <th className="pb-2 font-medium text-muted-foreground">Código</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 text-foreground">{e.customer_name}</td>
                      <td className="py-2.5 text-foreground">{e.customer_whatsapp}</td>
                      <td className="py-2.5 text-foreground">{e.prize_name}</td>
                      <td className="py-2.5">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-foreground">{e.validation_code}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
