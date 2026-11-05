const { User } = require('../src/models');
const bcrypt = require('bcryptjs');

async function main() {
  const email = process.argv[2] ? process.argv[2].trim().toLowerCase() : 'ilham.lahboub@ctpes.ma';
  const newPassword = process.argv[3] ? process.argv[3].trim() : 'Admin@2024';

  console.log(`\n🔑 Réinitialisation de mot de passe pour : ${email}`);

  let user = await User.findOne({ where: { email } });
  if (!user) {
    console.error(`❌ Aucun utilisateur trouvé avec l'email : ${email}`);
    process.exit(1);
  }

  const hash = await bcrypt.hash(newPassword, 12);
  user.mot_de_passe = hash;
  user.actif = true;
  await user.save();

  console.log(`✅ Mot de passe réinitialisé avec succès !`);
  console.log(`👤 Utilisateur : ${user.prenom || ''} ${user.nom || ''} (ID: ${user.id}, Rôle: ${user.role})`);
  console.log(`📧 Email       : ${user.email}`);
  console.log(`🔒 Nouveau MDP : ${newPassword}`);
  console.log(`🟢 Statut      : Actif (compte débloqué)\n`);

  process.exit(0);
}

main().catch(err => {
  console.error('Erreur :', err);
  process.exit(1);
});
