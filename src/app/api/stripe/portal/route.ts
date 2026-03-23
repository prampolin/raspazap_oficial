import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import type { Tables } from "@/integrations/supabase/types";

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const stripeCustomerId =
      (profile as Pick<Tables<"profiles">, "stripe_customer_id"> | null)
        ?.stripe_customer_id ?? null;

    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: "Nenhuma conta de cobrança encontrada" },
        { status: 400 },
      );
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      request.headers.get("origin") ||
      "http://localhost:3000";

    const stripe = getStripe();
    const portal = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${siteUrl}/dashboard`,
    });

    if (!portal.url) {
      return NextResponse.json({ error: "URL do portal indisponível" }, { status: 500 });
    }

    return NextResponse.json({ url: portal.url });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao abrir portal" }, { status: 500 });
  }
}
