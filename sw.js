/* Foultot Digital - Service Worker
   Rôle : mettre en cache la coquille de l'appli (HTML/CSS/JS/icônes) pour qu'elle
   s'ouvre hors-ligne. Les FICHIERS (photos/PDF) ne passent pas par ce cache :
   ils sont gérés par le cache local de Firestore (IndexedDB).

   v4 : la page (index.html) est chargée "réseau d'abord" (3 s max, sinon copie
   locale). La nouvelle version est mise en cache même sur réseau lent.
*/

const CACHE_NAME = "foultot-digital-shell-v4";
const NAV_TIMEOUT_MS = 3000;
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
    caches.open(CACHE_NAME).then((cache) =>
      // Un fichier manquant ne doit plus bloquer toute l'installation
      Promise.all(APP_SHELL.map((url) =>
        cache.add(new Request(url, { cache: "reload" })).catch((err) => console.warn("Non mis en cache :", url, err))
      ))
    )
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

  // Appels de DONNÉES Firebase/Firestore : jamais interceptés (Firestore gère
  // sa propre persistance hors-ligne). gstatic.com (SDK Firebase) n'est PAS
  // exclu : il doit être en cache pour démarrer hors-ligne.
  if (
    url.hostname.includes("firestore.googleapis.com") ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("firebasestorage") ||
    url.hostname.includes("firebaseapp.com")
  ) {
    return;
  }

  if (event.request.method !== "GET") return;

  // 1) La page elle-même : réseau d'abord (3 s max), sinon copie locale.
  //    La réponse réseau est mise en cache même si elle arrive après les 3 s,
  //    et on revalide auprès du serveur (pas de copie HTTP périmée).
  if (event.request.mode === "navigate" && url.origin === self.location.origin) {
    const network = fetch(event.request.url, { cache: "no-cache", credentials: "same-origin" });
    // copie pour le cache, prise AVANT que la page ne lise la réponse
    const forCache = network.then((r) => (r && r.status === 200 ? r.clone() : null));
    event.waitUntil(
      forCache
        .then((copy) => copy && caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy)))
        .catch(() => {})
    );
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), NAV_TIMEOUT_MS));
    event.respondWith(
      Promise.race([network, timeout]).catch(async () =>
        (await caches.match("./index.html")) ||
        (await caches.match("./")) ||
        network
      )
    );
    return;
  }

  // 2) Le reste (icônes, manifest, SDK Firebase) : cache d'abord, mise à jour en fond
  const isSameOrigin = url.origin === self.location.origin;
  const isGstatic = url.hostname.includes("gstatic.com");
  if (!(isSameOrigin || isGstatic)) return;

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
