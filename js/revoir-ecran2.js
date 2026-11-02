"use strict";
/* =====================================================================
   (v69 suite) Revoir une sortie enregistrée en 3D (bouton dans le détail d'une séance
   de l'historique) et deuxième écran (tableau de bord dans une autre fenêtre)
   ===================================================================== */

/* ---------- Revoir une sortie : ta position (et celle des autres coureurs, si elle a été gardée) seconde par seconde ---------- */
const Revoir = (function () {
  const R = { actif: false, s: null, res: null, t: 0, x: 4, pause: false, cumul: null, i: 0, glisse: false };
  const lerp = (a, b, f) => a + (b - a) * f;
  function lancer(res, samples) {
    if (session.samples.length) { alert("Termine ou abandonne d’abord la sortie en cours pour revoir celle-ci."); return; }
    const m = MONDES.find((x) => x.id === res.mondeId);
    if (!m || !samples || samples.length < 2) return;
    // dénivelé cumulé, pour l'afficher comme pendant la sortie
    R.cumul = [0];
    for (let i = 1; i < samples.length; i++) R.cumul.push(R.cumul[i - 1] + Math.max(0, (samples[i].alt || 0) - (samples[i - 1].alt || 0)));
    Object.assign(R, { actif: true, s: samples, res, t: 0, x: 4, pause: false, i: 0 });
    afficherOnglet("world");
    entrerMonde(m.id, document.createElement("div"));
    balade.d0 = res.d0 || 0; balade.enCours = false; balade.auto = false; balade.temps = 0;
    balade.distance = balade.d0 + (samples[0].d || 0);
    $("world-jeu").classList.add("revoir"); $("revoir-barre").hidden = false;
    majBoutons();
    log("Revoir la sortie du " + new Date(res.id).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }) + ".");
  }
  function arreter() {
    if (!R.actif) return;
    R.actif = false; R.s = null;
    $("world-jeu").classList.remove("revoir"); $("revoir-barre").hidden = true;
    balade.d0 = 0;
    reinitialiserSeance();
    $("world-jeu").hidden = true; $("world-choix").hidden = false;
    rendreTuilesMondes();
    afficherOnglet("historique");
  }
  // une image : on avance dans l'enregistrement et on renvoie ce qu'il faut dessiner (et l'écran suit : HUD, carte, profil)
  function image(dt) {
    const s = R.s, n = s.length;
    if (!R.pause && !R.glisse) R.t = Math.min(n - 1, R.t + dt * R.x);
    if (R.t >= n - 1 && !R.pause) { R.pause = true; majBoutons(); }
    const i = Math.min(n - 2, Math.floor(R.t)), f = Math.min(1, R.t - i), a = s[i], b = s[i + 1], d0 = R.res.d0 || 0;
    R.i = i;
    const v = lerp(a.v || 0, b.v || 0, f);
    balade.distance = d0 + lerp(a.d || 0, b.d || 0, f); balade.vitesse = v; balade.cadence = a.c; balade.temps = R.t;
    balade.altitude = lerp(a.alt || 0, b.alt || 0, f); balade.ratio = (a.p || 0) / ftp();
    dernierDeniv = R.cumul[i];
    let peloton = null;
    if (R.res.peloton && a.pl && b.pl) {
      peloton = R.res.peloton.map((c, k) => {
        const da = a.pl[k], db = b.pl[k];
        if (da === undefined || db === undefined) return null;
        const d = d0 + lerp(da, db, f), vv = Math.max(0, db - da);
        return { d, v: R.pause ? 0 : vv, cad: vv > 1 && !R.pause ? 85 : 0, voie: c.voie !== undefined ? c.voie : 0.3 + 0.2 * (k % 7), ratio: 0.8, pente: penteA(d) / 100, clm: false, grp: 0, velo: c.velo, roues: c.roues };
      });
    }
    if (!R.glisse) $("revoir-pos").value = String(Math.round(R.t / (n - 1) * 1000));
    const txt = formatDuree(R.t) + " / " + formatDuree(n - 1);
    if ($("revoir-t").textContent !== txt) $("revoir-t").textContent = txt;
    return { d: balade.distance, v: R.pause ? 0 : v, c: R.pause ? 0 : a.c, ratio: R.pause ? 0 : balade.ratio, peloton };
  }
  // les autres coureurs : décrits au début (monde 3D), placés à chaque image
  const liste3D = () => (R.res && R.res.peloton ? R.res.peloton.map((c) => ({ couleur: c.couleur, ampleur: (Peloton.TYPES.find((t) => t.id === c.id) || { ampleur: 1 }).ampleur, nom: c.nom, id: c.id, femme: c.femme, look: c.look })) : []);
  function coureursCarte() {
    if (!R.actif || !R.res.peloton) return [];
    const a = R.s[R.i];
    return a && a.pl ? R.res.peloton.map((c, k) => ({ d: (R.res.d0 || 0) + (a.pl[k] || 0), couleur: c.couleur })) : [];
  }
  function majBoutons() {
    $("revoir-lecture").textContent = R.pause ? "▶" : "⏸";
    document.querySelectorAll(".revoir-vit button").forEach((b) => b.classList.toggle("choisi", parseFloat(b.dataset.x) === R.x));
  }
  function basculer() {
    if (!R.actif) return;
    if (R.pause && R.t >= R.s.length - 1) R.t = 0;              // à la fin : on recommence
    R.pause = !R.pause; majBoutons();
  }
  $("revoir-lecture").addEventListener("click", basculer);
  document.querySelectorAll(".revoir-vit button").forEach((b) => b.addEventListener("click", () => { R.x = parseFloat(b.dataset.x); majBoutons(); }));
  $("revoir-pos").addEventListener("input", () => { if (!R.actif) return; R.glisse = true; R.t = parseInt($("revoir-pos").value, 10) / 1000 * (R.s.length - 1); });
  $("revoir-pos").addEventListener("change", () => { R.glisse = false; });
  $("revoir-quitter").addEventListener("click", arreter);
  $("btn-detail-revoir").addEventListener("click", () => { if (detail) lancer(detail.resume, detail.samples); });
  return {
    get actif() { return R.actif; }, lancer, arreter, image, liste3D, coureursCarte, basculer,
    puissance: () => (R.s && R.s[R.i] ? R.s[R.i].p : null), fc: () => (R.s && R.s[R.i] ? R.s[R.i].hr : null)
  };
})();

/* ---------- Deuxième écran : tableau de bord dans une autre fenêtre (à glisser sur un autre écran ou une télé branchée à l'ordinateur) ----------
   La fenêtre est vide au départ (même page) : on y écrit le tableau de bord, puis on recopie les valeurs et les dessins du HUD 4 fois par seconde.
   Une tablette ne peut pas s'y connecter : l'application tourne dans un seul navigateur, sans serveur. */
const Ecran2 = (function () {
  let w = null, cache = false;
  const TUILES = [["hz-w", "Puissance", "W"], ["hz-fc", "Fréquence cardiaque", "bpm"], ["hz-cad", "Cadence", "tr/min"], ["hz-vit", "Vitesse", "km/h"],
    ["hz-temps", "Temps", ""], ["hz-dist", "Distance", "km"], ["hz-deniv", "Dénivelé", "m D+"], ["hz-pente", "Pente", ""]];
  const CANVAS = [["hz-profil-c", "profil"], ["hz-carte-c", "carte"], ["hz-spark", "spark"]];
  const HTML = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Vélo virtuel · tableau de bord</title><style>' +
    "html,body{margin:0;height:100%;background:#0d131c;color:#fff;font-family:system-ui,-apple-system,Segoe UI,sans-serif}" +
    "body{display:grid;grid-template-columns:1fr 22em;grid-template-rows:auto auto 1fr auto;gap:12px;padding:14px;box-sizing:border-box}" +
    ".tuiles{grid-column:1/3;display:grid;grid-template-columns:repeat(4,1fr);gap:12px}" +
    ".t{background:#18212d;border-radius:14px;padding:10px 14px;border-top:4px solid #2a3647}.t b{display:block;font-size:clamp(28px,5.2vw,72px);line-height:1.05;font-variant-numeric:tabular-nums}" +
    ".t span{color:#9fb0c4;font-size:14px}.t small{color:#9fb0c4;font-size:16px;margin-left:4px}#zone{display:inline-block;padding:1px 8px;border-radius:6px;font-weight:700;margin-left:8px;color:#111;font-size:16px;vertical-align:middle}" +
    ".bloc{background:#18212d;border-radius:14px;padding:10px}.bloc canvas{width:100%;height:auto;display:block}#spark{height:72px!important}#cible{font-size:22px;color:#ffb45e;min-height:1.2em}" +
    "#annonce{grid-column:1/2;font-size:24px;font-weight:700;text-align:center;color:#ffd84a;min-height:1.3em}" +
    ".droite{grid-row:3/5;grid-column:2;display:flex;flex-direction:column;gap:12px;overflow:auto}" +
    "#peloton .pl{display:flex;gap:6px;align-items:center;padding:3px 0;font-size:16px}#peloton .pl i{width:12px;height:12px;border-radius:3px;display:inline-block}#peloton .pl b{flex:1;font-weight:600}#peloton .pl em{font-style:normal;color:#c3cdd9}#peloton .pl.moi{color:#ff9a4f}#peloton .sb{display:none}#peloton .tt,#seg .tt{color:#9fb0c4;font-size:13px;margin-bottom:4px}" +
    ".mj{display:inline-block;width:11px;height:11px;border-radius:2px;margin-right:4px;vertical-align:-1px}.mj.jaune{background:#ffd800}.mj.pois{background:radial-gradient(circle,#e3262e 30%,#fff 34%) 0 0/5px 5px;border:1px solid #ddd}" +
    ".barre{grid-column:1/3;display:flex;gap:16px;align-items:center;color:#9fb0c4;font-size:14px}button{background:#24303f;color:#fff;border:0;border-radius:8px;padding:6px 12px;font-size:14px;cursor:pointer}" +
    "@media (max-width:900px){body{grid-template-columns:1fr}.droite{grid-column:1;grid-row:auto}.tuiles{grid-template-columns:repeat(2,1fr)}}" +
    '</style></head><body><div class="tuiles">' +
    TUILES.map(([id, lib, u]) => '<div class="t" id="t-' + id + '"><span>' + lib + (id === "hz-w" ? '<i id="zone"></i>' : "") + "</span><b><i id=\"v-" + id + "\">–</i><small>" + u + "</small></b></div>").join("") +
    '</div><div class="bloc" style="grid-column:1"><div id="cible"></div><canvas id="spark"></canvas></div>' +
    '<div class="bloc" style="grid-column:1;align-self:start"><canvas id="profil"></canvas></div><div id="annonce"></div>' +
    '<div class="droite"><div class="bloc"><canvas id="carte"></canvas></div><div class="bloc" id="peloton"></div><div class="bloc" id="seg"></div></div>' +
    '<div class="barre"><label><input type="checkbox" id="cacher"> Cacher les encarts sur l’écran principal (3D seule)</label><button id="pe">Plein écran</button><span>Glisse cette fenêtre sur ton autre écran (ou ta télé), puis « Plein écran ».</span></div></body></html>';
  function ouvrir() {
    if (w && !w.closed) { w.focus(); return; }
    w = window.open("", "velo-ecran2", "width=1200,height=760");
    if (!w) { alert("Le navigateur a bloqué la deuxième fenêtre : autorise les fenêtres pop-up pour cette page (icône dans la barre d’adresse), puis réessaie."); return; }
    w.document.open(); w.document.write(HTML); w.document.close();
    w.document.getElementById("cacher").checked = cache;
    w.document.getElementById("cacher").addEventListener("change", (e) => { cache = e.target.checked; $("hud-zone").classList.toggle("hud-cache", cache); });
    w.document.getElementById("pe").addEventListener("click", () => { const de = w.document.documentElement; if (w.document.fullscreenElement) w.document.exitFullscreen(); else if (de.requestFullscreen) de.requestFullscreen(); });
    log("Deuxième écran ouvert : glisse la fenêtre sur ton autre écran.");
    maj();
  }
  function maj() {
    if (!w) return;
    if (w.closed) { w = null; if (cache) { cache = false; $("hud-zone").classList.remove("hud-cache"); } return; }
    const D = w.document, set = (el, txt) => { if (el && el.textContent !== txt) el.textContent = txt; };
    for (const [id] of TUILES) set(D.getElementById("v-" + id), $(id).textContent);
    const z = D.getElementById("zone"); set(z, $("hz-zone").textContent); z.style.background = $("hz-zone").style.background || "transparent";
    D.getElementById("t-hz-w").style.borderTopColor = $("hz-puiss").style.borderTopColor || "#2a3647";
    set(D.getElementById("cible"), $("hz-cible").textContent);
    set(D.getElementById("annonce"), $("hz-annonce").hidden ? "" : $("hz-annonce").textContent);
    const pel = $("hz-peloton").hidden ? "" : $("hz-peloton-c").innerHTML, seg = $("hz-segment").hidden ? "" : $("hz-segment-c").innerHTML;
    const P = D.getElementById("peloton"), S = D.getElementById("seg");
    if (P.innerHTML !== pel) P.innerHTML = pel;
    if (S.innerHTML !== seg) S.innerHTML = seg;
    P.style.display = pel ? "" : "none"; S.style.display = seg ? "" : "none";
    for (const [src, dst] of CANVAS) {
      const a = $(src), b = D.getElementById(dst);
      if (!a.width || !a.height) continue;
      if (b.width !== a.width || b.height !== a.height) { b.width = a.width; b.height = a.height; }
      const x = b.getContext("2d"); x.clearRect(0, 0, b.width, b.height); x.drawImage(a, 0, 0);
    }
  }
  $("btn-ecran2").addEventListener("click", ouvrir);
  window.addEventListener("beforeunload", () => { if (w && !w.closed) w.close(); });
  return { ouvrir, maj };
})();
