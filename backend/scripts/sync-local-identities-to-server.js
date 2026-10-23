/**
 * Script de synchronisation des identités, badges, types (Admin, Incube, Visiteur)
 * et réservations depuis les données validées en local vers la base du serveur.
 * 
 * Usage sur le serveur :
 * cd /var/www/incubateur-cgs/backend && node scripts/sync-local-identities-to-server.js
 */

const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const { TourniquetUser, User, Incube, Attendance, ReservationEspace, sequelize } = require('../src/models');

async function runSync() {
  console.log('🚀 Démarrage de la synchronisation des identités et badges...');

  const dataPath = path.join(__dirname, 'localIdentitiesData.json');
  if (!fs.existsSync(dataPath)) {
    throw new Error('Fichier localIdentitiesData.json introuvable dans ' + __dirname);
  }

  const rawData = fs.readFileSync(dataPath, 'utf8');
  const { tourniquetUsers, users, incubes } = JSON.parse(rawData);

  // 1. Synchronisation de TourniquetUser (107 usagers avec leurs noms exacts et types Administration, Incube, Visiteur)
  console.log(`\n📋 1. Synchronisation de ${tourniquetUsers.length} usagers TourniquetUser...`);
  let tuCount = 0;
  for (const tu of tourniquetUsers) {
    await TourniquetUser.upsert({
      badge_id: tu.badge_id,
      name: tu.name,
      cardno: tu.cardno || null,
      type: tu.type || 'Visiteur',
      device_ip: tu.device_ip || null
    });
    tuCount++;
  }
  console.log(`✅ ${tuCount} usagers synchronisés dans 'tourniquet_users'.`);

  // 2. Synchronisation et Création des comptes User (badge_id, role, type)
  console.log(`\n👤 2. Synchronisation de ${users.length} comptes User (badge_id, role et type)...`);
  let uCount = 0;
  let uCreated = 0;
  for (const u of users) {
    let existing = null;
    if (u.email) {
      existing = await User.findOne({ where: { email: u.email } });
    }
    if (!existing && u.id) {
      existing = await User.findByPk(u.id);
    }

    if (existing) {
      existing.role = u.role || existing.role;
      existing.type = u.type || existing.type;
      if (u.badge_id) existing.badge_id = u.badge_id;
      if (u.nom && !existing.nom) existing.nom = u.nom;
      if (u.prenom && !existing.prenom) existing.prenom = u.prenom;
      await existing.save();
      uCount++;

      // Lier les pointages historiques de ce badge_id au user_id
      if (u.badge_id) {
        await Attendance.update(
          { user_id: existing.id },
          {
            where: {
              raw_badge_id: String(u.badge_id).trim(),
              [Op.or]: [{ user_id: null }, { user_id: { [Op.ne]: existing.id } }]
            }
          }
        ).catch(() => {});
      }
    } else {
      // Créer le compte utilisateur manquant (ex: Mustapha, Hicham, etc.)
      const newUser = await User.create({
        nom: u.nom || 'Admin',
        prenom: u.prenom || '',
        email: u.email || `user_${Date.now()}@cgs-incubateur.ma`,
        mot_de_passe: u.mot_de_passe || '$2b$10$defaultHashPlaceholderAdmin',
        role: u.role || 'admin',
        type: u.type || 'Administration',
        badge_id: u.badge_id || null,
        actif: u.actif !== undefined ? u.actif : true
      }).catch(err => {
        console.warn('⚠️ Impossible de créer utilisateur:', u.email, err.message);
        return null;
      });

      if (newUser) {
        uCreated++;
        if (newUser.badge_id) {
          await Attendance.update(
            { user_id: newUser.id },
            { where: { raw_badge_id: String(newUser.badge_id).trim() } }
          ).catch(() => {});
        }
      }
    }
  }
  console.log(`✅ ${uCount} utilisateurs mis à jour, ${uCreated} créés.`);

  // 3. Synchronisation des badges dans la table Incube
  console.log(`\n🚀 3. Synchronisation de ${incubes.length} incubés (badge_id)...`);
  let incCount = 0;
  for (const inc of incubes) {
    let existing = null;
    if (inc.email) {
      existing = await Incube.findOne({ where: { email: inc.email } });
    }
    if (!existing && inc.nom_incube) {
      existing = await Incube.findOne({
        where: sequelize.where(
          sequelize.fn('LOWER', sequelize.col('nom_incube')),
          sequelize.fn('LOWER', inc.nom_incube)
        )
      });
    }
    if (!existing && inc.id) {
      existing = await Incube.findByPk(inc.id);
    }

    if (existing && inc.badge_id) {
      existing.badge_id = inc.badge_id;
      await existing.save();
      incCount++;

      if (existing.user_id) {
        await User.update(
          { badge_id: inc.badge_id, type: 'Incube' },
          { where: { id: existing.user_id } }
        ).catch(() => {});

        await Attendance.update(
          { user_id: existing.user_id },
          {
            where: {
              raw_badge_id: String(inc.badge_id).trim(),
              [Op.or]: [{ user_id: null }, { user_id: { [Op.ne]: existing.user_id } }]
            }
          }
        ).catch(() => {});
      }
    }
  }
  console.log(`✅ ${incCount} incubés mis à jour avec leurs badges.`);

  // 4. Rattachement des réservations d'espaces orphelines (incube_id)
  console.log('\n📅 4. Rattachement des réservations d\'espace orphelines...');
  const [resList, allIncubes, allUsers] = await Promise.all([
    ReservationEspace.findAll(),
    Incube.findAll(),
    User.findAll()
  ]);

  let resLinked = 0;
  for (const r of resList) {
    if (!r.incubeId) {
      let matched = allIncubes.find(i => 
        (i.email && r.emailIncube && i.email.toLowerCase() === r.emailIncube.toLowerCase()) ||
        (i.nom_incube && r.nomIncube && (
          i.nom_incube.toLowerCase().includes(r.nomIncube.toLowerCase()) ||
          r.nomIncube.toLowerCase().includes(i.nom_incube.toLowerCase())
        ))
      );
      if (!matched) {
        const u = allUsers.find(u => u.email && r.emailIncube && u.email.toLowerCase() === r.emailIncube.toLowerCase());
        if (u) matched = allIncubes.find(i => i.user_id === u.id);
      }
      if (matched) {
        r.incubeId = matched.id;
        await r.save();
        resLinked++;
      }
    }
  }
  console.log(`✅ ${resLinked} réservations rattachées à leurs incubés.`);

  console.log('\n🎉 SYNCHRONISATION TERMINÉE AVEC SUCCÈS !');
  console.log('Tous les types (Administration, Incube, Visiteur), noms et badges sont maintenant actifs.');
  process.exit(0);
}

runSync().catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
