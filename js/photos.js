"use strict";
/* ---------- (v72) Photos de la sortie, à publier sur Strava ----------
   Touche P ou bouton « 📷 Photo » : la photo reproduit l'écran du mode plein écran (#monde-conteneur : vue 3D et encarts du HUD).
   L'image 3D est copiée juste après son dessin (boucle3D appelle Photos.apresDessin : sans preserveDrawingBuffer elle serait vide),
   puis les encarts sont dessinés par-dessus avec la bibliothèque html-to-image (CDN). 5 photos au plus par sortie, gardées en
   mémoire et proposées au téléchargement dans le résumé de fin (Strava n'accepte pas l'envoi de photos par une autre
   application : on les ajoute à la main sur la page de l'activité). */
const Photos = (function () {
  const MAX = 5;
  const EXCLUS = new Set(["monde3d", "flash-photo", "aide-clavier", "hz-annonce"]);   // pas sur la photo : l'image 3D (copiée à part), l'éclair, l'aide, les annonces
  let liste = [], seanceId = null, demande = false, enCours = false;

  function prendre() {
    if ($("world-jeu").hidden || enCours) return;
    demande = true;
  }
  // appelé par boucle3D juste après monde3d.dessiner : l'image de la carte graphique est encore disponible à ce moment-là
  function apresDessin(canvas) {
    if (!demande) return;
    demande = false;
    if (seanceId && seanceId !== session.debut) vider();     // nouvelle sortie : on repart de zéro (photos prises avant le départ : gardées)
    seanceId = session.debut || null;
    if (liste.length >= MAX) { annoncer("Photos", MAX + " photos au plus par sortie", "", 2); return; }
    const W = canvas.width, H = canvas.height;
    if (!W || !H) return;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");
    g.drawImage(canvas, 0, 0);                                // la vue 3D, copiée tout de suite
    enCours = true;
    ajouterEncarts(g, W, H).then(() => new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.92))).then((b) => {
      enCours = false;
      if (!b) return;
      liste.push({ blob: b, url: URL.createObjectURL(b), nom: nomFichier(liste.length + 1) });
      const f = $("flash-photo");
      f.classList.remove("on"); void f.offsetWidth; f.classList.add("on");
      majBouton();
      annoncer("📷 Photo " + liste.length + "/" + MAX, liste.length < MAX ? "à télécharger à la fin de la sortie" : "c’était la dernière de cette sortie", "", 2);
    }).catch(() => { enCours = false; });
  }
  // les encarts du HUD tels qu'ils sont à l'écran, à la même échelle que l'image 3D (fond du cadre transparent)
  async function ajouterEncarts(g, W, H) {
    const box = $("monde-conteneur");
    if (typeof htmlToImage === "undefined" || !box.clientWidth) return;     // bibliothèque absente (hors ligne) : la vue 3D seule
    try {
      const hud = await htmlToImage.toCanvas(box, { pixelRatio: W / box.clientWidth, skipFonts: true, cacheBust: false,
        style: { background: "transparent", borderRadius: "0", boxShadow: "none", margin: "0" },
        filter: (n) => !(n.id && EXCLUS.has(n.id)) });
      g.drawImage(hud, 0, 0, W, H);
    } catch (e) { /* tant pis : la vue 3D seule */ }
  }
  function majBouton() { $("btn-photo").textContent = "📷 Photo" + (liste.length && !nouvelle() ? " " + liste.length + "/" + MAX : ""); }
  const nouvelle = () => !!(seanceId && session.debut && seanceId !== session.debut);   // une autre sortie a commencé (photos de la précédente encore dans son résumé)
  setInterval(majBouton, 2000);
  function nomFichier(n) {
    const d = new Date(session.debut || Date.now()), p = (v) => String(v).padStart(2, "0");
    return "velo-virtuel-" + d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "-" + p(d.getHours()) + "h" + p(d.getMinutes()) + "-photo" + p(n) + ".jpg";
  }
  // nouvelle entrée dans un monde sans sortie commencée : les photos prises avant de pédaler la dernière fois (sortie jamais commencée) sont oubliées
  function nouvelleEntree() { if (seanceId === null && liste.length && !session.debut) vider(); }
  function vider() { for (const p of liste) URL.revokeObjectURL(p.url); liste = []; majBouton(); }
  function telechargerPhoto(p) {
    const a = document.createElement("a");
    a.href = p.url; a.download = p.nom;
    document.body.append(a); a.click(); a.remove();
  }
  // pour le résumé de fin : les photos de cette sortie (elles restent en mémoire jusqu'à la prochaine sortie)
  const pour = (id) => (seanceId === id || seanceId === null ? liste.slice() : []);
  function htmlResume(photos) {
    if (!photos || !photos.length) return "";
    let h = '<h3 style="margin:6px 0">Photos de la sortie</h3><div class="rf-photos">';
    photos.forEach((p, i) => { h += '<button type="button" class="rf-photo" data-photo="' + i + '" title="Télécharger cette photo"><img alt="Photo ' + (i + 1) + '" src="' + p.url + '"><span>⬇</span></button>'; });
    h += '</div><div class="rf-photos-b"><button type="button" id="rf-photos-tout">⬇ Télécharger les ' + photos.length + (photos.length > 1 ? " photos" : " photo") + "</button></div>";
    h += '<div class="info rf-strava">Pour Strava : envoie d’abord la sortie (fichier .FIT, bouton « Exporter en .FIT » dans le détail), puis sur la page de l’activité Strava, « Modifier » → ajoute ces photos.</div>';
    return h;
  }
  function brancherResume(conteneur, photos) {
    if (!photos || !photos.length) return;
    conteneur.querySelectorAll("[data-photo]").forEach((b) => b.addEventListener("click", () => telechargerPhoto(photos[parseInt(b.dataset.photo, 10)])));
    const tout = conteneur.querySelector("#rf-photos-tout");
    if (tout) tout.addEventListener("click", () => photos.forEach((p, i) => setTimeout(() => telechargerPhoto(p), i * 400)));
  }

  $("btn-photo").addEventListener("click", prendre);
  return { prendre, apresDessin, pour, nouvelleEntree, htmlResume, brancherResume, nombre: () => liste.length };
})();
