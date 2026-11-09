const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000';
let token = '';

function request(method, reqPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(reqPath, BASE_URL);
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    };
    if (token) {
      reqHeaders['Authorization'] = `Bearer ${token}`;
    }

    const payload = body ? JSON.stringify(body) : null;
    if (payload) {
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = data ? JSON.parse(data) : {};
            resolve({ status: res.statusCode, headers: res.headers, body: parsed, raw: data });
          } catch (e) {
            resolve({ status: res.statusCode, headers: res.headers, raw: data });
          }
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const tests = [];
let passCount = 0;
let failCount = 0;

async function test(name, fn) {
  try {
    const info = await fn();
    passCount++;
    console.log(`  ✅ [PASS] ${name} ${info ? '(' + info + ')' : ''}`);
    tests.push({ name, passed: true, info });
  } catch (err) {
    failCount++;
    console.error(`  ❌ [FAIL] ${name} -> ${err.message}`);
    tests.push({ name, passed: false, error: err.message });
  }
}

async function runAllTests() {
  console.log('\n========================================================================');
  console.log('🧪 SUITE DE TESTS COMPLÈTE : VALIDATION DE TOUTES LES FONCTIONNALITÉS');
  console.log('========================================================================\n');

  // 1. HEALTH & CONNECTIVITÉ SERVEUR
  console.log('--- 1. Connectivité & Serveur ---');
  await test('Endpoint Health /api/health', async () => {
    const res = await request('GET', '/api/health');
    if (res.status !== 200 || res.body.status !== 'OK') {
      throw new Error(`Statut HTTP inattendu: ${res.status}`);
    }
    return `Statut HTTP 200, status: OK`;
  });

  await test('Distribution Frontend Statique (index.html)', async () => {
    const res = await request('GET', '/');
    if (res.status !== 200) throw new Error(`Code HTTP: ${res.status}`);
    const html = res.raw || '';
    if (!html.includes('id="root"')) {
      throw new Error('index.html ne contient pas la racine React');
    }
    return 'Frontend React compilé servi avec succès (SPA index.html actif)';
  });

  // 2. AUTHENTIFICATION & ROLES
  console.log('\n--- 2. Authentification & Sécurité ---');
  await test('Connexion Admin avec mot de passe', async () => {
    const res = await request('POST', '/api/auth/login', {
      email: 'admin@cgs-incubateur.ma',
      mot_de_passe: 'Admin@2024'
    });
    if (res.status !== 200 || !authTokenFrom(res)) {
      throw new Error(`Échec login: HTTP ${res.status}`);
    }
    token = authTokenFrom(res);
    return `Token généré pour ${res.body.user.email} (${res.body.user.role})`;
  });

  await test('Profil utilisateur connecté /api/auth/me', async () => {
    const res = await request('GET', '/api/auth/me');
    if (res.status !== 200 || !res.body.id) {
      throw new Error(`Échec auth/me: HTTP ${res.status}`);
    }
    return `Utilisateur ID ${res.body.id}: ${res.body.nom} ${res.body.prenom}`;
  });

  // 3. INCUBÉS & CHARGEMENT COMPLET DES RELATIONS
  console.log('\n--- 3. Fiches Incubés & Données Liées ---');
  let firstIncubeId = null;
  let fullIncube = null;

  await test('Récupération de la liste des incubés /api/incubes', async () => {
    const res = await request('GET', '/api/incubes');
    if (res.status !== 200 || !Array.isArray(res.body)) {
      throw new Error(`Réponse invalide: HTTP ${res.status}`);
    }
    if (res.body.length === 0) throw new Error('Aucun incubé dans la base');
    firstIncubeId = res.body[0].id;
    return `${res.body.length} incubé(s) répertorié(s)`;
  });

  await test(`Fiche complète incubé ID ${firstIncubeId} avec toutes ses relations`, async () => {
    const res = await request('GET', `/api/incubes/${firstIncubeId}`);
    if (res.status !== 200 || !res.body.id) {
      throw new Error(`Échec chargement: HTTP ${res.status}`);
    }
    fullIncube = res.body;

    const relations = ['materiels', 'finances', 'plans', 'fiches_suivi', 'engagements', 'personnel', 'emplois'];
    const loadedRelations = relations.filter(r => Array.isArray(fullIncube[r]));

    if (loadedRelations.length < relations.length) {
      const missing = relations.filter(r => !Array.isArray(fullIncube[r]));
      throw new Error(`Relations manquantes : ${missing.join(', ')}`);
    }

    return `Toutes les 7 relations incluses (Matériels: ${fullIncube.materiels.length}, Finances: ${fullIncube.finances.length}, Plans: ${fullIncube.plans.length}, Suivis: ${fullIncube.fiches_suivi.length})`;
  });

  // 4. RESSOURCES HUMAINES (DATE FIN OPTIONNELLE)
  console.log('\n--- 4. Ressources Humaines & Date Fin Optionnelle ---');
  let testPersonnelId = null;
  await test('Création salarié RH avec date_fin vide (doit persister en NULL)', async () => {
    const res = await request('POST', `/api/incubes/${firstIncubeId}/rh-detail`, {
      nom_complet: 'Test Salarié Trimestriel',
      cin: 'AB999888',
      poste: 'Développeur Fullstack',
      type_contrat: 'CDI',
      date_embauche: '2026-01-01',
      date_fin: '', // Chaîne vide = optionnelle
      cnss_declare: true
    });

    if (res.status !== 201) {
      throw new Error(`Code HTTP ${res.status}: ${JSON.stringify(res.body)}`);
    }
    testPersonnelId = res.body.id;
    if (res.body.date_fin !== null) {
      throw new Error(`date_fin devrait être null, reçu: ${res.body.date_fin}`);
    }
    return `Salarié créé ID ${testPersonnelId}, date_fin convertie en NULL avec succès`;
  });

  await test('Nettoyage du salarié RH test', async () => {
    if (!testPersonnelId) return 'Ignoré';
    const res = await request('DELETE', `/api/incubes/${firstIncubeId}/rh-detail/${testPersonnelId}`);
    if (res.status !== 200) throw new Error(`Code HTTP ${res.status}`);
    return `Salarié de test ID ${testPersonnelId} supprimé`;
  });

  // 5. VALIDATION DU CODE FRONTEND (ONGLETS, BANNIÈRE & PV TRIMESTRIEL)
  console.log('\n--- 5. Intégrité de l\'Interface Frontend ---');
  await test('ProfilIncube.jsx : Absence de l\'onglet Formations Suivies', async () => {
    const content = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/pages/ProfilIncube.jsx'), 'utf8');
    if (content.includes("'formations'") || content.includes('Formations Suivies')) {
      throw new Error('L\'onglet Formations Suivies est toujours présent dans ProfilIncube.jsx');
    }
    return 'L\'onglet Formations Suivies est bien retiré de la navigation';
  });

  await test('TabBadgeAcces.jsx : Présence de la Bannière ZKTeco sans Port 4370', async () => {
    const content = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/components/tabs/TabBadgeAcces.jsx'), 'utf8');
    if (!content.includes("Gestion des Badges RFID & Contrôle d'Accès ZKTeco")) {
      throw new Error('La bannière ZKTeco est absente');
    }
    if (content.includes('4370')) {
      throw new Error('La mention Port 4370 est toujours présente');
    }
    return 'Bannière ZKTeco active et Port 4370 masqué';
  });

  await test('TabFicheSuivi.jsx : Bouton PV Trimestriel & Modale 3 Mois', async () => {
    const content = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/components/tabs/TabFicheSuivi.jsx'), 'utf8');
    if (!content.includes('PV Trimestriel (3 Mois)')) {
      throw new Error('Bouton PV Trimestriel non trouvé');
    }
    if (!content.includes('showQuarterlyModal')) {
      throw new Error('Modale trimestrielle absente');
    }
    return 'Bouton et modale du PV Trimestriel en place';
  });

  await test('pdfExport.js : Moteur de génération du PV Trimestriel (6 Sections)', async () => {
    const content = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/utils/pdfExport.js'), 'utf8');
    if (!content.includes('generateQuarterlyPVDocument')) {
      throw new Error('Fonction generateQuarterlyPVDocument absente');
    }
    if (!content.includes('exportQuarterlyPVToPDF') || !content.includes('getQuarterlyPVBlobUrl')) {
      throw new Error('Fonctions d\'export ou blob URL trimestriel absentes');
    }
    return 'Moteur jsPDF trimestriel consolidé actif';
  });

  // 6. SYNCHRONISATION CLOUD & AUTO-VALIDATION ADMIN
  console.log('\n--- 6. Synchronisation Cloud & Auto-validation Admin ---');
  await test('SyncService.js : Logique d\'auto-validation admin et checklist', async () => {
    const content = fs.readFileSync(path.resolve(__dirname, '../src/services/SyncService.js'), 'utf8');
    if (!content.includes('String(ppNum).toUpperCase() === \'ADMIN\'')) {
      throw new Error('Détection ADMIN absente dans SyncService');
    }
    if (!content.includes('statut: targetStatut') || !content.includes('ChecklistMateriel.bulkCreate')) {
      throw new Error('Génération checklist ou assignation statut admin absente');
    }
    return 'Auto-validation admin et génération checklist matériel vérifiées';
  });

  await test('cloud/src/app.js : Anti-collision horaire 409 et invités externes', async () => {
    const content = fs.readFileSync(path.resolve(__dirname, '../../cloud/src/app.js'), 'utf8');
    if (!content.includes('checkConflictQuery') || !content.includes('status(409)')) {
      throw new Error('Vérification anti-collision 409 absente dans le cloud app.js');
    }
    if (!content.includes('officialPP = authRows[0].pp_numero')) {
      throw new Error('Résolution automatique du N° PP absente');
    }
    return 'Anti-collision 409 et résolution N° PP par email vérifiées';
  });

  // 7. GESTION DES PRÉSENCES & ÉMARGEMENT (CRUD)
  console.log('\n--- 7. Gestion des Présences & Émargement (CRUD) ---');
  await test('Consultation globale des présences /api/presence/all', async () => {
    const res = await request('GET', '/api/presence/all');
    if (res.status !== 200) {
      throw new Error(`Code HTTP: ${res.status}`);
    }
    const count = Array.isArray(res.body) ? res.body.length : (res.body.data?.length || 0);
    return `${count} présence(s) enregistrée(s)`;
  });

  await test('Supervision du tableau de bord d\'accès /api/presence/superadmin/dashboard', async () => {
    const res = await request('GET', '/api/presence/superadmin/dashboard');
    if (res.status !== 200) {
      throw new Error(`Code HTTP: ${res.status}`);
    }
    return `Statut HTTP 200, données de supervision accessibles`;
  });

  await test('Liste des ateliers / événements /api/ateliers', async () => {
    const res = await request('GET', '/api/ateliers');
    if (res.status !== 200 || !Array.isArray(res.body)) {
      throw new Error(`Code HTTP: ${res.status}`);
    }
    return `${res.body.length} atelier(s) configuré(s)`;
  });

  // 8. RÉSERVATIONS D'ESPACES (FABLAB / STUDIOS / SALLES)
  console.log('\n--- 8. Réservations d\'Espaces ---');
  await test('Consultation des réservations /api/reservations', async () => {
    const res = await request('GET', '/api/reservations');
    if (res.status !== 200 || !Array.isArray(res.body)) {
      throw new Error(`Code HTTP: ${res.status}`);
    }
    return `${res.body.length} réservation(s) répertoriée(s)`;
  });

  // BILAN FINAL
  console.log('\n========================================================================');
  console.log(`📊 RÉSULTAT DU CONTRÔLE : ${passCount} / ${passCount + failCount} TESTS RÉUSSIS`);
  if (failCount === 0) {
    console.log('🎉 100% DES TESTS SONT AU VERT ! AUCUNE ANOMALIE DÉTECTÉE.');
  } else {
    console.log(`⚠️ ${failCount} test(s) ont rencontré une anomalie.`);
  }
  console.log('========================================================================\n');
}

runAllTests().catch(console.error);

// Le serveur dépose le JWT dans le cookie httpOnly "ids_auth" (il n'est plus renvoyé dans le corps JSON)
function authTokenFrom(res) {
  const cookies = (res && res.headers && res.headers['set-cookie']) || [];
  const match = cookies.join(';').match(/(?:^|;\s*)ids_auth=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}
