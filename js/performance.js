"use strict";
/* =====================================================================
   (v99) Régulateur de performance (qualité « Automatique ») pour les ordinateurs moins puissants.
   Il mesure les images par seconde en jeu : sous 36 images/s pendant 4 s il baisse d'un niveau (moins de coureurs réalistes, ombres plus petites puis coupées,
   image moins grande, moins de supporters et d'arbres ; voir PERF_TAB dans js/monde3d.js), et il remonte d'un niveau après 16 s à 56 images/s ou plus
   (jamais pendant 3 minutes si la remontée n'avait pas tenu). Le dernier niveau qui a marché est gardé (velo_perf_niveau) : la sortie suivante démarre dessus.
   « Minimale » dans Réglages → Affichage force le niveau 3 ; les autres qualités fixent le niveau 0.
   ===================================================================== */
const Perf = (function () {
  const CLE = "velo_perf_niveau", NOMS = ["complet", "équilibré", "léger", "minimal"];
  const lire = () => { try { const v = parseInt(localStorage.getItem(CLE), 10); return v >= 0 && v <= 3 ? v : null; } catch (e) { return null; } };
  const faible = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || (navigator.deviceMemory && navigator.deviceMemory <= 4);
  let mode = "auto", niveau = lire() !== null ? lire() : (faible ? 1 : 0);
  let somme = 0, nb = 0, derniere = 0, ignorer = 2, mauvais = 0, bons = 0, verrou = 0, tMontee = 0, fps = 0;

  function afficher() {
    const e = document.getElementById("perf-etat");
    if (e) e.textContent = (mode === "auto" ? "Automatique · " : "") + "niveau " + niveau + " (" + NOMS[niveau] + ")" + (fps ? " · " + Math.round(fps) + " images/s" : "");
  }
  function appliquer(n) {
    niveau = n;
    if (typeof monde3d !== "undefined" && monde3d && monde3d.definirPerf) monde3d.definirPerf(n);
    afficher();
  }
  // qualité choisie dans les réglages (et à la création du monde 3D)
  function regler(q) {
    mode = q === "auto" ? "auto" : "fixe";
    appliquer(q === "auto" ? niveau : q === "minimale" ? 3 : 0);
  }
  // appelée à chaque image du jeu (dtMs : durée de l'image précédente)
  function image(dtMs) {
    const t = performance.now();
    if (t - derniere > 600) { somme = 0; nb = 0; ignorer = 2; }       // on revient dans le jeu (changement d'onglet, de monde) : on laisse les ombres et les décors se préparer
    derniere = t;
    if (mode !== "auto") return;
    somme += Math.min(dtMs, 120); nb++;
    if (somme < 2000) return;
    fps = nb / (somme / 1000); somme = 0; nb = 0;
    if (ignorer > 0) { ignorer--; afficher(); return; }
    if (fps < 36) { mauvais++; bons = 0; } else if (fps >= 56) { bons++; mauvais = 0; } else { mauvais = 0; bons = 0; }
    if (mauvais >= 2 && niveau < 3) {
      if (tMontee && t - tMontee < 30000) verrou = t + 180000;         // la remontée n'a pas tenu : on n'essaie plus de remonter pendant 3 min
      appliquer(niveau + 1); mauvais = 0; ignorer = 1;
      try { localStorage.setItem(CLE, String(niveau)); } catch (e) { /* ignoré */ }
      log("Performance : " + Math.round(fps) + " images/s, qualité réduite au niveau " + niveau + " (" + NOMS[niveau] + ") pour garder la fluidité.");
    } else if (bons >= 8 && niveau > 0 && t > verrou) {
      appliquer(niveau - 1); bons = 0; ignorer = 1; tMontee = t;
      try { localStorage.setItem(CLE, String(niveau)); } catch (e) { /* ignoré */ }
      log("Performance : " + Math.round(fps) + " images/s, qualité remontée au niveau " + niveau + " (" + NOMS[niveau] + ").");
    }
    afficher();
  }
  return { regler, image, niveau: () => niveau, fps: () => fps, mode: () => mode };
})();
