const { jsPDF } = require('../../frontend/node_modules/jspdf');
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

const mockData = {
  nom_incube: 'BENALI Youssef',
  cin: 'AB123456',
  date_naissance: '14/05/1998',
  age: '28 ans',
  genre: 'Homme',
  situation_familiale: 'Célibataire',
  niveau_etude: 'Master / Ingénieur',
  specialite: 'Génie Logiciel & IA',
  ville: 'Salé',
  province: 'Salé',
  telephone: '06 12 34 56 78',
  email: 'youssef.benali@agritech.ma',
  linkedin: 'https://linkedin.com/in/youssef-benali',
  site_web: 'https://www.agri-tech.ma',
  raison_sociale: 'AGRI-TECH SOLUTIONS',
  statut_juridique: 'SARL AU',
  rc: '145890',
  secteur_activite: 'AgriTech / IoT',
  phase_projet: 'Lancement',
  cible: 'B2B / B2G',
  date_demarrage: '01/09/2026',
  promotion: 'Promotion 2026 - S2',
  accompagnateur: 'Mme Salma TAZI',
  description_projet: "AGRI-TECH SOLUTIONS développe des capteurs IoT intelligents et une plateforme d'analyse prédictive pour optimiser l'irrigation agricole et réduire les coûts hydriques des exploitations au Maroc.",
  personnel_count: 5,
  associes_count: 3
};

function drawQrBox(doc, x, y, size, label, link = '', color = [15, 23, 42]) {
  // Background card
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(x, y, size, size + 10, 2.5, 2.5, 'FD');

  // QR Code Finder Patterns
  const pad = 2.5;
  const qrSize = size - pad * 2;
  const finderSize = 4.2;
  doc.setFillColor(...color);

  // 3 outer finders
  doc.rect(x + pad, y + pad, finderSize, finderSize, 'F');
  doc.rect(x + pad + qrSize - finderSize, y + pad, finderSize, finderSize, 'F');
  doc.rect(x + pad, y + pad + qrSize - finderSize, finderSize, finderSize, 'F');

  // Matrix pattern dots
  const matrixStart = pad + finderSize + 1.2;
  const dotStep = 1.3;
  for (let dy = 0; dy < 6; dy++) {
    for (let dx = 0; dx < 6; dx++) {
      if ((dx + dy) % 2 === 0 || (dx * 2 + dy) % 3 === 0) {
        doc.rect(x + matrixStart + dx * dotStep, y + matrixStart + dy * dotStep, 0.85, 0.85, 'F');
      }
    }
  }

  // Label under QR Code
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...color);
  doc.text(label, x + size / 2, y + size + 4, { align: 'center' });

  // Optional mini link text
  if (link) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    const shortLink = link.replace(/^https?:\/\/(www\.)?/, '').slice(0, 18);
    doc.text(shortLink, x + size / 2, y + size + 7.5, { align: 'center' });
  }
}

function buildSimpleHorizontal() {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pw = 297, ph = 210;

  // Background: clean off-white / light slate
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, pw, ph, 'F');

  // Top header band: pure white with fine bottom border
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pw, 30, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(0, 30, pw, 30);

  // ==========================================
  // 1. LES DEUX LOGOS STRICTEMENT ÉGAUX
  // ==========================================
  // Dimensions exactes des deux cadres de logos : 38mm x 14mm
  const badgeW = 38, badgeH = 14, badgeY = 8, badgeRadius = 2.5;

  // Logo IDS (Gauche)
  const idsBadgeX = 14;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(idsBadgeX, badgeY, badgeW, badgeH, badgeRadius, badgeRadius, 'FD');
  // Logo IDS centré
  doc.addImage(idsLogo, 'PNG', idsBadgeX + (badgeW - 12) / 2, badgeY + (badgeH - 12) / 2, 12, 12);

  // Logo CTPES (Droite) - Format 100% IDENTIQUE
  const ctpesBadgeX = pw - 14 - badgeW;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(ctpesBadgeX, badgeY, badgeW, badgeH, badgeRadius, badgeRadius, 'FD');
  // Logo CTPES centré
  doc.addImage(ctpesLogo, 'PNG', ctpesBadgeX + (badgeW - 31) / 2, badgeY + (badgeH - 7.1) / 2, 31, 7.1);

  // Titre En-Tête Centré
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('INCUBATEUR DIGITAL SOLIDAIRE (IDS)', pw / 2, 14, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(2, 132, 199); // primary sky-600
  doc.text('FICHE SIGNALÉTIQUE & INFORMATIONS GÉNÉRALES', pw / 2, 21, { align: 'center' });

  // ==========================================
  // 2. CORPS PRINCIPAL : 2 GRANDES CARTES AÉRÉES
  // ==========================================
  const marginX = 14;
  const colGap = 8;
  const colW = (pw - marginX * 2 - colGap) / 2; // (297 - 28 - 8) / 2 = 130.5 mm
  const col1X = marginX;
  const col2X = marginX + colW + colGap;
  const topY = 36;
  const card1H = 92;

  // --- CARTE GAUCHE : PROFIL DE L'INCUBÉ ---
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(col1X, topY, colW, card1H, 3, 3, 'FD');

  // En-tête de carte
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(col1X, topY, colW, 10, 3, 3, 'F');
  doc.rect(col1X, topY + 7, colW, 3, 'F'); // flush bottom
  doc.setDrawColor(226, 232, 240);
  doc.line(col1X, topY + 10, col1X + colW, topY + 10);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('1. PROFIL & IDENTITÉ DU PORTEUR', col1X + 7, topY + 6.8);

  // Photo de l'incubé (Cadre propre à gauche)
  const photoW = 34, photoH = 44;
  const photoX = col1X + 8;
  const photoY = topY + 16;

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(photoX, photoY, photoW, photoH, 2, 2, 'FD');

  if (samplePhoto) {
    try {
      doc.addImage(samplePhoto, 'PNG', photoX, photoY, photoW, photoH);
      doc.setDrawColor(2, 132, 199);
      doc.setLineWidth(0.5);
      doc.roundedRect(photoX, photoY, photoW, photoH, 2, 2, 'S');
    } catch (e) {}
  }

  // Informations textuelles du porteur (à droite de la photo)
  const infoX = photoX + photoW + 7;
  let textY = topY + 20;

  // Nom complet en grand
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(mockData.nom_incube.toUpperCase(), infoX, textY);

  textY += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`CIN : `, infoX, textY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(mockData.cin, infoX + 10, textY);

  textY += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Né le : `, infoX, textY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${mockData.date_naissance} (${mockData.age})`, infoX + 11, textY);

  textY += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Genre : `, infoX, textY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${mockData.genre}, ${mockData.situation_familiale}`, infoX + 13, textY);

  textY += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Niveau : `, infoX, textY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(mockData.niveau_etude, infoX + 13, textY);

  textY += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Spécialité : `, infoX, textY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(2, 132, 199);
  doc.text(mockData.specialite, infoX + 18, textY);

  textY += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Ville : `, infoX, textY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(mockData.ville, infoX + 10, textY);

  // Bandeau Contact sous la photo
  const contactY = topY + 68;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(col1X + 8, contactY, colW - 16, 18, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Téléphone :", col1X + 12, contactY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(mockData.telephone, col1X + 32, contactY + 6);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text("Email :", col1X + 12, contactY + 12.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(mockData.email, col1X + 25, contactY + 12.5);

  // --- CARTE DROITE : ENTREPRISE & PROJET ---
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(col2X, topY, colW, card1H, 3, 3, 'FD');

  // En-tête de carte droite
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(col2X, topY, colW, 10, 3, 3, 'F');
  doc.rect(col2X, topY + 7, colW, 3, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.line(col2X, topY + 10, col2X + colW, topY + 10);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text("2. ENTREPRISE, MARCHÉ & ENCADREMENT", col2X + 7, topY + 6.8);

  // Raison sociale en grand
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(2, 132, 199);
  doc.text(mockData.raison_sociale, col2X + 8, topY + 20);

  // Grille 2 colonnes d'indicateurs
  const gridLeftX = col2X + 8;
  const gridRightX = col2X + colW / 2 + 2;
  let gY = topY + 28;
  const gSpacing = 6.2;

  // Ligne 1
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(100, 116, 139);
  doc.text("Statut juridique :", gridLeftX, gY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(mockData.statut_juridique, gridLeftX + 27, gY);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text("RC :", gridRightX, gY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(mockData.rc, gridRightX + 8, gY);

  // Ligne 2
  gY += gSpacing;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text("Secteur :", gridLeftX, gY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(mockData.secteur_activite, gridLeftX + 15, gY);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text("Phase :", gridRightX, gY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(2, 132, 199);
  doc.text(mockData.phase_projet, gridRightX + 13, gY);

  // Ligne 3 (Cible et Date de démarrage)
  gY += gSpacing;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text("Cible & Marché :", gridLeftX, gY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(mockData.cible, gridLeftX + 26, gY);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text("Démarrage :", gridRightX, gY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(mockData.date_demarrage, gridRightX + 20, gY);

  // Ligne 4 (Promotion & Accompagnateur)
  gY += gSpacing;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text("Promotion :", gridLeftX, gY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(mockData.promotion, gridLeftX + 19, gY);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text("Conseiller :", gridRightX, gY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(mockData.accompagnateur, gridRightX + 18, gY);

  // Bloc Équipe RH & Associés en bas de carte droite
  const teamBoxY = topY + 58;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(col2X + 8, teamBoxY, colW - 16, 28, 2, 2, 'FD');

  // Séparateur vertical milieu
  const teamMidX = col2X + colW / 2;
  doc.line(teamMidX, teamBoxY + 3, teamMidX, teamBoxY + 25);

  // Colonne Gauche : Équipe (RH)
  const leftCenterX = col2X + 8 + (colW - 16) / 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(2, 132, 199);
  doc.text(String(mockData.personnel_count).padStart(2, '0'), leftCenterX, teamBoxY + 11, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text("Membres d'équipe", leftCenterX, teamBoxY + 17, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(16, 185, 129); // green
  doc.text("(Calculé depuis RH)", leftCenterX, teamBoxY + 22, { align: 'center' });

  // Colonne Droite : Associés
  const rightCenterX = teamMidX + (colW - 16) / 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(245, 158, 11); // amber
  doc.text(String(mockData.associes_count).padStart(2, '0'), rightCenterX, teamBoxY + 11, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text("Nombre d'associés", rightCenterX, teamBoxY + 17, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text("(Porteur inclus)", rightCenterX, teamBoxY + 22, { align: 'center' });

  // ==========================================
  // 3. ZONE BAS : DESCRIPTION DU PROJET & LES 2 QR CODES
  // ==========================================
  const botY = topY + card1H + 6;
  const botH = 68;

  // --- BLOC DESCRIPTION (Gauche) ---
  const descCardW = colW + (colW - 68); // ~ 193 mm
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(col1X, botY, descCardW, botH, 3, 3, 'FD');

  // En-tête Description
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(col1X, botY, descCardW, 9, 3, 3, 'F');
  doc.rect(col1X, botY + 6, descCardW, 3, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.line(col1X, botY + 9, col1X + descCardW, botY + 9);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("3. DESCRIPTION DU PROJET & PROPOSITION DE VALEUR", col1X + 7, botY + 6.2);

  // Texte descriptif
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  const splitText = doc.splitTextToSize(mockData.description_projet, descCardW - 16);
  doc.text(splitText, col1X + 8, botY + 16, { lineHeightFactor: 1.4 });

  // --- BLOC LES 2 QR CODES (Droite) ---
  const qrAreaX = col1X + descCardW + 6; // Starts right next to description card
  const qrAreaW = pw - marginX - qrAreaX; // ~ 68 mm

  // QR 1 : LinkedIn
  const qrBoxSize = 31;
  const qr1X = qrAreaX + 1.5;
  drawQrBox(doc, qr1X, botY + 2, qrBoxSize, 'LinkedIn', mockData.linkedin, [10, 102, 194]);

  // QR 2 : Site Web
  const qr2X = qrAreaX + qrBoxSize + 4.5;
  drawQrBox(doc, qr2X, botY + 2, qrBoxSize, 'Site Web', mockData.site_web, [2, 132, 199]);

  // ==========================================
  // 4. PIED DE PAGE DISCRET
  // ==========================================
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(148, 163, 184);
  doc.text('INCUBATEUR DIGITAL SOLIDAIRE (IDS)  •  DOCUMENT CONFIDENTIEL OFFICIEL', 14, ph - 4);

  doc.text('CENTRE DES TRÈS PETITES ENTREPRISES SOLIDAIRES (CTPES)  •  SALÉ', pw - 14, ph - 4, { align: 'right' });

  return doc;
}

// Generate PDF
const pdfDoc = buildSimpleHorizontal();
const pdfPath = path.resolve(__dirname, '../../frontend/public/preview_horizontal_simple.pdf');
fs.writeFileSync(pdfPath, Buffer.from(pdfDoc.output('arraybuffer')));
console.log('PDF generated at:', pdfPath);
