const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const {
  sequelize,
  User,
  Incube,
  GestionMateriel,
  SuiviEngagement,
  RhEmploi,
  RhDetail,
  PlanAction,
  AnalyseFinanciere,
} = require('../src/models');

async function seed() {
  try {
    console.log('🔄 Synchronisation des tables Sequelize...');
    await sequelize.sync({ force: true });
    console.log('✅ Tables créées avec succès.');

    // 1. Création Admin
    const hash = await bcrypt.hash('Admin1234', 10);
    await User.create({
      nom: 'Administrateur',
      prenom: '',
      email: 'admin@ids.ma',
      mot_de_passe: hash,
      role: 'administrateur',
      actif: true,
    });
    console.log('👤 Administrateur créé : admin@cgs.ma / Admin1234');

    // 2. Création Incubés
    const incubesData = [
      { id: 1, pp_numero: 'PP-001', nom_incube: 'Ahmed Benmoussa', situation_familiale: 'Marié', accompagnateur: 'M. Khalid', date_demarrage: '2024-03-15', statut_juridique: 'SARL', raison_sociale: 'TechNova SARL', phase_projet: 'Croissance' },
      { id: 2, pp_numero: 'PP-002', nom_incube: 'Fatima Zahra El Amrani', situation_familiale: 'Célibataire', accompagnateur: 'Mme Nadia', date_demarrage: '2024-06-01', statut_juridique: 'Auto-entrepreneur', raison_sociale: 'GreenCraft', phase_projet: 'Lancement' },
      { id: 3, pp_numero: 'PP-003', nom_incube: 'Youssef Tazi', situation_familiale: 'Marié', accompagnateur: 'M. Khalid', date_demarrage: '2024-09-10', statut_juridique: 'SA', raison_sociale: 'DataFlow Solutions', phase_projet: 'Idéation' },
      { id: 4, pp_numero: 'PP-004', nom_incube: 'Salma Bennani', situation_familiale: 'Célibataire', accompagnateur: 'Mme Nadia', date_demarrage: '2023-11-20', statut_juridique: 'SARL', raison_sociale: 'EcoTextile Maroc', phase_projet: 'Croissance' },
      { id: 5, pp_numero: 'PP-005', nom_incube: 'Omar Idrissi', situation_familiale: 'Marié', accompagnateur: 'M. Hassan', date_demarrage: '2024-01-08', statut_juridique: 'Coopérative', raison_sociale: 'AgriSmart', phase_projet: 'Lancement' },
      { id: 6, pp_numero: 'PP-006', nom_incube: 'Khadija Moulay', situation_familiale: 'Mariée', accompagnateur: 'M. Hassan', date_demarrage: '2024-08-22', statut_juridique: 'SARL', raison_sociale: 'HealthConnect', phase_projet: 'Idéation' }
    ];

    for (const inc of incubesData) {
      await Incube.create(inc);
    }
    console.log('👥 6 Incubés insérés.');

    // 3. Matériels pour Ahmed (id: 1)
    await GestionMateriel.bulkCreate([
      { incube_id: 1, type_origine: 'propre', article: 'PC Portable Dell XPS 15', quantite: 2, valeur_ou_etat: '24000 MAD' },
      { incube_id: 1, type_origine: 'propre', article: 'Imprimante Multifonction Epson', quantite: 1, valeur_ou_etat: '3500 MAD' },
      { incube_id: 1, type_origine: 'ids', article: 'Bureau ergonomique FabLab', quantite: 3, valeur_ou_etat: 'Bon état' },
      { incube_id: 1, type_origine: 'ids', article: 'Écran 27 pouces Dell', quantite: 2, valeur_ou_etat: 'Très bon état' },
    ]);

    // 4. Suivi Engagement
    await SuiviEngagement.bulkCreate([
      { incube_id: 1, mois: 1, annee: 2024, moyenne_heures_presence: 38.5, taux_presence_formation: 95.0, initiatives: 'Participation active au hackathon Fablab' },
      { incube_id: 1, mois: 2, annee: 2024, moyenne_heures_presence: 42.0, taux_presence_formation: 100.0, initiatives: 'Mise en place du prototype IoT' },
      { incube_id: 1, mois: 3, annee: 2024, moyenne_heures_presence: 35.0, taux_presence_formation: 90.0, initiatives: 'Atelier de modélisation 3D' },
    ]);

    // 5. RH Emploi & Détail
    await RhEmploi.bulkCreate([
      { incube_id: 1, mois: 1, annee: 2024, personnel_permanent: 2, personnel_temporaire: 1 },
      { incube_id: 1, mois: 2, annee: 2024, personnel_permanent: 3, personnel_temporaire: 1 },
      { incube_id: 1, mois: 3, annee: 2024, personnel_permanent: 3, personnel_temporaire: 2 },
    ]);

    await RhDetail.bulkCreate([
      { incube_id: 1, nom_complet: 'Karim Alami', poste: 'Développeur Fullstack', nature_contrat: 'CDI', date_embauche: '2024-03-20', salaire_mensuel: 8500.00 },
      { incube_id: 1, nom_complet: 'Sanae Chraibi', poste: 'Designer UI/UX', nature_contrat: 'CDI', date_embauche: '2024-04-01', salaire_mensuel: 7500.00 },
      { incube_id: 1, nom_complet: 'Mehdi Tahiri', poste: 'Stagiaire Data', nature_contrat: 'Stage', date_embauche: '2024-05-15', salaire_mensuel: 2500.00 },
    ]);

    // 6. Plan d'Action
    await PlanAction.bulkCreate([
      { incube_id: 1, mois: 3, annee: 2024, objectifs: 'Finalisation de la V1 du produit SaaS', echeance: '2024-04-30', realisation: 'Module d analyse complété', problemes_rencontres: 'Retard sur l intégration API paiement', statut: 'En cours' },
      { incube_id: 1, mois: 4, annee: 2024, objectifs: 'Lancement de la campagne marketing B2B', echeance: '2024-05-31', realisation: 'Création des supports visuels', problemes_rencontres: 'Budget acquisition publicitaire limité', statut: 'En cours' },
    ]);

    // 7. Analyse Financière
    await AnalyseFinanciere.bulkCreate([
      { incube_id: 1, mois: 1, annee: 2024, ventes: 45000, autres_revenus: 5000, achats: 12000, charges_personnel: 16000, charges_cnss: 3200, salaire_porteur: 10000, loyer: 3000, eau_electricite: 800, transport: 1200, telephone: 600, taxes: 1500, tva: 2000, remboursement_credit: 0, autres_charges: 1000 },
      { incube_id: 1, mois: 2, annee: 2024, ventes: 52000, autres_revenus: 3000, achats: 14000, charges_personnel: 16000, charges_cnss: 3200, salaire_porteur: 10000, loyer: 3000, eau_electricite: 850, transport: 1100, telephone: 600, taxes: 1500, tva: 2400, remboursement_credit: 0, autres_charges: 800 },
      { incube_id: 1, mois: 3, annee: 2024, ventes: 61000, autres_revenus: 4000, achats: 15000, charges_personnel: 18500, charges_cnss: 3700, salaire_porteur: 10000, loyer: 3000, eau_electricite: 900, transport: 1300, telephone: 650, taxes: 1500, tva: 2800, remboursement_credit: 0, autres_charges: 1200 },
    ]);

    console.log('✅ Base de données initialisée et peuplée avec succès !');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  }
}

seed();
