const assert = require('assert');
const {
  processScansToMonthlyHours,
  calculateEngagementMetrics
} = require('../src/services/tourniquetService');

console.log('====================================================');
console.log('🧪 SUITE DE TESTS : TOURNIQUETS & MODULE ENGAGEMENT');
console.log('====================================================\n');

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
  }
}

// 1. Filtrage anti-rebond (moins de 10s ignoré)
test("Anti-rebond : deux scans à 3 secondes d'intervalle ne gardent qu'un seul scan", () => {
  const scans = [
    { time: new Date('2026-03-10T09:00:00Z'), raw_badge_id: '100' },
    { time: new Date('2026-03-10T09:00:03Z'), raw_badge_id: '100' }, // doublon < 10s
    { time: new Date('2026-03-10T12:00:00Z'), raw_badge_id: '100' }
  ];
  const { totalHours, totalValidScans } = processScansToMonthlyHours(scans, 2026);
  assert.strictEqual(totalValidScans, 2, 'Doit avoir 2 scans valides');
  assert.strictEqual(totalHours, 3.0, 'Durée doit être de 3h (9h à 12h)');
});

// 2. Appairage IN / OUT régulier
test("Appairage IN/OUT : deux sessions dans la même journée", () => {
  const scans = [
    { time: new Date('2026-04-05T09:00:00Z'), raw_badge_id: '101' },
    { time: new Date('2026-04-05T12:00:00Z'), raw_badge_id: '101' }, // 3h
    { time: new Date('2026-04-05T14:00:00Z'), raw_badge_id: '101' },
    { time: new Date('2026-04-05T18:00:00Z'), raw_badge_id: '101' }  // 4h -> total 7h
  ];
  const { totalHours, monthlyHours } = processScansToMonthlyHours(scans, 2026);
  assert.strictEqual(totalHours, 7.0, 'Total journée doit être 7.0h');
  assert.strictEqual(monthlyHours['Avril'], 7.0, 'Avril doit avoir 7.0h');
});

// 3. Scan impair : forfait de 2 heures
test("Scan impair : entrée sans badgeage de sortie applique forfait de 2h", () => {
  const scans = [
    { time: new Date('2026-05-12T10:00:00Z'), raw_badge_id: '102' } // 1 scan = forfait 2h
  ];
  const { totalHours, monthlyHours } = processScansToMonthlyHours(scans, 2026);
  assert.strictEqual(totalHours, 2.0, 'Scan unique doit valoir 2h forfaitaires');
  assert.strictEqual(monthlyHours['Mai'], 2.0, 'Mai doit avoir 2.0h');
});

// 4. Calculs des métriques d'engagement contractuel
test("Engagement contractuel : 60h/mois donne 100% (CONFORME)", () => {
  const monthlyHours = {
    'Janvier': 60,
    'Février': 60,
    'Mars': 0, 'Avril': 0, 'Mai': 0, 'Juin': 0,
    'Juillet': 0, 'Août': 0, 'Septembre': 0, 'Octobre': 0, 'Novembre': 0, 'Décembre': 0
  };
  const metrics = calculateEngagementMetrics(monthlyHours);
  assert.strictEqual(metrics.totalHeures, 120);
  assert.strictEqual(metrics.moyMensuelle, 60);
  assert.strictEqual(metrics.moyHebdo, 15);
  assert.strictEqual(metrics.tauxHebdo, 100);
  assert.strictEqual(metrics.tauxMois, 100);
  assert.strictEqual(metrics.statutsParMois['Janvier'].statut, 'CONFORME');
});

test("Statut d'engagement : Seuils Conforme (>=100%), Attention (>=75%), Non Conforme (<75%)", () => {
  const monthlyHours = {
    'Janvier': 65, // > 100% -> CONFORME
    'Février': 50, // 83% -> ATTENTION
    'Mars': 30,    // 50% -> NON CONFORME
    'Avril': 0, 'Mai': 0, 'Juin': 0,
    'Juillet': 0, 'Août': 0, 'Septembre': 0, 'Octobre': 0, 'Novembre': 0, 'Décembre': 0
  };
  const metrics = calculateEngagementMetrics(monthlyHours);
  assert.strictEqual(metrics.statutsParMois['Janvier'].statut, 'CONFORME');
  assert.strictEqual(metrics.statutsParMois['Février'].statut, 'ATTENTION');
  assert.strictEqual(metrics.statutsParMois['Mars'].statut, 'NON CONFORME');
});

console.log(`\n====================================================`);
console.log(`🏁 RÉSULTATS : ${passed}/${total} tests passés`);
console.log(`====================================================`);
process.exit(passed === total ? 0 : 1);
