const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../../frontend/src/utils/pdfExport.js');
let content = fs.readFileSync(targetFile, 'utf8');

// 1. Ensure import QRCode from 'qrcode'; is present and clean up unused server imports
if (!content.includes("import QRCode from 'qrcode'")) {
  content = content.replace(
    /import React from 'react';\r?\nimport ReactDOMServer from 'react-dom\/server';\r?\nimport \{ QRCodeSVG \} from 'qrcode\.react';\r?\n/,
    "import QRCode from 'qrcode';\n"
  );
  if (!content.includes("import QRCode from 'qrcode'")) {
    content = "import QRCode from 'qrcode';\n" + content;
  }
}

// 2. Updated generateFicheSignaletiqueDocument implementation with generous spacing & bulletproof QR codes
const newImplementation = `export const generateFicheSignaletiqueDocument = async (incube) => {
  // Format Horizontal Paysage A4 (297mm x 210mm)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pw = doc.internal.pageSize.width; // 297 mm
  const ph = doc.internal.pageSize.height; // 210 mm
  const marginX = 14;

  const today = new Date().toLocaleDateString('fr-FR');
  const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const incubeName = incube?.nom_incube || 'Incubé';
  const displayName = formatOfficialName(incubeName);
  const displayAccomp = formatOfficialName(incube?.accompagnateur) || 'Conseiller IDS';
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
  // 1. EN-TÊTE : DEUX LOGOS PARFAITEMENT ÉQUILIBRÉS
  // ==========================================
  const badgeW = 38, badgeH = 14, badgeY = 8, badgeR = 2;

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
  const ctpesX = pw - marginX - badgeW;
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
  doc.setFontSize(11.5);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('INCUBATEUR DIGITAL SOLIDAIRE (IDS)', pw / 2, 13.5, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(2, 132, 199); // primary sky-600
  doc.text('FICHE SIGNALÉTIQUE & INFORMATIONS GÉNÉRALES', pw / 2, 19.5, { align: 'center' });

  // Ligne de séparation fine sous l'en-tête (placée à Y=24.5)
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(marginX, 24.5, pw - marginX, 24.5);

  // ==========================================
  // 2. CARTOUCHE PORTEUR AVEC PHOTO & QR CODES
  //    ESPACÉ, AÉRÉ ET RAFFINÉ (Y = 28 à 57 mm, hauteur 29 mm)
  // ==========================================
  const cartoucheY = 28;
  const cartoucheH = 29;
  const cartoucheW = pw - marginX * 2; // 269 mm

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(marginX, cartoucheY, cartoucheW, cartoucheH, 3, 3, 'FD');

  // Photo
  const photoSize = 23;
  const photoX = marginX + 3.5;
  const photoY = cartoucheY + 3;

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.roundedRect(photoX, photoY, photoSize, photoSize, 2, 2, 'FD');

  if (photoDataUrl) {
    try {
      doc.addImage(photoDataUrl, 'PNG', photoX, photoY, photoSize, photoSize);
      doc.setDrawColor(2, 132, 199);
      doc.setLineWidth(0.5);
      doc.roundedRect(photoX, photoY, photoSize, photoSize, 2, 2, 'S');
    } catch (e) {
      photoDataUrl = null;
    }
  }
  if (!photoDataUrl) {
    const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'IN';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(148, 163, 184);
    doc.text(initials, photoX + photoSize / 2, photoY + 14, { align: 'center' });
  }

  // Identité au centre du cartouche (NOM EN MAJUSCULE, Prénom Capitalisé)
  const textLeftX = photoX + photoSize + 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(15, 23, 42);
  doc.text(displayName, textLeftX, cartoucheY + 11);

  // Raison sociale
  doc.setFontSize(10.5);
  doc.setTextColor(2, 132, 199);
  doc.text(incube?.raison_sociale || 'Projet d\\'incubation', textLeftX, cartoucheY + 18.5);

  // QR Codes sur la droite du cartouche
  const qrBoxSize = 18;
  const qr1X = pw - marginX - qrBoxSize * 2 - 16;
  const qr2X = pw - marginX - qrBoxSize - 6;
  const qrY = cartoucheY + 2.5;

  // Séparateur vertical fin avant les QR codes
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(qr1X - 7, cartoucheY + 3, qr1X - 7, cartoucheY + cartoucheH - 3);

  // Helper pour dessiner des QR codes vectoriels natifs fiables
  const drawQrBox = async (text, x, y, size, label, labelColor = [10, 102, 194]) => {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.35);
    doc.roundedRect(x, y, size, size, 1.5, 1.5, 'FD');

    try {
      const qrDataUrl = await QRCode.toDataURL(text || 'https://ids.org.ma', {
        margin: 1,
        width: 256,
        color: {
          dark: '#081B38',
          light: '#FFFFFF'
        }
      });
      doc.addImage(qrDataUrl, 'PNG', x + 0.8, y + 0.8, size - 1.6, size - 1.6);
    } catch (e) {
      console.warn('Erreur génération QR code:', e);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(...labelColor);
    doc.text(label, x + size / 2, y + size + 4, { align: 'center' });
  };

  // QR 1 : LinkedIn
  const linkedinUrl = incube?.linkedin && String(incube.linkedin).trim() !== ''
    ? incube.linkedin
    : (incube?.nom_incube ? \`https://www.linkedin.com/search/results/all/?keywords=\${encodeURIComponent(incube.nom_incube)}\` : 'https://www.linkedin.com');
  await drawQrBox(linkedinUrl, qr1X, qrY, qrBoxSize, 'QR LinkedIn', [10, 102, 194]);

  // QR 2 : Site Web
  const siteWebUrl = incube?.site_web && String(incube.site_web).trim() !== ''
    ? incube.site_web
    : 'https://ids.org.ma';
  await drawQrBox(siteWebUrl, qr2X, qrY, qrBoxSize, 'QR Site Web', [2, 132, 199]);

  // ==========================================
  // 3. DEUX COLONNES DE TABLEAUX ÉPURÉS
  //    ESPACE AÉRÉ & LISIBLE (secStartY = 66 mm au lieu de 60 mm !)
  // ==========================================
  const colGap = 8;
  const colW = (pw - marginX * 2 - colGap) / 2; // 130.5 mm
  const col1X = marginX;
  const col2X = marginX + colW + colGap;
  const secStartY = 66; // 9 mm de marge aérée après le cartouche !

  // --- COLONNE GAUCHE : RENSEIGNEMENTS PERSONNELS ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text('1. RENSEIGNEMENTS PERSONNELS DU PORTEUR', col1X, secStartY);

  const dateNaisText = incube?.date_naissance ? new Date(incube.date_naissance).toLocaleDateString('fr-FR') : '—';
  const vText = \`\${incube?.ville || '—'}\${incube?.province && incube.province !== incube.ville ? ' / ' + incube.province : ''}\`;

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
      ['Carte Nationale (CIN)', incube?.cin || '—'],
      ['Date de naissance & Âge', \`\${dateNaisText} (\${ageAnnees})\`],
      ['Genre & Situation', \`\${incube?.genre || '—'} • \${incube?.situation_familiale || '—'}\`],
      ['Niveau d\\'étude', incube?.niveau_etude || '—'],
      ['Spécialité / Métier', incube?.specialite || incube?.secteur_activite || '—'],
      ['Ville & Province', vText],
      ['Téléphone', incube?.telephone || '—']
    ]
  });

  // --- COLONNE DROITE : ENTREPRISE, MARCHÉ & ÉQUIPE RH ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text('2. RENSEIGNEMENTS ENTREPRISE & ENCADREMENT', col2X, secStartY);

  // Calcul dynamique des effectifs RH
  const rhPersonnel = Array.isArray(incube?.personnel) ? incube.personnel : [];
  const rhCount = rhPersonnel.filter(p => p && p.nom_complet && String(p.nom_complet).trim() !== '').length || 1;
  const teamText = \`\${rhCount} collaborateur(s) (calculé depuis RH)\`;
  const dateDemText = incube?.date_demarrage ? new Date(incube.date_demarrage).toLocaleDateString('fr-FR') : '—';

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
      ['Raison sociale', { content: incube?.raison_sociale || '—', colSpan: 3, styles: { fontStyle: 'bold', textColor: [2, 132, 199] } }],
      ['Statut juridique', incube?.statut_juridique || '—', 'Numéro RC', incube?.rc || '—'],
      ['Secteur d\\'activité', { content: incube?.secteur_activite || '—', colSpan: 3 }],
      ['Phase du projet', incube?.phase_projet || 'Lancement', 'Date démarrage', dateDemText],
      ['Cible & Marché', { content: incube?.cible || 'B2B / B2G / B2BC', colSpan: 3, styles: { fontStyle: 'bold' } }],
      ['Promotion', incube?.promotion || 'Promotion 2026', 'Accompagnateur', displayAccomp],
      ['Membres d\\'équipe', { content: teamText, colSpan: 3, styles: { fontStyle: 'bold', textColor: [22, 163, 74] } }]
    ]
  });

  // ==========================================
  // 4. PARTIE BASSE : DESCRIPTION & ASSOCIÉS
  //    ESPACE AÉRÉ & RESPIRANT (bottomY = finalY + 7 mm au lieu de 5 mm)
  // ==========================================
  const bottomY = doc.lastAutoTable.finalY + 7;

  // Description du projet (Gauche)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text('3. DESCRIPTION DU PROJET & PROPOSITION DE VALEUR', col1X, bottomY);

  const descContent = (incube?.description_projet && String(incube.description_projet).trim())
    ? String(incube.description_projet).trim()
    : "Aucune description détaillée renseignée pour ce projet d'incubation.";

  const propValeurContent = (incube?.proposition_valeur && String(incube.proposition_valeur).trim())
    ? String(incube.proposition_valeur).trim()
    : "Développement d'une offre innovante et durable pour le marché cible.";

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
      [{ content: descContent, colSpan: 2, styles: { fillColor: [248, 250, 252], cellPadding: 3 } }],
      ['Proposition de valeur :', { content: propValeurContent, styles: { textColor: [15, 23, 42] } }]
    ]
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
  doc.text(\`4. ASSOCIÉS DU PROJET (\${associesList.length})\`, col2X, bottomY);

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
        formatOfficialName(a.nom),
        a.cin || '—',
        a.fonction || '—',
        (a.badge_id || a.matricule) ? \`RFID-\${a.badge_id || a.matricule}\` : 'Sans badge'
      ])
    });
  } else {
    autoTable(doc, {
      startY: bottomY + 3,
      margin: { left: col2X, right: marginX },
      tableWidth: colW,
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, cellPadding: 1.8 },
      styles: { fontSize: 7.2, cellPadding: 2.2, font: 'helvetica', lineColor: [226, 232, 240], lineWidth: 0.2 },
      head: [['Nom & Prénom', 'CIN', 'Fonction', 'Badge RFID']],
      body: [
        [{ content: "Aucun associé enregistré pour cette startup.", colSpan: 4, styles: { fontStyle: 'italic', textColor: [148, 163, 184], halign: 'center' } }]
      ]
    });
  }

  // ==========================================
  // 5. PIED DE PAGE DISCRET
  // ==========================================
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.line(marginX, ph - 9, pw - marginX, ph - 9);
  doc.text('IDS — Incubateur Digital Solidaire • Salé • Fiche Signalétique Officielle Paysage', marginX, ph - 5.5);
  doc.text(\`Édité le \${today} à \${time} • Page 1 sur 1\`, pw - marginX, ph - 5.5, { align: 'right' });

  return doc;
};`;

const startIndex = content.indexOf('export const generateFicheSignaletiqueDocument = async (incube) => {');
const endIndex = content.indexOf('export const exportFicheSignaletiqueToPDF = async (incube, filename = null) => {');

if (startIndex === -1 || endIndex === -1) {
  console.error('Could not find markers in pdfExport.js:', { startIndex, endIndex });
  process.exit(1);
}

const updatedContent = content.slice(0, startIndex) + newImplementation + '\n\n' + content.slice(endIndex);
fs.writeFileSync(targetFile, updatedContent, 'utf8');
console.log('Successfully updated frontend/src/utils/pdfExport.js with spaced layout & native QRCode!');
