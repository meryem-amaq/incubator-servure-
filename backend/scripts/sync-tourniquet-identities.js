const ZKLib = require('node-zklib');
const { User, Incube, Attendance, TourniquetUser, sequelize } = require('../src/models');
const { Op } = require('sequelize');

const DEVICES = (process.env.ZKT_DEVICES || "10.0.1.120,10.0.1.201,10.0.1.113,10.0.1.108,10.0.1.116,10.0.1.17,10.0.1.223")
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const PORT = parseInt(process.env.ZKT_PORT || '4370', 10);

function norm(s) {
  if (!s) return '';
  return s.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

async function syncAllIdentities() {
  console.log('🚀 Synchronisation des identités des tourniquets avec la base de données...');

  // 1. S'assurer que la table tourniquet_users existe
  await TourniquetUser.sync();
  console.log('✅ Table tourniquet_users synchronisée.');

  // 2. Extraire tous les utilisateurs des 7 tourniquets physiques
  const machineUsersMap = new Map();
  for (const ip of DEVICES) {
    const zk = new ZKLib(ip, PORT, 2500, 3000);
    try {
      await zk.createSocket();
      const res = await zk.getUsers();
      const list = res?.data || [];
      console.log(`🔌 Tourniquet ${ip}: ${list.length} utilisateurs trouvés`);
      for (const u of list) {
        const uid = String(u.userId || '').trim();
        const name = String(u.name || '').trim();
        const cardno = String(u.cardno || '').trim();
        if (uid && name && !machineUsersMap.has(uid)) {
          machineUsersMap.set(uid, {
            badge_id: uid,
            name: name,
            cardno: cardno,
            device_ip: ip
          });
        }
      }
      await zk.disconnect().catch(() => {});
    } catch (err) {
      console.log(`⚠️ Tourniquet ${ip} non joignable (${err.message})`);
    }
  }

  console.log(`\n📋 Total personnes découvertes sur les machines : ${machineUsersMap.size}`);

  // 3. Charger les Incubés et Users existants
  const [incubes, users] = await Promise.all([
    Incube.findAll(),
    User.findAll()
  ]);

  // 4. Mappages explicites connus du Staff / Administration
  const staffMappings = [
    { badge: '143', name: 'Ayoub EL BOUCHIKHI', userId: 15, nom: 'EL BOUCHIKHI', prenom: 'Ayoub' },
    { badge: '144', name: 'Kawtar SBAI', userId: 81, nom: 'SBAI', prenom: 'Kawtar' },
    { badge: '194', name: 'Ilham LAHBOUB', userId: 14, nom: 'LAHBOUB', prenom: 'Ilham' },
    { badge: '205', name: 'Charaf EL AMRANI', userId: 82, nom: 'EL AMRANI', prenom: 'Charaf' },
    { badge: '227', name: 'Hicham BELAAZIZ', userId: 79, nom: 'BELAAZIZ', prenom: 'Hicham' },
    { badge: '145', name: 'Test AMA', userId: 2, nom: 'AMA', prenom: 'Test' },
    { badge: '1', name: 'Admin', userId: 1, nom: 'Administrateur', prenom: '' }
  ];

  console.log('\n--- MISE À JOUR STAFF ADMINISTRATION ---');
  for (const st of staffMappings) {
    const usr = users.find(u => u.id === st.userId);
    if (usr) {
      await User.update({
        badge_id: st.badge,
        nom: st.nom,
        prenom: st.prenom,
        type: 'Administration'
      }, { where: { id: usr.id } });

      // Lier les pointages existants de ce badge au user_id
      const [updatedAttendances] = await Attendance.update(
        { user_id: usr.id },
        { where: { raw_badge_id: st.badge, [Op.or]: [{ user_id: null }, { user_id: { [Op.ne]: usr.id } }] } }
      );
      console.log(`✅ Staff lié: ${st.prenom} ${st.nom} -> Badge #${st.badge} (Attendances liées: ${updatedAttendances})`);
    }
  }

  // 5. Rapprochement intelligent des Incubés
  console.log('\n--- RAPPROCHEMENT INTELLIGENT DES INCUBÉS ---');
  const machineList = Array.from(machineUsersMap.values());
  const usedBadges = new Set(staffMappings.map(s => s.badge));
  let incubesMatched = 0;

  for (const inc of incubes) {
    const incNorm = norm(inc.nom_incube);
    const incParts = incNorm.split(' ').filter(p => p.length >= 3);

    let best = null;
    let bestScore = 999;

    for (const mu of machineList) {
      if (usedBadges.has(mu.badge_id)) continue;
      const muNorm = norm(mu.name);

      if (incNorm === muNorm) {
        best = mu;
        bestScore = 0;
        break;
      }

      const allPartsPresent = incParts.length >= 2 && incParts.every(p => muNorm.includes(p));
      if (allPartsPresent) {
        best = mu;
        bestScore = 1;
        break;
      }

      const dist = levenshtein(incNorm, muNorm);
      if (dist <= 2 && dist < bestScore) {
        best = mu;
        bestScore = dist;
      }
    }

    if (best) {
      usedBadges.add(best.badge_id);
      incubesMatched++;

      // Mise à jour de l'incubé avec son badge exact
      await Incube.update({ badge_id: best.badge_id }, { where: { id: inc.id } });

      // Si l'incubé est rattaché à un user_id dans `users`, mettre à jour aussi users.badge_id
      if (inc.user_id) {
        await User.update({ badge_id: best.badge_id, type: 'Incube' }, { where: { id: inc.user_id } });
        // Lier les pointages de ce badge au user_id
        await Attendance.update(
          { user_id: inc.user_id },
          { where: { raw_badge_id: best.badge_id, [Op.or]: [{ user_id: null }, { user_id: { [Op.ne]: inc.user_id } }] } }
        );
      }

      console.log(`✅ Incubé [${inc.id}] ${inc.nom_incube} => Badge #${best.badge_id} (${best.name})`);
    }
  }
  console.log(`✨ Total incubés réconciliés : ${incubesMatched} / ${incubes.length}`);

  // 6. Enregistrement de tous les utilisateurs tourniquets dans la table tourniquet_users
  console.log('\n--- SYNCHRONISATION DU RÉPERTOIRE TOURNIQUET (tourniquet_users) ---');
  let tourniquetUsersAdded = 0;

  for (const mu of machineList) {
    // Déterminer la catégorie
    let category = 'Visiteur';
    if (staffMappings.some(s => s.badge === mu.badge_id)) {
      category = 'Administration';
    } else if (usedBadges.has(mu.badge_id)) {
      category = 'Incube';
    }

    await TourniquetUser.upsert({
      badge_id: mu.badge_id,
      name: mu.name,
      cardno: mu.cardno || null,
      type: category,
      device_ip: mu.device_ip
    });
    tourniquetUsersAdded++;
  }

  console.log(`✅ ${tourniquetUsersAdded} personnes enregistrées/mises à jour dans 'tourniquet_users'.`);
  console.log('🎉 Synchronisation terminée avec succès !');
  process.exit(0);
}

syncAllIdentities().catch(err => {
  console.error('❌ Erreur de synchronisation:', err);
  process.exit(1);
});
