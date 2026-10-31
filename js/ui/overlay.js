/* Notifications (toasts) et fenêtres modales, compatibles télécommande. */
import { html, str, on } from '../core/util.js';
import * as nav from '../core/nav.js';
import { icon } from './components.js';
import { refresh } from './fx.js';

export function toast(msg, opts) {
  opts = opts || {};
  var root = document.getElementById('toasts');
  if (!root) return;
  var el = document.createElement('div');
  el.className = 'toast' + (opts.type ? ' ' + opts.type : '');
  el.setAttribute('role', opts.type === 'error' ? 'alert' : 'status');
  el.innerHTML = str(html`<span class="toast-ic">${icon(opts.type === 'error' ? 'info' : opts.type === 'ok' ? 'check' : 'spark')}</span><span class="toast-msg">${msg}</span>${opts.action ? html`<button type="button" class="toast-act">${opts.action.label}</button>` : ''}`);
  if (opts.action) el.querySelector('.toast-act').addEventListener('click', function () { opts.action.fn(); close(); });
  root.appendChild(el);
  requestAnimationFrame(function () { el.classList.add('in'); });
  var t = setTimeout(close, opts.timeout || (opts.action ? 7000 : 4200));
  function close() {
    clearTimeout(t);
    el.classList.remove('in');
    el.classList.add('out');
    setTimeout(function () { el.remove(); }, 400);
  }
  return close;
}
on('toast', function (d) { if (d && d.msg) toast(d.msg, d); });

/* Fenêtre modale : { title, body (html), actions: [{ label, primary, danger, fn(close) }], onClose } */
export function modal(o) {
  var root = document.getElementById('modal-root');
  var prev = document.activeElement;
  var wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = str(html`<div class="modal-back" data-close></div>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-head"><h2 id="modal-title">${o.title || ''}</h2>
        <button type="button" class="icon-btn" data-close aria-label="Fermer">${icon('close')}</button></div>
      <div class="modal-body">${o.body || ''}</div>
      ${o.actions && o.actions.length ? html`<div class="modal-actions">${o.actions.map(function (a, i) {
        return html`<button type="button" class="btn ${a.primary ? 'btn-primary' : a.danger ? 'btn-danger' : 'btn-ghost'}" data-i="${i}" ${a.autofocus || (a.primary && !o.noAutofocus) ? 'data-autofocus' : ''}>${a.label}</button>`;
      })}</div>` : ''}
    </div>`);
  root.appendChild(wrap);
  var main = document.getElementById('app-main');
  if (main) main.setAttribute('aria-hidden', 'true');
  requestAnimationFrame(function () { wrap.classList.add('in'); });
  var closed = false;
  function close(v) {
    if (closed) return;
    closed = true;
    nav.popScope(wrap);
    wrap.classList.remove('in');
    wrap.classList.add('out');
    if (main) main.removeAttribute('aria-hidden');
    setTimeout(function () { wrap.remove(); }, 300);
    if (prev && prev.focus && document.contains(prev)) { try { prev.focus({ preventScroll: true }); } catch (e) { prev.focus(); } }
    if (o.onClose) o.onClose(v);
  }
  Array.prototype.forEach.call(wrap.querySelectorAll('[data-close]'), function (b) { b.addEventListener('click', function () { close(); }); });
  Array.prototype.forEach.call(wrap.querySelectorAll('.modal-actions [data-i]'), function (b) {
    b.addEventListener('click', function () { var a = o.actions[+b.getAttribute('data-i')]; if (a.fn) a.fn(close, wrap); else close(); });
  });
  nav.pushScope(wrap, function () { close(); });
  refresh(wrap);
  setTimeout(function () { nav.focusFirst(wrap); }, 60);
  if (o.mount) o.mount(wrap, close);
  return { el: wrap, close: close };
}

export function confirm(title, text, okLabel, danger) {
  return new Promise(function (resolve) {
    modal({
      title: title,
      body: html`<p class="modal-text">${text}</p>`,
      actions: [
        { label: 'Annuler', fn: function (c) { c(); resolve(false); } },
        { label: okLabel || 'Confirmer', primary: !danger, danger: danger, autofocus: true, fn: function (c) { c(); resolve(true); } }
      ],
      onClose: function () { resolve(false); }
    });
  });
}
