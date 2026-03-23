import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import type { Tables } from "@/integrations/supabase/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { plan?: "basic" | "pro" };
    const { plan } = body;
    if (plan !== "basic" && plan !== "pro") {
      return NextResponse.json({ error: "Plano inválido" }, { status: 400 });
    }

    /** PRO temporariamente fora da oferta — reative junto com a UI. */
    if (plan === "pro") {
      return NextResponse.json(
        { error: "Plano PRO indisponível no momento." },
        { status: 400 },
      );
    }

    const priceEnvKey =
      plan === "basic" ? "STRIPE_PRICE_ID_BASIC" : "STRIPE_PRICE_ID_PRO";
    const priceId =
      plan === "basic"
        ? process.env.STRIPE_PRICE_ID_BASIC?.trim()
        : process.env.STRIPE_PRICE_ID_PRO?.trim();
    if (!priceId) {
      return NextResponse.json(
        {
          error: `Defina ${priceEnvKey} no .env (Stripe → Produtos → preço recorrente mensal → copiar o ID que começa com price_).`,
        },
        { status: 500 },
      );
    }

    if (priceId.startsWith("prod_")) {
      return NextResponse.json(
        {
          error: `${priceEnvKey} está com um ID de produto (prod_...). O checkout precisa do ID do preço (price_...). No Stripe: Produto → seção Preços → ⋮ no preço mensal → Copiar ID do preço.`,
        },
        { status: 400 },
      );
    }

    if (!priceId.startsWith("price_")) {
      return NextResponse.json(
        {
          error: `${priceEnvKey} deve ser um ID que começa com price_ (preço recorrente no Stripe).`,
        },
        { status: 400 },
      );
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      request.headers.get("origin") ||
      "http://localhost:3000";

    const existingCustomerId =
      (profile as Pick<Tables<"profiles">, "stripe_customer_id"> | null)
        ?.stripe_customer_id ?? null;

    const stripe = getStripe();

    const baseSession = {
      mode: "subscription" as const,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/dashboard?checkout=success`,
      cancel_url: `${siteUrl}/dashboard?checkout=canceled`,
      client_reference_id: user.id,
      metadata: { user_id: user.id, plan },
      subscription_data: {
        metadata: { user_id: user.id },
      },
    };

    let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>;
    try {
      session = await stripe.checkout.sessions.create({
        ...baseSession,
        ...(existingCustomerId
          ? { customer: existingCustomerId }
          : { customer_email: user.email ?? undefined }),
      });
    } catch (firstErr) {
      const msg = firstErr instanceof Error ? firstErr.message : "";
      const retryWithoutCustomer =
        Boolean(existingCustomerId) &&
        (msg.includes("No such customer") ||
          msg.includes("resource_missing") ||
          msg.includes("similar object exists in live mode"));
      if (!retryWithoutCustomer) {
        throw firstErr;
      }
      session = await stripe.checkout.sessions.create({
        ...baseSession,
        customer_email: user.email ?? undefined,
      });
    }

    if (!session.url) {
      return NextResponse.json({ error: "URL de checkout indisponível" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (e: unknown) {
    console.error("stripe checkout:", e);
    const message =
      e instanceof Error
        ? e.message
        : "Falha ao criar checkout";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
