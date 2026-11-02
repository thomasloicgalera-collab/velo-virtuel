"use strict";
/* =====================================================================
   (v69 suite) Analyse de l'historique : courbe de puissance, zones de fréquence
   cardiaque calculées d'après les séances, bilans de la semaine et du mois
   ===================================================================== */
const Analyse = (function () {
  // durées de la courbe de puissance (s)
  const DUREES = [1, 2, 3, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 300, 420, 600, 900, 1200, 1800, 2700, 3600, 5400, 7200];
  const JOUR = 86400000;

  /* ---------- Calculs faits à l'enregistrement de chaque séance (gardés dans son résumé) ---------- */
  // meilleure puissance moyenne pour chaque durée (null si la séance est plus courte)
  function courbe(samples) {
    const pw = samples.map((x) => x.p || 0);
    return DUREES.map((d) => { const m = meilleureMoyenne(pw, d); return m === null ? null : Math.round(m); });
  }
  // fréquence cardiaque : pic tenu 10 s (FC max observée) et FC moyenne pendant les 20 min les plus fortes en puissance
  // (seulement si l'effort était vraiment dur, au moins 88 % du FTP : c'est alors une bonne mesure de la FC au seuil)
  function cardio(samples, ftpVal) {
    const n = samples.length, hr = samples.map((x) => x.hr || 0);
    let pic = null;
    if (hr.filter((x) => x > 0).length > 30) {
      let acc = 0, nb = 0;
      for (let i = 0; i < n; i++) {
        acc += hr[i]; nb += hr[i] > 0 ? 1 : 0;
        if (i >= 10) { acc -= hr[i - 10]; nb -= hr[i - 10] > 0 ? 1 : 0; }
        if (i >= 9 && nb === 10) pic = Math.max(pic || 0, acc / 10);
      }
    }
    let fc20 = null;
    if (n >= 1200) {
      let acc = 0, best = -1, iBest = 0;
      for (let i = 0; i < n; i++) { acc += samples[i].p || 0; if (i >= 1200) acc -= samples[i - 1200].p || 0; if (i >= 1199 && acc > best) { best = acc; iBest = i - 1199; } }
      if (best / 1200 >= 0.88 * ftpVal) {
        let s = 0, k = 0;
        for (let i = iBest; i < iBest + 1200; i++) if (hr[i] > 0) { s += hr[i]; k++; }
        if (k > 960) fc20 = Math.round(s / k);
      }
    }
    return { fcPic: pic ? Math.round(pic) : null, fc20 };
  }
  // ajouté au résumé d'une séance au moment de l'enregistrer
  function completer(resume, samples) {
    resume.courbe = courbe(samples);
    Object.assign(resume, cardio(samples, resume.ftp || ftp()));
    return resume;
  }

  /* ---------- Anciennes séances : courbe calculée une fois, puis gardée ---------- */
  let rattrapage = false;
  async function rattraper() {
    if (rattrapage || stockage.type !== "indexeddb") return;
    const manque = historique.filter((h) => !h.courbe);
    if (!manque.length) return;
    rattrapage = true;
    $("courbe-etat").textContent = "Calcul de la courbe pour tes anciennes séances…";
    for (const h of manque) {
      try {
        const s = await lireDonnees(h.id);
        if (!s) { h.courbe = []; continue; }
        completer(h, s);
        await transaction(["resumes"], "readwrite", (t) => { t.objectStore("resumes").put(h); });
      } catch (e) { h.courbe = []; }
    }
    rattrapage = false;
    $("courbe-etat").textContent = "";
    rendre();
  }

  /* ---------- Courbe de puissance ---------- */
  const meilleure = (liste) => DUREES.map((_, i) => { let m = null; for (const h of liste) { const v = h.courbe && h.courbe[i]; if (v != null && (m === null || v > m)) m = v; } return m; });
  const FMT_D = (d) => d < 60 ? d + " s" : d < 3600 ? (d / 60) + " min" : (d / 3600) + " h";
  function rendreCourbe() {
    const jours = parseInt($("courbe-periode").value, 10) || 0;
    const tout = meilleure(historique), per = jours ? meilleure(historique.filter((h) => h.id >= Date.now() - jours * JOUR)) : tout;
    const poids = parseFloat($("poids").value) || 75, idx = (d) => DUREES.indexOf(d);
    const tuile = (d, lib) => { const v = per[idx(d)]; return '<div><div class="val">' + (v ? v + "&nbsp;W" : "–") + '</div><div class="lib">' + lib + (v ? " · " + fr1(v / poids) + " W/kg" : "") + "</div></div>"; };
    $("tuiles-courbe").innerHTML = tuile(5, "5 secondes") + tuile(60, "1 minute") + tuile(300, "5 minutes") + tuile(1200, "20 minutes") + tuile(3600, "1 heure");
    dessinerCourbe(per, tout);
    // points forts : comparaison avec un profil moyen (5 s ≈ 3,5 ×, 1 min ≈ 1,75 ×, 5 min ≈ 1,2 × la puissance de 20 min)
    const p20 = per[idx(1200)];
    let txt = "";
    if (!historique.some((h) => h.courbe && h.courbe.length)) txt = "Enregistre des séances pour voir ta courbe de puissance.";
    else if (!p20) txt = "Roule au moins 20 minutes d’affilée pour comparer tes efforts courts et longs.";
    else {
      const prof = [["le sprint", per[idx(5)], 3.5], ["les efforts d’une minute (attaques, bosses courtes)", per[idx(60)], 1.75], ["les efforts de 5 minutes (montées, VO2max)", per[idx(300)], 1.2]]
        .filter((x) => x[1]).map((x) => [x[0], x[1] / p20 / x[2]]);
      if (prof.length) {
        prof.sort((a, b) => b[1] - a[1]);
        const fort = prof[0], faible = prof[prof.length - 1];
        txt = fort[1] > 1.06 ? "Ton point fort : " + fort[0] + "." : fort[1] < 0.94 ? "Ton point fort : l’endurance au seuil (tes efforts de 20 min sont très bons par rapport à tes efforts courts)." : "Profil assez équilibré.";
        if (faible !== fort && faible[1] < 0.95) txt += " À travailler : " + faible[0] + ".";
      }
      const est = Math.round(p20 * 0.95), diff = est - ftp();
      txt += " D’après ton meilleur 20 min, ton FTP serait d’environ " + est + " W (actuel : " + ftp() + " W).";
      if (Math.abs(diff) >= Math.max(5, ftp() * 0.03)) txt += ' <button class="petit" data-ftp="' + est + '">Utiliser ' + est + " W</button>";
    }
    $("texte-courbe").innerHTML = txt;
  }
  function dessinerCourbe(per, tout) {
    const c = $("graph-courbe"), dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
    if (!w) return;
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const x = c.getContext("2d");
    x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
    const vals = per.concat(tout).filter((v) => v);
    if (!vals.length) return;
    const g = 40, d = 8, haut = 10, bas = h - 22, max = Math.max(ftp() * 1.6, ...vals) * 1.08;
    const X = (s) => g + (Math.log(s) / Math.log(7200)) * (w - g - d), Y = (v) => bas - (v / max) * (bas - haut);
    x.font = "11px sans-serif"; x.fillStyle = "rgba(255,255,255,.5)"; x.strokeStyle = "rgba(255,255,255,.09)"; x.lineWidth = 1;
    x.textAlign = "center";
    for (const s of [1, 5, 15, 60, 300, 1200, 3600, 7200]) { x.beginPath(); x.moveTo(X(s), haut); x.lineTo(X(s), bas); x.stroke(); x.fillText(FMT_D(s), X(s), h - 6); }
    x.textAlign = "right";
    const pas = max > 1200 ? 400 : max > 600 ? 200 : 100;
    for (let v = pas; v < max; v += pas) { x.beginPath(); x.moveTo(g, Y(v)); x.lineTo(w - d, Y(v)); x.stroke(); x.fillText(v + " W", g - 4, Y(v) + 4); }
    x.save(); x.setLineDash([5, 5]); x.strokeStyle = "rgba(255,255,255,.35)"; x.beginPath(); x.moveTo(g, Y(ftp())); x.lineTo(w - d, Y(ftp())); x.stroke(); x.restore();
    const trace = (t, coul, ep) => {
      x.beginPath(); x.strokeStyle = coul; x.lineWidth = ep; let deb = true;
      t.forEach((v, i) => { if (!v) return; if (deb) { x.moveTo(X(DUREES[i]), Y(v)); deb = false; } else x.lineTo(X(DUREES[i]), Y(v)); });
      x.stroke();
    };
    trace(tout, "rgba(195,205,217,.55)", 2);
    trace(per, "#FFB627", 3);
    x.fillStyle = "#FFB627";
    per.forEach((v, i) => { if (v) { x.beginPath(); x.arc(X(DUREES[i]), Y(v), 2.5, 0, 6.283); x.fill(); } });
  }

  /* ---------- Zones de FC calculées d'après les séances ----------
     FC max : le plus haut pic tenu 10 s parmi tes séances (si plus haut que ton réglage, celui-ci est relevé).
     FC au seuil : la FC moyenne de ton effort de 20 min le plus fort des 6 derniers mois ; les zones suivent alors la méthode de Joe Friel
     (Z1 < 81 %, Z2 81–89 %, Z3 90–93 %, Z4 94–99 %, Z5 ≥ 100 % de la FC au seuil), plus justes que des pourcentages de la FC max. */
  const DEFAUT_FC = ZONES_FC.map((z) => z.max), FRIEL = [0.81, 0.89, 0.93, 0.99];
  function zonesFc() {
    const info = $("info-zones-fc");
    let pic = null, seuil = null, quand = null;
    for (const h of historique) {
      if (h.fcPic && (!pic || h.fcPic > pic)) pic = h.fcPic;
      if (h.fc20 && h.id >= Date.now() - 182 * JOUR && (!seuil || h.fc20 > seuil)) { seuil = h.fc20; quand = h.id; }
    }
    if (!$("zones-fc-auto").checked) {
      ZONES_FC.forEach((z, i) => { z.max = DEFAUT_FC[i]; });
      info.textContent = "Zones en pourcentage de ta FC max (60, 70, 80, 90 %).";
      return;
    }
    if (pic && pic > fcmax() && pic <= 225) {
      $("fcmax").value = String(pic); sauverReglages();
      log("FC max relevée à " + pic + " bpm : c'est la plus haute fréquence cardiaque tenue 10 s dans tes séances.");
    }
    if (seuil && seuil < fcmax()) {
      FRIEL.forEach((f, i) => { ZONES_FC[i].max = f * seuil / fcmax(); });
      ZONES_FC[4].max = Infinity;
      info.textContent = "Zones calculées : FC au seuil " + seuil + " bpm (ton effort de 20 min le plus fort, le " + new Date(quand).toLocaleDateString("fr-FR") + ")" +
        (pic ? ", FC max observée " + pic + " bpm" : "") + ". Z2 endurance : " + Math.round(0.81 * seuil) + " à " + Math.round(0.89 * seuil) + " bpm.";
    } else {
      ZONES_FC.forEach((z, i) => { z.max = DEFAUT_FC[i]; });
      info.textContent = (pic ? "FC max observée : " + pic + " bpm. " : "") + "Pour calculer ta FC au seuil, il faut un effort d’au moins 20 min à 88 % de ton FTP ou plus avec la ceinture cardio (un test FTP de 20 min, par exemple). En attendant : zones en pourcentage de la FC max.";
    }
  }

  /* ---------- Bilans de la semaine et du mois ---------- */
  function totaux(liste) {
    const t = { n: 0, km: 0, s: 0, dplus: 0, tss: 0 };
    for (const h of liste) { t.n++; t.km += h.distance / 1000; t.s += h.n; t.dplus += h.dplus; t.tss += h.tss || 0; }
    return t;
  }
  function rendreBilans() {
    const auj = new Date(), lundi = new Date(auj); lundi.setHours(0, 0, 0, 0); lundi.setDate(lundi.getDate() - (lundi.getDay() + 6) % 7);
    const lundiP = new Date(lundi); lundiP.setDate(lundiP.getDate() - 7);
    const mois = new Date(auj.getFullYear(), auj.getMonth(), 1), moisP = new Date(auj.getFullYear(), auj.getMonth() - 1, 1);
    const entre = (a, b) => historique.filter((h) => h.id >= a.getTime() && h.id < b.getTime());
    // période précédente jusqu'au même jour (comparaison juste en milieu de semaine ou de mois)
    const memeJour = (deb, debP) => new Date(debP.getTime() + (auj.getTime() - deb.getTime()));
    const per = [
      ["Cette semaine", totaux(entre(lundi, new Date(lundi.getTime() + 7 * JOUR))), totaux(entre(lundiP, memeJour(lundi, lundiP))), "la semaine dernière à la même heure", totaux(entre(lundiP, lundi))],
      [auj.toLocaleDateString("fr-FR", { month: "long" }).replace(/^./, (c) => c.toUpperCase()), totaux(entre(mois, new Date(auj.getFullYear(), auj.getMonth() + 1, 1))), totaux(entre(moisP, new Date(Math.min(memeJour(mois, moisP).getTime(), mois.getTime())))), "le mois dernier au même jour", totaux(entre(moisP, mois))]
    ];
    const ec = (a, b, f, u) => { const d = a - b; if (Math.abs(d) < 1e-9) return '<em class="egal">=</em>'; return '<em class="' + (d > 0 ? "plus" : "moins") + '">' + (d > 0 ? "+" : "−") + f(Math.abs(d)) + u + "</em>"; };
    $("bilans").innerHTML = per.map(([nom, a, b, lib, tot]) => '<div class="bilan"><h3>' + nom + "</h3>" +
      '<div class="bl"><span>Sorties</span><b>' + a.n + "</b>" + ec(a.n, b.n, (x) => x, "") + "</div>" +
      '<div class="bl"><span>Distance</span><b>' + fr1(a.km) + " km</b>" + ec(a.km, b.km, fr1, " km") + "</div>" +
      '<div class="bl"><span>Temps</span><b>' + formatDuree(a.s) + "</b>" + ec(a.s, b.s, (x) => formatDuree(x), "") + "</div>" +
      '<div class="bl"><span>Dénivelé</span><b>' + Math.round(a.dplus) + " m</b>" + ec(a.dplus, b.dplus, (x) => Math.round(x), " m") + "</div>" +
      '<div class="bl"><span>Charge (TSS)</span><b>' + Math.round(a.tss) + "</b>" + ec(a.tss, b.tss, (x) => Math.round(x), "") + "</div>" +
      '<div class="stats">Écarts par rapport à ' + lib + " (en tout : " + tot.n + " sortie" + (tot.n > 1 ? "s" : "") + ", " + fr1(tot.km) + " km).</div></div>").join("");
    dessinerMois();
  }
  function dessinerMois() {
    const c = $("graph-mois"), dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
    if (!w) return;
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const x = c.getContext("2d");
    x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
    const auj = new Date(), mois = [];
    for (let k = 11; k >= 0; k--) {
      const a = new Date(auj.getFullYear(), auj.getMonth() - k, 1), b = new Date(auj.getFullYear(), auj.getMonth() - k + 1, 1);
      mois.push({ a, km: historique.filter((hh) => hh.id >= a.getTime() && hh.id < b.getTime()).reduce((s, hh) => s + hh.distance / 1000, 0) });
    }
    const max = Math.max(20, ...mois.map((m) => m.km)), bw = w / 12, bas = h - 18;
    x.font = "11px sans-serif"; x.textAlign = "center";
    mois.forEach((m, k) => {
      const hh = m.km / max * (bas - 14);
      x.fillStyle = k === 11 ? "#FF8A4C" : "rgba(74,168,255,.6)";
      x.fillRect(k * bw + bw * 0.2, bas - hh, bw * 0.6, hh);
      if (m.km > 0) { x.fillStyle = "rgba(255,255,255,.75)"; x.fillText(Math.round(m.km), k * bw + bw / 2, bas - hh - 3); }
      x.fillStyle = "rgba(255,255,255,.45)"; x.fillText(m.a.toLocaleDateString("fr-FR", { month: "short" }).replace(".", ""), k * bw + bw / 2, h - 4);
    });
  }

  function rendre() {
    try { zonesFc(); } catch (e) { /* ne bloque pas l'historique */ }
    if ($("onglet-historique").hidden) return;
    try { rendreBilans(); rendreCourbe(); } catch (e) { log("Analyse de l’historique impossible : " + e.message); }
    rattraper();
  }
  $("courbe-periode").addEventListener("change", rendreCourbe);
  $("zones-fc-auto").addEventListener("change", () => { sauverReglages(); rendre(); majStats(); });
  $("fcmax").addEventListener("change", () => { try { zonesFc(); } catch (e) { /* rien */ } });
  $("tab-historique").addEventListener("click", () => setTimeout(rendre, 0));
  window.addEventListener("resize", () => { if (!$("onglet-historique").hidden) { dessinerMois(); rendreCourbe(); } });
  return { completer, rendre, DUREES };
})();
