const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../../frontend/src/utils/pdfExport.js');
let content = fs.readFileSync(targetFile, 'utf8');

// Replace formatNomPrenomIncube and generateFicheSignaletiqueDocument
const newImplementation = `// ==========================================
// 📄 FICHE SIGNALÉTIQUE & INFORMATIONS GÉNÉRALES
// ==========================================

const commonMoroccanPrenoms = new Set([
  'ahmed', 'mohamed', 'mohammed', 'amine', 'youssef', 'mehdi', 'hamza', 'khalid', 'omar',
  'ali', 'salma', 'sara', 'sarah', 'meryem', 'meriem', 'chaimae', 'chaymae', 'imane', 'ilham',
  'nadia', 'salima', 'abdelkrim', 'abdessamad', 'badreddine', 'aicha', 'layla', 'leila', 'asmaa',
  'fatima', 'zahra', 'hajar', 'ghita', 'soukaina', 'nouhaila', 'zineb', 'anass', 'yassine', 'karim',
  'hassan', 'mustapha', 'rachid', 'said', 'tarik', 'tariq', 'driss', 'adil', 'aziz', 'ayoub'
]);

/**
 * Formate un nom complet selon la charte officielle :
 * NOM DE FAMILLE EN MAJUSCULES, Première lettre du prénom en Majuscule.
 * Fonctionne pour l'incubé, l'accompagnateur et les associés.
 */
export const formatOfficialName = (input) => {
  if (!input || typeof input !== 'string') return '';
  let str = input.trim().replace(/\\s+/g, ' ');
  if (!str) return '';

  let title = '';
  const titleMatch = str.match(/^(M\\.|Mme|Mlle|Mr|Dr|Pr)\\s+/i);
  if (titleMatch) {
    title = titleMatch[1] + ' ';
    str = str.slice(titleMatch[0].length).trim();
  }

  const words = str.split(' ').filter(Boolean);
  if (words.length === 1) return title + words[0].toUpperCase();

  const capitalize = (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  const isCaps = (w) => w.length > 1 && w === w.toUpperCase() && /[A-Z]/.test(w);
  const nomPrefixes = ['el', 'al', 'ait', 'ben', 'ibn', 'bel', 'bou', 'ould'];

  // Cas 1 : Mélange de mots en majuscules et de mots en minuscules
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

  // Par défaut convention administrative : 1er mot = NOM, reste = Prénom
  const nom = words[0].toUpperCase();
  const prenom = words.slice(1).map(capitalize).join(' ');
  return title + nom + ' ' + prenom;
};

export const formatNomPrenomIncube = (fullName) => formatOfficialName(fullName);

export const formatAgeAnnees = (ageStr, dob) => {
  if (dob) {
    const birthDate = new Date(dob);
    if (!isNaN(birthDate.getTime())) {
      const today = new Date();
      let years = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        years--;
      }
      if (years >= 0) return \`\${years} an\${years > 1 ? 's' : ''}\`;
    }
  }
  if (!ageStr) return '—';
  const match = String(ageStr).match(/^(\\d+\\s*ans?)/i);
  if (match) return match[1];
  if (/^\\d+$/.test(String(ageStr).trim())) {
    const num = parseInt(ageStr, 10);
    return \`\${num} an\${num > 1 ? 's' : ''}\`;
  }
  return String(ageStr);
};

export const generateFicheSignaletiqueDocument = async (incube) => {
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

  // Helper pour dessiner un QR Code vectoriel haute résolution
  const drawQrFromSvg = (text, x, y, size, color = [2, 132, 199]) => {
    try {
      const svgStr = ReactDOMServer.renderToStaticMarkup(
        React.createElement(QRCodeSVG, { value: text || 'https://ids.ma', size: 128 })
      );
      const vbMatch = svgStr.match(/viewBox="0 0 (\\d+) (\\d+)"/);
      const gridSize = vbMatch ? parseInt(vbMatch[1], 10) : 25;

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, size, size, 1.5, 1.5, 'FD');

      const pad = size * 0.08;
      const drawSize = size - pad * 2;
      const scale = drawSize / gridSize;

      const matches = [...svgStr.matchAll(/M(\\d+)[, ]+(\\d+)\\s*h(\\d+)v1/g)];
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
  };

  // ==========================================
  // 1. EN-TÊTE : DEUX LOGOS STRICTEMENT ÉGAUX
  // ==========================================
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

  // Photo
  const photoSize = 22;
  const photoX = marginX + 3.5;
  const photoY = cartoucheY + 3;

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(photoX, photoY, photoSize, photoSize, 1.5, 1.5, 'FD');

  if (photoDataUrl) {
    try {
      doc.addImage(photoDataUrl, 'PNG', photoX, photoY, photoSize, photoSize);
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

  // Identité au centre du cartouche (NOM EN MAJUSCULE, Prénom Capitalisé)
  const textLeftX = photoX + photoSize + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(displayName, textLeftX, cartoucheY + 10);

  // Raison sociale
  doc.setFontSize(10);
  doc.setTextColor(2, 132, 199);
  doc.text(incube?.raison_sociale || 'Projet d\\'incubation', textLeftX, cartoucheY + 17.5);

  // QR Codes sur la droite du cartouche
  const qrBoxSize = 20;
  const qr1X = pw - marginX - qrBoxSize * 2 - 14;
  const qr2X = pw - marginX - qrBoxSize - 5;
  const qrY = cartoucheY + 2.5;

  // QR 1 : LinkedIn (vectoriel haute résolution)
  drawQrFromSvg(incube?.linkedin || 'https://www.linkedin.com', qr1X, qrY, qrBoxSize, [10, 102, 194]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(10, 102, 194);
  doc.text('QR LinkedIn', qr1X + qrBoxSize / 2, qrY + qrBoxSize + 3.8, { align: 'center' });

  // QR 2 : Site Web (vectoriel haute résolution)
  drawQrFromSvg(incube?.site_web || 'https://ids.ma', qr2X, qrY, qrBoxSize, [2, 132, 199]);
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
  // ==========================================
  const bottomY = doc.lastAutoTable.finalY + 5;

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

// Replace from '// ==========================================\n// 📄 FICHE SIGNALÉTIQUE' to 'export const exportFicheSignaletiqueToPDF'
const startIndex = content.indexOf('// ==========================================\n// 📄 FICHE SIGNALÉTIQUE');
const endIndex = content.indexOf('export const exportFicheSignaletiqueToPDF = async (incube, filename = null) => {');

if (startIndex === -1 || endIndex === -1) {
  console.error('Could not find markers:', { startIndex, endIndex });
  process.exit(1);
}

const updated = content.slice(0, startIndex) + newImplementation + '\n\n' + content.slice(endIndex);
fs.writeFileSync(targetFile, updated, 'utf8');
console.log('Successfully updated frontend/src/utils/pdfExport.js!');
