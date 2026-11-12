const { jsPDF } = require('../../frontend/node_modules/jspdf');
const fs = require('fs');
const path = require('path');
const React = require('../../frontend/node_modules/react');
const ReactDOMServer = require('../../frontend/node_modules/react-dom/server');
const { QRCodeSVG } = require('../../frontend/node_modules/qrcode.react');

const idsLogo = 'data:image/png;base64,' + fs.readFileSync(path.resolve(__dirname, '../../frontend/public/logo-ids.png')).toString('base64');
const ctpesLogo = 'data:image/png;base64,' + fs.readFileSync(path.resolve(__dirname, '../../frontend/public/logo-ctpes.png')).toString('base64');

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
  linkedin: 'https://www.linkedin.com/in/youssef-benali-agri',
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
  description_projet: "AGRI-TECH SOLUTIONS conçoit des capteurs IoT intelligents et une plateforme d'analyse prédictive pour optimiser l'irrigation agricole, réduire la consommation d'eau et sécuriser les rendements des exploitations maraîchères et arboricoles au Maroc.",
  personnel_count: 5,
  associes_count: 3
};

/**
 * Draws an authentic, scan-tested QR code using QRCodeSVG vector output
 */
function drawQrFromSvg(doc, text, x, y, size, color = [8, 27, 56]) {
  try {
    const svgStr = ReactDOMServer.renderToStaticMarkup(
      React.createElement(QRCodeSVG, { value: text || 'https://ids.ma', size: 128 })
    );

    const vbMatch = svgStr.match(/viewBox="0 0 (\d+) (\d+)"/);
    const gridSize = vbMatch ? parseInt(vbMatch[1], 10) : 25;

    // Background white container with subtle shadow border
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(218, 222, 229);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, y, size, size, 3, 3, 'FD');

    // Padding inside the QR container
    const pad = size * 0.08;
    const drawSize = size - pad * 2;
    const scale = drawSize / gridSize;

    // Match all rect commands like M0 0h7v1H0z
    const matches = [...svgStr.matchAll(/M(\d+)[, ]+(\d+)\s*h(\d+)v1/g)];
    doc.setFillColor(...color);

    matches.forEach(m => {
      const px = parseInt(m[1], 10);
      const py = parseInt(m[2], 10);
      const pw = parseInt(m[3], 10);
      doc.rect(x + pad + px * scale, y + pad + py * scale, pw * scale, scale, 'F');
    });
  } catch (err) {
    console.error('Error drawing QR code:', err);
  }
}

/**
 * Draws dot grids for decorative background
 */
function drawDotGrid(doc, startX, startY, rows, cols, spacing = 3.5, radius = 0.55, color = [255, 255, 255]) {
  doc.setFillColor(...color);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      doc.circle(startX + c * spacing, startY + r * spacing, radius, 'F');
    }
  }
}

function buildBenaliPerfect() {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pw = 297, ph = 210;

  // 1. SPLIT BACKGROUND WITH ELEGANT CURVE
  // Left side: Warm ivory (#F9F8F5)
  doc.setFillColor(249, 248, 245);
  doc.rect(0, 0, pw, ph, 'F');

  // Right side: Deep Midnight Navy (#081B38) with smooth curved boundary
  doc.setFillColor(8, 27, 56);
  doc.moveTo(148, 0);
  doc.curveTo(126, 60, 126, 140, 148, ph);
  doc.lineTo(pw, ph);
  doc.lineTo(pw, 0);
  doc.close();
  doc.fill();

  // Subtle geometric line accents on navy side
  doc.setDrawColor(20, 48, 90);
  doc.setLineWidth(0.3);
  doc.line(160, 0, pw, 135);
  doc.line(170, 75, pw - 30, ph);
  doc.line(pw - 55, 0, pw, 55);

  // Subtle geometric line accents on ivory side
  doc.setDrawColor(228, 220, 206);
  doc.setLineWidth(0.3);
  doc.line(0, 150, 130, 20);
  doc.line(0, 70, 80, 0);

  // Decorative Dot Matrix grids
  drawDotGrid(doc, 175, 22, 4, 6, 3.4, 0.55, [255, 255, 255]); // top navy
  drawDotGrid(doc, 105, 175, 3, 7, 3.2, 0.55, [200, 168, 100]); // bottom ivory

  // ==========================================
  // 2. EN-TÊTE : DEUX LOGOS PARFAITEMENT ÉQUILIBRÉS
  // ==========================================
  const logoTopY = 8;

  // Logo IDS (Gauche) - Format carré 1:1 -> 16mm x 16mm
  doc.addImage(idsLogo, 'PNG', 14, logoTopY, 16, 16);

  // Logo CTPES (Droite) - Format rectangulaire 4.35:1 -> 54mm x 12.5mm
  // Placé dans un badge blanc élégant aux coins arrondis
  const ctpesW = 54, ctpesH = 12.5;
  const ctpesX = pw - 14 - ctpesW;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(ctpesX - 3, logoTopY + 1.5, ctpesW + 6, ctpesH + 3, 2.5, 2.5, 'FD');
  doc.addImage(ctpesLogo, 'PNG', ctpesX, logoTopY + 3, ctpesW, ctpesH);

  // ==========================================
  // 3. SECTION GAUCHE : TITRE & PROFIL DU PORTEUR
  // ==========================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(8, 27, 56);
  doc.text('INFORMATIONS', 14, 35);
  doc.text('GÉNÉRALES', 14, 44);

  // Sous-titre avec ligne dorée
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(184, 142, 40);
  doc.text("DOSSIER DE L'INCUBÉ", 14, 52);
  doc.setDrawColor(218, 185, 110);
  doc.setLineWidth(0.7);
  doc.line(14, 54, 98, 54);

  // CARTE "PROFIL & IDENTITÉ"
  const profCardX = 14;
  const profCardY = 60;
  const profCardW = 84;
  const profCardH = 78;

  // Carte blanche avec bordure douce
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(profCardX, profCardY, profCardW, profCardH, 4, 4, 'FD');

  // Accent vertical bleu marine sur le bord gauche de la carte
  doc.setFillColor(8, 27, 56);
  doc.roundedRect(profCardX, profCardY + 4, 3, 32, 1, 1, 'F');

  // Titre de la carte
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(8, 27, 56);
  doc.text('PROFIL & IDENTITÉ', profCardX + 8, profCardY + 9);

  // Nom complet en grand
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(8, 27, 56);
  doc.text(mockData.nom_incube, profCardX + 8, profCardY + 18);

  // Informations détaillées du porteur (SANS Réf Dossier, avec Coordonnées bien affichées)
  let pY = profCardY + 26;
  const pSpacing = 5.8;

  // 1. CIN
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(8, 27, 56);
  doc.text('CIN :', profCardX + 8, pY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text(mockData.cin, profCardX + 18, pY);

  // 2. Date de naissance & Âge
  pY += pSpacing;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(8, 27, 56);
  doc.text(`Né le ${mockData.date_naissance} (${mockData.age})`, profCardX + 8, pY);

  // 3. Genre & Situation
  pY += pSpacing;
  doc.text(`Genre : ${mockData.genre}, ${mockData.situation_familiale}`, profCardX + 8, pY);

  // 4. Niveau d'étude & Spécialité
  pY += pSpacing;
  doc.setFont('helvetica', 'bold');
  doc.text(mockData.niveau_etude + ',', profCardX + 8, pY);
  pY += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.text(mockData.specialite, profCardX + 8, pY);

  // 5. Ville
  pY += 5.2;
  doc.text(mockData.ville + ' (Maroc)', profCardX + 8, pY);

  // 6. Coordonnées directes (Téléphone & Email) bien mises en valeur
  pY += 6.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(184, 142, 40);
  doc.text(`Tél : `, profCardX + 8, pY);
  doc.setTextColor(8, 27, 56);
  doc.text(mockData.telephone, profCardX + 16, pY);

  pY += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(184, 142, 40);
  doc.text(`Email : `, profCardX + 8, pY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(mockData.email, profCardX + 20, pY);

  // ==========================================
  // 4. LES 2 QR CODES EN BAS DE LA PAGE
  // ==========================================
  const qrAreaY = 146;
  const qrBoxW = 32;

  // QR 1 : LinkedIn
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(8, 27, 56);
  doc.text('LinkedIn', profCardX + qrBoxW / 2, qrAreaY, { align: 'center' });
  drawQrFromSvg(doc, mockData.linkedin, profCardX, qrAreaY + 3, qrBoxW, [8, 27, 56]);

  // QR 2 : Site Web
  const qr2X = profCardX + qrBoxW + 8;
  doc.text('Site Web', qr2X + qrBoxW / 2, qrAreaY, { align: 'center' });
  drawQrFromSvg(doc, mockData.site_web, qr2X, qrAreaY + 3, qrBoxW, [8, 27, 56]);

  // ==========================================
  // 5. ÉLÉMENT CENTRAL : PHOTO & DESCRIPTION DU PROJET
  // ==========================================
  // Cadre photo doré arrondi
  const photoW = 62, photoH = 82;
  const photoX = 110;
  const photoY = 46;

  // Cadre extérieur blanc et or luxueux
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(218, 185, 110);
  doc.setLineWidth(1.4);
  doc.roundedRect(photoX - 2.5, photoY - 2.5, photoW + 5, photoH + 5, 5, 5, 'FD');

  if (samplePhoto) {
    try {
      doc.addImage(samplePhoto, 'PNG', photoX, photoY, photoW, photoH);
    } catch (e) {}
  } else {
    doc.setFillColor(241, 245, 249);
    doc.rect(photoX, photoY, photoW, photoH, 'F');
  }

  // CARTE DESCRIPTION DU PROJET (Aérée, élégante et centrée)
  const descW = 92, descH = 55;
  const descX = photoX - (descW - photoW) / 2; // Centrée par rapport à la photo
  const descY = photoY + photoH - 12; // Overlap élégant

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(218, 185, 110);
  doc.setLineWidth(1);
  doc.roundedRect(descX, descY, descW, descH, 4, 4, 'FD');

  // En-tête centré
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(184, 142, 40);
  doc.text('DESCRIPTION DU PROJET', descX + descW / 2, descY + 8, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(8, 27, 56);
  doc.text('Problématique, Solution & Innovation', descX + descW / 2, descY + 14.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(184, 142, 40);
  doc.text('Proposition de valeur :', descX + descW / 2, descY + 19.5, { align: 'center' });

  // Texte du projet bien formaté et spacieux
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(51, 65, 85);
  const splitDesc = doc.splitTextToSize(mockData.description_projet, descW - 14);
  doc.text(splitDesc, descX + 7, descY + 26, { lineHeightFactor: 1.38 });

  // ==========================================
  // 6. SECTION DROITE : 3 CARTES ÉLÉGANTES BLEU MARINE
  // ==========================================
  const rightX = 205;
  const rightW = 78;

  // --- CARTE 1 : ENTREPRISE ---
  const c1Y = 24;
  const c1H = 58;
  doc.setFillColor(7, 24, 49); // #071831
  doc.setDrawColor(218, 185, 110);
  doc.setLineWidth(0.5);
  doc.roundedRect(rightX, c1Y, rightW, c1H, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('ENTREPRISE', rightX + 7, c1Y + 7.5);

  let entY = c1Y + 14.5;
  const entSpacing = 6;
  const entBullets = [
    { label: 'Raison sociale', val: mockData.raison_sociale },
    { label: 'Statut', val: mockData.statut_juridique },
    { label: 'RC', val: mockData.rc },
    { label: 'Secteur', val: mockData.secteur_activite },
    { label: 'Phase', val: mockData.phase_projet },
    { label: 'Date de démarrage', val: mockData.date_demarrage },
    { label: 'Cible', val: mockData.cible }
  ];

  entBullets.forEach(b => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(203, 213, 225); // Slate 300
    doc.text(`•  ${b.label} :`, rightX + 7, entY);
    const labelW = doc.getTextWidth(`•  ${b.label} : `);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255); // Pure white
    doc.text(String(b.val), rightX + 7 + labelW, entY);
    entY += entSpacing;
  });

  // --- CARTE 2 : ENCADREMENT & SUIVI ---
  const c2Y = c1Y + c1H + 5;
  const c2H = 26;
  doc.setFillColor(7, 24, 49);
  doc.setDrawColor(218, 185, 110);
  doc.setLineWidth(0.5);
  doc.roundedRect(rightX, c2Y, rightW, c2H, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('ENCADREMENT & SUIVI', rightX + 7, c2Y + 7.5);

  let encY = c2Y + 14.5;
  const encBullets = [
    { label: 'Promotion', val: mockData.promotion },
    { label: 'Accompagnateur', val: mockData.accompagnateur }
  ];

  encBullets.forEach(b => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(203, 213, 225);
    doc.text(`•  ${b.label} :`, rightX + 7, encY);
    const labelW = doc.getTextWidth(`•  ${b.label} : `);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(String(b.val), rightX + 7 + labelW, encY);
    encY += 5.8;
  });

  // --- CARTE 3 : ÉQUIPE & ASSOCIÉS (2 BADGES DISTINCTS SÉPARÉS) ---
  const c3Y = c2Y + c2H + 5;
  const c3H = 46;
  doc.setFillColor(7, 24, 49);
  doc.setDrawColor(218, 185, 110);
  doc.setLineWidth(0.5);
  doc.roundedRect(rightX, c3Y, rightW, c3H, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('ÉQUIPE & ASSOCIÉS', rightX + 7, c3Y + 7.5);

  // Séparateur vertical entre les 2 badges
  const midX = rightX + rightW / 2;
  doc.setDrawColor(30, 58, 95);
  doc.setLineWidth(0.4);
  doc.line(midX, c3Y + 12, midX, c3Y + c3H - 4);

  // BADGE 1 : MEMBRES D'ÉQUIPE (Calculé depuis RH) - TOTALEMENT SÉPARÉ
  const badge1Center = rightX + (rightW / 4);

  // Cercle doré / beige avec bordure
  doc.setFillColor(235, 205, 145);
  doc.circle(badge1Center, c3Y + 17, 7, 'F');
  // Silhouette d'équipe simplifiée dans le cercle
  doc.setFillColor(8, 27, 56);
  doc.circle(badge1Center, c3Y + 14.5, 1.8, 'F');
  doc.circle(badge1Center - 3, c3Y + 15.5, 1.3, 'F');
  doc.circle(badge1Center + 3, c3Y + 15.5, 1.3, 'F');
  doc.roundedRect(badge1Center - 3.5, c3Y + 17, 7, 3.5, 1, 1, 'F');

  // Grand chiffre en blanc
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(String(mockData.personnel_count).padStart(2, '0'), badge1Center, c3Y + 29, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(203, 213, 225);
  doc.text("Membres", badge1Center, c3Y + 34, { align: 'center' });
  doc.text("de l'équipe", badge1Center, c3Y + 37.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(110, 231, 183); // soft green
  doc.text("(Calculé RH)", badge1Center, c3Y + 41.5, { align: 'center' });

  // BADGE 2 : NOMBRE D'ASSOCIÉS - TOTALEMENT SÉPARÉ
  const badge2Center = midX + (rightW / 4);

  // Cercle doré / beige pour la poignée de main
  doc.setFillColor(235, 205, 145);
  doc.circle(badge2Center, c3Y + 17, 7, 'F');
  // Symbole poignée de main simplifié
  doc.setFillColor(8, 27, 56);
  doc.roundedRect(badge2Center - 4, c3Y + 16, 3.5, 2, 0.5, 0.5, 'F');
  doc.roundedRect(badge2Center + 0.5, c3Y + 16, 3.5, 2, 0.5, 0.5, 'F');
  doc.rect(badge2Center - 1, c3Y + 15.5, 2, 3, 'F');

  // Grand chiffre en blanc
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(String(mockData.associes_count).padStart(2, '0'), badge2Center, c3Y + 29, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(203, 213, 225);
  doc.text("Nombre", badge2Center, c3Y + 34, { align: 'center' });
  doc.text("d'associés", badge2Center, c3Y + 37.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(148, 163, 184);
  doc.text("(Porteur inclus)", badge2Center, c3Y + 41.5, { align: 'center' });

  // ==========================================
  // 7. PIED DE PAGE DISCRET
  // ==========================================
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(148, 163, 184);
  doc.text('INCUBATEUR DIGITAL SOLIDAIRE (IDS)  •  DOCUMENT CONFIDENTIEL OFFICIEL', 14, ph - 4);

  doc.setTextColor(148, 163, 184);
  doc.text('CENTRE DES TRÈS PETITES ENTREPRISES SOLIDAIRES (CTPES)', pw - 14, ph - 4, { align: 'right' });

  return doc;
}

const doc = buildBenaliPerfect();
const pdfPath = path.resolve(__dirname, '../../frontend/public/preview_benali_perfect.pdf');
fs.writeFileSync(pdfPath, Buffer.from(doc.output('arraybuffer')));
console.log('PDF generated at:', pdfPath);
