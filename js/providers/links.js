/* Liens directs : une vidéo par ligne (« Titre | lien »), liste M3U ou fichier JSON.
   Convertit les liens de partage Dropbox, OneDrive, Google Drive et MEGA. */
import { hash, ext } from '../core/util.js';
import { parseDriveLink } from './gdrive.js';
import { parseMegaLink } from './mega.js';

function b64u(s) {
  var bytes = new TextEncoder().encode(s), bin = '';
  for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-');
}

export function convert(url) {
  var u = String(url || '').trim();
  if (/drive\.google\.com|docs\.google\.com/.test(u)) {
    var d = parseDriveLink(u);
    if (d) return { kind: 'gdrive', url: u, fid: d.id, rk: d.resourceKey };
  }
  if (parseMegaLink(u)) return { kind: 'mega', url: u };
  if (/dropbox\.com\//.test(u)) {
    var x = u.replace(/[?&]dl=[01]/, '').replace(/[?&]raw=1/, '');
    return { kind: 'direct', url: x + (x.indexOf('?') === -1 ? '?' : '&') + 'raw=1' };
  }
  if (/1drv\.ms\/|onedrive\.live\.com\//.test(u)) {
    return { kind: 'direct', url: 'https://api.onedrive.com/v1.0/shares/u!' + b64u(u) + '/root/content' };
  }
  if (/\.m3u8(\?|$)/i.test(u)) return { kind: 'hls', url: u };
  return { kind: 'direct', url: u };
}

function nameFromUrl(u) {
  try {
    var p = new URL(u).pathname.split('/').filter(Boolean).pop() || u;
    return decodeURIComponent(p);
  } catch (e) { return u; }
}

/* Analyse le texte saisi : JSON, M3U ou lignes « Titre | lien ». */
export function parse(text) {
  var t = String(text || '').trim(), out = [];
  if (!t) return out;
  if (/^[\[{]/.test(t)) {
    var j = JSON.parse(t);
    var arr = Array.isArray(j) ? j : (j.items || j.videos || []);
    arr.forEach(function (e) {
      if (!e || !(e.url || e.src)) return;
      out.push({ url: e.url || e.src, title: e.title || e.name || '', group: e.group || e.category || e.folder || '', season: e.season, episode: e.episode, show: e.show || e.series || '', year: e.year, poster: e.poster || e.image || '', overview: e.overview || e.description || '' });
    });
    return out;
  }
  var pending = null;
  t.split(/\r?\n/).forEach(function (line) {
    line = line.trim();
    if (!line) return;
    if (/^#EXTM3U/i.test(line)) return;
    var inf = /^#EXTINF:[^,]*?(?:\s+(.*?))?,(.*)$/i.exec(line);
    if (inf) {
      var attrs = inf[1] || '', g = /group-title="([^"]*)"/i.exec(attrs), logo = /tvg-logo="([^"]*)"/i.exec(attrs);
      pending = { title: inf[2].trim(), group: g ? g[1] : '', poster: logo ? logo[1] : '' };
      return;
    }
    if (line[0] === '#') return;
    var parts = line.split(/\s+\|\s+|\t/);
    var url = parts.length > 1 ? parts[parts.length - 1] : parts[0];
    var title = parts.length > 1 ? parts.slice(0, -1).join(' | ') : '';
    if (!/^https?:\/\//i.test(url)) { pending = null; return; }
    var e = { url: url, title: title || (pending && pending.title) || '', group: pending ? pending.group : '', poster: pending ? pending.poster : '' };
    out.push(e);
    pending = null;
  });
  return out;
}

export function scan(src) {
  var list;
  try { list = parse((src.links || {}).text); } catch (e) { return Promise.reject(new Error('Liste illisible : ' + e.message)); }
  if (!list.length) return Promise.reject(new Error('Aucun lien http(s) trouvé.'));
  var items = list.map(function (e) {
    var c = convert(e.url);
    var name = nameFromUrl(e.url);
    var title = e.title || '';
    // Le nom sert à l'analyse (saison, épisode) ; on garde l'extension pour reconnaître le format.
    var fileName = title ? title + (ext(name) ? '.' + ext(name) : '') : name;
    var it = {
      id: src.id + ':' + hash(e.url),
      src: src.id,
      fid: c.fid || hash(e.url),
      rk: c.rk || '',
      name: fileName,
      url: c.url,
      kind: c.kind,
      path: e.group ? [e.group] : [],
      size: 0,
      mtime: Date.now(),
      thumb: e.poster || ''
    };
    if (e.show) it.show = e.show;
    if (e.season != null && e.season !== '') it.season = +e.season;
    if (e.episode != null && e.episode !== '') it.episode = +e.episode;
    if (e.year) it.year = +e.year;
    if (e.overview) it.overview = e.overview;
    return it;
  });
  return Promise.resolve(items);
}

export function test(src) {
  try {
    var n = parse((src.links || {}).text).length;
    return n ? Promise.resolve(n) : Promise.reject(new Error('Aucun lien http(s) reconnu. Une vidéo par ligne : « Titre | https://… ».'));
  } catch (e) { return Promise.reject(new Error('Liste illisible : ' + e.message)); }
}
