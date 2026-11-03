/* Détection de l'appareil et du mode d'entrée (télécommande, souris, tactile). */
import { state } from './store.js';
import { mq } from './util.js';

var ua = navigator.userAgent || '';
export var isTVUA = /SMART-?TV|SmartTV|SMART_TV|Tizen|Web0S|WebOS|NetCast|BRAVIA|\bAFT[A-Z]|AFTB|Android TV|GoogleTV|CrKey|HbbTV|VIDAA|Hisense|Roku|PhilipsTV|Viera|Opera TV|AppleTV|Xbox|PlayStation|Nintendo|DTV|SmartHub/i.test(ua);
export var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export var isIPhone = /iPhone|iPod/.test(ua);
export var isAndroid = /Android/i.test(ua);
export var isSafari = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(ua);

export function detect() {
  if (isTVUA) return 'tv';
  var coarse = mq('(pointer: coarse)').matches, hover = mq('(hover: hover)').matches;
  var minSide = Math.min(screen.width || innerWidth, screen.height || innerHeight);
  if (coarse && !hover) return minSide >= 700 ? 'tablet' : 'mobile';
  if (innerWidth < 640) return 'mobile';
  return 'desktop';
}

export function apply() {
  var pref = state.settings.device;
  var d = pref && pref !== 'auto' ? pref : detect();
  state.device = d;
  var root = document.documentElement;
  root.setAttribute('data-device', d);
  root.setAttribute('data-layout', d === 'mobile' || (d === 'tablet' && innerWidth < 900) || (d !== 'tv' && innerWidth < 760) ? 'bar' : 'rail');
  var reduce = state.settings.motion === 'reduced' || (state.settings.motion !== 'full' && mq('(prefers-reduced-motion: reduce)').matches);
  root.setAttribute('data-anim', reduce ? 'reduced' : (d === 'tv' ? 'light' : 'full'));
  return d;
}

export function reducedMotion() { return document.documentElement.getAttribute('data-anim') === 'reduced'; }
export function lightMotion() { return document.documentElement.getAttribute('data-anim') !== 'full'; }
export function isTV() { return state.device === 'tv'; }
export function isTouch() { return state.device === 'mobile' || state.device === 'tablet'; }

/* Dernier mode d'entrée utilisé : html[data-input="key|pointer|touch"]. */
export function trackInput() {
  var root = document.documentElement;
  function set(m) { if (root.getAttribute('data-input') !== m) root.setAttribute('data-input', m); }
  set(isTVUA ? 'key' : 'pointer');
  window.addEventListener('keydown', function (e) {
    if (/^(Arrow|Tab|Enter|Escape)/.test(e.key) || [37, 38, 39, 40, 13, 9, 10009, 461].indexOf(e.keyCode) !== -1) set('key');
  }, true);
  // Après un appui, le navigateur simule des événements souris : on les ignore pendant un instant.
  var lastTouch = 0;
  function mouse() { if (Date.now() - lastTouch > 1000) set('pointer'); }
  window.addEventListener('mousemove', function (e) { if (e.movementX || e.movementY) mouse(); }, { passive: true });
  window.addEventListener('mousedown', mouse, true);
  window.addEventListener('touchstart', function () { lastTouch = Date.now(); set('touch'); }, { passive: true, capture: true });
}
