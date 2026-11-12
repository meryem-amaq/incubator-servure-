const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../../frontend/src/utils/pdfExport.js');
let content = fs.readFileSync(targetFile, 'utf8');

// 1. Ensure React, ReactDOMServer and QRCodeSVG imports are present at the top
if (!content.includes("from 'qrcode.react'")) {
  content = `import React from 'react';\nimport ReactDOMServer from 'react-dom/server';\nimport { QRCodeSVG } from 'qrcode.react';\n` + content;
}

// 2. Define the new implementation of generateFicheSignaletiqueDocument
const newImplementation = `export const generateFicheSignaletiqueDocument = async (incube) => {
  // Format Horizontal (Landscape A4 : 297mm x 210mm)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pw = doc.internal.pageSize.width; // 297 mm
  const ph = doc.internal.pageSize.height; // 210 mm
  const marginX = 14;

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

  // Helper pour dessiner un QR Code vectoriel authentique
  const drawQrFromSvg = (text, x, y, size, color = [8, 27, 56]) => {
    try {
      const svgStr = ReactDOMServer.renderToStaticMarkup(
        React.createElement(QRCodeSVG, { value: text || 'https://ids.ma', size: 128 })
      );
      const vbMatch = svgStr.match(/viewBox="0 0 (\\d+) (\\d+)"/);
      const gridSize = vbMatch ? parseInt(vbMatch[1], 10) : 25;

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(218, 222, 229);
      doc.setLineWidth(0.4);
      doc.roundedRect(x, y, size, size, 3, 3, 'FD');

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

  // Helper pour dessiner des grilles de points décoratives
  const drawDotGrid = (startX, startY, rows, cols, spacing = 3.5, radius = 0.55, color = [255, 255, 255]) => {
    doc.setFillColor(...color);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        doc.circle(startX + c * spacing, startY + r * spacing, radius, 'F');
      }
    }
  };

  // ==========================================
  // 1. ARRIÈRE-PLAN BICOLORE AVEC COURBE ÉLÉGANTE
  // ==========================================
  // Côté gauche : Ivoire chaud (#F9F8F5)
  doc.setFillColor(249, 248, 245);
  doc.rect(0, 0, pw, ph, 'F');

  // Côté droit : Bleu marine profond (#081B38) avec découpe courbée
  doc.setFillColor(8, 27, 56);
  doc.moveTo(148, 0);
  doc.curveTo(126, 60, 126, 140, 148, ph);
  doc.lineTo(pw, ph);
  doc.lineTo(pw, 0);
  doc.close();
  doc.fill();

  // Accents géométriques subtils côté marine
  doc.setDrawColor(20, 48, 90);
  doc.setLineWidth(0.3);
  doc.line(160, 0, pw, 135);
  doc.line(170, 75, pw - 30, ph);
  doc.line(pw - 55, 0, pw, 55);

  // Accents géométriques subtils côté ivoire
  doc.setDrawColor(228, 220, 206);
  doc.setLineWidth(0.3);
  doc.line(0, 150, 130, 20);
  doc.line(0, 70, 80, 0);

  // Grilles de points décoratives
  drawDotGrid(175, 22, 4, 6, 3.4, 0.55, [255, 255, 255]); // haut bleu marine
  drawDotGrid(105, 175, 3, 7, 3.2, 0.55, [200, 168, 100]); // bas ivoire

  // ==========================================
  // 2. EN-TÊTE : DEUX LOGOS PARFAITEMENT ÉQUILIBRÉS & ÉGAUX
  // ==========================================
  const logoTopY = 8;

  // Logo IDS (Gauche) - Format carré 1:1 -> 16mm x 16mm
  if (logoIds) {
    try {
      doc.addImage(logoIds, 'PNG', marginX, logoTopY, 16, 16);
    } catch (e) {}
  }

  // Logo CTPES (Droite) - Format rectangulaire 4.35:1 -> 54mm x 12.5mm
  const ctpesW = 54, ctpesH = 12.5;
  const ctpesX = pw - marginX - ctpesW;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(ctpesX - 3, logoTopY + 1.5, ctpesW + 6, ctpesH + 3, 2.5, 2.5, 'FD');
  if (logoCtpes) {
    try {
      doc.addImage(logoCtpes, 'PNG', ctpesX, logoTopY + 3, ctpesW, ctpesH);
    } catch (e) {}
  }

  // ==========================================
  // 3. SECTION GAUCHE : TITRE & CARTE PROFIL & IDENTITÉ
  // ==========================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(8, 27, 56);
  doc.text('INFORMATIONS', marginX, 35);
  doc.text('GÉNÉRALES', marginX, 44);

  // Sous-titre avec ligne dorée
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(184, 142, 40); // Or prestige (#B88E28)
  doc.text("DOSSIER DE L'INCUBÉ", marginX, 52);
  doc.setDrawColor(218, 185, 110);
  doc.setLineWidth(0.7);
  doc.line(marginX, 54, marginX + 84, 54);

  // CARTE "PROFIL & IDENTITÉ"
  const profCardX = marginX;
  const profCardY = 60;
  const profCardW = 84;
  const profCardH = 78;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(profCardX, profCardY, profCardW, profCardH, 4, 4, 'FD');

  // Accent vertical bleu marine sur le bord gauche de la carte
  doc.setFillColor(8, 27, 56);
  doc.roundedRect(profCardX, profCardY + 4, 3, 32, 1, 1, 'F');

  // Titre de la carte
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(8, 27, 56);
  doc.text('PROFIL & IDENTITÉ', profCardX + 8, profCardY + 9);

  // Nom complet en grand
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);
  doc.setTextColor(8, 27, 56);
  doc.text(displayName, profCardX + 8, profCardY + 18);

  // Informations détaillées du porteur (SANS Réf Dossier, avec coordonnées bien affichées)
  let pY = profCardY + 26;
  const pSpacing = 5.8;

  // 1. CIN
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(8, 27, 56);
  doc.text('CIN :', profCardX + 8, pY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text(incube?.cin || '—', profCardX + 18, pY);

  // 2. Date de naissance & Âge
  pY += pSpacing;
  const dateNaisText = incube?.date_naissance ? new Date(incube.date_naissance).toLocaleDateString('fr-FR') : '—';
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(8, 27, 56);
  doc.text(\`Né le \${dateNaisText} (\${ageAnnees})\`, profCardX + 8, pY);

  // 3. Genre & Situation
  pY += pSpacing;
  doc.text(\`Genre : \${incube?.genre || '—'}, \${incube?.situation_familiale || '—'}\`, profCardX + 8, pY);

  // 4. Niveau d'étude & Spécialité
  pY += pSpacing;
  doc.setFont('helvetica', 'bold');
  doc.text((incube?.niveau_etude || 'Enseignement Supérieur') + ',', profCardX + 8, pY);
  pY += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.text(incube?.specialite || incube?.secteur_activite || 'Génie Logiciel & Entrepreneuriat', profCardX + 8, pY);

  // 5. Ville
  pY += 5.2;
  const vText = \`\${incube?.ville || 'Salé'}\${incube?.province && incube.province !== incube.ville ? ' / ' + incube.province : ' (Maroc)'}\`;
  doc.text(vText, profCardX + 8, pY);

  // 6. Coordonnées directes (Téléphone & Email) bien mises en valeur
  pY += 6.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(184, 142, 40);
  doc.text('Tél : ', profCardX + 8, pY);
  doc.setTextColor(8, 27, 56);
  doc.text(incube?.telephone || 'Non renseigné', profCardX + 16, pY);

  pY += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(184, 142, 40);
  doc.text('Email : ', profCardX + 8, pY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(incube?.email || 'Non renseigné', profCardX + 20, pY);

  // ==========================================
  // 4. LES 2 QR CODES EN BAS DE LA PAGE
  // ==========================================
  const qrAreaY = 146;
  const qrBoxW = 32;

  // QR 1 : LinkedIn
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(8, 27, 56);
  doc.text('LinkedIn', profCardX + qrBoxW / 2, qrAreaY, { align: 'center' });
  drawQrFromSvg(incube?.linkedin || 'https://www.linkedin.com', profCardX, qrAreaY + 3, qrBoxW, [8, 27, 56]);

  // QR 2 : Site Web
  const qr2X = profCardX + qrBoxW + 8;
  doc.text('Site Web', qr2X + qrBoxW / 2, qrAreaY, { align: 'center' });
  drawQrFromSvg(incube?.site_web || 'https://ids.ma', qr2X, qrAreaY + 3, qrBoxW, [8, 27, 56]);

  // ==========================================
  // 5. ÉLÉMENT CENTRAL : PHOTO & CARTE DESCRIPTION DU PROJET
  // ==========================================
  const photoW = 62, photoH = 82;
  const photoX = 110;
  const photoY = 46;

  // Cadre extérieur photo or luxueux
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(218, 185, 110);
  doc.setLineWidth(1.4);
  doc.roundedRect(photoX - 2.5, photoY - 2.5, photoW + 5, photoH + 5, 5, 5, 'FD');

  if (photoDataUrl) {
    try {
      doc.addImage(photoDataUrl, 'PNG', photoX, photoY, photoW, photoH);
    } catch (e) {
      photoDataUrl = null;
    }
  }
  if (!photoDataUrl) {
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(photoX, photoY, photoW, photoH, 4, 4, 'F');
    const initials = incubeName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'IN';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(148, 163, 184);
    doc.text(initials, photoX + photoW / 2, photoY + photoH / 2 + 8, { align: 'center' });
  }

  // CARTE DESCRIPTION DU PROJET (Aérée, centrée et bordure dorée)
  const descW = 92, descH = 55;
  const descX = photoX - (descW - photoW) / 2;
  const descY = photoY + photoH - 12;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(218, 185, 110);
  doc.setLineWidth(1);
  doc.roundedRect(descX, descY, descW, descH, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(184, 142, 40);
  doc.text('DESCRIPTION DU PROJET', descX + descW / 2, descY + 8, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(8, 27, 56);
  doc.text('Problématique, Solution & Innovation', descX + descW / 2, descY + 14.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(184, 142, 40);
  doc.text('Proposition de valeur :', descX + descW / 2, descY + 19.5, { align: 'center' });

  // Description textuelle
  const projectDesc = (incube?.description_projet && String(incube.description_projet).trim())
    ? String(incube.description_projet).trim()
    : "Projet innovant accompagné par l'Incubateur Digital Solidaire (IDS) dans le cadre du programme de développement entrepreneurial et solidaire.";

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(51, 65, 85);
  const splitDesc = doc.splitTextToSize(projectDesc, descW - 14);
  doc.text(splitDesc, descX + 7, descY + 26, { lineHeightFactor: 1.38 });

  // ==========================================
  // 6. SECTION DROITE : 3 CARTES ÉLÉGANTES BLEU MARINE
  // ==========================================
  const rightX = 205;
  const rightW = 78;

  // Calcul dynamique des effectifs RH et associés
  const rhPersonnel = Array.isArray(incube?.personnel) ? incube.personnel : [];
  const rhCount = rhPersonnel.filter(p => p && p.nom_complet && String(p.nom_complet).trim() !== '').length || 1;

  let associesCount = 1;
  if (Array.isArray(incube?.associes)) {
    associesCount = incube.associes.length || 1;
  } else if (typeof incube?.associes === 'string') {
    try {
      const parsed = JSON.parse(incube.associes);
      if (Array.isArray(parsed) && parsed.length > 0) associesCount = parsed.length;
    } catch (e) {}
  }

  const dateDemText = incube?.date_demarrage ? new Date(incube.date_demarrage).toLocaleDateString('fr-FR') : '—';

  // --- CARTE 1 : ENTREPRISE ---
  const c1Y = 24;
  const c1H = 58;
  doc.setFillColor(7, 24, 49);
  doc.setDrawColor(218, 185, 110);
  doc.setLineWidth(0.5);
  doc.roundedRect(rightX, c1Y, rightW, c1H, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('ENTREPRISE', rightX + 7, c1Y + 7.5);

  let entY = c1Y + 14.5;
  const entSpacing = 6;
  const entBullets = [
    { label: 'Raison sociale', val: incube?.raison_sociale || '—' },
    { label: 'Statut', val: incube?.statut_juridique || '—' },
    { label: 'RC', val: incube?.rc || '—' },
    { label: 'Secteur', val: incube?.secteur_activite || '—' },
    { label: 'Phase', val: incube?.phase_projet || 'Lancement' },
    { label: 'Date de démarrage', val: dateDemText },
    { label: 'Cible', val: incube?.cible || 'B2B / B2C' }
  ];

  entBullets.forEach(b => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(203, 213, 225);
    doc.text(\`•  \${b.label} :\`, rightX + 7, entY);
    const labelW = doc.getTextWidth(\`•  \${b.label} : \`);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(String(b.val), rightX + 7 + labelW, entY);
    entY += entSpacing;
  });

  // --- CARTE 2 : ENCADREMENT & SUIVI ---
  const c2Y = c1Y + c1H + 5;
  const c2H = 26;
  doc.setFillColor(7, 24, 49);
  doc.setDrawColor(218, 185, 110);
  doc.setLineWidth(0.5);
  doc.roundedRect(rightX, c2Y, rightW, c2H, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('ENCADREMENT & SUIVI', rightX + 7, c2Y + 7.5);

  let encY = c2Y + 14.5;
  const encBullets = [
    { label: 'Promotion', val: incube?.promotion || 'Promotion 2026' },
    { label: 'Accompagnateur', val: incube?.accompagnateur || 'Conseiller IDS' }
  ];

  encBullets.forEach(b => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(203, 213, 225);
    doc.text(\`•  \${b.label} :\`, rightX + 7, encY);
    const labelW = doc.getTextWidth(\`•  \${b.label} : \`);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(String(b.val), rightX + 7 + labelW, encY);
    encY += 5.8;
  });

  // --- CARTE 3 : ÉQUIPE & ASSOCIÉS (2 BADGES DISTINCTS SÉPARÉS) ---
  const c3Y = c2Y + c2H + 5;
  const c3H = 46;
  doc.setFillColor(7, 24, 49);
  doc.setDrawColor(218, 185, 110);
  doc.setLineWidth(0.5);
  doc.roundedRect(rightX, c3Y, rightW, c3H, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('ÉQUIPE & ASSOCIÉS', rightX + 7, c3Y + 7.5);

  const midX = rightX + rightW / 2;
  doc.setDrawColor(30, 58, 95);
  doc.setLineWidth(0.4);
  doc.line(midX, c3Y + 12, midX, c3Y + c3H - 4);

  // BADGE 1 : MEMBRES D'ÉQUIPE (Calculé depuis RH)
  const badge1Center = rightX + (rightW / 4);
  doc.setFillColor(235, 205, 145);
  doc.circle(badge1Center, c3Y + 17, 7, 'F');
  doc.setFillColor(8, 27, 56);
  doc.circle(badge1Center, c3Y + 14.5, 1.8, 'F');
  doc.circle(badge1Center - 3, c3Y + 15.5, 1.3, 'F');
  doc.circle(badge1Center + 3, c3Y + 15.5, 1.3, 'F');
  doc.roundedRect(badge1Center - 3.5, c3Y + 17, 7, 3.5, 1, 1, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(String(rhCount).padStart(2, '0'), badge1Center, c3Y + 29, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(203, 213, 225);
  doc.text("Membres", badge1Center, c3Y + 34, { align: 'center' });
  doc.text("de l'équipe", badge1Center, c3Y + 37.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(110, 231, 183);
  doc.text("(Calculé RH)", badge1Center, c3Y + 41.5, { align: 'center' });

  // BADGE 2 : NOMBRE D'ASSOCIÉS
  const badge2Center = midX + (rightW / 4);
  doc.setFillColor(235, 205, 145);
  doc.circle(badge2Center, c3Y + 17, 7, 'F');
  doc.setFillColor(8, 27, 56);
  doc.roundedRect(badge2Center - 4, c3Y + 16, 3.5, 2, 0.5, 0.5, 'F');
  doc.roundedRect(badge2Center + 0.5, c3Y + 16, 3.5, 2, 0.5, 0.5, 'F');
  doc.rect(badge2Center - 1, c3Y + 15.5, 2, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(String(associesCount).padStart(2, '0'), badge2Center, c3Y + 29, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(203, 213, 225);
  doc.text("Nombre", badge2Center, c3Y + 34, { align: 'center' });
  doc.text("d'associés", badge2Center, c3Y + 37.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(148, 163, 184);
  doc.text("(Porteur inclus)", badge2Center, c3Y + 41.5, { align: 'center' });

  // ==========================================
  // 7. PIED DE PAGE DISCRET
  // ==========================================
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(148, 163, 184);
  doc.text('INCUBATEUR DIGITAL SOLIDAIRE (IDS)  •  DOCUMENT CONFIDENTIEL OFFICIEL', marginX, ph - 4);

  doc.setTextColor(148, 163, 184);
  doc.text('CENTRE DES TRÈS PETITES ENTREPRISES SOLIDAIRES (CTPES)', pw - marginX, ph - 4, { align: 'right' });

  return doc;
};`;

// Replace from 'export const generateFicheSignaletiqueDocument' to 'export const exportFicheSignaletiqueToPDF'
const startIndex = content.indexOf('export const generateFicheSignaletiqueDocument = async (incube) => {');
const endIndex = content.indexOf('export const exportFicheSignaletiqueToPDF = async (incube, filename = null) => {');

if (startIndex === -1 || endIndex === -1) {
  console.error('Could not locate markers in file!');
  process.exit(1);
}

const updatedContent = content.slice(0, startIndex) + newImplementation + '\n\n' + content.slice(endIndex);
fs.writeFileSync(targetFile, updatedContent, 'utf8');
console.log('Successfully updated frontend/src/utils/pdfExport.js!');
