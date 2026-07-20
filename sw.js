/* Foultot Digital - Service Worker
   Rôle : mettre en cache la coquille de l'appli (HTML/CSS/JS/icônes) pour qu'elle
   s'ouvre instantanément et fonctionne hors-ligne. Les FICHIERS (photos/PDF) ne
   passent pas par ce cache : ils sont gérés à part dans IndexedDB par app.
*/

const CACHE_NAME = "foultot-digital-shell-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // On ne touche jamais aux appels Firebase/Firestore/Storage : ils doivent
  // passer directement par le réseau (ou échouer proprement si hors-ligne,
  // Firestore gère déjà sa propre persistance).
  if (
    url.hostname.includes("firestore.googleapis.com") ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("firebasestorage") ||
    url.hostname.includes("firebaseapp.com") ||
    url.hostname.includes("gstatic.com")
  ) {
    return;
  }

  // Seulement les requêtes GET du même domaine (l'app shell)
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
