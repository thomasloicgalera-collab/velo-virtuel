"use strict";
/* =====================================================================
   Progression (v69) : segments chronométrés, expérience et niveaux, défis de la semaine, badges.
   - Segments : trouvés tout seuls sur chaque parcours (montées d'après le profil ou `route.cotes`,
     secteurs de chemin blanc `route.secteurs`, sprints sur les parties plates, dont celui de la ligne),
     chronométrés pour toi et pour les coureurs virtuels, records gardés dans le navigateur.
   - Expérience (XP) : gagnée en roulant (distance, dénivelé, segments, courses) ; elle n'est
     ajoutée qu'avec « Terminer et enregistrer » (une sortie abandonnée ne compte pas).
   - Défis : trois par semaine (du lundi au dimanche), tirés d'après le numéro de la semaine.
   ===================================================================== */
const Progression = (function () {
  const CLE_PROG = "velo_progression_v1", CLE_SEGS = "velo_segments_v1";
  const TYPES_SEG = {
    sprint: { ico: "⚡", lib: "Sprint", coul: "#35d07f" },
    montee: { ico: "⛰", lib: "Montée", coul: "#ff5a5f" },
    secteur: { ico: "⚪", lib: "Secteur", coul: "#e8dcc0" }
  };
  const XP_KM = 20, XP_M = 0.2, XP_SEG = 15, XP_SEG_PREMIER = 10, XP_SEG_RECORD = 40, XP_COURSE = 50, XP_PODIUM = 50, XP_VICTOIRE = 100, XP_BADGE = 100;
  const TITRES = [[1, "Cyclotouriste"], [5, "Amateur"], [10, "Coureur régional"], [20, "Coureur national"], [30, "Pro continental"], [40, "World Tour"], [50, "Légende"]];

  const lireJ = (cle) => { try { return JSON.parse(localStorage.getItem(cle)); } catch (e) { return null; } };
  const ecrireJ = (cle, v) => { try { localStorage.setItem(cle, JSON.stringify(v)); } catch (e) { /* stockage indisponible : gardé pendant la séance */ } };
  const nouveau = () => ({ xp: 0, km: 0, dplus: 0, temps: 0, sorties: 0, segs: 0, records: 0, courses: 0, podiums: 0, victoires: 0, kmPluie: 0, kmNuit: 0,
                           semainesParfaites: 0, mondes: {}, badges: {}, sem: null });
  let prog = Object.assign(nouveau(), lireJ(CLE_PROG) || {});
  let records = lireJ(CLE_SEGS) || {};
  // sortie en cours (pas encore ajoutée à la progression)
  const vide = () => ({ xp: 0, km: 0, dplus: 0, temps: 0, segs: 0, records: 0, kmPluie: 0, kmNuit: 0, journal: [] });
  let sortie = vide();

  /* ---------- Niveaux ---------- */
  function niveau(xp) {
    let n = 1, base = 0, besoin = 400;
    while (n < 50 && xp >= base + besoin) { base += besoin; n++; besoin = 400 + 200 * (n - 1); }
    const dans = xp - base;
    return { n, dans, besoin, frac: n >= 50 ? 1 : Math.min(1, dans / besoin), titre: TITRES.filter((t) => n >= t[0]).pop()[1] };
  }

  /* ---------- Défis de la semaine ---------- */
  function semaineId(ms) {                    // semaine ISO (lundi au dimanche), heure locale
    const d = new Date(ms || Date.now()); d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const j1 = new Date(d.getFullYear(), 0, 4);
    const n = 1 + Math.round(((d - j1) / 86400000 - 3 + (j1.getDay() + 6) % 7) / 7);
    return d.getFullYear() + "-S" + String(n).padStart(2, "0");
  }
  const heures = (s) => { const h = s / 3600; return (h % 1 ? fr1(h) : String(h)) + " h"; };
  const DEFIS = [
    { c: "km", n: [40, 60, 80, 120], txt: (n) => "Rouler " + n + " km", xp: (n) => n * 3, fmt: (v) => fr1(v) + " km" },
    { c: "temps", n: [5400, 7200, 10800], txt: (n) => "Rouler " + heures(n), xp: (n) => Math.round(n / 30), fmt: (v) => formatDuree(v) },
    { c: "dplus", n: [500, 800, 1200], txt: (n) => "Gravir " + n + " m de dénivelé", xp: (n) => Math.round(n / 4), fmt: (v) => Math.round(v) + " m" },
    { c: "segs", n: [5, 10, 15], txt: (n) => "Terminer " + n + " segments chronométrés", xp: (n) => n * 20 },
    { c: "records", n: [1, 2, 3], txt: (n) => n === 1 ? "Battre un de tes records de segment" : "Battre " + n + " de tes records de segment", xp: (n) => 120 * n },
    { c: "podiums", n: [1, 2], txt: (n) => n === 1 ? "Finir une course sur le podium" : "Finir " + n + " courses sur le podium", xp: (n) => 150 * n },
    { c: "sorties", n: [3, 4, 5], txt: (n) => "Faire " + n + " sorties", xp: (n) => 60 * n },
    { c: "kmPluie", n: [10, 20], txt: (n) => "Rouler " + n + " km sous la pluie", xp: (n) => 12 * n, fmt: (v) => fr1(v) + " km" }
  ];
  function defisDe(id) {
    let g = 0; for (const ch of id) g = (g * 31 + ch.charCodeAt(0)) >>> 0;
    const alea = () => { g = (g + 0x6D2B79F5) >>> 0; let t = Math.imul(g ^ (g >>> 15), 1 | g); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const choisis = [DEFIS[Math.floor(alea() * 3)]];                       // toujours un défi de distance, de durée ou de dénivelé
    const reste = DEFIS.slice(3);
    while (choisis.length < 3) { const d = reste.splice(Math.floor(alea() * reste.length), 1)[0]; choisis.push(d); }
    return choisis.map((d) => { const n = d.n[Math.floor(alea() * d.n.length)]; return { id: d.c + n, c: d.c, n, txt: d.txt(n), xp: d.xp(n), fmt: d.fmt || ((v) => String(Math.floor(v))) }; });
  }
  function semaine() {
    const id = semaineId();
    if (!prog.sem || prog.sem.id !== id) prog.sem = { id, cpt: {}, faits: [] };
    return prog.sem;
  }
  // avancement des défis (sortie en cours comprise si « avecSortie »)
  function etatDefis(avecSortie) {
    const s = semaine();
    return defisDe(s.id).map((d) => {
      let v = s.cpt[d.c] || 0;
      if (avecSortie && d.c !== "podiums") v += d.c === "sorties" ? (sortie.km > 0.2 ? 1 : 0) : (sortie[d.c] || 0);
      return Object.assign(d, { v, fait: s.faits.indexOf(d.id) >= 0 || v >= d.n });
    });
  }

  /* ---------- (v69 suite) Défis au long cours : on en relève jusqu'à 3 à la fois, chacun a son délai ---------- */
  const LONGS = [
    { id: "everest30", ico: "🏔️", nom: "Everest du mois", desc: "Gravir 8 848 m de dénivelé en 30 jours", c: "dplus", n: 8848, jours: 30, xp: 1500, fmt: (v) => Math.round(v) + " m" },
    { id: "km500", ico: "📏", nom: "500 km en un mois", desc: "Rouler 500 km en 30 jours", c: "km", n: 500, jours: 30, xp: 900, fmt: (v) => fr1(v) + " km" },
    { id: "km1000", ico: "🛣️", nom: "1 000 km cet hiver", desc: "Rouler 1 000 km en 90 jours", c: "km", n: 1000, jours: 90, xp: 1500, fmt: (v) => fr1(v) + " km" },
    { id: "h50", ico: "⏱️", nom: "50 heures en selle", desc: "Rouler 50 heures en 6 semaines", c: "temps", n: 180000, jours: 42, xp: 1200, fmt: (v) => formatDuree(v) },
    { id: "sorties20", ico: "📅", nom: "Régularité", desc: "Faire 20 sorties en 30 jours", c: "sorties", n: 20, jours: 30, xp: 800, fmt: (v) => String(Math.floor(v)) },
    { id: "tdf", ico: "🟡", nom: "Tour de France virtuel", desc: "Rouler 3 400 km (la distance du Tour) en 6 mois", c: "km", n: 3400, jours: 182, xp: 4000, fmt: (v) => fr1(v) + " km" },
    { id: "alpe", ico: "⛰️", nom: "Trois fois l’Everest", desc: "Gravir 26 544 m de dénivelé en 3 mois", c: "dplus", n: 26544, jours: 91, xp: 3000, fmt: (v) => Math.round(v) + " m" }
  ];
  const JOUR = 86400000;
  function etatLongs() {                       // défis relevés (avec ceux dont le délai est dépassé, retirés ici)
    if (!prog.longs) prog.longs = {};
    if (!prog.longsFaits) prog.longsFaits = {};
    const l = [];
    for (const id in prog.longs) {
      const d = LONGS.find((x) => x.id === id), e = prog.longs[id];
      if (!d) { delete prog.longs[id]; continue; }
      const reste = e.debut + d.jours * JOUR - Date.now();
      if (reste < 0) { delete prog.longs[id]; log("Défi « " + d.nom + " » : délai dépassé (" + d.fmt(e.v) + " sur " + d.fmt(d.n) + ")."); ecrireJ(CLE_PROG, prog); continue; }
      l.push(Object.assign({}, d, { v: e.v, debut: e.debut, jr: Math.ceil(reste / JOUR) }));
    }
    return l;
  }
  function relever(id) {
    etatLongs();
    if (Object.keys(prog.longs).length >= 3 || prog.longs[id]) return;
    prog.longs[id] = { debut: Date.now(), v: 0 };
    ecrireJ(CLE_PROG, prog); majAccueil();
  }
  function abandonnerLong(id) { if (prog.longs) delete prog.longs[id]; ecrireJ(CLE_PROG, prog); majAccueil(); }

  /* ---------- Badges ---------- */
  const BADGES = [
    { id: "premiere", ico: "🚲", nom: "Premiers coups de pédale", desc: "Terminer une première sortie", ok: (p) => p.sorties >= 1 },
    { id: "km100", ico: "💯", nom: "Centurion", desc: "Rouler 100 km au total", ok: (p) => p.km >= 100 },
    { id: "km1000", ico: "🛣️", nom: "Mille bornes", desc: "Rouler 1 000 km au total", ok: (p) => p.km >= 1000 },
    { id: "km5000", ico: "🌍", nom: "Grand voyageur", desc: "Rouler 5 000 km au total", ok: (p) => p.km >= 5000 },
    { id: "everest", ico: "🏔️", nom: "Everest", desc: "Cumuler 8 848 m de dénivelé", ok: (p) => p.dplus >= 8848 },
    { id: "podium", ico: "🥉", nom: "Sur la boîte", desc: "Finir une course sur le podium", ok: (p) => p.podiums >= 1 },
    { id: "victoire", ico: "🏆", nom: "Vainqueur", desc: "Gagner une course", ok: (p) => p.victoires >= 1 },
    { id: "record", ico: "⏱️", nom: "Chasseur de records", desc: "Battre un de tes records de segment", ok: (p) => p.records >= 1 },
    { id: "segs50", ico: "🎯", nom: "Collectionneur", desc: "Terminer 50 segments chronométrés", ok: (p) => p.segs >= 50 },
    { id: "pluie", ico: "🌧️", nom: "Même pas mouillé", desc: "Rouler 25 km sous la pluie", ok: (p) => p.kmPluie >= 25 },
    { id: "nuit", ico: "🌃", nom: "Noctambule", desc: "Rouler 20 km en ville de nuit", ok: (p) => p.kmNuit >= 20 },
    { id: "explorateur", ico: "🧭", nom: "Explorateur", desc: "Rouler sur 5 mondes différents", ok: (p) => Object.keys(p.mondes).length >= 5 },
    { id: "semaine", ico: "⭐", nom: "Semaine parfaite", desc: "Réussir les 3 défis d’une semaine", ok: (p) => p.semainesParfaites >= 1 },
    { id: "niveau10", ico: "🎖️", nom: "Confirmé", desc: "Atteindre le niveau 10", ok: (p) => niveau(p.xp).n >= 10 }
  ];

  /* =====================================================================
     Segments chronométrés
     ===================================================================== */
  const seg = { route: null, liste: [], dPrec: 0, tPrec: 0, enCours: [], occ: {}, ia: [], iaDeb: {}, fin: null, m3d: null, sig: "" };
  const fmtSeg = (t) => { const m = Math.floor(t / 60), s = t - m * 60; return m + ":" + (s < 10 ? "0" : "") + s.toFixed(1).replace(".", ","); };
  const fmtEcart = (e) => (e < 0 ? "−" : "+") + fr1(Math.abs(e)) + " s";

  function detecter() {
    const L = route.longueur, boucle = !!route.boucle, segs = [];
    if (!(L > 800)) return segs;
    const lieu = (d) => { for (const v of route.villes || []) if (d >= v[0] && d <= v[1]) return v[2]; return ""; };
    const de = (n) => (/^[aeiouyéèêâîôûh]/i.test(n) ? "d’" : "de ") + n;
    const bord = boucle ? 40 : 0;
    // montées : celles de la route (Ardennes) ou trouvées sur le profil (au moins 25 m de dénivelé à 3 % de moyenne)
    if (route.cotes && route.cotes.length) for (const c of route.cotes) segs.push({ type: "montee", s: c[0], e: c[1], nom: c[2] });
    else {
      const P = 25, n = Math.floor(L / P), A = [];
      for (let i = 0; i <= n; i++) A.push(altitudeA(i * P));
      let i = 0, k = 0;
      while (i < n) {
        if (!(A[i + 1] > A[i])) { i++; continue; }
        let h = i, j = i;
        while (j < n) { j++; if (A[j] > A[h]) h = j; if (A[j] < A[h] - 10 || j - h > 24) break; }
        let a = i, b = h;
        while (b - a > 8 && A[a + 8] - A[a] < 4) a++;          // on retire les replats du début et de la fin
        while (b - a > 8 && A[b] - A[b - 8] < 4) b--;
        const g = A[b] - A[a], l = (b - a) * P;
        if (g >= 25 && l >= 400 && g / l >= 0.03 && a * P >= bord && b * P <= L - bord) {
          const nl = lieu(b * P) || lieu(a * P);
          k++;
          segs.push({ type: "montee", s: a * P, e: b * P, g, nom: (g >= 400 ? "Ascension" : "Montée") + (nl ? " " + de(nl) : " n°" + k) });
        }
        i = Math.max(i + 1, h);
      }
      // nom donné par le monde à sa plus grande montée (ex. « Mont Ventoux depuis Bédoin »)
      if (route.grandeMontee && segs.length) segs.reduce((x, y) => (y.g > x.g ? y : x)).nom = route.grandeMontee;
    }
    // secteurs de chemin blanc (Toscane) : ils remplacent les montées trouvées au même endroit (une seule banderole)
    if (route.secteurs) for (const c of route.secteurs) for (let i = segs.length - 1; i >= 0; i--) if (segs[i].s < c[1] + 100 && segs[i].e > c[0] - 100) segs.splice(i, 1);
    if (route.secteurs) for (const c of route.secteurs) segs.push({ type: "secteur", s: c[0], e: c[1], nom: "Secteur " + de(c[2]) });
    // sprints de 400 m sur le plat : celui de la ligne d'arrivée, puis un tous les ~15 km (3 au plus)
    const LS = 400;
    const plat = (a, b) => { if (a < bord || b > L - bord) return 99; let m = 0; for (let d = a; d < b; d += 25) m = Math.max(m, Math.abs(penteA(d))); return m; };
    const libre = (a, b) => !segs.some((s) => a < s.e + 150 && b > s.s - 150);
    const nS = Math.max(1, Math.min(3, Math.round(L / 15000)));
    const eL = L - bord;
    let nb = 0;
    if (plat(eL - LS, eL) < 3 && libre(eL - LS, eL)) { segs.push({ type: "sprint", s: eL - LS, e: eL, nom: boucle ? "Sprint de la ligne" : "Sprint final" }); nb++; }
    const autres = L > 2500 ? nS - nb : 0;
    for (let q = 1; q <= autres; q++) {
      const c = L * q / (autres + 1) - LS / 2;
      let meilleur = null, mp = 3;
      for (let off = 0; off <= Math.min(4000, L / 3) && !(meilleur !== null && off > 600); off += 50) for (const sg of [1, -1]) {
        const a = c + sg * off, p = plat(a, a + LS);
        if (p < mp && libre(a, a + LS)) { mp = p; meilleur = a; }
      }
      if (meilleur === null) continue;
      const nl = lieu(meilleur + LS);
      segs.push({ type: "sprint", s: meilleur, e: meilleur + LS, nom: "Sprint" + (nl ? " " + de(nl) : " n°" + q) });
    }
    segs.sort((a, b) => a.s - b.s);
    const num = {};                                              // numéros dans l'ordre du parcours (sans trou)
    for (const s of segs) if (/ n°\d+$/.test(s.nom)) { num[s.type] = (num[s.type] || 0) + 1; s.nom = s.nom.replace(/\d+$/, num[s.type]); }
    for (const s of segs) s.cle =route.nom + "|" + s.type + "|" + Math.round(s.s) + "|" + Math.round(s.e);
    return segs;
  }
  function segmentsRoute() {
    if (route._segs && route._segsL === route.longueur) return route._segs;
    let l = [];
    try { l = detecter(); } catch (e) { l = []; }
    route._segs = l; route._segsL = route.longueur;
    return l;
  }
  // franchissements de x = k·L + pos entre a (exclu) et b (inclus)
  function passages(pos, a, b, cb) {
    const L = route.longueur;
    if (!(b > a)) return;
    if (!route.boucle) { if (a < pos && pos <= b) cb(pos); return; }
    for (let k = Math.floor(a / L); k <= Math.floor(b / L); k++) { const x = k * L + pos; if (a < x && x <= b) cb(x); }
  }
  const instant = (x, a, b, ta, tb) => ta + (x - a) / Math.max(1e-6, b - a) * (tb - ta);

  // (v69 suite) trace du record : temps de passage tous les PAS_SEG mètres, pour le fantôme et l'écart exact
  const PAS_SEG = 20;
  function tempsTrace(m, x, tot, lg) {              // temps du record à x mètres du début du segment de longueur lg (null sans trace)
    if (!m || m.length < 2) return null;
    const i = Math.floor(x / PAS_SEG);
    if (i >= m.length - 1) {                          // après la dernière marque : on va jusqu'au temps final sur les derniers mètres
      const x0 = (m.length - 1) * PAS_SEG;
      return m[m.length - 1] + (tot - m[m.length - 1]) * Math.min(1, Math.max(0, (x - x0) / Math.max(1, lg - x0)));
    }
    return m[i] + (m[i + 1] - m[i]) * (x / PAS_SEG - i);
  }
  function terminerSegment(sg, abs, t, c) {
    const rec = records[sg.cle], premier = !rec, bat = !!rec && t < rec.t - 0.05;
    if (premier || bat) {
      records[sg.cle] = { t: Math.round(t * 10) / 10, date: Date.now(), monde: route.nom, nom: sg.nom, type: sg.type };
      if (c && c.m && c.m.length >= Math.floor((sg.e - sg.s) / PAS_SEG)) records[sg.cle].m = c.m.map((x) => Math.round(x * 10) / 10);
      ecrireJ(CLE_SEGS, records);
    }
    sortie.segs++; sortie.xp += XP_SEG + (premier ? XP_SEG_PREMIER : 0) + (bat ? XP_SEG_RECORD : 0);
    if (bat) sortie.records++;
    sortie.journal.push({ nom: sg.nom, type: sg.type, t, record: bat, premier, ancien: rec ? rec.t : null });
    const o = occurrence(sg, abs);
    o.liste.push({ nom: "Toi", t, couleur: 0xff7a2f, user: true });
    seg.fin = { sg, abs, t, rec: rec ? rec.t : null, bat, premier, jusqua: balade.temps + 15 };
    if (bat) annoncer("Nouveau record !", sg.nom + " · " + fmtSeg(t) + " (" + fmtEcart(t - rec.t) + ")", "arrivee", 5);
    log(TYPES_SEG[sg.type].lib + " « " + sg.nom + " » : " + fmtSeg(t) + (bat ? " (nouveau record)" : premier ? " (premier passage)" : ""));
  }
  function occurrence(sg, abs) {
    const k = sg.cle + "@" + Math.round(abs);
    return seg.occ[k] || (seg.occ[k] = { liste: [] });
  }

  function majSegments() {
    const d = balade.distance, t = balade.temps;
    if (seg.route !== route || d < seg.dPrec - 50 || t < seg.tPrec - 0.5) {
      seg.route = route; seg.liste = segmentsRoute(); seg.enCours = []; seg.occ = {}; seg.ia = []; seg.iaDeb = {}; seg.fin = null; seg.dPrec = d; seg.tPrec = t;
      seg.m3d = null;
    }
    if (monde3d && seg.m3d !== monde3d && monde3d.definirSegments) { seg.m3d = monde3d; monde3d.definirSegments(seg.liste); }
    const a = seg.dPrec, ta = seg.tPrec;
    if (d > a && d - a < 300) {
      for (const sg of seg.liste) {
        passages(sg.s, a, d, (x) => { seg.enCours.push({ sg, abs: x, t0: instant(x, a, d, ta, t), fin: x + sg.e - sg.s, m: [0] }); });
      }
      for (const c of seg.enCours) {                       // temps de passage tous les PAS_SEG mètres
        while (c.abs + c.m.length * PAS_SEG <= Math.min(d, c.fin)) { const x = c.abs + c.m.length * PAS_SEG; c.m.push(Math.max(0, instant(x, a, d, ta, t) - c.t0)); }
      }
      for (let i = seg.enCours.length - 1; i >= 0; i--) {
        const c = seg.enCours[i];
        if (a < c.fin && c.fin <= d) { seg.enCours.splice(i, 1); terminerSegment(c.sg, c.abs, instant(c.fin, a, d, ta, t) - c.t0, c); }
      }
    }
    // coureurs virtuels : mêmes segments, chronométrés sur la même horloge
    if (Peloton.actif()) {
      const cs = Peloton.coureurs();
      cs.forEach((r, i) => {
        const p = seg.ia[i];
        if (p !== undefined && r.d > p && r.d - p < 300) {
          for (const sg of seg.liste) {
            passages(sg.s, p, r.d, (x) => { seg.iaDeb[i + "|" + sg.cle + "@" + Math.round(x)] = instant(x, p, r.d, seg.tPrec, t); });
            passages(sg.e, p, r.d, (x) => {
              const abs = x - (sg.e - sg.s), k = i + "|" + sg.cle + "@" + Math.round(abs), t0 = seg.iaDeb[k];
              if (t0 === undefined) return;
              delete seg.iaDeb[k];
              occurrence(sg, abs).liste.push({ nom: r.nom, t: instant(x, p, r.d, seg.tPrec, t) - t0, couleur: r.couleur, user: false });
            });
          }
        }
        seg.ia[i] = r.d;
      });
    }
    seg.dPrec = d; seg.tPrec = t;
    afficherSegment();
  }

  // encart du HUD : segment en cours, puis résultat (15 s), sinon le prochain segment à moins de 500 m
  function afficherSegment() {
    const bloc = $("hz-segment");
    if (!bloc) return;
    const d = balade.distance, L = route.longueur;
    let html = "";
    const c = seg.enCours.length ? seg.enCours[seg.enCours.length - 1] : null;
    const titre = (sg) => '<div class="sg-t" style="--c:' + TYPES_SEG[sg.type].coul + '"><span>' + TYPES_SEG[sg.type].ico + "</span>" + sg.nom + "</div>";
    if (c) {
      const lg = c.sg.e - c.sg.s, fait = Math.min(1, Math.max(0, (d - c.abs) / lg)), el = balade.temps - c.t0, rec = records[c.sg.cle];
      const tr = rec ? tempsTrace(rec.m, d - c.abs, rec.t, c.sg.e - c.sg.s) : null, ec = rec ? el - (tr !== null ? tr : rec.t * fait) : null;
      html = titre(c.sg) + '<div class="sg-l"><b>' + fmtSeg(Math.max(0, el)) + "</b>" + (ec !== null && fait > 0.05 ? '<em class="' + (ec <= 0 ? "bon" : "mal") + '">' + fmtEcart(ec) + "</em>" : "") + "</div>" +
        '<div class="sg-bar" style="--c:' + TYPES_SEG[c.sg.type].coul + '"><i style="width:' + (fait * 100).toFixed(1) + '%"></i></div>' +
        '<div class="sg-s">' + Math.max(0, Math.round(c.fin - d)) + " m restants" + (rec ? " · record " + fmtSeg(rec.t) : "") + "</div>";
    } else if (seg.fin && balade.temps < seg.fin.jusqua) {
      const f = seg.fin, o = occurrence(f.sg, f.abs), cl = o.liste.slice().sort((x, y) => x.t - y.t), rang = cl.findIndex((x) => x.user) + 1;
      html = titre(f.sg) + '<div class="sg-l"><b>' + fmtSeg(f.t) + "</b>" + (f.rec !== null ? '<em class="' + (f.bat ? "bon" : "mal") + '">' + fmtEcart(f.t - f.rec) + "</em>" : "") + "</div>" +
        '<div class="sg-s">' + (f.bat ? "Nouveau record !" : f.premier ? "Premier passage : c’est ton record" : "Record " + fmtSeg(f.rec)) + (cl.length > 1 ? " · " + rang + (rang === 1 ? "er" : "e") + " sur " + cl.length : "") + "</div>";
      if (cl.length > 1) {
        cl.slice(0, 4).forEach((x, i) => { html += '<div class="sg-r' + (x.user ? " moi" : "") + '"><i style="background:' + hex6(x.couleur) + '"></i><span>' + (i + 1) + ". " + x.nom + "</span><b>" + fmtSeg(x.t) + "</b></div>"; });
        if (rang > 4) html += '<div class="sg-r moi"><i style="background:#ff7a2f"></i><span>' + rang + ". Toi</span><b>" + fmtSeg(f.t) + "</b></div>";
      }
    } else if (seg.liste.length && L > 0 && balade.temps > 0) {
      let pro = null, dist = 501;
      for (const sg of seg.liste) {
        const k = route.boucle ? Math.ceil((d - sg.s) / L) : 0, x = k * L + sg.s;
        if (x - d > 0 && x - d < dist) { dist = x - d; pro = sg; }
      }
      if (pro) {
        const lg = pro.e - pro.s, pm = (altitudeA(pro.e) - altitudeA(pro.s)) / lg * 100, rec = records[pro.cle];
        html = titre(pro) + '<div class="sg-s">Dans ' + Math.round(dist) + " m · " + (lg >= 1000 ? fr1(lg / 1000) + " km" : Math.round(lg) + " m") + (pro.type === "montee" ? " à " + fr1(pm) + " %" : "") + "</div>" +
          '<div class="sg-s">' + (rec ? "Ton record : " + fmtSeg(rec.t) : "Pas encore de record") + "</div>";
      }
    }
    bloc.hidden = !html;
    if (html !== seg.sig) { seg.sig = html; $("hz-segment-c").innerHTML = html; }
  }

  // bandes de couleur des segments en haut du profil du HUD
  function profil(x, deb, fin, W, H) {
    if (!seg.liste.length || !(route.longueur > 0)) return;
    const L = route.longueur, ech = W / (fin - deb);
    x.font = "bold " + Math.round(H * 0.13) + "px sans-serif"; x.textBaseline = "top";
    for (const sg of seg.liste) {
      const k0 = route.boucle ? Math.floor((deb - sg.e) / L) + 1 : 0, k1 = route.boucle ? Math.floor((fin - sg.s) / L) : 0;
      for (let k = k0; k <= k1; k++) {
        const a = k * L + sg.s, b = k * L + sg.e;
        if (b < deb || a > fin) continue;
        const xa = (a - deb) * ech, xb = (b - deb) * ech;
        x.fillStyle = TYPES_SEG[sg.type].coul; x.globalAlpha = 0.9;
        x.fillRect(xa, 4, xb - xa, H * 0.06);
        x.globalAlpha = 0.18; x.fillRect(xa, 4, xb - xa, H - 8);
        x.globalAlpha = 1;
        if (xa > -20 && xa < W - 60) { x.fillStyle = "#fff"; x.fillText(TYPES_SEG[sg.type].ico + " " + sg.nom, Math.max(4, xa + 4), 6 + H * 0.07); }
      }
    }
  }

  /* =====================================================================
     Sortie en cours : distance, dénivelé, pluie, nuit
     ===================================================================== */
  const vu = { d: null, alt: null, t: null };
  function maj() {
    try {
      if (balade.enCours && vu.d !== null) {
        const dd = balade.distance - vu.d, da = balade.altitude - vu.alt, dt = balade.temps - vu.t;
        if (dd > 0 && dd < 300) {
          const km = dd / 1000;
          sortie.km += km; sortie.xp += km * XP_KM;
          if (monde3d && monde3d.pluie && monde3d.pluie() > 0.3) sortie.kmPluie += km;
          if (route.villeN) sortie.kmNuit += km;
        }
        if (da > 0 && da < 30) { sortie.dplus += da; sortie.xp += da * XP_M; }
        if (dt > 0 && dt < 60) sortie.temps += dt;
      }
      vu.d = balade.distance; vu.alt = balade.altitude; vu.t = balade.temps;
      majSegments();
    } catch (e) { /* la progression ne doit jamais bloquer la boucle */ }
  }
  function oublierSortie() { sortie = vide(); seg.route = null; vu.d = null; }   // vu.d : un saut (départ choisi) n'est pas compté comme roulé
  // (v69 suite) fantôme de ton record sur le segment en cours : position (distance absolue) et vitesse, ou null
  function fantome() {
    const c = seg.enCours.length ? seg.enCours[seg.enCours.length - 1] : null;
    if (!c || seg.route !== route) return null;
    const rec = records[c.sg.cle];
    if (!rec || !rec.m || rec.m.length < 2) return null;
    const t = balade.temps - c.t0, m = rec.m, lg = c.sg.e - c.sg.s;
    if (t < 0 || t > rec.t + 2) return null;
    let x;
    if (t >= m[m.length - 1]) { const x0 = (m.length - 1) * PAS_SEG; x = x0 + (lg - x0) * Math.min(1, (t - m[m.length - 1]) / Math.max(0.1, rec.t - m[m.length - 1])); }
    else { let i = 0, j = m.length - 1; while (j - i > 1) { const k = (i + j) >> 1; if (m[k] <= t) i = k; else j = k; } x = (i + (m[j] > m[i] ? (t - m[i]) / (m[j] - m[i]) : 0)) * PAS_SEG; }
    const i2 = Math.min(m.length - 2, Math.floor(x / PAS_SEG)), v = PAS_SEG / Math.max(0.2, m[i2 + 1] - m[i2]);
    return { d: c.abs + Math.min(lg, x), v: x >= lg ? 0 : v };
  }

  // fin de sortie (« Terminer et enregistrer ») : la sortie est ajoutée à la progression ; renvoie ce qui a changé
  function terminer(course) {
    if (sortie.km < 0.2 && sortie.temps < 60) { oublierSortie(); return null; }
    const avant = niveau(prog.xp), s = semaine(), gains = [];
    let xp = Math.round(sortie.xp);
    gains.push(["Distance et dénivelé", Math.round(sortie.km * XP_KM + sortie.dplus * XP_M)]);
    if (sortie.segs) gains.push(["Segments (" + sortie.segs + ")", Math.round(sortie.xp - sortie.km * XP_KM - sortie.dplus * XP_M)]);
    for (const k of ["km", "dplus", "temps", "segs", "records", "kmPluie", "kmNuit"]) { prog[k] += sortie[k]; if (k !== "kmNuit") s.cpt[k] = (s.cpt[k] || 0) + sortie[k]; }
    prog.sorties++; s.cpt.sorties = (s.cpt.sorties || 0) + 1;
    const id = (typeof mondeActifId !== "undefined" && mondeActifId) || route.nom;
    prog.mondes[id] = true;
    if (course && course.fini) {
      prog.courses++; xp += XP_COURSE; gains.push(["Course terminée", XP_COURSE]);
      if (course.rang <= 3 && course.n >= 3) { prog.podiums++; s.cpt.podiums = (s.cpt.podiums || 0) + 1; xp += XP_PODIUM; gains.push(["Podium", XP_PODIUM]); }
      if (course.rang === 1) { prog.victoires++; xp += XP_VICTOIRE; gains.push(["Victoire", XP_VICTOIRE]); }
    }
    const defis = [];
    const etat = etatDefis(false);
    for (const d of etat) if (d.v >= d.n && s.faits.indexOf(d.id) < 0) { s.faits.push(d.id); xp += d.xp; defis.push(d); gains.push(["Défi : " + d.txt, d.xp]); }
    if (defis.length && s.faits.length >= 3 && etat.every((d) => s.faits.indexOf(d.id) >= 0)) prog.semainesParfaites++;
    for (const d of etatLongs()) {
      const e = prog.longs[d.id];
      e.v += d.c === "sorties" ? 1 : sortie[d.c] || 0;
      if (e.v >= d.n) { delete prog.longs[d.id]; prog.longsFaits[d.id] = Date.now(); xp += d.xp; gains.push(["Défi au long cours : " + d.nom, d.xp]); log("Défi au long cours réussi : " + d.nom + " !"); }
    }
    prog.xp += xp;
    const badges = [];
    for (let tour = 0; tour < 3; tour++) for (const b of BADGES) if (!prog.badges[b.id] && b.ok(prog)) { prog.badges[b.id] = Date.now(); prog.xp += XP_BADGE; xp += XP_BADGE; badges.push(b); gains.push(["Badge : " + b.nom, XP_BADGE]); }
    const journal = sortie.journal.slice();
    ecrireJ(CLE_PROG, prog);
    oublierSortie();
    majPuce();
    return { xp, gains, avant, apres: niveau(prog.xp), defis, badges, journal };
  }

  /* =====================================================================
     Affichage : puce du niveau, fenêtre « Progression », partie du résumé de fin
     ===================================================================== */
  function majPuce() {
    const p = $("puce-niveau");
    if (!p) return;
    const nv = niveau(prog.xp);
    p.querySelector(".pn-n").textContent = nv.n;
    p.querySelector(".pn-b i").style.width = (nv.frac * 100).toFixed(1) + "%";
    p.title = "Niveau " + nv.n + " · " + nv.titre + " — " + Math.round(nv.dans) + " / " + nv.besoin + " XP. Défis, badges et records";
  }
  const barre = (f, c) => '<div class="pg-barre"' + (c ? ' style="--c:' + c + '"' : "") + '><i style="width:' + (Math.min(1, f) * 100).toFixed(1) + '%"></i></div>';
  function finSemaine() {
    const d = new Date(), j = (7 - (d.getDay() + 6) % 7);
    return j <= 1 ? "dernier jour" : j + " jours restants";
  }
  function htmlDefis(avecSortie) {
    return etatDefis(avecSortie).map((d) => '<div class="pg-defi' + (d.fait ? " fait" : "") + '"><div class="pg-dl"><b>' + d.txt + "</b><span>" + (d.fait ? "✓ Réussi" : d.fmt(Math.min(d.v, d.n)) + " / " + d.fmt(d.n)) + "</span></div>" +
      barre(d.v / d.n, d.fait ? "#4FD69C" : null) + '<div class="pg-xp">+' + d.xp + " XP</div></div>").join("");
  }
  function ouvrir() {
    const nv = niveau(prog.xp);
    let h = '<button type="button" class="pg-fermer" aria-label="Fermer">✕</button>';
    h += '<div class="pg-tete"><div class="pg-rond"><b>' + nv.n + "</b><span>niveau</span></div><div class=\"pg-tete-t\"><h2>" + nv.titre + "</h2>" +
      barre(nv.frac) + '<div class="pg-petit">' + (nv.n >= 50 ? "Niveau maximum atteint" : Math.round(nv.dans) + " / " + nv.besoin + " XP avant le niveau " + (nv.n + 1)) + " · " + Math.round(prog.xp) + " XP au total</div></div></div>";
    h += '<div class="pg-totaux">' + [[fr1(prog.km) + " km", "distance"], [Math.round(prog.dplus) + " m", "dénivelé"], [formatDuree(prog.temps), "en selle"], [prog.sorties, "sorties"], [prog.segs, "segments"], [prog.victoires, "victoires"]]
      .map((x) => "<div><b>" + x[0] + "</b><span>" + x[1] + "</span></div>").join("") + "</div>";
    h += '<h3>Défis de la semaine <small>' + finSemaine() + "</small></h3>" + htmlDefis(false);
    const lg = etatLongs();
    h += "<h3>Défis au long cours <small>" + lg.length + " / 3 relevés</small></h3>";
    h += lg.map((d) => '<div class="pg-defi"><div class="pg-dl"><b>' + d.ico + " " + d.nom + "</b><span>" + d.fmt(Math.min(d.v, d.n)) + " / " + d.fmt(d.n) + " · " + d.jr + " jour" + (d.jr > 1 ? "s" : "") + " restant" + (d.jr > 1 ? "s" : "") + "</span></div>" +
      barre(d.v / d.n) + '<div class="pg-xp">+' + d.xp + ' XP <button type="button" class="petit" data-long-x="' + d.id + '" title="Abandonner ce défi">✕</button></div></div>').join("");
    const dispo = LONGS.filter((d) => !prog.longs[d.id]);
    if (lg.length < 3) h += '<div class="pg-longs">' + dispo.map((d) => '<button type="button" class="pg-long" data-long="' + d.id + '"><i>' + d.ico + "</i><b>" + d.nom + "</b><span>" + d.desc + " · +" + d.xp + " XP" + (prog.longsFaits[d.id] ? " · déjà réussi le " + new Date(prog.longsFaits[d.id]).toLocaleDateString("fr-FR") : "") + "</span></button>").join("") + "</div>";
    else h += '<p class="pg-petit">Trois défis relevés : termine-en un (ou abandonne-le) pour en relever un autre.</p>';
    const nbB = BADGES.filter((b) => prog.badges[b.id]).length;
    h += "<h3>Badges <small>" + nbB + " / " + BADGES.length + '</small></h3><div class="pg-badges">' + BADGES.map((b) => {
      const ok = prog.badges[b.id];
      return '<div class="pg-badge' + (ok ? " ok" : "") + '" title="' + b.desc + '"><i>' + b.ico + "</i><b>" + b.nom + "</b><span>" + (ok ? "Obtenu le " + new Date(ok).toLocaleDateString("fr-FR") : b.desc) + "</span></div>";
    }).join("") + "</div>";
    const parMonde = {};
    for (const k in records) { const r = records[k]; (parMonde[r.monde] = parMonde[r.monde] || []).push(r); }
    h += "<h3>Records des segments</h3>";
    const mondes = Object.keys(parMonde);
    if (!mondes.length) h += '<p class="pg-petit">Pas encore de record : les segments chronométrés (sprints ⚡, montées ⛰, secteurs ⚪) sont annoncés en roulant, avec une banderole au départ et à l’arrivée.</p>';
    for (const m of mondes) {
      h += '<div class="pg-monde">' + m + "</div>";
      parMonde[m].sort((a, b) => a.nom.localeCompare(b.nom)).forEach((r) => {
        h += '<div class="pg-rec"><span>' + (TYPES_SEG[r.type] || TYPES_SEG.sprint).ico + " " + r.nom + "</span><b>" + fmtSeg(r.t) + "</b><em>" + new Date(r.date).toLocaleDateString("fr-FR") + "</em></div>";
      });
    }
    const f = $("progression");
    $("progression-c").innerHTML = h;
    f.hidden = false;
    const fermer = () => { f.hidden = true; document.removeEventListener("keydown", echap); };
    const echap = (e) => { if (e.key === "Escape") fermer(); };
    document.addEventListener("keydown", echap);
    f.onclick = (e) => { if (e.target === f) fermer(); };
    f.querySelector(".pg-fermer").onclick = fermer;
    f.querySelectorAll("[data-long]").forEach((b) => { b.onclick = () => { relever(b.dataset.long); fermer(); ouvrir(); }; });
    f.querySelectorAll("[data-long-x]").forEach((b) => { b.onclick = () => { if (confirm("Abandonner ce défi ? Ton avancement sera perdu.")) { abandonnerLong(b.dataset.longX); fermer(); ouvrir(); } }; });
  }
  // partie « Progression » du résumé de fin de sortie
  function htmlResume(g) {
    if (!g) return "";
    let h = '<div class="rf-prog"><div class="rf-prog-t"><b>+' + g.xp + " XP</b><span>Niveau " + g.apres.n + " · " + g.apres.titre + "</span></div>" + barre(g.apres.frac);
    if (g.apres.n > g.avant.n) h += '<div class="rf-niveau">Niveau supérieur ! Tu passes au niveau ' + g.apres.n + ".</div>";
    h += '<div class="rf-gains">' + g.gains.filter((x) => x[1] > 0).map((x) => "<span>" + x[0] + " <b>+" + x[1] + "</b></span>").join("") + "</div>";
    for (const b of g.badges) h += '<div class="rf-badge"><i>' + b.ico + "</i><b>Nouveau badge : " + b.nom + "</b><span>" + b.desc + "</span></div>";
    h += "</div>";
    if (g.journal.length) {
      h += "<h3 style=\"margin:6px 0\">Segments</h3>";
      for (const j of g.journal) h += '<div class="rf-l' + (j.record || j.premier ? " best" : "") + '"><span>' + TYPES_SEG[j.type].ico + " " + j.nom + (j.record ? " · nouveau record (" + fmtEcart(j.t - j.ancien) + ")" : j.premier ? " · premier passage" : "") + "</span><b>" + fmtSeg(j.t) + "</b></div>";
    }
    return h;
  }

  // page d'accueil (onglet Rouler) : niveau et défis de la semaine
  function majAccueil() {
    const c = $("accueil-prog");
    if (!c) return;
    const nv = niveau(prog.xp);
    c.innerHTML = '<div class="ap-tete"><div class="pg-rond petit"><b>' + nv.n + "</b></div><div><b>" + nv.titre + "</b>" + barre(nv.frac) + '<span class="pg-petit">' + Math.round(nv.dans) + " / " + nv.besoin + " XP</span></div></div>" +
      '<div class="ap-defis">' + etatDefis(false).map((d) => '<div class="ap-defi' + (d.fait ? " fait" : "") + '"><span>' + (d.fait ? "✓ " : "") + d.txt + "</span>" + barre(d.v / d.n, d.fait ? "#4FD69C" : null) + "</div>").join("") +
      etatLongs().map((d) => '<div class="ap-defi"><span>' + d.ico + " " + d.nom + " · " + d.jr + " j</span>" + barre(d.v / d.n, "#FFB627") + "</div>").join("") + "</div>";
  }

  document.addEventListener("DOMContentLoaded", () => { majPuce(); majAccueil(); });
  if (document.readyState !== "loading") setTimeout(() => { majPuce(); majAccueil(); }, 0);
  const puce = document.getElementById("puce-niveau");
  if (puce) puce.addEventListener("click", ouvrir);
  const lienA = document.getElementById("accueil-prog");
  if (lienA) lienA.addEventListener("click", ouvrir);

  return { maj, terminer, oublierSortie, fantome, profil, htmlResume, ouvrir, majAccueil, segments: () => seg.liste, segmentsRoute, niveau: () => niveau(prog.xp), TYPES_SEG };
})();
