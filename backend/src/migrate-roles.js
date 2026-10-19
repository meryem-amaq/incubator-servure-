const { sequelize } = require('./models');

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('✅ Base connectée.');

    // 1. Modifier la colonne role de users
    console.log('Mise à jour de l\'ENUM role dans users...');
    await sequelize.query(
      "ALTER TABLE `users` MODIFY COLUMN `role` ENUM('super_admin', 'admin', 'administrateur', 'gestionnaire', 'consultant') DEFAULT 'admin'"
    );

    // 2. Mettre l'utilisateur 1 en super_admin
    await sequelize.query("UPDATE `users` SET `role` = 'super_admin' WHERE `id` = 1");
    console.log('✅ Utilisateur ID 1 défini en super_admin.');

    // 3. Vérifier et ajouter la colonne admin_id dans incubes
    const [cols] = await sequelize.query("SHOW COLUMNS FROM `incubes` LIKE 'admin_id'");
    if (cols.length === 0) {
      console.log('Ajout de la colonne admin_id dans incubes...');
      await sequelize.query("ALTER TABLE `incubes` ADD COLUMN `admin_id` INT NULL AFTER `id`");
      try {
        await sequelize.query(
          "ALTER TABLE `incubes` ADD CONSTRAINT `fk_incubes_admin` FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE"
        );
      } catch (fkErr) {
        console.log('Note contrainte FK:', fkErr.message);
      }
      console.log('✅ Colonne admin_id ajoutée avec succès.');
    } else {
      console.log('ℹ️ Colonne admin_id déjà présente.');
    }

    // 4. Lier les incubés existants au super_admin (id: 1)
    await sequelize.query("UPDATE `incubes` SET `admin_id` = 1 WHERE `admin_id` IS NULL");
    console.log('✅ Incubés existants assignés à l\'administrateur ID 1.');

    console.log('🎉 Migration terminée avec succès.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur de migration :', err);
    process.exit(1);
  }
}

migrate();
