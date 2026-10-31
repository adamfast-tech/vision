/* anim-fx.js — extension du kit, s'appuie sur anime.js v4 (licence MIT, notice dans js/vendor/anime.umd.min.js).
   Code de ce fichier original, libre d'usage, aucune mention requise.
   Charger après js/vendor/anime.umd.min.js, en defer. API : window.Fx.init(conteneur). */
(() => {
  const A = window.anime;
  const html = document.documentElement;
  if (!A) { html.classList.remove("fx"); return; }
  const { animate, stagger, onScroll, splitText, svg, createLayout, cubicBezier, utils } = A;
  const RM = matchMedia("(prefers-reduced-motion: reduce)");
  const reduced = () => RM.matches;
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const num = (v, d) => (v == null || v === "" || isNaN(+v) ? d : +v);
  const ready = (el) => el.classList.add("fx-ready");
  const ease = cubicBezier(0.22, 1, 0.36, 1); // = --ease-out du kit
  const once = (el, k) => (el[k] ? false : (el[k] = true));

  /* ---------- Lignes qui montent derrière un masque : data-lines (balises internes conservées) ---------- */
  function lines(el) {
    if (reduced()) return ready(el);
    const step = num(el.dataset.linesStep, 90);
    el._fxSplit = splitText(el, { lines: { class: "fx-line", wrap: "clip" } }).addEffect((s) => {
      ready(el);
      if (el._fxIn) return; // après un redimensionnement, ne pas rejouer
      utils.set(s.lines, { y: "105%" });
      return animate(s.lines, {
        y: "0%", duration: 900, delay: stagger(step), ease,
        autoplay: onScroll({ target: el, enter: "90% top", sync: "play", repeat: false }),
        onComplete: () => (el._fxIn = true),
      });
    });
  }

  /* ---------- Tracé SVG qui se dessine : <svg data-draw> ou data-draw="scrub" (lié au scroll) ---------- */
  function draw(el) {
    const shapes = $$("path,line,polyline,polygon,circle,ellipse,rect", el).filter((s) => !s.closest("defs,clipPath,mask"));
    if (reduced() || !shapes.length) return ready(el);
    const scrub = el.dataset.draw === "scrub";
    const d = svg.createDrawable(shapes);
    utils.set(d, { draw: "0 0" });
    ready(el);
    animate(d, {
      draw: "0 1", duration: num(el.dataset.duration, 1600), delay: stagger(num(el.dataset.drawStep, 120)),
      ease: scrub ? "linear" : "inOut(3)",
      autoplay: scrub
        ? onScroll({ target: el, enter: "bottom top", leave: "center center", sync: 0.25 })
        : onScroll({ target: el, enter: "90% top", sync: "play", repeat: false }),
    });
  }

  /* ---------- Forme qui se transforme en boucle : <path data-morph="#forme-b"> ---------- */
  function morph(el) {
    const to = document.querySelector(el.dataset.morph);
    if (!to || reduced()) return;
    animate(el, {
      [el.tagName.toLowerCase() === "path" ? "d" : "points"]: svg.morphTo(to),
      duration: num(el.dataset.duration, 2400), ease: "inOut(2)", loop: true, alternate: true,
      autoplay: onScroll({ target: el.ownerSVGElement || el }), // joue à l'écran, pause hors écran
    });
  }

  /* ---------- Objet qui suit un tracé au scroll : data-motion="#trace" (data-motion-rotate="false") ---------- */
  function motion(el) {
    const path = document.querySelector(el.dataset.motion);
    if (!path) return;
    let a, obs, t, w = innerWidth;
    const build = () => { // le tracé se mesure à la création : on reconstruit au redimensionnement (refresh() plante ici)
      obs?.revert(); a?.revert();
      const mp = svg.createMotionPath(path);
      const props = { translateX: mp.translateX, translateY: mp.translateY };
      if (el.dataset.motionRotate !== "false") props.rotate = mp.rotate;
      if (reduced()) return (a = animate(el, { ...props, duration: 0 })); // posé en fin de parcours
      obs = onScroll({ target: path.ownerSVGElement, sync: 0.3 });
      a = animate(el, { ...props, ease: "linear", duration: 1000, autoplay: obs });
    };
    build();
    addEventListener("resize", () => { clearTimeout(t); t = setTimeout(() => innerWidth !== w && ((w = innerWidth), build()), 200); }, { passive: true });
  }

  /* ---------- Défilement horizontal épinglé : section[data-hscroll] > .hs-sticky > .hs-track ---------- */
  function hscroll(sec) {
    const sticky = sec.querySelector(".hs-sticky"), track = sec.querySelector(".hs-track");
    if (!sticky || !track || reduced()) return; // repli : défilement horizontal natif avec aimantation
    sec.classList.add("hs-on");
    const dist = () => Math.max(0, track.scrollWidth - sticky.clientWidth);
    const size = () => (sec.style.height = dist() + innerHeight + "px");
    size();
    const obs = onScroll({ target: sec, enter: "top top", leave: "bottom bottom", sync: true });
    const a = animate(track, { x: () => -dist(), ease: "linear", duration: 1000, autoplay: obs });
    let t;
    addEventListener("resize", () => { clearTimeout(t); t = setTimeout(() => { size(); a.refresh(); obs.refresh(); }, 150); }, { passive: true });
    // Clavier : un lien ou bouton qui reçoit le focus dans la piste est ramené à l'écran.
    track.addEventListener("focusin", (e) => {
      const r = e.target.getBoundingClientRect();
      if (r.left < 0 || r.right > innerWidth) {
        const p = Math.min(1, Math.max(0, (e.target.offsetLeft - sticky.clientWidth * 0.1) / Math.max(1, dist())));
        scrollTo({ top: sec.offsetTop + p * dist(), behavior: "instant" });
      }
    });
  }

  /* ---------- Onde dans une grille au clic : [data-wave] > span*N ---------- */
  function wave(el) {
    const cells = [...el.children];
    if (!cells.length) return;
    const grid = () => {
      const top = cells[0].offsetTop;
      let cols = cells.findIndex((c) => c.offsetTop !== top);
      if (cols < 1) cols = cells.length;
      return [cols, Math.ceil(cells.length / cols)];
    };
    const play = (from) => !reduced() && animate(cells, {
      scale: [{ to: 0.35, duration: 260, ease: "out(3)" }, { to: 1, duration: 700, ease: "outElastic(1, .5)" }],
      delay: stagger(45, { grid: grid(), from }),
    });
    el.addEventListener("click", (e) => { const i = cells.indexOf(e.target.closest("[data-wave] > *")); if (i > -1) play(i); });
    if (el.dataset.wave === "auto") onScroll({ target: el, enter: "80% top", repeat: false, onEnter: () => play("center") });
  }

  /* ---------- Filtre animé (FLIP) : [data-filter-bar] > button[data-filter] ; [data-filter-grid] > [data-tags] ---------- */
  function filter(bar) {
    const grid = document.querySelector(bar.dataset.filterBar || "[data-filter-grid]");
    if (!grid) return;
    const items = [...grid.children];
    const layout = reduced() ? null : createLayout(grid, {
      duration: 600, ease,
      enterFrom: { opacity: 0, scale: 0.85 },
      leaveTo: { opacity: 0, scale: 0.85 },
    });
    const apply = (tag) => {
      const set = () => items.forEach((it) => (it.hidden = tag !== "all" && !(it.dataset.tags || "").split(/\s+/).includes(tag)));
      layout ? layout.update(set) : set();
    };
    $$("[data-filter]", bar).forEach((b) => {
      b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") || "false");
      b.addEventListener("click", () => {
        $$("[data-filter]", bar).forEach((x) => x.setAttribute("aria-pressed", x === b));
        apply(b.dataset.filter);
      });
    });
  }

  /* ---------- Initialisation (idempotente) ---------- */
  function init(root = document) {
    $$("[data-lines]", root).forEach((el) => once(el, "_fxL") && lines(el));
    $$("[data-draw]", root).forEach((el) => once(el, "_fxD") && draw(el));
    $$("[data-morph]", root).forEach((el) => once(el, "_fxM") && morph(el));
    $$("[data-motion]", root).forEach((el) => once(el, "_fxP") && motion(el));
    $$("[data-hscroll]", root).forEach((el) => once(el, "_fxH") && hscroll(el));
    $$("[data-wave]", root).forEach((el) => once(el, "_fxW") && wave(el));
    $$("[data-filter-bar]", root).forEach((el) => once(el, "_fxF") && filter(el));
  }
  const start = () => (document.fonts?.ready || Promise.resolve()).then(() => init()); // polices chargées = lignes justes
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start, { once: true }) : start();
  window.Fx = { init };
})();
