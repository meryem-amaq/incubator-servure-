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

export const formatNomPrenomIncube = (fullName) => {
  if (!fullName || typeof fullName !== 'string') return 'Incubé';
  const clean = fullName.trim();
  if (!clean) return 'Incubé';

  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].toUpperCase();

  const capitalize = (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  const isAllCaps = (w) => w.length > 1 && w === w.toUpperCase() && /[A-Z]/.test(w);
  const anyAllCaps = words.some(isAllCaps);
  const allAllCaps = words.every(isAllCaps);

  if (anyAllCaps && !allAllCaps) {
    const nomParts = [];
    const prenomParts = [];
    words.forEach((w) => {
      if (isAllCaps(w)) nomParts.push(w.toUpperCase());
      else prenomParts.push(capitalize(w));
    });
    return `${nomParts.join(' ')} ${prenomParts.join(' ')}`.trim();
  }

  // Si tout est en majuscule ou tout en minuscule/capitalisé (ex: "Ahmed Benmoussa", "ahmed benmoussa", "AHMED BENMOUSSA")
  const nomPrefixes = ['el', 'al', 'ait', 'ben', 'ibn', 'bel', 'bou', 'ould', 'de', 'da'];
  let splitIndex = words.length - 1;
  if (words.length >= 3 && nomPrefixes.includes(words[words.length - 2].toLowerCase())) {
    splitIndex = words.length - 2;
  }

  const prenomList = words.slice(0, splitIndex).map(capitalize);
  const nomList = words.slice(splitIndex).map(w => w.toUpperCase());

  return `${nomList.join(' ')} ${prenomList.join(' ')}`.trim();
};

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
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.width; // 210
  const pageHeight = doc.internal.pageSize.height; // 297
  const marginX = 14;
  const contentWidth = pageWidth - (marginX * 2); // 182

  const today = new Date().toLocaleDateString('fr-FR');
  const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const incubeName = incube?.nom_incube || 'Incubé';
  const displayName = formatNomPrenomIncube(incubeName);
  const ageAnnees = formatAgeAnnees(incube?.age, incube?.date_naissance);

  // 1. Cadre décoratif extérieur
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

  // 2. Chargement des logos officiels et de la photo de l'incubé
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

  // 3. En-tête institutionnel officiel — SANS "ROYAUME DU MAROC"
  // Logo IDS : format carré naturel (1:1) -> 20mm x 20mm
  if (logoIds) {
    try {
      doc.addImage(logoIds, 'PNG', 14, 15, 20, 20);
    } catch (e) {}
  }
  // Logo CTPES : format rectangle horizontal naturel (1024x235, ratio 4.36:1) -> 42mm x 9.6mm
  if (logoCtpes) {
    try {
      doc.addImage(logoCtpes, 'PNG', pageWidth - 14 - 42, 20.2, 42, 9.6);
    } catch (e) {}
  }

  // Titre institutionnel centré avec espacement aéré garanti (> 2 cm d'écart avec chaque logo)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('INCUBATEUR DIGITAL SOLIDAIRE (IDS)', 94, 22.5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(2, 132, 199); // primary sky-600
  doc.text('FICHE SIGNALÉTIQUE & INFORMATIONS GÉNÉRALES', 94, 28, { align: 'center' });

  // Ligne séparatrice officielle
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 34, pageWidth - 14, 34);

  // 4. Cartouche Porteur & Photo de l'incubé (Y = 37 à 71)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 37, contentWidth, 34, 2.5, 2.5, 'FD');

  // Photo
  const photoX = 18;
  const photoY = 40;
  const photoSize = 28;
  if (photoDataUrl) {
    try {
      doc.addImage(photoDataUrl, 'JPEG', photoX, photoY, photoSize, photoSize);
      doc.setDrawColor(2, 132, 199);
      doc.setLineWidth(0.6);
      doc.rect(photoX, photoY, photoSize, photoSize);
    } catch (e) {
      photoDataUrl = null;
    }
  }
  if (!photoDataUrl) {
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.rect(photoX, photoY, photoSize, photoSize, 'FD');
    const initials = incubeName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'IN';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(148, 163, 184);
    doc.text(initials, photoX + photoSize / 2, photoY + 16, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text("Photo non fournie", photoX + photoSize / 2, photoY + 23, { align: 'center' });
  }

  // Informations principales du cartouche
  const textLeftX = 52;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(15, 23, 42);
  doc.text(displayName, textLeftX, 45);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(2, 132, 199);
  doc.text(incube?.raison_sociale || 'Projet d\'incubation', textLeftX, 51);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text("N° Dossier :", textLeftX, 58);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(incube?.pp_numero || '—', textLeftX + 22, 58);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text("Phase actuelle :", textLeftX + 65, 58);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(2, 132, 199);
  doc.text(incube?.phase_projet || '—', textLeftX + 90, 58);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text("Promotion :", textLeftX, 65);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(incube?.promotion || '—', textLeftX + 22, 65);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text("Accompagnateur :", textLeftX + 65, 65);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(incube?.accompagnateur || '—', textLeftX + 90, 65);

  // Helper pour dessiner le titre officiel d'une section numérotée
  const drawSectionBadge = (title, yPos) => {
    doc.setFillColor(2, 132, 199);
    doc.roundedRect(14, yPos - 3.8, 3, 5, 0.8, 0.8, 'F');
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(title, 20, yPos);
  };

  // 5. Section 1 : Renseignements Personnels du Porteur
  drawSectionBadge("1. RENSEIGNEMENTS PERSONNELS DU PORTEUR", 77);

  autoTable(doc, {
    startY: 81,
    margin: { left: 14, right: 14 },
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.2, font: 'helvetica', lineColor: [226, 232, 240], lineWidth: 0.3 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [71, 85, 105], cellWidth: 38 },
      1: { textColor: [15, 23, 42], cellWidth: 53 },
      2: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [71, 85, 105], cellWidth: 38 },
      3: { textColor: [15, 23, 42], cellWidth: 53 }
    },
    body: [
      ['Carte d\'Identité (CIN)', incube?.cin || '—', 'Genre', incube?.genre || '—'],
      [
        'Date de naissance',
        incube?.date_naissance ? new Date(incube.date_naissance).toLocaleDateString('fr-FR') : '—',
        'Âge',
        ageAnnees
      ],
      ['Situation familiale', incube?.situation_familiale || '—', 'Niveau d\'étude', incube?.niveau_etude || '—'],
      ['Ville & Province', `${incube?.ville || '—'} / ${incube?.province || '—'}`, 'Téléphone', incube?.telephone || '—'],
      ['Adresse E-mail', incube?.email || '—', 'Profil LinkedIn', incube?.linkedin || '—']
    ]
  });

  // 6. Section 2 : Renseignements Entreprise & Projet d'Incubation
  const sec2Y = doc.lastAutoTable.finalY + 6;
  drawSectionBadge("2. RENSEIGNEMENTS ENTREPRISE & PROJET D'INCUBATION", sec2Y);

  autoTable(doc, {
    startY: sec2Y + 4,
    margin: { left: 14, right: 14 },
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.2, font: 'helvetica', lineColor: [226, 232, 240], lineWidth: 0.3 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [71, 85, 105], cellWidth: 38 },
      1: { textColor: [15, 23, 42], cellWidth: 53 },
      2: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [71, 85, 105], cellWidth: 38 },
      3: { textColor: [15, 23, 42], cellWidth: 53 }
    },
    body: [
      ['Raison sociale', incube?.raison_sociale || '—', 'Statut juridique', incube?.statut_juridique || '—'],
      ['Registre Commerce (RC)', incube?.rc || '—', 'Secteur d\'activité', incube?.secteur_activite || '—'],
      ['Phase du projet', incube?.phase_projet || '—', 'Date de démarrage', incube?.date_demarrage ? new Date(incube.date_demarrage).toLocaleDateString('fr-FR') : '—'],
      ['Promotion d\'incubation', incube?.promotion || '—', 'Accompagnateur IDS', incube?.accompagnateur || '—'],
      ['Site Web / Portfolio', incube?.site_web || '—', 'Réf. Porteur (PP)', incube?.pp_numero || '—']
    ]
  });

  // 7. Section 3 : Description & Synthèse du projet
  const sec3Y = doc.lastAutoTable.finalY + 6;
  drawSectionBadge("3. DESCRIPTION DU PROJET", sec3Y);

  const descText = (incube?.description_projet && String(incube.description_projet).trim())
    ? String(incube.description_projet).trim()
    : "Aucune description renseignée pour ce projet.";

  autoTable(doc, {
    startY: sec3Y + 4,
    margin: { left: 14, right: 14 },
    theme: 'plain',
    styles: { 
      fontSize: 8, 
      cellPadding: 3.5, 
      font: 'helvetica', 
      lineColor: [226, 232, 240], 
      lineWidth: 0.3,
      fillColor: [248, 250, 252],
      textColor: incube?.description_projet ? [15, 23, 42] : [148, 163, 184],
      fontStyle: incube?.description_projet ? 'normal' : 'italic'
    },
    body: [
      [{ content: descText }]
    ]
  });

  // 8. Section 4 : Associés & Membres de l'Équipe
  let associesList = [];
  if (Array.isArray(incube?.associes)) {
    associesList = incube.associes;
  } else if (typeof incube?.associes === 'string') {
    try {
      const parsed = JSON.parse(incube.associes);
      if (Array.isArray(parsed)) associesList = parsed;
    } catch (e) {}
  }

  const sec4Y = doc.lastAutoTable.finalY + 6;
  drawSectionBadge(`4. ASSOCIÉS & ÉQUIPE DU PROJET (${associesList.length})`, sec4Y);

  if (associesList.length > 0) {
    autoTable(doc, {
      startY: sec4Y + 4,
      margin: { left: 14, right: 14 },
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.8, cellPadding: 2 },
      styles: { fontSize: 7.5, cellPadding: 1.8, font: 'helvetica', lineColor: [226, 232, 240], lineWidth: 0.2 },
      head: [['Nom & Prénom', 'CIN', 'Fonction', 'Téléphone', 'Accès Tourniquet / Badge']],
      body: associesList.map(a => [
        a.nom || '—',
        a.cin || '—',
        a.fonction || '—',
        a.tel || '—',
        (a.badge_id || a.matricule) ? `Badge #${a.badge_id || a.matricule}` : 'Sans badge'
      ])
    });
  } else {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, sec4Y + 4, contentWidth, 9, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.8);
    doc.setTextColor(148, 163, 184);
    doc.text("Aucun associé enregistré pour cette startup.", 18, sec4Y + 9.5);
    // Dummy table to set lastAutoTable.finalY
    doc.lastAutoTable = { finalY: sec4Y + 14 };
  }

  // 8. Pied de page officiel sur toutes les pages
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

    doc.setFontSize(7.2);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(
      "IDS — Incubateur Digital Solidaire • Salé • Document Officiel Confidentiel",
      14,
      pageHeight - 7
    );
    doc.text(
      `Édité le ${today} à ${time} • Page ${i} sur ${totalPages}`,
      pageWidth - 14,
      pageHeight - 7,
      { align: 'right' }
    );
  }

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


