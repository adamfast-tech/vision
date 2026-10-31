/* État de l'application et persistance.
   localStorage : réglages, sources, progression, « Ma liste ».  IndexedDB : fichiers scannés, métadonnées. */
import * as idb from './idb.js';
import { emit, debounce } from './util.js';

var LS = 'vision:';

export var DEFAULTS = {
  device: 'auto',          // auto | tv | desktop | tablet | mobile
  motion: 'auto',          // auto | full | reduced
  player: 'auto',          // auto | native | drive
  autoNext: true,
  autoResume: true,
  skipIntro: true,
  skipIntroSec: 85,
  seriesClick: 'fiche',    // fiche | play
  subsAuto: true,
  subsLang: 'fr',
  anilist: true,
  tmdbKey: '',
  autoScanHours: 12,
  tvFullscreen: true,
  fsOnPlay: true,
  splash: true,
  heroRotate: true,
  volume: 1,
  muted: false,
  rate: 1
};

function load(key, fallback) {
  try {
    var v = localStorage.getItem(LS + key);
    return v == null ? fallback : JSON.parse(v);
  } catch (e) { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(LS + key, JSON.stringify(value)); return true; }
  catch (e) { console.warn('[vision] stockage plein ou bloqué', e); return false; }
}

export var state = {
  settings: Object.assign({}, DEFAULTS, load('settings', {})),
  sources: load('sources', []),
  progress: load('progress', {}),
  list: load('list', []),
  searches: load('searches', []),
  items: {},       // sourceId -> [items]
  meta: {},        // entityKey -> métadonnées
  scanning: {},    // sourceId -> { found, folders, phase }
  lib: null,
  device: 'desktop'
};

/* ---------- Réglages ---------- */
export function setting(k) { return state.settings[k]; }
export function setSetting(k, v) {
  state.settings[k] = v;
  save('settings', state.settings);
  emit('settings', { key: k, value: v });
}
export function replaceSettings(obj) {
  state.settings = Object.assign({}, DEFAULTS, obj || {});
  save('settings', state.settings);
  emit('settings', { key: '*' });
}

/* ---------- Sources ---------- */
export function getSource(id) {
  for (var i = 0; i < state.sources.length; i++) if (state.sources[i].id === id) return state.sources[i];
  return null;
}
export function upsertSource(src) {
  var i = -1;
  for (var j = 0; j < state.sources.length; j++) if (state.sources[j].id === src.id) i = j;
  if (i === -1) state.sources.push(src); else state.sources[i] = src;
  save('sources', state.sources);
  emit('sources', { id: src.id });
  return src;
}
export function patchSource(id, patch) {
  var s = getSource(id);
  if (!s) return null;
  Object.keys(patch).forEach(function (k) { s[k] = patch[k]; });
  save('sources', state.sources);
  emit('sources', { id: id });
  return s;
}
export function removeSource(id) {
  state.sources = state.sources.filter(function (s) { return s.id !== id; });
  delete state.items[id];
  save('sources', state.sources);
  idb.del('items:' + id);
  idb.del('mega:' + id);
  idb.del('gtoken:' + id);
  emit('sources', { id: id, removed: true });
}

/* ---------- Fichiers scannés (IndexedDB) ---------- */
export function loadItems() {
  return Promise.all(state.sources.map(function (s) {
    return idb.get('items:' + s.id).then(function (items) { state.items[s.id] = items || []; });
  }));
}
export function saveItems(sourceId, items) {
  state.items[sourceId] = items;
  return idb.set('items:' + sourceId, items);
}

/* ---------- Métadonnées (affiches, résumés) ---------- */
export function loadMeta() {
  return idb.get('meta').then(function (m) { state.meta = m || {}; });
}
var flushMeta = debounce(function () { idb.set('meta', state.meta); }, 1500);
export function setMeta(key, value) {
  state.meta[key] = value;
  flushMeta();
}
export function clearMeta() {
  state.meta = {};
  return idb.set('meta', {});
}

/* ---------- Progression ---------- */
var flushProgress = debounce(function () { save('progress', state.progress); }, 800);
export function getProgress(itemId) { return state.progress[itemId] || null; }
export function setProgress(itemId, t, d, opts) {
  if (!itemId) return;
  var p = state.progress[itemId] || {};
  p.t = Math.max(0, Math.round(t || 0));
  if (d && isFinite(d)) p.d = Math.round(d);
  p.u = Date.now();
  var dur = p.d || 0;
  p.done = !!(opts && opts.done) || (dur > 0 && (p.t / dur >= 0.92 || (dur > 600 && dur - p.t < 45)));
  if (opts && opts.iframe) p.iframe = true;
  state.progress[itemId] = p;
  flushProgress();
  emit('progress', { id: itemId });
}
export function markWatched(itemId, done) {
  var p = state.progress[itemId] || { t: 0 };
  p.done = !!done;
  if (!done) p.t = 0;
  p.u = Date.now();
  state.progress[itemId] = p;
  save('progress', state.progress);
  emit('progress', { id: itemId });
}
export function clearProgress() {
  state.progress = {};
  save('progress', state.progress);
  emit('progress', {});
}
export function ratio(itemId) {
  var p = state.progress[itemId];
  if (!p) return 0;
  if (p.done) return 1;
  return p.d ? Math.min(1, p.t / p.d) : 0;
}

/* ---------- Ma liste ---------- */
export function inList(key) { return state.list.indexOf(key) !== -1; }
export function toggleList(key, force) {
  var has = inList(key), want = force == null ? !has : !!force;
  if (want && !has) state.list.unshift(key);
  if (!want && has) state.list = state.list.filter(function (k) { return k !== key; });
  save('list', state.list);
  emit('list', { key: key, on: want });
  return want;
}

/* ---------- Recherches récentes ---------- */
export function pushSearch(q) {
  q = String(q || '').trim();
  if (q.length < 2) return;
  state.searches = [q].concat(state.searches.filter(function (s) { return s.toLowerCase() !== q.toLowerCase(); })).slice(0, 8);
  save('searches', state.searches);
}
export function clearSearches() { state.searches = []; save('searches', []); }

/* ---------- Export / import de configuration ---------- */
export function exportConfig(withHistory) {
  var cfg = { v: 1, app: 'vision', at: Date.now(), sources: state.sources.map(function (s) {
    var c = JSON.parse(JSON.stringify(s));
    delete c.count; delete c.error; delete c.scannedAt;
    return c;
  }), settings: {} };
  ['player', 'autoNext', 'autoResume', 'skipIntro', 'skipIntroSec', 'seriesClick', 'subsAuto', 'subsLang', 'anilist', 'tmdbKey', 'autoScanHours'].forEach(function (k) {
    cfg.settings[k] = state.settings[k];
  });
  if (withHistory) { cfg.progress = state.progress; cfg.list = state.list; }
  return cfg;
}
export function importConfig(cfg) {
  if (!cfg || cfg.app !== 'vision' || !Array.isArray(cfg.sources)) throw new Error('Fichier de configuration Vision invalide.');
  var added = 0;
  cfg.sources.forEach(function (s) {
    if (!s || !s.id || !s.type) return;
    var cur = getSource(s.id);
    if (cur) { Object.keys(s).forEach(function (k) { cur[k] = s[k]; }); }
    else { state.sources.push(s); added++; }
  });
  save('sources', state.sources);
  if (cfg.settings) {
    Object.keys(cfg.settings).forEach(function (k) { if (k in DEFAULTS) state.settings[k] = cfg.settings[k]; });
    save('settings', state.settings);
  }
  if (cfg.progress && typeof cfg.progress === 'object') {
    Object.keys(cfg.progress).forEach(function (k) {
      var a = state.progress[k], b = cfg.progress[k];
      if (!a || (b && b.u > a.u)) state.progress[k] = b;
    });
    save('progress', state.progress);
  }
  if (Array.isArray(cfg.list)) {
    cfg.list.forEach(function (k) { if (state.list.indexOf(k) === -1) state.list.push(k); });
    save('list', state.list);
  }
  emit('sources', { imported: true });
  emit('settings', { key: '*' });
  return added;
}

export function resetAll() {
  Object.keys(localStorage).forEach(function (k) { if (k.indexOf(LS) === 0) localStorage.removeItem(k); });
  return idb.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return idb.del(k); })); });
}
