"use strict";
/* =====================================================================
   (v98) Envoi des séances à Nolio (https://www.nolio.io) : le fichier .FIT de la sortie est envoyé par l'API de Nolio
   (POST /api/v2/real/trainings/import/, fichier encodé en base64, traité ensuite par Nolio). Il faut une clé d'API Nolio (jeton personnel) collée
   dans Réglages → Données et appli ; elle reste dans ce navigateur (localStorage). Envoi automatique à « Terminer et enregistrer » si la case est cochée,
   sinon bouton dans la fenêtre de fin de sortie. Nolio ne détecte pas les doublons : chaque séance n'est envoyée qu'une fois (velo_nolio_envoyes).
   ===================================================================== */
const Nolio = (function () {
  const BASE = "https://www.nolio.io/api/v2/", CLE_JETON = "velo_nolio_jeton", CLE_AUTO = "velo_nolio_auto", CLE_ENVOYES = "velo_nolio_envoyes";
  const lire = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const ecrire = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* stockage indisponible */ } };
  const jeton = () => lire(CLE_JETON, "").trim();
  const auto = () => lire(CLE_AUTO, "0") === "1";
  const envoyes = () => { try { const l = JSON.parse(lire(CLE_ENVOYES, "[]")); return Array.isArray(l) ? l : []; } catch (e) { return []; } };
  let dernier = null, statut = "";                   // dernière sortie terminée : { octets, id, titre, comment }

  function base64(octets) {
    let s = "";
    for (let i = 0; i < octets.length; i += 0x8000) s += String.fromCharCode.apply(null, octets.slice(i, i + 0x8000));
    return btoa(s);
  }
  async function appel(chemin, options) {
    const r = await fetch(BASE + chemin, Object.assign({ headers: { Authorization: "Bearer " + jeton(), "Content-Type": "application/json" } }, options));
    let corps = null;
    try { corps = await r.json(); } catch (e) { /* corps vide (202) */ }
    return { status: r.status, corps };
  }
  const messageErreur = (r) => (r.corps && r.corps.error && (r.corps.error.message || r.corps.error.code)) || "erreur " + r.status;

  async function tester() {
    if (!jeton()) return "Colle d’abord ta clé d’API Nolio.";
    try {
      const r = await appel("app/", { method: "GET" });
      if (r.status === 200) return "Connexion à Nolio réussie ✓";
      return r.status === 401 ? "Clé refusée par Nolio (invalide ou expirée)." : "Nolio a répondu : " + messageErreur(r);
    } catch (e) { return "Nolio injoignable depuis ce navigateur (" + e.message + ")."; }
  }
  // envoie le fichier ; renvoie un message
  async function envoyerFichier(d) {
    if (!jeton()) return "Clé d’API Nolio manquante (Réglages → Données et appli).";
    if (envoyes().includes(d.id)) return "Cette séance a déjà été envoyée à Nolio.";
    try {
      const r = await appel("real/trainings/import/", { method: "POST", body: JSON.stringify({ format: "fit", data: base64(d.octets), title: d.titre, comment: d.comment }) });
      if (r.status === 202 || r.status === 200 || r.status === 201) {
        const l = envoyes(); l.push(d.id); ecrire(CLE_ENVOYES, JSON.stringify(l.slice(-100)));
        return "Séance envoyée à Nolio ✓ (elle apparaît dans ton calendrier dans quelques instants).";
      }
      return "Nolio a refusé l’envoi : " + messageErreur(r);
    } catch (e) { return "Envoi impossible (" + e.message + ") : vérifie ta connexion Internet."; }
  }
  function majStatut(t) {
    statut = t;
    const e = document.getElementById("nolio-statut");
    if (e) e.textContent = t;
    log("Nolio : " + t);
  }
  // appelée à « Terminer et enregistrer », juste après la création du .FIT (les échantillons sont encore là) ; envoi automatique si la case est cochée
  function terminee(octets, id) {
    const titre = "Vélo virtuel · " + (route && route.nom ? route.nom : "sortie"), comment = "Séance enregistrée avec Vélo virtuel.";
    dernier = { octets, id, titre, comment };
    statut = "";
    if (auto() && jeton()) { majStatut("envoi en cours…"); envoyerFichier(dernier).then(majStatut); }
  }
  // bloc de la fenêtre de fin de sortie
  function htmlResume() {
    if (!dernier || !jeton()) return "";
    const deja = envoyes().includes(dernier.id);
    return '<div class="rf-nolio"><b>Nolio</b><span id="nolio-statut">' + (statut || (deja ? "Séance déjà envoyée ✓" : "")) + "</span>" + (deja || statut.includes("en cours") ? "" : '<button type="button" id="nolio-envoyer">Envoyer à Nolio</button>') + "</div>";
  }
  function brancher(c) {
    const b = c.querySelector("#nolio-envoyer");
    if (b) b.addEventListener("click", async () => { b.disabled = true; majStatut("envoi en cours…"); majStatut(await envoyerFichier(dernier)); b.hidden = envoyes().includes(dernier.id); b.disabled = false; });
  }
  // réglages
  if (document.getElementById("nolio-jeton")) {
    $("nolio-jeton").value = jeton(); $("nolio-auto").checked = auto();
    $("nolio-jeton").addEventListener("change", () => ecrire(CLE_JETON, $("nolio-jeton").value.trim()));
    $("nolio-auto").addEventListener("change", () => ecrire(CLE_AUTO, $("nolio-auto").checked ? "1" : "0"));
    $("nolio-tester").addEventListener("click", async () => { ecrire(CLE_JETON, $("nolio-jeton").value.trim()); $("nolio-msg").textContent = "Test en cours…"; $("nolio-msg").textContent = await tester(); });
    $("nolio-oublier").addEventListener("click", () => { ecrire(CLE_JETON, ""); $("nolio-jeton").value = ""; $("nolio-msg").textContent = "Clé effacée de ce navigateur."; });
  }
  return { terminee, htmlResume, brancher, tester };
})();
