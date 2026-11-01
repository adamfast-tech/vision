/* Connexion OAuth 2 avec PKCE (Dropbox, Microsoft) : fenêtre de connexion, puis échange du code dans le navigateur.
   Aucun secret : seule la clé publique de l'appli (app key / ID client) est utilisée.
   oauth.html renvoie le code par BroadcastChannel, localStorage et window.opener (selon ce que le navigateur permet). */
import { b64url } from '../core/util.js';

var CHANNEL = 'vision-oauth';

export function redirectUri() {
  return location.origin + location.pathname.replace(/[^/]*$/, '') + 'oauth.html';
}

function random(n) {
  var a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return b64url(a);
}

/* Ouvre la fenêtre tout de suite (geste de l'utilisateur), sinon le navigateur la bloque. */
export function openPopup() {
  var w = 520, h = 700;
  var left = Math.max(0, (screen.width - w) / 2), top = Math.max(0, (screen.height - h) / 2);
  return window.open('about:blank', 'vision-oauth', 'width=' + w + ',height=' + h + ',left=' + left + ',top=' + top);
}

/* opts : { popup, authUrl, params } → Promise<{ code, verifier, redirect }> */
export function authorize(opts) {
  var popup = opts.popup;
  if (!popup) return Promise.reject(new Error('Fenêtre de connexion bloquée : autorise les fenêtres surgissantes pour ce site.'));
  var verifier = random(48), state = random(16), redirect = redirectUri();
  if (!crypto.subtle) { popup.close(); return Promise.reject(new Error('Connexion impossible : ce navigateur ne gère pas le chiffrement requis (HTTPS obligatoire).')); }
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)).then(function (buf) {
    var q = new URLSearchParams(Object.assign({
      response_type: 'code',
      redirect_uri: redirect,
      code_challenge: b64url(new Uint8Array(buf)),
      code_challenge_method: 'S256',
      state: state
    }, opts.params));
    try { popup.location.href = opts.authUrl + '?' + q.toString(); } catch (e) { /* fenêtre déjà fermée */ }
    return wait(popup, state);
  }).then(function (res) {
    if (res.error) throw new Error(res.error_description || res.error);
    if (!res.code) throw new Error('Connexion annulée.');
    return { code: res.code, verifier: verifier, redirect: redirect };
  });
}

function wait(popup, state) {
  return new Promise(function (resolve, reject) {
    var done = false, bc = null, timer = null, closedSince = 0;
    function finish(data) {
      if (done || !data || data.state !== state) return;
      done = true;
      cleanup();
      try { popup.close(); } catch (e) { /* ignoré */ }
      resolve(data);
    }
    function onMsg(e) { if (e.origin === location.origin && e.data && e.data.type === CHANNEL) finish(e.data); }
    function onStorage(e) { if (e.key === CHANNEL && e.newValue) { try { finish(JSON.parse(e.newValue)); } catch (er) { /* ignoré */ } } }
    function cleanup() {
      window.removeEventListener('message', onMsg);
      window.removeEventListener('storage', onStorage);
      if (bc) bc.close();
      clearInterval(timer);
      try { localStorage.removeItem(CHANNEL); } catch (e) { /* ignoré */ }
    }
    window.addEventListener('message', onMsg);
    window.addEventListener('storage', onStorage);
    try { bc = new BroadcastChannel(CHANNEL); bc.onmessage = function (e) { finish(e.data); }; } catch (e) { bc = null; }
    timer = setInterval(function () {
      try { var v = localStorage.getItem(CHANNEL); if (v) finish(JSON.parse(v)); } catch (e) { /* ignoré */ }
      // Certaines pages de connexion coupent le lien avec la fenêtre (closed vaut alors true trop tôt) : on attend un peu.
      if (popup.closed) {
        if (!closedSince) closedSince = Date.now();
        else if (Date.now() - closedSince > 4000 && !done) { done = true; cleanup(); reject(new Error('Fenêtre de connexion fermée.')); }
      }
    }, 500);
    setTimeout(function () { if (!done) { done = true; cleanup(); reject(new Error('Connexion trop longue : réessaie.')); } }, 10 * 60 * 1000);
  });
}

/* POST application/x-www-form-urlencoded vers le point de jeton. */
export function tokenRequest(url, params) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString()
  }).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (b) {
      if (!r.ok || !b.access_token) {
        var e = new Error(b.error_description || b.error || ('Jeton refusé (' + r.status + ').'));
        e.code = 'AUTH';
        throw e;
      }
      return b;
    });
  });
}
