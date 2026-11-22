"use strict";
/* =====================================================================
   (v97) Alertes pendant la sortie (Réglages → Sensations de route) :
   - fréquence cardiaque trop haute (au-dessus d'un pourcentage de la FC max pendant 1 minute) ;
   - en mode ERG, puissance trop éloignée de la cible (plus de 15 % pendant 20 secondes) ;
   - durée visée : annonce 5 minutes avant la fin, puis à la fin.
   Réglages gardés dans velo_alertes_v1. Les annonces utilisent `annoncer` (grande annonce au centre de l'écran de course).
   ===================================================================== */
const Alertes = (function () {
  const CLE = "velo_alertes_v1";
  const DEFAUT = { fc: true, fcSeuil: 92, erg: true, duree: 0 };
  const lire = () => { try { return Object.assign({}, DEFAUT, JSON.parse(localStorage.getItem(CLE)) || {}); } catch (e) { return Object.assign({}, DEFAUT); } };
  let cfg = lire();
  const st = { fcT: 0, fcAttente: 0, ergT: 0, ergAttente: 0, tPrec: 0, cinq: false, atteinte: false };

  function enregistrer() {
    cfg = { fc: $("alerte-fc").checked, fcSeuil: Math.max(70, Math.min(100, parseInt($("alerte-fc-seuil").value, 10) || 92)), erg: $("alerte-erg").checked, duree: Math.max(0, Math.min(600, parseInt($("alerte-duree").value, 10) || 0)) };
    try { localStorage.setItem(CLE, JSON.stringify(cfg)); } catch (e) { /* stockage indisponible */ }
  }
  function afficher() {
    if (!$("alerte-fc")) return;
    $("alerte-fc").checked = cfg.fc; $("alerte-fc-seuil").value = cfg.fcSeuil; $("alerte-erg").checked = cfg.erg; $("alerte-duree").value = cfg.duree;
    ["alerte-fc", "alerte-fc-seuil", "alerte-erg", "alerte-duree"].forEach((id) => $(id).addEventListener("change", enregistrer));
  }
  afficher();

  const alerte = (titre, detail) => {
    if (typeof annoncer === "function" && !$("onglet-world").hidden) annoncer(titre, detail, "", 6);
    try { if (typeof Son !== "undefined" && Son.bip) { Son.bip(880, 0.12); setTimeout(() => Son.bip(660, 0.15), 160); } } catch (e) { /* son indisponible */ }
    log("Alerte : " + titre + " · " + detail);
  };
  // appelée à chaque tour de la boucle principale (dt = secondes écoulées)
  function tick(dt, puissance) {
    if (!balade.enCours || $("world-jeu").hidden) return;
    if (balade.temps < st.tPrec - 1) { st.fcT = st.ergT = 0; st.fcAttente = st.ergAttente = 0; st.cinq = st.atteinte = false; }   // nouvelle sortie
    st.tPrec = balade.temps;
    st.fcAttente = Math.max(0, st.fcAttente - dt); st.ergAttente = Math.max(0, st.ergAttente - dt);
    // fréquence cardiaque
    if (cfg.fc && typeof fcActuelle === "function") {
      const fc = fcActuelle(), lim = cfg.fcSeuil / 100 * fcmax();
      if (fc !== null && fc > lim) st.fcT += dt; else st.fcT = Math.max(0, st.fcT - dt * 2);
      if (st.fcT >= 60 && st.fcAttente <= 0) { st.fcAttente = 240; alerte("Cœur trop haut", fc + " bpm, soit " + Math.round(100 * fc / fcmax()) + " % de ta FC max : ralentis un peu"); }
    }
    // puissance cible (ERG)
    if (cfg.erg && modeActuel() === "erg" && seance.cibleW > 0 && puissance !== null && !seance.puisCourse) {
      const ec = (puissance - seance.cibleW) / seance.cibleW;
      if (Math.abs(ec) > 0.15 && balade.temps - (seance.cibleDepuis || 0) > 15) st.ergT += dt; else st.ergT = Math.max(0, st.ergT - dt * 2);
      if (st.ergT >= 20 && st.ergAttente <= 0) { st.ergAttente = 90; st.ergT = 0; alerte(ec > 0 ? "Trop fort" : "Trop mou", Math.round(puissance) + " W pour " + seance.cibleW + " W visés (" + (ec > 0 ? "+" : "−") + Math.round(Math.abs(ec) * 100) + " %)"); }
    } else st.ergT = 0;
    // durée visée
    if (cfg.duree > 0) {
      const reste = cfg.duree * 60 - balade.temps;
      if (!st.cinq && reste <= 300 && reste > 0 && cfg.duree > 7) { st.cinq = true; alerte("Plus que 5 minutes", "durée visée : " + cfg.duree + " min"); }
      if (!st.atteinte && reste <= 0) { st.atteinte = true; alerte("Durée atteinte", cfg.duree + " minutes : tu peux terminer ou continuer"); }
    }
  }
  return { tick, config: () => cfg };
})();
