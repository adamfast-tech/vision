/* Google Drive : lien de dossier partagé + clé API (recommandé, marche partout, TV comprise)
   ou connexion Google (dossier privé, lecture via le service worker qui ajoute le jeton). */
import { pool, loadScript } from '../core/util.js';
import * as idb from '../core/idb.js';
import { isVideo, isSub, isJunk } from '../library/parse.js';

export var API = 'https://www.googleapis.com/drive/v3';
var FOLDER = 'application/vnd.google-apps.folder';
var SHORTCUT = 'application/vnd.google-apps.shortcut';
var FIELDS = 'nextPageToken,files(id,name,mimeType,size,modifiedTime,createdTime,hasThumbnail,videoMediaMetadata(width,height,durationMillis),shortcutDetails(targetId,targetMimeType,targetResourceKey),resourceKey)';

/* Accepte un lien de dossier, un lien de fichier ou un identifiant brut. */
export function parseDriveLink(input) {
  var s = String(input || '').trim();
  if (!s) return null;
  var rk = (/[?&]resourcekey=([\w-]+)/i.exec(s) || [])[1] || '';
  var m = /\/folders\/([\w-]{10,})/.exec(s) || /[?&]id=([\w-]{10,})/.exec(s) || /\/file\/d\/([\w-]{10,})/.exec(s) || /\/d\/([\w-]{10,})/.exec(s);
  if (m) return { id: m[1], resourceKey: rk, file: /\/file\/d\//.test(s) };
  if (/^[\w-]{10,}$/.test(s)) return { id: s, resourceKey: '', file: false };
  return null;
}

function explain(status, body) {
  var reason = '';
  try { reason = (body.error.errors[0] || {}).reason || body.error.status || ''; } catch (e) { reason = ''; }
  var msg = '';
  try { msg = body.error.message || ''; } catch (e) { msg = ''; }
  if (status === 400 && /API key not valid|keyInvalid/i.test(msg + reason)) return 'Clé API refusée : vérifie qu’elle est copiée en entier.';
  if (status === 403 && /accessNotConfigured|SERVICE_DISABLED|has not been used|is disabled/i.test(msg + reason)) return 'Google Drive API n’est pas activée dans ton projet Google Cloud (Bibliothèque › Google Drive API › Activer).';
  if (status === 403 && /referer|Referrer|API_KEY_HTTP_REFERRER_BLOCKED|blocked/i.test(msg + reason)) return 'La clé API refuse ce site : ajoute ' + location.origin + '/* dans ses restrictions « Sites Web ».';
  if (status === 403 && /downloadQuotaExceeded/i.test(reason)) return 'Quota de téléchargement Google dépassé pour ce fichier. Réessaie plus tard.';
  if (status === 403 && /rateLimit|userRateLimit/i.test(reason)) return 'Trop de requêtes vers Google : réessaie dans une minute.';
  if (status === 401) return 'Connexion Google expirée : reconnecte-toi.';
  if (status === 404) return 'Dossier introuvable : vérifie le lien et que le partage est réglé sur « Tous les utilisateurs disposant du lien ».';
  return 'Google Drive a répondu ' + status + (msg ? ' : ' + msg : '.');
}

/* ---------- Connexion Google (mode privé) ---------- */
var tokens = {};
export function tokenValid(srcId) {
  var t = tokens[srcId];
  return !!(t && t.exp > Date.now() + 60000);
}
export function loadToken(srcId) {
  return idb.get('gtoken:' + srcId).then(function (t) { if (t) tokens[srcId] = t; return t; });
}
var gisReady = null;
function loadGis() {
  if (window.google && window.google.accounts && window.google.accounts.oauth2) return Promise.resolve();
  if (!gisReady) gisReady = loadScript('https://accounts.google.com/gsi/client');
  return gisReady;
}
/* Doit être appelé depuis un geste de l'utilisateur (fenêtre de connexion Google). */
export function signIn(src, silent) {
  return loadGis().then(function () {
    return new Promise(function (resolve, reject) {
      var client = window.google.accounts.oauth2.initTokenClient({
        client_id: src.gdrive.clientId,
        scope: 'https://www.googleapis.com/auth/drive.readonly',
        prompt: silent ? '' : undefined,
        callback: function (resp) {
          if (!resp || resp.error || !resp.access_token) return reject(new Error(resp && resp.error_description || resp && resp.error || 'Connexion Google annulée.'));
          var t = { t: resp.access_token, exp: Date.now() + (resp.expires_in || 3600) * 1000 };
          tokens[src.id] = t;
          idb.set('gtoken:' + src.id, t).then(function () { resolve(t); });
        },
        error_callback: function (err) { reject(new Error(err && err.type === 'popup_closed' ? 'Fenêtre de connexion fermée.' : 'Connexion Google impossible (fenêtre bloquée ?).')); }
      });
      client.requestAccessToken(silent ? { prompt: '' } : {});
    });
  });
}

function authParams(src) {
  var g = src.gdrive || {};
  var headers = {}, q = '';
  if (g.mode === 'oauth') {
    var t = tokens[src.id];
    if (!t || t.exp < Date.now()) { var e = new Error('Connexion Google requise pour « ' + src.name + ' ».'); e.code = 'AUTH'; throw e; }
    headers.Authorization = 'Bearer ' + t.t;
  } else {
    q = '&key=' + encodeURIComponent(g.apiKey || '');
  }
  return { headers: headers, q: q };
}

function listFolder(src, folder, onPage) {
  var a = authParams(src), files = [];
  var headers = Object.assign({}, a.headers);
  if (folder.rk) headers['X-Goog-Drive-Resource-Keys'] = folder.id + '/' + folder.rk;
  function page(token) {
    var url = API + '/files?q=' + encodeURIComponent("'" + folder.id + "' in parents and trashed = false") +
      '&fields=' + encodeURIComponent(FIELDS) + '&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true&orderBy=name' +
      (token ? '&pageToken=' + encodeURIComponent(token) : '') + a.q;
    return fetch(url, { headers: headers }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (body) {
        if (!r.ok) { var e = new Error(explain(r.status, body)); e.status = r.status; throw e; }
        files = files.concat(body.files || []);
        if (onPage) onPage(files.length);
        return body.nextPageToken ? page(body.nextPageToken) : files;
      });
    });
  }
  return page('');
}

export function scan(src, ctx) {
  var g = src.gdrive || {};
  var root = parseDriveLink(g.folder);
  if (!root) return Promise.reject(new Error('Lien de dossier Google Drive invalide.'));
  var items = [], subs = [], seen = {}, folders = 0;
  var start = g.mode === 'oauth' && !tokenValid(src.id) ? loadToken(src.id) : Promise.resolve();

  if (root.file) {
    return start.then(function () {
      var a = authParams(src);
      return fetch(API + '/files/' + root.id + '?supportsAllDrives=true&fields=' + encodeURIComponent('id,name,mimeType,size,modifiedTime,hasThumbnail,videoMediaMetadata(width,height,durationMillis),resourceKey') + a.q, { headers: a.headers })
        .then(function (r) { return r.json().then(function (b) { if (!r.ok) throw new Error(explain(r.status, b)); return b; }); })
        .then(function (f) { return [toItem(src, f, [])]; });
    });
  }

  function walk(level) {
    var next = [];
    return pool(level, 4, function (folder) {
      if (ctx && ctx.aborted && ctx.aborted()) return null;
      return listFolder(src, folder).then(function (files) {
        folders++;
        files.forEach(function (f) {
          var mt = f.mimeType, id = f.id, rk = f.resourceKey || '';
          if (mt === SHORTCUT && f.shortcutDetails) {
            mt = f.shortcutDetails.targetMimeType; id = f.shortcutDetails.targetId; rk = f.shortcutDetails.targetResourceKey || '';
          }
          if (mt === FOLDER) {
            if (!seen[id] && folder.path.length < 12) { seen[id] = 1; next.push({ id: id, rk: rk, path: folder.path.concat(f.name) }); }
          } else if (isVideo(f.name, mt) && !isJunk(f.name, +f.size || 0)) {
            var c = Object.assign({}, f, { id: id, resourceKey: rk });
            items.push(toItem(src, c, folder.path));
          } else if (isSub(f.name)) {
            subs.push({ fid: id, name: f.name, path: folder.path.join('/') });
          }
        });
        if (ctx && ctx.progress) ctx.progress({ found: items.length, folders: folders });
      });
    }).then(function (res) {
      var err = res.filter(function (x) { return x instanceof Error; })[0];
      if (err && !items.length) throw err;
      return next.length ? walk(next) : null;
    });
  }

  return start.then(function () {
    seen[root.id] = 1;
    return walk([{ id: root.id, rk: root.resourceKey, path: [] }]);
  }).then(function () {
    attachSubs(items, subs);
    return items;
  });
}

function toItem(src, f, path) {
  var v = f.videoMediaMetadata || {};
  return {
    id: src.id + ':' + f.id,
    src: src.id,
    fid: f.id,
    rk: f.resourceKey || '',
    name: f.name,
    path: path,
    size: +f.size || 0,
    mime: f.mimeType || '',
    mtime: Date.parse(f.modifiedTime || f.createdTime || '') || 0,
    dur: v.durationMillis ? Math.round(v.durationMillis / 1000) : 0,
    w: v.width || 0,
    h: v.height || 0,
    thumb: f.hasThumbnail === false ? '' : 'https://drive.google.com/thumbnail?id=' + f.id + '&sz=w640'
  };
}

/* Sous-titres posés à côté de la vidéo (même dossier, nom qui commence pareil). */
export function attachSubs(items, subs) {
  if (!subs.length) return;
  var byFolder = {};
  subs.forEach(function (s) { (byFolder[s.path] = byFolder[s.path] || []).push(s); });
  items.forEach(function (it) {
    var list = byFolder[(it.path || []).join('/')];
    if (!list) return;
    var base = it.name.replace(/\.[^.]+$/, '').toLowerCase();
    var mine = list.filter(function (s) { return s.name.toLowerCase().indexOf(base) === 0; });
    if (!mine.length && list.length <= 3 && byFolderVideos(items, it) === 1) mine = list;
    if (mine.length) it.subs = mine.map(function (s) { return { fid: s.fid, name: s.name, url: s.url || '' }; });
  });
}
function byFolderVideos(items, it) {
  var k = (it.path || []).join('/'), n = 0;
  items.forEach(function (x) { if ((x.path || []).join('/') === k) n++; });
  return n;
}

/* ---------- Lecture ---------- */
export function streamUrl(src, item) {
  var g = src.gdrive || {};
  if (g.mode === 'oauth') return './__stream/gd/' + encodeURIComponent(src.id) + '/' + encodeURIComponent(item.fid) + '?s=' + (item.size || 0) + '&n=' + encodeURIComponent(item.name);
  return API + '/files/' + item.fid + '?alt=media&supportsAllDrives=true&key=' + encodeURIComponent(g.apiKey || '');
}
export function previewUrl(item) {
  return 'https://drive.google.com/file/d/' + item.fid + '/preview' + (item.rk ? '?resourcekey=' + item.rk : '');
}
export function webUrl(item) {
  return 'https://drive.google.com/file/d/' + item.fid + '/view' + (item.rk ? '?resourcekey=' + item.rk : '');
}
export function fetchText(src, fid) {
  var a = authParams(src);
  return fetch(API + '/files/' + fid + '?alt=media&supportsAllDrives=true' + a.q, { headers: a.headers }).then(function (r) {
    if (!r.ok) throw new Error('Sous-titres indisponibles (' + r.status + ').');
    return r.arrayBuffer();
  });
}

/* Test rapide avant d'ajouter la source. */
export function test(src) {
  var root = parseDriveLink((src.gdrive || {}).folder);
  if (!root) return Promise.reject(new Error('Colle le lien du dossier Google Drive (ou son identifiant).'));
  if (src.gdrive.mode !== 'oauth' && !/^AIza[\w-]{30,}$/.test(src.gdrive.apiKey || '')) return Promise.reject(new Error('La clé API Google commence par « AIza » et fait 39 caractères.'));
  if (src.gdrive.mode === 'oauth' && !/\.apps\.googleusercontent\.com$/.test(src.gdrive.clientId || '')) return Promise.reject(new Error('L’ID client OAuth se termine par « .apps.googleusercontent.com ».'));
  var a;
  try { a = authParams(src); } catch (e) { return Promise.reject(e); }
  var headers = Object.assign({}, a.headers);
  if (root.resourceKey) headers['X-Goog-Drive-Resource-Keys'] = root.id + '/' + root.resourceKey;
  return fetch(API + '/files/' + root.id + '?supportsAllDrives=true&fields=id,name,mimeType' + a.q, { headers: headers })
    .then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { if (!r.ok) throw new Error(explain(r.status, b)); return b; }); });
}
