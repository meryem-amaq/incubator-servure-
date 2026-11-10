import React, { useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Utilitaire de conversion d'image locale en DataURL pour jsPDF
const loadImageAsDataUrl = (url) => {
  return new Promise((resolve) => {
    try {
      const img = new Image();
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

const PAGE_SIZE = 15;

// Formatage propre du Numéro Porteur de Projet (PP)
const formatPpNumero = (p, fallbackNum) => {
  const raw = p?.pp_numero || p?.code_projet || p?.id_projet;
  if (raw && String(raw).trim() && String(raw).trim().toUpperCase() !== 'PP') {
    const val = String(raw).trim();
    return val.toUpperCase().startsWith('PP') ? val : `PP-${val}`;
  }
  if (p?.incubeId) {
    return `PP-${String(p.incubeId).padStart(3, '0')}`;
  }
  if (p?.id) {
    return `PP-${String(p.id).padStart(3, '0')}`;
  }
  return `PP-${String(fallbackNum).padStart(3, '0')}`;
};

export default function FeuilleEmargementPrint({
  isOpen,
  onClose,
  atelier,
  presences = []
}) {
  if (!isOpen || !atelier) return null;

  // Verrouillage du scroll arrière-plan (body), classe d'isolation et support Echap
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('feuille-emargement-open');

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.classList.remove('feuille-emargement-open');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Dédoublonnage strict par identifiant incubé
  const cleanPresences = useMemo(() => {
    const seen = new Set();
    return (presences || []).filter(p => {
      const key = p.incubeId ? String(p.incubeId) : (p.nom || '');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [presences]);

  const presentsCount = cleanPresences.filter(p => p.present).length;
  const totalCount = cleanPresences.length;

  // Découpage strict par 15 participants maximum par page
  const participantPages = useMemo(() => {
    if (!cleanPresences || cleanPresences.length === 0) {
      return [[]]; // Au minimum 1 page vide officielle
    }
    const pages = [];
    for (let i = 0; i < cleanPresences.length; i += PAGE_SIZE) {
      pages.push(cleanPresences.slice(i, i + PAGE_SIZE));
    }
    return pages;
  }, [cleanPresences]);

  const totalPages = participantPages.length;

  let meta = {};
  try {
    meta = typeof atelier.description === 'object' ? (atelier.description || {}) : JSON.parse(atelier.description || '{}');
  } catch (e) {
    meta = {};
  }
  const dateFinVal = meta.dateFin || atelier.dateFin;

  // Déterminer si la session est terminée ou en cours / future
  const isSessionTerminee = useMemo(() => {
    if (!atelier || !atelier.date) return false;
    try {
      if (atelier.statutOuverture === 'cloture') return true;
      const dateVal = dateFinVal || atelier.date;
      const timeVal = atelier.heureFin || meta.heureFin || '18:00';
      const cleanDate = String(dateVal).split('T')[0];
      const [h, m] = String(timeVal).split(':').map(Number);
      const sessionEnd = new Date(cleanDate);
      sessionEnd.setHours(isNaN(h) ? 23 : h, isNaN(m) ? 59 : m, 0, 0);
      return new Date() > sessionEnd;
    } catch (e) {
      return false;
    }
  }, [atelier, dateFinVal, meta]);

  const dateStr = atelier.date ? (
    dateFinVal && dateFinVal !== atelier.date ? (
      `Du ${new Date(atelier.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} au ${new Date(dateFinVal).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`
    ) : new Date(atelier.date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  ) : 'Date non définie';

  // Formatage du lieu et de la salle : "IDS Salé — [Salle]"
  let rawSalle = meta.salle || atelier.salle || 'Salle de formation';
  let cleanSalle = String(rawSalle)
    .replace(/^incubateur\s*ids\s*[-–—:]*\s*/i, '')
    .replace(/^ids\s*sal[ée]\s*[-–—:]*\s*/i, '')
    .replace(/^salle\s*de\s*formation\s*ids\s*/i, 'Salle de formation')
    .trim();
  if (!cleanSalle) cleanSalle = 'Salle de formation';
  const lieuSalleText = `IDS Salé — ${cleanSalle}`;

  // Horodatage de génération pour le pied de page
  const generationDateStr = useMemo(() => {
    const now = new Date();
    const d = now.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const t = now.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
    return `${d} ${t}`;
  }, []);

  // Impression navigateur standard
  const handlePrint = () => {
    const prevTitle = document.title;
    document.title = '';
    window.print();
    setTimeout(() => {
      document.title = prevTitle;
    }, 600);
  };

  // Génération et téléchargement vectoriel natif PDF via jsPDF & AutoTable
  // (Format A4 strict, en-tête répété sur chaque page, 15 max / page, signature sur dernière page)
  const handleDownloadPDF = async () => {
    const [logoIds, logoCtpes] = await Promise.all([
      loadImageAsDataUrl('/logo-ids.png'),
      loadImageAsDataUrl('/logo-ctpes.png')
    ]);

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const marginX = 14;
    const contentWidth = pageWidth - (marginX * 2); // 182mm

    participantPages.forEach((pageList, pageIdx) => {
      if (pageIdx > 0) {
        doc.addPage();
      }
      const pageNum = pageIdx + 1;
      const isLastPage = pageNum === totalPages;

      // 1. Logos officiels (répétés sur TOUTES les pages)
      if (logoIds) {
        try {
          doc.addImage(logoIds, 'PNG', marginX, 9, 15, 15);
        } catch (e) { }
      }
      if (logoCtpes) {
        try {
          doc.addImage(logoCtpes, 'PNG', pageWidth - marginX - 44, 11, 44, 10);
        } catch (e) { }
      }

      // 2. Titre central officiel
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('INCUBATEUR DIGITAL SOLIDAIRE', pageWidth / 2, 13, { align: 'center' });

      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text("FEUILLE D'ÉMARGEMENT OFFICIELLE", pageWidth / 2, 19, { align: 'center' });

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(4, 120, 87);
      doc.text('Session de Formation', pageWidth / 2, 24.5, { align: 'center' });

      // Ligne séparatrice
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.6);
      doc.line(marginX, 27.5, pageWidth - marginX, 27.5);

      // 3. Cartouche d'informations complet (répété sur TOUTES les pages)
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(marginX, 30.5, contentWidth, 27, 2, 2, 'FD');

      doc.setFontSize(8);
      // Colonne gauche
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('Thème de la formation :', marginX + 3.5, 36);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      const titreWrapped = doc.splitTextToSize(atelier.titre || 'Formation', 70);
      doc.text(titreWrapped[0] || '', marginX + 38, 36);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('Formateur :', marginX + 3.5, 42.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(atelier.formateur || 'Formateur IDS', marginX + 38, 42.5);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('Intervenant :', marginX + 3.5, 49);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(atelier.intervenant || '—', marginX + 38, 49);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('Lieu / Salle :', marginX + 3.5, 54.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(lieuSalleText, marginX + 38, 54.5);

      // Colonne droite
      const colRightX = marginX + 110;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('Date de la session :', colRightX, 36);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(dateStr, colRightX + 28, 36);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('Horaires :', colRightX, 43);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(2, 132, 199);
      doc.text(`${atelier.heureDebut || '09:30'} - ${atelier.heureFin || '12:30'} (${atelier.duree || '3h00'})`, colRightX + 28, 43);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('Taux de présence :', colRightX, 50);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(4, 120, 87);
      doc.text(`${presentsCount} présent(s) / ${totalCount} inscrit(s)`, colRightX + 28, 50);

      // 4. Tableau des participants pour cette page (6 colonnes, max 15 lignes, numérotation continue)
      const pageRows = pageList.length === 0 ? [
        ['-', '-', 'Aucun participant inscrit à cette session', '-', '-', '-']
      ] : pageList.map((p, rIdx) => {
        const globalNum = pageIdx * PAGE_SIZE + rIdx + 1;
        const pp = formatPpNumero(p, globalNum);
        const fullName = `${p.nom || ''} ${p.prenom && p.prenom !== '—' ? p.prenom : ''}`.trim() || '—';
        let statut = 'En attente';
        let heureScan = '—';
        let sig = '....................';

        if (p.present) {
          statut = '✔ PRÉSENT';
          heureScan = p.time && p.time !== '—' ? p.time : '09:30';
          sig = 'Signé Numériquement';
        } else if (isSessionTerminee) {
          statut = 'ABSENT';
          heureScan = '—';
          sig = 'Non émargé';
        }

        return [
          String(globalNum),
          pp,
          fullName,
          statut,
          heureScan,
          sig
        ];
      });

      autoTable(doc, {
        startY: 61,
        head: [['N°', 'N° Porteur de Projet', "Nom & Prénom de l'incubé", 'Statut', 'Heure de scan', 'Signature / Visa']],
        body: pageRows,
        styles: {
          fontSize: 8.5,
          cellPadding: 2.5,
          textColor: [30, 41, 59],
          lineColor: [203, 213, 225],
          lineWidth: 0.2
        },
        headStyles: {
          fillColor: [241, 245, 249],
          textColor: [51, 65, 85],
          fontStyle: 'bold',
          fontSize: 8.5,
          lineColor: [203, 213, 225],
          lineWidth: 0.3,
          halign: 'center'
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 32, halign: 'center' },
          2: { cellWidth: 54, halign: 'left', fontStyle: 'bold' },
          3: { cellWidth: 25, halign: 'center' },
          4: { cellWidth: 23, halign: 'center' },
          5: { cellWidth: 38, halign: 'center' }
        },
        margin: { left: marginX, right: marginX },
        didParseCell: function (data) {
          if (data.section === 'body') {
            if (data.column.index === 3) {
              if (data.cell.raw === '✔ PRÉSENT') {
                data.cell.styles.textColor = [4, 120, 87];
                data.cell.styles.fontStyle = 'bold';
              } else if (data.cell.raw === 'ABSENT') {
                data.cell.styles.textColor = [220, 38, 38];
                data.cell.styles.fontStyle = 'bold';
              } else {
                data.cell.styles.textColor = [100, 116, 139];
              }
            }
            if (data.column.index === 5) {
              if (data.cell.raw === 'Signé Numériquement') {
                data.cell.styles.textColor = [5, 150, 105];
                data.cell.styles.fontSize = 7.5;
                data.cell.styles.fontStyle = 'bold';
              } else if (data.cell.raw === 'Non émargé') {
                data.cell.styles.textColor = [148, 163, 184];
                data.cell.styles.fontStyle = 'italic';
                data.cell.styles.fontSize = 7.5;
              } else {
                data.cell.styles.textColor = [203, 213, 225];
              }
            }
          }
        }
      });

      // 5. Zone de signature du Formateur (présente sur chaque page pour certification officielle)
      // Cadre horizontal agrandi occupant toute la largeur disponible avec marges régulières
      const boxWidth = contentWidth; // 182mm (largeur complète de la page A4 avec marges régulières)
      const boxHeight = 28;
      const boxX = marginX; // 14mm (aligné avec les marges gauche/droite du tableau)
      const boxY = pageHeight - 16 - boxHeight; // 253mm

      // 1. Fond blanc global et bordure extérieure fine bleu marine (#1e40af)
      doc.setDrawColor(30, 64, 175);
      doc.setFillColor(255, 255, 255);
      doc.setLineWidth(0.4);
      doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 2.5, 2.5, 'FD');

      // 2. Bandeau supérieur bleu clair (#e8f1fd) sur toute la largeur
      doc.setFillColor(232, 241, 253);
      doc.setDrawColor(30, 64, 175);
      doc.roundedRect(boxX, boxY, boxWidth, 7, 2.5, 2.5, 'FD');
      doc.setFillColor(232, 241, 253);
      doc.rect(boxX + 0.2, boxY + 3.5, boxWidth - 0.4, 3.5, 'F');

      // Ligne de délimitation sous le bandeau
      doc.setDrawColor(191, 219, 254);
      doc.setLineWidth(0.2);
      doc.line(boxX, boxY + 7, boxX + boxWidth, boxY + 7);

      // 3. Titre dans le bandeau : « Signature du formateur : »
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 58, 138); // #1e3a8a
      doc.text('Signature du formateur :', boxX + 6, boxY + 4.8);

      // 4. Longue ligne horizontale bleue presque sur toute la largeur intérieure du cadre
      const lineY = boxY + boxHeight - 4.5;
      doc.setDrawColor(30, 64, 175); // bleue
      doc.setLineWidth(0.3);
      doc.line(boxX + 8, lineY, boxX + boxWidth - 8, lineY);

      // Redessiner la bordure extérieure pour une netteté parfaite
      doc.setDrawColor(30, 64, 175);
      doc.setLineWidth(0.4);
      doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 2.5, 2.5, 'D');

      // 6. Pied de page officiel sur TOUTES les pages
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(`${generationDateStr}   Incubateur Digital Solidaire (IDS)`, marginX, pageHeight - 7.5);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text(`Page ${pageNum} / ${totalPages}`, pageWidth - marginX, pageHeight - 7.5, { align: 'right' });
    });

    const safeFilename = `Feuille_Emargement_${(atelier.titre || 'Formation').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30)}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(safeFilename);
  };

  return createPortal(
    <div
      className="feuille-print-portal"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 999999,
        backgroundColor: 'rgba(2, 6, 23, 0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        overflowY: 'auto'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div
        className="min-h-screen w-full flex flex-col items-center justify-start py-6 sm:py-10 px-2 sm:px-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose?.();
          }
        }}
      >
        {/* Barre d'outils supérieure (Non imprimée) */}
        <div
          onClick={e => e.stopPropagation()}
          className="w-full max-w-[210mm] bg-slate-900 text-white rounded-2xl p-4 mb-6 flex items-center justify-between shadow-2xl border border-slate-800 print:hidden shrink-0"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Printer size={18} />
            </div>
            <div>
              <h3 className="font-black text-sm text-white">Feuille d'Émargement Officielle A4</h3>
              <p className="text-xs text-slate-400">
                {totalCount} participant{totalCount > 1 ? 's' : ''} • {totalPages} page{totalPages > 1 ? 's' : ''} (15 max / page)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Bouton Télécharger en PDF */}
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-blue-900/30 cursor-pointer transition-all active:scale-95"
              title="Télécharger directement en fichier PDF officiel A4"
            >
              <Download size={15} /> Télécharger en PDF
            </button>

            {/* Bouton Imprimer */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-900/30 cursor-pointer transition-all active:scale-95"
              title="Imprimer avec la boîte de dialogue de votre navigateur"
            >
              <Printer size={15} /> Imprimer
            </button>

            {/* Bouton Fermer */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Fermer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* CONTENEUR DE PAGES A4 */}
        <div
          onClick={e => e.stopPropagation()}
          className="w-full max-w-[210mm] flex flex-col items-center print:w-[210mm] print:max-w-none print:m-0 print:p-0"
        >
          {/* RÈGLES D'IMPRESSION STRICTES A4 */}
          <style dangerouslySetInnerHTML={{
            __html: `
            @media print {
              @page {
                size: 210mm 297mm;
                margin: 0 !important;
              }
              html, body {
                background: #ffffff !important;
                color: #000000 !important;
                overflow: visible !important;
                height: auto !important;
                min-height: auto !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 210mm !important;
              }
              /* Masquer tout ce qui n'appartient pas au document imprimé */
              #root, #root *, main, nav, header, aside, .sidebar {
                display: none !important;
                visibility: hidden !important;
                height: 0 !important;
                width: 0 !important;
                overflow: hidden !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              body > *:not(.feuille-print-portal) {
                display: none !important;
                visibility: hidden !important;
                height: 0 !important;
              }
              .feuille-print-portal {
                position: static !important;
                inset: auto !important;
                width: 210mm !important;
                min-height: auto !important;
                height: auto !important;
                background: #ffffff !important;
                background-color: #ffffff !important;
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
                padding: 0 !important;
                margin: 0 !important;
                overflow: visible !important;
                display: block !important;
                z-index: auto !important;
              }
              .feuille-print-portal > div {
                min-height: auto !important;
                padding: 0 !important;
                margin: 0 !important;
                display: block !important;
                width: 210mm !important;
              }
              .feuille-page-a4 {
                width: 210mm !important;
                min-width: 210mm !important;
                max-width: 210mm !important;
                height: 297mm !important;
                min-height: 297mm !important;
                max-height: 297mm !important;
                padding: 10mm 12mm 8mm 12mm !important;
                margin: 0 !important;
                border: none !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                box-sizing: border-box !important;
                overflow: hidden !important;
                background: #ffffff !important;
                page-break-after: always !important;
                break-after: page !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
              }
              .feuille-page-a4:last-of-type,
              .feuille-page-a4:last-child {
                page-break-after: avoid !important;
                break-after: avoid !important;
              }
              table {
                width: 100% !important;
                border-collapse: collapse !important;
              }
            }
          ` }} />

          {/* Rendu dynamique de chaque page (15 participants maximum par page) */}
          {participantPages.map((pageList, pageIdx) => {
            const pageNum = pageIdx + 1;
            const isLastPage = pageNum === totalPages;

            return (
              <div
                key={pageIdx}
                className="feuille-page-a4 w-full max-w-[210mm] bg-white text-slate-900 rounded-2xl p-6 sm:p-8 shadow-2xl border border-slate-200 mb-8 print:mb-0 print:p-0 print:border-none print:shadow-none print:rounded-none flex flex-col justify-between"
                style={{
                  minHeight: '297mm',
                  boxSizing: 'border-box'
                }}
              >
                {/* PARTIE SUPÉRIEURE DE LA PAGE : En-tête, Cartouche, Tableau */}
                <div className="space-y-4">
                  {/* 1. En-tête officiel avec les deux logos partenaires (répété sur chaque page) */}
                  <div className="border-b-2 border-slate-900 pb-3 flex items-center justify-between gap-4">
                    {/* Logo IDS à gauche */}
                    <div className="flex items-center shrink-0">
                      <img
                        src="/logo-ids.png"
                        alt="Incubateur Digital Solidaire"
                        className="h-12 sm:h-14 w-auto object-contain max-w-[75px]"
                      />
                    </div>

                    {/* Titre central officiel */}
                    <div className="text-center flex-1 px-2">
                      <p className="text-[10px] font-black tracking-widest uppercase text-slate-500">
                        Incubateur Digital Solidaire
                      </p>
                      <h1 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight mt-0.5">
                        Feuille d'Émargement Officielle
                      </h1>
                      <p className="text-xs font-bold text-emerald-700 mt-0.5">
                        Session de Formation
                      </p>
                    </div>

                    {/* Logo CTPES à droite */}
                    <div className="flex items-center justify-end shrink-0">
                      <img
                        src="/logo-ctpes.png"
                        alt="Centre Des Très Petites Entreprises Solidaires"
                        className="h-10 sm:h-12 w-auto object-contain max-w-[160px]"
                      />
                    </div>
                  </div>

                  {/* 2. Cartouche d'informations officiel (répété sur chaque page) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs">
                    <div className="space-y-1">
                      <p>
                        <span className="font-bold text-slate-500">Thème de la formation :</span>{' '}
                        <strong className="text-slate-900 text-xs">{atelier.titre}</strong>
                      </p>
                      <p>
                        <span className="font-bold text-slate-500">Formateur :</span>{' '}
                        <strong className="text-slate-800">{atelier.formateur || 'Formateur IDS'}</strong>
                      </p>
                      <p>
                        <span className="font-bold text-slate-500">Intervenant :</span>{' '}
                        <strong className="text-slate-800">{atelier.intervenant || '—'}</strong>
                      </p>
                      <p>
                        <span className="font-bold text-slate-500">Lieu / Salle :</span>{' '}
                        <strong className="text-slate-900">{lieuSalleText}</strong>
                      </p>
                    </div>
                    <div className="space-y-1 sm:text-right">
                      <p>
                        <span className="font-bold text-slate-500">Date de la session :</span>{' '}
                        <strong className="capitalize text-slate-800">{dateStr}</strong>
                      </p>
                      <p>
                        <span className="font-bold text-slate-500">Horaires :</span>{' '}
                        <strong className="text-blue-700">
                          {atelier.heureDebut || '09:30'} - {atelier.heureFin || '12:30'} ({atelier.duree || '3h00'})
                        </strong>
                      </p>
                      <p>
                        <span className="font-bold text-slate-500">Taux de présence :</span>{' '}
                        <strong className="text-emerald-700">
                          {presentsCount} présent(s) / {totalCount} inscrit(s)
                        </strong>
                      </p>
                    </div>
                  </div>

                  {/* 3. Tableau des participants : 6 colonnes strictes, 15 participants maximum */}
                  <div className="border border-slate-300 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-300 text-[10px] font-black uppercase tracking-wider text-slate-600">
                          <th className="py-2 px-2.5 w-10 text-center border-r border-slate-300">N°</th>
                          <th className="py-2 px-3 w-32 text-center border-r border-slate-300">N° Porteur de Projet</th>
                          <th className="py-2 px-3.5 border-r border-slate-300">Nom & Prénom de l'incubé</th>
                          <th className="py-2 px-2.5 w-24 text-center border-r border-slate-300">Statut</th>
                          <th className="py-2 px-2.5 w-24 text-center border-r border-slate-300">Heure de scan</th>
                          <th className="py-2 px-3 text-center w-36">Signature / Visa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {pageList.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                              Aucun participant inscrit à cette session.
                            </td>
                          </tr>
                        ) : (
                          pageList.map((p, rIdx) => {
                            const globalNum = pageIdx * PAGE_SIZE + rIdx + 1;
                            const pp = formatPpNumero(p, globalNum);
                            const fullName = `${p.nom || ''} ${p.prenom && p.prenom !== '—' ? p.prenom : ''}`.trim() || '—';
                            const heureScan = p.time && p.time !== '—' ? p.time : '09:30';

                            return (
                              <tr key={p.incubeId || rIdx} className="hover:bg-slate-50/60">
                                <td className="py-2 px-2.5 font-mono font-bold text-slate-500 text-center border-r border-slate-200">
                                  {globalNum}
                                </td>
                                <td className="py-2 px-3 font-mono font-semibold text-slate-600 text-center border-r border-slate-200">
                                  {pp}
                                </td>
                                <td className="py-2 px-3.5 font-bold text-slate-900 border-r border-slate-200 truncate max-w-[200px]">
                                  {fullName}
                                </td>
                                <td className="py-2 px-2.5 text-center border-r border-slate-200">
                                  {p.present ? (
                                    <span className="font-bold text-emerald-700 text-[11px]">✔ PRÉSENT</span>
                                  ) : isSessionTerminee ? (
                                    <span className="font-bold text-red-600 text-[11px]">ABSENT</span>
                                  ) : (
                                    <span className="font-semibold text-slate-500 text-[10px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                      En attente
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-2.5 font-mono text-center border-r border-slate-200">
                                  {p.present ? (
                                    <span className="text-slate-700 text-[11px] font-medium">{heureScan}</span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  {p.present ? (
                                    <span className="font-mono text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block">
                                      Signé Numériquement
                                    </span>
                                  ) : isSessionTerminee ? (
                                    <span className="text-slate-400 italic text-[10px]">
                                      Non émargé
                                    </span>
                                  ) : (
                                    <span className="text-slate-300 font-mono tracking-widest text-xs select-none">
                                      ....................
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* PARTIE INFÉRIEURE DE LA PAGE : Signature (sur chaque page) et Pied de page */}
                <div className="pt-4">
                  {/* 4. Zone de signature du Formateur (sur chaque page officielle) */}
                  <div className="signatures-print-block pb-3 w-full text-xs">
                    <div className="w-full border-[1.5px] border-[#1e40af] rounded-xl overflow-hidden bg-white shadow-sm flex flex-col justify-between">
                      {/* Bandeau d'en-tête bleu clair avec titre bien visible et en gras */}
                      <div className="bg-[#e8f1fd] px-5 py-2 border-b border-[#bfdbfe]/60">
                        <p className="font-bold text-[#1e3a8a] text-xs">Signature du formateur :</p>
                      </div>

                      {/* Grande zone blanche pour une signature manuscrite confortable */}
                      <div className="h-20 w-full bg-white"></div>

                      {/* Longue ligne horizontale bleue presque sur toute la largeur */}
                      <div className="px-6 pb-4 pt-0">
                        <div className="border-b-[1.5px] border-[#1e40af] w-full"></div>
                      </div>
                    </div>
                  </div>

                  {/* 5. Pied de page officiel sur TOUTES les pages */}
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <div className="flex items-center gap-2">
                      <span>{generationDateStr}</span>
                      <span>•</span>
                      <span className="font-bold text-slate-700">Incubateur Digital Solidaire (IDS)</span>
                    </div>
                    <div className="text-slate-600 font-bold text-xs">
                      Page {pageNum} / {totalPages}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
