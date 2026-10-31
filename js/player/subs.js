/* Sous-titres : SRT, ASS/SSA et VTT convertis en WebVTT pour la balise <track>. */

export function decode(buf) {
  var bytes = new Uint8Array(buf);
  var txt = '';
  try { txt = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch (e) {
    try { txt = new TextDecoder('windows-1252').decode(bytes); } catch (e2) { txt = new TextDecoder().decode(bytes); }
  }
  return txt.replace(/^﻿/, '');
}

function srtTime(t) { return t.replace(',', '.').replace(/^(\d):/, '0$1:'); }

export function srtToVtt(s) {
  var out = 'WEBVTT\n\n';
  s.replace(/\r/g, '').split(/\n{2,}/).forEach(function (block) {
    var lines = block.trim().split('\n');
    if (!lines.length) return;
    var i = /-->/.test(lines[0]) ? 0 : 1;
    var m = /(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})/.exec(lines[i] || '');
    if (!m) return;
    var text = lines.slice(i + 1).join('\n')
      .replace(/\{\\[^}]*\}/g, '')
      .replace(/<(?!\/?(b|i|u)>)[^>]+>/gi, '');
    out += srtTime(m[1]) + ' --> ' + srtTime(m[2]) + '\n' + text + '\n\n';
  });
  return out;
}

function assTime(t) {
  var m = /(\d+):(\d{2}):(\d{2})[.:](\d{2})/.exec(t);
  if (!m) return '00:00:00.000';
  return (m[1].length < 2 ? '0' : '') + m[1] + ':' + m[2] + ':' + m[3] + '.' + m[4] + '0';
}

export function assToVtt(s) {
  var lines = s.replace(/\r/g, '').split('\n'), fmt = null, out = 'WEBVTT\n\n', inEvents = false;
  lines.forEach(function (l) {
    if (/^\[Events\]/i.test(l)) { inEvents = true; return; }
    if (/^\[/.test(l)) { inEvents = false; return; }
    if (!inEvents) return;
    if (/^Format:/i.test(l)) { fmt = l.slice(7).split(',').map(function (x) { return x.trim().toLowerCase(); }); return; }
    if (!/^Dialogue:/i.test(l) || !fmt) return;
    var parts = l.slice(9).split(',');
    var head = parts.slice(0, fmt.length - 1), text = parts.slice(fmt.length - 1).join(',');
    var st = head[fmt.indexOf('start')], en = head[fmt.indexOf('end')];
    var clean = text.replace(/\{[^}]*\}/g, '').replace(/\\N/gi, '\n').replace(/\\h/g, ' ').trim();
    if (!clean) return;
    out += assTime(st) + ' --> ' + assTime(en) + '\n' + clean.replace(/</g, '&lt;') + '\n\n';
  });
  return out;
}

export function toVtt(text, name) {
  if (/^WEBVTT/.test(text.trim())) return text;
  if (/\.(ass|ssa)$/i.test(name || '') || /^\[Script Info\]/m.test(text)) return assToVtt(text);
  return srtToVtt(text);
}
