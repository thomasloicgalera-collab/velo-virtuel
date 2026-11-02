"use strict";
/* =====================================================================
   Réglages et démarrage
   ===================================================================== */
$("btn-balade").addEventListener("click", () => {
  if (typeof Revoir !== "undefined" && Revoir.actif) { Revoir.basculer(); return; }   // (v69 suite) on revoit une sortie : pas d'enregistrement
  balade.enCours = !balade.enCours;
  balade.auto = false; balade.immobile = 0;
  if (balade.enCours && !session.debut) session.debut = Date.now();
  balade.dernier = maintenant();
  majBoutonBalade();
});
$("pente-manuelle").addEventListener("input", (e) => {
  $("pente-manuelle-val").innerHTML = fr1(parseFloat(e.target.value)) + "&nbsp;%";
});
function majTexteDifficulte() {
  const d = parseInt($("difficulte").value, 10);
  $("difficulte-val").innerHTML = d + "&nbsp;% (une pente de 10&nbsp;% est envoyée au home trainer à " + fr1(d / 10 * RESISTANCE_PLUS).replace(",0", "") + "&nbsp;%, résistance +20&nbsp;% comprise)";
}
$("difficulte").addEventListener("input", () => { majTexteDifficulte(); sauverReglages(); });
$("difficulte-desc").addEventListener("input", () => { majTexteDescente(); derniereEnvoyee = null; sauverReglages(); });
majTexteDescente();
$("auto-pause").addEventListener("change", () => { balade.auto = false; sauverReglages(); });
$("auto-depart").addEventListener("change", sauverReglages);
$("freinage").addEventListener("change", () => { Aero.reg.frein = $("freinage").checked; sauverReglages(); });
["vibrations", "ravito"].forEach((id) => $(id).addEventListener("change", () => sauverReglages()));   // (v72) les vibrations ne touchent plus le home trainer
function lireAero() { Aero.reg.vent = $("vent-actif").checked; Aero.reg.materiel = parseFloat($("materiel-aero").value) || 0; majMateriel(); }
// vélo et roues choisis : leur poids et leur gain d'air entrent dans la vitesse (et le gain d'air dans la résistance du home trainer) ; fiche résumée
function majMateriel() {
  const m = materielVelo($("avatar-velo").value, $("avatar-roues").value), ref = materielVelo("simple", "35");
  Aero.reg.velo = m.aero; Aero.reg.masseVelo = m.masse; Aero.reg.clm = m.clm; if (!m.clm) Aero.reg.groupe = 0;
  const el = $("fiche-velo"); if (!el) return;
  const poids = parseFloat($("poids").value) || 75;
  const plat = 33.4 * (1 / Math.cbrt(1 - m.aero) - 1);                   // km/h gagnés à 250 W sur le plat (33,4 km/h avec le vélo simple dans le jeu) (vitesse ∝ (P / CdA)^(1/3))
  const montee = ((ref.masse - m.masse) / (poids + ref.masse)) * 100;      // % de vitesse gagné dans une montée raide (vitesse ∝ 1 / masse)
  const jauge = (x) => '<span class="jauge"><span style="width:' + Math.round(Math.max(4, Math.min(100, x))) + '%"></span></span>';
  const fr = (x, n) => x.toFixed(n).replace(".", ",");
  el.innerHTML = '<div class="fiche-ligne"><b>' + fr(m.masse, 1) + '&nbsp;kg</b> · air <b>−' + fr(m.aero * 100, 1).replace(",0", "") + '&nbsp;%</b></div>' +
    '<div class="fiche-ligne">Plat ' + jauge(m.aero / 0.05 * 100) + ' <small>+' + fr(plat, 1) + '&nbsp;km/h à 250&nbsp;W</small></div>' +
    '<div class="fiche-ligne">Montée ' + jauge((ref.masse - m.masse) / 1.3 * 100) + ' <small>' + (montee >= 0 ? '+' : '−') + fr(Math.abs(montee), 1) + '&nbsp;% de vitesse</small></div>' +
    (m.clm ? '<div class="fiche-ligne"><small>En groupe (à moins de ' + GROUPE_DIST + '&nbsp;m d’un autre coureur)&nbsp;: tu te relèves sur les cornes, le gain d’air tombe à −' +
      fr(m.aero * (1 - MALUS_CLM_AIR) * 100, 1).replace(",0", "") + '&nbsp;% et l’aspiration est réduite de moitié.</small></div>' : '');
}
["vent-actif", "materiel-aero"].forEach((id) => $(id).addEventListener("change", () => { lireAero(); sauverReglages(); }));
$("affiche-3d").addEventListener("change", () => { $("monde-conteneur").hidden = !$("affiche-3d").checked; sauverReglages(); });
$("monde").addEventListener("change", () => { if (monde3d) monde3d.definirTheme($("monde").value); sauverReglages(); });
$("meteo").addEventListener("change", () => { if (monde3d) monde3d.definirMeteo($("meteo").value); sauverReglages(); });
$("saison").addEventListener("change", () => { if (monde3d) monde3d.definirSaison($("saison").value); sauverReglages(); });
$("pietons").addEventListener("change", () => { if (monde3d) monde3d.definirEffets({ pietons: parseInt($("pietons").value, 10) }); sauverReglages(); });
$("foule").addEventListener("change", () => { if (monde3d) monde3d.definirEffets({ foule: parseInt($("foule").value, 10) }); sauverReglages(); });
$("moment").addEventListener("change", () => { if (monde3d) monde3d.definirMoment($("moment").value); sauverReglages(); });
$("qualite").addEventListener("change", () => { if (monde3d) monde3d.definirQualite($("qualite").value); sauverReglages(); });
function appliquerSon() { Son.regler($("son-actif").checked, parseInt($("son-volume").value, 10) / 100); }
$("son-actif").addEventListener("change", () => { appliquerSon(); sauverReglages(); });
$("son-volume").addEventListener("input", () => { appliquerSon(); sauverReglages(); });
$("poussiere").addEventListener("change", () => { if (monde3d) monde3d.definirEffets({ poussiere: $("poussiere").checked }); sauverReglages(); });
const PEAUX = [0xfbe0cc, 0xf1c9a5, 0xe0ac82, 0xc68a62, 0xa8693f, 0x8d5a3b, 0x6b4328, 0x4a2e1d];
const CHEVEUX = [0x1b1511, 0x3b2a1e, 0x6b3f24, 0x8a5a33, 0xc08a45, 0xe6c27a, 0xb5482a, 0xb8b8b8, 0xf2f2f2, 0x3b82f6, 0xe84a8a];
const hexCss = (n) => "#" + n.toString(16).padStart(6, "0");
function ombrer(n, f) {   // éclaircit (f > 0) ou assombrit (f < 0) une couleur
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(Math.max(0, Math.min(255, f >= 0 ? v + (255 - v) * f : v * (1 + f)))));
  return "rgb(" + c.join(",") + ")";
}
function remplirPastilles(id, couleurs, champ) {
  const cont = $(id); cont.innerHTML = "";
  couleurs.forEach((c) => {
    const b = document.createElement("button"); b.type = "button"; b.style.background = hexCss(c);
    b.setAttribute("aria-label", "Couleur " + hexCss(c)); b.dataset.val = String(c);
    b.addEventListener("click", () => { $(champ).value = String(c); marquerPastilles(); appliquerAvatar(); sauverReglages(); });
    cont.append(b);
  });
}
function marquerPastilles() {
  for (const [id, champ] of [["pastilles-peau", "avatar-peau"], ["pastilles-cheveux", "avatar-cheveux"]])
    $(id).querySelectorAll("button").forEach((b) => b.classList.toggle("choisi", b.dataset.val === $(champ).value));
}
function lireApparence() {
  return { peau: parseInt($("avatar-peau").value, 10), cheveux: parseInt($("avatar-cheveux").value, 10), coiffure: $("avatar-coiffure").value, barbe: $("avatar-barbe").value, casqueCouleur: parseInt($("avatar-casque-couleur").value, 10), verres: $("avatar-verres").value,
    bas: parseInt($("avatar-bas").value, 10), chaussettes: parseInt($("avatar-chaussettes").value, 10), yeux: $("avatar-yeux").value, basStyle: $("avatar-bas-style").value, casque: $("avatar-casque").checked, lunettes: $("avatar-lunettes").checked, realiste: $("avatar-realiste").checked, velo: $("avatar-velo").value, roues: $("avatar-roues").value };
}
function dessinPolygones() {
  const a = lireApparence(), f = $("sexe").value === "femme", mj = parseInt($("avatar-maillot").value, 10);
  const P = a.peau, H = a.cheveux, J = mj, B = a.bas, lum = (((mj >> 16) & 255) * 0.3 + ((mj >> 8) & 255) * 0.59 + (mj & 255) * 0.11) / 255;
  const AC = lum > 0.58 ? "#2b2f3a" : "#ffd8a8";
  const sh = (c, k) => ombrer(c, k);
  let defs = "", n = 0, o = "";
  const gr = (c, horiz) => {      // dégradé : donne du volume aux formes lisses
    const id = "ga" + (n++);
    defs += '<linearGradient id="' + id + '" x1="0" y1="0" x2="' + (horiz === false ? 0 : 1) + '" y2="' + (horiz === false ? 1 : 0) + '"><stop offset="0" stop-color="' + sh(c, -0.18) + '"/><stop offset=".55" stop-color="' + sh(c, 0) + '"/><stop offset="1" stop-color="' + sh(c, 0.12) + '"/></linearGradient>';
    return "url(#" + id + ")";
  };
  const pa = (d, c) => '<path d="' + d + '" fill="' + gr(c) + '"/>';
  const duo = (d, c) => pa(d, c) + '<g transform="translate(200,0) scale(-1,1)">' + pa(d, c) + "</g>";
  const long = a.basStyle === "long";
  // ombre au sol
  o += '<ellipse cx="100" cy="352" rx="62" ry="6" fill="rgba(0,0,0,.18)"/>';
  // jambes : cuissard, mollets (peau ou collant), chaussettes, chaussures
  o += duo("M67,190 C61,218 62,246 66,268 L97,268 C100,244 101,216 100,190 Z", B);
  o += duo("M68,268 C66,292 68,314 72,334 L92,334 C95,314 96,292 96,268 Z", long ? B : P);
  if (!long) o += duo("M71,312 L93,312 L92,334 L72,334 Z", 0xf2f4f6);
  o += duo("M71,334 L93,334 C95,340 99,342 100,348 C100,352 96,353 90,353 L68,353 C62,353 62,348 66,344 C69,342 70,338 71,334 Z", 0xf2f4f6);
  o += '<path d="M62,351 L100,351 L100,355 L60,355 Z" fill="#23272e"/><path d="M100,351 L138,351 L140,355 L100,355 Z" fill="#23272e"/>';
  // bras : manche, bras, avant-bras, gant
  o += duo("M62,98 C51,102 45,116 44,130 L62,134 C63,120 68,108 74,101 Z", J);
  o += duo("M44,130 C42,138 41,146 41,152 L56,156 C57,148 60,140 62,134 Z", P);
  o += duo("M41,152 C39,172 38,190 38,204 L52,206 C54,190 55,172 56,156 Z", P);
  o += duo("M38,204 C34,212 35,224 41,228 C48,230 54,224 52,206 Z", 0x1b1d22);
  o += duo("M44,130 L62,134 L61,140 L43,136 Z", J);
  // torse : maillot (taille plus marquée pour la femme)
  o += duo(f ? "M100,92 L72,96 C62,100 60,118 63,140 C66,160 68,176 70,192 L100,192 Z" : "M100,92 L70,96 C60,100 58,118 60,140 C62,160 66,176 68,192 L100,192 Z", J);
  o += duo("M100,90 C90,92 84,94 80,96 C86,102 94,106 100,108 Z", J);
  o += '<path d="M100,92 L100,192" stroke="' + AC + '" stroke-width="1.6" opacity=".7"/>';
  o += duo("M69,184 L100,184 L100,196 C86,198 74,196 68,194 Z", B);
  // cou et tête
  o += duo("M92,72 L92,92 C95,98 98,99 100,99 L100,72 Z", sh(P, -0.14) === "" ? P : P);
  o += '<ellipse cx="100" cy="46" rx="19.5" ry="25" fill="' + gr(P) + '"/>';
  o += '<ellipse cx="80.5" cy="48" rx="3.4" ry="6" fill="' + sh(P, -0.08) + '"/><ellipse cx="119.5" cy="48" rx="3.4" ry="6" fill="' + sh(P, -0.08) + '"/>';
  // visage
  o += '<ellipse cx="91" cy="46" rx="3.6" ry="2.4" fill="#f4f1ec"/><ellipse cx="109" cy="46" rx="3.6" ry="2.4" fill="#f4f1ec"/><circle cx="91" cy="46" r="1.7" fill="#2a1c12"/><circle cx="109" cy="46" r="1.7" fill="#2a1c12"/>';
  o += '<path d="M86,40 Q91,37.5 96,40 M104,40 Q109,37.5 114,40" stroke="' + sh(H, -0.1) + '" stroke-width="2" fill="none" stroke-linecap="round"/>';
  o += '<path d="M100,48 C98,54 97,58 100,60 C103,58 102,54 100,48" fill="' + sh(P, -0.12) + '"/>';
  o += '<path d="M93,66 Q100,70 107,66" stroke="#a8554d" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
  // coiffure ou casque
  if (!a.casque) {
    if (a.coiffure !== "chauve") o += '<path d="M79,44 C77,24 88,16 100,16 C112,16 123,24 121,44 C118,34 112,28 100,28 C88,28 82,34 79,44 Z" fill="' + gr(H) + '"/>';
    if (a.coiffure === "mi-long") o += '<path d="M79,44 C75,60 76,74 80,84 C84,76 84,60 82,46 Z M121,44 C125,60 124,74 120,84 C116,76 116,60 118,46 Z" fill="' + gr(H) + '"/>';
    if (a.coiffure === "chignon") o += '<ellipse cx="100" cy="11" rx="10" ry="8" fill="' + gr(H) + '"/>';
    if (a.coiffure === "queue") o += '<path d="M120,30 C132,40 134,66 128,92 C124,72 120,56 118,42 Z" fill="' + gr(H) + '"/>';
  } else {
    o += '<path d="M77,44 C74,22 86,12 100,12 C114,12 126,22 123,44 C120,32 112,26 100,26 C88,26 80,32 77,44 Z" fill="' + gr(0xf2f4f6) + '"/><path d="M90,15 L90,24 M100,13 L100,24 M110,15 L110,24" stroke="#23272e" stroke-width="2.4"/>';
  }
  if (a.lunettes) o += '<path d="M82,41 L118,41 C118,50 112,53 107,53 C102,53 101,48 100,47 C99,48 98,53 93,53 C88,53 82,50 82,41 Z" fill="#1d2b3a" opacity=".92"/>';
  return '<defs>' + defs + '</defs>' + o;
}
function apercuAvatarSvg() { return '<svg viewBox="0 0 200 360" xmlns="http://www.w3.org/2000/svg">' + dessinPolygones() + '</svg>'; }
// aperçu de l’avatar : le vrai cycliste en 3D (il tourne lentement, on peut le faire pivoter en le faisant glisser) ; dessin plat si la 3D est indisponible
let apercuAng = 0.9, apercuBoucle = false, apercuGlisse = null, apercuVelo = false;
// sous-onglets de Personnalisation : l'avatar et ses réglages, ou le vélo seul (aperçu sans le cycliste) et ses réglages
function choisirSousOngletPerso(velo) {
  if (velo !== apercuVelo) apercuAng = velo ? Math.PI / 2 + 0.25 : 0.9;     // vélo : vu du côté de la transmission
  apercuVelo = velo;
  $("perso-tab-avatar").setAttribute("aria-selected", String(!velo)); $("perso-tab-velo").setAttribute("aria-selected", String(velo));
  $("perso-avatar").hidden = velo; $("perso-velo").hidden = !velo;
  $("apercu-legende").textContent = "Aperçu 3D de ton " + (velo ? "vélo" : "coureur") + " : fais-le tourner en le faisant glisser avec la souris.";
}
$("perso-tab-avatar").addEventListener("click", () => choisirSousOngletPerso(false));
$("perso-tab-velo").addEventListener("click", () => choisirSousOngletPerso(true));
function boucleApercu() {
  if ($("onglet-perso").hidden || !monde3d || !monde3d.apercu) { apercuBoucle = false; return; }
  if (apercuGlisse === null) apercuAng += 0.004;
  $("apercu-3d").hidden = false;
  const ok = monde3d.apercu($("apercu-3d"), apercuAng, apercuVelo);
  $("apercu-3d").hidden = !ok; $("apercu-avatar").hidden = ok;
  requestAnimationFrame(boucleApercu);
}
function majApercu() {
  const el = $("apercu-avatar"); if (el) el.innerHTML = apercuAvatarSvg();
  if (!apercuBoucle && monde3d && monde3d.apercu && !$("onglet-perso").hidden) { apercuBoucle = true; requestAnimationFrame(boucleApercu); }
}
$("apercu-3d").addEventListener("pointerdown", (e) => { apercuGlisse = e.clientX; $("apercu-3d").setPointerCapture(e.pointerId); });
$("apercu-3d").addEventListener("pointermove", (e) => { if (apercuGlisse === null) return; apercuAng -= (e.clientX - apercuGlisse) * 0.012; apercuGlisse = e.clientX; });
for (const ev of ["pointerup", "pointercancel"]) $("apercu-3d").addEventListener(ev, () => { apercuGlisse = null; });
function appliquerAvatar() {
  if (monde3d) {
    monde3d.definirAvatar($("sexe").value, parseInt($("avatar-maillot").value, 10));
    monde3d.definirApparence(lireApparence());
  }
  majMateriel();
  majApercu();
}
remplirPastilles("pastilles-peau", PEAUX, "avatar-peau");
remplirPastilles("pastilles-cheveux", CHEVEUX, "avatar-cheveux");
marquerPastilles();
$("sexe").addEventListener("change", () => { $("avatar-coiffure").value = $("sexe").value === "femme" ? "chignon" : "court"; appliquerAvatar(); sauverReglages(); });
["avatar-maillot", "avatar-coiffure", "avatar-barbe", "avatar-casque-couleur", "avatar-verres", "avatar-bas", "avatar-chaussettes", "avatar-yeux", "avatar-bas-style", "avatar-casque", "avatar-lunettes", "avatar-realiste", "avatar-velo", "avatar-roues"].forEach((id) => $(id).addEventListener("change", () => { appliquerAvatar(); sauverReglages(); }));
["peloton-mode", "peloton-niveau"].forEach((id) => $(id).addEventListener("change", sauverReglages));
$("peloton-tours").addEventListener("change", () => { sauverReglages(); majResumeChoix(); });
$("peloton-nombre").addEventListener("change", sauverReglages);
$("fantome-pr").addEventListener("change", () => { sauverReglages(); envoyerPeloton3D(); tours.sig = ""; });
$("fantome-seg").addEventListener("change", () => { sauverReglages(); envoyerPeloton3D(); });
function appliquerTailleHud() {
  const v = parseInt($("hud-taille").value, 10) || 100;
  document.querySelectorAll(".hud-zone").forEach((e) => e.style.setProperty("--hud", v / 100));
  $("hud-taille-v").textContent = v + "\u00a0%";
}
$("hud-taille").addEventListener("input", () => { appliquerTailleHud(); sauverReglages(); });
$("vue-camera").addEventListener("change", () => { if (monde3d) monde3d.definirVue($("vue-camera").value); sauverReglages(); });
$("resolution").addEventListener("change", () => { if (monde3d) monde3d.definirResolution(parseInt($("resolution").value, 10)); sauverReglages(); });
["age", "taille"].forEach((id) => $(id).addEventListener("change", sauverReglages));
$("btn-fcmax-estime").addEventListener("click", () => {
  const a = parseInt($("age").value, 10);
  if (!(a >= 10)) return;
  $("fcmax").value = Math.round(208 - 0.7 * a);
  $("fcmax").dispatchEvent(new Event("change"));
  log("FC max estimée à " + $("fcmax").value + " bpm (208 − 0,7 × âge).");
});
["ftp", "fcmax", "poids"].forEach((id) => $(id).addEventListener("change", () => { sauverReglages(); rendreSeance(); majStats(); }));
document.querySelectorAll("input[name=mode]").forEach((r) => r.addEventListener("change", () => {
  reinitialiserEnvois();
  if (modeActuel() === "erg") seance.t0 = balade.temps;
}));
window.addEventListener("resize", () => {
  dessinerProfil(); dessinerSeance(); dessinerGraphique($("graphique"), session.samples, ftp(), fcmax());
  if (detail) dessinerGraphique($("detail-graphique"), detail.samples, detail.resume.ftp, detail.resume.fcmax);
});

// (v72) ambiance tirée au hasard au démarrage et à chaque nouvelle sortie (entrerMonde) : moment de la journée, saison ; météo toujours « Aléatoire »
function tirerAmbiance(appliquer) {
  const auHasard = (id) => { const o = $(id).options; $(id).value = o[Math.floor(Math.random() * o.length)].value; };
  auHasard("moment"); auHasard("saison"); $("meteo").value = "auto";
  if (appliquer && monde3d) { monde3d.definirMoment($("moment").value); monde3d.definirSaison($("saison").value, true); monde3d.definirMeteo("auto"); }   // la saison suit le definirTheme du nouveau monde (entrerMonde)
}
(async function demarrer() {
  const r = chargerReglages();
  if (r.ftp) $("ftp").value = r.ftp;
  if (r.fcmax) $("fcmax").value = r.fcmax;
  $("vent-actif").checked = true; $("materiel-aero").value = "0";   // (v72) vent toujours actif, matériel aéro standard (le vélo et les roues choisis comptent déjà) : plus réglables
  lireAero();
  if (r.autoDepart === false) $("auto-depart").checked = false;
  if (r.poids) $("poids").value = r.poids;
  if (r.difficulte) $("difficulte").value = r.difficulte;
  if (r.descente !== undefined) { $("difficulte-desc").value = r.descente; majTexteDescente(); }
  if (r.autopause === false) $("auto-pause").checked = false;
  if (r.monde && Monde3D.themes[r.monde]) $("monde").value = r.monde;
  if (r.qualite) $("qualite").value = r.qualite;
  // (v72) « Automatique » par défaut : l'ancien réglage enregistré (2K par défaut avant) est remis une fois sur Automatique, ensuite le choix de l'utilisateur est respecté
  let resAuto = false;
  try { resAuto = !localStorage.getItem("velo_resolution_auto"); localStorage.setItem("velo_resolution_auto", "1"); } catch (e) { /* ignoré */ }
  if (resAuto && r.resolution) { r.resolution = "0"; try { localStorage.setItem(CLE_REGLAGES, JSON.stringify(r)); } catch (e) { /* ignoré */ } }
  if (r.resolution) $("resolution").value = r.resolution;
  tirerAmbiance(false);                                       // (v72) moment de la journée et saison au hasard, météo aléatoire : plus réglables
  if (r.foule !== undefined) $("foule").value = r.foule;
  $("pietons").value = "2";                                   // (v72) toujours « Beaucoup »
  if (r.pelotonMode) $("peloton-mode").value = r.pelotonMode;
  if (r.fantomePR) $("fantome-pr").checked = true;
  if (r.fantomeSeg === false) $("fantome-seg").checked = false;
  if (r.echauffement) $("echauffement").checked = true;
  for (const [cle, id] of [["vibrations", "vibrations"], ["ravito", "ravito"], ["zonesFcAuto", "zones-fc-auto"]]) if (r[cle] === false) $(id).checked = false;   // (v69 suite)
  $("freinage").checked = true; Aero.reg.frein = true;      // (v72) freinage avant les virages toujours actif, plus réglable
  if (r.hudTaille) $("hud-taille").value = r.hudTaille;
  appliquerTailleHud();
  if (r.pelotonNiveau) $("peloton-niveau").value = r.pelotonNiveau;
  if (r.pelotonTours !== undefined) $("peloton-tours").value = r.pelotonTours;
  if (r.pelotonNombre) $("peloton-nombre").value = r.pelotonNombre;
  if (r.vue) $("vue-camera").value = r.vue;
  if (r.sexe) $("sexe").value = r.sexe;
  if (r.age) $("age").value = r.age;
  if (r.taille) $("taille").value = r.taille;
  if (r.avatarMaillot) $("avatar-maillot").value = r.avatarMaillot;
  if (r.apparence) {
    const ap = r.apparence;
    if (ap.peau) $("avatar-peau").value = ap.peau;
    if (ap.cheveux) $("avatar-cheveux").value = ap.cheveux;
    if (ap.coiffure) $("avatar-coiffure").value = ap.coiffure;
    if (ap.barbe) $("avatar-barbe").value = ap.barbe;
    if (ap.casqueCouleur) $("avatar-casque-couleur").value = String(ap.casqueCouleur);
    if (ap.verres) $("avatar-verres").value = ap.verres;
    if (ap.velo && $("avatar-velo").querySelector('option[value="' + ap.velo + '"]')) $("avatar-velo").value = ap.velo;
    if (ap.roues && $("avatar-roues").querySelector('option[value="' + ap.roues + '"]')) $("avatar-roues").value = ap.roues;
    majMateriel();                                   // poids et aéro du vélo et des roues retrouvés
    if (ap.bas) { if (![...$("avatar-bas").options].some((o) => o.value === String(ap.bas))) { const op = document.createElement("option"); op.value = String(ap.bas); op.textContent = "Personnalisé"; $("avatar-bas").append(op); } $("avatar-bas").value = ap.bas; }
    if (ap.basStyle) $("avatar-bas-style").value = ap.basStyle;
    if (ap.chaussettes && $("avatar-chaussettes").querySelector('option[value="' + ap.chaussettes + '"]')) $("avatar-chaussettes").value = String(ap.chaussettes);   // (v69 suite)
    if (ap.yeux && $("avatar-yeux").querySelector('option[value="' + ap.yeux + '"]')) $("avatar-yeux").value = ap.yeux;
    $("avatar-casque").checked = !!ap.casque; $("avatar-lunettes").checked = !!ap.lunettes; $("avatar-realiste").checked = true;   // corps réaliste toujours actif (la case n'est plus proposée)
    marquerPastilles();
  } else if (r.sexe === "femme") $("avatar-coiffure").value = "chignon";
  if (r.poussiere === false) $("poussiere").checked = false;
  if (r.son === false) $("son-actif").checked = false;
  if (r.volume !== undefined) $("son-volume").value = r.volume;
  appliquerSon();
  if (r.affiche3d === false) { $("affiche-3d").checked = false; $("monde-conteneur").hidden = true; }
  seance.intervalles = Array.isArray(r.intervalles) ? r.intervalles : [];
  if (!seance.intervalles.length) seance.intervalles = blocsVersIntervalles(BIBLIO[1].blocs);
  balade.altitude = route.alt0;
  majTexteDifficulte();
  majInfoParcours();
  rendreSeance();
  majStats();
  majBoutonBalade();
  if (!navigator.bluetooth) {
    $("alerte").style.display = "block";
    log("Bluetooth Web indisponible dans ce navigateur.");
  }
  setInterval(rafraichir, 250);
  demarrer3D();
  await initialiserStockage();
  await majHistorique();
  chargerMondes();
})();
