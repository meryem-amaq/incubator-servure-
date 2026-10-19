import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Users, UserPlus, FileSpreadsheet, FileDown } from 'lucide-react';
import api from '../../api/axios';
import ExcelImportModal from '../common/ExcelImportModal';
import SignatureModal from '../common/SignatureModal';
import { exportTableToPDF, getPDFBlobUrl } from '../../utils/pdfExport';
import toast from 'react-hot-toast';

const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const CONTRAT_OPTS = ['CDI', 'CDD', 'Stage', 'Freelance', 'Autre'];
const TYPE_PERSONNEL_OPTS = ['Personnel permanent', 'Personnel temporaire'];

export default function TabRH({ incubeId, incube, emplois, personnel, onUpdate }) {
  const [perRows, setPerRows] = useState(personnel);
  const [showPersonnelModal, setShowPersonnelModal] = useState(false);
  const [showSigModalPer, setShowSigModalPer] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);

  useEffect(() => {
    setPerRows(personnel);
  }, [personnel]);

  // --- Fonctions Utilitaires ---
  const normalizeMois = (val) => {
    if (!val) return 'Janvier';
    const num = parseInt(val);
    if (!isNaN(num) && num >= 1 && num <= 12) return MOIS[num - 1];
    const str = String(val).trim().toLowerCase();
    const found = MOIS.find(m => m.toLowerCase() === str);
    return found || 'Janvier';
  };

  const normalizeContrat = (val) => {
    if (!val) return 'CDI';
    const str = String(val).trim().toUpperCase();
    const found = CONTRAT_OPTS.find(c => c.toUpperCase() === str);
    return found || 'CDI';
  };

  const normalizeTypePersonnel = (val) => {
    if (!val) return 'Personnel permanent';
    const str = String(val).trim().toLowerCase();
    if (str.includes('temp')) return 'Personnel temporaire';
    return 'Personnel permanent';
  };

  // --- Personnel Unifié ---
  const addPer = () => setPerRows([...perRows, { mois: 'Janvier', type_personnel: 'Personnel permanent', nom_complet: '', poste: '', nature_contrat: 'CDI', date_embauche: '', date_fin: '', salaire_mensuel: 0, _key: Date.now() }]);
  const updatePer = (idx, k, v) => { const c = [...perRows]; c[idx] = { ...c[idx], [k]: v }; setPerRows(c); };
  
  const handleImportPersonnel = async (importedRows) => {
    try {
      const formatted = importedRows.map(r => ({
        mois: normalizeMois(r.mois),
        type_personnel: normalizeTypePersonnel(r.type_personnel),
        nom_complet: r.nom_complet || '',
        poste: r.poste || '',
        nature_contrat: normalizeContrat(r.nature_contrat),
        date_embauche: r.date_embauche || null,
        date_fin: r.date_fin || null,
        salaire_mensuel: parseFloat(r.salaire_mensuel) || 0,
      }));
      try {
        await api.post(`/incubes/${incubeId}/rh-detail/bulk`, formatted);
      } catch (bulkErr) {
        if (bulkErr.response?.status === 404) {
          for (const item of formatted) {
            await api.post(`/incubes/${incubeId}/rh-detail`, item);
          }
        } else {
          throw bulkErr;
        }
      }
      toast.success(`${formatted.length} membre(s) du personnel importé(s) avec succès !`);
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'importation");
    }
  };

  const deletePer = async (idx) => {
    const r = perRows[idx];
    if (r.id) { try { await api.delete(`/incubes/${incubeId}/rh-detail/${r.id}`); } catch {} }
    setPerRows(perRows.filter((_, i) => i !== idx));
  };
  const savePer = async (idx) => {
    const r = perRows[idx];
    try {
      if (r.id) await api.put(`/incubes/${incubeId}/rh-detail/${r.id}`, r);
      else await api.post(`/incubes/${incubeId}/rh-detail`, r);
      toast.success('Enregistré'); onUpdate();
    } catch (err) { toast.error(err.response?.data?.message || "Erreur lors de l'enregistrement"); }
  };

  const getPerExportData = () => {
    return {
      title: "Rapport : Création d'Emplois",
      columns: [
        { header: 'Mois', dataKey: 'mois' },
        { header: 'Type', dataKey: 'type_personnel' },
        { header: 'Nom complet', dataKey: 'nom_complet' },
        { header: 'Poste', dataKey: 'poste' },
        { header: 'Contrat', dataKey: 'nature_contrat' },
        { header: 'Embauche', dataKey: 'date_embauche' },
        { header: 'Fin', dataKey: 'date_fin' },
        { header: 'Salaire', dataKey: 'salaire_mensuel' }
      ],
      data: perRows
    };
  };

  const handleOpenSigPer = () => {
    const { title, columns, data } = getPerExportData();
    const url = getPDFBlobUrl(incube?.nom_incube, title, columns, data);
    setPdfPreviewUrl(url);
    setShowSigModalPer(true);
  };

  const handleExportPerPDF = (signatureImage) => {
    const { title, columns, data } = getPerExportData();
    exportTableToPDF(incube?.nom_incube, title, columns, data, signatureImage, `RH_Personnel_${Date.now()}.pdf`);
  };

  return (
    <div className="space-y-8">
      {/* Section 1 : Création d'emplois unifiée */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><Users size={18} /> Création d'emplois</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-secondary btn-sm flex items-center gap-1.5 border-red-500/40 text-red-700 dark:text-red-400 hover:bg-red-500/10 font-semibold"
              onClick={handleOpenSigPer}
            >
              <FileDown size={14} className="text-red-500" />
              Exporter PDF
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm flex items-center gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 font-semibold"
              onClick={() => setShowPersonnelModal(true)}
            >
              <FileSpreadsheet size={14} className="text-emerald-500" />
              Importer Excel
            </button>
            <button className="btn btn-primary btn-sm" onClick={addPer}><Plus size={14} /> Ajouter</button>
          </div>
        </div>
        <div className="card p-0">
          <div className="table-container">
            <table>
              <thead><tr><th>Mois</th><th>Type de personnel</th><th>Nom complet</th><th>Poste</th><th>Type contrat</th><th>Embauche</th><th>Fin</th><th>Salaire (MAD)</th><th>Actions</th></tr></thead>
              <tbody>
                {perRows.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-8 text-slate-400 dark:text-dark-400">Aucun personnel enregistré</td></tr>
                ) : perRows.map((r, i) => (
                  <tr key={r.id || r._key || i}>
                    <td><select className="input !py-1.5 !text-xs !w-24" value={r.mois || 'Janvier'} onChange={e => updatePer(i, 'mois', e.target.value)}>{MOIS.map(m => <option key={m}>{m}</option>)}</select></td>
                    <td><select className="input !py-1.5 !text-xs !w-40" value={r.type_personnel || 'Personnel permanent'} onChange={e => updatePer(i, 'type_personnel', e.target.value)}>{TYPE_PERSONNEL_OPTS.map(t => <option key={t}>{t}</option>)}</select></td>
                    <td><input className="input !py-1.5 !text-xs !w-32" value={r.nom_complet || ''} onChange={e => updatePer(i, 'nom_complet', e.target.value)} placeholder="Nom & Prénom" /></td>
                    <td><input className="input !py-1.5 !text-xs !w-28" value={r.poste || ''} onChange={e => updatePer(i, 'poste', e.target.value)} /></td>
                    <td><select className="input !py-1.5 !text-xs !w-24" value={r.nature_contrat || 'CDI'} onChange={e => updatePer(i, 'nature_contrat', e.target.value)}>{CONTRAT_OPTS.map(c => <option key={c}>{c}</option>)}</select></td>
                    <td><input type="date" className="input !py-1.5 !text-xs !w-32" value={r.date_embauche || ''} onChange={e => updatePer(i, 'date_embauche', e.target.value)} /></td>
                    <td><input type="date" className="input !py-1.5 !text-xs !w-32" value={r.date_fin || ''} onChange={e => updatePer(i, 'date_fin', e.target.value)} /></td>
                    <td><input type="number" className="input !py-1.5 !text-xs !w-20" value={r.salaire_mensuel || ''} onChange={e => updatePer(i, 'salaire_mensuel', parseFloat(e.target.value))} /></td>
                    <td><div className="flex gap-1"><button className="btn btn-success btn-sm btn-icon" onClick={() => savePer(i)}><Save size={13} /></button><button className="btn btn-danger btn-sm btn-icon" onClick={() => deletePer(i)}><Trash2 size={13} /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modale d'importation du personnel */}
      <ExcelImportModal
        isOpen={showPersonnelModal}
        onClose={() => setShowPersonnelModal(false)}
        title="Importer les fiches de personnel (Excel)"
        description="Chargez un fichier Excel contenant la liste des collaborateurs et contrats."
        templateType="rh_personnel"
        onImport={handleImportPersonnel}
      />



      <SignatureModal 
        isOpen={showSigModalPer} 
        onClose={() => setShowSigModalPer(false)}
        onValidate={handleExportPerPDF}
        title="Signature - Création d'Emplois"
        pdfPreviewUrl={pdfPreviewUrl}
      />
    </div>
  );
}
