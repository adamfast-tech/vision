/* anim-pixi.js — effets canvas WebGL du kit, s'appuie sur PixiJS v8 (licence MIT, notice dans js/vendor/pixi.min.js).
   Code de ce fichier original, libre d'usage, aucune mention requise.
   Balise : script src="js/anim-pixi.js" defer data-pixi-src="js/vendor/pixi.min.js" (dans le head).
   PixiJS (~240 Ko gzip) n'est téléchargé que si la page contient un [data-pixi], quand il approche de l'écran.
   1 à 2 canvas par page au maximum (contextes WebGL limités). */
(() => {
  const SRC = document.currentScript?.dataset.pixiSrc || "js/vendor/pixi.min.js";
  let P = window.PIXI, loading;
  const loadPixi = () => P ? Promise.resolve(P) : (loading ||= new Promise((ok, ko) => {
    const s = document.createElement("script");
    s.src = SRC; s.async = true;
    s.onload = () => ((P = window.PIXI) ? ok(P) : ko(new Error("PIXI absent")));
    s.onerror = () => ko(new Error("chargement de " + SRC + " impossible"));
    document.head.append(s);
  }));
  const RM = matchMedia("(prefers-reduced-motion: reduce)");
  const reduced = () => RM.matches;
  const color = (v, d) => { try { return new P.Color(v || d).toNumber(); } catch { return new P.Color(d).toNumber(); } };

  /* ---------- Champ de particules qui fuient le pointeur : <section data-pixi="particles" data-color="#c9a96e" data-density="1"> ---------- */
  function particles(app, host) {
    const dot = app.renderer.generateTexture(new P.Graphics().circle(0, 0, 8).fill(0xffffff));
    const pc = new P.ParticleContainer({ dynamicProperties: { position: true } }); // seule la position change à chaque image
    app.stage.addChild(pc);
    const tint = color(host.dataset.color, "#ffffff");
    const density = parseFloat(host.dataset.density) || 1;
    let list = [];
    const build = () => {
      pc.removeParticles();
      const { width: w, height: h } = app.screen;
      const n = Math.min(1500, Math.round(((w * h) / 4000) * density));
      list = Array.from({ length: n }, () => {
        const s = 0.08 + Math.random() * 0.28;
        const p = new P.Particle({ texture: dot, x: Math.random() * w, y: Math.random() * h, scaleX: s, scaleY: s, anchorX: 0.5, anchorY: 0.5, tint, alpha: 0.2 + Math.random() * 0.6 });
        p.bx = p.x; p.by = p.y; p.ox = p.oy = 0;
        p.vx = (Math.random() - 0.5) * 0.3; p.vy = -0.1 - Math.random() * 0.35;
        pc.addParticle(p);
        return p;
      });
    };
    build();
    const ptr = { x: -9999, y: -9999 };
    host.addEventListener("pointermove", (e) => { const r = host.getBoundingClientRect(); ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top; }, { passive: true });
    host.addEventListener("pointerleave", () => (ptr.x = ptr.y = -9999));
    app.ticker.add((t) => {
      const { width: w, height: h } = app.screen, dt = t.deltaTime, R = 120, damp = Math.pow(0.9, dt);
      for (const p of list) {
        p.bx += p.vx * dt; p.by += p.vy * dt; // dérive lente, bouclée
        if (p.by < -10) p.by = h + 10; if (p.bx < -10) p.bx = w + 10; else if (p.bx > w + 10) p.bx = -10;
        const dx = p.bx + p.ox - ptr.x, dy = p.by + p.oy - ptr.y, d2 = dx * dx + dy * dy;
        if (d2 < R * R) { const d = Math.sqrt(d2) || 1, f = (1 - d / R) * 4 * dt; p.ox += (dx / d) * f; p.oy += (dy / d) * f; }
        p.ox *= damp; p.oy *= damp; // retour élastique vers la position de base
        p.x = p.bx + p.ox; p.y = p.by + p.oy;
      }
    });
    return { resize: build };
  }

  /* ---------- Image qui ondule comme de l'eau : <div data-pixi="water"><img src="img/hero.jpg" alt="…"></div> ---------- */
  function noiseMap(size = 256) { // carte de déplacement procédurale et raccordable (aucun fichier à fournir)
    const c = document.createElement("canvas"); c.width = c.height = size;
    const g = c.getContext("2d"), img = g.createImageData(size, size), T = Math.PI * 2;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size, i = (y * size + x) * 4;
      img.data[i] = 128 + 60 * Math.sin(T * (2 * u + v)) + 40 * Math.sin(T * (3 * v - u));
      img.data[i + 1] = 128 + 60 * Math.cos(T * (u - 2 * v)) + 40 * Math.cos(T * (3 * u + v));
      img.data[i + 2] = 128; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  }
  async function water(app, host) {
    const img = host.querySelector("img");
    if (!img) return null;
    const tex = await P.Assets.load(img.currentSrc || img.src); // même origine (ou CORS) et http(s) : pas en file://
    const pic = new P.Sprite(tex);
    pic.anchor.set(0.5);
    const mapTex = P.Texture.from(noiseMap());
    mapTex.source.addressMode = "repeat";
    const map = new P.Sprite(mapTex);
    map.renderable = false; // sert de carte, n'est pas dessiné
    const strength = parseFloat(host.dataset.strength) || 18;
    const filter = new P.DisplacementFilter({ sprite: map, scale: strength });
    pic.filters = [filter];
    app.stage.addChild(map, pic);
    const fit = () => {
      const { width: w, height: h } = app.screen;
      const s = Math.max(w / tex.width, h / tex.height) * 1.06; // marge pour cacher les bords tirés
      pic.scale.set(s); pic.position.set(w / 2, h / 2);
    };
    fit();
    let target = strength;
    host.addEventListener("pointerenter", () => (target = strength * 2.2));
    host.addEventListener("pointerleave", () => (target = strength));
    app.ticker.add((t) => {
      map.x += 0.6 * t.deltaTime; map.y += 0.35 * t.deltaTime;
      filter.scale.x += (target - filter.scale.x) * 0.06; filter.scale.y = filter.scale.x;
    });
    return { resize: fit };
  }

  const EFFECTS = { particles, water };

  async function mount(host) {
    const fx = EFFECTS[host.dataset.pixi];
    if (!fx) return;
    if (host.dataset.pixi === "water" && reduced()) return; // image fixe d'origine
    let app;
    try {
      await loadPixi();
      app = new P.Application();
      await app.init({ resizeTo: host, backgroundAlpha: 0, antialias: true, autoDensity: true, resolution: Math.min(devicePixelRatio || 1, 2), preference: "webgl" });
      const ctl = await fx(app, host);
      if (!ctl) { app.destroy(true); return; }
      app.canvas.setAttribute("aria-hidden", "true");
      host.prepend(app.canvas);
      host.classList.add("pixi-on");
      app.renderer.on("resize", () => { ctl.resize(); if (!app.ticker.started) app.render(); });
      // Économie : pause hors écran et en mouvement réduit (une image fixe est rendue).
      let visible = true;
      const sync = () => (visible && !reduced() ? app.ticker.start() : (app.ticker.stop(), app.render()));
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }).observe(host);
      RM.addEventListener?.("change", sync);
      host._app = app;
    } catch (err) {
      console.warn("[anim-pixi] repli HTML :", err.message); // pas de WebGL, lib ou image inaccessible
      try { app?.destroy(true); } catch {}
    }
  }

  // Montage à l'approche de l'écran (marge 300 px) : rien n'est téléchargé pour un effet jamais vu.
  const near = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { near.unobserve(e.target); mount(e.target); }
  }), { rootMargin: "300px 0px" }) : null;
  const init = (root = document) => root.querySelectorAll("[data-pixi]").forEach((h) => {
    if (h._pixi) return;
    h._pixi = true;
    near ? near.observe(h) : mount(h);
  });
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", () => init(), { once: true }) : init();
  window.PixiFx = { init };
})();
