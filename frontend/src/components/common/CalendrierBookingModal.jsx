import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  Users, 
  Plus, 
  Check, 
  X, 
  Send,
  Building2,
  CalendarCheck,
  History,
  CalendarDays,
  ExternalLink,
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  MapPin,
  Search,
  Filter
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { generateGoogleCalendarUrl, downloadIcsFile } from '../../utils/calendarHelper';

const JOURS_SEMAINE = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MOIS_NOMS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export default function CalendrierBookingModal({ 
  isOpen, 
  onClose, 
  incubesList = [], 
  currentAccompagnateurNom = 'Accompagnateur IDS',
  initialIncubeId = null,
  onSuccess = null
}) {
  const navigate = useNavigate();
  const [rdvList, setRdvList] = useState([]);
  const [activeTab, setActiveTab] = useState('calendrier'); // 'calendrier' | 'prochains' | 'historique' | 'nouveau'
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedIncubeIds, setSelectedIncubeIds] = useState(initialIncubeId ? [initialIncubeId] : []);
  const [heureRdv, setHeureRdv] = useState('10:00');
  const [duree, setDuree] = useState('1h');
  const [sujet, setSujet] = useState('');
  const [commentaireEmail, setCommentaireEmail] = useState('');
  const [lieu, setLieu] = useState('Bureaux Incubateur IDS / Fablab');
  const [incubeSearch, setIncubeSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // État du mois affiché dans le calendrier visuel
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [activeDayFilter, setActiveDayFilter] = useState(null); // format 'YYYY-MM-DD'

  // Charger les rendez-vous
  const fetchRendezVous = async () => {
    setLoading(true);
    try {
      const res = await api.get('/rendezvous');
      if (Array.isArray(res.data)) {
        setRdvList(res.data);
      }
    } catch (err) {
      console.error('Erreur chargement rendez-vous:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRendezVous();
      if (initialIncubeId) {
        setSelectedIncubeIds([initialIncubeId]);
      }
    }
  }, [isOpen, initialIncubeId]);

  if (!isOpen) return null;

  // Calculer Prochains RDV vs Historique
  const todayStr = new Date().toISOString().split('T')[0];

  const prochainsRdv = rdvList
    .filter(r => r.statut !== 'annule' && (r.dateRdv >= todayStr || r.statut === 'programme'))
    .sort((a, b) => a.dateRdv.localeCompare(b.dateRdv) || a.heureRdv.localeCompare(b.heureRdv));

  const historiqueRdv = rdvList
    .filter(r => (r.dateRdv < todayStr && r.statut !== 'programme') || r.statut === 'effectue' || r.statut === 'annule')
    .sort((a, b) => b.dateRdv.localeCompare(a.dateRdv) || b.heureRdv.localeCompare(a.heureRdv));

  const toggleIncubeSelection = (incubeId) => {
    setSelectedIncubeIds(prev => 
      prev.includes(incubeId)
        ? prev.filter(id => id !== incubeId)
        : [...prev, incubeId]
    );
  };

  const handleCreateRdv = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!sujet.trim()) {
      toast.error("Veuillez saisir le sujet du rendez-vous !");
      return;
    }
    if (selectedIncubeIds.length === 0) {
      toast.error("Veuillez sélectionner au moins un incubé !");
      return;
    }

    const selectedIncubesNoms = incubesList
      .filter(i => selectedIncubeIds.includes(i.id) || selectedIncubeIds.includes(String(i.id)))
      .map(i => i.nom_incube)
      .join(', ');

    setIsSubmitting(true);
    try {
      const payload = {
        accompagnateurNom: currentAccompagnateurNom,
        incubeIds: selectedIncubeIds,
        incubeNoms: selectedIncubesNoms || 'Incubés',
        dateRdv: selectedDate,
        heureRdv,
        duree,
        sujet: sujet.trim(),
        commentaireEmail: commentaireEmail.trim(),
        lieu
      };

      const res = await api.post('/rendezvous/creer', payload);
      const createdRdv = res.data?.data || payload;

      toast.success("📅 Rendez-vous planifié et invitation transmise par email !", { icon: '✅' });
      setSujet('');
      setCommentaireEmail('');
      setSelectedIncubeIds(initialIncubeId ? [initialIncubeId] : []);
      fetchRendezVous();
      if (onSuccess) onSuccess();
      setActiveTab('prochains');
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la création du rendez-vous");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarquerEffectue = async (rdvId) => {
    try {
      await api.put(`/rendezvous/${rdvId}`, { statut: 'effectue' });
      toast.success("Rendez-vous marqué comme effectué !", { icon: '✅' });
      fetchRendezVous();
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const handleDeleteRdv = async (rdvId) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce rendez-vous ?")) return;
    try {
      await api.delete(`/rendezvous/${rdvId}`);
      toast.success("Rendez-vous supprimé");
      fetchRendezVous();
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error("Erreur lors de la suppression");
    }
  };

  // Logique du Calendrier Visuel Mensuel
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const firstDayIndex = (new Date(calendarYear, calendarMonth, 1).getDay() + 6) % 7; // Lundi = 0

  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(calendarYear - 1);
    } else {
      setCalendarMonth(calendarMonth - 1);
    }
    setActiveDayFilter(null);
  };

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(calendarYear + 1);
    } else {
      setCalendarMonth(calendarMonth + 1);
    }
    setActiveDayFilter(null);
  };

  const handleToday = () => {
    const now = new Date();
    setCalendarMonth(now.getMonth());
    setCalendarYear(now.getFullYear());
    setActiveDayFilter(todayStr);
  };

  // Map des RDV par date string 'YYYY-MM-DD'
  const rdvByDateMap = useMemo(() => {
    const map = {};
    rdvList.forEach(r => {
      if (!map[r.dateRdv]) map[r.dateRdv] = [];
      map[r.dateRdv].push(r);
    });
    return map;
  }, [rdvList]);

  // Filtrage des incubés dans le formulaire
  const filteredIncubesForSelect = incubesList.filter(i => 
    !incubeSearch || 
    i.nom_incube?.toLowerCase().includes(incubeSearch.toLowerCase()) ||
    i.pp_numero?.toLowerCase().includes(incubeSearch.toLowerCase())
  );

  // Helper pour extraire les incubés associés au RDV
  function resolveIncubesForRdv(rdv) {
    if (!rdv) return [];
    const rawIds = rdv.incubeIds;
    let ids = [];
    if (Array.isArray(rawIds)) {
      ids = rawIds;
    } else if (typeof rawIds === 'string' && rawIds.trim()) {
      try {
        const parsed = JSON.parse(rawIds);
        if (Array.isArray(parsed)) ids = parsed;
        else if (parsed) ids = [parsed];
      } catch {
        ids = rawIds.split(',').map(s => s.trim().replace(/[\[\]"']/g, '')).filter(Boolean);
      }
    } else if (rawIds) {
      ids = [rawIds];
    }

    if (ids.length > 0) {
      return ids.map(id => {
        const found = (incubesList || []).find(i => String(i.id) === String(id));
        return {
          id: found ? found.id : id,
          nom: found?.nom_incube || rdv.incubeNoms || `Incubé #${id}`
        };
      });
    }

    if (initialIncubeId && rdv.incubeNoms) {
      return [{ id: initialIncubeId, nom: rdv.incubeNoms }];
    }

    const rawNoms = rdv.incubeNoms;
    if (rawNoms && rawNoms !== '—') {
      const names = rawNoms.split(',').map(s => s.trim()).filter(Boolean);
      return names.map(name => {
        const norm = name.toLowerCase().trim();
        const found = (incubesList || []).find(i => {
          const iNom = (i.nom_incube || '').toLowerCase().trim();
          return iNom === norm || iNom.includes(norm) || norm.includes(iNom);
        });
        return {
          id: found?.id || null,
          nom: found?.nom_incube || name
        };
      });
    }

    return [];
  }

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-dark-900 text-slate-900 dark:text-white rounded-3xl p-5 sm:p-7 max-w-5xl w-full border border-slate-200 dark:border-dark-700 space-y-5 shadow-2xl my-6 max-h-[92vh] flex flex-col">
        
        {/* EN-TÊTE MODALE AVEC LÉGENDE STATUT */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-dark-800 pb-4 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black shadow-inner">
              <CalendarIcon size={26} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
                Booking & Calendrier des Rendez-vous
              </h2>
              <p className="text-xs text-slate-500 dark:text-dark-400">
                Planification des entretiens d'accompagnement & synchronisation Google Calendar
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Légende rapide */}
            <div className="hidden md:flex items-center gap-2 text-[10px] font-bold px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-dark-800 border border-slate-200 dark:border-dark-700">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Prochain RDV
              </span>
              <span className="text-slate-300 dark:text-dark-600">|</span>
              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span> Aujourd'hui
              </span>
              <span className="text-slate-300 dark:text-dark-600">|</span>
              <span className="flex items-center gap-1 text-slate-500 dark:text-dark-400">
                <span className="w-2 h-2 rounded-full bg-slate-400"></span> Historique
              </span>
            </div>

            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-dark-800 dark:hover:bg-dark-700 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* BARRE DE NAVIGATION DU MOIS (AU-DESSUS POUR L'ONGLET CALENDRIER) */}
        {activeTab === 'calendrier' && (
          <div className="flex items-center justify-between bg-slate-50 dark:bg-dark-800/60 p-3 rounded-2xl border border-slate-200 dark:border-dark-700 shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-dark-700 text-slate-700 dark:text-dark-200"
              >
                <ChevronLeft size={18} />
              </button>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white capitalize min-w-[170px] text-center">
                {MOIS_NOMS[calendarMonth]} {calendarYear}
              </h3>
              <button
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-dark-700 text-slate-700 dark:text-dark-200"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleToday}
                className="px-3 py-1 text-xs font-bold rounded-lg bg-slate-200 dark:bg-dark-700 hover:bg-slate-300 dark:hover:bg-dark-600"
              >
                Aujourd'hui
              </button>
              {activeDayFilter && (
                <button
                  onClick={() => setActiveDayFilter(null)}
                  className="text-xs text-amber-600 hover:underline font-bold"
                >
                  Effacer filtre ({new Date(activeDayFilter).toLocaleDateString('fr-FR')})
                </button>
              )}
            </div>
          </div>
        )}

        {/* MENU D'ONGLETS / NAVIGATION PRINCIPALE DE BOOKING (EN DESSOUS DU MOIS ET EN HAUT DU CALENDRIER) */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 shrink-0 border-b border-slate-100 dark:border-dark-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setActiveTab('calendrier'); setActiveDayFilter(null); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                activeTab === 'calendrier'
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                  : 'bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70'
              }`}
            >
              <CalendarDays size={15} />
              <span>Vue Calendrier</span>
            </button>

            <button
              onClick={() => setActiveTab('prochains')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                activeTab === 'prochains'
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                  : 'bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70'
              }`}
            >
              <Clock size={15} />
              <span>Prochains Rendez-vous</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                activeTab === 'prochains' ? 'bg-white text-amber-600' : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
              }`}>
                {prochainsRdv.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('historique')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                activeTab === 'historique'
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                  : 'bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70'
              }`}
            >
              <History size={15} />
              <span>Historique ({historiqueRdv.length})</span>
            </button>
          </div>

          <button
            onClick={() => setActiveTab('nouveau')}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm ${
              activeTab === 'nouveau'
                ? 'bg-emerald-600 text-white ring-2 ring-emerald-400/40'
                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
            }`}
          >
            <Plus size={15} />
            <span>Planifier un RDV</span>
          </button>
        </div>

        {/* CONTENU PRINCIPAL DE L'ONGLET SÉLECTIONNÉ */}
        <div className="flex-1 overflow-y-auto pr-1">

          {/* ================= ONGLET 1 : VUE CALENDRIER INTERACTIF ================= */}
          {activeTab === 'calendrier' && (
            <div className="space-y-5">
              {/* Grille du Calendrier */}
              <div className="border border-slate-200 dark:border-dark-700 rounded-2xl overflow-hidden bg-white dark:bg-dark-900 shadow-sm">
                {/* Jours de la semaine */}
                <div className="grid grid-cols-7 bg-slate-100/80 dark:bg-dark-800 text-center text-xs font-black text-slate-600 dark:text-dark-300 py-2.5 border-b border-slate-200 dark:border-dark-700">
                  {JOURS_SEMAINE.map(j => <div key={j}>{j}</div>)}
                </div>

                {/* Cases des jours */}
                <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-dark-800">
                  {/* Cases vides pour le décalage */}
                  {Array.from({ length: firstDayIndex }).map((_, idx) => (
                    <div key={`empty-${idx}`} className="h-20 sm:h-24 bg-slate-50/40 dark:bg-dark-800/20 p-1.5"></div>
                  ))}

                  {/* Jours du mois */}
                  {Array.from({ length: daysInMonth }).map((_, idx) => {
                    const dayNum = idx + 1;
                    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                    const isToday = dateStr === todayStr;
                    const isSelected = activeDayFilter === dateStr;
                    const dayRdvs = rdvByDateMap[dateStr] || [];

                    return (
                      <div
                        key={dayNum}
                        onClick={() => {
                          setActiveDayFilter(activeDayFilter === dateStr ? null : dateStr);
                        }}
                        className={`h-20 sm:h-24 p-1.5 transition-all cursor-pointer flex flex-col justify-between group ${
                          isSelected
                            ? 'bg-amber-500/15 border-2 border-amber-500 rounded-lg'
                            : isToday
                            ? 'bg-blue-500/10'
                            : 'hover:bg-slate-50 dark:hover:bg-dark-800/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-black w-6 h-6 rounded-full flex items-center justify-center ${
                            isToday 
                              ? 'bg-blue-600 text-white' 
                              : isSelected
                              ? 'bg-amber-600 text-white'
                              : 'text-slate-700 dark:text-dark-200'
                          }`}>
                            {dayNum}
                          </span>

                          {dayRdvs.length > 0 && (
                            <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-amber-500 text-white">
                              {dayRdvs.length}
                            </span>
                          )}
                        </div>

                        {/* Badges des RDV sur la case */}
                        <div className="space-y-1 overflow-hidden">
                          {dayRdvs.slice(0, 2).map(r => (
                            <div
                              key={r.id}
                              className={`text-[9px] font-bold truncate px-1 py-0.5 rounded ${
                                r.dateRdv < todayStr
                                  ? 'bg-slate-200 dark:bg-dark-700 text-slate-600'
                                  : 'bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/30'
                              }`}
                              title={`${r.heureRdv} - ${r.sujet} (${r.incubeNoms})`}
                            >
                              {r.heureRdv} {r.sujet}
                            </div>
                          ))}
                          {dayRdvs.length > 2 && (
                            <span className="text-[9px] text-slate-400 font-bold block text-center">
                              +{dayRdvs.length - 2} autre(s)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rendez-vous du jour sélectionné ou de tout le mois */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <CalendarCheck size={16} className="text-amber-500" />
                    {activeDayFilter ? (
                      <span>Rendez-vous du {new Date(activeDayFilter).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    ) : (
                      <span>Tous les rendez-vous du mois ({MOIS_NOMS[calendarMonth]} {calendarYear})</span>
                    )}
                  </h4>

                  {activeDayFilter && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDate(activeDayFilter);
                        setActiveTab('nouveau');
                      }}
                      className="btn btn-sm btn-primary flex items-center gap-1"
                    >
                      <Plus size={14} /> Planifier pour ce jour
                    </button>
                  )}
                </div>

                {/* Liste des cartes de RDV */}
                {(() => {
                  const filteredMonthRdvs = rdvList.filter(r => {
                    if (activeDayFilter) return r.dateRdv === activeDayFilter;
                    const rDate = new Date(r.dateRdv);
                    return rDate.getMonth() === calendarMonth && rDate.getFullYear() === calendarYear;
                  });

                  if (filteredMonthRdvs.length === 0) {
                    return (
                      <div className="text-center py-8 bg-slate-50 dark:bg-dark-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-dark-700 text-slate-400 text-xs font-bold">
                        Aucun rendez-vous sur cette période.
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {filteredMonthRdvs.map(rdv => renderRdvCard(rdv))}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ================= ONGLET 2 : PROCHAINS RENDEZ-VOUS ================= */}
          {activeTab === 'prochains' && (
            <div className="space-y-4">
              {prochainsRdv.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 dark:bg-dark-800/40 rounded-2xl border-2 border-dashed border-slate-200 dark:border-dark-700 text-slate-400 space-y-2">
                  <Clock size={32} className="mx-auto text-slate-300" />
                  <p className="text-xs font-bold">Aucun prochain rendez-vous planifié.</p>
                  <button
                    onClick={() => setActiveTab('nouveau')}
                    className="btn btn-sm btn-primary mt-2"
                  >
                    <Plus size={14} /> Planifier un rendez-vous maintenant
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {prochainsRdv.map(rdv => renderRdvCard(rdv))}
                </div>
              )}
            </div>
          )}

          {/* ================= ONGLET 3 : HISTORIQUE DES RENDEZ-VOUS ================= */}
          {activeTab === 'historique' && (
            <div className="space-y-4">
              {historiqueRdv.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 dark:bg-dark-800/40 rounded-2xl border-2 border-dashed border-slate-200 dark:border-dark-700 text-slate-400 space-y-2">
                  <History size={32} className="mx-auto text-slate-300" />
                  <p className="text-xs font-bold">Aucun historique de rendez-vous pour le moment.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {historiqueRdv.map(rdv => renderRdvCard(rdv, true))}
                </div>
              )}
            </div>
          )}

          {/* ================= ONGLET 4 : FORMULAIRE NOUVEAU RDV ================= */}
          {activeTab === 'nouveau' && (
            <div className="max-w-2xl mx-auto space-y-5 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <Plus size={18} className="text-emerald-500" /> Planifier un Rendez-vous d'Accompagnement
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-dark-400">
                    Renseignez les détails. Une notification email et un lien Google Calendar seront générés.
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateRdv} className="space-y-4 bg-slate-50 dark:bg-dark-800/60 p-5 rounded-2xl border border-slate-200 dark:border-dark-700">
                
                {/* Date, Heure, Durée */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-bold block mb-1">Date *</label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="input !py-2 !text-xs font-bold"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold block mb-1">Heure de début *</label>
                    <input
                      type="time"
                      value={heureRdv}
                      onChange={(e) => setHeureRdv(e.target.value)}
                      className="input !py-2 !text-xs font-bold"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold block mb-1">Durée</label>
                    <select
                      value={duree}
                      onChange={(e) => setDuree(e.target.value)}
                      className="input !py-2 !text-xs font-bold"
                    >
                      <option value="30min">30 minutes</option>
                      <option value="1h">1 heure</option>
                      <option value="1h30">1h 30</option>
                      <option value="2h">2 heures</option>
                    </select>
                  </div>
                </div>

                {/* Sujet */}
                <div>
                  <label className="text-[11px] font-bold block mb-1">Sujet de l'accompagnement / Ordre du jour *</label>
                  <input
                    type="text"
                    placeholder="ex: Suivi Plan d'action M+2, Modèle économique & Validation technique"
                    value={sujet}
                    onChange={(e) => setSujet(e.target.value)}
                    className="input !py-2 !text-xs font-bold"
                    required
                  />
                </div>

                {/* Lieu */}
                <div>
                  <label className="text-[11px] font-bold block mb-1">Lieu de réunion</label>
                  <input
                    type="text"
                    placeholder="Bureaux Incubateur IDS / Fablab ou Lien Visio Google Meet"
                    value={lieu}
                    onChange={(e) => setLieu(e.target.value)}
                    className="input !py-2 !text-xs"
                  />
                </div>

                {/* Sélection des Incubés */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold block">
                      Incubé(s) participant(s) *
                    </label>
                    <span className="text-[10px] font-black text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">
                      {selectedIncubeIds.length} sélectionné(s)
                    </span>
                  </div>

                  {/* Barre de recherche d'incubé */}
                  <div className="relative mb-2">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filtrer un incubé par nom ou N° PP..."
                      value={incubeSearch}
                      onChange={e => setIncubeSearch(e.target.value)}
                      className="input pl-8 !py-1.5 !text-xs"
                    />
                  </div>

                  <div className="max-h-36 overflow-y-auto space-y-1 p-2 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl">
                    {filteredIncubesForSelect.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-2">Aucun incubé trouvé</p>
                    ) : filteredIncubesForSelect.map((inc) => {
                      const isSelected = selectedIncubeIds.includes(inc.id) || selectedIncubeIds.includes(String(inc.id));
                      return (
                        <div
                          key={inc.id}
                          onClick={() => toggleIncubeSelection(inc.id)}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                            isSelected
                              ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold border border-amber-500/40'
                              : 'hover:bg-slate-100 dark:hover:bg-dark-800 text-slate-700 dark:text-dark-200'
                          }`}
                        >
                          <span className="flex items-center gap-2 truncate">
                            <User size={13} className="text-amber-500 shrink-0" /> 
                            <span className="truncate">{inc.nom_incube} {inc.pp_numero ? `(${inc.pp_numero})` : ''}</span>
                          </span>
                          {isSelected && <Check size={14} className="text-amber-600 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Message d'invitation Email */}
                <div>
                  <label className="text-[11px] font-bold block mb-1">
                    Message d'invitation / Consignes préalables :
                  </label>
                  <textarea
                    rows={2}
                    placeholder="ex: Merci de vous munir des fiches de suivi d'objectifs et du tableau de trésorerie..."
                    value={commentaireEmail}
                    onChange={(e) => setCommentaireEmail(e.target.value)}
                    className="input !py-2 !text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20 transition-all cursor-pointer"
                >
                  <Send size={15} /> {isSubmitting ? "Planification en cours..." : "Confirmer le Rendez-vous"}
                </button>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>,
    document.body
  );

  // Rendu de carte de rendez-vous avec boutons d'action Google Calendar & ICS
  function renderRdvCard(rdv, isHistory = false) {
    const isToday = rdv.dateRdv === todayStr;
    const gcalUrl = generateGoogleCalendarUrl(rdv);
    const incubesForRdv = resolveIncubesForRdv(rdv);

    return (
      <div
        key={rdv.id}
        className={`p-4 rounded-2xl border transition-all space-y-3 flex flex-col justify-between ${
          isHistory
            ? 'bg-slate-50/70 dark:bg-dark-800/40 border-slate-200 dark:border-dark-700 opacity-80'
            : isToday
            ? 'bg-blue-500/5 dark:bg-blue-500/10 border-blue-500/40 shadow-sm'
            : 'bg-white dark:bg-dark-800/80 border-slate-200 dark:border-dark-700 shadow-sm hover:shadow-md'
        }`}
      >
        <div>
          {/* Header de la carte : Date, Heure & Badge */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 text-xs font-black">
              {isToday ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-600 text-white font-black animate-pulse">
                  🔵 Aujourd'hui
                </span>
              ) : isHistory ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-200 dark:bg-dark-700 text-slate-600 dark:text-dark-300 font-bold">
                  ⚪ Passé / Effectué
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

          {/* Sujet */}
          <h4 className="font-black text-sm text-slate-900 dark:text-white leading-tight">
            {rdv.sujet}
          </h4>

          {/* Détails : Incubé(s) & Accompagnateur */}
          <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-dark-300">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Users size={13} className="text-amber-500 shrink-0" />
              {incubesForRdv.length > 0 ? (
                <div className="inline-flex items-center gap-1 flex-wrap">
                  {incubesForRdv.map((inc, idx) => (
                    <span key={inc.id || idx} className="inline-flex items-center">
                      {inc.id ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onClose) onClose();
                            navigate(`/incube/${inc.id}`);
                          }}
                          className="font-bold text-slate-800 dark:text-slate-100 hover:text-amber-600 dark:hover:text-amber-400 hover:underline inline-flex items-center gap-1 group cursor-pointer transition-colors text-left"
                          title={`Cliquer pour voir la fiche et les informations de ${inc.nom}`}
                        >
                          <span>{inc.nom}</span>
                          <ExternalLink size={11} className="text-amber-500 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
                        </button>
                      ) : (
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {inc.nom}
                        </span>
                      )}
                      {idx < incubesForRdv.length - 1 && (
                        <span className="text-slate-400 font-bold mr-0.5">,</span>
                      )}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {rdv.incubeNoms || '—'}
                </span>
              )}
            </div>

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

        {/* Boutons d'action : Google Calendar, ICS, Effectué, Supprimer */}
        <div className="pt-2 border-t border-slate-100 dark:border-dark-700/60 flex items-center justify-between gap-1 flex-wrap">
          <div className="flex items-center gap-1.5">
            {/* BOUTON GOOGLE CALENDAR (Lien direct pour synchroniser sur le calendrier de chaque admin) */}
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

            {/* Export ICS pour Outlook / Apple */}
            <button
              type="button"
              onClick={() => downloadIcsFile(rdv)}
              className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-dark-700 text-slate-500 hover:text-slate-900"
              title="Télécharger fichier .ICS (Outlook, Apple Calendar)"
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
              onClick={() => handleDeleteRdv(rdv.id)}
              className="p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/30 text-slate-400 hover:text-rose-600 transition-colors"
              title="Supprimer ce rendez-vous"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    );
  }
}
