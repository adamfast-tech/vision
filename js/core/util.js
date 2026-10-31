/* Vision — outils communs. Syntaxe volontairement prudente (TV Chromium 70+) : pas de ?. ni ?? ni ||=. */

export function $(sel, root) { return (root || document).querySelector(sel); }
export function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; });
}

/* Gabarit HTML : chaque valeur interpolée est échappée, sauf raw(). */
export function raw(s) { return { __raw: String(s == null ? '' : s) }; }
function fmt(v) {
  if (v == null || v === false) return '';
  if (Array.isArray(v)) return v.map(fmt).join('');
  if (typeof v === 'object' && v.__raw != null) return v.__raw;
  return esc(v);
}
export function html(strings) {
  var out = '';
  for (var i = 0; i < strings.length; i++) {
    out += strings[i];
    if (i + 1 < arguments.length) out += fmt(arguments[i + 1]);
  }
  return raw(out);
}
export function str(h) { return h && h.__raw != null ? h.__raw : String(h == null ? '' : h); }

export function uid(prefix) {
  var a = new Uint8Array(6);
  (window.crypto || window.msCrypto).getRandomValues(a);
  var s = '';
  for (var i = 0; i < a.length; i++) s += (a[i] % 36).toString(36);
  return (prefix || '') + s + Date.now().toString(36).slice(-3);
}

/* Empreinte stable (cyrb53) en base 36 : identifiants de fichiers par URL. */
export function hash(input) {
  var s = String(input), h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (var i = 0; i < s.length; i++) {
    var ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/* Texte normalisé pour comparer : minuscules, sans accents, sans ponctuation. */
export function norm(s) {
  var t = String(s == null ? '' : s).toLowerCase();
  if (t.normalize) t = t.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return t.replace(/[œ]/g, 'oe').replace(/[æ]/g, 'ae').replace(/&/g, ' et ')
    .replace(/[^a-z0-9Ѐ-ӿ぀-ヿ一-鿿]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function debounce(fn, ms) {
  var t;
  return function () {
    var ctx = this, args = arguments;
    clearTimeout(t);
    t = setTimeout(function () { fn.apply(ctx, args); }, ms);
  };
}
export function throttle(fn, ms) {
  var last = 0, t;
  return function () {
    var ctx = this, args = arguments, now = Date.now();
    clearTimeout(t);
    if (now - last >= ms) { last = now; fn.apply(ctx, args); }
    else t = setTimeout(function () { last = Date.now(); fn.apply(ctx, args); }, ms - (now - last));
  };
}
export function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
export function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function pad(n) { return n < 10 ? '0' + n : '' + n; }
export function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
}
export function fmtDur(sec) {
  if (!sec || !isFinite(sec)) return '';
  var m = Math.round(sec / 60);
  if (m < 60) return m + ' min';
  var h = Math.floor(m / 60), r = m % 60;
  return h + ' h' + (r ? ' ' + pad(r) : '');
}
export function fmtSize(b) {
  if (!b && b !== 0) return '';
  var u = ['o', 'Ko', 'Mo', 'Go', 'To'], i = 0, n = +b;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return (i > 1 ? n.toFixed(1).replace('.', ',') : Math.round(n)) + ' ' + u[i];
}
var RTF = null;
try { RTF = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' }); } catch (e) { RTF = null; }
export function timeAgo(ts) {
  if (!ts) return 'jamais';
  var d = (ts - Date.now()) / 1000, a = Math.abs(d);
  var steps = [[60, 'second', 1], [3600, 'minute', 60], [86400, 'hour', 3600], [604800, 'day', 86400], [2629800, 'week', 604800], [31557600, 'month', 2629800], [Infinity, 'year', 31557600]];
  for (var i = 0; i < steps.length; i++) {
    if (a < steps[i][0]) {
      var v = Math.round(d / steps[i][2]);
      if (RTF) return RTF.format(v, steps[i][1]);
      return 'il y a ' + Math.abs(v) + ' ' + steps[i][1];
    }
  }
  return '';
}
export function plural(n, one, many) { return n + ' ' + (n > 1 ? many : one); }

export function ext(name) {
  var m = /\.([a-z0-9]{1,5})(?:$|[?#])/i.exec(String(name || ''));
  return m ? m[1].toLowerCase() : '';
}
export function stripExt(name) { return String(name || '').replace(/\.[a-z0-9]{1,5}$/i, ''); }

/* Exécute fn sur chaque élément avec au plus `limit` tâches en parallèle. */
export function pool(items, limit, fn) {
  return new Promise(function (resolve) {
    var i = 0, active = 0, results = new Array(items.length);
    if (!items.length) return resolve(results);
    function next() {
      if (i >= items.length && active === 0) return resolve(results);
      while (active < limit && i < items.length) {
        (function (idx) {
          active++;
          Promise.resolve().then(function () { return fn(items[idx], idx); })
            .then(function (r) { results[idx] = r; }, function (e) { results[idx] = e; })
            .then(function () { active--; next(); });
        })(i++);
      }
    }
    next();
  });
}

export function b64url(bytes) {
  var s = '';
  for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unb64url(s) {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  var bin = atob(s), out = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* Bus d'événements applicatif. */
export function emit(name, detail) {
  var ev;
  try { ev = new CustomEvent('vision:' + name, { detail: detail }); }
  catch (e) { ev = document.createEvent('CustomEvent'); ev.initCustomEvent('vision:' + name, false, false, detail); }
  window.dispatchEvent(ev);
}
export function on(name, fn) {
  var h = function (e) { fn(e.detail); };
  window.addEventListener('vision:' + name, h);
  return function () { window.removeEventListener('vision:' + name, h); };
}

export function loadScript(src, attrs) {
  return new Promise(function (resolve, reject) {
    var s = document.createElement('script');
    s.src = src;
    s.async = true;
    if (attrs) Object.keys(attrs).forEach(function (k) { s.setAttribute(k, attrs[k]); });
    s.onload = function () { resolve(); };
    s.onerror = function () { reject(new Error('Chargement impossible : ' + src)); };
    document.head.appendChild(s);
  });
}

export function mq(query, fn) {
  var m = window.matchMedia ? matchMedia(query) : { matches: false };
  if (fn && m.addEventListener) m.addEventListener('change', function () { fn(m.matches); });
  else if (fn && m.addListener) m.addListener(function () { fn(m.matches); });
  return m;
}

export function copyText(t) {
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t);
  return new Promise(function (resolve, reject) {
    var ta = document.createElement('textarea');
    ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy') ? resolve() : reject(new Error('copie refusée')); } catch (e) { reject(e); }
    ta.remove();
  });
}

export function downloadFile(name, text, type) {
  var blob = new Blob([text], { type: type || 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}

/* Les interrupteurs Brio s'appuient sur :has() (Chrome 105+) : sinon, case à cocher native. */
export var HAS_SEL = (function () { try { return !!(window.CSS && CSS.supports && CSS.supports('selector(:has(*))')); } catch (e) { return false; } })();
export function switchAttr() { return HAS_SEL ? raw('data-brio="interrupteur-rebond"') : ''; }
