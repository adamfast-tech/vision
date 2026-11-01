/* Dropbox : ton propre Dropbox via une connexion (OAuth PKCE, clé d'appli publique, aucun secret).
   Le jeton longue durée reste dans la configuration de la source (il suit l'envoi vers la télé).
   Lecture : lien temporaire Dropbox (4 h) demandé au lancement, lu directement par la balise vidéo. */
import { authorize, tokenRequest } from './oauth.js';
import { isVideo, isSub, isJunk } from '../library/parse.js';
import { attachSubs } from './gdrive.js';
import { patchSource } from '../core/store.js';

var API = 'https://api.dropboxapi.com/2';
var TOKEN = 'https://api.dropboxapi.com/oauth2/token';
var tokens = {};

export var LOGIN_LABEL = 'Se connecter à Dropbox';

export function rootPath(folder) {
  var p = String(folder || '').trim().replace(/\\/g, '/').replace(/\/+$/, '');
  if (!p || p === '/') return '';
  return p[0] === '/' ? p : '/' + p;
}

export function needsAuth(src) { return !((src.dropbox || {}).refresh); }

/* popup : fenêtre ouverte dans le geste de l'utilisateur (oauth.openPopup). */
export function signIn(src, popup) {
  var d = src.dropbox || (src.dropbox = {});
  if (!d.appKey) { if (popup) popup.close(); return Promise.reject(new Error('Colle la clé de ton appli Dropbox (App key).')); }
  return authorize({ popup: popup, authUrl: 'https://www.dropbox.com/oauth2/authorize', params: { client_id: d.appKey, token_access_type: 'offline' } })
    .then(function (r) {
      return tokenRequest(TOKEN, { code: r.code, grant_type: 'authorization_code', code_verifier: r.verifier, client_id: d.appKey, redirect_uri: r.redirect });
    })
    .then(function (b) {
      d.refresh = b.refresh_token || d.refresh || '';
      tokens[src.id] = { t: b.access_token, exp: Date.now() + (b.expires_in || 14400) * 1000 };
      if (src.id) patchSource(src.id, { dropbox: d, error: '' });
      return true;
    });
}

function access(src) {
  var t = tokens[src.id];
  if (t && t.exp > Date.now() + 60000) return Promise.resolve(t.t);
  var d = src.dropbox || {};
  if (!d.refresh) { var e = new Error('Connexion Dropbox requise pour « ' + src.name + ' » (Mes stockages › Se connecter).'); e.code = 'AUTH'; return Promise.reject(e); }
  return tokenRequest(TOKEN, { grant_type: 'refresh_token', refresh_token: d.refresh, client_id: d.appKey }).then(function (b) {
    tokens[src.id] = { t: b.access_token, exp: Date.now() + (b.expires_in || 14400) * 1000 };
    return b.access_token;
  }, function (err) {
    var e = new Error('Connexion Dropbox expirée ou révoquée : reconnecte-toi (Mes stockages).');
    e.code = 'AUTH';
    throw e;
  });
}

function explain(status, body) {
  var s = (body && (body.error_summary || (typeof body.error === 'string' ? body.error : ''))) || '';
  if (/not_found/.test(s)) return 'Dossier introuvable dans Dropbox : vérifie le chemin (exemple : /Vidéos). Avec une appli « App folder », laisse le chemin vide.';
  if (/missing_scope/.test(s)) return 'Permissions manquantes : dans l’appli Dropbox, coche files.metadata.read et files.content.read, puis reconnecte-toi.';
  if (status === 429) return 'Trop de requêtes vers Dropbox : réessaie dans une minute.';
  return 'Dropbox a répondu ' + status + (s ? ' : ' + s : '.');
}

function api(src, path, body, retried) {
  return access(src).then(function (tok) {
    return fetch(API + path, { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }).then(function (r) {
    if (r.status === 401 && !retried) { delete tokens[src.id]; return api(src, path, body, true); }
    return r.text().then(function (t) {
      var b = {};
      try { b = JSON.parse(t); } catch (e) { b = { error: t }; }
      if (!r.ok) throw new Error(explain(r.status, b));
      return b;
    });
  });
}

export function scan(src, ctx) {
  var root = rootPath((src.dropbox || {}).folder), rootLow = root.toLowerCase();
  var items = [], subs = [];
  function rel(e) {
    var p = e.path_display || e.path_lower || '';
    var low = (e.path_lower || p).toLowerCase();
    if (rootLow && low.indexOf(rootLow + '/') === 0) p = p.slice(root.length);
    var parts = p.split('/').filter(Boolean);
    return parts.slice(0, -1);
  }
  function take(entries) {
    entries.forEach(function (e) {
      if (e['.tag'] !== 'file') return;
      var path = rel(e);
      if (isVideo(e.name) && !isJunk(e.name, e.size || 0)) {
        items.push({ id: src.id + ':' + e.id, src: src.id, fid: e.id, name: e.name, path: path, size: e.size || 0, mtime: Date.parse(e.client_modified || e.server_modified || '') || 0, thumb: '', web: 'https://www.dropbox.com/home' + encodeURI((e.path_display || '').replace(/\/[^/]*$/, '')) });
      } else if (isSub(e.name)) {
        subs.push({ fid: e.id, name: e.name, path: path.join('/') });
      }
    });
    if (ctx && ctx.progress) ctx.progress({ found: items.length });
  }
  function more(b) {
    take(b.entries || []);
    return b.has_more ? api(src, '/files/list_folder/continue', { cursor: b.cursor }).then(more) : null;
  }
  return api(src, '/files/list_folder', { path: root, recursive: true, limit: 2000, include_non_downloadable_files: false })
    .then(more)
    .then(function () { attachSubs(items, subs); return items; });
}

export function resolve(src, item) {
  return api(src, '/files/get_temporary_link', { path: item.fid }).then(function (b) { return b.link; });
}

export function candidates(src, item) {
  return [
    { kind: 'native', via: 'direct', url: '', resolve: function () { return resolve(src, item); } },
    item.web ? { kind: 'external', url: item.web, label: 'Ouvrir dans Dropbox' } : null
  ];
}

export function fetchSub(src, sub) {
  return resolve(src, { fid: sub.fid }).then(function (u) { return fetch(u); }).then(function (r) {
    if (!r.ok) throw new Error('Sous-titres Dropbox indisponibles.');
    return r.arrayBuffer();
  });
}

export function test(src) {
  if (!(src.dropbox || {}).appKey) return Promise.reject(new Error('Colle la clé de ton appli Dropbox (App key).'));
  return api(src, '/files/list_folder', { path: rootPath(src.dropbox.folder), limit: 1 });
}
