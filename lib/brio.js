/* ==========================================================================
   Brio 1.0 — micro-interactions en HTML / CSS / JavaScript vanilla
   Lot 1 : chargeurs (data-brio). Lot 2 : texte (data-brio-texte), entrées
   (data-brio-entree, data-brio-cascade), progression, défilement collant,
   transitions de page, ressorts, vibrations. Lot 3 : interrupteurs et formulaires
   (contrôles natifs améliorés, data-brio sur l'input ou son conteneur). Lot 4 : scènes physiques,
   kit d'interface (menus, onglets, étapes, jauges, bulles…) et effets de pointeur. Lot 5 : cartes en éventail,
   carrousels 3D et morphings. Lot 6 : graphiques (monochromes et tramés) et composants d'IA.
   Démarrage automatique.
   API : Brio.init(racine), Brio.monter(el), Brio.rejouer(el), Brio.def(nom, def),
         Brio.liste(), Brio.listeTexte(), Brio.listeEntrees(), Brio.listeControles(), Brio.listeComposants(famille),
         Brio.transition(action, options), Brio.Ressort,
         Brio.surProgression(source, rappel), Brio.suivrePointeur(el, rappel),
         Brio.courbeRessort(options), Brio.vibre(motif), Brio.calme()
   ========================================================================== */
(function () {
  'use strict';

  var BR = window.Brio = window.Brio || {};
  BR.version = '1.0.0';
  var defs = {}, ordre = [];
  var mqCalme = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  // arrivée après une transition de page : voile posé avant le premier rendu si possible
  try { if (sessionStorage.getItem('brio-transition')) document.documentElement.classList.add('br-arrivee'); } catch (_) {}

  function calme() { return mqCalme.matches; }
  function alea(n) { var x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }
  function enfant(el, i, n) {
    var c = document.createElement('i');
    c.style.setProperty('--i', i);
    c.style.setProperty('--c', Math.abs(i - (n - 1) / 2));
    c.style.setProperty('--r', alea(i + 1).toFixed(3));
    el.appendChild(c);
    return c;
  }
  function texte(el, def) { return (el.dataset.texte || el.textContent || '').trim() || def; }

  var filtrePret = false;
  function filtreGluant() {
    if (filtrePret) return;
    filtrePret = true;
    var d = document.createElement('div');
    d.setAttribute('aria-hidden', 'true');
    d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    d.innerHTML = '<svg width="0" height="0"><filter id="br-gluant" x="-50%" y="-50%" width="200%" height="200%">' +
      '<feGaussianBlur in="SourceGraphic" stdDeviation="2.6" result="flou"/>' +
      '<feColorMatrix in="flou" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8" result="colle"/>' +
      '<feComposite in="SourceGraphic" in2="colle" operator="atop"/></filter></svg>';
    document.body.appendChild(d);
  }

  /* def : { c: catégorie, f: famille (rang|barres|grille|pose|rayons|orbite|texte),
             n: enfants, g: côté de grille, html: chaîne ou fonction(el), init: fonction(el),
             gluant: true, miroir: true } */
  BR.def = function (nom, d) { if (!defs[nom]) ordre.push(nom); defs[nom] = d; };
  BR.liste = function () {
    return ordre.filter(function (n) { return !defs[n].composant; }).map(function (n) { return { nom: n, categorie: defs[n].c }; });
  };
  BR.calme = calme;

  function monter(el) {
    if (el._br) return el._br;
    var nom = el.getAttribute('data-brio'), d = defs[nom];
    if (!d) return null;
    if (d.composant) {
      el.classList.add('br', 'br-' + nom);
      el._br = d.init(el) || {};
      return el._br;
    }
    el.classList.add('br', 'br-chargeur', 'br-' + nom);
    if (d.f) el.classList.add('br-' + d.f);
    var t = el.dataset.taille;
    if (t) el.style.setProperty('--br-taille', /^\d+(\.\d+)?$/.test(t) ? t + 'px' : t);
    var v = parseFloat(el.dataset.vitesse);
    if (v > 0) el.style.setProperty('--br-v', v);
    if (!el.hasAttribute('role')) el.setAttribute('role', 'status');
    if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', el.dataset.label || 'Chargement');
    var lu = d.f === 'texte' ? texte(el, d.defaut || 'Chargement') : '';
    el.textContent = '';
    if (d.n) {
      el.style.setProperty('--n', d.n);
      for (var i = 0; i < d.n; i++) { var c = enfant(el, i, d.n); if (d.miroir) c.className = 'br-miroir'; }
    }
    if (d.g) {
      el.style.setProperty('--g', d.g);
      for (var k = 0; k < d.g * d.g; k++) {
        var e = enfant(el, k, d.g * d.g);
        e.style.setProperty('--x', k % d.g);
        e.style.setProperty('--y', Math.floor(k / d.g));
      }
    }
    if (d.html) el.insertAdjacentHTML('beforeend', typeof d.html === 'function' ? d.html(el, lu) : d.html);
    if (d.gluant) { filtreGluant(); el.classList.add('br-gluant'); }
    if (d.f !== 'texte') [].forEach.call(el.children, function (x) { x.setAttribute('aria-hidden', 'true'); });
    el._br = (d.init && d.init(el, lu)) || {};
    return el._br;
  }
  BR.monter = monter;

  var SELECTEUR = '[data-brio],[data-brio-texte],[data-brio-entree],[data-brio-cascade]';
  // une erreur sur un élément ne bloque pas le montage des suivants
  function monterTout(el) {
    try {
      if (el.hasAttribute('data-brio')) monter(el);
      if (el.hasAttribute('data-brio-texte')) monterTexte(el);
      if (el.hasAttribute('data-brio-entree')) monterEntree(el);
      if (el.hasAttribute('data-brio-cascade')) monterCascade(el);
    } catch (e) { if (window.console) console.error('Brio :', el.getAttribute('data-brio') || '', e); }
  }
  BR.init = function (racine) {
    racine = racine || document;
    if (racine.nodeType === 1 && racine.matches(SELECTEUR)) monterTout(racine);
    var l = racine.querySelectorAll ? racine.querySelectorAll(SELECTEUR) : [];
    for (var i = 0; i < l.length; i++) monterTout(l[i]);
  };

  // boucle d'animation suspendue hors écran
  function boucleVisible(el, dessiner) {
    var raf = 0, vu = true, t0 = performance.now();
    function pas(t) { dessiner((t - t0) / 1000); raf = requestAnimationFrame(pas); }
    function go() { if (!raf && vu) raf = requestAnimationFrame(pas); }
    function stop() { cancelAnimationFrame(raf); raf = 0; }
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { vu = e[0].isIntersecting; if (vu) go(); else stop(); }).observe(el);
    go();
  }
  function vitesse(el) {
    var v = parseFloat(getComputedStyle(el).getPropertyValue('--br-v')) || 1;
    return calme() ? v / 2.5 : v;
  }
  function decouper(txt) {
    return txt.split('').map(function (ch, i) { return '<i style="--i:' + i + '">' + (ch === ' ' ? ' ' : echapper(ch)) + '</i>'; }).join('');
  }
  function echapper(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* ==========================================================================
     CHARGEURS — définitions (137)
     ========================================================================== */
  function D(c, f, n, x) { var o = { c: c, f: f, n: n || 0 }; if (x) for (var k in x) o[k] = x[k]; return o; }
  function SVG(vb, corps) { return '<svg viewBox="' + vb + '" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' + corps + '</svg>'; }

  /* ---------- Points ---------- */
  var P = 'points';
  BR.def('points-flottants', D(P, 'rang', 3));
  BR.def('points-rebond', D(P, 'rang', 3));
  BR.def('points-sauts', D(P, 'rang', 3));
  BR.def('points-fondu', D(P, 'rang', 3));
  BR.def('points-pouls', D(P, 'rang', 3));
  BR.def('points-respirent', D(P, 'rang', 4));
  BR.def('point-pouls', D(P, 'pose', 1));
  BR.def('points-vague', D(P, 'rang', 5));
  BR.def('points-trainee', D(P, 'rang', 5));
  BR.def('trois-points-tour', D(P, 'orbite', 3));
  BR.def('points-echange', D(P, 'orbite', 2));
  BR.def('point-glisse', D(P, 'rang', 3));
  BR.def('points-liquides', D(P, 'rang', 3, { gluant: true }));
  BR.def('points-aimantes', D(P, 'rang', 3));
  BR.def('grille-points', D(P, 'grille', 0, { g: 3 }));
  BR.def('matrice-ressort', D(P, 'grille', 0, { g: 4 }));
  BR.def('matrice', D(P, 'grille', 0, { g: 5 }));
  BR.def('bulle-ecriture', D(P, 'rang', 3));
  BR.def('couronne-points', D(P, 'orbite', 8));
  BR.def('points-tournants', D(P, 'orbite', 8));
  BR.def('anneau-points-morph', D(P, 'orbite', 8));
  BR.def('goutte', D(P, 'pose', 2));
  BR.def('orbite-fluide', D(P, 'orbite', 4, { gluant: true }));
  BR.def('point-orbite', D(P, 'orbite', 1));
  BR.def('orbite-double', D(P, 'orbite', 2));
  BR.def('cercles-orbite', D(P, 'orbite', 3));
  BR.def('points-doux', D(P, 'rang', 3));
  BR.def('pouls-orbite', D(P, 'orbite', 6));
  BR.def('zigzag', D(P, 'pose', 5));

  /* ---------- Barres ---------- */
  var B = 'barres';
  BR.def('barres-rebond', D(B, 'barres', 4));
  BR.def('barres-cascade', D(B, 'barres', 5));
  BR.def('barres-balayage', D(B, 'barres', 5));
  BR.def('barres-elastiques', D(B, 'barres', 5));
  BR.def('barres-fluides', D(B, 'barres', 5));
  BR.def('barres-morph', D(B, 'barres', 4));
  BR.def('barres-glissantes', D(B, '', 3));
  BR.def('barres-ressort', D(B, 'barres', 5));
  BR.def('barres-empilees', D(B, '', 4));
  BR.def('onde-symetrique', D(B, 'barres', 7));
  BR.def('forme-onde', D(B, 'barres', 9));
  BR.def('egaliseur', D(B, 'barres', 5));
  BR.def('onde-sonore', D(B, 'barres', 7));
  BR.def('lignes-rebond', D(B, '', 3));
  BR.def('accordeon', D(B, 'barres', 5));
  BR.def('ligne-scintillante', D(B, '', 0));
  BR.def('onde-physique', D(B, 'rang', 13, {
    init: function (el) {
      [].forEach.call(el.children, function (c, i) { c.style.setProperty('--a', Math.sin(Math.PI * i / 12).toFixed(3)); });
    }
  }));
  BR.def('onde-voix', D(B, '', 0, {
    html: '<canvas></canvas>',
    init: function (el) {
      var cv = el.querySelector('canvas'), ctx = cv.getContext('2d');
      var ondes = [{ f: 1.6, v: 2.2, a: 1, o: 1 }, { f: 2.4, v: -1.7, a: .7, o: .55 }, { f: 3.1, v: 1.3, a: .45, o: .35 }];
      boucleVisible(el, function (t) {
        var r = el.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
        var w = Math.max(1, Math.round(r.width * d)), hh = Math.max(1, Math.round(r.height * d));
        if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; }
        var cs = getComputedStyle(el), coul = cs.color, ac = cs.getPropertyValue('--br-accent').trim() || coul, s = vitesse(el);
        ctx.clearRect(0, 0, w, hh);
        ctx.lineWidth = 2 * d;
        ondes.forEach(function (o, k) {
          ctx.beginPath();
          for (var x = 0; x <= w; x += 2 * d) {
            var u = x / w, env = Math.sin(Math.PI * u);
            var y = hh / 2 + Math.sin(u * Math.PI * 2 * o.f + t * o.v * s * 2) * env * env * hh * .38 * o.a * (.75 + .25 * Math.sin(t * s * 1.3 + k));
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.globalAlpha = o.o;
          ctx.strokeStyle = k === 1 ? ac : coul;
          ctx.stroke();
        });
        ctx.globalAlpha = 1;
      });
    }
  }));
  BR.def('convoyeur', D(B, 'pose', 4));

  /* ---------- Anneaux ---------- */
  var A = 'anneaux';
  BR.def('anneau-classique', D(A));
  BR.def('anneau-double', D(A));
  BR.def('anneau-tirets', D(A, '', 0, { html: SVG('0 0 40 40', '<circle cx="20" cy="20" r="16" stroke-width="3.5" stroke-dasharray="7 5"/>') }));
  BR.def('spirale-tirets', D(A, '', 0, {
    html: function () {
      var d = '', tours = 3, pas = 120;
      for (var k = 0; k <= pas; k++) {
        var a = k / pas * tours * Math.PI * 2, r = 2 + 15 * k / pas;
        d += (k ? 'L' : 'M') + (20 + Math.cos(a) * r).toFixed(2) + ' ' + (20 + Math.sin(a) * r).toFixed(2);
      }
      return SVG('0 0 40 40', '<path d="' + d + '" stroke-width="2.4" stroke-dasharray="4 4"/>');
    }
  }));
  BR.def('deux-arcs', D(A));
  BR.def('arc-fondu', D(A));
  BR.def('arc-degrade', D(A));
  BR.def('comete', D(A));
  BR.def('traceur', D(A, '', 0, { html: SVG('0 0 40 40', '<circle cx="20" cy="20" r="16" stroke-width="4" stroke-opacity=".18"/><circle cx="20" cy="20" r="16" stroke-width="4" pathLength="100"/>') }));
  BR.def('balayage-anneau', D(A, '', 0, { html: SVG('0 0 40 40', '<circle cx="20" cy="20" r="16" stroke-width="4" stroke-opacity=".18"/><circle cx="20" cy="20" r="16" stroke-width="4" pathLength="100" stroke-dasharray="28 72"/>') }));
  BR.def('anneau-lisse', D(A));
  BR.def('anneaux-decales', D(A, 'pose', 3));
  BR.def('anneaux-concentriques', D(A, 'pose', 3));
  BR.def('pouls-concentrique', D(A, 'pose', 3));
  BR.def('anneaux-croises', D(A, 'pose', 2));
  BR.def('anneau-morph', D(A));
  BR.def('anneau-respire', D(A));
  BR.def('anneau-vibrant', D(A));
  BR.def('ondulation', D(A, 'pose', 2));
  BR.def('anneau-ressort', D(A));
  BR.def('respiration', D(A));
  BR.def('lueur-respire', D(A));
  BR.def('systeme-radial', D(A, 'pose', 3));
  BR.def('tourbillon', D(A, 'pose', 4));
  BR.def('spirale', D(A, 'orbite', 10));

  /* ---------- Rayons ---------- */
  var R = 'rayons';
  BR.def('petales', D(R, 'rayons', 12));
  BR.def('rayons-ligne', D(R, 'rayons', 8));
  BR.def('barres-circulaires', D(R, 'rayons', 12));
  BR.def('croix-tournante', D(R, 'pose', 2));
  BR.def('croix-rotation', D(R, 'pose', 2));
  BR.def('croix-expansion', D(R, 'rayons', 4));
  BR.def('montre', D(R, 'rayons', 12));
  BR.def('horloge', D(R));

  /* ---------- Formes ---------- */
  var F = 'formes';
  BR.def('carre-rebond', D(F));
  BR.def('carre-respire', D(F));
  BR.def('carre-elastique', D(F));
  BR.def('carre-retourne', D(F));
  BR.def('carre-pouls', D(F));
  BR.def('carre-arrondi', D(F));
  BR.def('carres-tournants', D(F));
  BR.def('carres-concentriques', D(F, 'pose', 3));
  BR.def('grille-carres', D(F, 'grille', 0, { g: 3 }));
  BR.def('serpent', D(F, 'grille', 0, {
    g: 3,
    init: function (el) {
      var tour = [0, 1, 2, 5, 8, 7, 6, 3];
      tour.forEach(function (idx, k) { var c = el.children[idx]; c.classList.add('br-anneau-case'); c.style.setProperty('--k', k); });
    }
  }));
  BR.def('carre-tournant', D(F));
  BR.def('carres-accordeon', D(F, 'rang', 4));
  BR.def('cube-ressort', D(F));
  BR.def('cubes-errants', D(F, 'pose', 2));
  BR.def('grille-losanges', D(F, 'grille', 0, { g: 3 }));
  BR.def('losange-ressort', D(F));
  BR.def('losange-fluide', D(F));
  BR.def('losanges-flottants', D(F, 'pose', 3));
  BR.def('triangle', D(F, '', 0, { html: SVG('0 0 40 40', '<polygon points="20,6 35,32 5,32" stroke-width="3" pathLength="100"/>') }));
  BR.def('triangle-tournant', D(F, '', 0, {
    html: SVG('0 0 40 40', '<polygon points="20,5 33,27.5 7,27.5" stroke-width="2.5" stroke-opacity=".35"/>' +
      '<circle cx="20" cy="5" r="3.5" fill="currentColor" stroke="none"/><circle cx="33" cy="27.5" r="3.5" fill="currentColor" stroke="none"/>' +
      '<circle cx="7" cy="27.5" r="3.5" stroke="none" style="fill:var(--br-accent)"/>')
  }));
  BR.def('hexagone', D(F, '', 0, {
    html: SVG('0 0 40 40', '<polygon points="20,4 33.9,12 33.9,28 20,36 6.1,28 6.1,12" stroke-width="3" stroke-opacity=".2"/>' +
      '<polygon points="20,4 33.9,12 33.9,28 20,36 6.1,28 6.1,12" stroke-width="3" pathLength="100" stroke-dasharray="30 70"/>')
  }));
  BR.def('hexagone-ressort', D(F, 'orbite', 6));
  BR.def('origami', D(F, 'pose', 4));
  BR.def('forme-morph', D(F));
  BR.def('morph-cercle-carre', D(F));
  BR.def('gouttes-gluantes', D(F, 'pose', 2, { gluant: true }));
  var INFINI = 'M32 20C24 8 8 8 8 20s16 12 24 0 24-12 24 0-16 12-24 0Z';
  BR.def('infini', D(F, '', 0, { html: SVG('0 0 64 40', '<path d="' + INFINI + '" stroke-width="3.5" stroke-opacity=".18"/><path d="' + INFINI + '" stroke-width="3.5" pathLength="100"/>') }));
  BR.def('infini-morph', D(F, '', 0, {
    gluant: true,
    html: SVG('0 0 64 40', '<path d="' + INFINI + '" stroke-width="2" stroke-opacity=".15"/><path d="' + INFINI + '" stroke-width="6" pathLength="100"/><path d="' + INFINI + '" stroke-width="5" pathLength="100" style="stroke:var(--br-accent)"/>')
  }));
  BR.def('grille-mutante', D(F, 'grille', 0, { g: 2 }));

  /* ---------- Texte ---------- */
  var T = 'texte';
  function mot(el, lu) { return '<span class="br-mot">' + echapper(lu) + '</span>'; }
  BR.def('texte-clignote', D(T, 'texte', 0, { html: mot, init: function (el) { el.classList.add('br-caret'); } }));
  BR.def('texte-points', D(T, 'texte', 0, { html: function (el, lu) { return mot(el, lu) + '<i style="--i:0">.</i><i style="--i:1">.</i><i style="--i:2">.</i>'; } }));
  BR.def('texte-morph', D(T, 'texte', 0, {
    html: '<span class="br-mot"></span>',
    init: function (el, lu) {
      var mots = el.dataset.mots ? el.dataset.mots.split('|') : [lu, 'Préparation', 'Presque prêt'], i = 0, span = el.firstChild;
      span.textContent = mots[0];
      (function suivant() {
        setTimeout(function () {
          if (!el.isConnected) return;
          span.classList.add('sort');
          setTimeout(function () {
            i = (i + 1) % mots.length;
            span.textContent = mots[i];
            span.classList.remove('sort'); span.classList.add('entre');
            void span.offsetWidth;
            span.classList.remove('entre');
            suivant();
          }, 350 / vitesse(el));
        }, 1600 / vitesse(el));
      })();
    }
  }));
  BR.def('texte-reflet', D(T, 'texte', 0, { html: mot }));
  BR.def('texte-vague', D(T, 'texte', 0, { html: function (el, lu) { return decouper(lu); } }));
  BR.def('frappe', D(T, 'texte', 0, {
    html: '<span class="br-mot"></span>',
    init: function (el, lu) {
      el.classList.add('br-caret');
      var phrases = el.dataset.mots ? el.dataset.mots.split('|') : [lu + '…', 'Connexion au serveur…', 'Presque fini…'];
      var span = el.firstChild, p = 0, k = 0, efface = false;
      (function pas() {
        if (!el.isConnected) return;
        var cible = phrases[p], v = vitesse(el), attente = 55;
        if (!efface) { k++; if (k > cible.length) { efface = true; attente = 1100; k = cible.length; } }
        else { k--; attente = 28; if (k <= 0) { efface = false; p = (p + 1) % phrases.length; attente = 300; } }
        span.textContent = cible.slice(0, Math.max(0, k));
        setTimeout(pas, attente / v);
      })();
    }
  }));
  BR.def('texte-ressort', D(T, 'texte', 0, { html: function (el, lu) { return decouper(lu); } }));
  BR.def('texte-revele', D(T, 'texte', 0, { html: mot }));
  BR.def('invite', D(T, 'texte', 0, {
    defaut: 'install',
    html: function (el, lu) { return '<span class="br-mot"><b>$</b> ' + echapper(lu) + '</span><span class="br-progres"></span>'; }
  }));

  /* ---------- Objets ---------- */
  var O = 'objets';
  function roue(cx, cy, rExt, rInt, dents, trou) {
    var d = '', n = dents * 4;
    for (var k = 0; k < n; k++) {
      var a = k / n * Math.PI * 2 - Math.PI / 2, r = (k % 4 < 2) ? rExt : rInt;
      d += (k ? 'L' : 'M') + (cx + Math.cos(a) * r).toFixed(2) + ' ' + (cy + Math.sin(a) * r).toFixed(2);
    }
    d += 'Z M' + (cx + trou) + ' ' + cy + 'a' + trou + ' ' + trou + ' 0 1 0 ' + (-2 * trou) + ' 0a' + trou + ' ' + trou + ' 0 1 0 ' + (2 * trou) + ' 0Z';
    return d;
  }
  BR.def('engrenages', D(O, '', 0, {
    html: SVG('0 0 40 40', '<g class="br-roue-1"><path d="' + roue(14, 25, 12, 9, 10, 3.2) + '" fill="currentColor" stroke="none" fill-rule="evenodd"/></g>' +
      '<g class="br-roue-2"><path d="' + roue(28.6, 11.2, 8.6, 6.2, 7, 2.4) + '" stroke="none" fill-rule="evenodd" style="fill:var(--br-accent)"/></g>')
  }));
  BR.def('sablier', D(O, '', 0, {
    html: SVG('0 0 40 40', '<path d="M10 5h20M10 35h20" stroke-width="3"/>' +
      '<path d="M12.5 6c0 8 6.5 10.5 6.5 14s-6.5 6-6.5 14M27.5 6c0 8-6.5 10.5-6.5 14s6.5 6 6.5 14" stroke-width="2.2"/>' +
      '<polygon class="br-sable-haut" points="14.5,10 25.5,10 20,18.5" stroke="none" style="fill:var(--br-accent)"/>' +
      '<line class="br-filet" x1="20" y1="19" x2="20" y2="32" stroke-width="1.2" style="stroke:var(--br-accent)"/>' +
      '<polygon class="br-sable-bas" points="20,24.5 26.5,33 13.5,33" stroke="none" style="fill:var(--br-accent)"/>')
  }));
  var ECG = '0,22 18,22 23,22 26,14 30,30 34,6 38,34 41,22 50,22 54,18 58,22 80,22';
  BR.def('ecg', D(O, '', 0, { html: SVG('0 0 80 40', '<polyline points="' + ECG + '" stroke-width="2.5" stroke-opacity=".15"/><polyline points="' + ECG + '" stroke-width="2.5" pathLength="100"/>') }));
  BR.def('coeur', D(O, '', 0, {
    html: SVG('0 0 40 40', '<path d="M20 34C8 25 3 18 3 12.5 3 7.5 7 4 11.5 4c3.5 0 6.5 2 8.5 5 2-3 5-5 8.5-5C33 4 37 7.5 37 12.5 37 18 32 25 20 34Z" stroke="none" style="fill:var(--br-coeur,#ff4d6d)"/>')
  }));
  BR.def('pendule', D(O, 'pose', 1));
  BR.def('berceau', D(O, 'pose', 5));
  BR.def('radar', D(O, 'pose', 1));
  BR.def('terminal', D(O, 'pose', 3));
  BR.def('ilot', D(O));
  BR.def('scan', D(O, 'pose', 4));
  BR.def('cadenas', D(O, '', 0, {
    html: SVG('0 0 40 40', '<path class="br-anse" d="M13 18v-6a7 7 0 0 1 14 0v6" stroke-width="3.5"/>' +
      '<g class="br-corps"><rect x="9" y="17" width="22" height="17" rx="4" fill="currentColor" stroke="none"/>' +
      '<circle cx="20" cy="25.5" r="2.6" stroke="none" style="fill:var(--br-fond)"/></g>')
  }));
  BR.def('icone-app', D(O));
  BR.def('icone-morph', D(O));
  BR.def('echelle-pouls', D(O));

  /* ---------- Squelettes ---------- */
  var S = 'squelettes';
  BR.def('squelette', D(S, '', 3, { miroir: true }));
  BR.def('squelette-profil', D(S, '', 3, { miroir: true }));
  BR.def('squelette-fluide', D(S, '', 4));
  BR.def('carte-verre', D(S, '', 3, { miroir: true }));
  BR.def('pouls', D(S));

  /* ==========================================================================
     LOT 2 — OUTILS COMMUNS
     ========================================================================== */
  function emit(el, type, detail) { el.dispatchEvent(new CustomEvent('brio:' + type, { bubbles: true, detail: detail || {} })); }
  function borne01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function ms(cs, prop, def) {
    var x = cs.getPropertyValue(prop).trim();
    if (!x) return def;
    var n = parseFloat(x);
    return isNaN(n) ? def : /ms$/.test(x) ? n : n * 1000;
  }
  function optionsTemps(el) {
    ['pas', 'duree', 'retard'].forEach(function (k) {
      var v = parseFloat(el.dataset[k]);
      if (!isNaN(v)) el.style.setProperty('--br-' + k, v + 'ms');
    });
    var v = parseFloat(el.dataset.vitesse);
    if (v > 0) el.style.setProperty('--br-v', v);
  }
  // déclencheur commun : vue (défaut), charge, manuel ; data-repete="true" rejoue à chaque entrée
  function declencher(el, entrer, sortir) {
    var mode = el.dataset.declencheur || 'vue';
    if (mode === 'manuel') return;
    if (mode === 'charge' || !('IntersectionObserver' in window)) { entrer(); return; }
    var repete = el.dataset.repete === 'true', vu = false;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { if (!vu) { vu = true; entrer(); } if (!repete) io.disconnect(); }
        else if (vu && repete) { vu = false; if (sortir) sortir(); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    io.observe(el);
  }

  /* ==========================================================================
     LOT 2 — TEXTE : data-brio-texte="effet"
     Options : data-pas, data-duree, data-retard (ms), data-vitesse,
               data-declencheur (vue | charge | manuel), data-repete="true"
     ========================================================================== */
  var TX = {}, txOrdre = [];
  var SEG = (window.Intl && Intl.Segmenter) ? new Intl.Segmenter('fr', { granularity: 'grapheme' }) : null;
  var INTERACTIF = 'a,button,input,select,textarea,label,[tabindex],[contenteditable]';
  function graphemes(s) { return SEG ? Array.from(SEG.segment(s), function (x) { return x.segment; }) : Array.from(s); }

  // niv : lettre | mot | ligne | bloc ; mode : entree | machine | boucle | survol
  function defTexte(nom, niv, mode, cat, x) {
    var d = { niv: niv, mode: mode, c: cat };
    if (x) for (var k in x) d[k] = x[k];
    if (!TX[nom]) txOrdre.push(nom);
    TX[nom] = d;
  }
  BR.defTexte = defTexte;
  BR.listeTexte = function () { return txOrdre.map(function (n) { return { nom: n, categorie: TX[n].c, mode: TX[n].mode }; }); };

  function parcourir(src, dst, d, unites) {
    [].forEach.call(src.childNodes, function (n) {
      if (n.nodeType === 3) {
        n.textContent.split(/(\s+)/).forEach(function (p) {
          if (!p) return;
          if (/^\s+$/.test(p)) { dst.appendChild(document.createTextNode(p)); return; }
          var m = document.createElement('span');
          m.className = 'br-m';
          if (d.niv === 'lettre') {
            graphemes(p).forEach(function (g) {
              var l = document.createElement('span');
              l.className = 'br-l br-u';
              l.textContent = g;
              m.appendChild(l);
              unites.push(l);
            });
            dst.appendChild(m);
          } else {
            m.textContent = p;
            m.classList.add('br-u');
            unites.push(m);
            if (d.masque) { var w = document.createElement('span'); w.className = 'br-masque'; w.appendChild(m); dst.appendChild(w); }
            else dst.appendChild(m);
          }
        });
      } else if (n.nodeType === 1) {
        var c = n.cloneNode(false);
        dst.appendChild(c);
        if (n.tagName !== 'BR') parcourir(n, c, d, unites);
      }
    });
  }

  // lignes : mesure la position de chaque mot puis regroupe par ligne (texte simple)
  function construireLignes(st, vis, unites) {
    var mots = st.source.textContent.replace(/\s+/g, ' ').trim().split(' ');
    var spans = mots.map(function (m) {
      var s = document.createElement('span');
      s.textContent = m;
      vis.appendChild(s);
      vis.appendChild(document.createTextNode(' '));
      return s;
    });
    var lignes = [], haut = null;
    spans.forEach(function (s, i) {
      var t = s.offsetTop;
      if (haut === null || Math.abs(t - haut) > 2) { lignes.push([]); haut = t; }
      lignes[lignes.length - 1].push(mots[i]);
    });
    vis.textContent = '';
    lignes.forEach(function (l) {
      var b = document.createElement('span'), u = document.createElement('span');
      b.className = 'br-ligne';
      u.className = 'br-u';
      u.textContent = l.join(' ');
      b.appendChild(u);
      vis.appendChild(b);
      unites.push(u);
    });
  }

  function construireTexte(el) {
    var st = el._brTx, d = st.d;
    if (!st.source) {
      st.source = document.createDocumentFragment();
      while (el.firstChild) st.source.appendChild(el.firstChild);
    } else {
      el.textContent = '';
    }
    var unites = [];
    if (d.niv === 'bloc') {
      el.appendChild(st.source.cloneNode(true));
      el.classList.add('br-u');
      el.style.setProperty('--i', 0);
      unites.push(el);
    } else {
      var lecteur = !st.source.querySelector(INTERACTIF);
      var vis = document.createElement('span');
      vis.className = 'br-tx-vis';
      if (lecteur) {
        var sr = document.createElement('span');
        sr.className = 'br-sr';
        sr.textContent = st.source.textContent.replace(/\s+/g, ' ').trim();
        el.appendChild(sr);
        vis.setAttribute('aria-hidden', 'true');
      }
      el.appendChild(vis);
      if (d.niv === 'ligne') construireLignes(st, vis, unites);
      else parcourir(st.source, vis, d, unites);
    }
    var n = unites.length;
    if (d.niv !== 'bloc') unites.forEach(function (u, i) {
      u.style.setProperty('--i', i);
      u.style.setProperty('--c', Math.abs(i - (n - 1) / 2));
    });
    el.style.setProperty('--n', n);
    st.unites = unites;
    st.max = d.ordre === 'centre' ? (n - 1) / 2 : Math.max(0, n - 1);
  }

  function monterTexte(el) {
    if (el._brTx) return el._brTx;
    var nom = el.getAttribute('data-brio-texte'), d = TX[nom];
    if (!d) return null;
    var st = el._brTx = { d: d, nom: nom };
    el.classList.add('br-tx', 'br-tx-' + nom, 'br-niv-' + d.niv, 'br-mode-' + d.mode);
    optionsTemps(el);
    construireTexte(el);
    if (d.niv === 'ligne' && 'ResizeObserver' in window) {
      var largeur = el.clientWidth;
      new ResizeObserver(function () {
        var w = el.clientWidth;
        if (Math.abs(w - largeur) < 2) return;
        largeur = w;
        var deja = el.classList.contains('br-fini') || el.classList.contains('br-joue');
        construireTexte(el);
        if (deja) { clearTimeout(st.tFin); el.classList.remove('br-joue'); el.classList.add('br-fini'); }
      }).observe(el);
    }
    if (d.mode === 'entree' || d.mode === 'machine') {
      el.classList.add('br-attend');
      declencher(el, function () { jouerTexte(el); }, function () {
        clearTimeout(st.tFin); clearTimeout(st.tMachine);
        el.classList.remove('br-joue', 'br-fini', 'br-tape');
        el.classList.add('br-attend');
      });
    }
    return st;
  }

  function jouerTexte(el) {
    var st = el._brTx;
    if (!st || (st.d.mode !== 'entree' && st.d.mode !== 'machine')) return;
    clearTimeout(st.tFin);
    clearTimeout(st.tMachine);
    el.classList.remove('br-attend', 'br-fini', 'br-joue');
    if (st.d.mode === 'machine') { machine(el); return; }
    el.style.setProperty('--tx-c', getComputedStyle(el).color);
    void el.offsetWidth;
    el.classList.add('br-joue');
    var cs = getComputedStyle(el), v = parseFloat(cs.getPropertyValue('--br-v')) || 1;
    var total = calme() ? 30 : (ms(cs, '--br-retard', 0) + st.max * ms(cs, '--br-pas', 30) + ms(cs, '--br-duree', 700)) / v;
    st.tFin = setTimeout(function () {
      el.classList.remove('br-joue');
      el.classList.add('br-fini');
      emit(el, 'fin');
    }, total + 80);
  }

  // machine à écrire : lettres révélées une à une, place réservée (aucun décalage)
  function machine(el) {
    var st = el._brTx, u = st.unites;
    if (!u.length) return;
    if (!st.caret) {
      st.caret = document.createElement('span');
      st.caret.className = 'br-caret-tx';
    }
    if (calme()) {
      u.forEach(function (x) { x.classList.remove('br-cache'); });
      u[u.length - 1].after(st.caret);
      emit(el, 'fin');
      return;
    }
    el.classList.add('br-tape');
    u.forEach(function (x) { x.classList.add('br-cache'); });
    u[0].before(st.caret);
    var k = 0, cs = getComputedStyle(el), v = parseFloat(cs.getPropertyValue('--br-v')) || 1, pas = ms(cs, '--br-pas', 45) / v;
    (function suite() {
      if (k >= u.length) { el.classList.remove('br-tape'); emit(el, 'fin'); return; }
      var x = u[k++];
      x.classList.remove('br-cache');
      x.after(st.caret);
      var attente = /[.,;:!?…]/.test(x.textContent) ? pas * 6 : pas * (0.55 + Math.random() * 0.9);
      st.tMachine = setTimeout(suite, attente);
    })();
  }

  var LET = 'lettres', MOT = 'mots', BLC = 'bloc', BCL = 'boucles', SVL = 'survol';
  ['fondu-lettres', 'flou-lettres', 'monte-lettres', 'descend-lettres', 'gauche-lettres', 'droite-lettres',
   'chute-lettres', 'rebond-lettres', 'echelle-lettres', 'bascule-y', 'bascule-x', 'rotation-lettres',
   'etire-x', 'etire-y', 'penche-lettres', 'ressort-lettres', 'aurore'
  ].forEach(function (n) { defTexte(n, 'lettre', 'entree', LET); });
  defTexte('cascade', 'lettre', 'entree', LET, { ordre: 'centre' });
  ['fondu-mots', 'flou-mots', 'monte-mots', 'descend-mots', 'echelle-mots', 'balance-mots', 'lecture-mots'
  ].forEach(function (n) { defTexte(n, 'mot', 'entree', MOT); });
  defTexte('leve-mots', 'mot', 'entree', MOT, { masque: true });
  ['fondu', 'monte', 'echelle', 'zoom-avant', 'zoom-arriere', 'resserre', 'ecarte', 'flou'
  ].forEach(function (n) { defTexte(n, 'bloc', 'entree', BLC); });
  defTexte('lignes', 'ligne', 'entree', BLC);
  defTexte('machine', 'lettre', 'machine', BLC);
  defTexte('reflet', 'bloc', 'boucle', BCL);
  defTexte('lueur', 'bloc', 'boucle', BCL);
  defTexte('flotte-lettres', 'lettre', 'boucle', BCL);
  defTexte('flotte-mots', 'mot', 'boucle', BCL);
  defTexte('pulse-lettres', 'lettre', 'boucle', BCL);
  defTexte('pulse-mots', 'mot', 'boucle', BCL);
  defTexte('survol-leve-lettres', 'lettre', 'survol', SVL);
  defTexte('survol-leve-mots', 'mot', 'survol', SVL);
  defTexte('survol-zoom-lettres', 'lettre', 'survol', SVL);
  defTexte('survol-zoom-mots', 'mot', 'survol', SVL);
  defTexte('survol-vague', 'lettre', 'survol', SVL);

  /* ==========================================================================
     LOT 2 — ENTRÉES : data-brio-entree="effet" ; data-brio-cascade="effet" (enfants décalés)
     ========================================================================== */
  var EN = ['fondu', 'fondu-haut', 'fondu-bas', 'glisse-gauche', 'glisse-droite', 'echelle', 'zoom-profond', 'bascule', 'revele', 'rideau'];
  BR.listeEntrees = function () { return EN.slice(); };

  function preparerEntree(el, nom, i) {
    el.classList.add('br-en', 'br-en-' + nom, 'br-attend');
    el.style.setProperty('--i', i);
    el.addEventListener('animationend', function (e) {
      if (e.target === el && el.classList.contains('br-joue')) {
        el.classList.remove('br-joue');
        el.classList.add('br-fini');
        emit(el, 'fin');
      }
    });
  }
  function jouerEntree(el) {
    el.classList.remove('br-attend', 'br-fini', 'br-joue');
    void el.offsetWidth;
    el.classList.add('br-joue');
  }
  function remettre(el) { el.classList.remove('br-joue', 'br-fini'); el.classList.add('br-attend'); }

  function monterEntree(el) {
    if (el._brEn) return;
    var nom = el.getAttribute('data-brio-entree');
    if (EN.indexOf(nom) < 0) return;
    el._brEn = { nom: nom };
    optionsTemps(el);
    preparerEntree(el, nom, 0);
    declencher(el, function () { jouerEntree(el); }, function () { remettre(el); });
  }
  function monterCascade(el) {
    if (el._brCa) return;
    var nom = el.getAttribute('data-brio-cascade');
    if (EN.indexOf(nom) < 0) nom = 'fondu-haut';
    var enfants = [].slice.call(el.children);
    el._brCa = { nom: nom, enfants: enfants };
    optionsTemps(el);
    enfants.forEach(function (c, i) { preparerEntree(c, nom, i); });
    declencher(el, function () { enfants.forEach(jouerEntree); }, function () { enfants.forEach(remettre); });
  }

  BR.rejouer = function (el) {
    if (typeof el === 'string') el = document.querySelector(el);
    if (!el) return;
    if (el._brTx) jouerTexte(el);
    if (el._brEn) jouerEntree(el);
    if (el._brCa) el._brCa.enfants.forEach(jouerEntree);
  };

  /* ==========================================================================
     LOT 2 — PROGRESSION DE DÉFILEMENT
     ========================================================================== */
  function defilable(s) {
    if (!s || s.nodeType !== 1) return false;
    var o = getComputedStyle(s).overflowY;
    return o === 'auto' || o === 'scroll';
  }
  function racineDefilement(el) {
    for (var p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      if (defilable(p) && p.scrollHeight > p.clientHeight + 1) return p;
    }
    return null;
  }
  function lireProgression(source) {
    if (!source) {
      var h = document.documentElement, m = h.scrollHeight - innerHeight;
      return m > 0 ? borne01((window.scrollY || h.scrollTop) / m) : 0;
    }
    if (defilable(source)) {
      var mm = source.scrollHeight - source.clientHeight;
      return mm > 0 ? borne01(source.scrollTop / mm) : 0;
    }
    var r = source.getBoundingClientRect(), vh = innerHeight, total = r.height - vh;
    if (total <= 0) return borne01((vh - r.top) / (vh + r.height));
    return borne01(-r.top / total);
  }
  // rappel(p) avec p entre 0 et 1 ; source : rien (page), élément défilant, ou article lu dans la page
  BR.surProgression = function (source, rappel) {
    if (typeof source === 'string') source = document.querySelector(source);
    var raf = 0;
    function maj() { raf = 0; rappel(lireProgression(source)); }
    function planifier() { if (!raf) raf = requestAnimationFrame(maj); }
    document.addEventListener('scroll', planifier, { passive: true, capture: true });
    addEventListener('resize', planifier);
    maj();
    return function () { document.removeEventListener('scroll', planifier, true); removeEventListener('resize', planifier); };
  };

  BR.def('progression', {
    composant: true,
    init: function (el) {
      var forme = el.dataset.forme === 'cercle' ? 'cercle' : 'barre';
      var source = el.dataset.source ? document.querySelector(el.dataset.source) : null;
      var pos = el.dataset.position || (source ? 'statique' : forme === 'cercle' ? 'coin' : 'haut');
      var remonter = forme === 'cercle' && el.dataset.remonter !== 'false';
      var t = el.dataset.taille;
      if (t) el.style.setProperty('--br-taille', /^\d+(\.\d+)?$/.test(t) ? t + 'px' : t);
      if (parseFloat(el.dataset.epaisseur) > 0) el.style.setProperty('--br-epaisseur', parseFloat(el.dataset.epaisseur) + 'px');
      el.classList.add('br-pg-' + forme, 'br-pg-' + pos);
      var cible = el, pc = null;
      if (forme === 'cercle') {
        el.innerHTML = (remonter ? '<button type="button" class="br-pg-bouton">' : '<span class="br-pg-bouton">') +
          '<svg viewBox="0 0 44 44" aria-hidden="true"><circle class="br-pg-piste" cx="22" cy="22" r="19"/>' +
          '<circle class="br-pg-arc" cx="22" cy="22" r="19" pathLength="100"/></svg><span class="br-pg-pc" aria-hidden="true">0</span>' +
          (remonter ? '</button>' : '</span>');
        pc = el.querySelector('.br-pg-pc');
        if (remonter) {
          cible = el.firstChild;
          cible.addEventListener('click', function () {
            var o = { top: 0, behavior: calme() ? 'auto' : 'smooth' };
            if (source && defilable(source)) source.scrollTo(o);
            else if (source) source.scrollIntoView({ behavior: o.behavior });
            else window.scrollTo(o);
          });
        }
      }
      if (!remonter) {
        el.setAttribute('role', 'progressbar');
        el.setAttribute('aria-valuemin', '0');
        el.setAttribute('aria-valuemax', '100');
        if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', 'Progression de lecture');
      }
      var dernier = -1;
      var arret = BR.surProgression(source, function (p) {
        el.style.setProperty('--br-p', p.toFixed(4));
        el.classList.toggle('br-visible', pos === 'statique' || p > 0.03);
        var n = Math.round(p * 100);
        if (n === dernier) return;
        dernier = n;
        if (pc) pc.textContent = n;
        if (remonter) cible.setAttribute('aria-label', 'Remonter (' + n + ' % lu)');
        else el.setAttribute('aria-valuenow', n);
      });
      return { arreter: arret };
    }
  });

  /* ==========================================================================
     LOT 2 — DÉFILEMENT COLLANT : visuel collant + étapes qui défilent
     <div data-brio="defilement-collant"><div data-visuels>…</div><div data-etapes>…</div></div>
     ========================================================================== */
  BR.def('defilement-collant', {
    composant: true,
    init: function (el) {
      var vis = el.querySelector('[data-visuels]') || el.children[0];
      var et = el.querySelector('[data-etapes]') || el.children[1];
      if (!vis || !et) return {};
      vis.classList.add('br-dc-visuels');
      et.classList.add('br-dc-etapes');
      var visuels = [].slice.call(vis.children), etapes = [].slice.call(et.children);
      var points = document.createElement('span');
      points.className = 'br-dc-points';
      points.setAttribute('aria-hidden', 'true');
      etapes.forEach(function () { points.appendChild(document.createElement('i')); });
      vis.appendChild(points);
      var actif = -1;
      function activer(i) {
        if (i === actif) return;
        actif = i;
        var iv = Math.min(i, visuels.length - 1);
        etapes.forEach(function (x, k) { x.classList.toggle('br-actif', k === i); });
        visuels.forEach(function (x, k) {
          x.classList.toggle('br-actif', k === iv);
          if (k === iv) x.removeAttribute('aria-hidden'); else x.setAttribute('aria-hidden', 'true');
        });
        [].forEach.call(points.children, function (p, k) { p.classList.toggle('br-actif', k === i); });
        el.style.setProperty('--br-dc-i', i);
        emit(el, 'etape', { index: i });
      }
      var raf = 0;
      function mesurer() {
        raf = 0;
        var racine = racineDefilement(el), ligne;
        if (racine) { var rr = racine.getBoundingClientRect(); ligne = rr.top + rr.height * 0.5; }
        else ligne = innerHeight * 0.5;
        var meilleur = 0, dist = Infinity;
        etapes.forEach(function (x, k) {
          var r = x.getBoundingClientRect(), dd = Math.abs(r.top + r.height / 2 - ligne);
          if (dd < dist) { dist = dd; meilleur = k; }
        });
        activer(meilleur);
      }
      function planifier() { if (!raf) raf = requestAnimationFrame(mesurer); }
      document.addEventListener('scroll', planifier, { passive: true, capture: true });
      addEventListener('resize', planifier);
      if ('ResizeObserver' in window) new ResizeObserver(function () {
        el.classList.toggle('br-etroit', el.clientWidth < 560);
        planifier();
      }).observe(el);
      else el.classList.toggle('br-etroit', el.clientWidth < 560);
      mesurer();
      return { aller: function (i) { if (etapes[i]) etapes[i].scrollIntoView({ behavior: calme() ? 'auto' : 'smooth', block: 'center' }); } };
    }
  });

  /* ==========================================================================
     LOT 2 — TRANSITIONS DE PAGE
     Brio.transition(action, { style: rideau|iris|volets|fondu, x, y, couleur }) → Promise
     Liens automatiques : data-brio-transition="style" sur le lien ou un ancêtre (ex. <body>)
     ========================================================================== */
  var VOILES = { rideau: 600, iris: 620, volets: 740, fondu: 220 };
  function creerVoile(style, x, y) {
    var v = document.createElement('div');
    v.className = 'br-voile br-voile-' + style;
    v.setAttribute('aria-hidden', 'true');
    if (style === 'volets') for (var i = 0; i < 5; i++) { var b = document.createElement('i'); b.style.setProperty('--i', i); v.appendChild(b); }
    v.style.setProperty('--vx', (x == null ? innerWidth / 2 : x) + 'px');
    v.style.setProperty('--vy', (y == null ? innerHeight / 2 : y) + 'px');
    document.body.appendChild(v);
    return v;
  }
  function phase(v, style, classe) {
    return new Promise(function (ok) {
      v.classList.remove('br-couvre', 'br-decouvre', 'br-plein');
      void v.offsetWidth;
      v.classList.add(classe);
      setTimeout(ok, VOILES[style] + 30);
    });
  }
  BR.transition = function (action, o) {
    o = o || {};
    var style = VOILES[o.style] ? o.style : 'rideau';
    if (calme()) style = 'fondu';
    var v = creerVoile(style, o.x, o.y);
    if (o.couleur) v.style.setProperty('--br-voile', o.couleur);
    return phase(v, style, 'br-couvre')
      .then(function () { return action ? action() : null; })
      .then(function () { return phase(v, style, 'br-decouvre'); })
      .then(function () { v.remove(); });
  };
  function initTransitions() {
    var arrivee = null;
    try { arrivee = sessionStorage.getItem('brio-transition'); sessionStorage.removeItem('brio-transition'); } catch (_) {}
    if (arrivee) {
      var style = calme() || !VOILES[arrivee] ? 'fondu' : arrivee;
      var v = creerVoile(style);
      v.classList.add('br-plein');
      document.documentElement.classList.remove('br-arrivee');
      requestAnimationFrame(function () { phase(v, style, 'br-decouvre').then(function () { v.remove(); }); });
    } else {
      document.documentElement.classList.remove('br-arrivee');
    }
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      var hote = a.closest('[data-brio-transition]');
      if (!hote || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      var url;
      try { url = new URL(a.href, location.href); } catch (_) { return; }
      if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      e.preventDefault();
      var st = hote.getAttribute('data-brio-transition') || 'rideau';
      try { sessionStorage.setItem('brio-transition', st); } catch (_) {}
      BR.transition(function () { location.href = url.href; return new Promise(function () {}); }, { style: st, x: e.clientX, y: e.clientY });
    });
    addEventListener('pageshow', function (e) {
      if (e.persisted) [].forEach.call(document.querySelectorAll('.br-voile'), function (x) { x.remove(); });
    });
  }

  /* ==========================================================================
     LOT 2 — RESSORTS, POINTEUR, VIBRATIONS
     ========================================================================== */
  // courbe de ressort pour CSS : linear(…) ; amorti 0–1 (petit = plus de rebond), frequence ≈ 8–20
  BR.courbeRessort = function (o) {
    o = o || {};
    var z = o.amorti == null ? 0.5 : o.amorti, w = o.frequence || 12, n = o.points || 48, pts = [];
    var wd = w * Math.sqrt(Math.max(1e-6, 1 - z * z));
    for (var k = 0; k <= n; k++) {
      var t = k / n;
      var x = z < 1
        ? 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t))
        : 1 - Math.exp(-w * t) * (1 + w * t);
      pts.push(k === n ? 1 : +x.toFixed(3));
    }
    return 'linear(' + pts.join(', ') + ')';
  };

  // rappel({ x, y, nx, ny, dedans }) — coordonnées du pointeur relatives à l'élément
  BR.suivrePointeur = function (el, rappel) {
    function f(e) {
      var r = el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      rappel({ x: x, y: y, nx: r.width ? x / r.width : 0, ny: r.height ? y / r.height : 0, dedans: x >= 0 && y >= 0 && x <= r.width && y <= r.height });
    }
    addEventListener('pointermove', f, { passive: true });
    return function () { removeEventListener('pointermove', f); };
  };

  var MOTIFS = { selection: [6], leger: [10], moyen: [20], fort: [35], succes: [12, 70, 20], alerte: [25, 90, 25], erreur: [40, 60, 40, 60, 40] };
  BR.motifsVibration = Object.keys(MOTIFS);
  var IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var bascule = null;
  // Android / Chrome : navigator.vibrate. iOS 18+ : petit tic via un interrupteur natif caché (non garanti).
  BR.vibre = function (motif) {
    var p = Array.isArray(motif) ? motif : (MOTIFS[motif] || MOTIFS.leger);
    if (typeof navigator.vibrate === 'function') {
      try { return navigator.vibrate(p); } catch (_) { return false; }
    }
    if (IOS && document.body) {
      if (!bascule) {
        bascule = document.createElement('label');
        bascule.setAttribute('aria-hidden', 'true');
        bascule.style.cssText = 'position:fixed;left:-100px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
        bascule.innerHTML = '<input type="checkbox" switch tabindex="-1">';
        document.body.appendChild(bascule);
      }
      var t = 0;
      for (var i = 0; i < p.length; i += 2) {
        (function (d) { setTimeout(function () { bascule.click(); }, d); })(t);
        t += p[i] + (p[i + 1] || 0);
      }
      return true;
    }
    return false;
  };

  /* ==========================================================================
     LOT 3 — CONTRÔLES : interrupteurs et formulaires (contrôles natifs améliorés)
     ========================================================================== */
  var nCtl = 0;
  function idCtl(p) { return 'br' + p + (++nCtl); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function relancer(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  BR.listeControles = function () {
    return ordre.filter(function (n) { return defs[n].controle; }).map(function (n) { return { nom: n, categorie: defs[n].c }; });
  };
  function controle(nom, cat, init) { BR.def(nom, { composant: true, controle: true, c: cat, init: init }); }
  // enveloppe un <input> dans un <span> de décor ; l'input reste au-dessus, transparent, cliquable et focalisable
  function envelopper(input, cls, deco) {
    var w = document.createElement('span');
    w.className = 'br-ctl ' + cls;
    input.parentNode.insertBefore(w, input);
    w.appendChild(input);
    if (deco) w.insertAdjacentHTML('beforeend', deco);
    [].forEach.call(w.children, function (c) { if (c !== input) c.setAttribute('aria-hidden', 'true'); });
    return w;
  }
  function SVC(corps, cls) {
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + corps + '</svg>';
  }
  var COCHE = '<path d="M5.5 12.5l4 4L18.5 7.5" pathLength="100"/>';
  var CHEVRON = SVC('<path d="M7 10l5 5 5-5"/>', 'br-chev');

  /* ---------- Interrupteurs (input type=checkbox) ---------- */
  function interrupteur(nom, deco, x) {
    x = x || {};
    controle(nom, 'interrupteurs', function (el) {
      if (el.tagName !== 'INPUT') return {};
      var w = envelopper(el, 'br-it br-it-' + nom + (x.cls ? ' ' + x.cls : ''), deco);
      if (x.role !== false) el.setAttribute('role', 'switch');
      var cpt = w.querySelector('.br-it-cpt'), n = parseFloat(el.dataset.nombre);
      if (cpt) { if (isNaN(n)) cpt.remove(); else cpt.textContent = n; }
      el.addEventListener('change', function () {
        relancer(w, 'br-tic');
        if (cpt && !isNaN(n)) { n += el.checked ? 1 : -1; cpt.textContent = n; relancer(cpt, 'br-tic'); }
        emit(el, 'change', { actif: el.checked });
        if (x.change) x.change(el, w);
      });
      if (x.init) x.init(el, w);
      return {};
    });
  }
  interrupteur('interrupteur-rebond', '<span class="br-it-piste"><span class="br-it-bouton"></span></span>');
  interrupteur('interrupteur-plein', '<span class="br-it-piste"><span class="br-it-bouton"></span></span>');
  interrupteur('interrupteur-carre', '<span class="br-it-piste"><span class="br-it-on">I</span><span class="br-it-off">O</span><span class="br-it-bouton"></span></span>');
  interrupteur('interrupteur-courbe',
    '<svg class="br-it-arc" viewBox="0 0 60 34"><path class="br-it-arc-fond" d="M8 27A22 22 0 0 1 52 27"/><path class="br-it-arc-plein" d="M8 27A22 22 0 0 1 52 27" pathLength="100"/></svg><span class="br-it-bouton"></span>');
  interrupteur('bascule-morph', '<span class="br-it-piste"><span class="br-it-bouton">' + SVC('<path class="br-bm-tiret" d="M8 12h8"/><path class="br-bm-coche" d="M7 12.5l3.2 3.2L17 9" pathLength="100"/>') + '</span></span>');
  interrupteur('coche-trace', '<span class="br-ct-rond"></span>' + SVC(COCHE, 'br-ct-svg'), { role: false });
  interrupteur('bascule-theme',
    '<span class="br-it-piste"><i class="br-bt-nuage n1"></i><i class="br-bt-nuage n2"></i><i class="br-bt-etoile e1"></i><i class="br-bt-etoile e2"></i><i class="br-bt-etoile e3"></i>' +
    '<span class="br-it-bouton"><i class="br-bt-cratere c1"></i><i class="br-bt-cratere c2"></i></span></span>', {
      init: function (el) {
        if (!el.hasAttribute('data-applique')) return;
        var t = document.documentElement.getAttribute('data-theme');
        el.checked = t ? t === 'dark' : !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
      },
      change: function (el) {
        if (!el.hasAttribute('data-applique')) return;
        document.documentElement.setAttribute('data-theme', el.checked ? 'dark' : 'light');
        try { localStorage.setItem('brio-theme', el.checked ? 'dark' : 'light'); } catch (_) {}
      }
    });
  var COEUR24 = 'M12 20.3C6.4 16.4 3 13 3 9.4 3 6.9 5 5 7.4 5c1.9 0 3.5 1 4.6 2.6C13.1 6 14.7 5 16.6 5 19 5 21 6.9 21 9.4c0 3.6-3.4 7-9 10.9Z';
  var SIGNET = 'M6.5 3.5h11v17l-5.5-4-5.5 4Z';
  var POUCE = 'M7.5 13.5V4.5h-3v9ZM7.5 13.5l3.6 6.5c1.4 0 2.4-1.2 2.1-2.5L12.6 14h5.3a2 2 0 0 0 2-2.3l-1.1-5.6a2 2 0 0 0-2-1.6H7.5';
  function action(nom, forme, extra, cls) {
    interrupteur(nom, SVC(extra + '<path class="br-ac-trait" d="' + forme + '"/><path class="br-ac-plein" d="' + forme + '" fill="currentColor" stroke="none"/>', 'br-ac-svg') +
      '<span class="br-it-cpt"></span>', { role: false, cls: 'br-action' + (cls ? ' ' + cls : '') });
  }
  var ECLATS = (function () {
    var s = '<circle class="br-ac-onde" cx="12" cy="12.5" r="9"/>';
    for (var k = 0; k < 6; k++) {
      var a = (k * 60 - 90) * Math.PI / 180;
      s += '<line class="br-ac-eclat" x1="' + (12 + Math.cos(a) * 9.5).toFixed(2) + '" y1="' + (12.5 + Math.sin(a) * 9.5).toFixed(2) + '" x2="' + (12 + Math.cos(a) * 12).toFixed(2) + '" y2="' + (12.5 + Math.sin(a) * 12).toFixed(2) + '"/>';
    }
    return s;
  })();
  action('action-signet', SIGNET, '');
  action('action-jaime', COEUR24, ECLATS);
  action('action-jaime-pas', POUCE, '');
  interrupteur('action-repartage', SVC('<g class="br-rp-fleches"><path d="M5 11V9a2 2 0 0 1 2-2h11"/><path d="M15.5 4.5 18 7l-2.5 2.5"/><path d="M19 13v2a2 2 0 0 1-2 2H6"/><path d="M8.5 19.5 6 17l2.5-2.5"/></g>', 'br-ac-svg') +
    '<span class="br-it-cpt"></span>', { role: false, cls: 'br-action' });

  /* ---------- Onglets en pilule (groupe de boutons radio) ---------- */
  controle('onglets-pilule', 'interrupteurs', function (el) {
    el.classList.add('br-op');
    if (!el.hasAttribute('role')) el.setAttribute('role', 'radiogroup');
    var ind = document.createElement('span');
    ind.className = 'br-op-indicateur';
    ind.setAttribute('aria-hidden', 'true');
    el.insertBefore(ind, el.firstChild);
    var radios = [].slice.call(el.querySelectorAll('input[type="radio"]'));
    var premier = true;
    function placer() {
      var r = radios.filter(function (x) { return x.checked; })[0];
      var lab = r && r.closest('label');
      radios.forEach(function (x) { var l = x.closest('label'); if (l) l.classList.toggle('br-actif', x === r); });
      if (!lab) { ind.style.opacity = '0'; return; }
      ind.style.opacity = '1';
      ind.style.width = lab.offsetWidth + 'px';
      ind.style.transform = 'translateX(' + lab.offsetLeft + 'px)';
      if (premier) { premier = false; return; }
      relancer(ind, 'br-tic');
    }
    radios.forEach(function (x) {
      x.addEventListener('change', function () { placer(); emit(el, 'change', { valeur: x.value }); });
    });
    if ('ResizeObserver' in window) new ResizeObserver(function () { premier = true; placer(); }).observe(el);
    placer();
    return { placer: placer };
  });

  /* ---------- Champs ---------- */
  function champDe(el, sel) { return el.matches(sel) ? el : el.querySelector(sel); }
  function emballage(el, champ, cls) {
    if (el !== champ) { el.classList.add(cls); return el; }
    var w = document.createElement('div');
    w.className = cls;
    champ.parentNode.insertBefore(w, champ);
    w.appendChild(champ);
    return w;
  }

  controle('champ-flottant', 'formulaires', function (el) {
    var c = champDe(el, 'input, textarea');
    if (!c) return {};
    var w = emballage(el, c, 'br-cf');
    if (c.tagName === 'TEXTAREA') w.classList.add('br-cf-zone');
    if (!c.getAttribute('placeholder')) c.setAttribute('placeholder', ' ');
    else if (c.getAttribute('placeholder').trim()) w.classList.add('br-cf-garde');
    return {};
  });

  controle('champ-lueur', 'formulaires', function (el) {
    var c = champDe(el, 'input, textarea, select');
    if (!c) return {};
    emballage(el, c, 'br-cl');
    return {};
  });

  controle('mot-de-passe', 'formulaires', function (el) {
    var c = champDe(el, 'input');
    if (!c) return {};
    var w = emballage(el, c, 'br-mdp');
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'br-mdp-oeil';
    b.setAttribute('aria-label', 'Afficher le mot de passe');
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = SVC('<path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>' +
      '<path class="br-mdp-barre" d="M4 4l16 16" pathLength="100"/>');
    c.insertAdjacentElement('afterend', b);
    b.addEventListener('click', function () {
      var voir = c.type === 'password', s = c.selectionStart, f = c.selectionEnd;
      c.type = voir ? 'text' : 'password';
      b.setAttribute('aria-pressed', String(voir));
      b.setAttribute('aria-label', voir ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
      relancer(c, 'br-mdp-bascule');
      try { if (s != null) c.setSelectionRange(s, f); } catch (_) {}
    });
    var forceAttr = el.hasAttribute('data-force') || c.hasAttribute('data-force');
    if (forceAttr) {
      var m = document.createElement('div');
      m.className = 'br-mdp-force';
      m.innerHTML = '<span class="br-mdp-barres" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="br-mdp-txt" aria-live="polite"></span>';
      w.insertAdjacentElement('afterend', m);
      var NIV = ['', 'Faible', 'Moyen', 'Bon', 'Excellent'];
      c.addEventListener('input', function () {
        var v = c.value, sc = 0;
        if (v.length >= 8) sc++;
        if (/[a-z]/.test(v) && /[A-Z]/.test(v)) sc++;
        if (/\d/.test(v)) sc++;
        if (/[^A-Za-z0-9]/.test(v)) sc++;
        if (v.length >= 12) sc++;
        var niv = v ? Math.max(1, Math.min(4, sc)) : 0;
        m.dataset.niveau = niv;
        m.querySelector('.br-mdp-txt').textContent = NIV[niv];
      });
    }
    return {};
  });

  controle('recherche-extensible', 'formulaires', function (el) {
    var c = champDe(el, 'input');
    if (!c) return {};
    var w = emballage(el, c, 'br-re');
    if (!c.getAttribute('aria-label') && !(c.id && document.querySelector('label[for="' + c.id + '"]'))) c.setAttribute('aria-label', 'Rechercher');
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'br-re-loupe';
    b.setAttribute('aria-label', 'Ouvrir la recherche');
    b.setAttribute('aria-expanded', 'false');
    b.innerHTML = SVC('<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>');
    w.insertBefore(b, c);
    c.tabIndex = -1;
    function ouvrir(v) {
      w.classList.toggle('br-ouvert', v);
      b.setAttribute('aria-expanded', String(v));
      b.setAttribute('aria-label', v ? 'Lancer la recherche' : 'Ouvrir la recherche');
      c.tabIndex = v ? 0 : -1;
      if (v) setTimeout(function () { c.focus(); }, 30);
    }
    b.addEventListener('click', function () {
      if (!w.classList.contains('br-ouvert')) { ouvrir(true); return; }
      if (c.value.trim()) emit(el, 'recherche', { valeur: c.value.trim() });
      else ouvrir(false);
    });
    c.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); if (c.value.trim()) emit(el, 'recherche', { valeur: c.value.trim() }); }
      if (e.key === 'Escape') { c.value = ''; ouvrir(false); b.focus(); }
    });
    c.addEventListener('blur', function () {
      setTimeout(function () { if (!c.value && !w.contains(document.activeElement)) ouvrir(false); }, 120);
    });
    return { ouvrir: ouvrir };
  });

  controle('case-trace', 'formulaires', function (el) {
    var c = champDe(el, 'input[type="checkbox"]');
    if (!c) return {};
    var boite = 'M6 3.5h12a2.5 2.5 0 0 1 2.5 2.5v12a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 18V6A2.5 2.5 0 0 1 6 3.5Z';
    var w = envelopper(c, 'br-ct', SVC('<path class="br-ct-fond" d="' + boite + '"/><path class="br-ct-trace" d="' + boite + '" pathLength="100"/>' +
      '<path class="br-ct-coche" d="M7.5 12.3l3 3L16.8 9" pathLength="100"/>'));
    c.addEventListener('change', function () { relancer(w, 'br-tic'); emit(c, 'change', { actif: c.checked }); });
    return {};
  });

  controle('radio-echelle', 'formulaires', function (el) {
    var c = champDe(el, 'input[type="radio"]');
    if (!c) return {};
    var w = envelopper(c, 'br-re-radio', '<span class="br-rd-anneau"></span><span class="br-rd-point"></span>');
    c.addEventListener('change', function () {
      relancer(w, 'br-tic');
      emit(c, 'change', { valeur: c.value });
    });
    return {};
  });

  controle('champ-verifie', 'formulaires', function (el) {
    var c = champDe(el, 'input, textarea, select');
    if (!c) return {};
    var w = emballage(el, c, 'br-cv');
    var msg = document.createElement('p');
    msg.className = 'br-cv-msg';
    msg.id = idCtl('cv');
    msg.setAttribute('aria-live', 'polite');
    var ic = document.createElement('span');
    ic.className = 'br-cv-ic';
    ic.setAttribute('aria-hidden', 'true');
    ic.innerHTML = SVC('<circle cx="12" cy="12" r="9.2" pathLength="100"/><path d="M8 12.3l2.7 2.7L16.2 9.4" pathLength="100"/>');
    c.insertAdjacentElement('afterend', ic);
    w.insertAdjacentElement('afterend', msg);
    var ids = (c.getAttribute('aria-describedby') || '').split(' ').filter(Boolean);
    ids.push(msg.id);
    c.setAttribute('aria-describedby', ids.join(' '));
    var touche = false;
    function verifier(montrer) {
      var vide = !String(c.value).trim(), valide = c.validity.valid;
      var ok = valide && !vide;
      w.classList.toggle('br-ok', ok);
      if (valide) {
        w.classList.remove('br-erreur');
        c.removeAttribute('aria-invalid');
        msg.textContent = '';
        msg.classList.remove('br-visible');
      } else if (montrer) {
        var deja = w.classList.contains('br-erreur');
        w.classList.add('br-erreur');
        c.setAttribute('aria-invalid', 'true');
        msg.textContent = c.dataset.message || c.validationMessage;
        msg.classList.add('br-visible');
        if (!deja || montrer === 'secoue') relancer(w, 'br-secoue');
      }
    }
    c.addEventListener('blur', function () { touche = true; verifier(true); });
    c.addEventListener('input', function () { verifier(touche && w.classList.contains('br-erreur')); });
    c.addEventListener('invalid', function (e) {
      e.preventDefault();
      touche = true;
      verifier('secoue');
      var f = c.form;
      if (f && !f._brFocus) { f._brFocus = true; c.focus(); setTimeout(function () { f._brFocus = false; }, 50); }
    });
    return { verifier: verifier };
  });

  controle('liste-deroulante', 'formulaires', function (el) {
    var sel = champDe(el, 'select');
    if (!sel || sel.multiple) return {};
    var w = document.createElement('div');
    w.className = 'br-ld';
    sel.parentNode.insertBefore(w, sel);
    w.appendChild(sel);
    sel.classList.add('br-natif');
    sel.tabIndex = -1;
    sel.setAttribute('aria-hidden', 'true');
    var id = idCtl('ld'), options = [].slice.call(sel.options);
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'br-ld-bouton';
    b.id = id + '-b';
    b.setAttribute('aria-haspopup', 'listbox');
    b.setAttribute('aria-expanded', 'false');
    b.setAttribute('aria-controls', id + '-l');
    b.innerHTML = '<span class="br-ld-valeur" id="' + id + '-v"></span>' + CHEVRON;
    var lab = sel.id ? document.querySelector('label[for="' + sel.id + '"]') : null;
    var liste = document.createElement('ul');
    liste.className = 'br-ld-liste';
    liste.id = id + '-l';
    liste.setAttribute('role', 'listbox');
    liste.tabIndex = -1;
    if (lab) {
      if (!lab.id) lab.id = id + '-e';
      b.setAttribute('aria-labelledby', lab.id + ' ' + id + '-v');
      liste.setAttribute('aria-labelledby', lab.id);
      lab.addEventListener('click', function (e) { e.preventDefault(); b.focus(); });
    } else if (sel.getAttribute('aria-label')) {
      b.setAttribute('aria-label', sel.getAttribute('aria-label'));
      liste.setAttribute('aria-label', sel.getAttribute('aria-label'));
    }
    options.forEach(function (o, i) {
      var li = document.createElement('li');
      li.id = id + '-o' + i;
      li.setAttribute('role', 'option');
      li.dataset.i = i;
      li.innerHTML = SVC(COCHE, 'br-ld-coche') + '<span>' + esc(o.textContent) + '</span>';
      if (o.disabled) li.setAttribute('aria-disabled', 'true');
      liste.appendChild(li);
    });
    w.appendChild(b);
    w.appendChild(liste);
    var actif = 0, ouvert = false, tampon = '', tT = 0;
    function maj() {
      var o = options[sel.selectedIndex];
      w.querySelector('.br-ld-valeur').textContent = o ? o.textContent : '';
      w.classList.toggle('br-vide', !o || o.value === '');
      [].forEach.call(liste.children, function (li, i) { li.setAttribute('aria-selected', String(i === sel.selectedIndex)); });
    }
    function surligner(i) {
      if (!options[i]) return;
      actif = i;
      [].forEach.call(liste.children, function (li, k) { li.classList.toggle('br-actif', k === i); });
      liste.setAttribute('aria-activedescendant', liste.children[i].id);
      var li = liste.children[i];
      if (li.offsetTop < liste.scrollTop) liste.scrollTop = li.offsetTop - 4;
      else if (li.offsetTop + li.offsetHeight > liste.scrollTop + liste.clientHeight) liste.scrollTop = li.offsetTop + li.offsetHeight - liste.clientHeight + 4;
    }
    function ouvrir() {
      if (ouvert) return;
      ouvert = true;
      var r = b.getBoundingClientRect(), bas = innerHeight - r.bottom;
      w.classList.toggle('br-haut', bas < 240 && r.top > bas);
      w.classList.add('br-ouvert');
      b.setAttribute('aria-expanded', 'true');
      surligner(Math.max(0, sel.selectedIndex));
      liste.focus({ preventScroll: true });
    }
    function fermer(focus) {
      if (!ouvert) return;
      ouvert = false;
      w.classList.remove('br-ouvert');
      b.setAttribute('aria-expanded', 'false');
      if (focus) b.focus();
    }
    function choisir(i) {
      var o = options[i];
      if (!o || o.disabled) return;
      if (sel.selectedIndex !== i) { sel.selectedIndex = i; sel.dispatchEvent(new Event('change', { bubbles: true })); }
      maj();
      fermer(true);
    }
    function deplacer(d) {
      var i = actif;
      do { i += d; } while (options[i] && options[i].disabled);
      if (options[i]) surligner(i);
    }
    b.addEventListener('click', function () { if (ouvert) fermer(true); else ouvrir(); });
    b.addEventListener('keydown', function (e) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].indexOf(e.key) >= 0) { e.preventDefault(); ouvrir(); }
    });
    liste.addEventListener('keydown', function (e) {
      var k = e.key;
      if (k === 'ArrowDown') { e.preventDefault(); deplacer(1); }
      else if (k === 'ArrowUp') { e.preventDefault(); deplacer(-1); }
      else if (k === 'Home') { e.preventDefault(); actif = -1; deplacer(1); }
      else if (k === 'End') { e.preventDefault(); actif = options.length; deplacer(-1); }
      else if (k === 'Enter' || k === ' ') { e.preventDefault(); choisir(actif); }
      else if (k === 'Escape') { e.preventDefault(); fermer(true); }
      else if (k === 'Tab') fermer(false);
      else if (k.length === 1 && /\S/.test(k)) {
        tampon += k.toLowerCase();
        clearTimeout(tT);
        tT = setTimeout(function () { tampon = ''; }, 600);
        for (var j = 1; j <= options.length; j++) {
          var idx = (actif + (tampon.length > 1 ? 0 : j)) % options.length;
          if (!options[idx].disabled && options[idx].textContent.trim().toLowerCase().indexOf(tampon) === 0) { surligner(idx); break; }
        }
      }
    });
    liste.addEventListener('click', function (e) { var li = e.target.closest('[role="option"]'); if (li) choisir(+li.dataset.i); });
    liste.addEventListener('pointermove', function (e) {
      var li = e.target.closest('[role="option"]');
      if (li && +li.dataset.i !== actif && li.getAttribute('aria-disabled') !== 'true') surligner(+li.dataset.i);
    });
    document.addEventListener('pointerdown', function (e) { if (ouvert && !w.contains(e.target)) fermer(false); });
    sel.addEventListener('change', maj);
    if (sel.form) sel.form.addEventListener('reset', function () { setTimeout(maj, 0); });
    maj();
    return { ouvrir: ouvrir, fermer: fermer };
  });

  controle('choix-multiples', 'formulaires', function (el) {
    var sel = champDe(el, 'select');
    if (!sel || !sel.multiple) return {};
    var w = document.createElement('div');
    w.className = 'br-cm';
    sel.parentNode.insertBefore(w, sel);
    w.appendChild(sel);
    sel.classList.add('br-natif');
    sel.tabIndex = -1;
    sel.setAttribute('aria-hidden', 'true');
    var id = idCtl('cm'), options = [].slice.call(sel.options);
    var lab = sel.id ? document.querySelector('label[for="' + sel.id + '"]') : null;
    if (lab && !lab.id) lab.id = id + '-e';
    var puces = document.createElement('div');
    puces.className = 'br-cm-puces';
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'br-cm-bouton';
    b.setAttribute('aria-haspopup', 'listbox');
    b.setAttribute('aria-expanded', 'false');
    b.setAttribute('aria-controls', id + '-l');
    if (lab) b.setAttribute('aria-labelledby', lab.id);
    else b.setAttribute('aria-label', sel.getAttribute('aria-label') || 'Choisir');
    b.innerHTML = '<span>' + esc(sel.dataset.indice || el.dataset.indice || 'Ajouter…') + '</span>' + CHEVRON;
    puces.appendChild(b);
    var liste = document.createElement('ul');
    liste.className = 'br-ld-liste br-cm-liste';
    liste.id = id + '-l';
    liste.setAttribute('role', 'listbox');
    liste.setAttribute('aria-multiselectable', 'true');
    liste.tabIndex = -1;
    if (lab) liste.setAttribute('aria-labelledby', lab.id);
    options.forEach(function (o, i) {
      var li = document.createElement('li');
      li.id = id + '-o' + i;
      li.setAttribute('role', 'option');
      li.dataset.i = i;
      li.innerHTML = '<span class="br-cm-case">' + SVC(COCHE) + '</span><span>' + esc(o.textContent) + '</span>';
      if (o.disabled) li.setAttribute('aria-disabled', 'true');
      liste.appendChild(li);
    });
    w.appendChild(puces);
    w.appendChild(liste);
    var actif = 0, ouvert = false, presentes = {};
    function rendre() {
      options.forEach(function (o, i) {
        liste.children[i].setAttribute('aria-selected', String(o.selected));
        var p = presentes[i];
        if (o.selected && !p) {
          p = document.createElement('span');
          p.className = 'br-cm-puce br-entre';
          p.innerHTML = '<span>' + esc(o.textContent) + '</span><button type="button" aria-label="Retirer ' + esc(o.textContent) + '">' + SVC('<path d="M7 7l10 10M17 7 7 17"/>') + '</button>';
          p.querySelector('button').addEventListener('click', function (e) { e.stopPropagation(); basculer(i); b.focus(); });
          puces.insertBefore(p, b);
          presentes[i] = p;
          setTimeout(function () { p.classList.remove('br-entre'); }, 400);
        } else if (!o.selected && p) {
          delete presentes[i];
          p.classList.add('br-sort');
          setTimeout(function () { p.remove(); }, calme() ? 0 : 220);
        }
      });
      w.classList.toggle('br-vide', !options.some(function (o) { return o.selected; }));
    }
    function basculer(i) {
      var o = options[i];
      if (!o || o.disabled) return;
      o.selected = !o.selected;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      rendre();
      emit(sel, 'change', { valeurs: options.filter(function (x) { return x.selected; }).map(function (x) { return x.value; }) });
    }
    function surligner(i) {
      if (!options[i]) return;
      actif = i;
      [].forEach.call(liste.children, function (li, k) { li.classList.toggle('br-actif', k === i); });
      liste.setAttribute('aria-activedescendant', liste.children[i].id);
    }
    function ouvrir() {
      if (ouvert) return;
      ouvert = true;
      w.classList.add('br-ouvert');
      b.setAttribute('aria-expanded', 'true');
      surligner(actif);
      liste.focus({ preventScroll: true });
    }
    function fermer(focus) {
      if (!ouvert) return;
      ouvert = false;
      w.classList.remove('br-ouvert');
      b.setAttribute('aria-expanded', 'false');
      if (focus) b.focus();
    }
    b.addEventListener('click', function () { if (ouvert) fermer(true); else ouvrir(); });
    b.addEventListener('keydown', function (e) {
      if (['ArrowDown', 'Enter', ' '].indexOf(e.key) >= 0) { e.preventDefault(); ouvrir(); }
      else if (e.key === 'Backspace') {
        var dern = options.map(function (o, i) { return o.selected ? i : -1; }).filter(function (i) { return i >= 0; }).pop();
        if (dern != null) basculer(dern);
      }
    });
    liste.addEventListener('keydown', function (e) {
      var k = e.key, i = actif;
      if (k === 'ArrowDown' || k === 'ArrowUp') {
        e.preventDefault();
        do { i += k === 'ArrowDown' ? 1 : -1; } while (options[i] && options[i].disabled);
        surligner(i);
      }
      else if (k === 'Enter' || k === ' ') { e.preventDefault(); basculer(actif); }
      else if (k === 'Escape') { e.preventDefault(); fermer(true); }
      else if (k === 'Tab') fermer(false);
    });
    liste.addEventListener('click', function (e) { var li = e.target.closest('[role="option"]'); if (li) { surligner(+li.dataset.i); basculer(+li.dataset.i); } });
    document.addEventListener('pointerdown', function (e) { if (ouvert && !w.contains(e.target)) fermer(false); });
    if (sel.form) sel.form.addEventListener('reset', function () { setTimeout(rendre, 0); });
    rendre();
    return { ouvrir: ouvrir, fermer: fermer };
  });

  controle('zone-auto', 'formulaires', function (el) {
    var ta = champDe(el, 'textarea');
    if (!ta) return {};
    var w = emballage(el, ta, 'br-za');
    var max = parseFloat(el.dataset.max || ta.dataset.max) || 320;
    ta.style.resize = 'none';
    ta.style.overflowY = 'hidden';
    var compte = null, txt = null, arc = null;
    if (ta.maxLength > 0) {
      compte = document.createElement('span');
      compte.className = 'br-za-compte';
      compte.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.5" pathLength="100"/><circle class="br-za-arc" cx="10" cy="10" r="7.5" pathLength="100"/></svg><span aria-live="polite"></span>';
      w.appendChild(compte);
      txt = compte.querySelector('span');
      arc = compte.querySelector('.br-za-arc');
    }
    var prem = true;
    function ajuster() {
      var avant = ta.offsetHeight;
      ta.style.transition = 'none';
      ta.style.height = 'auto';
      var cible = Math.min(max, ta.scrollHeight + (ta.offsetHeight - ta.clientHeight));
      ta.style.height = avant + 'px';
      void ta.offsetHeight;
      ta.style.transition = prem ? 'none' : '';
      ta.style.height = cible + 'px';
      ta.style.overflowY = ta.scrollHeight > cible + 1 ? 'auto' : 'hidden';
      prem = false;
      if (compte) {
        var n = ta.value.length, r = n / ta.maxLength;
        txt.textContent = r >= .8 ? (ta.maxLength - n) : '';
        compte.dataset.niveau = r >= 1 ? 'plein' : r >= .8 ? 'proche' : r >= .5 ? '' : 'cache';
        arc.style.strokeDashoffset = (100 - Math.min(1, r) * 100).toFixed(1);
      }
    }
    ta.addEventListener('input', ajuster);
    if (ta.form) ta.form.addEventListener('reset', function () { setTimeout(ajuster, 0); });
    if ('ResizeObserver' in window) {
      var larg = 0;
      new ResizeObserver(function () { if (ta.clientWidth !== larg) { larg = ta.clientWidth; ajuster(); } }).observe(ta);
    }
    ajuster();
    return { ajuster: ajuster };
  });

  controle('code-otp', 'formulaires', function (el) {
    var n = Math.max(2, Math.min(10, parseInt(el.dataset.longueur, 10) || 4));
    el.classList.add('br-otp');
    el.setAttribute('role', 'group');
    if (!el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')) el.setAttribute('aria-label', 'Code de vérification');
    var champ = document.createElement('input');
    champ.type = 'hidden';
    champ.name = el.dataset.nom || 'code';
    el.appendChild(champ);
    var cases = [];
    for (var i = 0; i < n; i++) {
      var c = document.createElement('input');
      c.type = 'text';
      c.inputMode = 'numeric';
      c.autocomplete = i === 0 ? 'one-time-code' : 'off';
      c.maxLength = n;
      c.className = 'br-otp-case';
      c.setAttribute('aria-label', 'Chiffre ' + (i + 1) + ' sur ' + n);
      el.appendChild(c);
      cases.push(c);
    }
    function valeur() { return cases.map(function (x) { return x.value; }).join(''); }
    function remplir(depuis, texte) {
      var chiffres = String(texte).replace(/\D/g, '').split('');
      for (var k = depuis; k < n && chiffres.length; k++) { cases[k].value = chiffres.shift(); relancer(cases[k], 'br-pop'); }
      var vide = cases.filter(function (x) { return !x.value; })[0];
      (vide || cases[n - 1]).focus();
      verifier();
    }
    function verifier() {
      var v = valeur();
      champ.value = v;
      el.classList.toggle('br-complet', v.length === n);
      el.classList.remove('br-valide');
      if (v.length !== n) return;
      emit(el, 'complet', { code: v });
      var att = el.dataset.attendu;
      if (!att) return;
      if (v === att) { el.classList.add('br-valide'); return; }
      relancer(el, 'br-faux');
      setTimeout(function () {
        cases.forEach(function (x) { x.value = ''; });
        el.classList.remove('br-faux', 'br-complet');
        champ.value = '';
        cases[0].focus();
      }, 650);
    }
    cases.forEach(function (c, i) {
      c.addEventListener('input', function (e) {
        var v = (e.inputType === 'insertText' && e.data && e.data.length === 1 ? e.data : c.value).replace(/\D/g, '');
        if (v.length > 1) { c.value = ''; remplir(i, v); return; }
        c.value = v;
        if (v) { relancer(c, 'br-pop'); if (cases[i + 1]) cases[i + 1].focus(); }
        verifier();
      });
      c.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && !c.value && cases[i - 1]) { e.preventDefault(); cases[i - 1].value = ''; cases[i - 1].focus(); verifier(); }
        else if (e.key === 'ArrowLeft' && cases[i - 1]) { e.preventDefault(); cases[i - 1].focus(); }
        else if (e.key === 'ArrowRight' && cases[i + 1]) { e.preventDefault(); cases[i + 1].focus(); }
      });
      c.addEventListener('paste', function (e) {
        var t = (e.clipboardData || window.clipboardData).getData('text');
        if (t) { e.preventDefault(); remplir(i, t); }
      });
      c.addEventListener('focus', function () { try { c.setSelectionRange(0, c.value.length); } catch (_) {} });
    });
    return { vider: function () { cases.forEach(function (x) { x.value = ''; }); verifier(); } };
  });

  controle('depot-fichiers', 'formulaires', function (el) {
    var input = champDe(el, 'input[type="file"]');
    var zone = el;
    if (el.tagName === 'INPUT') { zone = document.createElement('div'); el.parentNode.insertBefore(zone, el); zone.appendChild(el); }
    if (!input) {
      input = document.createElement('input');
      input.type = 'file';
      if (el.hasAttribute('data-multiple')) input.multiple = true;
      if (el.dataset.accepte) input.accept = el.dataset.accepte;
      if (el.dataset.nom) input.name = el.dataset.nom;
    }
    zone.classList.add('br-df');
    if (!input.id) input.id = idCtl('df');
    var lab = document.createElement('label');
    lab.className = 'br-df-zone';
    lab.htmlFor = input.id;
    lab.innerHTML = SVC('<path class="br-df-fleche" d="M12 15.5V5M7.5 9.5 12 5l4.5 4.5"/><path d="M4.5 14.5v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3"/>', 'br-df-ic') +
      '<span class="br-df-titre">' + esc(el.dataset.texte || (input.multiple ? 'Glisse tes fichiers ici' : 'Glisse un fichier ici')) + '</span>' +
      '<span class="br-df-sous">ou <u>parcourir</u>' + (input.accept ? ' · ' + esc(input.accept.replace(/,/g, ', ')) : '') + '</span>';
    lab.insertBefore(input, lab.firstChild);
    input.classList.add('br-natif');
    zone.appendChild(lab);
    var ul = document.createElement('ul');
    ul.className = 'br-df-liste';
    ul.setAttribute('aria-live', 'polite');
    zone.appendChild(ul);
    var fichiers = [];
    function taille(o) { return o < 1024 ? o + ' o' : o < 1048576 ? (o / 1024).toFixed(o < 10240 ? 1 : 0).replace('.', ',') + ' Ko' : (o / 1048576).toFixed(1).replace('.', ',') + ' Mo'; }
    function synchroniser() {
      try { var dt = new DataTransfer(); fichiers.forEach(function (f) { dt.items.add(f); }); input.files = dt.files; } catch (_) {}
    }
    function rendre(nouveaux) {
      ul.textContent = '';
      fichiers.forEach(function (f, i) {
        var li = document.createElement('li');
        li.className = 'br-df-fichier' + (nouveaux && nouveaux.indexOf(f) >= 0 ? ' br-entre' : '');
        li.style.setProperty('--i', i);
        li.innerHTML = SVC('<path d="M7 3.5h6.5l4.5 4.5v11a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5Z"/><path d="M13 3.5V8.5h5"/>', 'br-df-doc') +
          '<span class="br-df-nom"></span><span class="br-df-poids">' + taille(f.size) + '</span>' +
          '<button type="button" class="br-df-retirer">' + SVC('<path d="M7 7l10 10M17 7 7 17"/>') + '</button>';
        li.querySelector('.br-df-nom').textContent = f.name;
        var bt = li.querySelector('button');
        bt.setAttribute('aria-label', 'Retirer ' + f.name);
        bt.addEventListener('click', function () {
          li.classList.add('br-sort');
          setTimeout(function () {
            fichiers.splice(fichiers.indexOf(f), 1);
            synchroniser();
            rendre();
            emit(el, 'fichiers', { fichiers: fichiers.slice() });
            input.focus();
          }, calme() ? 0 : 220);
        });
        ul.appendChild(li);
      });
      zone.classList.toggle('br-plein', fichiers.length > 0);
    }
    function ajouter(liste) {
      liste = [].slice.call(liste || []);
      if (!liste.length) return;
      fichiers = input.multiple ? fichiers.concat(liste) : liste.slice(0, 1);
      synchroniser();
      rendre(liste);
      emit(el, 'fichiers', { fichiers: fichiers.slice() });
    }
    var avant = [];
    input.addEventListener('click', function () { avant = fichiers.slice(); });
    input.addEventListener('change', function (e) {
      if (!e.isTrusted) return;
      var choisis = [].slice.call(input.files || []);
      fichiers = avant;
      ajouter(choisis);
    });
    var prof = 0;
    lab.addEventListener('dragenter', function (e) { e.preventDefault(); prof++; zone.classList.add('br-survol'); });
    lab.addEventListener('dragover', function (e) { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; });
    lab.addEventListener('dragleave', function () { if (--prof <= 0) { prof = 0; zone.classList.remove('br-survol'); } });
    lab.addEventListener('drop', function (e) {
      e.preventDefault();
      prof = 0;
      zone.classList.remove('br-survol');
      relancer(zone, 'br-depose');
      if (e.dataTransfer) ajouter(e.dataTransfer.files);
    });
    if (input.form) input.form.addEventListener('reset', function () { fichiers = []; setTimeout(function () { synchroniser(); rendre(); }, 0); });
    return { fichiers: function () { return fichiers.slice(); }, ajouter: ajouter };
  });

  controle('curseur-ressort', 'formulaires', function (el) {
    var r = champDe(el, 'input[type="range"]');
    if (!r) return {};
    var w = r === el ? envelopper(r, 'br-cr') : el;
    w.classList.add('br-cr');
    var bulle = document.createElement('span');
    bulle.className = 'br-cr-bulle';
    bulle.setAttribute('aria-hidden', 'true');
    w.appendChild(bulle);
    var min = r.min === '' ? 0 : +r.min, max = r.max === '' ? 100 : +r.max;
    var unite = el.dataset.unite || r.dataset.unite || '';
    var vit = 0, ang = 0, dernier = +r.value, raf = 0;
    function placer() {
      var p = (r.value - min) / ((max - min) || 1);
      w.style.setProperty('--br-pc', p.toFixed(4));
      bulle.textContent = String(r.value).replace('.', ',') + unite;
    }
    function balancer() {
      ang += (Math.max(-28, Math.min(28, vit * -1.6)) - ang) * .25;
      vit *= .8;
      bulle.style.setProperty('--br-incl', ang.toFixed(2) + 'deg');
      if (Math.abs(ang) > .05 || Math.abs(vit) > .05) raf = requestAnimationFrame(balancer);
      else { raf = 0; bulle.style.setProperty('--br-incl', '0deg'); }
    }
    r.addEventListener('input', function () {
      var v = +r.value;
      vit += (v - dernier) / ((max - min) || 1) * 70;
      dernier = v;
      placer();
      if (!raf && !calme()) raf = requestAnimationFrame(balancer);
    });
    placer();
    return { placer: placer };
  });

  controle('envoi-formulaire', 'formulaires', function (form) {
    if (form.tagName !== 'FORM') return {};
    form.classList.add('br-ef');
    var corps = document.createElement('div');
    corps.className = 'br-ef-corps';
    while (form.firstChild) corps.appendChild(form.firstChild);
    form.appendChild(corps);
    var bouton = form.querySelector('[type="submit"]');
    var largeur = 0;
    if (bouton) {
      bouton.classList.add('br-ef-bouton');
      if (!bouton.querySelector('.br-ef-l')) {
        var l = document.createElement('span');
        l.className = 'br-ef-l';
        while (bouton.firstChild) l.appendChild(bouton.firstChild);
        bouton.appendChild(l);
      }
      bouton.insertAdjacentHTML('beforeend', '<span class="br-ef-ic" aria-hidden="true"><svg class="br-ef-spin" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="8" cy="8" r="6" opacity=".25"/><path d="M14 8a6 6 0 0 0-6-6"/></svg></span>');
    }
    var erreur = document.createElement('p');
    erreur.className = 'br-ef-erreur';
    erreur.setAttribute('role', 'alert');
    corps.appendChild(erreur);
    var succes = document.createElement('div');
    succes.className = 'br-ef-succes';
    succes.setAttribute('role', 'status');
    succes.tabIndex = -1;
    succes.hidden = true;
    succes.innerHTML = SVC('<circle cx="12" cy="12" r="9.5" pathLength="100"/><path d="M7.8 12.4l2.9 2.9 5.6-6" pathLength="100"/>', 'br-ef-coche') +
      '<p class="br-ef-merci">' + esc(form.dataset.succes || 'Merci, c’est envoyé.') + '</p>' +
      (form.dataset.retour === 'false' ? '' : '<button type="button" class="br-ef-retour">' + esc(form.dataset.retour || 'Envoyer une autre réponse') + '</button>');
    form.appendChild(succes);
    function bouger(apres) {
      var h1 = form.offsetHeight;
      apres();
      var h2 = form.offsetHeight;
      if (calme() || h1 === h2) return;
      form.style.height = h1 + 'px';
      form.style.overflow = 'hidden';
      void form.offsetHeight;
      form.style.transition = 'height .5s var(--br-ressort-doux)';
      form.style.height = h2 + 'px';
      setTimeout(function () { form.style.height = form.style.overflow = form.style.transition = ''; }, 520);
    }
    function etatBouton(e) {
      if (!bouton) return;
      if (e === 'chargement') { largeur = bouton.offsetWidth; bouton.style.width = largeur + 'px'; void bouton.offsetWidth; bouton.style.width = bouton.offsetHeight + 'px'; }
      else { bouton.style.width = largeur + 'px'; setTimeout(function () { bouton.style.width = ''; }, 450); }
      bouton.dataset.etat = e;
    }
    var envoi = false;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (envoi) return;
      if (form.noValidate && !form.checkValidity()) { form.reportValidity(); return; }
      envoi = true;
      erreur.textContent = '';
      var donnees = new FormData(form);
      form.classList.add('br-envoi');
      form.setAttribute('aria-busy', 'true');
      corps.inert = true;
      etatBouton('chargement');
      var fini = false;
      function terminer(ok, message) {
        if (fini) return;
        fini = true;
        envoi = false;
        form.classList.remove('br-envoi');
        form.removeAttribute('aria-busy');
        corps.inert = false;
        etatBouton('repos');
        if (ok) {
          bouger(function () { corps.hidden = true; succes.hidden = false; });
          relancer(succes, 'br-tic');
          succes.focus({ preventScroll: true });
          emit(form, 'envoye', {});
        } else {
          erreur.textContent = message || form.dataset.erreur || 'L’envoi a échoué. Réessaie dans un instant.';
          if (bouton) relancer(bouton, 'br-secoue');
        }
      }
      form.dispatchEvent(new CustomEvent('brio:envoi', { bubbles: true, detail: { donnees: donnees, terminer: terminer } }));
      if (form.hasAttribute('data-demo')) setTimeout(function () { terminer(Math.random() < .8, 'Le serveur ne répond pas. Réessaie.'); }, calme() ? 300 : 1500);
    });
    succes.addEventListener('click', function (e) {
      if (!e.target.closest('.br-ef-retour')) return;
      form.reset();
      bouger(function () { succes.hidden = true; corps.hidden = false; });
      var premier = corps.querySelector('input, textarea, select, button');
      if (premier) premier.focus();
    });
    return {};
  });

  /* ==========================================================================
     LOT 4 — SCÈNES PHYSIQUES (data-brio sur un conteneur, vide ou non)
     Modes : bascule (clic = ouvre / ferme, aria-pressed), jeu (joue à l'entrée
     dans l'écran, clic = rejoue), boucle (clic = pause), libre (pointeur + ressorts).
     Options : data-taille (facteur, 1 = 180 × 130 px), data-vitesse, data-label,
     data-ouvert (bascule), data-declencheur="clic" et data-boucle (jeu).
     ========================================================================== */
  function composant(nom, famille, cat, mode, init) {
    BR.def(nom, { composant: true, famille: famille, c: cat, mode: mode, init: init });
  }
  BR.listeComposants = function (famille) {
    return ordre.filter(function (n) { return defs[n].famille && (!famille || defs[n].famille === famille); })
      .map(function (n) { return { nom: n, categorie: defs[n].c, famille: defs[n].famille, mode: defs[n].mode }; });
  };
  var rejouerAvant = BR.rejouer;
  BR.rejouer = function (el) {
    if (typeof el === 'string') el = document.querySelector(el);
    if (!el) return;
    if (el._br && el._br.rejouer) el._br.rejouer();
    rejouerAvant(el);
  };

  // ressort amorti (Euler semi-implicite, 4 sous-pas) : x tend vers cible
  function Ressort(x, k, c) { this.x = this.cible = x || 0; this.v = 0; this.k = k || 170; this.c = c || 14; }
  Ressort.prototype.pas = function (dt) {
    for (var i = 0, h = dt / 4; i < 4; i++) {
      this.v += (-this.k * (this.x - this.cible) - this.c * this.v) * h;
      this.x += this.v * h;
    }
    return Math.abs(this.v) > .01 || Math.abs(this.x - this.cible) > .01;
  };
  BR.Ressort = Ressort;
  // boucle rAF qui s'endort au repos ; renvoie la fonction « réveiller »
  function moteur(pas) {
    var raf = 0, avant = 0;
    function tic(t) {
      var dt = Math.min(.034, Math.max(0, (t - avant) / 1000)); avant = t;
      raf = pas(dt) ? requestAnimationFrame(tic) : 0;
    }
    return function () { if (!raf) { avant = performance.now(); raf = requestAnimationFrame(tic); } };
  }
  function borne(v, a, b) { return v < a ? a : v > b ? b : v; }
  function echelle(el) { return (parseFloat(getComputedStyle(el).fontSize) || 10) / 10; }
  function svgSc(corps, vb) { return '<svg viewBox="' + (vb || '0 0 180 130') + '" fill="none" aria-hidden="true">' + corps + '</svg>'; }

  var obsSc = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      var el = e.target;
      el.classList.toggle('br-hors', !e.isIntersecting);
      el._brVu = e.isIntersecting;
      if (e.isIntersecting && el._brAuto && el._br && el._br.rejouer) { el._brAuto = false; el._br.rejouer(); }
    });
  }, { threshold: .35 }) : null;

  var LIB = { bascule: 'Ouvrir ou fermer', jeu: 'Rejouer l’animation', boucle: 'Mettre en pause l’animation', libre: 'Donner une impulsion' };
  function scene(nom, cat, mode, html, x) {
    x = x || {};
    composant(nom, x.famille || 'physique', cat, mode, function (el) {
      var contenu = el.innerHTML.trim(), api = {};
      el.classList.add('br-sc', 'br-sc-' + mode);
      var t = parseFloat(el.dataset.taille); if (t > 0) el.style.setProperty('--br-sc-taille', t);
      var v = parseFloat(el.dataset.vitesse); if (v > 0) el.style.setProperty('--br-v', v);
      el.innerHTML = typeof html === 'function' ? html(el, contenu) : html;
      [].forEach.call(el.children, function (c) { c.setAttribute('aria-hidden', 'true'); });
      var lab = el.getAttribute('aria-label') || el.dataset.label || x.label || LIB[mode];
      el.setAttribute('aria-label', lab);
      if (!x.roleLibre) {
        el.setAttribute('role', 'button');
        if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
      }
      function activer() {
        if (mode === 'bascule') api.basculer();
        else if (mode === 'jeu') api.rejouer();
        else if (mode === 'boucle') api.pause(!el.classList.contains('br-pause'));
        else if (api.impulsion) api.impulsion();
      }
      if (!x.roleLibre) {
        el.addEventListener('click', function (e) { if (!el._brGlisse) activer(); el._brGlisse = false; });
        el.addEventListener('keydown', function (e) {
          if (e.target !== el || (e.key !== 'Enter' && e.key !== ' ')) return;
          e.preventDefault(); activer();
        });
      }
      if (mode === 'bascule') {
        api.basculer = function (f) {
          var o = el.classList.toggle('br-ouvert', f);
          el.setAttribute('aria-pressed', String(o));
          if (x.change) x.change(el, o);
          emit(el, 'change', { ouvert: o });
        };
        var o0 = el.hasAttribute('data-ouvert') && el.dataset.ouvert !== 'false';
        el.classList.toggle('br-ouvert', o0);
        el.setAttribute('aria-pressed', String(o0));
      }
      if (mode === 'jeu') {
        var minuteur = 0, vit = v > 0 ? v : 1;
        api.rejouer = function () {
          clearTimeout(minuteur);
          if (x.debut) x.debut(el);
          relancer(el, 'br-joue');
          minuteur = setTimeout(function fin() {
            if (x.fin) x.fin(el);
            emit(el, 'fin', {});
            if (el.hasAttribute('data-boucle') && el._brVu !== false && !calme()) minuteur = setTimeout(api.rejouer, 1200);
          }, x.duree / vit);
        };
        if (el.dataset.declencheur !== 'clic' && !calme()) el._brAuto = true;
      }
      if (mode === 'boucle') {
        api.pause = function (p) {
          el.classList.toggle('br-pause', p);
          el.setAttribute('aria-pressed', String(p));
        };
        api.pause(calme());
      }
      if (obsSc) obsSc.observe(el); else if (api.rejouer && el._brAuto) setTimeout(api.rejouer, 60);
      if (x.init) {
        var r = x.init(el, api);
        if (r) for (var k in r) api[k] = r[k];
      }
      if (x.debut && mode === 'jeu') x.debut(el);
      return api;
    });
  }

  /* ---------- Ressorts et élasticité ---------- */
  var DOCK = [
    ['Fichiers', '<path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5Z"/>', '#4c8dff', '#2f5fe0'],
    ['Messages', '<path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v8a1.5 1.5 0 0 1-1.5 1.5H10l-4 3.5V16h-.5A1.5 1.5 0 0 1 4 14.5Z"/>', '#3fd27f', '#18a65a'],
    ['Photos', '<rect x="4" y="5.5" width="16" height="13" rx="2"/><path d="M4 15l4.5-4.5 4 4 2.5-2.5 5 5"/><circle cx="15.5" cy="9.5" r="1.2"/>', '#ffb648', '#f2733a'],
    ['Musique', '<path d="M9 17.5V6.5l10-2v11"/><circle cx="6.8" cy="17.5" r="2.2"/><circle cx="16.8" cy="15.5" r="2.2"/>', '#ff6a8d', '#e0335f'],
    ['Agenda', '<rect x="5" y="6" width="14" height="13.5" rx="2"/><path d="M5 10.5h14M9 4.5v3M15 4.5v3"/>', '#a678ff', '#6a45ff'],
    ['Réglages', '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.5M12 18v2.5M3.5 12H6M18 12h2.5M6 6l1.8 1.8M16.2 16.2 18 18M6 18l1.8-1.8M16.2 7.8 18 6"/>', '#8d96a8', '#59606e']
  ];
  scene('dock-ressort', 'ressorts', 'libre', function (el) {
    var enfants = [].filter.call(el.children, function (c) { return c.nodeType === 1; });
    if (enfants.length) {
      var b = document.createElement('div');
      b.className = 'br-dk-barre';
      enfants.forEach(function (c) { c.classList.add('br-dk-app'); b.appendChild(c); });
      el.textContent = '';
      return b.outerHTML;
    }
    return '<div class="br-dk-barre">' + DOCK.map(function (d) {
      return '<button type="button" class="br-dk-app" style="--a:' + d[2] + ';--b:' + d[3] + '" aria-label="' + d[0] + '">' + SVC(d[1]) + '<i class="br-dk-pt"></i></button>';
    }).join('') + '</div>';
  }, {
    roleLibre: true,
    init: function (el) {
      var barre = el.querySelector('.br-dk-barre');
      barre.removeAttribute('aria-hidden');
      barre.setAttribute('role', 'toolbar');
      barre.setAttribute('aria-label', el.dataset.label || 'Dock');
      el.removeAttribute('aria-label');
      var apps = [].slice.call(barre.children), R = apps.map(function () { return new Ressort(1, 300, 26); }), px = null, foc = null;
      apps.forEach(function (a, i) {
        a.tabIndex = i ? -1 : 0;
        a.addEventListener('focus', function () { foc = i; cibles(); });
        a.addEventListener('blur', function () { foc = null; cibles(); });
        a.addEventListener('click', function () { relancer(a, 'br-saute'); a.classList.add('br-actif'); emit(el, 'change', { app: a.getAttribute('aria-label') || a.textContent.trim(), index: i }); });
      });
      barre.addEventListener('keydown', function (e) {
        var i = apps.indexOf(document.activeElement); if (i < 0) return;
        var j = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? apps.length - 1 : -2;
        if (j === -2) return;
        e.preventDefault(); j = (j + apps.length) % apps.length;
        apps[i].tabIndex = -1; apps[j].tabIndex = 0; apps[j].focus();
      });
      // grossissement selon la distance au pointeur (ou à l'icône focalisée), positions de repos
      function cibles() {
        var k = echelle(el), u = 30 * k, pasL = 37 * k, n = apps.length;
        var p = px != null ? px : foc != null ? (foc - (n - 1) / 2) * pasL : null;
        apps.forEach(function (a, i) {
          if (p == null) { R[i].cible = 1; return; }
          var d = (p - (i - (n - 1) / 2) * pasL) / (u * 1.45);
          R[i].cible = 1 + .85 * Math.exp(-d * d);
        });
        reveil();
      }
      var reveil = moteur(function (dt) {
        var actif = false;
        R.forEach(function (r, i) { actif = r.pas(dt) || actif; apps[i].style.setProperty('--s', r.x.toFixed(3)); });
        return actif;
      });
      el.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') return;
        var r = el.getBoundingClientRect();
        px = e.clientX - (r.left + r.width / 2); cibles();
      });
      el.addEventListener('pointerleave', function () { px = null; cibles(); });
      return {};
    }
  });

  scene('etiquette-elastique', 'ressorts', 'libre', function (el) {
    return '<i class="br-ee-crochet"></i><div class="br-ee-bras"><i class="br-ee-fil"></i><div class="br-ee-tag"><i class="br-ee-trou"></i><b>' +
      esc(el.dataset.titre || 'Soldes') + '</b><span>' + esc(el.dataset.texte || '−30 %') + '</span></div></div>';
  }, {
    label: 'Tirer l’étiquette',
    init: function (el, api) {
      var Y = new Ressort(0, 190, 5), A = new Ressort(0, 110, 3.6), tag = el.querySelector('.br-ee-tag'), g = null;
      var reveil = moteur(function (dt) {
        var a = g ? false : Y.pas(dt), b = A.pas(dt);
        el.style.setProperty('--y', Y.x.toFixed(2) + 'px');
        el.style.setProperty('--r', A.x.toFixed(2) + 'deg');
        el.style.setProperty('--e', (1 + borne(Y.v / 5000, -.06, .1)).toFixed(3));
        return a || b || !!g;
      });
      tag.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button) return;
        try { tag.setPointerCapture(e.pointerId); } catch (_) {}
        g = { y: e.clientY, x: e.clientX, py: e.clientY, t: performance.now(), vy: 0, bouge: false };
        reveil();
      });
      tag.addEventListener('pointermove', function (e) {
        if (!g) return;
        var k = echelle(el), dy = e.clientY - g.y, now = performance.now();
        if (Math.abs(dy) > 4 || Math.abs(e.clientX - g.x) > 4) g.bouge = true;
        Y.x = dy < 0 ? dy * .25 : 46 * k * (1 - Math.exp(-dy / (46 * k)));
        g.vy = (e.clientY - g.py) / Math.max(.008, (now - g.t) / 1000); g.py = e.clientY; g.t = now;
        A.cible = borne((e.clientX - g.x) * .3, -24, 24);
      });
      function lacher() {
        if (!g) return;
        el._brGlisse = g.bouge;
        Y.v = borne(g.vy * .4, -1500, 1500); Y.cible = 0; A.cible = 0; g = null; reveil();
      }
      tag.addEventListener('pointerup', lacher);
      tag.addEventListener('pointercancel', lacher);
      return { impulsion: function () { Y.v = 560 * echelle(el); A.v = (Math.random() < .5 ? -1 : 1) * 90; reveil(); } };
    }
  });

  scene('capsule-tension', 'ressorts', 'libre',
    '<div class="br-tn"><i class="br-tn-ancre"></i><div class="br-tn-bande"><i></i><i></i><i></i></div><i class="br-tn-poignee"></i></div>', {
    label: 'Étirer la capsule',
    init: function (el) {
      var S = new Ressort(0, 260, 6.5), N = [new Ressort(0, 420, 16), new Ressort(0, 330, 13), new Ressort(0, 250, 10)];
      var poignee = el.querySelector('.br-tn-poignee'), noeuds = el.querySelectorAll('.br-tn-bande i'), g = null;
      var reveil = moteur(function (dt) {
        var k = echelle(el), a = g ? false : S.pas(dt), b = false;
        N.forEach(function (n, i) { n.cible = S.x * (i + 1) / 4; b = n.pas(dt) || b; noeuds[i].style.setProperty('--n', (n.x - n.cible).toFixed(2) + 'px'); });
        el.style.setProperty('--s', S.x.toFixed(2) + 'px');
        el.style.setProperty('--h', borne(1 / (1 + S.x / (55 * k)), .34, 1.32).toFixed(3));
        return a || b || !!g;
      });
      poignee.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button) return;
        try { poignee.setPointerCapture(e.pointerId); } catch (_) {}
        g = { x: e.clientX - S.x, px: e.clientX, t: performance.now(), vx: 0, x0: e.clientX };
        reveil();
      });
      poignee.addEventListener('pointermove', function (e) {
        if (!g) return;
        var k = echelle(el), dx = e.clientX - g.x, now = performance.now();
        S.x = dx < 0 ? Math.max(-22 * k, dx * .35) : 62 * k * (1 - Math.exp(-dx / (62 * k)));
        g.vx = (e.clientX - g.px) / Math.max(.008, (now - g.t) / 1000); g.px = e.clientX; g.t = now;
      });
      function lacher(e) {
        if (!g) return;
        el._brGlisse = Math.abs(e.clientX - g.x0) > 4;
        S.v = borne(g.vx * .3, -1200, 1200); S.cible = 0; g = null; reveil();
      }
      poignee.addEventListener('pointerup', lacher);
      poignee.addEventListener('pointercancel', lacher);
      return { impulsion: function () { S.v = 950 * echelle(el); reveil(); } };
    }
  });

  scene('goutte-ecrasee', 'ressorts', 'boucle', '<div class="br-gt"><i class="br-gt-flaque"></i><i class="br-gt-ombre"></i><i class="br-gt-goutte"></i></div>');
  scene('cube-gelatine', 'ressorts', 'jeu', '<div class="br-cg"><i class="br-cg-ombre"></i><i class="br-cg-cube"><i></i></i></div>', { duree: 1500 });
  scene('ressort-spirale', 'ressorts', 'boucle', function () {
    var s = '<div class="br-rs"><i class="br-rs-socle"></i>';
    for (var i = 0; i < 14; i++) s += '<i class="br-rs-a" style="--i:' + i + '"></i>';
    return s + '<i class="br-rs-poignee" style="--i:13"></i></div>';
  });
  scene('balle-rebond', 'ressorts', 'boucle', '<div class="br-bb"><i class="br-bb-ombre"></i><i class="br-bb-balle"></i></div>');

  /* ---------- Papier, plis et impressions ---------- */
  scene('pile-cartes', 'papier', 'bascule', function (el) {
    return '<div class="br-pc"><i class="br-pc-f f2"></i><i class="br-pc-f f1"></i><div class="br-pc-dessous"><b>' + esc(el.dataset.texte || 'Révélé') +
      '</b><i></i><i></i></div><div class="br-pc-dessus"><span class="br-pc-onglet">' + esc(el.dataset.titre || 'Index') + '</span><i></i><i></i><i></i></div></div>';
  }, { label: 'Ouvrir la pile' });

  scene('coin-corne', 'papier', 'bascule', function (el) {
    return '<div class="br-ce"><div class="br-ce-dessous"><b>✦</b><span>' + esc(el.dataset.texte || 'Bonus caché') + '</span></div>' +
      '<div class="br-ce-face"><i class="t"></i><i></i><i></i><i class="c"></i></div><i class="br-ce-rabat"><i></i></i></div>';
  }, { label: 'Soulever le coin' });

  scene('enveloppe-origami', 'papier', 'bascule', function (el) {
    return '<div class="br-eo"><i class="br-eo-dos"></i><div class="br-eo-lettre"><b>' + esc(el.dataset.texte || 'Bonjour !') +
      '</b><i></i><i></i><i class="c"></i></div><i class="br-eo-poche"></i><i class="br-eo-rabat"></i></div>';
  }, { label: 'Ouvrir l’enveloppe' });

  var NOTES = ['Appeler Léa', 'Acheter du pain', 'Sport à 18 h', 'Envoyer le devis'], TEINTES = ['#ffd84d', '#ffa3b8', '#8fe3c1', '#a7c7ff'];
  scene('post-it', 'papier', 'jeu', '<div class="br-pi"><i class="br-pi-bloc"></i><div class="br-pi-note s"><span></span></div><div class="br-pi-note d"><span></span></div></div>', {
    duree: 1050, label: 'Détacher la note',
    debut: function (el) {
      var l = el.dataset.notes ? el.dataset.notes.split('|') : NOTES, k = el._brK || 0;
      [['.d', k], ['.s', k + 1]].forEach(function (p) {
        var n = el.querySelector('.br-pi-note' + p[0]);
        n.firstChild.textContent = l[p[1] % l.length];
        n.style.setProperty('--c', TEINTES[p[1] % TEINTES.length]);
      });
    },
    fin: function (el) { el._brK = (el._brK || 0) + 1; el.classList.remove('br-joue'); this.debut(el); }
  });

  var RECU = [['Café × 2', '5,60'], ['Croissant', '1,90'], ['Salade', '12,90']];
  scene('ticket-caisse', 'papier', 'jeu', function (el) {
    return '<div class="br-tc"><div class="br-tc-sortie"><div class="br-tc-papier"><b>' + esc(el.dataset.titre || 'Merci !') + '</b>' +
      RECU.map(function (r) { return '<p><span>' + r[0] + '</span><span>' + r[1] + '</span></p>'; }).join('') +
      '<p class="t"><span>Total</span><span>' + esc(el.dataset.total || '20,40 €') + '</span></p></div></div><div class="br-tc-imprimante"><i></i></div></div>';
  }, { duree: 2400, label: 'Imprimer le ticket' });

  scene('parchemin', 'papier', 'bascule', function (el) {
    return '<div class="br-pa"><div class="br-pa-papier"><b>' + esc(el.dataset.texte || 'Bienvenue') + '</b><i></i><i></i></div><i class="br-pa-r g"></i><i class="br-pa-r d"></i></div>';
  }, { label: 'Dérouler le parchemin' });

  scene('page-cornee', 'papier', 'bascule', '<div class="br-pg"><i class="br-pg-ombre"></i><div class="br-pg-feuille"><i class="t"></i><i></i><i></i><i></i><i class="c"></i><i class="br-pg-boucle"></i></div></div>', { label: 'Soulever la page' });

  scene('banniere-ruban', 'papier', 'jeu', function (el) {
    return '<div class="br-br"><i class="br-br-q g"></i><i class="br-br-q d"></i><div class="br-br-bande"><b>' + esc(el.dataset.texte || 'Nouveau') + '</b></div></div>';
  }, { duree: 1100, label: 'Déplier la bannière' });

  /* ---------- Révélations mécaniques ---------- */
  var BOUCLIER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6Z"/><path d="m8.8 12 2.3 2.3 4.4-4.6"/></svg>';
  scene('portail-fendu', 'revelations', 'bascule', function (el, c) {
    return '<div class="br-pf"><div class="br-pf-dessous">' + (c || BOUCLIER + '<b>' + esc(el.dataset.texte || 'Accès autorisé') + '</b>') +
      '</div><i class="br-pf-v g"><i></i></i><i class="br-pf-v d"><i></i></i><i class="br-pf-verrou"></i></div>';
  }, { label: 'Ouvrir le portail' });

  scene('volets-glissants', 'revelations', 'bascule', function (el, c) {
    return '<div class="br-vg"><div class="br-vg-dessous">' + (c || '<b class="br-vg-badge">' + esc(el.dataset.texte || 'Nouveau') + '</b>') + '</div><i class="br-vg-p h"></i><i class="br-vg-p b"></i></div>';
  }, { label: 'Ouvrir les volets' });

  scene('distributeur-carte', 'revelations', 'bascule', '<div class="br-dc"><div class="br-dc-sortie"><div class="br-dc-carte"><i class="br-dc-puce"></i><i class="br-dc-num"></i></div></div>' +
    '<div class="br-dc-boitier"><i class="br-dc-fente"></i><i class="br-dc-ecran"><span class="a">Insérez</span><span class="b">Retirez la carte</span></i><i class="br-dc-led"></i></div></div>', { label: 'Éjecter la carte' });

  scene('store-enrouleur', 'revelations', 'bascule', '<div class="br-se"><div class="br-se-fenetre"><i class="br-se-soleil"></i><i class="br-se-colline"></i></div><i class="br-se-toile"></i>' +
    '<i class="br-se-barre"><i class="br-se-cordon"></i></i><i class="br-se-coffre"></i></div>', { label: 'Baisser le store' });

  scene('store-accordeon', 'revelations', 'bascule', function () {
    var s = '<div class="br-sa"><i class="br-sa-vue"></i><i class="br-sa-cordon"></i>';
    for (var i = 7; i >= 0; i--) s += '<i class="br-sa-l" style="--i:' + i + '"></i>';
    return s + '<i class="br-sa-rail"></i></div>';
  }, { label: 'Tirer le store' });

  scene('persiennes', 'revelations', 'bascule', function () {
    var s = '<div class="br-ps"><i class="br-ps-lumiere"></i>';
    for (var i = 0; i < 6; i++) s += '<i class="br-ps-l" style="--i:' + i + '"></i>';
    return s + '</div>';
  }, { label: 'Orienter les lames' });

  scene('diaphragme', 'revelations', 'bascule', function () {
    var s = '<div class="br-di"><i class="br-di-fond"></i>';
    for (var i = 0; i < 6; i++) s += '<i class="br-di-l" style="--i:' + i + '"><i></i></i>';
    return s + '<i class="br-di-bague"></i></div>';
  }, { label: 'Ouvrir le diaphragme' });

  scene('lamelles', 'revelations', 'bascule', function (el) {
    var W = [.14, .3, .09, .22, .17], s = '<div class="br-la">';
    for (var i = 0; i < 5; i++) s += '<i class="br-la-b" style="--i:' + i + ';--w:' + W[i] + '"></i>';
    return s + '<b class="br-la-t">' + esc(el.dataset.texte || 'Prêt') + '</b></div>';
  }, { label: 'Déployer les lamelles' });

  /* ---------- Tracés ---------- */
  var PISTES = ['M70 55H48L36 43H16', 'M70 75H40L28 87V108', 'M110 55H130L144 41V20', 'M110 75H136L150 89H166', 'M90 45V22L100 12H122', 'M90 85V104L78 116H56'];
  function dernierPoint(d) {
    var p = d.replace(/([A-Za-z])/g, ' $1 ').trim().split(/[\s,]+/), x = 0, y = 0, c = '';
    for (var i = 0; i < p.length; i++) {
      if (/[A-Z]/.test(p[i])) { c = p[i]; continue; }
      if (c === 'H') x = +p[i]; else if (c === 'V') y = +p[i]; else { x = +p[i]; y = +p[++i]; }
    }
    return [x, y];
  }
  scene('circuit-trace', 'traces', 'boucle', function () {
    var s = '<rect class="br-ci-puce" x="70" y="45" width="40" height="40" rx="6"/>';
    for (var k = 0; k < 4; k++) s += '<path class="br-ci-broche" d="M' + (77 + k * 9) + ' 45v-5M' + (77 + k * 9) + ' 85v5"/>';
    PISTES.forEach(function (d, i) {
      var f = dernierPoint(d);
      s += '<path class="br-ci-piste" style="--i:' + i + '" d="' + d + '" pathLength="100"/><path class="br-ci-signal" style="--i:' + i + '" d="' + d + '" pathLength="100"/>' +
        '<circle class="br-ci-halo" style="--i:' + i + '" cx="' + f[0] + '" cy="' + f[1] + '" r="4"/><circle class="br-ci-borne" style="--i:' + i + '" cx="' + f[0] + '" cy="' + f[1] + '" r="4"/>';
    });
    return '<div class="br-ci">' + svgSc(s) + '</div>';
  });

  scene('treillis-hexagones', 'traces', 'boucle', function () {
    var s = '', c = [[90, 65]];
    for (var k = 0; k < 6; k++) { var a = (-90 + k * 60) * Math.PI / 180; c.push([90 + Math.cos(a) * 31.2, 65 + Math.sin(a) * 31.2]); }
    c.forEach(function (p, i) {
      var d = '';
      for (var j = 0; j < 6; j++) { var b = j * Math.PI / 3; d += (j ? 'L' : 'M') + (p[0] + Math.cos(b) * 17).toFixed(2) + ' ' + (p[1] + Math.sin(b) * 17).toFixed(2); }
      s += '<path class="br-hx" style="--i:' + i + '" d="' + d + 'Z" pathLength="100"/>';
    });
    return '<div class="br-hx-boite">' + svgSc(s) + '</div>';
  });

  var POULS = 'M4 70H44L50 70 56 52 62 90 70 28 78 102 84 62 90 70H118L124 60 130 78 136 70H176';
  scene('onde-pouls', 'traces', 'boucle', '<div class="br-op2">' + svgSc('<path class="br-op2-fond" d="' + POULS + '"/><path class="br-op2-trait" d="' + POULS + '" pathLength="100"/><path class="br-op2-tete" d="' + POULS + '" pathLength="100"/>') + '</div>');

  var ECLAIR = 'M98 14 58 70H88L74 116 124 54H94L110 14Z';
  scene('neon', 'traces', 'boucle', function () {
    return '<div class="br-ne">' + svgSc('<path class="br-ne-fond" d="' + ECLAIR + '"/><path class="br-ne-halo" d="' + ECLAIR + '" pathLength="100"/><path class="br-ne-trait" d="' + ECLAIR + '" pathLength="100"/>') + '</div>';
  });

  /* ---------- Blocs et empilements ---------- */
  scene('prismes-empiles', 'blocs', 'jeu', function () {
    var B = [[11, 2.2, 'a'], [8, 2, 'b'], [9, 1.8, 'c'], [5.2, 2.4, 'd']], bas = 1.6, s = '<div class="br-pe">';
    B.forEach(function (b, i) {
      s += '<i class="br-pe-b ' + b[2] + '" style="--i:' + i + ';width:' + b[0] + 'em;height:' + b[1] + 'em;bottom:' + bas.toFixed(2) + 'em;left:calc(50% - ' + (b[0] / 2) + 'em)"></i>';
      bas += b[1];
    });
    return s + '<i class="br-pe-sol"></i></div>';
  }, { duree: 2000, label: 'Empiler les blocs' });

  scene('tuiles-modulaires', 'blocs', 'jeu', function () {
    var T = [['1/1/2/2', 'c'], ['1/2/2/4', 'p'], ['1/4/2/5', 'c a2'], ['2/1/4/2', 'p v'], ['2/2/3/3', 'c a2'], ['2/3/3/4', 'c n'], ['2/4/4/5', 'p v n'], ['3/2/4/4', 'p a2']];
    return '<div class="br-tm">' + T.map(function (t, i) {
      var dx = ((alea(i * 3 + 1) - .5) * 14).toFixed(1), dy = ((alea(i * 3 + 2) - .5) * 10).toFixed(1), dr = ((alea(i * 3 + 3) - .5) * 120).toFixed(0);
      return '<i class="br-tm-m ' + t[1] + '" style="--i:' + i + ';grid-area:' + t[0] + ';--dx:' + dx + 'em;--dy:' + dy + 'em;--dr:' + dr + 'deg"></i>';
    }).join('') + '</div>';
  }, { duree: 1500, label: 'Assembler les tuiles' });

  scene('pyramide', 'blocs', 'jeu', function () {
    var s = '<div class="br-py">', k = 0;
    for (var r = 0; r < 4; r++) for (var c = 0; c < 4 - r; c++) {
      s += '<i class="br-py-b' + (r === 3 ? ' sommet' : '') + '" style="--k:' + k + ';left:calc(50% + ' + ((c - (3 - r) / 2) * 2.9 - 1.3).toFixed(2) + 'em);bottom:' + (1.4 + r * 2.7).toFixed(2) + 'em"></i>';
      k++;
    }
    return s + '</div>';
  }, { duree: 1900, label: 'Construire la pyramide' });

  scene('dominos', 'blocs', 'jeu', function () {
    var s = '<div class="br-do">';
    for (var i = 0; i < 5; i++) s += '<i class="br-do-t" style="--i:' + i + ';--a:' + [62, 62, 62, 75, 90][i] + 'deg;left:' + (.8 + i * 2.6).toFixed(1) + 'em"><i></i></i>';
    return s + '<i class="br-do-sol"></i></div>';
  }, { duree: 1700, label: 'Faire tomber les dominos' });

  scene('eventail-cartes', 'blocs', 'bascule', function () {
    var C = [['♠', 'A', ''], ['♥', 'R', ' r'], ['♦', 'D', ' r']];
    return '<div class="br-ev">' + C.map(function (c, i) {
      return '<i class="br-ev-c' + c[2] + '" style="--i:' + i + '"><b>' + c[1] + '</b><span>' + c[0] + '</span><b class="bas">' + c[1] + '</b></i>';
    }).join('') + '</div>';
  }, { label: 'Déployer l’éventail' });

  scene('chaine-maillons', 'blocs', 'bascule', function () {
    var s = '<div class="br-ch">';
    for (var i = 0; i < 4; i++) s += '<i class="br-ch-l" style="--i:' + i + '"></i>';
    for (var j = 0; j < 5; j++) s += '<i class="br-ch-s" style="--i:' + j + ';--c:' + Math.abs(j - 2) + '"></i>';
    return s + '</div>';
  }, { label: 'Étirer la chaîne' });

  /* ---------- Mécanique et magnétisme ---------- */
  scene('niveau-bulle', 'mecanique', 'libre', '<div class="br-nb"><div class="br-nb-corps"><i class="br-nb-graduation"></i><div class="br-nb-fiole"><i class="br-nb-rep g"></i><i class="br-nb-rep d"></i><i class="br-nb-bulle"></i></div><i class="br-nb-graduation d"></i></div><i class="br-nb-pivot"></i></div>', {
    roleLibre: true,
    init: function (el) {
      var A = new Ressort(0, 42, 2.2), B = new Ressort(0, 55, 10), main = 0, survol = null;
      el.setAttribute('role', 'slider');
      el.tabIndex = 0;
      el.setAttribute('aria-label', el.dataset.label || 'Niveau à bulle');
      el.setAttribute('aria-valuemin', '-8'); el.setAttribute('aria-valuemax', '8');
      function maj() { el.setAttribute('aria-valuenow', String(main)); el.setAttribute('aria-valuetext', 'Inclinaison ' + main + '°'); }
      maj();
      var reveil = moteur(function (dt) {
        A.cible = survol == null ? main : survol;
        var a = A.pas(dt);
        B.cible = borne(-A.x * .5, -2.3, 2.3);
        var b = B.pas(dt);
        el.style.setProperty('--a', A.x.toFixed(2) + 'deg');
        el.style.setProperty('--b', B.x.toFixed(3) + 'em');
        el.classList.toggle('br-aplomb', Math.abs(A.x) < .35 && Math.abs(B.x) < .12);
        return a || b;
      });
      el.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch' && !e.pressure) return;
        var r = el.getBoundingClientRect();
        survol = Math.round(borne(((e.clientX - r.left) / r.width - .5) * 2, -1, 1) * 80) / 10; reveil();
      });
      el.addEventListener('pointerleave', function () { survol = null; reveil(); });
      el.addEventListener('pointerdown', function () { A.v += (Math.random() < .5 ? -1 : 1) * 40; reveil(); });
      el.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
        if (e.key === 'Home') { main = 0; } else if (e.key === 'Enter' || e.key === ' ') { A.v += 40; } else if (d) { main = borne(main + d, -8, 8); } else return;
        e.preventDefault(); maj(); reveil();
      });
      A.v = 30; reveil();
      return {};
    }
  });

  scene('metronome', 'mecanique', 'boucle', function (el) {
    var bpm = borne(parseFloat(el.dataset.tempo) || 96, 30, 240);
    el.style.setProperty('--battement', (60 / bpm).toFixed(3) + 's');
    return '<div class="br-mt"><i class="br-mt-corps"></i><i class="br-mt-echelle"></i><div class="br-mt-bras"><i class="br-mt-poids"></i></div><i class="br-mt-pivot"></i><i class="br-mt-voyant"></i><b class="br-mt-bpm">' + bpm + ' bpm</b></div>';
  });

  scene('cardan', 'mecanique', 'boucle', '<div class="br-ca"><div class="br-ca-ext"><div class="br-ca-int"><i class="br-ca-c1"><i class="br-ca-c2"></i></i></div></div></div>');

  function roueDentee(z, rp, h) {
    var ra = rp + h * .5, rf = rp - h * .62, pas = Math.PI * 2 / z, pts = [];
    for (var k = 0; k < z; k++) {
      [[rf, -.5], [rf, -.3], [ra, -.16], [ra, .16], [rf, .3]].forEach(function (p) {
        var b = (k + p[1]) * pas;
        pts.push((p[0] * Math.cos(b)).toFixed(2) + ' ' + (p[0] * Math.sin(b)).toFixed(2));
      });
    }
    var m = rp * .26;
    return 'M' + pts.join('L') + 'ZM' + m + ' 0A' + m + ' ' + m + ' 0 1 0 ' + (-m) + ' 0A' + m + ' ' + m + ' 0 1 0 ' + m + ' 0Z';
  }
  scene('engrenages-pas', 'mecanique', 'boucle', function () {
    return '<div class="br-eg">' + svgSc(
      '<g transform="translate(64 65)"><g class="br-eg-pas a"><g class="br-eg-fin a"><path class="br-eg-r a" fill-rule="evenodd" d="' + roueDentee(12, 36, 9) + '"/>' +
      '<path class="br-eg-rayon" d="M0-12V-22M0 12V22M-12 0H-22M12 0H22"/></g></g></g>' +
      '<g transform="translate(124 65) rotate(22.5)"><g class="br-eg-pas b"><g class="br-eg-fin b"><path class="br-eg-r b" fill-rule="evenodd" d="' + roueDentee(8, 24, 9) + '"/></g></g></g>') + '</div>';
  });

  scene('disques-aimantes', 'mecanique', 'boucle', '<div class="br-da"><i class="br-da-d g"></i><i class="br-da-d d"></i></div>', { init: function () { filtreGluant(); } });

  scene('dipole', 'mecanique', 'bascule', svgSc('<path class="br-dp-l" d="M70 52C80 34 100 34 110 52"/><path class="br-dp-l" d="M70 78C80 96 100 96 110 78"/><path class="br-dp-l" d="M70 60C80 52 100 52 110 60"/><path class="br-dp-l" d="M70 70C80 78 100 78 110 70"/>', '0 0 180 130').replace('<svg', '<svg class="br-dp-champ"') +
    '<div class="br-dp"><i class="br-dp-a g"><b>N</b><b>S</b></i><i class="br-dp-a d"><b>N</b><b>S</b></i></div>', { label: 'Rapprocher les aimants' });

  scene('boussole', 'mecanique', 'libre', '<div class="br-bo"><i class="br-bo-graduation"></i><b class="n">N</b><b class="e">E</b><b class="s">S</b><b class="o">O</b><i class="br-bo-aiguille"></i><i class="br-bo-axe"></i></div>', {
    label: 'Perturber la boussole',
    init: function (el) {
      var A = new Ressort(0, 30, 2.1);
      var reveil = moteur(function (dt) { var a = A.pas(dt); el.style.setProperty('--a', A.x.toFixed(2) + 'deg'); return a; });
      var arret = BR.suivrePointeur(el, function (p) {
        if (!el.isConnected) { arret(); return; }
        var r = el.getBoundingClientRect(), dx = p.x - r.width / 2, dy = p.y - r.height / 2, dist = Math.sqrt(dx * dx + dy * dy), k = echelle(el);
        var c = dist < 230 * k && dist > 8 ? Math.atan2(dx, -dy) * 180 / Math.PI : 0;
        while (c - A.x > 180) c -= 360;
        while (c - A.x < -180) c += 360;
        if (Math.abs(c - A.cible) > .5) { A.cible = c; reveil(); }
      });
      A.v = 260; reveil();
      return { impulsion: function () { A.v += (Math.random() < .5 ? -1 : 1) * 420; reveil(); } };
    }
  });

  /* ---------- Inertie et frottements ---------- */
  scene('freinage', 'inertie', 'jeu', '<div class="br-fr"><i class="br-fr-sol"></i><i class="br-fr-trace a"></i><i class="br-fr-trace b"></i>' +
    '<div class="br-fr-bloc"><i class="br-fr-vent"></i><i class="br-fr-vitre"></i><i class="br-fr-roue r1"></i><i class="br-fr-roue r2"></i></div></div>', { duree: 1500, label: 'Lancer et freiner' });
  scene('cube-roulant', 'inertie', 'jeu', '<div class="br-cu"><i class="br-cu-sol"></i><i class="br-cu-cube"></i></div>', { duree: 2100, label: 'Faire rouler le cube' });
  scene('glissade-inertie', 'inertie', 'jeu', function () {
    var s = '<div class="br-gi"><i class="br-gi-sol"></i><i class="br-gi-bloc"></i>';
    for (var i = 0; i < 4; i++) s += '<i class="br-gi-p" style="--i:' + i + '"></i>';
    return s + '</div>';
  }, { duree: 1400, label: 'Faire glisser le bloc' });

  /* ==========================================================================
     LOT 4 — KIT D'INTERFACE (data-brio sur l'élément natif ou son conteneur)
     ========================================================================== */
  function kit(nom, cat, init) { composant(nom, 'kit', cat, 'kit', init); }
  function mk(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function bouton(cls, html, label) { var b = mk('button', cls, html); b.type = 'button'; if (label) b.setAttribute('aria-label', label); return b; }
  function animer(el, images, o) {
    if (calme() || !el.animate) return null;
    try { return el.animate(images, o); } catch (_) { return null; }
  }
  var RESSORT_JS = null;
  function ressortJS() {
    if (RESSORT_JS == null) RESSORT_JS = window.CSS && CSS.supports && CSS.supports('animation-timing-function', 'linear(0, 1)') ? BR.courbeRessort({ amorti: .55, frequence: 13 }) : 'cubic-bezier(.34, 1.4, .64, 1)';
    return RESSORT_JS;
  }
  function nomChamp(el) {
    var l = el.labels && el.labels[0];
    return el.getAttribute('aria-label') || (l ? l.textContent.trim() : '') || el.getAttribute('title') || '';
  }
  function annonce(hote) { var s = mk('span', 'br-natif'); s.setAttribute('aria-live', 'polite'); hote.appendChild(s); return s; }

  /* ---------- Menu déroulant accessible (bouton + role=menu) ---------- */
  function menuDeroulant(o) {
    var ouvert = false, b = o.bouton, m = o.menu;
    b.setAttribute('aria-haspopup', 'menu');
    b.setAttribute('aria-expanded', 'false');
    if (!m.id) m.id = idCtl('menu');
    b.setAttribute('aria-controls', m.id);
    m.setAttribute('role', 'menu');
    m.hidden = true;
    function liste() { return o.items().filter(function (i) { return !i.disabled && !i.hidden; }); }
    function ouvrir(focus) {
      if (!ouvert) {
        ouvert = true;
        m.hidden = false;
        m.classList.remove('br-sort');
        b.setAttribute('aria-expanded', 'true');
        o.racine.classList.add('br-ouvert');
        if (o.surOuvrir) o.surOuvrir();
        relancer(m, 'br-entre');
        document.addEventListener('pointerdown', dehors, true);
      }
      var l = liste(), c = focus === 'dernier' ? l[l.length - 1] : focus && focus.nodeType ? focus : (o.initial && o.initial()) || l[0];
      if (c) c.focus();
    }
    function fermer(rendre) {
      if (!ouvert) return;
      ouvert = false;
      b.setAttribute('aria-expanded', 'false');
      o.racine.classList.remove('br-ouvert');
      document.removeEventListener('pointerdown', dehors, true);
      if (o.surFermer) o.surFermer();
      var fait = false;
      function cacher() { if (fait) return; fait = true; m.classList.remove('br-sort', 'br-entre'); if (!ouvert) m.hidden = true; }
      if (calme()) cacher(); else { m.classList.add('br-sort'); setTimeout(cacher, 170); }
      if (rendre) b.focus();
    }
    function dehors(e) { if (!o.racine.contains(e.target)) fermer(false); }
    b.addEventListener('click', function () { if (ouvert) fermer(false); else ouvrir(); });
    b.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); ouvrir(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); ouvrir('dernier'); }
    });
    m.addEventListener('keydown', function (e) {
      var l = liste(), i = l.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); var j = i + (e.key === 'ArrowDown' ? 1 : -1); l[(j + l.length) % l.length].focus(); }
      else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); l[e.key === 'Home' ? 0 : l.length - 1].focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fermer(true); }
      else if (e.key === 'Tab') fermer(false);
      else if (e.key.length === 1 && /\S/.test(e.key)) {
        var k = e.key.toLowerCase();
        for (var n = 1; n <= l.length; n++) { var c = l[(i + n) % l.length]; if (c.textContent.trim().toLowerCase().charAt(0) === k) { c.focus(); break; } }
      }
    });
    return { ouvrir: ouvrir, fermer: fermer, ouvert: function () { return ouvert; } };
  }
  function itemMenu(c, role) {
    c.classList.add('br-mi');
    c.setAttribute('role', role || 'menuitem');
    c.tabIndex = -1;
    if (c.tagName === 'BUTTON' && !c.hasAttribute('type')) c.type = 'button';
    return c;
  }

  kit('menu-categories', 'menus', function (el) {
    var items = [].filter.call(el.children, function (c) { return c.tagName === 'BUTTON' || c.tagName === 'A'; }), choix = 0;
    items.forEach(function (c, i) { if (c.hasAttribute('aria-current') || c.hasAttribute('data-actif')) choix = i; });
    var b = bouton('br-mc-bouton', '<span class="br-mc-titre">' + esc(el.dataset.titre || 'Catégorie') + '</span><span class="br-mc-valeur"></span>' + CHEVRON);
    var m = mk('div', 'br-menu br-mc-menu', '<i class="br-mc-surb" aria-hidden="true"></i>');
    items.forEach(function (c) { itemMenu(c, 'menuitemradio'); c.insertAdjacentHTML('beforeend', SVC(COCHE, 'br-mi-coche')); m.appendChild(c); });
    el.textContent = '';
    el.appendChild(b); el.appendChild(m);
    var valeur = b.querySelector('.br-mc-valeur'), surb = m.firstChild;
    function choisir(i, silence) {
      choix = i;
      items.forEach(function (c, k) { c.setAttribute('aria-checked', String(k === i)); });
      valeur.textContent = items[i].textContent.trim();
      if (!silence) { relancer(valeur, 'br-tic'); emit(el, 'change', { valeur: items[i].dataset.valeur || items[i].textContent.trim(), index: i }); }
    }
    function placer(it) {
      if (!it || it.parentNode !== m) { surb.classList.remove('on'); return; }
      surb.style.transform = 'translateY(' + it.offsetTop + 'px)';
      surb.style.height = it.offsetHeight + 'px';
      surb.classList.add('on');
    }
    var menu = menuDeroulant({ bouton: b, menu: m, racine: el, items: function () { return items; }, initial: function () { return items[choix]; } });
    m.addEventListener('pointerover', function (e) { placer(e.target.closest('.br-mi')); });
    m.addEventListener('focusin', function (e) { placer(e.target.closest('.br-mi')); });
    m.addEventListener('pointerleave', function () { placer(m.contains(document.activeElement) ? document.activeElement : null); });
    m.addEventListener('click', function (e) {
      var it = e.target.closest('.br-mi'); if (!it) return;
      choisir(items.indexOf(it));
      menu.fermer(true);
    });
    choisir(choix, true);
    return { choisir: choisir, ouvrir: menu.ouvrir, fermer: menu.fermer };
  });

  kit('sous-menu', 'menus', function (el) {
    var b = bouton('br-sm-bouton', '<span>' + esc(el.dataset.titre || 'Menu') + '</span>' + CHEVRON), m = mk('div', 'br-menu br-sm-menu'), groupes = [], minuteur = 0;
    var FLECHE = SVC('<path d="M10 7l5 5-5 5"/>', 'br-mi-fleche');
    [].slice.call(el.children).forEach(function (c) {
      if (c.tagName === 'BUTTON' || c.tagName === 'A') m.appendChild(itemMenu(c));
      else if (c.tagName === 'HR') { c.setAttribute('role', 'separator'); c.className = 'br-mi-sep'; m.appendChild(c); }
      else if (c.dataset.titre) {
        var g = mk('div', 'br-sm-groupe'), it = itemMenu(bouton('br-mi-sous', '<span>' + esc(c.dataset.titre) + '</span>' + FLECHE)), p = mk('div', 'br-menu br-sm-panneau');
        it.setAttribute('aria-haspopup', 'menu');
        it.setAttribute('aria-expanded', 'false');
        p.setAttribute('role', 'menu');
        p.setAttribute('aria-label', c.dataset.titre);
        p.hidden = true;
        [].slice.call(c.children).forEach(function (s) { if (s.tagName === 'BUTTON' || s.tagName === 'A') p.appendChild(itemMenu(s)); });
        g.appendChild(it); g.appendChild(p); m.appendChild(g);
        groupes.push({ g: g, it: it, p: p });
        c.remove();
      }
    });
    el.textContent = '';
    el.appendChild(b); el.appendChild(m);
    function principaux() { return [].filter.call(m.querySelectorAll('.br-mi'), function (i) { return i.parentNode === m || i.classList.contains('br-mi-sous'); }); }
    function sousItems(x) { return [].slice.call(x.p.querySelectorAll('.br-mi')); }
    function fermerSous(sauf) {
      groupes.forEach(function (x) { if (x !== sauf && !x.p.hidden) { x.p.hidden = true; x.it.setAttribute('aria-expanded', 'false'); x.g.classList.remove('br-ouvert'); } });
    }
    function ouvrirSous(x, focus) {
      clearTimeout(minuteur);
      fermerSous(x);
      if (x.p.hidden) {
        x.p.hidden = false;
        x.it.setAttribute('aria-expanded', 'true');
        x.g.classList.add('br-ouvert');
        x.p.classList.remove('br-gauche', 'br-dessous');
        var r = x.p.getBoundingClientRect();
        if (r.right > innerWidth - 8) {
          x.p.classList.add('br-gauche');
          r = x.p.getBoundingClientRect();
          if (r.left < 8) { x.p.classList.remove('br-gauche'); x.p.classList.add('br-dessous'); }
        }
        relancer(x.p, 'br-entre');
      }
      if (focus) sousItems(x)[0].focus();
    }
    var menu = menuDeroulant({ bouton: b, menu: m, racine: el, items: principaux, surFermer: function () { fermerSous(null); } });
    groupes.forEach(function (x) {
      x.g.addEventListener('pointerenter', function (e) { if (e.pointerType === 'touch') return; clearTimeout(minuteur); minuteur = setTimeout(function () { ouvrirSous(x, false); }, 110); });
      x.g.addEventListener('pointerleave', function (e) { if (e.pointerType === 'touch') return; clearTimeout(minuteur); minuteur = setTimeout(function () { if (!x.p.contains(document.activeElement)) fermerSous(null); }, 260); });
      x.it.addEventListener('click', function () { if (x.p.hidden) ouvrirSous(x, true); else fermerSous(null); });
      x.it.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') { e.preventDefault(); ouvrirSous(x, true); } });
      x.p.addEventListener('keydown', function (e) {
        var l = sousItems(x), i = l.indexOf(document.activeElement);
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { var j = i + (e.key === 'ArrowDown' ? 1 : -1); l[(j + l.length) % l.length].focus(); }
        else if (e.key === 'Home' || e.key === 'End') l[e.key === 'Home' ? 0 : l.length - 1].focus();
        else if (e.key === 'ArrowLeft' || e.key === 'Escape') { fermerSous(null); x.it.focus(); }
        else return;
        e.preventDefault(); e.stopPropagation();
      });
    });
    m.addEventListener('focusin', function (e) { if (e.target.parentNode === m) fermerSous(null); });
    m.addEventListener('click', function (e) {
      var it = e.target.closest('.br-mi'); if (!it || it.classList.contains('br-mi-sous')) return;
      var g = it.closest('.br-sm-panneau');
      emit(el, 'action', { action: it.dataset.action || it.textContent.trim(), groupe: g ? g.getAttribute('aria-label') : null });
      menu.fermer(true);
    });
    return { ouvrir: menu.ouvrir, fermer: menu.fermer };
  });

  var ACTIONS = {
    modifier: '<path d="M4 20h4L19 9l-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/>',
    renommer: '<path d="M4 20h4L19 9l-4-4L4 16Z"/>',
    dupliquer: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
    partager: '<circle cx="6.5" cy="12" r="2.3"/><circle cx="17.5" cy="6.5" r="2.3"/><circle cx="17.5" cy="17.5" r="2.3"/><path d="m8.6 10.9 6.8-3.3M8.6 13.1l6.8 3.3"/>',
    archiver: '<rect x="4" y="5" width="16" height="4" rx="1"/><path d="M5.5 9v9.5h13V9M10 13h4"/>',
    supprimer: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12.5h8L17 7M10.5 11v5M13.5 11v5"/>'
  };
  function cleAction(a) { return a.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s.*/, ''); }
  kit('menu-actions', 'menus', function (el) {
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    var actions = (el.dataset.actions || 'Modifier|Dupliquer|Supprimer').split('|').map(function (a) { return a.trim(); }).filter(Boolean);
    var b = bouton('br-ma-bouton', SVC('<circle cx="6" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="18" cy="12" r="1.4" fill="currentColor"/>'), el.dataset.label || 'Actions');
    var m = mk('div', 'br-menu br-ma-menu', actions.map(function (a) {
      var k = cleAction(a), danger = /^(suppr|effac|retir)/.test(k);
      return '<button type="button" class="br-mi' + (danger ? ' br-danger' : '') + '" data-action="' + esc(a) + '">' + SVC(ACTIONS[k] || '<circle cx="12" cy="12" r="2"/>') +
        '<span class="br-ma-t">' + esc(a) + '</span>' + (danger ? '<span class="br-ma-conf">Confirmer ?</span>' : '') + '</button>';
    }).join(''));
    [].forEach.call(m.children, function (c) { itemMenu(c); });
    el.appendChild(b); el.appendChild(m);
    var items = [].slice.call(m.children);
    function desarmer() { items.forEach(function (c) { c.classList.remove('br-arme'); }); }
    var menu = menuDeroulant({ bouton: b, menu: m, racine: el, items: function () { return items; }, surFermer: desarmer });
    m.addEventListener('click', function (e) {
      var it = e.target.closest('.br-mi'); if (!it) return;
      if (it.classList.contains('br-danger') && !it.classList.contains('br-arme')) { it.classList.add('br-arme'); relancer(it, 'br-secoue'); return; }
      emit(el, 'action', { action: it.dataset.action });
      menu.fermer(true);
    });
    m.addEventListener('focusout', function (e) { if (e.target.classList.contains('br-arme')) e.target.classList.remove('br-arme'); });
    el.addEventListener('contextmenu', function (e) {
      if (e.target.closest('.br-ma-menu') || e.shiftKey) return;
      e.preventDefault();
      var r = el.getBoundingClientRect();
      m.classList.add('br-au-pointeur');
      m.style.left = Math.min(e.clientX - r.left, r.width - 170) + 'px';
      m.style.top = (e.clientY - r.top) + 'px';
      if (menu.ouvert()) menu.fermer(false);
      menu.ouvrir();
    });
    b.addEventListener('click', function () { m.classList.remove('br-au-pointeur'); m.style.left = m.style.top = ''; }, true);
    return { ouvrir: menu.ouvrir, fermer: menu.fermer };
  });

  /* ---------- Bulles au survol (lien, contact) ---------- */
  function bulleSurvol(dec, bulle, hote) {
    var tO = 0, tF = 0, vu = false;
    bulle.id = bulle.id || idCtl('bulle');
    bulle.setAttribute('role', 'tooltip');
    bulle.hidden = true;
    var d = (dec.getAttribute('aria-describedby') || '').trim();
    dec.setAttribute('aria-describedby', (d ? d + ' ' : '') + bulle.id);
    function placer() {
      bulle.style.setProperty('--dx', '0px');
      bulle.classList.remove('br-dessous');
      var r = bulle.getBoundingClientRect(), dx = 0;
      if (r.left < 8) dx = 8 - r.left; else if (r.right > innerWidth - 8) dx = innerWidth - 8 - r.right;
      bulle.style.setProperty('--dx', dx + 'px');
      if (r.top < 8) bulle.classList.add('br-dessous');
    }
    function montrer(vite) {
      clearTimeout(tF);
      if (vu) return;
      clearTimeout(tO);
      tO = setTimeout(function () { vu = true; bulle.hidden = false; bulle.classList.remove('br-sort'); placer(); relancer(bulle, 'br-entre'); hote.classList.add('br-ouvert'); }, vite ? 0 : 220);
    }
    function cacher(vite) {
      clearTimeout(tO);
      if (!vu) return;
      clearTimeout(tF);
      tF = setTimeout(function () {
        vu = false; hote.classList.remove('br-ouvert');
        if (calme()) { bulle.hidden = true; return; }
        bulle.classList.add('br-sort');
        setTimeout(function () { if (!vu) { bulle.hidden = true; bulle.classList.remove('br-sort'); } }, 160);
      }, vite ? 0 : 140);
    }
    [dec, bulle].forEach(function (x) {
      x.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') montrer(); });
      x.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') cacher(); });
    });
    dec.addEventListener('focus', function () { montrer(true); });
    dec.addEventListener('blur', function () { cacher(true); });
    hote.addEventListener('keydown', function (e) { if (e.key === 'Escape' && vu) cacher(true); });
    return { montrer: montrer, cacher: cacher };
  }
  function envelopperHote(el, cls) {
    var h = mk('span', cls);
    el.parentNode.insertBefore(h, el);
    h.appendChild(el);
    return h;
  }

  kit('carte-lien', 'apercus', function (el) {
    var hote = envelopperHote(el, 'br-lk'), dom = '';
    try { dom = new URL(el.getAttribute('href') || '', location.href).hostname.replace(/^www\./, ''); } catch (_) {}
    var t = el.dataset.titre || el.textContent.trim(), x = el.dataset.texte || '';
    var b = mk('span', 'br-bulle br-lk-carte',
      '<span class="br-lk-tete"><i class="br-lk-ico">' + esc((t || dom || '?').charAt(0).toUpperCase()) + '</i><span class="br-lk-id"><b>' + esc(t) + '</b>' + (dom ? '<small>' + esc(dom) + '</small>' : '') + '</span></span>' +
      (x ? '<span class="br-lk-texte">' + esc(x) + '</span>' : '') + '<span class="br-lk-aller">Ouvrir le lien ' + SVC('<path d="M7 17 17 7M9 7h8v8"/>') + '</span>');
    hote.appendChild(b);
    bulleSurvol(el, b, hote);
    return {};
  });

  var STATUTS = { 'en-ligne': 'En ligne', absent: 'Absent', occupe: 'Occupé', 'hors-ligne': 'Hors ligne' };
  kit('apercu-survol', 'apercus', function (el) {
    var nom = el.dataset.nom || el.textContent.trim() || 'Contact', role = el.dataset.role || '', st = STATUTS[el.dataset.statut] ? el.dataset.statut : 'en-ligne';
    var ini = esc(el.dataset.initiales || nom.split(/\s+/).map(function (m) { return m.charAt(0); }).join('').slice(0, 2).toUpperCase());
    var hote = envelopperHote(el, 'br-as br-st-' + st);
    if (!/^(BUTTON|A)$/.test(el.tagName) && !el.hasAttribute('tabindex')) el.tabIndex = 0;
    el.insertAdjacentHTML('afterbegin', '<span class="br-as-av" aria-hidden="true">' + ini + '<i class="br-as-pt"></i></span>');
    var b = mk('span', 'br-bulle br-as-carte',
      '<span class="br-as-tete"><span class="br-as-av g" aria-hidden="true">' + ini + '<i class="br-as-pt"></i></span><span class="br-lk-id"><b>' + esc(nom) + '</b>' + (role ? '<small>' + esc(role) + '</small>' : '') + '</span></span>' +
      '<span class="br-as-statut"><i></i>' + STATUTS[st] + (el.dataset.heure ? ' · ' + esc(el.dataset.heure) : '') + '</span>' + (el.dataset.texte ? '<span class="br-lk-texte">' + esc(el.dataset.texte) + '</span>' : ''));
    hote.appendChild(b);
    bulleSurvol(el, b, hote);
    return {};
  });

  /* ---------- Contrôles ---------- */
  kit('filtres-pilules', 'controles', function (el) {
    if (!el.hasAttribute('role')) el.setAttribute('role', 'group');
    var pilules = [].filter.call(el.children, function (c) { return c.tagName === 'BUTTON'; }), effacer = null;
    pilules.forEach(function (p) {
      p.type = 'button';
      p.classList.add('br-fp-p');
      if (!p.hasAttribute('aria-pressed')) p.setAttribute('aria-pressed', 'false');
      var t = mk('span', 'br-fp-t');
      while (p.firstChild) t.appendChild(p.firstChild);
      p.innerHTML = '<span class="br-fp-fond" aria-hidden="true"></span>' + SVC(COCHE, 'br-fp-coche');
      p.appendChild(t);
      p.addEventListener('click', function () { p.setAttribute('aria-pressed', String(p.getAttribute('aria-pressed') !== 'true')); relancer(p, 'br-tic'); maj(); });
    });
    if (el.hasAttribute('data-effacer')) {
      effacer = bouton('br-fp-effacer', SVC('<path d="M7 7l10 10M17 7 7 17"/>') + '<span>Effacer</span>', 'Effacer les filtres');
      el.appendChild(effacer);
      effacer.addEventListener('click', function () { pilules.forEach(function (p) { p.setAttribute('aria-pressed', 'false'); }); maj(); (pilules[0] || el).focus(); });
    }
    function maj(silence) {
      var v = pilules.filter(function (p) { return p.getAttribute('aria-pressed') === 'true'; }).map(function (p) { return p.dataset.valeur || p.textContent.trim(); });
      el.classList.toggle('br-actifs', v.length > 0);
      if (effacer) effacer.hidden = !v.length;
      if (!silence) emit(el, 'change', { valeurs: v });
    }
    maj(true);
    return {};
  });

  kit('plus-moins', 'controles', function (el) {
    var s = el.tagName === 'DETAILS' && el.querySelector(':scope > summary');
    if (!s) return {};
    s.classList.add('br-pm-resume');
    s.insertAdjacentHTML('beforeend', '<span class="br-pm-ico" aria-hidden="true"><i></i><i class="v"></i></span>');
    var corps = mk('div', 'br-pm-corps'), anim = null;
    while (s.nextSibling) corps.appendChild(s.nextSibling);
    el.appendChild(corps);
    function basculer() {
      var ouvrir = !el.open || el.classList.contains('br-fermeture');
      relancer(s.querySelector('.br-pm-ico'), 'br-tic');
      if (anim) { anim.cancel(); anim = null; }
      if (ouvrir) {
        el.classList.remove('br-fermeture');
        el.open = true;
        anim = animer(corps, [{ height: '0px', opacity: 0 }, { height: corps.scrollHeight + 'px', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.2, .9, .3, 1)' });
        if (anim) anim.onfinish = function () { anim = null; };
      } else {
        el.classList.add('br-fermeture');
        anim = animer(corps, [{ height: corps.offsetHeight + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 260, easing: 'cubic-bezier(.4, 0, .9, .6)' });
        var fin = function () { anim = null; el.open = false; el.classList.remove('br-fermeture'); };
        if (anim) anim.onfinish = fin; else fin();
      }
      emit(el, 'change', { ouvert: ouvrir });
    }
    s.addEventListener('click', function (e) { e.preventDefault(); basculer(); });
    return { basculer: basculer };
  });

  kit('compteur-tambour', 'controles', function (el) {
    if (el.tagName !== 'INPUT') return {};
    var min = el.min !== '' ? +el.min : -Infinity, max = el.max !== '' ? +el.max : Infinity, pas = +el.step || 1;
    var v = el.value !== '' && !isNaN(+el.value) ? +el.value : (min > -Infinity ? min : 0), deci = (String(pas).split('.')[1] || '').length;
    var w = mk('span', 'br-tb', '');
    var moins = bouton('br-tb-b', SVC('<path d="M6 12h12"/>'), 'Diminuer'), plus = bouton('br-tb-b', SVC('<path d="M6 12h12M12 6v12"/>'), 'Augmenter');
    var t = mk('span', 'br-tb-tambour', '<span class="br-tb-col"></span>'), col = t.firstChild;
    t.setAttribute('role', 'spinbutton');
    t.tabIndex = 0;
    t.setAttribute('aria-label', nomChamp(el) || 'Valeur');
    if (min > -Infinity) t.setAttribute('aria-valuemin', min);
    if (max < Infinity) t.setAttribute('aria-valuemax', max);
    w.appendChild(moins); w.appendChild(t); w.appendChild(plus);
    el.classList.add('br-natif');
    el.tabIndex = -1;
    el.setAttribute('aria-hidden', 'true');
    el.parentNode.insertBefore(w, el.nextSibling);
    function txt(x) { return x.toFixed(deci).replace('.', ','); }
    function rendu() {
      var s = '';
      for (var k = -2; k <= 2; k++) { var x = v + k * pas; s += '<span style="--k:' + k + ';--o:' + (1 - Math.abs(k) * .42) + '"' + (k === 0 ? ' class="on"' : '') + '>' + (x < min || x > max ? '' : txt(x)) + '</span>'; }
      col.innerHTML = s;
      t.setAttribute('aria-valuenow', v);
      t.setAttribute('aria-valuetext', txt(v));
      moins.disabled = v - pas < min;
      plus.disabled = v + pas > max;
    }
    function regler(nv, sens) {
      nv = +borne(Math.round(nv / pas) * pas, min, max).toFixed(deci);
      if (nv === v) { relancer(t, 'br-secoue'); return; }
      sens = sens || (nv > v ? 1 : -1);
      v = nv;
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      rendu();
      animer(col, [{ transform: 'translateY(' + (sens * 24) + 'px)' }, { transform: 'none' }], { duration: 520, easing: ressortJS() });
      emit(el, 'change', { valeur: v });
    }
    moins.addEventListener('click', function () { regler(v - pas, -1); });
    plus.addEventListener('click', function () { regler(v + pas, 1); });
    t.addEventListener('keydown', function (e) {
      var d = { ArrowUp: pas, ArrowDown: -pas, PageUp: pas * 10, PageDown: -pas * 10 }[e.key];
      if (e.key === 'Home' && min > -Infinity) { e.preventDefault(); regler(min); }
      else if (e.key === 'End' && max < Infinity) { e.preventDefault(); regler(max); }
      else if (d) { e.preventDefault(); regler(v + d); }
    });
    var roue = 0;
    t.addEventListener('wheel', function (e) {
      e.preventDefault();
      var now = performance.now(); if (now - roue < 90) return; roue = now;
      regler(v + (e.deltaY < 0 ? pas : -pas));
    }, { passive: false });
    var g = null;
    t.addEventListener('pointerdown', function (e) { g = { y: e.clientY }; try { t.setPointerCapture(e.pointerId); } catch (_) {} });
    t.addEventListener('pointermove', function (e) {
      if (!g) return;
      var n = Math.trunc((g.y - e.clientY) / 18);
      if (n) { g.y -= n * 18; regler(v + n * pas, n > 0 ? 1 : -1); }
    });
    t.addEventListener('pointerup', function () { g = null; });
    t.addEventListener('pointercancel', function () { g = null; });
    rendu();
    return { valeur: function (x) { if (x == null) return v; regler(+x); } };
  });

  kit('theme-trois', 'controles', function (el) {
    if (el.tagName !== 'BUTTON') return {};
    el.type = 'button';
    var E = ['clair', 'systeme', 'sombre'], N = { clair: 'clair', systeme: 'système', sombre: 'sombre' }, m = idCtl('tt'), r = '', i = 1, tour = 0;
    for (var k = 0; k < 8; k++) {
      var a = k * Math.PI / 4;
      r += '<line x1="' + (12 + Math.cos(a) * 8.2).toFixed(2) + '" y1="' + (12 + Math.sin(a) * 8.2).toFixed(2) + '" x2="' + (12 + Math.cos(a) * 10.4).toFixed(2) + '" y2="' + (12 + Math.sin(a) * 10.4).toFixed(2) + '"/>';
    }
    var texte = el.hasAttribute('data-texte');
    el.innerHTML = '<span class="br-tt-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">' +
      '<mask id="' + m + '"><rect width="24" height="24" fill="#fff"/><circle class="br-tt-ombre" cx="12" cy="12" r="6.4" fill="#000" stroke="none"/></mask>' +
      '<g class="br-tt-rayons">' + r + '</g><circle class="br-tt-astre" cx="12" cy="12" r="5.2" fill="currentColor" stroke="none" mask="url(#' + m + ')"/>' +
      '<circle class="br-tt-contour" cx="12" cy="12" r="7.4"/><path class="br-tt-moitie" d="M12 4.6a7.4 7.4 0 0 1 0 14.8Z" fill="currentColor" stroke="none"/></svg></span>' +
      (texte ? '<span class="br-tt-txt" aria-hidden="true"></span>' : '');
    var applique = el.hasAttribute('data-applique'), racine = document.documentElement;
    if (applique) { var th = racine.getAttribute('data-theme'); i = th === 'dark' ? 2 : th === 'light' ? 0 : 1; }
    else if (E.indexOf(el.dataset.etat) >= 0) i = E.indexOf(el.dataset.etat);
    function regler(n, silence) {
      i = n;
      el.setAttribute('data-etat-theme', E[i]);
      el.setAttribute('aria-label', 'Thème : ' + N[E[i]] + ' (changer)');
      if (texte) el.querySelector('.br-tt-txt').textContent = N[E[i]].charAt(0).toUpperCase() + N[E[i]].slice(1);
      el.style.setProperty('--tour', (tour * 120) + 'deg');
      if (silence) return;
      if (applique) {
        if (E[i] === 'systeme') racine.removeAttribute('data-theme'); else racine.setAttribute('data-theme', E[i] === 'sombre' ? 'dark' : 'light');
        try { if (E[i] === 'systeme') localStorage.removeItem('brio-theme'); else localStorage.setItem('brio-theme', E[i] === 'sombre' ? 'dark' : 'light'); } catch (_) {}
      }
      relancer(el, 'br-tic');
      emit(el, 'change', { theme: E[i] });
    }
    el.addEventListener('click', function () { tour++; regler((i + 1) % 3); });
    regler(i, true);
    return { regler: function (e) { var n = E.indexOf(e); if (n >= 0) { tour++; regler(n); } } };
  });

  var ICO_GRILLE = '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>';
  var ICO_PILE = '<path d="M12 3.5 20.5 8 12 12.5 3.5 8Z"/><path d="m3.5 12 8.5 4.5 8.5-4.5"/><path d="m3.5 16 8.5 4.5 8.5-4.5"/>';
  kit('disposition', 'controles', function (el) {
    var cible = el.dataset.cible ? document.querySelector(el.dataset.cible) : null, mode = el.dataset.mode === 'pile' ? 'pile' : 'grille';
    el.setAttribute('role', 'group');
    if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', 'Disposition');
    el.innerHTML = '<i class="br-dp3-fond" aria-hidden="true"></i>';
    var bG = bouton('br-dp3-b', SVC(ICO_GRILLE), 'Grille'), bP = bouton('br-dp3-b', SVC(ICO_PILE), 'Pile en perspective');
    el.appendChild(bG); el.appendChild(bP);
    if (cible) cible.classList.add('br-dispo');
    function regler(m, silence) {
      mode = m;
      bG.setAttribute('aria-pressed', String(m === 'grille'));
      bP.setAttribute('aria-pressed', String(m === 'pile'));
      el.classList.toggle('br-mode-pile', m === 'pile');
      if (!cible) return;
      var enfants = [].slice.call(cible.children), avant = enfants.map(function (c) { return c.getBoundingClientRect(); });
      enfants.forEach(function (c, k) { c.style.setProperty('--k', k); });
      cible.classList.toggle('br-dispo-pile', m === 'pile');
      if (!silence) enfants.forEach(function (c, k) {
        var apres = c.getBoundingClientRect(), dx = avant[k].left - apres.left, dy = avant[k].top - apres.top;
        animer(c, [{ translate: dx + 'px ' + dy + 'px' }, { translate: '0 0' }], { duration: 560, easing: ressortJS(), delay: k * 25, fill: 'backwards' });
      });
      if (!silence) emit(el, 'change', { mode: m });
    }
    bG.addEventListener('click', function () { if (mode !== 'grille') regler('grille'); });
    bP.addEventListener('click', function () { if (mode !== 'pile') regler('pile'); });
    regler(mode, true);
    return { regler: regler };
  });

  /* ---------- Navigation ---------- */
  function ongletsClavier(liste, onglets, aller) {
    liste.addEventListener('keydown', function (e) {
      var l = onglets(), i = l.indexOf(document.activeElement);
      if (i < 0) return;
      var j = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? l.length - 1 : null;
      if (j == null) return;
      e.preventDefault();
      aller((j + l.length) % l.length, true);
    });
  }
  function suivreTaille(el, f) {
    if ('ResizeObserver' in window) new ResizeObserver(function () { f(); }).observe(el);
    addEventListener('resize', f);
  }

  kit('onglets-ab', 'navigation', function (el) {
    var panneaux = [].filter.call(el.children, function (c) { return c.nodeType === 1; });
    var liste = mk('div', 'br-ab-liste', '<i class="br-ab-ind" aria-hidden="true"></i>'), zone = mk('div', 'br-ab-zone'), ind = liste.firstChild, actif = -1;
    liste.setAttribute('role', 'tablist');
    if (el.getAttribute('aria-label')) { liste.setAttribute('aria-label', el.getAttribute('aria-label')); el.removeAttribute('aria-label'); }
    var onglets = panneaux.map(function (p, i) {
      var t = bouton('br-ab-o', '<b>' + esc(p.dataset.titre || String.fromCharCode(65 + i)) + '</b>' + (p.dataset.sous ? '<small>' + esc(p.dataset.sous) + '</small>' : ''));
      t.setAttribute('role', 'tab');
      t.id = idCtl('ab');
      p.id = p.id || idCtl('abp');
      t.setAttribute('aria-controls', p.id);
      p.setAttribute('role', 'tabpanel');
      p.setAttribute('aria-labelledby', t.id);
      p.tabIndex = 0;
      p.classList.add('br-ab-p');
      liste.appendChild(t); zone.appendChild(p);
      return t;
    });
    el.appendChild(liste); el.appendChild(zone);
    function placer() { var t = onglets[actif]; if (!t) return; ind.style.width = t.offsetWidth + 'px'; ind.style.transform = 'translateX(' + t.offsetLeft + 'px)'; }
    function aller(i, focus) {
      if (i === actif) { if (focus) onglets[i].focus(); return; }
      var avant = actif, sens = i > avant ? 1 : -1;
      actif = i;
      onglets.forEach(function (t, k) { t.setAttribute('aria-selected', String(k === i)); t.tabIndex = k === i ? 0 : -1; });
      placer();
      panneaux.forEach(function (p, k) { if (k !== i && k !== avant) p.hidden = true; });
      var nv = panneaux[i];
      nv.hidden = false;
      if (avant >= 0) {
        var ancien = panneaux[avant];
        var a = animer(ancien, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(' + (-sens * 14) + '%)' }], { duration: 220, easing: 'ease-in' });
        if (a) a.onfinish = function () { if (actif !== avant) ancien.hidden = true; }; else ancien.hidden = true;
        animer(nv, [{ opacity: 0, transform: 'translateX(' + (sens * 14) + '%)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: ressortJS() });
        relancer(onglets[i], 'br-tic');
        emit(el, 'change', { index: i, titre: onglets[i].textContent });
      }
      if (focus) onglets[i].focus();
    }
    liste.addEventListener('click', function (e) { var t = e.target.closest('.br-ab-o'); if (t) aller(onglets.indexOf(t)); });
    ongletsClavier(liste, function () { return onglets; }, aller);
    suivreTaille(liste, placer);
    var i0 = 0;
    panneaux.forEach(function (p, k) { if (p.hasAttribute('data-actif')) i0 = k; });
    aller(i0);
    return { aller: aller };
  });

  kit('onglets-fermables', 'navigation', function (el) {
    var barre = mk('div', 'br-of-barre'), liste = mk('div', 'br-of-liste', '<i class="br-of-ind" aria-hidden="true"></i>'), zone = mk('div', 'br-of-zone'), ind = liste.firstChild;
    liste.setAttribute('role', 'tablist');
    if (el.getAttribute('aria-label')) { liste.setAttribute('aria-label', el.getAttribute('aria-label')); el.removeAttribute('aria-label'); }
    var tabs = [], actif = null, nNouveau = 0, ajout = null;
    function creer(p) {
      var o = mk('div', 'br-of-o'), t = bouton('br-of-t', '<span>' + esc(p.dataset.titre || 'Onglet') + '</span>'), x = bouton('br-of-x', SVC('<path d="M7 7l10 10M17 7 7 17"/>'));
      o.setAttribute('role', 'presentation');
      t.setAttribute('role', 'tab');
      t.id = idCtl('of');
      t.setAttribute('aria-keyshortcuts', 'Delete');
      p.id = p.id || idCtl('ofp');
      t.setAttribute('aria-controls', p.id);
      p.setAttribute('role', 'tabpanel');
      p.setAttribute('aria-labelledby', t.id);
      p.tabIndex = 0;
      p.classList.add('br-of-p');
      p.hidden = true;
      x.tabIndex = -1;
      x.setAttribute('aria-hidden', 'true');
      x.title = 'Fermer';
      o.appendChild(t); o.appendChild(x);
      liste.appendChild(o); zone.appendChild(p);
      var e = { o: o, t: t, p: p };
      tabs.push(e);
      return e;
    }
    [].filter.call(el.children, function (c) { return c.nodeType === 1; }).forEach(creer);
    barre.appendChild(liste);
    if (el.hasAttribute('data-ajout')) {
      ajout = bouton('br-of-ajout', SVC('<path d="M12 6v12M6 12h12"/>'), 'Nouvel onglet');
      barre.appendChild(ajout);
    }
    el.appendChild(barre); el.appendChild(zone);
    function placer() { if (!actif || !actif.o.isConnected) return; ind.style.width = actif.o.offsetWidth + 'px'; ind.style.transform = 'translateX(' + (actif.o.offsetLeft - liste.scrollLeft * 0) + 'px)'; }
    function aller(e, focus) {
      actif = e;
      tabs.forEach(function (x) { var on = x === e; x.t.setAttribute('aria-selected', String(on)); x.t.tabIndex = on ? 0 : -1; x.o.classList.toggle('br-actif', on); x.p.hidden = !on; });
      placer();
      if (focus) e.t.focus();
      e.o.scrollIntoView && e.o.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      emit(el, 'change', { titre: e.t.textContent });
    }
    function fermer(e) {
      if (tabs.length < 2) { relancer(e.o, 'br-secoue'); return; }
      var i = tabs.indexOf(e), voisin = tabs[i + 1] || tabs[i - 1], focus = e.t === document.activeElement;
      tabs.splice(i, 1);
      if (actif === e) aller(voisin, focus); else if (focus) actif.t.focus();
      e.p.remove();
      e.o.style.pointerEvents = 'none';
      var a = animer(e.o, [{ width: e.o.offsetWidth + 'px', opacity: 1 }, { width: '0px', opacity: 0, transform: 'translateY(30%)' }], { duration: 240, easing: 'cubic-bezier(.4, 0, .2, 1)' });
      var fin = function () { e.o.remove(); placer(); };
      if (a) { a.onfinish = fin; var tic = function () { placer(); if (e.o.isConnected) requestAnimationFrame(tic); }; requestAnimationFrame(tic); } else fin();
      emit(el, 'fermer', { titre: e.t.textContent });
    }
    liste.addEventListener('click', function (ev) {
      var o = ev.target.closest('.br-of-o'); if (!o) return;
      var e = tabs.filter(function (x) { return x.o === o; })[0]; if (!e) return;
      if (ev.target.closest('.br-of-x')) fermer(e); else aller(e);
    });
    liste.addEventListener('auxclick', function (ev) { if (ev.button !== 1) return; var o = ev.target.closest('.br-of-o'); var e = tabs.filter(function (x) { return x.o === o; })[0]; if (e) { ev.preventDefault(); fermer(e); } });
    ongletsClavier(liste, function () { return tabs.map(function (x) { return x.t; }); }, function (i, f) { aller(tabs[i], f); });
    liste.addEventListener('keydown', function (ev) { if (ev.key !== 'Delete') return; var e = tabs.filter(function (x) { return x.t === document.activeElement; })[0]; if (e) { ev.preventDefault(); fermer(e); } });
    if (ajout) ajout.addEventListener('click', function () {
      nNouveau++;
      var p = mk('div', '', '<p>Contenu du nouvel onglet ' + nNouveau + '.</p>');
      p.dataset.titre = 'Nouveau ' + nNouveau;
      var e = creer(p);
      aller(e);
      var w = e.o.offsetWidth;
      animer(e.o, [{ width: '0px', opacity: 0 }, { width: w + 'px', opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.2, .9, .3, 1)' });
      emit(el, 'ajout', { titre: p.dataset.titre });
    });
    suivreTaille(liste, placer);
    liste.addEventListener('scroll', placer, { passive: true });
    if (tabs.length) aller(tabs.filter(function (x) { return x.p.hasAttribute('data-actif'); })[0] || tabs[0]);
    return { aller: function (i) { if (tabs[i]) aller(tabs[i]); }, fermer: function (i) { if (tabs[i]) fermer(tabs[i]); } };
  });

  kit('etapes', 'navigation', function (el) {
    var noms = (el.dataset.etapes || 'Panier|Livraison|Paiement').split('|'), n = noms.length, cur = borne(parseInt(el.dataset.actuelle, 10) || 0, 0, n);
    el.innerHTML = '<div class="br-et-cadre"><div class="br-et-piste" aria-hidden="true"><i></i></div><ol class="br-et-liste">' + noms.map(function (t, i) {
      return '<li class="br-et-e"><span class="br-et-rond" aria-hidden="true"><b>' + (i + 1) + '</b>' + SVC(COCHE, 'br-et-coche') + '</span><span class="br-et-txt"><small>Étape ' + (i + 1) + '</small>' + esc(t.trim()) + '</span></li>';
    }).join('') + '</ol></div>' + (el.hasAttribute('data-commandes') ? '<div class="br-et-cmd"><button type="button" class="br-et-b p">Précédent</button><button type="button" class="br-et-b s">Suivant</button></div>' : '');
    el.style.setProperty('--n', n);
    var lis = [].slice.call(el.querySelectorAll('.br-et-e')), rempli = el.querySelector('.br-et-piste i'), p = el.querySelector('.br-et-b.p'), s = el.querySelector('.br-et-b.s'), dit = annonce(el);
    function aller(i, silence) {
      i = borne(i, 0, n);
      var avant = cur;
      cur = i;
      lis.forEach(function (li, k) {
        li.classList.toggle('br-fait', k < i);
        li.classList.toggle('br-courant', k === i);
        if (k === i) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
        li.querySelector('.br-et-txt').setAttribute('aria-label', 'Étape ' + (k + 1) + ' : ' + noms[k] + (k < i ? ' (terminée)' : ''));
      });
      rempli.style.transform = 'scaleX(' + (n > 1 ? Math.min(i, n - 1) / (n - 1) : 1) + ')';
      if (p) p.disabled = i === 0;
      if (s) s.textContent = i >= n - 1 ? 'Terminer' : 'Suivant', s.disabled = i >= n;
      if (!silence) {
        if (lis[Math.min(i, n - 1)] && i !== avant) relancer(lis[i > avant ? Math.max(0, i - 1) : i] || lis[0], 'br-tic');
        dit.textContent = i >= n ? 'Toutes les étapes sont terminées.' : 'Étape ' + (i + 1) + ' sur ' + n + ' : ' + noms[i];
        emit(el, 'change', { etape: i, termine: i >= n });
      }
    }
    if (p) p.addEventListener('click', function () { aller(cur - 1); });
    if (s) s.addEventListener('click', function () { aller(cur + 1); });
    aller(cur, true);
    return { aller: aller, suivant: function () { aller(cur + 1); }, precedent: function () { aller(cur - 1); } };
  });

  var JOURS_C = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'], JOURS_L = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function lireIso(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], m[2] - 1, +m[3]) : null; }
  function plusJours(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  kit('selecteur-date', 'navigation', function (el) {
    if (el.tagName !== 'INPUT') return {};
    var N = 5, sel = lireIso(el.value) || new Date(), debut;
    sel = new Date(sel.getFullYear(), sel.getMonth(), sel.getDate());
    debut = plusJours(sel, -2);
    var w = mk('div', 'br-sd', '<div class="br-sd-mois" aria-hidden="true"></div><div class="br-sd-rang"></div>');
    var prec = bouton('br-sd-nav', SVC('<path d="M14 7l-5 5 5 5"/>'), 'Jours précédents'), suiv = bouton('br-sd-nav', SVC('<path d="M10 7l5 5-5 5"/>'), 'Jours suivants');
    var fen = mk('div', 'br-sd-fen', '<i class="br-sd-pilule" aria-hidden="true"></i><div class="br-sd-jours"></div>'), jours = fen.lastChild, pil = fen.firstChild;
    jours.setAttribute('role', 'radiogroup');
    jours.setAttribute('aria-label', nomChamp(el) || 'Date');
    w.lastChild.appendChild(prec); w.lastChild.appendChild(fen); w.lastChild.appendChild(suiv);
    el.classList.add('br-natif');
    el.tabIndex = -1;
    el.setAttribute('aria-hidden', 'true');
    el.parentNode.insertBefore(w, el.nextSibling);
    var mois = w.firstChild;
    function rendu() {
      var s = '';
      for (var k = 0; k < N; k++) {
        var d = plusJours(debut, k), on = +d === +sel;
        s += '<button type="button" role="radio" class="br-sd-j' + (iso(d) === iso(new Date()) ? ' br-auj' : '') + '" aria-checked="' + on + '" tabindex="-1" data-iso="' + iso(d) + '" aria-label="' +
          JOURS_L[d.getDay()] + ' ' + d.getDate() + ' ' + MOIS[d.getMonth()] + ' ' + d.getFullYear() + '"><small>' + JOURS_C[d.getDay()] + '</small><b>' + d.getDate() + '</b></button>';
      }
      jours.innerHTML = s;
      var b = jours.querySelector('[aria-checked="true"]') || jours.firstChild;
      b.tabIndex = 0;
      var idx = Math.round((sel - debut) / 864e5);
      pil.classList.toggle('on', idx >= 0 && idx < N);
      pil.style.setProperty('--x', borne(idx, -1, N));
      mois.textContent = MOIS[sel.getMonth()].charAt(0).toUpperCase() + MOIS[sel.getMonth()].slice(1) + ' ' + sel.getFullYear();
    }
    function decaler(n) {
      debut = plusJours(debut, n);
      rendu();
      animer(jours, [{ transform: 'translateX(' + (n * 100 / N) + '%)' }, { transform: 'none' }], { duration: 380, easing: ressortJS() });
    }
    function choisir(d, focus) {
      sel = d;
      var idx = Math.round((sel - debut) / 864e5);
      if (idx < 0) decaler(idx); else if (idx >= N) decaler(idx - N + 1); else rendu();
      el.value = iso(sel);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      emit(el, 'change', { date: el.value });
      if (focus) { var b = jours.querySelector('[aria-checked="true"]'); if (b) b.focus(); }
    }
    prec.addEventListener('click', function () { decaler(-1); });
    suiv.addEventListener('click', function () { decaler(1); });
    jours.addEventListener('click', function (e) { var b = e.target.closest('.br-sd-j'); if (b) choisir(lireIso(b.dataset.iso), true); });
    jours.addEventListener('keydown', function (e) {
      var d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 1, ArrowUp: -1, PageDown: 7, PageUp: -7 }[e.key];
      if (e.key === 'Home') { e.preventDefault(); var a = new Date(); choisir(new Date(a.getFullYear(), a.getMonth(), a.getDate()), true); }
      else if (d) { e.preventDefault(); choisir(plusJours(sel, d), true); }
    });
    rendu();
    if (!el.value) el.value = iso(sel);
    return { choisir: function (s) { var d = lireIso(s); if (d) choisir(d); } };
  });

  kit('points-etapes', 'navigation', function (el) {
    var cible = el.dataset.cible ? document.querySelector(el.dataset.cible) : null;
    var n = cible ? cible.children.length : borne(parseInt(el.dataset.nombre, 10) || 5, 2, 12), cur = 0;
    if (!el.hasAttribute('role')) el.setAttribute('role', 'group');
    if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', 'Pagination');
    var s = '<i class="br-pt-ind" aria-hidden="true"></i>';
    for (var i = 0; i < n; i++) s += '<button type="button" class="br-pt-p" aria-label="Élément ' + (i + 1) + ' sur ' + n + '"></button>';
    el.innerHTML = s;
    el.style.setProperty('--n', n);
    var pts = [].slice.call(el.querySelectorAll('.br-pt-p'));
    function aller(i, focus, depuisCible) {
      i = borne(i, 0, n - 1);
      el.classList.toggle('br-vers-droite', i > cur);
      el.classList.toggle('br-vers-gauche', i < cur);
      var change = i !== cur;
      cur = i;
      el.style.setProperty('--c', i);
      pts.forEach(function (p, k) { if (k === i) p.setAttribute('aria-current', 'true'); else p.removeAttribute('aria-current'); p.tabIndex = k === i ? 0 : -1; });
      if (focus) pts[i].focus();
      if (cible && !depuisCible) cible.children[i].scrollIntoView({ behavior: calme() ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
      if (change) emit(el, 'change', { index: i });
    }
    el.addEventListener('click', function (e) { var p = e.target.closest('.br-pt-p'); if (p) aller(pts.indexOf(p)); });
    ongletsClavier(el, function () { return pts; }, aller);
    if (cible) {
      var raf = 0;
      cible.addEventListener('scroll', function () {
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = 0;
          var r = cible.getBoundingClientRect(), mx = r.left + r.width / 2, best = 0, dmin = Infinity;
          [].forEach.call(cible.children, function (c, k) { var q = c.getBoundingClientRect(), d = Math.abs(q.left + q.width / 2 - mx); if (d < dmin) { dmin = d; best = k; } });
          if (best !== cur) aller(best, false, true);
        });
      }, { passive: true });
    }
    aller(0);
    return { aller: aller };
  });

  /* ---------- Indicateurs ---------- */
  function pourcent(el) {
    var min = el.tagName === 'PROGRESS' ? 0 : +el.min || 0, max = +el.max || 1;
    return max > min ? borne((+el.value - min) / (max - min), 0, 1) : 0;
  }
  function compterVers(span, de, a) {
    if (calme()) { span.textContent = Math.round(a) + ' %'; return; }
    var t0 = performance.now();
    (function pas(t) {
      var k = Math.min(1, (t - t0) / 600), e = 1 - Math.pow(1 - k, 3);
      span.textContent = Math.round(de + (a - de) * e) + ' %';
      if (k < 1) requestAnimationFrame(pas);
    })(t0);
  }
  kit('jauge-segments', 'indicateurs', function (el) {
    if (el.tagName !== 'METER' && el.tagName !== 'PROGRESS') return {};
    var w = mk('span', 'br-jg', '<span class="br-jg-barres">' + [0, 1, 2, 3].map(function (i) { return '<i style="--i:' + i + '"><b></b></i>'; }).join('') + '</span><span class="br-jg-val">0 %</span>');
    w.setAttribute('aria-hidden', 'true');
    el.classList.add('br-natif');
    el.parentNode.insertBefore(w, el.nextSibling);
    var barres = w.querySelectorAll('.br-jg-barres b'), val = w.lastChild, aff = 0;
    function maj() {
      var p = pourcent(el);
      [].forEach.call(barres, function (b, i) { b.style.setProperty('--f', borne(p * 4 - i, 0, 1).toFixed(3)); });
      w.dataset.niveau = p < .34 ? 'bas' : p < .67 ? 'moyen' : 'haut';
      compterVers(val, aff, p * 100);
      aff = p * 100;
    }
    new MutationObserver(maj).observe(el, { attributes: true, attributeFilter: ['value', 'min', 'max'] });
    maj();
    return { valeur: function (v) { el.value = v; } };
  });

  kit('barre-segments', 'indicateurs', function (el) {
    if (el.tagName !== 'METER' && el.tagName !== 'PROGRESS') return {};
    var n = borne(parseInt(el.dataset.segments, 10) || 10, 3, 20), s = '';
    for (var i = 0; i < n; i++) s += '<i></i>';
    var w = mk('span', 'br-bs', '<span class="br-bs-coque">' + s + (el.hasAttribute('data-charge') ? SVC('<path d="M13 3 6 13.5h5L10 21l7-10.5h-5Z" fill="currentColor"/>', 'br-bs-eclair') : '') + '</span><span class="br-bs-val">0 %</span>');
    w.setAttribute('aria-hidden', 'true');
    el.classList.add('br-natif');
    el.parentNode.insertBefore(w, el.nextSibling);
    var segs = w.querySelectorAll('.br-bs-coque i'), val = w.querySelector('.br-bs-val'), k0 = 0, aff = 0;
    function maj() {
      var p = pourcent(el), k = Math.round(p * n);
      [].forEach.call(segs, function (g, j) {
        var on = j < k;
        g.style.transitionDelay = (calme() ? 0 : on ? Math.max(0, j - k0) * 45 : Math.max(0, k0 - 1 - j) * 35) + 'ms';
        g.classList.toggle('on', on);
      });
      w.dataset.niveau = p <= .2 ? 'bas' : p <= .45 ? 'moyen' : 'haut';
      compterVers(val, aff, p * 100);
      aff = p * 100; k0 = k;
    }
    new MutationObserver(maj).observe(el, { attributes: true, attributeFilter: ['value', 'min', 'max'] });
    maj();
    return { valeur: function (v) { el.value = v; } };
  });

  var FORMES_TL = {
    plateau: ['<path d="M12 4v10.5M7.5 10 12 14.5 16.5 10"/>', '<path d="M4.5 15.5v2.5A1.5 1.5 0 0 0 6 19.5h12a1.5 1.5 0 0 0 1.5-1.5v-2.5"/>'],
    nuage: ['<path d="M12 10.5v9M9 16.5l3 3 3-3"/>', '<path d="M7.5 17H7a4 4 0 0 1-.6-7.95A6 6 0 0 1 17.6 8.4 4.3 4.3 0 0 1 17.5 17H17"/>'],
    fleche: ['<path d="M12 4v12M7 11l5 5 5-5"/>', '<path d="M6 20h12"/>']
  };
  kit('icones-telechargement', 'indicateurs', function (el) {
    if (el.tagName !== 'BUTTON') return {};
    el.type = 'button';
    var f = FORMES_TL[el.dataset.forme] || FORMES_TL.plateau, nom = el.getAttribute('aria-label') || 'Télécharger', etat = 'repos';
    el.innerHTML = '<svg class="br-tl-anneau" viewBox="0 0 44 44" aria-hidden="true"><circle class="f" cx="22" cy="22" r="20"/><circle class="p" cx="22" cy="22" r="20" pathLength="100"/></svg>' +
      SVC('<g class="br-tl-fleche">' + f[0] + '</g><g class="br-tl-base">' + f[1] + '</g><path class="br-tl-coche" d="M7.5 12.5l3 3 6-6.5" pathLength="100"/>', 'br-tl-ico');
    el.setAttribute('aria-label', nom);
    var dit = annonce(el), minuteur = 0;
    function regler(e) {
      etat = e;
      el.dataset.etat = e;
      el.setAttribute('aria-busy', String(e === 'cours'));
    }
    function avancer(p) { if (etat !== 'cours') return; el.style.setProperty('--p', borne(p, 0, 1).toFixed(3)); }
    function terminer(ok, message) {
      if (etat !== 'cours') return;
      clearInterval(minuteur);
      if (ok === false) {
        regler('erreur'); relancer(el, 'br-secoue'); dit.textContent = message || 'Échec du téléchargement.';
        setTimeout(function () { if (etat === 'erreur') { regler('repos'); el.style.setProperty('--p', 0); } }, 1400);
        return;
      }
      avancer(1); regler('fini'); dit.textContent = 'Téléchargement terminé.';
      emit(el, 'fin', {});
    }
    el.addEventListener('click', function () {
      if (etat === 'cours') return;
      if (etat === 'fini') { regler('repos'); el.style.setProperty('--p', 0); dit.textContent = ''; return; }
      regler('cours'); el.style.setProperty('--p', 0); dit.textContent = 'Téléchargement en cours.';
      emit(el, 'telechargement', { avancer: avancer, terminer: terminer });
      if (el.hasAttribute('data-demo')) {
        var p = 0;
        minuteur = setInterval(function () { p += .06 + Math.random() * .12; if (p >= 1) terminer(true); else avancer(p); }, calme() ? 60 : 200);
      }
    });
    regler('repos');
    return { avancer: avancer, terminer: terminer };
  });

  /* ==========================================================================
     LOT 4 — EFFETS DE POINTEUR (data-brio sur un conteneur, ou sur <body>)
     ========================================================================== */
  function pointeur(nom, init) { composant(nom, 'pointeur', 'pointeur', 'pointeur', init); }
  function positionner(el) { if (el !== document.body && getComputedStyle(el).position === 'static') el.style.position = 'relative'; }
  function couleursAccent(el) {
    var cs = getComputedStyle(el);
    return [cs.getPropertyValue('--br-accent').trim() || '#6a45ff', cs.getPropertyValue('--br-accent-2').trim() || '#ff5ea8'];
  }

  pointeur('trainee', function (el) {
    var corps = el === document.body, forme = /^(points|etincelles)$/.test(el.dataset.forme) ? el.dataset.forme : 'ruban', VIE = forme === 'ruban' ? .42 : .6;
    positionner(el);
    var cv = mk('canvas', 'br-tr-toile');
    cv.setAttribute('aria-hidden', 'true');
    if (corps) cv.style.position = 'fixed';
    el.appendChild(cv);
    var ctx = cv.getContext('2d'), W = 0, H = 0, pts = [], parts = [], coul = couleursAccent(el);
    function taille() {
      var d = Math.min(window.devicePixelRatio || 1, 2);
      W = corps ? innerWidth : el.clientWidth; H = corps ? innerHeight : el.clientHeight;
      cv.width = Math.round(W * d); cv.height = Math.round(H * d);
      ctx.setTransform(d, 0, 0, d, 0, 0);
    }
    taille();
    if (corps) addEventListener('resize', taille); else suivreTaille(el, taille);
    var reveil = moteur(function (dt) {
      var t = performance.now() / 1000;
      pts = pts.filter(function (p) { return t - p.t < VIE; });
      parts = parts.filter(function (p) { p.vie -= dt; p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; return p.vie > 0; });
      ctx.clearRect(0, 0, W, H);
      ctx.lineCap = 'round';
      if (forme === 'ruban') {
        for (var i = 1; i < pts.length; i++) {
          var a = pts[i - 1], b = pts[i], k = 1 - (t - b.t) / VIE;
          ctx.globalAlpha = k * .9;
          ctx.strokeStyle = i / pts.length > .5 ? coul[1] : coul[0];
          ctx.lineWidth = Math.max(.5, 10 * k);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      } else if (forme === 'points') {
        pts.forEach(function (p, i) {
          var k = 1 - (t - p.t) / VIE;
          ctx.globalAlpha = k * .8; ctx.fillStyle = coul[i % 2];
          ctx.beginPath(); ctx.arc(p.x, p.y, 2 + 6 * k, 0, 6.283); ctx.fill();
        });
      }
      parts.forEach(function (p) {
        ctx.globalAlpha = Math.min(1, p.vie / .3); ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * Math.min(1, p.vie / .5 + .3), 0, 6.283); ctx.fill();
      });
      ctx.globalAlpha = 1;
      return pts.length > 0 || parts.length > 0;
    });
    var cible = corps ? window : el;
    cible.addEventListener('pointermove', function (e) {
      if (calme()) return;
      var r = corps ? { left: 0, top: 0 } : el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      pts.push({ x: x, y: y, t: performance.now() / 1000 });
      if (pts.length > 80) pts.shift();
      if (forme === 'etincelles') for (var k = 0; k < 2; k++) parts.push({ x: x, y: y, vx: (Math.random() - .5) * 220, vy: -Math.random() * 220 - 40, vie: .5 + Math.random() * .4, r: 1.5 + Math.random() * 2.5, c: coul[k] });
      reveil();
    }, { passive: true });
    el.addEventListener('pointerenter', function () { coul = couleursAccent(el); });
    return {};
  });

  pointeur('suiveur', function (el) {
    var corps = el === document.body;
    positionner(el);
    var a = mk('i', 'br-sv-anneau', '<span class="br-sv-label"></span>'), p = mk('i', 'br-sv-point'), lab = a.firstChild;
    [a, p].forEach(function (x) { x.setAttribute('aria-hidden', 'true'); if (corps) x.style.position = 'fixed'; el.appendChild(x); });
    if (el.hasAttribute('data-masquer')) el.classList.add('br-sv-masque');
    var k = calme() ? 2000 : 190, c = calme() ? 90 : 21;
    var X = new Ressort(0, k, c), Y = new Ressort(0, k, c), S = new Ressort(1, 260, 20), dedans = false, appui = false, cible = null;
    var reveil = moteur(function (dt) {
      var m = X.pas(dt) | Y.pas(dt) | S.pas(dt);
      a.style.transform = 'translate(' + X.x.toFixed(1) + 'px,' + Y.x.toFixed(1) + 'px)';
      a.style.setProperty('--s', S.x.toFixed(3));
      return !!m;
    });
    function viser() { S.cible = (cible ? (cible.dataset.curseur ? 3 : 1.9) : 1) * (appui ? .75 : 1); reveil(); }
    (corps ? window : el).addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      var r = corps ? { left: 0, top: 0 } : el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      X.cible = x; Y.cible = y;
      if (!dedans) { X.x = x; Y.x = y; dedans = true; el.classList.add('br-sv-actif'); }
      p.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      var c2 = e.target.closest && e.target.closest('a, button, input, select, textarea, label, summary, [data-curseur], [role="button"]');
      if (c2 && !el.contains(c2)) c2 = null;
      if (c2 !== cible) {
        cible = c2;
        lab.textContent = c2 && c2.dataset.curseur || '';
        el.classList.toggle('br-sv-lien', !!c2);
        el.classList.toggle('br-sv-texte', !!(c2 && c2.dataset.curseur));
      }
      viser();
    }, { passive: true });
    el.addEventListener('pointerleave', function () { dedans = false; cible = null; el.classList.remove('br-sv-actif', 'br-sv-lien', 'br-sv-texte'); viser(); });
    el.addEventListener('pointerdown', function () { appui = true; viser(); });
    addEventListener('pointerup', function () { if (appui) { appui = false; viser(); } });
    return {};
  });

  pointeur('lampe', function (el) {
    positionner(el);
    var v = mk('i', 'br-lp-voile');
    v.setAttribute('aria-hidden', 'true');
    el.appendChild(v);
    el.classList.add('br-lampe-' + (el.dataset.forme === 'halo' ? 'halo' : 'ombre'));
    var r = parseFloat(el.dataset.rayon);
    if (r > 0) el.style.setProperty('--br-rayon-lampe', r + 'px');
    var k = calme() ? 2000 : 150, c = calme() ? 90 : 19, X = new Ressort(0, k, c), Y = new Ressort(0, k, c), pret = false;
    var reveil = moteur(function (dt) {
      var m = X.pas(dt) | Y.pas(dt);
      el.style.setProperty('--lx', X.x.toFixed(1) + 'px');
      el.style.setProperty('--ly', Y.x.toFixed(1) + 'px');
      return !!m;
    });
    function viser(x, y) {
      X.cible = x; Y.cible = y;
      if (!pret) { X.x = x; Y.x = y; pret = true; }
      el.classList.add('br-allumee');
      reveil();
    }
    el.addEventListener('pointermove', function (e) { var q = el.getBoundingClientRect(); viser(e.clientX - q.left, e.clientY - q.top); }, { passive: true });
    el.addEventListener('pointerleave', function () { if (!el.contains(document.activeElement) || !el.matches(':focus-within')) { el.classList.remove('br-allumee'); pret = false; } });
    el.addEventListener('focusin', function (e) {
      var q = el.getBoundingClientRect(), t = e.target.getBoundingClientRect();
      viser(t.left - q.left + t.width / 2, t.top - q.top + t.height / 2);
    });
    el.addEventListener('focusout', function (e) { if (!el.contains(e.relatedTarget)) { el.classList.remove('br-allumee'); pret = false; } });
    return {};
  });

  /* ==========================================================================
     LOT 5 — CARTES EN ÉVENTAIL (data-brio sur un conteneur de cartes, ou vide)
     S'ouvre au survol, au focus clavier, ou au toucher ; data-ouvert = toujours ouvert.
     ========================================================================== */
  var DEMO_KT = [['Aurore', 'Lever de soleil', 262], ['Lagune', 'Eau calme', 192], ['Braise', 'Feu de camp', 14], ['Menthe', 'Fraîcheur', 152],
    ['Orage', 'Ciel chargé', 228], ['Sable', 'Dune dorée', 38], ['Prune', 'Fin d’été', 318], ['Givre', 'Matin d’hiver', 205]];
  var PRIX = ['0,50 €', '1,20 €', '2,00 €', '0,80 €', '1,50 €', '3,00 €', '0,20 €', '1,00 €'];
  var FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]';
  var survolFin = window.matchMedia ? matchMedia('(hover: hover) and (pointer: fine)') : { matches: true };
  function carteDemo(k, timbre) {
    var d = DEMO_KT[k % DEMO_KT.length];
    return timbre
      ? '<div class="br-kt-demo" style="--t:' + d[2] + '"><div class="br-kt-timbre"><i class="br-kt-art"></i><b>' + d[0] + '</b><small>' + PRIX[k % PRIX.length] + '</small></div></div>'
      : '<div class="br-kt-demo" style="--t:' + d[2] + '"><i class="br-kt-art"></i><b>' + d[0] + '</b><small>' + d[1] + '</small></div>';
  }
  function eventail(nom, defaut, disposition, x) {
    x = x || {};
    composant(nom, 'cartes', 'eventails', 'cartes', function (el) {
      var cartes = [].filter.call(el.children, function (c) { return c.nodeType === 1; });
      if (!cartes.length) {
        var s = '', n0 = borne(parseInt(el.dataset.nombre, 10) || defaut, 2, 10);
        for (var k = 0; k < n0; k++) s += carteDemo(k, x.timbre);
        el.innerHTML = s;
        cartes = [].slice.call(el.children);
      }
      cartes.forEach(function (c, i) {
        c.classList.add('br-kt-carte');
        c.style.setProperty('--i', i);
        if (!c.matches(FOCUSABLE) && !c.querySelector(FOCUSABLE)) c.tabIndex = 0;
      });
      el.classList.add('br-cartes', 'br-kt-init');
      if (!el.hasAttribute('role')) el.setAttribute('role', 'group');
      if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', el.dataset.label || 'Cartes');
      var o = { angle: parseFloat(el.dataset.angle), ecart: parseFloat(el.dataset.ecart), decalage: parseFloat(el.dataset.decalage), graine: 1 };
      var fixe = !!x.toujours || el.hasAttribute('data-ouvert'), dedans = false, foc = false, touche = false, survol = -1, ouvert = null;
      function maj() {
        var nv = fixe || dedans || foc || touche, change = nv !== ouvert && ouvert !== null;
        if (nv && !ouvert && x.nouvelleDonne) o.graine++;
        ouvert = nv;
        el.classList.toggle('br-ouvert', ouvert);
        var n = cartes.length, k = { W: el.clientWidth, H: el.clientHeight, w: cartes[0].offsetWidth, h: cartes[0].offsetHeight, ouvert: ouvert, survol: survol, o: o };
        if (!k.W || !k.w) return;
        cartes.forEach(function (c, i) {
          var p = disposition(i, n, k);
          c.style.transformOrigin = p.origine || '50% 50%';
          c.style.transform = 'translate(' + (p.x || 0).toFixed(1) + 'px,' + (p.y || 0).toFixed(1) + 'px) rotate(' + (p.r || 0).toFixed(2) + 'deg) translateY(calc(var(--lev, 0) * -16px)) scale(calc(' + (p.s || 1).toFixed(3) + ' + var(--lev, 0) * .05))';
          c.style.zIndex = p.z != null ? p.z : i + 1;
          if (change) c.style.transitionDelay = (calme() ? 0 : ouvert ? i * (x.delai || 35) : (n - 1 - i) * 22) + 'ms';
        });
        if (change) emit(el, 'change', { ouvert: ouvert });
      }
      el.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch' && survolFin.matches) { dedans = true; maj(); } });
      el.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') { dedans = false; survol = -1; maj(); } });
      el.addEventListener('focusin', function () { foc = true; maj(); });
      el.addEventListener('focusout', function (e) { if (!el.contains(e.relatedTarget)) { foc = false; maj(); } });
      el.addEventListener('pointerover', function (e) {
        var c = e.target.closest && e.target.closest('.br-kt-carte');
        var i = c ? cartes.indexOf(c) : -1;
        if (i !== survol) { survol = i; if (x.suitSurvol) maj(); }
      });
      el.addEventListener('click', function (e) {
        if (survolFin.matches || fixe) return;
        if (!touche) { touche = true; e.preventDefault(); maj(); }
        else if (!e.target.closest('.br-kt-carte')) { touche = false; maj(); }
      }, true);
      document.addEventListener('pointerdown', function (e) { if (touche && !el.contains(e.target)) { touche = false; maj(); } });
      el.addEventListener('keydown', function (e) { if (e.key === 'Escape' && (foc || touche)) { touche = false; if (el.contains(document.activeElement)) document.activeElement.blur(); foc = false; maj(); } });
      if (x.reglages && el.hasAttribute('data-reglages')) x.reglages(el, o, maj);
      suivreTaille(el, maj);
      maj();
      requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.remove('br-kt-init'); }); });
      return { ouvrir: function (v) { touche = v !== false; maj(); }, actualiser: maj };
    });
  }
  function pivot(k, R) { return '50% ' + (k.h + R).toFixed(1) + 'px'; }
  function angleMax(k, R, n, voulu) {
    var amax = Math.asin(borne((k.W / 2 - k.w * .55) / (R + k.h * .85), .05, 1)) * 180 / Math.PI;
    return Math.min(voulu, amax / Math.max(.5, (n - 1) / 2));
  }

  eventail('cartes-arc', 5, function (i, n, k) {
    var c = i - (n - 1) / 2, R = k.h * 2.6;
    if (!k.ouvert) return { r: c * 2, y: -i * 1.5, origine: pivot(k, R) };
    return { r: c * angleMax(k, R, n, isNaN(k.o.angle) ? 11 : k.o.angle), origine: pivot(k, R) };
  });

  eventail('cartes-arc-serre', 7, function (i, n, k) {
    var c = i - (n - 1) / 2, R = k.h * 3;
    if (!k.ouvert) return { r: c * 1.4, y: -i * 1.2, origine: pivot(k, R) };
    var a = angleMax(k, R, n, isNaN(k.o.angle) ? 7 : k.o.angle), r = c * a;
    if (k.survol >= 0 && i !== k.survol) { var d = i - k.survol; r += (d > 0 ? 1 : -1) * a * .8 * Math.exp(-(Math.abs(d) - 1) * .8); }
    return { r: r, origine: pivot(k, R) };
  }, { suitSurvol: true });

  eventail('cartes-arc-long', 5, function (i, n, k) {
    var c = i - (n - 1) / 2;
    if (!k.ouvert) return { x: c * 3, y: -i * 1.5, r: c * 1.5, origine: '50% 100%' };
    var pas = Math.min(k.w * .95, (k.W - k.w - 24) / Math.max(1, n - 1));
    return { x: c * pas, y: c * c * 7, r: c * 6, origine: '50% 100%' };
  });

  eventail('cartes-ligne', 5, function (i, n, k) {
    var c = i - (n - 1) / 2;
    if (!k.ouvert) return { x: c * 4, y: -i * 2, origine: '50% 50%' };
    var pas = Math.min(k.w + (isNaN(k.o.ecart) ? 14 : k.o.ecart), (k.W - k.w - 16) / Math.max(1, n - 1));
    return { x: c * pas, origine: '50% 50%' };
  });

  // pivot fixe en bas à gauche du conteneur (position en CSS), cartes du vertical (0°) à l'horizontale (90°)
  eventail('cartes-coin', 5, function (i, n, k) {
    var R = 20;
    if (!k.ouvert) return { r: i * 2, origine: pivot(k, R) };
    return { r: i * Math.min(isNaN(k.o.angle) ? 22 : k.o.angle, 90 / Math.max(1, n - 1)), origine: pivot(k, R) };
  });

  eventail('cartes-timbres', 5, function (i, n, k) {
    var c = i - (n - 1) / 2, arc = isNaN(k.o.angle) ? 8 : k.o.angle, g = isNaN(k.o.ecart) ? 14 : k.o.ecart, d = isNaN(k.o.decalage) ? 10 : k.o.decalage;
    var deb = k.h * Math.sin(Math.abs(arc * (n - 1) / 2) * Math.PI / 180);
    var pas = Math.min(k.w * .58 + g, (k.W - k.w - 16 - deb) / Math.max(1, n - 1));
    return { x: c * pas, y: Math.abs(c) * d, r: c * arc, origine: '50% 100%' };
  }, {
    toujours: true, timbre: true,
    reglages: function (el, o, maj) {
      var r = mk('div', 'br-kt-reglages');
      [['angle', 'Arc', 0, 20, 8, '°'], ['ecart', 'Écart', 0, 50, 14, ' px'], ['decalage', 'Décalage', 0, 30, 10, ' px']].forEach(function (q) {
        var id = idCtl('kt'), v = isNaN(o[q[0]]) ? q[4] : o[q[0]];
        r.insertAdjacentHTML('beforeend', '<label for="' + id + '">' + q[1] + ' <input id="' + id + '" type="range" min="' + q[2] + '" max="' + q[3] + '" value="' + v + '"><output>' + v + q[5] + '</output></label>');
        var inp = r.querySelector('#' + id);
        inp.addEventListener('input', function () { o[q[0]] = +inp.value; inp.nextSibling.textContent = inp.value + q[5]; maj(); });
      });
      el.parentNode.insertBefore(r, el.nextSibling);
    }
  });

  eventail('cartes-cascade', 5, function (i, n, k) {
    if (!k.ouvert) return { y: -i * 1.5, x: i * 1.5, origine: '50% 50%' };
    var dx = Math.min(36, (k.W - k.w - 24) / Math.max(1, n - 1)), dy = Math.min(36, (k.H - k.h - 30) / Math.max(1, n - 1));
    return { x: (i - (n - 1) / 2) * dx, y: -(n - 1 - i) * dy, r: -2 + i, origine: '50% 50%' };
  });

  eventail('cartes-donne', 5, function (i, n, k) {
    if (!k.ouvert) return { y: -i * 1.2, r: (alea(i + 3) - .5) * 5, origine: '50% 50%' };
    var g = k.o.graine * 13 + i * 7;
    return { x: (alea(g + 1) - .5) * (k.W - k.w - 20), y: (alea(g + 2) - .5) * Math.max(0, k.H - k.h - 40) * .8 - 8, r: (alea(g + 3) - .5) * 56, origine: '50% 50%' };
  }, { delai: 70, nouvelleDonne: true });

  eventail('cartes-roue', 5, function (i, n, k) {
    var R = k.h * .38, ext = Math.max(.3, Math.min(.85, (k.W / 2 - 12) / (k.h + R + k.w * .3)));
    if (!k.ouvert) return { r: (i - (n - 1) / 2) * 2, s: ext, origine: pivot(k, R) };
    return { r: -80 + i * 160 / Math.max(1, n - 1), s: ext, origine: pivot(k, R) };
  });

  /* ==========================================================================
     LOT 5 — CARROUSELS 3D (data-brio sur un conteneur d'éléments, ou vide)
     Glisser, molette, flèches du clavier, boutons, clic sur un élément voisin.
     ========================================================================== */
  function demoCarrousel(n, dates) {
    var s = '', j = new Date();
    for (var k = 0; k < n; k++) {
      var d = DEMO_KT[k % DEMO_KT.length], q = plusJours(j, -k * 3), date = k === 0 ? 'Aujourd’hui' : q.getDate() + ' ' + MOIS_C[q.getMonth()];
      s += '<figure class="br-car-demo" style="--t:' + d[2] + '" data-titre="' + (dates ? date : d[0]) + '"><i class="br-kt-art"></i><figcaption><b>' + d[0] + '</b><small>' + (dates ? date : d[1]) + '</small></figcaption></figure>';
    }
    return s;
  }
  var MOIS_C = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  function modulo(a, n) { return ((a % n) + n) % n; }
  var memoFocus = 'data-br-tab';
  function rendreInerte(it, inerte) {
    it.setAttribute('aria-hidden', String(inerte));
    [].forEach.call(it.querySelectorAll(FOCUSABLE), function (f) {
      if (inerte) { if (!f.hasAttribute(memoFocus)) f.setAttribute(memoFocus, f.getAttribute('tabindex') || ''); f.tabIndex = -1; }
      else if (f.hasAttribute(memoFocus)) { var v = f.getAttribute(memoFocus); if (v === '') f.removeAttribute('tabindex'); else f.setAttribute('tabindex', v); f.removeAttribute(memoFocus); }
    });
  }
  function carrousel(nom, cfg) {
    composant(nom, 'cartes', 'carrousels', 'carrousel', function (el) {
      var items = [].filter.call(el.children, function (c) { return c.nodeType === 1; });
      if (!items.length) { el.innerHTML = demoCarrousel(cfg.demo || 8, cfg.dates); items = [].slice.call(el.children); }
      var n = items.length, vertical = !!cfg.vertical;
      el.setAttribute('role', 'region');
      el.setAttribute('aria-roledescription', 'carrousel');
      if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', el.dataset.label || 'Carrousel');
      el.classList.add('br-car', 'br-car-' + cfg.cls);
      if (el.hasAttribute('data-mono')) el.classList.add('br-car-mono');
      var vue = mk('div', 'br-car-vue'), scene3d = mk('div', 'br-car-scene'), piste = mk('div', 'br-car-piste');
      vue.tabIndex = 0;
      vue.setAttribute('aria-label', 'Zone de défilement : flèches ' + (vertical ? 'haut et bas' : 'gauche et droite'));
      items.forEach(function (it, i) {
        it.classList.add('br-car-el');
        it.setAttribute('role', 'group');
        it.setAttribute('aria-roledescription', 'diapositive');
        it.setAttribute('aria-label', (i + 1) + ' sur ' + n + (it.dataset.titre ? ' : ' + it.dataset.titre : ''));
        piste.appendChild(it);
      });
      scene3d.appendChild(piste); vue.appendChild(scene3d);
      var cmd = mk('div', 'br-car-cmd');
      // à la verticale (pile temporelle) : le haut mène vers le plus ancien (index +1)
      var dA = vertical ? 1 : -1, dB = -dA;
      var prec = bouton('br-car-b', SVC(vertical ? '<path d="M7 14l5-5 5 5"/>' : '<path d="M14 7l-5 5 5 5"/>'), vertical ? 'Plus ancien' : 'Précédent');
      var suiv = bouton('br-car-b', SVC(vertical ? '<path d="M7 10l5 5 5-5"/>' : '<path d="M10 7l5 5-5 5"/>'), vertical ? 'Plus récent' : 'Suivant');
      var titre = mk('span', 'br-car-titre'), pause = null;
      titre.setAttribute('aria-hidden', 'true');
      cmd.appendChild(prec); cmd.appendChild(titre); cmd.appendChild(suiv);
      el.appendChild(vue);
      var echelle = null;
      if (cfg.echelle) { echelle = mk('div', 'br-car-echelle'); el.appendChild(echelle); }
      el.appendChild(cmd);
      var dit = annonce(el);
      var auto = parseInt(el.dataset.auto, 10), minAuto = 0, arretAuto = false;
      if (auto > 0 && !calme()) {
        pause = bouton('br-car-b br-car-pause', SVC('<path d="M9 6v12M15 6v12"/>'), 'Mettre en pause le défilement');
        cmd.insertBefore(pause, cmd.firstChild);
        dit.setAttribute('aria-live', 'off');
      }
      var cur = borne(parseInt(el.dataset.depart, 10) || 0, 0, n - 1), P = new Ressort(cur, 130, 21), ctx = {};
      function mesurer() {
        ctx.W = vue.clientWidth; ctx.H = vue.clientHeight; ctx.w = items[0].offsetWidth; ctx.h = items[0].offsetHeight; ctx.n = n;
        var k = cfg.taille ? cfg.taille(ctx) : 1;
        scene3d.style.transform = 'scale(' + k.toFixed(3) + ')';
        ctx.k = k;
      }
      function rendu() { if (ctx.w) cfg.rendu(P.x, items, ctx, piste); }
      var reveil = moteur(function (dt) { var a = P.pas(dt); rendu(); return a; });
      function cible(i) {
        if (!cfg.boucle) return borne(i, 0, n - 1);
        var base = Math.round(P.cible), d = modulo(i - modulo(base, n), n);
        return base + (d > n / 2 ? d - n : d);
      }
      function aller(t, silence) {
        if (!cfg.boucle) t = borne(t, 0, n - 1);
        P.cible = t;
        var c = cfg.boucle ? modulo(t, n) : t, change = c !== cur;
        cur = c;
        items.forEach(function (it, i) { it.classList.toggle('br-courant', i === cur); rendreInerte(it, i !== cur); });
        titre.textContent = items[cur].dataset.titre || (cur + 1) + ' / ' + n;
        relancer(titre, 'br-tic');
        if (!cfg.boucle) { prec.disabled = cur + dA < 0 || cur + dA > n - 1; suiv.disabled = cur + dB < 0 || cur + dB > n - 1; }
        if (echelle) [].forEach.call(echelle.querySelectorAll('.br-car-cran'), function (b, i) { b.classList.toggle('br-actif', i === cur); if (i === cur) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
        if (echelle) echelle.style.setProperty('--p', n > 1 ? cur / (n - 1) : 0);
        if (change && !silence) { dit.textContent = (cur + 1) + ' sur ' + n + (items[cur].dataset.titre ? ' : ' + items[cur].dataset.titre : ''); emit(el, 'change', { index: cur }); }
        reveil();
      }
      function pas(d) { aller(cfg.boucle ? Math.round(P.cible) + d : cur + d); }
      prec.addEventListener('click', function () { pas(dA); });
      suiv.addEventListener('click', function () { pas(dB); });
      el.addEventListener('keydown', function (e) {
        if (e.target.closest && e.target.closest('input, textarea, select, .br-car-el')) return;
        var d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: vertical ? -1 : 1, ArrowUp: vertical ? 1 : -1 }[e.key];
        if (e.key === 'Home') { e.preventDefault(); aller(cfg.boucle ? cible(0) : 0); }
        else if (e.key === 'End') { e.preventDefault(); aller(cfg.boucle ? cible(n - 1) : n - 1); }
        else if (d) { e.preventDefault(); pas(d); }
      });
      if (echelle) {
        var s = '<i class="br-car-curseur" aria-hidden="true"></i>';
        items.forEach(function (it, i) { s += '<button type="button" class="br-car-cran" aria-label="Aller à ' + esc(it.dataset.titre || String(i + 1)) + '"><span>' + esc(it.dataset.titre || String(i + 1)) + '</span></button>'; });
        echelle.innerHTML = s;
        echelle.setAttribute('role', 'group');
        echelle.setAttribute('aria-label', 'Chronologie');
        echelle.addEventListener('click', function (e) { var b = e.target.closest('.br-car-cran'); if (b) aller([].indexOf.call(echelle.querySelectorAll('.br-car-cran'), b)); });
      }
      // glisser
      var g = null;
      vue.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button) return;
        g = { a: vertical ? e.clientY : e.clientX, p: P.x, t: performance.now(), v: 0, der: vertical ? e.clientY : e.clientX, bouge: false, id: e.pointerId, cible: e.target };
      });
      vue.addEventListener('pointermove', function (e) {
        if (!g) return;
        var q = vertical ? e.clientY : e.clientX, dq = q - g.a, now = performance.now();
        if (!g.bouge && Math.abs(dq) > 6) { g.bouge = true; try { vue.setPointerCapture(g.id); } catch (_) {} vue.classList.add('br-glisse'); }
        if (!g.bouge) return;
        var u = cfg.unite(ctx) * (ctx.k || 1);
        var p = g.p - dq / u * (vertical ? -1 : 1);
        if (!cfg.boucle) { if (p < 0) p *= .35; if (p > n - 1) p = n - 1 + (p - n + 1) * .35; }
        P.x = P.cible = p; P.v = 0;
        g.v = -(q - g.der) / u / Math.max(.008, (now - g.t) / 1000) * (vertical ? -1 : 1); g.der = q; g.t = now;
        rendu();
      });
      function lacher() {
        if (!g) return;
        var gg = g; g = null;
        vue.classList.remove('br-glisse');
        if (gg.bouge) { vue._brGlisse = true; setTimeout(function () { vue._brGlisse = false; }, 0); }
        if (!gg.bouge) {
          var it = gg.cible.closest && gg.cible.closest('.br-car-el');
          if (it) { var i = items.indexOf(it); if (i !== cur) aller(cfg.boucle ? cible(i) : i); }
          return;
        }
        aller(Math.round(P.x + borne(gg.v * .18, -2.5, 2.5)));
      }
      vue.addEventListener('pointerup', lacher);
      vue.addEventListener('pointercancel', lacher);
      vue.addEventListener('click', function (e) { if (vue._brGlisse) { e.preventDefault(); e.stopPropagation(); } }, true);
      var cumul = 0, tMol = 0;
      vue.addEventListener('wheel', function (e) {
        var d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (!d) return;
        e.preventDefault();
        cumul += d;
        var now = performance.now();
        if (Math.abs(cumul) > 40 && now - tMol > 160) { tMol = now; pas((cumul > 0 ? 1 : -1) * (vertical ? -1 : 1)); cumul = 0; }
      }, { passive: false });
      // défilement automatique, en pause au survol, au focus ou sur demande
      if (pause) {
        var survolA = false, focA = false;
        var tic = function () { if (!arretAuto && !survolA && !focA && el.isConnected && !document.hidden) pas(1); };
        minAuto = setInterval(tic, Math.max(1500, auto));
        el.addEventListener('pointerenter', function () { survolA = true; });
        el.addEventListener('pointerleave', function () { survolA = false; });
        el.addEventListener('focusin', function (e) { if (e.target !== pause) focA = true; });
        el.addEventListener('focusout', function () { focA = false; });
        pause.addEventListener('click', function () {
          arretAuto = !arretAuto;
          pause.setAttribute('aria-label', arretAuto ? 'Reprendre le défilement' : 'Mettre en pause le défilement');
          pause.innerHTML = SVC(arretAuto ? '<path d="M8 6l10 6-10 6Z"/>' : '<path d="M9 6v12M15 6v12"/>');
        });
      }
      suivreTaille(vue, function () { mesurer(); rendu(); });
      mesurer();
      aller(cur, true);
      P.x = cur; rendu();
      return { aller: function (i) { aller(cfg.boucle ? cible(i) : i); }, suivant: function () { pas(1); }, precedent: function () { pas(-1); } };
    });
  }

  carrousel('carrousel-cylindre', {
    cls: 'cylindre', boucle: true,
    rayon: function (ctx) { return ctx.w / 2 / Math.tan(Math.PI / ctx.n) + 16; },
    taille: function (ctx) { var r = this.rayon(ctx); return Math.min(1, ctx.W / (2 * r + ctx.w * .4)); },
    unite: function (ctx) { return Math.max(60, 2 * Math.PI * this.rayon(ctx) / ctx.n * .8); },
    rendu: function (pos, items, ctx, piste) {
      var n = items.length, pasA = 360 / n, r = this.rayon(ctx);
      piste.style.transform = 'translateZ(' + (-r).toFixed(1) + 'px) rotateY(' + (-pos * pasA).toFixed(2) + 'deg)';
      items.forEach(function (it, i) {
        var rel = (i - pos) * pasA * Math.PI / 180, c = Math.cos(rel);
        it.style.transform = 'rotateY(' + (i * pasA) + 'deg) translateZ(' + r.toFixed(1) + 'px)';
        it.style.opacity = (.18 + .82 * Math.max(0, c)).toFixed(3);
        it.style.setProperty('--ombre', (1 - Math.max(0, c)).toFixed(3));
        it.style.pointerEvents = c > .3 ? '' : 'none';
      });
    }
  });

  carrousel('carrousel-coverflow', {
    cls: 'coverflow',
    taille: function (ctx) { return Math.min(1, ctx.W / (ctx.w * 3.4)); },
    unite: function (ctx) { return ctx.w * .55; },
    rendu: function (pos, items, ctx) {
      var g1 = ctx.w * .62, g2 = ctx.w * .3;
      items.forEach(function (it, i) {
        var d = i - pos, ad = Math.abs(d), sg = d < 0 ? -1 : 1;
        var x = sg * (ad < 1 ? ad * g1 : g1 + (ad - 1) * g2), z = -Math.min(ad, 1) * 140 - Math.max(0, ad - 1) * 36, rot = -borne(d, -1, 1) * 52;
        it.style.transform = 'translateX(' + x.toFixed(1) + 'px) translateZ(' + z.toFixed(1) + 'px) rotateY(' + rot.toFixed(2) + 'deg)';
        it.style.zIndex = Math.round(100 - ad * 10);
        it.style.opacity = ad > 4.2 ? 0 : ad > 3.2 ? (4.2 - ad).toFixed(3) : 1;
        it.style.setProperty('--ombre', Math.min(1, ad * .6).toFixed(3));
      });
    }
  });

  carrousel('pile-temporelle', {
    cls: 'temporelle', vertical: true, echelle: true, dates: true, demo: 7,
    taille: function (ctx) { return Math.min(1, (ctx.W - 8) / ctx.w); },
    unite: function () { return 70; },
    rendu: function (pos, items) {
      items.forEach(function (it, i) {
        var d = i - pos, t;
        if (d >= 0) t = 'translateY(' + (-d * 26).toFixed(1) + 'px) translateZ(' + (-d * 90).toFixed(1) + 'px)';
        else t = 'translateY(' + (-d * 60).toFixed(1) + 'px) translateZ(' + (-d * 160).toFixed(1) + 'px)';
        it.style.transform = t;
        it.style.zIndex = Math.round(100 - d * 10);
        it.style.opacity = d >= 0 ? Math.max(0, 1 - d * .16).toFixed(3) : Math.max(0, 1 + d * 1.6).toFixed(3);
        it.style.setProperty('--ombre', Math.max(0, Math.min(1, d * .22)).toFixed(3));
        it.style.pointerEvents = d > -.5 && d < 6 ? '' : 'none';
      });
    }
  });

  /* ==========================================================================
     LOT 5 — MORPHINGS (scènes en boucle : clic = pause)
     ========================================================================== */
  function morph(nom, html, x) {
    x = x || {};
    x.famille = 'morphing';
    scene(nom, 'morphing', 'boucle', '<div class="br-mf">' + html + '</div>', x);
  }
  morph('morph-squircle-cercle', '<i class="br-mf-forme"></i>');
  morph('morph-losange-squircle', '<i class="br-mf-forme"></i>');
  morph('morph-capsule-carre', '<i class="br-mf-forme"></i>');
  morph('morph-gelee', '<i class="br-mf-ombre"></i><i class="br-mf-forme"><i></i></i>');
  morph('morph-blob', '<i class="br-mf-forme"></i><i class="br-mf-forme b"></i>');
  morph('morph-pincement', '<i class="br-mf-forme"></i>');
  morph('morph-goutte-orbite', '<i class="br-mf-axe"></i><i class="br-mf-orbite"><i class="br-mf-forme"></i></i>');
  morph('morph-accordeon', '<i class="br-mf-ombre"></i><i class="br-mf-forme"></i>');
  morph('morph-croissants', '<i class="br-mf-forme a"></i><i class="br-mf-forme b"></i>');
  morph('morph-etoile-croix', '<i class="br-mf-forme"></i>');
  morph('morph-onde-goutte', '<i class="br-mf-onde"></i><i class="br-mf-onde o2"></i><i class="br-mf-onde o3"></i><i class="br-mf-surface"></i><i class="br-mf-forme"></i><i class="br-mf-eclat"></i>');
  function superEllipse(n, a, b, cx, cy) {
    var d = '';
    for (var k = 0; k < 96; k++) {
      var t = k / 96 * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
      d += (k ? 'L' : 'M') + (cx + a * (c < 0 ? -1 : 1) * Math.pow(Math.abs(c), 2 / n)).toFixed(2) + ' ' + (cy + b * (s < 0 ? -1 : 1) * Math.pow(Math.abs(s), 2 / n)).toFixed(2);
    }
    return d + 'Z';
  }
  morph('morph-superellipse', svgSc('<defs><linearGradient id="br-mf-dg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" class="br-mf-s1"/><stop offset="1" class="br-mf-s2"/></linearGradient></defs>' +
    '<path class="br-mf-chemin" d="' + superEllipse(2.6, 46, 46, 90, 65) + '"/><path class="br-mf-trace" d="' + superEllipse(2.6, 46, 46, 90, 65) + '"/>'), {
    init: function (el) {
      var ch = el.querySelector('.br-mf-chemin'), tr = el.querySelector('.br-mf-trace'), v = 0, avant = null, tl = 0;
      boucleVisible(el, function (t) {
        var dt = avant == null ? 0 : t - avant;
        avant = t;
        if (el.classList.contains('br-pause')) return;
        if (!v) v = parseFloat(getComputedStyle(el).getPropertyValue('--br-v')) || 1;
        tl += Math.min(dt, .05) * v;
        var n = 2.6 + 2.1 * Math.sin(tl * 1.6);
        ch.setAttribute('d', superEllipse(n, 46, 46, 90, 65));
        tr.setAttribute('d', superEllipse(n, 54, 54, 90, 65));
        el.style.setProperty('--n', n.toFixed(2));
      });
    }
  });

  /* ==========================================================================
     LOT 6 — GRAPHIQUES (data-brio sur un conteneur vide ; données en attributs)
     data-valeurs="1,2,3"  data-etiquettes="A|B|C"  data-series="Nom:1,2,3|Nom2:4,5,6"
     data-titre, data-unite, data-hauteur (px). Tableau de données caché pour les
     lecteurs d'écran, survol + flèches du clavier, apparition animée.
     ========================================================================== */
  function graphe(nom, cat, init) { composant(nom, 'graphiques', cat, 'graphe', init); }
  function nombres(s, def) {
    if (!s) return def.slice();
    var l = s.split(/[;,\s]+/).filter(Boolean).map(function (x) { return parseFloat(x.replace(',', '.')); }).filter(function (x) { return !isNaN(x); });
    return l.length ? l : def.slice();
  }
  function libelles(s, def) { return s ? s.split('|').map(function (x) { return x.trim(); }) : def.slice(); }
  function series(s, def) {
    if (!s) return def;
    return s.split('|').map(function (p) { var q = p.split(':'); return { nom: q[0].trim(), valeurs: nombres(q[1] || '', [0]) }; });
  }
  var FMT = window.Intl ? new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }) : { format: String };
  function fmt(v, u) { return FMT.format(v) + (u || ''); }
  function somme(l) { return l.reduce(function (a, b) { return a + b; }, 0); }
  var MOIS_DEF = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
  var JOURS_DEF = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  // coque commune : en-tête, zone de dessin, bulle, légende, tableau caché
  function coque(el, titre, cls) {
    el.classList.add('br-gx');
    (cls || '').split(/\s+/).filter(Boolean).forEach(function (c) { el.classList.add(c); });
    el.setAttribute('role', 'figure');
    var h = parseFloat(el.dataset.hauteur);
    el.innerHTML = '<div class="br-gx-tete"><div class="br-gx-titres"><span class="br-gx-titre">' + esc(el.dataset.titre || titre) + '</span><b class="br-gx-valeur"></b><small class="br-gx-sous"></small></div><div class="br-gx-outils"></div></div>' +
      '<div class="br-gx-zone" tabindex="0"' + (h > 0 ? ' style="height:' + h + 'px"' : '') + '><div class="br-gx-bulle" hidden></div></div><div class="br-gx-legende"></div>';
    var z = el.querySelector('.br-gx-zone');
    el.setAttribute('aria-label', el.dataset.titre || titre);
    z.setAttribute('aria-label', (el.dataset.titre || titre) + ' : flèches pour parcourir les valeurs');
    var dit = annonce(el), table = mk('table', 'br-natif');
    el.appendChild(table);
    return {
      tete: el.querySelector('.br-gx-tete'), valeur: el.querySelector('.br-gx-valeur'), sous: el.querySelector('.br-gx-sous'), outils: el.querySelector('.br-gx-outils'),
      zone: z, bulle: el.querySelector('.br-gx-bulle'), legende: el.querySelector('.br-gx-legende'), dit: dit,
      tableau: function (entetes, lignes) {
        table.innerHTML = '<caption>' + esc(el.dataset.titre || titre) + '</caption><tr>' + entetes.map(function (t) { return '<th scope="col">' + esc(t) + '</th>'; }).join('') + '</tr>' +
          lignes.map(function (l) { return '<tr>' + l.map(function (c, i) { return i ? '<td>' + esc(c) + '</td>' : '<th scope="row">' + esc(c) + '</th>'; }).join('') + '</tr>'; }).join('');
      },
      montrer: function (x, y, html, clavier) {
        var b = this.bulle;
        b.innerHTML = html; b.hidden = false;
        var W = z.clientWidth, bw = b.offsetWidth, bh = b.offsetHeight;
        b.style.left = borne(x - bw / 2, 0, Math.max(0, W - bw)) + 'px';
        b.style.top = Math.max(0, y - bh - 12) + 'px';
        if (clavier) dit.textContent = [].map.call(b.children, function (c) { return c.textContent; }).join(', ');
      },
      cacher: function () { this.bulle.hidden = true; }
    };
  }
  // déclenche rappel(p) de 0 à 1 à la première apparition à l'écran
  function apparition(el, rappel, duree) {
    var fait = false;
    function jouer() {
      if (fait) return; fait = true;
      if (calme()) { rappel(1); return; }
      var t0 = performance.now(), d = duree || 900;
      (function pas(t) { var k = Math.min(1, (t - t0) / d); rappel(1 - Math.pow(1 - k, 3)); if (k < 1) requestAnimationFrame(pas); })(t0);
    }
    rappel(0);
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); jouer(); } }, { threshold: .3 });
      io.observe(el);
    } else jouer();
    return function () { fait = false; jouer(); };
  }
  function couleursGraphe(el) {
    var cs = getComputedStyle(el), v = function (n, d) { return cs.getPropertyValue(n).trim() || d; };
    return { texte: v('--br-gx-c', '') || v('--br-texte', '#16141b'), accent: v('--br-accent', '#6a45ff'), accent2: v('--br-accent-2', '#ff5ea8'), danger: v('--br-danger', '#dc3545'), attenue: v('--br-attenue', '#6c6777'), ligne: v('--br-ligne', '#d8d4e0') };
  }
  var abonnesTheme = [];
  function surTheme(f) {
    if (!abonnesTheme.length) {
      var tout = function () { abonnesTheme = abonnesTheme.filter(function (x) { return x.el.isConnected; }); abonnesTheme.forEach(function (x) { x.f(); }); };
      if (window.matchMedia) { var mq = matchMedia('(prefers-color-scheme: dark)'); if (mq.addEventListener) mq.addEventListener('change', tout); }
      new MutationObserver(function () { setTimeout(tout, 30); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
    }
    abonnesTheme.push(f);
  }
  // parcours au clavier d'une liste de positions (gauche / droite, début / fin, Échap)
  function navigation(z, n, aller) {
    var i = -1;
    z.addEventListener('keydown', function (e) {
      var d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (e.key === 'Home') i = 0; else if (e.key === 'End') i = n() - 1; else if (e.key === 'Escape') i = -1;
      else if (d) i = i < 0 ? (d > 0 ? 0 : n() - 1) : borne(i + d, 0, n() - 1); else return;
      e.preventDefault(); aller(i, true);
    });
    z.addEventListener('blur', function () { i = -1; aller(-1); });
    return function (v) { i = v; };
  }

  /* ---------- Trame ordonnée (matrice de Bayer 4 × 4) sur canvas ----------
     On peint en basse résolution (1 cellule = data-cellule px, 3 par défaut) avec
     des couleurs-codes : rouge = accent, vert = couleur 2, bleu = couleur de base ;
     l'alpha donne l'intensité. Chaque cellule devient un point si l'intensité
     dépasse le seuil de la matrice. */
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  var CODE = { accent: 'rgba(255,0,0,', deux: 'rgba(0,255,0,', base: 'rgba(0,0,255,' };
  function rgba(code, a) { return CODE[code] + borne(a, 0, 1).toFixed(3) + ')'; }
  function Trame(zone, cellule, rond) {
    this.cv = mk('canvas', 'br-tg-toile');
    this.cv.setAttribute('aria-hidden', 'true');
    zone.insertBefore(this.cv, zone.firstChild);
    this.ctx = this.cv.getContext('2d');
    this.bas = document.createElement('canvas');
    this.bctx = this.bas.getContext('2d', { willReadFrequently: true });
    this.p = cellule || 3; this.rond = !!rond; this.W = 0; this.H = 0;
  }
  Trame.prototype.taille = function () {
    var W = this.cv.clientWidth, H = this.cv.clientHeight, d = Math.min(window.devicePixelRatio || 1, 2);
    if (!W || !H) return false;
    if (W !== this.W || H !== this.H) {
      this.W = W; this.H = H;
      this.cv.width = Math.round(W * d); this.cv.height = Math.round(H * d);
      this.ctx.setTransform(d, 0, 0, d, 0, 0);
      this.lw = Math.ceil(W / this.p); this.lh = Math.ceil(H / this.p);
      this.bas.width = this.lw; this.bas.height = this.lh;
    }
    return true;
  };
  // peindre(ctx, W, H) en coordonnées CSS ; couleurs = { accent, deux, base }
  Trame.prototype.rendre = function (peindre, couleurs) {
    if (!this.taille()) return;
    var b = this.bctx, p = this.p, lw = this.lw, lh = this.lh, W = this.W, H = this.H;
    b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, lw, lh);
    b.setTransform(1 / p, 0, 0, 1 / p, 0, 0);
    peindre(b, W, H);
    var d = b.getImageData(0, 0, lw, lh).data, c = this.ctx, s = p * .78, r = p * .42, cles = ['accent', 'deux', 'base'];
    c.clearRect(0, 0, W, H);
    for (var k = 0; k < 3; k++) {
      c.fillStyle = couleurs[cles[k]] || couleurs.base;
      if (this.rond) c.beginPath();
      for (var y = 0; y < lh; y++) for (var x = 0; x < lw; x++) {
        var i = (y * lw + x) * 4, a = d[i + 3];
        if (!a) continue;
        var R = d[i], G = d[i + 1], B = d[i + 2], ch = R >= G && R >= B ? 0 : G >= B ? 1 : 2;
        if (ch !== k || a / 255 <= (BAYER[(y & 3) * 4 + (x & 3)] + .5) / 16) continue;
        if (this.rond) { c.moveTo(x * p + p / 2 + r, y * p + p / 2); c.arc(x * p + p / 2, y * p + p / 2, r, 0, 6.2832); }
        else c.fillRect(x * p, y * p, s, s);
      }
      if (this.rond) c.fill();
    }
  };
  function couleursTrame(el, deux) { var c = couleursGraphe(el); return { accent: c.accent, deux: deux === 'danger' ? c.danger : c.accent2, base: c.texte }; }
  // boucle d'animation à ~30 i/s, seulement à l'écran et hors mouvement réduit
  function boucleTrame(el, f) {
    if (calme()) return;
    var der = 0;
    boucleVisible(el, function (t) { if (t - der >= .033) { der = t; f(t); } });
  }
  function swatch(alpha, code) { return '<i class="br-tg-pastille' + (code ? ' ' + code : '') + '" style="--a:' + alpha + '"></i>'; }

  /* ---------- Courbe monochrome lissée ---------- */
  function cheminLisse(pts) {
    if (pts.length < 2) return '';
    var d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += 'C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ' ' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + ' ' +
        (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ' ' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
    }
    return d;
  }
  graphe('graphique-courbe', 'mono', function (el) {
    var v = nombres(el.dataset.valeurs, [18, 24, 21, 32, 28, 41, 37, 52]), e = libelles(el.dataset.etiquettes, MOIS_DEF.slice(0, v.length)), u = el.dataset.unite || '';
    var g = coque(el, 'Visiteurs', 'br-gx-mono');
    g.zone.insertAdjacentHTML('afterbegin', '<svg class="br-gc-svg" aria-hidden="true"><path class="br-gc-aire"/><path class="br-gc-trait"/><line class="br-gc-guide"/><circle class="br-gc-point" r="5"/></svg>');
    g.legende.innerHTML = '<div class="br-gx-axe br-gx-axe-bouts">' + e.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>';
    var der = v[v.length - 1], pre = v[v.length - 2] || der, varia = pre ? (der - pre) / pre * 100 : 0;
    g.valeur.textContent = fmt(der, u);
    g.sous.innerHTML = '<span class="' + (varia >= 0 ? 'br-gx-hausse' : 'br-gx-baisse') + '">' + (varia >= 0 ? '+' : '') + fmt(varia, ' %') + '</span> sur la période';
    g.tableau(['Période', 'Valeur'], v.map(function (x, i) { return [e[i] || String(i + 1), fmt(x, u)]; }));
    var svg = g.zone.querySelector('svg'), aire = svg.querySelector('.br-gc-aire'), trait = svg.querySelector('.br-gc-trait'), guide = svg.querySelector('.br-gc-guide'), pt = svg.querySelector('.br-gc-point'), pts = [], prog = 0, idx = -1;
    function dessiner() {
      var W = g.zone.clientWidth, H = g.zone.clientHeight; if (!W) return;
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      var mn = Math.min.apply(null, v), mx = Math.max.apply(null, v), pad = (mx - mn) * .15 || 1, lo = mn - pad, hi = mx + pad;
      pts = v.map(function (x, i) { return [8 + i * (W - 16) / Math.max(1, v.length - 1), 10 + (1 - (x - lo) / (hi - lo)) * (H - 20)]; });
      var d = cheminLisse(pts);
      trait.setAttribute('d', d);
      aire.setAttribute('d', d + 'L' + pts[pts.length - 1][0] + ' ' + H + 'L' + pts[0][0] + ' ' + H + 'Z');
      var L = trait.getTotalLength ? trait.getTotalLength() : 1000;
      trait.style.strokeDasharray = L; trait.style.strokeDashoffset = L * (1 - prog);
      aire.style.opacity = prog;
      montrerIdx(idx);
    }
    function montrerIdx(i, clavier) {
      idx = i;
      el.classList.toggle('br-survol', i >= 0);
      if (i < 0 || !pts[i]) { g.cacher(); return; }
      var p = pts[i], H = g.zone.clientHeight;
      guide.setAttribute('x1', p[0]); guide.setAttribute('x2', p[0]); guide.setAttribute('y1', 0); guide.setAttribute('y2', H);
      pt.setAttribute('cx', p[0]); pt.setAttribute('cy', p[1]);
      g.montrer(p[0], p[1], '<b>' + fmt(v[i], u) + '</b><span>' + esc(e[i] || '') + '</span>', clavier);
    }
    g.zone.addEventListener('pointermove', function (ev) {
      var r = g.zone.getBoundingClientRect(), x = ev.clientX - r.left, best = 0;
      pts.forEach(function (p, i) { if (Math.abs(p[0] - x) < Math.abs(pts[best][0] - x)) best = i; });
      montrerIdx(best);
    });
    g.zone.addEventListener('pointerleave', function () { montrerIdx(-1); });
    navigation(g.zone, function () { return v.length; }, montrerIdx);
    suivreTaille(g.zone, dessiner);
    apparition(el, function (p) { prog = p; dessiner(); }, 1200);
    return {};
  });

  /* ---------- Piliers en pilule (vertical / horizontal) ---------- */
  graphe('graphique-piliers', 'mono', function (el) {
    var v = nombres(el.dataset.valeurs, [42, 64, 38, 80, 56, 72, 30]), e = libelles(el.dataset.etiquettes, JOURS_DEF.slice(0, v.length)), u = el.dataset.unite || '';
    var g = coque(el, 'Réservations', 'br-gx-mono'), mx = Math.max.apply(null, v) || 1, horiz = el.dataset.orientation === 'horizontale';
    g.valeur.textContent = fmt(somme(v), u);
    g.sous.textContent = 'au total · pic ' + (e[v.indexOf(mx)] || '');
    var p = mk('div', 'br-gp');
    p.setAttribute('aria-hidden', 'true');
    p.innerHTML = v.map(function (x, i) {
      return '<div class="br-gp-i" style="--v:' + (x / mx).toFixed(4) + ';--i:' + i + '"><span class="br-gp-piste"><i></i></span><span class="br-gp-et">' + esc(e[i] || '') + '</span><span class="br-gp-val">' + fmt(x, u) + '</span></div>';
    }).join('');
    g.zone.insertBefore(p, g.bulle);
    g.tableau(['Libellé', 'Valeur'], v.map(function (x, i) { return [e[i] || String(i + 1), fmt(x, u)]; }));
    if (el.hasAttribute('data-bascule')) {
      var b = bouton('br-gx-bouton', SVC('<path d="M5 19V9M10 19V5M15 19v-7M20 19v-4"/>'), 'Barres horizontales');
      g.outils.appendChild(b);
      b.addEventListener('click', function () {
        horiz = !horiz; el.classList.toggle('br-gp-horiz', horiz);
        b.setAttribute('aria-label', horiz ? 'Barres verticales' : 'Barres horizontales');
        b.innerHTML = SVC(horiz ? '<path d="M5 19V9M10 19V5M15 19v-7M20 19v-4"/>' : '<path d="M5 5h10M5 10h14M5 15h7M5 20h4"/>');
        relancer(p, 'br-tic');
      });
    }
    el.classList.toggle('br-gp-horiz', horiz);
    var items = [].slice.call(p.children);
    function montrerIdx(i, clavier) {
      items.forEach(function (it, k) { it.classList.toggle('br-actif', k === i); });
      p.classList.toggle('br-survol', i >= 0);
      if (clavier && i >= 0) g.dit.textContent = (e[i] || '') + ' : ' + fmt(v[i], u);
    }
    p.addEventListener('pointerover', function (ev) { var it = ev.target.closest('.br-gp-i'); if (it) montrerIdx(items.indexOf(it)); });
    p.addEventListener('pointerleave', function () { montrerIdx(-1); });
    navigation(g.zone, function () { return v.length; }, montrerIdx);
    apparition(el, function (q) { el.style.setProperty('--br-gp-p', q.toFixed(3)); }, 1);
    return {};
  });

  /* ---------- Anneau monochrome à bouts arrondis ---------- */
  graphe('graphique-anneau', 'mono', function (el) {
    var v = nombres(el.dataset.valeurs, [46, 27, 17, 10]), e = libelles(el.dataset.etiquettes, ['Chambres', 'Restaurant', 'Spa', 'Bar']), u = el.dataset.unite || ' %';
    var g = coque(el, 'Répartition', 'br-gx-mono'), T = somme(v) || 1, C = 2 * Math.PI * 38, ep = 9, ouv = 3.5;
    var s = '<svg class="br-ga-svg" viewBox="0 0 100 100" aria-hidden="true"><g transform="rotate(-90 50 50)"><circle class="br-ga-fond" cx="50" cy="50" r="38"/>', depart = 0;
    v.forEach(function (x, i) {
      var long = x / T * C;
      s += '<circle class="br-ga-seg" style="--i:' + i + ';--o:' + (1 - i * .22).toFixed(2) + '" cx="50" cy="50" r="38" data-l="' + Math.max(.01, long - ep - ouv).toFixed(2) + '" data-d="' + (depart + ep / 2 + ouv / 2).toFixed(2) + '"/>';
      depart += long;
    });
    g.zone.insertAdjacentHTML('afterbegin', s + '</g></svg><div class="br-ga-centre"><b></b><small></small></div>');
    g.legende.innerHTML = '<div class="br-ga-leg">' + v.map(function (x, i) { return '<button type="button" class="br-ga-li" style="--o:' + (1 - i * .22).toFixed(2) + '"><i></i>' + esc(e[i] || '') + '<b>' + fmt(x / T * 100, ' %') + '</b></button>'; }).join('') + '</div>';
    g.zone.removeAttribute('tabindex');
    g.zone.removeAttribute('aria-label');
    g.tableau(['Segment', 'Valeur', 'Part'], v.map(function (x, i) { return [e[i] || '', fmt(x, u === ' %' ? '' : u), fmt(x / T * 100, ' %')]; }));
    var segs = [].slice.call(g.zone.querySelectorAll('.br-ga-seg')), lis = [].slice.call(g.legende.querySelectorAll('.br-ga-li')), cb = g.zone.querySelector('.br-ga-centre b'), cs = g.zone.querySelector('.br-ga-centre small');
    var plus = v.indexOf(Math.max.apply(null, v));
    function centre(i) {
      var k = i < 0 ? plus : i;
      cb.textContent = fmt(v[k] / T * 100, ' %');
      cs.textContent = e[k] || '';
      segs.forEach(function (c, k) { c.classList.toggle('br-actif', k === i); });
      lis.forEach(function (c, k) { c.classList.toggle('br-actif', k === i); });
      el.classList.toggle('br-survol', i >= 0);
    }
    segs.forEach(function (c, i) { c.addEventListener('pointerenter', function () { centre(i); }); c.addEventListener('pointerleave', function () { centre(-1); }); });
    lis.forEach(function (c, i) { ['pointerenter', 'focus'].forEach(function (t) { c.addEventListener(t, function () { centre(i); }); }); ['pointerleave', 'blur'].forEach(function (t) { c.addEventListener(t, function () { centre(-1); }); }); });
    centre(-1);
    apparition(el, function (p) {
      segs.forEach(function (c) { var l = +c.dataset.l * p; c.style.strokeDasharray = l.toFixed(2) + ' ' + (C - l).toFixed(2); c.style.strokeDashoffset = (-c.dataset.d).toFixed(2); });
    }, 1100);
    return {};
  });

  /* ---------- Tramés : anneau avec périodes ---------- */
  var ALPHAS = [1, .72, .5, .34, .22];
  function angleDe(x, y, cx, cy) { var a = Math.atan2(y - cy, x - cx) + Math.PI / 2; return a < 0 ? a + 2 * Math.PI : a; }
  graphe('tramage-anneau', 'tramage', function (el) {
    var per = (el.dataset.periodes || 'Jour:42,26,18,14|Semaine:36,30,20,14|Mois:31,28,24,17').split('|').map(function (p) { var q = p.split(':'); return { nom: q[0].trim(), v: nombres(q[1], [1]) }; });
    var e = libelles(el.dataset.etiquettes, ['Direct', 'Recherche', 'Réseaux', 'E-mail']), u = el.dataset.unite || '';
    var g = coque(el, 'Sources de trafic', 'br-gx-tramage'), tr = new Trame(g.zone, +el.dataset.cellule || 3), cur = 0, aff = per[0].v.slice(), survol = -1, prog = 0, t = 0;
    var sel = mk('div', 'br-gx-segments');
    sel.setAttribute('role', 'radiogroup'); sel.setAttribute('aria-label', 'Période');
    per.forEach(function (p, i) { var b = bouton('br-gx-seg', esc(p.nom)); b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(!i)); b.tabIndex = i ? -1 : 0; sel.appendChild(b); });
    g.outils.appendChild(sel);
    g.zone.insertAdjacentHTML('beforeend', '<div class="br-tg-centre"><b></b><small></small></div>');
    var cb = g.zone.querySelector('.br-tg-centre b'), cs = g.zone.querySelector('.br-tg-centre small');
    function legende() {
      var T = somme(per[cur].v) || 1;
      g.legende.innerHTML = '<div class="br-tg-leg">' + e.map(function (x, i) { return '<span>' + swatch(ALPHAS[i % 5]) + esc(x) + ' <b>' + fmt(per[cur].v[i] / T * 100, ' %') + '</b></span>'; }).join('') + '</div>';
      g.tableau(['Source'].concat(per.map(function (p) { return p.nom; })), e.map(function (x, i) { return [x].concat(per.map(function (p) { return fmt(p.v[i] || 0, u); })); }));
    }
    function geo() { var W = tr.W, H = tr.H, R = Math.min(W, H) / 2 - 6; return { cx: W / 2, cy: H / 2, R: R, r: R * .64 }; }
    function peindre(c) {
      var q = geo(), T = somme(aff) || 1, a0 = -Math.PI / 2, tot = 2 * Math.PI * prog;
      aff.forEach(function (x, i) {
        var sp = x / T * tot, gap = .035, a1 = a0 + gap / 2, a2 = a0 + sp - gap / 2, R = q.R + (i === survol ? 4 : 0);
        if (a2 > a1) {
          c.beginPath(); c.arc(q.cx, q.cy, R, a1, a2); c.arc(q.cx, q.cy, q.r, a2, a1, true); c.closePath();
          c.fillStyle = i === survol ? rgba('accent', 1) : rgba('base', ALPHAS[i % 5]); c.fill();
          if (i === survol) for (var k = 0; k < 14; k++) {
            var aa = a1 + alea(k * 7 + Math.floor(t * 8)) * (a2 - a1), rr = q.r + alea(k * 13 + Math.floor(t * 8)) * (R - q.r);
            c.fillStyle = rgba('deux', 1); c.fillRect(q.cx + Math.cos(aa) * rr - 2, q.cy + Math.sin(aa) * rr - 2, 4, 4);
          }
        }
        a0 += sp;
      });
    }
    function rendu() { tr.rendre(peindre, couleursTrame(el)); }
    function centre() {
      var T = somme(per[cur].v) || 1, k = survol < 0 ? per[cur].v.indexOf(Math.max.apply(null, per[cur].v)) : survol;
      cb.textContent = fmt(per[cur].v[k] / T * 100, ' %');
      cs.textContent = e[k] || '';
    }
    function choisirPeriode(i) {
      if (i === cur) return;
      var de = aff.slice(), a = per[i].v, t0 = performance.now();
      cur = i;
      [].forEach.call(sel.children, function (b, k) { b.setAttribute('aria-checked', String(k === i)); b.tabIndex = k === i ? 0 : -1; });
      legende(); centre();
      (function pas(tt) {
        var k = calme() ? 1 : Math.min(1, (tt - t0) / 600), f = 1 - Math.pow(1 - k, 3);
        aff = a.map(function (x, j) { return (de[j] || 0) + (x - (de[j] || 0)) * f; });
        rendu(); if (k < 1) requestAnimationFrame(pas);
      })(t0);
      emit(el, 'change', { periode: per[i].nom });
    }
    sel.addEventListener('click', function (ev) { var b = ev.target.closest('.br-gx-seg'); if (b) choisirPeriode([].indexOf.call(sel.children, b)); });
    ongletsClavier(sel, function () { return [].slice.call(sel.children); }, function (i, f) { choisirPeriode(i); if (f) sel.children[i].focus(); });
    function viser(i, clavier) {
      survol = i; el.classList.toggle('br-survol', i >= 0); centre(); rendu();
      if (clavier && i >= 0) g.dit.textContent = e[i] + ' : ' + cb.textContent;
    }
    g.zone.addEventListener('pointermove', function (ev) {
      var r = g.zone.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top, q = geo(), dist = Math.hypot(x - q.cx, y - q.cy), i = -1;
      if (dist >= q.r - 4 && dist <= q.R + 6) {
        var a = angleDe(x, y, q.cx, q.cy) / (2 * Math.PI) * somme(aff), acc = 0;
        for (var k = 0; k < aff.length; k++) { acc += aff[k]; if (a <= acc) { i = k; break; } }
      }
      if (i !== survol) viser(i);
    });
    g.zone.addEventListener('pointerleave', function () { viser(-1); });
    navigation(g.zone, function () { return aff.length; }, viser);
    legende(); centre();
    suivreTaille(g.zone, rendu);
    surTheme({ el: el, f: rendu });
    boucleTrame(el, function (tt) { if (survol >= 0) { t = tt; rendu(); } });
    apparition(el, function (p) { prog = p; rendu(); }, 1000);
    return { periode: choisirPeriode };
  });

  /* ---------- Tramés : barres empilées par région ---------- */
  graphe('tramage-barres', 'tramage', function (el) {
    var S = series(el.dataset.series, [{ nom: 'Nord', valeurs: [12, 15, 18, 14, 20, 23] }, { nom: 'Sud', valeurs: [8, 9, 12, 11, 13, 16] }, { nom: 'Est', valeurs: [5, 7, 6, 9, 8, 11] }]);
    var n = Math.max.apply(null, S.map(function (s) { return s.valeurs.length; })), e = libelles(el.dataset.etiquettes, MOIS_DEF.slice(0, n)), u = el.dataset.unite || '';
    var g = coque(el, 'Ventes par région', 'br-gx-tramage'), tr = new Trame(g.zone, +el.dataset.cellule || 3), col = -1, reg = -1, prog = 0;
    var tot = []; for (var k = 0; k < n; k++) tot.push(somme(S.map(function (s) { return s.valeurs[k] || 0; })));
    var mx = Math.max.apply(null, tot) || 1;
    g.valeur.textContent = fmt(somme(tot), u);
    g.sous.textContent = 'sur ' + n + ' périodes';
    g.legende.innerHTML = '<div class="br-tg-leg">' + S.map(function (s, i) { return '<button type="button" class="br-tg-li">' + swatch(ALPHAS[i % 5]) + esc(s.nom) + '</button>'; }).join('') + '</div><div class="br-gx-axe">' + e.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>';
    g.tableau(['Période'].concat(S.map(function (s) { return s.nom; })).concat(['Total']), e.map(function (t, i) { return [t].concat(S.map(function (s) { return fmt(s.valeurs[i] || 0, u); })).concat([fmt(tot[i], u)]); }));
    var lis = [].slice.call(g.legende.querySelectorAll('.br-tg-li'));
    function geo(i) { var W = tr.W, H = tr.H, pas = W / n, bw = Math.min(46, pas * .62); return { x: i * pas + (pas - bw) / 2, w: bw, H: H, pas: pas }; }
    function peindre(c) {
      for (var i = 0; i < n; i++) {
        var q = geo(i), y = q.H;
        S.forEach(function (s, j) {
          var h = (s.valeurs[i] || 0) / mx * (q.H - 8) * prog;
          var on = col === i || reg === j;
          c.fillStyle = on ? rgba('accent', ALPHAS[j % 5] * .4 + .6) : rgba('base', ALPHAS[j % 5] * (col >= 0 || reg >= 0 ? .55 : 1));
          c.fillRect(q.x, y - h + 1.5, q.w, Math.max(0, h - 1.5));
          y -= h;
        });
      }
    }
    function rendu() { tr.rendre(peindre, couleursTrame(el)); }
    function viser(i, clavier) {
      col = i; rendu();
      if (i < 0) { g.cacher(); return; }
      var q = geo(i), h = tot[i] / mx * (q.H - 8);
      g.montrer(q.x + q.w / 2, q.H - h, '<b>' + esc(e[i] || '') + ' · ' + fmt(tot[i], u) + '</b>' + S.map(function (s) { return '<span>' + esc(s.nom) + ' : ' + fmt(s.valeurs[i] || 0, u) + '</span>'; }).join(''), clavier);
    }
    g.zone.addEventListener('pointermove', function (ev) { var r = g.zone.getBoundingClientRect(), i = Math.floor((ev.clientX - r.left) / (r.width / n)); if (i !== col) viser(borne(i, 0, n - 1)); });
    g.zone.addEventListener('pointerleave', function () { viser(-1); });
    navigation(g.zone, function () { return n; }, viser);
    lis.forEach(function (b, j) {
      ['pointerenter', 'focus'].forEach(function (t) { b.addEventListener(t, function () { reg = j; b.classList.add('br-actif'); rendu(); }); });
      ['pointerleave', 'blur'].forEach(function (t) { b.addEventListener(t, function () { reg = -1; b.classList.remove('br-actif'); rendu(); }); });
    });
    suivreTaille(g.zone, rendu);
    surTheme({ el: el, f: rendu });
    apparition(el, function (p) { prog = p; rendu(); }, 1000);
    return {};
  });

  /* ---------- Tramés : aire de croissance + curseur de dates ---------- */
  function courbeTramee(nom, titre, defV, x) {
    graphe(nom, 'tramage', function (el) {
      var v = nombres(el.dataset.valeurs, defV), n = v.length, u = el.dataset.unite || x.unite || '';
      var e = libelles(el.dataset.etiquettes, (function () { var l = [], j = new Date(); for (var k = n - 1; k >= 0; k--) { var d = plusJours(j, -k * (x.pas || 7)); l.push(d.getDate() + ' ' + MOIS_C[d.getMonth()]); } return l; })());
      var g = coque(el, titre, 'br-gx-tramage ' + (x.cls || '')), tr = new Trame(g.zone, +el.dataset.cellule || 3), idx = -1, prog = 0;
      var mn = x.zero ? 0 : Math.min.apply(null, v), mx = Math.max.apply(null, v), pad = (mx - mn) * .12 || 1, lo = x.zero ? 0 : mn - pad, hi = mx + pad;
      var der = v[n - 1], pre = v[0] || der, varia = pre ? (der - pre) / pre * 100 : 0;
      g.valeur.textContent = fmt(der, u);
      g.sous.innerHTML = '<span class="' + (varia >= 0 ? 'br-gx-hausse' : 'br-gx-baisse') + '">' + (varia >= 0 ? '+' : '') + fmt(varia, ' %') + '</span> depuis ' + esc(e[0]);
      g.zone.insertAdjacentHTML('beforeend', '<i class="br-tg-guide"></i><i class="br-tg-point"></i>' + (x.axe ? '<div class="br-tg-axe-y"></div>' : ''));
      var guide = g.zone.querySelector('.br-tg-guide'), point = g.zone.querySelector('.br-tg-point');
      if (x.axe) g.zone.querySelector('.br-tg-axe-y').innerHTML = [hi, (hi + lo) / 2, lo].map(function (y) { return '<span>' + fmt(Math.round(y), u) + '</span>'; }).join('');
      var cur = null;
      if (x.curseur) {
        g.legende.innerHTML = '<label class="br-tg-curseur"><span class="br-natif">Date</span><input type="range" min="0" max="' + (n - 1) + '" value="' + (n - 1) + '"></label><div class="br-gx-axe br-gx-axe-bouts"><span>' + esc(e[0]) + '</span><span>' + esc(e[n - 1]) + '</span></div>';
        cur = g.legende.querySelector('input');
        cur.setAttribute('aria-valuetext', e[n - 1] + ' : ' + fmt(v[n - 1], u));
        cur.addEventListener('input', function () { viser(+cur.value, true); });
        cur.addEventListener('blur', function () { viser(-1); });
      } else g.legende.innerHTML = '<div class="br-gx-axe br-gx-axe-bouts"><span>' + esc(e[0]) + '</span><span>' + esc(e[Math.floor(n / 2)]) + '</span><span>' + esc(e[n - 1]) + '</span></div>';
      g.tableau(['Date', 'Valeur'], v.map(function (y, i) { return [e[i], fmt(y, u)]; }));
      function pts() { var W = tr.W, H = tr.H, g0 = x.axe ? 40 : 4; return v.map(function (y, i) { return [g0 + i * (W - g0 - 4) / Math.max(1, n - 1), 8 + (1 - (y - lo) / (hi - lo)) * (H - 16)]; }); }
      function peindre(c, W, H) {
        var P = pts();
        if (x.axe) { c.fillStyle = rgba('base', .3); [8, H / 2, H - 8].forEach(function (y) { c.fillRect(40, y, W - 44, 1.5); }); }
        c.save(); c.beginPath(); c.rect(0, 0, (x.axe ? 40 : 4) + (W - 8) * prog, H); c.clip();
        var grad = c.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, rgba(x.accentAire ? 'accent' : 'base', x.haut || .8)); grad.addColorStop(1, rgba(x.accentAire ? 'accent' : 'base', x.bas == null ? .12 : x.bas));
        c.beginPath(); c.moveTo(P[0][0], H);
        P.forEach(function (p) { c.lineTo(p[0], p[1]); });
        c.lineTo(P[P.length - 1][0], H); c.closePath(); c.fillStyle = grad; c.fill();
        c.beginPath(); P.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); });
        c.lineWidth = 3; c.lineJoin = 'round'; c.strokeStyle = rgba(x.accentTrait ? 'accent' : 'base', 1); c.stroke();
        c.restore();
      }
      function rendu() { tr.rendre(peindre, couleursTrame(el)); if (idx >= 0) viser(idx); }
      function viser(i, clavier) {
        idx = i; el.classList.toggle('br-survol', i >= 0);
        if (i < 0) { g.cacher(); return; }
        var p = pts()[i];
        guide.style.transform = 'translateX(' + p[0].toFixed(1) + 'px)';
        point.style.transform = 'translate(' + p[0].toFixed(1) + 'px,' + p[1].toFixed(1) + 'px)';
        g.montrer(p[0], p[1], '<b>' + fmt(v[i], u) + '</b><span>' + esc(e[i]) + '</span>', clavier && !cur);
        if (cur) { cur.value = i; cur.setAttribute('aria-valuetext', e[i] + ' : ' + fmt(v[i], u)); }
      }
      g.zone.addEventListener('pointermove', function (ev) {
        var r = g.zone.getBoundingClientRect(), xx = ev.clientX - r.left, P = pts(), b = 0;
        P.forEach(function (p, i) { if (Math.abs(p[0] - xx) < Math.abs(P[b][0] - xx)) b = i; });
        if (b !== idx) viser(b);
      });
      g.zone.addEventListener('pointerleave', function () { viser(-1); });
      navigation(g.zone, function () { return n; }, viser);
      suivreTaille(g.zone, rendu);
      surTheme({ el: el, f: rendu });
      apparition(el, function (p) { prog = p; rendu(); }, 1300);
      return {};
    });
  }
  courbeTramee('tramage-aire', 'Croissance des abonnés', [120, 180, 260, 310, 420, 470, 610, 690, 820, 940, 1080, 1260], { curseur: true, zero: true, haut: .7, bas: .1 });
  courbeTramee('tramage-revenus', 'Revenus', [18.2, 21.4, 19.8, 24.6, 23.1, 27.9, 26.4, 31.2, 29.5, 34.8], { axe: true, unite: ' k€', pas: 30, accentTrait: true, accentAire: true, haut: .65, bas: 0, cls: 'br-tg-revenus' });

  /* ---------- Tramés : carte de chaleur d'activité ---------- */
  graphe('tramage-chaleur', 'tramage', function (el) {
    var sem = borne(parseInt(el.dataset.semaines, 10) || 18, 4, 53), N = sem * 7, v = nombres(el.dataset.valeurs, []), u = el.dataset.unite || ' actions';
    if (v.length < N) { var base = v.slice(); v = []; for (var k = 0; k < N; k++) v.push(base[k] != null ? base[k] : Math.round(Math.pow(alea(k * 3.1 + 7), 1.8) * (k % 7 > 4 ? 4 : 11) * (.5 + k / N))); }
    var mx = Math.max.apply(null, v) || 1, g = coque(el, 'Activité', 'br-gx-tramage br-tg-chaleur'), tr = new Trame(g.zone, +el.dataset.cellule || 2), idx = -1, prog = 0;
    var auj = new Date(), lundi = plusJours(auj, -((auj.getDay() + 6) % 7) - (sem - 1) * 7);
    function date(i) { return plusJours(lundi, Math.floor(i / 7) * 7 + i % 7); }
    g.valeur.textContent = fmt(somme(v), u);
    g.sous.textContent = 'sur ' + sem + ' semaines';
    g.zone.insertAdjacentHTML('beforeend', '<div class="br-tg-jours"><span>L</span><span></span><span>M</span><span></span><span>V</span><span></span><span>D</span></div>');
    g.legende.innerHTML = '<div class="br-tg-leg br-tg-echelle"><span>Moins</span>' + [.12, .35, .6, .85, 1].map(function (a) { return swatch(a); }).join('') + '<span>Plus</span></div>';
    g.tableau(['Semaine du', 'L', 'M', 'M', 'J', 'V', 'S', 'D'], (function () { var l = []; for (var s = 0; s < sem; s++) { var d = date(s * 7); l.push([d.getDate() + ' ' + MOIS_C[d.getMonth()]].concat(v.slice(s * 7, s * 7 + 7).map(String))); } return l; })());
    function geo() { var W = tr.W - 20, H = tr.H, t = Math.min(W / sem, H / 7), gap = Math.max(1.5, t * .14); return { t: t, gap: gap, x0: 20 + (W - t * sem) / 2, y0: (H - t * 7) / 2 }; }
    function peindre(c) {
      var q = geo();
      for (var i = 0; i < N; i++) {
        var s = Math.floor(i / 7), j = i % 7, a = v[i] ? .12 + .88 * v[i] / mx : .06;
        if (s / sem > prog) continue;
        c.fillStyle = i === idx ? rgba('accent', 1) : rgba('base', a);
        c.fillRect(q.x0 + s * q.t, q.y0 + j * q.t, q.t - q.gap, q.t - q.gap);
      }
    }
    function rendu() { tr.rendre(peindre, couleursTrame(el)); var q = geo(); g.zone.style.setProperty('--tg-t', q.t + 'px'); g.zone.style.setProperty('--tg-y0', q.y0 + 'px'); }
    function viser(i, clavier) {
      idx = i; rendu();
      if (i < 0) { g.cacher(); return; }
      var q = geo(), d = date(i);
      g.montrer(q.x0 + Math.floor(i / 7) * q.t + q.t / 2, q.y0 + (i % 7) * q.t, '<b>' + fmt(v[i], u) + '</b><span>' + JOURS_L[d.getDay()] + ' ' + d.getDate() + ' ' + MOIS[d.getMonth()] + '</span>', clavier);
    }
    g.zone.addEventListener('pointermove', function (ev) {
      var r = g.zone.getBoundingClientRect(), q = geo(), s = Math.floor((ev.clientX - r.left - q.x0) / q.t), j = Math.floor((ev.clientY - r.top - q.y0) / q.t);
      var i = s >= 0 && s < sem && j >= 0 && j < 7 ? s * 7 + j : -1;
      if (i !== idx) viser(i);
    });
    g.zone.addEventListener('pointerleave', function () { viser(-1); });
    g.zone.addEventListener('keydown', function (ev) {
      var d = { ArrowDown: 1, ArrowUp: -1, ArrowRight: 7, ArrowLeft: -7 }[ev.key];
      if (!d && ev.key !== 'Escape') return;
      ev.preventDefault();
      viser(ev.key === 'Escape' ? -1 : idx < 0 ? N - 1 : borne(idx + d, 0, N - 1), true);
    });
    g.zone.addEventListener('blur', function () { viser(-1); });
    suivreTaille(g.zone, rendu);
    surTheme({ el: el, f: rendu });
    apparition(el, function (p) { prog = p; rendu(); }, 900);
    return {};
  });

  /* ---------- Tramés : jauge processeur et mémoire (matrice de points) ---------- */
  graphe('tramage-jauge', 'tramage', function (el) {
    var cpu = borne(parseFloat(el.dataset.cpu) || 42, 0, 100), mem = borne(parseFloat(el.dataset.memoire) || 63, 0, 100), a = { cpu: 0, mem: 0 };
    var g = coque(el, 'Serveur', 'br-gx-tramage br-tg-jauge'), tr = new Trame(g.zone, +el.dataset.cellule || 4, true);
    g.zone.removeAttribute('tabindex'); g.zone.removeAttribute('aria-label');
    g.zone.insertAdjacentHTML('beforeend', '<div class="br-tg-centre"><b></b><small>processeur</small><span class="br-tg-mem"></span></div>');
    g.legende.innerHTML = '<div class="br-tg-leg"><span>' + swatch(1) + 'Processeur</span><span>' + swatch(1, 'a') + 'Mémoire</span></div>';
    var cb = g.zone.querySelector('.br-tg-centre b'), cm = g.zone.querySelector('.br-tg-mem'), txt = mk('span', 'br-natif');
    el.appendChild(txt);
    function peindre(c, W, H) {
      var cx = W / 2, cy = H * .56, R = Math.min(W / 2, H * .58) - 4, deb = Math.PI * .75, tot = Math.PI * 1.5;
      [[R, R * .76, a.cpu, 'base'], [R * .68, R * .5, a.mem, 'accent']].forEach(function (q) {
        c.beginPath(); c.arc(cx, cy, q[0], deb, deb + tot); c.arc(cx, cy, q[1], deb + tot, deb, true); c.closePath(); c.fillStyle = rgba(q[3], .14); c.fill();
        var f = deb + tot * q[2] / 100;
        c.beginPath(); c.arc(cx, cy, q[0], deb, f); c.arc(cx, cy, q[1], f, deb, true); c.closePath();
        var gr = c.createLinearGradient(cx - R, 0, cx + R, 0); gr.addColorStop(0, rgba(q[3], .55)); gr.addColorStop(1, rgba(q[3], 1));
        c.fillStyle = gr; c.fill();
      });
    }
    function rendu() {
      tr.rendre(peindre, couleursTrame(el));
      cb.textContent = Math.round(a.cpu) + ' %';
      cm.textContent = 'Mémoire ' + Math.round(a.mem) + ' %';
      txt.textContent = 'Processeur ' + Math.round(cpu) + ' %, mémoire ' + Math.round(mem) + ' %';
    }
    function vers(c2, m2, d) {
      var c0 = a.cpu, m0 = a.mem, t0 = performance.now();
      cpu = c2; mem = m2;
      (function pas(t) {
        var k = calme() ? 1 : Math.min(1, (t - t0) / (d || 800)), f = 1 - Math.pow(1 - k, 3);
        a.cpu = c0 + (c2 - c0) * f; a.mem = m0 + (m2 - m0) * f; rendu();
        if (k < 1) requestAnimationFrame(pas);
      })(t0);
    }
    suivreTaille(g.zone, rendu);
    surTheme({ el: el, f: rendu });
    apparition(el, function (p) { if (p === 1) vers(cpu, mem, 1100); else rendu(); }, 1);
    if (el.hasAttribute('data-demo') && !calme()) setInterval(function () {
      if (!el.isConnected || document.hidden) return;
      vers(borne(cpu + (Math.random() - .45) * 30, 6, 97), borne(mem + (Math.random() - .5) * 10, 30, 92), 900);
    }, 1800);
    return { valeurs: function (c2, m2) { vers(borne(c2, 0, 100), borne(m2, 0, 100)); } };
  });

  /* ---------- Tramés : nuage de bulles (sources de trafic) ---------- */
  graphe('tramage-bulles', 'tramage', function (el) {
    var P = (el.dataset.points || 'Recherche:820,4.2,38|Direct:540,5.6,30|Réseaux:690,1.9,22|E-mail:260,6.8,18|Référents:310,3.1,14|Publicité:470,2.4,20').split('|').map(function (p) { var q = p.split(':'), n = nombres(q[1], [0, 0, 10]); return { nom: q[0].trim(), x: n[0], y: n[1], r: n[2] || 10 }; });
    var g = coque(el, 'Sources de trafic', 'br-gx-tramage'), tr = new Trame(g.zone, +el.dataset.cellule || 3), idx = -1, prog = 0, t = 0;
    var mxX = Math.max.apply(null, P.map(function (p) { return p.x; })) * 1.12, mxY = Math.max.apply(null, P.map(function (p) { return p.y; })) * 1.2, mxR = Math.max.apply(null, P.map(function (p) { return p.r; }));
    g.sous.textContent = 'visites (horizontal) · conversion (vertical) · revenu (taille)';
    g.legende.innerHTML = '<div class="br-gx-axe br-gx-axe-bouts"><span>0 visite</span><span>' + fmt(Math.round(mxX)) + ' visites</span></div>';
    g.tableau(['Source', 'Visites', 'Conversion', 'Revenu'], P.map(function (p) { return [p.nom, fmt(p.x), fmt(p.y, ' %'), fmt(p.r, ' k€')]; }));
    function geo(p, i) {
      var W = tr.W, H = tr.H, rr = 8 + 22 * Math.sqrt(p.r / mxR);
      return { x: 10 + p.x / mxX * (W - 20), y: H - 10 - p.y / mxY * (H - 20) + Math.sin(t * 1.4 + i * 1.7) * 3, r: rr * prog };
    }
    function peindre(c, W, H) {
      c.fillStyle = rgba('base', .3); c.fillRect(8, H - 8, W - 16, 1.5); c.fillRect(8, 6, 1.5, H - 14);
      P.forEach(function (p, i) {
        var q = geo(p, i); if (q.r < 1) return;
        var gr = c.createRadialGradient(q.x - q.r * .3, q.y - q.r * .3, 0, q.x, q.y, q.r);
        var code = i === idx ? 'accent' : 'base';
        gr.addColorStop(0, rgba(code, 1)); gr.addColorStop(1, rgba(code, i === idx ? .55 : .25));
        c.beginPath(); c.arc(q.x, q.y, q.r, 0, 6.2832); c.fillStyle = gr; c.fill();
      });
    }
    function rendu() { tr.rendre(peindre, couleursTrame(el)); if (idx >= 0) bulle(false); }
    function bulle(clavier) { var p = P[idx], q = geo(p, idx); g.montrer(q.x, q.y - q.r + 4, '<b>' + esc(p.nom) + '</b><span>' + fmt(p.x) + ' visites · ' + fmt(p.y, ' %') + ' · ' + fmt(p.r, ' k€') + '</span>', clavier); }
    function viser(i, clavier) { idx = i; el.classList.toggle('br-survol', i >= 0); rendu(); if (i >= 0) bulle(clavier); else g.cacher(); }
    g.zone.addEventListener('pointermove', function (ev) {
      var r = g.zone.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top, b = -1, dm = Infinity;
      P.forEach(function (p, i) { var q = geo(p, i), d = Math.hypot(q.x - x, q.y - y); if (d < q.r + 4 && d < dm) { dm = d; b = i; } });
      if (b !== idx) viser(b);
    });
    g.zone.addEventListener('pointerleave', function () { viser(-1); });
    navigation(g.zone, function () { return P.length; }, viser);
    suivreTaille(g.zone, rendu);
    surTheme({ el: el, f: rendu });
    boucleTrame(el, function (tt) { t = tt; rendu(); });
    apparition(el, function (p) { prog = p; rendu(); }, 1000);
    return {};
  });

  /* ---------- Tramés : entonnoir de conversion ---------- */
  graphe('tramage-entonnoir', 'tramage', function (el) {
    var E = (el.dataset.etapes || 'Visites:12400|Fiche produit:6200|Panier:2100|Paiement:1150|Achat:860').split('|').map(function (p) { var q = p.split(':'); return { nom: q[0].trim(), v: parseFloat(q[1]) || 0 }; });
    var g = coque(el, 'Entonnoir de conversion', 'br-gx-tramage br-tg-entonnoir'), n = E.length, mx = E[0].v || 1, idx = -1, prog = 0;
    g.valeur.textContent = fmt(E[n - 1].v / mx * 100, ' %');
    g.sous.textContent = 'de conversion globale';
    var lignes = mk('div', 'br-tg-etapes');
    lignes.innerHTML = E.map(function (s, i) { return '<div class="br-tg-etape"><span class="br-tg-nom">' + esc(s.nom) + '</span><span class="br-tg-barre"></span><span class="br-tg-chiffre">' + fmt(s.v) + (i ? '<small>' + fmt(s.v / E[i - 1].v * 100, ' %') + '</small>' : '') + '</span></div>'; }).join('');
    g.zone.insertBefore(lignes, g.bulle);
    var tr = new Trame(g.zone, +el.dataset.cellule || 3);
    g.tableau(['Étape', 'Effectif', 'Passage'], E.map(function (s, i) { return [s.nom, fmt(s.v), i ? fmt(s.v / E[i - 1].v * 100, ' %') : '—']; }));
    var barres = [].slice.call(lignes.querySelectorAll('.br-tg-barre')), rows = [].slice.call(lignes.children);
    function peindre(c) {
      var zr = g.zone.getBoundingClientRect();
      barres.forEach(function (b, i) {
        var r = b.getBoundingClientRect(), w = r.width * E[i].v / mx * borne(prog * 1.3 - i * .08, 0, 1), x = r.left - zr.left + (r.width - w) / 2, y = r.top - zr.top + 3;
        c.fillStyle = i === idx ? rgba('accent', 1) : rgba('base', .9 - i * .12);
        c.fillRect(x, y, w, r.height - 6);
      });
    }
    function rendu() { tr.rendre(peindre, couleursTrame(el)); }
    function viser(i, clavier) {
      idx = i; rows.forEach(function (r, k) { r.classList.toggle('br-actif', k === i); }); rendu();
      if (i < 0) { g.cacher(); return; }
      var zr = g.zone.getBoundingClientRect(), r = barres[i].getBoundingClientRect();
      g.montrer(r.left - zr.left + r.width / 2, r.top - zr.top, '<b>' + esc(E[i].nom) + ' · ' + fmt(E[i].v) + '</b><span>' + (i ? 'Perte à cette étape : ' + fmt(100 - E[i].v / E[i - 1].v * 100, ' %') : 'Point d’entrée') + '</span>', clavier);
    }
    lignes.addEventListener('pointerover', function (ev) { var r = ev.target.closest('.br-tg-etape'); if (r) { var i = rows.indexOf(r); if (i !== idx) viser(i); } });
    lignes.addEventListener('pointerleave', function () { viser(-1); });
    navigation(g.zone, function () { return n; }, viser);
    suivreTaille(g.zone, rendu);
    surTheme({ el: el, f: rendu });
    apparition(el, function (p) { prog = p; rendu(); }, 1200);
    return {};
  });

  /* ---------- Tramés : demi-anneau des appareils (particules) ---------- */
  graphe('tramage-demi-anneau', 'tramage', function (el) {
    var v = nombres(el.dataset.valeurs, [58, 34, 8]), e = libelles(el.dataset.etiquettes, ['Mobile', 'Ordinateur', 'Tablette']), T = somme(v) || 1;
    var g = coque(el, 'Appareils', 'br-gx-tramage br-tg-demi'), tr = new Trame(g.zone, +el.dataset.cellule || 3), idx = -1, prog = 0, t = 0;
    g.zone.insertAdjacentHTML('beforeend', '<div class="br-tg-centre bas"><b></b><small></small></div>');
    var cb = g.zone.querySelector('.br-tg-centre b'), cs = g.zone.querySelector('.br-tg-centre small');
    g.legende.innerHTML = '<div class="br-tg-leg">' + e.map(function (x, i) { return '<span>' + swatch(ALPHAS[i % 5]) + esc(x) + ' <b>' + fmt(v[i] / T * 100, ' %') + '</b></span>'; }).join('') + '</div>';
    g.tableau(['Appareil', 'Part'], e.map(function (x, i) { return [x, fmt(v[i] / T * 100, ' %')]; }));
    function geo() { var W = tr.W, H = tr.H, R = Math.min(W / 2 - 6, H - 10); return { cx: W / 2, cy: H - 4, R: R, r: R * .58 }; }
    function peindre(c) {
      var q = geo(), a0 = Math.PI;
      v.forEach(function (x, i) {
        var sp = x / T * Math.PI * prog, a1 = a0 + .02, a2 = a0 + sp - .02;
        if (a2 > a1) {
          c.beginPath(); c.arc(q.cx, q.cy, q.R + (i === idx ? 4 : 0), a1, a2); c.arc(q.cx, q.cy, q.r, a2, a1, true); c.closePath();
          c.fillStyle = i === idx ? rgba('accent', 1) : rgba('base', ALPHAS[i % 5] * .9); c.fill();
          var nb = Math.round(sp * 10);
          for (var k = 0; k < nb; k++) {
            var s = k * 31 + i * 7 + Math.floor(t * 6), aa = a1 + alea(s) * (a2 - a1), rr = q.r + alea(s + 1) * (q.R - q.r);
            c.fillStyle = rgba(i === idx ? 'deux' : 'accent', .9); c.fillRect(q.cx + Math.cos(aa) * rr - 1.5, q.cy + Math.sin(aa) * rr - 1.5, 3, 3);
          }
        }
        a0 += sp;
      });
    }
    function rendu() {
      tr.rendre(peindre, couleursTrame(el));
      var i = idx < 0 ? v.indexOf(Math.max.apply(null, v)) : idx;
      cb.textContent = fmt(v[i] / T * 100, ' %'); cs.textContent = e[i];
    }
    function viser(i, clavier) { idx = i; el.classList.toggle('br-survol', i >= 0); rendu(); if (clavier && i >= 0) g.dit.textContent = e[i] + ' : ' + cb.textContent; }
    g.zone.addEventListener('pointermove', function (ev) {
      var r = g.zone.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top, q = geo(), d = Math.hypot(x - q.cx, y - q.cy), i = -1;
      if (y <= q.cy && d >= q.r - 4 && d <= q.R + 6) {
        var a = Math.atan2(y - q.cy, x - q.cx); if (a > 0) a -= 2 * Math.PI;
        var f = (a + Math.PI) / Math.PI * T, acc = 0;
        for (var k = 0; k < v.length; k++) { acc += v[k]; if (f <= acc) { i = k; break; } }
      }
      if (i !== idx) viser(i);
    });
    g.zone.addEventListener('pointerleave', function () { viser(-1); });
    navigation(g.zone, function () { return v.length; }, viser);
    suivreTaille(g.zone, rendu);
    surTheme({ el: el, f: rendu });
    boucleTrame(el, function (tt) { t = tt; rendu(); });
    apparition(el, function (p) { prog = p; rendu(); }, 1000);
    return {};
  });

  /* ---------- Tramés : capacité de stockage (trame qui ondule) ---------- */
  graphe('tramage-stockage', 'tramage', function (el) {
    var S = (el.dataset.segments || 'Photos:24.6|Vidéos:18.2|Applications:12.4|Documents:6.1|Système:7.1').split('|').map(function (p) { var q = p.split(':'); return { nom: q[0].trim(), v: parseFloat(q[1]) || 0 }; });
    var cap = parseFloat(el.dataset.capacite) || 128, u = el.dataset.unite || ' Go', used = somme(S.map(function (s) { return s.v; }));
    var g = coque(el, 'Stockage', 'br-gx-tramage br-tg-stockage'), tr = new Trame(g.zone, +el.dataset.cellule || 3), idx = -1, prog = 0, t = 0;
    g.valeur.textContent = fmt(used, u);
    g.sous.textContent = 'utilisés sur ' + fmt(cap, u) + ' · ' + fmt(cap - used, u) + ' libres';
    g.legende.innerHTML = '<div class="br-tg-leg">' + S.map(function (s, i) { return '<span>' + swatch(ALPHAS[i % 5]) + esc(s.nom) + ' <b>' + fmt(s.v, u) + '</b></span>'; }).join('') + '<span>' + swatch(.1) + 'Libre <b>' + fmt(cap - used, u) + '</b></span></div>';
    g.tableau(['Catégorie', 'Taille'], S.map(function (s) { return [s.nom, fmt(s.v, u)]; }).concat([['Libre', fmt(cap - used, u)]]));
    function bornes(i) { var W = tr.W, x = 0; for (var k = 0; k < i; k++) x += S[k].v / cap * W; return [x, x + S[i].v / cap * W]; }
    function peindre(c, W, H) {
      var y = H / 2 - 16, h = 32;
      c.save(); c.beginPath(); if (c.roundRect) c.roundRect(0, y, W, h, 16); else c.rect(0, y, W, h); c.clip();
      c.fillStyle = rgba('base', .1); c.fillRect(0, y, W, h);
      var lim = W * used / cap * prog;
      S.forEach(function (s, i) {
        var b = bornes(i), x1 = b[0], x2 = Math.min(b[1], lim);
        if (x2 <= x1) return;
        for (var x = x1; x < x2; x += 3) {
          var a = ALPHAS[i % 5] * (.72 + .28 * Math.sin(x * .09 - t * 3.2 + i * 1.3));
          c.fillStyle = i === idx ? rgba('accent', .65 + .35 * Math.sin(x * .09 - t * 3.2)) : rgba('base', a);
          c.fillRect(x, y, Math.min(3, x2 - x), h);
        }
        c.fillStyle = rgba('base', 0); c.clearRect(b[1] - 1, y, 2, h);
      });
      c.restore();
    }
    function rendu() { tr.rendre(peindre, couleursTrame(el)); }
    function viser(i, clavier) {
      idx = i; rendu();
      if (i < 0) { g.cacher(); return; }
      var b = bornes(i);
      g.montrer((b[0] + b[1]) / 2, tr.H / 2 - 16, '<b>' + esc(S[i].nom) + '</b><span>' + fmt(S[i].v, u) + ' · ' + fmt(S[i].v / cap * 100, ' %') + '</span>', clavier);
    }
    g.zone.addEventListener('pointermove', function (ev) {
      var r = g.zone.getBoundingClientRect(), x = ev.clientX - r.left, i = -1;
      S.forEach(function (s, k) { var b = bornes(k); if (x >= b[0] && x < b[1]) i = k; });
      if (i !== idx) viser(i);
    });
    g.zone.addEventListener('pointerleave', function () { viser(-1); });
    navigation(g.zone, function () { return S.length; }, viser);
    suivreTaille(g.zone, rendu);
    surTheme({ el: el, f: rendu });
    boucleTrame(el, function (tt) { t = tt; rendu(); });
    apparition(el, function (p) { prog = p; rendu(); }, 1200);
    return {};
  });

  /* ---------- Tramés : disponibilité sur 90 jours ---------- */
  graphe('tramage-disponibilite', 'tramage', function (el) {
    var N = borne(parseInt(el.dataset.jours, 10) || 90, 7, 365), etat = [];
    for (var k = 0; k < N; k++) etat.push(0);
    (el.dataset.incidents || '17:partiel|44:panne|45:partiel|71:partiel').split('|').forEach(function (p) { var q = p.split(':'), i = parseInt(q[0], 10); if (i >= 0 && i < N) etat[i] = q[1] === 'panne' ? 2 : 1; });
    var NOMS = ['Opérationnel', 'Dégradé', 'Panne'], pertes = [0, .35, 6.5];
    var dispo = 100 - somme(etat.map(function (s) { return pertes[s]; })) / (N * 24) * 100;
    var g = coque(el, el.dataset.service || 'Disponibilité', 'br-gx-tramage br-tg-dispo'), tr = new Trame(g.zone, +el.dataset.cellule || 2), idx = -1, prog = 0;
    g.valeur.textContent = fmt(dispo, ' %');
    g.sous.textContent = 'sur ' + N + ' jours';
    g.legende.innerHTML = '<div class="br-gx-axe br-gx-axe-bouts"><span>Il y a ' + N + ' jours</span><span>Aujourd’hui</span></div><div class="br-tg-leg"><span>' + swatch(.9) + 'Opérationnel</span><span>' + swatch(1, 'a') + 'Dégradé</span><span>' + swatch(1, 'd') + 'Panne</span></div>';
    var auj = new Date();
    function date(i) { return plusJours(auj, i - N + 1); }
    g.tableau(['Date', 'État'], etat.map(function (s, i) { return s ? [date(i).toLocaleDateString('fr-FR'), NOMS[s]] : null; }).filter(Boolean).concat([['Autres jours', NOMS[0]]]));
    function geo() { var W = tr.W, H = tr.H, pas = W / N; return { pas: pas, w: Math.max(1.5, pas * .72), H: H }; }
    function peindre(c) {
      var q = geo();
      for (var i = 0; i < N; i++) {
        if (i / N > prog) break;
        c.fillStyle = i === idx ? rgba(etat[i] === 2 ? 'deux' : 'accent', 1) : etat[i] === 2 ? rgba('deux', 1) : etat[i] === 1 ? rgba('accent', .95) : rgba('base', .62);
        c.fillRect(i * q.pas, 4, q.w, q.H - 8);
      }
    }
    function rendu() { tr.rendre(peindre, couleursTrame(el, 'danger')); }
    function viser(i, clavier) {
      idx = i; rendu();
      if (i < 0) { g.cacher(); return; }
      var q = geo(), d = date(i);
      g.montrer(i * q.pas + q.w / 2, 4, '<b>' + NOMS[etat[i]] + '</b><span>' + JOURS_L[d.getDay()] + ' ' + d.getDate() + ' ' + MOIS[d.getMonth()] + '</span>', clavier);
    }
    g.zone.addEventListener('pointermove', function (ev) { var r = g.zone.getBoundingClientRect(), i = borne(Math.floor((ev.clientX - r.left) / geo().pas), 0, N - 1); if (i !== idx) viser(i); });
    g.zone.addEventListener('pointerleave', function () { viser(-1); });
    navigation(g.zone, function () { return N; }, viser);
    suivreTaille(g.zone, rendu);
    surTheme({ el: el, f: rendu });
    apparition(el, function (p) { prog = p; rendu(); }, 1100);
    return {};
  });

  /* ==========================================================================
     LOT 6 — COMPOSANTS D'IA (interface seulement : aucun appel réseau)
     ========================================================================== */
  function ia(nom, init) { composant(nom, 'ia', 'ia', 'ia', init); }
  var ICO_IA = {
    envoi: '<path d="M12 19V6M6.5 11.5 12 6l5.5 5.5"/>',
    micro: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.6 3.7 5.4 3.7 8.5s-1.1 5.9-3.7 8.5c-2.6-2.6-3.7-5.4-3.7-8.5S9.4 6.1 12 3.5Z"/>',
    ampoule: '<path d="M9.5 18h5M10 21h4M12 3.5a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V17h5v-.6c0-.8.4-1.5 1-2A6 6 0 0 0 12 3.5Z"/>',
    cerveau: '<path d="M9.5 4.5a2.8 2.8 0 0 0-2.8 2.6A3 3 0 0 0 4.5 10a3 3 0 0 0 .8 4.4 3 3 0 0 0 3 4.1 2.6 2.6 0 0 0 4.2.6V5.6A2.8 2.8 0 0 0 9.5 4.5ZM14.5 4.5a2.8 2.8 0 0 1 2.8 2.6A3 3 0 0 1 19.5 10a3 3 0 0 1-.8 4.4 3 3 0 0 1-3 4.1 2.6 2.6 0 0 1-3.7.6"/>',
    copier: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
    ok: '<path d="M5.5 12.5l4 4L18.5 7.5"/>',
    regen: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>',
    haut: '<path d="M7.5 10.5v9h-3v-9ZM7.5 10.5l3.6-6.5c1.4 0 2.4 1.2 2.1 2.5L12.6 10h5.3a2 2 0 0 1 2 2.3l-1.1 5.6a2 2 0 0 1-2 1.6H7.5"/>',
    bas: '<path d="M7.5 13.5v-9h-3v9ZM7.5 13.5l3.6 6.5c1.4 0 2.4-1.2 2.1-2.5L12.6 14h5.3a2 2 0 0 0 2-2.3l-1.1-5.6a2 2 0 0 0-2-1.6H7.5"/>',
    etincelle: '<path d="M12 3c.6 4.4 2.6 6.4 7 7-4.4.6-6.4 2.6-7 7-.6-4.4-2.6-6.4-7-7 4.4-.6 6.4-2.6 7-7Z" fill="currentColor"/>',
    resumer: '<path d="M5 6h14M5 10h14M5 14h9M5 18h6"/>',
    traduire: '<path d="M4.5 6h8M8.5 4v2c0 4-2 6.5-4.5 8M6 10c1 2 3 3.5 5 4M13 20l3.5-8 3.5 8M14.2 17.5h4.6"/>',
    corriger: '<path d="M4 20h4L19 9l-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/>',
    expliquer: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.7M12 17h.01"/>',
    raccourcir: '<path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4"/>',
    allonger: '<path d="M4 7h16M4 12h16M4 17h10"/>'
  };

  /* ---------- Saisie de requête (zone qui grandit, modèle, options, dictée, jetons) ---------- */
  ia('ia-saisie', function (el) {
    var ta = el.querySelector('textarea');
    if (!ta) { ta = mk('textarea'); ta.setAttribute('aria-label', el.dataset.label || 'Message'); }
    ta.classList.add('br-ia-texte');
    ta.rows = 1;
    if (!ta.placeholder) ta.placeholder = el.dataset.placeholder || 'Demande n’importe quoi…';
    var modeles = libelles(el.dataset.modeles, ['Rapide', 'Équilibré', 'Approfondi']), m = 0, max = parseFloat(el.dataset.max) || 220;
    var boite = mk('div', 'br-ia-boite'), barre = mk('div', 'br-ia-barre'), g = mk('div', 'br-ia-gauche'), d = mk('div', 'br-ia-droite');
    var mb = bouton('br-ia-modele', '<span>' + esc(modeles[0]) + '</span>' + CHEVRON), menu = mk('div', 'br-menu br-ia-menu');
    menu.innerHTML = modeles.map(function (x, i) { return '<button type="button" class="br-mi" data-i="' + i + '">' + esc(x) + SVC(COCHE, 'br-mi-coche') + '</button>'; }).join('');
    var items = [].slice.call(menu.children);
    items.forEach(function (b) { itemMenu(b, 'menuitemradio'); });
    var cm = mk('span', 'br-ia-modeles'); cm.appendChild(mb); cm.appendChild(menu);
    var rech = bouton('br-ia-opt', SVC(ICO_IA.globe) + '<span>Recherche</span>'), refl = bouton('br-ia-opt', SVC(ICO_IA.ampoule) + '<span>Réflexion</span>');
    rech.setAttribute('aria-pressed', 'false'); refl.setAttribute('aria-pressed', 'false');
    var jet = mk('span', 'br-ia-jetons'), micro = bouton('br-ia-micro', SVC(ICO_IA.micro) + '<span class="br-ia-onde" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>', 'Dicter le message');
    var envoi = bouton('br-ia-envoi', SVC(ICO_IA.envoi), 'Envoyer');
    micro.setAttribute('aria-pressed', 'false');
    g.appendChild(cm); g.appendChild(rech); g.appendChild(refl);
    d.appendChild(jet);
    var Reco = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (el.hasAttribute('data-voix')) d.appendChild(micro);
    d.appendChild(envoi);
    barre.appendChild(g); barre.appendChild(d);
    el.textContent = '';
    boite.appendChild(ta); boite.appendChild(barre); el.appendChild(boite);
    var dit = annonce(el);
    var mn = menuDeroulant({ bouton: mb, menu: menu, racine: cm, items: function () { return items; }, initial: function () { return items[m]; } });
    function choisir(i) {
      m = i;
      items.forEach(function (b, k) { b.setAttribute('aria-checked', String(k === i)); });
      mb.firstChild.textContent = modeles[i];
      mb.setAttribute('aria-label', 'Modèle : ' + modeles[i]);
    }
    menu.addEventListener('click', function (e) { var b = e.target.closest('.br-mi'); if (b) { choisir(+b.dataset.i); mn.fermer(true); } });
    choisir(0);
    [rech, refl].forEach(function (b) { b.addEventListener('click', function () { b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); relancer(b, 'br-tic'); }); });
    function maj() {
      ta.style.height = 'auto';
      ta.style.height = Math.min(max, ta.scrollHeight) + 'px';
      ta.style.overflowY = ta.scrollHeight > max ? 'auto' : 'hidden';
      var n = Math.ceil(ta.value.trim().length / 4);
      jet.textContent = n ? '≈ ' + n + ' jeton' + (n > 1 ? 's' : '') : '';
      envoi.disabled = !ta.value.trim();
      boite.classList.toggle('br-rempli', !!ta.value.trim());
    }
    ta.addEventListener('input', maj);
    function envoyer() {
      var t = ta.value.trim(); if (!t) return;
      relancer(envoi, 'br-part');
      emit(el, 'envoi', { texte: t, modele: modeles[m], recherche: rech.getAttribute('aria-pressed') === 'true', reflexion: refl.getAttribute('aria-pressed') === 'true' });
      ta.value = ''; maj(); ta.focus();
      dit.textContent = 'Message envoyé.';
    }
    envoi.addEventListener('click', envoyer);
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); envoyer(); } });
    // dictée vocale (navigateurs compatibles) : texte provisoire affiché en direct
    var reco = null, base = '';
    if (!Reco) { micro.disabled = true; micro.title = 'Dictée non prise en charge par ce navigateur'; }
    micro.addEventListener('click', function () {
      if (reco) { reco.stop(); return; }
      reco = new Reco();
      reco.lang = document.documentElement.lang || 'fr-FR';
      reco.interimResults = true; reco.continuous = true;
      base = ta.value ? ta.value.replace(/\s*$/, ' ') : '';
      reco.onresult = function (ev) { var s = ''; for (var i = 0; i < ev.results.length; i++) s += ev.results[i][0].transcript; ta.value = base + s; maj(); };
      reco.onend = function () { reco = null; micro.setAttribute('aria-pressed', 'false'); boite.classList.remove('br-ecoute'); dit.textContent = 'Dictée terminée.'; };
      reco.onerror = function () { if (reco) reco.stop(); };
      try { reco.start(); micro.setAttribute('aria-pressed', 'true'); boite.classList.add('br-ecoute'); dit.textContent = 'Dictée en cours.'; } catch (_) { reco = null; }
    });
    maj();
    return { valeur: function (v) { if (v == null) return ta.value; ta.value = v; maj(); }, envoyer: envoyer };
  });

  /* ---------- Trace de raisonnement (étapes, chrono, repli) ---------- */
  ia('ia-raisonnement', function (el) {
    var initiales = [].filter.call(el.children, function (c) { return c.nodeType === 1; }).map(function (c) { return c.textContent.trim(); }).filter(Boolean);
    if (!initiales.length) initiales = libelles(el.dataset.etapes, ['Je relis la question et repère ce qui est demandé', 'Je rassemble les éléments utiles', 'Je compare deux pistes et écarte la moins solide', 'Je vérifie les calculs', 'Je rédige une réponse claire']);
    el.textContent = '';
    var id = idCtl('rais');
    el.innerHTML = '<button type="button" class="br-ia-rais-tete" aria-expanded="true" aria-controls="' + id + '"><span class="br-ia-cerveau" aria-hidden="true">' + SVC(ICO_IA.cerveau) + '</span><span class="br-ia-rais-titre">Réflexion</span><span class="br-ia-chrono">0 s</span>' + CHEVRON + '</button>' +
      '<div class="br-ia-rais-corps" id="' + id + '"><ol class="br-ia-etapes"></ol></div>';
    var tete = el.firstChild, titre = el.querySelector('.br-ia-rais-titre'), chrono = el.querySelector('.br-ia-chrono'), corps = el.querySelector('.br-ia-rais-corps'), liste = el.querySelector('.br-ia-etapes');
    var t0 = 0, tic = 0, file = [], minuteur = 0, ouvert = true, dit = annonce(el);
    function duree() { var s = (performance.now() - t0) / 1000; return s < 10 ? fmt(Math.round(s * 10) / 10, ' s') : fmt(Math.round(s), ' s'); }
    function deplier(v) {
      ouvert = v; tete.setAttribute('aria-expanded', String(v));
      el.classList.toggle('br-replie', !v);
      if (!calme() && corps.animate) {
        var h = corps.scrollHeight;
        corps.animate(v ? [{ height: '0px', opacity: 0 }, { height: h + 'px', opacity: 1 }] : [{ height: h + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: v ? 380 : 260, easing: 'cubic-bezier(.3, .8, .3, 1)' });
      }
    }
    tete.addEventListener('click', function () { deplier(!ouvert); });
    function etape(texte) {
      var precedente = liste.lastElementChild;
      if (precedente) precedente.classList.add('br-fait');
      var li = mk('li', 'br-ia-etape', '<span class="br-ia-noeud" aria-hidden="true">' + SVC(ICO_IA.ok) + '</span><span class="br-ia-etape-t">' + esc(texte) + '</span>');
      liste.appendChild(li);
      relancer(li, 'br-entre');
      emit(el, 'etape', { texte: texte, index: liste.children.length - 1 });
    }
    function demarrer() {
      clearInterval(tic); clearTimeout(minuteur);
      liste.innerHTML = ''; t0 = performance.now();
      el.classList.add('br-actif'); el.classList.remove('br-termine');
      titre.textContent = 'Réflexion en cours';
      if (!ouvert) deplier(true);
      tic = setInterval(function () { chrono.textContent = duree(); }, 100);
      dit.textContent = 'Réflexion en cours.';
    }
    function terminer() {
      clearInterval(tic); clearTimeout(minuteur);
      var last = liste.lastElementChild; if (last) last.classList.add('br-fait');
      el.classList.remove('br-actif'); el.classList.add('br-termine');
      chrono.textContent = duree();
      titre.textContent = 'Raisonnement terminé';
      dit.textContent = 'Raisonnement terminé en ' + chrono.textContent + '.';
      emit(el, 'fin', {});
      if (!el.hasAttribute('data-ouvert')) minuteur = setTimeout(function () { deplier(false); }, 900);
    }
    function demo() {
      demarrer(); file = initiales.slice();
      (function suite() {
        if (!file.length) { minuteur = setTimeout(terminer, calme() ? 100 : 700); return; }
        etape(file.shift());
        minuteur = setTimeout(suite, calme() ? 150 : 900 + Math.random() * 700);
      })();
    }
    if (el.hasAttribute('data-demo')) {
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); demo(); } }, { threshold: .4 });
        io.observe(el);
      } else demo();
    } else { initiales.forEach(etape); var f = liste.lastElementChild; if (f) f.classList.add('br-fait'); el.classList.add('br-termine'); titre.textContent = 'Raisonnement'; chrono.textContent = el.dataset.duree || ''; }
    return { demarrer: demarrer, etape: etape, terminer: terminer, rejouer: demo };
  });

  /* ---------- Réponse en flux + bloc de code (versions, votes, copie) ---------- */
  var REPONSES_DEMO = [
    '<p>Pour lister les comptes inactifs depuis 90 jours, interroge l’annuaire puis filtre sur la date de dernière connexion. Exemple en JavaScript côté serveur :</p><pre><code data-langage="js">const limite = Date.now() - 90 * 864e5;\nconst inactifs = comptes.filter(c => c.derniereConnexion < limite);\nconsole.table(inactifs.map(c => ({ nom: c.nom, vu: new Date(c.derniereConnexion) })));</code></pre><p>Pense à exclure les comptes de service avant de désactiver quoi que ce soit.</p>',
    '<p>Version plus courte : trie par dernière connexion et garde les plus anciens.</p><pre><code data-langage="js">const anciens = [...comptes].sort((a, b) => a.derniereConnexion - b.derniereConnexion).slice(0, 20);</code></pre>',
    '<p>Autre piste : planifier un rapport hebdomadaire et l’envoyer par e-mail au responsable, plutôt que de désactiver automatiquement.</p>'
  ];
  function ameliorerCode(racine) {
    [].forEach.call(racine.querySelectorAll('pre'), function (pre) {
      if (pre.parentNode.classList.contains('br-ia-code')) return;
      var code = pre.querySelector('code') || pre, lang = code.dataset.langage || (code.className.match(/language-(\w+)/) || [])[1] || 'code';
      var w = mk('div', 'br-ia-code'), t = mk('div', 'br-ia-code-tete', '<span><i></i><i></i><i></i><b>' + esc(lang) + '</b></span>');
      var b = bouton('br-ia-code-copier', '<span class="br-ia-cc">' + SVC(ICO_IA.copier) + '<span>Copier</span></span><span class="br-ia-cc ok">' + SVC(ICO_IA.ok) + '<span>Copié</span></span>', 'Copier le code');
      t.appendChild(b);
      pre.parentNode.insertBefore(w, pre); w.appendChild(t); w.appendChild(pre);
      b.addEventListener('click', function () { copierVers(code.textContent, function () { relancer(b, 'br-copie'); setTimeout(function () { b.classList.remove('br-copie'); }, 1600); }); });
    });
  }
  function copierVers(texte, ok) {
    function secours() { var ta = mk('textarea'); ta.value = texte; ta.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); ok(); } catch (_) {} ta.remove(); }
    try { navigator.clipboard.writeText(texte).then(ok, secours); } catch (_) { secours(); }
  }
  // découpe le texte (hors <pre>) en mots et le code en lignes, chacun avec un retard croissant
  function decouperFlux(racine, pasMot) {
    var n = 0, marcheur = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT, null), noeuds = [];
    while (marcheur.nextNode()) noeuds.push(marcheur.currentNode);
    noeuds.forEach(function (t) {
      if (!t.nodeValue) return;
      var dansCode = t.parentNode.closest('pre'), parts = dansCode ? t.nodeValue.split(/(\n)/) : t.nodeValue.split(/(\s+)/), f = document.createDocumentFragment();
      parts.forEach(function (p) {
        if (!p) return;
        if (/^\s+$/.test(p)) { f.appendChild(document.createTextNode(p)); return; }
        var s = mk('span', 'br-ia-mot'); s.textContent = p; s.style.animationDelay = (n * (dansCode ? pasMot * 4 : pasMot)) + 'ms'; n++;
        f.appendChild(s);
      });
      t.parentNode.replaceChild(f, t);
    });
    return n;
  }
  ia('ia-reponse', function (el) {
    var revs = [].filter.call(el.children, function (c) { return c.hasAttribute('data-revision'); }).map(function (c) { return c.innerHTML; });
    if (!revs.length) revs = REPONSES_DEMO.slice();
    var cur = 0, minuteur = 0, pas = (parseFloat(el.dataset.vitesse) > 0 ? 28 / parseFloat(el.dataset.vitesse) : 28);
    el.innerHTML = '<div class="br-ia-contenu"></div><div class="br-ia-pied"><div class="br-ia-versions"></div><div class="br-ia-outils"></div></div>';
    var contenu = el.querySelector('.br-ia-contenu'), versions = el.querySelector('.br-ia-versions'), actions = el.querySelector('.br-ia-outils'), dit = annonce(el);
    var prec = bouton('br-ia-b', SVC('<path d="M14 7l-5 5 5 5"/>'), 'Version précédente'), suiv = bouton('br-ia-b', SVC('<path d="M10 7l5 5-5 5"/>'), 'Version suivante'), num = mk('span', 'br-ia-num');
    versions.appendChild(prec); versions.appendChild(num); versions.appendChild(suiv);
    var haut = bouton('br-ia-b br-ia-vote', SVC(ICO_IA.haut), 'Bonne réponse'), bas = bouton('br-ia-b br-ia-vote', SVC(ICO_IA.bas), 'Réponse à améliorer');
    var cop = bouton('br-ia-b', '<span class="br-ia-cc">' + SVC(ICO_IA.copier) + '</span><span class="br-ia-cc ok">' + SVC(ICO_IA.ok) + '</span>', 'Copier la réponse'), regen = bouton('br-ia-b', SVC(ICO_IA.regen), 'Régénérer');
    [haut, bas].forEach(function (b) { b.setAttribute('aria-pressed', 'false'); actions.appendChild(b); });
    actions.appendChild(cop); actions.appendChild(regen);
    function afficher(i, flux) {
      clearTimeout(minuteur);
      cur = (i + revs.length) % revs.length;
      contenu.innerHTML = revs[cur];
      ameliorerCode(contenu);
      num.textContent = (cur + 1) + ' sur ' + revs.length;
      versions.hidden = revs.length < 2;
      prec.disabled = cur === 0; suiv.disabled = cur === revs.length - 1;
      [haut, bas].forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      if (flux && !calme()) {
        var n = decouperFlux(contenu, pas);
        el.classList.add('br-flux'); contenu.setAttribute('aria-busy', 'true');
        relancer(contenu, 'br-joue');
        minuteur = setTimeout(function () { el.classList.remove('br-flux'); contenu.removeAttribute('aria-busy'); dit.textContent = 'Réponse ' + (cur + 1) + ' affichée.'; emit(el, 'fin', { version: cur }); }, n * pas + 400);
      }
      emit(el, 'change', { version: cur });
    }
    prec.addEventListener('click', function () { afficher(cur - 1, true); });
    suiv.addEventListener('click', function () { afficher(cur + 1, true); });
    [haut, bas].forEach(function (b, k) {
      b.addEventListener('click', function () {
        var on = b.getAttribute('aria-pressed') !== 'true';
        b.setAttribute('aria-pressed', String(on));
        (k ? haut : bas).setAttribute('aria-pressed', 'false');
        relancer(b, 'br-tic');
        if (on && !k) BR.vibre('selection');
        emit(el, 'vote', { valeur: on ? (k ? -1 : 1) : 0, version: cur });
      });
    });
    cop.addEventListener('click', function () { copierVers(contenu.innerText.replace(/\n?(Copier|Copié)\n?/g, '\n').trim(), function () { relancer(cop, 'br-copie'); setTimeout(function () { cop.classList.remove('br-copie'); }, 1600); dit.textContent = 'Réponse copiée.'; }); });
    regen.addEventListener('click', function () {
      relancer(regen, 'br-tic');
      emit(el, 'regenerer', { version: cur });
      afficher(el.hasAttribute('data-demo') || revs.length > 1 ? cur + 1 : cur, true);
    });
    afficher(0, false);
    if (el.hasAttribute('data-demo') && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); afficher(0, true); } }, { threshold: .4 });
      io.observe(el);
    }
    return {
      ajouter: function (html, montrer) { revs.push(html); if (montrer !== false) afficher(revs.length - 1, true); else afficher(cur, false); },
      afficher: function (i) { afficher(i, true); }, rejouer: function () { afficher(cur, true); }
    };
  });

  /* ---------- Pilule d'actions flottante (option : au-dessus d'une sélection de texte) ---------- */
  ia('ia-actions', function (el) {
    var liste = libelles(el.dataset.actions, ['Résumer', 'Traduire', 'Corriger', 'Expliquer']);
    el.setAttribute('role', 'toolbar');
    if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', 'Actions IA');
    el.innerHTML = '<span class="br-ia-etin" aria-hidden="true">' + SVC(ICO_IA.etincelle) + '</span>' + liste.map(function (a) {
      var k = cleAction(a);
      return '<button type="button" class="br-ia-act" data-action="' + esc(a) + '">' + SVC(ICO_IA[k] || ICO_IA.etincelle, 'br-ia-ico') + SVC(ICO_IA.ok, 'br-ia-ok') + '<span class="br-ia-lib"><span>' + esc(a) + '</span></span></button>';
    }).join('');
    var bts = [].slice.call(el.querySelectorAll('.br-ia-act')), zone = el.dataset.selection ? document.querySelector(el.dataset.selection) : null, texteSel = '';
    bts.forEach(function (b, i) { b.tabIndex = i ? -1 : 0; b.setAttribute('aria-label', b.dataset.action); });
    el.addEventListener('keydown', function (e) {
      var i = bts.indexOf(document.activeElement); if (i < 0) return;
      var j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: bts.length - 1 }[e.key];
      if (e.key === 'Escape' && zone) { cacher(); return; }
      if (j == null) return;
      e.preventDefault(); j = (j + bts.length) % bts.length;
      bts[i].tabIndex = -1; bts[j].tabIndex = 0; bts[j].focus();
    });
    el.addEventListener('click', function (e) {
      var b = e.target.closest('.br-ia-act'); if (!b) return;
      var r = b.getBoundingClientRect(), o = mk('i', 'br-ia-onde-clic');
      o.style.left = (e.clientX ? e.clientX - r.left : r.width / 2) + 'px'; o.style.top = (e.clientY ? e.clientY - r.top : r.height / 2) + 'px';
      b.appendChild(o); setTimeout(function () { o.remove(); }, 600);
      BR.vibre('selection');
      b.classList.add('br-ia-fait'); setTimeout(function () { b.classList.remove('br-ia-fait'); }, 1100);
      emit(el, 'action', { action: b.dataset.action, texte: texteSel || String(window.getSelection ? getSelection() : '') });
    });
    function cacher() { el.classList.remove('br-visible'); el.setAttribute('aria-hidden', 'true'); bts.forEach(function (b) { b.tabIndex = -1; }); }
    if (zone) {
      if (getComputedStyle(zone).position === 'static') zone.style.position = 'relative';
      el.classList.add('br-ia-flottante');
      zone.appendChild(el);
      cacher();
      var t = 0;
      document.addEventListener('selectionchange', function () {
        clearTimeout(t);
        t = setTimeout(function () {
          var s = getSelection();
          if (!s.rangeCount || s.isCollapsed || !zone.contains(s.anchorNode) || el.contains(s.anchorNode)) { if (!el.contains(document.activeElement)) cacher(); return; }
          texteSel = String(s);
          var r = s.getRangeAt(0).getBoundingClientRect(), z = zone.getBoundingClientRect();
          el.classList.add('br-visible'); el.removeAttribute('aria-hidden'); bts[0].tabIndex = 0;
          var w = el.offsetWidth;
          el.style.left = borne(r.left - z.left + r.width / 2 - w / 2, 4, Math.max(4, z.width - w - 4)) + 'px';
          el.style.top = Math.max(-el.offsetHeight - 6, r.top - z.top - el.offsetHeight - 10) + 'px';
          relancer(el, 'br-entre');
        }, 180);
      });
    }
    return {};
  });

  /* ==========================================================================
     Démarrage automatique + éléments ajoutés plus tard
     ========================================================================== */
  function demarrer() {
    initTransitions();
    BR.init(document);
    if ('MutationObserver' in window && !BR._obs) {
      BR._obs = new MutationObserver(function (muts) {
        muts.forEach(function (m) {
          for (var i = 0; i < m.addedNodes.length; i++) {
            var n = m.addedNodes[i];
            if (n.nodeType !== 1) continue;
            if (/^br-/.test(n.getAttribute('class') || '') && !n.matches(SELECTEUR)) continue;
            BR.init(n);
          }
        });
      });
      BR._obs.observe(document.documentElement, { childList: true, subtree: true });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();
