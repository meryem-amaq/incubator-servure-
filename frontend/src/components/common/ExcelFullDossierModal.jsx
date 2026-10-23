import React, { useState, useRef } from 'react';
import { 
  X, 
  UploadCloud, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  Wrench, 
  ClipboardList, 
  UsersRound, 
  DollarSign, 
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';
import { readAllWorkbookSheets, parseFullIncubeWorkbook, exportFullIncubeTemplate } from '../../utils/excelHelper';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function ExcelFullDossierModal({ isOpen, onClose, incubeId, incubeName, onApplied }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setFile(null);
    setParsedData(null);
    setLoading(false);
    setApplying(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleProcessFile = async (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setLoading(true);
    try {
      const sheets = await readAllWorkbookSheets(selectedFile);
      const parsed = parseFullIncubeWorkbook(sheets);
      
      const totalCount = 
        (parsed.infos ? 1 : 0) +
        parsed.materiel.length +
        parsed.plan_action.length +
        parsed.rh_personnel.length +
        parsed.rh_emploi.length +
        parsed.financier.length +
        parsed.engagement.length;

      if (totalCount === 0) {
        toast.error("Aucune donnée reconnue dans le fichier. Veuillez vérifier les colonnes.");
        setParsedData(null);
      } else {
        setParsedData(parsed);
        toast.success(`Fichier analysé avec succès ! Données détectées prêtes à être appliquées.`);
      }
    } catch (err) {
      toast.error(err.message || "Erreur lors de la lecture du fichier");
      setParsedData(null);
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

  const handleApplyAll = async () => {
    if (!parsedData || !incubeId) return;
    setApplying(true);
    let successCount = 0;
    let errors = [];

    try {
      // 1. Infos générales
      if (parsedData.infos) {
        try {
          await api.put(`/incubes/${incubeId}`, parsedData.infos);
          successCount++;
        } catch (e) {
          errors.push("Infos Générales");
        }
      }

      // 2. Matériel
      if (parsedData.materiel && parsedData.materiel.length > 0) {
        try {
          const items = parsedData.materiel.map(r => ({
            type_origine: (r.type_origine && String(r.type_origine).toLowerCase().includes('ids')) ? 'ids' : 'propre',
            article: r.article || 'Matériel importé',
            date_acquisition_reception: r.date_acquisition_reception || null,
            caracteristiques_serie: r.caracteristiques_serie || '',
            quantite: parseInt(r.quantite) || 1,
            valeur_ou_etat: r.valeur_ou_etat || '',
          }));
          try {
            await api.post(`/incubes/${incubeId}/materiel/bulk`, items);
          } catch (bulkErr) {
            if (bulkErr.response?.status === 404) {
              for (const it of items) await api.post(`/incubes/${incubeId}/materiel`, it);
            } else throw bulkErr;
          }
          successCount += items.length;
        } catch (e) {
          errors.push("Matériel");
        }
      }

      // 3. Plan d'action
      if (parsedData.plan_action && parsedData.plan_action.length > 0) {
        try {
          try {
            await api.post(`/incubes/${incubeId}/plan-action/bulk`, parsedData.plan_action);
          } catch (bulkErr) {
            if (bulkErr.response?.status === 404) {
              for (const it of parsedData.plan_action) await api.post(`/incubes/${incubeId}/plan-action`, it);
            } else throw bulkErr;
          }
          successCount += parsedData.plan_action.length;
        } catch (e) {
          errors.push("Plan d'action");
        }
      }

      // 4. Personnel RH
      if (parsedData.rh_personnel && parsedData.rh_personnel.length > 0) {
        try {
          const pers = parsedData.rh_personnel.map(r => ({
            nom_complet: r.nom_complet || '',
            poste: r.poste || '',
            nature_contrat: r.nature_contrat || 'CDI',
            date_embauche: r.date_embauche || null,
            date_fin: r.date_fin || null,
            salaire_mensuel: r.salaire_mensuel ? parseFloat(r.salaire_mensuel) : null,
          }));
          try {
            await api.post(`/incubes/${incubeId}/rh-detail/bulk`, pers);
          } catch (bulkErr) {
            if (bulkErr.response?.status === 404) {
              for (const it of pers) await api.post(`/incubes/${incubeId}/rh-detail`, it);
            } else throw bulkErr;
          }
          successCount += pers.length;
        } catch (e) {
          errors.push("Personnel RH");
        }
      }

      // 5. Emplois RH
      if (parsedData.rh_emploi && parsedData.rh_emploi.length > 0) {
        try {
          const emp = parsedData.rh_emploi.map(r => ({
            mois: r.mois || '',
            personnel_permanent: parseInt(r.personnel_permanent) || 0,
            personnel_temporaire: parseInt(r.personnel_temporaire) || 0,
          }));
          try {
            await api.post(`/incubes/${incubeId}/rh-emploi/bulk`, emp);
          } catch (bulkErr) {
            if (bulkErr.response?.status === 404) {
              for (const it of emp) await api.post(`/incubes/${incubeId}/rh-emploi`, it);
            } else throw bulkErr;
          }
          successCount += emp.length;
        } catch (e) {
          errors.push("Emplois RH");
        }
      }

      // 6. Analyse financière
      if (parsedData.financier && parsedData.financier.length > 0) {
        try {
          try {
            await api.post(`/incubes/${incubeId}/analyse-financiere/bulk`, parsedData.financier);
          } catch (bulkErr) {
            if (bulkErr.response?.status === 404) {
              for (const it of parsedData.financier) await api.post(`/incubes/${incubeId}/analyse-financiere`, it);
            } else throw bulkErr;
          }
          successCount += parsedData.financier.length;
        } catch (e) {
          errors.push("Finances");
        }
      }

      // 7. Engagement : Exclu de l'importation Excel conformément aux règles de traçabilité
      // Les présences et heures sont strictement réservées et mesurées par les tourniquets physiques ZKTeco


      // 8. Fiche Technique
      if (parsedData.fiche_technique && parsedData.fiche_technique.length > 0) {
        try {
          const fichesData = parsedData.fiche_technique.map(r => ({
            incube_id: incubeId,
            numero_ordre: r.numero_ordre ? String(r.numero_ordre) : null,
            date_suivi: r.date_suivi || new Date().toISOString().split('T')[0],
            statut_juridique: r.statut_juridique || null,
            statut_avancement: r.statut_avancement || 'En cours',
            anomalie_signalee: r.anomalie_signalee || '',
            declaration_echec: r.declaration_echec || 'Non',
            observations: r.observations || ''
          }));
          try {
            await api.post(`/incubes/${incubeId}/fiche-suivi/bulk`, fichesData);
          } catch (bulkErr) {
            if (bulkErr.response?.status === 404) {
              for (const it of fichesData) await api.post(`/incubes/${incubeId}/fiche-suivi`, it);
            } else throw bulkErr;
          }
          successCount += fichesData.length;
        } catch (e) {
          errors.push("Fiche de Suivi");
        }
      }

      if (errors.length === 0) {
        toast.success(`Dossier complet mis à jour avec succès depuis le fichier Excel !`);
        if (onApplied) onApplied();
        handleClose();
      } else {
        toast.error(`Importation partielle. Problèmes rencontrés sur : ${errors.join(', ')}`);
        if (onApplied) onApplied();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'application des données");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="modal-overlay z-50 p-3 sm:p-6" onClick={handleClose}>
      <div 
        className="modal slide-up max-w-2xl w-full p-6 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-3xl shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-dark-700/60">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 shadow-sm">
              <Layers size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-dark-100 flex items-center gap-2">
                Importer tout le dossier incubé (Excel)
              </h3>
              <p className="text-xs text-slate-500 dark:text-dark-400">
                Incubé : <span className="font-semibold text-slate-700 dark:text-dark-200">{incubeName}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={handleClose} 
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
          onClick={() => fileInputRef.current?.click()}
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
            <UploadCloud size={26} />
          </div>
          <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-dark-100">
            {file ? (
              <span className="text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1.5">
                <CheckCircle2 size={18} /> {file.name}
              </span>
            ) : (
              "Cliquez pour choisir votre fichier Excel à importer"
            )}
          </p>
          <p className="text-xs text-slate-500 dark:text-dark-400 mt-1">
            ou glissez-déposez le fichier ici (.xlsx, .xls, .csv)
          </p>
        </div>

        {/* Lien discret pour modèle exemple facultatif */}
        <div className="flex items-center justify-between text-xs px-1 text-slate-400 dark:text-dark-400">
          <span>Classeur multi-onglets ou fichier à feuille unique</span>
          <button
            type="button"
            onClick={exportFullIncubeTemplate}
            className="text-primary-500 hover:underline inline-flex items-center gap-1"
          >
            <Download size={12} /> Exemple de fichier complet (.xlsx)
          </button>
        </div>

        {/* Résumé des données détectées */}
        {loading && (
          <div className="py-6 text-center text-xs text-slate-500 dark:text-dark-400 flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            Analyse intelligente des feuilles et colonnes Excel...
          </div>
        )}

        {parsedData && !loading && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-dark-200">
                Sections détectées dans votre fichier :
              </span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 size={13} /> Prêt pour importation
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {/* Infos */}
              <div className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs ${
                parsedData.infos 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-semibold' 
                  : 'bg-slate-50 dark:bg-dark-800/40 border-slate-200 dark:border-dark-700/50 text-slate-400'
              }`}>
                <Building2 size={15} className="shrink-0" />
                <div className="truncate">
                  <p className="truncate leading-tight">Infos Générales</p>
                  <span className="text-[10px] opacity-75">{parsedData.infos ? '1 profil détecté' : 'Non détecté'}</span>
                </div>
              </div>

              {/* Matériel */}
              <div className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs ${
                parsedData.materiel.length > 0
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-semibold' 
                  : 'bg-slate-50 dark:bg-dark-800/40 border-slate-200 dark:border-dark-700/50 text-slate-400'
              }`}>
                <Wrench size={15} className="shrink-0" />
                <div className="truncate">
                  <p className="truncate leading-tight">Matériel</p>
                  <span className="text-[10px] opacity-75">{parsedData.materiel.length} article(s)</span>
                </div>
              </div>

              {/* Plan d'action */}
              <div className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs ${
                parsedData.plan_action.length > 0
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-semibold' 
                  : 'bg-slate-50 dark:bg-dark-800/40 border-slate-200 dark:border-dark-700/50 text-slate-400'
              }`}>
                <ClipboardList size={15} className="shrink-0" />
                <div className="truncate">
                  <p className="truncate leading-tight">Plan d'Action</p>
                  <span className="text-[10px] opacity-75">{parsedData.plan_action.length} action(s)</span>
                </div>
              </div>

              {/* Personnel */}
              <div className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs ${
                parsedData.rh_personnel.length > 0
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-semibold' 
                  : 'bg-slate-50 dark:bg-dark-800/40 border-slate-200 dark:border-dark-700/50 text-slate-400'
              }`}>
                <UsersRound size={15} className="shrink-0" />
                <div className="truncate">
                  <p className="truncate leading-tight">Personnel RH</p>
                  <span className="text-[10px] opacity-75">{parsedData.rh_personnel.length} collaborateur(s)</span>
                </div>
              </div>

              {/* Finances */}
              <div className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs ${
                parsedData.financier.length > 0
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-semibold' 
                  : 'bg-slate-50 dark:bg-dark-800/40 border-slate-200 dark:border-dark-700/50 text-slate-400'
              }`}>
                <DollarSign size={15} className="shrink-0" />
                <div className="truncate">
                  <p className="truncate leading-tight">Finances</p>
                  <span className="text-[10px] opacity-75">{parsedData.financier.length} mois</span>
                </div>
              </div>

              {/* Engagement Tourniquet */}
              <div className="p-2.5 rounded-xl border flex items-center gap-2 text-xs bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-300 font-semibold" title="Les heures de présence physique sont mesurées en temps réel par les tourniquets ZKTeco">
                <Calendar size={15} className="shrink-0 text-blue-600 dark:text-blue-400" />
                <div className="truncate">
                  <p className="truncate leading-tight">Présence & Heures</p>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">Auto Tourniquets ZKTeco 🔒</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Boutons d'action en bas */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-dark-700/60">
          <button
            type="button"
            className="btn btn-secondary text-xs py-2 px-4"
            onClick={handleClose}
            disabled={applying}
          >
            Annuler
          </button>
          
          <button
            type="button"
            className="btn btn-primary text-xs py-2 px-5 flex items-center gap-2 font-bold shadow-lg shadow-primary-500/20"
            disabled={!parsedData || applying || loading}
            onClick={handleApplyAll}
          >
            {applying ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Application en cours...
              </>
            ) : (
              <>
                <CheckCircle2 size={15} />
                Valider et remplir toute l'application
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
