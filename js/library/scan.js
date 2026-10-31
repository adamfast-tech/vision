/* Synchronisation des stockages : liste les fichiers, met à jour la bibliothèque, puis cherche les visuels. */
import { state, saveItems, patchSource, getSource } from '../core/store.js';
import { emit } from '../core/util.js';
import * as idb from '../core/idb.js';
import { mod } from '../providers/index.js';
import { build } from './library.js';
import { enrich } from './meta.js';

var running = {};

export function isScanning(id) { return id ? !!running[id] : Object.keys(running).length > 0; }

export function scanSource(id) {
  if (running[id]) return running[id];
  var src = getSource(id);
  if (!src) return Promise.reject(new Error('Source introuvable.'));
  var m = mod(src.type);
  if (!m) return Promise.reject(new Error('Type de source inconnu : ' + src.type));
  state.scanning[id] = { found: 0, folders: 0, at: Date.now() };
  emit('scan', { id: id, phase: 'start' });
  var ctx = {
    progress: function (p) {
      state.scanning[id] = Object.assign(state.scanning[id] || {}, p);
      emit('scan', { id: id, phase: 'progress', found: p.found, folders: p.folders });
    }
  };
  var job = Promise.resolve().then(function () { return m.scan(src, ctx); }).then(function (items) {
    var regs = [];
    if (src.type === 'links') items.forEach(function (it) { if (it.kind === 'mega') regs.push(idb.set('megalink:' + src.id + ':' + it.fid, it.url)); });
    return Promise.all(regs).then(function () { return saveItems(id, items); }).then(function () { return items; });
  }).then(function (items) {
    patchSource(id, { scannedAt: Date.now(), count: items.length, error: '' });
    delete state.scanning[id];
    delete running[id];
    build();
    emit('library', { id: id });
    emit('scan', { id: id, phase: 'done', found: items.length });
    enrich();
    return items;
  }, function (err) {
    delete state.scanning[id];
    delete running[id];
    patchSource(id, { error: err.message || String(err), errorAt: Date.now() });
    emit('scan', { id: id, phase: 'error', error: err.message || String(err) });
    throw err;
  });
  running[id] = job;
  return job;
}

export function scanAll(onlyStale) {
  var hours = +state.settings.autoScanHours || 0;
  var jobs = state.sources.filter(function (s) {
    if (s.enabled === false) return false;
    if (!onlyStale) return true;
    if (!s.scannedAt) return true;
    if (s.type === 'gdrive' && s.gdrive && s.gdrive.mode === 'oauth') return false; // demande une connexion
    return hours > 0 && Date.now() - s.scannedAt > hours * 3600000;
  }).map(function (s) {
    return scanSource(s.id).catch(function (e) { return e; });
  });
  return Promise.all(jobs);
}
