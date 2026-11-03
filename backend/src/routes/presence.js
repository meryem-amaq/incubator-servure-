const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const auth = require('../middleware/auth');
const requireStaff = require('../middleware/requireStaff');
const isSuperAdmin = require('../middleware/isSuperAdmin');
const { PresenceAtelier, Incube, Atelier, User, Attendance, TourniquetUser, RhDetail, sequelize } = require('../models');
const tourniquetService = require('../services/tourniquetService');

function normalizeDateString(dateInput) {
  if (!dateInput) return new Date().toISOString().split('T')[0];
  let s = String(dateInput).trim();
  if (s.includes('T')) s = s.split('T')[0];
  if (s.includes('/')) {
    const p = s.split('/');
    if (p.length === 3) {
      return p[0].length === 4 
        ? `${p[0]}-${p[1].padStart(2, '0')}-${p[2].padStart(2, '0')}` 
        : `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
    }
  }
  if (s.includes('-')) {
    const p = s.split('-');
    if (p.length === 3 && p[0].length === 2 && p[2].length === 4) {
      return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
    }
  }
  return s;
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
    const hasMatch = sigB.some(wb => {
      if (similarity(wa, wb) >= 0.70) return true;
      if (wa.length === wb.length && wa.split('').sort().join('') === wb.split('').sort().join('')) return true;
      return false;
    });
    if (hasMatch) matchedCount++;
  }

  const minRequired = Math.min(sigA.length, sigB.length);
  if (minRequired >= 2) {
    return matchedCount >= 2;
  }
  return matchedCount >= 1 && sigA.length === 1 && sigB.length === 1;
}

// Helper : vérifie si l'atelier est actuellement ouvert pour l'émargement
function isAtelierAttendanceWindowOpen(atelier, body = {}) {
  if (!atelier) return { isOpen: true };

  if (atelier.statutOuverture === 'ouvert_force') {
    return { isOpen: true };
  }
  if (atelier.statutOuverture === 'cloture') {
    return { isOpen: false, message: 'Émargement clôturé pour cet atelier' };
  }

  const now = new Date();
  const dateStr = normalizeDateString(body.date || atelier.date);
  const heureDebutStr = body.heureDebut || atelier.heureDebut || '09:30';
  const heureFinStr = body.heureFin || atelier.heureFin || '12:30';

  const [hD, mD] = heureDebutStr.split(':').map(Number);
  const startDateTime = new Date(`${dateStr}T${String(hD || 0).padStart(2, '0')}:${String(mD || 0).padStart(2, '0')}:00`);

  const [hF, mF] = heureFinStr.split(':').map(Number);
  const endDateTime = new Date(`${dateStr}T${String(hF || 0).padStart(2, '0')}:${String(mF || 0).padStart(2, '0')}:00`);

  const timeDiffMs = startDateTime.getTime() - now.getTime();
  const isPast = now.getTime() > (endDateTime.getTime() + 2 * 60 * 60 * 1000);

  if (isPast) {
    return { isOpen: false, message: 'Émargement clos : la séance est terminée depuis plus de 2 heures' };
  }

  // Ouvert dès que l'heure de début est atteinte (avec 5 min d'avance tolérées)
  const isOpen = timeDiffMs <= 5 * 60 * 1000;
  if (!isOpen) {
    return { isOpen: false, message: 'Émargement non encore ouvert (ouvert 5 minutes avant le début)' };
  }

  return { isOpen: true };
}

// GET /api/presence/superadmin/dashboard : Tableau de bord supervision et contrôle d'accès en temps réel (Super Admin)
router.get('/superadmin/dashboard', auth, isSuperAdmin, async (req, res) => {
  try {
    const rawDate = req.query.date;
    const targetDate = normalizeDateString(rawDate) || new Date().toISOString().split('T')[0];
    const typeFilter = req.query.type || 'Tous';
    const searchFilter = (req.query.search || '').trim().toLowerCase();

    // 1. Récupérer les utilisateurs, incubés, usagers tourniquet et salariés RH pour le rapprochement
    const [users, incubes, tourniquetUsers, rhDetails] = await Promise.all([
      User.findAll({
        attributes: ['id', 'nom', 'prenom', 'email', 'type', 'badge_id', 'role', 'photo_url']
      }),
      Incube.findAll({
        attributes: ['id', 'user_id', 'nom_incube', 'email', 'badge_id', 'matricule', 'photo_path', 'raison_sociale', 'associes']
      }),
      TourniquetUser.findAll({
        attributes: ['badge_id', 'name', 'cardno', 'type']
      }),
      RhDetail.findAll({
        include: [{ model: Incube, as: 'incube', attributes: ['id', 'nom_incube', 'raison_sociale'] }]
      })
    ]);

    const cleanBadgeKey = (val) => {
      if (!val) return '';
      const s = String(val).trim();
      return /^\d+$/.test(s) ? s.replace(/^0+(?=\d)/, '') : s;
    };

    const userById = new Map(users.map(u => [u.id, u]));
    const userByBadge = new Map();
    users.forEach(u => {
      if (u.badge_id) userByBadge.set(cleanBadgeKey(u.badge_id), u);
    });

    const incubeByUserId = new Map();
    const incubeByBadge = new Map();
    const associeByBadge = new Map();
    incubes.forEach(i => {
      if (i.user_id) incubeByUserId.set(i.user_id, i);
      if (i.badge_id) incubeByBadge.set(cleanBadgeKey(i.badge_id), i);
      if (i.matricule) incubeByBadge.set(cleanBadgeKey(i.matricule), i);
      if (Array.isArray(i.associes)) {
        i.associes.forEach(a => {
          if (a && a.badge_id) associeByBadge.set(cleanBadgeKey(a.badge_id), { associe: a, incube: i });
          if (a && a.matricule) associeByBadge.set(cleanBadgeKey(a.matricule), { associe: a, incube: i });
        });
      }
    });

    const rhByBadge = new Map();
    rhDetails.forEach(rh => {
      if (rh.badge_id) rhByBadge.set(cleanBadgeKey(rh.badge_id), rh);
      if (rh.matricule) rhByBadge.set(cleanBadgeKey(rh.matricule), rh);
    });

    const tourniquetUserByBadge = new Map();
    tourniquetUsers.forEach(tu => {
      if (tu.badge_id) tourniquetUserByBadge.set(cleanBadgeKey(tu.badge_id), tu);
      if (tu.cardno) tourniquetUserByBadge.set(cleanBadgeKey(tu.cardno), tu);
    });

    // 2. Récupérer tous les scans de la date ciblée (en excluant le badge '0' anonyme)
    const cleanDate = /^\d{4}-\d{2}-\d{2}$/.test(targetDate) ? targetDate : new Date().toISOString().split('T')[0];
    const rawScans = await Attendance.findAll({
      where: sequelize.literal(`\`Attendance\`.\`time\` BETWEEN '${cleanDate} 00:00:00' AND '${cleanDate} 23:59:59' AND \`Attendance\`.\`raw_badge_id\` != '0'`),
      order: [['time', 'ASC']]
    });

    const CATEGORIES = ['Administration', 'Incube', 'Formation', 'Visiteur', 'Prestataire', 'Autre'];
    const statsCategories = {
      Administration: 0,
      Incube: 0,
      Formation: 0,
      Visiteur: 0,
      Prestataire: 0,
      Autre: 0
    };

    // Cartographie officielle des badges de l'équipe administrative (PINs bornes & cartes RFID)
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

    function resolvePerson(scan) {
      const rawBadge = cleanBadgeKey(scan.raw_badge_id);

      // 0. Vérification directe dans la cartographie des administrateurs certifiés
      const knownAdmin = ADMIN_KNOWN_BADGES[rawBadge];
      if (knownAdmin) {
        let uMatch = scan.user_id ? userById.get(scan.user_id) : null;
        if (!uMatch) uMatch = users.find(usr => (usr.email || '').toLowerCase() === knownAdmin.email.toLowerCase());
        return {
          personKey: `admin_${knownAdmin.email.toLowerCase()}`,
          name: knownAdmin.nom,
          category: 'Administration',
          email: knownAdmin.email,
          subtitle: knownAdmin.email,
          photo: uMatch ? uMatch.photo_url : null,
          userId: uMatch ? uMatch.id : null,
          badgeId: scan.raw_badge_id
        };
      }

      // 1. Priorité Porteur de Projet (Incubé) par badge_id ou matricule direct
      const directInc = rawBadge ? incubeByBadge.get(rawBadge) : null;
      if (directInc) {
        const u = directInc.user_id ? userById.get(directInc.user_id) : null;
        return {
          personKey: `incube_${directInc.id}`,
          name: directInc.nom_incube,
          category: 'Incube',
          email: directInc.email || u?.email || null,
          subtitle: directInc.email || (directInc.raison_sociale ? `Porteur • ${directInc.raison_sociale}` : null),
          photo: directInc.photo_path || u?.photo_url || null,
          userId: directInc.user_id || null,
          badgeId: scan.raw_badge_id
        };
      }

      // 1.1 Vérification directe dans les associés des startups (Incubés)
      const matchedAssoc = rawBadge ? associeByBadge.get(rawBadge) : null;
      if (matchedAssoc) {
        const startupName = matchedAssoc.incube.raison_sociale || matchedAssoc.incube.nom_incube || 'Startup';
        return {
          personKey: `assoc_${matchedAssoc.incube.id}_${cleanWord(matchedAssoc.associe.nom)}`,
          name: matchedAssoc.associe.nom,
          category: 'Incube',
          email: matchedAssoc.associe.email || matchedAssoc.incube.email || null,
          subtitle: matchedAssoc.associe.email || `Associé • ${startupName}`,
          photo: null,
          userId: matchedAssoc.incube.user_id || null,
          badgeId: scan.raw_badge_id
        };
      }

      // 1.2 Vérification directe dans les salariés RH / stagiaires de la startup
      const matchedRh = rawBadge ? rhByBadge.get(rawBadge) : null;
      if (matchedRh) {
        const startupName = matchedRh.incube?.raison_sociale || matchedRh.incube?.nom_incube || 'Startup';
        const roleLabel = (matchedRh.poste && matchedRh.poste.trim()) || 'Salarié';
        return {
          personKey: `rh_${matchedRh.id}`,
          name: matchedRh.nom_complet,
          category: 'Incube',
          email: matchedRh.email || null,
          subtitle: `${roleLabel} • ${startupName}`,
          photo: null,
          userId: matchedRh.incube?.user_id || null,
          badgeId: scan.raw_badge_id
        };
      }

      // 2. Recherche par user_id ou badge_id dans users
      let u = scan.user_id ? userById.get(scan.user_id) : null;
      if (!u && rawBadge) {
        u = userByBadge.get(rawBadge);
      }

      // 2.5 Recherche par user_id dans incubes
      let inc = null;
      if (scan.user_id) {
        inc = incubeByUserId.get(scan.user_id);
      }
      if (!inc && u) {
        inc = incubeByUserId.get(u.id);
      }

      // 3. Recherche dans le répertoire physique des tourniquets
      const tu = rawBadge ? tourniquetUserByBadge.get(rawBadge) : null;

      // 4. Fallback intelligent par comparaison de nom si le badge physique est enregistré avec un nom
      let rhFromTu = null;
      let assocFromTu = null;
      if (!inc && tu && tu.name) {
        inc = incubes.find(i => matchesPersonName(tu.name, i.nom_incube));
        if (!inc) {
          rhFromTu = rhDetails.find(r => matchesPersonName(tu.name, r.nom_complet));
        }
        if (!inc && !rhFromTu) {
          for (const i of incubes) {
            if (Array.isArray(i.associes)) {
              const a = i.associes.find(ass => matchesPersonName(tu.name, ass.nom));
              if (a) {
                assocFromTu = { associe: a, incube: i };
                break;
              }
            }
          }
        }
      }
      if (!inc && !u && !rhFromTu && !assocFromTu && tu && tu.name) {
        u = users.find(usr => matchesPersonName(tu.name, `${usr.prenom || ''} ${usr.nom || ''}`) || matchesPersonName(tu.name, `${usr.nom || ''} ${usr.prenom || ''}`));
        if (u && u.role === 'incube') {
          inc = incubes.find(i => i.user_id === u.id || matchesPersonName(i.nom_incube, `${u.prenom || ''} ${u.nom || ''}`));
        }
      }

      let personKey = `badge_${rawBadge || scan.id}`;
      let name = '';
      let category = 'Autre';
      let email = null;
      let subtitle = null;
      let photo = null;

      if (inc) {
        // Priorité 1 : Incubé reconnu (affiche nom_incube officiel et raison sociale)
        personKey = `incube_${inc.id}`;
        name = inc.nom_incube;
        email = inc.email || u?.email || null;
        subtitle = inc.email || (inc.raison_sociale ? `Porteur • ${inc.raison_sociale}` : null);
        photo = inc.photo_path || u?.photo_url || null;
        category = 'Incube';
      } else if (assocFromTu) {
        const startupName = assocFromTu.incube.raison_sociale || assocFromTu.incube.nom_incube || 'Startup';
        personKey = `assoc_${assocFromTu.incube.id}_${cleanWord(assocFromTu.associe.nom)}`;
        name = assocFromTu.associe.nom;
        email = assocFromTu.associe.email || null;
        subtitle = `Associé • ${startupName}`;
        category = 'Incube';
      } else if (rhFromTu) {
        const startupName = rhFromTu.incube?.raison_sociale || rhFromTu.incube?.nom_incube || 'Startup';
        personKey = `rh_${rhFromTu.id}`;
        name = rhFromTu.nom_complet;
        email = rhFromTu.email || null;
        subtitle = `${(rhFromTu.poste && rhFromTu.poste.trim()) || 'Salarié'} • ${startupName}`;
        category = 'Incube';
      } else if (u) {
        // Priorité 2 : Compte utilisateur (Administration, Staff, Consultant...)
        const staffRoles = ['super_admin', 'administrateur', 'superadmin', 'admin', 'accompagnateur', 'gestionnaire', 'consultant', 'coach'];
        const isStaff = staffRoles.includes(u.role);
        personKey = `user_${u.id}`;
        name = `${u.prenom || ''} ${u.nom || ''}`.trim() || tu?.name || 'Utilisateur';
        email = u.email;
        subtitle = u.email;
        photo = u.photo_url;
        category = isStaff ? 'Administration' : (u.type === 'Administration' ? 'Administration' : 'Incube');
      } else if (tu) {
        // Priorité 3 : Usager inscrit sur la borne tourniquet
        personKey = `tu_${cleanWord(tu.name || tu.badge_id)}`;
        name = tu.name;
        category = tu.type || 'Visiteur';
      } else {
        // Priorité 4 : Badge non identifié
        personKey = `badge_${rawBadge}`;
        name = `Visiteur (Badge #${rawBadge})`;
        category = 'Visiteur';
      }

      if (!CATEGORIES.includes(category)) {
        category = 'Autre';
      }

      return {
        personKey,
        name,
        category,
        email,
        subtitle,
        photo,
        userId: u ? u.id : (inc?.user_id || null),
        badgeId: scan.raw_badge_id
      };
    }

    // Dédoublonnage par personne (anti-rebond 60s sur la même personne toutes bornes confondues)
    const lastScanTimeByPerson = new Map();
    const scans = [];
    for (const scan of rawScans) {
      const personInfo = resolvePerson(scan);
      const t = new Date(scan.time).getTime();
      const prevT = lastScanTimeByPerson.get(personInfo.personKey) || 0;
      if (prevT > 0 && Math.abs(t - prevT) < 60000) {
        continue;
      }
      lastScanTimeByPerson.set(personInfo.personKey, t);
      scans.push({ scan, personInfo });
    }

    // Grouper par personne unique (personKey) pour déterminer le DERNIER scan de la journée sans AUCUN doublon
    const personScansMap = new Map();
    for (const { scan, personInfo } of scans) {
      const canonicalKey = personInfo.personKey;
      if (!personScansMap.has(canonicalKey)) {
        personScansMap.set(canonicalKey, { personInfo, pScans: [] });
      }
      personScansMap.get(canonicalKey).pScans.push(scan);
    }

    const statsCategoriesJournee = {
      Administration: 0,
      Incube: 0,
      Formation: 0,
      Visiteur: 0,
      Prestataire: 0,
      Autre: 0
    };
    const statsCategoriesPresents = {
      Administration: 0,
      Incube: 0,
      Formation: 0,
      Visiteur: 0,
      Prestataire: 0,
      Autre: 0
    };

    const allPresentsOnSite = [];
    for (const [key, { personInfo, pScans }] of personScansMap.entries()) {
      // Compter chaque usager unique pour la journée dans sa catégorie
      statsCategoriesJournee[personInfo.category] = (statsCategoriesJournee[personInfo.category] || 0) + 1;

      const lastScan = pScans[pScans.length - 1];
      if (lastScan.type === 'IN') {
        statsCategoriesPresents[personInfo.category] = (statsCategoriesPresents[personInfo.category] || 0) + 1;
        const d = new Date(lastScan.time);
        const heureStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' });
        allPresentsOnSite.push({
          id: lastScan.id,
          user_id: personInfo.userId,
          badge_id: lastScan.raw_badge_id,
          name: personInfo.name,
          type: personInfo.category,
          email: personInfo.email,
          subtitle: personInfo.subtitle,
          photo_url: personInfo.photo,
          derniere_entree: lastScan.time,
          heure_entree: heureStr,
          device_ip: lastScan.device_ip,
          statut: 'Sur site'
        });
      }
    }

    // Répartition des rôles avec pourcentages
    const totalUsagersJournee = personScansMap.size;
    const repartitionRoles = CATEGORIES.map(cat => {
      const count = statsCategoriesJournee[cat] || 0;
      const countPresents = statsCategoriesPresents[cat] || 0;
      const pct = totalUsagersJournee > 0 ? Math.round((count / totalUsagersJournee) * 100) : 0;
      return {
        categorie: cat,
        countJournee: count,
        countPresents,
        pourcentage: pct
      };
    }).filter(r => r.countJournee > 0);

    const totalPresentsSurSite = allPresentsOnSite.length;

    // Journal chronologique complet dédoublonné (du plus récent au plus ancien)
    const fullFlux = scans.slice().reverse().map(({ scan, personInfo }) => {
      const d = new Date(scan.time);
      return {
        id: scan.id,
        time: scan.time,
        date: targetDate,
        heure: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' }),
        badge_id: scan.raw_badge_id,
        user_id: personInfo.userId,
        name: personInfo.name,
        type: personInfo.category,
        email: personInfo.email,
        subtitle: personInfo.subtitle,
        mouvement: scan.type, // 'IN' ou 'OUT'
        device_ip: scan.device_ip
      };
    });

    // Filtres appliqués pour presents_actuellement et historique_flux
    function matchesFilter(item) {
      if (typeFilter && typeFilter !== 'Tous' && item.type !== typeFilter) return false;
      if (searchFilter) {
        const n = (item.name || '').toLowerCase();
        const b = String(item.badge_id || '').toLowerCase();
        const s = (item.subtitle || '').toLowerCase();
        const e = (item.email || '').toLowerCase();
        if (!n.includes(searchFilter) && !b.includes(searchFilter) && !s.includes(searchFilter) && !e.includes(searchFilter)) return false;
      }
      return true;
    }

    const filteredPresents = allPresentsOnSite.filter(matchesFilter);
    const filteredFlux = fullFlux.filter(matchesFilter);

    res.json({
      success: true,
      date: targetDate,
      total_presents_sur_site: totalPresentsSurSite,
      total_usagers_journee: totalUsagersJournee,
      stats_categories: statsCategoriesJournee,
      stats_presents_categories: statsCategoriesPresents,
      repartition_roles: repartitionRoles,
      presents_actuellement: filteredPresents,
      historique_flux: filteredFlux,
      all_presents: allPresentsOnSite,
      all_flux: fullFlux
    });
  } catch (err) {
    console.error('Erreur /presence/superadmin/dashboard:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du chargement du tableau de bord contrôle d\'accès',
      error: err.message
    });
  }
});

// GET /api/presence/superadmin/tourniquet-users : Liste de tous les usagers enregistrés sur les tourniquets
router.get('/superadmin/tourniquet-users', auth, isSuperAdmin, async (req, res) => {
  try {
    const list = await TourniquetUser.findAll({ order: [['badge_id', 'ASC']] });
    res.json({ success: true, count: list.length, users: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/presence/superadmin/tourniquet-users/:badge_id : Modifier la catégorie ou le nom d'un usager tourniquet
router.put('/superadmin/tourniquet-users/:badge_id', auth, isSuperAdmin, async (req, res) => {
  try {
    const { badge_id } = req.params;
    const { name, type } = req.body;
    const existing = await TourniquetUser.findByPk(badge_id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Usager tourniquet introuvable' });
    }
    await existing.update({
      name: name !== undefined ? name : existing.name,
      type: type !== undefined ? type : existing.type
    });
    res.json({ success: true, user: existing });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/presence/superadmin/import-from-tourniquets : Importer et associer les badges enregistrés dans les bornes aux incubés
router.post('/superadmin/import-from-tourniquets', auth, isSuperAdmin, async (req, res) => {
  try {
    const { importUsersFromTurnstiles } = require('../services/tourniquetCollector');
    const result = await importUsersFromTurnstiles();
    res.json({
      success: true,
      message: `${result.countUpdatedIncubes} incubés et ${result.countUpdatedStaff} membres du personnel ont été importés et reliés depuis les tourniquets physiques !`,
      result
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Erreur lors de l'importation depuis les tourniquets", error: err.message });
  }
});

// POST /api/presence/superadmin/verifier-badge : Vérifier le statut complet d'un badge RFID
router.post('/superadmin/verifier-badge', auth, isSuperAdmin, async (req, res) => {
  try {
    const { badge_id } = req.body;
    if (!badge_id) {
      return res.status(400).json({ success: false, message: 'Le numéro de badge RFID est requis.' });
    }
    const result = await tourniquetService.verifyBadgeStatus(badge_id);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('Erreur vérification badge:', err);
    return res.status(500).json({ success: false, message: err.message || 'Erreur lors de la vérification du badge' });
  }
});

// POST /api/presence/superadmin/auto-link-rh-badges : Rapprochement automatique 1-clic des badges existants aux RH et associés
router.post('/superadmin/auto-link-rh-badges', auth, isSuperAdmin, async (req, res) => {
  try {
    const result = await tourniquetService.autoLinkExistingTourniquetBadges();
    return res.json(result);
  } catch (err) {
    console.error('Erreur liaison auto badges RH:', err);
    return res.status(500).json({ success: false, message: err.message || 'Erreur lors de la liaison automatique des badges' });
  }
});

// POST /api/presence/superadmin/tourniquet-sync : Lancer la synchronisation complète avec les bornes
router.post('/superadmin/tourniquet-sync', auth, isSuperAdmin, async (req, res) => {
  try {
    const collector = require('../services/tourniquetCollector');
    const result = await collector.collectFromAllDevices();
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/presence/superadmin/sync-clocks : Synchroniser les horloges des 7 bornes sur l'heure locale exacte GMT+0
// POST /api/presence/superadmin/resync-all-names : Forcer l'écrasement de tous les anciens noms physiques sur les 7 Tourniquets F18
router.post('/superadmin/resync-all-names', auth, isSuperAdmin, async (req, res) => {
  try {
    const result = await tourniquetService.resyncAllBadgeHoldersToTurnstiles();
    res.json({
      success: true,
      message: `Tous les profils enregistrés (${result.total}) ont été ré-injectés sur les 7 Tourniquets F18 ! Les anciens noms ont été écrasés avec succès.`,
      result
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur lors de la ré-injection des noms F18', error: err.message });
  }
});

router.post('/superadmin/sync-clocks', auth, isSuperAdmin, async (req, res) => {
  try {
    const { syncAllDeviceClocks } = require('../services/tourniquetCollector');
    const result = await syncAllDeviceClocks();
    res.json({
      success: true,
      message: `Synchronisation terminée : ${result.successCount}/${result.totalDevices} bornes synchronisées sur l'heure locale GMT+0`,
      data: result
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur synchronisation horloges', error: err.message });
  }
});

// GET /api/presence/live : Retourne en temps réel toutes les personnes actuellement à l'intérieur du bâtiment
router.get('/live', auth, async (req, res) => {
  try {
    const liveData = await tourniquetService.getLivePresence();
    res.json(liveData);
  } catch (err) {
    console.error('Erreur /presence/live:', err);
    res.status(500).json({ message: 'Erreur lors de la récupération de la présence en direct', error: err.message });
  }
});

// POST /api/presence/recalibrate : Recalibration déterministe des pointages en BDD
router.post('/recalibrate', auth, isSuperAdmin, async (req, res) => {
  try {
    const { recalibrateAllAttendances } = require('../services/tourniquetCollector');
    const result = await recalibrateAllAttendances();
    res.json({
      success: true,
      message: 'Recalibration déterministe des pointages effectuée avec succès !',
      result
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur lors de la recalibration', error: err.message });
  }
});

// GET /api/presence/incubes : Liste des incubés (accessible pour l'émargement et le staff)
router.get('/incubes', async (req, res) => {
  try {
    const incubes = await Incube.findAll({
      attributes: ['id', 'nom_incube', 'pp_numero'],
      order: [['nom_incube', 'ASC']],
    });
    res.json(incubes);
  } catch (err) {
    console.error('Erreur route /presence/incubes:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/presence/enregistrer : Enregistrer ou retirer une présence en BDD
router.post('/enregistrer', async (req, res) => {
  try {
    const { atelierId, incubeId, nom, prenom, pp_numero, email, time, present, action } = req.body;
    if (!atelierId || (!incubeId && !nom && !pp_numero)) {
      return res.status(400).json({ message: 'Atelier ou identification du participant manquant' });
    }

    const aId = String(atelierId);

    // Extraction et vérification du token JWT s'il est fourni
    let authenticatedUser = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const jwt = require('jsonwebtoken');
        authenticatedUser = jwt.verify(token, process.env.JWT_SECRET);
      } catch (err) {
        // Token invalide ou expiré
      }
    }

    // Si on veut marquer comme absent (retirer la présence) : authentification administrative requise
    if (present === false || action === 'remove') {
      if (!authenticatedUser) {
        return res.status(401).json({ message: 'Authentification requise pour retirer une présence' });
      }
      const staffRoles = ['super_admin', 'superadmin', 'admin', 'administrateur', 'gestionnaire', 'consultant', 'coach', 'accompagnateur'];
      if (!staffRoles.includes(authenticatedUser.role)) {
        return res.status(403).json({ message: 'Action réservée à l\'équipe administrative' });
      }

      const destroyWhere = { atelierId: aId };
      const orClauses = [];
      if (incubeId) orClauses.push({ incubeId: String(incubeId) });
      if (email && String(email).trim()) orClauses.push({ email: String(email).trim().toLowerCase() });
      if (nom && String(nom).trim()) orClauses.push({ nom: String(nom).trim() });

      if (orClauses.length > 0) {
        destroyWhere[Op.or] = orClauses;
      }

      const deletedCount = await PresenceAtelier.destroy({
        where: destroyWhere
      });
      console.log(`❌ Présence retirée en BDD [Atelier ${aId}] : Incubé ${incubeId || nom} (${deletedCount} supprimé(s))`);
      return res.json({ success: true, message: 'Présence retirée avec succès', present: false, deletedCount });
    }

    // Validation du champ Email obligatoire pour l'émargement autonome
    const cleanEmail = email ? String(email).trim().toLowerCase() : '';
    if (!incubeId && (!cleanEmail || !cleanEmail.includes('@'))) {
      return res.status(400).json({ message: "L'adresse email est obligatoire et doit être valide pour émarger." });
    }

    // Résolution et validation de l'identité du participant côté serveur
    let iId = incubeId ? String(incubeId) : null;
    let finalPp = pp_numero ? String(pp_numero).trim().toUpperCase() : null;
    let finalNom = nom ? String(nom).trim() : '';
    let finalPrenom = prenom ? String(prenom).trim() : '';
    let finalEmail = cleanEmail || null;

    if (authenticatedUser && authenticatedUser.role === 'incube') {
      // Pour un compte incubé connecté, verrouiller strictement sur son propre profil en BDD
      if (authenticatedUser.pp_id) {
        const dbIncube = await Incube.findByPk(authenticatedUser.pp_id);
        if (dbIncube) {
          iId = String(dbIncube.id);
          finalPp = dbIncube.pp_numero;
          finalNom = dbIncube.nom_incube;
          finalPrenom = '';
          finalEmail = dbIncube.email || finalEmail;
        } else {
          iId = String(authenticatedUser.pp_id);
        }
      }
    } else {
      // Résolution serveur fiable : priorité 1 au matching par Email
      if (finalEmail) {
        const matchEmail = await Incube.findOne({ where: { email: finalEmail } });
        if (matchEmail) {
          iId = String(matchEmail.id);
          if (!finalPp || finalPp === '—') finalPp = matchEmail.pp_numero;
          if (!finalNom || finalNom === '—') finalNom = matchEmail.nom_incube;
        }
      }

      // Priorité 2 au matching par N° PP
      if (!iId && finalPp) {
        const matchPP = await Incube.findOne({ where: { pp_numero: finalPp } });
        if (matchPP) {
          iId = String(matchPP.id);
          finalPp = matchPP.pp_numero;
          if (!finalNom || finalNom === '—') finalNom = matchPP.nom_incube;
          if (!finalEmail) finalEmail = matchPP.email;
        }
      }

      if (iId && /^\d+$/.test(iId)) {
        const matchId = await Incube.findByPk(iId);
        if (matchId) {
          iId = String(matchId.id);
          if (!finalPp || finalPp === '—') finalPp = matchId.pp_numero;
          if (!finalNom || finalNom === '—') finalNom = matchId.nom_incube;
        }
      }

      if ((!iId || !/^\d+$/.test(iId)) && finalNom) {
        const fullQueryName = `${finalNom} ${finalPrenom}`.trim().toLowerCase();
        const reverseQueryName = `${finalPrenom} ${finalNom}`.trim().toLowerCase();
        const allIncubes = await Incube.findAll({ attributes: ['id', 'nom_incube', 'pp_numero'] });
        const matched = allIncubes.find(inc => {
          if (!inc.nom_incube) return false;
          const dbName = inc.nom_incube.trim().toLowerCase();
          return dbName === fullQueryName || dbName === reverseQueryName || dbName === finalNom.toLowerCase();
        });
        if (matched) {
          iId = String(matched.id);
          finalPp = matched.pp_numero || finalPp;
          finalNom = matched.nom_incube;
        }
      }

      if (!iId) {
        iId = `manual_${Date.now()}`;
      }
    }

    // Vérification de la fenêtre d'émargement de l'atelier
    const atelier = await Atelier.findByPk(aId);
    if (atelier) {
      const windowCheck = isAtelierAttendanceWindowOpen(atelier, req.body);
      if (!windowCheck.isOpen) {
        return res.status(403).json({ message: windowCheck.message });
      }
    }

    const timeStr = time || new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    await PresenceAtelier.upsert({
      atelierId: aId,
      incubeId: iId,
      nom: finalNom || '—',
      prenom: finalPrenom || '—',
      ppNumero: finalPp || '—',
      email: finalEmail,
      present: true,
      time: timeStr,
      signedAt: new Date()
    });

    const responseData = {
      incubeId: iId,
      present: true,
      time: timeStr,
      nom: finalNom || '—',
      prenom: finalPrenom || '—',
      pp_numero: finalPp || '—',
      email: finalEmail,
      signedAt: new Date().toISOString()
    };

    console.log(`✅ Présence enregistrée en BDD [Atelier ${aId}] : ${finalNom} ${finalPrenom} (${finalPp || '—'}) à ${timeStr}`);
    res.json({ success: true, message: 'Présence enregistrée avec succès en BDD !', data: responseData });
  } catch (err) {
    console.error('Erreur enregistrement présence en BDD:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/presence/bulk (ADMIN) : Marquer tous présents ou réinitialiser en BDD
router.post('/bulk', auth, requireStaff, async (req, res) => {
  try {
    const { atelierId, action, incubes } = req.body;
    if (!atelierId) return res.status(400).json({ message: 'Atelier manquant' });

    const aId = String(atelierId);

    if (action === 'clear') {
      await PresenceAtelier.destroy({
        where: { atelierId: aId }
      });
      return res.json({ success: true, message: 'Toutes les présences ont été réinitialisées en BDD' });
    }

    if (action === 'all' && Array.isArray(incubes)) {
      const timeStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const now = new Date();

      for (const inc of incubes) {
        const iId = String(inc.id);
        const nom = inc.nom_incube?.split(' ')[0] || inc.nom_incube || '—';
        const prenom = inc.nom_incube?.split(' ').slice(1).join(' ') || '—';
        const ppNumero = inc.pp_numero || inc.raison_sociale || '—';

        await PresenceAtelier.upsert({
          atelierId: aId,
          incubeId: iId,
          nom,
          prenom,
          ppNumero,
          present: true,
          time: timeStr,
          signedAt: now
        });
      }

      return res.json({ success: true, message: 'Tous les incubés ont été marqués présents en BDD', count: incubes.length });
    }

    res.status(400).json({ message: 'Action non reconnue' });
  } catch (err) {
    console.error('Erreur présence bulk BDD:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET /api/presence/atelier/:id : Récupérer la liste des présences pour un atelier depuis la BDD (ADMIN)
router.get('/atelier/:id', auth, requireStaff, async (req, res) => {
  try {
    const aId = String(req.params.id);
    const records = await PresenceAtelier.findAll({
      where: { atelierId: aId, present: true },
      order: [['signedAt', 'ASC']]
    });

    const presencesList = records.map(r => ({
      incubeId: r.incubeId,
      present: r.present,
      time: r.time,
      nom: r.nom,
      prenom: r.prenom,
      pp_numero: r.ppNumero,
      signedAt: r.signedAt
    }));

    res.json(presencesList);
  } catch (err) {
    console.error('Erreur récupération présences BDD:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET /api/presence/all (ADMIN) : Récupérer l'ensemble de toutes les présences groupées par atelier
router.get('/all', auth, requireStaff, async (req, res) => {
  try {
    const records = await PresenceAtelier.findAll({
      where: { present: true },
      order: [['signedAt', 'ASC']]
    });

    const grouped = {};
    records.forEach(r => {
      if (!grouped[r.atelierId]) grouped[r.atelierId] = {};
      grouped[r.atelierId][r.incubeId] = {
        incubeId: r.incubeId,
        present: r.present,
        time: r.time,
        nom: r.nom,
        prenom: r.prenom,
        pp_numero: r.ppNumero,
        signedAt: r.signedAt
      };
    });

    res.json(grouped);
  } catch (err) {
    console.error('Erreur récupération toutes présences BDD:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET /api/presence/atelier/:id/info (PUBLIC) : Informations atelier, horaires et compte à rebours QR Code
router.get('/atelier/:id/info', async (req, res) => {
  try {
    const aId = req.params.id;
    let atelier = await Atelier.findByPk(aId);

    const queryTitre = req.query.titre || req.query.nom_atelier || 'Atelier & Formation IDS';
    const queryDate = normalizeDateString(req.query.date || (atelier && atelier.date) || new Date().toISOString().split('T')[0]);
    const queryDebut = req.query.heureDebut || (atelier && atelier.heureDebut) || '09:30';
    const queryFin = req.query.heureFin || (atelier && atelier.heureFin) || '12:30';
    const queryDuree = req.query.duree || (atelier && atelier.duree) || '3h00';

    if (!atelier) {
      atelier = {
        id: aId,
        titre: queryTitre,
        date: queryDate,
        heureDebut: queryDebut,
        heureFin: queryFin,
        duree: queryDuree,
        statutOuverture: 'auto'
      };
    }

    const now = new Date();
    const dateStr = normalizeDateString(req.query.date || atelier.date);
    const heureDebutStr = req.query.heureDebut || atelier.heureDebut || '09:30';
    const heureFinStr = req.query.heureFin || atelier.heureFin || '12:30';

    const [hD, mD] = heureDebutStr.split(':').map(Number);
    const startDateTime = new Date(`${dateStr}T${String(hD || 0).padStart(2, '0')}:${String(mD || 0).padStart(2, '0')}:00`);

    const [hF, mF] = heureFinStr.split(':').map(Number);
    const endDateTime = new Date(`${dateStr}T${String(hF || 0).padStart(2, '0')}:${String(mF || 0).padStart(2, '0')}:00`);

    const timeDiffMs = startDateTime.getTime() - now.getTime();
    const isPast = now.getTime() > (endDateTime.getTime() + 2 * 60 * 60 * 1000);

    let isOpen = false;
    if (atelier.statutOuverture === 'ouvert_force') {
      isOpen = true;
    } else if (atelier.statutOuverture === 'cloture' || isPast) {
      isOpen = false;
    } else {
      // Ouvert dès que l'heure de début est atteinte (avec 5 min d'avance tolérées)
      isOpen = timeDiffMs <= 5 * 60 * 1000;
    }

    res.json({
      success: true,
      atelier: {
        id: atelier.id,
        titre: atelier.titre,
        formateur: atelier.formateur,
        date: dateStr,
        heureDebut: heureDebutStr,
        heureFin: heureFinStr,
        duree: atelier.duree,
        statutOuverture: atelier.statutOuverture || 'auto',
        isOpen,
        isPast,
        timeRemainingMs: Math.max(0, timeDiffMs),
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString()
      }
    });
  } catch (err) {
    console.error('Erreur info atelier:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// PUT /api/presence/atelier/:id/horaire (ADMIN) : Ajuster heureDebut, heureFin, date ou forcer l'ouverture du QR code
router.put('/atelier/:id/horaire', auth, requireStaff, async (req, res) => {
  try {
    const aId = req.params.id;
    const { heureDebut, heureFin, date, duree, statutOuverture, titre, formateur } = req.body;

    let atelier = await Atelier.findByPk(aId);

    if (!atelier) {
      atelier = await Atelier.create({
        id: aId,
        titre: titre || 'Atelier & Formation IDS',
        formateur: formateur || 'Intervenant IDS',
        date: date || new Date().toISOString().split('T')[0],
        heureDebut: heureDebut || '09:30',
        heureFin: heureFin || '12:30',
        duree: duree || '3h00',
        statutOuverture: statutOuverture || 'auto'
      });
    } else {
      if (heureDebut !== undefined) atelier.heureDebut = heureDebut;
      if (heureFin !== undefined) atelier.heureFin = heureFin;
      if (date !== undefined) atelier.date = date;
      if (duree !== undefined) atelier.duree = duree;
      if (statutOuverture !== undefined) atelier.statutOuverture = statutOuverture;
      if (titre !== undefined) atelier.titre = titre;
      if (formateur !== undefined) atelier.formateur = formateur;
      await atelier.save();
    }

    res.json({
      success: true,
      message: 'Horaire de l\'atelier mis à jour avec succès !',
      atelier
    });
  } catch (err) {
    console.error('Erreur mise à jour horaire atelier:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// DELETE /api/presence/:id — Supprimer une présence par son identifiant unique en BDD
router.delete('/:id', auth, requireStaff, async (req, res) => {
  try {
    const item = await PresenceAtelier.findByPk(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Présence introuvable' });
    }
    await item.destroy();
    res.json({ success: true, message: 'Présence supprimée avec succès' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/presence/atelier/:atelierId/incube/:incubeId — Supprimer la présence d'un incubé à un atelier
router.delete('/atelier/:atelierId/incube/:incubeId', auth, requireStaff, async (req, res) => {
  try {
    const { atelierId, incubeId } = req.params;
    const deleted = await PresenceAtelier.destroy({
      where: {
        atelierId: String(atelierId),
        incubeId: String(incubeId)
      }
    });
    res.json({ success: true, message: `${deleted} présence(s) supprimée(s) avec succès` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/presence/atelier/:atelierId — Réinitialiser / supprimer toutes les présences d'un atelier
router.delete('/atelier/:atelierId', auth, requireStaff, async (req, res) => {
  try {
    const { atelierId } = req.params;
    const deleted = await PresenceAtelier.destroy({
      where: { atelierId: String(atelierId) }
    });
    res.json({ success: true, message: `Toutes les présences (${deleted}) ont été supprimées` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
