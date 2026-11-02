"use strict";

/* =====================================================================
   Outils généraux
   ===================================================================== */
const UUID = {
  FTMS: 0x1826, BIKE_DATA: 0x2AD2, CONTROL_POINT: 0x2AD9,
  POWER: 0x1818, POWER_MEAS: 0x2A63,
  HR: 0x180D, HR_MEAS: 0x2A37
};
const $ = (id) => document.getElementById(id);
const maintenant = () => performance.now();
const frais = (ts) => ts && maintenant() - ts < 5000;
const borner = (x, a, b) => Math.max(a, Math.min(b, x));
const fr1 = (n) => n.toFixed(1).replace(".", ",");
const fr2 = (n) => n.toFixed(2).replace(".", ",");
const ftp = () => Math.max(50, parseInt($("ftp").value, 10) || 200);
const fcmax = () => Math.max(120, parseInt($("fcmax").value, 10) || 190);
const deuxChiffres = (n) => String(n).padStart(2, "0");

function formatDuree(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h > 0 ? h + ":" + deuxChiffres(m) + ":" + deuxChiffres(s) : deuxChiffres(m) + ":" + deuxChiffres(s);
}
function formatMinutes(min) {
  const s = Math.round(min * 60);
  if (s < 60) return s + " s";
  const m = Math.floor(s / 60), r = s % 60;
  return m + " min" + (r ? " " + r + " s" : "");
}

const lignes = [];
function log(msg) {
  lignes.push(new Date().toLocaleTimeString("fr-FR") + "  " + msg);
  if (lignes.length > 40) lignes.shift();
  $("journal").textContent = lignes.join("\n");
  $("journal").scrollTop = $("journal").scrollHeight;
}

/* =====================================================================
   Zones d’entraînement
   ===================================================================== */
const ZONES_P = [
  { nom: "Z1", max: 0.55, couleur: "#7C93AD", lib: "Récupération" },
  { nom: "Z2", max: 0.75, couleur: "#4AA8FF", lib: "Endurance" },
  { nom: "Z3", max: 0.90, couleur: "#58D6A4", lib: "Tempo" },
  { nom: "Z4", max: 1.05, couleur: "#FFB627", lib: "Seuil" },
  { nom: "Z5", max: 1.20, couleur: "#FF8A4C", lib: "VO2max" },
  { nom: "Z6", max: 1.50, couleur: "#FF5A5A", lib: "Capacité anaérobie" },
  { nom: "Z7", max: Infinity, couleur: "#D65AFF", lib: "Sprint" }
];
const ZONES_FC = [
  { nom: "Z1", max: 0.60, couleur: "#7C93AD", lib: "Très facile" },
  { nom: "Z2", max: 0.70, couleur: "#4AA8FF", lib: "Endurance" },
  { nom: "Z3", max: 0.80, couleur: "#58D6A4", lib: "Tempo" },
  { nom: "Z4", max: 0.90, couleur: "#FFB627", lib: "Seuil" },
  { nom: "Z5", max: Infinity, couleur: "#FF5A5A", lib: "Effort maximal" }
];
function indexZone(zones, ratio) {
  for (let i = 0; i < zones.length; i++) if (ratio <= zones[i].max) return i;
  return zones.length - 1;
}

/* =====================================================================
   Réglages mémorisés dans le navigateur
   ===================================================================== */
const CLE_REGLAGES = "velo-virtuel-reglages";
function chargerReglages() {
  try { return JSON.parse(localStorage.getItem(CLE_REGLAGES)) || {}; } catch (e) { return {}; }
}
function sauverReglages() {
  try {
    localStorage.setItem(CLE_REGLAGES, JSON.stringify({
      ventActif: $("vent-actif").checked, materielAero: $("materiel-aero").value, ftp: $("ftp").value, autoDepart: $("auto-depart").checked, fcmax: $("fcmax").value, poids: $("poids").value,
      difficulte: $("difficulte").value, descente: $("difficulte-desc").value, autopause: $("auto-pause").checked,
      monde: $("monde").value, qualite: $("qualite").value, resolution: $("resolution").value, moment: $("moment").value, meteo: $("meteo").value, foule: $("foule").value, saison: $("saison").value, pietons: $("pietons").value, pelotonMode: $("peloton-mode").value, fantomePR: $("fantome-pr").checked, fantomeSeg: $("fantome-seg").checked, echauffement: $("echauffement").checked, freinage: $("freinage").checked, vibrations: $("vibrations").checked, ravito: $("ravito").checked, zonesFcAuto: $("zones-fc-auto").checked, hudTaille: $("hud-taille").value, pelotonNiveau: $("peloton-niveau").value, pelotonTours: $("peloton-tours").value, pelotonNombre: $("peloton-nombre").value, sexe: $("sexe").value, apparence: lireApparence(), age: $("age").value, taille: $("taille").value, avatarMaillot: $("avatar-maillot").value, vue: $("vue-camera").value, poussiere: $("poussiere").checked, son: $("son-actif").checked, volume: $("son-volume").value, affiche3d: $("affiche-3d").checked,
      intervalles: seance.intervalles
    }));
  } catch (e) { /* stockage indisponible : on ignore */ }
}

/* =====================================================================
   Base de données du navigateur (historique des séances)
   ===================================================================== */
let base = null;
function ouvrirBase() {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open("velo-virtuel", 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("resumes")) db.createObjectStore("resumes", { keyPath: "id" });
        if (!db.objectStoreNames.contains("donnees")) db.createObjectStore("donnees", { keyPath: "id" });
        if (!db.objectStoreNames.contains("mondes")) db.createObjectStore("mondes", { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch (e) { resolve(null); }
  });
}
function transaction(noms, mode, action) {
  return new Promise((resolve, reject) => {
    if (!base) { resolve(null); return; }
    const t = base.transaction(noms, mode);
    let resultat = null;
    action(t, (r) => { resultat = r; });
    t.oncomplete = () => resolve(resultat);
    t.onerror = t.onabort = () => reject(t.error);
  });
}

/* =====================================================================
   État des appareils
   ===================================================================== */
const trainer = { device: null, cp: null, pret: false, ts: 0, power: null, cadence: null, hr: null };
const pm = { device: null, ts: 0, power: null, cadence: null, cadTs: 0, prevRevs: null, prevTime: null };
const ceinture = { device: null, ts: 0, hr: null };
const appareils = { trainer, power: pm, hr: ceinture };

function afficherEtat(type, texte, connecte) {
  const el = $("st-" + type);
  el.textContent = texte;
  el.classList.toggle("ok", !!connecte);
  const noms = { trainer: ["Connecter le home trainer", "Déconnecter le home trainer"],
                 power: ["Connecter le capteur de puissance", "Déconnecter le capteur de puissance"],
                 hr: ["Connecter la ceinture cardio", "Déconnecter la ceinture cardio"] };
  $("btn-" + type).textContent = noms[type][connecte ? 1 : 0];
}

/* ---------- Home trainer (FTMS) ---------- */
function decoderDonneesVelo(v) {
  const flags = v.getUint16(0, true);
  let i = 2;
  if (!(flags & 0x0001)) i += 2;
  if (flags & 0x0002) i += 2;
  if (flags & 0x0004) { trainer.cadence = v.getUint16(i, true) / 2; i += 2; }
  if (flags & 0x0008) i += 2;
  if (flags & 0x0010) i += 3;
  if (flags & 0x0020) i += 2;
  if (flags & 0x0040) { trainer.power = v.getInt16(i, true); i += 2; }
  if (flags & 0x0080) i += 2;
  if (flags & 0x0100) i += 5;
  if (flags & 0x0200) { trainer.hr = v.getUint8(i); i += 1; }
  trainer.ts = maintenant();
}

let chaineEcriture = Promise.resolve();
function ecrireCommande(octets) {
  chaineEcriture = chaineEcriture.then(() => {
    if (!trainer.cp) return;
    const data = new Uint8Array(octets);
    return trainer.cp.writeValueWithResponse ? trainer.cp.writeValueWithResponse(data) : trainer.cp.writeValue(data);
  }).catch((e) => log("Commande non envoyée : " + e.message));
  return chaineEcriture;
}

function reponseCommande(e) {
  const v = e.target.value;
  if (v.getUint8(0) !== 0x80) return;
  const op = v.getUint8(1), res = v.getUint8(2);
  const noms = { 0x00: "prise de contrôle", 0x05: "puissance cible", 0x07: "démarrage", 0x11: "pente" };
  log("Home trainer, " + (noms[op] || "commande 0x" + op.toString(16)) + " : " +
      (res === 1 ? "accepté" : "refusé (code " + res + ")"));
}

function surDonneesVelo(e) { decoderDonneesVelo(e.target.value); }
// branche (ou rebranche) un home trainer déjà choisi : sert à la première connexion et aux reconnexions automatiques
async function brancherTrainer(device) {
  const serveur = await connecterGatt(device);
  const service = await serveur.getPrimaryService(UUID.FTMS);

  const donnees = await service.getCharacteristic(UUID.BIKE_DATA);
  donnees.addEventListener("characteristicvaluechanged", surDonneesVelo);
  await donnees.startNotifications();

  trainer.cp = await service.getCharacteristic(UUID.CONTROL_POINT);
  trainer.cp.addEventListener("characteristicvaluechanged", reponseCommande);
  await trainer.cp.startNotifications();

  await ecrireCommande([0x00]);
  await ecrireCommande([0x07]);
  trainer.pret = true;
  reinitialiserEnvois();          // la pente ou la puissance cible du moment est renvoyée au prochain passage de la boucle
  afficherEtat("trainer", device.name || "Home trainer connecté", true);
}
function couperTrainer() { trainer.pret = false; trainer.cp = null; trainer.ts = 0; }

/* ---------- Capteur de puissance ---------- */
function decoderPuissance(v) {
  const flags = v.getUint16(0, true);
  pm.power = v.getInt16(2, true);
  pm.ts = maintenant();
  let i = 4;
  if (flags & 0x0001) i += 1;
  if (flags & 0x0004) i += 2;
  if (flags & 0x0010) i += 6;
  if (flags & 0x0020) {
    const revs = v.getUint16(i, true), temps = v.getUint16(i + 2, true);
    if (pm.prevRevs !== null) {
      const dt = (temps - pm.prevTime) & 0xFFFF;
      const dr = (revs - pm.prevRevs) & 0xFFFF;
      if (dt > 0) { pm.cadence = (dr / dt) * 1024 * 60; pm.cadTs = maintenant(); }
    }
    pm.prevRevs = revs; pm.prevTime = temps;
  }
}

// les écouteurs sont des fonctions nommées : après une reconnexion, le navigateur ne les ajoute pas une deuxième fois
function surPuissance(e) { decoderPuissance(e.target.value); }
async function brancherPuissance(device) {
  const serveur = await connecterGatt(device);
  const service = await serveur.getPrimaryService(UUID.POWER);
  const c = await service.getCharacteristic(UUID.POWER_MEAS);
  c.addEventListener("characteristicvaluechanged", surPuissance);
  await c.startNotifications();
  pm.prevRevs = null;
  afficherEtat("power", device.name || "Capteur de puissance connecté", true);
}
function couperPuissance() { pm.ts = 0; }

/* ---------- Ceinture cardio ---------- */
function surCardio(e) {
  const v = e.target.value;
  ceinture.hr = (v.getUint8(0) & 1) ? v.getUint16(1, true) : v.getUint8(1);
  ceinture.ts = maintenant();
}
async function brancherCeinture(device) {
  const serveur = await connecterGatt(device);
  const service = await serveur.getPrimaryService(UUID.HR);
  const c = await service.getCharacteristic(UUID.HR_MEAS);
  c.addEventListener("characteristicvaluechanged", surCardio);
  await c.startNotifications();
  afficherEtat("hr", device.name || "Ceinture connectée", true);
}
function couperCeinture() { ceinture.ts = 0; }

/* ---------- Connexion et reconnexion automatique (v62) ----------
   Une coupure Bluetooth qui n'a pas été demandée (appareil trop loin, pile faible, brouillage) n'oblige plus à descendre
   du vélo : on retente toutes les 2 à 10 s, sans limite, tant que l'utilisateur n'a pas cliqué sur « Déconnecter ».
   Le navigateur garde l'autorisation d'accès à l'appareil pendant toute la page, sans redemander de le choisir. */
const PILOTES = {
  trainer: { service: UUID.FTMS, nom: "Home trainer", brancher: brancherTrainer, couper: couperTrainer },
  power: { service: UUID.POWER, nom: "Capteur de puissance", brancher: brancherPuissance, couper: couperPuissance },
  hr: { service: UUID.HR, nom: "Ceinture cardio", brancher: brancherCeinture, couper: couperCeinture }
};

// gatt.connect() peut rester bloqué longtemps quand l'appareil est hors de portée : abandon au bout de 10 s
function connecterGatt(device) {
  return Promise.race([
    device.gatt.connect(),
    new Promise((_, rejeter) => setTimeout(() => rejeter(new Error("pas de réponse")), 10000))
  ]);
}

function arreterReconnexion(a) {
  clearTimeout(a.attente); a.attente = null; a.reconnexion = false;
}

function quandDeconnecte(type, device) {
  const a = appareils[type], p = PILOTES[type];
  if (a.device !== device) return;              // un autre appareil a été choisi entre-temps
  p.couper();
  if (a.manuel) { afficherEtat(type, "Déconnecté", false); log(p.nom + " déconnecté."); return; }
  if (a.reconnexion) return;                    // une série d'essais est déjà en cours
  a.reconnexion = true;
  log(p.nom + " : connexion perdue, reconnexion automatique…");
  reessayer(type, device, 1);
}

async function reessayer(type, device, essai) {
  const a = appareils[type], p = PILOTES[type];
  a.attente = null;
  if (!a.reconnexion || a.device !== device || a.manuel) return;
  afficherEtat(type, "Reconnexion en cours… (essai " + essai + ")", false);
  try {
    await p.brancher(device);
    if (a.device !== device) return;
    arreterReconnexion(a);
    log(p.nom + " reconnecté" + (essai > 1 ? " après " + essai + " essais." : "."));
  } catch (err) {
    if (!a.reconnexion || a.device !== device || a.manuel) return;
    a.attente = setTimeout(() => reessayer(type, device, essai + 1), Math.min(2000 * essai, 10000));
  }
}

async function connecterAppareil(type) {
  const a = appareils[type], p = PILOTES[type];
  const device = await navigator.bluetooth.requestDevice({ filters: [{ services: [p.service] }] });
  if (a.device && a.device !== device && a.device.gatt.connected) { a.manuel = true; a.device.gatt.disconnect(); }
  arreterReconnexion(a);
  a.device = device; a.manuel = false;
  if (!device.vuParVelo) {                      // l'écouteur n'est posé qu'une fois par appareil
    device.vuParVelo = true;
    device.addEventListener("gattserverdisconnected", () => quandDeconnecte(type, device));
  }
  afficherEtat(type, "Connexion en cours…", false);
  await p.brancher(device);
  log(p.nom + " connecté : " + (device.name || "sans nom"));
}

for (const type of Object.keys(PILOTES)) {
  $("btn-" + type).addEventListener("click", async () => {
    const a = appareils[type];
    if (a.device && (a.device.gatt.connected || a.reconnexion)) {   // « Déconnecter » : arrête aussi les essais de reconnexion
      a.manuel = true;
      const enCours = a.reconnexion;
      arreterReconnexion(a);
      if (a.device.gatt.connected) a.device.gatt.disconnect();
      else if (enCours) { PILOTES[type].couper(); afficherEtat(type, "Déconnecté", false); log(PILOTES[type].nom + " : reconnexion arrêtée."); }
      return;
    }
    try { await connecterAppareil(type); }
    catch (err) {
      if (a.device && a.device.gatt.connected) return;
      afficherEtat(type, "Non connecté", false);
      log(err.name === "NotFoundError" ? "Aucun appareil choisi." : "Erreur de connexion : " + err.message);
    }
  });
}
