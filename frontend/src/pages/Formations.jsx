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
  ChevronUp
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
    if (participantsModalItem?.formation?.id) {
      loadSessionPresences(participantsModalItem.formation.id);
    } else {
      setSessionPresences([]);
      setPresenceStatusFilter('all');
      setParticipantFilter('');
    }
  }, [participantsModalItem]);

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
          pp_numero: inc.code_projet || inc.id_projet || 'PP',
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

  // Liste complète des présences et absences pour l'impression officielle A4
  const fullPresencesForPrint = useMemo(() => {
    const formation = printModalFormation || participantsModalItem?.formation;
    if (!formation) return [];
    let invitesIds = [];
    if (participantsModalItem?.meta?.invitesIds) {
      invitesIds = participantsModalItem.meta.invitesIds;
    } else if (formation.description) {
      try {
        const meta = JSON.parse(formation.description);
        invitesIds = meta.invitesIds || [];
      } catch (e) {}
    }

    const targetList = invitesIds.length > 0
      ? allIncubes.filter(i => invitesIds.includes(i.id))
      : allIncubes;

    return targetList.map(inc => {
      const p = sessionPresences.find(sp => 
        String(sp.incubeId) === String(inc.id) ||
        (sp.nom && inc.nom_incube && sp.nom.toLowerCase().trim() === inc.nom_incube.toLowerCase().trim())
      );
      return {
        incubeId: inc.id,
        nom: inc.nom_incube,
        prenom: '—',
        pp_numero: inc.code_projet || inc.id_projet || 'PP',
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
    heureDebut: '09:30',
    heureFin: '12:30',
    duree: '3h00',
    salle: 'Salle de formation IDS',
    promoFilter: 'all',
    selectedIncubes: [],
    notifyByEmail: true
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
    }

    setFormationForm({
      moduleCode: chosenMod ? chosenMod.code : (mods[0]?.code || ''),
      formateur: 'Intervenant IDS',
      collaborateur: DEFAULT_COLLABORATEURS[0],
      customFormateur: '',
      date: new Date().toISOString().split('T')[0],
      heureDebut: '09:30',
      heureFin: '12:30',
      duree: chosenMod ? chosenMod.duree : '3h00',
      salle: 'Salle de formation IDS',
      promoFilter: 'all',
      selectedIncubes: targetIncubes.map(i => i.id),
      notifyByEmail: true
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

  // Enregistrer la session de formation
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
      const payload = {
        titre: `[${parcoursLabel}] ${formationForm.moduleCode} – ${modName}`,
        formateur: resolvedFormateur,
        intervenant: formationForm.collaborateur, // Le Collaborateur IDS
        date: formationForm.date,
        heureDebut: formationForm.heureDebut,
        heureFin: formationForm.heureFin,
        duree: formationForm.duree || '3h00',
        description: JSON.stringify({
          typeParcours: selectedParcours,
          moduleCode: formationForm.moduleCode,
          moduleName: modName,
          collaborateur: formationForm.collaborateur,
          salle: formationForm.salle,
          invitesIds: formationForm.selectedIncubes
        }),
        statutOuverture: 'auto'
      };

      const res = await api.post('/ateliers', payload);
      const created = res.data;
      toast.success('Session de formation créée avec succès !');

      // Envoyer les convocations par email si demandé
      if (formationForm.notifyByEmail && formationForm.selectedIncubes.length > 0) {
        try {
          await api.post(`/evenements/${created.id}/notifier`, {
            evenement: created,
            incubeIds: formationForm.selectedIncubes
          });
          toast.success(`Convocations par email envoyées à ${formationForm.selectedIncubes.length} incubé(s) !`);
        } catch (mailErr) {
          console.warn('Erreur envoi notification email:', mailErr);
        }
      }

      setShowAddFormationModal(false);
      loadData();
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
        heureDebut: editFormationForm.heureDebut,
        heureFin: editFormationForm.heureFin,
        duree: editFormationForm.duree || '3h00',
        description: JSON.stringify({
          typeParcours: selectedParcours,
          moduleCode: editFormationForm.moduleCode,
          moduleName: modName,
          collaborateur: editFormationForm.collaborateur,
          salle: editFormationForm.salle,
          invitesIds: editFormationForm.selectedIncubes
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
          1. HEADER PRINCIPAL AVEC SÉLECTEUR DE PARCOURS (PRÉ vs POST)
          ========================================================================= */}
      <div className="p-6 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700/60 rounded-3xl shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20 shrink-0 font-black">
              <GraduationCap size={28} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                Formations & Parcours Pédagogiques
              </h1>
              <p className="text-xs text-slate-500 dark:text-dark-400 mt-0.5">
                Organisation séparée des sessions, formateurs, collaborateurs et émargements
              </p>
            </div>
          </div>

          {/* Boutons d'action pour le parcours actif */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => handleOpenAddModule()}
              className="btn btn-secondary btn-sm flex items-center gap-2 border border-slate-200 dark:border-dark-700 bg-white dark:bg-dark-800 hover:border-amber-500/50 text-slate-800 dark:text-slate-100 font-bold py-2.5 px-4 rounded-xl cursor-pointer shadow-xs"
              title="Ajouter un module pédagogique officiel"
            >
              <BookOpen size={16} className="text-amber-500" />
              <span>Nouveau Module</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenAddFormation()}
              className="btn btn-primary btn-sm flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20 py-2.5 px-4 rounded-xl cursor-pointer"
            >
              <Plus size={16} className="stroke-[3]" />
              <span>Ajouter une Formation</span>
            </button>
          </div>
        </div>

        {/* =========================================================================
            LES 2 GRANDS PARCOURS BIEN DISTINCTS (PRÉ-CRÉATION vs POST-CRÉATION)
            ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-slate-100 dark:border-dark-800">
          
          {/* Bloc 1 : PRÉ-CRÉATION */}
          <button
            type="button"
            onClick={() => setSelectedParcours('pre-creation')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
              selectedParcours === 'pre-creation'
                ? 'bg-blue-500/15 border-blue-500 text-blue-950 dark:text-blue-200 ring-2 ring-blue-500/20 shadow-sm'
                : 'bg-slate-50 dark:bg-dark-800/60 border-slate-200 dark:border-dark-700 text-slate-600 dark:text-slate-300 hover:border-blue-400/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                selectedParcours === 'pre-creation' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-200 dark:bg-dark-700 text-slate-600'
              }`}>
                <Lightbulb size={20} />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-blue-600 dark:text-blue-400 block">
                  Idéation & Cadrage
                </span>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  1. Parcours Pré-Création
                </h3>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-black px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-700 dark:text-blue-300">
                {rawAteliers.filter(f => (f.titre + ' ' + (f.description || '')).toLowerCase().includes('pré') || (f.titre + ' ' + (f.description || '')).toLowerCase().includes('bmc')).length} session(s)
              </span>
            </div>
          </button>

          {/* Bloc 2 : POST-CRÉATION */}
          <button
            type="button"
            onClick={() => setSelectedParcours('post-creation')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
              selectedParcours === 'post-creation'
                ? 'bg-amber-500/15 border-amber-500 text-amber-950 dark:text-amber-200 ring-2 ring-amber-500/20 shadow-sm'
                : 'bg-slate-50 dark:bg-dark-800/60 border-slate-200 dark:border-dark-700 text-slate-600 dark:text-slate-300 hover:border-amber-400/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                selectedParcours === 'post-creation' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-slate-200 dark:bg-dark-700 text-slate-600'
              }`}>
                <Building size={20} />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-amber-600 dark:text-amber-400 block">
                  Entreprises Lancées
                </span>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  2. Parcours Post-Création
                </h3>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-black px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
                {rawAteliers.filter(f => (f.titre + ' ' + (f.description || '')).toLowerCase().includes('post') || (f.titre + ' ' + (f.description || '')).toLowerCase().includes('gfc')).length} session(s)
              </span>
            </div>
          </button>

        </div>
      </div>

      {/* =========================================================================
          1.5. RÉFÉRENTIEL DES MODULES PÉDAGOGIQUES (PRÉ & POST CRÉATION)
          ========================================================================= */}
      <div className="p-6 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700/60 rounded-3xl shadow-sm space-y-4">
        {/* En-tête de la section des modules */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
              selectedParcours === 'pre-creation'
                ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
            }`}>
              <BookOpen size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Modules Pédagogiques Officiels
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                  selectedParcours === 'pre-creation'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                }`}>
                  {displayedModulesList.length} module{displayedModulesList.length > 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-dark-400 mt-0.5">
                Référentiel des compétences, durées estimées et ateliers de cadrage
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
            {/* Bouton Ajouter un Module */}
            <button
              type="button"
              onClick={() => handleOpenAddModule(selectedParcours)}
              className="btn btn-secondary btn-sm flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold bg-white dark:bg-dark-800 border border-slate-200 dark:border-dark-700 hover:border-amber-500/50 text-slate-800 dark:text-slate-100 cursor-pointer shadow-xs"
              title="Ajouter un module personnalisé"
            >
              <Plus size={14} className="text-amber-500" />
              <span>Ajouter un Module</span>
            </button>

            {/* Bouton réduire / développer */}
            <button
              type="button"
              onClick={() => setModulesSectionExpanded(prev => !prev)}
              className="p-1.5 rounded-xl border border-slate-200 dark:border-dark-700 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors cursor-pointer"
              title={modulesSectionExpanded ? 'Réduire la liste des modules' : 'Afficher la liste des modules'}
            >
              {modulesSectionExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {/* Grille des modules pédagogiques */}
        {modulesSectionExpanded && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 pt-2">
            {displayedModulesList.map((m, mIdx) => {
              const isPreCreation = m.parcoursType === 'pre-creation';
              const sessionCount = rawAteliers.filter(f => {
                const matchCode = (f.titre || '').includes(m.code) || (f.description || '').includes(m.code);
                return matchCode;
              }).length;

              return (
                <div
                  key={`${m.parcoursType}-${m.code}-${mIdx}`}
                  className="bg-slate-50/70 dark:bg-dark-800/50 rounded-2xl border border-slate-200/80 dark:border-dark-700/70 p-4 flex flex-col justify-between hover:shadow-md transition-all hover:border-primary-500/40 group relative"
                >
                  <div>
                    {/* Header de la carte : Code, Durée, Badge parcours si "Tous" */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
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
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                            title="Supprimer ce module personnalisé"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Intitulé complet */}
                    <h3 className="font-black text-sm text-slate-900 dark:text-white leading-snug mb-2">
                      {m.name}
                    </h3>

                    {/* Liste des points clés du programme */}
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

                  {/* Footer : Compteur de sessions programmées + Bouton Planifier */}
                  <div className="pt-2.5 border-t border-slate-200/60 dark:border-dark-700/60 flex items-center justify-between gap-2 mt-auto">
                    <span className="text-[10px] font-bold text-slate-400">
                      {sessionCount} session{sessionCount > 1 ? 's' : ''} réalisée{sessionCount > 1 ? 's' : ''}
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
        )}
      </div>

      {/* =========================================================================
          2. EN-TÊTE DE LA LISTE DES FORMATIONS & RECHERCHE
          ========================================================================= */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-dark-700/80 pb-3 gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
            selectedParcours === 'pre-creation' ? 'bg-blue-500/15 text-blue-600' : 'bg-amber-500/15 text-amber-600'
          }`}>
            <Calendar size={16} />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>Formations programmées • {selectedParcours === 'pre-creation' ? 'Parcours Pré-Création' : 'Parcours Post-Création'}</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-slate-300 text-xs font-black">
                {currentParcoursFormations.length}
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">Sessions dispensées, formateurs référents et émargements par QR code</p>
          </div>
        </div>

        {/* Barre de recherche rapide */}
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Filtrer les formations..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input !py-1.5 !pl-9 !text-xs w-full bg-white dark:bg-dark-800 rounded-xl"
          />
        </div>
      </div>

      {/* =========================================================================
          3. LISTE DES FORMATIONS SANS DOUBLONS
          ========================================================================= */}
      <div className="space-y-4 animate-fade-in">
        {loadingFormations ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500" />
            </div>
          ) : currentParcoursFormations.length === 0 ? (
            <div className="card p-12 text-center border-dashed border-2 border-slate-200 dark:border-dark-700 bg-white/50 dark:bg-dark-900/50 rounded-3xl space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 mx-auto flex items-center justify-center">
                <GraduationCap size={28} />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Aucune formation de {selectedParcours === 'pre-creation' ? 'Pré-Création' : 'Post-Création'} enregistrée
              </h3>
              <p className="text-xs text-slate-500 dark:text-dark-400 max-w-sm mx-auto">
                Programmez une session pour les porteurs de projets en {selectedParcours === 'pre-creation' ? 'Pré-Création' : 'Post-Création'}.
              </p>
              <button
                type="button"
                onClick={() => handleOpenAddFormation()}
                className="btn btn-primary btn-sm inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-2 px-4 rounded-xl"
              >
                <Plus size={15} /> Programmer une formation
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentParcoursFormations.map(formation => {
                let meta = {};
                try {
                  meta = JSON.parse(formation.description || '{}');
                } catch (e) {
                  meta = {};
                }

                const moduleInfo = inferModuleInfo(formation, meta);
                const collaborateur = meta.collaborateur || formation.intervenant || 'Ayoub Elbouchikhi (Coach IDS)';
                const formateur = formation.formateur || meta.formateur || 'M. Khalid (Expert Formateur)';
                const invitesCount = Array.isArray(meta.invitesIds) ? meta.invitesIds.length : allIncubes.length;

                return (
                  <div
                    key={formation.id}
                    className="card p-5 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700/70 hover:border-amber-500/50 dark:hover:border-amber-500/50 rounded-3xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
                  >
                    {/* 1. TYPE DE MODULE & PARCOURS */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-xl border flex items-center gap-1.5 ${
                          selectedParcours === 'pre-creation' 
                            ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20' 
                            : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
                        }`}>
                          <BookOpen size={12} className={selectedParcours === 'pre-creation' ? 'text-blue-500' : 'text-amber-500'} />
                          <span>Type de module : <strong>{moduleInfo.code}</strong></span>
                        </span>

                        <span className="text-[10px] font-bold text-slate-500 dark:text-dark-300 bg-slate-100 dark:bg-dark-800 px-2 py-0.5 rounded-lg flex items-center gap-1">
                          <Clock size={11} /> {formation.duree || '3h00'}
                        </span>
                      </div>

                      <div>
                        <h3 className="font-black text-sm text-slate-900 dark:text-white leading-snug">
                          {moduleInfo.name}
                        </h3>
                        {formation.titre && formation.titre !== moduleInfo.name && (
                          <p className="text-[11px] text-slate-500 dark:text-dark-400 line-clamp-1 mt-0.5 font-medium">
                            {formation.titre}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* 2, 3 & 4. LE FORMATEUR, COLLABORATEUR, DATE ET HORAIRE */}
                    <div className="p-3.5 bg-slate-50/80 dark:bg-dark-800/50 rounded-2xl border border-slate-100 dark:border-dark-800/80 space-y-2.5 text-xs">
                      {/* 2. Le Formateur */}
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                          <User size={14} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block leading-tight">Le Formateur</span>
                          <strong className="text-slate-900 dark:text-white font-black truncate block text-xs">
                            {formateur}
                          </strong>
                        </div>
                      </div>

                      {/* 3. Collaborateur IDS */}
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                          <UserCheck size={14} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block leading-tight">Collaborateur</span>
                          <strong className="text-slate-900 dark:text-white font-black truncate block text-xs">
                            {collaborateur}
                          </strong>
                        </div>
                      </div>

                      {/* 4. La Date et l'Horaire */}
                      <div className="flex items-center gap-2.5 pt-2 border-t border-slate-200/60 dark:border-dark-700/60">
                        <div className="w-7 h-7 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <Calendar size={14} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block leading-tight">La date et l'horaire</span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <strong className="text-slate-900 dark:text-white font-black text-xs">
                              {formation.date ? new Date(formation.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'Date non définie'}
                            </strong>
                            <span className="text-emerald-600 dark:text-emerald-400 font-mono text-[11px] font-bold">
                              ({formation.heureDebut || '09:30'} - {formation.heureFin || '12:30'})
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Lieu / Salle */}
                      {meta.salle && (
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 pl-1">
                          <MapPin size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">{meta.salle}</span>
                        </div>
                      )}
                    </div>

                    {/* 5 & 6. BOUTON LISTE DES INCUBÉS PARTICIPANTS & LE QR CODE POUR FAIRE ÉMARGER */}
                    <div className="pt-2 space-y-2 border-t border-slate-100 dark:border-dark-800/80">
                      {/* 5. Un bouton pour ouvrir la liste des incubés participants */}
                      <button
                        type="button"
                        onClick={() => setParticipantsModalItem({ formation, meta })}
                        className="btn btn-secondary btn-sm w-full py-2.5 text-xs flex items-center justify-center gap-2 font-bold hover:border-primary-500/50 cursor-pointer rounded-xl border border-slate-200 dark:border-dark-700 bg-white dark:bg-dark-800 shadow-xs"
                        title="Ouvrir la liste des incubés participants"
                      >
                        <Users size={14} className="text-primary-500" />
                        <span>Liste des incubés participants ({invitesCount})</span>
                      </button>

                      {/* 6. Le QR code pour faire émarger les participants */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setQrModalItem(formation)}
                          className="btn btn-primary btn-sm flex-1 py-2.5 text-xs flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black cursor-pointer rounded-xl shadow-md shadow-amber-500/10"
                          title="Le QR code pour faire émarger les participants"
                        >
                          <QrCode size={15} />
                          <span>QR code pour faire émarger</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEditFormation(formation, meta)}
                          className="p-2.5 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors cursor-pointer border border-transparent hover:border-blue-200 dark:hover:border-blue-900/40"
                          title="Modifier la session de formation"
                        >
                          <Pencil size={15} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteFormation(formation.id)}
                          className="p-2.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer border border-transparent hover:border-rose-200 dark:hover:border-rose-900/40"
                          title="Supprimer la session"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

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

                {/* Collaborateur IDS */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-dark-200 block mb-1 uppercase tracking-wider">
                    3. Collaborateur Référent <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formationForm.collaborateur}
                    onChange={e => setFormationForm(p => ({ ...p, collaborateur: e.target.value }))}
                    className="input !py-2 !text-xs w-full font-bold bg-white dark:bg-dark-800 cursor-pointer"
                  >
                    {DEFAULT_COLLABORATEURS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3. DATE ET HORAIRE */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-dark-200 block mb-1 uppercase tracking-wider">
                    Date de la formation <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formationForm.date}
                    onChange={e => setFormationForm(p => ({ ...p, date: e.target.value }))}
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

                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={formationForm.notifyByEmail}
                    onChange={e => setFormationForm(p => ({ ...p, notifyByEmail: e.target.checked }))}
                    className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                  />
                  <Mail size={13} className="text-amber-500" />
                  <span>Envoyer automatiquement une convocation par email aux participants</span>
                </label>
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

                {/* Collaborateur IDS */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-dark-200 block mb-1 uppercase tracking-wider">
                    3. Collaborateur Référent <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editFormationForm.collaborateur}
                    onChange={e => setEditFormationForm(p => ({ ...p, collaborateur: e.target.value }))}
                    className="input !py-2 !text-xs w-full font-bold bg-white dark:bg-dark-800 cursor-pointer"
                  >
                    {DEFAULT_COLLABORATEURS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3. DATE ET HORAIRE */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-dark-200 block mb-1 uppercase tracking-wider">
                    Date de la formation <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={editFormationForm.date}
                    onChange={e => setEditFormationForm(p => ({ ...p, date: e.target.value }))}
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
        const invitesIds = meta.invitesIds || [];
        const baseList = invitesIds.length > 0
          ? allIncubes.filter(i => invitesIds.includes(i.id))
          : allIncubes;

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

                <div className="flex items-center gap-2 shrink-0">
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

                <div className="p-2 sm:p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/50 shadow-xs">
                  <div className="flex items-center justify-center gap-1 text-[10px] uppercase font-bold text-rose-700 dark:text-rose-400 tracking-wider">
                    <XCircle size={11} /> Absents
                  </div>
                  <p className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5">
                    {absentsCount}
                  </p>
                </div>
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
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-rose-700 dark:text-rose-400 hover:bg-rose-500/10'
                    }`}
                  >
                    <XCircle size={12} /> Absents ({absentsCount})
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
                            ) : (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 font-bold text-xs">
                                <XCircle size={13} className="text-rose-600 dark:text-rose-400" />
                                <span>ABSENT</span>
                              </div>
                            )}
                            <p className="text-[10px] text-slate-400 mt-0.5 text-right font-mono">
                              {present ? `Émargé (${presInfo?.time || '09:30'})` : 'Non-émargé'}
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
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer Modal avec Bouton d'Impression Officielle A4 et Convocations */}
              <div className="p-3.5 sm:p-4 border-t border-slate-100 dark:border-dark-800 bg-slate-50/80 dark:bg-dark-800/40 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <div className="text-xs text-slate-600 dark:text-dark-300 font-bold text-center sm:text-left">
                  <span>Total : {totalInscrits} participant(s)</span>
                  <span className="mx-2">•</span>
                  <span className="text-emerald-600 font-black">{presentsCount} présent(s)</span>
                  <span className="mx-2">•</span>
                  <span className="text-rose-600 font-black">{absentsCount} absent(s)</span>
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setPrintModalFormation(formation)}
                    className="btn btn-sm bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs shadow-md shadow-emerald-700/20 cursor-pointer"
                  >
                    <Printer size={14} /> Imprimer feuille d'émargement (A4)
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await api.post(`/evenements/${formation.id}/notifier`, {
                          evenement: formation,
                          incubeIds: meta.invitesIds
                        });
                        toast.success('Convocations par email renvoyées avec succès !');
                      } catch (e) {
                        toast.error("Erreur d'envoi d'email");
                      }
                    }}
                    className="btn btn-secondary btn-sm text-xs flex items-center gap-1.5 px-3 py-2 rounded-xl cursor-pointer"
                  >
                    <Send size={13} /> Renvoyer convocations
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
