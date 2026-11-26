"use strict";

/* =====================================================================
   (v105) Chargement : l'écran d'attente, et les gros fichiers de la 3D chargés en arrière-plan.
   L'interface s'affiche tout de suite ; les corps, vélos et décors (environ 12 Mo) arrivent ensuite.
   Le bouton « C'est parti » attend qu'ils soient là. Chargé en premier (avant lib/three.min.js).
   ===================================================================== */
const Chargement = (function () {
  // [fichier, taille approximative en Ko] : sert seulement à la barre d'avancement
  const FICHIERS_3D = [["js/modele-homme.js", 1160], ["js/modele-femme.js", 200], ["js/textures-corps.js", 1800], ["js/velos.js", 4780], ["js/decor.js", 4040]];
  const total = FICHIERS_3D.reduce((s, f) => s + f[1], 0);
  let fait = 0, restants = FICHIERS_3D.length, pret = false, resoudre;
  const rates = [], promesse = new Promise((r) => { resoudre = r; });

  function afficher() {
    const pc = Math.round(fait / total * 100);
    const pastille = document.getElementById("charge-3d");
    if (pastille) {
      pastille.hidden = pret && !rates.length;
      pastille.classList.toggle("erreur", pret && rates.length > 0);
      pastille.querySelector(".c3-texte").textContent = pret && rates.length
        ? "Une partie de la 3D n’a pas pu être chargée (affichage simplifié) : recharge la page."
        : "Préparation de la 3D… " + pc + " %";
      pastille.querySelector(".c3-barre i").style.width = pc + "%";
    }
    // le bouton de départ attend la 3D
    const bouton = document.getElementById("btn-cest-parti");
    if (bouton) {
      bouton.disabled = !pret;
      if (pret) bouton.removeAttribute("title");
      else bouton.title = "La 3D se prépare (" + pc + " %), encore un instant";
    }
  }
  function termine(f, ok) {
    fait += f[1];
    if (!ok) { rates.push(f[0]); console.warn("fichier 3D non chargé : " + f[0]); }
    if (--restants === 0) { pret = true; resoudre(rates); }
    afficher();
  }
  for (const f of FICHIERS_3D) {
    const s = document.createElement("script");
    s.src = f[0];
    s.async = false;               // téléchargés ensemble, exécutés dans l'ordre
    s.onload = () => termine(f, true);
    s.onerror = () => termine(f, false);
    document.head.appendChild(s);
  }
  // l'écran d'attente disparaît quand tout le code de l'application a été lu
  document.addEventListener("DOMContentLoaded", () => {
    afficher();
    const e = document.getElementById("ecran-chargement");
    if (e) e.remove();
  });

  return { donnees3D: () => promesse, pret: () => pret, manques: () => rates.slice() };
})();
