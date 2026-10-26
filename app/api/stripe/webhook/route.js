import { query } from "@/lib/db";
import { verifyWebhook } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Stripe tells us when a card payment or a monthly renewal goes through.
 * Each renewal is recorded as its own paid row, so the payments list adds up.
 */
export async function POST(request) {
  const raw = await request.text();
  if (!verifyWebhook(raw, request.headers.get("stripe-signature"))) {
    return new Response("bad signature", { status: 400 });
  }
  const event = JSON.parse(raw);
  const obj = event.data?.object || {};
  try {
    if (event.type === "checkout.session.completed") {
      const ref = obj.client_reference_id || obj.metadata?.ref;
      if (ref && obj.payment_status !== "unpaid") {
        await query(
          `update payments set status = 'paid', paid_at = now(), stripe_subscription = $2,
             details = coalesce(details,'{}'::jsonb) || jsonb_build_object('customer', $3::text)
           where ref = $1`,
          [ref, obj.subscription || null, obj.customer || null]
        );
      }
    } else if (event.type === "invoice.paid" && obj.billing_reason === "subscription_cycle") {
      const sub = obj.subscription || obj.parent?.subscription_details?.subscription;
      const { rows } = await query("select * from payments where stripe_subscription = $1 order by id limit 1", [sub]);
      const first = rows[0];
      if (first) {
        await query(
          `insert into payments (ref, user_id, purpose, amount_cents, monthly, method, status, payer_name, payer_contact, stripe_subscription, details, paid_at)
           values ($1,$2,'support',$3,true,'card','paid',$4,$5,$6,$7,now()) on conflict (ref) do nothing`,
          [`${first.ref}-${obj.id.slice(-6)}`, first.user_id, obj.amount_paid, first.payer_name, first.payer_contact, sub, JSON.stringify({ renewal: true, invoice: obj.id })]
        );
      }
    } else if (event.type === "customer.subscription.deleted") {
      await query(
        `update payments set details = coalesce(details,'{}'::jsonb) || '{"ended":true}'::jsonb where stripe_subscription = $1`,
        [obj.id]
      );
    }
  } catch (err) {
    console.error("[stripe] webhook failed:", err.message);
    return new Response("error", { status: 500 });
  }
  return Response.json({ received: true });
}
