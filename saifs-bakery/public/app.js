(function () {
"use strict";
var P = window.SaifsPricing;
var C = JSON.parse(JSON.stringify(window.SAIFS_DEFAULT_CATALOG)); // replaced by the live menu on boot
var B = C.builder;
var $ = function (s, el) { return (el || document).querySelector(s); };
var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
var money = function (n) { return "$" + (Math.round(n * 100) / 100).toFixed(n % 1 ? 2 : 0); };
var isNum = P.isNum, on = P.on, find = P.find;
var API = true; // false when the server isn't reachable (static copy): orders then go by WhatsApp only

/* ---------------- state ---------------- */
var S = { shopCat: "cakes", occ: "any", galTheme: "all", pd: null, custom: null, cart: [], date: null, slot: null, calMonth: null, stageView: "3d", edit: null, order: null };
function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function load(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } }
S.cart = load("saifs-cart2", []).filter(function (i) { return i && i.data; });
function saveCart() { store("saifs-cart2", S.cart); }
function myOrders() { return load("saifs-orders", []); }
function rememberOrder(ref, token) { var l = myOrders().filter(function (o) { return o.token !== token; }); l.unshift({ ref: ref, token: token, at: Date.now() }); store("saifs-orders", l.slice(0, 20)); }

function palette(id) { return find(B.palettes, id) || on(B.palettes)[0]; }
function firstId(list, fallback) { var l = on(list); return l.length ? l[0].id : fallback; }
function defaultCustom() {
  var cs = on(B.cupcakeSizes)[0] || { id: "Regular", counts: [{ n: 12 }] };
  return { base: "", baseId: null, photo: null, type: "cake", size: (find(on(B.sizes), "6") || on(B.sizes)[0] || {}).id, tiers: "1", shape: firstId(B.shapes, "round"),
    sponge: firstId(B.sponges, ""), filling: firstId(B.fillings, ""), finish: firstId(B.finishes, ""), palette: firstId(B.palettes, ""),
    decor: new Set(find(B.decorations, "Name plaque") ? ["Name plaque"] : []), themeText: "", name: "", age: "", greeting: (B.greetings || [])[0] || "None",
    cupSize: cs.id, cupCount: (cs.counts[1] || cs.counts[0] || {}).n, diet: new Set(), hasRef: false };
}
function fromGallery(g) {
  var c = defaultCustom(), p = g.preset || {};
  Object.keys(p).forEach(function (k) { if (k !== "decor") c[k] = p[k]; });
  c.tiers = String(c.tiers || "1");
  c.decor = new Set(p.decor || []); c.base = g.name; c.baseId = g.id; c.photo = g.photo;
  return c;
}
function toData(c) { var d = {}; Object.keys(c).forEach(function (k) { d[k] = c[k] instanceof Set ? Array.from(c[k]) : c[k]; }); return d; }
function fromData(d) { var c = defaultCustom(); Object.keys(d).forEach(function (k) { c[k] = d[k]; }); c.decor = new Set(d.decor || []); c.diet = new Set(d.diet || []); c.tiers = String(d.tiers || "1"); return c; }

function deliveryFee(sub) { return P.deliveryFee(C, sub); }
function priceText(n) { return C.shop.showPrices && isNum(n) ? money(n) : null; }

/* ---------------- routing ---------------- */
var VIEWS = ["home", "shop", "product", "gallery", "custom", "cart", "date", "send", "order", "account", "page", "when", "chat"];
var TAB = { home: "home", shop: "shop", product: "shop", gallery: "gallery", custom: "gallery", cart: "cart", date: "cart", send: "cart", order: "cart", account: "", page: "", when: "home", chat: "" };
var live = null;
function route() {
  var parts = (location.hash || "#home").slice(1).split("/"), v = parts[0];
  if (VIEWS.indexOf(v) < 0) v = "home";
  if (v === "product" && !S.pd) v = "shop";
  if (v === "custom" && !S.custom) { S.custom = defaultCustom(); S.cstep = 0; }
  if (v === "gallery" && parts[1]) S.galMode = parts[1];
  if ((v === "date" || v === "send") && !S.cart.length) v = "cart";
  if (v === "send" && !S.date) v = "date";
  if ((v === "date" || v === "send") && API && !S.me) { S.after = v; v = "account"; if (location.hash !== "#account") history.replaceState(null, "", "#account"); }
  VIEWS.forEach(function (n) { $("#v-" + n).hidden = n !== v; });
  document.body.dataset.mode = $("#v-" + v).dataset.mode;
  $$(".tabs a").forEach(function (a) { if (a.dataset.tab === TAB[v]) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  ({ home: renderHome, shop: renderShop, product: renderProduct, gallery: renderGallery, custom: renderCustom, cart: renderCart, date: renderDate, send: renderSend,
     order: function () { loadOrder(parts[1]); }, account: renderAccount, when: renderWhen, chat: renderChat, page: function () { window.SaifsSite.renderPage(decodeURIComponent(parts[1] || "")); } })[v]();
  if (v !== "custom" && live) live.stop();
  popWords($("#v-" + v));
  window.scrollTo(0, 0);
}
function popWords(view) {
  if (window.SaifsSite && window.SaifsSite.editing()) return;
  $$(".h1, .h2.big", view).forEach(function (h) {
    var inner = h.querySelector("[data-t]"); if (inner && !h.dataset.t) h.dataset.t = inner.dataset.t;
    if (h.dataset.popped === h.textContent) return;
    var text = h.textContent.trim();
    h.setAttribute("aria-label", text);
    h.innerHTML = text.split(/\s+/).map(function (w, i) { return '<span class="pw" aria-hidden="true" style="--d:' + (i * 0.07).toFixed(2) + 's">' + esc(w) + "</span>"; }).join(" ");
    h.dataset.popped = h.textContent;
  });
  view.classList.remove("enter"); void view.offsetWidth; view.classList.add("enter");
}
function bgSprinkles() {
  var cols = ["#F28B82", "#7FB7E6", "#F2C66D", "#8CCB8A", "#E9B49E", "#A84D2E", "#C7A1E8"], sp = "";
  for (var i = 0; i < 14; i++) sp += '<span style="left:' + ((i * 71) % 100) + '%;background:' + cols[i % 7] + ';animation-duration:' + (9 + (i * 37) % 7) + 's;animation-delay:-' + ((i * 13) % 11) + 's"></span>';
  var d = document.createElement("div"); d.className = "bgsprinkles"; d.setAttribute("aria-hidden", "true"); d.innerHTML = sp; document.body.prepend(d);
}
function sprinkleBurst(host) {
  if (!host) return;
  var old = $(".burstbox"); if (old) old.remove();
  var cols = ["#F28B82", "#7FB7E6", "#F2C66D", "#8CCB8A", "#A84D2E", "#E9B49E", "#C7A1E8"], h = "";
  for (var i = 0; i < 36; i++) { var a = i / 36 * Math.PI * 2, r = 110 + (i * 37) % 120; h += '<span style="--dx:' + Math.round(Math.cos(a) * r) + 'px;--dy:' + Math.round(Math.sin(a) * r - 60) + 'px;--rot:' + ((i * 47) % 720) + 'deg;background:' + cols[i % 7] + '"></span>'; }
  var b = document.createElement("div"); b.className = "burstbox"; b.setAttribute("aria-hidden", "true"); b.innerHTML = h; host.appendChild(b);
}
function TT(key, def, rich) { return window.SaifsSite ? window.SaifsSite.span(key, def, rich) : esc(def); }
function T(key, def) { return window.SaifsSite ? window.SaifsSite.t(key, def) : def; }
function go(v) { if (location.hash === "#" + v) route(); else location.hash = v; }
window.addEventListener("hashchange", route);
function toast(msg) { var t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove("on"); }, 2600); }
function badges() { var n = S.cart.reduce(function (a, i) { return a + i.qty; }, 0); ["#cartBadge", "#tabBadge"].forEach(function (s) { var b = $(s); b.textContent = n; b.dataset.n = n; }); }
function api(method, url, body) {
  return fetch(url, { method: method, headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined })
    .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) { var er = new Error(d.error || "Something went wrong. Please try again."); er.signin = !!d.signin; throw er; } return d; }); });
}

/* ---------------- home & shop ---------------- */
function pcard(p) {
  var prices = p.options.map(function (o) { return o.price; }).filter(isNum);
  var pt = C.shop.showPrices && prices.length ? "from " + money(Math.min.apply(null, prices)) : "";
  return '<button class="card" type="button" data-prod="' + esc(p.id) + '"><span class="photo">' + (p.tag ? '<span class="tag">' + esc(p.tag) + '</span>' : '') + '<img src="' + esc(p.photo) + '" alt="' + esc(p.name) + '" loading="lazy"></span>' +
    '<span class="meta"><span class="nm">' + esc(p.name) + '</span><span class="sb">' + p.options.map(function (o) { return esc(o.label); }).join(" · ") + '</span>' + (pt ? '<span class="pr">' + pt + '</span>' : '') + '</span></button>';
}
function gcard(g) {
  return '<button class="card" type="button" data-design="' + esc(g.id) + '"><span class="photo"><img src="' + esc(g.photo) + '" alt="' + esc(g.name) + ' by The Saif’s Bakery" loading="lazy"></span>' +
    '<span class="meta"><span class="nm">' + esc(g.name) + '</span><span class="sb">' + esc(g.meta) + '</span><span class="go">Make this mine →</span></span></button>';
}
var homeBuilt = false;
function renderHome() {
  $("#readyNote").textContent = "Ready-made bakes need " + C.shop.leadDays.ready + " days’ notice; custom orders " + C.shop.leadDays.custom + ".";
  renderHomeExtras();
  if (homeBuilt) return; homeBuilt = true;
  var thumb = function (p) { return /^img\//.test(p) ? p.replace("img/", "img/thumbs/") : p; };
  var cakes = on(C.gallery).filter(function (g) { return g.preset && g.preset.type !== "cupcakes"; });
  var rest = on(C.gallery).filter(function (g) { return !g.preset || g.preset.type === "cupcakes"; }).concat(on(C.products).filter(function (p) { return p.cat !== "cakes"; }));
  var tile = function (it) { return '<button class="tile" type="button" data-' + (it.preset ? "design" : "prod") + '="' + esc(it.id) + '" tabindex="-1" aria-label="' + esc(it.name) + '"><img src="' + esc(thumb(it.photo)) + '" alt="" loading="eager" decoding="async"></button>'; };
  var dbl = function (arr) { return arr.concat(arr).map(tile).join(""); };
  $("#row1").innerHTML = dbl(cakes); $("#row2").innerHTML = dbl(rest);
  var cols = ["#F28B82", "#7FB7E6", "#F2C66D", "#8CCB8A", "#E9B49E", "#A84D2E", "#C7A1E8"], sp = "";
  for (var i = 0; i < 26; i++) sp += '<span style="left:' + ((i * 53) % 100) + '%;background:' + cols[i % 7] + ';animation-duration:' + (6 + (i * 37) % 7) + 's;animation-delay:-' + ((i * 13) % 9) + 's"></span>';
  $("#sprinkles").innerHTML = sp;
}
function renderShop() {
  $("#shopWhen").innerHTML = whenBar();
  $("#shopTabs").innerHTML = C.categories.map(function (c) { return '<button role="tab" type="button" aria-selected="' + (S.shopCat === c.id) + '" data-cat="' + esc(c.id) + '"><span' + ic(CAT_IC[c.id] || "bag") + '></span>' + esc(c.label) + '</button>'; }).join("");
  $("#occChips").innerHTML = C.occasions.map(function (o) { return '<button class="chip" type="button" aria-pressed="' + (S.occ === o.id) + '" data-occ="' + esc(o.id) + '"><span' + ic(OCC_IC[o.id] || "sparkle") + '></span>' + esc(o.label) + '</button>'; }).join("");
  var list = on(C.products).filter(function (p) { return p.cat === S.shopCat && (S.occ === "any" || (p.occasions || []).indexOf(S.occ) >= 0); });
  $("#shopGrid").innerHTML = list.length ? list.map(pcard).join("") : '<p class="lede" style="grid-column:1/-1">Nothing here for that occasion yet. <a class="link" href="#gallery">Try a custom order</a>.</p>';
}
$("#v-shop").addEventListener("click", function (e) {
  var c = e.target.closest("[data-cat]"); if (c) { S.shopCat = c.dataset.cat; renderShop(); }
  var o = e.target.closest("[data-occ]"); if (o) { S.occ = o.dataset.occ; renderShop(); }
});
document.addEventListener("click", function (e) {
  var p = e.target.closest("[data-prod]");
  if (p) { var prod = find(C.products, p.dataset.prod); if (!prod) return; S.pd = { p: prod, opt: prod.options[0].label, plaque: "None", own: "", candles: false, qty: 1, editIndex: null }; go("product"); }
  var d = e.target.closest("[data-design]");
  if (d) { var g = find(C.gallery, d.dataset.design); if (!g) return; S.custom = fromGallery(g); S.custom.editIndex = null; S.stageView = "photo"; S.cstep = 0; go("custom"); }
});

/* ---------------- product ---------------- */
function renderProduct() {
  var d = S.pd; if (!d) return; var p = d.p, o = P.productOption(p, d.opt), pt = priceText(o && isNum(o.price) ? o.price * d.qty : null);
  var plaques = ["None"].concat(C.plaques || [], ["Own words"]);
  $("#v-product").innerHTML =
    '<div class="hero"><a href="#shop" class="iconbtn back" aria-label="Back to shop"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></a>' +
    '<img src="' + esc(p.photo) + '" alt="' + esc(p.name) + '"></div>' +
    '<div class="stack" style="gap:6px"><h1 class="h1"' + ic(CAT_IC[p.cat] || "cake") + '>' + esc(p.name) + '</h1><p class="lede">' + esc(p.desc) + '</p></div>' +
    '<fieldset class="group"><legend><span' + ic("tag") + '>Choose</span></legend><div class="sizes">' +
    p.options.map(function (o) { var op = priceText(o.price); return '<button class="opt" type="button" data-opt="' + esc(o.label) + '" aria-pressed="' + (d.opt === o.label) + '"><b>' + esc(o.label) + '</b>' + ((o.note || op) ? '<small>' + esc([o.note, op].filter(Boolean).join(" · ")) + '</small>' : '') + '</button>'; }).join("") + '</div></fieldset>' +
    (p.plaque ? '<fieldset class="group"><legend><span' + ic("pen") + '>Message plaque</span><span>free</span></legend><div class="opts">' +
      plaques.map(function (l) { return '<button class="chip" type="button" data-plaque="' + esc(l) + '" aria-pressed="' + (d.plaque === l) + '">' + esc(l) + '</button>'; }).join("") + '</div>' +
      (d.plaque === "Own words" ? '<div class="field"><label for="ownWords">Your words (up to 20 letters)</label><input id="ownWords" maxlength="20" value="' + esc(d.own) + '"></div>' : '') + '</fieldset>' +
      '<div class="switchrow"><span>Add candles</span><button class="switch" type="button" role="switch" aria-checked="' + d.candles + '" aria-label="Add candles" id="candleSw"><span></span></button></div>' : '') +
    '<div class="actionbar"><div class="stepper"><button type="button" data-q="-1" aria-label="Fewer">−</button><span aria-live="polite">' + d.qty + '</span><button type="button" data-q="1" aria-label="More">+</button></div>' +
    '<button class="primary" type="button" id="pAdd" style="flex:1">' + (d.editIndex != null ? "Save changes" : "Add to order") + (pt ? " · " + pt : "") + '</button></div>';
}
$("#v-product").addEventListener("click", function (e) {
  var d = S.pd; if (!d) return; var t = e.target, x;
  if ((x = t.closest("[data-opt]"))) { d.opt = x.dataset.opt; renderProduct(); return; }
  if ((x = t.closest("[data-plaque]"))) { d.plaque = x.dataset.plaque; renderProduct(); if (d.plaque === "Own words") $("#ownWords").focus(); return; }
  if (t.closest("#candleSw")) { d.candles = !d.candles; renderProduct(); return; }
  if ((x = t.closest("[data-q]"))) { d.qty = Math.max(1, d.qty + (+x.dataset.q)); renderProduct(); return; }
  if (t.closest("#pAdd")) {
    var line = P.readyLine(C, { productId: d.p.id, option: d.opt, plaque: d.plaque, own: d.own, candles: d.candles }, d.qty);
    if (d.editIndex != null) S.cart[d.editIndex] = line; else S.cart.push(line);
    saveCart(); badges(); toast(d.editIndex != null ? "Updated" : "Added to your order"); go("cart");
  }
});
$("#v-product").addEventListener("input", function (e) { if (e.target.id === "ownWords") S.pd.own = e.target.value; });

/* ---------------- gallery ---------------- */
function renderGallery() {
  if (!S.galMode) S.galMode = window.innerWidth < 960 ? "swipe" : "grid";
  var th = [{ id: "all", label: "All designs" }].concat(C.galleryThemes || []), n = savedIds().length;
  $("#galWhen").innerHTML = whenBar();
  $("#galMode").innerHTML = [["swipe", "cards", "Swipe"], ["grid", "grid", "All designs"], ["saved", "heart", "Saved" + (n ? " (" + n + ")" : "")]].map(function (m) {
    return '<button role="tab" type="button" data-gmode="' + m[0] + '" aria-selected="' + (S.galMode === m[0]) + '"><span' + ic(m[1]) + '></span>' + m[2] + "</button>"; }).join("");
  $("#galTheme").hidden = S.galMode === "saved";
  $("#galTheme").innerHTML = th.map(function (t) { return '<button class="chip" type="button" aria-pressed="' + (S.galTheme === t.id) + '" data-gth="' + esc(t.id) + '"><span' + ic(THEME_IC[t.id] || "star") + '></span>' + esc(t.label) + '</button>'; }).join("");
  var swipe = S.galMode === "swipe";
  $("#galSwipe").hidden = !swipe; $("#galGrid").hidden = swipe;
  if (swipe) { renderSwipe(); return; }
  var list = S.galMode === "saved" ? savedIds().map(function (id) { return find(on(C.gallery), id); }).filter(Boolean) : galList();
  $("#galGrid").innerHTML = list.length ? list.map(gcard).join("") : '<div class="empty-note" style="grid-column:1/-1"><span' + ic("heart") + '></span>' + TT("gallery.saved-empty", "No saved designs yet. Swipe right on the ones you love.") + "</div>";
}
$("#v-gallery").addEventListener("click", function (e) {
  var b = e.target.closest("[data-gth]"); if (b) { S.galTheme = b.dataset.gth; S.swipeI = 0; renderGallery(); return; }
  var m = e.target.closest("[data-gmode]"); if (m) { S.galMode = m.dataset.gmode; if (location.hash !== "#gallery") history.replaceState(null, "", "#gallery"); renderGallery(); }
});
$("#startBlank").addEventListener("click", function () { S.custom = defaultCustom(); S.custom.editIndex = null; S.stageView = "3d"; S.cstep = 0; go("custom"); });

/* ---------------- customise ---------------- */
function addOn(o, perCup) {
  if (!C.shop.showPrices) return o.note || "";
  var bits = [];
  if (o.note) bits.push(o.note);
  if (isNum(o.price) && o.price > 0 && !perCup) bits.push("+" + money(o.price));
  if (perCup && o.perCupcake && isNum(o.perCupcake[S.custom.cupSize])) bits.push("+" + money(o.perCupcake[S.custom.cupSize]) + " each");
  return bits.join(" · ");
}
var KEY_IC = { type: "cake", size: "users", tiers: "layers", shape: "shapes", cupSize: "cupcake", cupCount: "box", sponge: "bowl", filling: "drop", finish: "sparkle" };
function single(key, title, hint, list, labelFn) {
  var c = S.custom;
  return '<fieldset class="group"><legend><span' + ic(KEY_IC[key]) + '>' + title + '</span><span>' + (hint || "") + '</span></legend><div class="opts">' +
    list.map(function (o) { var sub = labelFn ? labelFn(o) : addOn(o); return '<button class="opt" type="button" data-k="' + key + '" data-v="' + esc(o.id) + '" aria-pressed="' + (String(c[key]) === String(o.id)) + '"><b>' + esc(o.label) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</button>'; }).join("") + '</div></fieldset>';
}
function toggles(attr, list, set, sub) { return list.map(function (d) { var id = typeof d === "string" ? d : d.id, label = typeof d === "string" ? d : d.label, s = sub ? sub(d) : ""; return '<button class="tog" type="button" data-' + attr + '="' + esc(id) + '" aria-pressed="' + set.has(id) + '">' + esc(label) + (s ? ' · ' + esc(s) : '') + '</button>'; }).join(""); }
function renderCustom() {
  var c = S.custom, cake = c.type !== "cupcakes", cups = c.type !== "cake";
  $("#cBase").textContent = "Step 2 of 4 · " + (c.baseId ? "based on " + c.base : "blank design");
  var cs = find(B.cupcakeSizes, c.cupSize) || on(B.cupcakeSizes)[0];
  var pal = on(B.palettes).map(function (p) { return '<button class="opt" type="button" data-k="palette" data-v="' + esc(p.id) + '" aria-pressed="' + (c.palette === p.id) + '"><span class="dots" aria-hidden="true"><span style="background:' + esc(p.frost) + '"></span><span style="background:' + esc(p.trim) + '"></span><span style="background:' + esc(p.accent) + '"></span></span><b>' + esc(p.label) + '</b></button>'; }).join("");
  var decSub = function (d) {
    if (!C.shop.showPrices) return "";
    if (c.type === "cupcakes") return d.perCupcake && isNum(d.perCupcake[c.cupSize]) ? "+" + money(d.perCupcake[c.cupSize]) + " each" : "";
    return isNum(d.price) && d.price > 0 ? "+" + money(d.price) : "";
  };
  var html =
    '<div data-step="0">' + single("type", "What are we making?", "", [{ id: "cake", label: "Cake" }, { id: "cupcakes", label: "Cupcakes" }, { id: "both", label: "Cake + cupcakes" }], function () { return ""; }) +
    (cake ? single("size", "Cake size", "serves", on(B.sizes), function (o) { return [o.note, priceText(o.price)].filter(Boolean).join(" · "); }) +
      single("tiers", "Tiers", "", on(B.tiers)) + single("shape", "Shape", "", on(B.shapes)) : "") +
    (cups && cs ? single("cupSize", "Cupcake size", "", on(B.cupcakeSizes), function (o) { return o.note || ""; }) +
      single("cupCount", "How many cupcakes?", "", cs.counts.map(function (k) { return { id: k.n, label: k.n + " pcs", price: k.price }; }), function (o) { return priceText(o.price) || ""; }) : "") + "</div>" +
    '<div data-step="1">' + single("sponge", cake ? "Sponge" : "Cupcake flavour", "", on(B.sponges)) +
    single("filling", cake ? "Filling" : "Frosting flavour", "", on(B.fillings)) +
    (cake ? single("finish", "Finish", "", on(B.finishes)) : "") + "</div>" +
    '<div data-step="2"><fieldset class="group"><legend><span' + ic("palette") + '>Colours</span></legend><div class="pal">' + pal + '</div></fieldset></div>' +
    '<div data-step="3"><fieldset class="group"><legend><span' + ic("star") + '>Decorations</span><span>choose any</span></legend><div class="opts">' + toggles("dec", on(B.decorations), c.decor, decSub) + '</div>' +
    '<div class="field"><label for="cTheme">Theme or character (optional)</label><input id="cTheme" maxlength="60" value="' + esc(c.themeText) + '" placeholder="e.g. dinosaurs, Frozen, football"></div></fieldset></div>' +
    '<div data-step="4"><fieldset class="group"><legend><span' + ic("pen") + '>Words on the ' + (cake ? "cake" : "box") + '</span></legend><div class="fields"><div class="field"><label for="cName">Name</label><input id="cName" maxlength="14" value="' + esc(c.name) + '" autocomplete="off"></div>' +
    '<div class="field"><label for="cAge">Age</label><input id="cAge" type="number" inputmode="numeric" min="1" max="120" value="' + esc(c.age) + '"></div></div>' +
    '<span class="small" style="font-weight:800">Greeting</span><div class="opts">' + (B.greetings || []).concat(["None"]).map(function (g) { return '<button class="chip" type="button" data-k="greeting" data-v="' + esc(g) + '" aria-pressed="' + (c.greeting === g) + '">' + esc(g) + '</button>'; }).join("") + '</div></fieldset>' +
    '<fieldset class="group plain"><legend><span' + ic("note") + '>Anything else for Ain?</span></legend><div class="opts">' + toggles("diet", B.diets || [], c.diet) + '</div>' +
    '<div class="switchrow"><span>I have a reference photo to send</span><button class="switch" type="button" role="switch" aria-checked="' + c.hasRef + '" aria-label="I have a reference photo to send" id="refSw"><span></span></button></div></fieldset></div>';
  $("#cOpts").innerHTML = html;
  if (S.cstep == null) S.cstep = 0;
  paintSteps(); setupStage(); updateCustom();
}
var CSTEPS = [["Size", "cake"], ["Flavour", "bowl"], ["Colours", "palette"], ["Decor", "star"], ["Words", "pen"]];
function paintSteps() {
  var st = S.cstep || 0, c = S.custom;
  $("#cOpts").dataset.cur = st;
  $("#cSteps").innerHTML = CSTEPS.map(function (x, i) { return '<button role="tab" type="button" data-cstep="' + i + '" aria-selected="' + (i === st) + '" class="' + (i < st ? "done" : "") + '"><span' + ic(x[1]) + '></span><span class="lbl">' + x[0] + "</span></button>"; }).join("");
  $("#cAdd").textContent = st < CSTEPS.length - 1 ? "Next: " + CSTEPS[st + 1][0] : (c.editIndex != null ? "Save changes" : "Add to order");
}
$("#cSteps").addEventListener("click", function (e) { var b = e.target.closest("[data-cstep]"); if (!b) return; S.cstep = +b.dataset.cstep; paintSteps(); });
function setupStage() {
  var c = S.custom, box = $("#stageBox"), ref = $("#stageRef"), tg = $(".viewtoggle", box);
  if (tg) tg.remove();
  if (c.photo) {
    ref.src = c.photo; ref.alt = c.base + " by The Saif’s Bakery";
    box.insertAdjacentHTML("beforeend", '<div class="viewtoggle"><button type="button" data-sv="photo" aria-pressed="' + (S.stageView === "photo") + '">Ain’s cake</button><button type="button" data-sv="3d" aria-pressed="' + (S.stageView === "3d") + '">3D preview</button></div>');
  } else S.stageView = "3d";
  var photo = S.stageView === "photo";
  ref.hidden = !photo; $("#stageLbl").hidden = !!c.photo || !window.Cake3D; $("#stageHint").textContent = photo ? T("custom.photo-hint", "Ain will bake it with your changes") : T("custom.drag-to-turn-a-guide-not-the", "Drag to turn · a guide, not the final design");
}
$("#stageBox").addEventListener("click", function (e) { var b = e.target.closest("[data-sv]"); if (b) { S.stageView = b.dataset.sv; setupStage(); updateCustom(); } });
function customSpec(c) {
  var pal = palette(c.palette) || { frost: "#FFF6E6", trim: "#F2C66D", accent: "#A84D2E", drip: "#3B2418" };
  var looks = {}; c.decor.forEach(function (id) { var d = find(B.decorations, id); if (d && d.look) looks[d.look] = true; });
  var sponge = (find(B.sponges, c.sponge) || {}).color || "#F3DDA8";
  var sprinkles = looks.sprinkles ? (c.palette === "Cocoa" ? ["#D9B45A", "#F2D48A"] : ["#F28B82", "#7FB7E6", "#F2C66D", "#8CCB8A", "#C7A1E8"]) : null;
  var top = looks.candy ? "candy" : looks.toppers ? "topper" : "sprinkles";
  if (c.type === "cupcakes") {
    return { kind: "box", count: Math.min(+c.cupCount || 12, /mini/i.test(c.cupSize) ? 15 : 12), colors: [pal.frost, pal.trim === "#FFFFFF" ? "#FFFFFF" : pal.frost], liner: pal.accent, cake: sponge, top: top };
  }
  var nm = (c.name || "").trim(), txt = nm ? nm + (c.age ? " · " + c.age : "") : (c.greeting !== "None" ? c.greeting : "");
  var size = (find(B.sizes, c.size) || {}).id;
  return { kind: "cake", seed: 11, shape: ["round", "square", "heart"].indexOf(c.shape) >= 0 ? c.shape : "round", size: +size || 6, tiers: String(c.tiers) === "2" ? 2 : 1,
    finish: (find(B.finishes, c.finish) || {}).look || "buttercream",
    frost: pal.frost, trim: pal.trim, accent: pal.accent, sponge: sponge, drip: looks.drip ? pal.drip : null, sprinkles: sprinkles,
    candy: !!looks.candy, flowers: looks.flowers ? pal.accent : null, toppers: !!looks.toppers, goldBeads: !!looks.gold,
    candles: looks.candles ? Math.min(Math.max(parseInt(c.age, 10) || 3, 1), 6) : 0,
    plaque: looks.plaque && txt ? txt : null, plaqueSub: looks.plaque && nm && c.greeting !== "None" ? c.greeting : "",
    plaqueDark: c.palette === "Cocoa" || c.palette === "Cherry", cupcakes: c.type === "both" ? 3 : 0, cupColors: [pal.frost, "#FFFFFF"] };
}
function updateCustom() {
  var c = S.custom, p = priceText(P.customPrice(C, toData(c)));
  $("#cSum").textContent = P.customSummary(C, toData(c));
  var pe = $("#cPrice"), nt = p || "Price confirmed by Ain";
  if (pe.textContent !== nt) { pe.textContent = nt; pe.classList.remove("pop"); void pe.offsetWidth; pe.classList.add("pop"); }
  $("#cPrice").style.fontSize = p ? "" : "15px";
  if (S.stageView !== "3d") { if (live) live.stop(); return; }
  if (window.Cake3D) {
    if (!live) { try { live = window.Cake3D.live($("#stageCanvas")); } catch (e) { console.error(e); } }
    if (live) { try { live.set(customSpec(c)); live.start(); } catch (e) { console.error(e); } }
  } else if (!$("#stageBox .nogl")) {
    $("#stageBox").insertAdjacentHTML("beforeend", '<div class="nogl hint" style="top:45%">3D preview isn’t available on this browser. Your choices are still saved.</div>');
  }
}
$("#cOpts").addEventListener("click", function (e) {
  var c = S.custom, t = e.target, x;
  if ((x = t.closest("[data-k]"))) {
    var k = x.dataset.k, v = x.dataset.v;
    if (k === "cupCount") v = +v;
    c[k] = v;
    if (k === "cupSize") { var cs = find(B.cupcakeSizes, v); c.cupCount = cs ? (cs.counts[1] || cs.counts[0]).n : 12; }
    if (k === "type" || k === "cupSize") { var y = window.scrollY; renderCustom(); window.scrollTo(0, y); return; }
    $$('[data-k="' + k + '"]', $("#cOpts")).forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.v) === String(v)); });
    if (S.stageView === "photo" && c.photo) { S.stageView = "3d"; setupStage(); }
    updateCustom(); return;
  }
  if ((x = t.closest("[data-dec]"))) { var n = x.dataset.dec; if (c.decor.has(n)) c.decor.delete(n); else c.decor.add(n); x.setAttribute("aria-pressed", c.decor.has(n)); if (S.stageView === "photo" && c.photo) { S.stageView = "3d"; setupStage(); } updateCustom(); return; }
  if ((x = t.closest("[data-diet]"))) { var m = x.dataset.diet; if (c.diet.has(m)) c.diet.delete(m); else c.diet.add(m); x.setAttribute("aria-pressed", c.diet.has(m)); return; }
  if (t.closest("#refSw")) { c.hasRef = !c.hasRef; $("#refSw").setAttribute("aria-checked", c.hasRef); }
});
var typingT = 0;
$("#cOpts").addEventListener("input", function (e) {
  var c = S.custom, id = e.target.id;
  if (id === "cName") c.name = e.target.value; else if (id === "cAge") c.age = e.target.value; else if (id === "cTheme") { c.themeText = e.target.value; return; } else return;
  clearTimeout(typingT); typingT = setTimeout(updateCustom, 250);
});
$("#cAdd").addEventListener("click", function () {
  if ((S.cstep || 0) < CSTEPS.length - 1) { S.cstep = (S.cstep || 0) + 1; paintSteps(); var top = $("#cSteps").getBoundingClientRect().top + window.scrollY - 90; if (window.scrollY > top) window.scrollTo({ top: top, behavior: "smooth" }); return; }
  var c = S.custom, line = P.customLine(C, toData(c));
  if (c.editIndex != null) S.cart[c.editIndex] = line; else S.cart.push(line);
  saveCart(); badges(); toast(c.editIndex != null ? "Updated" : "Custom order added"); go("cart");
});

/* ---------------- cart (also used to edit an existing order) ---------------- */
function lead() { return P.leadDays(C, S.cart); }
function subtotal() { return P.subtotal(S.cart); }
function total() { var sub = subtotal(), f = deliveryFee(sub); return isNum(sub) && isNum(f) ? sub + f : null; }
function totalsHtml(sub, f, tt) {
  if (sub === undefined) { sub = subtotal(); f = deliveryFee(sub); tt = total(); }
  var st = priceText(sub);
  if (!st) return '<div class="r"><span>Price</span><span>Confirmed by Ain</span></div>';
  var d = C.shop.delivery || {};
  var free = isNum(d.freeAbove) && f > 0 ? '<div class="r small muted"><span>Free delivery from ' + money(d.freeAbove) + " (" + money(d.freeAbove - sub) + " more)</span><span></span></div>" : "";
  return '<div class="r"><span>Subtotal</span><span>' + st + '</span></div><div class="r"><span>Delivery</span><span>' + (f === 0 ? "Free" : isNum(f) ? money(f) : "–") + "</span></div>" + free + '<div class="r tot"><span>Total</span><span>' + (priceText(tt) || "–") + "</span></div>";
}
function lineHtml(i, n, editable) {
  var pt = priceText(isNum(i.price) ? i.price * i.qty : null);
  return '<div class="line"><img class="thumb" src="' + esc(i.photo) + '" alt=""><div style="min-width:0"><div class="nm">' + esc(i.name) + (i.qty > 1 ? " ×" + i.qty : "") + '</div><div class="sb">' + esc(i.detail) + '</div>' +
    (editable ? '<div class="row gap" style="gap:14px"><button class="rm" type="button" data-editline="' + n + '">Change</button><button class="rm" type="button" data-rm="' + n + '">Remove</button></div>' : '') +
    '</div><div class="pr">' + (pt || "") + '</div></div>';
}
function renderCart() {
  var eb = $("#editBanner");
  if (S.edit) { eb.hidden = false; eb.innerHTML = '<b>' + (S.edit.mode === "edit" ? "Editing order " : "Changing order ") + esc(S.edit.ref) + '</b><span>' + (S.edit.mode === "edit" ? "Make your changes, then save." : "Ain will approve your changes.") + '</span><button class="rm" type="button" id="stopEdit">Stop editing</button>'; }
  else eb.hidden = true;
  if (!S.cart.length) {
    $("#cartList").innerHTML = '<div class="empty"><p class="lede">' + (S.edit ? "This order has no items. Add something, or cancel the order from its page." : TT("cart.empty", "Your basket is empty.")) + '</p><div class="row gap" style="justify-content:center"><a class="secondary" href="#shop">Shop ready-made</a><a class="primary" href="#gallery">Start a custom order</a></div></div>';
    $("#cartFoot").innerHTML = "";
  } else {
    $("#cartList").innerHTML = S.cart.map(function (i, n) { return lineHtml(i, n, true); }).join("");
    $("#cartFoot").innerHTML = '<div class="summary">' + totalsHtml() + '<div class="r small muted"><span>Needs ' + lead() + " days’ notice · delivery only</span><span></span></div></div>" +
      '<div class="row gap" style="margin-top:12px"><a class="secondary" href="#shop">' + TT("cart.add-more", "Add more") + '</a><a class="primary" href="#date" style="flex:1">' + (S.edit ? "Next: delivery details" : TT("cart.choose-date", "Choose a date")) + '</a></div>';
  }
  renderMyOrders();
}
function renderMyOrders() {
  var box = $("#myOrders");
  if (API && S.me) {
    api("GET", "/api/account/orders").then(function (list) {
      box.innerHTML = list.length ? '<h2 class="h2"' + ic("list") + ' style="margin-top:10px">Your orders</h2>' + list.slice(0, 5).map(orderRow).join("") + (list.length > 5 ? '<a class="link" href="#account">See all your orders</a>' : "") : "";
    }).catch(function () { box.innerHTML = ""; });
    return;
  }
  var mine = myOrders();
  if (!mine.length || !API) { box.innerHTML = ""; return; }
  box.innerHTML = '<h2 class="h2"' + ic("list") + ' style="margin-top:10px">Your orders</h2>' + mine.map(function (o) { return '<a class="myorder" href="#order/' + esc(o.token) + '"><b>' + esc(o.ref) + '</b><span>View, pay or change →</span></a>'; }).join("");
}
$("#v-cart").addEventListener("click", function (e) {
  var r = e.target.closest("[data-rm]"); if (r) { S.cart.splice(+r.dataset.rm, 1); saveCart(); badges(); renderCart(); return; }
  var ed = e.target.closest("[data-editline]");
  if (ed) {
    var n = +ed.dataset.editline, it = S.cart[n];
    if (it.kind === "custom") { S.custom = fromData(it.data); S.custom.editIndex = n; S.stageView = "3d"; S.cstep = 0; go("custom"); }
    else { var p = find(C.products, it.data.productId); if (!p) { toast("That item isn’t on the menu any more."); return; } S.pd = { p: p, opt: it.data.option, plaque: it.data.plaque || "None", own: it.data.own || "", candles: !!it.data.candles, qty: it.qty, editIndex: n }; go("product"); }
    return;
  }
  if (e.target.closest("#stopEdit")) { var tok = S.edit.token; stopEditing(); go("order/" + tok); }
});
function stopEditing() { S.edit = null; S.cart = load("saifs-cart-saved", []); store("saifs-cart-saved", []); saveCart(); badges(); }

/* ---------------- date ---------------- */
var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function sgToday() { var s = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).split("-"); return new Date(+s[0], +s[1] - 1, +s[2]); }
var today = sgToday();
function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function parseYmd(s) { var p = String(s).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
function fmtDate(d) { return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()].slice(0, 3); }
function renderDate() {
  var earliest = addDays(today, lead()), changing = S.edit && S.edit.mode === "change";
  if (S.date && S.date < earliest && !changing) S.date = null;
  if (!S.slot || C.shop.slots.indexOf(S.slot) < 0) S.slot = C.shop.slots[1] || C.shop.slots[0];
  if (!S.calMonth) S.calMonth = new Date((S.date || earliest).getFullYear(), (S.date || earliest).getMonth(), 1);
  var m = S.calMonth; $("#calTitle").textContent = MONTHS[m.getMonth()] + " " + m.getFullYear();
  var own = S.edit && S.order && S.order.date ? parseYmd(S.order.date) : null; // an order may keep its own (already counted) day
  if (S.date && !(own && +own === +S.date) && ["full", "closed"].indexOf(dayState(S.date)) >= 0) S.date = null;
  $("#calGrid").innerHTML = calDays(m, earliest, S.date, own);
  if (!$("#v-date .callegend")) $("#calGrid").insertAdjacentHTML("afterend", '<div class="callegend" aria-hidden="true"><span><i class="d-open"></i>Open</span><span><i class="d-low"></i>1 slot left</span><span><i class="d-full"></i>Fully booked</span></div>');
  if (Date.now() - AV.at > 60000) loadAvail().then(function (changed) { if (changed && !$("#v-date").hidden) renderDate(); });
  $("#calPrev").disabled = m.getFullYear() === today.getFullYear() && m.getMonth() === today.getMonth();
  $("#leadNote").textContent = (lead() === C.shop.leadDays.custom ? "Custom orders need " : "Ready-made bakes need ") + lead() + " days’ notice. Earliest date: " + fmtDate(earliest) + ".";
  $("#delNote").textContent = C.shop.delivery.note || "";
  $("#slotOpts").innerHTML = C.shop.slots.map(function (s) { return '<button class="chip" type="button" data-slot="' + esc(s) + '" aria-pressed="' + (S.slot === s) + '">' + esc(s) + "</button>"; }).join("");
  $("#dWhenLbl").textContent = S.date ? "Delivery" : "Pick a date";
  $("#dWhen").textContent = S.date ? fmtDate(S.date) + " · " + S.slot : "–";
  $("#dNext").disabled = !S.date;
}
$("#v-date").addEventListener("click", function (e) {
  var t = e.target, x;
  if ((x = t.closest("[data-day]")) && !x.disabled) { var m = S.calMonth; S.date = new Date(m.getFullYear(), m.getMonth(), +x.dataset.day); renderDate(); return; }
  if ((x = t.closest("[data-slot]"))) { S.slot = x.dataset.slot; renderDate(); return; }
  if (t.closest("#calPrev")) { S.calMonth = new Date(S.calMonth.getFullYear(), S.calMonth.getMonth() - 1, 1); renderDate(); return; }
  if (t.closest("#calNext")) { S.calMonth = new Date(S.calMonth.getFullYear(), S.calMonth.getMonth() + 1, 1); renderDate(); return; }
  if (t.closest("#dNext")) { if (!$("#addr").value.trim()) { $("#addr").focus(); toast("Add your delivery address first"); return; } go("send"); }
});

/* ---------------- send ---------------- */
function renderSend() {
  var tp = priceText(total()), mode = S.edit ? S.edit.mode : "new";
  $("#sendSummary").innerHTML = S.cart.map(function (i) { var pt = priceText(isNum(i.price) ? i.price * i.qty : null); return '<div class="r"><span><b>' + esc(i.name) + (i.qty > 1 ? " ×" + i.qty : "") + '</b><br><span class="small muted">' + esc(i.detail) + "</span></span><span>" + (pt || "") + "</span></div>"; }).join("") +
    '<div class="r small muted"><span>Delivery to ' + esc($("#addr").value.trim()) + " · " + fmtDate(S.date) + " · " + esc(S.slot) + '</span><a class="link" style="padding:0" href="#date">Change</a></div>' + totalsHtml();
  $("#estLbl").textContent = tp ? "Total incl. delivery" : "Price"; $("#estAmt").textContent = tp || "Confirmed by Ain";
  $("#sendBtn").textContent = !API ? "Send on WhatsApp" : mode === "edit" ? "Save changes" : mode === "change" ? "Send change to Ain" : "Place order";
  $("#sendTitle").textContent = mode === "edit" ? "Review your changes" : mode === "change" ? "Ask Ain for a change" : "Review & place order";
  delete $("#sendTitle").dataset.popped; popWords($("#v-send"));
  $("#reasonField").hidden = mode !== "change";
  $("#howText").textContent = !API ? "Your order opens in WhatsApp, ready to send to Ain. She confirms the details and payment (PayNow) in the chat."
    : mode === "change" ? "Ain has already confirmed this order, so she’ll look at your change and approve it in the app. You’ll see her answer on your order page."
    : "Your order goes straight to Ain. You’ll get your own order page to track it, make changes and pay by PayNow, and WhatsApp opens so you can say hello and send reference photos.";
}
function orderText(name, phone, notes, ref, token) {
  var L = ["Assalamualaikum Ain! " + (ref ? "I've just placed order " + ref + " on The Saif's Bakery app:" : "I'd like to order from The Saif's Bakery:"), ""];
  S.cart.forEach(function (i, n) { var pt = priceText(isNum(i.price) ? i.price * i.qty : null); L.push((n + 1) + ". " + i.name + (i.qty > 1 ? " x" + i.qty : "") + (pt ? " — " + pt : "")); L.push("   " + i.detail); });
  L.push("", "Delivery: " + fmtDate(S.date) + " " + S.date.getFullYear() + ", " + S.slot, "Address: " + $("#addr").value.trim());
  var tp = priceText(total()); if (tp) L.push("Total: " + tp);
  if (notes) L.push("Notes: " + notes);
  L.push("", "Name: " + name, "Phone: " + phone);
  if (token) L.push("", "Order page: " + location.origin + location.pathname + "#order/" + token);
  return L.join("\n");
}
function waUrl(text) { return "https://wa.me/" + String(C.shop.whatsapp || "").replace(/\D/g, "") + "?text=" + encodeURIComponent(text); }
var sending = false;
$("#sendForm").addEventListener("submit", function (e) {
  e.preventDefault();
  if (sending) return;
  var name = $("#sName").value.trim(), phone = $("#sPhone").value.trim(), notes = $("#sNotes").value.trim();
  if (!name || phone.replace(/\D/g, "").length < 8) { $("#sendErr").textContent = "Add your name and phone number so Ain can reply."; return; }
  $("#sendErr").textContent = "";
  var body = { name: name, phone: phone, notes: notes, address: $("#addr").value.trim(), date: ymd(S.date), slot: S.slot,
    items: S.cart.map(function (i) { return { kind: i.kind, data: i.data, qty: i.qty }; }), reason: $("#sReason").value.trim() };
  if (!API) { window.open(waUrl(orderText(name, phone, notes)), "_blank", "noopener"); S.cart = []; saveCart(); badges(); toast("WhatsApp opened"); go("home"); return; }
  sending = true; $("#sendBtn").disabled = true;
  var req = S.edit ? api("PUT", "/api/orders/" + S.edit.token, body) : api("POST", "/api/orders", body);
  req.then(function (r) {
    store("saifs-me", { name: name, phone: phone, address: body.address });
    if (S.edit) {
      var tok = S.edit.token; toast(r.mode === "requested" ? "Change sent to Ain" : "Order updated");
      S.edit = null; S.cart = load("saifs-cart-saved", []); store("saifs-cart-saved", []); saveCart(); badges();
      go("order/" + tok); return;
    }
    rememberOrder(r.ref, r.token); loadMe();
    var text = orderText(name, phone, notes, r.ref, r.token);
    S.cart = []; S.date = null; saveCart(); badges();
    S.justPlaced = { token: r.token, wa: waUrl(text) };
    window.open(S.justPlaced.wa, "_blank", "noopener");
    go("order/" + r.token);
  }).catch(function (err) {
    if (err.signin) { S.me = null; acctBadge(); S.after = "send"; toast("Please sign in to place your order"); go("account"); return; }
    $("#sendErr").textContent = err.message;
  }).then(function () { sending = false; $("#sendBtn").disabled = false; });
});

/* ---------------- customer order page ---------------- */
var STEPS = [["new", "Placed"], ["confirmed", "Confirmed"], ["baking", "Baking"], ["delivering", "On the way"], ["delivered", "Delivered"]];
function loadOrder(token) {
  if (!token) { go("cart"); return; }
  if (!API) { $("#orderBody").innerHTML = '<p class="lede">Order pages need the full app. Please WhatsApp Ain.</p>'; return; }
  api("GET", "/api/orders/" + encodeURIComponent(token)).then(function (o) { S.order = o; S.order.token = token; rememberOrder(o.ref, token); renderOrder(); })
    .catch(function (e) { $("#orderBody").innerHTML = '<div class="empty"><p class="lede">' + esc(e.message) + '</p><a class="secondary" href="#home">Back to home</a></div>'; });
}
function renderOrder() {
  var o = S.order, idx = -1;
  STEPS.forEach(function (s, i) { if (s[0] === o.status) idx = i; });
  var cancelled = o.status === "cancelled";
  var just = S.justPlaced && S.justPlaced.token === o.token;
  var payBox = "";
  if (cancelled) payBox = "";
  else if (o.payment === "paid") payBox = '<div class="paycard paid"><b' + ic("check") + '>Paid. Thank you!</b><span>Ain has received ' + money(o.total) + '.</span></div>';
  else if (o.status === "new") payBox = '<div class="paycard"><b' + ic("wallet") + '>Payment</b><span>Once Ain confirms your order, a PayNow QR code for the exact amount appears here.</span></div>';
  else if (o.canPay) payBox = '<div class="paycard"><b' + ic("qr") + '>Pay ' + money(o.total) + ' by PayNow</b><span>Scan with your banking app. The amount and reference ' + esc(o.ref) + ' are filled in.</span>' +
    '<img class="qr" src="/api/orders/' + encodeURIComponent(o.token) + '/paynow.svg?t=' + Date.now() + '" alt="PayNow QR code for ' + money(o.total) + '" width="220" height="220">' +
    (o.payment === "proof_sent" ? '<p class="small"><b>Screenshot received.</b> Ain will confirm your payment soon.</p>' : '') +
    '<label class="upload" for="proofFile"><input type="file" id="proofFile" accept="image/*">' + (o.payment === "proof_sent" ? "Send another screenshot" : "I’ve paid: upload my screenshot") + '</label></div>';
  var pending = o.pendingChange ? '<div class="notice"><b' + ic("bell") + '>Change waiting for Ain</b><span>' + esc(o.pendingChange.reason || "You asked for changes to this order.") + '</span><button class="rm" type="button" id="withdrawChange">Withdraw request</button></div>' : "";
  var note = o.noteToCustomer ? '<div class="notice ain"><b' + ic("chat") + '>Note from Ain</b><span>' + esc(o.noteToCustomer) + '</span></div>' : "";
  var actions = [];
  if (o.canEdit) actions.push('<button class="secondary" type="button" id="editOrder">Edit order</button>', '<button class="secondary" type="button" id="cancelOrder">Cancel order</button>');
  if (o.canRequestChange && !o.pendingChange) actions.push('<button class="secondary" type="button" id="changeOrder">Request a change</button>');
  var waText = "Assalamualaikum Ain! About my order " + o.ref + ": " + location.origin + location.pathname + "#order/" + o.token;
  $("#orderBody").innerHTML =
    (just ? '<div class="placed"><div class="ok"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div><p class="lede">Ain has your order. WhatsApp opened so you can send it to her too. Keep this page; it’s your order’s home.</p><a class="primary wa" href="' + esc(S.justPlaced.wa) + '" target="_blank" rel="noopener">Open WhatsApp again</a></div>' : '') +
    trackerHtml(o) + note + pending + payBox +
    '<h2 class="h2"' + ic("receipt") + '>Your order</h2><div class="summary">' + o.items.map(function (i) { return '<div class="r"><span><b>' + esc(i.name) + (i.qty > 1 ? " ×" + i.qty : "") + '</b><br><span class="small muted">' + esc(i.detail) + "</span></span><span>" + (priceText(isNum(i.price) ? i.price * i.qty : null) || "") + "</span></div>"; }).join("") +
    '<div class="r small muted"><span>Delivery to ' + esc(o.address) + " · " + fmtDate(parseYmd(o.date)) + " · " + esc(o.slot) + "</span><span></span></div>" + totalsHtml(o.subtotal, o.deliveryFee, o.total) + "</div>" +
    (actions.length ? '<div class="row gap">' + actions.join("") + "</div>" : "") +
    '<a class="primary wa" href="' + esc(waUrl(waText)) + '" target="_blank" rel="noopener">Message Ain on WhatsApp</a>' +
    '<details class="history"><summary><span' + ic("clock") + '></span>Order history</summary><ul>' + o.events.map(function (e) { return "<li><b>" + esc(e.who) + "</b> " + esc(e.message) + ' <span class="muted small">' + new Date(e.at).toLocaleString("en-SG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) + "</span></li>"; }).join("") + "</ul></details>";
  if (just) { sprinkleBurst($("#orderBody .ok")); S.justPlaced = null; }
  delete $("#v-order").dataset.x; popWords($("#v-order"));
}
function startEditing(mode) {
  var o = S.order;
  store("saifs-cart-saved", S.cart);
  S.edit = { token: o.token, ref: o.ref, mode: mode };
  S.cart = o.items.filter(function (i) { return i.kind !== "extra" && i.data; }).map(function (i) { return i.kind === "custom" ? P.customLine(C, i.data) : P.readyLine(C, i.data, i.qty); }).filter(Boolean);
  S.date = parseYmd(o.date); S.calMonth = null; S.slot = o.slot;
  $("#addr").value = o.address; $("#sName").value = o.name; $("#sPhone").value = o.phone; $("#sNotes").value = o.notes || ""; $("#sReason").value = "";
  badges(); go("cart");
}
$("#v-order").addEventListener("click", function (e) {
  var t = e.target, o = S.order; if (!o) return;
  if (t.closest("#editOrder")) startEditing("edit");
  if (t.closest("#changeOrder")) startEditing("change");
  if (t.closest("#cancelOrder")) {
    var b = t.closest("#cancelOrder");
    if (!b.dataset.sure) { b.dataset.sure = "1"; b.textContent = "Tap again to cancel"; return; }
    api("POST", "/api/orders/" + o.token + "/cancel").then(function () { toast("Order cancelled"); loadOrder(o.token); }).catch(function (err) { toast(err.message); });
  }
  if (t.closest("#withdrawChange")) api("DELETE", "/api/orders/" + o.token + "/change").then(function () { toast("Request withdrawn"); loadOrder(o.token); }).catch(function (err) { toast(err.message); });
});
$("#v-order").addEventListener("change", function (e) {
  if (e.target.id !== "proofFile" || !e.target.files[0]) return;
  var f = e.target.files[0], o = S.order;
  shrinkImage(f, 1600).then(function (data) { return api("POST", "/api/orders/" + o.token + "/proof", { image: data }); })
    .then(function () { toast("Screenshot sent to Ain"); loadOrder(o.token); }).catch(function (err) { toast(err.message || "Couldn’t send that image"); });
});
function shrinkImage(file, max) {
  return new Promise(function (res, rej) {
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function () { var s = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", 0.85)); };
    img.onerror = function () { rej(new Error("That file isn’t an image we can read.")); };
    img.src = url;
  });
}

/* ================= UX upgrade: icons, availability, date-first, home, swipe, chat, tracker ================= */
var OCC_IC = { any: "sparkle", birthday: "cake", thanks: "heart", raya: "moon", aqiqah: "baby", wedding: "rings", corporate: "briefcase", office: "briefcase" };
var CAT_IC = { cakes: "cake", cupcakes: "cupcake", bakes: "bag" };
var THEME_IC = { all: "grid", characters: "star", classic: "cake", cupcakes: "cupcake" };
function ic(n) { return n ? ' data-ic="' + n + '"' : ""; }

/* ---- availability (how full each day is) ---- */
var AV = { limit: 0, booked: {}, at: 0 };
function loadAvail(force) {
  if (!API || (!force && Date.now() - AV.at < 60000)) return Promise.resolve(false);
  AV.at = Date.now();
  return api("GET", "/api/availability").then(function (d) { AV.limit = d.limit || 0; AV.booked = d.booked || {}; return true; }).catch(function () { return false; });
}
function dayState(dt) {
  var k = ymd(dt);
  if ((C.shop.closedDates || []).indexOf(k) >= 0) return "closed";
  if (!AV.limit) return "open";
  var n = AV.booked[k] || 0;
  return n >= AV.limit ? "full" : AV.limit - n === 1 ? "low" : "open";
}
/* One month of buttons. earliest: first allowed day; keep: a date allowed even if early/full (the order's own date when changing it). */
function calDays(month, earliest, selected, keep) {
  var off = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7, days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  var h = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map(function (d) { return '<span class="dw">' + d + "</span>"; }).join("");
  for (var i = 0; i < off; i++) h += "<span></span>";
  for (var d = 1; d <= days; d++) {
    var dt = new Date(month.getFullYear(), month.getMonth(), d), isCur = selected && +selected === +dt, isKeep = keep && +keep === +dt;
    var st = dt < today ? "past" : dayState(dt), early = dt < earliest;
    var bad = !isKeep && (early || st === "closed" || st === "full" || st === "past");
    var why = st === "full" ? ", fully booked" : st === "closed" ? ", closed" : early ? ", too soon" : st === "low" ? ", 1 slot left" : "";
    h += '<button type="button" data-day="' + d + '" class="d-' + (st === "past" ? "past" : early && st === "open" ? "soon" : st) + '"' + (bad ? " disabled" : "") + ' aria-pressed="' + !!isCur + '" aria-label="' + d + " " + MONTHS[month.getMonth()] + why + '">' + d + "<i></i></button>";
  }
  return h;
}

/* ---- "delivering on" bar shown in the shop and designs once a date is picked ---- */
function whenBar() {
  if (!S.date) return '<a class="whenbar empty" href="#when"><span' + ic("calendar") + '></span><span>' + TT("when.bar-empty", "Need it by a certain day? Pick the date first") + "</span><b>→</b></a>";
  return '<a class="whenbar" href="#when"><span' + ic("calendar") + '></span><span>' + TT("when.bar", "Delivering") + " <b>" + fmtDate(S.date) + "</b></span><b>" + TT("when.change", "Change") + "</b></a>";
}

/* ---- 4. Date-first ---- */
function renderWhen() {
  var earliest = addDays(today, Math.min(C.shop.leadDays.ready, C.shop.leadDays.custom));
  if (!S.whenMonth) S.whenMonth = new Date((S.date || earliest).getFullYear(), (S.date || earliest).getMonth(), 1);
  var m = S.whenMonth;
  $("#whenTitle").textContent = MONTHS[m.getMonth()] + " " + m.getFullYear();
  $("#whenGrid").innerHTML = calDays(m, earliest, S.date);
  $("#whenPrev").disabled = m.getFullYear() === today.getFullYear() && m.getMonth() === today.getMonth();
  var fits = "";
  if (S.date) {
    var gap = Math.round((S.date - today) / 86400000);
    var rows = [
      { ic: "bag", name: T("when.ready", "Ready-made cakes, cupcakes & bakes"), lead: C.shop.leadDays.ready, href: "#shop", go: T("when.ready-go", "Shop ready-made") },
      { ic: "sparkle", name: T("when.custom", "Custom cake or cupcakes from Ain’s designs"), lead: C.shop.leadDays.custom, href: "#gallery", go: T("when.custom-go", "Design a cake") },
      { ic: "chat", name: T("when.chat", "Not sure? Answer a few questions"), lead: C.shop.leadDays.custom, href: "#chat", go: T("when.chat-go", "Order by chat") }
    ];
    fits = '<h2 class="h2"' + ic("check") + ">For " + fmtDate(S.date) + ", you can order</h2>" + rows.map(function (r) {
      var okay = gap >= r.lead;
      return '<div class="fit' + (okay ? "" : " no") + '"><span class="fitic"' + ic(r.ic) + '></span><div><b>' + esc(r.name) + '</b><small>' + (okay ? "Needs " + r.lead + " days’ notice · available" : "Needs " + r.lead + " days’ notice · from " + fmtDate(addDays(today, r.lead))) + "</small></div>" +
        (okay ? '<a class="primary small-btn" href="' + r.href + '">' + esc(r.go) + "</a>" : '<span class="pill">Too soon</span>') + "</div>";
    }).join("");
  } else fits = '<p class="small muted"><span' + ic("info") + "></span>" + TT("when.hint", "Green days are open, amber days have 1 slot left, grey days are full or too soon.") + "</p>";
  $("#whenFits").innerHTML = fits;
  if (Date.now() - AV.at > 60000) loadAvail().then(function (changed) { if (changed && !$("#v-when").hidden) renderWhen(); });
}
$("#v-when").addEventListener("click", function (e) {
  var t = e.target, x;
  if ((x = t.closest("[data-day]")) && !x.disabled) { var m = S.whenMonth; S.date = new Date(m.getFullYear(), m.getMonth(), +x.dataset.day); S.calMonth = null; renderWhen(); $("#whenFits").scrollIntoView({ behavior: "smooth", block: "nearest" }); return; }
  if (t.closest("#whenPrev")) { S.whenMonth = new Date(S.whenMonth.getFullYear(), S.whenMonth.getMonth() - 1, 1); renderWhen(); return; }
  if (t.closest("#whenNext")) { S.whenMonth = new Date(S.whenMonth.getFullYear(), S.whenMonth.getMonth() + 1, 1); renderWhen(); }
});

/* ---- 1. Remembered home ---- */
function homeQuick(href, icon, title, sub) { return '<a class="quick" href="' + href + '"><span class="quickic"' + ic(icon) + '></span><b>' + title + "</b><small>" + sub + "</small></a>"; }
function renderHomeExtras() {
  var h = "";
  if (S.me) h += '<div class="hello"><span class="eyebrow"' + ic("wave") + ">Salam, " + esc((S.me.name || "there").split(" ")[0]) + '</span><h2 class="h2"' + ic("gift") + ">" + TT("home.hello", "What are we celebrating?") + "</h2></div>" +
    '<div id="homeActive"></div><div id="homeAgain"></div>';
  h += '<h2 class="h2"' + ic("sparkle") + ">" + TT("home.ways", "Three easy ways to order") + '</h2><div class="quicks">' +
    homeQuick("#when", "calendar", TT("home.way-date", "Start with the date"), TT("home.way-date-sub", "See what can be ready by your day")) +
    homeQuick("#chat", "chat", TT("home.way-chat", "Order by chat"), TT("home.way-chat-sub", "Answer a few quick questions")) +
    homeQuick("#gallery/swipe", "cards", TT("home.way-swipe", "Swipe for ideas"), TT("home.way-swipe-sub", "Love it or skip it")) + "</div>";
  h += '<h2 class="h2"' + ic("gift") + ">" + TT("home.occasions", "Shop by occasion") + '</h2><div class="occgrid">' + C.occasions.map(function (o) {
    return '<button class="occ" type="button" data-occgo="' + esc(o.id) + '"><span class="occic"' + ic(OCC_IC[o.id] || "sparkle") + "></span><b>" + esc(o.label) + "</b></button>"; }).join("") + "</div>";
  h += '<p class="soonest"><span' + ic("clock") + "></span><span>" + TT("home.soonest", "Earliest delivery:") + " ready-made <b>" + fmtDate(addDays(today, C.shop.leadDays.ready)) + "</b> · custom <b>" + fmtDate(addDays(today, C.shop.leadDays.custom)) + "</b></span></p>";
  $("#homeExtras").innerHTML = h;
  if (S.me && API) api("GET", "/api/account/orders").then(function (list) { S.myList = list; paintActive(list); paintAgain(list); }).catch(function () {});
}
var STEP_PCT = { "new": 12, confirmed: 38, baking: 64, delivering: 88 };
function paintActive(list) {
  var box = $("#homeActive"); if (!box) return;
  var o = list.filter(function (x) { return STEP_PCT[x.status] != null; })[0];
  if (!o) { box.innerHTML = ""; return; }
  box.innerHTML = '<a class="activeorder" href="#order/' + esc(o.token) + '"><span class="aoic"' + ic(o.status === "delivering" ? "truck" : o.status === "baking" ? "cake" : o.status === "confirmed" ? "check" : "clock") + '></span>' +
    '<span class="aotext"><b>' + esc(o.ref) + " · " + esc(o.statusLabel) + "</b><small>Arrives " + fmtDate(parseYmd(o.date)) + ", " + esc(o.slot) + (o.payment === "unpaid" && o.status !== "new" ? " · payment due" : "") + '</small><span class="aobar"><span style="width:' + STEP_PCT[o.status] + '%"></span></span></span><b aria-hidden="true">›</b></a>';
}
function paintAgain(list) {
  var box = $("#homeAgain"); if (!box) return;
  var seen = {}, items = [];
  list.forEach(function (o) { if (o.status === "cancelled") return; (o.items || []).forEach(function (i) { if (!i.data || i.kind === "extra") return; var k = i.name + "|" + i.detail; if (seen[k]) return; seen[k] = 1; items.push(i); }); });
  S.againItems = items.slice(0, 8);
  if (!S.againItems.length) { box.innerHTML = ""; return; }
  box.innerHTML = '<div class="row"><h2 class="h2"' + ic("repeat") + ">" + TT("home.again", "Order again") + '</h2><small class="muted">' + TT("home.again-sub", "Same as last time, 2 taps") + '</small></div><div class="againrow">' +
    S.againItems.map(function (i, n) { var pt = priceText(isNum(i.price) ? i.price * i.qty : null);
      return '<div class="again"><img src="' + esc(i.photo) + '" alt="" loading="lazy"><b>' + esc(i.name) + "</b><small>" + esc(i.detail) + (pt ? " · " + pt : "") + '</small><button class="primary small-btn" type="button" data-again="' + n + '">Add again</button></div>'; }).join("") + "</div>";
}
$("#v-home").addEventListener("click", function (e) {
  var x;
  if ((x = e.target.closest("[data-occgo]"))) { S.occ = x.dataset.occgo; go("shop"); return; }
  if ((x = e.target.closest("[data-again]"))) {
    var i = S.againItems[+x.dataset.again], line = i.kind === "custom" ? P.customLine(C, i.data) : P.readyLine(C, i.data, i.qty || 1);
    if (!line) { toast("That isn’t on the menu any more"); return; }
    S.cart.push(line); saveCart(); badges(); x.textContent = "Added ✓"; x.disabled = true; toast("Added to your order");
  }
});

/* ---- 3. Swipe for ideas + saved designs ---- */
function savedIds() { return S.saved || (S.saved = S.me && S.me.saved ? S.me.saved.slice() : load("saifs-saved", [])); }
function setSaved(ids) {
  S.saved = ids; store("saifs-saved", ids);
  if (S.me && API) api("PUT", "/api/account/saved", { ids: ids }).catch(function () {});
}
function syncSaved() { // after sign-in: keep designs saved before signing in
  if (!S.me) { S.saved = load("saifs-saved", []); return; }
  var local = load("saifs-saved", []), acct = S.me.saved || [], all = acct.concat(local.filter(function (x) { return acct.indexOf(x) < 0; }));
  S.saved = all; store("saifs-saved", all);
  if (all.length !== acct.length && API) api("PUT", "/api/account/saved", { ids: all }).catch(function () {});
}
function galList() { return on(C.gallery).filter(function (g) { return S.galTheme === "all" || g.theme === S.galTheme; }); }
function renderSwipe() {
  var box = $("#galSwipe"), list = galList(), i = S.swipeI || 0;
  if (i >= list.length) {
    box.innerHTML = '<div class="swipedone"><span class="fitic"' + ic("check") + '></span><h2 class="h2">' + TT("swipe.done", "You’ve seen them all") + '</h2><p class="lede">' + savedIds().length + ' saved so far.</p><div class="row gap"><button class="secondary" type="button" data-gmode="saved">See saved</button><button class="primary" type="button" id="swipeAgain">Start again</button></div></div>';
    return;
  }
  var g = list[i], th = find(C.galleryThemes || [], g.theme), isSaved = savedIds().indexOf(g.id) >= 0;
  box.innerHTML = '<div class="deck"><div class="deckback" aria-hidden="true"></div><div class="deckback two" aria-hidden="true"></div>' +
    '<div class="swipecard" id="swipeCard" data-design-id="' + esc(g.id) + '"><img src="' + esc(g.photo) + '" alt="' + esc(g.name) + ' by The Saif’s Bakery" draggable="false">' +
    (th ? '<span class="tag">' + esc(th.label) + "</span>" : "") + '<span class="count">' + (i + 1) + " / " + list.length + "</span>" +
    '<span class="stamp love" aria-hidden="true">SAVE</span><span class="stamp skip" aria-hidden="true">SKIP</span>' +
    '<div class="swipemeta"><b>' + esc(g.name) + "</b><small>" + esc(g.meta) + (isSaved ? " · saved ♥" : "") + "</small></div></div></div>" +
    '<div class="swipebtns"><button class="roundbtn" type="button" id="swipeSkip" aria-label="Skip this design"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
    '<button class="primary" type="button" id="swipeMine">Make this mine</button>' +
    '<button class="roundbtn love" type="button" id="swipeLove" aria-label="Save this design" aria-pressed="' + isSaved + '"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C1 8.6 3 5 6.6 5c2 0 3.4 1.1 4.4 2.5C12 6.1 13.4 5 15.4 5 19 5 21 8.6 19.6 11.8 17.5 16.4 12 21 12 21z"/></svg></button></div>' +
    '<p class="small muted center">' + TT("swipe.hint", "Swipe right to save, left to skip. Saved designs stay in your account.") + "</p>";
}
function swipeGo(dir) {
  var list = galList(), g = list[S.swipeI || 0], card = $("#swipeCard"); if (!g) return;
  if (dir > 0) { var ids = savedIds(); if (ids.indexOf(g.id) < 0) setSaved(ids.concat([g.id])); toast("Saved “" + g.name + "”"); }
  if (card) { card.style.transition = "transform .3s ease-in, opacity .3s"; card.style.transform = "translateX(" + (dir * 420) + "px) rotate(" + (dir * 18) + "deg)"; card.style.opacity = "0"; }
  setTimeout(function () { S.swipeI = (S.swipeI || 0) + 1; renderSwipe(); }, 260);
}
(function swipeDrag() {
  var sx = 0, dx = 0, card = null;
  $("#galSwipe").addEventListener("pointerdown", function (e) { card = e.target.closest("#swipeCard"); if (!card) return; sx = e.clientX; dx = 0; card.setPointerCapture(e.pointerId); card.style.transition = "none"; });
  $("#galSwipe").addEventListener("pointermove", function (e) {
    if (!card) return; dx = e.clientX - sx;
    card.style.transform = "translateX(" + dx + "px) rotate(" + (dx / 18) + "deg)";
    card.classList.toggle("lean-love", dx > 40); card.classList.toggle("lean-skip", dx < -40);
  });
  function end() { if (!card) return; var c = card; card = null; if (Math.abs(dx) > 90) swipeGo(dx > 0 ? 1 : -1); else { c.style.transition = "transform .25s"; c.style.transform = ""; c.classList.remove("lean-love", "lean-skip"); } }
  $("#galSwipe").addEventListener("pointerup", end); $("#galSwipe").addEventListener("pointercancel", end);
})();
$("#galSwipe").addEventListener("click", function (e) {
  var t = e.target;
  if (t.closest("#swipeSkip")) swipeGo(-1);
  else if (t.closest("#swipeLove")) swipeGo(1);
  else if (t.closest("#swipeAgain")) { S.swipeI = 0; renderSwipe(); }
  else if (t.closest("#swipeMine")) { var g = galList()[S.swipeI || 0]; if (g) { S.custom = fromGallery(g); S.custom.editIndex = null; S.stageView = "photo"; S.cstep = 0; go("custom"); } }
});

/* ---- 5. Order by chat ---- */
function chatSteps(a) {
  var Q = [{ k: "occ", ask: "Assalamualaikum! What’s the occasion?" }, { k: "type", ask: "Lovely. What shall Ain bake?" }];
  if (a.type !== "cupcakes") Q.push({ k: "size", ask: "How many people is the cake for?" });
  if (a.type && a.type !== "cake") Q.push({ k: "cups", ask: "And how many cupcakes?" });
  Q.push({ k: "design", ask: "Here are some of Ain’s favourites. Like one of these?" }, { k: "sponge", ask: "Which flavour?" }, { k: "name", ask: "Whose name goes on it? Add an age too if you like, e.g. “Bilal 5”." }, { k: "done", ask: "" });
  return Q;
}
function chatCustom(a) {
  var g = a.design ? find(C.gallery, a.design) : null, c = g ? fromGallery(g) : defaultCustom();
  c.type = a.type || "cake";
  if (a.size) c.size = a.size;
  if (a.cups) { c.cupSize = a.cups.size; c.cupCount = a.cups.n; }
  if (a.sponge) c.sponge = a.sponge;
  if (a.name) { var m = /^(.*?)[\s,]+(\d{1,3})$/.exec(a.name.trim()); c.name = (m ? m[1] : a.name).trim().slice(0, 14); c.age = m ? m[2] : ""; }
  var occ = find(C.occasions, a.occ); if (occ && occ.id !== "any" && !c.themeText) c.themeText = occ.label;
  return c;
}
function chatPrice(a) { if (!a.type) return null; return P.customPrice(C, toData(chatCustom(a))); }
function chatOptions(q, a) {
  if (q.k === "occ") return C.occasions.map(function (o) { return { v: o.id, label: o.id === "any" ? "Just because" : o.label, ic: OCC_IC[o.id] }; });
  if (q.k === "type") return [{ v: "cake", label: "A cake", ic: "cake" }, { v: "cupcakes", label: "Cupcakes", ic: "cupcake" }, { v: "both", label: "Cake + cupcakes", ic: "gift" }];
  if (q.k === "size") return on(B.sizes).map(function (s) { return { v: s.id, label: s.label + " · " + (s.note || "") + (priceText(s.price) ? " · " + priceText(s.price) : "") }; });
  if (q.k === "cups") { var out = []; on(B.cupcakeSizes).forEach(function (cs) { cs.counts.forEach(function (k) { out.push({ v: cs.id + "|" + k.n, label: k.n + " " + cs.label.toLowerCase() + (priceText(k.price) ? " · " + priceText(k.price) : "") }); }); }); return out; }
  if (q.k === "design") {
    var want = a.type === "cupcakes" ? "cupcakes" : "cake", pref = a.occ === "birthday" ? "characters" : "classic";
    var list = on(C.gallery).filter(function (g) { return ((g.preset || {}).type === "cupcakes") === (want === "cupcakes"); });
    list.sort(function (x, y) { return (y.theme === pref) - (x.theme === pref); });
    return list.slice(0, 4).map(function (g) { return { v: g.id, label: g.name, img: g.photo }; }).concat([{ v: "", label: "Something simple" }]);
  }
  if (q.k === "sponge") return on(B.sponges).map(function (s) { return { v: s.id, label: s.label }; });
  if (q.k === "name") return [{ v: "", label: "No name, thanks" }];
  return [{ v: "add", label: "Add to my order", primary: true, ic: "bag" }, { v: "builder", label: "Fine-tune in the builder", ic: "sliders" }, { v: "again", label: "Start again", ic: "repeat" }];
}
function chatLabel(q, a) {
  var o = chatOptions(q, a).filter(function (x) { return String(x.v) === String(a[q.k] && a[q.k].size ? a[q.k].size + "|" + a[q.k].n : a[q.k]); })[0];
  if (q.k === "name") return a.name || "No name, thanks";
  return o ? o.label : "";
}
function renderChat() {
  if (!S.chat) S.chat = { a: {}, i: 0 };
  var a = S.chat.a, Q = chatSteps(a), log = "";
  var bot = function (t, extra) { return '<div class="msg bot">' + (extra || "") + esc(t) + "</div>"; };
  for (var n = 0; n < S.chat.i && n < Q.length; n++) {
    var q = Q[n];
    if (q.k !== "done") log += bot(q.ask) + '<div class="msg me">' + esc(chatLabel(q, a)) + "</div>";
  }
  var cur = Q[Math.min(S.chat.i, Q.length - 1)], price = chatPrice(a);
  if (cur.k === "done") {
    var c = chatCustom(a);
    log += '<div class="msg bot summary"><b' + ic("receipt") + '>Here’s your order</b><span>' + esc(P.customSummary(C, toData(c))) + "</span>" + (priceText(price) ? "<b>" + priceText(price) + "</b>" : "") + "<small>Ain will confirm the details and can add your reference photos on WhatsApp.</small></div>";
  } else if (!S.chat.typing) log += bot(cur.ask);
  if (S.chat.typing) log += '<div class="msg bot typing" aria-label="Typing"><i></i><i></i><i></i></div>';
  $("#chatLog").innerHTML = log;
  $("#chatTotal").textContent = priceText(price) || "";
  var opts = S.chat.typing ? [] : chatOptions(cur, a), rep = "";
  if (!S.chat.typing && cur.k === "design") rep = '<div class="chatpics">' + opts.filter(function (o) { return o.img; }).map(function (o) { return '<button type="button" class="chatpic" data-cv="' + esc(o.v) + '"><img src="' + esc(o.img) + '" alt=""><span>' + esc(o.label) + "</span></button>"; }).join("") + "</div>" +
    opts.filter(function (o) { return !o.img; }).map(function (o) { return '<button type="button" class="chip" data-cv="' + esc(o.v) + '">' + esc(o.label) + "</button>"; }).join("");
  else if (!S.chat.typing && cur.k === "name") rep = '<form id="chatName" class="chatname"><label class="sr" for="chatNameIn">Name and age</label><input id="chatNameIn" maxlength="24" placeholder="e.g. Bilal 5" autocomplete="off"><button class="primary small-btn" type="submit">Send</button></form>' +
    '<button type="button" class="chip" data-cv="">No name, thanks</button>';
  else rep = opts.map(function (o) { return '<button type="button" class="' + (o.primary ? "primary small-btn" : "chip") + '" data-cv="' + esc(o.v) + '"><span' + ic(o.ic) + "></span>" + esc(o.label) + "</button>"; }).join("");
  $("#chatReplies").innerHTML = rep;
  var lg = $("#chatLog"); lg.scrollTop = lg.scrollHeight;
  var last = lg.lastElementChild; if (last && last.scrollIntoView && !$("#v-chat").hidden) last.scrollIntoView({ block: "nearest" });
}
function chatAnswer(v) {
  var a = S.chat.a, Q = chatSteps(a), q = Q[S.chat.i];
  if (q.k === "done") {
    var c = chatCustom(a);
    if (v === "add") { S.cart.push(P.customLine(C, toData(c))); saveCart(); badges(); toast("Added to your order"); S.chat = null; go("cart"); return; }
    if (v === "builder") { S.custom = c; S.custom.editIndex = null; S.stageView = c.photo ? "photo" : "3d"; S.cstep = 0; go("custom"); return; }
    S.chat = { a: {}, i: 0 }; renderChat(); return;
  }
  if (q.k === "cups") { var p = String(v).split("|"); a.cups = { size: p[0], n: +p[1] }; }
  else a[q.k] = v;
  if (q.k === "type") { delete a.size; delete a.cups; delete a.design; }
  S.chat.i++; S.chat.typing = true; renderChat();
  setTimeout(function () { if (S.chat) { S.chat.typing = false; renderChat(); } }, 550);
}
$("#v-chat").addEventListener("click", function (e) { var b = e.target.closest("[data-cv]"); if (b && S.chat && !S.chat.typing) chatAnswer(b.dataset.cv); });
$("#v-chat").addEventListener("submit", function (e) { e.preventDefault(); if (e.target.id === "chatName" && S.chat) { S.chat.a.name = $("#chatNameIn").value.trim(); chatAnswer(S.chat.a.name); } });

/* ---- 6. Live order tracker ---- */
var TRACK = {
  "new": ["clock", "Ain has your order", "She’ll confirm it soon. Until then you can still edit or cancel it."],
  confirmed: ["check", "Confirmed. See you soon!", "Ain will start baking closer to the day."],
  baking: ["cake", "Your bake is in the oven", "Fresh for your delivery day."],
  delivering: ["truck", "On the way to you", "Arriving today."],
  delivered: ["gift", "Delivered. Selamat menjamu selera!", "We hope it made them squeal. Tag @bake.withthesaifs on Instagram!"],
  cancelled: ["info", "This order was cancelled", "Message Ain on WhatsApp if this is a mistake."]
};
function whenOf(o, s) {
  var label = { confirmed: "Confirmed", baking: "Baking", delivering: "Out for delivery", delivered: "Delivered" }[s];
  var ev = (o.events || []).filter(function (e) { return label && e.message.indexOf("Status: " + label) >= 0; }).pop();
  return ev ? new Date(ev.at) : s === "new" ? new Date(o.createdAt) : null;
}
function stamp(d) { return d.toLocaleString("en-SG", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); }
function trackerHtml(o) {
  var idx = -1; STEPS.forEach(function (s, i) { if (s[0] === o.status) idx = i; });
  var cancelled = o.status === "cancelled", t = TRACK[o.status] || TRACK["new"], deliv = parseYmd(o.date);
  var days = Math.round((deliv - today) / 86400000), sub = t[2];
  if (o.status === "confirmed" && o.payment !== "paid") sub = "Pay by PayNow below to lock in your slot.";
  if (o.status === "delivering") sub = "Arriving " + o.slot + ".";
  var payTxt = o.payment === "paid" ? "Paid" : o.payment === "proof_sent" ? "Checking" : "Unpaid";
  var future = { confirmed: "Usually within a few hours", baking: fmtDate(addDays(deliv, -1)), delivering: fmtDate(deliv) + ", " + o.slot, delivered: fmtDate(deliv) };
  var tl = '<ol class="timeline' + (cancelled ? " cancelled" : "") + '">' + STEPS.map(function (s, i) {
    var w = whenOf(o, s[0]), st = i < idx ? "done" : i === idx ? "now" : "todo";
    return '<li class="' + st + '"><span class="tdot">' + (st === "done" || (st === "now" && s[0] === "delivered") ? "✓" : "") + '</span><div><b>' + esc(s[1]) + "</b><small>" + esc(w && i <= idx ? stamp(w) : (future[s[0]] || "")) + "</small></div></li>";
  }).join("") + "</ol>";
  return '<div class="trackhero"><span class="eyebrow"' + ic("box") + ">Order " + esc(o.ref) + '</span><h1 class="h1"' + ic(t[0]) + ">" + esc(t[1]) + "</h1><p>" + esc(sub) + "</p>" +
    '<div class="trackstats"><div><b>' + (cancelled ? "–" : o.status === "delivered" ? "✓" : days <= 0 ? "Today" : days) + "</b><small>" + (o.status === "delivered" || days <= 0 ? "delivery" : days === 1 ? "day to go" : "days to go") + '</small></div><div><b>' + (isNum(o.total) ? money(o.total) : "–") + '</b><small>total</small></div><div><b>' + payTxt + "</b><small>payment</small></div></div></div>" +
    '<h2 class="h2"' + ic("list") + ">Progress</h2>" + tl;
}

/* ---------------- customer account ---------------- */
function acctBadge() {
  var i = $("#acctInitial"), b = $("#acctBtn");
  if (S.me) { i.textContent = (S.me.name || S.me.email || "?").trim().charAt(0).toUpperCase(); i.hidden = false; b.classList.add("in"); b.setAttribute("aria-label", "Your account"); }
  else { i.hidden = true; b.classList.remove("in"); b.setAttribute("aria-label", "Sign in or create an account"); }
}
function fillFromMe() {
  if (!S.me) return;
  if (!$("#sName").value) $("#sName").value = S.me.name || "";
  if (!$("#sPhone").value) $("#sPhone").value = S.me.phone || "";
  if (!$("#addr").value) $("#addr").value = S.me.address || "";
}
function orderRow(o) {
  return '<a class="myorder" href="#order/' + esc(o.token) + '"><span><b>' + esc(o.ref) + "</b> · " + esc(o.statusLabel) + '<br><small>' + esc(fmtDate(parseYmd(o.date))) + " · " + esc(o.firstItem || "") + (o.itemCount > 1 ? " + " + (o.itemCount - 1) + " more" : "") + "</small></span><span>" + (isNum(o.total) ? money(o.total) : "") + " →</span></a>";
}
var acctMode = "signin";
var GOOGLE_SVG = '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
function renderAccount() {
  var box = $("#accountBody");
  if (!API) { box.innerHTML = '<h1 class="h1">Your account</h1><p class="lede">Accounts need the full app. Please WhatsApp Ain to order.</p>'; return; }
  var err = new URLSearchParams(location.search).get("autherr");
  if (S.me) {
    var m = S.me;
    box.innerHTML = '<div class="acctgrid"><div class="stack">' +
      '<span class="eyebrow"' + ic("user") + '>Signed in as ' + esc(m.email) + '</span><h1 class="h1"' + ic("wave") + '>Salam, ' + esc((m.name || "there").split(" ")[0]) + '!</h1>' +
      (S.after ? '<div class="notice ain"><b' + ic("check") + '>You’re signed in</b><span>Carry on with your order.</span><a class="primary" href="#' + esc(S.after) + '">Continue to delivery details</a></div>' : "") +
      '<h2 class="h2"' + ic("list") + '>Your orders</h2><div id="acctOrders" class="stack"><p class="small muted">Loading…</p></div></div>' +
      '<form class="card-panel stack" id="profileForm" novalidate><h2 class="h2"' + ic("user") + '>Your details</h2>' +
      '<div class="field"><label for="pName">Name</label><input id="pName" autocomplete="name" value="' + esc(m.name) + '" required></div>' +
      '<div class="field"><label for="pPhone">Phone (WhatsApp)</label><input id="pPhone" type="tel" autocomplete="tel" value="' + esc(m.phone) + '" placeholder="+65"></div>' +
      '<div class="field"><label for="pAddr">Delivery address</label><textarea id="pAddr" rows="2" autocomplete="street-address" placeholder="Block, street, unit, postal code">' + esc(m.address) + "</textarea></div>" +
      '<details class="pwbox"><summary>' + (m.hasPassword ? "Change password" : "Add a password (so you can also sign in with email)") + "</summary>" +
      (m.hasPassword ? '<div class="field"><label for="pCur">Current password</label><input id="pCur" type="password" autocomplete="current-password"></div>' : "") +
      '<div class="field"><label for="pNew">New password (8+ characters)</label><input id="pNew" type="password" autocomplete="new-password" minlength="8"></div></details>' +
      '<p class="err" id="profileErr" role="alert"></p><div class="row gap"><button class="primary" type="submit">Save details</button><button class="secondary" type="button" id="signOutBtn">Sign out</button></div></form></div>';
    api("GET", "/api/account/orders").then(function (list) {
      $("#acctOrders").innerHTML = list.length ? list.map(orderRow).join("") : '<div class="empty-note">No orders yet. <a class="link" href="#shop">Browse the bakes</a></div>';
    }).catch(function (e) { $("#acctOrders").innerHTML = '<p class="small muted">' + esc(e.message) + "</p>"; });
    popWords($("#v-account"));
    return;
  }
  var next = S.after ? "#" + S.after : "#account";
  box.innerHTML = '<div class="authcard">' +
    '<img src="img/logo.png" alt="" width="72" height="72" class="authlogo">' +
    '<h1 class="h1"' + ic(acctMode === "signup" ? "user" : "lock") + '>' + (acctMode === "signup" ? TT("account.signup-title", "Create your account") : TT("account.signin-title", "Welcome back")) + "</h1>" +
    '<p class="lede">' + (S.after ? TT("account.lede-checkout", "Sign in or create an account to place your order. Your basket is saved.") : TT("account.lede", "Track your orders, pay by PayNow and reorder faster.")) + "</p>" +
    (err ? '<p class="err" role="alert">' + esc(err) + "</p>" : "") +
    '<div class="seg" role="tablist"><button type="button" role="tab" data-amode="signin" aria-selected="' + (acctMode === "signin") + '">Sign in</button><button type="button" role="tab" data-amode="signup" aria-selected="' + (acctMode === "signup") + '">Create account</button></div>' +
    (S.google !== false ? '<a class="googlebtn" href="/api/auth/google/start?as=customer&amp;next=' + encodeURIComponent(next) + '">' + GOOGLE_SVG + "Continue with Google</a>" +
      '<div class="ordiv"><span>or with email</span></div>' : "") +
    '<form id="authForm" class="stack" novalidate>' +
    (acctMode === "signup" ? '<div class="field"><label for="aName">Your name</label><input id="aName" autocomplete="name" required></div>' +
      '<div class="field"><label for="aPhone">Phone (WhatsApp)</label><input id="aPhone" type="tel" autocomplete="tel" placeholder="+65" required></div>' : "") +
    '<div class="field"><label for="aEmail">Email</label><input id="aEmail" type="email" autocomplete="email" required></div>' +
    '<div class="field"><label for="aPw">Password' + (acctMode === "signup" ? " (8+ characters)" : "") + '</label><input id="aPw" type="password" autocomplete="' + (acctMode === "signup" ? "new-password" : "current-password") + '" required></div>' +
    '<p class="err" id="authErr" role="alert"></p>' +
    '<button class="primary" type="submit" id="authBtn">' + (acctMode === "signup" ? "Create account" : "Sign in") + "</button>" +
    (acctMode === "signin" ? '<p class="small muted">Forgot your password? WhatsApp Ain and she’ll send you a new one.</p>' : '<p class="small muted">By creating an account you agree to our <a class="link" href="privacy.html">privacy notice</a>.</p>') +
    "</form>" +
    '<p class="small staff">Bakery staff? <a class="link" href="admin.html">Sign in to Ain’s Kitchen</a></p></div>';
  popWords($("#v-account"));
}
$("#v-account").addEventListener("click", function (e) {
  var b = e.target.closest("[data-amode]");
  if (b) { acctMode = b.dataset.amode; renderAccount(); var f = $("#aName") || $("#aEmail"); if (f) f.focus(); return; }
  if (e.target.closest("#signOutBtn")) {
    api("POST", "/api/account/logout", {}).then(function () { S.me = null; acctMode = "signin"; acctBadge(); $("#sName").value = ""; $("#sPhone").value = ""; $("#addr").value = ""; toast("Signed out"); renderAccount(); renderMyOrders(); });
  }
});
$("#v-account").addEventListener("submit", function (e) {
  e.preventDefault();
  if (e.target.id === "authForm") {
    var body = { email: $("#aEmail").value.trim(), password: $("#aPw").value };
    if (acctMode === "signup") { body.name = $("#aName").value.trim(); body.phone = $("#aPhone").value.trim(); }
    $("#authBtn").disabled = true; $("#authErr").textContent = "";
    api("POST", acctMode === "signup" ? "/api/account/signup" : "/api/account/login", body).then(loadMe).then(function () {
      toast(acctMode === "signup" ? "Account created" : "Signed in"); acctMode = "signin";
      if (location.search) history.replaceState(null, "", "/" + location.hash);
      if (S.after) { var n = S.after; S.after = null; go(n); } else renderAccount();
    }).catch(function (er) { $("#authErr").textContent = er.message; $("#authBtn").disabled = false; });
  }
  if (e.target.id === "profileForm") {
    var p = { name: $("#pName").value.trim(), phone: $("#pPhone").value.trim(), address: $("#pAddr").value.trim() };
    if ($("#pNew") && $("#pNew").value) { p.newPassword = $("#pNew").value; p.currentPassword = $("#pCur") ? $("#pCur").value : ""; }
    $("#profileErr").textContent = "";
    api("PUT", "/api/account/me", p).then(loadMe).then(function () { $("#sName").value = ""; $("#sPhone").value = ""; $("#addr").value = ""; fillFromMe(); toast("Details saved"); renderAccount(); })
      .catch(function (er) { $("#profileErr").textContent = er.message; });
  }
});
function loadMe() {
  return api("GET", "/api/account/me").then(function (d) { S.me = d.customer; S.google = d.google; acctBadge(); fillFromMe(); syncSaved(); }).catch(function () { S.me = null; acctBadge(); });
}

/* ---------------- boot ---------------- */
function applyCatalog(cat) { C = cat; B = C.builder; }
function boot() {
  $("#instaLink").href = C.shop.instagram; $("#footInsta").href = C.shop.instagram;
  var me = S.me ? null : load("saifs-me", null); if (me) { $("#sName").value = me.name || ""; $("#sPhone").value = me.phone || ""; $("#addr").value = me.address || ""; }
  badges(); bgSprinkles(); acctBadge(); route();
}
fetch("/api/catalog").then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
  .then(function (cat) { applyCatalog(cat); return Promise.all([loadMe(), window.SaifsSite ? window.SaifsSite.load() : null]); }).catch(function () { API = false; })
  .then(function () { if (window.SaifsSite) window.SaifsSite.init(); boot(); });
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(function () {});
})();
