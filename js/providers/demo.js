/* Bibliothèque de démonstration : films libres de la Blender Foundation (licence CC BY),
   servis par le dépôt d'exemples public de Google. Sert à essayer Vision sans rien configurer. */

var BASE = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/';
var CREDIT = 'Film libre de la Blender Foundation, licence CC BY.';
var FILMS = [
  { f: 'BigBuckBunny', t: 'Big Buck Bunny', y: 2008, d: 596, o: 'Un lapin géant et paisible se venge des trois rongeurs qui martyrisent les habitants de sa forêt.' },
  { f: 'Sintel', t: 'Sintel', y: 2010, d: 888, o: 'Une jeune femme traverse des terres hostiles à la recherche du bébé dragon qu’elle avait recueilli.' },
  { f: 'TearsOfSteel', t: 'Tears of Steel', y: 2012, d: 734, o: 'À Amsterdam, une équipe de scientifiques tente de sauver le monde d’une armée de robots en rejouant un souvenir.' },
  { f: 'ElephantsDream', t: 'Elephants Dream', y: 2006, d: 653, o: 'Deux hommes arpentent une machine infinie et changeante ; l’un d’eux s’en croit le maître.' }
];

export function scan(src) {
  var items = [];
  FILMS.forEach(function (m, i) {
    if (i < 3) items.push(make(src, 'f' + i, m, ['Films'], m.t + ' (' + m.y + ').mp4'));
  });
  ['ElephantsDream', 'BigBuckBunny', 'Sintel', 'TearsOfSteel'].forEach(function (k, i) {
    var m = FILMS.filter(function (x) { return x.f === k; })[0];
    var it = make(src, 'e' + i, m, ['Séries', 'Courts métrages libres', 'Saison 1'], 'Courts métrages libres S01E0' + (i + 1) + ' ' + m.t + '.mp4');
    it.epTitle = m.t;
    items.push(it);
  });
  return Promise.resolve(items);
}

function make(src, id, m, path, name) {
  return {
    id: src.id + ':' + id,
    src: src.id,
    fid: id,
    name: name,
    url: BASE + m.f + '.mp4',
    path: path,
    size: 0,
    dur: m.d,
    mtime: Date.UTC(m.y, 0, 1),
    thumb: BASE + 'images/' + m.f + '.jpg',
    overview: m.o + ' ' + CREDIT,
    w: 1280, h: 720
  };
}

export function streamUrl(src, item) { return item.url; }
export function test() { return Promise.resolve(true); }
