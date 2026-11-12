const { jsPDF } = require('../../frontend/node_modules/jspdf');
const autoTable = require('../../frontend/node_modules/jspdf-autotable').default;
const fs = require('fs');
const path = require('path');

const idsLogo = 'data:image/png;base64,' + fs.readFileSync(path.resolve(__dirname, '../../frontend/public/logo-ids.png')).toString('base64');
const ctpesLogo = 'data:image/png;base64,' + fs.readFileSync(path.resolve(__dirname, '../../frontend/public/logo-ctpes.png')).toString('base64');

// Sample portrait
let samplePhoto = null;
const samplePhotoPath = path.resolve(__dirname, '../../sample_photo_benali.png');
if (fs.existsSync(samplePhotoPath)) {
  samplePhoto = 'data:image/png;base64,' + fs.readFileSync(samplePhotoPath).toString('base64');
}

const mock = {
  nom_incube: 'BENMOUSSA Ahmed',
  cin: 'AB123456',
  date_naissance: '15/05/1998',
  age: '28 ans',
  genre: 'Homme',
  situation_familiale: 'Célibataire',
  niveau_etude: 'Bac+5 (Master / Ingénieur)',
  specialite: 'Génie Logiciel & IA',
  ville: 'Salé',
  province: 'Salé',
  telephone: '06 12 34 56 78',
  email: 'ahmed.benmoussa@technova.ma',
  linkedin: 'https://linkedin.com/in/ahmed-benmoussa',
  site_web: 'https://www.technova.ma',
  raison_sociale: 'TechNova Solutions SARL',
  statut_juridique: 'SARL',
  rc: '128945',
  secteur_activite: 'Intelligence Artificielle & IoT',
  phase_projet: 'Croissance',
  cible: 'B2B / B2G / B2B2C',
  date_demarrage: '15/03/2024',
  promotion: 'Promotion 2',
  accompagnateur: 'M. Khalid El Idrissi',
  pp_numero: 'PP-032',
  description_projet: 'TechNova développe une plateforme SaaS propulsée par l\'intelligence artificielle pour optimiser l\'efficacité énergétique des unités industrielles et réduire les émissions carbone des PME au Maroc.',
  personnel_count: 5,
  associes: [
    { nom: 'TAZI Karim', cin: 'CD654321', fonction: 'Directeur Technique (CTO)', tel: '06 98 76 54 32', badge_id: 'RFID-1042' },
    { nom: 'AMQRAN Sara', cin: 'EF112233', fonction: 'Responsable R&D', tel: '06 55 44 33 22', badge_id: 'RFID-1043' }
  ]
};

// Helper: Vector QR code generator
function drawVectorQr(doc, x, y, size, color = [15, 23, 42]) {
  const pad = 1.5;
  const innerSize = size - pad * 2;
  const finder = innerSize * 0.28;

  // Background box
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, size, size, 1.5, 1.5, 'FD');

  doc.setFillColor(...color);
  // 3 outer corner finder patterns
  doc.rect(x + pad, y + pad, finder, finder, 'F');
  doc.rect(x + pad + innerSize - finder, y + pad, finder, finder, 'F');
  doc.rect(x + pad, y + pad + innerSize - finder, finder, finder, 'F');

  // Inner punch holes
  const punch = finder * 0.45;
  const punchOffset = (finder - punch) / 2;
  doc.setFillColor(255, 255, 255);
  doc.rect(x + pad + punchOffset, y + pad + punchOffset, punch, punch, 'F');
  doc.rect(x + pad + innerSize - finder + punchOffset, y + pad + punchOffset, punch, punch, 'F');
  doc.rect(x + pad + punchOffset, y + pad + innerSize - finder + punchOffset, punch, punch, 'F');

  // Center dots
  doc.setFillColor(...color);
  const matrixStart = pad + finder + 1;
  const dotStep = 1.1;
  for (let dy = 0; dy < 5; dy++) {
    for (let dx = 0; dx < 5; dx++) {
      if ((dx + dy) % 2 === 0 || (dx * 2 + dy) % 3 === 0) {
        doc.rect(x + matrixStart + dx * dotStep, y + matrixStart + dy * dotStep, 0.75, 0.75, 'F');
      }
    }
  }
}

function buildSimplePdfV2() {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pw = 297, ph = 210;
  const marginX = 14;

  // ==========================================
  // 1. EN-TÊTE : DEUX LOGOS STRICTEMENT ÉGAUX
  // ==========================================
  // Dimensions exactes des deux badges de logo : 38mm x 14mm
  const badgeW = 38, badgeH = 14, badgeY = 9, badgeR = 2;

  // Logo IDS (Gauche)
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(marginX, badgeY, badgeW, badgeH, badgeR, badgeR, 'FD');
  doc.addImage(idsLogo, 'PNG', marginX + (badgeW - 12) / 2, badgeY + (badgeH - 12) / 2, 12, 12);

  // Logo CTPES (Droite) - Format 100% IDENTIQUE
  const ctpesX = pw - marginX - badgeW;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(ctpesX, badgeY, badgeW, badgeH, badgeR, badgeR, 'FD');
  doc.addImage(ctpesLogo, 'PNG', ctpesX + (badgeW - 31) / 2, badgeY + (badgeH - 7.1) / 2, 31, 7.1);

  // Titre En-Tête Centré
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('INCUBATEUR DIGITAL SOLIDAIRE (IDS)', pw / 2, 15, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(2, 132, 199); // primary sky-600
  doc.text('FICHE SIGNALÉTIQUE & INFORMATIONS GÉNÉRALES', pw / 2, 21, { align: 'center' });

  // Ligne de séparation fine sous l'en-tête (placée à Y=26, 3mm SOUS les logos pour aucun contact)
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(marginX, 26, pw - marginX, 26);

  // ==========================================
  // 2. CARTOUCHE PORTTEUR AVEC PHOTO & QR CODES (Y = 29 à 58)
  // ==========================================
  const cartoucheY = 29;
  const cartoucheH = 28;
  const cartoucheW = pw - marginX * 2; // 269 mm

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(marginX, cartoucheY, cartoucheW, cartoucheH, 2.5, 2.5, 'FD');

  // Photo
  const photoSize = 22;
  const photoX = marginX + 3.5;
  const photoY = cartoucheY + 3;

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(photoX, photoY, photoSize, photoSize, 1.5, 1.5, 'FD');

  if (samplePhoto) {
    try {
      doc.addImage(samplePhoto, 'PNG', photoX, photoY, photoSize, photoSize);
      doc.setDrawColor(2, 132, 199);
      doc.setLineWidth(0.5);
      doc.roundedRect(photoX, photoY, photoSize, photoSize, 1.5, 1.5, 'S');
    } catch (e) {}
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(148, 163, 184);
    doc.text('IN', photoX + photoSize / 2, photoY + 13, { align: 'center' });
  }

  // Identité au centre du cartouche
  const textLeftX = photoX + photoSize + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(mock.nom_incube.toUpperCase(), textLeftX, cartoucheY + 8);

  doc.setFontSize(10);
  doc.setTextColor(2, 132, 199);
  doc.text(mock.raison_sociale, textLeftX, cartoucheY + 14.5);

  doc.setFontSize(7.8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Réf. Dossier : ${mock.pp_numero}   •   Phase : ${mock.phase_projet}   •   Promotion : ${mock.promotion}   •   Accompagnateur : ${mock.accompagnateur}`, textLeftX, cartoucheY + 21.5);

  // LES DEUX QR CODES (LinkedIn & Site Web) DANS LE CARTOUCHE
  const qrBoxSize = 20;
  const qr1X = pw - marginX - qrBoxSize * 2 - 14;
  const qr2X = pw - marginX - qrBoxSize - 5;
  const qrY = cartoucheY + 3;

  // QR 1 : LinkedIn
  drawVectorQr(doc, qr1X, qrY, qrBoxSize, [10, 102, 194]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(10, 102, 194);
  doc.text('QR LinkedIn', qr1X + qrBoxSize / 2, qrY + qrBoxSize + 3.5, { align: 'center' });

  // QR 2 : Site Web
  drawVectorQr(doc, qr2X, qrY, qrBoxSize, [2, 132, 199]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(2, 132, 199);
  doc.text('QR Site Web', qr2X + qrBoxSize / 2, qrY + qrBoxSize + 3.5, { align: 'center' });

  // Séparateur vertical avant les QR codes
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(qr1X - 6, cartoucheY + 3, qr1X - 6, cartoucheY + cartoucheH - 3);

  // ==========================================
  // 3. DEUX COLONNES DE TABLEAUX ÉPURÉS (Y = 61 à 145)
  // ==========================================
  const colGap = 8;
  const colW = (pw - marginX * 2 - colGap) / 2; // 130.5 mm
  const col1X = marginX;
  const col2X = marginX + colW + colGap;
  const secStartY = 61;

  // --- COLONNE GAUCHE : RENSEIGNEMENTS PERSONNELS ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text('1. RENSEIGNEMENTS PERSONNELS DU PORTEUR', col1X, secStartY);

  autoTable(doc, {
    startY: secStartY + 3,
    margin: { left: col1X, right: pw - col1X - colW },
    tableWidth: colW,
    theme: 'grid',
    styles: { fontSize: 7.6, cellPadding: 2.1, font: 'helvetica', lineColor: [226, 232, 240], lineWidth: 0.25 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [71, 85, 105], cellWidth: 40 },
      1: { textColor: [15, 23, 42], cellWidth: colW - 40 }
    },
    body: [
      ['Carte Nationale (CIN)', mock.cin],
      ['Date de naissance & Âge', `${mock.date_naissance} (${mock.age})`],
      ['Genre & Situation', `${mock.genre} • ${mock.situation_familiale}`],
      ['Niveau d\'étude', mock.niveau_etude],
      ['Spécialité / Métier', mock.specialite],
      ['Ville & Province', `${mock.ville} / ${mock.province}`],
      ['Téléphone', mock.telephone],
      ['Adresse E-mail', mock.email],
      ['Profil LinkedIn', mock.linkedin + '  (Scannez le QR Code en haut)'],
      ['Site Web / Portfolio', mock.site_web + '  (Scannez le QR Code en haut)']
    ]
  });

  // --- COLONNE DROITE : ENTREPRISE, MARCHÉ & ÉQUIPE RH ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text('2. RENSEIGNEMENTS ENTREPRISE & ENCADREMENT', col2X, secStartY);

  autoTable(doc, {
    startY: secStartY + 3,
    margin: { left: col2X, right: marginX },
    tableWidth: colW,
    theme: 'grid',
    styles: { fontSize: 7.6, cellPadding: 2.1, font: 'helvetica', lineColor: [226, 232, 240], lineWidth: 0.25 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [71, 85, 105], cellWidth: 38 },
      1: { textColor: [15, 23, 42], cellWidth: 27 },
      2: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [71, 85, 105], cellWidth: 35 },
      3: { textColor: [15, 23, 42], cellWidth: colW - 38 - 27 - 35 }
    },
    body: [
      ['Raison sociale', { content: mock.raison_sociale, colSpan: 3, styles: { fontStyle: 'bold', textColor: [2, 132, 199] } }],
      ['Statut juridique', mock.statut_juridique, 'Numéro RC', mock.rc],
      ['Secteur d\'activité', { content: mock.secteur_activite, colSpan: 3 }],
      ['Phase du projet', mock.phase_projet, 'Date démarrage', mock.date_demarrage],
      ['Cible & Marché', { content: mock.cible, colSpan: 3, styles: { fontStyle: 'bold' } }],
      ['Promotion', mock.promotion, 'Accompagnateur', mock.accompagnateur],
      ['Membres d\'équipe', { content: `${mock.personnel_count} collaborateurs (calculé depuis RH)`, colSpan: 3, styles: { fontStyle: 'bold', textColor: [16, 185, 129] } }]
    ]
  });

  // ==========================================
  // 4. PARTIE BASSE : DESCRIPTION & ASSOCIÉS
  // ==========================================
  const bottomY = doc.lastAutoTable.finalY + 5;

  // Description du projet (Gauche)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text('3. DESCRIPTION DU PROJET & PROPOSITION DE VALEUR', col1X, bottomY);

  autoTable(doc, {
    startY: bottomY + 3,
    margin: { left: col1X, right: pw - col1X - colW },
    tableWidth: colW,
    theme: 'plain',
    styles: { 
      fontSize: 7.5, 
      cellPadding: 3, 
      font: 'helvetica', 
      lineColor: [226, 232, 240], 
      lineWidth: 0.25, 
      fillColor: [248, 250, 252], 
      textColor: [15, 23, 42] 
    },
    body: [[{ content: mock.description_projet }]]
  });

  // Associés & Équipe (Droite)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text(`4. ASSOCIÉS & ÉQUIPE DU PROJET (${mock.associes.length})`, col2X, bottomY);

  autoTable(doc, {
    startY: bottomY + 3,
    margin: { left: col2X, right: marginX },
    tableWidth: colW,
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, cellPadding: 1.8 },
    styles: { fontSize: 7.2, cellPadding: 1.8, font: 'helvetica', lineColor: [226, 232, 240], lineWidth: 0.2 },
    head: [['Nom & Prénom', 'CIN', 'Fonction', 'Badge RFID']],
    body: mock.associes.map(a => [a.nom, a.cin, a.fonction, a.badge_id])
  });

  // ==========================================
  // 5. PIED DE PAGE DISCRET
  // ==========================================
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.line(marginX, ph - 9, pw - marginX, ph - 9);
  doc.text('IDS — Incubateur Digital Solidaire • Salé • Fiche Signalétique Officielle Paysage', marginX, ph - 5.5);
  doc.text('Édité le ' + new Date().toLocaleDateString('fr-FR') + ' • Page 1 sur 1', pw - marginX, ph - 5.5, { align: 'right' });

  return doc;
}

const docV2 = buildSimplePdfV2();
const pdfPath = path.resolve(__dirname, '../../frontend/public/preview_simple_officiel.pdf');
fs.writeFileSync(pdfPath, Buffer.from(docV2.output('arraybuffer')));
console.log('Generated simple PDF V2 at:', pdfPath);
