import { useState, useEffect, useMemo } from 'react';
import { 
  GraduationCap, 
  QrCode, 
  Copy, 
  ExternalLink, 
  Printer, 
  X, 
  CheckCircle2, 
  Building, 
  Lightbulb, 
  Clock, 
  Users, 
  Sparkles, 
  BookOpen, 
  Plus, 
  Search, 
  Calendar, 
  Mail, 
  Trash2, 
  MapPin, 
  Send, 
  Check, 
  CalendarCheck,
  UserCheck,
  User,
  UserX,
  FileText,
  ShieldCheck,
  ChevronRight,
  RefreshCw,
  XCircle,
  Pencil,
  Layers,
  ChevronDown,
  ChevronUp,
  Bell
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import FeuilleEmargementPrint from '../components/common/FeuilleEmargementPrint';

// Modules initiaux officiels
const INITIAL_MODULES = {
  'pre-creation': [
    {
      code: 'BMC',
      name: 'Business Model Canvas',
      duree: '3h00',
      points: [
        'Structuration de la proposition de valeur',
        'Segmentation client et personas',
        'Modèle de revenus et flux financiers',
        'Partenaires clés, activités et canaux de distribution'
      ],
      color: 'from-blue-600 to-indigo-600',
      badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
    },
    {
      code: 'BP',
      name: 'Business Plan & Faisabilité',
      duree: '4h00',
      points: [
        'Étude de faisabilité économique et technique',
        'Prévisions d’activité sur 3 ans',
        'Plan de trésorerie de démarrage',
        'Stratégie de lancement et indicateurs de pilotage'
      ],
      color: 'from-cyan-600 to-blue-700',
      badgeColor: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20'
    },
    {
      code: 'SJ',
      name: 'Statut Juridique & Formalités',
      duree: '3h00',
      points: [
        'Choix de la forme juridique (Auto-entrepreneur, SARL, SARL AU)',
        'Cadre légal, fiscal et responsabilités des associés',
        'Démarches d’immatriculation et formalités OMPIC',
        'Rédaction des statuts et protection de la marque'
      ],
      color: 'from-teal-600 to-emerald-700',
      badgeColor: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20'
    }
  ],
  'post-creation': [
    {
      code: 'GFC',
      name: 'Gestion Comptable et Financière',
      duree: '3h30',
      points: [
        'Maîtrise des bases comptables et comptes de résultat',
        'Gestion de trésorerie prévisionnelle',
        'Lecture et analyse des états financiers',
        'Obligations fiscales et déclaratives'
      ],
      color: 'from-emerald-600 to-teal-700',
      badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
    },
    {
      code: 'MDC',
      name: 'Marketing et Développement Commercial',
      duree: '3h30',
      points: [
        'Stratégie marketing et positionnement de l’offre',
        'Prospection multicanale et acquisition',
        'Fidélisation client et relation commerciale',
        'Techniques de vente et négociation'
      ],
      color: 'from-amber-600 to-orange-600',
      badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
    },
    {
      code: 'RH',
      name: 'Ressources Humaines',
      duree: '3h00',
      points: [
        'Gestion des équipes et recrutement',
        'Cadres contractuels et droit du travail',
        'Motivation et climat social',
        'Organisation agile et répartition du travail'
      ],
      color: 'from-purple-600 to-violet-700',
      badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
    },
    {
      code: 'SS',
      name: 'Soft Skills & Posture',
      duree: '3h00',
      points: [
        'Communication interpersonnelle et pitch',
        'Leadership et management d’équipe',
        'Gestion du stress et de l’incertitude',
        'Prise de décision et posture entrepreneuriale'
      ],
      color: 'from-rose-600 to-pink-700',
      badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
    }
  ]
};

// Collaborateurs internes de l'incubateur
const DEFAULT_COLLABORATEURS = [
  'Ayoub Elbouchikhi',
  'Ilham Lahboub',
  'Nadia Sefiani',
  'Test AMA',
  'Administrateur IDS'
];

export default function Formations() {
  const { user } = useAuth();

  // Grand sélecteur : 'pre-creation' | 'post-creation'
  const [selectedParcours, setSelectedParcours] = useState('pre-creation');
  const [activeTab, setActiveTab] = useState('pre-creation'); // 'pre-creation' | 'post-creation' | 'modules'
  const [moduleFilterParcours, setModuleFilterParcours] = useState('all'); // 'all' | 'pre-creation' | 'post-creation'

  // 1. Référentiel des modules persistant dans localStorage
  const [modulesMap, setModulesMap] = useState(() => {
    try {
      const saved = localStorage.getItem('ids_formation_parcours_modules');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          'pre-creation': parsed['pre-creation']?.modules || INITIAL_MODULES['pre-creation'],
          'post-creation': parsed['post-creation']?.modules || INITIAL_MODULES['post-creation']
        };
      }
    } catch (e) {
      console.warn('Erreur lecture modules sauvegardés:', e);
    }
    return INITIAL_MODULES;
  });

  useEffect(() => {
    try {
      localStorage.setItem('ids_formation_parcours_modules', JSON.stringify({
        'pre-creation': { modules: modulesMap['pre-creation'] },
        'post-creation': { modules: modulesMap['post-creation'] }
      }));
    } catch (e) {
      console.warn('Erreur sauvegarde modules:', e);
    }
  }, [modulesMap]);

  // 2. Liste des formations chargées depuis l'API
  const [rawAteliers, setRawAteliers] = useState([]);
  const [loadingFormations, setLoadingFormations] = useState(true);

  // 3. Liste de tous les incubés pour les invitations
  const [allIncubes, setAllIncubes] = useState([]);

  // Référentiel des Modules Pédagogiques (Affichage & Déploiement)
  const [modulesSectionExpanded, setModulesSectionExpanded] = useState(true);

  // Modals
  const [showAddFormationModal, setShowAddFormationModal] = useState(false);
  const [showAddModuleModal, setShowAddModuleModal] = useState(false);
  const [qrModalItem, setQrModalItem] = useState(null); // formation ou module
  const [participantsModalItem, setParticipantsModalItem] = useState(null); // formation sélectionnée pour voir les incubés
  const [participantFilter, setParticipantFilter] = useState('');
  const [presenceStatusFilter, setPresenceStatusFilter] = useState('all'); // 'all' | 'presents' | 'absents'
  const [sessionPresences, setSessionPresences] = useState([]);
  const [loadingPresences, setLoadingPresences] = useState(false);
  const [printModalFormation, setPrintModalFormation] = useState(null);
  const [editingFormationItem, setEditingFormationItem] = useState(null);
  const [editFormationForm, setEditFormationForm] = useState({
    id: null,
    moduleCode: '',
    formateur: '',
    collaborateur: '',
    date: '',
    heureDebut: '09:30',
    heureFin: '12:30',
    duree: '3h00',
    salle: '',
    promoFilter: 'all',
    selectedIncubes: [],
    notifyByEmail: false
  });
  const [submittingEditFormation, setSubmittingEditFormation] = useState(false);
  const [sendingConvocations, setSendingConvocations] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [sendingSingleEmailId, setSendingSingleEmailId] = useState(null);

  // Charger les présences réelles d'une session de formation
  const loadSessionPresences = async (formationId) => {
    if (!formationId) return;
    try {
      setLoadingPresences(true);
      const res = await api.get(`/presence/atelier/${formationId}`);
      const serverList = Array.isArray(res.data) ? res.data : [];

      let localList = [];
      try {
        const presencesStr = localStorage.getItem('ids_ateliers_presences');
        if (presencesStr) {
          const presences = JSON.parse(presencesStr);
          const atelierPresences = presences[formationId];
          if (atelierPresences) {
            localList = Object.entries(atelierPresences).map(([incubeId, data]) => ({
              incubeId,
              ...data
            }));
          }
        }
      } catch (e) {}

      const map = {};
      localList.forEach(p => { map[String(p.incubeId)] = p; });
      serverList.forEach(p => { map[String(p.incubeId)] = p; });
      setSessionPresences(Object.values(map));
    } catch (err) {
      console.warn('Erreur chargement présences:', err);
    } finally {
      setLoadingPresences(false);
    }
  };

  useEffect(() => {
    const targetId = participantsModalItem?.formation?.id || printModalFormation?.id;
    if (targetId) {
      loadSessionPresences(targetId);
    } else {
      setSessionPresences([]);
      setPresenceStatusFilter('all');
      setParticipantFilter('');
    }
  }, [participantsModalItem, printModalFormation]);

  // Basculer la présence d'un incubé (Présent <-> Absent) par le staff
  const handleToggleIncubePresence = async (inc) => {
    if (!participantsModalItem?.formation?.id) return;
    const fId = participantsModalItem.formation.id;
    const isCurrentlyPresent = sessionPresences.some(p => 
      String(p.incubeId) === String(inc.id) ||
      (p.nom && inc.nom_incube && p.nom.toLowerCase().trim() === inc.nom_incube.toLowerCase().trim())
    );

    try {
      if (isCurrentlyPresent) {
        await api.post('/presence/enregistrer', {
          atelierId: fId,
          incubeId: inc.id,
          present: false,
          action: 'remove'
        });
        toast.success(`${inc.nom_incube} marqué absent`);
      } else {
        await api.post('/presence/enregistrer', {
          atelierId: fId,
          incubeId: inc.id,
          nom: inc.nom_incube,
          pp_numero: inc.pp_numero || (inc.id ? `PP-${String(inc.id).padStart(3, '0')}` : 'PP-001'),
          time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          present: true
        });
        toast.success(`${inc.nom_incube} marqué présent`);
      }
      loadSessionPresences(fId);
    } catch (err) {
      toast.error('Erreur lors de la mise à jour de la présence');
    }
  };

  // Envoyer la convocation officielle par email à tous les incubés inscrits
  const handleSendFormationConvocations = async (formation, targetIncubesList) => {
    if (!formation || !targetIncubesList || targetIncubesList.length === 0) {
      toast.error("Aucun incubé inscrit pour l'envoi");
      return;
    }
    const withEmail = targetIncubesList.filter(i => i.email && i.email.trim());
    if (withEmail.length === 0) {
      toast.error("Aucun des incubés inscrits n'a d'adresse email valide");
      return;
    }

    setSendingConvocations(true);
    try {
      const res = await api.post(`/evenements/${formation.id}/notifier`, {
        evenement: {
          id: formation.id,
          titre: formation.titre,
          formateur: formation.formateur,
          intervenant: formation.intervenant,
          date: formation.date,
          dateFin: formation.dateFin,
          heureDebut: formation.heureDebut,
          heureFin: formation.heureFin,
          duree: formation.duree,
          description: formation.description
        },
        incubeIds: withEmail.map(i => i.id)
      });
      if (res.data?.success) {
        toast.success(res.data.message || `📧 Convocations transmises avec succès à ${res.data.sentCount || withEmail.length} incubé(s) !`, { duration: 4500 });
      } else {
        toast.success("Convocations transmises par email !");
      }
    } catch (err) {
      console.error('Erreur envoi convocations formation:', err);
      toast.error(err.response?.data?.message || err.message || "Erreur lors de l'envoi des convocations");
    } finally {
      setSendingConvocations(false);
    }
  };

  // Envoyer un rappel par email à tous les participants
  const handleSendFormationReminder = async (formation, targetIncubesList) => {
    if (!formation || !targetIncubesList || targetIncubesList.length === 0) {
      toast.error("Aucun incubé sélectionné");
      return;
    }
    const withEmail = targetIncubesList.filter(i => i.email && i.email.trim());
    if (withEmail.length === 0) {
      toast.error("Aucun incubé avec adresse email valide");
      return;
    }

    setSendingReminder(true);
    try {
      const res = await api.post(`/evenements/${formation.id}/rappel`, {
        evenement: {
          id: formation.id,
          titre: formation.titre,
          formateur: formation.formateur,
          intervenant: formation.intervenant,
          date: formation.date,
          dateFin: formation.dateFin,
          heureDebut: formation.heureDebut,
          heureFin: formation.heureFin,
          duree: formation.duree,
          description: formation.description
        },
        incubeIds: withEmail.map(i => i.id)
      });
      toast.success(res.data?.message || `🔔 Rappels envoyés par email à ${res.data?.sentCount || withEmail.length} incubé(s) !`, { icon: '🔔' });
    } catch (err) {
      console.error('Erreur envoi rappel formation:', err);
      toast.error(err.response?.data?.message || err.message || "Erreur lors de l'envoi des rappels");
    } finally {
      setSendingReminder(false);
    }
  };

  // Renvoyer la convocation individuellement à un incubé spécifique
  const handleSendSingleConvocation = async (formation, inc) => {
    if (!inc?.email) {
      toast.error(`Aucun email enregistré pour ${inc?.nom_incube || 'cet incubé'}`);
      return;
    }
    setSendingSingleEmailId(inc.id);
    try {
      const res = await api.post(`/evenements/${formation.id}/notifier`, {
        evenement: {
          id: formation.id,
          titre: formation.titre,
          formateur: formation.formateur,
          intervenant: formation.intervenant,
          date: formation.date,
          dateFin: formation.dateFin,
          heureDebut: formation.heureDebut,
          heureFin: formation.heureFin,
          duree: formation.duree,
          description: formation.description
        },
        incubeIds: [inc.id]
      });
      toast.success(`📧 Convocation envoyée à ${inc.nom_incube} (${inc.email}) !`);
    } catch (err) {
      console.error('Erreur envoi individuel:', err);
      toast.error(err.response?.data?.message || "Erreur lors de l'envoi de la convocation");
    } finally {
      setSendingSingleEmailId(null);
    }
  };



  // Liste complète des présences et absences pour l'impression officielle A4
  const fullPresencesForPrint = useMemo(() => {
    const formation = printModalFormation || participantsModalItem?.formation;
    if (!formation) return [];
    let invitesIds = [];
    if (participantsModalItem?.meta?.invitesIds) {
      invitesIds = participantsModalItem.meta.invitesIds;
    } else if (formation.description) {
      try {
        const meta = typeof formation.description === 'object' ? formation.description : JSON.parse(formation.description || '{}');
        invitesIds = meta.invitesIds || [];
      } catch (e) {}
    }

    const rawList = invitesIds.length > 0
      ? allIncubes.filter(i => invitesIds.map(Number).includes(Number(i.id)))
      : allIncubes;

    // Dédoublonnage strict par ID unique pour garantir qu'aucun incubé n'apparaît deux fois
    const uniqueMap = new Map();
    rawList.forEach(inc => {
      if (inc && inc.id && !uniqueMap.has(Number(inc.id))) {
        uniqueMap.set(Number(inc.id), inc);
      }
    });
    const targetList = Array.from(uniqueMap.values());

    return targetList.map(inc => {
      const p = sessionPresences.find(sp => 
        String(sp.incubeId) === String(inc.id) ||
        (sp.nom && inc.nom_incube && sp.nom.toLowerCase().trim() === inc.nom_incube.toLowerCase().trim())
      );
      const rawPp = inc.pp_numero || p?.pp_numero;
      const cleanPp = (rawPp && String(rawPp).trim() && String(rawPp).trim().toUpperCase() !== 'PP')
        ? (String(rawPp).trim().toUpperCase().startsWith('PP') ? String(rawPp).trim() : `PP-${String(rawPp).trim()}`)
        : (inc.id ? `PP-${String(inc.id).padStart(3, '0')}` : 'PP-001');

      return {
        incubeId: inc.id,
        nom: inc.nom_incube,
        prenom: '—',
        pp_numero: cleanPp,
        present: Boolean(p),
        time: p?.time || (p ? '09:30' : '—')
      };
    });
  }, [printModalFormation, participantsModalItem, allIncubes, sessionPresences]);

  // Recherche dans la liste des formations
  const [searchQuery, setSearchQuery] = useState('');

  // Charger les données (ateliers et incubés)
  const loadData = async () => {
    try {
      setLoadingFormations(true);
      const [ateliersRes, incubesRes] = await Promise.all([
        api.get('/ateliers'),
        api.get('/incubes')
      ]);
      setRawAteliers(Array.isArray(ateliersRes.data) ? ateliersRes.data : []);
      const incList = Array.isArray(incubesRes.data) ? incubesRes.data : (incubesRes.data?.incubes || []);
      setAllIncubes(incList);
    } catch (err) {
      console.error('Erreur chargement formations/incubés:', err);
    } finally {
      setLoadingFormations(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Promotions disponibles
  const promotionsList = useMemo(() => {
    const set = new Set();
    allIncubes.forEach(i => {
      if (i.promotion && i.promotion.trim()) set.add(i.promotion.trim());
    });
    return Array.from(set).sort();
  }, [allIncubes]);

  // Filtrer les formations STRICTEMENT selon le parcours sélectionné (Pré-Création vs Post-Création)
  // en excluant rigoureusement les ateliers collectifs et masterclasses de la page Événements
  const currentParcoursFormations = useMemo(() => {
    return rawAteliers.filter(f => {
      let meta = {};
      try {
        meta = JSON.parse(f.description || '{}');
      } catch (e) {
        meta = {};
      }

      const titreLower = (f.titre || '').toLowerCase().trim();

      if (selectedParcours === 'pre-creation') {
        return (
          meta.typeParcours === 'pre-creation' ||
          titreLower.startsWith('[pré-création]') ||
          titreLower.startsWith('[pre-creation]')
        );
      } else {
        return (
          meta.typeParcours === 'post-creation' ||
          titreLower.startsWith('[post-création]') ||
          titreLower.startsWith('[post-creation]')
        );
      }
    }).filter(f => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      let meta = {};
      try { meta = JSON.parse(f.description || '{}'); } catch (e) {}
      return (
        (f.titre || '').toLowerCase().includes(q) ||
        (f.formateur || '').toLowerCase().includes(q) ||
        (f.intervenant || '').toLowerCase().includes(q) ||
        (meta.collaborateur || '').toLowerCase().includes(q)
      );
    });
  }, [rawAteliers, selectedParcours, searchQuery]);

  // Modules actuels du parcours
  const currentModules = modulesMap[selectedParcours] || [];

  // Modules affichés dans le référentiel pédagogique (suit directement le parcours sélectionné)
  const displayedModulesList = useMemo(() => {
    return (modulesMap[selectedParcours] || []).map(m => ({
      ...m,
      parcoursType: selectedParcours
    }));
  }, [modulesMap, selectedParcours]);

  const preCreationCount = useMemo(() => {
    return rawAteliers.filter(f => {
      let meta = {};
      try { meta = JSON.parse(f.description || '{}'); } catch (e) {}
      const titreLower = (f.titre || '').toLowerCase().trim();
      return (
        meta.typeParcours === 'pre-creation' ||
        titreLower.startsWith('[pré-création]') ||
        titreLower.startsWith('[pre-creation]')
      );
    }).length;
  }, [rawAteliers]);

  const postCreationCount = useMemo(() => {
    return rawAteliers.filter(f => {
      let meta = {};
      try { meta = JSON.parse(f.description || '{}'); } catch (e) {}
      const titreLower = (f.titre || '').toLowerCase().trim();
      return (
        meta.typeParcours === 'post-creation' ||
        titreLower.startsWith('[post-création]') ||
        titreLower.startsWith('[post-creation]')
      );
    }).length;
  }, [rawAteliers]);

  const allModulesList = useMemo(() => {
    const pre = (modulesMap['pre-creation'] || []).map(m => ({ ...m, parcoursType: 'pre-creation' }));
    const post = (modulesMap['post-creation'] || []).map(m => ({ ...m, parcoursType: 'post-creation' }));
    let list = [...pre, ...post];
    if (moduleFilterParcours !== 'all') {
      list = list.filter(m => m.parcoursType === moduleFilterParcours);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(m => 
        (m.code || '').toLowerCase().includes(q) ||
        (m.name || '').toLowerCase().includes(q) ||
        (m.points || []).some(pt => pt.toLowerCase().includes(q))
      );
    }
    return list;
  }, [modulesMap, moduleFilterParcours, searchQuery]);

  // Déterminer le code et nom du module de manière robuste
  const inferModuleInfo = (formation, meta) => {
    if (meta?.moduleCode) {
      const allMods = [...(modulesMap['pre-creation'] || []), ...(modulesMap['post-creation'] || [])];
      const foundInMap = allMods.find(m => m.code === meta.moduleCode);
      return {
        code: meta.moduleCode,
        name: meta.moduleName || foundInMap?.name || meta.moduleCode
      };
    }
    const text = `${formation.titre || ''} ${formation.description || ''}`.toLowerCase();
    if (text.includes('business model canvas') || text.includes('bmc')) {
      return { code: 'BMC', name: 'Business Model Canvas' };
    }
    if (text.includes('business plan') || text.includes('bp')) {
      return { code: 'BP', name: 'Business Plan & Faisabilité' };
    }
    if (text.includes('statut juridique') || text.includes('formalités') || text.includes('sj')) {
      return { code: 'SJ', name: 'Statut Juridique & Formalités' };
    }
    if (text.includes('gestion comptable') || text.includes('gestion financiere') || text.includes('gestion financière') || text.includes('gfc')) {
      return { code: 'GFC', name: 'Gestion Comptable et Financière' };
    }
    if (text.includes('commerciale') || text.includes('marketing') || text.includes('prospection') || text.includes('mdc')) {
      return { code: 'MDC', name: 'Marketing et Développement Commercial' };
    }
    if (text.includes('ressources humaines') || text.includes('rh')) {
      return { code: 'RH', name: 'Ressources Humaines' };
    }
    if (text.includes('soft skills') || text.includes('posture') || text.includes('ss')) {
      return { code: 'SS', name: 'Soft Skills & Posture' };
    }
    return {
      code: selectedParcours === 'pre-creation' ? 'PRÉ' : 'POST',
      name: formation.titre || 'Formation Spécifique'
    };
  };

  // URL du QR Code
  const getQrUrl = (target = null) => {
    const cloudBase = import.meta.env.VITE_CLOUD_URL || window.location.origin;
    const typeLabel = selectedParcours === 'pre-creation' ? 'Pré-Création' : 'Post-Création';

    if (!target) {
      return `${cloudBase}/formation?type=${encodeURIComponent(typeLabel)}`;
    }

    // Si c'est une session de formation
    if (target.id && target.date) {
      return `${cloudBase}/presence/${target.id}?nom_atelier=${encodeURIComponent(target.titre)}&date=${encodeURIComponent(target.date)}&heureDebut=${encodeURIComponent(target.heureDebut || '09:30')}&heureFin=${encodeURIComponent(target.heureFin || '12:30')}&duree=${encodeURIComponent(target.duree || '3h00')}`;
    }

    // Si c'est un module
    if (target.code) {
      return `${cloudBase}/formation/${target.code.toLowerCase()}?type=${encodeURIComponent(typeLabel)}&module=${encodeURIComponent(target.code)}&title=${encodeURIComponent(target.name)}`;
    }

    return `${cloudBase}/formation`;
  };

  // =========================================================================
  // ÉTAT ET ACTIONS : AJOUTER UNE FORMATION
  // =========================================================================
  const [formationForm, setFormationForm] = useState({
    moduleCode: '',
    formateur: 'M. Khalid (Formateur Expert)',
    collaborateur: DEFAULT_COLLABORATEURS[0],
    customFormateur: '',
    date: new Date().toISOString().split('T')[0],
    dateFin: '',
    heureDebut: '09:30',
    heureFin: '12:30',
    duree: '3h00',
    salle: 'Salle de formation IDS',
    promoFilter: 'all',
    selectedIncubes: [],
    notifyByEmail: false
  });
  const [submittingFormation, setSubmittingFormation] = useState(false);

  // Ouvrir le modal d'ajout d'une formation
  const handleOpenAddFormation = (defaultModCode = null) => {
    const mods = modulesMap[selectedParcours] || [];
    const chosenMod = defaultModCode ? mods.find(m => m.code === defaultModCode) : mods[0];

    // Filtrer les incubés pertinents pour ce parcours
    let targetIncubes = allIncubes;
    if (selectedParcours === 'pre-creation') {
      const ideationIncubes = allIncubes.filter(i => (i.phase_projet || '').toLowerCase().includes('idéation') || (i.phase_projet || '').toLowerCase().includes('ideation'));
      if (ideationIncubes.length > 0) targetIncubes = ideationIncubes;
    } else if (selectedParcours === 'post-creation') {
      const postIncubes = allIncubes.filter(i => {
        const ph = (i.phase_projet || '').toLowerCase();
        const st = (i.statut_juridique || '').toLowerCase();
        return ph.includes('lancement') || ph.includes('croissance') || (st && st !== 'en cours' && st !== 'non défini' && st !== 'aucun');
      });
      if (postIncubes.length > 0) targetIncubes = postIncubes;
    }

    setFormationForm({
      moduleCode: chosenMod ? chosenMod.code : (mods[0]?.code || ''),
      formateur: 'Intervenant IDS',
      collaborateur: DEFAULT_COLLABORATEURS[0],
      customFormateur: '',
      date: new Date().toISOString().split('T')[0],
      dateFin: '',
      heureDebut: '09:30',
      heureFin: '12:30',
      duree: chosenMod ? chosenMod.duree : '3h00',
      salle: 'Salle de formation IDS',
      promoFilter: 'all',
      selectedIncubes: targetIncubes.map(i => i.id),
      notifyByEmail: false
    });
    setShowAddFormationModal(true);
  };

  const handleModuleSelectionChange = (code) => {
    const mod = currentModules.find(m => m.code === code);
    setFormationForm(prev => ({
      ...prev,
      moduleCode: code,
      duree: mod ? mod.duree : prev.duree
    }));
  };

  const handlePromoFilterChange = (promoVal) => {
    if (promoVal === 'all') {
      setFormationForm(prev => ({
        ...prev,
        promoFilter: promoVal,
        selectedIncubes: allIncubes.map(i => i.id)
      }));
    } else {
      const filtered = allIncubes.filter(i => (i.promotion || '').trim() === promoVal.trim());
      setFormationForm(prev => ({
        ...prev,
        promoFilter: promoVal,
        selectedIncubes: filtered.map(i => i.id)
      }));
    }
  };

  const toggleIncubeSelection = (incubeId) => {
    setFormationForm(prev => {
      const exists = prev.selectedIncubes.includes(incubeId);
      return {
        ...prev,
        selectedIncubes: exists 
          ? prev.selectedIncubes.filter(id => id !== incubeId)
          : [...prev.selectedIncubes, incubeId]
      };
    });
  };

  // Enregistrer la session de formation (Option A : Enregistrement sécurisé sans envoi précipité)
  const handleSaveFormation = async (e) => {
    e.preventDefault();
    const mod = currentModules.find(m => m.code === formationForm.moduleCode);
    const modName = mod ? mod.name : formationForm.moduleCode;
    const parcoursLabel = selectedParcours === 'pre-creation' ? 'Pré-Création' : 'Post-Création';

    const resolvedFormateur = formationForm.formateur === '__autre__'
      ? (formationForm.customFormateur.trim() || 'Intervenant Externe')
      : formationForm.formateur;

    setSubmittingFormation(true);
    try {
      const metaToSave = {
        typeParcours: selectedParcours,
        moduleCode: formationForm.moduleCode,
        moduleName: modName,
        collaborateur: formationForm.collaborateur,
        salle: formationForm.salle,
        invitesIds: formationForm.selectedIncubes,
        dateDebut: formationForm.date,
        dateFin: formationForm.dateFin || null
      };

      const payload = {
        titre: `[${parcoursLabel}] ${formationForm.moduleCode} – ${modName}`,
        formateur: resolvedFormateur,
        intervenant: formationForm.collaborateur, // Le Collaborateur IDS
        date: formationForm.date,
        dateFin: formationForm.dateFin || null,
        heureDebut: formationForm.heureDebut,
        heureFin: formationForm.heureFin,
        duree: formationForm.duree || '3h00',
        description: JSON.stringify(metaToSave),
        statutOuverture: 'auto'
      };

      const res = await api.post('/ateliers', payload);
      const created = res.data;

      setShowAddFormationModal(false);
      await loadData();
      toast.success('Session de formation enregistrée avec succès !');
    } catch (err) {
      console.error('Erreur création formation:', err);
      toast.error(err.response?.data?.message || 'Erreur lors de la création de la formation');
    } finally {
      setSubmittingFormation(false);
    }
  };

  // Supprimer une formation
  const handleDeleteFormation = async (formationId) => {
    if (!window.confirm('Supprimer cette session de formation ?')) return;
    try {
      await api.delete(`/ateliers/${formationId}`);
      toast.success('Formation supprimée');
      setRawAteliers(prev => prev.filter(f => f.id !== formationId));
    } catch (err) {
      toast.error('Erreur lors de la suppression');
    }
  };

  // Ouvrir le modal d'édition d'une formation
  const handleOpenEditFormation = (formation, meta) => {
    const rawModuleCode = meta.moduleCode || '';
    const initialFormateur = formation.formateur || 'Intervenant IDS';
    const initialCollab = meta.collaborateur || formation.intervenant || DEFAULT_COLLABORATEURS[0];
    const initialDateFin = meta.dateFin || formation.dateFin || '';

    let invites = [];
    if (Array.isArray(meta.invitesIds) && meta.invitesIds.length > 0) {
      invites = meta.invitesIds;
    } else {
      invites = allIncubes.map(i => i.id);
    }

    setEditFormationForm({
      id: formation.id,
      moduleCode: rawModuleCode,
      formateur: initialFormateur,
      collaborateur: initialCollab,
      date: formation.date ? formation.date.substring(0, 10) : '',
      dateFin: initialDateFin ? initialDateFin.substring(0, 10) : '',
      heureDebut: formation.heureDebut || '09:30',
      heureFin: formation.heureFin || '12:30',
      duree: formation.duree || '3h00',
      salle: meta.salle || 'Salle de formation IDS',
      promoFilter: 'all',
      selectedIncubes: invites,
      notifyByEmail: false
    });
    setEditingFormationItem({ formation, meta });
  };

  const handleEditModuleSelectionChange = (code) => {
    const mod = currentModules.find(m => m.code === code);
    setEditFormationForm(prev => ({
      ...prev,
      moduleCode: code,
      duree: mod ? mod.duree : prev.duree
    }));
  };

  const handleEditPromoFilterChange = (promoVal) => {
    if (promoVal === 'all') {
      setEditFormationForm(prev => ({
        ...prev,
        promoFilter: promoVal,
        selectedIncubes: allIncubes.map(i => i.id)
      }));
    } else {
      const filtered = allIncubes.filter(i => (i.promotion || '').trim() === promoVal.trim());
      setEditFormationForm(prev => ({
        ...prev,
        promoFilter: promoVal,
        selectedIncubes: filtered.map(i => i.id)
      }));
    }
  };

  const toggleEditIncubeSelection = (incubeId) => {
    setEditFormationForm(prev => {
      const exists = prev.selectedIncubes.includes(incubeId);
      return {
        ...prev,
        selectedIncubes: exists 
          ? prev.selectedIncubes.filter(id => id !== incubeId)
          : [...prev.selectedIncubes, incubeId]
      };
    });
  };

  const handleSaveEditFormation = async (e) => {
    e.preventDefault();
    if (!editFormationForm.id) return;

    setSubmittingEditFormation(true);
    try {
      const mod = currentModules.find(m => m.code === editFormationForm.moduleCode);
      const modName = mod ? mod.name : (editingFormationItem?.meta?.moduleName || editFormationForm.moduleCode);
      const parcoursLabel = selectedParcours === 'pre-creation' ? 'Pré-Création' : 'Post-Création';

      const payload = {
        titre: `[${parcoursLabel}] ${editFormationForm.moduleCode} – ${modName}`,
        formateur: editFormationForm.formateur,
        intervenant: editFormationForm.collaborateur,
        date: editFormationForm.date,
        dateFin: editFormationForm.dateFin || null,
        heureDebut: editFormationForm.heureDebut,
        heureFin: editFormationForm.heureFin,
        duree: editFormationForm.duree || '3h00',
        description: JSON.stringify({
          typeParcours: selectedParcours,
          moduleCode: editFormationForm.moduleCode,
          moduleName: modName,
          collaborateur: editFormationForm.collaborateur,
          salle: editFormationForm.salle,
          invitesIds: editFormationForm.selectedIncubes,
          dateDebut: editFormationForm.date,
          dateFin: editFormationForm.dateFin || null
        })
      };

      await api.put(`/ateliers/${editFormationForm.id}`, payload);
      toast.success('Session de formation modifiée avec succès !');

      if (editFormationForm.notifyByEmail && editFormationForm.selectedIncubes.length > 0) {
        try {
          await api.post(`/evenements/${editFormationForm.id}/notifier`, {
            evenement: { id: editFormationForm.id, ...payload },
            incubeIds: editFormationForm.selectedIncubes
          });
          toast.success(`Mise à jour envoyée par email à ${editFormationForm.selectedIncubes.length} incubé(s) !`);
        } catch (mailErr) {
          console.warn('Erreur envoi notification email:', mailErr);
        }
      }

      setEditingFormationItem(null);
      loadData();
    } catch (err) {
      console.error('Erreur modification formation:', err);
      toast.error(err.response?.data?.message || 'Erreur lors de la modification de la formation');
    } finally {
      setSubmittingEditFormation(false);
    }
  };

  // =========================================================================
  // ÉTAT ET ACTIONS : AJOUTER UN MODULE PÉDAGOGIQUE
  // =========================================================================
  const [moduleForm, setModuleForm] = useState({
    parcours: 'pre-creation',
    code: '',
    name: '',
    duree: '3h00',
    points: ''
  });

  const handleOpenAddModule = (targetParcours = null) => {
    setModuleForm({
      parcours: targetParcours || selectedParcours,
      code: '',
      name: '',
      duree: '3h00',
      points: 'Compétence pratique 1\nCompétence pratique 2\nAtelier d\'application'
    });
    setShowAddModuleModal(true);
  };

  const handleSaveModule = (e) => {
    e.preventDefault();
    const cleanCode = moduleForm.code.trim().toUpperCase();
    const cleanName = moduleForm.name.trim();
    const targetParcours = moduleForm.parcours || selectedParcours;

    if (!cleanCode || cleanCode.length < 2) {
      toast.error('Le code du module doit comporter au moins 2 caractères (ex: IA, COMM).');
      return;
    }
    if (!cleanName) {
      toast.error('Veuillez renseigner le nom complet du module.');
      return;
    }

    const currentList = modulesMap[targetParcours] || [];
    if (currentList.some(m => m.code === cleanCode)) {
      toast.error(`Le module avec le code ${cleanCode} existe déjà dans ce parcours.`);
      return;
    }

    const pointsList = moduleForm.points.split('\n').map(p => p.trim()).filter(p => p.length > 0);
    const newMod = {
      code: cleanCode,
      name: cleanName,
      duree: moduleForm.duree || '3h00',
      points: pointsList.length > 0 ? pointsList : ['Acquisition des compétences pratiques'],
      color: targetParcours === 'pre-creation' ? 'from-blue-600 to-indigo-600' : 'from-amber-600 to-orange-600',
      badgeColor: targetParcours === 'pre-creation' 
        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' 
        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      isCustom: true
    };

    setModulesMap(prev => ({
      ...prev,
      [targetParcours]: [...(prev[targetParcours] || []), newMod]
    }));

    toast.success(`Nouveau module ${cleanCode} ajouté avec succès au parcours ${targetParcours === 'pre-creation' ? 'Pré-Création' : 'Post-Création'} !`);
    setShowAddModuleModal(false);
  };

  const handleDeleteModule = (code, parcours = selectedParcours) => {
    if (!window.confirm(`Supprimer le module [${code}] de ce parcours ?`)) return;
    setModulesMap(prev => ({
      ...prev,
      [parcours]: (prev[parcours] || []).filter(m => m.code !== code)
    }));
    toast.success(`Module ${code} retiré.`);
  };

  return (
    <div className="slide-up space-y-6 w-full pb-16">
      
      {/* =========================================================================
          1. HEADER PRINCIPAL ÉPURÉ (SANS GRAND CADRE ENCOMBRANT)
          ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <GraduationCap className="text-amber-500 shrink-0" size={28} />
            <span>Formations Pré/Post-Création</span>
          </h1>
          <p className="text-sm text-slate-600 dark:text-dark-300 mt-1 max-w-2xl">
            Organisation des parcours Pré-Création & Post-Création, formateurs, collaborateurs et suivi des émargements QR code
          </p>
        </div>

        {/* Bouton d'action principal */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => handleOpenAddFormation()}
            className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20 py-2.5 px-4 rounded-xl cursor-pointer transition whitespace-nowrap text-xs"
          >
            <Plus size={16} className="stroke-[3] shrink-0" />
            <span>Ajouter une Formation</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          2. BARRE D'ONGLETS COMPACTE (PRÉ-CRÉATION | POST-CRÉATION | CATALOGUE)
          ========================================================================= */}
      <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700/80 rounded-2xl p-2.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Onglets Pills */}
        <div className="inline-flex p-1 bg-slate-100 dark:bg-dark-800/80 rounded-xl gap-1">
          {/* 1. Pré-Création */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('pre-creation');
              setSelectedParcours('pre-creation');
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'pre-creation'
                ? 'bg-white dark:bg-dark-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
            <span>1. Pré-Création</span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
              activeTab === 'pre-creation'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                : 'bg-slate-200 dark:bg-dark-700 text-slate-700 dark:text-slate-300'
            }`}>
              {preCreationCount} session{preCreationCount > 1 ? 's' : ''}
            </span>
          </button>

          {/* 2. Post-Création */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('post-creation');
              setSelectedParcours('post-creation');
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'post-creation'
                ? 'bg-white dark:bg-dark-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
            <span>2. Post-Création</span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
              activeTab === 'post-creation'
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                : 'bg-slate-200 dark:bg-dark-700 text-slate-700 dark:text-slate-300'
            }`}>
              {postCreationCount} session{postCreationCount > 1 ? 's' : ''}
            </span>
          </button>
        </div>

        {/* Recherche rapide */}
        <div className="relative w-full md:w-72">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={activeTab === 'modules' ? "Filtrer les modules..." : "Rechercher formation, formateur..."}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input !py-2 !pl-9 !text-xs w-full bg-slate-50 dark:bg-dark-800 border-slate-200 dark:border-dark-700 rounded-xl focus:bg-white dark:focus:bg-dark-900"
          />
        </div>
      </div>

      {/* =========================================================================
          3. CONTENU : VUE TABLEAU ÉPURÉE POUR LES FORMATIONS (PRÉ ET POST CRÉATION)
          ========================================================================= */}
      {activeTab !== 'modules' && (
        <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700/80 rounded-2xl shadow-xs overflow-hidden animate-fade-in">
          {loadingFormations ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500" />
            </div>
          ) : currentParcoursFormations.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 mx-auto flex items-center justify-center">
                <GraduationCap size={28} />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Aucune formation de {activeTab === 'pre-creation' ? 'Pré-Création' : 'Post-Création'} enregistrée
              </h3>
              <p className="text-xs text-slate-500 dark:text-dark-400 max-w-sm mx-auto">
                Programmez une session pour les porteurs de projets en {activeTab === 'pre-creation' ? 'Pré-Création' : 'Post-Création'}.
              </p>
              <button
                type="button"
                onClick={() => handleOpenAddFormation()}
                className="btn btn-primary btn-sm inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black py-2 px-4 rounded-xl cursor-pointer"
              >
                <Plus size={15} /> Programmer une formation
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-dark-800 text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[11px] font-bold bg-slate-50/50 dark:bg-dark-800/40">
                    <th className="py-3.5 px-4">Date & Horaires</th>
                    <th className="py-3.5 px-4">Formation</th>
                    <th className="py-3.5 px-4">Intervenants</th>
                    <th className="py-3.5 px-4 text-center">Présence</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-dark-800">
                  {currentParcoursFormations.map(formation => {
                    let meta = {};
                    try { meta = JSON.parse(formation.description || '{}'); } catch (e) { meta = {}; }

                    const moduleInfo = inferModuleInfo(formation, meta);
                    const collaborateur = meta.collaborateur || formation.intervenant || 'Ayoub Elbouchikhi (Coach IDS)';
                    const formateur = formation.formateur || meta.formateur || 'M. Khalid (Expert Formateur)';
                    const isPreCreation = activeTab === 'pre-creation';

                    return (
                      <tr key={formation.id} className="hover:bg-slate-50/80 dark:hover:bg-dark-800/60 transition group">
                        {/* Date & Heure */}
                        <td className="py-4 px-4 align-top whitespace-nowrap">
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <Calendar size={13} className="text-emerald-600 shrink-0" />
                            <span>
                              {formation.date ? (
                                (meta.dateFin || formation.dateFin) && (meta.dateFin || formation.dateFin) !== formation.date ? (
                                  `Du ${new Date(formation.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} au ${new Date(meta.dateFin || formation.dateFin).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
                                ) : (
                                  new Date(formation.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                                )
                              ) : 'Date non définie'}
                            </span>
                          </div>
                          <div className="text-slate-500 dark:text-dark-300 text-[11px] flex items-center gap-1 mt-1 font-mono">
                            <Clock size={11} className="text-slate-400" />
                            <span>{formation.heureDebut || '09:30'} - {formation.heureFin || '12:30'}</span>
                            <span className="text-slate-400">({formation.duree || '3h00'})</span>
                          </div>
                          {meta.salle && (
                            <div className="text-[11px] text-slate-500 dark:text-dark-400 flex items-center gap-1 mt-1">
                              <MapPin size={11} className="text-slate-400" />
                              <span className="truncate max-w-[130px]">{meta.salle}</span>
                            </div>
                          )}
                        </td>

                        {/* Formation */}
                        <td className="py-4 px-4 align-top">
                          <div className="font-extrabold text-xs text-slate-900 dark:text-white leading-snug">
                            {formation.titre || moduleInfo.name}
                          </div>
                        </td>

                        {/* Intervenants */}
                        <td className="py-4 px-4 align-top">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                              <User size={13} className="text-amber-500 shrink-0" />
                              <span className="font-bold">{formateur}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-dark-300 text-[11px]">
                              <UserCheck size={13} className="text-blue-500 shrink-0" />
                              <span>{collaborateur}</span>
                            </div>
                          </div>
                        </td>

                        {/* Présence & Émargement */}
                        <td className="py-4 px-4 align-top text-center">
                          <button
                            type="button"
                            onClick={() => setParticipantsModalItem({ formation, meta })}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-emerald-500/30 hover:border-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-extrabold transition cursor-pointer shadow-xs text-xs"
                            title="Consulter et pointer la feuille de présence des incubés"
                          >
                            <UserCheck size={14} className="text-emerald-600 dark:text-emerald-400" />
                            <span>Présence</span>
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-4 align-top text-right">
                          <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
                            {/* Bouton QR Code */}
                            <button
                              type="button"
                              onClick={() => setQrModalItem(formation)}
                              className="p-2 rounded-xl border border-slate-200 dark:border-dark-700 hover:border-amber-400 bg-white dark:bg-dark-800 text-slate-700 dark:text-slate-300 hover:text-amber-600 shadow-2xs transition cursor-pointer"
                              title="Afficher le QR code officiel pour émarger"
                            >
                              <QrCode size={15} />
                            </button>

                            {/* Bouton Fiche A4 Présence */}
                            <button
                              type="button"
                              onClick={() => setPrintModalFormation(formation)}
                              className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-2xs transition cursor-pointer"
                              title="Imprimer la feuille d'émargement officielle A4"
                            >
                              <Printer size={15} />
                            </button>

                            {/* Bouton Modifier */}
                            <button
                              type="button"
                              onClick={() => handleOpenEditFormation(formation, meta)}
                              className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition cursor-pointer"
                              title="Modifier cette session"
                            >
                              <Pencil size={15} />
                            </button>

                            {/* Bouton Supprimer */}
                            <button
                              type="button"
                              onClick={() => handleDeleteFormation(formation.id)}
                              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                              title="Supprimer cette formation"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          4. CONTENU : CATALOGUE DES MODULES PÉDAGOGIQUES
          ========================================================================= */}
      {activeTab === 'modules' && (
        <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700/80 rounded-2xl shadow-xs p-6 space-y-5 animate-fade-in">
          {/* En-tête du catalogue avec filtre de parcours et bouton Nouveau Module */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-dark-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen className="text-amber-500" size={18} />
                <span>Référentiel des Modules Officiels (Pré/Post-Création)</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-dark-400 mt-0.5">
                Programmes, durées estimées et modules disponibles pour planification
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Filtre interne : Tous, Pré-Création, Post-Création */}
              <div className="inline-flex p-1 bg-slate-100 dark:bg-dark-800 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setModuleFilterParcours('all')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    moduleFilterParcours === 'all'
                      ? 'bg-white dark:bg-dark-900 text-slate-900 dark:text-white shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Tous ({(modulesMap['pre-creation']?.length || 0) + (modulesMap['post-creation']?.length || 0)})
                </button>
                <button
                  type="button"
                  onClick={() => setModuleFilterParcours('pre-creation')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    moduleFilterParcours === 'pre-creation'
                      ? 'bg-white dark:bg-dark-900 text-blue-700 dark:text-blue-300 shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Pré-Création ({modulesMap['pre-creation']?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setModuleFilterParcours('post-creation')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    moduleFilterParcours === 'post-creation'
                      ? 'bg-white dark:bg-dark-900 text-amber-700 dark:text-amber-300 shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Post-Création ({modulesMap['post-creation']?.length || 0})
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleOpenAddModule(selectedParcours)}
                className="btn btn-primary btn-sm flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black py-2 px-3.5 rounded-xl cursor-pointer shadow-xs text-xs"
              >
                <Plus size={14} className="stroke-[3]" />
                <span>Ajouter un Module</span>
              </button>
            </div>
          </div>

          {/* Grille épurée des modules */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {allModulesList.map((m, mIdx) => {
              const isPreCreation = m.parcoursType === 'pre-creation';
              const sessionCount = rawAteliers.filter(f => {
                const matchCode = (f.titre || '').includes(m.code) || (f.description || '').includes(m.code);
                return matchCode;
              }).length;

              return (
                <div
                  key={`${m.parcoursType}-${m.code}-${mIdx}`}
                  className="bg-slate-50/70 dark:bg-dark-800/50 rounded-2xl border border-slate-200/80 dark:border-dark-700/70 p-4 flex flex-col justify-between hover:shadow-md transition-all hover:border-amber-500/50 group"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-black tracking-wide border ${
                          isPreCreation
                            ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
                            : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                        }`}>
                          [{m.code}]
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-dark-300 bg-white dark:bg-dark-900 border border-slate-200/80 dark:border-dark-700 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                          <Clock size={10} /> {m.duree || '3h00'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {m.isCustom && (
                          <button
                            type="button"
                            onClick={() => handleDeleteModule(m.code, m.parcoursType)}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                            title="Supprimer ce module personnalisé"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-snug mb-2">
                      {m.name}
                    </h3>

                    {Array.isArray(m.points) && m.points.length > 0 && (
                      <ul className="space-y-1 mb-3 text-xs text-slate-600 dark:text-dark-300">
                        {m.points.map((pt, pIdx) => (
                          <li key={pIdx} className="flex items-start gap-1.5 text-[11px] leading-tight">
                            <span className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${
                              isPreCreation ? 'bg-blue-500' : 'bg-amber-500'
                            }`} />
                            <span className="line-clamp-2">{pt}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="pt-2.5 border-t border-slate-200/60 dark:border-dark-700/60 flex items-center justify-between gap-2 mt-auto">
                    <span className="text-[10px] font-bold text-slate-400">
                      {sessionCount} session{sessionCount > 1 ? 's' : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenAddFormation(m.code)}
                      className="btn btn-secondary btn-sm !py-1 !px-2.5 !text-[11px] font-bold flex items-center gap-1 text-slate-800 dark:text-slate-100 hover:text-amber-600 rounded-lg cursor-pointer border border-slate-200 dark:border-dark-700 bg-white dark:bg-dark-900 hover:bg-slate-50 dark:hover:bg-dark-800 shadow-2xs"
                      title={`Planifier une session pour le module ${m.code}`}
                    >
                      <Plus size={12} />
                      <span>Planifier</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


      {/* =========================================================================
          MODAL 1 : PROGRAMMER UNE FORMATION (AVEC LES 6 ÉLÉMENTS CLÉS)
          ========================================================================= */}
      {showAddFormationModal && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowAddFormationModal(false)}
        >
          <div 
            className="bg-white dark:bg-dark-900 text-slate-900 dark:text-white rounded-3xl border border-slate-200 dark:border-dark-700 shadow-2xl max-w-xl w-full overflow-hidden slide-up my-8 max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="p-5 border-b border-slate-100 dark:border-dark-800 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-950/15 flex items-center justify-center text-slate-950 font-black">
                  <GraduationCap size={20} />
                </div>
                <div>
                  <h3 className="font-black text-base">
                    Programmer une Formation ({selectedParcours === 'pre-creation' ? 'Pré-Création' : 'Post-Création'})
                  </h3>
                  <p className="text-xs text-slate-900/80">Type de module, formateur, collaborateur et invitation des incubés</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowAddFormationModal(false)}
                className="p-1.5 rounded-lg text-slate-900 hover:bg-black/10 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveFormation} className="p-5 overflow-y-auto space-y-4 flex-1">
              
              {/* 1. TYPE DE MODULE */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-dark-200 block mb-1 uppercase tracking-wider">
                  1. Type de Module ({selectedParcours === 'pre-creation' ? 'Pré-Création' : 'Post-Création'}) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formationForm.moduleCode}
                  onChange={e => handleModuleSelectionChange(e.target.value)}
                  className="input !py-2.5 !text-xs w-full bg-slate-50 dark:bg-dark-800 font-bold border-slate-300 dark:border-dark-700 rounded-xl cursor-pointer"
                >
                  {currentModules.map(m => (
                    <option key={m.code} value={m.code}>
                      [{m.code}] – {m.name} ({m.duree})
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. LE FORMATEUR & COLLABORATEUR */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Le Formateur */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-dark-200 block mb-1 uppercase tracking-wider">
                    2. Le Formateur <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formationForm.formateur}
                    onChange={e => setFormationForm(p => ({ ...p, formateur: e.target.value }))}
                    placeholder="Ex: M. Khalid / Expert FabLab"
                    className="input !py-2 !text-xs w-full font-bold bg-white dark:bg-dark-800"
                  />
                </div>

                {/* Collaborateur IDS (Champ libre pour écrire les noms) */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-dark-200 block mb-1 uppercase tracking-wider">
                    3. Collaborateur Référent <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formationForm.collaborateur}
                    onChange={e => setFormationForm(p => ({ ...p, collaborateur: e.target.value }))}
                    placeholder="Saisir le(s) nom(s) du collaborateur..."
                    list="collaborateurs-suggestions-add"
                    className="input !py-2 !text-xs w-full font-bold bg-white dark:bg-dark-800"
                  />
                  <datalist id="collaborateurs-suggestions-add">
                    {DEFAULT_COLLABORATEURS.map(c => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* 3. DATE ET HORAIRE (Intervalle de dates) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-dark-200 block mb-1 uppercase tracking-wider">
                    Date début <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formationForm.date}
                    onChange={e => setFormationForm(p => ({
                      ...p,
                      date: e.target.value,
                      dateFin: p.dateFin && p.dateFin < e.target.value ? e.target.value : p.dateFin
                    }))}
                    className="input !py-2 !text-xs w-full bg-white dark:bg-dark-800"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-dark-200 block mb-1 uppercase tracking-wider">
                    Date fin <span className="text-slate-400 font-normal text-[10px]">(si &gt; 1 j)</span>
                  </label>
                  <input
                    type="date"
                    min={formationForm.date}
                    value={formationForm.dateFin || ''}
                    onChange={e => setFormationForm(p => ({ ...p, dateFin: e.target.value }))}
                    placeholder="Optionnel"
                    className="input !py-2 !text-xs w-full bg-white dark:bg-dark-800"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-dark-200 block mb-1 uppercase tracking-wider">
                    Début
                  </label>
                  <input
                    type="time"
                    value={formationForm.heureDebut}
                    onChange={e => setFormationForm(p => ({ ...p, heureDebut: e.target.value }))}
                    className="input !py-2 !text-xs w-full bg-white dark:bg-dark-800"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-dark-200 block mb-1 uppercase tracking-wider">
                    Fin
                  </label>
                  <input
                    type="time"
                    value={formationForm.heureFin}
                    onChange={e => setFormationForm(p => ({ ...p, heureFin: e.target.value }))}
                    className="input !py-2 !text-xs w-full bg-white dark:bg-dark-800"
                  />
                </div>
              </div>

              {/* Salle / Lieu */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-dark-200 block mb-1 uppercase tracking-wider">
                  Lieu / Salle
                </label>
                <input
                  type="text"
                  value={formationForm.salle}
                  onChange={e => setFormationForm(p => ({ ...p, salle: e.target.value }))}
                  placeholder="Ex: Salle de formation IDS / FabLab"
                  className="input !py-2 !text-xs w-full bg-white dark:bg-dark-800"
                />
              </div>

              {/* 4. INVITATION DES INCUBÉS PARTICIPANTS */}
              <div className="p-3.5 bg-slate-50 dark:bg-dark-800/60 rounded-2xl border border-slate-200 dark:border-dark-700 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    <Users size={14} className="text-amber-500" />
                    <span>Incubés Participants</span>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400">
                    {formationForm.selectedIncubes.length} sélectionné(s)
                  </span>
                </div>

                {/* Filtre promotion */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handlePromoFilterChange('all')}
                      className={`text-[10px] px-2 py-0.5 rounded-md font-bold border transition-colors cursor-pointer ${
                        formationForm.promoFilter === 'all'
                          ? 'bg-amber-500 text-slate-950 border-amber-500'
                          : 'bg-white dark:bg-dark-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-dark-700'
                      }`}
                    >
                      Tous ({allIncubes.length})
                    </button>
                    {promotionsList.map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handlePromoFilterChange(p)}
                        className={`text-[10px] px-2 py-0.5 rounded-md font-bold border transition-colors cursor-pointer ${
                          formationForm.promoFilter === p
                            ? 'bg-amber-500 text-slate-950 border-amber-500'
                            : 'bg-white dark:bg-dark-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-dark-700'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setFormationForm(p => ({ ...p, selectedIncubes: allIncubes.map(i => i.id) }))}
                      className="text-primary-600 font-bold hover:underline"
                    >
                      Tout cocher
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setFormationForm(p => ({ ...p, selectedIncubes: [] }))}
                      className="text-slate-400 hover:underline"
                    >
                      Tout décocher
                    </button>
                  </div>
                </div>

                {/* Liste des incubés scrollable */}
                <div className="max-h-36 overflow-y-auto space-y-1 p-2 bg-white dark:bg-dark-900 rounded-xl border border-slate-200 dark:border-dark-700 text-xs">
                  {allIncubes.map(inc => {
                    const isChecked = formationForm.selectedIncubes.includes(inc.id);
                    return (
                      <label
                        key={inc.id}
                        className="flex items-center justify-between p-1 rounded hover:bg-slate-50 dark:hover:bg-dark-800 cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleIncubeSelection(inc.id)}
                            className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 cursor-pointer"
                          />
                          <span className="font-bold truncate text-slate-800 dark:text-slate-200">
                            {inc.nom_incube}
                          </span>
                          {inc.raison_sociale && (
                            <span className="text-[10px] text-slate-400 truncate">
                              ({inc.raison_sociale})
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          {inc.promotion || 'Sans promo'}
                        </span>
                      </label>
                    );
                  })}
                </div>

                <div className="mt-2.5 p-3 rounded-xl bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 text-[11px] text-slate-600 dark:text-dark-300 space-y-1">
                  <p className="font-bold text-slate-800 dark:text-dark-100 flex items-center gap-1.5 text-xs text-primary-600 dark:text-primary-400">
                    <Mail size={13} /> Modèle d'email officiel envoyé aux incubés :
                  </p>
                  <p className="italic text-slate-700 dark:text-dark-200 bg-white dark:bg-dark-900 p-2.5 rounded-lg border border-slate-100 dark:border-dark-800 leading-relaxed font-sans">
                    « Bonjour à toutes et à tous,<br />
                    Nous avons le plaisir de vous convier à la session de formation <strong>{selectedParcours === 'pre-creation' ? 'pré-création' : 'post-création'}</strong>, qui se déroulera <strong>{formationForm.dateFin && formationForm.dateFin !== formationForm.date ? `du ${formationForm.date} au ${formationForm.dateFin}` : `le ${formationForm.date}`}</strong> sous le thème <strong>{currentModules.find(m => m.code === formationForm.moduleCode)?.name || formationForm.moduleCode || 'Formation IDS'}</strong>.<br />
                    Cette session, animée par des experts partenaires, constitue une étape clé de votre parcours d’incubation. Votre participation est donc indispensable pour valider votre accompagnement au sein de l’IDS-Salé.<br />
                    Nous comptons sur votre motivation et votre implication.<br />
                    Bien cordialement,<br />
                    ----<br />
                    Equipe IDS – Salé »
                  </p>
                </div>
              </div>

              {/* Boutons modal */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddFormationModal(false)}
                  className="btn btn-secondary text-xs py-2 px-4 rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submittingFormation}
                  className="btn btn-primary text-xs py-2 px-5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black cursor-pointer shadow-md disabled:opacity-50"
                >
                  {submittingFormation ? 'Création en cours...' : 'Enregistrer la Formation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 1.5 : MODIFIER UNE FORMATION EXISTANTE
          ========================================================================= */}
      {editingFormationItem && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setEditingFormationItem(null)}
        >
          <div 
            className="bg-white dark:bg-dark-900 text-slate-900 dark:text-white rounded-3xl border border-slate-200 dark:border-dark-700 shadow-2xl max-w-xl w-full overflow-hidden slide-up my-8 max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="p-5 border-b border-slate-100 dark:border-dark-800 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white font-black">
                  <Pencil size={20} />
                </div>
                <div>
                  <h3 className="font-black text-base">
                    Modifier la Session de Formation
                  </h3>
                  <p className="text-xs text-blue-100">
                    Mettez à jour le module, l'horaire, les intervenants ou les participants
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setEditingFormationItem(null)}
                className="p-1.5 rounded-lg text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditFormation} className="p-5 overflow-y-auto space-y-4 flex-1">
              
              {/* 1. TYPE DE MODULE */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-dark-200 block mb-1 uppercase tracking-wider">
                  1. Type de Module ({selectedParcours === 'pre-creation' ? 'Pré-Création' : 'Post-Création'}) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={editFormationForm.moduleCode}
                  onChange={e => handleEditModuleSelectionChange(e.target.value)}
                  className="input !py-2.5 !text-xs w-full bg-slate-50 dark:bg-dark-800 font-bold border-slate-300 dark:border-dark-700 rounded-xl cursor-pointer"
                >
                  {currentModules.map(m => (
                    <option key={m.code} value={m.code}>
                      [{m.code}] – {m.name} ({m.duree})
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. LE FORMATEUR & COLLABORATEUR */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Le Formateur */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-dark-200 block mb-1 uppercase tracking-wider">
                    2. Le Formateur <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormationForm.formateur}
                    onChange={e => setEditFormationForm(p => ({ ...p, formateur: e.target.value }))}
                    placeholder="Ex: M. Khalid / Expert FabLab"
                    className="input !py-2 !text-xs w-full font-bold bg-white dark:bg-dark-800"
                  />
                </div>

                {/* Collaborateur IDS (Champ libre pour écrire les noms) */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-dark-200 block mb-1 uppercase tracking-wider">
                    3. Collaborateur Référent <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormationForm.collaborateur}
                    onChange={e => setEditFormationForm(p => ({ ...p, collaborateur: e.target.value }))}
                    placeholder="Saisir le(s) nom(s) du collaborateur..."
                    list="collaborateurs-suggestions-edit"
                    className="input !py-2 !text-xs w-full font-bold bg-white dark:bg-dark-800"
                  />
                  <datalist id="collaborateurs-suggestions-edit">
                    {DEFAULT_COLLABORATEURS.map(c => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* 3. DATE ET HORAIRE (Intervalle de dates) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-dark-200 block mb-1 uppercase tracking-wider">
                    Date début <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={editFormationForm.date}
                    onChange={e => setEditFormationForm(p => ({
                      ...p,
                      date: e.target.value,
                      dateFin: p.dateFin && p.dateFin < e.target.value ? e.target.value : p.dateFin
                    }))}
                    className="input !py-2 !text-xs w-full bg-white dark:bg-dark-800"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-dark-200 block mb-1 uppercase tracking-wider">
                    Date fin <span className="text-slate-400 font-normal text-[10px]">(si &gt; 1 j)</span>
                  </label>
                  <input
                    type="date"
                    min={editFormationForm.date}
                    value={editFormationForm.dateFin || ''}
                    onChange={e => setEditFormationForm(p => ({ ...p, dateFin: e.target.value }))}
                    placeholder="Optionnel"
                    className="input !py-2 !text-xs w-full bg-white dark:bg-dark-800"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-dark-200 block mb-1 uppercase tracking-wider">
                    Début
                  </label>
                  <input
                    type="time"
                    value={editFormationForm.heureDebut}
                    onChange={e => setEditFormationForm(p => ({ ...p, heureDebut: e.target.value }))}
                    className="input !py-2 !text-xs w-full bg-white dark:bg-dark-800"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-dark-200 block mb-1 uppercase tracking-wider">
                    Fin
                  </label>
                  <input
                    type="time"
                    value={editFormationForm.heureFin}
                    onChange={e => setEditFormationForm(p => ({ ...p, heureFin: e.target.value }))}
                    className="input !py-2 !text-xs w-full bg-white dark:bg-dark-800"
                  />
                </div>
              </div>

              {/* Salle / Lieu */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-dark-200 block mb-1 uppercase tracking-wider">
                  Lieu / Salle
                </label>
                <input
                  type="text"
                  value={editFormationForm.salle}
                  onChange={e => setEditFormationForm(p => ({ ...p, salle: e.target.value }))}
                  placeholder="Ex: Salle de formation IDS / FabLab"
                  className="input !py-2 !text-xs w-full bg-white dark:bg-dark-800"
                />
              </div>

              {/* 4. INVITATION DES INCUBÉS PARTICIPANTS */}
              <div className="p-3.5 bg-slate-50 dark:bg-dark-800/60 rounded-2xl border border-slate-200 dark:border-dark-700 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    <Users size={13} className="text-blue-500" />
                    <span>Participants Invités ({editFormationForm.selectedIncubes.length})</span>
                  </div>
                  <select
                    value={editFormationForm.promoFilter}
                    onChange={e => handleEditPromoFilterChange(e.target.value)}
                    className="text-[11px] font-bold bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-lg px-2 py-1 outline-none cursor-pointer"
                  >
                    <option value="all">Toutes promotions</option>
                    {promotionsList.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                {/* Liste scrollable des incubés avec cases à cocher */}
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {allIncubes.map(inc => {
                    const isSelected = editFormationForm.selectedIncubes.includes(inc.id);
                    return (
                      <div
                        key={inc.id}
                        onClick={() => toggleEditIncubeSelection(inc.id)}
                        className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer border transition-all ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-200'
                            : 'bg-white dark:bg-dark-900 border-slate-200 dark:border-dark-700 text-slate-600 dark:text-dark-300 hover:border-slate-300'
                        }`}
                      >
                        <span className="font-bold truncate">
                          {inc.nom_incube} {inc.prenom_incube || ''}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400">
                            {inc.promotion || 'Promo —'}
                          </span>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer pointer-events-none"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={editFormationForm.notifyByEmail}
                    onChange={e => setEditFormationForm(p => ({ ...p, notifyByEmail: e.target.checked }))}
                    className="rounded border-slate-300 text-blue-500 focus:ring-blue-500"
                  />
                  <Mail size={13} className="text-blue-500" />
                  <span>Envoyer une notification par email de la modification</span>
                </label>
              </div>

              {/* Boutons modal */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingFormationItem(null)}
                  className="btn btn-secondary text-xs py-2 px-4 rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submittingEditFormation}
                  className="btn btn-primary text-xs py-2 px-5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black cursor-pointer shadow-md disabled:opacity-50"
                >
                  {submittingEditFormation ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2 : AJOUTER UN MODULE (POUR LE PARCOURS ACTIF)
          ========================================================================= */}
      {showAddModuleModal && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowAddModuleModal(false)}
        >
          <div 
            className="bg-white dark:bg-dark-900 text-slate-900 dark:text-white rounded-3xl border border-slate-200 dark:border-dark-700 shadow-2xl max-w-md w-full overflow-hidden slide-up my-8"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-100 dark:border-dark-800 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen size={18} />
                <h3 className="font-black text-sm">
                  Ajouter un Module ({selectedParcours === 'pre-creation' ? 'Pré-Création' : 'Post-Création'})
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowAddModuleModal(false)} 
                className="p-1 rounded-lg text-slate-900 hover:bg-black/10"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveModule} className="p-5 space-y-3.5">
              {/* Choix du parcours cible */}
              <div>
                <label className="text-xs font-bold block mb-1 uppercase tracking-wider text-slate-700 dark:text-dark-200">
                  Parcours Cible <span className="text-rose-500">*</span>
                </label>
                <select
                  value={moduleForm.parcours}
                  onChange={e => setModuleForm(p => ({ ...p, parcours: e.target.value }))}
                  className="input !py-2 !text-xs font-bold w-full bg-slate-50 dark:bg-dark-800 border-slate-300 dark:border-dark-700 rounded-xl cursor-pointer"
                >
                  <option value="pre-creation">1. Parcours Pré-Création (Idéation & Cadrage)</option>
                  <option value="post-creation">2. Parcours Post-Création (Entreprises Lancées)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold block mb-1 uppercase">Code Module *</label>
                  <input
                    type="text"
                    required
                    maxLength={8}
                    value={moduleForm.code}
                    onChange={e => setModuleForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                    placeholder="Ex: IA, VENTE"
                    className="input !py-2 !text-xs font-black uppercase w-full bg-white dark:bg-dark-800"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1 uppercase">Durée estimée</label>
                  <input
                    type="text"
                    value={moduleForm.duree}
                    onChange={e => setModuleForm(p => ({ ...p, duree: e.target.value }))}
                    placeholder="Ex: 3h30"
                    className="input !py-2 !text-xs w-full bg-white dark:bg-dark-800"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold block mb-1 uppercase">Intitulé complet du Module *</label>
                <input
                  type="text"
                  required
                  value={moduleForm.name}
                  onChange={e => setModuleForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Intelligence Artificielle & Outils No-Code"
                  className="input !py-2 !text-xs font-bold w-full bg-white dark:bg-dark-800"
                />
              </div>

              <div>
                <label className="text-xs font-bold block mb-1 uppercase">Compétences / Programme (1 par ligne)</label>
                <textarea
                  rows={3}
                  value={moduleForm.points}
                  onChange={e => setModuleForm(p => ({ ...p, points: e.target.value }))}
                  className="input !py-2 !text-xs w-full bg-white dark:bg-dark-800"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModuleModal(false)}
                  className="btn btn-secondary text-xs py-2 px-4 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn btn-primary text-xs py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black"
                >
                  Ajouter le Module
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3 : LISTE DES INCUBÉS PARTICIPANTS & ÉMARGEMENT (PRÉSENCE / ABSENCE)
          ========================================================================= */}
      {participantsModalItem && (() => {
        const formation = participantsModalItem.formation;
        const meta = participantsModalItem.meta || {};
        const rawInvites = Array.isArray(meta.invitesIds) && meta.invitesIds.length > 0
          ? meta.invitesIds
          : allIncubes.map(i => i.id);
        const invitesIds = rawInvites.map(Number);
        const baseList = allIncubes.filter(i => invitesIds.includes(Number(i.id)));
        const nonInvitedIncubes = allIncubes.filter(i => !invitesIds.includes(Number(i.id)));

        const isIncubePresent = (inc) => sessionPresences.some(p => 
          String(p.incubeId) === String(inc.id) ||
          (p.nom && inc.nom_incube && p.nom.toLowerCase().trim() === inc.nom_incube.toLowerCase().trim())
        );

        const getIncubePresence = (inc) => sessionPresences.find(p => 
          String(p.incubeId) === String(inc.id) ||
          (p.nom && inc.nom_incube && p.nom.toLowerCase().trim() === inc.nom_incube.toLowerCase().trim())
        );

        const totalInscrits = baseList.length;
        const presentsCount = baseList.filter(isIncubePresent).length;
        const absentsCount = totalInscrits - presentsCount;
        const tauxPresence = totalInscrits > 0 ? Math.round((presentsCount / totalInscrits) * 100) : 0;

        // Déterminer si la session est terminée ou en cours / future
        const isSessionTerminee = (() => {
          if (!formation?.date) return false;
          try {
            if (formation.statutOuverture === 'cloture') return true;
            const dateVal = meta.dateFin || formation.dateFin || formation.date;
            const timeVal = formation.heureFin || meta.heureFin || '18:00';
            const cleanDate = String(dateVal).split('T')[0];
            const [h, m] = String(timeVal).split(':').map(Number);
            const sessionEnd = new Date(cleanDate);
            sessionEnd.setHours(isNaN(h) ? 23 : h, isNaN(m) ? 59 : m, 0, 0);
            return new Date() > sessionEnd;
          } catch (e) {
            return false;
          }
        })();

        let filteredList = baseList;
        if (presenceStatusFilter === 'presents') {
          filteredList = filteredList.filter(isIncubePresent);
        } else if (presenceStatusFilter === 'absents') {
          filteredList = filteredList.filter(inc => !isIncubePresent(inc));
        }

        if (participantFilter.trim()) {
          const q = participantFilter.toLowerCase();
          filteredList = filteredList.filter(i => 
            (i.nom_incube || '').toLowerCase().includes(q) ||
            (i.raison_sociale || '').toLowerCase().includes(q) ||
            (i.promotion || '').toLowerCase().includes(q) ||
            (i.email || '').toLowerCase().includes(q) ||
            (i.telephone || '').toLowerCase().includes(q)
          );
        }

        return (
          <div 
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
            onClick={() => { setParticipantsModalItem(null); setParticipantFilter(''); setPresenceStatusFilter('all'); }}
          >
            <div 
              className="bg-white dark:bg-dark-900 text-slate-900 dark:text-white rounded-3xl border border-slate-200 dark:border-dark-700 shadow-2xl max-w-3xl w-full overflow-hidden slide-up max-h-[90vh] flex flex-col my-auto"
              onClick={e => e.stopPropagation()}
            >
              {/* Header Modal */}
              <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-dark-800 bg-slate-50 dark:bg-dark-800/80 flex items-start sm:items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center font-black shrink-0">
                    <UserCheck size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                        Feuille de Présence & Émargement
                      </h3>
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-mono font-bold bg-amber-500/20 text-amber-700 dark:text-amber-400">
                        {selectedParcours === 'pre-creation' ? 'Pré-Création' : 'Post-Création'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-dark-400 truncate max-w-md mt-0.5 font-medium">
                      {formation.titre} {formation.formateur ? `• Formateur : ${formation.formateur}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap justify-end">
                  <button
                    type="button"
                    onClick={() => handleSendFormationConvocations(formation, baseList)}
                    disabled={sendingConvocations}
                    className="btn btn-sm bg-blue-600 hover:bg-blue-700 text-white font-extrabold flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs shadow-md shadow-blue-700/20 cursor-pointer disabled:opacity-50"
                    title={`Envoyer la convocation officielle par email à tous les incubés inscrits (${baseList.length})`}
                  >
                    <Mail size={14} />
                    <span>{sendingConvocations ? 'Envoi...' : `📧 Convoquer (${baseList.length})`}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSendFormationReminder(formation, baseList)}
                    disabled={sendingReminder}
                    className="btn btn-sm bg-sky-50 dark:bg-sky-950/30 hover:bg-sky-100 dark:hover:bg-sky-900/40 text-sky-800 dark:text-sky-300 font-extrabold flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs border border-sky-300 dark:border-sky-800 shadow-xs cursor-pointer disabled:opacity-50"
                    title="Envoyer un rappel par email à tous les participants"
                  >
                    <Bell size={13} />
                    <span className="hidden sm:inline">{sendingReminder ? 'Envoi...' : '🔔 Rappel'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrintModalFormation(formation)}
                    className="btn btn-sm bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs shadow-md shadow-emerald-700/20 cursor-pointer"
                    title="Imprimer la feuille d'émargement officielle (A4)"
                  >
                    <Printer size={14} />
                    <span className="hidden sm:inline">Imprimer Feuille (A4)</span>
                  </button>
                  <button 
                    onClick={() => { setParticipantsModalItem(null); setParticipantFilter(''); setPresenceStatusFilter('all'); }}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 dark:hover:bg-dark-700 transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Barre de KPI / Stats de présence en direct */}
              <div className="p-3 sm:px-5 sm:py-3.5 bg-slate-100/70 dark:bg-dark-800/40 border-b border-slate-200 dark:border-dark-700 grid grid-cols-3 gap-2.5 sm:gap-4 shrink-0 text-center">
                <div className="p-2 sm:p-2.5 rounded-2xl bg-white dark:bg-dark-800 border border-slate-200/70 dark:border-dark-700 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Inscrits</span>
                  <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5">{totalInscrits}</p>
                </div>

                <div className="p-2 sm:p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 shadow-xs">
                  <div className="flex items-center justify-center gap-1 text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 tracking-wider">
                    <CheckCircle2 size={11} /> Présents
                  </div>
                  <p className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {presentsCount} <span className="text-xs font-semibold text-emerald-700/80 dark:text-emerald-400/80">({tauxPresence}%)</span>
                  </p>
                </div>

                {isSessionTerminee ? (
                  <div className="p-2 sm:p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/50 shadow-xs">
                    <div className="flex items-center justify-center gap-1 text-[10px] uppercase font-bold text-rose-700 dark:text-rose-400 tracking-wider">
                      <XCircle size={11} /> Absents
                    </div>
                    <p className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5">
                      {absentsCount}
                    </p>
                  </div>
                ) : (
                  <div className="p-2 sm:p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 shadow-xs">
                    <div className="flex items-center justify-center gap-1 text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 tracking-wider">
                      <Clock size={11} /> En attente
                    </div>
                    <p className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5">
                      {absentsCount}
                    </p>
                  </div>
                )}
              </div>

              {/* Filtres de statut + Recherche */}
              <div className="p-3 sm:px-5 sm:py-3 border-b border-slate-100 dark:border-dark-800 bg-slate-50/50 dark:bg-dark-900 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
                {/* Boutons onglets de statut */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 dark:bg-dark-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setPresenceStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      presenceStatusFilter === 'all'
                        ? 'bg-white dark:bg-dark-700 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Tous ({totalInscrits})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresenceStatusFilter('presents')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      presenceStatusFilter === 'presents'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10'
                    }`}
                  >
                    <CheckCircle2 size={12} /> Présents ({presentsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresenceStatusFilter('absents')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      presenceStatusFilter === 'absents'
                        ? (isSessionTerminee ? 'bg-rose-600' : 'bg-amber-600') + ' text-white shadow-xs'
                        : isSessionTerminee
                          ? 'text-rose-700 dark:text-rose-400 hover:bg-rose-500/10'
                          : 'text-amber-700 dark:text-amber-400 hover:bg-amber-500/10'
                    }`}
                  >
                    {isSessionTerminee ? (
                      <>
                        <XCircle size={12} /> Absents ({absentsCount})
                      </>
                    ) : (
                      <>
                        <Clock size={12} /> En attente ({absentsCount})
                      </>
                    )}
                  </button>
                </div>

                {/* Recherche & Refresh */}
                <div className="flex items-center gap-2 flex-1 sm:max-w-xs">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filtrer par nom, promo..."
                      value={participantFilter}
                      onChange={e => setParticipantFilter(e.target.value)}
                      className="input !py-1.5 !pl-9 !text-xs w-full bg-white dark:bg-dark-800 rounded-xl"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => loadSessionPresences(formation.id)}
                    className="p-2 rounded-xl border border-slate-200 dark:border-dark-700 hover:bg-slate-100 dark:hover:bg-dark-800 text-slate-500 cursor-pointer"
                    title="Actualiser les émargements en direct"
                  >
                    <RefreshCw size={14} className={loadingPresences ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>



              {/* Tableau / Liste détaillée de Présence et Absence */}
              <div className="p-3 sm:p-5 overflow-y-auto space-y-2 flex-1 divide-y divide-slate-100 dark:divide-dark-800/80">
                {filteredList.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 space-y-2">
                    <Users size={32} className="mx-auto text-slate-300 dark:text-dark-600" />
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Aucun participant ne correspond à ces critères</p>
                    {participantFilter && <p className="text-[11px]">Effacez la recherche pour afficher toute la liste</p>}
                  </div>
                ) : (
                  filteredList.map((inc, idx) => {
                    const present = isIncubePresent(inc);
                    const presInfo = getIncubePresence(inc);

                    return (
                      <div 
                        key={inc.id || idx}
                        className={`pt-2.5 pb-2.5 px-3 rounded-2xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          present
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/10 border border-emerald-500/20'
                            : 'bg-slate-50/70 dark:bg-dark-800/60 border border-slate-100 dark:border-dark-700/60'
                        }`}
                      >
                        {/* Identité Incubé */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="font-mono text-xs font-bold text-slate-400 w-6 text-center shrink-0">
                            #{idx + 1}
                          </span>
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                            present 
                              ? 'bg-emerald-500 text-white shadow-xs' 
                              : 'bg-slate-200 dark:bg-dark-700 text-slate-600 dark:text-slate-300'
                          }`}>
                            {(inc.nom_incube || 'IN').substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-extrabold text-slate-900 dark:text-white text-xs truncate">
                                {inc.nom_incube}
                              </p>
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                {inc.promotion || 'Sans promo'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-dark-400 truncate mt-0.5">
                              {inc.raison_sociale || 'Projet en incubation'}
                              {inc.code_projet ? ` • ${inc.code_projet}` : ''}
                            </p>
                            <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1 flex-wrap">
                              {inc.email && <span className="truncate">✉️ {inc.email}</span>}
                              {inc.telephone && <span>📞 {inc.telephone}</span>}
                            </div>
                          </div>
                        </div>

                        {/* Statut Présence & Action Staff */}
                        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-dark-800">
                          {/* Badge Statut */}
                          <div className="text-right">
                            {present ? (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold text-xs">
                                <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
                                <span>PRÉSENT</span>
                              </div>
                            ) : isSessionTerminee ? (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 font-bold text-xs">
                                <XCircle size={13} className="text-rose-600 dark:text-rose-400" />
                                <span>ABSENT</span>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-dark-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-dark-600 font-semibold text-xs">
                                <Clock size={13} className="text-amber-600 dark:text-amber-400" />
                                <span>EN ATTENTE</span>
                              </div>
                            )}
                            <p className="text-[10px] text-slate-400 mt-0.5 text-right font-mono">
                              {present 
                                ? `Émargé (${presInfo?.time || '09:30'})` 
                                : isSessionTerminee 
                                  ? 'Non-émargé' 
                                  : "En attente d'émargement"}
                            </p>
                          </div>

                          {/* Bouton Toggle Manuel pour Super Admin / Staff */}
                          <button
                            type="button"
                            onClick={() => handleToggleIncubePresence(inc)}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 border ${
                              present
                                ? 'border-rose-200 dark:border-rose-900/50 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                : 'border-emerald-200 dark:border-emerald-900/50 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            }`}
                            title={present ? 'Marquer absent' : 'Marquer présent'}
                          >
                            {present ? (
                              <>
                                <UserX size={13} />
                                <span>Marquer absent</span>
                              </>
                            ) : (
                              <>
                                <UserCheck size={13} />
                                <span>Marquer présent</span>
                              </>
                            )}
                          </button>

                          {/* Bouton Envoi Email Individuel */}
                          <button
                            type="button"
                            onClick={() => handleSendSingleConvocation(formation, inc)}
                            disabled={!inc.email || sendingSingleEmailId === inc.id}
                            className={`p-2 rounded-xl border text-xs transition cursor-pointer flex items-center justify-center shrink-0 ${
                              !inc.email
                                ? 'border-slate-200 dark:border-dark-700 text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-40'
                                : 'border-blue-200 dark:border-blue-800/50 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-blue-600 dark:text-blue-400'
                            }`}
                            title={inc.email ? `Envoyer la convocation par email à ${inc.nom_incube} (${inc.email})` : 'Aucune adresse email enregistrée'}
                          >
                            <Mail size={13} className={sendingSingleEmailId === inc.id ? "animate-spin text-blue-500" : ""} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer Modal avec Bouton d'Impression Officielle A4 & Envoi Convocations */}
              <div className="p-3.5 sm:p-4 border-t border-slate-100 dark:border-dark-800 bg-slate-50/80 dark:bg-dark-800/40 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <div className="text-xs text-slate-600 dark:text-dark-300 font-bold text-center sm:text-left">
                  <span>Total : {totalInscrits} participant(s)</span>
                  <span className="mx-2">•</span>
                  <span className="text-emerald-600 font-black">{presentsCount} présent(s)</span>
                  <span className="mx-2">•</span>
                  {isSessionTerminee ? (
                    <span className="text-rose-600 font-black">{absentsCount} absent(s)</span>
                  ) : (
                    <span className="text-amber-600 font-black">{absentsCount} en attente</span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end">
                  <button
                    type="button"
                    onClick={() => handleSendFormationConvocations(formation, baseList)}
                    disabled={sendingConvocations}
                    className="btn btn-sm bg-blue-600 hover:bg-blue-700 text-white font-extrabold flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs shadow-md shadow-blue-700/20 cursor-pointer disabled:opacity-50"
                    title={`Envoyer la convocation officielle par email à tous les incubés inscrits (${baseList.length})`}
                  >
                    <Mail size={15} />
                    <span>{sendingConvocations ? 'Envoi en cours...' : `📧 Envoyer convocations (${baseList.length})`}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendFormationReminder(formation, baseList)}
                    disabled={sendingReminder}
                    className="btn btn-sm bg-sky-50 dark:bg-sky-950/30 hover:bg-sky-100 dark:hover:bg-sky-900/40 text-sky-800 dark:text-sky-300 font-extrabold flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs border border-sky-300 dark:border-sky-800 shadow-xs cursor-pointer disabled:opacity-50"
                    title="Envoyer un rappel par email à tous les participants"
                  >
                    <Bell size={14} />
                    <span>{sendingReminder ? 'Envoi...' : '🔔 Rappel'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintModalFormation(formation)}
                    className="btn btn-sm bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs shadow-md shadow-emerald-700/20 cursor-pointer"
                    title="Imprimer la feuille d'émargement officielle (A4)"
                  >
                    <Printer size={15} />
                    <span>Imprimer feuille d'émargement (A4)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* =========================================================================
          MODAL 4 : QR CODE D'ÉMARGEMENT POUR LES PARTICIPANTS
          ========================================================================= */}
      {qrModalItem && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setQrModalItem(null)}
        >
          <div 
            className="bg-white dark:bg-dark-900 text-slate-900 dark:text-white rounded-3xl border border-slate-200 dark:border-dark-700 shadow-2xl max-w-md w-full overflow-hidden slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-dark-800 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950">
              <div className="flex items-center gap-2">
                <QrCode size={20} />
                <h3 className="font-black text-sm">QR Code d'Émargement</h3>
              </div>
              <button 
                onClick={() => setQrModalItem(null)}
                className="p-1 rounded-lg text-slate-900 hover:bg-black/10"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 text-center space-y-4">
              <div className="space-y-1">
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  {qrModalItem ? (qrModalItem.titre || qrModalItem.name) : `Parcours ${selectedParcours === 'pre-creation' ? 'Pré-Création' : 'Post-Création'}`}
                </h4>
                <p className="text-xs text-slate-500">
                  Les participants scannent pour valider leur émargement en direct
                </p>
              </div>

              <div className="p-4 bg-white rounded-2xl border-2 border-dashed border-amber-500/50 inline-block shadow-sm mx-auto">
                <QRCodeSVG
                  value={getQrUrl(qrModalItem)}
                  size={190}
                  level="H"
                  includeMargin={true}
                />
              </div>

              <div className="p-2.5 bg-slate-50 dark:bg-dark-800 rounded-xl border border-slate-200 dark:border-dark-700 text-left space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                  <span>Lien direct :</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(getQrUrl(qrModalItem));
                      toast.success("Lien copié dans le presse-papier !");
                    }}
                    className="text-amber-600 font-bold hover:underline flex items-center gap-1"
                  >
                    <Copy size={12} /> Copier
                  </button>
                </div>
                <p className="text-[11px] font-mono text-slate-600 dark:text-slate-300 truncate bg-white dark:bg-dark-900 p-1 rounded border border-slate-200 dark:border-dark-700">
                  {getQrUrl(qrModalItem)}
                </p>
              </div>

              {/* Aperçu des champs du formulaire d'émargement */}
              <div className="p-3 bg-slate-50 dark:bg-dark-800/80 rounded-2xl border border-slate-200 dark:border-dark-700 text-left space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <User size={13} className="text-amber-500" />
                  <span>Champs remplis par l'incubé lors du scan :</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="p-2 bg-white dark:bg-dark-900 rounded-lg border border-slate-200 dark:border-dark-700">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">1. Nom</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">Obligatoire</span>
                  </div>
                  <div className="p-2 bg-white dark:bg-dark-900 rounded-lg border border-slate-200 dark:border-dark-700">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">2. Prénom</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">Obligatoire</span>
                  </div>
                  <div className="p-2 bg-white dark:bg-dark-900 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-bold uppercase">3. Email</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">Obligatoire</span>
                  </div>
                  <div className="p-2 bg-white dark:bg-dark-900 rounded-lg border border-slate-200 dark:border-dark-700">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">4. ID Projet</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">N° PP (optionnel)</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 pt-1">
                <a
                  href={getQrUrl(qrModalItem).includes('?') ? `${getQrUrl(qrModalItem)}&test=1` : `${getQrUrl(qrModalItem)}?test=1`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs py-2 px-3 font-bold cursor-pointer"
                >
                  <ExternalLink size={13} /> Voir / Tester le formulaire
                </a>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn btn-primary btn-sm flex items-center gap-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-2 px-3 cursor-pointer"
                >
                  <Printer size={13} /> Imprimer l'affiche
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 5 : IMPRESSION FEUILLE D'ÉMARGEMENT OFFICIELLE (A4)
          ========================================================================= */}
      <FeuilleEmargementPrint
        isOpen={Boolean(printModalFormation)}
        onClose={() => setPrintModalFormation(null)}
        atelier={printModalFormation}
        presences={fullPresencesForPrint}
      />

    </div>
  );
}
