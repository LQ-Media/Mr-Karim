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
  $$(".admintabs [data-tab]").forEach(function (x) { x.setAttribute("aria-selected", x === b); });
  ["orders", "menu", "customers", "admins"].forEach(function (t) { $("#tab-" + t).hidden = t !== b.dataset.tab; });
  if (b.dataset.tab === "customers") loadCustomers();
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
  if (location.search) history.replaceState(null, "", "/admin.html");
  loadOrders();
  setInterval(function () { if ($("#drawer").hidden && !$("#tab-orders").hidden) loadOrders(); }, 60000);
}).catch(function () {});
})();
