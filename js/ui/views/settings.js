/* Réglages : affichage, lecture, visuels, synchronisation, appareils, données. */
import { html, downloadFile, switchAttr } from '../../core/util.js';
import { state, setSetting, clearProgress, exportConfig, importConfig, clearMeta, resetAll } from '../../core/store.js';
import { apply as applyDevice, detect } from '../../core/device.js';
import { enrich, testTmdb } from '../../library/meta.js';
import { build } from '../../library/library.js';
import { scanAll } from '../../library/scan.js';
import { icon } from '../components.js';
import { toast } from '../overlay.js';
import { noctisState } from '../fx.js';
import * as router from '../../core/router.js';

var DEVICE_NAMES = { tv: 'Télé', desktop: 'Ordinateur', tablet: 'Tablette', mobile: 'Téléphone' };
export var VERSION = '1.0.0';

function seg(key, opts) {
  var v = String(state.settings[key]);
  return html`<div class="seg" role="radiogroup" aria-label="${key}" data-setting="${key}">${opts.map(function (o) {
    var on = v === String(o[0]);
    return html`<button type="button" class="seg-btn${on ? ' on' : ''}" role="radio" aria-checked="${on}" data-value="${o[0]}" data-ripple>${o[1]}</button>`;
  })}</div>`;
}
function toggle(key, label, hint) {
  return html`<label class="toggle"><input type="checkbox" ${switchAttr()} data-toggle="${key}" ${state.settings[key] ? 'checked' : ''}><span>${label}${hint ? html`<small>${hint}</small>` : ''}</span></label>`;
}
function row(label, control, hint) {
  return html`<div class="set-row"><div class="set-label">${label}${hint ? html`<small>${hint}</small>` : ''}</div><div class="set-ctl">${control}</div></div>`;
}

export default {
  nav: 'settings',
  live: false,
  title: function () { return 'Réglages'; },
  render: function () {
    var det = DEVICE_NAMES[detect()] || 'Ordinateur';
    return html`<section class="page-head"><h1 class="page-title" data-brio-texte="leve-mots" data-declencheur="charge">Réglages</h1></section>
    <div class="settings">
      <section class="set-card" aria-labelledby="s-aff"><h2 id="s-aff" class="section-title">Affichage</h2>
        ${row('Interface', seg('device', [['auto', 'Auto (' + det + ')'], ['tv', 'Télé'], ['desktop', 'Ordinateur'], ['tablet', 'Tablette'], ['mobile', 'Téléphone']]), 'Mode Télé : grands caractères, navigation aux flèches de la télécommande.')}
        ${row('Animations', seg('motion', [['auto', 'Auto'], ['full', 'Complètes'], ['reduced', 'Réduites']]))}
        ${toggle('heroRotate', 'Faire défiler les titres en haut de l’accueil')}
        ${toggle('splash', 'Animation d’ouverture')}
      </section>

      <section class="set-card" aria-labelledby="s-lec"><h2 id="s-lec" class="section-title">Lecture</h2>
        ${row('Lecteur', seg('player', [['auto', 'Automatique'], ['native', 'Vision d’abord'], ['drive', 'Google Drive d’abord']]), 'Automatique : le lecteur Vision, puis celui de Google Drive si le format (MKV, AVI…) n’est pas lu par l’appareil.')}
        ${row('Clic sur une série', seg('seriesClick', [['fiche', 'Ouvrir la fiche'], ['play', 'Lancer l’épisode suivant']]))}
        ${toggle('autoNext', 'Enchaîner l’épisode suivant')}
        ${toggle('autoResume', 'Reprendre là où je me suis arrêté')}
        ${toggle('skipIntro', 'Bouton « Passer l’intro » sur les séries et animes')}
        ${row('Durée de l’intro', seg('skipIntroSec', [[60, '60 s'], [75, '75 s'], [85, '85 s'], [90, '90 s'], [120, '2 min']]))}
        ${toggle('subsAuto', 'Activer les sous-titres trouvés à côté de la vidéo')}
        ${row('Langue des sous-titres', seg('subsLang', [['fr', 'Français'], ['en', 'Anglais'], ['any', 'Le premier trouvé']]))}
        ${toggle('fsOnPlay', 'Plein écran au lancement sur téléphone et tablette')}
        ${toggle('tvFullscreen', 'Plein écran automatique sur la télé', 'Au premier appui sur OK.')}
      </section>

      <section class="set-card" aria-labelledby="s-vis"><h2 id="s-vis" class="section-title">Affiches et résumés</h2>
        ${toggle('anilist', 'Animes : visuels et résumés AniList (sans clé)', 'Le titre des animes est envoyé à AniList pour trouver la fiche.')}
        <div class="field" data-brio="mot-de-passe"><label for="tmdbKey">Clé API TMDB (films et séries, gratuite)</label><input id="tmdbKey" type="password" value="${state.settings.tmdbKey || ''}" autocomplete="off" spellcheck="false" placeholder="Clé v3 ou jeton de lecture v4"><small class="hint">Compte gratuit sur themoviedb.org › Paramètres › API. Les titres de tes vidéos sont envoyés à TMDB.</small></div>
        <div class="row-actions">
          <button type="button" class="btn-submit" data-nx="soumettre" data-succes="Clé valide" data-erreur="Refusée" data-act="tmdb-save">Enregistrer la clé</button>
          <button type="button" class="btn btn-ghost btn-sm" data-act="meta-refresh">${icon('refresh')}<span>Rechercher à nouveau les visuels</span></button>
        </div>
        ${state.settings.tmdbKey ? html`<p class="fine">Ce produit utilise l’API TMDB mais n’est ni approuvé ni certifié par TMDB.</p>` : ''}
      </section>

      <section class="set-card" aria-labelledby="s-syn"><h2 id="s-syn" class="section-title">Synchronisation</h2>
        ${row('Relire les stockages', seg('autoScanHours', [[0, 'À la demande'], [6, 'Toutes les 6 h'], [12, 'Toutes les 12 h'], [24, 'Chaque jour']]), 'À l’ouverture de Vision, si la dernière lecture est plus ancienne.')}
        <div class="row-actions"><a class="btn btn-ghost btn-sm" href="#/sources">${icon('cloud')}<span>Mes stockages</span></a>
        <button type="button" class="btn btn-ghost btn-sm" data-act="scan-all">${icon('refresh')}<span>Tout synchroniser maintenant</span></button></div>
      </section>

      <section class="set-card" aria-labelledby="s-app"><h2 id="s-app" class="section-title">Appareils</h2>
        <p class="muted small">Configure Vision une fois sur ton téléphone, puis envoie tout à la télé avec un code : pas besoin de taper une clé à la télécommande.</p>
        <div class="row-actions">
          <a class="btn btn-primary" href="#/appairer/envoyer">${icon('tvpair')}<span>Envoyer à un appareil</span></a>
          <a class="btn btn-ghost" href="#/appairer/recevoir">${icon('download')}<span>Recevoir une configuration</span></a>
        </div>
        <div class="row-actions">
          <button type="button" class="btn btn-ghost btn-sm" data-act="export">${icon('download')}<span>Exporter (fichier)</span></button>
          <label class="btn btn-ghost btn-sm file-btn">${icon('upload')}<span>Importer un fichier</span><input type="file" accept=".json,application/json" data-import hidden></label>
          <button type="button" class="btn btn-ghost btn-sm" data-act="install" hidden>${icon('download')}<span>Installer l’appli</span></button>
        </div>
      </section>

      <section class="set-card" aria-labelledby="s-don"><h2 id="s-don" class="section-title">Données</h2>
        <p class="muted small">L’historique, Ma liste, les clés et les liens restent dans ce navigateur. Rien n’est envoyé ailleurs, sauf les titres pour les affiches si tu l’actives.</p>
        <div class="row-actions">
          <button type="button" data-nx="maintien" data-duree="1200" data-succes="Historique effacé" data-act="clear-progress">Maintenir pour effacer l’historique</button>
          <button type="button" data-nx="maintien" data-duree="1800" data-succes="Réinitialisé" data-act="reset">Maintenir pour tout réinitialiser</button>
        </div>
        <p class="fine">Vision ${VERSION}. Lecture directe depuis tes stockages, sans serveur intermédiaire.</p>
      </section>
    </div>`;
  },
  mount: function (root) {
    root.addEventListener('click', function (e) {
      var b = e.target.closest('.seg-btn');
      if (b && b.parentNode.hasAttribute('data-setting')) {
        var key = b.parentNode.getAttribute('data-setting'), raw = b.getAttribute('data-value');
        var val = /^\d+$/.test(raw) ? +raw : raw;
        Array.prototype.forEach.call(b.parentNode.querySelectorAll('.seg-btn'), function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
        setSetting(key, val);
        if (key === 'device' || key === 'motion') applyDevice();
        if (key === 'seriesClick') build();
        return;
      }
      var a = e.target.closest('[data-act]');
      if (!a) return;
      var act = a.getAttribute('data-act');
      if (act === 'tmdb-save') {
        var k = (root.querySelector('#tmdbKey').value || '').trim();
        if (!k) { setSetting('tmdbKey', ''); toast('Clé TMDB retirée.'); return; }
        noctisState(a, 'chargement');
        testTmdb(k).then(function () {
          setSetting('tmdbKey', k);
          noctisState(a, 'succes');
          toast('Clé TMDB enregistrée. Recherche des affiches…', { type: 'ok' });
          enrich(true);
        }, function (er) { noctisState(a, 'erreur'); toast(er.message, { type: 'error' }); })
          .then(function () { setTimeout(function () { noctisState(a, 'repos'); }, 1600); });
      } else if (act === 'meta-refresh') {
        clearMeta().then(function () { build(); enrich(true); toast('Recherche des affiches relancée.'); });
      } else if (act === 'scan-all') {
        scanAll(false); toast('Synchronisation lancée.');
      } else if (act === 'export') {
        downloadFile('vision-config.json', JSON.stringify(exportConfig(true), null, 2));
        toast('Fichier exporté. Il contient tes clés : garde-le pour toi.');
      } else if (act === 'install' && window.__visionInstall) {
        window.__visionInstall.prompt();
      }
    });
    root.addEventListener('change', function (e) {
      var t = e.target.closest('[data-toggle]');
      if (t) { setSetting(t.getAttribute('data-toggle'), t.checked); return; }
      var imp = e.target.closest('[data-import]');
      if (imp && imp.files && imp.files[0]) {
        imp.files[0].text().then(function (txt) {
          var n = importConfig(JSON.parse(txt));
          toast(n + ' stockage(s) ajouté(s). Synchronisation…', { type: 'ok' });
          scanAll(false);
          router.go('/');
        }).catch(function (er) { toast('Fichier illisible : ' + er.message, { type: 'error' }); });
      }
    });
    root.addEventListener('nx:confirm', function (e) {
      var a = e.target.closest('[data-act]');
      if (!a) return;
      if (a.getAttribute('data-act') === 'clear-progress') { clearProgress(); toast('Historique effacé.'); }
      if (a.getAttribute('data-act') === 'reset') {
        resetAll().then(function () { location.hash = '#/'; location.reload(); });
      }
    });
    var inst = root.querySelector('[data-act="install"]');
    if (inst && window.__visionInstall) inst.hidden = false;
    return function () {};
  }
};
