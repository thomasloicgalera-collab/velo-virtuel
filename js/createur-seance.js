"use strict";
/* =====================================================================
   (v69 suite) Créateur de séances (onglet Séances) : blocs à puissance fixe, rampes
   et répétitions ; enregistrées avec les séances importées (« Mes séances »),
   donc proposées aussi sur la page d'accueil
   ===================================================================== */
const Createur = (function () {
  // lignes : { t: "bloc", min, pct } | { t: "rampe", min, pct, fin } | { t: "rep", n, a: { min, pct }, b: { min, pct } }
  let lignes = [];
  const MODELES = {
    echauf: () => ({ t: "rampe", min: 10, pct: 45, fin: 70 }),
    bloc: () => ({ t: "bloc", min: 10, pct: 75 }),
    rampe: () => ({ t: "rampe", min: 8, pct: 60, fin: 90 }),
    rep: () => ({ t: "rep", n: 3, a: { min: 8, pct: 105 }, b: { min: 4, pct: 55 } }),
    calme: () => ({ t: "rampe", min: 10, pct: 60, fin: 40 })
  };
  const num = (v, a, b, def) => { const x = parseFloat(String(v).replace(",", ".")); return Number.isFinite(x) ? borner(x, a, b) : def; };
  function blocs() {
    const l = [];
    for (const x of lignes) {
      if (x.t === "bloc") l.push([x.min, x.pct]);
      else if (x.t === "rampe") l.push([x.min, x.pct, x.fin]);
      else for (let i = 0; i < x.n; i++) { l.push([x.a.min, x.a.pct]); if (x.b.min > 0) l.push([x.b.min, x.b.pct]); }
    }
    return l;
  }
  const intervalles = () => blocsVersIntervalles(blocs());
  const champ = (val, k, min, max, pas, larg) => '<input type="number" data-k="' + k + '" value="' + val + '" min="' + min + '" max="' + max + '" step="' + pas + '" style="width:' + (larg || 4.6) + 'em">';
  const watts = (pct) => '<small class="crea-w">' + Math.round(pct * ftp() / 100) + "&nbsp;W</small>";
  function rendre() {
    const c = $("crea-lignes");
    c.innerHTML = lignes.map((x, i) => {
      let h = '<div class="crea-l" data-i="' + i + '"><span class="crea-n">' + (i + 1) + "</span>";
      if (x.t === "bloc") h += "<b>Bloc</b> " + champ(x.min, "min", 0.25, 240, 0.25) + " min à " + champ(x.pct, "pct", 20, 300, 1) + " % du FTP " + watts(x.pct);
      else if (x.t === "rampe") h += "<b>Rampe</b> " + champ(x.min, "min", 0.25, 240, 0.25) + " min de " + champ(x.pct, "pct", 20, 300, 1) + " % à " + champ(x.fin, "fin", 20, 300, 1) + " % " + watts(x.pct) + "→" + watts(x.fin);
      else h += "<b>Répéter</b> " + champ(x.n, "n", 1, 40, 1, 3.6) + " × ( " + champ(x.a.min, "a.min", 0.25, 60, 0.25) + " min à " + champ(x.a.pct, "a.pct", 20, 300, 1) + " % " + watts(x.a.pct) +
        ", puis " + champ(x.b.min, "b.min", 0, 60, 0.25) + " min à " + champ(x.b.pct, "b.pct", 20, 300, 1) + " % " + watts(x.b.pct) + " )";
      h += '<span class="crea-act"><button type="button" class="petit" data-act="haut" title="Monter">↑</button><button type="button" class="petit" data-act="copie" title="Dupliquer">⧉</button><button type="button" class="petit" data-act="suppr" title="Retirer">✕</button></span></div>';
      return h;
    }).join("") || '<div class="info">Aucun bloc : ajoute un échauffement, puis tes efforts, puis un retour au calme.</div>';
    apercu();
  }
  function apercu() {
    const ints = intervalles(), st = statsSeance(ints);
    $("crea-stats").textContent = ints.length ? "Durée " + formatDuree(Math.round(st.sec)) + " · intensité " + fr2(st.IF) + " · TSS ≈ " + Math.round(st.tss) : "";
    requestAnimationFrame(() => dessinerBlocs($("crea-profil"), ints));
  }
  // saisie dans un champ : la ligne est mise à jour sans tout redessiner (le curseur reste dans le champ)
  $("crea-lignes").addEventListener("input", (e) => {
    const inp = e.target.closest("input[data-k]"), l = e.target.closest(".crea-l");
    if (!inp || !l) return;
    const x = lignes[parseInt(l.dataset.i, 10)], k = inp.dataset.k;
    const lim = { min: [0.25, 240, 1], pct: [20, 300, 50], fin: [20, 300, 50], n: [1, 40, 1], "a.min": [0.25, 60, 1], "a.pct": [20, 300, 50], "b.min": [0, 60, 0], "b.pct": [20, 300, 50] }[k];
    const v = num(inp.value, lim[0], lim[1], lim[2]);
    if (k.indexOf(".") > 0) { const [o, p] = k.split("."); x[o][p] = v; } else x[k] = k === "n" ? Math.round(v) : v;
    const w = l.querySelectorAll(".crea-w");               // watts affichés à côté des pourcentages
    const pcts = x.t === "bloc" ? [x.pct] : x.t === "rampe" ? [x.pct, x.fin] : [x.a.pct, x.b.pct];
    w.forEach((el, j) => { if (pcts[j] !== undefined) el.innerHTML = Math.round(pcts[j] * ftp() / 100) + "&nbsp;W"; });
    apercu();
  });
  $("crea-lignes").addEventListener("change", rendre);
  $("crea-lignes").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-act]"), l = e.target.closest(".crea-l");
    if (!b || !l) return;
    const i = parseInt(l.dataset.i, 10);
    if (b.dataset.act === "suppr") lignes.splice(i, 1);
    else if (b.dataset.act === "copie") lignes.splice(i + 1, 0, JSON.parse(JSON.stringify(lignes[i])));
    else if (b.dataset.act === "haut" && i > 0) { const x = lignes[i]; lignes[i] = lignes[i - 1]; lignes[i - 1] = x; }
    rendre();
  });
  document.querySelectorAll("[data-crea]").forEach((b) => b.addEventListener("click", () => {
    const m = MODELES[b.dataset.crea]();
    if (b.dataset.crea === "echauf") lignes.unshift(m); else lignes.push(m);
    rendre();
  }));
  $("crea-vider").addEventListener("click", () => { if (!lignes.length || confirm("Effacer tous les blocs de la séance en création ?")) { lignes = []; $("crea-nom").value = ""; $("crea-msg").textContent = ""; rendre(); } });
  function enregistrer() {
    const ints = intervalles();
    if (!ints.length) { $("crea-msg").textContent = "Ajoute au moins un bloc."; return null; }
    let nom = $("crea-nom").value.trim().slice(0, 40);
    if (!nom) { let k = 1; while (seancesImportees.some((s) => s.nom === "Ma séance " + k)) k++; nom = "Ma séance " + k; $("crea-nom").value = nom; }
    seancesImportees = seancesImportees.filter((s) => s.nom !== nom);      // même nom : la nouvelle version remplace l'ancienne
    seancesImportees.unshift({ nom, ints, textes: [], cree: JSON.parse(JSON.stringify(lignes)) });
    seancesImportees = seancesImportees.slice(0, 40);
    sauverImportees(); rendreBiblio();
    $("crea-msg").textContent = "« " + nom + " » enregistrée (" + formatDuree(Math.round(statsSeance(ints).sec)) + ").";
    log("Séance créée : " + nom + ".");
    return { nom, ints };
  }
  $("crea-enreg").addEventListener("click", enregistrer);
  $("crea-rouler").addEventListener("click", () => {
    const s = enregistrer();
    if (!s) return;
    chargerSeance(s.ints, false, s.nom, []);
    majChoixSeanceMonde();
    $("seance-monde").value = "imp:" + s.nom; majResumeChoixSeance();
    afficherOnglet("world");
    if ($("world-choix").hidden && !session.samples.length) $("btn-changer-monde").click();
  });
  // « Modifier » sur une séance créée : elle revient dans le créateur
  function modifier(s) {
    lignes = JSON.parse(JSON.stringify(s.cree || []));
    $("crea-nom").value = s.nom; $("crea-msg").textContent = "Tu modifies « " + s.nom + " » : « Enregistrer » remplace l’ancienne version.";
    rendre();
    $("createur").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  rendre();
  window.addEventListener("resize", () => { if (!$("onglet-seance").hidden) apercu(); });
  $("tab-seance").addEventListener("click", () => setTimeout(apercu, 0));
  return { modifier };
})();
