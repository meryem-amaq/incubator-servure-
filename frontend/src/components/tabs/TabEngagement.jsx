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
  ChevronRight,
  FileSpreadsheet,
  ArrowRight,
  QrCode,
  Mail,
  RefreshCw
} from 'lucide-react';
import api from '../../api/axios';
import ExcelImportModal from '../common/ExcelImportModal';
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
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [syncingTourniquet, setSyncingTourniquet] = useState(false);

  // Synchroniser automatiquement les pointages réels des tourniquets physiques ZKTeco
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

      if (monthlyHours) {
        setMonths(prev => {
          const next = { ...prev };
          Object.entries(monthlyHours).forEach(([m, h]) => {
            if (next[m]) {
              next[m] = {
                ...next[m],
                moyenne_heures_presence: h
              };
            }
          });
          return next;
        });

        if (!isSilent) {
          const badgeTxt = incInfo?.badge_id ? ` (Badge #${incInfo.badge_id})` : '';
          toast.success(`Pointages synchronisés depuis les tourniquets${badgeTxt} ! Total: ${metrics?.totalHeures || 0}h`, { duration: 4000 });
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

  const handleImportEngagement = (importedRows) => {
    setMonths(prev => {
      const next = { ...prev };
      for (const r of importedRows) {
        const mName = String(r.mois || '').trim();
        const foundMonth = MOIS.find(m => m.toLowerCase() === mName.toLowerCase());
        if (foundMonth) {
          next[foundMonth] = {
            ...next[foundMonth],
            moyenne_heures_presence: r.moyenne_heures_presence !== undefined && r.moyenne_heures_presence !== '' ? r.moyenne_heures_presence : next[foundMonth].moyenne_heures_presence,
            taux_presence_formation: r.taux_presence_formation !== undefined && r.taux_presence_formation !== '' ? r.taux_presence_formation : next[foundMonth].taux_presence_formation,
            initiatives: r.initiatives !== undefined && r.initiatives !== '' ? r.initiatives : next[foundMonth].initiatives,
            observations: r.observations !== undefined && r.observations !== '' ? r.observations : next[foundMonth].observations,
          };
        }
      }
      return next;
    });
    toast.success('Données de présence remplies depuis Excel ! Cliquez sur "Enregistrer tout".');
  };

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
            titre: `[Formation Obligatoire] ${f.theme}`,
            formateur: f.formateur || 'Formateur IDS',
            date: f.date_formation,
            duree: `${f.heures || 3}h`,
            present: f.presence === true || f.presence === 'true' || f.presence === 1,
            isDirectPresence: true
          }));
        }
      } catch (e) {
        console.warn("Erreur chargement formations incubé:", e.message);
      }
    }

    // B. Modules de formation obligatoire planifiés (Pré-Création & Post-Création)
    try {
      const ateliersRes = await api.get('/ateliers');
      if (Array.isArray(ateliersRes.data) && ateliersRes.data.length > 0) {
        const modulesObligatoires = ateliersRes.data.filter(a => {
          const t = (a.titre || '').toLowerCase();
          const d = (a.description || '').toLowerCase();
          return t.includes('création') || t.includes('creation') || t.includes('bmc') || 
                 t.includes('business') || t.includes('juridique') || t.includes('comptable') || 
                 t.includes('marketing') || d.includes('modulecode') || d.includes('typeparcours');
        });

        modulesObligatoires.forEach(mo => {
          if (!list.some(l => l.titre === mo.titre && l.date === mo.date)) {
            list.push({
              id: mo.id,
              titre: mo.titre,
              formateur: mo.formateur || mo.intervenant || 'Formateur IDS',
              date: mo.date,
              duree: mo.duree || '3h',
              isDirectPresence: false
            });
          }
        });
      }
    } catch (e) {
      console.warn("Erreur chargement ateliers obligatoires:", e.message);
    }

    // C. Référence officielle des modules obligatoires si aucune session en base
    if (list.length === 0) {
      list = [
        { id: 101, titre: '[Pré-Création] BMC – Business Model Canvas', formateur: 'M. Benjelloun', date: `${annee}-01-15`, duree: '3h00' },
        { id: 102, titre: '[Pré-Création] BP – Business Plan & Faisabilité', formateur: 'Mme. Tazi', date: `${annee}-02-10`, duree: '4h00' },
        { id: 103, titre: '[Pré-Création] SJ – Statut Juridique & Formalités', formateur: 'Me. Alaoui', date: `${annee}-03-05`, duree: '3h00' },
        { id: 104, titre: '[Post-Création] GFC – Gestion Comptable et Financière', formateur: 'M. Amrani', date: `${annee}-04-12`, duree: '3h30' },
        { id: 105, titre: '[Post-Création] MDC – Marketing et Développement Commercial', formateur: 'Coach IDS', date: `${annee}-05-20`, duree: '3h30' }
      ];
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
      const valHours = (d.moyenne_heures_presence !== '' && d.moyenne_heures_presence !== null && !isNaN(d.moyenne_heures_presence))
        ? parseFloat(d.moyenne_heures_presence)
        : null;
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

      totalInitiatives: countInitiatives
    };
  }, [months, workshops, allPresences, incubeId, incube, annee]);

  return (
    <div className="space-y-6 slide-up w-full">
      
      {/* 1. Cartes de statistiques (KPI) EN HAUT DE PAGE */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
        
        {/* CARTE 1 : Présence & Assiduité aux Horaires (Semaine, Mois, Année) */}
        <div className="card p-4 border border-slate-200 dark:border-dark-700/60 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                <Clock size={22} />
              </div>
              <div>
                <p className="text-[11px] text-slate-500 dark:text-dark-400 font-bold uppercase tracking-wider">
                  Présence Heures (Obj: 15h/sem)
                </p>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-2xl font-black text-slate-900 dark:text-dark-100">{stats.moyenneHebdo}</span>
                  {stats.moyenneHebdo !== '—' && <span className="text-xs font-bold text-slate-400">h / sem</span>}
                </div>
              </div>
            </div>
            {stats.tauxHebdo !== '—' && (
              <span className={`px-2.5 py-1 rounded-lg text-xs font-black border ${
                stats.tauxHebdo >= 100 
                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400'
                  : 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400'
              }`}>
                {stats.tauxHebdo}%
              </span>
            )}
          </div>

          {/* Décomposition détaillée : Semaine • Mois • Année */}
          {stats.moyenneMensuelle !== '—' ? (
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-dark-700/60 text-center">
              <div className="bg-slate-50 dark:bg-dark-900/50 p-1.5 rounded-lg">
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Semaine</p>
                <p className="text-xs font-black text-slate-800 dark:text-dark-200">{stats.moyenneHebdo}h / 15h</p>
                <p className="text-[9px] font-bold text-blue-600 dark:text-blue-400">{stats.tauxHebdo}%</p>
              </div>
              <div className="bg-slate-50 dark:bg-dark-900/50 p-1.5 rounded-lg">
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Mois</p>
                <p className="text-xs font-black text-slate-800 dark:text-dark-200">{stats.moyenneMensuelle}h / 60h</p>
                <p className="text-[9px] font-bold text-blue-600 dark:text-blue-400">{stats.tauxMois}%</p>
              </div>
              <div className="bg-slate-50 dark:bg-dark-900/50 p-1.5 rounded-lg">
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Année</p>
                <p className="text-xs font-black text-slate-800 dark:text-dark-200">{stats.totalHeures}h / 720h</p>
                <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">{stats.tauxAnnuelCumule}% ({stats.countHeuresMois} m.)</p>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 italic">Aucune heure saisie pour {annee}</p>
          )}
        </div>

        {/* CARTE 2 : Formations Obligatoires (Modules officiels IDS) */}
        <div className="card p-4 border border-slate-200 dark:border-dark-700/60 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                <GraduationCap size={22} />
              </div>
              <div>
                <p className="text-[11px] text-slate-500 dark:text-dark-400 font-bold uppercase tracking-wider">
                  Assiduité Formations Obligatoires
                </p>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {stats.tauxFormationsReel}%
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">
                    ({stats.assistesSurRequis} sur {stats.baseRequisCount} requis)
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-black border ${
                stats.tauxFormationsReel >= 80
                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400'
                  : 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400'
              }`}>
                {stats.tauxFormationsReel}%
              </span>
              <button
                onClick={handleSyncAllFormationsFromEvents}
                className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold flex items-center gap-1 transition-all"
                title="Calculer et synchroniser automatiquement depuis les feuilles de présence des formations obligatoires"
              >
                <Sparkles size={12} /> Sync Formations
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-dark-700/60 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-dark-400 text-[11px]">Formations obligatoires {annee} :</span>
            <span className="font-bold text-slate-800 dark:text-dark-200 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-md text-[11px]">
              {stats.totalAssistesAnnee} sur {stats.totalAteliersAnnee} séances ({stats.tauxFormationsReel}%)
            </span>
          </div>
        </div>

        {/* CARTE 3 : Mois de Présence & Initiatives */}
        <div className="card p-4 border border-slate-200 dark:border-dark-700/60 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                <Sparkles size={22} />
              </div>
              <div>
                <p className="text-[11px] text-slate-500 dark:text-dark-400 font-bold uppercase tracking-wider">
                  Mois de Présence
                </p>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-2xl font-black text-slate-900 dark:text-dark-100">{stats.countMoisRemplis}</span>
                  <span className="text-xs font-semibold text-slate-400"> / 12 mois</span>
                </div>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-lg text-xs font-black border bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400">
              {Math.round((stats.countMoisRemplis / 12) * 100)}%
            </span>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-dark-700/60 flex flex-col gap-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-dark-400 text-[11px]">Mois actifs :</span>
              <span 
                className="font-bold text-slate-800 dark:text-dark-200 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-md text-[11px] truncate max-w-[190px]"
                title={stats.moisPresents.length > 0 ? stats.moisPresents.join(', ') : 'Aucun mois avec heures enregistrées'}
              >
                {stats.moisPresents.length > 0 ? stats.moisPresents.join(', ') : 'Aucune présence enregistrée'}
              </span>
            </div>
            {stats.totalInitiatives > 0 && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Initiatives déclarées :</span>
                <span className="font-semibold text-slate-600 dark:text-dark-300">{stats.totalInitiatives} mois actif(s)</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Barre de contrôle épurée sans cadre EN DESSOUS DES CARTES DE STATISTIQUES */}
      <div className="flex flex-wrap items-center justify-between gap-3 relative z-30 py-1">
        <div className="flex flex-wrap items-center gap-3">
          {incubeSelector}

          <div className="flex items-center gap-2 bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl px-3 py-2 text-xs shadow-sm">
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

        <div className="flex items-center gap-2.5">
          {/* BOUTON ACTUALISER TOURNIQUETS PHYSIQUES */}
          <button
            type="button"
            className="btn btn-secondary btn-sm flex items-center gap-1.5 border-blue-500/40 text-blue-700 dark:text-blue-400 hover:bg-blue-500/10 font-bold shadow-sm"
            onClick={() => handleSyncTourniquet(false)}
            disabled={syncingTourniquet}
            title="Actualiser les pointages réels depuis les 7 tourniquets physiques ZKTeco"
          >
            <RefreshCw size={15} className={`text-blue-500 ${syncingTourniquet ? 'animate-spin' : ''}`} />
            {syncingTourniquet ? 'Actualisation...' : 'Actualiser Tourniquets'}
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm flex items-center gap-1.5 border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 font-bold shadow-sm"
            onClick={handleSendAlerteAssiduite}
            disabled={sendingAlerte}
            title="Envoyer un email officiel de relance d'assiduité à l'incubé"
          >
            <Mail size={15} className="text-amber-500" />
            {sendingAlerte ? 'Envoi...' : 'Relancer par email (Assiduité)'}
          </button>

          <button 
            className="btn btn-primary btn-sm shadow-md shadow-primary-500/20 flex items-center gap-1.5"
            onClick={saveAllMonths}
            disabled={savingAll}
            title="Enregistrer les remarques et observations"
          >
            <Save size={15} />
            {savingAll ? 'Enregistrement...' : 'Enregistrer remarques'}
          </button>
        </div>
      </div>

      {/* 3. TABLEAU PRINCIPAL : Engagement, Implication et Initiatives (12 Mois) */}
      <div className="card p-0 overflow-hidden border border-slate-200 dark:border-dark-700/60 shadow-md">
        <div className="table-container">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-dark-300 border-b border-slate-200 dark:border-dark-700/60">
                <th className="py-3 px-4 font-bold text-slate-800 dark:text-dark-200 w-28 min-w-[110px] sticky left-0 bg-slate-100 dark:bg-dark-800 z-10 border-r border-slate-200 dark:border-dark-700/60 whitespace-nowrap">
                  Mois
                </th>
                <th className="py-3 px-4 font-bold text-slate-800 dark:text-dark-200 text-center min-w-[210px] whitespace-nowrap">
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Heures Présence Tourniquets</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      Auto ZKTeco
                    </span>
                  </div>
                  <div className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">Obj : 15 h/sem (60 h/mois)</div>
                </th>
                <th className="py-3 px-4 font-bold text-slate-800 dark:text-dark-200 text-center min-w-[210px] whitespace-nowrap">
                  <div>Taux Formations Obligatoires (%)</div>
                  <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Obj: ≥ 80% (Modules obligatoires)</div>
                </th>
                <th className="py-3 px-4 font-bold text-slate-800 dark:text-dark-200 min-w-[220px]">
                  Initiatives et propositions
                </th>
                <th className="py-3 px-4 font-bold text-slate-800 dark:text-dark-200 min-w-[220px]">
                  Observation et commentaire
                </th>
                <th className="py-3 px-3 font-bold text-slate-800 dark:text-dark-200 text-center w-20 whitespace-nowrap">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-dark-700/50">
              {MOIS.map((m, idx) => {
                const item = months[m];
                const isSaving = savingRowIdx === idx;
                const rowBg = idx % 2 === 0 ? 'bg-white dark:bg-dark-900/60' : 'bg-slate-50/60 dark:bg-dark-800/40';

                // Calculs exacts heures
                const valPresence = item.moyenne_heures_presence !== '' && !isNaN(item.moyenne_heures_presence) ? parseFloat(item.moyenne_heures_presence) : null;
                const hebdoHeures = valPresence !== null ? (valPresence / 4).toFixed(1) : null;
                // Taux calculé sur base de 15h/semaine
                const hebdoTaux = valPresence !== null ? Math.round(((valPresence / 4) / OBJECTIF_HEBDO) * 100) : null;
                const moisTaux = valPresence !== null ? Math.round((valPresence / OBJECTIF_MOIS) * 100) : null;

                // Calculs événements réels pour ce mois
                const eventStats = getMonthFormationStats(idx);
                const displayRate = (item.taux_presence_formation !== '' && item.taux_presence_formation !== null && item.taux_presence_formation !== undefined)
                  ? item.taux_presence_formation
                  : (eventStats.rate !== null ? eventStats.rate : '');

                return (
                  <tr key={m} className={`${rowBg} hover:bg-slate-100/60 dark:hover:bg-dark-700/30 transition-colors`}>
                    {/* Colonne Date */}
                    <td className={`py-3 px-4 font-bold text-slate-800 dark:text-dark-200 sticky left-0 z-10 border-r border-slate-200 dark:border-dark-700/60 shadow-sm transition-colors ${
                      idx % 2 === 0 ? 'bg-white dark:bg-dark-900' : 'bg-slate-50 dark:bg-dark-800'
                    }`}>
                      {m}
                    </td>

                    {/* Heures présence mensuelle issues des tourniquets (Lecture seule certifiée) */}
                    <td className="p-2 text-center">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1 bg-slate-100/90 dark:bg-dark-800/90 border border-slate-200/80 dark:border-dark-700/80 rounded-md shadow-xs">
                          <span className="text-xs font-extrabold text-slate-800 dark:text-dark-100 font-mono">
                            {valPresence !== null && valPresence !== undefined ? Number(valPresence).toFixed(1) : '0.0'}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-dark-400 font-semibold">h/mois</span>
                        </div>

                        {/* Badges de calculs exacts semaine et mois + Statut Conforme/Attention/Non Conforme */}
                        {valPresence !== null && valPresence > 0 ? (
                          <div className="flex flex-col gap-1 items-center w-full">
                            <div className={`inline-flex items-center justify-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md border w-full max-w-[200px] ${
                              valPresence >= OBJECTIF_MOIS 
                                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                            }`} title={`Moyenne : ${hebdoHeures}h / 15h par semaine (${hebdoTaux}%) | Mois : ${valPresence}h / 60h (${moisTaux}%)`}>
                              <span>Sem : {hebdoHeures}h / 15h</span>
                              <span>•</span>
                              <span>{hebdoTaux}%</span>
                            </div>
                            <div className="flex items-center justify-between w-full max-w-[200px] text-[9px] px-0.5">
                              <span className="text-slate-400">
                                Mois : {valPresence}h / 60h ({moisTaux}%)
                              </span>
                              <span className={`px-1.5 py-0.2 rounded font-black text-[8px] uppercase tracking-wider border ${
                                moisTaux >= 100 
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                                  : moisTaux >= 75
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-700'
                              }`}>
                                {moisTaux >= 100 ? 'CONFORME' : moisTaux >= 75 ? 'ATTENTION' : 'NON CONFORME'}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 dark:text-dark-500 font-medium">— h/sem (Obj: 15h)</span>
                        )}
                      </div>
                    </td>

                    {/* Taux formation synchronisé avec événements */}
                    <td className="p-2 text-center">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <div className="flex items-center justify-center gap-1.5">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            max="100"
                            placeholder={eventStats.rate !== null ? `${eventStats.rate}` : "Ex: 100"}
                            className="input !py-1.5 !px-2 !text-xs !w-20 text-center font-bold bg-slate-50 dark:bg-dark-900 border-slate-300 dark:border-dark-700/80 text-emerald-600 dark:text-emerald-400"
                            value={displayRate}
                            onChange={(e) => updateField(m, 'taux_presence_formation', e.target.value)}
                          />
                          <span className="text-[11px] text-slate-500 dark:text-dark-400 font-semibold">%</span>
                        </div>

                        {/* Indicateur clair et automatique de la présence aux ateliers */}
                        {eventStats.total > 0 ? (
                          <div className="flex flex-col items-center justify-center gap-0.5 text-[10px]">
                            {eventStats.attended > 0 ? (
                              <span 
                                className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-md font-extrabold inline-flex items-center gap-1 shadow-xs"
                                title={`Atelier(s) assisté(s) : ${eventStats.workshops.filter(w => isIncubePresentAtWorkshop(w.id)).map(w => w.titre).join(', ')}`}
                              >
                                <CheckCircle2 size={11} className="text-emerald-600 dark:text-emerald-400" />
                                {eventStats.attended}/{eventStats.total} présent ({eventStats.rate}%)
                              </span>
                            ) : (
                              <span 
                                className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-md font-semibold inline-flex items-center gap-1"
                                title={`Atelier(s) prévu(s) : ${eventStats.workshops.map(w => w.titre).join(', ')}`}
                              >
                                0/{eventStats.total} présent (0%)
                              </span>
                            )}
                            
                            {/* Titre de l'atelier du mois */}
                            {eventStats.workshops.length > 0 && (
                              <span className="text-[9px] text-slate-400 dark:text-dark-400 truncate max-w-[170px]" title={eventStats.workshops.map(w => w.titre).join(' • ')}>
                                {eventStats.workshops[0].titre}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Aucun atelier ce mois</span>
                        )}
                      </div>
                    </td>

                    {/* Initiatives et propositions */}
                    <td className="p-2">
                      <textarea
                        rows={1}
                        placeholder="Initiatives prises ce mois..."
                        className="input !py-2 !px-3 !text-xs w-full resize-none rounded-xl bg-slate-50 dark:bg-dark-900 border-slate-300 dark:border-dark-700/80 text-slate-800 dark:text-dark-200 placeholder-slate-400 dark:placeholder-dark-500 focus:border-amber-500/80"
                        value={item.initiatives || ''}
                        onChange={(e) => updateField(m, 'initiatives', e.target.value)}
                      />
                    </td>

                    {/* Observation et commentaire */}
                    <td className="p-2">
                      <textarea
                        rows={1}
                        placeholder="Remarques de l'accompagnateur..."
                        className="input !py-2 !px-3 !text-xs w-full resize-none rounded-xl bg-slate-50 dark:bg-dark-900 border-slate-300 dark:border-dark-700/80 text-slate-800 dark:text-dark-200 placeholder-slate-400 dark:placeholder-dark-500 focus:border-amber-500/80"
                        value={item.observations || ''}
                        onChange={(e) => updateField(m, 'observations', e.target.value)}
                      />
                    </td>

                    {/* Action sauvegarder ligne */}
                    <td className="p-2 text-center">
                      <button
                        onClick={() => saveMonth(m, idx)}
                        disabled={isSaving}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-emerald-500 hover:text-white dark:bg-dark-700/70 dark:hover:bg-emerald-600 text-slate-600 dark:text-dark-300 transition-all shadow-sm"
                        title={`Enregistrer les données de ${m}`}
                      >
                        <Save size={14} className={isSaving ? 'animate-spin' : ''} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modale d'importation Excel pour l'engagement */}
      <ExcelImportModal
        isOpen={showExcelModal}
        onClose={() => setShowExcelModal(false)}
        title="Importer les feuilles d'engagement / présence (Excel)"
        description="Chargez un fichier Excel pour remplir les présences, taux et observations des 12 mois."
        templateType="engagement"
        onImport={handleImportEngagement}
      />

    </div>
  );
}
