/* Petit magasin clé → valeur sur IndexedDB (partagé avec le service worker : base « vision », table « kv »).
   Repli en mémoire si IndexedDB est indisponible (navigation privée de certains navigateurs). */

var DB_NAME = 'vision', DB_VER = 1, STORE = 'kv';
var dbp = null, memory = {};

function open() {
  if (dbp) return dbp;
  dbp = new Promise(function (resolve, reject) {
    if (!window.indexedDB) return reject(new Error('IndexedDB absent'));
    var req;
    try { req = indexedDB.open(DB_NAME, DB_VER); } catch (e) { return reject(e); }
    req.onupgradeneeded = function () {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = function () { resolve(req.result); };
    req.onerror = function () { reject(req.error); };
    req.onblocked = function () { reject(new Error('IndexedDB bloquée')); };
  });
  dbp.catch(function () { dbp = Promise.reject(new Error('fallback')); dbp.catch(function () {}); });
  return dbp;
}

function tx(mode, fn) {
  return open().then(function (db) {
    return new Promise(function (resolve, reject) {
      var t = db.transaction(STORE, mode), st = t.objectStore(STORE), out;
      var r = fn(st);
      if (r) r.onsuccess = function () { out = r.result; };
      t.oncomplete = function () { resolve(out); };
      t.onerror = function () { reject(t.error); };
      t.onabort = function () { reject(t.error); };
    });
  });
}

export function get(key) {
  return tx('readonly', function (st) { return st.get(key); })
    .catch(function () { return memory[key]; });
}
export function set(key, value) {
  return tx('readwrite', function (st) { return st.put(value, key); })
    .catch(function () { memory[key] = value; });
}
export function del(key) {
  return tx('readwrite', function (st) { return st.delete(key); })
    .catch(function () { delete memory[key]; });
}
export function keys() {
  return tx('readonly', function (st) { return st.getAllKeys ? st.getAllKeys() : null; })
    .then(function (k) { return k || []; })
    .catch(function () { return Object.keys(memory); });
}
