const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../../frontend/src/utils/pdfExport.js');
let content = fs.readFileSync(targetPath, 'utf8');

const startMarker = 'export const generateFicheSignaletiqueDocument = async (incube) => {';
const endMarker = 'export const exportFicheSignaletiqueToPDF = async (incube, filename = null) => {';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error('Markers not found!');
  process.exit(1);
}

const newImplementation = `export const generateFicheSignaletiqueDocument = async (incube) => {
  // Format Horizontal (Landscape A4 : 297mm x 210mm)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.width; // 297
  const pageHeight = doc.internal.pageSize.height; // 210
  const marginX = 14;

  const today = new Date().toLocaleDateString('fr-FR');
  const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const incubeName = incube?.nom_incube || 'Incubé';
  const displayName = formatNomPrenomIncube(incubeName);
  const ageAnnees = formatAgeAnnees(incube?.age, incube?.date_naissance);

  // 1. Chargement des logos et de la photo
  const { logoIds, logoCtpes } = await ensureLogosLoaded();
  let photoDataUrl = null;
  if (incube?.photo_path) {
    const fullPhotoUrl = getPhotoUrl(incube.photo_path);
    if (fullPhotoUrl) {
      try {
        photoDataUrl = await loadImageAsDataUrl(fullPhotoUrl);
      } catch (err) {
        console.warn('Erreur chargement photo incubé:', err);
      }
    }
  }

  // ==========================================
  // 1. EN-TÊTE : DEUX LOGOS STRICTEMENT ÉGAUX
  // ==========================================
  // Dimensions exactes des deux badges de logos : 38mm x 14mm
  const badgeW = 38, badgeH = 14, badgeY = 9, badgeR = 2;

  // Logo IDS (Gauche)
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(marginX, badgeY, badgeW, badgeH, badgeR, badgeR, 'FD');
  if (logoIds) {
    try {
      doc.addImage(logoIds, 'PNG', marginX + (badgeW - 12) / 2, badgeY + (badgeH - 12) / 2, 12, 12);
    } catch (e) {}
  }

  // Logo CTPES (Droite) - Format 100% IDENTIQUE
  const ctpesX = pageWidth - marginX - badgeW;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(ctpesX, badgeY, badgeW, badgeH, badgeR, badgeR, 'FD');
  if (logoCtpes) {
    try {
      doc.addImage(logoCtpes, 'PNG', ctpesX + (badgeW - 31) / 2, badgeY + (badgeH - 7.1) / 2, 31, 7.1);
    } catch (e) {}
  }

  // Titre En-Tête Centré
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('INCUBATEUR DIGITAL SOLIDAIRE (IDS)', pageWidth / 2, 15, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(2, 132, 199); // primary sky-600
  doc.text('FICHE SIGNALÉTIQUE & INFORMATIONS GÉNÉRALES', pageWidth / 2, 21, { align: 'center' });

  // Ligne de séparation fine sous l'en-tête (placée à Y=26, pour aucun contact avec les logos)
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(marginX, 26, pageWidth - marginX, 26);

  // ==========================================
  // 2. CARTOUCHE PORTEUR AVEC PHOTO & QR CODES (Y = 29 à 58)
  // ==========================================
  const cartoucheY = 29;
  const cartoucheH = 28;
  const cartoucheW = pageWidth - marginX * 2; // 269 mm

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

  if (photoDataUrl) {
    try {
      doc.addImage(photoDataUrl, 'JPEG', photoX, photoY, photoSize, photoSize);
      doc.setDrawColor(2, 132, 199);
      doc.setLineWidth(0.5);
      doc.roundedRect(photoX, photoY, photoSize, photoSize, 1.5, 1.5, 'S');
    } catch (e) {
      photoDataUrl = null;
    }
  }
  if (!photoDataUrl) {
    const initials = incubeName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'IN';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(148, 163, 184);
    doc.text(initials, photoX + photoSize / 2, photoY + 13, { align: 'center' });
  }

  // Identité au centre du cartouche
  const textLeftX = photoX + photoSize + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(displayName.toUpperCase(), textLeftX, cartoucheY + 8);

  doc.setFontSize(10);
  doc.setTextColor(2, 132, 199);
  doc.text(incube?.raison_sociale || 'Projet d\\'incubation', textLeftX, cartoucheY + 14.5);

  doc.setFontSize(7.8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(\`Réf. Dossier : \${incube?.pp_numero || '—'}   •   Phase : \${incube?.phase_projet || 'Lancement'}   •   Promotion : \${incube?.promotion || 'Promotion 2026'}   •   Accompagnateur : \${incube?.accompagnateur || 'Conseiller IDS'}\`, textLeftX, cartoucheY + 21.5);

  // LES DEUX QR CODES (LinkedIn & Site Web) DANS LE CARTOUCHE
  const drawVectorQr = (x, y, size, color) => {
    const pad = 1.5;
    const innerSize = size - pad * 2;
    const finder = innerSize * 0.28;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, size, size, 1.5, 1.5, 'FD');

    doc.setFillColor(...color);
    doc.rect(x + pad, y + pad, finder, finder, 'F');
    doc.rect(x + pad + innerSize - finder, y + pad, finder, finder, 'F');
    doc.rect(x + pad, y + pad + innerSize - finder, finder, finder, 'F');

    const punch = finder * 0.45;
    const punchOffset = (finder - punch) / 2;
    doc.setFillColor(255, 255, 255);
    doc.rect(x + pad + punchOffset, y + pad + punchOffset, punch, punch, 'F');
    doc.rect(x + pad + innerSize - finder + punchOffset, y + pad + punchOffset, punch, punch, 'F');
    doc.rect(x + pad + punchOffset, y + pad + innerSize - finder + punchOffset, punch, punch, 'F');

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
  };

  const qrBoxSize = 20;
  const qr1X = pageWidth - marginX - qrBoxSize * 2 - 14;
  const qr2X = pageWidth - marginX - qrBoxSize - 5;
  const qrY = cartoucheY + 3;

  // QR 1 : LinkedIn
  drawVectorQr(qr1X, qrY, qrBoxSize, [10, 102, 194]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(10, 102, 194);
  doc.text('QR LinkedIn', qr1X + qrBoxSize / 2, qrY + qrBoxSize + 3.5, { align: 'center' });

  // QR 2 : Site Web
  drawVectorQr(qr2X, qrY, qrBoxSize, [2, 132, 199]);
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
  const colW = (pageWidth - marginX * 2 - colGap) / 2; // 130.5 mm
  const col1X = marginX;
  const col2X = marginX + colW + colGap;
  const secStartY = 61;

  // --- COLONNE GAUCHE : RENSEIGNEMENTS PERSONNELS ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text('1. RENSEIGNEMENTS PERSONNELS DU PORTEUR', col1X, secStartY);

  const dateNaisText = incube?.date_naissance ? new Date(incube.date_naissance).toLocaleDateString('fr-FR') : '—';
  const vText = \`\${incube?.ville || '—'}\${incube?.province && incube.province !== incube.ville ? \` / \${incube.province}\` : ''}\`;

  autoTable(doc, {
    startY: secStartY + 3,
    margin: { left: col1X, right: pageWidth - col1X - colW },
    tableWidth: colW,
    theme: 'grid',
    styles: { fontSize: 7.6, cellPadding: 2.1, font: 'helvetica', lineColor: [226, 232, 240], lineWidth: 0.25 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [71, 85, 105], cellWidth: 40 },
      1: { textColor: [15, 23, 42], cellWidth: colW - 40 }
    },
    body: [
      ['Carte Nationale (CIN)', incube?.cin || '—'],
      ['Date de naissance & Âge', \`\${dateNaisText} (\${ageAnnees})\`],
      ['Genre & Situation', \`\${incube?.genre || '—'} • \${incube?.situation_familiale || '—'}\`],
      ['Niveau d\\'étude', incube?.niveau_etude || '—'],
      ['Spécialité / Métier', incube?.secteur_activite || '—'],
      ['Ville & Province', vText],
      ['Téléphone', incube?.telephone || '—'],
      ['Adresse E-mail', incube?.email || '—'],
      ['Profil LinkedIn', (incube?.linkedin || '—') + (incube?.linkedin ? '  (Scannez le QR Code en haut)' : '')],
      ['Site Web / Portfolio', (incube?.site_web || '—') + (incube?.site_web ? '  (Scannez le QR Code en haut)' : '')]
    ]
  });

  // --- COLONNE DROITE : ENTREPRISE, MARCHÉ & ÉQUIPE RH ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text('2. RENSEIGNEMENTS ENTREPRISE & ENCADREMENT', col2X, secStartY);

  // Calcul effectif RH
  const rhPersonnel = Array.isArray(incube?.personnel) ? incube.personnel : [];
  const rhCount = rhPersonnel.filter(p => p && p.nom_complet && String(p.nom_complet).trim() !== '').length;
  const teamText = rhCount > 0 ? \`\${rhCount} collaborateur(s) (calculé depuis RH)\` : '1 membre';

  const dateDemText = incube?.date_demarrage ? new Date(incube.date_demarrage).toLocaleDateString('fr-FR') : '—';

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
      ['Raison sociale', { content: incube?.raison_sociale || '—', colSpan: 3, styles: { fontStyle: 'bold', textColor: [2, 132, 199] } }],
      ['Statut juridique', incube?.statut_juridique || '—', 'Numéro RC', incube?.rc || '—'],
      ['Secteur d\\'activité', { content: incube?.secteur_activite || '—', colSpan: 3 }],
      ['Phase du projet', incube?.phase_projet || '—', 'Date démarrage', dateDemText],
      ['Cible & Marché', { content: incube?.cible || 'B2B / B2C', colSpan: 3, styles: { fontStyle: 'bold' } }],
      ['Promotion', incube?.promotion || 'Promotion 2026', 'Accompagnateur', incube?.accompagnateur || 'Conseiller IDS'],
      ['Membres d\\'équipe', { content: teamText, colSpan: 3, styles: { fontStyle: 'bold', textColor: [16, 185, 129] } }]
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

  const descContent = (incube?.description_projet && String(incube.description_projet).trim())
    ? String(incube.description_projet).trim()
    : "Aucune description renseignée pour ce projet.";

  autoTable(doc, {
    startY: bottomY + 3,
    margin: { left: col1X, right: pageWidth - col1X - colW },
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
    body: [[{ content: descContent }]]
  });

  // Associés & Équipe (Droite)
  let associesList = [];
  if (Array.isArray(incube?.associes)) {
    associesList = incube.associes;
  } else if (typeof incube?.associes === 'string') {
    try {
      const parsed = JSON.parse(incube.associes);
      if (Array.isArray(parsed)) associesList = parsed;
    } catch (e) {}
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text(\`4. ASSOCIÉS & ÉQUIPE DU PROJET (\${associesList.length})\`, col2X, bottomY);

  if (associesList.length > 0) {
    autoTable(doc, {
      startY: bottomY + 3,
      margin: { left: col2X, right: marginX },
      tableWidth: colW,
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, cellPadding: 1.8 },
      styles: { fontSize: 7.2, cellPadding: 1.8, font: 'helvetica', lineColor: [226, 232, 240], lineWidth: 0.2 },
      head: [['Nom & Prénom', 'CIN', 'Fonction', 'Badge RFID']],
      body: associesList.map(a => [
        a.nom || '—',
        a.cin || '—',
        a.fonction || '—',
        (a.badge_id || a.matricule) ? \`Badge #\${a.badge_id || a.matricule}\` : 'Sans badge'
      ])
    });
  } else {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(col2X, bottomY + 3, colW, 10, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text("Aucun associé enregistré pour cette startup.", col2X + 6, bottomY + 9.5);
  }

  // ==========================================
  // 5. PIED DE PAGE DISCRET
  // ==========================================
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.line(marginX, pageHeight - 9, pageWidth - marginX, pageHeight - 9);
  doc.text('IDS — Incubateur Digital Solidaire • Salé • Fiche Signalétique Officielle Paysage', marginX, pageHeight - 5.5);
  doc.text(\`Édité le \${today} à \${time} • Page 1 sur 1\`, pageWidth - marginX, pageHeight - 5.5, { align: 'right' });

  return doc;
};

`;

content = content.slice(0, startIndex) + newImplementation + content.slice(endIndex);
fs.writeFileSync(targetPath, content, 'utf8');
console.log('Successfully updated pdfExport.js!');
