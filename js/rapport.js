"use strict";
/* =====================================================================
   (v97) Rapport de fin de sortie plus détaillé (fenêtre « Sortie terminée ») :
   - temps passé dans chaque zone de puissance ;
   - séance ERG : pour chaque intervalle, puissance moyenne et part du temps dans la cible (±10 %) ;
   - comparaison avec la sortie précédente sur le même parcours (vitesse, puissance, cœur).
   ===================================================================== */
const Rapport = (function () {
  const dur = (s) => formatDuree(Math.round(s));
  const delta = (a, b, unite, dec, mieuxHaut) => {
    const d = a - b, bon = mieuxHaut ? d > 0 : d < 0;
    const t = (d > 0 ? "+" : d < 0 ? "−" : "") + (dec ? fr1(Math.abs(d)) : Math.round(Math.abs(d))) + " " + unite;
    return '<b class="' + (Math.abs(d) < 0.05 ? "" : bon ? "mieux" : "moins") + '">' + t + "</b>";
  };

  function zones(r) {
    const tot = r.zonesP.reduce((a, b) => a + b, 0);
    if (!tot) return "";
    return '<div class="rp-bloc"><div class="rp-t">Zones de puissance</div><div class="rp-zones">' +
      ZONES_P.map((z, i) => r.zonesP[i] ? '<span style="flex:' + r.zonesP[i] + ';background:' + z.couleur + '" title="' + z.nom + " " + z.lib + " : " + dur(r.zonesP[i]) + '"></span>' : "").join("") + "</div>" +
      '<div class="rp-leg">' + ZONES_P.map((z, i) => r.zonesP[i] >= 30 ? '<span><i style="background:' + z.couleur + '"></i>' + z.nom + " " + dur(r.zonesP[i]) + " (" + Math.round(100 * r.zonesP[i] / tot) + " %)</span>" : "").join("") + "</div></div>";
  }

  // intervalles de la séance ERG : échantillons de la fenêtre de chaque intervalle (les 15 premières secondes sont ignorées : le temps que la cible s'installe)
  function intervalles(samples) {
    if (!seance.ergVu || seance.dyn || !seance.intervalles.length || seance.saute || !samples.length) return "";
    const W = ftp() * (seance.k || 1);
    let debut = seance.t0, lignes = "", ok = 0, nb = 0;
    seance.intervalles.forEach((iv, i) => {
      const d = iv.min * 60, a = Math.floor(debut), b = Math.min(samples.length, Math.floor(debut + d));
      debut += d;
      if (iv.libre || iv.fc || b - a < 40 || a >= samples.length) return;
      const cible = pctMoyen(iv) * W / 100, part = samples.slice(a + 15, b).map((x) => x.p || 0);
      if (part.length < 20) return;
      const moy = part.reduce((s, x) => s + x, 0) / part.length, dans = part.filter((x) => Math.abs(x - cible) <= 0.1 * cible).length / part.length;
      const tenu = iv.fin === undefined ? Math.abs(moy - cible) <= 0.05 * cible : Math.abs(moy - cible) <= 0.08 * cible;
      nb++; if (tenu) ok++;
      lignes += '<div class="rp-l' + (tenu ? " ok" : " ko") + '"><span>' + (tenu ? "✓" : "✗") + " " + (i + 1) + ". " + formatMinutes(iv.min) + " à " + (iv.fin !== undefined ? iv.pct + "→" + iv.fin : iv.pct) + " % (" + Math.round(cible) + " W)</span><b>" + Math.round(moy) + " W · " + Math.round(dans * 100) + " % dans la cible</b></div>";
    });
    if (!nb) return "";
    return '<div class="rp-bloc"><div class="rp-t">Intervalles de « ' + echapper(seance.nom || "la séance") + " » : " + ok + " sur " + nb + " tenus</div>" + lignes + "</div>";
  }

  function comparaison(r) {
    if (typeof historique === "undefined" || !Array.isArray(historique)) return "";
    const prec = historique.filter((h) => h.parcours === route.nom && h.id !== session.debut && h.id < (session.debut || Infinity) && h.n >= 600 && h.distance > 0).sort((a, b) => b.id - a.id)[0];
    if (!prec) return "";
    const date = new Date(prec.id).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
    let h = '<div class="rp-bloc"><div class="rp-t">Par rapport à ta dernière sortie ici (' + date + ")</div>";
    const l = (nom, a, b, unite, dec, haut) => { if (a === null || b === null || a === undefined || b === undefined) return ""; return '<div class="rp-l"><span>' + nom + "</span><span>" + (dec ? fr1(a) : Math.round(a)) + " " + unite + " · avant " + (dec ? fr1(b) : Math.round(b)) + " " + unite + " " + delta(a, b, unite, dec, haut) + "</span></div>"; };
    h += l("Vitesse moyenne", r.vitMoy, prec.vitMoy, "km/h", true, true) + l("Puissance moyenne", r.pMoy, prec.pMoy, "W", false, true) + l("Puissance normalisée", r.np, prec.np, "W", false, true);
    if (r.fcMoy !== null && prec.fcMoy !== null && prec.fcMoy !== undefined) h += l("FC moyenne", r.fcMoy, prec.fcMoy, "bpm", false, false);
    if (prec.pMoy > 0 && r.pMoy > 0 && prec.vitMoy > 0) {
      const eff = (r.vitMoy / r.pMoy) / (prec.vitMoy / prec.pMoy) - 1;
      h += '<div class="rp-l"><span>Efficacité (km/h par watt)</span><span>' + (eff >= 0 ? "+" : "−") + Math.abs(Math.round(eff * 1000) / 10).toString().replace(".", ",") + " %</span></div>";
    }
    return h + "</div>";
  }

  function construire(res, samples) {
    let h = "";
    try { h += zones(res.r); } catch (e) { /* facultatif */ }
    try { h += intervalles(samples); } catch (e) { /* facultatif */ }
    try { h += comparaison(res.r); } catch (e) { /* facultatif */ }
    return h ? '<div class="rf-rapport"><h3>Rapport de séance</h3>' + h + "</div>" : "";
  }
  return { construire };
})();
