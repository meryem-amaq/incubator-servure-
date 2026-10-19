const fs = require('fs');
const path = require('path');
const { 
  sequelize, 
  User, 
  Incube, 
  GestionMateriel, 
  SuiviEngagement, 
  RhEmploi, 
  RhDetail, 
  PlanAction, 
  AnalyseFinanciere, 
  RendezVous, 
  ReservationEspace, 
  PresenceAtelier 
} = require('../src/models');
const { Op } = require('sequelize');

async function main() {
  const isApply = process.argv.includes('--apply');
  console.log('================================================================');
  console.log('🛡️  SCRIPT DE SAUVEGARDE & NETTOYAGE SÉCURISÉ DE LA BASE DE DONNÉES');
  console.log('================================================================\n');

  try {
    await sequelize.authenticate();
    console.log('✅ Connexion à la base de données réussie.');

    // 1. CRÉATION DU DOSSIER DE BACKUP ET EXPORTATION COMPLÈTE
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `backup_avant_nettoyage_${timestamp}.json`);

    console.log('\n📦 Étape 1 : Sauvegarde complète de sécurité des tables...');
    const allUsers = await User.findAll({ raw: true });
    const allIncubes = await Incube.findAll({ raw: true });
    const allMateriels = await GestionMateriel.findAll({ raw: true });
    const allEngagements = await SuiviEngagement.findAll({ raw: true });
    const allRhEmploi = await RhEmploi.findAll({ raw: true });
    const allRhDetail = await RhDetail.findAll({ raw: true });
    const allPlans = await PlanAction.findAll({ raw: true });
    const allFinances = await AnalyseFinanciere.findAll({ raw: true });
    const allRdv = await RendezVous.findAll({ raw: true });
    const allReservations = await ReservationEspace.findAll({ raw: true });
    const allPresences = await PresenceAtelier.findAll({ raw: true });

    const fullBackup = {
      timestamp: new Date().toISOString(),
      counts: {
        users: allUsers.length,
        incubes: allIncubes.length,
        materiels: allMateriels.length,
        engagements: allEngagements.length,
        rh_emploi: allRhEmploi.length,
        rh_detail: allRhDetail.length,
        plans_action: allPlans.length,
        finances: allFinances.length,
        rendez_vous: allRdv.length,
        reservations: allReservations.length,
        presences: allPresences.length,
      },
      data: {
        users: allUsers,
        incubes: allIncubes,
        materiels: allMateriels,
        engagements: allEngagements,
        rh_emploi: allRhEmploi,
        rh_detail: allRhDetail,
        plans_action: allPlans,
        finances: allFinances,
        rendez_vous: allRdv,
        reservations: allReservations,
        presences: allPresences,
      }
    };

    fs.writeFileSync(backupFile, JSON.stringify(fullBackup, null, 2), 'utf-8');
    console.log(`✅ Sauvegarde intégrale enregistrée avec succès dans :`);
    console.log(`   📄 ${backupFile}`);
    console.log(`   (Contient ${allIncubes.length} incubés, ${allUsers.length} utilisateurs, etc.)\n`);

    // 2. IDENTIFICATION DES INCUBÉS À CONSERVER
    console.log('🔍 Étape 2 : Identification des incubés réels à préserver...');
    const keepCriterias = [
      { name: 'Badreddine AIZ', pp: '75', email: 'badr.aiz@hotmail.com' },
      { name: 'Salima AGHRISS', pp: '70', email: null },
      { name: 'KOUHAILA Abdelkrim', pp: '81', email: 'abdelkrim.kouhaila@gmail.com' }
    ];

    const toKeep = [];
    const toDelete = [];

    for (const inc of allIncubes) {
      const nom = (inc.nom_incube || '').toLowerCase();
      const pp = String(inc.pp_numero || '').replace(/[^0-9]/g, '');
      const email = (inc.email || '').toLowerCase();

      const shouldKeep = keepCriterias.some(c => {
        const cNomParts = c.name.toLowerCase().split(' ');
        const matchNom = cNomParts.every(part => nom.includes(part));
        const matchPp = c.pp && pp.includes(c.pp);
        const matchEmail = c.email && email === c.email.toLowerCase();
        return matchNom || matchPp || matchEmail;
      });

      if (shouldKeep) {
        toKeep.push(inc);
      } else {
        toDelete.push(inc);
      }
    }

    console.log(`\n🟢 INCUBÉS QUI SERONT CONSERVÉS (${toKeep.length}) :`);
    toKeep.forEach(i => {
      console.log(`  ⭐ ID: ${i.id} | Nom: ${i.nom_incube} | PP: ${i.pp_numero} | Société: ${i.raison_sociale || 'N/A'} | Email: ${i.email || 'N/A'}`);
    });

    console.log(`\n🔴 INCUBÉS QUI SERONT NETTOYÉS / SUPPRIMÉS (${toDelete.length}) :`);
    toDelete.forEach(i => {
      console.log(`  🗑️ ID: ${i.id} | Nom: ${i.nom_incube} | PP: ${i.pp_numero} | Société: ${i.raison_sociale || 'N/A'}`);
    });

    if (!isApply) {
      console.log('\n⚠️  MODE VÉRIFICATION (DRY-RUN) : Aucune suppression n\'a été effectuée.');
      console.log('   Pour exécuter réellement le nettoyage, relancez avec : node database/backup-and-clean.js --apply');
      return;
    }

    // 3. APPLICATION DU NETTOYAGE SI --apply EST FOURNI
    console.log('\n⚡ Étape 3 : Application réelle du nettoyage...');
    const deleteIds = toDelete.map(i => i.id);

    if (deleteIds.length === 0) {
      console.log('ℹ️  Aucun incubé superflu à supprimer.');
      return;
    }

    await sequelize.transaction(async (t) => {
      // Nettoyage des sous-tables associées
      await GestionMateriel.destroy({ where: { incube_id: { [Op.in]: deleteIds } }, transaction: t });
      await SuiviEngagement.destroy({ where: { incube_id: { [Op.in]: deleteIds } }, transaction: t });
      await RhEmploi.destroy({ where: { incube_id: { [Op.in]: deleteIds } }, transaction: t });
      await RhDetail.destroy({ where: { incube_id: { [Op.in]: deleteIds } }, transaction: t });
      await PlanAction.destroy({ where: { incube_id: { [Op.in]: deleteIds } }, transaction: t });
      await AnalyseFinanciere.destroy({ where: { incube_id: { [Op.in]: deleteIds } }, transaction: t });

      // Réservations d'espaces et présences ateliers des incubés supprimés
      try {
        await ReservationEspace.destroy({ where: { incubeId: { [Op.in]: deleteIds } }, transaction: t });
      } catch (e) {
        // Table ou colonne optionnelle
      }
      try {
        await PresenceAtelier.destroy({ where: { incubeId: { [Op.in]: deleteIds } }, transaction: t });
      } catch (e) {
        // Table ou colonne optionnelle
      }

      // Nettoyage des rendez-vous associés aux incubés supprimés
      try {
        const allRendezVous = await RendezVous.findAll({ transaction: t });
        for (const rdv of allRendezVous) {
          let rdvIds = [];
          try {
            rdvIds = JSON.parse(rdv.incubeIds);
          } catch {
            rdvIds = String(rdv.incubeIds || '').split(',').map(s => parseInt(s.trim(), 10)).filter(Boolean);
          }
          if (Array.isArray(rdvIds)) {
            const remaining = rdvIds.filter(id => !deleteIds.includes(id));
            if (remaining.length === 0) {
              await rdv.destroy({ transaction: t });
            } else if (remaining.length !== rdvIds.length) {
              await rdv.update({ incubeIds: JSON.stringify(remaining) }, { transaction: t });
            }
          }
        }
      } catch (e) {
        // Table ou structure optionnelle
      }

      // Suppression des comptes Utilisateurs liés de rôle 'incube' pour ces incubés de test
      const userIdsToDelete = toDelete.map(i => i.user_id).filter(Boolean);
      if (userIdsToDelete.length > 0) {
        await User.destroy({ where: { id: { [Op.in]: userIdsToDelete }, role: 'incube' }, transaction: t });
      }

      // Suppression des incubés ciblés
      await Incube.destroy({ where: { id: { [Op.in]: deleteIds } }, transaction: t });
    });

    console.log(`\n🎉 NETTOYAGE TERMINÉ AVEC SUCCÈS !`);
    console.log(`   - ${deleteIds.length} incubés de test supprimés.`);
    console.log(`   - ${toKeep.length} incubés réels conservés.`);
    console.log(`   - Tous les comptes administrateurs sont intacts.`);

  } catch (err) {
    console.error('❌ Erreur lors de l\'exécution :', err);
  } finally {
    await sequelize.close();
  }
}

main();
