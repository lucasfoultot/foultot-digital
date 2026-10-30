/* Foultot Digital - Service Worker
   Rôle : mettre en cache la coquille de l'appli (HTML/CSS/JS/icônes) pour qu'elle
   s'ouvre hors-ligne. Les FICHIERS (photos/PDF) ne passent pas par ce cache :
   ils sont gérés par le cache local de Firestore (IndexedDB).

   v3 : la page (index.html) est chargée "réseau d'abord" (3 s max, sinon copie
   locale) -> une nouvelle version mise en ligne arrive dès la 1re ouverture.
*/

const CACHE_NAME = "foultot-digital-shell-v3";
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
        cache.add(url).catch((err) => console.warn("Non mis en cache :", url, err))
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

function networkWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    fetch(request).then((res) => { clearTimeout(timer); resolve(res); },
                        (err) => { clearTimeout(timer); reject(err); });
  });
}

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

  // 1) La page elle-même : réseau d'abord (3 s max), sinon copie locale
  if (event.request.mode === "navigate" && url.origin === self.location.origin) {
    event.respondWith(
      networkWithTimeout(event.request, NAV_TIMEOUT_MS)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", clone));
          }
          return response;
        })
        .catch(async () =>
          (await caches.match("./index.html")) ||
          (await caches.match("./")) ||
          Response.error()
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
