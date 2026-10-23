import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, GraduationCap, Sparkles } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function TabFormations({ incubeId, formations = [], onUpdate }) {
  const [rows, setRows] = useState(formations || []);

  useEffect(() => {
    setRows(formations || []);
  }, [formations]);

  const addRow = (custom = {}) => {
    setRows([
      ...rows,
      {
        date_formation: custom.date || new Date().toISOString().split('T')[0],
        theme: custom.theme || '',
        formateur: custom.formateur || '',
        heures: custom.heures || 3.5,
        presence: custom.presence !== undefined ? custom.presence : true,
        _key: Date.now()
      }
    ]);
  };

  const updateRow = (idx, field, val) => {
    const newRows = [...rows];
    newRows[idx] = { ...newRows[idx], [field]: val };
    setRows(newRows);
  };

  const deleteRow = async (idx) => {
    const row = rows[idx];
    if (row.id) {
      try {
        await api.delete(`/formations/${row.id}`);
      } catch (e) {
        toast.error("Erreur lors de la suppression");
        return;
      }
    }
    setRows(rows.filter((_, i) => i !== idx));
    toast.success("Formation supprimée");
    if (onUpdate) onUpdate();
  };

  const saveRow = async (idx) => {
    const row = rows[idx];
    if (!row.theme || !row.theme.trim()) {
      toast.error("Le thème de la formation est requis");
      return;
    }

    try {
      let saved;
      if (row.id) {
        const res = await api.put(`/formations/${row.id}`, row);
        saved = res.data;
      } else {
        const res = await api.post('/formations', {
          ...row,
          incube_id: incubeId
        });
        saved = res.data;
      }
      toast.success('Formation enregistrée avec succès');
      if (saved && (saved.id || saved.data?.id)) {
        const updated = [...rows];
        updated[idx] = { ...updated[idx], id: saved.id || saved.data?.id };
        setRows(updated);
      }
      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'enregistrement");
    }
  };

  const PRESET_MODULES = [
    { track: 'Pré-Création', theme: '[Pré-Création] BMC – Business Model Canvas', formateur: 'M. Benjelloun', heures: 3 },
    { track: 'Pré-Création', theme: '[Pré-Création] BP – Business Plan & Faisabilité', formateur: 'Mme. Tazi', heures: 4 },
    { track: 'Pré-Création', theme: '[Pré-Création] SJ – Statut Juridique & Formalités', formateur: 'Me. Alaoui', heures: 3 },
    { track: 'Post-Création', theme: '[Post-Création] GFC – Gestion Comptable et Financière', formateur: 'M. Amrani', heures: 3.5 },
    { track: 'Post-Création', theme: '[Post-Création] MDC – Marketing et Développement Commercial', formateur: 'Coach IDS', heures: 3.5 },
    { track: 'Post-Création', theme: '[Post-Création] RH – Management & Recrutement RH', formateur: 'Consultant RH', heures: 3 },
  ];

  return (
    <div className="space-y-4 slide-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <GraduationCap size={18} className="text-emerald-500" /> Formations suivies & Assiduité
          </h2>
          <p className="text-xs text-slate-500 dark:text-dark-400 mt-0.5">
            Modules obligatoires contractuels (Pré-Création & Post-Création) comptabilisés dans l'engagement
          </p>
        </div>
        <button className="btn btn-primary btn-sm flex items-center gap-1.5" onClick={() => addRow()}>
          <Plus size={14} /> Nouvelle formation
        </button>
      </div>

      {/* Raccourcis modules officiels */}
      <div className="p-3 bg-slate-50 dark:bg-dark-800/40 rounded-xl border border-slate-200 dark:border-dark-700/60 flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-bold text-slate-500 dark:text-dark-400 flex items-center gap-1 shrink-0">
          <Sparkles size={12} className="text-emerald-500" /> Ajouter un module officiel :
        </span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {PRESET_MODULES.map((pm, i) => (
            <button
              key={i}
              type="button"
              onClick={() => addRow({ theme: pm.theme, formateur: pm.formateur, heures: pm.heures })}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all hover:scale-102 cursor-pointer ${
                pm.track === 'Post-Création'
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30 hover:bg-blue-500/20'
              }`}
              title={`Ajouter ${pm.theme} (${pm.heures}h)`}
            >
              + {pm.theme.split('–')[0].trim()} ({pm.theme.split('–')[1]?.trim()?.slice(0, 15)}...)
            </button>
          ))}
        </div>
      </div>

      <div className="card p-0 overflow-hidden border border-slate-200 dark:border-dark-700/60 shadow-md">
        <div className="table-container">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-dark-300">
                <th className="py-3 px-4 font-bold border-b border-slate-200 dark:border-dark-700/60">Date</th>
                <th className="py-3 px-4 font-bold border-b border-slate-200 dark:border-dark-700/60">Thème / Intitulé</th>
                <th className="py-3 px-4 font-bold border-b border-slate-200 dark:border-dark-700/60">Formateur</th>
                <th className="py-3 px-4 font-bold border-b border-slate-200 dark:border-dark-700/60">Durée (h)</th>
                <th className="py-3 px-4 font-bold border-b border-slate-200 dark:border-dark-700/60 text-center">Présence</th>
                <th className="py-3 px-4 font-bold border-b border-slate-200 dark:border-dark-700/60 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-dark-700/50">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-6 text-slate-400">
                    Aucune formation enregistrée. Utilisez les boutons ci-dessus pour ajouter les modules officiels.
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr key={row.id || row._key || idx} className="hover:bg-slate-50 dark:hover:bg-dark-800/40">
                    <td className="p-2">
                      <input 
                        type="date" 
                        className="input !py-1.5 !text-xs w-full"
                        value={row.date_formation || ''}
                        onChange={(e) => updateRow(idx, 'date_formation', e.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <input 
                        type="text" 
                        className="input !py-1.5 !text-xs w-full font-semibold"
                        value={row.theme || ''}
                        onChange={(e) => updateRow(idx, 'theme', e.target.value)}
                        placeholder="Thème de la formation obligatoire"
                      />
                    </td>
                    <td className="p-2">
                      <input 
                        type="text" 
                        className="input !py-1.5 !text-xs w-full"
                        value={row.formateur || ''}
                        onChange={(e) => updateRow(idx, 'formateur', e.target.value)}
                        placeholder="Nom du formateur"
                      />
                    </td>
                    <td className="p-2">
                      <input 
                        type="number" 
                        className="input !py-1.5 !text-xs w-20 font-bold"
                        value={row.heures || 0}
                        onChange={(e) => updateRow(idx, 'heures', parseFloat(e.target.value))}
                        min="0"
                        step="0.5"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          checked={row.presence === true || row.presence === 'true' || row.presence === 1}
                          onChange={(e) => updateRow(idx, 'presence', e.target.checked)}
                        />
                        <span className={`text-[10px] font-bold ${row.presence ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                          {row.presence ? 'Présent' : 'Absent'}
                        </span>
                      </label>
                    </td>
                    <td className="p-2">
                      <div className="flex justify-center gap-1.5">
                        <button className="btn btn-success btn-sm btn-icon" onClick={() => saveRow(idx)} title="Enregistrer cette formation">
                          <Save size={14} />
                        </button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => deleteRow(idx)} title="Supprimer">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
