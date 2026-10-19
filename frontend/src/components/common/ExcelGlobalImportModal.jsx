import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  Download, 
  CheckCircle2, 
  Users, 
  Building2, 
  Wrench, 
  ClipboardList, 
  UsersRound, 
  DollarSign, 
  Calendar,
  Layers,
  CheckCircle,
  FileSpreadsheet
} from 'lucide-react';
import { 
  readAllWorkbookSheets, 
  parseGlobalPromotionWorkbook, 
  exportGlobalPromotionTemplate 
} from '../../utils/excelHelper';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function ExcelGlobalImportModal({ isOpen, onClose, onImportCompleted }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [parsedIncubes, setParsedIncubes] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setFile(null);
    setParsedIncubes([]);
    setLoading(false);
    setImporting(false);
    setProgressMsg('');
  };

  const handleClose = () => {
    if (importing) return;
    handleReset();
    onClose();
  };

  const handleProcessFile = async (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setLoading(true);
    try {
      const sheets = await readAllWorkbookSheets(selectedFile);
      const result = parseGlobalPromotionWorkbook(sheets, selectedFile.name);

      if (!result || result.length === 0) {
        toast.error("Aucun incubé trouvé dans le fichier Excel. Vérifiez les colonnes.");
        setParsedIncubes([]);
      } else {
        setParsedIncubes(result);
        const totalDetails = result.reduce((sum, item) => 
          sum + item.materiel.length + item.plan_action.length + item.rh_personnel.length + item.rh_emploi.length + item.financier.length + item.engagement.length, 0);
        toast.success(`${result.length} incubé(s) détecté(s) avec ${totalDetails} détail(s) associé(s) !`);
      }
    } catch (err) {
      toast.error(err.message || "Erreur lors de la lecture du classeur Excel");
      setParsedIncubes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleImportAll = async () => {
    if (parsedIncubes.length === 0) return;
    setImporting(true);

    let successCount = 0;
    let errors = [];

    for (let i = 0; i < parsedIncubes.length; i++) {
      const item = parsedIncubes[i];
      const inc = item.incube;
      setProgressMsg(`Importation de l'incubé ${i + 1}/${parsedIncubes.length} : ${inc.nom_incube}...`);

      try {
        // 1. Créer l'incubé
        const resIncube = await api.post('/incubes', inc);
        const incubeId = resIncube.data?.id;

        if (incubeId) {
          // 2. Matériel
          if (item.materiel && item.materiel.length > 0) {
            const formattedMat = item.materiel.map(r => ({
              type_origine: (r.type_origine && String(r.type_origine).toLowerCase().includes('ids')) ? 'ids' : 'propre',
              article: r.article || 'Matériel importé',
              date_acquisition_reception: r.date_acquisition_reception || null,
              caracteristiques_serie: r.caracteristiques_serie || '',
              quantite: parseInt(r.quantite) || 1,
              valeur_ou_etat: r.valeur_ou_etat || '',
            }));
            try {
              await api.post(`/incubes/${incubeId}/materiel/bulk`, formattedMat);
            } catch (e) {
              for (const it of formattedMat) await api.post(`/incubes/${incubeId}/materiel`, it);
            }
          }

          // 3. Plan d'action
          if (item.plan_action && item.plan_action.length > 0) {
            try {
              await api.post(`/incubes/${incubeId}/plan-action/bulk`, item.plan_action);
            } catch (e) {
              for (const it of item.plan_action) await api.post(`/incubes/${incubeId}/plan-action`, it);
            }
          }

          // 4. Personnel RH
          if (item.rh_personnel && item.rh_personnel.length > 0) {
            const pers = item.rh_personnel.map(r => ({
              nom_complet: r.nom_complet || '',
              poste: r.poste || '',
              nature_contrat: r.nature_contrat || 'CDI',
              date_embauche: r.date_embauche || null,
              date_fin: r.date_fin || null,
              salaire_mensuel: r.salaire_mensuel ? parseFloat(r.salaire_mensuel) : null,
            }));
            try {
              await api.post(`/incubes/${incubeId}/rh-detail/bulk`, pers);
            } catch (e) {
              for (const it of pers) await api.post(`/incubes/${incubeId}/rh-detail`, it);
            }
          }

          // 5. Emplois RH
          if (item.rh_emploi && item.rh_emploi.length > 0) {
            const emp = item.rh_emploi.map(r => ({
              mois: r.mois || '',
              personnel_permanent: parseInt(r.personnel_permanent) || 0,
              personnel_temporaire: parseInt(r.personnel_temporaire) || 0,
            }));
            try {
              await api.post(`/incubes/${incubeId}/rh-emploi/bulk`, emp);
            } catch (e) {
              for (const it of emp) await api.post(`/incubes/${incubeId}/rh-emploi`, it);
            }
          }

          // 6. Finances
          if (item.financier && item.financier.length > 0) {
            try {
              await api.post(`/incubes/${incubeId}/analyse-financiere/bulk`, item.financier);
            } catch (e) {
              for (const it of item.financier) await api.post(`/incubes/${incubeId}/analyse-financiere`, it);
            }
          }

          // 7. Engagement
          if (item.engagement && item.engagement.length > 0) {
            try {
              await api.post(`/incubes/${incubeId}/engagement/bulk`, item.engagement);
            } catch (e) {
              for (const it of item.engagement) await api.post(`/incubes/${incubeId}/engagement`, it);
            }
          }

          successCount++;
        }
      } catch (err) {
        console.error(`Erreur sur l'incubé ${inc.nom_incube}:`, err);
        errors.push(inc.nom_incube);
      }
    }

    setImporting(false);
    setProgressMsg('');

    if (successCount > 0) {
      toast.success(`🎉 ${successCount} incubé(s) et tous leurs détails ont été importés avec succès !`);
      if (onImportCompleted) onImportCompleted();
      handleClose();
    }

    if (errors.length > 0) {
      toast.error(`Impossible d'importer : ${errors.join(', ')}`);
    }
  };

  return (
    <div className="modal-overlay z-50 p-3 sm:p-6" onClick={handleClose}>
      <div 
        className="modal slide-up max-w-3xl w-full p-6 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-3xl shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-dark-700/60">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 shadow-sm">
              <Layers size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-dark-100">
                Importer tous les incubés avec leurs détails (Excel)
              </h3>
              <p className="text-xs text-slate-500 dark:text-dark-400">
                Chargez un fichier Excel pour ajouter en une seule opération tous les incubés, leur matériel, RH, plan d'action et finances.
              </p>
            </div>
          </div>
          <button 
            onClick={handleClose} 
            disabled={importing}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-dark-200 hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 1. Zone d'importation principale (Drag & Drop / Sélecteur) */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !importing && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition-all ${
            dragOver
              ? 'border-emerald-500 bg-emerald-500/10 scale-[0.99]'
              : file
              ? 'border-emerald-500/80 bg-emerald-500/5 dark:bg-emerald-950/20'
              : 'border-slate-300 dark:border-dark-700 hover:border-emerald-500/80 bg-slate-50/60 dark:bg-dark-800/40'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleProcessFile(e.target.files[0]);
              }
            }}
          />
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner">
            <Upload size={26} />
          </div>
          <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-dark-100">
            {file ? (
              <span className="text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1.5">
                <CheckCircle size={18} /> {file.name}
              </span>
            ) : (
              "Cliquez pour choisir votre fichier Excel à importer"
            )}
          </p>
          <p className="text-xs text-slate-500 dark:text-dark-400 mt-1">
            ou glissez-déposez le fichier ici (.xlsx, .xls, .csv)
          </p>
        </div>

        {/* Lien discret pour télécharger le modèle complet multi-onglets */}
        <div className="flex items-center justify-between text-xs px-1 text-slate-400 dark:text-dark-400">
          <span>Format : Classeur multi-onglets (Incubés, Matériel, RH, Plan d'action, Finances, Engagement)</span>
          <button
            type="button"
            onClick={exportGlobalPromotionTemplate}
            className="text-primary-500 hover:underline inline-flex items-center gap-1 font-medium"
          >
            <Download size={12} /> Exemple de fichier complet (.xlsx)
          </button>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="py-6 text-center text-xs text-slate-500 dark:text-dark-400 flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            Lecture et analyse automatique de tous les incubés et de leurs détails...
          </div>
        )}

        {/* Liste des incubés détectés et leurs détails */}
        {parsedIncubes.length > 0 && !loading && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-dark-200">
                {parsedIncubes.length} incubé(s) prêt(s) à être importé(s) :
              </span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 size={13} /> Tous les détails associés sont prêts
              </span>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2.5 pr-1">
              {parsedIncubes.map((item, idx) => {
                const inc = item.incube;
                return (
                  <div 
                    key={idx}
                    className="p-3 bg-slate-50 dark:bg-dark-800/60 border border-slate-200 dark:border-dark-700/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-navy-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                        {inc.nom_incube?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-dark-100">
                          {inc.nom_incube}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-dark-400">
                          {inc.raison_sociale || 'Projet'} · {inc.pp_numero || 'Sans PP'} · {inc.phase_projet || 'Idéation'}
                        </p>
                      </div>
                    </div>

                    {/* Badges des détails associés */}
                    <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
                      {item.materiel.length > 0 && (
                        <span className="badge badge-blue text-[10px] py-0.5 px-2">
                          <Wrench size={10} className="mr-1 inline" /> {item.materiel.length} mat.
                        </span>
                      )}
                      {item.plan_action.length > 0 && (
                        <span className="badge badge-green text-[10px] py-0.5 px-2">
                          <ClipboardList size={10} className="mr-1 inline" /> {item.plan_action.length} act.
                        </span>
                      )}
                      {item.rh_personnel.length > 0 && (
                        <span className="badge badge-navy text-[10px] py-0.5 px-2">
                          <UsersRound size={10} className="mr-1 inline" /> {item.rh_personnel.length} pers.
                        </span>
                      )}
                      {item.financier.length > 0 && (
                        <span className="badge badge-orange text-[10px] py-0.5 px-2">
                          <DollarSign size={10} className="mr-1 inline" /> {item.financier.length} mois fin.
                        </span>
                      )}
                      {item.engagement.length > 0 && (
                        <span className="badge badge-gray text-[10px] py-0.5 px-2">
                          <Calendar size={10} className="mr-1 inline" /> {item.engagement.length} mois suiv.
                        </span>
                      )}
                      {item.materiel.length === 0 && item.plan_action.length === 0 && item.rh_personnel.length === 0 && item.financier.length === 0 && item.engagement.length === 0 && (
                        <span className="text-[10px] text-slate-400 italic">Profil seul</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Message de progression */}
        {importing && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
            <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin shrink-0" />
            <span>{progressMsg}</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-dark-700/60">
          <button
            type="button"
            className="btn btn-secondary text-xs py-2 px-4"
            onClick={handleClose}
            disabled={importing}
          >
            Annuler
          </button>
          
          <button
            type="button"
            className="btn btn-primary text-xs py-2 px-5 flex items-center gap-2 font-bold shadow-lg shadow-primary-500/20 bg-emerald-600 hover:bg-emerald-500 border-emerald-500"
            disabled={parsedIncubes.length === 0 || importing || loading}
            onClick={handleImportAll}
          >
            {importing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Importation globale en cours...
              </>
            ) : (
              <>
                <CheckCircle2 size={15} />
                Importer tous les incubés et leurs détails ({parsedIncubes.length})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
