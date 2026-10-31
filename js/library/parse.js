/* Analyse des noms de fichiers et de dossiers : titre, année, saison, épisode, qualité, langue. */
import { norm, ext, stripExt } from '../core/util.js';

export var VIDEO_EXT = ['mp4', 'm4v', 'mkv', 'webm', 'mov', 'avi', 'wmv', 'flv', 'f4v', 'ts', 'm2ts', 'mts', 'mpg', 'mpeg', 'm2v', '3gp', 'ogv', 'divx', 'm3u8', 'vob', 'rmvb'];
export var SUB_EXT = ['srt', 'vtt', 'ass', 'ssa'];
/* Formats qu'aucun navigateur ne lit directement (bascule vers un lecteur compatible). */
export var HARD_EXT = ['avi', 'wmv', 'flv', 'f4v', 'mpg', 'mpeg', 'm2v', 'ts', 'm2ts', 'mts', 'divx', 'vob', 'rmvb', '3gp'];

export function isVideo(name, mime) {
  if (mime && /^video\//.test(mime)) return true;
  return VIDEO_EXT.indexOf(ext(name)) !== -1;
}
export function isSub(name) { return SUB_EXT.indexOf(ext(name)) !== -1; }

var JUNK = /(^|[^a-z])(sample|trailer|bande[ ._-]?annonce|teaser|featurette|behind[ ._-]the[ ._-]scenes|making[ ._-]of|rarbg|etrg)([^a-z]|$)/i;
export function isJunk(name, size) {
  if (JUNK.test(name)) return true;
  if (size && size < 500 * 1024 && !/\.m3u8$/i.test(name)) return true; // < 500 Ko : fichier vide ou cassé
  return false;
}

/* ---------- Catégories déduites des dossiers ---------- */
var CATS = [
  ['anime', /^(animes?|anim(e|es)|animation japonaise|japanimation|manga|mangas|anime series|anime movies|animes vf|animes vostfr)$/],
  ['film', /^(films?|movies?|cinema|longs? metrages?|films vf|films vostfr|mes films)$/],
  ['serie', /^(series?|series tv|tv|tv shows?|shows?|feuilletons?|mes series)$/],
  ['autre', /^(documentaires?|docs?|documentary|documentaries|videos?|clips?|concerts?|spectacles?|perso|personnel|famille|autres?|divers|cours|formations?)$/]
];
export function categoryOf(path) {
  var cat = null, depth = -1, anime = false, animeDepth = -1, kindHint = null;
  for (var i = path.length - 1; i >= 0; i--) {
    var n = norm(path[i]);
    for (var c = 0; c < CATS.length; c++) {
      if (CATS[c][1].test(n)) {
        if (CATS[c][0] === 'anime') { if (!anime) { anime = true; animeDepth = i; } }
        else if (!kindHint && (CATS[c][0] === 'film' || CATS[c][0] === 'serie')) kindHint = CATS[c][0];
        if (cat === null) { cat = CATS[c][0]; depth = i; }
      }
    }
  }
  if (anime) return { cat: 'anime', depth: Math.max(animeDepth, depth), kindHint: kindHint };
  return { cat: cat, depth: depth, kindHint: kindHint };
}

var SEASON_DIR = /^(saison|season|series|serie|s|stagione|temporada|staffel)\s*0*(\d{1,3})\b/i;
var SPECIAL_DIR = /^(specials?|speciaux|spéciaux|extras?|bonus|oav|ova|ovas|oavs)$/i;
export function seasonFromFolder(name) {
  var s = String(name || '').replace(/[._]/g, ' ').trim();
  var m = SEASON_DIR.exec(s);
  if (m) return +m[2];
  if (SPECIAL_DIR.test(norm(s))) return 0;
  return null;
}
export function isSeasonFolder(name) { return seasonFromFolder(name) !== null; }

/* ---------- Étiquettes techniques ---------- */
var TAG = /(^|\s)(2160p|1440p|1080[pi]|720p|576p|480p|360p|4k|uhd|fhd|hd|x26[45]|h ?26[45]|hevc|avc|av1|xvid|divx|10 ?bits?|8 ?bits?|hdr10?(\+|plus)?|hdr|dv|dovi|dolby ?vision|sdr|blu ?ray|bluray|bdrip|brrip|bdremux|bd|web ?dl|webdl|webrip|web|hdtv|hdrip|dvdrip|dvd|dvdscr|remux|aac(2 ?0|5 ?1)?|ac3|eac3|ddp?(5 ?1|2 ?0|7 ?1)?|dts(-?hd)?|truehd|atmos|flac|opus|mp3|5 ?1|7 ?1|2 ?0|proper|repack|internal|limited|extended|unrated|uncut|remastered|imax|hdlight|4klight|light|vostfr|vostf|subfrench|truefrench|french|vff|vfq|vfi|vf2|vf|multi|nf|amzn|dsnp|hmax|atvp|crunchyroll|cr|adn|wakanim|1080|720|2160)(?=\s|$)/i;

function quality(s) {
  if (/\b(2160p|4k|uhd)\b/i.test(s)) return '4K';
  if (/\b1080[pi]\b|\bfhd\b/i.test(s)) return '1080p';
  if (/\b720p\b/i.test(s)) return '720p';
  if (/\b(576p|480p|360p)\b/i.test(s)) return 'SD';
  return '';
}
function langs(s) {
  var out = [];
  if (/\bmulti\b/i.test(s)) out.push('MULTI');
  if (/\b(truefrench|vff|vfq|vfi|vf2|vf|french)\b/i.test(s) && !/\bsub ?french\b/i.test(s)) out.push('VF');
  if (/\b(vostfr|vostf|subfrench)\b/i.test(s)) out.push('VOSTFR');
  return out;
}

function yearLike(n) { n = +n; return n >= 1900 && n <= 2099; }

function cleanup(t) {
  return t.replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, ' ')
    .replace(/[\(\)\[\]\{\}]/g, ' ')
    .replace(/\s+[-–—:,;+~]+\s*$/, '')
    .replace(/^\s*[-–—:,;+~]+\s+/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/* Renvoie { title, year, season, episode, episodeEnd, epTitle, absolute, quality, langs, group } */
export function parseName(name) {
  var original = String(name || '');
  var base = stripExt(original);
  var r = { title: '', year: null, season: null, episode: null, episodeEnd: null, epTitle: '', absolute: false, quality: quality(base), langs: langs(base), group: '' };

  var s = base;
  var g = /^\s*\[([^\]]+)\]\s*/.exec(s);
  if (g) { r.group = g[1]; s = s.slice(g[0].length); }
  s = s.replace(/\[[0-9a-f]{8}\]/gi, ' ');
  // Points et soulignés deviennent des espaces, sauf dans un nombre décimal (5.1, 2.0).
  s = ' ' + s.replace(/(\d)\.(\d)(?!\d)/g, '$1 $2').replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ';

  var cut = s.length, endAt = -1, m;

  var EP = [
    /\sS(\d{1,2})\s?E(\d{1,4})(?:\s?-?\s?E?(\d{1,4}))?(?=\s|$|[^0-9a-z])/i,
    /\s(\d{1,2})x(\d{2,3})(?=\s|$)/i,
    /\s(?:saison|season)\s?(\d{1,2})\s?(?:-\s?)?(?:e|ep|episode|épisode)\s?(\d{1,4})(?=\s|$)/i
  ];
  for (var i = 0; i < EP.length && r.episode === null; i++) {
    m = EP[i].exec(s);
    if (m) {
      r.season = +m[1]; r.episode = +m[2];
      if (m[3] && +m[3] > r.episode && +m[3] - r.episode < 4) r.episodeEnd = +m[3];
      cut = Math.min(cut, m.index); endAt = m.index + m[0].length;
    }
  }
  var leading = false;
  if (r.episode === null) {
    var EPA = [
      /\s(?:episode|épisode|ep|e)\s?(\d{1,4})(?:v\d)?(?=\s|$)/i,
      /\s-\s(\d{1,4})(?:v\d)?(?=\s|$)/,
      /\s#(\d{1,4})(?=\s|$)/,
      /^\s(\d{1,4})(?:v\d)?(?=\s[-–]\s|\s\S|\s?$)/
    ];
    for (var j = 0; j < EPA.length && r.episode === null; j++) {
      m = EPA[j].exec(s);
      if (m && !(yearLike(m[1]) && m[1].length === 4)) {
        r.episode = +m[1]; r.absolute = true;
        if (m.index === 0) { leading = true; s = ' ' + s.slice(m[0].length); endAt = 0; cut = 0; }
        else { cut = Math.min(cut, m.index); endAt = m.index + m[0].length; }
      }
    }
  }

  // Année : on préfère (1999) ou [1999] ; sinon la dernière année isolée avant les étiquettes techniques.
  // Jamais en tout début de titre (« 1917 », « 2001 l'Odyssée de l'espace »).
  var t = TAG.exec(s);
  var tagAt = t && t.index > 0 && s.slice(0, t.index).trim() ? t.index : s.length;
  var re = /([\s\(\[])(19\d{2}|20\d{2})(?=[\s\)\]]|$)/g, paren = null, bare = null;
  while ((m = re.exec(s))) {
    if (s.slice(0, m.index).trim() === '') continue;
    if (m[1] !== ' ') { if (!paren) paren = { y: +m[2], at: m.index }; }
    else if (m.index <= tagAt) bare = { y: +m[2], at: m.index };
  }
  var yr = paren || bare;
  if (yr) {
    r.year = yr.y;
    if (!leading && (r.episode === null || yr.at < cut)) cut = Math.min(cut, yr.at);
  }
  if (!leading && tagAt < s.length) cut = Math.min(cut, tagAt);

  r.title = leading ? '' : cleanup(s.slice(0, cut));

  if (endAt >= 0) {
    var rest = s.slice(endAt);
    var t2 = TAG.exec(rest), y2 = /[\s\(\[](19\d{2}|20\d{2})(?=[\s\)\]]|$)/.exec(rest);
    var stop = rest.length;
    if (t2) stop = Math.min(stop, t2.index);
    if (y2) stop = Math.min(stop, y2.index);
    var et = cleanup(rest.slice(0, stop));
    if (et && et.length > 1 && !/^\d+$/.test(et)) r.epTitle = et;
  }
  return r;
}

/* Un nom de fichier générique (« film.mkv », « VTS_01_1 », « video ») : on préfère le nom du dossier. */
export function isGenericName(title) {
  var n = norm(title);
  return !n || n.length < 2 || /^(film|movie|video|vid|main|feature|vts \d+ \d+|disc \d+|cd ?\d|part ?\d|title ?\d+|[a-f0-9]{8,})$/.test(n);
}

export function prettyTitle(t) {
  t = String(t || '').trim();
  if (!t) return 'Sans titre';
  // Tout en minuscules ou tout en majuscules : capitalisation simple.
  if (t === t.toLowerCase() || (t === t.toUpperCase() && /[A-Z]{4}/.test(t))) {
    t = t.toLowerCase().replace(/(^|\s|-)([a-zà-ÿ])/g, function (_, a, b) { return a + b.toUpperCase(); });
  }
  return t;
}

/* Langue d'un sous-titre d'après son nom. */
export function subLang(name, videoBase) {
  var b = stripExt(name).toLowerCase();
  if (videoBase) b = b.replace(stripExt(videoBase).toLowerCase(), '');
  if (/(^|[^a-z])(fr|fre|fra|french|francais|français|vf|vostfr)([^a-z]|$)/.test(b)) return { lang: 'fr', label: 'Français' };
  if (/(^|[^a-z])(en|eng|english|anglais)([^a-z]|$)/.test(b)) return { lang: 'en', label: 'Anglais' };
  if (/(^|[^a-z])(es|spa|spanish|espanol|español)([^a-z]|$)/.test(b)) return { lang: 'es', label: 'Espagnol' };
  if (/(^|[^a-z])(de|ger|deu|german|allemand)([^a-z]|$)/.test(b)) return { lang: 'de', label: 'Allemand' };
  if (/(^|[^a-z])(it|ita|italian|italien)([^a-z]|$)/.test(b)) return { lang: 'it', label: 'Italien' };
  if (/(^|[^a-z])(ja|jpn|japanese|japonais)([^a-z]|$)/.test(b)) return { lang: 'ja', label: 'Japonais' };
  if (/(^|[^a-z])(ar|ara|arabic|arabe)([^a-z]|$)/.test(b)) return { lang: 'ar', label: 'Arabe' };
  return { lang: '', label: 'Sous-titres' };
}
