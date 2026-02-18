const CACHE_NAME = 'uon-grid-v2.1';
const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/about.html',
  '/tournaments.html',
  '/leaderboard.html',
  '/blog.html',
  '/community.html',
  '/join.html',
  '/profile.html',
  '/css/variables.css',
  '/css/style.css',
  '/css/responsive.css',
  '/css/blog.css',
  '/js/main.js',
  '/js/firebase-config.js',
  '/js/home.js',
  '/js/blog.js'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching files');
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  // Network first, fall back to cache strategy
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        return caches.match(event.request);
      })
  );
});