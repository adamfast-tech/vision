/* Navigation à la télécommande et au clavier : flèches = déplacement spatial, OK = valider, Retour = revenir.
   Les rangées horizontales ([data-nav-row]) mémorisent la dernière carte visitée, comme sur les applis TV. */
import { reducedMotion, isTV } from './device.js';

var FOCUSABLE = 'a[href]:not([tabindex="-1"]),button:not([disabled]):not([tabindex="-1"]),input:not([disabled]):not([type="hidden"]):not([tabindex="-1"]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]';
var scopes = [];
var memory = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
var backHandler = function () {};
var lastContent = null;

export function onBack(fn) { backHandler = fn; }
export function pushScope(el, back) { scopes.push({ el: el, back: back }); }
export function popScope(el) { scopes = scopes.filter(function (s) { return s.el !== el; }); }
export function topScope() { return scopes.length ? scopes[scopes.length - 1] : null; }
function scopeEl() { var s = topScope(); return s ? s.el : (document.getElementById('app') || document.body); }

export function keyName(e) {
  var k = e.key, c = e.keyCode;
  if (k === 'ArrowUp' || k === 'Up' || c === 38) return 'up';
  if (k === 'ArrowDown' || k === 'Down' || c === 40) return 'down';
  if (k === 'ArrowLeft' || k === 'Left' || c === 37) return 'left';
  if (k === 'ArrowRight' || k === 'Right' || c === 39) return 'right';
  if (k === 'Enter' || c === 13) return 'ok';
  if (k === 'Escape' || k === 'Esc' || k === 'BrowserBack' || k === 'GoBack' || k === 'XF86Back' || c === 27 || c === 10009 || c === 461) return 'back';
  if (k === 'Backspace' || c === 8) return 'backspace';
  if (k === 'MediaPlayPause' || k === 'MediaPlay' || k === 'MediaPause' || c === 179 || c === 10252 || c === 415 || c === 19) return 'playpause';
  if (k === 'MediaFastForward' || c === 417 || c === 228) return 'ff';
  if (k === 'MediaRewind' || c === 412 || c === 227) return 'rw';
  if (k === 'MediaTrackNext' || c === 176) return 'next';
  if (k === 'MediaTrackPrevious' || c === 177) return 'prev';
  if (k === 'MediaStop' || c === 178 || c === 413) return 'stop';
  if (k === 'ContextMenu' || k === 'Info' || c === 457 || c === 93) return 'info';
  return null;
}

export function isTyping(el) {
  if (!el) return false;
  var t = el.tagName;
  if (t === 'TEXTAREA') return true;
  if (t === 'INPUT') return !/^(button|checkbox|radio|range|submit|reset|color|file)$/i.test(el.type || '');
  return !!el.isContentEditable;
}

export function focusable(el) {
  if (!el || !el.matches || !el.matches(FOCUSABLE)) return false;
  if (el.closest('[hidden],[inert],[aria-hidden="true"],.nav-skip')) return false;
  var r = el.getBoundingClientRect();
  return r.width > 1 && r.height > 1;
}
function candidatesIn(root) {
  var list = root.querySelectorAll(FOCUSABLE), out = [];
  for (var i = 0; i < list.length; i++) if (focusable(list[i])) out.push(list[i]);
  return out;
}

function gap(a1, a2, b1, b2) { return b1 > a2 ? b1 - a2 : (a1 > b2 ? a1 - b2 : 0); }

function best(cur, cands, dir) {
  var a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  var bestEl = null, bestScore = Infinity;
  for (var i = 0; i < cands.length; i++) {
    var c = cands[i];
    if (c === cur || c.contains(cur) || cur.contains(c)) continue;
    var b = c.getBoundingClientRect(), bx = b.left + b.width / 2, by = b.top + b.height / 2, p, o;
    if (dir === 'down') { if (by <= ay + 2 || b.bottom <= a.bottom) continue; p = Math.max(0, b.top - a.bottom); o = gap(a.left, a.right, b.left, b.right); }
    else if (dir === 'up') { if (by >= ay - 2 || b.top >= a.top) continue; p = Math.max(0, a.top - b.bottom); o = gap(a.left, a.right, b.left, b.right); }
    else if (dir === 'right') { if (bx <= ax + 2 || b.right <= a.right) continue; p = Math.max(0, b.left - a.right); o = gap(a.top, a.bottom, b.top, b.bottom); }
    else { if (bx >= ax - 2 || b.left >= a.left) continue; p = Math.max(0, a.left - b.right); o = gap(a.top, a.bottom, b.top, b.bottom); }
    var align = (dir === 'up' || dir === 'down') ? Math.abs(bx - ax) : Math.abs(by - ay);
    var score = p + o * 3 + align * 0.15;
    if (score < bestScore) { bestScore = score; bestEl = c; }
  }
  return bestEl;
}

export function focus(el, opts) {
  if (!el) return;
  try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
  var row = el.closest('[data-nav-row]');
  if (row && memory) memory.set(row, el);
  if (!opts || opts.scroll !== false) reveal(el);
}

export function reveal(el) {
  var smooth = !reducedMotion();
  var row = el.closest('[data-nav-row]');
  var track = row ? (row.querySelector('[data-nav-track]') || row) : null;
  if (track && track.scrollWidth > track.clientWidth + 2) {
    var r = el.getBoundingClientRect(), s = track.getBoundingClientRect();
    var pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
    if (r.left < s.left + pad - 1 || r.right > s.right - 8) {
      var target = track.scrollLeft + (r.left - s.left) - pad;
      if (track.scrollTo) track.scrollTo({ left: target, behavior: smooth ? 'smooth' : 'auto' });
      else track.scrollLeft = target;
    }
  }
  var vr = el.getBoundingClientRect(), vh = window.innerHeight;
  var topLimit = isTV() ? vh * 0.12 : 70, bottomLimit = vh - (isTV() ? vh * 0.08 : 90);
  if (vr.top < topLimit || vr.bottom > bottomLimit) {
    var target2 = row || el;
    var block = row ? (isTV() && document.querySelector('.hero') ? 'start' : 'center') : 'nearest';
    if (isTV() && el.closest('.hero')) { window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' }); return; }
    try { target2.scrollIntoView({ block: block, inline: 'nearest', behavior: smooth ? 'smooth' : 'auto' }); }
    catch (e) { target2.scrollIntoView(false); }
  }
}

export function move(dir) {
  var root = scopeEl();
  var cur = document.activeElement;
  if (!cur || cur === document.body || !root.contains(cur) || !focusable(cur)) { focusFirst(root); return true; }
  var row = cur.closest('[data-nav-row]');
  if (row && (dir === 'left' || dir === 'right')) {
    var items = candidatesIn(row), i = items.indexOf(cur);
    var nxt = items[i + (dir === 'right' ? 1 : -1)];
    if (nxt) { focus(nxt); return true; }
    if (dir === 'right') { bump(cur, dir); return true; }
  }
  var target = best(cur, candidatesIn(root), dir);
  if (!target) { bump(cur, dir); return true; }
  // Vers le menu latéral : on arrive sur la page en cours ; en revenant, on retrouve la dernière carte.
  var navEl = document.querySelector('.rail-nav');
  if (navEl && dir === 'left' && navEl.contains(target) && !navEl.contains(cur)) {
    lastContent = cur;
    var here = navEl.querySelector('a[aria-current="page"]');
    if (here && focusable(here)) target = here;
  } else if (navEl && dir === 'right' && navEl.contains(cur) && !navEl.contains(target) && lastContent && document.contains(lastContent) && focusable(lastContent)) {
    target = lastContent;
  }
  var trow = target.closest('[data-nav-row]');
  if (trow && trow !== row && (dir === 'up' || dir === 'down') && memory) {
    var mem = memory.get(trow);
    if (mem && trow.contains(mem) && focusable(mem)) {
      var mr = mem.getBoundingClientRect();
      if (mr.right > 0 && mr.left < window.innerWidth) target = mem;
    }
  }
  focus(target);
  return true;
}

/* Petit rebond quand on bute sur un bord : on sait que la touche a été prise en compte. */
function bump(el, dir) {
  if (reducedMotion() || !el.animate) return;
  var d = dir === 'left' ? [-6, 0] : dir === 'right' ? [6, 0] : dir === 'up' ? [0, -6] : [0, 6];
  el.animate([{ translate: '0 0' }, { translate: d[0] + 'px ' + d[1] + 'px' }, { translate: '0 0' }], { duration: 220, easing: 'ease-out' });
}

export function focusFirst(root) {
  root = root || scopeEl();
  var auto = root.querySelector('[data-autofocus]');
  if (auto && focusable(auto)) return focus(auto);
  var main = root.querySelector('#view') || root;
  var list = candidatesIn(main);
  if (!list.length) list = candidatesIn(root);
  if (list.length) focus(list[0], { scroll: false });
}

export function restore(selector, root) {
  root = root || scopeEl();
  var el = selector ? root.querySelector(selector) : null;
  if (el && focusable(el)) { focus(el); return true; }
  return false;
}

/* Appui long sur OK (ou clic droit, appui long tactile) sur un élément [data-longpress] → événement « longpress ». */
function longPress() {
  var timer = null, fired = false, target = null;
  document.addEventListener('keydown', function (e) {
    if (keyName(e) !== 'ok') return;
    var el = e.target.closest && e.target.closest('[data-longpress]');
    if (!el) return;
    e.preventDefault();
    if (e.repeat || timer) return;
    fired = false; target = el;
    timer = setTimeout(function () {
      timer = null; fired = true;
      el.dispatchEvent(new CustomEvent('longpress', { bubbles: true }));
    }, 550);
  }, true);
  document.addEventListener('keyup', function (e) {
    if (keyName(e) !== 'ok' || !target) return;
    var el = target; target = null;
    if (timer) { clearTimeout(timer); timer = null; if (!fired) el.click(); }
  }, true);
  document.addEventListener('contextmenu', function (e) {
    var el = e.target.closest && e.target.closest('[data-longpress]');
    if (!el) return;
    e.preventDefault();
    el.dispatchEvent(new CustomEvent('longpress', { bubbles: true }));
  });
}

export function init() {
  longPress();
  document.addEventListener('keydown', function (e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    var k = keyName(e);
    if (!k) return;
    var t = e.target, typing = isTyping(t);
    if (k === 'ok' && t.tagName === 'INPUT' && /^(checkbox|radio)$/i.test(t.type)) { e.preventDefault(); t.click(); return; }
    if (k === 'back' || (k === 'backspace' && !typing)) {
      if (typing && k === 'back' && e.key === 'Escape') { t.blur(); e.preventDefault(); return; }
      e.preventDefault();
      var s = topScope();
      if (s && s.back) s.back(); else backHandler();
      return;
    }
    if (k === 'up' || k === 'down' || k === 'left' || k === 'right') {
      if (typing && (k === 'left' || k === 'right')) return;
      if (t.tagName === 'SELECT') return;
      if (t.type === 'range' && (k === 'left' || k === 'right')) return;
      if (t.getAttribute && t.getAttribute('role') === 'slider' && (k === 'left' || k === 'right')) return;
      if (t.closest && t.closest('[data-nav-own]')) return;
      if (move(k)) e.preventDefault();
    }
  });
  // Télécommande à pointeur (LG Magic Remote) : le survol donne le focus.
  document.addEventListener('mouseover', function (e) {
    if (!isTV()) return;
    var el = e.target.closest && e.target.closest(FOCUSABLE);
    if (el && el !== document.activeElement && focusable(el) && scopeEl().contains(el)) {
      try { el.focus({ preventScroll: true }); } catch (err) { el.focus(); }
    }
  });
}
