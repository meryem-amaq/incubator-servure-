const { jsPDF } = require('../../frontend/node_modules/jspdf');
const autoTable = require('../../frontend/node_modules/jspdf-autotable').default;
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

const commonMoroccanPrenoms = new Set([
  'ahmed', 'mohamed', 'mohammed', 'amine', 'youssef', 'mehdi', 'hamza', 'khalid', 'omar',
  'ali', 'salma', 'sara', 'sarah', 'meryem', 'meriem', 'chaimae', 'chaymae', 'imane', 'ilham',
  'nadia', 'salima', 'abdelkrim', 'abdessamad', 'badreddine', 'aicha', 'layla', 'leila', 'asmaa',
  'fatima', 'zahra', 'hajar', 'ghita', 'soukaina', 'nouhaila', 'zineb', 'anass', 'yassine', 'karim',
  'hassan', 'mustapha', 'rachid', 'said', 'tarik', 'tariq', 'driss', 'adil', 'aziz', 'ayoub'
]);

/**
 * Formate un nom complet selon la règle stricte :
 * NOM DE FAMILLE EN MAJUSCULES, Première lettre du prénom en Majuscule
 */
function formatOfficialName(input) {
  if (!input || typeof input !== 'string') return '';
  let str = input.trim().replace(/\s+/g, ' ');
  if (!str) return '';

  let title = '';
  const titleMatch = str.match(/^(M\.|Mme|Mlle|Mr|Dr|Pr)\s+/i);
  if (titleMatch) {
    title = titleMatch[1] + ' ';
    str = str.slice(titleMatch[0].length).trim();
  }

  const words = str.split(' ').filter(Boolean);
  if (words.length === 1) return title + words[0].toUpperCase();

  const capitalize = (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  const isCaps = (w) => w.length > 1 && w === w.toUpperCase() && /[A-Z]/.test(w);
  const nomPrefixes = ['el', 'al', 'ait', 'ben', 'ibn', 'bel', 'bou', 'ould'];

  // Cas 1 : Mélange explicite de mots tout en majuscules et de mots capitalisés/minuscules
  const allCapsWords = words.filter(isCaps);
  const nonCapsWords = words.filter(w => !isCaps(w));
  if (allCapsWords.length > 0 && nonCapsWords.length > 0) {
    const nom = allCapsWords.map(w => w.toUpperCase()).join(' ');
    const prenom = nonCapsWords.map(capitalize).join(' ');
    return title + nom + ' ' + prenom;
  }

  // Cas 2 : Reconnaissance par prénoms usuels
  const firstWordLower = words[0].toLowerCase();
  const lastWordLower = words[words.length - 1].toLowerCase();

  if (commonMoroccanPrenoms.has(firstWordLower) && !commonMoroccanPrenoms.has(lastWordLower)) {
    const prenom = capitalize(words[0]);
    const nom = words.slice(1).map(w => w.toUpperCase()).join(' ');
    return title + nom + ' ' + prenom;
  }

  if (commonMoroccanPrenoms.has(lastWordLower) && !commonMoroccanPrenoms.has(firstWordLower)) {
    const prenom = capitalize(words[words.length - 1]);
    const nom = words.slice(0, words.length - 1).map(w => w.toUpperCase()).join(' ');
    return title + nom + ' ' + prenom;
  }

  // Cas 3 : Préfixe composé en début
  if (words.length >= 2 && nomPrefixes.includes(words[0].toLowerCase())) {
    const prenom = capitalize(words[words.length - 1]);
    const nom = words.slice(0, words.length - 1).map(w => w.toUpperCase()).join(' ');
    return title + nom + ' ' + prenom;
  }

  // Cas 4 : Préfixe composé en fin
  if (words.length >= 3 && nomPrefixes.includes(words[words.length - 2].toLowerCase())) {
    const prenom = words.slice(0, words.length - 2).map(capitalize).join(' ');
    const nom = words.slice(words.length - 2).map(w => w.toUpperCase()).join(' ');
    return title + nom + ' ' + prenom;
  }

  // Par défaut convention marocaine/française : 1er mot = NOM, reste = Prénom
  const nom = words[0].toUpperCase();
  const prenom = words.slice(1).map(capitalize).join(' ');
  return title + nom + ' ' + prenom;
}

const mock = {
  nom_incube: 'Ahmed Benmoussa',
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
  cible: 'B2B / B2G / B2BC',
  date_demarrage: '15/03/2024',
  promotion: 'Promotion 2',
  accompagnateur: 'M. Khalid El Idrissi',
  description_projet: 'TechNova développe une plateforme SaaS propulsée par l\'intelligence artificielle pour optimiser l\'efficacité énergétique des unités industrielles.',
  proposition_valeur: 'Réduction des émissions carbone des PME au Maroc.',
  personnel_count: 5,
  associes: [
    { nom: 'karim tazi', cin: 'CD654321', fonction: 'Directeur Technique (CTO)', badge_id: 'RFID-1042' },
    { nom: 'sara amqran', cin: 'EF112233', fonction: 'Responsable R&D', badge_id: 'RFID-1043' }
  ]
};

/**
 * Dessine un QR Code vectoriel authentique et scannable
 */
function drawQrFromSvg(doc, text, x, y, size, color = [2, 132, 199]) {
  try {
    const svgStr = ReactDOMServer.renderToStaticMarkup(
      React.createElement(QRCodeSVG, { value: text || 'https://ids.ma', size: 128 })
    );
    const vbMatch = svgStr.match(/viewBox="0 0 (\d+) (\d+)"/);
    const gridSize = vbMatch ? parseInt(vbMatch[1], 10) : 25;

    // Cadre blanc avec bordure arrondie fine
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, size, size, 1.5, 1.5, 'FD');

    const pad = size * 0.08;
    const drawSize = size - pad * 2;
    const scale = drawSize / gridSize;

    const matches = [...svgStr.matchAll(/M(\d+)[, ]+(\d+)\s*h(\d+)v1/g)];
    doc.setFillColor(...color);

    matches.forEach(m => {
      const px = parseInt(m[1], 10);
      const py = parseInt(m[2], 10);
      const pwModule = parseInt(m[3], 10);
      doc.rect(x + pad + px * scale, y + pad + py * scale, pwModule * scale, scale, 'F');
    });
  } catch (err) {
    console.error('Erreur dessin QR code:', err);
  }
}

function buildOfficialDashboardPdf() {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pw = 297, ph = 210;
  const marginX = 14;

  const displayName = formatOfficialName(mock.nom_incube);
  const displayAccomp = formatOfficialName(mock.accompagnateur);

  // ==========================================
  // 1. EN-TÊTE : DEUX LOGOS STRICTEMENT ÉGAUX
  // ==========================================
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

  // Ligne de séparation fine sous l'en-tête (placée à Y=26)
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(marginX, 26, pw - marginX, 26);

  // ==========================================
  // 2. CARTOUCHE PORTEUR AVEC PHOTO & QR CODES (Y = 29 à 57)
  // ==========================================
  const cartoucheY = 29;
  const cartoucheH = 28;
  const cartoucheW = pw - marginX * 2; // 269 mm

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(marginX, cartoucheY, cartoucheW, cartoucheH, 2.5, 2.5, 'FD');

  // Photo de l'incubé
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

  // Identité au centre du cartouche (NOM EN MAJUSCULE, Prénom Capitalisé)
  const textLeftX = photoX + photoSize + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(displayName, textLeftX, cartoucheY + 10);

  // Raison sociale
  doc.setFontSize(10);
  doc.setTextColor(2, 132, 199);
  doc.text(mock.raison_sociale, textLeftX, cartoucheY + 17.5);

  // QR Codes sur la droite du cartouche
  const qrBoxSize = 20;
  const qr1X = pw - marginX - qrBoxSize * 2 - 14;
  const qr2X = pw - marginX - qrBoxSize - 5;
  const qrY = cartoucheY + 2.5;

  // QR 1 : LinkedIn (vectoriel haute résolution)
  drawQrFromSvg(doc, mock.linkedin, qr1X, qrY, qrBoxSize, [10, 102, 194]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(10, 102, 194);
  doc.text('QR LinkedIn', qr1X + qrBoxSize / 2, qrY + qrBoxSize + 3.8, { align: 'center' });

  // QR 2 : Site Web (vectoriel haute résolution)
  drawQrFromSvg(doc, mock.site_web, qr2X, qrY, qrBoxSize, [2, 132, 199]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(2, 132, 199);
  doc.text('QR Site Web', qr2X + qrBoxSize / 2, qrY + qrBoxSize + 3.8, { align: 'center' });

  // Séparateur vertical fin avant les QR codes
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(qr1X - 6, cartoucheY + 3, qr1X - 6, cartoucheY + cartoucheH - 3);

  // ==========================================
  // 3. DEUX COLONNES DE TABLEAUX ÉPURÉS (Y = 60 à 145)
  // ==========================================
  const colGap = 8;
  const colW = (pw - marginX * 2 - colGap) / 2; // 130.5 mm
  const col1X = marginX;
  const col2X = marginX + colW + colGap;
  const secStartY = 60;

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
    styles: { fontSize: 7.6, cellPadding: 2.15, font: 'helvetica', lineColor: [226, 232, 240], lineWidth: 0.25 },
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
      ['Téléphone', mock.telephone]
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
    styles: { fontSize: 7.6, cellPadding: 2.15, font: 'helvetica', lineColor: [226, 232, 240], lineWidth: 0.25 },
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
      ['Promotion', mock.promotion, 'Accompagnateur', displayAccomp],
      ['Membres d\'équipe', { content: `${mock.personnel_count} collaborateurs (calculé depuis RH)`, colSpan: 3, styles: { fontStyle: 'bold', textColor: [22, 163, 74] } }]
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
    theme: 'grid',
    styles: { 
      fontSize: 7.5, 
      cellPadding: 2.5, 
      font: 'helvetica', 
      lineColor: [226, 232, 240], 
      lineWidth: 0.25
    },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [71, 85, 105], cellWidth: 38 },
      1: { textColor: [15, 23, 42], cellWidth: colW - 38 }
    },
    body: [
      [{ content: mock.description_projet, colSpan: 2, styles: { fillColor: [248, 250, 252], cellPadding: 3 } }],
      ['Proposition de valeur :', { content: mock.proposition_valeur, styles: { textColor: [15, 23, 42] } }]
    ]
  });

  // Associés & Équipe (Droite)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text(`4. ASSOCIÉS DU PROJET (${mock.associes.length})`, col2X, bottomY);

  autoTable(doc, {
    startY: bottomY + 3,
    margin: { left: col2X, right: marginX },
    tableWidth: colW,
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, cellPadding: 1.8 },
    styles: { fontSize: 7.2, cellPadding: 1.8, font: 'helvetica', lineColor: [226, 232, 240], lineWidth: 0.2 },
    head: [['Nom & Prénom', 'CIN', 'Fonction', 'Badge RFID']],
    body: mock.associes.map(a => [formatOfficialName(a.nom), a.cin, a.fonction, a.badge_id])
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

const doc = buildOfficialDashboardPdf();
const outPath = path.resolve(__dirname, '../../frontend/public/preview_charte_officielle.pdf');
fs.writeFileSync(outPath, Buffer.from(doc.output('arraybuffer')));
console.log('PDF generated at:', outPath);
