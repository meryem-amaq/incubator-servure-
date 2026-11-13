import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getPhotoUrl } from '../api/axios';

// ==========================================
// 🎨 LOGOS ET EN-TÊTE OFFICIEL
// ==========================================

let cachedLogoIds = null;
let cachedLogoCtpes = null;

export const loadImageAsDataUrl = (url) => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(null);
    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    } catch {
      resolve(null);
    }
  });
};

export const preloadLogos = async () => {
  if (typeof window === 'undefined') return;
  try {
    const [ids, ctpes] = await Promise.all([
      cachedLogoIds ? Promise.resolve(cachedLogoIds) : loadImageAsDataUrl('/logo-ids.png'),
      cachedLogoCtpes ? Promise.resolve(cachedLogoCtpes) : loadImageAsDataUrl('/logo-ctpes.png')
    ]);
    if (ids) cachedLogoIds = ids;
    if (ctpes) cachedLogoCtpes = ctpes;
  } catch (e) {
    console.warn('Erreur préchargement logos PDF:', e);
  }
};

if (typeof window !== 'undefined') {
  preloadLogos();
}

export const ensureLogosLoaded = async () => {
  if (cachedLogoIds && cachedLogoCtpes) return { logoIds: cachedLogoIds, logoCtpes: cachedLogoCtpes };
  await preloadLogos();
  return { logoIds: cachedLogoIds, logoCtpes: cachedLogoCtpes };
};

export const drawOfficialHeader = (doc, title, subtitle = '', isLandscape = true) => {
  const pageWidth = doc.internal.pageSize.width;
  const marginX = 14;

  if (isLandscape) {
    // 1. Logo IDS (Gauche)
    if (cachedLogoIds) {
      try {
        doc.addImage(cachedLogoIds, 'PNG', marginX, 7, 16, 16);
      } catch (e) {}
    }

    // 2. Logo CTPES (Droite)
    if (cachedLogoCtpes) {
      try {
        doc.addImage(cachedLogoCtpes, 'PNG', pageWidth - marginX - 44, 9, 44, 11);
      } catch (e) {}
    }

    // 3. Titre central officiel
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('ROYAUME DU MAROC', pageWidth / 2, 9, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('INCUBATEUR DIGITAL SOLIDAIRE (IDS)', pageWidth / 2, 14, { align: 'center' });

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text(title, pageWidth / 2, 20, { align: 'center' });

    if (subtitle) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(subtitle, pageWidth / 2, 25, { align: 'center' });
    }

    // Ligne séparatrice
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.6);
    doc.line(marginX, 28, pageWidth - marginX, 28);
  } else {
    // Portrait
    // 1. Logo IDS (Gauche)
    if (cachedLogoIds) {
      try {
        doc.addImage(cachedLogoIds, 'PNG', marginX, 7, 15, 15);
      } catch (e) {}
    }

    // 2. Logo CTPES (Droite)
    if (cachedLogoCtpes) {
      try {
        doc.addImage(cachedLogoCtpes, 'PNG', pageWidth - marginX - 40, 9, 40, 10);
      } catch (e) {}
    }

    // 3. Titre central officiel
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('ROYAUME DU MAROC', pageWidth / 2, 8.5, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('INCUBATEUR DIGITAL SOLIDAIRE (IDS)', pageWidth / 2, 13.5, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text(title, pageWidth / 2, 19.5, { align: 'center' });

    if (subtitle) {
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(subtitle, pageWidth / 2, 24.5, { align: 'center' });
    }

    // Ligne séparatrice
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.6);
    doc.line(marginX, 27.5, pageWidth - marginX, 27.5);
  }
};

const generatePDFDocument = (incubeName, title, columns, data, signatureImage) => {
  const doc = new jsPDF('landscape');

  const today = new Date().toLocaleDateString('fr-FR');
  const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const subtitleText = `${incubeName ? incubeName + ' • ' : ''}Édité le ${today} à ${time}`;

  autoTable(doc, {
    startY: 34,
    head: [columns.map(c => c.header)],
    body: data.map(row => columns.map(c => {
      const val = row[c.dataKey];
      if (val === null || val === undefined) return '';
      return String(val);
    })),
    styles: {
      fontSize: 10,
      cellPadding: 5,
      textColor: [51, 65, 85],
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10.5,
      cellPadding: 6,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { top: 34, left: 14, right: 14, bottom: 60 },
    didDrawPage: function (data) {
      drawOfficialHeader(doc, title, subtitleText, true);

      // Pied de page
      const pageHeight = doc.internal.pageSize.height;
      const pageWidth = doc.internal.pageSize.width;
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${data.pageNumber} • Document officiel Incubateur Digital Solidaire (IDS)`,
        pageWidth / 2,
        pageHeight - 5,
        { align: 'center' }
      );
    }
  });

  const finalY = doc.lastAutoTable?.finalY || 35;
  const pageHeight = doc.internal.pageSize.height;

  // Si le contenu du tableau ne laisse pas assez d'espace au pied de page, ajouter une nouvelle page
  if (finalY > pageHeight - 55) {
    doc.addPage();
  }

  // Signature fixée au pied de la dernière page (même si la page est presque vide)
  const sigY = pageHeight - 48;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  
  doc.text("Signature de l'Incubé", 40, sigY);
  
  const pageWidth = doc.internal.pageSize.width;
  doc.text("Signature de l'Accompagnateur", pageWidth - 90, sigY);

  if (signatureImage && typeof signatureImage === 'object' && !Array.isArray(signatureImage)) {
    // Both signatures passed as object
    if (signatureImage.incube) {
      doc.addImage(signatureImage.incube, 'PNG', 35, sigY + 5, 50, 25);
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(16, 185, 129);
      doc.text("Signé électroniquement", 40, sigY + 35);
    } else {
      doc.setDrawColor(203, 213, 225);
      doc.line(35, sigY + 35, 85, sigY + 35);
    }

    if (signatureImage.accompagnateur) {
      doc.addImage(signatureImage.accompagnateur, 'PNG', pageWidth - 95, sigY + 5, 50, 25);
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(16, 185, 129);
      doc.text("Signé électroniquement", pageWidth - 90, sigY + 35);
    } else {
      doc.setDrawColor(203, 213, 225);
      doc.line(pageWidth - 95, sigY + 35, pageWidth - 45, sigY + 35);
    }
  } else if (signatureImage) {
    // Backwards compatibility for single signature
    doc.addImage(signatureImage, 'PNG', 35, sigY + 5, 50, 25);
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(16, 185, 129);
    doc.text("Signé électroniquement", 40, sigY + 35);

    doc.setDrawColor(203, 213, 225); // slate-300
    doc.line(pageWidth - 90, sigY + 35, pageWidth - 25, sigY + 35);
  } else {
    // No signatures
    doc.setDrawColor(203, 213, 225);
    doc.line(35, sigY + 35, 85, sigY + 35);
    doc.line(pageWidth - 90, sigY + 35, pageWidth - 25, sigY + 35);
  }

  return doc;
};

export const exportTableToPDF = (incubeName, title, columns, data, signatureImage, filename) => {
  const doc = generatePDFDocument(incubeName, title, columns, data, signatureImage);
  doc.save(filename || 'export_incubateur.pdf');
};

export const getPDFBlobUrl = (incubeName, title, columns, data) => {
  const doc = generatePDFDocument(incubeName, title, columns, data, null);
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
};

// ==========================================
// 📜 HELPERS PROCÈS-VERBAL (PV)
// ==========================================

const getAccompagnateurName = (incube) => {
  if (incube?.accompagnateur && typeof incube.accompagnateur === 'string' && incube.accompagnateur.trim()) {
    return incube.accompagnateur.trim();
  }
  if (incube?.accompagnateurAdmin) {
    const { prenom, nom } = incube.accompagnateurAdmin;
    const full = `${prenom || ''} ${nom || ''}`.trim();
    if (full) return full;
  }
  return 'Accompagnateur référent — IDS Salé';
};

const formatDateFr = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString('fr-FR');
  } catch (e) {
    return String(dateStr);
  }
};

const drawPVSignatures = (doc, signatureImage, sigY, incubeName, accompagnateurName, pageWidth) => {
  const marginSide = 20;
  const colWidth = 65;
  const rightX = pageWidth - marginSide - colWidth;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);

  // Titres des cadres de signature
  doc.text("Pour l'Incubé (Porteur de projet)", marginSide, sigY);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(incubeName || '—', marginSide, sigY + 5);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Pour l'Accompagnateur / Référent", rightX, sigY);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(accompagnateurName || '—', rightX, sigY + 5);

  const boxY = sigY + 8;
  const boxH = 26;

  // Signature Incubé
  if (signatureImage && typeof signatureImage === 'object' && signatureImage.incube) {
    doc.addImage(signatureImage.incube, 'PNG', marginSide, boxY, colWidth, boxH);
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(16, 185, 129);
    doc.text("Signé électroniquement", marginSide, boxY + boxH + 4);
  } else if (signatureImage && typeof signatureImage === 'string') {
    doc.addImage(signatureImage, 'PNG', marginSide, boxY, colWidth, boxH);
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(16, 185, 129);
    doc.text("Signé électroniquement", marginSide, boxY + boxH + 4);
  } else {
    doc.setDrawColor(203, 213, 225);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(marginSide, boxY + boxH, marginSide + colWidth, boxY + boxH);
    doc.setLineDashPattern([], 0);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(148, 163, 184);
    doc.text("Émargement / Signature", marginSide, boxY + boxH + 4);
  }

  // Signature Accompagnateur
  if (signatureImage && typeof signatureImage === 'object' && signatureImage.accompagnateur) {
    doc.addImage(signatureImage.accompagnateur, 'PNG', rightX, boxY, colWidth, boxH);
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(16, 185, 129);
    doc.text("Signé électroniquement", rightX, boxY + boxH + 4);
  } else {
    doc.setDrawColor(203, 213, 225);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(rightX, boxY + boxH, rightX + colWidth, boxY + boxH);
    doc.setLineDashPattern([], 0);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(148, 163, 184);
    doc.text("Émargement / Signature", rightX, boxY + boxH + 4);
  }
};

// ==========================================
// 1️⃣ PROCÈS-VERBAL GLOBAL (RÉCAPITULATIF)
// ==========================================

export const generateGlobalPVDocument = (incube, rows = [], signatureImage = null) => {
  const doc = new jsPDF('landscape');
  const pageWidth = doc.internal.pageSize.width; // 297
  const pageHeight = doc.internal.pageSize.height; // 210
  const marginX = 14;
  const contentWidth = pageWidth - (marginX * 2); // 269

  const today = new Date().toLocaleDateString('fr-FR');
  const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const accompagnateurName = getAccompagnateurName(incube);
  const incubeName = incube?.nom_incube || 'Incubé';

  // Helper pour dessiner le titre officiel d'une section numérotée
  const drawSectionHeader = (title, yPos) => {
    doc.setFillColor(37, 99, 235); // Bleu primaire
    doc.roundedRect(marginX, yPos - 3.8, 3, 5, 0.8, 0.8, 'F');
    doc.setFontSize(10.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42); // Slate 900
    doc.text(title, marginX + 6, yPos);
  };

  // ==========================================
  // EN-TÊTE DU DOCUMENT
  // ==========================================
  const subtitle = `Fiche de Suivi d'accompagnement • Réf : FS-PV-${incube?.pp_numero || 'INC'} • Dossier : ${incubeName} • Édité le ${today} à ${time}`;
  drawOfficialHeader(doc, "FICHE DE SUIVI & PROCÈS-VERBAL", subtitle, true);

  // ==========================================
  // SECTION 1 : IDENTIFICATION DU DOSSIER
  // ==========================================
  drawSectionHeader("1. IDENTIFICATION DU DOSSIER", 34);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(marginX, 37, contentWidth, 18, 2, 2, 'FD');

  doc.setFontSize(8.5);
  // Colonne 1
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("• Porteur de projet :", marginX + 4, 44);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(incubeName, marginX + 38, 44);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("• Raison sociale :", marginX + 4, 50);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(incube?.raison_sociale || '—', marginX + 38, 50);

  // Colonne 2
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("• N° Dossier :", marginX + 96, 44);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(incube?.pp_numero || '—', marginX + 125, 44);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("• Phase actuelle :", marginX + 96, 50);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(incube?.phase_projet || '—', marginX + 125, 50);

  // Colonne 3
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("• Accompagnateur :", marginX + 185, 44);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(accompagnateurName, marginX + 220, 44);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("• Date du PV :", marginX + 185, 50);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(`${today} (${rows.length} séance(s))`, marginX + 220, 50);

  // ==========================================
  // SECTION 2 : HISTORIQUE & DÉROULEMENT DU SUIVI TECHNIQUE
  // ==========================================
  drawSectionHeader("2. HISTORIQUE & DÉROULEMENT DU SUIVI TECHNIQUE", 62);

  const columns = [
    { header: 'Séance', dataKey: 'numero_ordre' },
    { header: 'Date', dataKey: 'date_suivi' },
    { header: 'Objet de la réunion', dataKey: 'objet_reunion' },
    { header: 'Changement Juridique', dataKey: 'statut_juridique' },
    { header: 'Changement Avancement', dataKey: 'statut_avancement' },
    { header: 'Observations & Décisions', dataKey: 'observations' },
    { header: 'RDV', dataKey: 'statut' }
  ];

  const tableData = rows.length === 0 ? [
    ['—', '—', '—', '—', '—', 'Aucune séance de suivi enregistrée à ce jour.', '—']
  ] : rows.map((r, i) => [
    r.numero_ordre ? `N° ${r.numero_ordre}` : `N° ${i + 1}`,
    formatDateFr(r.date_suivi),
    r.objet_reunion?.trim() || 'Séance de suivi',
    r.statut_juridique || '—',
    r.statut_avancement || '—',
    r.observations?.trim() || 'Conforme',
    r.rendezvous_id ? 'Effectué' : 'Direct'
  ]);

  autoTable(doc, {
    startY: 67,
    head: [columns.map(c => c.header)],
    body: tableData,
    styles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: [51, 65, 85],
      valign: 'middle'
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.2,
      cellPadding: 4
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: {
      0: { cellWidth: 16, halign: 'center' },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 38 },
      3: { cellWidth: 28 },
      4: { cellWidth: 28 },
      5: { cellWidth: 'auto' },
      6: { cellWidth: 18, halign: 'center', fontStyle: 'bold' }
    },
    margin: { top: 66, left: marginX, right: marginX, bottom: 40 }
  });

  let currentY = doc.lastAutoTable.finalY || 66;

  // ==========================================
  // SECTION 3 : RESSOURCES HUMAINES & ÉQUIPE DU PROJET
  // ==========================================
  if (currentY + 50 > pageHeight) {
    doc.addPage();
    currentY = 16;
  } else {
    currentY += 8;
  }

  drawSectionHeader("3. RESSOURCES HUMAINES & ÉQUIPE DU PROJET", currentY);

  const rawPersonnel = Array.isArray(incube?.personnel) ? incube.personnel : [];
  const rhCols = [
    { header: 'N°', dataKey: 'num' },
    { header: 'Nom complet du collaborateur', dataKey: 'nom' },
    { header: 'Poste / Fonction', dataKey: 'poste' },
    { header: 'Nature du contrat', dataKey: 'contrat' },
    { header: 'Catégorie', dataKey: 'cat' },
    { header: 'Date embauche', dataKey: 'debut' },
    { header: 'Date fin', dataKey: 'fin' },
    { header: 'Rémunération (MAD)', dataKey: 'salaire' }
  ];

  const rhData = rawPersonnel.length === 0
    ? [['—', 'Aucun personnel salarié ou stagiaire déclaré à ce jour (équipe restreinte au porteur de projet).', '—', '—', '—', '—', '—', '—']]
    : rawPersonnel.map((r, idx) => [
        String(idx + 1),
        r.nom_complet || '—',
        r.poste || 'Salarié',
        r.nature_contrat || 'CDI',
        r.type_personnel || (r.nature_contrat === 'CDI' ? 'Personnel permanent' : 'Personnel temporaire'),
        formatDateFr(r.date_embauche),
        r.date_fin ? formatDateFr(r.date_fin) : '—',
        r.salaire_mensuel && Number(r.salaire_mensuel) > 0 ? `${Number(r.salaire_mensuel).toLocaleString('fr-FR')} MAD` : '—'
      ]);

  autoTable(doc, {
    startY: currentY + 3.5,
    head: [rhCols.map(c => c.header)],
    body: rhData,
    styles: { fontSize: 7.5, cellPadding: 2.5, textColor: [51, 65, 85], valign: 'middle' },
    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.8, cellPadding: 3 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 62 },
      2: { cellWidth: 46 },
      3: { cellWidth: 28, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 38, halign: 'center' },
      5: { cellWidth: 28, halign: 'center' },
      6: { cellWidth: 26, halign: 'center' },
      7: { cellWidth: 'auto', halign: 'right' }
    },
    margin: { left: marginX, right: marginX }
  });

  currentY = doc.lastAutoTable.finalY || currentY + 20;

  // ==========================================
  // SECTION 4 : CONSTATATIONS, ANOMALIES & RECOMMANDATIONS
  // ==========================================
  if (currentY + 50 > pageHeight) {
    doc.addPage();
    currentY = 16;
  } else {
    currentY += 8;
  }

  drawSectionHeader("4. CONSTATATIONS, ANOMALIES & RECOMMANDATIONS", currentY);

  const cardY = currentY + 4;
  const cardWidth = (contentWidth - 14) / 3; // ~85mm par carte
  const cardHeight = 25;

  // Calcul des données de synthèse
  const anomaliesList = rows
    .map(r => r.anomalie_signalee?.trim())
    .filter(Boolean);
  const anomalyText = anomaliesList.length > 0 
    ? anomaliesList.slice(-2).join(' ; ') 
    : "Aucune anomalie ou blocage particulier signalé durant le suivi.";

  const obsList = rows
    .map(r => r.observations?.trim())
    .filter(Boolean);
  const recommendationText = obsList.length > 0 
    ? obsList[obsList.length - 1] 
    : "Poursuite du déploiement du plan d'action selon les jalons arrêtés avec l'accompagnateur.";

  const hasEchec = rows.some(r => r.declaration_echec === 'Oui');
  const decisionText = hasEchec 
    ? "Point d'attention requis : Réexamen de la feuille de route recommandé par le comité." 
    : `Avis Favorable : Progression conforme en phase ${incube?.phase_projet || 'actuelle'}. Maintien du parcours.`;

  // Carte 3.1 : Anomalies & Points bloquants
  doc.setFillColor(anomaliesList.length > 0 ? 255 : 248, anomaliesList.length > 0 ? 241 : 250, anomaliesList.length > 0 ? 242 : 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(marginX, cardY, cardWidth, cardHeight, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(anomaliesList.length > 0 ? 190 : 71, anomaliesList.length > 0 ? 18 : 85, anomaliesList.length > 0 ? 60 : 105);
  doc.text("• Anomalies & Points bloquants", marginX + 4, cardY + 6);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 65, 85);
  const anomLines = doc.splitTextToSize(anomalyText, cardWidth - 8);
  doc.text(anomLines.slice(0, 3), marginX + 4, cardY + 12);

  // Carte 3.2 : Recommandations & Engagements
  const card2X = marginX + cardWidth + 7;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(card2X, cardY, cardWidth, cardHeight, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("• Recommandations & Engagements", card2X + 4, cardY + 6);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 65, 85);
  const recLines = doc.splitTextToSize(recommendationText, cardWidth - 8);
  doc.text(recLines.slice(0, 3), card2X + 4, cardY + 12);

  // Carte 3.3 : Décision / Avis d'étape
  const card3X = card2X + cardWidth + 7;
  doc.setFillColor(hasEchec ? 255 : 240, hasEchec ? 241 : 253, hasEchec ? 242 : 244);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(card3X, cardY, cardWidth, cardHeight, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(hasEchec ? 190 : 22, hasEchec ? 18 : 101, hasEchec ? 60 : 52);
  doc.text("• Décision & Avis d'étape", card3X + 4, cardY + 6);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 65, 85);
  const decLines = doc.splitTextToSize(decisionText, cardWidth - 8);
  doc.text(decLines.slice(0, 3), card3X + 4, cardY + 12);

  currentY = cardY + cardHeight + 8;

  // ==========================================
  // SECTION 5 : VALIDATION ET ÉMARGEMENT (AU PIED DE PAGE)
  // ==========================================
  if (currentY > pageHeight - 65) {
    doc.addPage();
  }

  // Fixation de la signature au pied de la dernière page (même si la page est presque vide)
  const sigY = pageHeight - 50;
  drawSectionHeader("5. VALIDATION ET ÉMARGEMENT", sigY - 12);

  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100, 116, 139);
  doc.text(
    "Les parties soussignées attestent de la conformité du présent procès-verbal et de l'exactitude des éléments mentionnés.",
    marginX + 6,
    sigY - 6
  );

  drawPVSignatures(doc, signatureImage, sigY, incubeName, accompagnateurName, pageWidth);

  // Numérotation des pages en pied de page
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${i} sur ${totalPages} • Document officiel Incubateur Digital Solidaire (IDS) • Émargement numérique certifié`,
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    );
  }

  return doc;
};

export const exportGlobalPVToPDF = (incube, rows, signatureImage, filename) => {
  const doc = generateGlobalPVDocument(incube, rows, signatureImage);
  doc.save(filename || `Fiche_Technique_${Date.now()}.pdf`);
};

export const getGlobalPVBlobUrl = (incube, rows) => {
  const doc = generateGlobalPVDocument(incube, rows, null);
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
};

// ==========================================
// 2️⃣ PROCÈS-VERBAL DE SÉANCE INDIVIDUELLE (FICHE TECHNIQUE DE SÉANCE)
// ==========================================

export const generateSeancePVDocument = (incube, row = {}, signatureImage = null) => {
  const doc = new jsPDF('portrait');
  const pageWidth = doc.internal.pageSize.width; // 210
  const pageHeight = doc.internal.pageSize.height; // 297

  const today = new Date().toLocaleDateString('fr-FR');
  const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const accompagnateurName = getAccompagnateurName(incube);
  const incubeName = incube?.nom_incube || 'Incubé';
  const numOrdre = row.numero_ordre || '1';

  // 1. En-tête
  const subtitle = `Séance N°${numOrdre} • Réf. FS-S${numOrdre}-${incube?.pp_numero || 'INC'} • Date : ${formatDateFr(row.date_suivi)} • Édité le ${today} à ${time}`;
  drawOfficialHeader(doc, "FICHE DE SUIVI & PV DE SÉANCE", subtitle, false);

  // 2. Fiche d'identification du projet
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(16, 31, pageWidth - 32, 26, 2, 2, 'FD');

  doc.setFontSize(8.5);
  // Col 1
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Porteur de projet :", 20, 38);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(incubeName, 52, 38);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Raison Sociale :", 20, 44);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(incube?.raison_sociale || '—', 52, 44);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("N° de Dossier :", 20, 50);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(incube?.pp_numero || '—', 52, 50);

  // Col 2
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Phase du projet :", 112, 38);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(incube?.phase_projet || '—', 142, 38);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Accompagnateur :", 112, 44);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(accompagnateurName, 142, 44);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Secteur d'activité :", 112, 50);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(incube?.secteur_activite || '—', 142, 50);

  // 3. Section 1 : Objet & Évolutions
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("1. Objet de la Réunion & Évolutions constatées", 16, 63);

  // Bannière Objet de la réunion
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(16, 66, pageWidth - 32, 11, 2, 2, 'FD');
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Objet de la réunion :", 20, 73);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(37, 99, 235);
  doc.text(row.objet_reunion || 'Séance de suivi périodique', 56, 73);

  // Deux cartes : Changement juridique & Changement d'avancement
  const cardW = (pageWidth - 32 - 8) / 2;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(16, 80, cardW, 19, 2, 2, 'FD');
  doc.roundedRect(16 + cardW + 8, 80, cardW, 19, 2, 2, 'FD');

  doc.setFontSize(8.5);
  // Carte gauche
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Changement Juridique :", 20, 87);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(37, 99, 235);
  doc.text(row.statut_juridique || 'Non renseigné', 20, 94);

  // Carte droite
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Changement de l'état d'avancement :", 16 + cardW + 12, 87);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(row.statut_avancement || 'Idéation', 16 + cardW + 12, 94);

  // 4. Section 2 : Observations de l'accompagnateur et recommandations
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("2. Observations de l'accompagnateur et recommandations", 16, 107);

  const obsText = row.observations?.trim() || "Séance de suivi conforme aux jalons fixés. Le porteur poursuit l'exécution de sa feuille de route.";
  const obsLines = doc.splitTextToSize(obsText, pageWidth - 42);
  const obsHeight = Math.max(38, obsLines.length * 4.8 + 12);

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(16, 111, pageWidth - 32, obsHeight, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 65, 85);
  doc.text(obsLines, 21, 119);

  // 5. Section 3 : Attestation & Signatures (fixées au pied de la dernière page)
  const contentEndY = 111 + obsHeight;
  if (contentEndY > pageHeight - 65) {
    doc.addPage();
  }

  // Fixation de la signature au pied de page (même si la page est presque vide)
  const sigY = pageHeight - 50;
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100, 116, 139);
  const attestation = "Attestation : Les parties soussignées certifient l'exactitude des informations mentionnées ci-dessus et conviennent de poursuivre le plan d'action convenu.";
  const attLines = doc.splitTextToSize(attestation, pageWidth - 32);
  doc.text(attLines, 16, sigY - 8);

  drawPVSignatures(doc, signatureImage, sigY, incubeName, accompagnateurName, pageWidth);

  // 8. Footer
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text(`Document officiel édité le ${today} à ${time} • Incubateur Digital Solidaire (IDS)`, pageWidth / 2, pageHeight - 8, { align: 'center' });

  return doc;
};

export const exportSeancePVToPDF = (incube, row, signatureImage, filename) => {
  const doc = generateSeancePVDocument(incube, row, signatureImage);
  doc.save(filename || `Fiche_Technique_Seance_${Date.now()}.pdf`);
};

export const getSeancePVBlobUrl = (incube, row) => {
  const doc = generateSeancePVDocument(incube, row, null);
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
};

// ==========================================
// 3️⃣ PROCÈS-VERBAL TRIMESTRIEL CONSOLIDÉ (3 MOIS)
// ==========================================

const MOIS_NOMS_FR = [
  '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export const generateQuarterlyPVDocument = (incube, options = {}, signatureImage = null) => {
  const doc = new jsPDF('landscape');
  const pageWidth = doc.internal.pageSize.width; // 297mm
  const pageHeight = doc.internal.pageSize.height; // 210mm
  const marginX = 14;
  const contentWidth = pageWidth - (marginX * 2); // 269mm

  const today = new Date().toLocaleDateString('fr-FR');
  const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const accompagnateurName = getAccompagnateurName(incube);
  const incubeName = incube?.nom_incube || 'Incubé';

  // Paramètres du trimestre
  const selectedYear = parseInt(options.year || new Date().getFullYear(), 10);
  const quarterNum = parseInt(options.quarter || Math.ceil((new Date().getMonth() + 1) / 3), 10);

  // Mois correspondants au trimestre
  const QUARTER_MONTHS = {
    1: [1, 2, 3],
    2: [4, 5, 6],
    3: [7, 8, 9],
    4: [10, 11, 12]
  };
  const targetMonths = QUARTER_MONTHS[quarterNum] || [1, 2, 3];
  const quarterLabel = `Trimestre T${quarterNum} (${MOIS_NOMS_FR[targetMonths[0]]} - ${MOIS_NOMS_FR[targetMonths[2]]})`;

  // Formatage monétaire
  const fmtMAD = (v) => {
    const num = Number(v) || 0;
    return `${num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;
  };

  // Helper pour dessiner le titre officiel d'une section
  const drawSectionHeader = (title, yPos) => {
    doc.setFillColor(37, 99, 235); // Bleu primaire
    doc.roundedRect(marginX, yPos - 3.8, 3, 5, 0.8, 0.8, 'F');
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(title, marginX + 6, yPos);
  };

  // ==========================================
  // EN-TÊTE DU DOCUMENT
  // ==========================================
  const subtitle = `Réf : PV-TRI-T${quarterNum}-${selectedYear}-${incube?.pp_numero || 'INC'} • Dossier : ${incubeName} • Période : ${quarterLabel} ${selectedYear} • Édité le ${today} à ${time}`;
  drawOfficialHeader(doc, "PROCÈS-VERBAL D'ÉVALUATION TRIMESTRIELLE (PV 3 MOIS)", subtitle, true);

  // ==========================================
  // CARTOUCHE D'IDENTIFICATION
  // ==========================================
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(marginX, 32, contentWidth, 18, 2, 2, 'FD');

  doc.setFontSize(8);
  // Col 1
  doc.setFont("helvetica", "bold"); doc.setTextColor(71, 85, 105);
  doc.text("• Porteur de projet :", marginX + 4, 38);
  doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
  doc.text(incubeName, marginX + 38, 38);

  doc.setFont("helvetica", "bold"); doc.setTextColor(71, 85, 105);
  doc.text("• Raison sociale :", marginX + 4, 45);
  doc.setFont("helvetica", "normal"); doc.setTextColor(15, 23, 42);
  doc.text(incube?.raison_sociale || '—', marginX + 38, 45);

  // Col 2
  doc.setFont("helvetica", "bold"); doc.setTextColor(71, 85, 105);
  doc.text("• N° Dossier :", marginX + 96, 38);
  doc.setFont("helvetica", "normal"); doc.setTextColor(15, 23, 42);
  doc.text(incube?.pp_numero || '—', marginX + 125, 38);

  doc.setFont("helvetica", "bold"); doc.setTextColor(71, 85, 105);
  doc.text("• Phase actuelle :", marginX + 96, 45);
  doc.setFont("helvetica", "normal"); doc.setTextColor(15, 23, 42);
  doc.text(incube?.phase_projet || '—', marginX + 125, 45);

  // Col 3
  doc.setFont("helvetica", "bold"); doc.setTextColor(71, 85, 105);
  doc.text("• Accompagnateur :", marginX + 185, 38);
  doc.setFont("helvetica", "normal"); doc.setTextColor(15, 23, 42);
  doc.text(accompagnateurName, marginX + 220, 38);

  doc.setFont("helvetica", "bold"); doc.setTextColor(71, 85, 105);
  doc.text("• Trimestre visé :", marginX + 185, 45);
  doc.setFont("helvetica", "bold"); doc.setTextColor(37, 99, 235);
  doc.text(`T${quarterNum} ${selectedYear} (${MOIS_NOMS_FR[targetMonths[0]].slice(0,3)} - ${MOIS_NOMS_FR[targetMonths[2]].slice(0,3)})`, marginX + 220, 45);

  let currentY = 56;

  // ==========================================
  // 1. SÉANCES DE SUIVI DU TRIMESTRE
  // ==========================================
  drawSectionHeader(`1. SÉANCES DE SUIVI DU TRIMESTRE (${quarterLabel})`, currentY);

  const rawSuivis = Array.isArray(incube?.fiches_suivi) ? incube.fiches_suivi : (options.fiches || []);
  const suivisTrimestre = rawSuivis.filter(s => {
    if (!s.date_suivi) return false;
    const d = new Date(s.date_suivi);
    if (isNaN(d.getTime())) return false;
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    return y === selectedYear && targetMonths.includes(m);
  });

  const suiviColumns = [
    { header: 'N°', dataKey: 'num' },
    { header: 'Date', dataKey: 'date' },
    { header: 'Objet de la réunion', dataKey: 'objet' },
    { header: 'Statut Juridique', dataKey: 'juridique' },
    { header: 'Phase', dataKey: 'phase' },
    { header: 'Observations & Décisions arrêtées', dataKey: 'obs' }
  ];

  const suiviData = suivisTrimestre.length === 0
    ? [['—', '—', 'Aucune séance de suivi enregistrée pour ce trimestre.', '—', '—', '—']]
    : suivisTrimestre.map((s, idx) => [
        s.numero_ordre ? `N° ${s.numero_ordre}` : `S${idx + 1}`,
        formatDateFr(s.date_suivi),
        s.objet_reunion || 'Séance de suivi périodique',
        s.statut_juridique || '—',
        s.statut_avancement || '—',
        s.observations?.trim() || 'Conforme aux objectifs fixés.'
      ]);

  autoTable(doc, {
    startY: currentY + 3.5,
    head: [suiviColumns.map(c => c.header)],
    body: suiviData,
    styles: { fontSize: 7.5, cellPadding: 2.5, textColor: [51, 65, 85], valign: 'middle' },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.8, cellPadding: 3 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center' },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 48 },
      3: { cellWidth: 32 },
      4: { cellWidth: 26 },
      5: { cellWidth: 'auto' }
    },
    margin: { left: marginX, right: marginX }
  });

  currentY = doc.lastAutoTable.finalY + 7;

  // ==========================================
  // 2. AVANCEMENT DU PLAN D'ACTION DU TRIMESTRE
  // ==========================================
  if (currentY + 38 > pageHeight) {
    doc.addPage();
    currentY = 16;
  }

  drawSectionHeader("2. AVANCEMENT DU PLAN D'ACTION (OBJECTIFS DU TRIMESTRE)", currentY);

  const rawPlans = Array.isArray(incube?.plans) ? incube.plans : (options.plans || []);
  // Filtrer les plans correspondants au trimestre ou affichés
  const plansTrimestre = rawPlans.filter(p => {
    if (p.echeance) {
      const d = new Date(p.echeance);
      if (!isNaN(d.getTime())) {
        return d.getFullYear() === selectedYear && targetMonths.includes(d.getMonth() + 1);
      }
    }
    // Si pas de date échéance stricte, inclure si mois texte correspond
    if (p.mois) {
      const pMoisLower = String(p.mois).toLowerCase();
      return targetMonths.some(m => pMoisLower.includes(MOIS_NOMS_FR[m].toLowerCase()));
    }
    return true; // Par défaut garder les plans actifs s'ils ne sont pas datés
  });

  const planColumns = [
    { header: 'N°', dataKey: 'num' },
    { header: 'Objectif / Action stratégique', dataKey: 'obj' },
    { header: 'Échéance', dataKey: 'ech' },
    { header: 'Statut / Réalisation', dataKey: 'statut' },
    { header: 'Difficultés / Commentaires', dataKey: 'com' }
  ];

  const planData = plansTrimestre.length === 0
    ? [['—', 'Aucune action formalisée pour cette période.', '—', '—', '—']]
    : plansTrimestre.map((p, idx) => [
        `A${idx + 1}`,
        p.objectifs || 'Action sans intitulé',
        formatDateFr(p.echeance || p.date_debut),
        p.realisation || 'En cours',
        [p.problemes_rencontres, p.commentaires].filter(Boolean).join(' • ') || 'RAS'
      ]);

  autoTable(doc, {
    startY: currentY + 3.5,
    head: [planColumns.map(c => c.header)],
    body: planData,
    styles: { fontSize: 7.5, cellPadding: 2.5, textColor: [51, 65, 85], valign: 'middle' },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.8, cellPadding: 3 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center' },
      1: { cellWidth: 70 },
      2: { cellWidth: 26, halign: 'center' },
      3: { cellWidth: 32, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 'auto' }
    },
    margin: { left: marginX, right: marginX }
  });

  currentY = doc.lastAutoTable.finalY + 7;

  // ==========================================
  // 3. SYNTHÈSE DE L'ANALYSE FINANCIÈRE
  // ==========================================
  if (currentY + 45 > pageHeight) {
    doc.addPage();
    currentY = 16;
  }

  drawSectionHeader(`3. SYNTHÈSE DE L'ANALYSE FINANCIÈRE (${quarterLabel} ${selectedYear})`, currentY);

  const rawFinances = Array.isArray(incube?.finances) ? incube.finances : (options.finances || []);
  const financesTrimestre = rawFinances.filter(f => {
    return parseInt(f.annee, 10) === selectedYear && targetMonths.includes(parseInt(f.mois, 10));
  });

  // Calculs mensuels
  let sumVentes = 0;
  let sumCharges = 0;
  let sumResultat = 0;

  const financeRows = targetMonths.map(m => {
    const record = financesTrimestre.find(f => parseInt(f.mois, 10) === m) || {};
    const v = Number(record.ventes) || 0;
    
    // Somme des charges
    const fixedCharges = [
      'achats', 'charges_personnel', 'charges_cnss', 'salaire_porteur',
      'loyer_coworking', 'eau_electricite', 'transport', 'telephone',
      'taxes', 'tva', 'remboursement_credit', 'autres_charges'
    ];
    let ch = 0;
    fixedCharges.forEach(k => { ch += Number(record[k]) || 0; });

    // Charges personnalisées stockées dans details_autres_charges
    if (record.details_autres_charges) {
      try {
        const details = typeof record.details_autres_charges === 'string'
          ? JSON.parse(record.details_autres_charges)
          : record.details_autres_charges;
        if (Array.isArray(details)) {
          details.forEach(it => { ch += Number(it.montant) || 0; });
        }
      } catch (_) {}
    }

    const res = v - ch;
    sumVentes += v;
    sumCharges += ch;
    sumResultat += res;

    return [
      MOIS_NOMS_FR[m],
      fmtMAD(v),
      fmtMAD(ch),
      fmtMAD(res),
      res >= 0 ? 'Excédentaire' : 'Déficitaire'
    ];
  });

  // Ligne de totalisation du trimestre
  financeRows.push([
    `TOTAL ${quarterLabel}`,
    fmtMAD(sumVentes),
    fmtMAD(sumCharges),
    fmtMAD(sumResultat),
    sumResultat >= 0 ? 'Bilan Positif' : 'Bilan Négatif'
  ]);

  const financeCols = [
    { header: 'Mois', dataKey: 'mois' },
    { header: 'Chiffre d\'Affaires / Ventes', dataKey: 'ventes' },
    { header: 'Total Charges d\'Exploitation', dataKey: 'charges' },
    { header: 'Résultat Net / Marge', dataKey: 'resultat' },
    { header: 'Situation', dataKey: 'statut' }
  ];

  autoTable(doc, {
    startY: currentY + 3.5,
    head: [financeCols.map(c => c.header)],
    body: financeRows,
    styles: { fontSize: 7.5, cellPadding: 2.5, textColor: [51, 65, 85], valign: 'middle' },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.8, cellPadding: 3 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold' },
      1: { cellWidth: 55, halign: 'right' },
      2: { cellWidth: 55, halign: 'right' },
      3: { cellWidth: 55, halign: 'right', fontStyle: 'bold' },
      4: { cellWidth: 'auto', halign: 'center', fontStyle: 'bold' }
    },
    didParseCell: (data) => {
      // Mettre en gras et colorer la ligne TOTAL
      if (data.row.index === financeRows.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [224, 231, 255]; // Indigo léger
        data.cell.styles.textColor = [30, 27, 75];
      }
    },
    margin: { left: marginX, right: marginX }
  });

  currentY = doc.lastAutoTable.finalY + 7;

  // ==========================================
  // 4. MATÉRIEL & ÉQUIPEMENTS AFFECTÉS
  // ==========================================
  if (currentY + 40 > pageHeight) {
    doc.addPage();
    currentY = 16;
  }

  drawSectionHeader("4. PARC MATÉRIEL & ÉQUIPEMENTS AFFECTÉS", currentY);

  const rawMateriels = Array.isArray(incube?.materiels) ? incube.materiels : (options.materiels || []);
  const materielCols = [
    { header: 'N°', dataKey: 'num' },
    { header: 'Désignation de l\'article', dataKey: 'art' },
    { header: 'N° Série / Réf', dataKey: 'serie' },
    { header: 'Date affectation', dataKey: 'date' },
    { header: 'Quantité', dataKey: 'qte' },
    { header: 'Origine', dataKey: 'org' },
    { header: 'État / Conformité', dataKey: 'etat' }
  ];

  const materielData = rawMateriels.length === 0
    ? [['—', 'Aucun matériel inventorié sous gestion directe.', '—', '—', '—', '—', '—']]
    : rawMateriels.map((m, idx) => [
        `M${idx + 1}`,
        m.article || 'Matériel',
        m.numero_serie || '—',
        formatDateFr(m.date_acquisition_reception),
        String(m.quantite || 1),
        m.type_origine === 'ids' ? 'Dotation IDS' : 'Propre',
        m.etat || 'Opérationnel'
      ]);

  autoTable(doc, {
    startY: currentY + 3.5,
    head: [materielCols.map(c => c.header)],
    body: materielData,
    styles: { fontSize: 7.5, cellPadding: 2.5, textColor: [51, 65, 85], valign: 'middle' },
    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.8, cellPadding: 3 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 70 },
      2: { cellWidth: 38 },
      3: { cellWidth: 26, halign: 'center' },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 26, halign: 'center' },
      6: { cellWidth: 'auto', halign: 'center', fontStyle: 'bold' }
    },
    margin: { left: marginX, right: marginX }
  });

  currentY = doc.lastAutoTable.finalY + 7;

  // ==========================================
  // 5. RESSOURCES HUMAINES & CRÉATION D'EMPLOIS
  // ==========================================
  if (currentY + 45 > pageHeight) {
    doc.addPage();
    currentY = 16;
  }

  drawSectionHeader("5. RESSOURCES HUMAINES & CRÉATION D'EMPLOIS", currentY);

  const rawPersonnel = Array.isArray(incube?.personnel) ? incube.personnel : (options.personnel || []);
  const rhCols = [
    { header: 'N°', dataKey: 'num' },
    { header: 'Nom complet du collaborateur', dataKey: 'nom' },
    { header: 'Poste / Fonction', dataKey: 'poste' },
    { header: 'Nature du contrat', dataKey: 'contrat' },
    { header: 'Catégorie', dataKey: 'cat' },
    { header: 'Date embauche', dataKey: 'debut' },
    { header: 'Date fin', dataKey: 'fin' },
    { header: 'Rémunération (MAD)', dataKey: 'salaire' }
  ];

  const rhData = rawPersonnel.length === 0
    ? [['—', 'Aucun personnel salarié ou stagiaire déclaré à ce jour pour ce trimestre.', '—', '—', '—', '—', '—', '—']]
    : rawPersonnel.map((r, idx) => [
        String(idx + 1),
        r.nom_complet || '—',
        r.poste || 'Salarié',
        r.nature_contrat || 'CDI',
        r.type_personnel || (r.nature_contrat === 'CDI' ? 'Personnel permanent' : 'Personnel temporaire'),
        formatDateFr(r.date_embauche),
        r.date_fin ? formatDateFr(r.date_fin) : '—',
        r.salaire_mensuel && Number(r.salaire_mensuel) > 0 ? `${Number(r.salaire_mensuel).toLocaleString('fr-FR')} MAD` : '—'
      ]);

  autoTable(doc, {
    startY: currentY + 3.5,
    head: [rhCols.map(c => c.header)],
    body: rhData,
    styles: { fontSize: 7.5, cellPadding: 2.5, textColor: [51, 65, 85], valign: 'middle' },
    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.8, cellPadding: 3 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 62 },
      2: { cellWidth: 46 },
      3: { cellWidth: 28, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 38, halign: 'center' },
      5: { cellWidth: 28, halign: 'center' },
      6: { cellWidth: 26, halign: 'center' },
      7: { cellWidth: 'auto', halign: 'right' }
    },
    margin: { left: marginX, right: marginX }
  });

  currentY = doc.lastAutoTable.finalY + 7;

  // ==========================================
  // 6. SYNTHÈSE, RECOMMANDATIONS & DÉCISION
  // ==========================================
  if (currentY + 45 > pageHeight) {
    doc.addPage();
    currentY = 16;
  }

  drawSectionHeader("6. AVIS DE L'ACCOMPAGNATEUR & RECOMMANDATIONS POUR LE TRIMESTRE SUIVANT", currentY);

  const cardY = currentY + 3.5;
  const cardWidth = (contentWidth - 14) / 3;
  const cardHeight = 22;

  // 5.1 Progression
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(marginX, cardY, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 41, 59);
  doc.text("• Progression & Jalons", marginX + 3.5, cardY + 5.5);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(71, 85, 105);
  const progText = options.progression || `Progression régulière au cours du T${quarterNum}. ${suivisTrimestre.length} séance(s) de cadrage réalisée(s).`;
  const progLines = doc.splitTextToSize(progText, cardWidth - 7);
  doc.text(progLines.slice(0, 3), marginX + 3.5, cardY + 11);

  // 5.2 Points de vigilance
  const card2X = marginX + cardWidth + 7;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(card2X, cardY, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(180, 83, 9);
  doc.text("• Points de vigilance & Actions", card2X + 3.5, cardY + 5.5);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(71, 85, 105);
  const vigText = options.vigilance || (sumResultat < 0 ? "Surveillance de la trésorerie et optimisation des charges requises." : "Poursuite de la prospection commerciale et consolidation du plan d'action.");
  const vigLines = doc.splitTextToSize(vigText, cardWidth - 7);
  doc.text(vigLines.slice(0, 3), card2X + 3.5, cardY + 11);

  // 5.3 Décision / Validation
  const card3X = card2X + cardWidth + 7;
  doc.setFillColor(240, 253, 244);
  doc.roundedRect(card3X, cardY, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(22, 101, 52);
  doc.text("• Décision du Comité", card3X + 3.5, cardY + 5.5);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(71, 85, 105);
  const decText = options.decision || `Avis Favorable : Validation de l'étape T${quarterNum}. Maintien du parcours d'incubation IDS.`;
  const decLines = doc.splitTextToSize(decText, cardWidth - 7);
  doc.text(decLines.slice(0, 3), card3X + 3.5, cardY + 11);

  currentY = cardY + cardHeight + 7;

  // ==========================================
  // 7. VALIDATION ET ÉMARGEMENT (AU PIED DE PAGE)
  // ==========================================
  if (currentY > pageHeight - 65) {
    doc.addPage();
  }

  // Fixation de la signature au pied de la dernière page (même si la page est presque vide)
  const sigY = pageHeight - 50;
  drawSectionHeader("7. ÉMARGEMENT & DOUBLE SIGNATURE OFFICIELLE", sigY - 12);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Le présent procès-verbal trimestriel arrête l'état d'avancement du projet à l'issue du trimestre T${quarterNum} (${selectedYear}). Les soussignés en certifient la conformité.`,
    marginX + 6,
    sigY - 6
  );

  drawPVSignatures(doc, signatureImage, sigY, incubeName, accompagnateurName, pageWidth);

  // Numérotation finale de toutes les pages
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${i} sur ${totalPages} • Document officiel Incubateur Digital Solidaire (IDS) • Procès-Verbal Trimestriel T${quarterNum} ${selectedYear}`,
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    );
  }

  return doc;
};

export const exportQuarterlyPVToPDF = (incube, options, signatureImage, filename) => {
  const doc = generateQuarterlyPVDocument(incube, options, signatureImage);
  const q = options?.quarter || 1;
  const y = options?.year || new Date().getFullYear();
  doc.save(filename || `PV_Trimestriel_T${q}_${y}_${incube?.nom_incube || 'Incube'}.pdf`);
};

export const getQuarterlyPVBlobUrl = (incube, options) => {
  const doc = generateQuarterlyPVDocument(incube, options, null);
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
};

// ==========================================
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
      if (years >= 0) return `${years} an${years > 1 ? 's' : ''}`;
    }
  }
  if (!ageStr) return '—';
  const match = String(ageStr).match(/^(\d+\s*ans?)/i);
  if (match) return match[1];
  if (/^\d+$/.test(String(ageStr).trim())) {
    const num = parseInt(ageStr, 10);
    return `${num} an${num > 1 ? 's' : ''}`;
  }
  return String(ageStr);
};

export const generateFicheSignaletiqueDocument = async (incube) => {
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

  // Nom de l'accompagnateur sans titre (pas de Mme, M., Mr, etc.)
  const rawAccomp = incube?.accompagnateur || '';
  const cleanAccomp = rawAccomp.replace(/^(M\.|Mme|Mlle|Mr|Ms|Dr|Pr)\s+/i, '').trim();
  const displayAccomp = formatOfficialName(cleanAccomp) || 'Conseiller IDS';

  // Promotion formatée proprement : "Promotion 1", "Promotion 2", etc. (sans mention S1 ni S2)
  const formatPromotionClean = (p) => {
    if (!p) return 'Promotion 1';
    let clean = String(p).trim();
    clean = clean.replace(/[-–—]?\s*S\d+/gi, '').trim();
    if (/^\d+$/.test(clean)) return `Promotion ${clean}`;
    if (!/^promotion/i.test(clean)) return `Promotion ${clean}`;
    return clean;
  };
  const displayPromo = formatPromotionClean(incube?.promotion);

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
  //    Cartouche sur toute la largeur (269 mm), QR codes avec icônes (sans texte)
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

  // Phase / Promotion / Accompagnateur (sans Mme/M., et promotion propre sans S1)
  curY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  const phaseStr = incube?.phase_projet || 'Lancement';
  doc.text(`Phase : ${phaseStr}   •   ${displayPromo}   •   Accompagnement : ${displayAccomp}`, textX, curY);

  // QR Codes à droite du cartouche pleine largeur
  const qrSize = 19;
  const qrGap = 8;
  const qrWebX = marginX + cartoucheW - qrSize - 6;
  const qrLinkedInX = qrWebX - qrSize - qrGap;
  const qrY = cartoucheY + 3.5;

  // Séparateur vertical fin avant les QR codes
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.35);
  doc.line(qrLinkedInX - 7, cartoucheY + 4, qrLinkedInX - 7, cartoucheY + cartoucheH - 4);

  const linkedinUrl = incube?.linkedin && String(incube.linkedin).trim() !== ''
    ? incube.linkedin
    : `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(incube?.nom_incube || 'IDS')}`;
  const siteWebUrl = incube?.site_web && String(incube.site_web).trim() !== ''
    ? incube.site_web
    : 'https://ids.org.ma';

  try {
    const qrLinkedInUrl = await QRCode.toDataURL(linkedinUrl, { errorCorrectionLevel: 'H', margin: 1, width: 220 });
    const qrWebUrl = await QRCode.toDataURL(siteWebUrl, { errorCorrectionLevel: 'H', margin: 1, width: 220 });

    // Fond blanc pour contraste et scannabilité parfaite
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(qrLinkedInX, qrY, qrSize, qrSize, 1.5, 1.5, 'FD');
    doc.roundedRect(qrWebX, qrY, qrSize, qrSize, 1.5, 1.5, 'FD');

    doc.addImage(qrLinkedInUrl, 'PNG', qrLinkedInX + 0.5, qrY + 0.5, qrSize - 1, qrSize - 1);
    doc.addImage(qrWebUrl, 'PNG', qrWebX + 0.5, qrY + 0.5, qrSize - 1, qrSize - 1);

    // --- ICÔNES ÉLÉGANTES SOUS LES QR CODES (AU LIEU DU TEXTE "QR LinkedIn" / "QR Site Web") ---
    const iconY = qrY + qrSize + 2.2;

    // 1. Icône LinkedIn (Badge officiel bleu #0A66C2 avec "in" blanc)
    const inBadgeW = 9, inBadgeH = 4.2;
    const inBadgeX = qrLinkedInX + (qrSize - inBadgeW) / 2;
    doc.setFillColor(10, 102, 194);
    doc.roundedRect(inBadgeX, iconY, inBadgeW, inBadgeH, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(4.8);
    doc.setTextColor(255, 255, 255);
    doc.text('in', inBadgeX + inBadgeW / 2, iconY + 3.1, { align: 'center' });

    // 2. Icône Site Web (Badge bleu #0284C7 avec "WEB" blanc)
    const webBadgeW = 11, webBadgeH = 4.2;
    const webBadgeX = qrWebX + (qrSize - webBadgeW) / 2;
    doc.setFillColor(2, 132, 199);
    doc.roundedRect(webBadgeX, iconY, webBadgeW, webBadgeH, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(4.4);
    doc.setTextColor(255, 255, 255);
    doc.text('WEB', webBadgeX + webBadgeW / 2, iconY + 3.1, { align: 'center' });
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
  const ageStr = incube?.age ? ` (${incube.age})` : '';

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
      ['Date de naissance & Âge', `${dateNaisText}${ageStr}`],
      ['Genre & Situation', `${incube?.genre || '—'} • ${incube?.situation_familiale || 'Célibataire'}`],
      ['Niveau d\'étude', incube?.niveau_etude || '—'],
      ['Spécialité / Métier', incube?.specialite_metier || '—'],
      ['Ville & Province', `${incube?.ville || '—'}${incube?.province && incube.province !== incube.ville ? ' / ' + incube.province : ''}`],
      ['Téléphone', incube?.telephone || '—'],
      ['E-mail', incube?.email || '—']
    ]
  });

  const t1FinalY = doc.lastAutoTable.finalY;

  // TABLEAU 2 (Droite) : RENSEIGNEMENTS ENTREPRISE & ENCADREMENT
  const dateDemText = incube?.date_demarrage ? new Date(incube.date_demarrage).toLocaleDateString('fr-FR') : '—';
  const teamText = `${incube?.personnel_count || 1} collaborateur(s) (calculé depuis RH)`;

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
      ['Secteur d\'activité', { content: incube?.secteur_activite || '—', colSpan: 3 }],
      ['Phase du projet', incube?.phase_projet || 'Lancement', 'Date démarrage', dateDemText],
      ['Cible & Marché', { content: incube?.cible || 'B2B / B2G / B2BC', colSpan: 3, styles: { fontStyle: 'bold' } }],
      ['Promotion', displayPromo, 'Accompagnateur', displayAccomp],
      // COULEUR DU NOMBRE D'ÉQUIPE IDENTIQUE AUX AUTRES INFOS (PAS DE VERT !)
      ['Membres d\'équipe', { content: teamText, colSpan: 3, styles: { textColor: textDark } }]
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
  doc.text(`4. ASSOCIÉS DU PROJET (${associesList.length})`, col2X, commonMidY);

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
};

export const exportFicheSignaletiqueToPDF = async (incube, filename = null) => {
  const doc = await generateFicheSignaletiqueDocument(incube);
  const cleanName = (incube?.nom_incube || 'Incube').replace(/\s+/g, '_');
  doc.save(filename || `Fiche_Signaletique_${cleanName}.pdf`);
};

export const getFicheSignaletiqueBlobUrl = async (incube) => {
  const doc = await generateFicheSignaletiqueDocument(incube);
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
};


