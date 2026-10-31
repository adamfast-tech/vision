/* Routes en #/… (compatible GitHub Pages, bouton Retour du téléphone et de la télécommande).
   Chaque entrée d'historique garde sa profondeur dans l'appli : Retour ne sort jamais de Vision par erreur. */
var routes = [], handler = null, lastHash = null;

export function route(pattern, view) {
  var keys = [];
  var re = new RegExp('^' + pattern.replace(/\//g, '\\/').replace(/:(\w+)/g, function (_, k) { keys.push(k); return '([^/?]+)'; }) + '\\/?$');
  routes.push({ re: re, keys: keys, view: view, pattern: pattern });
}

export function parse(hash) {
  var h = String(hash == null ? location.hash : hash).replace(/^#/, '') || '/';
  var qi = h.indexOf('?'), path = qi === -1 ? h : h.slice(0, qi), query = {};
  if (qi !== -1) h.slice(qi + 1).split('&').forEach(function (kv) {
    if (!kv) return;
    var p = kv.split('=');
    try { query[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || '').replace(/\+/g, ' ')); } catch (e) { /* ignoré */ }
  });
  for (var i = 0; i < routes.length; i++) {
    var m = routes[i].re.exec(path);
    if (m) {
      var params = {};
      routes[i].keys.forEach(function (k, j) { try { params[k] = decodeURIComponent(m[j + 1]); } catch (e) { params[k] = m[j + 1]; } });
      return { path: path, params: params, query: query, view: routes[i].view, pattern: routes[i].pattern, hash: '#' + h };
    }
  }
  return { path: path, params: {}, query: query, view: null, pattern: null, hash: '#' + h };
}

export function current() { return parse(location.hash); }
function depth() { return (history.state && history.state.vd) || 0; }

var lastDepth = 0;
function fire(reason) {
  // Lien <a href="#/…"> ou adresse tapée : l'entrée n'a pas de profondeur, on la numérote.
  if (!history.state || history.state.vd == null) history.replaceState({ vd: lastDepth + 1 }, '', location.hash || '#/');
  lastDepth = depth();
  if (location.hash === lastHash && reason !== 'force') return;
  lastHash = location.hash;
  if (handler) handler(parse(location.hash), reason);
}

export function go(path, opts) {
  opts = opts || {};
  var target = '#' + path;
  if (location.hash === target && !opts.force) return;
  if (opts.replace) history.replaceState({ vd: depth() }, '', target);
  else history.pushState({ vd: depth() + 1 }, '', target);
  fire(opts.force ? 'force' : (opts.replace ? 'replace' : 'push'));
}

/* Met à jour l'adresse sans recharger la vue (filtres, recherche). */
export function setQuery(path) {
  var target = '#' + path;
  history.replaceState({ vd: depth() }, '', target);
  lastHash = location.hash;
}

export function canGoBack() { return depth() > 0; }

export function back(fallback) {
  if (depth() > 0) history.back();
  else go(fallback || '/', { replace: true });
}

export function start(fn) {
  handler = fn;
  if (!history.state || history.state.vd == null) history.replaceState({ vd: 0 }, '', location.hash || '#/');
  lastDepth = depth();
  window.addEventListener('popstate', function () { fire('pop'); });
  window.addEventListener('hashchange', function () { fire('hash'); });
  fire('start');
}
