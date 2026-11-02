const { sequelize, User, TourniquetUser } = require('../src/models');

async function fixRolesAndTypes() {
  console.log('--- Correction des rôles et types des Administrateurs & Staff ---');

  // 1. Mettre à jour les comptes utilisateurs staff
  const staffRoles = ['super_admin', 'administrateur', 'superadmin', 'admin', 'accompagnateur', 'gestionnaire', 'consultant', 'coach'];
  
  const [updateUsersRes] = await sequelize.query(`
    UPDATE users 
    SET type = 'Administration' 
    WHERE role IN ('super_admin', 'administrateur', 'superadmin', 'admin', 'accompagnateur', 'gestionnaire', 'consultant', 'coach')
  `);
  console.log('✅ Comptes staff mis à jour avec type = "Administration" dans la table users.');

  // Mettre type = 'Incube' pour les incubés dans users
  await sequelize.query(`
    UPDATE users 
    SET type = 'Incube' 
    WHERE role IN ('incube', 'user')
  `);
  console.log('✅ Comptes incubés confirmés avec type = "Incube" dans la table users.');

  // 2. Mettre à jour TourniquetUser pour les membres de l'administration
  const staffUsers = await User.findAll({
    where: {
      role: staffRoles
    }
  });

  for (const su of staffUsers) {
    const fullName = `${su.prenom || ''} ${su.nom || ''}`.trim();
    if (su.badge_id) {
      await TourniquetUser.update(
        { type: 'Administration', name: fullName },
        { where: { badge_id: String(su.badge_id).trim() } }
      );
    }
  }

  // Badges spécifiques identifiés pour le staff
  const staffBadges = ['1', '143', '194', '7561307', '7587580'];
  for (const b of staffBadges) {
    await TourniquetUser.update(
      { type: 'Administration' },
      { where: { badge_id: b } }
    );
  }

  const tuByType = await TourniquetUser.findAll();
  const summary = {};
  tuByType.forEach(t => summary[t.type] = (summary[t.type] || 0) + 1);
  console.log('✅ Répartition actuelle dans tourniquet_users :', summary);

  process.exit(0);
}

fixRolesAndTypes().catch(err => {
  console.error('Erreur:', err);
  process.exit(1);
});
