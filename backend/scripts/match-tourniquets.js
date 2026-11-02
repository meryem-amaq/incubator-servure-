const ZKLib = require('node-zklib');
const { Incube, User } = require('../src/models');

function normalizeName(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function dryRunMatch() {
  const zk = new ZKLib('10.0.1.120', 4370, 3000, 4000);
  await zk.createSocket();
  const res = await zk.getUsers();
  await zk.disconnect();
  const zkUsers = res?.data || [];

  const incubes = await Incube.findAll();
  const users = await User.findAll();

  console.log('Total ZK users:', zkUsers.length);
  console.log('Total incubes in DB:', incubes.length);

  let matchedIncubes = 0;
  let matchedStaff = 0;

  zkUsers.forEach(zu => {
    const zuName = normalizeName(zu.name);
    if (!zuName) return;

    // Check incubes
    const matchInc = incubes.find(inc => {
      const inName = normalizeName(inc.nom_incube);
      return inName === zuName || 
             (zuName.length >= 4 && inName.includes(zuName)) ||
             (inName.length >= 4 && zuName.includes(inName));
    });

    if (matchInc) {
      matchedIncubes++;
      console.log(`[INCUBE MATCH] Tourniquet: "${zu.name}" (ID: ${zu.userId}, Card: ${zu.cardno}) ===> DB Incube #${matchInc.id}: "${matchInc.nom_incube}"`);
    } else {
      // Check staff
      const matchStaff = users.find(u => {
        const uName = normalizeName(`${u.prenom} ${u.nom}`);
        const uNameRev = normalizeName(`${u.nom} ${u.prenom}`);
        return uName === zuName || uNameRev === zuName;
      });
      if (matchStaff) {
        matchedStaff++;
        console.log(`[STAFF MATCH] Tourniquet: "${zu.name}" (ID: ${zu.userId}, Card: ${zu.cardno}) ===> DB Staff #${matchStaff.id}: "${matchStaff.prenom} ${matchStaff.nom}"`);
      }
    }
  });

  console.log(`\nResults: ${matchedIncubes} incubes matched, ${matchedStaff} staff matched.`);
  process.exit(0);
}

dryRunMatch().catch(err => {
  console.error(err);
  process.exit(1);
});
