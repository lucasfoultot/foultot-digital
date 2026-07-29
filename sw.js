/* Foultot Digital - Service Worker
   Rôle : mettre en cache la coquille de l'appli (HTML/CSS/JS/icônes) pour qu'elle
   s'ouvre instantanément et fonctionne hors-ligne. Les FICHIERS (photos/PDF) ne
   passent pas par ce cache : ils sont gérés à part dans IndexedDB par app.
*/

const CACHE_NAME = "foultot-digital-shell-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
  "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js",
  "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js"
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

  // On ne touche jamais aux appels de DONNÉES Firebase/Firestore/Storage : ils
  // doivent passer directement par le réseau (ou échouer proprement si
  // hors-ligne, Firestore gère déjà sa propre persistance).
  // ATTENTION : gstatic.com n'est PAS exclu ici, car c'est de là que vient le
  // SDK Firebase lui-même (fichiers JS statiques) — il doit être mis en cache
  // comme le reste de l'app shell, sinon l'app ne peut même pas démarrer
  // Firebase hors-ligne.
  if (
    url.hostname.includes("firestore.googleapis.com") ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("firebasestorage") ||
    url.hostname.includes("firebaseapp.com")
  ) {
    return;
  }

  // Requêtes GET du même domaine (app shell) OU du CDN gstatic (SDK Firebase)
  const isSameOrigin = url.origin === self.location.origin;
  const isGstatic = url.hostname.includes("gstatic.com");
  if (event.request.method !== "GET" || !(isSameOrigin || isGstatic)) {
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
