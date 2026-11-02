"use strict";
/* =====================================================================
   Stockage et historique des séances
   ===================================================================== */
const stockage = { type: null };     // "indexeddb", "local" ou null (indisponible)
const CLE_INDEX = "velo-hist-index", CLE_DONNEES = "velo-hist-donnees-";

async function initialiserStockage() {
  base = await ouvrirBase();
  if (base) {
    try {
      await transaction(["resumes"], "readwrite", (t) => { t.objectStore("resumes").put({ id: -1 }); });
      await transaction(["resumes"], "readwrite", (t) => { t.objectStore("resumes").delete(-1); });
      stockage.type = "indexeddb";
      return;
    } catch (e) { base = null; }
  }
  try {
    localStorage.setItem("velo-test", "1"); localStorage.removeItem("velo-test");
    stockage.type = "local";
    log("Historique : stockage de secours utilisé.");
  } catch (e) {
    stockage.type = null;
    log("Historique indisponible : le navigateur bloque le stockage local.");
  }
}

function lireIndexLocal() {
  try { return JSON.parse(localStorage.getItem(CLE_INDEX)) || []; } catch (e) { return []; }
}
const arrondi = (v, k) => (v === null || v === undefined) ? null : Math.round(v * k) / k;

async function stockerSeance(resume, samples) {
  if (stockage.type === "indexeddb") {
    await transaction(["resumes", "donnees"], "readwrite", (t) => {
      t.objectStore("resumes").put(resume);
      t.objectStore("donnees").put({ id: resume.id, samples });
    });
  } else if (stockage.type === "local") {
    const compact = samples.map((x) => [x.p, x.c, x.hr, arrondi(x.v, 100), arrondi(x.d, 10), arrondi(x.alt, 10), arrondi(x.g, 10)]);
    localStorage.setItem(CLE_DONNEES + resume.id, JSON.stringify(compact));
    const index = lireIndexLocal().filter((r) => r.id !== resume.id);
    index.push(resume);
    localStorage.setItem(CLE_INDEX, JSON.stringify(index));
  } else {
    throw new Error("aucun stockage disponible");
  }
}

async function listerSeances() {
  if (stockage.type === "indexeddb") {
    return (await transaction(["resumes"], "readonly", (t, fin) => {
      const r = t.objectStore("resumes").getAll();
      r.onsuccess = () => fin(r.result);
    })) || [];
  }
  if (stockage.type === "local") return lireIndexLocal();
  return [];
}

async function lireDonnees(id) {
  if (stockage.type === "indexeddb") {
    const d = await transaction(["donnees"], "readonly", (t, fin) => {
      const r = t.objectStore("donnees").get(id);
      r.onsuccess = () => fin(r.result);
    });
    return d ? d.samples : null;
  }
  if (stockage.type === "local") {
    const texte = localStorage.getItem(CLE_DONNEES + id);
    if (!texte) return null;
    return JSON.parse(texte).map((a) => ({ p: a[0], c: a[1], hr: a[2], v: a[3], d: a[4], alt: a[5], g: a[6] }));
  }
  return null;
}

async function effacerSeance(id) {
  if (stockage.type === "indexeddb") {
    await transaction(["resumes", "donnees"], "readwrite", (t) => {
      t.objectStore("resumes").delete(id);
      t.objectStore("donnees").delete(id);
    });
  } else if (stockage.type === "local") {
    localStorage.removeItem(CLE_DONNEES + id);
    localStorage.setItem(CLE_INDEX, JSON.stringify(lireIndexLocal().filter((r) => r.id !== id)));
  }
}

let historique = [];
let detail = null;   // { resume, samples } de la séance affichée en détail

async function sauverSeanceCourante(minimum) {
  const n = session.samples.length;
  if (!stockage.type || n < (minimum || 60) || !session.debut) return false;
  const resume = Object.assign({ id: session.debut, parcours: route.nom, ftp: ftp(), fcmax: fcmax(), test: typeTest(seance.intervalles) },
                                resumer(session.samples, ftp(), fcmax()));
  // (v69 suite) courbe de puissance et repères cardio de la séance ; de quoi la revoir en 3D (monde, départ, autres coureurs)
  try { Analyse.completer(resume, session.samples); } catch (e) { /* facultatif */ }
  if (typeof mondeActifId !== "undefined" && mondeActifId && (route.geo || route.synth)) {
    resume.mondeId = mondeActifId; resume.d0 = balade.d0 || 0;
    if (Peloton.actif()) resume.peloton = Peloton.coureurs().map((r) => ({ id: r.id, nom: r.nom, couleur: r.couleur, femme: r.femme, look: r.look, velo: r.velo, roues: r.roues, voie: Math.round(r.voieBase * 100) / 100 }));
  }
  try {
    await stockerSeance(resume, session.samples);
    session.dernierEnreg = n;
    await majHistorique();
    return true;
  } catch (e) {
    log("Sauvegarde de la séance impossible : " + e.message);
    return false;
  }
}

async function majHistorique() {
  try { historique = await listerSeances(); } catch (e) { historique = []; }
  historique.sort((a, b) => b.id - a.id);
  rendreHistorique();
  if (typeof Analyse !== "undefined") Analyse.rendre();    // (v69 suite) courbe de puissance, zones de FC, bilans
}

/* ---------- Cumul de toutes les séances ---------- */
function cumuler(liste) {
  const c = { nb: liste.length, n: 0, distance: 0, dplus: 0, kcal: 0, pPond: 0, pMax: 0,
              cadPond: 0, cadN: 0, cadMax: null, fcPond: 0, fcN: 0, fcMax: null,
              zonesP: ZONES_P.map(() => 0), zonesFC: ZONES_FC.map(() => 0) };
  for (const h of liste) {
    c.n += h.n; c.distance += h.distance; c.dplus += h.dplus; c.kcal += h.kcal;
    c.pPond += h.pMoy * h.n; c.pMax = Math.max(c.pMax, h.pMax);
    if (h.cadMoy !== null) { c.cadPond += h.cadMoy * h.n; c.cadN += h.n; c.cadMax = Math.max(c.cadMax === null ? 0 : c.cadMax, h.cadMax); }
    if (h.fcMoy !== null) { c.fcPond += h.fcMoy * h.n; c.fcN += h.n; c.fcMax = Math.max(c.fcMax === null ? 0 : c.fcMax, h.fcMax); }
    h.zonesP.forEach((v, i) => { c.zonesP[i] += v; });
    h.zonesFC.forEach((v, i) => { c.zonesFC[i] += v; });
  }
  return c;
}
const TUILES_TOTAL = [
  ["Séances", (r) => r.nb],
  ["Temps total", (r) => formatDuree(r.n)],
  ["Distance totale (km)", (r) => fr1(r.distance / 1000)],
  ["Dénivelé total (m)", (r) => Math.round(r.dplus)],
  ["Calories totales (kcal, estimation)", (r) => Math.round(r.kcal)],
  ["Vitesse moyenne (km/h)", (r) => r.n ? fr1(r.distance / r.n * 3.6) : "–"],
  ["Puissance moyenne (W)", (r) => r.n ? Math.round(r.pPond / r.n) : "–"],
  ["Puissance maximale (W)", (r) => Math.round(r.pMax)],
  ["Cadence moyenne (tr/min)", (r) => r.cadN ? Math.round(r.cadPond / r.cadN) : "–"],
  ["Cadence maximale (tr/min)", (r) => r.cadMax !== null ? Math.round(r.cadMax) : "–"],
  ["FC moyenne (bpm)", (r) => r.fcN ? Math.round(r.fcPond / r.fcN) : "–"],
  ["FC maximale (bpm)", (r) => r.fcMax !== null ? Math.round(r.fcMax) : "–"]
];

function moyMax(a, b) { return a !== null && b !== null ? Math.round(a) + " / " + Math.round(b) : "–"; }

function rendreHistorique() {
  const corps = $("corps-hist");
  corps.innerHTML = "";
  const etat = $("etat-stockage");
  if (!stockage.type) {
    etat.textContent = "L’historique est indisponible : le navigateur bloque le stockage local. Exporte chaque séance en .FIT pour la conserver.";
  } else {
    etat.textContent = historique.length
      ? "Moyennes pondérées par la durée des séances. Les séances sont conservées dans ce navigateur, sur cet ordinateur."
      : "Aucune séance enregistrée pour l’instant. Termine une sortie avec « Terminer et enregistrer » pour la voir apparaître ici.";
  }
  if (!historique.length) {
    $("tuiles-total").innerHTML = ""; $("zones-total").innerHTML = "";
    return;
  }
  const cumul = cumuler(historique);
  rendreTuiles($("tuiles-total"), cumul, TUILES_TOTAL);
  rendreZones($("zones-total"), cumul, null, null);

  for (const h of historique) {
    const tr = document.createElement("tr");
    const date = new Date(h.id).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const valeurs = [date, formatDuree(h.n), fr2(h.distance / 1000), Math.round(h.dplus), fr1(h.vitMoy), Math.round(h.kcal),
                     moyMax(h.cadMoy, h.cadMax), moyMax(h.pMoy, h.pMax), Math.round(h.np), moyMax(h.fcMoy, h.fcMax)];
    for (const v of valeurs) { const td = document.createElement("td"); td.textContent = v; tr.append(td); }
    const td = document.createElement("td");
    const b = document.createElement("button");
    b.className = "petit"; b.textContent = "Détails";
    b.addEventListener("click", () => afficherDetail(h.id));
    td.append(b); tr.append(td);
    corps.append(tr);
  }
}

async function afficherDetail(id) {
  const resume = historique.find((h) => h.id === id);
  if (!resume) return;
  let samples = null;
  try { samples = await lireDonnees(id); } catch (e) { /* géré ci-dessous */ }
  if (!samples) { log("Les données de cette séance sont introuvables."); return; }
  detail = { resume, samples };
  $("detail-seance").hidden = false;
  $("detail-titre").textContent = "Séance du " + new Date(resume.id).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }) +
    " – " + resume.parcours;
  rendreTuiles($("detail-tuiles"), resume);
  rendreZones($("detail-zones"), resume, resume.ftp, resume.fcmax);
  rendreBilan($("detail-bilan"), samples, resume.test || null, ftp(), true);
  $("btn-detail-revoir").hidden = !(resume.mondeId && typeof MONDES !== "undefined" && MONDES.some((m) => m.id === resume.mondeId));   // (v69 suite)
  dessinerGraphique($("detail-graphique"), samples, resume.ftp, resume.fcmax);
  $("detail-seance").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

$("btn-detail-fermer").addEventListener("click", () => { detail = null; $("detail-seance").hidden = true; });
$("btn-detail-fit").addEventListener("click", () => {
  if (!detail) return;
  try {
    telecharger(construireFit(detail.samples, detail.resume.id), nomFichierFit(detail.resume.id));
    log("Fichier " + nomFichierFit(detail.resume.id) + " créé.");
  } catch (err) { log("Export impossible : " + err.message); }
});
$("btn-detail-suppr").addEventListener("click", async () => {
  if (!detail || !confirm("Supprimer définitivement cette séance de l’historique ?")) return;
  try {
    await effacerSeance(detail.resume.id);
    detail = null; $("detail-seance").hidden = true;
    log("Séance supprimée.");
    await majHistorique();
  } catch (err) { log("Suppression impossible : " + err.message); }
});

/* =====================================================================
   Onglets
   ===================================================================== */
function afficherOnglet(nom) {
  $("onglet-parametres").hidden = nom !== "parametres";
  $("tab-parametres").setAttribute("aria-selected", String(nom === "parametres"));
  $("onglet-connectivite").hidden = nom !== "connectivite";
  $("tab-connectivite").setAttribute("aria-selected", String(nom === "connectivite"));
  $("onglet-seance").hidden = nom !== "seance";
  $("onglet-world").hidden = nom !== "world";
  $("onglet-historique").hidden = nom !== "historique";
  $("onglet-perso").hidden = nom !== "perso";
  $("tab-perso").setAttribute("aria-selected", String(nom === "perso"));
  if (nom === "perso") majApercu();
  $("tab-world").setAttribute("aria-selected", String(nom === "world"));
  $("tab-seance").setAttribute("aria-selected", String(nom === "seance"));
  $("tab-historique").setAttribute("aria-selected", String(nom === "historique"));
  if (nom === "world" && !$("world-choix").hidden) rendreTuilesMondes();
  if (nom === "seance") { majStats(); dessinerProfil(); dessinerSeance(); rendreBiblio(); }
  else if (detail) dessinerGraphique($("detail-graphique"), detail.samples, detail.resume.ftp, detail.resume.fcmax);
}
$("tab-parametres").addEventListener("click", () => afficherOnglet("parametres"));
$("tab-connectivite").addEventListener("click", () => afficherOnglet("connectivite"));
$("tab-seance").addEventListener("click", () => afficherOnglet("seance"));
$("tab-world").addEventListener("click", () => afficherOnglet("world"));
$("tab-historique").addEventListener("click", () => afficherOnglet("historique"));
$("tab-perso").addEventListener("click", () => afficherOnglet("perso"));

/* =====================================================================
   Fin de séance : export, historique, remise à zéro
   ===================================================================== */
function reinitialiserSeance() {
  balade.enCours = false; balade.auto = false; balade.immobile = 0;
  balade.distance = balade.d0 || 0; balade.vitesse = 0; balade.temps = 0; balade.altitude = balade.d0 ? altitudeA(balade.d0) : route.alt0;   // (v69 suite) on repart du point de départ choisi
  session.samples = []; session.debut = null; session.dernierEnreg = 0; session.pause = 0; seance.t0 = 0;
  if (typeof remettreRavito === "function") remettreRavito();
  if (typeof Tour !== "undefined") Tour.quitterEtape();          // (v69 suite) une étape de Tour non terminée devra être recourue
  if (typeof Progression !== "undefined") { Progression.oublierSortie(); Progression.majAccueil(); }
  majBoutonBalade(); majStats(); lancerPeloton();
}

$("btn-export").addEventListener("click", async () => {
  if (session.samples.length < 10) { log("Séance trop courte pour être exportée (10 secondes minimum)."); return; }
  balade.enCours = false; balade.auto = false; majBoutonBalade();
  const id = session.debut;
  try {
    const nom = nomFichierFit(id);
    telecharger(construireFit(session.samples, id), nom);
    log("Fichier " + nom + " créé (" + formatDuree(session.samples.length) + ").");
  } catch (err) {
    log("Export impossible : " + err.message);
    return;                                           // on garde la séance pour pouvoir réessayer
  }
  const resume = construireResume();
  const enregistree = await sauverSeanceCourante(10);
  reinitialiserSeance();
  afficherOnglet("historique");
  try { afficherResume(resume); } catch (e) { /* le résumé ne doit pas bloquer la fin de séance */ }
  if (enregistree) {
    log("Séance ajoutée à l’historique. Prête pour une nouvelle séance.");
    await afficherDetail(id);
  } else {
    log("Le fichier .FIT est téléchargé, mais la séance n’a pas pu être ajoutée à l’historique.");
  }
});

$("btn-abandon").addEventListener("click", async () => {
  if (session.samples.length > 0 && !confirm("Abandonner cette séance sans l’enregistrer ? Les données seront perdues.")) return;
  const id = session.debut;
  reinitialiserSeance();
  if (id && stockage.type) {
    try { await effacerSeance(id); await majHistorique(); } catch (e) { /* rien à effacer */ }
  }
  log("Séance abandonnée.");
});

/* =====================================================================
   Confort : à venir, distance restante, plein écran
   ===================================================================== */
function penteAVenir() {
  const actuelle = penteA(balade.distance);
  for (let k = 1; k <= 40; k++) {
    const d = balade.distance + k * 25;
    if (!route.boucle && d >= route.longueur) return "Arrivée dans " + Math.round(route.longueur - balade.distance) + "\u00a0m.";
    const p = penteA(d);
    if (Math.abs(p - actuelle) >= 1.5) return "Dans " + (k * 25) + "\u00a0m : pente de " + fr1(p) + "\u00a0%.";
  }
  return "Pas de changement de pente dans les 1\u00a0000 prochains mètres.";
}

function majResteParcours() {
  if (route.boucle) {
    const reste = route.longueur - (balade.distance % route.longueur);
    $("reste-parcours").textContent = "Reste " + fr2(reste / 1000) + "\u00a0km avant la fin de la boucle.";
  } else {
    $("reste-parcours").textContent = "Distance restante : " + fr2(Math.max(0, route.longueur - balade.distance) / 1000) + "\u00a0km.";
  }
}

$("btn-plein-ecran").addEventListener("click", async () => {
  if (document.fullscreenElement) { await document.exitFullscreen(); return; }
  try { await $("monde-conteneur").requestFullscreen(); }
  catch (e) { log("Plein écran indisponible : " + e.message); }
});
$("btn-quitter-fs").addEventListener("click", () => { if (document.fullscreenElement) document.exitFullscreen(); });
document.addEventListener("fullscreenchange", () => {
  $("btn-plein-ecran").textContent = document.fullscreenElement ? "Quitter le plein écran" : "Plein écran";
});
document.querySelectorAll(".btn-balade-x").forEach((b) => b.addEventListener("click", () => $("btn-balade").click()));
document.querySelectorAll(".btn-terminer-x").forEach((b) => b.addEventListener("click", async () => {
  if (session.samples.length < 10) { $("msg-fin").textContent = "Séance trop courte pour être enregistrée : roule au moins 10 secondes."; return; }
  $("msg-fin").textContent = "";
  if (document.fullscreenElement) { try { await document.exitFullscreen(); } catch (e) { /* ignoré */ } }
  $("btn-export").click();
}));
document.querySelectorAll(".btn-abandon-x").forEach((b) => b.addEventListener("click", () => {
  if (document.fullscreenElement) document.exitFullscreen();
  $("btn-abandon").click();
}));
/* Plein écran : les boutons disparaissent quand on roule, reviennent à l'arrêt ou au mouvement de souris */
let cmdReveil = 0;
function majCommandesFs() {
  const el = $("hz-cmd"); if (!el) return;
  const roule = balade.enCours && balade.vitesse > 0.5;
  el.classList.toggle("cache", roule && Date.now() > cmdReveil);
}
$("monde-conteneur").addEventListener("mousemove", () => { cmdReveil = Date.now() + 3000; majCommandesFs(); });
setInterval(majCommandesFs, 250);
document.addEventListener("keydown", (e) => {
  if ($("onglet-world").hidden || $("world-jeu").hidden) return;
  const t = e.target && e.target.tagName;
  if (e.code === "KeyV" && !$("onglet-world").hidden && t !== "INPUT" && t !== "SELECT" && t !== "TEXTAREA") {
    const o = $("vue-camera"); o.selectedIndex = (o.selectedIndex + 1) % o.options.length; o.dispatchEvent(new Event("change")); return;
  }
  if (e.code !== "Space") return;
  if (t === "INPUT" || t === "SELECT" || t === "TEXTAREA" || t === "BUTTON") return;
  e.preventDefault();
  if (typeof Revoir !== "undefined" && Revoir.actif) { Revoir.basculer(); return; }   // (v69 suite) on revoit une sortie : lecture / pause
  $("btn-balade").click();
});


/* =====================================================================
   (v69 suite) Sauvegarde et restauration de toutes les données du navigateur dans un seul fichier .json :
   réglages, progression, records, séances importées et plan (localStorage « velo… »), historique des séances
   et mondes GPX (IndexedDB ; décor téléchargé seulement si la case est cochée, sinon le tracé seul)
   ===================================================================== */
const lireTout = (nom) => transaction([nom], "readonly", (t, set) => { const q = t.objectStore(nom).getAll(); q.onsuccess = () => set(q.result); });
$("btn-sauvegarder").addEventListener("click", async () => {
  const msg = $("msg-sauvegarde");
  msg.textContent = "Préparation de la sauvegarde…";
  try {
    const local = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^velo/.test(k)) local[k] = localStorage.getItem(k); }
    const s = { format: "velo-virtuel-sauvegarde", version: 1, date: Date.now(), local, resumes: [], donnees: [], mondes: [] };
    if (base) {
      s.resumes = (await lireTout("resumes")) || [];
      s.donnees = (await lireTout("donnees")) || [];
      const decor = $("sauve-decor").checked;
      s.mondes = ((await lireTout("mondes")) || []).map((m) => decor ? m : Object.assign({}, m, { osm: null, ign: null, hd: null }));
    }
    const texte = JSON.stringify(s), d = new Date(), nom = "velo-virtuel-sauvegarde-" + d.getFullYear() + "-" + deuxChiffres(d.getMonth() + 1) + "-" + deuxChiffres(d.getDate()) + ".json";
    telecharger(new TextEncoder().encode(texte), nom);
    const nbS = s.resumes.length || lireIndexLocal().length;
    msg.textContent = "Sauvegarde « " + nom + " » téléchargée (" + nbS + " séance" + (nbS > 1 ? "s" : "") + ", " + s.mondes.length + " monde" + (s.mondes.length > 1 ? "s" : "") + ", " + fr1(texte.length / 1048576) + " Mo).";
    log("Sauvegarde des données téléchargée : " + nom + ".");
  } catch (e) {
    msg.textContent = "Sauvegarde impossible : " + e.message + ".";
  }
});
$("fichier-sauvegarde").addEventListener("change", async (e) => {
  const f = e.target.files[0], msg = $("msg-sauvegarde");
  e.target.value = "";
  if (!f) return;
  try {
    const s = JSON.parse(await f.text());
    if (!s || s.format !== "velo-virtuel-sauvegarde" || !s.local) throw new Error("ce fichier n’est pas une sauvegarde du Vélo virtuel");
    const nbS = (s.resumes || []).length;
    if (!confirm("Restaurer la sauvegarde du " + new Date(s.date).toLocaleDateString("fr-FR") + " ?\n\nTes réglages, ta progression et tes records seront remplacés par ceux de la sauvegarde ; les séances (" + nbS + ") et les mondes de la sauvegarde seront ajoutés à ceux déjà présents. La page sera ensuite rechargée.")) return;
    msg.textContent = "Restauration en cours…";
    for (const k in s.local) if (/^velo/.test(k)) localStorage.setItem(k, s.local[k]);
    if (base) {
      if ((s.resumes || []).length || (s.donnees || []).length) await transaction(["resumes", "donnees"], "readwrite", (t) => {
        for (const r of s.resumes || []) t.objectStore("resumes").put(r);
        for (const r of s.donnees || []) t.objectStore("donnees").put(r);
      });
      // un monde déjà présent avec son décor n'est pas remplacé par une copie sans décor
      const deja = {};
      for (const m of (await lireTout("mondes")) || []) deja[m.id] = m;
      const aMettre = (s.mondes || []).filter((m) => !(deja[m.id] && deja[m.id].osm && !m.osm));
      if (aMettre.length) await transaction(["mondes"], "readwrite", (t) => { for (const m of aMettre) t.objectStore("mondes").put(m); });
    }
    msg.textContent = "Sauvegarde restaurée : la page va se recharger.";
    log("Sauvegarde restaurée.");
    setTimeout(() => location.reload(), 1200);
  } catch (err) {
    msg.textContent = "Restauration impossible : " + err.message + ".";
  }
});

/* =====================================================================
   (v69 suite) Commandes au clavier pendant la sortie (en plus d'Espace = pause et V = caméra) ; touche K : aide
   ===================================================================== */
const TOUCHES = [
  ["Espace", "Pause / reprise"], ["V ou 1 à 6", "Changer de caméra (6 = télévision)"], ["F", "Plein écran"], ["P", "Prendre une photo (à télécharger à la fin, pour Strava)"], ["H", "Cacher / montrer les encarts (HUD)"],
  ["↑ / ↓", "Séance ERG : intensité +5 % / −5 % ; sinon réalisme de la pente ±10 %"], ["N", "Séance ERG : passer à l’intervalle suivant"],
  ["M", "Couper / remettre le son"], ["E", "Ouvrir le deuxième écran (tableau de bord)"], ["K", "Afficher / cacher cette aide"]
];
function basculerAideClavier() {
  const a = $("aide-clavier");
  if (!a.innerHTML) a.innerHTML = "<b>Commandes au clavier</b>" + TOUCHES.map((t) => "<div><kbd>" + t[0] + "</kbd><span>" + t[1] + "</span></div>").join("");
  a.hidden = !a.hidden;
}
document.addEventListener("keydown", (e) => {
  if ($("onglet-world").hidden || $("world-jeu").hidden || e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target && e.target.tagName;
  if (t === "INPUT" || t === "SELECT" || t === "TEXTAREA") return;
  const k = e.key, erg = modeActuel() === "erg";
  if (/^[1-9]$/.test(k)) {
    const o = $("vue-camera"), i = parseInt(k, 10) - 1;
    if (i < o.options.length) { o.selectedIndex = i; o.dispatchEvent(new Event("change")); }
  } else if (k === "f" || k === "F") $("btn-plein-ecran").click();
  else if (k === "h" || k === "H") $("hud-zone").classList.toggle("hud-cache");
  else if (k === "p" || k === "P") Photos.prendre();                         // (v72) photo de la sortie
  else if (k === "e" || k === "E") $("btn-ecran2").click();
  else if (k === "m" || k === "M") { $("son-actif").checked = !$("son-actif").checked; $("son-actif").dispatchEvent(new Event("change")); annoncer($("son-actif").checked ? "Son activé" : "Son coupé", "", "", 2); }
  else if (k === "k" || k === "K" || k === "?") basculerAideClavier();
  else if (k === "ArrowUp" || k === "ArrowDown") {
    e.preventDefault();
    const s = k === "ArrowUp" ? 1 : -1;
    if (erg) {
      seance.k = Math.round(borner((seance.k || 1) + s * 0.05, 0.5, 1.5) * 100) / 100;
      annoncer("Intensité " + Math.round(seance.k * 100) + " %", "de la séance ERG", "", 2);
    } else {
      const d = $("difficulte"); d.value = String(borner((parseInt(d.value, 10) || 0) + s * 10, 0, 100));
      d.dispatchEvent(new Event("input"));
      annoncer("Réalisme de la pente " + d.value + " %", "résistance du home trainer", "", 2);
    }
  } else if ((k === "n" || k === "N") && erg) {
    const cur = intervalleA(balade.temps - seance.t0);
    if (cur) { seance.t0 -= cur.reste - 0.05; seance.saute = true; annoncer("Intervalle suivant", "", "", 2); }
  } else return;
});
$("btn-aide-clavier").addEventListener("click", basculerAideClavier);
