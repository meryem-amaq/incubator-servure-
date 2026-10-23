/**
 * Script de synchronisation des données de suivi_engagement vers le serveur de production.
 * Rapatrie les heures mensuelles consolidées et les taux de formation.
 * 
 * Usage sur le serveur :
 * cd /var/www/incubateur-cgs/backend && node scripts/sync-engagement-data.js
 */

const path = require('path');
const fs = require('fs');
const { SuiviEngagement, Incube, sequelize } = require('../src/models');

async function syncEngagement() {
  console.log('🚀 Démarrage de la synchronisation des données de suivi_engagement...');
  const jsonPath = path.join(__dirname, 'engagementData.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error('Fichier engagementData.json introuvable dans ' + __dirname);
  }
  const rawList = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const allIncubes = await Incube.findAll();

  let updated = 0;
  let created = 0;

  for (const item of rawList) {
    // 1. Trouver l'incubé cible (par ID, email ou nom)
    let inc = allIncubes.find(i => i.id === item.incube_id);
    if (!inc && item.email) {
      inc = allIncubes.find(i => i.email && i.email.toLowerCase() === item.email.toLowerCase());
    }
    if (!inc && item.nom_incube) {
      inc = allIncubes.find(i => i.nom_incube && i.nom_incube.toLowerCase() === item.nom_incube.toLowerCase());
    }

    const targetIncubeId = inc ? inc.id : item.incube_id;

    // 2. Chercher la ligne existante pour ce mois et cette année
    let existing = await SuiviEngagement.findOne({
      where: {
        incube_id: targetIncubeId,
        mois: item.mois,
        annee: item.annee
      }
    });

    if (existing) {
      existing.moyenne_heures_presence = item.moyenne_heures_presence;
      if (item.taux_presence_formation !== null && item.taux_presence_formation !== undefined) {
        existing.taux_presence_formation = item.taux_presence_formation;
      }
      if (item.initiatives) existing.initiatives = item.initiatives;
      if (item.observations) existing.observations = item.observations;
      await existing.save();
      updated++;
    } else {
      await SuiviEngagement.create({
        incube_id: targetIncubeId,
        mois: item.mois,
        annee: item.annee,
        moyenne_heures_presence: item.moyenne_heures_presence,
        taux_presence_formation: item.taux_presence_formation,
        initiatives: item.initiatives || '',
        observations: item.observations || ''
      });
      created++;
    }
  }

  console.log(`✅ ${updated} lignes mises à jour, ${created} lignes créées dans suivi_engagement.`);
  console.log('🎉 Synchronisation de l\'engagement terminée avec succès !');
  process.exit(0);
}

syncEngagement().catch(err => {
  console.error('❌ Erreur lors de la synchronisation:', err);
  process.exit(1);
});
