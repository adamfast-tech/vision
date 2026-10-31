/* MEGA : lien public de dossier ou de fichier (chiffré de bout en bout).
   La liste est déchiffrée dans la page ; la lecture passe par le service worker, qui déchiffre à la volée
   les plages demandées par le lecteur vidéo (bibliothèque megajs, licence MIT, dans vendor/). */
import { loadScript } from '../core/util.js';
import * as idb from '../core/idb.js';
import { isVideo, isSub, isJunk } from '../library/parse.js';
import { attachSubs } from './gdrive.js';

var ready = null;
export function loadMega() {
  if (window.mega && window.mega.File) return Promise.resolve(window.mega);
  if (!ready) ready = loadScript('vendor/mega.umd.js').then(function () {
    if (!window.mega || !window.mega.File) throw new Error('Bibliothèque MEGA indisponible.');
    return window.mega;
  });
  return ready;
}

export function parseMegaLink(input) {
  var s = String(input || '').trim();
  if (/^https?:\/\/(www\.)?mega(\.co)?\.nz\/(folder|file)\/[\w-]+#[\w-]+/.test(s)) return { url: s, folder: /\/folder\//.test(s) };
  if (/^https?:\/\/(www\.)?mega(\.co)?\.nz\/#F?![\w-]+![\w-]+/.test(s)) return { url: s, folder: /#F!/.test(s) };
  return null;
}

function explain(err) {
  var m = String(err && err.message || err);
  if (/EOVERQUOTA|Bandwidth|509/i.test(m)) return 'Quota de transfert MEGA atteint pour cette connexion. Réessaie plus tard.';
  if (/ENOENT|-9\b|not found/i.test(m)) return 'Lien MEGA introuvable ou supprimé.';
  if (/EKEY|decrypt|key/i.test(m)) return 'Clé de déchiffrement MEGA incorrecte : copie le lien complet (avec la partie après #).';
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'MEGA ne répond pas (réseau ou bloqueur de contenu).';
  return 'MEGA : ' + m;
}

export function scan(src, ctx) {
  var link = parseMegaLink((src.mega || {}).url);
  if (!link) return Promise.reject(new Error('Lien MEGA invalide : il doit ressembler à https://mega.nz/folder/…#…'));
  return loadMega().then(function (M) {
    var root = M.File.fromURL(link.url);
    return root.loadAttributes().then(function () { return root; });
  }).then(function (root) {
    var items = [], subs = [], n = 0;
    function push(f, path) {
      if (f.directory) {
        (f.children || []).forEach(function (c) { push(c, path.concat(f === root ? [] : [f.name])); });
        return;
      }
      var name = f.name || '';
      if (isVideo(name) && !isJunk(name, f.size || 0)) {
        items.push({
          id: src.id + ':' + (f.nodeId || 'root'),
          src: src.id,
          fid: f.nodeId || '',
          name: name,
          path: path,
          size: f.size || 0,
          mtime: (f.timestamp || 0) * 1000,
          thumb: ''
        });
        if (ctx && ctx.progress && ++n % 20 === 0) ctx.progress({ found: items.length });
      } else if (isSub(name)) {
        subs.push({ fid: f.nodeId || '', name: name, path: path.join('/') });
      }
    }
    if (root.directory) push(root, []);
    else push(root, []);
    attachSubs(items, subs);
    return idb.set('mega:' + src.id, link.url).then(function () { return items; });
  }).catch(function (e) { throw new Error(explain(e)); });
}

export function streamUrl(src, item) {
  return './__stream/mega/' + encodeURIComponent(src.id) + '/' + encodeURIComponent(item.fid || 'root') + '?s=' + (item.size || 0) + '&n=' + encodeURIComponent(item.name);
}
export function webUrl(src, item) {
  var url = (src.mega || {}).url || '';
  if (/\/folder\//.test(url) && item.fid) return url.replace(/\/file\/.*$/, '') + '/file/' + item.fid;
  return url;
}
export function fetchText(src, fid) {
  return fetch('./__stream/mega/' + encodeURIComponent(src.id) + '/' + encodeURIComponent(fid) + '?s=0&n=sub.srt').then(function (r) {
    if (!r.ok) throw new Error('Sous-titres MEGA indisponibles.');
    return r.arrayBuffer();
  });
}
export function test(src) {
  return parseMegaLink((src.mega || {}).url) ? Promise.resolve(true) : Promise.reject(new Error('Lien MEGA invalide : copie le lien complet, clé comprise (https://mega.nz/folder/…#…).'));
}
export function register(src) {
  return idb.set('mega:' + src.id, (src.mega || {}).url || '');
}
