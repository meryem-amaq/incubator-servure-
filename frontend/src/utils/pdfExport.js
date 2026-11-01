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

  // 3. Section 1 : Objet & Évolutions
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("1. Objet de la Réunion & Évolutions constatées", 16, 68);

  // Bannière Objet de la réunion
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(16, 71, pageWidth - 32, 11, 2, 2, 'FD');
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Objet de la réunion :", 20, 78);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(37, 99, 235);
  doc.text(row.objet_reunion || 'Séance de suivi périodique', 56, 78);

  // Deux cartes : Changement juridique & Changement d'avancement
  const cardW = (pageWidth - 32 - 8) / 2;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(16, 85, cardW, 19, 2, 2, 'FD');
  doc.roundedRect(16 + cardW + 8, 85, cardW, 19, 2, 2, 'FD');

  doc.setFontSize(8.5);
  // Carte gauche
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Changement Juridique :", 20, 92);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(37, 99, 235);
  doc.text(row.statut_juridique || 'Non renseigné', 20, 99);

  // Carte droite
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Changement de l'état d'avancement :", 16 + cardW + 12, 92);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(row.statut_avancement || 'Idéation', 16 + cardW + 12, 99);

  // 4. Section 2 : Observations de l'accompagnateur et recommandations
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("2. Observations de l'accompagnateur et recommandations", 16, 112);

  const obsText = row.observations?.trim() || "Séance de suivi conforme aux jalons fixés. Le porteur poursuit l'exécution de sa feuille de route.";
  const obsLines = doc.splitTextToSize(obsText, pageWidth - 42);
  const obsHeight = Math.max(38, obsLines.length * 4.8 + 12);

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(16, 116, pageWidth - 32, obsHeight, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 65, 85);
  doc.text(obsLines, 21, 124);

  // 5. Section 3 : Attestation
  let nextY = 116 + obsHeight + 10;
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
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(37, 99, 235);
  doc.text("CENTRE DE GESTION SOLIDAIRE (CGS) • IDS INCUBATEUR", marginX, 12);

  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text("PROCÈS-VERBAL D'ÉVALUATION TRIMESTRIELLE (PV 3 MOIS)", marginX, 19);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`Réf : PV-TRI-T${quarterNum}-${selectedYear}-${incube?.pp_numero || 'INC'} • Dossier : ${incubeName} • Période : ${quarterLabel} ${selectedYear}`, marginX, 25);

  doc.setFontSize(8.5);
  doc.text(`Édité le ${today} à ${time}`, pageWidth - marginX, 25, { align: 'right' });

  // Ligne de séparation
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.6);
  doc.line(marginX, 28, pageWidth - marginX, 28);

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
  // 5. SYNTHÈSE, RECOMMANDATIONS & DÉCISION
  // ==========================================
  if (currentY + 45 > pageHeight) {
    doc.addPage();
    currentY = 16;
  }

  drawSectionHeader("5. AVIS DE L'ACCOMPAGNATEUR & RECOMMANDATIONS POUR LE TRIMESTRE SUIVANT", currentY);

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
  // 6. VALIDATION ET ÉMARGEMENT (SIGNATURES)
  // ==========================================
  if (currentY + 45 > pageHeight) {
    doc.addPage();
    currentY = 16;
  }

  drawSectionHeader("6. ÉMARGEMENT & DOUBLE SIGNATURE OFFICIELLE", currentY);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Le présent procès-verbal trimestriel arrête l'état d'avancement du projet à l'issue du trimestre T${quarterNum} (${selectedYear}). Les soussignés en certifient la conformité.`,
    marginX + 6,
    currentY + 4.5
  );

  drawPVSignatures(doc, signatureImage, currentY + 9, incubeName, accompagnateurName, pageWidth);

  // Numérotation finale de toutes les pages
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${i} sur ${totalPages} • Document officiel CGS - IDS Incubateur • Procès-Verbal Trimestriel T${quarterNum} ${selectedYear}`,
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


