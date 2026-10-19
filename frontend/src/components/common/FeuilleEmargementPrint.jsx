import React from 'react';
import { Printer, X, Download, CheckCircle2, Building2 } from 'lucide-react';

export default function FeuilleEmargementPrint({
  isOpen,
  onClose,
  atelier,
  presences = []
}) {
  if (!isOpen || !atelier) return null;

  const handlePrint = () => {
    window.print();
  };

  const presentsCount = presences.filter(p => p.present).length;
  const totalCount = presences.length;
  const dateStr = atelier.date ? new Date(atelier.date).toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : 'Date non définie';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* Barre d'outils (Non imprimée) */}
      <div className="w-full max-w-4xl bg-slate-900 text-white rounded-2xl p-4 mb-3 flex items-center justify-between shadow-2xl border border-slate-800 print:hidden">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Printer size={18} />
          </div>
          <div>
            <h3 className="font-black text-sm text-white">Feuille d'Émargement Officielle A4</h3>
            <p className="text-xs text-slate-400">Prête pour impression ou enregistrement en PDF</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-900/30 cursor-pointer transition-all active:scale-95"
          >
            <Printer size={15} /> Imprimer / Enregistrer en PDF
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
      <div className="w-full max-w-4xl bg-white text-slate-900 rounded-2xl p-8 sm:p-12 shadow-2xl border border-slate-200 overflow-hidden print:p-0 print:border-none print:shadow-none print:m-0 print:w-full print:max-w-none">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * {
              visibility: hidden;
            }
            .print-area, .print-area * {
              visibility: visible;
            }
            .print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              padding: 20mm;
              background: white !important;
              color: black !important;
            }
          }
        ` }} />

        <div className="print-area space-y-6">
          {/* En-tête officiel */}
          <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <div>
              <p className="text-[10px] font-black tracking-widest uppercase text-slate-500">
                Incubateur Digital Solidaire (IDS) • Fablab & Innovation
              </p>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight mt-0.5">
                Feuille d'Émargement Officielle
              </h1>
              <p className="text-xs font-semibold text-emerald-700 mt-0.5">
                Session de Formation & Atelier Collectif IDS
              </p>
            </div>
            <div className="text-right shrink-0 border border-slate-300 rounded-xl p-3 bg-slate-50">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Réf. Document</p>
              <p className="font-mono font-black text-xs text-slate-800">EMG-{atelier.id}-{new Date().getFullYear()}</p>
              <p className="text-[10px] font-medium text-slate-400 mt-0.5">Émargement numérique certifié</p>
            </div>
          </div>

          {/* Cartouche d'informations de l'atelier */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs">
            <div className="space-y-1">
              <p><span className="font-bold text-slate-500">Thème de la formation :</span> <strong className="text-slate-900 text-sm">{atelier.titre}</strong></p>
              <p><span className="font-bold text-slate-500">Formateur :</span> <strong>{atelier.formateur || 'Formateur IDS'}</strong></p>
              {atelier.intervenant && <p><span className="font-bold text-slate-500">Intervenant :</span> <strong>{atelier.intervenant}</strong></p>}
              <p><span className="font-bold text-slate-500">Lieu / Salle :</span> <strong>Incubateur IDS — Salle de formation</strong></p>
            </div>
            <div className="space-y-1 sm:text-right">
              <p><span className="font-bold text-slate-500">Date de la session :</span> <strong className="capitalize">{dateStr}</strong></p>
              <p><span className="font-bold text-slate-500">Horaires :</span> <strong className="text-primary-700">{atelier.heureDebut || '09:30'} - {atelier.heureFin || '12:30'} ({atelier.duree || '3h00'})</strong></p>
              <p><span className="font-bold text-slate-500">Taux de présence :</span> <strong className="text-emerald-700">{presentsCount} présent(s) / {totalCount} inscrit(s)</strong></p>
            </div>
          </div>

          {/* Tableau d'émargement */}
          <div className="overflow-x-auto border border-slate-300 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-[10px] font-black uppercase tracking-wider text-slate-600">
                  <th className="py-2.5 px-3 w-8 text-center border-r border-slate-300">#</th>
                  <th className="py-2.5 px-3 border-r border-slate-300">N° Dossier / PP</th>
                  <th className="py-2.5 px-3 border-r border-slate-300">Nom & Prénom de l'Incubé</th>
                  <th className="py-2.5 px-3 border-r border-slate-300 text-center">Statut</th>
                  <th className="py-2.5 px-3 border-r border-slate-300 text-center">Heure de Scan</th>
                  <th className="py-2.5 px-3 text-center w-36">Signature / Visa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {presences.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                      Aucun participant n'a encore émargé à cet atelier.
                    </td>
                  </tr>
                ) : (
                  presences.map((p, idx) => (
                    <tr key={p.incubeId || idx} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-400 text-center border-r border-slate-200">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-700 border-r border-slate-200">
                        {p.pp_numero || p.ppNumero || 'PP-NON-DÉFINI'}
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

          {/* Signatures officielles en bas de page */}
          <div className="pt-6 grid grid-cols-2 gap-8 text-xs border-t border-slate-300">
            <div className="border border-slate-200 rounded-xl p-4 h-32 flex flex-col justify-between">
              <p className="font-bold text-slate-600">Visa & Signature du Formateur :</p>
              <div className="border-b border-dashed border-slate-300 pb-1 text-slate-400 italic text-[11px]">
                {atelier.formateur || 'Formateur responsable'}
              </div>
            </div>
            <div className="border border-slate-200 rounded-xl p-4 h-32 flex flex-col justify-between">
              <p className="font-bold text-slate-600">Cachet & Visa de la Direction de l'Incubateur :</p>
              <div className="border-b border-dashed border-slate-300 pb-1 text-slate-400 italic text-[11px]">
                Incubateur Digital Solidaire (IDS)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
