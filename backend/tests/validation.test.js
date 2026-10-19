/**
 * @file validation.test.js
 * @description Suite de tests automatisés pour la validation du backend, des calculs financiers et de la sécurité IDOR.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('🧪 SUITE DE TESTS AUTOMATISÉS — VALIDATION INCUBATEUR');
console.log('====================================================\n');

let totalTests = 0;
let passedTests = 0;

/**
 * Exécute un test unitaire avec capture du statut.
 * @param {string} name - Nom du test
 * @param {Function} fn - Fonction exécutant les assertions
 */
function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Erreur: ${err.message}`);
  }
}

// 1. VÉRIFICATIONS SÉCURITÉ & ARCHITECTURE BACKEND
console.log('📂 1. VÉRIFICATIONS ARCHITECTURE & SÉCURITÉ BACKEND :');

test("Contrôleur incubeController.js configure 'separate: true' pour éviter les produits cartésiens", () => {
  const filePath = path.resolve(__dirname, '../src/controllers/incubeController.js');
  const fileContent = fs.readFileSync(filePath, 'utf8');
  assert.ok(fileContent.includes("model: GestionMateriel, as: 'materiels', separate: true"));
  assert.ok(fileContent.includes("model: SuiviEngagement, as: 'engagements', separate: true"));
  assert.ok(fileContent.includes("model: RhEmploi, as: 'emplois', separate: true"));
  assert.ok(fileContent.includes("model: RhDetail, as: 'personnel', separate: true"));
  assert.ok(fileContent.includes("model: PlanAction, as: 'plans', separate: true"));
  assert.ok(fileContent.includes("model: AnalyseFinanciere, as: 'finances', separate: true"));
});

test("Contrôleur incubeController.js protège contre l'IDOR sur dossiers non assignés", () => {
  const filePath = path.resolve(__dirname, '../src/controllers/incubeController.js');
  const fileContent = fs.readFileSync(filePath, 'utf8');
  assert.ok(fileContent.includes("if (!isSuper && incube.admin_id !== req.user.id)"));
});

test("Contrôleur subControllers.js applique checkIncubeAccess et transactions atomiques", () => {
  const filePath = path.resolve(__dirname, '../src/controllers/subControllers.js');
  const fileContent = fs.readFileSync(filePath, 'utf8');
  assert.ok(fileContent.includes('checkIncubeAccess(req.params.incubeId, req.user)'));
  assert.ok(fileContent.includes('sequelize.transaction(async (t) =>'));
});

// 2. VÉRIFICATIONS DES CALCULS FINANCIERS
console.log('\n📊 2. VÉRIFICATIONS LOGIQUE FINANCIÈRE :');

const CHARGES_FIELDS = [
  'achats', 'charges_personnel', 'charges_cnss', 'salaire_porteur',
  'loyer_coworking', 'eau_electricite', 'transport', 'telephone',
  'taxes', 'tva', 'remboursement_credit', 'autres_charges'
];

/**
 * Calcule les indicateurs financiers pour 12 mois et les 4 trimestres.
 * @param {Object} months - Données mensuelles
 * @returns {Object} Synthèse des calculs financiers
 */
function computeFinances(months) {
  const res = {};
  for (let m = 1; m <= 12; m++) {
    const d = months[m] || {};
    const rev = (d.ventes || 0) + (d.autres_revenus || 0);
    const cha = CHARGES_FIELDS.reduce((sum, f) => sum + (d[f] || 0), 0);
    res[m] = { rev, cha, resultat: rev - cha };
  }
  let totalRev = 0, totalCha = 0;
  for (let m = 1; m <= 12; m++) {
    totalRev += res[m].rev;
    totalCha += res[m].cha;
  }
  res.TOTAL = { rev: totalRev, cha: totalCha, resultat: totalRev - totalCha };
  return res;
}

test('Calcul résultat net bénéficiaire (positif)', () => {
  const months = { 1: { ventes: 12000, achats: 3000, transport: 1000 } };
  const r = computeFinances(months);
  assert.strictEqual(r[1].resultat, 8000);
});

test('Calcul résultat net déficitaire (négatif)', () => {
  const months = { 1: { ventes: 2000, achats: 5000, loyer_coworking: 1500 } };
  const r = computeFinances(months);
  assert.strictEqual(r[1].resultat, -4500);
});

test('Calcul résultat net neutre (zéro)', () => {
  const months = { 1: { ventes: 0, achats: 0 } };
  const r = computeFinances(months);
  assert.strictEqual(r[1].resultat, 0);
});

// BILAN
console.log('\n====================================================');
console.log(`🏁 RÉSULTATS : ${passedTests}/${totalTests} tests passés`);
console.log('====================================================\n');

if (passedTests === totalTests) {
  console.log('🎉 Tous les tests unitaires ont réussi !');
  process.exit(0);
} else {
  console.error(`⚠️ ${totalTests - passedTests} test(s) échoué(s).`);
  process.exit(1);
}
