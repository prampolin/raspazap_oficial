import { NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { evolutionSendText } from "@/lib/evolution/send-text";
import { toE164BR } from "@/lib/phone-br";
import { getClientIp, rateLimitIp } from "@/lib/rate-limit-ip";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const dynamic = "force-dynamic";

function buildMessage(params: {
  customerName: string;
  campaignTitle: string;
  prizeName: string;
  validationCode: string;
  validUntil: Date;
}): string {
  const until = format(params.validUntil, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  return (
    `Olá, ${params.customerName}! 🎉\n\n` +
    `Você ganhou *${params.prizeName}* na campanha *${params.campaignTitle}* (RaspaZap).\n\n` +
    `Seu código de validação: *${params.validationCode}*\n` +
    `Válido até: ${until}\n\n` +
    `Apresente o código no estabelecimento para retirar o prêmio.`
  );
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!rateLimitIp(ip)) {
    return NextResponse.json({ error: "Muitas requisições. Tente mais tarde." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const code =
    typeof body === "object" && body !== null && "validation_code" in body
      ? String((body as { validation_code?: unknown }).validation_code ?? "").trim().toUpperCase()
      : "";

  if (!code || code.length < 4 || code.length > 32) {
    return NextResponse.json({ error: "validation_code inválido" }, { status: 400 });
  }

  const baseUrl = process.env.EVOLUTION_API_BASE_URL?.trim();
  const apiKey = process.env.EVOLUTION_API_KEY?.trim();
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME?.trim();

  if (!baseUrl || !apiKey || !instanceName) {
    console.warn("notify-winner: Evolution não configurada (EVOLUTION_*).");
    return NextResponse.json({ skipped: true, reason: "evolution_not_configured" }, { status: 200 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error("notify-winner: admin client", e);
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const { data: row, error: qErr } = await admin
    .from("scratch_entries")
    .select(
      `
      id,
      customer_name,
      customer_whatsapp,
      validation_code,
      scratched_at,
      whatsapp_notification_sent_at,
      campaigns ( title, validity_days, is_active ),
      prizes ( name )
    `,
    )
    .eq("validation_code", code)
    .maybeSingle();

  if (qErr) {
    console.error("notify-winner: query", qErr);
    return NextResponse.json({ error: "Erro ao consultar participação" }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json({ error: "Código não encontrado" }, { status: 404 });
  }

  if (row.whatsapp_notification_sent_at) {
    return NextResponse.json({ ok: true, alreadySent: true }, { status: 200 });
  }

  const camp = row.campaigns as { title: string; validity_days: number; is_active: boolean } | null;
  const prizeRow = row.prizes as { name: string } | null;
  if (!camp || !prizeRow) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 422 });
  }

  if (!camp.is_active) {
    return NextResponse.json({ error: "Campanha inativa" }, { status: 422 });
  }

  const e164 = toE164BR(row.customer_whatsapp);
  if (!e164) {
    console.warn("notify-winner: telefone inválido", row.id);
    return NextResponse.json({ error: "WhatsApp inválido" }, { status: 422 });
  }

  const scratched = new Date(row.scratched_at);
  const validUntil = addDays(scratched, camp.validity_days);

  const text = buildMessage({
    customerName: row.customer_name,
    campaignTitle: camp.title,
    prizeName: prizeRow.name,
    validationCode: row.validation_code,
    validUntil,
  });

  const sent = await evolutionSendText({
    baseUrl,
    apiKey,
    instanceName,
    number: e164,
    text,
  });

  if (sent.ok !== true) {
    console.error("notify-winner: Evolution", sent.status, sent.body);
    return NextResponse.json(
      { error: "Não foi possível enviar o WhatsApp agora", detail: sent.body },
      { status: 502 },
    );
  }

  const { error: upErr } = await admin
    .from("scratch_entries")
    .update({ whatsapp_notification_sent_at: new Date().toISOString() })
    .eq("id", row.id);

  if (upErr) {
    console.error("notify-winner: update sent_at", upErr);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
