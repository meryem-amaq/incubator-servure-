const { spawn } = require('child_process');
const http = require('http');

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
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) }));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function test() {
  const loginRes = await postJSON('http://localhost:5000/api/auth/login', {
    email: 'admin@cgs-incubateur.ma',
    mot_de_passe: 'Admin@2024'
  });
  const token = authTokenFrom(loginRes);
  const user = loginRes.body.user;

  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9223',
    '--user-data-dir=' + process.env.TEMP + '\\edge-test-flex',
    'http://localhost:5000/login'
  ]);
  await new Promise(r => setTimeout(r, 2000));

  const list = await new Promise(res => {
    http.get('http://127.0.0.1:9223/json/list', r => {
      let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b)));
    });
  });

  const pageTarget = list.find(t => t.type === 'page' && !t.url.startsWith('chrome-extension'));
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  function send(method, params = {}) {
    return new Promise(res => {
      const id = Math.floor(Math.random() * 100000);
      const onMsg = evt => {
        const d = JSON.parse(evt.data);
        if (d.id === id) { ws.removeEventListener('message', onMsg); res(d.result); }
      };
      ws.addEventListener('message', onMsg);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');

  // Set viewport to 1366 x 768
  await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setVisibleSize', { width: 1366, height: 768 });
  
  // Login in localStorage
  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('cgs_token', ${JSON.stringify(token)});
      localStorage.setItem('cgs_user', ${JSON.stringify(JSON.stringify(user))});
    `
  });
  await send('Page.navigate', { url: 'http://localhost:5000/incubes' });
  await new Promise(r => setTimeout(r, 1500));

  // Now apply the natural layout fix via DOM manipulation in browser
  const r = await send('Runtime.evaluate', {
    expression: `(() => {
      // 1. Root container: change from flex-col to flex-row on desktop
      const rootDiv = document.querySelector('#root > div');
      if (rootDiv) {
        rootDiv.className = 'min-h-screen bg-slate-50 dark:bg-dark-950 text-slate-900 dark:text-white transition-colors duration-200 flex flex-col lg:flex-row w-full';
      }

      // 2. Sidebar: make sticky on desktop instead of fixed
      const nav = document.querySelector('#mobile-navigation-drawer');
      if (nav) {
        nav.classList.remove('fixed');
        nav.classList.add('lg:sticky', 'lg:top-0', 'lg:h-screen', 'lg:shrink-0', 'fixed');
      }

      // 3. Main container: remove lg:ml-72, w-full, overflow-x-hidden
      const main = document.querySelector('main');
      if (main) {
        main.className = 'flex-1 min-h-screen flex flex-col bg-slate-50 dark:bg-dark-950 min-w-0';
      }

      const rect = main ? main.getBoundingClientRect() : null;
      const header = document.querySelector('header');
      const headerRect = header ? header.getBoundingClientRect() : null;
      const cards = Array.from(document.querySelectorAll('.card'));
      const cardRects = cards.map(c => {
        const cr = c.getBoundingClientRect();
        return { right: Math.round(cr.right), width: Math.round(cr.width) };
      });

      return {
        windowWidth: window.innerWidth,
        mainLeft: rect ? Math.round(rect.left) : null,
        mainRight: rect ? Math.round(rect.right) : null,
        mainWidth: rect ? Math.round(rect.width) : null,
        headerRight: headerRect ? Math.round(headerRect.right) : null,
        scrollWidth: document.documentElement.scrollWidth,
        maxCardRight: cardRects.length > 0 ? Math.max(...cardRects.map(c => c.right)) : null,
        cardCount: cards.length
      };
    })()`,
    returnByValue: true
  });

  console.log('FLEX LAYOUT RESULT:', JSON.stringify(r.result.value, null, 2));

  ws.close();
  edge.kill('SIGKILL');
}
test();


// Le serveur dépose le JWT dans le cookie httpOnly "ids_auth" (il n'est plus renvoyé dans le corps JSON)
function authTokenFrom(res) {
  const cookies = (res && res.headers && res.headers['set-cookie']) || [];
  const match = cookies.join(';').match(/(?:^|;\s*)ids_auth=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}
