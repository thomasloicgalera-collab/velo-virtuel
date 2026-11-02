"use strict";
/* =====================================================================
   Accueil : écran de connexion des accessoires au démarrage, page
   d'accueil (type de sortie, choix du monde, « C'est parti ») et
   paysage animé des mondes en fond.
   ===================================================================== */

/* ---------- Paysage animé : une scène low poly par thème de monde, qui défile comme vue d'un vélo ---------- */
const Fond = (function () {
  const W = 1600, H = 900;
  const THEMES = {
    campagne: { nom: "Campagne et collines", ciel: ["#6FAEEA", "#D6EDFF"], soleil: "#FFF6D8", loin: [560, 120, 7, "#9DB9CC"], milieu: [690, 110, 8, "#79A95E"], pres: [790, 60, 6, "#5A9145"], sol: "#4C7F3A", arbre: ["#2F6B33", "#3E8540"], arbres: "rond", route: "#3A3F47" },
    montagne: { nom: "Montagne", ciel: ["#5F9BDA", "#E2F0FF"], soleil: "#FFFFFF", loin: [600, 360, 9, "#8796AD"], milieu: [700, 170, 7, "#5E7F62"], pres: [795, 70, 6, "#456E46"], sol: "#3B5F3C", arbre: ["#1F4A2A", "#2C5E36"], arbres: "sapin", neige: true, route: "#3A3F47" },
    mer: { nom: "Bord de mer", ciel: ["#F2A877", "#FFE5C4"], soleil: "#FFF1D0", loin: [548, 40, 10, "#B6957F"], mer: "#2E7FB0", milieu: [720, 70, 7, "#CDB27E"], pres: [800, 45, 6, "#86AE5C"], sol: "#D9C08A", arbre: ["#3F6E36", "#4F8442"], arbres: "pin", route: "#3A3F47" },
    ardennes: { nom: "Forêt des Ardennes", ciel: ["#8DB3D2", "#E2EAEC"], soleil: "#FFF3DE", loin: [570, 130, 7, "#8C9DA6"], milieu: [690, 130, 8, "#3F6B45"], pres: [790, 60, 6, "#2E5A36"], sol: "#3C6A38", arbre: ["#24503A", "#2F6A3E"], arbres: "sapin", route: "#3A3F47" },
    toscane: { nom: "Collines de Toscane", ciel: ["#E9A86E", "#FBE3BE"], soleil: "#FFF0CF", loin: [560, 110, 7, "#B69B76"], milieu: [690, 100, 8, "#C9B062"], pres: [790, 50, 6, "#9DA450"], sol: "#B3A35A", arbre: ["#2C4A2E", "#35573A"], arbres: "sapin", route: "#3A3F47" },
    ville: { nom: "Ville de nuit", ciel: ["#0E1834", "#3A3552"], soleil: "#DDE6FF", loin: [570, 150, 14, "#252B45"], milieu: [690, 120, 18, "#1D2236"], pres: [790, 50, 8, "#2A2E3A"], sol: "#2E3240", arbre: ["#1E3A2C", "#24452F"], arbres: "rond", route: "#3A3F47" },
    desert: { nom: "Désert", ciel: ["#EFA865", "#FCE4BF"], soleil: "#FFF4DA", loin: [600, 190, 0, "#C47E4C"], milieu: [700, 90, 6, "#DDA466"], pres: [795, 50, 6, "#E8BD84"], sol: "#E2B172", arbre: ["#4F7D3C", "#5E8F47"], arbres: "cactus", mesa: true, route: "#6B5A48" },
    lanzarote: { nom: "Île volcanique (Lanzarote)", ciel: ["#4A92DC", "#DDEDF6"], soleil: "#FFF4D6", loin: [560, 170, 4, "#9A5032"], mer: "#2468A8", milieu: [730, 50, 9, "#5E3A2E"], pres: [800, 40, 7, "#2E2624"], sol: "#3A2A24", arbre: ["#4F8F40", "#5FA04A"], arbres: "palmier", route: "#34383E" },
    kona: { nom: "Île volcanique (Kona)", ciel: ["#3D8EE0", "#D8EEF8"], soleil: "#FFF6DC", loin: [560, 150, 3, "#6E625A"], mer: "#1F6FA8", milieu: [730, 50, 9, "#3A3532"], pres: [800, 40, 7, "#B89B57"], sol: "#2E2A27", arbre: ["#3F8A3A", "#56A046"], arbres: "palmier", route: "#34383E" }
  };
  const ORDRE = Object.keys(THEMES);

  function alea(graine) {   // nombres pseudo-aléatoires reproductibles (même paysage à chaque visite)
    return function () {
      graine = graine + 0x6D2B79F5 | 0;
      let t = Math.imul(graine ^ graine >>> 15, 1 | graine);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  // ligne de crête périodique (le dernier point a la même hauteur que le premier, pour un défilement sans couture)
  function crete(rnd, base, amp, n) {
    const p = [];
    for (let i = 0; i < n; i++) p.push([i * W / n, base - amp * (0.25 + 0.75 * rnd())]);
    p.push([W, p[0][1]]);
    return p;
  }
  // plateaux à bords raides (mesas du désert)
  function mesas(rnd, base, amp) {
    const p = [[0, base]];
    let x = 0;
    while (x < W - 260) {
      x += 60 + rnd() * 140; p.push([x, base]);
      const haut = base - amp * (0.5 + 0.5 * rnd());
      x += 25 + rnd() * 20; p.push([x, haut]);
      x += 90 + rnd() * 200; p.push([x, haut]);
      x += 25 + rnd() * 20; p.push([x, base]);
    }
    p.push([W, base]);
    return p;
  }
  function hauteurA(p, x) {
    for (let i = 1; i < p.length; i++) if (x <= p[i][0]) { const a = p[i - 1], b = p[i], t = (x - a[0]) / (b[0] - a[0] || 1); return a[1] + (b[1] - a[1]) * t; }
    return p[p.length - 1][1];
  }
  const pts = (p, dx) => p.map((q) => (q[0] + dx).toFixed(1) + "," + q[1].toFixed(1)).join(" ");
  const relief = (p, couleur) => [-W, 0, W].map((dx) => '<polygon fill="' + couleur + '" points="' + pts(p, dx) + " " + (W + dx) + "," + H + " " + dx + "," + H + '"/>').join("");
  const triple = (svg) => [-W, 0, W].map((dx) => '<g transform="translate(' + dx + ' 0)">' + svg + "</g>").join("");
  const couche = (duree, contenu) => '<g class="couche" style="animation-duration:' + duree + 's">' + contenu + "</g>";

  function neige(p, base, amp) {
    let s = "";
    for (let i = 1; i < p.length - 1; i++) {
      const [x, y] = p[i];
      if (y > base - amp * 0.62 || y > p[i - 1][1] || y > p[i + 1][1]) continue;
      const g = [x + (p[i - 1][0] - x) * 0.3, y + (p[i - 1][1] - y) * 0.3], d = [x + (p[i + 1][0] - x) * 0.3, y + (p[i + 1][1] - y) * 0.3];
      // calotte de neige : le sommet, ses deux flancs, et un bord inférieur en dents de scie
      const bas = (g[1] + d[1]) / 2;
      s += '<polygon fill="#F4F8FC" points="' + [g, [x, y], d, [x + (d[0] - x) * 0.45, bas - 10], [x, bas + 6], [x + (g[0] - x) * 0.45, bas - 10]].map((q) => q[0].toFixed(1) + "," + q[1].toFixed(1)).join(" ") + '"/>';
    }
    return triple(s);
  }
  function arbre(type, x, y, s, c) {
    if (type === "sapin") return '<polygon fill="' + c[0] + '" points="' + [x - s * .42, y, x, y - s * 1.25, x + s * .42, y].join(",") + '"/><polygon fill="' + c[1] + '" points="' + [x - s * .3, y - s * .5, x, y - s * 1.6, x + s * .3, y - s * .5].join(",") + '"/>';
    if (type === "pin") return '<rect fill="#6B4E36" x="' + (x - s * .06) + '" y="' + (y - s) + '" width="' + s * .12 + '" height="' + s + '"/><ellipse fill="' + c[0] + '" cx="' + x + '" cy="' + (y - s) + '" rx="' + s * .65 + '" ry="' + s * .22 + '"/><ellipse fill="' + c[1] + '" cx="' + (x - s * .1) + '" cy="' + (y - s * 1.08) + '" rx="' + s * .4 + '" ry="' + s * .13 + '"/>';
    if (type === "palmier") {             // tronc courbe et palmes en éventail
      let p = '<path fill="none" stroke="#7A6248" stroke-width="' + (s * .1).toFixed(1) + '" stroke-linecap="round" d="M' + x + " " + y + "q" + (s * .25) + " " + (-s * .6) + " " + (s * .1) + " " + (-s * 1.3) + '"/>';
      for (let k = 0; k < 7; k++) {
        const a = -Math.PI + k * Math.PI / 6, hx = x + s * .1, hy = y - s * 1.3, ex = hx + Math.cos(a) * s * .6, ey = hy + Math.sin(a) * s * .35 + s * .12 * Math.abs(Math.cos(a));
        p += '<path fill="none" stroke="' + c[k % 2] + '" stroke-width="' + (s * .09).toFixed(1) + '" stroke-linecap="round" d="M' + hx.toFixed(1) + " " + hy.toFixed(1) + "Q" + ((hx + ex) / 2).toFixed(1) + " " + (hy - s * .18).toFixed(1) + " " + ex.toFixed(1) + " " + ey.toFixed(1) + '"/>';
      }
      return p;
    }
    if (type === "cactus") return '<path fill="none" stroke="' + c[0] + '" stroke-width="' + s * .2 + '" stroke-linecap="round" d="M' + x + " " + y + "v" + (-s * 1.1) + "M" + x + " " + (y - s * .55) + "h" + (-s * .32) + "v" + (-s * .3) + "M" + x + " " + (y - s * .4) + "h" + (s * .32) + "v" + (-s * .36) + '"/>';
    return '<rect fill="#6B4E36" x="' + (x - s * .07) + '" y="' + (y - s * .7) + '" width="' + s * .14 + '" height="' + s * .7 + '"/><circle fill="' + c[0] + '" cx="' + x + '" cy="' + (y - s * .95) + '" r="' + s * .48 + '"/><circle fill="' + c[1] + '" cx="' + (x - s * .14) + '" cy="' + (y - s * 1.08) + '" r="' + s * .26 + '"/>';
  }
  function cycliste() {   // vu de profil, roues qui tournent ; le paysage défile derrière lui
    const roue = (cx) => '<g transform="translate(' + cx + ' 0)"><circle r="34" fill="none" stroke="#1B1F26" stroke-width="6"/><circle r="27" fill="none" stroke="#9AA4B1" stroke-width="1.5"/>' +
      '<g class="rayons">' + [0, 45, 90, 135].map((a) => '<line x1="-27" y1="0" x2="27" y2="0" stroke="#C8CFD8" stroke-width="1.3" transform="rotate(' + a + ')"/>').join("") + "</g></g>";
    // pédalage : pied sur la pédale qui tourne autour du boîtier, genou calculé (cuisse et tibia de longueur fixe)
    const HANCHE = [34, -58], PEDALIER = [44, 4], MANIVELLE = 15, CUISSE = 38, TIBIA = 46, IMAGES = 24, TOUR = "0.9s";
    function jambe(phase) {
      const cuisse = [], entiere = [], chaussure = [];
      for (let i = 0; i <= IMAGES; i++) {
        const a = phase + 2 * Math.PI * i / IMAGES;
        const p = [PEDALIER[0] + MANIVELLE * Math.cos(a), PEDALIER[1] + MANIVELLE * Math.sin(a)];
        const dx = p[0] - HANCHE[0], dy = p[1] - HANCHE[1], d = Math.hypot(dx, dy);
        const l = (CUISSE * CUISSE - TIBIA * TIBIA + d * d) / (2 * d), h = Math.sqrt(Math.max(0, CUISSE * CUISSE - l * l));
        const g = [HANCHE[0] + dx * l / d + dy * h / d, HANCHE[1] + dy * l / d - dx * h / d];   // genou vers l'avant
        const f = (q) => q[0].toFixed(1) + " " + q[1].toFixed(1);
        cuisse.push("M" + f(HANCHE) + "L" + f(g));
        entiere.push("M" + f(HANCHE) + "L" + f(g) + "L" + f(p));
        chaussure.push("M" + f([p[0] - 3, p[1]]) + "L" + f([p[0] + 8, p[1] + 1]));
      }
      const chemin = (v, coul, ep) => '<path d="' + v[0] + '" stroke="' + coul + '" stroke-width="' + ep + '"><animate attributeName="d" dur="' + TOUR + '" repeatCount="indefinite" values="' + v.join(";") + '"/></path>';
      return { entiere: (coul, ep) => chemin(entiere, coul, ep), cuisse: (coul, ep) => chemin(cuisse, coul, ep), chaussure: (coul, ep) => chemin(chaussure, coul, ep) };
    }
    const loin = jambe(Math.PI), pres = jambe(0);
    const manivelles = '<g><line x1="' + (PEDALIER[0] - MANIVELLE) + '" y1="' + PEDALIER[1] + '" x2="' + (PEDALIER[0] + MANIVELLE) + '" y2="' + PEDALIER[1] + '" stroke="#2A2F37" stroke-width="3.5"/>' +
      '<animateTransform attributeName="transform" type="rotate" from="0 ' + PEDALIER[0] + " " + PEDALIER[1] + '" to="360 ' + PEDALIER[0] + " " + PEDALIER[1] + '" dur="' + TOUR + '" repeatCount="indefinite"/></g>';
    return '<g class="cycliste" transform="translate(980 812)">' +
      '<ellipse cx="52" cy="36" rx="74" ry="6" fill="rgba(0,0,0,.28)"/>' + roue(0) + roue(106) +
      '<g fill="none" stroke-linecap="round" stroke-linejoin="round">' +
      loin.entiere("#D9A684", 8) + loin.cuisse("#15181D", 11) + loin.chaussure("#15181D", 6) +
      '<path d="M0 0L44 4L36 -44M0 0L34 -38L92 -44M44 4L97 -30L106 0" stroke="#F4F6F8" stroke-width="5"/>' +
      '<circle cx="44" cy="4" r="8" stroke="#2A2F37" stroke-width="3"/>' + manivelles +
      '<path d="M92 -44L97 -30" stroke="#F4F6F8" stroke-width="6"/>' +
      '<path d="M90 -47h12q6 0 5 8l-3 7" stroke="#1B1F26" stroke-width="4"/>' +
      '<path d="M26 -50h20" stroke="#1B1F26" stroke-width="5"/>' +
      pres.entiere("#F1C29E", 9) + pres.cuisse("#1B1F26", 12) + pres.chaussure("#1B1F26", 7) +
      '<path d="M30 -60L80 -84" stroke="#FF6B1A" stroke-width="19"/>' +
      '<path d="M80 -82L88 -64L99 -48" stroke="#F1C29E" stroke-width="7"/><path d="M78 -84L86 -70" stroke="#FF6B1A" stroke-width="9"/>' +
      "</g>" +
      '<circle cx="93" cy="-92" r="10" fill="#F1C29E"/><path d="M80 -95q4 -14 18 -12q8 2 8 9z" fill="#F4F6F8"/>' +
      '<path d="M96 -93h9" stroke="#1B1F26" stroke-width="3" stroke-linecap="round"/>' +
      "</g>";
  }
  function svgTheme(nom, graine) {
    const T = THEMES[nom], rnd = alea(graine);
    const loin = T.mesa ? mesas(rnd, T.loin[0], T.loin[1]) : crete(rnd, T.loin[0], T.loin[1], T.loin[2]);
    const milieu = crete(rnd, T.milieu[0], T.milieu[1], T.milieu[2]);
    const pres = crete(rnd, T.pres[0], T.pres[1], T.pres[2]);
    let nuages = "";
    for (let i = 0; i < 6; i++) {
      const x = rnd() * W, y = 70 + rnd() * 230, s = 0.6 + rnd() * 0.8;
      nuages += '<g fill="#FFFFFF" opacity=".85" transform="translate(' + x.toFixed(0) + " " + y.toFixed(0) + ") scale(" + s.toFixed(2) + ')"><ellipse cx="0" cy="0" rx="70" ry="22"/><ellipse cx="-30" cy="-12" rx="34" ry="22"/><ellipse cx="22" cy="-18" rx="40" ry="28"/></g>';
    }
    let arbresLoin = "", arbresPres = "";
    for (let i = 0; i < 22; i++) { const x = rnd() * W; arbresLoin += arbre(T.arbres, x, hauteurA(milieu, x) + 8 + rnd() * 40, 16 + rnd() * 10, T.arbre); }
    for (let i = 0; i < 12; i++) { const x = rnd() * W; arbresPres += arbre(T.arbres, x, hauteurA(pres, x) + 6 + rnd() * 18, 34 + rnd() * 22, T.arbre); }
    let tirets = "";
    for (let x = 0; x < W; x += 100) tirets += '<rect x="' + x + '" y="856" width="52" height="5" fill="#F2F2EE" opacity=".85"/>';
    let reflets = "";
    if (T.mer) for (let i = 0; i < 30; i++) reflets += '<rect x="' + (rnd() * W).toFixed(0) + '" y="' + (556 + rnd() * 150).toFixed(0) + '" width="' + (20 + rnd() * 60).toFixed(0) + '" height="2" fill="#FFFFFF" opacity=".35"/>';
    const id = "ciel-" + nom;
    return '<svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + T.ciel[0] + '"/><stop offset="1" stop-color="' + T.ciel[1] + '"/></linearGradient></defs>' +
      '<rect width="' + W + '" height="' + H + '" fill="url(#' + id + ')"/>' +
      '<circle cx="1240" cy="200" r="130" fill="' + T.soleil + '" opacity=".25"/><circle cx="1240" cy="200" r="62" fill="' + T.soleil + '"/>' +
      couche(170, triple(nuages)) +
      couche(120, relief(loin, T.loin[3]) + (T.neige ? neige(loin, T.loin[0], T.loin[1]) : "")) +
      (T.mer ? '<rect y="548" width="' + W + '" height="' + (H - 548) + '" fill="' + T.mer + '"/>' + couche(90, triple(reflets)) : "") +
      couche(55, relief(milieu, T.milieu[3]) + triple(arbresLoin)) +
      couche(24, relief(pres, T.pres[3]) + triple(arbresPres)) +
      '<rect y="808" width="' + W + '" height="16" fill="' + T.sol + '"/>' +
      '<rect y="822" width="' + W + '" height="' + (H - 822) + '" fill="' + T.route + '"/><rect y="822" width="' + W + '" height="3" fill="#FFFFFF" opacity=".25"/>' +
      couche(4, triple(tirets)) + cycliste() + "</svg>";
  }
  function construire() {
    const fond = $("accueil-fond");
    ORDRE.forEach((nom, i) => {
      const d = document.createElement("div");
      d.className = "scene"; d.dataset.theme = nom;
      d.innerHTML = svgTheme(nom, 1000 + i * 77);
      fond.append(d);
    });
    // (v70) le paysage reste celui du monde choisi : il ne passe plus d'un monde à l'autre toutes les 9 s
  }
  function montrer(theme) {
    if (!THEMES[theme]) theme = "campagne";
    document.querySelectorAll("#accueil-fond .scene").forEach((s) => s.classList.toggle("actif", s.dataset.theme === theme));
  }
  return { construire, montrer };
})();

/* ---------- Écran de connexion au démarrage : on connecte ses accessoires, puis on valide (ou on passe) ---------- */
(function () {
  const ecran = $("ecran-connexion");
  const appareilsEl = document.querySelector(".appareils");
  const repere = document.createComment("appareils");
  appareilsEl.before(repere);
  $("ec-appareils").append(appareilsEl);   // les cartes de l'onglet Connectivité, prêtées le temps de l'accueil
  if (!navigator.bluetooth) $("ec-alerte").hidden = false;
  const etats = ["st-trainer", "st-power", "st-hr"].map($);
  function majValider() {
    const n = etats.filter((e) => e.classList.contains("ok")).length;
    $("btn-ec-valider").disabled = n === 0;
    $("ec-aide").textContent = n === 0 ? "Connecte au moins un accessoire pour valider." : n + (n > 1 ? " accessoires connectés." : " accessoire connecté.");
  }
  const obs = new MutationObserver(majValider);
  etats.forEach((e) => obs.observe(e, { attributes: true, attributeFilter: ["class"] }));
  majValider();
  function fermer() {
    obs.disconnect();
    repere.replaceWith(appareilsEl);
    ecran.hidden = true;
    afficherOnglet("world");
  }
  $("btn-ec-valider").addEventListener("click", fermer);
  $("btn-ec-passer").addEventListener("click", fermer);
})();

/* ---------- Page d'accueil : type de sortie, monde choisi, « C'est parti » ---------- */
const MODES_SORTIE = { aucun: "Sortie libre", z2: "Sortie endurance", course: "Course", fantome: "Contre mon record", clm: "Contre-la-montre", tour: "Tour à étapes" };
const CLE_MONDE_CHOISI = "velo-virtuel-monde-choisi";
function majModes() {
  const v = $("peloton-mode").value;
  document.querySelectorAll(".modes .mode").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.mode === v)));
  $("options-ia").hidden = v === "aucun" || v === "fantome";
  // (v69 suite) contre-la-montre et Tour : pas de séance ERG ; Tour : les étapes fixent le monde et le nombre de tours
  $("info-clm").hidden = v !== "clm"; $("info-ia").hidden = v === "clm";
  $("choix-seance").hidden = v === "clm" || v === "tour"; document.querySelector(".barre-seance").hidden = $("choix-seance").hidden;
  if (typeof Tour !== "undefined") Tour.rendre();
  // (v69 suite) « Mon record » : seul contre le fantôme de ton meilleur tour (ou parcours complet), case du fantôme forcée
  if (v === "fantome" && !$("fantome-pr").disabled) $("fantome-pr").checked = true;
  majResumeChoix();
}
document.querySelectorAll(".modes .mode").forEach((b) => b.addEventListener("click", () => {
  const s = $("peloton-mode");
  if (s.value !== b.dataset.mode) { s.value = b.dataset.mode; s.dispatchEvent(new Event("change")); }
  majModes();
}));
function choisirMonde(id) {
  if (!MONDES.some((m) => m.id === id)) id = MONDES[0].id;
  // nombre de tours conseillé par le monde (critérium : 10) ; en le quittant, on revient à 3 tours
  const avant = MONDES.find((x) => x.id === mondeChoisiId), m0 = MONDES.find((x) => x.id === id), sel = $("peloton-tours");
  if (m0 && m0.toursDefaut) sel.value = String(m0.toursDefaut);
  else if (avant && avant.toursDefaut && sel.value === String(avant.toursDefaut)) sel.value = "3";
  mondeChoisiId = id;
  try { localStorage.setItem(CLE_MONDE_CHOISI, id); } catch (e) { /* ignoré */ }
  document.querySelectorAll("#tuiles-mondes .tuile-monde").forEach((t) => t.classList.toggle("choisi", t.dataset.id === id));
  majResumeChoix();
  Fond.montrer(MONDES.find((m) => m.id === id).theme);
}
// (v69 suite) point de départ : début du parcours, pied d'une montée (segments chronométrés) ou tous les 5 km (10 km au-delà de 60 km)
let departsSig = "";
function majDeparts(m, r) {
  const sel = $("depart-km"), lab = $("choix-depart");
  lab.hidden = !(r.longueur > 3000);
  const sig = m.id + "|" + Math.round(r.longueur);
  if (sig === departsSig) return;
  departsSig = sig;
  const garde = sel.dataset.monde === m.id ? sel.value : "0";
  const opts = [[0, "Au début du parcours"]];
  if (r.longueur > 3000) {
    const sauve = route;
    let segs = [];
    route = r;
    try { segs = Progression.segmentsRoute(); } catch (e) { segs = []; } finally { route = sauve; }
    for (const s of segs) if (s.type === "montee" && s.s <= 300) opts[0][1] = "Au début du parcours (pied de « " + s.nom + " »)";
    for (const s of segs) if (s.type === "montee" && s.s > 300) opts.push([Math.max(0, Math.round(s.s - 200)), "Pied de « " + s.nom + " » (km " + fr1(s.s / 1000) + ")"]);
    const pas = r.longueur > 60000 ? 10000 : 5000;
    for (let d = pas; d < r.longueur - 1000; d += pas) opts.push([d, "Km " + d / 1000]);
  }
  opts.sort((a, b) => a[0] - b[0]);
  sel.innerHTML = "";
  for (const [d, t] of opts) { const o = document.createElement("option"); o.value = String(d); o.textContent = t; sel.append(o); }
  sel.value = [...sel.options].some((o) => o.value === garde) ? garde : "0";
  sel.dataset.monde = m.id;
}
$("depart-km").addEventListener("change", () => majResumeChoix());
$("echauffement").addEventListener("change", () => { sauverReglages(); majResumeChoix(); });
$("seance-monde").addEventListener("change", () => majResumeChoix());
$("btn-import-accueil").addEventListener("click", () => $("fichier-erg").click());
function majResumeChoix() { majResumeChoixDetail(); majAccueilB(); }
// (v70) maquette B : le monde choisi en grand (nom, chiffres, profil coloré par la pente) et le résumé des options repliées
const NIVEAUX_COURTS = { facile: "facile", equilibre: "équilibré", expert: "expert" };
let accueilBDemande = false;
function majAccueilB() {                  // regroupe les appels (changement d'option + majResumeChoix) : un seul calcul par image
  if (accueilBDemande) return;
  accueilBDemande = true;
  setTimeout(() => { accueilBDemande = false; majAccueilBMaintenant(); }, 0);   // (pas requestAnimationFrame : il ne tourne pas quand la fenêtre est cachée)
}
function majAccueilBMaintenant() {
  const m = MONDES.find((x) => x.id === mondeChoisiId), r = m ? m.route || routeTest() : null;
  $("am-nom").textContent = m ? m.nom : "Choisis un monde";
  const ch = $("am-chiffres");
  ch.innerHTML = "";
  if (r) for (const [v, u] of [[fr1(r.longueur / 1000), "km"], [Math.round(r.dplus).toLocaleString("fr-FR"), "m D+"], [r.boucle ? "Boucle" : "Aller simple", ""]]) {
    const d = document.createElement("div");
    d.innerHTML = "<b></b><span></span>";
    d.querySelector("b").textContent = v; d.querySelector("span").textContent = u;
    ch.append(d);
  }
  dessinerProfilAccueil($("am-profil"), r);
  const p = [];
  if (!$("options-ia").hidden) {
    p.push($("peloton-nombre").value + " coureurs · " + NIVEAUX_COURTS[$("peloton-niveau").value]);
    if (!$("choix-tours").hidden) { const nt = parseInt($("peloton-tours").value, 10) || 0; p.push(nt ? nt + (nt > 1 ? " tours" : " tour") : "sans arrivée"); }
    if (!$("choix-echauffement").hidden && $("echauffement").checked) p.push("échauffement");
  }
  if (!$("choix-seance").hidden && $("seance-monde").value) p.push("ERG : " + $("seance-monde").selectedOptions[0].textContent);
  if (!$("choix-depart").hidden && parseFloat($("depart-km").value) > 0) p.push("départ km " + fr1(parseFloat($("depart-km").value) / 1000));
  if ($("fantome-pr").checked) p.push("fantôme du record");
  $("options-resume").textContent = p.length ? p.join(" · ") : "réglages par défaut";
}
function dessinerProfilAccueil(cv, r) {
  const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const c = cv.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  if (!r) return;
  const N = 200, alts = [];
  for (let i = 0; i <= N; i++) alts.push(altitudeRoute(r, Math.min(r.longueur * i / N, r.longueur - 0.01)));
  const mn = Math.min(...alts), ec = Math.max(Math.max(...alts) - mn, 40);
  const Y = (a) => h - 3 - (a - mn) / ec * (h - 10);
  for (let i = 0; i < N; i++) {
    const x0 = w * i / N, x1 = w * (i + 1) / N + 0.6;
    const i0 = Math.max(0, i - 4), i1 = Math.min(N, i + 5);   // pente lissée sur ~9 points : couleurs lisibles
    c.fillStyle = couleurPente((alts[i1] - alts[i0]) / ((i1 - i0) * r.longueur / N) * 100);
    c.globalAlpha = 0.75;
    c.beginPath(); c.moveTo(x0, h); c.lineTo(x0, Y(alts[i])); c.lineTo(x1, Y(alts[i + 1])); c.lineTo(x1, h); c.fill();
  }
  c.globalAlpha = 1;
  c.strokeStyle = "rgba(255,255,255,.9)"; c.lineWidth = 1.5;
  c.beginPath(); alts.forEach((a, i) => (i ? c.lineTo(w * i / N, Y(a)) : c.moveTo(0, Y(a)))); c.stroke();
}
$("accueil-options").addEventListener("change", majAccueilB);
$("accueil-options").addEventListener("toggle", majAccueilB);
new ResizeObserver(() => majAccueilB()).observe($("am-profil"));   // aussi quand la page devient visible (largeur 0 tant qu'elle est cachée)
document.querySelectorAll(".modes .mode").forEach((b) => { b.title = b.querySelector("span").textContent; });
function majResumeChoixDetail() {
  const m = MONDES.find((x) => x.id === mondeChoisiId);
  $("resume-choix-titre").textContent = MODES_SORTIE[$("peloton-mode").value] + (m ? " · " + m.nom : "");
  if (!m) { $("resume-choix-detail").textContent = "Choisis un monde dans la liste."; return; }
  const r = m.route || routeTest();
  // course sur une boucle : nombre de tours jusqu'à l'arrivée (0 = sans arrivée), avec la distance totale
  const pm = $("peloton-mode").value, clm = pm === "clm", tourM = pm === "tour", course = pm === "course" || clm, nt = parseInt($("peloton-tours").value, 10) || 0;
  $("choix-tours").hidden = !course || !r.boucle;
  $("choix-echauffement").hidden = !course;
  $("choix-depart").hidden = tourM;
  $("peloton-tours").options[0].hidden = clm;                                 // contre-la-montre : toujours une arrivée
  if (clm && nt === 0) $("peloton-tours").value = "1";
  [...$("peloton-tours").options].forEach((o) => { const k = parseInt(o.value, 10); if (k) o.textContent = k + (k > 1 ? " tours · " : " tour · ") + fr1(k * r.longueur / 1000) + " km"; });
  majDeparts(m, r);
  majChoixSeanceMonde();
  if (tourM) { $("resume-choix-detail").textContent = typeof Tour !== "undefined" ? Tour.resume() : ""; return; }
  const dep = parseFloat($("depart-km").value) || 0, sc = clm ? null : seanceChoisie();
  $("resume-choix-detail").textContent = fr1(r.longueur / 1000) + " km · D+ " + Math.round(r.dplus) + " m · " + (r.boucle ? "boucle" : "aller simple") + (dep > 0 ? " · départ au km " + fr1(dep / 1000) : "") + ($("peloton-mode").value === "fantome" ? (lirePRDe(r) ? " · record à battre : " + formatDuree(Math.round(lirePRDe(r).t)) + (r.boucle ? " le tour" : "") : " · pas encore de record : ce premier passage le créera") : "") + (course && $("echauffement").checked ? " · échauffement 10 min" : sc ? " · séance « " + sc.vrai + " » en ERG" : "")
    + (course && r.boucle ? (nt ? " · arrivée après " + nt + (nt > 1 ? " tours" : " tour") + " (" + fr1(nt * r.longueur / 1000) + " km)" : " · sans arrivée") : "");
}
$("btn-cest-parti").addEventListener("click", () => {
  if (!MONDES.some((m) => m.id === mondeChoisiId)) choisirMonde(MONDES[0].id);
  const pm = $("peloton-mode").value;
  if (pm === "tour" && !session.samples.length && (typeof Tour === "undefined" || !Tour.preparer())) return;   // (v69 suite) prochaine étape du Tour
  if (!session.samples.length) {
    if (pm === "clm" || pm === "tour") { if (modeActuel() === "erg") { document.querySelector("input[name=mode][value=route]").checked = true; reinitialiserEnvois(); } }
    else appliquerSeanceChoisie();                             // (v69 suite) séance ERG choisie sur la page d'accueil
    if ((pm === "course" || pm === "clm") && $("echauffement").checked) lancerEchauffement();   // échauffement, puis départ de la course
  }
  const t = document.querySelector('#tuiles-mondes .tuile-monde[data-id="' + CSS.escape(mondeChoisiId) + '"]') || document.createElement("div");
  entrerMonde(mondeChoisiId, t);
});

(function () {
  Fond.construire();
  let enregistre = null;
  try { enregistre = localStorage.getItem(CLE_MONDE_CHOISI); } catch (e) { /* ignoré */ }
  mondeChoisiId = enregistre && enregistre !== "test" ? enregistre : MONDES[0].id;   // un monde GPX enregistré n'est peut-être pas encore chargé : vérifié plus tard (« test » : monde retiré en v68)
  majModes();
  const m = MONDES.find((x) => x.id === mondeChoisiId);
  Fond.montrer(m ? m.theme : "campagne");
  rendreTuilesMondes();
})();
