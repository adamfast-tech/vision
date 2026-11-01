/* OneDrive (personnel ou professionnel) via Microsoft Graph : connexion OAuth PKCE avec l'ID client de ton appli.
   Dossier : un chemin de ton OneDrive (/Vidéos) ou un lien de partage de dossier.
   Lecture : lien de téléchargement temporaire fourni par Graph, lu directement par la balise vidéo. */
import { authorize, tokenRequest } from './oauth.js';
import { pool, b64url } from '../core/util.js';
import { isVideo, isSub, isJunk } from '../library/parse.js';
import { attachSubs } from './gdrive.js';
import { patchSource } from '../core/store.js';

var GRAPH = 'https://graph.microsoft.com/v1.0';
var AUTH = 'https://login.microsoftonline.com/common/oauth2/v2.0';
var SCOPE = 'Files.Read Files.Read.All offline_access';
var SELECT = 'id,name,size,file,folder,remoteItem,lastModifiedDateTime,webUrl,video,parentReference';
var tokens = {};

export var LOGIN_LABEL = 'Se connecter à Microsoft';

export function needsAuth(src) { return !((src.onedrive || {}).refresh); }

export function signIn(src, popup) {
  var o = src.onedrive || (src.onedrive = {});
  if (!o.clientId) { if (popup) popup.close(); return Promise.reject(new Error('Colle l’ID client (Application ID) de ton appli Microsoft.')); }
  return authorize({ popup: popup, authUrl: AUTH + '/authorize', params: { client_id: o.clientId, scope: SCOPE, response_mode: 'query', prompt: 'select_account' } })
    .then(function (r) {
      return tokenRequest(AUTH + '/token', { client_id: o.clientId, scope: SCOPE, code: r.code, redirect_uri: r.redirect, grant_type: 'authorization_code', code_verifier: r.verifier });
    })
    .then(function (b) { keep(src, b); return true; });
}

function keep(src, b) {
  var o = src.onedrive || (src.onedrive = {});
  tokens[src.id] = { t: b.access_token, exp: Date.now() + (b.expires_in || 3600) * 1000 };
  if (b.refresh_token) {
    o.refresh = b.refresh_token; // Microsoft renouvelle le jeton à chaque usage : on garde le dernier.
    if (src.id) patchSource(src.id, { onedrive: o, error: '' });
  }
}

function access(src) {
  var t = tokens[src.id];
  if (t && t.exp > Date.now() + 60000) return Promise.resolve(t.t);
  var o = src.onedrive || {};
  if (!o.refresh) { var e = new Error('Connexion Microsoft requise pour « ' + src.name + ' » (Mes stockages › Se connecter).'); e.code = 'AUTH'; return Promise.reject(e); }
  return tokenRequest(AUTH + '/token', { client_id: o.clientId, scope: SCOPE, refresh_token: o.refresh, grant_type: 'refresh_token' }).then(function (b) {
    keep(src, b);
    return b.access_token;
  }, function () {
    o.refresh = '';
    if (src.id) patchSource(src.id, { onedrive: o });
    var e = new Error('Connexion Microsoft expirée (elle dure 24 h sans usage) : reconnecte-toi dans Mes stockages.');
    e.code = 'AUTH';
    throw e;
  });
}

function explain(status, body) {
  var code = '', msg = '';
  try { code = body.error.code || ''; msg = body.error.message || ''; } catch (e) { /* ignoré */ }
  if (status === 404 || /itemNotFound/.test(code)) return 'Dossier OneDrive introuvable : vérifie le chemin (exemple : /Vidéos) ou le lien de partage.';
  if (status === 403 || /accessDenied/.test(code)) return 'Accès refusé par OneDrive : vérifie le partage du dossier et les permissions de l’appli (Files.Read).';
  if (status === 429) return 'Trop de requêtes vers OneDrive : réessaie dans une minute.';
  return 'OneDrive a répondu ' + status + (msg ? ' : ' + msg : '.');
}

function get(src, url, retried) {
  return access(src).then(function (tok) {
    return fetch(/^https:/.test(url) ? url : GRAPH + url, { headers: { Authorization: 'Bearer ' + tok } });
  }).then(function (r) {
    if (r.status === 401 && !retried) { delete tokens[src.id]; return get(src, url, true); }
    return r.json().catch(function () { return {}; }).then(function (b) {
      if (!r.ok) throw new Error(explain(r.status, b));
      return b;
    });
  });
}

/* Dossier de départ : chemin, lien de partage ou racine. */
function rootRef(src) {
  var f = String((src.onedrive || {}).folder || '').trim();
  var url;
  if (/^https?:\/\//i.test(f)) url = '/shares/u!' + b64url(new TextEncoder().encode(f)) + '/driveItem';
  else {
    var p = f.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    url = p ? '/me/drive/root:/' + p.split('/').map(encodeURIComponent).join('/') : '/me/drive/root';
  }
  return get(src, url + (url.indexOf('?') === -1 ? '?' : '&') + '$select=' + SELECT).then(function (it) {
    if (it.remoteItem) return { drive: (it.remoteItem.parentReference || {}).driveId, id: it.remoteItem.id };
    var drive = (it.parentReference || {}).driveId;
    if (drive) return { drive: drive, id: it.id };
    return get(src, '/me/drive?$select=id').then(function (d) { return { drive: d.id, id: it.id }; });
  });
}

export function scan(src, ctx) {
  var items = [], subs = [], seen = {}, folders = 0;
  function list(folder) {
    var all = [];
    function page(url) {
      return get(src, url).then(function (b) {
        all = all.concat(b.value || []);
        return b['@odata.nextLink'] ? page(b['@odata.nextLink']) : all;
      });
    }
    return page('/drives/' + encodeURIComponent(folder.drive) + '/items/' + encodeURIComponent(folder.id) + '/children?$top=999&$select=' + SELECT);
  }
  function walk(level) {
    var next = [];
    return pool(level, 4, function (folder) {
      return list(folder).then(function (children) {
        folders++;
        children.forEach(function (f) {
          var r = f.remoteItem;
          if (f.folder || (r && r.folder)) {
            var ref = r ? { drive: (r.parentReference || {}).driveId, id: r.id } : { drive: folder.drive, id: f.id };
            if (ref.drive && !seen[ref.id] && folder.path.length < 12) { seen[ref.id] = 1; next.push({ drive: ref.drive, id: ref.id, path: folder.path.concat(f.name) }); }
            return;
          }
          if (!f.file) return;
          var drive = (f.parentReference || {}).driveId || folder.drive;
          if (isVideo(f.name, f.file.mimeType) && !isJunk(f.name, f.size || 0)) {
            var v = f.video || {};
            items.push({
              id: src.id + ':' + f.id, src: src.id, fid: f.id, drive: drive, name: f.name, path: folder.path,
              size: f.size || 0, mtime: Date.parse(f.lastModifiedDateTime || '') || 0,
              dur: v.duration ? Math.round(v.duration / 1000) : 0, w: v.width || 0, h: v.height || 0,
              web: f.webUrl || '', thumb: ''
            });
          } else if (isSub(f.name)) {
            subs.push({ fid: f.id, drive: drive, name: f.name, path: folder.path.join('/') });
          }
        });
        if (ctx && ctx.progress) ctx.progress({ found: items.length, folders: folders });
      });
    }).then(function (res) {
      var err = res.filter(function (x) { return x instanceof Error; })[0];
      if (err && !items.length && !next.length) throw err;
      return next.length ? walk(next) : null;
    });
  }
  return rootRef(src).then(function (root) {
    seen[root.id] = 1;
    return walk([{ drive: root.drive, id: root.id, path: [] }]);
  }).then(function () {
    attachSubs(items, subs);
    items.forEach(function (it) { (it.subs || []).forEach(function (s) { s.drive = it.drive; }); });
    return items;
  });
}

export function resolve(src, item) {
  return get(src, '/drives/' + encodeURIComponent(item.drive) + '/items/' + encodeURIComponent(item.fid)).then(function (b) {
    var u = b['@microsoft.graph.downloadUrl'];
    if (!u) throw new Error('OneDrive n’a pas fourni de lien de lecture pour ce fichier.');
    return u;
  });
}

export function candidates(src, item) {
  return [
    { kind: 'native', via: 'direct', url: '', resolve: function () { return resolve(src, item); } },
    item.web ? { kind: 'external', url: item.web, label: 'Ouvrir dans OneDrive' } : null
  ];
}

export function fetchSub(src, sub, item) {
  return resolve(src, { fid: sub.fid, drive: sub.drive || (item && item.drive) }).then(function (u) { return fetch(u); }).then(function (r) {
    if (!r.ok) throw new Error('Sous-titres OneDrive indisponibles.');
    return r.arrayBuffer();
  });
}

export function test(src) {
  if (!(src.onedrive || {}).clientId) return Promise.reject(new Error('Colle l’ID client (Application ID) de ton appli Microsoft.'));
  return rootRef(src);
}
