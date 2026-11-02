"use strict";
/* =====================================================================
   Monde 3D (Three.js) : route qui suit le profil du parcours, relief,
   décor, ombres, cycliste animé et caméra à la troisième personne.
   ===================================================================== */
const Monde3D = (function () {
  const PAS = 5;                 // distance entre deux coupes de terrain (m)
  const N_SEC = 150;             // nombre de coupes affichées (750 m)
  const DERRIERE = 12;           // coupes gardées derrière le cycliste
  // (v69) terrain élargi jusqu'à 1,7 km de chaque côté pour la vue lointaine (PORTEE)
  const COLS = [-1700, -1100, -700, -420, -260, -160, -100, -62, -38, -22, -12, -6, -3.5, 0, 3.5, 6, 12, 22, 38, 62, 100, 160, 260, 420, 700, 1100, 1700];
  const NC = COLS.length;
  const DEMI = 3.5;              // demi-largeur de la route (m)
  const N_ARBRES = 2 * 96 + 2 * 48 + 2 * 90;   // (v69) + bande d'arbres lointains
  const PORTEE = 2.2;            // (v69) distance de vue : brouillard et horizon repoussés (×2,2), mesuré à plus de 60 images/s en 2K
  const N_BUISSONS = 2 * 64;
  const N_ROCHERS = 2 * 28;
  const N_POTEAUX = 2 * 36;
  const N_MAISONS = 10;
  const SUN = (function () { const x = -0.7, y = 0.55, z = -0.25, n = Math.hypot(x, y, z); return { x: x / n, y: y / n, z: z / n }; })();

  const THEMES = {
    campagne: {
      nom: "Campagne et collines",
      cielHaut: 0x4a9be0, cielHorizon: 0xd9ecf7, brume: 0xd9ecf7, fogProche: 150, fogLoin: 620, soleil: 0xfff0d6,
      herbe1: 0x7dbd4c, herbe2: 0x5fa43e, champ: 0xdccb62, champ2: 0xa3d160, clair: 0xb4e06a,
      accotement: 0xa39d8b, roche: 0x8e9094, neige: 0xffffff, sol: 0x7aa05a,
      arbres: [0x3f9b3b, 0x56ae46, 0x2f8a4d, 0x6bb84a, 0x4c9f3f], conifere: false, ligne: "pointille",
      mur: 0xf2ead8, toit: 0xc4553d,
      amplitude: 38, largeur: 150, pic: 1, densite: 0.85, limiteArbres: 1e9, rochers: 0.3, poussiere: 0xd2c6a6
    },
    // Ardennes (v68) : forêt dense de feuillus et de sapins, clairières et prés de fauche, brume du matin, villages de pierre grise aux toits d'ardoise,
    // ruisseau qui longe la route dans les vallées (foretA, ruisseau, route.ardennes)
    ardennes: {
      nom: "Forêt des Ardennes",
      cielHaut: 0x6f9fc9, cielHorizon: 0xdfe7ea, brume: 0xd4dde0, fogProche: 75, fogLoin: 470, soleil: 0xfff0d8,
      herbe1: 0x5f9c43, herbe2: 0x4a8536, champ: 0x8fae4f, champ2: 0x3d5a2c, clair: 0x86b55a,
      accotement: 0x8a8478, roche: 0x76787a, neige: 0xffffff, sol: 0x587a45,
      arbres: [0x2f6e3a, 0x3b7f42, 0x24563a, 0x4a8a45, 0x1e4d33], conifere: false, ardennes: true, ligne: "pointille",
      mur: 0xa8a399, toit: 0x3a3f47,
      amplitude: 55, largeur: 170, pic: 1.2, densite: 1.0, limiteArbres: 1e9, rochers: 0.35, poussiere: 0xb8b0a0
    },
    // Toscane (v68) : collines dorées en damier (blé, prés, terre labourée), cyprès en allées, vignes en rangs, oliveraies, fermes ocre aux toits de tuiles,
    // lumière chaude de fin d'après-midi ; secteurs de chemin blanc (route.secteurs) dessinés sur la route
    toscane: {
      nom: "Collines de Toscane",
      cielHaut: 0x5a8fd0, cielHorizon: 0xf3dcb6, brume: 0xefd9b4, fogProche: 170, fogLoin: 780, soleil: 0xffd59e,
      herbe1: 0xb3ae5c, herbe2: 0x9da450, champ: 0xe8c650, champ2: 0x6a9a3a, clair: 0xcdbf78,
      accotement: 0xc6b697, roche: 0xb9a98a, neige: 0xffffff, sol: 0xa8995c,
      arbres: [0x5f7a3c, 0x6c8546, 0x4e6b36, 0x7a8f50], conifere: false, toscane: true, ligne: "pointille",
      mur: 0xe0c79c, toit: 0xb5603a,
      amplitude: 45, largeur: 210, pic: 1.1, densite: 0.3, limiteArbres: 1e9, rochers: 0.12, poussiere: 0xe6d9bd
    },
    // Ville de nuit (v68, critérium) : centre-ville éclairé, immeubles aux fenêtres allumées, lampadaires et halos sur la chaussée, barrières et public
    // tout le long du circuit ; toujours de nuit (MOMENTS.nuit), pas d'arbres ni d'herbe
    ville: {
      nom: "Ville de nuit",
      cielHaut: 0x050b1c, cielHorizon: 0x2a2440, brume: 0x161a28, fogProche: 80, fogLoin: 460, soleil: 0x9fb2dc,
      herbe1: 0x3e4148, herbe2: 0x373a40, champ: 0x45484f, champ2: 0x33363c, clair: 0x464950,
      accotement: 0x77736d, roche: 0x6b6b6b, neige: 0xffffff, sol: 0x3a3d44,
      arbres: [0x2f5d3a, 0x3a6b42], conifere: false, villeN: true, nuit: true, ligne: "pointille",
      mur: 0xc9c2b4, toit: 0x4a4d55,
      amplitude: 0, largeur: 150, pic: 1, densite: 0, limiteArbres: 1e9, rochers: 0, poussiere: 0x8a8a8a
    },
    montagne: {
      nom: "Montagne",
      cielHaut: 0x2f78cf, cielHorizon: 0xdbe9f4, brume: 0xdbe9f4, fogProche: 150, fogLoin: 700, soleil: 0xfff4e0,
      herbe1: 0x5c9a47, herbe2: 0x497f3a, champ: 0x000000, champ2: 0x000000, clair: 0x7fb05a,
      accotement: 0x8e8a7e, roche: 0x8e9094, neige: 0xf3f6f9, sol: 0x6b8a58,
      arbres: [0x1f5d38, 0x246b40, 0x2b7a49, 0x1b5232], conifere: true, ligne: "jaune",
      mur: 0x9b7650, toit: 0x5b3a29,
      facettes: true, amplitude: 240, largeur: 300, pic: 1.5, densite: 1.0, limiteArbres: 45, ligneArbres: 1750, rochers: 0.75, poussiere: 0xbab5aa
    },
    mer: {
      nom: "Bord de mer",
      cielHaut: 0x3d9be8, cielHorizon: 0xe6f4fb, brume: 0xe6f4fb, fogProche: 170, fogLoin: 700, soleil: 0xfff6e0,
      herbe1: 0x9ac85a, herbe2: 0x82b64c, champ: 0xd9c97a, champ2: 0xa6cf6a, clair: 0xb8da78,
      accotement: 0xcfc4a6, roche: 0xa49d90, neige: 0xffffff, sol: 0x88a870,
      arbres: [0x3f9b3b, 0x56ae46, 0x6bb84a, 0x2f8a4d], conifere: false, palmiers: true, mer: true, facettes: true, ligne: "pointille",
      mur: 0xf4e7cf, toit: 0xc4553d,
      amplitude: 6, largeur: 150, pic: 1, densite: 0.55, limiteArbres: 1e9, rochers: 0.12, poussiere: 0xe4d6b0
    },
    desert: {
      nom: "Désert",
      cielHaut: 0x3b8de0, cielHorizon: 0xf5e2bf, brume: 0xf3dfb9, fogProche: 150, fogLoin: 700, soleil: 0xfff1cf,
      herbe1: 0xe8bd7a, herbe2: 0xdba35e, champ: 0xc9a35f, champ2: 0xf1d596, clair: 0xf2d8a0,
      accotement: 0xcdb48b, roche: 0xb8693f, neige: 0xffffff, sol: 0xd8b070,
      arbres: [0x5f9a4a, 0x6aa655, 0x4f8a47], conifere: false, cactus: true, desert: true, facettes: true, ligne: "pointille",
      mur: 0xe5c9a0, toit: 0xa5603a,
      amplitude: 60, largeur: 230, pic: 1.3, densite: 0.3, limiteArbres: 1e9, rochers: 0.9, poussiere: 0xe2c08a
    },
    // île volcanique, inspirée du parcours vélo de l'Ironman d'Hawaï (Kona, route de la reine Ka'ahumanu) : coulées de lave noire, herbes dorées,
    // océan à gauche, palmiers dans les villages, volcans au loin (mondes Triathlon)
    kona: {
      nom: "Île volcanique (Kona)",
      cielHaut: 0x2c7fdc, cielHorizon: 0xd3eaf6, brume: 0xd3eaf6, fogProche: 190, fogLoin: 780, soleil: 0xfff2d4,
      herbe1: 0x3a3532, herbe2: 0x262321, champ: 0xc9ad60, champ2: 0x8f8455, clair: 0x5c4f45,
      accotement: 0x726a63, roche: 0x2b2725, neige: 0xffffff, sol: 0x4a4038,
      arbres: [0x3f9b3b, 0x56ae46, 0x6bb84a, 0x4f9c43], conifere: false, palmiers: true, mer: true, kona: true, facettes: true, ligne: "jaune",
      mur: 0xf6ecd8, toit: 0x6f5340,
      amplitude: 8, largeur: 200, pic: 1, densite: 0.3, limiteArbres: 1e9, rochers: 0.95, poussiere: 0x8a8076
    },
    // île volcanique de Lanzarote (Ironman Lanzarote, monde Triathlon M) : lave rouge et brune, champs de cendre noire, vignes dans des murets
    // en demi-cercle (La Geria), maisons blanches à toit plat, volcans rouges ; mêmes reliefs et rivage que Kona (flag kona)
    lanzarote: {
      nom: "Île volcanique (Lanzarote)",
      cielHaut: 0x3a86d6, cielHorizon: 0xdbe9f2, brume: 0xdbe9f2, fogProche: 190, fogLoin: 780, soleil: 0xfff0d0,
      herbe1: 0x6e4232, herbe2: 0x3e2c25, champ: 0x262220, champ2: 0x5a3a2e, clair: 0x93512f,
      accotement: 0x7a6a60, roche: 0x3a2b26, neige: 0xffffff, sol: 0x5a3e32,
      arbres: [0x4f9c43, 0x5fa84a, 0x3f8a3a], conifere: false, palmiers: true, mer: true, kona: true, lanza: true, facettes: true, ligne: "pointille",
      mur: 0xfafafa, toit: 0x8a5a40,
      amplitude: 8, largeur: 200, pic: 1, densite: 0.18, limiteArbres: 1e9, rochers: 0.8, poussiere: 0x9a6a50
    }
  };

  let T = null;
  let saison = "ete";
  let renderer = null, scene = null, camera = null;
  let ciel = null, nuages = null, soleil = null, lueur = null, hemi = null, lumiere = null;
  let terrain = null, ruban = null, murs = null, toits = null, poteaux = null;
  let troncs = null, feuillage = null, buissons = null, rochers = null, ombres = null, solReel = null;
  let cycliste = null, roueAv = null, roueAr = null;
  const jambes = [];
  let th = null, themeNom = "campagne", qDens = 0.8;
  let etapeR = 0, baseR = 0, dR = 0;   // (v69) reconstruction étalée sur quatre images
  let derniereBase = null, dVisible = 0, temps = 0, angleRoue = 0, angleMan = 0, ecart = 0, effort = 0;
  let taille = [0, 0, 0], ratioQ = 1, resH = 0;
  let dummy = null, tmpC = null, vHaut = null, vTmp = null;
  const _p = [0, 0], _q = [0, 0];

  /* ---------- Outils ---------- */
  function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  const lisse01 = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

  /* ---------- Tracé de la route dans le plan (virages doux) ---------- */
  let LB = 0;   // longueur de la boucle quand le parcours est une boucle (0 = tracé libre)
  function cap(d) {
    if (GEO) return capGeo(d);
    const boucleV = LB > 0 && route.virages;
    if (d <= 0 && !boucleV) return 0;
    if (route.virages) {         // mondes fabriqués avec de vrais virages : table du cap mètre par mètre (mondes.js, tracerVirages)
      let x = d, tour = 0;
      if (boucleV) { tour = Math.floor(x / LB); x -= tour * LB; }   // boucle : un tour complet de plus à chaque passage (pas de saut d'angle)
      const t = route.virages, i = Math.floor(Math.min(x, t.length - 1.001));
      x = Math.min(x, t.length - 1.001);
      return t[i] + (t[i + 1] - t[i]) * (x - i) + tour * (route.tourCap || 0);
    }
    if (LB > 0) {                 // boucle : un tour complet (2π) réparti sur la distance, avec des ondulations qui reviennent au départ
      const w = 2 * Math.PI / LB;
      return w * d + 0.45 * Math.sin(3 * w * d) + 0.2 * (Math.sin(5 * w * d + 1.1) - Math.sin(1.1));
    }
    if (route.mer) return 0.16 * Math.sin(d / 900) + 0.07 * (Math.sin(d / 310 + 1.2) - Math.sin(1.2));
    if (route.desert) return 0.34 * Math.sin(d / 560) + 0.16 * (Math.sin(d / 210 + 0.9) - Math.sin(0.9));
    if (route.alpes) return 0.42 * Math.sin(d / 620) + 0.2 * (Math.sin(d / 235 + 1.7) - Math.sin(1.7)) + 0.12 * Math.sin(d / 1700 + 0.6);
    return 0.30 * Math.sin(d / 420) + 0.14 * (Math.sin(d / 170 + 1.7) - Math.sin(1.7));
  }
  const chemin = { x: [0], z: [0] };
  function construireChemin() {
    chemin.x = [0]; chemin.z = [0];
    if (!(LB > 0)) return;
    const n = Math.ceil(LB) + 2;
    for (let i = 0; i < n; i++) {
      const h = cap(i + 0.5);
      chemin.x.push(chemin.x[i] + Math.sin(h));
      chemin.z.push(chemin.z[i] - Math.cos(h));
    }
    const fl = Math.floor(LB), fr = LB - fl;       // écart de fermeture, résorbé en douceur sur toute la boucle
    const gx = chemin.x[fl] * (1 - fr) + chemin.x[fl + 1] * fr, gz = chemin.z[fl] * (1 - fr) + chemin.z[fl + 1] * fr;
    for (let i = 0; i <= n; i++) {
      const k = Math.min(1, i / LB), s = k * k * (3 - 2 * k);
      chemin.x[i] -= gx * s; chemin.z[i] -= gz * s;
    }
  }
  function posChemin(d, out) {
    if (GEO) return posGeo(d, out);
    if (d <= 0 && !(LB > 0 && route.virages)) { out[0] = 0; out[1] = -d; return out; }
    if (LB > 0) d = ((d % LB) + LB) % LB;
    else {
      const n = Math.ceil(d) + 1;
      while (chemin.x.length <= n) {
        const i = chemin.x.length - 1, h = cap(i + 0.5);
        chemin.x.push(chemin.x[i] + Math.sin(h));
        chemin.z.push(chemin.z[i] - Math.cos(h));
      }
    }
    const i = Math.floor(d), f = d - i;
    out[0] = chemin.x[i] * (1 - f) + chemin.x[i + 1] * f;
    out[1] = chemin.z[i] * (1 - f) + chemin.z[i + 1] * f;
    return out;
  }

  /* =====================================================================
     Monde réel : tracé GPS fidèle, sol peint d'après OpenStreetMap,
     bâtiments, arbres et eau (tout est statique, construit une fois).
     ===================================================================== */
  const MOMENTS = {
    jour: { dir: [-0.7, 0.55, -0.25], lum: 1.05, hemi: 0.58 },
    matin: { dir: [-0.85, 0.30, 0.45], lum: 1.0, hemi: 0.55, soleil: 0xffd7a3, haut: 0x6c9fdc, horizon: 0xf5dcc4, brume: 0xf1e1d2 },
    soir: { dir: [0.75, 0.2, 0.45], lum: 0.95, hemi: 0.46, soleil: 0xff9d5c, haut: 0x35568f, horizon: 0xffb985, brume: 0xefb48f },
    // nuit (thème « ville ») : clair de lune bleuté, lueur orangée de la ville sur l'horizon
    nuit: { dir: [0.3, 0.75, -0.45], lum: 0.22, hemi: 0.4, soleil: 0x9fb2dc, haut: 0x050b1c, horizon: 0x2a2440, brume: 0x161a28 }
  };
  let momentNom = "jour";
  function appliquerMoment() {
    if (!scene || !th || !soleil) return;
    const m = th.nuit ? MOMENTS.nuit : MOMENTS[momentNom] || MOMENTS.jour, d = THEMES[themeNom] || THEMES.campagne;
    const n = Math.hypot(m.dir[0], m.dir[1], m.dir[2]);
    SUN.x = m.dir[0] / n; SUN.y = m.dir[1] / n; SUN.z = m.dir[2] / n;
    lumiere.intensity = m.lum; hemi.intensity = m.hemi;
    const haut = m.haut !== undefined ? m.haut : d.cielHaut, hor = m.horizon !== undefined ? m.horizon : d.cielHorizon;
    const br = m.brume !== undefined ? m.brume : d.brume, so = m.soleil !== undefined ? m.soleil : d.soleil;
    th.haut.set(haut); th.horizon.set(hor);
    scene.fog.color.set(br); renderer.setClearColor(br);
    lumiere.color.set(so); soleil.material.color.set(m.soleil !== undefined ? so : 0xfff6dc);
    memoriserCiel(haut, hor, br, so, m.lum, m.hemi);
    appliquerMeteo();
    colorerCiel();
  }
  const MARGE = 650;
  const DEMI_G = 5;                        // demi-largeur de la chaussée en mode réel : 10 m avec trottoirs
  function texRouteVille() {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 256; c.height = 256;
    const x = c.getContext("2d");
    grainAsphalte(x, 256, 256, "#3a4250");
    for (let i = 0; i < 400; i++) { x.fillStyle = i % 2 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.09)"; x.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 3, 1 + Math.random() * 3); }
    x.fillStyle = "rgba(0,0,0,0.10)"; x.fillRect(70, 0, 28, 256); x.fillRect(158, 0, 28, 256);          // traces des roues
    for (const [a, b] of [[0, 26], [230, 256]]) {                                                       // trottoirs de pavés
      x.fillStyle = "#c3bbac"; x.fillRect(a, 0, b - a, 256);
      x.fillStyle = "rgba(70,62,50,0.38)";
      for (let v = 0; v < 256; v += 32) x.fillRect(a, v, b - a, 1.5);
      for (let v = 0; v < 256; v += 64) x.fillRect(a + (b - a) / 2, v, 1.5, 32);
    }
    x.fillStyle = "#b9b3a6"; x.fillRect(26, 0, 6, 256); x.fillRect(224, 0, 6, 256);                    // bordures
    x.fillStyle = "#f2f2ee"; x.fillRect(44, 0, 3, 256); x.fillRect(209, 0, 3, 256);                    // lignes de rive
    x.fillRect(127, 0, 3, 64);                                                                          // axe en pointillés (3 m sur 12 m)
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.anisotropy = 8;
    if (T.sRGBEncoding) t.encoding = T.sRGBEncoding;
    return t;
  }                       // étendue du sol autour du tracé (m)
  const COUL_ZONE = { roche: "#d8d3c9", urbain: "#cfc8ba", herbe: "#82c455", champ: "#e0cf6a", sable: "#e8dba9", parc: "#8ccb58", foret: "#5cae4e", sport: "#74c466", piste: "#d6b27a", eau: "#56b3e6" };
  const ORDRE_ZONES = ["urbain", "herbe", "champ", "sable", "parc", "foret", "roche", "sport", "piste", "eau"];   // roche (v69) : éboulis, roche nue (sommet du Ventoux)
  const STYLE_ROUTE = {
    cours: { w: 5, c: "#56b3e6", b: null },
    fer: { w: 3, c: "#8a8078", b: "#6b625b" },
    piste: { w: 12, c: "#d6b27a", b: "#bf9a62" },
    chemin: { w: 2.8, c: "#e6dfcf", b: null },
    service: { w: 4.2, c: "#46505e", b: "#bdb5a6", t: 3 },
    locale: { w: 6, c: "#3d4654", b: "#bdb5a6", t: 3.4 },
    secondaire: { w: 7.5, c: "#39424f", b: "#bdb5a6", t: 3.6 },
    principale: { w: 10, c: "#353e4b", b: "#bdb5a6", t: 4 }
  };
  const ORDRE_ROUTES = ["cours", "fer", "piste", "chemin", "service", "locale", "secondaire", "principale"];

  /* Peint la carte (sol, routes, bâtiments) : sert de texture au sol et de vignette */
  function peindreCarte(x, W, H, r, osm, o) {
    o = o || {};
    const sx = W / (r.maxx - r.minx), sy = H / (r.maxz - r.minz), sm = (sx + sy) / 2;
    const X = (v) => (v - r.minx) * sx, Y = (v) => (v - r.minz) * sy;
    if (o.masque) x.clearRect(0, 0, W, H);
    else { x.fillStyle = o.base || "#7dbd4c"; x.fillRect(0, 0, W, H); }
    if (!osm) return;
    const ligne = (pts, ferme) => {
      x.beginPath();
      for (let i = 0; i < pts.length; i++) { if (i) x.lineTo(X(pts[i][0]), Y(pts[i][1])); else x.moveTo(X(pts[i][0]), Y(pts[i][1])); }
      if (ferme) x.closePath();
    };
    const anneaux = (rings) => {
      x.beginPath();
      for (const ring of rings) {
        for (let i = 0; i < ring.length; i++) { if (i) x.lineTo(X(ring[i][0]), Y(ring[i][1])); else x.moveTo(X(ring[i][0]), Y(ring[i][1])); }
        x.closePath();
      }
    };
    x.lineCap = "round"; x.lineJoin = "round";
    const zones = osm.zones || [], routes = osm.routes || [], bats = osm.batiments || [];
    if (o.masque) {
      x.fillStyle = "#000"; x.strokeStyle = "#000";
      for (const z of zones) if (z.k === "eau") { anneaux(z.r); x.fill("evenodd"); }
      for (const rt of routes) {
        if (rt.k === "cours" || rt.k === "fer") { x.lineWidth = (STYLE_ROUTE[rt.k].w + 2) * sm; ligne(rt.p, false); x.stroke(); continue; }
        x.lineWidth = ((STYLE_ROUTE[rt.k] ? STYLE_ROUTE[rt.k].w : 4) + 3) * sm; ligne(rt.p, false); x.stroke();
      }
      x.lineWidth = 2.5 * sm;
      for (const b of bats) { ligne(b.p, true); x.fill(); x.stroke(); }
      return;
    }
    for (const k of ORDRE_ZONES) {
      x.fillStyle = o.jardins && k === "urbain" ? "#8dbd5f" : COUL_ZONE[k];   // (v69) sol du monde : les quartiers sont des jardins (pelouses)
      for (const z of zones) if (z.k === k) { anneaux(z.r); x.fill("evenodd"); }
    }
    if (o.jardins) {                                          // parcelles : pelouses plus ou moins vertes, potagers, terrasses de gravier
      const tons = ["rgba(55,115,35,0.20)", "rgba(175,205,95,0.18)", "rgba(115,160,65,0.16)", "rgba(40,95,30,0.14)", "rgba(205,195,165,0.32)", "rgba(130,105,70,0.22)"];
      let n = 0;
      for (const z of zones) {
        if (z.k !== "urbain" || n > 9000) continue;
        let a = Infinity, b = -Infinity, c = Infinity, e = -Infinity;
        for (const ring of z.r) for (const q of ring) { a = Math.min(a, q[0]); b = Math.max(b, q[0]); c = Math.min(c, q[1]); e = Math.max(e, q[1]); }
        const nb = Math.min(900, Math.round((b - a) * (e - c) / 350));
        x.save(); anneaux(z.r); x.clip("evenodd");
        for (let i = 0; i < nb; i++, n++) {
          const h1 = hash(n * 1.91 + 0.3), h2 = hash(n * 2.73 + 1.7), h3 = hash(n * 3.37 + 2.9), h4 = hash(n * 4.13 + 4.1);
          const w = (10 + h3 * 16) * sm, l = (16 + h4 * 22) * sm, ang = hash(n * 0.77) * 3.1416;
          x.fillStyle = tons[h4 < 0.06 ? 4 : h3 < 0.05 ? 5 : Math.floor(h1 * 4)];
          x.translate(X(a + h1 * (b - a)), Y(c + h2 * (e - c))); x.rotate(ang); x.fillRect(-w / 2, -l / 2, w, l); x.setTransform(1, 0, 0, 1, 0, 0);
        }
        x.restore();
      }
      // abords des grands bâtiments (industrie, commerce, plus de 700 m²) : parkings et cours en asphalte
      const aire = (p) => { let s = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) s += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]); return Math.abs(s / 2); };
      x.fillStyle = x.strokeStyle = "#83878c";
      for (const bt of bats) {
        const s = aire(bt.p);
        if (!(bt.u === "i" || bt.u === "c" || s > 700)) continue;
        x.lineWidth = Math.min(28, 6 + Math.sqrt(s) * 0.3) * 2 * sm; ligne(bt.p, true); x.stroke(); x.fill();
      }
    }
    if (o.taches) {                                           // nuances de pelouse : grandes taches douces
      for (let i = 0; i < 420; i++) {
        const cx0 = hash(i * 1.37 + 3) * (r.maxx - r.minx) + r.minx, cz0 = hash(i * 2.11 + 8) * (r.maxz - r.minz) + r.minz, rr = 14 + hash(i * 0.73) * 60;
        x.fillStyle = i % 3 ? "rgba(235,255,170,0.07)" : "rgba(15,85,25,0.07)";
        x.beginPath(); x.arc(X(cx0), Y(cz0), rr * sm, 0, 6.2832); x.fill();
      }
    }
    for (const k of ORDRE_ROUTES) {
      const st = STYLE_ROUTE[k];
      if (st.b) {
        x.strokeStyle = st.b; x.lineWidth = (st.w + (st.t || 1.4)) * sm;
        for (const rt of routes) if (rt.k === k) { ligne(rt.p, false); x.stroke(); }
      }
      x.strokeStyle = st.c; x.lineWidth = st.w * sm;
      for (const rt of routes) if (rt.k === k) { ligne(rt.p, false); x.stroke(); }
      if (st.t && k !== "service" && x.setLineDash) {        // ligne centrale blanche en pointillés
        x.setLineDash([2.5 * sm, 4 * sm]); x.strokeStyle = "#f2f2ee"; x.lineWidth = Math.max(1, 0.25 * sm);
        for (const rt of routes) if (rt.k === k) { ligne(rt.p, false); x.stroke(); }
        x.setLineDash([]);
      }
    }
    if (bats.length < 4000) {                                // trottoir de pavés autour des bâtiments
      x.fillStyle = "#c4bcad"; x.strokeStyle = "#c4bcad"; x.lineWidth = 5 * sm;
      for (const b of bats) { ligne(b.p, true); x.stroke(); x.fill(); }
    }
    x.fillStyle = "#e9dfcb"; x.strokeStyle = "#b9ab93"; x.lineWidth = Math.max(0.6, 0.8 * sm);
    for (const b of bats) { ligne(b.p, true); x.fill(); x.stroke(); }
  }

  function dansAnneaux(rings, px, pz) {
    let c = false;
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[i], b = ring[j];
        if ((a[1] > pz) !== (b[1] > pz) && px < (b[0] - a[0]) * (pz - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
      }
    }
    return c;
  }

  let reelObjets = [], reelAFaire = false, solInfo = null;
  function viderReel() {
    for (const o of reelObjets) {
      scene.remove(o);
      jeter(o);
    }
    reelObjets = [];
    solInfo = null;
  }
  function ajouterReel(o) { o.frustumCulled = false; scene.add(o); reelObjets.push(o); return o; }
  // libère la mémoire d'un objet retiré de la scène, sans toucher aux formes et textures partagées du décor Blender (réutilisées ailleurs)
  function jeter(o) {
    const partagee = (g) => { for (const k in geosDecor) if (geosDecor[k] === g) return true; return false; };
    if (o.geometry && !partagee(o.geometry)) o.geometry.dispose();
    if (o.material) {
      const m = o.material;
      if (m.map && m.map !== atlasVeg && !Object.values(texsDecor).includes(m.map)) m.map.dispose();
      m.dispose();
    }
    if (o.customDepthMaterial) o.customDepthMaterial.dispose();
  }

  function majReel() {
    reelAFaire = false;
    viderReel();
    const vis = !GEO;
    if (ruban) {
      if (ruban.material.map) ruban.material.map.dispose();
      ruban.material.map = GEO || th.villeN ? texRouteVille() : texRoute(th.ligne);
      rubU.uUse.value = GEO || th.villeN ? 0 : 1;
      ruban.material.needsUpdate = true;
    }
    for (const o of [terrain, troncs, feuillage, buissons, rochers, ombres, murs, toits, poteaux]) if (o) o.visible = vis;
    for (const o of decor) o.visible = vis;
    foretReel = null;
    for (const o of [villesM, toitsV]) if (o) o.visible = vis && (!!th.mer || !!th.villeN);
    if (parasols) parasols.visible = vis && !!th.mer;
    if (fond) fond.visible = vis && !!fondStyle;
    solReel = null;
    if (!GEO) return;
    construireReel();
    derniereBase = null;                 // replace l’herbe et les fleurs maintenant que le sol est connu
  }

  // sol des mondes réels : la carte peinte (une texture pour tout le lieu, quelques mètres par pixel) reçoit les mêmes détails que le sol des mondes
  // fabriqués, mais seulement là où elle est verte (prés, parcs, forêts ; pas les routes, l'eau ni les bâtiments) : brins d'herbe de la texture du sol
  // lus en mètres (deux échelles, plus une fine de près), herbe plus sèche ou plus foncée par plaques, plaques de terre nue
  function solDetailleReel(m) {
    const det = tH0 || (matTerPlaine && matTerPlaine.map);
    if (!det) return m;
    const u = Object.assign({ uDet: { value: det } }, solU);
    m.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, u);
      s.vertexShader = "varying vec2 vSolP;\n" + s.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  vSolP = ( modelMatrix * vec4( transformed, 1.0 ) ).xz;");
      s.fragmentShader = [
        "uniform sampler2D uDet; uniform vec3 uTerre; uniform float uTerreK, uSec;",
        "varying vec2 vSolP;",
        "float hS(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }",
        "float bS(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);",
        "  return mix(mix(hS(i), hS(i + vec2(1.0, 0.0)), f.x), mix(hS(i + vec2(0.0, 1.0)), hS(i + vec2(1.0, 1.0)), f.x), f.y); }",
        "float fS(vec2 p) { return 0.5 * bS(p) + 0.3 * bS(p * 2.03 + 5.1) + 0.2 * bS(p * 4.01 + 9.7); }",
        s.fragmentShader].join("\n")
        .replace("#include <color_fragment>", [
        "#include <color_fragment>",
        "  {",
        "    vec2 P = mod( vSolP, 2048.0 ), q = vSolP * 0.1;",
        "    vec3 c = diffuseColor.rgb;",
        "    float gw = smoothstep( 0.01, 0.07, c.g - max( c.r, c.b ) );                       // part « verte » de la carte",
        "    float moy = texture2D( uDet, vec2( 0.5 ), 16.0 ).r + 0.001;                        // clarté moyenne de la texture (plus petite réduction)",
        "    vec4 t1 = texture2D( uDet, q ), t2 = texture2D( uDet, mat2( 0.8, -0.6, 0.6, 0.8 ) * q * 0.31 + 0.37 );",
        "    float k = 0.5 + 0.5 * sin( q.x * 0.83 + 1.3 ) * sin( q.y * 0.61 + sin( q.x * 0.29 ) );",
        "    float fin = 1.0 - smoothstep( 0.05, 0.25, length( fwidth( P * 3.0 ) ) );",
        "    float l = mix( t1.r, t2.r, 0.25 + 0.5 * k ) / moy;",
        "    l *= mix( 1.0, ( 0.72 + 0.56 * texture2D( uDet, mat2( 0.6, 0.8, -0.8, 0.6 ) * q * 3.3 + 0.11 ).r ) / ( 0.72 + 0.56 * moy ), 0.55 * fin );",
        "    c *= mix( 1.0, l, 0.85 * gw );",
        "    float n1 = fS( P * 0.07 ), n2 = fS( P * 0.45 + 7.3 ), n4 = fS( P * 0.3 + 11.7 );",
        "    c = mix( c, c * vec3( 1.16, 1.05, 0.66 ), uSec * 0.45 * smoothstep( 0.42, 0.78, n1 ) * gw );",
        "    c *= 1.0 - 0.12 * smoothstep( 0.5, 0.85, n2 ) * gw;",
        "    c = mix( c, uTerre * ( 0.65 + 0.7 * t1.r ), smoothstep( 0.75, 0.84, n4 ) * uTerreK * gw * 0.8 );",
        // (v69) surfaces grises (routes, trottoirs, parkings, cours) : grain fin de près, taches, usure ; pas sur l'eau ni sur le vert
        "    float sat = max( c.r, max( c.g, c.b ) ) - min( c.r, min( c.g, c.b ) );",
        "    float pav = ( 1.0 - smoothstep( 0.1, 0.2, sat ) ) * ( 1.0 - gw ) * ( 1.0 - smoothstep( 0.04, 0.12, c.b - c.r ) );",
        "    c *= mix( 1.0, 0.84 + 0.3 * bS( P * 6.0 ) * ( 0.7 + 0.3 * bS( P * 17.0 + 2.1 ) ), pav * ( 0.25 + 0.75 * fin ) );",
        "    c *= 1.0 - pav * ( 0.16 * smoothstep( 0.55, 0.85, n2 ) + 0.1 * ( n1 - 0.5 ) );",
        "    diffuseColor.rgb = c;",
        "  }"].join("\n"));
    };
    m.customProgramCacheKey = () => "solReel2";
    return m;
  }

  /* (v69) Sol lointain des mondes réels : de la carte détaillée (650 m autour du tracé) jusqu'à 2,2 km, maille de 40 m ou plus,
     relief et forêts à grande échelle (`ign.loin` : LiDAR IGN à 40 m, téléchargé par `chargerLoin` dans js/mondes.js). Sans ces
     données, le sol prolonge le bord de la carte. Il est un peu plus bas que la carte détaillée là où les deux se recouvrent. */
  function construireSolLoin(r, ign, hSol) {
    const lo = ign && ign.loin && ign.loin.h ? ign.loin : null, EXT = 2200 - MARGE;
    const R = { minx: r.minx - EXT, maxx: r.maxx + EXT, minz: r.minz - EXT, maxz: r.maxz + EXT };
    const W = R.maxx - R.minx, H = R.maxz - R.minz, cell = Math.max(40, Math.sqrt(W * H / 60000));
    const nx = Math.ceil(W / cell) + 1, nz = Math.ceil(H / cell) + 1;
    const ok = (v) => v > -100 && v < 5000;
    const loinAt = (px, pz) => {
      if (!lo) return NaN;
      let u = (px - lo.x0) / lo.dx, v = (pz - lo.z0) / lo.dx;
      if (u < 0 || v < 0 || u > lo.nx - 1.001 || v > lo.nz - 1.001) return NaN;
      const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, h = lo.h;
      const a = h[j * lo.nx + i], b = h[j * lo.nx + i + 1], c = h[(j + 1) * lo.nx + i], d = h[(j + 1) * lo.nx + i + 1];
      if (!ok(a) || !ok(b) || !ok(c) || !ok(d)) return NaN;
      return (a * (1 - fu) + b * fu) * (1 - fv) + (c * (1 - fu) + d * fu) * fv;
    };
    const foretAt = (px, pz) => {
      if (!lo || !lo.f) return 0;
      const i = Math.round((px - lo.x0) / lo.dx), j = Math.round((pz - lo.z0) / lo.dx);
      return i < 0 || j < 0 || i >= lo.nx || j >= lo.nz ? 0 : lo.f[j * lo.nx + i];
    };
    const n = nx * nz, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), hh = new Float32Array(n), dO = new Float32Array(n);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const px = R.minx + i * cell, pz = R.minz + j * cell, k = j * nx + i;
      const ex = Math.max(r.minx - px, 0, px - r.maxx), ez = Math.max(r.minz - pz, 0, pz - r.maxz), dOut = Math.hypot(ex, ez);
      const hb = hSol(px, pz);                              // bord de la carte détaillée (prolongé)
      let h = loinAt(px, pz);
      if (isNaN(h)) h = hb;
      const t = lisse01(dOut / 250);
      h = hb * (1 - t) + h * t - 0.4 - 1.6 * (1 - lisse01(dOut / 120));
      hh[k] = h; dO[k] = dOut;
      pos[k * 3] = px; pos[k * 3 + 1] = h; pos[k * 3 + 2] = pz;
    }
    const c1 = th.c.herbe1, c2 = th.c.herbe2, cf = th.c.herbe2.clone().multiplyScalar(0.5).lerp(new T.Color(0x22402a), 0.35), cr = th.c.roche, tmp = new T.Color();
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i, px = R.minx + i * cell, pz = R.minz + j * cell;
      const gx = (hh[j * nx + Math.min(nx - 1, i + 1)] - hh[j * nx + Math.max(0, i - 1)]) / (2 * cell), gz = (hh[Math.min(nz - 1, j + 1) * nx + i] - hh[Math.max(0, j - 1) * nx + i]) / (2 * cell);
      const pente = Math.hypot(gx, gz);
      tmp.copy(c1).lerp(c2, 0.5 + 0.5 * Math.sin(px * 0.004 + Math.sin(pz * 0.003) * 2));
      if (foretAt(px, pz)) tmp.lerp(cf, 0.85);
      tmp.lerp(cr, lisse01((pente - 0.55) / 0.4) * 0.8);       // roche sur les pentes très raides
      col[k * 3] = tmp.r; col[k * 3 + 1] = tmp.g; col[k * 3 + 2] = tmp.b;
    }
    const idx = [];
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      if (dO[a] === 0 && dO[b] === 0 && dO[c] === 0 && dO[d] === 0) {   // entièrement sous la carte détaillée : inutile, sauf au bord
        const px = R.minx + i * cell, pz = R.minz + j * cell;
        if (px - r.minx > cell && r.maxx - px > 2 * cell && pz - r.minz > cell && r.maxz - pz > 2 * cell) continue;
      }
      idx.push(a, c, b, b, c, d);
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(pos, 3));
    g.setAttribute("color", new T.BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new T.Mesh(g, new T.MeshLambertMaterial({ vertexColors: true }));
    m.receiveShadow = false;
    ajouterReel(m);
  }

  function construireReel() {
    const mo = route.monde || {}, osm = mo.osm || null, ign = mo.ign || null;
    const L = route.longueur, pasE = Math.max(4, L / 4000), ns = Math.ceil(L / pasE) + 1;   // (v69) tracé échantillonné plus finement (13 m pour 50 km)
    const sx = new Float32Array(ns), sz = new Float32Array(ns), sa = new Float32Array(ns);
    let mnx = Infinity, mxx = -Infinity, mnz = Infinity, mxz = -Infinity, moy = 0;
    for (let i = 0; i < ns; i++) {
      const d = Math.min(L, i * pasE);
      posChemin(d, _p);
      sx[i] = _p[0]; sz[i] = _p[1]; sa[i] = alt3d(d); moy += sa[i];
      if (_p[0] < mnx) mnx = _p[0]; if (_p[0] > mxx) mxx = _p[0];
      if (_p[1] < mnz) mnz = _p[1]; if (_p[1] > mxz) mxz = _p[1];
    }
    moy /= ns;
    const r = { minx: mnx - MARGE, maxx: mxx + MARGE, minz: mnz - MARGE, maxz: mxz + MARGE };
    const Wm = r.maxx - r.minx, Hm = r.maxz - r.minz;

    /* --- index spatial du tracé (pour écarter les arbres de la route) --- */
    const CELL = 20, gridCh = new Map();
    for (let i = 0; i < ns; i++) {
      const k = Math.floor(sx[i] / CELL) + "," + Math.floor(sz[i] / CELL);
      let a = gridCh.get(k); if (!a) gridCh.set(k, a = []); a.push(i);
    }
    const distChemin = (px, pz) => {
      const cx = Math.floor(px / CELL), cz = Math.floor(pz / CELL);
      let best = 1e9;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        const l = gridCh.get((cx + a) + "," + (cz + b));
        if (l) for (const i of l) { const d = Math.hypot(sx[i] - px, sz[i] - pz); if (d < best) best = d; }
      }
      return best;
    };

    /* --- sol --- */
    const cell = Math.max(12, Math.sqrt(Wm * Hm / 300000));   // (v69) jusqu'à 300 000 points : ~20 m pour un monde de 15 km (montagne, lacets)
    const nx = Math.ceil(Wm / cell) + 1, nz = Math.ceil(Hm / cell) + 1;
    const hG = new Float32Array(nx * nz);
    const ignAt = (px, pz) => {
      if (!ign) return 0;
      let u = (px - ign.x0) / ign.dx, v = (pz - ign.z0) / ign.dz;
      u = Math.min(Math.max(u, 0), ign.nx - 1.0001); v = Math.min(Math.max(v, 0), ign.nz - 1.0001);
      const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, h = ign.h;
      return (h[j * ign.nx + i] * (1 - fu) + h[j * ign.nx + i + 1] * fu) * (1 - fv) + (h[(j + 1) * ign.nx + i] * (1 - fu) + h[(j + 1) * ign.nx + i + 1] * fu) * fv;
    };
    const pos = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2);
    // (v69) route la plus proche de chaque point du sol (distance au tronçon, point et altitude de la route) : chaque tronçon
    // ne visite que les points à moins de 110 m (rapide même avec 300 000 points) ; plus loin, le sol n'est pas raccordé à la route
    const RAY = 110, dmA = new Float32Array(nx * nz).fill(1e9), altA = new Float32Array(nx * nz), xrA = new Float32Array(nx * nz), zrA = new Float32Array(nx * nz);
    for (let q = 0; q < ns - 1; q++) {
      const ax = sx[q], az = sz[q], bx = sx[q + 1] - ax, bz = sz[q + 1] - az, ll = bx * bx + bz * bz;
      const i0 = Math.max(0, Math.floor((Math.min(ax, ax + bx) - RAY - r.minx) / cell)), i1 = Math.min(nx - 1, Math.ceil((Math.max(ax, ax + bx) + RAY - r.minx) / cell));
      const j0 = Math.max(0, Math.floor((Math.min(az, az + bz) - RAY - r.minz) / cell)), j1 = Math.min(nz - 1, Math.ceil((Math.max(az, az + bz) + RAY - r.minz) / cell));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const px = r.minx + i * cell, pz = r.minz + j * cell;
        let t = ll > 0 ? ((px - ax) * bx + (pz - az) * bz) / ll : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const xr = ax + bx * t, zr = az + bz * t, d = Math.hypot(xr - px, zr - pz), k = j * nx + i;
        if (d < dmA[k]) { dmA[k] = d; altA[k] = sa[q] + (sa[q + 1] - sa[q]) * t; xrA[k] = xr; zrA[k] = zr; }
      }
    }
    // (v69) sans relief téléchargé (en attendant l'IGN, ou hors de France) : loin de la route, le sol prend l'altitude de la route
    // la plus proche (grille de 150 m lissée), et non plus l'altitude moyenne du parcours (murs géants en montagne, ex. le Ventoux)
    const CG = 150, cnx = ign ? 0 : Math.ceil(Wm / CG) + 1, cnz = ign ? 0 : Math.ceil(Hm / CG) + 1, champ = ign ? null : new Float32Array(cnx * cnz);
    if (champ) {
      const pq = Math.max(1, Math.floor(ns / 1500));
      for (let j = 0; j < cnz; j++) for (let i = 0; i < cnx; i++) {
        const px = r.minx + i * CG, pz = r.minz + j * CG;
        let best = Infinity, a = moy;
        for (let q = 0; q < ns; q += pq) { const dx = sx[q] - px, dz = sz[q] - pz, d2 = dx * dx + dz * dz; if (d2 < best) { best = d2; a = sa[q]; } }
        champ[j * cnx + i] = a;
      }
    }
    const champAt = (px, pz) => {
      if (!champ) return moy;
      let u = (px - r.minx) / CG, v = (pz - r.minz) / CG;
      u = Math.min(Math.max(u, 0), cnx - 1.0001); v = Math.min(Math.max(v, 0), cnz - 1.0001);
      const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
      return (champ[j * cnx + i] * (1 - fu) + champ[j * cnx + i + 1] * fu) * (1 - fv) + (champ[(j + 1) * cnx + i] * (1 - fu) + champ[(j + 1) * cnx + i + 1] * fu) * fv;
    };
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const px = r.minx + i * cell, pz = r.minz + j * cell, k = j * nx + i;
      const dm = dmA[k], pres = dm < 1e8;
      const w = pres ? 1 - lisse01((dm - 14) / 80) : 0;
      let h;
      if (ign) h = ignAt(px, pz) + (pres ? (altA[k] - ignAt(xrA[k], zrA[k])) * w : 0);
      else { const hc = champAt(px, pz); h = (pres ? altA[k] : hc) * w + (hc + 0.9 * Math.sin(px * 0.011 + 1.0) * Math.sin(pz * 0.013) + 0.5 * Math.sin(px * 0.031 + pz * 0.027)) * (1 - w); }
      h -= 0.6 * (1 - lisse01((dm - 6) / 10));
      h += (1 - w) * (ign ? 0.5 : 1) * (0.9 * Math.sin(px * 0.012 + 0.7) * Math.sin(pz * 0.010 + 2.1) + 0.5 * Math.sin(px * 0.026 - pz * 0.021) + 0.15 * Math.sin(px * 0.07 + pz * 0.05));
      // (v69) près de la route, le sol ne dépasse jamais la chaussée (talus du relief LiDAR, maillage de ~20 m) : il ne remonte
      // qu'au-delà des 3/4 d'une maille, de 50 cm par mètre ; ainsi le triangle sous la route reste toujours en dessous
      if (pres) { const lim = altA[k] - 0.5 + 0.5 * Math.max(0, dm - 0.75 * cell); if (h > lim) h = lim; }
      const idx = j * nx + i;
      hG[idx] = h;
      pos[idx * 3] = px; pos[idx * 3 + 1] = h; pos[idx * 3 + 2] = pz;
      uv[idx * 2] = (px - r.minx) / Wm; uv[idx * 2 + 1] = 1 - (pz - r.minz) / Hm;
    }
    const hSol = (px, pz) => {
      let u = (px - r.minx) / cell, v = (pz - r.minz) / cell;
      u = Math.min(Math.max(u, 0), nx - 1.0001); v = Math.min(Math.max(v, 0), nz - 1.0001);
      const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
      return (hG[j * nx + i] * (1 - fu) + hG[j * nx + i + 1] * fu) * (1 - fv) + (hG[(j + 1) * nx + i] * (1 - fu) + hG[(j + 1) * nx + i + 1] * fu) * fv;
    };
    const idxs = new Uint32Array((nx - 1) * (nz - 1) * 6);
    let o = 0;
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      idxs[o++] = a; idxs[o++] = c; idxs[o++] = b; idxs[o++] = b; idxs[o++] = c; idxs[o++] = d;
    }
    const gSol = new T.BufferGeometry();
    gSol.setAttribute("position", new T.BufferAttribute(pos, 3));
    gSol.setAttribute("uv", new T.BufferAttribute(uv, 2));
    gSol.setIndex(new T.BufferAttribute(idxs, 1));
    gSol.computeVertexNormals();

    /* --- texture peinte (carte du lieu) et masque (routes, eau, bâtiments) --- */
    let tex = null, masque = null, mw = 0, mh = 0;
    if (typeof document !== "undefined") {
      // (v69) grands mondes : carte peinte en 4096 (deux fois plus nette) si la carte graphique l'accepte
      const gd = Math.max(Wm, Hm), R = gd > 2600 && renderer && renderer.capabilities.maxTextureSize >= 4096 ? 4096 : 2048;
      const tw = Math.round(R * Wm / gd), th2 = Math.round(R * Hm / gd);
      const cv = document.createElement("canvas"); cv.width = tw; cv.height = th2;
      const cx = cv.getContext("2d");
      peindreCarte(cx, tw, th2, r, osm, { base: "#" + new T.Color(th.herbe1).getHexString(), taches: true, jardins: true });
      if (saison !== "ete") { cx.globalAlpha = saison === "hiver" ? 0.45 : saison === "printemps" ? 0.1 : 0.16; cx.fillStyle = saison === "hiver" ? "#f3f6fa" : saison === "printemps" ? "#8fd96a" : "#c9822e"; cx.fillRect(0, 0, tw, th2); cx.globalAlpha = 1; }
      for (let i = 0, nG = 30000 * (R / 2048) * (R / 2048); i < nG; i++) {                  // grain d'herbe
        cx.fillStyle = i % 2 ? "rgba(255,255,255,0.055)" : "rgba(20,80,10,0.06)";
        cx.fillRect(hash(i * 1.7) * tw, hash(i * 2.3 + 5) * th2, 1.5 + hash(i) * 2.5, 1.5 + hash(i + 9) * 2.5);
      }
      if (!osm) {                      // sans données : quelques taches de couleur pour éviter l'aplat
        for (let i = 0; i < 160; i++) {
          cx.fillStyle = i % 3 ? "rgba(255,255,255,0.05)" : "rgba(40,90,20,0.06)";
          cx.beginPath(); cx.arc(hash(i) * tw, hash(i + 77) * th2, 40 + hash(i + 5) * 120, 0, 6.2832); cx.fill();
        }
      }
      tex = new T.CanvasTexture(cv);
      tex.anisotropy = 8;
      if (T.sRGBEncoding) tex.encoding = T.sRGBEncoding;
      if (osm) {
        mw = Math.round(R / 2 * Wm / gd); mh = Math.round(R / 2 * Hm / gd);
        const cm = document.createElement("canvas"); cm.width = mw; cm.height = mh;
        const cmx = cm.getContext("2d");
        peindreCarte(cmx, mw, mh, r, osm, { masque: true });
        try { masque = cmx.getImageData(0, 0, mw, mh).data; } catch (e) { masque = null; }
      }
    }
    const bloque = (px, pz) => {
      if (!masque) return false;
      const u = Math.floor((px - r.minx) / Wm * mw), v = Math.floor((pz - r.minz) / Hm * mh);
      if (u < 0 || v < 0 || u >= mw || v >= mh) return true;
      return masque[(v * mw + u) * 4 + 3] > 40;
    };
    const bloqueBat = (px, pz) => bloque(px, pz);
    solReel = { h: (px, pz) => hSol(px, pz), bloque };   // pour l’herbe, les fleurs et les champignons au bord de la route
    if (arches) for (const a of arches) a.d = -1;         // (v69) arche et portiques reposés sur ce nouveau sol
    if (portiques) for (const p of portiques) p.d = -1;
    const sol = new T.Mesh(gSol, solDetailleReel(new T.MeshLambertMaterial({ map: tex, color: tex ? 0xffffff : th.herbe1 })));
    sol.receiveShadow = true;
    ajouterReel(sol);
    try { construireSolLoin(r, ign, hSol); } catch (e) { console.warn("Sol lointain : " + e.message); }   // (v69) ne bloque jamais le monde

    /* --- bâtiments : prismes à toit plat ou à deux pans --- */
    if (osm && osm.batiments && osm.batiments.length) construireBatiments(osm.batiments, hSol, r, distChemin);

    /* --- arbres --- */
    const cand = [];
    const ajoutPt = (px, pz, k, ht) => {
      if (px < r.minx || px > r.maxx || pz < r.minz || pz > r.maxz) return;
      cand.push([px, pz, k, ht || 0]);
    };
    if (osm) {
      for (const a of osm.arbres || []) ajoutPt(a[0], a[1], 0, a[2]);
      // arbres LiDAR HD : ils sont déjà tous là, à leur vraie place ; sinon on remplit forêts, parcs et jardins
      const esp = osm.arbresLidar ? {} : { foret: 7, parc: 18, herbe: 40, urbain: 32 };
      let budget = 60000;
      for (const z of osm.zones || []) {
        const e0 = esp[z.k]; if (!e0 || !z.r.length) continue;
        let mnx2 = Infinity, mxx2 = -Infinity, mnz2 = Infinity, mxz2 = -Infinity;
        for (const p of z.r[0]) { if (p[0] < mnx2) mnx2 = p[0]; if (p[0] > mxx2) mxx2 = p[0]; if (p[1] < mnz2) mnz2 = p[1]; if (p[1] > mxz2) mxz2 = p[1]; }
        mnx2 = Math.max(mnx2, r.minx); mxx2 = Math.min(mxx2, r.maxx); mnz2 = Math.max(mnz2, r.minz); mxz2 = Math.min(mxz2, r.maxz);
        if (mxx2 <= mnx2 || mxz2 <= mnz2) continue;
        let e = e0;
        const nb = (mxx2 - mnx2) * (mxz2 - mnz2) / (e * e);
        if (nb > 25000) e *= Math.sqrt(nb / 25000);
        if (nb > budget * 2) continue;
        let n = 0;
        for (let gz = mnz2; gz < mxz2; gz += e) for (let gx = mnx2; gx < mxx2; gx += e) {
          const px = gx + (hash(gx * 0.37 + gz * 1.13) - 0.5) * e * 1.6, pz = gz + (hash(gx * 1.71 - gz * 0.29 + 9) - 0.5) * e * 1.6;
          const dn = 0.5 + 0.5 * Math.sin(px * 0.021 + Math.sin(pz * 0.017) * 2) * Math.cos(pz * 0.019 + 0.8);   // bosquets et clairières
          if (hash(px * 0.77 + pz * 1.31) > (z.k === "foret" ? 0.4 + 0.6 * dn : 0.1 + 0.9 * dn * dn)) continue;
          if (dansAnneaux(z.r, px, pz)) { ajoutPt(px, pz, z.k === "foret" ? 1 : 2); n++; }
        }
        budget -= n;
      }
    } else {
      for (let d = 0; d < L; d += 9) {
        for (const s of [-1, 1]) {
          const h1 = hash(d * 0.31 + s * 5), h2 = hash(d * 0.77 + s * 11);
          if (h1 < 0.55) continue;
          posChemin(d, _q); const h = cap(d), u = s * (8 + h2 * h2 * 70);
          ajoutPt(_q[0] + Math.cos(h) * u, _q[1] + Math.sin(h) * u, 2);
        }
      }
    }
    const pris = [];
    for (const c of cand) {
      const dc = distChemin(c[0], c[1]);
      if (dc < 6.5 || bloque(c[0], c[1])) continue;
      pris.push([c[0], c[1], c[2], dc, c[3]]);
    }
    const maxT = Math.round(4200 * qDens);
    if (pris.length > maxT) { pris.sort((a, b) => a[3] - b[3]); pris.length = maxT; }
    const feuGeo = geoFeuillus();
    const pinGeo = geoPin();
    const HAUT_FEUILLU = 5.4, HAUT_PIN = 6.9;      // hauteur (m) des modèles d’arbre à l’échelle 1
    const lF = [], lP = [];
    for (const p of pris) {
      const a = hash(p[0] * 0.13 + p[1] * 0.71);
      ((p[2] === 1 && a > 0.55) || a > 0.92 ? lP : lF).push(p);
    }
    const trGeo = geoTronc;
    const groupeArbres = (geo, liste, pin) => {
      if (!liste.length) return;
      const mt = new T.InstancedMesh(trGeo(), new T.MeshLambertMaterial({ color: 0x6b4a2f }), liste.length);
      const mf = new T.InstancedMesh(geo, new T.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }), liste.length);
      const mo = new T.InstancedMesh(geoOmbre(), matOmbre(), liste.length);          // ombre douce au pied de chaque arbre
      for (let i = 0; i < liste.length; i++) {
        const p = liste[i], a = hash(p[0] * 0.13 + p[1] * 0.71), b2 = hash(p[0] * 0.71 - p[1] * 0.37 + 3);
        const v = hash(p[0] * 0.31 + p[1] * 0.57 + 8);
        let e = (pin ? 0.75 : 0.65) + Math.pow(v, 1.6) * (pin ? 1.5 : 1.4), ey = e * (0.85 + b2 * 0.35);
        if (p[4]) { ey = Math.min(8, Math.max(0.55, p[4] / (pin ? HAUT_PIN : HAUT_FEUILLU))); e = Math.min(3.2, 0.45 + ey * 0.62); }   // hauteur mesurée par le LiDAR
        matrice(mt, i, p[0], hSol(p[0], p[1]) - 0.15, p[1], a * 6.283, e * 0.9, ey, e * 0.9);
        mf.setMatrixAt(i, dummy.matrix);
        matrice(mo, i, p[0], hSol(p[0], p[1]) + 0.07, p[1], a * 6.283, e * (pin ? 3.4 : 3.6), 1, e * (pin ? 3.4 : 3.6));
        if (pin) tmpC.set([0x2d7a47, 0x3b8a4f, 0x276b3c, 0x34804a][Math.floor(b2 * 4) % 4]);
        else if (b2 < 0.07 && saison !== "printemps" && saison !== "hiver") tmpC.set(0xe3b52a);
        else if (b2 < 0.10 && saison !== "printemps" && saison !== "hiver") tmpC.set(0xe07b2c);
        else if (b2 < 0.20 && saison === "ete") tmpC.set(0x9bd05a);
        else tmpC.copy(th.arbres[Math.floor(a * 7.7) % th.arbres.length]).offsetHSL(0, 0, (a - 0.5) * 0.08);
        mf.setColorAt(i, tmpC);
      }
      mt.instanceMatrix.needsUpdate = true; mf.instanceMatrix.needsUpdate = true;
      if (mf.instanceColor) mf.instanceColor.needsUpdate = true;
      mo.instanceMatrix.needsUpdate = true; mo.renderOrder = 1;
      mt.castShadow = mf.castShadow = true; mt.receiveShadow = mf.receiveShadow = true;
      ajouterReel(mt); ajouterReel(mf); ajouterReel(mo);
    };
    if (decorOk() && geoDecor("chene_a_0")) {        // arbres Blender : une forêt rangée selon la distance à la caméra (majForet)
      foretReel = creerForet(Math.max(1, lF.length + lP.length), ajouterReel);
      const mo = new T.InstancedMesh(geoOmbre(), matOmbre(), Math.max(1, lF.length + lP.length));
      let io = 0;
      for (const [liste, pin] of [[lF, false], [lP, true]]) for (const p of liste) {
        const a = hash(p[0] * 0.13 + p[1] * 0.71), b2 = hash(p[0] * 0.71 - p[1] * 0.37 + 3), v = hash(p[0] * 0.31 + p[1] * 0.57 + 8), r3 = hash(p[0] * 0.53 + p[1] * 0.29 + 5);
        const esp = pin ? (r3 < 0.5 ? "sapin_a" : "sapin_b") : r3 < 0.3 ? "chene_a" : r3 < 0.55 ? "chene_b" : r3 < 0.8 ? "tilleul" : r3 < 0.93 ? "bouleau" : "peuplier";
        const H = hauteurEspece(esp);
        const e = (pin ? 0.75 : 0.65) + Math.pow(v, 1.6) * (pin ? 1.5 : 1.4);
        let sy = e * (0.85 + b2 * 0.35) * (pin ? HAUT_PIN : HAUT_FEUILLU) / H, sx = e * 0.9;
        if (p[4]) { sy = Math.min(8, Math.max(0.55, p[4] / H)); sx = Math.min(3.2, 0.45 + sy * 0.62) * 0.9; }   // hauteur mesurée par le LiDAR
        if (pin) tmpC.set([0x2d7a47, 0x3b8a4f, 0x276b3c, 0x34804a][Math.floor(b2 * 4) % 4]);
        else if (b2 < 0.07 && saison !== "printemps" && saison !== "hiver") tmpC.set(0xe3b52a);
        else if (b2 < 0.10 && saison !== "printemps" && saison !== "hiver") tmpC.set(0xe07b2c);
        else if (b2 < 0.20 && saison === "ete") tmpC.set(0x9bd05a);
        else tmpC.copy(th.arbres[Math.floor(a * 7.7) % th.arbres.length]).offsetHSL(0, 0, (a - 0.5) * 0.08);
        const y = hSol(p[0], p[1]) - 0.15;
        foretReel.recs.push({ v: esp, x: p[0], y, z: p[1], r: a * 6.283, sx, sy, sz: sx, c: tmpC.clone() });
        matrice(mo, io++, p[0], y + 0.22, p[1], a * 6.283, sx * (pin ? 3.4 : 3.6), 1, sx * (pin ? 3.4 : 3.6));
      }
      mo.instanceMatrix.needsUpdate = true; mo.renderOrder = 1; mo.receiveShadow = true;
      ajouterReel(mo);
    } else {
      groupeArbres(feuGeo, lF, false);
      groupeArbres(pinGeo, lP, true);
    }

    /* --- sous-bois, haies basses et jardins : buissons autour des arbres et des maisons --- */
    const bus = [];
    for (let i = 0; i < pris.length; i += 3) {
      if (hash(i * 1.7) < 0.7) { const a = hash(i * 2.9) * 6.283, rr = 2 + hash(i * 3.3) * 3; bus.push([pris[i][0] + Math.cos(a) * rr, pris[i][1] + Math.sin(a) * rr, pris[i][3]]); }
    }
    if (osm && osm.batiments) {
      for (const b of osm.batiments) {
        const q0 = b.p[0];
        if (q0[0] < r.minx || q0[0] > r.maxx || q0[1] < r.minz || q0[1] > r.maxz) continue;
        const dq = distChemin(q0[0], q0[1]);
        if (dq > 260) continue;
        for (let k = 0; k < b.p.length - 1; k++) {
          const q = b.p[k], hq = hash(q[0] * 0.31 + q[1] * 0.7);
          if (hq < 0.4) bus.push([q[0] + (hq - 0.2) * 7, q[1] + (hash(hq * 9.1) - 0.5) * 6, dq]);
        }
      }
    }
    const busOk = bus.filter((q) => q[0] > r.minx && q[0] < r.maxx && q[1] > r.minz && q[1] < r.maxz && distChemin(q[0], q[1]) > 6.5 && !bloque(q[0], q[1]));
    const maxB = Math.round(2400 * qDens);
    if (busOk.length > maxB) { busOk.sort((a, b) => a[2] - b[2]); busOk.length = maxB; }
    if (busOk.length && foretReel) {                    // buissons Blender, dans la forêt (détail selon la distance)
      const VB = [0x3f9b3b, 0x56ae46, 0x2f8a4d, 0x6bb84a];
      foretReel.cap = Math.max(foretReel.cap, foretReel.recs.length + busOk.length);
      for (const q of busOk) {
        const a = hash(q[0] * 0.41 + q[1] * 0.19), e = 0.7 + a * 1.1;
        if (a < 0.06) tmpC.set(0xe86aa0); else if (a < 0.1) tmpC.set(0xf2c14e); else if (a < 0.13) tmpC.set(0xe0533d);
        else tmpC.set(VB[Math.floor(a * 40) % 4]);
        foretReel.recs.push({ v: "buisson", x: q[0], y: hSol(q[0], q[1]) - 0.1, z: q[1], r: a * 6.283, sx: e, sy: e * (0.8 + a * 0.3), sz: e, c: tmpC.clone() });
      }
    } else if (busOk.length) {
      const gB = ajouterDegrade(lobe(0.85, 0, 0.55, 0, 1.2, 0.8, 1.2), 0.6, 1.1);
      const mbu = new T.InstancedMesh(gB, new T.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }), busOk.length);
      const VB = [0x3f9b3b, 0x56ae46, 0x2f8a4d, 0x6bb84a];
      for (let i = 0; i < busOk.length; i++) {
        const q = busOk[i], a = hash(q[0] * 0.41 + q[1] * 0.19), e = 0.7 + a * 1.1;
        matrice(mbu, i, q[0], hSol(q[0], q[1]) - 0.1, q[1], a * 6.283, e, e * (0.8 + a * 0.3), e);
        if (a < 0.06) tmpC.set(0xe86aa0); else if (a < 0.1) tmpC.set(0xf2c14e); else if (a < 0.13) tmpC.set(0xe0533d);
        else tmpC.set(VB[Math.floor(a * 40) % 4]);
        mbu.setColorAt(i, tmpC);
      }
      mbu.instanceMatrix.needsUpdate = true; if (mbu.instanceColor) mbu.instanceColor.needsUpdate = true;
      mbu.castShadow = true; mbu.receiveShadow = true;
      ajouterReel(mbu);
    }
    if (osm && osm.barrieres && osm.barrieres.length) construireBarrieres(osm.barrieres, hSol, distChemin);

    /* --- herbes hautes et fleurs sauvages dans les pelouses et les parcs --- */
    if (osm && osm.zones) {
      const tp = [];
      for (const z of osm.zones) {
        if ((z.k !== "herbe" && z.k !== "parc") || !z.r.length) continue;
        let mnx2 = Infinity, mxx2 = -Infinity, mnz2 = Infinity, mxz2 = -Infinity;
        for (const p of z.r[0]) { if (p[0] < mnx2) mnx2 = p[0]; if (p[0] > mxx2) mxx2 = p[0]; if (p[1] < mnz2) mnz2 = p[1]; if (p[1] > mxz2) mxz2 = p[1]; }
        mnx2 = Math.max(mnx2, r.minx); mxx2 = Math.min(mxx2, r.maxx); mnz2 = Math.max(mnz2, r.minz); mxz2 = Math.min(mxz2, r.maxz);
        if (mxx2 <= mnx2 || mxz2 <= mnz2) continue;
        let e = 8;
        const nb = (mxx2 - mnx2) * (mxz2 - mnz2) / (e * e);
        if (nb > 20000) e *= Math.sqrt(nb / 20000);
        for (let gz = mnz2; gz < mxz2; gz += e) for (let gx = mnx2; gx < mxx2; gx += e) {
          const px = gx + (hash(gx * 0.53 + gz * 0.97) - 0.5) * e * 1.6, pz = gz + (hash(gx * 1.13 - gz * 0.41 + 4) - 0.5) * e * 1.6;
          const pat = 0.5 + 0.5 * Math.sin(px * 0.033 + Math.cos(pz * 0.027) * 2.2) * Math.sin(pz * 0.031 + 1.3);
          if (hash(px * 0.91 + pz * 0.37) > 0.55 * pat * pat + 0.04) continue;
          if (dansAnneaux(z.r, px, pz)) tp.push([px, pz]);
        }
      }
      const ok = [];
      for (const q of tp) { const dc = distChemin(q[0], q[1]); if (dc > 5.5 && !bloque(q[0], q[1])) ok.push([q[0], q[1], dc]); }
      const maxH = Math.round(3400 * qDens);
      if (ok.length > maxH) { ok.sort((a, b) => a[2] - b[2]); ok.length = maxH; }
      if (ok.length) {
        const brin = (tilt, dx, dz) => { const g = new T.ConeGeometry(0.1, 0.8, 4); g.translate(0, 0.4, 0); g.rotateZ(tilt); g.translate(dx, 0, dz); return g; };
        const gh = ajouterDegrade(fusionner([brin(0, 0, 0), brin(0.35, 0.08, 0.02), brin(-0.35, -0.08, -0.03)]), 0.55, 1.15);
        const mh = new T.InstancedMesh(gh, new T.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }), ok.length);
        const fl = [];
        const VH = [0x5fae45, 0x76bd4d, 0x9ac650, 0xc3c56a, 0x4c9a3e];
        for (let i = 0; i < ok.length; i++) {
          const q = ok[i], a = hash(q[0] * 0.17 + q[1] * 0.29), e = 0.7 + a * 1.1;
          matrice(mh, i, q[0], hSol(q[0], q[1]) - 0.05, q[1], a * 6.283, e, e * (0.7 + a * 0.9), e);
          mh.setColorAt(i, tmpC.set(VH[Math.floor(a * 50) % 5]));
          if (a < 0.16) fl.push([q[0] + (a - 0.08) * 2, q[1] + (hash(a * 7.7) - 0.5) * 1.2, a]);
        }
        mh.instanceMatrix.needsUpdate = true; if (mh.instanceColor) mh.instanceColor.needsUpdate = true;
        mh.receiveShadow = true;
        ajouterReel(mh);
        if (fl.length) {
          const gf = new T.IcosahedronGeometry(0.17, 0); gf.translate(0, 0.62, 0);
          const mfl = new T.InstancedMesh(gf, new T.MeshLambertMaterial({ color: 0xffffff }), fl.length);
          const CF = [0xffffff, 0xf7d84a, 0xf08ab0, 0xb48be0, 0xff7a4d];
          for (let i = 0; i < fl.length; i++) {
            matrice(mfl, i, fl[i][0], hSol(fl[i][0], fl[i][1]) - 0.05, fl[i][1], 0, 1, 1, 1);
            mfl.setColorAt(i, tmpC.set(CF[Math.floor(fl[i][2] * 311) % 5]));
          }
          mfl.instanceMatrix.needsUpdate = true; if (mfl.instanceColor) mfl.instanceColor.needsUpdate = true;
          ajouterReel(mfl);
        }
      }
    }

    /* --- mobilier : lampadaires, bancs, voitures garées --- */
    const lampes = [], bancs = [], bornes = [];
    if (osm) for (const ob of osm.objets || []) { if (ob.k === "lampe") lampes.push([ob.p[0], ob.p[1], null]); else if (ob.k === "banc") bancs.push([ob.p[0], ob.p[1]]); }
    if (osm && osm.batiments && osm.batiments.length) {       // lampadaires le long de la route quand des bâtiments sont proches
      const gB = new Map();
      for (const b of osm.batiments) { const q = b.p[0]; gB.set(Math.floor(q[0] / 40) + "," + Math.floor(q[1] / 40), 1); }
      let cote = 1;
      for (let d = 15; d < L; d += 32) {
        posChemin(d, _q);
        let pres = false;
        for (let a = -1; a <= 1 && !pres; a++) for (let c = -1; c <= 1; c++) if (gB.get((Math.floor(_q[0] / 40) + a) + "," + (Math.floor(_q[1] / 40) + c))) { pres = true; break; }
        if (!pres) continue;
        const h = cap(d); cote = -cote;
        for (const dd of [d + 8, d + 16, d + 24]) { posChemin(dd, _p); const hh = cap(dd); bornes.push([_p[0] + Math.cos(hh) * (-cote) * 5.55, _p[1] + Math.sin(hh) * (-cote) * 5.55]); }
        lampes.push([_q[0] + Math.cos(h) * cote * 5.8, _q[1] + Math.sin(h) * cote * 5.8, [_q[0], _q[1]]]);
      }
    }
    if (lampes.length) {
      const g = fusionner([(() => { const t = new T.CylinderGeometry(0.07, 0.1, 5.2, 6); t.translate(0, 2.6, 0); return t; })(),
        (() => { const t = new T.BoxGeometry(1.1, 0.18, 0.38); t.translate(0.5, 5.25, 0); return t; })()]);
      const ml = new T.InstancedMesh(g, new T.MeshLambertMaterial({ color: 0x3f4854 }), lampes.length);
      for (let i = 0; i < lampes.length; i++) {
        const q = lampes[i];
        const rot = q[2] ? Math.atan2(-(q[2][1] - q[1]), q[2][0] - q[0]) : hash(i * 3.1) * 6.283;
        matrice(ml, i, q[0], hSol(q[0], q[1]) - 0.05, q[1], rot, 1, 1, 1);
      }
      ml.instanceMatrix.needsUpdate = true; ml.castShadow = true; ml.receiveShadow = true;
      ajouterReel(ml);
    }
    if (bornes.length) {
      const gb = (() => { const t = new T.CylinderGeometry(0.1, 0.12, 0.85, 8); t.translate(0, 0.42, 0); return t; })();
      const mb2 = new T.InstancedMesh(gb, new T.MeshLambertMaterial({ color: 0xf1f3f5 }), bornes.length);
      for (let i = 0; i < bornes.length; i++) matrice(mb2, i, bornes[i][0], hSol(bornes[i][0], bornes[i][1]), bornes[i][1], 0, 1, 1, 1);
      mb2.instanceMatrix.needsUpdate = true; mb2.castShadow = true; mb2.receiveShadow = true;
      ajouterReel(mb2);
    }
    if (bancs.length) {
      const g = fusionner([(() => { const t = new T.BoxGeometry(1.7, 0.1, 0.5); t.translate(0, 0.5, 0); return t; })(),
        (() => { const t = new T.BoxGeometry(1.7, 0.45, 0.08); t.translate(0, 0.82, -0.22); return t; })(),
        (() => { const t = new T.BoxGeometry(0.1, 0.5, 0.45); t.translate(-0.7, 0.25, 0); return t; })(),
        (() => { const t = new T.BoxGeometry(0.1, 0.5, 0.45); t.translate(0.7, 0.25, 0); return t; })()]);
      const mb = new T.InstancedMesh(g, new T.MeshLambertMaterial({ color: 0x9b6a3c }), bancs.length);
      for (let i = 0; i < bancs.length; i++) matrice(mb, i, bancs[i][0], hSol(bancs[i][0], bancs[i][1]), bancs[i][1], hash(i * 5.3) * 6.283, 1, 1, 1);
      mb.instanceMatrix.needsUpdate = true; mb.castShadow = true; mb.receiveShadow = true;
      ajouterReel(mb);
    }
    if (osm && osm.routes) {
      const voitures = [];
      for (const rt of osm.routes) {
        if (!/^(locale|secondaire|principale)$/.test(rt.k)) continue;
        const wR = STYLE_ROUTE[rt.k].w;
        let acc = 0;
        for (let i = 1; i < rt.p.length; i++) {
          const ax = rt.p[i - 1][0], az = rt.p[i - 1][1], bx = rt.p[i][0], bz = rt.p[i][1], l = Math.hypot(bx - ax, bz - az);
          if (l < 1) continue;
          const tx = (bx - ax) / l, tz = (bz - az) / l;
          for (let d = acc % 16; d < l; d += 16) {
            const px0 = ax + tx * d, pz0 = az + tz * d, h1 = hash(px0 * 0.37 + pz0 * 0.91);
            if (h1 > 0.3) continue;
            const side = h1 < 0.15 ? 1 : -1, off = side * (wR / 2 - 1.3);
            const px = px0 - tz * off, pz = pz0 + tx * off;
            if (px < r.minx || px > r.maxx || pz < r.minz || pz > r.maxz) continue;
            const dc = distChemin(px, pz);
            if (dc < 9 || bloqueBat(px, pz)) continue;
            voitures.push([px, pz, Math.atan2(-tz, tx) + (side > 0 ? Math.PI : 0), dc, hash(px * 1.3 + pz * 0.7)]);
          }
          acc += l;
        }
      }
      voitures.sort((a, b) => a[3] - b[3]);
      if (voitures.length > 260) voitures.length = 260;
      if (voitures.length) {
        const gc = (() => { const t = new T.BoxGeometry(4.3, 0.8, 1.8); t.translate(0, 0.7, 0); return t; })();
        const gk = (() => { const t = new T.BoxGeometry(2.3, 0.7, 1.65); t.translate(-0.25, 1.4, 0); return t; })();
        const mc = new T.InstancedMesh(gc, new T.MeshLambertMaterial({ color: 0xffffff }), voitures.length);
        const mk = new T.InstancedMesh(gk, new T.MeshLambertMaterial({ color: 0x2f3b4a }), voitures.length);
        const CV = [0xd9483b, 0x3f7fd0, 0xf0f0f0, 0xf2c14e, 0x9aa3ad, 0x4fa56a, 0xe8863a];
        voitures.forEach((v, i) => {
          matrice(mc, i, v[0], hSol(v[0], v[1]), v[1], v[2], 1, 1, 1);
          mk.setMatrixAt(i, dummy.matrix);
          mc.setColorAt(i, tmpC.set(CV[Math.floor(v[4] * 7) % 7]));
        });
        mc.instanceMatrix.needsUpdate = true; mk.instanceMatrix.needsUpdate = true;
        if (mc.instanceColor) mc.instanceColor.needsUpdate = true;
        mc.castShadow = mk.castShadow = true; mc.receiveShadow = mk.receiveShadow = true;
        ajouterReel(mc); ajouterReel(mk);
      }
    }
    solInfo = { r: r, nx: nx, nz: nz, arbres: pris.length };
  }

  function construireBarrieres(bars, hSol, distCh) {
    const P = [], N = [], C = [], col = new T.Color();
    const STY = { hedge: { h: 1.15, w: 0.9, c: 0x4c9a3e }, fence: { h: 1.0, w: 0.08, c: 0xc9a26b }, wall: { h: 1.25, w: 0.28, c: 0xcfc8bb } };
    const quad = (a, b, c, d, hint) => {
      for (const t of [[a, b, c], [a, c, d]]) {
        const u = [t[1][0] - t[0][0], t[1][1] - t[0][1], t[1][2] - t[0][2]], v = [t[2][0] - t[0][0], t[2][1] - t[0][1], t[2][2] - t[0][2]];
        let nx = u[1] * v[2] - u[2] * v[1], ny = u[2] * v[0] - u[0] * v[2], nz = u[0] * v[1] - u[1] * v[0];
        const l = Math.hypot(nx, ny, nz); if (l < 1e-9) continue;
        nx /= l; ny /= l; nz /= l;
        let p = t;
        if (nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) { p = [t[0], t[2], t[1]]; nx = -nx; ny = -ny; nz = -nz; }
        for (const q of p) { P.push(q[0], q[1], q[2]); N.push(nx, ny, nz); C.push(col.r, col.g, col.b); }
      }
    };
    let budget = 9000;
    for (const b of bars) {
      const s = STY[b.k]; if (!s) continue;
      for (let i = 1; i < b.p.length && budget > 0; i++) {
        const a = b.p[i - 1], c = b.p[i], L = Math.hypot(c[0] - a[0], c[1] - a[1]);
        if (L < 0.5 || distCh((a[0] + c[0]) / 2, (a[1] + c[1]) / 2) > 300) continue;
        const tx = (c[0] - a[0]) / L, tz = (c[1] - a[1]) / L, nx = -tz * s.w / 2, nz = tx * s.w / 2, n = Math.max(1, Math.ceil(L / 8));
        for (let k = 0; k < n; k++) {
          const x0 = a[0] + (c[0] - a[0]) * k / n, z0 = a[1] + (c[1] - a[1]) * k / n, x1 = a[0] + (c[0] - a[0]) * (k + 1) / n, z1 = a[1] + (c[1] - a[1]) * (k + 1) / n;
          const y0 = hSol(x0, z0) - 0.1, y1 = hSol(x1, z1) - 0.1;
          col.setHex(s.c); if (b.k === "hedge") col.offsetHSL(0, 0, (hash(x0 * 0.7 + z0) - 0.5) * 0.08);
          quad([x0 + nx, y0, z0 + nz], [x1 + nx, y1, z1 + nz], [x1 + nx, y1 + s.h, z1 + nz], [x0 + nx, y0 + s.h, z0 + nz], [nx, 0, nz]);
          quad([x0 - nx, y0, z0 - nz], [x1 - nx, y1, z1 - nz], [x1 - nx, y1 + s.h, z1 - nz], [x0 - nx, y0 + s.h, z0 - nz], [-nx, 0, -nz]);
          quad([x0 + nx, y0 + s.h, z0 + nz], [x1 + nx, y1 + s.h, z1 + nz], [x1 - nx, y1 + s.h, z1 - nz], [x0 - nx, y0 + s.h, z0 - nz], [0, 1, 0]);
          budget--;
        }
      }
    }
    if (!P.length) return;
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(new Float32Array(P), 3));
    g.setAttribute("normal", new T.BufferAttribute(new Float32Array(N), 3));
    g.setAttribute("color", new T.BufferAttribute(new Float32Array(C), 3));
    const m = new T.Mesh(g, new T.MeshLambertMaterial({ vertexColors: true }));
    m.castShadow = true; m.receiveShadow = true;
    ajouterReel(m);
  }

  // plus petit rectangle orienté contenant le contour (orienté selon l'un de ses murs) ; null si le contour le remplit à moins de 85 %
  function rectangleProche(p) {
    let aire = 0;
    for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; aire += p[i][0] * q[1] - q[0] * p[i][1]; }
    aire = Math.abs(aire) / 2;
    let best = null;
    for (let i = 0; i < p.length; i++) {
      const q = p[(i + 1) % p.length], ex = q[0] - p[i][0], ez = q[1] - p[i][1], l = Math.hypot(ex, ez);
      if (l < 2) continue;
      const ux = ex / l, uz = ez / l;
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
      for (const s of p) { const a = s[0] * ux + s[1] * uz, b = -s[0] * uz + s[1] * ux; if (a < a0) a0 = a; if (a > a1) a1 = a; if (b < b0) b0 = b; if (b > b1) b1 = b; }
      const A = (a1 - a0) * (b1 - b0);
      if (!best || A < best.A) best = { A, ux, uz, a0, a1, b0, b1 };
    }
    if (!best || aire / best.A < 0.85) return null;
    const { ux, uz, a0, a1, b0, b1 } = best, pt = (a, b) => [a * ux - b * uz, a * uz + b * ux];
    return [pt(a0, b0), pt(a1, b0), pt(a1, b1), pt(a0, b1)];
  }
  function construireBatiments(bats, hSol, r, distCh) {
    const P = [], N = [], C = [];
    const MURS = [0xf3ead7, 0xf3ead7, 0xf4f4f1, 0xf4f4f1, 0xefe2c8, 0xf2c14e, 0xee8f4b, 0xd9645a, 0x4d9bd6, 0x5ec2b7, 0xcfd5da, 0xe8a1b0];
    const TOITS = [0x3f5f87, 0xc8473a, 0xe0703a, 0x6f7b8a, 0x4b4f58, 0xa8452f];
    const PLATS = [0x7fb8d8, 0x6fb7a0, 0xb9c2c9, 0x8fa3b5, 0xd9d4cb];
    const MURS_USAGE = {
      r: [0xf3ead7, 0xf4f4f1, 0xefe2c8, 0xe9dcc3, 0xf1e6d0, 0xe6dccb],       // maisons : enduits clairs
      a: [0xe9e2d0, 0xd9d2c3, 0xcfc6b5],                                      // annexes, garages
      i: [0xd5d8db, 0xbfc6cc, 0xe2ded3, 0xa9b4bc, 0xc9cfc4],                // hangars, entrepôts
      e: [0xe6d9bd, 0xdccca9], m: [0xe6d9bd, 0xd8c9a8, 0xece3cf]             // églises, châteaux : pierre
    };
    const TOITS_USAGE = { r: [0xb5523b, 0xc0643f, 0xa8452f, 0xb5523b, 0x4b4f58], a: [0xb5523b, 0xa8452f, 0x6f7b8a], e: [0x4b4f58], m: [0x4b4f58, 0x5a5f69] };
    const PLATS_INDUS = [0x9aa3ab, 0xb3bac0, 0x8d969e, 0xc4c9cc];
    const cw = new T.Color(), cr = new T.Color(), cf = new T.Color(), cb = new T.Color(0x9a4a3a), cg = new T.Color(0xdfe3e6);
    const v3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    function tri(a, b, c, hint, col) {
      const u = v3(b, a), v = v3(c, a);
      let nx = u[1] * v[2] - u[2] * v[1], ny = u[2] * v[0] - u[0] * v[2], nz = u[0] * v[1] - u[1] * v[0];
      const l = Math.hypot(nx, ny, nz); if (l < 1e-9) return;
      nx /= l; ny /= l; nz /= l;
      if (nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) { const t = b; b = c; c = t; nx = -nx; ny = -ny; nz = -nz; }
      for (const p of [a, b, c]) { P.push(p[0], p[1], p[2]); N.push(nx, ny, nz); C.push(col.r, col.g, col.b); }
    }
    function boite(cx, cz, w, d, y0, y1, col) {            // petit volume (cheminée, climatisation)
      const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
      const c = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
      tri([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [0, 1, 0], col); tri([x0, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0], col);
      for (let i = 0; i < 4; i++) {
        const a = c[i], b = c[(i + 1) % 4], hint = [(a[0] + b[0]) / 2 - cx, 0, (a[1] + b[1]) / 2 - cz];
        tri([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], hint, col); tri([a[0], y0, a[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], hint, col);
      }
    }
    const qd = (a, b, c, d, hint, col) => { tri(a, b, c, hint, col); tri(a, c, d, hint, col); };
    function boiteOr(cx, cz, tx, tz, w, d, y0, y1, col) {      // boîte orientée le long d'un mur
      const nx = -tz, nz = tx;
      const c = [[cx - tx * w / 2 - nx * d / 2, cz - tz * w / 2 - nz * d / 2], [cx + tx * w / 2 - nx * d / 2, cz + tz * w / 2 - nz * d / 2], [cx + tx * w / 2 + nx * d / 2, cz + tz * w / 2 + nz * d / 2], [cx - tx * w / 2 + nx * d / 2, cz - tz * w / 2 + nz * d / 2]];
      qd([c[0][0], y1, c[0][1]], [c[1][0], y1, c[1][1]], [c[2][0], y1, c[2][1]], [c[3][0], y1, c[3][1]], [0, 1, 0], col);
      for (let i = 0; i < 4; i++) {
        const a = c[i], b = c[(i + 1) % 4], hint = [(a[0] + b[0]) / 2 - cx, 0, (a[1] + b[1]) / 2 - cz];
        qd([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], hint, col);
      }
    }
    const csoc = new T.Color(), ccor = new T.Color(), ccad = new T.Color(0xf7f3ea), cvol = new T.Color(), cauv = new T.Color(), cbal = new T.Color(0xb9b4aa);
    const VOLETS = [0x3f6f8f, 0x2f7d5b, 0xb34a3a, 0x7a8f3a], PORTES = [0xb3352a, 0x2f5f9e, 0x2f7d5b, 0xe0a526, 0x6b3f24], AUVENTS = [0xd9483b, 0x2f9e8f, 0x3f7fd0, 0xe0a526];
    let cporte = 0xb3352a;
    let n = 0, fenBudget = 24000;
    for (const b of bats) {
      let p = b.p;
      if (p.length > 1 && p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1]) p = p.slice(0, -1);
      if (p.length < 3 || p.length > 120) continue;
      // maison presque rectangulaire (contours précis de la BD TOPO) : on la redresse en rectangle pour lui donner un toit à deux pans
      if (p.length > 4 && p.length <= 16 && (b.h || 8) < 14 && b.u !== "i" && b.u !== "c") { const rc = rectangleProche(p); if (rc) p = rc; }
      let cxm = 0, czm = 0, aire = 0;
      for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; aire += p[i][0] * q[1] - q[0] * p[i][1]; cxm += p[i][0]; czm += p[i][1]; }
      cxm /= p.length; czm /= p.length;
      if (cxm < r.minx || cxm > r.maxx || czm < r.minz || czm > r.maxz) continue;
      if (Math.abs(aire) < 14) continue;
      let yb = Infinity;
      for (const q of p) yb = Math.min(yb, hSol(q[0], q[1]));
      yb -= 0.4;
      const h = Math.min(60, Math.max(3.2, b.h || 8));
      const yt = yb + 0.4 + h;
      const sgn = aire > 0 ? 1 : -1;
      const a1 = hash(cxm * 0.173 + czm * 0.311 + n);
      // couleurs selon l'usage connu par la BD TOPO (maison, annexe, industrie, église, monument), sinon au hasard
      const murs = MURS_USAGE[b.u] || MURS, toits = TOITS_USAGE[b.u] || TOITS, plats = b.u === "i" ? PLATS_INDUS : PLATS;
      cw.setHex(murs[Math.floor(a1 * murs.length * 7) % murs.length]);
      const gabled = p.length === 4 && h < 16 && b.u !== "i";
      if (gabled) cr.setHex(toits[Math.floor(hash(n * 3.7 + cxm) * toits.length) % toits.length]);
      else cr.setHex(plats[Math.floor(hash(n * 1.9 + czm) * plats.length) % plats.length]);
      n++;
      const bas = yb - 1.2, proche = distCh(cxm, czm) < 240 && fenBudget > 0 && b.u !== "i";
      csoc.copy(cw).multiplyScalar(0.78); ccor.copy(cw).lerp(ccad, 0.45);
      cvol.setHex(VOLETS[Math.floor(a1 * 17) % VOLETS.length]); cporte = PORTES[Math.floor(a1 * 31) % PORTES.length]; cauv.setHex(AUVENTS[Math.floor(a1 * 13) % AUVENTS.length]);
      const etages = Math.max(1, Math.floor((h - 0.6) / 3.1));
      for (let i = 0; i < p.length; i++) {
        const q = p[(i + 1) % p.length];
        const ex = q[0] - p[i][0], ez = q[1] - p[i][1], len = Math.hypot(ex, ez);
        const hint = [sgn * ez, 0, -sgn * ex];
        tri([p[i][0], bas, p[i][1]], [q[0], bas, q[1]], [q[0], yt, q[1]], hint, cw);
        tri([p[i][0], bas, p[i][1]], [q[0], yt, q[1]], [p[i][0], yt, p[i][1]], hint, cw);
        // socle foncé et corniche claire (léger relief)
        if (len > 1.5) {
          const nxo = sgn * ez / len, nzo = -sgn * ex / len;
          qd([p[i][0] + nxo * 0.07, bas, p[i][1] + nzo * 0.07], [q[0] + nxo * 0.07, bas, q[1] + nzo * 0.07], [q[0] + nxo * 0.07, yb + 0.9, q[1] + nzo * 0.07], [p[i][0] + nxo * 0.07, yb + 0.9, p[i][1] + nzo * 0.07], hint, csoc);
          qd([p[i][0] + nxo * 0.14, yt - 0.45, p[i][1] + nzo * 0.14], [q[0] + nxo * 0.14, yt - 0.45, q[1] + nzo * 0.14], [q[0] + nxo * 0.14, yt, q[1] + nzo * 0.14], [p[i][0] + nxo * 0.14, yt, p[i][1] + nzo * 0.14], hint, ccor);
        }
        if (proche && len >= 3) {                            // fenêtres, volets, porte, auvent, balcons
          const nxn = sgn * ez / len, nzn = -sgn * ex / len, tx = ex / len, tz = ez / len;
          const detail = distCh(cxm, czm) < 150 ? 2 : 1, cols = Math.max(1, Math.floor(len / 2.3));
          for (let f = 0; f < etages; f++) for (let c = 0; c < cols; c++) {
            const t = (c + 0.5) / cols * len, cx2 = p[i][0] + tx * t, cz2 = p[i][1] + tz * t;
            const porte = f === 0 && c === Math.floor(cols / 2) && i === 0;
            const y0 = yb + 0.4 + (porte ? 0 : 0.95) + f * 3.1, y1 = y0 + (porte ? 2.1 : 1.3);
            if (y1 > yt - 0.55) continue;
            const wv = porte ? 0.5 : 0.38;
            const O = (k) => [nxn * k, nzn * k];
            const quadVert = (hw, ya, yb2, off, col) => {
              const o = O(off);
              const A = [cx2 - tx * hw + o[0], ya, cz2 - tz * hw + o[1]], B = [cx2 + tx * hw + o[0], ya, cz2 + tz * hw + o[1]];
              const C2 = [B[0], yb2, B[2]], D = [A[0], yb2, A[2]];
              qd(A, B, C2, D, [nxn, 0, nzn], col);
            };
            if (detail === 2) quadVert(wv + 0.1, y0 - 0.08, y1 + 0.1, 0.035, ccad);        // encadrement clair
            if (porte) { cf.setHex(cporte); } else cf.setHex(hash(cx2 * 3.1 + y0) < 0.12 ? 0xf3d98b : 0x35597f);
            quadVert(wv, y0, y1, 0.07, cf);
            if (detail === 2 && !porte && gabled && hash(cx2 * 0.9 + f) < 0.7) {             // volets
              quadVert(0.16, y0 - 0.05, y1 + 0.05, 0.05, cvol);
              const o = O(0.05);
              const A = [cx2 - tx * (wv + 0.36) + o[0], y0 - 0.05, cz2 - tz * (wv + 0.36) + o[1]], B = [cx2 - tx * (wv + 0.2) + o[0], y0 - 0.05, cz2 - tz * (wv + 0.2) + o[1]];
              qd(A, B, [B[0], y1 + 0.05, B[2]], [A[0], y1 + 0.05, A[2]], [nxn, 0, nzn], cvol);
              const A2 = [cx2 + tx * (wv + 0.2) + o[0], y0 - 0.05, cz2 + tz * (wv + 0.2) + o[1]], B2 = [cx2 + tx * (wv + 0.36) + o[0], y0 - 0.05, cz2 + tz * (wv + 0.36) + o[1]];
              qd(A2, B2, [B2[0], y1 + 0.05, B2[2]], [A2[0], y1 + 0.05, A2[2]], [nxn, 0, nzn], cvol);
            }
            if (porte && detail === 2 && !gabled) boiteOr(cx2 + nxn * 0.55, cz2 + nzn * 0.55, tx, tz, 2.4, 1.1, y1 + 0.15, y1 + 0.3, cauv);       // auvent coloré
            if (detail === 2 && f >= 1 && !porte && h > 7 && hash(cx2 * 1.3 + f * 2.7) < 0.2) boiteOr(cx2 + nxn * 0.5, cz2 + nzn * 0.5, tx, tz, 1.7, 0.9, y0 - 0.14, y0, cbal);   // balcon
            fenBudget--;
          }
        }
      }
      if (gabled) {                                          // toit à deux pans + cheminée
        const e01 = Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]), e12 = Math.hypot(p[2][0] - p[1][0], p[2][1] - p[1][1]);
        const rh = Math.min(3.4, 0.34 * Math.min(e01, e12));
        const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const A = e01 >= e12 ? [p[0], p[1], p[2], p[3]] : [p[1], p[2], p[3], p[0]];
        const m12 = mid(A[1], A[2]), m30 = mid(A[3], A[0]);
        const T0 = (q) => [q[0], yt, q[1]], R = (q) => [q[0], yt + rh, q[1]];
        const up = [0, 1, 0];
        tri(T0(A[0]), T0(A[1]), R(m12), up, cr); tri(T0(A[0]), R(m12), R(m30), up, cr);
        tri(T0(A[2]), T0(A[3]), R(m30), up, cr); tri(T0(A[2]), R(m30), R(m12), up, cr);
        tri(T0(A[1]), T0(A[2]), R(m12), [(A[1][0] + A[2][0]) / 2 - cxm, 0, (A[1][1] + A[2][1]) / 2 - czm], cw);
        tri(T0(A[3]), T0(A[0]), R(m30), [(A[3][0] + A[0][0]) / 2 - cxm, 0, (A[3][1] + A[0][1]) / 2 - czm], cw);
        if (h < 12 && Math.min(e01, e12) > 4.5) boite(cxm + (m12[0] - m30[0]) * 0.22, czm + (m12[1] - m30[1]) * 0.22, 0.7, 0.7, yt + rh * 0.35, yt + rh + 1.0, cb);
      } else {
        const contour = p.map((q) => new T.Vector2(q[0], q[1]));
        let tris = [];
        try { tris = T.ShapeUtils.triangulateShape(contour, []); } catch (e) { tris = []; }
        for (const t of tris) tri([p[t[0]][0], yt, p[t[0]][1]], [p[t[1]][0], yt, p[t[1]][1]], [p[t[2]][0], yt, p[t[2]][1]], [0, 1, 0], cr);
        if (h > 8 && dansAnneaux([p], cxm, czm)) boite(cxm, czm, 2.4, 2.0, yt, yt + 1.3, cg);
      }
    }
    if (!P.length) return;
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(new Float32Array(P), 3));
    g.setAttribute("normal", new T.BufferAttribute(new Float32Array(N), 3));
    g.setAttribute("color", new T.BufferAttribute(new Float32Array(C), 3));
    const m = new T.Mesh(g, new T.MeshLambertMaterial({ vertexColors: true }));
    m.castShadow = true; m.receiveShadow = true;
    ajouterReel(m);
  }

  /* ---------- Tracé GPS (échantillons réguliers fournis par la page) ---------- */
  let GEO = null, capArr = null, capTour = 0;
  function preparerGeo() {
    const xs = GEO.xs, zs = GEO.zs, N = xs.length, boucle = LB > 0, M = boucle ? N - 1 : N, W = 6;
    capArr = new Float64Array(N);
    let prev = 0;
    for (let i = 0; i < N; i++) {
      let a = i - W, b = i + W;
      if (boucle) { a = ((a % M) + M) % M; b = ((b % M) + M) % M; }
      else { a = Math.max(0, a); b = Math.min(N - 1, b); }
      let h = Math.atan2(xs[b] - xs[a], -(zs[b] - zs[a]));
      if (i > 0) { while (h - prev > Math.PI) h -= 2 * Math.PI; while (h - prev < -Math.PI) h += 2 * Math.PI; }
      capArr[i] = h; prev = h;
    }
    capTour = boucle ? Math.round((capArr[N - 1] - capArr[0]) / (2 * Math.PI)) * 2 * Math.PI : 0;
  }
  function capGeo(d) {
    const N = capArr.length;
    let k = 0;
    if (LB > 0) { k = Math.floor(d / LB); d -= k * LB; } else d = Math.min(Math.max(d, 0), route.longueur);
    const u = d / GEO.sp; let i = Math.floor(u); if (i > N - 2) i = N - 2; if (i < 0) i = 0;
    const f = u - i;
    return capArr[i] + (capArr[i + 1] - capArr[i]) * f + k * capTour;
  }
  function posGeo(d, out) {
    const xs = GEO.xs, zs = GEO.zs, N = xs.length;
    if (LB > 0) d = ((d % LB) + LB) % LB;
    else if (d <= 0) { const h = capArr[0]; out[0] = xs[0] + Math.sin(h) * d; out[1] = zs[0] - Math.cos(h) * d; return out; }
    else if (d >= route.longueur) { const h = capArr[N - 1], e = d - route.longueur; out[0] = xs[N - 1] + Math.sin(h) * e; out[1] = zs[N - 1] - Math.cos(h) * e; return out; }
    const u = d / GEO.sp; let i = Math.floor(u); if (i > N - 2) i = N - 2;
    const f = u - i;
    out[0] = xs[i] + (xs[i + 1] - xs[i]) * f;
    out[1] = zs[i] + (zs[i + 1] - zs[i]) * f;
    return out;
  }
  function reconstruireRuban(base) {
    const pR = ruban.geometry.attributes.position, uvR = ruban.geometry.attributes.uv;
    for (let i = 0; i < N_SEC; i++) {
      const dist = (base + i - DERRIERE) * PAS;
      posChemin(dist, _p);
      const h = cap(dist), cx = Math.cos(h), sz = Math.sin(h), y0 = alt3d(dist);
      const r = i * 6;
      pR.array[r] = _p[0] - cx * DEMI_G; pR.array[r + 1] = y0 + 0.03; pR.array[r + 2] = _p[1] - sz * DEMI_G;
      pR.array[r + 3] = _p[0] + cx * DEMI_G; pR.array[r + 4] = y0 + 0.03; pR.array[r + 5] = _p[1] + sz * DEMI_G;
      uvR.array[i * 4] = 0; uvR.array[i * 4 + 1] = dist / 12;
      uvR.array[i * 4 + 2] = 1; uvR.array[i * 4 + 3] = dist / 12;
    }
    ruban.geometry.setDrawRange(0, (N_SEC - 1) * 6);
    pR.needsUpdate = true; uvR.needsUpdate = true;
    ruban.geometry.computeVertexNormals();
  }

  /* ---------- Altitude de la route (profil du parcours, adouci) ---------- */
  let rCache = null, cumD = [0], cumA = [0], gainBoucle = 0;
  /* ---------- Boucles des mondes fabriqués : décor identique à chaque tour, sans raccord à la ligne ----------
     Les ondulations du terrain (sin(d × f)) prennent une fréquence arrondie pour faire un nombre entier de vagues par tour,
     et les repères (villes, oasis, villages) se calculent sur la distance dans le tour. */
  const freqCache = new Map();
  function F(f) {
    if (!(LB > 0 && route.virages)) return f;
    let v = freqCache.get(f);
    if (v === undefined) { v = 2 * Math.PI * Math.max(1, Math.round(f * LB / (2 * Math.PI))) / LB; freqCache.set(f, v); }
    return v;
  }
  const dl = (d) => (LB > 0 && route.virages ? ((d % LB) + LB) % LB : d);
  function preparerRoute() {
    if (rCache === route) return false;
    rCache = route;
    freqCache.clear();
    cumD = [0]; cumA = [route.alt0];
    let x = 0, a = route.alt0;
    for (const seg of route.segments) { x += seg[0]; a += seg[0] * seg[1] / 100; cumD.push(x); cumA.push(a); }
    gainBoucle = a - route.alt0;
    GEO = route.geo || null;
    if (GEO) { LB = route.boucle ? route.longueur : 0; gainBoucle = 0; preparerGeo(); }
    else { LB = route.boucle && route.longueur >= 4000 ? route.longueur : 0; construireChemin(); }
    reelAFaire = true;
    return true;
  }
  function altBrute(d) {
    const L = route.longueur;
    let k = 0;
    if (route.boucle) { k = Math.floor(d / L); d -= k * L; } else d = Math.min(Math.max(d, 0), L);
    let lo = 0, hi = cumD.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cumD[m] <= d) lo = m; else hi = m; }
    const etendue = cumD[hi] - cumD[lo];
    const f = etendue > 0 ? (d - cumD[lo]) / etendue : 0;
    return cumA[lo] + (cumA[hi] - cumA[lo]) * f + k * gainBoucle;
  }
  // (v69) la dernière valeur est gardée : le terrain demande l'altitude de la même distance pour tous les points d'une coupe
  let a3dD = NaN, a3dR = null, a3dV = 0;
  function alt3d(d) {
    if (d === a3dD && route === a3dR && rCache === route) return a3dV;
    a3dD = d; a3dR = route;
    return (a3dV = (altBrute(d - 40) + 2 * altBrute(d - 20) + 3 * altBrute(d) + 2 * altBrute(d + 20) + altBrute(d + 40)) / 9);
  }


  /* ---------- Virages serrés et lacets (mondes fabriqués avec route.virages) ----------
     Le terrain est fait de coupes perpendiculaires à la route. Dans un virage serré, les coupes se croiseraient côté intérieur,
     et dans des lacets, celles d'une branche recouvriraient la branche voisine. Chaque coupe s'arrête donc à mi-distance du
     morceau de route le plus proche de ce côté (calcul exact pour des points : |P_j − P_i|² / (2 n·(P_j − P_i))), et sa hauteur
     rejoint en douceur celle de l'autre côté. La fenêtre est élargie (1,5 km derrière, 2,25 km devant, coupes de 10 m) pour
     que les branches voisines aient déjà leur terrain. */
  const AR_LOIN = 75, AV_LOIN = 113, PAS_LOIN = 20,   // (v69) coupes lointaines tous les 20 m (au lieu de 10) : terrain recalculé plus vite
    N_TOT = AR_LOIN + N_SEC + AV_LOIN;
  const zone = { actif: false, dA: 0, dB: 0, dist: new Float32Array(N_TOT), x: new Float32Array(N_TOT), z: new Float32Array(N_TOT),
    h: new Float32Array(N_TOT), alt: new Float32Array(N_TOT), um: new Float32Array(N_TOT * 2), mh: new Float32Array(N_TOT * 2) };
  function preparerZone(base) {
    zone.actif = true;
    zone.dA = (base - DERRIERE) * PAS; zone.dB = zone.dA + (N_SEC - 1) * PAS;
    for (let i = 0; i < N_TOT; i++) {
      const d = i < AR_LOIN ? zone.dA - (AR_LOIN - i) * PAS_LOIN : i < AR_LOIN + N_SEC ? zone.dA + (i - AR_LOIN) * PAS : zone.dB + (i - AR_LOIN - N_SEC + 1) * PAS_LOIN;
      posChemin(d, _p);
      zone.dist[i] = d; zone.x[i] = _p[0]; zone.z[i] = _p[1]; zone.h[i] = cap(d); zone.alt[i] = alt3d(d);
    }
    const X = zone.x, Z = zone.z;
    for (let i = 0; i < N_TOT; i++) {
      const nx = Math.cos(zone.h[i]), nz = Math.sin(zone.h[i]);
      let b0 = Infinity, b1 = Infinity, j0 = -1, j1 = -1;           // côté gauche (u < 0) et côté droit (u > 0)
      for (let j = 0; j < N_TOT; j++) {
        const dx = X[j] - X[i], dz = Z[j] - Z[i], pn = dx * nx + dz * nz, l2 = dx * dx + dz * dz;
        if (pn * pn < 1e-6 * l2 || j === i) continue;
        if (pn > 0) { const q = l2 / (2 * pn); if (q < b1) { b1 = q; j1 = j; } }
        else { const q = l2 / (-2 * pn); if (q < b0) { b0 = q; j0 = j; } }
      }
      for (const [s, b, j] of [[0, b0, j0], [1, b1, j1]]) {
        if (j < 0 || b > 600) { zone.um[i * 2 + s] = Infinity; zone.mh[i * 2 + s] = NaN; continue; }
        // hauteur de rencontre : moyenne des deux côtés à mi-distance (la même vue de chacune des deux branches)
        const sj = (X[i] - X[j]) * Math.cos(zone.h[j]) + (Z[i] - Z[j]) * Math.sin(zone.h[j]) < 0 ? -1 : 1;
        zone.um[i * 2 + s] = b;
        zone.mh[i * 2 + s] = 0.5 * (zone.alt[i] + reliefBrut(zone.dist[i], (s ? 1 : -1) * b) + zone.alt[j] + reliefBrut(zone.dist[j], sj * b));
      }
    }
  }
  const _lz = [0, 0];
  function limiteZone(d, s) {
    let t = d < zone.dA ? AR_LOIN - (zone.dA - d) / PAS_LOIN : d <= zone.dB ? AR_LOIN + (d - zone.dA) / PAS : AR_LOIN + N_SEC - 1 + (d - zone.dB) / PAS_LOIN;
    t = Math.min(Math.max(t, 0), N_TOT - 1.001);
    const i = Math.floor(t), f = t - i;
    _lz[0] = Math.min(zone.um[i * 2 + s], zone.um[(i + 1) * 2 + s]);
    const ma = zone.mh[i * 2 + s], mb = zone.mh[(i + 1) * 2 + s];
    _lz[1] = isNaN(ma) ? mb : isNaN(mb) ? ma : ma + (mb - ma) * f;
    return _lz;
  }
  // le point (d, u) appartient-il à un autre morceau de route (décor à masquer) ?
  function horsZone(d, u) { if (!zone.actif) return false; limiteZone(d, u < 0 ? 0 : 1); return Math.abs(u) > _lz[0]; }
  // hauteur du terrain au point (d, u), au-dessus de la route : rejoint la hauteur de rencontre près de la limite
  function relief(d, u) {
    const rb = reliefBrut(d, u);
    if (!zone.actif) return rb;
    limiteZone(d, u < 0 ? 0 : 1);
    const U = _lz[0] * 1.03, M = _lz[1];
    if (!(U < 1e5) || isNaN(M)) return rb;
    const t = Math.abs(u) / U;
    return t <= 0.45 ? rb : rb + (M - alt3d(d) - rb) * lisse01((t - 0.45) / 0.55);
  }
  // colonne j de la coupe i : position (resserrée près de la limite) et hauteur
  const _zc = [0, 0];
  function colonneZone(i, u0, dist, y0) {
    const s = u0 < 0 ? 0 : 1, U = zone.um[i * 2 + s] * 1.03, M = zone.mh[i * 2 + s], a0 = Math.abs(u0);
    if (!(U < 1e5)) { _zc[0] = u0; _zc[1] = reliefBrut(dist, u0); return _zc; }
    const c = 0.55 * U, ae = a0 <= c ? a0 : c + (U - c) * (1 - Math.exp(-(a0 - c) / (0.45 * U)));
    const u = s ? ae : -ae, t = ae / U;
    let rb = reliefBrut(dist, u);
    if (t > 0.45 && !isNaN(M)) rb += (M - y0 - rb) * lisse01((t - 0.45) / 0.55);
    _zc[0] = u; _zc[1] = rb;
    return _zc;
  }

  /* ---------- Relief et couleurs du terrain ---------- */
  function reliefBrut(d, u) {
    if (th.mer) return reliefMer(d, u);
    const a = Math.abs(u);
    if (a <= 6) return 0;
    const k = lisse01((a - 6) / th.largeur);
    let n = 0.5 + 0.5 * (0.55 * Math.sin(d * F(0.0105) + u * 0.021 + 1.3) + 0.3 * Math.sin(d * F(0.023) - u * 0.034 + 4.0) + 0.15 * Math.sin(d * F(0.057) + u * 0.05));
    let amp = route && route.amplitude !== undefined ? route.amplitude : th.amplitude;   // (v69 suite) route.amplitude : relief des environs propre au monde (plaine)
    if (th.conifere) {      // montagne : crêtes vives (bruit « en arête »), plus hautes quand la route monte
      const r1 = 1 - Math.abs(Math.sin(d * F(0.0093) + u * 0.019 + 1.3)), r2 = 1 - Math.abs(Math.sin(d * F(0.021) - u * 0.031 + 4.0)), r3 = 1 - Math.abs(Math.sin(d * F(0.049) + u * 0.044));
      n = 0.45 * n + 0.55 * (0.55 * r1 + 0.3 * r2 + 0.15 * r3);
      amp *= 0.7 + 0.6 * lisse01((alt3d(d) - 650) / 1500);
    }
    else if (th.desert) {   // désert : longues dunes aux arêtes marquées
      const r1 = 1 - Math.abs(Math.sin(d * F(0.0071) + u * 0.0125 + 0.8)), r2 = 1 - Math.abs(Math.sin(d * F(0.016) - u * 0.02 + 2.2));
      n = 0.5 * n + 0.5 * (0.65 * r1 + 0.35 * r2);
    }
    n = Math.pow(Math.min(1, Math.max(0, n)), th.pic);
    const ondul = 1.2 * Math.min(1, (a - 6) / 20) * Math.sin(d * F(0.045) + u * 0.11);
    const r = amp * k * (0.2 + 0.8 * n) + ondul;
    return th.desert ? r * (1 - 0.92 * oasis(d, u)) : r;          // le sable s'aplanit autour des oasis
  }
  // oasis du désert : une tous les 1,7 km environ, d'un côté ou de l'autre ; renvoie 0 (loin) à 1 (au bord de l'eau)
  let cOasis = null;
  function oasisInfo(d) {
    const dt = dl(d), b = Math.round((dt - 850) / 1700), c = b * 1700 + 850 + (d - dt);
    if (b < 1 || b * 1700 + 850 > (LB || 1e9) - 400 || hash(b * 7.31 + 2) > 0.62) return null;
    const cote = hash(b * 3.17 + 5) < 0.5 ? -1 : 1;
    return { c, cote, u0: cote * (52 + 26 * hash(b * 5.71 + 1)) };
  }
  function oasis(d, u) {
    const o = oasisInfo(d);
    if (!o) return 0;
    const x = (d - o.c) / 78, y = (u - o.u0) / 40;
    return Math.exp(-(x * x + y * y));
  }

  // Ardennes : part de forêt le long de la route (0 = clairière ou pré, 1 = forêt dense), jamais dans les villages
  function foretA(d) {
    const f = 0.42 + 0.5 * Math.sin(d * F(0.0011) + 0.7) + 0.3 * Math.sin(d * F(0.0037) + 2.1);
    return lisse01(f * 2.2) * (1 - ville(d));
  }
  // Ardennes : ruisseau qui serpente à droite de la route dans une partie des vallées (position u, ou null)
  function ruisseau(d) {
    if (!th || !th.ardennes || Math.sin(d * F(0.0009) + 1.2) < -0.1) return null;
    return 13 + 5 * Math.sin(d * F(0.0071)) + 3 * Math.sin(d * F(0.017) + 0.6);
  }
  let cRuis = null, cTosc = null;
  // Toscane : secteur de chemin blanc à la distance d ? (route.secteurs [début, fin, nom])
  function secteur(d) {
    const z = route && route.secteurs;
    if (!z) return false;
    d = dl(d);
    return z.some((q) => d >= q[0] - 4 && d <= q[1] + 4);
  }
  function couleurTerrain(d, u, rel, out) {
    const c = th.c, a = Math.abs(u);
    const n1 = 0.5 + 0.5 * Math.sin(d * F(0.021) + u * 0.043 + 0.7 * Math.sin(d * F(0.007)));
    const n2 = 0.5 + 0.5 * Math.sin(d * F(0.083) + u * 0.121 + 1.7);
    out.copy(c.herbe1).lerp(c.herbe2, n1 * 0.8 + n2 * 0.2);
    if (th.mer) { couleurMer(d, u, n1, n2, out); if (a < 9) out.lerp(c.accotement, Math.min(1, (9 - a) / 4)); return; }
    if (th.toscane) {                                   // damier de champs : blé doré, prés verts, terre labourée, herbe sèche
      if (!cTosc) cTosc = { labour: new T.Color(0x7d5e40), blanc: new T.Color(0xe2dccd) };
      if (a > 11) {
        const bd = Math.floor(dl(d) / 190), bu = Math.floor((a - 11) / 55), hh = hash(bd * 3.17 + bu * 7.31 + (u < 0 ? 1.9 : 4.3));
        const pc = hh < 0.34 ? c.champ : hh < 0.55 ? c.champ2 : hh < 0.7 ? cTosc.labour : null;
        if (pc) out.lerp(pc, 0.92 * lisse01((a - 11) / 4));
      }
      out.lerp(c.clair, Math.min(0.2, rel / 140));
      if (a < 9) out.lerp(secteur(d) ? cTosc.blanc : c.accotement, Math.min(1, (9 - a) / 4));   // poussière blanche le long du chemin
      return;
    }
    if (th.ardennes) {
      const f = foretA(d);
      out.lerp(c.champ2, 0.7 * f * lisse01((a - 8) / 10));                                      // sous-bois : mousse et feuilles mortes
      if (a > 14) out.lerp(c.champ, (1 - f) * 0.5 * lisse01((n1 - 0.4) * 3));                     // prés de fauche dans les clairières
      out.lerp(c.clair, Math.min(0.25, rel / 120));
      const ru = ruisseau(d);
      if (ru !== null) {
        if (!cRuis) cRuis = { berge: new T.Color(0x5b5a3e), eau: new T.Color(0x3d5f66), reflet: new T.Color(0x7fa3aa) };
        const e = Math.abs(u - ru);
        if (e < 3.2) out.lerp(cRuis.berge, lisse01((3.2 - e) / 1.2));
        if (e < 1.6) out.copy(cRuis.eau).lerp(cRuis.reflet, lisse01((1.6 - e) / 1.6) * 0.4);
      }
      if (a < 9) out.lerp(c.accotement, Math.min(1, (9 - a) / 4));
      return;
    }
    if (th.desert) {
      out.lerp(c.champ2, lisse01((n2 - 0.5) * 3) * 0.5);
      if (rel > 22) out.lerp(c.roche, Math.min(0.75, (rel - 22) / 50));
      if (a > 16) { const ch = Math.sin(d * F(0.013) + u * 0.031) * Math.sin(d * F(0.0071) - u * 0.019 + 2.0); if (ch > 0.3) out.lerp(c.champ, Math.min(0.7, (ch - 0.3) * 2)); }
      if (!cOasis) cOasis = { herbe: new T.Color(0x8fae4e), eau: new T.Color(0x3f9fc4), bord: new T.Color(0x7cc7c9) };
      const w = oasis(d, u);                     // oasis : herbe verte, puis l’eau au centre
      if (w > 0.12) out.lerp(cOasis.herbe, Math.min(1, (w - 0.12) * 2.2));
      if (w > 0.72) out.copy(cOasis.eau).lerp(cOasis.bord, lisse01((0.86 - w) / 0.14) * 0.6);
      out.lerp(th.horizon, lisse01((a - 170) / 250) * 0.7);
      if (a < 9) out.lerp(c.accotement, Math.min(1, (9 - a) / 4));
      return;
    }
    if (th.conifere) {
      const A = alt3d(d) + rel;                  // altitude réelle : prairie, puis roche, puis neige
      if (A < 1650 && a > 30) out.lerp(c.clair, Math.min(0.3, rel / 120));
      out.lerp(c.roche, lisse01((A - 1600) / 450) * 0.85);
      if (rel > 20) out.lerp(c.roche, Math.min(1, (rel - 20) / 45));
      let nv = lisse01((A - 2050) / 260) * (0.7 + 0.6 * n2);
      if (rel > 95) nv += Math.min(1, (rel - 95) / 25) * lisse01((A - 1450) / 450);
      if (nv > 0) out.lerp(c.neige, Math.min(1, nv));
    } else {
      if (a > 14) {
        const champ = Math.sin(d * F(0.013) + u * 0.031) * Math.sin(d * F(0.0071) - u * 0.019 + 2.0);
        if (champ > 0.25) out.lerp(c.champ, Math.min(1, (champ - 0.25) * 3));
        else if (champ < -0.5) out.lerp(c.champ2, Math.min(1, (-0.5 - champ) * 3));
      }
      out.lerp(c.clair, Math.min(0.35, rel / 90));
    }
    if (a < 9) out.lerp(c.accotement, Math.min(1, (9 - a) / 4));
  }

  /* ---------- Textures dessinées par le programme ---------- */
  function grainAsphalte(x, W, H, base) {          // asphalte doux : taches larges, grain fin, fissures, sans gros pixels
    x.fillStyle = base; x.fillRect(0, 0, W, H);
    const copies = (f) => { for (const oy of [-H, 0, H]) f(oy); };          // la texture se répète : on dessine aussi de l'autre côté
    for (let i = 0; i < 70; i++) {
      const px = Math.random() * W, py = Math.random() * H, r = 40 + Math.random() * 110, clair = Math.random() < 0.5;
      copies((oy) => {
        const g = x.createRadialGradient(px, py + oy, 0, px, py + oy, r);
        g.addColorStop(0, clair ? "rgba(255,255,255,0.055)" : "rgba(0,0,0,0.07)"); g.addColorStop(1, "rgba(0,0,0,0)");
        x.fillStyle = g; x.fillRect(px - r, py + oy - r, 2 * r, 2 * r);
      });
    }
    for (let i = 0; i < 9000; i++) {
      x.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255," + (0.03 + Math.random() * 0.06) + ")" : "rgba(0,0,0," + (0.04 + Math.random() * 0.07) + ")";
      const s = 0.8 + Math.random() * 1.6; x.fillRect(Math.random() * W, Math.random() * H, s, s);
    }
    x.lineCap = "round";
    for (let i = 0; i < 7; i++) {                   // fissures fines
      let px = Math.random() * W, py = Math.random() * H;
      x.strokeStyle = "rgba(15,15,18,0.32)"; x.lineWidth = 1 + Math.random(); x.beginPath(); x.moveTo(px, py);
      for (let k = 0; k < 9; k++) { px += (Math.random() - 0.5) * 34; py += 14 + Math.random() * 22; x.lineTo(px, py); }
      x.stroke();
    }
  }
  function texRoute(style) {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 512; c.height = 1024;
    const x = c.getContext("2d");
    grainAsphalte(x, 512, 1024, "#3b3e45");
    for (const [a, b] of [[120, 210], [300, 390]]) {                   // traces des roues, bords adoucis
      const g = x.createLinearGradient(a, 0, b, 0);
      g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.5, "rgba(0,0,0,0.16)"); g.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = g; x.fillRect(a, 0, b - a, 1024);
    }
    const ligne = (px, py, w, h, col) => {                              // peinture un peu usée sur les bords
      x.fillStyle = col; x.fillRect(px, py, w, h);
      for (let i = 0; i < Math.max(6, h / 6); i++) { x.fillStyle = "rgba(59,62,69," + (0.25 + Math.random() * 0.4) + ")"; x.fillRect(px + Math.random() * w, py + Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 5); }
    };
    ligne(22, 0, 14, 1024, "#e6e9ee"); ligne(476, 0, 14, 1024, "#e6e9ee");   // lignes de rive
    if (style === "jaune") { ligne(224, 0, 14, 1024, "#e2b52c"); ligne(274, 0, 14, 1024, "#e2b52c"); }
    else ligne(249, 0, 14, 256, "#e6e9ee");                              // pointillés (3 m sur 12 m)
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.anisotropy = 8;
    if (T.sRGBEncoding) t.encoding = T.sRGBEncoding;
    return t;
  }

  function texHerbe() {
    if (typeof document === "undefined") return null;
    if (decorOk() && DECOR.tex.herbe) return texDecor("herbe");          // brins d'herbe dessinés par outils/blender_decor.py
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const x = c.getContext("2d");
    x.fillStyle = "#f4f4f4"; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      const g = 205 + Math.floor(Math.random() * 50);
      x.fillStyle = "rgba(" + g + "," + g + "," + g + ",0.45)";
      const px = Math.random() * 256, py = Math.random() * 256, r = 1 + Math.random() * 6;
      for (const dx of [-256, 0, 256]) for (const dy of [-256, 0, 256]) {
        x.beginPath(); x.arc(px + dx, py + dy, r, 0, 6.2832); x.fill();
      }
    }
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.anisotropy = 4;
    if (T.sRGBEncoding) t.encoding = T.sRGBEncoding;
    return t;
  }

  // sable du désert : petites rides parallèles et grains (la couleur vient du terrain)
  let texSableCache = null;
  function texSable() {
    if (decorOk() && DECOR.tex.sable) return texDecor("sable");
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const x = c.getContext("2d");
    x.fillStyle = "#f6f6f6"; x.fillRect(0, 0, 256, 256);
    x.lineCap = "round";
    for (let i = 0; i < 26; i++) {                    // rides : vagues fines qui se répètent sans couture
      const y0 = i * 256 / 26, a = 2 + Math.random() * 3, ph = Math.random() * 6.28;
      for (const dy of [-256, 0, 256]) {
        x.strokeStyle = "rgba(150,150,150,0.35)"; x.lineWidth = 2.2; x.beginPath();
        for (let px = 0; px <= 256; px += 8) { const py = y0 + dy + a * Math.sin(px / 256 * 6.283 * 2 + ph); if (px) x.lineTo(px, py); else x.moveTo(px, py); }
        x.stroke();
        x.strokeStyle = "rgba(255,255,255,0.5)"; x.lineWidth = 1.4; x.beginPath();
        for (let px = 0; px <= 256; px += 8) { const py = y0 + dy + 2.5 + a * Math.sin(px / 256 * 6.283 * 2 + ph); if (px) x.lineTo(px, py); else x.moveTo(px, py); }
        x.stroke();
      }
    }
    for (let i = 0; i < 3500; i++) { const g = 190 + Math.floor(Math.random() * 60); x.fillStyle = "rgba(" + g + "," + g + "," + g + ",0.5)"; x.fillRect(Math.random() * 256, Math.random() * 256, 1.2, 1.2); }
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4;
    if (T.sRGBEncoding) t.encoding = T.sRGBEncoding;
    return t;
  }

  function texLueur() {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const x = c.getContext("2d");
    const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "rgba(255,246,220,1)");
    g.addColorStop(0.15, "rgba(255,238,195,0.7)");
    g.addColorStop(0.45, "rgba(255,228,175,0.2)");
    g.addColorStop(1, "rgba(255,220,160,0)");
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    return new T.CanvasTexture(c);
  }

  /* ---------- Géométries ---------- */
  function fusionner(geos) {
    const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
    let n = 0;
    for (const g of parts) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
    let o = 0;
    for (const g of parts) {
      pos.set(g.attributes.position.array, o * 3);
      nor.set(g.attributes.normal.array, o * 3);
      o += g.attributes.position.count;
    }
    const out = new T.BufferGeometry();
    out.setAttribute("position", new T.BufferAttribute(pos, 3));
    out.setAttribute("normal", new T.BufferAttribute(nor, 3));
    return out;
  }
  function ajouterDegrade(g, bas, haut) {
    const p = g.attributes.position, n = p.count;
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < n; i++) { const y = p.getY(i); if (y < mn) mn = y; if (y > mx) mx = y; }
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = bas + (haut - bas) * ((p.getY(i) - mn) / ((mx - mn) || 1));
      c[i * 3] = v; c[i * 3 + 1] = v; c[i * 3 + 2] = v;
    }
    g.setAttribute("color", new T.BufferAttribute(c, 3));
    return g;
  }
  function lobe(r, x, y, z, sx, sy, sz) {
    const g = new T.IcosahedronGeometry(r, 1);
    g.scale(sx, sy, sz); g.translate(x, y, z);
    return g;
  }
  function cone(r, h, y) { const g = new T.ConeGeometry(r, h, 9); g.translate(0, y, 0); return g; }
  // feuillu : une couronne faite de sept touffes de tailles différentes (plus sombres en bas), sommet vers 5,4 m
  const geoFeuillus = () => ajouterDegrade(fusionner([
    lobe(1.35, 0, 3.3, 0, 1.15, 0.95, 1.1),
    lobe(1.05, 0.95, 2.95, 0.45, 1, 0.9, 1), lobe(1.0, -0.85, 3.05, -0.55, 1, 0.9, 1),
    lobe(0.95, 0.35, 3.0, -1.0, 1, 0.9, 1), lobe(0.9, -0.5, 3.2, 0.95, 1, 0.9, 1),
    lobe(0.95, 0.15, 4.35, 0.1, 1, 0.95, 1), lobe(0.7, 0.75, 4.0, -0.35, 1, 1, 1)]), 0.5, 1.12);
  // sapin : cinq étages légèrement tournés les uns par rapport aux autres, sommet vers 6,9 m
  const geoPin = () => {
    const etage = (r, h, y, rot) => { const g = new T.ConeGeometry(r, h, 7); g.rotateY(rot); g.translate(0, y, 0); return g; };
    return ajouterDegrade(fusionner([etage(1.85, 2.4, 2.7, 0), etage(1.55, 2.2, 3.7, 0.45), etage(1.25, 2.0, 4.65, 0.9), etage(0.95, 1.8, 5.55, 1.35), etage(0.6, 1.3, 6.3, 1.8)]), 0.5, 1.12);
  };
  // tronc : légèrement évasé au pied, avec deux départs de branches
  const geoTronc = () => {
    const t = new T.CylinderGeometry(0.13, 0.27, 3.0, 6); t.translate(0, 1.5, 0);
    const pied = new T.ConeGeometry(0.4, 0.55, 6); pied.translate(0, 0.27, 0);
    const b1 = new T.CylinderGeometry(0.05, 0.08, 1.2, 5); b1.rotateZ(-0.8); b1.translate(0.42, 2.45, 0);
    const b2 = new T.CylinderGeometry(0.045, 0.075, 1.0, 5); b2.rotateX(0.75); b2.translate(0, 2.2, 0.36);
    return fusionner([t, pied, b1, b2]);
  };
  // ombre douce posée au sol sous les arbres (en plus des vraies ombres) : les arbres paraissent bien posés
  let matOmbreCache = null;
  const geoOmbre = () => { const g = new T.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); return g; };
  function matOmbre() {
    if (matOmbreCache) return matOmbreCache;
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const x = c.getContext("2d"), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(0,0,0,0.5)"); g.addColorStop(0.55, "rgba(0,0,0,0.28)"); g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    matOmbreCache = new T.MeshBasicMaterial({ map: new T.CanvasTexture(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
    return matOmbreCache;
  }
  const geoBuisson = () => ajouterDegrade(fusionner([
    lobe(0.7, 0, 0.5, 0, 1.1, 0.8, 1.1), lobe(0.5, 0.6, 0.4, 0.2, 1, 0.8, 1), lobe(0.5, -0.5, 0.4, -0.2, 1, 0.8, 1)]), 0.6, 1.1);

  /* ---------- Décor fabriqué dans Blender (js/decor.js, outils/blender_decor.py) ----------
     formes : position (Int16 × s), normale, couleur (sRGB 8 bits -> linéaire), uv, « aVeg » (x = balancement au vent, y = feuillage) ;
     végétation : une seule matière (atlas de feuilles et d'écorces) ; la couleur de l'arbre (saison) ne teinte que le feuillage ;
     forêts : chaque arbre est un enregistrement { x, y, z, r, sx, sy, sz, v = essence, c = couleur }, rangé à chaque mise à jour
     dans le maillage proche (détaillé), lointain avec ombre, ou lointain sans ombre de son essence. */
  const decorOk = () => typeof DECOR !== "undefined" && !!DECOR.geos;
  const geosDecor = {};
  function geoDecor(nom) {
    if (geosDecor[nom] !== undefined) return geosDecor[nom];
    const d = decorOk() && DECOR.geos[nom];
    if (!d) return (geosDecor[nom] = null);
    const q = new Int16Array(binV(d.p)), p = new Float32Array(q.length);
    for (let i = 0; i < q.length; i++) p[i] = q[i] * d.s;
    const c8 = new Uint8Array(binV(d.c)), c = new Float32Array(c8.length);
    for (let i = 0; i < c8.length; i++) c[i] = Math.pow(c8[i] / 255, 2.2);
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(p, 3));
    g.setAttribute("normal", new T.BufferAttribute(new Int8Array(binV(d.n)), 3, true));
    g.setAttribute("color", new T.BufferAttribute(c, 3));
    if (d.t) g.setAttribute("uv", new T.BufferAttribute(new Uint16Array(binV(d.t)), 2, true));
    if (d.v) g.setAttribute("aVeg", new T.BufferAttribute(new Uint8Array(binV(d.v)), 2, true));
    const ib = binV(d.i); g.setIndex(new T.BufferAttribute(p.length / 3 > 65535 ? new Uint32Array(ib) : new Uint16Array(ib), 1));
    g.computeBoundingBox(); g.computeBoundingSphere();
    return (geosDecor[nom] = g);
  }
  const texsDecor = {};
  function texDecor(nom) {
    if (texsDecor[nom] !== undefined) return texsDecor[nom];
    if (!decorOk() || !DECOR.tex[nom]) return (texsDecor[nom] = null);
    const t = new T.TextureLoader().load(DECOR.tex[nom]);
    t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8;
    if (T.sRGBEncoding) t.encoding = T.sRGBEncoding;
    return (texsDecor[nom] = t);
  }
  // atlas de la végétation : couleurs (JPEG) et transparence (PNG gris) réunies dans une texture de 2048 × 2048
  let atlasVeg = null;
  function texVegetation() {
    if (atlasVeg) return atlasVeg;
    const N = 2048, data = new Uint8Array(N * N * 4);
    atlasVeg = new T.DataTexture(data, N, N);
    atlasVeg.wrapS = atlasVeg.wrapT = T.ClampToEdgeWrapping;
    atlasVeg.magFilter = T.LinearFilter; atlasVeg.minFilter = T.LinearMipmapLinearFilter; atlasVeg.generateMipmaps = true; atlasVeg.anisotropy = 8;
    if (T.sRGBEncoding) atlasVeg.encoding = T.sRGBEncoding;
    if (!decorOk() || typeof document === "undefined") return atlasVeg;
    const ic = new Image(), ia = new Image();
    let n = 0;
    const fin = () => {
      if (++n < 2) return;
      try {
        const cv = document.createElement("canvas"); cv.width = cv.height = N;
        const x = cv.getContext("2d");
        x.drawImage(ic, 0, 0); const dc = x.getImageData(0, 0, N, N).data;
        x.drawImage(ia, 0, 0); const da = x.getImageData(0, 0, N, N).data;
        for (let y = 0; y < N; y++) {                 // la ligne 0 de la texture est le bas de l'image
          const s = y * N * 4, o = (N - 1 - y) * N * 4;
          for (let i = 0; i < N * 4; i += 4) { data[o + i] = dc[s + i]; data[o + i + 1] = dc[s + i + 1]; data[o + i + 2] = dc[s + i + 2]; data[o + i + 3] = da[s + i]; }
        }
        atlasVeg.needsUpdate = true;
      } catch (err) { /* atlas indisponible : la végétation reste invisible plutôt que de bloquer le jeu */ }
    };
    ic.onload = ia.onload = fin;
    ic.src = DECOR.tex.vegetation; ia.src = DECOR.tex.vegetation_a;
    return atlasVeg;
  }
  const uVeg = { uTemps: { value: 0 }, uVent: { value: 1 } };
  const VEG_PARS = "attribute vec2 aVeg;\nuniform float uTemps;\nuniform float uVent;\nuniform float uSansF;\n";
  const VEG_VS = [
    "vec2 ipv = vec2(0.0);",
    "#ifdef USE_INSTANCING",
    "  ipv = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);",
    "#endif",
    "float phv = dot(ipv, vec2(0.37, 0.61)), bal = aVeg.x * uVent;",          // balancement : lent (branches) + rapide (feuilles), déphasé d'un arbre à l'autre
    "transformed.x += bal * (0.07 * sin(uTemps * 1.5 + phv + position.y * 0.45) + 0.025 * sin(uTemps * 4.1 + phv * 1.7 + position.x * 2.3));",
    "transformed.z += bal * (0.05 * cos(uTemps * 1.2 + phv * 0.8 + position.y * 0.4) + 0.025 * sin(uTemps * 3.6 + position.z * 2.1));",
    "if (uSansF > 0.5 && aVeg.y > 0.5) transformed = vec3(0.0);"                 // hiver : les feuillus perdent leurs feuilles
  ].join("\n");
  const VEG_COULEUR = [
    "#if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )",
    "  vColor = vec3( 1.0 );",
    "#endif",
    "#ifdef USE_COLOR",
    "  vColor *= color;",
    "#endif",
    "#ifdef USE_INSTANCING_COLOR",
    "  vColor.xyz *= mix(vec3(1.0), instanceColor.xyz, aVeg.y);",
    "#endif"].join("\n");
  function matVegetation(sansFeuilles) {
    const tex = texVegetation();
    const u = { uTemps: uVeg.uTemps, uVent: uVeg.uVent, uSansF: { value: sansFeuilles ? 1 : 0 } };
    const m = new T.MeshLambertMaterial({ color: 0xffffff, map: tex, vertexColors: true, alphaTest: 0.5, side: T.DoubleSide });
    m.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, u);
      s.vertexShader = VEG_PARS + s.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n" + VEG_VS).replace("#include <color_vertex>", VEG_COULEUR);
      // au loin, la transparence est renforcée (sinon les feuilles fondent avec les mipmaps) ; les deux faces des plaques gardent la normale du feuillage
      s.fragmentShader = s.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\n{ vec2 dd = max(abs(dFdx(vUv)), abs(dFdy(vUv))) * 2048.0; diffuseColor.a *= 1.0 + 0.3 * max(0.0, log2(max(dd.x, dd.y))); }")
        .replace("#include <normal_fragment_begin>", T.ShaderChunk.normal_fragment_begin.replace(/normal\s*=\s*normal\s*\*\s*faceDirection\s*;/g, ""));
    };
    m.customProgramCacheKey = () => "vegetation";
    const prof = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, map: tex, alphaTest: 0.5, side: T.DoubleSide });
    prof.onBeforeCompile = (s) => { Object.assign(s.uniforms, u); s.vertexShader = VEG_PARS + s.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n" + VEG_VS); };
    prof.customProgramCacheKey = () => "vegetation-ombre";
    m.userData.prof = prof;
    return m;
  }
  // maillage instancié de végétation (couleur par exemplaire, ombre découpée par la transparence)
  function instVegetation(geo, n, sansFeuilles) {
    const m = new T.InstancedMesh(geo, matVegetation(sansFeuilles), n);
    m.customDepthMaterial = m.material.userData.prof;
    m.instanceColor = new T.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3);
    m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  const ESPECES = { chene_a: 1, chene_b: 1, tilleul: 1, bouleau: 1, peuplier: 1, buisson: 1, sapin_a: 0, sapin_b: 0, pin_parasol: 0, olivier: 0, palmier: 0, dattier: 0, cactus: 0 };   // 1 = perd ses feuilles l'hiver
  const hauteurEspece = (v) => { const g = geoDecor(v + "_0"); return g ? g.boundingBox.max.y : 6; };
  function creerForet(cap, ajouter) { return { cap, recs: [], groupes: {}, sale: true, t: 0, ajouter }; }
  function groupeForet(F, esp, niv) {
    const cle = esp + "|" + niv;
    if (F.groupes[cle] !== undefined) return F.groupes[cle];
    const geo = geoDecor(esp + "_" + (niv ? 1 : 0));
    if (!geo) return (F.groupes[cle] = null);
    const m = instVegetation(geo, F.cap, ESPECES[esp] === 1 && saison === "hiver");
    m.count = 0; m.castShadow = niv < 2;
    F.ajouter(m);
    return (F.groupes[cle] = m);
  }
  const LOD_PROCHE = () => (qDens >= 1 ? 95 : qDens >= 0.8 ? 70 : 45), LOD_OMBRE = 140;
  function majForet(F, cx, cz) {
    const l0 = LOD_PROCHE() * LOD_PROCHE(), l1 = LOD_OMBRE * LOD_OMBRE, n = {};
    for (const k in F.groupes) n[k] = 0;
    for (const r of F.recs) {
      if (!r || !(r.sy > 0)) continue;
      const dx = r.x - cx, dz = r.z - cz, d2 = dx * dx + dz * dz, niv = d2 < l0 ? 0 : d2 < l1 ? 1 : 2;
      const m = groupeForet(F, r.v, niv);
      if (!m) continue;
      const cle = r.v + "|" + niv, i = n[cle] || 0;
      if (i >= F.cap) continue;
      n[cle] = i + 1;
      const a = m.instanceMatrix.array, o = i * 16, co = Math.cos(r.r), si = Math.sin(r.r);
      a[o] = co * r.sx; a[o + 1] = 0; a[o + 2] = -si * r.sx; a[o + 3] = 0;
      a[o + 4] = 0; a[o + 5] = r.sy; a[o + 6] = 0; a[o + 7] = 0;
      a[o + 8] = si * r.sz; a[o + 9] = 0; a[o + 10] = co * r.sz; a[o + 11] = 0;
      a[o + 12] = r.x; a[o + 13] = r.y; a[o + 14] = r.z; a[o + 15] = 1;
      const c = m.instanceColor.array; c[i * 3] = r.c.r; c[i * 3 + 1] = r.c.g; c[i * 3 + 2] = r.c.b;
    }
    for (const k in F.groupes) {
      const m = F.groupes[k];
      if (!m) continue;
      m.count = n[k] || 0; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
    }
    F.sale = false; F.t = 0;
  }
  function suivreForet(F, dt) {
    if (!F) return;
    F.t += dt;
    if (F.sale || F.t > 0.35) majForet(F, camera.position.x, camera.position.z);
  }
  let foretTheme = null, foretReel = null;
  // essence d'un arbre des mondes fabriqués
  function especeTheme(alea, grand) {
    const r = (alea * 7.31) % 1;
    if (th.kona) return r < 0.6 ? "palmier" : "dattier";
    if (th.palmiers) return r < 0.5 ? "palmier" : r < 0.82 ? "pin_parasol" : "olivier";
    if (th.cactus) return "cactus";
    if (th.conifere) return r < 0.5 ? "sapin_a" : "sapin_b";
    if (th.toscane) return r < 0.55 ? "olivier" : r < 0.8 ? "pin_parasol" : "chene_b";   // oliviers, pins parasols, chênes verts
    if (th.ardennes) return r < 0.21 ? "sapin_a" : r < 0.42 ? "sapin_b" : r < 0.62 ? "chene_a" : r < 0.8 ? "tilleul" : r < 0.92 ? "chene_b" : "bouleau";   // forêt mêlée
    if (grand < 0.12) return "peuplier";
    return r < 0.32 ? "chene_a" : r < 0.6 ? "chene_b" : r < 0.86 ? "tilleul" : "bouleau";
  }

  /* ---------- Construction de la scène ---------- */
  function creerTerrain() {
    const nv = N_TOT * NC;
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(new Float32Array(nv * 3), 3));
    g.setAttribute("color", new T.BufferAttribute(new Float32Array(nv * 3), 3));
    g.setAttribute("uv", new T.BufferAttribute(new Float32Array(nv * 2), 2));
    g.setAttribute("aSol", new T.BufferAttribute(new Float32Array(nv), 1));   // 1 + distance à l'axe de la route (0 : inconnue, mondes réels)
    g.setAttribute("aRue", new T.BufferAttribute(new Float32Array(nv * 2), 2));   // (v69) distance le long de la route (moins `rueOff`) et écart signé à l'axe : sol de la ville
    const idx = [];
    for (let i = 0; i < N_TOT - 1; i++) for (let j = 0; j < NC - 1; j++) {
      const a = i * NC + j, b = a + 1, c = a + NC, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
    g.setIndex(idx);
    const tH = texHerbe(); tH0 = tH;   // gardée : la ville de nuit retire la texture du sol
    if (!solU.uTerre.value) solU.uTerre.value = new T.Color(0x6e5a44);   // (Three.js n'est prêt qu'ici)
    matTerPlaine = new T.MeshLambertMaterial({ vertexColors: true, map: tH, bumpMap: tH, bumpScale: 0.9 });
    matTerMontagne = new T.MeshPhongMaterial({ vertexColors: true, map: tH, bumpMap: tH, bumpScale: 0.9, flatShading: true, shininess: 0, specular: 0x000000 });
    // sol sans répétition visible : la texture est lue deux fois (échelles et angles différents) et mélangée par taches, avec de grandes variations de clarté ;
    // détails ajoutés pixel par pixel (v68) : troisième lecture fine de près, herbe plus sèche ou plus foncée par plaques, terre nue, gravier et terre tassée
    // sur les bas-côtés avec une limite irrégulière ; relief des brins à la lumière (bumpMap = même texture). Couleurs de la terre selon le thème (uTerre).
    for (const m of [matTerPlaine, matTerMontagne]) {
      m.onBeforeCompile = (s) => {
        Object.assign(s.uniforms, solU);
        s.vertexShader = "attribute float aSol;\nattribute vec2 aRue;\nvarying float vSol;\nvarying vec2 vRue, vSolUv;\n" + s.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  vSol = aSol; vRue = aRue; vSolUv = uv;");
        s.fragmentShader = [
          "uniform vec3 uTerre; uniform float uTerreK, uSec, uDemi, uVille;",
          "varying float vSol; varying vec2 vRue, vSolUv;",
          "float hS(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }",
          "float bS(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);",
          "  return mix(mix(hS(i), hS(i + vec2(1.0, 0.0)), f.x), mix(hS(i + vec2(0.0, 1.0)), hS(i + vec2(1.0, 1.0)), f.x), f.y); }",
          "float fS(vec2 p) { return 0.5 * bS(p) + 0.3 * bS(p * 2.03 + 5.1) + 0.2 * bS(p * 4.01 + 9.7); }",
          s.fragmentShader].join("\n")
          .replace("#include <map_fragment>", [
          "  float solL = 1.0, solFin = 0.0;",
          "  vec2 solP = mod(vSolUv * 10.0, 2048.0);                    // position au sol en mètres (repliée tous les 2 km pour garder la précision)",
          "#ifdef USE_MAP",
          "  vec4 t1 = texture2D( map, vUv );",
          "  vec4 t2 = texture2D( map, mat2( 0.8, -0.6, 0.6, 0.8 ) * vUv * 0.31 + 0.37 );",
          "  float k = 0.5 + 0.5 * sin( vUv.x * 0.83 + 1.3 ) * sin( vUv.y * 0.61 + sin( vUv.x * 0.29 ) );",
          "  float macro = 0.93 + 0.07 * sin( vUv.x * 0.19 + sin( vUv.y * 0.13 ) * 2.0 ) * sin( vUv.y * 0.23 + 1.0 );",
          "  vec4 tm = mix( t1, t2, 0.25 + 0.5 * k ) * macro;",
          "  solFin = 1.0 - smoothstep( 0.05, 0.25, length( fwidth( solP * 3.0 ) ) );   // détails fins seulement de près (pas de scintillement au loin)",
          "  vec4 t3 = texture2D( map, mat2( 0.6, 0.8, -0.8, 0.6 ) * vUv * 3.3 + 0.11 );",
          "  tm.rgb *= mix( 1.0, 0.72 + 0.56 * t3.r, 0.55 * solFin );",
          "  solL = tm.r;",
          "  diffuseColor *= tm;",
          "#endif"].join("\n"))
          .replace("#include <color_fragment>", [
          "#include <color_fragment>",
          "  {",
          "    float bord = vSol < 0.5 ? 999.0 : vSol - 1.0;",
          "    float n1 = fS( solP * 0.07 ), n2 = fS( solP * 0.45 + 7.3 ), n4 = fS( solP * 0.3 + 11.7 );",
          "    float acc = 1.0 - smoothstep( uDemi + 1.4, uDemi + 5.5, bord + ( n2 - 0.5 ) * 2.6 );   // bas-côté de gravier, limite irrégulière",
          "    float herbe = 1.0 - acc;",
          "    vec3 c = diffuseColor.rgb;",
          "    c = mix( c, c * vec3( 1.16, 1.05, 0.66 ), uSec * 0.5 * smoothstep( 0.42, 0.78, n1 ) * herbe );   // herbe plus sèche par grandes plaques",
          "    c *= 1.0 - 0.13 * smoothstep( 0.5, 0.85, n2 ) * herbe;                                             // touffes plus denses, plus foncées",
          "    float use = smoothstep( uDemi + 4.5, uDemi + 2.0, bord ) * smoothstep( 0.35, 0.7, n2 );            // terre tassée au bord du gravier",
          "    float terre = max( smoothstep( 0.73, 0.82, n4 ) * herbe, use * 0.6 ) * uTerreK;                     // plaques de terre nue",
          "    c = mix( c, uTerre * ( 0.65 + 0.7 * solL ), terre * 0.85 );",
          "    float g1 = bS( solP * 7.0 ), g2 = bS( solP * 16.0 + 3.3 );                                         // gravier : petits cailloux clairs et sombres",
          "    c *= mix( 1.0, 0.82 + 0.36 * g1, acc * ( 0.4 + 0.6 * solFin ) );",
          "    c = mix( c, vec3( 0.86, 0.84, 0.8 ) * ( 0.8 + 0.2 * solL ), acc * solFin * 0.35 * smoothstep( 0.7, 0.9, g2 ) );",
          "    c *= 1.0 - 0.18 * ( 1.0 - smoothstep( uDemi + 0.15, uDemi + 0.9, bord ) );                         // salissure le long de l'asphalte",
          VILLE_SOL,
          "    diffuseColor.rgb = c;",
          "  }"].join("\n"));
      };
      m.customProgramCacheKey = () => "sol3" + (m.flatShading ? "f" : "");
    }
    terrain = new T.Mesh(g, matTerPlaine);
    terrain.frustumCulled = false;
    terrain.receiveShadow = true;
    scene.add(terrain);

    const gr = new T.BufferGeometry();
    gr.setAttribute("position", new T.BufferAttribute(new Float32Array(N_TOT * 2 * 3), 3));
    gr.setAttribute("uv", new T.BufferAttribute(new Float32Array(N_TOT * 2 * 2), 2));
    const ir = [];
    for (let i = 0; i < N_TOT - 1; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; ir.push(a, b, c, b, d, c); }
    gr.setIndex(ir);
    ruban = new T.Mesh(gr, new T.MeshLambertMaterial({ map: null, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    // secteurs de chemin blanc (Toscane) : la route est redessinée pixel par pixel en terre blanche damée, deux traces de roues, cailloux, herbe sur les bords
    rubU.uSect = { value: [0, 1, 2, 3, 4, 5].map(() => new T.Vector3(-1, -1, 0)) };   // (v69 suite) 6 secteurs ; z = 1 : pavés
    ruban.material.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, rubU);
      s.fragmentShader = [
        "uniform vec3 uSect[6]; uniform float uNS, uLoop, uUse;",
        "float hR(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }",
        "float bR(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);",
        "  return mix(mix(hR(i), hR(i + vec2(1.0, 0.0)), f.x), mix(hR(i + vec2(0.0, 1.0)), hR(i + vec2(1.0, 1.0)), f.x), f.y); }",
        s.fragmentShader].join("\n").replace("#include <map_fragment>", [
        "#ifdef USE_MAP",
        "  vec4 tr = texture2D( map, vUv );",
        // (v69 suite) route plus réaliste (low poly) : peinture usée, rustines d'enrobé, fissures, bords effrités ; détails estompés au loin
        "  {",
        "    float dU = vUv.y * 12.0; if (uLoop > 0.0) dU = mod(dU, uLoop);",
        "    vec2 Q = vec2(vUv.x * 7.0, mod(dU, 2048.0));",
        "    float fQ = 1.0 - smoothstep(0.3, 1.2, length(fwidth(Q * 6.0)));",
        "    float xa = uUse > 0.5 ? 0.0 : 0.2, xb = uUse > 0.5 ? 1.0 : 0.8;               // en ville : seulement la chaussée, pas les trottoirs",
        "    float dans = step(xa, vUv.x) * step(vUv.x, xb);",
        "    float xr = uUse > 0.5 ? 0.15 : 0.21;                                                // bitume propre (en ville : entre la ligne de rive et la trace des roues, pas le trottoir)",
        "    vec3 asp = texture2D( map, vec2(vUv.x < 0.5 ? xr : 1.0 - xr, vUv.y) ).rgb;",
        "    float lum = dot(tr.rgb, vec3(0.3, 0.59, 0.11)), lumA = dot(asp, vec3(0.3, 0.59, 0.11));",
        "    float peinture = smoothstep(lumA + 0.12, lumA + 0.3, lum) * dans;",
        "    float us = smoothstep(0.42, 0.7, 0.6 * bR(Q * vec2(5.0, 0.9)) + 0.4 * bR(Q * 3.0 + 9.0));",
        "    tr.rgb = mix(tr.rgb, asp, peinture * us * 0.75);                                    // peinture effacée par endroits",
        "    float cell = floor(dU / 37.0), ry = hR(vec2(cell, 3.7)), rx = hR(vec2(cell, 8.1));",
        "    float y0 = cell * 37.0 + ry * 20.0, ln = 3.0 + 9.0 * hR(vec2(cell, 1.3));",
        "    float x0 = mix(xa + 0.05, xb - 0.35, rx), wd = 0.12 + 0.2 * hR(vec2(cell, 5.5));",
        "    float rus = step(0.55, hR(vec2(cell, 2.2))) * step(y0, dU) * step(dU, y0 + ln) * step(x0, vUv.x) * step(vUv.x, x0 + wd);",
        "    tr.rgb = mix(tr.rgb, tr.rgb * vec3(0.72, 0.73, 0.76) * (0.94 + 0.12 * bR(Q * 9.0)), rus * (1.0 - peinture * 0.7));   // rustine plus sombre",
        "    float bordR = step(x0 - 0.004, vUv.x) * step(vUv.x, x0 + wd + 0.004) * step(y0 - 0.06, dU) * step(dU, y0 + ln + 0.06) * (1.0 - rus);",
        "    tr.rgb *= 1.0 - 0.25 * bordR * step(0.55, hR(vec2(cell, 2.2))) * fQ;                   // joint de la rustine",
        "    float fi = abs(bR(Q * vec2(1.6, 0.35) + 17.0) - 0.5);",
        "    float fiss = (1.0 - smoothstep(0.004, 0.012, fi)) * smoothstep(0.55, 0.8, bR(Q * 0.5 + 4.0)) * dans * fQ;",
        "    tr.rgb *= 1.0 - 0.45 * fiss;                                                          // fissures fines",
        "    if (uUse > 0.5) {                                                                     // bords effrités et rapiécés",
        "      float bd = min(vUv.x, 1.0 - vUv.x), irr = 0.018 + 0.03 * bR(Q * vec2(2.0, 1.1) + 2.0);",
        "      float eff = 1.0 - smoothstep(irr, irr + 0.012, bd);",
        "      tr.rgb = mix(tr.rgb, vec3(0.36, 0.34, 0.31) * (0.8 + 0.4 * bR(Q * 12.0)), eff * 0.8);",
        "      tr.rgb *= 1.0 - 0.12 * (1.0 - smoothstep(irr, irr + 0.06, bd)) * (1.0 - eff);",
        "    }",
        "  }",
        "  if (uNS > 0.5) {",
        "    float dR = vUv.y * 12.0; if (uLoop > 0.0) dR = mod(dR, uLoop);",
        "    float gS = 0.0, gP = 0.0;",
        "    for (int i = 0; i < 6; i++) { if (float(i) < uNS) { float m = smoothstep(uSect[i].x - 6.0, uSect[i].x + 6.0, dR) * (1.0 - smoothstep(uSect[i].y - 6.0, uSect[i].y + 6.0, dR)); if (uSect[i].z > 0.5) gP = max(gP, m); else gS = max(gS, m); } }",
        // (v69 suite) secteur pavé : pavés de 16 × 13 cm en rangs décalés, bombés, joints de terre, herbe et boue sur les bords, chaussée bombée ; détails estompés au loin
        "    if (gP > 0.0) {",
        "      vec2 P = vec2(vUv.x * 7.0, mod(dR, 2048.0));",
        "      vec2 c = P / vec2(0.16, 0.13); c.x += 0.5 * mod(floor(c.y), 2.0);",
        "      vec2 id = floor(c), f = fract(c), e = min(f, 1.0 - f);",
        "      float fA = 1.0 - smoothstep(0.25, 0.9, length(fwidth(c)));",
        "      float hp = hR(id + 3.1);",
        "      vec3 pv = mix(vec3(0.40, 0.38, 0.35), vec3(0.60, 0.57, 0.51), hp) * (0.86 + 0.28 * bR(P * 2.3));",
        "      pv *= 1.0 - 0.3 * dot(f - 0.5, f - 0.5) * 2.0;",
        "      float jt = smoothstep(0.02, 0.12, min(e.x * 0.8, e.y));",
        "      vec3 col = mix(vec3(0.25, 0.23, 0.19) * (0.8 + 0.4 * bR(P * 6.0)), pv, jt);",
        "      col = mix(vec3(0.43, 0.41, 0.37) * (0.86 + 0.28 * bR(P * 2.3)), col, fA);",
        "      col *= 0.86 + 0.14 * (1.0 - pow(abs(vUv.x - 0.5) * 2.0, 2.0));",
        "      float bord = smoothstep(0.09, 0.0, vUv.x) + smoothstep(0.91, 1.0, vUv.x);",
        "      col = mix(col, vec3(0.30, 0.31, 0.19) * (0.8 + 0.4 * bR(P * 3.0)), bord * (0.55 + 0.45 * bR(P * 1.7)));",
        "      tr.rgb = mix(tr.rgb, col, gP);",
        "    }",
        "    if (gS > 0.0) {",
        "      vec2 P = vec2(vUv.x * 7.0, mod(dR, 2048.0));",
        "      float n = 0.55 * bR(P * 1.3) + 0.3 * bR(P * 4.1 + 3.0) + 0.15 * mix(0.5, bR(P * 11.0 + 7.0), 1.0 - smoothstep(0.25, 0.9, length(fwidth(P * 11.0))));",
        "      vec3 g = vec3(0.70, 0.65, 0.55) * (0.86 + 0.26 * n);",
        "      float tr1 = exp(-pow((vUv.x - 0.3) / 0.06, 2.0)) + exp(-pow((vUv.x - 0.7) / 0.06, 2.0));",
        "      g *= 1.0 - 0.13 * tr1 * (0.7 + 0.3 * bR(P * 2.0));                          // deux traces de roues tassées",
        "      float fA = 1.0 - smoothstep(0.25, 0.9, length(fwidth(P * 22.0)));            // petits détails estompés au loin (pas de rayures)",
        "      float cx = mix(0.5, bR(P * 22.0), fA);",
        "      g = mix(g, vec3(0.88, 0.85, 0.78), smoothstep(0.82, 0.95, cx) * (1.0 - tr1 * 0.6));   // petits cailloux clairs",
        "      g *= 1.0 - 0.25 * fA * smoothstep(0.8, 0.97, bR(P * 17.0 + 5.0));             // et quelques sombres",
        "      float bord = smoothstep(0.1, 0.0, vUv.x) + smoothstep(0.9, 1.0, vUv.x);",
        "      g = mix(g, vec3(0.42, 0.40, 0.22), bord * (0.5 + 0.5 * bR(P * 3.0)));        // herbe qui mange les bords",
        "      tr.rgb = mix(tr.rgb, g, gS);",
        "    }",
        "  }",
        "  diffuseColor *= tr;",
        "#endif"].join("\n"));
    };
    ruban.material.customProgramCacheKey = () => "ruban3";
    ruban.frustumCulled = false;
    ruban.receiveShadow = true;
    scene.add(ruban);
  }

  function creerCiel() {
    const g = new T.SphereGeometry(1000, 24, 14);
    const n = g.attributes.position.count;
    g.setAttribute("color", new T.BufferAttribute(new Float32Array(n * 3), 3));
    // ciel : dégradé, voile clair sur l'horizon et halo autour du soleil (calculés pixel par pixel)
    ciel = new T.Mesh(g, new T.ShaderMaterial({
      uniforms: { uHaut: { value: new T.Color() }, uHor: { value: new T.Color() }, uSol: { value: new T.Vector3(0, 1, 0) }, uSolC: { value: new T.Color(1, 0.95, 0.85) }, uCouv: { value: 0 } },
      vertexShader: "varying vec3 vDir;\nvoid main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: [
        "uniform vec3 uHaut; uniform vec3 uHor; uniform vec3 uSol; uniform vec3 uSolC; uniform float uCouv; varying vec3 vDir;",
        "void main() {",
        "  vec3 d = normalize(vDir); float h = d.y;",
        "  vec3 c = mix(uHor, uHaut, pow(max(h, 0.0), 0.55));",
        "  c = mix(c, uHor * 1.03, exp(-abs(h) * 16.0) * 0.45);",
        "  if (h < 0.0) c = uHor * (1.0 - min(0.08, -h * 0.4));",
        "  float s = max(dot(d, normalize(uSol)), 0.0), clair = 1.0 - min(1.0, uCouv * 1.2);",
        "  c += uSolC * (pow(s, 6.0) * 0.16 + pow(s, 48.0) * 0.32 + pow(s, 900.0) * 0.6) * clair;",
        "  gl_FragColor = vec4(c, 1.0);",
        "  #include <encodings_fragment>",
        "}"].join("\n"),
      side: T.BackSide, fog: false, depthWrite: false }));
    ciel.renderOrder = -10;
    ciel.frustumCulled = false;
    scene.add(ciel);
  }
  function colorerCiel() {
    const U = ciel.material.uniforms;
    if (U) {
      U.uHaut.value.copy(th.haut); U.uHor.value.copy(th.horizon); U.uSol.value.set(SUN.x, SUN.y, SUN.z);
      if (lumiere) U.uSolC.value.copy(lumiere.color); U.uCouv.value = meteoVal.couv || 0;
      return;
    }
    const p = ciel.geometry.attributes.position, c = ciel.geometry.attributes.color;
    for (let i = 0; i < p.count; i++) {
      const t = Math.max(0, p.getY(i) / 1000);
      tmpC.copy(th.horizon).lerp(th.haut, Math.pow(t, 0.55));
      c.setXYZ(i, tmpC.r, tmpC.g, tmpC.b);
    }
    c.needsUpdate = true;
  }

  function creerNuages() {
    nuages = new T.Group();
    const tn = decorOk() && DECOR.tex.nuages ? texDecor("nuages") : null;
    if (tn) {                    // nuages dessinés (cumulus en images, toujours tournés vers la caméra) : 4 formes de l'image nuages
      const mats = [0, 1, 2, 3].map((k) => {
        const t = tn.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = T.ClampToEdgeWrapping;
        t.repeat.set(0.5, 0.5); t.offset.set((k % 2) * 0.5, k < 2 ? 0.5 : 0);
        return new T.SpriteMaterial({ map: t, color: 0xffffff, transparent: true, opacity: 0.95, fog: false, depthWrite: false });
      });
      for (let i = 0; i < 16; i++) {
        const g = new T.Group();
        const a = (i / 16) * Math.PI * 2 + hash(i) * 0.4, r = 480 + hash(i + 3) * 380, hauteur = 150 + hash(i + 7) * 140;
        for (let k = 0; k < 4; k++) {
          const s = new T.Sprite(mats[(i + k) % 4]);
          const l = 110 + hash(i * 5 + k) * 90;
          s.scale.set(l, l * 0.55, 1);
          s.position.set((k - 1.5) * 52 + hash(k + i) * 20, hash(k * 11 + i) * 14, hash(k + 2 * i) * 30);
          g.add(s);
        }
        g.position.set(Math.cos(a) * r, hauteur, Math.sin(a) * r);
        nuages.add(g);
      }
    }
    const mat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, fog: false, depthWrite: false });
    const geo = new T.IcosahedronGeometry(1, 1);
    for (let i = 0; i < (tn ? 0 : 9); i++) {
      const g = new T.Group();
      const a = (i / 9) * Math.PI * 2 + hash(i) * 0.5, r = 450 + hash(i + 3) * 350, hauteur = 140 + hash(i + 7) * 130;
      for (let k = 0; k < 5; k++) {
        const m = new T.Mesh(geo, mat);
        m.scale.set(30 + hash(i * 5 + k) * 30, 12 + hash(i + k) * 8, 22 + hash(k * 3 + i) * 14);
        m.position.set((k - 2) * 32 + hash(k + i) * 14, hash(k * 11 + i) * 8, hash(k + 2 * i) * 20);
        g.add(m);
      }
      g.position.set(Math.cos(a) * r, hauteur, Math.sin(a) * r);
      nuages.add(g);
    }
    scene.add(nuages);
    soleil = new T.Mesh(new T.SphereGeometry(24, 16, 12), new T.MeshBasicMaterial({ color: 0xfff6dc, fog: false }));
    scene.add(soleil);
    const tl = texLueur();
    if (tl) {
      lueur = new T.Sprite(new T.SpriteMaterial({ map: tl, blending: T.AdditiveBlending, transparent: true, depthWrite: false, fog: false, opacity: 0.85 }));
      lueur.scale.set(560, 560, 1);
      lueur.renderOrder = -5;
      scene.add(lueur);
    }
  }

  let decor = [];
  function creerArbres() {
    for (const m of decor) { scene.remove(m); jeter(m); }
    decor = [];
    foretTheme = null;
    const mat = (o) => new T.MeshLambertMaterial(o);
    if (decorOk() && geoDecor("chene_a_0")) {            // arbres, buissons et rochers fabriqués dans Blender
      troncs = feuillage = null;
      foretTheme = creerForet(N_ARBRES, (m) => { scene.add(m); decor.push(m); });
      buissons = instVegetation(geoDecor("buisson_0"), N_BUISSONS, saison === "hiver" && !th.desert && !th.kona);
      rochers = new T.InstancedMesh(geoDecor("rocher"), mat({ color: 0xffffff, vertexColors: true }), N_ROCHERS);
    } else {
      let tr = geoTronc();
      if (th.palmiers || th.cactus) { tr = new T.CylinderGeometry(0.15, 0.24, 2.4, 6); tr.translate(0, 1.2, 0); }   // palmier : tronc nu
      troncs = new T.InstancedMesh(tr, mat({ color: 0x6b4a2f }), N_ARBRES);
      feuillage = new T.InstancedMesh(th.palmiers ? geoPalme() : th.cactus ? geoCactus() : th.conifere ? geoPin() : geoFeuillus(), mat({ color: 0xffffff, vertexColors: true }), N_ARBRES);
      buissons = new T.InstancedMesh(geoBuisson(), mat({ color: 0xffffff, vertexColors: true }), N_BUISSONS);
      const rg = new T.IcosahedronGeometry(1, 0); rg.scale(1, 0.7, 1.15);
      rochers = new T.InstancedMesh(rg, th.facettes ? new T.MeshPhongMaterial({ color: 0xffffff, flatShading: true, shininess: 0, specular: 0x000000 }) : mat({ color: 0xffffff, flatShading: true }), N_ROCHERS);
    }
    ombres = new T.InstancedMesh(geoOmbre(), matOmbre().clone(), N_ARBRES);
    ombres.renderOrder = 1;
    for (const m of [troncs, feuillage, buissons, rochers, ombres]) {
      if (!m) continue;
      m.frustumCulled = false; m.receiveShadow = true;
      scene.add(m); decor.push(m);
    }
    if (troncs) { troncs.castShadow = true; feuillage.castShadow = true; }
    rochers.castShadow = true;
  }

  // maison des mondes fabriqués : les parties blanches prennent la couleur du thème (murs, toit), le reste garde sa teinte
  function geoMaisonMurs() {
    const { boite } = P3, parts = [boite(6, 3.4, 8.5, 0, 0, 0, 0xffffff), boite(6.12, 0.55, 8.62, 0, -0.05, 0, 0xc9c2b4)];
    const fenetre = (x, z, cote) => {        // cote : 1 = face ±x, 0 = face ±z
      const ep = (a, b) => (cote ? [a, b] : [b, a]);
      const [w1, d1] = ep(0.07, 1.05), [w2, d2] = ep(0.09, 0.82), [w3, d3] = ep(0.08, 0.42);
      parts.push(boite(w1, 1.3, d1, x, 1.0, z, 0xffffff), boite(w2, 1.05, d2, x * 1.003, 1.12, z * 1.003, 0x34485c));
      const o = cote ? [0, 0.68] : [0.68, 0];
      parts.push(boite(w3, 1.15, d3, x + o[0], 1.07, z + o[1], 0x5d8a62), boite(w3, 1.15, d3, x - o[0], 1.07, z - o[1], 0x5d8a62));
    };
    for (const s of [-1, 1]) for (const z of [-2.7, 0, 2.7]) { if (s > 0 && z === 0) continue; fenetre(s * 3.03, z, 1); }
    parts.push(boite(0.1, 2.15, 1.15, 3.04, 0, 0, 0x6b4127), boite(0.14, 0.12, 1.5, 3.06, 2.2, 0, 0xffffff));
    for (const s of [-1, 1]) fenetre(0, s * 4.28, 0);
    return fusionnerCouleur(parts);
  }
  function geoMaisonToit() {
    const { boite, prisme } = P3;
    return fusionnerCouleur([prisme(7.1, 2.5, 9.6, 0, 3.4, 0, 0xffffff), boite(0.85, 2.0, 0.85, 1.5, 4.0, 2.5, 0xa7a097), boite(1.0, 0.18, 1.0, 1.5, 6.0, 2.5, 0x6f6a64)]);
  }
  function creerDecorFixe() {
    murs = new T.InstancedMesh(geoDecor("maison_murs") || geoMaisonMurs(), new T.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }), N_MAISONS);
    toits = new T.InstancedMesh(geoDecor("maison_toit") || geoMaisonToit(), new T.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }), N_MAISONS);
    const p = new T.BoxGeometry(0.12, 0.9, 0.12); p.translate(0, 0.45, 0);
    poteaux = new T.InstancedMesh(p, new T.MeshLambertMaterial({ color: 0xf4f6f8 }), N_POTEAUX);
    for (const o of [murs, toits, poteaux]) { o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true; scene.add(o); }
  }

  /* ---------- Cycliste ---------- */
  const BBY = 0.30, BBZ = 0.08, R_MAN = 0.17, LJ = 0.47, HZ = 0.27, HY = 1.02;
  const BRAS1 = 0.30, BRAS2 = 0.29;
  const corps = {};
  let matMaillot = null, matPeau = null, matCheveux = null, matBas = null, matAccent = null, matBlanc = null, genre = "homme";
  const apparence = { peau: 0xe0ac82, cheveux: 0x3b2a1e, bas: 0x1c1f26, chaussettes: 0xf2f4f6, yeux: "marron", basStyle: "cuissard", coiffure: "court", barbe: "aucune", casque: false, lunettes: false, realiste: true };
  let stand = 0;

  function tube(rayon, mat, effile, cotes) { return new T.Mesh(new T.CylinderGeometry(rayon * (effile || 1), rayon, 1, cotes || 8), mat); }
  function placerTube(m, ax, ay, az, bx, by, bz) {
    vTmp.set(bx - ax, by - ay, bz - az);
    const L = vTmp.length() || 0.0001;
    m.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
    m.scale.set(1, L, 1);
    m.quaternion.setFromUnitVectors(vHaut, vTmp.multiplyScalar(1 / L));
  }
  // cinématique inverse à deux segments : renvoie le coude/genou dans _g (pôle = direction vers laquelle plie l'articulation)
  const _g = [0, 0, 0];
  const PROFILS = {};   // profils (rayon le long du membre) des muscles du cycliste
  // place une pièce de révolution (hauteur 1) le long du segment A->B
  function placerPiece(m, ax, ay, az, bx, by, bz, t0, t1) {
    placerTube(m, ax + (bx - ax) * t0, ay + (by - ay) * t0, az + (bz - az) * t0, ax + (bx - ax) * t1, ay + (by - ay) * t1, az + (bz - az) * t1);
  }
  function plier(ax, ay, az, bx, by, bz, l1, l2, px, py, pz) {
    let cx = bx - ax, cy = by - ay, cz = bz - az;
    let d = Math.hypot(cx, cy, cz) || 0.0001;
    const dm = Math.min(d, l1 + l2 - 0.002);
    cx /= d; cy /= d; cz /= d;
    const a = (l1 * l1 - l2 * l2 + dm * dm) / (2 * dm);
    const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const dot = px * cx + py * cy + pz * cz;
    let nx = px - cx * dot, ny = py - cy * dot, nz = pz - cz * dot;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    _g[0] = ax + cx * a + nx * h; _g[1] = ay + cy * a + ny * h; _g[2] = az + cz * a + nz * h;
    return _g;
  }

  // ===== corps réaliste : maillage d'un vrai modèle 3D, déformé sur le processeur (skinning) pour suivre le pédalage =====
  let Modele = null, ModeleH = null, ModeleF = null;
  // nouveau corps réaliste disponible pour le genre choisi (homme ou femme MakeHuman) ; sinon, l'ancien modèle
  const corpsReel = () => !!corps.modeleH && (genre === "homme" || !!ModeleF);
  function fabriquerModele(DATA, ech) {
    const dec = (b, Arr) => { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new Arr(u.buffer); };
    const NV = DATA.N;
    const nor0 = dec(DATA.n, Int8Array), G1 = dec(DATA.g1, Uint8Array), G2 = dec(DATA.g2, Uint8Array), WT = dec(DATA.w, Uint8Array);
    const sets = {};
    for (const g of ["femme", "homme"]) {
      if (!DATA[g]) continue;
      const d = DATA[g], q = dec(d.p, Int16Array), p = new Float32Array(NV * 3);
      for (let i = 0; i < NV * 3; i++) p[i] = q[i] * ech;
      sets[g] = { p, tri: dec(d.tri, Uint16Array), counts: d.counts, j: d.j };
    }
    const mat = new Float32Array(15 * 9), rot = new Float32Array(15 * 9), pb = new Float32Array(15 * 3), pn = new Float32Array(15 * 3);   // 15 os (le 15e : la tête du nouveau corps)
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
    const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
    const len = (a) => Math.hypot(a[0], a[1], a[2]);
    const unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    function rotAxe(k, ang) {          // rotation d'angle ang autour de l'axe unitaire k (matrice 3x3 en lignes)
      const c = Math.cos(ang), s = Math.sin(ang), t = 1 - c, x = k[0], y = k[1], z = k[2];
      return [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c];
    }
    function arc(a, b, part) {         // rotation la plus courte de a vers b (part : fraction de l'angle)
      const d = Math.max(-1, Math.min(1, dot(a, b))), k = cross(a, b), kl = len(k);
      if (kl < 1e-7) return d > 0 ? [1, 0, 0, 0, 1, 0, 0, 0, 1] : rotAxe(Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1], Math.PI * (part === undefined ? 1 : part));
      return rotAxe([k[0] / kl, k[1] / kl, k[2] / kl], Math.acos(d) * (part === undefined ? 1 : part));
    }
    function mm(A, B) { const C = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]; return C; }
    // matrice  R · (g·I + (s-g)·a·aᵀ) : épaisseur g, allongement s le long de l'axe a
    function etire(R, a, g, s) {
      const e = s - g, S = [g + e * a[0] * a[0], e * a[0] * a[1], e * a[0] * a[2], e * a[1] * a[0], g + e * a[1] * a[1], e * a[1] * a[2], e * a[2] * a[0], e * a[2] * a[1], g + e * a[2] * a[2]];
      return mm(R, S);
    }
    function regler(i, M, R, B, N) { for (let k = 0; k < 9; k++) { mat[i * 9 + k] = M[k]; rot[i * 9 + k] = R[k]; } for (let k = 0; k < 3; k++) { pb[i * 3 + k] = B[k]; pn[i * 3 + k] = N[k]; } }
    const appl = (M, v) => [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]];
    const miroir = (v) => [-v[0], v[1], v[2]];
    const COTE = [0, 1];   // 0 : x<0 (côté de k=0), 1 : x>0

    // p : { genre, P2, N2, pitch[2], cheville[2], poignet[2], mainDir, polesJambe[2], polesBras[2], g }
    function poser(p, sortiePos, sortieNor) {
      const J = sets[p.genre].j, g = p.g;
      const P = J.P, T0 = J.T || [0, 1.335, 0.0];
      const a = unit(sub(T0, P)), bv = sub(p.N2, p.P2), b = unit(bv), st = len(bv) / len(sub(T0, P));
      const Rt = arc(a, b), Rp = arc(a, b, p.bassin || 0.55);   // bassin : part de la bascule du buste qu’il suit (moins = dos plus cambré)
      const At = etire(Rt, a, g, st), Ap = Rp.map((x) => x * g);
      regler(1, At, Rt, P, p.P2);
      regler(0, Ap, Rp, P, p.P2);
      // tête (nouveau corps) : posée sur le cou, redressée pour regarder la route malgré le buste penché
      let tete = null;
      if (J.Ht) {
        const Rh = arc(unit(sub(J.Ht, J.N)), unit(p.teteDir || [0, 0.93, -0.37]));
        regler(14, Rh.map((x) => x * g), Rh, J.N, p.N2);
        tete = { R: Rh, pos: (v) => add(p.N2, appl(Rh.map((x) => x * g), sub(v, J.N))) };
      }
      const portePelvis = (v) => add(p.P2, appl(Ap, sub(v, P)));
      const porteTorse = (v) => add(p.P2, appl(At, sub(v, P)));
      const info = [];
      for (let k = 0; k < 2; k++) {
        const sg = k ? 1 : -1, m = (v) => (k ? v : miroir(v));
        const H = m(J.H), K = m(J.K), A = m(J.A), S = m(J.S), E = m(J.E), W = m(J.W), Hd = m(J.Hd);
        // jambe
        const H2 = portePelvis(H), l1 = g * len(sub(K, H)), l2 = g * len(sub(A, K));
        const T = p.cheville[k], c0 = plier(H2[0], H2[1], H2[2], T[0], T[1], T[2], l1, l2, p.polesJambe[k][0], p.polesJambe[k][1], p.polesJambe[k][2]);
        const c = [c0[0], c0[1], c0[2]];
        const aT = unit(sub(K, H)), bT = unit(sub(c, H2)), RT = arc(aT, bT);
        regler(8 + k, etire(RT, aT, g, l1 / len(sub(K, H))), RT, H, H2);
        const aC = unit(sub(A, K)), bC = unit(sub(T, c)), RC = arc(aC, bC);
        regler(10 + k, etire(RC, aC, g, g), RC, K, c);
        const A2 = add(c, mul(bC, l2));
        const Rf = rotAxe([1, 0, 0], p.pitch[k]);
        regler(12 + k, Rf.map((x) => x * g), Rf, A, A2);
        // bras
        const S2 = porteTorse(S), la = 1.08 * g * len(sub(E, S)), lb = 1.08 * g * len(sub(W, E));
        const Wt = p.poignet[k], e0 = plier(S2[0], S2[1], S2[2], Wt[0], Wt[1], Wt[2], la, lb, p.polesBras[k][0], p.polesBras[k][1], p.polesBras[k][2]);
        const e = [e0[0], e0[1], e0[2]];
        const aU = unit(sub(E, S)), bU = unit(sub(e, S2)), RU = arc(aU, bU);
        regler(2 + k, etire(RU, aU, g, la / len(sub(E, S))), RU, S, S2);
        const aF = unit(sub(W, E)), bF = unit(sub(Wt, e)), RF = arc(aF, bF);
        regler(4 + k, etire(RF, aF, g, lb / len(sub(W, E))), RF, E, e);
        const W2 = add(e, mul(bF, lb));
        const aH = unit(sub(Hd, W));
        let Rh = arc(aH, unit(p.mainDir));
        if (J.Pn && p.paume) {          // nouveau corps : la paume tournée vers le guidon (rotation autour de l’axe de la main)
          const m = unit(p.mainDir), n1 = appl(Rh, k ? J.Pn : miroir(J.Pn));
          const pr = (v) => unit(sub(v, mul(m, dot(v, m)))), a1 = pr(n1), a2 = pr(p.paume[k]);
          Rh = mm(rotAxe(m, Math.atan2(dot(cross(a1, a2), m), dot(a1, a2))), Rh);
        }
        regler(6 + k, Rh.map((x) => x * g), Rh, W, W2);
        info.push({ genou: c, coude: e, cheville: A2, poignet: W2 });
      }
      // application aux sommets (2 influences par sommet)
      const bind = sets[p.genre].p;
      for (let i = 0; i < NV; i++) {
        const i3 = i * 3, x = bind[i3], y = bind[i3 + 1], z = bind[i3 + 2], w = WT[i] / 255;
        const nx = nor0[i3] / 127, ny = nor0[i3 + 1] / 127, nz = nor0[i3 + 2] / 127;
        let ox = 0, oy = 0, oz = 0, mx = 0, my = 0, mz = 0;
        for (let q = 0; q < 2; q++) {
          const gi = q ? G2[i] : G1[i], f = q ? 1 - w : w;
          if (f < 0.0001) continue;
          const o = gi * 9, o3 = gi * 3, dx = x - pb[o3], dy = y - pb[o3 + 1], dz = z - pb[o3 + 2];
          ox += f * (pn[o3] + mat[o] * dx + mat[o + 1] * dy + mat[o + 2] * dz);
          oy += f * (pn[o3 + 1] + mat[o + 3] * dx + mat[o + 4] * dy + mat[o + 5] * dz);
          oz += f * (pn[o3 + 2] + mat[o + 6] * dx + mat[o + 7] * dy + mat[o + 8] * dz);
          mx += f * (rot[o] * nx + rot[o + 1] * ny + rot[o + 2] * nz);
          my += f * (rot[o + 3] * nx + rot[o + 4] * ny + rot[o + 5] * nz);
          mz += f * (rot[o + 6] * nx + rot[o + 7] * ny + rot[o + 8] * nz);
        }
        const l = Math.hypot(mx, my, mz) || 1;
        sortiePos[i3] = ox; sortiePos[i3 + 1] = oy; sortiePos[i3 + 2] = oz;
        sortieNor[i3] = mx / l; sortieNor[i3 + 1] = my / l; sortieNor[i3 + 2] = mz / l;
      }
      info.tete = tete;
      return info;
    }
    return { NV, sets, poser };
  }
  try { Modele = fabriquerModele(MODELE_DATA, 5e-5); } catch (e) { Modele = null; console.warn("modèle 3D indisponible", e); }
  // corps d'homme réaliste (MakeHuman, domaine public) : js/modele-homme.js
  try {
    if (typeof MODELE_H !== "undefined") ModeleH = fabriquerModele({ N: MODELE_H.N, n: MODELE_H.n, g1: MODELE_H.g1, g2: MODELE_H.g2, w: MODELE_H.w, homme: { p: MODELE_H.p, tri: MODELE_H.tri, counts: MODELE_H.counts, j: MODELE_H.j } }, MODELE_H.e);
  } catch (e) { ModeleH = null; console.warn("corps d'homme indisponible", e); }
  // corps de femme réaliste : même maillage que l'homme (triangles, poids, zones) avec sa propre forme : js/modele-femme.js
  try {
    if (ModeleH && typeof MODELE_F !== "undefined") ModeleF = fabriquerModele({ N: MODELE_F.N, n: MODELE_F.n, g1: MODELE_H.g1, g2: MODELE_H.g2, w: MODELE_H.w, femme: { p: MODELE_F.p, tri: MODELE_H.tri, counts: MODELE_H.counts, j: MODELE_F.j } }, MODELE_F.e);
  } catch (e) { ModeleF = null; console.warn("corps de femme indisponible", e); }
  // textures des corps réalistes (js/textures-corps.js) : détails de la peau MakeHuman, ombres douces calculées par Blender, yeux, cils, sourcils
  const texCorps = {};
  function texC(nom, image) {
    if (!texCorps[nom]) {
      let t;
      if (typeof TEX_CORPS !== "undefined" && TEX_CORPS[nom]) { t = new T.TextureLoader().load(TEX_CORPS[nom]); t.anisotropy = 4; if (image && T.sRGBEncoding) t.encoding = T.sRGBEncoding; }
      else { const v = nom.startsWith("peau") ? 128 : 255; t = new T.DataTexture(new Uint8Array([v, v, v, image ? 0 : 255]), 1, 1); t.needsUpdate = true; }   // sans le fichier : peau unie, pas d'ombres
      texCorps[nom] = t;
    }
    return texCorps[nom];
  }

  function creerRoue(pneu, jante, gris, blanc) {
    const g = new T.Group();
    g.add(new T.Mesh(new T.TorusGeometry(0.325, 0.034, 10, 32).rotateY(Math.PI / 2), pneu));
    const rim = new T.Mesh(new T.TorusGeometry(0.296, 0.03, 8, 32).rotateY(Math.PI / 2), jante); rim.scale.set(1.5, 1, 1); g.add(rim);
    g.add(new T.Mesh(new T.CylinderGeometry(0.29, 0.29, 0.03, 28).rotateZ(Math.PI / 2), jante));
    for (const sx of [-0.017, 0.017]) {            // logo blanc qui tourne avec la roue
      const l = new T.Mesh(new T.BoxGeometry(0.004, 0.13, 0.035), blanc); l.position.set(sx, 0.2, 0); g.add(l);
    }
    g.add(new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.1, 10).rotateZ(Math.PI / 2), gris));
    return g;
  }

  // matière du nouveau corps : peau, maillot, cuissard, chaussettes et gants choisis pixel par pixel d'après les champs de zone ;
  // sur la tête : lèvres, sourcils, barbe et cheveux (avec un léger relief : la surface est poussée vers l'extérieur)
  const COUPES = {               // ép : épaisseur des cheveux (m) ; recul : front dégarni ; nuque : cheveux plus bas derrière ; rase : on voit la peau
    court: { ep: 0.007, recul: 0, nuque: 0 }, rase: { ep: 0.0015, recul: 0, nuque: 0, rase: 1 }, "mi-long": { ep: 0.0015, recul: 0.004, nuque: 0.045 },
    degarni: { ep: 0.006, recul: 0.03, nuque: 0 }, chauve: { ep: 0, recul: 1, nuque: 0 }, chignon: { ep: 0.0015, recul: 0.006, nuque: 0 }, queue: { ep: 0.0015, recul: 0.006, nuque: 0 }
  };
  const BARBES = { aucune: 0, courte: 1, bouc: 2, moustache: 3, complete: 4 };
  const VERRES = { orange: [0xffb347, 0xd8432f], bleu: [0x8fdcff, 0x3a52d8], violet: [0xe0b0ff, 0x6b3cd8], fume: [0x5a5d63, 0x202226] };
  // chaussures de vélo du corps réaliste : forme MakeHuman ajustée au pied, coloriée ici d'après les repères du convertisseur
  // (champ aVisage des chaussures : u = du talon à la pointe, h = hauteur au repos, s = écart au milieu du pied vers l'extérieur)
  const H_CHAUS = 0.105;                    // hauteur (m, depuis la semelle) où commence la chaussette
  // (v69 suite) la tige de la chaussure monte au-dessus de la cheville : cette partie prend la couleur des chaussettes (uChaus)
  function matChaussure() {
    const m = new T.MeshPhongMaterial({ color: 0xffffff, shininess: 60, specular: 0x3a3a3a });
    const uChaus = { value: new T.Color(0xf2f4f6) };
    m.userData.uChaus = uChaus;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uChaus = uChaus;
      sh.vertexShader = "attribute vec4 aVisage;\nvarying vec4 vSo;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  vSo = aVisage;");
      sh.fragmentShader = "uniform vec3 uChaus;\nvarying vec4 vSo;\n" + sh.fragmentShader.replace("vec4 diffuseColor = vec4( diffuse, opacity );",
        "float u = vSo.x, h = vSo.y, s = vSo.z;\n  vec3 c = vec3(0.93, 0.94, 0.95);\n" +
        "  float sem = 0.024 + 0.012 * smoothstep(0.78, 1.0, u) + 0.008 * smoothstep(0.18, 0.0, u);\n" +      // semelle : remonte à la pointe et au talon
        "  if (h < sem) c = vec3(0.07, 0.075, 0.085);\n  else if (h < sem + 0.004) c = vec3(0.5, 0.52, 0.56);\n" +   // semelle noire et liseré gris
        "  if (u < 0.14 && h >= sem + 0.004 && h < 0.08) c = vec3(0.13, 0.14, 0.16);\n" +                              // talon renforcé
        "  if (u > 0.82 && h >= sem + 0.004 && h < sem + 0.02) c = vec3(0.8, 0.81, 0.83);\n" +                         // pare-pierres à la pointe
        "  if (h > 0.04 && ((u > 0.46 && u < 0.52) || (u > 0.6 && u < 0.66))) c = vec3(0.1, 0.11, 0.12);\n" +           // deux sangles
        "  if (length(vec2((u - 0.33) * 0.27, s - 0.028)) < 0.012 && h > 0.045) c = vec3(0.09, 0.09, 0.1);\n" +         // molette de serrage
        "  if (h > " + H_CHAUS.toFixed(3) + ") c = h < " + (H_CHAUS + 0.006).toFixed(3) + " ? uChaus * 0.82 : uChaus;\n" +   // chaussette (bande au bord)
        "  vec4 diffuseColor = vec4( c, opacity );");
    };
    m.customProgramCacheKey = () => "chaus" + H_CHAUS;
    return m;
  }
  // coul (coureurs virtuels) : couleurs propres { peau, maillot, bas, chaussette, cheveux } ; sinon celles de l'avatar
  function matTenue(gant, coul) {
    const m = new T.MeshPhongMaterial({ color: 0xffffff, shininess: 22, specular: 0x262220 });
    const k = coul || { peau: matPeau.color, maillot: matMaillot.color, bas: matBas.color, chaussette: matBlanc.color, cheveux: matCheveux.color };
    const u = { uPeau: { value: k.peau }, uMaillot: { value: k.maillot }, uCuissard: { value: k.bas }, uGant: { value: gant.color },
      uChaussette: { value: k.chaussette }, uLong: { value: 0 },
      uCheveux: { value: k.cheveux }, uSourcils: { value: new T.Color(0x2a1d14) }, uLevres: { value: new T.Color(0xb36a5e) },
      uEpCh: { value: 0.007 }, uFinS: { value: 0 }, uRecul: { value: 0 }, uNuque: { value: 0 }, uRase: { value: 0 }, uBarbe: { value: 0 }, uSansTete: { value: 0 },
      uTexPeau: { value: texC("peauH") }, uTexOmbre: { value: texC("ombreH") } };
    m.userData.u = u;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      const commun = "uniform float uEpCh, uRecul, uNuque, uRase, uBarbe;\n" +
        "float champChev(vec4 c) { return c.x - uRecul * (1.0 - c.y) + uNuque * c.y; }\n" +
        "float masqueBarbe(vec4 v, vec4 c, float e) {\n" +
        "  float b = 0.0;\n" +
        "  if (uBarbe > 0.5 && uBarbe < 1.5) b = smoothstep(-e, e, v.z);\n" +
        "  else if (uBarbe > 1.5 && uBarbe < 2.5) b = smoothstep(-e, e, v.w);\n" +
        "  else if (uBarbe > 2.5 && uBarbe < 3.5) b = smoothstep(-e, e, c.z);\n" +
        "  else if (uBarbe > 3.5) b = smoothstep(-e, e, v.z);\n" +
        "  return b * (1.0 - smoothstep(-0.0006, 0.0012, v.x));\n" +
        "}\n";
      sh.vertexShader = "attribute vec4 aZone, aVisage, aChev;\nattribute float aJambe;\nattribute vec3 aBind;\nvarying vec4 vZone, vVisage, vChev;\nvarying float vJambe;\nvarying vec3 vBind;\nvarying vec2 vUvC;\n" + commun +
        sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  vZone = aZone; vJambe = aJambe; vVisage = aVisage; vChev = aChev; vBind = aBind; vUvC = uv;\n" +
          "  float mch = uRecul > 0.5 ? 0.0 : smoothstep(-0.003, 0.006, champChev(aChev));\n" +
          "  float mb = masqueBarbe(aVisage, aChev, 0.003) * (uBarbe > 3.5 ? 0.006 : (uBarbe > 0.5 && uBarbe < 1.5 ? 0.0006 : 0.0025));\n" +
          "  transformed += objectNormal * (mch * uEpCh + mb);");
      sh.fragmentShader = "uniform vec3 uPeau, uMaillot, uCuissard, uGant, uChaussette, uCheveux, uSourcils, uLevres;\nuniform float uLong, uSansTete, uFinS;\nuniform sampler2D uTexPeau, uTexOmbre;\nvarying vec4 vZone, vVisage, vChev;\nvarying float vJambe;\nvarying vec3 vBind;\nvarying vec2 vUvC;\n" + commun +
        "float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }\n" +
        // vue action cam : ni la tête, ni ce qui frôle la caméra (épaules, cou : ils formaient des triangles coupés devant l'objectif)
        sh.fragmentShader.replace("vec4 diffuseColor = vec4( diffuse, opacity );",
          "if (uSansTete > 0.5 && (vJambe > 1.5 || length(vViewPosition) < 0.2)) discard;\n  vec3 cz = uPeau;\n  float nu = 1.0;\n  if (vJambe > 0.5 && vJambe < 1.5 && uLong > 0.5) { cz = uCuissard; nu = 0.0; }\n  if (vZone.x > 0.0) { cz = uMaillot; nu = 0.0; }\n  if (vZone.y > 0.0) { cz = uCuissard; nu = 0.0; }\n" +
          "  if (vZone.z > 0.0) { cz = uLong > 0.5 ? uCuissard : uChaussette; nu = 0.0; }\n  if (vZone.w > 0.0) { cz = uGant; nu = 0.0; }\n" +
          // finitions : fermeture éclair du maillot, bandes au col, aux manches, au bas du cuissard et en haut des chaussettes
          "  if (vZone.x > 0.0 && vZone.y <= 0.0) {\n" +
          "    if (abs(vBind.x) < 0.0035 && vBind.z < -0.04 && vBind.y > 1.02) cz = vec3(0.16, 0.17, 0.19);\n" +
          "    if (vZone.x < 0.009) cz = uMaillot * 0.6;\n" +
          "  }\n" +
          "  if (vZone.y > 0.0 && vZone.y < 0.022 && vZone.x <= 0.0 && vJambe > 0.5 && vBind.y < 0.8) cz = uCuissard * 0.65 + 0.06;\n" +
          "  if (vZone.z > 0.0 && vZone.z < 0.016 && uLong < 0.5) cz = uChaussette * 0.82;\n" +
          // peau : détails de la texture MakeHuman (lèvres, joues, grain ; puissance 2,2 pour garder leur contraste à l'écran) ; ombres douces de Blender partout
          "  vec3 det = pow(texture2D(uTexPeau, vUvC).rgb * 2.0, vec3(2.2));\n  float ao = texture2D(uTexOmbre, vUvC).r;\n  cz *= mix(vec3(1.0), det, nu);\n" +
          "  if (vChev.x > -0.045 || vVisage.z > -0.03 || vVisage.w > -0.03 || vVisage.y > -0.02 || vVisage.x > -0.02) {\n" +
          "    float grain = hash3(floor(vBind * 1400.0));\n" +                                  // grain fin (poils, mèches)
          "    float meche = 0.5 + 0.5 * sin(vBind.x * 900.0 + vBind.z * 260.0 + 40.0 * hash3(floor(vBind * 300.0)));\n" +

          "    float mb = masqueBarbe(vVisage, vChev, 0.0012);\n" +
          "    float ab = uBarbe > 0.5 && uBarbe < 1.5 ? 0.45 * step(0.3, grain) : 0.9 * (0.75 + 0.25 * grain);\n" +
          "    cz = mix(cz, uCheveux * (0.85 + 0.3 * meche), mb * ab);\n" +
          "    float fch = champChev(vChev) + (grain - 0.5) * 0.003;\n" +
          "    float mch = uRecul > 0.5 ? 0.0 : smoothstep(-0.001, 0.002, fch);\n" +
          "    cz = mix(cz, mix(uCheveux * (0.7 + 0.45 * meche), cz, uRase * 0.45), mch);\n" +
          "  }\n  cz *= mix(1.0, ao, 0.4 + 0.5 * nu);\n  vec4 diffuseColor = vec4( cz, opacity );");
    };
    return m;
  }
  /* ---------- Casque et lunettes du nouveau corps (dessinés pour sa tête) ----------
     Repère : celui de corps.tete, dont l'origine est le point (0 ; 1,6532 ; -0,0364) de la tête au repos (yeux à (±0,029 ; -0,005 ; -0,09),
     haut du crâne à y +0,104, front à z -0,11, arrière du crâne à z +0,087, oreilles sous y +0,017, menton à (0 ; -0,122 ; -0,094)). */
  function segment(a, b, r, mat) {               // petit tube fixe entre deux points
    const d = new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), l = d.length();
    const m = new T.Mesh(new T.CylinderGeometry(r, r, l, 6), mat);
    m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
    return m;
  }
  function construireAccessoiresH(matCasque) {
    const lerpTab = (tab, a) => { let i = 1; while (i < tab.length - 1 && tab[i][0] < a) i++; const p = tab[i - 1], q = tab[i], f = Math.min(1, Math.max(0, (a - p[0]) / (q[0] - p[0]))); return p[1] + (q[1] - p[1]) * f; };
    const sangleM = new T.MeshPhongMaterial({ color: 0x23262c, shininess: 20 });
    // ----- casque : coque profilée (bord plus haut devant, plus bas derrière, petite queue), aérations, liseré intérieur sombre
    const casqueH = new T.Group();
    const NT = 72, NU = 22, cy = 0.02, rx = 0.098, ry = 0.098, rzF = 0.128, rzB = 0.136;
    const BORD = [[0, 0.05], [0.6, 0.045], [1.1, 0.02], [1.6, 0.012], [2.2, -0.01], [Math.PI, -0.03]];
    const AERATIONS = [[0, 0.07], [0.33, 0.06], [-0.33, 0.06], [0.64, 0.055], [-0.64, 0.055], [0.98, 0.05], [-0.98, 0.05], [2.75, 0.07], [-2.75, 0.07], [Math.PI, 0.08]];
    const pos = [], col = [], idx = [];
    const pt = (th, u, rentre) => {
      const sr = Math.acos(Math.max(-1, Math.min(1, (lerpTab(BORD, Math.abs(th)) - cy) / ry))), s = u * sr;
      const c = Math.cos(th), rz = c > 0 ? rzF : rzB * (1 + 0.2 * Math.pow(-c, 4));
      const k = 1 - rentre;
      return [rx * Math.sin(s) * Math.sin(th) * k, cy + ry * Math.cos(s) * k, -rz * Math.sin(s) * c * k];
    };
    const evente = (th, u) => {                  // aérations : fentes d'avant en arrière
      for (const [a, w] of AERATIONS) {
        let d = Math.abs(th - a); if (d > Math.PI) d = 2 * Math.PI - d;
        const avant = Math.abs(a) < 2;
        if (d < w * 0.5 && (avant ? u > 0.2 && u < 0.66 : u > 0.38 && u < 0.8)) return true;
      }
      return false;
    };
    const C = new T.Color();
    for (let i = 0; i < NT; i++) for (let j = 0; j <= NU; j++) {
      const th = -Math.PI + 2 * Math.PI * i / NT, u = j / NU, v = evente(th, u);
      pos.push(...pt(th, u, v ? 0.07 : 0));
      C.set(v ? 0x17191d : 0xffffff); col.push(C.r, C.g, C.b);
    }
    const base = pos.length / 3;                   // bord épais : retour vers l'intérieur, sombre
    for (let i = 0; i < NT; i++) for (const r of [0.0, 0.13]) {
      const th = -Math.PI + 2 * Math.PI * i / NT, p = pt(th, 1, r), q = pt(th, 0.86, 0.13);
      pos.push(...(r ? q : p)); C.set(r ? 0x101114 : 0x2a2d33); col.push(C.r, C.g, C.b);
    }
    for (let i = 0; i < NT; i++) {
      const i2 = (i + 1) % NT;
      for (let j = 0; j < NU; j++) { const a = i * (NU + 1) + j, b = i2 * (NU + 1) + j; idx.push(a, a + 1, b, b, a + 1, b + 1); }
      const a = base + i * 2, b = base + i2 * 2;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new T.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const coque = new T.Mesh(g, new T.MeshPhongMaterial({ color: matCasque.color, vertexColors: true, shininess: 90, specular: 0x5a5a5a, side: T.DoubleSide }));
    casqueH.add(coque);
    corps.matCasqueH = coque.material;
    // sangles : devant et derrière l'oreille, réunies sous l'oreille, puis sous le menton ; molette de serrage derrière
    for (const sg of [-1, 1]) {
      const B = [sg * 0.064, -0.05, -0.008];
      casqueH.add(segment([sg * 0.086, 0.014, -0.05], B, 0.0035, sangleM), segment([sg * 0.083, 0.0, 0.05], B, 0.0035, sangleM));
      casqueH.add(segment(B, [sg * 0.012, -0.114, -0.06], 0.0035, sangleM));
      const pince = new T.Mesh(new T.BoxGeometry(0.008, 0.012, 0.006), sangleM); pince.position.set(B[0], B[1], B[2]); casqueH.add(pince);
    }
    const boucle = new T.Mesh(new T.BoxGeometry(0.026, 0.008, 0.012), sangleM); boucle.position.set(0, -0.116, -0.06); casqueH.add(boucle);
    const molette = new T.Mesh(new T.CylinderGeometry(0.013, 0.013, 0.01, 12).rotateX(Math.PI / 2), sangleM); molette.position.set(0, -0.04, 0.105); casqueH.add(molette);
    casqueH.visible = false;
    corps.tete.add(casqueH);
    corps.casqueH = casqueH;
    // ----- lunettes de sport : écran enveloppant (verre miroir orangé), barre et branches noires
    const lunettesH = new T.Group();
    const NP = 40, NV = 6, lp = [], lc = [], li = [], haut = [];
    const HAUT = new T.Color(0xffb347), BAS = new T.Color(0xd8432f);
    for (let i = 0; i <= NP; i++) {
      const ph = -1.3 + 2.6 * i / NP, x = 0.085 * Math.sin(ph), z = -0.035 - 0.09 * Math.cos(ph);
      const yt = 0.024 - 0.008 * ph * ph, yb = -0.024 + 0.01 * ph * ph + 0.02 * Math.exp(-(ph / 0.16) * (ph / 0.16));
      haut.push(new T.Vector3(x, yt + 0.002, z));
      for (let j = 0; j <= NV; j++) {
        const f = j / NV;
        lp.push(x, yt + (yb - yt) * f, z);
        C.copy(HAUT).lerp(BAS, f); lc.push(C.r, C.g, C.b);
      }
    }
    for (let i = 0; i < NP; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, b = a + NV + 1; li.push(a, b, a + 1, a + 1, b, b + 1); }
    const gl = new T.BufferGeometry();
    gl.setAttribute("position", new T.Float32BufferAttribute(lp, 3)); gl.setAttribute("color", new T.Float32BufferAttribute(lc, 3));
    gl.setIndex(li); gl.computeVertexNormals();
    lunettesH.add(new T.Mesh(gl, new T.MeshPhongMaterial({ vertexColors: true, shininess: 150, specular: 0xffffff, transparent: true, opacity: 0.93, side: T.DoubleSide })));
    corps.verresH = { geo: gl, nv: NV, type: "orange" };
    const noirL = new T.MeshPhongMaterial({ color: 0x15171b, shininess: 60 });
    lunettesH.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(haut), 40, 0.0032, 6, false), noirL));
    for (const sg of [-1, 1]) lunettesH.add(segment([sg * 0.0825, 0.012, -0.058], [sg * 0.079, 0.008, 0.035], 0.0028, noirL));
    lunettesH.visible = false;
    corps.tete.add(lunettesH);
    corps.lunettesH = lunettesH;
  }

  /* ---------- Cheveux longs du nouveau corps (v64) : mi-longs, queue de cheval, chignon ----------
     Construits dans le repère de corps.tete (mêmes mesures que le casque) et ajustés au crâne de chaque corps (homme ou femme) :
     on mesure le rayon du crâne dans chaque direction, puis des mèches partent du sommet, épousent la tête et retombent.
     Texture de mèches en niveaux de gris (teintée par la couleur des cheveux), pointes découpées (alphaTest).
     Sous le casque, la partie haute est plaquée contre le crâne (aRetrait) ; les pointes se balancent avec le pédalage (aPoids). */
  let texMeches = null, matMeches = null;
  const BORD_CASQUE = [[0, 0.05], [0.6, 0.045], [1.1, 0.02], [1.6, 0.012], [2.2, -0.01], [Math.PI, -0.03]];   // bord du casque (comme construireAccessoiresH)
  const lerpT = (tab, a) => { let i = 1; while (i < tab.length - 1 && tab[i][0] < a) i++; const p = tab[i - 1], q = tab[i], f = Math.min(1, Math.max(0, (a - p[0]) / (q[0] - p[0]))); return p[1] + (q[1] - p[1]) * f; };
  const lisseT = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function texMechesCh() {
    if (texMeches) return texMeches;
    const W = 256, H = 512, c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d");
    x.fillStyle = "rgb(228,228,228)"; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 1500; i++) {             // mèches fines plus claires ou plus sombres, légèrement ondulées
      const l = 150 + Math.random() * 105 | 0, px = Math.random() * W, o = (Math.random() - 0.5) * 6;
      x.strokeStyle = "rgba(" + l + "," + l + "," + l + "," + (0.25 + Math.random() * 0.4).toFixed(2) + ")"; x.lineWidth = 0.6 + Math.random() * 1.5;
      for (const dx of [-W, 0, W]) { x.beginPath(); x.moveTo(px + dx, 0); x.bezierCurveTo(px + dx + o, H * 0.35, px + dx - o, H * 0.65, px + dx + o * 0.5, H); x.stroke(); }
    }
    const gr = x.createLinearGradient(0, 0, 0, H * 0.1);   // racines un peu plus sombres
    gr.addColorStop(0, "rgba(0,0,0,0.25)"); gr.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = gr; x.fillRect(0, 0, W, H * 0.1);
    // pointes : chaque petite touffe s'arrête à une hauteur différente, quelques cheveux s'arrêtent plus tôt
    const im = x.getImageData(0, 0, W, H), d = im.data;
    let col = 0;
    while (col < W) {
      const larg = 2 + Math.random() * 5 | 0, fin = 0.89 + Math.random() * 0.105;
      for (let k = 0; k < larg && col < W; k++, col++) {
        const e = (fin + (Math.random() - 0.5) * 0.02 - (Math.random() < 0.08 ? Math.random() * 0.06 : 0)) * H;
        for (let y = Math.max(0, e | 0); y < H; y++) d[(y * W + col) * 4 + 3] = 0;
      }
    }
    x.putImageData(im, 0, 0);
    texMeches = new T.CanvasTexture(c);
    texMeches.wrapS = T.RepeatWrapping; texMeches.wrapT = T.ClampToEdgeWrapping; texMeches.anisotropy = 4;
    texMeches.flipY = false;                       // v = 0 aux racines, v = 1 aux pointes
    if (T.sRGBEncoding) texMeches.encoding = T.sRGBEncoding;
    return texMeches;
  }
  function matMechesCh() {
    if (matMeches) return matMeches;
    const m = new T.MeshPhongMaterial({ map: texMechesCh(), alphaTest: 0.5, side: T.DoubleSide, shininess: 36, specular: 0x3a342e });
    m.color = matCheveux.color;                       // même couleur que les cheveux dessinés sur le crâne
    const u = { uCasque: { value: 0 }, uBal: { value: new T.Vector2() } };
    m.userData.u = u;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = "attribute vec3 aRetrait;\nattribute float aPoids;\nuniform float uCasque;\nuniform vec2 uBal;\n" +
        sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  transformed += aRetrait * uCasque + vec3(uBal.x, 0.0, uBal.y) * aPoids;");
    };
    matMeches = m;
    return m;
  }
  // carte du crâne : rayon le plus grand de la peau de la tête dans chaque direction (repère de corps.tete, centre C)
  const C_CRANE = [0, 0, -0.012];
  function carteCrane(g) {
    const M = g === "femme" ? ModeleF : ModeleH, d = M.sets[g], J = d.j, ts = J.Ts || [1, 1];
    const o = [0, J.Ey[1] - 0.005 * ts[1] + 0.01, J.Ey[2] + 0.09 * ts[0]];       // origine de corps.tete au repos (voir majModeleH)
    const NA = 72, NE = 36, r = new Float32Array(NA * NE), p = d.p, tete = corps.modeleH.geo.attributes.aJambe.array, chev = corps.modeleH.geo.attributes.aChev.array;
    const nCh = new Float32Array(NA * NE), nPe = new Float32Array(NA * NE);   // sommets avec / sans cheveux par case
    for (let i = 0; i < tete.length; i++) {
      if (tete[i] < 1.5) continue;
      const x = (p[i * 3] - o[0]) / ts[0] - C_CRANE[0], y = (p[i * 3 + 1] - o[1]) / ts[1] - C_CRANE[1], z = (p[i * 3 + 2] - o[2]) / ts[0] - C_CRANE[2];
      const l = Math.hypot(x, y, z); if (l < 1e-6) continue;
      const th = Math.atan2(x, -z), ph = Math.asin(y / l);
      const a = Math.min(NA - 1, Math.floor((th + Math.PI) / (2 * Math.PI) * NA)), e = Math.min(NE - 1, Math.floor((ph + Math.PI / 2) / Math.PI * NE));
      if (l > r[e * NA + a]) r[e * NA + a] = l;
      if (chev[i * 4] > 0) nCh[e * NA + a]++; else nPe[e * NA + a]++;
    }
    // ligne des cheveux : en descendant du sommet, première case où la peau l'emporte
    const lig = new Float32Array(NA);
    for (let a = 0; a < NA; a++) {
      let e = NE - 1;
      while (e > 0 && nCh[e * NA + a] >= nPe[e * NA + a]) e--;
      lig[a] = (e + 1) / NE * Math.PI - Math.PI / 2;
    }
    for (let pas = 0; pas < 3; pas++) { const l2 = lig.slice(); for (let a = 0; a < NA; a++) lig[a] = (l2[(a + NA - 1) % NA] + 2 * l2[a] + l2[(a + 1) % NA]) / 4; }   // ligne sans marches
    for (let pas = 0; pas < 6; pas++) {           // cases vides : remplies par leurs voisines
      const r2 = r.slice();
      for (let e = 0; e < NE; e++) for (let a = 0; a < NA; a++) {
        if (r[e * NA + a] > 0) continue;
        let s = 0, n = 0;
        for (const [de, da] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ee = e + de; if (ee < 0 || ee >= NE) continue; const v = r[ee * NA + (a + da + NA) % NA]; if (v > 0) { s += v; n++; } }
        if (n) r2[e * NA + a] = s / n;
      }
      r.set(r2);
    }
    const lis = r.slice();                         // léger lissage (mèches régulières)
    for (let e = 1; e < NE - 1; e++) for (let a = 0; a < NA; a++) {
      lis[e * NA + a] = Math.max(r[e * NA + a], (2 * r[e * NA + a] + r[(e + 1) * NA + a] + r[(e - 1) * NA + a] + r[e * NA + (a + 1) % NA] + r[e * NA + (a + NA - 1) % NA]) / 6);   // jamais sous la peau
    }
    const f = (th, ph) => {                        // rayon (interpolé) dans la direction (th : 0 devant, ±π derrière ; ph : hauteur)
      const fa = (th + Math.PI) / (2 * Math.PI) * NA - 0.5, fe = Math.min(NE - 1.001, Math.max(0, (ph + Math.PI / 2) / Math.PI * NE - 0.5));
      const a0 = Math.floor(fa), e0 = Math.floor(fe), ta = fa - a0, te = fe - e0;
      const A = (k) => ((k % NA) + NA) % NA, R = (e, a) => lis[e * NA + A(a)];
      const mx = Math.max(R(e0, a0), R(e0, a0 + 1), R(e0 + 1, a0), R(e0 + 1, a0 + 1));      // prudent : entre deux cases, le crâne peut dépasser la moyenne
      return 0.5 * mx + 0.5 * ((R(e0, a0) * (1 - ta) + R(e0, a0 + 1) * ta) * (1 - te) + (R(e0 + 1, a0) * (1 - ta) + R(e0 + 1, a0 + 1) * ta) * te);
    };
    f.ligne = (th) => { const fa = (th + Math.PI) / (2 * Math.PI) * NA - 0.5, a0 = Math.floor(fa), ta = fa - a0, A = (k) => ((k % NA) + NA) % NA; return lig[A(a0)] * (1 - ta) + lig[A(a0 + 1)] * ta; };
    return f;
  }
  const dirCrane = (th, ph) => [Math.cos(ph) * Math.sin(th), Math.sin(ph), -Math.cos(ph) * Math.cos(th)];
  function geoMeches(pos, uv, retrait, poids, idx) {
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    g.setAttribute("aRetrait", new T.Float32BufferAttribute(retrait, 3)); g.setAttribute("aPoids", new T.Float32BufferAttribute(poids, 1));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  // plaqué contre le crâne sous le casque : déplacement vers la peau pour les points au-dessus du bord du casque
  function retraitCasque(rc, p, th) {
    const v = [p[0] - C_CRANE[0], p[1] - C_CRANE[1], p[2] - C_CRANE[2]], l = Math.hypot(v[0], v[1], v[2]);
    const ph = Math.asin(v[1] / l), w = lisseT(lerpT(BORD_CASQUE, Math.abs(th)) - 0.04, lerpT(BORD_CASQUE, Math.abs(th)) - 0.012, p[1]);
    const k = (rc(th, ph) + 0.002) / l - 1;
    return [v[0] * k * w, v[1] * k * w, v[2] * k * w];
  }
  // calotte de cheveux tirés : mèches peignées depuis la ligne des cheveux jusqu'à l'élastique (direction thB, phB)
  function calotteTiree(rc, thB, phB, mat) {
    const p = dirCrane(thB, phB), a0 = Math.abs(p[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const e1 = [p[1] * a0[2] - p[2] * a0[1], p[2] * a0[0] - p[0] * a0[2], p[0] * a0[1] - p[1] * a0[0]], l1 = Math.hypot(...e1);
    for (let k = 0; k < 3; k++) e1[k] /= l1;
    const e2 = [p[1] * e1[2] - p[2] * e1[1], p[2] * e1[0] - p[0] * e1[2], p[0] * e1[1] - p[1] * e1[0]];
    const dirAB = (a, b) => { const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b); return [0, 1, 2].map((k) => p[k] * cb + (e1[k] * ca + e2[k] * sa) * sb); };
    const angles = (d) => [Math.atan2(d[0], -d[2]), Math.asin(Math.max(-1, Math.min(1, d[1])))];
    const NA = 64, NB = 14, pos = [], uv = [], ret = [], poi = [], idx = [];
    for (let i = 0; i <= NA; i++) {
      const a = 2 * Math.PI * i / NA;
      let bf = 0.05;                                // jusqu'où va la calotte dans cette direction : la ligne des cheveux
      while (bf < Math.PI - 0.05) { const [th, ph] = angles(dirAB(a, bf + 0.01)); if (ph < rc.ligne(th) - 0.1) break; bf += 0.01; }
      for (let j = 0; j <= NB; j++) {
        const b = bf * j / NB, d = dirAB(a, b), [th, ph] = angles(d), r = rc(th, ph) + 0.0062 - 0.002 * (j / NB) * (j / NB);
        const q = [C_CRANE[0] + d[0] * r, C_CRANE[1] + d[1] * r, C_CRANE[2] + d[2] * r];
        pos.push(...q); uv.push(i / NA * 8, 0.84 * (1 - j / NB));
        ret.push(...retraitCasque(rc, q, th)); poi.push(0);
      }
    }
    for (let i = 0; i < NA; i++) for (let j = 0; j < NB; j++) { const a = i * (NB + 1) + j, b = a + NB + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    return new T.Mesh(geoMeches(pos, uv, ret, poi, idx), mat);
  }
  function construireCheveuxLongs(g) {
    const rc = carteCrane(g), mat = matMechesCh(), grp = new T.Group(), f = g === "femme";
    // ----- mi-longs : une nappe de mèches du sommet jusqu'aux épaules (femme) ou au bas de la nuque (homme)
    const NI = 80, NC = 16, NH = 12, REP = 7;
    const FIN = [[0, 0.33], [0.5, 0.35], [0.8, 0.3], [1.0, 0.12], [1.15, -0.05], [Math.PI, -0.05]];   // hauteur où la nappe quitte le crâne (devant : frange posée sur le front)
    const pos = [], uv = [], ret = [], poi = [], idx = [];
    const irr = (i) => 0.5 * Math.sin(i * 0.9 + 1.3) + 0.3 * Math.sin(i * 2.3 + 0.4) + 0.2 * Math.sin(i * 5.1 + 2.0);   // mèches de longueurs inégales
    for (const couche of [0, 1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= NI; i++) {
      const th = -Math.PI + 2 * Math.PI * i / NI, at = Math.abs(th);
      const rentre = couche ? 0.005 + 0.009 * (1 - lisseT(0.9, 1.2, at)) : 0;   // couche intérieure : cachée sous la frange
      const phF = lerpT(FIN, at) + (couche ? 0.04 : 0), lh = lisseT(1.0, 1.4, at) * ((f ? 0.16 : 0.07) + (f ? 0.045 : 0.02) * lisseT(1.8, Math.PI, at) + (f ? 0.018 : 0.008) * irr(i % NI)) * (couche ? 0.93 : 1);
      const pts = [];
      for (let j = 0; j <= NC; j++) {             // sur le crâne, du sommet vers le bas
        const ph = Math.PI / 2 - 0.02 - (Math.PI / 2 - 0.02 - phF) * j / NC, ep = 0.008 - 0.005 * lisseT(0.75, 1, j / NC) * (1 - lisseT(0.9, 1.2, at)) - rentre, dd = dirCrane(th, ph), r = rc(th, ph) + ep;
        pts.push([C_CRANE[0] + dd[0] * r, C_CRANE[1] + dd[1] * r, C_CRANE[2] + dd[2] * r]);
      }
      const p0 = pts[NC], h = [Math.sin(th), 0, -Math.cos(th)];
      for (let j = 1; j <= NH; j++) {             // puis les mèches retombent (un peu évasées, un peu vers l'arrière)
        const s = lh * j / NH;
        const ev = 0.004 + 0.16 * s - 0.25 * s * s * s / Math.max(lh * lh, 1e-4) * (1 - 0.6 * couche);   // évasé, pointes un peu rentrées
        pts.push([p0[0] + h[0] * ev, p0[1] - s, p0[2] + h[2] * ev + 0.08 * s * s / Math.max(lh, 0.01)]);
      }
      let L = 0; const ls = [0];
      for (let j = 1; j < pts.length; j++) { L += Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1], pts[j][2] - pts[j - 1][2]); ls.push(L); }
      for (let j = 0; j < pts.length; j++) {
        const p = pts[j], v = ls[j] / L, sp = j > NC ? (j - NC) / NH : 0;
        pos.push(p[0], p[1], p[2]); uv.push(i / NI * REP + couche * 0.37, v);
        ret.push(...retraitCasque(rc, p, th)); poi.push(sp * sp * lh / 0.17);
      }
    }
    const NJ = NC + NH + 1;
    for (let i = 0; i < NI; i++) for (let j = 0; j < NJ - 1; j++) { const a = base + i * NJ + j, b = base + (i + 1) * NJ + j; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    }
    const mi = new T.Mesh(geoMeches(pos, uv, ret, poi, idx), mat);
    // ----- queue de cheval : attachée derrière la tête, épaisse puis effilée, retombe sur la nuque
    const queue = new T.Group();
    {
      const thB = Math.PI, phB = 0.22, rB = rc(thB, phB), dB = dirCrane(thB, phB);
      const B = [C_CRANE[0] + dB[0] * (rB + 0.004), C_CRANE[1] + dB[1] * (rB + 0.004), C_CRANE[2] + dB[2] * (rB + 0.004)];
      const Lq = f ? 0.27 : 0.2;
      const P = [B, [B[0], B[1] + 0.008, B[2] + 0.06], [B[0], B[1] - 0.5 * Lq, B[2] + 0.1], [B[0], B[1] - Lq, B[2] + 0.075]];
      const bez = (t) => { const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, e = t * t * t; return [0, 1, 2].map((k) => a * P[0][k] + b * P[1][k] + c * P[2][k] + e * P[3][k]); };
      const RAY = [[0, 0.011], [0.12, 0.021], [0.3, 0.024], [0.6, 0.019], [0.85, 0.012], [1, 0.004]];
      const NS = 26, NR = 16, qp = [], qu = [], qr = [], qw = [], qi = [];
      for (const couche of [0, 1]) {                 // cœur plein, puis une couche de mèches plus large aux pointes effilées
      const base = qp.length / 3;
      for (let s = 0; s <= NS; s++) {
        const t = s / NS, c = bez(t), c2 = bez(Math.min(1, t + 0.01)), c1 = bez(Math.max(0, t - 0.01));
        const T0 = [c2[0] - c1[0], c2[1] - c1[1], c2[2] - c1[2]], tl = Math.hypot(T0[0], T0[1], T0[2]);
        const tg = [T0[0] / tl, T0[1] / tl, T0[2] / tl], X = [1, 0, 0], N = [tg[1] * X[2] - tg[2] * X[1], tg[2] * X[0] - tg[0] * X[2], tg[0] * X[1] - tg[1] * X[0]];
        const ra = lerpT(RAY, t) * (couche ? 1.18 + 0.25 * t : 1) * (couche || t < 0.9 ? 1 : 0.7);
        for (let k = 0; k <= NR; k++) {
          const a = 2 * Math.PI * k / NR, cx = Math.cos(a) * ra, cy = Math.sin(a) * ra * 0.8;
          qp.push(c[0] + X[0] * cx + N[0] * cy, c[1] + X[1] * cx + N[1] * cy, c[2] + X[2] * cx + N[2] * cy);
          qu.push(k / NR * 2 + couche * 0.43, couche ? t : t * 0.86); qr.push(0, 0, 0); qw.push(2.2 * t * t);
        }
      }
      for (let s = 0; s < NS; s++) for (let k = 0; k < NR; k++) { const a = base + s * (NR + 1) + k, b = a + NR + 1; qi.push(a, b, a + 1, b, b + 1, a + 1); }
      }
      queue.add(new T.Mesh(geoMeches(qp, qu, qr, qw, qi), mat));
      const elastique = new T.Mesh(new T.TorusGeometry(0.012, 0.0045, 6, 16), new T.MeshPhongMaterial({ color: 0x1d1f24, shininess: 30 }));
      const e0 = bez(0.03), e1 = bez(0.06);
      elastique.position.set(e0[0], e0[1], e0[2]);
      elastique.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), new T.Vector3(e1[0] - e0[0], e1[1] - e0[1], e1[2] - e0[2]).normalize());
      queue.add(elastique);
      queue.add(calotteTiree(rc, thB, phB, mat));
    }
    // ----- chignon : boule de mèches enroulées en haut de la nuque, avec son élastique
    const chignon = new T.Group();
    {
      const thB = Math.PI, phB = 0.42, dB = dirCrane(thB, phB), rB = rc(thB, phB) + 0.016;
      const sg = new T.SphereGeometry(0.03, 20, 14), n = sg.attributes.position.count, uvs = sg.attributes.uv;
      for (let i = 0; i < n; i++) uvs.setXY(i, uvs.getX(i) * 3, 0.1 + uvs.getY(i) * 0.6);   // sans les pointes
      sg.setAttribute("aRetrait", new T.Float32BufferAttribute(new Float32Array(n * 3), 3)); sg.setAttribute("aPoids", new T.Float32BufferAttribute(new Float32Array(n), 1));
      const boule = new T.Mesh(sg, mat); boule.scale.set(1.05, 0.9, 0.85);
      boule.position.set(C_CRANE[0] + dB[0] * rB, C_CRANE[1] + dB[1] * rB, C_CRANE[2] + dB[2] * rB);
      boule.rotation.x = -0.6;
      chignon.add(boule);
      const el = new T.Mesh(new T.TorusGeometry(0.022, 0.004, 6, 18), new T.MeshPhongMaterial({ color: 0x1d1f24, shininess: 30 }));
      const r2 = rc(thB, phB) + 0.004;
      el.position.set(C_CRANE[0] + dB[0] * r2, C_CRANE[1] + dB[1] * r2, C_CRANE[2] + dB[2] * r2);
      el.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), new T.Vector3(dB[0], dB[1], dB[2]));
      chignon.add(el);
      chignon.add(calotteTiree(rc, thB, phB, mat));
    }
    grp.add(mi, queue, chignon);
    grp.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    grp.visible = false;
    cycliste.add(grp);
    return { grp, mi, queue, chignon };
  }

  function creerCycliste() {
    const lam = (c) => new T.MeshLambertMaterial({ color: c });
    const fac = (c, brillant) => new T.MeshPhongMaterial({ color: c, shininess: brillant || 14, specular: brillant ? 0x3a3a3a : 0x1a1512 });   // matière lisse (peau mate, tissu technique brillant)
    const cadre = lam(0x2a303b), noir = lam(0x14171c), gris = lam(0xa7b0bb), carbone = lam(0x22252b), blancLogo = lam(0xf2f4f6);
    matBlanc = fac(0xf2f4f6, 25); matMaillot = fac(0xff7a2f, 38); matPeau = fac(0xe0ac82); matCheveux = fac(0x3b2a1e, 30); matBas = fac(0x1c1f26, 32); matAccent = fac(0x2b2f3a, 30);
    const maillot = matMaillot, peau = matPeau, cuissard = matBas, casque = fac(0xf2f4f6, 60), blanc = fac(0xf2f4f6, 25), lunetteM = fac(0x1d2b3a, 90), sombre = fac(0x1d140e, 40);
    const gant = fac(0x1b1d22, 20), blancOeil = fac(0xf4f1ec, 50), levres = fac(0xb0625a), semelleM = fac(0x15171b, 10);
    cycliste = new T.Group();
    cycliste.rotation.order = "YXZ";

    roueAv = creerRoue(noir, carbone, gris, blancLogo); roueAv.position.set(0, 0.34, -0.5);
    roueAr = creerRoue(noir, carbone, gris, blancLogo); roueAr.position.set(0, 0.34, 0.5);
    cycliste.add(roueAv, roueAr);

    // cadre, selle et cintre : rangés dans corps.velo pour être replacés sous le corps réaliste (poserVelo)
    const segsV = SEGS_VELO.map((s) => { const m = tube(s[4], cadre); cycliste.add(m); return m; });
    const selle = new T.Mesh(new T.BoxGeometry(0.12, 0.04, 0.27), noir); cycliste.add(selle);
    const guidon = new T.Mesh(new T.BoxGeometry(0.42, 0.025, 0.025), noir); cycliste.add(guidon);
    const drops = [-1, 1].map((sg) => {   // cintre en "drops"
      const a = tube(0.013, noir), b = tube(0.013, noir); cycliste.add(a, b); return [a, b];
    });
    corps.velo = { segs: segsV, selle, guidon, drops, cle: null };
    poserVelo(null);

    // corps (mis à jour à chaque image) : formes lisses, proportions réalistes
    const sph = (r, m, sx, sy, sz, seg) => { const o = new T.Mesh(new T.SphereGeometry(r, seg || 20, Math.max(8, (seg || 20) >> 1)), m); o.scale.set(sx || 1, sy || 1, sz || 1); return o; };
    // solide de révolution (muscle) : rayon = fn(t) pour t de t0 à t1 le long de la pièce (hauteur 1, centrée)
    const muscle = (fn, t0, t1, m, cotes, rangs) => {
      const pts = [], n = rangs || 8;
      pts.push(new T.Vector2(0.0005, -0.5));
      for (let i = 0; i <= n; i++) { const t = t0 + (t1 - t0) * i / n; pts.push(new T.Vector2(fn(t), i / n - 0.5)); }
      pts.push(new T.Vector2(0.0005, 0.5));
      return new T.Mesh(new T.LatheGeometry(pts, cotes || 16), m);
    };
    const R = (pts) => (t) => {           // interpolation linéaire d'un profil [[t, rayon], ...]
      for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const u = (t - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0] || 1); return pts[i - 1][1] + u * (pts[i][1] - pts[i - 1][1]); }
      return pts[pts.length - 1][1];
    };
    PROFILS.torse = R([[0, 0.10], [0.2, 0.092], [0.4, 0.094], [0.65, 0.112], [0.88, 0.126], [1, 0.108]]);
    PROFILS.cuisse = R([[0, 0.086], [0.2, 0.092], [0.45, 0.082], [0.75, 0.064], [1, 0.054]]);
    PROFILS.mollet = R([[0, 0.052], [0.22, 0.056], [0.5, 0.045], [0.8, 0.032], [1, 0.026]]);
    PROFILS.bras = R([[0, 0.05], [0.3, 0.052], [0.65, 0.043], [1, 0.037]]);
    PROFILS.avbras = R([[0, 0.038], [0.25, 0.041], [0.7, 0.032], [1, 0.026]]);
    corps.torse = muscle(PROFILS.torse, 0, 1, maillot, 18, 10);
    corps.epaules = sph(0.12, maillot, 1.5, 0.82, 0.95); 
    corps.bassin = sph(0.13, cuissard, 1.3, 1.0, 1.12);
    corps.cou = muscle(R([[0, 0.05], [0.5, 0.043], [1, 0.04]]), 0, 1, peau, 14, 4);
    // tête : crâne + mâchoire + traits du visage regroupés (suit la tête)
    corps.tete = new T.Group();
    corps.tete.add(sph(0.1, peau, 0.92, 1.04, 1.0, 26));                       // crâne
    const machoire = sph(0.075, peau, 0.98, 0.8, 1.0, 22); machoire.position.set(0, -0.052, -0.022); corps.tete.add(machoire);
    const menton = sph(0.03, peau, 1.2, 0.8, 0.9, 14); menton.position.set(0, -0.092, -0.06); corps.tete.add(menton);
    corps.nez = sph(0.02, peau, 0.8, 1.35, 1.2, 14); corps.nez.position.set(0, -0.026, -0.1); corps.tete.add(corps.nez);
    const narine = sph(0.012, peau, 1.7, 0.7, 1, 10); narine.position.set(0, -0.046, -0.098); corps.tete.add(narine);
    corps.yeux = [-1, 1].map((sg) => {
      const g = new T.Group(); g.position.set(sg * 0.036, 0.008, -0.088);
      g.add(sph(0.0145, blancOeil, 1.35, 0.8, 0.55, 12));
      const ir = sph(0.0085, sombre, 1, 1, 0.6, 10); ir.position.set(0, 0, -0.005); g.add(ir);
      corps.tete.add(g); return g;
    });
    for (const sg of [-1, 1]) {
      const sc = new T.Mesh(new T.BoxGeometry(0.044, 0.009, 0.012), matCheveux); sc.position.set(sg * 0.037, 0.034, -0.092); sc.rotation.z = -sg * 0.12; corps.tete.add(sc);
    }
    const bouche = sph(0.02, levres, 1.5, 0.28, 0.5, 12); bouche.position.set(0, -0.066, -0.087); corps.tete.add(bouche);
    corps.oreilles = [-1, 1].map((sg) => { const o = sph(0.022, peau, 0.45, 1.25, 0.9, 12); o.position.set(sg * 0.094, -0.005, 0.012); corps.tete.add(o); return o; });
    corps.lunettes = new T.Group();
    for (const sg of [-1, 1]) { const v = sph(0.04, lunetteM, 1.15, 0.8, 0.3, 16); v.position.set(sg * 0.047, 0, 0); corps.lunettes.add(v); }
    const pont = new T.Mesh(new T.BoxGeometry(0.19, 0.01, 0.012), noir); pont.position.set(0, 0.018, 0.0); corps.lunettes.add(pont);
    corps.lunettes.position.set(0, 0.005, -0.09); corps.tete.add(corps.lunettes);
    if (ModeleH) construireAccessoiresH(casque);
    corps.cheveux = sph(0.108, matCheveux, 0.98, 0.8, 1.08, 22);
    corps.casque = new T.Group();            // casque aéro : coque + queue allongée
    const coque = sph(0.122, casque, 1.0, 0.8, 1.35, 24); corps.casque.add(coque);
    const queueC = sph(0.075, casque, 0.82, 0.55, 1.7, 16); queueC.position.set(0, -0.03, 0.13); corps.casque.add(queueC);
    corps.events = [0, 1].map(() => new T.Mesh(new T.BoxGeometry(0.2, 0.012, 0.035), noir));
    corps.poitrine = sph(0.14, maillot, 1.2, 0.95, 1.1);
    corps.collier = new T.Mesh(new T.TorusGeometry(0.052, 0.014, 8, 18), maillot);
    corps.chignon = sph(0.056, matCheveux, 1, 1, 1, 14);
    corps.nuque = sph(0.068, matCheveux, 1.25, 1.2, 0.9, 14);
    corps.queue = muscle(R([[0, 0.032], [0.5, 0.026], [1, 0.012]]), 0, 1, matCheveux, 10, 5);
    for (const k of ["torse", "epaules", "bassin", "cou", "tete", "cheveux", "casque", "poitrine", "collier", "chignon", "nuque", "queue"]) cycliste.add(corps[k]);
    for (const e of corps.events) cycliste.add(e);
    corps.bras = [];
    for (let s = 0; s < 2; s++) {
      const b = { haut: muscle(PROFILS.bras, 0, 1, peau, 14, 6), manche: muscle((t) => PROFILS.bras(t * 0.42) + 0.007, 0, 1, maillot, 14, 4),
        bande: muscle((t) => PROFILS.bras(0.42) + 0.007, 0, 1, matAccent, 14, 1),
        bas: muscle(PROFILS.avbras, 0, 1, peau, 14, 6), main: sph(0.045, gant, 0.95, 0.8, 1.35, 14), coude: sph(0.04, peau, 1, 1, 1, 12),
        delto: sph(0.062, maillot, 1, 1, 1, 14) };
      for (const k in b) cycliste.add(b[k]);
      corps.bras.push(b);
    }

    for (let s = 0; s < 2; s++) {
      const j = {
        cuisse: muscle(PROFILS.cuisse, 0, 0.74, cuissard, 18, 7),
        cuisseP: muscle(PROFILS.cuisse, 0.72, 1, peau, 16, 3),
        bandeCuisse: muscle((t) => PROFILS.cuisse(0.73) + 0.004, 0, 1, matAccent, 16, 1),
        mollet: muscle(PROFILS.mollet, 0, 1, peau, 16, 8), manivelle: tube(0.016, gris),
        genou: sph(0.056, peau, 1, 1, 1, 14),
        chaussette: muscle((t) => PROFILS.mollet(0.64 + 0.36 * t) + 0.004, 0, 1, blanc, 14, 3),
        pedale: new T.Mesh(new T.BoxGeometry(0.1, 0.02, 0.1), noir), chaussure: new T.Group()
      };
      const dessus = sph(0.05, blanc, 1.0, 0.8, 2.7, 18); dessus.position.set(0, 0.0, -0.01); j.chaussure.add(dessus);
      const bout = sph(0.046, blanc, 1, 0.72, 1.2, 14); bout.position.set(0, -0.004, -0.115); j.chaussure.add(bout);
      const talon = sph(0.04, blanc, 1, 1.05, 1, 12); talon.position.set(0, 0.01, 0.095); j.chaussure.add(talon);
      const semelle = new T.Mesh(new T.BoxGeometry(0.094, 0.014, 0.30), semelleM); semelle.position.set(0, -0.036, -0.01); j.chaussure.add(semelle);
      const sangle = new T.Mesh(new T.BoxGeometry(0.1, 0.01, 0.05), noir); sangle.position.set(0, 0.034, -0.03); j.chaussure.add(sangle);
      for (const k in j) cycliste.add(j[k]);
      jambes.push(j);
    }
    // corps réaliste : un seul maillage, 7 matières (peau, maillot, cuissard, gants, chaussures, bas de jambe, chaussettes)
    if (Modele) {
      const posA = new T.BufferAttribute(new Float32Array(Modele.NV * 3), 3), norA = new T.BufferAttribute(new Float32Array(Modele.NV * 3), 3);
      if (posA.setUsage) { posA.setUsage(T.DynamicDrawUsage || 35048); norA.setUsage(T.DynamicDrawUsage || 35048); }
      const geo = new T.BufferGeometry(); geo.setAttribute("position", posA); geo.setAttribute("normal", norA);
      const mats = [matPeau, maillot, cuissard, gant, blanc, matPeau, blanc];
      const mesh = new T.Mesh(geo, mats); mesh.frustumCulled = false;
      corps.modele = { geo, posA, norA, mesh, mats, genre: "" };
      cycliste.add(mesh);
    }
    // corps d'homme réaliste (MakeHuman) : 9 matières (peau, maillot, cuissard, gants, pieds cachés, peau des jambes, chaussettes, blanc des yeux, iris)
    if (ModeleH) {
      const posA = new T.BufferAttribute(new Float32Array(ModeleH.NV * 3), 3), norA = new T.BufferAttribute(new Float32Array(ModeleH.NV * 3), 3);
      if (posA.setUsage) { posA.setUsage(T.DynamicDrawUsage || 35048); norA.setUsage(T.DynamicDrawUsage || 35048); }
      const geo = new T.BufferGeometry(); geo.setAttribute("position", posA); geo.setAttribute("normal", norA);
      const d = ModeleH.sets.homme;
      geo.setIndex(new T.BufferAttribute(d.tri, 1));
      let off = 0;
      for (let r = 0; r < d.counts.length; r++) { const n = d.counts[r] * 3; if (r !== 4 && (r < 9 || r > 12) && n) geo.addGroup(off, n, r); off += n; }   // 9-12 : cils et sourcils, à part
      // zones de la tenue : chaque sommet porte sa distance aux limites (maillot, cuissard, chaussette, gant) ; le dessin trace des limites nettes
      const bin = (b) => { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; };
      const zi = new Int16Array(bin(MODELE_H.z)), zf = new Float32Array(zi.length);
      for (let i = 0; i < zi.length; i++) zf[i] = zi[i] / 1000;
      geo.setAttribute("aZone", new T.BufferAttribute(zf, 4));
      geo.setAttribute("aJambe", new T.BufferAttribute(new Float32Array(new Uint8Array(bin(MODELE_H.zl))), 1));
      const v16 = (b) => { const a = new Int16Array(bin(b)), f = new Float32Array(a.length); for (let i = 0; i < a.length; i++) f[i] = a[i] / 10000; return f; };
      geo.setAttribute("aVisage", new T.BufferAttribute(v16(MODELE_H.v), 4));
      geo.setAttribute("aChev", new T.BufferAttribute(v16(MODELE_H.c), 4));
      geo.setAttribute("aBind", new T.BufferAttribute(d.p, 3));
      const uvA = new T.BufferAttribute(new Uint16Array(bin(MODELE_H.uv)), 2, true);        // coordonnées de la texture de peau (et des yeux, cils, sourcils)
      geo.setAttribute("uv", uvA);
      const matCorps = matTenue(gant);
      const mats = [matCorps, maillot, cuissard, gant, blanc, matPeau, matBlanc, matYeux(), fac(0x3b2a1d, 90)];
      mats[13] = matChaussure();
      const mesh = new T.Mesh(geo, mats); mesh.frustumCulled = false; mesh.visible = false;
      // cils et sourcils (images à trous) : maillage à part, sans ombre portée, qui partage les sommets du corps ; ceux de l'autre genre sont cachés
      const geoV = new T.BufferGeometry(); geoV.setAttribute("position", posA); geoV.setAttribute("normal", norA); geoV.setAttribute("uv", uvA); geoV.setIndex(geo.index);
      off = 0;
      for (let r = 0; r < d.counts.length; r++) { const n = d.counts[r] * 3; if (r >= 9 && n) geoV.addGroup(off, n, r - 9); off += n; }
      const piece = (nom) => new T.MeshPhongMaterial({ map: texC(nom, true), transparent: true, alphaTest: 0.04, depthWrite: false, side: T.DoubleSide,
        shininess: 4, specular: 0x111111, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const matsV = [piece("cilsH"), piece("cilsF"), piece("sourcilsH"), piece("sourcilsF")];
      matsV[1].visible = matsV[3].visible = false;
      const meshV = new T.Mesh(geoV, matsV); meshV.frustumCulled = false; meshV.userData.sansOmbre = true; meshV.renderOrder = 1;
      mesh.add(meshV);
      corps.modeleH = { geo, posA, norA, mesh, mats, matCorps, genre: "homme", visage: { mesh: meshV, mats: matsV },
        matsIA: { yeux: new T.MeshPhongMaterial({ map: texC("yeux", true), shininess: 90, specular: 0x555555 }), chaussettes: fac(0xf2f4f6, 25), chaussure: matChaussure() } };   // coureurs virtuels : yeux marron, chaussettes blanches
      cycliste.add(mesh);
    }
    appliquerApparence();

    cycliste.traverse((o) => { if (o.isMesh && !o.userData.sansOmbre) o.castShadow = true; });
    // faible tache d'ombre pour les qualités sans ombres portées
    const ombre = new T.Mesh(new T.CircleGeometry(1, 20).rotateX(-Math.PI / 2),
      new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16, depthWrite: false }));
    ombre.scale.set(0.5, 1, 1.0); ombre.position.set(0, 0.07, 0); ombre.renderOrder = 2;
    cycliste.add(ombre);
    scene.add(cycliste);
  }

  // ===== autres coureurs (peloton virtuel) : versions simplifiées du cycliste, animées d'après les données de la simulation =====
  let ia = [];
  const _pi = [0, 0];
  function creerEtiquette(nom, couleur) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 72;
    const x = cv.getContext('2d');
    x.fillStyle = 'rgba(255,255,255,.92)'; x.beginPath();
    if (x.roundRect) x.roundRect(4, 8, 248, 56, 28); else x.rect(4, 8, 248, 56);
    x.fill();
    x.fillStyle = '#' + ('000000' + couleur.toString(16)).slice(-6); x.beginPath(); x.arc(36, 36, 17, 0, 6.2832); x.fill();
    x.lineWidth = 3; x.strokeStyle = 'rgba(20,30,40,.6)'; x.stroke();
    let taille = 34;                                     // nom long : police réduite pour tenir dans l'étiquette
    x.font = 'bold 34px sans-serif';
    while (taille > 20 && x.measureText(nom).width > 178) { taille -= 2; x.font = 'bold ' + taille + 'px sans-serif'; }
    x.fillStyle = '#1b2430'; x.textBaseline = 'middle'; x.fillText(nom, 66, 38);
    const tex = new T.CanvasTexture(cv);
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, opacity: 0.7, depthWrite: false }));
    sp.scale.set(1.0, 0.28, 1);
    return sp;
  }
  function creerCoureurIA(couleur, ampleur, nom, fantome, perso) {
    const lam = (c) => new T.MeshLambertMaterial({ color: c });
    const maillot = lam(couleur), peau = lam(0xd9a577), cuissard = lam(0x1c1f26), cadre = lam(couleur), noir = lam(0x14171c), gris = lam(0xa7b0bb), carbone = lam(0x22252b), blanc = lam(0xf2f4f6);
    const g = new T.Group(); g.rotation.order = "YXZ";
    const c = { g, ampleur, angRoue: Math.random() * 6, angMan: Math.random() * 6, s: 0, bras: [], jambes: [] };
    c.roueAv = creerRoue(noir, carbone, gris, blanc); c.roueAv.position.set(0, 0.34, -0.5);
    c.roueAr = creerRoue(noir, carbone, gris, blanc); c.roueAr.position.set(0, 0.34, 0.5);
    g.add(c.roueAv, c.roueAr);
    const segs = [[0.08, 0.30, 0.27, 0.90, 0.026], [0.27, 0.88, -0.40, 0.88, 0.026], [0.08, 0.30, -0.40, 0.80, 0.034], [0.08, 0.30, 0.50, 0.34, 0.018],
      [0.27, 0.86, 0.50, 0.34, 0.016], [-0.41, 0.90, -0.50, 0.34, 0.021], [-0.40, 0.92, -0.47, 0.97, 0.022]];
    c.velR = new T.Group(); g.add(c.velR);                 // vélo de route
    for (const s of segs) { const m = tube(s[4], cadre); placerTube(m, 0, s[1], s[0], 0, s[3], s[2]); c.velR.add(m); }
    const selle = new T.Mesh(new T.BoxGeometry(0.12, 0.04, 0.27), noir); selle.position.set(0, 0.96, 0.31); c.velR.add(selle);
    const guidon = new T.Mesh(new T.BoxGeometry(0.42, 0.025, 0.025), noir); guidon.position.set(0, 0.97, -0.48); c.velR.add(guidon);
    // vélo de chrono (mondes Triathlon) : cadre bas en tubes épais, tige de selle avancée, base en cornes, manchettes et prolongateurs, roue arrière pleine
    c.velC = new T.Group(); c.velC.visible = false; g.add(c.velC);
    const segsC = [[0.08, 0.30, 0.21, 0.80, 0.032], [0.21, 0.79, -0.42, 0.765, 0.03], [0.08, 0.30, -0.42, 0.66, 0.04], [0.08, 0.30, 0.50, 0.34, 0.018],
      [0.15, 0.55, 0.50, 0.34, 0.017], [-0.43, 0.77, -0.50, 0.34, 0.026], [0.21, 0.80, 0.235, 0.93, 0.024], [-0.43, 0.77, -0.43, 0.74, 0.03]];
    for (const s of segsC) { const m = tube(s[4], cadre); placerTube(m, 0, s[1], s[0], 0, s[3], s[2]); c.velC.add(m); }
    const boiteC = (w, h, p, x, y, z, m) => { const o = new T.Mesh(new T.BoxGeometry(w, h, p), m); o.position.set(x, y, z); c.velC.add(o); return o; };
    boiteC(0.11, 0.035, 0.25, 0, 0.95, 0.22, noir);                                  // selle
    boiteC(0.03, 0.06, 0.05, 0, 0.79, -0.40, noir);                                  // potence
    boiteC(0.40, 0.022, 0.05, 0, 0.75, -0.42, noir);                                 // base
    for (const sg of [-1, 1]) {
      boiteC(0.024, 0.024, 0.14, sg * 0.2, 0.745, -0.5, noir);                       // cornes
      boiteC(0.08, 0.025, 0.12, sg * 0.105, 0.785, -0.31, noir);                     // manchettes
      boiteC(0.02, 0.02, 0.30, sg * 0.045, 0.80, -0.5, carbone);                     // prolongateurs
      boiteC(0.02, 0.07, 0.02, sg * 0.045, 0.835, -0.65, carbone);                   // bout relevé
    }
    c.disque = new T.Mesh(new T.CylinderGeometry(0.3, 0.3, 0.035, 24).rotateZ(Math.PI / 2), carbone); c.disque.visible = false; c.roueAr.add(c.disque);
    c.k = 0; c.clm = false; c.matCadre = cadre; c.velo = "";
    const sph = (r, m, sx, sy, sz) => { const o = new T.Mesh(new T.SphereGeometry(r, 12, 8), m); o.scale.set(sx || 1, sy || 1, sz || 1); return o; };
    c.torse = tube(0.115, maillot, 1.2, 10); c.bassin = sph(0.13, cuissard, 1.3, 1, 1.1); c.cou = tube(0.04, peau, 1, 8);
    c.tete = sph(0.1, peau, 0.92, 1.04, 1); c.casque = sph(0.122, maillot, 1, 0.8, 1.4);
    for (const o of [c.torse, c.bassin, c.cou, c.tete, c.casque]) g.add(o);
    for (let k = 0; k < 2; k++) {
      const b = { haut: tube(0.05, maillot, 0.85, 8), bas: tube(0.037, peau, 0.8, 8), main: sph(0.045, noir, 1, 0.8, 1.3) };
      const j = { cuisse: tube(0.078, cuissard, 0.75, 10), mollet: tube(0.05, peau, 0.65, 8), chaussure: new T.Mesh(new T.BoxGeometry(0.09, 0.065, 0.25), blanc) };
      for (const o of Object.values(b).concat(Object.values(j))) g.add(o);
      c.bras.push(b); c.jambes.push(j);
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    if (fantome) g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.material.transparent = true; o.material.opacity = 0.38; o.material.depthWrite = false; } });
    try { if (nom) { c.etiq = creerEtiquette(nom, couleur); c.etiq.position.set(0, 2.25, 0); g.add(c.etiq); } } catch (err) { c.etiq = null; }
    // corps réaliste (pas pour le fantôme du record, qui reste une silhouette transparente)
    if (!fantome && perso && corps.modeleH && apparence.realiste !== false) {
      try { c.reel = creerCorpsReelIA(c, couleur, perso); } catch (err) { c.reel = null; console.warn("coureur virtuel réaliste indisponible", err); }
    }
    g.visible = false;
    return c;
  }
  function animerIA(c, tt) {
    const s = c.s, ang0 = c.angMan, sinA = Math.sin(ang0);
    let hy = HY + 0.085 * s + (1 - s) * 0.008 * Math.sin(2 * ang0) + s * 0.025 * Math.abs(sinA), hz = HZ - 0.13 * s, bal = (0.012 + 0.035 * s) * sinA;
    let sx = -bal * 0.9, sy = 1.34 + 0.09 * s + 0.004 * Math.sin(tt * 3.2), sz = -0.2 - 0.04 * s;
    // vélo de chrono : relevé sur les cornes (en groupe) ou allongé sur les prolongateurs (c.k = 1), buste presque à plat, mains jointes
    let mains = [[-0.21, 0.97, -0.49], [0.21, 0.97, -0.49]], pole = 0.7, poleY = -0.5;
    if (c.clm) {
      const k = c.k, mix = (a, b) => a + (b - a) * k;
      hz += mix(-0.05, -0.07); hy += -0.02;
      sy = mix(1.2, 1.1) + 0.004 * Math.sin(tt * 3.2); sz = mix(-0.25, -0.30);
      mains = [-1, 1].map((sg) => [mix(sg * 0.2, sg * 0.045), mix(0.77, 0.86), mix(-0.52, -0.64)]);
      pole = mix(0.7, 0.25); poleY = mix(-0.5, -1);
    }
    c.bassin.position.set(bal, hy, hz);
    placerTube(c.torse, bal, hy + 0.02, hz, sx, sy, sz); c.torse.scale.x = 1.18 * c.ampleur; c.torse.scale.z = 0.9 * c.ampleur;
    placerTube(c.cou, sx, sy + 0.03, sz - 0.02, sx, sy + 0.10, sz - 0.09);
    c.tete.position.set(sx * 0.4, sy + 0.115, sz - 0.14); c.casque.position.set(sx * 0.4, sy + 0.16, sz - 0.115);
    for (let k = 0; k < 2; k++) {
      const sg = k ? 1 : -1, b = c.bras[k], j = c.jambes[k];
      const ex = sx + sg * 0.19, ey = sy - 0.02, ez = sz, mx = mains[k][0], my = mains[k][1], mz = mains[k][2];
      const e = plier(ex, ey, ez, mx, my, mz, BRAS1, BRAS2, sg * pole, poleY, 0.15);
      placerTube(b.haut, ex, ey, ez, e[0], e[1], e[2]); placerTube(b.bas, e[0], e[1], e[2], mx, my, mz); b.main.position.set(mx, my, mz - 0.02);
      const ang = ang0 + k * Math.PI, xp = sg * 0.15, pz = BBZ - R_MAN * Math.sin(ang), py = BBY + R_MAN * Math.cos(ang), hx = bal + sg * 0.09;
      const ax = xp, ay = py + 0.10, az = pz + 0.075;
      const q = plier(hx, hy, hz, ax, ay, az, LJ, LJ, sg * 0.16, 0.05, -1);
      placerTube(j.cuisse, hx, hy, hz, q[0], q[1], q[2]); j.cuisse.scale.x = j.cuisse.scale.z = c.ampleur;
      placerTube(j.mollet, q[0], q[1], q[2], ax, ay, az);
      j.chaussure.position.set(xp, py + 0.05, pz - 0.04); j.chaussure.rotation.set(-0.06 - 0.24 * Math.sin(ang - 0.1), 0, 0);
    }
  }

  /* ---------- Coureurs virtuels réalistes : même corps MakeHuman, même tenue, même casque et mêmes vélos détaillés que l'avatar ----------
     Chacun a son allure (PERSOS_IA) et son maillot à sa couleur. Le corps est déformé à chaque image comme celui de l'utilisateur (majModeleH) :
     pour ménager l'ordinateur, il n'est utilisé qu'à moins de DIST_REEL_IA mètres de la caméra ; au-delà, l'ancien coureur simplifié le remplace. */
  const PERSOS_IA = {
    grimpeur: { genre: "homme", peau: 0xe8c09a, cheveux: 0x2a1c12, coupe: "court", barbe: "aucune", casque: 0xf2f4f6, verres: "bleu" },
    sprinteur: { genre: "homme", peau: 0x9a6440, cheveux: 0x121212, coupe: "rase", barbe: "courte", casque: 0x1b1d22, verres: "orange" },
    baroudeur: { genre: "homme", peau: 0xf0c8a8, cheveux: 0x8a5a2b, coupe: "court", barbe: "bouc", casque: 0xf2f4f6, verres: "fume" },
    puncheur: { genre: "femme", peau: 0xd9a577, cheveux: 0x3b2416, coupe: "chignon", barbe: "aucune", casque: 0x2b2f3a, verres: "violet" }
  };
  const DIST_REEL_IA = 100;
  // allure tirée au hasard (graine look de js/parcours-physique.js) : peau, cheveux, coupe, barbe, casque (parfois à la couleur du maillot), verres
  const PEAUX_IA = [0xf3d2b8, 0xe8c09a, 0xd9a577, 0xc68a5e, 0x9a6440, 0x6e4528], CHEVEUX_IA = [0x121212, 0x2a1c12, 0x3b2416, 0x5a3a22, 0x8a5a2b, 0xb98a50, 0xd8b878, 0x8c8c8c];
  function persoAleatoire(look, femme, couleur) {
    let s = look >>> 0;
    const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296), pick = (t) => t[Math.floor(r() * t.length)];
    return { genre: femme ? "femme" : "homme", peau: pick(PEAUX_IA), cheveux: pick(CHEVEUX_IA),
      coupe: femme ? pick(["chignon", "queue", "court"]) : pick(["court", "court", "rase", "degarni"]),
      barbe: femme ? "aucune" : pick(["aucune", "aucune", "courte", "bouc", "moustache", "complete"]),
      casque: pick([0xf2f4f6, 0xf2f4f6, 0x1b1d22, 0x2b2f3a, couleur]), verres: pick(Object.keys(VERRES)) };
  }
  function creerCorpsReelIA(c, couleur, P) {
    const mh = corps.modeleH, g = P.genre === "femme" && ModeleF ? "femme" : "homme", M = g === "femme" ? ModeleF : ModeleH, src = mh.geo, nv = src.attributes.position.count;
    const posA = new T.BufferAttribute(new Float32Array(nv * 3), 3), norA = new T.BufferAttribute(new Float32Array(nv * 3), 3);
    if (posA.setUsage) { posA.setUsage(T.DynamicDrawUsage || 35048); norA.setUsage(T.DynamicDrawUsage || 35048); }
    // mêmes triangles, zones de tenue, champs du visage et coordonnées de texture que le corps de l'utilisateur (partagés) ; seuls les sommets sont propres
    const geo = new T.BufferGeometry(); geo.setAttribute("position", posA); geo.setAttribute("normal", norA);
    for (const k of ["aZone", "aJambe", "aVisage", "aChev", "uv"]) geo.setAttribute(k, src.attributes[k]);
    geo.setAttribute("aBind", new T.BufferAttribute(M.sets[g].p, 3));
    geo.setIndex(src.index);
    for (const gr of src.groups) geo.addGroup(gr.start, gr.count, gr.materialIndex);
    geo.boundingSphere = new T.Sphere(new T.Vector3(0, 0.9, 0), 1.3);       // corps toujours autour du vélo : la caméra peut l'ignorer hors champ
    const C = (x) => new T.Color(x), coul = { peau: C(P.peau), maillot: C(couleur), bas: C(0x1c1f26), chaussette: C(0xf2f4f6), cheveux: C(P.cheveux) };
    const matCorps = matTenue(mh.mats[3], coul), u = matCorps.userData.u, cp = COUPES[P.coupe] || COUPES.court, f = g === "femme";
    u.uTexPeau.value = texC(f ? "peauF" : "peauH"); u.uTexOmbre.value = texC(f ? "ombreF" : "ombreH");
    u.uEpCh.value = P.casque === null ? cp.ep : Math.min(cp.ep, 0.002); u.uRecul.value = cp.recul; u.uNuque.value = cp.nuque; u.uRase.value = cp.rase || 0;   // toujours casqué
    u.uBarbe.value = BARBES[P.barbe] || 0; u.uFinS.value = f ? 0.0006 : 0;
    u.uSourcils.value.set(P.cheveux).multiplyScalar(f ? 0.85 : 0.75);
    u.uLevres.value.set(P.peau).lerp(C(f ? 0xb4505c : 0xa8504a), f ? 0.6 : 0.45);
    const mats = mh.mats.slice(); mats[0] = matCorps; mats[6] = mh.matsIA.chaussettes; mats[7] = mh.matsIA.yeux; mats[13] = mh.matsIA.chaussure;
    const mesh = new T.Mesh(geo, mats); mesh.castShadow = true;
    // cils et sourcils : leurs propres matières (sourcils de la couleur des cheveux), celles de l'autre genre cachées
    const geoV = new T.BufferGeometry(); geoV.setAttribute("position", posA); geoV.setAttribute("normal", norA); geoV.setAttribute("uv", src.attributes.uv); geoV.setIndex(src.index);
    for (const gr of mh.visage.mesh.geometry.groups) geoV.addGroup(gr.start, gr.count, gr.materialIndex);
    geoV.boundingSphere = geo.boundingSphere;
    const matsV = mh.visage.mats.map((m) => m.clone());
    matsV[0].visible = matsV[2].visible = !f; matsV[1].visible = matsV[3].visible = f;
    for (const k of [2, 3]) matsV[k].color.set(P.cheveux).multiplyScalar(1.15);
    const meshV = new T.Mesh(geoV, matsV); meshV.renderOrder = 1; mesh.add(meshV);
    // tête : casque (à la couleur choisie) et lunettes (verres propres) recopiés de ceux de l'avatar
    const tete = new T.Group();
    if (corps.casqueH) {
      const ca = corps.casqueH.clone(); ca.visible = true;
      const coque = ca.children[0]; coque.material = coque.material.clone(); coque.material.color = C(P.casque);
      const lu = corps.lunettesH.clone(); lu.visible = true;
      const verre = lu.children[0], gl = verre.geometry.clone(), v = VERRES[P.verres] || VERRES.orange, a = C(v[0]), b = C(v[1]), col = gl.attributes.color, n = corps.verresH.nv;
      for (let i = 0; i < col.count; i++) { const cc = a.clone().lerp(b, (i % (n + 1)) / n); col.setXYZ(i, cc.r, cc.g, cc.b); }
      verre.geometry = gl;
      ca.visible = P.casque !== null && P.casque !== undefined;   // (v72) un ami sans casque ni lunettes (sortie de groupe) ; les coureurs IA en ont toujours
      lu.visible = P.lunettes !== false;
      tete.add(ca, lu);
    }
    tete.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const R = { g, M, posA, norA, mesh, tete, velos: {}, roues: {}, vd: null, rr: null, cle: "", actif: false };
    mesh.visible = tete.visible = false;
    c.g.add(mesh, tete);
    return R;
  }
  // vélo détaillé du coureur (modèle et roues choisis par js/parcours-physique.js), fabriqué à la première utilisation
  function veloReelIA(c, id, rid) {
    const R = c.reel;
    if (!R.velos[id] && id) { const vd = fabriquerVelo(id); R.velos[id] = vd || false; if (vd) for (const o of vd.tous) { o.visible = false; c.g.add(o); } }
    if (!R.roues[rid] && rid) { const W = fabriquerRoues(rid); R.roues[rid] = W || false; if (W) { c.roueAv.add(W.av); c.roueAr.add(W.ar); } }
    R.vd = R.velos[id] || null; R.rr = R.roues[rid] || null;
    if (R.vd && R.rr) { const fl = R.vd.def.flanc || [0.06, 0.06, 0.06]; for (const m of R.rr.flancs) m.color.setRGB(fl[0], fl[1], fl[2]); }
    R.cle = "";
  }
  // passe du coureur simplifié au coureur réaliste (et inversement)
  function montrerReelIA(c, on) {
    const R = c.reel;
    R.actif = on;
    R.mesh.visible = R.tete.visible = on;
    for (const o of [c.torse, c.bassin, c.cou, c.tete, c.casque]) o.visible = !on;
    for (const b of c.bras) for (const k in b) b[k].visible = !on;
    for (const j of c.jambes) for (const k in j) j[k].visible = !on;
    const det = on && R.vd && R.rr;
    c.velR.visible = !det && !c.clm; c.velC.visible = !det && c.clm; c.disque.visible = !det && c.clm;
    for (const k in R.velos) { const vd = R.velos[k]; if (vd) for (const o of vd.tous) o.visible = det && vd === R.vd; }
    for (const k in R.roues) { const W = R.roues[k]; if (W) W.av.visible = W.ar.visible = det && W === R.rr; }
    for (const rr of [c.roueAv, c.roueAr]) for (const o of rr.children) if (!o.userData.detaille && o !== c.disque) o.visible = !det;
  }
  // pose du corps réaliste : mêmes calculs que majModeleH (position réglée d'après l'étude posturale, pédalage, danseuse, chrono)
  function poserReelIA(c, tt) {
    const R = c.reel, g = R.g, M = R.M, s = c.s, ang = c.angMan, sinA = Math.sin(ang);
    const hy = HY + 0.085 * s + (1 - s) * 0.008 * Math.sin(2 * ang) + s * 0.025 * Math.abs(sinA), hz = HZ - 0.13 * s, bal = (0.012 + 0.035 * s) * sinA;
    const sx = -bal * 0.9 + 0.012 * s * sinA, sy = 1.34 + 0.09 * s + 0.004 * Math.sin(tt * 3.2), sz = -0.18 - (0.02 * Math.min(c.eff || 0.8, 1.3) + 0.04 * s);
    const ch = [], pit = [];
    for (let k = 0; k < 2; k++) {
      const sg = k ? 1 : -1, a = ang + k * Math.PI;
      ch.push([sg * 0.15, BBY + R_MAN * Math.cos(a) + CHEV_PED, BBZ - R_MAN * Math.sin(a) + 0.075]);
      pit.push(-0.06 - 0.24 * Math.sin(a - 0.1));
    }
    const clm = !!(R.vd && R.vd.def.clm), rp = reglagePosition(g, M.sets[g].j, clm), rel = clm ? 1 - c.k : 0;
    let poignets = [[-rp.wx, rp.W2[0], rp.W2[1]], [rp.wx, rp.W2[0], rp.W2[1]]], mainD = clm ? [0, 0.4, -1] : [0, -0.25, -1], polesB = clm ? [[-0.3, -1, 0.25], [0.3, -1, 0.25]] : [[-0.7, -0.5, 0.15], [0.7, -0.5, 0.15]];
    if (rel > 0.01) {
      const cy = rp.coude[0] - 0.105, cz = rp.coude[1] - 0.15;
      poignets = poignets.map((w, i) => [w[0] + ((i ? 0.2 : -0.2) - w[0]) * rel, w[1] + (cy + 0.03 - w[1]) * rel, w[2] + (cz + 0.05 - w[2]) * rel]);
      mainD = [0, 0.4 - 0.75 * rel, -1]; polesB = [[-0.3 - 0.4 * rel, -1 + 0.5 * rel, 0.25 - 0.1 * rel], [0.3 + 0.4 * rel, -1 + 0.5 * rel, 0.25 - 0.1 * rel]];
    }
    const cle = rp.cle + "|" + (R.vd ? R.vd.def.id : "");
    if (R.vd && R.cle !== cle) { R.cle = cle; placerVeloDetaille(R.vd, rp); }
    const info = M.poser({ genre: g, g: 1.0, bassin: clm ? 0.45 : 0.25, P2: [bal, rp.P2[0] + hy - HY, rp.P2[1] + hz - HZ], N2: [sx, rp.N2[0] + sy - 1.34, rp.N2[1] + sz + 0.18], pitch: pit, cheville: ch,
      poignet: poignets, mainDir: mainD, teteDir: clm ? [0, 0.88, -0.48] : [0, 0.9, -0.43],
      paume: clm && rel < 0.5 ? [[0.92, -0.3, 0.2], [-0.92, -0.3, 0.2]] : [[0.35, -0.94, 0], [-0.35, -0.94, 0]],
      polesJambe: [[-0.16, 0.05, -1], [0.16, 0.05, -1]], polesBras: polesB }, R.posA.array, R.norA.array);
    R.posA.needsUpdate = true; R.norA.needsUpdate = true;
    const t = info.tete;
    if (t) {                                       // casque et lunettes posés sur la tête, comme pour l'avatar
      const Rm = t.R, J = M.sets[g].j, ye = t.pos(J.Ey), ts = J.Ts || [1, 1];
      if (!_m4.m) _m4.m = new T.Matrix4();
      _m4.m.set(Rm[0], Rm[1], Rm[2], 0, Rm[3], Rm[4], Rm[5], 0, Rm[6], Rm[7], Rm[8], 0, 0, 0, 0, 1);
      R.tete.quaternion.setFromRotationMatrix(_m4.m);
      R.tete.scale.set(ts[0], ts[1], ts[0]);
      const o = [0, 0.005 * ts[1], -0.09 * ts[0]], ro = [Rm[0] * o[0] + Rm[1] * o[1] + Rm[2] * o[2], Rm[3] * o[0] + Rm[4] * o[1] + Rm[5] * o[2], Rm[6] * o[0] + Rm[7] * o[1] + Rm[8] * o[2]];
      R.tete.position.set(ye[0] - ro[0], ye[1] - ro[1] + 0.01, ye[2] - ro[2]);
    }
    if (R.vd) {                                    // pédalier et pédales du vélo détaillé
      for (let k = 0; k < 2; k++) {
        const sg = k ? 1 : -1, a = ang + k * Math.PI, pe = R.vd.pedales[k];
        pe.position.set(sg * 0.147, BBY + R_MAN * Math.cos(a), BBZ - R_MAN * Math.sin(a)); pe.rotation.x = pit[k];
      }
      R.vd.G.pedalier.rotation.x = -ang;
    }
  }

  /* ---------- Arche de départ / arrivée (tous les mondes, d'après la longueur du parcours) ---------- */
  let arches = null;
  function texBandeau(texte) {
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 160;
    const x = cv.getContext('2d');
    x.fillStyle = '#1b2430'; x.fillRect(0, 0, 1024, 160);
    for (let i = 0; i < 64; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#ffffff' : '#1b2430'; x.fillRect(i * 16, j * 16, 16, 16); x.fillRect(i * 16, 128 + j * 16, 16, 16); }
    x.fillStyle = '#ff7a2f'; x.fillRect(0, 36, 1024, 88);
    x.fillStyle = '#ffffff'; x.font = 'bold 66px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(texte, 512, 82);
    return new T.CanvasTexture(cv);
  }
  function creerArches() {
    const rouge = new T.MeshLambertMaterial({ color: 0xe84a4a }), blanc = new T.MeshLambertMaterial({ color: 0xf4f6f8 }), noir = new T.MeshLambertMaterial({ color: 0x20252d });
    arches = [];
    for (let i = 0; i < 2; i++) {
      const g = new T.Group();
      const largeur = 2 * (DEMI_G + 1.3);
      const pieds = [];
      for (const sg of [-1, 1]) {
        const p = new T.Mesh(new T.BoxGeometry(0.7, 6, 0.7), rouge); p.position.set(sg * largeur / 2, 3, 0); g.add(p);
        const b = new T.Mesh(new T.BoxGeometry(1.1, 0.5, 1.1), noir); b.position.set(sg * largeur / 2, 0.25, 0); g.add(b);
        pieds.push({ p, b, u: sg * largeur / 2 });
      }
      const poutre = new T.Mesh(new T.BoxGeometry(largeur + 1, 0.5, 0.9), blanc); poutre.position.set(0, 6.05, 0); g.add(poutre);
      const mats = {};
      for (const k of ['DÉPART · ARRIVÉE', 'DÉPART', 'ARRIVÉE']) mats[k] = new T.MeshBasicMaterial({ map: texBandeau(k) });
      const ban = new T.Mesh(new T.BoxGeometry(largeur, 1.2, 0.3), mats['DÉPART']); ban.position.set(0, 6.9, 0); g.add(ban);
      g.visible = false;
      scene.add(g);
      arches.push({ g, ban, mats, pieds, d: -1, txt: '' });
    }
  }
  function majArches(d) {
    if (!route || !(route.longueur > 0)) { if (arches) for (const a of arches) a.g.visible = false; return; }
    if (!arches) { try { creerArches(); } catch (err) { arches = []; } }
    const L = route.longueur, liste = [];
    if (route.boucle) { const k = Math.floor(d / L); liste.push([k * L, 'DÉPART · ARRIVÉE'], [(k + 1) * L, 'DÉPART · ARRIVÉE']); }
    else liste.push([0, 'DÉPART'], [L, 'ARRIVÉE']);
    for (let i = 0; i < arches.length; i++) {
      const a = arches[i], it = liste[i];
      if (!it || Math.abs(it[0] - d) > 420) { a.g.visible = false; continue; }
      a.g.visible = true;
      if (a.d !== it[0]) {
        a.d = it[0];
        posChemin(it[0], _p);
        const h = cap(it[0]);
        a.g.position.set(_p[0], alt3d(it[0]), _p[1]);
        a.g.rotation.set(0, -h, 0);
        poserPieds(a.pieds, it[0], 6, 0.25);
      }
      if (a.txt !== it[1]) { a.txt = it[1]; a.ban.material = a.mats[it[1]]; }
    }
  }

  /* (v69) hauteur du sol à l'écart u de l'axe de la route, à la distance d (mondes réels : le sol IGN, plus grossier, peut être plus bas ou plus haut que la route) */
  function solSous(d, u) {
    posChemin(d, _q);
    const h = cap(d), x = _q[0] + Math.cos(h) * u, z = _q[1] + Math.sin(h) * u;
    if (GEO) return solReel ? solReel.h(x, z) : alt3d(d);
    return alt3d(d) + relief(d, u);
  }
  // les poteaux (hauteur `haut` au-dessus de la route) descendent jusqu'au sol ; le socle (demi-hauteur `bs`) est posé dessus
  function poserPieds(pieds, d, haut, bs) {
    const y0 = alt3d(d);
    for (const q of pieds) {
      let s = solSous(d, q.u) - y0;
      if (!isFinite(s)) s = 0;
      s = Math.max(-25, Math.min(3, s));
      const bas = Math.min(s, 0) - 0.3, H = haut - bas;
      q.p.scale.y = H / haut; q.p.position.y = bas + H / 2;
      if (q.b) q.b.position.y = s + bs;
    }
  }

  /* ---------- Portiques des segments chronométrés (v69) : banderole au départ et à l'arrivée de chaque segment ---------- */
  let portiques = null, segs3d = [];
  const COUL_PORTIQUE = { sprint: ["#1f9d55", "#ffffff"], montee: ["#ffffff", "#d62839"], secteur: ["#e8dcc0", "#3a3226"] };
  const matsPortique = {};
  function matPortique(type, texte) {
    const k = type + "|" + texte;
    if (matsPortique[k]) return matsPortique[k];
    const cv = document.createElement("canvas"); cv.width = 1024; cv.height = 128;
    const x = cv.getContext("2d"), c = COUL_PORTIQUE[type] || COUL_PORTIQUE.sprint;
    x.fillStyle = c[0]; x.fillRect(0, 0, 1024, 128);
    if (type === "montee") { x.fillStyle = "#d62839"; for (let i = 0; i < 36; i++) for (let j = 0; j < 4; j++) { x.beginPath(); x.arc(14 + i * 29 + (j % 2) * 14, 16 + j * 32, 7, 0, 6.2832); x.fill(); } x.fillStyle = "rgba(255,255,255,.88)"; x.fillRect(90, 22, 844, 84); }
    x.fillStyle = c[1]; x.textAlign = "center"; x.textBaseline = "middle";
    let fs = 64; x.font = "bold " + fs + "px sans-serif";
    while (fs > 30 && x.measureText(texte).width > 820) { fs -= 4; x.font = "bold " + fs + "px sans-serif"; }
    x.fillText(texte, 512, 66);
    const t = new T.CanvasTexture(cv); if (T.sRGBEncoding) t.encoding = T.sRGBEncoding;
    return (matsPortique[k] = new T.MeshBasicMaterial({ map: t }));
  }
  function creerPortiques() {
    const gris = new T.MeshLambertMaterial({ color: 0x2b3038 });
    portiques = [];
    for (let i = 0; i < 4; i++) {
      const g = new T.Group(), largeur = 2 * (DEMI_G + 1.1);
      const pieds = [];
      for (const sg of [-1, 1]) { const p = new T.Mesh(new T.BoxGeometry(0.28, 5.6, 0.28), gris); p.position.set(sg * largeur / 2, 2.8, 0); g.add(p); pieds.push({ p, u: sg * largeur / 2 }); }
      const ban = new T.Mesh(new T.BoxGeometry(largeur, 0.95, 0.12), gris); ban.position.set(0, 5.3, 0); g.add(ban);
      g.visible = false; scene.add(g);
      portiques.push({ g, ban, pieds, d: -1, k: "" });
    }
  }
  function majPortiques(d) {
    if (!segs3d.length || !route || !(route.longueur > 0)) { if (portiques) for (const p of portiques) p.g.visible = false; return; }
    if (!portiques) creerPortiques();
    const L = route.longueur, liste = [];
    for (const s of segs3d) for (const fin of [false, true]) {
      const x0 = fin ? s.e : s.s, a = route.boucle ? Math.round((d - x0) / L) * L + x0 : x0;
      if (Math.abs(a - d) < 420) liste.push({ a, type: s.type, txt: fin ? "FIN · " + s.nom.toUpperCase() : s.nom.toUpperCase() });
    }
    liste.sort((p, q) => Math.abs(p.a - d) - Math.abs(q.a - d));
    for (let i = 0; i < portiques.length; i++) {
      const p = portiques[i], it = liste[i];
      if (!it) { p.g.visible = false; continue; }
      p.g.visible = true;
      if (p.d !== it.a) { p.d = it.a; posChemin(it.a, _p); p.g.position.set(_p[0], alt3d(it.a), _p[1]); p.g.rotation.set(0, -cap(it.a), 0); poserPieds(p.pieds, it.a, 5.6, 0); }
      const k = it.type + "|" + it.txt;
      if (p.k !== k) { p.k = k; p.ban.material = matPortique(it.type, it.txt); }
    }
  }
// (v72) un coureur dont la définition n'a pas changé est gardé tel quel : l'arrivée ou le départ d'un ami (sortie de groupe)
// ne reconstruit plus tous les corps réalistes d'un coup
const cleIA = (o) => [o.couleur, o.ampleur || 1, o.nom, !!o.fantome, o.look, o.femme, o.id, o.perso ? JSON.stringify(o.perso) : ""].join("|");
function definirPeloton(liste) {
  if (!scene) return;
  const libres = new Map();
  for (const c of ia) { const l = libres.get(c.cle) || []; l.push(c); libres.set(c.cle, l); }
  ia = (liste || []).map((o) => {
    const k = cleIA(o), l = libres.get(k);
    if (l && l.length) return l.shift();
    const c = creerCoureurIA(o.couleur, o.ampleur || 1, o.nom, o.fantome, o.perso || (o.look !== undefined ? persoAleatoire(o.look, o.femme, o.couleur) : PERSOS_IA[o.id]));
    c.cle = k; scene.add(c.g); return c;
  });
  for (const l of libres.values()) for (const c of l) scene.remove(c.g);
}
  // dRef : distance affichée du cycliste ; les écarts avec l'utilisateur sont conservés tels quels
  // couleur principale des modèles de vélo des coureurs virtuels (d'après les vélos détaillés de js/velos.js)
  const COUL_VELO_IA = { v5rs: 0xe9ebee, foil: 0x6e7175, madone: 0xe6e2d6, dogma: 0xb3141a, plasma: 0xdfe6e8, speed: 0x6640c8, triton: 0x1d1e21, tritonb: 0x84d4ca };
  function majIA(e, dt, dRef) {
    const L = e.peloton || [];
    for (let k = 0; k < ia.length; k++) {
      const c = ia[k], q = L[k], k0 = k;
      if (!q) { c.g.visible = false; continue; }
      const rel = q.d - e.distance;
      if (Math.abs(rel) > 450) { c.g.visible = false; continue; }
      c.g.visible = true;
      // lissage de l'affichage : jamais de saut brusque, même si la simulation avance par petits pas
      if (c.relA === undefined || Math.abs(rel - c.relA) > 15) { c.relA = rel; c.voieA = q.voie; }
      const lis = 1 - Math.exp(-dt * 9);
      c.relA += (rel - c.relA) * lis; c.voieA += (q.voie - c.voieA) * lis;
      const dd = dRef + ecart + c.relA;
      c.angRoue += (q.v / 0.34) * dt; c.angMan += (q.cad || 0) * 0.10472 * dt;
      if (!!q.clm !== c.clm) { c.clm = !!q.clm; c.velC.visible = c.disque.visible = c.clm; c.velR.visible = !c.clm; c.reelMaj = true; }
      if (c.reel && (q.velo !== c.reel.idV || q.roues !== c.reel.idR)) { c.reel.idV = q.velo; c.reel.idR = q.roues; veloReelIA(c, q.velo, q.roues); c.reelMaj = true; }
      c.eff = q.ratio;
      if (q.velo && q.velo !== c.velo) { c.velo = q.velo; if (COUL_VELO_IA[q.velo] !== undefined) c.matCadre.color.setHex(COUL_VELO_IA[q.velo]); }   // couleur du modèle de vélo
      c.k = q.clm ? 1 - (q.grp || 0) : 0;
      c.s += ((q.ratio > 1.08 && q.pente > 0.04 ? 1 : 0) - c.s) * (1 - Math.exp(-dt * 2));
      c.roueAv.rotation.x = -c.angRoue; c.roueAr.rotation.x = -c.angRoue;
      posChemin(dd, _pi);
      const h = cap(dd), y = alt3d(dd), pt = Math.atan((alt3d(dd + 3) - alt3d(dd - 3)) / 6);
      c.g.position.set(_pi[0] + Math.cos(h) * c.voieA, y, _pi[1] + Math.sin(h) * c.voieA);
      c.g.rotation.set(pt, -h, q.cad > 0 ? Math.sin(c.angMan) * (0.012 + 0.09 * c.s) : 0);
      // un coureur collé à la caméra (entre elle et toi, par exemple sur la grille de départ) bouchait toute la vue : il est caché
      if (rel < 0 && vue !== "action" && Math.hypot(c.g.position.x - camera.position.x, c.g.position.z - camera.position.z) < 3.0) { c.g.visible = false; continue; }
      if (c.reel) {                       // corps réaliste de près, coureur simplifié au loin (un peu d'écart entre les deux seuils pour ne pas clignoter)
        const dc = Math.hypot(c.g.position.x - camera.position.x, c.g.position.y - camera.position.y, c.g.position.z - camera.position.z);
        const on = c.reel.actif ? dc < DIST_REEL_IA + 10 : dc < DIST_REEL_IA;
        if (on !== c.reel.actif || c.reelMaj) { c.reelMaj = false; montrerReelIA(c, on); c.saut = true; }
        c.dc = dc;
      }
      // corps réaliste : recalculé à chaque image de près, une image sur deux au-delà de 40 m (beaucoup de coureurs)
      if (c.reel && c.reel.actif) { c.saut = !c.saut; if (!c.saut || c.dc < 40) poserReelIA(c, temps); }
      else animerIA(c, temps);
      if (c.etiq) {                       // l'étiquette grossit avec la distance pour rester lisible, et disparaît au loin
        const dist = Math.hypot(c.g.position.x - camera.position.x, c.g.position.y - camera.position.y, c.g.position.z - camera.position.z);
        const k = Math.min(4, Math.max(1, dist / 18));
        c.etiq.scale.set(1.0 * k, 0.28 * k, 1); c.etiq.position.y = 2.2 + 0.1 * k + (k0 % 2) * 0.3 * k; c.etiq.renderOrder = 10 + k0;
        c.etiq.visible = dist < 170 && dist > 1.5 && (q.d - e.distance > -6 || dist < 25);   // noms : seulement ceux qui sont devant toi ou tout près
      }
    }
  }

  // déforme le modèle 3D réaliste pour qu'il suive le bassin, les épaules, les pédales et le guidon
  const _m4 = { m: null };
  const CHEV_H = { y: 0.03, z: 0.012, sx: 0.8, sy: 0.82, sz: 0.93 };   // calotte de cheveux sur la tête du nouveau corps
  // ---- position sur le vélo d'après une étude posturale (photo fournie par l'utilisateur) : genou ouvert à 143° quand la pédale est en bas,
  // ligne hanche-épaule à 41,4° de l'horizontale, 76,2° entre le buste et le bras, coude à 160°. On en déduit, pour chaque corps,
  // la place du bassin, du cou et des poignets, puis on règle le vélo dessous (hauteur de selle, taille du cadre, cintre), comme chez un « bike fitter »
  const ANGLES_POS = { genou: 143, buste: 41.4, epaule: 76.2, coude: 160, selle: 74 };
  // position de contre-la-montre (photo fournie par l'utilisateur) : buste presque à plat (12°), bras verticaux, avant-bras posés sur les manchettes
  // et légèrement relevés vers les mains jointes au bout des prolongateurs ; coureur avancé (tube de selle à 78°)
  const ANGLES_CLM = { genou: 145, buste: 12, epaule: 80, coude: 98, selle: 78 };
  const CHEV_PED = 0.072;               // hauteur de la cheville au-dessus de l’axe de la pédale (corps réaliste, avec ses chaussures)
  const SEGS_VELO = [   // vélo standard (ancien modèle) : [z1, y1, z2, y2, rayon] — tube de selle, tube horizontal, tube diagonal, bases, haubans, fourche, potence, tige de selle
    [0.08, 0.30, 0.27, 0.90, 0.026], [0.27, 0.88, -0.40, 0.88, 0.026], [0.08, 0.30, -0.40, 0.80, 0.034],
    [0.08, 0.30, 0.50, 0.34, 0.018], [0.27, 0.86, 0.50, 0.34, 0.016], [-0.41, 0.90, -0.50, 0.34, 0.021],
    [-0.40, 0.92, -0.47, 0.97, 0.022], [0.27, 0.90, 0.30, 0.95, 0.016]
  ];
  const reglagesPos = {};
  function reglagePosition(g, J, clm) {
    const cle = g + (clm ? "|clm" : "");
    if (reglagesPos[cle]) return reglagesPos[cle];
    const AP = clm ? ANGLES_CLM : ANGLES_POS;
    const rad = Math.PI / 180, L = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const a = L(J.H, J.K), b = L(J.K, J.A), d = Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(AP.genou * rad));
    // hanche sur l'axe du tube de selle (74°, 78° en chrono), à la distance d de la cheville quand la pédale est en bas
    const uy = Math.sin(AP.selle * rad), uz = Math.cos(AP.selle * rad), py = BBY - (BBY - R_MAN + CHEV_PED), pz = BBZ - (BBZ + 0.075);
    const B = py * uy + pz * uz, t = -B + Math.sqrt(B * B - (py * py + pz * pz - d * d));
    const H2 = [BBY + t * uy, BBZ + t * uz];                                    // [y, z]
    const P2 = [H2[0] - (J.H[1] - J.P[1]), H2[1] - (J.H[2] - J.P[2])];
    // angles de profil comptés depuis l'avant (-z) vers le haut : un point à la distance r et à l'angle θ est en (y + r sin θ, z - r cos θ)
    const ang = (y, z) => Math.atan2(y, -z), T0 = J.T || J.N;
    const aT = ang(T0[1] - J.P[1], T0[2] - J.P[2]), aS = ang(J.S[1] - J.P[1], J.S[2] - J.P[2]);
    const aB = AP.buste * rad + aT - aS, ln = Math.hypot(T0[1] - J.P[1], T0[2] - J.P[2]);
    const N2 = [P2[0] + ln * Math.sin(aB), P2[1] - ln * Math.cos(aB)];
    const rS = Math.hypot(J.S[1] - J.P[1], J.S[2] - J.P[2]), aS2 = aS + aB - aT;  // épaule, après la bascule du buste
    const S2 = [P2[0] + rS * Math.sin(aS2), P2[1] - rS * Math.cos(aS2)];
    // bras (allongés de 8 % comme dans poser) : le bras part vers le bas et l'avant, l'avant-bras remonte de 20° (coude à 160°)
    const la = 1.08 * L(J.S, J.E), lb = 1.08 * L(J.E, J.W);
    const a1 = (AP.buste + 180 + AP.epaule) * rad, a2 = a1 + (180 - AP.coude) * rad;
    const E2 = [S2[0] + la * Math.sin(a1), S2[1] - la * Math.cos(a1)];
    const W2 = [E2[0] + lb * Math.sin(a2), E2[1] - lb * Math.cos(a2)];
    const r = { cle, clm: !!clm, P2, N2, W2, E2, wx: clm ? 0.045 : Math.min(0.21, Math.abs(J.S[0]) + 0.03),
      selle: [H2[0] - 0.074, H2[1] - 0.01],               // dessus de la selle : 7,4 cm sous la hanche, le bec sous l’entrejambe
      cintre: clm ? [W2[0] + 0.012, W2[1] - 0.075] : [W2[0] - 0.015, W2[1] - 0.05],   // route : cocottes ; chrono : bout des prolongateurs dans les mains
      coude: [E2[0] - 0.048, E2[1] + 0.005],               // chrono : dessus des manchettes, sous les coudes
      s: (a + b) / 0.854 };
    reglagesPos[cle] = r;
    return r;
  }
  // définition du vélo détaillé choisi (VELOS.velos), ou null
  const defsVelo = {};
  function defVelo() {
    const id = apparence.velo;
    if (!id || id === "simple" || typeof VELOS === "undefined") return null;
    if (defsVelo[id] === undefined) defsVelo[id] = VELOS.velos.find((v) => v.id === id) || null;
    return defsVelo[id];
  }
  // replace le cadre, la selle et le cintre (r : réglage d'un corps réaliste, ou null pour le vélo standard)
  // ---- vélos détaillés (js/velos.js, modélisés dans Blender d'après les photos de l'utilisateur, sans logos) : construits à la première utilisation,
  // seulement sous le corps réaliste (il faut son réglage de position) ; le cadre est abaissé pour la femme, la selle et le cintre suivent le corps
  const geosVelo = [], velosFaits = {};
  let veloActif = null;
  const binV = (b) => { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; };
  function geoVelo(k) {
    if (!geosVelo[k]) {
      const d = VELOS.geos[k], q = new Int16Array(binV(d.p)), p = new Float32Array(q.length);
      for (let i = 0; i < q.length; i++) p[i] = q[i] * 4e-5;
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.BufferAttribute(p, 3));
      g.setAttribute("normal", new T.BufferAttribute(new Int8Array(binV(d.n)), 3, true));
      const ib = binV(d.i); g.setIndex(new T.BufferAttribute(p.length / 3 > 65535 ? new Uint32Array(ib) : new Uint16Array(ib), 1));
      geosVelo[k] = g;
    }
    return geosVelo[k];
  }
  const BRILLANCE_V = { metal: [80, 0x666666], carbone: [45, 0x333333], pneu: [4, 0x080808], flanc: [6, 0x101010], noir: [30, 0x2a2a2a], guidoline: [3, 0x080808], selle: [18, 0x222222], tige: [40, 0x333333] };
  function construireVelo(id) {
    if (velosFaits[id] !== undefined) return velosFaits[id];
    const vd = fabriquerVelo(id);
    if (vd) for (const o of vd.tous) { o.visible = false; cycliste.add(o); }
    return (velosFaits[id] = vd);
  }
  // fabrique un exemplaire du vélo détaillé id (formes partagées, matières propres), sans le placer : aussi pour les coureurs virtuels
  function fabriquerVelo(id) {
    const def = typeof VELOS !== "undefined" ? VELOS.velos.find((v) => v.id === id) : null;
    if (!def) return null;
    const G = { cadre: new T.Group(), cadreIn: new T.Group(), pedalier: new T.Group(), pedale: new T.Group(), selle: new T.Group(), cintre: new T.Group(), socle: new T.Group(), ext: new T.Group() };
    G.cadre.add(G.cadreIn); G.cadre.position.set(0, BBY, 0); G.cadreIn.position.set(0, -BBY, 0);   // le cadre s'abaisse autour du pédalier
    G.pedalier.position.set(0, BBY, BBZ);
    let teinte = null, matTige = null;
    for (const p of VELOS.pieces) {
      if (p.roue || (p.selle ? p.selle !== def.selle : p.velo ? p.velo !== id : false)) continue;     // les roues sont construites à part (construireRoues)
      if (p.clm ? !def.clm : def.clm && p.g === "cintre") continue;   // chrono : manchettes et prolongateurs (socle, ext) au lieu du cintre de route
      let geo = geoVelo(p.geo), mat;
      if (p.c) {                     // cadre peint : couleurs par sommet propres à ce vélo (la forme peut être partagée)
        const c8 = new Uint8Array(binV(p.c)), g2 = new T.BufferGeometry();
        g2.setAttribute("position", geo.attributes.position); g2.setAttribute("normal", geo.attributes.normal); g2.setIndex(geo.index);
        g2.setAttribute("color", new T.BufferAttribute(c8, 3, true)); geo = g2;
        let r = 0, g = 0, b = 0; for (let i = 0; i < c8.length; i += 3) { r += c8[i]; g += c8[i + 1]; b += c8[i + 2]; }
        const n = c8.length / 3 * 255; teinte = new T.Color(r / n, g / n, b / n);
        mat = new T.MeshPhongMaterial({ vertexColors: true, shininess: def.brillant, specular: def.brillant > 40 ? 0x5a5a5a : 0x1c1c1c });
      } else {
        const b = BRILLANCE_V[p.m] || [30, 0x222222];
        mat = new T.MeshPhongMaterial({ color: new T.Color(p.k[0], p.k[1], p.k[2]), shininess: b[0], specular: b[1] });
        if (p.m === "tige" && def.tige === "cadre") matTige = mat;
      }
      const m = new T.Mesh(geo, mat); m.castShadow = true;
      (p.g === "cadre" ? G.cadreIn : G[p.g]).add(m);
    }
    if (matTige && teinte) { matTige.color.copy(teinte); matTige.shininess = def.brillant; }   // tige de selle de la couleur du cadre (Dogma)
    const pedales = [G.pedale.clone(), G.pedale];
    pedales[0].scale.x = -1;                                          // pédale gauche : la droite en miroir
    const potence = new T.Mesh(new T.BoxGeometry(0.034, 1, 0.028), new T.MeshPhongMaterial({ color: 0x0d0d0f, shininess: 40, specular: 0x333333 }));
    potence.castShadow = true;
    return { def, G, pedales, potence, tous: [G.cadre, G.pedalier, G.selle, G.cintre, G.socle, G.ext, pedales[0], pedales[1], potence] };
  }
  // roues détaillées (35, 45, 50 ou 65 mm), montables sur tous les vélos : rangées dans les groupes roueAv / roueAr qui tournent
  const rouesFaites = {};
  function construireRoues(rid) {
    if (rouesFaites[rid] !== undefined) return rouesFaites[rid];
    const R = fabriquerRoues(rid);
    if (R) { roueAv.add(R.av); roueAr.add(R.ar); }
    return (rouesFaites[rid] = R);
  }
  function fabriquerRoues(rid) {
    if (typeof VELOS === "undefined" || !VELOS.pieces.some((p) => p.roue === rid)) return null;
    const R = { av: new T.Group(), ar: new T.Group(), flancs: [] };
    for (const p of VELOS.pieces) {
      if (p.roue !== rid) continue;
      const b = BRILLANCE_V[p.m] || [30, 0x222222], mat = new T.MeshPhongMaterial({ color: new T.Color(p.k[0], p.k[1], p.k[2]), shininess: b[0], specular: b[1] });
      if (p.m === "flanc") R.flancs.push(mat);                        // flancs des pneus : couleur donnée par le vélo (beige pour le Madone)
      const m = new T.Mesh(geoVelo(p.geo), mat); m.castShadow = true;
      (p.g === "roueAv" ? R.av : R.ar).add(m);
    }
    R.av.visible = R.ar.visible = false; R.av.userData.detaille = R.ar.userData.detaille = true;
    return R;
  }
  // montre le vélo détaillé vd avec les roues R (ou le vélo simple si vd est nul)
  function montrerVelo(vd, R) {
    for (const k in velosFaits) { const x = velosFaits[k]; if (x && x !== vd) for (const o of x.tous) o.visible = false; }
    for (const k in rouesFaites) { const x = rouesFaites[k]; if (x && x !== R) x.av.visible = x.ar.visible = false; }
    if (vd && R) { R.av.visible = R.ar.visible = true; const f = vd.def.flanc || [0.06, 0.06, 0.06]; for (const m of R.flancs) m.color.setRGB(f[0], f[1], f[2]); }
    const v = corps.velo, simple = !vd;
    for (const o of v.segs) o.visible = simple;
    v.selle.visible = v.guidon.visible = simple;
    for (const [a, b] of v.drops) a.visible = b.visible = simple;
    for (const j of jambes) { if (j.manivelle) j.manivelle.visible = simple; if (j.pedale) j.pedale.visible = simple; }
    for (const rr of [roueAv, roueAr]) for (const c of rr.children) if (!c.userData.detaille) c.visible = simple || !R;
    if (vd) for (const o of vd.tous) o.visible = true;
    veloActif = vd;
  }
  // place le vélo détaillé sous le corps réglé r : cadre abaissé (s), selle dans l'axe du tube de selle, cintre sous les mains, potence entre les deux
  function placerVeloDetaille(vd, r) {
    if (vd.def.clm) { placerVeloClm(vd, r); return; }
    const s = Math.max(0.85, Math.min(1.05, (r.cintre[0] - 0.005 - BBY) / 0.58)), TS = 0.2962;   // TS : pente du tube de selle (73,5°)
    vd.G.cadre.scale.y = s;
    const hs = vd.def.hs || 0.775, scy = BBY + (hs - BBY) * s, scz = BBZ + (hs - BBY) * TS;
    const sy = r.selle[0], sz = scz + (sy - 0.036 - scy) * TS - 0.012;
    vd.G.selle.position.set(0, sy, sz);
    const cy = r.cintre[0] - 0.034, cz = r.cintre[1] + 0.032;                // cocottes dans le creux des mains (vérifié de profil et en vue action cam)
    vd.G.cintre.position.set(0, cy, cz); vd.G.cintre.scale.x = r.wx / 0.21;
    const axeZ = (y) => -0.45697 + (y - 0.32684) * 0.30573;                 // axe de direction du cadre détaillé (73°, déport 45 mm)
    const yT = BBY + (0.895 - BBY) * s, zT = axeZ(0.895);
    placerTube(vd.potence, 0, yT, zT, 0, cy + 0.006, cz + 0.072);
  }
  // vélo de chrono : cadre abaissé sous les manchettes, selle dans l'axe du tube de selle (78°), manchettes sous les coudes,
  // prolongateurs des mains jusqu'à l'avant des manchettes, potence du haut de la direction jusqu'à la base
  const HAUT_DIR_CLM = 0.815;
  function placerVeloClm(vd, r) {
    const py = r.coude[0], pz = r.coude[1];
    const s = Math.max(0.8, Math.min(1.05, (py - 0.115 - BBY) / (HAUT_DIR_CLM - BBY))), TS = vd.def.ts || 0.2126;
    vd.G.cadre.scale.y = s;
    const hs = vd.def.hs || 0.74, scy = BBY + (hs - BBY) * s, scz = BBZ + (hs - BBY) * TS;
    const sy = r.selle[0], sz = scz + (sy - 0.036 - scy) * TS - 0.012;
    vd.G.selle.position.set(0, sy, sz);
    vd.G.socle.position.set(0, py, pz);
    const hy = r.cintre[0], hz = r.cintre[1];
    vd.G.ext.position.set(0, hy, hz);
    const dy = (py - 0.04) - (hy - 0.038), dz = (pz - 0.05) - (hz + 0.01), lg = Math.hypot(dy, dz);
    vd.G.ext.rotation.x = Math.atan2(-dy, dz); vd.G.ext.scale.z = Math.max(0.4, (lg + 0.01) / 0.29);
    const axeZ = (y) => -0.45697 + (y - 0.32684) * 0.30573;
    const yT = BBY + (HAUT_DIR_CLM - BBY) * s, zT = axeZ(HAUT_DIR_CLM);
    placerTube(vd.potence, 0, yT, zT, 0, py - 0.105, pz - 0.022);
  }
  function poserVelo(r) {
    const v = corps.velo;
    if (!v) return;
    const id = r && apparence.velo && apparence.velo !== "simple" ? apparence.velo : "", vd = id ? construireVelo(id) : null;
    const rid = vd ? (apparence.roues || vd.def.roue) : "", R = rid ? construireRoues(rid) : null;
    const cle = (r ? r.cle : "") + "|" + (vd ? id : "") + "|" + rid;
    if (v.cle === cle) return;
    v.cle = cle;
    montrerVelo(vd, R);
    if (vd) { placerVeloDetaille(vd, r); return; }
    let segs = SEGS_VELO, selle = [0.96, 0.31], cintre = [0.97, -0.48];
    if (r) {
      const axe = (y) => -0.41 + (y - 0.90) * 0.1607;                          // axe de direction (tube de direction et fourche)
      const sy = r.selle[0] - 0.12, sz = BBZ + (sy - BBY) * 0.2867;            // collier de selle, sur le tube de selle (74°)
      const ty = r.cintre[0] + 0.005, by = ty - 0.11 * r.s, hy = ty - 0.035;   // haut et bas du tube de direction, arrivée du tube horizontal
      selle = [r.selle[0] - 0.02, r.selle[1]]; cintre = r.cintre;
      segs = [[BBZ, BBY, sz, sy, 0.026], [sz, sy - 0.015, axe(hy), hy, 0.026], [BBZ, BBY, axe(by), by, 0.034],
        [BBZ, BBY, 0.50, 0.34, 0.018], [sz, sy - 0.03, 0.50, 0.34, 0.016], [axe(ty), ty, -0.50, 0.34, 0.021],
        [axe(ty), ty, cintre[1], cintre[0], 0.022], [sz, sy, selle[1] - 0.01, selle[0] - 0.02, 0.016]];
    }
    segs.forEach((s, i) => placerTube(v.segs[i], 0, s[1], s[0], 0, s[3], s[2]));
    v.selle.position.set(0, selle[0], selle[1]);
    const lx = r ? r.wx : 0.21;                                             // demi-largeur du cintre (mains au-dessus)
    v.guidon.position.set(0, cintre[0], cintre[1]); v.guidon.scale.x = lx / 0.21;
    v.drops.forEach(([a, b], k) => {
      const x = (k ? 1 : -1) * lx;
      placerTube(a, x, cintre[0], cintre[1], x, cintre[0], cintre[1] - 0.08);
      placerTube(b, x, cintre[0], cintre[1] - 0.08, x, cintre[0] - 0.08, cintre[1] - 0.07);
    });
  }
  function majModele(bal, hy, hz, sx, sy, sz, tc) {
    const mo = corps.modele;
    if (corpsReel()) { majModeleH(bal, hy, hz, sx, sy, sz, tc); return; }
    poserVelo(null);
    try {
      if (mo.genre !== genre) {
        mo.genre = genre;
        const d = Modele.sets[genre];
        mo.geo.setIndex(new T.BufferAttribute(d.tri, 1));
        if (mo.geo.clearGroups) mo.geo.clearGroups();
        let off = 0;
        for (let r = 0; r < 7; r++) { const n = d.counts[r] * 3; if (r !== 4 && n && mo.geo.addGroup) mo.geo.addGroup(off, n, r); off += n; }   // les pieds du modèle restent cachés dans les chaussures
      }
      const ch = [], pit = [];
      for (let k = 0; k < 2; k++) {
        const sg = k ? 1 : -1, ang = angleMan + k * Math.PI;
        ch.push([sg * 0.15, BBY + R_MAN * Math.cos(ang) + CHEV_PED, BBZ - R_MAN * Math.sin(ang) + 0.075]);   // cheville au-dessus de la pédale (semelle sur la pédale)
        pit.push(-0.06 - 0.24 * Math.sin(ang - 0.1));
      }
      Modele.poser({ genre: genre, g: genre === "femme" ? 1.18 : 1.22, P2: [bal, hy + 0.06, hz], N2: [sx, sy + 0.035, sz - 0.025], pitch: pit, cheville: ch,
        poignet: [[-0.21, 0.985, -0.43], [0.21, 0.985, -0.43]], mainDir: [0, -0.25, -1],
        polesJambe: [[-0.16, 0.05, -1], [0.16, 0.05, -1]], polesBras: [[-0.7, -0.5, 0.15], [0.7, -0.5, 0.15]] }, mo.posA.array, mo.norA.array);
      mo.posA.needsUpdate = true; mo.norA.needsUpdate = true;
    } catch (e) { apparence.realiste = false; console.warn("corps réaliste désactivé", e); }
  }

  // nouveau corps (homme ou femme) : même pédalage que l'ancien modèle, à taille réelle (g = 1), tête posée sur le cou
  function majModeleH(bal, hy, hz, sx, sy, sz, tc) {
    const mo = corps.modeleH;
    const g = genre === "femme" && ModeleF ? "femme" : "homme", M = g === "femme" ? ModeleF : ModeleH;
    try {
      if (mo.genre !== g) {
        mo.genre = g; mo.geo.setAttribute("aBind", new T.BufferAttribute(M.sets[g].p, 3));
        const f = g === "femme", u = mo.matCorps.userData.u;
        u.uTexPeau.value = texC(f ? "peauF" : "peauH"); u.uTexOmbre.value = texC(f ? "ombreF" : "ombreH");
        mo.visage.mats[0].visible = mo.visage.mats[2].visible = !f; mo.visage.mats[1].visible = mo.visage.mats[3].visible = f;
      }
      const ch = [], pit = [];
      for (let k = 0; k < 2; k++) {
        const sg = k ? 1 : -1, ang = angleMan + k * Math.PI;
        ch.push([sg * 0.15, BBY + R_MAN * Math.cos(ang) + CHEV_PED, BBZ - R_MAN * Math.sin(ang) + 0.075]);   // cheville au-dessus de la pédale (semelle sur la pédale)
        pit.push(-0.06 - 0.24 * Math.sin(ang - 0.1));
      }
      // position réglée d'après les angles de l'étude posturale ; le balancement, l'effort et la danseuse s'y ajoutent
      const dv = defVelo(), clm = !!(dv && dv.clm);
      const rp = reglagePosition(g, M.sets[g].j, clm);
      // vélo de chrono en groupe : mains qui glissent des prolongateurs vers les cornes du guidon (malus calculé dans js/parcours-physique.js)
      const rel = clm && typeof Aero !== "undefined" ? Aero.reg.groupe || 0 : 0;
      let poignets = [[-rp.wx, rp.W2[0], rp.W2[1]], [rp.wx, rp.W2[0], rp.W2[1]]], mainD = clm ? [0, 0.4, -1] : [0, -0.25, -1], polesB = clm ? [[-0.3, -1, 0.25], [0.3, -1, 0.25]] : [[-0.7, -0.5, 0.15], [0.7, -0.5, 0.15]];
      if (rel > 0.01) {
        const cy = rp.coude[0] - 0.105, cz = rp.coude[1] - 0.15, k = rel;
        poignets = poignets.map((w, i) => [w[0] + ((i ? 0.2 : -0.2) - w[0]) * k, w[1] + (cy + 0.03 - w[1]) * k, w[2] + (cz + 0.05 - w[2]) * k]);
        mainD = [0, 0.4 - 0.75 * k, -1]; polesB = [[-0.3 - 0.4 * k, -1 + 0.5 * k, 0.25 - 0.1 * k], [0.3 + 0.4 * k, -1 + 0.5 * k, 0.25 - 0.1 * k]];
      }
      poserVelo(rp);
      corps.cam = [sx, rp.N2[0] + sy - 1.34 + 0.09, rp.N2[1] + sz + 0.18 + 0.09];      // caméra « action cam » : sur le torse, au pied du cou de ce corps
      // chrono : bassin plus basculé, mains jointes tournées l'une vers l'autre, coudes vers le bas (sur les manchettes), tête relevée pour voir la route
      const info = M.poser({ genre: g, g: 1.0, bassin: clm ? 0.45 : 0.25, P2: [bal, rp.P2[0] + hy - HY, rp.P2[1] + hz - HZ], N2: [sx, rp.N2[0] + sy - 1.34, rp.N2[1] + sz + 0.18], pitch: pit, cheville: ch,
        poignet: poignets, mainDir: mainD, teteDir: clm ? [0, 0.88, -0.48] : [0, 0.9, -0.43],
        paume: clm && rel < 0.5 ? [[0.92, -0.3, 0.2], [-0.92, -0.3, 0.2]] : [[0.35, -0.94, 0], [-0.35, -0.94, 0]],
        polesJambe: [[-0.16, 0.05, -1], [0.16, 0.05, -1]], polesBras: polesB }, mo.posA.array, mo.norA.array);
      mo.posA.needsUpdate = true; mo.norA.needsUpdate = true;
      // casque, lunettes et cheveux suivent la nouvelle tête : les lunettes se posent sur les yeux
      const t = info.tete;
      if (t) {
        const R = t.R, J = M.sets[g].j, ye = t.pos(J.Ey), ts = J.Ts || [1, 1];
        corps.camH = [ye[0], ye[1] + 0.012, ye[2] - 0.03];
        if (!_m4.m) _m4.m = new T.Matrix4();
        _m4.m.set(R[0], R[1], R[2], 0, R[3], R[4], R[5], 0, R[6], R[7], R[8], 0, 0, 0, 0, 1);
        corps.tete.quaternion.setFromRotationMatrix(_m4.m);
        corps.tete.scale.set(ts[0], ts[1], ts[0]);       // casque et lunettes à la taille de cette tête
        const o = [0, 0.005 * ts[1], -0.09 * ts[0]], ro = [R[0] * o[0] + R[1] * o[1] + R[2] * o[2], R[3] * o[0] + R[4] * o[1] + R[5] * o[2], R[6] * o[0] + R[7] * o[1] + R[8] * o[2]];
        corps.tete.position.set(ye[0] - ro[0], ye[1] - ro[1] + 0.01, ye[2] - ro[2]);
        const dx = corps.tete.position.x - tc[0], dy = corps.tete.position.y - tc[1], dz = corps.tete.position.z - tc[2];
        for (const ob of [corps.casque, corps.events[0], corps.events[1], corps.cheveux, corps.nuque, corps.chignon, corps.queue]) if (ob) { ob.position.x += dx; ob.position.y += dy; ob.position.z += dz; }
        // cheveux : calotte recentrée et ajustée à la taille de cette tête (en attendant les vraies coupes)
        const rot = (v) => [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]];
        const oc = rot([0, CHEV_H.y, CHEV_H.z]), tp = corps.tete.position;
        corps.cheveux.position.set(tp.x + oc[0], tp.y + oc[1], tp.z + oc[2]);
        corps.cheveux.quaternion.copy(corps.tete.quaternion);
        corps.cheveux.scale.set(CHEV_H.sx, CHEV_H.sy, CHEV_H.sz);
        // casque et lunettes : à la taille de cette tête, inclinés avec elle ; lunettes posées devant les yeux
        const place = (ob, v) => { const r = rot(v); ob.position.set(tp.x + r[0], tp.y + r[1], tp.z + r[2]); ob.quaternion.copy(corps.tete.quaternion); };
        place(corps.casque, [0, 0.032, 0.014]); corps.casque.scale.set(0.84, 0.92, 0.86);
        place(corps.events[0], [0, 0.097, -0.03]); place(corps.events[1], [0, 0.09, 0.048]);
        corps.lunettes.position.set(0, 0.006, -0.128); corps.lunettes.scale.set(0.74, 0.82, 1);
        // cheveux longs (mi-longs, queue de cheval, chignon) : construits une fois par corps, ils suivent la tête
        const co = apparence.coiffure;
        if (co === "mi-long" || co === "queue" || co === "chignon") {
          corps.chevL = corps.chevL || {};
          const cl = corps.chevL[g] || (corps.chevL[g] = construireCheveuxLongs(g));
          cl.grp.position.copy(corps.tete.position); cl.grp.quaternion.copy(corps.tete.quaternion); cl.grp.scale.copy(corps.tete.scale);
          const u = matMeches.userData.u;
          u.uBal.value.set(0.018 * Math.sin(angleMan - 0.7), 0.006 * Math.sin(2 * angleMan));   // balancement au rythme du pédalage
          u.uCasque.value = apparence.casque ? 1 : 0;
        }
      }
    } catch (e) { apparence.realiste = false; console.warn("corps réaliste désactivé", e); }
  }

  // s : 0 = assis, 1 = en danseuse ; effort : puissance / FTP lissée
  function animerCycliste(s, effort, dtemps) {
    roueAv.rotation.x = -angleRoue;
    roueAr.rotation.x = -angleRoue;
    const sinA = Math.sin(angleMan);
    // bassin : monte, avance et se balance d'un côté à l'autre en danseuse ; petit rebond en position assise
    const rebond = (1 - s) * 0.008 * Math.sin(2 * angleMan) + s * 0.025 * Math.abs(sinA);
    const hy = HY + 0.085 * s + rebond;
    const hz = HZ - 0.13 * s;
    const bal = (0.012 + 0.035 * s) * sinA;                  // balancement latéral du bassin
    // épaules : se penchent vers l'avant avec l'effort, balancier inverse du bassin
    const penche = 0.02 * Math.min(effort, 1.3) + 0.04 * s;
    const sx = -bal * 0.9 + 0.012 * s * sinA, sy = 1.34 + 0.09 * s + 0.004 * Math.sin(dtemps * 3.2), sz = -0.18 - penche;
    corps.cam = [sx, sy + 0.05, sz + 0.02];
    corps.bassin.position.set(bal, hy, hz);
    placerTube(corps.torse, bal, hy + 0.02, hz, sx, sy + 0.01, sz);
    corps.torse.scale.x = genre === "femme" ? 0.95 : 1.18; corps.torse.scale.z = genre === "femme" ? 0.8 : 0.9;
    corps.epaules.position.set(sx, sy, sz);
    corps.poitrine.position.set(sx * 0.7, sy - 0.07, sz + 0.12);
    placerTube(corps.cou, sx, sy + 0.03, sz - 0.02, sx, sy + 0.10, sz - 0.09);
    corps.collier.position.set(sx, sy + 0.05, sz - 0.04); corps.collier.rotation.set(Math.PI / 2 - 0.5, 0, 0); corps.collier.scale.set(1.0, 1.0, 1.0);
    const hx = sx * 0.4, hy2 = sy + 0.115, hz2 = sz - 0.14;
    corps.tete.position.set(hx, hy2, hz2); corps.tete.scale.set(1, 1, 1); corps.tete.rotation.x = 0.1 + 0.04 * Math.sin(dtemps * 0.7);
    corps.casque.position.set(hx, hy2 + 0.045, hz2 + 0.025);
    corps.casque.quaternion.set(0, 0, 0, 1); corps.casque.scale.set(1, 1, 1); corps.lunettes.position.set(0, 0.005, -0.09); corps.lunettes.scale.set(1, 1, 1);
    corps.events[0].position.set(hx, hy2 + 0.128, hz2 - 0.02);
    corps.events[1].position.set(hx, hy2 + 0.12, hz2 + 0.06);
    corps.cheveux.position.set(hx, hy2 + 0.04, hz2 + 0.03);
    corps.nuque.position.set(hx, hy2 - 0.045, hz2 + 0.085);
    if (apparence.coiffure === "queue") {       // queue de cheval qui se balance un peu
      const sw = 0.025 * Math.sin(angleMan * 0.5 + dtemps);
      corps.chignon.position.set(hx, hy2 + 0.03, hz2 + 0.14);
      placerTube(corps.queue, hx, hy2 + 0.03, hz2 + 0.14, hx + sw, hy2 - 0.13, hz2 + 0.25);
    } else corps.chignon.position.set(hx, hy2 + 0.075, hz2 + 0.135);
    // bras : épaule -> main fixée au cintre, coude plié vers l'extérieur
    for (let k = 0; k < 2; k++) {
      const sg = k ? 1 : -1, b = corps.bras[k];
      const ex = sx + sg * 0.19, ey = sy - 0.02, ez = sz;
      const mx = sg * 0.21, my = 0.97, mz = -0.49;
      const c = plier(ex, ey, ez, mx, my, mz, BRAS1, BRAS2, sg * 0.7, -0.5, 0.15);
      placerPiece(b.haut, ex, ey, ez, c[0], c[1], c[2], 0, 1);
      placerPiece(b.bas, c[0], c[1], c[2], mx, my, mz, 0, 0.93);
      placerPiece(b.manche, ex, ey, ez, c[0], c[1], c[2], 0, 0.42);
      placerPiece(b.bande, ex, ey, ez, c[0], c[1], c[2], 0.405, 0.435);
      b.coude.position.set(c[0], c[1], c[2]);
      b.delto.position.set(ex, ey, ez);
      b.main.position.set(mx, my, mz - 0.02);
    }
    if (apparence.realiste !== false && corps.modele) majModele(bal, hy, hz, sx, sy, sz, [hx, hy2, hz2]);
    // jambes
    for (let k = 0; k < 2; k++) {
      const j = jambes[k], sg = k ? 1 : -1;
      const ang = angleMan + k * Math.PI;
      const xp = sg * 0.15;
      const pz = BBZ - R_MAN * Math.sin(ang), py = BBY + R_MAN * Math.cos(ang);
      const hx = bal + sg * 0.09;
      // cheville : légèrement derrière et au-dessus de l'axe de la pédale ; pointe vers le bas à la descente, vers le haut au retour
      const pitch = -0.06 - 0.24 * Math.sin(ang - 0.1);
      const ax = xp, ay = py + 0.10, az = pz + 0.075;
      const c = plier(hx, hy, hz, ax, ay, az, LJ, LJ, sg * 0.16, 0.05, -1);
      const ge = genre === "femme" ? 1.08 : 1;
      placerPiece(j.cuisse, hx, hy, hz, c[0], c[1], c[2], 0, 0.74);
      placerPiece(j.cuisseP, hx, hy, hz, c[0], c[1], c[2], 0.72, 1);
      placerPiece(j.bandeCuisse, hx, hy, hz, c[0], c[1], c[2], 0.725, 0.755);
      j.cuisse.scale.x = j.cuisse.scale.z = j.cuisseP.scale.x = j.cuisseP.scale.z = ge;
      placerPiece(j.mollet, c[0], c[1], c[2], ax, ay, az, 0, 1);
      placerPiece(j.chaussette, c[0], c[1], c[2], ax, ay, az, 0.64, 1);
      j.genou.position.set(c[0], c[1], c[2]);
      placerTube(j.manivelle, sg * 0.08, BBY, BBZ, xp, py, pz);
      j.pedale.position.set(xp, py, pz);
      if (veloActif) { const pe = veloActif.pedales[k]; pe.position.set(sg * 0.147, py, pz); pe.rotation.x = pitch; veloActif.G.pedalier.rotation.x = -angleMan; }
      j.chaussure.position.set(xp, py + 0.05, pz - 0.04);
      j.chaussure.rotation.set(pitch, 0, 0);
    }
  }

  function visibiliteCorps(cacher) {
    const a = apparence, h = !cacher, c = a.casque;
    const reel = apparence.realiste !== false && !!corps.modele;
    for (const k of ["collier", "cou", "tete"]) corps[k].visible = h;
    for (const k of ["torse", "epaules", "poitrine", "bassin"]) corps[k].visible = h && !reel;
    const H = reel && corpsReel();
    if (corps.modele) corps.modele.mesh.visible = reel && !H;
    if (corps.modeleH) corps.modeleH.mesh.visible = H;
    for (const b of corps.bras) for (const k in b) b[k].visible = !reel;
    const longB = a.basStyle === "long";
    for (const j of jambes) {
      for (const k of ["cuisse", "cuisseP", "mollet", "genou"]) j[k].visible = !reel;
      j.chaussette.visible = !reel && !longB; j.bandeCuisse.visible = !reel && !longB;
      j.chaussure.visible = !H;                                    // corps réaliste : ses propres chaussures
    }
    corps.cheveux.visible = h && !c && a.coiffure !== "chauve";
    corps.casque.visible = h && c;
    corps.events[0].visible = corps.events[1].visible = h && c;
    corps.lunettes.visible = h && a.lunettes;
    corps.yeux[0].visible = corps.yeux[1].visible = true;
    corps.oreilles[0].visible = corps.oreilles[1].visible = h && (a.coiffure === "chauve" || a.coiffure === "queue" || a.coiffure === "chignon" || c || a.coiffure === "court");
    corps.chignon.visible = h && !c && (a.coiffure === "chignon" || a.coiffure === "queue");
    corps.nuque.visible = h && a.coiffure === "mi-long";
    corps.queue.visible = h && a.coiffure === "queue";
    if (H) {
      for (const c of corps.tete.children) if (c !== corps.lunettes) c.visible = false;
      corps.collier.visible = corps.cou.visible = false;
      corps.cheveux.visible = corps.nuque.visible = false;          // les cheveux sont dessinés sur le crâne du nouveau corps
    } else for (const c of corps.tete.children) if (c !== corps.lunettes && c !== corps.yeux[0] && c !== corps.yeux[1] && c !== corps.oreilles[0] && c !== corps.oreilles[1] && c !== corps.casqueH && c !== corps.lunettesH) c.visible = true;
    // nouveau corps : casque et lunettes dessinés pour sa tête (les anciens restent pour le modèle femme)
    if (corps.casqueH) { corps.casqueH.visible = H && h && c; corps.lunettesH.visible = H && h && a.lunettes; }
    if (H) { corps.casque.visible = false; corps.events[0].visible = corps.events[1].visible = false; corps.lunettes.visible = false; }
    // cheveux longs du nouveau corps (v64), à la place des anciennes boules
    const gR = genre === "femme" && ModeleF ? "femme" : "homme";
    if (corps.chevL) for (const k in corps.chevL) {
      const cl = corps.chevL[k];
      cl.grp.visible = H && h && k === gR;
      cl.mi.visible = a.coiffure === "mi-long"; cl.queue.visible = a.coiffure === "queue"; cl.chignon.visible = a.coiffure === "chignon" && !c;
    }
    if (H) corps.chignon.visible = corps.queue.visible = false;
  }
  // (v69 suite) couleur des yeux : l'iris de la texture (marron) est recoloré dans le shader ; les deux iris sont à des places fixes de l'image
  const IRIS = { noisette: 0x8a6a2a, vert: 0x4f7a3a, bleu: 0x3f6f9e, gris: 0x7d8790, noir: 0x2a1c14 };
  const uYeux = {};
  function matYeux() {
    const m = new T.MeshPhongMaterial({ map: texC("yeux", true), shininess: 90, specular: 0x555555 });
    uYeux.uIris = { value: new T.Color(0x3f6f9e) }; uYeux.uIrisOn = { value: 0 };
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uIris = uYeux.uIris; sh.uniforms.uIrisOn = uYeux.uIrisOn;
      sh.fragmentShader = "uniform vec3 uIris;\nuniform float uIrisOn;\n" + sh.fragmentShader.replace("#include <map_fragment>",
        "#include <map_fragment>\n" +
        "  if (uIrisOn > 0.5) {\n" +
        "    float r = min(distance(vUv, vec2(0.703, 0.703)), distance(vUv, vec2(0.293, 0.297)));\n" +
        "    float w = smoothstep(0.122, 0.104, r) * smoothstep(0.03, 0.045, r);\n" +
        "    float l = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));\n" +
        "    diffuseColor.rgb = mix(diffuseColor.rgb, uIris * clamp(l * 3.2, 0.25, 1.8), w);\n" +
        "  }");
    };
    m.customProgramCacheKey = () => "yeux1";
    return m;
  }
  function appliquerApparence() {
    if (!matPeau) return;
    matPeau.color.set(apparence.peau); matCheveux.color.set(apparence.cheveux); matBas.color.set(apparence.bas);
    const m = matMaillot.color, lum = 0.3 * m.r + 0.59 * m.g + 0.11 * m.b;
    matAccent.color.set(lum > 0.58 ? 0x2b2f3a : 0xffd8a8);
    const long = apparence.basStyle === "long";
    if (corps.modele) { corps.modele.mats[5] = long ? matBas : matPeau; corps.modele.mats[6] = long ? matBas : matBlanc; }
    if (corps.matCasqueH) corps.matCasqueH.color.set(apparence.casqueCouleur || 0xf2f4f6);
    matBlanc.color.set(apparence.chaussettes);                                   // (v69 suite) chaussettes de l'ancien modèle
    if (uYeux.uIris) { const y = IRIS[apparence.yeux]; uYeux.uIrisOn.value = y ? 1 : 0; if (y) uYeux.uIris.value.set(y); }
    if (corps.verresH && corps.verresH.type !== apparence.verres) {          // teinte des verres : dégradé du haut vers le bas
      const v = VERRES[apparence.verres] || VERRES.orange, a = new T.Color(v[0]), b = new T.Color(v[1]), c = new T.Color(), col = corps.verresH.geo.attributes.color, n = corps.verresH.nv;
      for (let i = 0; i < col.count; i++) { c.copy(a).lerp(b, (i % (n + 1)) / n); col.setXYZ(i, c.r, c.g, c.b); }
      col.needsUpdate = true; corps.verresH.type = apparence.verres;
    }
    if (corps.modeleH) {
      const u = corps.modeleH.matCorps.userData.u, cp = COUPES[apparence.coiffure] || COUPES.court;
      u.uLong.value = long ? 1 : 0;
      u.uChaussette.value = new T.Color(apparence.chaussettes);                  // (v69 suite) couleur des chaussettes choisie
      if (corps.modeleH.mats[13] && corps.modeleH.mats[13].userData.uChaus) corps.modeleH.mats[13].userData.uChaus.value.set(apparence.chaussettes);
      u.uEpCh.value = apparence.casque ? Math.min(cp.ep, 0.002) : cp.ep; u.uRecul.value = cp.recul; u.uNuque.value = cp.nuque; u.uRase.value = cp.rase || 0;
      u.uBarbe.value = BARBES[apparence.barbe] || 0;
      u.uSourcils.value.set(apparence.cheveux).multiplyScalar(genre === "femme" ? 0.85 : 0.75);
      u.uFinS.value = genre === "femme" ? 0.0006 : 0;                 // sourcils plus fins (et donc plus arqués) pour la femme
      u.uLevres.value.set(apparence.peau).lerp(new T.Color(genre === "femme" ? 0xb4505c : 0xa8504a), genre === "femme" ? 0.6 : 0.45);
      for (const k of [2, 3]) corps.modeleH.visage.mats[k].color.set(apparence.cheveux).multiplyScalar(1.15);   // sourcils de la couleur des cheveux
    }
    for (const j of jambes) { j.mollet.material = long ? matBas : matPeau; j.cuisseP.material = long ? matBas : matPeau; j.genou.material = long ? matBas : matPeau; j.chaussette.visible = !long; j.bandeCuisse.visible = !long; }
  }

  const VUES = {
    arriere: { back: 4.4, side: 0, up: 1.6, look: 9, lookUp: 1.15, ref: 0 },
    trois: { back: 2.4, side: 2.3, up: 1.2, look: 0.3, lookUp: 1.0, ref: 1 },
    face: { back: -5.2, side: 1.2, up: 1.35, look: 0, lookUp: 1.05, ref: 1 },
    large: { back: 9, side: 0, up: 3.6, look: 6, lookUp: 0.9, ref: 0 },
    action: { back: 0, side: 0, up: 0, look: 16, lookUp: 0, ref: 1, fov: 90, secousse: 1, torse: 1 },
    tv: { back: 4.4, side: 0, up: 1.6, look: 9, lookUp: 1.15, ref: 0 }      // (v69 suite) remplacé à chaque image par un plan de télévision (vueTele)
  };
  // (v69 suite) vue « Télévision » : la caméra change toute seule de plan toutes les 7 à 12 s, comme une retransmission
  // (moto devant, téléobjectif derrière, caméra fixe au bord de la route que tu dépasses, hélicoptère, travelling de côté)
  const PLANS_TV = {
    moto: { back: -8, side: 0.9, up: 1.7, fov: 40, lookUp: 1.0 },
    tele: { back: 18, side: 1.2, up: 2.4, fov: 26, lookUp: 1.0 },
    bord: { side: 5.5, up: 1.0, fov: 36, lookUp: 1.0 },
    helico: { back: 38, side: 24, up: 32, fov: 30, lookUp: 0.6 },
    cote: { back: 0.5, side: 4.2, up: 1.3, fov: 48, lookUp: 1.0 }
  };
  const ORDRE_TV = ["moto", "tele", "bord", "helico", "cote", "bord"];
  let tvI = -1, tvT = 0, tvDur = 0, tvFixe = 0, tvCote = 1;
  function vueTele(dt, d) {
    tvT += dt;
    const p = ORDRE_TV[tvI];
    if (tvI < 0 || tvT > tvDur || (p === "bord" && d > tvFixe + 20)) {
      tvI = (tvI + 1) % ORDRE_TV.length; tvT = 0; tvDur = 7 + Math.random() * 5; tvCote = Math.random() < 0.5 ? -1 : 1;
      if (ORDRE_TV[tvI] === "bord") tvFixe = d + 30 + Math.random() * 15;
    }
    const nom = ORDRE_TV[tvI], P = PLANS_TV[nom], o = Object.assign({ look: 0, ref: 0, tv: 1 }, P);
    o.side = P.side * (nom === "moto" || nom === "tele" ? 1 : tvCote);
    if (nom === "helico") { const a = tvT * 0.12; o.back = P.back * Math.cos(a); o.side = P.side * tvCote + P.back * Math.sin(a) * 0.6; }   // lent tour autour du coureur
    if (nom === "bord") o.fixe = tvFixe;
    return o;
  }
  let vue = "arriere";
  const LT = [0, 0, 0], INTRO_DUR = 4.2;
  let introT = INTRO_DUR;
  /* ---------- Poussière soulevée par la roue arrière ---------- */
  const N_POUSS = 56;
  const poussiere = [];
  let accPouss = 0, poussOn = true, poussIdx = 0;
  function texPuff() {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const x = c.getContext("2d");
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,0.9)"); g.addColorStop(0.5, "rgba(255,255,255,0.4)"); g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new T.CanvasTexture(c);
  }
  function creerPoussiere() {
    const map = texPuff();
    for (let i = 0; i < N_POUSS; i++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: map, transparent: true, depthWrite: false, opacity: 0, color: 0xd2c6a6 }));
      s.visible = false;
      scene.add(s);
      poussiere.push({ s: s, vie: 0, dur: 1, vx: 0, vy: 0, vz: 0, taille: 1 });
    }
  }
  function majPoussiere(dt, vit, effort, st, cx, cy, cz, cap0) {
    const actif = poussOn && qDens > 0.5 && vit > 2.5;
    if (actif) accPouss += (3 + 9 * Math.min(effort, 1.5) + 6 * st) * Math.min(1, vit / 8) * dt;
    else accPouss = 0;
    const fx = Math.sin(cap0), fz = -Math.cos(cap0);          // direction d'avance
    while (accPouss >= 1) {
      accPouss -= 1;
      const p = poussiere[poussIdx]; poussIdx = (poussIdx + 1) % N_POUSS;
      p.vie = 0; p.dur = 0.9 + hash(temps * 31.7 + poussIdx) * 0.9;
      p.s.position.set(cx - fx * 0.55 + (hash(temps * 7.1 + poussIdx) - 0.5) * 0.3, cy + 0.08, cz - fz * 0.55 + (hash(temps * 3.3 + poussIdx) - 0.5) * 0.3);
      p.vx = -fx * vit * 0.04 + (hash(temps * 5.9 + poussIdx) - 0.5) * 0.8;
      p.vz = -fz * vit * 0.04 + (hash(temps * 9.7 + poussIdx) - 0.5) * 0.8;
      p.vy = 0.25 + hash(temps * 2.9 + poussIdx) * 0.5;
      p.taille = 0.18 + hash(temps * 13.1 + poussIdx) * 0.18;
      p.s.material.color.set(th.poussiere);
      p.s.visible = true;
    }
    for (const p of poussiere) {
      if (!p.s.visible) continue;
      p.vie += dt;
      if (p.vie >= p.dur) { p.s.visible = false; p.s.material.opacity = 0; continue; }
      const k = p.vie / p.dur, fr = Math.exp(-dt * 1.6);
      p.vx *= fr; p.vz *= fr; p.vy *= fr;
      p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
      const e = p.taille + k * 1.1;
      p.s.scale.set(e, e, 1);
      p.s.material.opacity = 0.34 * Math.pow(1 - k, 1.6) * Math.min(1, k * 8);
    }
  }

  /* ---------- Placement du décor autour de la distance courante ---------- */
  function matrice(m, n, x, y, z, rotY, sx, sy, sz) {
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, rotY, 0);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    m.setMatrixAt(n, dummy.matrix);
  }

  let BLANC_NEIGE = null;
  function placerArbre(n, dist, u, echelle, alea, grand) {
    if (!BLANC_NEIGE) BLANC_NEIGE = new T.Color(0xf3f7fa);
    posChemin(dist, _q);
    const h = cap(dist), rel = relief(dist, u);
    let e = echelle > 0 && rel < th.limiteArbres && (!th.ligneArbres || alt3d(dist) + rel < th.ligneArbres) ? echelle : 0;
    if (e > 0 && horsZone(dist, u)) e = 0;
    if (e > 0 && th.ardennes) { const ru = ruisseau(dist); if ((ru !== null && Math.abs(u - ru) < 3.5) || (ville(dist) > 0.25 && Math.abs(u) < 45)) e = 0; }   // ni dans le ruisseau, ni entre les maisons
    if (e > 0 && th.mer) {
      if (u < 0 && -u > rivage(dist) - 4) e = 0;
      else if (ville(dist) > 0.25 && Math.abs(u) > 9.5) e = 0;
      else if (th.kona && ville(dist) < 0.2 && alea > 0.3) e = 0;          // Kona : presque pas d'arbres dans les champs de lave, des palmiers dans les villages
    }
    const peuplier = !th.conifere && !th.palmiers && grand < 0.12;
    const ex = e * (peuplier ? 0.62 : 0.9 + alea * 0.3), ey = e * (peuplier ? 1.8 : 0.85 + alea * 0.4);
    const X = _q[0] + Math.cos(h) * u, Y = alt3d(dist) + rel - 0.1, Z = _q[1] + Math.sin(h) * u;
    if (foretTheme) {                     // arbre Blender : enregistré, rangé ensuite par majForet (détail selon la distance)
      const r = foretTheme.recs[n] || (foretTheme.recs[n] = { c: new T.Color() });
      const v = especeTheme(alea, grand), pal = v === "palmier" || v === "dattier" || v === "cactus";
      r.v = v; r.x = X; r.y = Y; r.z = Z; r.r = alea * 6.283;
      r.sx = r.sz = e > 0 ? (pal ? e : v === "peuplier" ? e * (0.9 + alea * 0.2) : ex) : 0;
      r.sy = e > 0 ? (pal ? e * (0.85 + alea * 0.4) : v === "peuplier" ? e * (0.85 + alea * 0.3) : ey) : 0;
    } else if (th.palmiers) {
      matrice(troncs, n, X, Y, Z, alea * 6.283, e * 0.6, e * (1.6 + alea * 1.1), e * 0.6);
      matrice(feuillage, n, X, Y + 2.4 * e * (1.6 + alea * 1.1) - 0.2, Z, alea * 6.283, e * 1.1, e * 1.1, e * 1.1);
    } else if (th.cactus) {
      matrice(troncs, n, X, Y, Z, 0, 0, 0, 0);
      matrice(feuillage, n, X, Y, Z, alea * 6.283, ex, ey, ex);
    } else {
      matrice(troncs, n, X, Y, Z, alea * 6.283, ex, ey, ex);
      feuillage.setMatrixAt(n, dummy.matrix);
    }
    tmpC.copy(th.arbres[Math.floor(alea * th.arbres.length) % th.arbres.length]).offsetHSL(0, 0, (alea - 0.5) * 0.08);
    // ombre douce au pied (taille de la couronne)
    const ro = e > 0 ? (th.palmiers ? e * 3.4 : th.cactus ? e * 1.5 : ex * 3.5) : 0;
    matrice(ombres, n, X, Y + 0.12, Z, alea * 6.283, ro, 1, ro);
    // en haute montagne, les sapins sont saupoudrés de neige
    const A = alt3d(dist) + rel;
    if (th.conifere && A > 1650) tmpC.lerp(BLANC_NEIGE, Math.min(0.55, (A - 1650) / 600));
    if (foretTheme) foretTheme.recs[n].c.copy(tmpC);
    else feuillage.setColorAt(n, tmpC);
  }

  // densité des arbres : celle du thème, ou (Ardennes) forte en forêt et faible dans les clairières
  const densiteArbres = (d) => th.ardennes ? 0.22 + 1.3 * foretA(d) : th.toscane && ville(d) > 0.25 ? 0 : th.densite;
  function placerArbres(d) {
    let n = 0;
    const k0 = Math.floor((d - 70) / 8);
    for (let s = 0; s < 2; s++) for (let q = 0; q < 96; q++, n++) {
      const k = k0 + q;
      const h1 = hash(k * 2 + s + 11.3), h2 = hash(k * 7 + s * 3 + 5.1), h3 = hash(k * 13 + s + 2.7), h4 = hash(k * 19 + s * 7 + 0.5);
      const present = hash(k * 3.7 + s * 91) < densiteArbres(k * 8 + h2 * 6) * qDens;
      // Ardennes : arbres resserrés près de la route (mur de forêt), les autres comblent la bande suivante
      placerArbre(n, k * 8 + h2 * 6, (s ? 1 : -1) * (7.5 + h1 * h1 * (th.ardennes ? 16 : 34)), present ? 0.8 + h3 * 0.7 : 0, h3, h4);
    }
    const k1 = Math.floor((d - 70) / 15);
    for (let s = 0; s < 2; s++) for (let q = 0; q < 48; q++, n++) {
      const k = k1 + q;
      const h1 = hash(k * 4 + s + 71.3), h2 = hash(k * 5 + s * 3 + 9.1), h3 = hash(k * 17 + s + 6.7), h4 = hash(k * 23 + s * 5 + 1.5);
      const u = (s ? 1 : -1) * (th.ardennes ? 20 + h1 * 75 : 36 + h1 * 130);
      const present = hash(k * 5.9 + s * 37) < densiteArbres(k * 15 + h2 * 10) * qDens * 0.8;
      placerArbre(n, k * 15 + h2 * 10, u, present ? 1.3 + (Math.abs(u) - 36) / 60 + h3 * 0.6 : 0, h3, h4);
    }
    // (v69) arbres lointains : de 150 à 600 m de la route, sur 2 km devant, plus grands (vue lointaine)
    const k2 = Math.floor((d - 150) / 22);
    for (let s = 0; s < 2; s++) for (let q = 0; q < 90; q++, n++) {
      const k = k2 + q;
      const h1 = hash(k * 6 + s + 31.7), h2 = hash(k * 8 + s * 5 + 3.3), h3 = hash(k * 29 + s + 8.1), h4 = hash(k * 31 + s * 3 + 2.9);
      const u = (s ? 1 : -1) * (150 + h1 * 450);
      const present = hash(k * 7.3 + s * 53) < densiteArbres(k * 22 + h2 * 15) * qDens * 0.7;
      placerArbre(n, k * 22 + h2 * 15, u, present ? 1.6 + h3 * 0.8 : 0, h3, h4);
    }
    if (foretTheme) foretTheme.sale = true;
    else {
      troncs.instanceMatrix.needsUpdate = true;
      feuillage.instanceMatrix.needsUpdate = true;
      if (feuillage.instanceColor) feuillage.instanceColor.needsUpdate = true;
    }
    ombres.instanceMatrix.needsUpdate = true;
  }

  function placerBuissons(d) {
    const k0 = Math.floor((d - 70) / 11);
    let n = 0;
    for (let s = 0; s < 2; s++) for (let q = 0; q < 64; q++, n++) {
      const k = k0 + q;
      const h1 = hash(k * 3.1 + s * 17 + 0.3), h2 = hash(k * 8.7 + s + 4.4), h3 = hash(k * 2.3 + s * 5 + 9.9);
      const dist = k * 11 + h2 * 8, u = (s ? 1 : -1) * (6.6 + h1 * 6.5);
      posChemin(dist, _q);
      const h = cap(dist), rel = relief(dist, u);
      const present = hash(k * 6.1 + s * 29) < 0.75 * th.densite * qDens && rel < th.limiteArbres && !(th.mer && ville(dist) > 0.25) && !(th.mer && u < 0 && -u > rivage(dist) - 3) && !horsZone(dist, u);
      const e = present ? 0.7 + h3 * 0.8 : 0;
      matrice(buissons, n, _q[0] + Math.cos(h) * u, alt3d(dist) + rel - 0.1, _q[1] + Math.sin(h) * u, h3 * 6.283, e, e, e);
      tmpC.copy(th.arbres[Math.floor(h1 * th.arbres.length) % th.arbres.length]).lerp(th.c.clair, 0.25);
      buissons.setColorAt(n, tmpC);
    }
    buissons.instanceMatrix.needsUpdate = true;
    if (buissons.instanceColor) buissons.instanceColor.needsUpdate = true;
  }

  function placerRochers(d) {
    const k0 = Math.floor((d - 70) / 28);
    let n = 0;
    for (let s = 0; s < 2; s++) for (let q = 0; q < 28; q++, n++) {
      const k = k0 + q;
      const h1 = hash(k * 5.5 + s * 13 + 1.1), h2 = hash(k * 9.3 + s + 6.6), h3 = hash(k * 4.1 + s * 3 + 2.2);
      const dist = k * 28 + h2 * 20, u = (s ? 1 : -1) * (7 + h1 * h1 * 45);
      posChemin(dist, _q);
      const h = cap(dist), rel = relief(dist, u);
      const present = hash(k * 7.7 + s * 41) < th.rochers * (0.5 + qDens * 0.5) && !horsZone(dist, u);
      const e = present ? (0.6 + h3 * 1.6) * (th.conifere ? 1.8 : th.desert ? 1.5 : 1) : 0;
      matrice(rochers, n, _q[0] + Math.cos(h) * u, alt3d(dist) + rel + e * 0.1, _q[1] + Math.sin(h) * u, h2 * 6.283, e, e, e);
      tmpC.copy(th.c.roche).offsetHSL(0, 0, (h3 - 0.5) * 0.14);
      rochers.setColorAt(n, tmpC);
    }
    rochers.instanceMatrix.needsUpdate = true;
    if (rochers.instanceColor) rochers.instanceColor.needsUpdate = true;
  }

  function placerMaisons(d) {
    const k0 = Math.floor((d - 80) / 150);
    for (let q = 0; q < N_MAISONS; q++) {
      const k = k0 + q, h1 = hash(k * 5.3 + 1), h2 = hash(k * 9.1 + 2), h3 = hash(k * 3.3 + 3);
      const dist = k * 150 + h1 * 70, u = (h2 > 0.5 ? 1 : -1) * (22 + h3 * 45);
      posChemin(dist, _q);
      const h = cap(dist), rel = relief(dist, u);
      const e = rel < 40 && hash(k * 7.7 + 4) > 0.3 && !horsZone(dist, u) && !(th.desert && oasis(dist, u) > 0.1) && !(th.ardennes && (foretA(dist) > 0.35 || ville(dist) > 0.2)) ? 0.75 + h1 * 0.35 : 0;
      matrice(murs, q, _q[0] + Math.cos(h) * u, alt3d(dist) + rel - 0.15, _q[1] + Math.sin(h) * u, -h + (h3 - 0.5) * 0.6, e, e, e);
      toits.setMatrixAt(q, dummy.matrix);
    }
    murs.instanceMatrix.needsUpdate = true;
    toits.instanceMatrix.needsUpdate = true;
  }

  function placerPoteaux(d) {
    const k0 = Math.floor((d - 70) / 20);
    let n = 0;
    for (let s = 0; s < 2; s++) for (let q = 0; q < 36; q++, n++) {
      const dist = (k0 + q) * 20, u = (s ? 1 : -1) * 4.8;
      posChemin(dist, _q);
      const h = cap(dist);
      const ep = th.villeN ? 0 : 1;                      // pas de bornes en ville (barrières)
      matrice(poteaux, n, _q[0] + Math.cos(h) * u, alt3d(dist) - 0.2, _q[1] + Math.sin(h) * u, -h, ep, ep, ep);
    }
    poteaux.instanceMatrix.needsUpdate = true;
  }

  /* (v69) normales du terrain calculées directement sur la grille (coupes × colonnes) : bien plus rapide que computeVertexNormals */
  function normalesTerrain(nS, r0, r1) {
    const g = terrain.geometry, p = g.attributes.position.array;
    let na = g.attributes.normal;
    if (!na) { na = new T.BufferAttribute(new Float32Array(p.length), 3); g.setAttribute("normal", na); }
    const n = na.array;
    for (let i = r0 || 0; i < (r1 === undefined ? nS : r1); i++) for (let j = 0; j < NC; j++) {
      const i0 = i > 0 ? i - 1 : i, i1 = i < nS - 1 ? i + 1 : i, j0 = j > 0 ? j - 1 : j, j1 = j < NC - 1 ? j + 1 : j;
      const a = (i0 * NC + j) * 3, b = (i1 * NC + j) * 3, c = (i * NC + j0) * 3, d = (i * NC + j1) * 3;
      const ax = p[b] - p[a], ay = p[b + 1] - p[a + 1], az = p[b + 2] - p[a + 2];          // le long de la route
      const bx = p[d] - p[c], by = p[d + 1] - p[c + 1], bz = p[d + 2] - p[c + 2];          // en travers
      let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1, o = (i * NC + j) * 3;
      n[o] = nx / l; n[o + 1] = ny / l; n[o + 2] = nz / l;
    }
    na.needsUpdate = true;
  }

  /* ---------- Reconstruction du terrain et de la route ---------- */
  // (v69) etape : 1 = découpe des virages (zone), 2 puis 4 = terrain et route (deux moitiés), 3 = décor ; sans etape, tout d'un coup.
  // En roulant, les quatre étapes sont faites sur quatre images de suite pour ne jamais dépasser 1/60 s.
  function reconstruire(base, dCentre, etape) {
    // secteurs de chemin blanc de la route (aucun dans les mondes réels)
    { const z = (!GEO && route.secteurs) || []; rubU.uNS.value = Math.min(6, z.length); rubU.uLoop.value = route.boucle ? (LB || route.longueur) : 0; if (rubU.uSect) for (let i = 0; i < 6; i++) rubU.uSect.value[i].set(z[i] ? z[i][0] : -1, z[i] ? z[i][1] : -1, z[i] && z[i][3] === "pave" ? 1 : 0); }
    if (GEO) { if (!etape || etape === 1) { zone.actif = false; reconstruireRuban(base); placerDecorThemes(dCentre); } return; }
    const pT = terrain.geometry.attributes.position, cT = terrain.geometry.attributes.color, uT = terrain.geometry.attributes.uv, sT = terrain.geometry.attributes.aSol;
    const pR = ruban.geometry.attributes.position, uvR = ruban.geometry.attributes.uv, rA = terrain.geometry.attributes.aRue;
    const rueOff = Math.floor(dCentre / 2040) * 2040;   // décalage multiple des motifs du sol de la ville (0,2 ; 0,8 ; 17 ; 24 m…) : pas de saut quand il change
    const large = !!route.virages;                 // vrais virages : fenêtre élargie et coupes limitées (voir preparerZone)
    if (!etape || etape === 1) { if (large) preparerZone(base); else zone.actif = false; }
    if (etape === 1) return;
    const nS = large ? N_TOT : N_SEC;
    if (etape !== 3) {
    // étapes 2 et 4 : première puis seconde moitié des coupes (au raccord, l'ancienne et la nouvelle coupe sont à la même distance)
    const i0 = etape === 4 ? Math.ceil(nS / 2) : 0, i1 = etape === 2 ? Math.ceil(nS / 2) : nS;
    for (let i = i0; i < i1; i++) {
      let dist, h, y0;
      if (large) { dist = zone.dist[i]; _p[0] = zone.x[i]; _p[1] = zone.z[i]; h = zone.h[i]; y0 = zone.alt[i]; }
      else { dist = (base + i - DERRIERE) * PAS; posChemin(dist, _p); h = cap(dist); y0 = alt3d(dist); }
      const cx = Math.cos(h), sz = Math.sin(h);
      for (let j = 0; j < NC; j++) {
        let u = COLS[j], rel;
        if (large) { colonneZone(i, u, dist, y0); u = _zc[0]; rel = _zc[1]; } else rel = reliefBrut(dist, u);
        const a = Math.abs(u);
        const aff = a < 6 ? 0.12 + (a > 3.5 ? 0.1 * (a - 3.5) / 2.5 : 0) : Math.max(0, 0.22 - (a - 6) * 0.02);
        const idx = i * NC + j, o = idx * 3;
        const wx = _p[0] + cx * u, wz = _p[1] + sz * u;
        pT.array[o] = wx;
        pT.array[o + 1] = y0 + rel - aff;
        pT.array[o + 2] = wz;
        uT.array[idx * 2] = wx / 10; uT.array[idx * 2 + 1] = wz / 10;
        sT.array[idx] = 1 + a;
        rA.array[idx * 2] = dist - rueOff; rA.array[idx * 2 + 1] = u;
        couleurTerrain(dist, u, rel, tmpC);
        cT.array[o] = tmpC.r; cT.array[o + 1] = tmpC.g; cT.array[o + 2] = tmpC.b;
      }
      const r = i * 6;
      pR.array[r] = _p[0] - cx * DEMI; pR.array[r + 1] = y0 + 0.03; pR.array[r + 2] = _p[1] - sz * DEMI;
      pR.array[r + 3] = _p[0] + cx * DEMI; pR.array[r + 4] = y0 + 0.03; pR.array[r + 5] = _p[1] + sz * DEMI;
      uvR.array[i * 4] = 0; uvR.array[i * 4 + 1] = dist / 12;
      uvR.array[i * 4 + 2] = 1; uvR.array[i * 4 + 3] = dist / 12;
    }
    terrain.geometry.setDrawRange(0, (nS - 1) * (NC - 1) * 6);
    ruban.geometry.setDrawRange(0, (nS - 1) * 6);
    pT.needsUpdate = true; cT.needsUpdate = true; uT.needsUpdate = true; sT.needsUpdate = true; rA.needsUpdate = true; pR.needsUpdate = true; uvR.needsUpdate = true;
    normalesTerrain(nS, Math.max(0, i0 - 1), i1);
    ruban.geometry.computeVertexNormals();
    }
    if (etape === 2) return;
    placerArbres(dCentre);
    placerBuissons(dCentre);
    placerRochers(dCentre);
    placerMaisons(dCentre);
    placerPoteaux(dCentre);
    if (th.mer || th.villeN) placerVille(dCentre);
    placerDecorThemes(dCentre);
  }

  /* ---------- Thème et qualité ---------- */
  function melange(a, b, k) {        // mélange de deux couleurs 0xRRGGBB
    const ca = [(a >> 16) & 255, (a >> 8) & 255, a & 255], cb = [(b >> 16) & 255, (b >> 8) & 255, b & 255];
    const m = ca.map((v, i) => Math.round(v + (cb[i] - v) * k));
    return (m[0] << 16) | (m[1] << 8) | m[2];
  }
  function saisonner(d) {            // couleurs du thème selon la saison (l'été est le thème d'origine)
    if (saison === "ete" || d.desert || d.kona) return d;          // ni neige ni feuilles mortes dans le désert et sur l'île tropicale
    const o = Object.assign({}, d), mx = melange;
    if (saison === "printemps") {     // printemps : herbe tendre, arbres en fleurs (roses et blancs) parmi les verts frais
      for (const k of ["herbe1", "herbe2", "clair", "sol"]) o[k] = mx(d[k], 0x86d65a, 0.3);
      o.champ2 = mx(d.champ2, 0x9ee070, 0.4); o.champ = mx(d.champ, 0xb9d86a, 0.35);
      o.arbres = d.conifere ? d.arbres.map((h) => mx(h, 0x5fa86a, 0.2)) : d.palmiers || d.cactus ? d.arbres : [0x5cb84a, 0x6cc552, 0x4fa944, 0xf2b3c8, 0x76c95a, 0xf6f0f2, 0x62bd4e, 0xe9a0bc];
      o.cielHorizon = mx(d.cielHorizon, 0xf2f7fb, 0.3); o.brume = o.cielHorizon;
      return o;
    }
    if (saison === "automne") {
      for (const k of ["herbe1", "herbe2", "champ2", "clair"]) o[k] = mx(d[k], 0xb59a3c, 0.45);
      o.champ = mx(d.champ, 0xc98a3a, 0.4); o.sol = mx(d.sol, 0x9a8648, 0.4);
      o.arbres = d.conifere ? d.arbres.map((h) => mx(h, 0x4a6b2a, 0.25)) : d.palmiers || d.cactus ? d.arbres : [0xd9822b, 0xc0492b, 0xe0a82e, 0x9c6b2f, 0xb8501f];
      o.cielHaut = mx(d.cielHaut, 0x7d8fa8, 0.3); o.cielHorizon = mx(d.cielHorizon, 0xe7dccb, 0.45); o.brume = o.cielHorizon;
      o.soleil = 0xffd9a0; o.fogProche = d.fogProche * 0.8;
    } else {
      for (const k of ["herbe1", "herbe2", "champ", "champ2", "clair", "sol"]) o[k] = mx(d[k], 0xf1f5f9, 0.82);
      o.accotement = mx(d.accotement, 0xe9eef2, 0.6); o.roche = mx(d.roche, 0xdfe6ec, 0.35);
      o.arbres = d.conifere ? [0x2f5a45, 0x3b6b52, 0xcfe0e6, 0x4a7a62] : d.palmiers || d.cactus ? d.arbres : [0x8a7f78, 0x9a918a, 0x7b726b, 0xb4aca5];
      o.cielHaut = mx(d.cielHaut, 0x8c9aab, 0.5); o.cielHorizon = mx(d.cielHorizon, 0xe9eef2, 0.6); o.brume = o.cielHorizon;
      o.soleil = 0xf4f6ff; o.fogProche = d.fogProche * 0.6; o.fogLoin = d.fogLoin * 0.75;
    }
    return o;
  }
  /* flocons et feuilles qui tombent autour de la caméra */
  let fxS = null, fxType = "";
  const N_FX = 170;
  function majSaisonFx(dt, cam) {
    if (saison === "ete" || (th && (th.desert || th.kona))) { if (fxS) fxS.visible = false; return; }
    try {
      if (!fxS) {
        const g = new T.BufferGeometry(), pos = new Float32Array(N_FX * 3), col = new Float32Array(N_FX * 3);
        g.setAttribute("position", new T.BufferAttribute(pos, 3)); g.setAttribute("color", new T.BufferAttribute(col, 3));
        fxS = new T.Points(g, new T.PointsMaterial({ size: 0.2, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }));
        fxS.frustumCulled = false; fxS.etat = []; scene.add(fxS);
        for (let i = 0; i < N_FX; i++) fxS.etat.push({ ph: Math.random() * 6.28, vit: 0.6 + Math.random() * 0.8, init: false });
        fxType = "";
      }
      fxS.visible = true;
      const g = fxS.geometry, pos = g.attributes.position.array, col = g.attributes.color.array;
      if (fxType !== saison) {
        fxType = saison; fxS.material.size = saison === "hiver" ? 0.13 : saison === "printemps" ? 0.17 : 0.26;
        const feuilles = saison === "printemps" ? [0xf6c3d3, 0xffffff, 0xf2a7c0, 0xfbe3ea] : [0xd9822b, 0xc0492b, 0xe0a82e, 0x9c6b2f];   // printemps : pétales
        for (let i = 0; i < N_FX; i++) { const k = saison === "hiver" ? 0xffffff : feuilles[i % feuilles.length], c = [(k >> 16) & 255, (k >> 8) & 255, k & 255]; col[i * 3] = c[0] / 255; col[i * 3 + 1] = c[1] / 255; col[i * 3 + 2] = c[2] / 255; fxS.etat[i].init = false; }
        g.attributes.color.needsUpdate = true;
      }
      const chute = saison === "hiver" ? 1.1 : saison === "printemps" ? 0.55 : 0.9;
      for (let i = 0; i < N_FX; i++) {
        const e = fxS.etat[i], j = i * 3;
        if (!e.init || pos[j + 1] < cam.y - 2.5 || Math.abs(pos[j] - cam.x) > 32 || Math.abs(pos[j + 2] - cam.z) > 32) {
          pos[j] = cam.x + (Math.random() - 0.5) * 60; pos[j + 2] = cam.z + (Math.random() - 0.5) * 60;
          pos[j + 1] = cam.y + (e.init ? 6 + Math.random() * 3 : Math.random() * 9 - 2); e.init = true;
        }
        pos[j + 1] -= dt * chute * e.vit;
        pos[j] += Math.sin(temps * 0.9 + e.ph) * dt * (saison === "hiver" ? 0.35 : 0.9);
        pos[j + 2] += Math.cos(temps * 0.7 + e.ph) * dt * (saison === "hiver" ? 0.3 : 0.7);
      }
      g.attributes.position.needsUpdate = true;
    } catch (err) { saison = "ete"; if (fxS) fxS.visible = false; }
  }
  function appliquerTheme(nom) {
    const d = saisonner(THEMES[nom] || THEMES.campagne);
    themeNom = THEMES[nom] ? nom : "campagne";
    th = Object.assign({}, d);
    th.c = {};
    for (const k of ["herbe1", "herbe2", "champ", "champ2", "clair", "accotement", "roche", "neige"]) th.c[k] = new T.Color(d[k]);
    th.haut = new T.Color(d.cielHaut); th.horizon = new T.Color(d.cielHorizon);
    th.arbres = d.arbres.map((h) => new T.Color(h));
    scene.fog = new T.Fog(d.brume, d.fogProche * PORTEE, d.fogLoin * PORTEE);
    renderer.setClearColor(d.brume);
    hemi.color.set(0xdceeff); hemi.groundColor.set(d.sol);
    lumiere.color.set(d.soleil);
    colorerCiel();
    creerArbres();
    terrain.material = th.facettes ? matTerMontagne : matTerPlaine;
    { const tx = th.desert ? (texSableCache || (texSableCache = texSable())) : th.villeN ? null : tH0 || (tH0 = matTerPlaine.map); if (terrain.material.map !== tx) { terrain.material.map = terrain.material.bumpMap = tx; terrain.material.needsUpdate = true; } }
    solU.uTerre.value.setHex(th.desert ? 0xb08c5c : th.kona ? 0x2c2724 : th.conifere ? 0x6a5a48 : 0x6e5a44);
    solU.uSec.value = th.desert || th.kona || th.villeN ? 0 : saison === "hiver" ? 0.2 : th.toscane ? 0.4 : 1;
    solU.uVille.value = th.villeN && !GEO ? 1 : 0;
    solU.uTerreK.value = th.villeN ? 0 : saison === "hiver" ? 0.25 : th.desert ? 0.6 : 1;
    const styleFond = th.conifere ? "montagne" : th.desert ? "desert" : th.lanza ? "volcanR" : th.kona ? "volcan" : "";
    if (styleFond !== fondStyle) construireFond(styleFond);
    if (fond) fond.visible = !!styleFond && !GEO;
    for (const o of [villesM, toitsV]) if (o) o.visible = (!!th.mer || !!th.villeN) && !GEO;
    if (parasols) parasols.visible = !!th.mer && !GEO;
    if (villesM) {                                       // de nuit, les fenêtres s'allument (texture lumineuse, insensible à l'éclairage)
      const mv = villesM.material, nuit = !!th.nuit;
      if (nuit && !mv.emissiveMap) { mv.emissiveMap = texFacadeNuit(); mv.emissive.set(0xffffff); mv.needsUpdate = true; }
      else if (!nuit && mv.emissiveMap) { mv.emissiveMap = null; mv.emissive.set(0x000000); mv.needsUpdate = true; }
    }
    murs.material.color.set(d.mur);
    toits.material.color.set(d.toit);
    if (ruban.material.map) ruban.material.map.dispose();
    ruban.material.map = d.villeN ? texRouteVille() : texRoute(d.ligne);
    ruban.material.needsUpdate = true;
    derniereBase = null;
    if (GEO) reelAFaire = true;
    appliquerMoment();
  }

  function definirQualite(q) {
    qDens = { haute: 1, normale: 0.8, legere: 0.45 }[q] || 0.8;
    const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
    ratioQ = { haute: Math.min(dpr, 2), normale: 1, legere: 0.7 }[q] || 1;
    renderer.setPixelRatio(ratioQ);
    lumiere.castShadow = q !== "legere";
    const tm = q === "haute" ? 4096 : 2048, sh = lumiere.shadow;   // ombres plus fines (arbres, maisons)
    if (sh.mapSize.x !== tm) { sh.mapSize.set(tm, tm); if (sh.map) { sh.map.dispose(); sh.map = null; } }
    taille = [0, 0, 0];
    derniereBase = null;
    if (GEO) reelAFaire = true;
  }

  /* =====================================================================
     Supporters au bord de la route (avec pancartes) et météo dynamique
     ===================================================================== */
  const FOULE_MAX = 96, PANC_CAP = 16, ESPACE_FOULE = 42;
  const MESSAGES = ["ALLEZ !", "TU GÈRES !", "BRAVO !", "ON LÂCHE RIEN !", "COURAGE ♥", "GO GO GO !", "PLUS QUE 10 KM !", "ALLEZ ALLEZ ALLEZ !"];
  const FONDS_PANC = ["#ffffff", "#ffe066", "#ffb3d1", "#a5e1ff", "#c8f3b0", "#ffd0a0", "#ffffff", "#ffe066"];
  const PEAU = [0xf1c9a5, 0xe0ac82, 0xc68a62, 0x8d5a3b, 0x6b4328];
  const CHEMISES = [0xe84a4a, 0x3b82f6, 0xf5c518, 0x2fb36b, 0xffffff, 0xff8a3d, 0xb05cff, 0x2d3748, 0xff6fa5, 0x14b8a6];
  const JEANS = [0x2c3e5c, 0x3a3f4a, 0x5c4a3a, 0x1f2430, 0x6b7a8f, 0x7a8da6];
  let foule = null, fouleNiveau = 2, fouleCle = "", fouleListe = [];

  function partieCouleur(g, col) {
    const gg = g.index ? g.toNonIndexed() : g;
    const n = gg.attributes.position.count, c = new Float32Array(n * 3), k = new T.Color(col);
    for (let i = 0; i < n; i++) { c[i * 3] = k.r; c[i * 3 + 1] = k.g; c[i * 3 + 2] = k.b; }
    gg.setAttribute("color", new T.BufferAttribute(c, 3));
    return gg;
  }
  function fusionnerCouleur(parts) {
    let n = 0;
    for (const g of parts) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
    let o = 0;
    for (const g of parts) {
      pos.set(g.attributes.position.array, o * 3);
      nor.set(g.attributes.normal.array, o * 3);
      col.set(g.attributes.color.array, o * 3);
      o += g.attributes.position.count;
    }
    const out = new T.BufferGeometry();
    out.setAttribute("position", new T.BufferAttribute(pos, 3));
    out.setAttribute("normal", new T.BufferAttribute(nor, 3));
    out.setAttribute("color", new T.BufferAttribute(col, 3));
    return out;
  }
  function boite(w, h, p, x, y, z, rz, col) {
    const g = new T.BoxGeometry(w, h, p);
    if (rz) g.rotateZ(rz);
    g.translate(x, y, z);
    return partieCouleur(g, col);
  }
  function texPancarte(i) {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 256; c.height = 170;
    const x = c.getContext("2d");
    x.fillStyle = FONDS_PANC[i % FONDS_PANC.length]; x.fillRect(0, 0, 256, 170);
    x.strokeStyle = ["#e11d48", "#2563eb", "#16a34a", "#f97316"][i % 4]; x.lineWidth = 10; x.strokeRect(5, 5, 246, 160);
    x.fillStyle = "#1f2430"; x.textAlign = "center"; x.textBaseline = "middle";
    const mots = MESSAGES[i].split(" ");
    const lignes = mots.length > 2 ? [mots.slice(0, Math.ceil(mots.length / 2)).join(" "), mots.slice(Math.ceil(mots.length / 2)).join(" ")] : (MESSAGES[i].length > 8 ? mots : [MESSAGES[i]]);
    const taille = lignes.length === 1 ? 46 : 40;
    x.font = "900 " + taille + "px Arial, sans-serif";
    lignes.forEach((l, k) => {
      let t = taille;
      while (x.measureText && x.measureText(l).width > 220 && t > 14) { t -= 2; x.font = "900 " + t + "px Arial, sans-serif"; }
      x.fillText(l, 128, 85 + (k - (lignes.length - 1) / 2) * (taille + 4));
    });
    const t = new T.CanvasTexture(c);
    if (T.sRGBEncoding) t.encoding = T.sRGBEncoding;
    return t;
  }
  // (v73 suite) supporters plus réalistes, toujours low poly : corps en morceaux (bassin et cuisses, mollets nus avec un short, chaussures, torse,
  // tête avec nez et oreilles, cheveux courts ou longs, casquette, lunettes de soleil), bras articulés à l'épaule et au coude, sept attitudes
  // (ATT), plus animés quand le cycliste approche ; la tête et un peu le buste suivent le cycliste. Les pièces blanches prennent la couleur
  // de chaque supporter (instanceColor) ; les supporters à pancarte la tiennent à deux mains au-dessus de la tête.
  const CHEVEUX_F = [0x1e1611, 0x3b2a1e, 0x6b4a2b, 0xc89b5a, 0x9a4a24, 0x8a8a86];
  const CASQUETTES = [0xffffff, 0xf5c518, 0xe84a4a, 0x2d3748, 0x3b82f6, 0x2fb36b];
  const CHAUSSURES = [0xf2f2f2, 0x2a2d33, 0x6b4a2b, 0xe84a4a, 0x3b82f6];
  const DRAPEAUX = [[0x1f4fa8, 0xffffff, 0xe0303a], [0x1a1a1a, 0xf5d000, 0xe0303a], [0x1f8f4a, 0xffffff, 0xe0303a], "pois", [0xf7d417, 0xf7d417, 0xf7d417]];
  const DRAP_CAP = 10;
  const ATT = { calme: 0, applaudit: 1, enLair: 2, salue: 3, pancarte: 4, drapeau: 5, crie: 6 };
  const FOULE_PIECES = ["jambes", "mollets", "chaussures", "torse", "tete", "cheveuxC", "cheveuxL", "casquette", "lunettes", "bras", "avbras"];
  function creerFoule() {
    const W = 0xffffff;
    const B = (w, h, p, x, y, z, c) => boite(w, h, p, x, y, z, 0, c);
    const cyl = (r1, r2, y0, y1, x, z, c, n, sz) => { const g = new T.CylinderGeometry(r1, r2, y1 - y0, n || 7); if (sz) g.scale(1, 1, sz); g.translate(x, (y0 + y1) / 2, z); return partieCouleur(g, c); };
    const bou = (r, sx, sy, sz, x, y, z, c, det) => { const g = new T.IcosahedronGeometry(r, det === undefined ? 1 : det); g.scale(sx, sy, sz); g.translate(x, y, z); return partieCouleur(g, c); };
    // tête, cheveux, casquette et lunettes : repère du cou (0 ; 1,42 m) ; bras : repère de l'épaule ; avant-bras : repère du coude
    const geos = {
      jambes: fusionnerCouleur([cyl(0.075, 0.095, 0.46, 0.9, 0.1, 0, W), cyl(0.075, 0.095, 0.46, 0.9, -0.1, 0, W), cyl(0.17, 0.18, 0.84, 1.0, 0, 0, W, 8, 0.68)]),
      mollets: fusionnerCouleur([cyl(0.055, 0.075, 0.07, 0.48, 0.1, 0, W), cyl(0.055, 0.075, 0.07, 0.48, -0.1, 0, W)]),
      chaussures: fusionnerCouleur([B(0.11, 0.08, 0.27, 0.1, 0.04, 0.04, W), B(0.11, 0.08, 0.27, -0.1, 0.04, 0.04, W),
        B(0.116, 0.025, 0.28, 0.1, 0.012, 0.04, 0xcfcfcf), B(0.116, 0.025, 0.28, -0.1, 0.012, 0.04, 0xcfcfcf)]),
      torse: fusionnerCouleur([cyl(0.2, 0.165, 0.96, 1.4, 0, 0, W, 8, 0.62), bou(0.21, 1, 0.33, 0.62, 0, 1.39, 0, W)]),
      tete: fusionnerCouleur([cyl(0.05, 0.055, -0.02, 0.1, 0, 0, W, 6), bou(0.105, 0.92, 1.12, 1, 0, 0.19, 0.005, W), B(0.03, 0.05, 0.04, 0, 0.175, 0.105, W),
        bou(0.025, 0.5, 1, 0.8, 0.098, 0.18, 0, W, 0), bou(0.025, 0.5, 1, 0.8, -0.098, 0.18, 0, W, 0)]),
      cheveuxC: fusionnerCouleur([bou(0.113, 0.97, 0.8, 1.06, 0, 0.225, -0.012, W)]),
      cheveuxL: fusionnerCouleur([bou(0.115, 1, 0.82, 1.08, 0, 0.225, -0.015, W), B(0.2, 0.26, 0.07, 0, 0.1, -0.075, W),
        bou(0.06, 1, 2.2, 1, 0.09, 0.1, -0.02, W), bou(0.06, 1, 2.2, 1, -0.09, 0.1, -0.02, W)]),
      casquette: fusionnerCouleur([bou(0.118, 1, 0.62, 1.06, 0, 0.25, -0.01, W), B(0.17, 0.018, 0.12, 0, 0.255, 0.13, W)]),
      lunettes: fusionnerCouleur([B(0.075, 0.03, 0.02, 0.04, 0.205, 0.108, 0x15171c), B(0.075, 0.03, 0.02, -0.04, 0.205, 0.108, 0x15171c), B(0.2, 0.012, 0.012, 0, 0.215, 0.105, 0x2a2d33)]),
      bras: fusionnerCouleur([bou(0.072, 1, 1, 1, 0, -0.02, 0, W), cyl(0.055, 0.065, -0.3, 0, 0, 0, W, 7)]),
      avbras: fusionnerCouleur([cyl(0.04, 0.05, -0.26, 0.02, 0, 0, W, 6), B(0.075, 0.1, 0.04, 0, -0.36, 0, W)])
    };
    // drapeaux tenus à bout de bras (repère de la main) : hampe, puis tissu en trois lés un peu plissés
    const pan = (w, h, x, y, z, ry, c, ep) => { const g = new T.BoxGeometry(w, h, ep || 0.008); g.rotateY(ry); g.translate(x, y, z); return partieCouleur(g, c); };
    const drapeauG = (d) => {
      const p = [cyl(0.012, 0.012, -1.5, 0.08, 0, 0, 0xd8d8d8, 5)];
      for (let i = 0; i < 3; i++) {
        const cx = 0.13 + i * 0.25, cz = i % 2 ? 0.025 : -0.015, ry = i % 2 ? -0.25 : 0.25;
        p.push(pan(0.26, 0.45, cx, -1.25, cz, ry, d === "pois" ? 0xffffff : d[i]));
        if (d === "pois") for (const [dx, dy] of [[-0.06, -1.12], [0.06, -1.24], [-0.05, -1.38], [0.07, -1.06], [0.0, -1.3]])
          p.push(pan(0.05, 0.05, cx + dx * Math.cos(ry), dy, cz - dx * Math.sin(ry), ry, 0xe0303a, 0.02));
      }
      return fusionnerCouleur(p);
    };
    const mat = () => new T.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
    foule = {
      panc: MESSAGES.map((m, i) => {
        const map = texPancarte(i);
        const pg = new T.PlaneGeometry(0.95, 0.63);
        return new T.InstancedMesh(pg, new T.MeshLambertMaterial(map ? { map: map, side: T.DoubleSide } : { color: 0xffe066, side: T.DoubleSide }), PANC_CAP);
      }),
      drap: DRAPEAUX.map((d) => new T.InstancedMesh(drapeauG(d), mat(), DRAP_CAP)),
      m: { B: new T.Matrix4(), H: new T.Matrix4(), S: new T.Matrix4(), E: new T.Matrix4(), X: new T.Matrix4(), Y: new T.Matrix4(), eu: new T.Euler(), q: new T.Quaternion(), v: new T.Vector3(), s: new T.Vector3() }
    };
    for (const k of FOULE_PIECES) foule[k] = new T.InstancedMesh(geos[k], mat(), k === "bras" || k === "avbras" ? FOULE_MAX * 2 : FOULE_MAX);
    foule.tous = FOULE_PIECES.map((k) => foule[k]).concat(foule.panc, foule.drap);
    for (const m of foule.tous) { m.frustumCulled = false; m.count = 0; scene.add(m); }
    for (const k of ["jambes", "torse", "tete", "cheveuxC", "cheveuxL", "casquette", "bras", "avbras"]) foule[k].castShadow = true;
    for (const m of foule.drap) m.castShadow = true;
  }
  function hauteurBord(d, u) {
    const a = Math.abs(u), y0 = alt3d(d);
    if (GEO) return y0;
    const rel = relief(d, u);
    const aff = a < 6 ? 0.12 + (a > 3.5 ? 0.1 * (a - 3.5) / 2.5 : 0) : Math.max(0, 0.22 - (a - 6) * 0.02);
    return y0 + rel - aff;
  }
  function batirFoule(k0, k1) {
    fouleListe = [];
    const seuil = th && th.villeN ? (fouleNiveau >= 2 ? 0.97 : 0.7) : fouleNiveau >= 2 ? 0.78 : 0.4;   // critérium : public tout le long du circuit
    for (let k = k0; k <= k1 && fouleListe.length < FOULE_MAX; k++) {
      const seed = k * 7.31 + 11;
      const D = k * ESPACE_FOULE + hash(seed + 5) * ESPACE_FOULE * 0.6;
      if (D < 10 || (LB === 0 && D > route.longueur + 25)) continue;
      const grand = (((D % 1000) + 1000) % 1000) < ESPACE_FOULE;
      if (!grand && hash(seed) > seuil) continue;
      let n = grand ? 8 + Math.floor(hash(seed + 2) * 5) : 1 + Math.floor(hash(seed + 2) * 3.6);
      if (fouleNiveau < 2) n = Math.max(1, Math.ceil(n / 2));
      const cote = hash(seed + 1) < 0.35 ? -1 : hash(seed + 1) < 0.75 ? 1 : 0;
      let signes = grand ? 3 : (hash(seed + 3) < 0.7 ? 1 : 0);
      for (let j = 0; j < n && fouleListe.length < FOULE_MAX; j++) {
        const r = (c) => hash(seed * 13.7 + j * 3.1 + c);
        const sj = cote !== 0 ? cote : (j % 2 ? 1 : -1);
        const dd = D + (r(1) - 0.5) * (grand ? 16 : 7);
        const u = sj * ((GEO ? 4.2 : th.villeN ? 4.75 : 4.9) + r(2) * (GEO ? 0.8 : th.villeN ? 1.4 : 2.2));
        posChemin(dd, _q);
        const h = cap(dd);
        const dx = -sj * Math.cos(h), dz = -sj * Math.sin(h);
        let panc = -1;
        if (signes > 0 && r(3) > 0.25) { panc = Math.floor(r(4) * MESSAGES.length) % MESSAGES.length; signes--; }
        const a = r(15);
        let att = panc >= 0 ? ATT.pancarte : r(13) < 0.12 ? ATT.drapeau
          : a < 0.24 ? ATT.calme : a < 0.5 ? ATT.applaudit : a < 0.66 ? ATT.enLair : a < 0.8 ? ATT.salue : ATT.crie;
        const enfant = r(7) < 0.08, femme = r(16) < 0.4;
        fouleListe.push({
          x: _q[0] + Math.cos(h) * u, y: hauteurBord(dd, u) - 0.02, z: _q[1] + Math.sin(h) * u, d: dd,
          rot: Math.atan2(dx, dz) + (r(5) - 0.5) * 0.7, sc: (femme ? 0.86 : 0.92) + r(6) * 0.16 - (enfant ? 0.28 : 0), lar: 0.92 + r(17) * 0.2,
          ph: r(8) * 6.28, amp: 0.5 + r(9) * 0.9, panc: panc, att: att, drap: att === ATT.drapeau ? Math.floor(r(14) * DRAPEAUX.length) % DRAPEAUX.length : -1,
          cc: CHEMISES[Math.floor(r(10) * CHEMISES.length) % CHEMISES.length],
          cp: PEAU[Math.floor(r(11) * PEAU.length) % PEAU.length],
          cj: JEANS[Math.floor(r(12) * JEANS.length) % JEANS.length],
          short: r(18) < 0.45, chaus: CHAUSSURES[Math.floor(r(19) * CHAUSSURES.length) % CHAUSSURES.length],
          ch: r(20) < (femme ? 0.75 : 0.06) ? "L" : r(21) < 0.12 && !enfant ? "" : "C",                 // cheveux longs, courts ou crâne nu
          cch: r(22) < 0.12 ? 0x8a8a86 : CHEVEUX_F[Math.floor(r(23) * 5) % 5],
          casq: r(24) < 0.3 ? CASQUETTES[Math.floor(r(25) * CASQUETTES.length) % CASQUETTES.length] : -1, lun: r(26) < 0.3
        });
      }
    }
    // places dans les pièces partagées par une partie des supporters, et couleurs (fixes tant que la liste ne change pas)
    const n = { C: 0, L: 0, casq: 0, lun: 0, panc: new Array(MESSAGES.length).fill(0), drap: new Array(DRAPEAUX.length).fill(0) };
    fouleListe.forEach((p, i) => {
      if (p.panc >= 0) { if (n.panc[p.panc] < PANC_CAP) p.iP = n.panc[p.panc]++; else { p.panc = -1; p.att = ATT.applaudit; } }
      if (p.drap >= 0) { if (n.drap[p.drap] < DRAP_CAP) p.iD = n.drap[p.drap]++; else { p.drap = -1; p.att = ATT.enLair; } }
      p.iCh = p.ch ? n[p.ch]++ : -1;
      p.iCasq = p.casq >= 0 ? n.casq++ : -1;
      p.iLun = p.lun ? n.lun++ : -1;
      foule.torse.setColorAt(i, tmpC.set(p.cc));
      foule.bras.setColorAt(2 * i, tmpC); foule.bras.setColorAt(2 * i + 1, tmpC);
      foule.tete.setColorAt(i, tmpC.set(p.cp));
      foule.avbras.setColorAt(2 * i, tmpC); foule.avbras.setColorAt(2 * i + 1, tmpC);
      foule.mollets.setColorAt(i, p.short ? tmpC : tmpC.set(p.cj));
      foule.jambes.setColorAt(i, tmpC.set(p.cj));
      foule.chaussures.setColorAt(i, tmpC.set(p.chaus));
      if (p.iCh >= 0) foule[p.ch === "L" ? "cheveuxL" : "cheveuxC"].setColorAt(p.iCh, tmpC.set(p.cch));
      if (p.iCasq >= 0) foule.casquette.setColorAt(p.iCasq, tmpC.set(p.casq));
    });
    const nP = fouleListe.length;
    for (const k of ["jambes", "mollets", "chaussures", "torse", "tete"]) foule[k].count = nP;
    foule.bras.count = foule.avbras.count = nP * 2;
    foule.cheveuxC.count = n.C; foule.cheveuxL.count = n.L; foule.casquette.count = n.casq; foule.lunettes.count = n.lun;
    foule.panc.forEach((m, i) => { m.count = n.panc[i]; });
    foule.drap.forEach((m, i) => { m.count = n.drap[i]; });
    for (const m of foule.tous) if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }
  // angles d'un bras [épaule avant/arrière, épaule de côté (vers l'extérieur), coude avant, coude de côté] selon l'attitude ;
  // sg = 1 bras droit (x > 0), -1 bras gauche ; e = excitation (0,35 au loin, 1 quand le cycliste passe)
  function brasFoule(att, sg, t, ph, e) {
    const calme = [0.05 + 0.04 * Math.sin(t * 1.1 + ph + sg), 0.12, -0.25, 0];
    switch (att) {
      case ATT.applaudit: { const c = 0.5 + 0.5 * Math.sin(t * 17 + ph); return [-0.75, -0.04 - 0.2 * c * e, -1.15, -0.12 * c]; }
      case ATT.enLair: return [-0.15, 1.1 + 1.45 * e + 0.25 * e * Math.sin(t * 5.2 + ph + sg), -0.2, 0];
      case ATT.salue: return sg > 0 ? [-0.2, 2.35, -0.3, 0.6 * Math.sin(t * 7 + ph) * (0.4 + 0.6 * e)] : calme;
      case ATT.pancarte: return [-2.75 + 0.08 * e * Math.sin(t * 5.2 + ph), -0.12, -0.3, 0];
      case ATT.drapeau: return sg > 0 ? [0, 2.35 + 0.3 * e * Math.sin(t * 3 + ph), -0.1, 0] : calme;
      case ATT.crie: return [-0.6, -0.6, -2.3, 0];
      default: return calme;
    }
  }
  function majFoule(d) {
    if (!foule) return;
    if (fouleNiveau <= 0) {
      if (foule.torse.count) { for (const m of foule.tous) m.count = 0; }
      fouleCle = "";
      return;
    }
    const k0 = Math.floor((d - 25) / ESPACE_FOULE), k1 = Math.floor((d + 340) / ESPACE_FOULE);
    const cle = k0 + "|" + fouleNiveau + "|" + (GEO ? "g" : "n") + "|" + (route ? route.longueur + route.nom : "");
    if (cle !== fouleCle) { fouleCle = cle; batirFoule(k0, k1); }
    const M = foule.m, t = temps;
    posChemin(d, _q);
    const cx = _q[0], cz = _q[1];
    // repère local (position, rotations) multiplié par le repère parent
    const loc = (out, parent, x, y, z, rx, ry, rz, ordre) => { out.makeRotationFromEuler(M.eu.set(rx, ry, rz, ordre || "XYZ")); out.setPosition(x, y, z); return out.premultiply(parent); };
    for (let i = 0; i < fouleListe.length; i++) {
      const p = fouleListe[i];
      const proche = Math.min(1, Math.max(0, 1 - (Math.abs(p.d - d - 8) - 12) / 45)), e = 0.35 + 0.65 * proche;
      const att = p.att === ATT.calme && proche > 0.75 ? ATT.applaudit : p.att;           // les plus calmes applaudissent quand le cycliste passe
      const saute = att === ATT.enLair || att === ATT.pancarte || att === ATT.drapeau;
      const saut = saute ? Math.abs(Math.sin(t * 5.2 + p.ph)) * 0.13 * p.amp * e * e : 0;
      const incl = Math.sin(t * 1.3 + p.ph) * 0.03 + (saute ? Math.sin(t * 2.6 + p.ph) * 0.06 * e : 0);
      // regard vers le cycliste : la tête tourne, le buste suit un peu
      let dy = Math.atan2(cx - p.x, cz - p.z) - p.rot;
      dy = ((dy % 6.2832) + 9.4248) % 6.2832 - 3.1416;
      dy = Math.max(-1.3, Math.min(1.3, dy));
      M.q.setFromEuler(M.eu.set(0, p.rot + 0.3 * dy, incl, "YXZ"));
      M.B.compose(M.v.set(p.x, p.y + saut, p.z), M.q, M.s.set(p.sc * p.lar, p.sc, p.sc * p.lar));
      for (const k of ["jambes", "mollets", "chaussures", "torse"]) foule[k].setMatrixAt(i, M.B);
      loc(M.H, M.B, 0, 1.42, 0, att === ATT.crie ? -0.25 : saute ? -0.15 * e : 0.05, Math.max(-1, Math.min(1, 0.7 * dy)), 0, "YXZ");
      foule.tete.setMatrixAt(i, M.H);
      if (p.iCh >= 0) foule[p.ch === "L" ? "cheveuxL" : "cheveuxC"].setMatrixAt(p.iCh, M.H);
      if (p.iCasq >= 0) foule.casquette.setMatrixAt(p.iCasq, M.H);
      if (p.iLun >= 0) foule.lunettes.setMatrixAt(p.iLun, M.H);
      for (const sg of [1, -1]) {
        const a = brasFoule(att, sg, t, p.ph, e), j = 2 * i + (sg > 0 ? 0 : 1);
        loc(M.S, M.B, sg * 0.215, 1.37, 0, a[0], 0, sg * a[1]);
        foule.bras.setMatrixAt(j, M.S);
        loc(M.E, M.S, 0, -0.29, 0, a[2], 0, sg * a[3]);
        foule.avbras.setMatrixAt(j, M.E);
        if (sg > 0 && p.drap >= 0) {          // drapeau : hampe dans la main, presque droite, qui se balance avec le bras ; le tissu flotte autour de la hampe
          M.v.set(0, -0.36, 0).applyMatrix4(M.E);
          M.X.makeRotationY(0.6 * Math.sin(t * 6 + p.ph)).premultiply(M.Y.makeRotationX(Math.PI)).premultiply(M.Y.makeRotationZ(-0.25 + 0.35 * e * Math.sin(t * 3 + p.ph)));
          foule.drap[p.drap].setMatrixAt(p.iD, M.X.premultiply(M.B).setPosition(M.v));
        }
      }
      if (p.panc >= 0) foule.panc[p.panc].setMatrixAt(p.iP, loc(M.X, M.B, 0, 2.27 + 0.03 * e * Math.sin(t * 5.2 + p.ph), 0.26, 0, 0, 0));
    }
    for (const m of foule.tous) m.instanceMatrix.needsUpdate = true;
  }


  /* ---------- Piétons : ils marchent sur les trottoirs des mondes urbains (réels et bord de mer) ---------- */
  const PIETONS_MAX = 32;
  let pietons = null, pietonsNiveau = 1, pietonsListe = [];
  function creerPietons() {
    const corpsG = fusionnerCouleur([
      (() => { const g = new T.CylinderGeometry(0.19, 0.22, 0.6, 10); g.scale(1, 1, 0.62); g.translate(0, 1.14, 0); return partieCouleur(g, 0xffffff); })(),
      boite(0.08, 0.55, 0.08, 0.27, 1.12, 0, 0, 0xffffff), boite(0.08, 0.55, 0.08, -0.27, 1.12, 0, 0, 0xffffff)
    ]);
    const teteG = fusionnerCouleur([
      (() => { const g = new T.SphereGeometry(0.12, 10, 8); g.translate(0, 1.6, 0); return partieCouleur(g, 0xffffff); })(),
      (() => { const g = new T.SphereGeometry(0.13, 10, 6); g.scale(1, 0.62, 1.05); g.translate(0, 1.67, -0.015); return partieCouleur(g, 0x3b2a1e); })()
    ]);
    const jambeG = boite(0.14, 0.86, 0.16, 0, -0.43, 0, 0, 0xffffff);
    const mat = (o) => new T.MeshLambertMaterial(o);
    pietons = {
      corps: new T.InstancedMesh(corpsG, mat({ color: 0xffffff, vertexColors: true }), PIETONS_MAX),
      tete: new T.InstancedMesh(teteG, mat({ color: 0xffffff, vertexColors: true }), PIETONS_MAX),
      jg: new T.InstancedMesh(jambeG, mat({ color: 0xffffff, vertexColors: true }), PIETONS_MAX),
      jd: new T.InstancedMesh(jambeG, mat({ color: 0xffffff, vertexColors: true }), PIETONS_MAX)
    };
    for (const m of [pietons.corps, pietons.tete, pietons.jg, pietons.jd]) { m.frustumCulled = false; m.count = 0; scene.add(m); }
    pietons.corps.castShadow = true; pietons.tete.castShadow = true;
  }
  function placerPieton(p, d, premier) {
    for (let essai = 0; essai < 8; essai++) {
      const dd = premier ? d - 25 + Math.random() * 320 : d + 40 + Math.random() * 260;
      if (!GEO && ville(dd) < 0.6) continue;
      const sgn = Math.random() < 0.5 ? -1 : 1;
      p.d = dd; p.v = (Math.random() < 0.5 ? -1 : 1) * (1.0 + Math.random() * 0.55);
      p.u = sgn * ((GEO ? 4.2 : 4.9) + Math.random() * (GEO ? 0.8 : 1.6));
      p.sc = 0.9 + Math.random() * 0.2; p.ph = Math.random() * 6.28; p.on = true;
      p.cc = CHEMISES[(Math.random() * CHEMISES.length) | 0]; p.cp = PEAU[(Math.random() * PEAU.length) | 0]; p.cj = JEANS[(Math.random() * JEANS.length) | 0];
      p.neuf = true;
      return;
    }
    p.on = false; p.d = d + 1e6;
  }
  function majPietons(d, dt) {
    if (!pietons) creerPietons();
    const n = (GEO || (th && th.mer)) ? [0, 12, 28][pietonsNiveau] || 0 : 0;
    if (!n) { if (pietons.corps.count) for (const m of [pietons.corps, pietons.tete, pietons.jg, pietons.jd]) m.count = 0; return; }
    while (pietonsListe.length < n) { const p = {}; placerPieton(p, d, true); pietonsListe.push(p); }
    pietonsListe.length = n;
    const rep = [];
    let k = 0;
    const ord = dummy.rotation.order;
    for (const p of pietonsListe) {
      if (!p.on || p.d < d - 40 || p.d > d + 330 || Math.abs(p.d - d) > 1e5) { placerPieton(p, d, false); if (!p.on) continue; }
      p.d += p.v * dt;
      const s = p.v < 0 ? -1 : 1;
      posChemin(p.d, _q);
      const h = cap(p.d), px = _q[0] + Math.cos(h) * p.u, pz = _q[1] + Math.sin(h) * p.u, y = hauteurBord(p.d, p.u) - 0.02;
      const rot = Math.atan2(Math.sin(h) * s, Math.cos(h) * s);
      const phase = p.ph + temps * 5.4 * Math.abs(p.v) / 1.3, sw = Math.sin(phase) * 0.55, bob = Math.abs(Math.sin(phase)) * 0.03, cr = Math.cos(rot), sr = Math.sin(rot);
      dummy.rotation.order = "XYZ"; dummy.position.set(px, y + bob, pz); dummy.rotation.set(0, rot, 0); dummy.scale.set(p.sc, p.sc, p.sc); dummy.updateMatrix();
      pietons.corps.setMatrixAt(k, dummy.matrix); pietons.tete.setMatrixAt(k, dummy.matrix);
      dummy.rotation.order = "YXZ";
      for (const [m, sg, sn] of [[pietons.jg, -1, sw], [pietons.jd, 1, -sw]]) {
        dummy.position.set(px + cr * 0.1 * p.sc * sg, y + 0.86 * p.sc + bob, pz - sr * 0.1 * p.sc * sg);
        dummy.rotation.set(sn, rot, 0); dummy.updateMatrix(); m.setMatrixAt(k, dummy.matrix);
      }
      pietons.corps.setColorAt(k, tmpC.set(p.cc)); pietons.tete.setColorAt(k, tmpC.set(p.cp));
      pietons.jg.setColorAt(k, tmpC.set(p.cj)); pietons.jd.setColorAt(k, tmpC.set(p.cj));
      pietons.colDirty = true;
      k++;
    }
    dummy.rotation.order = ord;
    // les couleurs suivent l'indice : on les réécrit si la liste a bougé
    for (const m of [pietons.corps, pietons.tete, pietons.jg, pietons.jd]) { m.count = k; m.instanceMatrix.needsUpdate = true; if (pietons.colDirty && m.instanceColor) m.instanceColor.needsUpdate = true; }
    pietons.colDirty = false;
  }

  /* ---------- Bord de mer : rivage, villes, plage ---------- */
  // (v69) ville() et rivage() ne dépendent que de la distance : la dernière valeur est gardée (même coupe de terrain)
  let vilD = NaN, vilR = null, vilV = 0, rivD = NaN, rivR = null, rivT = null, rivV = 0;
  function ville(d) {
    if (d === vilD && route === vilR) return vilV;
    vilD = d; vilR = route; vilV = villeCalc(d);
    return vilV;
  }
  function villeCalc(d) {
    const z = route.villes;
    if (!z) return 0;
    d = dl(d);
    let v = 0;
    for (const q of z) { const t = lisse01((d - q[0]) / 120) * lisse01((q[1] - d) / 120); if (t > v) v = t; }
    return v;
  }
  function rivage(d) {      // distance de la mer (côté gauche) à l'axe de la route
    if (d === rivD && route === rivR && th === rivT) return rivV;
    rivD = d; rivR = route; rivT = th; rivV = rivageCalc(d);
    return rivV;
  }
  function rivageCalc(d) {
    const base = 24 + 40 * (0.5 + 0.5 * Math.sin(d * F(1 / 1700) + 1)) + 30 * Math.max(0, Math.sin(d * F(1 / 560) + 2));
    const vl = ville(d), prom = 32 + 12 * Math.sin(d * F(1 / 260));
    if (th && th.kona) {    // Kona : l'océan est plus loin, au bout des coulées de lave (il revient près de la route dans les villages)
      const loin = 70 + 150 * (0.5 + 0.5 * Math.sin(d * F(1 / 2600) + 0.4)) + 60 * Math.max(0, Math.sin(d * F(1 / 900) + 1.3));
      return Math.min(300, Math.max(30, loin + (prom + 8 - loin) * vl * 0.85));
    }
    return Math.min(120, Math.max(16, base + (prom - base) * vl * 0.8));
  }
  function reliefMer(d, u) {
    const sh = rivage(d);
    if (u < 0) {
      const ex = -u - sh;
      if (ex > 0) {
        const p = lisse01(ex / 9);
        return -0.15 - 1.5 * p + p * (0.3 * Math.sin(d * F(0.12) + u * 0.15) + 0.22 * Math.sin(d * F(0.05) - u * 0.1 + 1));
      }
    }
    const a = Math.abs(u);
    if (a <= 6) return 0;
    if (th.kona) {          // champs de lave : petites bosses chaotiques, et la pente du volcan qui monte vers l'intérieur des terres
      const bosses = 1.4 * Math.min(1, (a - 6) / 18) * (Math.abs(Math.sin(d * F(0.031) + u * 0.047)) + 0.6 * Math.abs(Math.sin(d * F(0.083) - u * 0.11 + 2)) - 0.7);
      const pente = u > 0 ? 70 * lisse01((u - 40) / 380) * (0.7 + 0.3 * Math.sin(d * F(0.0017) + 1)) : 0;
      const versMer = u < 0 ? lisse01((sh - 25 + u) / 30) : 1;
      return (bosses * versMer + pente) * (1 - 0.8 * ville(d)) + 0.1 * Math.sin(d * F(0.09) + u * 0.2);
    }
    const interieur = u > 0 ? 1 : lisse01((sh - 22 + u) / 40);
    const dune = 2.2 * lisse01((a - 10) / 120) * (0.5 + 0.5 * Math.sin(d * F(0.011) + u * 0.04)) * interieur * (1 - 0.9 * ville(d));
    // corniche : des collines boisées s’élèvent derrière la route (moins derrière les villes)
    const colline = route.virages && u > 0 ? 52 * lisse01((u - 45) / 230) * (0.55 + 0.45 * Math.sin(d * F(0.0021) + 0.7) * Math.sin(d * F(0.0057) + u * 0.004 + 2)) * (1 - 0.55 * ville(d)) : 0;
    return dune + colline + 0.12 * Math.sin(d * F(0.09) + u * 0.2) * Math.min(1, (a - 6) / 20);
  }
  let cMer = null;
  function couleurMer(d, u, n1, n2, out) {
    if (!cMer) cMer = { eau: new T.Color(0x5fd0dc), prof: new T.Color(0x2a78c8), ecume: new T.Color(0xeaf8fb), sable: new T.Color(0xf0e0aa), pave: new T.Color(0xcdc6b6) };
    const c = th.c, a = Math.abs(u), sh = rivage(d), vl = ville(d);
    if (u < 0 && -u > sh - 1) {
      const ex = -u - sh;
      out.copy(cMer.eau).lerp(cMer.prof, lisse01(ex / 90));
      if (ex < 10) out.lerp(cMer.ecume, (1 - ex / 10) * 0.5);
      out.lerp(th.horizon, lisse01((-u - 150) / 270) * 0.85);
      return;
    }
    const plage = u < 0 ? lisse01((-u - (sh - 20)) / 8) : 0;
    if (th.kona) {          // lave noire, coulées plus anciennes brunes, touffes d'herbe dorée en nappes, sable clair au bord de l'eau
      const ch = Math.sin(d * F(0.013) + u * 0.031) * Math.sin(d * F(0.0071) - u * 0.019 + 2.0);
      if (a > 7) out.lerp(c.champ, lisse01((ch + 0.15) * 2.2) * 0.75 * Math.min(1, (a - 7) / 6));
      const coulee = Math.sin(d * F(0.0042) + u * 0.009 + 1.1);
      if (coulee > 0.55) out.lerp(c.clair, Math.min(0.6, (coulee - 0.55) * 2.5));
      out.lerp(cMer.pave, vl * 0.8 * (1 - plage));
      out.lerp(cMer.sable, plage);
      out.lerp(th.horizon, lisse01((a - 220) / 300) * 0.75);
      return;
    }
    if (a > 14 && vl < 0.5) { const ch = Math.sin(d * F(0.013) + u * 0.031) * Math.sin(d * F(0.0071) - u * 0.019 + 2.0); if (ch > 0.25) out.lerp(c.champ, Math.min(0.6, (ch - 0.25) * 2)); }
    out.lerp(cMer.pave, vl * 0.85 * (1 - plage));
    out.lerp(cMer.sable, plage);
    out.lerp(th.horizon, lisse01((a - 170) / 250) * 0.8);
  }
  const PALETTE_MURS = [0xf7e7c6, 0xf4c9a8, 0xfbd5d5, 0xe8f1f5, 0xf9f3d0, 0xd9ecd0, 0xf2e0f0, 0xffffff, 0xf8d9a0];
  const PALETTE_TOITS = [0xc4553d, 0xb5483a, 0x9c4a3a, 0x5b7c99, 0xd0663f];
  const N_VILLE = 230, N_PARASOL = 56;
  let villesM = null, toitsV = null, parasols = null;
  function texFacade() {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d");
    x.fillStyle = "#ffffff"; x.fillRect(0, 0, 128, 128);
    for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) {
      const wx = 17 + k * 38, wy = 10 + r * 52;
      x.fillStyle = "#e6e9ee"; x.fillRect(wx - 3, wy - 3, 30, 38);
      x.fillStyle = "#4b6580"; x.fillRect(wx, wy, 24, 32);
      x.fillStyle = "#cfe3f5"; x.fillRect(wx + 2, wy + 2, 20, 13);
      x.fillStyle = "#6f9bb8"; x.fillRect(wx - 8, wy, 5, 32); x.fillRect(wx + 27, wy, 5, 32);
    }
    x.fillStyle = "#d7d3cb"; x.fillRect(0, 120, 128, 8);
    const t = new T.CanvasTexture(c);
    if (T.sRGBEncoding) t.encoding = T.sRGBEncoding;
    return t;
  }
  // façade de nuit : seulement les fenêtres allumées (jaune chaud, quelques-unes éteintes ou bleutées), le reste noir
  function texFacadeNuit() {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d");
    x.fillStyle = "#000000"; x.fillRect(0, 0, 128, 128);
    for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) {
      const wx = 17 + k * 38, wy = 10 + r * 52, h = Math.random();
      if (h < 0.3) continue;
      x.fillStyle = h < 0.45 ? "#5d7fae" : h < 0.75 ? "#ffc76b" : "#ffe3a6";
      x.fillRect(wx, wy, 24, 32);
    }
    const t = new T.CanvasTexture(c);
    if (T.sRGBEncoding) t.encoding = T.sRGBEncoding;
    return t;
  }
  function creerVilles() {
    const b = new T.BoxGeometry(1, 1, 1); b.translate(0, 0.5, 0);
    const r = new T.ConeGeometry(0.72, 1, 4); r.rotateY(Math.PI / 4); r.translate(0, 0.5, 0);
    villesM = new T.InstancedMesh(b, new T.MeshLambertMaterial(texFacade() ? { color: 0xffffff, map: texFacade() } : { color: 0xffffff }), N_VILLE);
    toitsV = new T.InstancedMesh(r, new T.MeshLambertMaterial({ color: 0xffffff }), N_VILLE);
    const poteau = new T.CylinderGeometry(0.05, 0.05, 2.4, 5); poteau.translate(0, 1.2, 0);
    const toile = new T.ConeGeometry(1.25, 0.55, 8); toile.translate(0, 2.65, 0);
    parasols = new T.InstancedMesh(fusionnerCouleur([partieCouleur(poteau, 0xf2f2f2), partieCouleur(toile, 0xffffff)]), new T.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }), N_PARASOL);
    for (const o of [villesM, toitsV, parasols]) {
      o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true; o.visible = false; scene.add(o);
      for (let q = 0; q < o.count; q++) matrice(o, q, 0, -9999, 0, 0, 0, 0, 0);     // exemplaires jamais placés : cachés (sinon un bloc noir au départ)
    }
  }
  function placerVille(d) {
    if (!villesM) return;
    const k0 = Math.floor((d - 60) / 17);
    let n = 0;
    for (let s = 0; s < 2; s++) for (let rang = 0; rang < 2; rang++) for (let q = 0; q < 52; q++, n++) {
      const k = k0 + q, sd = s * 7 + rang * 3;
      const h1 = hash(k * 3.7 + sd + 1.3), h2 = hash(k * 5.9 + sd + 2.1), h3 = hash(k * 8.3 + sd + 3.9), h4 = hash(k * 2.9 + sd + 7.7);
      const dist = k * 17 + h2 * 5, side = s ? 1 : -1, u = side * ((rang ? 27 : 11.5) + h1 * 3);
      let e = ville(dist) > 0.5 + 0.3 * rang ? 1 : 0;
      if (e && th.mer && side < 0 && -u > rivage(dist) - 14) e = 0;
      if (e && (h4 < 0.12 || horsZone(dist, u))) e = 0;
      posChemin(dist, _q);
      const hh = cap(dist), rel = relief(dist, u);
      const lg = 10 + h3 * 3.5, pf = 9 + h1 * 4, ht = ((rang ? 7 : 6.4) + Math.floor(h4 * 4) * 3.2) * (th.villeN ? 1.9 : 1);   // centre-ville : immeubles plus hauts
      const gx = _q[0] + Math.cos(hh) * u, gz = _q[1] + Math.sin(hh) * u, gy = alt3d(dist) + rel - 0.1;
      matrice(villesM, n, gx, gy, gz, -hh, e * pf, e * ht, e * lg);
      villesM.setColorAt(n, tmpC.set(PALETTE_MURS[Math.floor(h3 * 97) % PALETTE_MURS.length]).multiplyScalar(th.nuit ? 0.45 : 1));   // façades plus sombres la nuit
      const plat = h2 > 0.82;
      matrice(toitsV, n, gx, gy + ht, gz, -hh, e * pf * 1.06, e * (plat ? 0.4 : 2.2 + h1 * 1.2), e * lg * 1.06);
      toitsV.setColorAt(n, tmpC.set(plat ? 0xb9b4aa : PALETTE_TOITS[Math.floor(h1 * 89) % PALETTE_TOITS.length]));
    }
    villesM.instanceMatrix.needsUpdate = true; toitsV.instanceMatrix.needsUpdate = true;
    if (villesM.instanceColor) villesM.instanceColor.needsUpdate = true;
    if (toitsV.instanceColor) toitsV.instanceColor.needsUpdate = true;
    const k1 = Math.floor((d - 60) / 9);
    for (let q = 0; q < N_PARASOL; q++) {
      const k = k1 + q, h1 = hash(k * 4.7 + 3.3), h2 = hash(k * 6.1 + 1.1), h3 = hash(k * 2.2 + 8.8);
      const dist = k * 9 + h2 * 6, sh = rivage(dist), u = -(sh - 4 - h1 * 10);
      const e = th.mer && h3 < 0.22 + 0.5 * ville(dist) && sh < 80 && !horsZone(dist, u) ? 0.9 + h1 * 0.3 : 0;
      posChemin(dist, _q);
      const hh = cap(dist);
      matrice(parasols, q, _q[0] + Math.cos(hh) * u, alt3d(dist) + relief(dist, u) - 0.05, _q[1] + Math.sin(hh) * u, h2 * 6.28, e, e, e);
      parasols.setColorAt(q, tmpC.set([0xe84a4a, 0x3b82f6, 0xf5c518, 0xffffff, 0xff8a3d, 0x14b8a6][Math.floor(h1 * 61) % 6]));
    }
    parasols.instanceMatrix.needsUpdate = true;
    if (parasols.instanceColor) parasols.instanceColor.needsUpdate = true;
  }
  const geoPalme = () => {
    const parts = [];
    for (let k = 0; k < 7; k++) {
      const g = new T.IcosahedronGeometry(1, 0);
      g.scale(1.7, 0.1, 0.42); g.translate(1.5, 0, 0); g.rotateZ(-0.38); g.rotateY(k * 0.8976 + 0.2);
      parts.push(g);
    }
    parts.push(new T.IcosahedronGeometry(0.35, 0));
    return ajouterDegrade(fusionner(parts), 0.7, 1.1);
  };
  const geoCactus = () => {
    const cyl = (r, h, x, y, rz) => { const g = new T.CylinderGeometry(r, r, h, 7); if (rz) g.rotateZ(rz); g.translate(x, y, 0); return g; };
    const haut = new T.SphereGeometry(0.28, 7, 4); haut.scale(1, 0.6, 1); haut.translate(0, 2.6, 0);
    return ajouterDegrade(fusionner([cyl(0.3, 2.6, 0, 1.3, 0), haut, cyl(0.16, 0.8, 0.55, 1.3, Math.PI / 2), cyl(0.16, 0.9, 0.92, 1.75, 0),
      cyl(0.15, 0.7, -0.5, 1.7, Math.PI / 2), cyl(0.15, 0.8, -0.82, 2.1, 0)]), 0.75, 1.05);
  };

  /* =====================================================================
     Décor des mondes fabriqués (montagne, désert, bord de mer) : familles d'objets
     placées le long de la route autour du cycliste, comme les arbres. Chaque famille a une forme
     (pièces colorées fusionnées), un espacement « pas » (m), un nombre d'exemplaires et une règle
     qui dit, pour l'emplacement k, où poser l'objet ({ d, u, e, rot, … }) ou s'il n'y en a pas (null).
     ===================================================================== */
  const P3 = {
    boite: (w, h, p, x, y, z, c) => { const g = new T.BoxGeometry(w, h, p); g.translate(x, y + h / 2, z); return partieCouleur(g, c); },
    cyl: (r1, r2, h, n, x, y, z, c) => { const g = new T.CylinderGeometry(r1, r2, h, n); g.translate(x, y + h / 2, z); return partieCouleur(g, c); },
    cone: (r, h, n, x, y, z, c, rotY) => { const g = new T.ConeGeometry(r, h, n); if (rotY) g.rotateY(rotY); g.translate(x, y + h / 2, z); return partieCouleur(g, c); },
    boule: (r, sx, sy, sz, x, y, z, c, det) => { const g = new T.IcosahedronGeometry(r, det || 0); g.scale(sx, sy, sz); g.translate(x, y, z); return partieCouleur(g, c); },
    // toit à deux pans : prisme (largeur w selon x, hauteur h, longueur l selon z), posé à la hauteur y
    prisme: (w, h, l, x, y, z, c) => {
      const a = [x - w / 2, y, z - l / 2], b = [x + w / 2, y, z - l / 2], t = [x, y + h, z - l / 2];
      const a2 = [a[0], y, z + l / 2], b2 = [b[0], y, z + l / 2], t2 = [x, y + h, z + l / 2];
      const tris = [a, t, b, b2, t2, a2, a, a2, t2, a, t2, t, b, t, t2, b, t2, b2];
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.BufferAttribute(new Float32Array(tris.flat()), 3));
      g.computeVertexNormals();
      return partieCouleur(g, c);
    }
  };
  const BLANC = 0xffffff;
  const familles = [];
  const courbure = (d) => cap(d + 4) - cap(d - 4);       // virage (radians sur 8 m) : > 0 à droite
  function definirFamilles() {
    const { boite, cyl, cone, boule, prisme } = P3;
    const H = (k, s) => hash(k * 12.9898 + s * 78.233);
    const B = decorOk() && !!geoDecor("herbe");          // formes fabriquées dans Blender disponibles
    const D = (nom, repli) => (B && geoDecor(nom) ? () => geoDecor(nom) : repli);
    // ----- montagne -----
    familles.push({ theme: "montagne", pas: 4, n: 175, geo: () => fusionnerCouleur([      // glissières de sécurité (extérieur des virages, côté du vide)
      boite(0.06, 0.32, 4.05, 0, 0.42, 0, 0xc9ced3), boite(0.1, 0.78, 0.1, 0.1, 0, 0, 0x8a9096)]),
      regle: (k) => {
        const d = k * 4 + 2, kc = courbure(d);
        let s = 0;
        if (Math.abs(kc) > 0.055) s = kc > 0 ? -1 : 1;
        else if (relief(d, 13) < -2.5) s = 1; else if (relief(d, -13) < -2.5) s = -1;
        return s ? { d, u: s * (DEMI + 1.15) } : null;
      } });
    familles.push({ theme: "montagne", pas: 26, n: 34, cotes: 2, geo: () => fusionnerCouleur([   // jalons à neige
      cyl(0.045, 0.05, 1.7, 5, 0, 0, 0, 0xf07c1e), cyl(0.046, 0.046, 0.45, 5, 0, 1.7, 0, 0x1d1f24)]),
      regle: (k, s) => alt3d(k * 26) > 1300 && Math.abs(courbure(k * 26)) < 0.05 ? { d: k * 26, u: s * 5.7 } : null });
    familles.push({ theme: "montagne", pas: 85, n: 12, geo: D("chalet", () => fusionnerCouleur([           // chalets
      boite(7, 1.3, 9, 0, 0, 0, 0xd8d3c6), boite(7, 3.2, 9, 0, 1.3, 0, 0x8b5a36), prisme(8.8, 2.8, 10.6, 0, 4.5, 0, 0x4a3426),
      boite(1.0, 0.12, 9.4, 3.95, 2.9, 0, 0x6b4127), boite(0.1, 0.9, 9.4, 4.4, 3.0, 0, 0x6b4127),
      boite(0.12, 1.1, 1.0, 3.52, 1.6, -2.2, 0x2a3442), boite(0.12, 1.1, 1.0, 3.52, 1.6, 2.2, 0x2a3442), boite(0.12, 1.1, 1.0, 3.52, 3.3, 0, 0x2a3442),
      boite(0.8, 1.6, 0.8, -1.6, 6.0, 2.5, 0x9a9488)])),
      regle: (k) => {
        if (H(k, 1) > 0.6) return null;
        const d = k * 85 + H(k, 2) * 40, s = H(k, 3) < 0.5 ? -1 : 1, u = s * (24 + H(k, 4) * 55);
        if (alt3d(d) > 1950 || relief(d, u) > 28) return null;
        return { d, u, e: 0.85 + 0.35 * H(k, 5), rot: (s > 0 ? Math.PI : 0) + (H(k, 6) - 0.5) * 0.5 };
      } });
    const paturage = (d) => Math.sin(d * 0.0021 + 1.3) + 0.6 * Math.sin(d * 0.0067) > 0.1 && alt3d(d) < 1950;
    familles.push({ theme: "montagne", pas: 28, n: 28, geo: () => fusionnerCouleur([            // vaches
      boite(0.85, 0.75, 1.7, 0, 0.62, 0, BLANC), boite(0.88, 0.5, 0.6, 0, 0.8, 0.25, 0x1e1c1b), boite(0.5, 0.5, 0.55, 0, 1.0, -1.05, BLANC),
      boite(0.52, 0.2, 0.2, 0, 1.15, -1.2, 0x1e1c1b), boite(0.12, 0.62, 0.12, 0.3, 0, 0.65, 0x2b2522), boite(0.12, 0.62, 0.12, -0.3, 0, 0.65, 0x2b2522),
      boite(0.12, 0.62, 0.12, 0.3, 0, -0.6, 0x2b2522), boite(0.12, 0.62, 0.12, -0.3, 0, -0.6, 0x2b2522), boite(0.25, 0.14, 0.3, 0, 0.5, 0.35, 0xe9a3a3)]),
      regle: (k) => {
        const d = k * 28 + H(k, 7) * 20;
        if (!paturage(d) || H(k, 8) > 0.55) return null;
        const s = H(k, 9) < 0.5 ? -1 : 1, u = s * (17 + H(k, 10) * 60);
        if (relief(d, u) > 22) return null;
        return { d, u, rot: H(k, 11) * 6.28, e: 0.95 + 0.15 * H(k, 12), col: H(k, 13) < 0.35 ? 0xb5784a : BLANC };
      } });
    // (v69 suite) brebis en troupeaux dans les estives (route.brebis : Pyrénées), quel que soit le décor
    const estive = (d) => Math.sin(d * 0.0017 + 0.4) + 0.5 * Math.sin(d * 0.0052 + 2.1) > 0.05 && alt3d(d) < 2300;
    familles.push({ route: "brebis", pas: 7, n: 90, geo: () => fusionnerCouleur([
      boule(0.42, 1.0, 0.82, 1.45, 0, 0.66, 0, BLANC), boule(0.15, 0.9, 1.0, 1.3, 0, 0.86, -0.7, 0x2f2722), boite(0.2, 0.06, 0.08, 0, 0.92, -0.64, 0x2f2722),
      boite(0.07, 0.4, 0.07, 0.17, 0, 0.32, 0x2b2522), boite(0.07, 0.4, 0.07, -0.17, 0, 0.32, 0x2b2522), boite(0.07, 0.4, 0.07, 0.17, 0, -0.3, 0x2b2522), boite(0.07, 0.4, 0.07, -0.17, 0, -0.3, 0x2b2522)]),
      regle: (k) => {
        const d = k * 7 + H(k, 21) * 5;
        if (!estive(d) || H(k, 22) > 0.7) return null;
        const t = Math.floor(d / 140), s = hash(t * 3.3 + 1.7) < 0.5 ? -1 : 1, u = s * (12 + hash(t * 5.1 + 0.3) * 20 + (H(k, 23) - 0.5) * 12);   // troupeau tous les 140 m, à 6–38 m de la route
        if (Math.abs(u) < 8 || relief(d, u) > 26) return null;
        return { d, u, rot: H(k, 24) * 6.28, e: 0.85 + 0.3 * H(k, 25), col: H(k, 26) < 0.2 ? 0xc9b89a : H(k, 26) < 0.3 ? 0x6b5a4a : 0xf1ece0 };
      } });
    familles.push({ theme: "montagne", pas: 6, n: 70, cotes: 2, geo: D("cloture", () => fusionnerCouleur([      // clôtures des pâturages
      boite(0.12, 1.1, 0.12, 0, 0, -3, 0x7a5a3c), boite(0.05, 0.08, 6, 0, 0.55, 0, 0x8d6a47), boite(0.05, 0.08, 6, 0, 0.95, 0, 0x8d6a47)])),
      regle: (k, s) => { const d = k * 6 + 3; return paturage(d) && Math.abs(courbure(d)) < 0.04 && relief(d, s * 12) < 6 ? { d, u: s * 12 } : null; } });
    // ----- désert -----
    const palmier = () => {
      const parts = [cyl(0.2, 0.26, 2.4, 6, 0, 0, 0, 0x8a6a45), cyl(0.17, 0.2, 2.3, 6, 0.12, 2.35, 0, 0x7d5f3d), cyl(0.15, 0.17, 2.2, 6, 0.3, 4.6, 0, 0x8a6a45)];
      for (let k = 0; k < 8; k++) {
        const g = new T.IcosahedronGeometry(1, 0);
        g.scale(1.9, 0.09, 0.45); g.translate(1.6, 0, 0); g.rotateZ(-0.42); g.rotateY(k * 0.785 + 0.3); g.translate(0.36, 6.85, 0);
        parts.push(partieCouleur(g, k % 2 ? 0x3f8a3a : 0x4f9c43));
      }
      parts.push(boule(0.3, 1, 1, 1, 0.36, 6.8, 0, 0x6e5a2e));
      return fusionnerCouleur(parts);
    };
    familles.push({ theme: "desert", pas: 6, n: 145, geo: D("dattier_0", palmier), veg: B, col: 0x5f9a45,      // palmiers des oasis
      regle: (k) => {
        const d = k * 6 + H(k, 1) * 4, o = oasisInfo(d);
        if (!o || Math.abs(d - o.c) > 120) return null;
        const u = o.u0 + (H(k, 2) - 0.5) * 100;
        if (oasis(d, u) > 0.7 || Math.abs(u) < 8) return null;
        return { d, u, e: 0.85 + 0.55 * H(k, 3), rot: H(k, 4) * 6.28 };
      } });
    familles.push({ theme: "desert", pas: 45, n: 20, geo: () => fusionnerCouleur([              // tentes bédouines
      cone(3.6, 2.6, 4, 0, 0, 0, 0x4a3326, Math.PI / 4), boite(4.6, 0.04, 3.2, 0, 0, 4.2, 0xa8432f), cyl(0.06, 0.06, 3.1, 4, 0, 0, 0, 0x2e2118)]),
      regle: (k) => {
        const d = k * 45 + H(k, 5) * 25, o = oasisInfo(d);
        if (!o || Math.abs(d - o.c) > 170 || H(k, 6) > 0.7) return null;
        const u = o.u0 + o.cote * (42 + H(k, 7) * 40);
        return { d, u, e: 0.9 + 0.3 * H(k, 8), rot: H(k, 9) * 6.28 };
      } });
    familles.push({ theme: "desert", pas: 32, n: 26, geo: () => fusionnerCouleur([              // chameaux
      boite(0.75, 0.8, 1.9, 0, 1.25, 0, 0xc49a62), boule(0.55, 1, 0.8, 1.1, 0, 2.15, 0.1, 0xb98d55), boite(0.32, 1.05, 0.34, 0, 1.6, -1.05, 0xc49a62),
      boite(0.36, 0.34, 0.68, 0, 2.55, -1.3, 0xc49a62), boite(0.14, 1.25, 0.14, 0.24, 0, 0.7, 0xb08451), boite(0.14, 1.25, 0.14, -0.24, 0, 0.7, 0xb08451),
      boite(0.14, 1.25, 0.14, 0.24, 0, -0.7, 0xb08451), boite(0.14, 1.25, 0.14, -0.24, 0, -0.7, 0xb08451)]),
      regle: (k) => {
        const d = k * 32 + H(k, 10) * 20, o = oasisInfo(d);
        if (!o || Math.abs(d - o.c) > 230 || H(k, 11) > 0.5) return null;
        const u = o.u0 + o.cote * (8 + H(k, 12) * 60) * (H(k, 13) < 0.5 ? 1 : -0.4);
        if (oasis(d, u) > 0.68 || Math.abs(u) < 9) return null;
        return { d, u, rot: H(k, 14) * 6.28, e: 0.95 + 0.15 * H(k, 15) };
      } });
    const villageInfo = (d) => {
      const dt = dl(d), b = Math.round((dt - 2600) / 5200), c = b * 5200 + 2600 + (d - dt);
      return b >= 0 && b * 5200 + 2600 < (LB || 1e9) - 400 && hash(b * 4.13 + 9) < 0.8 ? { c, cote: hash(b * 2.71 + 3) < 0.5 ? -1 : 1 } : null;
    };
    familles.push({ theme: "desert", pas: 17, n: 52, geo: () => fusionnerCouleur([              // village en terre (toits plats, acrotères)
      boite(6, 3.6, 6, 0, 0, 0, BLANC), boite(6.2, 0.4, 0.25, 0, 3.6, -2.97, BLANC), boite(6.2, 0.4, 0.25, 0, 3.6, 2.97, BLANC),
      boite(0.25, 0.4, 6.2, 2.97, 3.6, 0, BLANC), boite(0.25, 0.4, 6.2, -2.97, 3.6, 0, BLANC),
      boite(0.1, 1.9, 1.1, 3.02, 0, 0.6, 0x5b3a26), boite(0.1, 0.7, 0.7, 3.02, 2.2, -1.6, 0x3a2a20)]),
      regle: (k) => {
        const d = k * 17 + H(k, 16) * 6, v = villageInfo(d);
        if (!v || Math.abs(d - v.c) > 230 || H(k, 17) < 0.12) return null;
        const rang = Math.floor(H(k, 18) * 3), u = v.cote * (15 + rang * 12 + H(k, 19) * 4);
        if (oasis(d, u) > 0.08) return null;
        const tons = [0xd9a86c, 0xe3b780, 0xc99560, 0xe8c592, 0xd0a070];
        return { d, u, rot: v.cote > 0 ? Math.PI : 0, e: 0.8 + 0.4 * H(k, 20), ey: 0.8 + 0.7 * H(k, 21), col: tons[Math.floor(H(k, 22) * 5)] };
      } });
    familles.push({ theme: "desert", pas: 48, n: 18, geo: () => fusionnerCouleur([              // poteaux télégraphiques
      cyl(0.11, 0.14, 7, 6, 0, 0, 0, 0x6b4c32), boite(0.12, 0.12, 2.2, 0, 6.3, 0, 0x5a3f29), boite(0.1, 0.18, 0.1, 0, 6.42, -0.9, 0xe9e6dd), boite(0.1, 0.18, 0.1, 0, 6.42, 0.9, 0xe9e6dd)]),
      regle: (k) => ({ d: k * 48, u: 10.5, rot: Math.PI / 2 }) });
    familles.push({ theme: "desert", pas: 11, n: 80, geo: D("herbe_haute", () => fusionnerCouleur([              // touffes sèches
      boule(0.6, 1.2, 0.55, 1.2, 0, 0.25, 0, 0x8d8a4f), boule(0.45, 1, 0.6, 1, 0.45, 0.22, 0.2, 0x9c8c55), boule(0.4, 1, 0.5, 1, -0.4, 0.18, -0.2, 0x7f7a45)])),
      veg: B, col: 0xc9ae74, ech: B ? 1.5 : 1,
      regle: (k) => {
        if (H(k, 23) > 0.6) return null;
        const d = k * 11 + H(k, 24) * 8, s = H(k, 25) < 0.5 ? -1 : 1, u = s * (8 + Math.pow(H(k, 26), 1.5) * 110);
        return { d, u, e: 0.5 + 0.9 * H(k, 27), rot: H(k, 28) * 6.28 };
      } });
    // ----- Ardennes : villages de pierre grise aux toits d'ardoise (route.villes), sur un ou deux rangs le long de la route -----
    familles.push({ theme: "ardennes", pas: 13, n: 70, geo: () => fusionnerCouleur([
      boite(7, 4.6, 9.5, 0, 0, 0, BLANC), prisme(7.6, 3.6, 10.1, 0, 4.6, 0, 0x3a3f47), boite(0.9, 1.4, 0.9, 1.8, 7.0, 2.6, 0x7d7a74),
      boite(0.12, 1.2, 1.0, 3.52, 1.2, -2.4, 0x2a3038), boite(0.12, 1.2, 1.0, 3.52, 1.2, 2.4, 0x2a3038),
      boite(0.12, 1.2, 1.0, 3.52, 3.0, -2.4, 0x2a3038), boite(0.12, 1.2, 1.0, 3.52, 3.0, 2.4, 0x2a3038), boite(0.12, 2.1, 1.1, 3.52, 0, 0, 0x5a3b2a)]),
      regle: (k) => {
        const d = k * 13 + H(k, 30) * 4;
        if (ville(d) < 0.5 || H(k, 31) < 0.15) return null;
        const s = H(k, 32) < 0.5 ? -1 : 1, rang = H(k, 33) < 0.7 ? 0 : 1, u = s * (12.5 + rang * 13 + H(k, 34) * 2.5);
        if (relief(d, u) > 9) return null;
        const tons = [0xb9b4aa, 0xa8a399, 0xc6c0b4, 0x9d978c, 0xd2cbbd];
        return { d, u, rot: s > 0 ? Math.PI : 0, e: 0.85 + 0.25 * H(k, 35), ey: 0.85 + 0.35 * H(k, 36), col: tons[Math.floor(H(k, 37) * 5)] };
      } });
    // ----- Toscane : cyprès (en allées le long de la route et en bouquets sur les collines), vignes en rangs, oliveraies, fermes ocre, villages -----
    const cypres = () => fusionnerCouleur([cyl(0.1, 0.14, 1.0, 5, 0, 0, 0, 0x5a4634), boule(1, 0.75, 3.9, 0.75, 0, 4.0, 0, 0x2c4a2e, 1), boule(0.6, 0.55, 1.4, 0.55, 0, 7.6, 0, 0x2f5031, 1)]);
    familles.push({ theme: "toscane", pas: 9, n: 60, cotes: 2, geo: cypres,
      regle: (k, s) => {
        const d = k * 9 + 2, b = Math.floor(d / 320);
        if (hash(b * 5.3 + 1) > 0.42 || d - b * 320 > 170 || ville(d) > 0.2) return null;
        return { d, u: s * 8.6, e: 0.9 + 0.2 * H(k, 40 + s), rot: H(k, 41) * 6.28 };
      } });
    familles.push({ theme: "toscane", pas: 23, n: 30, geo: cypres,
      regle: (k) => {
        if (H(k, 42) > 0.45) return null;
        const d = k * 23 + H(k, 43) * 15, s = H(k, 44) < 0.5 ? -1 : 1, u = s * (24 + Math.pow(H(k, 45), 1.2) * 140);
        return ville(d) > 0.3 ? null : { d, u, e: 0.75 + 0.5 * H(k, 46), rot: H(k, 47) * 6.28 };
      } });
    familles.push({ theme: "toscane", pas: 1, n: 560, geo: () => fusionnerCouleur([boite(0.5, 1.05, 6.2, 0, 0, 0, 0x5e7d33), boite(0.08, 1.35, 0.08, 0, 0, -3.05, 0x6b5a45)]),
      regle: (k) => {                                     // vignes : 7 rangs parallèles à la route, par parcelles de 150 m
        const d = Math.floor(k / 7) * 7 + 3, rang = ((k % 7) + 7) % 7, bd = Math.floor(d / 150);
        if (hash(bd * 2.7 + 4) > 0.55 || ville(d) > 0.1 || secteur(d)) return null;
        const s = hash(bd * 1.3 + 8) < 0.5 ? -1 : 1, u = s * (19 + hash(bd * 4.1) * 30 + rang * 2.8);
        if (relief(d, u) > 28) return null;
        return { d, u, col: saison === "automne" ? 0xe0a050 : saison === "hiver" ? 0x8a7a66 : 0xffffff };
      } });
    familles.push({ theme: "toscane", pas: 8, n: 90, geo: D("olivier_0", () => fusionnerCouleur([cyl(0.12, 0.18, 1.3, 5, 0, 0, 0, 0x6e5b48), boule(1.25, 1.1, 0.8, 1.1, 0, 2.0, 0, 0x8b9b6a, 1)])),
      veg: B, col: 0x7d9160, ech: B ? 0.85 : 1,
      regle: (k) => {                                     // oliveraies en quinconce
        const d = k * 8, bd = Math.floor(d / 210);
        if (hash(bd * 6.1 + 2) > 0.3 || ville(d) > 0.15) return null;
        const s = hash(bd * 3.3 + 5) < 0.5 ? -1 : 1, rang = Math.floor(H(k, 48) * 6), u = s * (24 + rang * 8 + (k % 2) * 4);
        return { d, u, e: 0.8 + 0.35 * H(k, 49), rot: H(k, 50) * 6.28 };
      } });
    familles.push({ theme: "toscane", pas: 130, n: 10, geo: () => fusionnerCouleur([                 // fermes (casali) : corps de ferme et tour pigeonnier
      boite(8, 5, 11, 0, 0, 0, BLANC), prisme(8.8, 2.1, 11.8, 0, 5, 0, 0xb5603a), boite(3.4, 8.2, 3.4, -2.4, 0, 3.6, BLANC), prisme(3.9, 1.3, 3.9, -2.4, 8.2, 3.6, 0xb5603a),
      boite(0.12, 1.3, 0.9, 4.02, 1.2, -3, 0x4c6b45), boite(0.12, 1.3, 0.9, 4.02, 1.2, 1, 0x4c6b45), boite(0.12, 1.3, 0.9, 4.02, 3.3, -3, 0x4c6b45), boite(0.12, 1.3, 0.9, 4.02, 3.3, 1, 0x4c6b45),
      boite(0.12, 2.2, 1.4, 4.02, 0, -1, 0x5a3b2a)]),
      regle: (k) => {
        if (H(k, 51) > 0.6) return null;
        const d = k * 130 + H(k, 52) * 60, s = H(k, 53) < 0.5 ? -1 : 1, u = s * (34 + H(k, 54) * 80);
        if (ville(d) > 0.2 || relief(d, u) > 30) return null;
        const tons = [0xe8cfa2, 0xdcb98a, 0xf0dcb8, 0xd4a878];
        return { d, u, rot: s > 0 ? Math.PI : 0, e: 0.9 + 0.2 * H(k, 55), col: tons[Math.floor(H(k, 56) * 4)] };
      } });
    familles.push({ theme: "toscane", pas: 12, n: 70, geo: () => fusionnerCouleur([                 // maisons des villages : façades ocre, volets verts, tuiles
      boite(7, 6.5, 9, 0, 0, 0, BLANC), prisme(7.6, 1.8, 9.6, 0, 6.5, 0, 0xb5603a),
      boite(0.12, 1.3, 0.9, 3.52, 1.3, -2.4, 0x4c6b45), boite(0.12, 1.3, 0.9, 3.52, 1.3, 2.4, 0x4c6b45), boite(0.12, 1.3, 0.9, 3.52, 3.9, -2.4, 0x4c6b45), boite(0.12, 1.3, 0.9, 3.52, 3.9, 2.4, 0x4c6b45),
      boite(0.12, 2.3, 1.2, 3.52, 0, 0, 0x5a3b2a)]),
      regle: (k) => {
        const d = k * 12 + H(k, 57) * 3;
        if (ville(d) < 0.5 || H(k, 58) < 0.1) return null;
        const s = H(k, 59) < 0.5 ? -1 : 1, rang = H(k, 60) < 0.65 ? 0 : 1, u = s * (12 + rang * 12 + H(k, 61) * 2);
        if (relief(d, u) > 9) return null;
        const tons = [0xe8cfa2, 0xdcb98a, 0xf0dcb8, 0xd4a878, 0xe6c79a, 0xc99a70];
        return { d, u, rot: s > 0 ? Math.PI : 0, e: 0.85 + 0.2 * H(k, 62), ey: 0.8 + 0.45 * H(k, 63), col: tons[Math.floor(H(k, 64) * 6)] };
      } });
    familles.push({ theme: "toscane", pas: 60, n: 9, geo: () => fusionnerCouleur([                  // clocher (campanile) au cœur des villages
      boite(4, 19, 4, 0, 0, 0, 0xd9b98a), boite(4.4, 0.5, 4.4, 0, 14.5, 0, 0xc4a070), boite(4.1, 1.8, 0.2, 0, 15.3, 1.95, 0x3a2c22), boite(4.1, 1.8, 0.2, 0, 15.3, -1.95, 0x3a2c22),
      prisme(4.4, 2.6, 4.4, 0, 19, 0, 0xb5603a)]),
      regle: (k) => {
        const d = k * 60 + 20;
        if (ville(d) < 0.95 || H(k, 65) > 0.35) return null;
        const s = H(k, 66) < 0.5 ? -1 : 1;
        return { d, u: s * 30, rot: 0, e: 1 };
      } });
    // ----- Ville de nuit (critérium) : barrières le long du circuit, lampadaires, ampoules et halos de lumière sur la chaussée -----
    familles.push({ theme: "ville", pas: 2.5, n: 170, cotes: 2, geo: () => fusionnerCouleur([
      boite(0.05, 1.05, 2.4, 0, 0, 0, 0x9aa1a8), boite(0.07, 0.07, 2.45, 0, 1.0, 0, 0xc4cad0), boite(0.07, 0.07, 2.45, 0, 0.12, 0, 0xc4cad0),
      boite(0.6, 0.05, 0.08, 0.1, 0, -1.15, 0x7d848b), boite(0.6, 0.05, 0.08, 0.1, 0, 1.15, 0x7d848b), boite(0.03, 0.62, 2.3, -0.05, 0.3, 0, BLANC)]),
      regle: (k, s) => {                                   // barrières (bâche publicitaire de couleur sur la moitié basse)
        const d = k * 2.5 + 1.25;
        if (Math.abs(courbure(d)) > 0.09) return null;
        const pubs = [0xe63946, 0x1d6fd8, 0xf4b400, 0xffffff, 0x2a9d8f, 0xff7a2f];
        return { d, u: s * (DEMI + 0.55), rot: s > 0 ? Math.PI : 0, col: pubs[Math.floor(hash(Math.floor(d / 10) * 3.1 + s) * 6)] };
      } });
    const lampe = (k, s) => { const d = k * 24 + (s > 0 ? 12 : 0); return Math.abs(courbure(d)) > 0.12 ? null : { d, u: s * 6.6, rot: s > 0 ? Math.PI : 0 }; };
    familles.push({ theme: "ville", pas: 24, n: 22, cotes: 2, geo: () => fusionnerCouleur([
      cyl(0.08, 0.12, 6.4, 6, 0, 0, 0, 0x2b3038), boite(1.9, 0.09, 0.09, 0.9, 6.3, 0, 0x2b3038), boite(0.6, 0.16, 0.34, 1.75, 6.1, 0, 0x1d2026)]), regle: lampe });
    familles.push({ theme: "ville", pas: 24, n: 22, cotes: 2, brille: true, geo: () => fusionnerCouleur([boite(0.52, 0.06, 0.28, 1.75, 6.04, 0, 0xffe2a8)]), regle: lampe });
    familles.push({ theme: "ville", pas: 24, n: 22, cotes: 2, halo: true, geo: () => {      // halo : disque dégradé (chaud au centre, rien au bord)
      const g = new T.CircleGeometry(5.2, 28); g.rotateX(-Math.PI / 2); g.translate(1.75, 0.06, 0);
      const n = g.attributes.position.count, col = new Float32Array(n * 3), p = g.attributes.position;
      for (let i = 0; i < n; i++) { const r = Math.hypot(p.getX(i) - 1.75, p.getZ(i)) / 5.2, a = Math.pow(Math.max(0, 1 - r), 1.8) * 0.42; col[i * 3] = a; col[i * 3 + 1] = a * 0.72; col[i * 3 + 2] = a * 0.4; }
      g.setAttribute("color", new T.BufferAttribute(col, 3));
      return g;
    }, regle: lampe });
    // ----- bord de mer -----
    familles.push({ themes: ["mer", "kona", "lanzarote"], pas: 115, n: 11, geo: () => fusionnerCouleur([                 // voiliers
      boite(1.6, 0.7, 5.2, 0, -0.2, 0, BLANC), boite(1.3, 0.12, 4.6, 0, 0.5, 0, 0xb98c5a), cyl(0.06, 0.07, 7.5, 5, 0, 0.5, -0.4, 0xdddddd),
      (() => { const g = new T.BufferGeometry(); g.setAttribute("position", new T.BufferAttribute(new Float32Array([0, 1.1, -0.3, 0, 7.8, -0.35, 0, 1.1, 2.5, 0, 1.1, 2.5, 0, 7.8, -0.35, 0, 1.1, -0.3]), 3)); g.computeVertexNormals(); return partieCouleur(g, BLANC); })(),
      (() => { const g = new T.BufferGeometry(); g.setAttribute("position", new T.BufferAttribute(new Float32Array([0, 1.0, -0.5, 0, 6.8, -0.5, 0, 1.0, -2.6, 0, 1.0, -2.6, 0, 6.8, -0.5, 0, 1.0, -0.5]), 3)); g.computeVertexNormals(); return partieCouleur(g, 0xf3f0e8); })()]),
      regle: (k) => {
        const d = k * 115 + H(k, 1) * 70, u = -(rivage(d) + 45 + H(k, 2) * 250);
        return { d, u, dy: 0.15, rot: H(k, 3) * 6.28, e: 0.8 + 0.6 * H(k, 4), col: [BLANC, BLANC, 0xffd6c9, 0xd0e6ff][Math.floor(H(k, 5) * 4)] };
      } });
    const phareGeo = () => {
      const parts = [];
      for (let i = 0; i < 6; i++) parts.push(cyl(1.55 - i * 0.14, 1.62 - i * 0.14, 2.4, 10, 0, i * 2.4, 0, i % 2 ? 0xd2332e : BLANC));
      parts.push(cyl(1.25, 1.25, 0.25, 10, 0, 14.4, 0, 0x2c3138), cyl(0.75, 0.75, 1.3, 8, 0, 14.65, 0, 0xffe9a3), cone(0.95, 1.1, 8, 0, 15.95, 0, 0xd2332e),
        boite(3.4, 0.6, 3.4, 0, -0.4, 0, 0xd8d0c0), boite(3, 2.6, 4, 3.4, -0.4, 0, BLANC), prisme(3.4, 1.2, 4.4, 3.4, 2.2, 0, 0xc4553d));
      return fusionnerCouleur(parts);
    };
    familles.push({ theme: "mer", pas: 5200, n: 2, geo: phareGeo,                              // phares sur les pointes
      regle: (k) => {
        const d = k * 5200 + 2400 + H(k, 6) * 800;
        if (k < 0 || ville(d) > 0.05 || H(k, 7) > 0.85) return null;
        return { d, u: -(rivage(d) - 7), rot: Math.PI / 2 };
      } });
    familles.push({ theme: "mer", pas: 15, n: 60, geo: D("pin_parasol_0", () => fusionnerCouleur([                // pins parasols
      cyl(0.16, 0.24, 5.2, 6, 0, 0, 0, 0x7a5a40), boule(2.9, 1.25, 0.42, 1.25, 0.2, 5.9, 0, 0x3d6a37, 1), boule(1.9, 1.1, 0.4, 1.1, -1.1, 5.4, 0.8, 0x47783e, 1)])),
      veg: B, col: 0x4a7a3c,
      regle: (k) => {
        if (H(k, 8) > 0.62) return null;
        const d = k * 15 + H(k, 9) * 10, sh = rivage(d), gauche = H(k, 10) < 0.25 && sh > 36;
        const u = gauche ? -(10 + H(k, 11) * (sh - 24)) : 12 + Math.pow(H(k, 12), 1.3) * 190;
        if (ville(d) > 0.4 && Math.abs(u) < 40) return null;
        return { d, u, e: 0.8 + 0.6 * H(k, 13), rot: H(k, 14) * 6.28 };
      } });
    familles.push({ themes: ["mer", "kona"], pas: 70, n: 13, geo: () => fusionnerCouleur([                // villas avec piscine
      boite(9, 5.2, 7, 0, 0, 0, BLANC), cone(6.6, 2.2, 4, 0, 5.2, 0, 0xc4553d, Math.PI / 4), boite(4, 0.25, 6, -7.2, 0, 0, 0xe8e1d2),
      boite(3.2, 0.06, 5, -7.2, 0.25, 0, 0x3fb7e0), boite(0.12, 1.3, 1.2, 4.52, 1.4, -1.8, 0x3a6f93), boite(0.12, 1.3, 1.2, 4.52, 1.4, 1.8, 0x3a6f93),
      boite(0.12, 2.1, 1.1, 4.52, 0, 0, 0x6b4127)]),
      regle: (k) => {
        if (H(k, 15) > 0.55) return null;
        const d = k * 70 + H(k, 16) * 40;
        if (ville(d) > 0.15) return null;
        const u = 34 + H(k, 17) * 120;
        return { d, u, rot: Math.PI + (H(k, 18) - 0.5) * 0.5, e: 0.85 + 0.3 * H(k, 19), col: [BLANC, 0xfbeedd, 0xf7e2c8, 0xfff6e8][Math.floor(H(k, 20) * 4)] };
      } });
    familles.push({ theme: "mer", pas: 9, n: 95, geo: D("olivier_0", () => fusionnerCouleur([                 // oliviers en rangs
      cyl(0.12, 0.18, 1.3, 5, 0, 0, 0, 0x6e5b48), boule(1.25, 1.1, 0.8, 1.1, 0, 2.0, 0, 0x8b9b6a, 1)])),
      veg: B, col: 0x7d9160, ech: B ? 0.85 : 1,
      regle: (k) => {
        const d = k * 9;
        if (Math.sin(d * 0.0016 + 0.4) < 0.25 || ville(d) > 0.15) return null;
        const rang = Math.floor(H(k, 21) * 8), u = 30 + rang * 9;
        return { d, u, e: 0.85 + 0.35 * H(k, 22), rot: H(k, 23) * 6.28 };
      } });
    familles.push({ themes: ["mer", "kona", "lanzarote"], pas: 12, n: 70, geo: D("rocher_plat", () => fusionnerCouleur([                 // rochers du rivage (lave noire à Kona)
      boule(1, 1.3, 0.75, 1, 0, 0.2, 0, 0x9b958a), boule(0.7, 1, 0.8, 1.1, 0.9, 0.1, 0.4, 0x8b857a)])), col: B ? 0xa49c8e : undefined,
      coulTheme: { kona: 0x34302d, lanzarote: 0x3a2c27 },
      regle: (k) => {
        if (H(k, 24) > 0.5 || ville(k * 12) > 0.3) return null;
        const d = k * 12 + H(k, 25) * 8, u = -(rivage(d) + (H(k, 26) - 0.35) * 10);
        return { d, u, e: 0.7 + 1.8 * H(k, 27), rot: H(k, 28) * 6.28, dy: -0.3 };
      } });
    familles.push({ themes: ["mer", "kona", "lanzarote"], pas: 26, n: 32, cotes: 2, geo: () => fusionnerCouleur([      // lampadaires des villes
      cyl(0.07, 0.1, 5.2, 6, 0, 0, 0, 0x3d454f), boite(1.5, 0.08, 0.08, 0.7, 5.1, 0, 0x3d454f), boite(0.5, 0.18, 0.3, 1.35, 4.95, 0, 0xfff1c4)]),
      regle: (k, s) => { const d = k * 26 + (s > 0 ? 13 : 0); return ville(d) > 0.5 ? { d, u: s * 6.6, rot: s > 0 ? Math.PI : 0 } : null; } });
    // ----- Lanzarote : vignes de La Geria (un cep dans un creux de cendre, protégé du vent par un muret de pierres en demi-cercle) -----
    familles.push({ theme: "lanzarote", pas: 1.75, n: 320, geo: () => {
        const parts = [boule(0.9, 1, 0.12, 1, 0, -0.02, 0, 0x1e1b1a, 1)];               // creux de cendre noire
        for (let i = 0; i < 9; i++) { const a = -Math.PI * 0.55 + i * Math.PI * 1.1 / 8; parts.push(boule(0.2, 1.1, 0.9, 1, Math.cos(a) * 0.95, 0.12, Math.sin(a) * 0.95, [0x4a3a33, 0x5c4a40, 0x3c302b][i % 3])); }
        parts.push(boule(0.32, 1.3, 0.7, 1.3, 0, 0.22, 0, 0x5e8f3c, 1), boule(0.2, 1, 0.8, 1, 0.18, 0.3, 0.1, 0x6fa046, 1));
        return fusionnerCouleur(parts);
      },
      regle: (k) => {
        const rang = k % 4, dd = Math.floor(k / 4) * 7, s = Math.sin(dd * 0.0019 + 0.8) > 0 ? 1 : -1;   // 4 rangs de vignes, un cep tous les 7 m
        if (Math.sin(dd * 0.0031 + 2.1) < 0.1 || ville(dd) > 0.2) return null;
        const u = s * (22 + rang * 4.5 + (Math.floor(k / 4) % 2) * 2.2);
        if (u < 0 && -u > rivage(dd) - 10) return null;
        return { d: dd + H(k, 131) * 0.6, u, rot: s > 0 ? Math.PI / 2 : -Math.PI / 2, e: 0.9 + 0.2 * H(k, 132) };
      } });
    // ----- Lanzarote : maisons blanches cubiques, toit plat, portes et fenêtres vertes ou bleues -----
    familles.push({ theme: "lanzarote", pas: 60, n: 14, geo: () => fusionnerCouleur([
        boite(6, 3.2, 6, 0, 0, 0, 0xfbfbfb), boite(6.2, 0.35, 6.2, 0, 3.2, 0, 0xf2f2f2), boite(2.6, 2.4, 3, 1.6, 3.2, -1.2, 0xfbfbfb),
        boite(0.08, 2.0, 1.0, 3.02, 0, 0.8, 0x2f7a4a), boite(0.08, 0.9, 0.9, 3.02, 1.2, -1.6, 0x2f7a4a), boite(0.08, 0.9, 0.9, -3.02, 1.2, 0.5, 0x2f7a4a),
        boite(0.9, 0.9, 0.08, 1.0, 1.2, 3.02, 0x2f7a4a), cyl(0.25, 0.3, 0.9, 6, -1.8, 3.5, 1.8, 0xefefef)]),
      regle: (k) => {
        const d = k * 60 + H(k, 141) * 30, s = H(k, 142) < 0.5 ? -1 : 1;
        if (H(k, 143) > (ville(d) > 0.3 ? 0.9 : 0.35)) return null;
        const u = s * (16 + H(k, 144) * 50);
        if (u < 0 && -u > rivage(d) - 12) return null;
        return { d, u, rot: (s > 0 ? Math.PI : 0) + (H(k, 145) - 0.5) * 0.4, e: 0.85 + 0.3 * H(k, 146), col: H(k, 147) < 0.3 ? 0xdfeaf5 : 0xffffff };
      } });
    // ----- mondes Triathlon (tous les décors) : ravitaillements tous les 5 km, à droite : tente, tables, bouteilles, cartons d'eau, poubelle, drapeaux -----
    familles.push({ tri: true, pas: 5000, n: 2, geo: () => {
        const parts = [prisme(3.4, 0.7, 6.2, 0, 2.4, 0, 0x2a6fd0), boite(0.03, 0.32, 6.0, -1.7, 2.08, 0, 0xe8352b)];
        for (const x of [-1.6, 1.6]) for (const z of [-3.0, 3.0]) parts.push(cyl(0.04, 0.04, 2.4, 6, x, 0, z, 0xb9bec4));
        for (const z of [-1.45, 1.45]) {
          parts.push(boite(0.8, 0.05, 2.6, -1.0, 0.82, z, 0xf2f2f2));
          for (const dz of [-1.1, 1.1]) parts.push(boite(0.05, 0.82, 0.05, -1.0, 0, z + dz, 0x9aa0a6));
          for (let i = 0; i < 9; i++) for (let j = 0; j < 2; j++) parts.push(cyl(0.035, 0.04, 0.22, 6, -1.15 + j * 0.22, 0.87, z - 1.1 + i * 0.27, [0x2f7fe0, 0xf4f6f8, 0xff8a2a][(i + j) % 3]));
        }
        for (let i = 0; i < 5; i++) parts.push(boite(0.55, 0.32, 0.4, 0.7, i % 2 ? 0.32 : 0, -2.2 + Math.floor(i / 2) * 0.5, 0xb88a55));
        parts.push(cyl(0.34, 0.3, 0.9, 10, 1.1, 0, 3.6, 0x2d7a3a));
        for (const [z, c] of [[-4.4, 0xe8352b], [4.4, 0xffc21a], [-6.8, 0xffc21a], [6.8, 0xe8352b]]) {
          parts.push(cyl(0.025, 0.03, 3.5, 5, -1.9, 0, z, 0x30343a), boite(0.02, 2.3, 0.6, -1.9, 1.1, z + 0.32, c));
        }
        return fusionnerCouleur(parts);
      },
      regle: (k) => { const d = k * 5000 + 2500; return !LB || dl(d) < LB - 300 ? { d, u: 8.4 } : null; } });
    // ----- détails au bord de la route (tous les mondes, y compris les mondes réels quand « partout ») -----
    const VERTS = ["campagne", "montagne", "mer", "ardennes", "toscane"];
    const teinteSaison = () => saison === "automne" ? 0xdcc47c : saison === "printemps" ? 0xe4ffd8 : 0xffffff;
    const pasIci = (d, u) => (themeNom === "montagne" && alt3d(d) > 1950) || (!GEO && themeNom === "mer" && (ville(d) > 0.4 || (u < 0 && -u > rivage(d) - 22)));
    const herbe = () => {
      const parts = [];
      for (let i = 0; i < 7; i++) {
        const g = new T.ConeGeometry(0.045, 0.42 + 0.3 * hash(i * 3.1), 3);
        g.translate(0, 0.25, 0); g.rotateZ((hash(i * 5.7) - 0.5) * 0.6); g.rotateX((hash(i * 2.3) - 0.5) * 0.6);
        g.translate((hash(i * 7.9) - 0.5) * 0.45, 0, (hash(i * 4.4) - 0.5) * 0.45);
        parts.push(partieCouleur(g, i % 2 ? 0x5f9e3a : 0x7cb84a));
      }
      return fusionnerCouleur(parts);
    };
    // herbe Blender : teinte de l'herbe du thème (donc de la saison), un peu variée
    const vertHerbe = (k, s, plus) => melange(melange(th.herbe1, th.herbe2, H(k, s)), plus || 0x6fae45, 0.3);
    familles.push({ themes: VERTS, partout: true, saisons: ["printemps", "ete", "automne"], pas: 1.7, n: 380, geo: D("herbe", herbe), veg: B,          // touffes d'herbe
      regle: (k) => {
        if (H(k, 30) > 0.78) return null;
        const d = k * 1.7 + H(k, 31) * 1.4, s = H(k, 32) < 0.5 ? -1 : 1, u = s * (4.7 + Math.pow(H(k, 33), 2) * 30);
        return pasIci(d, u) ? null : { d, u, e: 1.0 + 0.9 * H(k, 34), rot: H(k, 35) * 6.28, col: B ? vertHerbe(k, 36) : teinteSaison() };
      } });
    if (B) {
      familles.push({ themes: VERTS, partout: true, saisons: ["printemps", "ete", "automne"], pas: 2.2, n: 300, geo: () => geoDecor(saison === "ete" ? "epis" : "herbe_haute"), veg: true,   // hautes herbes et épis, en bandes
        regle: (k) => {
          if (H(k, 90) > 0.7 || Math.sin(k * 0.083) + Math.sin(k * 0.029 + 2) < -0.2) return null;
          const d = k * 2.2 + H(k, 91) * 1.8, s = H(k, 92) < 0.5 ? -1 : 1, u = s * (5.2 + Math.pow(H(k, 93), 1.6) * 26);
          return pasIci(d, u) ? null : { d, u, e: 0.8 + 0.7 * H(k, 94), rot: H(k, 95) * 6.28, col: vertHerbe(k, 96, 0xc8c08a) };
        } });
      familles.push({ themes: ["campagne", "montagne", "ardennes"], partout: true, saisons: ["printemps", "ete", "automne"], pas: 4, n: 160, geo: () => geoDecor("fougere"), veg: true,   // fougères au pied des arbres
        regle: (k) => {
          if (H(k, 100) > 0.45) return null;
          const d = k * 4 + H(k, 101) * 3, s = H(k, 102) < 0.5 ? -1 : 1, u = s * (6 + Math.pow(H(k, 103), 1.3) * 34);
          return pasIci(d, u) ? null : { d, u, e: 0.8 + 0.6 * H(k, 104), rot: H(k, 105) * 6.28, col: saison === "automne" ? melange(0xb5743a, th.herbe2, H(k, 106) * 0.4) : melange(th.herbe2, 0x3f7a35, 0.5) };
        } });
      // ----- Kona : touffes d'herbe dorée (« fountain grass ») dans la lave -----
      familles.push({ theme: "kona", pas: 1.5, n: 420, geo: () => geoDecor("herbe_haute"), veg: true, ech: 1.3,
        regle: (k) => {
          if (H(k, 120) > 0.62) return null;
          const d = k * 1.5 + H(k, 121) * 1.2, s = H(k, 122) < 0.5 ? -1 : 1, u = s * (4.6 + Math.pow(H(k, 123), 1.4) * 45);
          if (ville(d) > 0.4 || (u < 0 && -u > rivage(d) - 8)) return null;
          return { d, u, e: 0.7 + 0.8 * H(k, 124), rot: H(k, 125) * 6.28, col: melange(0xd9bf73, 0xb89a55, H(k, 126)) };
        } });
      // ----- campagne : murets de pierres sèches, clôtures des prés, bottes de foin -----
      const muretIci = (d, s) => Math.sin(d * 0.0042 + s * 1.7) + 0.5 * Math.sin(d * 0.013 + s) > 0.55;
      familles.push({ theme: "campagne", pas: 4, n: 110, cotes: 2, geo: () => geoDecor("muret"),
        regle: (k, s) => { const d = k * 4 + 2; return muretIci(d, s) && Math.abs(courbure(d)) < 0.06 ? { d, u: s * 6.4, dy: -0.06 } : null; } });
      familles.push({ theme: "campagne", pas: 6, n: 75, cotes: 2, geo: () => geoDecor("cloture"),
        regle: (k, s) => { const d = k * 6 + 3; return !muretIci(d, s) && Math.sin(d * 0.0031 + s * 2.3 + 1) > 0.35 && Math.abs(courbure(d)) < 0.05 ? { d, u: s * 9.5 } : null; } });
      familles.push({ theme: "campagne", saisons: ["ete", "automne"], pas: 7, n: 70, geo: () => geoDecor("botte_foin"),
        regle: (k) => {
          if (H(k, 110) > 0.4 || Math.sin(k * 0.047 + 0.5) < 0.35) return null;
          const d = k * 7 + H(k, 111) * 5, s = Math.sin(k * 0.011) > 0 ? 1 : -1, u = s * (22 + H(k, 112) * 55);
          return { d, u, rot: H(k, 113) * 6.28, e: 0.95 + 0.1 * H(k, 114), col: saison === "automne" ? 0xd9c9a0 : 0xffffff };
        } });
    }
    const FLEURS = [0xffe14d, 0xffffff, 0xf59ac0, 0xb48cf0, 0xff6b5a, 0x7fb6ff, 0xffb84d];
    familles.push({ themes: VERTS, partout: true, saisons: ["printemps", "ete"], pas: 1.3, n: 480, veg: B, blanc: B, geo: B ? () => geoDecor("fleurs") : () => {                     // fleurs des prés : deux tiges, cinq pétales autour d’un cœur
        const parts = [cyl(0.016, 0.02, 0.42, 3, 0, 0, 0, 0x3f6b2e), cyl(0.014, 0.018, 0.3, 3, 0.2, 0, 0.1, 0x3f6b2e)];
        for (const [cx, cy, cz, r] of [[0, 0.43, 0, 1], [0.2, 0.31, 0.1, 0.75]]) {
          for (let i = 0; i < 5; i++) { const a = i * 1.2566; parts.push(boule(0.075 * r, 1, 0.3, 0.55, cx + Math.cos(a) * 0.08 * r, cy, cz + Math.sin(a) * 0.08 * r, 0xffffff)); }
          parts.push(boule(0.045 * r, 1, 0.7, 1, cx, cy + 0.01, cz, 0x9a7a22));
        }
        return fusionnerCouleur(parts);
      },
      regle: (k) => {
        if (H(k, 40) > (saison === "printemps" ? 0.75 : 0.2) || Math.sin(k * 0.21) + Math.sin(k * 0.067 + 1) < -0.3) return null;   // en taches
        const d = k * 1.3 + H(k, 41) * 1.0, s = H(k, 42) < 0.5 ? -1 : 1, u = s * (4.8 + Math.pow(H(k, 43), 2) * 24);
        return pasIci(d, u) ? null : { d, u, e: 1.1 + 0.8 * H(k, 44), rot: H(k, 45) * 6.28, col: FLEURS[Math.floor(Math.sin(k * 0.021) * 3.5 + 3.5 + H(k, 46) * 1.5) % FLEURS.length] };
      } });
    const champi = (pas, n, geo, dens) => familles.push({ themes: ["campagne", "montagne", "ardennes"], partout: true, saisons: ["printemps", "ete", "automne"], pas, n, geo,
      regle: (k) => {
        if (H(k, 50 + pas) > (saison === "automne" ? dens * 3 : dens)) return null;
        const d = k * pas + H(k, 51) * pas * 0.6, s = H(k, 52) < 0.5 ? -1 : 1, u = s * (5.3 + H(k, 53) * 10);
        return pasIci(d, u) ? null : { d, u, e: 1.1 + 0.8 * H(k, 54), rot: H(k, 55) * 6.28 };
      } });
    champi(7, 90, () => fusionnerCouleur([cyl(0.07, 0.09, 0.17, 6, 0, 0, 0, 0xeee3c8), boule(0.17, 1, 0.55, 1, 0, 0.2, 0, 0x7a4a26, 1),               // cèpes
      cyl(0.05, 0.06, 0.12, 6, 0.22, 0, 0.1, 0xeee3c8), boule(0.11, 1, 0.55, 1, 0.22, 0.13, 0.1, 0x8a5630, 1)]), 0.17);
    champi(19, 34, () => fusionnerCouleur([cyl(0.05, 0.07, 0.24, 6, 0, 0, 0, 0xf6f3ea), boule(0.17, 1, 0.5, 1, 0, 0.27, 0, 0xd0281f, 1),             // amanites
      boite(0.04, 0.03, 0.04, 0.06, 0.33, 0.04, 0xffffff), boite(0.04, 0.03, 0.04, -0.07, 0.32, -0.03, 0xffffff), boite(0.035, 0.03, 0.035, 0.0, 0.345, -0.08, 0xffffff),
      boite(0.035, 0.03, 0.035, -0.02, 0.335, 0.09, 0xffffff), boite(0.03, 0.03, 0.03, 0.1, 0.31, -0.06, 0xffffff)]), 0.11);
    familles.push({ themes: ["desert", "montagne", "kona", "lanzarote"], pas: 3, n: 200, ech: B ? 0.2 : 1, geo: D("galet", () => fusionnerCouleur([                                       // cailloux
      boule(0.17, 1.2, 0.6, 1, 0, 0.04, 0, 0xffffff), boule(0.1, 1, 0.7, 1.2, 0.24, 0.02, 0.12, 0xe8e8e8)])),
      regle: (k) => {
        if (H(k, 60) > 0.55) return null;
        const d = k * 3 + H(k, 61) * 2, s = H(k, 62) < 0.5 ? -1 : 1, u = s * (4.4 + Math.pow(H(k, 63), 1.5) * 22);
        const lave = themeNom === "kona" || themeNom === "lanzarote";
        if (lave && (ville(d) > 0.3 || (u < 0 && -u > rivage(d) - 4))) return null;
        return { d, u, e: (0.7 + 1.3 * H(k, 64)) * (lave ? 2.2 : 1), rot: H(k, 65) * 6.28, col: themeNom === "lanzarote" ? [0x5a3226, 0x2c2522, 0x7a4430][Math.floor(H(k, 66) * 3)] : themeNom === "kona" ? [0x2a2624, 0x35302c, 0x221e1c][Math.floor(H(k, 66) * 3)] : themeNom === "desert" ? [0xc9955f, 0xb07a4a, 0xd8b07a][Math.floor(H(k, 66) * 3)] : [0x9a9a96, 0x86837d, 0xaaa69e][Math.floor(H(k, 66) * 3)] };
      } });
    familles.push({ theme: "desert", pas: 9, n: 75, geo: () => fusionnerCouleur([boule(1, 0.9, 0.16, 2.6, 0, 0, 0, 0xe8cb92, 1)]),       // sable poussé sur le bord de la route
      regle: (k) => {
        if (H(k, 70) > 0.6) return null;
        const d = k * 9 + H(k, 71) * 5, s = H(k, 72) < 0.5 ? -1 : 1;
        return { d, u: s * (4.0 + H(k, 73) * 0.7), e: 0.7 + 0.7 * H(k, 74), rot: (H(k, 75) - 0.5) * 0.3, dy: -0.04 };
      } });
    familles.push({ themes: ["campagne", "montagne", "mer", "ardennes"], partout: true, pas: 5, n: 140, geo: () => fusionnerCouleur([                   // congères de neige
      boule(1, 0.75, 0.32, 2.3, 0, 0, 0, 0xf6f9fc, 1), boule(0.6, 1, 0.4, 1.4, 0.3, 0.05, 0.9, 0xeef3f8, 1)]),
      regle: (k) => {
        const d = k * 5 + H(k, 80) * 3;
        if (!(saison === "hiver" || (themeNom === "montagne" && alt3d(d) > 1850)) || H(k, 81) > 0.7) return null;
        const s = H(k, 82) < 0.5 ? -1 : 1;
        return { d, u: s * (4.35 + H(k, 83) * 1.1), e: 0.7 + 0.6 * H(k, 84), rot: (H(k, 85) - 0.5) * 0.4, dy: -0.12 };
      } });
    solDetails(H);
  }
  /* (v73) 50 détails du sol de plus, petits objets posés par taches au bord de la route selon le monde et la saison.
     sol(o) : themes, pas (m), n, geo, dens (part des emplacements gardés), taches (seuil des taches, -2 à 2 ; absent = partout),
     u0/uw/p (écart à l'axe : u0 + hasard^p × uw), cote (1 ou -1 : un seul côté), rivage [a, b] (sur la plage : a à a + b m de la mer),
     e0/ew (taille), cols (couleurs au hasard, ou fonction qui les donne), alig (posé dans l'axe de la route), ici(d, u), dy, ombre, saisons, partout */
  function solDetails(H) {
    const { boite, cyl, cone, boule } = P3;
    const VERTS = ["campagne", "montagne", "mer", "ardennes", "toscane"], FORET = ["campagne", "montagne", "ardennes"], NH = ["printemps", "ete", "automne"], PE = ["printemps", "ete"];
    const VERT = 0x3f6b2e;
    const pasIci = (d, u) => (themeNom === "montagne" && alt3d(d) > 1950) || (!GEO && themeNom === "mer" && (ville(d) > 0.4 || (u < 0 && -u > rivage(d) - 22)))
      || (!GEO && (themeNom === "kona" || themeNom === "lanzarote") && (ville(d) > 0.4 || (u < 0 && -u > rivage(d) - 6)));
    const sol = (o) => {
      const sd = 200 + familles.length * 7;
      familles.push({ themes: o.themes, partout: o.partout, saisons: o.saisons, pas: o.pas, n: o.n, geo: o.geo, ombre: o.ombre,
        regle: (k) => {
          if (H(k, sd) > o.dens) return null;
          const d = k * o.pas + H(k, sd + 1) * o.pas * 0.8;
          if (o.taches !== undefined && Math.sin(d * 0.011 + sd) + Math.sin(d * 0.0037 + sd * 0.3) < o.taches) return null;
          let u;
          if (o.rivage) { if (GEO || ville(d) > 0.3) return null; u = -(rivage(d) - o.rivage[0] - H(k, sd + 2) * o.rivage[1]); }
          else {
            u = (o.cote || (H(k, sd + 2) < 0.5 ? -1 : 1)) * ((o.u0 || 4.6) + Math.pow(H(k, sd + 3), o.p || 1.4) * (o.uw !== undefined ? o.uw : 20));
            if (pasIci(d, u)) return null;
          }
          if (o.ici && !o.ici(d, u)) return null;
          const cl = typeof o.cols === "function" ? o.cols() : o.cols;
          return { d, u, e: (o.e0 || 0.8) + (o.ew !== undefined ? o.ew : 0.6) * H(k, sd + 5), rot: o.alig ? (u > 0 ? Math.PI : 0) : H(k, sd + 6) * 6.28,
            col: cl ? cl[Math.floor(H(k, sd + 4) * cl.length)] : undefined, dy: o.dy };
        } });
    };
    // pièces : bâton couché ou penché (rz autour de z puis ry autour de y), plusieurs exemplaires en bouquet, fleur (tige, pétales, cœur)
    const baton = (r1, r2, l, nf, x, y, z, rz, ry, c) => { const g = new T.CylinderGeometry(r1, r2, l, nf); g.rotateZ(rz); g.rotateY(ry || 0); g.translate(x, y, z); return partieCouleur(g, c); };
    const bouquet = (nb, r, f) => { const p = []; for (let i = 0; i < nb; i++) p.push(...f((hash(i * 3.7 + nb) - 0.5) * r * 2, (hash(i * 5.3 + nb) - 0.5) * r * 2, i)); return fusionnerCouleur(p); };
    const fleur = (x, z, h, r, nP, cP, cC) => {
      const p = [cyl(0.008, 0.012, h, 3, x, 0, z, VERT)];
      for (let i = 0; i < nP; i++) { const a = i * 6.283 / nP; p.push(boule(r * 0.55, 1, 0.3, 0.55, x + Math.cos(a) * r * 0.7, h, z + Math.sin(a) * r * 0.7, cP)); }
      if (cC !== undefined) p.push(boule(r * 0.35, 1, 0.7, 1, x, h + 0.01, z, cC));
      return p;
    };
    const GRIS = [0x9a9a96, 0x86837d, 0xaaa69e, 0x7d7a74];

    // ----- sous-bois et forêts -----
    sol({ themes: ["montagne", "ardennes"], pas: 2.5, n: 130, dens: 0.4, u0: 5, uw: 22, ombre: false,           // 1. pommes de pin
      geo: () => bouquet(5, 0.4, (x, z, i) => [boule(0.07, 1, 0.8, 1.7, x, 0.05, z, [0x6b4a2b, 0x7a5634, 0x5c3d22][i % 3], 1)]) });
    sol({ themes: [...FORET, "toscane"], partout: true, pas: 2.5, n: 130, dens: 0.45, ombre: false,               // 2. brindilles
      geo: () => bouquet(7, 0.5, (x, z, i) => [baton(0.012, 0.018, 0.35 + 0.35 * hash(i * 1.9), 3, x, 0.015, z, Math.PI / 2, hash(i * 9.1) * 6.28, [0x6e5640, 0x5a4634][i % 2])]) });
    sol({ themes: FORET, pas: 9, n: 50, dens: 0.45, u0: 5, uw: 26,                                                  // 3. branche morte
      geo: () => fusionnerCouleur([baton(0.05, 0.07, 2.2, 5, 0, 0.06, 0, Math.PI / 2, 0, 0x5d4a38), baton(0.025, 0.035, 0.8, 4, 0.45, 0.07, 0.25, Math.PI / 2, -0.7, 0x5d4a38),
        baton(0.02, 0.03, 0.6, 4, -0.5, 0.06, -0.2, Math.PI / 2, 0.9, 0x66523e)]) });
    sol({ themes: FORET, pas: 22, n: 26, dens: 0.45, u0: 6, uw: 28,                                                 // 4. souches coupées
      geo: () => fusionnerCouleur([cyl(0.32, 0.42, 0.45, 9, 0, 0, 0, 0x6b513a), cyl(0.31, 0.31, 0.02, 9, 0, 0.45, 0, 0xc9a878),
        boule(0.14, 2, 0.6, 1, 0.42, 0.04, 0, 0x5f4733), boule(0.12, 1, 0.6, 2, -0.1, 0.04, 0.4, 0x5f4733), boule(0.12, 1.8, 0.6, 1, -0.38, 0.04, -0.2, 0x5f4733)]) });
    sol({ themes: ["ardennes", "montagne"], pas: 30, n: 20, dens: 0.5, u0: 7, uw: 30,                               // 5. troncs couchés moussus
      geo: () => fusionnerCouleur([baton(0.28, 0.3, 4.5, 8, 0, 0.25, 0, Math.PI / 2, 0, 0x5a4632), cyl(0.27, 0.27, 0.02, 8, 0, 0, 0, 0xb89a6c).rotateZ(Math.PI / 2).translate(2.26, 0.25, 0),
        boule(0.2, 3, 0.4, 1.2, -0.3, 0.5, 0, 0x4f7a34, 1), boule(0.15, 2, 0.4, 1, 1.2, 0.48, 0.08, 0x5e8a3a, 1)]) });
    sol({ themes: FORET, pas: 70, n: 9, dens: 0.4, u0: 7, uw: 10,                                                  // 6. tas de bûches
      geo: () => { const p = []; for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) p.push(baton(0.13, 0.13, 1.2, 7, (i - (3 - r) / 2) * 0.27, 0.13 + r * 0.23, 0, Math.PI / 2, Math.PI / 2, [0x7a5a3c, 0x8a6844, 0x6d4f33][(i + r) % 3])); return fusionnerCouleur(p); } });
    sol({ themes: ["ardennes", "montagne"], saisons: NH, pas: 3, n: 110, dens: 0.5, taches: 0, ombre: false,         // 7. plaques de mousse
      geo: () => bouquet(5, 0.5, (x, z, i) => [boule(0.22, 1.4, 0.22, 1.1, x, 0, z, [0x4f7d33, 0x5f8f3a, 0x3f6a2c][i % 3], 1)]) });
    sol({ themes: ["ardennes", "montagne"], pas: 14, n: 40, dens: 0.45, u0: 6, uw: 30,                              // 8. rochers moussus
      geo: () => fusionnerCouleur([boule(0.6, 1.3, 0.7, 1, 0, 0.15, 0, 0x8a8780, 1), boule(0.45, 1.4, 0.35, 1.1, 0.05, 0.5, 0, 0x55803a, 1)]) });
    sol({ themes: VERTS, partout: true, saisons: ["automne"], pas: 1.6, n: 220, dens: 0.65, ombre: false,          // 9. feuilles mortes
      geo: () => bouquet(14, 0.7, (x, z, i) => [boule(0.07, 1, 0.12, 0.7, x, 0.01, z, [0xc8642a, 0xd9952f, 0xa8452a, 0xe0b440, 0x8a5a2a][i % 5])]) });
    sol({ themes: ["ardennes", "campagne"], saisons: NH, pas: 8, n: 60, dens: 0.4, u0: 5.5, uw: 18, taches: -0.4,    // 10. ronces et mûres
      geo: () => { const p = [boule(0.5, 1.3, 0.6, 1, 0, 0.25, 0, 0x335a2a, 1), boule(0.35, 1.2, 0.6, 1, 0.5, 0.2, 0.25, 0x3f6a30, 1)];
        for (let i = 0; i < 9; i++) { const a = i * 2.4; p.push(boule(0.03, 1, 1, 1, Math.cos(a) * 0.55, 0.3 + 0.12 * hash(i), Math.sin(a) * 0.35, i % 3 ? 0x1f1530 : 0x8a1f2e)); }
        return fusionnerCouleur(p); } });

    // ----- prés et bords de route : fleurs et petites plantes -----
    sol({ themes: VERTS, partout: true, saisons: PE, pas: 2, n: 160, dens: 0.4, taches: 0.2, ombre: false,          // 12. trèfles (et leurs fleurs blanches)
      geo: () => bouquet(12, 0.35, (x, z, i) => { const p = []; for (let j = 0; j < 3; j++) { const a = j * 2.09 + i; p.push(boule(0.035, 1, 0.25, 1, x + Math.cos(a) * 0.035, 0.06, z + Math.sin(a) * 0.035, [0x4f8f3a, 0x5c9c40][i % 2])); }
        if (i % 4 === 0) p.push(cyl(0.006, 0.008, 0.12, 3, x, 0, z, VERT), boule(0.03, 1, 1, 1, x, 0.13, z, 0xf4f0e6)); return p; }) });
    sol({ themes: VERTS, partout: true, saisons: PE, pas: 1.8, n: 180, dens: 0.4, taches: -0.3, ombre: false,       // 13. pissenlits
      geo: () => bouquet(6, 0.35, (x, z) => [boule(0.09, 1, 0.12, 0.35, x, 0.01, z, 0x4f8a33), cyl(0.008, 0.01, 0.18, 3, x, 0, z, 0x4d7f2e), boule(0.045, 1, 0.45, 1, x, 0.19, z, 0xffd21f)]) });
    sol({ themes: VERTS, partout: true, saisons: PE, pas: 3, n: 110, dens: 0.35, ombre: false,                      // 14. pissenlits en graines
      geo: () => bouquet(4, 0.3, (x, z) => [cyl(0.006, 0.008, 0.28, 3, x, 0, z, 0x5b7f3e), boule(0.05, 1, 1, 1, x, 0.31, z, 0xf2f2ee, 1)]) });
    sol({ themes: ["campagne", "toscane", "mer"], partout: true, saisons: PE, pas: 1.5, n: 220, dens: 0.7, taches: 0,  // 15. coquelicots, en champs
      geo: () => bouquet(7, 0.4, (x, z, i) => fleur(x, z, 0.4 + 0.12 * hash(i), 0.075, 4, 0xe5261c, 0x1c1a1a)) });
    sol({ themes: ["campagne", "toscane"], saisons: ["ete"], pas: 2.2, n: 140, dens: 0.4, taches: 0.1,              // 16. bleuets
      geo: () => bouquet(6, 0.35, (x, z, i) => fleur(x, z, 0.38 + 0.1 * hash(i), 0.05, 8, 0x3f6fe0, 0x2a3f8a)) });
    sol({ themes: VERTS, partout: true, saisons: PE, pas: 1.8, n: 180, dens: 0.4, taches: 0,                        // 17. marguerites
      geo: () => bouquet(6, 0.35, (x, z, i) => fleur(x, z, 0.3 + 0.08 * hash(i), 0.065, 10, 0xffffff, 0xf2c21a)) });
    sol({ themes: FORET, partout: true, saisons: PE, pas: 2, n: 160, dens: 0.45, taches: -0.2,                      // 18. boutons d'or
      geo: () => bouquet(7, 0.35, (x, z, i) => fleur(x, z, 0.32 + 0.1 * hash(i), 0.04, 5, 0xffd400, 0xe0a800)) });
    sol({ themes: ["mer", "toscane"], saisons: ["ete"], pas: 2.5, n: 130, dens: 0.5, taches: 0.2,                   // 19. lavande
      geo: () => { const p = [boule(0.25, 1, 0.5, 1, 0, 0.1, 0, 0x8a9f7a, 1)];
        for (let i = 0; i < 14; i++) { const a = i * 2.4, r = 0.08 + 0.15 * hash(i), x = Math.cos(a) * r, z = Math.sin(a) * r; p.push(cyl(0.006, 0.008, 0.45, 3, x, 0, z, 0x7a9068), boule(0.022, 1, 3, 1, x, 0.5, z, 0x8b6bd1)); }
        return fusionnerCouleur(p); } });
    sol({ themes: ["campagne", "toscane", "montagne"], saisons: ["ete", "automne"], pas: 4, n: 80, dens: 0.4,        // 20. chardons
      geo: () => { const p = [];
        for (const [x, z, h] of [[0, 0, 0.7], [0.18, 0.1, 0.55]]) {
          p.push(cyl(0.012, 0.018, h, 4, x, 0, z, 0x6f8f62), boule(0.06, 1, 0.8, 1, x, h - 0.02, z, 0x5f8a4a), boule(0.05, 1, 0.9, 1, x, h + 0.04, z, 0xa64ca6));
          for (let j = 0; j < 3; j++) p.push(boule(0.12, 1, 0.12, 0.4, x + Math.cos(j * 2.1) * 0.1, 0.15 + j * 0.12, z + Math.sin(j * 2.1) * 0.1, 0x6f8f62));
        }
        return fusionnerCouleur(p); } });
    sol({ themes: ["montagne"], saisons: PE, pas: 2.5, n: 130, dens: 0.35, taches: 0, ombre: false,                 // 21. gentianes
      geo: () => bouquet(5, 0.25, (x, z) => [boule(0.05, 1, 0.15, 1, x, 0.01, z, 0x4a7a35), cyl(0.008, 0.01, 0.08, 3, x, 0, z, VERT), cyl(0.045, 0.015, 0.08, 6, x, 0.08, z, 0x1f3fc0)]) });
    sol({ themes: ["montagne"], saisons: ["ete"], pas: 4, n: 80, dens: 0.4, ombre: false, ici: (d) => alt3d(d) > 1300,  // 22. edelweiss (en altitude)
      geo: () => bouquet(4, 0.25, (x, z, i) => fleur(x, z, 0.12 + 0.04 * hash(i), 0.055, 7, 0xeeeee6, 0xd8d4b0)) });
    sol({ themes: ["montagne", "ardennes"], saisons: NH, pas: 3, n: 110, dens: 0.4, taches: 0,                      // 23. myrtilliers
      geo: () => { const p = [boule(0.3, 1.2, 0.5, 1, 0, 0.12, 0, 0x3f6f35, 1), boule(0.22, 1.1, 0.5, 1, 0.3, 0.1, 0.15, 0x4a7a3a, 1)];
        for (let i = 0; i < 7; i++) { const a = i * 2.6; p.push(boule(0.025, 1, 1, 1, Math.cos(a) * 0.3, 0.2 + 0.05 * hash(i), Math.sin(a) * 0.28, 0x2e3a7a)); }
        return fusionnerCouleur(p); } });
    sol({ themes: ["ardennes", "campagne"], saisons: PE, pas: 3, n: 110, dens: 0.3, ombre: false,                    // 24. fraises des bois
      geo: () => bouquet(5, 0.25, (x, z) => [boule(0.06, 1, 0.2, 1, x, 0.06, z, 0x3f7d33), boule(0.05, 1, 0.2, 1, x + 0.05, 0.05, z + 0.03, 0x4a8a3a), boule(0.022, 1, 1.2, 1, x + 0.04, 0.04, z - 0.03, 0xd8202a)]) });
    sol({ themes: ["campagne", "ardennes"], saisons: NH, pas: 3.5, n: 90, dens: 0.4, taches: 0.2,                    // 25. orties
      geo: () => bouquet(8, 0.3, (x, z, i) => { const h = 0.55 + 0.35 * hash(i * 2.2), p = [cyl(0.01, 0.014, h, 4, x, 0, z, 0x3e6b2e)];
        for (let j = 0; j < 4; j++) p.push(boule(0.05, 1, 0.2, 0.6, x + (j % 2 ? 0.04 : -0.04), h * (0.35 + j * 0.17), z, 0x3e6b2e)); return p; }) });
    sol({ themes: ["montagne", "campagne"], saisons: ["printemps"], pas: 2, n: 160, dens: 0.5, taches: 0.1, ombre: false,  // 34. crocus
      geo: () => bouquet(7, 0.3, (x, z, i) => [cyl(0.008, 0.01, 0.1, 3, x, 0, z, VERT), cyl(0.03, 0.014, 0.07, 6, x, 0.1, z, [0xa77bdc, 0xf2f0f6, 0xe6c23a][i % 3])]) });
    sol({ themes: ["campagne", "ardennes"], saisons: ["printemps"], pas: 2.5, n: 130, dens: 0.45, taches: 0.2,       // 35. jonquilles
      geo: () => bouquet(5, 0.3, (x, z, i) => { const h = 0.33 + 0.08 * hash(i); return [...fleur(x, z, h, 0.06, 6, 0xfff07a), cyl(0.022, 0.015, 0.05, 6, x, h, z, 0xf5a623)]; }) });

    // ----- la terre, l'eau et les pierres -----
    sol({ themes: ["campagne", "ardennes", "toscane"], partout: true, saisons: NH, pas: 4, n: 90, dens: 0.35, taches: 0.3, ombre: false,  // 26. taupinières
      geo: () => fusionnerCouleur([boule(0.3, 1, 0.45, 1, 0, 0, 0, 0x5a4130, 1), boule(0.08, 1, 0.6, 1, 0.3, 0.01, 0.1, 0x4f3828), boule(0.06, 1, 0.6, 1, -0.25, 0.01, -0.2, 0x63493a)]) });
    sol({ themes: ["ardennes", "montagne"], pas: 40, n: 14, dens: 0.4, u0: 7, uw: 20,                                // 27. fourmilières
      geo: () => fusionnerCouleur([boule(0.6, 1, 0.75, 1, 0, 0, 0, 0x6b5233, 1), boule(0.35, 1, 0.6, 1, 0.1, 0.25, 0.05, 0x7a6040, 1)]) });
    sol({ themes: VERTS, partout: true, saisons: NH, pas: 12, n: 40, dens: 0.35, u0: 4.4, uw: 10, e0: 0.6, ew: 1.2, ombre: false, dy: 0.015,  // 28. flaques d'eau
      geo: () => fusionnerCouleur([boule(1, 1, 0.02, 0.7, 0, 0, 0, 0x4c5a66, 1), boule(0.6, 1, 0.025, 0.8, 0.5, 0, 0.2, 0x56646f, 1)]) });
    sol({ themes: VERTS, partout: true, saisons: ["hiver"], pas: 12, n: 40, dens: 0.4, u0: 4.4, uw: 10, e0: 0.6, ew: 1.2, ombre: false, dy: 0.015,  // 29. plaques de glace
      geo: () => fusionnerCouleur([boule(1, 1, 0.02, 0.7, 0, 0, 0, 0xcfe3ef, 1), boule(0.6, 1, 0.025, 0.8, 0.5, 0, 0.2, 0xe2eef5, 1)]) });
    sol({ themes: ["campagne", "ardennes"], saisons: NH, pas: 35, n: 16, dens: 0.4, u0: 8, uw: 25, ombre: false, dy: 0.01,  // 30. ornières de boue (chemin d'un champ)
      geo: () => fusionnerCouleur([boule(1, 0.2, 0.03, 3, 0.7, 0, 0, 0x4a3626, 1), boule(1, 0.2, 0.03, 3, -0.7, 0, 0, 0x4a3626, 1), boule(0.5, 0.12, 0.035, 1.2, 0.7, 0, 1, 0x5a4a3c, 1)]) });
    sol({ themes: ["montagne", "toscane", "mer"], pas: 4, n: 90, dens: 0.4, cols: GRIS, ombre: false,                // 31. pierres plates
      geo: () => bouquet(4, 0.6, (x, z, i) => [boule(0.22 + 0.1 * hash(i), 1.3, 0.18, 1, x, 0.01, z, 0xffffff, 1)]) });
    sol({ themes: ["montagne"], pas: 6, n: 80, dens: 0.5, taches: 0.2, u0: 5, uw: 30, cols: GRIS,                    // 32. éboulis anguleux
      geo: () => bouquet(9, 0.9, (x, z, i) => [boule(0.08 + 0.12 * hash(i * 2.1), 1, 0.8, 1.1, x, 0.03, z, [0xffffff, 0xe6e6e6][i % 2])]) });
    sol({ themes: ["montagne"], pas: 120, n: 5, dens: 0.6, u0: 5, uw: 8, e0: 0.9, ew: 0.3,                           // 33. cairns
      geo: () => { const p = []; for (let i = 0; i < 6; i++) p.push(boule(0.35 - 0.045 * i, 1, 0.38, 1, (hash(i) - 0.5) * 0.06, 0.12 + i * 0.17, (hash(i + 7) - 0.5) * 0.06, GRIS[i % 4], 1)); return fusionnerCouleur(p); } });
    sol({ themes: VERTS, saisons: ["hiver"], pas: 10, n: 50, dens: 0.4, u0: 5, uw: 30,                               // 36. rochers enneigés
      geo: () => fusionnerCouleur([boule(0.55, 1.3, 0.7, 1, 0, 0.12, 0, 0x7d7a74, 1), boule(0.5, 1.35, 0.32, 1.05, 0, 0.42, 0, 0xf4f8fb, 1)]) });

    // ----- bord de mer et îles -----
    sol({ themes: ["mer", "lanzarote"], pas: 9, n: 55, dens: 0.45, u0: 5, uw: 25,                                   // 37. agaves
      geo: () => { const p = [];
        for (let i = 0; i < 11; i++) { const g = new T.ConeGeometry(0.07, 0.9 + 0.3 * hash(i), 4); g.scale(1, 1, 0.35); g.translate(0, (0.9 + 0.3 * hash(i)) / 2, 0); g.rotateZ(0.25 + 0.6 * hash(i * 3.3)); g.rotateY(i * 2.4); p.push(partieCouleur(g, i % 2 ? 0x7f9f8a : 0x6f8f7a)); }
        return fusionnerCouleur(p); } });
    sol({ themes: ["mer", "lanzarote", "desert"], pas: 14, n: 40, dens: 0.5, u0: 5, uw: 26,                          // 38. figuiers de Barbarie
      geo: () => fusionnerCouleur([boule(0.28, 1, 1.3, 0.25, 0, 0.35, 0, 0x5f8f4a, 1), boule(0.24, 1, 1.25, 0.25, 0.28, 0.75, 0.02, 0x6a9a52, 1), boule(0.22, 1, 1.25, 0.25, -0.25, 0.72, 0, 0x5a8a46, 1),
        boule(0.2, 1, 1.2, 0.25, 0.1, 1.08, 0, 0x6a9a52, 1), boule(0.04, 1, 1.3, 1, 0.2, 1.33, 0, 0xe8a43a), boule(0.04, 1, 1.3, 1, -0.05, 1.3, 0, 0xc84a5a), boule(0.04, 1, 1.3, 1, 0.42, 1.0, 0, 0xe8a43a)]) });
    sol({ themes: ["mer", "kona", "lanzarote"], pas: 3, n: 110, dens: 0.5, rivage: [1, 6], ombre: false,             // 44. coquillages
      geo: () => bouquet(9, 0.6, (x, z, i) => [boule(0.06, 1, 0.45, 1.2, x, 0.01, z, [0xf3e6d3, 0xe8c9b0, 0xfaf3ea, 0xd9b48f][i % 4])]) });
    sol({ themes: ["mer", "kona", "lanzarote"], pas: 25, n: 22, dens: 0.5, rivage: [0.5, 5],                         // 45. bois flotté
      geo: () => fusionnerCouleur([baton(0.07, 0.1, 1.8, 6, 0, 0.08, 0, Math.PI / 2, 0, 0xbdb3a3), baton(0.03, 0.05, 0.7, 5, 0.4, 0.07, 0.25, Math.PI / 2, -0.8, 0xb0a696), boule(0.13, 1, 0.8, 1, -0.9, 0.08, 0, 0xa89e8e)]) });
    sol({ themes: ["mer"], pas: 5, n: 70, dens: 0.5, rivage: [0, 3], ombre: false,                                   // 46. algues échouées
      geo: () => bouquet(6, 0.8, (x, z, i) => [boule(0.2, 1.6, 0.1, 0.5, x, 0.01, z, [0x3e4a24, 0x55602c, 0x2f3a20][i % 3], 1)]) });
    sol({ themes: ["kona"], pas: 11, n: 45, dens: 0.4, u0: 5, uw: 25,                                                // 47. hibiscus en fleurs
      geo: () => { const p = [boule(0.6, 1.1, 0.8, 1, 0, 0.5, 0, 0x3f7a35, 1)];
        for (let i = 0; i < 8; i++) { const a = i * 2.4, y = 0.35 + 0.45 * hash(i); p.push(boule(0.08, 1, 0.5, 1, Math.cos(a) * 0.62, y, Math.sin(a) * 0.58, i % 3 ? 0xe8283a : 0xf28a2a)); }
        return fusionnerCouleur(p); } });
    sol({ themes: ["kona", "lanzarote"], pas: 6, n: 80, dens: 0.5, ombre: false,                                      // 48. dalles de lave cordée
      cols: () => themeNom === "kona" ? [0x2a2522, 0x3a302b, 0x1f1b19] : [0x3a2a24, 0x4a2e26, 0x2c2220],
      geo: () => bouquet(4, 0.8, (x, z, i) => [boule(0.5, 1.4, 0.12, 1, x, 0, z, 0xffffff, 1), boule(0.2, 2, 0.12, 0.5, x, 0.04, z, 0xdddddd, 1)]) });
    sol({ themes: ["lanzarote"], pas: 7, n: 70, dens: 0.5, ombre: false,                                              // 49. picón (lapilli rouges)
      geo: () => { const p = [boule(0.6, 1, 0.3, 1, 0, 0, 0, 0x8a3a24, 1)]; for (let i = 0; i < 8; i++) { const a = i * 2.4; p.push(boule(0.05, 1, 0.8, 1, Math.cos(a) * 0.75, 0.02, Math.sin(a) * 0.7, i % 2 ? 0x2a2220 : 0x9a4a2e)); } return fusionnerCouleur(p); } });

    // ----- désert -----
    sol({ themes: ["desert"], pas: 6, n: 80, dens: 0.4, taches: 0,                                                   // 39. cactus boules
      geo: () => fusionnerCouleur([boule(0.25, 1, 0.85, 1, 0, 0.18, 0, 0x4f7f45, 1), boule(0.17, 1, 0.8, 1, 0.3, 0.12, 0.1, 0x5a8a4c, 1), boule(0.05, 1, 0.6, 1, 0, 0.4, 0, 0xe86a9a), boule(0.04, 1, 0.6, 1, 0.3, 0.27, 0.1, 0xf2d04a)]) });
    sol({ themes: ["desert"], pas: 12, n: 40, dens: 0.5,                                                             // 40. broussailles sèches roulantes
      geo: () => { const p = []; for (let i = 0; i < 14; i++) p.push(baton(0.01, 0.012, 0.75, 3, 0, 0.38, 0, hash(i * 1.3) * 3.14, hash(i * 7.7) * 6.28, [0xb59a6a, 0x9a7f52][i % 2])); return fusionnerCouleur(p); } });
    sol({ themes: ["desert"], pas: 60, n: 9, dens: 0.5, u0: 6, uw: 20,                                               // 41. ossements blanchis
      geo: () => { const p = [boule(0.18, 1.4, 0.7, 1, 0, 0.1, 0, 0xece4d0, 1), baton(0.03, 0.03, 1.1, 5, 0.75, 0.04, 0, Math.PI / 2, 0, 0xe2d9c2)];
        for (let i = 0; i < 4; i++) p.push(baton(0.018, 0.018, 0.5, 4, 0.45 + i * 0.16, 0.06, 0.15, Math.PI / 2, Math.PI / 2 - 0.3, 0xe8e0cc));
        return fusionnerCouleur(p); } });
    sol({ themes: ["desert"], pas: 5, n: 90, dens: 0.55, u0: 4.6, uw: 30, cols: [0xe3b878, 0xd9ab68, 0xe8c48a], ombre: false,  // 42. rides de sable
      geo: () => { const p = []; for (let i = 0; i < 5; i++) p.push(boule(1, 1.6, 0.06, 0.12, 0, 0, (i - 2) * 0.35, 0xffffff, 1)); return fusionnerCouleur(p); } });
    sol({ themes: ["desert"], pas: 15, n: 30, dens: 0.4, u0: 6, uw: 25, e0: 1, ew: 1, ombre: false, dy: -0.01,         // 43. terre craquelée
      geo: () => { const p = []; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) p.push(boite(0.4 + 0.06 * hash(i * 4 + j), 0.03, 0.4 + 0.06 * hash(j * 4 + i + 9), (i - 1.5) * 0.47 + (hash(i + j * 9) - 0.5) * 0.05, 0, (j - 1.5) * 0.47, [0xc9a777, 0xbf9c6c, 0xd2b283][(i + j) % 3])); return fusionnerCouleur(p); } });

    // ----- ville -----
    sol({ themes: ["ville"], pas: 18, n: 30, dens: 0.6, u0: DEMI + 1.4, uw: 3, e0: 1, ew: 0, ombre: false, dy: -0.01,  // 50. plaques d'égout
      geo: () => fusionnerCouleur([cyl(0.37, 0.37, 0.03, 14, 0, 0, 0, 0x55585c), cyl(0.32, 0.32, 0.035, 14, 0, 0, 0, 0x2f3134), boite(0.5, 0.037, 0.03, 0, 0, 0, 0x45484c), boite(0.03, 0.037, 0.5, 0, 0, 0, 0x45484c)]) });
    sol({ themes: ["ville"], pas: 30, n: 18, dens: 0.7, u0: DEMI + 0.3, uw: 0, e0: 1, ew: 0, alig: true, ombre: false, dy: -0.01,  // 11. avaloirs (grilles de caniveau)
      geo: () => { const p = [boite(0.5, 0.03, 0.9, 0, 0, 0, 0x2b2d30)]; for (let i = 0; i < 6; i++) p.push(boite(0.04, 0.035, 0.8, -0.2 + i * 0.08, 0, 0, 0x55585c)); return fusionnerCouleur(p); } });
  }
  function creerDecorThemes() {
    definirFamilles();
    for (const f of familles) {
      const nb = f.n * (f.cotes || 1);
      // brille : objet lumineux (ampoules, néons) ; halo : lumière posée sur le sol, ajoutée à ce qui est dessous
      const matF = f.halo ? new T.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })
        : f.brille ? new T.MeshBasicMaterial({ color: 0xffffff, vertexColors: true }) : new T.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
      f.mesh = f.veg ? instVegetation(f.geo(), nb, false) : new T.InstancedMesh(f.geo(), matF, nb);
      if (f.halo || f.brille) f.ombre = false;
      f.mesh.frustumCulled = false; f.mesh.castShadow = f.ombre !== false; f.mesh.receiveShadow = !f.halo; f.mesh.visible = false;
      for (let q = 0; q < nb; q++) { matrice(f.mesh, q, 0, -9999, 0, 0, 0, 0, 0); f.mesh.setColorAt(q, tmpC.set(0xffffff)); }
      scene.add(f.mesh);
    }
    // panneaux des épingles (« VIRAGE 12 »), comme dans les grands cols
    for (let i = 0; i < 3; i++) {
      const c = document.createElement("canvas"); c.width = 256; c.height = 160;
      const tex = new T.CanvasTexture(c);
      if (T.sRGBEncoding) tex.encoding = T.sRGBEncoding;
      const g = new T.Group();
      const panneau = new T.Mesh(new T.BoxGeometry(2.5, 1.56, 0.07), new T.MeshLambertMaterial({ map: tex }));
      panneau.position.y = 2.75;
      const mat = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 2.4, 6), new T.MeshLambertMaterial({ color: 0x8a9096 }));
      mat.position.y = 1.2;
      g.add(panneau); g.add(mat); g.visible = false; scene.add(g);
      panneauxEpingle.push({ g, c, tex, n: -1 });
    }
  }
  const panneauxEpingle = [];
  function dessinerPanneau(p, n) {
    const x = p.c.getContext("2d");
    x.fillStyle = "#1f4e9c"; x.fillRect(0, 0, 256, 160);
    x.strokeStyle = "#ffffff"; x.lineWidth = 10; x.strokeRect(8, 8, 240, 144);
    x.fillStyle = "#ffffff"; x.textAlign = "center"; x.textBaseline = "middle";
    x.font = "bold 30px sans-serif"; x.fillText("VIRAGE", 128, 42);
    x.font = "bold 76px sans-serif"; x.fillText(String(n), 128, 106);
    p.tex.needsUpdate = true; p.n = n;
  }
  function placerDecorThemes(d) {
    for (const f of familles) {
      const actif = f.tri ? !GEO && !!(route && route.triathlon) : f.route ? !GEO && !!(route && route[f.route])   // (v69 suite) famille liée à la route (brebis), quel que soit le décor
        : (GEO ? !!f.partout : true) && (f.themes ? f.themes.includes(themeNom) : themeNom === f.theme) && (!f.saisons || f.saisons.includes(saison));
      if (f.mesh.visible !== actif) f.mesh.visible = actif;
      if (!actif) continue;
      const k0 = Math.floor((d - 80) / f.pas), cotes = f.cotes || 1;
      for (let q = 0; q < f.n * cotes; q++) {
        const k = k0 + Math.floor(q / cotes), s = cotes === 2 ? (q % 2 ? 1 : -1) : 1;
        const o = f.regle(k, s);
        if (!o || o.d < 0 || horsZone(o.d, o.u)) { matrice(f.mesh, q, 0, -9999, 0, 0, 0, 0, 0); continue; }
        posChemin(o.d, _q);
        const h = cap(o.d), e = o.e || 1, X = _q[0] + Math.cos(h) * o.u, Z = _q[1] + Math.sin(h) * o.u;
        let Y;
        if (GEO) {                          // monde réel : hauteur du sol peint, rien sur les routes, l’eau et les bâtiments
          if (!solReel || solReel.bloque(X, Z)) { matrice(f.mesh, q, 0, -9999, 0, 0, 0, 0, 0); continue; }
          Y = solReel.h(X, Z) + (o.dy || 0);
        } else Y = alt3d(o.d) + relief(o.d, o.u) + (o.dy || 0);
        const ee = e * (f.ech || 1);
        matrice(f.mesh, q, X, Y, Z, -h + (o.rot || 0), ee * (o.ex || 1), ee * (o.ey || 1), ee * (o.ez || 1));
        f.mesh.setColorAt(q, tmpC.set(f.blanc ? 0xffffff : o.col !== undefined ? o.col : f.coulTheme && f.coulTheme[themeNom] !== undefined ? f.coulTheme[themeNom] : f.col !== undefined ? f.col : 0xffffff));
      }
      f.mesh.instanceMatrix.needsUpdate = true;
      if (f.mesh.instanceColor) f.mesh.instanceColor.needsUpdate = true;
    }
    // panneaux des épingles proches
    const ep = (!GEO && route.epingles) || [];
    let i = 0;
    for (const e of ep) {
      if (i >= panneauxEpingle.length) break;
      if (e.d < d - 60 || e.d > d + 650) continue;
      const p = panneauxEpingle[i++], dd = e.d - 26, s = courbure(e.d) > 0 ? -1 : 1, u = s * (DEMI + 2.4);
      if (p.n !== e.n) dessinerPanneau(p, e.n);
      posChemin(dd, _q);
      const h = cap(dd);
      p.g.position.set(_q[0] + Math.cos(h) * u, alt3d(dd) + relief(dd, u) - 0.1, _q[1] + Math.sin(h) * u);
      p.g.rotation.set(0, -h, 0);
      p.g.visible = true;
    }
    for (; i < panneauxEpingle.length; i++) panneauxEpingle[i].g.visible = false;
  }
  function cacherDecorThemes() { for (const f of familles) f.mesh.visible = false; for (const p of panneauxEpingle) p.g.visible = false; }

  /* ---------- Montagnes lointaines (monde montagne) ---------- */
  let tH0 = null;   // texture d'herbe du sol (gardée : la ville de nuit retire la texture du sol)
  let matTerPlaine = null, matTerMontagne = null, fond = null, fondMat = null, fondStyle = "__";
  // détails du sol (creerTerrain) : couleur de la terre nue, part de terre (moins sous la neige), herbe sèche (pas dans le sable ni la lave), bord de l'asphalte
  const rubU = { uSect: null, uNS: { value: 0 }, uLoop: { value: 0 }, uUse: { value: 1 } };   // uUse : usure de la route (1 campagne, 0 = route de ville avec trottoirs)   // secteurs de chemin blanc dessinés sur la route (Toscane)
  const solU = { uTerre: { value: null }, uTerreK: { value: 1 }, uSec: { value: 1 }, uDemi: { value: DEMI }, uVille: { value: 0 } };
  // (v69) sol de la ville de nuit (critérium), dessiné pixel par pixel d'après vRue = (distance le long de la route, écart signé à l'axe) :
  // trottoir de dalles jusqu'aux façades, pavés entre les immeubles, rue de derrière (asphalte, trottoirs, axe en pointillés), puis quartiers
  // au loin en damier de 128 m (rues, places dallées, parcs, cours) ; lumière des vitrines et des lampadaires ajoutée au sol (totalEmissiveRadiance).
  // Toutes les tailles divisent 2040 m (décalage `rueOff`), les identifiants de cases sont repliés pour ne pas changer quand il change.
  const VILLE_SOL = [
    "    if ( uVille > 0.5 ) {",
    "      float dd = vRue.x, uu = vRue.y, a = abs( uu ), cote = step( 0.0, uu );",
    "      float fw = length( fwidth( vec2( dd, uu ) ) ), fin = 1.0 - smoothstep( 0.02, 0.12, fw );",
    "      vec3 lum = vec3( 0.0 );",
    "      if ( a < 36.5 ) {",
    "        // dalles de pierre 0,8 × 0,6 m en rangs décalés (trottoir), puis pavés de 20 cm (cours et passages entre les immeubles)",
    "        float pav = smoothstep( 9.0, 9.6, a );",
    "        float sx = mix( 0.8, 0.2, step( 9.3, a ) ), sy = mix( 0.6, 0.2, step( 9.3, a ) );",
    "        float ry = floor( ( a - uDemi ) / sy ), qx = dd / sx + 0.5 * mod( ry, 2.0 ), cx = floor( qx );",
    "        float h1 = hS( vec2( mod( cx, 2040.0 / sx ) + 0.37, ry + cote * 97.0 ) );",
    "        float jx = min( fract( qx ), 1.0 - fract( qx ) ) * sx, fy = fract( ( a - uDemi ) / sy ), jy = min( fy, 1.0 - fy ) * sy;",
    "        float joint = 1.0 - smoothstep( 0.004, 0.018, min( jx, jy ) );",
    "        vec3 dal = mix( vec3( 0.40, 0.38, 0.35 ) * ( 0.84 + 0.28 * h1 ), vec3( 0.20, 0.19, 0.18 ) * ( 0.7 + 0.6 * h1 ), pav );",
    "        dal *= 1.0 - mix( 0.07, 0.5 * joint, fin );",
    "        dal *= 0.82 + 0.3 * n2 - 0.12 * smoothstep( 0.6, 0.85, n4 );                                     // taches, usure",
    "        float cani = ( 1.0 - pav ) * ( 1.0 - smoothstep( uDemi + 0.25, uDemi + 0.3, a ) );               // caniveau le long de la bordure",
    "        dal = mix( dal, vec3( 0.16, 0.16, 0.17 ), cani * 0.8 );",
    "        float grille = ( 1.0 - pav ) * step( a, uDemi + 0.45 ) * step( abs( mod( dd, 12.0 ) - 6.0 ), 0.3 );  // grilles d'égout",
    "        dal = mix( dal, vec3( 0.06 ) * ( 0.6 + 0.8 * step( 0.5, fract( dd * 12.0 ) ) ), grille );",
    "        c = dal;",
    "        // vitrines allumées : lumière chaude devant les rez-de-chaussée (un immeuble sur trois éteint)",
    "        float seg = floor( dd / 17.0 ), fs = fract( dd / 17.0 );",
    "        float allume = step( 0.33, hS( vec2( mod( seg, 120.0 ) + 0.71, cote * 13.0 + 2.0 ) ) );",
    "        float vit = smoothstep( 0.12, 0.2, fs ) * smoothstep( 0.78, 0.7, fs ) * ( 0.75 + 0.25 * sin( dd * 1.9 ) );",
    "        lum += vec3( 1.0, 0.68, 0.36 ) * 0.22 * allume * vit * smoothstep( 4.0, 8.5, a ) * ( 1.0 - pav );",
    "      } else if ( a < 48.5 ) {",
    "        // rue de derrière : trottoirs de 2 m, chaussée, axe en pointillés, lampadaires tous les 24 m",
    "        float t = a - 36.5;",
    "        float tr = 1.0 - step( 2.0, t ) * step( t, 10.0 );",
    "        vec3 asp = vec3( 0.07, 0.072, 0.08 ) * ( 0.85 + 0.3 * n2 ) * ( 0.9 + 0.2 * bS( solP * 9.0 ) );",
    "        float axe = step( abs( t - 6.0 ), 0.08 ) * step( mod( dd, 6.0 ), 2.4 ) * fin;",
    "        asp = mix( asp, vec3( 0.6 ), axe );",
    "        float jt = min( fract( dd / 0.8 ), 1.0 - fract( dd / 0.8 ) ) * 0.8;",
    "        vec3 tro = vec3( 0.33, 0.32, 0.30 ) * ( 0.85 + 0.25 * n2 ) * ( 1.0 - 0.4 * fin * ( 1.0 - smoothstep( 0.004, 0.018, jt ) ) );",
    "        c = mix( asp, tro, tr );",
    "        float lp = mod( dd + cote * 12.0, 24.0 ) - 12.0, lt = t - 2.6;",
    "        lum += vec3( 1.0, 0.72, 0.42 ) * 0.3 * exp( -( lp * lp + lt * lt ) / 14.0 );",
    "      } else {",
    "        // quartiers au loin : damier de 128 m (rues de 14 m avec trottoirs), places dallées, parcs, cours et toits plats",
    "        vec2 g = mod( solP, 128.0 ), e = min( g, 128.0 - g ), id = floor( solP / 128.0 );",
    "        float rue = min( e.x, e.y ), hb = hS( id + 0.53 );",
    "        vec3 blo = hb < 0.22 ? vec3( 0.045, 0.075, 0.04 ) * ( 0.8 + 0.5 * n2 ) : hb < 0.4 ? vec3( 0.3, 0.29, 0.27 ) * ( 0.85 + 0.25 * n2 ) : vec3( 0.16, 0.16, 0.17 ) * ( 0.75 + 0.5 * n1 );",
    "        if ( hb < 0.22 ) { float al = min( abs( g.x - g.y ), abs( g.x + g.y - 128.0 ) ); blo = mix( blo, vec3( 0.26, 0.24, 0.2 ), 1.0 - smoothstep( 1.2, 1.8, al ) ); }",
    "        vec3 asp = vec3( 0.07, 0.072, 0.08 ) * ( 0.85 + 0.3 * n2 );",
    "        c = rue < 5.0 ? asp : rue < 7.0 ? vec3( 0.3, 0.29, 0.27 ) * ( 0.85 + 0.25 * n2 ) : blo;",
    "        // lampadaires le long des rues (lumière posée au sol) et fenêtres des cours",
    "        vec2 lp = vec2( mod( solP.y, 32.0 ) - 16.0, mod( solP.x, 32.0 ) - 16.0 );",
    "        float l1 = exp( -( ( e.x - 5.5 ) * ( e.x - 5.5 ) + lp.x * lp.x ) / 18.0 ), l2 = exp( -( ( e.y - 5.5 ) * ( e.y - 5.5 ) + lp.y * lp.y ) / 18.0 );",
    "        lum += vec3( 1.0, 0.7, 0.4 ) * 0.34 * max( l1, l2 );",
    "        lum += vec3( 0.55, 0.62, 0.8 ) * 0.035 * step( 0.4, hb ) * step( 7.0, rue ) * smoothstep( 0.55, 0.8, fS( solP * 0.2 + id ) );",
    "      }",
    "      totalEmissiveRadiance += lum;",
    "    }"].join("\n");
  const LUMIERE_FOND = (function () { const x = -0.7, y = 0.55, z = -0.25, n = Math.hypot(x, y, z); return [x / n, y / n, z / n]; })();
  function montagneFacettes(i, larg, haut, style) {
    const mesa = style === "desert";
    let g = new T.IcosahedronGeometry(1, 1);
    g = g.index ? g.toNonIndexed() : g;
    const p = g.attributes.position.array, n = p.length / 3, cache = {};
    for (let v = 0; v < n; v++) {
      const x = p[v * 3], y = p[v * 3 + 1], z = p[v * 3 + 2];
      const cle = Math.round(x * 40) + "," + Math.round(y * 40) + "," + Math.round(z * 40);
      let c = cache[cle];
      if (!c) {
        const t = Math.max(0, (y + 0.15) / 1.15), tt = mesa ? Math.min(t, 0.7) / 0.7 : t, hh = Math.pow(tt, mesa ? 1.1 : 1.2) * haut;
        const rr = larg * (1 - (mesa ? 0.3 : 0.6) * tt) * (0.82 + 0.36 * hash(i * 31 + v * 0.0 + x * 9 + z * 7 + y * 5));
        c = cache[cle] = [x * rr, hh * (0.9 + 0.2 * hash(x * 13 + z * 3 + i)), z * rr];
      }
      p[v * 3] = c[0]; p[v * 3 + 1] = c[1]; p[v * 3 + 2] = c[2];
    }
    const vo = style === "volcan", vr = style === "volcanR";
    const col = new Float32Array(n * 3), cR = new T.Color(mesa ? 0xbf7447 : vr ? 0x9a4e32 : vo ? 0x6e625a : 0x8793a8), cV = new T.Color(mesa ? 0xd9a468 : vr ? 0x5e3a2e : vo ? 0x7a7a52 : 0x6d8a72), cN = new T.Color(mesa ? 0xe9c694 : vr ? 0xb0603a : vo ? 0x8a7e74 : 0xf4f7fb), k = new T.Color();
    for (let f = 0; f + 2 < n; f += 3) {
      const a = f * 3, b = a + 3, c2 = a + 6;
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c2] - p[a], vy = p[c2 + 1] - p[a + 1], vz = p[c2 + 2] - p[a + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      const cy = (p[a + 1] + p[b + 1] + p[c2 + 1]) / 3, fr = cy / haut;
      const lum = Math.min(1, Math.max(0.45, 0.62 + 0.55 * (nx * LUMIERE_FOND[0] + ny * LUMIERE_FOND[1] + nz * LUMIERE_FOND[2])));
      k.copy(fr < 0.22 ? cV : cR).lerp(cR, Math.min(1, Math.max(0, (fr - 0.1) * 4)));
      if (mesa) { if (Math.floor(fr * 6) % 2) k.lerp(cV, 0.35); if (ny > 0.8 && fr > 0.8) k.copy(cN); }
      else if (fr > 0.5 && ny > 0.1) k.lerp(cN, Math.min(1, (fr - 0.45) * 4));
      for (let q = 0; q < 3; q++) { col[f * 3 + q * 3] = k.r * lum; col[f * 3 + q * 3 + 1] = k.g * lum; col[f * 3 + q * 3 + 2] = k.b * lum; }
    }
    g.setAttribute("color", new T.BufferAttribute(col, 3));
    return g;
  }
  function creerFond() {
    fond = new T.Group();
    fondMat = new T.MeshBasicMaterial({ vertexColors: true });
    fond.visible = false;
    scene.add(fond);
  }
  function construireFond(style) {
    fondStyle = style;
    for (const m of fond.children.slice()) { fond.remove(m); if (m.geometry && m.geometry.dispose) m.geometry.dispose(); }
    if (!style) return;
    const volcan = style === "volcan" || style === "volcanR", N = volcan ? 6 : 18, mesa = style === "desert";
    for (let i = 0; i < N; i++) {
      const a = (i / N) * 6.2832 + hash(i * 3.3) * 0.25, r = volcan ? 690 + hash(i * 5.1) * 80 : 470 + hash(i * 5.1) * 160;
      // volcans boucliers : très larges et peu pentus (comme le Mauna Kea et le Hualalai)
      const m = new T.Mesh(volcan ? montagneFacettes(i, 460 + hash(i * 2.9) * 160, 150 + hash(i * 7.7) * 80, style)
        : montagneFacettes(i, (mesa ? 110 : 170) + hash(i * 2.9) * 120, (mesa ? 90 : 150) + hash(i * 7.7) * (mesa ? 120 : 190), style), fondMat);
      m.position.set(Math.cos(a) * r * PORTEE, -110 * PORTEE, Math.sin(a) * r * PORTEE);   // (v69) montagnes du fond repoussées avec la vue
      m.scale.setScalar(PORTEE);
      m.rotation.y = hash(i) * 6.28;
      m.frustumCulled = false;
      fond.add(m);
    }
  }

  /* ---------- Météo dynamique ---------- */
  const ETATS_METEO = {
    clair: { couv: 0, brume: 0, pluie: 0, nom: "Dégagé", ico: "☀️" },
    nuageux: { couv: 0.55, brume: 0.05, pluie: 0, nom: "Nuageux", ico: "⛅" },
    brume: { couv: 0.7, brume: 0.85, pluie: 0, nom: "Brouillard", ico: "🌫️" },
    pluie: { couv: 0.9, brume: 0.3, pluie: 0.7, nom: "Pluie", ico: "🌧️" },
    orage: { couv: 1, brume: 0.4, pluie: 1, nom: "Orage", ico: "⛈️", eclairs: true }
  };
  const SUITE_METEO = {
    clair: [["clair", 5], ["nuageux", 2.5], ["brume", 0.5]],
    nuageux: [["clair", 5], ["nuageux", 1.5], ["brume", 1], ["orage", 1]],
    brume: [["clair", 5], ["nuageux", 2]],
    pluie: [["nuageux", 3], ["clair", 2]],
    orage: [["nuageux", 3], ["clair", 3]]
  };
  let meteoMode = "auto", meteoEtat = "clair", meteoDuree = 600, meteoTimer = 0;
  // un état dure de 3 minutes à 1 heure (la plupart du temps 10 à 30 minutes)
  const dureeMeteo = () => 180 + Math.pow(Math.random(), 1.5) * 3420;
  const meteoVal = { couv: 0, brume: 0, pluie: 0 };
  const meteoApp = { couv: -9, brume: -9, pluie: -9 };
  let baseCiel = null, hemiBase = 0.5, eclair = 0, eclairProchain = 6, pluieObj = null, nbEclairs = 0;
  let GRIS_H = null, GRIS_B = null;

  function tirerMeteo(liste) {
    let tot = 0;
    for (const [, w] of liste) tot += w;
    let r = Math.random() * tot;
    for (const [n, w] of liste) { r -= w; if (r <= 0) return n; }
    return liste[0][0];
  }
  function demarrerMeteo() {
    meteoEtat = meteoMode === "auto" ? tirerMeteo([["clair", 7], ["nuageux", 2], ["brume", 0.8], ["orage", 0.2]]) : meteoMode;
    const e = ETATS_METEO[meteoEtat];
    meteoVal.couv = e.couv; meteoVal.brume = e.brume; meteoVal.pluie = e.pluie;
    meteoTimer = 0; meteoDuree = dureeMeteo();
    appliquerMeteo();
  }
  function memoriserCiel(haut, hor, brume, soleilCoul, lum, hem) {
    if (!baseCiel) baseCiel = { haut: new T.Color(), hor: new T.Color(), brume: new T.Color(), soleil: new T.Color(), lum: 1, hemi: 0.5 };
    baseCiel.haut.set(haut); baseCiel.hor.set(hor); baseCiel.brume.set(brume); baseCiel.soleil.set(soleilCoul);
    baseCiel.lum = lum; baseCiel.hemi = hem;
  }
  let tmpGH = null, tmpGB = null;
  function appliquerMeteo() {
    if (!tmpGH && T) { tmpGH = new T.Color(); tmpGB = new T.Color(); }
    if (!scene || !th || !baseCiel || !lumiere) return;
    if (!GRIS_H) { GRIS_H = new T.Color(0x7b8794); GRIS_B = new T.Color(0xaeb6bf); }
    const g = meteoVal.couv, b = meteoVal.brume, p = meteoVal.pluie;
    // de nuit (ville), les nuages et la brume restent sombres
    const nuit = !!th.nuit, GH = nuit ? tmpGH.copy(GRIS_H).multiplyScalar(0.2) : GRIS_H, GB = nuit ? tmpGB.copy(GRIS_B).multiplyScalar(0.2) : GRIS_B;
    th.haut.copy(baseCiel.haut).lerp(GH, g * 0.85);
    th.horizon.copy(baseCiel.hor).lerp(GB, Math.min(1, g * 0.75 + b * 0.2));
    scene.fog.color.copy(baseCiel.brume).lerp(GB, Math.min(1, g * 0.75 + b * 0.2));
    renderer.setClearColor(scene.fog.color);
    scene.fog.near = Math.max(6, th.fogProche * PORTEE * (1 - 0.88 * b) * (1 - 0.3 * p));
    scene.fog.far = Math.max(80, th.fogLoin * PORTEE * (1 - 0.8 * b) * (1 - 0.4 * p));
    lumiere.intensity = baseCiel.lum * (1 - 0.62 * g);
    lumiere.color.copy(baseCiel.soleil).lerp(GB, g * 0.5);
    hemiBase = baseCiel.hemi * (1 + 0.3 * g);
    hemi.intensity = hemiBase;
    if (soleil) { soleil.visible = g < 0.6; }
    if (lueur) { lueur.material.opacity = 0.85 * Math.max(0, 1 - g * 1.4); lueur.visible = g < 0.7; }
    if (nuages) {
      nuages.children.forEach((c, i) => {
        const e = 1 + g * 0.9;
        c.scale.set(e, 1 + g * 0.5, e);
        if (c.userData.y0 === undefined) c.userData.y0 = c.position.y;
        c.position.y = c.userData.y0 * (1 - 0.4 * g);
      });
      const vus = new Set();
      for (const c of nuages.children) for (const s of c.children) vus.add(s.material);
      for (const m of vus) { m.color.setRGB(1, 1, 1).lerp(GRIS_H, g * 0.55); if (nuit) m.color.multiplyScalar(0.16); m.opacity = 0.92 + 0.07 * g; }
      uVeg.uVent.value = 0.9 + 1.3 * g + 0.6 * p;           // plus de vent dans les arbres quand le temps se gâte
    }
    if (ruban && ruban.material && ruban.material.color) ruban.material.color.setScalar(1 - 0.3 * p);
    if (fondMat) fondMat.color.setScalar(1 - 0.35 * g);
    colorerCiel();
    meteoApp.couv = g; meteoApp.brume = b; meteoApp.pluie = p;
  }
  function creerPluie() {
    const N = 1100;
    const px = new Float32Array(N), py = new Float32Array(N), pz = new Float32Array(N);
    for (let i = 0; i < N; i++) { px[i] = (hash(i * 3 + 1) - 0.5) * 50; py[i] = -3 + hash(i * 3 + 2) * 16; pz[i] = (hash(i * 3 + 3) - 0.5) * 50; }
    const pos = new Float32Array(N * 6);
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.BufferAttribute(pos, 3));
    const mesh = new T.LineSegments(geo, new T.LineBasicMaterial({ color: 0xcfd9e6, transparent: true, opacity: 0.4, fog: false, depthWrite: false }));
    mesh.frustumCulled = false; mesh.visible = false;
    scene.add(mesh);
    pluieObj = { N: N, px: px, py: py, pz: pz, pos: pos, geo: geo, mesh: mesh };
  }
  function majPluie(dt, vit, cx, cy, cz, cap0) {
    if (!pluieObj) return;
    const P = pluieObj, p = meteoVal.pluie;
    if (p < 0.03) { P.mesh.visible = false; return; }
    P.mesh.visible = true;
    P.mesh.position.set(cx, cy, cz);
    P.mesh.rotation.y = -cap0;
    P.mesh.material.opacity = 0.18 + 0.3 * p;
    const n = Math.min(P.N, Math.floor(P.N * Math.min(1, p * 1.15)));
    for (let i = 0; i < n; i++) {
      let x = P.px[i] + 1.6 * dt, y = P.py[i] - 17 * dt, z = P.pz[i] + vit * dt;
      if (y < -3) { y += 16; x = (hash(i * 7.7 + temps) - 0.5) * 50; }
      if (z > 25) z -= 50;
      if (x > 25) x -= 50;
      P.px[i] = x; P.py[i] = y; P.pz[i] = z;
      const o = i * 6;
      P.pos[o] = x; P.pos[o + 1] = y; P.pos[o + 2] = z;
      P.pos[o + 3] = x - 0.1; P.pos[o + 4] = y + 0.6; P.pos[o + 5] = z - 0.03 * vit;
    }
    P.geo.setDrawRange(0, n * 2);
    P.geo.attributes.position.needsUpdate = true;
  }
  function majMeteo(dt) {
    if (!baseCiel) return;
    if (meteoMode === "auto") {
      meteoTimer += dt;
      if (meteoTimer > meteoDuree) {
        meteoTimer = 0; meteoDuree = dureeMeteo();
        meteoEtat = tirerMeteo(SUITE_METEO[meteoEtat] || SUITE_METEO.clair);
      }
    }
    const cible = ETATS_METEO[meteoEtat] || ETATS_METEO.clair, k = 1 - Math.exp(-dt / 12);
    meteoVal.couv += (cible.couv - meteoVal.couv) * k;
    meteoVal.brume += (cible.brume - meteoVal.brume) * k;
    meteoVal.pluie += (cible.pluie - meteoVal.pluie) * k;
    if (Math.abs(meteoVal.couv - meteoApp.couv) > 0.012 || Math.abs(meteoVal.brume - meteoApp.brume) > 0.012 || Math.abs(meteoVal.pluie - meteoApp.pluie) > 0.012) appliquerMeteo();
    // éclairs
    if (cible.eclairs && meteoVal.pluie > 0.6) {
      eclairProchain -= dt;
      if (eclairProchain <= 0) { eclair = 1; nbEclairs++; eclairProchain = 5 + Math.random() * 11; }
    }
    if (eclair > 0.01) { eclair *= Math.exp(-dt * 7); if (Math.sin(temps * 40) > 0.6 && eclair < 0.5) eclair *= 0.5; hemi.intensity = hemiBase + eclair * 1.7; }
    else if (eclair > 0) { eclair = 0; hemi.intensity = hemiBase; }
  }
  function definirMeteo(mode) {
    const m = (mode === "auto" || ETATS_METEO[mode]) ? mode : "auto";
    if (m === meteoMode && baseCiel) return;
    meteoMode = m;
    demarrerMeteo();
  }

  /* ---------- API ---------- */
  function creer(canvas, opts) {
    opts = opts || {};
    T = opts.THREE || THREE;
    if (T.ColorManagement) {
      if ("legacyMode" in T.ColorManagement) T.ColorManagement.legacyMode = false;
      else T.ColorManagement.enabled = true;
    }
    dummy = new T.Object3D(); tmpC = new T.Color(); vHaut = new T.Vector3(0, 1, 0); vTmp = new T.Vector3();
    renderer = opts.renderer || new T.WebGLRenderer({ canvas: canvas, antialias: true });
    if (T.sRGBEncoding) renderer.outputEncoding = T.sRGBEncoding;
    if (renderer.shadowMap) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; }
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(58, 16 / 9, 0.1, 1300 * PORTEE + 1000);
    hemi = new T.HemisphereLight(0xdceeff, 0x7aa05a, 0.5);
    lumiere = new T.DirectionalLight(0xfff0d6, 1.15);
    lumiere.position.set(SUN.x * 160, SUN.y * 160, SUN.z * 160);
    const sc = lumiere.shadow.camera;
    sc.left = -95; sc.right = 95; sc.top = 95; sc.bottom = -95; sc.near = 1; sc.far = 420;
    if (sc.updateProjectionMatrix) sc.updateProjectionMatrix();
    lumiere.shadow.bias = -0.0004; lumiere.shadow.normalBias = 0.6;
    scene.add(hemi); scene.add(lumiere); scene.add(lumiere.target);
    preparerRoute();
    creerCiel(); creerNuages(); creerTerrain(); creerDecorFixe(); creerCycliste(); creerPoussiere(); creerFoule(); creerPluie(); creerFond(); creerVilles(); creerDecorThemes();
    appliquerTheme(opts.theme || "campagne");
    demarrerMeteo();
    definirQualite(opts.qualite || "normale");
    return api;
  }

  /* ---------- Aperçu de l'avatar (onglet Personnalisation) : le vrai cycliste du jeu, seul, vu par une seconde caméra ----------
     Le cycliste et trois lumières propres à l'aperçu sont mis sur le « calque » 1 : la caméra de l'aperçu ne voit que lui. */
  let rendApercu = null, camApercu = null, lumApercu = null, derniereImage3D = 0;
  function apercuAvatar(cv, ang, veloSeul) {
    if (!renderer || !cycliste || !cv) return false;
    const w = cv.clientWidth, hh = cv.clientHeight;
    if (!w || !hh) return false;
    if (!rendApercu || rendApercu.domElement !== cv) {
      rendApercu = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
      if (T.sRGBEncoding) rendApercu.outputEncoding = T.sRGBEncoding;
      rendApercu.setClearColor(0x000000, 0);
      camApercu = new T.PerspectiveCamera(27, 1, 0.05, 30); camApercu.layers.set(1);
      const hl = new T.HemisphereLight(0xeaf2ff, 0x4a4036, 0.85), dl = new T.DirectionalLight(0xfff4e6, 0.9), dl2 = new T.DirectionalLight(0xbfd4ff, 0.4);
      for (const l of [hl, dl, dl2]) { l.layers.set(1); scene.add(l); }
      dl.target = cycliste; dl2.target = cycliste;
      lumApercu = { dl, dl2 };
    }
    cycliste.traverse((o) => o.layers.enable(1));          // aussi les pièces ajoutées depuis
    if (veloSeul) {                                        // onglet Vélo : le cycliste (corps, tête, casque, lunettes, cheveux) n'est pas dessiné dans l'aperçu
      const cachés = [corps.tete, corps.modeleH && corps.modeleH.mesh];
      if (corps.chevL) for (const k in corps.chevL) cachés.push(corps.chevL[k].grp);
      for (const k of ["torse", "epaules", "poitrine", "bassin", "cou", "collier", "cheveux", "casque", "lunettes", "nuque", "chignon", "queue"]) cachés.push(corps[k]);
      for (const j of jambes) for (const k in j) if (k !== "manivelle" && k !== "pedale") cachés.push(j[k]);
      for (const b of corps.bras) for (const k in b) cachés.push(b[k]);
      for (const o of cachés) if (o && o.traverse) o.traverse((x) => x.layers.disable(1));
    }
    rendApercu.setPixelRatio(Math.min((typeof window !== "undefined" && window.devicePixelRatio) || 1, 2));
    rendApercu.setSize(w, hh, false);
    camApercu.aspect = w / hh; camApercu.updateProjectionMatrix();
    // pose : la sortie ne tourne pas, on fait pédaler doucement le cycliste
    if (performance.now() - derniereImage3D > 300) { angleMan += 0.04; angleRoue += 0.09; animerCycliste(0, 0.4, performance.now() / 1000); }
    visibiliteCorps(false);
    if (corps.modeleH) { corps.modeleH.matCorps.userData.u.uSansTete.value = 0; corps.modeleH.mats[7].visible = corps.modeleH.mats[8].visible = true; corps.modeleH.visage.mesh.visible = true; }
    cycliste.updateMatrixWorld(true);
    const loc = (x, y, z) => cycliste.localToWorld(new T.Vector3(x, y, z));
    const ta = Math.tan(camApercu.fov * Math.PI / 360), rr = 1.08 * Math.max(0.82 / ta, 0.8 / (ta * camApercu.aspect));   // cadre le coureur et le vélo en entier
    camApercu.position.copy(loc(Math.sin(ang) * rr, 0.95 + rr * 0.12, Math.cos(ang) * rr - 0.1));
    camApercu.lookAt(loc(0, 0.92, -0.08));
    if (veloSeul) {                                        // le vélo entier dans le cadre
      const rv = 1.05 * Math.max(0.5 / ta, 0.92 / (ta * camApercu.aspect));
      camApercu.position.copy(loc(Math.sin(ang) * rv, 0.5 + rv * 0.1, Math.cos(ang) * rv));
      camApercu.lookAt(loc(0, 0.5, 0));
    }
    lumApercu.dl.position.copy(loc(-1.6, 3.2, -2.2)); lumApercu.dl2.position.copy(loc(2.2, 1.6, 2.4));
    const fog = scene.fog; scene.fog = null;
    rendApercu.render(scene, camApercu);
    scene.fog = fog;
    return true;
  }

  function dessiner(e) {
    derniereImage3D = performance.now();
    if (!renderer) return;
    if (preparerRoute()) derniereBase = null;
    if (reelAFaire) majReel();
    const dt = Math.min(Math.max(e.dt || 0.016, 0.001), 0.1);
    temps += dt;
    uVeg.uTemps.value = temps;
    if (Math.abs(e.distance - dVisible) > 40) dVisible = e.distance;
    else dVisible += (e.distance - dVisible) * (1 - Math.exp(-dt * 18));
    const d = dVisible;
    const base = Math.floor(d / PAS);
    if (base !== derniereBase) {
      if (derniereBase === null || Math.abs(base - derniereBase) > 3) { reconstruire(base, d); etapeR = 0; }   // départ ou saut : tout de suite
      else { reconstruire(base, d, 1); etapeR = 2; baseR = base; dR = d; }
      derniereBase = base;
    } else if (etapeR) { reconstruire(baseR, dR, etapeR); etapeR = etapeR === 2 ? 4 : etapeR === 4 ? 3 : 0; }

    const vit = e.vitesse || 0;
    const ratio = Math.max(0, e.ratio || 0);          // puissance / FTP
    let cad = e.cadence;
    if (!(cad > 0)) cad = (vit > 0.5 && ratio > 0.05) ? 62 + 28 * Math.min(ratio, 1.6) : 0;   // cadence estimée sans capteur
    angleRoue += (vit / 0.34) * dt;
    angleMan += cad * 0.10472 * dt;
    effort += (Math.min(ratio, 1.6) - effort) * (1 - Math.exp(-dt * 1.5));
    // l'avatar avance ou recule dans le champ de la caméra selon la puissance développée
    const cibleEcart = vit > 0.5 ? Math.min(3.5, Math.max(-2.4, (ratio - 0.65) * 4.5)) : -0.8;
    ecart += (cibleEcart - ecart) * (1 - Math.exp(-dt * 0.9));

    // cycliste : légèrement à droite de l'axe de la route
    const u = 0.9;
    const da = d + ecart;
    posChemin(da, _p);
    const h = cap(da), y = alt3d(da);
    const pente = Math.atan((alt3d(da + 3) - alt3d(da - 3)) / 6);
    cycliste.position.set(_p[0] + Math.cos(h) * u, y, _p[1] + Math.sin(h) * u);
    // léger balancement du vélo en rythme du pédalage, plus fort quand l'effort monte
    const roulis = cad > 0 ? Math.sin(angleMan) * (0.012 + 0.03 * Math.max(0, effort - 0.6) + 0.09 * stand) : 0;
    cycliste.rotation.set(pente, -h, roulis);
    if (ia.length) majIA(e, dt, d);
    try { majArches(d); } catch (err) { /* l'arche ne doit jamais bloquer le rendu */ }
    try { majPortiques(d); } catch (err) { /* idem pour les portiques des segments */ }
    const pctPente = Math.tan(pente) * 100;
    const cibleDanseuse = vit > 1 ? Math.max(Math.min(1, Math.max(0, (ratio - 1.05) / 0.3)), Math.min(1, Math.max(0, (pctPente - 6.5) / 3)) * (ratio > 0.5 ? 1 : 0)) : 0;
    stand += (cibleDanseuse - stand) * (1 - Math.exp(-dt * 2.2));
    animerCycliste(stand, effort, temps);
    majPoussiere(dt, vit, effort, stand, cycliste.position.x, cycliste.position.y, cycliste.position.z, h);

    // caméra derrière et au-dessus, qui suit la route
    const V = vue === "tv" ? vueTele(dt, d) : VUES[vue] || VUES.arriere;
    const cacher = !!V.torse;          // vue torse : on masque le haut du corps pour ne garder que les bras, les mains et le vélo
    visibiliteCorps(cacher);
    const ref = V.ref ? da : d;
    const dc = V.fixe !== undefined ? V.fixe : ref - V.back, hc = cap(dc);
    posChemin(dc, _p);
    let secY = 0, secR = 0;
    if (V.secousse) {             // vibrations de la caméra fixée au guidon
      const f = Math.min(vit / 8, 1);
      secY = f * (0.004 * Math.sin(temps * 31) + 0.0035 * Math.sin(temps * 17 + 1)) + 0.004 * Math.sin(angleMan * 2) * (cad > 0 ? 1 : 0);
      secR = f * 0.0025 * Math.sin(temps * 23);
    }
    if (e.vibre > 0) {            // (v69 suite) pavés et chemins : la caméra tressaute (plus vite on va, plus ça secoue)
      const f2 = Math.min(vit / 7, 1) * e.vibre;
      secY += f2 * (0.018 * Math.sin(temps * 53) + 0.012 * Math.sin(temps * 31 + 2.0) + 0.008 * Math.sin(temps * 89 + 1.0));
      secR += f2 * 0.004 * Math.sin(temps * 41 + 0.5);
    }
    const fovV = V.fov || 58;
    if (camera.fov !== fovV) { camera.fov = fovV; camera.updateProjectionMatrix(); }
    camera.position.set(_p[0] + Math.cos(hc) * (u + V.side), alt3d(dc) + V.up + secY, _p[1] + Math.sin(hc) * (u + V.side));
    const dl = ref + V.look, hl = cap(dl);
    posChemin(dl, _q);
    LT[0] = _q[0] + Math.cos(hl) * u; LT[1] = alt3d(dl) + V.lookUp + secR * 40; LT[2] = _q[1] + Math.sin(hl) * u;
    if (V.tv) { LT[0] = cycliste.position.x; LT[1] = cycliste.position.y + V.lookUp; LT[2] = cycliste.position.z; }   // télévision : toujours cadré sur toi

    if (corps.modeleH) {                 // vue action cam : la tête du nouveau corps (et ses yeux) disparaît, la caméra est à la place des yeux
      corps.modeleH.matCorps.userData.u.uSansTete.value = V.torse ? 1 : 0;
      corps.modeleH.mats[7].visible = corps.modeleH.mats[8].visible = !V.torse;
      corps.modeleH.visage.mesh.visible = !V.torse;
    }
    if (V.torse && corps.cam) {     // caméra fixée sur le torse : on voit les bras, le guidon et l'avant du vélo
      // (la tête du nouveau corps est masquée ; vu de l’intérieur, le buste est invisible) ; femme : caméra un peu plus en avant, devant son cou
      const lc = genre === "femme" && corpsReel() ? [corps.cam[0], corps.cam[1] + 0.01, corps.cam[2] - 0.06] : corps.cam;
      const fxv = Math.sin(h), fzv = -Math.cos(h), rx = Math.cos(h), rz = Math.sin(h);
      const sp = Math.sin(pente), cp = Math.cos(pente);
      const wx = cycliste.position.x + rx * lc[0] + fxv * (-lc[2]);
      const wz = cycliste.position.z + rz * lc[0] + fzv * (-lc[2]);
      const wy = cycliste.position.y + lc[1] * cp + (-lc[2]) * sp + secY;
      camera.position.set(wx, wy, wz);
      LT[0] = wx + fxv * 12; LT[1] = wy + 12 * Math.tan(pente) - 12 * 0.45 + secR * 40; LT[2] = wz + fzv * 12;
    }

    // arrivée dans le monde : la caméra descend d'une vue aérienne jusqu'à la vue choisie
    if (introT < INTRO_DUR) {
      introT += dt;
      const k = Math.min(1, introT / INTRO_DUR), e = 1 - Math.pow(1 - k, 3);
      const ax = cycliste.position.x - Math.sin(h) * 55 + Math.cos(h) * 30, ay = cycliste.position.y + 105, az = cycliste.position.z + Math.cos(h) * 55 + Math.sin(h) * 30;
      camera.position.set(ax + (camera.position.x - ax) * e, ay + (camera.position.y - ay) * e, az + (camera.position.z - az) * e);
      const bx = cycliste.position.x, by = cycliste.position.y + 0.9, bz = cycliste.position.z;
      LT[0] = bx + (LT[0] - bx) * e; LT[1] = by + (LT[1] - by) * e; LT[2] = bz + (LT[2] - bz) * e;
    }
    camera.lookAt(LT[0], LT[1], LT[2]);

    // lumière et ombres : la zone d'ombre suit le cycliste, un peu vers l'avant
    if (lumiere.castShadow) {
      const dm = d + 22, hm = cap(dm);
      posChemin(dm, _q);
      const tx = _q[0] + Math.cos(hm) * u, tz = _q[1] + Math.sin(hm) * u, ty = alt3d(dm);
      lumiere.target.position.set(tx, ty, tz);
      if (lumiere.target.updateMatrixWorld) lumiere.target.updateMatrixWorld();
      lumiere.position.set(tx + SUN.x * 160, ty + SUN.y * 160, tz + SUN.z * 160);
    }

    if (!GEO) suivreForet(foretTheme, dt);
    else suivreForet(foretReel, dt);
    majFoule(d);
    try { majPietons(d, dt); } catch (err) { /* les piétons ne doivent jamais bloquer le rendu */ }
    majSaisonFx(dt, camera.position);
    majMeteo(dt);
    majPluie(dt, vit, camera.position.x, camera.position.y, camera.position.z, h);
    ciel.position.copy(camera.position);
    if (fond && fond.visible) fond.position.set(camera.position.x, camera.position.y, camera.position.z);
    nuages.position.set(camera.position.x, 0, camera.position.z);
    nuages.rotation.y = temps * 0.004;
    soleil.position.set(camera.position.x + SUN.x * 850, camera.position.y + SUN.y * 850, camera.position.z + SUN.z * 850);
    if (lueur) lueur.position.copy(soleil.position);

    const c = e.canvas;
    if (c && c.clientWidth && (c.clientWidth !== taille[0] || c.clientHeight !== taille[1] || resH !== taille[2])) {
      taille = [c.clientWidth, c.clientHeight, resH];
      if (resH > 0) {
        renderer.setPixelRatio(1);
        renderer.setSize(Math.round(resH * taille[0] / taille[1]), resH, false);
      } else {
        renderer.setPixelRatio(ratioQ);
        renderer.setSize(taille[0], taille[1], false);
      }
      camera.aspect = taille[0] / taille[1];
      camera.updateProjectionMatrix();
    }
    renderer.render(scene, camera);
  }

  const api = {
    creer: creer,
    dessiner: dessiner,
    definirTheme: (nom) => { if (renderer) appliquerTheme(nom); },
    definirQualite: (q) => { if (renderer) definirQualite(q); },
    definirAvatar: (g, couleur) => {
      genre = g === "femme" ? "femme" : "homme";
      if (couleur !== undefined && matMaillot) matMaillot.color.set(couleur);
      appliquerApparence();
      if (!corps.epaules) return;
      const f = genre === "femme";
      corps.epaules.scale.set(f ? 1.3 : 1.6, 0.9, 1);
      corps.poitrine.scale.set(f ? 1.05 : 1.2, f ? 1.05 : 1, f ? 1.3 : 1.15);
      corps.bassin.scale.set(f ? 1.42 : 1.25, 1, 1);
    },
    definirApparence: (o) => {
      if (!o) return;
      for (const k of ["peau", "cheveux", "bas"]) if (o[k] !== undefined && isFinite(o[k])) apparence[k] = o[k] | 0;
      if (o.basStyle === "long" || o.basStyle === "cuissard") apparence.basStyle = o.basStyle;
      if (["court", "rase", "mi-long", "degarni", "chignon", "queue", "chauve"].includes(o.coiffure)) apparence.coiffure = o.coiffure;
      if (typeof o.velo === "string") apparence.velo = o.velo;                // vélo détaillé (js/velos.js) ou « simple »
      if (["35", "45", "50", "65", "disque"].includes(o.roues)) apparence.roues = o.roues;   // profil des jantes (disque : arrière lenticulaire)
      if (BARBES[o.barbe] !== undefined) apparence.barbe = o.barbe;
      if (o.chaussettes !== undefined && isFinite(o.chaussettes)) apparence.chaussettes = o.chaussettes | 0;
      if (o.yeux === "marron" || IRIS[o.yeux]) apparence.yeux = o.yeux;
      if (o.casqueCouleur !== undefined && isFinite(o.casqueCouleur)) apparence.casqueCouleur = o.casqueCouleur | 0;
      if (VERRES[o.verres]) apparence.verres = o.verres;
      if (o.casque !== undefined) apparence.casque = !!o.casque;
      if (o.lunettes !== undefined) apparence.lunettes = !!o.lunettes;
      if (o.realiste !== undefined) apparence.realiste = !!o.realiste;
      appliquerApparence();
    },
    definirSaison: (n, differe) => { if (n === "printemps" || n === "ete" || n === "automne" || n === "hiver") { saison = n; if (!differe && renderer && scene && th) appliquerTheme(themeNom); } },   // differe : appliquée au prochain definirTheme
    definirPeloton: (l) => definirPeloton(l),
    definirSegments: (l) => { segs3d = l || []; if (portiques) for (const p of portiques) p.d = -1; },
    // (v69) mesure : rend n images de suite à la taille w × h (attente de la carte graphique à chaque image), renvoie les ms par image
    mesurer: (n, w, h) => {
      if (!renderer) return null;
      const gl = renderer.getContext(), px = new Uint8Array(4), r0 = renderer.getPixelRatio(), s0 = renderer.getSize(new T.Vector2());
      renderer.setPixelRatio(1); renderer.setSize(w || 2560, h || 1440, false); camera.aspect = (w || 2560) / (h || 1440); camera.updateProjectionMatrix();
      renderer.render(scene, camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const t0 = performance.now();
      for (let i = 0; i < (n || 30); i++) { renderer.render(scene, camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
      const ms = (performance.now() - t0) / (n || 30);
      renderer.setPixelRatio(r0); renderer.setSize(s0.x, s0.y, false); taille = [0, 0, 0];
      return { ms: Math.round(ms * 10) / 10, ips: Math.round(1000 / ms), appels: renderer.info.render.calls, triangles: renderer.info.render.triangles };
    },
    definirIntro: () => { introT = 0; },
    definirVue: (v) => { if (VUES[v]) vue = v; },
    apercu: (cv, ang, veloSeul) => apercuAvatar(cv, ang, veloSeul),
    definirEffets: (o) => { if (o && o.pietons !== undefined) pietonsNiveau = o.pietons | 0; if (o && o.poussiere !== undefined) poussOn = !!o.poussiere; if (o && o.foule !== undefined) { fouleNiveau = o.foule | 0; fouleCle = ""; } },
    definirMeteo: (m) => { if (renderer) definirMeteo(m); },
    pluie: () => meteoVal.pluie,           // (v69) pour le son : intensité de la pluie (0 à 1) et nombre d’éclairs (le tonnerre suit chaque éclair)
    eclairs: () => nbEclairs,
    meteo: () => { const e = ETATS_METEO[meteoEtat] || ETATS_METEO.clair; return { etat: meteoEtat, nom: e.nom, ico: e.ico, auto: meteoMode === "auto" }; },
    definirResolution: (h) => { resH = h | 0; taille = [0, 0, 0]; },
    pos: (d) => { preparerRoute(); const p = posChemin(d, [0, 0]); return p; },
    alt: (d) => { preparerRoute(); return alt3d(d); },
    peindreCarte: peindreCarte,
    rafraichirMonde: () => { reelAFaire = true; },
    definirMoment: (nom) => { if (MOMENTS[nom]) momentNom = nom; appliquerMoment(); },
    themes: THEMES,
    disponible: () => typeof THREE !== "undefined"
  };
  return api;
})();


