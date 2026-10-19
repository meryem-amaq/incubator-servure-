'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Mise à jour de l'ENUM role dans la table users
    await queryInterface.sequelize.query(
      "ALTER TABLE `users` MODIFY COLUMN `role` ENUM('super_admin', 'admin', 'administrateur', 'gestionnaire', 'consultant', 'incube') NOT NULL DEFAULT 'admin'"
    );

    // 2. Ajout de la colonne user_id dans incubes si non existante
    const [cols] = await queryInterface.sequelize.query("SHOW COLUMNS FROM `incubes` LIKE 'user_id'");
    if (cols.length === 0) {
      await queryInterface.addColumn('incubes', 'user_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        unique: true,
        after: 'id',
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Supprimer la contrainte et la colonne user_id
    const [cols] = await queryInterface.sequelize.query("SHOW COLUMNS FROM `incubes` LIKE 'user_id'");
    if (cols.length > 0) {
      try {
        await queryInterface.removeConstraint('incubes', 'fk_incubes_user');
      } catch (e) {
        // Ignorer si le nom de contrainte diffère
      }
      await queryInterface.removeColumn('incubes', 'user_id');
    }

    // Réaffecter les comptes 'incube' avant de rétrécir l'ENUM
    await queryInterface.sequelize.query(
      "UPDATE `users` SET `role` = 'admin' WHERE `role` = 'incube'"
    );

    // Revenir à l'ancien ENUM
    await queryInterface.sequelize.query(
      "ALTER TABLE `users` MODIFY COLUMN `role` ENUM('super_admin', 'admin', 'administrateur', 'gestionnaire', 'consultant') NOT NULL DEFAULT 'admin'"
    );
  }
};
