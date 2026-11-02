const { syncAllDeviceClocks } = require('../src/services/tourniquetCollector');

async function test() {
  console.log('--- Test de synchronisation des horloges des 7 bornes ---');
  const res = await syncAllDeviceClocks();
  console.log('Résultat:', res);
  process.exit(0);
}

test().catch(console.error);
