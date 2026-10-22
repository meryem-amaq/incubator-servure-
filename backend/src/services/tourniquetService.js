const ZKLib = require('node-zklib');
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
const ZKT_TIMEOUT = 2500; // 2.5s timeout per socket

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

/**
 * Connexion sécurisée à un tourniquet avec timeout
 */
async function connectToDevice(ip) {
  const zk = new ZKLib(ip, ZKT_PORT, ZKT_TIMEOUT, 4000);
  await zk.createSocket();
  return zk;
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
function calculateEngagementMetrics(monthlyHours) {
  const OBJECTIF_HEBDO = 15; // 15h / semaine
  const OBJECTIF_MOIS = 60;  // 60h / mois
  const OBJECTIF_ANNEE = 720; // 720h / an

  let totalHeures = 0;
  let countMoisAvecHeures = 0;
  const statutsParMois = {};

  MOIS_NOMS.forEach(m => {
    const h = monthlyHours[m] || 0;
    if (h > 0) {
      totalHeures += h;
      countMoisAvecHeures++;
    }

    // Taux mois
    const tauxMois = Math.round((h / OBJECTIF_MOIS) * 100);
    let statut = 'NON CONFORME';
    let statutColor = 'red';

    if (tauxMois >= 100) {
      statut = 'CONFORME';
      statutColor = 'emerald';
    } else if (tauxMois >= 75) {
      statut = 'ATTENTION';
      statutColor = 'amber';
    }

    statutsParMois[m] = {
      heures: h,
      tauxMois,
      statut,
      statutColor
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

  // 3. Récupérer les pointages en BDD
  const whereClause = {
    [Op.or]: []
  };

  if (badgeId) {
    whereClause[Op.or].push({ raw_badge_id: badgeId });
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
  const metrics = calculateEngagementMetrics(monthlyHours);

  // 5. Mettre à jour la table suivi_engagement pour chaque mois de façon optimisée (1 seule requête de lecture)
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
      if (engagementRow.moyenne_heures_presence !== heures) {
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

  return {
    incube: {
      id: incube.id,
      nom_incube: incube.nom_incube,
      badge_id: badgeId || null
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

      // 1. Chercher dans Incube
      const incMatch = incubes.find(i => String(i.badge_id) === badgeId);
      if (incMatch) {
        nom = incMatch.nom_incube;
        type = 'Incube';
        email = incMatch.email;
        incubeId = incMatch.id;
      } else {
        // 2. Chercher dans User
        const uMatch = users.find(u => String(u.badge_id) === badgeId || (lastScan.user_id && u.id === lastScan.user_id));
        if (uMatch) {
          nom = uMatch.nom;
          prenom = uMatch.prenom;
          type = uMatch.type || (uMatch.role === 'incube' ? 'Incube' : 'Administration');
          email = uMatch.email;
        } else {
          // 3. Chercher dans TourniquetUser
          const tuMatch = tourniquetUsers.find(tu => String(tu.badge_id) === badgeId);
          if (tuMatch) {
            nom = tuMatch.name;
            prenom = '';
            type = tuMatch.type || 'Visiteur';
          }
        }
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

module.exports = {
  fetchFromAllDevices,
  findBadgeForIncube,
  processScansToMonthlyHours,
  calculateEngagementMetrics,
  syncIncubeTourniquet,
  getLivePresence,
  getActivityByType,
  MOIS_NOMS
};
