/* Vision — service worker.
   1. Hors ligne : l'interface est mise en cache (installable comme une appli).
   2. Lecture : /__stream/… sert les vidéos MEGA (déchiffrées à la volée, par plages) et Google Drive en mode privé
      (ajout du jeton de connexion), pour que la balise <video> puisse avancer et reculer librement. */
var VERSION = 'vision-v5';
var SHELL = [
  './', './index.html', './manifest.webmanifest',
  './css/base.css', './css/app.css', './css/player.css', './css/tv.css',
  './lib/anim.css', './lib/anim-fx.css', './lib/brio.css', './lib/noctis.css',
  './lib/anim.js', './lib/anim-fx.js', './lib/anim-pixi.js', './lib/brio.js', './lib/noctis.js',
  './vendor/anime.umd.min.js', './vendor/qrcode.esm.js', './vendor/mega.umd.js',
  './js/main.js', './js/core/util.js', './js/core/idb.js', './js/core/store.js', './js/core/device.js', './js/core/nav.js', './js/core/router.js', './js/core/pair.js',
  './js/library/parse.js', './js/library/library.js', './js/library/scan.js', './js/library/meta.js',
  './js/providers/index.js', './js/providers/gdrive.js', './js/providers/mega.js', './js/providers/http.js', './js/providers/links.js', './js/providers/demo.js', './js/providers/oauth.js', './js/providers/webdav.js', './js/providers/s3.js', './js/providers/dropbox.js', './js/providers/onedrive.js', './js/providers/pcloud.js',
  './js/ui/components.js', './js/ui/fx.js', './js/ui/overlay.js',
  './js/ui/views/home.js', './js/ui/views/category.js', './js/ui/views/detail.js', './js/ui/views/search.js', './js/ui/views/sources.js', './js/ui/views/settings.js', './js/ui/views/pair.js',
  './js/player/player.js', './js/player/subs.js',
  './assets/fonts/big-shoulders-display-latin-wght-normal.woff2', './assets/fonts/big-shoulders-display-latin-ext-wght-normal.woff2',
  './assets/fonts/atkinson-hyperlegible-next-latin-wght-normal.woff2', './assets/fonts/atkinson-hyperlegible-next-latin-ext-wght-normal.woff2',
  './assets/grain.png', './assets/icons/favicon.svg', './assets/icons/icon-192.png', './assets/icons/icon-512.png', './assets/icons/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return Promise.all(SHELL.map(function (u) { return c.add(new Request(u, { cache: 'reload' })).catch(function () {}); }));
  }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('vision-') === 0 && k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  var i = url.pathname.indexOf('/__stream/');
  if (i !== -1) { e.respondWith(stream(req, url, url.pathname.slice(i + 10))); return; }
  if (req.mode === 'navigate') { e.respondWith(networkFirst(req)); return; }
  e.respondWith(staleWhileRevalidate(req));
});

function networkFirst(req) {
  return fetch(req).then(function (r) {
    if (r && r.ok) { var copy = r.clone(); caches.open(VERSION).then(function (c) { c.put('./index.html', copy); }); }
    return r;
  }).catch(function () {
    return caches.match('./index.html').then(function (r) { return r || caches.match('./'); });
  });
}
function staleWhileRevalidate(req) {
  return caches.open(VERSION).then(function (c) {
    return c.match(req, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(req).then(function (r) {
        if (r && r.ok && r.type === 'basic') c.put(req, r.clone());
        return r;
      }).catch(function () { return hit; });
      return hit || net;
    });
  });
}

/* ---------- Petit accès à IndexedDB (mêmes base et table que l'appli) ---------- */
function idbGet(key) {
  return new Promise(function (resolve) {
    var r;
    try { r = indexedDB.open('vision', 1); } catch (e) { return resolve(undefined); }
    r.onupgradeneeded = function () { if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); };
    r.onsuccess = function () {
      try {
        var g = r.result.transaction('kv', 'readonly').objectStore('kv').get(key);
        g.onsuccess = function () { resolve(g.result); };
        g.onerror = function () { resolve(undefined); };
      } catch (e) { resolve(undefined); }
    };
    r.onerror = function () { resolve(undefined); };
  });
}

/* ---------- Flux vidéo ---------- */
var TYPES = { mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska', ogv: 'video/ogg', ts: 'video/mp2t', avi: 'video/x-msvideo', srt: 'text/plain', vtt: 'text/vtt', ass: 'text/plain', ssa: 'text/plain' };
function mime(name) { var m = /\.([a-z0-9]+)$/i.exec(name || ''); return (m && TYPES[m[1].toLowerCase()]) || 'application/octet-stream'; }
function parseRange(h) {
  var m = /bytes=(\d*)-(\d*)/.exec(h || '');
  if (!m || (m[1] === '' && m[2] === '')) return null;
  if (m[1] === '') return { suffix: +m[2] };
  return { start: +m[1], end: m[2] === '' ? null : +m[2] };
}

function stream(req, url, rest) {
  var parts = rest.split('/');
  var kind = parts[0], src = decodeURIComponent(parts[1] || ''), fid = decodeURIComponent(parts[2] || '');
  var size = +url.searchParams.get('s') || 0, name = url.searchParams.get('n') || '';
  var range = parseRange(req.headers.get('range'));
  if (kind === 'gd') return drive(src, fid, size, name, range);
  if (kind === 'mega' || kind === 'megalink') return megaStream(kind, src, fid, name, range);
  if (kind === 'dav') return dav(req, src, url.searchParams.get('u') || '', name);
  return Promise.resolve(new Response('Flux inconnu', { status: 404 }));
}

/* Google Drive privé : on relaie la plage demandée en ajoutant le jeton, puis on recompose les en-têtes. */
function drive(src, fid, size, name, range) {
  return idbGet('gtoken:' + src).then(function (tok) {
    if (!tok || !tok.t || tok.exp < Date.now()) return new Response('Connexion Google requise', { status: 401 });
    var headers = { Authorization: 'Bearer ' + tok.t };
    var start = 0, end = null;
    if (range) {
      if (range.suffix != null && size) { start = Math.max(0, size - range.suffix); end = size - 1; }
      else { start = range.start || 0; end = range.end; }
      headers.Range = 'bytes=' + start + '-' + (end != null ? end : '');
    }
    return fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(fid) + '?alt=media&supportsAllDrives=true', { headers: headers }).then(function (r) {
      if (r.status === 401) return new Response('Connexion Google expirée', { status: 401 });
      if (!r.ok) return new Response('Google Drive : ' + r.status, { status: r.status });
      var type = r.headers.get('content-type') || mime(name);
      if (r.status === 206 && size) {
        var e2 = end != null ? Math.min(end, size - 1) : size - 1;
        return new Response(r.body, { status: 206, statusText: 'Partial Content', headers: { 'Content-Type': type, 'Content-Range': 'bytes ' + start + '-' + e2 + '/' + size, 'Content-Length': String(e2 - start + 1), 'Accept-Ranges': 'bytes' } });
      }
      var h = { 'Content-Type': type, 'Accept-Ranges': 'bytes' };
      var cl = r.headers.get('content-length') || (size ? String(size) : '');
      if (cl) h['Content-Length'] = cl;
      return new Response(r.body, { status: 200, headers: h });
    });
  }).catch(function (e) { return new Response(String(e && e.message || e), { status: 502 }); });
}

/* WebDAV avec identifiant : on relaie la requête (plage comprise) en ajoutant l'authentification,
   uniquement vers l'adresse de la source enregistrée. */
function dav(req, src, target, name) {
  return idbGet('dav:' + src).then(function (c) {
    if (!c || !c.base || target.indexOf(c.base) !== 0) return new Response('Adresse WebDAV inconnue : resynchronise la source.', { status: 403 });
    var headers = {};
    if (c.auth) headers.Authorization = c.auth;
    var rg = req.headers.get('range');
    if (rg) headers.Range = rg;
    return fetch(target, { headers: headers }).then(function (r) {
      if (!r.ok) return new Response('WebDAV : ' + r.status, { status: r.status });
      var h = { 'Content-Type': r.headers.get('content-type') || mime(name), 'Accept-Ranges': 'bytes' };
      ['content-length', 'content-range'].forEach(function (k) { var v = r.headers.get(k); if (v) h[k] = v; });
      return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
    });
  }).catch(function (e) { return new Response(String(e && e.message || e), { status: 502 }); });
}

/* MEGA : megajs (vendor/mega.umd.js) est chargé à la première lecture, puis chaque plage est déchiffrée à la volée. */
var megaReady = null, roots = {};
function loadMega() {
  if (self.mega && self.mega.File) return Promise.resolve(self.mega);
  if (!megaReady) {
    megaReady = caches.match('./vendor/mega.umd.js').then(function (r) { return r || fetch('./vendor/mega.umd.js'); })
      .then(function (r) { return r.text(); })
      .then(function (code) { (0, eval)(code); if (!self.mega || !self.mega.File) throw new Error('megajs indisponible'); return self.mega; });
    megaReady.catch(function () { megaReady = null; });
  }
  return megaReady;
}
function findNode(node, id) {
  if (node.nodeId === id) return node;
  var ch = node.children || [];
  for (var i = 0; i < ch.length; i++) { var r = findNode(ch[i], id); if (r) return r; }
  return null;
}
function megaNode(kind, src, fid) {
  return (kind === 'megalink' ? idbGet('megalink:' + src + ':' + fid) : idbGet('mega:' + src)).then(function (link) {
    if (!link) throw new Error('Lien MEGA inconnu : resynchronise la source.');
    return loadMega().then(function (M) {
      var c = roots[link];
      if (!c || Date.now() - c.at > 10 * 60 * 1000) {
        var f = M.File.fromURL(link);
        c = roots[link] = { at: Date.now(), p: f.loadAttributes().then(function () { return f; }) };
        c.p.catch(function () { delete roots[link]; });
      }
      return c.p.then(function (root) {
        if (kind === 'megalink' || fid === 'root' || !root.directory) return root;
        var n = findNode(root, fid);
        if (!n) throw new Error('Fichier introuvable dans le dossier MEGA.');
        return n;
      });
    });
  });
}

var CAP = 12 * 1024 * 1024;
function megaStream(kind, src, fid, name, range) {
  return megaNode(kind, src, fid).then(function (file) {
    var size = file.size || 0;
    var start = 0, end = size - 1;
    if (range) {
      if (range.suffix != null) { start = Math.max(0, size - range.suffix); }
      else { start = range.start || 0; if (range.end != null) end = Math.min(range.end, size - 1); }
      if (start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
      if (end - start + 1 > CAP) end = start + CAP - 1;
    }
    var dl = file.download({ start: start, end: end, maxConnections: 4, initialChunkSize: 256 * 1024, maxChunkSize: 1024 * 1024 });
    var body = new ReadableStream({
      start: function (ctrl) {
        dl.on('data', function (chunk) {
          try { ctrl.enqueue(new Uint8Array(chunk)); } catch (e) { return; }
          if (ctrl.desiredSize <= 0 && dl.pause) dl.pause();
        });
        dl.on('end', function () { try { ctrl.close(); } catch (e) { /* déjà fermé */ } });
        dl.on('error', function (err) { try { ctrl.error(err); } catch (e) { /* déjà fermé */ } });
      },
      pull: function () { if (dl.resume) dl.resume(); },
      cancel: function () { try { if (dl.destroy) dl.destroy(); else dl.emit('close'); } catch (e) { /* ignoré */ } }
    }, { highWaterMark: 8 });
    var headers = { 'Content-Type': mime(name || file.name), 'Accept-Ranges': 'bytes', 'Content-Length': String(end - start + 1) };
    if (range) {
      headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + size;
      return new Response(body, { status: 206, statusText: 'Partial Content', headers: headers });
    }
    return new Response(body, { status: 200, headers: headers });
  }).catch(function (e) {
    var m = String(e && e.message || e);
    return new Response(m, { status: /Bandwidth|509|EOVERQUOTA/i.test(m) ? 509 : 502 });
  });
}
