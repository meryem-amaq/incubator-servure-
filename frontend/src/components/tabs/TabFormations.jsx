import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, GraduationCap } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function TabFormations({ incubeId, formations = [], onUpdate }) {
  const [rows, setRows] = useState(formations || []);

  useEffect(() => {
    setRows(formations || []);
  }, [formations]);

  const addRow = () => {
    setRows([
      ...rows,
      {
        date_formation: new Date().toISOString().split('T')[0],
        theme: '',
        formateur: '',
        heures: 0,
        presence: true,
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
        await api.delete(`/incubes/${incubeId}/formation/${row.id}`);
      } catch (e) {
        toast.error("Erreur lors de la suppression");
        return;
      }
    }
    setRows(rows.filter((_, i) => i !== idx));
    toast.success("Ligne supprimée");
  };

  const saveRow = async (idx) => {
    const row = rows[idx];
    try {
      if (row.id) {
        await api.put(`/incubes/${incubeId}/formation/${row.id}`, row);
      } else {
        await api.post(`/incubes/${incubeId}/formation`, row);
      }
      toast.success('Enregistré avec succès');
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'enregistrement");
    }
  };

  return (
    <div className="space-y-4 slide-up">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <GraduationCap size={18} className="text-emerald-500" /> Formations suivies
        </h2>
        <button className="btn btn-primary btn-sm" onClick={addRow}>
          <Plus size={14} /> Ajouter
        </button>
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
                  <td colSpan="6" className="text-center py-6 text-slate-400">Aucune formation enregistrée.</td>
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
                        className="input !py-1.5 !text-xs w-full"
                        value={row.theme || ''}
                        onChange={(e) => updateRow(idx, 'theme', e.target.value)}
                        placeholder="Thème de la formation"
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
                        className="input !py-1.5 !text-xs w-20"
                        value={row.heures || 0}
                        onChange={(e) => updateRow(idx, 'heures', parseFloat(e.target.value))}
                        min="0"
                        step="0.5"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <label className="inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-slate-300 text-primary-500 focus:ring-primary-500"
                          checked={row.presence}
                          onChange={(e) => updateRow(idx, 'presence', e.target.checked)}
                        />
                      </label>
                    </td>
                    <td className="p-2">
                      <div className="flex justify-center gap-1.5">
                        <button className="btn btn-success btn-sm btn-icon" onClick={() => saveRow(idx)} title="Enregistrer">
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
