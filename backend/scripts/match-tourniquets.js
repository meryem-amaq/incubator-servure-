const ZKLib = require('node-zklib');
const { Incube, User } = require('../src/models');

const PARTICLES = new Set(['el', 'al', 'la', 'le', 'ben', 'ibn', 'ait', 'ould', 'bou', 'bel', 'der']);

function cleanWord(w) {
  return w.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getSignificantWords(str) {
  if (!str) return [];
  return str.split(/[\s\-_\/]+/)
    .map(cleanWord)
    .filter(w => w.length >= 2 && !PARTICLES.has(w));
}

function similarity(w1, w2) {
  if (w1 === w2) return 1;
  if (w1.length < 3 || w2.length < 3) return 0;
  if (w1.includes(w2) || w2.includes(w1)) return 0.85;
  const a = w1, b = w2;
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 0;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return (Math.max(m, n) - dp[m][n]) / Math.max(m, n);
}

function matchesPersonName(nameA, nameB) {
  if (!nameA || !nameB) return false;
  const cleanA = cleanWord(nameA);
  const cleanB = cleanWord(nameB);
  if (cleanA === cleanB) return true;

  const sigA = getSignificantWords(nameA);
  const sigB = getSignificantWords(nameB);
  if (sigA.length === 0 || sigB.length === 0) return false;

  // Exact match on all significant words regardless of order
  if (sigA.length === sigB.length && sigA.every(wa => sigB.includes(wa))) {
    return true;
  }

  // Count how many significant words match with high similarity (>= 0.8)
  let matchedCount = 0;
  for (const wa of sigA) {
    const hasMatch = sigB.some(wb => similarity(wa, wb) >= 0.8);
    if (hasMatch) matchedCount++;
  }

  const minRequired = Math.min(sigA.length, sigB.length);
  if (minRequired >= 2) {
    return matchedCount >= 2;
  }
  return matchedCount >= 1 && sigA.length === 1 && sigB.length === 1;
}

async function dryRun() {
  const zk = new ZKLib('10.0.1.120', 4370, 3000, 4000);
  await zk.createSocket();
  const res = await zk.getUsers();
  await zk.disconnect();
  const zkUsers = res?.data || [];

  const incubes = await Incube.findAll();
  const users = await User.findAll();

  let incMatches = [];
  let staffMatches = [];
  let rest = [];

  for (const zu of zkUsers) {
    // 1. Chercher dans Incube
    const matchInc = incubes.find(inc => matchesPersonName(zu.name, inc.nom_incube));
    if (matchInc) {
      incMatches.push({ zu, inc: matchInc });
      continue;
    }

    // 2. Chercher dans User (Staff ou Incubé)
    const matchUser = users.find(u => matchesPersonName(zu.name, `${u.prenom || ''} ${u.nom || ''}`) || matchesPersonName(zu.name, `${u.nom || ''} ${u.prenom || ''}`));
    if (matchUser) {
      if (matchUser.role === 'incube') {
        incMatches.push({ zu, inc: { nom_incube: `${matchUser.prenom} ${matchUser.nom}`, id: matchUser.id, isUser: true } });
      } else {
        staffMatches.push({ zu, user: matchUser });
      }
      continue;
    }

    rest.push(zu);
  }

  console.log('=== INCUBÉS CORRESPONDANTS (' + incMatches.length + ') ===');
  incMatches.forEach(m => console.log(`  Tourniquet: "${m.zu.name}" (#userId=${m.zu.userId}, Card: ${m.zu.cardno}) ==> Incube: "${m.inc.nom_incube}"`));

  console.log('\n=== STAFF CORRESPONDANT (' + staffMatches.length + ') ===');
  staffMatches.forEach(m => console.log(`  Tourniquet: "${m.zu.name}" ==> Staff: "${m.user.prenom} ${m.user.nom}" (${m.user.role})`));

  console.log('\n=== VISITEURS / AUTRES (' + rest.length + ') ===');
  rest.forEach(r => console.log(`  - "${r.name}" (#userId=${r.userId}, card=${r.cardno})`));
}

dryRun().catch(console.error);
