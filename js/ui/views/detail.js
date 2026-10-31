/* Fiche d'un film ou d'une série : visuel, résumé, reprise, saisons et épisodes. */
import { html, str, fmtDur, fmtSize, ext } from '../../core/util.js';
import { state, inList, toggleList, ratio, markWatched, getSource } from '../../core/store.js';
import { entity, displayTitle, image, playLabel, playTarget, epLabel, isDone, CATS } from '../../library/library.js';
import { seasonDetails } from '../../library/meta.js';
import { sourceLabel } from '../../providers/index.js';
import { icon, chips, genCover, coverStyle } from '../components.js';
import { refresh, heroTitle } from '../fx.js';
import * as router from '../../core/router.js';

function pad(n) { return n < 10 ? '0' + n : '' + n; }

function epRow(e, ep, extra) {
  var r = ratio(ep.item.id), done = isDone(ep.item.id);
  var t = (extra && extra.title) || ep.title || ('Épisode ' + ep.e + (ep.e2 ? ' et ' + ep.e2 : ''));
  var still = (extra && extra.still) || ep.item.thumb || '';
  var desc = (extra && extra.overview) || ep.item.overview || '';
  var sub = [ep.item.dur ? fmtDur(ep.item.dur) : '', ep.quality || '', (ep.langs || []).join(' ')].filter(Boolean).join(', ');
  return html`<button type="button" class="ep${done ? ' is-done' : ''}" data-act="play" data-key="${e.key}" data-item="${ep.item.id}" data-longpress aria-label="Lire ${epLabel(ep)}, ${t}">
    <span class="ep-num">${ep.s === 0 ? 'SP' : pad(ep.e)}</span>
    <span class="ep-media">
      ${still ? html`<img src="${still}" alt="" loading="lazy" decoding="async" data-fallback="${displayTitle(e)}">` : html`<span class="gen-cover" style="${coverStyle(displayTitle(e) + ep.e)}"></span>`}
      <span class="card-play" aria-hidden="true">${icon('play')}</span>
      ${r > 0 && r < 1 ? html`<span class="card-progress"><i style="width:${Math.round(r * 100)}%"></i></span>` : ''}
    </span>
    <span class="ep-text">
      <span class="ep-title">${t}</span>
      ${sub ? html`<span class="ep-sub">${sub}</span>` : ''}
      ${desc ? html`<span class="ep-desc">${desc}</span>` : ''}
    </span>
    ${done ? html`<span class="ep-state" title="Vu">${icon('check')}</span>` : ''}
  </button>`;
}

function seasonList(e, n, extras) {
  var s = e.seasons.filter(function (x) { return x.n === n; })[0] || e.seasons[0];
  return html`${s.eps.map(function (ep) { return epRow(e, ep, extras && extras[ep.e]); })}`;
}

function versions(e) {
  if (e.items.length < 2) return '';
  return html`<section class="detail-section"><h2 class="section-title">Versions</h2><div class="versions">${e.items.map(function (it) {
    var src = getSource(it.src);
    return html`<button type="button" class="version" data-act="play" data-key="${e.key}" data-item="${it.id}">
      ${icon('play')}<span class="v-name">${it.name}</span><span class="v-meta">${[it._q, ext(it.name).toUpperCase(), it.size ? fmtSize(it.size) : '', src ? src.name : ''].filter(Boolean).join(', ')}</span></button>`;
  })}</div></section>`;
}

function files(e) {
  var items = e.kind === 'movie' ? e.items : e.flat.map(function (x) { return x.item; });
  var srcs = Object.keys(e.srcs).map(getSource).filter(Boolean);
  var size = 0; items.forEach(function (it) { size += it.size || 0; });
  return html`<p class="detail-files">${srcs.map(function (s) { return s.name + ' (' + sourceLabel(s) + ')'; }).join(', ')}${size ? html`, ${fmtSize(size)}` : ''}${e.kind === 'movie' ? html`<br><span class="mono-soft">${e.item.name}</span>` : ''}</p>`;
}

export default {
  nav: null,
  live: true,
  title: function (ctx) { var e = entity(ctx.params.key); return e ? displayTitle(e) : 'Fiche'; },
  render: function (ctx) {
    var e = entity(ctx.params.key);
    if (!e) return html`<section class="empty"><h1 class="page-title">Titre introuvable</h1><p class="muted">Il a peut-être été déplacé ou supprimé du stockage.</p><a class="btn btn-ghost" href="#/" data-autofocus>${icon('home')}<span>Accueil</span></a></section>`;
    var m = e.meta || {};
    var t = playTarget(e) || {};
    var bg = image(e);
    var poster = m.poster || '';
    var desc = m.overview || e.desc || '';
    var seasonsReal = e.kind === 'show' ? e.seasons.filter(function (s) { return s.n > 0; }).length : 0;
    var info = [(CATS[e.cat] || {}).one, e.year, e.kind === 'show' ? (seasonsReal > 1 ? seasonsReal + ' saisons' : e.count + ' épisodes') : (e.dur ? fmtDur(e.dur) : ''), e.quality, (e.langs || []).join(' '), m.rating ? '★ ' + String(m.rating).replace('.', ',') : ''];
    var curSeason = ctx.query && ctx.query.saison != null ? +ctx.query.saison : (t.ep ? t.ep.s : (e.seasons ? (e.seasons[0] || {}).n : 1));
    var r = t.item ? ratio(t.item.id) : 0;
    return html`<article class="detail" style="${m.color ? '--tint:' + m.color : ''}">
      <div class="detail-bg" aria-hidden="true">${bg ? html`<img src="${bg}" alt="" decoding="async" data-fallback="${displayTitle(e)}">` : genCover(displayTitle(e))}<div class="detail-shade"></div></div>
      <div class="detail-top">
        <div class="detail-poster" aria-hidden="true">${poster ? html`<img src="${poster}" alt="" decoding="async">` : genCover(displayTitle(e), 'poster-gen')}</div>
        <div class="detail-main">
          ${chips(info, 'hero-chips')}
          <h1 class="detail-title" data-hero-title>${displayTitle(e)}</h1>
          ${m.title && m.title !== e.title ? html`<p class="detail-alt">${e.title}</p>` : ''}
          ${t.resume && r > 0 ? html`<p class="hero-resume"><span class="bar"><i style="width:${Math.round(r * 100)}%"></i></span>${t.ep ? epLabel(t.ep) + ', ' : ''}${Math.round(r * 100)} % vu</p>` : ''}
          ${desc ? html`<p class="detail-desc" data-clamp>${desc}</p>` : ''}
          ${m.genres && m.genres.length ? html`<p class="detail-genres">${m.genres.join(', ')}</p>` : ''}
          <div class="hero-actions">
            <button type="button" class="btn btn-play" data-nx="lustre" data-act="play-show" data-key="${e.key}" data-autofocus>${icon('play')}<span>${playLabel(e)}</span></button>
            ${t.resume ? html`<button type="button" class="btn btn-ghost" data-act="restart" data-key="${e.key}" data-item="${t.item.id}">${icon('history')}<span>Depuis le début</span></button>` : ''}
            <button type="button" class="btn-list" data-nx="pilule-enregistrer" data-key="${e.key}" data-texte-off="Ma liste" data-texte-on="Dans ma liste" ${inList(e.key) ? 'data-actif' : ''}>Ma liste</button>
            ${e.kind === 'movie' ? html`<button type="button" class="btn btn-ghost" data-act="toggle-seen" data-item="${e.item.id}">${icon('check')}<span>${isDone(e.item.id) ? 'Marquer non vu' : 'Marquer vu'}</span></button>` : ''}
          </div>
          ${files(e)}
        </div>
      </div>
      ${e.kind === 'show' ? html`<section class="detail-section seasons" data-seasons>
        ${e.seasons.length > 1 ? html`<div class="season-tabs" role="tablist" aria-label="Saisons" data-nav-row><div class="season-track" data-nav-track>
          ${e.seasons.map(function (s) { var on = s.n === curSeason; return html`<button type="button" role="tab" class="season-tab${on ? ' on' : ''}" aria-selected="${on}" data-season="${s.n}">${s.label}<span class="season-count">${s.eps.length}</span></button>`; })}
          <span class="season-ink" aria-hidden="true"></span></div></div>` : html`<h2 class="section-title">${e.seasons[0] ? e.seasons[0].label : 'Épisodes'}</h2>`}
        <div class="eps" data-eps>${seasonList(e, curSeason)}</div>
        <div class="season-actions"><button type="button" class="btn btn-ghost btn-sm" data-act="season-seen" data-key="${e.key}" data-season="${curSeason}">${icon('check')}<span>Marquer la saison comme vue</span></button></div>
      </section>` : versions(e)}
    </article>`;
  },
  mount: function (root, ctx) {
    var e = entity(ctx.params.key);
    if (!e) return function () {};
    heroTitle(root.querySelector('[data-hero-title]'));
    var cur = ctx.query && ctx.query.saison != null ? +ctx.query.saison : null;
    function ink() {
      var on = root.querySelector('.season-tab.on'), bar = root.querySelector('.season-ink');
      if (!on || !bar) return;
      bar.style.transform = 'translateX(' + on.offsetLeft + 'px)';
      bar.style.width = on.offsetWidth + 'px';
    }
    function loadExtras(n) {
      seasonDetails(e, n).then(function (extras) {
        if (!extras) return;
        var box = root.querySelector('[data-eps]');
        if (!box || (cur !== null && cur !== n)) return;
        var focusedItem = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-item');
        box.innerHTML = str(seasonList(e, n, extras));
        if (focusedItem) { var f = box.querySelector('[data-item="' + focusedItem + '"]'); if (f) f.focus({ preventScroll: true }); }
      });
    }
    if (e.kind === 'show') {
      var first = root.querySelector('.season-tab.on');
      cur = first ? +first.getAttribute('data-season') : (e.seasons[0] || {}).n;
      ink();
      loadExtras(cur);
      setTimeout(ink, 300);
    }
    function onClick(ev) {
      var tab = ev.target.closest('.season-tab');
      if (tab) {
        var n = +tab.getAttribute('data-season');
        if (n === cur) return;
        cur = n;
        Array.prototype.forEach.call(root.querySelectorAll('.season-tab'), function (b) { var on = b === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
        ink();
        var box = root.querySelector('[data-eps]');
        box.classList.add('swap');
        setTimeout(function () { box.innerHTML = str(seasonList(e, n)); box.classList.remove('swap'); loadExtras(n); }, 140);
        var sa = root.querySelector('[data-act="season-seen"]');
        if (sa) sa.setAttribute('data-season', n);
        router.setQuery(ctx.path + '?saison=' + n);
        return;
      }
      var a = ev.target.closest('[data-act]');
      if (!a) return;
      var act = a.getAttribute('data-act');
      if (act === 'toggle-seen') {
        var id = a.getAttribute('data-item');
        markWatched(id, !isDone(id));
        a.querySelector('span').textContent = isDone(id) ? 'Marquer non vu' : 'Marquer vu';
      } else if (act === 'season-seen') {
        var sn = +a.getAttribute('data-season');
        var s = e.seasons.filter(function (x) { return x.n === sn; })[0];
        if (s) s.eps.forEach(function (ep) { markWatched(ep.item.id, true); });
        var box2 = root.querySelector('[data-eps]');
        box2.innerHTML = str(seasonList(e, sn));
      }
    }
    root.addEventListener('click', onClick);
    root.addEventListener('nx:change', function (ev) {
      var b = ev.target.closest('[data-nx="pilule-enregistrer"]');
      if (b) toggleList(b.getAttribute('data-key'), !!(ev.detail && ev.detail.actif));
    });
    var clamp = root.querySelector('[data-clamp]');
    if (clamp && clamp.scrollHeight > clamp.clientHeight + 4) {
      clamp.setAttribute('tabindex', '0');
      clamp.setAttribute('role', 'button');
      clamp.setAttribute('aria-expanded', 'false');
      clamp.addEventListener('click', function () { var o = clamp.classList.toggle('open'); clamp.setAttribute('aria-expanded', o); });
      clamp.addEventListener('keydown', function (k) { if (k.key === 'Enter') clamp.click(); });
    }
    window.addEventListener('resize', ink);
    return function () { root.removeEventListener('click', onClick); window.removeEventListener('resize', ink); };
  }
};
