/* Lecteur Vision : balise vidéo native avec commandes maison (souris, clavier, télécommande, tactile),
   bascule automatique vers le lecteur Google Drive pour les formats non lus, sous-titres, reprise,
   épisode suivant, image dans l'image, AirPlay / Cast, plein écran, commandes de l'écran verrouillé. */
import { html, str, fmtTime, clamp, throttle, loadScript } from '../core/util.js';
import { state, setProgress, getSource } from '../core/store.js';
import { isTV, isTouch, isIPhone, reducedMotion } from '../core/device.js';
import * as nav from '../core/nav.js';
import * as router from '../core/router.js';
import { locate, item as getItem, displayTitle, image, epLabel, epLong, nextEpisode, prevEpisode } from '../library/library.js';
import { candidates, fetchSub, sourceLabel } from '../providers/index.js';
import { subLang } from '../library/parse.js';
import { decode, toVtt } from './subs.js';
import { icon } from '../ui/components.js';
import { toast } from '../ui/overlay.js';
import { irisOpen, irisClose, refresh } from '../ui/fx.js';

var S = { opened: false };
var RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

function $(sel) { return S.el.querySelector(sel); }

function dom() {
  if (S.el) return;
  var root = document.getElementById('player-root');
  root.innerHTML = str(html`<div class="player" data-ui="on" data-mode="native" role="dialog" aria-label="Lecteur vidéo" tabindex="-1" hidden>
    <div class="pl-stage">
      <video class="pl-video" playsinline webkit-playsinline x-webkit-airplay="allow" preload="auto"></video>
      <iframe class="pl-frame" hidden allow="autoplay; fullscreen; picture-in-picture; encrypted-media" title="Lecteur Google Drive"></iframe>
      <div class="pl-subs" aria-hidden="true"><span></span></div>
    </div>
    <div class="pl-gest" aria-hidden="true"><div class="pl-zone" data-z="l"></div><div class="pl-zone" data-z="m"></div><div class="pl-zone" data-z="r"></div></div>
    <div class="pl-top">
      <button type="button" class="pl-btn pl-back" data-pl="close" aria-label="Fermer le lecteur">${icon('back')}</button>
      <div class="pl-titles"><p class="pl-title"></p><p class="pl-sub"></p></div>
      <div class="pl-top-right">
        <button type="button" class="pl-chip" data-pl="switch" hidden></button>
        <a class="pl-btn" data-pl="external" target="_blank" rel="noopener noreferrer" hidden aria-label="Ouvrir dans le stockage">${icon('external')}</a>
      </div>
    </div>
    <div class="pl-center">
      <span class="pl-spinner" hidden><span data-brio="traceur" data-taille="72" data-label="Chargement"></span></span>
      <button type="button" class="pl-bigplay" data-pl="toggle" aria-label="Lecture">${icon('play', 'ic-play')}${icon('pause', 'ic-pause')}</button>
      <div class="pl-seekfx" data-side="l"><span></span></div>
      <div class="pl-seekfx" data-side="r"><span></span></div>
    </div>
    <div class="pl-skip" hidden><button type="button" class="btn btn-glass" data-pl="skip-intro">Passer l’intro</button></div>
    <div class="pl-next" hidden>
      <div class="pl-next-card">
        <p class="pl-next-label">Épisode suivant dans <b data-countdown>10</b> s</p>
        <p class="pl-next-title"></p>
        <div class="pl-next-actions">
          <button type="button" class="btn btn-play" data-pl="next-now">${icon('play')}<span>Lire maintenant</span></button>
          <button type="button" class="btn btn-ghost" data-pl="next-cancel">Rester</button>
        </div>
      </div>
    </div>
    <div class="pl-bottom">
      <div class="pl-scrub" role="slider" tabindex="0" aria-label="Position dans la vidéo" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0">
        <div class="pl-rail"><div class="pl-buf"></div><div class="pl-played"></div><div class="pl-knob"></div></div>
        <div class="pl-tip">0:00</div>
      </div>
      <div class="pl-bar">
        <div class="pl-left">
          <button type="button" class="pl-btn pl-toggle" data-pl="toggle" aria-label="Lecture ou pause">${icon('play', 'ic-play')}${icon('pause', 'ic-pause')}</button>
          <button type="button" class="pl-btn" data-pl="prev" aria-label="Épisode précédent" hidden>${icon('prev')}</button>
          <button type="button" class="pl-btn" data-pl="rw" aria-label="Reculer de 10 secondes">${icon('rewind10')}</button>
          <button type="button" class="pl-btn" data-pl="ff" aria-label="Avancer de 10 secondes">${icon('forward10')}</button>
          <div class="pl-vol"><button type="button" class="pl-btn" data-pl="mute" aria-label="Couper le son">${icon('volume', 'ic-vol')}${icon('mute', 'ic-mute')}</button>
            <input type="range" class="pl-volrange" min="0" max="1" step="0.05" aria-label="Volume"></div>
          <span class="pl-time"><span data-cur>0:00</span><span class="sep"> / </span><span data-dur>0:00</span></span>
        </div>
        <div class="pl-right">
          <button type="button" class="pl-btn" data-pl="next" aria-label="Épisode suivant" hidden>${icon('next')}</button>
          <button type="button" class="pl-btn" data-pl="subs" aria-label="Sous-titres" hidden>${icon('cc')}</button>
          <button type="button" class="pl-btn" data-pl="speed" aria-label="Vitesse de lecture">${icon('speed')}</button>
          <button type="button" class="pl-btn" data-pl="pip" aria-label="Image dans l’image" hidden>${icon('pip')}</button>
          <button type="button" class="pl-btn" data-pl="cast" aria-label="Diffuser sur un autre écran" hidden>${icon('cast')}</button>
          <button type="button" class="pl-btn" data-pl="fs" aria-label="Plein écran">${icon('fullscreen', 'ic-fs')}${icon('fullscreen-exit', 'ic-fsx')}</button>
        </div>
      </div>
    </div>
    <div class="pl-menu" role="menu" hidden></div>
    <div class="pl-msg" role="alert" hidden><div class="pl-msg-card"><p class="pl-msg-title"></p><p class="pl-msg-text"></p><div class="pl-msg-actions"></div></div></div>
  </div>`);
  S.el = root.firstElementChild;
  S.video = $('.pl-video');
  S.frame = $('.pl-frame');
  bind();
  refresh(S.el);
}

/* ---------- Affichage des commandes ---------- */
function showUI(focusSel) {
  if (!S.el) return;
  S.el.setAttribute('data-ui', 'on');
  S.el.classList.remove('cursor-off');
  clearTimeout(S.uiTimer);
  if (focusSel) { var f = $(focusSel); if (f) nav.focus(f, { scroll: false }); }
  S.uiTimer = setTimeout(maybeHide, isTV() ? 4500 : 3200);
}
function maybeHide() {
  if (!S.opened || S.mode !== 'native') return;
  if (S.video.paused || !$('.pl-menu').hidden || !$('.pl-next').hidden || !$('.pl-msg').hidden || S.dragging) { S.uiTimer = setTimeout(maybeHide, 2500); return; }
  if (S.el.matches(':hover') && !isTV() && !isTouch() && (S.el.querySelector('.pl-bottom:hover, .pl-top:hover'))) { S.uiTimer = setTimeout(maybeHide, 2500); return; }
  S.el.setAttribute('data-ui', 'off');
  S.el.classList.add('cursor-off');
  if (S.el.contains(document.activeElement) && document.activeElement !== S.el) { try { S.el.focus({ preventScroll: true }); } catch (e) { S.el.focus(); } }
}
function uiOn() { return S.el.getAttribute('data-ui') === 'on'; }

/* ---------- Titres ---------- */
function setTitles() {
  var e = S.entity, ep = S.ep;
  $('.pl-title').textContent = e ? displayTitle(e) : S.item.name;
  $('.pl-sub').textContent = ep ? epLong(ep) + (ep.title ? ', ' + ep.title : '') : (e && e.year ? String(e.year) : '');
  var nx = e && e.kind === 'show' ? nextEpisode(e, S.item.id) : null;
  var pv = e && e.kind === 'show' ? prevEpisode(e, S.item.id) : null;
  $('[data-pl="next"]').hidden = !nx;
  $('[data-pl="prev"]').hidden = !pv;
  document.title = (e ? displayTitle(e) : S.item.name) + (ep ? ' ' + epLabel(ep) : '') + ' · Vision';
}

/* ---------- Ouverture ---------- */
export function isOpen() { return !!S.opened; }
export function currentId() { return S.opened && S.item ? S.item.id : null; }

export function open(itemId, opts) {
  opts = opts || {};
  dom();
  var loc = locate(itemId);
  var it = loc ? loc.item : getItem(itemId);
  if (!it) { toast('Vidéo introuvable : la source a peut-être été retirée.', { type: 'error' }); if (router.current().path.indexOf('/regarder/') === 0) router.back('/'); return; }
  var switching = S.opened;
  if (switching) { save(); stopMedia(); }
  S.item = it;
  S.entity = loc ? loc.entity : null;
  S.ep = loc ? loc.ep : null;
  S.cands = candidates(it);
  S.ci = -1;
  S.nextCancelled = false;
  S.subs = null;
  S.audioChecked = false;
  S.returnSel = opts.returnSel || S.returnSel || ('[data-item="' + it.id + '"]');
  var p = state.progress[it.id];
  S.startAt = opts.restart ? 0 : (opts.t != null ? opts.t : (state.settings.autoResume && p && !p.done && p.t > 20 && !p.iframe ? Math.max(0, p.t - 3) : 0));
  setTitles();
  hideNext();
  hideMsg();
  closeMenu();
  S.el.hidden = false;
  if (!switching) {
    S.opened = true;
    S.prevFocus = document.activeElement;
    document.documentElement.classList.add('is-playing');
    nav.pushScope(S.el, onBack);
    S.el.classList.remove('iris-out');
    irisOpen(opts.rect || null, S.el);
    if (state.settings.fsOnPlay && isTouch() && !isIPhone && opts.gesture !== false) fullscreen(true);
  }
  next(0);
  var path = '/regarder/' + encodeURIComponent(it.id);
  if (router.current().path !== path) router.go(path, { replace: switching || opts.replaceRoute });
  mediaSession();
  showUI(isTV() ? '.pl-toggle' : null);
  if (!isTV() && !switching) { try { S.el.focus({ preventScroll: true }); } catch (e) { S.el.focus(); } }
  if (S.startAt > 20 && opts.t == null && !opts.restart) {
    toast('Reprise à ' + fmtTime(S.startAt), { action: { label: 'Depuis le début', fn: function () { seek(0); } }, timeout: 5000 });
  }
}

function next(i) {
  S.ci = i;
  var c = S.cands[i];
  hideMsg();
  if (!c) return failAll();
  if (c.kind === 'external') return showExternal(c);
  var ext = $('[data-pl="external"]'), extC = S.cands.filter(function (x) { return x.kind === 'external'; })[0];
  ext.hidden = !extC;
  if (extC) { ext.href = extC.url; ext.setAttribute('aria-label', extC.label); ext.title = extC.label; }
  if (c.kind === 'iframe') {
    stopMedia(true);
    S.mode = 'iframe';
    S.el.setAttribute('data-mode', 'iframe');
    S.frame.hidden = false;
    S.frame.src = c.url;
    S.video.hidden = true;
    setProgress(S.item.id, 1, 0, { iframe: true });
    updateSwitch();
    showUI();
    return;
  }
  S.mode = 'native';
  S.el.setAttribute('data-mode', 'native');
  S.frame.hidden = true;
  if (S.frame.getAttribute('src')) S.frame.removeAttribute('src');
  S.video.hidden = false;
  S.video.volume = clamp(+state.settings.volume || 1, 0, 1);
  S.video.muted = !!state.settings.muted;
  S.video.playbackRate = +state.settings.rate || 1;
  S.video.disableRemotePlayback = c.via === 'sw';
  spinner(true);
  if (c.kind === 'hls' && !S.video.canPlayType('application/vnd.apple.mpegurl')) {
    loadHls(c.url);
  } else {
    S.video.src = c.url;
  }
  var pr = S.video.play();
  if (pr && pr.catch) pr.catch(function (err) {
    if (err && err.name === 'NotAllowedError') { spinner(false); S.el.classList.add('need-tap'); showUI('.pl-bigplay'); }
  });
  updateSwitch();
  loadSideSubs();
  updateFeatures();
}

function loadHls(url) {
  loadScript('https://cdn.jsdelivr.net/npm/hls.js@1.7.4/dist/hls.min.js').then(function () {
    if (!window.Hls || !window.Hls.isSupported()) throw new Error('HLS non pris en charge.');
    if (S.hls) S.hls.destroy();
    S.hls = new window.Hls({ maxBufferLength: 60 });
    S.hls.on(window.Hls.Events.ERROR, function (ev, data) { if (data && data.fatal) onError(); });
    S.hls.loadSource(url);
    S.hls.attachMedia(S.video);
    S.video.play().catch(function () {});
  }).catch(function () { onError(); });
}

function stopMedia(keepFrame) {
  if (!S.video) return;
  try { S.video.pause(); } catch (e) { /* ignoré */ }
  if (S.hls) { try { S.hls.destroy(); } catch (e) { /* ignoré */ } S.hls = null; }
  Array.prototype.forEach.call(S.video.querySelectorAll('track'), function (t) { if (t.src && t.src.indexOf('blob:') === 0) URL.revokeObjectURL(t.src); t.remove(); });
  if (S.subTrack) S.subTrack.oncuechange = null;
  S.subTrack = null;
  if (S.el) { $('.pl-subs span').innerHTML = ''; $('.pl-subs').classList.remove('on'); }
  S.video.removeAttribute('src');
  try { S.video.load(); } catch (e) { /* ignoré */ }
  if (!keepFrame && S.frame) { S.frame.removeAttribute('src'); S.frame.hidden = true; }
  spinner(false);
}

function updateSwitch() {
  var b = $('[data-pl="switch"]');
  var alt = null;
  for (var i = 0; i < S.cands.length; i++) {
    if (i !== S.ci && (S.cands[i].kind === 'iframe' || S.cands[i].kind === 'native' || S.cands[i].kind === 'hls')) { alt = i; break; }
  }
  b.hidden = alt === null;
  if (alt !== null) {
    b.textContent = S.cands[alt].kind === 'iframe' ? 'Lecteur Google Drive' : 'Lecteur Vision';
    b.setAttribute('data-alt', alt);
  }
}

/* ---------- Erreurs et repli ---------- */
function onError() {
  if (!S.opened || S.mode !== 'native') return;
  var err = S.video.error, code = err ? err.code : 0, c = S.cands[S.ci] || {};
  if (!S.video.getAttribute('src') && !S.hls) return;
  if (c.via === 'sw') {
    // Le service worker renvoie 401 quand la connexion Google a expiré.
    fetch(c.url, { headers: { Range: 'bytes=0-1' } }).then(function (r) {
      if (r.status === 401) return showMsg('Connexion Google expirée', 'Reconnecte-toi pour continuer la lecture.', [{ label: 'Se reconnecter', primary: true, fn: reauth }, { label: 'Fermer', fn: close }]);
      fallback(code);
    }).catch(function () { fallback(code); });
    return;
  }
  fallback(code);
}
function fallback(code) {
  var nextI = S.ci + 1;
  while (S.cands[nextI] && S.cands[nextI].kind === 'native' && S.cands[nextI].url === (S.cands[S.ci] || {}).url) nextI++;
  var n = S.cands[nextI];
  if (n && n.kind !== 'external') {
    toast(code === 4 || code === 3 ? 'Format non lu par cet appareil : bascule sur le ' + (n.label || 'lecteur Vision') + '.' : 'Lecture interrompue : essai avec le ' + (n.label || 'lecteur Vision') + '.');
    next(nextI);
  } else if (n) {
    next(nextI);
  } else failAll(code);
}
function failAll(code) {
  stopMedia();
  var src = getSource(S.item.src);
  var why = code === 4 ? 'Ce format ou ce codec n’est pas lu par cet appareil.' : 'Le fichier n’a pas pu être chargé (réseau, partage ou quota du stockage).';
  showMsg('Lecture impossible', why + (src ? ' Source : ' + src.name + ' (' + sourceLabel(src) + ').' : ''), [{ label: 'Réessayer', primary: true, fn: function () { next(0); } }, { label: 'Fermer', fn: close }]);
}
function showExternal(c) {
  stopMedia();
  var other = S.cands.filter(function (x) { return x.kind !== 'external'; }).length;
  showMsg(other ? 'Ce fichier ne se lit pas ici' : 'Lecture dans le stockage', other ? 'Aucun lecteur de cet appareil n’a pu ouvrir ce fichier.' : 'Ce fichier s’ouvre dans le lecteur de son stockage.', [
    { label: c.label, primary: true, href: c.url },
    { label: 'Réessayer', fn: function () { next(0); } },
    { label: 'Fermer', fn: close }
  ]);
}
function reauth() {
  var src = getSource(S.item.src);
  import('../providers/gdrive.js').then(function (g) { return g.signIn(src); }).then(function () {
    var t = S.video.currentTime || S.startAt;
    S.startAt = t;
    next(S.ci);
  }, function (e) { toast(e.message, { type: 'error' }); });
}

function showMsg(title, text, actions) {
  var m = $('.pl-msg');
  $('.pl-msg-title').textContent = title;
  $('.pl-msg-text').textContent = text;
  var box = $('.pl-msg-actions');
  box.innerHTML = '';
  actions.forEach(function (a, i) {
    var b = document.createElement(a.href ? 'a' : 'button');
    b.className = 'btn ' + (a.primary ? 'btn-play' : 'btn-ghost');
    b.textContent = a.label;
    if (a.href) { b.href = a.href; b.target = '_blank'; b.rel = 'noopener noreferrer'; }
    else { b.type = 'button'; b.addEventListener('click', a.fn); }
    box.appendChild(b);
    if (i === 0) setTimeout(function () { nav.focus(b, { scroll: false }); }, 60);
  });
  m.hidden = false;
  spinner(false);
  showUI();
}
function hideMsg() { if (S.el) $('.pl-msg').hidden = true; }

function spinner(on) {
  clearTimeout(S.spinT);
  var sp = $('.pl-spinner');
  if (on) S.spinT = setTimeout(function () { sp.hidden = false; }, 280);
  else sp.hidden = true;
}

/* ---------- Lecture ---------- */
function toggle() {
  if (S.mode !== 'native') return;
  S.el.classList.remove('need-tap');
  if (S.video.paused || S.video.ended) { var p = S.video.play(); if (p && p.catch) p.catch(function () {}); }
  else S.video.pause();
}
function seek(t) {
  var d = S.video.duration;
  if (!isFinite(d) || !d) { S.startAt = t; return; }
  S.video.currentTime = clamp(t, 0, d - 0.5);
  paint();
}
var seekAcc = 0, seekT = null, held = 0;
function seekBy(sec, side, repeat) {
  if (S.mode !== 'native') return;
  held = repeat ? held + 1 : 0;
  var step = sec * (held > 14 ? 6 : held > 7 ? 3 : held > 2 ? 2 : 1);
  seekAcc = (seekAcc && (seekAcc > 0) === (step > 0)) ? seekAcc + step : step;
  seek((S.video.currentTime || 0) + step);
  var fx = $('.pl-seekfx[data-side="' + (side || (step < 0 ? 'l' : 'r')) + '"]');
  fx.querySelector('span').textContent = (seekAcc > 0 ? '+' : '−') + Math.abs(seekAcc) + ' s';
  fx.classList.remove('on'); void fx.offsetWidth; fx.classList.add('on');
  clearTimeout(seekT);
  seekT = setTimeout(function () { seekAcc = 0; }, 900);
  showUI();
}

var saveThrottled = throttle(function () { save(); }, 5000);
function save() {
  if (!S.item || S.mode !== 'native' || !S.video) return;
  var t = S.video.currentTime, d = S.video.duration;
  if (!isFinite(d) || !d || t < 3) return;
  setProgress(S.item.id, t, d);
}

/* ---------- Barre de progression ---------- */
function paint() {
  if (!S.el || S.mode !== 'native') return;
  var v = S.video, d = v.duration, t = S.dragging ? S.dragT : v.currentTime;
  var ok = isFinite(d) && d > 0;
  var r = ok ? clamp(t / d, 0, 1) : 0;
  $('.pl-played').style.transform = 'scaleX(' + r + ')';
  $('.pl-knob').style.left = (r * 100) + '%';
  var be = 0;
  try { for (var i = 0; i < v.buffered.length; i++) if (v.buffered.start(i) <= v.currentTime + 1) be = Math.max(be, v.buffered.end(i)); } catch (e) { be = 0; }
  $('.pl-buf').style.transform = 'scaleX(' + (ok ? clamp(be / d, 0, 1) : 0) + ')';
  $('[data-cur]').textContent = fmtTime(t);
  $('[data-dur]').textContent = ok ? fmtTime(d) : '--:--';
  var sc = $('.pl-scrub');
  sc.setAttribute('aria-valuemax', ok ? Math.round(d) : 0);
  sc.setAttribute('aria-valuenow', Math.round(t || 0));
  sc.setAttribute('aria-valuetext', fmtTime(t) + ' sur ' + (ok ? fmtTime(d) : 'durée inconnue'));
}
function scrubAt(clientX) {
  var rail = $('.pl-rail').getBoundingClientRect();
  var r = clamp((clientX - rail.left) / rail.width, 0, 1);
  return r * (S.video.duration || 0);
}
function tipAt(clientX, t) {
  var tip = $('.pl-tip'), rail = $('.pl-rail').getBoundingClientRect();
  tip.textContent = fmtTime(t);
  tip.style.left = clamp(clientX - rail.left, 24, rail.width - 24) + 'px';
}

/* ---------- Sous-titres ---------- */
function loadSideSubs() {
  var subs = (S.item.subs || []).map(function (s) { var l = subLang(s.name, S.item.name); return Object.assign({}, s, l); });
  S.subs = subs;
  updateFeatures();
  if (!subs.length || !state.settings.subsAuto) return;
  var want = state.settings.subsLang;
  var pick = want === 'any' ? subs[0] : subs.filter(function (s) { return s.lang === want; })[0];
  if (pick) enableSub(pick);
}
var ESC_SUB = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
function renderCues() {
  var box = $('.pl-subs span'), t = S.subTrack;
  if (!t || !t.activeCues || !t.activeCues.length) { box.innerHTML = ''; box.parentNode.classList.remove('on'); return; }
  var txt = Array.prototype.map.call(t.activeCues, function (c) { return c.text || ''; }).join('\n');
  box.innerHTML = txt.replace(/[&<>"]/g, function (c) { return ESC_SUB[c]; })
    .replace(/&lt;(\/?)(i|b|u)&gt;/gi, '<$1$2>').replace(/&lt;[^&]*&gt;/g, '').replace(/\n/g, '<br>');
  box.parentNode.classList.add('on');
}
function useTrack(t) {
  if (S.subTrack) S.subTrack.oncuechange = null;
  S.subTrack = t || null;
  var tracks = S.video.textTracks;
  for (var i = 0; i < tracks.length; i++) if (tracks[i] !== t) tracks[i].mode = 'disabled';
  if (t) {
    // Rendu maison (au-dessus des commandes) ; en plein écran natif iPhone, le navigateur affiche lui-même.
    t.mode = S.nativeFs ? 'showing' : 'hidden';
    t.oncuechange = renderCues;
  }
  renderCues();
}
function enableSub(sub) {
  if (!sub) { S.subOn = null; useTrack(null); return; }
  if (sub.track) { S.subOn = sub; useTrack(sub.track); return; }
  var itemId = S.item.id;
  fetchSub(S.item, sub).then(function (buf) {
    if (!S.item || S.item.id !== itemId) return;
    var vtt = toVtt(decode(buf), sub.name);
    var url = URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
    var tr = document.createElement('track');
    tr.kind = 'subtitles'; tr.label = sub.label; tr.srclang = sub.lang || 'fr'; tr.src = url;
    S.video.appendChild(tr);
    sub.trackEl = tr;
    sub.track = tr.track;
    S.subOn = sub;
    useTrack(tr.track);
    tr.addEventListener('load', renderCues);
  }).catch(function (e) { toast(e.message, { type: 'error' }); });
}

/* ---------- Fonctions selon l'appareil ---------- */
function updateFeatures() {
  var v = S.video, c = S.cands[S.ci] || {};
  var hasSubs = (S.subs && S.subs.length) || (v.textTracks && v.textTracks.length);
  $('[data-pl="subs"]').hidden = !hasSubs;
  var pip = (document.pictureInPictureEnabled && !v.disablePictureInPicture) || (v.webkitSupportsPresentationMode && v.webkitSupportsPresentationMode('picture-in-picture'));
  $('[data-pl="pip"]').hidden = !pip || isTV();
  var cast = $('[data-pl="cast"]');
  if (c.via === 'sw') cast.hidden = true;
}

/* ---------- Menus (sous-titres, vitesse) ---------- */
function openMenu(kind) {
  var m = $('.pl-menu');
  var items = [];
  if (kind === 'subs') {
    items.push({ label: 'Désactivés', on: !S.subOn, fn: function () { enableSub(null); } });
    (S.subs || []).forEach(function (s) { items.push({ label: s.label + (s.name ? '' : ''), sub: s.name, on: S.subOn === s, fn: function () { enableSub(s); } }); });
    var tt = S.video.textTracks;
    for (var i = 0; i < tt.length; i++) {
      (function (t) {
        if (S.subs && S.subs.some(function (s) { return s.track === t; })) return;
        items.push({ label: t.label || t.language || 'Piste intégrée', on: S.subTrack === t, fn: function () { S.subOn = { track: t, label: t.label || 'Piste intégrée' }; useTrack(t); } });
      })(tt[i]);
    }
  } else {
    RATES.forEach(function (r) { items.push({ label: r === 1 ? 'Normale' : String(r).replace('.', ',') + '×', on: S.video.playbackRate === r, fn: function () { S.video.playbackRate = r; state.settings.rate = r; } }); });
  }
  m.innerHTML = str(html`<p class="pl-menu-title">${kind === 'subs' ? 'Sous-titres' : 'Vitesse'}</p>${items.map(function (it, i) {
    return html`<button type="button" role="menuitemradio" aria-checked="${!!it.on}" class="pl-mi${it.on ? ' on' : ''}" data-i="${i}">${it.on ? icon('check') : html`<span class="i"></span>`}<span>${it.label}</span>${it.sub ? html`<small>${it.sub}</small>` : ''}</button>`;
  })}`);
  m.hidden = false;
  m.setAttribute('data-kind', kind);
  S.menuItems = items;
  nav.pushScope(m, closeMenu);
  var on = m.querySelector('.pl-mi.on') || m.querySelector('.pl-mi');
  if (on) nav.focus(on, { scroll: false });
  showUI();
}
function closeMenu() {
  if (!S.el) return;
  var m = $('.pl-menu');
  if (m.hidden) return;
  m.hidden = true;
  nav.popScope(m);
  var b = $('[data-pl="' + (m.getAttribute('data-kind') || 'speed') + '"]');
  if (b && S.opened) nav.focus(b, { scroll: false });
}

/* ---------- Épisode suivant ---------- */
function nextEp() { return S.entity && S.entity.kind === 'show' ? nextEpisode(S.entity, S.item.id) : null; }
function showNext(sec) {
  var n = nextEp();
  if (!n) return;
  var box = $('.pl-next');
  if (!box.hidden) return;
  $('.pl-next-title').textContent = epLong(n) + (n.title ? ', ' + n.title : '');
  box.hidden = false;
  var left = Math.max(1, Math.round(sec));
  $('[data-countdown]').textContent = left;
  clearInterval(S.nextTimer);
  S.nextTimer = setInterval(function () {
    left--;
    $('[data-countdown]').textContent = Math.max(0, left);
    if (left <= 0) { clearInterval(S.nextTimer); playNext(); }
  }, 1000);
  showUI('[data-pl="next-now"]');
}
function hideNext() {
  if (!S.el) return;
  clearInterval(S.nextTimer);
  $('.pl-next').hidden = true;
}
function playNext() {
  var n = nextEp();
  hideNext();
  if (n) open(n.item.id, { replaceRoute: true, t: 0 });
}
function playPrev() {
  var p = S.entity && S.entity.kind === 'show' ? prevEpisode(S.entity, S.item.id) : null;
  if (p) open(p.item.id, { replaceRoute: true, t: 0 });
}

/* ---------- Plein écran, PiP, diffusion ---------- */
function isFs() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
function fullscreen(on) {
  var el = S.el;
  try {
    if (on) {
      if (el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).then(lockLandscape, function () {});
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else if (S.video.webkitEnterFullscreen) S.video.webkitEnterFullscreen();
    } else if (isFs()) {
      if (document.exitFullscreen) document.exitFullscreen().catch(function () {});
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
  } catch (e) { /* refusé */ }
}
function lockLandscape() {
  try { if (screen.orientation && screen.orientation.lock && isTouch()) screen.orientation.lock('landscape').catch(function () {}); } catch (e) { /* ignoré */ }
}
function pip() {
  var v = S.video;
  try {
    if (document.pictureInPictureElement) document.exitPictureInPicture();
    else if (v.requestPictureInPicture) v.requestPictureInPicture().catch(function (e) { toast('Image dans l’image refusée : ' + e.message); });
    else if (v.webkitSetPresentationMode) v.webkitSetPresentationMode(v.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture');
  } catch (e) { /* ignoré */ }
}
function cast() {
  var v = S.video;
  if (v.webkitShowPlaybackTargetPicker) { v.webkitShowPlaybackTargetPicker(); return; }
  if (v.remote && v.remote.prompt) v.remote.prompt().catch(function (e) { if (e.name !== 'AbortError') toast('Diffusion impossible : ' + e.message); });
}

function mediaSession() {
  if (!('mediaSession' in navigator)) return;
  var e = S.entity, art = e ? image(e) : '';
  try {
    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: S.ep ? epLabel(S.ep) + (S.ep.title ? ' ' + S.ep.title : '') : (e ? displayTitle(e) : S.item.name),
      artist: e ? displayTitle(e) : 'Vision',
      album: 'Vision',
      artwork: art ? [{ src: art, sizes: '640x360', type: 'image/jpeg' }] : [{ src: 'assets/icons/icon-512.png', sizes: '512x512', type: 'image/png' }]
    });
    var ms = navigator.mediaSession;
    ms.setActionHandler('play', function () { S.video.play(); });
    ms.setActionHandler('pause', function () { S.video.pause(); });
    ms.setActionHandler('seekbackward', function () { seekBy(-10); });
    ms.setActionHandler('seekforward', function () { seekBy(10); });
    ms.setActionHandler('nexttrack', nextEp() ? playNext : null);
    ms.setActionHandler('previoustrack', S.entity && S.entity.kind === 'show' && prevEpisode(S.entity, S.item.id) ? playPrev : null);
    try { ms.setActionHandler('seekto', function (d) { if (d && d.seekTime != null) seek(d.seekTime); }); } catch (err) { /* non pris en charge */ }
  } catch (err) { /* ignoré */ }
}

/* ---------- Fermeture ---------- */
function onBack() {
  if (!$('.pl-menu').hidden) return closeMenu();
  if (!$('.pl-next').hidden) { S.nextCancelled = true; return hideNext(); }
  if (isTV() && uiOn() && S.mode === 'native' && !S.video.paused && $('.pl-msg').hidden) { S.el.setAttribute('data-ui', 'off'); try { S.el.focus({ preventScroll: true }); } catch (e) { S.el.focus(); } return; }
  close();
}

/* fromRoute : la route a déjà changé (bouton Retour du navigateur). */
export function close(fromRoute) {
  if (!S.opened) return;
  save();
  S.opened = false;
  closeMenu();
  hideNext();
  clearTimeout(S.uiTimer);
  nav.popScope(S.el);
  if (document.pictureInPictureElement) { try { document.exitPictureInPicture(); } catch (e) { /* ignoré */ } }
  if (isFs()) fullscreen(false);
  try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) { /* ignoré */ }
  var el = S.el;
  irisClose(el).then(function () {
    stopMedia();
    el.hidden = true;
    el.classList.remove('shown', 'iris-out', 'need-tap');
  });
  document.documentElement.classList.remove('is-playing');
  document.title = 'Vision';
  if ('mediaSession' in navigator) { try { navigator.mediaSession.metadata = null; } catch (e) { /* ignoré */ } }
  if (!fromRoute && router.current().path.indexOf('/regarder/') === 0) router.back('/');
  window.dispatchEvent(new CustomEvent('vision:player-closed', { detail: { sel: S.returnSel, id: S.item && S.item.id } }));
  S.returnSel = null;
}

/* ---------- Événements ---------- */
function bind() {
  var v = S.video, el = S.el;
  v.addEventListener('loadedmetadata', function () {
    if (S.startAt > 0 && isFinite(v.duration) && S.startAt < v.duration - 5) { try { v.currentTime = S.startAt; } catch (e) { /* ignoré */ } }
    S.startAt = 0;
    paint();
    updateFeatures();
  });
  v.addEventListener('loadeddata', function () {
    // Codec vidéo non décodé (ex. HEVC) : le son passe mais l'image reste noire.
    setTimeout(function () {
      if (S.opened && S.mode === 'native' && v.videoWidth === 0 && v.readyState >= 2 && !/\.(mp3|m4a|aac|flac|ogg)$/i.test(S.item.name)) {
        var nextI = S.ci + 1;
        if (S.cands[nextI] && S.cands[nextI].kind === 'iframe') { toast('Image non décodée par cet appareil : bascule sur le lecteur Google Drive.'); next(nextI); }
      }
    }, 1500);
  });
  v.addEventListener('timeupdate', function () {
    paint();
    saveThrottled();
    var d = v.duration, t = v.currentTime;
    if (isFinite(d) && d > 300 && state.settings.autoNext && !S.nextCancelled && d - t <= 20 && d - t > 1 && nextEp()) showNext(d - t);
    var skip = $('.pl-skip');
    var showSkip = state.settings.skipIntro && S.entity && S.entity.kind === 'show' && t > 2 && t < 240 && d > 600;
    if (skip.hidden === !!showSkip) skip.hidden = !showSkip;
    if (!S.audioChecked && t > 6) {
      S.audioChecked = true;
      if (v.webkitAudioDecodedByteCount === 0 && v.webkitVideoDecodedByteCount > 0 && S.cands.some(function (c) { return c.kind === 'iframe'; })) {
        toast('Pas de son ? Le codec audio du fichier n’est pas lu par ce navigateur.', { action: { label: 'Lecteur Drive', fn: function () { switchTo(S.cands.map(function (c) { return c.kind; }).indexOf('iframe')); } }, timeout: 9000 });
      }
    }
  });
  v.addEventListener('progress', paint);
  v.addEventListener('play', function () { el.classList.add('is-on'); el.classList.remove('need-tap'); showUI(); });
  v.addEventListener('pause', function () { el.classList.remove('is-on'); save(); showUI(); });
  v.addEventListener('waiting', function () { spinner(true); });
  v.addEventListener('playing', function () { spinner(false); });
  v.addEventListener('canplay', function () { spinner(false); });
  v.addEventListener('error', onError);
  v.addEventListener('ended', function () {
    save();
    if (S.item) setProgress(S.item.id, v.duration || 0, v.duration || 0, { done: true });
    if (state.settings.autoNext && nextEp() && !S.nextCancelled) playNext();
    else setTimeout(function () { if (S.opened && v.ended) close(); }, 1600);
  });
  v.addEventListener('volumechange', function () {
    state.settings.volume = v.volume; state.settings.muted = v.muted;
    el.classList.toggle('is-muted', v.muted || v.volume === 0);
    $('.pl-volrange').value = v.muted ? 0 : v.volume;
    try { localStorage.setItem('vision:settings', JSON.stringify(state.settings)); } catch (e) { /* ignoré */ }
  });
  if (window.WebKitPlaybackTargetAvailabilityEvent) {
    v.addEventListener('webkitplaybacktargetavailabilitychanged', function (e) {
      var c = $('[data-pl="cast"]');
      c.hidden = e.availability !== 'available' || (S.cands[S.ci] || {}).via === 'sw';
      c.innerHTML = str(icon('airplay'));
    });
  } else if (v.remote && v.remote.watchAvailability) {
    v.remote.watchAvailability(function (avail) { $('[data-pl="cast"]').hidden = !avail || (S.cands[S.ci] || {}).via === 'sw'; }).catch(function () { /* indisponible */ });
  }
  v.addEventListener('webkitbeginfullscreen', function () { S.nativeFs = true; if (S.subTrack) S.subTrack.mode = 'showing'; });
  v.addEventListener('webkitendfullscreen', function () { S.nativeFs = false; if (S.subTrack) S.subTrack.mode = 'hidden'; });
  document.addEventListener('fullscreenchange', function () { el.classList.toggle('is-fs', isFs()); });
  document.addEventListener('webkitfullscreenchange', function () { el.classList.toggle('is-fs', isFs()); });

  el.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pl]');
    if (!b) {
      var mi = e.target.closest('.pl-mi');
      if (mi) { S.menuItems[+mi.getAttribute('data-i')].fn(); closeMenu(); return; }
      if (e.target.closest('.pl-menu')) return;
      if (!$('.pl-menu').hidden) { closeMenu(); return; }
      return;
    }
    var a = b.getAttribute('data-pl');
    if (a === 'close') close();
    else if (a === 'toggle') { toggle(); showUI(); }
    else if (a === 'rw') seekBy(-10, 'l');
    else if (a === 'ff') seekBy(10, 'r');
    else if (a === 'mute') { v.muted = !v.muted; if (!v.muted && v.volume === 0) v.volume = 0.6; }
    else if (a === 'fs') fullscreen(!isFs());
    else if (a === 'pip') pip();
    else if (a === 'cast') cast();
    else if (a === 'next' || a === 'next-now') playNext();
    else if (a === 'prev') playPrev();
    else if (a === 'next-cancel') { S.nextCancelled = true; hideNext(); }
    else if (a === 'skip-intro') { seek(v.currentTime + (+state.settings.skipIntroSec || 85)); $('.pl-skip').hidden = true; }
    else if (a === 'subs' || a === 'speed') { if (!$('.pl-menu').hidden && $('.pl-menu').getAttribute('data-kind') === a) closeMenu(); else { closeMenu(); openMenu(a); } }
    else if (a === 'switch') switchTo(+b.getAttribute('data-alt'));
  });
  $('.pl-volrange').addEventListener('input', function (e) { v.volume = +e.target.value; v.muted = v.volume === 0; });

  // Zone vidéo : souris = clic lecture/pause, double clic plein écran ; tactile = tap commandes, double tap ±10 s.
  var lastTap = 0, tapT = null;
  $('.pl-gest').addEventListener('click', function (e) {
    var z = e.target.closest('.pl-zone');
    if (!z || S.mode !== 'native') return;
    var touch = document.documentElement.getAttribute('data-input') === 'touch' || isTouch();
    var now = Date.now();
    if (!touch) {
      clearTimeout(tapT);
      if (now - lastTap < 280) { lastTap = 0; fullscreen(!isFs()); return; }
      lastTap = now;
      tapT = setTimeout(function () { toggle(); showUI(); }, 220);
      return;
    }
    var side = z.getAttribute('data-z');
    if (now - lastTap < 300 && side !== 'm') {
      clearTimeout(tapT);
      seekBy(side === 'l' ? -10 : 10, side);
      lastTap = now - 120;
      return;
    }
    lastTap = now;
    clearTimeout(tapT);
    tapT = setTimeout(function () { if (uiOn()) { S.el.setAttribute('data-ui', 'off'); } else showUI(); }, 260);
  });
  el.addEventListener('mousemove', throttle(function () { if (S.opened && !isTouch()) showUI(); }, 200));

  // Glisser sur la barre de progression.
  var scrub = $('.pl-scrub');
  function startDrag(e) {
    if (S.mode !== 'native' || !isFinite(v.duration)) return;
    S.dragging = true;
    S.dragT = scrubAt(e.clientX);
    scrub.classList.add('drag');
    tipAt(e.clientX, S.dragT);
    paint();
    if (scrub.setPointerCapture && e.pointerId != null) { try { scrub.setPointerCapture(e.pointerId); } catch (err) { /* ignoré */ } }
    e.preventDefault();
  }
  scrub.addEventListener('pointerdown', startDrag);
  scrub.addEventListener('pointermove', function (e) {
    if (!isFinite(v.duration)) return;
    var t = scrubAt(e.clientX);
    tipAt(e.clientX, t);
    if (S.dragging) { S.dragT = t; paint(); }
  });
  function endDrag() {
    if (!S.dragging) return;
    S.dragging = false;
    scrub.classList.remove('drag');
    seek(S.dragT);
    showUI();
  }
  scrub.addEventListener('pointerup', endDrag);
  scrub.addEventListener('pointercancel', endDrag);
  scrub.addEventListener('focus', function () { var r = $('.pl-rail').getBoundingClientRect(); tipAt(r.left + r.width * (v.currentTime / (v.duration || 1)), v.currentTime); });

  window.addEventListener('keydown', onKey, true);
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', function () { if (document.hidden) save(); });
}

function switchTo(i) {
  if (isNaN(i) || i < 0 || !S.cands[i]) return;
  var t = S.mode === 'native' ? S.video.currentTime : 0;
  save();
  if (S.cands[i].kind !== 'iframe') S.startAt = t;
  next(i);
}

function onKey(e) {
  if (!S.opened || e.altKey || e.ctrlKey || e.metaKey) return;
  var k = nav.keyName(e), act = document.activeElement;
  var inMenu = !$('.pl-menu').hidden && $('.pl-menu').contains(act);
  var onScrub = act === $('.pl-scrub');
  var onRoot = act === S.el || act === document.body || !S.el.contains(act);
  var stop = function () { e.preventDefault(); e.stopPropagation(); };
  if (k === 'back') { stop(); onBack(); return; }
  if (S.mode === 'iframe') return;
  if (inMenu) return; // les flèches et OK sont gérés par la navigation spatiale dans le menu
  if (k === 'playpause') { stop(); toggle(); showUI(); return; }
  if (k === 'ff') { stop(); seekBy(30, 'r', e.repeat); return; }
  if (k === 'rw') { stop(); seekBy(-30, 'l', e.repeat); return; }
  if (k === 'next') { stop(); playNext(); return; }
  if (k === 'prev') { stop(); playPrev(); return; }
  if (k === 'stop') { stop(); close(); return; }
  var shown = uiOn();
  if (k === 'left' || k === 'right') {
    if (!shown || onScrub || onRoot) { stop(); seekBy(k === 'left' ? -10 : 10, null, e.repeat); if (!shown) S.el.setAttribute('data-ui', 'on'); return; }
    return;
  }
  if (k === 'up' || k === 'down') {
    if (!shown || onRoot) { stop(); showUI(k === 'up' ? '.pl-toggle' : '.pl-scrub'); return; }
    showUI();
    return;
  }
  if (k === 'ok') {
    if (!shown || onRoot) { stop(); toggle(); showUI(); return; }
    showUI();
    return;
  }
  if (nav.isTyping(act)) return;
  var key = (e.key || '').toLowerCase();
  if (key === ' ' && (onRoot || onScrub || act.tagName !== 'BUTTON')) { stop(); toggle(); showUI(); }
  else if (key === 'k') { stop(); toggle(); showUI(); }
  else if (key === 'j') { stop(); seekBy(-10, 'l', e.repeat); }
  else if (key === 'l') { stop(); seekBy(10, 'r', e.repeat); }
  else if (key === 'f') { stop(); fullscreen(!isFs()); }
  else if (key === 'm') { stop(); S.video.muted = !S.video.muted; showUI(); }
  else if (key === 'n') { stop(); playNext(); }
  else if (key === 'p' && !e.shiftKey) { stop(); pip(); }
  else if (key === 'c') { stop(); if (S.subs && S.subs.length) { var i = S.subs.indexOf(S.subOn); enableSub(S.subs[i + 1] || null); toast(S.subOn ? 'Sous-titres : ' + S.subOn.label : 'Sous-titres désactivés'); } }
  else if (/^[0-9]$/.test(key) && isFinite(S.video.duration)) { stop(); seek(S.video.duration * (+key / 10)); showUI(); }
  else if (key === 'arrowup' || key === 'arrowdown') { /* déjà traité */ }
  void reducedMotion;
}
