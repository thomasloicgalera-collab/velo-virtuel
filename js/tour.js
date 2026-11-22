"use strict";
/* =====================================================================
   (v69 suite) Tour à étapes : 3 à 5 étapes sur des mondes différents (plat, vallonné,
   contre-la-montre, montagne), avec les mêmes coureurs virtuels du début à la fin.
   Classement général au temps (bonifications 10, 6 et 4 s aux trois premiers d'une
   étape en ligne ; même temps pour un groupe arrivé ensemble), maillot jaune et
   maillot à pois (points au sommet des montées détectées sur le parcours).
   Gardé dans le navigateur (velo_tour_v1) : une étape quand on veut.
   ===================================================================== */
const Tour = (function () {
  const CLE = "velo_tour_v1";
  const TYPES = { plat: "Plat", vallonne: "Vallonné", montagne: "Montagne", clm: "Contre-la-montre" };
  // mondes possibles pour chaque type d'étape, avec la distance visée (0 = parcours en entier, aller simple)
  const BANQUE = {
    plat: [["mer", 30], ["nord", 31], ["criterium", 40], ["longchamp", 40], ["triS", 40]],
    vallonne: [["ardennes", 50], ["toscane", 40], ["desert", 40]],
    montagne: [["pyrenees", 0], ["alpes", 0]],
    clm: [["triXS", 10], ["triS", 20], ["prologue", 0], ["polders", 40], ["chronocol", 0]]
  };
  const PLANS = { 3: ["plat", "clm", "montagne"], 4: ["plat", "clm", "vallonne", "montagne"], 5: ["plat", "vallonne", "clm", "plat", "montagne"] };
  const NOMS_TOUR = ["Tour des Quatre Vents", "Tour de la Vallée", "Grande Boucle virtuelle", "Tour des Cols et des Plaines", "Ronde des Saisons", "Tour du Home Trainer"];
  const BONIF = [10, 6, 4];
  // (v86) points : sprints intermédiaires (maillot vert), arrivée des étapes en ligne, et nombre de coureurs d'une équipe comptés au temps par équipe
  const PTS_SPRINT = [10, 8, 6, 5, 4, 3, 2, 1], PTS_ARRIVEE = [20, 17, 15, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1], NB_EQUIPE = 3;
  const lireJ = () => { try { const j = JSON.parse(localStorage.getItem(CLE)); return j && Array.isArray(j.etapes) ? j : null; } catch (e) { return null; } };
  const ecrire = () => { try { if (tour) localStorage.setItem(CLE, JSON.stringify(tour)); else localStorage.removeItem(CLE); } catch (e) { /* stockage indisponible */ } };
  let tour = lireJ();
  let enCours = null, suivi = null;       // étape en train d'être courue (indice) ; sommets passés pendant l'étape

  const monde = (id) => (typeof MONDES !== "undefined" ? MONDES.find((m) => m.id === id) : null);
  const prochaine = () => tour && !tour.fini ? tour.etapes.findIndex((e, i) => !tour.res[i]) : -1;
  // (v88) nombre de tours d'une étape : la distance visée ; hors contre-la-montre au moins 35 km, et les petits circuits (Critérium, Longchamp) au moins 10 tours et 40 km
  function toursEtape(m, cible, type) {
    const L = m.route.longueur;
    if (!m.route.boucle) return 0;
    let tours = Math.max(1, Math.round((cible || L) / L));
    if (type !== "clm") {
      const tc = toursConseilles(m.route);
      if (tc) tours = Math.max(tours, tc);
      tours = Math.max(tours, Math.ceil(35000 / L));
    }
    return tours;
  }
  function creer(nb, niveau, nombre, enEquipe) {
    const plan = PLANS[nb] || PLANS[3], pris = new Set(), etapes = [];
    for (const type of plan) {
      const choix = BANQUE[type].filter(([id]) => monde(id) && !pris.has(id)), c = choix[Math.floor(Math.random() * choix.length)] || BANQUE[type][0];
      pris.add(c[0]);
      const m = monde(c[0]), L = m.route.longueur, tours = toursEtape(m, c[1], type);
      etapes.push({ monde: c[0], type, tours, km: Math.round((m.route.boucle ? tours * L : L) / 100) / 10 });
    }
    const eqp = Peloton.tirerEquipe(nombre, enEquipe, parseInt($("avatar-maillot").value, 10) || undefined);
    tour = { id: Date.now(), nom: NOMS_TOUR[Math.floor(Math.random() * NOMS_TOUR.length)], niveau, equipe: eqp, etapes, res: [], gc: {}, pois: {}, sprint: {}, fini: false, enEquipe: !!enEquipe, gcEq: {}, eqDe: { Toi: 0 } };
    if (enEquipe) { tour.equipes = Peloton.NOMS_EQUIPES.map((n, i) => { const sp = eqp.find((x) => x.eq === i); return sp ? { nom: sp.nomEq, couleur: sp.couleur, kit: sp.kit } : null; }).filter(Boolean); for (const sp of eqp) tour.eqDe[sp.nom] = sp.eq; for (let i = 0; i < tour.equipes.length; i++) tour.gcEq[i] = 0; }
    for (const n of noms()) { tour.gc[n] = 0; tour.pois[n] = 0; tour.sprint[n] = 0; }
    ecrire();
    log("Nouveau Tour : « " + tour.nom + " », " + etapes.length + " étapes.");
  }
  const noms = () => ["Toi"].concat(tour.equipe.map((s) => s.nom));
  const fmtEcart = (s) => { s = Math.round(s); return s <= 0 ? "m.t." : "+" + (s >= 60 ? Math.floor(s / 60) + ":" + deuxChiffres(s % 60) : s + " s"); };
  const general = () => noms().map((n) => [n, tour.gc[n] || 0]).sort((a, b) => a[1] - b[1]);
  const grimpeurs = () => noms().map((n) => [n, tour.pois[n] || 0]).sort((a, b) => b[1] - a[1]);
  const sprinteurs = () => noms().map((n) => [n, (tour.sprint || {})[n] || 0]).sort((a, b) => b[1] - a[1]);
  const parEquipe = () => tour.enEquipe ? Object.keys(tour.gcEq || {}).map((i) => [parseInt(i, 10), tour.gcEq[i] || 0]).sort((a, b) => a[1] - b[1]) : [];
  const nomEq = (i) => tour.equipes && tour.equipes[i] ? tour.equipes[i].nom : "Équipe " + i;
  const PTS_CAT = { montee: "pois", sprint: "sprint" };
  const nomEtape = (i) => { const e = tour.etapes[i], m = monde(e.monde); return "Étape " + (i + 1) + " · " + (e.type === "clm" && tour.enEquipe ? "CLM par équipe" : TYPES[e.type]) + " · " + (m ? m.nom : e.monde) + " · " + fr1(e.km).replace(",0", "") + " km"; };

  /* ---------- Pendant l'étape ---------- */
  // « C'est parti » en mode Tour : le monde de la prochaine étape est choisi, départ au début du parcours
  function preparer() {
    const i = prochaine();
    if (i < 0) { $("msg-monde").textContent = tour && tour.fini ? "Ce Tour est terminé : crée-en un nouveau." : "Crée d’abord ton Tour (au-dessus)."; return false; }
    if (!monde(tour.etapes[i].monde)) { $("msg-monde").textContent = "Le monde de cette étape n’existe plus."; return false; }
    choisirMonde(tour.etapes[i].monde);
    $("depart-km").value = "0";
    enCours = i; suivi = null;
    return true;
  }
  function etapeEnCours() {
    if (enCours === null || !tour || typeof mondeActifId === "undefined" || mondeActifId !== tour.etapes[enCours].monde) return null;
    const e = tour.etapes[enCours];
    const m = monde(e.monde), tours = e.tours || (m && m.route.boucle ? 1 : 0);   // (v82) étape enregistrée avant qu'un monde devienne une boucle (Pyrénées) : un tour
    return { mode: e.type === "clm" ? "clm" : "course", tours, niveau: tour.niveau, ttt: e.type === "clm" && !!tour.enEquipe };   // (v87) ttt : contre-la-montre par équipe
  }
  // contre-la-montre (v86) : le mieux classé au général part en dernier (juste avant toi, qui pars toujours après tous les autres)
  // (v87) contre-la-montre par équipe : les équipes partent dans l'ordre inverse du classement par équipe (la tienne en dernier)
  const equipe = (mode) => !tour ? null : mode !== "clm" ? tour.equipe : tour.enEquipe ? tour.equipe.slice().sort((a, b) => ((tour.gcEq || {})[b.eq] || 0) - ((tour.gcEq || {})[a.eq] || 0)) : tour.equipe.slice().sort((a, b) => (tour.gc[b.nom] || 0) - (tour.gc[a.nom] || 0));
  // maillots portés pendant l'étape (classements avant l'étape)
  function maillots() {
    if (enCours === null || !tour || !tour.res.length) return null;
    const p = grimpeurs(), v = sprinteurs();
    return { jaune: general()[0][0], pois: p[0][1] > 0 ? p[0][0] : null, vert: v[0][1] > 0 ? v[0][0] : null };
  }
  // sommets des montées de l'étape (points du maillot à pois), et ordre de passage de chacun
  function sommets() {
    const L = route.longueur, d0 = Peloton.depart(), fin = d0 + Peloton.longueurCourse(), l = [];
    let segs = [];
    if (tour && enCours !== null && tour.etapes[enCours].type === "clm") return l;      // (v86) contre-la-montre : pas de points de montagne ni de sprint
    try { segs = Progression.segmentsRoute().filter((s) => s.type === "montee" || s.type === "sprint"); } catch (e) { segs = []; }
    for (const s of segs) {
      const dh = altitudeA(s.e) - altitudeA(s.s);
      const pts = s.type === "sprint" ? PTS_SPRINT : dh >= 600 ? [20, 15, 12, 10, 8, 6, 4, 2] : dh >= 300 ? [10, 8, 6, 4, 2, 1] : dh >= 120 ? [5, 3, 2, 1] : dh >= 40 ? [2, 1] : null;
      if (!pts) continue;
      for (let k = 0; route.boucle ? k * L + s.e <= fin + 1 : k < 1; k++) { const E = (route.boucle ? k * L : 0) + s.e; if (E > d0 && E <= fin + 1) l.push({ E, pts, nom: s.nom, type: s.type, ordre: [] }); }
    }
    return l;
  }
  function maj() {
    if (enCours === null || !etapeEnCours() || !Peloton.actif() || !Peloton.parti()) return;
    if (!suivi) suivi = { sommets: sommets(), prec: {} };
    const comp = Peloton.coureurs().map((r) => [r.nom, r.d]);
    comp.push(["Toi", balade.distance]);
    for (const [n, d] of comp) {
      const p = suivi.prec[n];
      suivi.prec[n] = d;
      if (p === undefined) continue;
      for (const s of suivi.sommets) if (p < s.E && d >= s.E && s.ordre.indexOf(n) < 0) {
        s.ordre.push(n);
        if (n === "Toi" && s.ordre.length <= s.pts.length) annoncer((s.type === "sprint" ? "Sprint : " : "Sommet : ") + s.nom, (s.ordre.length === 1 ? "1er" : s.ordre.length + "e") + (s.type === "sprint" ? " au sprint · +" : " au sommet · +") + s.pts[s.ordre.length - 1] + (s.type === "sprint" ? " pts au maillot vert" : " pts au maillot à pois"), "", 5);
      }
    }
  }
  function quitterEtape() { enCours = null; suivi = null; }

  /* ---------- (v86) Les 4 classements : général, grimpeur (pois), sprinteur (vert), équipes ---------- */
  function rangEtapeEq(eqRes) {
    if (!eqRes) return "";
    const l = Object.keys(eqRes).map((q) => [parseInt(q, 10), eqRes[q]]).sort((a, b) => a[1] - b[1]), k = l.findIndex((x) => x[0] === 0);
    return k < 0 ? "" : '<div>Étape par équipe : <b>' + (k === 0 ? "1re" : (k + 1) + "e") + "</b> sur " + l.length + (k > 0 ? " à " + fmtEcart(l[k][1] - l[0][1]) : "") + "</div>";
  }
  function blocClassements(long, extra) {
    const ligne = (rang, txt, val, moi) => '<div class="' + (moi ? "moi" : "") + '"><span>' + rang + ". " + txt + "</span><b>" + val + "</b></div>";
    const top = (arr, fmt, estMoi, txt, n) => {
      let h = arr.slice(0, n).map((x, k) => ligne(k + 1, txt(x, k), fmt(x, k), estMoi(x))).join("");
      const k = arr.findIndex(estMoi);
      if (k >= n) h += ligne(k + 1, txt(arr[k], k), fmt(arr[k], k), true);
      return h;
    }, n = long ? 5 : 3;
    const g = general(), p = grimpeurs().filter((x) => x[1] > 0), v = sprinteurs().filter((x) => x[1] > 0), eq = parEquipe();
    let h = '<div class="tr-gc"><div class="tt">Classement général</div>' + top(g, (x, k) => k === 0 ? formatDuree(x[1]) : fmtEcart(x[1] - g[0][1]), (x) => x[0] === "Toi", (x, k) => (k === 0 ? '<span class="mj jaune"></span>' : "") + x[0], n) + "</div>";
    if (p.length) h += '<div class="tr-gc"><div class="tt">Meilleur grimpeur</div>' + top(p, (x) => x[1] + " pts", (x) => x[0] === "Toi", (x, k) => (k === 0 ? '<span class="mj pois"></span>' : "") + x[0], n) + "</div>";
    if (v.length) h += '<div class="tr-gc"><div class="tt">Meilleur sprinteur</div>' + top(v, (x) => x[1] + " pts", (x) => x[0] === "Toi", (x, k) => (k === 0 ? '<span class="mj vert"></span>' : "") + x[0], n) + "</div>";
    if (eq.length) h += (extra || "") + '<div class="tr-gc"><div class="tt">Classement par équipe (3 meilleurs temps · CLM par équipe : temps de l’équipe compté 3 fois)</div>' + top(eq, (x, k) => k === 0 ? formatDuree(x[1]) : fmtEcart(x[1] - eq[0][1]), (x) => x[0] === 0, (x) => nomEq(x[0]), n) + "</div>";
    return h;
  }

  /* ---------- Fin de l'étape (« Terminer et enregistrer ») ---------- */
  function finEtape() {
    if (enCours === null || !tour) return null;
    const i = enCours, e = tour.etapes[i], et = etapeEnCours();
    enCours = null;
    if (!et || !Peloton.actif()) return null;
    const moi = Peloton.classement().find((x) => x.user);
    if (!moi || moi.fini === null) { suivi = null; return '<div class="rf-tour"><b>' + nomEtape(i) + " : étape non terminée.</b> Tu n’as pas franchi la ligne d’arrivée : tu pourras la recourir depuis la page d’accueil (mode Tour à étapes).</div>"; }
    // temps de chacun (estimé pour ceux qui ne sont pas encore arrivés), même temps pour un groupe arrivé ensemble (moins d'1 s entre deux coureurs)
    // (v87) CLM par équipe : tous les coureurs d'une équipe reçoivent le temps de l'équipe (celui de son 4e coureur à l'arrivée)
    const te = et.ttt ? Peloton.tempsEquipes() : null;
    const l = (te ? [["Toi", te[0]]].concat(Peloton.coureurs().map((r) => [r.nom, te[r.eq]])) : [["Toi", moi.fini]].concat(Peloton.coureurs().map((r) => [r.nom, Peloton.tempsEstime(r)]))).sort((a, b) => a[1] - b[1]);
    if (e.type !== "clm") for (let k = 1; k < l.length; k++) if (l[k][1] - l[k - 1][1] < 1) l[k][1] = l[k - 1][1];
    const pts = {}, ptsV = {};
    for (const s of suivi ? suivi.sommets : []) s.ordre.forEach((n, k) => { if (k < s.pts.length) { const o = s.type === "sprint" ? ptsV : pts; o[n] = (o[n] || 0) + s.pts[k]; } });
    if (e.type !== "clm") l.forEach(([n], k) => { if (k < PTS_ARRIVEE.length) ptsV[n] = (ptsV[n] || 0) + PTS_ARRIVEE[k]; });   // (v86) arrivée d'une étape en ligne : points au maillot vert
    suivi = null;
    tour.sprint = tour.sprint || {};
    // (v86) classement par équipe : somme des 3 meilleurs temps de chaque équipe sur l'étape
    let eqRes = null;
    if (tour.enEquipe) {
      eqRes = {}; const par = {};
      for (const [n, t] of l) { const q = tour.eqDe[n]; if (q !== undefined) (par[q] = par[q] || []).push(t); }
      for (const q in par) { eqRes[q] = par[q].sort((a, b) => a - b).slice(0, NB_EQUIPE).reduce((a, b) => a + b, 0); tour.gcEq[q] = (tour.gcEq[q] || 0) + eqRes[q]; }
    }
    const gcAvant = general(), rangAvant = gcAvant.findIndex((x) => x[0] === "Toi") + 1;
    l.forEach(([n, t], k) => { tour.gc[n] = (tour.gc[n] || 0) + t - (e.type !== "clm" && k < 3 ? BONIF[k] : 0); });
    for (const n in pts) tour.pois[n] = (tour.pois[n] || 0) + pts[n];
    for (const n in ptsV) tour.sprint[n] = (tour.sprint[n] || 0) + ptsV[n];
    tour.res[i] = { classement: l.map(([n, t]) => [n, Math.round(t * 10) / 10]), pts, ptsV, eq: eqRes, date: Date.now() };
    if (tour.res.filter(Boolean).length >= tour.etapes.length) tour.fini = true;
    ecrire();
    const rang = te ? 1 + Object.keys(te).filter((q) => te[q] < te[0] - 0.001).length : l.findIndex((x) => x[0] === "Toi") + 1, g = general(), rg = g.findIndex((x) => x[0] === "Toi") + 1, p = grimpeurs();
    log("Tour « " + tour.nom + " », " + nomEtape(i) + " : " + rang + "e de l’étape, " + rg + "e du général.");
    let h = '<div class="rf-tour"><h3>' + tour.nom + " · " + nomEtape(i) + "</h3>";
    h += "<div>" + (te ? "Étape par équipe : <b>" + (rang === 1 ? "victoire !" : rang + "e sur " + Object.keys(te).length) : "Étape : <b>" + (rang === 1 ? "victoire !" : rang + "e")) + "</b>" + (rang > 1 ? " à " + fmtEcart((te ? te[0] : moi.fini) - l[0][1]) + (te ? " de l’équipe gagnante" : " de " + l[0][0]) : "") + (e.type !== "clm" && rang <= 3 ? " (bonification de " + BONIF[rang - 1] + " s)" : "") +
      (pts.Toi ? " · " + pts.Toi + " pts au sommet des montées" : "") + "</div>";
    h += "<div>Classement général : <b>" + (rg === 1 ? "1er" : rg + "e") + "</b>" + (rg > 1 ? " à " + fmtEcart(tour.gc.Toi - g[0][1]) : (tour.fini ? " : tu gagnes le Tour !" : rangAvant === 1 && tour.res.filter(Boolean).length > 1 ? " : tu gardes le maillot jaune !" : " : tu prends le maillot jaune !")) + (rangAvant && rg < rangAvant && rg > 1 ? " (tu gagnes " + (rangAvant - rg) + " place" + (rangAvant - rg > 1 ? "s" : "") + ")" : "") + "</div>";
    h += blocClassements(true, rangEtapeEq(eqRes));
    h += tour.fini ? "<div><b>Tour terminé !</b> Vainqueur : " + (g[0][0] === "Toi" ? "toi, bravo !" : g[0][0]) + ".</div>" : "<div>Prochaine étape : " + nomEtape(prochaine()) + ".</div>";
    return h + "</div>";
  }

  /* ---------- Page d'accueil : création du Tour, étapes et classements ---------- */
  function rendre() {
    const c = $("tour-panneau");
    if (!c) return;
    c.hidden = $("peloton-mode").value !== "tour";
    if (c.hidden) return;
    if (!tour) {
      c.innerHTML = "<b>Crée ton Tour</b><p>3 à 5 étapes sur des mondes différents (plat, vallonné, montagne), dont toujours un contre-la-montre (individuel, ou par équipe si tu coches « En équipe » : file alignée, relais, temps du 4e coureur), avec les mêmes 40 coureurs (toi compris) du début à la fin. " +
        "4 classements : général au temps (bonifications de 10, 6 et 4 s aux trois premiers de chaque étape en ligne, maillot jaune), meilleur grimpeur (points au sommet des montées, maillot à pois), meilleur sprinteur (sprints et arrivées, maillot vert) et par équipe. Une étape quand tu veux, par exemple une par jour.</p>" +
        '<div class="barre"><label>Étapes&nbsp;: <select id="tour-nb"><option value="3">3 étapes</option><option value="4" selected>4 étapes</option><option value="5">5 étapes</option></select></label>' +
        '<label class="tour-eq"><input type="checkbox" id="tour-equipe"> En équipe (8 équipes de 5, tu as 4 coéquipiers)</label><button type="button" class="plein" id="tour-creer">Créer le Tour</button></div>' +
        '<div class="stats">Le niveau (facile 80 %, normal 100 %, hardcore 115 % de ta FTP) est gardé pour tout le Tour.</div>';
      $("tour-creer").onclick = () => { creer(parseInt($("tour-nb").value, 10), $("peloton-niveau").value, Peloton.MAX_IA, $("tour-equipe").checked); rendre(); majResumeChoix(); };
      return;
    }
    const ip = prochaine(), g = general(), p = grimpeurs(), rg = g.findIndex((x) => x[0] === "Toi") + 1;
    let h = "<b>" + tour.nom + "</b>" + (tour.fini ? " · terminé" : "") + '<div class="tr-etapes">';
    tour.etapes.forEach((e, i) => {
      const r = tour.res[i], place = r ? r.classement.findIndex((x) => x[0] === "Toi") + 1 : 0;
      h += '<div class="' + (r ? "faite" : i === ip ? "prochaine" : "") + '"><span>' + (r ? "✓ " : i === ip ? "▶ " : "") + nomEtape(i) + "</span><b>" + (r ? (place === 1 ? "1er" : place + "e") : i === ip ? "à courir" : "") + "</b></div>";
    });
    h += "</div>";
    if (tour.res.length) h += blocClassements(false);
    h += '<div class="barre">' + (tour.fini ? '<button type="button" class="plein" id="tour-nouveau">Nouveau Tour</button>' : "") + '<button type="button" class="petit" id="tour-abandon">' + (tour.fini ? "Effacer ce Tour" : "Abandonner ce Tour") + "</button></div>";
    c.innerHTML = h;
    const effacer = () => { tour = null; enCours = null; ecrire(); rendre(); majResumeChoix(); };
    $("tour-abandon").onclick = () => { if (tour.fini || confirm("Abandonner le Tour « " + tour.nom + " » ? Les classements seront perdus.")) effacer(); };
    if ($("tour-nouveau")) $("tour-nouveau").onclick = effacer;
    if (ip >= 0 && monde(tour.etapes[ip].monde) && mondeChoisiId !== tour.etapes[ip].monde) choisirMonde(tour.etapes[ip].monde);
  }
  // titre et détail du résumé de la page d'accueil
  function resume() {
    if (!tour) return "crée ton Tour ci-dessus";
    const i = prochaine();
    return i < 0 ? "Tour terminé" : nomEtape(i) + " · " + (tour.etapes[i].type === "clm" ? (tour.enEquipe ? "contre-la-montre par équipe" : "contre-la-montre individuel") : "départ groupé") + " · " + (tour.equipe.length + 1) + " coureurs" + (tour.enEquipe ? " en équipe" : "");
  }
  return { creer, preparer, etapeEnCours, equipe, enEquipe: () => !!(tour && tour.enEquipe), maillots, maj, finEtape, quitterEtape, rendre, resume, actif: () => !!tour };
})();
