"use strict";
/* (v78) HUD personnalisable : barre de commandes flottante qui s'efface, 4 encarts au choix sous la puissance,
   et panneau « Affichage à l'écran » (masqué / sombre / clair pour chaque groupe d'encarts). */
const HudPerso = (() => {
  const CLE = "velo_hud_v1";
  const GROUPES = ["puissance", "bandeau", "carte", "classement", "intervalles"];
  const DEFAUT = { enc: ["cad", "cmoy", "fc", "fcmoy"], modes: { puissance: "clair", bandeau: "sombre", carte: "sombre", classement: "sombre", intervalles: "sombre" } };
  let cfg = JSON.parse(JSON.stringify(DEFAUT));
  try { const r = JSON.parse(localStorage.getItem(CLE) || "null"); if (r) { if (Array.isArray(r.enc)) cfg.enc = r.enc.slice(0, 4); Object.assign(cfg.modes, r.modes || {}); } } catch (e) { /* réglages ignorés */ }
  const sauver = () => { try { localStorage.setItem(CLE, JSON.stringify(cfg)); } catch (e) { /* plein */ } };

  // moyennes et maximum calculés sur les échantillons de la sortie (un par seconde), au fil de l'eau
  let St = { arr: null, n: 0, sv: 0, nr: 0, vmax: 0, sc: 0, nc: 0, sh: 0, nh: 0 };
  function cumuler() {
    const s = session.samples;
    if (St.arr !== s || s.length < St.n) St = { arr: s, n: 0, sv: 0, nr: 0, vmax: 0, sc: 0, nc: 0, sh: 0, nh: 0 };
    for (; St.n < s.length; St.n++) {
      const e = s[St.n];
      if ((e.v || 0) > 0.5) { St.sv += e.v; St.nr++; if (e.v > St.vmax) St.vmax = e.v; }
      if ((e.c || 0) > 0) { St.sc += e.c; St.nc++; }
      if ((e.hr || 0) > 0) { St.sh += e.hr; St.nh++; }
    }
  }
  const kmh = (v) => fr1(v * 3.6);
  const METRIQUES = {
    vit:   { nom: "Vitesse", court: "KM/H", val: () => kmh(balade.vitesse) },
    vmoy:  { nom: "Vitesse moyenne", court: "KM/H MOY", val: () => kmh(St.nr ? St.sv / St.nr : 0) },
    vmax:  { nom: "Vitesse maximale", court: "KM/H MAX", val: () => kmh(St.vmax) },
    dpart: { nom: "Distance partielle (tour en cours)", court: "KM TOUR", val: () => { const L = route.longueur; return fr2((route.boucle && L > 0 ? balade.distance % L : balade.distance - (balade.d0 || 0)) / 1000); } },
    dtot:  { nom: "Distance totale (sortie)", court: "KM TOTAL", val: () => fr2((balade.distance - (balade.d0 || 0)) / 1000) },
    duree: { nom: "Durée de roulage", court: "ROULAGE", val: () => formatDuree(St.nr) },
    cad:   { nom: "Cadence", court: "RPM", val: () => (balade.cadence > 0 ? Math.round(balade.cadence) : "–") },
    cmoy:  { nom: "Cadence moyenne", court: "RPM MOY", val: () => (St.nc ? Math.round(St.sc / St.nc) : "–") },
    deniv: { nom: "Dénivelé positif", court: "D+ (M)", val: () => Math.round(dernierDeniv) },
    alt:   { nom: "Altitude", court: "ALT (M)", val: () => Math.round(balade.altitude || 0) },
    fc:    { nom: "Fréquence cardiaque", court: "BPM", val: (fc) => (fc !== null && fc !== undefined ? fc : "–") },
    fcmoy: { nom: "Fréquence cardiaque moyenne", court: "BPM MOY", val: () => (St.nh ? Math.round(St.sh / St.nh) : "–") }
  };
  const ordre = Object.keys(METRIQUES);

  function options(sel, courant) {
    sel.innerHTML = ordre.map((k) => '<option value="' + k + '"' + (k === courant ? " selected" : "") + ">" + METRIQUES[k].nom + "</option>").join("");
  }
  function construireEncarts() {
    dernierRendu = [];                 // les cases sont refaites : on réécrit toutes les valeurs
    const g = $("enc-grille"); g.innerHTML = "";
    cfg.enc.forEach((k, i) => {
      if (!METRIQUES[k]) k = cfg.enc[i] = DEFAUT.enc[i];
      const d = document.createElement("label"); d.className = "enc"; d.title = "Cliquer pour changer la mesure";
      d.innerHTML = '<span class="enc-l"></span><b class="enc-v">–</b><select class="enc-s" aria-label="Mesure de l’encart ' + (i + 1) + '"></select>';
      options(d.querySelector("select"), k);
      d.querySelector("select").addEventListener("change", (e) => { cfg.enc[i] = e.target.value; sauver(); majPanneauEncarts(); maj(dernierFc); });
      g.appendChild(d);
    });
    const p = $("ph-encarts"); p.innerHTML = "";
    cfg.enc.forEach((k, i) => {
      const l = document.createElement("label"); l.innerHTML = "Encart " + (i + 1) + " <select></select>";
      options(l.querySelector("select"), k);
      l.querySelector("select").addEventListener("change", (e) => { cfg.enc[i] = e.target.value; sauver(); construireEncartsSeuls(); maj(dernierFc); });
      p.appendChild(l);
    });
  }
  function construireEncartsSeuls() { const a = document.activeElement; construireEncarts(); if (a && a.blur) a.blur(); }
  function majPanneauEncarts() { const sels = $("ph-encarts").querySelectorAll("select"); cfg.enc.forEach((k, i) => { if (sels[i]) sels[i].value = k; }); }

  let dernierFc = null, dernierRendu = [];
  function maj(fc) {
    dernierFc = fc;
    cumuler();
    const cases = $("enc-grille").children;
    cfg.enc.forEach((k, i) => {
      const m = METRIQUES[k]; if (!m || !cases[i]) return;
      const txt = String(m.val(fc));
      if (dernierRendu[i] !== k + "|" + txt) {
        dernierRendu[i] = k + "|" + txt;
        cases[i].querySelector(".enc-l").textContent = m.court; cases[i].querySelector(".enc-v").textContent = txt;
        const sel = cases[i].querySelector("select"); if (sel.value !== k) sel.value = k;
      }
    });
  }

  // groupes d'encarts : masqué / sombre / clair
  const NOMS_MODE = { masque: "masqué", sombre: "sombre", clair: "clair" }, SUIVANT = { masque: "sombre", sombre: "clair", clair: "masque" };
  function appliquerModes() {
    const z = $("hud-zone");
    for (const g of GROUPES) z.setAttribute("data-hud-" + g, cfg.modes[g] || "sombre");
    document.querySelectorAll("#panneau-hud .ph-zone").forEach((b) => {
      const m = cfg.modes[b.dataset.g] || "sombre";
      b.dataset.m = m; b.querySelector("em").textContent = NOMS_MODE[m];
    });
  }
  document.querySelectorAll("#panneau-hud .ph-zone").forEach((b) => b.addEventListener("click", () => {
    const g = b.dataset.g; cfg.modes[g] = SUIVANT[cfg.modes[g] || "sombre"]; sauver(); appliquerModes();
  }));
  $("ph-tout").addEventListener("click", () => { for (const g of GROUPES) if (cfg.modes[g] === "masque") cfg.modes[g] = "sombre"; sauver(); appliquerModes(); });
  $("ph-rien").addEventListener("click", () => { for (const g of GROUPES) cfg.modes[g] = "masque"; sauver(); appliquerModes(); });

  // panneau et barre flottante
  const panneau = $("panneau-hud"), dock = $("dock-jeu"), zone = $("monde-conteneur");
  function basculerPanneau(v) { panneau.hidden = v === undefined ? !panneau.hidden : !v; $("btn-hud").classList.toggle("on", !panneau.hidden); reveiller(); }
  $("btn-hud").addEventListener("click", () => basculerPanneau());
  $("ph-fermer").addEventListener("click", () => basculerPanneau(false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panneau.hidden) basculerPanneau(false); });
  let fin = Date.now() + 5000, survol = false;
  function reveiller() { fin = Date.now() + 4000; dock.classList.remove("cache"); }
  zone.addEventListener("mousemove", reveiller);
  zone.addEventListener("mousedown", reveiller);
  zone.addEventListener("touchstart", reveiller, { passive: true });
  document.addEventListener("keydown", () => { if (!$("world-jeu").hidden) reveiller(); });
  dock.addEventListener("mouseenter", () => { survol = true; });
  dock.addEventListener("mouseleave", () => { survol = false; reveiller(); });
  let etaitCache = true;
  setInterval(() => {
    const visible = !$("world-jeu").hidden && !$("onglet-world").hidden;
    if (visible && etaitCache) reveiller();             // on vient d'entrer dans la vue 3D : la barre apparaît quelques secondes
    etaitCache = !visible;
    const actif = document.activeElement, ouvert = actif && actif.tagName === "SELECT" && dock.contains(actif);
    if (!survol && !ouvert && panneau.hidden && Date.now() > fin) dock.classList.add("cache");
  }, 300);

  construireEncarts(); appliquerModes();
  return { maj, basculerPanneau, reveiller };
})();
