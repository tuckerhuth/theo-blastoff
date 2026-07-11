// Cache-first service worker so the game works offline once visited
// (registered only on the deployed site — see main.js).

// Keep in lockstep with GAME_VERSION in js/store.js.
const VERSION = 'blastoff-v24';

const PRECACHE = [
  '.',
  'index.html',
  'css/game.css',
  'js/main.js', 'js/engine.js', 'js/ui.js', 'js/input.js', 'js/audio.js',
  'js/store.js', 'js/tasks.js', 'js/levels.js', 'js/fx.js', 'js/voice.js',
  'js/themes/index.js', 'js/themes/rocket.js', 'js/themes/knight.js', 'js/themes/knight-scene.js',
  'assets/fonts/fredoka-latin.woff2',
  'manifest.webmanifest',
  ...['n1','n2','n3','n4','n5','n6','n7','n8','n9','n10',
      'after1','after2','after3','after4','after5','after6','after7','after8','after9','after10',
      'hello','countup','countdown','whatnext','whatfirst','countingup','countingdown',
      'watchme','yourturn','ready',
      'blastoff','great1','great2','great3','mission','onemore','alldone','taptoplay','allaboard']
    .map(n => `assets/voice/${n}.m4a`),
  ...['hello','countdown','allaboard','blastoff','great1','onemore','alldone']
    .map(n => `assets/voice/knight/${n}.m4a`),
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit =>
      hit || fetch(e.request).then(res => {
        if (res.ok && e.request.method === 'GET' && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(e.request, copy));
        }
        return res;
      })
    )
  );
});
