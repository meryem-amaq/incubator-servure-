const { User, TourniquetUser } = require('../src/models');
const bcrypt = require('bcryptjs');

const ADMINS_LIST = [
  {
    nom: 'Incubateur Digital Solidaire',
    prenom: 'Administration',
    email: 'incubateur.digital.solidaire@gmail.com',
    role: 'super_admin',
    type: 'Administration',
    badge_id: '145',
    all_badges: ['145', '7600900']
  },
  {
    nom: 'SEFIANI',
    prenom: 'Nadia',
    email: 'nadia.sefiani@ctpes.ma',
    role: 'admin',
    type: 'Administration',
    badge_id: '6',
    all_badges: ['6']
  },
  {
    nom: 'Mustapha',
    prenom: '',
    email: 'mustapha@ctpes.ma',
    role: 'admin',
    type: 'Administration',
    badge_id: '3',
    all_badges: ['3']
  },
  {
    nom: 'EL BOUCHIKHI',
    prenom: 'Ayoub',
    email: 'ayoub.elbouchikhi@ctpes.ma',
    role: 'admin',
    type: 'Administration',
    badge_id: '143',
    all_badges: ['143', '7587580']
  },
  {
    nom: 'LAHBOUB',
    prenom: 'Ilham',
    email: 'ilham.lahboub@ctpes.ma',
    role: 'admin',
    type: 'Administration',
    badge_id: '194',
    all_badges: ['194', '7561307']
  },
  {
    nom: 'BELAAZIZ',
    prenom: 'Hicham',
    email: 'hicham.belaaziz@ctpes.ma',
    role: 'super_admin',
    type: 'Administration',
    badge_id: '227',
    all_badges: ['227', '6883058']
  },
  {
    nom: 'SBAI',
    prenom: 'Kawtar',
    email: 'kawtar@ctpes.ma',
    role: 'admin',
    type: 'Administration',
    badge_id: '144',
    all_badges: ['144', '7568112']
  },
  {
    nom: 'EL AMRANI',
    prenom: 'Charaf',
    email: 'charaf@ctpes.ma',
    role: 'admin',
    type: 'Administration',
    badge_id: '205',
    all_badges: ['205', '7586646']
  },
  {
    nom: 'MEZZYANE',
    prenom: 'Amine',
    email: 'Aminemezzyane@gmail.com',
    role: 'admin',
    type: 'Administration',
    badge_id: '142',
    all_badges: ['142', '6895052']
  }
];

async function setupAllAdmins() {
  console.log('--- Démarrage de la mise à jour des Administrateurs ---');
  const defaultPasswordHash = await bcrypt.hash('IdsAdmin2024!', 12);

  // Nettoyage de l'ancien compte démo cgs
  await User.destroy({ where: { email: 'admin@cgs-incubateur.ma' } }).catch(() => {});

  for (const adm of ADMINS_LIST) {
    const fullName = `${adm.prenom} ${adm.nom}`.trim() || adm.nom;
    console.log(`\nTraitement : ${fullName} (${adm.email}) - Badge: #${adm.badge_id}`);

    // 1. Mettre à jour ou créer dans 'users'
    let user = await User.findOne({ where: { email: adm.email } });
    if (user) {
      user.nom = adm.nom;
      if (adm.prenom) user.prenom = adm.prenom;
      user.role = adm.role;
      user.type = 'Administration';
      user.badge_id = adm.badge_id;
      user.actif = true;
      await user.save();
      console.log(`  -> Compte User #${user.id} mis à jour avec rôle='${adm.role}', type='Administration', badge_id='${adm.badge_id}'`);
    } else {
      user = await User.create({
        nom: adm.nom,
        prenom: adm.prenom || 'Admin',
        email: adm.email,
        mot_de_passe: defaultPasswordHash,
        role: adm.role,
        type: 'Administration',
        badge_id: adm.badge_id,
        actif: true
      });
      console.log(`  -> Nouveau compte User #${user.id} créé avec succès (mot de passe initial: IdsAdmin2024!)`);
    }

    // 2. Mettre à jour ou insérer tous les badges correspondants dans 'tourniquet_users'
    for (const bId of adm.all_badges) {
      const [tu, created] = await TourniquetUser.findOrCreate({
        where: { badge_id: bId },
        defaults: {
          badge_id: bId,
          name: fullName,
          type: 'Administration',
          device_ip: '10.0.1.120'
        }
      });

      if (!created) {
        tu.name = fullName;
        tu.type = 'Administration';
        await tu.save();
        console.log(`  -> TourniquetUser badge #${bId} mis à jour : '${fullName}' -> Administration`);
      } else {
        console.log(`  -> TourniquetUser badge #${bId} créé : '${fullName}' -> Administration`);
      }
    }
  }

  console.log('\n--- Tous les administrateurs ont été configurés avec succès ! ---');
}

setupAllAdmins()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Erreur setupAllAdmins:', err);
    process.exit(1);
  });

