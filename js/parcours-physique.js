"use strict";
/* =====================================================================
   Parcours
   ===================================================================== */
const SEGMENTS_DEMO = [[600,0],[900,3],[700,6],[500,10],[500,-5],[800,0],[700,8],[800,-8],[900,-5],[500,0],[900,-5]];

function construireRoute(nom, segments, boucle, alt0) {
  const points = [[0, alt0]];
  let x = 0, alt = alt0, dplus = 0;
  for (const [l, p] of segments) {
    x += l;
    const dh = l * p / 100;
    alt += dh;
    if (dh > 0) dplus += dh;
    points.push([x, alt]);
  }
  return { nom, segments, longueur: x, boucle, alt0, points, dplus };
}
let route = construireRoute("Parcours plat (sans dénivelé)", [[5000, 0], [5000, 0]], true, 0);

/* (v104) pente et altitude à une distance donnée : une table est calculée une fois par parcours, puis le tronçon est trouvé en coupant
   la liste en deux à chaque pas. Avant, tout le tracé était reparcouru à chaque appel (plus de 5 000 appels par seconde en course) :
   sur les longs parcours réels, environ 7 % du processeur au Mont Ventoux (1 342 tronçons). Les résultats sont les mêmes. */
const tablesRoute = new WeakMap();
function tableRoute(r) {
  let T = tablesRoute.get(r);
  if (T && T.seg === r.segments && T.n === r.segments.length && T.alt0 === r.alt0) return T;
  const seg = r.segments, n = seg.length, fin = new Float64Array(n), alt = new Float64Array(n + 1);
  let x = 0, a = r.alt0;
  alt[0] = a;
  for (let i = 0; i < n; i++) { x += seg[i][0]; a += seg[i][0] * seg[i][1] / 100; fin[i] = x; alt[i + 1] = a; }
  T = { seg, n, alt0: r.alt0, fin, alt };
  tablesRoute.set(r, T);
  return T;
}
function rangTroncon(T, d) {          // premier tronçon qui se termine après d (T.n si d est au-delà du tracé)
  let a = 0, b = T.n;
  while (a < b) { const m = (a + b) >> 1; if (d < T.fin[m]) b = m; else a = m + 1; }
  return a;
}
function penteRoute(r, distance) {
  const d = r.boucle ? distance % r.longueur : Math.min(distance, r.longueur - 0.01);
  const T = tableRoute(r), i = rangTroncon(T, d);
  return i < T.n ? r.segments[i][1] : 0;
}
function altitudeRoute(r, distance) {
  const d = r.boucle ? distance % r.longueur : Math.min(distance, r.longueur);
  const T = tableRoute(r), i = rangTroncon(T, d);
  return i < T.n ? T.alt[i] + (d - (i ? T.fin[i - 1] : 0)) * r.segments[i][1] / 100 : T.alt[T.n];
}
function penteA(distance) { return penteRoute(route, distance); }
function altitudeA(distance) { return altitudeRoute(route, distance); }
function majInfoParcours() {
  $("info-parcours").textContent = route.nom + " : " + (route.longueur / 1000).toFixed(1).replace(".", ",") +
    " km, dénivelé positif " + Math.round(route.dplus) + " m" + (route.boucle ? " (parcours en boucle)" : "");
}

/* ---------- Lecture d’un fichier GPX ---------- */
function distanceGps(lat1, lon1, lat2, lon2) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function routeDepuisGpx(texte, nom) {
  const doc = new DOMParser().parseFromString(texte, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("le fichier n’est pas un GPX valide.");
  let pts = Array.from(doc.querySelectorAll("trkpt"));
  if (pts.length < 2) pts = Array.from(doc.querySelectorAll("rtept"));
  pts = pts.filter((p) => isFinite(parseFloat(p.getAttribute("lat"))) && isFinite(parseFloat(p.getAttribute("lon"))));
  if (pts.length < 2) throw new Error("aucun tracé trouvé dans ce fichier.");

  const lat = [], lon = [], ele = [];
  let avecAltitude = 0;
  for (const p of pts) {
    lat.push(parseFloat(p.getAttribute("lat")));
    lon.push(parseFloat(p.getAttribute("lon")));
    const e = p.querySelector("ele");
    const v = e ? parseFloat(e.textContent) : NaN;
    if (!isNaN(v)) avecAltitude++;
    ele.push(v);
  }
  if (avecAltitude < pts.length * 0.5) throw new Error("ce fichier ne contient pas assez d’altitudes.");
  const premiere = ele.find((x) => !isNaN(x));
  for (let i = 0; i < ele.length; i++) if (isNaN(ele[i])) ele[i] = i > 0 ? ele[i - 1] : premiere;

  const n = pts.length, dist = [0];
  for (let i = 1; i < n; i++) dist.push(dist[i - 1] + distanceGps(lat[i - 1], lon[i - 1], lat[i], lon[i]));
  const total = dist[n - 1];
  if (total < 500) throw new Error("le tracé fait moins de 500 m.");

  const pas = 20, m = Math.floor(total / pas), alts = [];
  let j = 0;
  for (let k = 0; k <= m; k++) {
    const d = k * pas;
    while (j < n - 2 && dist[j + 1] < d) j++;
    const etendue = dist[j + 1] - dist[j];
    const f = etendue > 0 ? borner((d - dist[j]) / etendue, 0, 1) : 0;
    alts.push(ele[j] + (ele[j + 1] - ele[j]) * f);
  }
  const lisse = alts.map((_, k) => {
    let s = 0, c = 0;
    for (let q = k - 3; q <= k + 3; q++) if (q >= 0 && q < alts.length) { s += alts[q]; c++; }
    return s / c;
  });

  const segments = [], parSegment = 5;
  for (let k = 0; k < m; k += parSegment) {
    const k2 = Math.min(k + parSegment, m);
    const longueur = (k2 - k) * pas;
    if (longueur <= 0) break;
    segments.push([longueur, borner((lisse[k2] - lisse[k]) / longueur * 100, -20, 20)]);
  }
  return construireRoute(nom || "Parcours GPX", segments, false, lisse[0]);
}

$("fichier-gpx").addEventListener("change", async (e) => {
  const fichier = e.target.files[0];
  e.target.value = "";
  if (!fichier) return;
  if (session.samples.length > 0) {
    log("Termine ou abandonne d’abord la séance en cours avant de changer de parcours.");
    return;
  }
  try {
    route = routeDepuisGpx(await fichier.text(), fichier.name.replace(/\.gpx$/i, ""));
    balade.distance = 0; balade.vitesse = 0; balade.altitude = route.alt0;
    majInfoParcours();
    log("Parcours importé : " + route.nom + ".");
  } catch (err) {
    log("Import impossible : " + err.message);
  }
});
const routePlate = route;
$("btn-plat").addEventListener("click", () => {
  if (session.samples.length > 0) { log("Termine ou abandonne d’abord la séance en cours avant de changer de parcours."); return; }
  route = routePlate;
  balade.distance = 0; balade.vitesse = 0; balade.altitude = route.alt0;
  majInfoParcours();
});
$("btn-demo").addEventListener("click", () => {
  if (session.samples.length > 0) { log("Termine ou abandonne d’abord la séance en cours avant de changer de parcours."); return; }
  route = construireRoute("Parcours vallonné de démonstration", SEGMENTS_DEMO, true, 0);
  balade.distance = 0; balade.vitesse = 0; balade.altitude = route.alt0;
  majInfoParcours();
});

/* =====================================================================
   Balade, enregistrement et physique
   ===================================================================== */
/* =====================================================================
   Aérodynamisme : position, matériel, vent, aspiration, altitude, revêtement et pluie.
   Valeurs issues du tableau « Des watts à la vitesse ». S'applique à tous les mondes (y compris les futurs) :
   tout passe par la physique du cycliste (avancer) et celle des autres coureurs (Peloton).
   ===================================================================== */
const RESISTANCE_PLUS = 1.2;   // +20 % de résistance pour tout le monde : home trainer, ta vitesse et celle des autres coureurs
// ---- matériel (v66) : poids (kg) et gain sur la traînée de l'air (0,02 = −2 %) de chaque vélo (cadre, sans les roues) et de chaque paire de roues,
// par rapport au « vélo simple » à roues de 35 mm (8 kg en tout). Valeurs arrondies, proches des vélos réels. Le gain d'air est aussi envoyé
// au home trainer (avec le CdA) ; le poids ne joue que sur la vitesse dans le jeu (le home trainer ne le reçoit pas).
const PERF_VELOS = {
  simple: { masse: 6.7, aero: 0 }, mystero: { masse: 5.8, aero: 0.015 }, v5rs: { masse: 5.4, aero: 0.005 }, y1rs: { masse: 6.0, aero: 0.02 },
  melee: { masse: 5.6, aero: 0.01 }, dogma: { masse: 5.5, aero: 0.015 }, foil: { masse: 6.0, aero: 0.015 }, madone: { masse: 5.9, aero: 0.025 },
  // (v101) quatre vélos de route de plus (certains se débloquent avec les niveaux : js/deblocage.js)
  addict: { masse: 5.3, aero: 0.004 }, c68: { masse: 5.75, aero: 0.008 }, noah: { masse: 6.05, aero: 0.028 }, bmc: { masse: 5.75, aero: 0.027 },
  // contre-la-montre : le gain d'air comprend la position allongée sur les prolongateurs (≈ 20 % de traînée en moins), mais le vélo est plus lourd
  plasma: { masse: 7.6, aero: 0.20, clm: true }, speed: { masse: 7.5, aero: 0.205, clm: true }, triton: { masse: 7.4, aero: 0.20, clm: true }, tritonb: { masse: 7.4, aero: 0.20, clm: true }
};
// vélo de chrono en groupe (à moins de GROUPE_DIST m d'un autre coureur) : le coureur se relève sur les cornes (prolongateurs dangereux en peloton),
// il perd l'essentiel du gain d'air de la position chrono et profite moins bien de l'abri des autres (vélo nerveux, moins bien placé dans les roues)
const GROUPE_DIST = 12, MALUS_CLM_AIR = 0.8, MALUS_CLM_ABRI = 0.5;
const PERF_ROUES = { "35": { masse: 1.30, aero: 0 }, "45": { masse: 1.40, aero: 0.01 }, "50": { masse: 1.45, aero: 0.015 }, "65": { masse: 1.60, aero: 0.025 },
  disque: { masse: 1.95, aero: 0.035 },     // disque : avant de 65 mm, arrière lenticulaire
  // (v101) 15 paires d'après les photos : poids proches des fiches des fabricants (pour la paire), gain d'air estimé d'après la hauteur et la forme
  bora35: { masse: 1.37, aero: 0.006 }, enve40: { masse: 1.48, aero: 0.008 }, shamal: { masse: 1.46, aero: 0.012 },
  corima45: { masse: 1.40, aero: 0.011 }, cosmic45: { masse: 1.50, aero: 0.010 }, comete45: { masse: 1.42, aero: 0.011 }, lw_ob: { masse: 1.23, aero: 0.013 },
  streem45: { masse: 1.42, aero: 0.014 }, comete50: { masse: 1.46, aero: 0.015 }, duraace: { masse: 1.43, aero: 0.016 }, mavic52: { masse: 1.58, aero: 0.016 },
  zipp404: { masse: 1.53, aero: 0.021 }, streem60: { masse: 1.52, aero: 0.022 }, sharq: { masse: 1.52, aero: 0.023 }, wake6560: { masse: 1.45, aero: 0.027 } };
function materielVelo(velo, roues) {
  const v = PERF_VELOS[velo] || PERF_VELOS.simple, r = PERF_ROUES[roues] || PERF_ROUES["35"];
  return { masse: v.masse + r.masse, aero: v.aero + r.aero, clm: !!v.clm };
}
const Aero = (function () {
  const CDA = 0.34;                                        // position aux cocottes (m²)
  const CRR = { bitume: 0.0055, gravier: 0.0095, terre: 0.012, pave: 0.01224 };   // (v69 suite) pavés du Nord   // route.revetement : à renseigner pour un nouveau monde (bitume par défaut)
  const PLUIE_CRR = 1.12;                                  // chaussée mouillée : +12 % de résistance au roulement
  const DENSITE_PAR_160M = 0.02;                           // l'air s'allège de 2 % tous les 160 m de montée
  const VENT_SOL = 0.6;                                    // 60 % du vent météo à 1 m du sol
  const ABRI_VILLE = 0.45;                                 // entre les maisons, le vent est bien plus faible
  const ASPIRATION_MAX = 0.32;                             // réduction maximale de la traînée dans la roue d'un autre coureur
  const VENT_METEO = { clair: 3.5, nuageux: 5.5, brume: 2.2, pluie: 7, orage: 11 };   // m/s selon la météo du monde
  const reg = { vent: true, materiel: 0, velo: 0, masseVelo: 8, clm: false, groupe: 0, frein: true };   // frein : (v69 suite) freinage automatique avant les virages serrés   // velo : gain d'air du vélo et des roues ; masseVelo : leur poids (kg) ; groupe : 0 à 1 (vélo de chrono en groupe)
  const v = { dir: Math.random() * 6.283, vit: 3, t: 0, etat: "", face: 0 };
  const borner = (x, a, b) => Math.max(a, Math.min(b, x));

  function maj(dt, etat) {                                 // le vent suit la météo : force, rafales, direction qui évolue
    v.t += dt;
    if (reg.ventFixe) { v.dir = reg.ventFixe.dir; v.vit = reg.ventFixe.vit; v.etat = etat; return; }   // (v105) course de la semaine : même vent chez tout le monde
    if (etat !== v.etat) { if (v.etat) v.dir += (Math.random() - 0.5) * 2.2; v.etat = etat; }
    v.dir += (Math.random() - 0.5) * 0.06 * dt;
    const base = (VENT_METEO[etat] || 3.5) * (1 + 0.25 * Math.sin(v.t / 23) + 0.12 * Math.sin(v.t / 7.3));
    v.vit += (base - v.vit) * (1 - Math.exp(-dt / 10));
  }
  // composante du vent de face (m/s, positive = vent de face) pour un cycliste qui avance dans la direction cap = [x, z]
  function ventDeFace(cap, abriVille) {
    if (!reg.vent || !cap) return 0;
    const w = v.vit * VENT_SOL * (abriVille ? ABRI_VILLE : 1);
    return -w * (Math.cos(v.dir) * cap[0] + Math.sin(v.dir) * cap[1]);
  }
  function vecteur(abriVille) {                            // vent effectif (m/s) dans le repère du monde
    if (!reg.vent) return [0, 0];
    const w = v.vit * VENT_SOL * (abriVille ? ABRI_VILLE : 1);
    return [w * Math.cos(v.dir), w * Math.sin(v.dir)];
  }
  // facteur appliqué à la traînée derrière un autre coureur (entre 0,4 et 8 m, bien aligné) ; reduction max 32 %, 45 % derrière un véhicule
  function facteurAspiration(ecart, dLat, reductionMax) {
    if (ecart < 0.4 || ecart > 8) return 1;
    const fe = ecart <= 2 ? 1 : 1 - 0.75 * (ecart - 2) / 6;
    const fl = borner(1 - (Math.abs(dLat) - 0.45) / 0.75, 0, 1);
    return 1 - (reductionMax === undefined ? ASPIRATION_MAX : reductionMax) * fe * fl;
  }
  const densite = (alt) => 1.226 * Math.pow(1 - DENSITE_PAR_160M, Math.max(0, alt || 0) / 160);
  const roulement = (revetement, pluie) => (CRR[revetement] || CRR.bitume) * (pluie ? PLUIE_CRR : 1);
  const cdaUtilisateur = () => CDA * (1 - reg.materiel - reg.velo * (reg.clm ? 1 - MALUS_CLM_AIR * reg.groupe : 1));
  return { reg, v, maj, vecteur, ventDeFace, facteurAspiration, densite, roulement, cdaUtilisateur, CDA };
})();

/* =====================================================================
   Peloton : coureurs virtuels avec masse, puissance critique, réserve anaérobie (W'),
   fatigue, et tactiques propres à leur profil. Deux modes : sortie Z2 (groupe) et course.
   ===================================================================== */
const Peloton = (function () {
  // pmax : puissance de sprint max (en multiple de leur puissance critique) ; wpf : réserve anaérobie (W′) par rapport à celle de l'utilisateur, à poids égal ;
  // dura : perte de puissance critique après ~25 kJ/kg de travail (fatigue) ; cda : surface aérodynamique (m²)
  const TYPES = [
    { id: "grimpeur", nom: "Grimpeur", masse: 60, cda: 0.30, wpf: 0.85, pmax: 2.3, dura: 0.04, couleur: 0x9b59b6, voie: 0.25, ampleur: 0.9 },
    { id: "sprinteur", nom: "Sprinteur", masse: 84, cda: 0.36, wpf: 1.45, pmax: 3.5, dura: 0.10, couleur: 0xe74c3c, voie: 1.65, ampleur: 1.14 },
    { id: "baroudeur", nom: "Baroudeur", masse: 74, cda: 0.31, wpf: 1.0, pmax: 2.4, dura: 0.05, couleur: 0x16a085, voie: 0.6, ampleur: 1.0 },
    { id: "puncheur", nom: "Puncheur", masse: 69, cda: 0.32, wpf: 1.25, pmax: 2.8, dura: 0.08, couleur: 0xf1c40f, voie: 1.3, ampleur: 1.02 }
  ];
  // noms des coureurs virtuels : tirés au hasard à chaque sortie (prénom féminin pour les femmes, voir r.femme)
  const PRENOMS_H = ["Lucas", "Hugo", "Théo", "Louis", "Nathan", "Tom", "Jules", "Arthur", "Paul", "Maxime", "Antoine", "Julien", "Romain", "Bastien", "Kévin", "Mathis", "Enzo", "Rémi", "Mattéo", "Pierre", "Marco", "Lars", "Diego", "Jonas", "Tadej", "Wout", "Primo", "Remco", "Gabriel", "Samuel", "Axel", "Victor", "Noah", "Ethan", "Sacha", "Valentin", "Clément", "Florian", "Damien", "Yann", "Olivier", "Stefan", "Mario", "Tobias", "Mateo", "Ivan", "Felix", "Jorge"];
  const PRENOMS_F = ["Léa", "Chloé", "Manon", "Camille", "Inès", "Jade", "Louise", "Pauline", "Juliette", "Clara", "Marion", "Elisa", "Anna", "Lotte", "Demi", "Marta", "Eva", "Nina", "Sofia", "Hanna", "Lena", "Ines", "Alba"];
  const NOMS = ["Martin", "Bernard", "Dubois", "Laurent", "Moreau", "Girard", "Roux", "Fontaine", "Chevalier", "Garnier", "Lefèvre", "Faure", "Mercier", "Blanc", "Guérin", "Perrin", "Morel", "Boyer", "Colin", "Vidal", "Rossi", "Jansen", "Moreno", "Novak", "Berg", "Costa", "Keller", "Lambert", "Petit", "Simon", "Michel", "Leroy", "Andre", "Muller", "Weber", "Fischer", "Silva", "Ferrari", "Bianchi", "Haas", "Vogel", "Peeters", "Janssens", "Dumont", "Renard", "Marchand", "Colas", "Noël", "Brun", "Poulain", "Barre", "Chauvin", "Lemaire", "Olsen", "Berger", "Meyer"];
  const auHasard = (t, pris) => { let x, n = 0; do { x = t[Math.floor(Math.random() * t.length)]; } while (pris.has(x) && ++n < 50); pris.add(x); return x; };
    // (v86) difficulté = puissance des coureurs virtuels par rapport à ta FTP (en W/kg) : facile 80 %, normal 100 %, hardcore 115 % (± quelques % selon le coureur)
  const NIVEAUX = { facile: [-0.23, -0.17], equilibre: [-0.03, 0.03], expert: [0.12, 0.18] };
  // (v86) équipes : 8 équipes de 5 (la tienne = 0, avec 4 coéquipiers) quand la course se fait « en équipe »
  /* (v87) Équipes inspirées des équipes World Tour d'aujourd'hui (noms détournés, maillots d'après leurs couleurs 2026) ; 7 sont tirées au hasard à chaque Tour.
     kit : c1 = couleur du corps, c2 / c3 = couleurs secondaires, bas = cuissard, motif = dessin du maillot dans le shader de js/monde3d.js
     (0 uni, 1 manches, 2 une manche, 3 bas, 4 bande centrale, 5 dégradé, 6 bande à la poitrine, 7 manches et bas, 8 flammes). */
  const KITS_EQUIPES = [
    { nom: "Jayco Aurore", c1: 0x6b2fa8, c2: 0x7ce04b, c3: 0x4a1c80, bas: 0x2a1050, motif: 8 },
    { nom: "Bahreïn Vainqueur", c1: 0x101c3a, c2: 0x6ec6ff, bas: 0x101c3a, motif: 1 },
    { nom: "Alpin–Premier", c1: 0x1e63e0, c2: 0x7fb2ff, bas: 0x0f2a66, motif: 5 },
    { nom: "Décathlète CMA", c1: 0x14b8b0, c2: 0xe5383b, bas: 0x0f6d70, motif: 6 },
    { nom: "EF Éducation–FacilePoste", c1: 0xff5fa8, c2: 0xd63384, bas: 0x2b1030, motif: 4 },
    { nom: "Groupe Ama–FDJ Unis", c1: 0x4aa8ff, c2: 0xe63946, bas: 0x14307a, motif: 2 },
    { nom: "Lydl–Trak", c1: 0x2a5bd7, c2: 0xffd60a, bas: 0x1b2a6b, motif: 2 },
    { nom: "Uno-Y Mobilité", c1: 0xd62828, c2: 0xffd60a, bas: 0x1c1f26, motif: 1 },
    { nom: "Soudure Rapide-Pas", c1: 0x1d4ed8, c2: 0xc6ff00, bas: 0x1d2a6d, motif: 3 },
    { nom: "Mouvistar", c1: 0xf4f7fb, c2: 0x2563eb, bas: 0x1d3d9a, motif: 3 },
    { nom: "Taureau Rouge–Bora", c1: 0xf4f7fb, c2: 0x1f56c4, c3: 0xe5383b, bas: 0x1b2a6b, motif: 7 },
    { nom: "Émirats Team XRG", c1: 0xf4f7fb, c2: 0x1c1f26, c3: 0xd62828, bas: 0x1c1f26, motif: 7 },
    { nom: "Bourdon–Lease", c1: 0xffd60a, c2: 0x1c1f26, bas: 0x1c1f26, motif: 1 }
  ];
  const NOMS_EQUIPES = ["Ton équipe"].concat(KITS_EQUIPES.map((k) => k.nom));
  const COUL_EQUIPE0 = 0xff7a2f, MAX_IA = 39;   // 40 coureurs en tout, toi compris
  const G = 9.81, RENDEMENT = 0.975, VMAX = 19;
  const ALLURE_COURSE = 0.80;   // allure de croisière en course : 80 % de leur puissance critique (≈ FTP), modulée par la pente
  const RESERVE_IA = 0.80;      // réserve anaérobie (W′) des coureurs virtuels réduite de 20 %
  const borner = (x, a, b) => Math.max(a, Math.min(b, x));
  let tttC = false, equipesT = [];   // (v87) contre-la-montre par équipe
  const TEAM_INT = 120, GAP_EQ = 2.5, PULL = 30, RATE_SLOT = 1.2;   // départ d'une équipe toutes les 2 min ; écart entre deux coureurs de la file (m) ; relais (s) ; vitesse de changement de place (places/s)
  let enEquipeC = false, wpUser = 14841, coureurs = [], mode = "aucun", d0 = 0, L = 0, t = 0, parti = false, ftpUser = 200, poidsUser = 75, pente = () => 0;
  let graine = 1, user = { d: 0, v: 0, fin: null, vue: false };
  function alea() { graine |= 0; graine = graine + 0x6D2B79F5 | 0; let x = Math.imul(graine ^ graine >>> 15, 1 | graine); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; }

  // grille de départ : deux sur la ligne (avec toi, au milieu), puis des rangs de trois tous les 2,2 m
  const grille = (i) => i < 2 ? [0, i ? 1.75 : 0.05] : [-2.2 * (1 + Math.floor((i - 2) / 3)), [0.2, 0.9, 1.6][(i - 2) % 3]];
  // maillots : couleurs bien distinctes (pas d'orange, réservé à l'utilisateur), mélangées à chaque sortie
  const PALETTE = [0x9b59b6, 0xe74c3c, 0x16a085, 0xf1c40f, 0x2e86de, 0xe84393, 0x7bc043, 0x34495e, 0xecf0f1, 0x222831, 0x00cec9, 0x8e5a3c];
  let boucleC = false, toursC = 0;   // course sur une boucle : nombre de tours jusqu'à l'arrivée (0 = sans arrivée)
  // (v94) formats de course (js/formats.js) : `fmtHook` ajuste la puissance visée (cible), la ligne d'arrivée de chacun (fin) ; `lcFixe` = longueur imposée de la course (m)
  let fmtHook = null, lcFixe = 0;
  const sansFin = () => !lcFixe && boucleC && !toursC;
  const longueurCourse = () => lcFixe > 0 ? lcFixe : boucleC ? (toursC ? toursC * L : Infinity) : L - d0;
  const finDe = (r) => fmtHook && fmtHook.fin ? fmtHook.fin(r) : d0 + longueurCourse();   // aller simple : arrivée au bout du parcours, même avec un départ en cours de route
  // vélos des coureurs virtuels : même catégorie que celui de l'utilisateur (route ou contre-la-montre, suivie en direct),
  // modèle et roues choisis selon leur profil (poids et gain d'air de PERF_VELOS / PERF_ROUES, comme pour l'utilisateur)
  // (v101) sur route, plusieurs montages par profil (le premier est celui d'avant) : le coureur garde le sien, tiré d'après son allure (r.look)
  const VELOS_IA = {
    route: { grimpeur: [["v5rs", "35"], ["addict", "bora35"], ["v5rs", "corima45"], ["addict", "lw_ob"], ["c68", "shamal"]],
             sprinteur: [["foil", "65"], ["noah", "streem60"], ["bmc", "sharq"], ["foil", "zipp404"], ["noah", "mavic52"]],
             baroudeur: [["madone", "50"], ["c68", "duraace"], ["bmc", "wake6560"], ["madone", "comete50"], ["c68", "cosmic45"]],
             puncheur: [["dogma", "45"], ["addict", "comete45"], ["noah", "enve40"], ["dogma", "streem45"]] },
    clm: { grimpeur: [["triton", "65"]], sprinteur: [["speed", "disque"]], baroudeur: [["plasma", "65"]], puncheur: [["tritonb", "65"]] }
  };
  function veloIA(r) {
    const clm = !!(Aero.reg && Aero.reg.clm), l = VELOS_IA[clm ? "clm" : "route"][r.id] || [["simple", "35"]], v = l[(r.look >>> 4 || 0) % l.length], m = materielVelo(v[0], v[1]);
    r.clm = clm; r.velo = v[0]; r.roues = v[1]; r.masseVelo = m.masse; r.aeroVelo = m.aero;
  }
  // (v69 suite) coureurs tirés au hasard : profil, nom, femme ou homme, allure, maillot, x = place dans la fourchette du niveau (0 à 1) ;
  // gardés d'une étape à l'autre d'un Tour (o.equipe)
  function tirerEquipe(n, enEquipe, couleurUser, kitUser) {
    n = Math.max(1, Math.min(MAX_IA, n | 0 || 4));
    const pris = new Set(), couleurs = PALETTE.slice().sort(() => Math.random() - 0.5), l = []; let kitsT = null;
    for (let i = 0; i < n; i++) {
      const tp = i < TYPES.length ? TYPES[i] : TYPES[Math.floor(Math.random() * TYPES.length)], femme = Math.random() < 0.3;
      l.push({ id: tp.id, nom: auHasard(femme ? PRENOMS_F : PRENOMS_H, pris) + " " + auHasard(NOMS, pris), femme, look: Math.floor(Math.random() * 1e9),
               couleur: couleurs[i % couleurs.length], x: Math.random(), vb: i < TYPES.length ? 0 : (Math.random() - 0.5) * 0.5 });
      if (enEquipe) {
        const eq = i < 4 ? 0 : 1 + Math.floor((i - 4) / 5);
        if (!kitsT) kitsT = KITS_EQUIPES.slice().sort(() => Math.random() - 0.5);
        const kit = eq === 0 ? Object.assign({ motif: 0 }, kitUser, { c1: couleurUser || COUL_EQUIPE0 }) : kitsT[(eq - 1) % kitsT.length];   // tes coéquipiers portent ton maillot (et son motif, v105)
        l[i].eq = eq; l[i].kit = kit; l[i].couleur = kit.c1; l[i].nomEq = eq === 0 ? NOMS_EQUIPES[0] : kit.nom;
      }
    }
    return l;
  }
  function demarrer(o) {
    boucleC = !!o.boucle; toursC = boucleC ? Math.max(0, o.tours | 0) : 0;
    fmtHook = o.hook || null; lcFixe = o.longueurFixe || 0;
    if (o.mode === "clm" && boucleC) toursC = Math.max(1, toursC);    // contre-la-montre : toujours une arrivée
    mode = o.mode || "aucun"; d0 = o.d0 || 0; L = o.longueur || 0; pente = o.pente || (() => 0);
    ftpUser = o.ftp || 200; poidsUser = o.poids || 75; wpUser = o.wprime || 14841; t = 0; parti = false; coureurs = []; user = { d: d0, v: 0, fin: null, vue: false, voie: 0.9, pass: [0] };
    graine = o.graineFixe || (o.graine || 12345) + Math.round(ftpUser * 7 + poidsUser);   // (v105) graineFixe : mêmes attaques chez tout le monde
    if (mode === "aucun") return;
    const wkg = ftpUser / poidsUser, wpKg = wpUser / poidsUser, [lo, hi] = NIVEAUX[o.niveau] || NIVEAUX.equilibre;
    // o.nombre coureurs (4 à 12) : un de chaque profil, puis des profils tirés au hasard ; femme ou homme, maillot et allure au hasard
    const specs = Array.isArray(o.equipe) && o.equipe.length ? o.equipe : tirerEquipe(o.nombre, o.enEquipe);
    enEquipeC = specs.some((sp) => sp.eq !== undefined);
    // contre-la-montre (v86) : départs toutes les 30 s, TOUS les coureurs virtuels partent avant toi (tu pars en dernier, sur la rampe)
    const nAvant = specs.length;
    // (v87) contre-la-montre PAR ÉQUIPE : chaque équipe part d'un bloc toutes les 2 min (la tienne en dernier, avec toi), roule en file alignée et prend des relais
    const ttt = mode === "clm" && !!o.parEquipe && specs.some((sp) => sp.eq !== undefined);
    tttC = ttt; equipesT = [];
    const ordreEq = [];
    if (ttt) { for (const sp of specs) if (!ordreEq.includes(sp.eq)) ordreEq.push(sp.eq); const i0 = ordreEq.indexOf(0); if (i0 >= 0) ordreEq.splice(i0, 1); ordreEq.push(0); }
    const tdEq = (eq) => eq === 0 ? 0 : -TEAM_INT * (ordreEq.length - 1 - ordreEq.indexOf(eq));

    specs.forEach((sp, i) => {
      const tp = TYPES.find((x) => x.id === sp.id) || TYPES[0], femme = !!sp.femme, nom = sp.nom, G = grille(i);
      const delta = lo + (hi - lo) * (sp.x === undefined ? alea() : sp.x);   // écart de watts/kg par rapport à l'utilisateur
      const cp = wkg * (1 + delta) * tp.masse;
      const tDep = ttt ? tdEq(sp.eq) : mode === "clm" ? -30 * (nAvant - i) : 0;
      coureurs.push({ type: tp, id: tp.id, nom, femme, look: sp.look, eq: sp.eq, equipier: sp.eq === 0, kit: sp.kit, nomEq: sp.nomEq, eqT: ttt, slot: 0, slotCible: 0, lat: 0, couleur: sp.couleur, voie: mode === "clm" ? tp.voie : G[1], ampleur: tp.ampleur, masse: tp.masse, delta, wkg: wkg * (1 + delta),
        tDep, rangDep: i, pass: [0], partiClm: false,
        cp, wp: RESERVE_IA * tp.wpf * wpKg * tp.masse, wbal: RESERVE_IA * tp.wpf * wpKg * tp.masse, voieBase: borner(tp.voie + (sp.vb || 0), 0.1, 1.8), travail: 0, d: mode === "clm" ? d0 - 4 - 1.6 * i : d0 + G[0], v: 0, P: 0, cible: 0, cad: 0,
        vide: false, atk: null, cool: 30 + 40 * alea(), ech: false, echDeclenche: 0.12 + 0.3 * alea(), etat: "Au départ", tour: 0, fini: null, ndraft: 0, passe: null, vlat: 0,
        clm: false, grp: 0, velo: "simple", masseVelo: 8, aeroVelo: 0, roue: null, colle: null, prend: null, prendT: 0, prendCd: 0, tete: 0, relais: false, sucer: 0, echFaite: false });
    });
    if (ttt) {
      for (const eq of ordreEq) {
        const M = coureurs.filter((r) => r.eq === eq);
        if (!M.length) continue;
        const E = { eq, membres: M, tDep: M[0].tDep, nom: M[0].nomEq || ("Équipe " + eq), couleur: M[0].couleur, parti: false, d: 0, v: 0, relaisT: 0, rot: false, voie: 0.9 };
        M.forEach((r, k) => { r.slot = r.slotCible = k; r.lat = 0; });
        placerEquipe(E); equipesT.push(E);
      }
    }
    // contre-la-montre : ceux qui sont partis avant toi ont déjà roulé (30 s, 60 s… d'avance) quand tu t'élances

    if (mode === "clm") {
      t = Math.min(0, ...coureurs.map((r) => r.tDep));
      while (t < -1e-6) { const h = Math.min(0.25, -t); t += h; pas(h); }
      t = 0;
    }
  }
  /* ---------- (v87) Contre-la-montre par équipe : file alignée, relais, aspiration ----------
     Chaque équipe avance comme un bloc (une vitesse pour toute la file). La vitesse vient de la puissance visée par chaque coureur (comme en individuel)
     contre la somme des résistances de l'air, qui dépend de la place dans la file (le premier n'est pas abrité, les suivants le sont, bien alignés à ~0,5 m de roue).
     Le premier prend un relais de 30 s (ou moins s'il s'épuise), puis se décale sur le côté et se rabat en queue de file pendant que les autres avancent d'une place. */
  function placerEquipe(E) {
    const n = E.membres.length;
    // (v89) même place de départ pour toutes les équipes : le dernier d'une file de 5 est sur la ligne (pour la tienne, c'est toi ; avant, ta file partait devant la ligne et gagnait ~1 s)
    E.d = d0 + (n + (E.eq === 0 ? 1 : 0) - 1) * GAP_EQ;
    for (const r of E.membres) { r.d = E.d - r.slot * GAP_EQ; r.v = 0; r.P = 0; r.cad = 0; r.voie = E.voie; r.lat = 0; }
  }
  function pasEquipe(E, dt) {
    const M = E.membres, n = M.length;
    if (t < E.tDep) { placerEquipe(E); for (const r of M) r.etat = "Départ dans " + Math.ceil(E.tDep - t) + " s"; return; }
    if (!E.parti) { E.parti = true; placerEquipe(E); for (const r of M) { r.partiClm = true; r.pass = [0]; } }
    const tousFinis = M.every((r) => r.fini !== null);
    // relais : le premier se rabat quand son tour est fini ou qu'il est fatigué (sauf près de l'arrivée)
    if (!tousFinis) {
      E.relaisT += dt;
      const chef = M.reduce((a, r) => (r.slotCible < a.slotCible ? r : a), M[0]);
      if (!E.rot && n >= 3 && d0 + longueurCourse() - E.d > 500 && (E.relaisT > PULL || chef.wbal < chef.wp * 0.3)) {
        E.rot = true; E.relaisT = 0;
        for (const r of M) r.slotCible = r === chef ? n - 1 : r.slotCible - 1;
      }
    }
    let bouge = false;
    for (const r of M) {
      const dl = r.slotCible - r.slot;
      if (Math.abs(dl) > 0.001) { r.slot += borner(dl, -RATE_SLOT * dt, RATE_SLOT * dt); bouge = true; }
      const recule = E.rot && r.slotCible === n - 1 && r.slot < n - 1 - 0.2;       // celui qui se rabat longe la file par l'extérieur
      r.lat += ((recule ? 0.9 : 0) - r.lat) * Math.min(1, dt * 3);
      r.voie = borner(E.voie + r.lat, 0.05, 1.85);
    }
    if (E.rot && !bouge) E.rot = false;
    const ordre = M.slice().sort((a, b) => a.slot - b.slot), v = E.v;
    let sumP = 0, sumM = 0, sumR = 0;
    const det = [];
    for (const r of ordre) {
      r.d = E.d - r.slot * GAP_EQ; r.v = v; r.grp = 0;
      let ab = 1;
      for (const o of ordre) if (o.slot < r.slot - 0.01) ab = Math.min(ab, Aero.facteurAspiration((r.slot - o.slot) * GAP_EQ, r.lat - o.lat));
      const m = r.masse + r.masseVelo, ang = Math.atan(pente(r.d) / 100), va = v + ctx.vent(r.d);
      const res = (m * G * (Math.sin(ang) + crrA(r.d) * Math.cos(ang)) + 0.5 * ctx.rho * cdaIA(r) * ab * va * Math.abs(va)) * RESISTANCE_PLUS;
      const cib = r.fini !== null ? cpEff(r) * 0.35 : Math.min(cibleClm(r), plafond(r));
      det.push({ r, m, res, ab }); sumP += cib; sumM += m; sumR += res;
    }
    let a;
    if (tousFinis) a = -0.3 * v;
    else { const frein = v > VMAX ? (v - VMAX) * 40 * n : 0; a = ((sumP * RENDEMENT) / Math.max(v, 1) - sumR - frein) / sumM; }
    E.v = Math.max(0, v + a * dt);
    if (ctx.vsure) { const vc = ctx.vsure(E.d, E.v); if (E.v > vc) E.v = Math.max(vc, E.v - 6 * dt); }
    E.d += E.v * dt;
    for (const { r, m, res, ab } of det) {
      const besoin = tousFinis ? 0 : Math.max(0, (res * E.v + m * a * E.v) / RENDEMENT);
      r.P += (Math.min(besoin, plafond(r)) - r.P) * (1 - Math.exp(-dt / 0.8));
      const cp = cpEff(r);
      majReserve(r, cp, dt); r.travail += r.P * dt;
      r.v = E.v; r.d = E.d - r.slot * GAP_EQ; r.ab = ab; r.cad = r.v > 0.5 ? borner(72 + 22 * (r.P / cp - 0.6), 60, 112) : 0;
      r.etat = r.fini !== null ? "Arrivé" : r.slot < 0.5 ? "En relais" : r.lat > 0.3 ? "Se rabat" : "Dans la roue";
      while (r.d - d0 >= r.pass.length * PASSAGE && r.pass.length < 20000) r.pass.push(t - E.tDep);
      if (r.fini === null && r.d >= d0 + longueurCourse()) r.fini = t - E.tDep;
    }
  }
  // temps d'une équipe = celui du 4e coureur à l'arrivée (4 sur 5) ; au point de chrono k : le 4e à y passer
  function tempsEquipeFinal(E) {
    const l = E.membres.map((r) => (r.fini === null ? Infinity : r.fini));
    if (E.eq === 0) l.push(user.fin === null ? Infinity : user.fin);
    l.sort((a, b) => a - b);
    return l[Math.min(3, l.length - 1)];
  }
  function passEq(E, k) {
    const l = E.membres.filter((r) => r.pass.length > k).map((r) => r.pass[k]);
    if (E.eq === 0 && user.pass.length > k) l.push(user.pass[k]);
    const need = Math.min(4, E.membres.length + (E.eq === 0 ? 1 : 0));
    if (l.length < need) return null;
    return l.sort((a, b) => a - b)[need - 1];
  }
  const tempsEquipes = () => { const o = {}; for (const E of equipesT) o[E.eq] = tempsEquipeFinal(E); return o; };
  const equipiers = () => tttC || enEquipeC ? coureurs.filter((r) => r.eq === 0).map((r) => ({ nom: r.nom, ecart: r.d - user.d })).sort((a, b) => b.ecart - a.ecart) : [];

  // (v69 suite) contre-la-montre : allure tenue jusqu'à l'arrivée (≈ 107 % du FTP pour 20 min, 100 % pour une heure), plus fort en montée, réserve vidée à la fin
  function cibleClm(r, fin) {
    const rest = (fin === undefined ? d0 + longueurCourse() : fin) - r.d, g = pente(r.d), cp = cpEff(r);
    if (rest <= 0) { r.etat = "Arrivé"; return cp * 0.4; }
    const T = rest / Math.max(r.v, 7), pct = borner(1 - 0.045 * Math.log2(T / 3600), 0.85, 1.15);
    let p = pct * cp * (1 + 0.08 * borner(g / 6, -1.5, 1));
    r.etat = "Chrono";
    if (rest < 1500) { const tf = Math.max(rest / Math.max(r.v, 8), 1); p = Math.max(p, cp + 0.7 * Math.max(r.wbal, 0) / tf); r.etat = "Derniers mètres"; }
    return p;
  }

  const cpEff = (r) => r.cp * (1 - r.type.dura * Math.min(1, r.travail / 1000 / r.masse / 25));
  // (v93) réserve anaérobie (W′) plus réaliste :
  //  - on la vide au-dessus de la puissance critique, on la reconstitue au-dessous avec la vitesse de Skiba (plus on roule doucement, plus c'est rapide :
  //    constante de temps 316 s à l'arrêt, plus de 800 s juste sous la puissance critique) ;
  //  - la fatigue accumulée réduit aussi le réservoir (jusqu'à −35 % après 30 kJ/kg) : on ne retrouve plus une réserve pleine en fin de course ;
  //  - un coureur qui vide son réservoir « craque » : il reste limité à 90 % de sa puissance critique tant qu'il n'a pas retrouvé 20 % de réserve.
  const fatigueW = (r) => Math.min(1, r.travail / 1000 / r.masse / 30);
  const wpMax = (r) => r.wp * (1 - 0.35 * fatigueW(r));
  function majReserve(r, cp, dt) {
    if (r.P > cp) r.wbal -= (r.P - cp) * dt;
    else {
      const tau = 546 * Math.exp(-0.01 * (cp - r.P)) + 316;
      r.wbal += (wpMax(r) - r.wbal) * (1 - Math.exp(-dt / tau));
    }
    r.wbal = borner(r.wbal, 0, wpMax(r));
    if (r.wbal <= 0) r.vide = true; else if (r.vide && r.wbal > 0.2 * r.wp) r.vide = false;
  }
  function plafond(r) {                       // puissance maximale disponible compte tenu de la réserve restante
    const cp = cpEff(r), f = Math.max(0, r.wbal) / r.wp;
    return r.vide ? cp * 0.9 : cp + (r.type.pmax * cp - cp) * Math.sqrt(f);
  }
  // aspiration : réduction de traînée derrière un autre coureur (ou l'utilisateur), selon la distance et l'alignement
  function abri(r, tous) {
    let meilleur = 1;
    for (const o of tous) {
      if (o === r) continue;
      meilleur = Math.min(meilleur, Aero.facteurAspiration(o.d - r.d, (o.voie === undefined ? 0.9 : o.voie) - r.voie));
    }
    return meilleur;
  }
  function abriPour(d, voie) {                 // pour l'utilisateur : abri derrière les coureurs virtuels
    let meilleur = 1;
    for (const o of coureurs) { if (tttC && o.eq !== 0) continue; meilleur = Math.min(meilleur, Aero.facteurAspiration(o.d - d, o.voie - voie)); }   // (v87) CLM par équipe : seulement l'abri de tes coéquipiers
    return meilleur;
  }
  function procheDe(d, dist) {                 // un coureur virtuel à moins de dist mètres (devant ou derrière) ?
    for (const o of coureurs) if (!o.fini && Math.abs(o.d - d) < dist) return true;
    return false;
  }
  // conditions du moment fournies par la page : densité de l'air, résistance au roulement, vent de face selon la position
  const ctx = { rho: 1.226, crr: 0.0055, vent: () => 0 };
  function regler(o) { Object.assign(ctx, o); }
  const crrA = (d) => ctx.crrA ? ctx.crrA(d) : ctx.crr;   // résistance au roulement à la place du coureur (chemin blanc compris)

  function cibleZ2(r) {
    const g = pente(r.d), cp = cpEff(r);
    // endurance cool, en pourcentage du FTP : 55 % sur les 50 premiers mètres, puis 50-55 % de croisière, jusqu'à 60 % dans les montées
    let pct = 0.50 + 0.05 * borner(g / 3, 0, 1) + 0.05 * borner((g - 3) / 3, 0, 1);
    r.etat = "Endurance";
    if (r.d - d0 < 50) { pct = 0.55; r.etat = "Départ tranquille"; }
    let p = pct * cp;
    // on reste à moins de 100 m de l'utilisateur : on ralentit si on a trop d'avance, on accélère si on est distancé
    if (user.vue) {
      const ecart = r.d - user.d;
      if (ecart > 100) { p *= borner(1 - (ecart - 100) / 60, 0, 1); r.etat = "Ralentit pour t'attendre"; }
      else if (ecart < -100) { p = Math.min(cp * 0.85, p * (1 + borner((-ecart - 100) / 80, 0, 1) * 0.7)); r.etat = "Revient dans ta roue"; }
    }
    return p;
  }

  function cibleCourse(r, dt) {
    const tour = boucleC && L > 0 ? Math.floor(Math.max(0, r.d - d0) / L) : 0;
    // tactique pensée pour toute la course (une échappée, une finale, un sprint à l'arrivée) ; sans arrivée, chaque tour est une étape sans sprint
    const seg = sansFin();
    if (tour !== r.tour) {                                                   // nouveau tour : on peut de nouveau attaquer
      r.tour = tour; r.cool = 30 + 40 * alea(); r.atk = null; r.tete = 0; r.relais = false;
      if (seg) { r.ech = false; r.echDeclenche = 0.12 + 0.3 * alea(); r.echFaite = false; }
    }
    const Ls = seg ? L : longueurCourse(), dl0 = seg ? d0 + tour * L : d0, rest = dl0 + Ls - r.d, g = pente(r.d), cp = cpEff(r), tp = r.type.id, frac = (r.d - dl0) / Ls;
    if (rest <= 0) { r.etat = "Arrivé"; return cp * 0.4; }
    // allure selon la durée restante (sans arrivée : comme pour une heure de course)
    const T = seg ? 3600 : rest / Math.max(r.v, 7), fs = borner(1 - 0.07 * Math.log2(Math.max(T, 1200) / 1200), 0.66, 1);
    let p = ALLURE_COURSE * cp * (1 + 0.12 * borner(g / 6, -1.5, 1));
    r.etat = "Dans le peloton"; r.cool -= dt;
    // attaques selon le profil
    if (r.atk) {
      const stop = (tp === "grimpeur" && (g < 2.5 || r.wbal < 0.3 * r.wp)) || (tp === "puncheur" && (g < 3 || r.wbal < 0.4 * r.wp));
      if (stop) { r.atk = null; r.cool = 300 + 200 * alea(); } else { p = Math.min(cp * r.atk, plafond(r)); r.etat = "Attaque !"; }
    } else if (r.cool <= 0 && frac < 0.93) {
      if (tp === "grimpeur" && g >= 4.5 && r.wbal > 0.75 * r.wp) r.atk = 1.15;
      else if (tp === "puncheur" && g >= 6 && r.wbal > 0.6 * r.wp) r.atk = 1.4;
    }
    if (tp === "baroudeur" && !r.ech && !r.echFaite && !r.fini && frac > r.echDeclenche && frac < 0.55 && r.wbal > 0.7 * r.wp) { r.ech = true; }
    if (tp === "baroudeur" && r.ech && frac < 0.97) {
      if (r.wbal > 0.25 * r.wp) { p = Math.max(p, cp * 1.08); r.etat = "Échappée"; }
      else if (coureurs.concat(user.vue ? [user] : []).some((x) => x !== r && x.d > r.d - 20)) { r.ech = false; r.echFaite = true; }   // réserve vide et repris : fin de l'échappée
      else { p = Math.max(p, fs * cp * 1.0); r.etat = "Seul en tête"; }
    }
    // finale : on dépense la réserve, puis sprint
    const finale = !seg && rest < 2500;
    if (finale) {
      const tf = Math.max(rest / Math.max(r.v, 8), 1);
      p = Math.max(p, cp + 0.8 * Math.max(r.wbal, 0) / tf);
      r.etat = "Finale";
    }
    const sprint = tp === "sprinteur" ? 380 : tp === "puncheur" ? 300 : 230;
    if (!seg && rest < sprint) { p = plafond(r) * 0.98; r.etat = "Sprint !"; }
    // jeu de peloton (vélos de route seulement : l'aspiration est interdite en triathlon), sauf pendant une attaque, une échappée ou le sprint
    if (!r.clm && (r.etat === "Dans le peloton" || r.etat === "Seul en tête" || r.etat === "Finale")) p = jeuPeloton(r, p, frac, finale, dt);
    else { r.roue = null; r.colle = null; r.prend = null; r.tete = 0; r.relais = false; }
    return Math.min(p, plafond(r));
  }

  // puissance qu'il faut à un coureur pour rouler à la vitesse v avec l'abri ab (même physique que pas() ; acc : avec la mise en vitesse en ~6 s)
  const cdaIA = (r) => r.type.cda * (1 - r.aeroVelo * (r.clm ? 1 - MALUS_CLM_AIR * r.grp : 1));
  function puissancePour(r, v, ab, acc) {
    const m = r.masse + r.masseVelo, ang = Math.atan(pente(r.d) / 100), va = v + ctx.vent(r.d);
    const res = (m * G * (Math.sin(ang) + crrA(r.d) * Math.cos(ang)) + 0.5 * ctx.rho * cdaIA(r) * ab * va * Math.abs(va)) * RESISTANCE_PLUS;
    return Math.max(0, (res + (acc ? m * (v - r.v) / 6 : 0)) * v / RENDEMENT);
  }
  // jeu de peloton : se mettre dans la roue de celui qui précède (coureur virtuel ou utilisateur), prendre des relais à tour de rôle,
  // suivre ou chasser une attaque tant que la réserve le permet, décrocher sinon, et attendre le groupe quand on est seul devant et fatigué
  const ROUE = 2.3, PASSAGE = 100;     // ROUE : écart visé derrière la roue (m) ; PASSAGE : points de chrono du contre-la-montre (m)
  const RELAIS = { grimpeur: 25, sprinteur: 10, baroudeur: 50, puncheur: 30 }; // durée d'un relais en tête (s)
  function jeuPeloton(r, p, frac, finale, dt) {
    const cp = cpEff(r), f = Math.max(0, r.wbal) / r.wp, tous = coureurs.concat(user.vue ? [user] : []);
    let o = null, e = 150, colle = false, nDerriere = 0, eb = 999;
    for (const x of tous) {
      if (x === r || (x === user ? user.fin !== null : x.fini !== null)) continue;
      const ec = x.d - r.d;
      if (ec > 0.3 && ec < e) { e = ec; o = x; }
      else if (ec <= 0.3) {
        if (ec > -4) colle = true;                                           // quelqu'un dans ma roue (ou à ma hauteur)
        if (ec > -80) { nDerriere++; eb = Math.min(eb, -ec); }
      }
    }
    // une échappée devant (à plus de 25 m) dans le dernier tiers : le groupe organise la chasse
    const chasse = frac > 0.6 && f > 0.35 && coureurs.some((x) => x !== r && (x.etat === "Échappée" || x.etat === "Seul en tête") && x.d - r.d > 25 && x.d - r.d < 1500);
    if (chasse) p = Math.max(p, cp * 1.05);
    // dépassement pour prendre le relais : terminé quand on a passé l'autre (ou abandonné s'il s'est envolé)
    if (r.prend && (r.prend.d < r.d - 3 || r.prend.d - r.d > 20)) r.prend = null;
    r.prendCd = Math.max(0, (r.prendCd || 0) - dt);
    r.roue = null; r.colle = null;
    if (o && o === r.prend) {
      r.prendT += dt;
      if (r.prendT < 20) { r.etat = "Prend le relais"; return p; }
      r.prend = null; r.prendCd = 30;                                        // pas réussi à passer en 20 s : on reste dans la roue
    }
    if (!o) {                                                                // en tête
      if (finale) return p;
      if (colle) {
        r.tete += dt;
        if (r.relais && r.tete > RELAIS[r.type.id] + 15) { r.relais = false; r.tete = 0; }   // personne ne passe : on repart pour un relais
        if (r.relais || r.tete > RELAIS[r.type.id]) { r.relais = true; r.etat = "Relais"; return p * 0.78; }   // on se relève pour laisser passer le suivant
        r.etat = chasse ? "Mène la chasse" : "Mène le groupe"; return p;
      }
      r.tete = 0; r.relais = false;
      // seul devant, la réserve entamée, un groupe pas loin derrière : mieux vaut l'attendre et rouler à l'abri
      if (frac < 0.85 && f < 0.5 && nDerriere >= 2 && eb > 15) { r.etat = "Attend le groupe"; return p * 0.85; }
      return p;
    }
    r.tete = 0; r.relais = false;
    const ab = Aero.facteurAspiration(e, (o.voie === undefined ? 0.9 : o.voie) - r.voie);
    const vdes = Math.max(0, o.v + borner((e - ROUE) * 0.15, -1, 1));      // vitesse pour revenir (ou rester) à ROUE mètres derrière
    const pf = puissancePour(r, vdes, ab, true);
    if (e < 25) r.roue = o;                                                   // on se cale dans son couloir (aussi pour revenir à l'abri)
    if (finale) {                                                             // finale : le sprinteur reste dans les roues, les autres roulent fort
      if (e >= 25) return p;
      const pr = Math.min(pf, plafond(r));
      if (r.type.id === "sprinteur") { r.etat = "Dans la roue"; return pr; }
      return Math.max(p, pr);
    }
    // celui de devant passe son relais, ou l'utilisateur se relève : on le double et on prend la tête
    // l'utilisateur mène depuis un moment avec ce coureur dans sa roue : il vient prendre un relais (rarement le sprinteur)
    r.sucer = o === user && e < 5 && !coureurs.some((x) => x.d > user.d && x.d - user.d < 12) ? (r.sucer || 0) + dt : 0;
    const attente = chasse ? 15 : RELAIS[r.type.id] * (r.type.id === "sprinteur" ? 8 : 1.5);
    // ou celui que je suis est lâché par ceux de devant alors que j'ai plus de réserve : je le double pour chasser moi-même (jamais dans les 400 premiers mètres : départ groupé)
    const lache = (o.etat === "Décroche" || o.etat === "Chasse") && f > 0.3 && f > o.wbal / o.wp + 0.1;
    if (e < 12 && !r.prendCd && r.d - d0 > 400 && (o.relais || lache || r.sucer > attente || puissancePour(r, o.v, 1, false) < 0.7 * p)) { r.prend = o; r.prendT = 0; r.roue = null; r.etat = "Prend le relais"; return p; }
    if (e < 25) {                                                             // on s'accroche à la roue (on suit une attaque tant que la réserve le permet)
      const lim = f > 0.3 ? (e < 6 ? plafond(r) : Math.min(plafond(r), cp * 1.25)) : cp * 1.02;   // on saute dans la roue ; un trou se bouche plus calmement
      // décroche seulement si même rouler à sa vitesse, à l'abri, demande plus que ce qu'on peut donner
      if (puissancePour(r, o.v, ab, false) <= lim) { r.etat = o === user ? "Dans ta roue" : "Dans la roue"; if (e < 8) r.colle = o; return Math.min(pf, lim); }
      r.etat = "Décroche"; return lim;
    }
    // plus loin : on chasse, sauf une échappée du baroudeur en début de tour, qu'on laisse filer (le peloton roule à son rythme)
    const filer = (o.etat === "Échappée" || o.etat === "Seul en tête") && frac < 0.6;
    const lim = filer ? p : Math.max(p, f > 0.5 ? cp * 1.12 : cp);
    r.etat = filer ? "Laisse filer" : "Chasse";
    return Math.min(pf, lim);
  }

  // évitement : le coureur qui rattrape un autre se décale pour le dépasser ; deux coureurs ne peuvent pas se traverser
  const VOIE_MIN = 0.05, VOIE_MAX = 1.85, LARGEUR = 0.8, DISTANCE_MIN = 1.9;
  function eviter(dt) {
    const tous = coureurs.concat(user.vue ? [user] : []);
    for (const r of coureurs) {
      if (r.eqT) continue;                                // (v87) file d'équipe alignée : pas de dépassement
      // 1) fin d'un dépassement en cours : on garde le même côté jusqu'à avoir dégagé, sans changer d'avis
      if (r.passe) {
        const o = r.passe.o, e = o.d - r.d;
        r.passe.t += dt;
        const degage = r.passe.role === "dep" ? e < (o === user ? -4 : -1.5) : e > 4;   // un coureur virtuel dépassé se range derrière
        if ((degage && r.passe.t > 1.5) || r.passe.t > 25) r.passe = null;
      }
      // 2) nouveau dépassement : je rattrape quelqu'un qui est dans mon couloir, ou l'utilisateur me rattrape
      if (!r.passe) {
        for (const o of tous) {
          if (o === r) continue;
          const e = o.d - r.d, dv = r.voie - o.voie;
          // (aussi quand je suis bloqué juste derrière quelqu'un que je ne veux pas suivre : le contact m'empêche d'aller plus vite que lui)
          const dep = (e > 0 && e < 9 && r.roue !== o && (r.v > o.v + 0.3 || (mode === "course" && e < DISTANCE_MIN + 0.6))) || (r.prend === o && e > -1 && e < 12), subi = o === user && e < 0 && e > -9 && o.v > r.v + 0.3;
          if ((dep || subi) && Math.abs(dv) < LARGEUR) {
            let cote = Math.abs(dv) < 0.05 ? (r.voieBase < 0.95 ? 1 : -1) : (dv > 0 ? 1 : -1);
            if (o.voie + cote * (LARGEUR + 0.15) > VOIE_MAX || o.voie + cote * (LARGEUR + 0.15) < VOIE_MIN) cote = -cote;
            r.passe = { o, cote, role: dep ? "dep" : "subi", t: 0 };
            break;
          }
        }
      }
      const cible = r.passe ? borner(r.passe.o.voie + r.passe.cote * (LARGEUR + 0.15), VOIE_MIN, VOIE_MAX)
        : r.roue ? borner(r.roue.voie === undefined ? 0.9 : r.roue.voie, VOIE_MIN, VOIE_MAX) : r.voieBase;   // dans la roue : même couloir que celui de devant
      // déplacement latéral progressif (accélération limitée) : pas de saut d'un côté à l'autre
      r.vlat += borner((cible - r.voie) * 1.8 - r.vlat, -2.2 * dt, 2.2 * dt);
      r.vlat = borner(r.vlat, -1.1, 1.1);
      r.voie = borner(r.voie + r.vlat * dt, VOIE_MIN, VOIE_MAX);
    }
    // celui qui suit une roue ne la dépasse pas par l'arrière (l'aspiration le rend plus rapide) : il reste derrière, à sa vitesse
    for (const r of coureurs) {
      const o = r.roue;
      if (o && !r.passe && Math.abs((o.voie === undefined ? 0.9 : o.voie) - r.voie) < 0.6 && r.d > o.d - DISTANCE_MIN) { r.v = Math.min(r.v, o.v); r.d -= (r.d - o.d + DISTANCE_MIN) * Math.min(1, 5 * dt); }
    }
    // contact : on ne traverse pas celui qui est devant dans le même couloir (recul progressif, jamais de saut)
    const ordre = tous.slice().sort((a, b) => b.d - a.d);
    for (let i = 0; i < ordre.length; i++) {
      const b = ordre[i];
      if (b === user) continue;
      for (let j = 0; j < i; j++) {
        const f = ordre[j], gap = f.d - b.d;
        if (Math.abs(f.voie - b.voie) < 0.6 && gap < DISTANCE_MIN) {
          b.d -= (DISTANCE_MIN - gap) * Math.min(1, 5 * dt);
          if (b.v > f.v) b.v = Math.max(f.v * 0.995, b.v - 6 * dt);
        }
      }
    }
  }

  function pas(dt) {
    const tous = coureurs.concat(user.vue ? [user] : []);
    for (const r of coureurs) veloIA(r);
    if (tttC) for (const E of equipesT) pasEquipe(E, dt);
    for (const r of coureurs) {
      if (r.eqT) continue;                                // (v87) coureurs d'une équipe : pasEquipe s'en occupe
      if (mode === "clm" && t < r.tDep) {                 // contre-la-montre : attend son départ derrière la ligne
        r.v = 0; r.P = 0; r.cad = 0; r.d = d0 - 4 - 1.6 * r.rangDep; r.etat = "Départ dans " + Math.ceil(r.tDep - t) + " s"; continue;
      }
      if (mode === "clm" && !r.partiClm) { r.partiClm = true; r.d = d0; r.pass = [0]; }
      if (r.cache) continue;                               // (v94) coureur éliminé et retiré de la route
      if (r.fini !== null) { r.cible = cpEff(r) * 0.35; r.etat = r.elim ? "Éliminé" : "Arrivé"; }
      else r.cible = mode === "course" ? (fmtHook && fmtHook.cible ? fmtHook.cible(r, cibleCourse(r, dt), dt) : cibleCourse(r, dt)) : mode === "clm" ? cibleClm(r) : cibleZ2(r);
      // (v86) tes coéquipiers (course en équipe) restent près de toi : devant toi, ils lèvent le pied jusqu'aux 3 derniers km
      if (r.equipier && mode === "course" && r.fini === null && user.vue) {
        const ec = r.d - user.d, restant = d0 + longueurCourse() - r.d;
        if (ec > 12 && ec < 500 && restant > 3000) { r.cible = Math.min(r.cible, cpEff(r) * 0.78); r.etat = "Attend son leader"; }
      }
      // triathlon (vélos de chrono) : l'aspiration est interdite ; trop près de celui qui précède (moins de 12 m), on lève le pied,
      // sauf en attaque (on le double franchement) — les coureurs s'étirent en file espacée et gardent leur position allongée
      if (r.clm && r.fini === null && !r.atk && mode !== "clm") {
        const ir = coureurs.indexOf(r);
        for (const o of tous) {
          const ec = o.d - r.d, io = coureurs.indexOf(o);
          // devant à moins de 14 m, ou de front (le coureur de rang le plus élevé cède ; face à l'utilisateur, c'est le coureur virtuel)
          if (o !== r && ec < GROUPE_DIST + 2 && (ec > 0.3 || (ec > -2 && (io < 0 || io < ir)))) { r.cible *= ec < 6 ? 0.6 : 0.78; break; }
        }
      }
      r.cible = Math.max(0, Math.min(r.cible, plafond(r)));
      r.P += (r.cible - r.P) * (1 - Math.exp(-dt / (r.cible > r.P ? 0.9 : 1.6)));
      // réserve anaérobie (W') et fatigue
      const cp = cpEff(r);
      majReserve(r, cp, dt);
      r.travail += r.P * dt;
      if (r.vide && r.fini === null) r.etat = "À bout de forces";
      // mouvement
      let ab = mode === "clm" ? 1 : abri(r, tous);          // contre-la-montre : chacun seul, pas d'aspiration
      if (r.clm) {                       // vélo de chrono : position allongée, sauf en groupe (relevé sur les cornes, aspiration réduite)
        let proche = false;
        // dans la zone d'aspiration d'un coureur qui précède (moins de 12 m devant), ou en paquet (à moins de 2 m)
        for (const o of tous) { const ec = o.d - r.d; if (o !== r && o.fini == null && ((ec > 0 && ec < GROUPE_DIST) || Math.abs(ec) < 2)) { proche = true; break; } }
        r.grp += ((proche ? 1 : 0) - r.grp) * Math.min(1, dt * 0.7);
        ab = 1 - (1 - ab) * (1 - MALUS_CLM_ABRI * r.grp);
      } else r.grp = 0;
      const cda = cdaIA(r), m = r.masse + r.masseVelo;
      const ang = Math.atan(pente(r.d) / 100);
      const va = r.v + ctx.vent(r.d), res = (m * G * (Math.sin(ang) + crrA(r.d) * Math.cos(ang)) + 0.5 * ctx.rho * cda * ab * va * Math.abs(va)) * RESISTANCE_PLUS;
      const frein = r.v > VMAX ? (r.v - VMAX) * 40 : 0;
      r.v = Math.max(0, r.v + (((r.P * RENDEMENT) / Math.max(r.v, 1) - res - frein) / m) * dt);
      // bien calé dans une roue (course) : il reste collé à celui qu'il suit, sans les à-coups du réglage de la puissance
      if (r.colle) { const o = r.colle; r.v += (o.v + borner((o.d - r.d - ROUE) * 0.15, -0.5, 0.5) - r.v) * Math.min(1, dt * 0.8); }
      // trop d'avance sur l'utilisateur en sortie endurance : on freine doucement (descentes) pour l'attendre
      if (mode === "z2" && user.vue && r.d - user.d > 110 && r.v > Math.max(user.v * 0.6, 1)) r.v = Math.max(user.v * 0.6, 1, r.v - 1.5 * dt);
      // (v69 suite) virage serré devant : on freine (même règle que pour toi)
      if (ctx.vsure) { const vc = ctx.vsure(r.d, r.v); if (r.v > vc) r.v = Math.max(vc, r.v - 6 * dt); }
      r.d += r.v * dt;
      if (mode === "clm") while (r.d - d0 >= r.pass.length * PASSAGE && r.pass.length < 20000) r.pass.push(t - r.tDep);
      r.ab = ab;

      r.cad = r.v > 0.5 ? borner(72 + 22 * (r.P / cp - 0.6), 60, 112) : 0;
      if (mode === "course" && !sansFin() && r.fini === null && r.d >= finDe(r)) { r.fini = t; }
      if (mode === "clm" && r.fini === null && r.d >= d0 + longueurCourse()) r.fini = t - r.tDep;   // temps de son propre chrono
    }
    eviter(dt);
  }

  // u : { d, v, enCours, vue }
  function maj(dt, u) {
    if (mode === "aucun" || !coureurs.length) return;
    user.d = u.d; user.v = u.v; user.vue = true;
    if ((mode === "course" || mode === "clm") && !sansFin() && user.fin === null && u.d >= d0 + longueurCourse()) user.fin = t;
    if (mode === "clm") while (u.d - d0 >= user.pass.length * PASSAGE && user.pass.length < 20000) user.pass.push(t);
    if (!parti) { if (!u.enCours) return; parti = true; }
    let reste = Math.min(dt, 2);
    while (reste > 0) { const h = Math.min(0.25, reste); t += h; pas(h); reste -= h; }
  }

  // (v69 suite) contre-la-montre : écart de temps avec toi au dernier point de passage commun (tous les 100 m) ou à l'arrivée (+ = plus lent que toi)
  function ecartClm(r) {
    if (r.fini !== null && user.fin !== null) return r.fini - user.fin;
    const k = Math.min(user.pass.length, r.pass.length) - 1;
    return r.partiClm && k >= 1 ? r.pass[k] - user.pass[k] : null;
  }
  // temps d'arrivée d'un coureur (estimé s'il n'est pas encore arrivé), depuis son propre départ : en contre-la-montre, ton temps + l'écart
  // au dernier point de chrono commun (comme à l'écran) ; sinon le reste à sa vitesse moyenne (la vitesse du moment varie trop : virages, bosses)
  function tempsEstime(r) {
    if (r.fini !== null) return r.fini;
    if (mode === "clm" && user.fin !== null) { const e = ecartClm(r); if (e !== null) return user.fin + e; }
    const ecoule = t - (r.tDep || 0), fait = r.d - d0, rest = Math.max(0, d0 + longueurCourse() - r.d);
    return ecoule + rest / Math.max(fait > 200 && ecoule > 10 ? fait / ecoule : r.v, 4);
  }
  function classement() {         // liste triée (arrivée, puis distance) avec l'utilisateur
    if (tttC) {                   // (v87) CLM par équipe : une ligne par équipe, écart au dernier point de chrono (ou à l'arrivée)
      const E0 = equipesT.find((E) => E.eq === 0), k = Math.max(0, user.pass.length - 1), t0 = E0 ? passEq(E0, k) : null, f0 = E0 ? tempsEquipeFinal(E0) : Infinity;
      const l = equipesT.map((E) => {
        const moi = E.eq === 0, fin = tempsEquipeFinal(E), pk = k >= 1 && t0 !== null ? passEq(E, k) : null;
        const ecart = moi ? 0 : isFinite(fin) && isFinite(f0) ? fin - f0 : pk !== null ? pk - t0 : null;
        return { nom: E.nom, couleur: E.couleur, d: moi ? user.d : E.d, fini: moi ? user.fin : (isFinite(fin) ? fin : null), etat: moi ? "" : E.membres[0].etat, P: 0, wbal: 0, user: moi, v: moi ? user.v : E.v, ecart, eq: E.eq };
      });
      l.sort((a, b) => (a.ecart === null) - (b.ecart === null) || (a.ecart || 0) - (b.ecart || 0));
      return l;
    }
    if (mode === "clm") {

      const l = coureurs.map((r) => ({ nom: r.nom, couleur: r.couleur, d: r.d, fini: r.fini, etat: r.etat, P: r.P, wbal: r.wbal / r.wp, user: false, v: r.v, ecart: ecartClm(r), eq: r.eq }));
      l.push({ nom: "Toi", couleur: 0xff7a2f, d: user.d, fini: user.fin, etat: "", user: true, v: user.v, wbal: null, ecart: 0, eq: equipeUser() });
      l.sort((a, b) => (a.ecart === null) - (b.ecart === null) || (a.ecart || 0) - (b.ecart || 0));
      return l;
    }
    const liste = coureurs.map((r) => ({ nom: r.nom, couleur: r.couleur, d: r.d, fini: r.fini, etat: r.etat, P: r.P, wbal: r.wbal / r.wp, user: false, v: r.v, eq: r.eq }));
    liste.push({ nom: "Toi", couleur: 0xff7a2f, d: user.d, fini: user.fin, etat: "", user: true, v: user.v, wbal: null, eq: equipeUser() });
    liste.sort((a, b) => (a.fini !== null && b.fini !== null) ? a.fini - b.fini : a.fini !== null ? -1 : b.fini !== null ? 1 : b.d - a.d);
    return liste;
  }
  const equipeUser = () => enEquipeC ? 0 : undefined;
  // (v86) contre-la-montre : à ton arrivée, on fait rouler la suite en accéléré jusqu'à l'arrivée du dernier coureur virtuel : classement final exact
  // (v89) rend vrai quand tout le monde est arrivé ; `max` pas par appel pour ne pas figer l'écran (l'écran l'appelle à chaque image jusqu'au bout)
  function finaliser(max) {
    if (mode !== "clm") return true;
    for (let n = 0; n < (max || 24000) && coureurs.some((r) => r.fini === null); n++) { t += 0.25; pas(0.25); }
    return coureurs.every((r) => r.fini !== null);
  }
  // classement final du contre-la-montre : temps de chacun (chrono personnel), du plus rapide au plus lent
  function classementFinal() {
    if (tttC) return equipesT.map((E) => ({ nom: E.nom, couleur: E.couleur, temps: tempsEquipeFinal(E), user: E.eq === 0, eq: E.eq })).sort((a, b) => a.temps - b.temps);
    const l = coureurs.map((r) => ({ nom: r.nom, couleur: r.couleur, temps: tempsEstime(r), user: false, eq: r.eq }));
    l.push({ nom: "Toi", couleur: 0xff7a2f, temps: user.fin === null ? Infinity : user.fin, user: true, eq: equipeUser() });
    return l.sort((a, b) => a.temps - b.temps);
  }
  // (v94) coureur éliminé (course à l'élimination) : il lève le pied, puis disparaît de la route 6 s plus tard
  function eliminer(r) { if (r.elim) return; r.elim = true; r.fini = t; r.tElim = t; r.etat = "Éliminé"; }
  function retirer(r) { r.cache = true; r.d = d0 - 5000; r.v = 0; r.P = 0; r.cad = 0; }
  const actif = () => mode !== "aucun" && coureurs.length > 0;
  const majVelos = () => { for (const r of coureurs) veloIA(r); };
  return { cpEff, plafond, puissancePour, cibleClm, eliminer, retirer, finDe, user: () => user, TYPES, NOMS_EQUIPES, KITS_EQUIPES, MAX_IA, tempsEquipes, equipiers, ttt: () => tttC, finaliser, classementFinal, tirerEquipe, tempsEstime, regler, abriPour, procheDe, majVelos, demarrer, maj, classement, actif, coureurs: () => coureurs, mode: () => mode, tours: () => toursC, longueurCourse, depart: () => d0, longueur: () => L, temps: () => t, parti: () => parti };
})();

const balade = { enCours: false, auto: false, immobile: 0, distance: 0, vitesse: 0, temps: 0, altitude: 0, dernier: maintenant(), tick: maintenant(), cadence: null };
const session = { samples: [], debut: null, dernierEnreg: 0, pause: 0 };   // pause : secondes passées à l'arrêt depuis le premier échantillon (fichier .FIT)

function modeActuel() { return document.querySelector("input[name=mode]:checked").value; }

/* (v102) En séance ERG, la vitesse, l'altitude et le dénivelé suivent la vraie pente du parcours (avant : tout était compté à plat, alors que
   la 3D montait : séances « Sur le parcours » plus rapides en côte qu'à plat, records de côte faussés, 0 m de dénivelé). Le home trainer, lui,
   garde la puissance imposée. Seul l'échauffement avant une course reste compté à plat : on revient ensuite au départ (sans saut d'altitude). */
function penteMonde() {
  if (modeActuel() === "manuel") return parseFloat($("pente-manuelle").value);
  if (typeof echauffementEnCours === "function" && echauffementEnCours()) return 0;
  return penteA(balade.distance);
}

// conditions aérodynamiques du moment (vent, densité de l'air, roulement, aspiration), mises à jour à chaque pas
const condAir = { rho: 1.226, crr: 0.0055, ventFace: 0, abri: 1, cap: null, ville: false, gainW: 0, ventW: 0 };
const capCache = { route: null, m: new Map() };
function capRoute(d) {                     // direction de la route (x, z) à la distance d : fonctionne pour tous les mondes
  if (!monde3d) return null;
  if (capCache.route !== route) { capCache.route = route; capCache.m.clear(); }
  const k = Math.floor(d / 8);
  if (capCache.m.has(k)) return capCache.m.get(k);
  const a = monde3d.pos(Math.max(0, k * 8 - 4)), b = monde3d.pos(k * 8 + 12), dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
  const c = l > 0.01 ? [dx / l, dz / l] : null;
  if (capCache.m.size > 400) capCache.m.clear();
  capCache.m.set(k, c);
  return c;
}
// revêtement à la distance d : « gravier » dans les secteurs de chemin blanc (route.secteurs, Toscane), sinon celui du monde
function revetementA(d) {
  const sct = route.secteurs;
  if (sct) { const x = route.boucle ? ((d % route.longueur) + route.longueur) % route.longueur : d; for (const q of sct) if (x >= q[0] && x <= q[1]) return q[3] === "pave" ? "pave" : "gravier"; }   // (v69 suite) 4e valeur « pave » : secteur pavé
  return route.revetement || "bitume";
}
function enVille(d) { if (route.boucle) d %= route.longueur; return !!(route.villes && route.villes.some((q) => d >= q[0] && d <= q[1])); }
function majConditionsAir(dt) {
  const etat = monde3d && monde3d.meteo ? monde3d.meteo().etat : "clair";
  Aero.maj(dt, etat);
  condAir.rho = Aero.densite(balade.altitude);
  const pluie = etat === "pluie" || etat === "orage";
  condAir.crr = Aero.roulement(revetementA(balade.distance), pluie);   // aussi envoyé au home trainer : plus dur sur le chemin blanc
  condAir.cap = capRoute(balade.distance); condAir.ville = enVille(balade.distance);
  condAir.ventFace = Aero.ventDeFace(condAir.cap, condAir.ville);
  Peloton.regler({ rho: condAir.rho, crr: condAir.crr, crrA: (d) => Aero.roulement(revetementA(d), pluie), vent: (d) => Aero.ventDeFace(capRoute(d), enVille(d)),
                   vsure: Aero.reg.frein ? vitesseVirage : null });
}
/* (v69 suite) Freinage avant les virages serrés : la vitesse sûre dans un virage de rayon R est √(A_LAT × R) (A_LAT = 4,5 m/s² : coureur bien penché,
   un virage à angle droit de rayon 20 m se prend à 34 km/h, une épingle de 10 m à 24 km/h) ; on freine (3,5 m/s²) assez tôt pour y arriver.
   La courbure vient du tracé 3D (monde3d.pos) : marche pour tous les mondes, fabriqués ou réels, sans réglage propre au monde. */
const A_LAT = 4.5, DECEL = 3.5;
const courbes = { route: null, m: new Map() };
function courbureA(d) {                    // courbure (1/rayon, en 1/m) mesurée sur 24 m autour de d
  if (!monde3d || !(route.longueur > 0)) return 0;
  if (courbes.route !== route) { courbes.route = route; courbes.m.clear(); }
  const k = Math.round(d / 6);
  let c = courbes.m.get(k);
  if (c === undefined) {
    const x = k * 6;
    if (x - 12 < 0 && !route.boucle) { courbes.m.set(k, 0); return 0; }     // début d'un aller simple : pas de virage mesurable
    const a = monde3d.pos(x - 12 < 0 ? x - 12 + route.longueur : x - 12), b = monde3d.pos(x < 0 ? x + route.longueur : x), e = monde3d.pos(x + 12);
    let da = Math.atan2(e[1] - b[1], e[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0]);
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(e[0] - b[0], e[1] - b[1]);
    c = l > 4 ? Math.abs(da) / (l / 2) : 0;                  // angle tourné entre les milieux des deux cordes (12 m)
    if (courbes.m.size > 30000) courbes.m.clear();
    courbes.m.set(k, c);
  }
  return c;
}
// vitesse à ne pas dépasser maintenant pour passer les virages des prochains mètres (freinage compris)
function vitesseVirage(d, v) {
  const portee = Math.min(160, v * v / (2 * DECEL) + 15);
  let vc = Infinity;
  for (let x = 0; x <= portee; x += 6) {
    const k = courbureA(d + x);
    if (k < 0.004) continue;                                 // rayon de plus de 250 m : aucun souci
    vc = Math.min(vc, Math.sqrt(A_LAT / k + 2 * DECEL * x));
  }
  return vc;
}
const hudAero = { gain: 0, vent: 0 };
function majAeroHud() {
  hudAero.gain += (condAir.gainW - hudAero.gain) * 0.25; hudAero.vent += (condAir.ventW - hudAero.vent) * 0.25;
  const t1 = "+" + Math.round(hudAero.gain) + "\u00a0W";
  if ($("hz-aero-w").textContent !== t1) $("hz-aero-w").textContent = t1;
  const w = Aero.vecteur(condAir.ville), cap = condAir.cap || capRoute(balade.distance), kmh = Math.round(Math.hypot(w[0], w[1]) * 3.6);
  let f = 0, l = 0;
  if (cap) { f = w[0] * cap[0] + w[1] * cap[1]; l = -w[0] * cap[1] + w[1] * cap[0]; }
  const faible = !Aero.reg.vent || kmh < 2;
  const dir = faible ? "vent faible" : Math.abs(f) > Math.abs(l) * 1.7 ? (f < 0 ? "de face" : "dans le dos") : Math.abs(l) > Math.abs(f) * 1.7 ? "de côté" : (f < 0 ? "de face, de côté" : "dans le dos, de côté");
  const effet = Math.abs(hudAero.vent) >= 1 ? " · " + (hudAero.vent > 0 ? "−" : "+") + Math.round(Math.abs(hudAero.vent)) + "\u00a0W" : "";
  const t2 = (faible ? "" : kmh + "\u00a0km/h ") + dir + effet;
  if ($("hz-vent-t").textContent !== t2) $("hz-vent-t").textContent = t2;
  // flèche : sens dans lequel l'air se déplace, vu du cycliste (le haut = devant lui)
  const c = $("hz-vent-c"), x = c.getContext("2d"), W = c.width, H = c.height;
  x.clearRect(0, 0, W, H);
  if (faible || !cap) {                // vent faible : pas de cadran, juste un repère discret
    x.fillStyle = "#C3CDD9"; x.beginPath(); x.moveTo(W / 2, H / 2 - 14); x.lineTo(W / 2 + 9, H / 2 + 11); x.lineTo(W / 2 - 9, H / 2 + 11); x.closePath(); x.fill();
    x.fillStyle = "rgba(195,205,217,.7)"; x.font = "bold 20px sans-serif"; x.textAlign = "center"; x.fillText("calme", W / 2, H - 8);
    return;
  }
  x.strokeStyle = "rgba(195,205,217,.4)"; x.lineWidth = 3; x.beginPath(); x.arc(W / 2, H / 2, W / 2 - 5, 0, 6.283); x.stroke();
  x.fillStyle = "rgba(195,205,217,.9)"; x.beginPath(); x.moveTo(W / 2, H / 2 - 14); x.lineTo(W / 2 + 9, H / 2 + 11); x.lineTo(W / 2 - 9, H / 2 + 11); x.closePath(); x.fill();   // le cycliste, face vers le haut
  {
    const n = Math.hypot(f, l) || 1, ux = l / n, uy = -f / n, L = Math.min(W / 2 - 10, 26 + kmh * 1.1);
    const hx = W / 2 + ux * L, hy = H / 2 + uy * L, tx = W / 2 - ux * L, ty = H / 2 - uy * L;
    x.strokeStyle = x.fillStyle = f < 0 ? "#ff7a2f" : "#4FE0A2"; x.lineWidth = 8; x.lineCap = "round";
    x.beginPath(); x.moveTo(tx, ty); x.lineTo(hx, hy); x.stroke();
    const an = Math.atan2(hy - ty, hx - tx);
    x.beginPath(); x.moveTo(hx + 4 * Math.cos(an), hy + 4 * Math.sin(an)); x.lineTo(hx - 18 * Math.cos(an - 0.5), hy - 18 * Math.sin(an - 0.5)); x.lineTo(hx - 18 * Math.cos(an + 0.5), hy - 18 * Math.sin(an + 0.5)); x.closePath(); x.fill();
  }
}
function avancer(dt, puissance, pente) {
  const masse = (parseFloat($("poids").value) || 75) + Aero.reg.masseVelo;      // poids du cycliste + vélo et roues choisis (8 kg pour le vélo simple, comme les autres coureurs)
  const g = 9.81, rendement = 0.975;
  const angle = Math.atan(pente / 100);
  // (v102) la poussée est calculée comme à 1 m/s au minimum ; en ERG ce minimum est abaissé à 0,3 m/s, sinon une petite puissance imposée
  // sur un mur (récupération à 100 W sur 12 %) ne suffisait pas à démarrer et le vélo restait arrêté alors que l'on pédalait
  const v = Math.max(balade.vitesse, modeActuel() === "erg" ? 0.3 : 1);
  condAir.abri = Peloton.actif() && (Peloton.mode() !== "clm" || Peloton.ttt()) ? Peloton.abriPour(balade.distance, 0.9) : 1;   // contre-la-montre : pas d'aspiration (sauf par équipe : abri de tes coéquipiers)
  if (typeof Groupe !== "undefined" && Groupe.actif() && $("peloton-mode").value !== "clm" && !(Peloton.actif() && Peloton.mode() === "clm")) condAir.abri = Math.min(condAir.abri, Groupe.abriPour(balade.distance));   // (v71) derrière un ami
  // vélo de chrono en groupe : malus progressif (environ 1,5 s pour se relever ou se remettre en position)
  // (v104) un ami de la sortie de groupe tout près compte comme un coureur virtuel (avant : aucun malus du vélo de chrono dans sa roue)
  const amiProche = Aero.reg.clm && typeof Groupe !== "undefined" && Groupe.actif() && Groupe.positions().some((a) => Math.abs(a.d - balade.distance) < GROUPE_DIST);
  const enGroupe = Aero.reg.clm && !Peloton.ttt() && ((Peloton.actif() && Peloton.procheDe(balade.distance, GROUPE_DIST)) || amiProche) ? 1 : 0;   // (v87) CLM par équipe : on reste en position allongée dans la file
  Aero.reg.groupe += (enGroupe - Aero.reg.groupe) * Math.min(1, dt * 0.7);
  if (Aero.reg.clm) condAir.abri = 1 - (1 - condAir.abri) * (1 - MALUS_CLM_ABRI * Aero.reg.groupe);
  const air = balade.vitesse + condAir.ventFace;       // vitesse de l'air par rapport au cycliste
  // (v69 suite) virage serré devant : freins (seulement dans le jeu, le home trainer ne change pas)
  const vc = Aero.reg.frein && balade.vitesse > 6 ? vitesseVirage(balade.distance, balade.vitesse) : Infinity;
  const frein = balade.vitesse > vc + 0.2 ? masse * Math.min(5.5, (balade.vitesse - vc) * 2.5 + 1) : 0;
  condAir.frein = frein > 0 ? 1 : Math.max(0, (condAir.frein || 0) - dt * 2);
  const resistance = (masse * g * (Math.sin(angle) + condAir.crr * Math.cos(angle)) + 0.5 * condAir.rho * Aero.cdaUtilisateur() * condAir.abri * air * Math.abs(air)) * RESISTANCE_PLUS + frein;
  // puissance gagnée grâce à l'aspiration et au matériel, et effet du vent (en watts)
  const vit = balade.vitesse, rhoCda = 0.5 * condAir.rho;
  condAir.gainW = Math.max(0, rhoCda * air * Math.abs(air) * vit * (Aero.CDA - Aero.cdaUtilisateur() * condAir.abri));
  condAir.ventW = rhoCda * Aero.cdaUtilisateur() * condAir.abri * (air * Math.abs(air) - vit * vit) * vit;
  const poussee = (puissance * rendement) / v;
  balade.vitesse = Math.max(0, balade.vitesse + ((poussee - resistance) / masse) * dt);
  const pas = balade.vitesse * dt;
  balade.distance += pas;
  balade.altitude += pas * pente / 100;
  balade.temps += dt;
}

function majBoutonBalade() {
  const t = balade.enCours ? "Mettre en pause" : (balade.temps > 0 ? "Reprendre la balade" : "Démarrer la balade");
  $("btn-balade").textContent = t;
  document.querySelectorAll(".btn-balade-x").forEach((b) => { b.textContent = t; });
}

/* =====================================================================
   Commandes envoyées au home trainer
   ===================================================================== */
let derniereEnvoyee = null;
let dernierWatts = null;
let dernierSim = null;          // derniers vent, roulement et air envoyés au home trainer
function reinitialiserEnvois() { derniereEnvoyee = null; dernierWatts = null; dernierSim = null; }
let dernierEnvoiCible = 0;      // (v102) heure de la dernière puissance cible envoyée

function facteurDescente() { return 1 - 0.9 * (parseInt($("difficulte-desc").value, 10) || 0) / 100; }
function penteEnvoyee() {            // en descente, le home trainer garde de la résistance : tu peux continuer à pédaler au lieu de tourner dans le vide
  const g = penteMonde() * parseInt($("difficulte").value, 10) / 100 * RESISTANCE_PLUS;
  return borner(g < 0 ? g * facteurDescente() : g, -10, 20);
}
function majTexteDescente() {
  const v = parseInt($("difficulte-desc").value, 10) || 0;
  $("difficulte-desc-val").innerHTML = v + "&nbsp;% : une descente à −8&nbsp;% est envoyée au home trainer comme −" + fr1(8 * facteurDescente() * RESISTANCE_PLUS).replace(",0", "") + "&nbsp;%. Plus le réglage est haut, plus tu gardes de résistance.";
}

/* (v82) plus de vibrations de la résistance sur les pavés et le gravier : la pente envoyée est toujours la vraie */
function envoyerPente() { envoyerPenteValeur(penteEnvoyee()); }
/* Commande « simulation » du home trainer (FTMS 0x11) : vent, pente, résistance au roulement et à l'air, avec les mêmes
   valeurs que la vitesse dans le jeu (+20 % compris). L'air est envoyé comme le KICKR l'attend : ρ × CdA en kg/m
   (CdA 0,34 → 0,42, × 1,2 ≈ 0,50 ; Zwift envoie 0,51). Avant la v56, on envoyait 0,24 : le home trainer comptait deux fois
   moins d'air que le jeu, d'où très peu de résistance sur le plat (sortie test du 25/10 : 120 W en 50×14 à 75 tr/min). */
function envoyerPenteValeur(envoyee) {
  if (!trainer.pret) return;
  const crr = Math.round((condAir.crr || 0.0055) * RESISTANCE_PLUS * 10000);                                   // × 0,0001
  const cw = Math.round(Math.min(2.5, (condAir.rho || 1.226) * Aero.cdaUtilisateur() * (condAir.abri || 1) * RESISTANCE_PLUS) * 100);   // × 0,01 kg/m (aspiration comprise)
  const vent = Math.round(borner(Aero.reg.vent ? condAir.ventFace || 0 : 0, -15, 15) * 1000);                 // m/s × 1000, positif = vent de face
  const s = dernierSim, penteIdem = derniereEnvoyee !== null && Math.abs(envoyee - derniereEnvoyee) < 0.1;
  if (penteIdem && s && Math.abs(crr - s.crr) < 2 && Math.abs(cw - s.cw) < 2 && Math.abs(vent - s.vent) < 400) return;
  if (penteIdem && s && Date.now() - s.t < 2000) return;
  if (s && Date.now() - s.t < 1000) return;                       // (v77) jamais plus d'une commande par seconde : sur un parcours qui change de pente sans cesse, elles s'empilaient et le home trainer lâchait la résistance un instant
  if (ecrituresEnAttente > 0) return;                              // (v77) une commande est encore en route : on attend, la valeur à jour sera envoyée au passage suivant          // vent et aspiration changent sans cesse : une mise à jour toutes les 2 s au plus
  derniereEnvoyee = envoyee;
  dernierSim = { crr, cw, vent, t: Date.now() };
  dernierWatts = null;
  const buf = new DataView(new ArrayBuffer(7));
  buf.setUint8(0, 0x11);
  buf.setInt16(1, vent, true);
  buf.setInt16(3, Math.round(envoyee * 100), true);
  buf.setUint8(5, Math.min(255, crr));
  buf.setUint8(6, Math.min(255, cw));
  ecrireCommande(Array.from(new Uint8Array(buf.buffer)));
}

function envoyerPuissanceCible(watts) {
  if (!trainer.pret || watts === dernierWatts) return;
  // (v102) comme pour la pente (v77) : jamais plus d'une commande par seconde, et aucune tant qu'une commande est en route. Dans les séances
  // « Sur le parcours », la cible change sans cesse avec la pente. La boucle repasse ici : la valeur à jour part au passage suivant.
  if (Date.now() - dernierEnvoiCible < 1000 || ecrituresEnAttente > 0) return;
  dernierEnvoiCible = Date.now();
  dernierWatts = watts;
  derniereEnvoyee = null;
  const buf = new DataView(new ArrayBuffer(3));
  buf.setUint8(0, 0x05);
  buf.setInt16(1, watts, true);
  ecrireCommande(Array.from(new Uint8Array(buf.buffer)));
}

