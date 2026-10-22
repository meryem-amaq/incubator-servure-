import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Trash2,
  FileText,
  FileDown,
  Check,
  RefreshCw,
  Sparkles,
  ArrowDown,
  Maximize2,
  X,
  Pencil,
  Calendar,
  CalendarCheck,
  CalendarPlus
} from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import SignatureModal from '../common/SignatureModal';
import CalendrierBookingModal from '../common/CalendrierBookingModal';
import {
  exportGlobalPVToPDF,
  getGlobalPVBlobUrl,
  exportSeancePVToPDF,
  getSeancePVBlobUrl
} from '../../utils/pdfExport';

const BASE_STATUT_OPTS = ['Auto-entrepreneur', 'SARL', 'SARL AU', 'Autre'];
const BASE_AVANCEMENT_OPTS = ['Idéation', 'Lancement', 'Croissance', 'Maturité'];

const PHASE_STYLES = {
  'Idéation': 'bg-navy-500/10 text-navy-700 dark:text-navy-300 border-navy-500/20',
  'Lancement': 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
  'Croissance': 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  'Maturité': 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
};

const formatDateFr = (d) => {
  if (!d) return '—';
  try {
    const parts = String(d).split('T')[0].split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day}/${month}/${year}`;
    }
    return new Date(d).toLocaleDateString('fr-FR');
  } catch (e) {
    return d;
  }
};

/**
 * Trie les séances de suivi du plus récent vers le moins récent (ordre antéchronologique)
 */
const sortRowsDesc = (list) => {
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => {
    // 1. Priorité par date (la plus récente d'abord)
    const dateA = a.date_suivi ? new Date(a.date_suivi).getTime() : 0;
    const dateB = b.date_suivi ? new Date(b.date_suivi).getTime() : 0;
    if (dateA !== dateB) return dateB - dateA;

    // 2. Fallback sur l'ID décroissant (le plus récent d'abord)
    return (b.id || 0) - (a.id || 0);
  });
};

export default function TabFicheSuivi({ incubeId, incube, fiches = [], onUpdate }) {
  const [rows, setRows] = useState(() => sortRowsDesc(fiches || []));

  // Modal d'ajout / modification de séance (style Formation)
  const [showModal, setShowModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    date_suivi: new Date().toISOString().split('T')[0],
    statut_juridique: incube?.statut_juridique || 'Auto-entrepreneur',
    statut_avancement: incube?.phase_projet || 'Idéation',
    observations: '',
    enregistrerRdv: true,
    heure_rdv: '10:00',
    statut_rdv: 'effectue',
  });

  // Modal de lecture agrandie des observations
  const [textModal, setTextModal] = useState({ open: false, title: '', text: '' });

  // Modal de signature PDF
  const [showSigModal, setShowSigModal] = useState(false);
  const [sigModalTitle, setSigModalTitle] = useState("Signature de la Fiche de Suivi");
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
  const [exportType, setExportType] = useState('global'); // 'global' | 'seance'
  const [selectedRow, setSelectedRow] = useState(null);

  // Synchronisation des options avec la valeur active de l'incubé
  const statutOptions = useMemo(() => {
    const list = [...BASE_STATUT_OPTS];
    if (incube?.statut_juridique && !list.includes(incube.statut_juridique)) {
      list.push(incube.statut_juridique);
    }
    return list;
  }, [incube?.statut_juridique]);

  const avancementOptions = useMemo(() => {
    const list = [...BASE_AVANCEMENT_OPTS];
    if (incube?.phase_projet && !list.includes(incube.phase_projet)) {
      list.push(incube.phase_projet);
    }
    return list;
  }, [incube?.phase_projet]);

  // Synchronisation lors de la réception des fiches depuis le serveur
  useEffect(() => {
    setRows(sortRowsDesc(fiches || []));
  }, [fiches]);

  // Ouvrir le formulaire d'ajout
  const handleOpenAddModal = () => {
    setEditingRow(null);
    setFormData({
      date_suivi: new Date().toISOString().split('T')[0],
      statut_juridique: incube?.statut_juridique || 'Auto-entrepreneur',
      statut_avancement: incube?.phase_projet || 'Idéation',
      observations: '',
      enregistrerRdv: true,
      heure_rdv: '10:00',
      statut_rdv: 'effectue',
    });
    setShowModal(true);
  };

  // Ouvrir le formulaire d'édition
  const handleOpenEditModal = (row) => {
    setEditingRow(row);
    setFormData({
      date_suivi: row.date_suivi ? String(row.date_suivi).split('T')[0] : new Date().toISOString().split('T')[0],
      statut_juridique: row.statut_juridique || incube?.statut_juridique || 'Auto-entrepreneur',
      statut_avancement: row.statut_avancement || incube?.phase_projet || 'Idéation',
      observations: row.observations || '',
      enregistrerRdv: false,
      heure_rdv: '10:00',
      statut_rdv: 'effectue',
    });
    setShowModal(true);
  };

  // Enregistrement de la séance (Création ou Mise à jour)
  const handleSaveForm = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const dataToSave = {
      date_suivi: formData.date_suivi || null,
      statut_juridique: formData.statut_juridique || incube?.statut_juridique || 'Auto-entrepreneur',
      statut_avancement: formData.statut_avancement || incube?.phase_projet || 'Idéation',
      observations: formData.observations || '',
      // Ordre et anomalie signalée sont supprimés de la saisie
      numero_ordre: editingRow?.numero_ordre || null,
      anomalie_signalee: '',
      declaration_echec: 'Non',
    };

    try {
      // 1. Enregistrement automatique comme Rendez-vous si demandé (pour affichage immédiat sur le Dashboard)
      if (formData.enregistrerRdv) {
        try {
          const rdvPayload = {
            accompagnateurNom: incube?.accompagnateur || 'Accompagnateur IDS',
            incubeIds: [incubeId],
            incubeNoms: incube?.nom_incube || 'Incubé',
            dateRdv: formData.date_suivi,
            heureRdv: formData.heure_rdv || '10:00',
            duree: '1h',
            sujet: `Séance de Suivi • ${formData.statut_avancement || 'Étape'}`,
            statut: formData.statut_rdv || 'effectue',
            lieu: 'Bureaux Incubateur IDS / Fablab'
          };
          const rdvRes = await api.post('/rendezvous/creer', rdvPayload);
          if (rdvRes.data?.data?.id) {
            dataToSave.rendezvous_id = rdvRes.data.data.id;
            if (formData.statut_rdv === 'effectue') {
              await api.put(`/rendezvous/${rdvRes.data.data.id}`, { statut: 'effectue' }).catch(() => { });
            }
          }
        } catch (rdvErr) {
          console.warn("Synchronisation RDV:", rdvErr);
        }
      }

      let savedResult;
      if (editingRow?.id) {
        const res = await api.put(`/incubes/${incubeId}/fiche-suivi/${editingRow.id}`, dataToSave);
        savedResult = res.data;
        setRows(prev => sortRowsDesc(prev.map(r => r.id === editingRow.id ? savedResult : r)));
        toast.success("Séance de suivi modifiée avec succès");
      } else {
        const res = await api.post(`/incubes/${incubeId}/fiche-suivi`, dataToSave);
        savedResult = res.data;
        setRows(prev => sortRowsDesc([savedResult, ...prev]));
        toast.success("Nouvelle séance de suivi enregistrée avec succès (affichée sur le Dashboard)");
      }

      // Synchronisation vers Infos Générales si c'est la séance la plus récente (par date)
      const currentNewestTime = rows.length && rows[0]?.date_suivi ? new Date(rows[0].date_suivi).getTime() : 0;
      const thisTime = dataToSave.date_suivi ? new Date(dataToSave.date_suivi).getTime() : 0;
      if (thisTime >= currentNewestTime) {
        const diffStatut = dataToSave.statut_juridique && dataToSave.statut_juridique !== incube?.statut_juridique;
        const diffPhase = dataToSave.statut_avancement && dataToSave.statut_avancement !== incube?.phase_projet;
        if (diffStatut || diffPhase) {
          try {
            await api.put(`/incubes/${incubeId}`, {
              statut_juridique: dataToSave.statut_juridique,
              phase_projet: dataToSave.statut_avancement
            });
          } catch (syncErr) {
            console.warn("Synchronisation du profil:", syncErr);
          }
        }
      }

      setShowModal(false);
      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'enregistrement de la séance");
    } finally {
      setSubmitting(false);
    }
  };

  // 📅 Enregistrement d'une séance comme Rendez-vous (pour affichage sur le Dashboard)
  const handleRegisterRdvForRow = async (row) => {
    if (row.rendezvous_id) {
      toast.success("Cette séance est déjà enregistrée comme Rendez-vous officiel.", { icon: '📅' });
      setShowBookingModal(true);
      return;
    }

    const toastId = toast.loading("Enregistrement du rendez-vous pour le Dashboard...");
    try {
      const rdvDate = row.date_suivi ? String(row.date_suivi).split('T')[0] : new Date().toISOString().split('T')[0];
      const rdvPayload = {
        accompagnateurNom: incube?.accompagnateur || 'Accompagnateur IDS',
        incubeIds: [incubeId],
        incubeNoms: incube?.nom_incube || 'Incubé',
        dateRdv: rdvDate,
        heureRdv: '10:00',
        duree: '1h',
        sujet: `Séance de Suivi • ${row.statut_avancement || 'Étape'}`,
        statut: 'effectue',
        lieu: 'Bureaux Incubateur IDS / Fablab'
      };

      const res = await api.post('/rendezvous/creer', rdvPayload);
      const newRdvId = res.data?.data?.id;
      if (newRdvId && row.id) {
        await api.put(`/incubes/${incubeId}/fiche-suivi/${row.id}`, { rendezvous_id: newRdvId }).catch(() => { });
        setRows(prev => prev.map(r => r.id === row.id ? { ...r, rendezvous_id: newRdvId } : r));
      }

      toast.success("Rendez-vous enregistré avec succès ! Il apparaît maintenant sur le Tableau de Bord.", { id: toastId, icon: '📅' });
      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'enregistrement du rendez-vous", { id: toastId });
    }
  };

  // Suppression d'une séance
  const handleDelete = async (row) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer la séance de suivi du ${formatDateFr(row.date_suivi)} ?`)) return;
    if (row.id) {
      try {
        await api.delete(`/incubes/${incubeId}/fiche-suivi/${row.id}`);
        setRows(prev => prev.filter(r => r.id !== row.id));
        toast.success("Séance de suivi supprimée");
        if (onUpdate) onUpdate();
      } catch (e) {
        toast.error("Erreur lors de la suppression de la séance");
      }
    }
  };

  // 📜 Ouvrir la signature pour la Fiche de Suivi Globale (toutes les séances)
  const handleOpenGlobalPV = () => {
    if (!rows || rows.length === 0) {
      toast.error("Aucune séance de suivi enregistrée pour générer la Fiche de Suivi");
      return;
    }
    setExportType('global');
    setSelectedRow(null);
    setSigModalTitle(`Signature de la Fiche de Suivi • ${incube?.nom_incube || 'Incubé'}`);
    const url = getGlobalPVBlobUrl(incube, rows);
    setPdfPreviewUrl(url);
    setShowSigModal(true);
  };

  // 📜 Ouvrir la signature électronique pour la séance / rendez-vous individuel
  const handleOpenSeancePV = (row) => {
    setExportType('seance');
    setSelectedRow(row);
    const dateFormatted = formatDateFr(row.date_suivi);
    setSigModalTitle(`Signature Électronique du PV • Séance du ${dateFormatted}`);
    const url = getSeancePVBlobUrl(incube, row);
    setPdfPreviewUrl(url);
    setShowSigModal(true);
  };

  // ✍️ Validation de la signature & téléchargement du PDF (séance ou global)
  const handleValidateSignature = (signatureImage) => {
    const safeName = (incube?.nom_incube || 'Incube').replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStamp = new Date().toISOString().split('T')[0];

    if (exportType === 'global') {
      exportGlobalPVToPDF(
        incube,
        rows,
        signatureImage,
        `Fiche_de_Suivi_${safeName}_${dateStamp}.pdf`
      );
      toast.success("Fiche de Suivi officielle téléchargée avec succès !");
    } else if (exportType === 'seance' && selectedRow) {
      const dateStr = selectedRow.date_suivi ? String(selectedRow.date_suivi).split('T')[0] : 'seance';
      exportSeancePVToPDF(
        incube,
        selectedRow,
        signatureImage,
        `PV_Seance_Suivi_${dateStr}_${safeName}.pdf`
      );
      toast.success(`Procès-Verbal de la séance signé et téléchargé avec succès !`);
    }
  };

  return (
    <div className="space-y-4 slide-up">
      {/* En-tête avec titre "Fiche de Suivi" et actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText size={19} className="text-primary-600 dark:text-primary-400" />
            Fiche de Suivi
          </h2>
          <p className="text-xs text-slate-500 dark:text-dark-400 mt-0.5">
            Séances de suivi d'accompagnement, évolution des statuts et génération des Fiches de Suivi officielles signées
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-secondary btn-sm flex items-center gap-1.5 border-rose-500/40 text-rose-700 dark:text-rose-400 hover:bg-rose-500/10 font-bold shadow-sm"
            onClick={handleOpenGlobalPV}
            disabled={rows.length === 0}
            title="Générer et signer la Fiche de Suivi officielle (PV de suivi récapitulatif)"
          >
            <FileDown size={14} className="text-rose-500" />
            <span>Exporter Fiche de Suivi (PDF)</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm flex items-center gap-1.5 border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 font-bold shadow-sm"
            onClick={() => setShowBookingModal(true)}
            title="Planifier et enregistrer un nouveau rendez-vous pour cet incubé (affiché sur le Dashboard)"
          >
            <CalendarPlus size={14} className="text-amber-500" />
            <span>Planifier un rendez-vous</span>
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm flex items-center gap-1.5 font-bold shadow-sm"
            onClick={handleOpenAddModal}
          >
            <Plus size={14} /> Ajouter une séance
          </button>
        </div>
      </div>

      {/* Bannière d'état et de synchronisation Infos Générales */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-50/90 dark:bg-dark-800/80 border border-slate-200 dark:border-dark-700 shadow-xs text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200">
            <Sparkles size={14} className="text-primary-500" />
            Synchronisé avec Infos Générales :
          </span>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-dark-700 border border-slate-200 dark:border-dark-600 shadow-xs">
            <span className="text-slate-500 dark:text-dark-400">Statut juridique :</span>
            <span className="font-bold text-primary-600 dark:text-primary-400">{incube?.statut_juridique || 'Non défini'}</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-dark-700 border border-slate-200 dark:border-dark-600 shadow-xs">
            <span className="text-slate-500 dark:text-dark-400">Phase projet :</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">{incube?.phase_projet || 'Idéation'}</span>
          </div>
        </div>
        <div className="text-[11px] text-slate-500 dark:text-dark-400 flex items-center gap-1 font-medium ml-auto">
          <ArrowDown size={12} className="text-primary-500" />
          <span>Affichage chronologique (du plus récent vers le moins récent)</span>
        </div>
      </div>

      {/* Tableau des séances de suivi (sans ordre ni anomalie signalée) */}
      <div className="card p-0 overflow-hidden border border-slate-200 dark:border-dark-700/60 shadow-md">
        <div className="table-container">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-dark-300">
                <th className="py-3 px-4 font-bold border-b border-slate-200 dark:border-dark-700/60 w-36">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar size={13} className="text-primary-500" />
                    Date
                    <ArrowDown size={12} className="text-primary-500" title="Du plus récent vers le moins récent" />
                  </span>
                </th>
                <th className="py-3 px-4 font-bold border-b border-slate-200 dark:border-dark-700/60 w-44">Statut juridique</th>
                <th className="py-3 px-4 font-bold border-b border-slate-200 dark:border-dark-700/60 w-44">État d'avancement</th>
                <th className="py-3 px-4 font-bold border-b border-slate-200 dark:border-dark-700/60 min-w-[280px]">Observations & Recommandations</th>
                <th className="py-3 px-4 font-bold border-b border-slate-200 dark:border-dark-700/60 text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-dark-700/50">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-10 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileText size={32} className="text-slate-300 dark:text-dark-600" />
                      <p className="font-semibold text-slate-500 dark:text-dark-400">Aucune séance de suivi enregistrée.</p>
                      <button
                        type="button"
                        onClick={handleOpenAddModal}
                        className="btn btn-primary btn-sm mt-1 flex items-center gap-1.5"
                      >
                        <Plus size={14} /> Ajouter la première séance
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id || row._key} className="hover:bg-slate-50 dark:hover:bg-dark-800/40 transition-colors">
                    {/* Date */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white text-xs">
                          {formatDateFr(row.date_suivi)}
                        </span>
                      </div>
                    </td>

                    {/* Statut Juridique */}
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-dark-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-dark-600">
                        {row.statut_juridique || incube?.statut_juridique || 'Auto-entrepreneur'}
                      </span>
                    </td>

                    {/* État d'avancement */}
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${PHASE_STYLES[row.statut_avancement || incube?.phase_projet] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                        {row.statut_avancement || incube?.phase_projet || 'Idéation'}
                      </span>
                    </td>

                    {/* Observations */}
                    <td className="py-3 px-4">
                      <div className="relative group flex items-start justify-between gap-2">
                        <p className="text-slate-700 dark:text-slate-300 line-clamp-2 leading-relaxed text-xs">
                          {row.observations?.trim() || <span className="text-slate-400 italic">Aucune observation renseignée.</span>}
                        </p>
                        {row.observations && (
                          <button
                            type="button"
                            onClick={() => setTextModal({
                              open: true,
                              title: `Observations • Séance du ${formatDateFr(row.date_suivi)}`,
                              text: row.observations
                            })}
                            className="p-1 text-slate-400 hover:text-primary-500 opacity-60 group-hover:opacity-100 transition-opacity cursor-pointer rounded hover:bg-slate-200 dark:hover:bg-dark-700 shrink-0"
                            title="Agrandir et voir tout le compte-rendu"
                          >
                            <Maximize2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Modifier */}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm btn-icon hover:bg-primary-50 dark:hover:bg-primary-950/40 text-primary-600 dark:text-primary-400"
                          onClick={() => handleOpenEditModal(row)}
                          title="Modifier cette séance de suivi"
                        >
                          <Pencil size={13} />
                        </button>

                        {/* Signer et exporter le PV de ce rendez-vous */}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm btn-icon text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                          onClick={() => handleOpenSeancePV(row)}
                          title="Signer électroniquement et télécharger le PV de ce rendez-vous"
                        >
                          <FileDown size={13} />
                        </button>

                        {/* Suppression */}
                        <button
                          type="button"
                          className="btn btn-danger btn-sm btn-icon"
                          onClick={() => handleDelete(row)}
                          title="Supprimer cette séance"
                        >
                          <Trash2 size={13} />
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

      {/* Formulaire Modal Ajouter / Modifier une séance (Style Formations) */}
      {showModal && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white dark:bg-dark-900 text-slate-900 dark:text-white rounded-3xl border border-slate-200 dark:border-dark-700 shadow-2xl max-w-xl w-full overflow-hidden slide-up my-8 max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header Modal - style formations */}
            <div className="p-5 border-b border-slate-100 dark:border-dark-800 bg-gradient-to-r from-primary-600 to-navy-700 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white font-black shadow-inner">
                  <CalendarCheck size={20} />
                </div>
                <div>
                  <h3 className="font-black text-base tracking-tight">
                    {editingRow ? 'Modifier la Séance de Suivi' : 'Ajouter une Séance de Suivi'}
                  </h3>
                  <p className="text-xs text-white/80">Renseignez la date, les statuts et vos observations</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Corps du Formulaire */}
            <form onSubmit={handleSaveForm} className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* 1. Date de la séance */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-dark-200 block mb-1 uppercase tracking-wider">
                  Date de la séance <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.date_suivi}
                  onChange={e => setFormData(prev => ({ ...prev, date_suivi: e.target.value }))}
                  className="input !py-2.5 !text-xs w-full bg-slate-50 dark:bg-dark-800 font-bold border-slate-300 dark:border-dark-700 rounded-xl"
                />
              </div>

              {/* 2. Statut Juridique & État d'avancement (grid 2 cols) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-dark-200 block mb-1 uppercase tracking-wider">
                    Statut Juridique <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.statut_juridique}
                    onChange={e => setFormData(prev => ({ ...prev, statut_juridique: e.target.value }))}
                    className="input !py-2.5 !text-xs w-full font-bold bg-slate-50 dark:bg-dark-800 border-slate-300 dark:border-dark-700 rounded-xl cursor-pointer"
                  >
                    {statutOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-dark-200 block mb-1 uppercase tracking-wider">
                    État d'avancement <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.statut_avancement}
                    onChange={e => setFormData(prev => ({ ...prev, statut_avancement: e.target.value }))}
                    className="input !py-2.5 !text-xs w-full font-bold bg-slate-50 dark:bg-dark-800 border-slate-300 dark:border-dark-700 rounded-xl cursor-pointer"
                  >
                    {avancementOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* 3. Observations & Recommandations */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-dark-200 block mb-1 uppercase tracking-wider">
                  Observations & Recommandations
                </label>
                <textarea
                  rows={4}
                  value={formData.observations}
                  onChange={e => setFormData(prev => ({ ...prev, observations: e.target.value }))}
                  placeholder="Saisissez vos observations, jalons atteints, décisions et recommandations pour l'étape suivante..."
                  className="input !py-2.5 !text-xs w-full bg-slate-50 dark:bg-dark-800 border-slate-300 dark:border-dark-700 rounded-xl resize-y min-h-[110px]"
                />
              </div>

              {/* Option d'enregistrement automatique comme Rendez-vous (pour Dashboard) */}
              <div className="p-3.5 bg-primary-50/70 dark:bg-primary-950/30 rounded-xl border border-primary-200/80 dark:border-primary-800/40 space-y-2.5">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.enregistrerRdv}
                    onChange={e => setFormData(prev => ({ ...prev, enregistrerRdv: e.target.checked }))}
                    className="rounded text-primary-600 focus:ring-primary-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-800 dark:text-dark-100 flex items-center gap-1.5">
                    <CalendarCheck size={15} className="text-primary-600 dark:text-primary-400" />
                    Enregistrer aussi comme Rendez-vous (Affiché sur le Tableau de Bord)
                  </span>
                </label>
                {formData.enregistrerRdv && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 pl-6">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-dark-300 block mb-1">
                        Heure de la séance
                      </label>
                      <input
                        type="time"
                        value={formData.heure_rdv}
                        onChange={e => setFormData(prev => ({ ...prev, heure_rdv: e.target.value }))}
                        className="input !py-1.5 !text-xs w-full bg-white dark:bg-dark-800 font-bold border-slate-300 dark:border-dark-700 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-dark-300 block mb-1">
                        Statut du Rendez-vous
                      </label>
                      <select
                        value={formData.statut_rdv}
                        onChange={e => setFormData(prev => ({ ...prev, statut_rdv: e.target.value }))}
                        className="input !py-1.5 !text-xs w-full font-bold bg-white dark:bg-dark-800 border-slate-300 dark:border-dark-700 rounded-lg cursor-pointer"
                      >
                        <option value="effectue">Effectué (Séance réalisée)</option>
                        <option value="programme">Programmé (À venir)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Alerte d'information sur la synchronisation */}
              <div className="p-3 bg-slate-50 dark:bg-dark-800/60 rounded-xl border border-slate-200 dark:border-dark-700 flex items-start gap-2.5 text-xs text-slate-600 dark:text-dark-300">
                <Sparkles size={16} className="text-primary-500 shrink-0 mt-0.5" />
                <span>
                  L'enregistrement mettra à jour automatiquement le statut juridique et la phase du projet dans les informations générales de l'incubé s'il s'agit de la séance la plus récente.
                </span>
              </div>

              {/* Boutons modal */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary text-xs py-2 px-4 rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary text-xs py-2 px-5 rounded-xl font-bold cursor-pointer shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>{editingRow ? 'Mettre à jour la séance' : 'Enregistrer la séance'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale d'agrandissement de texte (lecture des observations) */}
      {textModal.open && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-900 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden border border-slate-200 dark:border-dark-700 animate-scale-up">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-dark-800 bg-slate-50 dark:bg-dark-800/50">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-sm sm:text-base">
                <Maximize2 size={18} className="text-primary-500" />
                {textModal.title}
              </h3>
              <button
                type="button"
                onClick={() => setTextModal({ open: false, title: '', text: '' })}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 dark:hover:text-white dark:hover:bg-dark-700 transition-colors"
                title="Fermer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5">
              <div className="p-4 bg-slate-50 dark:bg-dark-800 rounded-xl border border-slate-200 dark:border-dark-700 text-sm text-slate-800 dark:text-dark-100 whitespace-pre-wrap leading-relaxed max-h-[60vh] overflow-y-auto">
                {textModal.text}
              </div>
            </div>
            <div className="flex items-center justify-end p-4 border-t border-slate-100 dark:border-dark-800 bg-slate-50/50 dark:bg-dark-800/30">
              <button
                type="button"
                className="btn btn-secondary text-sm"
                onClick={() => setTextModal({ open: false, title: '', text: '' })}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale de prévisualisation et signature électronique */}
      <SignatureModal 
        isOpen={showSigModal} 
        onClose={() => {
          setShowSigModal(false);
          setPdfPreviewUrl(null);
        }}
        onValidate={handleValidateSignature}
        title={sigModalTitle}
        pdfPreviewUrl={pdfPreviewUrl}
      />

      {/* Modale de prise de rendez-vous & calendrier booking */}
      <CalendrierBookingModal
        isOpen={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        incubesList={incube ? [incube] : []}
        currentAccompagnateurNom={incube?.accompagnateur || 'Accompagnateur IDS'}
        initialIncubeId={incube?.id}
        onSuccess={() => {
          if (onUpdate) onUpdate();
        }}
      />
    </div>
  );
}
