/* Stockage compatible S3 : Amazon S3, Cloudflare R2, Backblaze B2, Wasabi, Scaleway, OVHcloud, MinIO, iDrive e2…
   Requêtes signées dans le navigateur (AWS Signature V4 par URL pré-signée : pas d'en-tête spécial, lecture directe).
   Le compartiment doit autoriser ce site (règle CORS). Utilise une clé en lecture seule limitée à ce compartiment. */
import { hash } from '../core/util.js';
import { isVideo, isSub, isJunk } from '../library/parse.js';
import { attachSubs } from './gdrive.js';

function enc(s) {
  return encodeURIComponent(s).replace(/[!'()*]/g, function (c) { return '%' + c.charCodeAt(0).toString(16).toUpperCase(); });
}
function hex(buf) {
  return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
}
function sha256(str) { return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)); }
function hmac(key, str) {
  var k = typeof key === 'string' ? new TextEncoder().encode(key) : key;
  return crypto.subtle.importKey('raw', k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']).then(function (ck) {
    return crypto.subtle.sign('HMAC', ck, new TextEncoder().encode(str));
  });
}

/* Région déduite de l'adresse quand elle n'est pas renseignée. */
export function conf(src) {
  var s = src.s3 || {};
  var endpoint = String(s.endpoint || '').trim().replace(/\/+$/, '');
  if (endpoint && !/^https?:\/\//i.test(endpoint)) endpoint = 'https://' + endpoint;
  var region = String(s.region || '').trim();
  if (!region) {
    var m = /s3[.-]([a-z0-9-]+)\.(?:amazonaws\.com|backblazeb2\.com|wasabisys\.com)/i.exec(endpoint) || /s3\.([a-z0-9-]+)\.(?:scw\.cloud|io\.cloud\.ovh\.net|cloud\.ovh\.net)/i.exec(endpoint);
    region = m ? m[1] : (/r2\.cloudflarestorage\.com/i.test(endpoint) ? 'auto' : 'us-east-1');
  }
  if (!endpoint) endpoint = 'https://s3.' + region + '.amazonaws.com';
  var prefix = String(s.prefix || '').trim().replace(/^\/+/, '');
  if (prefix && !/\/$/.test(prefix)) prefix += '/';
  return { endpoint: endpoint, region: region, bucket: String(s.bucket || '').trim(), prefix: prefix, key: String(s.key || '').trim(), secret: String(s.secret || '').trim() };
}

function objectUrl(c, key) {
  var path = key.split('/').map(enc).join('/');
  var u = new URL(c.endpoint);
  // Amazon : adresse par sous-domaine (sauf nom avec des points). Les autres : chemin.
  if (/amazonaws\.com$/i.test(u.hostname) && c.bucket.indexOf('.') === -1) return u.protocol + '//' + c.bucket + '.' + u.host + '/' + path;
  return c.endpoint + '/' + enc(c.bucket) + '/' + path;
}

/* URL pré-signée (AWS SigV4, en-tête host seul, contenu non signé). */
export function presign(c, url, query, expires) {
  var u = new URL(url);
  var params = Object.assign({}, query || {});
  if (!c.key) {
    var qs = Object.keys(params).sort().map(function (k) { return enc(k) + '=' + enc(params[k]); }).join('&');
    return Promise.resolve(u.origin + u.pathname + (qs ? '?' + qs : ''));
  }
  var now = new Date();
  var amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  var day = amzDate.slice(0, 8);
  var scope = day + '/' + c.region + '/s3/aws4_request';
  params['X-Amz-Algorithm'] = 'AWS4-HMAC-SHA256';
  params['X-Amz-Credential'] = c.key + '/' + scope;
  params['X-Amz-Date'] = amzDate;
  params['X-Amz-Expires'] = String(expires || 900);
  params['X-Amz-SignedHeaders'] = 'host';
  var canonQuery = Object.keys(params).sort().map(function (k) { return enc(k) + '=' + enc(params[k]); }).join('&');
  var canon = ['GET', u.pathname, canonQuery, 'host:' + u.host, '', 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  return sha256(canon).then(function (h) {
    var toSign = ['AWS4-HMAC-SHA256', amzDate, scope, hex(h)].join('\n');
    return hmac('AWS4' + c.secret, day)
      .then(function (k) { return hmac(k, c.region); })
      .then(function (k) { return hmac(k, 's3'); })
      .then(function (k) { return hmac(k, 'aws4_request'); })
      .then(function (k) { return hmac(k, toSign); })
      .then(function (sig) { return u.origin + u.pathname + '?' + canonQuery + '&X-Amz-Signature=' + hex(sig); });
  });
}

function explain(status, xml) {
  var code = (/<Code>([^<]+)<\/Code>/.exec(xml || '') || [])[1] || '';
  var msg = (/<Message>([^<]+)<\/Message>/.exec(xml || '') || [])[1] || '';
  var reg = (/<Region>([^<]+)<\/Region>/.exec(xml || '') || [])[1] || (/expecting '([^']+)'/.exec(msg) || [])[1] || '';
  if (code === 'NoSuchBucket') return 'Compartiment introuvable : vérifie son nom et l’adresse du service.';
  if (code === 'InvalidAccessKeyId') return 'Clé d’accès inconnue.';
  if (code === 'SignatureDoesNotMatch') return 'Clé secrète incorrecte (ou région erronée).';
  if (code === 'AuthorizationHeaderMalformed' || code === 'PermanentRedirect' || status === 301) return 'Mauvaise région' + (reg ? ' : indique « ' + reg + ' ».' : '.');
  if (code === 'AccessDenied' || status === 403) return 'Accès refusé : la clé doit pouvoir lister et lire ce compartiment (ou le compartiment doit être public).';
  return 'Le stockage S3 a répondu ' + status + (code ? ' (' + code + ')' : '') + (msg ? ' : ' + msg : '.');
}

function list(c, token) {
  var q = { 'list-type': '2', 'max-keys': '1000' };
  if (c.prefix) q.prefix = c.prefix;
  if (token) q['continuation-token'] = token;
  return presign(c, objectUrl(c, ''), q, 900).then(function (url) {
    return fetch(url).catch(function () {
      throw new Error('Stockage S3 injoignable depuis ce site : ajoute une règle CORS au compartiment (origine ' + location.origin + ', méthodes GET et HEAD).');
    });
  }).then(function (r) {
    return r.text().then(function (t) {
      if (!r.ok) throw new Error(explain(r.status, t));
      var doc = new DOMParser().parseFromString(t, 'application/xml');
      var pick = function (el, n) { var x = el.getElementsByTagName(n)[0]; return x ? x.textContent : ''; };
      var objs = Array.prototype.map.call(doc.getElementsByTagName('Contents'), function (el) {
        return { key: pick(el, 'Key'), size: +pick(el, 'Size') || 0, mtime: Date.parse(pick(el, 'LastModified')) || 0 };
      });
      var root = doc.documentElement;
      var trunc = /true/i.test(pick(root, 'IsTruncated'));
      return { objs: objs, next: trunc ? pick(root, 'NextContinuationToken') : '' };
    });
  });
}

export function scan(src, ctx) {
  var c = conf(src);
  if (!c.bucket) return Promise.reject(new Error('Indique le nom du compartiment (bucket).'));
  if (c.key && !c.secret) return Promise.reject(new Error('Indique la clé secrète, ou laisse les deux clés vides pour un compartiment public.'));
  var items = [], subs = [], pages = 0;
  function page(token) {
    return list(c, token).then(function (res) {
      pages++;
      res.objs.forEach(function (o) {
        if (/\/$/.test(o.key)) return;
        var rel = o.key.slice(c.prefix.length).split('/');
        var name = rel.pop(), path = rel.filter(Boolean);
        if (isVideo(name) && !isJunk(name, o.size)) {
          items.push({ id: src.id + ':' + hash(o.key), src: src.id, fid: hash(o.key), key: o.key, name: name, path: path, size: o.size, mtime: o.mtime, thumb: '' });
        } else if (isSub(name)) {
          subs.push({ fid: hash(o.key), key: o.key, name: name, path: path.join('/') });
        }
      });
      if (ctx && ctx.progress) ctx.progress({ found: items.length, folders: pages });
      return res.next && pages < 200 ? page(res.next) : null;
    });
  }
  return page('').then(function () {
    var keys = {};
    subs.forEach(function (s) { keys[s.fid] = s.key; });
    attachSubs(items, subs);
    items.forEach(function (it) { (it.subs || []).forEach(function (s) { s.key = keys[s.fid]; }); });
    return items;
  });
}

export function resolve(src, item) {
  var c = conf(src);
  return presign(c, objectUrl(c, item.key), {}, 6 * 3600);
}

export function candidates(src, item) {
  return [{ kind: 'native', via: 'direct', url: '', resolve: function () { return resolve(src, item); } }];
}

export function fetchSub(src, sub) {
  return resolve(src, { key: sub.key }).then(function (u) { return fetch(u); }).then(function (r) {
    if (!r.ok) throw new Error('Sous-titres indisponibles (' + r.status + ').');
    return r.arrayBuffer();
  });
}

export function test(src) {
  var c = conf(src);
  if (!c.bucket) return Promise.reject(new Error('Indique le nom du compartiment (bucket).'));
  if (c.key && !c.secret) return Promise.reject(new Error('Indique la clé secrète, ou laisse les deux clés vides pour un compartiment public.'));
  if (c.key && !(window.crypto && crypto.subtle)) return Promise.reject(new Error('Signature impossible : ce navigateur ne gère pas le chiffrement requis.'));
  return list(c, '');
}
