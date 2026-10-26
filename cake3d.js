/* Live 3D cake preview for the custom builder. Needs three.js r128 (global THREE). */
window.Cake3D = (function () {
  "use strict";
  var ok = !!window.THREE && (function () {
    try { var c = document.createElement("canvas"); return !!(c.getContext("webgl") || c.getContext("experimental-webgl")); }
    catch (e) { return false; }
  })();
  if (!ok) return null;
  var T = THREE;

  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function col(h) { return new T.Color(h).convertSRGBToLinear(); }
  function mat(h, r, m) { return new T.MeshStandardMaterial({ color: col(h), roughness: r == null ? .6 : r, metalness: m || 0 }); }
  var SPH = new T.SphereGeometry(1, 20, 14);
  function add(g, geo, m, p, s, rot) {
    var o = new T.Mesh(geo, m); if (p) o.position.copy(p); if (s) o.scale.set(s[0], s[1], s[2]); if (rot) o.rotation.set(rot[0], rot[1], rot[2]);
    o.castShadow = true; o.receiveShadow = true; g.add(o); return o;
  }
  function V(x, y, z) { return new T.Vector3(x, y, z); }

  function makeShape(type, R) {
    var sh;
    if (type === "square") {
      var s = R * .9, r = R * .2; sh = new T.Shape();
      sh.moveTo(-s + r, -s); sh.lineTo(s - r, -s); sh.quadraticCurveTo(s, -s, s, -s + r); sh.lineTo(s, s - r); sh.quadraticCurveTo(s, s, s - r, s);
      sh.lineTo(-s + r, s); sh.quadraticCurveTo(-s, s, -s, s - r); sh.lineTo(-s, -s + r); sh.quadraticCurveTo(-s, -s, -s + r, -s); return sh;
    }
    if (type === "heart") {
      var pts = [];
      for (var i = 0; i < 120; i++) {
        var t = i / 120 * Math.PI * 2, x = 16 * Math.pow(Math.sin(t), 3), y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        pts.push(new T.Vector2(x * R / 15.5, (y + 2.5) * R / 15.5));
      }
      return new T.Shape(pts);
    }
    sh = new T.Shape(); sh.absarc(0, 0, R, 0, Math.PI * 2, false); return sh;
  }
  function inside(pts, x, y) {
    var c = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var a = pts[i], b = pts[j];
      if (((a.y > y) !== (b.y > y)) && (x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x)) c = !c;
    }
    return c;
  }
  function W(p, k, y) { return V(p.x * k, y, -p.y * k); }
  function slab(shape, y0, h, m, bevel) {
    var b = bevel || 0;
    var geo = new T.ExtrudeGeometry(shape, { depth: Math.max(.001, h - 2 * b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 4, curveSegments: 56, steps: 1 });
    geo.rotateX(-Math.PI / 2); geo.translate(0, y0 + b, 0);
    var o = new T.Mesh(geo, m); o.castShadow = true; o.receiveShadow = true; return o;
  }
  function bodyMat(spec) {
    if (spec.finish === "fondant") return mat(spec.frost, .32);
    if (spec.finish === "freshcream") return mat(spec.frost, .5);
    if (spec.finish === "naked") return mat(spec.sponge || "#F3DDA8", .88);
    return mat(spec.frost, .62);
  }
  function tier(g, spec, R, H, y0, isTop, rnd) {
    var shape = makeShape(spec.shape, R), b = .05;
    g.add(slab(shape, y0, H, bodyMat(spec), b));
    var pts = shape.getSpacedPoints(180).slice(0, -1), top = y0 + H, i;
    if (spec.finish === "naked") {
      var cream = mat("#FFF7EA", .6);
      [.34, .67].forEach(function (f) { g.add(slab(makeShape(spec.shape, R + .012), y0 + H * f - .03, .06, cream, 0)); });
      g.add(slab(makeShape(spec.shape, R * .97), top - .01, .05, cream, .01)); top += .03;
    }
    var trim = spec.goldBeads ? mat("#D9B45A", .3, .55) : mat(spec.trim || spec.frost, .6);
    var kb = (R + b + .03) / R;
    for (i = 0; i < pts.length; i += 4) add(g, SPH, trim, W(pts[i], kb, y0 + .055), [.055, .05, .055]);
    if (spec.drip && isTop) {
      var dm = mat(spec.drip, .22);
      g.add(slab(makeShape(spec.shape, R * .995), top - .005, .03, dm, 0));
      var kl = (R + b * .3) / R;
      for (i = 0; i < pts.length; i += 2) add(g, SPH, dm, W(pts[i], kl, top - .012), [.045, .04, .045]);
      var kd = (R + b + .012) / R;
      for (i = 0; i < pts.length; i += 5) {
        var len = (.08 + rnd() * .32) * H, p = W(pts[i], kd, 0);
        add(g, new T.CylinderGeometry(.032, .03, len, 10), dm, V(p.x, top - len / 2 - .01, p.z));
        add(g, SPH, dm, V(p.x, top - len - .01, p.z), [.038, .042, .038]);
      }
      top += .025;
    }
    if (!spec.drip || spec.goldBeads) {
      var kt = (R - .045) / R;
      for (i = 0; i < pts.length; i += 4) add(g, SPH, trim, W(pts[i], kt, top + .02), [.05, .045, .05]);
    }
    return { top: top, pts: pts, R: R, b: b };
  }
  function scatter(g, t, colors, rnd, kind) {
    var geo = kind === "flat" ? new T.BoxGeometry(.05, .008, .03) : kind === "candy" ? new T.SphereGeometry(.045, 12, 10) : new T.CylinderGeometry(.013, .013, .075, 6);
    var dens = kind === "flat" ? 260 : kind === "candy" ? 14 : 150;
    var per = Math.ceil(Math.round(t.R * t.R * dens) / colors.length), d = new T.Object3D();
    colors.forEach(function (c) {
      var im = new T.InstancedMesh(geo, mat(c, kind === "candy" ? .25 : .45), per); im.castShadow = true;
      var k = 0, tries = 0;
      while (k < per && tries < per * 20) {
        tries++;
        var x = (rnd() * 2 - 1) * t.R, y = (rnd() * 2 - 1) * t.R;
        if (!inside(t.pts, x / .86, y / .86)) continue;
        d.position.set(x, t.top + (kind === "candy" ? .04 : .012), -y);
        d.rotation.set(0, rnd() * Math.PI * 2, kind === "flat" ? rnd() * .3 : Math.PI / 2);
        d.updateMatrix(); im.setMatrixAt(k++, d.matrix);
      }
      im.count = k; g.add(im);
    });
  }
  function gummy(g, c, p, rnd) {
    var gg = new T.Group(), m = new T.MeshStandardMaterial({ color: col(c), roughness: .15, transparent: true, opacity: .9 });
    add(gg, SPH, m, V(0, .06, 0), [.05, .06, .04]); add(gg, SPH, m, V(0, .14, 0), [.04, .04, .035]);
    [-1, 1].forEach(function (s) { add(gg, SPH, m, V(.035 * s, .175, 0), [.016, .016, .014]); add(gg, SPH, m, V(.05 * s, .07, .01), [.018, .03, .018]); });
    gg.position.copy(p); gg.rotation.y = rnd() * 6; g.add(gg);
  }
  function flower(g, c, p, s, rnd) {
    var gg = new T.Group(), m = mat(c, .55);
    for (var i = 0; i < 5; i++) { var a = i / 5 * Math.PI * 2 + rnd(); var o = add(gg, SPH, m, V(Math.cos(a) * .055, 0, Math.sin(a) * .055), [.06, .022, .04]); o.rotation.y = -a; }
    add(gg, SPH, mat("#F2C66D", .5), V(0, .012, 0), [.028, .02, .028]);
    gg.position.copy(p); gg.scale.setScalar(s); g.add(gg);
  }
  function figure(g, p, body, face, ear) {
    var gg = new T.Group(), m = mat(body, .65), l = mat(face, .6), k = mat("#1B120D", .3);
    add(gg, SPH, m, V(0, .13, 0), [.13, .14, .12]); add(gg, SPH, m, V(0, .36, 0), [.14, .13, .13]);
    [-1, 1].forEach(function (s) { add(gg, SPH, mat(ear, .65), V(.1 * s, .47, -.01), [.05, .05, .04]); add(gg, SPH, k, V(.05 * s, .39, .115), [.017, .017, .012]); });
    add(gg, SPH, l, V(0, .33, .11), [.06, .045, .04]); add(gg, SPH, k, V(0, .35, .15), [.022, .016, .014]);
    gg.position.copy(p); g.add(gg);
  }
  function candles(g, t, n, cols) {
    var r = Math.min(t.R * .42, .45);
    for (var i = 0; i < n; i++) {
      var a = Math.PI / 2 + (n === 1 ? 0 : (i / (n - 1) - .5) * 1.4), x = Math.cos(a) * r, z = Math.sin(a) * r;
      add(g, new T.CylinderGeometry(.024, .024, .3, 12), mat(cols[i % cols.length], .4), V(x, t.top + .15, z));
      var f = new T.Mesh(SPH, new T.MeshBasicMaterial({ color: col("#FFB547") })); f.position.set(x, t.top + .37, z); f.scale.set(.026, .05, .026); g.add(f);
    }
  }
  function plaqueTex(text, sub, dark) {
    var c = document.createElement("canvas"); c.width = 512; c.height = 256; var x = c.getContext("2d");
    x.fillStyle = dark ? "#3B2418" : "#FFFBF2"; var r = 40;
    x.beginPath(); x.moveTo(r, 8); x.arcTo(504, 8, 504, 248, r); x.arcTo(504, 248, 8, 248, r); x.arcTo(8, 248, 8, 8, r); x.arcTo(8, 8, 504, 8, r); x.fill();
    x.strokeStyle = dark ? "#D9B45A" : "#A84D2E"; x.lineWidth = 6; x.stroke();
    x.fillStyle = dark ? "#F6E3C2" : "#3B2A20"; x.textAlign = "center"; x.textBaseline = "middle";
    var fs = 88; x.font = "italic 500 " + fs + "px Fraunces, Georgia, serif";
    while (x.measureText(text).width > 440 && fs > 36) { fs -= 4; x.font = "italic 500 " + fs + "px Fraunces, Georgia, serif"; }
    x.fillText(text, 256, sub ? 108 : 128);
    if (sub) { x.font = "700 38px 'Nunito Sans', sans-serif"; x.fillText(sub, 256, 190); }
    var tx = new T.CanvasTexture(c); tx.encoding = T.sRGBEncoding; tx.anisotropy = 4; return tx;
  }
  function plaque(g, t, text, sub, dark) {
    var w = Math.min(t.R * 1.2, 1.1), h = w / 2;
    var m = new T.MeshStandardMaterial({ map: plaqueTex(text, sub, dark), roughness: .5, transparent: true, alphaTest: .4, side: T.DoubleSide });
    var p = new T.Mesh(new T.PlaneGeometry(w, h), m); p.position.set(0, t.top + h / 2 + .08, -t.R * .42); p.rotation.x = -.12; p.castShadow = true; g.add(p);
  }
  function cupcake(frost, liner, cake, top, rnd) {
    var gg = new T.Group();
    var ln = new T.Mesh(new T.CylinderGeometry(.25, .19, .3, 20, 1), new T.MeshStandardMaterial({ color: col(liner), roughness: .7, flatShading: true }));
    ln.position.y = .15; ln.castShadow = true; ln.receiveShadow = true; gg.add(ln);
    add(gg, SPH, mat(cake, .85), V(0, .3, 0), [.255, .1, .255]);
    var fm = mat(frost, .55);
    [[.2, .075, .39], [.145, .068, .5], [.09, .058, .59]].forEach(function (a, i) { add(gg, new T.TorusGeometry(a[0], a[1], 12, 28), fm, V(0, a[2], 0), null, [Math.PI / 2, 0, i * .6]); });
    add(gg, SPH, fm, V(0, .66, 0), [.06, .07, .06]);
    if (top === "candy") add(gg, SPH, mat(["#F28B82", "#7FB7E6", "#F2C66D", "#8CCB8A"][Math.floor(rnd() * 4)], .2), V(0, .75, 0), [.05, .05, .05]);
    if (top === "topper") add(gg, new T.CylinderGeometry(.11, .11, .02, 24), mat("#FFFFFF", .4), V(0, .78, 0), null, [Math.PI / 2.4, 0, 0]);
    if (top === "sprinkles" || top === "topper" || top === "candy") {
      var cs = ["#F28B82", "#7FB7E6", "#F2C66D", "#8CCB8A"], geo = new T.CylinderGeometry(.01, .01, .05, 5);
      for (var i = 0; i < 18; i++) { var a = rnd() * Math.PI * 2, rr = .05 + rnd() * .17; add(gg, geo, mat(cs[i % 4], .4), V(Math.cos(a) * rr, .67 - rr * .75, Math.sin(a) * rr), null, [rnd() * 3, rnd() * 3, Math.PI / 2]); }
    }
    return gg;
  }

  function build(spec) {
    var g = new T.Group(), rnd = rng(spec.seed || 7), i;
    if (spec.kind === "box") {
      var n = spec.count, cols = n > 9 ? 5 : n > 6 ? 4 : 3, rows = Math.ceil(n / cols), sx = .62, sz = .62;
      var W2 = cols * sx + .15, D2 = rows * sz + .15, kraft = mat("#C9A47A", .85);
      add(g, new T.BoxGeometry(W2, .06, D2), kraft, V(0, .03, 0));
      add(g, new T.BoxGeometry(W2, .2, .03), kraft, V(0, .1, D2 / 2)); add(g, new T.BoxGeometry(W2, .2, .03), kraft, V(0, .1, -D2 / 2));
      add(g, new T.BoxGeometry(.03, .2, D2), kraft, V(W2 / 2, .1, 0)); add(g, new T.BoxGeometry(.03, .2, D2), kraft, V(-W2 / 2, .1, 0));
      for (i = 0; i < n; i++) {
        var c = cupcake(spec.colors[i % spec.colors.length], spec.liner, spec.cake, spec.top, rnd);
        c.position.set(((i % cols) - (cols - 1) / 2) * sx, .06, (Math.floor(i / cols) - (rows - 1) / 2) * sz); c.rotation.y = rnd() * 6; g.add(c);
      }
      return g;
    }
    var R = { 5: .9, 6: 1, 7: 1.1, 8: 1.2, 10: 1.38 }[spec.size] || 1;
    var boardR = spec.shape === "square" ? R * 1.32 : R * 1.28;
    add(g, new T.CylinderGeometry(boardR, boardR, .05, 64), spec.goldBeads ? mat("#D9B45A", .35, .5) : mat("#EDE0C8", .45, .1), V(0, .025, 0));
    var t = tier(g, spec, R, .9, .05, spec.tiers === 1, rnd), base = t;
    if (spec.tiers === 2) t = tier(g, spec, R * .64, .75, t.top, true, rnd);
    if (spec.sprinkles) scatter(g, t, spec.sprinkles, rnd, "rod");
    if (spec.candy) { scatter(g, t, ["#F28B82", "#7FB7E6", "#F2C66D", "#8CCB8A"], rnd, "candy"); for (i = 0; i < 5; i++) gummy(g, ["#E8484F", "#F2A33A", "#7CC36B", "#F2D43A", "#C77DDB"][i], V(Math.cos(i * 1.25 + .4) * t.R * .62, t.top, Math.sin(i * 1.25 + .4) * t.R * .62), rnd); }
    if (spec.flowers) {
      var fc = [spec.flowers, "#FFFFFF", spec.trim || "#FFFFFF"];
      for (i = 0; i < 7; i++) { var a = Math.PI * .62 + (i - 3) * .2, rr = t.R * (.62 + ((i % 2) * .18)); flower(g, fc[i % 3], V(Math.cos(a) * rr, t.top + .03, Math.sin(a) * rr), .9 + rnd() * .5, rnd); }
    }
    if (spec.toppers) { figure(g, V(-t.R * .45, t.top, t.R * .05), spec.accent, "#FFF0D2", spec.accent); figure(g, V(t.R * .45, t.top, t.R * .05), spec.trim === "#FFFFFF" ? "#F2C66D" : spec.trim, "#FFF0D2", spec.accent); }
    if (spec.candles) candles(g, t, spec.candles, [spec.accent || "#A84D2E", "#F2C66D", "#FFFFFF"]);
    if (spec.plaque) plaque(g, t, spec.plaque, spec.plaqueSub || "", spec.plaqueDark);
    if (spec.cupcakes) {
      var cc = spec.cupColors, k = Math.min(3, spec.cupcakes);
      for (i = 0; i < k; i++) { var cu = cupcake(cc[i % cc.length], spec.accent, "#F3DDA8", "sprinkles", rnd); cu.position.set(boardR + .35 + (i % 2) * .5, 0, .15 + i * .45 - (k - 1) * .2); cu.scale.setScalar(.9); g.add(cu); }
    }
    return g;
  }
  function dispose(g) {
    g.traverse(function (o) {
      if (o.geometry && o.geometry !== SPH) o.geometry.dispose();
      if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { if (m.map) m.map.dispose(); m.dispose(); }); }
    });
  }
  function rig(canvas, w, h) {
    var renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(w, h, false);
    renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; renderer.setClearColor(0x000000, 0);
    var scene = new T.Scene();
    scene.add(new T.HemisphereLight(0xfff6ea, 0xc9b08f, .75));
    var key = new T.DirectionalLight(0xffffff, 1.25); key.position.set(3, 6, 4.5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    var sc = key.shadow.camera; sc.left = -4; sc.right = 4; sc.top = 4; sc.bottom = -4; sc.near = .5; sc.far = 20; key.shadow.radius = 6; key.shadow.bias = -.0006; scene.add(key);
    var fill = new T.DirectionalLight(0xffe2c8, .45); fill.position.set(-4, 2.5, -1); scene.add(fill);
    var rim = new T.DirectionalLight(0xffffff, .35); rim.position.set(0, 3, -5); scene.add(rim);
    var ground = new T.Mesh(new T.PlaneGeometry(30, 30), new T.ShadowMaterial({ opacity: .16 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    return { renderer: renderer, scene: scene, camera: new T.PerspectiveCamera(30, w / h, .1, 100) };
  }
  function fit(r, group, minR) {
    var s = new T.Box3().setFromObject(group).getBoundingSphere(new T.Sphere()), rad = Math.max(s.radius, minR || 0);
    var d = rad / Math.sin(T.MathUtils.degToRad(r.camera.fov / 2)) * 1.02, el = T.MathUtils.degToRad(24);
    r.camera.position.set(s.center.x, s.center.y + Math.sin(el) * d, s.center.z + Math.cos(el) * d);
    r.camera.lookAt(s.center.x, s.center.y - rad * .06, s.center.z); r.camera.updateProjectionMatrix();
  }
  function live(canvas) {
    var box = canvas.parentElement, r = rig(canvas, box.clientWidth || 360, box.clientHeight || 300);
    var group = null, raf = 0, running = false, rotY = -.35, drag = null, last = 0;
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    function size() { var w = box.clientWidth, h = box.clientHeight; if (!w || !h) return; r.renderer.setSize(w, h, false); r.camera.aspect = w / h; if (group) fit(r, group, 1.55); }
    if (window.ResizeObserver) new ResizeObserver(size).observe(box); else window.addEventListener("resize", size);
    canvas.addEventListener("pointerdown", function (e) { drag = { x: e.clientX, r: rotY }; last = performance.now(); try { canvas.setPointerCapture(e.pointerId); } catch (x) {} });
    canvas.addEventListener("pointermove", function (e) { if (!drag) return; rotY = drag.r + (e.clientX - drag.x) * .012; last = performance.now(); });
    function up() { drag = null; } canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
    function frame() { raf = requestAnimationFrame(frame); if (!drag && !reduce && performance.now() - last > 2500) rotY += .0045; if (group) group.rotation.y = rotY; r.renderer.render(r.scene, r.camera); }
    return {
      set: function (spec) { if (group) { r.scene.remove(group); dispose(group); } group = build(spec); r.scene.add(group); size(); fit(r, group, 1.55); r.renderer.render(r.scene, r.camera); },
      start: function () { if (running) return; running = true; size(); raf = requestAnimationFrame(frame); },
      stop: function () { running = false; cancelAnimationFrame(raf); }
    };
  }
  return { live: live };
})();
