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
  promotion: 'Promotion 2026 - S1',
  accompagnateur: 'Mme Nadia Sefiani',
  description_projet: "AGRI-DATA SOLUTIONS développe une plateforme intelligente d'analyse prédictive et de monitoring agricole connectée aux stations météorologiques et capteurs IoT, pour optimiser l'irrigation et sécuriser le rendement des cultures à haute valeur ajoutée.",
  personnel_count: 5,
  associes: [
    { nom: 'Karim Tazi', cin: 'CD654321', fonction: 'Directeur Technique (CTO)', badge_id: '1042' },
    { nom: 'Sara Amoran', cin: 'EF112233', fonction: 'Responsable R&D Agronomie', badge_id: '1043' }
  ]
};

// Formateur de nom selon la charte officielle
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

async function buildNewStylePdf(incube) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pw = 297, ph = 210;
  const marginX = 14;
  const colGap = 10;
  const colW = (pw - marginX * 2 - colGap) / 2; // 129.5 mm
  const col1X = marginX;
  const col2X = marginX + colW + colGap;

  // 1. EN-TÊTE
  // Logo IDS (gauche)
  const idsPath = path.resolve(__dirname, '../../frontend/public/logo-ids.png');
  if (fs.existsSync(idsPath)) {
    const idsData = 'data:image/png;base64,' + fs.readFileSync(idsPath).toString('base64');
    doc.addImage(idsData, 'PNG', col1X, 9, 24, 15, '', 'FAST');
  }

  // Logo CTPES (droite)
  const ctpesPath = path.resolve(__dirname, '../../frontend/public/logo-ctpes.png');
  if (fs.existsSync(ctpesPath)) {
    const ctpesData = 'data:image/png;base64,' + fs.readFileSync(ctpesPath).toString('base64');
    doc.addImage(ctpesData, 'PNG', pw - marginX - 52, 10.5, 52, 12, '', 'FAST');
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

  // Y de départ du contenu
  const startContentY = 30;

  // ========================================================
  // COLONNE GAUCHE (col1X = 14 mm, colW = 129.5 mm)
  // 1. Profil (Cartouche)
  // 2. INFORMATIONS PERSONNELLES
  // 3. DESCRIPTION DU PROJET (sans rien ajouter)
  // ========================================================

  // --- 1. PROFIL ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...darkNavy);
  doc.text('Profil', col1X, startContentY);

  const cartoucheY = startContentY + 3;
  const cartoucheH = 32;

  // Boîte Profil (fond gris très doux arrondi)
  doc.setFillColor(241, 245, 249); // #F1F5F9
  doc.setDrawColor(226, 232, 240); // #E2E8F0
  doc.setLineWidth(0.25);
  doc.roundedRect(col1X, cartoucheY, colW, cartoucheH, 2.5, 2.5, 'FD');

  // Avatar / Photo
  const avatarSize = 23;
  const avatarX = col1X + 4.5;
  const avatarY = cartoucheY + (cartoucheH - avatarSize) / 2;
  doc.setFillColor(226, 232, 240);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(avatarX, avatarY, avatarSize, avatarSize, 2, 2, 'FD');

  // Initiales
  const initials = 'AM';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(71, 85, 105);
  doc.text(initials, avatarX + avatarSize / 2, avatarY + avatarSize / 2 + 4, { align: 'center' });

  // Textes Profil
  const textX = avatarX + avatarSize + 5;
  let curY = cartoucheY + 8;

  // Nom complet
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(...darkNavy);
  doc.text(formatOfficialName(incube.nom_incube), textX, curY);

  // Spécialité / Métier
  curY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(100, 116, 139);
  doc.text(incube.specialite_metier || 'Porteur de projet', textX, curY);

  // Raison Sociale
  curY += 5.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(2, 132, 199);
  doc.text(incube.raison_sociale || '—', textX, curY);

  // Phase / Promotion
  curY += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`${incube.phase_projet || 'Lancement'} • ${incube.promotion || 'Promo 2026'}`, textX, curY);

  // QR Codes à droite dans le cartouche
  const qrSize = 15;
  const qrGap = 4.5;
  const qrLinkedInX = col1X + colW - (qrSize * 2 + qrGap + 5);
  const qrWebX = col1X + colW - (qrSize + 5);
  const qrY = cartoucheY + 4;

  const qrLinkedInUrl = await QRCode.toDataURL(incube.linkedin || 'https://linkedin.com', { margin: 0, width: 140 });
  const qrWebUrl = await QRCode.toDataURL(incube.site_web || 'https://ids.ma', { margin: 0, width: 140 });

  doc.addImage(qrLinkedInUrl, 'PNG', qrLinkedInX, qrY, qrSize, qrSize);
  doc.addImage(qrWebUrl, 'PNG', qrWebX, qrY, qrSize, qrSize);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(2, 132, 199);
  doc.text('LinkedIn', qrLinkedInX + qrSize / 2, qrY + qrSize + 3.5, { align: 'center' });
  doc.text('Site Web', qrWebX + qrSize / 2, qrY + qrSize + 3.5, { align: 'center' });

  // --- 2. INFORMATIONS PERSONNELLES ---
  const persY = cartoucheY + cartoucheH + 6.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...darkNavy);
  doc.text('INFORMATIONS PERSONNELLES', col1X, persY);

  const dateNaisText = incube.date_naissance ? new Date(incube.date_naissance).toLocaleDateString('fr-FR') : '—';
  const ageStr = incube.age ? ` (${incube.age})` : '';

  autoTable(doc, {
    startY: persY + 3,
    margin: { left: col1X, right: pw - col1X - colW },
    tableWidth: colW,
    theme: 'grid',
    styles: {
      fontSize: 7.6,
      font: 'helvetica',
      lineColor: borderBlue,
      lineWidth: 0.28,
      cellPadding: { top: 2.8, bottom: 2.8, left: 3.5, right: 3.5 }
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

  const persFinalY = doc.lastAutoTable.finalY;

  // --- 3. DESCRIPTION DU PROJET --- (sans rien ajouter)
  const descTitleY = persFinalY + 6.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...darkNavy);
  doc.text('DESCRIPTION DU PROJET', col1X, descTitleY);

  const descContent = incube.description_projet?.trim() || "Aucune description renseignée pour ce projet.";

  autoTable(doc, {
    startY: descTitleY + 3,
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
      cellPadding: { top: 3.8, bottom: 3.8, left: 4, right: 4 },
      lineHeightFactor: 1.4
    },
    body: [
      [{ content: descContent }]
    ]
  });

  // ========================================================
  // COLONNE DROITE (col2X = 153.5 mm, colW = 129.5 mm)
  // 1. RENSEIGNEMENTS ENTREPRISE & ENCADREMENT
  // 2. ASSOCIÉS DU PROJET
  // ========================================================

  // --- ENTREPRISE & ENCADREMENT ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...darkNavy);
  doc.text('RENSEIGNEMENTS ENTREPRISE & ENCADREMENT', col2X, startContentY);

  const dateDemText = incube.date_demarrage ? new Date(incube.date_demarrage).toLocaleDateString('fr-FR') : '—';
  const teamText = `${incube.personnel_count || 1} collaborateur(s) (calculé depuis RH)`;

  autoTable(doc, {
    startY: startContentY + 3,
    margin: { left: col2X, right: marginX },
    tableWidth: colW,
    theme: 'grid',
    styles: {
      fontSize: 7.6,
      font: 'helvetica',
      lineColor: borderBlue,
      lineWidth: 0.28,
      cellPadding: { top: 2.8, bottom: 2.8, left: 3.5, right: 3.5 }
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
      ['Promotion', incube.promotion || 'Promotion 2026', 'Accompagnateur', incube.accompagnateur || '—'],
      ['Membres d\'équipe', { content: teamText, colSpan: 3, styles: { fontStyle: 'bold', textColor: [22, 163, 74] } }]
    ]
  });

  const entFinalY = doc.lastAutoTable.finalY;

  // --- ASSOCIÉS DU PROJET ---
  const assocY = entFinalY + 6.5;
  const associesList = incube.associes || [];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...darkNavy);
  doc.text(`ASSOCIÉS DU PROJET (${associesList.length})`, col2X, assocY);

  if (associesList.length > 0) {
    autoTable(doc, {
      startY: assocY + 3,
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
        cellPadding: { top: 3, bottom: 3, left: 3.5, right: 3.5 }
      },
      styles: {
        fontSize: 7.4,
        font: 'helvetica',
        lineColor: borderBlue,
        lineWidth: 0.28,
        cellPadding: { top: 3, bottom: 3, left: 3.5, right: 3.5 }
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
      startY: assocY + 3,
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
        cellPadding: { top: 3, bottom: 3, left: 3.5, right: 3.5 }
      },
      styles: {
        fontSize: 7.4,
        font: 'helvetica',
        lineColor: borderBlue,
        lineWidth: 0.28,
        cellPadding: { top: 3, bottom: 3, left: 3.5, right: 3.5 }
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
  const outPath = path.resolve(__dirname, '../../frontend/public/preview_reference_style.pdf');
  fs.writeFileSync(outPath, Buffer.from(doc.output('arraybuffer')));
  console.log('PDF generated at:', outPath);
})();
