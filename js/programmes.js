"use strict";
/* =====================================================================
   (v95) Programmes d'entraînement : plusieurs semaines de 3 séances (onglet Séances → Programmes)
   Chaque séance vient de la bibliothèque (BIBLIO, par son nom). Le programme avance quand tu termines la séance
   (au moins 70 % de sa durée, ou 25 min pour une séance qui suit le parcours). Gardé dans le navigateur (velo_programme_v1).
   ===================================================================== */
const Programmes = (function () {
  const CLE = "velo_programme_v1", CLE_FIN = "velo_programmes_finis_v1";
  const JOURS = ["mardi", "jeudi", "samedi"];
  const CATALOGUE = [
    { id: "base", nom: "Base endurance", niveau: "Débutant", desc: "4 semaines pour installer l’endurance : du volume facile, un peu de tempo, une semaine d’allègement. Idéal pour reprendre.",
      semaines: [["Endurance 45 min", "Endurance 1 h", "Récupération active"], ["Endurance 1 h", "Tempo 2 × 15 min", "Endurance 45 min"], ["Endurance 1 h", "Sortie longue 2 h", "Tempo 2 × 15 min"], ["Endurance 45 min", "Récupération active", "Endurance 1 h"]] },
    { id: "ftp", nom: "Monter son FTP", niveau: "Intermédiaire", desc: "6 semaines de sweet spot et de seuil, avec une semaine d’allègement (4) et un test FTP à la fin pour mesurer le gain.",
      semaines: [["Sweet spot 2 × 10 min", "Endurance 1 h", "Tempo 2 × 15 min"], ["Sweet spot 3 × 12 min", "Endurance 45 min", "Seuil 3 × 5 min"], ["Seuil 2 × 20 min", "Récupération active", "Sweet spot 3 × 12 min"], ["Endurance 1 h", "Sweet spot 2 × 10 min", "Récupération active"], ["Seuil 2 × 20 min", "Over-under", "Sortie longue 2 h"], ["Endurance 45 min", "Seuil 3 × 5 min", "Test FTP 20 minutes"]] },
    { id: "montagne", nom: "Préparation montagne", niveau: "Intermédiaire", desc: "6 semaines pour grimper : séances qui suivent le profil du parcours et efforts dans les montées (choisis un parcours qui monte : Alpes, Pyrénées, Ventoux, Ardennes).",
      semaines: [["Endurance 1 h", "Suivre le profil – endurance", "Tempo 2 × 15 min"], ["Efforts en montée – tempo (85 %)", "Endurance 1 h", "Sweet spot 2 × 10 min"], ["Efforts en montée – seuil (98 %)", "Sortie longue 2 h", "Suivre le profil – tempo"], ["Endurance 45 min", "Récupération active", "Efforts en montée – tempo (85 %)"], ["Efforts en montée – seuil (98 %)", "Over-under", "Sortie longue 2 h"], ["Efforts en montée – VO2 (112 %)", "Endurance 1 h", "Test FTP 2 × 8 minutes"]] },
    { id: "vo2", nom: "Explosivité et VO2max", niveau: "Avancé", desc: "4 semaines intenses : efforts de 30 s à 5 min et sprints, avec de l’endurance entre les séances dures. Pour passer un cap en course.",
      semaines: [["VO2max 5 × 3 min", "Endurance 1 h", "Pyramide"], ["30/30 – 2 séries de 8", "Endurance 45 min", "VO2max 5 × 3 min"], ["Sprints 8 × 15 s", "Sweet spot 2 × 10 min", "Pyramide"], ["Endurance 45 min", "Récupération active", "Seuil 3 × 5 min"]] }
  ];
  const lire = () => { try { const j = JSON.parse(localStorage.getItem(CLE)); return j && CATALOGUE.some((p) => p.id === j.id) ? j : null; } catch (e) { return null; } };
  let etat = lire();
  const ecrire = () => { try { if (etat) localStorage.setItem(CLE, JSON.stringify(etat)); else localStorage.removeItem(CLE); } catch (e) { /* stockage indisponible */ } };
  const prog = () => (etat ? CATALOGUE.find((p) => p.id === etat.id) : null);
  const cle = (w, s) => w + "-" + s;
  const item = (nom) => itemsBiblio().find((x) => x.nom === nom) || null;
  const duree = (nom) => { const it = item(nom); return it && !it.dyn ? Math.round(statsSeance(it.ints).sec) : 0; };
  const prochaine = () => {
    const p = prog();
    if (!p || !etat) return null;
    for (let w = 0; w < p.semaines.length; w++) for (let s = 0; s < p.semaines[w].length; s++) if (!etat.faits[cle(w, s)]) return { w, s, nom: p.semaines[w][s] };
    return null;
  };
  const nbFaites = () => Object.keys(etat ? etat.faits : {}).length;
  const total = (p) => p.semaines.reduce((a, w) => a + w.length, 0);

  // appelée à la fin d'une sortie : coche la première séance du programme portant ce nom (si assez longue)
  function fait(nom, secondes) {
    const p = prog();
    if (!p || !nom) return null;
    const idx = p.semaines.map((w, wi) => w.map((n, si) => [wi, si, n])).flat().find(([wi, si, n]) => n === nom && !etat.faits[cle(wi, si)]);
    if (!idx) return null;
    const it = item(nom), d = it && !it.dyn ? statsSeance(it.ints).sec : 25 * 60;
    if (secondes < 0.7 * d) return null;
    etat.faits[cle(idx[0], idx[1])] = Date.now();
    const fini = nbFaites() >= total(p);
    if (fini) { try { const l = JSON.parse(localStorage.getItem(CLE_FIN) || "[]"); l.push({ id: p.id, date: Date.now() }); localStorage.setItem(CLE_FIN, JSON.stringify(l)); } catch (e) { /* ignoré */ } }
    ecrire(); rendre();
    return { semaine: idx[0] + 1, seance: idx[1] + 1, nom, fini, programme: p.nom, reste: total(p) - nbFaites() };
  }
  function commencer(id) { etat = { id, debut: Date.now(), faits: {} }; ecrire(); rendre(); }
  function abandonner() { if (!confirm("Abandonner le programme « " + prog().nom + " » ? Ta progression sera perdue.")) return; etat = null; ecrire(); rendre(); }
  function rouler(nom) {
    const it = item(nom);
    if (!it) { log("Séance « " + nom + " » introuvable dans la bibliothèque."); return; }
    rouleSeance(it);
  }
  const fmtDuree = (nom) => { const d = duree(nom); return d ? formatDuree(d) : "selon le parcours"; };
  function rendre() {
    const c = $("sq-prog");
    if (!c) return;
    const p = prog();
    if (!p) {
      c.innerHTML = '<p class="info">Un programme, c’est plusieurs semaines de <b>3 séances</b> (par exemple mardi, jeudi, samedi) qui s’enchaînent. Choisis-en un : l’application te propose la séance suivante et coche celles que tu termines.</p><div class="pg-liste">' +
        CATALOGUE.map((q) => '<div class="pg-carte"><div class="pg-t"><b>' + q.nom + "</b><span>" + q.semaines.length + " semaines · " + q.niveau + "</span></div><p>" + q.desc + '</p><button type="button" class="plein" data-pg="' + q.id + '">Commencer</button></div>').join("") + "</div>";
      c.querySelectorAll("button[data-pg]").forEach((b) => b.addEventListener("click", () => commencer(b.dataset.pg)));
      return;
    }
    const pr = prochaine(), nf = nbFaites(), tt = total(p), pct = Math.round(100 * nf / tt);
    let h = '<div class="pg-entete"><div><b>' + p.nom + "</b><span>" + (pr ? "Semaine " + (pr.w + 1) + " sur " + p.semaines.length : "Programme terminé !") + " · " + nf + "/" + tt + ' séances</span></div><div class="pg-barre"><i style="width:' + pct + '%"></i></div></div>';
    if (pr) {
      const it = item(pr.nom), st = it && !it.dyn ? statsSeance(it.ints) : null;
      h += '<div class="pg-suite"><div class="pg-t"><b>Prochaine séance · ' + JOURS[pr.s] + "</b><span>" + fmtDuree(pr.nom) + (st ? " · " + niveauSeance(st.IF).toLowerCase() : "") + "</span></div><h3>" + pr.nom + "</h3><p>" + (it ? it.desc : "") + '</p><button type="button" class="plein" id="pg-rouler">Rouler cette séance ▶</button></div>';
    } else {
      h += '<div class="pg-suite"><h3>Bravo, programme terminé !</h3><p>' + (p.id === "ftp" || p.id === "montagne" ? "Ton dernier test FTP est à jour : consulte l’onglet Historique pour voir la progression. " : "") + "Tu peux enchaîner avec un autre programme ou refaire celui-ci.</p></div>";
    }
    h += '<div class="pg-semaines">' + p.semaines.map((w, wi) => '<div class="pg-sem' + (pr && pr.w === wi ? " cour" : "") + '"><b>Semaine ' + (wi + 1) + "</b>" +
      w.map((n, si) => { const ok = !!etat.faits[cle(wi, si)], cur = pr && pr.w === wi && pr.s === si; return '<button type="button" class="pg-s' + (ok ? " ok" : "") + (cur ? " cur" : "") + '" data-nom="' + n.replace(/"/g, "&quot;") + '"><span>' + (ok ? "✓" : cur ? "▶" : "○") + "</span><em>" + JOURS[si] + "</em>" + n + "</button>"; }).join("") + "</div>").join("") + "</div>";
    h += '<div class="barre"><button type="button" class="petit" id="pg-abandon">' + (pr ? "Abandonner ce programme" : "Terminer et choisir un autre programme") + "</button></div>";
    c.innerHTML = h;
    if ($("pg-rouler")) $("pg-rouler").addEventListener("click", () => rouler(pr.nom));
    c.querySelectorAll(".pg-s").forEach((b) => b.addEventListener("click", () => rouler(b.dataset.nom)));
    $("pg-abandon").addEventListener("click", () => { if (!pr) { etat = null; ecrire(); rendre(); } else abandonner(); });
  }
  return { rendre, fait, prochaine, actif: () => !!prog(), nom: () => (prog() ? prog().nom : "") };
})();
