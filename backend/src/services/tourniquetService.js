const ZKLib = require('node-zklib');
const ZKLibUDP = require('node-zklib/zklibudp');
const { Op } = require('sequelize');
const { Attendance, User, Incube, SuiviEngagement, TourniquetUser } = require('../models');

// Configuration des bornes tourniquets
const DEFAULT_IPS = [
  '10.0.1.120',
  '10.0.1.201',
  '10.0.1.113',
  '10.0.1.108',
  '10.0.1.116',
  '10.0.1.17',
  '10.0.1.223'
];

const getDeviceIps = () => {
  if (process.env.ZKT_DEVICES) {
    return process.env.ZKT_DEVICES.split(',').map(s => s.trim()).filter(Boolean);
  }
  return DEFAULT_IPS;
};

const ZKT_PORT = parseInt(process.env.ZKT_PORT || '4370', 10);
const ZKT_TIMEOUT = 5000; // 5s timeout per socket

const MOIS_NOMS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

/**
 * Normaliser un texte pour faciliter les correspondances de noms
 */
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
 * Connexion sécurisée à un tourniquet avec timeout et fallback TCP / UDP
 */
async function connectToDevice(ip) {
  // 1. Essai en TCP (port local aléatoire 0 pour éviter tout conflit EADDRINUSE)
  const zk = new ZKLib(ip, ZKT_PORT, ZKT_TIMEOUT, 0);
  try {
    await zk.createSocket();
    return { client: zk, type: 'tcp' };
  } catch (err) {
    // 2. Fallback automatique en UDP (notamment pour la Borne 6 - 10.0.1.17)
    try {
      const udp = new ZKLibUDP(ip, ZKT_PORT, ZKT_TIMEOUT, 0);
      await udp.createSocket();
      await udp.connect();
      return { client: udp, type: 'udp' };
    } catch (err2) {
      throw new Error(`Échec connexion TCP (${err.message}) et UDP (${err2.message}) sur ${ip}`);
    }
  }
}

/**
 * Collecte unifiée des pointages et synchronisation depuis l'ensemble des tourniquets physiques
 * Délègue au collecteur déterministe GMT+0 pour garantir l'absence totale de décalage temporel
 */
async function fetchFromAllDevices() {
  const { collectFromAllDevices } = require('./tourniquetCollector');
  const res = await collectFromAllDevices().catch(err => ({ success: false, error: err.message }));
  const tourniquetUsers = await TourniquetUser.findAll({ raw: true });
  return {
    results: {
      connectedDevices: getDeviceIps(),
      failedDevices: [],
      totalScansFetched: res?.totalNouveauxScans || 0,
      newScansSaved: res?.totalNouveauxScans || 0
    },
    tourniquetUsers
  };
}

/**
 * Rapprochement d'identité : Trouve le badge correspondant à un incubé
 */
async function findBadgeForIncube(incubeIdOrObj) {
  let incube = incubeIdOrObj;
  if (typeof incubeIdOrObj === 'number' || typeof incubeIdOrObj === 'string') {
    incube = await Incube.findByPk(incubeIdOrObj);
  }
  if (!incube) return null;

  // 1. Si déjà renseigné
  if (incube.badge_id) {
    return String(incube.badge_id);
  }

  // 2. Si lié à un User qui a badge_id
  if (incube.user_id) {
    const user = await User.findByPk(incube.user_id);
    if (user && user.badge_id) {
      incube.badge_id = user.badge_id;
      await incube.save();
      return String(user.badge_id);
    }
  }

  // 3. Chercher dans les utilisateurs des tourniquets par nom
  const normIncube = normalizeName(incube.nom_incube);
  const incubeWords = normIncube.split(' ').filter(w => w.length >= 3);

  // Vérifier dans les scans existants ou interroger les tourniquets
  const { tourniquetUsers } = await fetchFromAllDevices().catch(() => ({ tourniquetUsers: [] }));

  let bestMatch = null;
  for (const tu of tourniquetUsers) {
    const normTu = normalizeName(tu.name);
    if (!normTu) continue;

    // Correspondance exacte
    if (normTu === normIncube) {
      bestMatch = tu.badgeId;
      break;
    }

    // Tous les mots de l'incubé sont dans le nom tourniquet ou inversement
    const matchesAll = incubeWords.length > 0 && incubeWords.every(w => normTu.includes(w));
    if (matchesAll) {
      bestMatch = tu.badgeId;
      break;
    }

    // Le nom tourniquet est contenu dans le nom incubé
    if (normTu.length >= 4 && normIncube.includes(normTu)) {
      bestMatch = tu.badgeId;
      break;
    }
  }

  // 4. Si match trouvé, persister pour les futures requêtes
  if (bestMatch) {
    incube.badge_id = bestMatch;
    await incube.save();
    if (incube.user_id) {
      await User.update({ badge_id: bestMatch }, { where: { id: incube.user_id } });
    }
    return bestMatch;
  }

  return null;
}

/**
 * TRAITEMENT DU SIGNAL & CALCUL DES HEURES JOURNALIÈRES (Section 5)
 * 1. Filtrage anti-rebond (moins de 10s d'intervalle ignoré)
 * 2. Appairage Entrée / Sortie (Scan i+1 - Scan i)
 * 3. Scan impair -> forfait de 2 heures (7200s)
 * 4. Somme mensuelle pour les 12 mois
 */
function processScansToMonthlyHours(rawScans, targetYear = new Date().getFullYear()) {
  const monthlyHours = {};
  MOIS_NOMS.forEach(m => { monthlyHours[m] = 0; });

  if (!Array.isArray(rawScans) || rawScans.length === 0) {
    return {
      monthlyHours,
      totalHours: 0,
      daysPresent: 0,
      totalValidScans: 0
    };
  }

  // Trier chronologiquement
  const sorted = [...rawScans].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  // 1. Filtrage anti-rebond (< 60s)
  const debounced = [];
  for (let i = 0; i < sorted.length; i++) {
    const curr = sorted[i];
    const currTime = new Date(curr.time).getTime();
    if (debounced.length === 0) {
      debounced.push(curr);
    } else {
      const prevTime = new Date(debounced[debounced.length - 1].time).getTime();
      if ((currTime - prevTime) >= 60000) { // >= 60 secondes anti-rebond
        debounced.push(curr);
      }
    }
  }

  // Filtrer pour l'année ciblée et grouper par jour calendaire (YYYY-MM-DD)
  const daysMap = new Map(); // 'YYYY-MM-DD' -> [timestamps]

  for (const s of debounced) {
    const d = new Date(s.time);
    if (d.getFullYear() === Number(targetYear)) {
      const dayKey = d.toISOString().split('T')[0];
      if (!daysMap.has(dayKey)) {
        daysMap.set(dayKey, []);
      }
      daysMap.get(dayKey).push(d.getTime());
    }
  }

  let grandTotalSeconds = 0;
  let totalDaysPresent = daysMap.size;

  // 2. Traitement journalier par appairage
  for (const [dayKey, dayTimestamps] of daysMap.entries()) {
    dayTimestamps.sort((a, b) => a - b);
    let daySeconds = 0;
    const n = dayTimestamps.length;

    // Appairer deux par deux
    for (let i = 0; i < n - 1; i += 2) {
      const entryTime = dayTimestamps[i];
      const exitTime = dayTimestamps[i + 1];
      const diffSec = Math.max(0, (exitTime - entryTime) / 1000);
      
      // Plafond de sécurité : une séance continue ne peut dépasser 14 heures (50400s)
      const cappedSec = Math.min(diffSec, 50400);
      daySeconds += cappedSec;
    }

    // En cas de scan impair (entrée sans badgeage de sortie), appliquer un forfait de 2 heures (7200 secondes)
    if (n % 2 !== 0) {
      daySeconds += 7200; // 2 heures
    }

    grandTotalSeconds += daySeconds;

    // Ajouter au mois correspondant
    const monthIndex = parseInt(dayKey.split('-')[1], 10) - 1; // 0..11
    if (monthIndex >= 0 && monthIndex < 12) {
      const mName = MOIS_NOMS[monthIndex];
      monthlyHours[mName] += daySeconds / 3600;
    }
  }

  // Arrondir à 1 décimale pour chaque mois
  MOIS_NOMS.forEach(m => {
    monthlyHours[m] = Math.round(monthlyHours[m] * 10) / 10;
  });

  const totalHours = Math.round((grandTotalSeconds / 3600) * 10) / 10;

  return {
    monthlyHours,
    totalHours,
    daysPresent: totalDaysPresent,
    totalValidScans: debounced.length
  };
}

/**
 * Calcul des indicateurs d'engagement contractuel (Section 4)
 */
function calculateEngagementMetrics(monthlyHours, options = {}) {
  const { hasBadge = true, annee = new Date().getFullYear() } = options;
  const OBJECTIF_HEBDO = 15; // 15h / semaine
  const OBJECTIF_MOIS = 60;  // 60h / mois
  const OBJECTIF_ANNEE = 720; // 720h / an

  const currentYear = new Date().getFullYear();
  const currentMonthIdx = new Date().getMonth();

  const totalYearHours = Object.values(monthlyHours || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
  let totalHeures = 0;
  let countMoisAvecHeures = 0;
  const statutsParMois = {};

  MOIS_NOMS.forEach((m, idx) => {
    const h = monthlyHours[m] || 0;
    if (h > 0) {
      totalHeures += h;
      countMoisAvecHeures++;
    }

    const isFuture = Number(annee) === currentYear && idx > currentMonthIdx;

    // Taux mois
    const tauxMois = Math.round((h / OBJECTIF_MOIS) * 100);
    let statut = 'NON CONFORME';
    let statutColor = 'red';

    if (h > 0) {
      if (tauxMois >= 100) {
        statut = 'CONFORME';
        statutColor = 'emerald';
      } else if (tauxMois >= 75) {
        statut = 'ATTENTION';
        statutColor = 'amber';
      }
    } else {
      if (!hasBadge) {
        statut = 'SANS BADGE';
        statutColor = 'slate';
      } else if (isFuture) {
        statut = 'À VENIR';
        statutColor = 'slate';
      } else if (totalYearHours === 0) {
        statut = 'EN ATTENTE';
        statutColor = 'slate';
      }
    }

    statutsParMois[m] = {
      heures: h,
      tauxMois,
      statut,
      statutColor,
      isFuture,
      hasBadge
    };
  });

  const moyMensuelle = countMoisAvecHeures > 0 ? (totalHeures / countMoisAvecHeures) : 0;
  const moyHebdo = countMoisAvecHeures > 0 ? (moyMensuelle / 4) : 0;
  const tauxHebdo = countMoisAvecHeures > 0 ? Math.round((moyHebdo / OBJECTIF_HEBDO) * 100) : 0;
  const tauxMoisMoyen = countMoisAvecHeures > 0 ? Math.round((moyMensuelle / OBJECTIF_MOIS) * 100) : 0;
  const objCumule = countMoisAvecHeures * OBJECTIF_MOIS;
  const tauxAnnuelCumule = objCumule > 0 ? Math.round((totalHeures / objCumule) * 100) : 0;

  return {
    totalHeures: Math.round(totalHeures * 10) / 10,
    countMoisAvecHeures,
    moyMensuelle: Math.round(moyMensuelle * 10) / 10,
    moyHebdo: Math.round(moyHebdo * 10) / 10,
    tauxHebdo,
    tauxMois: tauxMoisMoyen,
    tauxAnnuelCumule,
    statutsParMois
  };
}

/**
 * Synchronise les pointages pour un incubé spécifique et met à jour suivi_engagement
 */
async function syncIncubeTourniquet(incubeId, annee = new Date().getFullYear()) {
  const incube = await Incube.findByPk(incubeId);
  if (!incube) {
    throw new Error(`Incubé #${incubeId} introuvable`);
  }

  // 1. Déclencher une collecte en arrière-plan (non-bloquante pour la réponse HTTP)
  try {
    const { collectFromAllDevices } = require('./tourniquetCollector');
    collectFromAllDevices().catch(() => {});
  } catch (e) {}

  // 2. Trouver l'identifiant badge de l'incubé
  const badgeId = await findBadgeForIncube(incube);
  const hasBadge = Boolean(badgeId || incube.matricule);

  // 3. Récupérer les pointages en BDD (recherche par badge RFID, matricule machine ou user_id)
  const whereClause = {
    [Op.or]: []
  };

  if (badgeId) {
    whereClause[Op.or].push({ raw_badge_id: String(badgeId).trim() });
  }
  if (incube.matricule) {
    whereClause[Op.or].push({ raw_badge_id: String(incube.matricule).trim() });
  }
  if (incube.user_id) {
    whereClause[Op.or].push({ user_id: incube.user_id });
  }

  let scans = [];
  if (whereClause[Op.or].length > 0) {
    scans = await Attendance.findAll({
      where: whereClause,
      order: [['time', 'ASC']]
    });
  }

  // 4. Traitement du signal et calcul des heures mensuelles
  const { monthlyHours, totalHours, daysPresent, totalValidScans } = processScansToMonthlyHours(scans, annee);
  const metrics = calculateEngagementMetrics(monthlyHours, { hasBadge, annee });

  // 5. Mettre à jour la table suivi_engagement de façon strictement protectrice
  // RÈGLE : Si l'incubé n'a pas de badge ou n'a aucun scan pour cette année, on ne touche JAMAIS aux données déjà enregistrées !
  if (scans.length > 0) {
    const existingRows = await SuiviEngagement.findAll({
      where: {
        incube_id: incube.id,
        annee: Number(annee)
      }
    });
    const rowsByMonth = new Map(existingRows.map(r => [r.mois, r]));

    for (const m of MOIS_NOMS) {
      const heures = monthlyHours[m] || 0;
      const engagementRow = rowsByMonth.get(m);

      if (engagementRow) {
        // Ne mettre à jour que si des heures positives réelles ont été mesurées et diffèrent
        if (heures > 0 && engagementRow.moyenne_heures_presence !== heures) {
          engagementRow.moyenne_heures_presence = heures;
          await engagementRow.save();
        }
      } else if (heures > 0) {
        await SuiviEngagement.create({
          incube_id: incube.id,
          mois: m,
          annee: Number(annee),
          moyenne_heures_presence: heures,
          taux_presence_formation: null,
          initiatives: '',
          observations: ''
        });
      }
    }
  }

  return {
    incube: {
      id: incube.id,
      nom_incube: incube.nom_incube,
      badge_id: badgeId || null,
      hasBadge
    },
    annee: Number(annee),
    monthlyHours,
    metrics,
    daysPresent,
    totalValidScans
  };
}

/**
 * Live Presence : Personnes actuellement à l'intérieur du bâtiment (Section 7.2)
 */
async function getLivePresence() {
  // Synchroniser rapidement depuis les bornes
  await fetchFromAllDevices().catch(() => {});

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const scansToday = await Attendance.findAll({
    where: {
      time: { [Op.gte]: today }
    },
    order: [['time', 'ASC']]
  });

  const [users, incubes, tourniquetUsers] = await Promise.all([
    User.findAll(),
    Incube.findAll(),
    TourniquetUser.findAll()
  ]);

  // Grouper les scans par badgeId
  const byBadge = new Map();
  for (const s of scansToday) {
    if (!byBadge.has(s.raw_badge_id)) {
      byBadge.set(s.raw_badge_id, []);
    }
    byBadge.get(s.raw_badge_id).push(s);
  }

  const liveList = [];

  for (const [badgeId, badgeScans] of byBadge.entries()) {
    // Filtrage anti-rebond 10s
    const filtered = [];
    for (const sc of badgeScans) {
      if (filtered.length === 0) {
        filtered.push(sc);
      } else {
        const diff = new Date(sc.time).getTime() - new Date(filtered[filtered.length - 1].time).getTime();
        if (diff >= 10000) filtered.push(sc);
      }
    }

    // Si nombre de scans est impair, la personne est actuellement entrée sans ressortir
    const isInside = filtered.length % 2 !== 0;

    if (isInside) {
      const lastScan = filtered[filtered.length - 1];
      
      // Trouver les infos de l'usager
      let nom = 'Usager Badge #' + badgeId;
      let prenom = '';
      let type = 'Visiteur';
      let email = null;
      let incubeId = null;

      // 1. Chercher dans Incube (par badge_id ou matricule)
      let incMatch = incubes.find(i => 
        (i.badge_id && String(i.badge_id).trim() === badgeId) ||
        (i.matricule && String(i.matricule).trim() === badgeId)
      );

      // 2. Chercher dans TourniquetUser
      const tuMatch = tourniquetUsers.find(tu => 
        String(tu.badge_id).trim() === badgeId || 
        (tu.cardno && String(tu.cardno).trim() === badgeId)
      );

      // Fallback par carte RFID ou nom
      if (!incMatch && tuMatch) {
        if (tuMatch.cardno) {
          incMatch = incubes.find(i => i.badge_id && String(i.badge_id).trim() === String(tuMatch.cardno).trim());
        }
        if (!incMatch && tuMatch.name) {
          incMatch = incubes.find(i => matchesPersonName(tuMatch.name, i.nom_incube));
        }
      }

      // 3. Chercher dans User
      let uMatch = null;
      if (!incMatch) {
        uMatch = users.find(u => 
          (u.badge_id && String(u.badge_id).trim() === badgeId) || 
          (lastScan.user_id && u.id === lastScan.user_id) ||
          (tuMatch && matchesPersonName(tuMatch.name, `${u.prenom || ''} ${u.nom || ''}`))
        );
        if (uMatch && uMatch.role === 'incube') {
          incMatch = incubes.find(i => i.user_id === uMatch.id || matchesPersonName(i.nom_incube, `${uMatch.prenom || ''} ${uMatch.nom || ''}`));
        }
      }

      if (incMatch) {
        nom = incMatch.nom_incube;
        type = 'Incube';
        email = incMatch.email;
        incubeId = incMatch.id;
      } else if (uMatch) {
        nom = `${uMatch.prenom || ''} ${uMatch.nom || ''}`.trim() || 'Utilisateur';
        type = uMatch.type || (uMatch.role === 'incube' ? 'Incube' : 'Administration');
        email = uMatch.email;
      } else if (tuMatch) {
        nom = tuMatch.name;
        prenom = '';
        type = tuMatch.type || 'Visiteur';
      }

      liveList.push({
        badgeId,
        nom: (nom + ' ' + prenom).trim(),
        type,
        email,
        incubeId,
        entreeTime: lastScan.time,
        deviceIp: lastScan.device_ip
      });
    }
  }

  return {
    totalPresents: liveList.length,
    presents: liveList,
    horodatage: new Date().toISOString()
  };
}

/**
 * Historique d'activité pour les catégories hors-incubés (Section 7.3)
 */
async function getActivityByType(userType = 'Formation', startDate = null, endDate = null) {
  const whereUser = {};
  if (userType && userType !== 'all') {
    whereUser.type = userType;
  }

  const users = await User.findAll({
    where: whereUser,
    attributes: ['id', 'nom', 'prenom', 'email', 'type', 'badge_id', 'role']
  });

  const userIds = users.map(u => u.id);
  const badgeIds = users.map(u => u.badge_id).filter(Boolean);

  const whereAtt = {
    [Op.or]: [
      { user_id: { [Op.in]: userIds } },
      { raw_badge_id: { [Op.in]: badgeIds } }
    ]
  };

  if (startDate || endDate) {
    whereAtt.time = {};
    if (startDate) whereAtt.time[Op.gte] = new Date(startDate);
    if (endDate) whereAtt.time[Op.lte] = new Date(endDate);
  }

  const attendances = await Attendance.findAll({
    where: whereAtt,
    order: [['time', 'DESC']]
  });

  // Compiler statistiques par usager
  const summary = users.map(u => {
    const userScans = attendances.filter(a => a.user_id === u.id || (u.badge_id && a.raw_badge_id === u.badge_id));
    const processed = processScansToMonthlyHours(userScans);
    return {
      id: u.id,
      nom: `${u.prenom || ''} ${u.nom || ''}`.trim(),
      email: u.email,
      type: u.type,
      badgeId: u.badge_id,
      totalScans: userScans.length,
      daysPresent: processed.daysPresent,
      totalHours: processed.totalHours,
      lastSeen: userScans.length > 0 ? userScans[0].time : null
    };
  });

  return {
    userType,
    countUsers: summary.length,
    summary,
    recentScans: attendances.slice(0, 50)
  };
}


/**
 * Encode un utilisateur au format 72 octets requis par les terminaux ZKTeco F18
 */
function encodeUser72(uid, userId, name, cardno = 0, password = '', role = 0) {
  const buf = Buffer.alloc(72, 0);
  buf.writeUInt16LE(Number(uid) || 1, 0);
  buf.writeUInt8(Number(role) || 0, 2);
  if (password) buf.write(String(password).slice(0, 8), 3, 'ascii');
  if (name) buf.write(String(name).slice(0, 24), 11, 'ascii');
  const cardInt = parseInt(cardno, 10);
  if (!isNaN(cardInt) && cardInt > 0) {
    buf.writeUInt32LE(cardInt, 35);
  }
  if (userId) buf.write(String(userId).slice(0, 24), 48, 'ascii');
  return buf;
}

/**
 * Calculer le prochain numéro de matricule libre
 */
async function getNextAvailableMatricule() {
  const { sequelize } = require('../models');
  const [incubeMax] = await sequelize.query('SELECT MAX(matricule) as m FROM incubes');
  const [rhMax] = await sequelize.query('SELECT MAX(matricule) as m FROM rh_detail');
  
  const m1 = incubeMax?.[0]?.m ? parseInt(incubeMax[0].m, 10) : 0;
  const m2 = rhMax?.[0]?.m ? parseInt(rhMax[0].m, 10) : 0;
  
  const currentMax = Math.max(m1, m2);
  return currentMax >= 112 ? currentMax + 1 : 112;
}

/**
 * Vérifier l'unicité d'un badge RFID à travers toute la base de données
 */
async function checkBadgeRfidUniqueness(badgeId, options = {}) {
  if (!badgeId) return { isUnique: true };
  const cleanBadge = String(badgeId).trim();
  if (!cleanBadge) return { isUnique: true };

  const { excludeIncubeId = null, excludeRhId = null, excludeUserId = null } = options;
  const { Incube, RhDetail, User } = require('../models');

  // 1. incubes
  const whereIncube = { badge_id: cleanBadge };
  if (excludeIncubeId) whereIncube.id = { [Op.ne]: excludeIncubeId };
  const existingIncube = await Incube.findOne({ where: whereIncube });
  if (existingIncube) {
    return {
      isUnique: false,
      conflictType: 'Porteur de Projet (Startup)',
      conflictName: existingIncube.nom_incube,
      conflictEntity: existingIncube.raison_sociale || 'Startup'
    };
  }

  // 2. rh_detail
  const whereRh = { badge_id: cleanBadge };
  if (excludeRhId) whereRh.id = { [Op.ne]: excludeRhId };
  const existingRh = await RhDetail.findOne({ 
    where: whereRh,
    include: [{ model: Incube, as: 'incube', attributes: ['id', 'nom_incube', 'raison_sociale'] }]
  });
  if (existingRh) {
    return {
      isUnique: false,
      conflictType: 'Salarié Staff Startup',
      conflictName: existingRh.nom_complet,
      conflictEntity: existingRh.incube?.raison_sociale || 'Startup'
    };
  }

  // 2.5 associés des incubés
  const allIncubesForAssoc = await Incube.findAll();
  for (const inc of allIncubesForAssoc) {
    if (excludeIncubeId && inc.id === excludeIncubeId) continue;
    if (Array.isArray(inc.associes)) {
      const matchedAssoc = inc.associes.find(a => String(a.badge_id || '').trim() === cleanBadge);
      if (matchedAssoc) {
        return {
          isUnique: false,
          conflictType: 'Associé Startup',
          conflictName: matchedAssoc.nom,
          conflictEntity: inc.raison_sociale || inc.nom_incube || 'Startup'
        };
      }
    }
  }

  // 3. users (staff interne)
  const whereUser = { badge_id: cleanBadge };
  if (excludeUserId) whereUser.id = { [Op.ne]: excludeUserId };
  const existingUser = await User.findOne({ where: whereUser });
  if (existingUser) {
    return {
      isUnique: false,
      conflictType: 'Utilisateur Plateforme',
      conflictName: `${existingUser.prenom} ${existingUser.nom}`,
      conflictEntity: existingUser.role
    };
  }

  return { isUnique: true };
}

/**
 * Diffusion instantanée d'un utilisateur vers les 7 Tourniquets F18
 */
async function broadcastUserToTurnstiles({ matricule, name, cardno, role = 0, type = 'Incube' }) {
  const ips = getDeviceIps();
  const uid = parseInt(matricule, 10) || 1;
  const userId = String(matricule);
  const cardInt = parseInt(cardno, 10) || 0;
  const cleanName = String(name || '').trim().slice(0, 24);

  const results = {
    matricule: uid,
    name: cleanName,
    cardno: cardInt,
    totalDevices: ips.length,
    successfulDevices: [],
    failedDevices: []
  };

  // 1. Mettre à jour le cache MySQL TourniquetUser
  try {
    const { TourniquetUser } = require('../models');
    await TourniquetUser.upsert({
      badge_id: String(uid),
      name: cleanName,
      cardno: cardInt > 0 ? String(cardInt) : null,
      type: type || 'Incube',
      device_ip: ips[0]
    });
    // Double indexation : enregistrer également sous le numéro RFID de la carte
    if (cardInt > 0 && String(cardInt) !== String(uid)) {
      await TourniquetUser.upsert({
        badge_id: String(cardInt),
        name: cleanName,
        cardno: String(cardInt),
        type: type || 'Incube',
        device_ip: ips[0]
      });
    }
  } catch (err) {
    console.error('Erreur upsert TourniquetUser:', err.message);
  }

  // 2. Diffusion séquentielle fiable vers les 7 bornes physiques F18 (garantit zéro collision)
  const userBuf = encodeUser72(uid, userId, cleanName, cardInt, '', role);
  const CMD_USER_WRQ = 8;
  const CMD_REFRESHDATA = 1013;

  for (const ip of ips) {
    let conn = null;
    try {
      conn = await connectToDevice(ip);
      await conn.client.executeCmd(CMD_USER_WRQ, userBuf);
      await conn.client.executeCmd(CMD_REFRESHDATA, '');
      await conn.client.disconnect().catch(() => {});
      results.successfulDevices.push(ip);
    } catch (err) {
      if (conn && conn.client) await conn.client.disconnect().catch(() => {});
      results.failedDevices.push({ ip, error: err.message });
    }
  }

  console.log(`📡 [F18 Broadcast] Diffusion de l'usager #${uid} (${cleanName}, Badge: ${cardInt}) : ${results.successfulDevices.length}/${ips.length} bornes connectées.`);

  return results;
}

/**
 * Ré-injecter en masse tous les incubés, salariés RH, associés et admins ayant un badge RFID
 * vers les 7 Tourniquets F18 pour forcer l'écrasement de tous les anciens noms physiques.
 */
async function resyncAllBadgeHoldersToTurnstiles() {
  const { Incube, RhDetail, User } = require('../models');
  const [incubes, staff, users] = await Promise.all([
    Incube.findAll(),
    RhDetail.findAll({ where: { badge_id: { [Op.ne]: null } } }),
    User.findAll({ where: { badge_id: { [Op.ne]: null } } })
  ]);

  const allToSync = [];

  for (const inc of incubes) {
    if (inc.badge_id) {
      if (!inc.matricule) {
        inc.matricule = await getNextAvailableMatricule();
        await inc.save();
      }
      allToSync.push({
        matricule: inc.matricule,
        name: inc.nom_incube,
        cardno: inc.badge_id,
        type: 'Incube'
      });
    }

    // Inclure les associés de la startup
    if (Array.isArray(inc.associes)) {
      for (const a of inc.associes) {
        if (a && a.badge_id) {
          allToSync.push({
            matricule: a.matricule || inc.matricule,
            name: a.nom,
            cardno: a.badge_id,
            type: 'Incube'
          });
        }
      }
    }
  }

  for (const s of staff) {
    if (!s.matricule) {
      s.matricule = await getNextAvailableMatricule();
      await s.save();
    }
    allToSync.push({
      matricule: s.matricule,
      name: s.nom_complet,
      cardno: s.badge_id,
      type: 'Incube'
    });
  }

  for (const u of users) {
    allToSync.push({
      matricule: u.id,
      name: `${u.prenom || ''} ${u.nom || ''}`.trim() || 'Admin',
      cardno: u.badge_id,
      type: u.type || 'Administration'
    });
  }

  let successCount = 0;
  for (const item of allToSync) {
    try {
      await broadcastUserToTurnstiles(item);
      successCount++;
    } catch (e) {
      console.warn(`⚠️ Échec sync usager #${item.matricule} (${item.name}):`, e.message);
    }
  }

  return { total: allToSync.length, successCount };
}

/**
 * Récupère le matricule existant associé à un badge ou à un nom sur les tourniquets,
 * ou calcule le prochain matricule disponible pour éviter TOUT DOUBLON D'ID !
 */
async function getOrCreateMatriculeForBadge(badgeId, personName = '', existingMatricule = null) {
  if (existingMatricule && parseInt(existingMatricule, 10) > 0) {
    return parseInt(existingMatricule, 10);
  }

  const { TourniquetUser, Incube, RhDetail } = require('../models');
  const cleanBadge = badgeId ? String(badgeId).trim() : '';

  // 1. Si le badge est déjà associé à un incubé ayant un matricule
  if (cleanBadge) {
    const inc = await Incube.findOne({ where: { badge_id: cleanBadge } });
    if (inc && inc.matricule) return inc.matricule;

    // 2. Si le badge est déjà associé à un salarié RH ayant un matricule
    const rh = await RhDetail.findOne({ where: { badge_id: cleanBadge } });
    if (rh && rh.matricule) return rh.matricule;

    // 3. Si le badge existe déjà sur les tourniquets (TourniquetUser)
    const tuByCard = await TourniquetUser.findOne({ where: { cardno: cleanBadge } });
    if (tuByCard && parseInt(tuByCard.badge_id, 10) > 0 && parseInt(tuByCard.badge_id, 10) < 1000000) {
      return parseInt(tuByCard.badge_id, 10);
    }
    const tuByBadge = await TourniquetUser.findByPk(cleanBadge);
    if (tuByBadge && parseInt(tuByBadge.badge_id, 10) > 0 && parseInt(tuByBadge.badge_id, 10) < 1000000) {
      return parseInt(tuByBadge.badge_id, 10);
    }
  }

  // 4. Si le nom correspond à un usager déjà présent sur les tourniquets
  if (personName && personName.trim()) {
    const allTu = await TourniquetUser.findAll();
    const tuMatch = allTu.find(t => matchesPersonName(personName, t.name));
    if (tuMatch && parseInt(tuMatch.badge_id, 10) > 0 && parseInt(tuMatch.badge_id, 10) < 1000000) {
      return parseInt(tuMatch.badge_id, 10);
    }
  }

  // 5. Sinon, allouer le prochain matricule machine libre
  return await getNextAvailableMatricule();
}

/**
 * Vérification complète et approfondie de l'état d'un badge RFID
 */
async function verifyBadgeStatus(badgeId) {
  if (!badgeId || !String(badgeId).trim()) {
    return { valid: false, message: 'Numéro de badge manquant' };
  }
  const cleanBadge = String(badgeId).trim();
  const { Incube, RhDetail, User, TourniquetUser } = require('../models');

  let assignedTo = null;

  // 1. Vérifier si c'est un Administrateur certifié
  const ADMIN_KNOWN_BADGES = {
    '1': { nom: 'Administrateur IDS', email: 'admin@cgs-incubateur.ma' },
    '6': { nom: 'Nadia SEFIANI', email: 'nadia.sefiani@ctpes.ma' },
    '3': { nom: 'Mustapha', email: 'mustapha@ctpes.ma' },
    '143': { nom: 'Ayoub EL BOUCHIKHI', email: 'ayoub.elbouchikhi@ctpes.ma' },
    '7587580': { nom: 'Ayoub EL BOUCHIKHI', email: 'ayoub.elbouchikhi@ctpes.ma' },
    '194': { nom: 'Ilham LAHBOUB', email: 'ilham.lahboub@ctpes.ma' },
    '7561307': { nom: 'Ilham LAHBOUB', email: 'ilham.lahboub@ctpes.ma' },
    '227': { nom: 'Hicham BELAAZIZ', email: 'hicham@ctpes.ma' },
    '6883058': { nom: 'Hicham BELAAZIZ', email: 'hicham@ctpes.ma' },
    '144': { nom: 'Kawtar SBAI', email: 'kawtar@ctpes.ma' },
    '7568112': { nom: 'Kawtar SBAI', email: 'kawtar@ctpes.ma' },
    '205': { nom: 'Charaf EL AMRANI', email: 'charaf@ctpes.ma' },
    '7586646': { nom: 'Charaf EL AMRANI', email: 'charaf@ctpes.ma' },
    '142': { nom: 'Amine MEZZYANE', email: 'Aminemezzyane@gmail.com' },
    '6895052': { nom: 'Amine MEZZYANE', email: 'Aminemezzyane@gmail.com' },
    '145': { nom: 'Test AMA', email: 'incubateur.digital.solidaire@gmail.com' },
    '7600900': { nom: 'Test AMA', email: 'incubateur.digital.solidaire@gmail.com' }
  };
  if (ADMIN_KNOWN_BADGES[cleanBadge]) {
    assignedTo = {
      type: 'Administration',
      nom: ADMIN_KNOWN_BADGES[cleanBadge].nom,
      email: ADMIN_KNOWN_BADGES[cleanBadge].email,
      entite: 'Équipe IDS'
    };
  }

  // 2. Vérifier dans incubes (Porteur)
  if (!assignedTo) {
    const inc = await Incube.findOne({ where: { badge_id: cleanBadge } });
    if (inc) {
      assignedTo = {
        type: 'Incubé (Porteur de projet)',
        nom: inc.nom_incube,
        matricule: inc.matricule,
        entite: inc.raison_sociale || inc.nom_incube,
        incubeId: inc.id,
        pp_numero: inc.pp_numero
      };
    }
  }

  // 3. Vérifier dans les associés de tous les incubés
  if (!assignedTo) {
    const allIncubes = await Incube.findAll();
    for (const inc of allIncubes) {
      if (Array.isArray(inc.associes)) {
        const found = inc.associes.find(a => String(a.badge_id || '').trim() === cleanBadge);
        if (found) {
          assignedTo = {
            type: 'Associé Startup',
            nom: found.nom,
            fonction: found.fonction || 'Associé',
            matricule: found.matricule,
            entite: inc.raison_sociale || inc.nom_incube,
            incubeId: inc.id
          };
          break;
        }
      }
    }
  }

  // 4. Vérifier dans rh_detail
  if (!assignedTo) {
    const rh = await RhDetail.findOne({
      where: { badge_id: cleanBadge },
      include: [{ model: Incube, as: 'incube', attributes: ['id', 'nom_incube', 'raison_sociale'] }]
    });
    if (rh) {
      assignedTo = {
        type: 'Salarié RH / Stagiaire',
        nom: rh.nom_complet,
        poste: rh.poste || 'Salarié',
        matricule: rh.matricule,
        entite: rh.incube?.raison_sociale || rh.incube?.nom_incube || 'Startup',
        incubeId: rh.incube_id
      };
    }
  }

  // 5. Vérifier dans users
  if (!assignedTo) {
    const u = await User.findOne({ where: { badge_id: cleanBadge } });
    if (u) {
      assignedTo = {
        type: 'Compte Utilisateur',
        nom: `${u.prenom || ''} ${u.nom || ''}`.trim(),
        role: u.role,
        entite: u.type || 'Administration'
      };
    }
  }

  // 6. Vérifier dans la mémoire physique / cache tourniquet_users
  const tuByCard = await TourniquetUser.findOne({ where: { cardno: cleanBadge } });
  const tuByBadge = await TourniquetUser.findByPk(cleanBadge);
  const tu = tuByCard || tuByBadge;

  return {
    badge_id: cleanBadge,
    isAvailable: !assignedTo,
    assignedTo,
    tourniquetInfo: tu ? {
      machineId: tu.badge_id,
      nameOnDevice: tu.name,
      cardno: tu.cardno,
      type: tu.type
    } : null
  };
}

/**
 * Relie automatiquement les badges physiques déjà présents sur les tourniquets
 * aux salariés RH et aux associés des incubés.
 */
async function autoLinkExistingTourniquetBadges() {
  const { RhDetail, TourniquetUser, Incube } = require('../models');

  const rhList = await RhDetail.findAll({
    include: [{ model: Incube, as: 'incube', attributes: ['id', 'nom_incube', 'raison_sociale'] }]
  });
  const tUsers = await TourniquetUser.findAll();
  const incubes = await Incube.findAll();

  let linkedRhCount = 0;
  const linkedRhDetails = [];

  for (const rh of rhList) {
    if (!rh.badge_id || String(rh.badge_id).trim() === '') {
      const tu = tUsers.find(t => matchesPersonName(rh.nom_complet, t.name));
      if (tu) {
        const finalBadge = (tu.cardno && tu.cardno !== '0') ? String(tu.cardno) : String(tu.badge_id);
        const finalMatricule = parseInt(tu.badge_id, 10) > 0 && parseInt(tu.badge_id, 10) < 1000000 ? parseInt(tu.badge_id, 10) : null;
        
        rh.badge_id = finalBadge;
        if (finalMatricule) rh.matricule = finalMatricule;
        await rh.save();

        tu.type = 'Incube';
        await tu.save();

        linkedRhCount++;
        linkedRhDetails.push({
          rhId: rh.id,
          nom: rh.nom_complet,
          startup: rh.incube?.raison_sociale || rh.incube?.nom_incube || 'Startup',
          badge: finalBadge,
          matricule: finalMatricule
        });
      }
    }
  }

  // Matching pour les Associés
  let linkedAssocCount = 0;
  const linkedAssocDetails = [];

  for (const inc of incubes) {
    if (Array.isArray(inc.associes) && inc.associes.length > 0) {
      let changed = false;
      const updatedAssocies = inc.associes.map(a => {
        if (!a.badge_id || String(a.badge_id).trim() === '') {
          const tu = tUsers.find(t => matchesPersonName(a.nom, t.name));
          if (tu) {
            const finalBadge = (tu.cardno && tu.cardno !== '0') ? String(tu.cardno) : String(tu.badge_id);
            const finalMatricule = parseInt(tu.badge_id, 10) > 0 && parseInt(tu.badge_id, 10) < 1000000 ? parseInt(tu.badge_id, 10) : null;
            changed = true;
            linkedAssocCount++;
            tu.type = 'Incube';
            tu.save().catch(() => {});
            linkedAssocDetails.push({
              nom: a.nom,
              startup: inc.raison_sociale || inc.nom_incube,
              badge: finalBadge,
              matricule: finalMatricule
            });
            return {
              ...a,
              badge_id: finalBadge,
              matricule: finalMatricule
            };
          }
        }
        return a;
      });

      if (changed) {
        inc.associes = updatedAssocies;
        await inc.save();
      }
    }
  }

  return {
    success: true,
    totalLinked: linkedRhCount + linkedAssocCount,
    linkedRhCount,
    linkedRhDetails,
    linkedAssocCount,
    linkedAssocDetails
  };
}

module.exports = {
  fetchFromAllDevices,
  findBadgeForIncube,
  processScansToMonthlyHours,
  calculateEngagementMetrics,
  syncIncubeTourniquet,
  getLivePresence,
  getActivityByType,
  encodeUser72,
  getNextAvailableMatricule,
  getOrCreateMatriculeForBadge,
  checkBadgeRfidUniqueness,
  verifyBadgeStatus,
  autoLinkExistingTourniquetBadges,
  broadcastUserToTurnstiles,
  resyncAllBadgeHoldersToTurnstiles,
  MOIS_NOMS
};
