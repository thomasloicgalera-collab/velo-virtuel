"use strict";
/* ---------- (v71) Sortie de groupe : rouler en direct avec des amis ----------
   Les ordinateurs se parlent directement (WebRTC, bibliothèque PeerJS chargée par CDN ; le serveur gratuit de PeerJS ne sert qu'à se trouver).
   Celui qui crée le groupe reçoit un code ; ses amis le tapent pour le rejoindre. Le créateur est le « centre » : il reçoit la position
   de chacun et la renvoie aux autres. Il choisit le monde pour tout le monde, et son « C'est parti » fait partir tout le groupe.
   Chacun envoie 4 fois par seconde : distance sur la route (`balade.distance`), vitesse, cadence, puissance, apparence. */
const Groupe = (function () {
  const PREFIXE = "velovirtuel-", CAR = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", CLE_NOM = "velo_groupe_nom";
  const PERIODE = 250, OUBLI = 6000;                  // ms entre deux envois ; un ami silencieux depuis 6 s est retiré
  const VOIES = [1.7, 0.1, 2.4, -0.5, 1.3, 0.5];     // couloir de chaque ami à l'écran (pour ne pas rouler l'un dans l'autre)
  let peer = null, code = "", hote = false, versHote = null, monId = "";
  const conns = new Map();                           // créateur : id de l'ami → connexion
  const amis = new Map();                            // id → dernier état reçu (+ t = heure de réception)
  let sig3D = "", mondeEnvoye = "", messageEtat = "", jeuAvant = false, meteoSuivie = false;

  const nom = () => ($("groupe-nom").value.trim() || "Cycliste").slice(0, 18);
  function tirerCode() { let s = ""; for (let i = 0; i < 5; i++) s += CAR[Math.floor(Math.random() * CAR.length)]; return s; }
  function etat(t) { messageEtat = t; rendre(); }

  function monEtat() {
    const a = lireApparence(), id = a.velo && a.velo !== "simple" ? a.velo : "madone";
    return { k: "etat", id: monId, nom: nom(), monde: mondeActifId || "", jeu: !$("world-jeu").hidden,
      d: balade.distance, v: balade.enCours ? balade.vitesse : 0, cad: balade.enCours ? balade.cadence || 0 : 0, w: balade.enCours ? Math.round((balade.ratio || 0) * ftp()) : 0,
      kg: parseFloat($("poids").value) || 75, ratio: balade.ratio || 0.7,
      vent: hote ? [Aero.v.dir, Aero.v.vit] : null,
      meteo: hote && monde3d && monde3d.meteo ? monde3d.meteo().etat : null,   // météo du créateur : la pluie freine (roulement), elle doit être la même pour tous        // le vent du créateur s'impose à tout le groupe (sinon chacun tire le sien : courses inégales)
      couleur: parseInt($("avatar-maillot").value, 10), velo: id, roues: a.roues || "35", clm: !!(Aero.reg && Aero.reg.clm),
      perso: { genre: $("sexe").value, peau: a.peau, cheveux: a.cheveux, coupe: a.coiffure, barbe: a.barbe, casque: a.casque ? a.casqueCouleur : null, lunettes: !!a.lunettes, verres: a.verres } };
  }

  // ---- connexion ----
  function chargerPeer() {
    if (typeof Peer === "undefined") { etat("Le module de connexion n’a pas pu être chargé : vérifie ta connexion Internet, puis recharge la page."); return false; }
    return true;
  }
  function creer() {
    if (peer || !chargerPeer()) return;
    hote = true; code = tirerCode();
    etat("Création du groupe…");
    peer = new Peer(PREFIXE + code, { debug: 0 });
    peer.on("open", (id) => { monId = id; etat(""); });
    peer.on("connection", (c) => {
      c.on("open", () => { conns.set(c.peer, c); envoyerMonde(true); if (!$("world-jeu").hidden) c.send(msgDepart()); rendre(); });   // un ami arrivé en retard part tout de suite
      c.on("data", (m) => recevoir(m, c.peer));
      c.on("close", () => { conns.delete(c.peer); oublier(c.peer); });
      c.on("error", () => { conns.delete(c.peer); oublier(c.peer); });
    });
    peer.on("error", (e) => {
      if (e.type === "unavailable-id") { quitter(); creer(); return; }      // code déjà pris : on en tire un autre
      etat("Problème de connexion : " + (e.type || e.message));
    });
    peer.on("disconnected", () => { if (peer && !peer.destroyed) peer.reconnect(); });
  }
  function rejoindre(c) {
    c = (c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (c.length !== 5) { etat("Le code a 5 caractères (lettres et chiffres)."); return; }
    if (peer || !chargerPeer()) return;
    hote = false; code = c;
    etat("Connexion au groupe " + c + "…");
    peer = new Peer({ debug: 0 });
    peer.on("open", (id) => {
      monId = id;
      versHote = peer.connect(PREFIXE + c, { serialization: "json" });
      versHote.on("open", () => etat(""));
      versHote.on("data", (m) => recevoir(m, versHote.peer));
      versHote.on("close", () => { const q = code; quitter(); etat("Le groupe " + q + " est terminé (son créateur l’a quitté)."); });
    });
    // erreurs passagères du serveur de rendez-vous (réseau, serveur) : la liaison directe avec le créateur peut continuer
    peer.on("disconnected", () => { if (peer && !peer.destroyed) peer.reconnect(); });
    peer.on("error", (e) => {
      if (versHote && versHote.open && e.type !== "peer-unavailable") return;
      const q = code;
      quitter();
      etat(e.type === "peer-unavailable" ? "Aucun groupe avec le code " + q + " : vérifie le code (le créateur doit garder l’application ouverte)." : "Problème de connexion : " + (e.type || e.message));
    });
  }
  function quitter() {
    if (peer) { try { peer.destroy(); } catch (e) { /* ignoré */ } }
    peer = null; versHote = null; code = ""; hote = false; monId = "";
    conns.clear(); amis.clear(); mondeEnvoye = ""; messageEtat = "";
    if (meteoSuivie && monde3d) monde3d.definirMeteo("auto");   // de nouveau seul : météo aléatoire
    meteoSuivie = false;
    rafraichir3D(); rendre();
  }
  const connecte = () => !!peer && !!monId && (hote || (versHote && versHote.open));

  // ---- messages ----
  function envoyer(m) {
    if (hote) { for (const c of conns.values()) if (c.open) c.send(m); }
    else if (versHote && versHote.open) versHote.send(m);
  }
  function recevoir(m, de) {
    if (!m || typeof m !== "object") return;
    if (m.k === "etat") {
      if (m.id === monId) return;
      amis.set(m.id, Object.assign(m, { t: performance.now() }));
      if (!hote && m.vent) { Aero.v.dir = m.vent[0]; Aero.v.vit = m.vent[1]; }
      if (!hote && m.meteo && monde3d && monde3d.meteo && monde3d.meteo().etat !== m.meteo) { monde3d.definirMeteo(m.meteo); meteoSuivie = true; }
      if (hote) for (const [id, c] of conns) if (id !== de && c.open) c.send(m);    // le créateur fait suivre aux autres
      rafraichir3D();
    } else if (m.k === "parti" && hote) {
      for (const [id, c] of conns) if (id !== de && c.open) c.send(m);
      oublier(m.id);
    } else if (m.k === "parti") oublier(m.id);
    else if (m.k === "monde" && !hote) suivreMonde(m);
    else if (m.k === "depart" && !hote) { suivreMonde(m); partir(m); }
  }
  const msgDepart = () => ({ k: "depart", monde: mondeActifId, nomMonde: (MONDES.find((x) => x.id === mondeActifId) || {}).nom || "", d0: parseFloat($("depart-km").value) || 0 });
  function oublier(id) { if (amis.delete(id)) { rafraichir3D(); rendre(); } }
  function envoyerMonde(force) {
    if (!hote || !connecte()) return;
    const id = mondeChoisiId || "";
    if (!force && id === mondeEnvoye) return;
    mondeEnvoye = id;
    const m = MONDES.find((x) => x.id === id);
    envoyer({ k: "monde", monde: id, nomMonde: m ? m.nom : "" });
  }
  // chez l'ami : le monde choisi par le créateur (seulement sur la page d'accueil, jamais au milieu d'une sortie)
  function suivreMonde(m) {
    if (!MONDES.some((x) => x.id === m.monde)) { etat("Le créateur roule sur « " + (m.nomMonde || m.monde) + " », un monde que tu n’as pas : importe le même fichier GPX."); return; }
    etat("");
    if (!$("world-choix").hidden && mondeChoisiId !== m.monde && !session.samples.length) choisirMonde(m.monde);
  }
  function partir(m) {
    if ($("world-choix").hidden || session.samples.length || !MONDES.some((x) => x.id === m.monde)) return;
    const sel = $("depart-km");
    if ([...sel.options].some((o) => o.value === String(m.d0))) { sel.value = String(m.d0); majResumeChoix(); }
    $("btn-cest-parti").click();
    annoncer("Départ du groupe", "", "", 3);
  }

  // ---- toutes les 250 ms : envoi de ma position, oubli des amis silencieux, encarts ----
  setInterval(() => {
    if (!peer) return;
    const t = performance.now();
    for (const [id, a] of amis) if (t - a.t > OUBLI) { amis.delete(id); rafraichir3D(); }
    if (!connecte()) { rendre(); return; }
    envoyerMonde(false);
    // le créateur vient d'entrer dans un monde (« C'est parti ») : tout le groupe part sur le même monde
    const jeu = !$("world-jeu").hidden;
    if (hote && jeu && !jeuAvant) envoyer(msgDepart());
    jeuAvant = jeu;
    envoyer(monEtat());
    rendre();
  }, PERIODE);
  window.addEventListener("beforeunload", () => { if (connecte()) envoyer({ k: "parti", id: monId }); });

  // ---- les amis dans le monde 3D (ajoutés après les coureurs virtuels et les fantômes, voir envoyerPeloton3D / donnees3D) ----
  const surMonMonde = () => [...amis.values()].filter((a) => a.monde && a.monde === mondeActifId && a.jeu).sort((a, b) => (a.id < b.id ? -1 : 1));
  function rafraichir3D() {
    const s = surMonMonde().map((a) => a.id + a.couleur + a.perso.genre + a.perso.coupe).join("|");
    if (s === sig3D) return;
    sig3D = s;
    if (typeof envoyerPeloton3D === "function") envoyerPeloton3D();
  }
  function liste3D() { return surMonMonde().map((a) => ({ couleur: a.couleur, ampleur: 1, nom: a.nom, perso: a.perso })); }
  function donnees3D() {
    const t = performance.now();
    return surMonMonde().map((a, i) => {
      const d = a.d + a.v * Math.min((t - a.t) / 1000, 1);    // entre deux messages, on le fait avancer à sa dernière vitesse
      return { d, v: a.v, cad: a.cad, voie: VOIES[i % VOIES.length], ratio: a.ratio, pente: penteA(d) / 100, velo: a.velo, roues: a.roues, clm: a.clm, grp: 0 };
    });
  }
  // aspiration derrière un ami (même calcul que derrière les coureurs virtuels ; on ne choisit pas son couloir, donc on le compte dans ta roue)
  function abriPour(d) {
    let m = 1;
    for (const q of donnees3D()) m = Math.min(m, Aero.facteurAspiration(q.d - d, 0));
    return m;
  }

  // ---- affichage : volet de la page d'accueil et encart pendant la sortie ----
  function rendre() {
    const on = !!peer, ok = connecte(), l = [...amis.values()];
    $("groupe-hors").hidden = on;
    $("groupe-dans").hidden = !on;
    $("groupe-msg").textContent = messageEtat;
    $("groupe-msg").hidden = !messageEtat;
    $("groupe-resume").textContent = !on ? "seul" : !ok ? "connexion…" : "groupe " + code + " · " + (l.length ? l.length + (l.length > 1 ? " amis" : " ami") : "personne d’autre pour l’instant");
    if (on) {
      $("groupe-code").textContent = code;
      $("groupe-role").textContent = hote ? "Donne ce code à tes amis. Tu choisis le monde ; ton « C’est parti » fait partir tout le groupe." : "Le créateur du groupe choisit le monde et donne le départ.";
      const html = l.map((a) => '<div class="gm"><i style="background:' + hex6(a.couleur) + '"></i><b></b><span>' + (a.jeu ? "en selle" : "sur l’accueil") + "</span></div>").join("");
      const box = $("groupe-membres");
      if (box.dataset.sig !== html + l.map((a) => a.nom).join()) {
        box.dataset.sig = html + l.map((a) => a.nom).join();
        box.innerHTML = html || '<div class="gm vide">En attente d’amis…</div>';
        box.querySelectorAll(".gm b").forEach((b, i) => { b.textContent = l[i].nom; });
      }
    }
    majHud();
  }
  function majHud() {
    const bloc = $("hz-groupe"), l = surMonMonde();
    if (!peer || $("world-jeu").hidden) { bloc.hidden = true; return; }
    bloc.hidden = false;
    const t = performance.now(), moi = { nom: nom() + " (toi)", d: balade.distance, couleur: parseInt($("avatar-maillot").value, 10), w: balade.enCours ? Math.round((balade.ratio || 0) * ftp()) : 0, kg: parseFloat($("poids").value) || 75, moi: true };
    const tous = [moi, ...l.map((a) => ({ nom: a.nom, d: a.d + a.v * Math.min((t - a.t) / 1000, 1), couleur: a.couleur, w: a.w, kg: a.kg }))].sort((a, b) => b.d - a.d);
    let html = '<div class="tt">Groupe ' + code + (l.length ? "" : " · personne sur ce monde") + "</div>";
    for (const x of tous) {
      const e = Math.round(x.d - moi.d), ec = x.moi ? "" : (e >= 0 ? "+" : "−") + (Math.abs(e) >= 1000 ? fr1(Math.abs(e) / 1000) + " km" : Math.abs(e) + " m");
      html += '<div class="pl' + (x.moi ? " moi" : "") + '"><i style="background:' + hex6(x.couleur) + '"></i><b>' + echapper(x.nom) + "</b><em>" + ec + '</em><span class="sb">' + x.w + " W · " + fr1(x.w / x.kg) + " W/kg</span></div>";
    }
    if (bloc.dataset.sig !== html) { bloc.dataset.sig = html; $("hz-groupe-c").innerHTML = html; }
  }
  const echapper = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  // ---- boutons ----
  try { $("groupe-nom").value = localStorage.getItem(CLE_NOM) || ""; } catch (e) { /* ignoré */ }
  $("groupe-nom").addEventListener("change", () => { try { localStorage.setItem(CLE_NOM, $("groupe-nom").value.trim()); } catch (e) { /* ignoré */ } });
  $("btn-groupe-creer").addEventListener("click", creer);
  $("btn-groupe-rejoindre").addEventListener("click", () => rejoindre($("groupe-code-in").value));
  $("groupe-code-in").addEventListener("keydown", (e) => { if (e.key === "Enter") rejoindre($("groupe-code-in").value); });
  $("btn-groupe-quitter").addEventListener("click", () => { if (connecte()) envoyer({ k: "parti", id: monId }); quitter(); });
  rendre();

  return { liste3D, donnees3D, abriPour, actif: () => !!peer && amis.size > 0, code: () => code };
})();
