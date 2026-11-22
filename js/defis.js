"use strict";
/* =====================================================================
   (v97) Défis de la semaine entre amis : meilleur temps de chaque semaine sur les segments chronométrés (montées, sprints, secteurs).
   Les temps des amis arrivent par la sortie de groupe (messages « rec ») ou par un « code défi » collé à la main ; tout est gardé dans ce navigateur
   (velo_defis_semaine_v1), la semaine (lundi à dimanche) repart de zéro chaque lundi. Mon propre temps est toujours « Toi ».
   ===================================================================== */
const Defis = (function () {
  const CLE = "velo_defis_semaine_v1", PREF = "VD1:";
  const semaineDe = (d) => {                                   // numéro de semaine ISO, « 2026-W47 »
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), j = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - j);
    const a = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return t.getUTCFullYear() + "-W" + Math.ceil(((t - a) / 86400000 + 1) / 7);
  };
  const cetteSemaine = (ms) => semaineDe(new Date(ms)) === semaineDe(new Date());
  const lire = () => { try { const j = JSON.parse(localStorage.getItem(CLE)); return j && j.sem === semaineDe(new Date()) && j.seg ? j : null; } catch (e) { return null; } };
  let data = lire() || { sem: semaineDe(new Date()), seg: {} };
  const sauver = () => { try { localStorage.setItem(CLE, JSON.stringify(data)); } catch (e) { /* stockage indisponible */ } };
  function verifierSemaine() { if (data.sem !== semaineDe(new Date())) { data = { sem: semaineDe(new Date()), seg: {} }; sauver(); } }

  function ajouter(cle, nom, monde, auteur, t, date) {
    verifierSemaine();
    if (!cle || !(t > 0) || !auteur) return false;
    const s = data.seg[cle] = data.seg[cle] || { nom, monde, res: {} }, r = s.res[auteur];
    if (r && r.t <= t) return false;
    s.res[auteur] = { t: Math.round(t * 10) / 10, date: date || Date.now() };
    sauver();
    return true;
  }
  // mon temps sur un segment que je viens de terminer (appelé par Progression)
  function moi(cle, nom, monde, t) { if (ajouter(cle, nom, monde, "Toi", t, Date.now())) rendre(); }
  // temps reçus d'un ami (sortie de groupe)
  function recu(auteur, recs) {
    let neuf = false;
    for (const x of recs || []) if (Array.isArray(x) && x.length >= 5 && cetteSemaine(x[4])) neuf = ajouter(x[0], x[1], x[2], auteur === "Toi" ? "Toi (ami)" : auteur, x[3], x[4]) || neuf;
    if (neuf) rendre();
  }
  const mesRecs = () => { verifierSemaine(); return Object.keys(data.seg).filter((c) => data.seg[c].res.Toi).map((c) => [c, data.seg[c].nom, data.seg[c].monde, data.seg[c].res.Toi.t, data.seg[c].res.Toi.date]); };

  const nomPartage = () => ($("groupe-nom") && $("groupe-nom").value.trim()) || "Cycliste";
  function code(cle) {
    const s = data.seg[cle], r = s && s.res.Toi;
    if (!r) return "";
    return PREF + btoa(unescape(encodeURIComponent(JSON.stringify({ a: nomPartage(), c: cle, n: s.nom, m: s.monde, t: r.t, d: r.date }))));
  }
  function importer(texte) {
    texte = (texte || "").trim();
    if (!texte.startsWith(PREF)) return "Ce n’est pas un code défi (il commence par " + PREF + ").";
    let o;
    try { o = JSON.parse(decodeURIComponent(escape(atob(texte.slice(PREF.length))))); } catch (e) { return "Code illisible : copie-le en entier."; }
    if (!o || !o.c || !(o.t > 0) || !o.a) return "Code incomplet.";
    ajouter(o.c, o.n, o.m, String(o.a).slice(0, 18) === "Toi" ? "Toi (ami)" : String(o.a).slice(0, 18), o.t, Date.now());   // il compte pour la semaine en cours
    rendre();
    return "Défi de " + o.a + " ajouté : « " + o.n + " » (" + o.m + ") en " + formatDuree(Math.round(o.t)) + ". Roule ce segment cette semaine pour le battre !";
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  function rendre() {
    const c = $("defis-c");
    if (!c) return;
    verifierSemaine();
    const cles = Object.keys(data.seg).sort((a, b) => Object.keys(data.seg[b].res).length - Object.keys(data.seg[a].res).length || (data.seg[b].res.Toi ? 1 : 0) - (data.seg[a].res.Toi ? 1 : 0)).slice(0, 6);
    const nbAmis = new Set(cles.flatMap((k) => Object.keys(data.seg[k].res)).filter((n) => n !== "Toi")).size;
    $("defis-resume").textContent = cles.length ? cles.length + (cles.length > 1 ? " segments" : " segment") + (nbAmis ? " · " + nbAmis + (nbAmis > 1 ? " amis" : " ami") : "") : "semaine " + data.sem.split("-W")[1];
    if (!cles.length) { c.innerHTML = '<div class="info">Aucun temps cette semaine. Roule des segments chronométrés (montées, sprints) : tes meilleurs temps de la semaine apparaissent ici, avec ceux de tes amis quand vous roulez en groupe ou si tu colles leur code défi ci-dessous.</div>'; return; }
    c.innerHTML = cles.map((k) => {
      const s = data.seg[k], l = Object.keys(s.res).map((n) => [n, s.res[n].t]).sort((a, b) => a[1] - b[1]);
      const rang = l.findIndex((x) => x[0] === "Toi");
      const lignes = l.slice(0, 5).map((x, i) => '<div class="df-l' + (x[0] === "Toi" ? " moi" : "") + '"><span>' + (i + 1) + ". " + esc(x[0] === "Toi" ? "Toi" : x[0]) + "</span><b>" + formatDuree(Math.round(x[1])) + (i ? " <em>+" + Math.round(x[1] - l[0][1]) + " s</em>" : "") + "</b></div>").join("") +
        (rang >= 5 ? '<div class="df-l moi"><span>' + (rang + 1) + ". Toi</span><b>" + formatDuree(Math.round(l[rang][1])) + "</b></div>" : "");
      return '<div class="df-seg"><div class="df-t"><b>' + esc(s.nom) + "</b><span>" + esc(s.monde || "") + "</span></div>" + lignes +
        (rang < 0 ? '<div class="info">Pas encore roulé par toi cette semaine : à toi de jouer sur « ' + esc(s.monde || "ce parcours") + " ».</div>" : '<button type="button" class="petit" data-code="' + esc(k) + '">Copier mon code défi</button>') + "</div>";
    }).join("");
    c.querySelectorAll("button[data-code]").forEach((b) => b.addEventListener("click", async () => {
      const t = code(b.dataset.code);
      try { await navigator.clipboard.writeText(t); b.textContent = "Code copié ✓"; } catch (e) { window.prompt("Copie ce code et envoie-le à ton ami :", t); }
    }));
  }
  if ($("defis-ajout")) {
    $("defis-ajout").addEventListener("click", () => { $("defis-msg").textContent = importer($("defis-code").value); $("defis-code").value = ""; });
    rendre();
  }
  return { moi, recu, mesRecs, rendre, importer, code, donnees: () => data };
})();
