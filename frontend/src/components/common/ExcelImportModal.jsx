import { useState } from 'react';
import { Upload, FileSpreadsheet, Download, CheckCircle, AlertCircle, X, Loader2 } from 'lucide-react';
import { readExcelFile, mapExcelRows, downloadTemplate } from '../../utils/excelHelper';
import toast from 'react-hot-toast';

export default function ExcelImportModal({
  isOpen,
  onClose,
  title = "Importer un fichier Excel",
  description = "Importez un fichier Excel (.xlsx, .xls ou .csv) pour remplir automatiquement les données.",
  templateType = 'incube',
  onImport,
  fillSingle = false // si true, extrait la 1ère ligne pour remplir un formulaire unitaire
}) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewRows, setPreviewRows] = useState([]);
  const [dragOver, setDragOver] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = async (selectedFile) => {
    if (!selectedFile) return;
    if (!selectedFile.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error('Format de fichier invalide. Veuillez choisir un fichier .xlsx, .xls ou .csv');
      return;
    }

    setFile(selectedFile);
    setLoading(true);
    try {
      const rawRows = await readExcelFile(selectedFile, templateType);
      if (!rawRows || rawRows.length === 0) {
        toast.error('Le fichier Excel semble vide ou ne contient aucune donnée.');
        setPreviewRows([]);
        return;
      }

      const mapped = mapExcelRows(rawRows, templateType);
      setPreviewRows(mapped);
      toast.success(`${mapped.length} ligne(s) détectée(s) avec succès dans Excel`);
    } catch (err) {
      toast.error(err.message || 'Erreur lors de la lecture du fichier Excel');
      setFile(null);
      setPreviewRows([]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (previewRows.length === 0) {
      toast.error('Aucune donnée à importer.');
      return;
    }

    setLoading(true);
    try {
      if (fillSingle) {
        // Envoie la première ligne pour remplir les champs d'un formulaire unitaire
        await onImport(previewRows[0]);
      } else {
        // Envoie la liste complète des lignes
        await onImport(previewRows);
      }
      onClose();
      setFile(null);
      setPreviewRows([]);
    } catch (err) {
      toast.error(err.message || "Erreur lors de l'application des données");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await downloadTemplate(templateType);
      toast.success('Modèle Excel téléchargé !');
    } catch (err) {
      toast.error('Erreur lors de la génération du modèle Excel');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal slide-up max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header flex items-center justify-between border-b border-slate-200 dark:border-dark-700/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">{title}</h3>
              <p className="text-xs text-slate-500 dark:text-dark-400 mt-0.5">{description}</p>
            </div>
          </div>
          <button className="btn btn-secondary btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Body */}
        <div className="modal-body space-y-4 py-4">
          {/* 1. Zone d'importation principale (Drag & Drop / Sélecteur) */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files?.[0]) handleFileChange(e.dataTransfer.files[0]);
            }}
            className={`relative border-2 border-dashed rounded-2xl p-7 text-center transition-all cursor-pointer ${
              dragOver
                ? 'border-emerald-500 bg-emerald-500/10 scale-[0.99]'
                : file
                ? 'border-emerald-500/80 bg-emerald-500/5 dark:bg-emerald-950/20'
                : 'border-slate-300 dark:border-dark-700 hover:border-emerald-500 bg-slate-50/60 dark:bg-dark-800/40'
            }`}
          >
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFileChange(e.target.files[0]);
              }}
            />
            <div className="flex flex-col items-center justify-center gap-2.5">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner">
                <Upload size={26} />
              </div>
              <div>
                <p className="text-base font-bold text-slate-800 dark:text-white">
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
            </div>
          </div>

          {/* Lien discret pour modèle exemple facultatif */}
          <div className="flex items-center justify-between text-xs px-1 text-slate-400 dark:text-dark-400">
            <span>Formats acceptés : Excel (.xlsx, .xls) ou CSV</span>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="text-primary-500 hover:underline inline-flex items-center gap-1"
            >
              <Download size={12} /> Exemple de fichier (.xlsx)
            </button>
          </div>

          {/* Aperçu des données extraites */}
          {previewRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-dark-300 flex items-center gap-1.5">
                  <CheckCircle size={14} className="text-emerald-500" />
                  Aperçu des données ({previewRows.length} {previewRows.length > 1 ? 'lignes détectées' : 'ligne détectée'})
                </span>
                {fillSingle && previewRows.length > 1 && (
                  <span className="text-[11px] text-amber-500 font-medium">
                    (Seule la 1ère ligne sera utilisée pour remplir ce formulaire)
                  </span>
                )}
              </div>

              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-dark-700/80 bg-white dark:bg-dark-900 shadow-inner">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-dark-400 border-b border-slate-200 dark:border-dark-700">
                      {Object.keys(previewRows[0]).slice(0, 5).map((col) => (
                        <th key={col} className="p-2 font-semibold capitalize whitespace-nowrap">
                          {col.replace(/_/g, ' ')}
                        </th>
                      ))}
                      {Object.keys(previewRows[0]).length > 5 && (
                        <th className="p-2 font-semibold text-slate-400">...</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.slice(0, 5).map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-100 dark:border-dark-800/60 hover:bg-slate-50 dark:hover:bg-dark-800/40">
                        {Object.values(row).slice(0, 5).map((val, cIdx) => (
                          <td key={cIdx} className="p-2 text-slate-700 dark:text-dark-300 truncate max-w-[150px]">
                            {String(val || '—')}
                          </td>
                        ))}
                        {Object.keys(row).length > 5 && (
                          <td className="p-2 text-slate-400">...</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer flex items-center justify-end gap-2 border-t border-slate-200 dark:border-dark-700/60 pt-4">
          <button type="button" className="btn btn-secondary text-xs" onClick={onClose} disabled={loading}>
            Annuler
          </button>
          <button
            type="button"
            className="btn btn-primary text-xs flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 border-emerald-500 font-bold shadow-md shadow-emerald-500/20"
            onClick={handleConfirm}
            disabled={loading || previewRows.length === 0}
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Importation en cours...
              </>
            ) : (
              <>
                <FileSpreadsheet size={15} />
                {fillSingle 
                  ? "Importer et remplir les champs" 
                  : `Importer dans l'application (${previewRows.length} lignes)`}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
