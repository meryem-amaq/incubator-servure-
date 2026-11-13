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

const replacement = `export const generateFicheSignaletiqueDocument = async (incube) => {
  // Format Horizontal Paysage A4 (297mm x 210mm) - Style Moderne Aligné Pleine Largeur Aéré
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pw = doc.internal.pageSize.width; // 297 mm
  const ph = doc.internal.pageSize.height; // 210 mm
  const marginX = 14;
  const colGap = 10;
  const colW = (pw - marginX * 2 - colGap) / 2; // 129.5 mm
  const col1X = marginX;
  const col2X = marginX + colW + colGap;

  const incubeName = incube?.nom_incube || 'Incubé';
  const displayName = formatOfficialName(incubeName);
  const displayAccomp = formatOfficialName(incube?.accompagnateur) || 'Mme Nadia Sefiani';
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
  // 1. EN-TÊTE : LOGOS ÉQUILIBRÉS & TITRES CENTRÉS
  // ==========================================
  // Logo IDS (gauche)
  if (logoIds) {
    try {
      doc.addImage(logoIds, 'PNG', col1X, 9, 23, 14.5, '', 'FAST');
    } catch (e) {}
  }

  // Logo CTPES (droite)
  if (logoCtpes) {
    try {
      doc.addImage(logoCtpes, 'PNG', pw - marginX - 52, 10, 52, 12, '', 'FAST');
    } catch (e) {}
  }

  // Titre & Sous-titre centrés
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42); // Navy
  doc.text('FICHE SIGNALÉTIQUE & INFORMATIONS GÉNÉRALES', pw / 2, 15, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // Slate
  doc.text('Incubateur Digital Solidaire (IDS) • Fiche signalétique officielle', pw / 2, 20.5, { align: 'center' });

  // Palette exacte du style moderne de référence
  const borderBlue = [2, 132, 199];      // #0284C7 bleu cyan élégant
  const labelBg = [224, 242, 254];       // #E0F2FE bleu ciel très doux
  const whiteBg = [255, 255, 255];
  const darkNavy = [15, 23, 42];
  const textDark = [30, 41, 59];

  // ========================================================
  // 2. BLOC PROFIL : DESCENDU POUR LAISSER RESPIRER LES LOGOS (9.5 mm d'espace)
  //    Cartouche sur toute la largeur (269 mm), QR codes aérés et très lisibles
  // ========================================================
  const cartoucheY = 32;
  const cartoucheH = 34;
  const cartoucheW = pw - marginX * 2; // 269 mm

  // Boîte Profil (fond gris très doux avec coins arrondis)
  doc.setFillColor(241, 245, 249); // #F1F5F9
  doc.setDrawColor(226, 232, 240); // #E2E8F0
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, cartoucheY, cartoucheW, cartoucheH, 3, 3, 'FD');

  // Avatar / Photo
  const photoSize = 25;
  const photoX = marginX + 4.5;
  const photoY = cartoucheY + (cartoucheH - photoSize) / 2;

  if (photoDataUrl) {
    try {
      doc.addImage(photoDataUrl, 'PNG', photoX, photoY, photoSize, photoSize);
      doc.setDrawColor(2, 132, 199);
      doc.setLineWidth(0.35);
      doc.roundedRect(photoX, photoY, photoSize, photoSize, 2, 2, 'S');
    } catch (e) {
      photoDataUrl = null;
    }
  }

  if (!photoDataUrl) {
    doc.setFillColor(226, 232, 240);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(photoX, photoY, photoSize, photoSize, 2, 2, 'FD');

    const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'IN';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(71, 85, 105);
    doc.text(initials, photoX + photoSize / 2, photoY + photoSize / 2 + 4.2, { align: 'center' });
  }

  // Textes Profil (bien espacés et aérés)
  const textX = photoX + photoSize + 6;
  let curY = cartoucheY + 8.5;

  // Nom complet
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(...darkNavy);
  doc.text(displayName, textX, curY);

  // Spécialité / Métier
  curY += 5.2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(100, 116, 139);
  doc.text(incube?.specialite_metier || 'Porteur de projet', textX, curY);

  // Raison Sociale
  curY += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(2, 132, 199);
  doc.text(incube?.raison_sociale || '—', textX, curY);

  // Phase / Promotion / Accompagnateur
  curY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  const phaseStr = incube?.phase_projet || 'Lancement';
  const promoStr = incube?.promotion || 'Promotion 2026';
  doc.text(\`Phase : \${phaseStr}   •   Promotion : \${promoStr}   •   Accompagnement : \${displayAccomp}\`, textX, curY);

  // QR Codes à droite du cartouche pleine largeur (très lisibles & grands !)
  const qrSize = 19;
  const qrGap = 7;
  const qrWebX = marginX + cartoucheW - qrSize - 6;
  const qrLinkedInX = qrWebX - qrSize - qrGap;
  const qrY = cartoucheY + 4;

  // Séparateur vertical fin avant les QR codes
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.35);
  doc.line(qrLinkedInX - 7, cartoucheY + 4, qrLinkedInX - 7, cartoucheY + cartoucheH - 4);

  const linkedinUrl = incube?.linkedin && String(incube.linkedin).trim() !== ''
    ? incube.linkedin
    : \`https://www.linkedin.com/search/results/all/?keywords=\${encodeURIComponent(incube?.nom_incube || 'IDS')}\`;
  const siteWebUrl = incube?.site_web && String(incube.site_web).trim() !== ''
    ? incube.site_web
    : 'https://ids.org.ma';

  try {
    const qrLinkedInUrl = await QRCode.toDataURL(linkedinUrl, { margin: 1, width: 200 });
    const qrWebUrl = await QRCode.toDataURL(siteWebUrl, { margin: 1, width: 200 });

    // Fond blanc pour contraste et scannabilité parfaite
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(qrLinkedInX, qrY, qrSize, qrSize, 1.5, 1.5, 'FD');
    doc.roundedRect(qrWebX, qrY, qrSize, qrSize, 1.5, 1.5, 'FD');

    doc.addImage(qrLinkedInUrl, 'PNG', qrLinkedInX + 0.5, qrY + 0.5, qrSize - 1, qrSize - 1);
    doc.addImage(qrWebUrl, 'PNG', qrWebX + 0.5, qrY + 0.5, qrSize - 1, qrSize - 1);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(2, 132, 199);
    doc.text('QR LinkedIn', qrLinkedInX + qrSize / 2, qrY + qrSize + 4, { align: 'center' });
    doc.text('QR Site Web', qrWebX + qrSize / 2, qrY + qrSize + 4, { align: 'center' });
  } catch (e) {
    console.warn('Erreur génération QR codes:', e);
  }

  // ========================================================
  // 3. DEUX COLONNES PARFAITEMENT ALIGNÉES SANS AUCUN DÉCALAGE
  //    Départ synchrone à secStartY = 73 mm
  // ========================================================
  const secStartY = cartoucheY + cartoucheH + 7; // 73 mm

  // --- TITRES DES SECTIONS DU HAUT (PARFAITEMENT SUR LA MÊME LIGNE) ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...darkNavy);
  doc.text('1. INFORMATIONS PERSONNELLES DU PORTEUR', col1X, secStartY);
  doc.text('2. RENSEIGNEMENTS ENTREPRISE & ENCADREMENT', col2X, secStartY);

  const upperTablesY = secStartY + 3;

  // TABLEAU 1 (Gauche) : INFORMATIONS PERSONNELLES
  const dateNaisText = incube?.date_naissance ? new Date(incube.date_naissance).toLocaleDateString('fr-FR') : '—';
  const ageStr = incube?.age ? \` (\${incube.age})\` : '';

  autoTable(doc, {
    startY: upperTablesY,
    margin: { left: col1X, right: pw - col1X - colW },
    tableWidth: colW,
    theme: 'grid',
    styles: {
      fontSize: 7.6,
      font: 'helvetica',
      lineColor: borderBlue,
      lineWidth: 0.28,
      cellPadding: { top: 2.6, bottom: 2.6, left: 3.5, right: 3.5 }
    },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: labelBg, textColor: darkNavy, cellWidth: 40 },
      1: { fillColor: whiteBg, textColor: textDark, cellWidth: colW - 40 }
    },
    body: [
      ['Carte Nationale (CIN)', incube?.cin || '—'],
      ['Date de naissance & Âge', \`\${dateNaisText}\${ageStr}\`],
      ['Genre & Situation', \`\${incube?.genre || '—'} • \${incube?.situation_familiale || 'Célibataire'}\`],
      ['Niveau d\\'étude', incube?.niveau_etude || '—'],
      ['Spécialité / Métier', incube?.specialite_metier || '—'],
      ['Ville & Province', \`\${incube?.ville || '—'}\${incube?.province && incube.province !== incube.ville ? ' / ' + incube.province : ''}\`],
      ['Téléphone', incube?.telephone || '—'],
      ['E-mail', incube?.email || '—']
    ]
  });

  const t1FinalY = doc.lastAutoTable.finalY;

  // TABLEAU 2 (Droite) : RENSEIGNEMENTS ENTREPRISE & ENCADREMENT
  const dateDemText = incube?.date_demarrage ? new Date(incube.date_demarrage).toLocaleDateString('fr-FR') : '—';
  const teamText = \`\${incube?.personnel_count || 1} collaborateur(s) (calculé depuis RH)\`;

  autoTable(doc, {
    startY: upperTablesY,
    margin: { left: col2X, right: marginX },
    tableWidth: colW,
    theme: 'grid',
    styles: {
      fontSize: 7.6,
      font: 'helvetica',
      lineColor: borderBlue,
      lineWidth: 0.28,
      cellPadding: { top: 2.6, bottom: 2.6, left: 3.5, right: 3.5 }
    },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: labelBg, textColor: darkNavy, cellWidth: 34 },
      1: { fillColor: whiteBg, textColor: textDark, cellWidth: 31 },
      2: { fontStyle: 'bold', fillColor: labelBg, textColor: darkNavy, cellWidth: 31 },
      3: { fillColor: whiteBg, textColor: textDark, cellWidth: colW - 34 - 31 - 31 }
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

  const t2FinalY = doc.lastAutoTable.finalY;

  // Calcul du Y max commun pour que les sections inférieures démarrent exactement sur la même ligne horizontale
  const commonMidY = Math.max(t1FinalY, t2FinalY) + 7;

  // --- TITRES DES SECTIONS DU BAS (PARFAITEMENT SUR LA MÊME LIGNE) ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...darkNavy);
  doc.text('3. DESCRIPTION DU PROJET', col1X, commonMidY);

  let associesList = [];
  if (Array.isArray(incube?.associes)) {
    associesList = incube.associes;
  } else if (typeof incube?.associes === 'string') {
    try {
      const parsed = JSON.parse(incube.associes);
      if (Array.isArray(parsed)) associesList = parsed;
    } catch (e) {}
  }
  doc.text(\`4. ASSOCIÉS DU PROJET (\${associesList.length})\`, col2X, commonMidY);

  const lowerTablesY = commonMidY + 3;

  // TABLEAU 3 (Gauche) : DESCRIPTION DU PROJET (sans rien ajouter)
  const descContent = (incube?.description_projet && String(incube.description_projet).trim())
    ? String(incube.description_projet).trim()
    : "Aucune description renseignée pour ce projet.";

  autoTable(doc, {
    startY: lowerTablesY,
    margin: { left: col1X, right: pw - col1X - colW },
    tableWidth: colW,
    theme: 'grid',
    styles: {
      fontSize: 7.8,
      font: 'helvetica',
      lineColor: borderBlue,
      lineWidth: 0.28,
      fillColor: whiteBg,
      textColor: textDark,
      cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
      lineHeightFactor: 1.4
    },
    body: [
      [{ content: descContent }]
    ]
  });

  // TABLEAU 4 (Droite) : ASSOCIÉS DU PROJET
  if (associesList.length > 0) {
    autoTable(doc, {
      startY: lowerTablesY,
      margin: { left: col2X, right: marginX },
      tableWidth: colW,
      theme: 'grid',
      headStyles: {
        fillColor: labelBg,
        textColor: darkNavy,
        fontStyle: 'bold',
        fontSize: 7.4,
        lineColor: borderBlue,
        lineWidth: 0.28,
        cellPadding: { top: 2.8, bottom: 2.8, left: 3.5, right: 3.5 }
      },
      styles: {
        fontSize: 7.4,
        font: 'helvetica',
        lineColor: borderBlue,
        lineWidth: 0.28,
        cellPadding: { top: 2.8, bottom: 2.8, left: 3.5, right: 3.5 }
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 42 },
        1: { cellWidth: 26 },
        2: { cellWidth: 38 },
        3: { cellWidth: colW - 42 - 26 - 38 }
      },
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
      startY: lowerTablesY,
      margin: { left: col2X, right: marginX },
      tableWidth: colW,
      theme: 'grid',
      headStyles: {
        fillColor: labelBg,
        textColor: darkNavy,
        fontStyle: 'bold',
        fontSize: 7.4,
        lineColor: borderBlue,
        lineWidth: 0.28,
        cellPadding: { top: 2.8, bottom: 2.8, left: 3.5, right: 3.5 }
      },
      styles: {
        fontSize: 7.4,
        font: 'helvetica',
        lineColor: borderBlue,
        lineWidth: 0.28,
        cellPadding: { top: 2.8, bottom: 2.8, left: 3.5, right: 3.5 }
      },
      head: [['Nom & Prénom', 'CIN', 'Fonction', 'Badge RFID']],
      body: [
        [{ content: "Aucun associé enregistré pour cette startup.", colSpan: 4, styles: { fontStyle: 'italic', textColor: [148, 163, 184], halign: 'center', cellPadding: 4 } }]
      ]
    });
  }

  // Aucun footer
  return doc;
};

`;

const newContent = content.slice(0, startIndex) + replacement + content.slice(endIndex);
fs.writeFileSync(targetPath, newContent, 'utf8');
console.log('Successfully updated frontend/src/utils/pdfExport.js with spaced profile layout!');
