"use strict";
/* =====================================================================
   (v101) Matériel à débloquer : une partie des nouveaux vélos et des nouvelles roues arrive avec les niveaux
   (js/progression.js). Tout le matériel d'avant la v101 reste libre, ainsi que trois nouveautés.
   Un matériel verrouillé ne peut être ni choisi dans le garage, ni gardé par un réglage enregistré ou restauré :
   corriger() est appelé partout où le choix est lu (lireApparence et majMateriel dans js/demarrage.js).
   Les coureurs virtuels et les amis d'une sortie de groupe ne sont pas concernés.
   ===================================================================== */
const Deblocage = (function () {
  // niveau demandé ; ce qui n'est pas dans la liste est libre
  const NIVEAUX = {
    "avatar-velo": { addict: 1, noah: 6, c68: 10, bmc: 14 },
    "avatar-roues": { corima45: 1, cosmic45: 1, comete45: 2, comete50: 3, streem45: 4, bora35: 5, enve40: 7, zipp404: 8, mavic52: 9,
      streem60: 11, duraace: 12, shamal: 13, sharq: 16, lw_ob: 18, wake6560: 20 }
  };
  const SECOURS = { "avatar-velo": "mystero", "avatar-roues": "50" };   // matériel libre repris si le choix est verrouillé
  const dernier = Object.assign({}, SECOURS);

  const niveauActuel = () => Progression.niveau().n;
  const requis = (liste, id) => (NIVEAUX[liste] && NIVEAUX[liste][id]) || 1;
  const ouvert = (liste, id) => niveauActuel() >= requis(liste, id);
  // expérience totale nécessaire pour atteindre le niveau n (400 XP, puis 200 de plus à chaque niveau, comme dans js/progression.js)
  const xpDuNiveau = (n) => 400 * (n - 1) + 100 * (n - 1) * (n - 2);
  const xpRestant = (n) => Math.max(0, Math.ceil(xpDuNiveau(n) - Progression.xp()));

  const nomDe = (liste, id) => {
    const o = document.querySelector("#" + liste + ' option[value="' + id + '"]');
    return o ? o.textContent.trim() : id;
  };
  // tout le matériel qui se débloque (niveau 2 et plus), du premier au dernier
  function tout() {
    const l = [];
    for (const liste in NIVEAUX) for (const id in NIVEAUX[liste]) {
      const n = NIVEAUX[liste][id];
      if (n > 1) l.push({ liste, id, niveau: n, velo: liste === "avatar-velo", nom: nomDe(liste, id), ouvert: niveauActuel() >= n });
    }
    return l.sort((a, b) => a.niveau - b.niveau);
  }
  const entre = (avant, apres) => tout().filter((x) => x.niveau > avant && x.niveau <= apres);
  function prochain() {
    const l = tout().filter((x) => !x.ouvert);
    return l.length ? { niveau: l[0].niveau, xp: xpRestant(l[0].niveau), items: l.filter((x) => x.niveau === l[0].niveau) } : null;
  }
  // remplace un vélo ou des roues verrouillés par le dernier choix permis ; renvoie vrai si quelque chose a changé
  function corriger() {
    let change = false;
    for (const liste in NIVEAUX) {
      const s = document.getElementById(liste);
      if (!s) continue;
      if (ouvert(liste, s.value)) { dernier[liste] = s.value; continue; }
      const refuse = s.value;
      s.value = ouvert(liste, dernier[liste]) ? dernier[liste] : SECOURS[liste];
      change = true;
      if (typeof log === "function") log(nomDe(liste, refuse) + " : se débloque au niveau " + requis(liste, refuse) + ".");
    }
    return change;
  }
  return { requis, ouvert, tout, entre, prochain, corriger, xpRestant, niveauActuel };
})();
