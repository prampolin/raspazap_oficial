import { NextResponse } from "next/server";
import { headers } from "next/headers";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import {
  handleCheckoutSessionCompleted,
  handleInvoicePaymentFailed,
  handleSubscriptionDeleted,
  syncProfileFromSubscription,
} from "@/lib/stripe-billing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const headerList = await headers();
  const sig = headerList.get("stripe-signature");
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!whSecret || !sig) {
    return NextResponse.json({ error: "Webhook não configurado" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, whSecret);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      case "customer.subscription.updated":
        await syncProfileFromSubscription(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        break;
    }
  } catch (e) {
    console.error("Webhook handler error", e);
    return NextResponse.json({ error: "Falha no processamento" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
