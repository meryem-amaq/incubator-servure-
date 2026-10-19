const http = require('http');

const BASE_URL = 'http://localhost:5000';
let token = '';

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
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
            resolve({ status: res.statusCode, headers: res.headers, body: parsed });
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

const results = [];

async function runTest(category, name, testFn) {
  try {
    const res = await testFn();
    results.push({ category, name, passed: true, details: res });
    console.log(`  ✅ [${category}] ${name}`);
  } catch (err) {
    results.push({ category, name, passed: false, error: err.message });
    console.error(`  ❌ [${category}] ${name} -> ${err.message}`);
  }
}

async function main() {
  console.log('================================================================');
  console.log('🧪 TEST D\'AUDIT COMPLET DES FONCTIONNALITÉS API (BACKEND CGS)');
  console.log('================================================================\n');

  // 1. HEALTH & CONNECTIVITÉ
  await runTest('Santé', 'Vérification du endpoint /api/health', async () => {
    const res = await request('GET', '/api/health');
    if (res.status !== 200 || res.body.status !== 'OK') {
      throw new Error(`Statut inattendu: ${res.status}`);
    }
    return `Statut HTTP ${res.status}, status=${res.body.status}`;
  });

  // 2. AUTHENTIFICATION
  await runTest('Authentification', 'Tentative avec mauvais identifiants', async () => {
    const res = await request('POST', '/api/auth/login', {
      email: 'admin@cgs-incubateur.ma',
      mot_de_passe: 'MauvaisMotDePasse123!',
    });
    if (res.status !== 401) {
      throw new Error(`Code attendu 401, obtenu: ${res.status}`);
    }
    return 'Rejet 401 correct';
  });

  await runTest('Authentification', 'Connexion réussie (super_admin)', async () => {
    const res = await request('POST', '/api/auth/login', {
      email: 'admin@cgs-incubateur.ma',
      mot_de_passe: 'Admin@2024',
    });
    if (res.status !== 200 || !res.body.token) {
      throw new Error(`Échec connexion: ${res.status} - ${JSON.stringify(res.body)}`);
    }
    token = res.body.token;
    return `Token JWT reçu pour ${res.body.user?.email} (${res.body.user?.role})`;
  });

  await runTest('Authentification', 'Profil connecté /api/auth/me', async () => {
    const res = await request('GET', '/api/auth/me');
    if (res.status !== 200 || !res.body.id) {
      throw new Error(`Échec /api/auth/me: ${res.status}`);
    }
    return `Utilisateur identifié: ${res.body.nom} ${res.body.prenom}`;
  });

  // 3. GESTION DES UTILISATEURS
  let testUserId = null;
  await runTest('Utilisateurs', 'Liste des utilisateurs /api/users', async () => {
    const res = await request('GET', '/api/users');
    if (res.status !== 200 || !Array.isArray(res.body)) {
      throw new Error(`Statut attendu 200 avec tableau: ${res.status}`);
    }
    return `${res.body.length} utilisateur(s) trouvé(s)`;
  });

  await runTest('Utilisateurs', 'Création d\'un utilisateur de test /api/users', async () => {
    const testEmail = `test.audit.${Date.now()}@cgs.ma`;
    const res = await request('POST', '/api/users', {
      nom: 'Audit',
      prenom: 'Robot',
      email: testEmail,
      mot_de_passe: 'AuditPass2024!',
      role: 'administrateur',
      telephone: '0600000000',
    });
    if (res.status !== 201) {
      throw new Error(`Échec création: ${res.status} - ${JSON.stringify(res.body)}`);
    }
    testUserId = res.body.id;
    return `Utilisateur créé id=${testUserId}`;
  });

  if (testUserId) {
    await runTest('Utilisateurs', 'Suppression/Désactivation utilisateur test', async () => {
      const res = await request('DELETE', `/api/users/${testUserId}`);
      if (res.status !== 200) {
        throw new Error(`Échec suppression: ${res.status}`);
      }
      return 'Utilisateur nettoyé avec succès';
    });
  }

  // 4. INCUBÉS & DOSSIERS
  let firstIncubeId = null;
  await runTest('Incubés', 'Statistiques des incubés /api/incubes/stats', async () => {
    const res = await request('GET', '/api/incubes/stats');
    if (res.status !== 200) {
      throw new Error(`Échec stats: ${res.status}`);
    }
    return `Statistiques récupérées: ${JSON.stringify(res.body)}`;
  });

  await runTest('Incubés', 'Liste paginée des incubés /api/incubes', async () => {
    const res = await request('GET', '/api/incubes?page=1&limit=10');
    if (res.status !== 200) {
      throw new Error(`Échec liste: ${res.status}`);
    }
    const incubes = res.body.incubes || (Array.isArray(res.body) ? res.body : []);
    if (incubes.length > 0) {
      firstIncubeId = incubes[0].id;
    }
    return `${incubes.length} incubé(s) récupéré(s), total=${res.body.total || incubes.length}`;
  });

  if (firstIncubeId) {
    await runTest('Incubés', `Détail complet d'un incubé id=${firstIncubeId}`, async () => {
      const res = await request('GET', `/api/incubes/${firstIncubeId}`);
      if (res.status !== 200 || !res.body.id) {
        throw new Error(`Échec dossier: ${res.status}`);
      }
      return `Incubé: ${res.body.nom_incube} (PP: ${res.body.pp_numero || 'N/A'})`;
    });

    // Sub-modules tests
    await runTest('Incubés (Sous-module)', `Lecture Matériel pour incubé #${firstIncubeId}`, async () => {
      const res = await request('GET', `/api/incubes/${firstIncubeId}/materiel`);
      if (res.status !== 200 || !Array.isArray(res.body)) {
        throw new Error(`Échec lecture matériel: ${res.status}`);
      }
      return `${res.body.length} matériel(s) répertorié(s)`;
    });

    await runTest('Incubés (Sous-module)', `Lecture Engagement pour incubé #${firstIncubeId}`, async () => {
      const res = await request('GET', `/api/incubes/${firstIncubeId}/engagement`);
      if (res.status !== 200 || !Array.isArray(res.body)) {
        throw new Error(`Échec lecture engagement: ${res.status}`);
      }
      return `${res.body.length} engagement(s) répertorié(s)`;
    });

    await runTest('Incubés (Sous-module)', `Lecture RH Emploi pour incubé #${firstIncubeId}`, async () => {
      const res = await request('GET', `/api/incubes/${firstIncubeId}/rh-emploi`);
      if (res.status !== 200 || !Array.isArray(res.body)) {
        throw new Error(`Échec lecture rh-emploi: ${res.status}`);
      }
      return `${res.body.length} emploi(s) répertorié(s)`;
    });

    await runTest('Incubés (Sous-module)', `Lecture Plan d'action pour incubé #${firstIncubeId}`, async () => {
      const res = await request('GET', `/api/incubes/${firstIncubeId}/plan-action`);
      if (res.status !== 200 || !Array.isArray(res.body)) {
        throw new Error(`Échec lecture plan-action: ${res.status}`);
      }
      return `${res.body.length} plan(s) répertorié(s)`;
    });

    await runTest('Incubés (Sous-module)', `Lecture Analyse Financière pour incubé #${firstIncubeId}`, async () => {
      const res = await request('GET', `/api/incubes/${firstIncubeId}/analyse-financiere`);
      if (res.status !== 200 || !Array.isArray(res.body)) {
        throw new Error(`Échec lecture finance: ${res.status}`);
      }
      return `${res.body.length} entrée(s) financière(s) répertoriée(s)`;
    });
  }

  // 5. RENDEZ-VOUS / BOOKING
  let testRdvId = null;
  await runTest('Rendez-vous', 'Liste des rendez-vous /api/rendezvous', async () => {
    const res = await request('GET', '/api/rendezvous');
    if (res.status !== 200 || !Array.isArray(res.body)) {
      throw new Error(`Échec récupération RDV: ${res.status}`);
    }
    return `${res.body.length} RDV trouvés`;
  });

  await runTest('Rendez-vous', 'Création d\'un rendez-vous /api/rendezvous/creer', async () => {
    const res = await request('POST', '/api/rendezvous/creer', {
      sujet: 'Point mensuel d\'accompagnement Audit',
      dateRdv: '2026-10-15',
      heureRdv: '10:00',
      duree: '1h',
      lieu: 'Bureau Incubateur',
      incubeIds: firstIncubeId ? [firstIncubeId] : [],
      incubeNoms: 'Incubé Test Audit',
      accompagnateurNom: 'Accompagnateur IDS',
    });
    if (res.status !== 201 || !res.body.data) {
      throw new Error(`Échec création RDV: ${res.status} - ${JSON.stringify(res.body)}`);
    }
    testRdvId = res.body.data.id;
    return `RDV créé avec succès (id=${testRdvId})`;
  });

  if (testRdvId) {
    await runTest('Rendez-vous', 'Modification d\'un rendez-vous /api/rendezvous/:id', async () => {
      const res = await request('PUT', `/api/rendezvous/${testRdvId}`, {
        statut: 'effectue',
      });
      if (res.status !== 200) {
        throw new Error(`Échec modification: ${res.status}`);
      }
      return 'RDV mis à jour avec statut "effectue"';
    });

    await runTest('Rendez-vous', 'Suppression du rendez-vous test /api/rendezvous/:id', async () => {
      const res = await request('DELETE', `/api/rendezvous/${testRdvId}`);
      if (res.status !== 200) {
        throw new Error(`Échec suppression RDV: ${res.status}`);
      }
      return 'RDV test supprimé avec succès';
    });
  }

  // 6. GESTION DES ESPACES & RÉSERVATIONS
  let testResId = null;
  await runTest('Espaces & Réservations', 'Liste des réservations /api/reservations', async () => {
    const res = await request('GET', '/api/reservations');
    if (res.status !== 200 || !Array.isArray(res.body)) {
      throw new Error(`Échec récupération réservations: ${res.status}`);
    }
    return `${res.body.length} réservation(s) répertoriée(s)`;
  });

  await runTest('Espaces & Réservations', 'Demande de réservation /api/reservations/demande', async () => {
    const randomDay = String(Math.floor(Math.random() * 25) + 1).padStart(2, '0');
    const randomHour = String(Math.floor(Math.random() * 5) + 9).padStart(2, '0');
    const endHour = String(Number(randomHour) + 2).padStart(2, '0');
    const res = await request('POST', '/api/reservations/demande', {
      espace: 'fablab',
      dateReservation: `2099-10-${randomDay}`,
      heureDebut: `${randomHour}:00`,
      heureFin: `${endHour}:00`,
      duree: '2h',
      nomComplet: 'Audit Demandeur Test',
      email: 'demandeur.test@cgs.ma',
      telephone: '0612345678',
      motif: 'Prototypage impression 3D',
      equipementsUtilises: 'Imprimante 3D Prusa MK4',
    });
    if (res.status !== 201 || !res.body.reservation) {
      throw new Error(`Échec création réservation: ${res.status} - ${JSON.stringify(res.body)}`);
    }
    testResId = res.body.reservation.id;
    return `Réservation créée avec succès id=${testResId}`;
  });

  if (testResId) {
    await runTest('Espaces & Réservations', 'Validation de la réservation et simulation d\'email /api/reservations/:id/valider', async () => {
      const res = await request('PUT', `/api/reservations/${testResId}/valider`, {
        statut: 'valide',
      });
      if (res.status !== 200 || !res.body.success) {
        throw new Error(`Échec validation: ${res.status}`);
      }
      return 'Réservation validée et simulation email déclenchée';
    });

    await runTest('Espaces & Réservations', 'Enregistrement fiche état matériel /api/reservations/:id/etat', async () => {
      const res = await request('PUT', `/api/reservations/${testResId}/etat`, {
        etatAvant: 'Matériel en parfait état de fonctionnement',
        etatApres: 'Matériel rendu propre et fonctionnel',
      });
      if (res.status !== 200) {
        throw new Error(`Échec fiche état: ${res.status}`);
      }
      return 'Fiches état avant/après enregistrées';
    });

    await runTest('Espaces & Réservations', 'Nettoyage de la réservation de test', async () => {
      const { ReservationEspace } = require('../src/models');
      await ReservationEspace.destroy({ where: { id: testResId } });
      return `Réservation test id=${testResId} nettoyée`;
    });
  }

  // 7. ÉMARGEMENT & PRÉSENCES
  await runTest('Présences & Émargement', 'Route publique liste incubés pour QR code /api/presence/incubes', async () => {
    const res = await request('GET', '/api/presence/incubes');
    if (res.status !== 200 || !Array.isArray(res.body)) {
      throw new Error(`Échec /api/presence/incubes: ${res.status}`);
    }
    return `${res.body.length} incubé(s) disponibles pour scan QR`;
  });

  await runTest('Présences & Émargement', 'Enregistrement présence par QR /api/presence/enregistrer', async () => {
    const res = await request('POST', '/api/presence/enregistrer', {
      atelierId: 'test-atelier-audit',
      incubeId: '1',
      nom: 'Dupont',
      prenom: 'Jean',
      pp_numero: 'PP-TEST-001',
      present: true,
    });
    if (res.status !== 200 || !res.body.success) {
      throw new Error(`Échec enregistrement présence: ${res.status}`);
    }
    return 'Présence enregistrée avec succès';
  });

  await runTest('Présences & Émargement', 'Consultation présences atelier /api/presence/atelier/:id', async () => {
    const res = await request('GET', '/api/presence/atelier/test-atelier-audit');
    if (res.status !== 200 || !Array.isArray(res.body) || res.body.length === 0) {
      throw new Error(`Échec récupération présences atelier: ${res.status}`);
    }
    return `${res.body.length} présence(s) trouvée(s) pour l'atelier`;
  });

  await runTest('Présences & Émargement', 'Retrait de présence (marquage absent)', async () => {
    const res = await request('POST', '/api/presence/enregistrer', {
      atelierId: 'test-atelier-audit',
      incubeId: '1',
      present: false,
    });
    if (res.status !== 200 || !res.body.success) {
      throw new Error(`Échec retrait présence: ${res.status}`);
    }
    return 'Présence retirée avec succès';
  });

  console.log('\n================================================================');
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log(`🏁 RÉSULTATS API : ${passed}/${total} fonctionnalités validées avec succès !`);
  console.log('================================================================\n');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Erreur fatale test:', err);
  process.exit(1);
});
