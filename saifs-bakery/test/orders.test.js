// End-to-end API test against a real Postgres (TEST_DATABASE_URL).
import test from "node:test";
import assert from "node:assert/strict";
const url = process.env.TEST_DATABASE_URL;
process.env.DATABASE_URL = url;
process.env.OWNER_EMAILS = "karim@littlequrankids.sg";
process.env.PAYNOW_MOBILE = "80142315";
const { q, migrate } = await import("../lib/db.js");
const { createApp } = await import("../server.js");
const { testSession } = await import("../lib/auth.js");

let base, server, cookie, cust = "";
const j = async (method, p, body, c) => {
  const r = await fetch(base + p, { method, headers: { "content-type": "application/json", cookie: [c ? "tsb_session=" + c : "", cust].filter(Boolean).join("; ") }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let data; try { data = JSON.parse(t); } catch { data = t; }
  return { status: r.status, data };
};
const future = (d) => { const x = new Date(Date.now() + d * 86400000); return x.toISOString().slice(0, 10); };
const order = (over = {}) => ({
  name: "Siti", phone: "+65 9123 4567", address: "Blk 1 Woodlands", date: future(10), slot: "2pm – 4pm", notes: "",
  items: [
    { kind: "ready", qty: 2, data: { productId: "rv-nutella", option: '5"', plaque: "Happy Birthday", candles: true }, price: 1 },
    { kind: "custom", qty: 1, data: { type: "cake", size: "6", tiers: "1", shape: "round", sponge: "Vanilla", filling: "Nutella", finish: "Buttercream", palette: "Ocean", decor: ["Theme toppers", "Name plaque"], name: "Bilal", age: "5", greeting: "Happy Birthday" } }
  ], ...over });

test.before(async () => {
  await q("DROP TABLE IF EXISTS order_events, payment_proofs, orders, customers, admins, settings, images CASCADE; DROP SEQUENCE IF EXISTS order_ref_seq");
  await migrate();
  server = createApp().listen(0); base = "http://127.0.0.1:" + server.address().port;
  cookie = await testSession("karim@littlequrankids.sg");
  const r = await fetch(base + "/api/account/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Siti", email: "siti@example.com", phone: "+65 9123 4567", password: "kek-lapis-88" }) });
  assert.equal(r.status, 201);
  cust = r.headers.get("set-cookie").split(";")[0];
});
test.after(async () => { server.close(); const { db } = await import("../lib/db.js"); await db().end(); });

let token, id;
test("health + catalog", async () => {
  assert.equal((await j("GET", "/api/health")).status, 200);
  const c = await j("GET", "/api/catalog"); assert.equal(c.data.shop.delivery.fee, 20);
});
test("place order: server sets prices, ignores browser price", async () => {
  const r = await j("POST", "/api/orders", order()); assert.equal(r.status, 201, JSON.stringify(r.data));
  token = r.data.token; assert.match(r.data.ref, /^TSB-1001$/);
  const o = await j("GET", "/api/orders/" + token);
  assert.equal(o.data.items[0].price, 48); assert.equal(o.data.items[1].price, 83); // 68 + 15 toppers
  assert.equal(o.data.subtotal, 179); assert.equal(o.data.deliveryFee, 0); assert.equal(o.data.total, 179);
  assert.equal(o.data.canEdit, true); assert.equal(o.data.canPay, false);
});
test("rejects too-soon dates and missing details", async () => {
  assert.equal((await j("POST", "/api/orders", order({ date: future(2) }))).status, 400);
  assert.equal((await j("POST", "/api/orders", order({ phone: "12" }))).status, 400);
  assert.equal((await j("POST", "/api/orders", order({ items: [] }))).status, 400);
});
test("customer edits while waiting", async () => {
  const r = await j("PUT", "/api/orders/" + token, order({ items: [order().items[0]], address: "Blk 2" })); assert.equal(r.data.mode, "edited");
  const o = await j("GET", "/api/orders/" + token); assert.equal(o.data.address, "Blk 2"); assert.equal(o.data.total, 96 + 20);
});
test("admin auth required", async () => {
  assert.equal((await j("GET", "/api/admin/orders")).status, 401);
  const me = await j("GET", "/api/admin/me", null, cookie); assert.equal(me.data.role, "owner");
});
test("admin confirms, edits price; customer can pay; QR works", async () => {
  const list = await j("GET", "/api/admin/orders", null, cookie); id = list.data[0].id;
  const d = await j("GET", "/api/admin/orders/" + id, null, cookie);
  const items = d.data.items; items[0].price = 45;
  assert.equal((await j("PATCH", "/api/admin/orders/" + id, { status: "confirmed", items, note_to_customer: "Thanks!", admin_note: "secret" }, cookie)).status, 200);
  const o = await j("GET", "/api/orders/" + token);
  assert.equal(o.data.status, "confirmed"); assert.equal(o.data.total, 90 + 20); assert.equal(o.data.canPay, true); assert.equal(o.data.canEdit, false);
  assert.ok(!JSON.stringify(o.data).includes("secret"), "private note must not leak");
  const qr = await fetch(base + "/api/orders/" + token + "/paynow.svg"); assert.equal(qr.status, 200); assert.match(await qr.text(), /<svg/);
});
test("change request after confirm, admin approves", async () => {
  const r = await j("PUT", "/api/orders/" + token, order({ items: [{ ...order().items[0], qty: 3 }], reason: "One more cake please" }));
  assert.equal(r.data.mode, "requested");
  let o = await j("GET", "/api/orders/" + token); assert.ok(o.data.pendingChange); assert.equal(o.data.items[0].qty, 2);
  assert.equal((await j("POST", "/api/admin/orders/" + id + "/change/approve", {}, cookie)).status, 200);
  o = await j("GET", "/api/orders/" + token); assert.equal(o.data.items[0].qty, 3); assert.equal(o.data.pendingChange, null);
});
test("payment proof then admin marks paid", async () => {
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  assert.equal((await j("POST", "/api/orders/" + token + "/proof", { image: png })).status, 200);
  let d = await j("GET", "/api/admin/orders/" + id, null, cookie); assert.equal(d.data.payment_status, "proof_sent"); assert.equal(d.data.proofs.length, 1);
  const img = await fetch(base + "/api/admin/proofs/" + d.data.proofs[0].id, { headers: { cookie: "tsb_session=" + cookie } }); assert.equal(img.status, 200);
  await j("PATCH", "/api/admin/orders/" + id, { payment_status: "paid" }, cookie);
  const o = await j("GET", "/api/orders/" + token); assert.equal(o.data.payment, "paid"); assert.equal(o.data.canPay, false);
});
test("admins: owner adds and removes; non-admin denied", async () => {
  assert.equal((await j("POST", "/api/admin/admins", { email: "ain@gmail.com" }, cookie)).status, 200);
  const ain = await testSession("ain@gmail.com");
  assert.equal((await j("GET", "/api/admin/orders", null, ain)).status, 200);
  assert.equal((await j("POST", "/api/admin/admins", { email: "x@y.com" }, ain)).status, 403);
  assert.equal((await j("DELETE", "/api/admin/admins/ain@gmail.com", null, cookie)).status, 200);
  assert.equal((await j("GET", "/api/admin/orders", null, ain)).status, 403);
  assert.equal((await j("DELETE", "/api/admin/admins/karim@littlequrankids.sg", null, cookie)).status, 400);
});
test("admin edits menu: new filling with a price applies to new orders", async () => {
  const cat = (await j("GET", "/api/catalog")).data;
  cat.builder.fillings.push({ id: "Biscoff", label: "Biscoff", price: 6, active: true });
  cat.builder.sizes.find((s) => s.id === "6").price = 70;
  assert.equal((await j("PUT", "/api/admin/catalog", cat, cookie)).status, 200);
  const r = await j("POST", "/api/orders", order({ items: [{ ...order().items[1], data: { ...order().items[1].data, filling: "Biscoff" } }] }));
  const o = await j("GET", "/api/orders/" + r.data.token); assert.equal(o.data.items[0].price, 70 + 15 + 6);
});
test("cancel only while waiting", async () => {
  const r = await j("POST", "/api/orders", order());
  assert.equal((await j("POST", "/api/orders/" + r.data.token + "/cancel")).status, 200);
  assert.equal((await j("POST", "/api/orders/" + token + "/cancel")).status, 409);
});

test("accounts: ordering needs sign-in; login, wrong password, my orders, admin reset", async () => {
  const saved = cust; cust = "";
  let r = await j("POST", "/api/orders", order());
  assert.equal(r.status, 401);
  assert.equal((await j("GET", "/api/account/me")).data.customer, null);
  r = await j("POST", "/api/account/signup", { name: "X", email: "siti@example.com", phone: "91234567", password: "longenough" });
  assert.match(r.data.error, /already an account/);
  r = await j("POST", "/api/account/login", { email: "siti@example.com", password: "wrong-password" });
  assert.equal(r.status, 400);
  const lr = await fetch(base + "/api/account/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "SITI@example.com", password: "kek-lapis-88" }) });
  assert.equal(lr.status, 200);
  cust = lr.headers.get("set-cookie").split(";")[0];
  const me = (await j("GET", "/api/account/me")).data.customer;
  assert.equal(me.email, "siti@example.com"); assert.equal(me.address, "Blk 1 Woodlands");
  const mine = (await j("GET", "/api/account/orders")).data;
  assert.ok(mine.length >= 1 && mine[0].ref.startsWith("TSB-"));
  const list = (await j("GET", "/api/admin/customers", null, cookie)).data;
  const s = list.find((c) => c.email === "siti@example.com"); assert.ok(s.orders >= 1);
  const pw = (await j("POST", "/api/admin/customers/" + s.id + "/reset-password", {}, cookie)).data.password;
  assert.match(pw, /^[a-z]+-[a-z]+-\d{4}$/);
  r = await j("POST", "/api/account/login", { email: "siti@example.com", password: pw });
  assert.equal(r.status, 200);
  cust = saved;
});

test("website editor: texts, colours, pages; hidden drafts; unsafe links dropped; admin only", async () => {
  const saved = cust; cust = "";
  let r = await j("GET", "/api/site");
  assert.equal(r.data.canEdit, false); assert.deepEqual(r.data.pages, []);
  r = await j("PUT", "/api/admin/site", { text: {} });
  assert.equal(r.status, 401);
  r = await j("PUT", "/api/admin/site", {
    text: { "home.hero.l1": "Cakes for", "bad key!": "x", "home.empty": "   " },
    theme: { accent: "#123456", bg: "red" },
    pages: [
      { title: "About Ain", slug: "About Ain!", nav: true, blocks: [
        { t: "heading", text: "Hello" }, { t: "text", text: "We bake **with love**." },
        { t: "image", src: "javascript:alert(1)" }, { t: "image", src: "/u/abc123.jpg", alt: "Ain" },
        { t: "button", text: "Order", href: "javascript:alert(1)" }, { t: "button", text: "Shop", href: "#shop" }, { t: "script", text: "x" } ] },
      { title: "Raya menu", slug: "raya", published: false, blocks: [] }
    ] }, cookie);
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.text, { "home.hero.l1": "Cakes for" });
  assert.deepEqual(r.data.theme, { accent: "#123456" });
  const about = r.data.pages[0];
  assert.equal(about.slug, "about-ain");
  assert.deepEqual(about.blocks.map((b) => b.t), ["heading", "text", "image", "button", "button"]);
  assert.equal(about.blocks[3].href, "#home");
  r = await j("GET", "/api/site");
  assert.deepEqual(r.data.pages.map((p) => p.slug), ["about-ain"]);
  r = await j("GET", "/api/site", null, cookie);
  assert.equal(r.data.canEdit, true); assert.equal(r.data.pages.length, 2);
  r = await j("PUT", "/api/admin/site", { pages: [{ title: "A", slug: "x" }, { title: "B", slug: "x" }] }, cookie);
  assert.match(r.data.error, /Two pages/);
  cust = saved;
});
