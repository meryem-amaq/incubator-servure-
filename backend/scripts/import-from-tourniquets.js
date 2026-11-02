const ZKLib = require('node-zklib');
const { Incube, User, TourniquetUser, Attendance, sequelize } = require('../src/models');
const tourniquetService = require('../src/services/tourniquetService');

const DEVICES = (process.env.ZKT_DEVICES || "10.0.1.120,10.0.1.201,10.0.1.113,10.0.1.108,10.0.1.116,10.0.1.17,10.0.1.223")
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const PORT = 4370;

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

  // Exact match on all significant words
  if (sigA.length === sigB.length && sigA.every(wa => sigB.includes(wa))) {
    return true;
  }

  // Count how many significant words match with high similarity (>= 0.75)
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

async function runImport() {
  console.log('--- Connexion aux bornes ZKTeco pour lecture des usagers physiques ---');
  let zkUsers = [];
  for (const ip of DEVICES) {
    const zk = new ZKLib(ip, PORT, 3000, 4000);
    try {
      await zk.createSocket();
      const usersRes = await zk.getUsers();
      await zk.disconnect();
      if (usersRes?.data && Array.isArray(usersRes.data) && usersRes.data.length > 0) {
        zkUsers = usersRes.data;
        console.log(`✅ ${zkUsers.length} utilisateurs trouvés sur la borne ${ip}.`);
        break;
      }
    } catch (e) {
      // Borne suivante
    }
  }

  if (zkUsers.length === 0) {
    console.warn('⚠️ Impossible de joindre les bornes ZKTeco pour récupérer les utilisateurs.');
    process.exit(1);
  }

  const incubes = await Incube.findAll();
  const users = await User.findAll();

  let countUpdatedIncubes = 0;
  let countUpdatedStaff = 0;
  let countVisitors = 0;
  const currentYear = 2026;

  for (const zu of zkUsers) {
    const zuId = String(zu.userId || '').trim();
    const zuCard = String(zu.cardno || '').trim();
    const zuName = String(zu.name || '').trim();
    if (!zuId && !zuCard) continue;

    const finalBadge = zuCard && zuCard !== '0' ? zuCard : zuId;
    const finalMatricule = zuId;

    // 1. Chercher dans Incube
    let matchInc = incubes.find(inc => matchesPersonName(zuName, inc.nom_incube));

    // 2. Si pas trouvé, chercher dans User
    let matchUser = null;
    if (!matchInc) {
      matchUser = users.find(u => matchesPersonName(zuName, `${u.prenom || ''} ${u.nom || ''}`) || matchesPersonName(zuName, `${u.nom || ''} ${u.prenom || ''}`));
      if (matchUser && matchUser.role === 'incube') {
        // C'est un compte incubé dans User, chercher s'il a un dossier dans Incube
        matchInc = incubes.find(inc => inc.user_id === matchUser.id || matchesPersonName(inc.nom_incube, `${matchUser.prenom} ${matchUser.nom}`));
      }
    }

    if (matchInc) {
      const nomFinal = matchInc.nom_incube;
      // Enregistrer / Mettre à jour l'incubé
      await Incube.update({
        badge_id: finalBadge,
        matricule: finalMatricule
      }, { where: { id: matchInc.id } });

      if (matchInc.user_id) {
        await User.update({ badge_id: finalBadge }, { where: { id: matchInc.user_id } }).catch(() => {});
      }

      // Enregistrer dans TourniquetUser avec la catégorie 'Incube'
      // 1. Par son matricule machine (ex: 141)
      await TourniquetUser.upsert({
        badge_id: zuId,
        name: nomFinal,
        cardno: zuCard || null,
        type: 'Incube',
        device_ip: DEVICES[0]
      }).catch(() => {});

      // 2. Par son numéro de badge RFID (ex: 12962429) si différent
      if (finalBadge !== zuId) {
        await TourniquetUser.upsert({
          badge_id: finalBadge,
          name: nomFinal,
          cardno: zuCard || null,
          type: 'Incube',
          device_ip: DEVICES[0]
        }).catch(() => {});
      }

      countUpdatedIncubes++;
      console.log(`[INCUBÉ LIÉ] ${nomFinal} => Matricule: #${finalMatricule}, Badge RFID: #${finalBadge}`);

      // Recalculer les heures de l'incubé pour 2026
      await tourniquetService.syncIncubeTourniquet(matchInc.id, currentYear).catch(e => console.warn(`Warn sync ${nomFinal}:`, e.message));

    } else if (matchUser) {
      const staffName = `${matchUser.prenom || ''} ${matchUser.nom || ''}`.trim() || zuName;
      const staffType = matchUser.role === 'incube' ? 'Incube' : 'Administration';

      await User.update({ badge_id: finalBadge }, { where: { id: matchUser.id } });

      // Enregistrer dans TourniquetUser
      await TourniquetUser.upsert({
        badge_id: zuId,
        name: staffName,
        cardno: zuCard || null,
        type: staffType,
        device_ip: DEVICES[0]
      }).catch(() => {});

      if (finalBadge !== zuId) {
        await TourniquetUser.upsert({
          badge_id: finalBadge,
          name: staffName,
          cardno: zuCard || null,
          type: staffType,
          device_ip: DEVICES[0]
        }).catch(() => {});
      }

      countUpdatedStaff++;
      console.log(`[STAFF LIÉ] ${staffName} => Matricule: #${finalMatricule}, Badge RFID: #${finalBadge} (${staffType})`);

    } else {
      // Usager externe / Visiteur
      const visitorName = zuName || `Visiteur #${zuId}`;
      await TourniquetUser.upsert({
        badge_id: zuId,
        name: visitorName,
        cardno: zuCard || null,
        type: 'Visiteur',
        device_ip: DEVICES[0]
      }).catch(() => {});

      if (finalBadge !== zuId) {
        await TourniquetUser.upsert({
          badge_id: finalBadge,
          name: visitorName,
          cardno: zuCard || null,
          type: 'Visiteur',
          device_ip: DEVICES[0]
        }).catch(() => {});
      }

      countVisitors++;
    }
  }

  console.log(`\n🎉 IMPORTATION & LIAISON TERMINÉES :`);
  console.log(`- ${countUpdatedIncubes} incubés ont été liés avec leur Matricule machine et Badge RFID.`);
  console.log(`- ${countUpdatedStaff} membres du personnel (Staff / Admin) ont été identifiés.`);
  console.log(`- ${countVisitors} usagers externes enregistrés comme Visiteurs.`);
  process.exit(0);
}

runImport().catch(err => {
  console.error('Erreur runImport:', err);
  process.exit(1);
});
