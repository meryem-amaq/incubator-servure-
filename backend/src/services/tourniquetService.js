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
  const daysMap = new Map(); // 'YYYY-MM-DD' -> [{ timeMs, type }]

  for (const s of debounced) {
    const d = new Date(s.time);
    if (d.getFullYear() === Number(targetYear)) {
      const dayKey = d.toISOString().split('T')[0];
      if (!daysMap.has(dayKey)) {
        daysMap.set(dayKey, []);
      }
      daysMap.get(dayKey).push({
        timeMs: d.getTime(),
        type: s.type ? String(s.type).toUpperCase() : null
      });
    }
  }

  let grandTotalSeconds = 0;
  let totalDaysPresent = daysMap.size;

  // 2. Traitement journalier par appairage Entrée / Sortie
  for (const [dayKey, dayScans] of daysMap.entries()) {
    dayScans.sort((a, b) => a.timeMs - b.timeMs);
    let daySeconds = 0;
    const n = dayScans.length;
    const hasExplicitIn = dayScans.some(x => x.type === 'IN');
    const hasExplicitOut = dayScans.some(x => x.type === 'OUT');

    if (hasExplicitIn && !hasExplicitOut) {
      // L'incubé a badgé une ou plusieurs fois en Entrée (IN) mais n'a JAMAIS pointé sa Sortie (OUT) de la journée :
      // Appliquer strictement le forfait de 2 heures (7200 secondes)
      daySeconds = 7200;
    } else if (hasExplicitIn && hasExplicitOut) {
      // Appairage directionnel intelligent basé sur le sens certifié des tourniquets (IN -> OUT)
      let openInTime = null;
      let forfaitAppliedForDay = false;

      for (const sc of dayScans) {
        if (sc.type === 'IN') {
          if (openInTime === null) {
            openInTime = sc.timeMs;
          } else {
            // Deuxième entrée IN sans sortie OUT intermédiaire :
            // Si l'écart est >= 2h (ex: sorti à midi sans badger OUT, puis revenu l'après-midi),
            // appliquer le forfait de 2h sur la 1ère entrée non clôturée (1 seule fois max par jour)
            if ((sc.timeMs - openInTime) >= 7200 * 1000 && !forfaitAppliedForDay) {
              daySeconds += 7200;
              forfaitAppliedForDay = true;
              openInTime = sc.timeMs;
            }
          }
        } else if (sc.type === 'OUT') {
          if (openInTime !== null) {
            const diffSec = Math.max(0, (sc.timeMs - openInTime) / 1000);
            daySeconds += Math.min(diffSec, 50400); // Plafond 14h
            openInTime = null;
          }
        }
      }

      // Fin de journée : si la dernière entrée (IN) n'a pas de badgeage de sortie (OUT), appliquer le forfait de 2h (7200s)
      if (openInTime !== null && !forfaitAppliedForDay) {
        daySeconds += 7200;
      }
    } else {
      // Fallback par parité (scans sans type explicite ou archives historiques)
      for (let i = 0; i < n - 1; i += 2) {
        const entryTime = dayScans[i].timeMs;
        const exitTime = dayScans[i + 1].timeMs;
        const diffSec = Math.max(0, (exitTime - entryTime) / 1000);
        const cappedSec = Math.min(diffSec, 50400);
        daySeconds += cappedSec;
      }

      // En cas de scan impair (entrée sans badgeage de sortie), appliquer un forfait de 2 heures (7200 secondes)
      if (n % 2 !== 0) {
        daySeconds += 7200; // 2 heures
      }
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
 * Synchronise les pointages pour une startup (Porteur + Associés + Salariés RH)
 * et met à jour suivi_engagement avec les heures cumulées de toute l'équipe startup.
 */
async function syncIncubeTourniquet(incubeId, annee = new Date().getFullYear()) {
  const { RhDetail } = require('../models');
  const incube = await Incube.findByPk(incubeId);
  if (!incube) {
    throw new Error(`Incubé #${incubeId} introuvable`);
  }

  // 1. Déclencher une collecte en arrière-plan (non-bloquante pour la réponse HTTP)
  try {
    const { collectFromAllDevices } = require('./tourniquetCollector');
    collectFromAllDevices().catch(() => {});
  } catch (e) {}

  // 2. Identifier tous les membres de l'équipe Startup (Porteur + Associés + Salariés RH)
  const badgeId = await findBadgeForIncube(incube);
  const porteurBadge = normalizeBadgeId(badgeId);
  const porteurMat = incube.matricule ? String(incube.matricule).trim() : null;

  const teamMembers = [];
  const usedIds = new Set();

  // 2a. Porteur principal
  const porteurKeys = new Set();
  if (porteurBadge) { porteurKeys.add(porteurBadge); usedIds.add(porteurBadge); }
  if (porteurMat) { porteurKeys.add(porteurMat); usedIds.add(porteurMat); }

  teamMembers.push({
    key: `porteur_${incube.id}`,
    nom: incube.nom_incube,
    role: 'Porteur de Projet',
    type: 'porteur',
    badge_id: porteurBadge || null,
    matricule: porteurMat || null,
    user_id: incube.user_id || null,
    matchBadges: porteurKeys
  });

  // 2b. Associés de la startup (incube.associes)
  let associesList = incube.associes;
  if (typeof associesList === 'string') {
    try { associesList = JSON.parse(associesList); } catch { associesList = []; }
  }
  if (Array.isArray(associesList)) {
    associesList.forEach((a, idx) => {
      if (!a || !a.nom) return;
      const aBadge = normalizeBadgeId(a.badge_id);
      const aMat = a.matricule ? String(a.matricule).trim() : null;
      const aKeys = new Set();
      if (aBadge && !usedIds.has(aBadge)) { aKeys.add(aBadge); usedIds.add(aBadge); }
      if (aMat && !usedIds.has(aMat)) { aKeys.add(aMat); usedIds.add(aMat); }
      teamMembers.push({
        key: `associe_${idx}_${a.nom}`,
        nom: a.nom,
        role: a.fonction || 'Associé',
        type: 'associe',
        badge_id: aBadge || null,
        matricule: aMat || null,
        user_id: null,
        matchBadges: aKeys
      });
    });
  }

  // 2c. Salariés & Stagiaires RH de la startup (rh_detail)
  const rhList = await RhDetail.findAll({ where: { incube_id: incube.id } });
  rhList.forEach(rh => {
    // Éviter de compter deux fois le porteur s'il figure aussi dans rh_detail
    if (matchesPersonName(rh.nom_complet, incube.nom_incube)) return;
    const rBadge = normalizeBadgeId(rh.badge_id);
    const rMat = rh.matricule ? String(rh.matricule).trim() : null;
    const rKeys = new Set();
    if (rBadge && !usedIds.has(rBadge)) { rKeys.add(rBadge); usedIds.add(rBadge); }
    if (rMat && !usedIds.has(rMat)) { rKeys.add(rMat); usedIds.add(rMat); }
    teamMembers.push({
      key: `rh_${rh.id}`,
      nom: rh.nom_complet,
      role: rh.poste || rh.type_personnel || 'Salarié',
      type: 'salarie',
      badge_id: rBadge || null,
      matricule: rMat || null,
      user_id: null,
      matchBadges: rKeys
    });
  });

  // 2d. Enrichir chaque membre avec la correspondance bidirectionnelle dans tourniquet_users (matricule <-> cardno RFID + nom)
  const allTu = await TourniquetUser.findAll({ raw: true });
  for (const member of teamMembers) {
    const matchedTus = allTu.filter(tu => {
      const tuB = normalizeBadgeId(tu.badge_id);
      const tuC = normalizeBadgeId(tu.cardno);
      if ((tuB && member.matchBadges.has(tuB)) || (tuC && member.matchBadges.has(tuC))) {
        return true;
      }
      if (member.nom && tu.name && matchesPersonName(tu.name, member.nom)) {
        return true;
      }
      return false;
    });
    for (const tu of matchedTus) {
      const tuB = normalizeBadgeId(tu.badge_id);
      const tuC = normalizeBadgeId(tu.cardno);
      if (tuB && !usedIds.has(tuB)) {
        member.matchBadges.add(tuB);
        usedIds.add(tuB);
        if (!member.matricule) member.matricule = tuB;
      }
      if (tuC && !usedIds.has(tuC)) {
        member.matchBadges.add(tuC);
        usedIds.add(tuC);
        if (!member.badge_id) member.badge_id = tuC;
      }
    }
  }

  const hasPorteurBadge = Boolean(teamMembers[0]?.matchBadges?.size > 0);
  const hasBadge = teamMembers.some(m => m.matchBadges.size > 0);

  // 3. Récupérer en une seule requête tous les pointages de toute l'équipe Startup
  const allBadgeIdentifiers = Array.from(usedIds);
  const whereClause = { [Op.or]: [] };
  if (allBadgeIdentifiers.length > 0) {
    whereClause[Op.or].push({ raw_badge_id: { [Op.in]: allBadgeIdentifiers } });
  }
  if (incube.user_id) {
    whereClause[Op.or].push({ user_id: incube.user_id });
  }

  let allScans = [];
  if (whereClause[Op.or].length > 0) {
    allScans = await Attendance.findAll({
      where: whereClause,
      order: [['time', 'ASC']]
    });
  }

  // 4. Calculer les heures individuellement par membre (pour un appairage Entrée/Sortie exact par personne)
  //    puis additionner les heures pour l'équipe globale et par catégorie
  const equipeMonthlyHours = {};
  const porteurMonthlyHours = {};
  const associesMonthlyHours = {};
  const salariesMonthlyHours = {};
  MOIS_NOMS.forEach(m => {
    equipeMonthlyHours[m] = 0;
    porteurMonthlyHours[m] = 0;
    associesMonthlyHours[m] = 0;
    salariesMonthlyHours[m] = 0;
  });

  const allTeamDaysSet = new Set();
  let equipeTotalValidScans = 0;
  const teamBreakdown = [];

  for (const member of teamMembers) {
    const memberScans = allScans.filter(s => {
      const rb = normalizeBadgeId(s.raw_badge_id);
      if (rb && member.matchBadges.has(rb)) return true;
      if (member.user_id && s.user_id === member.user_id) return true;
      return false;
    });

    const memberRes = processScansToMonthlyHours(memberScans, annee);
    equipeTotalValidScans += memberRes.totalValidScans;

    // Collecter les jours distincts de présence de l'équipe sur l'année
    for (const s of memberScans) {
      const d = new Date(s.time);
      if (d.getFullYear() === Number(annee)) {
        allTeamDaysSet.add(d.toISOString().split('T')[0]);
      }
    }

    MOIS_NOMS.forEach(m => {
      const h = memberRes.monthlyHours[m] || 0;
      equipeMonthlyHours[m] = Math.round((equipeMonthlyHours[m] + h) * 10) / 10;
      if (member.type === 'porteur') {
        porteurMonthlyHours[m] = Math.round((porteurMonthlyHours[m] + h) * 10) / 10;
      } else if (member.type === 'associe') {
        associesMonthlyHours[m] = Math.round((associesMonthlyHours[m] + h) * 10) / 10;
      } else if (member.type === 'salarie') {
        salariesMonthlyHours[m] = Math.round((salariesMonthlyHours[m] + h) * 10) / 10;
      }
    });

    teamBreakdown.push({
      name: member.nom,
      nom: member.nom,
      role: member.role,
      type: member.type,
      badge_id: member.badge_id,
      matricule: member.matricule,
      hasBadge: member.matchBadges.size > 0,
      totalHours: memberRes.totalHours,
      daysPresent: memberRes.daysPresent,
      totalValidScans: memberRes.totalValidScans,
      monthlyHours: memberRes.monthlyHours
    });
  }

  const monthlyHours = equipeMonthlyHours;
  const daysPresent = allTeamDaysSet.size;
  const totalValidScans = equipeTotalValidScans;
  const totalHeuresPorteur = Math.round(Object.values(porteurMonthlyHours).reduce((a, b) => a + b, 0) * 10) / 10;
  const totalHeuresAssocies = Math.round(Object.values(associesMonthlyHours).reduce((a, b) => a + b, 0) * 10) / 10;
  const totalHeuresSalaries = Math.round(Object.values(salariesMonthlyHours).reduce((a, b) => a + b, 0) * 10) / 10;
  const baseMetrics = calculateEngagementMetrics(equipeMonthlyHours, { hasBadge, annee });
  const metrics = {
    ...baseMetrics,
    totalHeuresPorteur,
    totalHeuresAssocies,
    totalHeuresSalaries
  };
  const porteurMetrics = calculateEngagementMetrics(porteurMonthlyHours, { hasBadge: hasPorteurBadge, annee });
  const teamBadgeCount = teamBreakdown.filter(m => m.hasBadge).length;

  // 5. Mettre à jour la table suivi_engagement avec les heures cumulées de l'équipe Startup
  if (allScans.length > 0) {
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
      raison_sociale: incube.raison_sociale,
      badge_id: badgeId || null,
      matricule: incube.matricule || null,
      hasBadge,
      teamMembersCount: teamBreakdown.length,
      teamBadgeCount
    },
    annee: Number(annee),
    monthlyHours: equipeMonthlyHours,
    equipeMonthlyHours,
    porteurMonthlyHours,
    associesMonthlyHours,
    salariesMonthlyHours,
    metrics,
    porteurMetrics,
    teamBreakdown,
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

    // Vérifier si le dernier mouvement est une entrée (IN) sans sortie ultérieure
    const lastScan = filtered[filtered.length - 1];
    const isInside = lastScan && lastScan.type
      ? String(lastScan.type).toUpperCase() === 'IN'
      : (filtered.length % 2 !== 0);

    if (isInside && lastScan) {
      
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
 * Normalise un numéro de badge RFID en supprimant les espaces et les zéros initiaux (ex: '0005510520' -> '5510520')
 */
function normalizeBadgeId(badgeId) {
  if (!badgeId) return '';
  const str = String(badgeId).trim();
  if (/^\d+$/.test(str)) {
    return str.replace(/^0+(?=\d)/, '');
  }
  return str;
}

const ADMIN_KNOWN_MATRICULES = {
  'incubateur.digital.solidaire@gmail.com': { matricule: 145, cardno: '7600900', nom: 'Incubateur Digital Solidaire' },
  'nadia.sefiani@ctpes.ma': { matricule: 6, cardno: '6', nom: 'Nadia SEFIANI' },
  'mustapha@ctpes.ma': { matricule: 3, cardno: '3', nom: 'Mustapha' },
  'ayoub.elbouchikhi@ctpes.ma': { matricule: 143, cardno: '7587580', nom: 'Ayoub EL BOUCHIKHI' },
  'ilham.lahboub@ctpes.ma': { matricule: 194, cardno: '7561307', nom: 'Ilham LAHBOUB' },
  'hicham.belaaziz@ctpes.ma': { matricule: 227, cardno: '6883058', nom: 'Hicham BELAAZIZ' },
  'kawtar@ctpes.ma': { matricule: 144, cardno: '7568112', nom: 'Kawtar SBAI' },
  'charaf@ctpes.ma': { matricule: 205, cardno: '7586646', nom: 'Charaf EL AMRANI' },
  'aminemezzyane@gmail.com': { matricule: 142, cardno: '6895052', nom: 'Amine MEZZYANE' },
  'incubateur.digital.solidaire@gmail.com': { matricule: 145, cardno: '7600900', nom: 'Test AMA' }
};

/**
 * Calculer le prochain numéro de matricule libre sans JAMAIS entrer en collision avec les bornes
 */
async function getNextAvailableMatricule() {
  const { sequelize, Incube, RhDetail, TourniquetUser } = require('../models');
  const [incubes, rhs, tus] = await Promise.all([
    Incube.findAll({ attributes: ['matricule', 'associes'], raw: true }),
    RhDetail.findAll({ attributes: ['matricule'], raw: true }),
    TourniquetUser.findAll({ attributes: ['badge_id'], raw: true })
  ]);

  const usedSet = new Set([1, 3, 6, 100, 142, 143, 144, 145, 194, 205, 227]);
  let maxUsed = 253; // Plancher de sécurité correspondant aux usagers physiques existants (#1 à #253)

  const registerNum = (val) => {
    const n = parseInt(val, 10);
    if (!isNaN(n) && n > 0 && n < 5000) {
      usedSet.add(n);
      if (n > maxUsed) maxUsed = n;
    }
  };

  for (const inc of incubes) {
    registerNum(inc.matricule);
    let assoc = inc.associes;
    if (typeof assoc === 'string') { try { assoc = JSON.parse(assoc); } catch {} }
    if (Array.isArray(assoc)) {
      assoc.forEach(a => registerNum(a?.matricule));
    }
  }
  for (const r of rhs) {
    registerNum(r.matricule);
  }
  for (const t of tus) {
    registerNum(t.badge_id);
  }

  let candidate = maxUsed + 1;
  while (usedSet.has(candidate)) {
    candidate++;
  }
  return candidate;
}

/**
 * Vérifier l'unicité d'un badge RFID à travers toute la base de données (insensible aux zéros initiaux)
 */
async function checkBadgeRfidUniqueness(badgeId, options = {}) {
  const cleanBadge = normalizeBadgeId(badgeId);
  if (!cleanBadge) return { isUnique: true };

  const { excludeIncubeId = null, excludeRhId = null, excludeUserId = null } = options;
  const { Incube, RhDetail, User } = require('../models');

  // 1. incubes
  const allIncubes = await Incube.findAll();
  for (const inc of allIncubes) {
    if (excludeIncubeId && Number(inc.id) === Number(excludeIncubeId)) continue;
    if (normalizeBadgeId(inc.badge_id) === cleanBadge) {
      return {
        isUnique: false,
        conflictType: 'Porteur de Projet (Startup)',
        conflictName: inc.nom_incube,
        conflictEntity: inc.raison_sociale || 'Startup'
      };
    }
  }

  // 2. rh_detail
  const allRhs = await RhDetail.findAll({
    include: [{ model: Incube, as: 'incube', attributes: ['id', 'nom_incube', 'raison_sociale'] }]
  });
  for (const rh of allRhs) {
    if (excludeRhId && Number(rh.id) === Number(excludeRhId)) continue;
    if (normalizeBadgeId(rh.badge_id) === cleanBadge) {
      return {
        isUnique: false,
        conflictType: 'Salarié Staff Startup',
        conflictName: rh.nom_complet,
        conflictEntity: rh.incube?.raison_sociale || 'Startup'
      };
    }
  }

  // 2.5 associés des incubés
  for (const inc of allIncubes) {
    if (excludeIncubeId && Number(inc.id) === Number(excludeIncubeId)) continue;
    if (Array.isArray(inc.associes)) {
      const matchedAssoc = inc.associes.find(a => normalizeBadgeId(a?.badge_id) === cleanBadge);
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
  const allUsers = await User.findAll();
  for (const u of allUsers) {
    if (excludeUserId && Number(u.id) === Number(excludeUserId)) continue;
    if (normalizeBadgeId(u.badge_id) === cleanBadge) {
      return {
        isUnique: false,
        conflictType: 'Utilisateur Plateforme',
        conflictName: `${u.prenom} ${u.nom}`,
        conflictEntity: u.role
      };
    }
  }

  return { isUnique: true };
}

/**
 * Diffusion instantanée d'un utilisateur vers les 7 Tourniquets F18
 */
async function broadcastUserToTurnstiles({ matricule, name, cardno, role = 0, type = 'Incube' }) {
  const ips = getDeviceIps();
  const uid = parseInt(matricule, 10) || 1;
  const userId = String(uid);
  const cleanCard = normalizeBadgeId(cardno);
  const cardInt = parseInt(cleanCard, 10) || 0;
  const cleanName = String(name || '').trim().slice(0, 24);

  const results = {
    matricule: uid,
    name: cleanName,
    cardno: cardInt,
    totalDevices: ips.length,
    successfulDevices: [],
    failedDevices: []
  };

  // 1. Mettre à jour le cache MySQL TourniquetUser (1 seule ligne canonique par usager, sans doublon)
  try {
    const { TourniquetUser } = require('../models');
    await TourniquetUser.upsert({
      badge_id: String(uid),
      name: cleanName,
      cardno: cardInt > 0 ? String(cardInt) : null,
      type: type || 'Incube',
      device_ip: ips[0]
    });
    // Supprimer tout ancien doublon indexé par numéro de carte brut
    if (cardInt > 0 && String(cardInt) !== String(uid)) {
      await TourniquetUser.destroy({ where: { badge_id: String(cardInt) } });
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
 * vers les 7 Tourniquets F18 sans jamais écraser les matricules existants.
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
      inc.badge_id = normalizeBadgeId(inc.badge_id);
      if (!inc.matricule) {
        inc.matricule = await getOrCreateMatriculeForBadge(inc.badge_id, inc.nom_incube);
      }
      await inc.save();
      allToSync.push({
        matricule: inc.matricule,
        name: inc.nom_incube,
        cardno: inc.badge_id,
        type: 'Incube'
      });
    }

    // Inclure les associés de la startup (chacun avec son PROPRE matricule distinct !)
    if (Array.isArray(inc.associes)) {
      let assocChanged = false;
      const updatedAssocies = [];
      for (const a of inc.associes) {
        if (a && a.badge_id) {
          const cleanABadge = normalizeBadgeId(a.badge_id);
          let aMat = a.matricule;
          if (!aMat || aMat === inc.matricule) {
            aMat = await getOrCreateMatriculeForBadge(cleanABadge, a.nom);
            assocChanged = true;
          }
          updatedAssocies.push({ ...a, badge_id: cleanABadge, matricule: aMat });
          allToSync.push({
            matricule: aMat,
            name: a.nom,
            cardno: cleanABadge,
            type: 'Incube'
          });
        } else {
          updatedAssocies.push(a);
        }
      }
      if (assocChanged) {
        inc.associes = updatedAssocies;
        await inc.save();
      }
    }
  }

  for (const s of staff) {
    s.badge_id = normalizeBadgeId(s.badge_id);
    if (!s.matricule) {
      s.matricule = await getOrCreateMatriculeForBadge(s.badge_id, s.nom_complet);
    }
    await s.save();
    allToSync.push({
      matricule: s.matricule,
      name: s.nom_complet,
      cardno: s.badge_id,
      type: 'Incube'
    });
  }

  for (const u of users) {
    const emailKey = (u.email || '').trim().toLowerCase();
    const knownAdmin = ADMIN_KNOWN_MATRICULES[emailKey];
    if (knownAdmin) {
      allToSync.push({
        matricule: knownAdmin.matricule,
        name: knownAdmin.nom,
        cardno: knownAdmin.cardno,
        type: 'Administration'
      });
    }
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
 * ou calcule le prochain matricule disponible pour éviter TOUTE COLLISION D'ID !
 * Règle d'or : Les tourniquets physiques sont la source de vérité pour les matricules existants.
 */
async function getOrCreateMatriculeForBadge(badgeId, personName = '', existingMatricule = null) {
  const cleanBadge = normalizeBadgeId(badgeId);
  if (!cleanBadge) {
    // Si aucun badge n'est fourni, ne pas inventer de matricule
    return existingMatricule ? parseInt(existingMatricule, 10) : null;
  }

  const { TourniquetUser, Incube, RhDetail } = require('../models');

  const [allIncubes, allRhs, allTu] = await Promise.all([
    Incube.findAll({ raw: true }),
    RhDetail.findAll({ raw: true }),
    TourniquetUser.findAll({ raw: true })
  ]);

  // 1. PRIORITÉ ABSOLUE : Vérifier si ce numéro de carte RFID existe déjà physiquement sur les tourniquets (TourniquetUser)
  //    Ex: Badge 12962429 sur les bornes -> Matricule physique 141 (Meryem AMAQRAN)
  const tuByCard = allTu.find(t =>
    normalizeBadgeId(t.cardno) === cleanBadge &&
    parseInt(t.badge_id, 10) > 0 &&
    parseInt(t.badge_id, 10) < 5000
  );
  if (tuByCard) {
    return parseInt(tuByCard.badge_id, 10);
  }

  // 2. Si le nom de la personne correspond exactement à un usager déjà enregistré sur les tourniquets
  if (personName && personName.trim()) {
    const tuMatch = allTu.find(t => {
      const m = parseInt(t.badge_id, 10);
      if (!(m > 0 && m < 5000)) return false;
      if (t.cardno && normalizeBadgeId(t.cardno) !== cleanBadge) return false;
      return matchesPersonName(personName, t.name);
    });
    if (tuMatch) {
      return parseInt(tuMatch.badge_id, 10);
    }
  }

  // 3. Vérifier si ce badge est déjà associé à un incubé, un associé ou un salarié en base
  for (const inc of allIncubes) {
    if (inc.matricule && normalizeBadgeId(inc.badge_id) === cleanBadge) {
      return parseInt(inc.matricule, 10);
    }
    let assoc = inc.associes;
    if (typeof assoc === 'string') { try { assoc = JSON.parse(assoc); } catch {} }
    if (Array.isArray(assoc)) {
      for (const a of assoc) {
        if (a?.matricule && normalizeBadgeId(a.badge_id) === cleanBadge) {
          return parseInt(a.matricule, 10);
        }
      }
    }
  }

  for (const rh of allRhs) {
    if (rh.matricule && normalizeBadgeId(rh.badge_id) === cleanBadge) {
      return parseInt(rh.matricule, 10);
    }
  }

  // 4. Si un matricule existant valide était déjà rattaché et n'entre pas en conflit
  if (existingMatricule && parseInt(existingMatricule, 10) > 0) {
    return parseInt(existingMatricule, 10);
  }

  // 5. Sinon, il s'agit d'un badge véritablement nouveau : allouer le prochain matricule libre après le dernier emplacement des bornes (> 253)
  return await getNextAvailableMatricule();
}

/**
 * Vérification complète et approfondie de l'état d'un badge RFID
 */
async function verifyBadgeStatus(badgeId) {
  const cleanBadge = normalizeBadgeId(badgeId);
  if (!cleanBadge) {
    return { valid: false, message: 'Numéro de badge manquant' };
  }
  const { Incube, RhDetail, User, TourniquetUser } = require('../models');

  let assignedTo = null;

  // 1. Vérifier si c'est un Administrateur certifié
  const ADMIN_KNOWN_BADGES = {
    '145': { nom: 'Incubateur Digital Solidaire', email: 'incubateur.digital.solidaire@gmail.com' },
    '7600900': { nom: 'Incubateur Digital Solidaire', email: 'incubateur.digital.solidaire@gmail.com' },
    '6': { nom: 'Nadia SEFIANI', email: 'nadia.sefiani@ctpes.ma' },
    '3': { nom: 'Mustapha', email: 'mustapha@ctpes.ma' },
    '143': { nom: 'Ayoub EL BOUCHIKHI', email: 'ayoub.elbouchikhi@ctpes.ma' },
    '7587580': { nom: 'Ayoub EL BOUCHIKHI', email: 'ayoub.elbouchikhi@ctpes.ma' },
    '194': { nom: 'Ilham LAHBOUB', email: 'ilham.lahboub@ctpes.ma' },
    '7561307': { nom: 'Ilham LAHBOUB', email: 'ilham.lahboub@ctpes.ma' },
    '227': { nom: 'Hicham BELAAZIZ', email: 'hicham.belaaziz@ctpes.ma' },
    '6883058': { nom: 'Hicham BELAAZIZ', email: 'hicham.belaaziz@ctpes.ma' },
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
 * aux salariés RH et aux associés des incubés (sans jamais dupliquer le badge d'un Porteur de Projet).
 */
async function autoLinkExistingTourniquetBadges() {
  const { RhDetail, TourniquetUser, Incube } = require('../models');

  const rhList = await RhDetail.findAll({
    include: [{ model: Incube, as: 'incube', attributes: ['id', 'nom_incube', 'raison_sociale'] }]
  });
  const tUsers = await TourniquetUser.findAll();
  const incubes = await Incube.findAll();

  const porteurBadges = new Set();
  const porteurMatricules = new Set();
  for (const inc of incubes) {
    if (inc.badge_id) porteurBadges.add(normalizeBadgeId(inc.badge_id));
    if (inc.matricule) porteurMatricules.add(parseInt(inc.matricule, 10));
  }

  let linkedRhCount = 0;
  const linkedRhDetails = [];

  for (const rh of rhList) {
    // Si ce salarié a le même nom que le Porteur de Projet de sa propre startup, ignorer (son badge est déjà sur le profil Porteur)
    if (rh.incube && matchesPersonName(rh.nom_complet, rh.incube.nom_incube)) {
      continue;
    }

    if (!rh.badge_id || String(rh.badge_id).trim() === '') {
      const tu = tUsers.find(t => {
        const m = parseInt(t.badge_id, 10);
        if (!(m > 0 && m < 5000)) return false;
        const c = normalizeBadgeId(t.cardno || t.badge_id);
        if (porteurBadges.has(c) || porteurMatricules.has(m)) return false;
        return matchesPersonName(rh.nom_complet, t.name);
      });
      if (tu) {
        const finalBadge = normalizeBadgeId((tu.cardno && tu.cardno !== '0') ? String(tu.cardno) : String(tu.badge_id));
        const finalMatricule = parseInt(tu.badge_id, 10) > 0 && parseInt(tu.badge_id, 10) < 5000 ? parseInt(tu.badge_id, 10) : null;
        
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
          const tu = tUsers.find(t => {
            const m = parseInt(t.badge_id, 10);
            if (!(m > 0 && m < 5000)) return false;
            const c = normalizeBadgeId(t.cardno || t.badge_id);
            if (porteurBadges.has(c) || porteurMatricules.has(m)) return false;
            return matchesPersonName(a.nom, t.name);
          });
          if (tu) {
            const finalBadge = normalizeBadgeId((tu.cardno && tu.cardno !== '0') ? String(tu.cardno) : String(tu.badge_id));
            const finalMatricule = parseInt(tu.badge_id, 10) > 0 && parseInt(tu.badge_id, 10) < 5000 ? parseInt(tu.badge_id, 10) : null;
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
  normalizeBadgeId,
  getNextAvailableMatricule,
  getOrCreateMatriculeForBadge,
  checkBadgeRfidUniqueness,
  verifyBadgeStatus,
  autoLinkExistingTourniquetBadges,
  broadcastUserToTurnstiles,
  resyncAllBadgeHoldersToTurnstiles,
  MOIS_NOMS
};
