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
    plat: [["mer", 30], ["nord", 31], ["criterium", 24], ["triS", 40]],
    vallonne: [["ardennes", 50], ["toscane", 40], ["desert", 40]],
    montagne: [["pyrenees", 0], ["alpes", 0]],
    clm: [["triXS", 10], ["triS", 20]]
  };
  const PLANS = { 3: ["plat", "vallonne", "montagne"], 4: ["plat", "clm", "vallonne", "montagne"], 5: ["plat", "vallonne", "clm", "plat", "montagne"] };
  const NOMS_TOUR = ["Tour des Quatre Vents", "Tour de la Vallée", "Grande Boucle virtuelle", "Tour des Cols et des Plaines", "Ronde des Saisons", "Tour du Home Trainer"];
  const BONIF = [10, 6, 4];
  const lireJ = () => { try { const j = JSON.parse(localStorage.getItem(CLE)); return j && Array.isArray(j.etapes) ? j : null; } catch (e) { return null; } };
  const ecrire = () => { try { if (tour) localStorage.setItem(CLE, JSON.stringify(tour)); else localStorage.removeItem(CLE); } catch (e) { /* stockage indisponible */ } };
  let tour = lireJ();
  let enCours = null, suivi = null;       // étape en train d'être courue (indice) ; sommets passés pendant l'étape

  const monde = (id) => (typeof MONDES !== "undefined" ? MONDES.find((m) => m.id === id) : null);
  const prochaine = () => tour && !tour.fini ? tour.etapes.findIndex((e, i) => !tour.res[i]) : -1;
  function creer(nb, niveau, nombre) {
    const plan = PLANS[nb] || PLANS[3], pris = new Set(), etapes = [];
    for (const type of plan) {
      const choix = BANQUE[type].filter(([id]) => monde(id) && !pris.has(id)), c = choix[Math.floor(Math.random() * choix.length)] || BANQUE[type][0];
      pris.add(c[0]);
      const m = monde(c[0]), L = m.route.longueur, tours = m.route.boucle ? Math.max(1, Math.round((c[1] || L) / L)) : 0;
      etapes.push({ monde: c[0], type, tours, km: Math.round((m.route.boucle ? tours * L : L) / 100) / 10 });
    }
    tour = { id: Date.now(), nom: NOMS_TOUR[Math.floor(Math.random() * NOMS_TOUR.length)], niveau, equipe: Peloton.tirerEquipe(nombre), etapes, res: [], gc: {}, pois: {}, fini: false };
    for (const n of noms()) { tour.gc[n] = 0; tour.pois[n] = 0; }
    ecrire();
    log("Nouveau Tour : « " + tour.nom + " », " + etapes.length + " étapes.");
  }
  const noms = () => ["Toi"].concat(tour.equipe.map((s) => s.nom));
  const fmtEcart = (s) => { s = Math.round(s); return s <= 0 ? "m.t." : "+" + (s >= 60 ? Math.floor(s / 60) + ":" + deuxChiffres(s % 60) : s + " s"); };
  const general = () => noms().map((n) => [n, tour.gc[n] || 0]).sort((a, b) => a[1] - b[1]);
  const grimpeurs = () => noms().map((n) => [n, tour.pois[n] || 0]).sort((a, b) => b[1] - a[1]);
  const nomEtape = (i) => { const e = tour.etapes[i], m = monde(e.monde); return "Étape " + (i + 1) + " · " + TYPES[e.type] + " · " + (m ? m.nom : e.monde) + " · " + fr1(e.km).replace(",0", "") + " km"; };

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
    return { mode: e.type === "clm" ? "clm" : "course", tours: e.tours, niveau: tour.niveau };
  }
  const equipe = () => tour ? tour.equipe : null;
  // maillots portés pendant l'étape (classements avant l'étape)
  function maillots() {
    if (enCours === null || !tour || !tour.res.length) return null;
    const p = grimpeurs();
    return { jaune: general()[0][0], pois: p[0][1] > 0 ? p[0][0] : null };
  }
  // sommets des montées de l'étape (points du maillot à pois), et ordre de passage de chacun
  function sommets() {
    const L = route.longueur, d0 = Peloton.depart(), fin = d0 + Peloton.longueurCourse(), l = [];
    let segs = [];
    try { segs = Progression.segmentsRoute().filter((s) => s.type === "montee"); } catch (e) { segs = []; }
    for (const s of segs) {
      const dh = altitudeA(s.e) - altitudeA(s.s);
      const pts = dh >= 600 ? [20, 15, 12, 10, 8, 6, 4, 2] : dh >= 300 ? [10, 8, 6, 4, 2, 1] : dh >= 120 ? [5, 3, 2, 1] : dh >= 40 ? [2, 1] : null;
      if (!pts) continue;
      for (let k = 0; route.boucle ? k * L + s.e <= fin + 1 : k < 1; k++) { const E = (route.boucle ? k * L : 0) + s.e; if (E > d0 && E <= fin + 1) l.push({ E, pts, nom: s.nom, ordre: [] }); }
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
        if (n === "Toi" && s.ordre.length <= s.pts.length) annoncer("Sommet : " + s.nom, (s.ordre.length === 1 ? "1er" : s.ordre.length + "e") + " au sommet · +" + s.pts[s.ordre.length - 1] + " pts au maillot à pois", "", 5);
      }
    }
  }
  function quitterEtape() { enCours = null; suivi = null; }

  /* ---------- Fin de l'étape (« Terminer et enregistrer ») ---------- */
  function finEtape() {
    if (enCours === null || !tour) return null;
    const i = enCours, e = tour.etapes[i], et = etapeEnCours();
    enCours = null;
    if (!et || !Peloton.actif()) return null;
    const moi = Peloton.classement().find((x) => x.user);
    if (!moi || moi.fini === null) { suivi = null; return '<div class="rf-tour"><b>' + nomEtape(i) + " : étape non terminée.</b> Tu n’as pas franchi la ligne d’arrivée : tu pourras la recourir depuis la page d’accueil (mode Tour à étapes).</div>"; }
    // temps de chacun (estimé pour ceux qui ne sont pas encore arrivés), même temps pour un groupe arrivé ensemble (moins d'1 s entre deux coureurs)
    const l = [["Toi", moi.fini]].concat(Peloton.coureurs().map((r) => [r.nom, Peloton.tempsEstime(r)])).sort((a, b) => a[1] - b[1]);
    if (e.type !== "clm") for (let k = 1; k < l.length; k++) if (l[k][1] - l[k - 1][1] < 1) l[k][1] = l[k - 1][1];
    const pts = {};
    for (const s of suivi ? suivi.sommets : []) s.ordre.forEach((n, k) => { if (k < s.pts.length) pts[n] = (pts[n] || 0) + s.pts[k]; });
    suivi = null;
    const gcAvant = general(), rangAvant = gcAvant.findIndex((x) => x[0] === "Toi") + 1;
    l.forEach(([n, t], k) => { tour.gc[n] = (tour.gc[n] || 0) + t - (e.type !== "clm" && k < 3 ? BONIF[k] : 0); });
    for (const n in pts) tour.pois[n] = (tour.pois[n] || 0) + pts[n];
    tour.res[i] = { classement: l.map(([n, t]) => [n, Math.round(t * 10) / 10]), pts, date: Date.now() };
    if (tour.res.filter(Boolean).length >= tour.etapes.length) tour.fini = true;
    ecrire();
    const rang = l.findIndex((x) => x[0] === "Toi") + 1, g = general(), rg = g.findIndex((x) => x[0] === "Toi") + 1, p = grimpeurs();
    log("Tour « " + tour.nom + " », " + nomEtape(i) + " : " + rang + "e de l’étape, " + rg + "e du général.");
    let h = '<div class="rf-tour"><h3>' + tour.nom + " · " + nomEtape(i) + "</h3>";
    h += "<div>Étape : <b>" + (rang === 1 ? "victoire !" : rang + "e") + "</b>" + (rang > 1 ? " à " + fmtEcart(moi.fini - l[0][1]) + " de " + l[0][0] : "") + (e.type !== "clm" && rang <= 3 ? " (bonification de " + BONIF[rang - 1] + " s)" : "") +
      (pts.Toi ? " · " + pts.Toi + " pts au sommet des montées" : "") + "</div>";
    h += "<div>Classement général : <b>" + (rg === 1 ? "1er" : rg + "e") + "</b>" + (rg > 1 ? " à " + fmtEcart(tour.gc.Toi - g[0][1]) : (tour.fini ? " : tu gagnes le Tour !" : rangAvant === 1 && tour.res.filter(Boolean).length > 1 ? " : tu gardes le maillot jaune !" : " : tu prends le maillot jaune !")) + (rangAvant && rg < rangAvant && rg > 1 ? " (tu gagnes " + (rangAvant - rg) + " place" + (rangAvant - rg > 1 ? "s" : "") + ")" : "") + "</div>";
    h += '<div class="tr-gc">' + g.slice(0, 5).map(([n, t], k) => '<div class="' + (n === "Toi" ? "moi" : "") + '"><span>' + (k + 1) + ". " + (k === 0 ? '<span class="mj jaune"></span>' : "") + n + "</span><b>" + (k === 0 ? formatDuree(t) : fmtEcart(t - g[0][1])) + "</b></div>").join("") +
      (rg > 5 ? '<div class="moi"><span>' + rg + ". Toi</span><b>" + fmtEcart(tour.gc.Toi - g[0][1]) + "</b></div>" : "") + "</div>";
    if (p[0][1] > 0) h += '<div><span class="mj pois"></span> Maillot à pois : <b>' + (p[0][0] === "Toi" ? "toi" : p[0][0]) + "</b> (" + p[0][1] + " pts)" + (p[0][0] !== "Toi" && tour.pois.Toi ? " · toi : " + tour.pois.Toi + " pts" : "") + "</div>";
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
      c.innerHTML = "<b>Crée ton Tour</b><p>3 à 5 étapes sur des mondes différents (plat, vallonné, contre-la-montre, montagne), avec les mêmes coureurs du début à la fin. " +
        "Classement général au temps (bonifications de 10, 6 et 4 s aux trois premiers de chaque étape en ligne), maillot jaune et maillot à pois (points au sommet des montées). Une étape quand tu veux, par exemple une par jour.</p>" +
        '<div class="barre"><label>Étapes&nbsp;: <select id="tour-nb"><option value="3">3 étapes</option><option value="4" selected>4 étapes</option><option value="5">5 étapes</option></select></label><button type="button" class="plein" id="tour-creer">Créer le Tour</button></div>' +
        '<div class="stats">Le niveau et le nombre d’autres coureurs (ci-dessous) sont gardés pour tout le Tour.</div>';
      $("tour-creer").onclick = () => { creer(parseInt($("tour-nb").value, 10), $("peloton-niveau").value, parseInt($("peloton-nombre").value, 10) || 8); rendre(); majResumeChoix(); };
      return;
    }
    const ip = prochaine(), g = general(), p = grimpeurs(), rg = g.findIndex((x) => x[0] === "Toi") + 1;
    let h = "<b>" + tour.nom + "</b>" + (tour.fini ? " · terminé" : "") + '<div class="tr-etapes">';
    tour.etapes.forEach((e, i) => {
      const r = tour.res[i], place = r ? r.classement.findIndex((x) => x[0] === "Toi") + 1 : 0;
      h += '<div class="' + (r ? "faite" : i === ip ? "prochaine" : "") + '"><span>' + (r ? "✓ " : i === ip ? "▶ " : "") + nomEtape(i) + "</span><b>" + (r ? (place === 1 ? "1er" : place + "e") : i === ip ? "à courir" : "") + "</b></div>";
    });
    h += "</div>";
    if (tour.res.length) {
      h += '<div class="tr-gc"><div class="tt">Classement général</div>' + g.slice(0, 3).map(([n, t], k) => '<div class="' + (n === "Toi" ? "moi" : "") + '"><span>' + (k + 1) + ". " + (k === 0 ? '<span class="mj jaune"></span>' : "") + n + "</span><b>" + (k === 0 ? formatDuree(t) : fmtEcart(t - g[0][1])) + "</b></div>").join("") +
        (rg > 3 ? '<div class="moi"><span>' + rg + ". Toi</span><b>" + fmtEcart(tour.gc.Toi - g[0][1]) + "</b></div>" : "") + "</div>";
      if (p[0][1] > 0) h += '<div class="stats"><span class="mj pois"></span> Maillot à pois : ' + (p[0][0] === "Toi" ? "toi" : p[0][0]) + " (" + p[0][1] + " pts)</div>";
    }
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
    return i < 0 ? "Tour terminé" : nomEtape(i) + " · " + (tour.etapes[i].type === "clm" ? "contre-la-montre individuel" : "départ groupé") + " · " + tour.equipe.length + " autres coureurs";
  }
  return { creer, preparer, etapeEnCours, equipe, maillots, maj, finEtape, quitterEtape, rendre, resume, actif: () => !!tour };
})();
