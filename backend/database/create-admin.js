/**
 * ============================================================
 * Script de création du premier administrateur
 * Exécuter avec: node database/create-admin.js ou npm run create-admin
 * ============================================================
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const { sequelize, User } = require('../src/models');

async function createAdmin() {
  try {
    await sequelize.sync({ alter: true });
    console.log('✅ Tables synchronisées');

    const hash = await bcrypt.hash('Admin@2024', 12);
    const [user, created] = await User.findOrCreate({
      where: { email: 'admin@cgs-incubateur.ma' },
      defaults: {
        nom: 'Administrateur',
        prenom: '',
        email: 'admin@cgs-incubateur.ma',
        mot_de_passe: hash,
        role: 'administrateur',
        actif: true,
      }
    });

    if (created) {
      console.log('✅ Administrateur créé avec succès !');
      console.log('   Email: admin@cgs-incubateur.ma');
      console.log('   Mot de passe: Admin@2024');
      console.log('   ⚠️  Changez le mot de passe après la première connexion !');
    } else {
      console.log('ℹ️  L\'administrateur existe déjà');
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  }
}

createAdmin();
