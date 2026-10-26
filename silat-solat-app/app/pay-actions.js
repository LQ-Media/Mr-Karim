"use server";

import { redirect } from "next/navigation";
import { dbConfigured, query } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { newRef, SUPPORT_AMOUNTS } from "@/lib/money";
import { BOOK } from "@/lib/book";
import { stripeConfigured, createCheckout } from "@/lib/stripe";
import { paynowAccount } from "@/lib/paynow";
import { siteOrigin } from "@/lib/origin";


const str = (v, n = 120) => String(v || "").trim().slice(0, n);

/**
 * One action for every payment form: support (monthly or once), the book, a
 * campaign. Card goes to Stripe Checkout; PayNow goes to our own QR page.
 */
export async function startPayment(prev, formData) {
  if (!dbConfigured()) return { error: "offline" };
  const user = await getUser();
  const purpose = str(formData.get("purpose"), 20);
  let method = formData.get("method") === "card" ? "card" : "paynow";
  if (method === "card" && !stripeConfigured()) return { error: "card-off" };
  if (method === "paynow" && !paynowAccount()) return { error: "paynow-off" };

  let amount = 0;
  let monthly = false;
  let campaignId = null;
  let details = {};
  let title = "Silat & Solat";

  if (purpose === "support") {
    const dollars = Number(formData.get("amount"));
    if (!SUPPORT_AMOUNTS.includes(dollars)) return { error: "amount" };
    amount = dollars * 100;
    monthly = formData.get("monthly") === "1";
    title = monthly ? "Sahabat Padi · sokongan bulanan" : "Sokongan Silat & Solat";
  } else if (purpose === "book") {
    const delivery = formData.get("delivery") === "post" ? "post" : "pickup";
    details = {
      delivery,
      qty: Math.max(1, Math.min(10, Number(formData.get("qty")) || 1)),
      address: delivery === "post" ? str(formData.get("address"), 300) : null,
      branch: delivery === "pickup" ? str(formData.get("branch"), 40) : null,
    };
    if (delivery === "post" && !details.address) return { error: "address" };
    amount = BOOK.priceCents * details.qty + (delivery === "post" ? BOOK.postageCents : 0);
    title = `Buku Silat & Solat × ${details.qty}`;
  } else if (purpose === "campaign") {
    const dollars = Math.round(Number(formData.get("amount")) || 0);
    if (dollars < 1 || dollars > 5000) return { error: "amount" };
    amount = dollars * 100;
    const { rows } = await query("select id, title_ms from campaigns where slug = $1 and status = 'active'", [str(formData.get("campaign"), 60)]);
    if (!rows[0]) return { error: "amount" };
    campaignId = rows[0].id;
    title = rows[0].title_ms;
  } else {
    return { error: "amount" };
  }

  const payerName = str(formData.get("name"), 80) || user?.name || null;
  const payerContact = str(formData.get("contact"), 120) || user?.email || null;
  if (purpose === "book" && (!payerName || !payerContact)) return { error: "contact" };

  const ref = newRef();
  const { rows } = await query(
    `insert into payments (ref, user_id, purpose, campaign_id, amount_cents, monthly, method, payer_name, payer_contact, details)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
    [ref, user?.id || null, purpose, campaignId, amount, monthly, method, payerName, payerContact, JSON.stringify(details)]
  );
  const payment = rows[0];

  if (method === "card") {
    let url;
    try {
      const session = await createCheckout({ payment, title, origin: await siteOrigin(), email: user?.email });
      await query("update payments set stripe_session = $1 where id = $2", [session.id, payment.id]);
      url = session.url;
    } catch (err) {
      console.error("[pay] Stripe checkout failed:", err.message);
      return { error: "card-failed" };
    }
    redirect(url);
  }
  redirect(`/pay/${ref}`);
}

/** "I've paid" on the PayNow page: flags it for the admin to match. */
export async function claimPaid(formData) {
  const ref = str(formData.get("ref"), 20);
  await query("update payments set details = coalesce(details,'{}'::jsonb) || '{\"claimed\":true}'::jsonb where ref = $1 and status = 'pending'", [ref]);
  redirect(`/pay/${ref}?claimed=1`);
}
