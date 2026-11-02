const { TourniquetUser, Incube, User } = require('../src/models');
const { Op } = require('sequelize');

async function syncTourniquetTypes() {
  const tUsers = await TourniquetUser.findAll();
  const incubes = await Incube.findAll();
  const users = await User.findAll();

  let updatedToIncube = 0;
  let updatedToAdmin = 0;

  for (const tu of tUsers) {
    const tuName = (tu.name || '').trim().toLowerCase();
    const tuBadge = String(tu.badge_id).trim();

    // 1. Check if user is staff / admin
    const matchedUser = users.find(u => {
      const uNom = `${u.prenom || ''} ${u.nom || ''}`.trim().toLowerCase();
      const uBadge = String(u.badge_id || '').trim();
      const uTBadge = String(u.tourniquet_badge_id || '').trim();
      return (uBadge && (uBadge === tuBadge)) || 
             (uTBadge && (uTBadge === tuBadge)) ||
             (tuName.length > 3 && (uNom.includes(tuName) || tuName.includes(uNom)));
    });

    if (matchedUser) {
      const staffRoles = ['super_admin', 'administrateur', 'superadmin', 'admin', 'accompagnateur', 'gestionnaire', 'consultant', 'coach'];
      if (staffRoles.includes(matchedUser.role) || matchedUser.type === 'Administration') {
        if (tu.type !== 'Administration') {
          console.log(`[Admin] Update ${tu.badge_id} (${tu.name}) -> Administration (${matchedUser.nom})`);
          tu.type = 'Administration';
          await tu.save();
          updatedToAdmin++;
          continue;
        }
      }
    }

    // 2. Check if user is incubé
    const matchedIncube = incubes.find(inc => {
      const incNom = (inc.nom_incube || '').trim().toLowerCase();
      const incBadge = String(inc.badge_id || '').trim();
      const incTBadge = String(inc.tourniquet_badge_id || '').trim();
      return (incBadge && incBadge === tuBadge) ||
             (incTBadge && incTBadge === tuBadge) ||
             (tuName.length > 3 && (incNom.includes(tuName) || tuName.includes(incNom)));
    });

    if (matchedIncube) {
      if (tu.type !== 'Incube' || tu.name !== matchedIncube.nom_incube) {
        console.log(`[Incube] Update ${tu.badge_id} (${tu.name}) -> Incube (${matchedIncube.nom_incube})`);
        tu.type = 'Incube';
        tu.name = matchedIncube.nom_incube;
        await tu.save();
        updatedToIncube++;
      }
    }
  }

  // Cas spécifique meryem badge 141
  const meryem141 = await TourniquetUser.findByPk('141');
  if (meryem141) {
    meryem141.name = 'Meryem AMAQRAN';
    meryem141.type = 'Incube';
    await meryem141.save();
    console.log('[Specifique] Badge 141 lié à Meryem AMAQRAN (Incube)');
  }

  console.log(`\nFin de la synchronisation :`);
  console.log(`- ${updatedToAdmin} mis à jour vers Administration`);
  console.log(`- ${updatedToIncube} mis à jour vers Incube`);
}

syncTourniquetTypes()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
