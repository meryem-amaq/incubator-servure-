const { sequelize } = require('../src/models');

async function migrate() {
  try {
    // 1. Modifier la colonne `espace` pour être VARCHAR(100) afin d'accepter toutes les salles sans blocage ENUM
    await sequelize.query("ALTER TABLE `reservation_espace` MODIFY COLUMN `espace` VARCHAR(100) NOT NULL DEFAULT 'fablab'");
    console.log('✅ Colonne espace passée en VARCHAR(100)');

    // 2. Ajouter la colonne `salle_specifique` si elle n'existe pas encore
    const [cols] = await sequelize.query("SHOW COLUMNS FROM `reservation_espace` LIKE 'salle_specifique'");
    if (cols.length === 0) {
      await sequelize.query("ALTER TABLE `reservation_espace` ADD COLUMN `salle_specifique` VARCHAR(100) NULL AFTER `espace`");
      console.log('✅ Colonne salle_specifique ajoutée à reservation_espace');
    } else {
      console.log('ℹ️ Colonne salle_specifique déjà présente');
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur migration reservation_espace:', err);
    process.exit(1);
  }
}

migrate();
