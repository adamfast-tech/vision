/* Appairage : envoyer sa configuration (stockages, clés, réglages) à un autre appareil, ou la recevoir. */
import { html, switchAttr } from '../../core/util.js';
import { state, exportConfig, importConfig } from '../../core/store.js';
import * as pair from '../../core/pair.js';
import { scanAll } from '../../library/scan.js';
import { icon } from '../components.js';
import { noctisState, confetti } from '../fx.js';
import { toast, modal } from '../overlay.js';
import * as router from '../../core/router.js';
import qrcode from '../../../vendor/qrcode.esm.js';

var stop = null;

function qr(text) {
  try {
    var q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  } catch (e) { return ''; }
}

function appUrl() { return location.href.split('#')[0]; }

function receiveView() {
  var code = pair.newCode();
  var link = appUrl() + '#/appairer/envoyer?code=' + code;
  return html`<section class="page-head"><h1 class="page-title">Recevoir une configuration</h1>
      <p class="muted">Sur un appareil où Vision est déjà configuré, ouvre Réglages › Appareils › Envoyer, puis saisis ce code. Ou scanne le QR code avec ton téléphone.</p></section>
    <div class="pair-box" data-code="${code}">
      <div class="pair-code" aria-label="Code ${code.split('').join(' ')}">${pair.fmtCode(code).split('').map(function (ch, i) {
        return ch === ' ' ? html`<span class="gap"></span>` : html`<span class="digit" style="--i:${i}">${ch}</span>`;
      })}</div>
      <div class="pair-qr" aria-hidden="true">${qrcodeHtml(link)}</div>
      <p class="pair-status" data-status><span data-brio="radar" data-taille="28" data-label="En attente"></span><span>Connexion au relais…</span></p>
      <p class="fine">Le code expire quand tu quittes cette page. Le contenu est chiffré avec ce code avant d’être relayé par ntfy.sh.</p>
      <div class="row-actions"><button type="button" class="btn btn-ghost" data-act="new-code">${icon('refresh')}<span>Nouveau code</span></button>
      <label class="btn btn-ghost file-btn">${icon('upload')}<span>Importer un fichier de configuration</span><input type="file" accept=".json,application/json" data-import hidden></label></div>
    </div>`;
}
function qrcodeHtml(link) { var s = qr(link); return s ? { __raw: s } : ''; }

function sendView(ctx) {
  var pre = pair.cleanCode(ctx.query && ctx.query.code);
  if (!state.sources.length) return html`<section class="page-head"><h1 class="page-title">Envoyer ma configuration</h1></section>
    <section class="empty"><p class="muted">Cet appareil n’a encore aucun stockage à envoyer.</p><a class="btn btn-play" href="#/sources/ajouter" data-autofocus>${icon('plus')}<span>Ajouter un stockage</span></a></section>`;
  return html`<section class="page-head"><h1 class="page-title">Envoyer ma configuration</h1>
      <p class="muted">Sur la télé (ou l’autre appareil), ouvre Vision › Recevoir la configuration, puis saisis le code affiché.</p></section>
    <form class="pair-send" novalidate>
      ${pre ? html`<p class="pair-code small">${pair.fmtCode(pre)}</p><input type="hidden" name="code" value="${pre}">`
        : html`<div class="otp" data-brio="code-otp" data-longueur="8" data-nom="code" data-nav-own></div>`}
      <label class="toggle"><input type="checkbox" name="hist" ${switchAttr()} checked><span>Inclure l’historique de visionnage et Ma liste</span></label>
      <p class="fine">Sont envoyés : tes stockages (liens, clés API) et tes réglages de lecture. Les fichiers vidéo restent dans tes stockages.</p>
      <p class="form-error" role="alert" hidden></p>
      <div class="form-actions"><button type="submit" class="btn-submit" data-nx="soumettre" data-succes="Envoyé" data-erreur="Échec" ${pre ? 'data-autofocus' : ''}>Envoyer</button></div>
    </form>`;
}

function applyConfig(cfg) {
  var n = importConfig(cfg);
  toast(n ? n + ' stockage' + (n > 1 ? 's' : '') + ' importé' + (n > 1 ? 's' : '') + '. Synchronisation…' : 'Configuration mise à jour.', { type: 'ok' });
  confetti(window.innerWidth / 2, window.innerHeight / 2);
  scanAll(false);
  router.go('/', { replace: true });
}

export default {
  nav: 'settings',
  live: false,
  title: function (ctx) { return ctx.params.mode === 'recevoir' ? 'Recevoir une configuration' : 'Envoyer ma configuration'; },
  render: function (ctx) {
    if (!pair.supported()) return html`<section class="empty"><p class="muted">Ce navigateur ne sait pas chiffrer le transfert. Utilise Réglages › Exporter puis Importer.</p></section>`;
    return ctx.params.mode === 'recevoir' ? receiveView() : sendView(ctx);
  },
  mount: function (root, ctx) {
    if (stop) { stop(); stop = null; }
    if (ctx.params.mode === 'recevoir') {
      var box = root.querySelector('[data-code]');
      if (!box) return function () {};
      var code = box.getAttribute('data-code');
      var st = root.querySelector('[data-status] span:last-child');
      stop = pair.listen(code, function (cfg) {
        if (st) st.textContent = 'Configuration reçue.';
        var n = (cfg.sources || []).length;
        modal({
          title: 'Configuration reçue',
          body: html`<p class="modal-text">${n} stockage${n > 1 ? 's' : ''} et les réglages de lecture${cfg.progress ? ', avec l’historique' : ''}. Les importer sur cet appareil ?</p>`,
          actions: [
            { label: 'Ignorer', fn: function (c) { c(); } },
            { label: 'Importer', primary: true, fn: function (c) { c(); try { applyConfig(cfg); } catch (e) { toast(e.message, { type: 'error' }); } } }
          ]
        });
      }, function (s) {
        if (!st) return;
        if (s === 'ready') st.textContent = 'En attente de l’autre appareil…';
        else if (s === 'retry') st.textContent = 'Relais injoignable, nouvel essai…';
        else if (s === 'bad') st.textContent = 'Message reçu, mais illisible avec ce code.';
      });
      root.addEventListener('click', function (e) {
        if (e.target.closest('[data-act="new-code"]')) router.go('/appairer/recevoir', { force: true, replace: true });
      });
      var imp = root.querySelector('[data-import]');
      if (imp) imp.addEventListener('change', function () {
        var f = imp.files && imp.files[0];
        if (!f) return;
        f.text().then(function (t) { applyConfig(JSON.parse(t)); }).catch(function (e) { toast('Fichier illisible : ' + e.message, { type: 'error' }); });
      });
      return function () { if (stop) { stop(); stop = null; } };
    }
    var form = root.querySelector('.pair-send');
    if (!form) return function () {};
    form.addEventListener('brio:complet', function () { var b = form.querySelector('.btn-submit'); if (b) b.focus(); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var codeEl = form.querySelector('[name="code"]');
      var code = pair.cleanCode(codeEl ? codeEl.value : '');
      if (!code) { var inputs = form.querySelectorAll('.otp input'); code = pair.cleanCode(Array.prototype.map.call(inputs, function (i) { return i.value; }).join('')); }
      var err = form.querySelector('.form-error'), btn = form.querySelector('.btn-submit');
      err.hidden = true;
      if (code.length !== 8) { err.textContent = 'Le code fait 8 chiffres.'; err.hidden = false; return; }
      noctisState(btn, 'chargement');
      var hist = form.querySelector('[name="hist"]');
      pair.send(code, exportConfig(hist ? hist.checked : true)).then(function () {
        noctisState(btn, 'succes');
        toast('Configuration envoyée. Valide l’import sur l’autre appareil.', { type: 'ok' });
      }, function (er) {
        noctisState(btn, 'erreur');
        err.textContent = er.message; err.hidden = false;
        setTimeout(function () { noctisState(btn, 'repos'); }, 1600);
      });
    });
    return function () {};
  }
};
