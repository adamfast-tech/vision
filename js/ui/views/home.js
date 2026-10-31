/* Accueil : héros (reprise ou nouveauté) puis rangées. Sans source : écran de bienvenue. */
import { html, str, shuffle, fmtTime } from '../../core/util.js';
import { state, inList, toggleList, ratio } from '../../core/store.js';
import { isTV, lightMotion } from '../../core/device.js';
import { lib, continueWatching, recent, byCat, myList, displayTitle, image, playLabel, playTarget, entity, epLong, CATS } from '../../library/library.js';
import { isScanning } from '../../library/scan.js';
import { card, rail, moreCard, icon, chips, catChip, genCover } from '../components.js';
import { heroTitle, refresh } from '../fx.js';

var timer = null, heroList = [], heroIdx = 0;

function featured() {
  var pool = [], seen = {};
  continueWatching(6).forEach(function (x) { if (!seen[x.entity.key]) { seen[x.entity.key] = 1; pool.push(x.entity); } });
  var fresh = recent(24).filter(function (e) { return !seen[e.key] && image(e); });
  shuffle(fresh).slice(0, 5).forEach(function (e) { seen[e.key] = 1; pool.push(e); });
  if (!pool.length) pool = recent(5);
  return pool.slice(0, 6);
}

function heroMeta(e) {
  var parts = [catChip(e)];
  if (e.year) parts.push(String(e.year));
  if (e.kind === 'show') parts.push(e.seasons.filter(function (s) { return s.n > 0; }).length > 1 ? e.seasons.filter(function (s) { return s.n > 0; }).length + ' saisons' : e.count + ' épisodes');
  if (e.quality === '4K') parts.push('4K');
  if (e.meta && e.meta.rating) parts.push('★ ' + String(e.meta.rating).replace('.', ','));
  return parts;
}

function heroBody(e) {
  var t = playTarget(e) || {};
  var desc = (e.meta && e.meta.overview) || e.desc || '';
  var r = t.item ? ratio(t.item.id) : 0;
  var left = t.resume && t.item ? Math.max(0, ((state.progress[t.item.id] || {}).d || t.item.dur || 0) - t.t) : 0;
  return html`
    ${chips(heroMeta(e), 'hero-chips')}
    <h1 class="hero-title" data-hero-title>${displayTitle(e)}</h1>
    ${t.resume && r > 0 ? html`<p class="hero-resume"><span class="bar"><i style="width:${Math.round(r * 100)}%"></i></span>${t.ep ? epLong(t.ep) + ', ' : ''}${left ? 'reste ' + fmtTime(left) : 'en cours'}</p>` : ''}
    ${desc ? html`<p class="hero-desc">${desc}</p>` : ''}
    <div class="hero-actions">
      <button type="button" class="btn btn-play" data-nx="lustre" data-act="play-show" data-key="${e.key}" data-autofocus>${icon('play')}<span>${playLabel(e)}</span></button>
      <button type="button" class="btn-list" data-nx="pilule-enregistrer" data-key="${e.key}" data-texte-off="Ma liste" data-texte-on="Dans ma liste" ${inList(e.key) ? 'data-actif' : ''}>Ma liste</button>
      <button type="button" class="btn btn-ghost" data-act="open" data-key="${e.key}">${icon('info')}<span>Fiche</span></button>
      <button type="button" class="icon-btn hero-shuffle" data-act="shuffle" aria-label="Lire une vidéo au hasard" title="Au hasard">${icon('shuffle')}</button>
    </div>`;
}

function heroBg(e) {
  var src = image(e);
  return src ? html`<img class="hero-img" src="${src}" alt="" decoding="async" data-fallback="${displayTitle(e)}">` : genCover(displayTitle(e), 'hero-img');
}

function welcome() {
  return html`<section class="welcome" data-pixi="particles" data-color="#ffd9a0" data-density="0.55">
    <div class="beam" aria-hidden="true"></div>
    <div class="welcome-in">
      <svg class="welcome-mark" viewBox="0 0 24 24" aria-hidden="true" data-draw data-duration="1400"><circle cx="12" cy="12" r="9"/><path d="M16.33 11.24L12.79 20.97M14.83 15.37L4.63 17.17M10.5 16.13L3.84 8.2M7.67 12.76L11.21 3.03M9.17 8.63L19.37 6.83M13.5 7.87L20.16 15.8"/></svg>
      <h1 class="welcome-title" data-brio-texte="monte-lettres" data-pas="70" data-declencheur="charge">Vision</h1>
      <p class="welcome-lead">Tes films, séries et animes rangés sur Google Drive, MEGA ou ton NAS, lancés en un clic sur la télé, l’ordinateur et le téléphone.</p>
      <div class="welcome-actions">
        <a class="btn btn-play" data-nx="lustre" href="#/sources/ajouter" data-autofocus>${icon('plus')}<span>Ajouter un stockage</span></a>
        <button type="button" class="btn btn-ghost" data-act="demo">${icon('demo')}<span>Essayer avec la démo</span></button>
        <a class="btn btn-ghost" href="#/appairer/recevoir">${icon('tvpair')}<span>Recevoir la config d’un autre appareil</span></a>
      </div>
      <ol class="welcome-steps">
        <li><b>Range</b> tes vidéos dans des dossiers Films, Séries et Animes.</li>
        <li><b>Partage</b> le dossier principal par lien, ou garde-le privé.</li>
        <li><b>Colle</b> le lien ici : Vision classe tout, saisons et épisodes compris.</li>
      </ol>
    </div>
  </section>`;
}

function skeleton() {
  var c = [];
  for (var i = 0; i < 6; i++) c.push(html`<div class="card-wrap"><div class="card skeleton-card"><span class="card-media skeleton"></span><span class="card-text"><span class="skeleton sk-line"></span><span class="skeleton sk-line short"></span></span></div></div>`);
  var names = Object.keys(state.scanning).map(function (id) { var s = state.sources.filter(function (x) { return x.id === id; })[0]; return s ? s.name : ''; }).filter(Boolean);
  var found = 0;
  Object.keys(state.scanning).forEach(function (id) { found += state.scanning[id].found || 0; });
  return html`<section class="scan-intro">
      <span data-brio="egaliseur" data-taille="54" data-label="Synchronisation"></span>
      <div><h1 class="page-title">Vision range ta bibliothèque</h1>
      <p class="muted" data-scan-text>${names.length ? 'Lecture de ' + names.join(', ') + (found ? ' : ' + found + ' vidéos trouvées' : '…') : 'Préparation…'}</p></div>
    </section>
    <section class="rail"><div class="rail-shell"><div class="rail-track">${c}</div></div></section>`;
}

export default {
  nav: 'home',
  live: true,
  title: function () { return 'Accueil'; },
  render: function (ctx) {
    var L = lib();
    if (!state.sources.length) return welcome();
    if (!L.list.length) return isScanning() ? skeleton() : html`<section class="empty"><h1 class="page-title">Aucune vidéo trouvée</h1>
      <p class="muted">Vision n’a reconnu aucun fichier vidéo dans tes stockages. Vérifie le lien du dossier, ses sous-dossiers et le partage.</p>
      <a class="btn btn-play" href="#/sources" data-autofocus>${icon('cloud')}<span>Voir mes stockages</span></a></section>`;

    // Rendu silencieux (retour du lecteur, mise à jour) : on garde le même titre en vedette.
    var keep = ctx && ctx.quiet && heroList.length ? heroList.map(function (x) { return entity(x.key); }).filter(Boolean) : null;
    if (keep && keep.length) { heroList = keep; heroIdx = Math.min(heroIdx, heroList.length - 1); }
    else { heroList = featured(); heroIdx = 0; }
    var e = heroList[heroIdx];
    var cw = continueWatching(20);
    var rails = [];
    rails.push(rail('Continuer à regarder', cw.map(function (x) { return card(x.entity, { item: x.item, ep: x.ep, next: x.next, preferEp: true }); }), { cls: 'rail-continue' }));
    var ml = myList();
    rails.push(rail('Ma liste', ml.slice(0, 24).map(function (x) { return card(x); }), { route: ml.length > 24 ? '/liste' : '', count: ml.length }));
    rails.push(rail('Ajoutés récemment', recent(24).map(function (x) { return card(x); })));
    ['film', 'serie', 'anime', 'autre'].forEach(function (c) {
      var list = byCat(c);
      if (!list.length) return;
      var cards = list.slice(0, 24).map(function (x) { return card(x); });
      if (list.length > 24) cards.push(moreCard('Tout voir', CATS[c].route));
      rails.push(rail(CATS[c].label, cards, { route: CATS[c].route, count: list.length }));
    });
    return html`<section class="hero" data-hero>
        <div class="hero-bg" aria-hidden="true"><div class="hero-layer is-on">${heroBg(e)}</div><div class="hero-layer"></div><div class="hero-shade"></div></div>
        <div class="hero-body" data-hero-body>${heroBody(e)}</div>
        ${heroList.length > 1 ? html`<div class="hero-dots" aria-hidden="true">${heroList.map(function (x, i) { return html`<i class="${i === heroIdx ? 'on' : ''}"></i>`; })}</div>` : ''}
      </section>
      <div class="rails" data-brio-cascade="fondu-haut" data-pas="70" data-declencheur="charge">${rails}</div>`;
  },
  mount: function (root) {
    var hero = root.querySelector('[data-hero]');
    if (!hero) {
      return function () {};
    }
    heroTitle(root.querySelector('[data-hero-title]'));
    var paused = false;
    function show(e, i) {
      if (!e) return;
      var layers = hero.querySelectorAll('.hero-layer');
      var on = hero.querySelector('.hero-layer.is-on');
      var off = layers[0] === on ? layers[1] : layers[0];
      off.innerHTML = str(heroBg(e));
      off.classList.add('is-on');
      on.classList.remove('is-on');
      var body = hero.querySelector('[data-hero-body]');
      body.classList.add('swap');
      setTimeout(function () {
        var hadFocus = body.contains(document.activeElement);
        body.innerHTML = str(heroBody(e));
        body.classList.remove('swap');
        refresh(body);
        heroTitle(body.querySelector('[data-hero-title]'));
        if (hadFocus) { var b = body.querySelector('.btn-play'); if (b) b.focus({ preventScroll: true }); }
      }, lightMotion() ? 120 : 260);
      var dots = hero.querySelectorAll('.hero-dots i');
      for (var k = 0; k < dots.length; k++) dots[k].classList.toggle('on', k === i);
    }
    hero.addEventListener('pointerenter', function () { paused = true; });
    hero.addEventListener('pointerleave', function () { paused = false; });
    hero.addEventListener('focusin', function () { paused = true; });
    hero.addEventListener('focusout', function () { paused = false; });
    clearInterval(timer);
    if (!isTV() && state.settings.heroRotate && heroList.length > 1) {
      timer = setInterval(function () {
        if (paused || document.hidden || document.querySelector('.player.shown')) return;
        heroIdx = (heroIdx + 1) % heroList.length;
        show(heroList[heroIdx], heroIdx);
      }, 11000);
    }
    // TV : le héros suit la carte sélectionnée (aperçu en grand, comme les applis TV).
    var tvTimer = null, lastKey = heroList[0] && heroList[0].key;
    function onFocus(ev) {
      if (!isTV()) return;
      var c = ev.target.closest && ev.target.closest('.card[data-key]');
      if (!c) return;
      clearTimeout(tvTimer);
      tvTimer = setTimeout(function () {
        var key = c.getAttribute('data-key');
        if (key === lastKey) return;
        var en = entity(key);
        if (en) { lastKey = key; show(en, -1); }
      }, 380);
    }
    root.addEventListener('focusin', onFocus);
    hero.addEventListener('nx:change', function (ev) {
      var b = ev.target.closest('[data-nx="pilule-enregistrer"]');
      if (b) toggleList(b.getAttribute('data-key'), !!(ev.detail && ev.detail.actif));
    });
    return function () { clearInterval(timer); clearTimeout(tvTimer); root.removeEventListener('focusin', onFocus); };
  }
};
