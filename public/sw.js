// Mude de 'v1' para 'v2'
const CACHE_NAME = 'obravoz-v2'; 

const assets = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  // Força o novo Service Worker a assumir o controle imediatamente
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(assets);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
