import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const generatePDFDocument = (incubeName, title, columns, data, signatureImage) => {
  const doc = new jsPDF('landscape');

  const today = new Date().toLocaleDateString('fr-FR');
  const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const subtitleText = `${incubeName ? incubeName + ' • ' : ''}Édité le ${today} à ${time}`;

  autoTable(doc, {
    startY: 40,
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
    margin: { top: 40, left: 14, right: 14, bottom: 60 },
    didDrawPage: function (data) {
      // Titre principal
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(title, data.settings.margin.left, 20);

      // Sous-titre (Nom incubé + Date)
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(subtitleText, data.settings.margin.left, 28);

      // Ligne de séparation
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.5);
      doc.line(data.settings.margin.left, 32, doc.internal.pageSize.width - data.settings.margin.right, 32);
    }
  });

  const finalY = doc.lastAutoTable.finalY || 35;
  const pageHeight = doc.internal.pageSize.height;

  let sigY = finalY + 25;
  if (sigY + 50 > pageHeight) {
    doc.addPage();
    sigY = 30;
  }

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
  if (incube?.accompagnateurAdmin) {
    const { prenom, nom } = incube.accompagnateurAdmin;
    const full = `${prenom || ''} ${nom || ''}`.trim();
    if (full) return full;
  }
  return 'Cellule d\'Accompagnement IDS';
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
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(37, 99, 235);
  doc.text("CENTRE DE GESTION SOLIDAIRE (CGS) • IDS INCUBATEUR", marginX, 12);

  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text("FICHE DE SUIVI & PROCÈS-VERBAL", marginX, 20);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`Fiche de Suivi d'accompagnement • Réf : FS-PV-${incube?.pp_numero || 'INC'} • Dossier : ${incubeName}`, marginX, 26);

  doc.setFontSize(8.5);
  doc.text(`Édité le ${today} à ${time}`, pageWidth - marginX, 26, { align: 'right' });

  // Séparateur supérieur
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.6);
  doc.line(marginX, 29, pageWidth - marginX, 29);

  // ==========================================
  // SECTION 1 : IDENTIFICATION DU DOSSIER
  // ==========================================
  drawSectionHeader("1. IDENTIFICATION DU DOSSIER", 35);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(marginX, 38, contentWidth, 18, 2, 2, 'FD');

  doc.setFontSize(8.5);
  // Colonne 1
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("• Porteur de projet :", marginX + 4, 45);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(incubeName, marginX + 38, 45);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("• Raison sociale :", marginX + 4, 51);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(incube?.raison_sociale || '—', marginX + 38, 51);

  // Colonne 2
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("• N° Dossier :", marginX + 96, 45);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(incube?.pp_numero || '—', marginX + 125, 45);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("• Phase actuelle :", marginX + 96, 51);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(incube?.phase_projet || '—', marginX + 125, 51);

  // Colonne 3
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("• Accompagnateur :", marginX + 185, 45);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(accompagnateurName, marginX + 220, 45);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("• Date du PV :", marginX + 185, 51);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(`${today} (${rows.length} séance(s))`, marginX + 220, 51);

  // ==========================================
  // SECTION 2 : HISTORIQUE & DÉROULEMENT DU SUIVI TECHNIQUE
  // ==========================================
  drawSectionHeader("2. HISTORIQUE & DÉROULEMENT DU SUIVI TECHNIQUE", 63);

  const columns = [
    { header: 'Séance', dataKey: 'numero_ordre' },
    { header: 'Date', dataKey: 'date_suivi' },
    { header: 'Statut Juridique', dataKey: 'statut_juridique' },
    { header: 'Avancement', dataKey: 'statut_avancement' },
    { header: 'Anomalies Signalées', dataKey: 'anomalie_signalee' },
    { header: 'Observations & Décisions', dataKey: 'observations' },
    { header: 'Statut', dataKey: 'statut' }
  ];

  const tableData = rows.length === 0 ? [
    ['—', '—', '—', '—', 'Aucune séance de suivi enregistrée à ce jour.', '—', '—']
  ] : rows.map((r, i) => [
    r.numero_ordre ? `N° ${r.numero_ordre}` : `N° ${i + 1}`,
    formatDateFr(r.date_suivi),
    r.statut_juridique || '—',
    r.statut_avancement || '—',
    r.anomalie_signalee?.trim() || 'Néant',
    r.observations?.trim() || 'Conforme',
    r.declaration_echec === 'Oui' ? 'Alerte' : 'Validé'
  ]);

  autoTable(doc, {
    startY: 67,
    head: [columns.map(c => c.header)],
    body: tableData,
    styles: {
      fontSize: 8.5,
      cellPadding: 3.5,
      textColor: [51, 65, 85],
      valign: 'middle'
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.8,
      cellPadding: 4.5
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: {
      0: { cellWidth: 18, halign: 'center' },
      1: { cellWidth: 24, halign: 'center' },
      2: { cellWidth: 32 },
      3: { cellWidth: 32 },
      4: { cellWidth: 65 },
      5: { cellWidth: 'auto' },
      6: { cellWidth: 22, halign: 'center', fontStyle: 'bold' }
    },
    margin: { top: 67, left: marginX, right: marginX, bottom: 40 }
  });

  let currentY = doc.lastAutoTable.finalY || 67;

  // Vérifier s'il reste assez de place pour la Section 3 et la Section 4 (~75mm requis)
  if (currentY + 70 > pageHeight) {
    doc.addPage();
    currentY = 16;
  } else {
    currentY += 8;
  }

  // ==========================================
  // SECTION 3 : CONSTATATIONS, ANOMALIES & RECOMMANDATIONS
  // ==========================================
  drawSectionHeader("3. CONSTATATIONS, ANOMALIES & RECOMMANDATIONS", currentY);

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
  // SECTION 4 : VALIDATION ET ÉMARGEMENT
  // ==========================================
  if (currentY + 45 > pageHeight) {
    doc.addPage();
    currentY = 16;
  }

  drawSectionHeader("4. VALIDATION ET ÉMARGEMENT", currentY);

  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100, 116, 139);
  doc.text(
    "Les parties soussignées attestent de la conformité du présent procès-verbal et de l'exactitude des éléments mentionnés.",
    marginX + 6,
    currentY + 5
  );

  drawPVSignatures(doc, signatureImage, currentY + 10, incubeName, accompagnateurName, pageWidth);

  // Numérotation des pages en pied de page
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${i} sur ${totalPages} • Document officiel CGS - IDS Incubateur • Émargement numérique certifié`,
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
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(37, 99, 235);
  doc.text("ROYAUME DU MAROC • CENTRE DE GESTION SOLIDAIRE • IDS INCUBATEUR", 16, 15);

  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text("FICHE DE SUIVI & PV DE SÉANCE", 16, 23);

  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`Séance • Réf. FS-S${numOrdre}-${incube?.pp_numero || 'INC'}`, 16, 29);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`Date de la séance : ${formatDateFr(row.date_suivi)}`, pageWidth - 16, 29, { align: 'right' });

  // Séparateur
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.6);
  doc.line(16, 33, pageWidth - 16, 33);

  // 2. Fiche d'identification du projet
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(16, 37, pageWidth - 32, 26, 2, 2, 'FD');

  doc.setFontSize(8.5);
  // Col 1
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Porteur de projet :", 20, 44);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(incubeName, 52, 44);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Raison Sociale :", 20, 50);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(incube?.raison_sociale || '—', 52, 50);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("N° de Dossier :", 20, 56);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(incube?.pp_numero || '—', 52, 56);

  // Col 2
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Phase du projet :", 112, 44);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(incube?.phase_projet || '—', 142, 44);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Accompagnateur :", 112, 50);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(accompagnateurName, 142, 50);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Secteur d'activité :", 112, 56);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(incube?.secteur_activite || '—', 142, 56);

  // 3. Section 1 : Situation & Avancement
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("1. État d'avancement & Cadre Juridique", 16, 70);

  // Deux cartes
  const cardW = (pageWidth - 32 - 8) / 2;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(16, 73, cardW, 19, 2, 2, 'FD');
  doc.roundedRect(16 + cardW + 8, 73, cardW, 19, 2, 2, 'FD');

  doc.setFontSize(8.5);
  // Carte gauche
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Statut Juridique constaté :", 20, 80);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(37, 99, 235);
  doc.text(row.statut_juridique || 'Non renseigné', 20, 87);

  // Carte droite
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Stade de maturité :", 16 + cardW + 12, 80);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(row.statut_avancement || 'Idéation', 16 + cardW + 12, 87);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Déclaration d'échec :", 16 + cardW + 55, 80);
  doc.setFont("helvetica", "bold");
  if (row.declaration_echec === 'Oui') {
    doc.setTextColor(225, 29, 72);
  } else {
    doc.setTextColor(16, 185, 129);
  }
  doc.text(row.declaration_echec || 'Non', 16 + cardW + 55, 87);

  // 4. Section 2 : Observations de l'accompagnateur et recommandations
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("2. Observations de l'accompagnateur et recommandations", 16, 100);

  const obsText = row.observations?.trim() || "Séance de suivi conforme aux jalons fixés. Le porteur poursuit l'exécution de sa feuille de route.";
  const obsLines = doc.splitTextToSize(obsText, pageWidth - 42);
  const obsHeight = Math.max(38, obsLines.length * 4.8 + 12);

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(16, 104, pageWidth - 32, obsHeight, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 65, 85);
  doc.text(obsLines, 21, 112);

  // 5. Section 3 : Attestation
  let nextY = 104 + obsHeight + 10;
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100, 116, 139);
  const attestation = "Attestation : Les parties soussignées certifient l'exactitude des informations mentionnées ci-dessus et conviennent de poursuivre le plan d'action convenu.";
  const attLines = doc.splitTextToSize(attestation, pageWidth - 32);
  doc.text(attLines, 16, nextY);

  // 7. Signatures
  let sigY = nextY + 10;
  if (sigY + 45 > pageHeight) {
    doc.addPage();
    sigY = 25;
  }

  drawPVSignatures(doc, signatureImage, sigY, incubeName, accompagnateurName, pageWidth);

  // 8. Footer
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text(`Document officiel édité le ${today} à ${time} • CGS - IDS Incubateur`, pageWidth / 2, pageHeight - 8, { align: 'center' });

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

