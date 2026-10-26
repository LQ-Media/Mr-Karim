// The Saif's Bakery: shop, customer order pages and Ain's dashboard.
// One Express server: static files from public/, JSON API under /api.
import express from "express";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import { q, migrate } from "./lib/db.js";
import { startGoogle, finishGoogle, logout, requireAdmin, googleConfigured, hashPassword, checkPassword, setCustomer, clearCustomer, currentCustomer, requireCustomer, currentAdmin } from "./lib/auth.js";
import { paynowPayload, paynowAccount } from "./lib/paynow.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(here, "public");

// The browser's pricing and starting menu, loaded here so both sides agree.
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(readFileSync(path.join(PUB, "catalog.js"), "utf8"), sandbox);
vm.runInContext(readFileSync(path.join(PUB, "pricing.js"), "utf8"), sandbox);
const DEFAULT_CATALOG = sandbox.window.SAIFS_DEFAULT_CATALOG;
const P = sandbox.window.SaifsPricing;

export const STATUSES = ["new", "confirmed", "baking", "delivering", "delivered", "cancelled"];
export const STATUS_LABEL = { new: "Waiting for Ain", confirmed: "Confirmed", baking: "Baking", delivering: "Out for delivery", delivered: "Delivered", cancelled: "Cancelled" };
export const PAYMENTS = ["unpaid", "proof_sent", "paid"];
const EDITABLE_BY_CUSTOMER = ["new"];
const CHANGE_REQUEST_OK = ["confirmed", "baking"];

export class UserError extends Error {}
const clone = (o) => JSON.parse(JSON.stringify(o));
const str = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
const money = (n) => (n == null ? null : Number(n));

/* ---------- website content (texts, colours, extra pages) edited by admins ---------- */
const EMPTY_SITE = { text: {}, theme: {}, pages: [] };
export async function getSite() {
  const { rows } = await q("SELECT value FROM settings WHERE key = 'site'");
  return rows.length ? Object.assign(clone(EMPTY_SITE), rows[0].value) : clone(EMPTY_SITE);
}
const HEX = /^#[0-9a-fA-F]{6}$/;
const SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/;
const safeSrc = (v) => { v = str(v, 500); return /^(\/u\/[A-Za-z0-9]+\.[a-z]{2,4}|img\/[A-Za-z0-9._\/-]+|https:\/\/[^\s"'<>]+)$/.test(v) ? v : ""; };
const safeHref = (v) => { v = str(v, 500); return /^(#[A-Za-z0-9\/_-]*|\/[A-Za-z0-9._\/#?=&-]*|https:\/\/[^\s"'<>]+|mailto:[^\s"'<>]+|tel:\+?[0-9 ]+)$/.test(v) ? v : ""; };
export function cleanSite(b) {
  b = b || {};
  const text = {};
  const tk = Object.keys(b.text || {});
  if (tk.length > 600) throw new UserError("Too many text changes.");
  for (const k of tk) {
    if (!/^[a-z0-9._-]{1,60}$/.test(k)) continue;
    const v = b.text[k];
    if (typeof v === "string" && v.trim() !== "") text[k] = v.slice(0, 3000);
  }
  const theme = {};
  for (const k of ["accent", "butter", "bg", "ink"]) if (HEX.test(String((b.theme || {})[k] || ""))) theme[k] = b.theme[k];
  const pages = [], slugs = new Set();
  const list = Array.isArray(b.pages) ? b.pages : [];
  if (list.length > 30) throw new UserError("Up to 30 pages.");
  for (const p of list) {
    const slug = str(p.slug, 40).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    const title = str(p.title, 120);
    if (!title) throw new UserError("Every page needs a title.");
    if (!SLUG.test(slug)) throw new UserError("Page “" + title + "” needs a web address made of letters, numbers and dashes.");
    if (slugs.has(slug)) throw new UserError("Two pages use the address “" + slug + "”.");
    slugs.add(slug);
    const blocks = [];
    for (const bl of (Array.isArray(p.blocks) ? p.blocks : []).slice(0, 80)) {
      if (bl.t === "heading") blocks.push({ t: "heading", text: str(bl.text, 200) });
      else if (bl.t === "text") blocks.push({ t: "text", text: String(bl.text == null ? "" : bl.text).slice(0, 6000) });
      else if (bl.t === "image") { const src = safeSrc(bl.src); if (src) blocks.push({ t: "image", src, alt: str(bl.alt, 200), caption: str(bl.caption, 300) }); }
      else if (bl.t === "button") { const href = safeHref(bl.href); blocks.push({ t: "button", text: str(bl.text, 80) || "Find out more", href: href || "#home" }); }
    }
    pages.push({ id: slug, slug, title, nav: !!p.nav, published: p.published !== false, blocks });
  }
  return { text, theme, pages };
}

export async function getCatalog() {
  const { rows } = await q("SELECT value FROM settings WHERE key = 'catalog'");
  return rows.length ? rows[0].value : clone(DEFAULT_CATALOG);
}

function sgToday() {
  const s = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return new Date(s + "T00:00:00Z");
}
function ymd(d) { return d.toISOString().slice(0, 10); }

/** Validate an order body from the shop; returns { fields, lines, totals } or throws a user-facing message. */
function buildOrder(cat, body, { checkDate = true } = {}) {
  const lines = P.priceLines(cat, body.items);
  if (!lines.length) throw new UserError("Your order is empty.");
  const name = str(body.name, 80), phone = str(body.phone, 30), address = str(body.address, 300);
  if (!name) throw new UserError("Please add your name.");
  if (phone.replace(/\D/g, "").length < 8) throw new UserError("Please add a phone number Ain can WhatsApp.");
  if (!address) throw new UserError("Please add a delivery address.");
  const date = str(body.date, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new UserError("Please pick a delivery date.");
  if (checkDate) {
    const earliest = new Date(sgToday().getTime() + P.leadDays(cat, lines) * 86400000);
    if (new Date(date + "T00:00:00Z") < earliest) throw new UserError("That date is too soon. The earliest date is " + ymd(earliest) + ".");
    if ((cat.shop.closedDates || []).includes(date)) throw new UserError("Ain is fully booked that day. Please pick another date.");
  }
  const slot = str(body.slot, 40);
  if (!(cat.shop.slots || []).includes(slot)) throw new UserError("Please pick a time slot.");
  const subtotal = P.subtotal(lines), fee = P.deliveryFee(cat, subtotal);
  return { fields: { customer_name: name, customer_phone: phone, address, delivery_date: date, slot, notes: str(body.notes, 1000) },
    lines, totals: { subtotal, delivery_fee: fee, total: subtotal != null && fee != null ? Math.round((subtotal + fee) * 100) / 100 : null } };
}

async function event(orderId, actor, message, visible = true) {
  await q("INSERT INTO order_events (order_id, actor, message, visible) VALUES ($1,$2,$3,$4)", [orderId, actor, message, visible]);
}

function publicOrder(o, events) {
  return {
    ref: o.ref, status: o.status, statusLabel: STATUS_LABEL[o.status], payment: o.payment_status,
    name: o.customer_name, phone: o.customer_phone, address: o.address, date: ymd(new Date(o.delivery_date)), slot: o.slot, notes: o.notes,
    items: o.items, subtotal: money(o.subtotal), deliveryFee: money(o.delivery_fee), total: money(o.total),
    pendingChange: o.pending_change, noteToCustomer: o.note_to_customer,
    canEdit: EDITABLE_BY_CUSTOMER.includes(o.status), canRequestChange: CHANGE_REQUEST_OK.includes(o.status),
    canPay: !["new", "cancelled"].includes(o.status) && o.payment_status !== "paid" && money(o.total) > 0,
    createdAt: o.created_at, events: events.map((e) => ({ at: e.created_at, who: e.actor === "customer" ? "You" : e.actor === "system" ? "The Saif's Bakery" : "Ain", message: e.message }))
  };
}
async function orderByToken(token) {
  const { rows } = await q("SELECT * FROM orders WHERE token = $1", [String(token).slice(0, 64)]);
  return rows[0] || null;
}

export function createApp() {
  const app = express();
  app.set("trust proxy", true);
  app.disable("x-powered-by");
  app.use(express.json({ limit: "6mb" }));
  app.use((req, res, next) => { res.set("X-Content-Type-Options", "nosniff"); res.set("Referrer-Policy", "strict-origin-when-cross-origin"); next(); });

  const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
    if (e instanceof UserError) return res.status(400).json({ error: e.message });
    console.error(e); res.status(500).json({ error: "Something went wrong on our side. Please try again." });
  });

  app.get("/api/health", wrap(async (req, res) => { await q("SELECT 1"); res.json({ ok: true }); }));

  /* ---------- menu ---------- */
  app.get("/api/catalog", wrap(async (req, res) => { res.set("Cache-Control", "no-cache"); res.json(await getCatalog()); }));
  app.get("/u/:id", wrap(async (req, res) => {
    const { rows } = await q("SELECT mime, data FROM images WHERE id = $1", [String(req.params.id).replace(/\.\w+$/, "")]);
    if (!rows.length) return res.status(404).end();
    res.set("Content-Type", rows[0].mime).set("Cache-Control", "public, max-age=31536000, immutable").send(rows[0].data);
  }));

  /* ---------- website content ---------- */
  app.get("/api/site", wrap(async (req, res) => {
    const site = await getSite(), admin = await currentAdmin(req);
    if (!admin) site.pages = site.pages.filter((p) => p.published);
    res.set("Cache-Control", "no-store").json(Object.assign(site, { canEdit: !!admin }));
  }));
  app.put("/api/admin/site", requireAdmin(), wrap(async (req, res) => {
    const site = cleanSite(req.body);
    if (JSON.stringify(site).length > 400000) throw new UserError("The website content is too large.");
    await q(`INSERT INTO settings (key, value, updated_by, updated_at) VALUES ('site', $1, $2, now())
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`, [JSON.stringify(site), req.admin.email]);
    res.json(site);
  }));

  /* ---------- customer accounts ---------- */
  const attempts = new Map();
  const limit = (req, key) => {
    const k = req.ip + "|" + key, now = Date.now(), a = (attempts.get(k) || []).filter((t) => now - t < 15 * 60 * 1000);
    if (a.length >= 20) throw new UserError("Too many tries. Please wait 15 minutes and try again.");
    a.push(now); attempts.set(k, a);
    if (attempts.size > 5000) attempts.clear();
  };
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const pubCustomer = (c) => c && { name: c.name, email: c.email, phone: c.phone, address: c.address, google: c.google, hasPassword: c.has_password };

  app.get("/api/account/me", wrap(async (req, res) => {
    res.set("Cache-Control", "no-store").json({ customer: pubCustomer(await currentCustomer(req)), google: googleConfigured() });
  }));
  app.post("/api/account/signup", wrap(async (req, res) => {
    const b = req.body || {};
    const email = str(b.email, 120).toLowerCase(), name = str(b.name, 80), phone = str(b.phone, 30), password = String(b.password || "");
    limit(req, "signup");
    if (!name) throw new UserError("Add your name.");
    if (!EMAIL_RE.test(email)) throw new UserError("That email address doesn’t look right.");
    if (phone.replace(/\D/g, "").length < 8) throw new UserError("Add a phone number Ain can WhatsApp.");
    if (password.length < 8) throw new UserError("Use a password of at least 8 characters.");
    const { rows: ex } = await q("SELECT id, password_hash, google FROM customers WHERE email = $1", [email]);
    if (ex.length) throw new UserError(ex[0].password_hash ? "There’s already an account with this email. Sign in instead." : "This email already has an account that signs in with Google. Use “Continue with Google”.");
    const { rows: [c] } = await q("INSERT INTO customers (email, name, phone, password_hash, last_login) VALUES ($1,$2,$3,$4,now()) RETURNING id",
      [email, name, phone, await hashPassword(password)]);
    await setCustomer(req, res, c.id);
    res.status(201).json({ ok: true });
  }));
  app.post("/api/account/login", wrap(async (req, res) => {
    const email = str((req.body || {}).email, 120).toLowerCase(), password = String((req.body || {}).password || "");
    limit(req, "login:" + email);
    const { rows } = await q("SELECT id, password_hash, google FROM customers WHERE email = $1", [email]);
    const c = rows[0];
    if (c && !c.password_hash && c.google) throw new UserError("This account signs in with Google. Use “Continue with Google”.");
    if (!c || !(await checkPassword(password, c.password_hash))) throw new UserError("Email or password isn’t right.");
    await q("UPDATE customers SET last_login = now() WHERE id = $1", [c.id]);
    await setCustomer(req, res, c.id);
    res.json({ ok: true });
  }));
  app.post("/api/account/logout", (req, res) => { clearCustomer(req, res); res.json({ ok: true }); });
  app.put("/api/account/me", requireCustomer(), wrap(async (req, res) => {
    const b = req.body || {}, c = req.customer;
    const name = str(b.name, 80), phone = str(b.phone, 30), address = str(b.address, 300);
    if (!name) throw new UserError("Add your name.");
    if (phone && phone.replace(/\D/g, "").length < 8) throw new UserError("That phone number looks too short.");
    if (b.newPassword) {
      if (String(b.newPassword).length < 8) throw new UserError("Use a new password of at least 8 characters.");
      if (c.has_password) {
        const { rows: [h] } = await q("SELECT password_hash FROM customers WHERE id = $1", [c.id]);
        if (!(await checkPassword(b.currentPassword || "", h.password_hash))) throw new UserError("Your current password isn’t right.");
      }
      await q("UPDATE customers SET password_hash = $2 WHERE id = $1", [c.id, await hashPassword(b.newPassword)]);
    }
    await q("UPDATE customers SET name = $2, phone = $3, address = $4 WHERE id = $1", [c.id, name, phone, address]);
    res.json({ ok: true });
  }));
  app.get("/api/account/orders", requireCustomer(), wrap(async (req, res) => {
    const { rows } = await q(`SELECT ref, token, status, payment_status, delivery_date, slot, total, items, created_at FROM orders
      WHERE customer_id = $1 ORDER BY id DESC LIMIT 100`, [req.customer.id]);
    res.set("Cache-Control", "no-store").json(rows.map((r) => ({ ref: r.ref, token: r.token, status: r.status, statusLabel: STATUS_LABEL[r.status] || r.status, payment: r.payment_status,
      date: ymd(new Date(r.delivery_date)), slot: r.slot, total: money(r.total), firstItem: r.items[0] && r.items[0].name, itemCount: r.items.length })));
  }));

  /* ---------- customer orders ---------- */
  app.post("/api/orders", requireCustomer(), wrap(async (req, res) => {
    const cat = await getCatalog();
    const { fields, lines, totals } = buildOrder(cat, req.body || {});
    const token = randomBytes(18).toString("base64url");
    const { rows: [{ n }] } = await q("SELECT nextval('order_ref_seq') AS n");
    const ref = "TSB-" + n;
    const { rows: [o] } = await q(
      `INSERT INTO orders (ref, token, customer_name, customer_phone, address, delivery_date, slot, notes, items, subtotal, delivery_fee, total, customer_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [ref, token, fields.customer_name, fields.customer_phone, fields.address, fields.delivery_date, fields.slot, fields.notes, JSON.stringify(lines), totals.subtotal, totals.delivery_fee, totals.total, req.customer.id]);
    // Remember the latest contact details and address on the account for next time.
    await q("UPDATE customers SET name = $2, phone = $3, address = $4 WHERE id = $1", [req.customer.id, fields.customer_name, fields.customer_phone, fields.address]);
    await event(o.id, "customer", "Order placed.");
    res.status(201).json({ ref, token });
  }));

  app.get("/api/orders/:token", wrap(async (req, res) => {
    const o = await orderByToken(req.params.token);
    if (!o) return res.status(404).json({ error: "We couldn't find that order. Check the link Ain sent you." });
    const { rows: ev } = await q("SELECT actor, message, created_at FROM order_events WHERE order_id = $1 AND visible ORDER BY id", [o.id]);
    res.set("Cache-Control", "no-store").json(publicOrder(o, ev));
  }));

  // Edit (while waiting for Ain) or request a change (after she confirms).
  app.put("/api/orders/:token", wrap(async (req, res) => {
    const o = await orderByToken(req.params.token);
    if (!o) return res.status(404).json({ error: "Order not found." });
    const cat = await getCatalog();
    if (EDITABLE_BY_CUSTOMER.includes(o.status)) {
      const { fields, lines, totals } = buildOrder(cat, req.body || {});
      await q(`UPDATE orders SET customer_name=$2, customer_phone=$3, address=$4, delivery_date=$5, slot=$6, notes=$7, items=$8, subtotal=$9, delivery_fee=$10, total=$11, updated_at=now() WHERE id=$1`,
        [o.id, fields.customer_name, fields.customer_phone, fields.address, fields.delivery_date, fields.slot, fields.notes, JSON.stringify(lines), totals.subtotal, totals.delivery_fee, totals.total]);
      await event(o.id, "customer", "Order edited.");
      return res.json({ ok: true, mode: "edited" });
    }
    if (CHANGE_REQUEST_OK.includes(o.status)) {
      const { fields, lines, totals } = buildOrder(cat, req.body || {}, { checkDate: false });
      const change = { ...fields, items: lines, ...totals, reason: str(req.body.reason, 500), requestedAt: new Date().toISOString() };
      await q("UPDATE orders SET pending_change=$2, updated_at=now() WHERE id=$1", [o.id, JSON.stringify(change)]);
      await event(o.id, "customer", "Asked for a change" + (change.reason ? ": " + change.reason : "."));
      return res.json({ ok: true, mode: "requested" });
    }
    res.status(409).json({ error: "This order can't be changed any more. Please WhatsApp Ain." });
  }));

  app.delete("/api/orders/:token/change", wrap(async (req, res) => {
    const o = await orderByToken(req.params.token);
    if (!o || !o.pending_change) return res.status(404).json({ error: "No change request to withdraw." });
    await q("UPDATE orders SET pending_change=NULL, updated_at=now() WHERE id=$1", [o.id]);
    await event(o.id, "customer", "Withdrew the change request.");
    res.json({ ok: true });
  }));

  app.post("/api/orders/:token/cancel", wrap(async (req, res) => {
    const o = await orderByToken(req.params.token);
    if (!o) return res.status(404).json({ error: "Order not found." });
    if (o.status !== "new") return res.status(409).json({ error: "Ain has already confirmed this order. Please WhatsApp her to cancel." });
    await q("UPDATE orders SET status='cancelled', updated_at=now() WHERE id=$1", [o.id]);
    await event(o.id, "customer", "Cancelled the order.");
    res.json({ ok: true });
  }));

  app.get("/api/orders/:token/paynow.svg", wrap(async (req, res) => {
    const o = await orderByToken(req.params.token), acct = paynowAccount();
    if (!o || !acct || ["new", "cancelled"].includes(o.status) || !(money(o.total) > 0)) return res.status(404).end();
    const payload = paynowPayload({ ...acct, merchantName: acct.name, amountCents: Math.round(money(o.total) * 100), reference: o.ref.replace("-", "") });
    const svg = await QRCode.toString(payload, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#3B2A20", light: "#FFFFFF" } });
    res.set("Content-Type", "image/svg+xml").set("Cache-Control", "no-store").send(svg);
  }));

  app.post("/api/orders/:token/proof", wrap(async (req, res) => {
    const o = await orderByToken(req.params.token);
    if (!o) return res.status(404).json({ error: "Order not found." });
    const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(String(req.body && req.body.image || ""));
    if (!m) throw new UserError("Please choose a screenshot (JPG or PNG).");
    const buf = Buffer.from(m[2], "base64");
    if (buf.length > 4.5 * 1024 * 1024) throw new UserError("That image is too big. Please send a smaller screenshot.");
    await q("INSERT INTO payment_proofs (order_id, mime, data) VALUES ($1,$2,$3)", [o.id, m[1], buf]);
    if (o.payment_status !== "paid") await q("UPDATE orders SET payment_status='proof_sent', updated_at=now() WHERE id=$1", [o.id]);
    await event(o.id, "customer", "Sent a payment screenshot.");
    res.json({ ok: true });
  }));

  /* ---------- admin sign-in ---------- */
  app.get("/api/auth/google/start", wrap(startGoogle));
  app.get("/api/auth/google/callback", wrap(finishGoogle));
  app.get("/api/auth/logout", logout);
  app.get("/api/admin/me", requireAdmin(), (req, res) => res.json({ email: req.admin.email, role: req.admin.role, name: req.admin.name, googleReady: googleConfigured() }));

  /* ---------- admin: orders ---------- */
  app.get("/api/admin/orders", requireAdmin(), wrap(async (req, res) => {
    const { rows } = await q(`SELECT o.id, o.ref, o.status, o.payment_status, o.customer_name, o.customer_phone, o.delivery_date, o.slot, o.total,
      o.items, (o.pending_change IS NOT NULL) AS has_change, o.created_at, o.updated_at FROM orders o ORDER BY o.delivery_date ASC, o.id ASC LIMIT 500`);
    res.set("Cache-Control", "no-store").json(rows.map((r) => ({ ...r, total: money(r.total), delivery_date: ymd(new Date(r.delivery_date)), itemCount: r.items.length,
      firstItem: r.items[0] && r.items[0].name, items: undefined })));
  }));

  app.get("/api/admin/orders/:id", requireAdmin(), wrap(async (req, res) => {
    const { rows } = await q("SELECT o.*, c.email AS customer_email FROM orders o LEFT JOIN customers c ON c.id = o.customer_id WHERE o.id = $1", [parseInt(req.params.id, 10)]);
    if (!rows.length) return res.status(404).json({ error: "Order not found." });
    const o = rows[0];
    const { rows: ev } = await q("SELECT actor, message, visible, created_at FROM order_events WHERE order_id = $1 ORDER BY id", [o.id]);
    const { rows: pr } = await q("SELECT id, created_at FROM payment_proofs WHERE order_id = $1 ORDER BY id", [o.id]);
    res.set("Cache-Control", "no-store").json({ ...o, delivery_date: ymd(new Date(o.delivery_date)), subtotal: money(o.subtotal), delivery_fee: money(o.delivery_fee), total: money(o.total), events: ev, proofs: pr });
  }));

  app.patch("/api/admin/orders/:id", requireAdmin(), wrap(async (req, res) => {
    const id = parseInt(req.params.id, 10), b = req.body || {};
    const { rows } = await q("SELECT * FROM orders WHERE id = $1", [id]);
    if (!rows.length) return res.status(404).json({ error: "Order not found." });
    const o = rows[0], set = {}, said = [], who = req.admin.email;
    if (b.status !== undefined) { if (!STATUSES.includes(b.status)) throw new UserError("Unknown status."); if (b.status !== o.status) { set.status = b.status; said.push("Status: " + STATUS_LABEL[b.status]); } }
    if (b.payment_status !== undefined) {
      if (!PAYMENTS.includes(b.payment_status)) throw new UserError("Unknown payment status.");
      if (b.payment_status !== o.payment_status) { set.payment_status = b.payment_status; said.push(b.payment_status === "paid" ? "Payment received. Thank you!" : b.payment_status === "unpaid" ? "Payment not received yet. Please check and send again." : "Payment screenshot received."); }
    }
    const textFields = { customer_name: 80, customer_phone: 30, address: 300, slot: 40, notes: 1000, note_to_customer: 1000, admin_note: 2000 };
    for (const [k, n] of Object.entries(textFields)) if (b[k] !== undefined && str(b[k], n) !== o[k]) { set[k] = str(b[k], n); if (k === "note_to_customer") said.push("New note from Ain."); else if (k !== "admin_note") said.push("Updated " + k.replace("customer_", "").replace("_", " ") + "."); }
    if (b.delivery_date !== undefined) { if (!/^\d{4}-\d{2}-\d{2}$/.test(b.delivery_date)) throw new UserError("Bad date."); if (b.delivery_date !== ymd(new Date(o.delivery_date))) { set.delivery_date = b.delivery_date; said.push("Delivery date changed to " + b.delivery_date + "."); } }
    let items = o.items, feeChanged = false;
    if (Array.isArray(b.items)) {
      items = b.items.slice(0, 40).map((it) => ({ kind: it.kind === "custom" ? "custom" : it.kind === "ready" ? "ready" : "extra", data: it.data || null,
        name: str(it.name, 120) || "Item", detail: str(it.detail, 600), photo: str(it.photo, 300) || "img/logo.png",
        price: it.price === null || it.price === "" ? null : Math.round(Number(it.price) * 100) / 100, qty: Math.max(1, Math.min(99, parseInt(it.qty, 10) || 1)) }));
      if (items.some((i) => i.price != null && !isFinite(i.price))) throw new UserError("Prices must be numbers.");
      set.items = JSON.stringify(items); said.push("Order items updated.");
    }
    let fee = money(o.delivery_fee);
    if (b.delivery_fee !== undefined) { fee = b.delivery_fee === null || b.delivery_fee === "" ? null : Math.round(Number(b.delivery_fee) * 100) / 100; feeChanged = true; said.push("Delivery fee updated."); }
    if (set.items || feeChanged) {
      const sub = P.subtotal(items); set.subtotal = sub; set.delivery_fee = fee;
      set.total = sub != null && fee != null ? Math.round((sub + fee) * 100) / 100 : null;
    }
    const keys = Object.keys(set);
    if (!keys.length) return res.json({ ok: true });
    await q(`UPDATE orders SET ${keys.map((k, i) => `${k}=$${i + 2}`).join(", ")}, updated_at=now() WHERE id=$1`, [id, ...keys.map((k) => set[k])]);
    const visibleSaid = said.filter(Boolean);
    if (visibleSaid.length) await event(id, "admin:" + who, visibleSaid.join(" "), true);
    if (b.admin_note !== undefined && set.admin_note !== undefined) await event(id, "admin:" + who, "Private note updated.", false);
    res.json({ ok: true });
  }));

  app.post("/api/admin/orders/:id/change/:decision", requireAdmin(), wrap(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { rows } = await q("SELECT * FROM orders WHERE id = $1", [id]);
    if (!rows.length || !rows[0].pending_change) return res.status(404).json({ error: "No change request on this order." });
    const c = rows[0].pending_change;
    if (req.params.decision === "approve") {
      await q(`UPDATE orders SET customer_name=$2, customer_phone=$3, address=$4, delivery_date=$5, slot=$6, notes=$7, items=$8, subtotal=$9, delivery_fee=$10, total=$11, pending_change=NULL, updated_at=now() WHERE id=$1`,
        [id, c.customer_name, c.customer_phone, c.address, c.delivery_date, c.slot, c.notes, JSON.stringify(c.items), c.subtotal, c.delivery_fee, c.total]);
      await event(id, "admin:" + req.admin.email, "Ain approved your change.");
    } else if (req.params.decision === "decline") {
      await q("UPDATE orders SET pending_change=NULL, updated_at=now() WHERE id=$1", [id]);
      await event(id, "admin:" + req.admin.email, "Ain couldn't make that change. " + str(req.body && req.body.reason, 300));
    } else return res.status(400).json({ error: "Unknown decision." });
    res.json({ ok: true });
  }));

  app.get("/api/admin/proofs/:pid", requireAdmin(), wrap(async (req, res) => {
    const { rows } = await q("SELECT mime, data FROM payment_proofs WHERE id = $1", [parseInt(req.params.pid, 10)]);
    if (!rows.length) return res.status(404).end();
    res.set("Content-Type", rows[0].mime).set("Cache-Control", "private, max-age=3600").send(rows[0].data);
  }));

  /* ---------- admin: menu ---------- */
  app.put("/api/admin/catalog", requireAdmin(), wrap(async (req, res) => {
    const c = req.body;
    if (!c || !c.shop || !Array.isArray(c.products) || !Array.isArray(c.gallery) || !c.builder) throw new UserError("That menu is incomplete.");
    for (const k of ["sizes", "tiers", "shapes", "sponges", "fillings", "finishes", "palettes", "decorations", "cupcakeSizes"]) if (!Array.isArray(c.builder[k])) throw new UserError("Missing " + k + ".");
    if (JSON.stringify(c).length > 500000) throw new UserError("The menu is too large.");
    await q(`INSERT INTO settings (key, value, updated_by, updated_at) VALUES ('catalog', $1, $2, now())
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`, [JSON.stringify(c), req.admin.email]);
    res.json({ ok: true });
  }));
  app.post("/api/admin/catalog/reset", requireAdmin("owner"), wrap(async (req, res) => { await q("DELETE FROM settings WHERE key='catalog'"); res.json({ ok: true }); }));
  app.post("/api/admin/images", requireAdmin(), wrap(async (req, res) => {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(String(req.body && req.body.image || ""));
    if (!m) throw new UserError("Please choose a JPG, PNG or WebP photo.");
    const buf = Buffer.from(m[2], "base64");
    if (buf.length > 4 * 1024 * 1024) throw new UserError("That photo is too big (max 4 MB).");
    const id = randomBytes(10).toString("hex");
    await q("INSERT INTO images (id, mime, data) VALUES ($1,$2,$3)", [id, m[1], buf]);
    res.json({ url: "/u/" + id + (m[1] === "image/png" ? ".png" : m[1] === "image/webp" ? ".webp" : ".jpg") });
  }));

  /* ---------- admin: admins ---------- */
  app.get("/api/admin/admins", requireAdmin(), wrap(async (req, res) => {
    const { rows } = await q("SELECT email, role, name, added_by, created_at FROM admins ORDER BY role DESC, created_at");
    res.json(rows);
  }));
  app.post("/api/admin/admins", requireAdmin("owner"), wrap(async (req, res) => {
    const email = str(req.body && req.body.email, 200).toLowerCase(), role = req.body && req.body.role === "owner" ? "owner" : "admin";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new UserError("Please enter a full email address.");
    await q(`INSERT INTO admins (email, role, added_by) VALUES ($1,$2,$3) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role`, [email, role, req.admin.email]);
    res.json({ ok: true });
  }));
  app.delete("/api/admin/admins/:email", requireAdmin("owner"), wrap(async (req, res) => {
    const email = String(req.params.email).toLowerCase();
    if (email === req.admin.email) throw new UserError("You can't remove yourself.");
    const { rows } = await q("SELECT role FROM admins WHERE email=$1", [email]);
    if (!rows.length) return res.status(404).json({ error: "Not an admin." });
    if (rows[0].role === "owner") { const { rows: [c] } = await q("SELECT count(*)::int AS n FROM admins WHERE role='owner'"); if (c.n <= 1) throw new UserError("Keep at least one owner."); }
    await q("DELETE FROM admins WHERE email=$1", [email]);
    res.json({ ok: true });
  }));

  /* ---------- admin: customers ---------- */
  app.get("/api/admin/customers", requireAdmin(), wrap(async (req, res) => {
    const { rows } = await q(`SELECT c.id, c.email, c.name, c.phone, c.google, (c.password_hash IS NOT NULL) AS has_password, c.created_at, c.last_login,
      count(o.id)::int AS orders, coalesce(sum(o.total) FILTER (WHERE o.status <> 'cancelled'), 0)::float AS spent
      FROM customers c LEFT JOIN orders o ON o.customer_id = c.id GROUP BY c.id ORDER BY c.id DESC LIMIT 1000`);
    res.set("Cache-Control", "no-store").json(rows);
  }));
  app.post("/api/admin/customers/:id/reset-password", requireAdmin(), wrap(async (req, res) => {
    const words = "cake bun tart icing sugar honey mango pandan cocoa cream berry lemon apple kaya donut cookie".split(" ");
    const pick = () => words[randomBytes(1)[0] % words.length];
    const pw = pick() + "-" + pick() + "-" + (1000 + (randomBytes(2).readUInt16BE(0) % 9000));
    const { rowCount } = await q("UPDATE customers SET password_hash = $2 WHERE id = $1", [parseInt(req.params.id, 10), await hashPassword(pw)]);
    if (!rowCount) return res.status(404).json({ error: "Customer not found." });
    res.json({ password: pw });
  }));

  app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));

  /* ---------- static site ---------- */
  app.use(express.static(PUB, {
    extensions: ["html"],
    setHeaders(res, file) {
      if (/\.(html|webmanifest)$|sw\.js$/.test(file)) res.set("Cache-Control", "no-cache");
      else if (/\/img\//.test(file)) res.set("Cache-Control", "public, max-age=604800");
      else res.set("Cache-Control", "public, max-age=300");
    }
  }));
  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await migrate();
  const port = process.env.PORT || 3000;
  createApp().listen(port, () => console.log("The Saif's Bakery listening on " + port));
}
