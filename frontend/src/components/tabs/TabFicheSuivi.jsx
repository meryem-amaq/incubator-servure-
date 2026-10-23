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
  Eye,
  Link2,
  Clock,
  MapPin
} from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import SignatureModal from '../common/SignatureModal';
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
    const dateA = a.date_suivi ? new Date(a.date_suivi).getTime() : 0;
    const dateB = b.date_suivi ? new Date(b.date_suivi).getTime() : 0;
    if (dateA !== dateB) return dateB - dateA;
    return (b.id || 0) - (a.id || 0);
  });
};

export default function TabFicheSuivi({ incubeId, incube, fiches = [], onUpdate }) {
  const [rows, setRows] = useState(() => sortRowsDesc(fiches || []));
  const [rdvList, setRdvList] = useState([]);

  // Modales
  const [showModal, setShowModal] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [detailModal, setDetailModal] = useState({ open: false, row: null });
  const [submitting, setSubmitting] = useState(false);

  // Formulaire d'ajout / modification
  const [formData, setFormData] = useState({
    date_suivi: new Date().toISOString().split('T')[0],
    objet_reunion: '',
    statut_juridique: incube?.statut_juridique || 'Auto-entrepreneur',
    statut_avancement: incube?.phase_projet || 'Idéation',
    observations: '',
    rendezvous_id: '',
  });

  // Modal de lecture agrandie des observations
  const [textModal, setTextModal] = useState({ open: false, title: '', text: '' });

  // Modal de signature PDF
  const [showSigModal, setShowSigModal] = useState(false);
  const [sigModalTitle, setSigModalTitle] = useState("Signature de la Fiche de Suivi");
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
  const [exportType, setExportType] = useState('global'); // 'global' | 'seance'
  const [selectedRow, setSelectedRow] = useState(null);

  // Options synchronisées avec l'incubé
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

  // Synchronisation des fiches depuis le parent
  useEffect(() => {
    setRows(sortRowsDesc(fiches || []));
  }, [fiches]);

  // Chargement des rendez-vous existants de l'incubé (pour sélection sans doublon)
  const loadRendezVous = async () => {
    if (!incubeId) return;
    try {
      const res = await api.get(`/rendezvous?incubeId=${incubeId}`);
      if (Array.isArray(res.data)) {
        setRdvList(res.data);
      }
    } catch (err) {
      console.warn("Erreur chargement rendez-vous incubé:", err);
    }
  };

  useEffect(() => {
    loadRendezVous();
  }, [incubeId]);

  // Ouvrir le formulaire d'ajout
  const handleOpenAddModal = () => {
    loadRendezVous();
    setEditingRow(null);
    setFormData({
      date_suivi: new Date().toISOString().split('T')[0],
      objet_reunion: '',
      statut_juridique: incube?.statut_juridique || 'Auto-entrepreneur',
      statut_avancement: incube?.phase_projet || 'Idéation',
      observations: '',
      rendezvous_id: '',
    });
    setShowModal(true);
  };

  // Ouvrir le formulaire d'édition
  const handleOpenEditModal = (row) => {
    loadRendezVous();
    setEditingRow(row);
    setFormData({
      date_suivi: row.date_suivi ? String(row.date_suivi).split('T')[0] : new Date().toISOString().split('T')[0],
      objet_reunion: row.objet_reunion || '',
      statut_juridique: row.statut_juridique || incube?.statut_juridique || 'Auto-entrepreneur',
      statut_avancement: row.statut_avancement || incube?.phase_projet || 'Idéation',
      observations: row.observations || '',
      rendezvous_id: row.rendezvous_id ? String(row.rendezvous_id) : '',
    });
    setShowModal(true);
  };

  // Sélection d'un rendez-vous existant dans la modale
  const handleSelectRdv = (rdvId) => {
    if (!rdvId) {
      setFormData(prev => ({ ...prev, rendezvous_id: '' }));
      return;
    }
    const selected = rdvList.find(r => String(r.id) === String(rdvId));
    if (selected) {
      setFormData(prev => ({
        ...prev,
        rendezvous_id: String(selected.id),
        date_suivi: selected.dateRdv ? String(selected.dateRdv).split('T')[0] : prev.date_suivi,
        objet_reunion: prev.objet_reunion?.trim() ? prev.objet_reunion : (selected.sujet || 'Point de suivi'),
      }));
    }
  };

  // Enregistrement de la séance (Création ou Modification)
  const handleSaveForm = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const dataToSave = {
      date_suivi: formData.date_suivi || null,
      objet_reunion: formData.objet_reunion?.trim() || '',
      statut_juridique: formData.statut_juridique || incube?.statut_juridique || 'Auto-entrepreneur',
      statut_avancement: formData.statut_avancement || incube?.phase_projet || 'Idéation',
      observations: formData.observations || '',
      rendezvous_id: formData.rendezvous_id ? parseInt(formData.rendezvous_id, 10) : null,
      numero_ordre: editingRow?.numero_ordre || null,
      anomalie_signalee: '',
      declaration_echec: 'Non',
    };

    try {
      // 1. Si un RDV est sélectionné, le marquer automatiquement comme "effectué" (sans recréer de doublon)
      if (dataToSave.rendezvous_id) {
        try {
          await api.put(`/rendezvous/${dataToSave.rendezvous_id}`, { statut: 'effectue' });
        } catch (rdvErr) {
          console.warn("Mise à jour statut RDV:", rdvErr);
        }
      }

      let savedResult;
      if (editingRow?.id) {
        const res = await api.put(`/incubes/${incubeId}/fiche-suivi/${editingRow.id}`, dataToSave);
        savedResult = res.data;
        // Conserver les données du rendez-vous lié si présentes
        if (dataToSave.rendezvous_id) {
          const linkedRdv = rdvList.find(r => r.id === dataToSave.rendezvous_id);
          if (linkedRdv) savedResult.rendezvous = linkedRdv;
        }
        setRows(prev => sortRowsDesc(prev.map(r => r.id === editingRow.id ? savedResult : r)));
        toast.success("Séance de suivi modifiée avec succès");
      } else {
        const res = await api.post(`/incubes/${incubeId}/fiche-suivi`, dataToSave);
        savedResult = res.data;
        if (dataToSave.rendezvous_id) {
          const linkedRdv = rdvList.find(r => r.id === dataToSave.rendezvous_id);
          if (linkedRdv) savedResult.rendezvous = linkedRdv;
        }
        setRows(prev => sortRowsDesc([savedResult, ...prev]));
        toast.success(
          dataToSave.rendezvous_id 
            ? "Séance enregistrée & Rendez-vous marqué comme effectué !" 
            : "Séance de suivi enregistrée avec succès"
        );
      }

      // Synchronisation vers Infos Générales si c'est la séance la plus récente
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
      loadRendezVous();
      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'enregistrement de la séance");
    } finally {
      setSubmitting(false);
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

  // Signature Fiche de Suivi Globale
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

  // Signature PV de Séance individuelle
  const handleOpenSeancePV = (row) => {
    setExportType('seance');
    setSelectedRow(row);
    const dateFormatted = formatDateFr(row.date_suivi);
    setSigModalTitle(`Signature Électronique du PV • Séance du ${dateFormatted}`);
    const url = getSeancePVBlobUrl(incube, row);
    setPdfPreviewUrl(url);
    setShowSigModal(true);
  };

  // Validation signature
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
            Suivi des réunions d'accompagnement, évolution juridique et d'avancement, et génération des PV officiels
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-secondary btn-sm flex items-center gap-1.5 border-rose-500/40 text-rose-700 dark:text-rose-400 hover:bg-rose-500/10 font-bold shadow-sm"
            onClick={handleOpenGlobalPV}
            disabled={rows.length === 0}
            title="Générer et signer la Fiche de Suivi officielle récapitulative"
          >
            <FileDown size={14} className="text-rose-500" />
            <span>Exporter Fiche de Suivi (PDF)</span>
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
            Situation actuelle de l'incubé :
          </span>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-dark-700 border border-slate-200 dark:border-dark-600 shadow-xs">
            <span className="text-slate-500 dark:text-dark-400">Changement juridique :</span>
            <span className="font-bold text-primary-600 dark:text-primary-400">{incube?.statut_juridique || 'Non défini'}</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-dark-700 border border-slate-200 dark:border-dark-600 shadow-xs">
            <span className="text-slate-500 dark:text-dark-400">Changement avancement :</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">{incube?.phase_projet || 'Idéation'}</span>
          </div>
        </div>
        <div className="text-[11px] text-slate-500 dark:text-dark-400 flex items-center gap-1 font-medium ml-auto">
          <ArrowDown size={12} className="text-primary-500" />
          <span>Affichage chronologique (du plus récent vers le moins récent)</span>
        </div>
      </div>

      {/* Tableau des séances de suivi */}
      <div className="card p-0 overflow-hidden border border-slate-200 dark:border-dark-700/60 shadow-md">
        <div className="table-container">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-dark-300">
                <th className="py-3 px-3 font-bold border-b border-slate-200 dark:border-dark-700/60 w-28">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar size={13} className="text-primary-500" />
                    Date
                  </span>
                </th>
                <th className="py-3 px-3 font-bold border-b border-slate-200 dark:border-dark-700/60 min-w-[160px]">
                  Objet de la réunion
                </th>
                <th className="py-3 px-3 font-bold border-b border-slate-200 dark:border-dark-700/60 w-36">
                  Changement juridique
                </th>
                <th className="py-3 px-3 font-bold border-b border-slate-200 dark:border-dark-700/60 w-36">
                  Changement d'avancement
                </th>
                <th className="py-3 px-3 font-bold border-b border-slate-200 dark:border-dark-700/60 min-w-[200px]">
                  Observations & Recommandations
                </th>
                <th className="py-3 px-3 font-bold border-b border-slate-200 dark:border-dark-700/60 text-center w-28">
                  Rendez-vous
                </th>
                <th className="py-3 px-3 font-bold border-b border-slate-200 dark:border-dark-700/60 text-center w-28">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-dark-700/50">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-10 text-slate-400">
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
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="font-bold text-slate-900 dark:text-white text-xs">
                        {formatDateFr(row.date_suivi)}
                      </span>
                    </td>

                    {/* Objet de la réunion */}
                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {row.objet_reunion?.trim() || <span className="text-slate-400 italic">Séance de suivi</span>}
                      </span>
                    </td>

                    {/* Changement Juridique */}
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-dark-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-dark-600">
                        {row.statut_juridique || incube?.statut_juridique || 'Auto-entrepreneur'}
                      </span>
                    </td>

                    {/* Changement de l'état d'avancement */}
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${PHASE_STYLES[row.statut_avancement || incube?.phase_projet] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                        {row.statut_avancement || incube?.phase_projet || 'Idéation'}
                      </span>
                    </td>

                    {/* Observations */}
                    <td className="py-3 px-3">
                      <div className="relative group flex items-start justify-between gap-1.5">
                        <p className="text-slate-700 dark:text-slate-300 line-clamp-2 leading-relaxed text-xs">
                          {row.observations?.trim() || <span className="text-slate-400 italic">Aucune observation.</span>}
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
                            <Maximize2 size={12} />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Statut Rendez-vous lié */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {row.rendezvous_id ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30" title="Rendez-vous planifié marqué comme Effectué">
                          <CalendarCheck size={11} className="text-emerald-500" />
                          Effectué
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-dark-700 text-slate-500 dark:text-dark-400" title="Séance directe sans créneau calendrier">
                          Direct
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-center gap-1">
                        {/* 1. 👁️ Voir le détail */}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm btn-icon text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-dark-700"
                          onClick={() => setDetailModal({ open: true, row })}
                          title="Voir les détails complets de cette séance"
                        >
                          <Eye size={13} />
                        </button>

                        {/* 2. ✏️ Modifier */}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm btn-icon hover:bg-primary-50 dark:hover:bg-primary-950/40 text-primary-600 dark:text-primary-400"
                          onClick={() => handleOpenEditModal(row)}
                          title="Modifier les informations de la séance"
                        >
                          <Pencil size={13} />
                        </button>

                        {/* 3. 📥 Signer et exporter le PV */}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm btn-icon text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                          onClick={() => handleOpenSeancePV(row)}
                          title="Signer électroniquement et télécharger le PV de la séance"
                        >
                          <FileDown size={13} />
                        </button>

                        {/* 4. 🗑️ Supprimer */}
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

      {/* ======================================================== */}
      {/* 👁️ MODALE DÉTAIL D'UNE SÉANCE DE SUIVI                     */}
      {/* ======================================================== */}
      {detailModal.open && detailModal.row && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setDetailModal({ open: false, row: null })}
        >
          <div
            className="bg-white dark:bg-dark-900 text-slate-900 dark:text-white rounded-3xl border border-slate-200 dark:border-dark-700 shadow-2xl max-w-xl w-full overflow-hidden slide-up my-8 max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header Modal Détail */}
            <div className="p-5 border-b border-slate-100 dark:border-dark-800 bg-gradient-to-r from-slate-800 to-navy-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white font-black shadow-inner">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="font-black text-base tracking-tight">
                    Détails de la Séance de Suivi
                  </h3>
                  <p className="text-xs text-white/80">
                    Séance tenue le {formatDateFr(detailModal.row.date_suivi)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailModal({ open: false, row: null })}
                className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Corps Modal Détail */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* Objet de la réunion */}
              <div className="p-4 rounded-2xl bg-primary-500/10 border border-primary-500/20">
                <div className="text-[11px] font-bold uppercase tracking-wider text-primary-700 dark:text-primary-300 mb-1">
                  Objet de la réunion
                </div>
                <div className="text-sm font-black text-slate-900 dark:text-white">
                  {detailModal.row.objet_reunion?.trim() || 'Séance de suivi périodique'}
                </div>
              </div>

              {/* Statuts : Changement juridique & Changement d'avancement */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-dark-400 block mb-1">
                    Changement juridique
                  </span>
                  <span className="text-xs font-bold text-primary-600 dark:text-primary-400">
                    {detailModal.row.statut_juridique || incube?.statut_juridique || 'Non défini'}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-dark-400 block mb-1">
                    Changement d'avancement
                  </span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {detailModal.row.statut_avancement || incube?.phase_projet || 'Idéation'}
                  </span>
                </div>
              </div>

              {/* Rendez-vous associé */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-dark-400 block">
                  Rendez-vous Calendrier
                </span>
                {detailModal.row.rendezvous_id ? (
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-500/30">
                      <CalendarCheck size={14} className="text-emerald-500" />
                      Rendez-vous Effectué (Fait)
                    </span>
                    {detailModal.row.rendezvous?.sujet && (
                      <span className="text-slate-600 dark:text-dark-300 font-medium">
                        • {detailModal.row.rendezvous.sujet}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-500 dark:text-dark-400 italic">
                    Séance enregistrée directement (non rattachée à un créneau du calendrier).
                  </p>
                )}
              </div>

              {/* Observations & Recommandations */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-dark-200 block">
                  Observations & Recommandations de l'accompagnateur
                </span>
                <div className="p-4 bg-slate-50 dark:bg-dark-800 rounded-2xl border border-slate-200 dark:border-dark-700 text-xs text-slate-800 dark:text-dark-100 whitespace-pre-wrap leading-relaxed max-h-[35vh] overflow-y-auto">
                  {detailModal.row.observations?.trim() || <span className="italic text-slate-400">Aucune observation enregistrée.</span>}
                </div>
              </div>
            </div>

            {/* Footer Modal Détail */}
            <div className="p-4 border-t border-slate-100 dark:border-dark-800 bg-slate-50/50 dark:bg-dark-800/30 flex items-center justify-between gap-2">
              <button
                type="button"
                className="btn btn-secondary text-xs"
                onClick={() => setDetailModal({ open: false, row: null })}
              >
                Fermer
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-secondary text-xs border-rose-500/30 text-rose-700 dark:text-rose-400 hover:bg-rose-500/10 flex items-center gap-1.5"
                  onClick={() => {
                    const rowToExport = detailModal.row;
                    setDetailModal({ open: false, row: null });
                    handleOpenSeancePV(rowToExport);
                  }}
                >
                  <FileDown size={13} className="text-rose-500" />
                  <span>Exporter PV (PDF)</span>
                </button>

                <button
                  type="button"
                  className="btn btn-primary text-xs flex items-center gap-1.5 font-bold"
                  onClick={() => {
                    const rowToEdit = detailModal.row;
                    setDetailModal({ open: false, row: null });
                    handleOpenEditModal(rowToEdit);
                  }}
                >
                  <Pencil size={13} />
                  <span>Modifier</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ✏️ MODALE AJOUTER / MODIFIER UNE SÉANCE                  */}
      {/* ======================================================== */}
      {showModal && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white dark:bg-dark-900 text-slate-900 dark:text-white rounded-3xl border border-slate-200 dark:border-dark-700 shadow-2xl max-w-xl w-full overflow-hidden slide-up my-8 max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header Modal Form */}
            <div className="p-5 border-b border-slate-100 dark:border-dark-800 bg-gradient-to-r from-primary-600 to-navy-700 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white font-black shadow-inner">
                  <CalendarCheck size={20} />
                </div>
                <div>
                  <h3 className="font-black text-base tracking-tight">
                    {editingRow ? 'Modifier la Séance de Suivi' : 'Ajouter une Séance de Suivi'}
                  </h3>
                  <p className="text-xs text-white/80">Renseignez l'objet, les évolutions et vos observations</p>
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
              {/* Optionnel : Lier à un rendez-vous existant du Calendrier (ZÉRO doublon) */}
              <div className="p-3.5 bg-slate-50 dark:bg-dark-800/80 rounded-2xl border border-slate-200 dark:border-dark-700 space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-dark-200 flex items-center gap-1.5">
                  <Link2 size={14} className="text-primary-500" />
                  <span>Rattacher à un rendez-vous existant du Calendrier</span>
                  <span className="text-[10px] font-normal text-slate-500 dark:text-dark-400">(Optionnel)</span>
                </label>
                <select
                  value={formData.rendezvous_id}
                  onChange={e => handleSelectRdv(e.target.value)}
                  className="input !py-2 !text-xs w-full bg-white dark:bg-dark-900 border-slate-300 dark:border-dark-700 rounded-xl cursor-pointer"
                >
                  <option value="">— Aucun rendez-vous sélectionné (séance libre) —</option>
                  {rdvList.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.dateRdv ? formatDateFr(r.dateRdv) : 'Date ?'} à {r.heureRdv || '10:00'} • {r.sujet} ({r.statut === 'effectue' ? 'Déjà effectué' : 'Programmé'})
                    </option>
                  ))}
                </select>
                {formData.rendezvous_id && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <Check size={12} />
                    Ce rendez-vous sera automatiquement marqué comme "Effectué" sur le tableau de bord (aucun doublon créé).
                  </p>
                )}
              </div>

              {/* 1. Date et Objet de la réunion (grid 2 cols) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
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

                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-dark-200 block mb-1 uppercase tracking-wider">
                    Objet de la réunion <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex: Revue d'avancement, Démarches juridiques, Plan commercial..."
                    value={formData.objet_reunion}
                    onChange={e => setFormData(prev => ({ ...prev, objet_reunion: e.target.value }))}
                    className="input !py-2.5 !text-xs w-full bg-slate-50 dark:bg-dark-800 font-bold border-slate-300 dark:border-dark-700 rounded-xl"
                  />
                </div>
              </div>

              {/* 2. Changement Juridique & Changement de l'état d'avancement (grid 2 cols) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-dark-200 block mb-1 uppercase tracking-wider">
                    Changement juridique <span className="text-rose-500">*</span>
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
                    Changement de l'état d'avancement <span className="text-rose-500">*</span>
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
                  placeholder="Saisissez vos observations, décisions prises et recommandations pour l'étape suivante..."
                  className="input !py-2.5 !text-xs w-full bg-slate-50 dark:bg-dark-800 border-slate-300 dark:border-dark-700 rounded-xl resize-y min-h-[110px]"
                />
              </div>

              {/* Alerte d'information sur la mise à jour du profil */}
              <div className="p-3 bg-slate-50 dark:bg-dark-800/60 rounded-xl border border-slate-200 dark:border-dark-700 flex items-start gap-2.5 text-xs text-slate-600 dark:text-dark-300">
                <Sparkles size={16} className="text-primary-500 shrink-0 mt-0.5" />
                <span>
                  L'enregistrement mettra à jour automatiquement le statut juridique et la phase du projet dans le profil de l'incubé s'il s'agit de la séance la plus récente.
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
    </div>
  );
}
