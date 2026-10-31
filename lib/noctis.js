/* ==========================================================================
   Noctis 1.2 — boutons animés en HTML / CSS / JavaScript vanilla
   Aucune dépendance. Démarrage automatique sur [data-nx].
   API : Noctis.init(racine), Noctis.monter(el), Noctis.etat(el, etat),
         Noctis.progression(el, 0..1), Noctis.particules(liste, surfaces), Noctis.def(nom, fabrique)
   Événements émis (bubbles) : nx:confirm, nx:abort, nx:change, nx:copie, nx:raccourci,
         nx:etat, nx:epuise, nx:explosion, nx:ramasse, nx:pret, nx:progression, nx:fin,
         nx:fichiers, nx:etape, nx:partage
   ========================================================================== */
(function () {
  'use strict';

  var NX = window.Noctis = window.Noctis || {};
  NX.version = '1.2.0';

  var defs = {};
  var mqCalme = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var D2R = Math.PI / 180;

  /* ---------- Outils ---------- */
  function calme() { return mqCalme.matches; }
  function h(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function cache(e) { e.setAttribute('aria-hidden', 'true'); return e; }
  function label(el) {
    var s = h('span', 'nx-l');
    while (el.firstChild) s.appendChild(el.firstChild);
    el.appendChild(s);
    return s;
  }
  function opt(el, cle, def) {
    var v = el.dataset[cle];
    if (v == null || v === '') return def;
    if (typeof def === 'number') { var n = parseFloat(v); return isNaN(n) ? def : n; }
    if (typeof def === 'boolean') return v !== 'false';
    return v;
  }
  function emit(el, type, detail) {
    el.dispatchEvent(new CustomEvent('nx:' + type, { bubbles: true, detail: detail || {} }));
  }
  function jeton(el, nom, def) {
    var v = getComputedStyle(el).getPropertyValue(nom).trim();
    return v || def;
  }
  function hasard(a, b) { return a + Math.random() * (b - a); }
  function choix(t) { return t[Math.floor(Math.random() * t.length)]; }
  function borne(v, a, b) { return v < a ? a : v > b ? b : v; }
  function secoue(el) {
    if (calme()) return;
    el.classList.remove('nx-secoue');
    void el.offsetWidth;
    el.classList.add('nx-secoue');
    setTimeout(function () { el.classList.remove('nx-secoue'); }, 360);
  }
  function graine(n) { // générateur pseudo-aléatoire reproductible
    return function () {
      n |= 0; n = n + 0x6D2B79F5 | 0;
      var t = Math.imul(n ^ n >>> 15, 1 | n);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  // maintien au pointeur + clavier (Espace / Entrée)
  function surMaintien(el, debut, fin) {
    el.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      debut();
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (n) { el.addEventListener(n, fin); });
    el.addEventListener('keydown', function (e) {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); debut(); }
    });
    el.addEventListener('keyup', function (e) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); fin(); }
    });
    el.addEventListener('blur', fin);
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  var ICO = {
    chevron: '<svg class="nx-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5"/></svg>',
    copie: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="5.5" y="5.5" width="8.5" height="8.5" rx="1.8"/><path d="M10.5 5.5V3.3a1.8 1.8 0 0 0-1.8-1.8H3.3a1.8 1.8 0 0 0-1.8 1.8v5.4a1.8 1.8 0 0 0 1.8 1.8h2.2"/></svg>',
    ok: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="nx-trait" d="M3 8.5 6.5 12 13 4.5"/></svg>',
    croix: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path class="nx-trait" d="M4 4l8 8M12 4l-8 8"/></svg>',
    spin: '<svg class="nx-spin" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6" opacity=".25"/><path d="M14 8a6 6 0 0 0-6-6"/></svg>',
    etoile: '<svg class="nx-cf-etoile" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0c.5 4.2 1.8 6.6 8 8-6.2 1.4-7.5 3.8-8 8-.5-4.2-1.8-6.6-8-8 6.2-1.4 7.5-3.8 8-8Z"/></svg>',
    flamme: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1.2C9.6 4 12.4 6 12.4 9.6a4.4 4.4 0 0 1-8.8 0c0-1.9.9-3 1.8-3.9.2 1.2.8 2 1.6 2.4C6.6 5.7 7.1 3.4 8 1.2Z"/></svg>'
  };

  /* ---------- Registre et montage ---------- */
  NX.def = function (nom, fabrique) { defs[nom] = fabrique; };

  function monter(el) {
    if (el._nx) return el._nx;
    var nom = el.getAttribute('data-nx'), fab = defs[nom];
    if (!fab) return null;
    el.classList.add('nx', 'nx-' + nom);
    if (el.tagName === 'BUTTON' && !el.hasAttribute('type')) el.type = 'button';
    el._nx = fab(el) || {};
    return el._nx;
  }
  NX.monter = monter;

  NX.init = function (racine) {
    racine = racine || document;
    if (racine.nodeType === 1 && racine.hasAttribute('data-nx')) monter(racine);
    var liste = racine.querySelectorAll ? racine.querySelectorAll('[data-nx]') : [];
    for (var i = 0; i < liste.length; i++) monter(liste[i]);
  };

  /* ---------- Moteur de particules partagé ---------- */
  var scene = null;

  function creerScene() {
    var cv = cache(h('canvas', 'nx-scene'));
    document.body.appendChild(cv);
    var s = { cv: cv, ctx: cv.getContext('2d'), parts: [], surfaces: [], raf: 0, last: 0, W: 0, H: 0 };
    function taille() {
      var d = Math.min(window.devicePixelRatio || 1, 2);
      s.W = innerWidth; s.H = innerHeight;
      cv.width = Math.round(s.W * d); cv.height = Math.round(s.H * d);
      s.ctx.setTransform(d, 0, 0, d, 0, 0);
    }
    taille();
    addEventListener('resize', taille);
    return s;
  }

  function dessinerParticule(ctx, p) {
    var reste = p.vie - p.age, a = reste < .5 ? reste / .5 : 1;
    if (p.age < .04) a *= p.age / .04;
    ctx.save();
    ctx.globalAlpha = Math.max(0, a) * (p.alpha == null ? 1 : p.alpha);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.couleur;
    if (p.lueur) { ctx.shadowColor = p.couleur; ctx.shadowBlur = p.taille * 3; }
    var t = p.taille;
    if (p.forme === 'rond') { ctx.beginPath(); ctx.arc(0, 0, t, 0, 6.2832); ctx.fill(); }
    else if (p.forme === 'eclat') {
      ctx.beginPath(); ctx.moveTo(p.pts[0] * t, p.pts[1] * t);
      for (var i = 2; i < p.pts.length; i += 2) ctx.lineTo(p.pts[i] * t, p.pts[i + 1] * t);
      ctx.closePath(); ctx.fill();
    }
    else if (p.forme === 'ruban') { ctx.scale(1, Math.cos(p.age * 9 + p.phase)); ctx.fillRect(-t, -t * .45, t * 2, t * .9); }
    else if (p.forme === 'coeur') {
      ctx.beginPath(); ctx.moveTo(0, t * .95);
      ctx.bezierCurveTo(-t * 1.9, -t * .2, -t * .9, -t * 1.5, 0, -t * .5);
      ctx.bezierCurveTo(t * .9, -t * 1.5, t * 1.9, -t * .2, 0, t * .95);
      ctx.fill();
    }
    else ctx.fillRect(-t, -t, t * 2, t * 2);
    ctx.restore();
  }

  function boucleScene(t) {
    var s = scene, dt = s.last ? Math.min((t - s.last) / 1000, 1 / 30) : 1 / 60;
    s.last = t;
    var ctx = s.ctx;
    ctx.clearRect(0, 0, s.W, s.H);
    var rects = s.surfaces.map(function (el) {
      if (!el.isConnected || getComputedStyle(el).visibility === 'hidden') return null;
      var r = el.getBoundingClientRect();
      return r.width ? r : null;
    });
    for (var i = s.parts.length - 1; i >= 0; i--) {
      var p = s.parts[i];
      p.age += dt;
      if (p.age >= p.vie || p.y > s.H + 80 || p.x < -80 || p.x > s.W + 80) { s.parts.splice(i, 1); continue; }
      if (p.posee != null) {
        var rp = rects[p.posee];
        if (!rp || p.ox < 0 || p.ox > rp.width) p.posee = null;
        else { p.x = rp.left + p.ox; p.y = rp.top - p.taille * .7; }
      }
      if (p.posee == null) {
        p.vy += p.g * dt;
        var f = Math.max(0, 1 - p.air * dt);
        p.vx *= f; p.vy *= f;
        if (p.forme === 'ruban') p.vx += Math.sin(p.age * 6 + p.phase) * 40 * dt;
        var nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
        if (p.vy > 0) {
          for (var k = 0; k < rects.length; k++) {
            var r = rects[k]; if (!r) continue;
            var bord = r.top - p.taille * .7;
            if (p.y <= bord && ny >= bord && nx > r.left + 2 && nx < r.right - 2) {
              ny = bord; p.vy *= -p.rebond; p.vx *= .5; p.vrot *= .4;
              if (Math.abs(p.vy) < 50) { p.posee = k; p.ox = nx - r.left; p.vy = 0; p.vx = 0; p.vrot = 0; }
              break;
            }
          }
        }
        p.x = nx; p.y = ny; p.rot += p.vrot * dt;
      }
      dessinerParticule(ctx, p);
    }
    if (s.parts.length) s.raf = requestAnimationFrame(boucleScene);
    else { s.raf = 0; s.last = 0; s.surfaces = []; ctx.clearRect(0, 0, s.W, s.H); }
  }

  /* liste : [{x, y, vx, vy, g, air, vie, taille, couleur, forme, lueur, rebond, rot, vrot}]
     surfaces : éléments dont le bord haut retient les particules (empilement) */
  NX.particules = function (liste, surfaces) {
    if (calme() || !liste || !liste.length) return;
    if (!scene) scene = creerScene();
    liste.forEach(function (p) {
      p.age = 0;
      if (p.g == null) p.g = 900;
      if (p.air == null) p.air = 1;
      if (p.vie == null) p.vie = 1.5;
      if (p.taille == null) p.taille = 3;
      if (p.rot == null) p.rot = Math.random() * 6.28;
      if (p.vrot == null) p.vrot = (Math.random() - .5) * 8;
      if (p.rebond == null) p.rebond = .3;
      p.forme = p.forme || 'carre';
      p.phase = Math.random() * 6.28;
      if (p.forme === 'eclat') {
        p.pts = [];
        var n = 4 + (Math.random() * 2 | 0);
        for (var i = 0; i < n; i++) {
          var a = i / n * 6.2832 + Math.random() * .6, rr = hasard(.5, 1.25);
          p.pts.push(Math.cos(a) * rr, Math.sin(a) * rr);
        }
      }
      scene.parts.push(p);
    });
    (surfaces || []).forEach(function (el) { if (scene.surfaces.indexOf(el) < 0) scene.surfaces.push(el); });
    if (!scene.raf) { scene.last = 0; scene.raf = requestAnimationFrame(boucleScene); }
  };

  // gerbe radiale autour d'un point
  function gerbe(x, y, n, o) {
    var l = [];
    for (var i = 0; i < n; i++) {
      var ang = (o.angle == null ? -90 : o.angle) * D2R + (Math.random() * 2 - 1) * (o.ouverture == null ? 360 : o.ouverture) * D2R / 2;
      var v = hasard(o.vmin || 200, o.vmax || 500), c = choix(o.couleurs);
      l.push({
        x: x + hasard(-(o.dx || 0), o.dx || 0), y: y + hasard(-(o.dy || 0), o.dy || 0),
        vx: Math.cos(ang) * v, vy: Math.sin(ang) * v,
        g: o.g, air: o.air, rebond: o.rebond, vie: hasard(o.viemin || .6, o.viemax || 1.2),
        taille: hasard(o.tmin || 2, o.tmax || 4), couleur: c,
        forme: Array.isArray(o.forme) ? choix(o.forme) : o.forme,
        lueur: o.lueur ? o.lueur(c) : false,
        rot: o.fixe ? 0 : undefined, vrot: o.fixe ? 0 : undefined
      });
    }
    return l;
  }

  /* outils exposés aux composants (même fichier) */
  var U = { h: h, cache: cache, label: label, opt: opt, emit: emit, jeton: jeton, hasard: hasard, choix: choix,
            borne: borne, secoue: secoue, graine: graine, surMaintien: surMaintien, gerbe: gerbe, calme: calme, ICO: ICO, D2R: D2R };
  NX._u = U;

  /* ==========================================================================
     STYLE
     ========================================================================== */

  NX.def('brut', function (el) { label(el); });
  NX.def('mercure', function (el) { label(el); });

  NX.def('gel', function (el) {
    label(el);
    if (el.dataset.teinte) el.style.setProperty('--nx-teinte', el.dataset.teinte);
  });

  NX.def('lustre', function (el) {
    label(el);
    var reflet = cache(h('span', 'nx-lu-reflet'));
    el.appendChild(reflet);
    el.addEventListener('click', function () {
      if (calme()) return;
      reflet.animate([
        { transform: 'translateX(-180%) skewX(-18deg)' },
        { transform: 'translateX(380%) skewX(-18deg)' }
      ], { duration: 720, easing: 'cubic-bezier(.3,.7,.2,1)' });
    });
  });

  NX.def('sobre', function (el) {
    label(el);
    if (!el.hasAttribute('data-sans-chevron')) el.insertAdjacentHTML('beforeend', ICO.chevron);
  });

  NX.def('relief', function (el) {
    label(el);
    var eclat = cache(h('span', 'nx-re-eclat'));
    el.appendChild(eclat);
    el.addEventListener('click', function () {
      if (calme()) return;
      eclat.animate([
        { transform: 'translateX(-160%) rotate(24deg)' },
        { transform: 'translateX(620%) rotate(24deg)' }
      ], { duration: 460, easing: 'ease-out' });
    });
  });

  NX.def('viseur', function (el) {
    label(el);
    ['hg', 'hd', 'bg', 'bd'].forEach(function (c) { el.appendChild(cache(h('span', 'nx-vi-c ' + c))); });
    el.appendChild(cache(h('span', 'nx-vi-scan')));
    var t = 0;
    el.addEventListener('click', function () {
      el.classList.add('verrou');
      clearTimeout(t);
      t = setTimeout(function () { el.classList.remove('verrou'); }, 700);
    });
  });

  NX.def('projecteur', function (el) {
    label(el);
    var portee = opt(el, 'portee', 120);
    addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      var dx = Math.max(-x, 0, x - r.width), dy = Math.max(-y, 0, y - r.height);
      var pres = 1 - Math.min(1, Math.hypot(dx, dy) / portee);
      if (pres <= 0 && el._nxPres === 0) return;
      el._nxPres = pres;
      el.style.setProperty('--x', x.toFixed(1) + 'px');
      el.style.setProperty('--y', y.toFixed(1) + 'px');
      el.style.setProperty('--nx-pres', pres.toFixed(3));
    }, { passive: true });
    el.addEventListener('pointerdown', function (e) {
      if (calme()) return;
      var r = el.getBoundingClientRect(), o = cache(h('span', 'nx-pj-onde'));
      o.style.left = (e.clientX - r.left) + 'px';
      o.style.top = (e.clientY - r.top) + 'px';
      el.appendChild(o);
      var echelle = Math.hypot(r.width, r.height) / 5;
      o.animate([{ transform: 'scale(0)', opacity: 1 }, { transform: 'scale(' + echelle + ')', opacity: 0 }],
        { duration: 650, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = function () { o.remove(); };
    });
  });

  NX.def('crochets', function (el) {
    var l = label(el);
    var g = cache(h('span', 'nx-cr g')), d = cache(h('span', 'nx-cr d'));
    var flash = cache(h('span', 'nx-cr-flash')), jauge = cache(h('span', 'nx-cr-jauge'));
    for (var i = 0; i < 5; i++) jauge.appendChild(h('i'));
    el.insertBefore(flash, l);
    el.appendChild(g); el.appendChild(d); el.appendChild(jauge);
    var niv = 0, tAttente = 0, tBaisse = 0;
    function maj() {
      el.style.setProperty('--nx-niv', niv);
      if (niv) el.setAttribute('data-niveau', niv); else el.removeAttribute('data-niveau');
      for (var k = 0; k < 5; k++) jauge.children[k].classList.toggle('on', k < niv);
    }
    function baisser() {
      clearInterval(tBaisse);
      tBaisse = setInterval(function () { niv = Math.max(0, niv - 1); maj(); if (!niv) clearInterval(tBaisse); }, 420);
    }
    el.addEventListener('click', function () {
      niv = Math.min(5, niv + 1); maj();
      clearInterval(tBaisse); clearTimeout(tAttente);
      tAttente = setTimeout(baisser, 900);
      if (calme()) return;
      flash.animate([{ opacity: .95 }, { opacity: 0 }], { duration: 240 + niv * 40, easing: 'ease-out' });
      el.classList.add('flash');
      setTimeout(function () { el.classList.remove('flash'); }, 110);
      var e = 6 + niv * 2;
      g.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(' + (-e) + 'px) scaleY(1.18)' }, { transform: 'translateX(0)' }],
        { duration: 380, easing: 'cubic-bezier(.2,.9,.3,1)' });
      d.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(' + e + 'px) scaleY(1.18)' }, { transform: 'translateX(0)' }],
        { duration: 380, easing: 'cubic-bezier(.2,.9,.3,1)' });
      var r = el.getBoundingClientRect(), c = jeton(el, '--nx-accent', '#6a45ff'), ps = [];
      for (var k = 0; k < 4 + niv * 2; k++) {
        var cote = k % 2 ? 1 : -1;
        ps.push({ x: cote > 0 ? r.right : r.left, y: r.top + r.height * Math.random(),
          vx: cote * hasard(120, 320), vy: (Math.random() - .5) * 160, g: 300, air: 3,
          vie: hasard(.3, .6), taille: hasard(1.5, 2.6), couleur: c, forme: 'carre', rot: 0, vrot: 0 });
      }
      NX.particules(ps);
    });
  });

  /* ==========================================================================
     EFFETS
     ========================================================================== */

  /* ---------- trame : matrice de Bayer 4×4, texte découpé en XOR ---------- */
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  NX.def('trame', function (el) {
    var l = label(el), cv = cache(h('canvas'));
    el.insertBefore(cv, l);
    var ctx = cv.getContext('2d');
    var px = borne(opt(el, 'pixel', 4), 1, 32), vitesse = opt(el, 'vitesse', 1);
    var dpr = 1, survol = 0, cible = 0, t0 = performance.now(), raf = 0, visible = true, dernier = 0;

    function taille() {
      var r = el.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.max(1, Math.round(r.width * dpr));
      cv.height = Math.max(1, Math.round(r.height * dpr));
      dessiner(performance.now());
    }
    function dessiner(t) {
      var s = (t - t0) / 1000 * vitesse, cs = getComputedStyle(el);
      var coul = el.dataset.couleur || cs.color, cell = px * dpr;
      var cols = Math.ceil(cv.width / cell), rows = Math.ceil(cv.height / cell);
      survol += (cible - survol) * .1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = coul;
      for (var y = 0; y < rows; y++) {
        var v = y / rows;
        for (var x = 0; x < cols; x++) {
          var u = x / cols;
          var onde = .5 + .5 * Math.sin(u * 7 - s * 2.4 + Math.sin(v * 5 + s * 1.3) * 1.6);
          var val = onde * .74 - v * .2 + .08 + survol * .24;
          if (val > (BAYER[(y & 3) * 4 + (x & 3)] + .5) / 16) ctx.fillRect(x * cell, y * cell, cell, cell);
        }
      }
      // texte : un halo vide autour des lettres, puis les lettres pleines
      ctx.font = cs.fontWeight + ' ' + (parseFloat(cs.fontSize) * dpr) + 'px ' + cs.fontFamily;
      if ('letterSpacing' in ctx) ctx.letterSpacing = ((parseFloat(cs.letterSpacing) || 0) * dpr) + 'px';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      var txt = l.textContent.trim();
      if (cs.textTransform === 'uppercase') txt = txt.toUpperCase();
      var lr = l.getBoundingClientRect(), er = el.getBoundingClientRect();
      var tx = (lr.left - er.left + lr.width / 2) * dpr, ty = (lr.top - er.top + lr.height / 2 + .5) * dpr;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = (px + 3) * dpr;
      ctx.strokeText(txt, tx, ty);
      ctx.fillText(txt, tx, ty);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillText(txt, tx, ty);
    }
    function boucle(t) {
      if (t - dernier > 33) { dernier = t; dessiner(t); }
      raf = requestAnimationFrame(boucle);
    }
    function lancer() { if (!raf && visible && !calme()) raf = requestAnimationFrame(boucle); }
    function arreter() { cancelAnimationFrame(raf); raf = 0; }

    el.addEventListener('pointerenter', function () { cible = 1; });
    el.addEventListener('pointerleave', function () { cible = 0; });
    if ('ResizeObserver' in window) new ResizeObserver(taille).observe(el);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (ent) {
        visible = ent[0].isIntersecting;
        if (visible) lancer(); else arreter();
      }).observe(el);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(taille);
    taille();
    lancer();
  });

  /* ---------- oeil : suit le curseur, se fixe au survol, cligne ---------- */
  var nOeil = 0;
  NX.def('oeil', function (el) {
    var l = label(el), id = 'nxoe' + (++nOeil);
    var amande = 'M2 14 Q30 -5 58 14 Q30 33 2 14Z';
    el.insertAdjacentHTML('afterbegin',
      '<svg class="nx-oe-oeil" viewBox="0 0 60 28" aria-hidden="true"><defs>' +
      '<clipPath id="' + id + 'c"><path d="' + amande + '"/></clipPath>' +
      '<radialGradient id="' + id + 'g" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff1b0"/><stop offset=".35" stop-color="#ffb02e"/><stop offset=".7" stop-color="#ff4d12"/><stop offset="1" stop-color="#7a0b00"/></radialGradient>' +
      '</defs><g class="nx-oe-paupiere"><path d="' + amande + '" fill="#1a0604" stroke="rgba(255,120,50,.55)" stroke-width="1"/>' +
      '<g clip-path="url(#' + id + 'c)"><g class="nx-oe-iris"><circle cx="30" cy="14" r="9.5" fill="url(#' + id + 'g)"/>' +
      '<ellipse class="nx-oe-pupille" cx="30" cy="14" rx="2" ry="7.5" fill="#0a0202"/></g></g></g></svg>');
    var oeil = el.firstChild, iris = oeil.querySelector('.nx-oe-iris'), paupiere = oeil.querySelector('.nx-oe-paupiere');

    addEventListener('pointermove', function (e) {
      var r = oeil.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      var ang = Math.atan2(dy, dx), d = Math.min(1, Math.hypot(dx, dy) / 260);
      iris.style.transform = 'translate(' + (Math.cos(ang) * d * 10).toFixed(2) + 'px,' + (Math.sin(ang) * d * 4).toFixed(2) + 'px)';
    }, { passive: true });

    function cligner() {
      if (calme()) return;
      paupiere.animate([{ transform: 'scaleY(1)' }, { transform: 'scaleY(.06)' }, { transform: 'scaleY(1)' }],
        { duration: 210, easing: 'ease-in-out' });
    }
    (function planifier() { setTimeout(function () { cligner(); planifier(); }, hasard(2500, 6000)); })();
    el.addEventListener('click', cligner);
  });

  /* ---------- ticket : se déchire au pointillé (charnière ou rupture) ---------- */
  NX.def('ticket', function (el) {
    var corps = h('span', 'nx-ti-corps'), talon = cache(h('span', 'nx-ti-talon'));
    while (el.firstChild) corps.appendChild(el.firstChild);
    var num = el.dataset.numero || ('0' + (100 + (Math.random() * 899 | 0)));
    talon.innerHTML = '<span>N°</span><b>' + num + '</b>';
    el.appendChild(corps); el.appendChild(talon);
    var occupe = false;
    el.addEventListener('click', function () {
      if (occupe || calme()) return;
      occupe = true;
      var mode = el.dataset.mode || 'charniere';
      corps.animate([{ transform: 'none' }, { transform: 'translateX(-2px)' }, { transform: 'none' }], { duration: 260 });
      if (mode === 'rupture') {
        talon.animate([
          { transform: 'none', opacity: 1 },
          { transform: 'translate(10px,-4px) rotate(8deg)', opacity: 1, offset: .25 },
          { transform: 'translate(34px,60px) rotate(38deg)', opacity: 0 }
        ], { duration: 700, easing: 'cubic-bezier(.4,0,.8,.6)', fill: 'forwards' });
        setTimeout(function () {
          talon.animate([{ transform: 'scale(.6)', opacity: 0 }, { transform: 'none', opacity: 1 }],
            { duration: 320, easing: 'cubic-bezier(.34,1.45,.64,1)', fill: 'forwards' }).onfinish = function () { occupe = false; };
        }, 1300);
      } else {
        talon.style.transformOrigin = '0 100%';
        talon.animate([
          { transform: 'none' },
          { transform: 'rotate(30deg) translate(3px,2px)', offset: .35 },
          { transform: 'rotate(22deg) translate(3px,2px)', offset: .5 },
          { transform: 'rotate(26deg) translate(3px,2px)', offset: .8 },
          { transform: 'none' }
        ], { duration: 2000, easing: 'ease-in-out' }).onfinish = function () { occupe = false; };
      }
      emit(el, 'confirm', { mode: mode });
    });
  });

  /* ---------- parasite : salves de glitch aléatoires ---------- */
  NX.def('parasite', function (el) {
    var l = label(el);
    l.setAttribute('data-texte', l.textContent.trim());
    var survol = false, tSalve = 0;
    function tranche() {
      var a = Math.random() * 80, b = Math.min(100, a + hasard(8, 40));
      return 'inset(' + a.toFixed(0) + '% 0 ' + (100 - b).toFixed(0) + '% 0)';
    }
    function salve() {
      if (calme()) return planifier();
      var n = 3 + (Math.random() * 5 | 0);
      el.classList.add('panne');
      (function pas() {
        el.style.setProperty('--dx', hasard(1, 4).toFixed(1) + 'px');
        el.style.setProperty('--c1', tranche());
        el.style.setProperty('--c2', tranche());
        l.style.transform = 'translateX(' + hasard(-2, 2).toFixed(1) + 'px)';
        if (--n > 0) setTimeout(pas, hasard(30, 70));
        else { el.classList.remove('panne'); l.style.transform = ''; planifier(); }
      })();
    }
    function planifier() { clearTimeout(tSalve); tSalve = setTimeout(salve, survol ? hasard(300, 1100) : hasard(1600, 4500)); }
    el.addEventListener('pointerenter', function () { survol = true; planifier(); });
    el.addEventListener('pointerleave', function () { survol = false; });
    el.addEventListener('click', function () { clearTimeout(tSalve); salve(); });
    planifier();
  });

  /* ---------- confettis ---------- */
  var COULEURS_FETE = ['#ffd166', '#ef476f', '#06d6a0', '#4cc9f0', '#f8f9fa', '#b388ff'];
  NX.def('confettis', function (el) {
    label(el);
    el.insertAdjacentHTML('afterbegin', ICO.etoile);
    var etoile = el.firstChild;
    el.addEventListener('click', function () {
      if (calme()) return;
      etoile.animate([{ transform: 'rotate(0) scale(1)' }, { transform: 'rotate(180deg) scale(1.35)' }, { transform: 'rotate(360deg) scale(1)' }],
        { duration: 600, easing: 'cubic-bezier(.3,1.3,.5,1)' });
      var r = el.getBoundingClientRect(), couleurs = el.dataset.couleurs ? el.dataset.couleurs.split(',') : COULEURS_FETE;
      NX.particules(gerbe(r.left + r.width / 2, r.top + 4, opt(el, 'nombre', 38), {
        angle: -90, ouverture: 100, vmin: 380, vmax: 720, g: 1150, air: 1.7, viemin: 1.4, viemax: 2.3,
        tmin: 3, tmax: 5, couleurs: couleurs, forme: ['ruban', 'ruban', 'carre'], dx: r.width * .25
      }));
    });
  });

  /* ---------- cendres : braise puis cendres qui s'empilent sur le bouton ---------- */
  var COULEURS_CENDRE = ['#1c1a19', '#2e2b29', '#46423f', '#5f5a56', '#7d7772', '#a39d97', '#c2410c', '#f97a1f'];
  var BRAISES = ['#c2410c', '#f97a1f'];
  NX.def('cendres', function (el) {
    label(el);
    el.insertAdjacentHTML('afterbegin', ICO.flamme);
    el.firstChild.setAttribute('class', 'nx-ce-flamme');
    var tBraise = 0;
    el.addEventListener('click', function () {
      el.classList.add('braise');
      clearTimeout(tBraise);
      tBraise = setTimeout(function () { el.classList.remove('braise'); }, 500);
      emit(el, 'confirm');
      if (calme()) return;
      var r = el.getBoundingClientRect(), n = opt(el, 'nombre', 70), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var ps = [];
      for (var i = 0; i < n; i++) {
        var pluie = Math.random() < .3, c = choix(COULEURS_CENDRE), ang = -90 * D2R + (Math.random() * 2 - 1) * 60 * D2R, v = hasard(160, 520);
        ps.push({
          x: pluie ? hasard(r.left + 4, r.right - 4) : cx + hasard(-r.width * .2, r.width * .2),
          y: pluie ? r.top - hasard(10, 40) : cy + hasard(-r.height * .15, r.height * .15),
          vx: pluie ? hasard(-50, 50) : Math.cos(ang) * v + hasard(-60, 60),
          vy: pluie ? hasard(20, 90) : Math.sin(ang) * v - hasard(80, 260),
          g: 900, air: .9, rebond: .25, vie: hasard(3.2, 5.2),
          taille: hasard(1.2, 2.8), couleur: c, forme: choix(['rond', 'carre', 'eclat']),
          lueur: BRAISES.indexOf(c) >= 0
        });
      }
      NX.particules(ps, [el]);
    });
  });

  /* ---------- invocation : maintenir, cornes qui montent, feu, rugissement ---------- */
  var nCorne = 0;
  function svgCornes() {
    var id = 'nxco' + (++nCorne);
    var stries = [['M11.5 26 Q16 24.5 22 27'], ['M9.5 19 Q13 17.5 17.5 20.5'], ['M7 12.5 Q9.5 11.5 12.5 14']];
    var d = '';
    stries.forEach(function (s) {
      d += '<path d="' + s[0] + '"/>';
      d += '<path d="' + s[0].replace(/(\d+(?:\.\d+)?) (\d+(?:\.\d+)?)/g, function (m, x, y) { return (100 - parseFloat(x)) + ' ' + y; }) + '"/>';
    });
    return '<svg viewBox="0 0 100 34" aria-hidden="true"><defs><linearGradient id="' + id + '" x1="0" y1="1" x2="0" y2="0">' +
      '<stop offset="0" stop-color="#1a0705"/><stop offset=".6" stop-color="#521a0e"/><stop offset=".88" stop-color="#a8461f"/><stop offset="1" stop-color="#f0a35e"/></linearGradient></defs>' +
      '<g stroke="rgba(10,2,1,.7)" stroke-width=".8">' +
      '<path fill="url(#' + id + ')" d="M13 34 C12 24 8 14 2 3 C11 9 22 19 27 34 Z"/>' +
      '<path fill="url(#' + id + ')" d="M87 34 C88 24 92 14 98 3 C89 9 78 19 73 34 Z"/></g>' +
      '<g fill="none" stroke="rgba(30,8,4,.6)" stroke-width=".9" stroke-linecap="round">' + d + '</g></svg>';
  }

  NX.def('invocation', function (el) {
    var l = label(el);
    var face = cache(h('span', 'nx-in-face')), zone = cache(h('span', 'nx-in-cornes', svgCornes())), cv = cache(h('canvas'));
    el.insertBefore(cv, l); el.insertBefore(zone, l); el.insertBefore(face, l);
    var duree = opt(el, 'duree', 1800), texte = l.innerHTML, succes = el.dataset.succes || 'Invoqué';
    var ctx = cv.getContext('2d'), p = 0, tenu = false, fini = false, raf = 0, last = 0, flammes = [], W = 0, H = 0;

    function taille() {
      var r = cv.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      cv.width = Math.max(1, Math.round(W * d)); cv.height = Math.max(1, Math.round(H * d));
      ctx.setTransform(d, 0, 0, d, 0, 0);
    }
    function flamme(fort) {
      var bw = el.offsetWidth, haut = H - el.offsetHeight;
      return {
        x: 30 + Math.random() * bw, y: haut + hasard(2, 8),
        vx: (Math.random() - .5) * (fort ? 160 : 30),
        vy: -hasard(50, 140) * (.6 + p) * (fort ? 2.2 : 1),
        r: hasard(5, 12) * (.6 + p) * (fort ? 1.5 : 1), age: 0, vie: hasard(.45, .9)
      };
    }
    function pas(t) {
      var dt = last ? Math.min((t - last) / 1000, 1 / 30) : 1 / 60;
      last = t;
      if (!fini) p = tenu ? Math.min(1, p + dt * 1000 / duree) : Math.max(0, p - dt * 1000 / duree * 2.2);
      el.style.setProperty('--nx-p', p.toFixed(3));
      if (p >= 1 && tenu && !fini) rugir();
      if (!calme() && p > 0) {
        var n = p * p * 3.6 + .35;
        while (n > 0) { if (Math.random() < n) flammes.push(flamme(false)); n--; }
      }
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (var i = flammes.length - 1; i >= 0; i--) {
        var f = flammes[i];
        f.age += dt;
        if (f.age >= f.vie) { flammes.splice(i, 1); continue; }
        var k = f.age / f.vie;
        f.vx += Math.sin(t / 90 + i) * 12 * dt;
        f.x += f.vx * dt; f.y += f.vy * dt;
        ctx.globalAlpha = (1 - k) * .55;
        ctx.fillStyle = k < .2 ? '#fff2c0' : k < .45 ? '#ffb238' : k < .75 ? '#ff5a1f' : '#a01a08';
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 - k * .6), 0, 6.2832); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      if (p > 0 || flammes.length || tenu) raf = requestAnimationFrame(pas);
      else { raf = 0; last = 0; ctx.clearRect(0, 0, W, H); }
    }
    function demarrer() { if (!raf) { taille(); raf = requestAnimationFrame(pas); } }
    function rugir() {
      fini = true;
      el.classList.add('rugit');
      el.style.minWidth = el.offsetWidth + 'px'; // garde la taille : les cornes restent entières
      l.innerHTML = succes;
      if (!calme()) for (var k = 0; k < 90; k++) flammes.push(flamme(true));
      emit(el, 'confirm');
      setTimeout(function () { el.classList.remove('rugit'); }, 520);
      setTimeout(function () { fini = false; tenu = false; l.innerHTML = texte; el.style.minWidth = ''; demarrer(); }, 1600);
    }
    surMaintien(el, function () {
      if (el.disabled || fini) return;
      tenu = true; demarrer();
    }, function () {
      if (!tenu) return;
      tenu = false;
      if (!fini && p < 1) emit(el, 'abort', { progression: p });
      demarrer();
    });
  });

  /* ---------- bloc : pierre pixel, fissures, éclats, objet à ramasser ---------- */
  var texturePierre = null;
  function genererTexture() {
    if (texturePierre) return texturePierre;
    var c = document.createElement('canvas'); c.width = c.height = 16;
    var x = c.getContext('2d'), rnd = graine(1337), gris = ['#6b6b6b', '#747474', '#7d7d7d', '#868686', '#8f8f8f', '#5f5f5f'];
    for (var j = 0; j < 16; j++) for (var i = 0; i < 16; i++) {
      var v = rnd();
      x.fillStyle = v < .08 ? '#545454' : v > .93 ? '#9a9a9a' : gris[(rnd() * gris.length) | 0];
      x.fillRect(i, j, 1, 1);
    }
    for (var k = 0; k < 7; k++) { // taches sombres
      var px = (rnd() * 15) | 0, py = (rnd() * 15) | 0;
      x.fillStyle = '#5a5a5a'; x.fillRect(px, py, 2, 1); x.fillRect(px + 1, py + 1, 1, 1);
    }
    texturePierre = c.toDataURL();
    return texturePierre;
  }
  function genererFissures(w, hh, seed) {
    var rnd = graine(seed), marcheurs = [], pts = [], vu = {};
    for (var m = 0; m < 4; m++) {
      marcheurs.push({ x: w * hasardG(rnd, .3, .7), y: hh * hasardG(rnd, .25, .75), a: rnd() * 6.2832 });
    }
    for (var s = 0; s < Math.max(w, hh) * .7; s++) {
      marcheurs.forEach(function (mw) {
        mw.a += (rnd() - .5) * 1.1;
        mw.x = borne(mw.x + Math.cos(mw.a), 1, w - 2);
        mw.y = borne(mw.y + Math.sin(mw.a) * .8, 1, hh - 2);
        var cle = (mw.x | 0) + ',' + (mw.y | 0);
        if (!vu[cle]) { vu[cle] = 1; pts.push([mw.x | 0, mw.y | 0]); }
      });
    }
    return pts;
  }
  function hasardG(rnd, a, b) { return a + rnd() * (b - a); }

  NX.def('bloc', function (el) {
    var socle = h('span', 'nx-bloc-socle');
    el.parentNode.insertBefore(socle, el);
    socle.appendChild(el);
    label(el);
    var tex = genererTexture();
    el.style.backgroundImage = 'url(' + tex + ')';
    var cv = cache(h('canvas', 'nx-bl-fissures'));
    el.insertBefore(cv, el.firstChild);
    var coups = Math.max(1, opt(el, 'coups', 3)), n = 0, stade = 0, fissures = null, seed = (Math.random() * 1e9) | 0;
    var CHIPS = ['#4a4a4a', '#5c5c5c', '#6e6e6e', '#828282', '#969696'];

    function preparer() {
      cv.width = Math.max(1, Math.ceil(el.offsetWidth / 2));
      cv.height = Math.max(1, Math.ceil(el.offsetHeight / 2));
      fissures = genererFissures(cv.width, cv.height, seed);
    }
    function dessiner() {
      var c = cv.getContext('2d');
      c.clearRect(0, 0, cv.width, cv.height);
      if (!fissures) return;
      var nb = Math.floor(fissures.length * stade / 3);
      c.fillStyle = 'rgba(18,18,18,.85)';
      for (var i = 0; i < nb; i++) c.fillRect(fissures[i][0], fissures[i][1], 1, 1);
    }
    function eclats(nb, partout) {
      var r = el.getBoundingClientRect();
      NX.particules(gerbe(r.left + r.width / 2, r.top + r.height / 2, nb, {
        angle: -90, ouverture: partout ? 360 : 140, vmin: partout ? 150 : 90, vmax: partout ? 520 : 240,
        g: 1500, air: .6, viemin: .7, viemax: 1.4, tmin: 1.5, tmax: partout ? 3.5 : 2,
        couleurs: CHIPS, forme: 'carre', fixe: true, dx: partout ? r.width * .4 : r.width * .25, dy: r.height * .3
      }));
    }
    function briser() {
      el.classList.add('brise');
      eclats(40, true);
      emit(el, 'explosion');
      var objet = h('button', 'nx-bloc-objet');
      objet.type = 'button';
      objet.setAttribute('aria-label', el.dataset.ramasser || 'Ramasser le bloc');
      objet.style.backgroundImage = 'url(' + tex + ')';
      socle.appendChild(objet);
      var focus = document.activeElement === el;
      if (focus) objet.focus();
      objet.addEventListener('click', function () {
        objet.style.animation = 'none';
        objet.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(-14px) scale(1.5)', opacity: 0 }],
          { duration: 200, easing: 'ease-in' }).onfinish = function () {
          objet.remove();
          n = 0; stade = 0; seed = (Math.random() * 1e9) | 0; fissures = null; dessiner();
          el.classList.remove('brise', 'revient');
          void el.offsetWidth;
          el.classList.add('revient');
          if (focus || document.activeElement === document.body) el.focus();
          emit(el, 'ramasse');
        };
      });
    }
    el.addEventListener('click', function () {
      if (el.classList.contains('brise')) return;
      n++;
      if (!calme()) {
        eclats(3, false);
        el.animate([{ transform: 'none' }, { transform: 'translate(1px,1px)' }, { transform: 'translate(-1px,0)' }, { transform: 'none' }], { duration: 120 });
      }
      if (n % coups === 0) {
        if (stade >= 3) { briser(); return; }
        stade++;
        if (!fissures) preparer();
        dessiner();
      }
    });
  });

  /* ---------- propulseur : vole jusqu'au curseur dans sa piste ---------- */
  NX.def('propulseur', function (el) {
    var piste = el.parentElement;
    piste.classList.add('nx-piste');
    label(el);
    var cv = cache(h('canvas', 'nx-pr-fumee'));
    piste.insertBefore(cv, piste.firstChild);
    ['b1', 'b2', 'g', 'd'].forEach(function (n) { el.appendChild(cache(h('span', 'nx-pr-buse ' + n))); });

    var poussee = opt(el, 'poussee', 2600), incl = opt(el, 'inclinaison', 10);
    var K = 55, C = 2 * .62 * Math.sqrt(K), G = 1000;
    var pos = { x: 0, y: 0 }, vit = { x: 0, y: 0 }, cib = { x: 0, y: 0 };
    var mode = 'pose', raf = 0, last = 0, ctx = cv.getContext('2d'), fumee = [], W = 0, H = 0, teinte = '#888';

    function mesure() {
      W = piste.clientWidth; H = piste.clientHeight;
      var d = Math.min(window.devicePixelRatio || 1, 1.5);
      cv.width = Math.max(1, Math.round(W * d)); cv.height = Math.max(1, Math.round(H * d));
      ctx.setTransform(d, 0, 0, d, 0, 0);
    }
    function limites() {
      return { mx: Math.max(0, W / 2 - el.offsetWidth / 2 - 10), my: Math.min(0, -(H - el.offsetHeight - 20)) };
    }
    function placer(rot) {
      el.style.transform = 'translate(calc(-50% + ' + pos.x.toFixed(1) + 'px),' + pos.y.toFixed(1) + 'px) rotate(' + (rot || 0).toFixed(2) + 'deg)';
    }
    function emettre(x, y, dx, dy, pw) {
      var n = pw * 2.4;
      while (n > 0) {
        if (Math.random() < n) fumee.push({
          x: x, y: y, vx: dx * hasard(140, 260) + hasard(-25, 25), vy: dy * hasard(140, 260) + hasard(-25, 25),
          r: hasard(2.5, 5), age: 0, vie: hasard(.8, 1.6)
        });
        n--;
      }
    }
    function pas(t) {
      var dt = last ? Math.min((t - last) / 1000, 1 / 30) : 1 / 60;
      last = t;
      var lim = limites(), ax = 0, ay = 0;
      if (mode !== 'pose') {
        ax = K * (cib.x - pos.x) - C * vit.x;
        ay = K * (cib.y - pos.y) - C * vit.y;
        var m = Math.hypot(ax, ay);
        if (m > poussee) { ax *= poussee / m; ay *= poussee / m; }
        vit.x += ax * dt; vit.y += ay * dt;
        pos.x += vit.x * dt; pos.y += vit.y * dt;
        if (Math.abs(pos.x) > lim.mx) { pos.x = Math.sign(pos.x) * lim.mx; vit.x *= -.3; }
        if (pos.y < lim.my) { pos.y = lim.my; vit.y *= -.3; }
        if (pos.y > 0) { pos.y = 0; vit.y *= -.15; vit.x *= .8; }
        if (mode === 'atterrit' && pos.y > -.6 && Math.hypot(vit.x, vit.y) < 6) {
          mode = 'pose'; pos.y = 0; vit.x = vit.y = 0; ax = ay = 0;
        }
      }
      // poussée des buses = accélération voulue moins la gravité (y vers le bas)
      var jy = mode === 'pose' ? 0 : ay - G;
      var pg = ax > 0 ? Math.min(1, ax / poussee) : 0, pd = ax < 0 ? Math.min(1, -ax / poussee) : 0;
      var pb = jy < 0 ? Math.min(1, -jy / (poussee + G)) : 0;
      el.style.setProperty('--jg', pg.toFixed(2));
      el.style.setProperty('--jd', pd.toFixed(2));
      el.style.setProperty('--jb', pb.toFixed(2));
      placer(borne(ax / poussee, -1, 1) * incl);

      var w = el.offsetWidth, hh = el.offsetHeight, cx = W / 2 + pos.x, cy = H - 6 - hh / 2 + pos.y;
      if (pb > .03) { emettre(cx - w / 2 + 15, cy + hh / 2 + 4, 0, 1, pb); emettre(cx + w / 2 - 15, cy + hh / 2 + 4, 0, 1, pb); }
      if (pg > .03) emettre(cx - w / 2 - 8, cy, -1, 0, pg);
      if (pd > .03) emettre(cx + w / 2 + 8, cy, 1, 0, pd);

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = teinte;
      for (var i = fumee.length - 1; i >= 0; i--) {
        var f = fumee[i];
        f.age += dt;
        if (f.age > f.vie) { fumee.splice(i, 1); continue; }
        var fr = Math.max(0, 1 - 2.4 * dt);
        f.vx *= fr; f.vy *= fr; f.vy -= 14 * dt;
        f.x += f.vx * dt; f.y += f.vy * dt;
        if (f.y > H - 3) { f.y = H - 3; f.vy *= -.2; f.vx *= 1.04; }
        f.r += dt * 14;
        var a = 1 - f.age / f.vie;
        ctx.globalAlpha = a * a * .55;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.2832); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (mode === 'pose' && !fumee.length) { raf = 0; last = 0; return; }
      raf = requestAnimationFrame(pas);
    }
    function allumer() {
      if (raf) return;
      mesure();
      teinte = getComputedStyle(cv).color;
      raf = requestAnimationFrame(pas);
    }
    function atterrir() {
      if (mode !== 'vol') return;
      mode = 'atterrit'; cib.x = pos.x; cib.y = 0; allumer();
    }
    function suivre(e) {
      if (calme() || el.disabled) return;
      var r = piste.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
      if (px < 0 || py < 0 || px > r.width || py > r.height) { atterrir(); return; }
      if (!W) mesure();
      var lim = limites(), hh = el.offsetHeight;
      cib.x = borne(px - W / 2, -lim.mx, lim.mx);
      cib.y = borne(py - (H - 6 - hh / 2), lim.my, 0);
      mode = 'vol';
      allumer();
    }
    addEventListener('pointermove', suivre, { passive: true });
    addEventListener('pointerdown', suivre, { passive: true });
    addEventListener('pointerup', function (e) { if (e.pointerType === 'touch') atterrir(); });
    document.documentElement.addEventListener('pointerleave', atterrir);
    addEventListener('blur', atterrir);
    if ('ResizeObserver' in window) new ResizeObserver(function () {
      mesure();
      var lim = limites();
      if (Math.abs(pos.x) > lim.mx) { pos.x = Math.sign(pos.x) * lim.mx; placer(0); }
    }).observe(piste);
    placer(0);
  });

  /* ==========================================================================
     INTERACTION
     ========================================================================== */

  /* ---------- aimant : corps et texte attirés par le curseur ---------- */
  NX.def('aimant', function (el) {
    var l = label(el), corps = cache(h('span', 'nx-ai-corps'));
    el.insertBefore(corps, l);
    var champ = opt(el, 'champ', 90), force = opt(el, 'force', .4);
    var cles = ['x', 'y', 'lx', 'ly', 'rx', 'ry'], cur = {}, cib = {}, raf = 0;
    cles.forEach(function (c) { cur[c] = 0; cib[c] = 0; });
    function boucle() {
      var bouge = false;
      cles.forEach(function (c) { cur[c] += (cib[c] - cur[c]) * .16; if (Math.abs(cib[c] - cur[c]) > .05) bouge = true; });
      corps.style.transform = 'translate3d(' + cur.x.toFixed(2) + 'px,' + cur.y.toFixed(2) + 'px,0) rotateX(' + cur.rx.toFixed(2) + 'deg) rotateY(' + cur.ry.toFixed(2) + 'deg)';
      l.style.transform = 'translate3d(' + cur.lx.toFixed(2) + 'px,' + cur.ly.toFixed(2) + 'px,0)';
      raf = bouge ? requestAnimationFrame(boucle) : 0;
    }
    function relancer() { if (!raf) raf = requestAnimationFrame(boucle); }
    function zero() { cles.forEach(function (c) { cib[c] = 0; }); relancer(); }
    addEventListener('pointermove', function (e) {
      if (calme()) return;
      var r = el.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      var dedans = e.clientX > r.left - champ && e.clientX < r.right + champ && e.clientY > r.top - champ && e.clientY < r.bottom + champ;
      if (!dedans) { if (cib.x || cib.y) zero(); return; }
      cib.x = dx * force; cib.y = dy * force;
      cib.lx = dx * force * 1.5; cib.ly = dy * force * 1.5;
      cib.ry = borne(dx / r.width * 14, -18, 18);
      cib.rx = borne(-dy / r.height * 14, -18, 18);
      relancer();
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', zero);
  });

  /* ---------- fuyard : esquive le curseur jusqu'à épuisement ---------- */
  NX.def('fuyard', function (el) {
    var l = label(el), jauge = cache(h('span', 'nx-fu-jauge', '<i></i>'));
    el.appendChild(jauge);
    var max = Math.max(1, opt(el, 'endurance', 6)), rayon = opt(el, 'rayon', 36);
    var endu = max, tx = 0, ty = 0, bloquer = false, pause = false, texte = l.innerHTML;
    var abandon = el.dataset.abandon || 'Bon… vas-y.';

    function zone() {
      var z = el.dataset.zone ? document.querySelector(el.dataset.zone) : el.parentElement;
      return (z || document.documentElement).getBoundingClientRect();
    }
    function fuir(px, py) {
      var r = el.getBoundingClientRect(), z = zone();
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2, ox = cx - tx, oy = cy - ty;
      var ang = Math.atan2(cy - py, cx - px) + (Math.random() - .5) * 1.4, saut = hasard(70, 130);
      var minX = z.left + r.width / 2 + 4 - ox, maxX = z.right - r.width / 2 - 4 - ox;
      var minY = z.top + r.height / 2 + 4 - oy, maxY = z.bottom - r.height / 2 - 4 - oy;
      var nx = tx + Math.cos(ang) * saut, ny = ty + Math.sin(ang) * saut;
      if (nx < minX || nx > maxX) nx = tx - Math.cos(ang) * saut;
      if (ny < minY || ny > maxY) ny = ty - Math.sin(ang) * saut;
      tx = borne(nx, Math.min(minX, maxX), Math.max(minX, maxX));
      ty = borne(ny, Math.min(minY, maxY), Math.max(minY, maxY));
      el.style.translate = tx.toFixed(1) + 'px ' + ty.toFixed(1) + 'px';
      endu--;
      el.style.setProperty('--nx-endu', endu / max);
      if (endu <= 0) { el.classList.add('epuise'); l.textContent = abandon; emit(el, 'epuise'); }
      pause = true;
      setTimeout(function () { pause = false; }, 260);
    }
    function reinit() {
      endu = max; tx = ty = 0;
      el.classList.remove('epuise');
      l.innerHTML = texte;
      el.style.translate = '0px 0px';
      el.style.setProperty('--nx-endu', 1);
    }
    addEventListener('pointermove', function (e) {
      if (endu <= 0 || pause || e.pointerType === 'touch' || calme()) return;
      var r = el.getBoundingClientRect();
      var dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right), dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom);
      if (Math.hypot(dx, dy) < rayon) fuir(e.clientX, e.clientY);
    }, { passive: true });
    el.addEventListener('pointerdown', function (e) {
      if (endu > 0 && !calme()) { e.preventDefault(); bloquer = true; fuir(e.clientX, e.clientY); }
    });
    el.addEventListener('click', function (e) {
      if (bloquer) { bloquer = false; e.preventDefault(); e.stopImmediatePropagation(); return; }
      if (endu <= 0) setTimeout(reinit, 2200);
    }, true);
    return { reinit: reinit };
  });

  /* ---------- secret : valeur masquée, révélée au maintien ou en bascule ---------- */
  NX.def('secret', function (el) {
    var secret = el.dataset.secret || '', mode = el.dataset.mode || 'maintien', delai = opt(el, 'delai', 0);
    var nom = (el.textContent || '').trim() || 'Secret';
    el.innerHTML = '<svg class="nx-se-oeil" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">' +
      '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.8"/><path class="nx-se-barre" d="M3.5 3.5l17 17"/></svg>' +
      '<span class="nx-se-zone" aria-hidden="true"><span class="nx-se-masque"></span><span class="nx-se-valeur"></span></span>';
    var masque = el.querySelector('.nx-se-masque'), val = el.querySelector('.nx-se-valeur');
    masque.textContent = secret.replace(/\S/g, '•');
    secret.split('').forEach(function (c, i) { var s = document.createElement('i'); s.textContent = c; s.style.setProperty('--i', i); val.appendChild(s); });
    var ouvert = false, t = 0;
    function etat(o, silence) {
      ouvert = o;
      el.classList.toggle('ouvert', o);
      if (mode === 'bascule') el.setAttribute('aria-pressed', String(o));
      el.setAttribute('aria-label', nom + (o ? ' : ' + secret : ' (masqué)'));
      clearTimeout(t);
      if (o && delai && mode === 'bascule') t = setTimeout(function () { etat(false); }, delai);
      if (!silence) emit(el, 'change', { ouvert: o });
    }
    etat(false, true);
    if (mode === 'bascule') el.addEventListener('click', function () { etat(!ouvert); });
    else surMaintien(el, function () { if (!ouvert) etat(true); }, function () { if (ouvert) etat(false); });
  });

  /* ---------- interrupteur : poussoir à verrouillage avec témoin ---------- */
  NX.def('interrupteur', function (el) {
    var cap = h('span', 'nx-it-cap'), led = cache(h('span', 'nx-it-led'));
    while (el.firstChild) cap.appendChild(el.firstChild);
    cap.insertBefore(led, cap.firstChild);
    el.appendChild(cap);
    var actif = el.hasAttribute('data-actif');
    el.setAttribute('aria-pressed', String(actif));
    el.addEventListener('click', function () {
      actif = !actif;
      el.setAttribute('aria-pressed', String(actif));
      emit(el, 'change', { actif: actif });
    });
  });

  /* ==========================================================================
     CONFIRMATION & UTILITAIRE
     ========================================================================== */

  /* ---------- maintien : remplissage, secousse si relâché trop tôt ---------- */
  NX.def('maintien', function (el) {
    var l = label(el), voile = cache(h('span', 'nx-ma-voile'));
    el.appendChild(voile);
    var duree = opt(el, 'duree', 1500), reset = opt(el, 'reset', 1400);
    var repos = l.innerHTML, pendant = el.dataset.pendant || 'Continue…', succes = el.dataset.succes || 'Fait';
    var etat = 'repos', t0 = 0, raf = 0, p = 0, tReset = 0;
    el.setAttribute('aria-live', 'polite');
    function texte(html) { l.innerHTML = html; voile.innerHTML = html; }
    function setP(v, anim) { p = v; el.classList.toggle('retour', !!anim); el.style.setProperty('--nx-p', v); }
    function boucle(t) {
      var v = Math.min((t - t0) / duree, 1);
      setP(v, false);
      if (v >= 1) { fin(); return; }
      raf = requestAnimationFrame(boucle);
    }
    function debut() {
      if (el.disabled || etat !== 'repos') return;
      clearTimeout(tReset);
      etat = 'tenu'; el.dataset.etat = etat;
      texte(pendant);
      t0 = performance.now();
      raf = requestAnimationFrame(boucle);
    }
    function annule() {
      if (etat !== 'tenu') return;
      cancelAnimationFrame(raf);
      var atteint = p;
      etat = 'repos'; el.dataset.etat = etat;
      texte(repos); setP(0, true); secoue(el);
      emit(el, 'abort', { progression: atteint });
    }
    function fin() {
      cancelAnimationFrame(raf);
      etat = 'succes'; el.dataset.etat = etat;
      texte(ICO.ok + '<span>' + succes + '</span>');
      setP(1, false);
      emit(el, 'confirm');
      if (reset > 0) tReset = setTimeout(function () {
        etat = 'repos'; el.dataset.etat = etat; texte(repos); setP(0, true);
      }, reset);
    }
    texte(repos);
    surMaintien(el, debut, annule);
  });

  /* ---------- doute : étapes de confirmation de plus en plus absurdes ---------- */
  var ETAPES = ['Supprimer', 'Tu es sûr ?', 'Vraiment sûr ?', 'Ça ne se rattrape pas', 'Et les sauvegardes ?',
                'Même le stagiaire hésiterait', 'Dernière chance…', 'Bon. Tu l’as voulu.'];
  NX.def('doute', function (el) {
    var l = label(el), base = l.textContent.trim();
    var etapes = el.dataset.etapes ? el.dataset.etapes.split('|') : ETAPES.slice();
    if (!el.dataset.etapes && base) etapes[0] = base;
    var fin = el.dataset.fin || 'Supprimé.', oubli = opt(el, 'oubli', 5000), i = 0, tOubli = 0, verrou = false;
    function ajuster() {
      var avant = el.getBoundingClientRect().width;
      el.style.width = '';
      var apres = el.getBoundingClientRect().width;
      el.style.width = avant + 'px';
      void el.offsetWidth;
      el.style.width = apres + 'px';
    }
    function changer(txt) {
      if (calme()) { l.textContent = txt; ajuster(); return; }
      l.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(-70%)', opacity: 0 }], { duration: 110, easing: 'ease-in' })
        .onfinish = function () {
          l.textContent = txt; ajuster();
          l.animate([{ transform: 'translateY(70%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 240, easing: 'cubic-bezier(.2,1.4,.4,1)' });
        };
    }
    function niveau() {
      el.style.setProperty('--nx-d', (i / (etapes.length - 1)).toFixed(2));
      if (i) el.dataset.niveau = i; else delete el.dataset.niveau;
    }
    function remise() { i = 0; niveau(); changer(etapes[0]); }
    el.addEventListener('click', function () {
      if (verrou) return;
      clearTimeout(tOubli);
      if (i < etapes.length - 1) {
        i++; niveau(); changer(etapes[i]);
        tOubli = setTimeout(remise, oubli);
      } else {
        verrou = true;
        delete el.dataset.niveau;
        changer(fin);
        emit(el, 'confirm');
        setTimeout(function () { verrou = false; remise(); }, 1600);
      }
    });
  });

  /* ---------- meche : glisser la poignée le long de la mèche ---------- */
  var ETINCELLES = ['#fff3b0', '#ffd27a', '#ffb02e', '#ff7a1a', '#ff4d12'];
  NX.def('meche', function (el) {
    var texte = (el.textContent || '').trim() || 'Glisser pour faire sauter';
    el.innerHTML = '<span class="nx-me-fil" aria-hidden="true"></span><span class="nx-me-brule" aria-hidden="true"></span>' +
      '<span class="nx-me-txt" aria-hidden="true"><span></span></span><span class="nx-me-poignee" aria-hidden="true">' + ICO.flamme + '</span>';
    var poignee = el.querySelector('.nx-me-poignee'), txt = el.querySelector('.nx-me-txt span');
    txt.textContent = texte;
    el.setAttribute('role', 'slider');
    el.setAttribute('aria-label', texte);
    el.setAttribute('aria-valuemin', '0');
    el.setAttribute('aria-valuemax', '100');
    if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
    var p = 0, glisse = false, x0 = 0, p0 = 0, fini = false;
    function course() { return Math.max(1, el.clientWidth - 48); }
    function setP(v, retour) {
      p = borne(v, 0, 1);
      el.classList.toggle('retour', !!retour);
      el.style.setProperty('--nx-p', p);
      poignee.style.translate = (p * course()).toFixed(1) + 'px 0';
      el.setAttribute('aria-valuenow', Math.round(p * 100));
    }
    function exploser() {
      fini = true; glisse = false;
      setP(1);
      el.classList.add('boum');
      secoue(el);
      txt.textContent = el.dataset.succes || 'Boum.';
      var r = poignee.getBoundingClientRect();
      NX.particules(gerbe(r.left + r.width / 2, r.top + r.height / 2, 44, {
        ouverture: 360, vmin: 180, vmax: 620, g: 900, air: 2.4, viemin: .4, viemax: .95,
        tmin: 1.2, tmax: 2.6, couleurs: ETINCELLES, forme: ['carre', 'rond'], lueur: function () { return true; }
      }));
      emit(el, 'confirm');
      setTimeout(function () { el.classList.remove('boum'); txt.textContent = texte; setP(0, true); fini = false; }, 1800);
    }
    poignee.addEventListener('pointerdown', function (e) {
      if (fini) return;
      e.preventDefault();
      glisse = true; x0 = e.clientX; p0 = p;
      try { poignee.setPointerCapture(e.pointerId); } catch (_) {}
      el.classList.remove('retour');
    });
    poignee.addEventListener('pointermove', function (e) {
      if (!glisse) return;
      setP(p0 + (e.clientX - x0) / course());
      if (p >= .985) exploser();
    });
    ['pointerup', 'pointercancel'].forEach(function (n) {
      poignee.addEventListener(n, function () {
        if (!glisse) return;
        glisse = false;
        if (!fini) { if (p > .02) emit(el, 'abort', { progression: p }); setP(0, true); }
      });
    });
    el.addEventListener('keydown', function (e) {
      if (fini) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); setP(p + .1); if (p >= .985) exploser(); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); setP(p - .1); }
      else if (e.key === 'Home' || e.key === 'Escape') { e.preventDefault(); setP(0, true); }
    });
    el.addEventListener('blur', function () { if (!fini && p > 0) setP(0, true); });
    setP(0);
  });

  /* ---------- recharge : verrou à minuterie radiale après chaque clic ---------- */
  var RAILLERIES = ['Doucement.', 'Patience…', 'Respire.', 'Toujours non.', 'Tu insistes ?', 'Presque.'];
  NX.def('recharge', function (el) {
    var l = label(el), base = l.innerHTML, duree = opt(el, 'duree', 3000);
    var rails = el.dataset.railleries ? el.dataset.railleries.split('|') : RAILLERIES, ri = 0, fin = 0, raf = 0, bloque = false;
    el.insertAdjacentHTML('afterbegin', '<svg class="nx-rc-jauge" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">' +
      '<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-opacity=".25" stroke-width="2"/>' +
      '<circle class="nx-rc-arc" cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="37.7" stroke-dashoffset="0" stroke-linecap="round" transform="rotate(-90 8 8)"/></svg>');
    var arc = el.querySelector('.nx-rc-arc'), sec = cache(h('span', 'nx-rc-sec'));
    el.appendChild(sec);
    function boucle() {
      var reste = Math.max(0, fin - performance.now()), r = reste / duree;
      el.style.setProperty('--nx-r', r.toFixed(4));
      arc.style.strokeDashoffset = (37.7 * (1 - r)).toFixed(2);
      sec.textContent = (reste / 1000).toFixed(1).replace('.', ',') + ' s';
      if (reste <= 0) { liberer(); return; }
      raf = requestAnimationFrame(boucle);
    }
    function verrouiller() {
      bloque = true; fin = performance.now() + duree;
      el.classList.add('bloque');
      el.setAttribute('aria-disabled', 'true');
      l.textContent = el.dataset.attente || 'Recharge';
      raf = requestAnimationFrame(boucle);
    }
    function liberer() {
      bloque = false;
      el.classList.remove('bloque');
      el.removeAttribute('aria-disabled');
      l.innerHTML = base; sec.textContent = '';
      el.style.setProperty('--nx-r', 0);
      arc.style.strokeDashoffset = '0';
      emit(el, 'pret');
    }
    el.addEventListener('click', function (e) {
      if (bloque) {
        e.preventDefault(); e.stopImmediatePropagation();
        l.textContent = rails[ri++ % rails.length];
        secoue(el);
        return;
      }
      setTimeout(verrouiller, 0);
    }, true);
  });

  /* ---------- etat : repos → chargement → succès / erreur, sans décalage ---------- */
  NX.def('etat', function (el) {
    var l = label(el), pile = h('span', 'nx-et-pile');
    var lab = {
      repos: l.innerHTML,
      chargement: ICO.spin + '<span>' + (el.dataset.chargement || 'Envoi…') + '</span>',
      succes: ICO.ok + '<span>' + (el.dataset.succes || 'Envoyé') + '</span>',
      erreur: ICO.croix + '<span>' + (el.dataset.erreur || 'Échec') + '</span>'
    };
    Object.keys(lab).forEach(function (k) {
      var s = h('span', k === 'repos' ? 'actif' : '', lab[k]);
      s.dataset.e = k;
      if (k !== 'repos') s.setAttribute('aria-hidden', 'true');
      pile.appendChild(s);
    });
    l.replaceWith(pile);
    el.setAttribute('aria-live', 'polite');
    el.dataset.etat = 'repos';
    var courant = 'repos';
    function etat(e) {
      if (!lab[e] || e === courant) return;
      var prec = pile.querySelector('.actif');
      if (prec) {
        prec.classList.remove('actif'); prec.classList.add('parti'); prec.setAttribute('aria-hidden', 'true');
        setTimeout(function () { prec.classList.remove('parti'); }, 400);
      }
      var suiv = pile.querySelector('[data-e="' + e + '"]');
      suiv.classList.add('actif'); suiv.removeAttribute('aria-hidden');
      courant = e;
      el.dataset.etat = e;
      el.setAttribute('aria-busy', String(e === 'chargement'));
      if (e === 'erreur') secoue(el);
      emit(el, 'etat', { etat: e });
    }
    if (el.hasAttribute('data-demo')) {
      el.addEventListener('click', function () {
        if (courant !== 'repos') return;
        etat('chargement');
        setTimeout(function () {
          etat(Math.random() < .75 ? 'succes' : 'erreur');
          setTimeout(function () { etat('repos'); }, 1600);
        }, 1300);
      });
    }
    return { etat: etat };
  });
  NX.etat = function (el, e) { var c = monter(el); if (c && c.etat) c.etat(e); };

  /* ---------- raccourci : raccourci clavier global, touches qui s'enfoncent ---------- */
  NX.def('raccourci', function (el) {
    var spec = el.dataset.touches || 'Mod+K';
    var mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
    var AFF = { control: mac ? '⌃' : 'Ctrl', meta: mac ? '⌘' : 'Win', shift: mac ? '⇧' : 'Maj', alt: mac ? '⌥' : 'Alt', ' ': 'Espace', enter: 'Entrée', escape: 'Échap' };
    var ARIA = { control: 'Control', meta: 'Meta', shift: 'Shift', alt: 'Alt', ' ': 'Space', enter: 'Enter', escape: 'Escape' };
    var touches = spec.split('+').map(function (t) {
      t = t.trim();
      var k = t.toLowerCase();
      if (k === 'mod') k = mac ? 'meta' : 'control';
      else if (k === 'ctrl') k = 'control';
      else if (k === 'cmd' || k === '⌘') k = 'meta';
      else if (k === 'option' || k === 'opt') k = 'alt';
      else if (k === 'maj') k = 'shift';
      else if (k === 'espace' || k === 'space') k = ' ';
      else if (k === 'entree' || k === 'entrée') k = 'enter';
      else if (k === 'echap' || k === 'échap' || k === 'esc') k = 'escape';
      return { k: k, aff: AFF[k] || t.toUpperCase() };
    });
    var avecModif = touches.some(function (t) { return /^(control|meta|alt)$/.test(t.k); });
    label(el);
    var boite = cache(h('span', 'nx-rc-touches'));
    touches.forEach(function (t) { t.el = h('kbd'); t.el.textContent = t.aff; boite.appendChild(t.el); });
    el.appendChild(boite);
    el.setAttribute('aria-keyshortcuts', touches.map(function (t) { return ARIA[t.k] || t.aff; }).join('+'));
    var bas = {};
    function nom(e) {
      var k = (e.key || '').toLowerCase();
      if (k === 'os') k = 'meta';
      if (e.altKey && mac && e.code && /^Key[A-Z]$/.test(e.code)) k = e.code.slice(3).toLowerCase();
      return k;
    }
    function maj() { touches.forEach(function (t) { t.el.classList.toggle('enfonce', !!bas[t.k]); }); }
    function saisie(t) { return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)); }
    addEventListener('keydown', function (e) {
      var k = nom(e);
      bas[k] = true;
      maj();
      if (!avecModif && saisie(e.target)) return;
      var complet = touches.every(function (t) { return bas[t.k]; }) && touches.some(function (t) { return t.k === k; });
      if (!complet) return;
      e.preventDefault();
      if (e.repeat || el.disabled) return;
      el.classList.remove('declenche'); void el.offsetWidth; el.classList.add('declenche');
      el.click();
      emit(el, 'raccourci', { touches: spec });
    });
    addEventListener('keyup', function (e) {
      delete bas[nom(e)];
      if (e.key === 'Meta') bas = {}; // macOS ne signale pas les relâchements sous ⌘
      maj();
    });
    addEventListener('blur', function () { bas = {}; maj(); });
    el.addEventListener('pointerdown', function () { touches.forEach(function (t) { t.el.classList.add('enfonce'); }); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (n) { el.addEventListener(n, maj); });
  });

  /* ---------- copier : bulle qui montre le texte copié ---------- */
  NX.def('copier', function (el) {
    var l = label(el), base = l.innerHTML, etats = h('span', 'nx-co-etats');
    etats.innerHTML =
      '<span data-e="repos" class="actif">' + ICO.copie + '<span>' + base + '</span></span>' +
      '<span data-e="ok" aria-hidden="true">' + ICO.ok + '<span>' + (el.dataset.ok || 'Copié') + '</span></span>' +
      '<span data-e="echec" aria-hidden="true">' + ICO.croix + '<span>' + (el.dataset.echec || 'Échec') + '</span></span>';
    l.replaceWith(etats);
    el.setAttribute('aria-live', 'polite');
    var t = 0;
    function montrer(e) {
      [].forEach.call(etats.children, function (s) {
        var a = s.dataset.e === e;
        s.classList.toggle('actif', a);
        if (a) s.removeAttribute('aria-hidden'); else s.setAttribute('aria-hidden', 'true');
      });
    }
    function texte() {
      if (el.dataset.copie != null) return el.dataset.copie;
      if (el.dataset.cible) {
        var c = document.querySelector(el.dataset.cible);
        if (c) return /^(INPUT|TEXTAREA)$/.test(c.tagName) ? c.value : c.textContent;
      }
      return etats.textContent;
    }
    function secours(txt) {
      var ta = document.createElement('textarea');
      ta.value = txt; ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;opacity:0';
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (_) {}
      ta.remove();
      return ok;
    }
    function bulle(txt) {
      var b = cache(h('span', 'nx-co-bulle'));
      b.textContent = txt.replace(/\s+/g, ' ').trim();
      el.appendChild(b);
      setTimeout(function () { b.remove(); }, 1600);
    }
    el.addEventListener('click', function () {
      var txt = texte();
      function fin(ok) {
        montrer(ok ? 'ok' : 'echec');
        if (ok) { bulle(txt); emit(el, 'copie', { texte: txt }); } else secoue(el);
        clearTimeout(t);
        t = setTimeout(function () { montrer('repos'); }, 1600);
      }
      try {
        navigator.clipboard.writeText(txt).then(function () { fin(true); }, function () { fin(secours(txt)); });
      } catch (_) { fin(secours(txt)); }
    });
  });

  /* ==========================================================================
     LOT 3 — OUTILS DES BOUTONS À ICÔNE
     ========================================================================== */
  var nUid = 0;
  function uid(p) { return 'nx' + p + (++nUid); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function txt(el) { return (el.textContent || '').replace(/\s+/g, ' ').trim(); }
  function SV(corps, cls) {
    return '<svg class="nx-ic ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + corps + '</svg>';
  }
  // étiquettes empilées dans une même case : la largeur est celle de la plus longue, aucun décalage
  function pile(etats, actif) {
    var s = '<span class="nx-pile" aria-hidden="true">';
    for (var k in etats) s += '<span data-e="' + k + '"' + (k === actif ? ' class="on"' : '') + '>' + etats[k] + '</span>';
    return s + '</span>';
  }
  function montrer(el, cle) {
    [].forEach.call(el.querySelectorAll('.nx-pile > span'), function (s) { s.classList.toggle('on', s.dataset.e === cle); });
  }
  function tic(el) { el.classList.remove('nx-tic'); void el.offsetWidth; el.classList.add('nx-tic'); }
  function copierTexte(t, fin) {
    function secours() {
      var ta = document.createElement('textarea');
      ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;opacity:0';
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (_) {}
      ta.remove();
      fin(ok);
    }
    try { navigator.clipboard.writeText(t).then(function () { fin(true); }, secours); } catch (_) { secours(); }
  }
  // compteur à rouleaux : un rouleau 0–9 par chiffre
  function compteur(span, n) {
    var s = String(Math.max(0, Math.round(n)));
    while (span.children.length < s.length) {
      var c = h('span', 'nx-cpt-col');
      c.innerHTML = '0123456789'.split('').map(function (d) { return '<span>' + d + '</span>'; }).join('');
      span.insertBefore(c, span.firstChild);
    }
    while (span.children.length > s.length) span.removeChild(span.firstChild);
    [].forEach.call(span.children, function (c, i) { c.style.transform = 'translateY(' + (-parseInt(s[i], 10) * 10) + '%)'; });
  }
  function etoileChemin(cx, cy, R, r) {
    var d = '';
    for (var k = 0; k < 10; k++) {
      var a = (-90 + k * 36) * D2R, rr = k % 2 ? r : R;
      d += (k ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(2) + ' ' + (cy + Math.sin(a) * rr).toFixed(2);
    }
    return d + 'Z';
  }
  function engrenage(cx, cy, R, r, dents) {
    var d = '', pas = 360 / dents;
    for (var k = 0; k < dents; k++) {
      var b = k * pas;
      [[b - pas * .5, r], [b - pas * .2, r], [b - pas * .12, R], [b + pas * .12, R], [b + pas * .2, r]].forEach(function (p, i) {
        var a = p[0] * D2R;
        d += (k === 0 && i === 0 ? 'M' : 'L') + (cx + Math.cos(a) * p[1]).toFixed(2) + ' ' + (cy + Math.sin(a) * p[1]).toFixed(2);
      });
    }
    return d + 'Z';
  }
  var COEUR = 'M12 20.3C6.4 16.4 3 13 3 9.4 3 6.9 5 5 7.4 5c1.9 0 3.5 1 4.6 2.6C13.1 6 14.7 5 16.6 5 19 5 21 6.9 21 9.4c0 3.6-3.4 7-9 10.9Z';
  var OEIL = '<path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>';
  var BARRE = '<path class="nx-barre nx-barre-fond" d="M4 4l16 16"/><path class="nx-barre" d="M4 4l16 16"/>';

  /* bascule à icône. cfg : { nom, icone, off, on, actif, attr ('aria-pressed' | 'aria-expanded'),
     etats (dictionnaire d'étiquettes supplémentaire), suffixe (html ajouté), apres(el, actif, silence), clic(el, actif, regler) } */
  function bascule(el, cfg) {
    var base = txt(el);
    var nom = el.getAttribute('aria-label') || base || cfg.nom;
    var off = el.dataset.texteOff || base || cfg.off, on = el.dataset.texteOn || base || cfg.on;
    var actif = el.hasAttribute('data-actif') ? el.dataset.actif !== 'false' : !!cfg.actif;
    var attr = cfg.attr || 'aria-pressed';
    var etats = { off: esc(off), on: esc(on) };
    if (cfg.etats) for (var k in cfg.etats) etats[k] = esc(cfg.etats[k]);
    el.classList.add('nx-icone');
    if (el.hasAttribute('data-seul')) el.classList.add('nx-seul');
    el.innerHTML = cfg.icone + pile(etats, actif ? 'on' : 'off') + (cfg.suffixe || '');
    el.setAttribute('aria-label', nom);
    function regler(v, silence) {
      actif = !!v;
      el.setAttribute(attr, String(actif));
      montrer(el, actif ? 'on' : 'off');
      if (cfg.apres) cfg.apres(el, actif, silence);
      if (!silence) { tic(el); emit(el, 'change', { actif: actif }); }
    }
    regler(actif, true);
    el.addEventListener('click', function () {
      if (el.disabled) return;
      if (cfg.clic) cfg.clic(el, actif, regler); else regler(!actif);
    });
    return { regler: regler, actif: function () { return actif; } };
  }

  /* ==========================================================================
     LOT 3 — BASCULES À ICÔNE
     ========================================================================== */
  NX.def('theme', function (el) {
    var m = uid('th'), rayons = '';
    for (var k = 0; k < 8; k++) {
      var a = k * 45 * D2R;
      rayons += '<line x1="' + (12 + Math.cos(a) * 8.1).toFixed(2) + '" y1="' + (12 + Math.sin(a) * 8.1).toFixed(2) +
        '" x2="' + (12 + Math.cos(a) * 10.2).toFixed(2) + '" y2="' + (12 + Math.sin(a) * 10.2).toFixed(2) + '"/>';
    }
    var icone = SV('<mask id="' + m + '"><rect width="24" height="24" fill="#fff"/><circle class="nx-th-ombre" cx="17.2" cy="6.8" r="5.4" fill="#000"/></mask>' +
      '<g class="nx-th-rayons">' + rayons + '</g><circle class="nx-th-astre" cx="12" cy="12" r="4.6" fill="currentColor" stroke="none" mask="url(#' + m + ')"/>', 'nx-th');
    var racine = document.documentElement, applique = el.hasAttribute('data-applique');
    function sombre() { var t = racine.getAttribute('data-theme'); return t ? t === 'dark' : !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches); }
    return bascule(el, {
      nom: 'Thème sombre', icone: icone, off: 'Clair', on: 'Sombre', actif: applique ? sombre() : false,
      apres: function (e, v, silence) {
        if (!applique || silence) return;
        racine.setAttribute('data-theme', v ? 'dark' : 'light');
        try { localStorage.setItem('nx-theme', v ? 'dark' : 'light'); } catch (_) {}
      }
    });
  });

  NX.def('micro', function (el) {
    return bascule(el, {
      nom: 'Micro', off: 'Coupé', on: 'Micro actif', actif: true,
      icone: SV('<rect class="nx-mi-corps" x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>' +
        '<path class="nx-mi-onde o1" d="M20.6 8.6a6 6 0 0 1 0 4.8"/><path class="nx-mi-onde o2" d="M3.4 8.6a6 6 0 0 0 0 4.8"/>' + BARRE, 'nx-mi')
    });
  });

  NX.def('camera', function (el) {
    return bascule(el, {
      nom: 'Caméra', off: 'Caméra coupée', on: 'Caméra active', actif: true,
      icone: SV('<rect x="2.5" y="6.5" width="13" height="11" rx="2.5"/><path d="M15.5 10.5l5-3v9l-5-3"/>' +
        '<circle class="nx-cam-rec" cx="6.4" cy="10" r="1.5" fill="currentColor" stroke="none"/>' + BARRE, 'nx-cam')
    });
  });

  NX.def('volume', function (el) {
    var niveaux = ['Coupé', 'Faible', 'Moyen', 'Fort'];
    var nom = el.getAttribute('aria-label') || txt(el) || 'Volume';
    var n = borne(Math.round(opt(el, 'niveau', 2)), 0, 3);
    el.classList.add('nx-icone');
    if (el.hasAttribute('data-seul')) el.classList.add('nx-seul');
    el.innerHTML = SV('<path d="M4 9.5h3l4.5-4v13L7 14.5H4Z"/>' +
      '<path class="nx-vo-o o1" d="M14.5 9.6a3.4 3.4 0 0 1 0 4.8"/><path class="nx-vo-o o2" d="M16.9 7.3a6.7 6.7 0 0 1 0 9.4"/>' +
      '<path class="nx-vo-o o3" d="M19.2 5a9.9 9.9 0 0 1 0 14"/><path class="nx-vo-x" d="M15.6 9.6l4.8 4.8M20.4 9.6l-4.8 4.8"/>', 'nx-vo') +
      pile({ 0: niveaux[0], 1: niveaux[1], 2: niveaux[2], 3: niveaux[3] }, String(n));
    function regler(v, silence) {
      n = borne(v, 0, 3);
      el.dataset.niveau = n;
      el.setAttribute('aria-label', nom + ' : ' + niveaux[n].toLowerCase());
      montrer(el, String(n));
      if (!silence) { tic(el); emit(el, 'change', { niveau: n }); }
    }
    regler(n, true);
    el.addEventListener('click', function () { regler((n + 1) % 4); });
    return { regler: regler };
  });

  NX.def('cadenas', function (el) {
    return bascule(el, {
      nom: 'Verrou', off: 'Ouvert', on: 'Verrouillé', actif: true,
      icone: SV('<path class="nx-cd-anse" d="M8 11V7.5a4 4 0 0 1 8 0V11"/><g class="nx-cd-corps"><rect x="5" y="11" width="14" height="10" rx="2.5"/>' +
        '<circle cx="12" cy="16" r="1.3" fill="currentColor" stroke="none"/></g>', 'nx-cd')
    });
  });

  NX.def('dossier', function (el) {
    return bascule(el, {
      nom: 'Dossier', off: 'Dossier', on: 'Ouvert',
      icone: SV('<path d="M3.5 18V7a1.5 1.5 0 0 1 1.5-1.5h4.6l2 2.5H19A1.5 1.5 0 0 1 20.5 9.5V18A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18Z"/>' +
        '<rect class="nx-do-feuille" x="7" y="8.5" width="10" height="8" rx="1" style="fill:var(--nx-ic-fond)"/>' +
        '<path class="nx-do-rabat" d="M3.6 11.5h16.8l-1 6.8a1.5 1.5 0 0 1-1.5 1.2H6.1a1.5 1.5 0 0 1-1.5-1.2Z" style="fill:var(--nx-ic-fond)"/>', 'nx-do')
    });
  });

  NX.def('visibilite', function (el) {
    return bascule(el, {
      nom: 'Visibilité', off: 'Masqué', on: 'Visible', actif: true,
      icone: SV('<g class="nx-vu-oeil">' + OEIL + '</g>' + BARRE, 'nx-vu')
    });
  });

  NX.def('signet', function (el) {
    var c = uid('sg'), forme = 'M6.5 3.5h11v17l-5.5-4-5.5 4Z';
    return bascule(el, {
      nom: 'Enregistrer pour plus tard', off: 'Enregistrer', on: 'Enregistré',
      icone: SV('<clipPath id="' + c + '"><path d="' + forme + '"/></clipPath>' +
        '<rect class="nx-sg-plein" x="4" y="2" width="16" height="20" clip-path="url(#' + c + ')" fill="currentColor" stroke="none"/><path d="' + forme + '"/>', 'nx-sg')
    });
  });

  NX.def('jaime', function (el) {
    var n = opt(el, 'nombre', NaN), eclats = '';
    for (var k = 0; k < 6; k++) {
      var a = (k * 60 - 90) * D2R;
      eclats += '<line class="nx-ja-eclat" x1="' + (12 + Math.cos(a) * 9.5).toFixed(2) + '" y1="' + (12.5 + Math.sin(a) * 9.5).toFixed(2) +
        '" x2="' + (12 + Math.cos(a) * 12).toFixed(2) + '" y2="' + (12.5 + Math.sin(a) * 12).toFixed(2) + '"/>';
    }
    var cpt = null;
    var b = bascule(el, {
      nom: "J'aime", off: "J'aime", on: "J'aime",
      icone: SV('<circle class="nx-ja-onde" cx="12" cy="12.5" r="9"/>' + eclats + '<path d="' + COEUR + '"/><path class="nx-ja-plein" d="' + COEUR + '" fill="currentColor" stroke="none"/>', 'nx-ja'),
      suffixe: isNaN(n) ? '' : '<span class="nx-cpt" aria-hidden="true"></span>',
      apres: function (e, v, silence) {
        if (!cpt) return;
        if (!silence) n += v ? 1 : -1;
        compteur(cpt, n);
        e.setAttribute('aria-label', "J'aime (" + n + ')');
      }
    });
    if (!isNaN(n)) {
      el.classList.add('nx-avec-cpt');
      cpt = el.querySelector('.nx-cpt');
      compteur(cpt, n);
      el.setAttribute('aria-label', "J'aime (" + n + ')');
    }
    return b;
  });

  NX.def('favori', function (el) {
    var e = etoileChemin(12, 12.6, 9.2, 3.9), et = '';
    [[3, 4], [21, 5], [20.5, 19.5], [3.5, 19]].forEach(function (p, k) {
      et += '<path class="nx-fa-et" style="--k:' + k + '" d="M' + p[0] + ' ' + (p[1] - 1.6) + 'v3.2M' + (p[0] - 1.6) + ' ' + p[1] + 'h3.2"/>';
    });
    return bascule(el, {
      nom: 'Favori', off: 'Ajouter aux favoris', on: 'Dans vos favoris',
      icone: SV(et + '<path d="' + e + '"/><path class="nx-fa-plein" d="' + e + '" fill="currentColor" stroke="none"/>', 'nx-fa')
    });
  });

  NX.def('reseau', function (el) {
    var t = 0;
    return bascule(el, {
      nom: 'Réseau', off: 'Hors ligne', on: 'Connecté', etats: { att: el.dataset.texteAttente || 'Connexion…' }, actif: true,
      icone: SV('<path class="nx-re-a a3" d="M2.8 9.2a13 13 0 0 1 18.4 0"/><path class="nx-re-a a2" d="M5.9 12.4a8.6 8.6 0 0 1 12.2 0"/>' +
        '<path class="nx-re-a a1" d="M9 15.5a4.2 4.2 0 0 1 6 0"/><circle cx="12" cy="18.6" r="1.3" fill="currentColor" stroke="none"/>' + BARRE, 'nx-re'),
      clic: function (e, actif, regler) {
        clearTimeout(t);
        if (actif || e.classList.contains('nx-cherche')) { e.classList.remove('nx-cherche'); regler(false); return; }
        e.classList.add('nx-cherche');
        montrer(e, 'att');
        emit(e, 'confirm');
        t = setTimeout(function () { e.classList.remove('nx-cherche'); regler(true); }, calme() ? 300 : opt(e, 'duree', 1500));
      }
    });
  });

  NX.def('alimentation', function (el) {
    return bascule(el, {
      nom: 'Alimentation', off: 'Éteint', on: 'Allumé',
      icone: SV('<circle class="nx-al-anneau" cx="12" cy="12" r="10.4" pathLength="100"/><path d="M7.4 6.9a7 7 0 1 0 9.2 0"/><path d="M12 3.4v7.8"/>', 'nx-al')
    });
  });

  NX.def('agrandir', function (el) {
    var cible = el.dataset.cible ? document.querySelector(el.dataset.cible) : null;
    var b = bascule(el, {
      nom: 'Plein écran', off: 'Agrandir', on: 'Réduire',
      icone: SV('<g class="nx-ag tl"><path d="M4 9V4h5"/></g><g class="nx-ag tr"><path d="M15 4h5v5"/></g>' +
        '<g class="nx-ag bl"><path d="M4 15v5h5"/></g><g class="nx-ag br"><path d="M20 15v5h-5"/></g>', 'nx-agr'),
      apres: function (e, v, silence) {
        if (silence || !cible) return;
        try {
          if (v && !document.fullscreenElement && cible.requestFullscreen) {
            var pr = cible.requestFullscreen();
            if (pr && pr.catch) pr.catch(function () { b.regler(false, true); });
          } else if (!v && document.fullscreenElement) document.exitFullscreen();
        } catch (_) { b.regler(false, true); }
      }
    });
    if (cible) document.addEventListener('fullscreenchange', function () {
      var plein = document.fullscreenElement === cible;
      if (plein !== b.actif()) b.regler(plein, true);
    });
    return b;
  });

  NX.def('rechercher', function (el) {
    return bascule(el, {
      nom: 'Rechercher', off: 'Rechercher', on: 'Fermer', attr: 'aria-expanded',
      icone: SV('<circle class="nx-ch-loupe" cx="10.5" cy="10.5" r="6"/><path class="nx-ch-manche" d="M15 15l5 5"/>' +
        '<path class="nx-ch-x x1" d="M6 6l12 12" pathLength="100"/><path class="nx-ch-x x2" d="M18 6L6 18" pathLength="100"/>', 'nx-ch')
    });
  });

  NX.def('reglages', function (el) {
    return bascule(el, {
      nom: 'Réglages', off: 'Réglages', on: 'Réglages', attr: 'aria-expanded',
      icone: SV('<path class="nx-rg-roue" d="' + engrenage(12, 12, 10, 7.4, 8) + '"/><circle cx="12" cy="12" r="2.9"/>', 'nx-rg')
    });
  });

  NX.def('modifier', function (el) {
    return bascule(el, {
      nom: 'Mode édition', off: 'Modifier', on: 'Enregistrer',
      icone: SV('<g class="nx-mo-crayon"><path d="M4.5 19.5l1-4.2L15.8 5a2.1 2.1 0 0 1 3 3L8.6 18.4Z"/><path d="M14 6.8l3 3"/></g>' +
        '<path class="nx-mo-ok" d="M5 12.5l4.5 4.5L19 7.5" pathLength="100"/>', 'nx-mo')
    });
  });

  NX.def('abonner', function (el) {
    return bascule(el, {
      nom: "S'abonner", off: "S'abonner", on: 'Abonné', etats: { quitter: el.dataset.texteQuitter || 'Se désabonner' },
      icone: SV('<g class="nx-ab-cloche"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15Z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></g>' +
        '<circle class="nx-ab-pastille" cx="18.5" cy="5.5" r="3.4" stroke="none"/><path class="nx-ab-ok" d="M16.9 5.6l1.1 1.1 2-2.2" pathLength="100"/>', 'nx-ab')
    });
  });

  NX.def('etoiles', function (el) {
    var n = opt(el, 'nombre', 0), e = etoileChemin(12, 12.6, 9.2, 3.9), cpt;
    var b = bascule(el, {
      nom: 'Étoiles', off: txt(el) || 'Étoiles', on: txt(el) || 'Étoiles',
      icone: SV('<path d="' + e + '"/><path class="nx-fa-plein" d="' + e + '" fill="currentColor" stroke="none"/>', 'nx-fa nx-et'),
      suffixe: '<span class="nx-et-sep" aria-hidden="true"></span><span class="nx-cpt" aria-hidden="true"></span>',
      apres: function (x, v, silence) {
        if (!cpt) return;
        if (!silence) n += v ? 1 : -1;
        compteur(cpt, n);
        x.setAttribute('aria-label', 'Étoiles (' + n + ')');
      }
    });
    el.classList.add('nx-avec-cpt');
    cpt = el.querySelector('.nx-cpt');
    compteur(cpt, n);
    el.setAttribute('aria-label', 'Étoiles (' + n + ')');
    return b;
  });

  /* ==========================================================================
     LOT 3 — ACTIONS
     ========================================================================== */
  // téléchargement / envoi : repos → progression (0–1) → fini ; Noctis.progression(el, p) pilote
  function avancement(el, cfg) {
    var nom = txt(el) || cfg.repos;
    el.classList.add('nx-icone', 'nx-avance');
    el.innerHTML = cfg.icone + pile({ repos: esc(nom), cours: '<span class="nx-av-pc">0 %</span>', fini: esc(el.dataset.fini || cfg.fini) }, 'repos') +
      '<span class="nx-av-barre" aria-hidden="true"></span><span class="nx-sr" aria-live="polite"></span>';
    el.setAttribute('aria-label', nom);
    el.dataset.etat = 'repos';
    var etat = 'repos', pc = el.querySelector('.nx-av-pc'), sr = el.querySelector('.nx-sr'), tSim = 0, tFin = 0, palier = -1;
    function progression(v) {
      v = borne(+v || 0, 0, 1);
      if (etat === 'fini') return;
      if (etat !== 'cours') { etat = 'cours'; el.dataset.etat = 'cours'; montrer(el, 'cours'); }
      el.style.setProperty('--nx-p', v);
      pc.textContent = Math.round(v * 100) + ' %';
      var q = Math.floor(v * 4);
      if (q !== palier) { palier = q; sr.textContent = cfg.annonce + ' ' + Math.round(v * 100) + ' %'; }
      emit(el, 'progression', { p: v });
      if (v >= 1) finir();
    }
    function finir() {
      clearTimeout(tSim);
      etat = 'fini'; el.dataset.etat = 'fini'; montrer(el, 'fini');
      sr.textContent = el.dataset.fini || cfg.fini;
      emit(el, 'fin');
      clearTimeout(tFin);
      tFin = setTimeout(function () {
        etat = 'repos'; el.dataset.etat = 'repos'; palier = -1;
        el.style.setProperty('--nx-p', 0);
        montrer(el, 'repos');
      }, opt(el, 'reset', 2200));
    }
    function simuler() {
      var v = 0;
      progression(0);
      (function pas() {
        v = Math.min(1, v + hasard(.07, .2));
        progression(v);
        if (v < 1) tSim = setTimeout(pas, calme() ? 60 : hasard(140, 320));
      })();
    }
    el.addEventListener('click', function () {
      if (etat !== 'repos' || el.disabled) return;
      emit(el, 'confirm');
      if (cfg.clic) cfg.clic(simuler, progression);
      else if (el.hasAttribute('data-demo')) simuler();
      else progression(0);
    });
    return { progression: progression };
  }
  NX.progression = function (el, p) { var c = monter(el); if (c && c.progression) c.progression(p); };

  NX.def('telecharger', function (el) {
    return avancement(el, {
      repos: 'Télécharger', fini: 'Terminé', annonce: 'Téléchargement',
      icone: SV('<g class="nx-tl-fleche"><path d="M12 4v10.5M7.5 10 12 14.5 16.5 10"/></g><path d="M4.5 19.5h15"/>' +
        '<path class="nx-tl-ok" d="M7 12.5l3.5 3.5L17 9" pathLength="100"/>', 'nx-tl')
    });
  });

  NX.def('televerser', function (el) {
    var entree = document.createElement('input');
    entree.type = 'file';
    entree.hidden = true;
    entree.tabIndex = -1;
    if (el.dataset.accepte) entree.accept = el.dataset.accepte;
    if (el.hasAttribute('data-multiple')) entree.multiple = true;
    el.after(entree);
    var c = avancement(el, {
      repos: 'Envoyer un fichier', fini: 'Envoyé', annonce: 'Envoi',
      icone: SV('<g class="nx-tl-fleche"><path d="M12 15V4.5M7.5 9 12 4.5 16.5 9"/></g><path d="M4.5 19.5h15"/>' +
        '<path class="nx-tl-ok" d="M7 12.5l3.5 3.5L17 9" pathLength="100"/>', 'nx-tl nx-tv'),
      clic: function (simuler) { if (el.hasAttribute('data-demo')) simuler(); else entree.click(); }
    });
    entree.addEventListener('change', function () {
      if (!entree.files || !entree.files.length) return;
      emit(el, 'fichiers', { fichiers: entree.files });
      c.progression(0);
    });
    return c;
  });

  NX.def('soumettre', function (el) {
    var l = label(el);
    var nom = txt(l);
    el.insertAdjacentHTML('beforeend', '<span class="nx-so-ic" aria-hidden="true">' + ICO.spin + ICO.ok + ICO.croix + '</span><span class="nx-sr" aria-live="polite"></span>');
    el.setAttribute('aria-label', nom);
    el.dataset.etat = 'repos';
    var sr = el.querySelector('.nx-sr'), largeur = 0, etat = 'repos', t = 0;
    var TEXTES = { chargement: 'Envoi en cours', succes: el.dataset.succes || 'Envoyé', erreur: el.dataset.erreur || 'Échec de l’envoi', repos: '' };
    function regler(e) {
      if (e === etat || !TEXTES.hasOwnProperty(e)) return;
      clearTimeout(t);
      if (etat === 'repos') { largeur = el.offsetWidth; el.style.width = largeur + 'px'; void el.offsetWidth; }
      etat = e;
      el.dataset.etat = e;
      el.setAttribute('aria-busy', String(e === 'chargement'));
      sr.textContent = TEXTES[e];
      if (e === 'repos') { el.style.width = largeur + 'px'; t = setTimeout(function () { if (etat === 'repos') el.style.width = ''; }, 500); }
      else el.style.width = el.offsetHeight + 'px';
      if (e === 'erreur') secoue(el);
      emit(el, 'etat', { etat: e });
    }
    el.addEventListener('click', function () {
      if (etat !== 'repos') return;
      emit(el, 'confirm');
      if (!el.hasAttribute('data-demo')) return;
      regler('chargement');
      setTimeout(function () {
        regler(Math.random() < .75 ? 'succes' : 'erreur');
        setTimeout(function () { regler('repos'); }, 1500);
      }, calme() ? 300 : 1400);
    });
    return { etat: regler };
  });

  NX.def('recharger', function (el) {
    var nom = txt(el) || 'Actualiser';
    el.classList.add('nx-icone');
    if (el.hasAttribute('data-seul')) el.classList.add('nx-seul');
    el.innerHTML = SV('<g class="nx-ac-fleche"><path d="M20 12a8 8 0 1 1-2.35-5.65"/><path d="M20 4v4h-4"/></g>', 'nx-ac') +
      pile({ repos: esc(nom), chargement: esc(el.dataset.texteAttente || 'Actualisation…'), succes: esc(el.dataset.fini || 'À jour') }, 'repos');
    el.setAttribute('aria-label', nom);
    el.dataset.etat = 'repos';
    var etat = 'repos', t = 0;
    function regler(e) {
      if (e === 'erreur') e = 'repos';
      if (e === etat) return;
      clearTimeout(t);
      etat = e; el.dataset.etat = e; montrer(el, e);
      el.setAttribute('aria-busy', String(e === 'chargement'));
      if (e === 'succes') { tic(el); t = setTimeout(function () { regler('repos'); }, 1500); }
      emit(el, 'etat', { etat: e });
    }
    el.addEventListener('click', function () {
      if (etat === 'chargement') return;
      emit(el, 'confirm');
      regler('chargement');
      if (el.hasAttribute('data-demo')) setTimeout(function () { regler('succes'); }, calme() ? 300 : opt(el, 'duree', 1300));
    });
    return { etat: regler };
  });

  NX.def('corbeille', function (el) {
    var nom = txt(el) || 'Supprimer';
    el.classList.add('nx-icone');
    if (el.hasAttribute('data-seul')) el.classList.add('nx-seul');
    el.innerHTML = SV('<rect class="nx-cb-papier p1" x="9" y="-1.5" width="3" height="3.6" rx=".6" fill="currentColor" stroke="none"/>' +
      '<rect class="nx-cb-papier p2" x="12.6" y="-3" width="3" height="3.6" rx=".6" fill="currentColor" stroke="none"/>' +
      '<g class="nx-cb-couvercle"><path d="M4 7h16"/><path d="M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2"/></g>' +
      '<path class="nx-cb-cuve" d="M6 7.5l.9 11.6a1.6 1.6 0 0 0 1.6 1.4h7a1.6 1.6 0 0 0 1.6-1.4L18 7.5"/><path d="M10 11v5.5M14 11v5.5"/>', 'nx-cb') +
      pile({ repos: esc(nom), fait: esc(el.dataset.fini || 'Supprimé') }, 'repos');
    el.setAttribute('aria-label', nom);
    var occupe = false;
    el.addEventListener('click', function () {
      if (occupe || el.disabled) return;
      occupe = true;
      tic(el);
      el.dataset.etat = 'fait';
      montrer(el, 'fait');
      emit(el, 'confirm');
      setTimeout(function () { el.dataset.etat = ''; montrer(el, 'repos'); el.classList.remove('nx-tic'); occupe = false; }, opt(el, 'reset', 2000));
    });
  });

  NX.def('partager', function (el) {
    var groupe = h('span', 'nx-pt-groupe');
    el.parentNode.insertBefore(groupe, el);
    groupe.appendChild(el);
    var nom = txt(el) || 'Partager';
    var url = el.dataset.url || location.href, titre = el.dataset.titre || document.title;
    el.classList.add('nx-icone');
    if (el.hasAttribute('data-seul')) el.classList.add('nx-seul');
    el.innerHTML = SV('<circle cx="17.5" cy="5.5" r="2.5"/><circle cx="6.5" cy="12" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/><path d="M8.7 10.8l6.6-4M8.7 13.2l6.6 4"/>', 'nx-pt') +
      '<span class="nx-l">' + esc(nom) + '</span>';
    el.setAttribute('aria-label', nom);
    el.setAttribute('aria-expanded', 'false');
    var opts = h('span', 'nx-pt-options');
    opts.id = uid('pt');
    el.setAttribute('aria-controls', opts.id);
    var lien = SV('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>');
    var courriel = SV('<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>');
    var message = SV('<path d="M4 5.5h16v10H9l-4 3.5v-3.5H4Z"/>');
    opts.innerHTML =
      '<button type="button" class="nx-pt-opt" data-canal="lien" style="--k:0" aria-label="Copier le lien" tabindex="-1">' + lien + '</button>' +
      '<a class="nx-pt-opt" data-canal="courriel" style="--k:1" aria-label="Envoyer par e-mail" tabindex="-1" href="mailto:?subject=' +
        encodeURIComponent(titre) + '&amp;body=' + encodeURIComponent(url) + '">' + courriel + '</a>' +
      '<a class="nx-pt-opt" data-canal="message" style="--k:2" aria-label="Envoyer par message" tabindex="-1" href="sms:?&amp;body=' +
        encodeURIComponent(titre + ' ' + url) + '">' + message + '</a>';
    groupe.appendChild(opts);
    function ouvrir(v) {
      el.setAttribute('aria-expanded', String(v));
      groupe.classList.toggle('ouvert', v);
      [].forEach.call(opts.children, function (o) { o.tabIndex = v ? 0 : -1; });
    }
    el.addEventListener('click', function () {
      if (el.hasAttribute('data-natif') && navigator.share) {
        navigator.share({ title: titre, url: url }).then(function () { emit(el, 'partage', { canal: 'natif', url: url }); }, function () {});
        return;
      }
      ouvrir(el.getAttribute('aria-expanded') !== 'true');
    });
    opts.addEventListener('click', function (e) {
      var o = e.target.closest('.nx-pt-opt');
      if (!o) return;
      if (o.dataset.canal === 'lien') copierTexte(url, function (ok) {
        o.classList.toggle('ok', ok);
        o.setAttribute('aria-label', ok ? 'Lien copié' : 'Copie impossible');
        setTimeout(function () { o.classList.remove('ok'); o.setAttribute('aria-label', 'Copier le lien'); }, 1400);
      });
      emit(el, 'partage', { canal: o.dataset.canal, url: url });
    });
    groupe.addEventListener('keydown', function (e) { if (e.key === 'Escape' && groupe.classList.contains('ouvert')) { ouvrir(false); el.focus(); } });
    document.addEventListener('click', function (e) { if (!groupe.contains(e.target)) ouvrir(false); });
  });

  NX.def('apercu', function (el) {
    var nom = txt(el) || 'Aperçu', id = uid('ap');
    el.classList.add('nx-icone');
    el.innerHTML = SV(OEIL, 'nx-ap') + '<span class="nx-l">' + esc(nom) + '</span>' +
      '<span class="nx-ap-carte" role="tooltip" id="' + id + '">' + (el.dataset.titre ? '<b>' + esc(el.dataset.titre) + '</b>' : '') +
      '<span>' + esc(el.dataset.apercu || 'Le contenu s’affiche ici avant ouverture.') + '</span></span>';
    el.setAttribute('aria-describedby', id);
    el.addEventListener('keydown', function (e) { if (e.key === 'Escape') el.classList.add('nx-ap-ferme'); });
    ['pointerleave', 'blur'].forEach(function (n) { el.addEventListener(n, function () { el.classList.remove('nx-ap-ferme'); }); });
  });

  NX.def('soutenir', function (el) {
    var nom = txt(el) || 'Soutenir';
    el.classList.add('nx-icone');
    el.innerHTML = SV('<path class="nx-su-coeur" d="' + COEUR + '"/>', 'nx-su') + pile({ repos: esc(nom), merci: esc(el.dataset.merci || 'Merci !') }, 'repos');
    el.setAttribute('aria-label', nom);
    var t = 0;
    el.addEventListener('click', function () {
      tic(el);
      montrer(el, 'merci');
      clearTimeout(t);
      t = setTimeout(function () { montrer(el, 'repos'); }, 1800);
      emit(el, 'confirm');
      if (calme()) return;
      var r = el.querySelector('.nx-ic').getBoundingClientRect(), ps = [];
      for (var k = 0; k < 9; k++) {
        ps.push({ x: r.left + r.width / 2 + hasard(-6, 6), y: r.top + 6, vx: hasard(-70, 70), vy: hasard(-300, -150), g: 120, air: 1.4,
          vie: hasard(1, 1.7), taille: hasard(4, 7), couleur: choix(['#ff4d6d', '#ff7a93', '#ff2e63', '#ffa3b5']), forme: 'coeur', rot: hasard(-.4, .4), vrot: hasard(-1, 1) });
      }
      NX.particules(ps);
    });
  });

  NX.def('deployer', function (el) {
    var nom = txt(el) || 'Déployer';
    var etapes = el.dataset.etapes ? el.dataset.etapes.split('|') : ['Construction…', 'Tests…', 'Mise en ligne…'];
    var etats = { repos: esc(nom), fini: esc(el.dataset.fini || 'En ligne') };
    etapes.forEach(function (e, i) { etats['e' + i] = esc(e); });
    el.classList.add('nx-icone', 'nx-avance');
    el.innerHTML = SV('<g class="nx-de-fleche"><path d="M12 15V4.5M7.5 9 12 4.5 16.5 9"/></g><path d="M4.5 14.5v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3"/>', 'nx-de') +
      '<span class="nx-de-point" aria-hidden="true"></span>' + pile(etats, 'repos') + '<span class="nx-av-barre" aria-hidden="true"></span><span class="nx-sr" aria-live="polite"></span>';
    el.setAttribute('aria-label', nom);
    el.dataset.etat = 'repos';
    var occupe = false, sr = el.querySelector('.nx-sr');
    el.addEventListener('click', function () {
      if (occupe || el.disabled) return;
      occupe = true;
      emit(el, 'confirm');
      el.dataset.etat = 'cours';
      var i = 0, pas = opt(el, 'pas', 900);
      (function suite() {
        if (i < etapes.length) {
          montrer(el, 'e' + i);
          sr.textContent = etapes[i];
          el.style.setProperty('--nx-p', (i + 1) / (etapes.length + 1));
          emit(el, 'etape', { index: i, nom: etapes[i] });
          i++;
          setTimeout(suite, calme() ? 250 : pas);
          return;
        }
        el.style.setProperty('--nx-p', 1);
        el.dataset.etat = 'fini';
        montrer(el, 'fini');
        sr.textContent = el.dataset.fini || 'En ligne';
        emit(el, 'fin');
        setTimeout(function () { occupe = false; el.dataset.etat = 'repos'; el.style.setProperty('--nx-p', 0); montrer(el, 'repos'); }, opt(el, 'reset', 2600));
      })();
    });
  });

  NX.def('empreinte', function (el) {
    var complet = el.dataset.copie || txt(el) || 'a3f9c2e17b4d08';
    var court = complet.slice(0, opt(el, 'longueur', 7));
    el.classList.add('nx-icone');
    el.innerHTML = '<span class="nx-em-code" aria-hidden="true">' + Array.from(court).map(function (c) { return '<i>' + esc(c) + '</i>'; }).join('') + '</span>' +
      SV('<g class="nx-em-copie"><rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/></g>' +
        '<path class="nx-em-ok" d="M6 12.5l4 4 8-8.5" pathLength="100"/>', 'nx-em');
    el.setAttribute('aria-label', 'Copier ' + complet);
    var cases = [].slice.call(el.querySelectorAll('.nx-em-code i')), HEX = '0123456789abcdef', t = 0;
    el.addEventListener('click', function () {
      copierTexte(complet, function (ok) {
        if (!ok) { secoue(el); return; }
        emit(el, 'copie', { texte: complet });
        el.classList.add('ok');
        clearTimeout(t);
        t = setTimeout(function () { el.classList.remove('ok'); }, 1600);
        if (calme()) return;
        cases.forEach(function (c, i) {
          var vrai = c.textContent, n = 0, fin = 3 + i * 2;
          var iv = setInterval(function () {
            c.textContent = ++n >= fin ? vrai : HEX[Math.random() * 16 | 0];
            if (n >= fin) clearInterval(iv);
          }, 35);
        });
      });
    });
  });

  NX.def('compte', function (el) {
    var nom = el.dataset.nom || txt(el) || 'Mon compte';
    var initiales = nom.split(/\s+/).filter(Boolean).map(function (m) { return m[0]; }).join('').slice(0, 2).toUpperCase();
    el.classList.add('nx-icone', 'nx-cpte');
    el.innerHTML = '<span class="nx-cp-avatar" aria-hidden="true"><span class="nx-cp-ini">' + esc(initiales) + '</span><i class="nx-cp-statut"></i></span>' +
      '<span class="nx-cp-nom" aria-hidden="true">' + esc(nom) + '</span>' + ICO.chevron.replace('nx-chevron', 'nx-chevron nx-cp-chev');
    if (el.dataset.image) {
      var img = document.createElement('img');
      img.alt = '';
      img.src = el.dataset.image;
      el.querySelector('.nx-cp-avatar').insertBefore(img, el.querySelector('.nx-cp-statut'));
    }
    el.querySelector('.nx-cp-statut').dataset.s = el.dataset.statut || 'en-ligne';
    el.setAttribute('aria-label', nom);
    el.setAttribute('aria-haspopup', 'menu');
    el.setAttribute('aria-expanded', 'false');
    el.addEventListener('click', function () {
      var v = el.getAttribute('aria-expanded') !== 'true';
      el.setAttribute('aria-expanded', String(v));
      emit(el, 'change', { ouvert: v });
    });
  });

  /* ==========================================================================
     LOT 3 — EFFETS
     ========================================================================== */
  NX.def('glisse-fleche', function (el) {
    var l = label(el);
    el.insertAdjacentHTML('afterbegin', SV('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8.5 20h7M12 16v4"/>', 'nx-gf-ecran'));
    el.insertAdjacentHTML('beforeend', SV('<path d="M12 5v12M6.5 11.5 12 17l5.5-5.5"/>', 'nx-gf-fleche'));
    el.addEventListener('click', function () { tic(el); emit(el, 'confirm'); });
  });

  NX.def('eclat', function (el) {
    label(el);
    el.appendChild(cache(h('span', 'nx-ec-reflet')));
    el.appendChild(cache(h('span', 'nx-ec-balai')));
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.style.setProperty('--x', (x * 100).toFixed(1) + '%');
      el.style.setProperty('--y', (y * 100).toFixed(1) + '%');
      if (!calme()) {
        el.style.setProperty('--rx', ((.5 - y) * 10).toFixed(2) + 'deg');
        el.style.setProperty('--ry', ((x - .5) * 12).toFixed(2) + 'deg');
      }
    });
    el.addEventListener('pointerenter', function () { tic(el); });
    el.addEventListener('pointerleave', function () { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
  });

  NX.def('texte-survol', function (el) {
    var a = txt(el) || 'Survoler', b = el.dataset.survol || a;
    function lettres(t, cls) {
      return '<span class="nx-ts-ligne ' + cls + '" aria-hidden="true">' + Array.from(t).map(function (c, i) {
        return '<i style="--k:' + i + '">' + (c === ' ' ? '&nbsp;' : esc(c)) + '</i>';
      }).join('') + '</span>';
    }
    el.setAttribute('aria-label', a);
    el.innerHTML = '<span class="nx-ts">' + lettres(a, 'a') + lettres(b, 'b') + '</span>';
  });

  NX.def('champ-magnetique', function (el) {
    var l = label(el), face = cache(h('span', 'nx-cm-face')), cv = cache(h('canvas'));
    el.insertBefore(cv, l);
    el.insertBefore(face, l);
    var ctx = cv.getContext('2d'), N = opt(el, 'particules', 48), M = 40, parts = [];
    var survol = 0, cible = 0, choc = 0, raf = 0, vu = true, px = -1e4, py = -1e4, W = 0, H = 0, coul = '#6a45ff', image = 0;
    for (var k = 0; k < N; k++) parts.push({ a: Math.random() * 6.283, o: hasard(7, 24), v: hasard(.25, .7) * (Math.random() < .5 ? -1 : 1), t: hasard(1.1, 2.3), ph: Math.random() * 6.283 });
    function taille() {
      var r = el.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width + M * 2; H = r.height + M * 2;
      cv.width = Math.round(W * d); cv.height = Math.round(H * d);
      cv.style.cssText = 'left:' + (-M) + 'px;top:' + (-M) + 'px;width:' + W + 'px;height:' + H + 'px';
      ctx.setTransform(d, 0, 0, d, 0, 0);
    }
    function dessiner(t) {
      if (image++ % 60 === 0) coul = jeton(el, '--nx-accent', coul);
      survol += (cible - survol) * .08;
      choc *= .93;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = coul;
      var cx = W / 2, cy = H / 2, ax = W / 2 - M, ay = H / 2 - M;
      var dedans = px > M && px < W - M && py > M && py < H - M;
      parts.forEach(function (p) {
        p.a += p.v * .016 * (1 + survol * 2.2);
        var off = p.o + (7 - p.o) * survol + choc * p.t * 9 + Math.sin(t / 700 + p.ph) * 2;
        var x = cx + Math.cos(p.a) * (ax + off), y = cy + Math.sin(p.a) * (ay + off);
        var dx = px - x, dy = py - y, dist = Math.hypot(dx, dy);
        if (!dedans && dist < 110) { var f = (1 - dist / 110) * 18; x += dx / (dist || 1) * f; y += dy / (dist || 1) * f; }
        ctx.globalAlpha = .4 + survol * .5;
        ctx.beginPath();
        ctx.arc(x, y, p.t * (.85 - survol * .2), 0, 6.2832);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }
    function boucle(t) { dessiner(t); raf = requestAnimationFrame(boucle); }
    function lancer() { if (!raf && vu && !calme()) raf = requestAnimationFrame(boucle); }
    function arreter() { cancelAnimationFrame(raf); raf = 0; }
    el.addEventListener('pointerenter', function () { cible = 1; });
    el.addEventListener('pointerleave', function () { cible = 0; });
    el.addEventListener('focus', function () { cible = 1; });
    el.addEventListener('blur', function () { cible = 0; });
    el.addEventListener('click', function () { choc = 1; emit(el, 'confirm'); });
    addEventListener('pointermove', function (e) {
      var r = cv.getBoundingClientRect();
      px = e.clientX - r.left; py = e.clientY - r.top;
    }, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(taille).observe(el);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { vu = e[0].isIntersecting; if (vu) lancer(); else arreter(); }).observe(el);
    taille();
    if (calme()) dessiner(0); else lancer();
  });

  NX.def('anneau-onde', function (el) {
    label(el);
    for (var k = 0; k < 3; k++) { var a = cache(h('span', 'nx-ao-anneau')); a.style.setProperty('--k', k); el.appendChild(a); }
    el.addEventListener('click', function () {
      emit(el, 'confirm');
      if (calme()) return;
      var c = cache(h('span', 'nx-ao-choc'));
      el.appendChild(c);
      c.addEventListener('animationend', function () { c.remove(); });
    });
  });

  /* ==========================================================================
     LOT 4 — PILULES ET GLISSIÈRE
     ========================================================================== */
  NX.def('fleche-aimantee', function (el) {
    label(el);
    el.insertAdjacentHTML('afterbegin', '<span class="nx-fa-palet" aria-hidden="true">' + SV('<path d="M5 12h13M13 6.5 18.5 12 13 17.5"/>') + '</span>');
    var palet = el.firstChild;
    el.addEventListener('pointermove', function (e) {
      if (calme() || e.pointerType === 'touch') return;
      var r = el.getBoundingClientRect(), p = palet.offsetLeft + palet.offsetWidth / 2;
      palet.style.translate = borne((e.clientX - r.left - p) * .12, -6, 6).toFixed(1) + 'px ' + borne((e.clientY - r.top - r.height / 2) * .2, -3, 3).toFixed(1) + 'px';
    });
    el.addEventListener('pointerleave', function () { palet.style.translate = ''; });
    el.addEventListener('click', function () { tic(el); emit(el, 'confirm'); });
  });

  var FUSEE = '<path d="M12.5 15.5 8.5 11.5C10 7 13.5 4 19.5 4c0 6-3 9.5-7 11.5Z"/><path d="M9.5 12.5 6 13l-2 2.5 3.5.5M11.5 14.5 11 18l2.5 2 .5-3.5"/><circle cx="15" cy="9" r="1.2"/>';
  NX.def('pilule-lancer', function (el) {
    var t = txt(el) || 'Lancer';
    el.innerHTML = SV(el.dataset.icone === 'plus' ? '<path d="M12 5v14M5 12h14"/>' : FUSEE, 'nx-pl-ico') +
      '<span class="nx-pl-txt"><span>' + esc(t) + '</span></span>' + SV('<path d="M8 16 16 8M10 8h6v6"/>', 'nx-pl-go');
    el.addEventListener('click', function () { tic(el); emit(el, 'confirm'); });
  });

  NX.def('pilule-enregistrer', function (el) {
    var forme = 'M6.5 3.5h11v17l-5.5-4-5.5 4Z';
    return bascule(el, {
      nom: 'Enregistrer', off: 'Enregistrer', on: 'Enregistré',
      icone: SV('<path d="' + forme + '"/><path class="nx-pe-plein" d="' + forme + '" fill="currentColor"/><path class="nx-pe-coche" d="M9.3 9.4l1.9 1.9 3.6-3.8" pathLength="100"/>', 'nx-pe')
    });
  });

  /* ==========================================================================
     Démarrage automatique + éléments ajoutés plus tard
     ========================================================================== */
  function demarrer() {
    NX.init(document);
    if ('MutationObserver' in window && !NX._obs) {
      NX._obs = new MutationObserver(function (muts) {
        muts.forEach(function (m) {
          for (var i = 0; i < m.addedNodes.length; i++) {
            var n = m.addedNodes[i];
            if (n.nodeType === 1 && !n.classList.contains('nx-scene')) NX.init(n);
          }
        });
      });
      NX._obs.observe(document.documentElement, { childList: true, subtree: true });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();
