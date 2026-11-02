"use strict";
/* =====================================================================
   Boucle principale
   ===================================================================== */
function valeur(src, cle, ts) { return frais(ts !== undefined ? ts : src.ts) && src[cle] != null ? src[cle] : null; }

function marquerZone(elTag, zones, ratio, actif) {
  if (!actif) { elTag.textContent = ""; return; }
  const z = zones[indexZone(zones, ratio)];
  elTag.textContent = z.nom; elTag.style.color = z.couleur;
}

/* Écran toujours allumé pendant une sortie (v62) : sans souris ni clavier pendant une heure, le Mac éteindrait l'écran.
   Chrome relâche le verrou quand la fenêtre est cachée ; il est redemandé dès qu'elle redevient visible. */
const ecran = { verrou: null, demande: false, signale: false, prochain: 0 };
function garderEcranAllume(oui) {
  if (!("wakeLock" in navigator)) return;
  if (!oui) {
    if (ecran.verrou) { ecran.verrou.release().catch(() => {}); ecran.verrou = null; }
    return;
  }
  if (ecran.verrou || ecran.demande || document.visibilityState !== "visible" || maintenant() < ecran.prochain) return;
  ecran.demande = true;
  navigator.wakeLock.request("screen").then((v) => {
    ecran.verrou = v;
    v.addEventListener("release", () => { if (ecran.verrou === v) ecran.verrou = null; });
    if (!ecran.signale) { ecran.signale = true; log("L’écran restera allumé pendant la sortie."); }
  }).catch((e) => {
    ecran.prochain = maintenant() + 30000;          // refusé : nouvel essai dans 30 s seulement
    if (!ecran.signale) { ecran.signale = true; log("Impossible de garder l’écran allumé : " + e.message); }
  }).finally(() => { ecran.demande = false; });
}

function rafraichir() {
  synchroRoute();
  const t = maintenant();
  // (v69 suite) on revoit une sortie enregistrée : rien n'est roulé ni envoyé au home trainer, l'écran suit l'enregistrement
  if (typeof Revoir !== "undefined" && Revoir.actif) {
    balade.dernier = t; balade.tick = t;
    majHud(Revoir.puissance(), Revoir.fc());
    if (typeof Ecran2 !== "undefined") Ecran2.maj();
    garderEcranAllume(true);
    return;
  }
  // Quand la fenêtre est cachée ou réduite, Chrome ralentit la boucle (jusqu'à un passage par minute) : le temps écoulé
  // est rattrapé par petits pas de 0,25 s au plus, pour que la distance et le chrono ne se figent pas (v62).
  // Au-delà de 60 s (ordinateur en veille), le surplus n'est pas compté.
  const ecoule = Math.min((t - balade.dernier) / 1000, 60);
  const nPas = Math.max(1, Math.ceil(ecoule / 0.25)), dt = ecoule / nPas;
  balade.dernier = t;
  balade.tick = t;

  const pPm = valeur(pm, "power"), pTr = valeur(trainer, "power");
  const puissance = pPm !== null ? pPm : pTr;
  const cadence = valeur(pm, "cadence", pm.cadTs) !== null ? pm.cadence : valeur(trainer, "cadence");
  const fc = valeur(ceinture, "hr") !== null ? ceinture.hr : (valeur(trainer, "hr") > 0 ? trainer.hr : null);
  balade.cadence = cadence;
  balade.ratio = puissance !== null ? puissance / ftp() : 0;

  // Pause et reprise automatiques
  if ($("auto-pause").checked) {
    const pedale = (puissance !== null && puissance >= 5) || (cadence !== null && cadence >= 10);
    if (balade.enCours) {
      balade.immobile = pedale ? 0 : balade.immobile + ecoule;
      // le vélo continue en roue libre ; la pause n'arrive qu'une fois presque arrêté (ou après 90 s de roue libre, par exemple dans une longue descente)
      if (balade.immobile >= 3 && (balade.vitesse < 0.4 || balade.immobile >= 90)) {
        balade.enCours = false; balade.auto = true; balade.vitesse = 0; majBoutonBalade();
        log("Pause automatique : tu as arrêté de pédaler et le vélo s’est arrêté.");
      }
    } else if (balade.auto && pedale) {
      balade.enCours = true; balade.auto = false; balade.immobile = 0; balade.dernier = t; majBoutonBalade();
      log("Reprise automatique.");
    }
  }

  // (v69 suite) pas de départ automatique pendant le choix du monde : on peut s'échauffer en choisissant,
  // sinon la sortie démarrait sur l'ancien parcours et empêchait de changer de monde
  const surChoix = !$("onglet-world").hidden && !$("world-choix").hidden;
  if (!balade.enCours && !balade.auto && balade.temps === 0 && !surChoix && $("auto-depart").checked) {
    const pedaleDepart = (puissance !== null && puissance >= 5) || (cadence !== null && cadence >= 10);
    if (pedaleDepart) {
      balade.enCours = true; balade.immobile = 0; balade.dernier = t;
      if (!session.debut) session.debut = Date.now();
      majBoutonBalade(); log("Départ automatique : tu as commencé à pédaler.");
    }
  }

  // (v69 suite) temps passé en pause pendant une sortie commencée : les échantillons gardent leur vraie heure dans le .FIT
  if (!balade.enCours && session.samples.length) session.pause += ecoule;
  if (balade.enCours) {
    for (let k = 0; k < nPas; k++) {
      majConditionsAir(dt);
      avancer(dt, puissance || 0, penteMonde());
      statsAero.s += condAir.gainW; statsAero.n++;
      if (Peloton.actif()) Peloton.maj(dt, { d: balade.distance, v: balade.vitesse, enCours: true });
      if (!route.boucle && balade.distance >= route.longueur) break;
    }
    let nouveaux = 0;
    while (Math.floor(balade.temps) > session.samples.length && nouveaux < 120) {
      session.samples.push({ w: session.samples.length + 1 + Math.round(session.pause), p: puissance, c: cadence, hr: fc, v: balade.vitesse, d: balade.distance - (balade.d0 || 0),
                             alt: balade.altitude, g: penteMonde(),
                             pl: Peloton.actif() ? Peloton.coureurs().map((r) => Math.round((r.d - (balade.d0 || 0)) * 10) / 10) : undefined });   // (v69 suite) place des autres coureurs (pour revoir la sortie)
      nouveaux++;
    }
    if (nouveaux) {
      majStats();
      if (session.samples.length >= 60 && session.samples.length - session.dernierEnreg >= 30) sauverSeanceCourante();
    }
    if (!route.boucle && balade.distance >= route.longueur) {
      balade.enCours = false; majBoutonBalade();
      log("Parcours terminé. Tu peux exporter ta séance.");
      sauverSeanceCourante();
    }
  }

  $("m-puissance").textContent = puissance !== null ? Math.round(puissance) : "–";
  $("m-cadence").textContent = cadence !== null ? Math.round(cadence) : "–";
  $("m-fc").textContent = fc !== null ? fc : "–";
  $("m-vitesse").textContent = (balade.vitesse * 3.6).toFixed(1).replace(".", ",");
  marquerZone($("z-puissance"), ZONES_P, (puissance || 0) / ftp(), puissance !== null);
  marquerZone($("z-fc"), ZONES_FC, (fc || 0) / fcmax(), fc !== null);
  $("source-puissance").textContent = pPm !== null ? "Puissance mesurée par le capteur de puissance."
    : pTr !== null ? "Puissance mesurée par le home trainer." : "Aucune puissance reçue pour l’instant.";

  if (modeActuel() === "erg") {
    majAffichageErg();
  } else {
    if (seance.puisCourse) finEchauffement();          // ERG coupé à la main pendant l'échauffement : la course part quand même
    $("etat-seance").textContent = "";
    $("pente-affichee").innerHTML = fr1(penteMonde()) + "&nbsp;%";
    $("pente-envoyee").textContent = trainer.pret
      ? "Pente envoyée au home trainer : " + fr1(penteEnvoyee()) + "\u00a0%"
      : "Home trainer non connecté : la pente n’est pas envoyée.";
    $("a-venir").textContent = modeActuel() === "route" ? penteAVenir() : "";
    envoyerPente();
  }
  majResteParcours();

  $("stats").textContent = fr2((balade.distance - (balade.d0 || 0)) / 1000) + " km – " + formatDuree(balade.temps) +
    (balade.auto ? " – en pause : repédale pour reprendre" : "");
  dessinerProfil();
  dessinerSeance();
  $("stats-world").textContent = $("stats").textContent;
  $("resume-capteurs").textContent = "Home trainer : " + $("st-trainer").textContent + " · Capteur de puissance : " + $("st-power").textContent + " · Ceinture cardio : " + $("st-hr").textContent + "  (onglet Connectivité)";
  majHud(puissance, fc);
  if (typeof Progression !== "undefined") Progression.maj();       // segments chronométrés, expérience de la sortie (v69)
  if (typeof Tour !== "undefined") Tour.maj();                     // (v69 suite) Tour à étapes : sommets passés (maillot à pois)
  majRavito();
  if (typeof Ecran2 !== "undefined") Ecran2.maj();
  garderEcranAllume(balade.enCours || balade.auto || (balade.temps > 0 && session.samples.length > 0));
}

/* =====================================================================
   Affichage tête haute sur le monde 3D
   ===================================================================== */
function couleurPente(p) {
  if (p < -1) return "#4AA8FF";
  if (p <= 2) return "#58D6A4";
  if (p <= 5) return "#FFD84A";
  if (p <= 8) return "#FF8A4C";
  return "#FF5A5A";
}
let dernierDeniv = 0, hudDernier = 0, hudSeance = "";
function majHud(puissance, fc) {
  const erg = modeActuel() === "erg";
  const p = penteMonde();
  $("hz-vit").textContent = (balade.vitesse * 3.6).toFixed(1).replace(".", ",");
  $("hz-dist").textContent = fr1((balade.distance - (balade.d0 || 0)) / 1000);     // distance roulée (départ choisi possible en cours de parcours)
  $("hz-deniv").textContent = Math.round(dernierDeniv);
  $("hz-temps").textContent = formatDuree(balade.temps);
  $("hz-progres").style.width = (route.boucle ? (balade.distance % route.longueur) / route.longueur * 100
    : Math.min(100, balade.distance / route.longueur * 100)) + "%";
  $("hz-w").textContent = puissance !== null ? Math.round(puissance) : "–";
  $("hz-fc").textContent = fc !== null ? fc : "–";
  const cad = balade.cadence;
  majAeroHud();
  if (monde3d && monde3d.meteo) { let tx = "";
    if (route.villes) { const dv = route.boucle ? balade.distance % route.longueur : balade.distance, vq = route.villes.find((q) => dv >= q[0] && dv <= q[1]); if (vq) tx = "📍 " + vq[2]; }
    if (!tx && route.secteurs) { const dv = route.boucle ? balade.distance % route.longueur : balade.distance, sq = route.secteurs.find((q) => dv >= q[0] && dv <= q[1]); if (sq) tx = (sq[3] === "pave" ? "▦ Pavés · " : "⚪ Chemin blanc · ") + sq[2] + " · " + fr1((sq[1] - sq[0]) / 1000) + " km"; }   // secteurs de gravier (Toscane) ou pavés (v69 suite)
    if (!tx && route.cotes) { const dv = route.boucle ? balade.distance % route.longueur : balade.distance, cq = route.cotes.find((q) => dv >= q[0] && dv <= q[1]); if (cq) tx = "⛰ " + cq[2] + " · " + fr1((cq[1] - cq[0]) / 1000) + " km à " + fr1((altitudeA(cq[1]) - altitudeA(cq[0])) / (cq[1] - cq[0]) * 100) + " %"; }   // côtes nommées (Ardennes)
    if ($("hz-meteo-t").textContent !== tx) $("hz-meteo-t").textContent = tx; $("hz-meteo").style.display = tx ? "" : "none"; }
  $("hz-cad").textContent = cad !== null && cad !== undefined && cad > 0 ? Math.round(cad) : "–";
  const fr = (condAir.frein || 0) > 0.05; if ($("hz-frein").hidden === fr) $("hz-frein").hidden = !fr;   // (v69 suite) freinage avant un virage
  const z = ZONES_P.find((x) => (puissance || 0) / ftp() <= x.max) || ZONES_P[ZONES_P.length - 1];
  $("hz-puiss").style.borderTopColor = puissance !== null ? z.couleur : "#7C93AD";
  $("hz-wkg").textContent = puissance !== null ? fr1(puissance / (parseFloat($("poids").value) || 75)) : "–";
  const zt = $("hz-zone");
  zt.textContent = puissance !== null ? z.nom : ""; zt.style.background = z.couleur;
  // (v69) jauge de puissance : 0 à 150 % du FTP, couleur de la zone, repère au FTP
  const pb = $("hz-pbar");
  pb.style.width = (puissance !== null ? Math.min(1, puissance / ftp() / 1.5) * 100 : 0).toFixed(1) + "%"; pb.style.background = z.couleur;
  // (v69) distance restante : jusqu'à l'arrivée de la course, jusqu'au bout du parcours, ou jusqu'à la fin du tour
  const L = route.longueur;
  let reste = null, ru = "";
  if (L > 0 && route.boucle && Peloton.actif() && (Peloton.mode() === "course" || Peloton.mode() === "clm") && Peloton.tours() > 0) { reste = Peloton.depart() + Peloton.longueurCourse() - balade.distance; ru = "km à l’arrivée"; }
  else if (L > 0 && !route.boucle) { reste = L - balade.distance; ru = "km restants"; }
  else if (L > 0) { reste = L - balade.distance % L; ru = "km du tour"; }
  $("hz-reste-b").hidden = !(reste > 0);
  if (reste > 0) { $("hz-reste").textContent = fr1(reste / 1000); if ($("hz-reste-u").textContent !== ru) $("hz-reste-u").textContent = ru; }
  const pe = $("hz-pente"), av = $("hz-pente-av");
  if (erg) { pe.textContent = "ERG"; pe.style.color = "#FFB45E"; av.textContent = ""; }
  else {
    pe.innerHTML = fr1(p) + "&nbsp;%"; pe.style.color = couleurPente(p);
    // pente moyenne des 300 prochains mètres (quand le parcours a du relief)
    const d0 = balade.distance, fin = route.boucle || !(L > 0) ? d0 + 300 : Math.min(L, d0 + 300);
    const pm = fin - d0 > 50 ? (altitudeA(fin) - altitudeA(d0)) / (fin - d0) * 100 : 0;
    const txt = fin - d0 > 50 && Math.abs(pm - p) >= 0.8 ?"puis " + fr1(pm) + " % sur " + Math.round(fin - d0) + " m" : "";
    if (av.textContent !== txt) { av.textContent = txt; av.style.color = couleurPente(pm); }
  }
  const cible = $("hz-cible"), panneau = $("hz-seance");
  if (erg) {
    const cur = intervalleA(balade.temps - seance.t0);
    cible.textContent = cur && cur.iv.libre ? "effort libre · " + formatDuree(Math.ceil(cur.reste)) : cur && cur.iv.fc ? "cœur " + Math.round(cur.iv.fc * fcmax() / 100) + " bpm · " + (etatFc.i === cur.i ? Math.round(etatFc.w) : "–") + " W · " + formatDuree(Math.ceil(cur.reste)) : cur ? "tenir " + Math.round(pctA(cur.iv, 1 - cur.reste / (cur.iv.min * 60)) * ftp() / 100 * (seance.k || 1)) + " W · " + formatDuree(Math.ceil(cur.reste)) : "séance terminée";
    panneau.hidden = false;
    const cle = seance.intervalles.map((x) => x.min + ":" + x.pct + ":" + (x.fin || "")).join(",") + "|" + (cur ? cur.i : -1) + "|" + ftp();
    if (cle !== hudSeance) {
      hudSeance = cle;
      const deb = Math.max(0, (cur ? cur.i : 0) - 1);
      panneau.innerHTML = '<div class="tt">Séance</div>' + seance.intervalles.map((iv, i) => {
        if (i < deb || i > deb + 4) return "";
        const cls = cur && i === cur.i ? " en-cours" : (!cur || i < cur.i ? " fait" : "");
        const zc = ZONES_P[indexZone(ZONES_P, pctMoyen(iv) / 100)].couleur;
        return '<div class="iv' + cls + '" style="border-left:.35em solid ' + zc + '"><span>' + formatMinutes(iv.min) + '</span><span>' + libW(iv) + '</span></div>';
      }).join("");
    }
  } else { cible.textContent = ""; panneau.hidden = true; hudSeance = ""; }
}

/* (v69) courbe de la puissance des 60 dernières secondes, sous le bloc effort (barres à la couleur de la zone) */
function dessinerPuissanceHud() {
  const c = $("hz-spark"), cw = c.clientWidth, ch = c.clientHeight;
  if (!cw || !ch) return;
  if (c.width !== cw * 2 || c.height !== ch * 2) { c.width = cw * 2; c.height = ch * 2; }
  const W = c.width, H = c.height, x = c.getContext("2d"), f = ftp();
  x.clearRect(0, 0, W, H);
  const s = session.samples, n = 60, deb = Math.max(0, s.length - n), bw = W / n;
  let mx = f * 1.5;
  for (let i = deb; i < s.length; i++) mx = Math.max(mx, s[i].p || 0);
  x.fillStyle = "rgba(255,255,255,.18)"; x.fillRect(0, H - H * f / mx, W, 2);           // repère du FTP
  for (let i = deb; i < s.length; i++) {
    const v = s[i].p || 0, h = Math.max(2, H * v / mx), k = i - (s.length - n);
    x.fillStyle = (ZONES_P.find((z) => v / f <= z.max) || ZONES_P[ZONES_P.length - 1]).couleur;
    x.globalAlpha = 0.45 + 0.55 * (k / n);
    x.fillRect(k * bw + 1, H - h, Math.max(1, bw - 2), h);
  }
  x.globalAlpha = 1;
}
function dessinerCarteHud() {
  const c = $("hz-carte-c"), W = c.width, H = c.height, x = c.getContext("2d");
  x.clearRect(0, 0, W, H);
  if (!monde3d) return;
  const d0 = balade.distance;
  const pts = [];
  for (let d = d0 - 300; d <= d0 + 1500; d += 25) { const p = monde3d.pos(d); pts.push({ d, x: p[0], z: p[1] }); }
  const cur = monde3d.pos(d0);
  let mnx = Infinity, mxx = -Infinity, mnz = Infinity, mxz = -Infinity;
  for (const p of pts) { mnx = Math.min(mnx, p.x); mxx = Math.max(mxx, p.x); mnz = Math.min(mnz, p.z); mxz = Math.max(mxz, p.z); }
  const s = 0.88 * Math.min(W / Math.max(40, mxx - mnx), H / Math.max(40, mxz - mnz));
  const cx = (mnx + mxx) / 2, cz = (mnz + mxz) / 2;
  const X = (p) => W / 2 + (p - cx) * s, Y = (p) => H / 2 + (p - cz) * s;
  x.lineCap = "round"; x.lineJoin = "round";
  x.strokeStyle = "rgba(255,255,255,.22)"; x.lineWidth = 10; x.beginPath();
  pts.forEach((p, i) => { if (i) x.lineTo(X(p.x), Y(p.z)); else x.moveTo(X(p.x), Y(p.z)); }); x.stroke();
  x.lineWidth = 6;
  for (let i = 1; i < pts.length; i++) {
    x.strokeStyle = pts[i].d < d0 ? "#9aa5b3" : couleurPente(penteA(pts[i].d));
    x.beginPath(); x.moveTo(X(pts[i - 1].x), Y(pts[i - 1].z)); x.lineTo(X(pts[i].x), Y(pts[i].z)); x.stroke();
  }
  const dL = route.longueur;
  if (dL > 0) {                               // arche de départ / arrivée
    for (let k = Math.ceil(Math.max(0, d0 - 300) / dL); k * dL <= d0 + 1500; k++) {
      if (!route.boucle && k > 1) break;
      if (!route.boucle && k === 0 && d0 > 300) continue;
      const p = monde3d.pos(k * dL), px = X(p[0]), py = Y(p[1]);
      x.fillStyle = "#1b2430"; x.fillRect(px - 8, py - 8, 16, 16);
      x.fillStyle = "#fff"; x.fillRect(px - 8, py - 8, 8, 8); x.fillRect(px, py, 8, 8);
    }
  }
  const autres = Peloton.actif() ? Peloton.coureurs() : typeof Revoir !== "undefined" && Revoir.actif ? Revoir.coureursCarte() : [];
  if (autres.length) {
    for (const r of autres) {
      if (r.d < d0 - 300 || r.d > d0 + 1500) continue;
      const p = monde3d.pos(r.d);
      x.fillStyle = hex6(r.couleur); x.strokeStyle = "#fff"; x.lineWidth = 3;
      x.beginPath(); x.arc(X(p[0]), Y(p[1]), 7, 0, 6.2832); x.fill(); x.stroke();
    }
  }
  if ($("fantome-pr").checked) {
    const g = distFantome();
    if (g !== null && g > d0 - 300 && g < d0 + 1500) { const p = monde3d.pos(g); x.fillStyle = "#dfe6ee"; x.strokeStyle = "#5b6676"; x.lineWidth = 3; x.beginPath(); x.arc(X(p[0]), Y(p[1]), 7, 0, 6.2832); x.fill(); x.stroke(); }
  }
  x.fillStyle = "#fff"; x.strokeStyle = "#ff7a2f"; x.lineWidth = 5;
  x.beginPath(); x.arc(X(cur[0]), Y(cur[1]), 9, 0, 6.2832); x.fill(); x.stroke();
}

function dessinerProfilHud() {
  const c = $("hz-profil-c"), cw = c.clientWidth, ch = c.clientHeight;
  if (!cw || !ch) return;
  if (c.width !== cw * 2 || c.height !== ch * 2) { c.width = cw * 2; c.height = ch * 2; }
  const W = c.width, H = c.height, x = c.getContext("2d");
  x.clearRect(0, 0, W, H);
  const d0 = balade.distance, deb = d0 - 400, fin = d0 + 2600, pas = 20;
  const alts = [];
  let mn = Infinity, mx = -Infinity;
  for (let d = deb; d <= fin; d += pas) { const a = monde3d ? monde3d.alt(d) : altitudeA(d); alts.push(a); mn = Math.min(mn, a); mx = Math.max(mx, a); }
  const etendue = Math.max(40, mx - mn), bas = mn - etendue * 0.15;
  const haut = H - 8, bw = W / alts.length;
  for (let i = 0; i < alts.length; i++) {
    const d = deb + i * pas;
    const h = ((alts[i] - bas) / (etendue * 1.3)) * haut;
    x.fillStyle = d < d0 ? "rgba(140,150,165,.75)" : couleurPente(penteA(Math.max(0, d)));
    x.fillRect(i * bw, H - 4 - h, Math.ceil(bw) + 0.5, h);
  }
  // (v69) repères de distance devant toi : 500 m, 1 km, 1,5 km…
  x.font = "bold " + Math.round(H * 0.15) + "px sans-serif"; x.textBaseline = "bottom"; x.textAlign = "center";
  for (let k = 500; k <= fin - d0 - 100; k += 500) {
    const px = ((d0 + k - deb) / (fin - deb)) * W;
    x.fillStyle = "rgba(255,255,255,.35)"; x.fillRect(px - 1, H * 0.62, 2, H * 0.38);
    x.fillStyle = "rgba(255,255,255,.85)"; x.fillText(k < 1000 ? k + " m" : fr1(k / 1000).replace(",0", "") + " km", px, H * 0.6);
  }
  x.textAlign = "left";
  if (typeof Progression !== "undefined") Progression.profil(x, deb, fin, W, H);   // segments chronométrés (v69)
  const mxp = ((d0 - deb) / (fin - deb)) * W;
  x.fillStyle = "#fff"; x.fillRect(mxp - 2, 2, 4, H - 4);
  x.fillStyle = "#ff7a2f"; x.beginPath(); x.arc(mxp, H - 4 - ((monde3d ? monde3d.alt(d0) : altitudeA(d0)) - bas) / (etendue * 1.3) * haut, 9, 0, 6.2832); x.fill();
}

/* =====================================================================
   Sons : bruit de pneu, vent et roue libre, pluie et tonnerre (générés par le navigateur)
   ===================================================================== */
const Son = (function () {
  let ctx = null, n = null, actif = true, volume = 0.5, eclairsVus = -1;
  // gouttes de pluie (v69) : 3 s de petits « plic » aigus répartis à gauche et à droite, joués en boucle
  function bufGouttes() {
    const sr = ctx.sampleRate, L = sr * 3, b = ctx.createBuffer(2, L, sr), g = b.getChannelData(0), dr = b.getChannelData(1);
    for (let k = 0; k < 260; k++) {
      const t0 = Math.floor(Math.random() * L), f = 1400 + Math.random() * 4200, dur = 0.003 + Math.random() * 0.01;
      const a = (Math.random() < 0.12 ? 0.6 : 0.22) * (0.4 + Math.random() * 0.6), pan = Math.random();
      const nn = Math.floor(dur * sr * 4);
      for (let i = 0; i < nn; i++) {
        const x = Math.sin(2 * Math.PI * f * i / sr * (1 - i / nn * 0.3)) * Math.exp(-i / (dur * sr)) * a, j = (t0 + i) % L;
        g[j] += x * (1 - pan); dr[j] += x * pan;
      }
    }
    return b;
  }
  function init() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const maitre = ctx.createGain(); maitre.gain.value = 0; maitre.connect(ctx.destination);
      const ciel = ctx.createGain(); ciel.gain.value = 0; ciel.connect(ctx.destination);     // pluie et tonnerre : audibles même à l'arrêt
      const voie = (type, f, q, sortie, b) => {
        const s = ctx.createBufferSource(); s.buffer = b || buf; s.loop = true;
        const flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = q;
        const mod = ctx.createGain(); mod.gain.value = 1;
        const g = ctx.createGain(); g.gain.value = 0;
        s.connect(flt); flt.connect(mod); mod.connect(g); g.connect(sortie || maitre); s.start(0);
        return { flt, mod, g };
      };
      const pneu = voie("bandpass", 500, 0.7), vent = voie("lowpass", 400, 0.4), roue = voie("bandpass", 2400, 4);
      const lfo = ctx.createOscillator(); lfo.type = "square"; lfo.frequency.value = 20;
      const prof = ctx.createGain(); prof.gain.value = 0.5;
      roue.mod.gain.value = 0.5; lfo.connect(prof); prof.connect(roue.mod.gain); lfo.start(0);
      // pluie : souffle aigu (gouttes lointaines), grondement doux (pluie sur le sol), gouttes proches, chuintement des pneus sur la route mouillée
      const averse = voie("highpass", 1500, 0.5, ciel), sol = voie("lowpass", 700, 0.5, ciel), gouttes = voie("highpass", 900, 0.5, ciel, bufGouttes());
      const mouille = voie("bandpass", 3200, 0.8);
      n = { maitre, ciel, pneu, vent, roue, lfo, averse, sol, gouttes, mouille, buf };
    } catch (e) { ctx = null; }
  }
  // tonnerre : craquement puis long grondement grave qui roule, quelques secondes après l'éclair (plus ou moins loin)
  function tonnerre() {
    if (!ctx || !n) return;
    const t = ctx.currentTime + 0.4 + Math.random() * 2.2, fort = 0.5 + Math.random() * 0.5;
    const coup = (type, f, q, a, att, dur) => {
      const s = ctx.createBufferSource(); s.buffer = n.buf; s.loop = true; s.playbackRate.value = 0.5 + Math.random() * 0.3;
      const flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a * fort, t + att);
      for (let k = 1; k <= 6; k++) g.gain.setTargetAtTime(a * fort * (0.25 + Math.random() * 0.75) * Math.exp(-k / 2.5), t + att + k * dur / 7, dur / 9);
      g.gain.setTargetAtTime(0, t + att + dur, dur / 5);
      flt.frequency.setTargetAtTime(f * 0.5, t + att, dur / 2);
      s.connect(flt); flt.connect(g); g.connect(n.ciel); s.start(t); s.stop(t + att + dur * 2.5);
    };
    coup("bandpass", 700, 0.6, 0.35, 0.03, 0.6);
    coup("lowpass", 220, 0.7, 1.4, 0.25, 3.5 + Math.random() * 2.5);
  }
  function maj(v, ratio, audible) {
    if (!ctx || !n) return;
    const t = ctx.currentTime, k = 0.2;
    const marche = actif && audible && v > 0.3;
    n.maitre.gain.setTargetAtTime(marche ? volume : 0, t, 0.25);
    n.pneu.g.gain.setTargetAtTime(Math.min(v / 14, 1.2) * 0.22, t, k);
    n.pneu.flt.frequency.setTargetAtTime(280 + v * 55, t, k);
    n.vent.g.gain.setTargetAtTime(Math.pow(Math.min(v / 16, 1.5), 2) * 0.55, t, k);
    n.vent.flt.frequency.setTargetAtTime(200 + v * 45, t, k);
    const roueLibre = ratio < 0.05 && v > 2 ? Math.min(v / 10, 1) : 0;
    n.roue.g.gain.setTargetAtTime(roueLibre * 0.10, t, 0.3);
    n.lfo.frequency.setTargetAtTime(16 + v * 3, t, k);
    // pluie (v69) d'après la météo du monde 3D
    const p = audible && monde3d && monde3d.pluie ? Math.min(1, monde3d.pluie()) : 0;
    n.ciel.gain.setTargetAtTime(actif && audible ? volume : 0, t, 0.4);
    n.averse.g.gain.setTargetAtTime(0.16 * p, t, 0.8);
    n.sol.g.gain.setTargetAtTime(0.10 * p, t, 0.8);
    n.gouttes.g.gain.setTargetAtTime(0.5 * Math.min(1, p * 1.4), t, 0.8);
    n.mouille.g.gain.setTargetAtTime(0.13 * p * Math.min(v / 12, 1.2), t, k);
    const ne = audible && monde3d && monde3d.eclairs ? monde3d.eclairs() : -1;
    if (ne > eclairsVus && eclairsVus >= 0 && actif) tonnerre();
    eclairsVus = ne;
  }
  return { init, maj, tonnerre,
    regler: (a, vol) => { actif = a; volume = Math.min(1, Math.max(0, vol)) * 0.9; } };
})();
["pointerdown", "keydown"].forEach((ev) => document.addEventListener(ev, () => Son.init(), { once: true }));

/* =====================================================================
   Boucle d’animation du monde 3D
   ===================================================================== */
let monde3d = null, derniereImage = maintenant();
let pelotonSig = "", pelotonFinAnnonce = false, pelotonDernierTour = false;
// grande annonce au centre de l'écran (dernier tour, arrivée), effacée au bout de « duree » secondes ; texte vide = on l'efface
let annonceMinuteur = null;
function annoncer(titre, detail, classe, duree) {
  const a = $("hz-annonce");
  clearTimeout(annonceMinuteur);
  if (!titre) { a.hidden = true; return; }
  a.className = "hz" + (classe ? " " + classe : "");
  a.innerHTML = "<b>" + titre + "</b>" + (detail ? "<span>" + detail + "</span>" : "");
  a.hidden = false;
  annonceMinuteur = setTimeout(() => { a.hidden = true; }, (duree || 5) * 1000);
}
function lancerPeloton() {
  const pm = $("peloton-mode").value;
  // pendant l'échauffement : pas encore de course ; (v69 suite) étape d'un Tour : mode, nombre de tours et coureurs de l'étape ; on revoit une sortie : personne
  const et = typeof Tour !== "undefined" ? Tour.etapeEnCours() : null, revoir = typeof Revoir !== "undefined" && Revoir.actif;
  const mode = revoir || (typeof echauffementEnCours === "function" && echauffementEnCours()) || pm === "fantome" ? "aucun" : et ? et.mode : pm === "tour" ? "aucun" : pm;
  Peloton.demarrer({ mode, niveau: et ? et.niveau : $("peloton-niveau").value, ftp: ftp(), poids: parseFloat($("poids").value) || 75, wprime: 14841,   /* (v72) réserve W′ des coureurs virtuels : valeur fixe, plus réglable */
                     d0: balade.distance, longueur: route.longueur, boucle: !!route.boucle, pente: penteA, equipe: et ? Tour.equipe() : null,
                     tours: route.boucle ? (et ? et.tours : parseInt($("peloton-tours").value, 10) || 0) : 0, nombre: parseInt($("peloton-nombre").value, 10) || 8 });
  pelotonFinAnnonce = false; pelotonSig = ""; pelotonDernierTour = false; annoncer("");
  envoyerPeloton3D(); majHudPeloton();
}
function envoyerPeloton3D() {
  if (!monde3d) return;
  if (typeof Revoir !== "undefined" && Revoir.actif) { monde3d.definirPeloton(Revoir.liste3D()); return; }
  const l = Peloton.actif() ? Peloton.coureurs().map((r) => ({ couleur: r.couleur, ampleur: r.ampleur, nom: r.nom, id: r.id, femme: r.femme, look: r.look })) : [];
  if ($("fantome-pr").checked) l.push({ couleur: 0xdfe6ee, ampleur: 1, nom: "Fantôme", fantome: true });
  if ($("fantome-seg").checked) l.push({ couleur: 0xffd84a, ampleur: 1, nom: "Ton record", fantome: true });   // (v69 suite) fantôme des segments
  if (typeof Groupe !== "undefined") l.push(...Groupe.liste3D());   // (v71) amis de la sortie de groupe, toujours en dernier
  monde3d.definirPeloton(l);
}
function donnees3D(t) {
  const roule = balade.enCours, dt = roule ? Math.min((t - balade.tick) / 1000, 0.35) : 0;
  if (Peloton.actif()) Peloton.majVelos();                      // vélos des coureurs virtuels : même catégorie que le tien, même à l'arrêt
  const l = Peloton.actif() ? Peloton.coureurs().map((r) => ({ d: r.d + r.v * dt * (roule ? 1 : 0), v: roule ? r.v : 0, cad: roule ? r.cad : 0, voie: r.voie, ratio: r.P / r.cp, pente: penteA(r.d) / 100,
    clm: !!r.clm, grp: r.grp || 0, velo: r.velo, roues: r.roues })) : [];
  if ($("fantome-pr").checked) {
    const g = distFantome();
    if (g !== null) { l.push({ d: g + (roule ? tours.vFant * dt : 0), v: roule ? Math.max(0, tours.vFant) : 0, cad: roule ? 85 : 0, voie: 1.25, ratio: 0.7, pente: penteA(g) / 100 }); }
    else l.push(null);
  }
  if ($("fantome-seg").checked) {
    const f = typeof Progression !== "undefined" ? Progression.fantome() : null;
    l.push(f ? { d: f.d + (roule ? f.v * dt : 0), v: roule ? f.v : 0, cad: roule && f.v > 0 ? 85 : 0, voie: 1.6, ratio: 0.8, pente: penteA(f.d) / 100 } : null);
  }
  if (typeof Groupe !== "undefined") l.push(...Groupe.donnees3D());   // (v71) même ordre que dans envoyerPeloton3D
  return l.length ? l : null;
}
function hex6(c) { return "#" + ("000000" + c.toString(16)).slice(-6); }
function majHudPeloton() {
  const bloc = $("hz-peloton");
  if (!Peloton.actif()) { bloc.hidden = true; return; }
  bloc.hidden = false;
  const cl = Peloton.classement(), clm = Peloton.mode() === "clm", course = Peloton.mode() === "course" || clm;
  const moi = cl.find((x) => x.user);
  const nt = Peloton.tours(), tourMoi = route.boucle && route.longueur > 0 ? Math.floor(Math.max(0, moi.d - Peloton.depart()) / route.longueur) + 1 : 0;
  const titre = clm ? "Contre-la-montre · " + (moi.fini !== null ? "arrivée" : Peloton.parti() ? formatDuree(Peloton.temps()) : "au départ") + (nt > 1 && moi.fini === null && tourMoi ? " · tour " + Math.min(tourMoi, nt) + "/" + nt : "")
    : !course ? "Sortie endurance" : moi.fini !== null ? "Course · arrivée" : "Course · " + (tourMoi ? "tour " + Math.min(tourMoi, nt || tourMoi) + (nt ? "/" + nt : "") : "classement");
  const mj = typeof Tour !== "undefined" ? Tour.maillots() : null;
  const maillot = (nom) => mj ? (mj.jaune === nom ? '<span class="mj jaune" title="Maillot jaune"></span>' : "") + (mj.pois === nom ? '<span class="mj pois" title="Maillot à pois"></span>' : "") : "";
  const fmtE = (s) => { const a = Math.abs(s); return (s > 0 ? "+" : "−") + (a >= 60 ? Math.floor(a / 60) + ":" + deuxChiffres(Math.round(a % 60)) : Math.round(a) + "\u00a0s"); };
  let html = '<div class="tt">' + titre + "</div>";
  if (course && nt > 1 && tourMoi === nt && moi.fini === null && !pelotonDernierTour) { pelotonDernierTour = true; annoncer("Dernier tour", fr1(route.longueur / 1000) + " km avant l’arrivée", "", 5); }
  // beaucoup de coureurs : le premier et cinq lignes autour de toi (deux devant, deux derrière, décalées en tête ou en queue), les autres remplacés par « … »
  const iMoi = cl.indexOf(moi), deb = Math.max(0, Math.min(iMoi - 2, cl.length - 5));
  const montres = cl.length <= 8 ? null : new Set([0, deb, deb + 1, deb + 2, deb + 3, deb + 4]);
  cl.forEach((x, i) => {
    if (montres && !montres.has(i)) { if (montres.has(i - 1)) html += '<div class="pl sep">…</div>'; return; }
    let ecart = "";
    if (clm) ecart = x.user ? (x.fini !== null ? "arrivé " + formatDuree(Math.round(x.fini)) : "") : x.ecart === null ? "–" : Math.abs(x.ecart) < 0.5 ? "=" : fmtE(x.ecart);
    else if (x.user) ecart = x.fini !== null ? "arrivé " + formatDuree(Math.round(x.fini)) : "";
    else if (x.fini !== null && course) ecart = formatDuree(Math.round(x.fini));
    else if (course) { const sec = Math.round((x.d - moi.d) / Math.max(4, moi.v || 0)); ecart = sec === 0 ? "avec toi" : (sec > 0 ? "+" : "−") + Math.abs(sec) + "\u00a0s"; }
    else { const e = Math.round(x.d - moi.d); ecart = (e >= 0 ? "+" : "−") + Math.abs(e) + "\u00a0m"; }
    const banal = !x.etat || x.etat === "Au départ" || x.etat === "Endurance" || x.etat === "Dans le peloton" || x.etat === "Dans la roue" || x.etat === "Départ tranquille" || x.etat === "Chrono";
    const sous = x.user || banal ? "" : '<span class="sb">' + x.etat + "</span>";
    html += '<div class="pl' + (x.user ? " moi" : "") + '"><i style="background:' + hex6(x.couleur) + '"></i><b>' + (course ? (i + 1) + ". " : "") + maillot(x.nom) + x.nom + "</b><em>" + ecart + "</em>" + sous + "</div>";
  });
  if (course && moi.fini !== null && !pelotonFinAnnonce) {
    pelotonFinAnnonce = true;
    const rang = cl.indexOf(moi) + 1;
    log((clm ? "Arrivée du contre-la-montre" : "Arrivée de la course") + " : tu termines " + rang + "e sur " + cl.length + " en " + formatDuree(Math.round(moi.fini)) + (clm ? " (classement provisoire : certains coureurs roulent encore)" : "") + ".");
    annoncer(rang === 1 ? (clm ? "Meilleur temps !" : "Victoire !") : "Arrivée", (rang === 1 ? "1er" : rang + "e") + " sur " + cl.length + " · " + formatDuree(Math.round(moi.fini)) + (clm ? " · provisoire" : ""), "arrivee", 10);
  }
  if (html !== pelotonSig) { pelotonSig = html; $("hz-peloton-c").innerHTML = html; }
}

/* ---------- Chrono des tours et record (PR) : un temps à chaque passage sous l'arche ---------- */
const PAS_PR = 20;
const tours = { route: null, k: 0, t0: 0, liste: [], dPrec: 0, sig: "", marques: [], valide: false, pr: null, fant: null, nouveauPR: false, vFant: 0, gPrec: null, tPrec: 0 };
const clePR = () => "velo_pr_" + route.nom + "_" + Math.round(route.longueur);
// (v69 suite) record d'une autre route (page d'accueil)
function lirePRDe(r) { try { const j = JSON.parse(localStorage.getItem("velo_pr_" + r.nom + "_" + Math.round(r.longueur))); return j && j.t > 0 && Array.isArray(j.m) ? j : null; } catch (e) { return null; } }
function lirePR() { try { const j = JSON.parse(localStorage.getItem(clePR())); return j && j.t > 0 && Array.isArray(j.m) ? j : null; } catch (e) { return null; } }
function ecrirePR(pr) { try { localStorage.setItem(clePR(), JSON.stringify(pr)); } catch (e) { /* stockage indisponible : le record ne sera gardé que pendant la séance */ } }
function majInfoPR() {
  const cb = $("fantome-pr"), pr = tours.pr;
  cb.disabled = !pr;
  if (pr && $("peloton-mode").value === "fantome") cb.checked = true;      // mode « Mon record » : fantôme toujours affiché (envoyerPeloton3D suit)
  $("fantome-info").textContent = pr ? "Record de ce circuit : " + formatDuree(Math.round(pr.t)) + "." : "Pas encore de record sur ce circuit : termine un tour complet pour en créer un.";
}
function remplirMarques(dl, tLap, v) {
  while (tours.marques.length * PAS_PR <= dl) { const i = tours.marques.length; tours.marques.push(tLap - (dl - i * PAS_PR) / Math.max(v, 1)); }
}
function nouveauTour(k) {
  tours.marques = []; tours.valide = (balade.distance - k * route.longueur) < 40;
  tours.fant = tours.pr; tours.gPrec = null;
}
function distFantome() {                    // position du fantôme du record sur le tour en cours (null = pas de fantôme)
  const f = tours.fant, L = route.longueur;
  if (!f || !(L > 0)) return null;
  const t = balade.temps - tours.t0, m = f.m;
  if (t < 0 || t > f.t + 3) return null;
  let i = 0, j = m.length - 1;
  if (t >= m[j]) return tours.k * L + L;
  while (j - i > 1) { const c = (i + j) >> 1; if (m[c] <= t) i = c; else j = c; }
  const d0 = i * PAS_PR, d1 = i === m.length - 2 ? L : (i + 1) * PAS_PR, fr = m[j] > m[i] ? (t - m[i]) / (m[j] - m[i]) : 0;
  return tours.k * L + d0 + (d1 - d0) * Math.min(1, Math.max(0, fr));
}
function majTours() {
  const bloc = $("hz-tours");
  const L = route.longueur;
  if (tours.route !== route || balade.distance < tours.dPrec - 50 || (balade.distance > tours.dPrec + 400 && balade.temps - tours.tPrec < 3) || balade.temps < tours.t0 - 0.5) {   // saut en avant : départ en cours de parcours
    tours.route = route; tours.liste = []; tours.sig = ""; tours.nouveauPR = false;
    tours.k = L > 0 ? (route.boucle ? Math.floor(balade.distance / L) : (balade.distance >= L ? 1 : 0)) : 0;
    tours.t0 = balade.temps; tours.pr = lirePR(); nouveauTour(tours.k); majInfoPR(); envoyerPeloton3D();
  }
  tours.dPrec = balade.distance;
  if (L > 0) {
    const k = route.boucle ? Math.floor(balade.distance / L) : (balade.distance >= L ? 1 : 0);
    if (tours.k < k) {                     // passage de la ligne : on retranche le temps écoulé depuis le franchissement
      const multi = k - tours.k > 1;
      while (tours.k < k) {
        tours.k++;
        const tc = balade.temps - (balade.distance - tours.k * L) / Math.max(balade.vitesse, 1), tl = Math.max(1, tc - tours.t0);
        remplirMarques(L, tl, balade.vitesse);
        const nb = Math.floor(L / PAS_PR) + 1;
        if (tours.valide && !multi && tours.marques.length >= nb && tl > 20 && (!tours.pr || tl < tours.pr.t - 0.05)) {
          const m = tours.marques.slice(0, nb).map((x) => Math.round(x * 10) / 10); m.push(Math.round(tl * 10) / 10);
          tours.pr = { t: Math.round(tl * 10) / 10, m }; ecrirePR(tours.pr); tours.nouveauPR = true; majInfoPR();
          log("Nouveau record du circuit : " + formatDuree(Math.round(tl)) + ".");
        }
        // (v69 suite) arrivée contre le fantôme : qui a gagné, et de combien
        if (tours.fant && tours.valide && !multi && $("fantome-pr").checked) {
          const ec = tl - tours.fant.t;
          if (ec < -0.05) annoncer("Tu bats ton fantôme !", "de " + fr1(-ec) + " s · nouveau record " + formatDuree(Math.round(tl)), "arrivee", 7);
          else annoncer("Ton fantôme gagne", "de " + fr1(ec) + " s · record " + formatDuree(Math.round(tours.fant.t)) + " · retente ta chance", "", 7);
        }
        tours.liste.push(tl); tours.t0 = tc;
        nouveauTour(tours.k);
      }
    }
    if (tours.valide) remplirMarques(balade.distance - tours.k * L, balade.temps - tours.t0, balade.vitesse);
  }
  const g = distFantome(), actif = $("fantome-pr").checked && g !== null;
  tours.vFant = 0;
  if (g !== null && tours.gPrec !== null && balade.temps > tours.tPrec) tours.vFant = Math.max(0, (g - tours.gPrec) / (balade.temps - tours.tPrec));
  tours.gPrec = g; tours.tPrec = balade.temps;
  if (!route.boucle && !tours.liste.length && !actif) { bloc.hidden = true; return; }
  bloc.hidden = false;
  const mini = tours.liste.length > 1 ? Math.min.apply(null, tours.liste) : -1;
  let html = '<div class="tt">' + (route.boucle ? "Tours" : "Arrivée") + "</div>";
  const debut = Math.max(0, tours.liste.length - 4);
  for (let i = debut; i < tours.liste.length; i++) html += '<div class="tr' + (tours.liste[i] === mini ? " best" : "") + '"><span>' + (route.boucle ? "Tour " + (i + 1) : "Temps") + "</span><b>" + formatDuree(Math.round(tours.liste[i])) + "</b></div>";
  if (route.boucle) html += '<div class="tr cour"><span>Tour ' + (tours.liste.length + 1) + "</span><span>" + formatDuree(Math.max(0, Math.round(balade.temps - tours.t0))) + "</span></div>";
  // course avec arrivée : tours qu'il reste à faire (celui en cours compris), puis « Arrivée » une fois la ligne passée
  if (route.boucle && L > 0 && Peloton.actif() && (Peloton.mode() === "course" || Peloton.mode() === "clm") && Peloton.tours() > 0) {
    const reste = Peloton.tours() - Math.floor(Math.max(0, balade.distance - Peloton.depart()) / L);
    html += '<div class="tr reste"><span>' + (reste <= 0 ? "Arrivée" : reste === 1 ? "Dernier tour" : "Tours restants") + "</span><b>" + (reste <= 0 ? "✓" : reste === 1 ? "" : reste) + "</b></div>";
  }
  if (tours.pr) html += '<div class="tr cour"><span>Record</span><span>' + formatDuree(Math.round(tours.pr.t)) + "</span></div>";
  if (actif) { const sec = Math.round((balade.distance - g) / Math.max(4, balade.vitesse)); html += '<div class="tr cour"><span>Fantôme</span><span>' + (sec === 0 ? "avec toi" : (sec > 0 ? "−" : "+") + Math.abs(sec) + "\u00a0s") + "</span></div>"; }
  if (html !== tours.sig) { tours.sig = html; $("hz-tours-c").innerHTML = html; }
}

/* ---------- (v69 suite) Ravitaillement : rappels pour boire (toutes les 15 min) et manger (à 40 min, puis toutes les 30 min) ---------- */
const ravito = { boire: 15 * 60, manger: 40 * 60 };
function remettreRavito() { ravito.boire = 15 * 60; ravito.manger = 40 * 60; }
function majRavito() {
  if (!$("ravito").checked || !balade.enCours || $("world-jeu").hidden || !$("hz-annonce").hidden) return;   // jamais par-dessus une autre annonce
  const t = balade.temps;
  if (t >= ravito.manger) {
    const s = session.samples, n = Math.min(s.length, 1800);
    let sm = 0;
    for (let i = s.length - n; i < s.length; i++) sm += s[i].p || 0;
    const r = n ? sm / n / ftp() : 0.6, g = r < 0.6 ? 20 : r < 0.75 ? 30 : 40;   // plus l'effort est intense, plus il faut de glucides (40 à 80 g par heure)
    annoncer("Pense à manger", "≈ " + g + " g de glucides (barre, gel ou banane) · prochain rappel dans 30 min", "ravito", 8);
    log("Ravitaillement : pense à manger environ " + g + " g de glucides.");
    ravito.manger = t + 30 * 60; ravito.boire = Math.max(ravito.boire, t + 5 * 60);
  } else if (t >= ravito.boire) {
    annoncer("Pense à boire", "quelques gorgées (≈ 150 ml) · rappel toutes les 15 min", "ravito", 6);
    ravito.boire = t + 15 * 60;
  }
}

/* ---------- Résumé de fin de sortie ---------- */
const statsAero = { s: 0, n: 0 };
function construireResume() {
  const r = resumer(session.samples, ftp(), fcmax());
  const res = { r, tours: tours.liste.slice(), pr: tours.nouveauPR, aero: statsAero.n ? statsAero.s / statsAero.n : 0, monde: ($("nom-monde-actif") && $("nom-monde-actif").textContent) || route.nom, rang: null };
  let course = null;
  if (Peloton.actif() && (Peloton.mode() === "course" || Peloton.mode() === "clm")) {
    const cl = Peloton.classement(), i = cl.findIndex((x) => x.user);
    if (i >= 0) {
      course = { fini: cl[i].fini !== null && cl[i].fini !== undefined, rang: i + 1, n: cl.length, clm: Peloton.mode() === "clm" };
      res.rang = [i + 1, cl.length, course.fini || Peloton.longueurCourse() === Infinity];   // course sans arrivée : simple position
    }
  }
  try { res.tour = typeof Tour !== "undefined" ? Tour.finEtape() : null; } catch (e) { res.tour = null; }   // (v69 suite) étape d'un Tour : temps, classements, maillots
  try { res.prog = Progression.terminer(course); } catch (e) { res.prog = null; }   // expérience, défis et badges (v69)
  if (seance.ftpTest) { res.ftp = seance.ftpTest; seance.ftpTest = null; }          // (v69 suite) test FTP fait pendant la sortie
  try { res.photos = typeof Photos !== "undefined" ? Photos.pour(session.debut) : []; } catch (e) { res.photos = []; }   // (v72) photos de la sortie
  statsAero.s = 0; statsAero.n = 0;
  return res;
}
function afficherResume(res) {
  const r = res.r, t = (b, l) => '<div class="rf-t"><b>' + b + "</b><span>" + l + "</span></div>";
  let h = "<h2>Sortie terminée</h2><div class=\"rf-sous\">" + res.monde + (res.pr ? " · nouveau record du circuit !" : "") + (res.rang ? " · " + (res.rang[2] === false ? "course non terminée (" : "") + res.rang[0] + (res.rang[0] === 1 ? "er" : "e") + " sur " + res.rang[1] + (res.rang[2] === false ? " à l’arrêt)" : "") : "") + "</div><div class=\"rf-grille\">";
  h += t(formatDuree(r.n), "Durée") + t(fr2(r.distance / 1000) + " km", "Distance") + t(fr1(r.vitMoy) + " km/h", "Vitesse moyenne") + t(Math.round(r.dplus) + " m", "Dénivelé positif");
  h += t(Math.round(r.pMoy) + " W", "Puissance moyenne") + t(Math.round(r.np) + " W", "Puissance normalisée") + t(Math.round(r.tss), "Charge (TSS)") + t(Math.round(r.kcal) + " kcal", "Énergie");
  if (r.fcMoy !== null) h += t(Math.round(r.fcMoy) + " bpm", "FC moyenne");
  if (r.cadMoy !== null) h += t(Math.round(r.cadMoy) + " rpm", "Cadence moyenne");
  if (res.aero >= 1) h += t("+" + Math.round(res.aero) + " W", "Gain aéro moyen");
  h += "</div>";
  // (v69 suite) ravitaillement : énergie dépensée et glucides brûlés (part des glucides d'autant plus grande que l'effort est intense)
  if (r.n >= 2700 && r.kcal > 0) {
    const IF = r.np / ftp(), g = Math.round(r.kcal * borner(0.3 + 0.6 * IF, 0.4, 0.9) / 4);
    h += '<div class="rf-ravito">🍝 Tu as brûlé environ <b>' + g + " g de glucides</b> (sur " + Math.round(r.kcal) + " kcal) : bois bien et prends un repas avec des féculents dans l’heure qui suit pour récupérer.</div>";
  }
  if (res.tour) h += res.tour;
  if (res.ftp) {
    const df = res.ftp.w - ftp();
    h += '<div class="ftp-estim"><div>Test FTP : <span class="gros">' + res.ftp.w + "&nbsp;W</span> (" + (df >= 0 ? "+" : "") + df + "&nbsp;W)</div>" +
      '<div class="info" style="margin:4px 0 0">' + res.ftp.txt + ". Toutes les séances (pourcentages du FTP), les zones et les autres coureurs s’ajusteront.</div>" +
      '<button class="plein" data-ftp="' + res.ftp.w + '">Utiliser ' + res.ftp.w + "&nbsp;W comme FTP</button></div>";
  }
  try { h += Progression.htmlResume(res.prog); } catch (e) { /* rien */ }
  if (res.tours.length) {
    const mini = Math.min.apply(null, res.tours);
    h += "<h3 style=\"margin:6px 0\">Tours</h3>";
    res.tours.forEach((x, i) => { h += '<div class="rf-l' + (x === mini && res.tours.length > 1 ? " best" : "") + '"><span>Tour ' + (i + 1) + "</span><b>" + formatDuree(Math.round(x)) + "</b></div>"; });
  }
  if (typeof Photos !== "undefined") h += Photos.htmlResume(res.photos);
  h += '<div class="rf-boutons"><button id="resume-detail">Voir le détail</button><button id="resume-accueil" class="plein">Retour à l’accueil</button></div>';
  $("resume-fin-c").innerHTML = h; $("resume-fin").hidden = false;
  if (typeof Photos !== "undefined") Photos.brancherResume($("resume-fin-c"), res.photos);
  // on ferme : bouton, touche Échap ou clic à côté de la fenêtre
  const fermer = () => { $("resume-fin").hidden = true; document.removeEventListener("keydown", echap); };
  const echap = (e) => { if (e.key === "Escape") fermer(); };
  document.addEventListener("keydown", echap);
  $("resume-fin").onclick = (e) => { if (e.target === $("resume-fin")) fermer(); };
  $("resume-detail").addEventListener("click", fermer);                       // reste sur l’historique de la séance
  $("resume-accueil").addEventListener("click", () => {                     // retour au choix du monde
    fermer(); afficherOnglet("world");
    if ($("world-choix").hidden) $("btn-changer-monde").click();
  });
}
function boucle3D() {
  requestAnimationFrame(boucle3D);
  const t = maintenant();
  const dt = Math.min((t - derniereImage) / 1000, 0.1);
  derniereImage = t;
  if (!monde3d || document.hidden || $("onglet-world").hidden || $("world-jeu").hidden) { Son.maj(0, 0, false); return; }
  const extrapole = balade.enCours ? balade.vitesse * Math.min((t - balade.tick) / 1000, 0.35) : 0;
  const rp = typeof Revoir !== "undefined" && Revoir.actif ? Revoir.image(dt) : null;      // (v69 suite) on revoit une sortie enregistrée
  try {
    const maintenant10 = t - hudDernier > 100;
    if (maintenant10) { hudDernier = t; if (!rp) { majHudPeloton(); majTours(); } dessinerCarteHud(); dessinerProfilHud(); dessinerPuissanceHud(); Son.maj(rp ? rp.v : balade.enCours ? balade.vitesse : 0, rp ? rp.ratio : balade.ratio || 0, true); }
    const rv = rp ? null : revetementA(balade.distance);
    monde3d.dessiner({
      canvas: $("monde3d"), dt: dt, distance: rp ? rp.d : balade.distance + extrapole,
      vitesse: rp ? rp.v : balade.enCours ? balade.vitesse : 0, cadence: rp ? rp.c : balade.enCours ? balade.cadence : 0,
      ratio: rp ? rp.ratio : balade.enCours ? (balade.ratio || 0) : 0,
      peloton: rp ? rp.peloton : donnees3D(t),
      vibre: rp || !balade.enCours || !$("vibrations").checked ? 0 : rv === "pave" ? 1 : rv === "gravier" ? 0.35 : 0   // (v69 suite) secousses sur les pavés
    });
    if (typeof Photos !== "undefined") Photos.apresDessin($("monde3d"));   // (v72) photo demandée : copiée juste après le dessin
  } catch (err) {
    log("Monde 3D arrêté : " + err.message);
    monde3d = null;
    indisponible3D("Une erreur est survenue dans le monde 3D. Le profil du parcours reste disponible.");
  }
}
function indisponible3D(message) {
  const c = $("monde-conteneur");
  c.classList.add("indispo");
  $("monde3d").style.display = "none";
  document.querySelectorAll(".hz").forEach((h) => { h.hidden = true; });
  $("monde-msg").hidden = false;
  $("monde-msg").textContent = message;
}
function demarrer3D() {
  if (!Monde3D.disponible()) {
    indisponible3D("Le monde 3D n’a pas pu être chargé : une connexion internet est nécessaire pour télécharger la bibliothèque graphique.");
    log("Monde 3D indisponible : bibliothèque Three.js non chargée.");
    return;
  }
  try {
    monde3d = Monde3D.creer($("monde3d"), { theme: $("monde").value, qualite: $("qualite").value });
    monde3d.definirResolution(parseInt($("resolution").value, 10));
    monde3d.definirEffets({ poussiere: $("poussiere").checked });
    monde3d.definirVue($("vue-camera").value);
    monde3d.definirMoment($("moment").value);
    monde3d.definirMeteo($("meteo").value);
    monde3d.definirEffets({ foule: parseInt($("foule").value, 10), pietons: parseInt($("pietons").value, 10) });
    monde3d.definirSaison($("saison").value);
    appliquerAvatar();
    envoyerPeloton3D();
  } catch (err) {
    log("Monde 3D indisponible : " + err.message);
    indisponible3D("Ton navigateur n’a pas pu démarrer l’affichage 3D (WebGL). Le profil du parcours reste disponible.");
    return;
  }
  requestAnimationFrame(boucle3D);
}


