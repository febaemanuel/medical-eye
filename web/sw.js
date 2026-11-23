const CACHE = 'medical-eye-shell-v4';
const SHELL = [
  '/', '/assets/4/styles.css', '/assets/4/app/main.mjs', '/assets/4/app/views.mjs', '/assets/4/app/icons.mjs', '/assets/4/app/domain.mjs', '/assets/4/app/evidence.mjs', '/assets/4/data/protocolos.mjs', '/assets/4/data/treatment.mjs', '/assets/4/data/documents.mjs',
  '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png',
  '/icons/maskable-512.png', '/fonts/dm-sans.woff2',
];
const staticPaths = new Set(SHELL);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => (key.startsWith('medical-eye-shell-') || key.startsWith('ferida-em-foco-shell-')) && key !== CACHE)
      .map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate' && url.pathname === '/') {
    event.respondWith(fetch(request).catch(() => caches.match('/')));
  } else if (staticPaths.has(url.pathname) && !url.search) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
  }
});
