require('dotenv').config();
const syncService = require('../src/services/SyncService');
const { sequelize } = require('../src/models');

async function main() {
  console.log('========================================================');
  console.log('📥 ASPIRATION MANUELLE DES RÉSERVATIONS DEPUIS HEROKU');
  console.log(`🌐 Relais Cloud: ${process.env.CLOUD_URL || 'https://ids-production-app-6aba82b6af10.herokuapp.com'}`);
  console.log('========================================================');

  try {
    await sequelize.authenticate();
    console.log('✅ Base de données locale connectée.');
    
    const result = await syncService.pullAndSync();
    console.log(`✅ Résultat : ${result.pulledReservations || 0} réservation(s) et ${result.pulledPresences || 0} présence(s) importée(s).`);
  } catch (err) {
    if (err.name === 'SequelizeConnectionRefusedError' || err.code === 'ECONNREFUSED' || (err.parent && err.parent.code === 'ECONNREFUSED')) {
      console.error('\n❌ ERREUR DE CONNEXION MYSQL :');
      console.error(`👉 Votre base de données MySQL locale n'est pas démarrée sur le port ${process.env.DB_PORT || 3306}.`);
      console.error('👉 Veuillez ouvrir XAMPP Control Panel et cliquer sur "Start" en face de MySQL.\n');
    } else {
      console.error('❌ Erreur lors de l\'aspiration des données :', err.message || err);
    }
  } finally {
    try {
      await sequelize.close();
    } catch (_) {}
    setTimeout(() => process.exit(0), 100);
  }
}

main();
