const fs = require('fs');
const path = require('path');
const { jsPDF } = require('../../frontend/node_modules/jspdf');
const autoTable = require('../../frontend/node_modules/jspdf-autotable').default;
const QRCode = require('../../frontend/node_modules/qrcode');

// Données de test (Meryem AMAQRAN)
const mockIncube = {
  nom_incube: 'AMAQRAN Meryem',
  cin: 'CD123456',
  date_naissance: '1998-05-14',
  age: '28 ans',
  genre: 'Femme',
  situation_familiale: 'Célibataire',
  niveau_etude: "Master / Ingénieur d'État",
  specialite_metier: 'Génie Logiciel & Systèmes Intelligents',
  ville: 'Salé',
  province: 'Salé',
  telephone: '06 42 92 78 14',
  email: 'meryem.amaqran@gmail.com',
  linkedin: 'https://www.linkedin.com/in/meryem-amaqran',
  site_web: 'https://agridata-solutions.ma',
  raison_sociale: 'AGRI-DATA SOLUTIONS',
  statut_juridique: 'SARL AU',
  rc: '145890',
  secteur_activite: 'AgriTech & Intelligence Artificielle',
  phase_projet: 'Croissance',
  cible: 'B2B / B2G / B2B2C',
  date_demarrage: '2026-02-07',
  promotion: 'Promotion 1',
  accompagnateur: 'Mme Nadia Sefiani',
  description_projet: "AGRI-DATA SOLUTIONS développe une plateforme intelligente d'analyse prédictive et de monitoring agricole connectée aux stations météorologiques et capteurs IoT, pour optimiser l'irrigation et sécuriser le rendement des cultures à haute valeur ajoutée.",
  personnel_count: 5,
  associes: [
    { nom: 'Karim Tazi', cin: 'CD654321', fonction: 'Directeur Technique (CTO)', badge_id: '1042' },
    { nom: 'Sara Amoran', cin: 'EF112233', fonction: 'Responsable R&D Agronomie', badge_id: '1043' }
  ]
};

// Formateur de nom selon la règle
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

  const allCapsWords = words.filter(isCaps);
  const nonCapsWords = words.filter(w => !isCaps(w));
  if (allCapsWords.length > 0 && nonCapsWords.length > 0) {
    return title + allCapsWords.map(w => w.toUpperCase()).join(' ') + ' ' + nonCapsWords.map(capitalize).join(' ');
  }

  return title + words[0].toUpperCase() + ' ' + words.slice(1).map(capitalize).join(' ');
}

// Nom sans civilité (pas de Mme, M., Mr, etc.)
function formatNameWithoutTitle(input) {
  if (!input || typeof input !== 'string') return '—';
  let str = input.trim().replace(/^(M\.|Mme|Mlle|Mr|Ms|Dr|Pr)\s+/i, '').trim();
  return formatOfficialName(str);
}

// Format Promotion : Promotion 1, Promotion 2, etc. (jamais S1)
function formatPromotionClean(p) {
  if (!p) return 'Promotion 1';
  let clean = String(p).trim();
  // Enlever - S1, S1, - S2, etc.
  clean = clean.replace(/[-–—]?\s*S\d+/gi, '').trim();
  if (/^\d+$/.test(clean)) return `Promotion ${clean}`;
  if (!/^promotion/i.test(clean)) return `Promotion ${clean}`;
  return clean;
}

async function buildNewStylePdf(incube) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pw = 297, ph = 210;
  const marginX = 14;
  const colGap = 10;
  const colW = (pw - marginX * 2 - colGap) / 2; // 129.5 mm
  const col1X = marginX;
  const col2X = marginX + colW + colGap;

  const displayAccomp = formatNameWithoutTitle(incube.accompagnateur);
  const displayPromo = formatPromotionClean(incube.promotion);

  // 1. EN-TÊTE : LOGOS BIEN AÉRÉS
  // Logo IDS (gauche)
  const idsPath = path.resolve(__dirname, '../../frontend/public/logo-ids.png');
  if (fs.existsSync(idsPath)) {
    const idsData = 'data:image/png;base64,' + fs.readFileSync(idsPath).toString('base64');
    doc.addImage(idsData, 'PNG', col1X, 9, 23, 14.5, '', 'FAST');
  }

  // Logo CTPES (droite)
  const ctpesPath = path.resolve(__dirname, '../../frontend/public/logo-ctpes.png');
  if (fs.existsSync(ctpesPath)) {
    const ctpesData = 'data:image/png;base64,' + fs.readFileSync(ctpesPath).toString('base64');
    doc.addImage(ctpesData, 'PNG', pw - marginX - 52, 10, 52, 12, '', 'FAST');
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

  // Palette exacte du style de référence
  const borderBlue = [2, 132, 199];      // #0284C7 bleu cyan élégant
  const labelBg = [224, 242, 254];       // #E0F2FE bleu ciel très doux
  const whiteBg = [255, 255, 255];
  const darkNavy = [15, 23, 42];
  const textDark = [30, 41, 59];

  // ========================================================
  // 2. BLOC PROFIL : DESCENDU POUR LAISSER RESPIRER LES LOGOS
  //    cartoucheY = 32 mm (9.5 mm d'espace sous les logos)
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
  doc.setFillColor(226, 232, 240);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(photoX, photoY, photoSize, photoSize, 2, 2, 'FD');

  // Initiales
  const initials = 'AM';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(71, 85, 105);
  doc.text(initials, photoX + photoSize / 2, photoY + photoSize / 2 + 4.2, { align: 'center' });

  // Textes Profil (bien espacés)
  const textX = photoX + photoSize + 6;
  let curY = cartoucheY + 8.5;

  // Nom complet
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(...darkNavy);
  doc.text(formatOfficialName(incube.nom_incube), textX, curY);

  // Spécialité / Métier
  curY += 5.2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(100, 116, 139);
  doc.text(incube.specialite_metier || 'Porteur de projet', textX, curY);

  // Raison Sociale
  curY += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(2, 132, 199);
  doc.text(incube.raison_sociale || '—', textX, curY);

  // Phase / Promotion / Accompagnateur (sans Mme/M., et promotion propre sans S1)
  curY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Phase : ${incube.phase_projet || 'Lancement'}   •   ${displayPromo}   •   Accompagnement : ${displayAccomp}`, textX, curY);

  // QR Codes à droite du cartouche pleine largeur (avec icônes au lieu de texte)
  const qrSize = 19;
  const qrGap = 8;
  const qrWebX = marginX + cartoucheW - qrSize - 6;
  const qrLinkedInX = qrWebX - qrSize - qrGap;
  const qrY = cartoucheY + 3.5;

  // Séparateur vertical fin avant les QR codes
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.35);
  doc.line(qrLinkedInX - 7, cartoucheY + 4, qrLinkedInX - 7, cartoucheY + cartoucheH - 4);

  const qrLinkedInUrl = await QRCode.toDataURL(incube.linkedin || 'https://linkedin.com', { errorCorrectionLevel: 'H', margin: 1, width: 220 });
  const qrWebUrl = await QRCode.toDataURL(incube.site_web || 'https://ids.ma', { errorCorrectionLevel: 'H', margin: 1, width: 220 });

  // Fond blanc pour les QR codes
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(qrLinkedInX, qrY, qrSize, qrSize, 1.5, 1.5, 'FD');
  doc.roundedRect(qrWebX, qrY, qrSize, qrSize, 1.5, 1.5, 'FD');

  doc.addImage(qrLinkedInUrl, 'PNG', qrLinkedInX + 0.5, qrY + 0.5, qrSize - 1, qrSize - 1);
  doc.addImage(qrWebUrl, 'PNG', qrWebX + 0.5, qrY + 0.5, qrSize - 1, qrSize - 1);

  // --- ICÔNES SOIGNÉES SOUS LES QR CODES (AU LIEU DU TEXTE "QR LinkedIn" / "QR Site Web") ---
  const iconY = qrY + qrSize + 2.2;

  // 1. Icône LinkedIn officielle (Badge bleu #0A66C2 avec "in" blanc)
  const inBadgeW = 9, inBadgeH = 4.2;
  const inBadgeX = qrLinkedInX + (qrSize - inBadgeW) / 2;
  doc.setFillColor(10, 102, 194); // #0A66C2 bleu LinkedIn
  doc.roundedRect(inBadgeX, iconY, inBadgeW, inBadgeH, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.8);
  doc.setTextColor(255, 255, 255);
  doc.text('in', inBadgeX + inBadgeW / 2, iconY + 3.1, { align: 'center' });

  // 2. Icône Site Web (Badge bleu #0284C7 avec "WEB" blanc)
  const webBadgeW = 11, webBadgeH = 4.2;
  const webBadgeX = qrWebX + (qrSize - webBadgeW) / 2;
  doc.setFillColor(2, 132, 199); // #0284C7 bleu ciel officiel
  doc.roundedRect(webBadgeX, iconY, webBadgeW, webBadgeH, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.4);
  doc.setTextColor(255, 255, 255);
  doc.text('WEB', webBadgeX + webBadgeW / 2, iconY + 3.1, { align: 'center' });

  // ========================================================
  // 3. DEUX COLONNES PARFAITEMENT ALIGNÉES SANS AUCUN DÉCALAGE
  //    Départ à secStartY = 73 mm
  // ========================================================
  const secStartY = cartoucheY + cartoucheH + 7; // 73 mm

  // --- TITRES DES SECTIONS DU HAUT ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...darkNavy);
  doc.text('1. INFORMATIONS PERSONNELLES DU PORTEUR', col1X, secStartY);
  doc.text('2. RENSEIGNEMENTS ENTREPRISE & ENCADREMENT', col2X, secStartY);

  const upperTablesY = secStartY + 3;

  // TABLEAU 1 (Gauche) : INFORMATIONS PERSONNELLES
  const dateNaisText = incube.date_naissance ? new Date(incube.date_naissance).toLocaleDateString('fr-FR') : '—';
  const ageStr = incube.age ? ` (${incube.age})` : '';

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
      ['Carte Nationale (CIN)', incube.cin || '—'],
      ['Date de naissance & Âge', `${dateNaisText}${ageStr}`],
      ['Genre & Situation', `${incube.genre || '—'} • ${incube.situation_familiale || 'Célibataire'}`],
      ['Niveau d\'étude', incube.niveau_etude || '—'],
      ['Spécialité / Métier', incube.specialite_metier || '—'],
      ['Ville & Province', `${incube.ville || '—'}${incube.province && incube.province !== incube.ville ? ' / ' + incube.province : ''}`],
      ['Téléphone', incube.telephone || '—'],
      ['E-mail', incube.email || '—']
    ]
  });

  const t1FinalY = doc.lastAutoTable.finalY;

  // TABLEAU 2 (Droite) : RENSEIGNEMENTS ENTREPRISE & ENCADREMENT
  const dateDemText = incube.date_demarrage ? new Date(incube.date_demarrage).toLocaleDateString('fr-FR') : '—';
  const teamText = `${incube.personnel_count || 1} collaborateur(s) (calculé depuis RH)`;

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
      ['Raison sociale', { content: incube.raison_sociale || '—', colSpan: 3, styles: { fontStyle: 'bold', textColor: [2, 132, 199] } }],
      ['Statut juridique', incube.statut_juridique || '—', 'Numéro RC', incube.rc || '—'],
      ['Secteur d\'activité', { content: incube.secteur_activite || '—', colSpan: 3 }],
      ['Phase du projet', incube.phase_projet || 'Lancement', 'Date démarrage', dateDemText],
      ['Cible & Marché', { content: incube.cible || 'B2B / B2G / B2BC', colSpan: 3, styles: { fontStyle: 'bold' } }],
      ['Promotion', displayPromo, 'Accompagnateur', displayAccomp],
      // COULEUR DU NOMBRE D'ÉQUIPE IDENTIQUE AUX AUTRES INFOS (PAS DE VERT !)
      ['Membres d\'équipe', { content: teamText, colSpan: 3, styles: { textColor: textDark } }]
    ]
  });

  const t2FinalY = doc.lastAutoTable.finalY;

  // Calcul du Y max commun pour alignement parfait des sections inférieures
  const commonMidY = Math.max(t1FinalY, t2FinalY) + 7;

  // --- TITRES DES SECTIONS DU BAS ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...darkNavy);
  doc.text('3. DESCRIPTION DU PROJET', col1X, commonMidY);

  const associesList = incube.associes || [];
  doc.text(`4. ASSOCIÉS DU PROJET (${associesList.length})`, col2X, commonMidY);

  const lowerTablesY = commonMidY + 3;

  // TABLEAU 3 (Gauche) : DESCRIPTION DU PROJET (sans rien ajouter)
  const descContent = incube.description_projet?.trim() || "Aucune description renseignée pour ce projet.";

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
        (a.badge_id || a.matricule) ? `RFID-${a.badge_id || a.matricule}` : 'Sans badge'
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
}

(async () => {
  const doc = await buildNewStylePdf(mockIncube);
  const outPath = path.resolve(__dirname, '../../frontend/public/preview_aligned_style.pdf');
  fs.writeFileSync(outPath, Buffer.from(doc.output('arraybuffer')));
  console.log('PDF generated at:', outPath);
})();
