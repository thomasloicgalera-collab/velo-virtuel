"use strict";
/* (v76) « Mon garage » : la page Personnalisation en grille de catégories (cadre, roues, moi, cheveux, tête, lunettes, maillot, cuissard,
   chaussettes) ; chaque catégorie ouvre une liste de cartes (vignette, nom, étoiles aéro / poids pour le matériel) ou de pastilles de couleur.
   Rien n'est stocké ici : tout passe par les réglages d'avant (selects et cases de #perso-avatar et #perso-velo, gardés cachés),
   donc la sauvegarde, la sortie de groupe et l'aperçu 3D marchent comme avant. */
const Garage = (function () {
  const $g = (id) => document.getElementById(id);
  const racine = $g("garage");
  if (!racine) return null;
  const reserve = $g("perso-velo");             // la fiche du vélo (#fiche-velo) y reste quand elle n'est pas affichée
  const fiche = $g("fiche-velo");
  let vue = "accueil";

  const opts = (id) => Array.from($g(id).options).map((o) => ({ v: o.value, t: o.textContent.trim(), g: o.parentElement.tagName === "OPTGROUP" ? o.parentElement.label : "" }));
  const val = (id) => $g(id).value;
  const chk = (id) => $g(id).checked;
  const hex = (v) => "#" + (parseInt(v, 10) >>> 0).toString(16).padStart(6, "0");
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const nomEt = (t) => { const m = /^(.*?)\s*\((.*)\)\s*$/.exec(t); return m ? [m[1], m[2]] : [t, ""]; };
  const trouver = (id, v) => (opts(id).find((o) => o.v === v) || { t: "" }).t;

  /* ---------- vignettes dessinées en SVG ---------- */
  const COUL_VELO = { mystero: "#2ab7a9", v5rs: "#e8e8ee", y1rs: "#f1f1f1", melee: "#2a2d33", dogma: "#d42b2b", foil: "#9096a0", madone: "#f6f6f6", simple: "#5b8def",
    plasma: "#f4f6f4", speed: "#7a46b8", triton: "#26211e", tritonb: "#8fc9ee" };
  function svgVelo(id) {
    const c = COUL_VELO[id] || "#888", p = PERF_VELOS[id], clm = !!(p && p.clm);
    const tr = (d, col, w) => '<path d="' + d + '" stroke="' + col + '" stroke-width="' + w + '" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
    const cadre = "M26,48 L54,50 L44,22 L82,24 L54,50 M26,48 L44,22 M82,24 L94,48";
    const roue = (x) => clm ? '<circle cx="' + x + '" cy="48" r="17" fill="#2b2f36"/><circle cx="' + x + '" cy="48" r="5" fill="#8a919c"/>'
      : '<circle cx="' + x + '" cy="48" r="17" fill="none" stroke="#2b2f36" stroke-width="3.2"/><circle cx="' + x + '" cy="48" r="2.5" fill="#2b2f36"/>';
    return '<svg viewBox="0 0 120 72" aria-hidden="true">' + roue(26) + roue(94) + tr(cadre, "#20242b", 7) + tr(cadre, c, 4.2) +
      tr("M40,19 L50,19 M82,24 L84,17 L92,18", "#20242b", 3.2) + (clm ? tr("M84,19 L104,21", "#20242b", 3) : "") + "</svg>";
  }
  function svgRoue(r) {
    const ep = { "35": 4, "45": 6, "50": 7, "65": 10, disque: 10 }[r] || 5;
    let sp = ""; for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; sp += '<line x1="40" y1="40" x2="' + (40 + 31 * Math.cos(a)).toFixed(1) + '" y2="' + (40 + 31 * Math.sin(a)).toFixed(1) + '"/>'; }
    return '<svg viewBox="0 0 80 80" aria-hidden="true">' + (r === "disque" ? '<circle cx="40" cy="40" r="34" fill="#3a3f48"/><circle cx="40" cy="40" r="26" fill="#575d68"/>' : '<g stroke="#8a919c" stroke-width=".8">' + sp + "</g>") +
      '<circle cx="40" cy="40" r="' + (37 - ep / 2) + '" fill="none" stroke="#23272e" stroke-width="' + ep + '"/><circle cx="40" cy="40" r="3.5" fill="#c5cad2"/></svg>';
  }
  function svgCasque(s, couleur) {
    const D = "#20242b", c = couleur;
    const corps = {
      classique: '<path d="M12,54 C10,28 36,12 64,12 C92,12 110,30 110,54 Z"/>',
      aero: '<path d="M10,54 C8,30 34,12 64,12 C94,12 112,30 112,54 Z"/>',
      evade: '<path d="M4,56 C12,30 38,14 66,14 C94,14 110,32 110,56 Z"/>',
      ventile: '<path d="M12,54 C10,28 36,12 64,12 C92,12 110,30 110,54 Z"/>',
      chrono: '<path d="M3,62 C22,42 42,18 70,13 C98,10 114,30 110,56 L70,59 Z"/>'
    }[s];
    const det = {
      classique: '<path d="M42,22 L50,42 M58,18 L64,42 M74,20 L78,42 M88,26 L90,42" stroke="' + D + '" stroke-width="4" stroke-linecap="round" fill="none"/>',
      aero: '<rect x="40" y="26" width="38" height="22" rx="9" fill="#3a3f47"/><rect x="85" y="26" width="7" height="18" rx="3" fill="' + D + '"/><rect x="30" y="20" width="6" height="14" rx="3" fill="' + D + '"/>',
      evade: '<path d="M14,42 C48,38 80,40 108,46" stroke="' + D + '" stroke-width="2.4" fill="none" opacity=".6"/><rect x="40" y="22" width="10" height="14" rx="4" fill="' + D + '"/><rect x="64" y="20" width="10" height="14" rx="4" fill="' + D + '"/>',
      ventile: '<path d="M26,26 Q64,2 100,30" stroke="#16181c" stroke-width="5" fill="none"/><path d="M42,28 L56,42 M58,24 L72,42 M74,26 L86,42" stroke="' + D + '" stroke-width="4" stroke-linecap="round" fill="none"/>',
      chrono: '<rect x="44" y="20" width="14" height="6" rx="3" fill="' + D + '"/><path d="M96,28 L116,31 L116,52 L94,52 Z" fill="#1b2230" opacity=".88"/>'
    }[s];
    return '<svg viewBox="0 0 120 70" aria-hidden="true"><g fill="' + c + '" stroke="' + D + '" stroke-width="2.6" stroke-linejoin="round">' + corps + '</g><path d="M' + (s === "chrono" ? 4 : 12) + ',54 L110,57 L110,62 L' + (s === "chrono" ? 4 : 12) + ',60 Z" fill="' + D + '"/>' + det + "</svg>";
  }
  const VERRES_C = { orange: ["#ffb347", "#d8432f"], bleu: ["#8fd0ff", "#2f6fc0"], violet: ["#d6a0ff", "#6b3fb0"], fume: ["#6b727c", "#1d2229"] };
  function svgLunettes(v) {
    const [a, b] = VERRES_C[v] || VERRES_C.fume;
    return '<svg viewBox="0 0 120 70" aria-hidden="true"><defs><linearGradient id="gl' + v + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + a + '"/><stop offset="1" stop-color="' + b + '"/></linearGradient></defs>' +
      '<path d="M8,26 Q60,16 112,26 L106,32 Q60,24 14,32 Z" fill="#20242b"/><path d="M14,30 Q60,22 106,30 C106,48 92,58 78,56 C68,54 64,44 60,44 C56,44 52,54 42,56 C28,58 14,48 14,30 Z" fill="url(#gl' + v + ')" stroke="#20242b" stroke-width="2.4"/></svg>';
  }
  const ICO = {
    cadre: '<circle cx="14" cy="42" r="11"/><circle cx="50" cy="42" r="11"/><path d="M14,42 L30,44 L24,24 L46,26 L30,44 M24,24 L14,42 M46,26 L50,42 M20,20 L28,20"/>',
    roues: '<circle cx="32" cy="32" r="24"/><circle cx="32" cy="32" r="3"/><path d="M32,8 V56 M8,32 H56 M15,15 L49,49 M49,15 L15,49"/>',
    moi: '<circle cx="32" cy="26" r="13"/><path d="M8,58 C10,44 20,40 32,40 C44,40 54,44 56,58"/>',
    cheveux: '<path d="M14,34 C10,12 26,6 34,6 C46,6 56,14 52,34 C46,26 38,22 30,22 C24,22 18,26 14,34 Z"/><path d="M16,36 C16,52 26,58 34,58 C44,58 50,52 50,36"/>',
    tete: '<path d="M8,38 C6,18 22,8 34,8 C48,8 58,20 56,38 Z"/><path d="M8,38 H56 M20,44 L24,56 M44,44 L40,56"/>',
    lunettes: '<path d="M4,22 H60 M10,24 C10,40 18,46 26,44 C32,42 32,36 32,36 C32,36 32,42 38,44 C46,46 54,40 54,24"/>',
    maillot: '<path d="M22,8 L6,18 L12,30 L20,26 V56 H44 V26 L52,30 L58,18 L42,8 C40,14 24,14 22,8 Z"/><path d="M32,14 V52"/>',
    cuissard: '<path d="M14,10 H50 L54,52 H36 L32,28 L28,52 H10 Z"/>',
    chaussettes: '<path d="M18,6 H36 V34 L54,46 C58,52 54,58 48,58 C42,58 28,48 22,42 C18,38 18,34 18,30 Z"/><path d="M18,14 H36 M18,22 H36"/>'
  };
  const icone = (k) => '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICO[k] + "</svg>";

  /* ---------- briques ---------- */
  const cacheVign = {};                         // vignettes 3D des vélos (images), faites une fois à l'ouverture de Cadre
  const carte = (o) => '<button type="button" class="g-carte' + (o.actif ? " actif" : "") + '" data-a="' + o.a + '" data-id="' + (o.id || "") + '" data-v="' + esc(o.v) + '">' +
    (o.actif ? '<span class="g-coche" aria-hidden="true">✓</span>' : "") + '<span class="g-vign"' + (o.vel ? ' data-vel="' + o.vel + '"' : "") + ">" + o.vign + '</span><span class="g-txt"><b>' + esc(o.nom) + "</b>" + (o.sous ? "<em>" + esc(o.sous) + "</em>" : "") +
    (o.gains ? gainsHtml(o.gains) : "") + "</span></button>";
  const pastille = (a, id, v, actif, nom) => '<button type="button" class="g-pastille' + (actif ? " actif" : "") + '" style="background:' + hex(v) + '" data-a="' + a + '" data-id="' + id + '" data-v="' + v + '" title="' + esc(nom || "") + '" aria-label="' + esc(nom || hex(v)) + '"></button>';
  const puce = (id, v, actif, nom) => '<button type="button" class="g-puce' + (actif ? " actif" : "") + '" data-a="sel" data-id="' + id + '" data-v="' + esc(v) + '">' + esc(nom) + "</button>";
  const titre = (t) => '<div class="g-sous">' + t + "</div>";
  const pastillesSel = (id) => '<div class="g-pastilles">' + opts(id).map((o) => pastille("sel", id, o.v, val(id) === o.v, o.t)).join("") + "</div>";
  const pastillesCol = (champ, liste) => '<div class="g-pastilles">' + liste.map((c) => pastille("champ", champ, c, val(champ) === String(c), hex(c))).join("") + "</div>";
  const puces = (id) => '<div class="g-puces">' + opts(id).map((o) => puce(id, o.v, val(id) === o.v, o.t.replace(/\s*\(.*\)$/, ""))).join("") + "</div>";

  /* gains par rapport au matériel de base (vélo simple, roues de 35 mm) : watts économisés sur le plat à 40 km/h (traînée de l'air),
     watts économisés en montée à 7 % (poids : environ 4 W par kg à 20 km/h) */
  const W_AIR = 343;                            // puissance d'air à 40 km/h (≈ 0,5 × ρ·CdA 0,50 × v³), avec laquelle on multiplie le gain de traînée
  const gainsDe = (aero, masse, masseRef) => ({ plat: aero * W_AIR, mont: (masseRef - masse) * 4.1 });
  const fmtW = (w) => { const r = Math.round(w); return r === 0 ? "0 W" : (r > 0 ? "+" : "−") + Math.abs(r) + " W"; };
  function gainsHtml(g) {
    const ligne = (nom, w, max) => '<span class="g-gain"><span class="g-gl">' + nom + '</span><span class="g-barre"><i style="width:' + Math.round(clamp(Math.sqrt(Math.max(0, w) / max), 0, 1) * 100) + '%"></i></span><b class="' + (Math.round(w) < 0 ? "neg" : Math.round(w) > 0 ? "pos" : "") + '">' + fmtW(w) + "</b></span>";
    return '<span class="g-gains">' + ligne("Plat · 40 km/h", g.plat, 70) + ligne("Montée · 7 %", g.mont, 12) + "</span>";
  }
  const SOUS_ROUES = { "35": "Légères, idéales en montagne", "45": "Polyvalentes", "50": "Rapides et stables", "65": "Très aéro, plus lourdes", disque: "Lenticulaire : le plus rapide sur le plat" };
  const SOUS_VELO = { simple: "Vélo de base", mystero: "Bleu-vert", v5rs: "Grimpeur léger", y1rs: "Aéro et rapide", melee: "Noir mat", dogma: "Rouge", foil: "Aéro", madone: "Blanc", plasma: "Blanc et vert", speed: "Violet", triton: "Noir et cuivre", tritonb: "Bleu clair" };
  const CASQUES = [["classique", "Route classique", "Fentes d’aération, tout-terrain"], ["aero", "Aéro", "Grandes aérations latérales"], ["evade", "Route lisse", "Rainures et longue queue"], ["ventile", "Ventilé", "Fentes et bande noire"], ["chrono", "Contre-la-montre", "Queue longue et visière"]];
  const VERRES_T = { orange: "Miroir orange", bleu: "Miroir bleu", violet: "Miroir violet", fume: "Fumés" };

  /* ---------- catégories ---------- */
  const CATS = [
    ["cadre", "Cadre", () => trouver("avatar-velo", val("avatar-velo")).replace(/\s*\(.*\)$/, "")],
    ["roues", "Roues", () => trouver("avatar-roues", val("avatar-roues"))],
    ["moi", "Moi", () => (val("sexe") === "femme" ? "Femme" : "Homme")],
    ["cheveux", "Cheveux", () => trouver("avatar-coiffure", val("avatar-coiffure"))],
    ["tete", "Tête", () => (chk("avatar-casque") ? (CASQUES.find((c) => c[0] === val("avatar-casque-style")) || CASQUES[0])[1] : "Sans casque")],
    ["lunettes", "Lunettes", () => (chk("avatar-lunettes") ? VERRES_T[val("avatar-verres")] || "" : "Sans")],
    ["maillot", "Maillot", () => trouver("avatar-maillot", val("avatar-maillot"))],
    ["cuissard", "Cuissard", () => (val("avatar-bas-style") === "long" ? "Collant long" : "Cuissard")],
    ["chaussettes", "Chaussettes", () => trouver("avatar-chaussettes", val("avatar-chaussettes"))]
  ];
  const APERCU = { cadre: true, roues: true, moi: "tete", cheveux: "tete", tete: "tete", lunettes: "tete" };

  const contenu = {
    cadre() {
      let h = "", g = null;
      for (const o of opts("avatar-velo")) {
        const p = PERF_VELOS[o.v] || PERF_VELOS.simple;
        if (o.g !== g) { g = o.g; h += titre(g || "Vélos"); }
        const [nom] = nomEt(o.t);
        h += carte({ a: "sel", id: "avatar-velo", v: o.v, actif: val("avatar-velo") === o.v, vel: o.v, vign: cacheVign[o.v] ? '<img alt="" src="' + cacheVign[o.v] + '">' : svgVelo(o.v), nom, sous: SOUS_VELO[o.v] || "", gains: gainsDe(p.aero, p.masse, PERF_VELOS.simple.masse) });
      }
      return h + '<div class="g-fiche" id="g-fiche"></div>';
    },
    roues() {
      return opts("avatar-roues").map((o) => { const p = PERF_ROUES[o.v];
        return carte({ a: "sel", id: "avatar-roues", v: o.v, actif: val("avatar-roues") === o.v, vign: svgRoue(o.v), nom: o.v === "disque" ? "Lenticulaire" : "Jantes " + o.t, sous: SOUS_ROUES[o.v], gains: gainsDe(p.aero, p.masse, PERF_ROUES["35"].masse) }); }).join("") +
        '<div class="g-fiche" id="g-fiche"></div>';
    },
    moi() {
      return titre("Silhouette") + '<div class="g-puces g-gros">' + puce("sexe", "homme", val("sexe") === "homme", "Homme") + puce("sexe", "femme", val("sexe") === "femme", "Femme") + "</div>" +
        titre("Couleur de peau") + pastillesCol("avatar-peau", PEAUX) + titre("Couleur des yeux") + '<div class="g-pastilles">' +
        opts("avatar-yeux").map((o) => '<button type="button" class="g-pastille' + (val("avatar-yeux") === o.v ? " actif" : "") + '" style="background:' + ({ marron: "#6b4423", noisette: "#8b6b2e", vert: "#4f8a4f", bleu: "#4a7fc0", gris: "#8a98a6", noir: "#1b1b1b" }[o.v] || "#666") + '" data-a="sel" data-id="avatar-yeux" data-v="' + o.v + '" title="' + esc(o.t) + '"></button>').join("") + "</div>";
    },
    cheveux() {
      return titre("Coiffure") + puces("avatar-coiffure") + titre("Couleur des cheveux") + pastillesCol("avatar-cheveux", CHEVEUX) + titre("Barbe") + puces("avatar-barbe");
    },
    tete() {
      const on = chk("avatar-casque"), col = hex(val("avatar-casque-couleur"));
      return carte({ a: "casque", v: "", actif: !on, vign: '<svg viewBox="0 0 120 70" aria-hidden="true"><circle cx="60" cy="38" r="26" fill="none" stroke="#9aa4b2" stroke-width="3" stroke-dasharray="6 6"/></svg>', nom: "Sans casque", sous: "Tête nue" }) +
        CASQUES.map((c) => carte({ a: "casque", v: c[0], actif: on && val("avatar-casque-style") === c[0], vign: svgCasque(c[0], col), nom: c[1], sous: c[2] })).join("") +
        titre("Couleur du casque") + pastillesSel("avatar-casque-couleur");
    },
    lunettes() {
      const on = chk("avatar-lunettes");
      return carte({ a: "lunettes", v: "", actif: !on, vign: '<svg viewBox="0 0 120 70" aria-hidden="true"><circle cx="60" cy="36" r="26" fill="none" stroke="#9aa4b2" stroke-width="3" stroke-dasharray="6 6"/></svg>', nom: "Sans lunettes", sous: "" }) +
        Object.keys(VERRES_T).map((k) => carte({ a: "lunettes", v: k, actif: on && val("avatar-verres") === k, vign: svgLunettes(k), nom: VERRES_T[k], sous: "" })).join("");
    },
    maillot() { return titre("Couleur du maillot") + pastillesSel("avatar-maillot") + '<div class="g-nom">' + esc(trouver("avatar-maillot", val("avatar-maillot"))) + "</div>"; },
    cuissard() {
      return titre("Style") + '<div class="g-puces g-gros">' + puce("avatar-bas-style", "cuissard", val("avatar-bas-style") === "cuissard", "Cuissard (jambes nues)") + puce("avatar-bas-style", "long", val("avatar-bas-style") === "long", "Collant long") + "</div>" +
        titre("Couleur") + pastillesSel("avatar-bas");
    },
    chaussettes() { return titre("Couleur des chaussettes") + pastillesSel("avatar-chaussettes") + '<div class="g-nom">' + esc(trouver("avatar-chaussettes", val("avatar-chaussettes"))) + "</div>"; }
  };

  function apercu(m) {                          // aperçu 3D : vélo seul, tête de près ou coureur entier (la variable vient de js/demarrage.js)
    if (typeof apercuVelo === "undefined") return;
    if (apercuVelo !== m) { apercuVelo = m; apercuAng = m === true ? Math.PI / 2 + 0.25 : m === "tete" ? 2.2 : 0.9; }
    const l = $g("apercu-legende"); if (l) l.textContent = "Aperçu 3D : fais-le tourner en le faisant glisser avec la souris.";
  }

  function rendre() {
    if (fiche && fiche.parentNode !== reserve) reserve.appendChild(fiche);
    if (vue === "accueil") {
      racine.innerHTML = '<div class="g-titre"><svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6,28 L32,8 L58,28 V58 H6 Z"/><path d="M16,58 V36 H48 V58 M16,44 H48 M16,51 H48"/></svg><h3>Mon garage</h3></div>' +
        '<div class="g-grille">' + CATS.map((c) => '<button type="button" class="g-tuile" data-a="ouvrir" data-v="' + c[0] + '"><span class="g-ico">' + icone(c[0]) + '</span><span class="g-lib"><b>' + c[1] + "</b><small>" + esc(c[2]()) + "</small></span></button>").join("") + "</div>";
      return;
    }
    const cat = CATS.find((c) => c[0] === vue);
    racine.innerHTML = '<div class="g-entete"><button type="button" class="g-retour" data-a="retour" aria-label="Retour au garage">←</button><h3>' + cat[1] + '</h3></div><div class="g-liste">' + contenu[vue]() + "</div>";
    if (vue === "cadre") vignettes();
    if ($g("g-fiche") && fiche) { $g("g-fiche").appendChild(fiche); if (typeof majMateriel === "function") majMateriel(); }
  }
  function vignettes() {                        // vraies vignettes 3D, une par image pour ne pas figer la page ; les dessins en SVG servent en attendant
    if (typeof monde3d === "undefined" || !monde3d || !monde3d.vignetteVelo) return;
    const faire = opts("avatar-velo").map((o) => o.v).filter((v) => v !== "simple" && !cacheVign[v]);
    const suite = () => {
      const id = faire.shift(); if (!id) return;
      try { const u = monde3d.vignetteVelo(id, 420, 256); if (u) cacheVign[id] = u; } catch (e) { /* on garde le dessin */ }
      const z = racine.querySelector('.g-vign[data-vel="' + id + '"]');
      if (z && cacheVign[id]) z.innerHTML = '<img alt="" src="' + cacheVign[id] + '">';
      setTimeout(suite, 30);
    };
    setTimeout(suite, 50);
  }
  function changer(id, v) { const s = $g(id); s.value = v; s.dispatchEvent(new Event("change")); }
  function cocher(id, on) { const c = $g(id); if (c.checked !== on) { c.checked = on; c.dispatchEvent(new Event("change")); } }

  racine.addEventListener("click", (e) => {
    const b = e.target.closest("[data-a]"); if (!b) return;
    const a = b.dataset.a, v = b.dataset.v, id = b.dataset.id;
    if (a === "ouvrir") { vue = v; apercu(APERCU[v] || false); rendre(); return; }
    if (a === "retour") { vue = "accueil"; apercu(false); rendre(); return; }
    if (a === "sel") changer(id, v);
    else if (a === "champ") { $g(id).value = v; if (typeof marquerPastilles === "function") marquerPastilles(); appliquerAvatar(); sauverReglages(); }
    else if (a === "casque") { if (v) { changer("avatar-casque-style", v); cocher("avatar-casque", true); } else cocher("avatar-casque", false); }
    else if (a === "lunettes") { if (v) { changer("avatar-verres", v); cocher("avatar-lunettes", true); } else cocher("avatar-lunettes", false); }
    rendre();
  });
  // changements venus d'ailleurs (réglages relus au démarrage, modèle homme / femme) : on redessine
  document.addEventListener("change", (e) => { if (e.target.closest && e.target.closest("#perso-avatar, #perso-velo")) rendre(); });
  const ongletPerso = $g("tab-perso");
  if (ongletPerso) ongletPerso.addEventListener("click", () => { apercu(APERCU[vue] || false); rendre(); });
  rendre();
  return { rendre };
})();
