const { jsPDF } = require('../../frontend/node_modules/jspdf');
const autoTable = require('../../frontend/node_modules/jspdf-autotable').default;
const fs = require('fs');
const path = require('path');

const idsLogo = 'data:image/png;base64,' + fs.readFileSync(path.resolve(__dirname, '../../frontend/public/logo-ids.png')).toString('base64');
const ctpesLogo = 'data:image/png;base64,' + fs.readFileSync(path.resolve(__dirname, '../../frontend/public/logo-ctpes.png')).toString('base64');

const mock = {
  nom_incube: 'BENMOUSSA Ahmed',
  cin: 'AB123456',
  date_naissance: '15/05/1998',
  age: '28 ans',
  genre: 'Homme',
  situation_familiale: 'Célibataire',
  niveau_etude: 'Bac+5 (Master / Ingénieur)',
  ville: 'Salé',
  province: 'Salé',
  telephone: '06 12 34 56 78',
  email: 'ahmed.benmoussa@technova.ma',
  linkedin: 'https://linkedin.com/in/ahmed-benmoussa',
  raison_sociale: 'TechNova Solutions SARL',
  statut_juridique: 'SARL',
  rc: '128945',
  secteur_activite: 'Intelligence Artificielle & IoT',
  phase_projet: 'Croissance',
  date_demarrage: '15/03/2024',
  promotion: 'Promotion 2',
  accompagnateur: 'M. Khalid El Idrissi',
  pp_numero: 'PP-032',
  site_web: 'https://www.technova.ma',
  description_projet: 'TechNova développe une plateforme SaaS propulsée par l\'intelligence artificielle pour optimiser l\'efficacité énergétique des unités industrielles et réduire les émissions carbone des PME au Maroc.',
  associes: [
    { nom: 'TAZI Karim', cin: 'CD654321', fonction: 'Directeur Technique (CTO)', tel: '06 98 76 54 32', badge_id: 'RFID-1042' },
    { nom: 'AMQRAN Sara', cin: 'EF112233', fonction: 'Responsable R&D', tel: '06 55 44 33 22', badge_id: 'RFID-1043' }
  ]
};

// ==========================================
// 1. OPTION 1 : TABLEAU DE BORD EXÉCUTIF (2 Colonnes)
// ==========================================
function buildOption1() {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pw = 297, ph = 210;

  // Header
  doc.addImage(idsLogo, 'PNG', 14, 10, 16, 16);
  doc.addImage(ctpesLogo, 'PNG', pw - 14 - 36, 14, 36, 8.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('INCUBATEUR DIGITAL SOLIDAIRE (IDS)', pw / 2, 16, { align: 'center' });

  doc.setFontSize(9.5);
  doc.setTextColor(2, 132, 199);
  doc.text('FICHE SIGNALÉTIQUE & INFORMATIONS GÉNÉRALES', pw / 2, 22, { align: 'center' });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(14, 28, pw - 14, 28);

  // Cartouche Porteur & Photo (Haut)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 31, pw - 28, 26, 2, 2, 'FD');

  // Photo frame
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(17, 33, 22, 22, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(148, 163, 184);
  doc.text('AB', 28, 46, { align: 'center' });

  // Identité cartouche
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(15, 23, 42);
  doc.text(mock.nom_incube, 43, 39);

  doc.setFontSize(9.5);
  doc.setTextColor(2, 132, 199);
  doc.text(mock.raison_sociale, 43, 45);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('N° Dossier : ' + mock.pp_numero + '   •   Phase : ' + mock.phase_projet + '   •   Promotion : ' + mock.promotion + '   •   Accompagnateur : ' + mock.accompagnateur, 43, 51.5);

  // Colonne Gauche : Renseignements Personnels
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text('1. RENSEIGNEMENTS PERSONNELS DU PORTEUR', 14, 63);

  autoTable(doc, {
    startY: 66,
    margin: { left: 14, right: pw - 142 },
    tableWidth: 128,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2, font: 'helvetica', lineColor: [226, 232, 240], lineWidth: 0.25 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [71, 85, 105], cellWidth: 38 },
      1: { textColor: [15, 23, 42], cellWidth: 90 }
    },
    body: [
      ['Carte Nationale (CIN)', mock.cin],
      ['Date de naissance & Âge', mock.date_naissance + ' (' + mock.age + ')'],
      ['Genre & Situation', mock.genre + ' • ' + mock.situation_familiale],
      ['Niveau d\'étude', mock.niveau_etude],
      ['Ville & Province', mock.ville + ' / ' + mock.province],
      ['Téléphone', mock.telephone],
      ['Adresse E-mail', mock.email],
      ['Profil LinkedIn', mock.linkedin]
    ]
  });

  // Colonne Droite : Entreprise + Description + Associés
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text('2. RENSEIGNEMENTS ENTREPRISE & PROJET', 150, 63);

  autoTable(doc, {
    startY: 66,
    margin: { left: 150, right: 14 },
    tableWidth: 133,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2, font: 'helvetica', lineColor: [226, 232, 240], lineWidth: 0.25 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [71, 85, 105], cellWidth: 36 },
      1: { textColor: [15, 23, 42], cellWidth: 30 },
      2: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [71, 85, 105], cellWidth: 32 },
      3: { textColor: [15, 23, 42], cellWidth: 35 }
    },
    body: [
      ['Statut juridique', mock.statut_juridique, 'Numéro RC', mock.rc],
      ['Secteur d\'activité', mock.secteur_activite, 'Date démarrage', mock.date_demarrage],
      ['Site Web officiel', mock.site_web, 'Réf. Dossier', mock.pp_numero]
    ]
  });

  // 3. Description du projet
  const sec3Y = doc.lastAutoTable.finalY + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text('3. DESCRIPTION DU PROJET', 150, sec3Y);

  autoTable(doc, {
    startY: sec3Y + 2.5,
    margin: { left: 150, right: 14 },
    tableWidth: 133,
    theme: 'plain',
    styles: { fontSize: 7.2, cellPadding: 2.5, font: 'helvetica', lineColor: [226, 232, 240], lineWidth: 0.25, fillColor: [248, 250, 252], textColor: [15, 23, 42] },
    body: [[{ content: mock.description_projet }]]
  });

  // 4. Associés
  const sec4Y = doc.lastAutoTable.finalY + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text('4. ASSOCIÉS & ÉQUIPE DU PROJET (2)', 150, sec4Y);

  autoTable(doc, {
    startY: sec4Y + 2.5,
    margin: { left: 150, right: 14 },
    tableWidth: 133,
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, cellPadding: 1.5 },
    styles: { fontSize: 7, cellPadding: 1.5, font: 'helvetica', lineColor: [226, 232, 240], lineWidth: 0.2 },
    head: [['Nom & Prénom', 'CIN', 'Fonction', 'Badge RFID']],
    body: mock.associes.map(a => [a.nom, a.cin, a.fonction, a.badge_id])
  });

  // Footer
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.line(14, ph - 9, pw - 14, ph - 9);
  doc.text('IDS — Incubateur Digital Solidaire • Salé • Fiche Signalétique Officielle Paysage (Option 1 : Tableau de bord exécutif)', 14, ph - 5.5);
  doc.text('Page 1 sur 1', pw - 14, ph - 5.5, { align: 'right' });

  return doc;
}

// ==========================================
// 2. OPTION 2 : VOLET LATÉRAL GAUCHE & FICHE PROJET
// ==========================================
function buildOption2() {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pw = 297, ph = 210;

  // Volet latéral gauche (fond teinté doux)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(12, 10, 78, ph - 20, 2.5, 2.5, 'FD');

  // Logo IDS dans le volet
  doc.addImage(idsLogo, 'PNG', 42, 14, 18, 18);

  // Photo dans le volet
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(38, 36, 26, 26, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(148, 163, 184);
  doc.text('AB', 51, 51, { align: 'center' });

  // Nom & Statut dans le volet
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(mock.nom_incube, 51, 68, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setTextColor(2, 132, 199);
  doc.text(mock.raison_sociale, 51, 73, { align: 'center' });

  doc.setDrawColor(226, 232, 240);
  doc.line(18, 77, 84, 77);

  // Info liste dans volet latéral
  autoTable(doc, {
    startY: 80,
    margin: { left: 16, right: pw - 86 },
    tableWidth: 70,
    theme: 'plain',
    styles: { fontSize: 7, cellPadding: 1.6, font: 'helvetica', textColor: [15, 23, 42] },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: [71, 85, 105], cellWidth: 26 },
      1: { cellWidth: 44 }
    },
    body: [
      ['CIN', mock.cin],
      ['Naissance', mock.date_naissance],
      ['Âge', mock.age],
      ['Genre / Sit.', mock.genre + ', ' + mock.situation_familiale],
      ['Niveau', 'Bac+5 (Master)'],
      ['Ville', mock.ville],
      ['Téléphone', mock.telephone],
      ['E-mail', 'ahmed@technova.ma'],
      ['LinkedIn', 'in/ahmed-benmoussa'],
      ['Dossier', mock.pp_numero],
      ['Promotion', mock.promotion],
      ['Accompag.', 'M. Khalid']
    ]
  });

  // Zone Principale Droite
  doc.addImage(ctpesLogo, 'PNG', pw - 14 - 38, 14, 38, 8.7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('INCUBATEUR DIGITAL SOLIDAIRE (IDS)', 96, 17);

  doc.setFontSize(9);
  doc.setTextColor(2, 132, 199);
  doc.text('FICHE PROJET & DOSSIER D\'ACCRÉDITATION', 96, 22.5);

  doc.setDrawColor(226, 232, 240);
  doc.line(96, 26.5, pw - 14, 26.5);

  // 1. Renseignements Entreprise
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('1. RENSEIGNEMENTS ENTREPRISE & STATUT JURIDIQUE', 96, 32);

  autoTable(doc, {
    startY: 35,
    margin: { left: 96, right: 14 },
    tableWidth: pw - 110,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2, font: 'helvetica', lineColor: [226, 232, 240], lineWidth: 0.25 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [71, 85, 105], cellWidth: 38 },
      1: { textColor: [15, 23, 42], cellWidth: 54 },
      2: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [71, 85, 105], cellWidth: 38 },
      3: { textColor: [15, 23, 42], cellWidth: 57 }
    },
    body: [
      ['Raison sociale', mock.raison_sociale, 'Statut juridique', mock.statut_juridique],
      ['Registre Commerce (RC)', mock.rc, 'Secteur d\'activité', mock.secteur_activite],
      ['Phase du projet', mock.phase_projet, 'Date démarrage', mock.date_demarrage],
      ['Site Web officiel', mock.site_web, 'Promotion', mock.promotion]
    ]
  });

  // 2. Description du projet
  const dSec2Y = doc.lastAutoTable.finalY + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('2. DESCRIPTION DU PROJET & PROPOSITION DE VALEUR', 96, dSec2Y);

  autoTable(doc, {
    startY: dSec2Y + 2.5,
    margin: { left: 96, right: 14 },
    tableWidth: pw - 110,
    theme: 'plain',
    styles: { fontSize: 7.5, cellPadding: 3, font: 'helvetica', lineColor: [226, 232, 240], lineWidth: 0.25, fillColor: [248, 250, 252], textColor: [15, 23, 42] },
    body: [[{ content: mock.description_projet }]]
  });

  // 3. Associés & Équipe
  const dSec3Y = doc.lastAutoTable.finalY + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('3. ASSOCIÉS & ÉQUIPE DU PROJET (2)', 96, dSec3Y);

  autoTable(doc, {
    startY: dSec3Y + 2.5,
    margin: { left: 96, right: 14 },
    tableWidth: pw - 110,
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.2, cellPadding: 1.8 },
    styles: { fontSize: 7.2, cellPadding: 1.8, font: 'helvetica', lineColor: [226, 232, 240], lineWidth: 0.2 },
    head: [['Nom & Prénom', 'CIN', 'Fonction', 'Téléphone', 'Badge RFID']],
    body: mock.associes.map(a => [a.nom, a.cin, a.fonction, a.tel, a.badge_id])
  });

  // Footer
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.line(96, ph - 9, pw - 14, ph - 9);
  doc.text('IDS — Incubateur Digital Solidaire • Salé • Fiche Signalétique Option 2 (Volet Latéral)', 96, ph - 5.5);
  doc.text('Page 1 sur 1', pw - 14, ph - 5.5, { align: 'right' });

  return doc;
}

// ==========================================
// 3. OPTION 3 : BANDES PANORAMIQUES AÉRÉES
// ==========================================
function buildOption3() {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pw = 297, ph = 210;

  // Header
  doc.addImage(idsLogo, 'PNG', 14, 10, 16, 16);
  doc.addImage(ctpesLogo, 'PNG', pw - 14 - 36, 14, 36, 8.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('INCUBATEUR DIGITAL SOLIDAIRE (IDS)', pw / 2, 16, { align: 'center' });

  doc.setFontSize(9.5);
  doc.setTextColor(2, 132, 199);
  doc.text('FICHE SIGNALÉTIQUE & INFORMATIONS GÉNÉRALES', pw / 2, 22, { align: 'center' });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(14, 28, pw - 14, 28);

  // Bandeau 1 : Données Personnelles du Porteur (panoramique)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text('1. RENSEIGNEMENTS PERSONNELS DU PORTEUR', 14, 33);

  autoTable(doc, {
    startY: 35.5,
    margin: { left: 14, right: 14 },
    tableWidth: pw - 28,
    theme: 'grid',
    styles: { fontSize: 7.2, cellPadding: 1.8, font: 'helvetica', lineColor: [226, 232, 240], lineWidth: 0.25 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [71, 85, 105], cellWidth: 35 },
      1: { textColor: [15, 23, 42], cellWidth: 55 },
      2: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [71, 85, 105], cellWidth: 35 },
      3: { textColor: [15, 23, 42], cellWidth: 55 },
      4: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [71, 85, 105], cellWidth: 34 },
      5: { textColor: [15, 23, 42], cellWidth: 55 }
    },
    body: [
      ['Nom & Prénom', mock.nom_incube, 'CIN', mock.cin, 'Genre / Situation', mock.genre + ' • ' + mock.situation_familiale],
      ['Date naissance / Âge', mock.date_naissance + ' (' + mock.age + ')', 'Niveau d\'étude', mock.niveau_etude, 'Ville & Province', mock.ville + ' / ' + mock.province],
      ['Téléphone', mock.telephone, 'Adresse E-mail', mock.email, 'Profil LinkedIn', mock.linkedin]
    ]
  });

  // Bandeau 2 : Données Entreprise (panoramique)
  const bSec2Y = doc.lastAutoTable.finalY + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text('2. RENSEIGNEMENTS ENTREPRISE & PROJET D\'INCUBATION', 14, bSec2Y);

  autoTable(doc, {
    startY: bSec2Y + 2.5,
    margin: { left: 14, right: 14 },
    tableWidth: pw - 28,
    theme: 'grid',
    styles: { fontSize: 7.2, cellPadding: 1.8, font: 'helvetica', lineColor: [226, 232, 240], lineWidth: 0.25 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [71, 85, 105], cellWidth: 35 },
      1: { textColor: [15, 23, 42], cellWidth: 55 },
      2: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [71, 85, 105], cellWidth: 35 },
      3: { textColor: [15, 23, 42], cellWidth: 55 },
      4: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [71, 85, 105], cellWidth: 34 },
      5: { textColor: [15, 23, 42], cellWidth: 55 }
    },
    body: [
      ['Raison sociale', mock.raison_sociale, 'Statut juridique', mock.statut_juridique, 'Numéro RC', mock.rc],
      ['Phase du projet', mock.phase_projet, 'Date démarrage', mock.date_demarrage, 'Secteur d\'activité', mock.secteur_activite],
      ['Promotion', mock.promotion, 'Accompagnateur IDS', mock.accompagnateur, 'Site Web officiel', mock.site_web]
    ]
  });

  // Bandeau 3 (Bas partagé en 2 : Description à gauche + Associés à droite)
  const bSec3Y = doc.lastAutoTable.finalY + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text('3. DESCRIPTION DU PROJET', 14, bSec3Y);
  doc.text('4. ASSOCIÉS & ÉQUIPE DU PROJET (2)', 150, bSec3Y);

  autoTable(doc, {
    startY: bSec3Y + 2.5,
    margin: { left: 14, right: pw - 142 },
    tableWidth: 128,
    theme: 'plain',
    styles: { fontSize: 7.2, cellPadding: 2.5, font: 'helvetica', lineColor: [226, 232, 240], lineWidth: 0.25, fillColor: [248, 250, 252], textColor: [15, 23, 42] },
    body: [[{ content: mock.description_projet }]]
  });

  autoTable(doc, {
    startY: bSec3Y + 2.5,
    margin: { left: 150, right: 14 },
    tableWidth: 133,
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, cellPadding: 1.5 },
    styles: { fontSize: 7, cellPadding: 1.5, font: 'helvetica', lineColor: [226, 232, 240], lineWidth: 0.2 },
    head: [['Nom & Prénom', 'CIN', 'Fonction', 'Badge RFID']],
    body: mock.associes.map(a => [a.nom, a.cin, a.fonction, a.badge_id])
  });

  // Footer
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.line(14, ph - 9, pw - 14, ph - 9);
  doc.text('IDS — Incubateur Digital Solidaire • Salé • Fiche Signalétique Option 3 (Panoramique)', 14, ph - 5.5);
  doc.text('Page 1 sur 1', pw - 14, ph - 5.5, { align: 'right' });

  return doc;
}

const outDir = path.resolve(__dirname, '../../frontend/public');
fs.writeFileSync(path.join(outDir, 'preview_option1_dashboard.pdf'), Buffer.from(buildOption1().output('arraybuffer')));
fs.writeFileSync(path.join(outDir, 'preview_option2_lateral.pdf'), Buffer.from(buildOption2().output('arraybuffer')));
fs.writeFileSync(path.join(outDir, 'preview_option3_panoramique.pdf'), Buffer.from(buildOption3().output('arraybuffer')));

console.log('SUCCESS: Les 3 fichiers PDF aperçus ont été générés dans frontend/public/ !');
