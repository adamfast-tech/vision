/* Films, Séries, Animes, Autres vidéos, Ma liste : grille triable, filtrable par genre, rendue par paquets. */
import { html, str } from '../../core/util.js';
import { state } from '../../core/store.js';
import { byCat, myList, sortEntities, genresOf, CATS } from '../../library/library.js';
import { card, icon } from '../components.js';
import { flip, refresh } from '../fx.js';
import * as router from '../../core/router.js';

var PAGE = 60;
var SORTS = [['recent', 'Récents'], ['az', 'A à Z'], ['year', 'Année']];

function source(cat) { return cat === 'liste' ? myList() : byCat(cat); }

export function makeCategory(cat) {
  var titles = { liste: 'Ma liste' };
  var title = titles[cat] || CATS[cat].label;
  var list = [], shown = 0, io = null;

  function filtered(q) {
    var l = source(cat);
    if (q.genre) l = l.filter(function (e) { return e.meta && e.meta.genres && e.meta.genres.indexOf(q.genre) !== -1; });
    return sortEntities(l, q.tri || (cat === 'liste' ? 'none' : 'recent'));
  }

  return {
    nav: cat,
    live: true,
    title: function () { return title; },
    render: function (ctx) {
      var q = ctx.query || {};
      var all = source(cat);
      list = filtered(q);
      shown = Math.min(PAGE, list.length);
      var genres = genresOf(all);
      if (!all.length) {
        return html`<section class="page-head"><h1 class="page-title">${title}</h1></section>
          <section class="empty">${cat === 'liste'
            ? html`<p class="muted">Ta liste est vide. Sur une fiche, choisis « Ma liste » pour la retrouver ici.</p><a class="btn btn-ghost" href="#/" data-autofocus>${icon('home')}<span>Retour à l’accueil</span></a>`
            : html`<p class="muted">Aucun titre dans cette catégorie. Vision range les vidéos d’après les dossiers : nomme un dossier « ${title} » dans ton stockage, ou force la catégorie dans les réglages de la source.</p><a class="btn btn-ghost" href="#/sources" data-autofocus>${icon('cloud')}<span>Mes stockages</span></a>`}</section>`;
      }
      return html`<section class="page-head">
          <h1 class="page-title" data-brio-texte="leve-mots" data-declencheur="charge">${title}</h1>
          <p class="page-count">${all.length} titre${all.length > 1 ? 's' : ''}</p>
        </section>
        <div class="toolbar" role="toolbar" aria-label="Tri et filtres">
          ${cat !== 'liste' ? html`<div class="seg" role="group" aria-label="Trier">${SORTS.map(function (s) {
            var on = (q.tri || 'recent') === s[0];
            return html`<button type="button" class="seg-btn${on ? ' on' : ''}" aria-pressed="${on}" data-sort="${s[0]}" data-ripple>${s[1]}</button>`;
          })}</div>` : ''}
          ${genres.length ? html`<div class="seg seg-scroll" role="group" aria-label="Genre">
            <button type="button" class="seg-btn${!q.genre ? ' on' : ''}" aria-pressed="${!q.genre}" data-genre="" data-ripple>Tous les genres</button>
            ${genres.map(function (g) { var on = q.genre === g; return html`<button type="button" class="seg-btn${on ? ' on' : ''}" aria-pressed="${on}" data-genre="${g}" data-ripple>${g}</button>`; })}
          </div>` : ''}
          <button type="button" class="btn btn-ghost btn-sm" data-act="shuffle-cat" data-cat="${cat}">${icon('shuffle')}<span>Au hasard</span></button>
        </div>
        <div class="grid" data-grid>${list.slice(0, shown).map(function (e) { return card(e); })}</div>
        <div class="grid-sentinel" data-sentinel></div>`;
    },
    mount: function (root, ctx) {
      var grid = root.querySelector('[data-grid]');
      if (!grid) return function () {};
      var q = Object.assign({}, ctx.query || {});
      function more() {
        if (shown >= list.length) return;
        var next = list.slice(shown, shown + PAGE);
        shown += next.length;
        var tmp = document.createElement('div');
        tmp.innerHTML = str(html`${next.map(function (e) { return card(e); })}`);
        while (tmp.firstChild) grid.appendChild(tmp.firstChild);
        refresh(grid);
      }
      var sentinel = root.querySelector('[data-sentinel]');
      if ('IntersectionObserver' in window && sentinel) {
        io = new IntersectionObserver(function (ents) { if (ents[0].isIntersecting) more(); }, { rootMargin: '900px 0px' });
        io.observe(sentinel);
      }
      // Au clavier, arriver sur la dernière ligne charge la suite.
      grid.addEventListener('focusin', function (ev) {
        var wraps = grid.children, last = wraps[wraps.length - 1];
        var w = ev.target.closest('.card-wrap');
        if (w && last && Array.prototype.indexOf.call(wraps, w) > wraps.length - 12) more();
      });
      function apply() {
        var path = ctx.path + '?' + Object.keys(q).filter(function (k) { return q[k]; }).map(function (k) { return k + '=' + encodeURIComponent(q[k]); }).join('&');
        router.setQuery(path.replace(/\?$/, ''));
        list = filtered(q);
        shown = Math.min(PAGE, list.length);
        flip(grid, function () {
          grid.innerHTML = str(html`${list.slice(0, shown).map(function (e) { return card(e); })}`);
        });
        refresh(grid);
      }
      root.addEventListener('click', function (ev) {
        var s = ev.target.closest('[data-sort]'), g = ev.target.closest('[data-genre]');
        if (!s && !g) return;
        var group = (s || g).parentNode;
        Array.prototype.forEach.call(group.querySelectorAll('.seg-btn'), function (b) { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); });
        (s || g).classList.add('on');
        (s || g).setAttribute('aria-pressed', 'true');
        if (s) q.tri = s.getAttribute('data-sort');
        if (g) q.genre = g.getAttribute('data-genre');
        apply();
      });
      return function () { if (io) io.disconnect(); };
    }
  };
}
