const ZKLib = require('node-zklib');
const { Incube, User, TourniquetUser, Attendance, sequelize } = require('../src/models');
const tourniquetService = require('../src/services/tourniquetService');

const DEVICES = (process.env.ZKT_DEVICES || "10.0.1.120,10.0.1.201,10.0.1.113,10.0.1.108,10.0.1.116,10.0.1.17,10.0.1.223")
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const PORT = 4370;

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

async function runImport() {
  console.log('--- Étape 1 : Lecture des utilisateurs enregistrés sur les tourniquets ---');
  const zk = new ZKLib('10.0.1.120', PORT, 3000, 4000);
  await zk.createSocket();
  const usersRes = await zk.getUsers();
  await zk.disconnect();
  const zkUsers = usersRes?.data || [];
  console.log(`✅ ${zkUsers.length} utilisateurs trouvés dans la mémoire des tourniquets.`);

  const incubes = await Incube.findAll();
  const users = await User.findAll();

  let countUpdatedIncubes = 0;
  let countUpdatedStaff = 0;

  for (const zu of zkUsers) {
    const zuName = normalizeName(zu.name);
    const zuId = String(zu.userId || '').trim();
    const zuCard = String(zu.cardno || '').trim();
    if (!zuName || !zuId) continue;

    const finalBadge = zuCard && zuCard !== '0' ? zuCard : zuId;
    const finalMatricule = zuId;

    // Enregistrer dans TourniquetUser (annuaire des badges)
    await TourniquetUser.upsert({
      badge_id: finalBadge,
      name: zu.name,
      cardno: zuCard || null,
      device_ip: '10.0.1.120'
    }).catch(() => {});

    // 1. Chercher un incubé correspondant
    const matchInc = incubes.find(inc => {
      const inName = normalizeName(inc.nom_incube);
      return inName === zuName || 
             (zuName.length >= 4 && inName.includes(zuName)) ||
             (inName.length >= 4 && zuName.includes(inName));
    });

    if (matchInc) {
      await Incube.update({
        badge_id: finalBadge,
        matricule: finalMatricule
      }, { where: { id: matchInc.id } });
      countUpdatedIncubes++;
      console.log(`[INCUBÉ LIÉ] ${matchInc.nom_incube} => Matricule: #${finalMatricule}, Badge RFID: #${finalBadge}`);

      // Synchroniser immédiatement les heures de cet incubé pour 2026
      await tourniquetService.syncIncubeTourniquet(matchInc.id, 2026).catch(e => console.warn(`Warn sync ${matchInc.nom_incube}:`, e.message));
    } else {
      // 2. Chercher dans les comptes utilisateurs (Staff / Admins)
      const matchStaff = users.find(u => {
        const uName = normalizeName(`${u.prenom} ${u.nom}`);
        const uNameRev = normalizeName(`${u.nom} ${u.prenom}`);
        return uName === zuName || uNameRev === zuName;
      });

      if (matchStaff) {
        await User.update({
          badge_id: finalBadge
        }, { where: { id: matchStaff.id } });
        countUpdatedStaff++;
        console.log(`[STAFF LIÉ] ${matchStaff.prenom} ${matchStaff.nom} => Badge RFID: #${finalBadge}`);
      }
    }
  }

  console.log(`\n🎉 IMPORTATION TERMINÉE :`);
  console.log(`- ${countUpdatedIncubes} incubés ont reçu leur badge et leurs heures réelles ont été calculées !`);
  console.log(`- ${countUpdatedStaff} membres du personnel/staff ont été reliés.`);
  process.exit(0);
}

runImport().catch(err => {
  console.error('Erreur importation:', err);
  process.exit(1);
});
