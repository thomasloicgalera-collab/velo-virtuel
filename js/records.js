"use strict";
/* =====================================================================
   (v105) Historique → Records : meilleures puissances (toutes les sorties), évolution de la FTP (graphique),
   meilleurs tours des parcours et records des segments chronométrés. Tout vient de ce qui est déjà enregistré dans ce navigateur.
   Les noms de parcours et de segments peuvent venir de fichiers importés : toujours écrits avec textContent.
   ===================================================================== */
const MesRecords = (function () {
  const PUISSANCES = [[5, "5 secondes"], [60, "1 minute"], [300, "5 minutes"], [1200, "20 minutes"], [3600, "1 heure"]];
  const TYPES_SEG = { montee: "Montée", sprint: "Sprint", secteur: "Secteur" };
  const lireJ = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const jour = (t) => (t > 0 ? new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "date non gardée");
  const el = (balise, classe, texte) => { const e = document.createElement(balise); if (classe) e.className = classe; if (texte !== undefined) e.textContent = texte; return e; };
  const chrono = (s) => (s < 60 ? fr1(s) + " s" : formatDuree(Math.round(s)));

  function tuile(valeur, ...lignes) {
    const d = el("div");
    d.append(el("div", "val", valeur));
    for (const l of lignes) d.append(el("div", "lib", l));
    return d;
  }
  function tableau(titres, lignes) {
    const t = el("table", "rec-table"), tete = el("thead"), tr = el("tr"), corps = el("tbody");
    for (const x of titres) tr.append(el("th", "", x));
    tete.append(tr);
    for (const l of lignes) { const r = el("tr"); for (const c of l) r.append(el("td", "", String(c))); corps.append(r); }
    t.append(tete, corps);
    const boite = el("div", "rec-defile");
    boite.append(t);
    return boite;
  }

  /* ----- meilleures puissances et grandes sorties ----- */
  function puissance() {
    const boite = $("rec-puissance"), cumul = $("rec-sorties"), poids = parseFloat($("poids").value) || 70;
    boite.innerHTML = ""; cumul.innerHTML = "";
    for (const [d, nom] of PUISSANCES) {
      const i = Analyse.DUREES.indexOf(d);
      let best = null;
      for (const h of historique) { const v = h.courbe && h.courbe[i]; if (v > 0 && (!best || v > best.w)) best = { w: v, t: h.id }; }
      boite.append(best ? tuile(best.w + " W", nom + " · " + fr2(best.w / poids) + " W/kg", jour(best.t)) : tuile("–", nom, "pas encore mesuré"));
    }
    const max = (cle) => historique.reduce((m, h) => (h[cle] > 0 && (!m || h[cle] > m[cle]) ? h : m), null);
    for (const [cle, nom, f] of [["distance", "Plus longue distance", (v) => fr1(v / 1000) + " km"], ["n", "Plus longue sortie", (v) => formatDuree(v)],
      ["dplus", "Plus gros dénivelé", (v) => Math.round(v) + " m"], ["np", "Meilleure puissance normalisée (20 min ou plus)", (v) => Math.round(v) + " W"]]) {
      const liste = cle === "np" ? historique.filter((h) => h.n >= 1200) : historique;
      const m = cle === "np" ? liste.reduce((a, h) => (h.np > 0 && (!a || h.np > a.np) ? h : a), null) : max(cle);
      cumul.append(m ? tuile(f(m[cle]), nom, jour(m.id)) : tuile("–", nom, "pas encore"));
    }
  }

  /* ----- évolution de la FTP : courbe en escalier ----- */
  function pointsFtp() {
    const l = (typeof lireFtpHist === "function" ? lireFtpHist() : []).filter((x) => x && x.w > 0 && x.t > 0).sort((a, b) => a.t - b.t);
    const pts = [];
    if (l.length && l[0].avant > 0) {
      const premiere = historique.length ? historique[historique.length - 1].id : l[0].t - 30 * 86400000;
      pts.push({ t: Math.min(premiere, l[0].t - 86400000), w: l[0].avant, source: "départ" });
    }
    for (const x of l) pts.push({ t: x.t, w: x.w, source: x.source || "" });
    return pts;
  }
  function ftpGraphique() {
    const boite = $("rec-ftp"), note = $("rec-ftp-note");
    boite.innerHTML = "";
    const pts = pointsFtp();
    if (!pts.length) { note.textContent = "Ta FTP actuelle est de " + ftp() + " W. La courbe se dessinera au premier changement validé (fin d’un test FTP, ou le bouton « Appliquer » du résumé)."; return; }
    const poids = parseFloat($("poids").value) || 70, dernier = pts[pts.length - 1];
    note.textContent = "FTP actuelle : " + ftp() + " W (" + fr2(ftp() / poids) + " W/kg).";
    const tous = pts.concat([{ t: Date.now(), w: dernier.w, fin: true }]);
    const NS = "http://www.w3.org/2000/svg", L = Math.max(320, boite.clientWidth || 640), H = 220, G = 46, D = 54, Ha = 14, B = 28;
    const tMin = tous[0].t, tMax = tous[tous.length - 1].t;
    let wMin = Math.min(...pts.map((p) => p.w)), wMax = Math.max(...pts.map((p) => p.w));
    const pas = wMax - wMin > 80 ? 40 : wMax - wMin > 30 ? 20 : 10;
    wMin = Math.floor((wMin - 5) / pas) * pas; wMax = Math.ceil((wMax + 5) / pas) * pas;
    const X = (t) => G + (tMax > tMin ? (t - tMin) / (tMax - tMin) : 1) * (L - G - D);
    const Y = (w) => Ha + (1 - (w - wMin) / (wMax - wMin)) * (H - Ha - B);
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 " + L + " " + H); svg.setAttribute("width", L); svg.setAttribute("height", H);
    svg.setAttribute("role", "img"); svg.setAttribute("aria-label", "Évolution de la FTP en watts, valeurs dans le tableau ci-dessous");
    const trace = (nom, att, texte) => { const e = document.createElementNS(NS, nom); for (const k in att) e.setAttribute(k, att[k]); if (texte !== undefined) e.textContent = texte; svg.append(e); return e; };
    for (let w = wMin; w <= wMax; w += pas) {
      trace("line", { x1: G, x2: L - D, y1: Y(w), y2: Y(w), class: "rec-grille" });
      trace("text", { x: G - 8, y: Y(w) + 4, "text-anchor": "end", class: "rec-axe" }, String(w));
    }
    const court = (t) => new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: tMax - tMin > 300 * 86400000 ? "2-digit" : undefined });
    trace("text", { x: G, y: H - 8, "text-anchor": "start", class: "rec-axe" }, court(tMin));
    trace("text", { x: L - D, y: H - 8, "text-anchor": "end", class: "rec-axe" }, "aujourd’hui");
    if (tMax - tMin > 20 * 86400000) trace("text", { x: (G + L - D) / 2, y: H - 8, "text-anchor": "middle", class: "rec-axe" }, court((tMin + tMax) / 2));
    let chemin = "M" + X(tous[0].t) + " " + Y(tous[0].w);
    for (let i = 1; i < tous.length; i++) chemin += " H" + X(tous[i].t) + " V" + Y(tous[i].w);
    trace("path", { d: chemin, class: "rec-ligne" });
    for (const p of pts) trace("circle", { cx: X(p.t), cy: Y(p.w), r: 4.5, class: "rec-point" });
    trace("text", { x: L - D + 8, y: Y(dernier.w) + 4, class: "rec-valeur" }, dernier.w + " W");
    // survol : repère vertical et bulle sur le changement le plus proche
    const repere = trace("line", { x1: 0, x2: 0, y1: Ha, y2: H - B, class: "rec-repere", visibility: "hidden" });
    const bulle = el("div", "rec-bulle");
    bulle.hidden = true;
    const montrer = (ev) => {
      const r = svg.getBoundingClientRect(), x = (ev.clientX - r.left) * L / r.width;
      let p = pts[0];
      for (const q of pts) if (X(q.t) <= x + 6) p = q;
      repere.setAttribute("x1", X(p.t)); repere.setAttribute("x2", X(p.t)); repere.setAttribute("visibility", "visible");
      bulle.hidden = false; bulle.textContent = p.w + " W · " + jour(p.t) + (p.source ? " · " + p.source : "");
      bulle.style.left = Math.min(X(p.t) * r.width / L + 10, r.width - 190) + "px"; bulle.style.top = Math.max(0, Y(p.w) * r.height / H - 36) + "px";
    };
    svg.addEventListener("pointermove", montrer);
    svg.addEventListener("pointerleave", () => { bulle.hidden = true; repere.setAttribute("visibility", "hidden"); });
    const cadre = el("div", "rec-graph");
    cadre.append(svg, bulle);
    const details = el("details", "reg-aide");
    details.append(el("summary", "", "Voir les valeurs"), tableau(["Date", "FTP", "Origine"], pts.slice().reverse().map((p) => [jour(p.t), p.w + " W", p.source || "–"])));
    boite.append(cadre, details);
  }

  /* ----- meilleurs tours : clés « velo_pr_nom du parcours_longueur » ----- */
  function tours() {
    const lignes = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k.startsWith("velo_pr_")) continue;
      const j = lireJ(k), coupe = k.lastIndexOf("_"), nom = k.slice(8, coupe), L = parseInt(k.slice(coupe + 1), 10);
      if (!j || !(j.t > 0) || !(L > 0) || !nom) continue;
      lignes.push({ nom, L, t: j.t, date: j.date });
    }
    lignes.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
    const boite = $("rec-tours");
    boite.innerHTML = "";
    if (!lignes.length) { boite.append(el("div", "info", "Pas encore de tour complet enregistré : boucle un tour (ou un parcours entier) pour créer un record.")); return; }
    boite.append(tableau(["Parcours", "Longueur", "Meilleur temps", "Vitesse moyenne", "Date"],
      lignes.map((x) => [x.nom, fr1(x.L / 1000) + " km", chrono(x.t), fr1(x.L / x.t * 3.6) + " km/h", jour(x.date)])));
  }

  /* ----- segments chronométrés, groupés par parcours ----- */
  function segments() {
    const boite = $("rec-segments"), records = lireJ("velo_segments_v1") || {}, parMonde = Object.create(null);
    boite.innerHTML = "";
    for (const k in records) {
      const r = records[k];
      if (!r || !(r.t > 0)) continue;
      (parMonde[r.monde || "Autre"] = parMonde[r.monde || "Autre"] || []).push(Object.assign({ pos: parseFloat(k.split("|")[2]) || 0 }, r));
    }
    const noms = Object.keys(parMonde).sort((a, b) => a.localeCompare(b, "fr"));
    if (!noms.length) { boite.append(el("div", "info", "Pas encore de segment chronométré : les montées, sprints et secteurs sont mesurés tout seuls pendant tes sorties.")); return; }
    noms.forEach((monde, i) => {
      const liste = parMonde[monde].sort((a, b) => a.pos - b.pos), d = el("details", "rec-monde");
      if (noms.length === 1 || i === 0) d.open = true;
      d.append(el("summary", "", monde + " · " + liste.length + (liste.length > 1 ? " records" : " record")),
        tableau(["Segment", "Type", "Temps", "Date"], liste.map((r) => [r.nom || "Segment", TYPES_SEG[r.type] || "–", chrono(r.t), jour(r.date)])));
      boite.append(d);
    });
  }

  function rendre() {
    if (!$("rec-puissance") || $("rec-puissance").closest("section").hidden) return;
    for (const f of [puissance, ftpGraphique, tours, segments]) { try { f(); } catch (e) { console.warn("records", e); } }
  }
  window.addEventListener("resize", () => { if (!$("onglet-historique").hidden) rendre(); });
  return { rendre };
})();
