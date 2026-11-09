const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 5000;
const CDP_PORT = 9222;

const RESOLUTIONS = [
  { name: 'Mobile', width: 360, height: 800 },
  { name: 'Tablette Portrait', width: 768, height: 1024 },
  { name: 'Tablette Paysage / Laptop', width: 1024, height: 768 },
  { name: 'Laptop Standard', width: 1366, height: 768 },
  { name: 'Laptop HD', width: 1440, height: 900 },
  { name: 'Full HD Desktop', width: 1920, height: 1080 }
];

const PAGES_TO_TEST = [
  { route: '/dashboard', label: 'Dashboard & Graphiques' },
  { route: '/incubes', label: 'Annuaire des Incubés' },
  { route: '/incubes/1', label: 'Profil Incubé & Onglets' },
  { route: '/controle-acces', label: 'Contrôle d\'Accès & Tourniquets' },
  { route: '/booking', label: 'Calendrier & Réservations RDV' },
  { route: '/evenements', label: 'Ateliers & Événements' },
  { route: '/espaces', label: 'Gestion des Espaces' }
];

// Simple HTTP request helper
function postJSON(url, data) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const postData = JSON.stringify(data);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) }); }
        catch (e) { resolve({ status: res.statusCode, headers: res.headers, body }); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function getJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { resolve(body); }
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = err => reject(err);
      this.ws.onmessage = evt => {
        const msg = JSON.parse(evt.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const cb = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) cb.reject(new Error(msg.error.message));
          else cb.resolve(msg.result);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = this.id++;
      this.callbacks.set(msgId, { resolve, reject });
      this.ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch(e) {}
    }
  }
}

async function run() {
  console.log('================================================================');
  console.log('🧪 SUITE DE VALIDATION RESPONSIVE DESIGN (6 RÉSOLUTIONS EXIGÉES)');
  console.log('================================================================\n');

  // 1. Login API
  console.log('1. Authentification Super Admin...');
  const loginRes = await postJSON(`http://localhost:${PORT}/api/auth/login`, {
    email: 'admin@cgs-incubateur.ma',
    mot_de_passe: 'Admin@2024'
  });
  if (loginRes.status !== 200 || !authTokenFrom(loginRes)) {
    throw new Error(`Échec login: status=${loginRes.status}`);
  }
  const token = authTokenFrom(loginRes);
  const user = loginRes.body.user;
  console.log(`✅ Connecté en tant que: ${user.email} (rôle: ${user.role})`);

  // 2. Launch Edge CDP
  const tempDir = path.join(process.env.TEMP || 'C:\\Windows\\Temp', 'edge-responsive-test-' + Date.now());
  fs.mkdirSync(tempDir, { recursive: true });

  console.log('\n2. Démarrage de Microsoft Edge en mode Headless (CDP Port 9222)...');
  const edgeProc = spawn(EDGE_PATH, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${tempDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-sync',
    'about:blank'
  ]);

  // Wait 1.5s for CDP port
  await new Promise(r => setTimeout(r, 1500));

  let cdp;
  try {
    const targets = await getJSON(`http://127.0.0.1:${CDP_PORT}/json/list`);
    const pageTarget = targets.find(t => t.type === 'page') || targets[0];
    if (!pageTarget) throw new Error('Aucun onglet Edge détecté');

    cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();
    console.log('✅ Connecté au navigateur via WebSocket CDP');

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');

    // Naviguer sur l'app
    await cdp.send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await new Promise(r => setTimeout(r, 1000));

    // Injecter le token dans localStorage
    await cdp.send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('cgs_token', ${JSON.stringify(token)});
        localStorage.setItem('cgs_user', ${JSON.stringify(JSON.stringify(user))});
        location.reload();
      `
    });
    await new Promise(r => setTimeout(r, 1500));

    // 3. Tester chaque résolution
    const summary = [];

    for (const res of RESOLUTIONS) {
      console.log(`\n----------------------------------------------------------------`);
      console.log(`📱 TEST RÉSOLUTION : ${res.name} (${res.width} × ${res.height})`);
      console.log(`----------------------------------------------------------------`);

      // Émuler la résolution exacte
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: res.width,
        height: res.height,
        deviceScaleFactor: 1,
        mobile: res.width < 768
      });
      await cdp.send('Emulation.setVisibleSize', { width: res.width, height: res.height });

      for (const page of PAGES_TO_TEST) {
        await cdp.send('Page.navigate', { url: `http://localhost:${PORT}${page.route}` });
        // Attendre rendu React et Graphiques
        await new Promise(r => setTimeout(r, 800));

        // Mesurer scrollWidth, innerWidth et débordements
        const evalResult = await cdp.send('Runtime.evaluate', {
          expression: `
            (() => {
              const innerW = window.innerWidth;
              const scrollW = document.documentElement.scrollWidth;
              const hasOverflow = scrollW > innerW;
              
              // Détecter éléments qui dépassent l'écran
              const elements = Array.from(document.querySelectorAll('*'));
              const overflowingEls = elements.filter(el => {
                const rect = el.getBoundingClientRect();
                return rect.right > innerW + 2 && rect.width > 0;
              }).map(el => ({
                tag: el.tagName,
                cls: (el.className && typeof el.className === 'string') ? el.className.slice(0, 50) : '',
                right: Math.round(el.getBoundingClientRect().right)
              })).slice(0, 3);

              // Graphiques (Canvas et SVG)
              const canvases = Array.from(document.querySelectorAll('canvas')).map(c => ({
                width: c.width,
                height: c.height
              }));

              const svgs = Array.from(document.querySelectorAll('svg')).map(s => ({
                width: s.clientWidth,
                height: s.clientHeight
              }));

              return {
                innerW,
                scrollW,
                hasOverflow,
                overflowCount: overflowingEls.length,
                overflowingEls,
                chartsCount: canvases.length,
                validCharts: canvases.filter(c => c.width > 0 && c.height > 0).length,
                svgCount: svgs.length
              };
            })()
          `,
          returnByValue: true
        });

        const data = evalResult.result.value;
        const pass = !data.hasOverflow;
        const chartStatus = data.chartsCount > 0 ? `${data.validCharts}/${data.chartsCount} charts OK` : 'No chart';

        console.log(`  ${pass ? '✅' : '❌'} [${res.width}x${res.height}] ${page.label.padEnd(30)} : scrollW=${data.scrollW}px, innerW=${data.innerW}px (${chartStatus})`);

        if (!pass) {
          console.log(`     ⚠️ Débordement détecté sur:`, JSON.stringify(data.overflowingEls));
        }

        summary.push({
          resolution: `${res.width}x${res.height}`,
          resName: res.name,
          route: page.route,
          label: page.label,
          pass,
          scrollW: data.scrollW,
          innerW: data.innerW,
          charts: chartStatus
        });
      }
    }

    console.log('\n================================================================');
    console.log('📊 BILAN FINAL DU TEST RESPONSIVE SUR LES 6 RÉSOLUTIONS');
    console.log('================================================================');
    const totalTests = summary.length;
    const passedTests = summary.filter(s => s.pass).length;
    console.log(`Résultats globaux : ${passedTests} / ${totalTests} tests réussis (${Math.round(passedTests/totalTests*100)}% de succès)`);

    if (passedTests === totalTests) {
      console.log('🎉 TOUS LES TESTS SONT AU VERT ! 0 DÉBORDEMENT HORIZONTAL SUR TOUTES LES MACHINES.');
    } else {
      console.log(`⚠️ ${totalTests - passedTests} test(s) présentent un léger débordement.`);
    }

  } catch(err) {
    console.error('Erreur test responsive:', err);
  } finally {
    if (cdp) cdp.close();
    try {
      edgeProc.kill('SIGKILL');
    } catch(e) {}
    // Clean temp
    setTimeout(() => {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch(e) {}
    }, 1000);
  }
}

run();


// Le serveur dépose le JWT dans le cookie httpOnly "ids_auth" (il n'est plus renvoyé dans le corps JSON)
function authTokenFrom(res) {
  const cookies = (res && res.headers && res.headers['set-cookie']) || [];
  const match = cookies.join(';').match(/(?:^|;\s*)ids_auth=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}
