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
 * Synchronise l'horloge interne d'une borne physique ZKTeco avec l'heure exacte GMT+0.
 * Utilise disableDevice() / enableDevice() pour garantir l'application immédiate du RTC.
 */
async function syncSingleDeviceClock(zk, ip) {
  try {
    const nowUtc = new Date();
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

    // Si dérive supérieure à 2 secondes ou année aberrante (< 2025)
    if (driftSeconds === null || Math.abs(driftSeconds) > 2 || (devTime && devTime.getUTCFullYear() < 2025)) {
      try { await zk.disableDevice(); } catch (e) {}

      const timeVal = encodeTimeToInteger(nowUtc);
      const buf = Buffer.alloc(4);
      buf.writeUInt32LE(timeVal, 0);
      await zk.executeCmd(COMMANDS.CMD_SET_TIME, buf);

      try { await zk.enableDevice(); } catch (e) {}

      console.log(`⏱️ [Tourniquet ${ip}] Horloge synchronisée sur GMT+0 : ${nowUtc.toISOString()} (dérive précédente : ${driftSeconds !== null ? driftSeconds + 's' : 'inconnue'})`);
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
 * Synchronise les horloges de l'ensemble des 7 bornes physiques sur l'heure locale exacte GMT+0
 */
async function syncAllDeviceClocks() {
  const results = [];
  const nowUtc = new Date();

  for (const ip of DEVICES) {
    const zk = new ZKLib(ip, PORT, 3000, 4000);
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
          driftAfter = Math.round((tAfter.getTime() - new Date().getTime()) / 1000);
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
  console.log(`✅ Synchro 7 bornes GMT+0 : ${successCount}/${DEVICES.length} synchronisées.`);
  return {
    success: true,
    totalDevices: DEVICES.length,
    successCount,
    serverTimeUtc: nowUtc.toISOString(),
    timezone: 'GMT+0 (Heure Locale)',
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
    // 1. Pré-charger tous les utilisateurs et incubés avec leur badge_id
    const [users, incubes] = await Promise.all([
      User.findAll({ attributes: ['id', 'badge_id', 'nom', 'prenom', 'type'] }),
      Incube.findAll({ attributes: ['id', 'user_id', 'badge_id', 'nom_incube'] })
    ]);

    // Dictionnaire badge_id -> user_id
    const badgeToUserMap = new Map();
    users.forEach(u => {
      if (u.badge_id) badgeToUserMap.set(String(u.badge_id).trim(), u.id);
    });
    incubes.forEach(inc => {
      if (inc.badge_id && !badgeToUserMap.has(String(inc.badge_id).trim())) {
        badgeToUserMap.set(String(inc.badge_id).trim(), inc.user_id || null);
      }
    });

    // 2. Extraire les logs bruts de TOUS les tourniquets dans un pool unique
    const rawLogsAcrossAllDevices = [];
    const nowServerUtc = new Date();

    for (const ip of DEVICES) {
      const zk = new ZKLib(ip, PORT, 3000, 4000);
      try {
        await zk.createSocket();

        // Récupération et normalisation des pointages bruts (ultra-rapide, ~300ms)
        const logs = await zk.getAttendances();
        if (logs && logs.data && Array.isArray(logs.data)) {
          for (const log of logs.data) {
            const rawBadgeId = String(log.deviceUserId || log.id || log.userSn || '').trim();
            if (!rawBadgeId) continue;

            // Reconstitution pure GMT+0 (indépendant des fuseaux Windows/Node)
            let scanTime = toUtcExactDate(log.recordTime);
            if (!scanTime) continue;

            // Assainissement des anomalies temporelles :
            // 1. Ignorer les scans avec une année corrompue / réinitialisée (< 2025)
            if (scanTime.getUTCFullYear() < 2025) {
              continue;
            }

            // 2. Redirection des heures futures aberrantes (> maintenant + 15 min) vers l'heure réelle de collecte
            if (scanTime.getTime() > (nowServerUtc.getTime() + 15 * 60 * 1000)) {
              console.warn(`⚠️ [Tourniquet ${ip}] Scan futur aberrant (${scanTime.toISOString()}) badge #${rawBadgeId} -> Redirigé vers l'heure réelle GMT+0 (${nowServerUtc.toISOString()})`);
              scanTime = new Date(nowServerUtc.getTime());
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
          const affectedBadges = new Set(toInsert.map(s => String(s.raw_badge_id).trim()));
          const affectedUserIds = new Set(toInsert.map(s => s.user_id).filter(Boolean));

          const affectedIncubes = incubes.filter(i => 
            (i.badge_id && affectedBadges.has(String(i.badge_id).trim())) ||
            (i.user_id && affectedUserIds.has(i.user_id))
          );

          const currentYear = new Date().getFullYear();
          for (const inc of affectedIncubes) {
            await tourniquetService.syncIncubeTourniquet(inc.id, currentYear).catch(() => {});
          }
          if (affectedIncubes.length > 0) {
            console.log(`📊 Assiduité calculée et enregistrée automatiquement pour ${affectedIncubes.length} incubé(s).`);
          }
        } catch (errSync) {
          console.warn('⚠️ Erreur auto-sync suivi_engagement:', errSync.message);
        }
      });
    }

    return { success: true, totalNouveauxScans: toInsert.length };
  } catch (error) {
    console.error("❌ Erreur collectFromAllDevices:", error.message);
    return { success: false, error: error.message };
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
      const zk = new ZKLib(ip, PORT, 3000, 4000);
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
            await TourniquetUser.upsert({
              badge_id: tuBadge,
              name: rawName,
              cardno: tuCardno || null,
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

module.exports = {
  collectFromAllDevices,
  recalibrateAllAttendances,
  recalibrateBadgeDay,
  discoverAndSyncTourniquetUsers,
  syncAllDeviceClocks,
  syncSingleDeviceClock,
  encodeTimeToInteger,
  parseTimeToDateUTC,
  toUtcExactDate
};
