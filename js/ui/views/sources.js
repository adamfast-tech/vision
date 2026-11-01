/* Stockages : liste, ajout pas à pas, modification, synchronisation, suppression. */
import { html, uid, timeAgo } from '../../core/util.js';
import { state, getSource, upsertSource, removeSource, patchSource } from '../../core/store.js';
import { PROVIDERS, mod, sourceLabel } from '../../providers/index.js';
import * as gdrive from '../../providers/gdrive.js';
import * as mega from '../../providers/mega.js';
import * as webdav from '../../providers/webdav.js';
import { openPopup, redirectUri } from '../../providers/oauth.js';
import { scanSource, isScanning } from '../../library/scan.js';
import { build } from '../../library/library.js';
import { icon } from '../components.js';
import { noctisState, confetti } from '../fx.js';
import { toast } from '../overlay.js';
import * as router from '../../core/router.js';

var CAT_OPTS = [['auto', 'Automatique'], ['film', 'Films'], ['serie', 'Séries'], ['anime', 'Animes'], ['autre', 'Autres']];
var ORIGIN = location.origin;

function status(s) {
  if (isScanning(s.id)) {
    var sc = state.scanning[s.id] || {};
    return html`<span class="src-live"><span data-brio="egaliseur" data-taille="18" data-label="Synchronisation"></span>Synchronisation${sc.found ? ', ' + sc.found + ' vidéos' : '…'}</span>`;
  }
  var bits = [sourceLabel(s)];
  if (s.count != null) bits.push(s.count + ' vidéo' + (s.count > 1 ? 's' : ''));
  bits.push(s.scannedAt ? 'synchronisé ' + timeAgo(s.scannedAt) : 'jamais synchronisé');
  return bits.join(', ');
}

function listView() {
  if (!state.sources.length) return html`<section class="page-head"><h1 class="page-title">Mes stockages</h1></section>
    <section class="empty"><p class="muted">Aucun stockage pour l’instant. Ajoute un dossier Google Drive, MEGA, un NAS ou de simples liens.</p>
    <a class="btn btn-play" data-nx="lustre" href="#/sources/ajouter" data-autofocus>${icon('plus')}<span>Ajouter un stockage</span></a></section>`;
  return html`<section class="page-head with-actions">
      <div><h1 class="page-title" data-brio-texte="leve-mots" data-declencheur="charge">Mes stockages</h1>
      <p class="page-count">${state.sources.length} source${state.sources.length > 1 ? 's' : ''}</p></div>
      <div class="head-actions">
        <a class="btn btn-play" href="#/sources/ajouter" data-autofocus>${icon('plus')}<span>Ajouter</span></a>
        <button type="button" class="btn btn-ghost" data-act="scan-all">${icon('refresh')}<span>Tout synchroniser</span></button>
      </div>
    </section>
    <div class="src-list" data-brio-cascade="fondu-haut" data-pas="60" data-declencheur="charge">${state.sources.map(function (s) {
      var p = PROVIDERS[s.type] || {};
      var m = mod(s.type) || {};
      var needAuth = s.type === 'gdrive' ? s.gdrive && s.gdrive.mode === 'oauth' && !gdrive.tokenValid(s.id) : !!(m.needsAuth && m.needsAuth(s));
      var authLabel = s.type === 'gdrive' ? 'Se connecter à Google' : m.LOGIN_LABEL;
      return html`<article class="src-card" data-id="${s.id}">
        <div class="src-ic">${icon(p.icon || 'cloud')}</div>
        <div class="src-main">
          <h3 class="src-name">${s.name}</h3>
          <p class="src-meta" data-status>${status(s)}</p>
          ${s.error ? html`<p class="src-err">${icon('info')}<span>${s.error}</span></p>` : ''}
        </div>
        <div class="src-actions">
          ${needAuth ? html`<button type="button" class="btn btn-primary btn-sm" data-act="auth">${icon('lock')}<span>${authLabel}</span></button>` : ''}
          <button type="button" class="btn-sync" data-nx="recharger" data-act="scan">Synchroniser</button>
          ${s.type !== 'demo' ? html`<a class="btn btn-ghost btn-sm" href="#/sources/modifier/${s.id}">Modifier</a>` : ''}
          <button type="button" class="btn-del" data-nx="maintien" data-duree="1100" data-succes="Supprimé" data-reset="0" data-act="remove">Maintenir pour supprimer</button>
        </div>
      </article>`;
    })}</div>
    <p class="fine">Vision lit tes fichiers directement depuis ce navigateur : aucune vidéo ne passe par un serveur tiers. Les clés et liens restent dans cet appareil (Réglages › Appareils pour les transférer).</p>`;
}

function chooser() {
  return html`<section class="page-head"><h1 class="page-title">Ajouter un stockage</h1><p class="muted">Où sont rangées tes vidéos ?</p></section>
    <div class="type-grid" data-brio-cascade="echelle" data-pas="60" data-declencheur="charge">${Object.keys(PROVIDERS).map(function (k, i) {
      var p = PROVIDERS[k];
      return html`<a class="type-card" href="#/sources/ajouter/${k}" ${i === 0 ? 'data-autofocus' : ''} data-tilt="6">
        <span class="type-ic">${icon(p.icon)}</span>
        <span class="type-name">${p.label}${k === 'gdrive' ? html` <em class="tag">conseillé</em>` : ''}</span>
        <span class="type-blurb">${p.blurb}</span>
      </a>`;
    })}</div>
    <section class="set-card other-clouds"><h2 class="section-title">iCloud, Proton Drive, Box, Amazon…</h2>
      <p class="muted small">Ces services ne laissent pas un site web lire tes fichiers : il n’existe pas d’accès direct depuis un navigateur. La passerelle gratuite rclone (sur un Mac, un PC ou un NAS allumé) les rend lisibles par Vision.</p>
      <ol class="steps">
        <li>Installe rclone (rclone.org) et ajoute ton cloud : rclone config (iCloud : type « iclouddrive » ; Proton : « protondrive » ; Box : « box »).</li>
        <li>Partage-le en WebDAV : rclone serve webdav moncloud: --addr :8080 --allow-origin "${ORIGIN}" --user moi --pass motdepasse</li>
        <li>Rends-le accessible en HTTPS (Tailscale Funnel, Cloudflare Tunnel ou le proxy de ton NAS), puis ajoute l’adresse dans WebDAV.</li>
      </ol>
      <div class="row-actions"><a class="btn btn-ghost btn-sm" href="#/sources/ajouter/webdav">${icon('folder')}<span>Ajouter une adresse WebDAV</span></a></div>
    </section>`;
}

function seg(name, opts, value) {
  return html`<div class="seg" role="radiogroup" aria-label="${name}" data-field="${name}">${opts.map(function (o) {
    var on = value === o[0];
    return html`<button type="button" class="seg-btn${on ? ' on' : ''}" role="radio" aria-checked="${on}" data-value="${o[0]}" data-ripple>${o[1]}</button>`;
  })}</div>`;
}

function field(id, label, value, opts) {
  opts = opts || {};
  if (opts.secret) return html`<div class="field" data-brio="mot-de-passe"><label for="${id}">${label}</label><input id="${id}" name="${id}" type="password" value="${value || ''}" autocomplete="off" spellcheck="false" ${opts.placeholder ? html`placeholder="${opts.placeholder}"` : ''}>${opts.hint ? html`<small class="hint">${opts.hint}</small>` : ''}</div>`;
  return html`<div class="field" data-brio="champ-flottant"><input id="${id}" name="${id}" type="${opts.type || 'text'}" value="${value || ''}" placeholder=" " autocomplete="off" spellcheck="false" ${opts.inputmode ? html`inputmode="${opts.inputmode}"` : ''}><label for="${id}">${label}</label>${opts.hint ? html`<small class="hint">${opts.hint}</small>` : ''}</div>`;
}

function guide(title, steps, open) {
  return html`<div class="guide${open ? ' is-open' : ''}" data-acc><button type="button" class="acc-head">${icon('info')}<span>${title}</span><span class="acc-icon">+</span></button>
    <div class="acc-body"><div><ol class="steps">${steps.map(function (s) { return html`<li>${s}</li>`; })}</ol></div></div></div>`;
}

function form(type, src) {
  var p = PROVIDERS[type];
  if (!p) return html`<section class="empty"><p>Type inconnu.</p></section>`;
  var editing = !!src;
  src = src || { id: '', type: type, name: '', category: 'auto' };
  var g = src.gdrive || { mode: 'key', folder: '', apiKey: '', clientId: '' };
  var body = '';
  if (type === 'gdrive') {
    body = html`
      ${seg('mode', [['key', 'Lien partagé + clé API'], ['oauth', 'Dossier privé (connexion Google)']], g.mode || 'key')}
      <div data-mode="key" ${g.mode === 'oauth' ? 'hidden' : ''}>
        <p class="muted small">Recommandé : marche sur la télé, le téléphone et l’ordinateur sans connexion. Le dossier doit être partagé à « Tous les utilisateurs disposant du lien ».</p>
      </div>
      <div data-mode="oauth" ${g.mode === 'oauth' ? '' : 'hidden'}>
        <p class="muted small">Le dossier reste privé. Il faut se reconnecter à Google environ toutes les heures, et ce mode ne fonctionne pas sur les télés sans connexion Google.</p>
      </div>
      ${field('folder', 'Lien du dossier Google Drive', g.folder, { hint: 'Exemple : https://drive.google.com/drive/folders/1AbC… (le dossier principal, Vision lit les sous-dossiers)' })}
      <div data-mode="key" ${g.mode === 'oauth' ? 'hidden' : ''}>${field('apiKey', 'Clé API Google', g.apiKey, { secret: true, placeholder: 'AIza…', hint: 'Commence par « AIza », 39 caractères.' })}</div>
      <div data-mode="oauth" ${g.mode === 'oauth' ? '' : 'hidden'}>${field('clientId', 'ID client OAuth', g.clientId, { hint: 'Se termine par .apps.googleusercontent.com' })}</div>
      ${guide('Préparer le dossier', [
        'Dans Google Drive, crée un dossier principal (par exemple « Vision ») avec des sous-dossiers Films, Séries et Animes.',
        'Séries et animes : un dossier par titre, et si tu veux un sous-dossier par saison (« Saison 1 »). Les noms comme S01E02 ou « - 12 » sont reconnus.',
        'Clic droit sur le dossier principal › Partager › Accès général : « Tous les utilisateurs disposant du lien », rôle Lecteur. Copie le lien.'
      ], !editing)}
      ${guide('Créer la clé API (5 minutes, gratuit)', [
        'Ouvre console.cloud.google.com et crée un projet (nom libre).',
        'Menu « API et services » › Bibliothèque › cherche « Google Drive API » › Activer.',
        'Menu « Identifiants » › Créer des identifiants › Clé API. Copie la clé (AIza…).',
        'Clique sur la clé › Restrictions d’application : « Sites Web » › ajoute ' + ORIGIN + '/*. Restrictions d’API : Google Drive API. Enregistre.',
        'Avec cette restriction, la clé ne fonctionne que depuis Vision. La diffusion vers un Chromecast n’envoie pas cette adresse : la lecture s’y fait depuis le téléphone ou l’ordinateur.'
      ])}
      ${guide('Mode privé : créer l’ID client OAuth', [
        'Même projet Google Cloud, Google Drive API activée.',
        '« Écran de consentement OAuth » : type Externe, renseigne le nom de l’appli, ajoute ton adresse Gmail dans « Utilisateurs test ».',
        '« Identifiants » › Créer des identifiants › ID client OAuth › Application Web. Origines JavaScript autorisées : ' + ORIGIN + '.',
        'Copie l’ID client ici. À la première connexion, Google affiche « appli non validée » : c’est normal pour une appli personnelle, choisis Continuer.'
      ])}`;
  } else if (type === 'mega') {
    body = html`${field('megaUrl', 'Lien MEGA (dossier ou fichier)', (src.mega || {}).url, { hint: 'Exemple : https://mega.nz/folder/AbCdEf#clé (lien complet, clé comprise)' })}
      ${guide('Comment ça marche', [
        'Sur mega.nz, clic droit sur le dossier › Partager › Copier le lien (avec la clé).',
        'Vision déchiffre la liste et les vidéos directement dans ton navigateur : MEGA ne voit qu’un téléchargement chiffré.',
        'Formats lus : MP4 et WebM partout, MKV selon le navigateur (Chrome et Edge sur ordinateur). Sinon, le bouton « Ouvrir dans MEGA » utilise le lecteur de MEGA.',
        'Sans compte MEGA payant, le transfert est limité (quelques Go par tranche de quelques heures).'
      ], true)}`;
  } else if (type === 'http') {
    body = html`${field('httpUrl', 'Adresse du dossier (HTTPS)', (src.http || {}).url, { type: 'url', hint: 'Exemple : https://nas.exemple.fr/videos/' })}
      ${guide('Rendre un NAS ou n’importe quel cloud lisible', [
        'Le serveur doit répondre en HTTPS (ce site est en HTTPS) et autoriser l’origine ' + ORIGIN + ' (en-tête CORS).',
        'Avec rclone, n’importe quel cloud (OneDrive, pCloud, Box, S3…) devient lisible : rclone serve http moncloud:Videos --addr :8080 --allow-origin "' + ORIGIN + '", puis un accès HTTPS (Tailscale Funnel, Cloudflare Tunnel, reverse proxy du NAS).',
        'Nginx : autoindex on; et add_header Access-Control-Allow-Origin ' + ORIGIN + ';',
        'Vision parcourt les sous-dossiers et lit les listes HTML ou JSON.'
      ], true)}`;
  } else if (type === 'links') {
    body = html`<div class="field area"><label for="linksText">Une vidéo par ligne : « Titre | lien », ou colle une liste M3U ou JSON</label>
        <textarea id="linksText" name="linksText" rows="9" spellcheck="false" placeholder="Mon film (2021) | https://exemple.fr/film.mp4&#10;Ma série S01E01 | https://www.dropbox.com/s/…/ep1.mp4?dl=0">${(src.links || {}).text || ''}</textarea></div>
      <div class="row-actions"><label class="btn btn-ghost btn-sm file-btn">${icon('upload')}<span>Importer un fichier .m3u, .json ou .txt</span><input type="file" accept=".m3u,.m3u8,.json,.txt,text/plain,application/json" data-import hidden></label></div>
      ${guide('Liens acceptés', [
        'Liens directs vers des fichiers .mp4, .webm, .mkv, ou des flux .m3u8.',
        'Dropbox (lien de partage), OneDrive (lien de partage, expérimental), Google Drive (fichier partagé), MEGA (lien de fichier).',
        'JSON : [{"title":"…","url":"…","group":"Films","show":"…","season":1,"episode":2,"poster":"…"}].'
      ], true)}`;
  } else if (type === 'dropbox') {
    var d = src.dropbox || {};
    body = html`${field('dbxKey', 'Clé de l’appli Dropbox (App key)', d.appKey, { hint: 'Une suite de 15 lettres et chiffres, page « Settings » de ton appli Dropbox.' })}
      ${field('dbxFolder', 'Dossier (chemin)', d.folder, { hint: 'Exemple : /Vidéos. Vide = tout le Dropbox (ou tout le dossier de l’appli).' })}
      ${guide('Créer l’appli Dropbox (3 minutes, gratuit)', [
        'Ouvre dropbox.com/developers/apps › Create app › Scoped access › Full Dropbox (ou App folder pour limiter l’accès à un seul dossier) › nom libre.',
        'Onglet Permissions : coche files.metadata.read et files.content.read › Submit.',
        'Onglet Settings › OAuth 2 › Redirect URIs : ajoute ' + redirectUri() + ' › Add. Laisse « Allow public clients » sur Allow.',
        'Copie l’App key ici. Aucun secret n’est demandé : la connexion se fait dans une fenêtre Dropbox, puis Vision garde un jeton d’accès en lecture seule.',
        'La connexion suit la configuration quand tu l’envoies à la télé (Réglages › Appareils).'
      ], !editing)}`;
  } else if (type === 'onedrive') {
    var od = src.onedrive || {};
    body = html`${field('odClient', 'ID client de l’appli Microsoft', od.clientId, { hint: 'Format 00000000-0000-0000-0000-000000000000 (« ID d’application (client) »).' })}
      ${field('odFolder', 'Dossier : chemin ou lien de partage', od.folder, { hint: 'Exemple : /Vidéos, ou https://1drv.ms/f/… Vide = tout le OneDrive.' })}
      ${guide('Créer l’appli Microsoft (5 minutes, gratuit)', [
        'Ouvre entra.microsoft.com (connecte-toi avec ton compte Microsoft) › Applications › Inscriptions d’applications › Nouvelle inscription.',
        'Types de comptes : « Comptes dans un annuaire organisationnel et comptes Microsoft personnels ».',
        'URI de redirection : plateforme « Application monopage (SPA) », adresse ' + redirectUri() + ' › Inscrire.',
        'Copie l’« ID d’application (client) » ici. Aucun secret n’est demandé.',
        'Microsoft limite la connexion d’un site à 24 h sans usage : au-delà, Vision te demandera de te reconnecter.'
      ], !editing)}`;
  } else if (type === 'pcloud') {
    body = html`${field('pcUrl', 'Lien public pCloud', (src.pcloud || {}).url, { type: 'url', hint: 'Exemple : https://u.pcloud.link/publink/show?code=XZ…' })}
      ${guide('Créer le lien', [
        'Sur pcloud.com, clic droit sur le dossier › Partager › Lien de téléchargement › Créer, puis copie le lien.',
        'Pas de mot de passe sur le lien : Vision ne peut pas le saisir.',
        'Avec un compte gratuit, le transfert des liens publics est limité chaque jour par pCloud.'
      ], true)}`;
  } else if (type === 'webdav') {
    var w = src.webdav || {};
    body = html`${field('davUrl', 'Adresse WebDAV ou lien de partage', w.url, { type: 'url', hint: 'Exemples : https://cloud.exemple.fr/s/AbC123 (partage Nextcloud), https://cloud.exemple.fr/remote.php/dav/files/moi/Vidéos/' })}
      ${field('davUser', 'Identifiant (facultatif)', w.user)}
      ${field('davPass', 'Mot de passe (ou mot de passe du partage)', w.pass, { secret: true, hint: 'Nextcloud : crée un mot de passe d’application (Paramètres › Sécurité).' })}
      ${guide('Adresses selon le service', [
        'Nextcloud, ownCloud : lien de partage public (…/s/…), ou https://serveur/remote.php/dav/files/IDENTIFIANT/Dossier/ avec un mot de passe d’application.',
        'Synology : paquet « WebDAV Server », port HTTPS 5006. QNAP : WebDAV dans le serveur web. kDrive, Koofr : adresse WebDAV indiquée dans leurs réglages.',
        'Le serveur doit autoriser ce site (CORS) : origine ' + ORIGIN + ', méthodes GET, PROPFIND, OPTIONS, en-têtes Authorization, Depth, Range, Content-Type. Sinon, place-le derrière rclone : rclone serve webdav distant: --allow-origin "' + ORIGIN + '".',
        'Avec un identifiant, la lecture passe par Vision dans ce navigateur (la diffusion Chromecast est alors indisponible).'
      ], true)}`;
  } else if (type === 's3') {
    var b = src.s3 || {};
    body = html`${field('s3Endpoint', 'Adresse du service (vide pour Amazon S3)', b.endpoint, { type: 'url', hint: 'R2 : https://ID.r2.cloudflarestorage.com · B2 : https://s3.eu-central-003.backblazeb2.com · Wasabi : https://s3.eu-central-1.wasabisys.com' })}
      ${field('s3Bucket', 'Compartiment (bucket)', b.bucket)}
      ${field('s3Region', 'Région (facultatif)', b.region, { hint: 'Déduite de l’adresse. Amazon : eu-west-3 pour Paris. R2 : auto.' })}
      ${field('s3Prefix', 'Dossier dans le compartiment (facultatif)', b.prefix, { hint: 'Exemple : videos/' })}
      ${field('s3Key', 'Clé d’accès (Access key ID)', b.key, { hint: 'Vide pour un compartiment public.' })}
      ${field('s3Secret', 'Clé secrète', b.secret, { secret: true })}
      ${guide('Préparer le compartiment', [
        'Crée une clé en lecture seule limitée à ce compartiment (lister et lire). Elle reste dans ce navigateur.',
        'Ajoute une règle CORS au compartiment : [{"AllowedOrigins":["' + ORIGIN + '"],"AllowedMethods":["GET","HEAD"],"AllowedHeaders":["*"],"ExposeHeaders":["Content-Length","Content-Range","ETag"]}]',
        'Lecture : liens signés valables 6 h, lus directement par l’appareil (Chromecast et AirPlay compris).'
      ], true)}`;
  } else if (type === 'demo') {
    body = html`<p class="muted">Quatre courts métrages libres de la Blender Foundation (licence CC BY), pour voir l’interface et le lecteur. Tu pourras retirer la démo ensuite.</p>`;
  }
  var defName = { gdrive: 'Mon Drive', mega: 'Mon MEGA', http: 'Mon NAS', links: 'Mes liens', demo: 'Démo', dropbox: 'Mon Dropbox', onedrive: 'Mon OneDrive', pcloud: 'Mon pCloud', webdav: 'Mon cloud', s3: 'Mon stockage S3' }[type];
  return html`<section class="page-head"><a class="back-link" href="${editing ? '#/sources' : '#/sources/ajouter'}">${icon('back')}<span>${editing ? 'Mes stockages' : 'Changer de type'}</span></a>
      <h1 class="page-title">${editing ? 'Modifier « ' + src.name + ' »' : p.label}</h1></section>
    <form class="src-form" data-src-type="${type}" data-id="${src.id}" novalidate>
      ${type !== 'demo' ? field('name', 'Nom affiché', src.name || defName) : ''}
      ${type !== 'demo' ? html`<div class="field-group"><p class="field-label">Catégorie des vidéos</p>${seg('category', CAT_OPTS, src.category || 'auto')}<small class="hint">Automatique : d’après les noms de dossiers (Films, Séries, Animes…) et de fichiers.</small></div>` : ''}
      ${body}
      <p class="form-error" role="alert" hidden></p>
      <div class="form-actions">
        <button type="submit" class="btn-submit" data-nx="soumettre" data-succes="Ajouté" data-erreur="Échec" data-autofocus>${editing ? 'Enregistrer et synchroniser' : ((type === 'gdrive' && g.mode === 'oauth') || type === 'dropbox' || type === 'onedrive' ? 'Se connecter et ajouter' : (type === 'demo' ? 'Ajouter la démo' : 'Tester et ajouter'))}</button>
        <a class="btn btn-ghost" href="#/sources">Annuler</a>
      </div>
    </form>`;
}

function readForm(f) {
  var type = f.getAttribute('data-src-type'), id = f.getAttribute('data-id');
  var prev = id ? getSource(id) : null;
  var v = function (n) { var el = f.querySelector('[name="' + n + '"]'); return el ? el.value.trim() : ''; };
  var segv = function (n) { var b = f.querySelector('[data-field="' + n + '"] .on'); return b ? b.getAttribute('data-value') : ''; };
  var src = Object.assign({}, prev || {}, { id: id || uid('s'), type: type, name: v('name') || PROVIDERS[type].label, category: segv('category') || 'auto' });
  if (!prev) src.addedAt = Date.now();
  if (type === 'gdrive') src.gdrive = { mode: segv('mode') || 'key', folder: v('folder'), apiKey: v('apiKey'), clientId: v('clientId') };
  if (type === 'mega') src.mega = { url: v('megaUrl') };
  if (type === 'http') src.http = { url: v('httpUrl') };
  if (type === 'links') src.links = { text: (f.querySelector('#linksText') || {}).value || '' };
  if (type === 'dropbox') {
    var pd = (prev && prev.dropbox) || {};
    src.dropbox = { appKey: v('dbxKey'), folder: v('dbxFolder'), refresh: pd.appKey === v('dbxKey') ? pd.refresh || '' : '' };
  }
  if (type === 'onedrive') {
    var po = (prev && prev.onedrive) || {};
    src.onedrive = { clientId: v('odClient'), folder: v('odFolder'), refresh: po.clientId === v('odClient') ? po.refresh || '' : '' };
  }
  if (type === 'pcloud') src.pcloud = { url: v('pcUrl') };
  if (type === 'webdav') src.webdav = { url: v('davUrl'), user: v('davUser'), pass: (f.querySelector('[name="davPass"]') || {}).value || '' };
  if (type === 's3') src.s3 = { endpoint: v('s3Endpoint'), bucket: v('s3Bucket'), region: v('s3Region'), prefix: v('s3Prefix'), key: v('s3Key'), secret: v('s3Secret') };
  if (type === 'demo') { src.name = 'Démo'; src.category = 'auto'; }
  return src;
}

function onSubmit(f) {
  var btn = f.querySelector('.btn-submit'), err = f.querySelector('.form-error');
  var src = readForm(f);
  var first = !state.sources.length;
  err.hidden = true;
  noctisState(btn, 'chargement');
  btn.disabled = true;
  var m = mod(src.type);
  var auth = Promise.resolve();
  if (src.type === 'gdrive' && src.gdrive.mode === 'oauth' && !gdrive.tokenValid(src.id)) auth = gdrive.signIn(src);
  else if (m.needsAuth && m.needsAuth(src)) auth = m.signIn(src, openPopup()); // fenêtre ouverte pendant le clic
  auth.then(function () { return m.test(src); }).then(function () {
    if (src.type === 'mega') return mega.register(src);
    if (src.type === 'webdav') return webdav.register(src);
  }).then(function () {
    upsertSource(src);
    noctisState(btn, 'succes');
    var r = btn.getBoundingClientRect();
    if (first) confetti(r.left + r.width / 2, r.top);
    toast('« ' + src.name + ' » ajouté. Synchronisation en cours.', { type: 'ok' });
    scanSource(src.id).then(function (items) {
      toast(items.length + ' vidéo' + (items.length > 1 ? 's' : '') + ' dans « ' + src.name + ' ».', { type: 'ok', action: { label: 'Voir', fn: function () { router.go('/'); } } });
    }, function (e) { toast(e.message, { type: 'error', timeout: 9000 }); });
    setTimeout(function () { router.go(first ? '/' : '/sources'); }, 650);
  }).catch(function (e) {
    noctisState(btn, 'erreur');
    btn.disabled = false;
    err.textContent = e.message || String(e);
    err.hidden = false;
    setTimeout(function () { noctisState(btn, 'repos'); }, 1600);
  });
}

export default {
  nav: 'sources',
  live: true,
  title: function () { return 'Mes stockages'; },
  render: function (ctx) {
    if (ctx.pattern === '/sources/ajouter') return chooser();
    if (ctx.pattern === '/sources/ajouter/:type') return form(ctx.params.type, null);
    if (ctx.pattern === '/sources/modifier/:id') { var s = getSource(ctx.params.id); return s ? form(s.type, s) : listView(); }
    return listView();
  },
  liveFilter: function (ctx) { return ctx.pattern === '/sources'; },
  mount: function (root, ctx) {
    var f = root.querySelector('.src-form');
    if (f) {
      f.addEventListener('submit', function (e) { e.preventDefault(); onSubmit(f); });
      f.addEventListener('click', function (e) {
        var b = e.target.closest('.seg-btn');
        if (!b) return;
        var group = b.parentNode;
        Array.prototype.forEach.call(group.querySelectorAll('.seg-btn'), function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
        if (group.getAttribute('data-field') === 'mode') {
          var m = b.getAttribute('data-value');
          Array.prototype.forEach.call(f.querySelectorAll('[data-mode]'), function (x) { x.hidden = x.getAttribute('data-mode') !== m; });
          var sub = f.querySelector('.btn-submit .nx-l') || f.querySelector('.btn-submit');
          if (sub && !f.getAttribute('data-id')) sub.textContent = m === 'oauth' ? 'Se connecter et ajouter' : 'Tester et ajouter';
        }
      });
      var imp = f.querySelector('[data-import]');
      if (imp) imp.addEventListener('change', function () {
        var file = imp.files && imp.files[0];
        if (!file) return;
        file.text().then(function (t) { var ta = f.querySelector('#linksText'); ta.value = (ta.value ? ta.value + '\n' : '') + t; toast('Fichier importé : ' + file.name); });
      });
      return function () {};
    }
    function card(el) { return el.closest('.src-card'); }
    root.addEventListener('click', function (e) {
      var a = e.target.closest('[data-act]');
      if (!a) return;
      var act = a.getAttribute('data-act'), c = card(a), id = c && c.getAttribute('data-id');
      if (act === 'scan-all') {
        state.sources.forEach(function (s) { scanSource(s.id).catch(function (er) { toast(s.name + ' : ' + er.message, { type: 'error' }); }); });
      } else if (act === 'scan' && id) {
        noctisState(a, 'chargement');
        scanSource(id).then(function (items) { noctisState(a, 'succes'); toast(items.length + ' vidéos dans « ' + getSource(id).name + ' ».', { type: 'ok' }); },
          function (er) { noctisState(a, 'erreur'); toast(er.message, { type: 'error', timeout: 9000 }); })
          .then(function () { setTimeout(function () { noctisState(a, 'repos'); }, 1400); });
      } else if (act === 'auth' && id) {
        var s = getSource(id), pm = mod(s.type);
        (s.type === 'gdrive' ? gdrive.signIn(s) : pm.signIn(s, openPopup())).then(function () { patchSource(id, { error: '' }); return scanSource(id); }).then(function () { toast('Connecté.', { type: 'ok' }); router.go('/sources', { force: true, replace: true }); }, function (er) { toast(er.message, { type: 'error' }); });
      }
    });
    root.addEventListener('nx:confirm', function (e) {
      var a = e.target.closest('[data-act="remove"]');
      if (!a) return;
      var c = card(a), id = c.getAttribute('data-id'), s = getSource(id);
      c.classList.add('leaving');
      setTimeout(function () {
        removeSource(id);
        build();
        toast('« ' + (s ? s.name : 'Source') + ' » retiré de Vision. Tes fichiers ne sont pas touchés.');
        router.go('/sources', { force: true, replace: true });
      }, 420);
    });
    return function () {};
  }
};

export function addDemo() {
  if (state.sources.some(function (s) { return s.type === 'demo'; })) { router.go('/'); return; }
  var src = { id: uid('demo'), type: 'demo', name: 'Démo', category: 'auto', addedAt: Date.now() };
  upsertSource(src);
  scanSource(src.id).then(function () { router.go('/', { force: true }); toast('Démo ajoutée : quatre courts métrages libres.', { type: 'ok' }); });
}

