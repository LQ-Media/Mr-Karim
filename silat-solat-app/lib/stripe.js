import "server-only";

// Card payments through Stripe Checkout, called over plain HTTPS (no SDK).
// This must be Silat n Solat's OWN Stripe account, paying out to the Silat n
// Solat bank account. Off until STRIPE_SECRET_KEY is set.

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function form(obj, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") form(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function stripe(path, params) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: form(params),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Stripe ${path}: ${body.error?.message || res.status}`);
  return body;
}

/** A Checkout page for one payment row. Monthly = a subscription. */
export async function createCheckout({ payment, title, origin, email }) {
  const monthly = payment.monthly;
  const session = await stripe("/checkout/sessions", {
    mode: monthly ? "subscription" : "payment",
    success_url: `${origin}/pay/${payment.ref}?done=1`,
    cancel_url: `${origin}/pay/${payment.ref}?cancelled=1`,
    client_reference_id: payment.ref,
    customer_email: email || undefined,
    metadata: { ref: payment.ref },
    ...(monthly ? { subscription_data: { metadata: { ref: payment.ref } } } : { payment_intent_data: { metadata: { ref: payment.ref } } }),
    line_items: {
      0: {
        quantity: 1,
        price_data: {
          currency: "sgd",
          unit_amount: payment.amount_cents,
          product_data: { name: title },
          ...(monthly ? { recurring: { interval: "month" } } : {}),
        },
      },
    },
  });
  return session;
}

/** Stripe's customer portal, where a supporter pauses or cancels. */
export async function portalUrl({ customer, origin }) {
  const s = await stripe("/billing_portal/sessions", { customer, return_url: `${origin}/profile` });
  return s.url;
}

export async function getSubscription(id) {
  const res = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(id)}`, {
    headers: { authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
  });
  return res.ok ? res.json() : null;
}

export { verifyWebhook } from "./stripe-signature.js";
