/* Construction de la bibliothèque : fichiers → films, séries, animes, autres vidéos. */
import { state, ratio } from '../core/store.js';
import { norm, ext } from '../core/util.js';
import { parseName, categoryOf, seasonFromFolder, isSeasonFolder, isGenericName, prettyTitle } from './parse.js';

export var CATS = {
  film: { label: 'Films', one: 'Film', route: '/films' },
  serie: { label: 'Séries', one: 'Série', route: '/series' },
  anime: { label: 'Animes', one: 'Anime', route: '/animes' },
  autre: { label: 'Autres vidéos', one: 'Vidéo', route: '/autres' }
};

var PLAYABLE = ['mp4', 'm4v', 'webm', 'mov', 'm3u8'];
var QRANK = { '4K': 4, '1080p': 3, '720p': 2, 'SD': 1, '': 0 };

function folderTitle(name) {
  var p = parseName(String(name) + '.dir');
  return { title: p.title || String(name), year: p.year };
}

function emptyLib() {
  return { entities: {}, list: [], byItem: {}, items: {}, counts: { film: 0, serie: 0, anime: 0, autre: 0 }, built: Date.now() };
}

export function build() {
  var lib = emptyLib();
  var pending = {}; // clé série → saison → fichiers sans numéro d'épisode

  state.sources.forEach(function (src) {
    if (src.enabled === false) return;
    var list = state.items[src.id] || [];
    var perFolder = {};
    list.forEach(function (it) { var k = (it.path || []).join('/'); perFolder[k] = (perFolder[k] || 0) + 1; });

    list.forEach(function (it) {
      lib.items[it.id] = it;
      var path = it.path || [];
      var co = categoryOf(path);
      var forced = src.category && src.category !== 'auto' ? src.category : null;
      var cat = forced || co.cat;
      var depth = forced ? -1 : co.depth;
      var p = parseName(it.name);
      var lastDir = path.length ? path[path.length - 1] : '';
      var seasonDir = lastDir ? seasonFromFolder(lastDir) : null;
      var below = depth + 1;
      var hasSub = path.length > below;
      var siblings = perFolder[path.join('/')] || 1;

      var isEp = p.episode !== null || seasonDir !== null || it.season != null;
      if (!isEp && (cat === 'serie' || (cat === 'anime' && co.kindHint !== 'film')) && hasSub && siblings >= 2) isEp = true;
      if (co.kindHint === 'film' && p.season === null && seasonDir === null && !it.season) isEp = false;
      if (!cat) {
        if (isEp) cat = (p.group || (p.absolute && p.langs.indexOf('VOSTFR') !== -1)) ? 'anime' : 'serie';
        else cat = (it.size > 300 * 1048576 || it.dur > 2400) ? 'film' : 'autre';
      }

      if (isEp) addEpisode(lib, pending, src, it, p, cat, path, depth, seasonDir, !!forced);
      else addMovie(lib, src, it, p, cat, path, depth, siblings);
    });
  });

  // Fichiers d'une série sans numéro : numérotés dans l'ordre alphabétique, après le dernier connu.
  Object.keys(pending).forEach(function (key) {
    var show = lib.entities[key];
    Object.keys(pending[key]).forEach(function (sn) {
      var arr = pending[key][sn].sort(function (a, b) { return a.item.name.localeCompare(b.item.name, 'fr', { numeric: true }); });
      var season = getSeason(show, +sn), max = 0;
      season.eps.forEach(function (e) { if (e.e > max) max = e.e; });
      arr.forEach(function (x, i) {
        var ep = { item: x.item, s: +sn, e: max + i + 1, title: x.title || '', guess: true, show: show };
        season.eps.push(ep);
        lib.byItem[x.item.id] = { entity: show, ep: ep, item: x.item };
      });
    });
  });

  Object.keys(lib.entities).forEach(function (k) { finalize(lib, lib.entities[k]); });
  lib.list.sort(function (a, b) { return b.added - a.added; });
  state.lib = lib;
  return lib;
}

function getSeason(show, n) {
  for (var i = 0; i < show.seasons.length; i++) if (show.seasons[i].n === n) return show.seasons[i];
  var s = { n: n, eps: [] };
  show.seasons.push(s);
  return s;
}

function addEpisode(lib, pending, src, it, p, cat, path, depth, seasonDir, catForced) {
  // Titre de la série : un dossier qui correspond au titre analysé, sinon le premier dossier sous la catégorie,
  // sinon le dossier le plus proche, sinon le titre du fichier.
  var folders = [];
  for (var i = Math.max(0, depth + 1); i < path.length; i++) if (!isSeasonFolder(path[i])) folders.push(i);
  var title = '', year = null, pt = norm(p.title);
  if (pt) {
    for (var j = 0; j < folders.length; j++) {
      var ft = folderTitle(path[folders[j]]), fn = norm(ft.title);
      if (fn && (fn === pt || fn.indexOf(pt) === 0 || pt.indexOf(fn) === 0)) { title = ft.title; year = ft.year; break; }
    }
  }
  var catRoot = depth >= 0 || catForced;
  if (!title && folders.length && (catRoot || !pt)) {
    var f = folderTitle(path[catRoot ? folders[0] : folders[folders.length - 1]]);
    title = f.title; year = f.year;
  }
  if (!title) { title = p.title || it.title || 'Sans titre'; year = p.year; }
  if (it.show) title = it.show;
  title = prettyTitle(title);

  var key = 's:' + cat + ':' + norm(title);
  var show = lib.entities[key];
  if (!show) {
    show = lib.entities[key] = { key: key, kind: 'show', cat: cat, title: title, year: year || null, seasons: [], added: 0, size: 0, thumb: '', srcs: {}, count: 0 };
    lib.list.push(show);
  }
  if (!show.year && year) show.year = year;
  show.srcs[src.id] = 1;
  show.added = Math.max(show.added, it.mtime || 0);
  show.size += it.size || 0;
  show.count++;

  var sn = it.season != null ? it.season : (p.season !== null ? p.season : (seasonDir !== null ? seasonDir : 1));
  var en = it.episode != null ? it.episode : p.episode;
  if (en === null || en === undefined) {
    pending[key] = pending[key] || {};
    (pending[key][sn] = pending[key][sn] || []).push({ item: it, title: p.title && norm(p.title) !== norm(title) ? p.title : '' });
    return;
  }
  var ep = { item: it, s: sn, e: en, e2: p.episodeEnd, title: it.epTitle || p.epTitle || '', show: show, quality: p.quality, langs: p.langs };
  getSeason(show, sn).eps.push(ep);
  lib.byItem[it.id] = { entity: show, ep: ep, item: it };
}

function addMovie(lib, src, it, p, cat, path, depth, siblings) {
  var title = it.title || p.title, year = it.year || p.year;
  var lastDir = path.length ? path[path.length - 1] : '';
  if (!it.title && lastDir && path.length > depth + 1 && siblings <= 3 && !isSeasonFolder(lastDir)) {
    var f = folderTitle(lastDir), fn = norm(f.title), pt = norm(p.title);
    if (isGenericName(p.title) || (f.year && !p.year) || (fn && pt && (fn.indexOf(pt) !== -1 || pt.indexOf(fn) !== -1))) {
      title = f.title; year = year || f.year;
    }
  }
  if (!title || isGenericName(title)) title = title || 'Sans titre';
  title = prettyTitle(title);

  var key = 'm:' + cat + ':' + norm(title) + ':' + (year || '');
  var mv = lib.entities[key];
  if (!mv) {
    mv = lib.entities[key] = { key: key, kind: 'movie', cat: cat, title: title, year: year || null, items: [], added: 0, size: 0, thumb: '', srcs: {}, quality: '', langs: [] };
    lib.list.push(mv);
  }
  mv.items.push(it);
  mv.srcs[src.id] = 1;
  mv.added = Math.max(mv.added, it.mtime || 0);
  mv.size += it.size || 0;
  it._q = p.quality; it._l = p.langs;
  lib.byItem[it.id] = { entity: mv, ep: null, item: it };
}

function finalize(lib, e) {
  if (e.kind === 'show') {
    e.seasons.sort(function (a, b) { return (a.n === 0 ? 999 : a.n) - (b.n === 0 ? 999 : b.n); });
    e.seasons.forEach(function (s) {
      s.eps.sort(function (a, b) { return a.e - b.e || a.item.name.localeCompare(b.item.name); });
      s.label = s.n === 0 ? 'Spéciaux' : 'Saison ' + s.n;
    });
    e.flat = [];
    e.seasons.forEach(function (s) { s.eps.forEach(function (ep) { e.flat.push(ep); }); });
    for (var i = 0; i < e.flat.length; i++) if (e.flat[i].item.thumb) { e.thumb = e.flat[i].item.thumb; break; }
    var q = '';
    e.flat.forEach(function (ep) { if (QRANK[ep.quality || ''] > QRANK[q]) q = ep.quality; });
    e.quality = q;
  } else {
    e.items.sort(function (a, b) {
      var pa = PLAYABLE.indexOf(ext(a.name)) !== -1 ? 1 : 0, pb = PLAYABLE.indexOf(ext(b.name)) !== -1 ? 1 : 0;
      return (pb - pa) || (QRANK[b._q || ''] - QRANK[a._q || '']) || ((b.size || 0) - (a.size || 0));
    });
    e.item = e.items[0];
    e.thumb = (e.items.filter(function (x) { return x.thumb; })[0] || {}).thumb || '';
    e.quality = e.item._q || '';
    e.langs = e.item._l || [];
    e.dur = e.item.dur || 0;
    e.desc = e.item.overview || '';
  }
  e.counted = true;
  lib.counts[e.cat] = (lib.counts[e.cat] || 0) + 1;
  applyMeta(e);
}

export function applyMeta(e) {
  var m = state.meta[e.key];
  e.meta = m && !m.miss ? m : null;
  e.norm = norm(e.title + ' ' + (e.meta && e.meta.title ? e.meta.title : '') + ' ' + (e.meta && e.meta.alt ? e.meta.alt : '') + ' ' + (e.year || ''));
}

/* ---------- Requêtes ---------- */
export function lib() { return state.lib || build(); }
export function entity(key) { return lib().entities[key] || null; }
export function locate(itemId) { return lib().byItem[itemId] || null; }
export function item(itemId) { return lib().items[itemId] || null; }

export function displayTitle(e) { return e.meta && e.meta.title ? e.meta.title : e.title; }
export function image(e, prefer) {
  var m = e.meta;
  if (prefer === 'poster' && m && m.poster) return m.poster;
  if (m && m.backdrop) return m.backdrop;
  if (e.thumb) return e.thumb;
  if (m && m.poster) return m.poster;
  return '';
}

export function epLabel(ep) {
  if (!ep) return '';
  var e = ep.e2 ? ep.e + '-' + ep.e2 : ep.e;
  return (ep.s === 0 ? 'Spécial ' : 'S' + (ep.s < 10 ? '0' : '') + ep.s + 'E') + (ep.e < 10 && !ep.e2 ? '0' : '') + e;
}
export function epLong(ep) {
  if (!ep) return '';
  return (ep.s === 0 ? 'Spécial' : 'Saison ' + ep.s) + ', épisode ' + (ep.e2 ? ep.e + ' et ' + ep.e2 : ep.e);
}

export function isDone(itemId) { var p = state.progress[itemId]; return !!(p && p.done); }

export function nextEpisode(show, fromItemId) {
  if (!show || !show.flat) return null;
  for (var i = 0; i < show.flat.length; i++) {
    if (show.flat[i].item.id === fromItemId) return show.flat[i + 1] || null;
  }
  return null;
}
export function prevEpisode(show, fromItemId) {
  if (!show || !show.flat) return null;
  for (var i = 0; i < show.flat.length; i++) if (show.flat[i].item.id === fromItemId) return show.flat[i - 1] || null;
  return null;
}

/* Ce que « Lecture » lance pour une fiche : reprise, épisode suivant ou début. */
export function playTarget(e) {
  if (e.kind === 'movie') {
    var p = state.progress[e.item.id];
    return { item: e.item, ep: null, resume: !!(p && !p.done && p.t > 20), t: p ? p.t : 0 };
  }
  var best = null, bu = 0;
  e.flat.forEach(function (ep) {
    var pr = state.progress[ep.item.id];
    if (pr && pr.u > bu) { bu = pr.u; best = ep; }
  });
  if (best) {
    var pb = state.progress[best.item.id];
    if (!pb.done && pb.t > 20) return { item: best.item, ep: best, resume: true, t: pb.t };
    var n = nextEpisode(e, best.item.id);
    if (n) return { item: n.item, ep: n, resume: false, next: true, t: 0 };
    return { item: best.item, ep: best, resume: false, again: true, t: 0 };
  }
  var first = e.flat.filter(function (x) { return x.s !== 0; })[0] || e.flat[0];
  return first ? { item: first.item, ep: first, resume: false, t: 0 } : null;
}

export function playLabel(e) {
  var t = playTarget(e);
  if (!t) return 'Lecture';
  if (t.resume) return e.kind === 'show' ? 'Reprendre ' + epLabel(t.ep) : 'Reprendre';
  if (t.next) return 'Lire ' + epLabel(t.ep);
  if (e.kind === 'show') return 'Lire ' + epLabel(t.ep);
  return 'Lecture';
}

export function continueWatching(limit) {
  var L = lib(), arr = [];
  Object.keys(state.progress).forEach(function (id) {
    var loc = L.byItem[id];
    if (loc) arr.push({ p: state.progress[id], loc: loc });
  });
  arr.sort(function (a, b) { return (b.p.u || 0) - (a.p.u || 0); });
  var seen = {}, out = [];
  arr.forEach(function (x) {
    var e = x.loc.entity;
    if (seen[e.key]) return;
    seen[e.key] = 1;
    if (!x.p.done && x.p.t > 20 && !x.p.iframe) out.push({ entity: e, item: x.loc.item, ep: x.loc.ep, ratio: ratio(x.loc.item.id) });
    else if (e.kind === 'show') {
      var n = x.p.done ? nextEpisode(e, x.loc.item.id) : null;
      if (n && !isDone(n.item.id)) out.push({ entity: e, item: n.item, ep: n, ratio: 0, next: true });
    }
  });
  return out.slice(0, limit || 30);
}

export function byCat(cat) {
  return lib().list.filter(function (e) { return e.cat === cat; });
}
export function recent(limit) {
  return lib().list.slice().sort(function (a, b) { return b.added - a.added; }).slice(0, limit || 30);
}
export function myList() {
  var L = lib();
  return state.list.map(function (k) { return L.entities[k]; }).filter(Boolean);
}

function fuzzy(needle, hay) {
  var j = 0;
  for (var i = 0; i < hay.length && j < needle.length; i++) if (hay[i] === needle[j]) j++;
  return j === needle.length && needle.length >= 3;
}
export function search(q, cat) {
  var nq = norm(q);
  if (!nq) return [];
  var words = nq.split(' ');
  var res = [];
  lib().list.forEach(function (e) {
    if (cat && cat !== 'all' && e.cat !== cat) return;
    var hay = e.norm || norm(e.title), score = 0;
    if (hay === nq) score = 100;
    else if (hay.indexOf(nq) === 0) score = 85;
    else if (hay.indexOf(' ' + nq) !== -1) score = 70;
    else if (hay.indexOf(nq) !== -1) score = 55;
    else {
      var hw = hay.split(' ');
      var all = words.every(function (w) { return hw.some(function (h) { return h.indexOf(w) === 0; }); });
      if (all) score = 40;
      else if (fuzzy(nq.replace(/ /g, ''), hay.replace(/ /g, ''))) score = 12;
    }
    if (score) res.push({ e: e, s: score });
  });
  res.sort(function (a, b) { return b.s - a.s || a.e.title.localeCompare(b.e.title, 'fr'); });
  return res.map(function (r) { return r.e; });
}

export function sortEntities(list, mode) {
  var a = list.slice();
  if (mode === 'az') a.sort(function (x, y) { return displayTitle(x).localeCompare(displayTitle(y), 'fr', { numeric: true }); });
  else if (mode === 'year') a.sort(function (x, y) { return (y.year || 0) - (x.year || 0) || displayTitle(x).localeCompare(displayTitle(y), 'fr'); });
  else if (mode === 'size') a.sort(function (x, y) { return (y.size || 0) - (x.size || 0); });
  else a.sort(function (x, y) { return y.added - x.added; });
  return a;
}

export function genresOf(list) {
  var g = {};
  list.forEach(function (e) { if (e.meta && e.meta.genres) e.meta.genres.forEach(function (x) { g[x] = (g[x] || 0) + 1; }); });
  return Object.keys(g).sort(function (a, b) { return g[b] - g[a]; }).slice(0, 12);
}

export function totalItems() {
  var n = 0;
  state.sources.forEach(function (s) { if (s.enabled !== false) n += (state.items[s.id] || []).length; });
  return n;
}
