/* anim.js — kit d'animations web vanilla. Code original, libre d'usage, aucune mention requise.
   Charger en defer depuis le head (ou inline en fin de body). API : window.Anim.init(conteneur) pour du contenu ajouté après coup. */
(() => {
  document.documentElement.classList.add("js");
  const RM = matchMedia("(prefers-reduced-motion: reduce)");
  const FINE = matchMedia("(hover: hover) and (pointer: fine)");
  const reduced = () => RM.matches;
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const done = new WeakSet();
  const once = (el, key) => { const k = el[key]; if (k) return false; el[key] = true; return true; };

  /* ---------- Compteur : data-count="1250" data-prefix data-suffix data-duration ---------- */
  const fmtFor = (el) => {
    const dec = (el.dataset.count.split(".")[1] || "").length;
    return new Intl.NumberFormat(document.documentElement.lang || "fr-FR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  };
  const setCount = (el, v) => { el.textContent = (el.dataset.prefix || "") + fmtFor(el).format(v) + (el.dataset.suffix || ""); };
  function count(el) {
    const to = parseFloat(el.dataset.count);
    if (reduced() || isNaN(to)) return setCount(el, to || 0);
    const dur = +el.dataset.duration || 1600, t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      setCount(el, to * (1 - Math.pow(1 - p, 4)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------- Texte brouillé : data-scramble (à l'apparition) ou data-scramble="hover" ---------- */
  const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=?";
  function scramble(el) {
    if (reduced() || el._scr) return;
    const final = el.dataset.text || (el.dataset.text = el.textContent);
    const total = Math.max(14, final.length * 2);
    let f = 0;
    el._scr = true;
    const tick = () => {
      const p = f / total;
      el.textContent = [...final].map((c, i) => (c === " " || i < p * final.length ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join("");
      if (f++ < total) requestAnimationFrame(tick);
      else { el.textContent = final; el._scr = false; }
    };
    tick();
  }

  /* ---------- Apparitions au scroll ---------- */
  // Cible observée -> éléments à révéler. Un élément en clip-path est invisible pour
  // IntersectionObserver : on observe alors son parent.
  const watched = new Map();
  const io = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
        for (const e of entries) {
          const els = watched.get(e.target) || [];
          let keep = false;
          for (const el of els) {
            const repeat = el.dataset.once === "false";
            keep ||= repeat;
            if (e.isIntersecting) {
              el.classList.add("is-in");
              if (el.hasAttribute("data-count")) count(el);
              if (el.hasAttribute("data-scramble") && el.dataset.scramble !== "hover") scramble(el);
            } else if (repeat) el.classList.remove("is-in");
          }
          if (e.isIntersecting && !keep) { io.unobserve(e.target); watched.delete(e.target); }
        }
      }, { rootMargin: "0px 0px -10% 0px", threshold: 0 })
    : null;
  const watch = (el) => {
    const t = /^clip/.test(el.dataset.reveal || "") ? el.parentElement || el : el;
    if (!watched.has(t)) { watched.set(t, []); io.observe(t); }
    watched.get(t).push(el);
  };

  /* ---------- Découpe du texte : data-split="words|chars" data-split-step="35" ---------- */
  function split(el) {
    const mode = el.dataset.split || "words";
    const text = el.textContent.trim().replace(/\s+/g, " ");
    el.textContent = "";
    const sr = document.createElement("span");
    sr.className = "sr-only";
    sr.textContent = text;
    el.append(sr);
    if (el.dataset.splitStep) el.style.setProperty("--step", el.dataset.splitStep + "ms");
    let i = 0;
    text.split(" ").forEach((word, w, arr) => {
      const ws = document.createElement("span");
      ws.setAttribute("aria-hidden", "true");
      if (mode === "chars") {
        ws.className = "split-word";
        for (const ch of word) {
          const s = document.createElement("span");
          s.className = "split-unit";
          s.textContent = ch;
          s.style.setProperty("--i", i++);
          ws.append(s);
        }
      } else {
        ws.className = "split-word split-unit";
        ws.textContent = word;
        ws.style.setProperty("--i", i++);
      }
      el.append(ws);
      if (w < arr.length - 1) el.append(" ");
    });
  }

  /* ---------- Machine à écrire : data-type="mot 1|mot 2" data-speed data-hold ---------- */
  function typewriter(el) {
    const words = (el.dataset.type || "").split("|").filter(Boolean);
    if (!words.length) return;
    const sr = document.createElement("span");
    sr.className = "sr-only";
    sr.textContent = words.join(", ");
    el.before(sr);
    el.setAttribute("aria-hidden", "true");
    if (reduced()) { el.textContent = words[0]; return; }
    const speed = +el.dataset.speed || 70, hold = +el.dataset.hold || 1400;
    let w = 0, i = 0, del = false;
    el.classList.add("type-caret");
    const step = () => {
      const word = words[w];
      i += del ? -1 : 1;
      el.textContent = word.slice(0, i);
      let wait = del ? speed / 2 : speed;
      if (!del && i >= word.length) { del = true; wait = hold; }
      else if (del && i <= 0) { del = false; w = (w + 1) % words.length; wait = speed * 4; }
      setTimeout(step, wait);
    };
    step();
  }

  /* ---------- Bandeau défilant : data-marquee="30" data-direction="right" ---------- */
  function marquee(el) {
    const track = document.createElement("div");
    track.className = "marquee-track";
    track.append(...el.childNodes);
    el.append(track);
    if (+el.dataset.marquee) el.style.setProperty("--speed", el.dataset.marquee + "s");
    if (el.dataset.direction === "right") track.style.animationDirection = "reverse";
    const originals = [...track.children];
    const cloneSet = (set) => set.forEach((n) => { const c = n.cloneNode(true); c.setAttribute("aria-hidden", "true"); track.append(c); });
    let guard = 0;
    while (track.scrollWidth < el.clientWidth && guard++ < 20) cloneSet(originals);
    cloneSet([...track.children]); // seconde moitié identique = boucle sans couture
  }

  /* ---------- Bouton magnétique : data-magnetic="0.3" ---------- */
  function magnetic(el) {
    if (!FINE.matches) return;
    const k = parseFloat(el.dataset.magnetic) || 0.3;
    let r;
    el.addEventListener("pointerenter", () => (r = el.getBoundingClientRect()));
    el.addEventListener("pointermove", (e) => {
      if (reduced() || !r) return;
      el.style.transform = `translate(${((e.clientX - r.left - r.width / 2) * k).toFixed(1)}px, ${((e.clientY - r.top - r.height / 2) * k).toFixed(1)}px)`;
    });
    el.addEventListener("pointerleave", () => (el.style.transform = ""));
  }

  /* ---------- Carte inclinable : data-tilt="8" (+ class "glare") ---------- */
  function tilt(el) {
    if (!FINE.matches) return;
    const max = parseFloat(el.dataset.tilt) || 8;
    let r;
    el.addEventListener("pointerenter", () => (r = el.getBoundingClientRect()));
    el.addEventListener("pointermove", (e) => {
      if (reduced() || !r) return;
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(800px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg)`;
      el.style.setProperty("--mx", (x + 0.5) * 100 + "%");
      el.style.setProperty("--my", (y + 0.5) * 100 + "%");
    });
    el.addEventListener("pointerleave", () => (el.style.transform = ""));
  }

  /* ---------- Ondulation au clic : data-ripple ---------- */
  function ripple(el) {
    el.addEventListener("pointerdown", (e) => {
      if (reduced()) return;
      const r = el.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2, s = document.createElement("span");
      s.className = "ripple";
      s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
      el.append(s);
      s.addEventListener("animationend", () => s.remove());
    });
  }

  /* ---------- Accordéon : [data-acc] (parent data-acc-single = un seul ouvert) ---------- */
  function accordion(el) {
    const btn = el.querySelector(".acc-head"), body = el.querySelector(".acc-body");
    if (!btn || !body) return;
    body.id ||= "acc-" + Math.random().toString(36).slice(2, 8);
    const set = (item, open) => {
      item.classList.toggle("is-open", open);
      item.querySelector(".acc-head")?.setAttribute("aria-expanded", open);
      const b = item.querySelector(".acc-body");
      if (b) b.inert = !open;
    };
    btn.setAttribute("aria-controls", body.id);
    set(el, el.classList.contains("is-open"));
    btn.addEventListener("click", () => {
      const open = !el.classList.contains("is-open");
      if (open && el.parentElement?.hasAttribute("data-acc-single"))
        [...el.parentElement.children].filter((c) => c !== el && c.matches("[data-acc]")).forEach((c) => set(c, false));
      set(el, open);
    });
  }

  /* ---------- Menu : button[data-menu-toggle][aria-controls="id-du-panneau"] ---------- */
  function menu(btn) {
    const panel = document.getElementById(btn.getAttribute("aria-controls"));
    if (!panel) return;
    $$("li", panel).forEach((li, i) => li.style.setProperty("--i", i));
    btn.setAttribute("aria-expanded", "false");
    panel.inert = true;
    const set = (open) => {
      btn.setAttribute("aria-expanded", open);
      panel.classList.toggle("is-open", open);
      panel.inert = !open;
      document.documentElement.style.overflow = open ? "hidden" : "";
      if (open) panel.querySelector("a,button")?.focus({ preventScroll: true });
    };
    btn.addEventListener("click", () => set(btn.getAttribute("aria-expanded") !== "true"));
    panel.addEventListener("click", (e) => e.target.closest("a") && set(false));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && btn.getAttribute("aria-expanded") === "true") { set(false); btn.focus(); }
    });
  }

  /* ---------- Initialisation (idempotente) ---------- */
  const parallaxEls = [];
  function init(root = document) {
    $$("[data-stagger]", root).forEach((p) => {
      const step = +p.dataset.stagger || 80;
      [...p.children].forEach((c, i) => {
        if (!c.hasAttribute("data-reveal")) c.dataset.reveal = "up";
        c.style.setProperty("--d", (i * step) / 1000 + "s");
      });
    });
    $$("[data-delay]", root).forEach((el) => el.style.setProperty("--d", (+el.dataset.delay || 0) / 1000 + "s"));
    $$("[data-split]", root).forEach((el) => once(el, "_split") && split(el));
    $$("[data-count]", root).forEach((el) => once(el, "_count0") && !reduced() && io && setCount(el, 0));
    $$("[data-stack]", root).forEach((s) => [...s.children].forEach((c, i) => c.style.setProperty("--i", i)));

    $$("[data-reveal],[data-split],[data-count],[data-scramble]:not([data-scramble='hover'])", root).forEach((el) => {
      if (done.has(el)) return;
      done.add(el);
      if (io) watch(el);
      else { el.classList.add("is-in"); if (el.hasAttribute("data-count")) count(el); }
    });
    $$("[data-scramble='hover']", root).forEach((el) => once(el, "_scrH") && el.addEventListener("pointerenter", () => scramble(el)));
    $$("[data-type]", root).forEach((el) => once(el, "_type") && typewriter(el));
    $$("[data-marquee]", root).forEach((el) => once(el, "_mq") && marquee(el));
    $$("[data-magnetic]", root).forEach((el) => once(el, "_mag") && magnetic(el));
    $$("[data-tilt]", root).forEach((el) => once(el, "_tilt") && tilt(el));
    $$("[data-ripple]", root).forEach((el) => once(el, "_rip") && ripple(el));
    $$("[data-acc]", root).forEach((el) => once(el, "_acc") && accordion(el));
    $$("[data-menu-toggle]", root).forEach((el) => once(el, "_menu") && menu(el));
    $$("[data-parallax]", root).forEach((el) => once(el, "_plx") && parallaxEls.push(el));
    onScroll();
  }

  /* ---------- Scroll : barre de progression + parallaxe data-parallax="0.15" (mesure le parent) ---------- */
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const vh = innerHeight;
      const bar = document.querySelector(".scroll-progress");
      if (bar) bar.style.setProperty("--p", Math.min(1, scrollY / Math.max(1, document.documentElement.scrollHeight - vh)));
      if (reduced()) return;
      for (const el of parallaxEls) {
        const r = (el.parentElement || el).getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) continue;
        const k = parseFloat(el.dataset.parallax) || 0.15;
        el.style.transform = `translate3d(0, ${((r.top + r.height / 2 - vh / 2) * -k).toFixed(1)}px, 0)`;
      }
    });
  }

  /* ---------- Curseur personnalisé : <body data-cursor> (souris uniquement) ---------- */
  function cursor() {
    if (!document.body.hasAttribute("data-cursor") || !FINE.matches || reduced()) return;
    const dot = document.createElement("div");
    dot.className = "cursor-dot";
    dot.setAttribute("aria-hidden", "true");
    document.body.append(dot);
    let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
    addEventListener("pointermove", (e) => { x = e.clientX; y = e.clientY; dot.classList.add("is-on"); }, { passive: true });
    document.addEventListener("pointerover", (e) => dot.classList.toggle("is-hover", !!e.target.closest?.("a,button,[data-cursor-hover]")));
    document.documentElement.addEventListener("pointerleave", () => dot.classList.remove("is-on"));
    const loop = () => {
      cx += (x - cx) * 0.2;
      cy += (y - cy) * 0.2;
      dot.style.transform = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px)`;
      requestAnimationFrame(loop);
    };
    loop();
  }

  /* ---------- Démarrage ---------- */
  const start = () => {
    init();
    cursor();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll, { passive: true });
    const loader = document.querySelector(".page-loader");
    if (loader) {
      const hide = () => setTimeout(() => loader.classList.add("is-done"), +loader.dataset.min || 300);
      document.readyState === "complete" ? hide() : addEventListener("load", hide, { once: true });
    }
  };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start, { once: true }) : start();

  window.Anim = { init, scramble, count };
})();
