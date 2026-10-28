// Service worker: app abre offline e os áudios ficam em cache depois de tocados.
const VERSION = 'reverso-v1';
const SHELL = ['/', '/index.html', '/css/style.css', '/js/app.js', '/js/audio.js', '/js/match.js', '/js/names.js',
  '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Áudios e fontes: cache primeiro. Código: rede primeiro (pega atualização), cache se offline.
  const cacheFirst = url.pathname.startsWith('/audio/') || url.hostname.includes('fonts.g');
  if (cacheFirst) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    })));
  } else if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match('/'))));
  }
});
