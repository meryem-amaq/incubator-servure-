const { sequelize } = require('../src/models');

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connexion à la base de données établie.');

    // 1. Mettre à jour l'ENUM role dans la table users pour inclure 'incube'
    console.log('🔄 Mise à jour de la colonne `role` dans `users`...');
    await sequelize.query(
      "ALTER TABLE `users` MODIFY COLUMN `role` ENUM('super_admin', 'admin', 'administrateur', 'gestionnaire', 'consultant', 'incube') NOT NULL DEFAULT 'admin'"
    );
    console.log('✅ Rôle `incube` ajouté à l\'ENUM de la table `users`.');

    // 2. Vérifier si la colonne user_id existe dans incubes
    const [cols] = await sequelize.query("SHOW COLUMNS FROM `incubes` LIKE 'user_id'");
    if (cols.length === 0) {
      console.log('🔄 Ajout de la colonne `user_id` dans la table `incubes`...');
      await sequelize.query("ALTER TABLE `incubes` ADD COLUMN `user_id` INT NULL AFTER `id`");
      console.log('✅ Colonne `user_id` ajoutée.');

      // Ajouter la contrainte d'unicité (1 utilisateur = 1 dossier porteur de projet)
      try {
        console.log('🔄 Ajout de la contrainte UNIQUE sur `incubes(user_id)`...');
        await sequelize.query("ALTER TABLE `incubes` ADD CONSTRAINT `uq_incubes_user_id` UNIQUE (`user_id`)");
        console.log('✅ Contrainte UNIQUE `uq_incubes_user_id` créée.');
      } catch (uqErr) {
        console.warn('⚠️ Avertissement contrainte UNIQUE :', uqErr.message);
      }

      // Ajouter la clé étrangère vers users(id)
      try {
        console.log('🔄 Ajout de la clé étrangère `fk_incubes_user`...');
        await sequelize.query(
          "ALTER TABLE `incubes` ADD CONSTRAINT `fk_incubes_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE"
        );
        console.log('✅ Clé étrangère `fk_incubes_user` créée avec succès.');
      } catch (fkErr) {
        console.warn('⚠️ Avertissement clé étrangère :', fkErr.message);
      }
    } else {
      console.log('ℹ️ Colonne `user_id` déjà présente dans `incubes`.');
    }

    console.log('🎉 Migration de liaison users <-> incubes terminée avec succès !');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur lors de la migration :', err);
    process.exit(1);
  }
}

migrate();
