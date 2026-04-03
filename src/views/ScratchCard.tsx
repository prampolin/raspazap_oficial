"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Gift, PartyPopper } from "lucide-react";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Prize = Tables<"prizes">;

/** Máscara (XX) XXXXX-XXXX (celular) ou (XX) XXXX-XXXX (fixo). */
function maskBrazilPhone(input: string): string {
  const d = input.replace(/\D/g, "").slice(0, 11);
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

export default function ScratchCard() {
  const params = useParams<{ slug?: string }>();
  const slug = typeof params.slug === "string" ? params.slug : undefined;
  const [campaign, setCampaign] = useState<Tables<"campaigns"> | null>(null);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [step, setStep] = useState<
    "loading" | "form" | "scratch" | "result" | "error"
  >("loading");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [wonPrize, setWonPrize] = useState<Prize | null>(null);
  const [validationCode, setValidationCode] = useState("");
  const [scratched, setScratched] = useState(false);
  const [noPrizeByPhoneLock, setNoPrizeByPhoneLock] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const scratchPercent = useRef(0);

  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      const { data: camp } = await supabase
        .from("campaigns")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .single();

      if (!camp) {
        setStep("error");
        return;
      }
      setCampaign(camp);

      const { data: prizeData } = await supabase
        .from("prizes")
        .select("*")
        .eq("campaign_id", camp.id);
      setPrizes(prizeData || []);
      setStep("form");
    };
    load();
  }, [slug]);

  const pickPrize = (prizeList: Prize[]): Prize => {
    const rand = Math.random() * 100;
    let cumulative = 0;
    for (const p of prizeList) {
      cumulative += p.percentage;
      if (rand <= cumulative) return p;
    }
    return prizeList[prizeList.length - 1];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaign) {
      toast.error("Campanha indisponível no momento. Tente novamente mais tarde.");
      return;
    }
    if (prizes.length === 0) {
      toast.error("Nenhum prêmio configurado para esta campanha.");
      return;
    }

    const whatsappDigits = whatsapp.replace(/\D/g, "");
    if (whatsappDigits.length < 10 || whatsappDigits.length > 11) {
      toast.error("Informe um WhatsApp válido com DDD (10 ou 11 dígitos).");
      return;
    }

    // Trava: se já ganhou nesta campanha e ainda não resgatou, não pode raspar de novo
    const { data: existingEntries, error: existingError } = await supabase
      .from("scratch_entries")
      .select("redeemed")
      .eq("campaign_id", campaign.id)
      .eq("customer_whatsapp", whatsappDigits);

    if (existingError) {
      toast.error("Não foi possível verificar sua participação anterior. Tente novamente.");
      return;
    }

    if (existingEntries && existingEntries.some((e) => !e.redeemed)) {
      toast.error("Você já tem um prêmio pendente nesta campanha. Use o código que recebeu.");
      return;
    }

    const legacyLockNumber = campaign.phone_lock_number ?? "";
    const legacyDigits = legacyLockNumber.replace(/\D/g, "");
    const whitelist = (campaign as Tables<"campaigns">).phone_lock_whitelist;
    const allowedDigits = Array.isArray(whitelist) && whitelist.length > 0
      ? whitelist.map((d) => d.replace(/\D/g, "")).filter(Boolean)
      : legacyDigits
        ? [legacyDigits]
        : [];

    if (campaign.phone_lock_enabled && allowedDigits.length > 0) {
      const isAllowed = allowedDigits.includes(whatsappDigits);
      if (!isAllowed) {
        // Não gera prêmio nem código; deixa a pessoa raspar para ver que não ganhou
        setNoPrizeByPhoneLock(true);
        setWonPrize(null);
        setValidationCode("");
        setStep("scratch");
        return;
      }
    }

    // Respeita o limite de raspadinhas configurado na campanha (max_scratch_entries)
    if (campaign.max_scratch_entries != null) {
      const { count } = await supabase
        .from("scratch_entries")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campaign.id);

      if ((count ?? 0) >= campaign.max_scratch_entries) {
        // Deixa o usuário raspar, mas sem prêmio
        setNoPrizeByPhoneLock(true);
        setWonPrize(null);
        setValidationCode("");
        setStep("scratch");
        return;
      }
    }

    const prize = pickPrize(prizes);
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const { error } = await supabase.from("scratch_entries").insert({
      campaign_id: campaign.id,
      prize_id: prize.id,
      customer_name: name.trim(),
      customer_whatsapp: whatsappDigits,
      validation_code: code,
    });

    if (error) {
      const msg = error.message ?? "";
      if (msg.includes("Limite mensal")) {
        toast.error(
          "Este estabelecimento atingiu o limite mensal de raspadinhas do plano.",
        );
        return;
      }
      if (msg.includes("Limite de raspadinhas desta campanha")) {
        // Limite por campanha estourado: mostra mensagem de "não ganhou" sem prêmio
        setNoPrizeByPhoneLock(true);
        setWonPrize(null);
        setValidationCode("");
        setStep("result");
        return;
      }
      toast.error("Não foi possível registrar sua participação. Tente novamente.");
      setStep("error");
      return;
    }

    void (async () => {
      try {
        const res = await fetch("/api/scratch/notify-winner", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ validation_code: code }),
        });
        if (res.status === 502) {
          toast.message(
            "Não foi possível enviar o aviso por WhatsApp agora. Anote seu código de validação.",
          );
        }
      } catch {
        /* rede: participação já está salva */
      }
    })();

    setNoPrizeByPhoneLock(false);
    setWonPrize(prize);
    setValidationCode(code);
    setStep("scratch");
  };

  const initCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    // Gold scratch surface
    const gradient = ctx.createLinearGradient(0, 0, rect.width, rect.height);
    gradient.addColorStop(0, "#c49b2c");
    gradient.addColorStop(0.5, "#e8c547");
    gradient.addColorStop(1, "#c49b2c");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Diagonal pattern
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    for (let i = -rect.height; i < rect.width + rect.height; i += 12) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + rect.height, rect.height);
      ctx.stroke();
    }

    // Text
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 20px 'Space Grotesk', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🎁 RASPE AQUI", rect.width / 2, rect.height / 2 - 12);
    ctx.font = "13px Inter, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(
      "Passe o dedo para revelar",
      rect.width / 2,
      rect.height / 2 + 16,
    );
  }, []);

  useEffect(() => {
    if (step === "scratch") {
      setTimeout(() => initCanvas(canvasRef.current), 50);
    }
  }, [step, initCanvas]);

  const scratch = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const cx = x - rect.left;
    const cy = y - rect.top;

    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fill();

    scratchPercent.current += 0.8;
    if (scratchPercent.current > 45 && !scratched) {
      setScratched(true);
      setTimeout(() => setStep("result"), 600);
    }
  };

  const handlePointerDown = () => {
    isDrawing.current = true;
  };
  const handlePointerUp = () => {
    isDrawing.current = false;
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing.current) return;
    scratch(e.clientX, e.clientY);
  };

  if (step === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="font-display text-xl font-bold text-foreground mb-2">
            Campanha não encontrada
          </h1>
          <p className="text-sm text-muted-foreground">
            Esta promoção pode ter expirado ou o link é inválido.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8 font-display">
          <Logo />
        </div>

        {step === "form" && campaign && (
          <div className="animate-fade-up">
            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-gradient-gold flex items-center justify-center mx-auto mb-4">
                <Gift className="w-7 h-7 text-secondary-foreground" />
              </div>
              <h1 className="font-display text-2xl font-bold text-foreground mb-2">
                {campaign.title}
              </h1>
              {campaign.description && (
                <p className="text-sm text-muted-foreground">
                  {campaign.description}
                </p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Seu nome</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Como podemos te chamar?"
                  required
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  maxLength={15}
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(maskBrazilPhone(e.target.value))}
                  placeholder="(11) 99999-9999"
                  required
                  className="mt-1.5"
                />
              </div>
              <Button type="submit" className="w-full text-base" size="lg">
                🎁 Liberar minha raspadinha
              </Button>
            </form>
          </div>
        )}

        {step === "scratch" && (
          <div className="animate-fade-up text-center">
            <h2 className="font-display text-xl font-bold text-foreground mb-2">
              {noPrizeByPhoneLock ? "Raspadinha liberada" : "Sua raspadinha está pronta!"}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              {noPrizeByPhoneLock
                ? "Raspe a área dourada para descobrir se você ganhou."
                : "Raspe a área dourada para revelar seu prêmio."}
            </p>

            <div
              className="relative rounded-2xl overflow-hidden scratch-shadow mx-auto"
              style={{ width: 280, height: 180 }}
            >
              {/* Prize / no-prize behind */}
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-card">
                {noPrizeByPhoneLock ? (
                  <>
                    <Gift className="w-8 h-8 text-muted-foreground mb-2" />
                    <p className="font-display text-lg font-bold text-foreground">
                      Mais sorte da próxima vez
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Esta tentativa não gerou nenhum prêmio.
                    </p>
                  </>
                ) : (
                  <>
                    <PartyPopper className="w-8 h-8 text-accent mb-2" />
                    <p className="font-display text-lg font-bold text-foreground">
                      {wonPrize?.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Parabéns!</p>
                  </>
                )}
              </div>
              {/* Scratch layer */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full touch-none cursor-pointer"
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onPointerMove={handlePointerMove}
              />
            </div>
          </div>
        )}

        {step === "result" && !noPrizeByPhoneLock && wonPrize && (
          <div className="animate-reveal text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-gold flex items-center justify-center mx-auto mb-4">
              <PartyPopper className="w-8 h-8 text-secondary-foreground" />
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground mb-2">
              Parabéns! 🎉
            </h2>
            <p className="text-lg text-foreground font-medium mb-4">
              Você ganhou:{" "}
              <span className="text-gradient-gold font-display font-bold">
                {wonPrize.name}
              </span>
            </p>

            <div className="bg-card rounded-xl p-5 card-elevated mb-6 text-left space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  Código de validação
                </p>
                <div className="flex items-center gap-2">
                  <p className="font-display text-2xl font-bold text-foreground tracking-wider tabular-nums min-w-0 break-all">
                    {validationCode}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    aria-label="Copiar código de validação"
                    onClick={() => {
                      void navigator.clipboard.writeText(validationCode);
                      toast.success("Código copiado!");
                    }}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              {campaign && (
                <>
                  <div className="border-t border-border pt-3">
                    <p className="text-xs text-muted-foreground">
                      Compra mínima:{" "}
                      <span className="text-foreground font-medium">
                        R$ {Number(campaign.min_purchase).toFixed(2)}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Validade:{" "}
                      <span className="text-foreground font-medium">
                        {campaign.validity_days} dias
                      </span>
                    </p>
                  </div>
                </>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Apresente este código no momento da compra para resgatar seu prêmio.
            </p>
          </div>
        )}

        {step === "result" && noPrizeByPhoneLock && (
          <div className="animate-reveal text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Gift className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground mb-2">
              Mais sorte da próxima vez
            </h2>
            <p className="text-sm text-muted-foreground">
              Você raspou a campanha, mas não ganhou nenhum prêmio nesta tentativa.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
