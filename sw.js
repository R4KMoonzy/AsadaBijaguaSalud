// Service Worker para ASADA Bijagua de Upala
const CACHE_NAME = "asada-salud-v2";
const ASSETS_TO_CACHE = [
  "./",
  "index.html",
  "emergencia.html",
  "admin.html",
  "expediente-form.html",
  "expediente.html",
  "login-trabajador.html",
  "registro-trabajador.html",
  "estilos.css",
  "app.js",
  "firebase-config.js",
  "logo.jpg",
  "manifest.json"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn("Fallo al cachear algunos archivos:", err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  // No cachear llamadas a APIs externas de Firebase ni métodos no GET
  if (event.request.method !== "GET" || !url.origin.includes(location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Retornar caché y actualizar en segundo plano
        fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});
