const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../../frontend/src/utils/pdfExport.js');
let content = fs.readFileSync(targetFile, 'utf8');

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
  // 1. EN-TÊTE : LOGOS ÉQUILIBRÉS & PROPORTIONS RESPECTÉES
  // ==========================================
  const headerY = 8;
  const headerH = 15;

  // 1.1 Logo IDS (Gauche) - Format Carré 1:1
  const idsBoxW = 28, idsBoxH = 15;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.35);
  doc.roundedRect(marginX, headerY, idsBoxW, idsBoxH, 2.5, 2.5, 'FD');
  if (logoIds) {
    try {
      doc.addImage(logoIds, 'PNG', marginX + (idsBoxW - 12.5) / 2, headerY + (idsBoxH - 12.5) / 2, 12.5, 12.5);
    } catch (e) {}
  }

  // 1.2 Logo CTPES (Droite) - Format Rectangulaire 4.35:1
  const ctpesBoxW = 58, ctpesBoxH = 15;
  const ctpesX = pw - marginX - ctpesBoxW;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.35);
  doc.roundedRect(ctpesX, headerY, ctpesBoxW, ctpesBoxH, 2.5, 2.5, 'FD');
  if (logoCtpes) {
    try {
      doc.addImage(logoCtpes, 'PNG', ctpesX + (ctpesBoxW - 50) / 2, headerY + (ctpesBoxH - 11.5) / 2, 50, 11.5);
    } catch (e) {}
  }

  // 1.3 Titres Centrés Parfaitement
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42); // slate-900 (Bleu marine profond)
  doc.text('INCUBATEUR DIGITAL SOLIDAIRE (IDS)', pw / 2, headerY + 6, { align: 'center' });

  doc.setFontSize(9.5);
  doc.setTextColor(2, 132, 199); // primary sky-600 (Bleu clair officiel)
  doc.text('FICHE SIGNALÉTIQUE & INFORMATIONS GÉNÉRALES', pw / 2, headerY + 12, { align: 'center' });

  // Ligne de séparation fine sous l'en-tête (placée à Y=26, 3mm sous les boîtes de logos)
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(marginX, 26, pw - marginX, 26);

  // ==========================================
  // 2. CARTOUCHE PORTEUR & IDENTITÉ (Y = 30 à 62 mm, Hauteur 32 mm)
  //    ESPACÉ, AÉRÉ, AUCUN ÉLÉMENT COMPRESSÉ
  // ==========================================
  const cartoucheY = 30;
  const cartoucheH = 32;
  const cartoucheW = pw - marginX * 2; // 269 mm

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(marginX, cartoucheY, cartoucheW, cartoucheH, 3.5, 3.5, 'FD');

  // 2.1 Photo / Avatar
  const photoSize = 24;
  const photoX = marginX + 4.5;
  const photoY = cartoucheY + 4;

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.roundedRect(photoX, photoY, photoSize, photoSize, 2.5, 2.5, 'FD');

  if (photoDataUrl) {
    try {
      doc.addImage(photoDataUrl, 'PNG', photoX, photoY, photoSize, photoSize);
      doc.setDrawColor(2, 132, 199);
      doc.setLineWidth(0.5);
      doc.roundedRect(photoX, photoY, photoSize, photoSize, 2.5, 2.5, 'S');
    } catch (e) {
      photoDataUrl = null;
    }
  }
  if (!photoDataUrl) {
    const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'IN';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(148, 163, 184);
    doc.text(initials, photoX + photoSize / 2, photoY + 14.5, { align: 'center' });
  }

  // 2.2 Informations Porteur & Entreprise (avec espacement vertical équilibré)
  const textLeftX = photoX + photoSize + 8; // 8 mm d'espace après la photo

  // Nom complet en grand
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42); // Bleu marine
  doc.text(displayName, textLeftX, cartoucheY + 11.5);

  // Raison sociale
  doc.setFontSize(10.5);
  doc.setTextColor(2, 132, 199); // Bleu clair
  doc.text(incube?.raison_sociale || 'Projet d\\'incubation', textLeftX, cartoucheY + 19);

  // Tagline / Sous-titre léger
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(100, 116, 139); // Slate-500
  const phaseLabel = incube?.phase_projet ? \`Phase : \${incube.phase_projet}\` : 'Phase : Lancement';
  const promoLabel = incube?.promotion ? \`Promotion : \${incube.promotion}\` : 'Promotion 2026';
  doc.text(\`\${phaseLabel}   •   \${promoLabel}   •   Accompagnement : \${displayAccomp}\`, textLeftX, cartoucheY + 26);

  // 2.3 QR Codes (Droite du Cartouche)
  const qrBoxSize = 19;
  const qr2X = pw - marginX - qrBoxSize - 6; // QR Site Web
  const qr1X = qr2X - qrBoxSize - 8;         // QR LinkedIn (8mm d'espace entre les deux !)
  const qrY = cartoucheY + 3.5;

  // Séparateur vertical fin avant les QR codes
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(qr1X - 8, cartoucheY + 4, qr1X - 8, cartoucheY + cartoucheH - 4);

  // Helper pour dessiner des QR codes vectoriels natifs fiables
  const drawQrBox = async (text, x, y, size, label, labelColor = [10, 102, 194]) => {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.35);
    doc.roundedRect(x, y, size, size, 2, 2, 'FD');

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
      console.warn('Erreur QR:', e);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(...labelColor);
    doc.text(label, x + size / 2, y + size + 4.2, { align: 'center' });
  };

  // QR 1 : LinkedIn
  const linkedinUrl = incube?.linkedin && String(incube.linkedin).trim() !== ''
    ? incube.linkedin
    : \`https://www.linkedin.com/search/results/all/?keywords=\${encodeURIComponent(incube?.nom_incube || 'IDS')}\`;
  await drawQrBox(linkedinUrl, qr1X, qrY, qrBoxSize, 'QR LinkedIn', [10, 102, 194]);

  // QR 2 : Site Web
  const siteWebUrl = incube?.site_web && String(incube.site_web).trim() !== ''
    ? incube.site_web
    : 'https://ids.org.ma';
  await drawQrBox(siteWebUrl, qr2X, qrY, qrBoxSize, 'QR Site Web', [2, 132, 199]);

  // ==========================================
  // 3. DEUX COLONNES DE TABLEAUX ÉPURÉS
  //    ESPACEMENT AÉRÉ : secStartY = 70 mm (8 mm d'espace sous le cartouche !)
  //    GAP ENTRE COLONNES ÉLARGI : colGap = 10 mm (au lieu de 8 mm)
  // ==========================================
  const colGap = 10;
  const colW = (pw - marginX * 2 - colGap) / 2; // 129.5 mm
  const col1X = marginX;
  const col2X = marginX + colW + colGap;
  const secStartY = 70;

  // --- COLONNE GAUCHE : 1. RENSEIGNEMENTS PERSONNELS ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('1. RENSEIGNEMENTS PERSONNELS DU PORTEUR', col1X, secStartY);

  const dateNaisText = incube?.date_naissance ? new Date(incube.date_naissance).toLocaleDateString('fr-FR') : '—';
  const vText = \`\${incube?.ville || '—'}\${incube?.province && incube.province !== incube.ville ? ' / ' + incube.province : ''}\`;

  autoTable(doc, {
    startY: secStartY + 3.5,
    margin: { left: col1X, right: pw - col1X - colW },
    tableWidth: colW,
    theme: 'grid',
    styles: { 
      fontSize: 7.7, 
      cellPadding: { top: 2.3, bottom: 2.3, left: 3, right: 3 }, 
      font: 'helvetica', 
      lineColor: [226, 232, 240], 
      lineWidth: 0.25 
    },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [71, 85, 105], cellWidth: 42 },
      1: { textColor: [15, 23, 42], cellWidth: colW - 42 }
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

  // --- COLONNE DROITE : 2. RENSEIGNEMENTS ENTREPRISE & ENCADREMENT ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('2. RENSEIGNEMENTS ENTREPRISE & ENCADREMENT', col2X, secStartY);

  // Calcul dynamique des effectifs RH
  const rhPersonnel = Array.isArray(incube?.personnel) ? incube.personnel : [];
  const rhCount = rhPersonnel.filter(p => p && p.nom_complet && String(p.nom_complet).trim() !== '').length || 1;
  const teamText = \`\${rhCount} collaborateur(s) (calculé depuis RH)\`;
  const dateDemText = incube?.date_demarrage ? new Date(incube.date_demarrage).toLocaleDateString('fr-FR') : '—';

  autoTable(doc, {
    startY: secStartY + 3.5,
    margin: { left: col2X, right: marginX },
    tableWidth: colW,
    theme: 'grid',
    styles: { 
      fontSize: 7.7, 
      cellPadding: { top: 2.3, bottom: 2.3, left: 3, right: 3 }, 
      font: 'helvetica', 
      lineColor: [226, 232, 240], 
      lineWidth: 0.25 
    },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [71, 85, 105], cellWidth: 38 },
      1: { textColor: [15, 23, 42], cellWidth: 27 },
      2: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [71, 85, 105], cellWidth: 36 },
      3: { textColor: [15, 23, 42], cellWidth: colW - 38 - 27 - 36 }
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
  // 4. PARTIE BASSE : 3. DESCRIPTION & 4. ASSOCIÉS
  //    ESPACEMENT AÉRÉ : bottomY = finalY + 8 mm
  // ==========================================
  const bottomY = doc.lastAutoTable.finalY + 8;

  // 3. Description du projet (Gauche)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('3. DESCRIPTION DU PROJET & PROPOSITION DE VALEUR', col1X, bottomY);

  const descContent = (incube?.description_projet && String(incube.description_projet).trim())
    ? String(incube.description_projet).trim()
    : "Aucune description détaillée renseignée pour ce projet d'incubation.";

  const propValeurContent = (incube?.proposition_valeur && String(incube.proposition_valeur).trim())
    ? String(incube.proposition_valeur).trim()
    : "Développement d'une offre innovante et durable pour le marché cible.";

  autoTable(doc, {
    startY: bottomY + 3.5,
    margin: { left: col1X, right: pw - col1X - colW },
    tableWidth: colW,
    theme: 'grid',
    styles: { 
      fontSize: 7.6, 
      font: 'helvetica', 
      lineColor: [226, 232, 240], 
      lineWidth: 0.25 
    },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [71, 85, 105], cellWidth: 38 },
      1: { textColor: [15, 23, 42], cellWidth: colW - 38 }
    },
    body: [
      [{ 
        content: descContent, 
        colSpan: 2, 
        styles: { 
          fillColor: [248, 250, 252], 
          cellPadding: { top: 3.2, bottom: 3.2, left: 3.5, right: 3.5 },
          textColor: [30, 41, 59],
          lineHeightFactor: 1.35
        } 
      }],
      [
        { content: 'Proposition de valeur :', styles: { cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 } } }, 
        { content: propValeurContent, styles: { cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 }, textColor: [15, 23, 42] } }
      ]
    ]
  });

  // 4. Associés du Projet (Droite)
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
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(\`4. ASSOCIÉS DU PROJET (\${associesList.length})\`, col2X, bottomY);

  if (associesList.length > 0) {
    autoTable(doc, {
      startY: bottomY + 3.5,
      margin: { left: col2X, right: marginX },
      tableWidth: colW,
      theme: 'striped',
      headStyles: { 
        fillColor: [15, 23, 42], 
        textColor: [255, 255, 255], 
        fontStyle: 'bold', 
        fontSize: 7.2, 
        cellPadding: { top: 2.2, bottom: 2.2, left: 2.5, right: 2.5 } 
      },
      styles: { 
        fontSize: 7.2, 
        cellPadding: { top: 2.2, bottom: 2.2, left: 2.5, right: 2.5 }, 
        font: 'helvetica', 
        lineColor: [226, 232, 240], 
        lineWidth: 0.2 
      },
      columnStyles: {
        0: { cellWidth: 42 },
        1: { cellWidth: 22 },
        2: { cellWidth: 42 },
        3: { cellWidth: 23.5 }
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
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
      startY: bottomY + 3.5,
      margin: { left: col2X, right: marginX },
      tableWidth: colW,
      theme: 'striped',
      headStyles: { 
        fillColor: [15, 23, 42], 
        textColor: [255, 255, 255], 
        fontStyle: 'bold', 
        fontSize: 7.2, 
        cellPadding: { top: 2.2, bottom: 2.2, left: 2.5, right: 2.5 } 
      },
      styles: { 
        fontSize: 7.2, 
        cellPadding: 2.5, 
        font: 'helvetica', 
        lineColor: [226, 232, 240], 
        lineWidth: 0.2 
      },
      head: [['Nom & Prénom', 'CIN', 'Fonction', 'Badge RFID']],
      body: [
        [{ content: "Aucun associé enregistré pour cette startup.", colSpan: 4, styles: { fontStyle: 'italic', textColor: [148, 163, 184], halign: 'center', cellPadding: 3.5 } }]
      ]
    });
  }

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
console.log('Successfully updated frontend/src/utils/pdfExport.js with refined UI/UX!');
