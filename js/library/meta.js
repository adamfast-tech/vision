/* Visuels et résumés : AniList pour les animes (sans clé), TMDB pour tout le reste (clé gratuite à saisir).
   Résultats gardés dans IndexedDB ; un échec est retenu 7 jours pour ne pas réinterroger en boucle. */
import { state, setMeta } from '../core/store.js';
import { emit, norm, sleep, debounce } from '../core/util.js';
import { lib, applyMeta } from './library.js';

var TMDB = 'https://api.themoviedb.org/3';
var IMG = 'https://image.tmdb.org/t/p/';
var running = false, queued = false;
var announce = debounce(function () { emit('meta', {}); }, 600);

function tmdbFetch(path, params) {
  var key = (state.settings.tmdbKey || '').trim();
  var q = Object.keys(params || {}).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
  var headers = { Accept: 'application/json' };
  var url = TMDB + path + '?' + q;
  if (key.length > 40) headers.Authorization = 'Bearer ' + key;
  else url += '&api_key=' + encodeURIComponent(key);
  return fetch(url, { headers: headers }).then(function (r) {
    if (r.status === 401) throw new Error('Clé TMDB refusée.');
    if (r.status === 429) return sleep(1500).then(function () { return tmdbFetch(path, params); });
    if (!r.ok) throw new Error('TMDB ' + r.status);
    return r.json();
  });
}

var genreCache = null;
function genres() {
  if (genreCache) return genreCache;
  genreCache = Promise.all([tmdbFetch('/genre/movie/list', { language: 'fr-FR' }), tmdbFetch('/genre/tv/list', { language: 'fr-FR' })])
    .then(function (r) { var m = {}; r.forEach(function (x) { (x.genres || []).forEach(function (g) { m[g.id] = g.name; }); }); return m; })
    .catch(function () { genreCache = null; return {}; });
  return genreCache;
}

function pick(results, title, year, kind) {
  if (!results || !results.length) return null;
  var nt = norm(title), best = null, bs = -1;
  results.slice(0, 8).forEach(function (r, i) {
    var t = norm(kind === 'show' ? r.name : r.title), o = norm(kind === 'show' ? r.original_name : r.original_title);
    var d = (kind === 'show' ? r.first_air_date : r.release_date) || '';
    var y = +d.slice(0, 4) || 0, s = 10 - i;
    if (t === nt || o === nt) s += 40;
    else if (t.indexOf(nt) === 0 || o.indexOf(nt) === 0) s += 15;
    if (year && y) s += year === y ? 30 : (Math.abs(year - y) <= 1 ? 12 : -10);
    s += Math.min(10, (r.popularity || 0) / 10);
    if (s > bs) { bs = s; best = r; }
  });
  return bs >= 20 ? best : null;
}

function fromTmdb(e) {
  var kind = e.kind === 'show' ? 'tv' : 'movie';
  var params = { query: e.title, language: 'fr-FR', include_adult: 'false' };
  if (e.year) params[kind === 'tv' ? 'first_air_date_year' : 'year'] = e.year;
  return tmdbFetch('/search/' + kind, params).then(function (res) {
    var r = pick(res.results, e.title, e.year, e.kind);
    if (!r && e.year) {
      delete params.year; delete params.first_air_date_year;
      return tmdbFetch('/search/' + kind, params).then(function (res2) { return pick(res2.results, e.title, null, e.kind); });
    }
    return r;
  }).then(function (r) {
    if (!r) return null;
    return genres().then(function (gm) {
      var d = (kind === 'tv' ? r.first_air_date : r.release_date) || '';
      return {
        src: 'tmdb', id: r.id, kind: kind,
        title: kind === 'tv' ? r.name : r.title,
        alt: kind === 'tv' ? r.original_name : r.original_title,
        year: +d.slice(0, 4) || null,
        overview: r.overview || '',
        poster: r.poster_path ? IMG + 'w500' + r.poster_path : '',
        backdrop: r.backdrop_path ? IMG + 'w1280' + r.backdrop_path : '',
        genres: (r.genre_ids || []).map(function (id) { return gm[id]; }).filter(Boolean),
        rating: r.vote_average ? Math.round(r.vote_average * 10) / 10 : null,
        at: Date.now()
      };
    });
  });
}

var ANILIST_Q = 'query ($s: String) { Media(search: $s, type: ANIME) { id format seasonYear episodes genres averageScore bannerImage description(asHtml: false) title { romaji english native } coverImage { extraLarge color } } }';
function fromAnilist(e) {
  return fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: ANILIST_Q, variables: { s: e.title } })
  }).then(function (r) {
    if (r.status === 429) {
      var wait = (+r.headers.get('Retry-After') || 30) * 1000;
      return sleep(Math.min(wait, 65000)).then(function () { return fromAnilist(e); });
    }
    if (r.status === 404) return { data: { Media: null } };
    if (!r.ok) throw new Error('AniList ' + r.status);
    return r.json();
  }).then(function (j) {
    var m = j && j.data && j.data.Media;
    if (!m) return null;
    var t = m.title || {};
    var desc = String(m.description || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/\(Source:[^)]*\)/i, '').replace(/\n{3,}/g, '\n\n').trim();
    return {
      src: 'anilist', id: m.id, kind: m.format === 'MOVIE' ? 'movie' : 'tv',
      title: t.english || t.romaji || e.title,
      alt: [t.romaji, t.native].filter(Boolean).join(' '),
      year: m.seasonYear || null,
      overview: desc,
      poster: (m.coverImage || {}).extraLarge || '',
      backdrop: m.bannerImage || '',
      color: (m.coverImage || {}).color || '',
      genres: m.genres || [],
      rating: m.averageScore ? Math.round(m.averageScore) / 10 : null,
      at: Date.now()
    };
  });
}

function needs(e) {
  var m = state.meta[e.key];
  if (!m) return true;
  if (m.miss) return Date.now() - m.at > 7 * 86400000;
  return false;
}

/* Parcourt les fiches sans visuel. Une seule passe à la fois. */
export function enrich(force) {
  if (running) { queued = true; return Promise.resolve(); }
  var tmdb = !!(state.settings.tmdbKey || '').trim(), ani = state.settings.anilist !== false;
  if (!tmdb && !ani) return Promise.resolve();
  if (!navigator.onLine) return Promise.resolve();
  var todo = lib().list.filter(function (e) {
    if (!e.items && !e.flat) return false;
    if (e.title === 'Sans titre') return false;
    var allDemo = Object.keys(e.srcs).every(function (id) { var s = state.sources.filter(function (x) { return x.id === id; })[0]; return s && s.type === 'demo'; });
    if (allDemo) return false;
    if (e.cat === 'anime') return (ani || tmdb) && (force || needs(e));
    return tmdb && (force || needs(e));
  });
  if (!todo.length) return Promise.resolve();
  running = true;
  var i = 0;
  function step() {
    if (i >= todo.length) return Promise.resolve();
    var e = todo[i++];
    var job = e.cat === 'anime' && ani ? fromAnilist(e).then(function (r) { return r || (tmdb ? fromTmdb(e) : null); }) : fromTmdb(e);
    return job.then(function (m) {
      setMeta(e.key, m || { miss: true, at: Date.now() });
      if (m) { applyMeta(e); announce(); }
    }, function (err) {
      if (/refusée/.test(err.message)) { i = todo.length; emit('toast', { msg: err.message + ' Vérifie-la dans les réglages.', type: 'error' }); }
    }).then(function () { return sleep(e.cat === 'anime' && ani ? 900 : 120); }).then(step);
  }
  return step().then(function () {
    running = false;
    if (queued) { queued = false; return enrich(); }
  }, function () { running = false; });
}

/* Titres des épisodes d'une saison (TMDB), chargés à l'ouverture d'une fiche. */
export function seasonDetails(e, n) {
  var m = e.meta;
  if (!m || m.src !== 'tmdb' || m.kind !== 'tv' || !(state.settings.tmdbKey || '').trim()) return Promise.resolve(null);
  m.seasons = m.seasons || {};
  if (m.seasons[n]) return Promise.resolve(m.seasons[n]);
  return tmdbFetch('/tv/' + m.id + '/season/' + n, { language: 'fr-FR' }).then(function (r) {
    var eps = {};
    (r.episodes || []).forEach(function (x) {
      eps[x.episode_number] = { title: x.name || '', overview: x.overview || '', still: x.still_path ? IMG + 'w300' + x.still_path : '' };
    });
    m.seasons[n] = eps;
    setMeta(e.key, m);
    return eps;
  }).catch(function () { return null; });
}

export function testTmdb(key) {
  var prev = state.settings.tmdbKey;
  state.settings.tmdbKey = key;
  return tmdbFetch('/configuration', {}).then(function () { state.settings.tmdbKey = prev; return true; }, function (e) { state.settings.tmdbKey = prev; throw e; });
}
