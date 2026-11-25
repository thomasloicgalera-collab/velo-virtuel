"use strict";
/* =====================================================================
   (v103) Écran de course pendant une séance (mode ERG) :
   - à droite, le résumé de la séance : avancement total, liste des blocs, étoiles, intensité ;
   - sous le bandeau du haut, le bloc en cours : cible, avancement, puissance, cœur et cadence.
   Étoile d'un bloc : bloc roulé jusqu'au bout (au moins 60 % mesurés) avec la puissance moyenne tenue
   à 5 % près (8 % pour une rampe, 10 % sous 1 min) ; les premières secondes sont ignorées.
   Effort libre ou guidé par le cœur : l'étoile récompense le bloc roulé.
   ===================================================================== */
const HudSeance = (function () {
  let stats = [], vu = { ints: null, ech: null, n: -1, temps: 0, t0: 0 }, sigListe = "";

  const ecrire = (id, txt) => { const e = $(id); if (e.textContent !== txt) e.textContent = txt; };
  const echappe = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const largeur = (id, part) => { $(id).style.width = (borner(part, 0, 1) * 100).toFixed(1) + "%"; };
  function dureeCourte(min) {
    const s = Math.round(min * 60);
    if (s < 60) return s + " s";
    const m = Math.floor(s / 60), r = s % 60;
    return m + " min" + (r ? " " + deuxChiffres(r) : "");
  }
  const distCourte = (m) => (m >= 1000 ? fr1(m / 1000) + " km" : Math.max(0, Math.round(m / 10) * 10) + " m");
  const watts = (pct) => Math.round(pct * ftp() / 100 * (seance.k || 1));
  function texteCible(iv) {
    if (iv.libre) return "libre";
    if (iv.fc) return "FC " + Math.round(iv.fc * fcmax() / 100);
    return iv.fin !== undefined ? watts(iv.pct) + "→" + watts(iv.fin) + " W" : watts(iv.pct) + " W";
  }
  const couleur = (iv) => (iv.libre ? "#A9B6C6" : ZONES_P[indexZone(ZONES_P, pctMoyen(iv) / 100)].couleur);

  /* ----- étoiles : puissance mesurée pendant chaque bloc ----- */
  function suivre(puissance, t) {
    const ints = seance.intervalles;
    // nouvelle séance, nouvelle sortie ou séance relancée : on repart de zéro (la touche N, elle, fait reculer t0)
    if (vu.ints !== ints || vu.ech !== session.samples || vu.n !== ints.length || balade.temps < vu.temps || seance.t0 > vu.t0 + 0.5) {
      stats = []; sigListe = ""; vu = { ints, ech: session.samples, n: ints.length, temps: balade.temps, t0: seance.t0 };
      return;
    }
    const dt = balade.temps - vu.temps;
    vu.temps = balade.temps; vu.t0 = seance.t0;
    if (!(dt > 0) || dt > 60 || puissance === null) return;
    let debut = 0;
    for (let i = 0; i < ints.length; i++) {
      const iv = ints[i], d = iv.min * 60, ignore = Math.min(15, d * 0.25);
      const a = Math.max(t - dt, debut + ignore), b = Math.min(t, debut + d);
      if (b > a) {
        const st = stats[i] || (stats[i] = { n: 0, p: 0, c: 0 });
        st.n += b - a; st.p += puissance * (b - a);
        if (!iv.libre && !iv.fc) st.c += watts(pctA(iv, ((a + b) / 2 - debut) / d)) * (b - a);
      }
      debut += d;
      if (debut >= t) break;
    }
  }
  function tenu(i) {
    const iv = seance.intervalles[i], st = stats[i], d = iv.min * 60;
    if (!st || st.n < 0.6 * (d - Math.min(15, d * 0.25))) return false;
    if (iv.libre || iv.fc) return true;
    const moy = st.p / st.n, cible = st.c / st.n;
    if (d < 60 && pctMoyen(iv) >= 75) return moy >= 0.9 * cible;                    // effort très court : faire plus fort compte aussi
    return Math.abs(moy - cible) <= (d < 60 ? 0.10 : iv.fin !== undefined ? 0.08 : 0.05) * cible;
  }

  /* ----- lignes de la liste : les répétitions courtes (30/30, sprints) tiennent sur une seule ligne ----- */
  const pareil = (a, b) => !!a && !!b && a.min === b.min && a.pct === b.pct && a.fin === b.fin && a.cad === b.cad && !a.libre === !b.libre && a.fc === b.fc;
  function rangees(ints) {
    const l = [];
    for (let i = 0; i < ints.length;) {
      const a = ints[i], b = ints[i + 1];
      let n = 0;
      if (b && a.min <= 1 && pctMoyen(a) > pctMoyen(b)) while (pareil(ints[i + 2 * n], a) && pareil(ints[i + 2 * n + 1], b)) n++;
      if (n >= 3) { l.push({ de: i, a: i + 2 * n - 1, n, iv: a }); i += 2 * n; }
      else { l.push({ de: i, a: i, n: 0, iv: a }); i++; }
    }
    return l;
  }
  function etoileRangee(r) {
    if (!r.n) return tenu(r.de);
    let ok = 0;
    for (let k = 0; k < r.n; k++) if (tenu(r.de + 2 * k)) ok++;
    return ok >= Math.ceil(0.75 * r.n);
  }

  /* nombre de lignes qui tiennent à droite, au-dessus de la carte et du vent */
  function nbLignes() {
    const zone = $("hud-zone"), base = parseFloat(getComputedStyle(zone).fontSize) || 16;
    const autres = $("hz-carte").offsetHeight + $("hz-aero").offsetHeight;
    return borner(Math.floor((zone.clientHeight - autres - 10.5 * base) / (1.42 * base)), 4, 12);
  }
  function remplirListe(html, avant, apres) {
    const sig = html + "|" + avant + "|" + apres;          // la page n’est réécrite que si ce qu’elle montre change
    if (sig === sigListe) return;
    sigListe = sig;
    $("se-liste").innerHTML = html;
    ecrire("se-avant", avant); ecrire("se-apres", apres);
  }
  const ligne = (classes, coul, signe, texte, detail) => '<li class="se-r' + classes + '" style="--cz:' + coul + '"><i>' + signe + "</i><span>" + (detail ? "<small>" + detail + "</small>" : "") + "<b>" + texte + "</b></span></li>";
  // fenêtre de n lignes autour de la ligne en cours (jusqu'à 3 lignes déjà faites au-dessus)
  const fenetre = (total, cour, n) => borner(cour - Math.min(3, Math.floor(n / 3)), 0, Math.max(0, total - n));

  /* ----- séance faite d'intervalles ----- */
  function majIntervalles(puissance) {
    const ints = seance.intervalles, total = dureeSeance(), t = borner(balade.temps - seance.t0, 0, total);
    suivre(puissance, balade.temps - seance.t0);
    const cur = intervalleA(t), iCour = cur ? cur.i : ints.length;
    largeur("se-part", total ? t / total : 0);
    ecrire("se-fin-l", "Fin dans"); ecrire("se-fin", formatDuree(Math.ceil(total - t)));

    const rs = rangees(ints), jc = rs.findIndex((r) => iCour >= r.de && iCour <= r.a);
    const n = nbLignes(), deb = fenetre(rs.length, jc < 0 ? rs.length - 1 : jc, n), fin = Math.min(rs.length, deb + n);
    let gagnees = 0, h = "";
    rs.forEach((r, j) => {
      const fait = iCour > r.a, et = fait && etoileRangee(r);
      if (et) gagnees++;
      if (j < deb || j >= fin) return;
      const enCours = j === jc;
      const texte = (r.n ? r.n + " × " : "") + dureeCourte(r.iv.min) + " · " + texteCible(r.iv);
      const rep = r.n && enCours ? "répétition " + (Math.floor((iCour - r.de) / 2) + 1) + " sur " + r.n : "";
      h += ligne((fait ? " fait" + (et ? " gagne" : "") : "") + (enCours ? " encours" : ""), couleur(r.iv), fait ? (et ? "★" : "☆") : "", texte, rep);
    });
    remplirListe(h, deb ? "▲ " + deb + (deb > 1 ? " blocs faits" : " bloc fait") : "", fin < rs.length ? "▼ encore " + (rs.length - fin) + (rs.length - fin > 1 ? " blocs" : " bloc") : "");
    ecrire("se-etoiles", "★ " + gagnees + "/" + rs.length);
    $("se-etoiles").title = gagnees + " étoile(s) sur " + rs.length + " : une étoile par bloc tenu jusqu’au bout";

    if (!cur) { $("hz-bloc").hidden = true; return; }
    const iv = cur.iv, d = iv.min * 60;
    let verbe = "Vise", cible = (seance.cibleW || watts(pctA(iv, 1 - cur.reste / d))) + " W", l3 = "pendant " + dureeCourte(iv.min), l4 = "";
    if (iv.libre) { verbe = "Effort"; cible = "libre"; l4 = "à fond, régulier"; }
    else if (iv.fc) { verbe = "Cœur à"; cible = Math.round(iv.fc * fcmax() / 100) + " bpm"; l4 = "soit " + (seance.cibleW || watts(iv.pct)) + " W"; }
    else if (iv.fin !== undefined) l4 = "rampe " + watts(iv.pct) + "→" + watts(iv.fin) + " W";
    if (iv.cad) l4 = "à " + iv.cad + " tr/min";
    blocTexte(verbe, cible, l3, l4);
    $("bl-barre").hidden = false;
    largeur("bl-part", 1 - cur.reste / d);
    ecrire("bl-reste", formatDuree(Math.ceil(cur.reste)));
  }

  /* ----- séance « sur le parcours » : la cible suit la route ----- */
  function majParcours() {
    const info = seance.dynInfo, b = info.bloc || { type: "profil" }, L = route.longueur;
    const x = route.boucle && L > 0 ? ((balade.distance % L) + L) % L : balade.distance;
    const montees = seance.dyn.type === "montees" ? montéesDyn() : [];
    largeur("se-part", L > 0 ? x / L : 0);
    const faites = montees.filter((c) => c.e <= x).length;
    if (montees.length) { ecrire("se-fin-l", route.boucle ? "Montées du tour" : "Montées"); ecrire("se-fin", faites + "/" + montees.length); }
    else { ecrire("se-fin-l", route.boucle ? "Reste du tour" : "Reste"); ecrire("se-fin", L > 0 ? distCourte(L - x) : "–"); }
    let h = "", avant = "", apres = "";
    if (montees.length) {
      const items = montees.map((c, j) => ({ nom: c.nom, l: c.e - c.s, fait: c.e <= x, encours: b.type === "montee" && b.i === j }));
      let jc = items.findIndex((o) => o.encours);
      if (jc < 0) {                                              // récupération : une ligne « Récup » avant la prochaine montée
        jc = b.type === "recup" && b.i >= 0 ? b.i : items.length;
        if (jc < items.length && items[jc].fait) jc = items.length;          // prochaine montée au tour suivant
        items.splice(jc, 0, { recup: true, encours: true });
      }
      const n = nbLignes(), deb = fenetre(items.length, jc, n), fin = Math.min(items.length, deb + n);
      for (let j = deb; j < fin; j++) {
        const o = items[j];
        if (o.recup) h += ligne(" encours", ZONES_P[0].couleur, "", "Récup · " + watts(seance.dyn.recup) + " W", "");
        else h += ligne((o.fait ? " fait" : "") + (o.encours ? " encours" : ""), ZONES_P[indexZone(ZONES_P, seance.dyn.effort / 100)].couleur, "",
          o.encours ? distCourte(o.l) + " · " + watts(seance.dyn.effort) + " W" : echappe(o.nom), o.encours ? echappe(o.nom) : "");
      }
      avant = deb ? "▲ " + deb + " avant" : ""; apres = fin < items.length ? "▼ encore " + (items.length - fin) : "";
    } else h = info.lignes.map((t) => ligne(" info", "#7C93AD", "", echappe(t), "")).join("");
    remplirListe(h, avant, apres);
    ecrire("se-etoiles", "");

    let l3 = "suit la pente", part = null, reste = "";
    if (b.type === "montee") { l3 = "jusqu’au sommet"; part = b.part; reste = distCourte(b.reste); }
    else if (b.type === "recup") { l3 = "récupère"; part = b.part; reste = b.reste === null ? "" : "montée dans " + distCourte(b.reste); }
    else if (b.type === "aucune") l3 = "aucune montée ici";
    blocTexte("Vise", info.watts + " W", l3, b.type === "profil" ? "pente " + fr1(b.pente || 0) + " %" : "");
    $("bl-barre").hidden = part === null;
    if (part !== null) { largeur("bl-part", part); ecrire("bl-reste", reste); }
  }
  function blocTexte(verbe, cible, l3, l4) {
    ecrire("bl-verbe", verbe); ecrire("bl-cible", cible); ecrire("bl-duree", l3); ecrire("bl-detail", l4);
  }

  function maj(puissance, fc) {
    const dyn = !!seance.dyn;
    const actif = modeActuel() === "erg" && (dyn ? !!seance.dynInfo : seance.intervalles.length > 0) && !(typeof Revoir !== "undefined" && Revoir.actif);
    $("hz-seance").hidden = !actif; $("hz-bloc").hidden = !actif;
    if (!actif) return;
    ecrire("se-nom", seance.nom || "Séance");
    ecrire("se-k", Math.round((seance.k || 1) * 100) + " %");
    ecrire("bl-w", puissance !== null ? String(Math.round(puissance)) : "–");
    ecrire("bl-fc", fc !== null && fc !== undefined ? String(fc) : "–");
    ecrire("bl-cad", balade.cadence > 0 ? String(Math.round(balade.cadence)) : "–");
    if (dyn) majParcours(); else majIntervalles(puissance);
  }

  // boutons ▲ ▼ : même réglage d'intensité que les flèches du clavier
  for (const [id, sens] of [["se-plus", 1], ["se-moins", -1]]) $(id).addEventListener("click", (e) => { reglerIntensite(sens); ecrire("se-k", Math.round(seance.k * 100) + " %"); e.currentTarget.blur(); });

  return { maj };
})();
