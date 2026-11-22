"use strict";
/* =====================================================================
   (v94) Formats de course : variantes du mode « Course » (choisies sur la page d'accueil, `#course-format`)
   - points : sprints intermédiaires (5, 3, 2, 1 points ; double à l'arrivée), le plus de points gagne
   - montagne : seuls les sommets des montées comptent (points selon la hauteur de la montée)
   - elimination : 12 coureurs, à chaque ligne le dernier à la franchir est éliminé ; il reste deux coureurs pour le sprint final
   - poursuite : toi contre un seul adversaire, parti plus loin devant ; rattrape-le ou fais un meilleur temps
   - chasse : 4 coureurs sont partis devant, il faut les rattraper avant l'arrivée
   - leader : un coureur de ton équipe est ton leader : abrite-le, puis lance-le dans les 2,5 derniers km
   Le moteur des coureurs virtuels (Peloton, js/parcours-physique.js) appelle `hook.cible` (puissance visée) et `hook.fin` (ligne d'arrivée).
   ===================================================================== */
const Formats = (function () {
  const NOMS = { classique: "Classique", points: "Course à points", montagne: "Course de la montagne", elimination: "Élimination", poursuite: "Poursuite", chasse: "Chasse à l’échappée", leader: "Protège ton leader" };
  const INFOS = {
    classique: "Course classique : départ groupé, arrivée après le nombre de tours choisi, attaques, échappées et sprint final.",
    points: "Course à points : des sprints intermédiaires donnent 5, 3, 2 et 1 points aux quatre premiers, le double à l’arrivée. Celui qui a le plus de points gagne, pas forcément le premier à l’arrivée. 40 coureurs.",
    montagne: "Course de la montagne : seuls les sommets des montées comptent (de 2 à 20 points selon la hauteur de la montée). Choisis un parcours qui monte. 40 coureurs.",
    elimination: "Élimination : 12 coureurs. À chaque ligne (tous les 2 km environ, sauf la première), le dernier à la franchir est éliminé. Reste devant ! Les deux derniers se disputent la victoire au sprint.",
    poursuite: "Poursuite individuelle : toi contre un seul adversaire, parti plus loin devant sur le circuit. Rattrape-le avant l’arrivée, ou fais un meilleur temps que lui. Sans aspiration, comme un contre-la-montre.",
    chasse: "Chasse à l’échappée : 4 coureurs sont partis devant (environ 1 minute d’avance) et roulent à leur seuil. Reviens sur eux avant l’arrivée. Le peloton de 35 coureurs ne se presse pas.",
    leader: "Protège ton leader : un coureur de ton équipe (4 coéquipiers) est ton leader. Roule juste devant lui pour l’abriter du vent : il garde de la réserve. À 2,5 km de l’arrivée, il se lance au sprint."
  };
  const PTS_SPRINT = [5, 3, 2, 1], PTS_FINAL = [10, 6, 4, 2];
  const PROB_SPRINT = { sprinteur: 0.9, puncheur: 0.65, baroudeur: 0.4, grimpeur: 0.25 }, PROB_MONTEE = { grimpeur: 0.9, puncheur: 0.7, baroudeur: 0.45, sprinteur: 0.1 };
  let fmt = "classique", E = null;

  const valeur = () => { const s = $("course-format"); return s && $("peloton-mode").value === "course" ? s.value : "classique"; };
  const dist = (m) => (Math.abs(m) >= 1000 ? fr1(Math.abs(m) / 1000) + " km" : Math.round(Math.abs(m)) + " m");
  const sec = (m, v) => Math.round(Math.abs(m) / Math.max(4, v || 0));
  const hex = (c) => "#" + ("000000" + (c & 0xffffff).toString(16)).slice(-6);
  const ligneHud = (rang, couleur, nom, val, moi) => '<div class="pl' + (moi ? " moi" : "") + '"><i style="background:' + hex(couleur) + '"></i><b>' + (rang ? rang + ". " : "") + nom + "</b><em>" + val + "</em></div>";

  // ---------- Préparation (avant Peloton.demarrer) ----------
  // distance totale d'une course « classique » sur ce parcours : le nombre de tours choisi (3 par défaut), ou le parcours en entier
  function totalDefaut() {
    const nt = parseInt($("peloton-tours").value, 10) || 0;
    return route.boucle ? (nt || 3) * route.longueur : route.longueur - balade.distance;
  }
  function pasLignes(total, ecartMin) {              // espacement des lignes : un nombre entier par tour sur une boucle, jamais plus de 20 lignes
    const L = route.longueur;
    let S = route.boucle ? L / Math.ceil(L / ecartMin) : ecartMin;
    S = Math.max(S, total / 20);
    const k = Math.max(1, Math.round(total / S));
    return { S: total / k, k };
  }
  function lignesMontees(d0, total) {
    let segs = [];
    try { segs = Progression.segmentsRoute().filter((s) => s.type === "montee"); } catch (e) { segs = []; }
    const L = route.longueur, fin = d0 + total, l = [];
    for (const s of segs) {
      const dh = altitudeA(s.e) - altitudeA(s.s);
      const pts = dh >= 600 ? [20, 15, 12, 10, 8, 6, 4, 2] : dh >= 300 ? [10, 8, 6, 4, 2, 1] : dh >= 120 ? [5, 3, 2, 1] : dh >= 40 ? [2, 1] : null;
      if (!pts) continue;
      for (let k = 0; route.boucle ? k * L + s.e <= fin + 1 : k < 1; k++) {
        const off = route.boucle ? k * L : 0, e = off + s.e;
        if (e > d0 && e <= fin + 1) l.push({ E: e, S: off + s.s, pts, nom: s.nom, type: "montee", ordre: [], fait: false });
      }
    }
    return l.sort((a, b) => a.E - b.E);
  }
  function preparer() {
    fmt = valeur(); E = null;
    if (fmt === "classique") return null;
    const d0 = balade.distance, L = route.longueur, boucle = !!route.boucle;
    E = { fmt, d0, L, boucle, prec: {}, pts: {}, lignes: [], elimines: [], ordreFin: [], res: null, annonce: {}, total: 0 };
    const o = { hook: { cible: cible, fin: finDe }, nombre: Peloton.MAX_IA };
    if (fmt === "points" || fmt === "montagne") {
      const total = totalDefaut(); E.total = total;
      if (fmt === "points") {
        const { S, k } = pasLignes(total, 2500);
        for (let i = 1; i <= k; i++) E.lignes.push({ E: d0 + i * S, pts: i === k ? PTS_FINAL : PTS_SPRINT, nom: i === k ? "Arrivée" : "Sprint " + i, type: "sprint", final: i === k, ordre: [], fait: false });
      } else {
        E.lignes = lignesMontees(d0, total);
        if (!E.lignes.length) { E.msg = "Aucune montée comptée sur ce parcours : course classique."; fmt = E.fmt = "classique"; E = null; return null; }
      }
      o.longueurFixe = total;
    } else if (fmt === "elimination") {
      const N0 = 12, S = boucle ? L / Math.ceil(L / 2000) : Math.min(2000, (L - d0) / N0), total = N0 * S;
      E.N0 = N0; E.S = S; E.total = total;
      for (let i = 1; i <= N0; i++) E.lignes.push({ E: d0 + i * S, pts: [], nom: i === N0 ? "Arrivée" : "Ligne " + i, type: "elim", final: i === N0, elim: i >= 2 && i < N0, ordre: [], fait: false });
      o.nombre = N0 - 1; o.longueurFixe = total;
    } else if (fmt === "poursuite") {
      const D = parseInt($("poursuite-km").value, 10) || 4000;
      E.D = D; E.total = D; E.gap = boucle && L <= 8000 ? L / 2 : Math.min(600, D / 4);
      E.finAdv = d0 + E.gap + D;
      o.nombre = 1; o.longueurFixe = D;
      o.equipe = Peloton.tirerEquipe(1, false); o.equipe[0].id = Peloton.TYPES[Math.floor(Math.random() * Peloton.TYPES.length)].id;   // adversaire de profil tiré au hasard
    } else if (fmt === "chasse") {
      E.total = totalDefaut(); o.longueurFixe = E.total;
      E.gap = Math.max(300, Math.min(L * 0.4, 650 + 250 * Math.random()));
    } else if (fmt === "leader") {
      E.total = totalDefaut(); o.longueurFixe = E.total;
      o.equipe = Peloton.tirerEquipe(Peloton.MAX_IA, true, parseInt($("avatar-maillot").value, 10) || undefined);
    }
    o.tours = boucle && Math.abs(E.total / L - Math.round(E.total / L)) < 0.01 ? Math.round(E.total / L) : 0;
    return o;
  }
  // après Peloton.demarrer : positions de départ particulières
  function apresDemarrage() {
    if (!E) return;
    const cr = Peloton.coureurs(), d0 = E.d0;
    if (fmt === "poursuite" && cr[0]) { E.adv = cr[0]; cr[0].d = d0 + E.gap; cr[0].voie = 0.9; cr[0].etat = "Poursuite"; }
    if (fmt === "chasse") {
      const idx = [2, 3, 0, 4].filter((i) => cr[i]);
      E.ech = idx.map((i) => cr[i]);
      E.ech.forEach((r, k) => { r.d = d0 + E.gap + k * 2.4; r.echappe = true; r.ech = true; r.voie = 0.7 + 0.3 * (k % 2); });
    }
    if (fmt === "leader") {
      E.leader = cr.find((r) => r.eq === 0 && r.equipier) || cr.find((r) => r.eq === 0);
      if (E.leader) E.leader.leader = true;
      E.abri = 0; E.tRoule = 0;
    }
    if (fmt === "elimination") { E.nActifs = cr.length + 1; }
  }

  // ---------- Comportement des coureurs virtuels ----------
  function finDe(r) { return fmt === "poursuite" && E && r === E.adv ? E.finAdv : E ? E.d0 + E.total : Infinity; }
  function cible(r, base, dt) {
    if (!E || r.fini !== null) return base;
    const cp = Peloton.cpEff(r), pl = Peloton.plafond(r), f = Math.max(0, r.wbal) / r.wp;
    switch (fmt) {
      case "points": {
        const l = E.lignes.find((x) => !x.final && x.E > r.d && x.E - r.d < 300);
        if (!l) return base;
        r.contest = r.contest || {};
        if (r.contest[l.nom] === undefined) r.contest[l.nom] = Math.random() < (PROB_SPRINT[r.id] || 0.3) * (f > 0.45 ? 1 : 0.3);
        if (r.contest[l.nom]) { r.etat = "Sprint intermédiaire"; return Math.max(base, pl * 0.93); }
        return base;
      }
      case "montagne": {
        const l = E.lignes.find((x) => x.E > r.d && x.S - r.d < 120 && r.d < x.E);
        if (!l) return base;
        r.contest = r.contest || {};
        const k = l.nom + "@" + Math.round(l.E);
        if (r.contest[k] === undefined) r.contest[k] = Math.random() < (PROB_MONTEE[r.id] || 0.3) * (f > 0.5 ? 1 : 0.3);
        if (r.contest[k] && f > 0.15) { r.etat = "Attaque au sommet"; return Math.min(Math.max(base, cp * 1.1), pl); }
        return base;
      }
      case "elimination": {
        const l = E.lignes.find((x) => !x.fait && x.E > r.d);
        if (!l || !l.elim || l.E - r.d > 450) return base;
        const actifs = Peloton.coureurs().filter((x) => !x.elim && !x.cache).map((x) => x.d).concat(E.userElim ? [] : [Peloton.user().d]);
        const derriere = actifs.filter((d) => d < r.d - 1).length;                   // combien sont derrière moi
        if (derriere <= 1 && f > 0.08) { r.etat = "Évite l’élimination"; return Math.max(base, pl * 0.92); }
        return base;
      }
      case "poursuite":
        r.etat = "Poursuite";
        return Math.min(Peloton.cibleClm(r, E.finAdv), pl);
      case "chasse": {
        if (!r.echappe) return base;
        if (f > 0.12) { r.etat = "Échappée"; return Math.max(base, Math.min(cp * 1.02, pl)); }
        return base;
      }
      case "leader": {
        if (!r.leader) return base;
        const u = Peloton.user(), rest = E.d0 + E.total - r.d, ec = u.d - r.d;     // ec > 0 : tu es devant lui
        if (rest < 2500) { r.etat = "Finale"; return base; }
        if (!u.vue) return base;
        if (ec > 45) { r.etat = "Revient sur toi"; return Math.max(base, Math.min(cp * 1.05, pl)); }
        if (ec < -8) { r.etat = "Attend son équipier"; return base * 0.55; }
        // dans ta roue, à ~6 m derrière toi
        const vv = Math.max(0, u.v + Math.max(-1.2, Math.min(1.5, (ec - 6) * 0.25)));
        r.etat = "Dans ta roue";
        return Math.min(Peloton.puissancePour(r, vv, r.ab || 0.75, true), pl);
      }
    }
    return base;
  }

  // ---------- Suivi de la course (appelé à chaque pas de la boucle principale) ----------
  function croise(l, n, r, t) {
    l.ordre.push(n);
    const k = l.ordre.length - 1;
    if (l.type === "elim") {
      const actifs = Peloton.coureurs().filter((x) => !x.elim && !x.cache).length + (E.userElim ? 0 : 1);
      if (l.elim && l.ordre.filter((x) => x === "Toi" || Peloton.coureurs().some((q) => q.nom === x && !q.elim)).length >= actifs && !l.fait) {
        l.fait = true;
        const rang = actifs;                                                        // il y avait `actifs` coureurs : le dernier est classé dernier
        if (n === "Toi") {
          E.userElim = { rang, ligne: l.nom };
          annoncer("Éliminé !", "Tu es le dernier à la " + l.nom.toLowerCase() + " : " + rang + "e sur " + (E.N0) + ". Continue à rouler si tu veux.", "", 8);
          log("Course à l’élimination : tu es éliminé à la " + l.nom.toLowerCase() + " (" + rang + "e).");
          bilan();
        } else {
          r.nElim = rang; E.elimines.push({ nom: n, rang, couleur: r.couleur }); Peloton.eliminer(r);
          annoncer("Éliminé : " + n, "dernier à la " + l.nom.toLowerCase() + " · il reste " + (actifs - 1) + " coureurs", "", 4);
        }
      }
      if (l.final) { E.ordreFin.push(n); }
      return;
    }
    if (k < l.pts.length) {
      E.pts[n] = (E.pts[n] || 0) + l.pts[k];
      if (n === "Toi") annoncer((l.type === "sprint" ? "Sprint · " : "Sommet · ") + l.nom, (k === 0 ? "1er" : (k + 1) + "e") + " · +" + l.pts[k] + " point" + (l.pts[k] > 1 ? "s" : "") + " (total " + E.pts.Toi + ")", "", 4);
    }
  }
  function maj() {
    if (!E || fmt === "classique" || !Peloton.actif() || !Peloton.parti()) return;
    const cr = Peloton.coureurs(), u = Peloton.user(), t = Peloton.temps();
    const comp = [];
    for (const r of cr) if (!r.cache && !r.elim) comp.push([r.nom, r.d, r]);
    if (!E.userElim) comp.push(["Toi", u.d, null]);
    for (const [n, d, r] of comp) {
      const p = E.prec[n]; E.prec[n] = d;
      if (p === undefined) continue;
      for (const l of E.lignes) if (p < l.E && d >= l.E && l.ordre.indexOf(n) < 0) croise(l, n, r, t);
    }
    // coureurs éliminés : disparaissent de la route 6 s plus tard
    for (const r of cr) if (r.elim && !r.cache && t - r.tElim > 6) Peloton.retirer(r);
    if (fmt === "elimination" && u.fin !== null && !E.res) bilan();
    if (fmt === "poursuite") majPoursuite(u, t);
    if (fmt === "chasse") majChasse(u);
    if (fmt === "leader") majLeader(u, cr, dt0());
    if ((fmt === "points" || fmt === "montagne") && u.fin !== null && !E.res) bilan();
    if ((fmt === "leader" || fmt === "chasse") && u.fin !== null && !E.res) bilan();
  }
  let tPrecL = null;
  function dt0() { const t = Peloton.temps(), d = tPrecL === null ? 0 : Math.max(0, Math.min(1, t - tPrecL)); tPrecL = t; return d; }
  function majPoursuite(u, t) {
    const a = E.adv;
    if (!a || E.res) return;
    if (!E.rattrape && u.d - E.d0 > 100 && u.d >= a.d - 2.5 && a.fini === null) {
      E.rattrape = { t, d: u.d - E.d0 };
      annoncer("Rattrapé !", "Tu reviens sur ton adversaire après " + dist(u.d - E.d0) + " : victoire !", "arrivee", 8);
      log("Poursuite : adversaire rattrapé après " + dist(u.d - E.d0) + ".");
      bilan();
      return;
    }
    if (E.boucle && E.L <= 8000 && a.d - u.d >= E.L - 3 && u.d - E.d0 > 100) {
      E.rattrape = { t, d: u.d - E.d0, moi: true };
      annoncer("Rattrapé…", "Ton adversaire te reprend après " + dist(u.d - E.d0) + " : défaite.", "", 8);
      bilan();
      return;
    }
    if (a.fini !== null && u.fin === null) bilan();           // il termine avant toi
    if (u.fin !== null) bilan();
  }
  function majChasse(u) {
    if (E.joint || !E.ech) return;
    const arriere = Math.min(...E.ech.map((r) => r.d));
    if (u.d >= arriere - 5 && u.d - E.d0 > 150) {
      E.joint = { d: u.d - E.d0, t: Peloton.temps() };
      annoncer("Jonction !", "Tu reviens sur l’échappée au km " + fr1((u.d - E.d0) / 1000), "arrivee", 7);
      log("Chasse à l’échappée : jonction au km " + fr1((u.d - E.d0) / 1000) + ".");
    }
  }
  function majLeader(u, cr, dtp) {
    const l = E.leader;
    if (!l) return;
    const rest = E.d0 + E.total - l.d, ec = u.d - l.d;
    if (rest > 2500 && u.v > 1) {
      E.tRoule += dtp;
      if (ec > 0 && ec < 14) E.abri += dtp;
    }
    if (rest <= 2500 && !E.annonce.finale) { E.annonce.finale = true; annoncer("Lance ton leader !", "Il part au sprint : écarte-toi, ou emmène-le jusqu’à la ligne", "", 6); }
  }

  // ---------- Résultat ----------
  // ordre complet d'une ligne : ceux qui l'ont franchie, puis les autres (par temps estimé pour l'arrivée, par position sinon)
  function ordreComplet(l) {
    const u = Peloton.user(), cr = Peloton.coureurs().filter((r) => !r.cache && !r.elim);
    const noms = cr.map((r) => r.nom).concat(E.userElim ? [] : ["Toi"]);
    const reste = noms.filter((n) => l.ordre.indexOf(n) < 0);
    const cle = (n) => {
      if (n === "Toi") return l.final ? (u.fin !== null ? u.fin : 1e9) : -u.d;
      const r = cr.find((x) => x.nom === n);
      return l.final ? Peloton.tempsEstime(r) : -r.d;
    };
    return l.ordre.concat(reste.sort((a, b) => cle(a) - cle(b)));
  }
  function pointsFinaux() {
    const p = Object.assign({}, E.pts);
    for (const l of E.lignes) {
      if (l.ordre.length >= l.pts.length && l.fait !== false && !l.final) continue;
      const ord = ordreComplet(l);
      for (let k = l.ordre.length; k < l.pts.length && k < ord.length; k++) p[ord[k]] = (p[ord[k]] || 0) + l.pts[k];
    }
    // à égalité de points : le mieux classé sur la dernière ligne (ou, sans arrivée, à la dernière ligne comptée)
    const der = E.lignes[E.lignes.length - 1], ord = der ? ordreComplet(der) : [], rg = (n) => { const i = ord.indexOf(n); return i < 0 ? 999 : i; };
    return Object.keys(p).map((n) => [n, p[n]]).sort((a, b) => b[1] - a[1] || rg(a[0]) - rg(b[0]));
  }
  function bilan() {
    if (E.res) return;
    const u = Peloton.user(), cr = Peloton.coureurs();
    let h = "", rang = null, n = cr.length + 1, fini = true;
    if (fmt === "points" || fmt === "montagne") {
      const cl = pointsFinaux(), i = cl.findIndex((x) => x[0] === "Toi");
      rang = i < 0 ? n : i + 1;
      const tit = fmt === "points" ? "Course à points" : "Course de la montagne";
      h = '<div class="rf-tour"><h3>' + tit + "</h3><div>Tu termines <b>" + (rang === 1 ? "1er : victoire !" : rang + "e") + "</b> avec <b>" + ((cl[i] || [0, 0])[1]) + " points</b> (vainqueur : " + (cl[0] ? cl[0][0] + ", " + cl[0][1] + " pts" : "–") + ").</div>" +
        cl.slice(0, 5).map((x, k) => '<div class="' + (x[0] === "Toi" ? "moi" : "") + '"><span>' + (k + 1) + ". " + x[0] + "</span><b>" + x[1] + " pts</b></div>").join("") + (i >= 5 ? '<div class="moi"><span>' + (i + 1) + ". Toi</span><b>" + cl[i][1] + " pts</b></div>" : "") + "</div>";
      annoncer(rang === 1 ? "Victoire aux points !" : "Arrivée", rang + "e · " + ((cl[i] || [0, 0])[1]) + " points", "arrivee", 8);
      E.rangFinal = [rang, n, true];
    } else if (fmt === "elimination") {
      const nonElim = Peloton.coureurs().filter((r) => !r.elim).map((r) => r.nom).concat(E.userElim ? [] : ["Toi"]);
      const fin = E.lignes[E.lignes.length - 1];
      const ord = fin ? ordreComplet(fin).filter((x) => nonElim.indexOf(x) >= 0) : nonElim;
      rang = E.userElim ? E.userElim.rang : ord.indexOf("Toi") + 1; fini = !E.userElim;
      n = E.N0;
      h = '<div class="rf-tour"><h3>Course à l’élimination</h3><div>' + (E.userElim ? "Tu es éliminé à la " + E.userElim.ligne.toLowerCase() + " : <b>" + rang + "e</b> sur " + n + "." : "Tu termines <b>" + (rang === 1 ? "1er : victoire !" : rang + "e") + "</b> sur " + n + ".") + "</div></div>";
      if (!E.userElim) annoncer(rang === 1 ? "Dernier survivant !" : "Arrivée", rang + "e sur " + n, "arrivee", 8);
      E.rangFinal = [rang, n, fini];
    } else if (fmt === "poursuite") {
      const a = E.adv, tU = u.fin, tA = a.fini !== null ? a.fini : Peloton.tempsEstime(a);
      let gagne;
      if (E.rattrape) gagne = !E.rattrape.moi;
      else gagne = tU !== null && tU < tA;
      h = '<div class="rf-tour"><h3>Poursuite · ' + dist(E.D) + "</h3><div>" + (gagne ? "<b>Victoire !</b> " : "<b>Défaite.</b> ") +
        (E.rattrape ? (E.rattrape.moi ? "Ton adversaire t’a rattrapé après " : "Tu l’as rattrapé après ") + dist(E.rattrape.d) + "." : (tU !== null ? "Ton temps " + formatDuree(Math.round(tU)) + " contre " + formatDuree(Math.round(tA)) + " pour " + a.nom + "." : "Tu n’as pas terminé la poursuite.")) + "</div></div>";
      annoncer(gagne ? "Victoire !" : "Défaite", E.rattrape ? (E.rattrape.moi ? "tu es rattrapé" : "adversaire rattrapé") : formatDuree(Math.round(tU || 0)) + " contre " + formatDuree(Math.round(tA)), gagne ? "arrivee" : "", 8);
      rang = gagne ? 1 : 2; n = 2; fini = tU !== null || !!E.rattrape;
      E.rangFinal = [rang, 2, fini];
    } else if (fmt === "chasse") {
      const cl = Peloton.classement(), i = cl.findIndex((x) => x.user);
      rang = i + 1; n = cl.length;
      const arriere = Math.min(...E.ech.map((r) => r.d)), ecart = arriere - u.d;
      const premier = E.ech.some((r) => r.fini !== null && (u.fin === null || r.fini < u.fin)), vic = E.joint && !premier;
      h = '<div class="rf-tour"><h3>Chasse à l’échappée</h3><div>' + (E.joint ? "Jonction au km <b>" + fr1(E.joint.d / 1000) + "</b>. " : "<b>Échappée non reprise</b> : tu termines à " + sec(ecart, u.v) + " s des fuyards. ") + "Tu finis <b>" + (rang === 1 ? "1er : victoire !" : rang + "e") + "</b> sur " + n + (vic ? " et tu as battu l’échappée" : "") + ".</div></div>";
      annoncer(rang === 1 ? "Victoire !" : "Arrivée", (E.joint ? "jonction au km " + fr1(E.joint.d / 1000) + " · " : "échappée non reprise · ") + rang + "e", "arrivee", 8);
      E.rangFinal = [rang, n, true];
    } else if (fmt === "leader") {
      const cl = Peloton.classement(), il = E.leader ? cl.findIndex((x) => x.nom === E.leader.nom) : -1, iu = cl.findIndex((x) => x.user);
      const part = E.tRoule > 30 ? Math.round(100 * E.abri / E.tRoule) : 0;
      h = '<div class="rf-tour"><h3>Protège ton leader</h3><div>Ton leader <b>' + (E.leader ? E.leader.nom : "") + "</b> termine <b>" + (il === 0 ? "1er : victoire d’équipe !" : (il + 1) + "e") + "</b> (toi : " + (iu + 1) + "e).</div><div>Abri donné avant la finale : <b>" + part + " %</b> du temps (à moins de 14 m devant lui). " + (part >= 60 ? "Excellent travail d’équipier." : part >= 35 ? "Bien, mais tu peux rester plus souvent devant lui." : "Reste plus près, juste devant sa roue.") + "</div></div>";
      annoncer(il === 0 ? "Victoire d’équipe !" : "Arrivée", "ton leader est " + (il + 1) + "e · abri " + part + " %", il === 0 ? "arrivee" : "", 8);
      rang = il + 1; n = cl.length;
      E.rangFinal = [iu + 1, n, true];
    }
    E.res = h;
  }

  // ---------- Affichage dans le HUD du classement ----------
  // renvoie { titre, html, remplace } ; remplace = vrai : le classement habituel est remplacé par ce bloc
  function hud(cl, moi) {
    if (!E || fmt === "classique") return null;
    const u = Peloton.user(), cr = Peloton.coureurs();
    const km = (E.total && moi.d - E.d0 > 0 ? fr1(Math.max(0, E.d0 + E.total - moi.d) / 1000) : fr1(E.total / 1000)) + " km";
    if (fmt === "points" || fmt === "montagne") {
      const p = Object.keys(E.pts).map((n) => [n, E.pts[n]]).sort((a, b) => b[1] - a[1]);
      const prochaine = E.lignes.find((l) => l.E > moi.d);
      let h = '<div class="tt">' + (fmt === "points" ? "Points" : "Points de montagne") + "</div>";
      if (!p.length) h += '<div class="pl"><b>Aucun point</b><em>–</em></div>';
      for (const [n, v] of p.slice(0, 3)) h += ligneHud("", (cr.find((r) => r.nom === n) || { couleur: 0xff7a2f }).couleur, n === "Toi" ? "Toi" : n, v + " pts", n === "Toi");
      const ip = p.findIndex((x) => x[0] === "Toi");
      if (ip >= 3) h += ligneHud(ip + 1 + ".", 0xff7a2f, "Toi", p[ip][1] + " pts", true);
      if (prochaine) h += '<div class="pl"><b>' + prochaine.nom + "</b><em>" + dist(prochaine.E - moi.d) + (prochaine.type === "montee" ? " · " + prochaine.pts[0] + " pts" : "") + "</em></div>";
      return { titre: (fmt === "points" ? "Course à points" : "Course de la montagne") + " · " + km + " restants", html: h };
    }
    if (fmt === "elimination") {
      const prochaine = E.lignes.find((l) => !l.fait && l.E > moi.d), actifs = cr.filter((r) => !r.elim && !r.cache);
      const tous = actifs.map((r) => ({ nom: r.nom, couleur: r.couleur, d: r.d })).concat(E.userElim ? [] : [{ nom: "Toi", couleur: 0xff7a2f, d: u.d, user: true }]).sort((a, b) => b.d - a.d);
      const iMoi = tous.findIndex((x) => x.user);
      const deb = Math.max(0, Math.min(iMoi - 1, tous.length - 3)), montres = tous.length <= 6 ? null : new Set([0, deb, deb + 1, deb + 2]);
      let h = "";
      tous.forEach((x, i) => {
        if (montres && !montres.has(i)) { if (montres.has(i - 1)) h += '<div class="pl sep">…</div>'; return; }
        const e = Math.round(x.d - u.d);
        h += ligneHud(i + 1, x.couleur, x.nom, x.user ? (i === tous.length - 1 ? "dernier !" : "") : (e >= 0 ? "+" : "−") + Math.abs(e) + " m", x.user);
      });
      if (E.userElim) h += '<div class="pl moi"><b>Tu es éliminé (' + E.userElim.rang + "e)</b><em></em></div>";
      if (prochaine && prochaine.elim) h += '<div class="pl"><b>Élimination dans</b><em>' + dist(prochaine.E - moi.d) + "</em></div>";
      else if (prochaine) h += '<div class="pl"><b>' + prochaine.nom + "</b><em>" + dist(prochaine.E - moi.d) + "</em></div>";
      const k = E.elimines.length;
      if (k) h += '<div class="pl"><b>Éliminés</b><em>' + k + "</em></div>";
      return { titre: "Élimination · " + tous.length + " en course", html: h, remplace: true };
    }
    if (fmt === "poursuite") {
      const a = E.adv;
      if (!a) return null;
      const ec = a.d - E.gap - u.d, restU = Math.max(0, E.d0 + E.D - u.d);
      let h = ligneHud("", a.couleur, a.nom, a.fini !== null ? "arrivé " + formatDuree(Math.round(a.fini)) : (ec >= 0 ? "+" : "−") + dist(ec) + " · " + sec(ec, u.v) + " s", false) +
        ligneHud("", 0xff7a2f, "Toi", u.fin !== null ? "arrivé " + formatDuree(Math.round(u.fin)) : "reste " + dist(restU), true);
      if (E.rattrape) h += '<div class="pl"><b>' + (E.rattrape.moi ? "Tu es rattrapé" : "Adversaire rattrapé !") + "</b><em></em></div>";
      return { titre: "Poursuite · " + dist(E.D), html: h, remplace: true };
    }
    if (fmt === "chasse") {
      if (!E.ech) return null;
      const arriere = Math.min(...E.ech.map((r) => r.d)), ec = arriere - u.d, h = E.joint ? '<div class="pl moi"><b>Jonction au km ' + fr1(E.joint.d / 1000) + "</b><em></em></div>" :
        '<div class="pl"><b>Échappée (' + E.ech.length + ")</b><em>+" + dist(Math.max(0, ec)) + " · " + sec(ec, u.v) + " s</em></div>";
      return { titre: "Chasse à l’échappée · " + km + " restants", html: '<div class="tt">Échappée</div>' + h };
    }
    if (fmt === "leader") {
      const l = E.leader;
      if (!l) return null;
      const ec = u.d - l.d, f = Math.round(100 * Math.max(0, l.wbal) / l.wp), rest = E.d0 + E.total - l.d;
      let conseil = rest < 2500 ? "Lance-le !" : ec > 14 ? "Ralentis : il est trop loin" : ec < 0 ? "Il est devant toi : passe devant" : "Bien : continue devant lui";
      const h = '<div class="tt">Ton leader</div>' + ligneHud("★", l.couleur, l.nom, ec >= 0 ? dist(ec) + " derrière" : dist(ec) + " devant", false) +
        '<div class="pl"><b>Sa réserve</b><em>' + f + " %</em></div>" + '<div class="pl"><b>' + conseil + "</b><em></em></div>";
      return { titre: "Protège ton leader · " + km + " restants", html: h };
    }
    return null;
  }

  // ---------- Page d'accueil ----------
  const sansTours = () => { const s = $("course-format"); return !!s && $("peloton-mode").value === "course" && ["elimination", "poursuite"].includes(s.value); };
  function majInfo() {
    const s = $("course-format"), v = $("peloton-mode").value;
    if (!s) return;
    $("choix-format").hidden = v !== "course";
    $("info-format").textContent = INFOS[s.value] || "";
    $("choix-poursuite").hidden = v !== "course" || s.value !== "poursuite";
    const n = v === "course" ? ({ elimination: "12 coureurs au départ (toi compris).", poursuite: "Toi contre un seul adversaire.", leader: "40 coureurs, dont 4 coéquipiers et ton leader." }[s.value] || "40 coureurs au départ (toi compris).") : "";
    if (v === "course") $("note-40").textContent = "Course : " + n;
    else $("note-40").textContent = "Contre-la-montre et Tour : toujours 40 coureurs au départ (toi compris).";
  }
  if ($("course-format")) {
    $("course-format").addEventListener("change", () => { sauverReglages(); majInfo(); if (typeof majModes === "function") majModes(); });
    $("poursuite-km").addEventListener("change", () => { sauverReglages(); if (typeof majResumeChoix === "function") majResumeChoix(); });
  }
  const nombre = () => { const s = $("course-format"); return s ? ({ elimination: 12, poursuite: 2 }[s.value] || 0) : 0; };
  const rang = () => E && E.rangFinal ? E.rangFinal : null;
  return { preparer, apresDemarrage, maj, hud, majInfo, sansTours, nombre, actif: () => !!E && fmt !== "classique" && Peloton.actif(), format: () => (E ? fmt : "classique"), nom: () => NOMS[valeur()] || "", titre: () => (E ? NOMS[fmt] : ""),
           resume: () => { if (!E) return null; if (!E.res) { try { bilan(); } catch (e) { return null; } } return E.res; }, rang, oublier: () => { E = null; fmt = "classique"; tPrecL = null; } };
})();
