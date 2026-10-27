const { sequelize, User } = require('./models');

async function main() {
  try {
    await sequelize.authenticate();
    console.log('====================================================');
    console.log('🔍 ANALYSE DE LA BASE DE DONNÉES — RÔLES DES COMPTES');
    console.log('====================================================\n');

    // 1. Récupération de tous les utilisateurs
    const users = await User.findAll({
      attributes: ['id', 'nom', 'prenom', 'email', 'role', 'type', 'actif'],
      order: [['id', 'ASC']]
    });

    if (users.length === 0) {
      console.log('⚠️ Aucun utilisateur trouvé dans la base.');
      process.exit(0);
    }

    console.log(`📋 ${users.length} utilisateur(s) trouvé(s) :\n`);
    users.forEach(u => {
      const isSuper = ['super_admin', 'administrateur', 'superadmin'].includes(u.role);
      const isAccomp = ['admin', 'accompagnateur', 'gestionnaire'].includes(u.role);
      const badge = isSuper ? '👑 SUPER ADMIN' : (isAccomp ? '🧑‍🏫 ACCOMPAGNATEUR' : '🚀 INCUBÉ');
      console.log(`  [ID: ${u.id}] ${badge.padEnd(20)} | ${u.email.padEnd(30)} | ${u.prenom} ${u.nom} (actif: ${u.actif})`);
    });

    console.log('\n----------------------------------------------------');

    // 2. Traitement d'un argument éventuel pour promouvoir un compte
    const target = process.argv[2];
    if (target) {
      let targetUser;
      if (!isNaN(target)) {
        targetUser = await User.findByPk(Number(target));
      } else {
        targetUser = await User.findOne({ where: { email: target.trim() } });
      }

      if (!targetUser) {
        console.log(`❌ Impossible de trouver l'utilisateur cible : "${target}"`);
      } else {
        targetUser.role = 'super_admin';
        await targetUser.save();
        console.log(`✅ SUCCÈS : Le compte [ID: ${targetUser.id}] ${targetUser.email} a été défini en "super_admin" !`);
      }
    } else {
      // 3. Vérification de sécurité : S'assurer qu'au moins 1 compte a le rôle super_admin
      const superAdmins = users.filter(u => ['super_admin', 'administrateur', 'superadmin'].includes(u.role));
      if (superAdmins.length === 0) {
        console.log('⚠️ ALERTE : Aucun Super Admin détecté !');
        const firstAdmin = users.find(u => u.id === 1 || u.email.startsWith('admin@')) || users[0];
        if (firstAdmin) {
          firstAdmin.role = 'super_admin';
          await firstAdmin.save();
          console.log(`✨ Promotion automatique de sécurité : [ID: ${firstAdmin.id}] ${firstAdmin.email} défini en "super_admin".`);
        }
      } else {
        console.log(`✅ Sécurité OK : ${superAdmins.length} compte(s) dispose(nt) des prérogatives Super Admin.`);
      }
    }

    console.log('\n====================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur de connexion ou d\'analyse :', err.message);
    process.exit(1);
  }
}

main();
