const { sequelize } = require('../src/models');

async function migrate() {
  try {
    const [cols] = await sequelize.query("SHOW COLUMNS FROM `gestion_materiel` LIKE 'numero_serie'");
    if (cols.length === 0) {
      await sequelize.query("ALTER TABLE `gestion_materiel` ADD COLUMN `numero_serie` VARCHAR(150) NULL AFTER `article`");
      console.log('✅ Colonne numero_serie ajoutée avec succès à la table gestion_materiel');
    } else {
      console.log('ℹ️ Colonne numero_serie déjà présente dans gestion_materiel');
    }
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur migration gestion_materiel:', err.message);
    process.exit(1);
  }
}

migrate();
