import { useState, useEffect, useMemo } from 'react';
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
  Filter,
  RefreshCw,
  GraduationCap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { generateGoogleCalendarUrl, downloadIcsFile } from '../utils/calendarHelper';

const JOURS_SEMAINE = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MOIS_NOMS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export default function BookingPage() {
  const navigate = useNavigate();
  const { user, isSuperAdmin } = useAuth();
  const [incubes, setIncubes] = useState([]);
  const [rdvList, setRdvList] = useState([]);
  const [reservationsList, setReservationsList] = useState([]);
  const [evenementsList, setEvenementsList] = useState([]);
  const [accompagnateursList, setAccompagnateursList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('calendrier'); // 'calendrier' | 'prochains' | 'historique' | 'nouveau'
  const [categorieFiltre, setCategorieFiltre] = useState('all'); // 'all' | 'rendezvous' | 'reservation' | 'evenement'
  const [accompagnateurFiltre, setAccompagnateurFiltre] = useState('all'); // 'all' | coach_id | coach_name

  // Formulaire de réservation
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedIncubeIds, setSelectedIncubeIds] = useState([]);
  const [selectedCoachId, setSelectedCoachId] = useState('');
  const [heureRdv, setHeureRdv] = useState('10:00');
  const [duree, setDuree] = useState('1h');
  const [sujet, setSujet] = useState('');
  const [commentaireEmail, setCommentaireEmail] = useState('');
  const [lieu, setLieu] = useState('Bureaux Incubateur IDS / Fablab');
  const [searchIncube, setSearchIncube] = useState('');

  // État du mois affiché dans le calendrier visuel
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [activeDayFilter, setActiveDayFilter] = useState(null); // 'YYYY-MM-DD'

  const loadData = async () => {
    setLoading(true);
    try {
      const [incubesRes, rdvRes, resRes, ateliersRes, adminsRes] = await Promise.all([
        api.get('/incubes'),
        api.get('/rendezvous'),
        api.get('/reservations').catch(() => ({ data: [] })),
        api.get('/ateliers').catch(() => ({ data: [] })),
        api.get('/users/admins').catch(() => ({ data: [] }))
      ]);
      if (Array.isArray(incubesRes.data)) setIncubes(incubesRes.data);
      if (Array.isArray(rdvRes.data)) setRdvList(rdvRes.data);
      if (Array.isArray(resRes.data)) setReservationsList(resRes.data);
      if (Array.isArray(adminsRes?.data)) setAccompagnateursList(adminsRes.data);

      if (Array.isArray(ateliersRes.data) && ateliersRes.data.length > 0) {
        setEvenementsList(ateliersRes.data);
      } else {
        const savedAteliers = localStorage.getItem('ids_ateliers_list');
        if (savedAteliers) {
          try {
            setEvenementsList(JSON.parse(savedAteliers));
          } catch(e) {
            setEvenementsList([]);
          }
        }
      }
    } catch (err) {
      console.error('Erreur chargement données booking:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];

  const isAtelierPasse = (dateStr) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    return d < today;
  };

  const isRealSuperAdmin = isSuperAdmin || user?.role === 'super_admin' || user?.role === 'administrateur';

  // Liste enrichie des accompagnateurs disponibles pour le filtrage
  const accompagnateursOptions = useMemo(() => {
    const map = new Map();

    // 1. Accompagnateurs de la base de données
    accompagnateursList.forEach(a => {
      const fullName = `${a.prenom ? a.prenom + ' ' : ''}${a.nom || ''}`.trim();
      if (fullName) {
        map.set(String(a.id), {
          id: String(a.id),
          nom: fullName,
          normalizedName: fullName.toLowerCase()
        });
      }
    });

    // 2. Extraire les accompagnateurs nommés dans les RDVs existants
    rdvList.forEach(r => {
      if (r.accompagnateurNom && r.accompagnateurNom.trim()) {
        const nom = r.accompagnateurNom.trim();
        const norm = nom.toLowerCase();
        const alreadyExists = Array.from(map.values()).some(
          c => c.normalizedName === norm || norm.includes(c.normalizedName) || c.normalizedName.includes(norm)
        );
        if (!alreadyExists) {
          const idKey = r.accompagnateurId ? String(r.accompagnateurId) : `nom-${norm}`;
          map.set(idKey, {
            id: idKey,
            nom: nom,
            normalizedName: norm
          });
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.nom.localeCompare(b.nom));
  }, [accompagnateursList, rdvList]);

  // Nombre de RDVs du mois affiché pour chaque accompagnateur
  const coachMonthlyCounts = useMemo(() => {
    const currentMonthPrefix = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}`;
    const counts = { total: 0 };

    rdvList.forEach(r => {
      const rdvDateStr = r.dateRdv ? String(r.dateRdv).split('T')[0] : '';
      if (rdvDateStr.startsWith(currentMonthPrefix)) {
        counts.total = (counts.total || 0) + 1;
      }
    });

    accompagnateursOptions.forEach(opt => {
      let count = 0;
      rdvList.forEach(r => {
        const rdvDateStr = r.dateRdv ? String(r.dateRdv).split('T')[0] : '';
        if (rdvDateStr.startsWith(currentMonthPrefix)) {
          const matchId = r.accompagnateurId && String(r.accompagnateurId) === opt.id;
          const rdvCoachName = (r.accompagnateurNom || '').toLowerCase().trim();
          const matchName = rdvCoachName && (
            rdvCoachName === opt.normalizedName ||
            rdvCoachName.includes(opt.normalizedName) ||
            opt.normalizedName.includes(rdvCoachName)
          );
          if (matchId || matchName) {
            count++;
          }
        }
      });
      counts[opt.id] = count;
    });

    return counts;
  }, [rdvList, calendarYear, calendarMonth, accompagnateursOptions]);

  const unifiedEvents = useMemo(() => {
    const events = [];

    // Helper pour vérifier la correspondance avec le filtre accompagnateur
    const matchesCoachFilter = (r) => {
      if (accompagnateurFiltre === 'all') return true;
      const selectedOpt = accompagnateursOptions.find(o => o.id === accompagnateurFiltre);
      if (!selectedOpt) return true;

      if (r.accompagnateurId && String(r.accompagnateurId) === selectedOpt.id) return true;
      if (r.accompagnateurNom) {
        const coachName = r.accompagnateurNom.toLowerCase().trim();
        return (
          coachName === selectedOpt.normalizedName ||
          coachName.includes(selectedOpt.normalizedName) ||
          selectedOpt.normalizedName.includes(coachName)
        );
      }
      return false;
    };

    // 1. Rendez-vous
    if (categorieFiltre === 'all' || categorieFiltre === 'rendezvous') {
      rdvList.forEach(r => {
        const isMyRdv = r.accompagnateurId === user?.id || (r.incubeIds && String(r.incubeIds).includes(String(user?.id)));
        if ((isRealSuperAdmin || isMyRdv) && matchesCoachFilter(r)) {
          events.push({
            id: `rdv-${r.id}`,
            originalId: r.id,
            type: 'rendezvous',
            date: r.dateRdv ? String(r.dateRdv).split('T')[0] : '',
            heure: r.heureRdv,
            duree: r.duree,
            titre: r.sujet,
            sousTitre: r.incubeNoms || '—',
            accompagnateurNom: r.accompagnateurNom || 'Accompagnateur IDS',
            accompagnateurId: r.accompagnateurId,
            lieu: r.lieu || 'Bureaux Incubateur IDS / Fablab',
            statut: r.statut,
            commentaire: r.commentaireEmail,
            originalData: r
          });
        }
      });
    }

    // 2. Réservations d'espaces (masquées si un accompagnateur spécifique est filtré)
    if (accompagnateurFiltre === 'all' && (categorieFiltre === 'all' || categorieFiltre === 'reservation')) {
      const isStaff = isSuperAdmin || ['super_admin', 'admin', 'administrateur', 'accompagnateur'].includes(user?.role);
      const uEmail = (user?.email || '').toLowerCase().trim();
      const uNom = (user?.nom || '').toLowerCase().trim();
      const uPrenom = (user?.prenom || '').toLowerCase().trim();

      reservationsList.forEach(r => {
        const rEmail = (r.emailIncube || r.email || '').toLowerCase().trim();
        const rNom = (r.nomIncube || r.nom || '').toLowerCase().trim();

        const isMyRes = Boolean(
          (r.incubeId && (String(r.incubeId) === String(user?.id) || String(r.incubeId) === String(user?.pp_id))) ||
          (uEmail && rEmail && (uEmail === rEmail || uEmail.includes(rEmail) || rEmail.includes(uEmail))) ||
          (uNom && rNom && (rNom.includes(uNom) || (uPrenom && rNom.includes(uPrenom))))
        );

        if (isStaff || isMyRes || user?.role !== 'incube') {
          const espaceLabel = r.espace === 'fablab' ? 'Fablab' : r.espace === 'studio' ? 'Studio Média' : 'Salle de réunion';
          const salleLabel = r.salleSpecifique ? `${espaceLabel} (${r.salleSpecifique})` : espaceLabel;
          events.push({
            id: `res-${r.id}`,
            originalId: r.id,
            type: 'reservation',
            date: r.dateReservation ? String(r.dateReservation).split('T')[0] : '',
            heure: r.heureDebut,
            duree: r.duree || (r.heureFin ? `${r.heureDebut}-${r.heureFin}` : '1h'),
            titre: `Réservation : ${salleLabel}`,
            sousTitre: r.nomIncube || '—',
            lieu: salleLabel,
            statut: r.statut,
            commentaire: r.motifUtilisation,
            originalData: r
          });
        }
      });
    }

    // 3. Ateliers & Formations (Séparés strictement)
    evenementsList.forEach(e => {
      // Si un accompagnateur est sélectionné, vérifier si l'atelier a ce coach comme formateur
      if (accompagnateurFiltre !== 'all') {
        const selectedOpt = accompagnateursOptions.find(o => o.id === accompagnateurFiltre);
        if (selectedOpt) {
          const formateurLower = (e.formateur || '').toLowerCase();
          const matchFormateur = formateurLower && (
            formateurLower.includes(selectedOpt.normalizedName) ||
            selectedOpt.normalizedName.includes(formateurLower)
          );
          if (!matchFormateur) return;
        }
      }

      const isMyEvent = user?.nom && e.formateur && String(e.formateur).toLowerCase().includes(String(user?.nom).toLowerCase());
      if (isRealSuperAdmin || isMyEvent) {
        // Détecter si c'est une formation pédagogique (Pré-Création ou Post-Création)
        let isFormation = false;
        let cleanLieu = 'Espace Incubateur';
        let cleanCommentaire = e.description;

        if (e.description) {
          try {
            const meta = JSON.parse(e.description);
            if (meta && typeof meta === 'object') {
              if (meta.typeParcours === 'pre-creation' || meta.typeParcours === 'post-creation') {
                isFormation = true;
              }
              if (meta.salle) cleanLieu = meta.salle;
              const parts = [];
              if (meta.moduleName) parts.push(`Module : ${meta.moduleName}`);
              if (meta.collaborateur) parts.push(`Collaborateur : ${meta.collaborateur}`);
              if (meta.salle) parts.push(`Lieu : ${meta.salle}`);
              if (parts.length > 0) cleanCommentaire = parts.join(' • ');
            }
          } catch (err) {}
        }

        const titreLower = (e.titre || '').toLowerCase().trim();
        if (
          titreLower.startsWith('[pré-création]') ||
          titreLower.startsWith('[pre-creation]') ||
          titreLower.startsWith('[post-création]') ||
          titreLower.startsWith('[post-creation]')
        ) {
          isFormation = true;
        }

        const type = isFormation ? 'formation' : 'evenement';

        // Filtrer selon la catégorie sélectionnée
        const matchesFilter =
          categorieFiltre === 'all' ||
          (categorieFiltre === 'formation' && isFormation) ||
          (categorieFiltre === 'evenement' && !isFormation);

        if (matchesFilter) {
          events.push({
            id: `${isFormation ? 'form' : 'evt'}-${e.id}`,
            originalId: e.id,
            type: type,
            date: e.date ? String(e.date).split('T')[0] : '',
            heure: e.heureDebut || '09:30',
            duree: e.duree || (e.heureFin ? `${e.heureDebut}-${e.heureFin}` : '1h'),
            titre: e.titre,
            sousTitre: e.formateur || (isFormation ? 'Formateur IDS' : 'Intervenant IDS'),
            lieu: cleanLieu,
            statut: isAtelierPasse(e.date) ? 'effectue' : 'programme',
            commentaire: cleanCommentaire,
            originalData: e
          });
        }
      }
    });
    
    return events;
  }, [rdvList, reservationsList, evenementsList, categorieFiltre, accompagnateurFiltre, accompagnateursOptions, user, isRealSuperAdmin]);

  const prochainsRdv = useMemo(() => {
    return unifiedEvents
      .filter(r => r.statut !== 'annule' && r.statut !== 'refuse' && (r.date >= todayStr || r.statut === 'programme'))
      .sort((a, b) => a.date.localeCompare(b.date) || a.heure.localeCompare(b.heure));
  }, [unifiedEvents, todayStr]);

  const historiqueRdv = useMemo(() => {
    return unifiedEvents
      .filter(r => (r.date < todayStr && r.statut !== 'programme') || r.statut === 'effectue' || r.statut === 'annule' || r.statut === 'refuse')
      .sort((a, b) => b.date.localeCompare(a.date) || b.heure.localeCompare(a.heure));
  }, [unifiedEvents, todayStr]);

  const toggleIncubeSelection = (incubeId) => {
    setSelectedIncubeIds(prev => 
      prev.includes(incubeId)
        ? prev.filter(id => id !== incubeId)
        : [...prev, incubeId]
    );
  };

  const handleCreateRdv = async (e) => {
    e.preventDefault();
    if (!sujet.trim()) {
      toast.error("Veuillez saisir le sujet du rendez-vous !");
      return;
    }
    if (selectedIncubeIds.length === 0) {
      toast.error("Veuillez sélectionner au moins un incubé !");
      return;
    }

    const selectedIncubesNoms = incubes
      .filter(i => selectedIncubeIds.includes(i.id) || selectedIncubeIds.includes(String(i.id)))
      .map(i => i.nom_incube)
      .join(', ');

    let accompagnateurNom = user ? `${user.prenom || ''} ${user.nom || ''}`.trim() : 'Accompagnateur IDS';
    let accompagnateurId = user?.id || null;

    if (isRealSuperAdmin && selectedCoachId) {
      const selectedCoach = accompagnateursOptions.find(o => o.id === selectedCoachId);
      if (selectedCoach) {
        accompagnateurNom = selectedCoach.nom;
        accompagnateurId = !isNaN(Number(selectedCoach.id)) ? Number(selectedCoach.id) : null;
      }
    }

    try {
      const payload = {
        accompagnateurNom,
        accompagnateurId,
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
      const created = res.data?.data || payload;

      toast.success("📅 Rendez-vous planifié et invitation transmise par email !", { icon: '✅' });
      setSujet('');
      setCommentaireEmail('');
      setSelectedIncubeIds([]);
      setSelectedCoachId('');
      loadData();
      setActiveTab('prochains');

      // Le lien Google Calendar reste accessible directement sur la carte du rendez-vous
      // (l'appel window.open après un await est automatiquement bloqué par la plupart des navigateurs)
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur création rendez-vous");
    }
  };

  const handleMarquerEffectue = async (rdvId) => {
    try {
      await api.put(`/rendezvous/${rdvId}`, { statut: 'effectue' });
      toast.success("Rendez-vous marqué comme effectué !", { icon: '✅' });
      loadData();
    } catch (err) {
      toast.error("Erreur mise à jour rendez-vous");
    }
  };

  const handleDeleteRdv = async (rdvId) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce rendez-vous ?")) return;
    try {
      await api.delete(`/rendezvous/${rdvId}`);
      toast.success("Rendez-vous supprimé");
      loadData();
    } catch (err) {
      toast.error("Erreur suppression");
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

  // Map des évènements par date
  const rdvByDateMap = useMemo(() => {
    const map = {};
    unifiedEvents.forEach(r => {
      if (!map[r.date]) map[r.date] = [];
      map[r.date].push(r);
    });
    return map;
  }, [unifiedEvents]);

  // Filtrage des incubés pour la sélection
  const filteredIncubes = useMemo(() => {
    return incubes.filter(i => 
      !searchIncube ||
      i.nom_incube?.toLowerCase().includes(searchIncube.toLowerCase()) ||
      i.raison_sociale?.toLowerCase().includes(searchIncube.toLowerCase()) ||
      i.pp_numero?.toLowerCase().includes(searchIncube.toLowerCase())
    );
  }, [incubes, searchIncube]);

  // Helper pour extraire les incubés associés à un événement (RDV ou Réservation)
  function resolveIncubesForEvent(event) {
    if (!event) return [];

    // 1. Si c'est une réservation d'espace
    if (event.type === 'reservation') {
      const incId = event.originalData?.incubeId;
      const nom = event.sousTitre || event.originalData?.nomIncube;
      if (incId) {
        const found = incubes.find(i => String(i.id) === String(incId));
        return [{ id: incId, nom: found?.nom_incube || nom || 'Incubé' }];
      }
      if (nom && nom !== '—') {
        const found = incubes.find(i => i.nom_incube?.toLowerCase().trim() === nom.toLowerCase().trim());
        return [{ id: found?.id || null, nom: found?.nom_incube || nom }];
      }
      return [];
    }

    // 2. Si c'est un rendez-vous
    if (event.type === 'rendezvous') {
      const rawIds = event.originalData?.incubeIds;
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

      // Si on a des IDs trouvés
      if (ids.length > 0) {
        return ids.map(id => {
          const found = incubes.find(i => String(i.id) === String(id));
          return {
            id: found ? found.id : id,
            nom: found?.nom_incube || `Incubé #${id}`
          };
        });
      }

      // Fallback si pas d'IDs : recherche par correspondance de nom dans la liste des incubés
      const rawNoms = event.originalData?.incubeNoms || event.sousTitre;
      if (rawNoms && rawNoms !== '—') {
        const names = rawNoms.split(',').map(s => s.trim()).filter(Boolean);
        return names.map(name => {
          const norm = name.toLowerCase().trim();
          const found = incubes.find(i => {
            const iNom = (i.nom_incube || '').toLowerCase().trim();
            return iNom === norm || iNom.includes(norm) || norm.includes(iNom);
          });
          return {
            id: found?.id || null,
            nom: found?.nom_incube || name
          };
        });
      }
    }

    return [];
  }

  return (
    <div className="slide-up space-y-6 w-full pb-10">
      


      {/* 1. BARRE DE NAVIGATION DU MOIS (AFFICHÉE EN HAUT POUR L'ONGLET CALENDRIER) */}
      {activeTab === 'calendrier' && (
        <div className="flex items-center justify-between bg-slate-50 dark:bg-dark-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-dark-700">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-dark-700 text-slate-700 dark:text-dark-200 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <h3 className="text-lg font-black text-slate-900 dark:text-white capitalize min-w-[200px] text-center">
              {MOIS_NOMS[calendarMonth]} {calendarYear}
            </h3>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-dark-700 text-slate-700 dark:text-dark-200 transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            {accompagnateurFiltre !== 'all' && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-500/30">
                <User size={12} className="text-amber-600" />
                <span>Coach : {accompagnateursOptions.find(o => o.id === accompagnateurFiltre)?.nom || accompagnateurFiltre}</span>
                <button
                  type="button"
                  onClick={() => setAccompagnateurFiltre('all')}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white ml-0.5"
                  title="Effacer le filtre coach"
                >
                  <X size={12} />
                </button>
              </span>
            )}
            <button
              onClick={handleToday}
              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-200 dark:bg-dark-700 hover:bg-slate-300 dark:hover:bg-dark-600 transition-colors"
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

      {/* 2. SOUS-MENU DE NAVIGATION (EN DESSOUS DU MOIS ET EN HAUT DU CALENDRIER) */}
      <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1 border-b border-slate-200 dark:border-dark-800">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setActiveTab('calendrier'); setActiveDayFilter(null); }}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'calendrier'
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                : 'bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70'
            }`}
          >
            <CalendarDays size={16} />
            <span>Vue Calendrier</span>
          </button>

          <button
            onClick={() => setActiveTab(activeTab === 'historique' ? 'historique' : 'prochains')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'prochains' || activeTab === 'historique'
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                : 'bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70'
            }`}
          >
            <Clock size={16} />
            <span>Vue Liste</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
              activeTab === 'prochains' || activeTab === 'historique' ? 'bg-white text-amber-600' : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
            }`}>
              {prochainsRdv.length + historiqueRdv.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Menu de Filtrage par Statut (À venir / Historique) pour la Vue Liste */}
          {(activeTab === 'prochains' || activeTab === 'historique') && (
            <div className="relative">
              <select
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value)}
                className="input !py-2.5 !px-8 !text-xs font-bold appearance-none bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 cursor-pointer text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-amber-500/50"
              >
                <option value="prochains">À venir ({prochainsRdv.length})</option>
                <option value="historique">Historique ({historiqueRdv.length})</option>
              </select>
              <History size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          )}

          {/* Menu de Filtrage par Catégorie */}
          <div className="relative">
            <select
              value={categorieFiltre}
              onChange={(e) => setCategorieFiltre(e.target.value)}
              className="input !py-2.5 !px-8 !text-xs font-bold appearance-none bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 cursor-pointer text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-amber-500/50"
              style={{ minWidth: '175px' }}
            >
              <option value="all">Toutes Catégories</option>
              <option value="formation">🎓 Formations</option>
              <option value="evenement">📅 Ateliers & Événements</option>
              <option value="rendezvous">🤝 Rendez-vous</option>
              <option value="reservation">🏢 Réservations d'espaces</option>
            </select>
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Menu de Filtrage par Accompagnateur (Accessible au Super Admin) */}
          {isRealSuperAdmin && (
            <div className="relative">
              <select
                value={accompagnateurFiltre}
                onChange={(e) => setAccompagnateurFiltre(e.target.value)}
                className={`input !py-2.5 !pl-8 !pr-8 !text-xs font-bold appearance-none cursor-pointer border transition-colors ${
                  accompagnateurFiltre !== 'all'
                    ? 'bg-amber-500/10 border-amber-500/50 text-amber-800 dark:text-amber-200 ring-2 ring-amber-500/20'
                    : 'bg-slate-50 dark:bg-dark-800 border-slate-200 dark:border-dark-700 text-slate-700 dark:text-slate-300'
                }`}
                style={{ minWidth: '220px' }}
                title="Filtrer par Accompagnateur"
              >
                <option value="all">
                  Tous les Accompagnateurs {coachMonthlyCounts.total ? `(${coachMonthlyCounts.total} ce mois)` : ''}
                </option>
                {accompagnateursOptions.map(coach => {
                  const countThisMonth = coachMonthlyCounts[coach.id] || 0;
                  return (
                    <option key={coach.id} value={coach.id}>
                      {coach.nom} ({countThisMonth} rdv ce mois)
                    </option>
                  );
                })}
              </select>
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              {accompagnateurFiltre !== 'all' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAccompagnateurFiltre('all');
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-dark-700 transition-colors"
                  title="Réinitialiser le filtre accompagnateur"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}

          <button
            onClick={loadData}
            className="btn btn-secondary btn-sm flex items-center gap-1.5"
            title="Rafraîchir"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Actualiser</span>
          </button>

          <button
            onClick={() => setActiveTab('nouveau')}
            className={`btn btn-sm flex items-center gap-1.5 font-black shadow-sm ${
              activeTab === 'nouveau'
                ? 'bg-emerald-600 text-white ring-2 ring-emerald-400/40'
                : 'btn-primary'
            }`}
          >
            <Plus size={15} />
            <span>Planifier un RDV</span>
          </button>
        </div>
      </div>

      {/* 3. CONTENU PRINCIPAL SELON L'ONGLET */}
      <div className="fade-in">

        {/* ================= ONGLET 1 : VUE CALENDRIER INTERACTIF ================= */}
        {activeTab === 'calendrier' && (
          <div className="space-y-6">
            {/* Grille du Calendrier */}
            <div className="border border-slate-200 dark:border-dark-700 rounded-3xl overflow-hidden bg-white dark:bg-dark-900 shadow-sm">
              {/* Jours de la semaine */}
              <div className="grid grid-cols-7 bg-slate-100/90 dark:bg-dark-800 text-center text-xs font-black text-slate-600 dark:text-dark-300 py-3 border-b border-slate-200 dark:border-dark-700">
                {JOURS_SEMAINE.map(j => <div key={j}>{j}</div>)}
              </div>

              {/* Cases des jours */}
              <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-dark-800">
                {/* Cases vides pour le décalage */}
                {Array.from({ length: firstDayIndex }).map((_, idx) => (
                  <div key={`empty-${idx}`} className="h-24 sm:h-28 bg-slate-50/40 dark:bg-dark-800/20 p-2"></div>
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
                      className={`h-24 sm:h-28 p-2 transition-all cursor-pointer flex flex-col justify-between group ${
                        isSelected
                          ? 'bg-amber-500/15 border-2 border-amber-500 rounded-xl'
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

                      {/* Événements sur la case */}
                      <div className="space-y-1 overflow-hidden">
                        {dayRdvs.slice(0, 2).map(r => (
                          <div
                            key={r.id}
                            className={`text-[9px] font-bold truncate px-1 py-0.5 rounded ${
                              r.date < todayStr
                                ? 'bg-slate-200 dark:bg-dark-700 text-slate-600'
                                : r.type === 'rendezvous'
                                ? 'bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/30'
                                : r.type === 'reservation'
                                ? 'bg-indigo-500/20 text-indigo-800 dark:text-indigo-200 border border-indigo-500/30'
                                : r.type === 'formation'
                                ? 'bg-blue-500/20 text-blue-800 dark:text-blue-200 border border-blue-500/30'
                                : 'bg-rose-500/20 text-rose-800 dark:text-rose-200 border border-rose-500/30'
                            }`}
                            title={`${r.heure} - ${r.titre} (${r.sousTitre})`}
                          >
                            {r.heure} {r.titre}
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

            {/* Rendez-vous du jour ou du mois */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <CalendarCheck size={18} className="text-amber-500" />
                  {activeDayFilter ? (
                    <span>Rendez-vous du {new Date(activeDayFilter).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  ) : (
                    <span>Rendez-vous du mois ({MOIS_NOMS[calendarMonth]} {calendarYear})</span>
                  )}
                </h4>

                {activeDayFilter && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDate(activeDayFilter);
                      setActiveTab('nouveau');
                    }}
                    className="btn btn-sm btn-primary flex items-center gap-1.5"
                  >
                    <Plus size={14} /> Planifier pour ce jour
                  </button>
                )}
              </div>

              {(() => {
                const filteredMonthRdvs = unifiedEvents.filter(r => {
                  if (activeDayFilter) return r.date === activeDayFilter;
                  if (!r.date) return false;
                  const [y, m] = r.date.split('-').map(Number);
                  return (m - 1) === calendarMonth && y === calendarYear;
                });

                if (filteredMonthRdvs.length === 0) {
                  return (
                    <div className="text-center py-10 bg-slate-50 dark:bg-dark-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-dark-700 text-slate-400 text-xs font-bold">
                      Aucun rendez-vous planifié sur cette période.
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              <div className="text-center py-16 bg-slate-50 dark:bg-dark-800/40 rounded-3xl border-2 border-dashed border-slate-200 dark:border-dark-700 text-slate-400 space-y-3">
                <Clock size={40} className="mx-auto text-slate-300" />
                <p className="text-sm font-bold">Aucun rendez-vous à venir.</p>
                <button
                  onClick={() => setActiveTab('nouveau')}
                  className="btn btn-sm btn-primary mt-1"
                >
                  <Plus size={14} /> Planifier un rendez-vous maintenant
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {prochainsRdv.map(rdv => renderRdvCard(rdv))}
              </div>
            )}
          </div>
        )}

        {/* ================= ONGLET 3 : HISTORIQUE DES RENDEZ-VOUS ================= */}
        {activeTab === 'historique' && (
          <div className="space-y-4">
            {historiqueRdv.length === 0 ? (
              <div className="text-center py-16 bg-slate-50 dark:bg-dark-800/40 rounded-3xl border-2 border-dashed border-slate-200 dark:border-dark-700 text-slate-400 space-y-2">
                <History size={40} className="mx-auto text-slate-300" />
                <p className="text-sm font-bold">Aucun historique de rendez-vous pour le moment.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {historiqueRdv.map(rdv => renderRdvCard(rdv, true))}
              </div>
            )}
          </div>
        )}

        {/* ================= ONGLET 4 : FORMULAIRE PLANIFICATION ================= */}
        {activeTab === 'nouveau' && (
          <div className="max-w-2xl mx-auto space-y-5 py-2">
            <div className="card p-6 border border-slate-200 dark:border-dark-700 shadow-sm space-y-5">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Plus size={20} className="text-emerald-500" /> Planifier un Rendez-vous d'Accompagnement
                </h3>
                <p className="text-xs text-slate-500 dark:text-dark-400 mt-1">
                  Les détails seront automatiquement enregistrés et synchronisés avec Google Calendar.
                </p>
              </div>

              <form onSubmit={handleCreateRdv} className="space-y-4">
                
                {/* Date, Heure, Durée */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold block mb-1">Date *</label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="input !py-2 !text-xs font-bold"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold block mb-1">Heure de début *</label>
                    <input
                      type="time"
                      value={heureRdv}
                      onChange={(e) => setHeureRdv(e.target.value)}
                      className="input !py-2 !text-xs font-bold"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold block mb-1">Durée</label>
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

                {/* Accompagnateur assigné (Super Admin) */}
                {isRealSuperAdmin && (
                  <div>
                    <label className="text-xs font-bold block mb-1">Coach / Accompagnateur responsable</label>
                    <select
                      value={selectedCoachId}
                      onChange={(e) => setSelectedCoachId(e.target.value)}
                      className="input !py-2 !text-xs font-bold"
                    >
                      <option value="">Par défaut ({user?.prenom} {user?.nom || 'Moi-même'})</option>
                      {accompagnateursOptions.map(coach => (
                        <option key={coach.id} value={coach.id}>
                          {coach.nom}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Sujet */}
                <div>
                  <label className="text-xs font-bold block mb-1">Sujet du Rendez-vous / Ordre du jour *</label>
                  <input
                    type="text"
                    placeholder="ex: Point d'avancement Business Plan & validation technique M+2"
                    value={sujet}
                    onChange={(e) => setSujet(e.target.value)}
                    className="input !py-2 !text-xs font-bold"
                    required
                  />
                </div>

                {/* Lieu */}
                <div>
                  <label className="text-xs font-bold block mb-1">Lieu de la réunion</label>
                  <input
                    type="text"
                    placeholder="Bureaux Incubateur IDS / Fablab ou Lien Visio"
                    value={lieu}
                    onChange={(e) => setLieu(e.target.value)}
                    className="input !py-2 !text-xs"
                  />
                </div>

                {/* Sélection des Incubés */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold block">
                      Sélectionner l'incubé (ou plusieurs pour un atelier de groupe) *
                    </label>
                    <span className="text-[10px] font-black text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">
                      {selectedIncubeIds.length} sélectionné(s)
                    </span>
                  </div>

                  {/* Recherche rapide d'incubé */}
                  <div className="relative mb-2">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filtrer par nom ou N° PP..."
                      value={searchIncube}
                      onChange={e => setSearchIncube(e.target.value)}
                      className="input pl-8 !py-1.5 !text-xs"
                    />
                  </div>

                  <div className="max-h-44 overflow-y-auto space-y-1 p-2 bg-slate-50 dark:bg-dark-800/80 border border-slate-200 dark:border-dark-700 rounded-xl">
                    {filteredIncubes.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-3">Aucun incubé trouvé</p>
                    ) : filteredIncubes.map((inc) => {
                      const isSelected = selectedIncubeIds.includes(inc.id) || selectedIncubeIds.includes(String(inc.id));
                      return (
                        <div
                          key={inc.id}
                          onClick={() => toggleIncubeSelection(inc.id)}
                          className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer text-xs transition-colors ${
                            isSelected
                              ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold border border-amber-500/40'
                              : 'hover:bg-slate-200/60 dark:hover:bg-dark-700 text-slate-700 dark:text-dark-200'
                          }`}
                        >
                          <span className="flex items-center gap-2 truncate">
                            <User size={14} className="text-amber-500 shrink-0" />
                            <span className="truncate">{inc.nom_incube} {inc.pp_numero ? `(${inc.pp_numero})` : ''}</span>
                          </span>
                          {isSelected && <Check size={16} className="text-amber-600 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Message d'invitation Email */}
                <div>
                  <label className="text-xs font-bold block mb-1">
                    Message d'invitation / Consignes préalables :
                  </label>
                  <textarea
                    rows={2}
                    placeholder="ex: Merci de préparer les indicateurs RH et le prévisionnel..."
                    value={commentaireEmail}
                    onChange={(e) => setCommentaireEmail(e.target.value)}
                    className="input !py-2 !text-xs"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20 transition-all cursor-pointer"
                >
                  <Send size={16} /> Confirmer & Lier à Google Calendar
                </button>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );

  // Rendu de carte de rendez-vous / événement / réservation
  function renderRdvCard(rdv, isHistory = false) {
    const isToday = rdv.date === todayStr;
    const gcalUrl = rdv.type === 'rendezvous' ? generateGoogleCalendarUrl(rdv.originalData) : null;
    const incubesForEvent = resolveIncubesForEvent(rdv);

    return (
      <div
        key={rdv.id}
        className={`p-4 rounded-2xl border transition-all space-y-3 flex flex-col justify-between ${
          isHistory
            ? 'bg-slate-50/70 dark:bg-dark-800/40 border-slate-200 dark:border-dark-700 opacity-80'
            : isToday
            ? 'bg-blue-500/5 dark:bg-blue-500/10 border-blue-500/40 shadow-sm ring-1 ring-blue-400/30'
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
                  ⚪ Effectué
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold">
                  🟢 À venir
                </span>
              )}

              <span className="text-slate-700 dark:text-dark-200">
                {new Date(rdv.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} à {rdv.heure}
              </span>
            </div>

            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
              rdv.type === 'rendezvous' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400' :
              rdv.type === 'reservation' ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400' :
              rdv.type === 'formation' ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 font-black' :
              'bg-rose-500/10 text-rose-700 dark:text-rose-400'
            }`}>
              {rdv.type === 'rendezvous' ? 'RDV' : rdv.type === 'reservation' ? 'Espace' : rdv.type === 'formation' ? 'Formation' : 'Atelier'} - {rdv.duree || '1h'}
            </span>
          </div>

          {/* Sujet */}
          <h4 className="font-black text-sm text-slate-900 dark:text-white leading-tight">
            {rdv.titre}
          </h4>

          {/* Détails : Incubé(s) / Formateur & Lieu */}
          <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-dark-300">
            <div className="flex items-center gap-1.5 flex-wrap">
              {rdv.type === 'formation' ? (
                <GraduationCap size={13} className="text-blue-500 shrink-0" />
              ) : (
                <Users size={13} className="text-amber-500 shrink-0" />
              )}
              {incubesForEvent.length > 0 ? (
                <div className="inline-flex items-center gap-1 flex-wrap">
                  {incubesForEvent.map((inc, idx) => (
                    <span key={inc.id || idx} className="inline-flex items-center">
                      {inc.id ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/incube/${inc.id}`);
                          }}
                          className="font-bold text-slate-800 dark:text-slate-100 hover:text-amber-600 dark:hover:text-amber-400 hover:underline inline-flex items-center gap-1 group cursor-pointer transition-colors text-left"
                          title={`Cliquer pour ouvrir la fiche et les informations de ${inc.nom}`}
                        >
                          <span>{inc.nom}</span>
                          <ExternalLink size={11} className="text-amber-500 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
                        </button>
                      ) : (
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {inc.nom}
                        </span>
                      )}
                      {idx < incubesForEvent.length - 1 && (
                        <span className="text-slate-400 font-bold mr-0.5">,</span>
                      )}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {rdv.sousTitre}
                </span>
              )}
            </div>

            {/* Coach / Accompagnateur si RDV */}
            {rdv.type === 'rendezvous' && rdv.accompagnateurNom && (
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                <User size={12} className="text-amber-500 shrink-0" />
                <span className="truncate">Coach : {rdv.accompagnateurNom}</span>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-dark-400">
              <MapPin size={12} className="text-slate-400 shrink-0" />
              <span className="truncate">{rdv.lieu}</span>
            </div>

            {rdv.commentaire && (
              <p className="text-[11px] italic text-slate-500 dark:text-dark-400 bg-slate-100 dark:bg-dark-900/60 p-2 rounded-lg mt-1 border border-slate-200/60 dark:border-dark-700/60">
                💬 "{rdv.commentaire}"
              </p>
            )}
          </div>
        </div>

        {/* Boutons d'action : Google Calendar, ICS, Effectué, Supprimer */}
        <div className="pt-2.5 border-t border-slate-100 dark:border-dark-700/60 flex items-center justify-between gap-1 flex-wrap">
          <div className="flex items-center gap-1.5">
            {/* BOUTON GOOGLE CALENDAR DIRECT */}
            {rdv.type === 'rendezvous' && gcalUrl && (
              <>
                <a
                  href={gcalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 text-[11px] font-extrabold rounded-lg bg-primary-500/10 hover:bg-primary-500/20 text-primary-700 dark:text-primary-300 border border-primary-500/30 flex items-center gap-1 transition-all"
                  title="Ajouter et synchroniser directement dans Google Calendar"
                >
                  <CalendarIcon size={12} className="text-primary-600" />
                  <span>Google Calendar</span>
                  <ExternalLink size={10} className="opacity-70" />
                </a>

                <button
                  type="button"
                  onClick={() => downloadIcsFile(rdv.originalData)}
                  className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-dark-700 text-slate-500 hover:text-slate-900"
                  title="Télécharger fichier .ICS (Outlook, Apple Calendar)"
                >
                  <Download size={13} />
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-1">
            {rdv.type === 'rendezvous' && !isHistory && (
              <button
                type="button"
                onClick={() => handleMarquerEffectue(rdv.originalId)}
                className="px-2 py-1 text-[10px] font-bold rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center gap-1"
                title="Marquer comme effectué"
              >
                <CheckCircle2 size={12} />
                <span>Effectué</span>
              </button>
            )}
            {rdv.type === 'rendezvous' && (
              <button
                type="button"
                onClick={() => handleDeleteRdv(rdv.originalId)}
                className="p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/30 text-slate-400 hover:text-rose-600 transition-colors"
                title="Supprimer ce rendez-vous"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
