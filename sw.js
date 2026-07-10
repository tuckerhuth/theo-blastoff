// Cache-first service worker so the game works offline once visited
// (registered only on the deployed site — see main.js).

// Keep in lockstep with GAME_VERSION in js/store.js.
const VERSION = 'blastoff-v14';

const PRECACHE = [
  '.',
  'index.html',
  'css/game.css',
  'js/main.js', 'js/engine.js', 'js/ui.js', 'js/input.js', 'js/audio.js',
  'js/store.js', 'js/tasks.js', 'js/levels.js', 'js/fx.js', 'js/voice.js',
  'js/themes/rocket.js',
  'assets/fonts/fredoka-latin.woff2',
  'manifest.webmanifest',
  ...['n1','n2','n3','n4','n5','n6','n7','n8','n9','n10',
      'hello','countup','countdown','whatnext','whatfirst','watchme','yourturn','ready',
      'blastoff','great1','great2','great3','mission','onemore','alldone','taptoplay','allaboard']
    .map(n => `assets/voice/${n}.m4a`),
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
