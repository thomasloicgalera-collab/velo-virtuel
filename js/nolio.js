"use strict";
/* =====================================================================
   (v98) Envoi des séances à Nolio (https://www.nolio.io) : le fichier .FIT de la sortie est envoyé par l'API de Nolio
   (POST /api/v2/real/trainings/import/, fichier encodé en base64, traité ensuite par Nolio). Il faut une clé d'API Nolio (jeton personnel) collée
   dans Réglages → Données et appli ; elle reste dans ce navigateur (localStorage). Envoi automatique à « Terminer et enregistrer » si la case est cochée,
   sinon bouton dans la fenêtre de fin de sortie. Nolio ne détecte pas les doublons : chaque séance n'est envoyée qu'une fois (velo_nolio_envoyes).
   (v105) Séances prévues : lecture du calendrier (GET planned/trainings/, droit « planned:read » de la clé), la structure (blocs, répétitions,
   cibles en watts calculées par Nolio, cadence, cœur) est convertie en séance ERG et rangée dans « Mes séances ». Rien n'est modifié dans Nolio.
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
    return '<div class="rf-nolio"><b>Nolio</b><span id="nolio-statut">' + echapper(statut || (deja ? "Séance déjà envoyée ✓" : "")) + "</span>" + (deja || statut.includes("en cours") ? "" : '<button type="button" id="nolio-envoyer">Envoyer à Nolio</button>') + "</div>";
  }
  function brancher(c) {
    const b = c.querySelector("#nolio-envoyer");
    if (b) b.addEventListener("click", async () => { b.disabled = true; majStatut("envoi en cours…"); majStatut(await envoyerFichier(dernier)); b.hidden = envoyes().includes(dernier.id); b.disabled = false; });
  }
  /* ----- (v105) séances prévues dans Nolio ----- */
  const jourIso = (d) => d.getFullYear() + "-" + deuxChiffres(d.getMonth() + 1) + "-" + deuxChiffres(d.getDate());
  const texte = (v) => (typeof v === "string" ? v : "");
  const nombre = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  function secondes(q) {                       // durée { value, unit } → secondes
    const v = q && nombre(q.value);
    if (v === null || v === undefined || v <= 0) return 0;
    const u = texte(q.unit);
    return u === "h" ? v * 3600 : u === "min" ? v * 60 : v;
  }
  const milieu = (a, b) => { a = nombre(a); b = nombre(b); return a !== null && b !== null ? (a + b) / 2 : a !== null ? a : b; };
  // puissance (W), cœur (bpm), cadence (tr/min) et difficulté ressentie d'une étape
  function ciblesDe(etape, ftpAppli) {
    const c = { w: null, bas: null, haut: null, bpm: null, cad: null, rpe: null, ouverte: null };
    for (const t of Array.isArray(etape.targets) ? etape.targets : []) {
      if (!t || typeof t !== "object") continue;
      const r = t.resolved && typeof t.resolved === "object" ? t.resolved : null, unite = r ? texte(r.unit) : "";
      if (t.type === "rpe") { c.rpe = nombre(t.rpe_max) !== null ? milieu(t.rpe, t.rpe_max) : nombre(t.rpe); continue; }
      if (t.type === "raw") {
        const u = texte(t.unit).toLowerCase(), v = milieu(t.value, t.value_max);
        if (v === null) continue;
        if (u === "w") { c.w = v; c.bas = nombre(t.value); c.haut = nombre(t.value_max) === null ? c.bas : t.value_max; }
        else if (u === "rpm") c.cad = v;
        else if (u === "bpm") c.bpm = v;
        continue;
      }
      if (r && unite === "W") {
        let bas = nombre(r.low), haut = nombre(r.high);
        if (bas === null && haut === null) bas = haut = nombre(r.value);
        if (bas === null && haut !== null) bas = haut * 0.92;
        if (haut === null && bas !== null) haut = bas * 1.08;
        if (bas !== null) { c.w = (bas + haut) / 2; c.bas = bas; c.haut = haut; }
      } else if (r && unite === "bpm") c.bpm = milieu(r.low, r.high) !== null ? milieu(r.low, r.high) : nombre(r.value);
      else if (r && unite === "rpm") c.cad = milieu(r.low, r.high) !== null ? milieu(r.low, r.high) : nombre(r.value);
      else if (t.type === "metric" && /FTP|PUISSANCECRITIQUE/i.test(texte(t.metric)) && nombre(t.percent) !== null) {
        const bas = t.percent / 100 * ftpAppli, haut = (nombre(t.percent_max) !== null ? t.percent_max : t.percent) / 100 * ftpAppli;
        c.w = (bas + haut) / 2; c.bas = bas; c.haut = haut;
      }
    }
    return c;
  }
  // la structure de Nolio (étapes et répétitions imbriquées) mise à plat, dans l'ordre
  function aplatir(noeuds, liste, profondeur) {
    for (const n of Array.isArray(noeuds) ? noeuds : []) {
      if (!n || typeof n !== "object" || liste.length > 600) continue;
      if (n.kind === "repeat") {
        const fois = Math.min(100, Math.max(1, parseInt(n.times, 10) || 1));
        for (let i = 0; i < fois && profondeur < 5; i++) {
          const debut = liste.length;
          aplatir(n.steps, liste, profondeur + 1);
          // « skip_last » : pas de récupération après le dernier effort
          if (n.skip_last && i === fois - 1) {
            for (let j = liste.length - 1; j >= debut; j--) if (secondes(liste[j].duration)) { if (["rest", "cooldown"].includes(texte(liste[j].intensity))) liste.splice(j, 1); break; }
          }
        }
      } else if (n.kind === "step") liste.push(n);
      else liste.push({ kind: "autre" });                     // exercices de musculation : ignorés
    }
    return liste;
  }
  // renvoie { ints, textes, notes } : intervalles de l'appli (en % du FTP de l'appli, donc les mêmes watts que Nolio)
  function convertir(workout, ftpAppli, fcmaxAppli) {
    const ints = [], textes = [], notes = [], pct = (w) => Math.round(borner(w / ftpAppli * 100, 20, 300));
    let t = 0, ignores = 0, libres = 0, coeur = 0;
    for (const e of aplatir(workout, [], 0)) {
      const s = secondes(e.duration);
      if (!s) { if (e.kind === "autre" || e.distance) ignores++; continue; }     // sans durée : simple note (ou étape à la distance, non gérée)
      if (t + s > 12 * 3600 || ints.length >= 500) { ignores++; continue; }
      const c = ciblesDe(e, ftpAppli), genre = texte(e.intensity), min = Math.round(s / 60 * 1000) / 1000;
      let iv;
      if (c.w !== null && genre !== "freeride") {
        iv = { min, pct: pct(c.w) };
        if ((genre === "ramp_up" || genre === "ramp_down") && c.haut > c.bas) {
          iv.pct = pct(genre === "ramp_up" ? c.bas : c.haut); iv.fin = pct(genre === "ramp_up" ? c.haut : c.bas);
        }
      } else if (c.bpm !== null && genre !== "freeride") {
        iv = { min, pct: 65, fc: Math.round(borner(c.bpm / fcmaxAppli * 100, 50, 98)) }; coeur++;
      } else {
        iv = { min, pct: Math.round(borner(35 + 8 * (c.rpe !== null ? c.rpe : 5), 40, 120)), libre: true }; libres++;
      }
      if (c.cad !== null && c.cad >= 30 && c.cad <= 200) iv.cad = Math.round(c.cad);
      const com = texte(e.comment).replace(/\s+/g, " ").trim();
      if (com) textes.push([Math.round(t), com.slice(0, 120), 10]);
      ints.push(iv); t += s;
    }
    if (libres) notes.push(libres + (libres > 1 ? " blocs sans puissance : en effort libre" : " bloc sans puissance : en effort libre"));
    if (coeur) notes.push(coeur + (coeur > 1 ? " blocs guidés par le cœur" : " bloc guidé par le cœur"));
    if (ignores) notes.push(ignores + (ignores > 1 ? " étapes ignorées (distance ou musculation)" : " étape ignorée (distance ou musculation)"));
    return { ints, textes: textes.slice(0, 60), notes, duree: Math.round(t) };
  }
  function messageLecture(r) {
    const e = r.corps && r.corps.error;
    if (r.status === 401) return "Clé refusée par Nolio (invalide ou expirée).";
    if (r.status === 403 && e && e.code === "missing_scope") return "Ta clé ne permet pas de lire les séances prévues : crée dans Nolio une clé avec le droit de lecture du planning (planned:read), puis colle-la dans les Réglages.";
    if (r.status === 429) return "Trop de demandes à Nolio : réessaie un peu plus tard.";
    return "Nolio a répondu : " + messageErreur(r);
  }
  // séances avec des blocs, d'aujourd'hui à dans `jours` jours ; { liste } ou { erreur }
  async function prevues(jours) {
    if (!jeton()) return { erreur: "Ajoute d’abord ta clé d’API Nolio (Réglages → Données et appli)." };
    const debut = new Date(), fin = new Date(debut.getTime() + jours * 86400000);
    try {
      const r = await appel("planned/trainings/?date_from=" + jourIso(debut) + "&date_to=" + jourIso(fin) + "&limit=100&fields=id,date_start,name,duration,has_structured_workout", { method: "GET" });
      if (r.status !== 200) return { erreur: messageLecture(r) };
      const brut = r.corps && Array.isArray(r.corps.data) ? r.corps.data : [];
      const liste = brut.filter((x) => x && x.has_structured_workout && /^[A-Za-z0-9_-]{3,60}$/.test(texte(x.id)) && /^\d{4}-\d{2}-\d{2}$/.test(texte(x.date_start)))
        .map((x) => ({ id: x.id, date: x.date_start, nom: texte(x.name).slice(0, 80) || "Séance", duree: secondes(x.duration) }))
        .sort((a, b) => a.date.localeCompare(b.date));
      return { liste };
    } catch (e) { return { erreur: "Nolio injoignable (" + e.message + ") : vérifie ta connexion Internet." }; }
  }
  const jourCourt = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "numeric" });
  // lit une séance prévue dans Nolio et la convertit (sans rien ranger) ; { nom, ints, textes, notes, duree, id } ou { erreur }
  async function lireSeance(x) {
    try {
      const lire1 = async (id) => {
        const r = await appel("planned/trainings/" + encodeURIComponent(id) + "/", { method: "GET" });
        if (r.status !== 200 || !r.corps) throw new Error(messageLecture(r));
        return r.corps.data && !r.corps.workout ? r.corps.data : r.corps;
      };
      const d = await lire1(x.id);
      let blocs = Array.isArray(d.workout) ? d.workout.slice() : [];
      for (const p of (Array.isArray(d.parts) ? d.parts : []).filter((p) => p !== x.id && typeof p === "string").slice(0, 5)) {   // séance en plusieurs parties
        const dp = await lire1(p);
        if (Array.isArray(dp.workout)) blocs = blocs.concat(dp.workout);
      }
      const c = convertir(blocs, ftp(), fcmax());
      if (!c.ints.length) return { erreur: "Cette séance n’a aucun bloc chronométré utilisable." };
      const nom = ("Nolio " + jourCourt(x.date) + " · " + (texte(d.name) || x.nom)).slice(0, 90);
      return Object.assign({ nom, id: x.id }, c);
    } catch (e) { return { erreur: e.message || "lecture impossible" }; }
  }
  // la range dans « Mes séances » (même nom : remplacée)
  function ranger(c) {
    seancesImportees = seancesImportees.filter((s) => s.nom !== c.nom);
    seancesImportees.unshift({ nom: c.nom, ints: c.ints, textes: c.textes, nolio: c.id });
    seancesImportees = seancesImportees.slice(0, MAX_SEANCES);
    sauverImportees(); rendreBiblio();
    return c;
  }
  async function importer(x) { const c = await lireSeance(x); return c.erreur ? c : ranger(c); }
  const resume = (c) => formatDuree(c.duree) + (c.notes.length ? " · " + c.notes.join(" · ") : "");

  // onglet Séances : liste des séances prévues (aujourd'hui et les 7 jours suivants)
  function brancherSeances() {
    const bouton = document.getElementById("nolio-prevues");
    if (!bouton) return;
    const msg = $("nolio-prevues-msg"), liste = $("nolio-prevues-liste");
    bouton.addEventListener("click", async () => {
      bouton.disabled = true; msg.textContent = "Lecture de ton calendrier Nolio…"; liste.innerHTML = "";
      const r = await prevues(7);
      bouton.disabled = false;
      if (r.erreur) { msg.textContent = r.erreur; return; }
      const auj = jourIso(new Date());
      msg.textContent = r.liste.length ? "Séances avec des blocs, des 8 prochains jours :" : "Aucune séance avec des blocs d’ici 7 jours dans ton calendrier Nolio.";
      for (const x of r.liste) {
        const li = document.createElement("li"), t = document.createElement("span"), b = document.createElement("button");
        t.textContent = (x.date === auj ? "Aujourd’hui" : jourCourt(x.date)) + " · " + x.nom + (x.duree ? " · " + formatDuree(Math.round(x.duree)) : "");
        if (x.date === auj) li.className = "auj";
        b.type = "button"; b.className = "petit"; b.textContent = "Charger";
        b.addEventListener("click", async () => {
          b.disabled = true; b.textContent = "…";
          const c = await importer(x);
          b.disabled = false; b.textContent = "Charger";
          if (c.erreur) { msg.textContent = c.erreur; return; }
          SQ.sel = "imp:" + c.nom; SQ.filtre = "mes"; rendreBiblio();
          msg.textContent = "« " + c.nom + " » ajoutée à « Mes séances » (" + resume(c) + "). Les watts sont ceux calculés par Nolio.";
        });
        li.append(t, b); liste.append(li);
      }
    });
  }
  // page Rouler : charge la séance du jour et la choisit pour la sortie
  async function seanceDuJour() {
    const msg = $("msg-import-a"), bouton = $("btn-nolio-jour");
    bouton.disabled = true; msg.textContent = "Lecture de ton calendrier Nolio…";
    const r = await prevues(0);
    if (r.erreur) { msg.textContent = r.erreur; bouton.disabled = false; return; }
    if (!r.liste.length) { msg.textContent = "Aucune séance avec des blocs prévue aujourd’hui dans Nolio (les 7 jours suivants : onglet Séances)."; bouton.disabled = false; return; }
    // plusieurs séances aujourd'hui (course à pied, musculation…) : la première avec des watts, sinon la première guidée par le cœur
    let choix = null, coeur = null, erreur = "";
    for (const x of r.liste.slice(0, 5)) {
      const s = await lireSeance(x);
      if (s.erreur) { erreur = s.erreur; continue; }
      if (s.ints.some((iv) => !iv.libre && !iv.fc)) { choix = s; break; }
      if (!coeur && s.ints.some((iv) => iv.fc)) coeur = s;
    }
    bouton.disabled = false;
    if (!choix && !coeur) { msg.textContent = erreur || "La séance prévue aujourd’hui n’a pas de cible en watts ni en fréquence cardiaque. Tu peux quand même la charger depuis l’onglet Séances."; return; }
    const c = ranger(choix || coeur);
    majChoixSeanceMonde(); $("seance-monde").value = "imp:" + c.nom; majResumeChoix();
    msg.textContent = "« " + c.nom + " » choisie (" + resume(c) + ")" + (r.liste.length > 1 ? " · " + (r.liste.length - 1) + " autre(s) aujourd’hui : onglet Séances" : "") + ".";
  }
  // le bouton de la page Rouler n'apparaît que si une clé est enregistrée
  const majBoutonJour = () => { const b = document.getElementById("btn-nolio-jour"); if (b) b.hidden = !jeton(); };
  if (document.getElementById("btn-nolio-jour")) $("btn-nolio-jour").addEventListener("click", seanceDuJour);
  majBoutonJour();
  brancherSeances();

  // réglages
  if (document.getElementById("nolio-jeton")) {
    $("nolio-jeton").value = jeton(); $("nolio-auto").checked = auto();
    $("nolio-jeton").addEventListener("change", () => { ecrire(CLE_JETON, $("nolio-jeton").value.trim()); majBoutonJour(); });
    $("nolio-auto").addEventListener("change", () => ecrire(CLE_AUTO, $("nolio-auto").checked ? "1" : "0"));
    $("nolio-tester").addEventListener("click", async () => { ecrire(CLE_JETON, $("nolio-jeton").value.trim()); $("nolio-msg").textContent = "Test en cours…"; $("nolio-msg").textContent = await tester(); });
    $("nolio-oublier").addEventListener("click", () => { ecrire(CLE_JETON, ""); $("nolio-jeton").value = ""; $("nolio-msg").textContent = "Clé effacée de ce navigateur."; majBoutonJour(); });
  }
  return { terminee, htmlResume, brancher, tester, convertir, prevues, importer };
})();
