/* Recherche instantanée, tolérante aux fautes et aux accents, avec recherche vocale si le navigateur la propose. */
import { html, str, debounce } from '../../core/util.js';
import { state, pushSearch, clearSearches } from '../../core/store.js';
import { search, recent } from '../../library/library.js';
import { card, icon } from '../components.js';
import { refresh } from '../fx.js';
import * as router from '../../core/router.js';
import { isTV } from '../../core/device.js';

var FILTERS = [['all', 'Tout'], ['film', 'Films'], ['serie', 'Séries'], ['anime', 'Animes'], ['autre', 'Autres']];

function results(q, cat) {
  if (!q) {
    var r = recent(18);
    return html`<h2 class="section-title">${state.searches.length ? 'Recherches récentes' : 'Ajoutés récemment'}</h2>
      ${state.searches.length ? html`<div class="recent-q">${state.searches.map(function (s) { return html`<button type="button" class="chip-btn" data-q="${s}" data-ripple>${icon('history')}<span>${s}</span></button>`; })}<button type="button" class="chip-btn ghost" data-clear>Effacer</button></div>` : ''}
      <div class="grid" data-results>${r.map(function (e) { return card(e); })}</div>`;
  }
  var list = search(q, cat).slice(0, 120);
  if (!list.length) return html`<div class="empty small"><p class="muted">Rien pour « ${q} ». Essaie un autre mot, ou vérifie l’orthographe du titre.</p></div><div class="grid" data-results></div>`;
  return html`<h2 class="section-title">${list.length} résultat${list.length > 1 ? 's' : ''}</h2><div class="grid" data-results>${list.map(function (e) { return card(e); })}</div>`;
}

export default {
  nav: 'search',
  live: true,
  title: function () { return 'Recherche'; },
  render: function (ctx) {
    var q = (ctx.query && ctx.query.q) || '', cat = (ctx.query && ctx.query.cat) || 'all';
    var Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    return html`<section class="page-head search-head">
        <label class="search-box">
          ${icon('search')}
          <input type="search" class="search-input" placeholder="Titre, saison, anime…" value="${q}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" aria-label="Rechercher un titre" ${isTV() ? '' : 'data-autofocus'}>
          ${Speech ? html`<button type="button" class="icon-btn mic" data-mic aria-label="Recherche vocale">${icon('mic')}</button>` : ''}
        </label>
        <div class="seg" role="group" aria-label="Catégorie">${FILTERS.map(function (f) {
          var on = cat === f[0];
          return html`<button type="button" class="seg-btn${on ? ' on' : ''}" aria-pressed="${on}" data-cat="${f[0]}" data-ripple>${f[1]}</button>`;
        })}</div>
      </section>
      <section class="search-results" data-zone>${results(q, cat)}</section>`;
  },
  mount: function (root, ctx) {
    var input = root.querySelector('.search-input'), zone = root.querySelector('[data-zone]');
    var q = (ctx.query && ctx.query.q) || '', cat = (ctx.query && ctx.query.cat) || 'all';
    if (isTV()) { var first = root.querySelector('.search-input'); if (first) first.setAttribute('data-autofocus', ''); }
    function update() {
      router.setQuery('/recherche' + (q || cat !== 'all' ? '?' + [q ? 'q=' + encodeURIComponent(q) : '', cat !== 'all' ? 'cat=' + cat : ''].filter(Boolean).join('&') : ''));
      zone.innerHTML = str(results(q, cat));
      refresh(zone);
    }
    var later = debounce(function () { q = input.value.trim(); update(); }, 140);
    input.addEventListener('input', later);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { pushSearch(input.value); input.blur(); var c = zone.querySelector('.card'); if (c) c.focus(); }
    });
    root.addEventListener('click', function (e) {
      var c = e.target.closest('[data-cat]');
      if (c) {
        cat = c.getAttribute('data-cat');
        Array.prototype.forEach.call(root.querySelectorAll('[data-cat]'), function (b) { var on = b === c; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
        update();
        return;
      }
      var rq = e.target.closest('[data-q]');
      if (rq) { input.value = rq.getAttribute('data-q'); q = input.value; update(); return; }
      if (e.target.closest('[data-clear]')) { clearSearches(); update(); return; }
      if (e.target.closest('.card')) pushSearch(q);
    });
    var mic = root.querySelector('[data-mic]');
    if (mic) mic.addEventListener('click', function () {
      var S = window.SpeechRecognition || window.webkitSpeechRecognition;
      var rec = new S();
      rec.lang = 'fr-FR'; rec.interimResults = true; rec.maxAlternatives = 1;
      mic.classList.add('listening');
      rec.onresult = function (ev) {
        var t = '';
        for (var i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript;
        input.value = t; q = t.trim(); update();
      };
      rec.onend = function () { mic.classList.remove('listening'); pushSearch(q); };
      rec.onerror = function () { mic.classList.remove('listening'); };
      try { rec.start(); } catch (err) { mic.classList.remove('listening'); }
    });
    return function () {};
  }
};
