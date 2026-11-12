const { jsPDF } = require('../../frontend/node_modules/jspdf');
const fs = require('fs');
const path = require('path');

const idsLogo = 'data:image/png;base64,' + fs.readFileSync(path.resolve(__dirname, '../../frontend/public/logo-ids.png')).toString('base64');
const ctpesLogo = 'data:image/png;base64,' + fs.readFileSync(path.resolve(__dirname, '../../frontend/public/logo-ctpes.png')).toString('base64');

// Sample portrait from user reference if available, else generated avatar
let samplePhoto = null;
const samplePhotoPath = path.resolve(__dirname, '../../sample_photo.png');
if (fs.existsSync(samplePhotoPath)) {
  samplePhoto = 'data:image/png;base64,' + fs.readFileSync(samplePhotoPath).toString('base64');
}

const mockData = {
  nom_incube: 'HALIM Bahae Eddine',
  cin: 'AB123456',
  date_naissance: '15/05/1996',
  age: '28 ans',
  niveau_etude: 'BAC+8 (Doctorat)',
  specialite: 'Intelligence Artificielle',
  site_web: 'WWW.XAI.MA',
  telephone: '06 12 34 56 78',
  linkedin: 'linkedin.com/in/bahae-halim',
  raison_sociale: 'XAI',
  statut_juridique: 'SARL',
  secteur_activite: 'xTech / DeepTech',
  phase_projet: 'Croissance',
  cible: 'B2B / B2G / B2B2C',
  equipe: "5 membres (Porteur + 4 Associés)",
  description_projet: "XAI bâtit des infrastructures d'IA souveraines via une expertise 360° : conseil, développement Full-Stack, Cloud MLOps et formation. Notre écosystème déploie des solutions innovantes (Santé, Agri, Education, Gov, RH, Juridique...) pour sécuriser vos données et accélérer votre innovation grâce aux technologies les plus avancées."
};

// ==========================================
// HELPER DRAWING FUNCTIONS
// ==========================================

function drawHexagon(doc, cx, cy, r, fillColor = null, strokeColor = null, lineWidth = 0.4) {
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    points.push({
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle)
    });
  }

  if (strokeColor) {
    doc.setDrawColor(...strokeColor);
    doc.setLineWidth(lineWidth);
  }
  if (fillColor) {
    doc.setFillColor(...fillColor);
  }

  doc.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < 6; i++) {
    doc.lineTo(points[i].x, points[i].y);
  }
  doc.lineTo(points[0].x, points[0].y);

  if (fillColor && strokeColor) {
    doc.fillStroke();
  } else if (fillColor) {
    doc.fill();
  } else if (strokeColor) {
    doc.stroke();
  }
}

function drawShowcaseCapsule(doc, x, y, width, height, text, options = {}) {
  const {
    bgColor = [0, 37, 77],        // IDS Deep Navy
    hexColor = [255, 255, 255],   // White hexagon
    textColor = [255, 255, 255],
    hexBorderColor = null,
    fontSize = 9.5
  } = options;

  const r = height / 2;

  // Background rounded capsule
  doc.setFillColor(...bgColor);
  doc.roundedRect(x, y, width, height, r, r, 'F');

  // Left hexagon bullet
  const hexR = height * 0.40;
  drawHexagon(doc, x + r, y + r, hexR, hexColor, hexBorderColor, 0.3);

  // Right hexagon bullet
  drawHexagon(doc, x + width - r, y + r, hexR, hexColor, hexBorderColor, 0.3);

  // Text inside capsule
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSize);
  doc.setTextColor(...textColor);
  doc.text(text, x + width / 2, y + height / 2 + 1.2, { align: 'center' });
}

function drawDotGrid(doc, startX, startY, rows, cols, spacing = 3, radius = 0.55, color = [0, 37, 77]) {
  doc.setFillColor(...color);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      doc.circle(startX + c * spacing, startY + r * spacing, radius, 'F');
    }
  }
}

function drawQrCodeBox(doc, cx, cy, size, color = [0, 37, 77], bgFill = null) {
  const half = size / 2;
  const x = cx - half;
  const y = cy - half;
  const bracketLen = 3.5;
  const lw = 0.7;

  if (bgFill) {
    doc.setFillColor(...bgFill);
    doc.roundedRect(x - 2, y - 2, size + 4, size + 4, 2, 2, 'F');
  }

  doc.setDrawColor(...color);
  doc.setLineWidth(lw);

  // 4 Corner Brackets
  // Top-left
  doc.line(x, y + bracketLen, x, y);
  doc.line(x, y, x + bracketLen, y);
  // Top-right
  doc.line(x + size - bracketLen, y, x + size, y);
  doc.line(x + size, y, x + size, y + bracketLen);
  // Bottom-left
  doc.line(x, y + size - bracketLen, x, y + size);
  doc.line(x, y + size, x + bracketLen, y + size);
  // Bottom-right
  doc.line(x + size - bracketLen, y + size, x + size, y + size);
  doc.line(x + size, y + size - bracketLen, x + size, y + size);

  // QR Code Finder Patterns
  const pad = 2;
  const finderSize = 3.8;
  doc.setFillColor(...color);

  // 3 outer finders
  doc.rect(x + pad, y + pad, finderSize, finderSize, 'F');
  doc.rect(x + size - pad - finderSize, y + pad, finderSize, finderSize, 'F');
  doc.rect(x + pad, y + size - pad - finderSize, finderSize, finderSize, 'F');

  // Center QR matrix dots
  const matrixStart = pad + finderSize + 1.2;
  const dotStep = 1.3;
  for (let dy = 0; dy < 5; dy++) {
    for (let dx = 0; dx < 5; dx++) {
      if ((dx + dy) % 2 === 0 || (dx * 2 + dy) % 3 === 0) {
        doc.rect(x + matrixStart + dx * dotStep, y + matrixStart + dy * dotStep, 0.9, 0.9, 'F');
      }
    }
  }
}

// ==========================================
// BUILD VARIANT 1: BLANCHE & MARINE (Clean Executive)
// ==========================================
function buildVariant1() {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pw = 297, ph = 210;

  // Background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pw, ph, 'F');

  // Decorative Top-Left Wave
  doc.setFillColor(0, 37, 77); // IDS Deep Navy
  doc.moveTo(0, 0);
  doc.lineTo(85, 0);
  doc.curveTo(60, 45, 10, 80, 0, 95);
  doc.fill();

  // Accent Arc (IDS Amber #F59E0B)
  doc.setFillColor(245, 158, 11);
  doc.moveTo(85, 0);
  doc.lineTo(92, 0);
  doc.curveTo(68, 48, 14, 88, 0, 104);
  doc.lineTo(0, 95);
  doc.curveTo(10, 80, 60, 45, 85, 0);
  doc.fill();

  // Decorative Bottom-Right Wave
  doc.setFillColor(0, 37, 77); // IDS Deep Navy
  doc.moveTo(pw, ph);
  doc.lineTo(pw - 85, ph);
  doc.curveTo(pw - 55, ph - 35, pw - 20, ph - 65, pw, ph - 75);
  doc.fill();

  // Accent Arc (IDS Sky Blue)
  doc.setFillColor(2, 132, 199);
  doc.moveTo(pw - 85, ph);
  doc.lineTo(pw - 93, ph);
  doc.curveTo(pw - 62, ph - 38, pw - 25, ph - 72, pw, ph - 83);
  doc.lineTo(pw, ph - 75);
  doc.curveTo(pw - 20, ph - 65, pw - 55, ph - 35, pw - 85, ph);
  doc.fill();

  // Logos in Header
  doc.addImage(idsLogo, 'PNG', 14, 8, 18, 18);
  doc.addImage(ctpesLogo, 'PNG', pw - 14 - 44, 12, 44, 10.1);

  // LEFT COLUMN: Incubé Photo & Personal Badges
  // Photo in Hexagonal Frame
  const photoCx = 65, photoCy = 65, photoR = 25;
  // Background hexagon for photo
  drawHexagon(doc, photoCx, photoCy, photoR + 1.8, [245, 158, 11], null);
  drawHexagon(doc, photoCx, photoCy, photoR, [241, 245, 249], [0, 37, 77], 0.8);

  if (samplePhoto) {
    try {
      // Clip or draw photo centered inside hexagon
      doc.addImage(samplePhoto, 'PNG', photoCx - photoR + 2, photoCy - photoR + 2, (photoR - 2) * 2, (photoR - 2) * 2);
      // Re-stroke hexagon border
      drawHexagon(doc, photoCx, photoCy, photoR, null, [0, 37, 77], 0.8);
    } catch (e) {}
  }

  // Dot matrix near photo
  drawDotGrid(doc, photoCx + photoR + 5, photoCy - 10, 4, 3, 3, 0.6, [245, 158, 11]);

  // Incubé Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(0, 37, 77); // IDS Navy
  doc.text(mockData.nom_incube, photoCx, 103, { align: 'center' });

  // 3 Left Capsules
  const capW = 88, capH = 9;
  const capLeftX = photoCx - capW / 2;
  drawShowcaseCapsule(doc, capLeftX, 112, capW, capH, `Niveau d'étude : ${mockData.niveau_etude}`, {
    bgColor: [0, 37, 77],
    hexColor: [255, 255, 255],
    textColor: [255, 255, 255]
  });
  drawShowcaseCapsule(doc, capLeftX, 125, capW, capH, mockData.specialite, {
    bgColor: [0, 37, 77],
    hexColor: [255, 255, 255],
    textColor: [255, 255, 255]
  });
  drawShowcaseCapsule(doc, capLeftX, 138, capW, capH, mockData.site_web, {
    bgColor: [0, 37, 77],
    hexColor: [255, 255, 255],
    textColor: [255, 255, 255]
  });

  // Additional contact pill
  drawShowcaseCapsule(doc, capLeftX, 151, capW, capH, `Tél : ${mockData.telephone}  •  ${mockData.cin}`, {
    bgColor: [248, 250, 252],
    hexColor: [245, 158, 11],
    textColor: [0, 37, 77],
    hexBorderColor: [0, 37, 77]
  });

  // CENTER COLUMN: Hexagon Project Logo & QR Code
  const centerCx = 126;
  // Project Logo Badge
  drawHexagon(doc, centerCx, 65, 18, [15, 23, 42], [245, 158, 11], 0.8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text(mockData.raison_sociale, centerCx, 67, { align: 'center' });

  // QR Code Box
  drawQrCodeBox(doc, centerCx, 108, 22, [0, 37, 77], [248, 250, 252]);

  // Dot matrix below QR
  drawDotGrid(doc, centerCx - 10, 130, 3, 7, 3, 0.55, [0, 37, 77]);

  // RIGHT COLUMN: "PROJET", Project Name, 4 Capsules, and Description
  const rightCx = 214;
  const rightCapW = 122;
  const rightCapX = rightCx - rightCapW / 2;

  // "PROJET" Subtitle
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(2, 132, 199); // Sky Blue
  doc.text('PROJET D\'ACCOMPAGNEMENT IDS', rightCx, 36, { align: 'center' });

  // Project Name (Huge & Dominant)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(0, 37, 77); // Deep Navy
  doc.text(mockData.raison_sociale, rightCx, 48, { align: 'center' });

  // 4 Capsules
  drawShowcaseCapsule(doc, rightCapX, 56, rightCapW, capH, `Statut Juridique : ${mockData.statut_juridique}`, {
    bgColor: [0, 37, 77], hexColor: [255, 255, 255], textColor: [255, 255, 255]
  });
  drawShowcaseCapsule(doc, rightCapX, 68, rightCapW, capH, `Secteur : ${mockData.secteur_activite}`, {
    bgColor: [0, 37, 77], hexColor: [255, 255, 255], textColor: [255, 255, 255]
  });
  drawShowcaseCapsule(doc, rightCapX, 80, rightCapW, capH, `Cible & Marché : ${mockData.cible}`, {
    bgColor: [0, 37, 77], hexColor: [255, 255, 255], textColor: [255, 255, 255]
  });
  drawShowcaseCapsule(doc, rightCapX, 92, rightCapW, capH, `Membres d'équipe : ${mockData.equipe}`, {
    bgColor: [0, 37, 77], hexColor: [255, 255, 255], textColor: [255, 255, 255]
  });

  // Description du Projet (Text Block)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(0, 37, 77);
  doc.text('Présentation & Vision du Projet :', rightCapX, 110);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85); // slate-700
  const splitDesc = doc.splitTextToSize(mockData.description_projet, rightCapW);
  doc.text(splitDesc, rightCapX, 117);

  // Bottom Dots Matrix Accent
  drawDotGrid(doc, rightCapX, 155, 3, 14, 3, 0.55, [245, 158, 11]);

  // Footer Institutional Line
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Incubateur Digital Solidaire (IDS) • Centre des Très Petites Entreprises Solidaires (CTPES) • Document Confidentiel Officiel', pw / 2, ph - 6, { align: 'center' });

  return doc;
}

// ==========================================
// BUILD VARIANT 2: AMBRE SOLAIRE IDS (Direct match with reference, in IDS warm amber)
// ==========================================
function buildVariant2() {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pw = 297, ph = 210;

  // Background: Warm Golden Amber of IDS Logo (#F59E0B)
  doc.setFillColor(245, 158, 11);
  doc.rect(0, 0, pw, ph, 'F');

  // Decorative Top-Left Wave (Navy)
  doc.setFillColor(0, 37, 77); // Deep Navy
  doc.moveTo(0, 0);
  doc.lineTo(75, 0);
  doc.curveTo(55, 45, 10, 80, 0, 95);
  doc.fill();

  // Decorative Bottom-Right Wave (Navy)
  doc.setFillColor(0, 37, 77);
  doc.moveTo(pw, ph);
  doc.lineTo(pw - 80, ph);
  doc.curveTo(pw - 50, ph - 35, pw - 20, ph - 65, pw, ph - 75);
  doc.fill();

  // Logos in Header (with white pill container for crispness)
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(12, 7, 22, 20, 3, 3, 'F');
  doc.addImage(idsLogo, 'PNG', 14, 8, 18, 18);

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(pw - 14 - 46, 8, 48, 14, 3, 3, 'F');
  doc.addImage(ctpesLogo, 'PNG', pw - 14 - 44, 10, 44, 10.1);

  // LEFT COLUMN: Incubé Photo & Personal Badges
  const photoCx = 65, photoCy = 65, photoR = 25;
  drawHexagon(doc, photoCx, photoCy, photoR + 1.8, [0, 37, 77], null);
  drawHexagon(doc, photoCx, photoCy, photoR, [255, 255, 255], [0, 37, 77], 0.8);

  if (samplePhoto) {
    try {
      doc.addImage(samplePhoto, 'PNG', photoCx - photoR + 2, photoCy - photoR + 2, (photoR - 2) * 2, (photoR - 2) * 2);
      drawHexagon(doc, photoCx, photoCy, photoR, null, [0, 37, 77], 0.8);
    } catch (e) {}
  }

  // Dot matrix near photo
  drawDotGrid(doc, photoCx + photoR + 5, photoCy - 10, 4, 3, 3, 0.6, [0, 37, 77]);

  // Incubé Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(0, 37, 77); // IDS Navy
  doc.text(mockData.nom_incube, photoCx, 103, { align: 'center' });

  // 3 Left Capsules
  const capW = 88, capH = 9;
  const capLeftX = photoCx - capW / 2;
  drawShowcaseCapsule(doc, capLeftX, 112, capW, capH, `Niveau d'étude : ${mockData.niveau_etude}`, {
    bgColor: [0, 37, 77], hexColor: [255, 255, 255], textColor: [255, 255, 255]
  });
  drawShowcaseCapsule(doc, capLeftX, 125, capW, capH, mockData.specialite, {
    bgColor: [0, 37, 77], hexColor: [255, 255, 255], textColor: [255, 255, 255]
  });
  drawShowcaseCapsule(doc, capLeftX, 138, capW, capH, mockData.site_web, {
    bgColor: [0, 37, 77], hexColor: [255, 255, 255], textColor: [255, 255, 255]
  });

  // CENTER COLUMN: Hexagon Project Logo & QR Code
  const centerCx = 126;
  drawHexagon(doc, centerCx, 65, 18, [0, 37, 77], [255, 255, 255], 0.8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text(mockData.raison_sociale, centerCx, 67, { align: 'center' });

  // QR Code Box (Navy on amber)
  drawQrCodeBox(doc, centerCx, 108, 22, [0, 37, 77], [254, 243, 199]);

  // Dot matrix below QR
  drawDotGrid(doc, centerCx - 10, 130, 3, 7, 3, 0.55, [0, 37, 77]);

  // RIGHT COLUMN: "PROJET", Project Name, 4 Capsules, and Description
  const rightCx = 214;
  const rightCapW = 122;
  const rightCapX = rightCx - rightCapW / 2;

  // "PROJET" Subtitle
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 37, 77);
  doc.text('PROJET', rightCx, 36, { align: 'center' });

  // Project Name (Huge & Dominant)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(0, 37, 77);
  doc.text(mockData.raison_sociale, rightCx, 48, { align: 'center' });

  // 4 Capsules
  drawShowcaseCapsule(doc, rightCapX, 56, rightCapW, capH, `Statut Juridique : ${mockData.statut_juridique}`, {
    bgColor: [0, 37, 77], hexColor: [255, 255, 255], textColor: [255, 255, 255]
  });
  drawShowcaseCapsule(doc, rightCapX, 68, rightCapW, capH, `Secteur: ${mockData.secteur_activite}`, {
    bgColor: [0, 37, 77], hexColor: [255, 255, 255], textColor: [255, 255, 255]
  });
  drawShowcaseCapsule(doc, rightCapX, 80, rightCapW, capH, `Cible : ${mockData.cible}`, {
    bgColor: [0, 37, 77], hexColor: [255, 255, 255], textColor: [255, 255, 255]
  });
  drawShowcaseCapsule(doc, rightCapX, 92, rightCapW, capH, `Membres d'équipe : ${mockData.equipe}`, {
    bgColor: [0, 37, 77], hexColor: [255, 255, 255], textColor: [255, 255, 255]
  });

  // Description du Projet (Text Block)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 37, 77);
  const splitDesc = doc.splitTextToSize(mockData.description_projet, rightCapW);
  doc.text(splitDesc, rightCapX, 114);

  // Bottom Dots Matrix Accent
  drawDotGrid(doc, rightCapX, 155, 3, 14, 3, 0.55, [0, 37, 77]);

  // Footer Institutional Line
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(0, 37, 77);
  doc.text('INCUBATEUR DIGITAL SOLIDAIRE (IDS)  •  CENTRE DES TRÈS PETITES ENTREPRISES SOLIDAIRES (CTPES)', pw / 2, ph - 6, { align: 'center' });

  return doc;
}

// ==========================================
// BUILD VARIANT 3: BLEU MARINE TECH (Pitch Deck Sombre)
// ==========================================
function buildVariant3() {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pw = 297, ph = 210;

  // Background: Deep Dark Slate/Navy (#0A1128 / #0F172A)
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pw, ph, 'F');

  // Decorative Top-Left Wave (IDS Sky Blue)
  doc.setFillColor(2, 132, 199);
  doc.moveTo(0, 0);
  doc.lineTo(75, 0);
  doc.curveTo(55, 45, 10, 80, 0, 95);
  doc.fill();

  // Decorative Bottom-Right Wave (IDS Amber)
  doc.setFillColor(245, 158, 11);
  doc.moveTo(pw, ph);
  doc.lineTo(pw - 80, ph);
  doc.curveTo(pw - 50, ph - 35, pw - 20, ph - 65, pw, ph - 75);
  doc.fill();

  // Logos in Header (with white pill container)
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(12, 7, 22, 20, 3, 3, 'F');
  doc.addImage(idsLogo, 'PNG', 14, 8, 18, 18);

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(pw - 14 - 46, 8, 48, 14, 3, 3, 'F');
  doc.addImage(ctpesLogo, 'PNG', pw - 14 - 44, 10, 44, 10.1);

  // LEFT COLUMN: Incubé Photo & Personal Badges
  const photoCx = 65, photoCy = 65, photoR = 25;
  drawHexagon(doc, photoCx, photoCy, photoR + 1.8, [245, 158, 11], null);
  drawHexagon(doc, photoCx, photoCy, photoR, [30, 41, 59], [2, 132, 199], 0.8);

  if (samplePhoto) {
    try {
      doc.addImage(samplePhoto, 'PNG', photoCx - photoR + 2, photoCy - photoR + 2, (photoR - 2) * 2, (photoR - 2) * 2);
      drawHexagon(doc, photoCx, photoCy, photoR, null, [2, 132, 199], 0.8);
    } catch (e) {}
  }

  // Dot matrix near photo
  drawDotGrid(doc, photoCx + photoR + 5, photoCy - 10, 4, 3, 3, 0.6, [245, 158, 11]);

  // Incubé Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(mockData.nom_incube, photoCx, 103, { align: 'center' });

  // 3 Left Capsules
  const capW = 88, capH = 9;
  const capLeftX = photoCx - capW / 2;
  drawShowcaseCapsule(doc, capLeftX, 112, capW, capH, `Niveau d'étude : ${mockData.niveau_etude}`, {
    bgColor: [30, 58, 138], hexColor: [245, 158, 11], textColor: [255, 255, 255]
  });
  drawShowcaseCapsule(doc, capLeftX, 125, capW, capH, mockData.specialite, {
    bgColor: [30, 58, 138], hexColor: [245, 158, 11], textColor: [255, 255, 255]
  });
  drawShowcaseCapsule(doc, capLeftX, 138, capW, capH, mockData.site_web, {
    bgColor: [30, 58, 138], hexColor: [245, 158, 11], textColor: [255, 255, 255]
  });

  // CENTER COLUMN: Hexagon Project Logo & QR Code
  const centerCx = 126;
  drawHexagon(doc, centerCx, 65, 18, [30, 58, 138], [245, 158, 11], 0.8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text(mockData.raison_sociale, centerCx, 67, { align: 'center' });

  // QR Code Box
  drawQrCodeBox(doc, centerCx, 108, 22, [245, 158, 11], [30, 41, 59]);

  // Dot matrix below QR
  drawDotGrid(doc, centerCx - 10, 130, 3, 7, 3, 0.55, [2, 132, 199]);

  // RIGHT COLUMN: "PROJET", Project Name, 4 Capsules, and Description
  const rightCx = 214;
  const rightCapW = 122;
  const rightCapX = rightCx - rightCapW / 2;

  // "PROJET" Subtitle
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(245, 158, 11);
  doc.text('PROJET', rightCx, 36, { align: 'center' });

  // Project Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(255, 255, 255);
  doc.text(mockData.raison_sociale, rightCx, 48, { align: 'center' });

  // 4 Capsules
  drawShowcaseCapsule(doc, rightCapX, 56, rightCapW, capH, `Statut Juridique : ${mockData.statut_juridique}`, {
    bgColor: [30, 58, 138], hexColor: [245, 158, 11], textColor: [255, 255, 255]
  });
  drawShowcaseCapsule(doc, rightCapX, 68, rightCapW, capH, `Secteur: ${mockData.secteur_activite}`, {
    bgColor: [30, 58, 138], hexColor: [245, 158, 11], textColor: [255, 255, 255]
  });
  drawShowcaseCapsule(doc, rightCapX, 80, rightCapW, capH, `Cible : ${mockData.cible}`, {
    bgColor: [30, 58, 138], hexColor: [245, 158, 11], textColor: [255, 255, 255]
  });
  drawShowcaseCapsule(doc, rightCapX, 92, rightCapW, capH, `Membres d'équipe : ${mockData.equipe}`, {
    bgColor: [30, 58, 138], hexColor: [245, 158, 11], textColor: [255, 255, 255]
  });

  // Description du Projet (Text Block)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(226, 232, 240); // slate-200
  const splitDesc = doc.splitTextToSize(mockData.description_projet, rightCapW);
  doc.text(splitDesc, rightCapX, 114);

  // Bottom Dots Matrix Accent
  drawDotGrid(doc, rightCapX, 155, 3, 14, 3, 0.55, [2, 132, 199]);

  // Footer Institutional Line
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('INCUBATEUR DIGITAL SOLIDAIRE (IDS)  •  CENTRE DES TRÈS PETITES ENTREPRISES SOLIDAIRES (CTPES)', pw / 2, ph - 6, { align: 'center' });

  return doc;
}

// Generate PDFs
fs.writeFileSync(path.resolve(__dirname, '../../frontend/public/preview_showcase_opt1_white.pdf'), Buffer.from(buildVariant1().output('arraybuffer')));
fs.writeFileSync(path.resolve(__dirname, '../../frontend/public/preview_showcase_opt2_amber.pdf'), Buffer.from(buildVariant2().output('arraybuffer')));
fs.writeFileSync(path.resolve(__dirname, '../../frontend/public/preview_showcase_opt3_navy.pdf'), Buffer.from(buildVariant3().output('arraybuffer')));

console.log('PDFs generated successfully!');

