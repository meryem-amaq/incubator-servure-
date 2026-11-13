const { jsPDF } = require('../../frontend/node_modules/jspdf');
const autoTable = require('../../frontend/node_modules/jspdf-autotable').default;
const fs = require('fs');
const path = require('path');
const QRCode = require('../../frontend/node_modules/qrcode');

const idsLogo = 'data:image/png;base64,' + fs.readFileSync(path.resolve(__dirname, '../../frontend/public/logo-ids.png')).toString('base64');
const ctpesLogo = 'data:image/png;base64,' + fs.readFileSync(path.resolve(__dirname, '../../frontend/public/logo-ctpes.png')).toString('base64');

const commonMoroccanPrenoms = new Set([
  'ahmed', 'mohamed', 'mohammed', 'amine', 'youssef', 'mehdi', 'hamza', 'khalid', 'omar',
  'ali', 'salma', 'sara', 'sarah', 'meryem', 'meriem', 'chaimae', 'chaymae', 'imane', 'ilham',
  'nadia', 'salima', 'abdelkrim', 'abdessamad', 'badreddine', 'aicha', 'layla', 'leila', 'asmaa',
  'fatima', 'zahra', 'hajar', 'ghita', 'soukaina', 'nouhaila', 'zineb', 'anass', 'yassine', 'karim',
  'hassan', 'mustapha', 'rachid', 'said', 'tarik', 'tariq', 'driss', 'adil', 'aziz', 'ayoub'
]);

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

  const allCapsWords = words.filter(isCaps);
  const nonCapsWords = words.filter(w => !isCaps(w));
  if (allCapsWords.length > 0 && nonCapsWords.length > 0) {
    const nom = allCapsWords.map(w => w.toUpperCase()).join(' ');
    const prenom = nonCapsWords.map(capitalize).join(' ');
    return title + nom + ' ' + prenom;
  }

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

  if (words.length >= 2 && nomPrefixes.includes(words[0].toLowerCase())) {
    const prenom = capitalize(words[words.length - 1]);
    const nom = words.slice(0, words.length - 1).map(w => w.toUpperCase()).join(' ');
    return title + nom + ' ' + prenom;
  }

  if (words.length >= 3 && nomPrefixes.includes(words[words.length - 2].toLowerCase())) {
    const prenom = words.slice(0, words.length - 2).map(capitalize).join(' ');
    const nom = words.slice(words.length - 2).map(w => w.toUpperCase()).join(' ');
    return title + nom + ' ' + prenom;
  }

  const nom = words[0].toUpperCase();
  const prenom = words.slice(1).map(capitalize).join(' ');
  return title + nom + ' ' + prenom;
}

// Données réelles de Meryem AMAQRAN du screenshot
const mockMeryem = {
  nom_incube: 'Meryem AMAQRAN',
  cin: '',
  date_naissance: null,
  age: null,
  genre: null,
  situation_familiale: 'Célibataire',
  niveau_etude: null,
  specialite: null,
  ville: null,
  province: null,
  telephone: '0642927814',
  email: '',
  linkedin: '', // Vide dans la base -> doit quand même afficher un QR code valide ou fallback IDS
  site_web: 'https://ids.org.ma/',
  raison_sociale: 'sarl',
  statut_juridique: 'Auto-entrepreneur',
  rc: '',
  secteur_activite: '',
  phase_projet: 'Maturité',
  cible: 'B2B / B2G / B2BC',
  date_demarrage: '07/02/2026',
  promotion: 'Promotion 2026',
  accompagnateur: 'AMA Test',
  description_projet: '',
  proposition_valeur: '',
  personnel_count: 1,
  associes: []
};

async function buildOfficialSpacedPdf(incube) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pw = 297, ph = 210;
  const marginX = 14;

  const displayName = formatOfficialName(incube.nom_incube || 'Incubé');
  const displayAccomp = formatOfficialName(incube.accompagnateur) || 'Conseiller IDS';
  const ageAnnees = incube.age ? `${incube.age} ans` : '—';
  const dateNaisText = incube.date_naissance ? new Date(incube.date_naissance).toLocaleDateString('fr-FR') : '—';
  const dateDemText = incube.date_demarrage || '—';
  const vText = incube.ville ? `${incube.ville}${incube.province && incube.province !== incube.ville ? ' / ' + incube.province : ''}` : '—';

  // ==========================================
  // 1. EN-TÊTE : DEUX LOGOS PARFAITEMENT ÉQUILIBRÉS
  // ==========================================
  const badgeW = 38, badgeH = 14, badgeY = 8, badgeR = 2;

  // Logo IDS (Gauche)
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(marginX, badgeY, badgeW, badgeH, badgeR, badgeR, 'FD');
  doc.addImage(idsLogo, 'PNG', marginX + (badgeW - 12) / 2, badgeY + (badgeH - 12) / 2, 12, 12);

  // Logo CTPES (Droite)
  const ctpesX = pw - marginX - badgeW;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(ctpesX, badgeY, badgeW, badgeH, badgeR, badgeR, 'FD');
  doc.addImage(ctpesLogo, 'PNG', ctpesX + (badgeW - 31) / 2, badgeY + (badgeH - 7.1) / 2, 31, 7.1);

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
  //    ESPACÉ ET AÉRÉ (Y = 28 à 58 mm, hauteur 30 mm)
  // ==========================================
  const cartoucheY = 28;
  const cartoucheH = 29;
  const cartoucheW = pw - marginX * 2; // 269 mm

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(marginX, cartoucheY, cartoucheW, cartoucheH, 3, 3, 'FD');

  // Photo / Avatar avec bordure soignée
  const photoSize = 23;
  const photoX = marginX + 3.5;
  const photoY = cartoucheY + 3;

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.roundedRect(photoX, photoY, photoSize, photoSize, 2, 2, 'FD');

  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'IN';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(148, 163, 184);
  doc.text(initials, photoX + photoSize / 2, photoY + 14, { align: 'center' });

  // Identité au centre du cartouche
  const textLeftX = photoX + photoSize + 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(15, 23, 42);
  doc.text(displayName, textLeftX, cartoucheY + 11);

  // Raison sociale
  doc.setFontSize(10.5);
  doc.setTextColor(2, 132, 199);
  doc.text(incube.raison_sociale || 'Projet d\'incubation', textLeftX, cartoucheY + 18.5);

  // ==========================================
  // LES DEUX QR CODES GÉNÉRÉS PAR QRCode.toDataURL
  // ==========================================
  const qrBoxSize = 18;
  const qr1X = pw - marginX - qrBoxSize * 2 - 16;
  const qr2X = pw - marginX - qrBoxSize - 6;
  const qrY = cartoucheY + 2.5;

  // Séparateur vertical fin avant les QR codes
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(qr1X - 7, cartoucheY + 3, qr1X - 7, cartoucheY + cartoucheH - 3);

  // Helper dessin de boîte QR Code
  const drawQrBox = async (text, x, y, size, label, labelColor = [10, 102, 194]) => {
    // Cadre blanc avec bordure arrondie
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
      console.warn('Erreur QR:', e);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(...labelColor);
    doc.text(label, x + size / 2, y + size + 4, { align: 'center' });
  };

  // QR 1 : LinkedIn
  await drawQrBox(
    incube.linkedin || (incube.nom_incube ? `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(incube.nom_incube)}` : 'https://linkedin.com'),
    qr1X,
    qrY,
    qrBoxSize,
    'QR LinkedIn',
    [10, 102, 194]
  );

  // QR 2 : Site Web
  await drawQrBox(
    incube.site_web || 'https://ids.org.ma',
    qr2X,
    qrY,
    qrBoxSize,
    'QR Site Web',
    [2, 132, 199]
  );

  // ==========================================
  // 3. DEUX COLONNES DE TABLEAUX ÉPURÉS
  //    AVEC UN VRAI ESPACE AÉRÉ (secStartY = 66 mm au lieu de 60 mm !)
  // ==========================================
  const colGap = 8;
  const colW = (pw - marginX * 2 - colGap) / 2; // 130.5 mm
  const col1X = marginX;
  const col2X = marginX + colW + colGap;
  const secStartY = 66; // 8 mm d'espace propre et aéré après le cartouche !

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
      ['Carte Nationale (CIN)', incube.cin || '—'],
      ['Date de naissance & Âge', `${dateNaisText} (${ageAnnees})`],
      ['Genre & Situation', `${incube.genre || '—'} • ${incube.situation_familiale || '—'}`],
      ['Niveau d\'étude', incube.niveau_etude || '—'],
      ['Spécialité / Métier', incube.specialite || incube.secteur_activite || '—'],
      ['Ville & Province', vText],
      ['Téléphone', incube.telephone || '—']
    ]
  });

  // --- COLONNE DROITE : ENTREPRISE, MARCHÉ & ÉQUIPE RH ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text('2. RENSEIGNEMENTS ENTREPRISE & ENCADREMENT', col2X, secStartY);

  const teamText = `${incube.personnel_count || 1} collaborateur(s) (calculé depuis RH)`;

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
      ['Raison sociale', { content: incube.raison_sociale || '—', colSpan: 3, styles: { fontStyle: 'bold', textColor: [2, 132, 199] } }],
      ['Statut juridique', incube.statut_juridique || '—', 'Numéro RC', incube.rc || '—'],
      ['Secteur d\'activité', { content: incube.secteur_activite || '—', colSpan: 3 }],
      ['Phase du projet', incube.phase_projet || 'Lancement', 'Date démarrage', dateDemText],
      ['Cible & Marché', { content: incube.cible || 'B2B / B2G / B2BC', colSpan: 3, styles: { fontStyle: 'bold' } }],
      ['Promotion', incube.promotion || 'Promotion 2026', 'Accompagnateur', displayAccomp],
      ['Membres d\'équipe', { content: teamText, colSpan: 3, styles: { fontStyle: 'bold', textColor: [22, 163, 74] } }]
    ]
  });

  // ==========================================
  // 4. PARTIE BASSE : DESCRIPTION & ASSOCIÉS
  //    AVEC UN VRAI ESPACE AÉRÉ (bottomY = finalY + 7 mm au lieu de 5 mm)
  // ==========================================
  const bottomY = doc.lastAutoTable.finalY + 7;

  // Description du projet (Gauche)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text('3. DESCRIPTION DU PROJET & PROPOSITION DE VALEUR', col1X, bottomY);

  const descContent = (incube.description_projet && String(incube.description_projet).trim())
    ? String(incube.description_projet).trim()
    : "Aucune description détaillée renseignée pour ce projet d'incubation.";

  const propValeurContent = (incube.proposition_valeur && String(incube.proposition_valeur).trim())
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
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text(`4. ASSOCIÉS DU PROJET (${incube.associes.length})`, col2X, bottomY);

  if (incube.associes.length > 0) {
    autoTable(doc, {
      startY: bottomY + 3,
      margin: { left: col2X, right: marginX },
      tableWidth: colW,
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, cellPadding: 1.8 },
      styles: { fontSize: 7.2, cellPadding: 1.8, font: 'helvetica', lineColor: [226, 232, 240], lineWidth: 0.2 },
      head: [['Nom & Prénom', 'CIN', 'Fonction', 'Badge RFID']],
      body: incube.associes.map(a => [
        formatOfficialName(a.nom),
        a.cin || '—',
        a.fonction || '—',
        (a.badge_id || a.matricule) ? `RFID-${a.badge_id || a.matricule}` : 'Sans badge'
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
  doc.text('Édité le ' + new Date().toLocaleDateString('fr-FR') + ' • Page 1 sur 1', pw - marginX, ph - 5.5, { align: 'right' });

  return doc;
}

(async () => {
  const doc = await buildOfficialSpacedPdf(mockMeryem);
  const outPath = path.resolve(__dirname, '../../frontend/public/preview_meryem_fixed.pdf');
  fs.writeFileSync(outPath, Buffer.from(doc.output('arraybuffer')));
  console.log('PDF generated at:', outPath);
})();
