const CACHE_NAME = 'nyc-food-scraps-v1';
const STATIC_ASSETS = [
  '/',
  'index.html',
  'main.js',
  'style.css',
  'manifest.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

const API_CACHE_NAME = 'nyc-food-scraps-api-v1';
const API_URL = 'https://data.cityofnewyork.us/resource/if26-z6xq.json';

// Install event - cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Handle API requests with network-first strategy
  if (url.href === API_URL) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Clone response before caching
          const responseClone = response.clone();
          caches.open(API_CACHE_NAME)
            .then(cache => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => {
          // If network fails, try cache
          return caches.match(event.request);
        })
    );
    return;
  }
  
  // Handle static assets with cache-first strategy
  if (STATIC_ASSETS.some(asset => url.pathname === asset || url.href === asset)) {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          return response || fetch(event.request);
        })
    );
    return;
  }
  
  // Default: try network first, then cache
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});