"use strict";
/* =====================================================================
   Séance structurée (mode ERG)
   ===================================================================== */
const seance = { intervalles: [], t0: 0, nom: "", textes: [], texteI: 0 };   // (v69 suite) nom, messages du fichier .erg ([COURSE TEXT] : [secondes, texte, durée])
const rep = (n, blocs) => { const r = []; for (let i = 0; i < n; i++) r.push(...blocs); return r; };
const BIBLIO = [
  { cat: "Endurance et récupération", nom: "Récupération active", desc: "Jambes légères pour éliminer la fatigue.", blocs: [[5, 45, 55], [20, 50], [5, 55, 45]] },
  { cat: "Endurance et récupération", nom: "Endurance 45 min", desc: "Base aérobie, facile à tenir.", blocs: [[10, 55], [25, 70], [10, 50]], id: "endurance" },
  { cat: "Endurance et récupération", nom: "Endurance 1 h", desc: "Allure conversation, cadence régulière.", blocs: [[10, 50, 65], [40, 68], [10, 65, 45]] },
  // (v69 suite) séances guidées par la fréquence cardiaque (5e valeur = % de la FC max) : la puissance s'adapte pour tenir la FC
  { cat: "Endurance et récupération", nom: "Endurance FC 1 h", desc: "Guidée par le cœur : la puissance s’ajuste pour rester à 72 % de ta FC max (zone 2). Idéal les jours de fatigue ou de chaleur. Ceinture cardio conseillée.", blocs: [[10, 50, 65], [40, 65, undefined, false, 72], [10, 60, 45]] },
  { cat: "Endurance et récupération", nom: "Récupération FC 40 min", desc: "Guidée par le cœur : 30 min à 65 % de ta FC max, la puissance baisse si ton cœur monte. Ceinture cardio conseillée.", blocs: [[5, 45, 55], [30, 50, undefined, false, 65], [5, 50, 40]] },
  { cat: "Endurance et récupération", nom: "Sortie longue 2 h", desc: "Longue sortie à intensité basse, avec rampes douces.", blocs: [[15, 50, 65], [90, 68], [15, 65, 45]] },
  { cat: "Tempo et sweet spot", nom: "Tempo 2 × 15 min", desc: "Deux blocs au tempo pour la résistance.", blocs: [[10, 55, 70], [15, 82], [5, 55], [15, 82], [5, 55, 45]] },
  { cat: "Tempo et sweet spot", nom: "Sweet spot 2 × 10 min", desc: "Beaucoup de gain pour peu de fatigue.", blocs: [[10, 55], [10, 90], [4, 55], [10, 90], [10, 50]] },
  { cat: "Tempo et sweet spot", nom: "Sweet spot 3 × 12 min", desc: "Trois blocs à 90 % du FTP.", blocs: [[10, 50, 70], ...rep(3, [[12, 90], [4, 55]]), [6, 60, 45]] },
  { cat: "Seuil", nom: "Seuil 3 × 5 min", desc: "Trois efforts au seuil, récupération courte.", blocs: [[10, 55], [5, 100], [3, 55], [5, 100], [3, 55], [5, 100], [3, 55], [5, 50]], id: "seuil" },
  { cat: "Seuil", nom: "Seuil 2 × 20 min", desc: "Séance classique pour monter son FTP.", blocs: [[12, 50, 70], [20, 98], [6, 55], [20, 98], [10, 60, 45]] },
  { cat: "Seuil", nom: "Over-under", desc: "Alterne juste sous et juste au-dessus du seuil.", blocs: [[12, 50, 70], ...rep(2, [...rep(3, [[3, 92], [1, 108]]), [6, 55]]), [8, 55, 45]] },
  { cat: "VO2max et anaérobie", nom: "VO2max 5 × 3 min", desc: "Cinq efforts à 115 % du FTP.", blocs: [[12, 50, 70], ...rep(5, [[3, 115], [3, 50]]), [6, 50, 40]] },
  { cat: "VO2max et anaérobie", nom: "30/30 – 2 séries de 8", desc: "30 s très dur, 30 s facile.", blocs: [[12, 50, 70], ...rep(8, [[0.5, 130], [0.5, 50]]), [5, 50], ...rep(8, [[0.5, 130], [0.5, 50]]), [8, 50, 40]] },
  { cat: "VO2max et anaérobie", nom: "Pyramide", desc: "Efforts de 1 à 4 min puis retour.", blocs: [[10, 50, 70], [1, 105], [1, 55], [2, 105], [2, 55], [3, 105], [3, 55], [4, 105], [4, 55], [3, 105], [3, 55], [2, 105], [2, 55], [1, 105], [5, 50, 40]] },
  { cat: "VO2max et anaérobie", nom: "Sprints 8 × 15 s", desc: "Sprints explosifs, longue récupération.", blocs: [[10, 50, 70], ...rep(8, [[0.25, 170], [3.75, 50]]), [5, 50, 40]] },
  { cat: "Tests", nom: "Test FTP 20 minutes", desc: "Échauffement, 5 min d’effort libre pour « vider les jambes », récupération, puis 20 min à fond mais régulier. FTP ≈ 95 % de ta puissance moyenne sur les 20 min. Pendant les efforts libres, le home trainer reste à 0 % de pente : tu choisis ton braquet.", blocs: [[12, 50, 70], [5, 100, undefined, true], [10, 50], [20, 100, undefined, true], [5, 45]] },
  { cat: "Tests", nom: "Test FTP 2 × 8 minutes", desc: "Deux efforts libres de 8 min, réguliers et à fond. FTP ≈ 90 % de ta meilleure moyenne sur 8 min. Plus court et plus facile à faire que le test de 20 min.", blocs: [[12, 50, 70], [8, 100, undefined, true], [10, 50], [8, 100, undefined, true], [5, 45]] },
  { cat: "Tests", nom: "Test en rampe", desc: "La puissance monte jusqu’à l’épuisement : ton meilleur 1 min × 0,75 estime le FTP.", blocs: [[5, 45], [20, 50, 130], [5, 40]] }
];
const blocsVersIntervalles = (blocs) => blocs.map(([min, pct, fin, libre, fc]) => {
  const iv = fin !== undefined ? { min, pct, fin } : { min, pct };
  if (libre) iv.libre = true;
  if (fc) iv.fc = fc;                         // (v69 suite) fréquence cardiaque visée, en % de la FC max ; pct = puissance de départ
  return iv;
});
const pctA = (iv, frac) => (iv.fin !== undefined ? iv.pct + (iv.fin - iv.pct) * borner(frac, 0, 1) : iv.pct);
const pctMoyen = (iv) => (iv.fin !== undefined ? (iv.pct + iv.fin) / 2 : iv.pct);
function libW(iv) {
  if (iv.libre) return "libre";
  if (iv.fc) return "FC " + Math.round(iv.fc * fcmax() / 100) + " bpm";
  const a = Math.round(iv.pct * ftp() / 100);
  return iv.fin !== undefined ? a + "→" + Math.round(iv.fin * ftp() / 100) + " W" : a + " W";
}
function libelleInt(iv) {
  if (iv.fc) return formatMinutes(iv.min) + " guidées par le cœur : " + iv.fc + " % de ta FC max (" + libW(iv) + "), la puissance s’ajuste";
  if (iv.libre) return formatMinutes(iv.min) + " en effort libre (à fond mais régulier, le home trainer ne t’impose rien)";
  return iv.fin !== undefined
    ? formatMinutes(iv.min) + " en rampe de " + iv.pct + " à " + iv.fin + " % du FTP (" + libW(iv) + ")"
    : formatMinutes(iv.min) + " à " + iv.pct + " % du FTP (" + libW(iv) + ")";
}
function statsSeance(ints) {
  let sec = 0, p4 = 0;
  for (const iv of ints) {
    const d = iv.min * 60;
    for (let k = 0; k < 8; k++) { const p = pctA(iv, (k + 0.5) / 8) / 100; p4 += Math.pow(p, 4) * d / 8; }
    sec += d;
  }
  const IF = sec ? Math.pow(p4 / sec, 0.25) : 0;
  return { sec, IF, tss: sec / 3600 * IF * IF * 100 };
}

const dureeSeance = () => seance.intervalles.reduce((s, x) => s + x.min * 60, 0);

function intervalleA(t) {
  let cumul = 0;
  for (let i = 0; i < seance.intervalles.length; i++) {
    const d = seance.intervalles[i].min * 60;
    if (t < cumul + d) return { i, reste: cumul + d - t, iv: seance.intervalles[i] };
    cumul += d;
  }
  return null;
}

function rendreSeance() {
  const liste = $("liste-int");
  liste.innerHTML = "";
  seance.intervalles.forEach((iv, i) => {
    const li = document.createElement("li");
    li.append(document.createTextNode(libelleInt(iv)));
    const b = document.createElement("button");
    b.className = "petit"; b.textContent = "Retirer";
    b.addEventListener("click", () => { seance.intervalles.splice(i, 1); sauverReglages(); rendreSeance(); });
    li.append(b);
    liste.append(li);
  });
  $("duree-seance").textContent = seance.intervalles.length
    ? "Durée totale : " + formatDuree(dureeSeance()) + "."
    : "Aucun intervalle pour l’instant : charge un modèle ou ajoutes-en.";
  dessinerSeance();
}

function majAffichageErg() {
  const t = balade.temps - seance.t0;
  const total = dureeSeance();
  if (!seance.intervalles.length) {
    $("pente-affichee").innerHTML = "–";
    $("pente-envoyee").textContent = "Mode ERG : ajoute des intervalles dans la séance structurée.";
    $("etat-seance").textContent = "";
    $("a-venir").textContent = "";
    return;
  }
  if (t >= total) {
    log("Séance terminée. Retour à la pente du parcours.");
    if (seance.puisCourse) { finEchauffement(); return; }     // fin de l'échauffement : la course part d'ici
    // séance dont des intervalles ont été passés (touche N) : pas d'estimation du FTP
    // (v69 suite) test FTP terminé : estimation proposée (dans l'annonce, puis dans le résumé de fin avec un bouton pour l'appliquer)
    const tt = seance.saute ? null : typeTest(seance.intervalles), est = tt ? estimationFtp(meilleuresPuissances(session.samples), tt) : null;
    seance.ftpTest = est && est.w > 50 ? est : null;
    if (seance.ftpTest) log("Test FTP terminé : FTP estimé à " + est.w + " W (" + est.txt + "). Tu peux l’appliquer dans le résumé de fin de sortie.");
    if (typeof annoncer === "function" && !$("onglet-world").hidden) annoncer(seance.ftpTest ? "Test terminé : FTP " + est.w + " W" : "Séance terminée", seance.ftpTest ? "Ton FTP actuel : " + ftp() + " W · à valider à la fin de la sortie" : seance.nom || "Bravo !", "arrivee", 8);
    document.querySelector("input[name=mode][value=route]").checked = true;
    reinitialiserEnvois();
    return;
  }
  const cur = intervalleA(t);
  // messages du fichier .erg au bon moment (grande annonce sur l'écran de course)
  while (seance.textes && seance.texteI < seance.textes.length && seance.textes[seance.texteI][0] <= t) {
    const m = seance.textes[seance.texteI++];
    if (t - m[0] < 10 && typeof annoncer === "function") annoncer(m[1], "", "", Math.min(30, Math.max(4, m[2] || 8)));
  }
  if (cur.iv.libre) {
    envoyerPenteValeur(0);
    $("pente-affichee").innerHTML = "Libre";
    $("pente-envoyee").textContent = "Effort libre : choisis ton braquet, à fond mais régulier. Reste " + formatDuree(cur.reste) + ".";
    $("etat-seance").textContent = "Temps écoulé dans la séance : " + formatDuree(t) + " sur " + formatDuree(total) + ".";
    const sv = seance.intervalles[cur.i + 1];
    $("a-venir").textContent = sv ? "Ensuite : " + libelleInt(sv) : "Dernier intervalle de la séance.";
    return;
  }
  let watts = Math.round(pctA(cur.iv, 1 - cur.reste / (cur.iv.min * 60)) * ftp() / 100 * (seance.k || 1));   // seance.k : intensité réglée au clavier (↑ ↓)
  if (cur.iv.fc) watts = puissancePourFc(cur, watts);
  envoyerPuissanceCible(watts);
  $("pente-affichee").innerHTML = watts + "&nbsp;W";
  $("pente-envoyee").textContent = trainer.pret
    ? "Puissance cible imposée au home trainer, intervalle " + (cur.i + 1) + "/" + seance.intervalles.length + ", reste " + formatDuree(cur.reste)
    : "Home trainer non connecté : la puissance cible n’est pas envoyée.";
  $("etat-seance").textContent = "Temps écoulé dans la séance : " + formatDuree(t) + " sur " + formatDuree(total) + ".";
  const suiv = seance.intervalles[cur.i + 1];
  $("a-venir").textContent = suiv
    ? "Ensuite : " + libelleInt(suiv)
    : "Dernier intervalle de la séance.";
}

function dessinerBlocs(c, ints, curseur) {
  const dpr = window.devicePixelRatio || 1;
  const w = c.clientWidth, h = c.clientHeight;
  if (!w) return;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const total = ints.reduce((s, x) => s + x.min * 60, 0);
  if (!total) return;
  const maxPct = Math.max(120, ...ints.map((x) => Math.max(x.pct, x.fin || 0)));
  let x = 0;
  for (const iv of ints) {
    const largeur = Math.max(iv.min * 60 / total * w - 0.6, 0.8);
    const h1 = (iv.pct / maxPct) * (h - 4), h2 = (pctA(iv, 1) / maxPct) * (h - 4);
    ctx.fillStyle = ZONES_P[indexZone(ZONES_P, pctMoyen(iv) / 100)].couleur;
    ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x, h - h1); ctx.lineTo(x + largeur, h - h2); ctx.lineTo(x + largeur, h); ctx.closePath(); ctx.fill();
    x += largeur + 0.6;
  }
  if (curseur !== undefined) {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(borner(curseur / total, 0, 1) * w - 1, 0, 2, h);
  }
}
function dessinerSeance() {
  dessinerBlocs($("profil-seance"), seance.intervalles, modeActuel() === "erg" ? balade.temps - seance.t0 : undefined);
}

// (v69 suite) intervalle guidé par la FC : toutes les 5 s, la puissance imposée monte ou baisse doucement (±5 W au plus, rien à ±2 bpm près :
// le cœur réagit avec 30 à 60 s de retard) selon l'écart
// entre ta FC et la FC visée, entre 35 % et 95 % du FTP ; sans fréquence cardiaque reçue, on garde la puissance de départ
const etatFc = { i: -1, w: 0, t: 0 };
function fcActuelle() { const a = valeur(ceinture, "hr"); return a !== null ? a : (valeur(trainer, "hr") > 0 ? trainer.hr : null); }
function puissancePourFc(cur, depart) {
  const t = balade.temps - seance.t0, hr = fcActuelle(), cible = cur.iv.fc * fcmax() / 100;
  if (etatFc.i !== cur.i) { etatFc.i = cur.i; etatFc.w = depart; etatFc.t = t; }
  if (hr !== null && t - etatFc.t >= 5) {
    etatFc.t = t;
    const ec = cible - hr;
    if (Math.abs(ec) > 2) etatFc.w = borner(etatFc.w + borner(ec * 0.6, -5, 5), 0.35 * ftp(), 0.95 * ftp());
  }
  return Math.round(hr !== null ? etatFc.w : depart);
}
// (v69 suite) échauffement avant la course : 10 min progressives en ERG, les autres coureurs attendent ; à la fin, départ de la course
const ECHAUFFEMENT = [[4, 45, 60], [3, 65, 75], [1, 90], [2, 55]];
function lancerEchauffement() {
  chargerSeance(ECHAUFFEMENT, true, "Échauffement", [[2, "Échauffement : 10 min, puis départ de la course", 6], [420, "Une minute à 90 % pour réveiller les jambes", 6], [540, "Départ de la course dans 1 minute !", 6]]);
  seance.puisCourse = true;
}
const echauffementEnCours = () => !!seance.puisCourse && modeActuel() === "erg";
function finEchauffement() {                                   // départ de la course (échauffement fini, passé ou interrompu)
  seance.puisCourse = false;
  document.querySelector("input[name=mode][value=route]").checked = true; reinitialiserEnvois();
  lancerPeloton();
  if (typeof annoncer === "function") annoncer("Départ de la course !", "Échauffement terminé · bonne course", "arrivee", 6);
  log("Échauffement terminé : départ de la course.");
}
function chargerSeance(blocs, activerErg, nom, textes) {
  etatFc.i = -1; seance.puisCourse = false; seance.k = 1; seance.saute = false;
  seance.intervalles = Array.isArray(blocs[0]) ? blocsVersIntervalles(blocs) : blocs.map((x) => Object.assign({}, x));
  if (nom !== undefined) { seance.nom = nom || ""; seance.textes = textes || []; }
  seance.texteI = 0;
  sauverReglages(); rendreSeance();
  if (activerErg) {
    document.querySelector("input[name=mode][value=erg]").checked = true;
    seance.t0 = balade.temps; reinitialiserEnvois();
    log("Mode ERG activé : démarre la balade pour lancer la séance.");
  }
}
$("btn-erg-rapide").addEventListener("click", () => {
  if (!seance.intervalles.length) { log("Aucune séance chargée."); return; }
  chargerSeance(seance.intervalles, true);
  choisirSeanceChargee();
});

/* ----- Bibliothèque et séances importées ----- */
const CLE_SEANCES = "velo-virtuel-seances";
let seancesImportees = [];
function lireImportees() { try { seancesImportees = JSON.parse(localStorage.getItem(CLE_SEANCES) || "[]"); } catch (e) { seancesImportees = []; } if (!Array.isArray(seancesImportees)) seancesImportees = []; }
function sauverImportees() { try { localStorage.setItem(CLE_SEANCES, JSON.stringify(seancesImportees)); } catch (e) { /* ignoré */ } }

function carteSeance(nom, desc, ints, supprimer, textes, modifier) {
  const st = statsSeance(ints);
  const div = document.createElement("div"); div.className = "seance-carte";
  div.innerHTML = '<div class="nom"></div><div class="desc"></div><canvas></canvas><div class="meta"></div><div class="boutons"></div>';
  div.querySelector(".nom").textContent = nom;
  div.querySelector(".desc").textContent = desc || "";
  div.querySelector(".meta").textContent = formatDuree(Math.round(st.sec)) + " · intensité " + fr2(st.IF) + " · TSS ≈ " + Math.round(st.tss);
  const bt = div.querySelector(".boutons");
  const b1 = document.createElement("button"); b1.textContent = "Charger";
  b1.addEventListener("click", () => { chargerSeance(ints, false, nom, textes); log("Séance « " + nom + " » chargée."); });
  const b2 = document.createElement("button"); b2.className = "plein"; b2.textContent = "Rouler cette séance";
  b2.addEventListener("click", () => { chargerSeance(ints, true, nom, textes); choisirSeanceChargee(); log("Séance « " + nom + " » chargée."); });
  bt.append(b1, b2);
  if (modifier) { const b4 = document.createElement("button"); b4.className = "petit"; b4.textContent = "Modifier"; b4.addEventListener("click", modifier); bt.append(b4); }   // (v69 suite) séance créée
  if (supprimer) { const b3 = document.createElement("button"); b3.className = "petit"; b3.textContent = "Supprimer"; b3.addEventListener("click", supprimer); bt.append(b3); }
  return { div, canvas: div.querySelector("canvas"), ints };
}
function rendreBiblio() {
  const conteneur = $("biblio");
  conteneur.innerHTML = "";
  const cartes = [];
  const groupes = [];
  if (seancesImportees.length) groupes.push({ cat: "Mes séances (créées ou importées)", items: seancesImportees.map((s, i) => ({ nom: s.nom, desc: (s.cree ? "Créée par toi." : "Importée depuis un fichier.") + (s.textes && s.textes.length ? " " + s.textes.length + " message" + (s.textes.length > 1 ? "s" : "") + " affiché" + (s.textes.length > 1 ? "s" : "") + " pendant la séance." : ""), ints: s.ints, textes: s.textes,
    modif: s.cree && typeof Createur !== "undefined" ? () => Createur.modifier(s) : null, suppr: () => { if (!confirm("Supprimer la séance « " + s.nom + " » ?")) return; seancesImportees.splice(i, 1); sauverImportees(); rendreBiblio(); } })) });
  for (const b of BIBLIO) {
    let g = groupes.find((x) => x.cat === b.cat);
    if (!g) { g = { cat: b.cat, items: [] }; groupes.push(g); }
    g.items.push({ nom: b.nom, desc: b.desc, ints: blocsVersIntervalles(b.blocs) });
  }
  for (const g of groupes) {
    const h = document.createElement("h3"); h.textContent = g.cat; conteneur.append(h);
    const grille = document.createElement("div"); grille.className = "grille-seances"; conteneur.append(grille);
    for (const it of g.items) { const c = carteSeance(it.nom, it.desc, it.ints, it.suppr, it.textes, it.modif); grille.append(c.div); cartes.push(c); }
  }
  requestAnimationFrame(() => cartes.forEach((c) => dessinerBlocs(c.canvas, c.ints)));
  majChoixSeanceMonde();
}

/* ----- Import de fichiers .erg / .mrc / .zwo ----- */
function pointsVersBlocs(points, pourcent) {
  const blocs = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const dt = points[i + 1][0] - points[i][0];
    if (!(dt > 0.0001)) continue;
    const conv = (v) => Math.round(pourcent ? v : v / ftp() * 100);
    const a = conv(points[i][1]), b = conv(points[i + 1][1]);
    blocs.push(Math.abs(a - b) <= 1 ? [dt, a] : [dt, a, b]);
  }
  return blocs;
}
function lireErg(texte, nomFichier) {
  const lignes = texte.replace(/\r/g, "").split("\n").map((l) => l.trim());
  let pourcent = /\.mrc$/i.test(nomFichier), dansDonnees = false, dansTextes = false, nom = "";
  const points = [], textes = [];
  for (const l of lignes) {
    const u = l.toUpperCase();
    if (!l) continue;
    if (u.startsWith("[COURSE DATA]")) { dansDonnees = true; continue; }
    if (u.startsWith("[END COURSE DATA]")) { dansDonnees = false; continue; }
    if (u.startsWith("[COURSE TEXT]")) { dansTextes = true; dansDonnees = false; continue; }
    if (u.startsWith("[")) { dansDonnees = false; dansTextes = false; continue; }
    if (dansTextes) {                                       // « secondes <tab> message <tab> durée »
      const p = l.split("\t").map((x) => x.trim()).filter((x) => x !== "");
      const s0 = parseFloat((p[0] || "").replace(",", "."));
      if (p.length >= 2 && Number.isFinite(s0)) textes.push([s0, p[1].slice(0, 120), parseFloat(p[2]) || 8]);
      continue;
    }
    if (dansDonnees) {
      const m = l.split(/[\s,;\t]+/).map((x) => parseFloat(x.replace(",", ".")));
      if (m.length >= 2 && Number.isFinite(m[0]) && Number.isFinite(m[1])) points.push([m[0], m[1]]);
    } else {
      if (/MINUTES\s+PERCENT/i.test(l)) pourcent = true;
      if (/MINUTES\s+WATTS/i.test(l)) pourcent = false;
      const d = l.match(/^(DESCRIPTION|FILE NAME)\s*=\s*(.+)$/i);
      if (d && !nom) nom = d[2].trim();
    }
  }
  const blocs = pointsVersBlocs(points, pourcent);
  return { nom: nom || nomFichier.replace(/\.[^.]+$/, ""), blocs, textes: textes.sort((a, b) => a[0] - b[0]) };
}
function lireZwo(texte, nomFichier) {
  const doc = new DOMParser().parseFromString(texte, "text/xml");
  if (doc.querySelector("parsererror")) return { nom: nomFichier, blocs: [] };
  const blocs = [];
  const n = (el, a, def) => { const v = parseFloat(el.getAttribute(a)); return Number.isFinite(v) ? v : def; };
  const wo = doc.querySelector("workout") || doc.documentElement;
  for (const el of wo.children) {
    const t = el.tagName, d = n(el, "Duration", 0) / 60;
    if (t === "SteadyState" && d > 0) blocs.push([d, Math.round(n(el, "Power", 0.6) * 100)]);
    else if ((t === "Warmup" || t === "Cooldown" || t === "Ramp") && d > 0) blocs.push([d, Math.round(n(el, "PowerLow", 0.5) * 100), Math.round(n(el, "PowerHigh", 0.7) * 100)]);
    else if (t === "FreeRide" && d > 0) blocs.push([d, 60]);
    else if (t === "IntervalsT") {
      const r = n(el, "Repeat", 1), on = n(el, "OnDuration", 0) / 60, off = n(el, "OffDuration", 0) / 60;
      for (let i = 0; i < r; i++) { if (on > 0) blocs.push([on, Math.round(n(el, "OnPower", 1) * 100)]); if (off > 0) blocs.push([off, Math.round(n(el, "OffPower", 0.5) * 100)]); }
    }
  }
  const nomEl = doc.querySelector("name");
  return { nom: (nomEl && nomEl.textContent.trim()) || nomFichier.replace(/\.[^.]+$/, ""), blocs };
}
// (v69 suite) plusieurs fichiers à la fois ; la dernière séance importée est chargée (et choisie sur la page d'accueil)
$("fichier-erg").addEventListener("change", async (e) => {
  const fs = Array.from(e.target.files);
  e.target.value = "";
  for (const f of fs) await importerSeance(f, f === fs[fs.length - 1]);
});
async function importerSeance(f, charger) {
  try {
    const texte = await f.text();
    const r = /\.(zwo|xml)$/i.test(f.name) ? lireZwo(texte, f.name) : lireErg(texte, f.name);
    if (!r.blocs.length) throw new Error("aucun intervalle reconnu dans ce fichier");
    const ints = blocsVersIntervalles(r.blocs.map(([min, pct, fin]) => [min, borner(pct, 10, 400), fin === undefined ? undefined : borner(fin, 10, 400)]));
    seancesImportees = seancesImportees.filter((s) => s.nom !== r.nom);        // même nom : la nouvelle version remplace l'ancienne
    seancesImportees.unshift({ nom: r.nom, ints: ints, textes: r.textes || [] });
    seancesImportees = seancesImportees.slice(0, 30);
    sauverImportees(); rendreBiblio();
    if (!charger) return;
    chargerSeance(ints, false, r.nom, r.textes || []);
    if ($("seance-monde")) { majChoixSeanceMonde(); $("seance-monde").value = "imp:" + r.nom; majResumeChoixSeance(); }
    $("msg-import").textContent = "« " + r.nom + " » importée (" + formatDuree(Math.round(ints.reduce((s, x) => s + x.min * 60, 0))) + ") et chargée.";
    if ($("msg-import-a")) $("msg-import-a").textContent = "« " + r.nom + " » importée : elle sera suivie en mode ERG pendant la sortie.";
    log("Séance importée : " + r.nom + ".");
  } catch (err) {
    $("msg-import").textContent = "Import impossible (" + f.name + ") : " + err.message + ".";
    if ($("msg-import-a")) $("msg-import-a").textContent = $("msg-import").textContent;
    log("Import de séance impossible : " + err.message);
  }
}

/* ----- (v69 suite) choix de la séance sur la page d'accueil : suivie en mode ERG pendant la sortie dans le monde ----- */
function seancesChoix() {
  const l = [];
  if (seance.intervalles.length) l.push({ cle: "charge", groupe: "", nom: "Séance chargée" + (seance.nom ? " : " + seance.nom : ""), vrai: seance.nom, ints: seance.intervalles, textes: seance.textes });
  seancesImportees.forEach((s) => l.push({ cle: "imp:" + s.nom, groupe: "Mes séances", nom: s.nom, vrai: s.nom, ints: s.ints, textes: s.textes }));
  BIBLIO.forEach((b, i) => l.push({ cle: "bib:" + i, groupe: b.cat, nom: b.nom, vrai: b.nom, ints: blocsVersIntervalles(b.blocs) }));
  return l;
}
let choixSig = "", choixListe = [];
function majChoixSeanceMonde() {
  const sel = $("seance-monde");
  if (!sel) return;
  const sig = JSON.stringify([seance.nom, seance.intervalles.length, seancesImportees.map((s) => s.nom), ftp(), fcmax()]);
  if (sig === choixSig && sel.options.length > 1) return;
  choixSig = sig; choixListe = seancesChoix();
  const garde = sel.value || (modeActuel() === "erg" && seance.intervalles.length ? "charge" : "");
  sel.innerHTML = '<option value="">Aucune (résistance d’après la pente)</option>';
  let grp = null, nomGrp = null;
  for (const s of choixListe) {
    if (s.groupe !== nomGrp) { nomGrp = s.groupe; grp = s.groupe ? document.createElement("optgroup") : sel; if (s.groupe) { grp.label = s.groupe; sel.append(grp); } }
    const o = document.createElement("option"); o.value = s.cle; o.textContent = s.nom + " · " + formatDuree(Math.round(s.ints.reduce((a, x) => a + x.min * 60, 0)));
    grp.append(o);
  }
  sel.value = [...sel.options].some((o) => o.value === garde) ? garde : "";
}
function seanceChoisie() { const v = $("seance-monde") ? $("seance-monde").value : ""; return v ? (choixListe.length ? choixListe : seancesChoix()).find((s) => s.cle === v) || null : null; }
// séance activée depuis l'onglet Séances : elle devient la séance choisie de la page d'accueil (sinon « Aucune » la couperait au départ)
function choisirSeanceChargee() { majChoixSeanceMonde(); if ($("seance-monde")) { $("seance-monde").value = "charge"; majResumeChoixSeance(); } }
function majResumeChoixSeance() { if (typeof majResumeChoix === "function") majResumeChoix(); }
// au départ (« C'est parti ») : séance choisie → mode ERG ; « Aucune » → pente du parcours
function appliquerSeanceChoisie() {
  if (session.samples.length) return;                           // sortie déjà commencée : on ne change rien
  const s = seanceChoisie();
  if (s) { chargerSeance(s.ints, true, s.vrai, s.textes || []); }
  else if (modeActuel() === "erg") { document.querySelector("input[name=mode][value=route]").checked = true; reinitialiserEnvois(); }
}
lireImportees();
rendreBiblio();

$("btn-vider").addEventListener("click", () => { seance.intervalles = []; sauverReglages(); rendreSeance(); });
$("btn-ajout").addEventListener("click", () => {
  const min = parseFloat($("nv-min").value), pct = parseFloat($("nv-pct").value);
  if (!(min >= 0.5) || !(pct >= 20)) { log("Intervalle invalide : durée d’au moins 0,5 min et puissance d’au moins 20 % du FTP."); return; }
  seance.intervalles.push({ min, pct: Math.round(pct) });
  sauverReglages(); rendreSeance();
});

/* =====================================================================
   Résumé statistique d’une séance (utilisé en direct et dans l’historique)
   ===================================================================== */
function resumer(s, ftpVal, fcmaxVal) {
  const n = s.length;
  const pw = s.map((x) => x.p || 0);
  const somme = pw.reduce((a, b) => a + b, 0);
  const moy = n ? somme / n : 0;
  let np = moy;
  if (n >= 30) {
    const roule = []; let acc = 0;
    for (let i = 0; i < n; i++) {
      acc += pw[i];
      if (i >= 30) acc -= pw[i - 30];
      if (i >= 29) roule.push(acc / 30);
    }
    np = Math.pow(roule.reduce((a, b) => a + Math.pow(b, 4), 0) / roule.length, 0.25);
  }
  const facteur = np / ftpVal;
  const tss = n ? (n * np * facteur) / (ftpVal * 3600) * 100 : 0;
  const fcs = s.filter((x) => x.hr != null).map((x) => x.hr);
  const cads = s.filter((x) => x.c != null && x.c > 0).map((x) => x.c);
  const moyenne = (t) => t.reduce((a, b) => a + b, 0) / t.length;
  const maximum = (t) => t.reduce((a, b) => Math.max(a, b), -Infinity);

  let dplus = 0;
  for (let i = 1; i < n; i++) { const d = s[i].alt - s[i - 1].alt; if (d > 0) dplus += d; }
  const distance = n ? s[n - 1].d : 0;
  const kj = somme / 1000;

  const zonesP = ZONES_P.map(() => 0), zonesFC = ZONES_FC.map(() => 0);
  for (const x of s) {
    zonesP[indexZone(ZONES_P, (x.p || 0) / ftpVal)]++;
    if (x.hr != null) zonesFC[indexZone(ZONES_FC, x.hr / fcmaxVal)]++;
  }
  return {
    n, distance, dplus, vitMoy: n ? distance / n * 3.6 : 0,
    kj, kcal: kj / 4.184 / 0.24,                          // rendement musculaire d’environ 24 %
    pMoy: moy, pMax: n ? maximum(pw) : 0, np, tss,
    fcMoy: fcs.length ? moyenne(fcs) : null, fcMax: fcs.length ? maximum(fcs) : null,
    cadMoy: cads.length ? moyenne(cads) : null, cadMax: cads.length ? maximum(cads) : null,
    zonesP, zonesFC
  };
}

const TUILES = [
  ["Durée", (r) => formatDuree(r.n)],
  ["Distance (km)", (r) => fr2(r.distance / 1000)],
  ["Dénivelé positif (m)", (r) => Math.round(r.dplus)],
  ["Vitesse moyenne (km/h)", (r) => r.n ? fr1(r.vitMoy) : "–"],
  ["Calories (kcal, estimation)", (r) => r.n ? Math.round(r.kcal) : "–"],
  ["Puissance moyenne (W)", (r) => r.n ? Math.round(r.pMoy) : "–"],
  ["Puissance maximale (W)", (r) => r.n ? Math.round(r.pMax) : "–"],
  ["Puissance normalisée (W)", (r) => r.n ? Math.round(r.np) : "–"],
  ["Charge d’entraînement (TSS)", (r) => r.n ? Math.round(r.tss) : "–"],
  ["Cadence moyenne (tr/min)", (r) => r.cadMoy !== null ? Math.round(r.cadMoy) : "–"],
  ["Cadence maximale (tr/min)", (r) => r.cadMax !== null ? Math.round(r.cadMax) : "–"],
  ["FC moyenne (bpm)", (r) => r.fcMoy !== null ? Math.round(r.fcMoy) : "–"],
  ["FC maximale (bpm)", (r) => r.fcMax !== null ? Math.round(r.fcMax) : "–"]
];
function rendreTuiles(conteneur, r, defs) {
  conteneur.innerHTML = (defs || TUILES).map(([lib, f]) =>
    '<div><div class="val">' + f(r) + '</div><div class="lib">' + lib + '</div></div>').join("");
}

function plageZone(zones, i, ref, unite) {
  const prec = i === 0 ? 0 : zones[i - 1].max;
  const bas = Math.round(prec * 100) + 1, basVal = Math.round(prec * ref) + 1;
  const nbsp = "\u00a0";
  if (i === 0) return "jusqu’à " + Math.round(zones[0].max * 100) + nbsp + "% (jusqu’à " + Math.round(zones[0].max * ref) + nbsp + unite + ")";
  if (zones[i].max === Infinity) return "plus de " + (bas - 1) + nbsp + "% (plus de " + (basVal - 1) + nbsp + unite + ")";
  return bas + "–" + Math.round(zones[i].max * 100) + nbsp + "% (" + basVal + "–" + Math.round(zones[i].max * ref) + nbsp + unite + ")";
}

function groupeZones(titre, zones, secondes, plages) {
  const max = Math.max(1, ...secondes);
  let html = '<div class="sous-titre">' + titre + '</div>';
  zones.forEach((z, i) => {
    html += '<div class="zone" title="' + z.lib + '"><span style="color:' + z.couleur + ';font-weight:700">' + z.nom + '</span>' +
      '<span class="plage">' + plages[i] + '</span>' +
      '<div class="barre-z"><div class="rempli" style="width:' + (secondes[i] / max * 100) + '%;background:' + z.couleur + '"></div></div>' +
      '<span class="temps">' + formatDuree(secondes[i]) + '</span></div>';
  });
  return html;
}
// Avec ftpVal et fcmaxVal : zones d’une séance (avec pourcentages et watts / bpm).
// Sans (null) : cumul de plusieurs séances, où les seuils peuvent avoir changé.
function rendreZones(conteneur, r, ftpVal, fcmaxVal) {
  const cumul = !ftpVal;
  const plagesP = ZONES_P.map((z, i) => cumul ? z.lib : plageZone(ZONES_P, i, ftpVal, "W"));
  const plagesFC = ZONES_FC.map((z, i) => cumul ? z.lib : plageZone(ZONES_FC, i, fcmaxVal, "bpm"));
  conteneur.innerHTML =
    groupeZones(cumul ? "Temps cumulé dans chaque zone de puissance"
                      : "Zones de puissance : pourcentage du FTP (" + ftpVal + "\u00a0W) et watts correspondants", ZONES_P, r.zonesP, plagesP) +
    groupeZones(cumul ? "Temps cumulé dans chaque zone de fréquence cardiaque"
                      : "Zones de fréquence cardiaque : pourcentage de la FC max (" + fcmaxVal + "\u00a0bpm) et bpm correspondants", ZONES_FC, r.zonesFC, plagesFC);
}

function meilleureMoyenne(pw, d) {
  const n = pw.length;
  if (n < d) return null;
  let acc = 0;
  for (let i = 0; i < d; i++) acc += pw[i];
  let best = acc;
  for (let i = d; i < n; i++) { acc += pw[i] - pw[i - d]; if (acc > best) best = acc; }
  return best / d;
}
function meilleuresPuissances(s) {
  const pw = s.map((x) => x.p || 0);
  return { mm5: meilleureMoyenne(pw, 5), mm60: meilleureMoyenne(pw, 60), mm300: meilleureMoyenne(pw, 300),
           mm480: meilleureMoyenne(pw, 480), mm1200: meilleureMoyenne(pw, 1200) };
}
function typeTest(ints) {
  const libres = (ints || []).filter((x) => x.libre).map((x) => Math.round(x.min));
  if (libres.includes(20)) return "20min";
  if (libres.includes(8)) return "8min";
  if ((ints || []).some((x) => x.fin !== undefined && x.min >= 15 && x.fin - x.pct >= 60)) return "rampe";
  return null;
}
const TUILES_MM = [
  ["Meilleur 5 s (W)", (r) => r.mm5 !== null ? Math.round(r.mm5) : "–"],
  ["Meilleur 1 min (W)", (r) => r.mm60 !== null ? Math.round(r.mm60) : "–"],
  ["Meilleur 5 min (W)", (r) => r.mm300 !== null ? Math.round(r.mm300) : "–"],
  ["Meilleur 20 min (W)", (r) => r.mm1200 !== null ? Math.round(r.mm1200) : "–"]
];
function estimationFtp(mm, test) {
  if (test === "20min" && mm.mm1200 !== null) return { w: Math.round(mm.mm1200 * 0.95), txt: "95 % de ta meilleure moyenne sur 20 min (" + Math.round(mm.mm1200) + " W)" };
  if (test === "8min" && mm.mm480 !== null) return { w: Math.round(mm.mm480 * 0.90), txt: "90 % de ta meilleure moyenne sur 8 min (" + Math.round(mm.mm480) + " W)" };
  if (test === "rampe" && mm.mm60 !== null) return { w: Math.round(mm.mm60 * 0.75), txt: "75 % de ton meilleur 1 min (" + Math.round(mm.mm60) + " W)" };
  return null;
}
let bilanCle = {};
function rendreBilan(c, samples, test, ftpVal, force) {
  const cle = test + "|" + Math.floor(samples.length / 10) + "|" + ftpVal;
  if (!force && bilanCle[c.id] === cle) return;
  bilanCle[c.id] = cle;
  const mm = meilleuresPuissances(samples);
  const est = estimationFtp(mm, test);
  let html = '<div class="grille-stats">' + TUILES_MM.map(([lib, f]) => '<div><div class="val">' + f(mm) + '</div><div class="lib">' + lib + '</div></div>').join("") + "</div>";
  if (est) {
    const diff = est.w - ftpVal;
    html += '<div class="ftp-estim"><div>Estimation de ton FTP : <span class="gros">' + est.w + '&nbsp;W</span></div>' +
      '<div class="info" style="margin:4px 0 0">' + est.txt + '. Ton FTP actuel est de ' + ftpVal + '&nbsp;W (' + (diff >= 0 ? "+" : "") + diff + '&nbsp;W).</div>' +
      '<button class="plein" data-ftp="' + est.w + '">Utiliser ' + est.w + '&nbsp;W comme FTP</button></div>';
  } else {
    html += '<div class="info">Pour estimer ton FTP, charge un test dans « Séances proposées » (catégorie Tests) et roule-le : l’estimation apparaîtra ici.</div>';
  }
  c.innerHTML = html;
}
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("button[data-ftp]");
  if (!b) return;
  $("ftp").value = b.dataset.ftp;
  $("ftp").dispatchEvent(new Event("change"));
  log("FTP réglé à " + b.dataset.ftp + " W : zones et séances mises à jour.");
  b.textContent = "FTP mis à jour ✓"; b.disabled = true;
});

function majStats() {
  const r = resumer(session.samples, ftp(), fcmax());
  rendreTuiles($("tuiles-live"), r);
  $("m-duree").textContent = formatDuree(r.n);
  $("m-denivele").textContent = Math.round(r.dplus);
  dernierDeniv = r.dplus;
  $("m-vitmoy").textContent = r.n ? fr1(r.vitMoy) : "–";
  $("m-fcmoy").textContent = r.fcMoy !== null ? Math.round(r.fcMoy) : "–";
  $("m-cadmoy").textContent = r.cadMoy !== null ? Math.round(r.cadMoy) : "–";
  rendreZones($("zones-live"), r, ftp(), fcmax());
  rendreBilan($("bilan-live"), session.samples, typeTest(seance.intervalles), ftp());
  dessinerGraphique($("graphique"), session.samples, ftp(), fcmax());
}

/* =====================================================================
   Graphiques
   ===================================================================== */
function dessinerGraphique(c, s, ftpVal, fcmaxVal) {
  const dpr = window.devicePixelRatio || 1;
  const w = c.clientWidth, h = c.clientHeight;
  if (!w) return;
  if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const n = s.length;
  if (n < 2) return;

  const colonnes = Math.min(n, Math.floor(w));
  const moyenne = (cle) => {
    const out = [];
    for (let k = 0; k < colonnes; k++) {
      const a = Math.floor(k * n / colonnes), b = Math.max(a + 1, Math.floor((k + 1) * n / colonnes));
      let somme = 0, nb = 0;
      for (let i = a; i < b; i++) if (s[i][cle] != null) { somme += s[i][cle]; nb++; }
      out.push(nb ? somme / nb : null);
    }
    return out;
  };
  const trace = (valeurs, min, max, couleur) => {
    ctx.beginPath(); ctx.strokeStyle = couleur; ctx.lineWidth = 2;
    let debut = true;
    valeurs.forEach((v, k) => {
      if (v === null) { debut = true; return; }
      const x = (k / Math.max(colonnes - 1, 1)) * w;
      const y = h - 6 - borner((v - min) / (max - min), 0, 1) * (h - 12);
      if (debut) { ctx.moveTo(x, y); debut = false; } else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };
  const puissances = moyenne("p"), cardios = moyenne("hr"), cadences = moyenne("c"), altis = moyenne("alt");
  const maxP = Math.max(ftpVal * 1.5, ...puissances.filter((v) => v !== null));
  const av = altis.filter((v) => v !== null);
  if (av.length) {
    const amin = Math.min(...av), amax = Math.max(...av), plage = Math.max(amax - amin, 20);
    ctx.beginPath(); ctx.moveTo(0, h);
    altis.forEach((v, k) => { if (v !== null) ctx.lineTo((k / Math.max(colonnes - 1, 1)) * w, h - 4 - ((v - amin) / plage) * (h * 0.45)); });
    ctx.lineTo(w, h); ctx.closePath(); ctx.fillStyle = "rgba(157,176,199,.25)"; ctx.fill();
  }
  // lignes repères des zones de puissance (FTP)
  ctx.save(); ctx.setLineDash([4, 5]); ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.lineWidth = 1;
  const yFtp = h - 6 - borner(ftpVal / maxP, 0, 1) * (h - 12);
  ctx.beginPath(); ctx.moveTo(0, yFtp); ctx.lineTo(w, yFtp); ctx.stroke(); ctx.restore();
  ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.font = "11px sans-serif"; ctx.fillText("FTP " + ftpVal + " W", 4, yFtp - 3);
  trace(cadences, 0, 140, "#4AA8FF");
  trace(puissances, 0, maxP, "#FFB627");
  trace(cardios, 40, fcmaxVal, "#58D6A4");
}

function dessinerProfil() {
  const c = $("profil"), dpr = window.devicePixelRatio || 1;
  const w = c.clientWidth, h = c.clientHeight;
  if (!w) return;
  if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const pts = route.points;
  const min = Math.min(...pts.map((p) => p[1])), max = Math.max(...pts.map((p) => p[1]));
  const marge = 14, plage = Math.max(max - min, 20);
  const X = (d) => (d / route.longueur) * w;
  const Y = (a) => h - marge - ((a - min) / plage) * (h - 2 * marge - 10);

  ctx.beginPath(); ctx.moveTo(0, h);
  pts.forEach(([d, a]) => ctx.lineTo(X(d), Y(a)));
  ctx.lineTo(w, h); ctx.closePath();
  ctx.fillStyle = "#2D4565"; ctx.fill();
  ctx.beginPath();
  pts.forEach(([d, a], i) => i ? ctx.lineTo(X(d), Y(a)) : ctx.moveTo(X(d), Y(a)));
  ctx.strokeStyle = "#9DB0C7"; ctx.lineWidth = 2; ctx.stroke();

  const d = route.boucle ? balade.distance % route.longueur : Math.min(balade.distance, route.longueur);
  ctx.beginPath(); ctx.moveTo(X(d), 0); ctx.lineTo(X(d), h);
  ctx.strokeStyle = "rgba(255,182,39,.5)"; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); ctx.arc(X(d), Y(altitudeA(balade.distance)), 7, 0, Math.PI * 2);
  ctx.fillStyle = "#FFB627"; ctx.fill();
}

/* =====================================================================
   Export au format .FIT
   ===================================================================== */
const TABLE_CRC = [0x0000, 0xCC01, 0xD801, 0x1400, 0xF001, 0x3C00, 0x2800, 0xE401,
                   0xA001, 0x6C00, 0x7800, 0xB401, 0x5000, 0x9C01, 0x8801, 0x4400];
function crcFit(octets, crc) {
  crc = crc || 0;
  for (const b of octets) {
    let tmp = TABLE_CRC[crc & 0xF];
    crc = (crc >> 4) & 0x0FFF;
    crc = crc ^ tmp ^ TABLE_CRC[b & 0xF];
    tmp = TABLE_CRC[crc & 0xF];
    crc = (crc >> 4) & 0x0FFF;
    crc = crc ^ tmp ^ TABLE_CRC[(b >> 4) & 0xF];
  }
  return crc;
}

function construireFit(s, debutMs) {
  const n = s.length;
  const EPOCH_FIT = 631065600;
  const debut = Math.floor(debutMs / 1000) - EPOCH_FIT;
  // (v69 suite) heure réelle de chaque échantillon (pauses comprises) : x.w secondes après le départ ; anciennes séances : une par seconde
  const W = [];
  for (let i = 0; i < n; i++) W.push(Math.max(i ? W[i - 1] + 1 : 1, Math.round(s[i].w || i + 1)));
  const fin = debut + (n ? W[n - 1] : 0), ecoule = n ? W[n - 1] : 0;
  const o = [];
  const u8 = (v) => o.push(v & 0xFF);
  const u16 = (v) => o.push(v & 0xFF, (v >> 8) & 0xFF);
  const u32 = (v) => o.push(v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF);
  const definition = (local, numero, champs) => {
    u8(0x40 | local); u8(0); u8(0); u16(numero); u8(champs.length);
    champs.forEach(([num, taille, type]) => { u8(num); u8(taille); u8(type); });
  };
  const ENUM = 0x00, UINT8 = 0x02, SINT16 = 0x83, UINT16 = 0x84, UINT32 = 0x86, UINT32Z = 0x8C;
  const entier = (v, max) => Math.round(borner(v, 0, max));

  const pw = s.map((x) => x.p || 0);
  const fcs = s.filter((x) => x.hr != null).map((x) => x.hr);
  const cads = s.filter((x) => x.c != null).map((x) => x.c);
  const moyP = n ? pw.reduce((a, b) => a + b, 0) / n : 0;
  const maxP = pw.reduce((a, b) => Math.max(a, b), 0);
  const maxFc = fcs.reduce((a, b) => Math.max(a, b), 0);
  const distanceTotale = s[n - 1].d;

  definition(0, 0, [[0, 1, ENUM], [1, 2, UINT16], [2, 2, UINT16], [3, 4, UINT32Z], [4, 4, UINT32]]);
  u8(0); u8(4); u16(255); u16(0); u32(1234567); u32(debut);

  definition(1, 20, [[253, 4, UINT32], [5, 4, UINT32], [2, 2, UINT16], [6, 2, UINT16],
                     [7, 2, UINT16], [3, 1, UINT8], [4, 1, UINT8], [9, 2, SINT16]]);
  // événements du chronomètre : départ, puis arrêt / reprise autour de chaque pause
  definition(5, 21, [[253, 4, UINT32], [0, 1, ENUM], [1, 1, ENUM]]);
  const evenement = (ts, type) => { u8(5); u32(ts); u8(0); u8(type); };      // 0 = départ, 4 = arrêt de tout
  evenement(debut, 0);
  s.forEach((x, i) => {
    if (i && W[i] - W[i - 1] > 1) { evenement(debut + W[i - 1], 4); evenement(debut + W[i] - 1, 0); }
    u8(1);
    u32(debut + W[i]);
    u32(entier(x.d * 100, 4294967294));
    u16(entier((x.alt + 500) * 5, 65534));
    u16(entier(x.v * 1000, 65534));
    u16(x.p === null ? 0xFFFF : entier(x.p, 65534));
    u8(x.hr === null ? 0xFF : entier(x.hr, 254));
    u8(x.c === null ? 0xFF : entier(x.c, 254));
    u16(Math.round(borner(x.g, -100, 100) * 100) & 0xFFFF);
  });

  definition(2, 19, [[253, 4, UINT32], [2, 4, UINT32], [7, 4, UINT32], [8, 4, UINT32], [9, 4, UINT32]]);
  evenement(fin, 4);
  u8(2); u32(fin); u32(debut); u32(ecoule * 1000); u32(n * 1000); u32(entier(distanceTotale * 100, 4294967294));

  definition(3, 18, [[253, 4, UINT32], [2, 4, UINT32], [7, 4, UINT32], [8, 4, UINT32], [9, 4, UINT32],
                     [5, 1, ENUM], [6, 1, ENUM], [14, 2, UINT16], [20, 2, UINT16], [21, 2, UINT16],
                     [16, 1, UINT8], [17, 1, UINT8], [18, 1, UINT8],
                     [254, 2, UINT16], [25, 2, UINT16], [26, 2, UINT16]]);
  u8(3); u32(fin); u32(debut); u32(ecoule * 1000); u32(n * 1000); u32(entier(distanceTotale * 100, 4294967294));
  u8(2); u8(6);
  u16(entier((distanceTotale / n) * 1000, 65534));
  u16(entier(moyP, 65534)); u16(entier(maxP, 65534));
  u8(fcs.length ? entier(fcs.reduce((a, b) => a + b, 0) / fcs.length, 254) : 0xFF);
  u8(fcs.length ? entier(maxFc, 254) : 0xFF);
  u8(cads.length ? entier(cads.reduce((a, b) => a + b, 0) / cads.length, 254) : 0xFF);
  u16(0); u16(0); u16(1);

  definition(4, 34, [[253, 4, UINT32], [0, 4, UINT32], [1, 2, UINT16], [2, 1, ENUM], [3, 1, ENUM], [4, 1, ENUM]]);
  u8(4); u32(fin); u32(n * 1000); u16(1); u8(0); u8(26); u8(1);

  const entete = [14, 0x20, 0x54, 0x08, o.length & 0xFF, (o.length >>> 8) & 0xFF, (o.length >>> 16) & 0xFF,
                  (o.length >>> 24) & 0xFF, 0x2E, 0x46, 0x49, 0x54];
  const crcEntete = crcFit(entete, 0);
  entete.push(crcEntete & 0xFF, (crcEntete >> 8) & 0xFF);
  const fichier = entete.concat(o);
  const crcFichier = crcFit(fichier, 0);
  fichier.push(crcFichier & 0xFF, (crcFichier >> 8) & 0xFF);
  return fichier;
}

function nomFichierFit(debutMs) {
  const d = new Date(debutMs);
  return "seance-" + d.getFullYear() + "-" + deuxChiffres(d.getMonth() + 1) + "-" + deuxChiffres(d.getDate()) +
    "-" + deuxChiffres(d.getHours()) + deuxChiffres(d.getMinutes()) + ".fit";
}

function telecharger(octets, nom) {
  const blob = new Blob([new Uint8Array(octets)], { type: "application/octet-stream" });
  const lien = document.createElement("a");
  lien.href = URL.createObjectURL(blob);
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(lien.href), 2000);
}

