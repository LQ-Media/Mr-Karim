/* The Saif's Bakery: website content that admins edit in place.
   - Every customer-facing text marked data-t="key" can be changed; changes are saved as overrides.
   - Colours (accent, highlight, background, text) and extra pages (#page/<address>).
   - Admins (signed in to Ain's Kitchen) get an "Edit website" button: click any text and type. */
(function () {
"use strict";
var SITE = { text: {}, theme: {}, pages: [], canEdit: false };
var DEFAULTS = {}, draft = null, observer = null;
var $ = function (s, el) { return (el || document).querySelector(s); };
var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
function rich(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>"); }
function cur() { return draft || SITE; }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function toast(msg) { var t = $("#toast"); if (!t) return; t.textContent = msg; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove("on"); }, 2600); }

/* ---------- texts ---------- */
function t(key, def) { if (!(key in DEFAULTS)) DEFAULTS[key] = def; var v = cur().text[key]; return v != null ? v : def; }
function span(key, def, isRich) { var v = t(key, def); return '<span data-t="' + key + '"' + (isRich ? " data-rich" : "") + ">" + (isRich ? rich(v) : esc(v)) + "</span>"; }
function applyEl(el) {
  var k = el.dataset.t;
  if (!(k in DEFAULTS)) DEFAULTS[k] = el.textContent;
  if (el === document.activeElement && draft) return;
  var v = cur().text[k], val = v != null ? v : DEFAULTS[k];
  if (el.hasAttribute("data-rich")) { if (el.innerHTML !== rich(val)) el.innerHTML = rich(val); }
  else if (el.textContent !== val) el.textContent = val;
}
function heroLines() {
  var lines = $$("[data-hero]");
  if (!lines.length) return;
  lines.forEach(function (ln) { var k = "home.hero.l" + ln.dataset.hero; if (!(k in DEFAULTS)) DEFAULTS[k] = ln.textContent.replace(/\s+/g, " ").trim(); });
  if (draft && lines.indexOf(document.activeElement) >= 0) return;
  var delay = 0.05;
  lines.forEach(function (ln) {
    var n = ln.dataset.hero, text = t("home.hero.l" + n, DEFAULTS["home.hero.l" + n]), words = text.split(/\s+/).filter(Boolean), h = "";
    if (n === "3") { h = '<span class="w hl" style="--d:' + delay.toFixed(2) + 's">' + esc(text) + "</span>"; delay += 0.1; }
    else words.forEach(function (w, i) { h += (i ? " " : "") + '<span class="w' + (n === "2" && i === 0 ? " em" : "") + '" style="--d:' + delay.toFixed(2) + 's">' + esc(w) + "</span>"; delay += 0.1; });
    if (ln.innerHTML !== h) ln.innerHTML = h;
  });
  var h1 = lines[0].closest("h1");
  if (h1) h1.setAttribute("aria-label", lines.map(function (l) { return l.textContent; }).join(" "));
}
function applyTheme() {
  var th = cur().theme || {}, r = document.documentElement.style;
  [["accent", "--accent"], ["butter", "--butter"], ["bg", "--bg"], ["ink", "--ink"]].forEach(function (p) { if (th[p[0]]) r.setProperty(p[1], th[p[0]]); else r.removeProperty(p[1]); });
  if (th.bg) { var m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = th.bg; }
}
function applyAll() { $$("[data-t]").forEach(applyEl); heroLines(); applyTheme(); renderNav(); }

/* ---------- extra pages ---------- */
function pages() { return cur().pages || []; }
function renderNav() {
  var box = $("#sitePages"); if (!box) return;
  var list = pages().filter(function (p) { return p.nav && (p.published || draft); });
  box.innerHTML = list.map(function (p) { return '<a href="#page/' + esc(p.slug) + '">' + esc(p.title) + "</a>"; }).join(" · ");
  box.hidden = !list.length;
  var hb = $("#homePages");
  if (hb) { hb.innerHTML = list.map(function (p) { return '<a class="chip" href="#page/' + esc(p.slug) + '">' + esc(p.title) + "</a>"; }).join(""); hb.hidden = !list.length; }
}
function renderPage(slug) {
  var box = $("#pageBody"), p = pages().filter(function (x) { return x.slug === slug; })[0];
  if (!p) { box.innerHTML = '<div class="empty"><p class="lede">' + span("page.missing", "That page isn’t here any more.") + '</p><a class="primary" href="#home">Back to home</a></div>'; return; }
  var pb = function (i, f) { return ' data-pb="' + esc(p.slug) + "|" + i + "|" + f + '"'; };
  var h = (!p.published ? '<div class="notice"><b>Draft</b><span>Only admins can see this page until it’s published.</span></div>' : "") +
    '<h1 class="h1"' + pb(-1, "title") + ">" + esc(p.title) + "</h1>";
  p.blocks.forEach(function (b, i) {
    if (b.t === "heading") h += '<h2 class="h2"' + pb(i, "text") + ">" + esc(b.text) + "</h2>";
    else if (b.t === "text") h += '<p class="pagetext" data-rich' + pb(i, "text") + ">" + rich(b.text) + "</p>";
    else if (b.t === "image") h += '<figure class="pageimg"><img src="' + esc(b.src) + '" alt="' + esc(b.alt) + '" loading="lazy">' + (b.caption || draft ? "<figcaption" + pb(i, "caption") + ">" + esc(b.caption) + "</figcaption>" : "") + "</figure>";
    else if (b.t === "button") h += '<a class="primary pagebtn" href="' + esc(b.href) + '"' + pb(i, "text") + ">" + esc(b.text) + "</a>";
  });
  if (!p.blocks.length) h += '<p class="lede muted">This page is empty. ' + (SITE.canEdit ? "Add text, photos and buttons in Ain’s Kitchen → Website." : "") + "</p>";
  box.innerHTML = h;
  document.title = p.title + " · The Saif’s Bakery";
  if (draft) markEditable();
}

/* ---------- edit mode ---------- */
var EDITABLE = "[data-t],[data-hero],[data-pb]";
function markEditable() {
  $$(EDITABLE).forEach(function (el) {
    if (el.closest("#siteBar")) return;
    var rich = el.hasAttribute("data-rich");
    if (el.getAttribute("contenteditable") !== null) return;
    try { el.contentEditable = rich ? "true" : "plaintext-only"; } catch (e) { el.contentEditable = "true"; }
    if (el.contentEditable !== "plaintext-only" && !rich) el.contentEditable = "true";
    el.setAttribute("spellcheck", "true");
    if (el.hasAttribute("data-hero")) el.removeAttribute("aria-hidden");
  });
}
function unmark() { $$("[contenteditable]").forEach(function (el) { if (el.matches(EDITABLE)) { el.removeAttribute("contenteditable"); el.removeAttribute("spellcheck"); if (el.hasAttribute("data-hero")) el.setAttribute("aria-hidden", "true"); } }); }
function serialize(el) {
  if (!el.hasAttribute("data-rich")) return el.textContent.replace(/\s+/g, " ").trim();
  var out = "";
  (function walk(n) {
    n.childNodes.forEach(function (c) {
      if (c.nodeType === 3) out += c.nodeValue;
      else if (c.nodeName === "BR") out += "\n";
      else if (c.nodeName === "STRONG" || c.nodeName === "B") { out += "**"; walk(c); out += "**"; }
      else if (c.nodeName === "DIV" || c.nodeName === "P") { if (out && !/\n$/.test(out)) out += "\n"; walk(c); }
      else walk(c);
    });
  })(el);
  return out.replace(/ /g, " ").replace(/\*\*\*\*/g, "").replace(/\n{3,}/g, "\n\n").trim();
}
function onInput(e) {
  if (!draft) return;
  var el = e.target.closest && e.target.closest(EDITABLE); if (!el) return;
  var v = serialize(el);
  if (el.dataset.t) { var k = el.dataset.t; if (v === DEFAULTS[k]) delete draft.text[k]; else draft.text[k] = v; }
  else if (el.dataset.hero) { var hk = "home.hero.l" + el.dataset.hero; if (v === DEFAULTS[hk]) delete draft.text[hk]; else draft.text[hk] = v; }
  else if (el.dataset.pb) {
    var parts = el.dataset.pb.split("|"), p = draft.pages.filter(function (x) { return x.slug === parts[0]; })[0];
    if (p) { if (parts[1] === "-1") p.title = v; else if (p.blocks[+parts[1]]) p.blocks[+parts[1]][parts[2]] = v; }
  }
  dirty(true);
}
var isDirty = false;
function dirty(on) { isDirty = !!on; var s = $("#siteSave"); if (s) { s.disabled = !on; s.textContent = on ? "Save changes" : "Saved"; } }
function blockClicks(e) {
  if (!draft) return;
  var el = e.target.closest && e.target.closest(EDITABLE);
  if (el && !el.closest("#siteBar")) { e.preventDefault(); e.stopPropagation(); if (document.activeElement !== el) el.focus(); }
}
function onKey(e) {
  if (!draft) return;
  var el = e.target.closest && e.target.closest(EDITABLE);
  if (el && e.key === "Enter" && !el.hasAttribute("data-rich")) { e.preventDefault(); el.blur(); }
}
function onPaste(e) {
  if (!draft) return;
  var el = e.target.closest && e.target.closest(EDITABLE); if (!el) return;
  e.preventDefault();
  var text = (e.clipboardData || window.clipboardData).getData("text/plain");
  document.execCommand("insertText", false, el.hasAttribute("data-rich") ? text : text.replace(/\s+/g, " "));
}
function viewList() {
  var base = [["#home", "Home"], ["#shop", "Shop"], ["#gallery", "Custom designs"], ["#cart", "Basket"], ["#account", "Sign in / account"]];
  return base.concat(pages().map(function (p) { return ["#page/" + p.slug, "Page: " + p.title + (p.published ? "" : " (draft)")]; }));
}
function bar() {
  var b = $("#siteBar");
  if (!b) { b = document.createElement("div"); b.id = "siteBar"; b.setAttribute("role", "region"); b.setAttribute("aria-label", "Website editor"); document.body.appendChild(b); }
  var onPage = /^#page\//.test(location.hash), slug = onPage ? decodeURIComponent(location.hash.slice(6)) : "", p = pages().filter(function (x) { return x.slug === slug; })[0];
  var th = cur().theme || {}, css = getComputedStyle(document.documentElement);
  var col = function (k, v) { return (th[k] || css.getPropertyValue(v).trim() || "#000000").slice(0, 7); };
  b.innerHTML =
    '<div class="sb-row"><b class="sb-title">Editing the website</b><span class="sb-hint">Click any text to change it.</span>' +
    '<label class="sb-go"><span class="sr">Go to</span><select id="sbGo">' + viewList().map(function (v) { return '<option value="' + esc(v[0]) + '"' + (location.hash === v[0] ? " selected" : "") + ">" + esc(v[1]) + "</option>"; }).join("") + "</select></label>" +
    '<details class="sb-colours"><summary>Colours</summary><div class="sb-pop">' +
      [["accent", "Buttons & accents", "--accent"], ["butter", "Highlight", "--butter"], ["bg", "Background", "--bg"], ["ink", "Text & outlines", "--ink"]].map(function (c) {
        return '<label><input type="color" data-col="' + c[0] + '" value="' + col(c[0], c[2]) + '"> ' + c[1] + "</label>"; }).join("") +
      '<button type="button" id="sbColReset">Original colours</button></div></details>' +
    '<button type="button" id="sbNewPage">+ New page</button>' +
    (p ? '<label class="sb-chk"><input type="checkbox" id="sbPub"' + (p.published ? " checked" : "") + "> Published</label>" +
         '<label class="sb-chk"><input type="checkbox" id="sbNav"' + (p.nav ? " checked" : "") + "> In menu</label>" +
         '<a href="admin.html#website" target="_blank" rel="noopener" class="sb-link">Photos & layout</a>' +
         '<button type="button" id="sbDelPage" class="sb-danger">Delete page</button>' : "") +
    '<span class="sb-spacer"></span><button type="button" id="sbDiscard">Discard</button><button type="button" id="siteSave" class="sb-save" disabled>Saved</button><button type="button" id="sbDone">Done</button></div>';
  dirty(isDirty); // the bar is rebuilt on every page change; keep the save button's state
  document.documentElement.style.setProperty("--sbh", b.offsetHeight + "px");
}
function start() {
  if (!SITE.canEdit) return;
  draft = clone({ text: SITE.text, theme: SITE.theme, pages: SITE.pages });
  document.body.classList.add("site-editing");
  bar(); markEditable(); dirty(false);
  var ed = $("#siteEditBtn"); if (ed) ed.hidden = true;
  if (!observer) observer = new MutationObserver(function () { if (draft) { markEditable(); } });
  observer.observe($("#main"), { childList: true, subtree: true });
  toast("Edit mode: click any text");
}
function stop() {
  draft = null; if (observer) observer.disconnect();
  unmark(); document.body.classList.remove("site-editing");
  var b = $("#siteBar"); if (b) b.remove();
  var ed = $("#siteEditBtn"); if (ed) ed.hidden = false;
  if (location.search.indexOf("edit=1") >= 0) history.replaceState(null, "", "/" + location.hash);
  applyAll(); if (/^#page\//.test(location.hash)) renderPage(decodeURIComponent(location.hash.slice(6)));
}
function slugify(t) { return String(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "page"; }
function save() {
  var btn = $("#siteSave"); btn.disabled = true; btn.textContent = "Saving…";
  var moved = null;
  draft.pages.forEach(function (p) {
    if (/^new-page-\d+$/.test(p.slug) && p.title && p.title !== "New page") {
      var s = slugify(p.title), n = 2, base = s;
      while (draft.pages.some(function (q) { return q !== p && q.slug === s; })) s = base + "-" + n++;
      if (location.hash === "#page/" + p.slug) moved = s;
      p.slug = s; p.id = s;
    }
  });
  return fetch("/api/admin/site", { method: "PUT", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) })
    .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || "Couldn’t save."); return d; }); })
    .then(function (d) {
      SITE.text = d.text; SITE.theme = d.theme; SITE.pages = d.pages;
      if (moved) history.replaceState(null, "", location.pathname + location.search + "#page/" + moved);
      var keepHash = location.hash; draft = clone({ text: d.text, theme: d.theme, pages: d.pages });
      if (/^#page\//.test(keepHash) && !pages().some(function (p) { return "#page/" + p.slug === keepHash; })) location.hash = "home";
      dirty(false); bar(); if (moved) renderPage(moved); toast("Saved. Customers see it now.");
    })
    .catch(function (e) { toast(e.message); dirty(true); });
}
function barClick(e) {
  var id = e.target.id;
  if (id === "sbDone") { if (isDirty && !window.confirm("Leave without saving your changes?")) return; stop(); }
  else if (id === "sbDiscard") { draft = clone({ text: SITE.text, theme: SITE.theme, pages: SITE.pages }); unmark(); applyAll(); if (/^#page\//.test(location.hash)) renderPage(decodeURIComponent(location.hash.slice(6))); markEditable(); dirty(false); bar(); toast("Changes discarded"); }
  else if (id === "siteSave") save();
  else if (id === "sbColReset") { draft.theme = {}; applyTheme(); dirty(true); bar(); }
  else if (id === "sbNewPage") {
    var n = 1; while (pages().some(function (p) { return p.slug === "new-page-" + n; })) n++;
    draft.pages.push({ id: "new-page-" + n, slug: "new-page-" + n, title: "New page", nav: true, published: false,
      blocks: [{ t: "heading", text: "A heading" }, { t: "text", text: "Write something here. Use **two stars** around words to make them bold." }, { t: "button", text: "Order a cake", href: "#gallery" }] });
    dirty(true); location.hash = "page/new-page-" + n; toast("New page added. Click the text to write it, then Save.");
  }
  else if (id === "sbDelPage") {
    var slug = decodeURIComponent(location.hash.slice(6));
    if (!window.confirm("Delete this page? You can still discard before saving.")) return;
    draft.pages = draft.pages.filter(function (p) { return p.slug !== slug; }); dirty(true); location.hash = "home";
  }
}
function barChange(e) {
  var el = e.target;
  if (el.id === "sbGo") { location.hash = el.value.slice(1); return; }
  if (el.dataset.col) { draft.theme[el.dataset.col] = el.value; applyTheme(); dirty(true); return; }
  var slug = decodeURIComponent(location.hash.slice(6)), p = draft.pages.filter(function (x) { return x.slug === slug; })[0];
  if (!p) return;
  if (el.id === "sbPub") { p.published = el.checked; dirty(true); renderPage(slug); }
  if (el.id === "sbNav") { p.nav = el.checked; dirty(true); renderNav(); }
}
function load() {
  return fetch("/api/site", { credentials: "same-origin" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
    if (d) SITE = d;
  }).catch(function () {});
}
function init() {
  applyAll();
  document.addEventListener("click", blockClicks, true);
  document.addEventListener("input", onInput);
  document.addEventListener("keydown", onKey);
  document.addEventListener("paste", onPaste);
  document.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("#siteBar")) barClick(e); });
  document.addEventListener("change", function (e) { if (e.target.closest && e.target.closest("#siteBar")) barChange(e); });
  document.addEventListener("input", function (e) { if (e.target.dataset && e.target.dataset.col && e.target.closest("#siteBar")) barChange(e); });
  window.addEventListener("hashchange", function () { if (draft) setTimeout(bar, 0); });
  window.addEventListener("beforeunload", function (e) { if (draft && isDirty) { e.preventDefault(); e.returnValue = ""; } });
  if (SITE.canEdit) {
    var b = document.createElement("button");
    b.type = "button"; b.id = "siteEditBtn"; b.className = "siteeditbtn";
    b.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/></svg><span>Edit website</span>';
    b.addEventListener("click", start);
    document.body.appendChild(b);
    if (/[?&]edit=1/.test(location.search)) start();
  }
}
window.SaifsSite = { load: load, init: init, t: t, span: span, rich: rich, renderPage: renderPage, applyAll: applyAll, editing: function () { return !!draft; }, defaults: function () { return DEFAULTS; } };
})();
