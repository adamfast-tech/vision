/* Serveur HTTP(S) avec liste de fichiers : NAS, rclone serve http, Nginx/Apache autoindex, Caddy browse…
   Le serveur doit répondre en HTTPS et autoriser ce site (CORS). */
import { pool, hash } from '../core/util.js';
import { isVideo, isSub, isJunk } from '../library/parse.js';
import { attachSubs } from './gdrive.js';

export function normBase(u) {
  var s = String(u || '').trim();
  if (!/^https?:\/\//i.test(s)) return '';
  return /\/$/.test(s) ? s : s + '/';
}

function entriesFrom(text, url, type) {
  var out = [];
  if (/json/.test(type) || /^\s*[\[{]/.test(text)) {
    try {
      var j = JSON.parse(text);
      var arr = Array.isArray(j) ? j : (j.items || j.files || j.entries || j.children || []);
      arr.forEach(function (e) {
        var name = e.name || e.Name || e.path || '';
        if (!name) return;
        var dir = e.type === 'directory' || e.is_dir || e.IsDir || e.isDir || /\/$/.test(name);
        var href = e.url || e.href || encodeURIComponent(name.replace(/\/$/, '')) + (dir ? '/' : '');
        out.push({ href: new URL(href, url).href, name: name.replace(/\/$/, ''), dir: !!dir, size: +(e.size || e.Size || 0), mtime: Date.parse(e.mtime || e.ModTime || e.mod_time || e.modified || '') || 0 });
      });
      return out;
    } catch (e) { /* pas du JSON : on lit le HTML */ }
  }
  var doc = new DOMParser().parseFromString(text, 'text/html');
  Array.prototype.forEach.call(doc.querySelectorAll('a[href]'), function (a) {
    var raw = a.getAttribute('href');
    if (!raw || raw[0] === '?' || raw[0] === '#' || /^(mailto|javascript):/i.test(raw) || raw === '../' || raw === './' || raw === '/') return;
    var abs;
    try { abs = new URL(raw, url).href; } catch (e) { return; }
    if (abs.indexOf(url) !== 0 || abs === url) return;
    var rel = abs.slice(url.length);
    if (/\?/.test(rel)) return;
    var dir = /\/$/.test(rel);
    var name = decodeURIComponent(rel.replace(/\/$/, ''));
    if (name.indexOf('/') !== -1) return;
    out.push({ href: abs, name: name, dir: dir, size: 0, mtime: 0 });
  });
  return out;
}

export function scan(src, ctx) {
  var base = normBase((src.http || {}).url);
  if (!base) return Promise.reject(new Error('Adresse invalide : elle doit commencer par https://'));
  if (location.protocol === 'https:' && /^http:/i.test(base)) return Promise.reject(new Error('Ce site est en HTTPS : le navigateur bloque un serveur en HTTP. Active HTTPS sur ton NAS ou passe par un tunnel (Tailscale, Cloudflare).'));
  var items = [], subs = [], seen = {}, folders = 0;

  function list(dir) {
    return fetch(dir.url, { headers: { Accept: 'application/json, text/html;q=0.9, */*;q=0.5' } }).then(function (r) {
      if (!r.ok) throw new Error('Le serveur a répondu ' + r.status + ' pour ' + dir.url);
      var type = r.headers.get('content-type') || '';
      return r.text().then(function (t) { return entriesFrom(t, dir.url, type); });
    });
  }
  function walk(level) {
    var next = [];
    return pool(level, 3, function (dir) {
      return list(dir).then(function (entries) {
        folders++;
        entries.forEach(function (e) {
          if (e.dir) {
            if (!seen[e.href] && dir.path.length < 10) { seen[e.href] = 1; next.push({ url: e.href, path: dir.path.concat(e.name) }); }
          } else if (isVideo(e.name) && !isJunk(e.name, e.size)) {
            items.push({ id: src.id + ':' + hash(e.href), src: src.id, fid: hash(e.href), url: e.href, name: e.name, path: dir.path, size: e.size, mtime: e.mtime, thumb: '' });
          } else if (isSub(e.name)) {
            subs.push({ fid: hash(e.href), url: e.href, name: e.name, path: dir.path.join('/') });
          }
        });
        if (ctx && ctx.progress) ctx.progress({ found: items.length, folders: folders });
      });
    }).then(function (res) {
      var err = res.filter(function (x) { return x instanceof Error; })[0];
      if (err && !items.length && !next.length) {
        if (/Failed to fetch|NetworkError|Load failed/i.test(err.message)) throw new Error('Serveur injoignable ou CORS non autorisé. Avec rclone : rclone serve http distant: --addr :8080 --allow-origin "' + location.origin + '" (derrière HTTPS).');
        throw err;
      }
      return next.length && items.length < 50000 ? walk(next) : null;
    });
  }
  seen[base] = 1;
  return walk([{ url: base, path: [] }]).then(function () { attachSubs(items, subs); return items; });
}

export function streamUrl(src, item) { return item.url; }
export function fetchText(src, fid, item) {
  var url = item && item.url;
  return fetch(url).then(function (r) { if (!r.ok) throw new Error('Sous-titres indisponibles.'); return r.arrayBuffer(); });
}
export function test(src) {
  var base = normBase((src.http || {}).url);
  if (!base) return Promise.reject(new Error('Adresse invalide : elle doit commencer par https://'));
  return fetch(base, { headers: { Accept: 'application/json, text/html;q=0.9' } }).then(function (r) {
    if (!r.ok) throw new Error('Le serveur a répondu ' + r.status + '.');
    return true;
  }, function () {
    throw new Error('Serveur injoignable depuis ce site (HTTPS et CORS requis). Avec rclone : --allow-origin "' + location.origin + '".');
  });
}
