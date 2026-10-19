const { sequelize } = require('../src/models');

async function migrate() {
  try {
    const [cols] = await sequelize.query("SHOW COLUMNS FROM `incubes` LIKE 'email'");
    if (cols.length === 0) {
      await sequelize.query("ALTER TABLE `incubes` ADD COLUMN `email` VARCHAR(150) NULL AFTER `nom_incube`");
      console.log('✅ Colonne email ajoutée à la table incubes');
    } else {
      console.log('ℹ️ Colonne email déjà présente');
    }

    const [telCols] = await sequelize.query("SHOW COLUMNS FROM `incubes` LIKE 'telephone'");
    if (telCols.length === 0) {
      await sequelize.query("ALTER TABLE `incubes` ADD COLUMN `telephone` VARCHAR(50) NULL AFTER `email`");
      console.log('✅ Colonne telephone ajoutée à la table incubes');
    } else {
      console.log('ℹ️ Colonne telephone déjà présente');
    }

    // Mettre à jour les incubés existants sans email si une variable d'environnement de test est fournie
    const defaultEmail = process.env.DEFAULT_INCUBE_EMAIL || null;
    if (defaultEmail) {
      await sequelize.query("UPDATE `incubes` SET `email` = :defaultEmail WHERE `email` IS NULL OR `email` = ''", {
        replacements: { defaultEmail }
      });
      console.log(`✅ Incubés existants mis à jour avec ${defaultEmail}`);
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur migration:', err);
    process.exit(1);
  }
}

migrate();
