(function () {
"use strict";
var P = window.SaifsPricing;
var $ = function (s, el) { return (el || document).querySelector(s); };
var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
var money = function (n) { return n == null || !isFinite(n) ? "–" : "$" + (Math.round(n * 100) / 100).toFixed(n % 1 ? 2 : 0); };
var STATUS = [["new", "Waiting"], ["confirmed", "Confirmed"], ["baking", "Baking"], ["delivering", "Out for delivery"], ["delivered", "Delivered"], ["cancelled", "Cancelled"]];
var STATUS_L = {}; STATUS.forEach(function (s) { STATUS_L[s[0]] = s[1]; });
var PAY_L = { unpaid: "Unpaid", proof_sent: "Check payment", paid: "Paid" };
var ME = null, ORDERS = [], FILTER = "action", CUR = null, CAT = null, CAT_DIRTY = false, SECTION = "shop";

function toast(msg) { var t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove("on"); }, 2600); }
function api(method, url, body) {
  return fetch(url, { method: method, credentials: "same-origin", headers: body !== undefined ? { "content-type": "application/json" } : {}, body: body !== undefined ? JSON.stringify(body) : undefined })
    .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (r.status === 401) { showSignin(d.error); throw new Error(d.error); } if (!r.ok) throw new Error(d.error || "Something went wrong."); return d; }); });
}
function showSignin(msg) {
  $("#signin").hidden = false; $("#app").hidden = true; $("#signOut").hidden = true;
  var q = new URLSearchParams(location.search);
  $("#signinMsg").textContent = q.get("denied") ? q.get("denied") + " isn’t an admin yet. Ask an owner to add this Google account." : q.get("error") || (msg && msg !== "Please sign in." ? msg : "");
}
function fmtDay(s) { var p = s.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2]); return d.toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" }); }
function waLink(phone, text) { var n = String(phone || "").replace(/\D/g, ""); if (n.length === 8) n = "65" + n; return "https://wa.me/" + n + "?text=" + encodeURIComponent(text); }
function orderLink(o) { return location.origin + "/#order/" + o.token; }

/* ---------------- tabs ---------------- */
$(".admintabs").addEventListener("click", function (e) {
  var b = e.target.closest("[data-tab]"); if (!b) return;
  if (CAT_DIRTY && b.dataset.tab !== "menu" && !confirmLeave()) return;
  if (SITE_DIRTY && b.dataset.tab !== "website") { toast("Save or undo your website changes first."); return; }
  $$(".admintabs [data-tab]").forEach(function (x) { x.setAttribute("aria-selected", x === b); });
  ["orders", "menu", "website", "customers", "admins"].forEach(function (t) { $("#tab-" + t).hidden = t !== b.dataset.tab; });
  if (b.dataset.tab === "customers") loadCustomers();
  if (b.dataset.tab === "website") loadSite();
  if (b.dataset.tab === "orders") loadOrders();
  if (b.dataset.tab === "menu") loadMenu();
  if (b.dataset.tab === "admins") loadAdmins();
});
function confirmLeave() { toast("Save or undo your menu changes first."); return false; }

/* ---------------- orders ---------------- */
var FILTERS = [["action", "Needs you"], ["upcoming", "Upcoming"], ["all", "All"], ["done", "Done"]];
function needsYou(o) { return o.status === "new" || o.has_change || o.payment_status === "proof_sent"; }
function loadOrders() { return api("GET", "/api/admin/orders").then(function (rows) { ORDERS = rows; renderOrders(); }).catch(function (e) { if (ME) toast(e.message); }); }
function renderOrders() {
  var counts = { action: ORDERS.filter(needsYou).length };
  $("#orderFilters").innerHTML = FILTERS.map(function (f) { return '<button class="chip" type="button" data-f="' + f[0] + '" aria-pressed="' + (FILTER === f[0]) + '">' + f[1] + (f[0] === "action" && counts.action ? " · " + counts.action : "") + "</button>"; }).join("");
  var list = ORDERS.filter(function (o) {
    if (FILTER === "action") return needsYou(o);
    if (FILTER === "upcoming") return ["confirmed", "baking", "delivering"].indexOf(o.status) >= 0;
    if (FILTER === "done") return ["delivered", "cancelled"].indexOf(o.status) >= 0;
    return true;
  });
  if (FILTER === "done" || FILTER === "all") list = list.slice().reverse();
  if (!list.length) { $("#orderList").innerHTML = '<div class="empty-note">' + (FILTER === "action" ? "Nothing needs you right now." : "No orders here yet.") + "</div>"; return; }
  var html = "", last = "";
  list.forEach(function (o) {
    if (FILTER !== "action" && o.delivery_date !== last) { last = o.delivery_date; html += '<div class="daygroup">' + fmtDay(o.delivery_date) + "</div>"; }
    html += '<button class="ocard" type="button" data-id="' + o.id + '"><span><span class="ref">' + esc(o.ref) + '</span><br><span class="who">' + esc(o.customer_name) + '</span></span><span class="amt">' + money(o.total) + '<br><span class="when">' + fmtDay(o.delivery_date) + " · " + esc(o.slot) + "</span></span>" +
      '<span class="when" style="grid-column:1/-1">' + esc(o.firstItem || "") + (o.itemCount > 1 ? " + " + (o.itemCount - 1) + " more" : "") + "</span>" +
      '<span class="pills"><span class="pill ' + o.status + '">' + STATUS_L[o.status] + '</span><span class="pill ' + o.payment_status + '">' + PAY_L[o.payment_status] + "</span>" + (o.has_change ? '<span class="pill change">Change request</span>' : "") + "</span></button>";
  });
  $("#orderList").innerHTML = html;
}
$("#orderFilters").addEventListener("click", function (e) { var b = e.target.closest("[data-f]"); if (b) { FILTER = b.dataset.f; renderOrders(); } });
$("#orderList").addEventListener("click", function (e) { var b = e.target.closest("[data-id]"); if (b) openOrder(+b.dataset.id); });
$("#refresh").addEventListener("click", function () { loadOrders().then(function () { toast("Up to date"); }); });

function openOrder(id) {
  api("GET", "/api/admin/orders/" + id).then(function (o) { CUR = o; CUR.draftItems = JSON.parse(JSON.stringify(o.items)); renderOrder(); $("#drawer").hidden = false; $("#drawer").scrollTop = 0; document.body.style.overflow = "hidden"; })
    .catch(function (e) { toast(e.message); });
}
function closeOrder() { $("#drawer").hidden = true; document.body.style.overflow = ""; CUR = null; loadOrders(); }
$("#closeDrawer").addEventListener("click", closeOrder);
document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("#drawer").hidden) closeOrder(); });

function itemRows(items) {
  return items.map(function (it, i) {
    return '<div class="itemrow"><div class="field wide"><label for="in' + i + '">Item</label><input id="in' + i + '" data-item="' + i + '" data-f="name" value="' + esc(it.name) + '"></div>' +
      '<div class="field"><label for="iq' + i + '">Qty</label><input id="iq' + i + '" type="number" min="1" data-item="' + i + '" data-f="qty" value="' + esc(it.qty) + '"></div>' +
      '<div class="field"><label for="ip' + i + '">Price each</label><input id="ip' + i + '" type="number" step="0.5" min="0" data-item="' + i + '" data-f="price" value="' + (it.price == null ? "" : esc(it.price)) + '"></div>' +
      '<button class="del" type="button" data-delitem="' + i + '" aria-label="Remove ' + esc(it.name) + '">✕</button>' +
      '<div class="field wide" style="grid-column:1/-1"><label for="id' + i + '">Details (ingredients, decorations, words)</label><textarea id="id' + i + '" data-item="' + i + '" data-f="detail">' + esc(it.detail) + "</textarea></div></div>";
  }).join("");
}
function draftTotals() { var sub = P.subtotal(CUR.draftItems), fee = $("#dFee") ? ($("#dFee").value === "" ? null : +$("#dFee").value) : CUR.delivery_fee; return { sub: sub, fee: fee, total: sub != null && fee != null ? sub + fee : null }; }
function renderOrder() {
  var o = CUR, t = draftTotals();
  $("#dEyebrow").textContent = "Order " + o.ref + " · placed " + new Date(o.created_at).toLocaleDateString("en-SG", { day: "numeric", month: "short" });
  $("#dTitle").textContent = o.customer_name;
  var c = o.pending_change, changeBox = "";
  if (c) {
    var before = o.items.map(function (i) { return i.name + (i.qty > 1 ? " ×" + i.qty : "") + " (" + money(i.price) + ")"; }).join("; ");
    var after = c.items.map(function (i) { return i.name + (i.qty > 1 ? " ×" + i.qty : "") + " (" + money(i.price) + ")"; }).join("; ");
    changeBox = '<div class="box hot"><h3>Customer asked for a change</h3>' + (c.reason ? "<p><b>“" + esc(c.reason) + "”</b></p>" : "") +
      '<div class="diff"><span><b>Items now:</b> <del>' + esc(before) + '</del></span><span><b>Asked for:</b> <ins>' + esc(after) + "</ins></span>" +
      (c.delivery_date !== o.delivery_date || c.slot !== o.slot ? '<span><b>Date:</b> <del>' + fmtDay(o.delivery_date) + " " + esc(o.slot) + "</del> → <ins>" + fmtDay(c.delivery_date) + " " + esc(c.slot) + "</ins></span>" : "") +
      (c.address !== o.address ? '<span><b>Address:</b> <del>' + esc(o.address) + "</del> → <ins>" + esc(c.address) + "</ins></span>" : "") +
      '<span><b>New total:</b> ' + money(c.total) + " (was " + money(o.total) + ")</span></div>" +
      '<div class="row gap"><button class="primary" type="button" id="approveChange">Approve change</button><button class="secondary" type="button" id="declineChange">Decline</button></div></div>';
  }
  var proofs = o.proofs.length ? '<div class="proofs">' + o.proofs.map(function (p) { return '<a href="/api/admin/proofs/' + p.id + '" target="_blank" rel="noopener"><img src="/api/admin/proofs/' + p.id + '" alt="Payment screenshot sent ' + new Date(p.created_at).toLocaleString("en-SG") + '"></a>'; }).join("") + "</div>" : '<p class="small muted">No payment screenshot yet.</p>';
  var link = orderLink(o), first = o.customer_name.split(" ")[0];
  var msgs = [
    ["Confirm order", "Assalamualaikum " + first + "! Your order " + o.ref + " for " + fmtDay(o.delivery_date) + " is confirmed. Total " + money(t.total) + ". You can pay by PayNow on your order page: " + link],
    ["Payment received", "Hi " + first + ", payment for " + o.ref + " received. Thank you! " + link],
    ["Out for delivery", "Hi " + first + ", your bakes for " + o.ref + " are on the way!"],
    ["Ask a question", "Hi " + first + ", a quick question about your order " + o.ref + ": "]
  ];
  $("#dBody").innerHTML = changeBox +
    '<div class="box"><h3>Status</h3><div class="statusrow">' + STATUS.map(function (s) { return '<button class="chip" type="button" data-status="' + s[0] + '" aria-pressed="' + (o.status === s[0]) + '">' + s[1] + "</button>"; }).join("") + "</div>" +
    (o.status === "new" ? '<p class="small muted">Confirming locks the order for the customer (they can still ask for changes) and shows them the PayNow QR.</p>' : "") + "</div>" +
    '<div class="box"><h3>Payment · <span class="pill ' + o.payment_status + '">' + PAY_L[o.payment_status] + "</span></h3>" + proofs +
    '<div class="row gap"><button class="primary" type="button" data-pay="paid">Mark as paid</button>' + (o.payment_status !== "unpaid" ? '<button class="secondary" type="button" data-pay="unpaid">Not received</button>' : "") + "</div></div>" +
    '<div class="box"><h3>WhatsApp ' + esc(first) + '</h3><p class="small"><a href="' + esc(waLink(o.customer_phone, "")) + '" target="_blank" rel="noopener">' + esc(o.customer_phone) + '</a> · <a href="' + esc(link) + '" target="_blank" rel="noopener">customer’s order page</a></p><div class="wabtns">' +
      msgs.map(function (m) { return '<a href="' + esc(waLink(o.customer_phone, m[1])) + '" target="_blank" rel="noopener">' + esc(m[0]) + "</a>"; }).join("") + "</div></div>" +
    '<div class="box"><h3>Items</h3><div id="dItems" class="stack">' + itemRows(CUR.draftItems) + '</div><button class="addbtn" type="button" id="addItem">+ Add a line (extra, discount, etc.)</button>' +
      '<div class="fields two"><div class="field"><label for="dFee">Delivery fee</label><input id="dFee" type="number" step="0.5" min="0" value="' + (o.delivery_fee == null ? "" : o.delivery_fee) + '"></div><div class="field"><label>Total</label><input id="dTotal" value="' + money(t.total) + '" readonly></div></div></div>' +
    '<div class="box"><h3>Delivery</h3><div class="fields two"><div class="field"><label for="dDate">Date</label><input id="dDate" type="date" value="' + esc(o.delivery_date) + '"></div><div class="field"><label for="dSlot">Time slot</label><input id="dSlot" value="' + esc(o.slot) + '"></div></div>' +
      '<div class="field"><label for="dAddr">Address</label><input id="dAddr" value="' + esc(o.address) + '"></div>' +
      '<div class="fields two"><div class="field"><label for="dName">Customer name</label><input id="dName" value="' + esc(o.customer_name) + '"></div><div class="field"><label for="dPhone">Phone</label><input id="dPhone" value="' + esc(o.customer_phone) + '"></div></div>' +
      (o.customer_email ? '<p class="small"><b>Account:</b> ' + esc(o.customer_email) + "</p>" : "") +
      (o.notes ? '<p class="small"><b>Customer notes:</b> ' + esc(o.notes) + "</p>" : "") + "</div>" +
    '<div class="box"><h3>Notes</h3><div class="field"><label for="dNoteC">Note to customer (they see this on their order page)</label><textarea id="dNoteC" rows="2">' + esc(o.note_to_customer) + '</textarea></div>' +
      '<div class="field"><label for="dNoteA">Private note (only admins see this)</label><textarea id="dNoteA" rows="2">' + esc(o.admin_note) + "</textarea></div></div>" +
    '<button class="primary" type="button" id="saveOrder">Save changes</button>' +
    '<details class="history"><summary>History</summary><ul>' + o.events.map(function (e) { return "<li><b>" + esc(e.actor.replace("admin:", "")) + "</b> " + esc(e.message) + (e.visible ? "" : " <i>(private)</i>") + ' <span class="muted small">' + new Date(e.created_at).toLocaleString("en-SG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) + "</span></li>"; }).join("") + "</ul></details>";
}
function patch(body, msg) { return api("PATCH", "/api/admin/orders/" + CUR.id, body).then(function () { toast(msg || "Saved"); return openOrder(CUR.id); }).catch(function (e) { toast(e.message); }); }
$("#dBody").addEventListener("click", function (e) {
  var t = e.target, x;
  if ((x = t.closest("[data-status]"))) return patch({ status: x.dataset.status }, "Status: " + STATUS_L[x.dataset.status]);
  if ((x = t.closest("[data-pay]"))) return patch({ payment_status: x.dataset.pay }, x.dataset.pay === "paid" ? "Marked as paid" : "Marked as not received");
  if ((x = t.closest("[data-delitem]"))) { CUR.draftItems.splice(+x.dataset.delitem, 1); $("#dItems").innerHTML = itemRows(CUR.draftItems); $("#dTotal").value = money(draftTotals().total); return; }
  if (t.closest("#addItem")) { CUR.draftItems.push({ kind: "extra", name: "Extra", detail: "", qty: 1, price: 0, photo: "img/logo.png" }); $("#dItems").innerHTML = itemRows(CUR.draftItems); return; }
  if (t.closest("#approveChange")) return api("POST", "/api/admin/orders/" + CUR.id + "/change/approve", {}).then(function () { toast("Change approved"); openOrder(CUR.id); }).catch(function (er) { toast(er.message); });
  if (t.closest("#declineChange")) return api("POST", "/api/admin/orders/" + CUR.id + "/change/decline", { reason: "" }).then(function () { toast("Change declined"); openOrder(CUR.id); }).catch(function (er) { toast(er.message); });
  if (t.closest("#saveOrder")) {
    return patch({ items: CUR.draftItems, delivery_fee: $("#dFee").value === "" ? null : +$("#dFee").value, delivery_date: $("#dDate").value, slot: $("#dSlot").value,
      address: $("#dAddr").value, customer_name: $("#dName").value, customer_phone: $("#dPhone").value, note_to_customer: $("#dNoteC").value, admin_note: $("#dNoteA").value }, "Order saved");
  }
});
$("#dBody").addEventListener("input", function (e) {
  var x = e.target;
  if (x.dataset.item != null) { var it = CUR.draftItems[+x.dataset.item], f = x.dataset.f; it[f] = f === "qty" ? (parseInt(x.value, 10) || 1) : f === "price" ? (x.value === "" ? null : +x.value) : x.value; }
  if ($("#dTotal")) $("#dTotal").value = money(draftTotals().total);
});

/* ---------------- menu editor ---------------- */
var SECTIONS = [["shop", "Shop settings"], ["products", "Ready-made"], ["gallery", "Past designs"], ["cake", "Cake options"], ["decor", "Decorations & colours"], ["cupcakes", "Cupcakes"], ["words", "Wording"]];
function loadMenu() {
  if (CAT) { renderMenu(); return; }
  api("GET", "/api/catalog").then(function (c) { CAT = c; renderMenu(); }).catch(function (e) { toast(e.message); });
}
function dirty(v) { CAT_DIRTY = v; $("#menuDirty").textContent = v ? "Unsaved changes" : "No unsaved changes"; }
function getPath(path) { return path.split(".").reduce(function (o, k) { return o == null ? o : o[k]; }, CAT); }
function setPath(path, val) { var ks = path.split("."), last = ks.pop(), o = ks.reduce(function (o, k) { return o[k]; }, CAT); o[last] = val; }
function inp(path, label, type, extra) {
  var v = getPath(path), id = "m_" + path.replace(/\W/g, "_");
  if (type === "check") return '<label class="chk"><input type="checkbox" data-path="' + path + '"' + (v !== false ? " checked" : "") + "> " + esc(label) + "</label>";
  if (type === "color") return '<div class="field"><label for="' + id + '">' + esc(label) + '</label><input class="colorin" id="' + id + '" type="color" data-path="' + path + '" value="' + esc(v || "#FFFFFF") + '"></div>';
  if (type === "select") return '<div class="field"><label for="' + id + '">' + esc(label) + '</label><select id="' + id + '" data-path="' + path + '">' + extra.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(v) === String(o[0]) ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select></div>";
  if (type === "area") return '<div class="field grow"><label for="' + id + '">' + esc(label) + '</label><textarea id="' + id + '" data-path="' + path + '" rows="2">' + esc(v) + "</textarea></div>";
  return '<div class="field' + (type === "text" ? " grow" : "") + '"><label for="' + id + '">' + esc(label) + '</label><input id="' + id + '" data-path="' + path + '" data-type="' + (type || "text") + '"' + (type === "number" ? ' type="number" step="0.5" min="0"' : "") + ' value="' + esc(v == null ? "" : v) + '"></div>';
}
function listInp(path, label, hint) { var v = (getPath(path) || []).join(", "); var id = "m_" + path.replace(/\W/g, "_"); return '<div class="field"><label for="' + id + '">' + esc(label) + (hint ? ' <span class="muted">(' + esc(hint) + ")</span>" : "") + '</label><input id="' + id + '" data-list="' + path + '" value="' + esc(v) + '"></div>'; }
function del(path, i) { return '<button class="del" type="button" data-del="' + path + '" data-i="' + i + '" aria-label="Remove">✕</button>'; }
function photo(path) { var v = getPath(path); return '<div class="photoedit"><img src="' + esc(v || "img/logo.png") + '" alt=""><label class="addbtn" style="display:inline-flex;align-items:center;cursor:pointer"><input type="file" accept="image/*" data-photo="' + path + '" hidden>Change photo</label></div>'; }
function optionRows(path, fields, newItem, addLabel) {
  var list = getPath(path) || [];
  return list.map(function (o, i) {
    return '<div class="mrow' + (o.active === false ? " off" : "") + '">' + fields.map(function (f) { return inp(path + "." + i + "." + f[0], f[1], f[2], f[3]); }).join("") +
      (o.active !== undefined ? inp(path + "." + i + ".active", "On", "check") : "") + del(path, i) + "</div>";
  }).join("") + '<button class="addbtn" type="button" data-add="' + path + '" data-new=\'' + esc(JSON.stringify(newItem)) + "'>+ " + esc(addLabel) + "</button>";
}
function renderMenu() {
  $("#menuSections").innerHTML = SECTIONS.map(function (s) { return '<button class="chip" type="button" data-sec="' + s[0] + '" aria-pressed="' + (SECTION === s[0]) + '">' + s[1] + "</button>"; }).join("");
  var B = CAT.builder, h = "";
  var sizesOpts = B.sizes.map(function (s) { return [s.id, s.label]; }), pick = function (list) { return list.map(function (s) { return [s.id, s.label]; }); };
  if (SECTION === "shop") {
    h = '<div class="mcard"><h3>Shop</h3><div class="mgrid">' + inp("shop.whatsapp", "Ain’s WhatsApp (digits)") + inp("shop.leadDays.ready", "Days’ notice: ready-made", "number") + inp("shop.leadDays.custom", "Days’ notice: custom", "number") + "</div>" +
      inp("shop.showPrices", "Show prices to customers", "check") + "</div>" +
      '<div class="mcard"><h3>Delivery</h3><div class="mgrid">' + inp("shop.delivery.fee", "Delivery fee", "number") + inp("shop.delivery.freeAbove", "Free delivery from", "number") + "</div>" + inp("shop.delivery.note", "Delivery note shown to customers", "text") + listInp("shop.slots", "Time slots", "comma between each") + "</div>" +
      '<div class="mcard"><h3>Closed or fully booked days</h3>' + listInp("shop.closedDates", "Dates", "YYYY-MM-DD, comma between each") + "</div>";
  }
  if (SECTION === "products") {
    h = CAT.products.map(function (p, i) {
      var base = "products." + i;
      return '<div class="mcard' + (p.active === false ? " off" : "") + '"><h3>' + esc(p.name) + del("products", i) + "</h3>" + photo(base + ".photo") +
        '<div class="mgrid">' + inp(base + ".name", "Name", "text") + inp(base + ".tag", "Sticker", "text") + inp(base + ".cat", "Category", "select", CAT.categories.map(function (c) { return [c.id, c.label]; })) + "</div>" +
        inp(base + ".desc", "Description", "area") +
        '<b class="small">Sizes / boxes and prices</b>' + optionRows(base + ".options", [["label", "Option", "text"], ["note", "Serves / note", "text"], ["price", "Price", "number"]], { label: "New option", note: "", price: 0 }, "Add option") +
        '<div class="row gap">' + inp(base + ".plaque", "Offers message plaque + candles", "check") + inp(base + ".active", "On sale", "check") + "</div>" +
        listInp(base + ".occasions", "Occasions", CAT.occasions.map(function (o) { return o.id; }).join(", ")) + "</div>";
    }).join("") + '<button class="addbtn" type="button" data-add="products" data-new=\'' + esc(JSON.stringify({ id: "", active: true, cat: "cakes", name: "New bake", tag: "", photo: "img/logo.png", desc: "", options: [{ label: '6"', note: "", price: 0 }], plaque: true, occasions: ["any"] })) + "'>+ Add a ready-made bake</button>";
  }
  if (SECTION === "gallery") {
    h = CAT.gallery.map(function (g, i) {
      var base = "gallery." + i, pr = base + ".preset"; g.preset = g.preset || { type: "cake" };
      return '<div class="mcard' + (g.active === false ? " off" : "") + '"><h3>' + esc(g.name) + del("gallery", i) + "</h3>" + photo(base + ".photo") +
        '<div class="mgrid">' + inp(base + ".name", "Name", "text") + inp(base + ".meta", "Short line", "text") + inp(base + ".theme", "Filter", "select", CAT.galleryThemes.map(function (t) { return [t.id, t.label]; })) + "</div>" +
        '<b class="small">Starts the builder with</b><div class="mgrid">' + inp(pr + ".type", "Type", "select", [["cake", "Cake"], ["cupcakes", "Cupcakes"], ["both", "Cake + cupcakes"]]) +
        inp(pr + ".size", "Cake size", "select", [["", "–"]].concat(sizesOpts)) + inp(pr + ".sponge", "Sponge", "select", [["", "–"]].concat(pick(B.sponges))) + inp(pr + ".filling", "Filling", "select", [["", "–"]].concat(pick(B.fillings))) +
        inp(pr + ".palette", "Colours", "select", [["", "–"]].concat(pick(B.palettes))) + inp(pr + ".themeText", "Theme", "text") + "</div>" +
        listInp(pr + ".decor", "Decorations", "names, comma between each") + inp(base + ".active", "Show in gallery", "check") + "</div>";
    }).join("") + '<button class="addbtn" type="button" data-add="gallery" data-new=\'' + esc(JSON.stringify({ id: "", active: true, name: "New design", meta: "", photo: "img/logo.png", theme: "classic", preset: { type: "cake", size: "6", decor: [] } })) + "'>+ Add a past design</button>";
  }
  if (SECTION === "cake") {
    h = '<div class="mcard"><h3>Sizes (base price)</h3>' + optionRows("builder.sizes", [["label", "Size", "text"], ["note", "Serves", "text"], ["price", "Price", "number"]], { label: '9"', note: "", price: 0, active: true }, "Add size") + "</div>" +
      '<div class="mcard"><h3>Sponges</h3>' + optionRows("builder.sponges", [["label", "Sponge", "text"], ["price", "Extra", "number"], ["color", "Colour (3D)", "color"]], { label: "New sponge", price: 0, color: "#F3DDA8", active: true }, "Add sponge") + "</div>" +
      '<div class="mcard"><h3>Fillings &amp; frostings</h3>' + optionRows("builder.fillings", [["label", "Filling", "text"], ["price", "Extra", "number"]], { label: "New filling", price: 0, active: true }, "Add filling") + "</div>" +
      '<div class="mcard"><h3>Finishes</h3>' + optionRows("builder.finishes", [["label", "Finish", "text"], ["price", "Extra", "number"], ["look", "Looks like (3D)", "select", [["buttercream", "Buttercream"], ["freshcream", "Fresh cream"], ["fondant", "Fondant"], ["naked", "Naked"]]]], { label: "New finish", price: 0, look: "buttercream", active: true }, "Add finish") + "</div>" +
      '<div class="mcard"><h3>Tiers</h3>' + optionRows("builder.tiers", [["label", "Tiers", "text"], ["price", "Extra", "number"]], { label: "3 tiers", price: 0, active: true }, "Add tier option") + "</div>" +
      '<div class="mcard"><h3>Shapes</h3>' + optionRows("builder.shapes", [["label", "Shape", "text"], ["price", "Extra", "number"]], { label: "New shape", price: 0, active: true }, "Add shape") + "</div>";
  }
  if (SECTION === "decor") {
    h = '<div class="mcard"><h3>Decorations</h3><p class="small muted">“Per cupcake” prices apply when decorating cupcakes.</p>' +
      (B.decorations.map(function (d, i) { d.perCupcake = d.perCupcake || {}; return ""; }).join("")) +
      optionRows("builder.decorations", [["label", "Decoration", "text"], ["price", "Cake price", "number"], ["perCupcake.Regular", "Per regular", "number"], ["perCupcake.Mini", "Per mini", "number"], ["look", "3D", "select", [["none", "No preview"], ["toppers", "Toppers"], ["plaque", "Plaque"], ["candles", "Candles"], ["sprinkles", "Sprinkles"], ["candy", "Candy"], ["flowers", "Flowers"], ["drip", "Drip"], ["gold", "Gold beads"]]]], { label: "New decoration", price: 0, perCupcake: {}, look: "none", active: true }, "Add decoration") + "</div>" +
      '<div class="mcard"><h3>Colour palettes</h3>' + optionRows("builder.palettes", [["label", "Name", "text"], ["frost", "Frosting", "color"], ["trim", "Trim", "color"], ["accent", "Accent", "color"], ["drip", "Drip", "color"]], { label: "New palette", frost: "#FFFFFF", trim: "#F2C66D", accent: "#A84D2E", drip: "#3B2418", active: true }, "Add palette") + "</div>";
  }
  if (SECTION === "cupcakes") {
    h = B.cupcakeSizes.map(function (cs, i) {
      var base = "builder.cupcakeSizes." + i;
      return '<div class="mcard' + (cs.active === false ? " off" : "") + '"><h3>' + esc(cs.label) + " cupcakes</h3>" + '<div class="mgrid">' + inp(base + ".label", "Name", "text") + inp(base + ".note", "Note", "text") + "</div>" +
        '<b class="small">Box sizes and prices</b>' + optionRows(base + ".counts", [["n", "How many", "number"], ["price", "Price", "number"]], { n: 36, price: 0 }, "Add box size") + inp(base + ".active", "On sale", "check") + "</div>";
    }).join("");
  }
  if (SECTION === "words") {
    h = '<div class="mcard"><h3>Wording customers can pick</h3>' + listInp("plaques", "Plaque messages (ready-made)", "comma between each") + listInp("builder.greetings", "Greetings (custom cakes)", "comma between each") + listInp("builder.diets", "Dietary requests", "comma between each") + "</div>" +
      (ME && ME.role === "owner" ? '<div class="mcard"><h3>Start over</h3><p class="small muted">Puts the whole menu back to the original version. Orders aren’t affected.</p><button class="secondary" type="button" id="resetMenu">Reset menu to original</button></div>' : "");
  }
  $("#menuBody").innerHTML = h;
}
$("#menuSections").addEventListener("click", function (e) { var b = e.target.closest("[data-sec]"); if (b) { SECTION = b.dataset.sec; renderMenu(); } });
$("#menuBody").addEventListener("input", function (e) {
  var x = e.target;
  if (x.dataset.path) {
    var v = x.type === "checkbox" ? x.checked : x.dataset.type === "number" ? (x.value === "" ? null : +x.value) : x.value;
    var parts = x.dataset.path.split("."); if (parts[parts.length - 2] === "perCupcake") { var host = getPath(parts.slice(0, -1).join(".")); if (!host) setPath(parts.slice(0, -1).join("."), {}); }
    setPath(x.dataset.path, v); dirty(true);
    if (x.type === "checkbox") { var card = x.closest(".mrow, .mcard"); if (card && /\.active$/.test(x.dataset.path)) card.classList.toggle("off", !x.checked); }
  }
  if (x.dataset.list) { setPath(x.dataset.list, x.value.split(",").map(function (s) { return s.trim(); }).filter(Boolean)); dirty(true); }
});
$("#menuBody").addEventListener("change", function (e) {
  var x = e.target;
  if (x.tagName === "SELECT" && x.dataset.path) { setPath(x.dataset.path, x.value); dirty(true); }
  if (x.dataset.photo && x.files[0]) {
    shrink(x.files[0], 1400).then(function (data) { return api("POST", "/api/admin/images", { image: data }); })
      .then(function (r) { setPath(x.dataset.photo, r.url); dirty(true); renderMenu(); toast("Photo added. Save the menu to publish it."); }).catch(function (er) { toast(er.message); });
  }
});
$("#menuBody").addEventListener("click", function (e) {
  var t = e.target, x;
  if ((x = t.closest("[data-del]"))) { var list = getPath(x.dataset.del); list.splice(+x.dataset.i, 1); dirty(true); renderMenu(); return; }
  if ((x = t.closest("[data-add]"))) { getPath(x.dataset.add).push(JSON.parse(x.dataset.new)); dirty(true); renderMenu(); toast("Added at the bottom"); return; }
  if (t.closest("#resetMenu")) {
    var b = t.closest("#resetMenu"); if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = "Tap again to reset everything"; return; }
    api("POST", "/api/admin/catalog/reset", {}).then(function () { CAT = null; dirty(false); toast("Menu reset"); loadMenu(); }).catch(function (er) { toast(er.message); });
  }
});
function slug(s) { return String(s || "item").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "item"; }
$("#saveMenu").addEventListener("click", function () {
  CAT.products.forEach(function (p) { if (!p.id) p.id = slug(p.name) + "-" + Math.random().toString(36).slice(2, 6); });
  CAT.gallery.forEach(function (g) { if (!g.id) g.id = slug(g.name) + "-" + Math.random().toString(36).slice(2, 6); });
  ["sizes", "tiers", "shapes", "sponges", "fillings", "finishes", "palettes", "decorations", "cupcakeSizes"].forEach(function (k) {
    CAT.builder[k].forEach(function (o) { if (o.id == null || o.id === "") o.id = k === "sizes" ? String(o.label).replace(/\D/g, "") || slug(o.label) : String(o.label); });
  });
  api("PUT", "/api/admin/catalog", CAT).then(function () { dirty(false); toast("Menu saved. Customers see it now."); }).catch(function (e) { toast(e.message); });
});
function shrink(file, max) {
  return new Promise(function (res, rej) {
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function () { var s = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", 0.85)); };
    img.onerror = function () { rej(new Error("That file isn’t a photo we can read.")); };
    img.src = url;
  });
}
window.addEventListener("beforeunload", function (e) { if (CAT_DIRTY) { e.preventDefault(); e.returnValue = ""; } });

/* ---------------- customers ---------------- */
var CUSTS = [];
function loadCustomers() { api("GET", "/api/admin/customers").then(function (rows) { CUSTS = rows; renderCustomers(); }).catch(function (e) { toast(e.message); }); }
function renderCustomers() {
  var term = $("#custSearch").value.trim().toLowerCase();
  var list = CUSTS.filter(function (c) { return !term || (c.name + " " + c.email + " " + c.phone).toLowerCase().indexOf(term) >= 0; });
  $("#custList").innerHTML = list.length ? list.map(function (c) {
    return '<div class="adminrow custrow"><span><b>' + esc(c.name || c.email) + "</b><small>" + esc(c.email) + (c.phone ? " · " + esc(c.phone) : "") + "</small>" +
      "<small>" + c.orders + " order" + (c.orders === 1 ? "" : "s") + (c.spent ? " · " + money(c.spent) : "") + " · " + (c.google ? "Google" : "") + (c.google && c.has_password ? " + " : "") + (c.has_password ? "password" : "") + "</small>" +
      '<span class="newpw" id="pw' + c.id + '"></span></span>' +
      '<button class="secondary small-btn" type="button" data-resetpw="' + c.id + '">New password</button></div>';
  }).join("") : '<div class="empty-note">' + (CUSTS.length ? "No match." : "No customer accounts yet.") + "</div>";
}
$("#custSearch").addEventListener("input", renderCustomers);
$("#custList").addEventListener("click", function (e) {
  var b = e.target.closest("[data-resetpw]"); if (!b) return;
  if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = "Tap again to reset"; return; }
  var c = CUSTS.filter(function (x) { return String(x.id) === b.dataset.resetpw; })[0];
  api("POST", "/api/admin/customers/" + c.id + "/reset-password", {}).then(function (r) {
    b.textContent = "New password"; delete b.dataset.sure;
    var msg = "Assalamualaikum " + (c.name || "").split(" ")[0] + "! Your new password for The Saif’s Bakery is " + r.password + " . Sign in at " + location.origin + "/#account with " + c.email + " and change it under Your details.";
    $("#pw" + c.id).innerHTML = 'New password: <b>' + esc(r.password) + "</b>" + (c.phone ? ' · <a href="' + esc(waLink(c.phone, msg)) + '" target="_blank" rel="noopener">Send on WhatsApp</a>' : "");
  }).catch(function (er) { toast(er.message); });
});

/* ---------------- website: pages, texts, colours ---------------- */
var SITE = null, SITE_DIRTY = false, SITE_SEC = "pages", PAGE_OPEN = null, TEXT_DEFS = null;
var DYNAMIC_TEXTS = [["cart.empty", "Your basket is empty."], ["cart.add-more", "Add more"], ["cart.choose-date", "Choose a date"],
  ["account.signin-title", "Welcome back"], ["account.signup-title", "Create your account"], ["account.lede", "Track your orders, pay by PayNow and reorder faster."],
  ["account.lede-checkout", "Sign in or create an account to place your order. Your basket is saved."], ["custom.photo-hint", "Ain will bake it with your changes"], ["page.missing", "That page isn’t here any more."]];
var BLOCKS = { heading: "Heading", text: "Paragraph", image: "Photo", button: "Button" };
function siteDirty(v) { SITE_DIRTY = v; $("#siteDirty").textContent = v ? "Unsaved changes" : "No unsaved changes"; }
function loadSite() {
  if (SITE) { renderSite(); return; }
  Promise.all([api("GET", "/api/site"), TEXT_DEFS ? null : fetch("/", { credentials: "same-origin" }).then(function (r) { return r.text(); })]).then(function (r) {
    SITE = { text: r[0].text || {}, theme: r[0].theme || {}, pages: r[0].pages || [] };
    if (r[1]) {
      var doc = new DOMParser().parseFromString(r[1], "text/html"), defs = [], seen = {};
      $$("[data-hero]", doc).forEach(function (ln) { var k = "home.hero.l" + ln.getAttribute("data-hero"); defs.push([k, ln.textContent.replace(/\s+/g, " ").trim(), "Home: big headline line " + ln.getAttribute("data-hero")]); seen[k] = 1; });
      $$("[data-t]", doc).forEach(function (el) { var k = el.getAttribute("data-t"); if (seen[k]) return; seen[k] = 1; defs.push([k, el.textContent.trim(), ""]); });
      DYNAMIC_TEXTS.forEach(function (d) { if (!seen[d[0]]) defs.push([d[0], d[1], ""]); });
      TEXT_DEFS = defs;
    }
    renderSite();
  }).catch(function (e) { toast(e.message); });
}
var AREA = { header: "Header", home: "Home", shop: "Shop", gallery: "Custom designs", custom: "Cake builder", cart: "Basket", date: "Delivery date", send: "Review & place order", account: "Sign in & account", foot: "Footer", nav: "Menu bar", page: "Pages" };
function renderSite() {
  $("#siteSections").innerHTML = [["pages", "Pages"], ["texts", "All texts"], ["colours", "Colours"]].map(function (s) { return '<button class="chip" type="button" data-ssec="' + s[0] + '" aria-pressed="' + (SITE_SEC === s[0]) + '">' + s[1] + "</button>"; }).join("");
  var h = "";
  if (SITE_SEC === "pages") {
    if (PAGE_OPEN != null && SITE.pages[PAGE_OPEN]) h = pageEditor(SITE.pages[PAGE_OPEN], PAGE_OPEN);
    else {
      h = SITE.pages.map(function (p, i) {
        return '<div class="adminrow"><span><b>' + esc(p.title) + "</b><small>/#page/" + esc(p.slug) + " · " + (p.published ? "Published" : "Draft") + (p.nav ? " · in menu" : "") + " · " + p.blocks.length + " blocks</small></span>" +
          '<span class="row gap"><a class="secondary small-btn" href="/#page/' + esc(p.slug) + '" target="_blank" rel="noopener">View</a><button class="primary small-btn" type="button" data-openpage="' + i + '">Edit</button></span></div>';
      }).join("") || '<div class="empty-note">No extra pages yet. Add an About page, FAQ, or a seasonal menu.</div>';
      h += '<button class="addbtn" type="button" id="addPage">+ New page</button>';
    }
  }
  if (SITE_SEC === "texts") {
    h = '<div class="field"><label for="textSearch">Find a text</label><input id="textSearch" type="search" placeholder="e.g. squeal, Order, Delivery"></div><div id="textList" class="stack"></div>';
  }
  if (SITE_SEC === "colours") {
    var defs = { accent: "#A84D2E", butter: "#F2C66D", bg: "#FBF5EC", ink: "#3B2A20" };
    h = '<div class="mcard"><h3>Colours</h3><p class="small muted">These change the whole shop: buttons, highlights, background and text. Keep text dark on a light background so it stays easy to read.</p><div class="mgrid">' +
      [["accent", "Buttons & accents"], ["butter", "Highlight"], ["bg", "Background"], ["ink", "Text & outlines"]].map(function (c) {
        return '<div class="field"><label for="col_' + c[0] + '">' + c[1] + '</label><input class="colorin" id="col_' + c[0] + '" type="color" data-scol="' + c[0] + '" value="' + esc(SITE.theme[c[0]] || defs[c[0]]) + '"></div>'; }).join("") +
      '</div><button class="secondary" type="button" id="resetCols">Back to original colours</button>' +
      '<div class="colprev" style="--a:' + esc(SITE.theme.accent || defs.accent) + ";--b:" + esc(SITE.theme.butter || defs.butter) + ";--g:" + esc(SITE.theme.bg || defs.bg) + ";--i:" + esc(SITE.theme.ink || defs.ink) + '"><b>Cakes that make them <mark>squeal.</mark></b><span class="pbtn">Design my cake</span></div></div>';
  }
  $("#siteBody").innerHTML = h;
  if (SITE_SEC === "texts") renderTexts();
}
function pageEditor(p, i) {
  var b = p.blocks.map(function (bl, k) {
    var f = "";
    if (bl.t === "heading") f = '<div class="field"><label for="bk' + k + '">Heading</label><input id="bk' + k + '" data-bk="' + k + '" data-bf="text" value="' + esc(bl.text) + '"></div>';
    if (bl.t === "text") f = '<div class="field"><label for="bk' + k + '">Paragraph <span class="muted">(**two stars** = bold)</span></label><textarea id="bk' + k + '" rows="4" data-bk="' + k + '" data-bf="text">' + esc(bl.text) + "</textarea></div>";
    if (bl.t === "image") f = '<div class="photoedit"><img src="' + esc(bl.src || "img/logo.png") + '" alt=""><label class="addbtn" style="display:inline-flex;align-items:center;cursor:pointer"><input type="file" accept="image/*" data-bkphoto="' + k + '" hidden>' + (bl.src ? "Change photo" : "Choose photo") + "</label></div>" +
      '<div class="fields two"><div class="field"><label for="bka' + k + '">Describe the photo (for screen readers)</label><input id="bka' + k + '" data-bk="' + k + '" data-bf="alt" value="' + esc(bl.alt) + '"></div><div class="field"><label for="bkc' + k + '">Caption (optional)</label><input id="bkc' + k + '" data-bk="' + k + '" data-bf="caption" value="' + esc(bl.caption) + '"></div></div>';
    if (bl.t === "button") f = '<div class="fields two"><div class="field"><label for="bk' + k + '">Button text</label><input id="bk' + k + '" data-bk="' + k + '" data-bf="text" value="' + esc(bl.text) + '"></div><div class="field"><label for="bkh' + k + '">Goes to</label><select id="bkh' + k + '" data-bk="' + k + '" data-bf="href">' + linkOptions(bl.href) + "</select></div></div>";
    return '<div class="mcard blockcard"><h3><span class="pill">' + BLOCKS[bl.t] + '</span><span class="row gap"><button class="del" type="button" data-bmove="' + k + '" data-dir="-1" aria-label="Move up"' + (k === 0 ? " disabled" : "") + '>↑</button><button class="del" type="button" data-bmove="' + k + '" data-dir="1" aria-label="Move down"' + (k === p.blocks.length - 1 ? " disabled" : "") + '>↓</button><button class="del" type="button" data-bdel="' + k + '" aria-label="Remove block">✕</button></span></h3>' + f + "</div>";
  }).join("");
  return '<div class="row"><button class="secondary small-btn" type="button" id="backPages">← All pages</button><a class="secondary small-btn" href="/#page/' + esc(p.slug) + '" target="_blank" rel="noopener">View page</a></div>' +
    '<div class="mcard"><div class="fields two"><div class="field"><label for="pTitle">Page title</label><input id="pTitle" data-pf="title" value="' + esc(p.title) + '"></div>' +
    '<div class="field"><label for="pSlug">Web address</label><input id="pSlug" data-pf="slug" value="' + esc(p.slug) + '"><small class="muted">saifbakery…/#page/' + esc(p.slug) + "</small></div></div>" +
    '<div class="row gap"><label class="chk"><input type="checkbox" data-pf="published"' + (p.published ? " checked" : "") + '> Published (customers can see it)</label><label class="chk"><input type="checkbox" data-pf="nav"' + (p.nav ? " checked" : "") + "> Show in the footer and home page</label></div></div>" +
    b + '<div class="row gap addblocks">' + Object.keys(BLOCKS).map(function (k) { return '<button class="addbtn" type="button" data-addblock="' + k + '">+ ' + BLOCKS[k] + "</button>"; }).join("") + "</div>" +
    '<button class="secondary" type="button" id="delPage" style="align-self:flex-start;color:#9A4A3A">Delete this page</button>';
}
function linkOptions(cur) {
  var opts = [["#home", "Home"], ["#shop", "Ready-made shop"], ["#gallery", "Custom cake designs"], ["#cart", "Basket"], ["#account", "Sign in / account"]].concat(SITE.pages.map(function (p) { return ["#page/" + p.slug, "Page: " + p.title]; }));
  var wa = "https://wa.me/" + String((CAT && CAT.shop && CAT.shop.whatsapp) || "6580142315").replace(/\D/g, "");
  opts.push([wa, "WhatsApp Ain"], ["https://instagram.com/bake.withthesaifs", "Instagram"]);
  if (cur && !opts.some(function (o) { return o[0] === cur; })) opts.push([cur, cur]);
  return opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === cur ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("");
}
function renderTexts() {
  var term = ($("#textSearch") && $("#textSearch").value.trim().toLowerCase()) || "";
  var list = (TEXT_DEFS || []).filter(function (d) { var v = SITE.text[d[0]] || ""; return !term || (d[1] + " " + v + " " + d[0]).toLowerCase().indexOf(term) >= 0; });
  var last = "", h = "";
  list.forEach(function (d) {
    var area = d[0].split(".")[0];
    if (area !== last) { last = area; h += '<div class="daygroup">' + esc(AREA[area] || area) + "</div>"; }
    var v = SITE.text[d[0]], changed = v != null;
    h += '<div class="textrow' + (changed ? " changed" : "") + '"><label for="tx_' + esc(d[0]) + '">' + esc(d[2] || ("Was: " + d[1])) + "</label>" +
      '<div class="row gap"><textarea id="tx_' + esc(d[0]) + '" rows="' + (d[1].length > 60 ? 2 : 1) + '" data-tkey="' + esc(d[0]) + '" placeholder="' + esc(d[1]) + '">' + esc(changed ? v : d[1]) + "</textarea>" +
      (changed ? '<button class="del" type="button" data-treset="' + esc(d[0]) + '" aria-label="Back to the original text">↺</button>' : "") + "</div></div>";
  });
  $("#textList").innerHTML = h || '<div class="empty-note">No text matches.</div>';
}
$("#siteSections").addEventListener("click", function (e) { var b = e.target.closest("[data-ssec]"); if (b) { SITE_SEC = b.dataset.ssec; PAGE_OPEN = null; renderSite(); } });
$("#siteBody").addEventListener("input", function (e) {
  var x = e.target;
  if (x.id === "textSearch") { renderTexts(); return; }
  if (x.dataset.tkey) { var def = (TEXT_DEFS.filter(function (d) { return d[0] === x.dataset.tkey; })[0] || [])[1]; if (x.value.trim() === "" || x.value === def) delete SITE.text[x.dataset.tkey]; else SITE.text[x.dataset.tkey] = x.value; x.closest(".textrow").classList.toggle("changed", x.dataset.tkey in SITE.text); siteDirty(true); return; }
  if (x.dataset.scol) { SITE.theme[x.dataset.scol] = x.value; var pv = $(".colprev"); if (pv) pv.style.setProperty({ accent: "--a", butter: "--b", bg: "--g", ink: "--i" }[x.dataset.scol], x.value); siteDirty(true); return; }
  var p = SITE.pages[PAGE_OPEN]; if (!p) return;
  if (x.dataset.pf) { p[x.dataset.pf] = x.type === "checkbox" ? x.checked : (x.dataset.pf === "slug" ? x.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-") : x.value); siteDirty(true); return; }
  if (x.dataset.bk) { p.blocks[+x.dataset.bk][x.dataset.bf] = x.value; siteDirty(true); }
});
$("#siteBody").addEventListener("change", function (e) {
  var x = e.target, p = SITE.pages[PAGE_OPEN];
  if (x.tagName === "SELECT" && x.dataset.bk && p) { p.blocks[+x.dataset.bk].href = x.value; siteDirty(true); }
  if (x.type === "checkbox" && x.dataset.pf && p) { p[x.dataset.pf] = x.checked; siteDirty(true); }
  if (x.dataset.bkphoto && x.files[0] && p) {
    shrink(x.files[0], 1600).then(function (data) { return api("POST", "/api/admin/images", { image: data }); })
      .then(function (r) { p.blocks[+x.dataset.bkphoto].src = r.url; siteDirty(true); renderSite(); toast("Photo added. Save the website to publish it."); }).catch(function (er) { toast(er.message); });
  }
});
$("#siteBody").addEventListener("click", function (e) {
  var t = e.target, x, p = SITE.pages[PAGE_OPEN];
  if ((x = t.closest("[data-treset]"))) { delete SITE.text[x.dataset.treset]; siteDirty(true); renderTexts(); return; }
  if (t.closest("#resetCols")) { SITE.theme = {}; siteDirty(true); renderSite(); return; }
  if ((x = t.closest("[data-openpage]"))) { PAGE_OPEN = +x.dataset.openpage; renderSite(); return; }
  if (t.closest("#backPages")) { PAGE_OPEN = null; renderSite(); return; }
  if (t.closest("#addPage")) {
    var n = 1; while (SITE.pages.some(function (q) { return q.slug === "new-page-" + n; })) n++;
    SITE.pages.push({ slug: "new-page-" + n, title: "New page", nav: true, published: false, blocks: [{ t: "heading", text: "A heading" }, { t: "text", text: "" }] });
    PAGE_OPEN = SITE.pages.length - 1; siteDirty(true); renderSite(); var ti = $("#pTitle"); if (ti) { ti.focus(); ti.select(); } return;
  }
  if (!p) return;
  if ((x = t.closest("[data-addblock]"))) { var bt = x.dataset.addblock; p.blocks.push(bt === "image" ? { t: "image", src: "", alt: "", caption: "" } : bt === "button" ? { t: "button", text: "Order a cake", href: "#gallery" } : { t: bt, text: "" }); siteDirty(true); renderSite(); return; }
  if ((x = t.closest("[data-bdel]"))) { p.blocks.splice(+x.dataset.bdel, 1); siteDirty(true); renderSite(); return; }
  if ((x = t.closest("[data-bmove]"))) { var k = +x.dataset.bmove, d = +x.dataset.dir, tmp = p.blocks[k]; p.blocks[k] = p.blocks[k + d]; p.blocks[k + d] = tmp; siteDirty(true); renderSite(); return; }
  if (t.closest("#delPage")) {
    if (!t.dataset.sure) { t.dataset.sure = 1; t.textContent = "Tap again to delete the page"; return; }
    SITE.pages.splice(PAGE_OPEN, 1); PAGE_OPEN = null; siteDirty(true); renderSite();
  }
});
$("#saveSite").addEventListener("click", function () {
  var missing = SITE.pages.some(function (p) { return p.blocks.some(function (b) { return b.t === "image" && !b.src; }); });
  api("PUT", "/api/admin/site", SITE).then(function (d) {
    SITE = { text: d.text, theme: d.theme, pages: d.pages }; if (PAGE_OPEN != null && !SITE.pages[PAGE_OPEN]) PAGE_OPEN = null;
    siteDirty(false); renderSite(); toast(missing ? "Saved. Photo blocks without a photo were left out." : "Website saved. Customers see it now.");
  }).catch(function (e) { toast(e.message); });
});
window.addEventListener("beforeunload", function (e) { if (SITE_DIRTY) { e.preventDefault(); e.returnValue = ""; } });

/* ---------------- admins ---------------- */
function loadAdmins() {
  api("GET", "/api/admin/admins").then(function (rows) {
    $("#adminList").innerHTML = rows.map(function (a) {
      return '<div class="adminrow"><span><b>' + esc(a.name || a.email) + "</b><small>" + esc(a.email) + " · " + (a.role === "owner" ? "Owner" : "Admin") + "</small></span>" +
        (ME.role === "owner" && a.email !== ME.email ? '<button class="del" type="button" data-rmadmin="' + esc(a.email) + '" aria-label="Remove ' + esc(a.email) + '">✕</button>' : "") + "</div>";
    }).join("");
    $("#addAdmin").hidden = ME.role !== "owner";
  }).catch(function (e) { toast(e.message); });
}
$("#adminList").addEventListener("click", function (e) {
  var b = e.target.closest("[data-rmadmin]"); if (!b) return;
  if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = "Remove?"; b.style.minWidth = "84px"; return; }
  api("DELETE", "/api/admin/admins/" + encodeURIComponent(b.dataset.rmadmin)).then(function () { toast("Removed"); loadAdmins(); }).catch(function (er) { toast(er.message); });
});
$("#addAdmin").addEventListener("submit", function (e) {
  e.preventDefault();
  api("POST", "/api/admin/admins", { email: $("#newEmail").value, role: $("#newRole").value }).then(function () { $("#newEmail").value = ""; toast("Added. They can sign in with Google now."); loadAdmins(); }).catch(function (er) { toast(er.message); });
});

/* ---------------- boot ---------------- */
api("GET", "/api/admin/me").then(function (me) {
  ME = me; $("#signin").hidden = true; $("#app").hidden = false; $("#signOut").hidden = false;
  if (location.search) history.replaceState(null, "", "/admin.html" + location.hash);
  var startTab = document.querySelector('.admintabs [data-tab="' + location.hash.slice(1) + '"]');
  if (startTab && location.hash !== "#orders") startTab.click(); else loadOrders();
  setInterval(function () { if ($("#drawer").hidden && !$("#tab-orders").hidden) loadOrders(); }, 60000);
}).catch(function () {});
})();
