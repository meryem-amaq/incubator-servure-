/**
 * Script pour injecter les pointages manquants du 1er au 18 octobre dans la table attendances du serveur
 * afin que le calcul automatique d'octobre atteigne 72h pour Meryem et soit complet pour tous les incubés.
 * 
 * Usage sur le serveur :
 * cd /var/www/incubateur-cgs/backend && node scripts/sync-october-attendances.js
 */

const path = require('path');
const fs = require('fs');
const { Attendance, Incube } = require('../src/models');
const tourniquetService = require('../src/services/tourniquetService');

async function importScans() {
  console.log('🚀 Démarrage de l\'import des pointages d\'octobre manquants...');
  const dataPath = path.join(__dirname, 'octoberAttendancesData.json');
  if (!fs.existsSync(dataPath)) {
    throw new Error('Fichier introuvable: ' + dataPath);
  }
  const scans = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  console.log(`📋 ${scans.length} pointages à vérifier/insérer...`);

  let inserted = 0;
  for (const s of scans) {
    const existing = await Attendance.findOne({
      where: {
        raw_badge_id: s.raw_badge_id,
        time: s.time
      }
    });

    if (!existing) {
      await Attendance.create({
        user_id: s.user_id,
        raw_badge_id: s.raw_badge_id,
        time: s.time,
        type: s.type,
        device_ip: s.device_ip
      });
      inserted++;
    }
  }
  console.log(`✅ ${inserted} nouveaux pointages insérés sans aucun doublon.`);

  // Recalculer l'engagement pour Meryem AMAQRAN
  console.log('🔄 Recalcul automatique de l\'engagement pour Meryem AMAQRAN...');
  const meryem = await Incube.findOne({ where: { nom_incube: 'Meryem AMAQRAN' } });
  if (meryem) {
    const res = await tourniquetService.syncIncubeTourniquet(meryem.id, 2026);
    console.log(`✨ Octobre pour Meryem est maintenant certifié à : ${res.monthlyHours.Octobre} h (${res.metrics.moisTaux}%) !`);
  }

  console.log('🎉 Terminé avec succès !');
  process.exit(0);
}

importScans().catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
