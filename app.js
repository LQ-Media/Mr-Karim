(function () {
"use strict";
var C = window.SAIFS_CONFIG;
var $ = function (s, el) { return (el || document).querySelector(s); };
var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
var money = function (n) { return "$" + (Math.round(n * 100) / 100).toFixed(n % 1 ? 2 : 0); };
var isNum = function (v) { return typeof v === "number" && isFinite(v); };

/* ---------------- custom builder data ---------------- */
var PALETTES = {
  Classic: { frost: "#FFF6E6", trim: "#F2C66D", accent: "#A84D2E", drip: "#3B2418" },
  Blush:   { frost: "#F6D5CB", trim: "#FFFFFF", accent: "#D98C8C", drip: "#E9A3A3" },
  Ocean:   { frost: "#D6E4F0", trim: "#FFFFFF", accent: "#5F8FBF", drip: "#4A7BB0" },
  Cherry:  { frost: "#D8434B", trim: "#FFFFFF", accent: "#9E1F2A", drip: "#7A1420" },
  Sunshine:{ frost: "#FFE38A", trim: "#7FC3E8", accent: "#F2A33A", drip: "#F2A33A" },
  Leaf:    { frost: "#B9D98C", trim: "#7A5A3A", accent: "#5E8F3E", drip: "#5A3726" },
  Safari:  { frost: "#DCE3CF", trim: "#F2C66D", accent: "#A8794F", drip: "#8A5A2B" },
  Cocoa:   { frost: "#6B4430", trim: "#3B2418", accent: "#F2C66D", drip: "#2A170F" }
};
var SPONGE = { Vanilla: "#F3DDA8", Chocolate: "#5A3726", "Red velvet": "#9E2B2B", Banana: "#E9C77B", Pandan: "#9CC27E" };
var FILLINGS = ["Vanilla buttercream", "Chocolate ganache", "Cream cheese", "Nutella", "Cookies & cream", "Strawberry"];
var DECOR = ["Theme toppers", "Name plaque", "Candles", "Sprinkles", "Gummy bears & candy", "Flowers", "Drip", "Gold beads"];
var CAKE_SIZES = [["5", '5"', "4–6 pax"], ["6", '6"', "8–10 pax"], ["7", '7"', "10–12 pax"], ["8", '8"', "14–16 pax"], ["10", '10"', "20–25 pax"]];
var CUP_COUNTS = { Regular: [6, 12, 24], Mini: [16, 25, 50] };

/* ---------------- state ---------------- */
var S = { shopCat: "cakes", occ: "any", galTheme: "all", pd: null, custom: null, cart: [], date: null, slot: C.slots[1] || C.slots[0], mode: "Delivery", calMonth: null, stageView: "3d" };
try { var saved = JSON.parse(localStorage.getItem("saifs-cart") || "[]"); if (Array.isArray(saved)) S.cart = saved; } catch (e) {}
function saveCart() { try { localStorage.setItem("saifs-cart", JSON.stringify(S.cart)); } catch (e) {} }

function defaultCustom() {
  return { base: "", baseId: null, photo: null, type: "cake", size: "6", tiers: 1, shape: "round", sponge: "Vanilla", filling: "Vanilla buttercream",
    finish: "Buttercream", palette: "Classic", decor: new Set(["Name plaque"]), themeText: "", name: "", age: "", greeting: "Happy Birthday",
    cupSize: "Regular", cupCount: 12, diet: new Set(), hasRef: false };
}
function fromGallery(g) {
  var c = defaultCustom(), p = g.preset || {};
  Object.keys(p).forEach(function (k) { if (k !== "decor") c[k] = p[k]; });
  c.decor = new Set(p.decor || []); c.base = g.name; c.baseId = g.id; c.photo = g.photo;
  return c;
}

/* ---------------- prices (only when enabled) ---------------- */
function productPrice(p, label) { var o = p.options.filter(function (x) { return x.label === label; })[0]; return o && isNum(o.price) ? o.price : null; }
function customPrice(c) {
  var P = C.customPrices || {}, total = 0;
  if (c.type !== "cupcakes") {
    var base = P.cake && P.cake[c.size]; if (!isNum(base)) return null; total += base;
    if (c.tiers === 2) { if (!isNum(P.secondTier)) return null; total += P.secondTier; }
    if (c.finish === "Fondant") { if (!isNum(P.fondant)) return null; total += P.fondant; }
    if (c.shape === "heart" && isNum(P.heartShape)) total += P.heartShape;
    c.decor.forEach(function (d) { if (P.decor && isNum(P.decor[d])) total += P.decor[d]; });
  }
  if (c.type !== "cake") {
    var cp = P.cupcakes && P.cupcakes[c.cupSize] && P.cupcakes[c.cupSize][c.cupCount]; if (!isNum(cp)) return null; total += cp;
    if (c.decor.has("Theme toppers") && P.cupcakeToppers && isNum(P.cupcakeToppers[c.cupSize])) total += P.cupcakeToppers[c.cupSize] * c.cupCount;
  }
  return Math.round(total);
}
function deliveryFee(sub) { var d = C.delivery || {}; if (!isNum(d.fee)) return null; return isNum(d.freeAbove) && isNum(sub) && sub >= d.freeAbove ? 0 : d.fee; }
function priceText(n) { return C.showPrices && isNum(n) ? money(n) : null; }

/* ---------------- routing ---------------- */
var VIEWS = ["home", "shop", "product", "gallery", "custom", "cart", "date", "send", "done"];
var TAB = { home: "home", shop: "shop", product: "shop", gallery: "gallery", custom: "gallery", cart: "cart", date: "cart", send: "cart", done: "home" };
var live = null;
function route() {
  var v = (location.hash || "#home").slice(1).split("/")[0];
  if (VIEWS.indexOf(v) < 0) v = "home";
  if (v === "product" && !S.pd) v = "shop";
  if (v === "custom" && !S.custom) S.custom = defaultCustom();
  if ((v === "date" || v === "send") && !S.cart.length) v = "cart";
  if (v === "send" && !S.date) v = "date";
  VIEWS.forEach(function (n) { $("#v-" + n).hidden = n !== v; });
  document.body.dataset.mode = $("#v-" + v).dataset.mode;
  $$(".tabs a").forEach(function (a) { if (a.dataset.tab === TAB[v]) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  ({ home: renderHome, shop: renderShop, product: renderProduct, gallery: renderGallery, custom: renderCustom, cart: renderCart, date: renderDate, send: renderSend, done: function () {} })[v]();
  if (v !== "custom" && live) live.stop();
  popWords($("#v-" + v));
  if (v === "done") sprinkleBurst();
  window.scrollTo(0, 0);
}
/* Design 1: headlines pop in word by word */
function popWords(view) {
  $$(".h1, .h2.big", view).forEach(function (h) {
    if (h.dataset.popped === h.textContent) return;
    var text = h.textContent.trim();
    h.setAttribute("aria-label", text);
    h.innerHTML = text.split(/\s+/).map(function (w, i) { return '<span class="pw" aria-hidden="true" style="--d:' + (i * 0.07).toFixed(2) + 's">' + esc(w) + "</span>"; }).join(" ");
    h.dataset.popped = h.textContent;
  });
  view.classList.remove("enter"); void view.offsetWidth; view.classList.add("enter");
}
/* Design 1: sprinkles everywhere, burst on success */
function bgSprinkles() {
  var cols = ["#F28B82", "#7FB7E6", "#F2C66D", "#8CCB8A", "#E9B49E", "#A84D2E", "#C7A1E8"], sp = "";
  for (var i = 0; i < 14; i++) sp += '<span style="left:' + ((i * 71) % 100) + '%;background:' + cols[i % 7] + ';animation-duration:' + (9 + (i * 37) % 7) + 's;animation-delay:-' + ((i * 13) % 11) + 's"></span>';
  var d = document.createElement("div"); d.className = "bgsprinkles"; d.setAttribute("aria-hidden", "true"); d.innerHTML = sp; document.body.prepend(d);
}
function sprinkleBurst() {
  var host = $("#v-done .ok"); if (!host) return;
  var old = $(".burstbox"); if (old) old.remove();
  var cols = ["#F28B82", "#7FB7E6", "#F2C66D", "#8CCB8A", "#A84D2E", "#E9B49E", "#C7A1E8"], h = "";
  for (var i = 0; i < 36; i++) { var a = i / 36 * Math.PI * 2, r = 110 + (i * 37) % 120; h += '<span style="--dx:' + Math.round(Math.cos(a) * r) + 'px;--dy:' + Math.round(Math.sin(a) * r - 60) + 'px;--rot:' + ((i * 47) % 720) + 'deg;background:' + cols[i % 7] + '"></span>'; }
  var b = document.createElement("div"); b.className = "burstbox"; b.setAttribute("aria-hidden", "true"); b.innerHTML = h; host.appendChild(b);
}
function go(v) { if (location.hash === "#" + v) route(); else location.hash = v; }
window.addEventListener("hashchange", route);
function toast(msg) { var t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove("on"); }, 2200); }
function badges() { var n = S.cart.reduce(function (a, i) { return a + i.qty; }, 0); ["#cartBadge", "#tabBadge"].forEach(function (s) { var b = $(s); b.textContent = n; b.dataset.n = n; }); }

/* ---------------- home & shop ---------------- */
function pcard(p) {
  var prices = p.options.map(function (o) { return o.price; }).filter(isNum);
  var pt = C.showPrices && prices.length ? "from " + money(Math.min.apply(null, prices)) : "";
  return '<button class="card" type="button" data-prod="' + p.id + '"><span class="photo"><span class="tag">' + esc(p.tag) + '</span><img src="' + p.photo + '" alt="' + esc(p.name) + '" loading="lazy"></span>' +
    '<span class="meta"><span class="nm">' + esc(p.name) + '</span><span class="sb">' + p.options.map(function (o) { return esc(o.label); }).join(" · ") + '</span>' + (pt ? '<span class="pr">' + pt + '</span>' : '') + '</span></button>';
}
function gcard(g) {
  return '<button class="card" type="button" data-design="' + g.id + '"><span class="photo"><img src="' + g.photo + '" alt="' + esc(g.name) + ' by The Saif’s Bakery" loading="lazy"></span>' +
    '<span class="meta"><span class="nm">' + esc(g.name) + '</span><span class="sb">' + esc(g.meta) + '</span><span class="go">Make this mine →</span></span></button>';
}
function renderHome() {
  $("#readyNote").textContent = "Ready-made bakes need " + C.leadDays.ready + " days’ notice; custom orders " + C.leadDays.custom + ".";
  if ($("#row1").children.length) return;
  var thumb = function (p) { return p.replace("img/", "img/thumbs/"); };
  var cakes = C.gallery.filter(function (g) { return g.preset && g.preset.type !== "cupcakes"; });
  var rest = C.gallery.filter(function (g) { return !g.preset || g.preset.type === "cupcakes"; }).concat(C.products.filter(function (p) { return p.cat !== "cakes"; }));
  var tile = function (it) {
    return '<button class="tile" type="button" data-' + (it.preset ? "design" : "prod") + '="' + it.id + '" tabindex="-1" aria-label="' + esc(it.name) + '"><img src="' + thumb(it.photo) + '" alt="" loading="eager" decoding="async"></button>';
  };
  var dbl = function (arr) { return arr.concat(arr).map(tile).join(""); };
  $("#row1").innerHTML = dbl(cakes); $("#row2").innerHTML = dbl(rest);
  var cols = ["#F28B82", "#7FB7E6", "#F2C66D", "#8CCB8A", "#E9B49E", "#A84D2E", "#C7A1E8"], sp = "";
  for (var i = 0; i < 26; i++) sp += '<span style="left:' + ((i * 53) % 100) + '%;background:' + cols[i % 7] + ';animation-duration:' + (6 + (i * 37) % 7) + 's;animation-delay:-' + ((i * 13) % 9) + 's"></span>';
  $("#sprinkles").innerHTML = sp;
}
function renderShop() {
  var cats = [["cakes", "Cakes"], ["cupcakes", "Cupcakes"], ["bakes", "Tarts & bakes"]];
  $("#shopTabs").innerHTML = cats.map(function (c) { return '<button role="tab" type="button" aria-selected="' + (S.shopCat === c[0]) + '" data-cat="' + c[0] + '">' + c[1] + '</button>'; }).join("");
  var occ = [["any", "Any day"], ["birthday", "Birthday"], ["thanks", "Thank you"], ["raya", "Raya"], ["aqiqah", "Aqiqah"]];
  $("#occChips").innerHTML = occ.map(function (o) { return '<button class="chip" type="button" aria-pressed="' + (S.occ === o[0]) + '" data-occ="' + o[0] + '">' + o[1] + '</button>'; }).join("");
  var list = C.products.filter(function (p) { return p.cat === S.shopCat && (S.occ === "any" || p.occasions.indexOf(S.occ) >= 0); });
  $("#shopGrid").innerHTML = list.length ? list.map(pcard).join("") : '<p class="lede" style="grid-column:1/-1">Nothing here for that occasion yet. <a class="link" href="#gallery">Try a custom order</a>.</p>';
}
$("#v-shop").addEventListener("click", function (e) {
  var c = e.target.closest("[data-cat]"); if (c) { S.shopCat = c.dataset.cat; renderShop(); }
  var o = e.target.closest("[data-occ]"); if (o) { S.occ = o.dataset.occ; renderShop(); }
});
document.addEventListener("click", function (e) {
  var p = e.target.closest("[data-prod]");
  if (p) { var prod = C.products.filter(function (x) { return x.id === p.dataset.prod; })[0]; S.pd = { p: prod, opt: prod.options[0].label, plaque: "None", own: "", candles: false, qty: 1 }; go("product"); }
  var d = e.target.closest("[data-design]");
  if (d) { var g = C.gallery.filter(function (x) { return x.id === d.dataset.design; })[0]; S.custom = fromGallery(g); S.stageView = "photo"; go("custom"); }
});

/* ---------------- product ---------------- */
var PLAQUES = ["None", "Happy Birthday", "Selamat Hari Jadi", "Barakallah", "Thank you", "Own words"];
function renderProduct() {
  var d = S.pd; if (!d) return; var p = d.p, unit = productPrice(p, d.opt), pt = priceText(isNum(unit) ? unit * d.qty : null);
  $("#v-product").innerHTML =
    '<div class="hero"><a href="#shop" class="iconbtn back" aria-label="Back to shop"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></a>' +
    '<img src="' + p.photo + '" alt="' + esc(p.name) + '"></div>' +
    '<div class="stack" style="gap:6px"><h1 class="h1">' + esc(p.name) + '</h1><p class="lede">' + esc(p.desc) + '</p></div>' +
    '<fieldset class="group"><legend><span>Choose</span></legend><div class="sizes">' +
    p.options.map(function (o) { var op = priceText(o.price); return '<button class="opt" type="button" data-opt="' + esc(o.label) + '" aria-pressed="' + (d.opt === o.label) + '"><b>' + esc(o.label) + '</b>' + ((o.note || op) ? '<small>' + esc([o.note, op].filter(Boolean).join(" · ")) + '</small>' : '') + '</button>'; }).join("") + '</div></fieldset>' +
    (p.plaque ? '<fieldset class="group"><legend><span>Message plaque</span><span>free</span></legend><div class="opts">' +
      PLAQUES.map(function (l) { return '<button class="chip" type="button" data-plaque="' + l + '" aria-pressed="' + (d.plaque === l) + '">' + l + '</button>'; }).join("") + '</div>' +
      (d.plaque === "Own words" ? '<div class="field"><label for="ownWords">Your words (up to 20 letters)</label><input id="ownWords" maxlength="20" value="' + esc(d.own) + '"></div>' : '') + '</fieldset>' +
      '<div class="switchrow"><span>Add candles</span><button class="switch" type="button" role="switch" aria-checked="' + d.candles + '" aria-label="Add candles" id="candleSw"><span></span></button></div>' : '') +
    '<div class="actionbar"><div class="stepper"><button type="button" data-q="-1" aria-label="Fewer">−</button><span aria-live="polite">' + d.qty + '</span><button type="button" data-q="1" aria-label="More">+</button></div>' +
    '<button class="primary" type="button" id="pAdd" style="flex:1">Add to order' + (pt ? " · " + pt : "") + '</button></div>';
}
$("#v-product").addEventListener("click", function (e) {
  var d = S.pd; if (!d) return; var t = e.target, x;
  if ((x = t.closest("[data-opt]"))) { d.opt = x.dataset.opt; renderProduct(); return; }
  if ((x = t.closest("[data-plaque]"))) { d.plaque = x.dataset.plaque; renderProduct(); if (d.plaque === "Own words") $("#ownWords").focus(); return; }
  if (t.closest("#candleSw")) { d.candles = !d.candles; renderProduct(); return; }
  if ((x = t.closest("[data-q]"))) { d.qty = Math.max(1, d.qty + (+x.dataset.q)); renderProduct(); return; }
  if (t.closest("#pAdd")) {
    var p = d.p, bits = [d.opt];
    if (p.plaque && d.plaque !== "None") bits.push('"' + (d.plaque === "Own words" ? (d.own.trim() || "own words") : d.plaque) + '" plaque');
    if (p.plaque && d.candles) bits.push("candles");
    S.cart.push({ type: "ready", photo: p.photo, name: p.name, detail: bits.join(" · "), price: productPrice(p, d.opt), qty: d.qty });
    saveCart(); badges(); toast("Added to your order"); go("cart");
  }
});
$("#v-product").addEventListener("input", function (e) { if (e.target.id === "ownWords") S.pd.own = e.target.value; });

/* ---------------- gallery ---------------- */
function renderGallery() {
  var th = [["all", "All designs"], ["characters", "Characters"], ["classic", "Classic"], ["cupcakes", "Cupcakes"]];
  $("#galTheme").innerHTML = th.map(function (t) { return '<button class="chip" type="button" aria-pressed="' + (S.galTheme === t[0]) + '" data-gth="' + t[0] + '">' + t[1] + '</button>'; }).join("");
  var list = C.gallery.filter(function (g) { return S.galTheme === "all" || g.theme === S.galTheme; });
  $("#galGrid").innerHTML = list.map(gcard).join("");
}
$("#v-gallery").addEventListener("click", function (e) { var b = e.target.closest("[data-gth]"); if (b) { S.galTheme = b.dataset.gth; renderGallery(); } });
$("#startBlank").addEventListener("click", function () { S.custom = defaultCustom(); S.stageView = "3d"; go("custom"); });

/* ---------------- customise ---------------- */
function single(key, title, hint, opts) {
  var c = S.custom;
  return '<fieldset class="group"><legend><span>' + title + '</span><span>' + (hint || "") + '</span></legend><div class="opts">' +
    opts.map(function (o) { return '<button class="opt" type="button" data-k="' + key + '" data-v="' + esc(o[0]) + '" aria-pressed="' + (String(c[key]) === String(o[0])) + '"><b>' + esc(o[1]) + '</b>' + (o[2] ? '<small>' + esc(o[2]) + '</small>' : '') + '</button>'; }).join("") + '</div></fieldset>';
}
function toggles(attr, list, set) { return list.map(function (d) { return '<button class="tog" type="button" data-' + attr + '="' + esc(d) + '" aria-pressed="' + set.has(d) + '">' + esc(d) + '</button>'; }).join(""); }
function renderCustom() {
  var c = S.custom, cake = c.type !== "cupcakes", cups = c.type !== "cake";
  $("#cBase").textContent = "Step 2 of 4 · " + (c.baseId ? "based on " + c.base : "blank design");
  var pal = Object.keys(PALETTES).map(function (n) { var p = PALETTES[n]; return '<button class="opt" type="button" data-k="palette" data-v="' + n + '" aria-pressed="' + (c.palette === n) + '"><span class="dots" aria-hidden="true"><span style="background:' + p.frost + '"></span><span style="background:' + p.trim + '"></span><span style="background:' + p.accent + '"></span></span><b>' + n + '</b></button>'; }).join("");
  var html =
    single("type", "What are we making?", "", [["cake", "Cake"], ["cupcakes", "Cupcakes"], ["both", "Cake + cupcakes"]]) +
    (cake ? single("size", "Cake size", "serves", CAKE_SIZES) + single("tiers", "Tiers", "", [[1, "1 tier"], [2, "2 tiers"]]) +
      single("shape", "Shape", "", [["round", "Round"], ["square", "Square"], ["heart", "Heart"]]) : "") +
    (cups ? single("cupSize", "Cupcake size", "", [["Regular", "Regular"], ["Mini", "Mini", "bite-size"]]) +
      single("cupCount", "How many cupcakes?", "", CUP_COUNTS[c.cupSize].map(function (n) { return [n, n + " pcs"]; })) : "") +
    single("sponge", cake ? "Sponge" : "Cupcake flavour", "", Object.keys(SPONGE).map(function (k) { return [k, k]; })) +
    single("filling", cake ? "Filling" : "Frosting flavour", "", FILLINGS.map(function (f) { return [f, f]; })) +
    (cake ? single("finish", "Finish", "", [["Buttercream", "Buttercream"], ["Fresh cream", "Fresh cream"], ["Fondant", "Fondant"], ["Naked", "Naked", "layers show"]]) : "") +
    '<fieldset class="group"><legend><span>Colours</span></legend><div class="pal">' + pal + '</div></fieldset>' +
    '<fieldset class="group"><legend><span>Decorations</span><span>choose any</span></legend><div class="opts">' + toggles("dec", DECOR, c.decor) + '</div>' +
    '<div class="field"><label for="cTheme">Theme or character (optional)</label><input id="cTheme" maxlength="40" value="' + esc(c.themeText) + '" placeholder="e.g. dinosaurs, Frozen, football"></div></fieldset>' +
    '<fieldset class="group"><legend><span>Words on the ' + (cake ? "cake" : "box") + '</span></legend><div class="fields"><div class="field"><label for="cName">Name</label><input id="cName" maxlength="14" value="' + esc(c.name) + '" autocomplete="off"></div>' +
    '<div class="field"><label for="cAge">Age</label><input id="cAge" type="number" inputmode="numeric" min="1" max="120" value="' + esc(c.age) + '"></div></div>' +
    '<span class="small" style="font-weight:800">Greeting</span><div class="opts">' + ["Happy Birthday", "Selamat Hari Jadi", "Barakallahu fik", "None"].map(function (g) { return '<button class="chip" type="button" data-k="greeting" data-v="' + g + '" aria-pressed="' + (c.greeting === g) + '">' + g + '</button>'; }).join("") + '</div></fieldset>' +
    '<fieldset class="group plain"><legend><span>Anything else for Ain?</span></legend><div class="opts">' + toggles("diet", ["Less sweet", "Eggless", "Nut-free"], c.diet) + '</div>' +
    '<div class="switchrow"><span>I have a reference photo to send</span><button class="switch" type="button" role="switch" aria-checked="' + c.hasRef + '" aria-label="I have a reference photo to send" id="refSw"><span></span></button></div></fieldset>';
  $("#cOpts").innerHTML = html;
  setupStage(); updateCustom();
}
function setupStage() {
  var c = S.custom, box = $("#stageBox"), ref = $("#stageRef"), tg = $(".viewtoggle", box);
  if (tg) tg.remove();
  if (c.photo) {
    ref.src = c.photo; ref.alt = c.base + " by The Saif’s Bakery";
    box.insertAdjacentHTML("beforeend", '<div class="viewtoggle"><button type="button" data-sv="photo" aria-pressed="' + (S.stageView === "photo") + '">Ain’s cake</button><button type="button" data-sv="3d" aria-pressed="' + (S.stageView === "3d") + '">3D preview</button></div>');
  } else S.stageView = "3d";
  var photo = S.stageView === "photo";
  ref.hidden = !photo; $("#stageLbl").hidden = !!c.photo || !window.Cake3D; $("#stageHint").textContent = photo ? "Ain will bake it with your changes" : "Drag to turn · a guide, not the final design";
}
$("#stageBox").addEventListener("click", function (e) { var b = e.target.closest("[data-sv]"); if (b) { S.stageView = b.dataset.sv; setupStage(); updateCustom(); } });
function customSpec(c) {
  var pal = PALETTES[c.palette], d = c.decor, sprinkles = d.has("Sprinkles") ? (c.palette === "Cocoa" ? ["#D9B45A", "#F2D48A"] : ["#F28B82", "#7FB7E6", "#F2C66D", "#8CCB8A", "#C7A1E8"]) : null;
  var top = d.has("Gummy bears & candy") ? "candy" : d.has("Theme toppers") ? "topper" : "sprinkles";
  if (c.type === "cupcakes") {
    return { kind: "box", count: Math.min(c.cupCount, c.cupSize === "Mini" ? 15 : 12), colors: [pal.frost, pal.trim === "#FFFFFF" ? "#FFFFFF" : pal.frost], liner: pal.accent, cake: SPONGE[c.sponge], top: top };
  }
  var nm = (c.name || "").trim(), txt = nm ? nm + (c.age ? " · " + c.age : "") : (c.greeting !== "None" ? c.greeting : "");
  return { kind: "cake", seed: 11, shape: c.shape, size: +c.size, tiers: c.tiers, finish: { Buttercream: "buttercream", "Fresh cream": "freshcream", Fondant: "fondant", Naked: "naked" }[c.finish],
    frost: pal.frost, trim: pal.trim, accent: pal.accent, sponge: SPONGE[c.sponge], drip: d.has("Drip") ? pal.drip : null, sprinkles: sprinkles,
    candy: d.has("Gummy bears & candy"), flowers: d.has("Flowers") ? pal.accent : null, toppers: d.has("Theme toppers"), goldBeads: d.has("Gold beads"),
    candles: d.has("Candles") ? Math.min(Math.max(parseInt(c.age, 10) || 3, 1), 6) : 0,
    plaque: d.has("Name plaque") && txt ? txt : null, plaqueSub: d.has("Name plaque") && nm && c.greeting !== "None" ? c.greeting : "",
    plaqueDark: c.palette === "Cocoa" || c.palette === "Cherry", cupcakes: c.type === "both" ? 3 : 0, cupColors: [pal.frost, "#FFFFFF"] };
}
function customSummary(c) {
  var b = [];
  if (c.type !== "cupcakes") b.push(c.size + '" ' + (c.tiers === 2 ? "2-tier " : "") + (c.shape !== "round" ? c.shape + " " : "") + "cake");
  if (c.type !== "cake") b.push(c.cupCount + " " + c.cupSize.toLowerCase() + " cupcakes");
  return b.join(" + ") + " · " + c.sponge;
}
function updateCustom() {
  var c = S.custom, p = priceText(customPrice(c));
  $("#cSum").textContent = customSummary(c); $("#cPrice").textContent = p || "Price confirmed by Ain";
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
    if (k === "tiers" || k === "cupCount") v = +v;
    c[k] = v;
    if (k === "cupSize") c.cupCount = CUP_COUNTS[v][1];
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
  var c = S.custom, bits = [customSummary(c)];
  if (c.type !== "cupcakes") bits.push(c.filling, c.finish);
  else bits.push(c.filling + " frosting");
  bits.push(c.palette + " colours");
  if (c.decor.size) bits.push(Array.from(c.decor).join(", "));
  if (c.themeText.trim()) bits.push("Theme: " + c.themeText.trim());
  if (c.name.trim()) bits.push('Name: "' + c.name.trim() + (c.age ? ", " + c.age : "") + '"');
  if (c.greeting !== "None") bits.push(c.greeting);
  if (c.diet.size) bits.push(Array.from(c.diet).join(", "));
  if (c.hasRef) bits.push("I'll send a reference photo");
  S.cart.push({ type: "custom", photo: c.photo || "img/logo.png", name: "Custom: " + (c.baseId ? "like " + c.base : "my own design"), detail: bits.join(" · "), price: customPrice(c), qty: 1 });
  saveCart(); badges(); toast("Custom order added"); go("cart");
});

/* ---------------- cart ---------------- */
function lead() { return S.cart.some(function (i) { return i.type === "custom"; }) ? C.leadDays.custom : C.leadDays.ready; }
function subtotal() { var t = 0; for (var i = 0; i < S.cart.length; i++) { if (!isNum(S.cart[i].price)) return null; t += S.cart[i].price * S.cart[i].qty; } return t; }
function total() { var sub = subtotal(), f = deliveryFee(sub); return isNum(sub) && isNum(f) ? sub + f : null; }
function totalsHtml() {
  var sub = subtotal(), f = deliveryFee(sub), st = priceText(sub), tt = priceText(total());
  if (!st) return '<div class="r"><span>Price</span><span>Confirmed by Ain on WhatsApp</span></div>';
  var free = C.delivery && isNum(C.delivery.freeAbove) && f > 0 ? '<div class="r small muted"><span>Free delivery from ' + money(C.delivery.freeAbove) + " (" + money(C.delivery.freeAbove - sub) + " more)</span><span></span></div>" : "";
  return '<div class="r"><span>Subtotal</span><span>' + st + '</span></div><div class="r"><span>Delivery</span><span>' + (f === 0 ? "Free" : money(f)) + "</span></div>" + free + '<div class="r tot"><span>Total</span><span>' + tt + "</span></div>";
}
function renderCart() {
  if (!S.cart.length) {
    $("#cartList").innerHTML = '<div class="empty"><p class="lede">Your order is empty.</p><div class="row gap" style="justify-content:center"><a class="secondary" href="#shop">Shop ready-made</a><a class="primary" href="#gallery">Start a custom order</a></div></div>';
    $("#cartFoot").innerHTML = ""; return;
  }
  $("#cartList").innerHTML = S.cart.map(function (i, n) {
    var pt = priceText(isNum(i.price) ? i.price * i.qty : null);
    return '<div class="line"><img class="thumb" src="' + i.photo + '" alt=""><div style="min-width:0"><div class="nm">' + esc(i.name) + (i.qty > 1 ? " ×" + i.qty : "") + '</div><div class="sb">' + esc(i.detail) + '</div><button class="rm" type="button" data-rm="' + n + '">Remove</button></div><div class="pr">' + (pt || "") + '</div></div>';
  }).join("");
  $("#cartFoot").innerHTML = '<div class="summary">' + totalsHtml() + '<div class="r small muted"><span>Needs ' + lead() + " days’ notice · delivery only</span><span></span></div></div>" +
    '<div class="row gap" style="margin-top:12px"><a class="secondary" href="#shop">Add more</a><a class="primary" href="#date" style="flex:1">Choose a date</a></div>';
}
$("#v-cart").addEventListener("click", function (e) { var r = e.target.closest("[data-rm]"); if (r) { S.cart.splice(+r.dataset.rm, 1); saveCart(); badges(); renderCart(); } });

/* ---------------- date ---------------- */
var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
var today = new Date(); today.setHours(0, 0, 0, 0);
function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function fmtDate(d) { return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()].slice(0, 3); }
function renderDate() {
  var earliest = addDays(today, lead());
  if (S.date && S.date < earliest) S.date = null;
  if (!S.calMonth) S.calMonth = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
  var m = S.calMonth; $("#calTitle").textContent = MONTHS[m.getMonth()] + " " + m.getFullYear();
  var off = (new Date(m.getFullYear(), m.getMonth(), 1).getDay() + 6) % 7, days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
  var h = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map(function (d) { return '<span class="dw">' + d + '</span>'; }).join("");
  for (var i = 0; i < off; i++) h += "<span></span>";
  for (var d = 1; d <= days; d++) {
    var dt = new Date(m.getFullYear(), m.getMonth(), d), bad = dt < earliest || C.closedDates.indexOf(ymd(dt)) >= 0, on = S.date && +S.date === +dt;
    h += '<button type="button" data-day="' + d + '"' + (bad ? " disabled" : "") + ' aria-pressed="' + !!on + '" aria-label="' + d + " " + MONTHS[m.getMonth()] + (bad ? ", unavailable" : "") + '">' + d + "</button>";
  }
  $("#calGrid").innerHTML = h;
  $("#calPrev").disabled = m.getFullYear() === today.getFullYear() && m.getMonth() === today.getMonth();
  $("#leadNote").textContent = (lead() === C.leadDays.custom ? "Custom orders need " : "Ready-made bakes need ") + lead() + " days’ notice. Earliest date: " + fmtDate(earliest) + ".";
  $("#delNote").textContent = C.delivery.note;
  $("#slotOpts").innerHTML = C.slots.map(function (s) { return '<button class="chip" type="button" data-slot="' + esc(s) + '" aria-pressed="' + (S.slot === s) + '">' + esc(s) + "</button>"; }).join("");
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
  var tp = priceText(total());
  $("#sendSummary").innerHTML = S.cart.map(function (i) { var pt = priceText(isNum(i.price) ? i.price * i.qty : null); return '<div class="r"><span><b>' + esc(i.name) + (i.qty > 1 ? " ×" + i.qty : "") + '</b><br><span class="small muted">' + esc(i.detail) + "</span></span><span>" + (pt || "") + "</span></div>"; }).join("") +
    '<div class="r small muted"><span>' + "Delivery to " + esc($("#addr").value.trim()) + " · " + fmtDate(S.date) + " · " + esc(S.slot) + '</span><a class="link" style="padding:0" href="#date">Change</a></div>' +
    totalsHtml();
  $("#estLbl").textContent = tp ? "Total incl. delivery" : "Price"; $("#estAmt").textContent = tp || "Confirmed by Ain";
}
function orderText(name, phone, notes) {
  var L = ["Assalamualaikum Ain! I'd like to order from The Saif's Bakery:", ""];
  S.cart.forEach(function (i, n) { var pt = priceText(isNum(i.price) ? i.price * i.qty : null); L.push((n + 1) + ". " + i.name + (i.qty > 1 ? " x" + i.qty : "") + (pt ? " — " + pt : "")); L.push("   " + i.detail); });
  L.push("", "Delivery: " + fmtDate(S.date) + " " + S.date.getFullYear() + ", " + S.slot);
  L.push("Address: " + $("#addr").value.trim());
  var sub = subtotal(), f = deliveryFee(sub), tp = priceText(total());
  if (tp) L.push("", "Subtotal: " + money(sub), "Delivery: " + (f === 0 ? "Free" : money(f)), "Total: " + tp);
  if (notes) L.push("", "Notes: " + notes);
  L.push("", "Name: " + name, "Phone: " + phone);
  return L.join("\n");
}
$("#sendForm").addEventListener("submit", function (e) {
  e.preventDefault();
  var name = $("#sName").value.trim(), phone = $("#sPhone").value.trim(), notes = $("#sNotes").value.trim();
  if (!name || phone.replace(/\D/g, "").length < 8) { $("#sendErr").textContent = "Add your name and phone number so Ain can reply."; return; }
  $("#sendErr").textContent = "";
  var text = orderText(name, phone, notes), num = String(C.whatsapp || "").replace(/\D/g, "");
  var url = "https://wa.me/" + num + "?text=" + encodeURIComponent(text);
  $("#orderText").value = text; $("#reopenWa").href = url; $("#copyBox").hidden = false;
  window.open(url, "_blank", "noopener");
  S.cart = []; S.date = null; saveCart(); badges(); go("done");
});
$("#copyBtn").addEventListener("click", function () {
  var ta = $("#orderText");
  var done = function () { toast("Order copied"); };
  if (navigator.clipboard) navigator.clipboard.writeText(ta.value).then(done, function () { ta.select(); });
  else { ta.select(); try { document.execCommand("copy"); done(); } catch (x) {} }
});

/* ---------------- boot ---------------- */
$("#instaLink").href = C.instagram; $("#footInsta").href = C.instagram;
badges(); bgSprinkles(); route();
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(function () {});
})();
