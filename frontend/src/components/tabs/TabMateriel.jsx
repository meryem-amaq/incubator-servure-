import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, FileSpreadsheet, Filter, FileDown, Maximize2, X } from 'lucide-react';
import api from '../../api/axios';
import ExcelImportModal from '../common/ExcelImportModal';
import SignatureModal from '../common/SignatureModal';
import { exportTableToPDF, getPDFBlobUrl } from '../../utils/pdfExport';
import toast from 'react-hot-toast';

export default function TabMateriel({ incubeId, incube, data, onUpdate }) {
  const [rows, setRows] = useState(data.length ? data : []);
  const [filterType, setFilterType] = useState('all'); // 'all', 'ids', 'propre'
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [showSigModal, setShowSigModal] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
  const [textModal, setTextModal] = useState({ open: false, title: '', text: '', rowIdx: null, field: '', disabled: false });
  const blank = { type_origine: 'propre', secteur_action: '', article: '', numero_serie: '', date_acquisition_reception: '', caracteristiques_serie: '', quantite: 1, valeur: '', etat: '' };

  useEffect(() => {
    setRows(data.length ? data : []);
  }, [data]);

  const addRow = () => setRows([...rows, { ...blank, _new: true, _key: Date.now() }]);

  const displayedRows = rows
    .map((row, originalIndex) => ({ ...row, _origIdx: originalIndex }))
    .filter(r => {
      if (filterType === 'ids') return r.type_origine === 'ids';
      if (filterType === 'propre') return r.type_origine === 'propre';
      return true;
    });

  const handleImportExcel = async (importedRows) => {
    try {
      const formatted = importedRows.map(r => ({
        type_origine: (r.type_origine && String(r.type_origine).toLowerCase().includes('ids')) ? 'ids' : 'propre',
        secteur_action: r.secteur_action || '',
        article: r.article || '',
        numero_serie: r.numero_serie || r.noserie || r.nserie || '',
        date_acquisition_reception: r.date_acquisition_reception || null,
        caracteristiques_serie: r.caracteristiques_serie || '',
        quantite: parseInt(r.quantite) || 1,
        valeur: r.valeur || '',
        etat: r.etat || '',
      }));
      try {
        await api.post(`/incubes/${incubeId}/materiel/bulk`, formatted);
      } catch (bulkErr) {
        if (bulkErr.response?.status === 404) {
          for (const item of formatted) {
            await api.post(`/incubes/${incubeId}/materiel`, item);
          }
        } else {
          throw bulkErr;
        }
      }
      toast.success(`${formatted.length} matériel(s) importé(s) avec succès !`);
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'importation");
    }
  };

  const updateRow = (idx, k, v) => {
    const copy = [...rows];
    copy[idx] = { ...copy[idx], [k]: v };
    setRows(copy);
  };

  const deleteRow = async (idx) => {
    const row = rows[idx];
    if (row.id) {
      try { await api.delete(`/incubes/${incubeId}/materiel/${row.id}`); toast.success('Supprimé'); onUpdate(); }
      catch { toast.error('Erreur'); }
    }
    setRows(rows.filter((_, i) => i !== idx));
  };

  const saveRow = async (idx) => {
    const row = rows[idx];

    if (!row.article || !row.article.trim()) {
      toast.error("Veuillez renseigner le nom de l'article !");
      return;
    }

    // Vérifier l'unicité du numéro de série dans le tableau
    if (row.numero_serie && String(row.numero_serie).trim()) {
      const targetSerial = String(row.numero_serie).trim().toLowerCase();
      const duplicate = rows.find((r, i) => i !== idx && r.numero_serie && String(r.numero_serie).trim().toLowerCase() === targetSerial);
      if (duplicate) {
        toast.error(`Le numéro de série "${row.numero_serie.trim()}" est déjà utilisé pour l'article "${duplicate.article || 'Matériel'}". Chaque matériel doit avoir un numéro de série unique.`);
        return;
      }
    }

    const payload = {
      type_origine: row.type_origine || 'propre',
      secteur_action: row.secteur_action && row.secteur_action.trim() ? row.secteur_action.trim() : null,
      article: row.article.trim(),
      numero_serie: row.numero_serie && row.numero_serie.trim() ? row.numero_serie.trim() : null,
      date_acquisition_reception: row.date_acquisition_reception || null,
      caracteristiques_serie: row.caracteristiques_serie && row.caracteristiques_serie.trim() ? row.caracteristiques_serie.trim() : null,
      quantite: parseInt(row.quantite, 10) || 1,
      valeur: row.valeur && row.valeur.trim() ? row.valeur.trim() : null,
      etat: row.etat && row.etat.trim() ? row.etat.trim() : null
    };

    try {
      if (row.id) {
        await api.put(`/incubes/${incubeId}/materiel/${row.id}`, payload);
      } else {
        await api.post(`/incubes/${incubeId}/materiel`, payload);
      }
      toast.success('Matériel enregistré avec succès !');
      onUpdate();
    } catch (err) { toast.error(err.response?.data?.message || "Erreur lors de l'enregistrement"); }
  };

  const getExportData = () => {
    return {
      title: "Rapport : Gestion du Matériel",
      columns: [
        { header: 'Origine', dataKey: 'type_origine' },
        { header: 'Catégorie', dataKey: 'secteur_action' },
        { header: 'Article', dataKey: 'article' },
        { header: 'N° de Série', dataKey: 'numero_serie' },
        { header: 'Date acq.', dataKey: 'date_acquisition_reception' },
        { header: 'Caractéristiques', dataKey: 'caracteristiques_serie' },
        { header: 'Qté', dataKey: 'quantite' },
        { header: 'Valeur', dataKey: 'valeur' },
        { header: 'État', dataKey: 'etat' }
      ],
      data: displayedRows
    };
  };

  const handleOpenSignature = () => {
    const { title, columns, data } = getExportData();
    const url = getPDFBlobUrl(incube?.nom_incube, title, columns, data);
    setPdfPreviewUrl(url);
    setShowSigModal(true);
  };

  const handleExportPDF = (signatureImage) => {
    const { title, columns, data } = getExportData();
    exportTableToPDF(incube?.nom_incube, title, columns, data, signatureImage, `Gestion_Materiel_${Date.now()}.pdf`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Gestion du Matériel</h2>
          
          {/* 🏷️ FILTRE PAR PROPRIÉTÉ MATÉRIEL (IDS vs PROPRE) */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-dark-800 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                filterType === 'all' ? 'bg-white dark:bg-dark-900 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-slate-500'
              }`}
            >
              Tous ({rows.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('ids')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                filterType === 'ids' ? 'bg-white dark:bg-dark-900 text-amber-600 dark:text-amber-400 shadow-sm' : 'text-slate-500'
              }`}
            >
              Matériel IDS ({rows.filter(r => r.type_origine === 'ids').length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('propre')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                filterType === 'propre' ? 'bg-white dark:bg-dark-900 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500'
              }`}
            >
              Matériel Propre ({rows.filter(r => r.type_origine === 'propre').length})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary btn-sm flex items-center gap-1.5 border-red-500/40 text-red-700 dark:text-red-400 hover:bg-red-500/10 font-semibold"
            onClick={handleOpenSignature}
          >
            <FileDown size={14} className="text-red-500" />
            Exporter PDF
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm flex items-center gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 font-semibold"
            onClick={() => setShowExcelModal(true)}
          >
            <FileSpreadsheet size={14} className="text-emerald-500" />
            Importer Excel
          </button>
          <button className="btn btn-primary btn-sm" onClick={addRow}>
            <Plus size={14} /> Ajouter une ligne
          </button>
        </div>
      </div>
      <div className="card p-0">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Origine</th><th>Catégorie</th><th>Article</th><th>N° de Série</th><th>Date acq.</th><th>Caractéristiques</th><th>Qté</th><th>Valeur</th><th>État</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedRows.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-slate-400 dark:text-dark-400">Aucun matériel trouvé pour ce filtre.</td></tr>
              ) : displayedRows.map((row) => (
                <tr key={row.id || row._key || row._origIdx}>
                  <td>
                    <select className="input !py-1.5 !text-xs" value={row.type_origine} onChange={e => updateRow(row._origIdx, 'type_origine', e.target.value)}>
                      <option value="propre">Propre</option>
                      <option value="ids">IDS</option>
                    </select>
                  </td>
                  <td>
                    <input list="secteurs_action" className="input !py-1.5 !text-xs" value={row.secteur_action || ''} onChange={e => updateRow(row._origIdx, 'secteur_action', e.target.value)} placeholder="Catégorie..." />
                    <datalist id="secteurs_action">
                      <option value="Audiovisuel" />
                      <option value="Informatique" />
                    </datalist>
                  </td>
                  <td>
                    <div className="relative group">
                      <input className="input !py-1.5 !text-xs pr-7" value={row.article || ''} onChange={e => updateRow(row._origIdx, 'article', e.target.value)} placeholder="Nom de l'article" />
                      <button 
                        type="button"
                        onClick={() => setTextModal({ open: true, title: "Nom de l'article", text: row.article || '', rowIdx: row._origIdx, field: 'article', disabled: false })}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="Agrandir et voir tout"
                      >
                        <Maximize2 size={12} />
                      </button>
                    </div>
                  </td>
                  <td>
                    <div className="relative group">
                      <input className="input !py-1.5 !text-xs font-mono pr-7" value={row.numero_serie || ''} onChange={e => updateRow(row._origIdx, 'numero_serie', e.target.value)} placeholder="SN-..." />
                      <button 
                        type="button"
                        onClick={() => setTextModal({ open: true, title: "Numéro de série", text: row.numero_serie || '', rowIdx: row._origIdx, field: 'numero_serie', disabled: false })}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="Agrandir et voir tout"
                      >
                        <Maximize2 size={12} />
                      </button>
                    </div>
                  </td>
                  <td><input type="date" className="input !py-1.5 !text-xs" value={row.date_acquisition_reception || ''} onChange={e => updateRow(row._origIdx, 'date_acquisition_reception', e.target.value)} /></td>
                  <td>
                    <div className="relative group">
                      <input className="input !py-1.5 !text-xs pr-7" value={row.caracteristiques_serie || ''} onChange={e => updateRow(row._origIdx, 'caracteristiques_serie', e.target.value)} placeholder="Spécifications, modèle..." />
                      <button 
                        type="button"
                        onClick={() => setTextModal({ open: true, title: "Caractéristiques", text: row.caracteristiques_serie || '', rowIdx: row._origIdx, field: 'caracteristiques_serie', disabled: false })}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="Agrandir et voir tout"
                      >
                        <Maximize2 size={12} />
                      </button>
                    </div>
                  </td>
                  <td><input type="number" className="input !py-1.5 !text-xs !w-16" value={row.quantite || 1} onChange={e => updateRow(row._origIdx, 'quantite', parseInt(e.target.value))} min={1} /></td>
                  <td><input className="input !py-1.5 !text-xs w-20" value={row.valeur || ''} onChange={e => updateRow(row._origIdx, 'valeur', e.target.value)} placeholder="Ex: 5000" /></td>
                  <td>
                    <div className="relative group">
                      <input className="input !py-1.5 !text-xs w-24 pr-7" value={row.etat || ''} onChange={e => updateRow(row._origIdx, 'etat', e.target.value)} placeholder="Ex: Neuf" />
                      <button 
                        type="button"
                        onClick={() => setTextModal({ open: true, title: "État", text: row.etat || '', rowIdx: row._origIdx, field: 'etat', disabled: false })}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="Agrandir et voir tout"
                      >
                        <Maximize2 size={12} />
                      </button>
                    </div>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn btn-success btn-sm btn-icon" onClick={() => saveRow(row._origIdx)} title="Enregistrer"><Save size={13} /></button>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => deleteRow(row._origIdx)} title="Supprimer"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modale d'importation de matériel */}
      <ExcelImportModal
        isOpen={showExcelModal}
        onClose={() => setShowExcelModal(false)}
        title="Importer la liste du matériel (Excel)"
        description="Chargez un fichier Excel pour importer des articles matériels (propres ou IDS)."
        templateType="materiel"
        onImport={handleImportExcel}
      />

      <SignatureModal 
        isOpen={showSigModal} 
        onClose={() => setShowSigModal(false)}
        onValidate={handleExportPDF}
        title="Signature du Matériel"
        pdfPreviewUrl={pdfPreviewUrl}
      />

      {/* Modale d'agrandissement de texte */}
      {textModal.open && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-900 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden border border-slate-200 dark:border-dark-700">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-dark-800 bg-slate-50 dark:bg-dark-800/50">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Maximize2 size={18} className="text-primary-500" />
                {textModal.title}
              </h3>
              <button
                onClick={() => setTextModal({ open: false, title: '', text: '', rowIdx: null, field: '', disabled: false })}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 dark:hover:text-white dark:hover:bg-dark-700 transition-colors"
                title="Fermer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5">
              <textarea
                className={`input w-full min-h-[150px] resize-y p-3 ${textModal.disabled ? 'bg-slate-50 dark:bg-dark-800 opacity-70 cursor-not-allowed' : ''}`}
                value={textModal.text}
                onChange={e => setTextModal({ ...textModal, text: e.target.value })}
                readOnly={textModal.disabled}
                autoFocus
                placeholder="Saisissez le texte ici..."
              />
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-100 dark:border-dark-800">
              <button
                type="button"
                className="btn btn-secondary text-sm"
                onClick={() => setTextModal({ open: false, title: '', text: '', rowIdx: null, field: '', disabled: false })}
              >
                {textModal.disabled ? 'Fermer' : 'Annuler'}
              </button>
              {!textModal.disabled && (
                <button
                  type="button"
                  className="btn btn-primary text-sm font-bold flex items-center gap-2"
                  onClick={() => {
                    updateRow(textModal.rowIdx, textModal.field, textModal.text);
                    setTextModal({ open: false, title: '', text: '', rowIdx: null, field: '', disabled: false });
                  }}
                >
                  <Save size={16} /> Appliquer
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
