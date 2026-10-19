const jwt = require('jsonwebtoken');
const { sequelize, User, Incube } = require('../src/models');
const authorizeIncube = require('../src/middleware/authorizeIncube');
const incubeCtrl = require('../src/controllers/incubeController');

async function runTests() {
  console.log('🚀 Démarrage des tests RBAC Incubé & Liaison Users...');
  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      testsPassed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      testsFailed++;
    }
  }

  try {
    await sequelize.authenticate();

    // 1. Vérification des modèles Sequelize
    console.log('\n--- 1. Vérification des modèles et associations ---');
    assert(User.rawAttributes.role.values.includes('incube'), 'User.role ENUM inclut bien "incube"');
    assert(Incube.rawAttributes.user_id !== undefined, 'Incube possède bien l\'attribut user_id');
    assert(User.associations.porteurProjet !== undefined, 'Association User.hasOne(Incube as porteurProjet) active');
    assert(Incube.associations.compteUtilisateur !== undefined, 'Association Incube.belongsTo(User as compteUtilisateur) active');

    // 2. Test du Middleware authorizeIncube
    console.log('\n--- 2. Tests unitaires du middleware authorizeIncube ---');

    // Cas A : Pas d'authentification
    let resCode = null;
    let resJson = null;
    const mockRes = () => ({
      status: (code) => {
        resCode = code;
        return {
          json: (data) => { resJson = data; }
        };
      }
    });

    const reqUnauth = { headers: {} };
    let nextCalled = false;
    authorizeIncube(reqUnauth, mockRes(), () => { nextCalled = true; });
    assert(resCode === 401 && !nextCalled, 'Refus 401 si non authentifié');

    // Cas B : Authentifié mais mauvais rôle (ex: admin)
    resCode = null;
    nextCalled = false;
    const reqAdmin = { user: { id: 1, role: 'admin', pp_id: null }, params: {} };
    authorizeIncube(reqAdmin, mockRes(), () => { nextCalled = true; });
    assert(resCode === 403 && !nextCalled, 'Refus 403 si rôle !== incube');

    // Cas C : Rôle incube mais sans pp_id
    resCode = null;
    nextCalled = false;
    const reqNoPp = { user: { id: 99, role: 'incube', pp_id: null }, params: {} };
    authorizeIncube(reqNoPp, mockRes(), () => { nextCalled = true; });
    assert(resCode === 403 && !nextCalled, 'Refus 403 si pas de pp_id associé');

    // Cas D : Tentative d'usurpation IDOR (:id = 999 alors que pp_id = 5)
    resCode = null;
    nextCalled = false;
    const reqIdor = { user: { id: 10, role: 'incube', pp_id: 5 }, params: { id: '999' } };
    authorizeIncube(reqIdor, mockRes(), () => { nextCalled = true; });
    assert(resCode === 403 && !nextCalled, 'Refus 403 si tentative d\'accès à un autre dossier (Anti-IDOR : params.id != req.user.pp_id)');

    // Cas E : Accès autorisé avec son propre ID (:id = 5 et pp_id = 5)
    resCode = null;
    nextCalled = false;
    const reqOwn = { user: { id: 10, role: 'incube', pp_id: 5 }, params: { id: '5' } };
    authorizeIncube(reqOwn, mockRes(), () => { nextCalled = true; });
    assert(nextCalled === true && reqOwn.incubeId === 5, 'Succès (next appelé) quand params.id correspond à req.user.pp_id');

    // Cas F : Accès sans paramètre d'URL (ex: /mon-profil)
    resCode = null;
    nextCalled = false;
    const reqMonProfil = { user: { id: 10, role: 'incube', pp_id: 5 }, params: {} };
    authorizeIncube(reqMonProfil, mockRes(), () => { nextCalled = true; });
    assert(nextCalled === true && reqMonProfil.incubeId === 5, 'Succès (next appelé) pour requête sans params ciblant ses propres données');

    // 3. Test contrôleur getMonProfil avec un incubé en base (ou fixture)
    console.log('\n--- 3. Test du contrôleur getMonProfil ---');
    let targetIncube = await Incube.findOne();
    let isFixture = false;
    if (!targetIncube) {
      targetIncube = await Incube.create({
        nom_incube: 'Test Porteur',
        pp_numero: 'PP-TEST-FIXTURE',
        statut_juridique: 'SARL'
      });
      isFixture = true;
    }

    let controllerJson = null;
    const reqCtrl = {
      user: { id: 999, role: 'incube', pp_id: targetIncube.id },
      incubeId: targetIncube.id
    };
    const resCtrl = {
      status: (code) => ({
        json: (data) => { controllerJson = { code, data }; }
      }),
      json: (data) => { controllerJson = { code: 200, data }; }
    };

    try {
      await incubeCtrl.getMonProfil(reqCtrl, resCtrl);
      assert(controllerJson && controllerJson.code === 200, 'getMonProfil renvoie bien le code 200');
      assert(controllerJson && controllerJson.data.id === targetIncube.id, 'getMonProfil retourne les données exactes du PP ciblé par le token');
    } finally {
      if (isFixture) {
        await targetIncube.destroy();
      }
    }

    console.log(`\n========================================`);
    console.log(`Résultats des tests : ${testsPassed} réussis, ${testsFailed} échoués`);
    console.log(`========================================\n`);

    if (testsFailed > 0) {
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur inattendue pendant les tests :', err);
    process.exit(1);
  }
}

runTests();
