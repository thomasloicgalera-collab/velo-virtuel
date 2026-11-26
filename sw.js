"use strict";
/* (v76) Service worker : l'application s'installe comme un logiciel et démarre sans Internet.
   - fichiers de l'application : réseau d'abord (la dernière version publiée arrive tout de suite), copie gardée en secours hors ligne ;
   - les bibliothèques (Three.js, PeerJS, html-to-image) sont depuis la v105 dans lib/, comme les autres fichiers de l'application ;
   - tout le reste (décor OpenStreetMap, IGN, serveur PeerJS) passe directement par le réseau, sans copie.
   Changer VERSION à chaque nouvelle version de l'application. */
const VERSION = "velo-v105";
const LOCAL = [
  "./", "index.html", "style.css", "manifest.webmanifest",
  "icones/apple-touch-icon.png",
  "icones/icone-192.png",
  "icones/icone-512.png",
  "icones/icone-maskable-512.png",
  "lib/three.min.js",
  "lib/peerjs.min.js",
  "lib/html-to-image.js",
  "js/chargement.js",
  "js/accueil.js",
  "js/analyse.js",
  "js/boucle-hud-son.js",
  "js/createur-seance.js",
  "js/decor.js",
  "js/demarrage.js",
  "js/formats.js",
  "js/garage.js",
  "js/performance.js",
  "js/programmes.js",
  "js/defis.js",
  "js/alertes.js",
  "js/rapport.js",
  "js/nolio.js",
  "js/groupe.js",
  "js/historique-interface.js",
  "js/modele-femme.js",
  "js/modele-homme.js",
  "js/monde3d.js",
  "js/mondes.js",
  "js/outils.js",
  "js/parcours-physique.js",
  "js/photos.js",
  "js/hud-perso.js",
  "js/hud-seance.js",
  "js/records.js",
  "js/course-semaine.js",
  "js/progression.js",
  "js/deblocage.js",
  "js/revoir-ecran2.js",
  "js/seance.js",
  "js/textures-corps.js",
  "js/tour.js",
  "js/velos.js",
];
self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await Promise.all(LOCAL.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => {})));
    self.skipWaiting();
  })());
});
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.origin !== self.location.origin) return;
  e.respondWith((async () => {
    try {
      const rep = await fetch(r);
      if (rep.ok) { const copie = rep.clone(); caches.open(VERSION).then((x) => x.put(r, copie)); }
      return rep;
    } catch (err) {
      const c = await caches.match(r, { ignoreSearch: true }) || (r.mode === "navigate" ? await caches.match("index.html") : null);
      if (c) return c;
      throw err;
    }
  })());
});
