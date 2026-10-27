require('dotenv').config();
const { syncWhitelistCloud } = require('../src/controllers/incubeController');
const { sequelize } = require('../src/models');

async function main() {
  console.log('========================================================');
  console.log('🚀 ENVOI MANUEL DE LA LISTE BLANCHE VERS LE RELAIS HEROKU');
  console.log(`🌐 Relais Cloud: ${process.env.CLOUD_URL || 'https://ids-production-app-6aba82b6af10.herokuapp.com'}`);
  console.log('========================================================');

  try {
    await sequelize.authenticate();
    console.log('✅ Base de données locale connectée.');
    
    // Forcer temporairement ACTIVER_SYNC_CLOUD si pas mis
    process.env.ACTIVER_SYNC_CLOUD = 'true';
    await syncWhitelistCloud();
    console.log('🎉 Synchronisation de la liste blanche terminée avec succès.');
  } catch (err) {
    if (err.name === 'SequelizeConnectionRefusedError' || err.code === 'ECONNREFUSED' || (err.parent && err.parent.code === 'ECONNREFUSED')) {
      console.error('\n❌ ERREUR DE CONNEXION MYSQL :');
      console.error(`👉 Votre base de données MySQL locale n'est pas démarrée sur le port ${process.env.DB_PORT || 3306}.`);
      console.error('👉 Veuillez ouvrir XAMPP Control Panel et cliquer sur "Start" en face de MySQL.\n');
    } else {
      console.error('❌ Erreur lors de la synchronisation de la liste blanche :', err.message || err);
    }
  } finally {
    try {
      await sequelize.close();
    } catch (_) {}
    setTimeout(() => process.exit(0), 100);
  }
}

main();
