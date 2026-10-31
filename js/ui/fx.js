/* Animations : kit maison (anim.js / anim-fx.js / anim-pixi.js), Brio, Noctis et anime.js.
   Tout est optionnel : si une bibliothèque manque (vieux navigateur TV), l'interface reste complète. */
import { reducedMotion, lightMotion } from '../core/device.js';

function lib(name) { return window[name] || null; }

/* À appeler après chaque rendu : monte les effets déclaratifs du contenu injecté. */
export function refresh(root) {
  root = root || document;
  try { if (lib('Anim')) window.Anim.init(root); } catch (e) { /* effet ignoré */ }
  try { if (lib('Fx')) window.Fx.init(root); } catch (e) { /* effet ignoré */ }
  try { if (lib('PixiFx') && !lightMotion()) window.PixiFx.init(root); } catch (e) { /* effet ignoré */ }
  try { if (lib('Brio') && window.Brio.init) window.Brio.init(root); } catch (e) { /* effet ignoré */ }
  try { if (lib('Noctis') && window.Noctis.init) window.Noctis.init(root); } catch (e) { /* effet ignoré */ }
}

export function noctisState(el, s) {
  if (el && lib('Noctis') && window.Noctis.etat) { try { window.Noctis.etat(el, s); return true; } catch (e) { return false; } }
  return false;
}

/* Gerbe de confettis (moteur de particules de Noctis) aux couleurs de Vision. */
export function confetti(x, y) {
  if (reducedMotion() || !lib('Noctis') || !window.Noctis.particules) return;
  var colors = ['#ffb347', '#ff8a3d', '#4fd1c5', '#eaf3f2', '#ffd9a0'], list = [];
  for (var i = 0; i < 90; i++) {
    var a = (-Math.PI / 2) + (Math.random() - 0.5) * 1.9, v = 380 + Math.random() * 520;
    list.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 900, air: 0.985, vie: 1.6 + Math.random(), taille: 3 + Math.random() * 4, couleur: colors[i % colors.length], forme: i % 3 ? 'ruban' : 'carre', rot: Math.random() * 6, vrot: (Math.random() - 0.5) * 14 });
  }
  try { window.Noctis.particules(list, []); } catch (e) { /* ignoré */ }
}

/* Transition de vue (API View Transitions si présente). */
export function swap(fn) {
  if (!reducedMotion() && !lightMotion() && document.startViewTransition) {
    try {
      var t = document.startViewTransition(fn);
      if (t.ready) t.ready.catch(function () {});
      if (t.updateCallbackDone) t.updateCallbackDone.catch(function () {});
      return t.finished.catch(function () {});
    } catch (e) { /* repli */ }
  }
  fn();
  return Promise.resolve();
}

/* Titre du héros : lettres qui montent derrière un masque (anime.js), sinon fondu CSS. */
export function heroTitle(el) {
  if (!el) return;
  if (reducedMotion() || document.documentElement.classList.contains('quiet')) return;
  var A = lib('anime');
  if (!A || !A.splitText || lightMotion()) { el.classList.remove('rise'); void el.offsetWidth; el.classList.add('rise'); return; }
  try {
    var split = A.splitText(el, { words: { wrap: 'clip' } });
    A.utils.set(split.words, { y: '110%' });
    A.animate(split.words, { y: '0%', duration: 820, delay: A.stagger(55), ease: 'out(4)' });
  } catch (e) { el.classList.add('rise'); }
}

/* Écran d'ouverture : le diaphragme se dessine puis s'ouvre. ~1,2 s, passable par n'importe quelle touche. */
export function splash() {
  var el = document.getElementById('splash');
  if (!el) return Promise.resolve();
  if (reducedMotion()) { el.remove(); return Promise.resolve(); }
  return new Promise(function (resolve) {
    var done = false;
    function end() {
      if (done) return;
      done = true;
      el.classList.add('out');
      setTimeout(function () { el.remove(); }, 520);
      window.removeEventListener('keydown', end, true);
      window.removeEventListener('pointerdown', end, true);
      resolve();
    }
    window.addEventListener('keydown', end, true);
    window.addEventListener('pointerdown', end, true);
    var A = lib('anime');
    var blades = el.querySelectorAll('.ap-blade'), word = el.querySelector('.splash-word');
    if (A && A.createTimeline && A.svg && !lightMotion()) {
      try {
        var d = A.svg.createDrawable(blades);
        A.utils.set(d, { draw: '0 0' });
        var letters = A.splitText ? A.splitText(word, { chars: { wrap: 'clip' } }).chars : [];
        if (letters.length) A.utils.set(letters, { y: '115%' });
        el.classList.add('go');
        A.createTimeline({ defaults: { ease: 'out(4)' }, onComplete: function () { setTimeout(end, 180); } })
          .add(d, { draw: '0 1', duration: 620, delay: A.stagger(55) })
          .add('.ap-ring', { rotate: [0, 60], scale: [0.86, 1], duration: 700, ease: 'inOut(3)' }, '-=500')
          .add(letters, { y: '0%', duration: 560, delay: A.stagger(45) }, '-=520');
        return;
      } catch (e) { /* repli CSS */ }
    }
    el.classList.add('go', 'css');
    setTimeout(end, 1100);
  });
}

/* Signature : au lancement, la lumière du projecteur jaillit de la carte, puis l'image s'ouvre comme un diaphragme. */
export function irisOpen(rect, playerEl) {
  if (reducedMotion() || !rect) { playerEl.classList.add('shown'); return Promise.resolve(); }
  var x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
  var veil = document.createElement('div');
  veil.className = 'iris-veil';
  veil.style.setProperty('--x', x + 'px');
  veil.style.setProperty('--y', y + 'px');
  document.body.appendChild(veil);
  return new Promise(function (resolve) {
    requestAnimationFrame(function () {
      veil.classList.add('in');
      setTimeout(function () {
        playerEl.classList.add('shown', 'iris-in');
        setTimeout(function () {
          veil.remove();
          playerEl.classList.remove('iris-in');
          resolve();
        }, lightMotion() ? 380 : 620);
      }, lightMotion() ? 260 : 430);
    });
  });
}

export function irisClose(playerEl) {
  if (reducedMotion()) return Promise.resolve();
  playerEl.classList.add('iris-out');
  return new Promise(function (r) { setTimeout(r, lightMotion() ? 260 : 420); });
}

/* Animation FLIP d'une grille quand on trie ou filtre (anime.js createLayout). */
export function flip(container, mutate) {
  var A = lib('anime');
  var n = container ? container.children.length : 0;
  if (!A || !A.createLayout || reducedMotion() || lightMotion() || n > 160) { mutate(); return; }
  try {
    var layout = A.createLayout(container, { duration: 520, ease: 'out(4)', enterFrom: { opacity: 0, scale: 0.9 }, leaveTo: { opacity: 0, scale: 0.9 } });
    layout.update(mutate);
  } catch (e) { mutate(); }
}

export function vibrate(kind) {
  try { if (lib('Brio') && window.Brio.vibre) window.Brio.vibre(kind || 'leger'); } catch (e) { /* ignoré */ }
}
