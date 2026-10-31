/* Transfert de configuration entre appareils (ex. téléphone → télé) par un code à 8 chiffres.
   Le message est chiffré dans le navigateur (AES-GCM, clé dérivée du code par PBKDF2) puis relayé par ntfy.sh,
   qui ne voit qu'un texte illisible. Le sujet ntfy est lui aussi dérivé du code. Rien n'est stocké côté relais. */
import { b64url, unb64url } from './util.js';

var RELAY = 'https://ntfy.sh/';
var CHUNK = 3000;
var enc = new TextEncoder(), dec = new TextDecoder();

export function supported() { return !!(window.crypto && crypto.subtle && window.TextEncoder); }

export function newCode() {
  var a = new Uint32Array(2);
  crypto.getRandomValues(a);
  var n = String(a[0] % 100000000);
  while (n.length < 8) n = '0' + n;
  return n;
}
export function fmtCode(c) { return String(c).replace(/\D/g, '').replace(/^(\d{4})(\d{4})$/, '$1 $2'); }
export function cleanCode(c) { return String(c || '').replace(/\D/g, '').slice(0, 8); }

function hex(buf) {
  var b = new Uint8Array(buf), s = '';
  for (var i = 0; i < b.length; i++) s += (b[i] < 16 ? '0' : '') + b[i].toString(16);
  return s;
}
export function topicFor(code) {
  return crypto.subtle.digest('SHA-256', enc.encode('vision-pair:' + code)).then(function (h) { return 'vision-' + hex(h).slice(0, 32); });
}
function keyFor(code) {
  return crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveKey']).then(function (base) {
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: enc.encode('vision-pair-v1'), iterations: 150000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  });
}

export function seal(code, obj) {
  var iv = crypto.getRandomValues(new Uint8Array(12));
  return keyFor(code).then(function (k) {
    return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, enc.encode(JSON.stringify(obj)));
  }).then(function (ct) {
    var out = new Uint8Array(12 + ct.byteLength);
    out.set(iv, 0);
    out.set(new Uint8Array(ct), 12);
    return b64url(out);
  });
}
export function open(code, text) {
  var all = unb64url(text);
  return keyFor(code).then(function (k) {
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12) }, k, all.slice(12));
  }).then(function (pt) { return JSON.parse(dec.decode(pt)); });
}

/* Envoi : découpe en morceaux (limite de taille du relais), un message par morceau. */
export function send(code, payload) {
  return Promise.all([topicFor(code), seal(code, payload)]).then(function (r) {
    var topic = r[0], data = r[1], id = Math.random().toString(36).slice(2, 8);
    var parts = [];
    for (var i = 0; i < data.length; i += CHUNK) parts.push(data.slice(i, i + CHUNK));
    var chain = Promise.resolve();
    parts.forEach(function (p, i) {
      chain = chain.then(function () {
        return fetch(RELAY + topic, { method: 'POST', body: 'VSN1.' + id + '.' + i + '.' + parts.length + '.' + p }).then(function (res) {
          if (!res.ok) throw new Error('Relais indisponible (' + res.status + ').');
        });
      });
    });
    return chain;
  }).catch(function (e) {
    if (/Failed to fetch|NetworkError|Load failed/i.test(e.message)) throw new Error('Impossible de joindre le relais ntfy.sh (réseau ou bloqueur).');
    throw e;
  });
}

/* Réception : écoute le sujet (EventSource), recompose les morceaux, déchiffre. Renvoie une fonction d'arrêt. */
export function listen(code, onPayload, onState) {
  var stopped = false, es = null, poll = null, chunks = {}, since = Math.floor(Date.now() / 1000) - 5;
  function handle(msg) {
    var m = /^VSN1\.(\w+)\.(\d+)\.(\d+)\.(.+)$/.exec(msg || '');
    if (!m) return;
    var c = chunks[m[1]] = chunks[m[1]] || { n: +m[3], parts: {} };
    c.parts[+m[2]] = m[4];
    if (Object.keys(c.parts).length < c.n) return;
    var txt = '';
    for (var i = 0; i < c.n; i++) txt += c.parts[i];
    open(code, txt).then(function (obj) { if (!stopped) onPayload(obj); }, function () { if (onState) onState('bad'); });
  }
  topicFor(code).then(function (topic) {
    if (stopped) return;
    if (window.EventSource) {
      es = new EventSource(RELAY + topic + '/sse?since=' + since);
      es.onopen = function () { if (onState) onState('ready'); };
      es.onmessage = function (ev) { try { handle(JSON.parse(ev.data).message); } catch (e) { /* ignoré */ } };
      es.onerror = function () { if (onState) onState('retry'); };
    } else {
      if (onState) onState('ready');
      poll = setInterval(function () {
        fetch(RELAY + topic + '/json?poll=1&since=' + since).then(function (r) { return r.text(); }).then(function (t) {
          t.split('\n').forEach(function (line) { if (line.trim()) { try { var j = JSON.parse(line); since = Math.max(since, j.time || 0); handle(j.message); } catch (e) { /* ignoré */ } } });
        }).catch(function () { if (onState) onState('retry'); });
      }, 3000);
    }
  });
  return function () { stopped = true; if (es) es.close(); if (poll) clearInterval(poll); };
}
