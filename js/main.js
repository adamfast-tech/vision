/* Vision — démarrage, routes, rendu des vues, actions globales. */
import { str, on, debounce, shuffle } from './core/util.js';
import { state, loadItems, loadMeta } from './core/store.js';
import * as device from './core/device.js';
import * as nav from './core/nav.js';
import * as router from './core/router.js';
import { build, entity, playTarget, lib, byCat, locate, isDone } from './library/library.js';
import { scanAll, isScanning } from './library/scan.js';
import { enrich } from './library/meta.js';
import * as gdrive from './providers/gdrive.js';
import * as mega from './providers/mega.js';
import * as webdav from './providers/webdav.js';
import { candidates } from './providers/index.js';
import { markWatched } from './core/store.js';
import * as player from './player/player.js';
import { refresh, splash, swap } from './ui/fx.js';
import { genCover } from './ui/components.js';
import { toast, modal } from './ui/overlay.js';
import home from './ui/views/home.js';
import { makeCategory } from './ui/views/category.js';
import detail from './ui/views/detail.js';
import search from './ui/views/search.js';
import sources, { addDemo } from './ui/views/sources.js';
import settings from './ui/views/settings.js';
import pair from './ui/views/pair.js';

var view = document.getElementById('view');
var cur = { view: null, route: null, cleanup: null };
var dirty = false;

/* ---------- Routes ---------- */
router.route('/', home);
router.route('/films', makeCategory('film'));
router.route('/series', makeCategory('serie'));
router.route('/animes', makeCategory('anime'));
router.route('/autres', makeCategory('autre'));
router.route('/liste', makeCategory('liste'));
router.route('/titre/:key', detail);
router.route('/recherche', search);
router.route('/sources', sources);
router.route('/sources/ajouter', sources);
router.route('/sources/ajouter/:type', sources);
router.route('/sources/modifier/:id', sources);
router.route('/reglages', settings);
router.route('/appairer/:mode', pair);
router.route('/regarder/:id', 'player');

function q(s) { return String(s).replace(/["\\]/g, '\\$&'); }

function focusSelector(el) {
  if (!el || !el.getAttribute || !view.contains(el)) return null;
  var parts = [];
  ['data-act', 'data-key', 'data-item', 'data-season', 'data-sort', 'data-genre', 'data-cat', 'data-setting', 'data-toggle', 'data-q'].forEach(function (a) {
    if (el.hasAttribute(a)) parts.push('[' + a + '="' + q(el.getAttribute(a)) + '"]');
  });
  if (el.id) parts.unshift('#' + el.id);
  return parts.length ? el.tagName.toLowerCase() + parts.join('') : null;
}

function render(r, opts) {
  opts = opts || {};
  var v = r.view;
  if (!v || v === 'player') { router.go('/', { replace: true }); return; }
  var keepSel = opts.quiet ? focusSelector(document.activeElement) : null;
  var y = opts.quiet ? window.scrollY : 0;
  if (cur.cleanup) { try { cur.cleanup(); } catch (e) { /* ignoré */ } }
  var ctx = { params: r.params, query: r.query, path: r.path, pattern: r.pattern, quiet: !!opts.quiet };
  var out = str(v.render(ctx));
  if (opts.quiet) out = out.replace(/\sdata-brio-(cascade|texte|entree)="[^"]*"/g, '');
  var doRender = function () {
    if (opts.quiet) document.documentElement.classList.add('quiet');
    view.innerHTML = out;
    view.setAttribute('data-view', r.pattern || '');
    refresh(view);
    cur = { view: v, route: r, cleanup: v.mount ? v.mount(view, ctx) : null };
    if (opts.quiet) setTimeout(function () { document.documentElement.classList.remove('quiet'); }, 80);
  };
  if (opts.quiet) doRender(); else swap(doRender);
  var t = v.title ? v.title(ctx) : '';
  if (!player.isOpen()) document.title = t && r.path !== '/' ? t + ' · Vision' : 'Vision';
  markNav(v.nav);
  var keyboard = device.isTV() || document.documentElement.getAttribute('data-input') === 'key';
  var mem = opts.back ? memory[r.hash] : null;
  if (opts.quiet) {
    window.scrollTo(0, y);
    if (!(keepSel && nav.restore(keepSel, view)) && !(opts.focusSel && nav.restore(opts.focusSel, view)) && keyboard) nav.focusFirst(document.getElementById('app'));
  } else if (mem) {
    // Retour arrière : on retrouve la position et la carte sélectionnée.
    window.scrollTo(0, mem.y);
    setTimeout(function () { window.scrollTo(0, mem.y); if (!(mem.sel && nav.restore(mem.sel, view)) && keyboard) nav.focusFirst(document.getElementById('app')); }, 60);
  } else {
    window.scrollTo(0, 0);
    if (keyboard) setTimeout(function () { nav.focusFirst(document.getElementById('app')); }, 40);
    else { try { view.focus({ preventScroll: true }); } catch (e) { /* ignoré */ } }
  }
}

/* Mémoire par page : sélection et défilement, pour que Retour ramène exactement où l'on était. */
var memory = {};
function remember() {
  if (!cur.route || !cur.route.hash) return;
  memory[cur.route.hash] = { y: window.scrollY, sel: focusSelector(document.activeElement) };
}

function markNav(id) {
  Array.prototype.forEach.call(document.querySelectorAll('[data-nav-id]'), function (a) {
    if (a.getAttribute('data-nav-id') === id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

function onRoute(r, reason) {
  if (r.view === 'player') {
    if (!cur.view) render(router.parse('#/'));
    if (!player.isOpen() || player.currentId() !== r.params.id) player.open(r.params.id, { gesture: false, replaceRoute: true });
    return;
  }
  if (player.isOpen()) player.close(true);
  if (cur.route && cur.route.path === r.path && reason !== 'force' && reason !== 'start') {
    render(r, { quiet: true, focusSel: lastReturn });
    lastReturn = null;
    dirty = false;
    return;
  }
  remember();
  render(r, { back: reason === 'pop' });
  dirty = false;
}

var lastReturn = null;
window.addEventListener('vision:player-closed', function (e) {
  lastReturn = e.detail && e.detail.sel;
  setTimeout(function () {
    if (player.isOpen()) return;
    if (lastReturn && nav.restore(lastReturn, view)) { lastReturn = null; }
    if (dirty && cur.route) { render(cur.route, { quiet: true, focusSel: lastReturn }); dirty = false; }
  }, 120);
});

/* ---------- Rafraîchissements en direct ---------- */
var liveRender = debounce(function () {
  if (!cur.view || !cur.view.live) return;
  if (cur.view.liveFilter && !cur.view.liveFilter(cur.route)) return;
  if (player.isOpen()) { dirty = true; return; }
  var ae = document.activeElement;
  if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA') && view.contains(ae)) { dirty = true; return; }
  render(cur.route, { quiet: true });
}, 400);
on('library', liveRender);
on('meta', liveRender);
on('sources', function () { build(); liveRender(); });
on('list', function () { dirty = true; });
on('progress', function () { dirty = true; });
on('settings', function (d) {
  if (d && (d.key === 'device' || d.key === 'motion')) device.apply();
});
on('scan', function (d) {
  var any = isScanning();
  var ind = document.getElementById('scan-ind');
  if (ind) ind.hidden = !any;
  var txt = document.querySelector('[data-scan-text]');
  if (txt && d && d.found) txt.textContent = d.found + ' vidéos trouvées pour l’instant…';
  if (cur.route && cur.route.pattern === '/sources' && d && d.phase !== 'progress') liveRender();
  if (cur.route && cur.route.pattern === '/sources' && d && d.phase === 'progress') {
    var st = document.querySelector('.src-card[data-id="' + q(d.id) + '"] [data-status]');
    if (st) st.textContent = 'Synchronisation, ' + (d.found || 0) + ' vidéos…';
  }
  if (d && (d.phase === 'done' || d.phase === 'error') && cur.route && cur.route.path === '/' && !lib().list.length) liveRender();
});

/* ---------- Actions globales (cartes, boutons Lecture) ---------- */
function launch(itemId, el, extra) {
  var media = el && (el.querySelector('.card-media, .ep-media') || el);
  var rect = media && media.getBoundingClientRect ? media.getBoundingClientRect() : null;
  player.open(itemId, Object.assign({ rect: rect, returnSel: focusSelector(el) }, extra || {}));
}
function randomPick(cat) {
  var list = cat && cat !== 'liste' ? byCat(cat) : lib().list;
  var fresh = list.filter(function (e) { var t = playTarget(e); return t && !isDone(t.item.id); });
  return shuffle(fresh.length ? fresh : list)[0];
}
document.addEventListener('click', function (e) {
  var a = e.target.closest && e.target.closest('[data-act]');
  if (!a || a.closest('.player')) return;
  var act = a.getAttribute('data-act');
  var key = a.getAttribute('data-key'), itemId = a.getAttribute('data-item');
  if (act === 'open') { e.preventDefault(); router.go('/titre/' + encodeURIComponent(key)); }
  else if (act === 'play' && itemId) { e.preventDefault(); launch(itemId, a); }
  else if (act === 'play' || act === 'play-show') {
    e.preventDefault();
    var en = entity(key), t = en && playTarget(en);
    if (t) launch(t.item.id, a);
  } else if (act === 'restart') { e.preventDefault(); launch(itemId, a, { restart: true }); }
  else if (act === 'shuffle' || act === 'shuffle-cat') {
    e.preventDefault();
    var pick = randomPick(a.getAttribute('data-cat'));
    if (!pick) return;
    var tt = playTarget(pick);
    toast('Au hasard : ' + (pick.meta && pick.meta.title ? pick.meta.title : pick.title));
    if (tt) launch(tt.item.id, a);
  } else if (act === 'demo') { e.preventDefault(); addDemo(); }
});

/* Appui long (OK maintenu, clic droit, doigt maintenu) : options du titre ou de l'épisode. */
document.addEventListener('longpress', function (e) {
  var el = e.target.closest('[data-key]');
  if (!el) return;
  var key = el.getAttribute('data-key'), itemId = el.getAttribute('data-item');
  if (!itemId || el.classList.contains('card') && entity(key) && entity(key).kind === 'movie' && !el.closest('.rail-continue')) { router.go('/titre/' + encodeURIComponent(key)); return; }
  var loc = locate(itemId);
  if (!loc) { router.go('/titre/' + encodeURIComponent(key)); return; }
  var done = isDone(itemId);
  var ext = candidates(loc.item).filter(function (c) { return c.kind === 'external'; })[0];
  modal({
    title: loc.ep ? (loc.entity.title + ', ' + (loc.ep.s === 0 ? 'spécial ' : 'S' + loc.ep.s + ' E') + loc.ep.e) : loc.entity.title,
    actions: [
      { label: 'Lire depuis le début', primary: true, fn: function (c) { c(); launch(itemId, el, { restart: true }); } },
      { label: done ? 'Marquer non vu' : 'Marquer vu', fn: function (c) { markWatched(itemId, !done); c(); render(cur.route, { quiet: true }); } },
      { label: 'Voir la fiche', fn: function (c) { c(); router.go('/titre/' + encodeURIComponent(key)); } }
    ].concat(ext ? [{ label: ext.label, fn: function (c) { c(); window.open(ext.url, '_blank', 'noopener'); } }] : [])
  });
});

/* Image introuvable (lien expiré, fichier privé) : couverture générée à la place. */
document.addEventListener('error', function (e) {
  var t = e.target;
  if (!t || t.tagName !== 'IMG' || !t.hasAttribute('data-fallback')) return;
  var span = document.createElement('span');
  span.innerHTML = str(genCover(t.getAttribute('data-fallback'), t.className));
  t.replaceWith(span.firstChild);
}, true);

/* Défilement des rangées à la souris (flèches au survol) et à la molette horizontale. */
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('.rail-arrow');
  if (!b) return;
  var track = b.parentNode.querySelector('.rail-track');
  track.scrollBy({ left: (b.classList.contains('next') ? 1 : -1) * track.clientWidth * 0.85, behavior: device.reducedMotion() ? 'auto' : 'smooth' });
});

/* ---------- Télé : plein écran au premier OK ---------- */
document.addEventListener('keydown', function first(e) {
  if (!device.isTV() || !state.settings.tvFullscreen || nav.keyName(e) !== 'ok') return;
  document.removeEventListener('keydown', first);
  var d = document.documentElement;
  if (!document.fullscreenElement && d.requestFullscreen) d.requestFullscreen().catch(function () {});
});

/* ---------- Service worker (hors ligne, mises à jour, lecture MEGA et Drive privé) ---------- */
function registerSW() {
  if (!('serviceWorker' in navigator) || !/^https:|^http:\/\/(localhost|127\.)/.test(location.href)) return;
  navigator.serviceWorker.register('./sw.js', { scope: './' }).then(function (reg) {
    function ask(w) {
      toast('Une nouvelle version de Vision est prête.', { action: { label: 'Mettre à jour', fn: function () { window.__visionUpdating = true; w.postMessage({ type: 'SKIP_WAITING' }); } }, timeout: 15000 });
    }
    if (reg.waiting && navigator.serviceWorker.controller) ask(reg.waiting);
    reg.addEventListener('updatefound', function () {
      var w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', function () { if (w.state === 'installed' && navigator.serviceWorker.controller) ask(w); });
    });
    setInterval(function () { reg.update().catch(function () {}); }, 3600000);
  }).catch(function (e) { console.warn('[vision] service worker', e); });
  var reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (reloaded || !window.__visionUpdating) return;
    reloaded = true;
    location.reload();
  });
}
window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); window.__visionInstall = e; });

/* ---------- Démarrage ---------- */
function boot() {
  device.apply();
  device.trackInput();
  nav.init();
  nav.onBack(function () {
    if (router.canGoBack()) router.back('/');
    else if (router.current().path !== '/') router.go('/', { replace: true });
  });
  window.addEventListener('resize', debounce(function () { device.apply(); }, 300));
  document.getElementById('app').classList.add('ready');

  var showSplash = state.settings.splash && !sessionStorage.getItem('vision-splash');
  try { sessionStorage.setItem('vision-splash', '1'); } catch (e) { /* ignoré */ }
  var sp = document.getElementById('splash');
  if (!showSplash && sp) sp.remove();

  Promise.all([loadItems().catch(function () {}), loadMeta().catch(function () {})]).then(function () {
    build();
    state.sources.forEach(function (s) {
      if (s.type === 'mega') mega.register(s);
      if (s.type === 'webdav') webdav.register(s);
      if (s.type === 'gdrive' && s.gdrive && s.gdrive.mode === 'oauth') gdrive.loadToken(s.id);
    });
    router.start(onRoute);
    if (showSplash) splash();
    setTimeout(function () {
      scanAll(true).then(function (res) {
        var errs = res.filter(function (x) { return x instanceof Error; });
        if (errs.length) toast(errs[0].message, { type: 'error', timeout: 8000 });
      });
      enrich();
    }, 1200);
  });
  registerSW();
  window.addEventListener('online', function () { enrich(); });
}

window.__visionUpdating = false;
boot();
