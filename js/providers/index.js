/* Registre des stockages et choix du lecteur pour chaque fichier. */
import * as gdrive from './gdrive.js';
import * as mega from './mega.js';
import * as http from './http.js';
import * as links from './links.js';
import * as demo from './demo.js';
import { state, getSource } from '../core/store.js';
import { ext } from '../core/util.js';
import { HARD_EXT } from '../library/parse.js';

export var PROVIDERS = {
  gdrive: { mod: gdrive, label: 'Google Drive', icon: 'cloud', blurb: 'Un dossier partagé par lien, ou ton Drive privé via ta connexion Google.' },
  mega: { mod: mega, label: 'MEGA', icon: 'lock', blurb: 'Un lien public de dossier ou de fichier, clé de déchiffrement comprise.' },
  http: { mod: http, label: 'NAS ou serveur', icon: 'server', blurb: 'Une adresse HTTPS qui liste tes fichiers : NAS, rclone, Nginx, Apache, Caddy.' },
  links: { mod: links, label: 'Liens et listes', icon: 'link', blurb: 'Des liens directs, Dropbox, OneDrive, une liste M3U ou un fichier JSON.' },
  demo: { mod: demo, label: 'Démo', icon: 'spark', blurb: 'Quatre courts métrages libres pour essayer sans rien configurer.' }
};

export function mod(type) { return (PROVIDERS[type] || {}).mod; }

export function swActive() {
  return !!(navigator.serviceWorker && navigator.serviceWorker.controller);
}

function anyDriveKey() {
  for (var i = 0; i < state.sources.length; i++) {
    var s = state.sources[i];
    if (s.type === 'gdrive' && s.gdrive && s.gdrive.mode !== 'oauth' && s.gdrive.apiKey) return s.gdrive.apiKey;
  }
  return '';
}

/* Liste ordonnée des façons de lire un fichier : natif (balise vidéo), lecteur Drive intégré, lien externe. */
export function candidates(item) {
  var src = getSource(item.src);
  if (!src) return [];
  var pref = state.settings.player;
  var e = ext(item.name);
  var hard = HARD_EXT.indexOf(e) !== -1;
  var out = [];

  if (src.type === 'gdrive') {
    var native = { kind: 'native', url: gdrive.streamUrl(src, item), via: src.gdrive.mode === 'oauth' ? 'sw' : 'direct' };
    var frame = { kind: 'iframe', url: gdrive.previewUrl(item), label: 'Lecteur Google Drive' };
    if (native.via === 'sw' && !swActive()) native = null;
    if (item.rk) native = null;
    if (pref === 'drive' || hard) out = [frame, native];
    else if (pref === 'native') out = [native, frame];
    else out = [native, frame];
    out.push({ kind: 'external', url: gdrive.webUrl(item), label: 'Ouvrir dans Google Drive' });
  } else if (src.type === 'mega') {
    if (swActive()) out.push({ kind: 'native', url: mega.streamUrl(src, item), via: 'sw' });
    out.push({ kind: 'external', url: mega.webUrl(src, item), label: 'Ouvrir dans MEGA' });
  } else if (src.type === 'links') {
    if (item.kind === 'gdrive') {
      var key = anyDriveKey();
      var c1 = key ? { kind: 'native', url: gdrive.API + '/files/' + item.fid + '?alt=media&supportsAllDrives=true&key=' + encodeURIComponent(key), via: 'direct' } : null;
      var c2 = { kind: 'iframe', url: gdrive.previewUrl(item), label: 'Lecteur Google Drive' };
      out = pref === 'drive' || hard ? [c2, c1] : [c1, c2];
      out.push({ kind: 'external', url: gdrive.webUrl(item), label: 'Ouvrir dans Google Drive' });
    } else if (item.kind === 'mega') {
      if (swActive()) out.push({ kind: 'native', url: './__stream/megalink/' + encodeURIComponent(item.src) + '/' + encodeURIComponent(item.fid) + '?n=' + encodeURIComponent(item.name), via: 'sw' });
      out.push({ kind: 'external', url: item.url, label: 'Ouvrir dans MEGA' });
    } else {
      out.push({ kind: item.kind === 'hls' ? 'hls' : 'native', url: item.url, via: 'direct' });
      out.push({ kind: 'external', url: item.url, label: 'Ouvrir le lien' });
    }
  } else {
    var u = mod(src.type).streamUrl(src, item);
    out.push({ kind: /\.m3u8(\?|$)/i.test(u) ? 'hls' : 'native', url: u, via: 'direct' });
    out.push({ kind: 'external', url: u, label: 'Ouvrir le fichier' });
  }
  return out.filter(Boolean);
}

/* Texte d'un sous-titre posé à côté de la vidéo. */
export function fetchSub(item, sub) {
  var src = getSource(item.src);
  if (!src) return Promise.reject(new Error('Source introuvable.'));
  if (sub.url && src.type !== 'gdrive') return fetch(sub.url).then(function (r) { if (!r.ok) throw new Error('Sous-titres indisponibles.'); return r.arrayBuffer(); });
  if (src.type === 'gdrive') return gdrive.fetchText(src, sub.fid);
  if (src.type === 'mega') return mega.fetchText(src, sub.fid);
  return Promise.reject(new Error('Sous-titres non pris en charge pour cette source.'));
}

export function sourceLabel(src) {
  return (PROVIDERS[src.type] || {}).label || src.type;
}
