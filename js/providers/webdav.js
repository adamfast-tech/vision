/* WebDAV : Nextcloud, ownCloud, Synology, QNAP, kDrive, Koofr, rclone serve webdav…
   Un lien de partage Nextcloud/ownCloud (…/s/JETON) est converti automatiquement.
   Avec identifiant : la lecture passe par le service worker, qui ajoute l'authentification (la balise vidéo ne le peut pas).
   Le serveur doit autoriser ce site (CORS) pour PROPFIND, GET et les en-têtes Authorization, Depth et Range. */
import { pool, hash } from '../core/util.js';
import * as idb from '../core/idb.js';
import { isVideo, isSub, isJunk } from '../library/parse.js';
import { attachSubs } from './gdrive.js';

var BODY = '<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:getcontentlength/><d:getlastmodified/><d:getcontenttype/></d:prop></d:propfind>';

/* Adresse, identifiant et mot de passe effectifs (partage Nextcloud converti). */
export function conf(src) {
  var w = src.webdav || {};
  var url = String(w.url || '').trim(), user = w.user || '', pass = w.pass || '';
  var share = /^(https?:\/\/.+?)\/(?:index\.php\/)?s\/([\w-]{6,})\/?(?:[?#].*)?$/i.exec(url);
  if (share) { url = share[1] + '/public.php/webdav/'; user = share[2]; }
  if (url && !/\/$/.test(url)) url += '/';
  return { url: url, user: user, pass: pass };
}

function authHeader(c) {
  if (!c.user && !c.pass) return null;
  var bytes = new TextEncoder().encode(c.user + ':' + c.pass), bin = '';
  for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return 'Basic ' + btoa(bin);
}

/* Le service worker lit l'identifiant ici pour relayer la lecture. */
export function register(src) {
  var c = conf(src);
  return idb.set('dav:' + src.id, { base: c.url, auth: authHeader(c) });
}

function explain(status) {
  if (status === 401) return 'Identifiant ou mot de passe WebDAV refusé (Nextcloud : utilise un mot de passe d’application).';
  if (status === 403) return 'Accès WebDAV refusé (403).';
  if (status === 404) return 'Dossier WebDAV introuvable : vérifie l’adresse.';
  if (status === 405) return 'Ce serveur ne parle pas WebDAV à cette adresse (405).';
  return 'Le serveur WebDAV a répondu ' + status + '.';
}

function propfind(c, url) {
  var headers = { Depth: '1', 'Content-Type': 'application/xml; charset=utf-8' };
  var a = authHeader(c);
  if (a) headers.Authorization = a;
  return fetch(url, { method: 'PROPFIND', headers: headers, body: BODY }).then(function (r) {
    if (r.status !== 207 && !r.ok) throw new Error(explain(r.status));
    return r.text();
  }, function () {
    throw new Error('Serveur WebDAV injoignable depuis ce site : HTTPS et CORS requis (origine ' + location.origin + ', méthodes PROPFIND et GET, en-têtes Authorization, Depth, Range).');
  }).then(function (t) { return parse(t, url); });
}

function tag(el, name) {
  var n = el.getElementsByTagNameNS('DAV:', name);
  return n.length ? n[0] : null;
}

export function parse(xml, url) {
  var doc = new DOMParser().parseFromString(xml, 'application/xml');
  var self = decodeURIComponent(new URL(url).pathname).replace(/\/$/, '');
  var out = [];
  Array.prototype.forEach.call(doc.getElementsByTagNameNS('DAV:', 'response'), function (r) {
    var h = tag(r, 'href');
    if (!h) return;
    var abs;
    try { abs = new URL(h.textContent.trim(), url); } catch (e) { return; }
    var path = decodeURIComponent(abs.pathname).replace(/\/$/, '');
    if (path === self) return;
    var rt = tag(r, 'resourcetype');
    var dir = !!(rt && tag(rt, 'collection'));
    var name = path.split('/').pop();
    var len = tag(r, 'getcontentlength'), mod = tag(r, 'getlastmodified'), ct = tag(r, 'getcontenttype');
    out.push({ href: abs.href, name: name, dir: dir, size: len ? +len.textContent || 0 : 0, mtime: mod ? Date.parse(mod.textContent) || 0 : 0, type: ct ? ct.textContent : '' });
  });
  return out;
}

export function scan(src, ctx) {
  var c = conf(src);
  if (!/^https?:\/\//i.test(c.url)) return Promise.reject(new Error('Adresse WebDAV invalide : elle doit commencer par https://'));
  if (location.protocol === 'https:' && /^http:/i.test(c.url)) return Promise.reject(new Error('Ce site est en HTTPS : le navigateur bloque un serveur WebDAV en HTTP.'));
  var items = [], subs = [], seen = {}, folders = 0;
  function walk(level) {
    var next = [];
    return pool(level, 3, function (dir) {
      return propfind(c, dir.url).then(function (entries) {
        folders++;
        entries.forEach(function (e) {
          if (e.dir) {
            var u = /\/$/.test(e.href) ? e.href : e.href + '/';
            if (!seen[u] && dir.path.length < 10) { seen[u] = 1; next.push({ url: u, path: dir.path.concat(e.name) }); }
          } else if (isVideo(e.name, e.type) && !isJunk(e.name, e.size)) {
            items.push({ id: src.id + ':' + hash(e.href), src: src.id, fid: hash(e.href), url: e.href, name: e.name, path: dir.path, size: e.size, mtime: e.mtime, thumb: '' });
          } else if (isSub(e.name)) {
            subs.push({ fid: hash(e.href), url: e.href, name: e.name, path: dir.path.join('/') });
          }
        });
        if (ctx && ctx.progress) ctx.progress({ found: items.length, folders: folders });
      });
    }).then(function (res) {
      var err = res.filter(function (x) { return x instanceof Error; })[0];
      if (err && !items.length && !next.length) throw err;
      return next.length && items.length < 50000 ? walk(next) : null;
    });
  }
  seen[c.url] = 1;
  return register(src).then(function () { return walk([{ url: c.url, path: [] }]); }).then(function () { attachSubs(items, subs); return items; });
}

export function streamUrl(src, item) {
  return './__stream/dav/' + encodeURIComponent(src.id) + '/' + encodeURIComponent(item.fid) + '?s=' + (item.size || 0) + '&n=' + encodeURIComponent(item.name) + '&u=' + encodeURIComponent(item.url);
}

export function candidates(src, item, env) {
  var c = conf(src);
  if (!authHeader(c)) return [{ kind: 'native', via: 'direct', url: item.url }, { kind: 'external', url: item.url, label: 'Ouvrir le fichier' }];
  return [env.swActive ? { kind: 'native', via: 'sw', url: streamUrl(src, item) } : null, { kind: 'external', url: item.url, label: 'Ouvrir le fichier' }];
}

export function fetchSub(src, sub) {
  var a = authHeader(conf(src));
  return fetch(sub.url, a ? { headers: { Authorization: a } } : {}).then(function (r) {
    if (!r.ok) throw new Error('Sous-titres indisponibles (' + r.status + ').');
    return r.arrayBuffer();
  });
}

export function test(src) {
  var c = conf(src);
  if (!/^https?:\/\//i.test(c.url)) return Promise.reject(new Error('Adresse WebDAV invalide : elle doit commencer par https://'));
  return propfind(c, c.url);
}
