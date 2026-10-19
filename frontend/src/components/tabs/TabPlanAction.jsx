import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, FileSpreadsheet, CheckCircle2, Clock, Lock, Calendar, FileDown, Maximize2, X } from 'lucide-react';
import api from '../../api/axios';
import ExcelImportModal from '../common/ExcelImportModal';
import SignatureModal from '../common/SignatureModal';
import { exportTableToPDF, getPDFBlobUrl } from '../../utils/pdfExport';
import toast from 'react-hot-toast';

const MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const getRemainingDays = (dateStr) => {
  if (!dateStr) return null;
  const due = new Date(dateStr);
  const now = new Date();
  due.setHours(0,0,0,0);
  now.setHours(0,0,0,0);
  const diffTime = due - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const parseDayAndMonth = (val) => {
  const today = new Date();
  const defDay = today.getDate();
  const defMonth = MOIS[today.getMonth()];

  if (!val) return { day: defDay, month: defMonth };

  const str = String(val).trim();

  // Format ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const parts = str.split('-');
    const mIdx = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return {
      day: isNaN(d) ? defDay : d,
      month: MOIS[mIdx] || defMonth,
    };
  }

  // Format "16 Septembre" ou "16 Septembre 2026"
  const match = str.match(/^(\d{1,2})\s+([A-Za-zÀ-ÿ]+)/);
  if (match) {
    const d = parseInt(match[1], 10);
    const mRaw = match[2];
    const foundM = MOIS.find(m => m.toLowerCase() === mRaw.toLowerCase());
    return {
      day: isNaN(d) ? defDay : d,
      month: foundM || mRaw,
    };
  }

  // Format simple "Janvier"
  const foundOnlyM = MOIS.find(m => m.toLowerCase() === str.toLowerCase());
  if (foundOnlyM) {
    return { day: 1, month: foundOnlyM };
  }

  return { day: defDay, month: defMonth };
};

export default function TabPlanAction({ incubeId, incube, data, onUpdate }) {
  const [rows, setRows] = useState(data.length ? data : []);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [showSigModal, setShowSigModal] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
  const [textModal, setTextModal] = useState({ open: false, title: '', text: '', rowIdx: null, field: '', disabled: false });
  const [rdvs, setRdvs] = useState([]);

  const today = new Date();
  const blank = {
    mois: `${today.getDate()} ${MOIS[today.getMonth()]}`,
    objectifs: '',
    date_debut: '',
    echeance: '',
    realisation: 'En cours',
    problemes_rencontres: '',
    commentaires: '',
    rendezvous_id: '',
  };

  useEffect(() => {
    setRows(data.length ? data : []);
  }, [data]);

  useEffect(() => {
    api.get('/rendezvous').then(res => {
      const myRdvs = res.data.filter(r => {
        try {
          let ids = r.incubeIds;
          if (typeof ids === 'string') ids = JSON.parse(ids);
          return Array.isArray(ids) && (ids.includes(incubeId) || ids.includes(String(incubeId)));
        } catch(e) {
          return String(r.incubeIds).includes(String(incubeId));
        }
      });
      setRdvs(myRdvs);
    }).catch(e => console.error("Erreur chargement RDVs", e));
  }, [incubeId]);

  const addRow = () => setRows([...rows, { ...blank, _key: Date.now() }]);
  const updateRow = (idx, k, v) => {
    const c = [...rows];
    c[idx] = { ...c[idx], [k]: v };
    setRows(c);
  };

  const handleDayChange = (idx, newDay) => {
    const current = parseDayAndMonth(rows[idx]?.mois);
    const combined = `${newDay} ${current.month}`;
    updateRow(idx, 'mois', combined);
  };

  const handleMonthChange = (idx, newMonth) => {
    const current = parseDayAndMonth(rows[idx]?.mois);
    const combined = `${current.day} ${newMonth}`;
    updateRow(idx, 'mois', combined);
  };

  const handleImportExcel = async (importedRows) => {
    try {
      const todayStr = `${new Date().getDate()} ${MOIS[new Date().getMonth()]}`;
      const formatted = importedRows.map(r => {
        const parsed = parseDayAndMonth(r.mois);
        return {
          mois: `${parsed.day} ${parsed.month}`,
          objectifs: r.objectifs || '',
          date_debut: r.date_debut || null,
          echeance: r.echeance || null,
          realisation: r.realisation || 'En cours',
          problemes_rencontres: r.problemes_rencontres || '',
          commentaires: r.commentaires || '',
        };
      });

      try {
        await api.post(`/incubes/${incubeId}/plan-action/bulk`, formatted);
      } catch (bulkErr) {
        if (bulkErr.response?.status === 404) {
          for (const item of formatted) {
            await api.post(`/incubes/${incubeId}/plan-action`, item);
          }
        } else {
          throw bulkErr;
        }
      }
      toast.success(`${formatted.length} action(s) importée(s) avec succès !`);
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'importation");
    }
  };

  const deleteRow = async (idx) => {
    const r = rows[idx];
    if (r.id) {
      try {
        await api.delete(`/incubes/${incubeId}/plan-action/${r.id}`);
        toast.success('Action supprimée');
        onUpdate();
      } catch (err) {
        toast.error(err.response?.data?.message || 'Erreur lors de la suppression');
        return;
      }
    }
    setRows(rows.filter((_, i) => i !== idx));
  };

  const saveRow = async (idx) => {
    const r = rows[idx];
    const dataToSave = { ...r };
    if (!dataToSave.rendezvous_id) dataToSave.rendezvous_id = null;
    
    try {
      if (r.id) await api.put(`/incubes/${incubeId}/plan-action/${r.id}`, dataToSave);
      else await api.post(`/incubes/${incubeId}/plan-action`, dataToSave);
      toast.success('Objectif enregistré avec succès');
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'enregistrement");
    }
  };

  // Changement de statut (Atteint, En cours, Non atteint)
  // Lorsque Atteint est activé, la ligne se verrouille automatiquement
  const handleStatusChange = async (idx, newStatus) => {
    const r = rows[idx];
    if (r.realisation === newStatus) return;

    const updated = { ...r, realisation: newStatus };
    const c = [...rows];
    c[idx] = updated;
    setRows(c);

    try {
      if (r.id) {
        await api.put(`/incubes/${incubeId}/plan-action/${r.id}`, updated);
      } else {
        const res = await api.post(`/incubes/${incubeId}/plan-action`, updated);
        c[idx] = res.data;
        setRows(c);
      }
      if (newStatus === 'Atteint' || newStatus === 'Effectué' || newStatus === 'Validé') {
        toast.success("Objectif marqué 'Atteint' et validé !", { icon: '✅' });
      } else if (newStatus === 'En cours' || newStatus === 'À jour') {
        toast.success("Objectif marqué 'En cours' (décompte actif)", { icon: '🔔' });
      } else {
        toast.success("Objectif marqué 'Non atteint'", { icon: '❌' });
      }
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la mise à jour");
    }
  };

  const getExportData = () => {
    return {
      title: "Rapport : Plan d'Action & Suivi des Objectifs",
      columns: [
        { header: 'Mois', dataKey: 'mois' },
        { header: 'Objectif', dataKey: 'objectifs' },
        { header: 'Début', dataKey: 'date_debut' },
        { header: 'Échéance', dataKey: 'echeance' },
        { header: 'Problèmes', dataKey: 'problemes_rencontres' },
        { header: 'Commentaires', dataKey: 'commentaires' },
        { header: 'Statut', dataKey: 'realisation' }
      ],
      data: rows
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
    exportTableToPDF(incube?.nom_incube, title, columns, data, signatureImage, `Plan_Action_${new Date().getTime()}.pdf`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar size={19} className="text-primary-600" />
            Plan d'Action & Suivi des Objectifs
          </h2>
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
            <Plus size={14} /> Ajouter un objectif
          </button>
        </div>
      </div>

      <div className="card p-0 overflow-hidden shadow-sm">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th className="w-44">Jour de suivi</th>
                <th className="min-w-[200px]">Objectif assigné</th>
                <th className="w-32">Date de début</th>
                <th className="w-32">Échéance</th>
                <th className="min-w-[150px]">Problèmes rencontrés</th>
                <th className="min-w-[150px]">Commentaires</th>
                <th className="min-w-[120px]">Lié au RDV</th>
                <th className="w-24 text-center">Action</th>
                <th className="w-52 text-center">Statut</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400 dark:text-dark-400">
                    Aucun objectif défini
                  </td>
                </tr>
              ) : rows.map((r, idx) => {
                const isValide = r.realisation === 'Validé' || r.realisation === 'Effectué' || r.realisation === 'Atteint';
                const lockedInputClass = isValide
                  ? 'bg-slate-100 dark:bg-dark-900/60 text-slate-500 dark:text-dark-400 border-slate-200 dark:border-dark-700/60 cursor-not-allowed select-none'
                  : '';

                const parsed = parseDayAndMonth(r.mois);
                const isEnCours = r.realisation === 'En cours' || r.realisation === 'À jour' || !r.realisation;

                return (
                  <tr
                    key={r.id || r._key || idx}
                    className={`transition-colors ${
                      isValide
                        ? 'bg-emerald-500/[0.03] dark:bg-emerald-500/[0.02]'
                        : 'hover:bg-slate-50/50 dark:hover:bg-dark-800/50'
                    }`}
                  >
                    {/* 1. JOUR DE SUIVI (Jour 1..31 + Mois Janvier..Décembre) */}
                    <td>
                      <div className="flex items-center gap-1.5">
                        <select
                          className={`input !py-1 !px-2 !text-xs font-semibold w-16 text-center ${lockedInputClass}`}
                          value={parsed.day}
                          onChange={e => handleDayChange(idx, e.target.value)}
                          disabled={isValide}
                          title={isValide ? "Verrouillé car validé" : "Jour (1-31)"}
                        >
                          {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                            <option key={d} value={d}>
                              {d < 10 ? `0${d}` : d}
                            </option>
                          ))}
                        </select>

                        <select
                          className={`input !py-1 !px-2 !text-xs font-semibold flex-1 min-w-[95px] ${lockedInputClass}`}
                          value={parsed.month}
                          onChange={e => handleMonthChange(idx, e.target.value)}
                          disabled={isValide}
                          title={isValide ? "Verrouillé car validé" : "Mois"}
                        >
                          {MOIS.map(m => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>

                    {/* 2. OBJECTIF ASSIGNÉ */}
                    <td>
                      <div className="relative group">
                        <input
                          className={`input !py-1.5 !text-xs font-medium pr-7 ${lockedInputClass}`}
                          value={r.objectifs || ''}
                          onChange={e => updateRow(idx, 'objectifs', e.target.value)}
                          placeholder="Intitulé de l'objectif..."
                          disabled={isValide}
                          title={isValide ? "Verrouillé car validé" : "Intitulé de l'objectif"}
                        />
                        <button 
                          type="button"
                          onClick={() => setTextModal({ open: true, title: "Objectif assigné", text: r.objectifs || '', rowIdx: idx, field: 'objectifs', disabled: isValide })}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          title="Agrandir et voir tout"
                        >
                          <Maximize2 size={12} />
                        </button>
                      </div>
                    </td>

                    {/* 3. DATES (Début / Échéance) */}
                    <td>
                      <input
                        type="date"
                        className={`input !py-1.5 !text-xs ${lockedInputClass}`}
                        value={r.date_debut || ''}
                        onChange={e => updateRow(idx, 'date_debut', e.target.value)}
                        disabled={isValide}
                        title={isValide ? "Verrouillé car validé" : "Date de début"}
                      />
                    </td>
                    <td>
                      <div className="flex flex-col gap-1.5">
                        <input
                          type="date"
                          className={`input !py-1.5 !text-xs ${lockedInputClass}`}
                          value={r.echeance || ''}
                          onChange={e => updateRow(idx, 'echeance', e.target.value)}
                          disabled={isValide}
                          title={isValide ? "Verrouillé car validé" : "Date d'échéance"}
                        />
                        {r.echeance && isEnCours && (
                          <div className="flex justify-start">
                            {(() => {
                              const days = getRemainingDays(r.echeance);
                              if (days < 0) {
                                return (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 text-[10px] font-bold">
                                    <Clock size={12} /> {Math.abs(days)}j de retard
                                  </span>
                                );
                              } else if (days <= 7) {
                                return (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 text-[10px] font-bold">
                                    <Clock size={12} /> {days}j restants
                                  </span>
                                );
                              } else {
                                return (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 text-[10px] font-bold">
                                    <CheckCircle2 size={12} /> {days}j
                                  </span>
                                );
                              }
                            })()}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* 4. PROBLÈMES RENCONTRÉS */}
                    <td>
                      <div className="relative group">
                        <input
                          className={`input !py-1.5 !text-xs pr-7 ${lockedInputClass}`}
                          value={r.problemes_rencontres || ''}
                          onChange={e => updateRow(idx, 'problemes_rencontres', e.target.value)}
                          placeholder="Difficultés rencontrées..."
                          disabled={isValide}
                          title={isValide ? "Verrouillé car validé" : "Problèmes rencontrés"}
                        />
                        <button 
                          type="button"
                          onClick={() => setTextModal({ open: true, title: "Problèmes rencontrés", text: r.problemes_rencontres || '', rowIdx: idx, field: 'problemes_rencontres', disabled: isValide })}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          title="Agrandir et voir tout"
                        >
                          <Maximize2 size={12} />
                        </button>
                      </div>
                    </td>

                    {/* 5. COMMENTAIRES */}
                    <td>
                      <div className="relative group">
                        <input
                          className={`input !py-1.5 !text-xs pr-7 ${lockedInputClass}`}
                          value={r.commentaires || ''}
                          onChange={e => updateRow(idx, 'commentaires', e.target.value)}
                          placeholder="Remarques et consignes..."
                          disabled={isValide}
                          title={isValide ? "Verrouillé car validé" : "Commentaires"}
                        />
                        <button 
                          type="button"
                          onClick={() => setTextModal({ open: true, title: "Remarques et consignes", text: r.commentaires || '', rowIdx: idx, field: 'commentaires', disabled: isValide })}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          title="Agrandir et voir tout"
                        >
                          <Maximize2 size={12} />
                        </button>
                      </div>
                    </td>

                    {/* LIÉ AU RDV */}
                    <td>
                      <select 
                        className={`input !py-1.5 !text-xs w-full ${lockedInputClass}`}
                        value={r.rendezvous_id || ''}
                        onChange={(e) => updateRow(idx, 'rendezvous_id', e.target.value)}
                        disabled={isValide}
                      >
                        <option value="">-- Aucun --</option>
                        {rdvs.map(rdv => (
                          <option key={rdv.id} value={rdv.id}>
                            {rdv.dateRdv} - {rdv.sujet}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* 6. ACTION (Placé avant le Statut) */}
                    <td>
                      <div className="flex items-center justify-center gap-1.5">
                        {isValide ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded"
                            title="Objectif validé : champs verrouillés"
                          >
                            <Lock size={12} />
                            Fixé
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-success btn-sm btn-icon"
                            onClick={() => saveRow(idx)}
                            title="Enregistrer cet objectif"
                          >
                            <Save size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-danger btn-sm btn-icon"
                          onClick={() => deleteRow(idx)}
                          title="Supprimer cet objectif"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>

                    {/* 7. STATUT / ÉVALUATION (EN DERNIER SUR LE TABLEAU) */}
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {isValide && (
                          <Lock size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" title="Champs verrouillés" />
                        )}
                        <select
                          value={
                            isValide
                              ? 'Atteint'
                              : (r.realisation === 'Non atteint')
                              ? 'Non atteint'
                              : 'En cours'
                          }
                          onChange={e => handleStatusChange(idx, e.target.value)}
                          className={`input !py-1.5 !text-xs font-bold transition-all border cursor-pointer ${
                            isValide
                              ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/40 ring-1 ring-emerald-500/30'
                              : r.realisation === 'Non atteint'
                              ? 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/40 ring-1 ring-rose-500/30'
                              : 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40 ring-1 ring-amber-500/30'
                          }`}
                          title="Sélectionner le statut de l'objectif"
                        >
                          <option value="Atteint" className="text-slate-900 bg-white dark:bg-dark-800 dark:text-white font-bold">
                            ✅ Atteint
                          </option>
                          <option value="En cours" className="text-slate-900 bg-white dark:bg-dark-800 dark:text-white font-bold">
                            🔔 En cours
                          </option>
                          <option value="Non atteint" className="text-slate-900 bg-white dark:bg-dark-800 dark:text-white font-bold">
                            ❌ Non atteint
                          </option>
                        </select>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modale d'importation du Plan d'action */}
      <ExcelImportModal
        isOpen={showExcelModal}
        onClose={() => setShowExcelModal(false)}
        title="Importer des objectifs / plan d'action (Excel)"
        description="Chargez un fichier Excel pour importer la liste des objectifs et actions. Colonnes suggérées : mois, objectifs, date_debut, echeance, problemes_rencontres, commentaires, realisation."
        templateType="plan_action"
        onImport={handleImportExcel}
      />

      <SignatureModal 
        isOpen={showSigModal} 
        onClose={() => setShowSigModal(false)}
        onValidate={handleExportPDF}
        title="Signature du Plan d'Action"
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
