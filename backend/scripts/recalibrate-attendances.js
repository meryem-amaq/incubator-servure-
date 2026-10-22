const { Attendance, sequelize } = require('../src/models');

/**
 * Recalibre tous les pointages dans la base de données de manière 100% déterministe:
 * 1. Groupe les pointages par badge et par jour calendaire (YYYY-MM-DD).
 * 2. Élimine les doublons de passage (< 60 secondes).
 * 3. Assigne strictement : 1er scan du jour = IN, 2e = OUT, 3e = IN, 4e = OUT...
 * Ne devine JAMAIS l'ordre en fonction d'un jour passé.
 */
async function recalibrateAllAttendances() {
  console.log('🔄 Démarrage de la recalibration déterministe des pointages...');

  const allScans = await Attendance.findAll({
    order: [['time', 'ASC']],
    raw: true
  });

  console.log(`📊 Total de scans trouvés : ${allScans.length}`);

  // Grouper par badge et par date calendaire locale
  const groups = {}; // 'badge_YYYY-MM-DD' -> [scans]
  for (const s of allScans) {
    const d = new Date(s.time);
    const dStr = d.toISOString().split('T')[0];
    const key = `${s.raw_badge_id}_${dStr}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  }

  const idsToDelete = [];
  const updatesToIn = [];
  const updatesToOut = [];

  for (const [key, scans] of Object.entries(groups)) {
    // Trier chronologiquement
    scans.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    let expectedDir = 'IN';
    let lastAcceptedTime = 0;

    for (let i = 0; i < scans.length; i++) {
      const s = scans[i];
      const t = new Date(s.time).getTime();

      // Règle anti-rebond : scans < 60s sont des doublons accidentels de passage
      if (lastAcceptedTime > 0 && (t - lastAcceptedTime) < 60000) {
        idsToDelete.push(s.id);
        continue;
      }

      // Scan valide et distinct
      lastAcceptedTime = t;
      const targetType = expectedDir;
      expectedDir = (expectedDir === 'IN') ? 'OUT' : 'IN';

      if (s.type !== targetType) {
        if (targetType === 'IN') {
          updatesToIn.push(s.id);
        } else {
          updatesToOut.push(s.id);
        }
      }
    }
  }

  console.log(`🗑️ Doublons accidentels (< 60s) à supprimer : ${idsToDelete.length}`);
  console.log(`⬆️ Pointages à corriger vers 'IN' : ${updatesToIn.length}`);
  console.log(`⬇️ Pointages à corriger vers 'OUT' : ${updatesToOut.length}`);

  const transaction = await sequelize.transaction();
  try {
    // 1. Supprimer les doublons en paquets
    const { Op } = require('sequelize');
    if (idsToDelete.length > 0) {
      const chunkSize = 500;
      for (let i = 0; i < idsToDelete.length; i += chunkSize) {
        const chunk = idsToDelete.slice(i, i + chunkSize);
        await Attendance.destroy({
          where: { id: { [Op.in]: chunk } },
          transaction
        });
      }
    }

    // 2. Mettre à jour vers IN
    if (updatesToIn.length > 0) {
      const chunkSize = 500;
      for (let i = 0; i < updatesToIn.length; i += chunkSize) {
        const chunk = updatesToIn.slice(i, i + chunkSize);
        await Attendance.update({ type: 'IN' }, {
          where: { id: { [Op.in]: chunk } },
          transaction
        });
      }
    }

    // 3. Mettre à jour vers OUT
    if (updatesToOut.length > 0) {
      const chunkSize = 500;
      for (let i = 0; i < updatesToOut.length; i += chunkSize) {
        const chunk = updatesToOut.slice(i, i + chunkSize);
        await Attendance.update({ type: 'OUT' }, {
          where: { id: { [Op.in]: chunk } },
          transaction
        });
      }
    }

    await transaction.commit();
    console.log('✅ Recalibration déterministe terminée et validée avec succès !');

    return {
      success: true,
      totalScans: allScans.length,
      duplicatesRemoved: idsToDelete.length,
      correctedToIn: updatesToIn.length,
      correctedToOut: updatesToOut.length
    };
  } catch (err) {
    await transaction.rollback();
    console.error('❌ Erreur lors de la recalibration:', err.message);
    throw err;
  }
}

if (require.main === module) {
  recalibrateAllAttendances()
    .then(res => {
      console.log('Résultat final:', res);
      process.exit(0);
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { recalibrateAllAttendances };
