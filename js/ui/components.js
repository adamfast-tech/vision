/* Briques d'interface : icônes, couvertures générées, cartes, rangées, pastilles. */
import { html, raw, hash, fmtDur } from '../core/util.js';
import { state, ratio, inList } from '../core/store.js';
import { displayTitle, image, epLabel, epLong, playLabel, CATS } from '../library/library.js';

export function icon(name, cls) {
  return raw('<svg class="i' + (cls ? ' ' + cls : '') + '" aria-hidden="true" focusable="false"><use href="#i-' + name + '"></use></svg>');
}

/* Couverture générée quand aucun visuel n'existe : deux lumières teintées, étalonnées sarcelle et ambre. */
export function coverStyle(title) {
  var h = parseInt(hash(title).slice(0, 6), 36) || 1;
  var hues = [168, 182, 196, 206, 26, 34, 14, 330, 262];
  var a = hues[h % hues.length], b = hues[(h >> 3) % hues.length];
  if (a === b) b = (b + 40) % 360;
  var x = 15 + (h % 50), y = 10 + ((h >> 5) % 60);
  return '--ga:' + a + ';--gb:' + b + ';--gx:' + x + '%;--gy:' + y + '%';
}
export function genCover(title, cls) {
  return html`<span class="gen-cover ${cls || ''}" style="${coverStyle(title)}"><span class="gen-title">${title}</span></span>`;
}

export function media(e, opts) {
  opts = opts || {};
  var t = displayTitle(e);
  var src = opts.img || image(e, opts.prefer);
  var inner = src
    ? html`<img src="${src}" alt="" loading="lazy" decoding="async" data-fallback="${t}">`
    : genCover(t);
  return inner;
}

function badges(e, it) {
  var out = [];
  var q = (it && it._q) || e.quality;
  if (it && it.h >= 2000) q = '4K';
  else if (it && it.h >= 1000 && !q) q = 'HD';
  if (q === '4K') out.push('4K'); else if (q === '1080p' || q === '720p' || q === 'HD') out.push('HD');
  return out;
}

/* Carte d'une fiche (film, série) ou d'un épisode précis (« Continuer »). */
export function card(e, opts) {
  opts = opts || {};
  var it = opts.item || (e.kind === 'movie' ? e.item : null);
  var ep = opts.ep || null;
  var t = displayTitle(e);
  var r = it ? ratio(it.id) : 0;
  var act = opts.act || (e.kind === 'movie' || it ? 'play' : (state.settings.seriesClick === 'play' ? 'play-show' : 'open'));
  var sub = '';
  if (ep) sub = (opts.next ? 'À suivre, ' : '') + epLong(ep);
  else if (e.kind === 'show') sub = e.seasons.length > 1 ? e.seasons.filter(function (s) { return s.n > 0; }).length + ' saisons' : e.count + ' épisode' + (e.count > 1 ? 's' : '');
  else sub = [e.year, e.dur ? fmtDur(e.dur) : ''].filter(Boolean).join(', ');
  var label = (act === 'open' ? 'Ouvrir ' : 'Lire ') + t + (ep ? ', ' + epLong(ep) : '');
  var img = opts.thumb && it && it.thumb ? it.thumb : (ep && ep.item.thumb && opts.preferEp ? ep.item.thumb : '');
  var b = badges(e, it);
  return html`<div class="card-wrap${opts.cls ? ' ' + opts.cls : ''}" data-key="${e.key}">
    <button class="card" type="button" data-act="${act}" data-key="${e.key}" data-item="${it ? it.id : ''}" data-longpress aria-label="${label}">
      <span class="card-media">
        ${img ? html`<img src="${img}" alt="" loading="lazy" decoding="async" data-fallback="${t}">` : media(e)}
        ${b.length ? html`<span class="card-badges">${b.map(function (x) { return html`<b>${x}</b>`; })}</span>` : ''}
        ${inList(e.key) ? html`<span class="card-mark" title="Dans ma liste">${icon('list')}</span>` : ''}
        <span class="card-play" aria-hidden="true">${icon(act === 'open' ? 'info' : 'play')}</span>
        ${r > 0 && r < 1 ? html`<span class="card-progress"><i style="width:${Math.round(r * 100)}%"></i></span>` : ''}
        ${r >= 1 ? html`<span class="card-done" title="Vu">${icon('check')}</span>` : ''}
      </span>
      <span class="card-text">
        <span class="card-title">${t}</span>
        <span class="card-sub">${sub}</span>
      </span>
    </button>
    <button class="card-info nav-skip" type="button" tabindex="-1" data-act="open" data-key="${e.key}" aria-label="Fiche de ${t}">${icon('info')}</button>
  </div>`;
}

export function moreCard(label, route) {
  return html`<div class="card-wrap card-more-wrap"><a class="card card-more" href="#${route}"><span class="card-media"><span class="more-in">${icon('chevron-right')}<span>${label}</span></span></span><span class="card-text"><span class="card-title">${label}</span><span class="card-sub"></span></span></a></div>`;
}

export function rail(title, cards, opts) {
  opts = opts || {};
  if (!cards || !cards.length) return '';
  return html`<section class="rail${opts.cls ? ' ' + opts.cls : ''}" data-nav-row aria-label="${title}">
    <div class="rail-head">
      <h2 class="rail-title">${title}</h2>
      ${opts.route ? html`<a class="rail-all" href="#${opts.route}">Tout voir${opts.count ? html` <span>${opts.count}</span>` : ''}</a>` : ''}
    </div>
    <div class="rail-shell">
      <button class="rail-arrow prev nav-skip" type="button" tabindex="-1" aria-label="Défiler à gauche">${icon('chevron-left')}</button>
      <div class="rail-track" data-nav-track>${cards}</div>
      <button class="rail-arrow next nav-skip" type="button" tabindex="-1" aria-label="Défiler à droite">${icon('chevron-right')}</button>
    </div>
  </section>`;
}

export function chips(list, cls) {
  return html`<span class="chips ${cls || ''}">${list.filter(Boolean).map(function (c) { return html`<span class="chip">${c}</span>`; })}</span>`;
}

export function catChip(e) { return (CATS[e.cat] || {}).one || ''; }

export function playButtonLabel(e) { return playLabel(e); }
export { epLabel, epLong };
