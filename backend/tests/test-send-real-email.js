const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const emailService = require('../src/services/emailService');

const TARGET_EMAIL = process.env.TEST_TARGET_EMAIL;
if (!TARGET_EMAIL) {
  console.log('ℹ️ TEST_TARGET_EMAIL non défini dans l\'environnement. Définissez TEST_TARGET_EMAIL avant de lancer ce script.');
  process.exit(0);
}

async function runRealEmailTest() {
  console.log("================================================================================");
  console.log(`🚀 TEST D'ENVOI D'EMAILS RÉELS VERS : ${TARGET_EMAIL}`);
  console.log(`📤 Expéditeur SMTP configuré        : ${process.env.MAIL_USERNAME || process.env.EMAIL_USER}`);
  console.log("================================================================================\n");

  // 1. Email de Confirmation de Réservation d'Espace
  console.log("1️⃣ Envoi de la Confirmation de Réservation...");
  const fakeReservation = {
    id: 1,
    nomIncube: 'Meryem Amqran',
    emailIncube: TARGET_EMAIL,
    espace: 'Fablab - Découpeuse Laser & Impression 3D',
    dateReservation: '18 Septembre 2026',
    heureDebut: '10:00',
    heureFin: '12:30',
    equipementsUtilises: 'Machine Laser CO2 + Ultimaker S5'
  };

  const resReservation = await emailService.sendReservationStatusEmail(fakeReservation, 'valide');
  console.log("   Résultat Réservation:", resReservation.success ? "✅ ENVOYÉ AVEC SUCCÈS" : `❌ ERREUR: ${resReservation.error}`);

  // 2. Email de Convocation / Rendez-vous d'accompagnement
  console.log("\n2️⃣ Envoi de l'Invitation de Rendez-vous de Mentoring...");
  const fakeRdv = {
    id: 99,
    accompagnateurNom: 'Directeur Incubateur IDS / Coach CGS',
    sujet: 'Point d\'étape, Diagnostic Projet & Revue des Jalons',
    dateRdv: '22 Septembre 2026',
    heureRdv: '14:30',
    duree: '1h',
    lieu: 'Salle Conseil - Incubateur IDS / Fablab (ou visio Google Meet)',
    commentaireEmail: 'Merci de vous munir de votre plan d\'action actualisé et de l\'état d\'avancement de votre prototype.'
  };

  const fakeIncube = {
    nom_incube: 'Meryem Amqran',
    email: TARGET_EMAIL
  };

  const resRdv = await emailService.sendRdvConfirmationEmail(fakeRdv, fakeIncube);
  console.log("   Résultat Rendez-vous:", resRdv.success ? "✅ ENVOYÉ AVEC SUCCÈS" : `❌ ERREUR: ${resRdv.error}`);

  console.log("\n================================================================================");
  console.log(`✨ FIN DU TEST ! Vérifiez votre boîte de réception (${TARGET_EMAIL}) et le dossier Spams/Courrier indésirable.`);
  console.log("================================================================================");
}

runRealEmailTest();
