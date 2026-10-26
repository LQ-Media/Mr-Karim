/* Prices and order-line wording, shared by the shop (browser) and the server.
   The server re-runs these on every order so the browser can't change a price. */
(function (root) {
  "use strict";
  var isNum = function (v) { return typeof v === "number" && isFinite(v); };
  var on = function (list) { return (list || []).filter(function (x) { return x.active !== false; }); };
  var find = function (list, id) { return (list || []).filter(function (x) { return String(x.id) === String(id); })[0] || null; };

  function product(cat, id) { return find(cat.products, id); }
  function productOption(p, label) { return p && (p.options || []).filter(function (o) { return o.label === label; })[0] || null; }

  /* A ready-made line: { productId, option, plaque, own, candles } */
  function readyLine(cat, d, qty) {
    var p = product(cat, d.productId); if (!p) return null;
    var o = productOption(p, d.option) || p.options[0];
    var bits = [o.label];
    if (p.plaque && d.plaque && d.plaque !== "None") bits.push('"' + (d.plaque === "Own words" ? (String(d.own || "").trim().slice(0, 20) || "own words") : d.plaque) + '" plaque');
    if (p.plaque && d.candles) bits.push("candles");
    return { kind: "ready", data: { productId: p.id, option: o.label, plaque: d.plaque || "None", own: d.own || "", candles: !!d.candles },
      name: p.name, detail: bits.join(" · "), photo: p.photo, price: isNum(o.price) ? o.price : null, qty: Math.max(1, Math.min(50, parseInt(qty, 10) || 1)) };
  }

  /* A custom line. c = { type, size, tiers, shape, sponge, filling, finish, palette, decor[], themeText,
     name, age, greeting, cupSize, cupCount, diet[], hasRef, baseId, base, photo } */
  function customPrice(cat, c) {
    var B = cat.builder, total = 0, x;
    var decor = (c.decor || []).map(function (id) { return find(B.decorations, id); }).filter(Boolean);
    if (c.type !== "cupcakes") {
      x = find(B.sizes, c.size); if (!x || !isNum(x.price)) return null; total += x.price;
      [[B.tiers, String(c.tiers)], [B.shapes, c.shape], [B.finishes, c.finish], [B.sponges, c.sponge], [B.fillings, c.filling]].forEach(function (pair) {
        var o = find(pair[0], pair[1]); if (o && isNum(o.price)) total += o.price;
      });
      decor.forEach(function (o) { if (isNum(o.price)) total += o.price; });
    }
    if (c.type !== "cake") {
      var cs = find(B.cupcakeSizes, c.cupSize); if (!cs) return null;
      var cnt = (cs.counts || []).filter(function (k) { return +k.n === +c.cupCount; })[0];
      if (!cnt || !isNum(cnt.price)) return null; total += cnt.price;
      decor.forEach(function (o) { var pc = o.perCupcake && o.perCupcake[c.cupSize]; if (isNum(pc)) total += pc * cnt.n; });
    }
    return Math.round(total * 100) / 100;
  }
  function labelOf(list, id) { var o = find(list, id); return o ? o.label : id; }
  function customSummary(cat, c) {
    var B = cat.builder, b = [];
    if (c.type !== "cupcakes") b.push(labelOf(B.sizes, c.size) + " " + (String(c.tiers) === "2" ? "2-tier " : "") + (c.shape && c.shape !== "round" ? labelOf(B.shapes, c.shape).toLowerCase() + " " : "") + "cake");
    if (c.type !== "cake") b.push(c.cupCount + " " + labelOf(B.cupcakeSizes, c.cupSize).toLowerCase() + " cupcakes");
    return b.join(" + ") + " · " + labelOf(B.sponges, c.sponge);
  }
  function clean(c) {
    var s = function (v, n) { return String(v == null ? "" : v).trim().slice(0, n); };
    return { type: ["cake", "cupcakes", "both"].indexOf(c.type) >= 0 ? c.type : "cake", size: s(c.size, 8), tiers: s(c.tiers, 2) || "1", shape: s(c.shape, 20) || "round",
      sponge: s(c.sponge, 40), filling: s(c.filling, 40), finish: s(c.finish, 40), palette: s(c.palette, 40),
      decor: (Array.isArray(c.decor) ? c.decor : []).map(function (d) { return s(d, 40); }).slice(0, 20),
      themeText: s(c.themeText, 60), name: s(c.name, 20), age: s(c.age, 3), greeting: s(c.greeting, 40) || "None",
      cupSize: s(c.cupSize, 20) || "Regular", cupCount: parseInt(c.cupCount, 10) || 0,
      diet: (Array.isArray(c.diet) ? c.diet : []).map(function (d) { return s(d, 30); }).slice(0, 10),
      hasRef: !!c.hasRef, baseId: c.baseId ? s(c.baseId, 40) : null, base: s(c.base, 80), photo: c.photo ? s(c.photo, 300) : null };
  }
  function customLine(cat, raw) {
    var c = clean(raw), B = cat.builder, bits = [customSummary(cat, c)];
    if (c.type !== "cupcakes") bits.push(labelOf(B.fillings, c.filling), labelOf(B.finishes, c.finish));
    else bits.push(labelOf(B.fillings, c.filling) + " frosting");
    bits.push(labelOf(B.palettes, c.palette) + " colours");
    if (c.decor.length) bits.push(c.decor.map(function (d) { return labelOf(B.decorations, d); }).join(", "));
    if (c.themeText) bits.push("Theme: " + c.themeText);
    if (c.name) bits.push('Name: "' + c.name + (c.age ? ", " + c.age : "") + '"');
    if (c.greeting && c.greeting !== "None") bits.push(c.greeting);
    if (c.diet.length) bits.push(c.diet.join(", "));
    if (c.hasRef) bits.push("Reference photo to follow");
    return { kind: "custom", data: c, name: "Custom: " + (c.baseId ? "like " + c.base : "my own design"), detail: bits.join(" · "),
      photo: c.photo || "img/logo.png", price: customPrice(cat, c), qty: 1 };
  }
  /* Rebuild an order's lines from what the browser sent. */
  function priceLines(cat, items) {
    return (items || []).slice(0, 30).map(function (it) {
      if (!it || !it.data) return null;
      return it.kind === "custom" ? customLine(cat, it.data) : readyLine(cat, it.data, it.qty);
    }).filter(Boolean);
  }
  function subtotal(lines) { var t = 0; for (var i = 0; i < lines.length; i++) { if (!isNum(lines[i].price)) return null; t += lines[i].price * lines[i].qty; } return Math.round(t * 100) / 100; }
  function deliveryFee(cat, sub) { var d = cat.shop.delivery || {}; if (!isNum(d.fee)) return null; return isNum(d.freeAbove) && isNum(sub) && sub >= d.freeAbove ? 0 : d.fee; }
  function leadDays(cat, lines) { return lines.some(function (l) { return l.kind === "custom"; }) ? cat.shop.leadDays.custom : cat.shop.leadDays.ready; }

  var api = { isNum: isNum, on: on, find: find, product: product, productOption: productOption, readyLine: readyLine,
    customLine: customLine, customPrice: customPrice, customSummary: customSummary, clean: clean, priceLines: priceLines,
    subtotal: subtotal, deliveryFee: deliveryFee, leadDays: leadDays, labelOf: labelOf };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SaifsPricing = api;
})(typeof window !== "undefined" ? window : globalThis);
