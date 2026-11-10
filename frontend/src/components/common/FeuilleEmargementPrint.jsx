import React, { useMemo } from 'react';
import { Printer, X, Download, CheckCircle2 } from 'lucide-react';
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

export default function FeuilleEmargementPrint({
  isOpen,
  onClose,
  atelier,
  presences = []
}) {
  if (!isOpen || !atelier) return null;

  // Dédoublonnage strict par identifiant incubé
  const cleanPresences = useMemo(() => {
    const seen = new Set();
    return presences.filter(p => {
      const key = p.incubeId ? String(p.incubeId) : (p.nom || '');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [presences]);

  const presentsCount = cleanPresences.filter(p => p.present).length;
  const totalCount = cleanPresences.length;

  let meta = {};
  try {
    meta = typeof atelier.description === 'object' ? (atelier.description || {}) : JSON.parse(atelier.description || '{}');
  } catch (e) {
    meta = {};
  }
  const dateFinVal = meta.dateFin || atelier.dateFin;

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

  // 1. Impression navigateur standard avec gestion de pagination
  const handlePrint = () => {
    window.print();
  };

  // 2. Génération et téléchargement vectoriel natif PDF via jsPDF & AutoTable (avec logos officiels & sans cadre réf)
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

    const pageWidth = doc.internal.pageSize.width; // 210mm
    const pageHeight = doc.internal.pageSize.height; // 297mm
    const marginX = 14;

    const tableBody = cleanPresences.map((p, idx) => [
      String(idx + 1),
      p.pp_numero || p.ppNumero || 'PP',
      `${p.nom || ''} ${p.prenom && p.prenom !== '—' ? p.prenom : ''}`.trim(),
      p.present ? '✔ PRÉSENT' : 'ABSENT',
      p.time || '—',
      p.present ? 'Signé Numériquement' : 'Non émargé'
    ]);

    autoTable(doc, {
      startY: 68,
      head: [['#', 'N° Dossier / PP', "Nom & Prénom de l'Incubé", 'Statut', 'Heure', 'Signature / Visa']],
      body: tableBody,
      styles: {
        fontSize: 8.5,
        cellPadding: 3.2,
        textColor: [30, 41, 59],
        lineColor: [203, 213, 225],
        lineWidth: 0.2
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [71, 85, 105],
        fontStyle: 'bold',
        fontSize: 8.5,
        lineColor: [203, 213, 225],
        lineWidth: 0.3
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 32 },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 26, halign: 'center' },
        4: { cellWidth: 22, halign: 'center' },
        5: { cellWidth: 42, halign: 'center' }
      },
      margin: { top: 68, left: marginX, right: marginX, bottom: 42 },
      didParseCell: function(data) {
        if (data.section === 'body' && data.column.index === 3) {
          if (data.cell.raw === '✔ PRÉSENT') {
            data.cell.styles.textColor = [4, 120, 87];
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          }
        }
        if (data.section === 'body' && data.column.index === 5 && data.cell.raw === 'Signé Numériquement') {
          data.cell.styles.textColor = [5, 150, 105];
          data.cell.styles.fontSize = 7.5;
        }
      },
      didDrawPage: function(data) {
        if (data.pageNumber === 1) {
          // Logo IDS à gauche
          if (logoIds) {
            try {
              doc.addImage(logoIds, 'PNG', marginX, 9, 16, 16);
            } catch (e) {
              // ignore
            }
          }

          // Logo CTPES à droite (ratio ~4.36)
          if (logoCtpes) {
            try {
              doc.addImage(logoCtpes, 'PNG', pageWidth - marginX - 44, 12, 44, 10);
            } catch (e) {
              // ignore
            }
          }

          // Titre central
          doc.setFontSize(8.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 116, 139);
          doc.text('INCUBATEUR DIGITAL SOLIDAIRE', pageWidth / 2, 14, { align: 'center' });

          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(15, 23, 42);
          doc.text("FEUILLE D'ÉMARGEMENT OFFICIELLE", pageWidth / 2, 20, { align: 'center' });

          // Sous-titre
          doc.setFontSize(9.5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(4, 120, 87);
          doc.text('Session de Formation', pageWidth / 2, 26, { align: 'center' });

          // Ligne séparatrice
          doc.setDrawColor(15, 23, 42);
          doc.setLineWidth(0.8);
          doc.line(marginX, 30, pageWidth - marginX, 30);

          // Cartouche d'informations
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.3);
          doc.roundedRect(marginX, 33, pageWidth - (marginX * 2), 30, 3, 3, 'FD');

          doc.setFontSize(8.5);
          doc.setTextColor(71, 85, 105);

          // Gauche
          doc.text('Thème de la formation :', marginX + 4, 40);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(15, 23, 42);
          const titreText = doc.splitTextToSize(atelier.titre || 'Formation', 80);
          doc.text(titreText, marginX + 38, 40);

          doc.setFont('helvetica', 'normal');
          doc.setTextColor(71, 85, 105);
          doc.text('Formateur :', marginX + 4, 48);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(15, 23, 42);
          doc.text(atelier.formateur || 'Formateur IDS', marginX + 38, 48);

          doc.setFont('helvetica', 'normal');
          doc.setTextColor(71, 85, 105);
          doc.text('Lieu / Salle :', marginX + 4, 56);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(15, 23, 42);
          doc.text(lieuSalleText, marginX + 38, 56);

          // Droite
          const colRightX = marginX + 115;
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(71, 85, 105);
          doc.text('Date de la session :', colRightX, 40);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(15, 23, 42);
          doc.text(dateStr, colRightX + 30, 40);

          doc.setFont('helvetica', 'normal');
          doc.setTextColor(71, 85, 105);
          doc.text('Horaires :', colRightX, 48);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(2, 132, 199);
          doc.text(`${atelier.heureDebut || '09:30'} - ${atelier.heureFin || '12:30'} (${atelier.duree || '3h00'})`, colRightX + 30, 48);

          doc.setFont('helvetica', 'normal');
          doc.setTextColor(71, 85, 105);
          doc.text('Taux de présence :', colRightX, 56);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(4, 120, 87);
          doc.text(`${presentsCount} présent(s) / ${totalCount} inscrit(s)`, colRightX + 30, 56);
        } else {
          // En-tête pages suivantes
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 116, 139);
          doc.text(`Feuille d'émargement : ${atelier.titre || 'Formation'} (Suite)`, marginX, 15);
          doc.setDrawColor(203, 213, 225);
          doc.setLineWidth(0.3);
          doc.line(marginX, 18, pageWidth - marginX, 18);
        }

        // Bas de page numérotation
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text(`Page ${data.pageNumber}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
      }
    });

    // Numérotation totale
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(`Page ${i} sur ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
    }

    // Signatures sur la dernière page
    const finalY = doc.lastAutoTable.finalY || 100;
    let sigY = finalY + 12;

    if (sigY + 35 > pageHeight - 15) {
      doc.addPage();
      sigY = 25;
    }

    const boxWidth = 85;
    const boxHeight = 26;
    const formateurBoxX = pageWidth - marginX - boxWidth;

    // Signature du Formateur uniquement
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(formateurBoxX, sigY, boxWidth, boxHeight, 2, 2, 'D');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Signature du Formateur :', formateurBoxX + 3, sigY + 6);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(148, 163, 184);
    doc.text(atelier.formateur || 'Formateur responsable', formateurBoxX + 3, sigY + boxHeight - 4);

    const safeFilename = `Feuille_Emargement_${(atelier.titre || 'Formation').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30)}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(safeFilename);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-sm overflow-y-auto feuille-print-overlay">
      <div className="min-h-screen w-full flex flex-col items-center justify-start py-6 sm:py-10 px-2 sm:px-4">
        {/* Barre d'outils (Non imprimée) */}
        <div className="w-full max-w-4xl bg-slate-900 text-white rounded-2xl p-4 mb-4 flex items-center justify-between shadow-2xl border border-slate-800 print:hidden shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Printer size={18} />
            </div>
            <div>
              <h3 className="font-black text-sm text-white">Feuille d'Émargement Officielle A4</h3>
              <p className="text-xs text-slate-400">Export PDF vectoriel ou impression directe</p>
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

        {/* FEUILLE A4 OFFICIELLE IMPRIMABLE */}
        <div className="w-full max-w-4xl bg-white text-slate-900 rounded-2xl p-6 sm:p-10 shadow-2xl border border-slate-200 feuille-print-card print:p-0 print:border-none print:shadow-none print:m-0 print:w-full print:max-w-none">
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              @page {
                size: A4 portrait;
                margin: 10mm 12mm 15mm 12mm;
              }
              html, body {
                background: #ffffff !important;
                color: #000000 !important;
                overflow: visible !important;
                height: auto !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              #mobile-navigation-drawer, nav, header, aside, .sidebar, .print\\:hidden, [class*="print:hidden"] {
                display: none !important;
              }
              .feuille-print-overlay {
                position: static !important;
                inset: auto !important;
                width: 100% !important;
                min-height: auto !important;
                height: auto !important;
                background: transparent !important;
                padding: 0 !important;
                margin: 0 !important;
                overflow: visible !important;
                display: block !important;
              }
              .feuille-print-card {
                border: none !important;
                box-shadow: none !important;
                padding: 0 !important;
                margin: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                overflow: visible !important;
                background: #ffffff !important;
              }
              .print-area {
                position: static !important;
                width: 100% !important;
                padding: 0 !important;
                margin: 0 !important;
                overflow: visible !important;
              }
              .table-print-container {
                overflow: visible !important;
                border: 1px solid #cbd5e1 !important;
                border-radius: 6px !important;
              }
              table {
                width: 100% !important;
                border-collapse: collapse !important;
                page-break-inside: auto !important;
              }
              thead {
                display: table-header-group !important;
              }
              tbody {
                page-break-inside: auto !important;
              }
              tr {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              .signatures-print-block {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                margin-top: 20px !important;
              }
            }
          ` }} />

          <div className="print-area space-y-6">
            {/* En-tête officiel avec les deux logos partenaires */}
            <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between gap-4">
              {/* Logo IDS à gauche */}
              <div className="flex items-center shrink-0">
                <img
                  src="/logo-ids.png"
                  alt="Incubateur Digital Solidaire"
                  className="h-14 sm:h-16 w-auto object-contain max-w-[85px]"
                />
              </div>

              {/* Titre central officiel */}
              <div className="text-center flex-1 px-2">
                <p className="text-[11px] font-black tracking-widest uppercase text-slate-500">
                  Incubateur Digital Solidaire
                </p>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight mt-0.5">
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
                  className="h-12 sm:h-14 w-auto object-contain max-w-[175px]"
                />
              </div>
            </div>

            {/* Cartouche d'informations de l'atelier */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs">
              <div className="space-y-1">
                <p><span className="font-bold text-slate-500">Thème de la formation :</span> <strong className="text-slate-900 text-sm">{atelier.titre}</strong></p>
                <p><span className="font-bold text-slate-500">Formateur :</span> <strong>{atelier.formateur || 'Formateur IDS'}</strong></p>
                {atelier.intervenant && <p><span className="font-bold text-slate-500">Intervenant :</span> <strong>{atelier.intervenant}</strong></p>}
                <p><span className="font-bold text-slate-500">Lieu / Salle :</span> <strong className="text-slate-900">{lieuSalleText}</strong></p>
              </div>
              <div className="space-y-1 sm:text-right">
                <p><span className="font-bold text-slate-500">Date de la session :</span> <strong className="capitalize">{dateStr}</strong></p>
                <p><span className="font-bold text-slate-500">Horaires :</span> <strong className="text-primary-700">{atelier.heureDebut || '09:30'} - {atelier.heureFin || '12:30'} ({atelier.duree || '3h00'})</strong></p>
                <p><span className="font-bold text-slate-500">Taux de présence :</span> <strong className="text-emerald-700">{presentsCount} présent(s) / {totalCount} inscrit(s)</strong></p>
              </div>
            </div>

            {/* Tableau d'émargement */}
            <div className="table-print-container overflow-x-auto border border-slate-300 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-[10px] font-black uppercase tracking-wider text-slate-600">
                    <th className="py-2.5 px-3 w-8 text-center border-r border-slate-300">#</th>
                    <th className="py-2.5 px-3 w-28 border-r border-slate-300">N° Dossier / PP</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">Nom & Prénom de l'Incubé</th>
                    <th className="py-2.5 px-3 w-24 border-r border-slate-300 text-center">Statut</th>
                    <th className="py-2.5 px-3 w-24 border-r border-slate-300 text-center">Heure de Scan</th>
                    <th className="py-2.5 px-3 text-center w-36">Signature / Visa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {cleanPresences.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                        Aucun participant n'a encore émargé à cet atelier.
                      </td>
                    </tr>
                  ) : (
                    cleanPresences.map((p, idx) => (
                      <tr key={p.incubeId || idx} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-400 text-center border-r border-slate-200">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-700 border-r border-slate-200">
                          {p.pp_numero || p.ppNumero || 'PP'}
                        </td>
                        <td className="py-2.5 px-3 font-black text-slate-900 border-r border-slate-200">
                          {p.nom} {p.prenom && p.prenom !== '—' ? p.prenom : ''}
                        </td>
                        <td className="py-2.5 px-3 text-center border-r border-slate-200">
                          {p.present ? (
                            <span className="font-bold text-emerald-700 text-[11px]">✔ PRÉSENT</span>
                          ) : (
                            <span className="font-bold text-red-600 text-[11px]">ABSENT</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-center text-slate-600 border-r border-slate-200">
                          {p.time || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {p.present ? (
                            <span className="font-mono text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              Signé Numériquement
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[10px]">
                              Non émargé
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Signature officielle du Formateur en bas de page */}
            <div className="signatures-print-block pt-6 flex justify-end text-xs border-t border-slate-300">
              <div className="border border-slate-200 rounded-xl p-4 h-32 w-80 flex flex-col justify-between bg-white shadow-sm">
                <p className="font-bold text-slate-700">Signature du Formateur :</p>
                <div className="border-b border-dashed border-slate-300 pb-1 text-slate-500 italic text-[11px]">
                  {atelier.formateur || 'Formateur responsable'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
