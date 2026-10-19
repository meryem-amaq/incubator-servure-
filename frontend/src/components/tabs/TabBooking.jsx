import { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Plus, 
  ExternalLink, 
  Download, 
  CheckCircle2, 
  History, 
  MapPin, 
  CalendarDays,
  Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { generateGoogleCalendarUrl, downloadIcsFile } from '../../utils/calendarHelper';
import CalendrierBookingModal from '../common/CalendrierBookingModal';

export default function TabBooking({ incube, onUpdate }) {
  const [rdvList, setRdvList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [subTab, setSubTab] = useState('prochains'); // 'prochains' | 'historique' | 'tous'

  const loadRdvs = async () => {
    if (!incube?.id) return;
    setLoading(true);
    try {
      const res = await api.get(`/rendezvous?incubeId=${incube.id}`);
      if (Array.isArray(res.data)) {
        setRdvList(res.data);
      }
    } catch (err) {
      console.error("Erreur chargement rendez-vous incubé:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRdvs();
  }, [incube?.id]);

  const todayStr = new Date().toISOString().split('T')[0];

  const prochainsRdv = rdvList
    .filter(r => r.statut !== 'annule' && (r.dateRdv >= todayStr || r.statut === 'programme'))
    .sort((a, b) => a.dateRdv.localeCompare(b.dateRdv) || a.heureRdv.localeCompare(b.heureRdv));

  const historiqueRdv = rdvList
    .filter(r => (r.dateRdv < todayStr && r.statut !== 'programme') || r.statut === 'effectue' || r.statut === 'annule')
    .sort((a, b) => b.dateRdv.localeCompare(a.dateRdv) || b.heureRdv.localeCompare(a.heureRdv));

  const handleMarquerEffectue = async (rdvId) => {
    try {
      await api.put(`/rendezvous/${rdvId}`, { statut: 'effectue' });
      toast.success("Rendez-vous marqué comme effectué !", { icon: '✅' });
      loadRdvs();
      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const handleDelete = async (rdvId) => {
    if (!window.confirm("Supprimer ce rendez-vous ?")) return;
    try {
      await api.delete(`/rendezvous/${rdvId}`);
      toast.success("Rendez-vous supprimé");
      loadRdvs();
    } catch (err) {
      toast.error("Erreur suppression");
    }
  };

  const displayedList = subTab === 'prochains' 
    ? prochainsRdv 
    : subTab === 'historique' 
    ? historiqueRdv 
    : rdvList;

  return (
    <div className="space-y-5">
      {/* En-tête de l'onglet avec résumé et bouton d'action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarIcon size={20} className="text-amber-500" />
            Rendez-vous d'Accompagnement & Booking
          </h2>
          <p className="text-xs text-slate-500 dark:text-dark-400">
            Suivi des séances de coaching, calendrier des entretiens et synchronisation Google Calendar pour {incube?.nom_incube}.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary btn-sm flex items-center gap-1.5 shadow-md shadow-primary-500/20"
        >
          <Plus size={15} />
          <span>Planifier un rendez-vous</span>
        </button>
      </div>

      {/* Menu / Légende des sous-sections */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-dark-800/60 p-2.5 rounded-2xl border border-slate-200 dark:border-dark-700">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSubTab('prochains')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              subTab === 'prochains'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-white dark:bg-dark-800 text-slate-600 dark:text-dark-300 hover:bg-slate-100'
            }`}
          >
            <Clock size={13} />
            <span>Prochains RDV ({prochainsRdv.length})</span>
          </button>

          <button
            onClick={() => setSubTab('historique')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              subTab === 'historique'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-white dark:bg-dark-800 text-slate-600 dark:text-dark-300 hover:bg-slate-100'
            }`}
          >
            <History size={13} />
            <span>Historique ({historiqueRdv.length})</span>
          </button>

          <button
            onClick={() => setSubTab('tous')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              subTab === 'tous'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-white dark:bg-dark-800 text-slate-600 dark:text-dark-300 hover:bg-slate-100'
            }`}
          >
            <span>Tous ({rdvList.length})</span>
          </button>
        </div>

        {/* Légende */}
        <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500 dark:text-dark-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Prochain RDV
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span> Aujourd'hui
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span> Effectué
          </span>
        </div>
      </div>

      {/* Liste des rendez-vous */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-xs">Chargement des rendez-vous...</div>
      ) : displayedList.length === 0 ? (
        <div className="card text-center py-14 space-y-3">
          <CalendarDays size={36} className="mx-auto text-slate-300 dark:text-dark-600" />
          <h3 className="font-bold text-sm text-slate-700 dark:text-dark-300">
            {subTab === 'prochains' 
              ? 'Aucun prochain rendez-vous planifié pour cet incubé'
              : 'Aucun historique de rendez-vous'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-dark-400 max-w-sm mx-auto">
            Planifiez une séance de travail ou un point d'étape mensuel avec {incube?.nom_incube}.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="btn btn-primary btn-sm inline-flex items-center gap-1.5 mt-2"
          >
            <Plus size={14} /> Planifier maintenant
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {displayedList.map(rdv => {
            const isToday = rdv.dateRdv === todayStr;
            const isHistory = (rdv.dateRdv < todayStr && rdv.statut !== 'programme') || rdv.statut === 'effectue';
            const gcalUrl = generateGoogleCalendarUrl(rdv);

            return (
              <div
                key={rdv.id}
                className={`p-4 rounded-2xl border transition-all space-y-3 flex flex-col justify-between ${
                  isHistory
                    ? 'bg-slate-50/70 dark:bg-dark-800/40 border-slate-200 dark:border-dark-700 opacity-85'
                    : isToday
                    ? 'bg-blue-500/5 dark:bg-blue-500/10 border-blue-500/40 shadow-sm'
                    : 'bg-white dark:bg-dark-800/80 border-slate-200 dark:border-dark-700 shadow-sm hover:shadow-md'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 text-xs font-black">
                      {isToday ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-600 text-white font-black animate-pulse">
                          🔵 Aujourd'hui
                        </span>
                      ) : isHistory ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-200 dark:bg-dark-700 text-slate-600 dark:text-dark-300 font-bold">
                          ⚪ Effectué
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold">
                          🟢 À venir
                        </span>
                      )}

                      <span className="text-slate-700 dark:text-dark-200">
                        {new Date(rdv.dateRdv).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} à {rdv.heureRdv}
                      </span>
                    </div>

                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400">
                      {rdv.duree || '1h'}
                    </span>
                  </div>

                  <h4 className="font-black text-sm text-slate-900 dark:text-white leading-tight">
                    {rdv.sujet}
                  </h4>

                  <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-dark-300">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-dark-400">
                      <MapPin size={12} className="text-slate-400 shrink-0" />
                      <span className="truncate">{rdv.lieu || 'Bureaux Incubateur IDS / Fablab'}</span>
                    </div>

                    {rdv.commentaireEmail && (
                      <p className="text-[11px] italic text-slate-500 dark:text-dark-400 bg-slate-100 dark:bg-dark-900/60 p-2 rounded-lg mt-1 border border-slate-200/60 dark:border-dark-700/60">
                        💬 "{rdv.commentaireEmail}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions Google Calendar & ICS */}
                <div className="pt-2 border-t border-slate-100 dark:border-dark-700/60 flex items-center justify-between gap-1 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    {/* LIEN GOOGLE CALENDAR DIRECT */}
                    <a
                      href={gcalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 text-[11px] font-extrabold rounded-lg bg-primary-500/10 hover:bg-primary-500/20 text-primary-700 dark:text-primary-300 border border-primary-500/30 flex items-center gap-1 transition-all"
                      title="Ajouter et synchroniser cet événement directement dans Google Calendar"
                    >
                      <CalendarIcon size={12} className="text-primary-600" />
                      <span>Google Calendar</span>
                      <ExternalLink size={10} className="opacity-70" />
                    </a>

                    <button
                      type="button"
                      onClick={() => downloadIcsFile(rdv)}
                      className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-dark-700 text-slate-500 hover:text-slate-900"
                      title="Télécharger fichier .ICS"
                    >
                      <Download size={13} />
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    {!isHistory && (
                      <button
                        type="button"
                        onClick={() => handleMarquerEffectue(rdv.id)}
                        className="px-2 py-1 text-[10px] font-bold rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center gap-1"
                        title="Marquer ce rendez-vous comme effectué"
                      >
                        <CheckCircle2 size={12} />
                        <span>Effectué</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(rdv.id)}
                      className="p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/30 text-slate-400 hover:text-rose-600 transition-colors"
                      title="Supprimer ce rendez-vous"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modale de Booking pour cet incubé */}
      <CalendrierBookingModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          loadRdvs();
          if (onUpdate) onUpdate();
        }}
        incubesList={incube ? [incube] : []}
        initialIncubeId={incube?.id}
        currentAccompagnateurNom={incube?.accompagnateur || 'Accompagnateur IDS'}
      />
    </div>
  );
}
