import type Stripe from "stripe";
import { createAdminClient } from "@/integrations/supabase/admin";
import type { Database } from "@/integrations/supabase/types";
import { getStripe } from "@/lib/stripe";

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
type Plan = Database["public"]["Tables"]["profiles"]["Row"]["subscription_plan"];

export function priceIdToPlan(priceId: string): Plan | null {
  const basic = process.env.STRIPE_PRICE_ID_BASIC?.trim();
  const pro = process.env.STRIPE_PRICE_ID_PRO?.trim();
  if (priceId === basic) return "basic";
  if (priceId === pro) return "pro";
  return null;
}

/** Stripe API recente expõe fim de período no item da assinatura. */
function subscriptionPeriodEndUnix(sub: Stripe.Subscription): number | null {
  const first = sub.items?.data?.[0];
  return first?.current_period_end ?? null;
}

function subscriptionStatusForDb(
  status: Stripe.Subscription.Status,
): NonNullable<ProfileUpdate["subscription_status"]> {
  if (status === "incomplete_expired") return "canceled";
  if (
    status === "active" ||
    status === "trialing" ||
    status === "past_due" ||
    status === "canceled" ||
    status === "unpaid" ||
    status === "incomplete" ||
    status === "paused"
  ) {
    return status;
  }
  return "canceled";
}

export async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id;
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  const customerRaw = session.customer;
  const customerId =
    typeof customerRaw === "string" ? customerRaw : customerRaw?.id ?? null;

  if (!userId || !subscriptionId || !customerId) {
    console.error("checkout.session.completed: missing user_id, subscription or customer", {
      userId,
      subscriptionId,
      customerId,
    });
    return;
  }

  const stripe = getStripe();
  // Evita colisão do tipo global `Response` com `Stripe.Response` na inferência do TS.
  const sub = (await stripe.subscriptions.retrieve(
    subscriptionId,
  )) as Stripe.Subscription;
  const priceId = sub.items.data[0]?.price?.id;
  const plan = priceId ? priceIdToPlan(priceId) : null;
  if (!plan) {
    console.error("checkout.session.completed: unknown price id", priceId);
    return;
  }

  const periodUnixCheckout = subscriptionPeriodEndUnix(sub);
  const periodEnd = periodUnixCheckout
    ? new Date(periodUnixCheckout * 1000).toISOString()
    : null;

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      subscription_status: subscriptionStatusForDb(sub.status),
      current_period_end: periodEnd,
      subscription_plan: plan,
    })
    .eq("user_id", userId);

  if (error) {
    console.error("checkout.session.completed: profile update failed", error);
  }
}

export async function syncProfileFromSubscription(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const priceId = sub.items.data[0]?.price?.id;
  const planFromPrice = priceId ? priceIdToPlan(priceId) : null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  let userId = profile?.user_id;
  if (!userId) {
    const { data: bySub } = await admin
      .from("profiles")
      .select("user_id")
      .eq("stripe_subscription_id", sub.id)
      .maybeSingle();
    userId = bySub?.user_id;
  }

  if (!userId) {
    console.error("syncProfileFromSubscription: profile not found", customerId, sub.id);
    return;
  }

  const periodUnix = subscriptionPeriodEndUnix(sub);
  const periodEnd = periodUnix ? new Date(periodUnix * 1000).toISOString() : null;

  const status = sub.status;
  const updates: ProfileUpdate = {
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    subscription_status: subscriptionStatusForDb(status),
    current_period_end: periodEnd,
  };

  if (status === "active" || status === "trialing") {
    if (planFromPrice) updates.subscription_plan = planFromPrice;
  } else if (
    status === "canceled" ||
    status === "unpaid" ||
    status === "incomplete_expired"
  ) {
    updates.subscription_plan = "free";
    updates.stripe_subscription_id = null;
    updates.current_period_end = null;
  } else if (status === "past_due") {
    if (planFromPrice) updates.subscription_plan = planFromPrice;
  }

  const { error } = await admin.from("profiles").update(updates).eq("user_id", userId);
  if (error) {
    console.error("syncProfileFromSubscription: update failed", error);
  }
}

export async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      subscription_plan: "free",
      stripe_subscription_id: null,
      subscription_status: "canceled",
      current_period_end: null,
    })
    .eq("stripe_customer_id", customerId);

  if (error) {
    console.error("handleSubscriptionDeleted: update failed", error);
  }
}

export async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subRef = invoice.parent?.subscription_details?.subscription;
  const subId = typeof subRef === "string" ? subRef : subRef?.id;
  if (!subId) return;

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ subscription_status: "past_due" })
    .eq("stripe_subscription_id", subId);

  if (error) {
    console.error("handleInvoicePaymentFailed: update failed", error);
  }
}
