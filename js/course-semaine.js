"use strict";
/* =====================================================================
   (v105) Course de la semaine : la même course pour tous tes amis pendant la semaine (lundi à dimanche), sans serveur.
   Le parcours, le nombre de tours, les 39 adversaires (noms, profils, vélos, maillots, allure, moment de leurs attaques), le vent
   et le ciel (toujours clair) sont tirés au hasard à partir du numéro de la semaine : ils sont identiques chez chacun (même version).
   Leur force est réglée sur TA FTP, comme au niveau « Normal » : on compare donc d'abord la place, puis le temps et les watts par kilo.
   Les résultats s'échangent par un « code course » (VC1:…) copié-collé ; ils viennent d'un autre ordinateur : tout est vérifié.
   ===================================================================== */
const CourseSemaine = (function () {
  const CLE = "velo_course_semaine_v1", PREF = "VC1:", NB_AMIS = 40;
  // mondes fabriqués, identiques chez tout le monde (une boucle ou une montée)
  const MONDES_COURSE = ["ardennes", "toscane", "criterium", "nord", "huy", "flandres", "mer", "alpes", "desert"];
  const DISTANCE = 32000;       // distance visée sur une boucle (m)

  function semaineDe(d) {                       // numéro de semaine ISO, « 2026-W48 »
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), j = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - j);
    const a = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return t.getUTCFullYear() + "-W" + String(Math.ceil(((t - a) / 86400000 + 1) / 7)).padStart(2, "0");
  }
  const semaine = () => semaineDe(new Date());
  const valide = (s) => typeof s === "string" && /^\d{4}-W\d{2}$/.test(s);

  // tirage reproductible : la même semaine donne la même suite de nombres chez tout le monde
  function tirage(texte) {
    let h = 2166136261;
    for (let i = 0; i < texte.length; i++) { h ^= texte.charCodeAt(i); h = Math.imul(h, 16777619); }
    let a = h >>> 0;
    return () => { a = a + 0x6D2B79F5 | 0; let x = Math.imul(a ^ a >>> 15, 1 | a); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; };
  }
  function plan(sem) {
    const [an, n] = sem.split("-W").map((x) => parseInt(x, 10));
    const dispo = MONDES_COURSE.map((id) => MONDES.find((m) => m.id === id)).filter((m) => m && m.route);
    const m = dispo[(an * 53 + n) % dispo.length], r = m.route;
    const tours = r.boucle ? Math.max(1, Math.min(12, Math.round(DISTANCE / r.longueur))) : 0;
    const R = tirage("velo-course-" + sem);
    return { semaine: sem, monde: m.id, nomMonde: m.nom, tours, km: (tours ? tours * r.longueur : r.longueur) / 1000,
      dplus: Math.round(r.dplus * Math.max(1, tours)), graine: 1 + Math.floor(R() * 2e9), vent: { dir: R() * 6.283, vit: 2 + 3 * R() } };
  }
  // les 39 adversaires : le tirage de Math.random est remplacé le temps de les créer
  function equipe(p) {
    const R = tirage("velo-equipe-" + p.semaine), vrai = Math.random;
    Math.random = R;
    try { return Peloton.tirerEquipe(Peloton.MAX_IA, false); } finally { Math.random = vrai; }
  }

  /* ----- résultats de la semaine (le mien : mon meilleur temps ; ceux des amis : par leurs codes) ----- */
  const nb = (x, a, b) => (typeof x === "number" && isFinite(x) && x >= a && x <= b ? x : null);
  function verifierResultat(o) {
    if (!o || typeof o !== "object") return null;
    const r = { t: nb(o.t, 60, 86400), r: nb(o.r, 1, 60), n: nb(o.n, 2, 60), w: nb(o.w, 0, 2000), k: nb(o.k, 0, 12), v: nb(o.v, 1, 10000), d: nb(o.d, 0, 1e14) };
    return r.t !== null && r.r !== null && r.n !== null ? r : null;
  }
  function lire() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(CLE)); } catch (e) { /* ignoré */ }
    if (!d || d.semaine !== semaine()) return { semaine: semaine(), moi: null, amis: [] };
    return { semaine: d.semaine, moi: verifierResultat(d.moi),
      amis: (Array.isArray(d.amis) ? d.amis : []).map((x) => { const r = verifierResultat(x); return r && typeof x.a === "string" ? Object.assign(r, { a: x.a.slice(0, 18) }) : null; }).filter(Boolean).slice(0, NB_AMIS) };
  }
  const ecrire = (d) => { try { localStorage.setItem(CLE, JSON.stringify(d)); } catch (e) { /* stockage indisponible */ } };

  const nomPartage = () => ($("groupe-nom") && $("groupe-nom").value.trim()) || "Cycliste";
  function code() {
    const d = lire();
    if (!d.moi) return "";
    return PREF + btoa(unescape(encodeURIComponent(JSON.stringify(Object.assign({ a: nomPartage().slice(0, 18), s: d.semaine }, d.moi)))));
  }
  function importer(texte) {
    texte = (texte || "").trim();
    if (!texte.startsWith(PREF) || texte.length > 2000) return "Ce n’est pas un code de la course de la semaine (il commence par " + PREF + ").";
    let o;
    try { o = JSON.parse(decodeURIComponent(escape(atob(texte.slice(PREF.length))))); } catch (e) { return "Code illisible : copie-le en entier."; }
    const r = verifierResultat(o);
    if (!r || typeof o.a !== "string" || !o.a.trim() || !valide(o.s)) return "Code incomplet.";
    if (o.s !== semaine()) return "Ce code vient d’une autre semaine (" + o.s + ") : la course de cette semaine est différente.";
    let nom = o.a.trim().slice(0, 18);
    if (nom === "Toi") nom = "Toi (ami)";
    const d = lire(), i = d.amis.findIndex((x) => x.a === nom);
    if (i >= 0) d.amis[i] = Object.assign(r, { a: nom });
    else if (d.amis.length < NB_AMIS) d.amis.push(Object.assign(r, { a: nom }));
    else return "Il y a déjà " + NB_AMIS + " résultats cette semaine.";
    ecrire(d); rendre();
    return "Résultat de " + nom + " ajouté ✓" + (r.v !== null && r.v !== VERSION_APPLI ? " — attention, version " + r.v + " (la tienne : " + VERSION_APPLI + ") : ses adversaires peuvent être différents." : "");
  }

  /* ----- la course elle-même ----- */
  let armee = null, ventImpose = false, iDepart = 0;
  const reglagesOk = (p) => mondeActifId === p.monde && $("peloton-mode").value === "course" && $("course-format").value === "classique" &&
    $("peloton-niveau").value === "equilibre" && (parseInt($("peloton-tours").value, 10) || 0) === p.tours;
  // appelée au moment de créer les coureurs (lancerPeloton) : null si ce n'est pas la course de la semaine
  function depart() {
    if (!armee || armee.semaine !== semaine() || !reglagesOk(armee)) { liberer(); return null; }
    Aero.reg.ventFixe = armee.vent; ventImpose = true;
    if (monde3d && monde3d.definirMeteo) monde3d.definirMeteo("clair");
    iDepart = session.samples.length;
    return { equipe: equipe(armee), graine: armee.graine, tours: armee.tours };
  }
  function liberer() {
    if (!ventImpose) return;
    ventImpose = false; Aero.reg.ventFixe = null;
    if (monde3d && monde3d.definirMeteo) monde3d.definirMeteo("auto");
  }
  const quitter = () => { armee = null; liberer(); };
  const quitterVent = liberer;                  // course d'un autre genre : vent et météo habituels
  // les réglages ont été vérifiés au départ (depart) ; les toucher sur l'accueil en cours de course ne change pas la course
  const active = () => !!armee && ventImpose && mondeActifId === armee.monde;

  // bouton « Courir » : prépare le parcours et les réglages, puis lance le départ
  function courir() {
    const msg = $("cs-msg");
    if (session.samples.length) { msg.textContent = "Termine ou abandonne d’abord la sortie en cours."; return; }
    if ($("btn-cest-parti").disabled) { msg.textContent = "La 3D se prépare encore : réessaie dans un instant."; return; }
    const p = plan(semaine());
    $("peloton-mode").value = "course"; $("peloton-mode").dispatchEvent(new Event("change")); majModes();
    choisirMonde(p.monde);
    $("course-format").value = "classique"; $("peloton-niveau").value = "equilibre";
    $("peloton-tours").value = String(p.tours); $("seance-monde").value = "";
    if (modeActuel() === "erg") { document.querySelector("input[name=mode][value=route]").checked = true; reinitialiserEnvois(); }
    sauverReglages(); majResumeChoix();
    armee = p; msg.textContent = "";
    $("btn-cest-parti").click();
  }

  // fin de sortie (construireResume) : enregistre le résultat si la ligne d'arrivée a été franchie
  function terminer(course) {
    if (!active()) return null;
    if (armee.semaine !== semaine()) return { texte: "La semaine a changé pendant la course : ce résultat n’est pas gardé." };
    const u = Peloton.user();
    if (!course || !course.fini || !(u.fin > 0)) return { texte: "Course de la semaine non terminée : franchis la ligne d’arrivée pour avoir un résultat." };
    const ech = session.samples.slice(iDepart, iDepart + Math.round(u.fin)), w = ech.length ? ech.reduce((s, x) => s + (x.p || 0), 0) / ech.length : 0;
    const poids = parseFloat($("poids").value) || 75;
    const res = { t: Math.round(u.fin * 10) / 10, r: course.rang, n: course.n, w: Math.round(w), k: Math.round(w / poids * 100) / 100, v: VERSION_APPLI, d: Date.now() };
    const d = lire(), avant = d.moi;
    const mieux = !avant || res.t < avant.t;
    if (mieux) { d.moi = res; ecrire(d); }
    rendre();
    return { texte: "Course de la semaine : " + res.r + (res.r === 1 ? "er" : "e") + " sur " + res.n + " en " + formatDuree(Math.round(res.t)) + " (" + fr2(res.k) + " W/kg)" +
      (mieux ? avant ? " · meilleur temps de la semaine, avant : " + formatDuree(Math.round(avant.t)) : "" : " · ton meilleur reste " + formatDuree(Math.round(avant.t))), code: true };
  }
  function htmlResume(c) {
    if (!c) return "";
    return '<div class="rf-nolio rf-cs"><b>🏁</b><span>' + echapper(c.texte) + "</span>" + (c.code ? '<button type="button" data-cs="copier">Copier mon code course</button>' : "") + "</div>";
  }
  async function copierCode(bouton) {
    const c = code();
    if (!c) return;
    let ok = false;
    try { await navigator.clipboard.writeText(c); ok = true; } catch (e) { /* presse-papiers refusé : on affiche le code */ }
    const zone = $("cs-code-sortie");
    if (zone) { zone.value = c; zone.hidden = ok; if (!ok) { zone.select(); } }
    if (bouton) bouton.textContent = ok ? "Code copié ✓ envoie-le à tes amis" : "Copie le code affiché sur l’accueil";
  }

  /* ----- carte de la page d'accueil ----- */
  function ligne(cellules, moi) {
    const tr = document.createElement("tr");
    if (moi) tr.className = "moi";
    for (const c of cellules) { const td = document.createElement("td"); td.textContent = c; tr.append(td); }
    return tr;
  }
  function rendre() {
    if (!$("course-semaine") || !MONDES.some((m) => m.route)) return;
    const p = plan(semaine()), d = lire();
    const lundi = new Date(); lundi.setDate(lundi.getDate() - ((lundi.getDay() + 6) % 7));
    const dimanche = new Date(lundi); dimanche.setDate(lundi.getDate() + 6);
    $("cs-resume").textContent = p.nomMonde + (d.moi ? " · toi : " + d.moi.r + (d.moi.r === 1 ? "er" : "e") : "");
    $("cs-parcours").textContent = p.nomMonde + " · " + (p.tours > 1 ? p.tours + " tours · " : "") + fr1(p.km) + " km · D+ " + p.dplus + " m · 39 adversaires au niveau Normal (réglés sur ta FTP) · jusqu’au dimanche " + dimanche.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
    $("cs-copier").hidden = !d.moi;
    const tous = (d.moi ? [Object.assign({ a: "Toi", moi: true }, d.moi)] : []).concat(d.amis).sort((a, b) => a.r - b.r || a.t - b.t);
    const table = $("cs-table");
    table.innerHTML = "";
    table.hidden = !tous.length;
    if (!tous.length) return;
    const tete = ligne(["", "Nom", "Place", "Temps", "W/kg"]); tete.className = "tete"; table.append(tete);
    tous.forEach((x, i) => table.append(ligne([i + 1 + ".", x.a, x.r + (x.r === 1 ? "er" : "e") + " / " + x.n, formatDuree(Math.round(x.t)), x.k !== null ? fr2(x.k) : "–"], x.moi)));
  }

  if (document.getElementById("course-semaine")) {
    $("cs-courir").addEventListener("click", courir);
    $("cs-copier").addEventListener("click", () => { $("cs-copier").textContent = "Copier mon code course"; copierCode($("cs-copier")); });
    $("cs-ajout").addEventListener("click", () => { $("cs-msg").textContent = importer($("cs-code").value); $("cs-code").value = ""; });
    $("course-semaine").addEventListener("toggle", rendre);
  }
  document.addEventListener("click", (e) => { const b = e.target.closest && e.target.closest('[data-cs="copier"]'); if (b) copierCode(b); });
  return { plan, equipe, semaine, depart, quitter, quitterVent, active, terminer, htmlResume, importer, code, courir, rendre };
})();
