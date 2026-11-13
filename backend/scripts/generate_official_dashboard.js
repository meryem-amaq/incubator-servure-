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

// Données de test : profil Meryem AMAQRAN
const mockMeryem = {
  nom_incube: 'Meryem AMAQRAN',
  cin: 'CD123456',
  date_naissance: '1998-05-14',
  age: '28 ans',
  genre: 'Femme',
  situation_familiale: 'Célibataire',
  niveau_etude: 'Master / Ingénieur d\'État',
  specialite: 'Génie Logiciel & Systèmes Intelligents',
  ville: 'Salé',
  province: 'Salé',
  telephone: '06 42 92 78 14',
  email: 'meryem.amaqran@ids.org.ma',
  linkedin: 'https://linkedin.com/in/meryem-amaqran',
  site_web: 'https://ids.org.ma/',
  raison_sociale: 'AGRI-DATA SOLUTIONS',
  statut_juridique: 'SARL AU',
  rc: '145890',
  secteur_activite: 'AgriTech & Intelligence Artificielle',
  phase_projet: 'Croissance',
  cible: 'B2B / B2G / B2B2C',
  date_demarrage: '07/02/2026',
  promotion: 'Promotion 2026 - S1',
  accompagnateur: 'Mme Nadia Sefiani',
  description_projet: 'AGRI-DATA SOLUTIONS développe une plateforme intelligente d\'analyse prédictive et de monitoring agricole connectée aux stations météorologiques et capteurs IoT, pour optimiser l\'irrigation et sécuriser le rendement des cultures à haute valeur ajoutée.',
  personnel_count: 5,
  associes: [
    { nom: 'Karim Tazi', cin: 'CD654321', fonction: 'Directeur Technique (CTO)', badge_id: '1042' },
    { nom: 'Sara Amoran', cin: 'EF112233', fonction: 'Responsable R&D Agronomie', badge_id: '1043' }
  ]
};

async function buildRefinedOfficialPdf(incube) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pw = 297, ph = 210;
  const marginX = 14;

  const displayName = formatOfficialName(incube.nom_incube || 'Incubé');
  const displayAccomp = formatOfficialName(incube.accompagnateur) || 'Conseiller IDS';
  const ageAnnees = incube.age ? `${incube.age}` : '—';
  const dateNaisText = incube.date_naissance ? new Date(incube.date_naissance).toLocaleDateString('fr-FR') : '—';
  const dateDemText = incube.date_demarrage || '—';
  const vText = incube.ville ? `${incube.ville}${incube.province && incube.province !== incube.ville ? ' / ' + incube.province : ''}` : '—';

  // ==========================================
  // 1. EN-TÊTE : LOGOS ÉQUILIBRÉS & PROPORTIONS RESPECTÉES
  // ==========================================
  const headerY = 8;
  const headerH = 15;

  // 1.1 Logo IDS (Gauche) - Format Carré 1:1
  // Conteneur adapté : largeur 28mm, hauteur 15mm
  const idsBoxW = 28, idsBoxH = 15;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.35);
  doc.roundedRect(marginX, headerY, idsBoxW, idsBoxH, 2.5, 2.5, 'FD');
  // Image IDS centrée : 12.5mm x 12.5mm (aucun écrasement, marges nettes)
  doc.addImage(idsLogo, 'PNG', marginX + (idsBoxW - 12.5) / 2, headerY + (idsBoxH - 12.5) / 2, 12.5, 12.5);

  // 1.2 Logo CTPES (Droite) - Format Rectangulaire 4.35:1
  // Conteneur adapté : largeur 58mm, hauteur 15mm
  const ctpesBoxW = 58, ctpesBoxH = 15;
  const ctpesX = pw - marginX - ctpesBoxW;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.35);
  doc.roundedRect(ctpesX, headerY, ctpesBoxW, ctpesBoxH, 2.5, 2.5, 'FD');
  // Image CTPES centrée : 50mm x 11.5mm (ratio naturel 4.35:1 scrupuleusement respecté)
  doc.addImage(ctpesLogo, 'PNG', ctpesX + (ctpesBoxW - 50) / 2, headerY + (ctpesBoxH - 11.5) / 2, 50, 11.5);

  // 1.3 Titres Centrés Parfaitement à mi-chemin
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

  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'IN';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(148, 163, 184);
  doc.text(initials, photoX + photoSize / 2, photoY + 14.5, { align: 'center' });

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
  doc.text(incube.raison_sociale || 'Projet d\'incubation', textLeftX, cartoucheY + 19);

  // Tagline / Sous-titre léger
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(100, 116, 139); // Slate-500
  const phaseLabel = incube.phase_projet ? `Phase : ${incube.phase_projet}` : 'Phase : Lancement';
  const promoLabel = incube.promotion ? `Promotion : ${incube.promotion}` : 'Promotion 2026';
  doc.text(`${phaseLabel}   •   ${promoLabel}   •   Accompagnement : ${displayAccomp}`, textLeftX, cartoucheY + 26);

  // 2.3 QR Codes (Droite du Cartouche)
  const qrBoxSize = 19;
  const qr2X = pw - marginX - qrBoxSize - 6; // QR Site Web
  const qr1X = qr2X - qrBoxSize - 8;         // QR LinkedIn (8mm d'espace entre les deux !)
  const qrY = cartoucheY + 3.5;

  // Séparateur vertical fin avant les QR codes
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(qr1X - 8, cartoucheY + 4, qr1X - 8, cartoucheY + cartoucheH - 4);

  // Dessin QR Box haute définition
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

  const linkedinUrl = incube.linkedin && String(incube.linkedin).trim() !== ''
    ? incube.linkedin
    : `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(incube.nom_incube || 'IDS')}`;
  await drawQrBox(linkedinUrl, qr1X, qrY, qrBoxSize, 'QR LinkedIn', [10, 102, 194]);

  const siteWebUrl = incube.site_web && String(incube.site_web).trim() !== ''
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
      ['Carte Nationale (CIN)', incube.cin || '—'],
      ['Date de naissance & Âge', `${dateNaisText} (${ageAnnees})`],
      ['Genre & Situation', `${incube.genre || '—'} • ${incube.situation_familiale || '—'}`],
      ['Niveau d\'étude', incube.niveau_etude || '—'],
      ['Spécialité / Métier', incube.specialite || incube.secteur_activite || '—'],
      ['Ville & Province', vText],
      ['Téléphone', incube.telephone || '—']
    ]
  });

  // --- COLONNE DROITE : 2. RENSEIGNEMENTS ENTREPRISE & ENCADREMENT ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('2. RENSEIGNEMENTS ENTREPRISE & ENCADREMENT', col2X, secStartY);

  const teamText = `${incube.personnel_count || 1} collaborateur(s) (calculé depuis RH)`;

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
  // 4. PARTIE BASSE : 3. DESCRIPTION & 4. ASSOCIÉS
  //    ESPACEMENT AÉRÉ : bottomY = finalY + 8 mm
  // ==========================================
  const bottomY = doc.lastAutoTable.finalY + 8;

  // 3. Description du projet (Gauche - uniquement la description réelle sans ajout)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('3. DESCRIPTION DU PROJET', col1X, bottomY);

  const descContent = (incube.description_projet && String(incube.description_projet).trim())
    ? String(incube.description_projet).trim()
    : "Aucune description renseignée pour ce projet.";

  autoTable(doc, {
    startY: bottomY + 3.5,
    margin: { left: col1X, right: pw - col1X - colW },
    tableWidth: colW,
    theme: 'grid',
    styles: { 
      fontSize: 8, 
      font: 'helvetica', 
      lineColor: [226, 232, 240], 
      lineWidth: 0.25,
      fillColor: [248, 250, 252],
      textColor: [30, 41, 59],
      cellPadding: { top: 3.5, bottom: 3.5, left: 3.5, right: 3.5 },
      lineHeightFactor: 1.38
    },
    body: [
      [{ content: descContent }]
    ]
  });

  // 4. Associés du Projet (Droite)
  const associesList = Array.isArray(incube.associes) ? incube.associes : [];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`4. ASSOCIÉS DU PROJET (${associesList.length})`, col2X, bottomY);

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
        (a.badge_id || a.matricule) ? `RFID-${a.badge_id || a.matricule}` : 'Sans badge'
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

  // Fin du document : AUCUN PIED DE PAGE (propre et net !)
  return doc;
}

(async () => {
  const doc = await buildRefinedOfficialPdf(mockMeryem);
  const outPath = path.resolve(__dirname, '../../frontend/public/preview_ui_refined.pdf');
  fs.writeFileSync(outPath, Buffer.from(doc.output('arraybuffer')));
  console.log('PDF generated at:', outPath);
})();
