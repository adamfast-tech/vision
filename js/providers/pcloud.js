/* pCloud : lien public de dossier ou de fichier (sans compte ni clé).
   Liste : API publique showpublink. Lecture : lien de téléchargement temporaire (getpublinkdownload). */
import { isVideo, isSub, isJunk } from '../library/parse.js';
import { attachSubs } from './gdrive.js';
import { patchSource } from '../core/store.js';

var HOSTS = ['api.pcloud.com', 'eapi.pcloud.com']; // États-Unis, Europe

export function parseLink(input) {
  var s = String(input || '').trim();
  var m = /[?&#]code=([\w-]+)/.exec(s);
  if (m) return { code: m[1], eu: /(^|\.)e\.pcloud\.link|eapi\./i.test(s) };
  if (/^[\w-]{20,}$/.test(s)) return { code: s, eu: false };
  return null;
}

function explain(b) {
  var c = b && b.result;
  if (c === 7001 || c === 7002 || c === 7004) return 'Lien pCloud invalide, supprimé ou expiré.';
  if (c === 7005) return 'Ce lien pCloud est protégé par mot de passe : crée un lien sans mot de passe.';
  if (c === 7010 || c === 7011 || c === 7012) return 'Quota de transfert du lien pCloud atteint : réessaie plus tard.';
  return 'pCloud : ' + ((b && b.error) || 'erreur ' + c);
}

function call(host, method, params) {
  return fetch('https://' + host + '/' + method + '?' + new URLSearchParams(params).toString()).then(function (r) {
    return r.json();
  }).then(function (b) {
    if (b.result !== 0) { var e = new Error(explain(b)); e.result = b.result; throw e; }
    return b;
  });
}

/* Essaie le serveur de la bonne région, puis l'autre (comptes européens : eapi). */
function callAny(src, method, params) {
  var p = (src.pcloud || {});
  var link = parseLink(p.url) || {};
  var order = p.host ? [p.host].concat(HOSTS.filter(function (h) { return h !== p.host; })) : (link.eu ? HOSTS.slice().reverse() : HOSTS.slice());
  var firstErr = null;
  function attempt(i) {
    if (i >= order.length) {
      var m = firstErr && firstErr.message || '';
      throw /fetch|network|load failed/i.test(m) ? new Error('pCloud ne répond pas depuis ce navigateur (réseau ou bloqueur).') : firstErr;
    }
    return call(order[i], method, params).then(function (b) {
      if (p.host !== order[i] && src.id) { p.host = order[i]; patchSource(src.id, { pcloud: Object.assign({}, p, { host: order[i] }) }); }
      return { b: b, host: order[i] };
    }, function (e) {
      if (!firstErr || (firstErr.result == null && e.result != null)) firstErr = e;
      if (e.result === 7005 || e.result === 7010) throw e;
      return attempt(i + 1);
    });
  }
  return attempt(0);
}

export function scan(src, ctx) {
  var link = parseLink((src.pcloud || {}).url);
  if (!link) return Promise.reject(new Error('Lien pCloud invalide : il doit contenir « code=… ».'));
  return callAny(src, 'showpublink', { code: link.code }).then(function (res) {
    var items = [], subs = [];
    function walk(node, path) {
      if (node.isfolder) {
        (node.contents || []).forEach(function (c) { walk(c, node === res.b.metadata ? path : path.concat(node.name)); });
        return;
      }
      var name = node.name || '';
      if (isVideo(name, node.contenttype) && !isJunk(name, node.size || 0)) {
        items.push({
          id: src.id + ':' + node.fileid, src: src.id, fid: String(node.fileid), name: name, path: path,
          size: node.size || 0, mtime: Date.parse(node.modified || node.created || '') || 0,
          thumb: node.thumb ? 'https://' + res.host + '/getpubthumb?code=' + encodeURIComponent(link.code) + '&fileid=' + node.fileid + '&size=640x360&crop=0&type=jpg' : ''
        });
      } else if (isSub(name)) {
        subs.push({ fid: String(node.fileid), name: name, path: path.join('/') });
      }
    }
    walk(res.b.metadata || {}, []);
    attachSubs(items, subs);
    if (ctx && ctx.progress) ctx.progress({ found: items.length });
    return items;
  });
}

export function resolve(src, item) {
  var link = parseLink((src.pcloud || {}).url) || {};
  return callAny(src, 'getpublinkdownload', { code: link.code, fileid: item.fid, forcedownload: 0 }).then(function (res) {
    var b = res.b;
    if (!b.hosts || !b.hosts.length) throw new Error('pCloud n’a pas fourni de lien de lecture.');
    return 'https://' + b.hosts[0] + b.path;
  });
}

export function candidates(src, item) {
  return [
    { kind: 'native', via: 'direct', url: '', resolve: function () { return resolve(src, item); } },
    { kind: 'external', url: (src.pcloud || {}).url, label: 'Ouvrir dans pCloud' }
  ];
}

export function fetchSub(src, sub) {
  return resolve(src, { fid: sub.fid }).then(function (u) { return fetch(u); }).then(function (r) {
    if (!r.ok) throw new Error('Sous-titres pCloud indisponibles.');
    return r.arrayBuffer();
  });
}

export function test(src) {
  var link = parseLink((src.pcloud || {}).url);
  if (!link) return Promise.reject(new Error('Colle le lien public pCloud (https://u.pcloud.link/publink/show?code=…).'));
  return callAny(src, 'showpublink', { code: link.code });
}
