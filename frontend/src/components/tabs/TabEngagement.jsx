import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Trash2, 
  Save, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  GraduationCap, 
  Sparkles, 
  X, 
  Printer, 
  Check, 
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FileSpreadsheet,
  ArrowRight,
  QrCode,
  Mail,
  RefreshCw,
  AlertCircle,
  Users
} from 'lucide-react';
import api, { getPhotoUrl } from '../../api/axios';
import toast from 'react-hot-toast';

const MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export default function TabEngagement({ incubeId, incube = null, data = [], onUpdate, hideTitle = true, incubeSelector = null }) {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const [annee, setAnnee] = useState(currentYear);
  const [savingAll, setSavingAll] = useState(false);
  const [savingRowIdx, setSavingRowIdx] = useState(null);
  const [syncingTourniquet, setSyncingTourniquet] = useState(false);
  const [tourniquetFilterMode, setTourniquetFilterMode] = useState('equipe'); // 'equipe' | 'porteur'
  const [selectedTourniquetMonth, setSelectedTourniquetMonth] = useState('all'); // 'all' ou 'Janvier'...'Décembre'
  const [tourniquetTeamData, setTourniquetTeamData] = useState(null);
  const [isTeamDetailOpen, setIsTeamDetailOpen] = useState(false);
  const [activeEngagementTab, setActiveEngagementTab] = useState("tourniquets"); // "tourniquets", "formations", "ateliers" // "agenda" | "table"
  const [selectedAgendaMonth, setSelectedAgendaMonth] = useState(() => {
    const curMonthIdx = new Date().getMonth();
    return MOIS[curMonthIdx] || MOIS[0];
  }); // "tourniquets", "formations", "ateliers"

  // Synchroniser automatiquement les pointages réels des tourniquets physiques ZKTeco (Porteur + Associés + Salariés RH)
  const handleSyncTourniquet = async (isSilent = false) => {
    const targetId = incubeId || incube?.id;
    if (!targetId) {
      if (!isSilent) toast.error("Veuillez sélectionner un incubé.");
      return;
    }
    if (!isSilent) setSyncingTourniquet(true);
    try {
      const res = await api.get(`/incubes/${targetId}/sync-tourniquet?annee=${annee}`);
      const { monthlyHours, metrics, incube: incInfo } = res.data;
      setTourniquetTeamData(res.data);

      if (monthlyHours) {
        setMonths(prev => {
          const next = { ...prev };
          Object.entries(monthlyHours).forEach(([m, h]) => {
            if (next[m]) {
              // On ne met à jour que si les heures tourniquets sont positives
              // Si h === 0 et que le mois a déjà des heures en base, on ne les efface PAS !
              if (h > 0) {
                next[m] = {
                  ...next[m],
                  moyenne_heures_presence: h
                };
              }
            }
          });
          return next;
        });

        if (!isSilent) {
          const badgeCount = incInfo?.teamBadgeCount || (incInfo?.badge_id ? 1 : 0);
          const badgeTxt = badgeCount > 0 ? ` (${badgeCount} membre${badgeCount > 1 ? 's' : ''} badgé${badgeCount > 1 ? 's' : ''})` : ' (⚠️ Sans badge)';
          toast.success(
            `Pointages tourniquets vérifiés${badgeTxt} ! Équipe : ${metrics?.totalHeures || 0}h (Porteur : ${metrics?.totalHeuresPorteur || 0}h, Associés : ${metrics?.totalHeuresAssocies || 0}h, Salariés : ${metrics?.totalHeuresSalaries || 0}h)`,
            { duration: 4500 }
          );
        }
      }
    } catch (err) {
      console.error("Erreur synchronisation tourniquets:", err);
      if (!isSilent) toast.error(err.response?.data?.message || "Erreur lors de la synchronisation des tourniquets");
    } finally {
      if (!isSilent) setSyncingTourniquet(false);
    }
  };

  const lastSyncedKeyRef = useRef('');

  // Synchronisation automatique des pointages tourniquets (une seule fois par incubé et année)
  useEffect(() => {
    const targetId = incubeId || incube?.id;
    if (!targetId) return;
    const syncKey = `${targetId}-${annee}`;
    if (lastSyncedKeyRef.current === syncKey) return;
    lastSyncedKeyRef.current = syncKey;
    handleSyncTourniquet(true);
  }, [incubeId, incube?.id, annee]);

  // État et synchronisation des ateliers (Bénéficiaire et Animateur)
  const [ateliersStats, setAteliersStats] = useState(null);
  const [syncingAteliers, setSyncingAteliers] = useState(false);
  const lastSyncedAteliersKeyRef = useRef('');

  const handleSyncAteliers = async (isSilent = false) => {
    const targetId = incubeId || incube?.id;
    if (!targetId) {
      if (!isSilent) toast.error("Veuillez sélectionner un incubé.");
      return;
    }
    if (!isSilent) setSyncingAteliers(true);
    try {
      const res = await api.get(`/ateliers/incube-stats/${targetId}?annee=${annee}`);
      const statsData = res.data;
      setAteliersStats(statsData);

      if (statsData?.monthly) {
        setMonths(prev => {
          const next = { ...prev };
          Object.entries(statsData.monthly).forEach(([m, s]) => {
            if (next[m]) {
              const currentInit = next[m].initiatives || '';
              let updatedInit = currentInit;

              // Si l'incubé a animé des ateliers ce mois-ci et que ce n'est pas encore mentionné dans initiatives :
              if (s.ateliers_animes && s.ateliers_animes.length > 0) {
                s.ateliers_animes.forEach(a => {
                  const mention = `🎤 Animation de l'atelier : "${a.titre}" (${a.duree || a.heures + 'h'})`;
                  if (!updatedInit.includes(a.titre)) {
                    updatedInit = updatedInit ? `${updatedInit}\n• ${mention}` : `• ${mention}`;
                  }
                });
              }

              next[m] = {
                ...next[m],
                heures_ateliers: s.heures_ateliers,
                nb_ateliers: s.nb_ateliers,
                heures_ateliers_animes: s.heures_ateliers_animes,
                nb_ateliers_animes: s.nb_ateliers_animes,
                initiatives: updatedInit
              };
            }
          });
          return next;
        });

        if (!isSilent) {
          const tSuivies = statsData.totals?.heures_ateliers_suivies || 0;
          const tAnimees = statsData.totals?.heures_ateliers_animes || 0;
          const msgAnime = tAnimees > 0 ? ` + ${tAnimees}h animées (🎤)` : '';
          toast.success(`Ateliers synchronisés : ${tSuivies}h suivies (${statsData.totals?.nb_ateliers_suivis} ateliers)${msgAnime}`);
        }
      }
    } catch (err) {
      console.warn("Erreur sync ateliers:", err);
      if (!isSilent) toast.error("Erreur lors de la synchronisation des ateliers");
    } finally {
      if (!isSilent) setSyncingAteliers(false);
    }
  };

  useEffect(() => {
    const targetId = incubeId || incube?.id;
    if (!targetId) return;
    const syncKey = `ateliers-${targetId}-${annee}`;
    if (lastSyncedAteliersKeyRef.current === syncKey) return;
    lastSyncedAteliersKeyRef.current = syncKey;
    handleSyncAteliers(true);
  }, [incubeId, incube?.id, annee]);

  // Liste dynamique des années : garantit 2024 minimum + tout l'historique enregistré + prévisions (currentYear + 2)
  const availableYears = useMemo(() => {
    const fromData = (data || [])
      .map(d => parseInt(d.annee))
      .filter(y => !isNaN(y) && y >= 2020);

    const minYear = Math.min(2024, currentYear - 2, ...fromData);
    const maxYear = Math.max(currentYear + 2, ...fromData);

    const list = [];
    for (let y = minYear; y <= maxYear; y++) {
      list.push(y);
    }
    return Array.from(new Set([...fromData, ...list])).sort((a, b) => a - b);
  }, [data, currentYear]);

  const findEngagementForMonth = (dataList, mName, year) => {
    if (!Array.isArray(dataList)) return null;
    return (
      dataList.find(d => d.mois && d.mois.trim().toLowerCase() === mName.toLowerCase() && String(d.annee || '') === String(year)) ||
      dataList.find(d => d.mois && d.mois.trim().toLowerCase() === mName.toLowerCase() && !d.annee)
    );
  };

  // 12 mois initialisés pour l'année sélectionnée
  const [months, setMonths] = useState(() => {
    const map = {};
    const dataList = Array.isArray(data) ? data : [];
    MOIS.forEach((m) => {
      const found = findEngagementForMonth(dataList, m, annee);
      map[m] = found ? { ...found } : {
        mois: m,
        annee,
        moyenne_heures_presence: '',
        taux_presence_formation: '',
        initiatives: '',
        observations: ''
      };
    });
    return map;
  });

  // Re-synchroniser les mois lorsque les données ou l'incubé changent
  useEffect(() => {
    const map = {};
    const dataList = Array.isArray(data) ? data : [];
    MOIS.forEach((m) => {
      const found = findEngagementForMonth(dataList, m, annee);
      map[m] = found ? { ...found } : {
        mois: m,
        annee,
        moyenne_heures_presence: '',
        taux_presence_formation: '',
        initiatives: '',
        observations: ''
      };
    });
    setMonths(map);
  }, [data, incubeId, annee]);

  // Mettre à jour quand l'année change
  const handleYearChange = (newYear) => {
    setAnnee(newYear);
    const map = {};
    MOIS.forEach((m) => {
      const found = findEngagementForMonth(data, m, newYear);
      map[m] = found ? { ...found } : {
        mois: m,
        annee: newYear,
        moyenne_heures_presence: '',
        taux_presence_formation: '',
        initiatives: '',
        observations: ''
      };
    });
    setMonths(map);
  };

  // Base contractuelle d'engagement
  const OBJECTIF_HEBDO = 15; // 15 heures par semaine
  const OBJECTIF_MOIS = 60;  // 15h x 4 semaines = 60 heures par mois
  const OBJECTIF_ANNEE = 720; // 60h x 12 mois = 720 heures par an

  // Formations Obligatoires et émargements
  const [workshops, setWorkshops] = useState([]);
  const [allPresences, setAllPresences] = useState({});

  // Identifier le parcours officiel de l'incubé (Pré-Création vs Post-Création)
  const isPostCreation = ['Croissance', 'Maturité', 'Développement', 'Post-Création'].includes(incube?.phase_projet);
  const trackName = isPostCreation ? 'Post-Création' : 'Pré-Création';

  // 1. Charger les formations obligatoires et leurs émargements
  const loadEventsAndPresences = async () => {
    const targetId = incubeId || incube?.id;
    let list = [];

    // A. Formations directes enregistrées pour cet incubé
    if (targetId) {
      try {
        const fRes = await api.get('/formations', { params: { incube_id: targetId } });
        if (Array.isArray(fRes.data) && fRes.data.length > 0) {
          list = fRes.data.map(f => ({
            id: `f_${f.id}`,
            rawId: f.id,
            titre: f.theme.startsWith('[') ? f.theme : `[Formation Obligatoire] ${f.theme}`,
            theme: f.theme,
            formateur: f.formateur || 'Formateur IDS',
            date: f.date_formation,
            duree: `${f.heures || 3.5}h`,
            present: f.presence === true || f.presence === 'true' || f.presence === 1,
            isDirectPresence: true
          }));
        }
      } catch (e) {
        console.warn("Erreur chargement formations incubé:", e.message);
      }
    }

    // B. Formations obligatoires planifiées (Strictement réservées aux parcours Pré-Création & Post-Création)
    // Les ateliers généraux, masterclass libres ou fablab ne sont PAS comptabilisés dans l'assiduité obligatoire
    try {
      const ateliersRes = await api.get('/ateliers');
      if (Array.isArray(ateliersRes.data) && ateliersRes.data.length > 0) {
        const modulesObligatoires = ateliersRes.data.filter(a => {
          const t = (a.titre || '').toLowerCase();
          const d = (a.description || '').toLowerCase();
          // Uniquement les modules officiels correspondant au parcours de l'incubé
          const isPre = t.includes('pré-création') || t.includes('pre-creation') || t.includes('bmc') || t.includes('business plan') || t.includes('statut juridique');
          const isPost = t.includes('post-création') || t.includes('post-creation') || t.includes('gestion comptable') || t.includes('marketing') || t.includes('gfc') || t.includes('mdc') || t.includes('recrutement');
          
          if (isPostCreation) {
            return isPost && !isPre;
          } else {
            return isPre && !isPost;
          }
        });

        modulesObligatoires.forEach(mo => {
          if (!list.some(l => l.titre === mo.titre && l.date === mo.date)) {
            list.push({
              id: mo.id,
              rawId: mo.id,
              titre: mo.titre,
              theme: mo.titre,
              formateur: mo.formateur || mo.intervenant || 'Formateur IDS',
              date: mo.date,
              duree: mo.duree || '3h30',
              isDirectPresence: false
            });
          }
        });
      }
    } catch (e) {
      console.warn("Erreur chargement formations obligatoires:", e.message);
    }

    // C. Référence officielle des modules obligatoires selon le parcours de l'incubé
    if (list.length === 0) {
      if (isPostCreation) {
        list = [
          { id: 'def_104', rawId: null, titre: '[Post-Création] GFC – Gestion Comptable et Financière', theme: 'GFC – Gestion Comptable et Financière', formateur: 'M. Amrani', date: `${annee}-02-15`, duree: '3h30', isDefault: true },
          { id: 'def_105', rawId: null, titre: '[Post-Création] MDC – Marketing et Développement Commercial', theme: 'MDC – Marketing et Développement Commercial', formateur: 'Coach IDS', date: `${annee}-04-18`, duree: '3h30', isDefault: true },
          { id: 'def_106', rawId: null, titre: '[Post-Création] RH – Management & Recrutement RH', theme: 'RH – Management & Recrutement RH', formateur: 'Consultant RH', date: `${annee}-06-20`, duree: '3h00', isDefault: true }
        ];
      } else {
        list = [
          { id: 'def_101', rawId: null, titre: '[Pré-Création] BMC – Business Model Canvas', theme: 'BMC – Business Model Canvas', formateur: 'M. Benjelloun', date: `${annee}-01-15`, duree: '3h00', isDefault: true },
          { id: 'def_102', rawId: null, titre: '[Pré-Création] BP – Business Plan & Faisabilité', theme: 'BP – Business Plan & Faisabilité', formateur: 'Mme. Tazi', date: `${annee}-02-10`, duree: '4h00', isDefault: true },
          { id: 'def_103', rawId: null, titre: '[Pré-Création] SJ – Statut Juridique & Formalités', theme: 'SJ – Statut Juridique & Formalités', formateur: 'Me. Alaoui', date: `${annee}-03-05`, duree: '3h00', isDefault: true }
        ];
      }
    }
    setWorkshops(list);

    let localMap = {};
    try {
      const presencesStr = localStorage.getItem('ids_ateliers_presences');
      if (presencesStr) {
        localMap = JSON.parse(presencesStr);
      }
    } catch {}

    try {
      const res = await api.get('/presence/all');
      if (res.data && typeof res.data === 'object') {
        const merged = { ...localMap };
        Object.entries(res.data).forEach(([atId, pObj]) => {
          merged[atId] = { ...(merged[atId] || {}), ...pObj };
        });
        setAllPresences(merged);
        return;
      }
    } catch {}
    setAllPresences(localMap);
  };

  useEffect(() => {
    loadEventsAndPresences();

    // Écouter les mises à jour en direct depuis d'autres onglets / pages
    const handleStorage = (e) => {
      if (!e.key || e.key === 'ids_ateliers_presences' || e.key === 'ids_ateliers_list') {
        loadEventsAndPresences();
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', loadEventsAndPresences);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', loadEventsAndPresences);
    };
  }, [annee, incubeId]);

  // Ateliers pour un mois donné (0 à 11) pour l'année sélectionnée
  const getWorkshopsForMonth = (monthIdx) => {
    return workshops.filter(w => {
      if (!w.date) return false;
      const d = new Date(w.date);
      return d.getFullYear() === Number(annee) && d.getMonth() === monthIdx;
    });
  };

  // Vérifier si l'incubé est présent à une formation obligatoire
  const isIncubePresentAtWorkshop = (workshopItemOrId) => {
    if (!incubeId && !incube) return false;
    
    // Si c'est un objet formation avec validation directe
    if (typeof workshopItemOrId === 'object' && workshopItemOrId !== null) {
      if (workshopItemOrId.isDirectPresence) {
        return Boolean(workshopItemOrId.present);
      }
      return isIncubePresentAtWorkshop(workshopItemOrId.id);
    }
    const workshopId = workshopItemOrId;
    const wObj = workshops.find(w => w.id === workshopId);
    if (wObj && wObj.isDirectPresence) {
      return Boolean(wObj.present);
    }

    const pMap = allPresences[workshopId] || allPresences[String(workshopId)] || allPresences[Number(workshopId)] || {};
    
    // 1. Accès direct par incubeId
    const directEntry = pMap[incubeId] || pMap[String(incubeId)] || (incube?.id && pMap[String(incube.id)]);
    if (directEntry && (directEntry.present === true || directEntry.present === 'true' || directEntry.present === 1)) {
      return true;
    }

    // 2. Recherche exhaustive dans les valeurs (pour tolérer les différences d'ID ou formats)
    const entries = Object.values(pMap);
    return entries.some(entry => {
      if (!entry) return false;
      const isPresent = entry.present === true || entry.present === 'true' || entry.present === 1;
      if (!isPresent) return false;

      // Correspondance par ID
      if (entry.incubeId && (String(entry.incubeId) === String(incubeId) || (incube?.id && String(entry.incubeId) === String(incube.id)))) {
        return true;
      }

      // Correspondance par Numéro PP (ex: PP-8257)
      if (incube?.pp_numero && entry.pp_numero) {
        const cleanPp1 = String(incube.pp_numero).replace(/#/g, '').trim().toLowerCase();
        const cleanPp2 = String(entry.pp_numero).replace(/#/g, '').trim().toLowerCase();
        if (cleanPp1 && cleanPp2 && cleanPp1 === cleanPp2) {
          return true;
        }
      }

      // Correspondance par Nom d'incubé (ex: Ahmed Haij)
      if (incube?.nom_incube) {
        const targetNom = incube.nom_incube.toLowerCase().trim();
        const entryNom = `${entry.nom || ''} ${entry.prenom || ''}`.toLowerCase().trim();
        const entryNomOnly = String(entry.nom || '').toLowerCase().trim();
        if (targetNom === entryNom || (entryNomOnly && targetNom.includes(entryNomOnly))) {
          return true;
        }
      }

      return false;
    });
  };

  // Calcul du taux de formation obligatoire pour un mois donné
  const getMonthFormationStats = (monthIdx) => {
    const monthWorkshops = getWorkshopsForMonth(monthIdx);
    const attended = monthWorkshops.filter(w => isIncubePresentAtWorkshop(w));
    return {
      total: monthWorkshops.length,
      attended: attended.length,
      rate: monthWorkshops.length > 0 ? Math.round((attended.length / monthWorkshops.length) * 100) : null,
      workshops: monthWorkshops
    };
  };

  // Synchronisation globale de toutes les formations depuis les événements
  const handleSyncAllFormationsFromEvents = () => {
    let syncedCount = 0;
    setMonths(prev => {
      const next = { ...prev };
      MOIS.forEach((m, idx) => {
        const stats = getMonthFormationStats(idx);
        if (stats.rate !== null) {
          next[m] = { ...next[m], taux_presence_formation: stats.rate };
          syncedCount++;
        }
      });
      return next;
    });
    toast.success(`Assiduité formations synchronisée avec les feuilles de présence (${syncedCount} mois mis à jour). Pensez à "Enregistrer tout" !`);
  };

  // Basculer la présence de l'incubé à une formation obligatoire
  const handleTogglePresence = async (w, monthName) => {
    const targetId = incubeId || incube?.id;
    if (!targetId) return;

    const currentPresence = isIncubePresentAtWorkshop(w);
    const newPresence = !currentPresence;

    try {
      if (w.isDirectPresence && w.rawId) {
        await api.put(`/formations/${w.rawId}`, {
          presence: newPresence
        });
      } else {
        // Enregistrer la formation directement pour cet incubé
        await api.post('/formations', {
          incube_id: targetId,
          theme: w.theme || w.titre,
          formateur: w.formateur || 'Formateur IDS',
          date_formation: w.date || new Date().toISOString().split('T')[0],
          heures: parseFloat(w.duree) || 3.5,
          presence: newPresence
        });
      }

      toast.success(`Présence formation : ${newPresence ? 'Validée (Présent)' : 'Non validée (Absent)'}`);
      
      // Mettre à jour l'état local du mois immédiatement
      if (monthName) {
        updateField(monthName, 'taux_presence_formation', newPresence ? 100 : 0);
      }
      
      await loadEventsAndPresences();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error("Erreur bascule présence:", err);
      toast.error(err.response?.data?.message || "Erreur lors de la mise à jour de la présence");
    }
  };

  // Auto-sync des formations en temps réel au chargement et dès que allPresences change
  useEffect(() => {
    if ((!incubeId && !incube) || workshops.length === 0) return;
    setMonths(prev => {
      let hasChanges = false;
      const next = { ...prev };
      MOIS.forEach((m, idx) => {
        const stats = getMonthFormationStats(idx);
        // Ne synchroniser automatiquement dans l'état QUE si l'incubé a réellement assisté à un atelier
        if (stats.rate !== null && stats.attended > 0) {
          const currentVal = next[m]?.taux_presence_formation;
          if (currentVal === '' || currentVal === null || currentVal === undefined) {
            next[m] = { ...next[m], taux_presence_formation: stats.rate };
            hasChanges = true;
          }
        }
      });
      return hasChanges ? next : prev;
    });
  }, [allPresences, workshops, incubeId, incube, annee]);

  const updateField = (mois, field, val) => {
    setMonths((prev) => ({
      ...prev,
      [mois]: {
        ...prev[mois],
        [field]: val
      }
    }));
  };

  // Sauvegarder un mois unique
  const saveMonth = async (m, idx) => {
    setSavingRowIdx(idx);
    const item = months[m];
    const eventStats = getMonthFormationStats(idx);
    const effectiveTaux = (item.taux_presence_formation !== '' && item.taux_presence_formation !== null && item.taux_presence_formation !== undefined)
      ? parseFloat(item.taux_presence_formation)
      : (eventStats.rate !== null ? parseFloat(eventStats.rate) : null);

    try {
      const payload = {
        ...item,
        incube_id: incubeId,
        annee,
        moyenne_heures_presence: item.moyenne_heures_presence !== '' && item.moyenne_heures_presence !== null ? parseFloat(item.moyenne_heures_presence) : null,
        taux_presence_formation: effectiveTaux,
      };

      let savedData;
      if (item.id) {
        const res = await api.put(`/incubes/${incubeId}/engagement/${item.id}`, payload);
        savedData = res.data;
      } else {
        const res = await api.post(`/incubes/${incubeId}/engagement`, payload);
        savedData = res.data;
      }

      setMonths(prev => ({
        ...prev,
        [m]: {
          ...prev[m],
          ...(savedData || {}),
          id: savedData?.id || prev[m].id,
          moyenne_heures_presence: item.moyenne_heures_presence,
          taux_presence_formation: effectiveTaux,
          initiatives: item.initiatives,
          observations: item.observations
        }
      }));

      toast.success(`Données de ${m} enregistrées avec succès`);
      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || `Erreur lors de l'enregistrement de ${m}`);
    } finally {
      setSavingRowIdx(null);
    }
  };

  // Sauvegarder les 12 mois d'un coup
  const saveAllMonths = async () => {
    setSavingAll(true);
    try {
      let countSaved = 0;
      for (const m of MOIS) {
        const item = months[m];
        const monthIdx = MOIS.indexOf(m);
        const eventStats = getMonthFormationStats(monthIdx);
        const effectiveTaux = (item.taux_presence_formation !== '' && item.taux_presence_formation !== null && item.taux_presence_formation !== undefined)
          ? parseFloat(item.taux_presence_formation)
          : (eventStats.rate !== null ? parseFloat(eventStats.rate) : null);

        const valPresenceNum = (item.moyenne_heures_presence !== '' && item.moyenne_heures_presence !== null && !isNaN(item.moyenne_heures_presence))
          ? parseFloat(item.moyenne_heures_presence)
          : null;

        const hasData = (valPresenceNum !== null && valPresenceNum > 0) || 
                        (effectiveTaux !== null && effectiveTaux > 0) || 
                        (item.initiatives && item.initiatives.trim()) || 
                        (item.observations && item.observations.trim());
        if (hasData) {
          const payload = {
            ...item,
            incube_id: incubeId,
            annee,
            moyenne_heures_presence: item.moyenne_heures_presence !== '' && item.moyenne_heures_presence !== null ? parseFloat(item.moyenne_heures_presence) : null,
            taux_presence_formation: effectiveTaux,
          };
          if (item.id) {
            await api.put(`/incubes/${incubeId}/engagement/${item.id}`, payload);
          } else {
            const res = await api.post(`/incubes/${incubeId}/engagement`, payload);
            if (res.data?.id) {
              setMonths(prev => ({
                ...prev,
                [m]: { ...prev[m], id: res.data.id, taux_presence_formation: effectiveTaux }
              }));
            }
          }
          countSaved++;
        }
      }
      toast.success(`${countSaved} mois enregistré(s) avec succès`);
      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'enregistrement");
    } finally {
      setSavingAll(false);
    }
  };

  // Envoyer un email d'alerte d'assiduité à l'incubé
  const [sendingAlerte, setSendingAlerte] = useState(false);
  const handleSendAlerteAssiduite = async () => {
    const targetId = incubeId || incube?.id;
    if (!targetId) {
      toast.error("Veuillez sélectionner un incubé.");
      return;
    }

    const nom = incube?.nom_incube || 'cet incubé';
    const taux = stats.tauxFormationsReel;
    const heures = stats.moyenneHebdo !== '—' ? stats.moyenneHebdo : 0;

    const confirmMsg = `Envoyer un email officiel de relance d'assiduité à ${nom} ?\n\n• Taux présence formations : ${taux}%\n• Moyenne hebdomadaire : ${heures}h / sem\n\nCet email notifiera l'incubé et lui demandera de régulariser sa situation.`;
    if (!window.confirm(confirmMsg)) return;

    setSendingAlerte(true);
    try {
      const res = await api.post(`/incubes/${targetId}/alerte-assiduite`, {
        tauxPresence: taux,
        moyenneHeures: parseFloat(heures) || 0,
        annee
      });

      if (res.data?.success) {
        toast.success(`Email d'alerte d'assiduité transmis avec succès à ${nom} !`, { duration: 4000 });
      } else {
        toast.success("Alerte d'assiduité transmise !");
      }
    } catch (err) {
      console.error("Erreur alerte assiduité:", err);
      toast.error(err.response?.data?.message || "Erreur lors de l'envoi de l'alerte d'assiduité");
    } finally {
      setSendingAlerte(false);
    }
  };

  // Statistiques calculées (Exactes pour Semaine, Mois, Année & Formations Événements)
  const stats = useMemo(() => {
    let totalHeures = 0, countHeures = 0;
    let countInitiatives = 0;

    const moisPresents = [];

    MOIS.forEach((m) => {
      const d = months[m];
      let valHours = (d.moyenne_heures_presence !== '' && d.moyenne_heures_presence !== null && !isNaN(d.moyenne_heures_presence))
        ? parseFloat(d.moyenne_heures_presence)
        : null;

      // Appliquer le filtre par catégorie (Équipe, Incubé, Associés, Salariés RH) si les données tourniquets détaillées sont chargées
      if (tourniquetFilterMode === 'porteur' && tourniquetTeamData?.porteurMonthlyHours) {
        const porteurH = Number(tourniquetTeamData.porteurMonthlyHours[m] || 0);
        valHours = porteurH > 0 ? porteurH : null;
      } else if (tourniquetFilterMode === 'associes' && tourniquetTeamData?.associesMonthlyHours) {
        const assocH = Number(tourniquetTeamData.associesMonthlyHours[m] || 0);
        valHours = assocH > 0 ? assocH : null;
      } else if (tourniquetFilterMode === 'salaries' && tourniquetTeamData?.salariesMonthlyHours) {
        const salH = Number(tourniquetTeamData.salariesMonthlyHours[m] || 0);
        valHours = salH > 0 ? salH : null;
      } else if (tourniquetFilterMode === 'equipe' && tourniquetTeamData?.equipeMonthlyHours) {
        const equipeH = Number(tourniquetTeamData.equipeMonthlyHours[m] || 0);
        if (equipeH > 0) valHours = equipeH;
      }

      const hasHours = valHours !== null && valHours > 0;
      const hasInitiatives = d.initiatives && d.initiatives.trim();

      if (hasHours) {
        totalHeures += valHours;
        countHeures++;
        moisPresents.push(m);
      }
      if (hasInitiatives) {
        countInitiatives++;
      }
    });

    const countRemplis = countHeures;

    // 1. Calculs des heures : Objectif 15h/semaine, 60h/mois, 720h/an
    const moyMensuelle = countHeures > 0 ? (totalHeures / countHeures) : 0;
    const moyHebdo = countHeures > 0 ? (moyMensuelle / 4) : 0;
    
    // Taux hebdomadaire par rapport à l'objectif de 15h
    const tauxHebdo = countHeures > 0 ? Math.round((moyHebdo / OBJECTIF_HEBDO) * 100) : 0;
    // Taux mensuel par rapport à l'objectif de 60h
    const tauxMois = countHeures > 0 ? Math.round((moyMensuelle / OBJECTIF_MOIS) * 100) : 0;
    
    // Objectif cumulé pour le nombre de mois saisis
    const objCumuleMois = countHeures * OBJECTIF_MOIS;
    const tauxAnnuelCumule = objCumuleMois > 0 ? Math.round((totalHeures / objCumuleMois) * 100) : 0;
    const tauxAnnuel720 = Math.round((totalHeures / OBJECTIF_ANNEE) * 100);

    // 2. Calculs des formations à partir des événements de l'année
    const ateliersAnnee = workshops.filter(w => {
      if (!w.date) return false;
      const d = new Date(w.date);
      const wYear = d.getFullYear();
      return (wYear === annee) || (wYear === 2025 && annee === 2026) || (wYear === 2026 && annee === 2025);
    });
    const ateliersAssistes = ateliersAnnee.filter(w => isIncubePresentAtWorkshop(w.id));

    const totalAteliersAnnee = ateliersAnnee.length;
    const totalAssistesAnnee = ateliersAssistes.length;

    // Ateliers qui se sont déroulés ou ayant des émargements enregistrés
    const ateliersEchusOuEmarges = ateliersAnnee.filter(w => {
      const pMap = allPresences[w.id] || allPresences[String(w.id)] || allPresences[Number(w.id)] || {};
      const hasPresences = Object.keys(pMap).length > 0;
      const isPast = new Date(w.date) < new Date();
      return hasPresences || isPast;
    });

    const baseRequis = ateliersEchusOuEmarges.length > 0 ? ateliersEchusOuEmarges : ateliersAnnee;
    const assistesSurRequis = ateliersAssistes.filter(w => baseRequis.some(b => b.id === w.id)).length;

    const tauxFormationsReel = baseRequis.length > 0 
      ? Math.round((assistesSurRequis / baseRequis.length) * 100) 
      : 100;

    return {
      countMoisRemplis: countRemplis,
      moisPresents,
      countHeuresMois: countHeures,
      totalHeures: totalHeures.toFixed(1),
      moyenneMensuelle: countHeures > 0 ? moyMensuelle.toFixed(1) : '—',
      moyenneHebdo: countHeures > 0 ? moyHebdo.toFixed(1) : '—',
      tauxHebdo: countHeures > 0 ? tauxHebdo : '—',
      tauxMois: countHeures > 0 ? tauxMois : '—',
      tauxAnnuelCumule: countHeures > 0 ? tauxAnnuelCumule : '—',
      tauxAnnuel720,
      
      totalAteliersAnnee,
      totalAssistesAnnee,
      baseRequisCount: baseRequis.length,
      assistesSurRequis,
      tauxFormationsReel,

      totalInitiatives: countInitiatives,

      // Statistiques Ateliers & Événements
      totalHeuresAteliersSuivies: ateliersStats?.totals?.heures_ateliers || 0,
      totalNbAteliersSuivis: ateliersStats?.totals?.nb_ateliers || 0,
      totalHeuresAteliersAnimes: ateliersStats?.totals?.heures_ateliers_animes || 0,
      totalNbAteliersAnimes: ateliersStats?.totals?.nb_ateliers_animes || 0
    };
  }, [months, workshops, allPresences, incubeId, incube, annee, ateliersStats, tourniquetFilterMode, tourniquetTeamData]);

  // Synthèse dynamique pour le bandeau des filtres Tourniquets (mois par mois ou cumul annuel)
  const currentTourniquetSynthesis = useMemo(() => {
    const isAll = selectedTourniquetMonth === 'all';
    if (isAll) {
      const porteur = Number(
        tourniquetTeamData?.metrics?.totalHeuresPorteur ??
        (tourniquetTeamData?.porteurMonthlyHours
          ? Object.values(tourniquetTeamData.porteurMonthlyHours).reduce((a, b) => a + Number(b || 0), 0)
          : MOIS.reduce((sum, m) => sum + (parseFloat(months[m]?.moyenne_heures_presence) || 0), 0))
      );
      const associes = Number(tourniquetTeamData?.metrics?.totalHeuresAssocies || 0);
      const salaries = Number(tourniquetTeamData?.metrics?.totalHeuresSalaries || 0);
      const equipe = Math.round((porteur + associes + salaries) * 10) / 10;

      return {
        label: `Annuel (12 mois)`,
        isAll: true,
        heuresPorteur: Math.round(porteur * 10) / 10,
        heuresAssocies: Math.round(associes * 10) / 10,
        heuresSalaries: Math.round(salaries * 10) / 10,
        heuresEquipe: equipe
      };
    } else {
      const m = selectedTourniquetMonth;
      const porteur = Number(
        tourniquetTeamData?.porteurMonthlyHours?.[m] ??
        (months[m]?.moyenne_heures_presence !== '' && !isNaN(months[m]?.moyenne_heures_presence)
          ? parseFloat(months[m]?.moyenne_heures_presence)
          : 0)
      );
      const associes = Number(tourniquetTeamData?.associesMonthlyHours?.[m] || 0);
      const salaries = Number(tourniquetTeamData?.salariesMonthlyHours?.[m] || 0);
      const equipe = Math.round((porteur + associes + salaries) * 10) / 10;

      return {
        label: `${m} ${annee}`,
        isAll: false,
        heuresPorteur: Math.round(porteur * 10) / 10,
        heuresAssocies: Math.round(associes * 10) / 10,
        heuresSalaries: Math.round(salaries * 10) / 10,
        heuresEquipe: equipe
      };
    }
  }, [selectedTourniquetMonth, tourniquetTeamData, months, annee]);

  return (
    <div className="space-y-6 slide-up w-full">
      {/* 1. Cartes de statistiques (KPI) EN HAUT DE PAGE — Alignées sur une seule ligne avec hauteur harmonieuse */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 relative">
        
        {/* CARTE 1 : Présence & Assiduité aux Horaires */}
        <div className="card p-3.5 sm:p-4 border border-slate-200 dark:border-dark-700/60 flex flex-col justify-between gap-2.5 overflow-hidden shadow-sm hover:border-blue-400/50 transition-all">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                <Clock size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-dark-400 font-bold uppercase tracking-wider truncate">
                    Présence Heures (Obj: 15h/sem)
                  </p>
                  <span className={`text-[9px] font-black px-1.5 py-0.2 rounded border ${
                    tourniquetFilterMode === 'equipe'
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                      : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                  }`}>
                    {tourniquetFilterMode === 'equipe'
                      ? 'Équipe'
                      : tourniquetFilterMode === 'associes'
                      ? 'Associés'
                      : tourniquetFilterMode === 'salaries'
                      ? 'Salariés RH'
                      : 'Incubé seul'}
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-dark-100">{stats.moyenneHebdo}</span>
                  {stats.moyenneHebdo !== '—' && <span className="text-[11px] font-bold text-slate-400">h / sem</span>}
                </div>
              </div>
            </div>
            {stats.tauxHebdo !== '—' && (
              <span className={`px-2 py-0.5 rounded-lg text-xs font-black border shrink-0 ${
                stats.tauxHebdo >= 100 
                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400'
                  : 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400'
              }`}>
                {stats.tauxHebdo}%
              </span>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-dark-700/60 flex items-center justify-between text-xs gap-1">
            {stats.moyenneMensuelle !== '—' ? (
              <>
                <span className="text-slate-500 dark:text-dark-400 text-[11px] truncate">Mois : <strong>{stats.moyenneMensuelle}h</strong></span>
                <span className="font-bold text-slate-800 dark:text-dark-200 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md text-[11px] shrink-0">
                  Total : {stats.totalHeures}h ({stats.tauxAnnuelCumule}%)
                </span>
              </>
            ) : (
              <span className="text-[11px] text-slate-400 italic truncate">Aucune heure saisie pour {annee}</span>
            )}
          </div>
        </div>

        {/* CARTE 2 : Formations Obligatoires */}
        <div className="card p-3.5 sm:p-4 border border-slate-200 dark:border-dark-700/60 flex flex-col justify-between gap-2.5 overflow-hidden shadow-sm hover:border-emerald-400/50 transition-all">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                <GraduationCap size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-dark-400 font-bold uppercase tracking-wider truncate">
                  Formations Obligatoires
                </p>
                <div className="flex items-baseline gap-1 mt-0.5 flex-wrap">
                  <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {stats.tauxFormationsReel}%
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 whitespace-nowrap">
                    ({stats.assistesSurRequis}/{stats.baseRequisCount} requis)
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center shrink-0">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
                {trackName}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-dark-700/60 flex items-center justify-between text-xs gap-1">
            <span className="text-slate-500 dark:text-dark-400 text-[11px] truncate">Obligatoires {annee} :</span>
            <span className="font-bold text-slate-800 dark:text-dark-200 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-md text-[11px] shrink-0">
              {stats.totalAssistesAnnee} / {stats.totalAteliersAnnee} séances ({stats.tauxFormationsReel}%)
            </span>
          </div>
        </div>

        {/* CARTE 3 : Ateliers Collectifs */}
        <div className="card p-3.5 sm:p-4 border border-slate-200 dark:border-dark-700/60 flex flex-col justify-between gap-2.5 overflow-hidden shadow-sm hover:border-cyan-400/50 transition-all">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                <Users size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-dark-400 font-bold uppercase tracking-wider truncate">
                  Ateliers Collectifs
                </p>
                <div className="flex items-baseline gap-1 mt-0.5 flex-wrap">
                  <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-dark-100">
                    {Number(stats.totalHeuresAteliersSuivies || 0).toFixed(0)}h
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
                    ({stats.totalNbAteliersSuivis || 0} suivi{stats.totalNbAteliersSuivis > 1 ? 's' : ''})
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-dark-700/60 flex items-center justify-between text-xs gap-1">
            <span className="text-slate-500 dark:text-dark-400 text-[11px] truncate">Rôle Animateur :</span>
            {Number(stats.totalNbAteliersAnimes) > 0 ? (
              <span className="font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md text-[11px] flex items-center gap-1 shrink-0">
                {stats.totalNbAteliersAnimes} ({stats.totalHeuresAteliersAnimes}h)
              </span>
            ) : (
              <span className="text-[11px] text-slate-400 shrink-0 font-medium">0 atelier animé</span>
            )}
          </div>
        </div>

        {/* CARTE 4 : Mois de Présence & Initiatives */}
        <div className="card p-3.5 sm:p-4 border border-slate-200 dark:border-dark-700/60 flex flex-col justify-between gap-2.5 overflow-hidden shadow-sm hover:border-amber-400/50 transition-all">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                <Sparkles size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-dark-400 font-bold uppercase tracking-wider truncate">
                  Mois de Présence
                </p>
                <div className="flex items-baseline gap-1 mt-0.5 flex-wrap">
                  <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-dark-100">{stats.countMoisRemplis}</span>
                  <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap"> / 12 mois</span>
                </div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-lg text-xs font-black border bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400 shrink-0">
              {Math.round((stats.countMoisRemplis / 12) * 100)}%
            </span>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-dark-700/60 flex items-center justify-between text-xs gap-1">
            <span className="text-slate-500 dark:text-dark-400 text-[11px] shrink-0">Mois actifs :</span>
            <span 
              className="font-bold text-slate-800 dark:text-dark-200 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-md text-[11px] truncate text-right flex-1 min-w-0"
              title={stats.moisPresents.length > 0 ? stats.moisPresents.join(', ') : 'Aucun mois avec heures enregistrées'}
            >
              {stats.moisPresents.length > 0 ? `${stats.countMoisRemplis} mois validé(s)` : 'Aucune présence enregistrée'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Barre de contrôle épurée sans cadre EN DESSOUS DES CARTES DE STATISTIQUES */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 relative z-10 py-1">
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 min-w-0">
          {incubeSelector}

          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl px-2.5 py-1.5 text-xs shadow-sm shrink-0">
            <span className="text-slate-500 dark:text-dark-400 font-medium">Année :</span>
            <select 
              className="bg-transparent font-bold text-slate-800 dark:text-dark-100 focus:outline-none cursor-pointer pr-1"
              value={annee} 
              onChange={(e) => handleYearChange(parseInt(e.target.value))}
            >
              {availableYears.map((y) => (
                <option key={y} value={y} className="bg-white dark:bg-dark-900 text-slate-800 dark:text-dark-100">{y}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap shrink-0">
          {/* BOUTON ACTUALISER TOURNIQUETS PHYSIQUES */}
          <button
            type="button"
            className="btn btn-secondary btn-sm !py-1.5 !px-2.5 text-xs flex items-center gap-1.5 border-blue-500/40 text-blue-700 dark:text-blue-400 hover:bg-blue-500/10 font-bold shadow-sm whitespace-nowrap"
            onClick={() => handleSyncTourniquet(false)}
            disabled={syncingTourniquet}
            title="Actualiser les pointages réels depuis les 7 tourniquets physiques ZKTeco"
          >
            <RefreshCw size={14} className={`text-blue-500 ${syncingTourniquet ? 'animate-spin' : ''}`} />
            <span>{syncingTourniquet ? 'Actualisation...' : 'Actualiser Tourniquets'}</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm !py-1.5 !px-2.5 text-xs flex items-center gap-1.5 border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 font-bold shadow-sm whitespace-nowrap"
            onClick={handleSendAlerteAssiduite}
            disabled={sendingAlerte}
            title="Envoyer un email officiel de relance d'assiduité à l'incubé"
          >
            <Mail size={14} className="text-amber-500" />
            <span>{sendingAlerte ? 'Envoi...' : 'Relancer par email'}</span>
          </button>

          <button 
            className="btn btn-primary btn-sm !py-1.5 !px-3 text-xs shadow-md shadow-primary-500/20 flex items-center gap-1.5 font-bold whitespace-nowrap"
            onClick={saveAllMonths}
            disabled={savingAll}
            title="Enregistrer les remarques et observations"
          >
            <Save size={14} />
            <span>{savingAll ? 'Enregistrement...' : 'Enregistrer remarques'}</span>
          </button>
        </div>
      </div>

      {/* Avertissement informatif si aucun membre de la startup (ni porteur, ni associé, ni salarié) n'a de badge ZKTeco */}
      {!incube?.badge_id && !incube?.matricule && !(tourniquetTeamData?.incube?.hasBadge) && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs shadow-sm">
          <AlertCircle size={18} className="text-amber-500 shrink-0" />
          <div className="flex-1">
            <span className="font-bold">Aucun badge tourniquet n'est attribué à cette startup ({incube?.nom_incube || '—'}).</span>
            <span className="block sm:inline sm:ml-1 text-slate-600 dark:text-dark-300">
              Les heures de présence (Porteur + Associés + Salariés RH) seront enregistrées automatiquement dès qu'un badge physique ZKTeco sera affecté dans <em>« Infos Générales »</em> ou <em>« Ressources Humaines »</em>.
            </span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STRUCTURE EN 3 PARTIES SÉPARÉES D'ENGAGEMENT (NAVIGATION PAR ONGLETS)     */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        {/* BARRE D'ONGLETS NAVIGATION 3 PARTIES — ALIGNÉE SUR UNE SEULE LIGNE */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-dark-700/60 pb-2.5 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveEngagementTab('tourniquets')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-xs whitespace-nowrap ${
                activeEngagementTab === 'tourniquets'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                  : 'bg-white dark:bg-dark-900 border-slate-200 dark:border-dark-700 text-slate-700 dark:text-dark-200 hover:bg-slate-50 dark:hover:bg-dark-800'
              }`}
            >
              <Clock size={14} className={activeEngagementTab === 'tourniquets' ? 'text-white' : 'text-blue-500'} />
              <span>Partie 1 : Tourniquets</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveEngagementTab('formations')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-xs whitespace-nowrap ${
                activeEngagementTab === 'formations'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20'
                  : 'bg-white dark:bg-dark-900 border-slate-200 dark:border-dark-700 text-slate-700 dark:text-dark-200 hover:bg-slate-50 dark:hover:bg-dark-800'
              }`}
            >
              <GraduationCap size={14} className={activeEngagementTab === 'formations' ? 'text-white' : 'text-emerald-500'} />
              <span>Partie 2 : Formations (Pré/Post-Création)</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-black ${
                activeEngagementTab === 'formations' ? 'bg-white/20 text-white' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              }`}>
                {stats.tauxFormationsReel}%
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveEngagementTab('ateliers')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-xs whitespace-nowrap ${
                activeEngagementTab === 'ateliers'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-500/20'
                  : 'bg-white dark:bg-dark-900 border-slate-200 dark:border-dark-700 text-slate-700 dark:text-dark-200 hover:bg-slate-50 dark:hover:bg-dark-800'
              }`}
            >
              <Users size={14} className={activeEngagementTab === 'ateliers' ? 'text-white' : 'text-amber-500'} />
              <span>Partie 3 : Ateliers & Événements</span>
              {(Number(stats.totalNbAteliersSuivis) > 0 || Number(stats.totalNbAteliersAnimes) > 0) && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-black ${
                  activeEngagementTab === 'ateliers' ? 'bg-white/20 text-white' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                }`}>
                  {Number(stats.totalNbAteliersSuivis) + Number(stats.totalNbAteliersAnimes)}
                </span>
              )}
            </button>
          </div>

          {/* Actions contextuelles selon l'onglet actif — Alignées sur la même ligne */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-2">
            {activeEngagementTab === 'formations' && (
              <button
                type="button"
                onClick={handleSyncAllFormationsFromEvents}
                className="btn btn-secondary btn-xs font-bold text-emerald-600 inline-flex items-center gap-1.5 border-emerald-200 dark:border-emerald-900 whitespace-nowrap"
                title="Recalculer l'assiduité depuis les feuilles d'émargement"
              >
                <Sparkles size={13} />
                <span>Sync Formations</span>
              </button>
            )}
            {activeEngagementTab === 'ateliers' && (
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleSyncAteliers(false)}
                  disabled={syncingAteliers}
                  className="btn btn-secondary btn-xs font-bold text-amber-600 inline-flex items-center gap-1.5 border-amber-200 dark:border-amber-900 whitespace-nowrap"
                  title="Synchroniser les présences d'ateliers et rôles d'animateur"
                >
                  <RefreshCw size={13} className={syncingAteliers ? "animate-spin" : ""} />
                  <span>Sync Ateliers</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/evenements')}
                  className="btn btn-secondary btn-xs text-slate-600 dark:text-dark-300 inline-flex items-center gap-1 border-slate-200 dark:border-dark-700 whitespace-nowrap"
                  title="Ouvrir la page des Événements et Ateliers"
                >
                  <ExternalLink size={12} />
                  <span>Gérer Événements</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* VUE 1 : PRÉSENCE PHYSIQUE & TOURNIQUETS (12 MOIS)        */}
        {/* ========================================================= */}
        {activeEngagementTab === 'tourniquets' && (
          <div className="space-y-3">
            {/* Barre de filtrage épurée sur 1 seule ligne : chaque bouton filtre réellement le tableau */}
            <div className="rounded-xl border border-slate-200/80 dark:border-dark-700/60 bg-white dark:bg-dark-900 p-2 sm:px-3 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                
                {/* Gauche : Boutons de filtrage interactifs par catégorie (zéro badge décoratif inutile) */}
                <div className="inline-flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-dark-800 p-1 rounded-xl border border-slate-200/70 dark:border-dark-700">
                  <button
                    type="button"
                    onClick={() => setTourniquetFilterMode('equipe')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      tourniquetFilterMode === 'equipe'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-dark-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-dark-700/60'
                    }`}
                  >
                    <Users size={13} className="shrink-0" />
                    <span>Équipe</span>
                    <span className={`px-1.5 py-0.2 rounded text-[11px] font-extrabold ${
                      tourniquetFilterMode === 'equipe'
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200/80 dark:bg-dark-700 text-slate-700 dark:text-dark-200'
                    }`}>
                      {currentTourniquetSynthesis.heuresEquipe} h
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTourniquetFilterMode('porteur')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      tourniquetFilterMode === 'porteur'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-dark-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-dark-700/60'
                    }`}
                  >
                    <span>Incubé</span>
                    <span className={`px-1.5 py-0.2 rounded text-[11px] font-extrabold ${
                      tourniquetFilterMode === 'porteur'
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200/80 dark:bg-dark-700 text-slate-700 dark:text-dark-200'
                    }`}>
                      {currentTourniquetSynthesis.heuresPorteur} h
                    </span>
                  </button>

                  {(currentTourniquetSynthesis.heuresAssocies > 0 || (tourniquetTeamData?.teamBreakdown || []).some(m => m.type === 'associe')) && (
                    <button
                      type="button"
                      onClick={() => setTourniquetFilterMode('associes')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        tourniquetFilterMode === 'associes'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-dark-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-dark-700/60'
                      }`}
                    >
                      <span>Associés</span>
                      <span className={`px-1.5 py-0.2 rounded text-[11px] font-extrabold ${
                        tourniquetFilterMode === 'associes'
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-200/80 dark:bg-dark-700 text-slate-700 dark:text-dark-200'
                      }`}>
                        {currentTourniquetSynthesis.heuresAssocies} h
                      </span>
                    </button>
                  )}

                  {(currentTourniquetSynthesis.heuresSalaries > 0 || (tourniquetTeamData?.teamBreakdown || []).some(m => m.type === 'salarie')) && (
                    <button
                      type="button"
                      onClick={() => setTourniquetFilterMode('salaries')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        tourniquetFilterMode === 'salaries'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-dark-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-dark-700/60'
                      }`}
                    >
                      <span>Salariés RH</span>
                      <span className={`px-1.5 py-0.2 rounded text-[11px] font-extrabold ${
                        tourniquetFilterMode === 'salaries'
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-200/80 dark:bg-dark-700 text-slate-700 dark:text-dark-200'
                      }`}>
                        {currentTourniquetSynthesis.heuresSalaries} h
                      </span>
                    </button>
                  )}
                </div>

                {/* Droite : Sélecteur de mois compact & bouton détail des membres */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl px-2.5 py-1.5 text-xs">
                    <Calendar size={13} className="text-blue-600 dark:text-blue-400 shrink-0" />
                    <select
                      value={selectedTourniquetMonth}
                      onChange={(e) => setSelectedTourniquetMonth(e.target.value)}
                      className="bg-transparent font-bold text-slate-800 dark:text-dark-100 focus:outline-none cursor-pointer pr-1 text-xs"
                    >
                      <option value="all">Tous les 12 mois</option>
                      {MOIS.map((m) => {
                        const porteurM = Number(tourniquetTeamData?.porteurMonthlyHours?.[m] ?? months[m]?.moyenne_heures_presence ?? 0);
                        const assocM = Number(tourniquetTeamData?.associesMonthlyHours?.[m] ?? 0);
                        const salM = Number(tourniquetTeamData?.salariesMonthlyHours?.[m] ?? 0);
                        const equipeM = Number(tourniquetTeamData?.equipeMonthlyHours?.[m] ?? porteurM);
                        const hVal =
                          tourniquetFilterMode === 'porteur' ? porteurM :
                          tourniquetFilterMode === 'associes' ? assocM :
                          tourniquetFilterMode === 'salaries' ? salM :
                          equipeM;
                        return (
                          <option key={m} value={m}>
                            {m} {annee} {hVal > 0 ? `(${hVal.toFixed(1)} h)` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {tourniquetTeamData?.teamBreakdown && tourniquetTeamData.teamBreakdown.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setIsTeamDetailOpen(!isTeamDetailOpen)}
                      className={`px-2.5 py-1.5 text-xs font-bold rounded-xl border flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                        isTeamDetailOpen
                          ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                          : 'border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 hover:bg-slate-100 dark:hover:bg-dark-700 text-slate-700 dark:text-dark-200'
                      }`}
                    >
                      <span>{isTeamDetailOpen ? 'Masquer membres' : `Détail (${tourniquetTeamData.teamBreakdown.length} membres)`}</span>
                      <ChevronDown size={14} className={`transition-transform duration-200 ${isTeamDetailOpen ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </div>

              </div>

              {/* Volet Déroulant des membres (Visible uniquement si déplié) */}
              {isTeamDetailOpen && tourniquetTeamData?.teamBreakdown && (
                <div className="pt-2.5 mt-2.5 border-t border-slate-200/70 dark:border-dark-700/60 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                    {tourniquetTeamData.teamBreakdown.map((member, mIdx) => {
                      const isPorteur = member.type === 'porteur';
                      const memberMonthHours = selectedTourniquetMonth === 'all'
                        ? (member.totalHours || 0)
                        : Number(member.monthlyHours?.[selectedTourniquetMonth] || 0);

                      const isDimmed =
                        (tourniquetFilterMode === 'porteur' && member.type !== 'porteur') ||
                        (tourniquetFilterMode === 'associes' && member.type !== 'associe') ||
                        (tourniquetFilterMode === 'salaries' && member.type !== 'salarie');

                      return (
                        <div
                          key={mIdx}
                          className={`p-2 rounded-lg border flex items-center justify-between gap-2 transition-all ${
                            isDimmed
                              ? 'opacity-40 bg-slate-50/50 dark:bg-dark-800/30 border-slate-200/50 dark:border-dark-700/30'
                              : memberMonthHours > 0
                              ? 'bg-white dark:bg-dark-900 border-blue-200 dark:border-blue-800/60 shadow-2xs ring-1 ring-blue-500/20'
                              : 'bg-white/80 dark:bg-dark-900/60 border-slate-200/80 dark:border-dark-700/60'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${
                              member.hasBadge 
                                ? (memberMonthHours > 0 ? 'bg-emerald-500' : 'bg-blue-400') 
                                : 'bg-slate-300 dark:bg-dark-600'
                            }`} />
                            <div className="min-w-0 truncate">
                              <p className="text-xs font-bold text-slate-800 dark:text-dark-100 truncate">
                                {member.name}
                                {isPorteur && <span className="ml-1 text-[10px] text-blue-600 dark:text-blue-400 font-semibold">(Porteur)</span>}
                              </p>
                              <div className="flex items-center gap-1 text-[10px] text-slate-400 truncate">
                                <span>{member.role || 'Collaborateur'}</span>
                                <span>•</span>
                                {member.matricule || member.badge_id ? (
                                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                    #{member.matricule || member.badge_id}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">Sans badge</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <span className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${
                            isDimmed
                              ? 'text-slate-400 line-through'
                              : memberMonthHours > 0
                              ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                              : 'text-slate-400 dark:text-dark-500'
                          }`}>
                            {memberMonthHours}h
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>

            <div className="card overflow-hidden border border-slate-200 dark:border-dark-700/60 shadow-sm p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-dark-300 border-b border-slate-200 dark:border-dark-700/60">
                      <th className="py-3 px-4 font-bold text-slate-800 dark:text-dark-200 w-32 sticky left-0 bg-slate-100 dark:bg-dark-800 z-10 border-r border-slate-200 dark:border-dark-700/60">
                        Mois
                      </th>
                      <th className="py-3 px-4 font-bold text-slate-800 dark:text-dark-200 text-center min-w-[200px]">
                        <div className="flex items-center justify-center gap-1.5">
                          <span>
                            {tourniquetFilterMode === 'equipe'
                              ? '👥 Heures Totales Équipe / Mois'
                              : tourniquetFilterMode === 'associes'
                              ? '💼 Heures Associés / Mois'
                              : tourniquetFilterMode === 'salaries'
                              ? '🪪 Heures Salariés RH / Mois'
                              : '👤 Heures Incubé Seul / Mois'}
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            ZKTeco Direct
                          </span>
                        </div>
                        <div className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">Objectif : 60 h/mois (15 h/sem)</div>
                      </th>
                      <th className="py-3 px-4 font-bold text-slate-800 dark:text-dark-200 text-center min-w-[160px]">
                        Moyenne Hebdomadaire
                        <div className="text-[10px] font-semibold text-slate-500">Objectif : 15 h/sem</div>
                      </th>
                      <th className="py-3 px-4 font-bold text-slate-800 dark:text-dark-200 text-center min-w-[180px]">
                        Progression mensuelle
                        <div className="text-[10px] font-semibold text-slate-500">Taux réalisation</div>
                      </th>
                      <th className="py-3 px-4 font-bold text-slate-800 dark:text-dark-200 text-center min-w-[140px]">
                        Statut & Conformité
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-dark-700/50">
                    {(() => {
                      const monthsToRender = selectedTourniquetMonth === 'all' ? MOIS : [selectedTourniquetMonth];
                      return monthsToRender.map((m) => {
                        const idx = MOIS.indexOf(m);
                        const item = months[m] || {};
                        const rowBg = idx % 2 === 0 ? 'bg-white dark:bg-dark-900/60' : 'bg-slate-50/60 dark:bg-dark-800/40';

                        let valPresence = null;
                        if (tourniquetFilterMode === 'porteur') {
                          if (tourniquetTeamData?.porteurMonthlyHours && tourniquetTeamData.porteurMonthlyHours[m] !== undefined) {
                            valPresence = Number(tourniquetTeamData.porteurMonthlyHours[m] || 0);
                          } else if (item.moyenne_heures_presence !== '' && !isNaN(item.moyenne_heures_presence)) {
                            valPresence = parseFloat(item.moyenne_heures_presence);
                          }
                        } else if (tourniquetFilterMode === 'associes') {
                          valPresence = Number(tourniquetTeamData?.associesMonthlyHours?.[m] || 0);
                        } else if (tourniquetFilterMode === 'salaries') {
                          valPresence = Number(tourniquetTeamData?.salariesMonthlyHours?.[m] || 0);
                        } else {
                          if (tourniquetTeamData?.equipeMonthlyHours && tourniquetTeamData.equipeMonthlyHours[m] !== undefined) {
                            valPresence = Number(tourniquetTeamData.equipeMonthlyHours[m] || 0);
                          } else if (item.moyenne_heures_presence !== '' && !isNaN(item.moyenne_heures_presence)) {
                            valPresence = parseFloat(item.moyenne_heures_presence);
                          }
                        }

                        const pMonthH = Number(tourniquetTeamData?.porteurMonthlyHours?.[m] || 0);
                        const aMonthH = Number(tourniquetTeamData?.associesMonthlyHours?.[m] || 0);
                        const sMonthH = Number(tourniquetTeamData?.salariesMonthlyHours?.[m] || 0);
                        const hasTeamContribution = tourniquetFilterMode === 'equipe' && (aMonthH > 0 || sMonthH > 0);

                        const hebdoHeures = valPresence !== null ? (valPresence / 4).toFixed(1) : null;
                        const moisTaux = valPresence !== null ? Math.round((valPresence / OBJECTIF_MOIS) * 100) : null;
                        const isFutureMonth = annee === currentYear && idx > new Date().getMonth();
                        const hasBadge = Boolean(incube?.badge_id || incube?.matricule || tourniquetTeamData?.incube?.hasBadge);

                        return (
                          <tr key={m} className={`${rowBg} hover:bg-slate-100/60 dark:hover:bg-dark-700/30 transition-colors`}>
                            <td className={`py-3 px-4 font-bold text-slate-800 dark:text-dark-200 sticky left-0 z-10 border-r border-slate-200 dark:border-dark-700/60 shadow-sm ${
                              idx % 2 === 0 ? 'bg-white dark:bg-dark-900' : 'bg-slate-50 dark:bg-dark-800'
                            }`}>
                              <div className="flex items-center justify-between gap-1.5">
                                <span>{m}</span>
                                {selectedTourniquetMonth !== 'all' && (
                                  <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
                                    {annee}
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="p-3 text-center">
                              <div className="inline-flex flex-col items-center justify-center gap-0.5">
                                <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1 bg-slate-100/90 dark:bg-dark-800/90 border border-slate-200/80 dark:border-dark-700/80 rounded-md font-mono">
                                  <span className="text-xs font-black text-slate-900 dark:text-white">
                                    {valPresence !== null ? Number(valPresence).toFixed(1) : (isFutureMonth ? '—' : '0.0')}
                                  </span>
                                  <span className="text-[11px] text-slate-500 font-semibold">h / mois</span>
                                </div>
                                {tourniquetFilterMode === 'equipe' && hasTeamContribution ? (
                                  <div className="text-[10px] text-slate-500 dark:text-dark-400 font-medium">
                                    Incubé: {pMonthH.toFixed(1)}h
                                    {aMonthH > 0 ? ` • Associés: +${aMonthH.toFixed(1)}h` : ''}
                                    {sMonthH > 0 ? ` • Salariés: +${sMonthH.toFixed(1)}h` : ''}
                                  </div>
                                ) : tourniquetFilterMode === 'porteur' && (aMonthH > 0 || sMonthH > 0) ? (
                                  <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                                    Porteur seul ({pMonthH.toFixed(1)}h sur {Number(pMonthH + aMonthH + sMonthH).toFixed(1)}h équipe)
                                  </div>
                                ) : null}
                              </div>
                            </td>

                            <td className="p-3 text-center font-medium text-slate-700 dark:text-dark-300">
                              {hebdoHeures !== null ? `${hebdoHeures} h / sem` : '—'}
                            </td>

                            <td className="p-3 text-center">
                              {valPresence !== null && valPresence > 0 ? (
                                <div className="w-36 mx-auto space-y-1">
                                  <div className="flex justify-between text-[10px] font-bold text-slate-500">
                                    <span>{valPresence}h</span>
                                    <span>{moisTaux}%</span>
                                  </div>
                                  <div className="h-1.5 w-full bg-slate-200 dark:bg-dark-700 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all duration-500 ${
                                        moisTaux >= 100 ? 'bg-emerald-500' : moisTaux >= 75 ? 'bg-amber-500' : 'bg-rose-500'
                                      }`}
                                      style={{ width: `${Math.min(moisTaux, 100)}%` }}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-xs italic">—</span>
                              )}
                            </td>

                            <td className="p-3 text-center">
                              {valPresence !== null && valPresence > 0 ? (
                                <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider border ${
                                  moisTaux >= 100 
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                                    : moisTaux >= 75
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-700'
                                }`}>
                                  {moisTaux >= 100 ? 'CONFORME' : moisTaux >= 75 ? 'ATTENTION' : 'NON CONFORME'}
                                </span>
                              ) : !hasBadge ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-dark-800 dark:text-dark-400">Sans badge</span>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">En attente</span>
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* VUE 2 : FORMATIONS OBLIGATOIRES (MODULES OFFICIELS)      */}
        {/* ========================================================= */}
        {activeEngagementTab === 'formations' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200 text-xs">
              <div className="flex items-center gap-2">
                <GraduationCap size={20} className="text-emerald-600 shrink-0" />
                <div>
                  <span className="font-bold text-sm">Parcours Officiel IDS : {trackName}</span>
                  <p className="text-xs text-slate-600 dark:text-dark-300 mt-0.5">
                    Sessions du tronc commun obligatoire • Assiduité globale : <strong>{stats.tauxFormationsReel}%</strong> ({stats.totalAssistesAnnee} sur {stats.totalAteliersAnnee} séances validées).
                  </p>
                </div>
              </div>
              <span className={`px-3 py-1.5 rounded-lg text-xs font-black ${
                stats.tauxFormationsReel >= 80 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : 'bg-amber-500 text-white shadow-xs'
              }`}>
                Objectif ≥ 80% : {stats.tauxFormationsReel >= 80 ? 'Validé' : 'En cours'}
              </span>
            </div>

            <div className="card overflow-hidden border border-slate-200 dark:border-dark-700/60 shadow-sm p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-dark-300 border-b border-slate-200 dark:border-dark-700/60">
                      <th className="py-3 px-4 font-bold text-slate-800 dark:text-dark-200 w-12">#</th>
                      <th className="py-3 px-4 font-bold text-slate-800 dark:text-dark-200">Module Obligatoire / Thème</th>
                      <th className="py-3 px-4 font-bold text-slate-800 dark:text-dark-200">Date Planifiée</th>
                      <th className="py-3 px-4 font-bold text-slate-800 dark:text-dark-200">Formateur / Intervenant</th>
                      <th className="py-3 px-4 font-bold text-slate-800 dark:text-dark-200 text-center">Durée</th>
                      <th className="py-3 px-4 font-bold text-slate-800 dark:text-dark-200 text-center">Émargement</th>
                      <th className="py-3 px-4 font-bold text-slate-800 dark:text-dark-200 text-center">Statut Attestation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-dark-700/50">
                    {workshops.length > 0 ? (
                      workshops.map((w, idx) => {
                        const isPres = isIncubePresentAtWorkshop(w);
                        const monthName = w.date ? MOIS[new Date(w.date).getMonth()] : MOIS[0];
                        return (
                          <tr key={w.id || idx} className="hover:bg-slate-50 dark:hover:bg-dark-800/40 transition-colors">
                            <td className="py-3 px-4 font-bold text-slate-400">{idx + 1}</td>
                            <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${isPres ? 'bg-emerald-500' : 'bg-amber-400'}`}></span>
                                <span>{w.titre}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-slate-600 dark:text-dark-300 font-medium">
                              {w.date ? new Date(w.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
                            </td>
                            <td className="py-3 px-4 text-slate-600 dark:text-dark-300">
                              {w.formateur || w.intervenant || 'Intervenant IDS'}
                            </td>
                            <td className="py-3 px-4 text-center font-bold text-slate-700 dark:text-dark-300">
                              {w.duree || '3h00'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => handleTogglePresence(w, monthName)}
                                className={`px-3 py-1 rounded-lg font-bold text-xs inline-flex items-center gap-1.5 transition-all shadow-2xs border ${
                                  isPres
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                                }`}
                                title="Cliquer pour basculer Présent / Absent"
                              >
                                {isPres ? (
                                  <>
                                    <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
                                    <span>Présent (Validé)</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                    <span>Non validé (Absent)</span>
                                  </>
                                )}
                              </button>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`text-xs font-bold ${isPres ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {isPres ? 'Attestation éligible' : 'À rattraper'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-slate-400 italic">
                          Aucun module de formation obligatoire enregistré pour ce parcours.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* VUE 3 : ATELIERS & ÉVÉNEMENTS (FORMAT AGENDA & PLANNING MENSUEL) */}
        {/* ========================================================================= */}
        {activeEngagementTab === 'ateliers' && (
          <div className="space-y-6">
            {/* 1. ATELIERS SUIVIS PAR L'INCUBÉ (RÔLE : BÉNÉFICIAIRE) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-cyan-700 dark:text-cyan-400 uppercase tracking-wider">
                  1. Ateliers Suivis par l'Incubé (Rôle : Bénéficiaire)
                </h3>
                <span className="text-xs font-bold text-slate-500">
                  Total : {stats.totalHeuresAteliersSuivies} h • {stats.totalNbAteliersSuivis} atelier(s)
                </span>
              </div>

              <div className="card overflow-hidden border border-slate-200 dark:border-dark-700/60 shadow-sm p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-dark-300 border-b border-slate-200 dark:border-dark-700/60">
                        <th className="py-2.5 px-3 font-semibold">Atelier Pratique</th>
                        <th className="py-2.5 px-3 font-semibold">Date</th>
                        <th className="py-2.5 px-3 font-semibold">Animateur / Formateur</th>
                        <th className="py-2.5 px-3 font-semibold text-center">Durée</th>
                        <th className="py-2.5 px-3 font-semibold text-center">Émargement QR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-dark-700/50">
                      {ateliersStats?.totals?.nb_ateliers_suivis > 0 ? (
                        Object.values(ateliersStats.monthly || {}).flatMap(m => m.ateliers_suivis || []).map((a, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-dark-800/40">
                            <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{a.titre}</td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-dark-300">
                              {a.date ? new Date(a.date).toLocaleDateString('fr-FR') : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-dark-300">{a.formateur || 'Intervenant IDS'}</td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-700 dark:text-dark-300">{a.duree || `${a.heures}h`}</td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
                                QR Validé
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                            Aucun atelier pratique émargé pour le moment pour cette année.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* 2. ATELIERS ANIMÉS PAR L'INCUBÉ (RÔLE : ANIMATEUR / PAIR-À-PAIR & INITIATIVES) */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/20 pb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                    2. Ateliers Animés par l'Incubé & Initiatives ({annee})
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800">
                    Total heures dispensées : {stats.totalHeuresAteliersAnimes} h ({stats.totalNbAteliersAnimes} atelier{stats.totalNbAteliersAnimes > 1 ? 's' : ''})
                  </span>
                </div>
              </div>

              {/* TABLEAU : AU NIVEAU DE MOIS UNE AGENDA POUR SÉLECTIONNER LE MOIS */}
              <div className="card overflow-hidden border border-slate-200 dark:border-dark-700/60 shadow-sm p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-dark-300 border-b border-slate-200 dark:border-dark-700/60">
                        <th className="py-3 px-4 font-bold text-slate-800 dark:text-dark-200 w-52 sticky left-0 bg-slate-100 dark:bg-dark-800 z-10 border-r border-slate-200 dark:border-dark-700/60">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="flex items-center gap-1.5">
                              <Calendar size={14} className="text-amber-500" />
                              <span>Mois (Agenda)</span>
                            </span>
                          </div>
                        </th>
                        <th className="py-3 px-4 font-bold text-slate-800 dark:text-dark-200 text-center min-w-[150px]">
                          Ateliers Animés
                          <div className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">Heures données</div>
                        </th>
                        <th className="py-3 px-4 font-bold text-slate-800 dark:text-dark-200 min-w-[240px]">
                          Initiatives & Projets
                        </th>
                        <th className="py-3 px-4 font-bold text-slate-800 dark:text-dark-200 min-w-[240px]">
                          Observation & Remarques
                        </th>
                        <th className="py-3 px-3 font-bold text-slate-800 dark:text-dark-200 text-center w-20">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-dark-700/50">
                      {(() => {
                        const isAll = selectedAgendaMonth === 'all';
                        const monthsToRender = isAll ? MOIS : [selectedAgendaMonth];

                        return monthsToRender.map((m) => {
                          const idx = MOIS.indexOf(m);
                          const item = months[m] || {};
                          const isSaving = savingRowIdx === idx;
                          const mStats = ateliersStats?.monthly?.[m] || {};
                          const hAnimees = mStats.heures_ateliers_animes !== undefined ? mStats.heures_ateliers_animes : (item.heures_ateliers_animes || 0);
                          const nbAnimes = mStats.nb_ateliers_animes !== undefined ? mStats.nb_ateliers_animes : (item.nb_ateliers_animes || 0);

                          return (
                            <tr key={m} className="bg-white dark:bg-dark-900/60 hover:bg-slate-100/60 dark:hover:bg-dark-700/30 transition-colors">
                              {/* COLONNE MOIS : SÉLECTEUR AGENDA POUR CHOISIR LE MOIS */}
                              <td className="py-3 px-4 font-bold text-slate-800 dark:text-dark-200 sticky left-0 z-10 border-r border-slate-200 dark:border-dark-700/60 shadow-sm bg-white dark:bg-dark-900">
                                <div className="flex items-center gap-1.5">
                                  <div className="p-1 rounded-md bg-amber-500/10 text-amber-600 shrink-0">
                                    <Calendar size={14} />
                                  </div>
                                  <select
                                    value={selectedAgendaMonth}
                                    onChange={(e) => setSelectedAgendaMonth(e.target.value)}
                                    className="select select-xs !py-1 !px-2 font-bold text-xs bg-slate-50 dark:bg-dark-800 border border-slate-300 dark:border-dark-700 rounded-lg text-slate-800 dark:text-dark-200 focus:ring-2 focus:ring-amber-500/30 cursor-pointer"
                                    title="Sélectionner le mois dans l'agenda"
                                  >
                                    {MOIS.map((optM) => (
                                      <option key={optM} value={optM}>
                                        {optM} {annee}
                                      </option>
                                    ))}
                                    <option value="all">Tous les 12 mois</option>
                                  </select>
                                </div>
                              </td>

                              {/* COLONNE ATELIERS ANIMÉS : HEURES AFFICHÉES DIRECTEMENT DEPUIS ATELIERS */}
                              <td className="p-2 text-center">
                                {nbAnimes > 0 ? (
                                  <div className="inline-flex flex-col items-center">
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                      {hAnimees} h ({nbAnimes} atelier{nbAnimes > 1 ? 's' : ''})
                                    </span>
                                    {mStats.ateliers_animes && mStats.ateliers_animes.length > 0 && (
                                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium truncate max-w-[150px] block mt-0.5" title={mStats.ateliers_animes.map(a => a.titre).join(', ')}>
                                        {mStats.ateliers_animes[0].titre}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-xs">0 h</span>
                                )}
                              </td>

                              {/* COLONNE INITIATIVES & PROJETS */}
                              <td className="p-2">
                                <textarea
                                  rows={1}
                                  placeholder="Initiatives prises ce mois..."
                                  className="input !py-2 !px-3 !text-xs w-full resize-none rounded-xl bg-slate-50 dark:bg-dark-900 border-slate-300 dark:border-dark-700/80 text-slate-800 dark:text-dark-200"
                                  value={item.initiatives || ''}
                                  onChange={(e) => updateField(m, 'initiatives', e.target.value)}
                                />
                              </td>

                              {/* COLONNE OBSERVATION & REMARQUES */}
                              <td className="p-2">
                                <textarea
                                  rows={1}
                                  placeholder="Remarques de l'accompagnateur..."
                                  className="input !py-2 !px-3 !text-xs w-full resize-none rounded-xl bg-slate-50 dark:bg-dark-900 border-slate-300 dark:border-dark-700/80 text-slate-800 dark:text-dark-200"
                                  value={item.observations || ''}
                                  onChange={(e) => updateField(m, 'observations', e.target.value)}
                                />
                              </td>

                              {/* COLONNE ACTION [💾] */}
                              <td className="p-2 text-center">
                                <button
                                  onClick={() => saveMonth(m, idx)}
                                  disabled={isSaving}
                                  className="p-2 rounded-xl bg-slate-100 hover:bg-emerald-500 hover:text-white dark:bg-dark-700/70 dark:hover:bg-emerald-600 text-slate-600 dark:text-dark-300 transition-all shadow-sm"
                                  title={`Enregistrer ${m}`}
                                >
                                  <Save size={14} className={isSaving ? 'animate-spin' : ''} />
                                </button>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}