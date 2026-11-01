import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Save, Users, FileSpreadsheet, FileDown, Radio, CheckCircle2, Briefcase } from 'lucide-react';
import api from '../../api/axios';
import ExcelImportModal from '../common/ExcelImportModal';
import SignatureModal from '../common/SignatureModal';
import { exportTableToPDF, getPDFBlobUrl } from '../../utils/pdfExport';
import toast from 'react-hot-toast';

const MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const CONTRAT_OPTS = ['CDI', 'CDD', 'Stage', 'Freelance', 'Autre'];
const TYPE_PERSONNEL_OPTS = ['Personnel permanent', 'Personnel temporaire'];

export default function TabRH({ incubeId, incube, emplois = [], personnel = [], onUpdate }) {
  const [perRows, setPerRows] = useState(personnel || []);
  const [showPersonnelModal, setShowPersonnelModal] = useState(false);
  const [showSigModalPer, setShowSigModalPer] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
  const [savingIdx, setSavingIdx] = useState(null);

  useEffect(() => {
    setPerRows(personnel || []);
  }, [personnel]);

  // --- Statistiques RH Calculées ---
  const statsRH = useMemo(() => {
    const total = perRows.length;
    const permanents = perRows.filter(r => (r.nature_contrat === 'CDI' || r.type_personnel === 'Personnel permanent')).length;
    const temporaires = perRows.filter(r => (r.nature_contrat === 'CDD' || r.nature_contrat === 'Stage' || r.type_personnel === 'Personnel temporaire')).length;
    const avecBadge = perRows.filter(r => r.badge_id && String(r.badge_id).trim() !== '').length;

    return { total, permanents, temporaires, avecBadge };
  }, [perRows]);

  // --- Fonctions Utilitaires de Normalisation ---
  const normalizeMois = (val) => {
    if (!val) return 'Janvier';
    const num = parseInt(val, 10);
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

  // --- Actions Personnel ---
  const addPer = () => {
    setPerRows([
      ...perRows,
      {
        matricule: null,
        badge_id: '',
        nom_complet: '',
        poste: '',
        nature_contrat: 'CDI',
        type_personnel: 'Personnel permanent',
        mois: 'Janvier',
        date_embauche: '',
        date_fin: '',
        salaire_mensuel: 0,
        _key: Date.now()
      }
    ]);
  };

  const updatePer = (idx, k, v) => {
    const c = [...perRows];
    c[idx] = { ...c[idx], [k]: v };
    setPerRows(c);
  };

  const deletePer = async (idx) => {
    const r = perRows[idx];
    if (r.id) {
      try {
        await api.delete(`/incubes/${incubeId}/rh-detail/${r.id}`);
        toast.success('Salarié supprimé avec succès');
      } catch (err) {
        toast.error(err.response?.data?.message || 'Erreur lors de la suppression');
        return;
      }
    }
    setPerRows(perRows.filter((_, i) => i !== idx));
    if (onUpdate) onUpdate();
  };

  const savePer = async (idx) => {
    const r = perRows[idx];
    if (!r.nom_complet || !r.nom_complet.trim()) {
      toast.error('Veuillez renseigner le nom complet du salarié');
      return;
    }

    setSavingIdx(idx);
    try {
      const payload = {
        ...r,
        date_embauche: r.date_embauche && String(r.date_embauche).trim() ? r.date_embauche : null,
        date_fin: r.date_fin && String(r.date_fin).trim() ? r.date_fin : null
      };

      let res;
      if (r.id) {
        res = await api.put(`/incubes/${incubeId}/rh-detail/${r.id}`, payload);
      } else {
        res = await api.post(`/incubes/${incubeId}/rh-detail`, payload);
      }

      if (res?.data) {
        const next = [...perRows];
        next[idx] = { ...next[idx], ...res.data };
        setPerRows(next);
      }

      const matText = res?.data?.matricule ? ` (Matricule #${res.data.matricule})` : '';
      const rfidText = res?.data?.badge_id ? ` • Badge ${res.data.badge_id} diffusé sur les 7 F18` : '';
      toast.success(`Salarié enregistré${matText}${rfidText} !`);

      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'enregistrement du salarié");
    } finally {
      setSavingIdx(null);
    }
  };

  const handleImportPersonnel = async (importedRows) => {
    try {
      const formatted = importedRows.map(r => ({
        matricule: r.matricule ? parseInt(r.matricule, 10) : null,
        badge_id: r.badge_id || r.badge || null,
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
      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'importation");
    }
  };

  const getPerExportData = () => {
    return {
      title: "Rapport : Ressources Humaines & Création d'Emplois",
      columns: [
        { header: 'Matricule', dataKey: 'matricule' },
        { header: 'Nom complet', dataKey: 'nom_complet' },
        { header: 'Badge RFID F18', dataKey: 'badge_id' },
        { header: 'Poste', dataKey: 'poste' },
        { header: 'Type Contrat', dataKey: 'nature_contrat' },
        { header: 'Type Personnel', dataKey: 'type_personnel' },
        { header: 'Mois', dataKey: 'mois' },
        { header: 'Date Embauche', dataKey: 'date_embauche' },
        { header: 'Date Fin', dataKey: 'date_fin' },
        { header: 'Salaire (MAD)', dataKey: 'salaire_mensuel' }
      ],
      data: perRows.map(r => ({
        ...r,
        matricule: r.matricule ? `#${r.matricule}` : '—',
        badge_id: r.badge_id || '—'
      }))
    };
  };

  const handleOpenSigPer = () => {
    const { title, columns, data } = getPerExportData();
    const url = getPDFBlobUrl(incube?.nom_incube || 'Startup', title, columns, data);
    setPdfPreviewUrl(url);
    setShowSigModalPer(true);
  };

  const handleExportPerPDF = (signatureImage) => {
    const { title, columns, data } = getPerExportData();
    exportTableToPDF(incube?.nom_incube || 'Startup', title, columns, data, signatureImage, `RH_Personnel_${Date.now()}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* 1. CARTES KPIS & SYNTHÈSE DES RESSOURCES HUMAINES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 border border-slate-200 dark:border-dark-700/60 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Salariés</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{statsRH.total}</p>
          </div>
          <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Users size={22} />
          </div>
        </div>

        <div className="card p-4 border border-slate-200 dark:border-dark-700/60 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Permanents (CDI)</p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{statsRH.permanents}</p>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div className="card p-4 border border-slate-200 dark:border-dark-700/60 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Temporaires / Stages</p>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{statsRH.temporaires}</p>
          </div>
          <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Briefcase size={22} />
          </div>
        </div>

        <div className="card p-4 border border-slate-200 dark:border-dark-700/60 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Badges RFID F18 Actifs</p>
            <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">{statsRH.avecBadge}</p>
          </div>
          <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <Radio size={22} />
          </div>
        </div>
      </div>

      {/* 2. TABLEAU DU PERSONNEL AVEC MATRICULE & SCAN BADGE RFID */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users size={20} className="text-primary-500" />
              <span>Staff & Collaborateurs de la Startup ({incube?.raison_sociale || incube?.nom_incube || 'Incubé'})</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-dark-400 mt-0.5">
              Chaque salarié enregistré avec son badge RFID est automatiquement diffusé sur les 7 tourniquets F18.
            </p>
          </div>

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
            <button 
              type="button"
              className="btn btn-primary btn-sm flex items-center gap-1.5 font-bold shadow-xs" 
              onClick={addPer}
            >
              <Plus size={14} /> Ajouter un salarié
            </button>
          </div>
        </div>

        <div className="card p-0 overflow-hidden border border-slate-200 dark:border-dark-700/60 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-dark-300 border-b border-slate-200 dark:border-dark-700/60 font-bold">
                  <th className="py-3 px-3 text-center w-24">Matricule</th>
                  <th className="py-3 px-3 min-w-[150px]">Nom complet</th>
                  <th className="py-3 px-3 w-36">Badge RFID (F18)</th>
                  <th className="py-3 px-3 min-w-[120px]">Poste</th>
                  <th className="py-3 px-3 w-28">Type contrat</th>
                  <th className="py-3 px-3 w-36">Type personnel</th>
                  <th className="py-3 px-3 w-28">Mois</th>
                  <th className="py-3 px-3 w-32">Date Embauche</th>
                  <th className="py-3 px-3 min-w-[130px]">Date Fin <span className="text-[10px] text-slate-400 font-normal">(optionnel)</span></th>
                  <th className="py-3 px-3 w-28">Salaire (MAD)</th>
                  <th className="py-3 px-3 text-center w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-dark-700/50">
                {perRows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-10 text-slate-400 italic">
                      Aucun personnel enregistré pour cette startup. Cliquez sur « Ajouter un salarié » ci-dessus.
                    </td>
                  </tr>
                ) : (
                  perRows.map((r, i) => {
                    const isSaving = savingIdx === i;
                    const rowBg = i % 2 === 0 ? 'bg-white dark:bg-dark-900/60' : 'bg-slate-50/60 dark:bg-dark-800/40';

                    return (
                      <tr key={r.id || r._key || i} className={`${rowBg} hover:bg-slate-100/60 dark:hover:bg-dark-700/30 transition-colors`}>
                        {/* 1. MATRICULE AUTO-ATTRIBUÉ */}
                        <td className="py-2.5 px-3 text-center font-mono">
                          {r.matricule ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-black bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              #{r.matricule}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Auto (#)</span>
                          )}
                        </td>

                        {/* 2. NOM COMPLET */}
                        <td className="py-2.5 px-3">
                          <input
                            className="input !py-1.5 !px-2.5 !text-xs w-full font-bold"
                            value={r.nom_complet || ''}
                            onChange={e => updatePer(i, 'nom_complet', e.target.value)}
                            placeholder="Nom & Prénom"
                            required
                          />
                        </td>

                        {/* 3. BADGE RFID F18 */}
                        <td className="py-2.5 px-3">
                          <input
                            className="input !py-1.5 !px-2.5 !text-xs w-full font-mono font-bold bg-amber-50/50 dark:bg-amber-950/20 border-amber-300/80 dark:border-amber-700/80 text-amber-900 dark:text-amber-200 placeholder:text-amber-400/60 focus:ring-2 focus:ring-amber-500/20"
                            value={r.badge_id || ''}
                            onChange={e => updatePer(i, 'badge_id', e.target.value)}
                            placeholder="Scan RFID (8520148)"
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                savePer(i);
                              }
                            }}
                            title="Scan au lecteur USB RFID (sauvegarde auto sur Entrée) ou saisie manuelle"
                          />
                        </td>

                        {/* 4. POSTE */}
                        <td className="py-2.5 px-3">
                          <input
                            className="input !py-1.5 !px-2.5 !text-xs w-full"
                            value={r.poste || ''}
                            onChange={e => updatePer(i, 'poste', e.target.value)}
                            placeholder="Poste occupé"
                          />
                        </td>

                        {/* 5. TYPE CONTRAT */}
                        <td className="py-2.5 px-3">
                          <select
                            className="input !py-1.5 !px-2 !text-xs w-full"
                            value={r.nature_contrat || 'CDI'}
                            onChange={e => updatePer(i, 'nature_contrat', e.target.value)}
                          >
                            {CONTRAT_OPTS.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>

                        {/* 6. TYPE PERSONNEL */}
                        <td className="py-2.5 px-3">
                          <select
                            className="input !py-1.5 !px-2 !text-xs w-full"
                            value={r.type_personnel || 'Personnel permanent'}
                            onChange={e => updatePer(i, 'type_personnel', e.target.value)}
                          >
                            {TYPE_PERSONNEL_OPTS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </td>

                        {/* 7. MOIS */}
                        <td className="py-2.5 px-3">
                          <select
                            className="input !py-1.5 !px-2 !text-xs w-full"
                            value={r.mois || 'Janvier'}
                            onChange={e => updatePer(i, 'mois', e.target.value)}
                          >
                            {MOIS.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </td>

                        {/* 8. DATE EMBAUCHE */}
                        <td className="py-2.5 px-3">
                          <input
                            type="date"
                            className="input !py-1.5 !px-2 !text-xs w-full"
                            value={r.date_embauche || ''}
                            onChange={e => updatePer(i, 'date_embauche', e.target.value)}
                          />
                        </td>

                        {/* 9. DATE FIN */}
                        <td className="py-2.5 px-3">
                          <input
                            type="date"
                            className="input !py-1.5 !px-2 !text-xs w-full"
                            value={r.date_fin || ''}
                            onChange={e => updatePer(i, 'date_fin', e.target.value)}
                          />
                        </td>

                        {/* 10. SALAIRE */}
                        <td className="py-2.5 px-3">
                          <input
                            type="number"
                            className="input !py-1.5 !px-2 !text-xs w-full text-right"
                            value={r.salaire_mensuel !== undefined ? r.salaire_mensuel : ''}
                            onChange={e => updatePer(i, 'salaire_mensuel', parseFloat(e.target.value) || 0)}
                            placeholder="0"
                          />
                        </td>

                        {/* 11. ACTIONS */}
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 hover:text-white transition-all shadow-2xs"
                              onClick={() => savePer(i)}
                              disabled={isSaving}
                              title="Enregistrer et diffuser sur les 7 Tourniquets F18"
                            >
                              <Save size={14} className={isSaving ? 'animate-spin' : ''} />
                            </button>
                            <button
                              type="button"
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-600 hover:text-white transition-all shadow-2xs"
                              onClick={() => deletePer(i)}
                              disabled={isSaving}
                              title="Supprimer ce collaborateur"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modale d'importation du personnel Excel */}
      <ExcelImportModal
        isOpen={showPersonnelModal}
        onClose={() => setShowPersonnelModal(false)}
        title="Importer les fiches de personnel (Excel)"
        description="Chargez un fichier Excel contenant la liste des collaborateurs et contrats."
        templateType="rh_personnel"
        onImport={handleImportPersonnel}
      />

      {/* Modale de Signature PDF */}
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
