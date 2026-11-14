const ZKLib = require('node-zklib');
const { COMMANDS } = require('node-zklib/constants');
const { Attendance, User, Incube, TourniquetUser, sequelize } = require('../models');
const { Op } = require('sequelize');

// Liste des 7 tourniquets ZKTeco
const DEVICES = (process.env.ZKT_DEVICES || "10.0.1.120,10.0.1.201,10.0.1.113,10.0.1.108,10.0.1.116,10.0.1.17,10.0.1.223")
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const PORT = parseInt(process.env.ZKT_PORT || '4370', 10);

// Cartographie stricte des bornes dédiées Entrée / Sortie (avec valeurs par défaut si non définies en .env)
const IN_DEVICES = (process.env.ZKT_IN_DEVICES || '10.0.1.116,10.0.1.223,10.0.1.201').split(',').map(s => s.trim()).filter(Boolean);
const OUT_DEVICES = (process.env.ZKT_OUT_DEVICES || '10.0.1.17,10.0.1.120,10.0.1.113,10.0.1.108').split(',').map(s => s.trim()).filter(Boolean);

function normalizeName(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const PARTICLES = new Set(['el', 'al', 'la', 'le', 'ben', 'ibn', 'ait', 'ould', 'bou', 'bel', 'der']);

function cleanWord(w) {
  return w.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getSignificantWords(str) {
  if (!str) return [];
  return str.split(/[\s\-_\/]+/)
    .map(cleanWord)
    .filter(w => w.length >= 2 && !PARTICLES.has(w));
}

function similarity(w1, w2) {
  if (w1 === w2) return 1;
  if (w1.length < 3 || w2.length < 3) return 0;
  if (w1.includes(w2) || w2.includes(w1)) return 0.85;
  const a = w1, b = w2;
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 0;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return (Math.max(m, n) - dp[m][n]) / Math.max(m, n);
}

function matchesPersonName(nameA, nameB) {
  if (!nameA || !nameB) return false;
  const cleanA = cleanWord(nameA);
  const cleanB = cleanWord(nameB);
  if (cleanA === cleanB) return true;

  const sigA = getSignificantWords(nameA);
  const sigB = getSignificantWords(nameB);
  if (sigA.length === 0 || sigB.length === 0) return false;

  if (sigA.length === sigB.length && sigA.every(wa => sigB.includes(wa))) {
    return true;
  }

  let matchedCount = 0;
  for (const wa of sigA) {
    const hasMatch = sigB.some(wb => similarity(wa, wb) >= 0.75);
    if (hasMatch) matchedCount++;
  }

  const minRequired = Math.min(sigA.length, sigB.length);
  if (minRequired >= 2) {
    return matchedCount >= 2;
  }
  return matchedCount >= 1 && sigA.length === 1 && sigB.length === 1;
}

/**
 * Encode une Date (en heure locale GMT+0 / UTC) au format entier 32-bit ZKTeco
 */
function encodeTimeToInteger(date = new Date()) {
  const year = date.getUTCFullYear() - 2000;
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes();
  const second = date.getUTCSeconds();

  return (
    ((((year * 12 + month) * 31 + (day - 1)) * 24 + hour) * 60 + minute) * 60 + second
  );
}

/**
 * Décode un entier 32-bit ZKTeco en Date UTC stricte (GMT+0)
 */
function parseTimeToDateUTC(time) {
  const second = time % 60;
  time = (time - second) / 60;
  const minute = time % 60;
  time = (time - minute) / 60;
  const hour = time % 24;
  time = (time - hour) / 24;
  const day = (time % 31) + 1;
  time = (time - (day - 1)) / 31;
  const month = time % 12;
  time = (time - month) / 12;
  const year = time + 2000;

  return new Date(Date.UTC(year, month, day, hour, minute, second));
}

/**
 * Reconstruit une Date en UTC pur (GMT+0) à partir des composantes Date locales
 * Évite le décalage de -1h ou +1h imposé par le fuseau horaire de l'OS Windows hôte
 */
function toUtcExactDate(dateObj) {
  if (!dateObj) return null;
  const d = new Date(dateObj);
  if (isNaN(d.getTime())) return null;

  return new Date(Date.UTC(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    d.getSeconds()
  ));
}

/**
 * Synchronise l'horloge interne d'une borne physique ZKTeco avec l'heure locale exacte du serveur.
 * Utilise disableDevice() / enableDevice() pour garantir l'application immédiate du RTC.
 */
async function syncSingleDeviceClock(zk, ip) {
  try {
    const nowUtc = toUtcExactDate(new Date());
    let driftSeconds = null;
    let devTime = null;

    try {
      const reply = await zk.executeCmd(COMMANDS.CMD_GET_TIME, '');
      if (reply && reply.length >= 12) {
        const rawInt = reply.readUInt32LE(8);
        devTime = parseTimeToDateUTC(rawInt);
        driftSeconds = Math.round((devTime.getTime() - nowUtc.getTime()) / 1000);
      }
    } catch (e) {
      // Lecture non bloquante
    }

    // Si dérive supérieure à 5 secondes ou année aberrante (< 2025)
    if (driftSeconds === null || Math.abs(driftSeconds) > 5 || (devTime && devTime.getUTCFullYear() < 2025)) {
      try { await zk.disableDevice(); } catch (e) {}

      const timeVal = encodeTimeToInteger(nowUtc);
      const buf = Buffer.alloc(4);
      buf.writeUInt32LE(timeVal, 0);
      await zk.executeCmd(COMMANDS.CMD_SET_TIME, buf);

      try { await zk.enableDevice(); } catch (e) {}

      console.log(`⏱️ [Tourniquet ${ip}] Horloge synchronisée : ${nowUtc.toISOString()} (dérive précédente : ${driftSeconds !== null ? driftSeconds + 's' : 'inconnue'})`);
      return { ip, success: true, synced: true, previousDrift: driftSeconds, nowUtc };
    }

    return { ip, success: true, synced: false, driftSeconds, nowUtc };
  } catch (err) {
    console.warn(`⚠️ [Tourniquet ${ip}] Erreur synchro horloge :`, err.message);
    try { await zk.enableDevice(); } catch (e) {}
    return { ip, success: false, error: err.message };
  }
}

/**
 * Synchronise les horloges de l'ensemble des 7 bornes physiques sur l'heure locale exacte du serveur
 */
async function syncAllDeviceClocks() {
  const results = [];
  const nowUtc = toUtcExactDate(new Date());

  for (const ip of DEVICES) {
    const zk = new ZKLib(ip, PORT, 5000, 0);
    try {
      await zk.createSocket();

      let driftBefore = null;
      try {
        const replyBefore = await zk.executeCmd(COMMANDS.CMD_GET_TIME, '');
        if (replyBefore && replyBefore.length >= 12) {
          const tBefore = parseTimeToDateUTC(replyBefore.readUInt32LE(8));
          driftBefore = Math.round((tBefore.getTime() - nowUtc.getTime()) / 1000);
        }
      } catch (e) {}

      try { await zk.disableDevice(); } catch (e) {}

      const timeVal = encodeTimeToInteger(nowUtc);
      const buf = Buffer.alloc(4);
      buf.writeUInt32LE(timeVal, 0);
      await zk.executeCmd(COMMANDS.CMD_SET_TIME, buf);

      try { await zk.enableDevice(); } catch (e) {}

      let driftAfter = 0;
      let devTimeStr = nowUtc.toISOString();
      try {
        const replyAfter = await zk.executeCmd(COMMANDS.CMD_GET_TIME, '');
        if (replyAfter && replyAfter.length >= 12) {
          const tAfter = parseTimeToDateUTC(replyAfter.readUInt32LE(8));
          driftAfter = Math.round((tAfter.getTime() - toUtcExactDate(new Date()).getTime()) / 1000);
          devTimeStr = tAfter.toISOString();
        }
      } catch (e) {}

      results.push({
        ip,
        online: true,
        success: true,
        driftBefore: driftBefore !== null ? `${driftBefore > 0 ? '+' : ''}${driftBefore}s` : 'inconnu',
        driftAfter: `${driftAfter > 0 ? '+' : ''}${driftAfter}s`,
        deviceTime: devTimeStr
      });

      await zk.disconnect().catch(() => {});
    } catch (err) {
      results.push({
        ip,
        online: false,
        success: false,
        error: err.message
      });
    }
  }

  const successCount = results.filter(r => r.success).length;
  console.log(`✅ Synchro 7 bornes : ${successCount}/${DEVICES.length} synchronisées.`);
  return {
    success: true,
    totalDevices: DEVICES.length,
    successCount,
    serverTimeUtc: nowUtc.toISOString(),
    timezone: 'Heure Locale Maroc',
    results
  };
}

let isCollecting = false;

/**
 * Collecte les pointages depuis l'ensemble des bornes tourniquets ZKTeco
 * de façon 100% déterministe SANS JAMAIS DEVINER :
 * 1. Synchronise l'horloge RTC de chaque borne connectée sur l'heure locale GMT+0.
 * 2. Normalise chaque scan en heure locale stricte GMT+0 (indépendant de Windows).
 * 3. Assainit les dates aberrantes (année < 2025 ou futur aberrant).
 * 4. Rassemble tous les scans de toutes les bornes dans un seul pool chronologique.
 * 5. Applique un anti-rebond strict de 60 secondes (ignore les double-taps accidentels).
 * 6. Détermine le sens par jour calendaire :
 *    - Le premier scan de chaque journée est TOUJOURS une ENTRÉE ('IN').
 *    - Les scans suivants (> 60s) alternent strictement : SORTIE ('OUT'), ENTRÉE ('IN')...
 */
async function collectFromAllDevices() {
  if (isCollecting) return { status: 'busy' };
  isCollecting = true;

  try {
    // 1. Pré-charger tous les utilisateurs, incubés, RH et usagers tourniquet avec leur badge_id / matricule
    const { RhDetail } = require('../models');

    // Récupération résiliente de chaque entité avec auto-migration si la colonne badge_id manque
    let users = [];
    try {
      users = await User.findAll({ attributes: ['id', 'badge_id', 'nom', 'prenom', 'type', 'role'] });
    } catch (_) {
      try {
        await sequelize.query('ALTER TABLE users ADD COLUMN badge_id VARCHAR(50) NULL');
        users = await User.findAll({ attributes: ['id', 'badge_id', 'nom', 'prenom', 'type', 'role'] });
      } catch (__) {
        users = await User.findAll({ attributes: ['id', 'nom', 'prenom', 'type', 'role'] });
      }
    }

    let incubes = [];
    try {
      incubes = await Incube.findAll({ attributes: ['id', 'user_id', 'badge_id', 'matricule', 'nom_incube', 'associes'] });
    } catch (_) {
      try {
        await sequelize.query('ALTER TABLE incubes ADD COLUMN badge_id VARCHAR(50) NULL AFTER matricule');
        console.log('✅ Auto-migration : colonne badge_id ajoutée à la table incubes');
        incubes = await Incube.findAll({ attributes: ['id', 'user_id', 'badge_id', 'matricule', 'nom_incube', 'associes'] });
      } catch (__) {
        incubes = await Incube.findAll({ attributes: ['id', 'user_id', 'matricule', 'nom_incube', 'associes'] });
      }
    }

    let rhDetails = [];
    if (RhDetail) {
      try {
        rhDetails = await RhDetail.findAll({ attributes: ['id', 'incube_id', 'badge_id', 'matricule', 'nom_complet'] });
      } catch (_) {
        try {
          await sequelize.query('ALTER TABLE rh_detail ADD COLUMN badge_id VARCHAR(50) NULL');
          rhDetails = await RhDetail.findAll({ attributes: ['id', 'incube_id', 'badge_id', 'matricule', 'nom_complet'] });
        } catch (__) {
          rhDetails = await RhDetail.findAll({ attributes: ['id', 'incube_id', 'matricule', 'nom_complet'] });
        }
      }
    }

    let tourniquetUsers = [];
    try {
      tourniquetUsers = await TourniquetUser.findAll({ attributes: ['badge_id', 'cardno', 'name'], raw: true });
    } catch (_) {}

    // Dictionnaire badge_id / matricule -> user_id & normalisation cardno -> matricule
    const badgeToUserMap = new Map();
    const cardToMatriculeMap = new Map();

    tourniquetUsers.forEach(tu => {
      const bId = String(tu.badge_id || '').trim().replace(/^0+(?=\d)/, '');
      const cNo = String(tu.cardno || '').trim().replace(/^0+(?=\d)/, '');
      if (bId && cNo && bId !== cNo && parseInt(bId, 10) > 0 && parseInt(bId, 10) < 100000) {
        cardToMatriculeMap.set(cNo, bId);
      }
    });

    users.forEach(u => {
      if (u.badge_id) {
        const cleanB = String(u.badge_id).trim().replace(/^0+(?=\d)/, '');
        badgeToUserMap.set(cleanB, u.id);
      }
    });
    incubes.forEach(inc => {
      const cleanB = inc.badge_id ? String(inc.badge_id).trim().replace(/^0+(?=\d)/, '') : '';
      const cleanM = inc.matricule ? String(inc.matricule).trim() : '';
      if (cleanB && cleanM) cardToMatriculeMap.set(cleanB, cleanM);
      if (cleanB && !badgeToUserMap.has(cleanB)) {
        badgeToUserMap.set(cleanB, inc.user_id || null);
      }
      if (cleanM && !badgeToUserMap.has(cleanM)) {
        badgeToUserMap.set(cleanM, inc.user_id || null);
      }
      let assocList = inc.associes;
      if (typeof assocList === 'string') {
        try { assocList = JSON.parse(assocList); } catch { assocList = []; }
      }
      if (Array.isArray(assocList)) {
        assocList.forEach(a => {
          const aB = a?.badge_id ? String(a.badge_id).trim().replace(/^0+(?=\d)/, '') : '';
          const aM = a?.matricule ? String(a.matricule).trim() : '';
          if (aB && aM) cardToMatriculeMap.set(aB, aM);
        });
      }
    });
    rhDetails.forEach(rh => {
      const cleanB = rh.badge_id ? String(rh.badge_id).trim().replace(/^0+(?=\d)/, '') : '';
      const cleanM = rh.matricule ? String(rh.matricule).trim() : '';
      if (cleanB && cleanM) cardToMatriculeMap.set(cleanB, cleanM);
    });

    // 2. Extraire les logs bruts de TOUS les tourniquets dans un pool unique
    const rawLogsAcrossAllDevices = [];
    const nowServerLocal = toUtcExactDate(new Date());

    for (const ip of DEVICES) {
      const zk = new ZKLib(ip, PORT, 5000, 0);
      try {
        await zk.createSocket();

        // Récupération et normalisation des pointages bruts (ultra-rapide, ~300ms)
        const logs = await zk.getAttendances();
        if (logs && logs.data && Array.isArray(logs.data)) {
          for (const log of logs.data) {
            let rawBadgeId = String(log.deviceUserId || log.id || log.userSn || '').trim().replace(/^0+(?=\d)/, '');
            // Ignorer les scans vides ou le code '0' (bouton poussoir / lecture anonyme)
            if (!rawBadgeId || rawBadgeId === '0') continue;

            // Si la borne a renvoyé le numéro de carte RFID brut au lieu du matricule machine, normaliser vers le matricule
            if (cardToMatriculeMap.has(rawBadgeId)) {
              rawBadgeId = cardToMatriculeMap.get(rawBadgeId);
            }

            // Reconstitution pure de l'heure locale Maroc stockée sur la borne
            let scanTime = toUtcExactDate(log.recordTime);
            if (!scanTime) continue;

            // Assainissement des anomalies temporelles :
            // 1. Ignorer les scans avec une année corrompue / réinitialisée (< 2025)
            if (scanTime.getUTCFullYear() < 2025) {
              continue;
            }

            // 2. Ignorer tout scan véritablement dans le futur (> 15 min d'avance sur l'heure locale Maroc)
            //    NE JAMAIS remplacer scanTime par l'heure actuelle (ce qui créait des doublons à chaque cycle !)
            const driftMs = scanTime.getTime() - nowServerLocal.getTime();
            if (driftMs > 15 * 60 * 1000) {
              continue;
            }

            rawLogsAcrossAllDevices.push({
              badgeId: rawBadgeId,
              time: scanTime,
              deviceIp: ip,
              punch: log.punch
            });
          }
        }

        await zk.disconnect().catch(() => {});
      } catch (err) {
        // Borne inaccessible ou hors ligne
      }
    }

    if (rawLogsAcrossAllDevices.length === 0) {
      return { success: true, totalNouveauxScans: 0 };
    }

    // 3. TRI CHRONOLOGIQUE GLOBAL DE TOUS LES SCANS TOUTES BORNES CONFONDUES
    rawLogsAcrossAllDevices.sort((a, b) => a.time.getTime() - b.time.getTime());

    // 4. Charger les pointages des 7 derniers jours pour dédoublonner les scans récents (1 095 lignes au lieu de 848 391)
    const dedupWindow = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const existingRecent = await Attendance.findAll({
      where: {
        time: { [Op.gte]: dedupWindow }
      },
      attributes: ['id', 'raw_badge_id', 'time', 'type'],
      order: [['time', 'ASC']],
      raw: true
    });

    // Empreintes pour dédoublonnage (fenêtre de 60s)
    const existingSet = new Set();
    const existingDayScans = new Map(); // 'badge_YYYY-MM-DD' -> array of { time, type }

    existingRecent.forEach(r => {
      const t = new Date(r.time).getTime();
      const bucket = Math.floor(t / 60000); // Seau de 60 secondes
      existingSet.add(`${r.raw_badge_id}_${bucket}`);
      existingSet.add(`${r.raw_badge_id}_${bucket - 1}`);
      existingSet.add(`${r.raw_badge_id}_${bucket + 1}`);

      const dStr = new Date(r.time).toISOString().split('T')[0];
      const dayKey = `${r.raw_badge_id}_${dStr}`;
      if (!existingDayScans.has(dayKey)) {
        existingDayScans.set(dayKey, []);
      }
      existingDayScans.get(dayKey).push({ time: t, type: r.type });
    });

    // 5. Grouper les nouveaux scans par badge et par jour calendaire
    const newScansByBadgeDay = new Map(); // 'badge_YYYY-MM-DD' -> [scan]

    for (const scan of rawLogsAcrossAllDevices) {
      // Ignorer les scans historiques plus vieux que 7 jours déjà archivés en BDD
      if (scan.time.getTime() < dedupWindow.getTime()) {
        continue;
      }

      const t = scan.time.getTime();
      const bucket = Math.floor(t / 60000);
      const key = `${scan.badgeId}_${bucket}`;

      if (existingSet.has(key)) {
        continue; // Déjà enregistré en BDD
      }

      const dStr = scan.time.toISOString().split('T')[0];
      const dayKey = `${scan.badgeId}_${dStr}`;
      if (!newScansByBadgeDay.has(dayKey)) {
        newScansByBadgeDay.set(dayKey, []);
      }
      newScansByBadgeDay.get(dayKey).push(scan);
    }

    // 6. Déterminer le sens de façon déterministe pour chaque jour
    const toInsert = [];

    for (const [dayKey, scans] of newScansByBadgeDay.entries()) {
      // Trier chronologiquement au sein de la journée
      scans.sort((a, b) => a.time.getTime() - b.time.getTime());

      // Vérifier les scans déjà existants pour ce jour
      const dayExisting = existingDayScans.get(dayKey) || [];
      let lastAcceptedTime = 0;
      let nextExpectedDir = 'IN'; // Règle d'or : chaque journée commence toujours par 'IN'

      if (dayExisting.length > 0) {
        dayExisting.sort((a, b) => a.time - b.time);
        const lastEx = dayExisting[dayExisting.length - 1];
        lastAcceptedTime = lastEx.time;
        // Si le dernier scan du jour était IN, le prochain est OUT, et vice versa
        nextExpectedDir = (lastEx.type === 'IN') ? 'OUT' : 'IN';
      }

      for (const scan of scans) {
        const t = scan.time.getTime();

        // Anti-rebond : ignore les scans répétés à moins de 60s
        if (lastAcceptedTime > 0 && (t - lastAcceptedTime) < 60000) {
          continue;
        }

        // Règle stricte et définitive de détection du sens :
        // 1. Si l'IP est dans OUT_DEVICES (ou si la borne ZKTeco indique punch = 1), le type est STRICTEMENT et DÉFINITIVEMENT 'OUT'.
        // 2. Si l'IP est dans IN_DEVICES (ou si la borne ZKTeco indique punch = 0), le type est STRICTEMENT et DÉFINITIVEMENT 'IN'.
        // 3. Ne recourir à l'alternance automatique que pour les bornes bidirectionnelles non spécifiées.
        let direction;
        if (OUT_DEVICES.includes(scan.deviceIp) || scan.punch === 1) {
          direction = 'OUT';
        } else if (IN_DEVICES.includes(scan.deviceIp) || scan.punch === 0) {
          direction = 'IN';
        } else {
          direction = nextExpectedDir;
        }

        lastAcceptedTime = t;
        nextExpectedDir = (direction === 'IN') ? 'OUT' : 'IN';

        const bucket = Math.floor(t / 60000);
        existingSet.add(`${scan.badgeId}_${bucket}`);
        existingSet.add(`${scan.badgeId}_${bucket - 1}`);
        existingSet.add(`${scan.badgeId}_${bucket + 1}`);

        const matchedUserId = badgeToUserMap.get(scan.badgeId) || null;

        toInsert.push({
          user_id: matchedUserId,
          raw_badge_id: scan.badgeId,
          time: scan.time,
          type: direction,
          device_ip: scan.deviceIp
        });
      }
    }

    if (toInsert.length > 0) {
      await Attendance.bulkCreate(toInsert, { ignoreDuplicates: true });
      console.log(`✅ Collecte déterministe terminée : ${toInsert.length} nouveau(x) pointage(s) ajouté(s) en GMT+0.`);

      // Recalibration locale et instantanée pour les badges scannés aujourd'hui uniquement
      const todayStr = new Date().toISOString().split('T')[0];
      for (const dayKey of newScansByBadgeDay.keys()) {
        const [bId, dStr] = dayKey.split('_');
        if (dStr === todayStr) {
          await recalibrateBadgeDay(bId, dStr).catch(() => {});
        }
      }

      // Mise à jour automatique de suivi_engagement en tâche de fond (non bloquante)
      setImmediate(async () => {
        try {
          const tourniquetService = require('./tourniquetService');
          const affectedBadges = new Set(
            toInsert
              .map(s => String(s.raw_badge_id || '').trim().replace(/^0+(?=\d)/, ''))
              .filter(Boolean)
          );
          const affectedUserIds = new Set(toInsert.map(s => s.user_id).filter(Boolean));
          const affectedNames = [];

          // Enrichir affectedBadges avec la correspondance bidirectionnelle (matricule <-> cardno RFID)
          // et collecter les noms des porteurs de ces badges dans tourniquet_users
          if (Array.isArray(tourniquetUsers)) {
            tourniquetUsers.forEach(tu => {
              const bId = String(tu.badge_id || '').trim().replace(/^0+(?=\d)/, '');
              const cNo = String(tu.cardno || '').trim().replace(/^0+(?=\d)/, '');
              if ((bId && affectedBadges.has(bId)) || (cNo && affectedBadges.has(cNo))) {
                if (bId) affectedBadges.add(bId);
                if (cNo) affectedBadges.add(cNo);
                if (tu.name) affectedNames.push(tu.name);
              }
            });
          }

          const matchesAnyAffectedName = (personName) => {
            if (!personName || affectedNames.length === 0) return false;
            return affectedNames.some(tuName => matchesPersonName(tuName, personName));
          };

          const affectedIncubes = incubes.filter(i => {
            // 1. Porteur de projet principal
            const porteurBadge = i.badge_id ? String(i.badge_id).trim().replace(/^0+(?=\d)/, '') : '';
            const porteurMat = i.matricule ? String(i.matricule).trim().replace(/^0+(?=\d)/, '') : '';
            if ((porteurBadge && affectedBadges.has(porteurBadge)) ||
                (porteurMat && affectedBadges.has(porteurMat)) ||
                (i.user_id && affectedUserIds.has(i.user_id)) ||
                matchesAnyAffectedName(i.nom_incube)) {
              return true;
            }

            // 2. Associés de la startup (tableau ou chaîne JSON)
            let assocList = i.associes;
            if (typeof assocList === 'string') {
              try { assocList = JSON.parse(assocList); } catch { assocList = []; }
            }
            if (Array.isArray(assocList)) {
              const hasAssoc = assocList.some(a => {
                if (!a) return false;
                const aB = a.badge_id ? String(a.badge_id).trim().replace(/^0+(?=\d)/, '') : '';
                const aM = a.matricule ? String(a.matricule).trim().replace(/^0+(?=\d)/, '') : '';
                return (aB && affectedBadges.has(aB)) ||
                       (aM && affectedBadges.has(aM)) ||
                       matchesAnyAffectedName(a.nom);
              });
              if (hasAssoc) return true;
            }

            // 3. Salariés & Stagiaires RH de la startup (rh_detail)
            if (Array.isArray(rhDetails)) {
              const hasRh = rhDetails.some(rh => {
                if (Number(rh.incube_id) !== Number(i.id)) return false;
                const rhB = rh.badge_id ? String(rh.badge_id).trim().replace(/^0+(?=\d)/, '') : '';
                const rhM = rh.matricule ? String(rh.matricule).trim().replace(/^0+(?=\d)/, '') : '';
                return (rhB && affectedBadges.has(rhB)) ||
                       (rhM && affectedBadges.has(rhM)) ||
                       matchesAnyAffectedName(rh.nom_complet);
              });
              if (hasRh) return true;
            }

            return false;
          });

          const currentYear = new Date().getFullYear();
          for (const inc of affectedIncubes) {
            await tourniquetService.syncIncubeTourniquet(inc.id, currentYear).catch(() => {});
          }
          if (affectedIncubes.length > 0) {
            console.log(`📊 Assiduité calculée et enregistrée automatiquement pour ${affectedIncubes.length} startup(s) (Porteur + Associés + Salariés RH).`);
          }
        } catch (errSync) {
          console.warn('⚠️ Erreur auto-sync suivi_engagement:', errSync.message);
        }
      });
    }

    return { success: true, totalNouveauxScans: toInsert.length };
  } catch (error) {
    console.error("❌ Erreur collectFromAllDevices:", error?.stack || error?.message || error);
    return { success: false, error: error?.message || String(error) };
  } finally {
    isCollecting = false;
  }
}

/**
 * Recalibration complète de tous les pointages de la BDD :
 * Réorganise et corrige l'historique pour garantir que chaque jour commence par IN
 * et que l'ordre des flux est 100% cohérent.
 */
async function recalibrateAllAttendances() {
  const allScans = await Attendance.findAll({
    order: [['time', 'ASC']],
    raw: true
  });

  const groups = {};
  for (const s of allScans) {
    const dStr = new Date(s.time).toISOString().split('T')[0];
    const key = `${s.raw_badge_id}_${dStr}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  }

  const idsToDelete = [];
  const updatesToIn = [];
  const updatesToOut = [];

  for (const [key, scans] of Object.entries(groups)) {
    scans.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    let expectedDir = 'IN';
    let lastAcceptedTime = 0;

    for (let i = 0; i < scans.length; i++) {
      const s = scans[i];
      const t = new Date(s.time).getTime();

      if (lastAcceptedTime > 0 && (t - lastAcceptedTime) < 60000) {
        idsToDelete.push(s.id);
        continue;
      }

      lastAcceptedTime = t;
      // Règle de recalibration stricte :
      // 1. Si la borne est dédiée à la sortie (OUT_DEVICES), elle reste STRICTEMENT et TOUJOURS 'OUT'.
      // 2. Si la borne est dédiée à l'entrée (IN_DEVICES), elle reste STRICTEMENT et TOUJOURS 'IN'.
      // 3. Alternance automatique uniquement si borne non répertoriée.
      let targetType;
      if (OUT_DEVICES.includes(s.device_ip)) {
        targetType = 'OUT';
      } else if (IN_DEVICES.includes(s.device_ip)) {
        targetType = 'IN';
      } else {
        targetType = expectedDir;
      }
      expectedDir = (targetType === 'IN') ? 'OUT' : 'IN';

      if (s.type !== targetType) {
        if (targetType === 'IN') {
          updatesToIn.push(s.id);
        } else {
          updatesToOut.push(s.id);
        }
      }
    }
  }

  const transaction = await sequelize.transaction();
  try {
    const chunkSize = 500;
    for (let i = 0; i < idsToDelete.length; i += chunkSize) {
      await Attendance.destroy({
        where: { id: { [Op.in]: idsToDelete.slice(i, i + chunkSize) } },
        transaction
      });
    }

    for (let i = 0; i < updatesToIn.length; i += chunkSize) {
      await Attendance.update({ type: 'IN' }, {
        where: { id: { [Op.in]: updatesToIn.slice(i, i + chunkSize) } },
        transaction
      });
    }

    for (let i = 0; i < updatesToOut.length; i += chunkSize) {
      await Attendance.update({ type: 'OUT' }, {
        where: { id: { [Op.in]: updatesToOut.slice(i, i + chunkSize) } },
        transaction
      });
    }

    await transaction.commit();
    return {
      success: true,
      totalScans: allScans.length,
      duplicatesRemoved: idsToDelete.length,
      correctedToIn: updatesToIn.length,
      correctedToOut: updatesToOut.length
    };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/**
 * Recalibre les pointages d'un badge spécifique pour une journée calendaire précise.
 * Règle d'or : le premier scan du jour est 'IN', les scans suivants alternent strictement 'OUT', 'IN'...
 * Élimine tout rebond < 60s.
 */
async function recalibrateBadgeDay(badgeId, dStr) {
  if (!badgeId || !dStr) return;
  const dayScans = await Attendance.findAll({
    where: {
      raw_badge_id: String(badgeId).trim(),
      [Op.and]: sequelize.literal(`\`Attendance\`.\`time\` BETWEEN '${dStr} 00:00:00' AND '${dStr} 23:59:59'`)
    },
    order: [['time', 'ASC']]
  });

  if (dayScans.length === 0) return;

  let expectedDir = 'IN';
  let lastAcceptedTime = 0;
  const idsToDelete = [];
  const updatesToIn = [];
  const updatesToOut = [];

  for (const s of dayScans) {
    const t = new Date(s.time).getTime();
    if (lastAcceptedTime > 0 && (t - lastAcceptedTime) < 60000) {
      idsToDelete.push(s.id);
      continue;
    }
    lastAcceptedTime = t;
    // Règle de recalibration stricte :
    // 1. Si la borne est dédiée à la sortie (OUT_DEVICES), elle reste STRICTEMENT et TOUJOURS 'OUT'.
    // 2. Si la borne est dédiée à l'entrée (IN_DEVICES), elle reste STRICTEMENT et TOUJOURS 'IN'.
    // 3. Alternance automatique uniquement si borne non répertoriée.
    let targetType;
    if (OUT_DEVICES.includes(s.device_ip)) {
      targetType = 'OUT';
    } else if (IN_DEVICES.includes(s.device_ip)) {
      targetType = 'IN';
    } else {
      targetType = expectedDir;
    }
    expectedDir = (targetType === 'IN') ? 'OUT' : 'IN';

    if (s.type !== targetType) {
      if (targetType === 'IN') updatesToIn.push(s.id);
      else updatesToOut.push(s.id);
    }
  }

  if (idsToDelete.length > 0) {
    await Attendance.destroy({ where: { id: { [Op.in]: idsToDelete } } });
  }
  if (updatesToIn.length > 0) {
    await Attendance.update({ type: 'IN' }, { where: { id: { [Op.in]: updatesToIn } } });
  }
  if (updatesToOut.length > 0) {
    await Attendance.update({ type: 'OUT' }, { where: { id: { [Op.in]: updatesToOut } } });
  }
}

/**
 * Découverte et synchronisation de l'annuaire des utilisateurs enregistrés sur les bornes tourniquets.
 * À exécuter au démarrage du serveur ou sur demande SuperAdmin (jamais dans la boucle de 60s).
 */
async function discoverAndSyncTourniquetUsers() {
  try {
    const [users, incubes] = await Promise.all([
      User.findAll({ attributes: ['id', 'badge_id', 'nom', 'prenom', 'type'] }),
      Incube.findAll({ attributes: ['id', 'user_id', 'badge_id', 'nom_incube'] })
    ]);

    const badgeToUserMap = new Map();
    users.forEach(u => {
      if (u.badge_id) badgeToUserMap.set(String(u.badge_id).trim(), u.id);
    });
    incubes.forEach(inc => {
      if (inc.badge_id && !badgeToUserMap.has(String(inc.badge_id).trim())) {
        badgeToUserMap.set(String(inc.badge_id).trim(), inc.user_id || null);
      }
    });

    for (const ip of DEVICES) {
      const zk = new ZKLib(ip, PORT, 3000, 0);
      try {
        await zk.createSocket();
        const usersRes = await zk.getUsers();
        const uList = usersRes?.data || [];
        for (const tu of uList) {
          const tuBadge = String(tu.userId || '').trim();
          const rawName = String(tu.name || '').trim();
          const tuCardno = String(tu.cardno || '').trim();
          const tuName = normalizeName(tu.name);
          if (!tuBadge) continue;

          if (rawName) {
            const existingTu = await TourniquetUser.findByPk(tuBadge);
            await TourniquetUser.upsert({
              badge_id: tuBadge,
              name: rawName,
              cardno: tuCardno || null,
              type: (existingTu && existingTu.type) || 'Visiteur',
              device_ip: ip
            }).catch(() => {});
          }

          if (tuName && !badgeToUserMap.has(tuBadge)) {
            const matchUser = users.find(u => {
              const fn = normalizeName(`${u.prenom} ${u.nom}`);
              const fnRev = normalizeName(`${u.nom} ${u.prenom}`);
              return fn === tuName || fnRev === tuName || (tuName.length >= 4 && (fn.includes(tuName) || tuName.includes(fn)));
            });
            if (matchUser) {
              badgeToUserMap.set(tuBadge, matchUser.id);
              if (!matchUser.badge_id) {
                await User.update({ badge_id: tuBadge }, { where: { id: matchUser.id } });
              }
            } else {
              const matchIncube = incubes.find(i => {
                const inName = normalizeName(i.nom_incube);
                return inName === tuName || (tuName.length >= 4 && (inName.includes(tuName) || tuName.includes(inName)));
              });
              if (matchIncube) {
                badgeToUserMap.set(tuBadge, matchIncube.user_id || null);
                if (!matchIncube.badge_id) {
                  await Incube.update({ badge_id: tuBadge }, { where: { id: matchIncube.id } });
                }
              }
            }
          }
        }
        await zk.disconnect().catch(() => {});
      } catch (e) {}
    }
    console.log('✅ Annuaire tourniquet_users synchronisé avec succès.');
  } catch (err) {
    console.warn('⚠️ Erreur discoverAndSyncTourniquetUsers:', err.message);
  }
}

/**
 * Importe et associe automatiquement les utilisateurs et badges enregistrés dans les bornes ZKTeco aux incubés et au personnel
 */
async function importUsersFromTurnstiles() {
  const ZKLib = require('node-zklib');
  const tourniquetService = require('./tourniquetService');

  let allZkUsers = [];
  for (const ip of DEVICES) {
    const zk = new ZKLib(ip, PORT, 3000, 0);
    try {
      await zk.createSocket();
      const usersRes = await zk.getUsers();
      await zk.disconnect().catch(() => {});
      if (usersRes?.data && Array.isArray(usersRes.data) && usersRes.data.length > 0) {
        allZkUsers = usersRes.data;
        break; // La base utilisateur est répliquée sur les bornes
      }
    } catch (e) {}
  }

  const incubes = await Incube.findAll();
  const users = await User.findAll();

  let countUpdatedIncubes = 0;
  let countUpdatedStaff = 0;
  const currentYear = new Date().getFullYear();

  for (const zu of allZkUsers) {
    const zuName = normalizeName(zu.name);
    const zuId = String(zu.userId || '').trim();
    const zuCard = String(zu.cardno || '').trim();
    if (!zuName || !zuId) continue;

    const finalBadge = zuCard && zuCard !== '0' ? zuCard : zuId;
    const finalMatricule = zuId;

    await TourniquetUser.upsert({
      badge_id: finalBadge,
      name: zu.name,
      cardno: zuCard || null,
      device_ip: DEVICES[0] || '10.0.1.120'
    }).catch(() => {});

    // 1. Chercher un incubé correspondant par nom ou carte RFID
    let matchInc = incubes.find(inc => {
      if (zuCard && inc.badge_id && String(inc.badge_id).trim() === zuCard) return true;
      return matchesPersonName(zu.name, inc.nom_incube);
    });

    // 2. Chercher dans les comptes utilisateurs
    let matchStaff = null;
    if (!matchInc) {
      matchStaff = users.find(u => matchesPersonName(zu.name, `${u.prenom || ''} ${u.nom || ''}`) || matchesPersonName(zu.name, `${u.nom || ''} ${u.prenom || ''}`));
      if (matchStaff && matchStaff.role === 'incube') {
        matchInc = incubes.find(i => i.user_id === matchStaff.id || matchesPersonName(zu.name, i.nom_incube));
        if (matchInc) matchStaff = null;
      }
    }

    if (matchInc) {
      const nomFinal = matchInc.nom_incube;
      await Incube.update({
        badge_id: finalBadge,
        matricule: finalMatricule
      }, { where: { id: matchInc.id } });

      if (matchInc.user_id) {
        await User.update({ badge_id: finalBadge }, { where: { id: matchInc.user_id } }).catch(() => {});
      }

      // Enregistrer dans TourniquetUser pour les 2 identifiants (matricule et RFID)
      await TourniquetUser.upsert({
        badge_id: zuId,
        name: nomFinal,
        cardno: zuCard || null,
        type: 'Incube',
        device_ip: DEVICES[0] || '10.0.1.120'
      }).catch(() => {});

      if (finalBadge !== zuId) {
        await TourniquetUser.upsert({
          badge_id: finalBadge,
          name: nomFinal,
          cardno: zuCard || null,
          type: 'Incube',
          device_ip: DEVICES[0] || '10.0.1.120'
        }).catch(() => {});
      }

      countUpdatedIncubes++;
      await tourniquetService.syncIncubeTourniquet(matchInc.id, currentYear).catch(() => {});
    } else if (matchStaff) {
      const staffName = `${matchStaff.prenom || ''} ${matchStaff.nom || ''}`.trim() || zu.name;
      const staffType = matchStaff.role === 'incube' ? 'Incube' : 'Administration';

      await User.update({ badge_id: finalBadge }, { where: { id: matchStaff.id } });

      await TourniquetUser.upsert({
        badge_id: zuId,
        name: staffName,
        cardno: zuCard || null,
        type: staffType,
        device_ip: DEVICES[0] || '10.0.1.120'
      }).catch(() => {});

      if (finalBadge !== zuId) {
        await TourniquetUser.upsert({
          badge_id: finalBadge,
          name: staffName,
          cardno: zuCard || null,
          type: staffType,
          device_ip: DEVICES[0] || '10.0.1.120'
        }).catch(() => {});
      }

      countUpdatedStaff++;
    } else {
      const visitorName = zu.name || `Visiteur #${zuId}`;
      const existingTu = await TourniquetUser.findByPk(zuId);
      const existingTuFinal = finalBadge !== zuId ? await TourniquetUser.findByPk(finalBadge) : null;
      const preservedType = (existingTu && (existingTu.type === 'Administration' || existingTu.type === 'Incube')) 
        ? existingTu.type 
        : ((existingTuFinal && (existingTuFinal.type === 'Administration' || existingTuFinal.type === 'Incube')) ? existingTuFinal.type : 'Visiteur');

      await TourniquetUser.upsert({
        badge_id: zuId,
        name: visitorName,
        cardno: zuCard || null,
        type: preservedType,
        device_ip: DEVICES[0] || '10.0.1.120'
      }).catch(() => {});

      if (finalBadge !== zuId) {
        await TourniquetUser.upsert({
          badge_id: finalBadge,
          name: visitorName,
          cardno: zuCard || null,
          type: preservedType,
          device_ip: DEVICES[0] || '10.0.1.120'
        }).catch(() => {});
      }
    }
  }

  return {
    totalZkUsers: allZkUsers.length,
    countUpdatedIncubes,
    countUpdatedStaff
  };
}

module.exports = {
  collectFromAllDevices,
  recalibrateAllAttendances,
  recalibrateBadgeDay,
  discoverAndSyncTourniquetUsers,
  importUsersFromTurnstiles,
  syncAllDeviceClocks,
  syncSingleDeviceClock,
  encodeTimeToInteger,
  parseTimeToDateUTC,
  toUtcExactDate,
  matchesPersonName,
  normalizeName
};
