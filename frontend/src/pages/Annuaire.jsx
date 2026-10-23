import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Plus, Users, Briefcase, TrendingUp, Filter, X, Camera, Upload, FileSpreadsheet, Calendar, AlertCircle, CheckCircle2, XCircle, Clock, Check, Bell, BellRing, RotateCw, UserCheck, KeyRound, Mail, GraduationCap, ClipboardList, Eye } from 'lucide-react';
import api, { getPhotoUrl } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import ExcelImportModal from '../components/common/ExcelImportModal';
import ExcelGlobalImportModal from '../components/common/ExcelGlobalImportModal';
import { SECTEURS_ACTIVITE } from '../data/constants';
import toast from 'react-hot-toast';

const PHASE_COLORS = { 'Idéation': 'badge-navy', 'Lancement': 'badge-blue', 'Croissance': 'badge-green', 'Maturité': 'badge-orange' };
const PHASE_OPTS = ['Idéation', 'Lancement', 'Croissance', 'Maturité'];
const STATUT_OPTS = ['Auto-entrepreneur', 'SARL', 'SARL AU', 'Autre'];
const SITUATION_OPTS = ['Célibataire', 'Marié(e)', 'Divorcé(e)', 'Veuf(ve)', 'Autre'];

function getInitials(name) {
  if (!name) return 'IN';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}
const AVATAR_COLORS = [
  'from-primary-500 to-navy-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-pink-500 to-rose-600',
  'from-cyan-500 to-blue-600',
  'from-navy-500 to-navy-600'
];

const MOIS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

function parseSuiviDate(moisStr, fallbackYear) {
  if (!moisStr) return null;
  const str = String(moisStr).trim();

  // Format ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  // Format DD/MM/YYYY ou DD/MM
  const slashMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);
  if (slashMatch) {
    const d = parseInt(slashMatch[1], 10);
    const m = parseInt(slashMatch[2], 10) - 1;
    let y = slashMatch[3] ? parseInt(slashMatch[3], 10) : (fallbackYear || new Date().getFullYear());
    if (y < 100) y += 2000;
    if (m >= 0 && m <= 11 && d >= 1 && d <= 31) {
      const date = new Date(y, m, d);
      return isNaN(date.getTime()) ? null : date;
    }
  }

  // Format "20 Septembre 2026" ou "20 Septembre"
  const matchWithDay = str.match(/^(\d{1,2})\s+([A-Za-zÀ-ÿ]+)(?:\s+(\d{4}))?/i);
  if (matchWithDay) {
    const day = parseInt(matchWithDay[1], 10);
    const mName = matchWithDay[2];
    const year = matchWithDay[3] ? parseInt(matchWithDay[3], 10) : (fallbackYear || new Date().getFullYear());
    const mIdx = MOIS_FR.findIndex(m => m.toLowerCase() === mName.toLowerCase());
    if (mIdx !== -1 && day >= 1 && day <= 31) {
      return new Date(year, mIdx, day);
    }
  }

  // Format "Septembre 2026" ou "Septembre"
  const matchOnlyMonth = str.match(/^([A-Za-zÀ-ÿ]+)(?:\s+(\d{4}))?/i);
  if (matchOnlyMonth) {
    const mName = matchOnlyMonth[1];
    const year = matchOnlyMonth[2] ? parseInt(matchOnlyMonth[2], 10) : (fallbackYear || new Date().getFullYear());
    const mIdx = MOIS_FR.findIndex(m => m.toLowerCase() === mName.toLowerCase());
    if (mIdx !== -1) {
      return new Date(year, mIdx, 1);
    }
  }

  return null;
}

export default function Annuaire() {
  const { user, isSuperAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const accompagnateurParam = searchParams.get('accompagnateur');
  const [accompagnateurFilterName, setAccompagnateurFilterName] = useState(accompagnateurParam || '');
  const [incubes, setIncubes] = useState([]);
  const [adminsList, setAdminsList] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [filterSuivis, setFilterSuivis] = useState(false);
  const [selectedAdminFilter, setSelectedAdminFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [showFormExcelModal, setShowFormExcelModal] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [enlargedPhoto, setEnlargedPhoto] = useState(null);
  const [accountFilter, setAccountFilter] = useState('all');
  const [promotionsList, setPromotionsList] = useState([]);
  const [selectedPromotionFilter, setSelectedPromotionFilter] = useState('all');
  const [selectedPlanStatus, setSelectedPlanStatus] = useState('all');
  const [showAddPromo, setShowAddPromo] = useState(false);
  const [newPromoName, setNewPromoName] = useState('');
  const [creatingPromo, setCreatingPromo] = useState(false);
  const [isCustomSecteur, setIsCustomSecteur] = useState(false);
  const [emailModalIncube, setEmailModalIncube] = useState(null);
  const [inputEmail, setInputEmail] = useState('');
  const [activatingEmail, setActivatingEmail] = useState(false);
  const [form, setForm] = useState({
    nom_incube: '',
    email: '',
    telephone: '',
    raison_sociale: '',
    phase_projet: 'Idéation',
    statut_juridique: 'SARL',
    situation_familiale: 'Célibataire',
    accompagnateur: '',
    admin_id: '',
    pp_numero: '',
    date_demarrage: '',
    promotion: 'Promotion 1',
    secteur_activite: '',
  });
  const navigate = useNavigate();

  const loadPromotions = async () => {
    try {
      const res = await api.get('/promotions');
      if (Array.isArray(res.data) && res.data.length > 0) {
        setPromotionsList(res.data);
      } else {
        setPromotionsList([{ id: 1, nom: 'Promotion 1' }, { id: 2, nom: 'Promotion 2' }]);
      }
    } catch (e) {
      setPromotionsList([{ id: 1, nom: 'Promotion 1' }, { id: 2, nom: 'Promotion 2' }]);
    }
  };

  useEffect(() => {
    loadPromotions();
  }, []);

  const handleAddPromotion = async (e) => {
    if (e) e.preventDefault();
    const clean = newPromoName.trim();
    if (!clean) {
      toast.error('Veuillez renseigner le nom de la promotion');
      return;
    }
    setCreatingPromo(true);
    try {
      const res = await api.post('/promotions', { nom: clean });
      const added = res.data;
      setPromotionsList(prev => {
        if (prev.some(p => p.nom.toLowerCase() === added.nom.toLowerCase())) return prev;
        return [...prev, added];
      });
      setForm(prev => ({ ...prev, promotion: added.nom }));
      setNewPromoName('');
      setShowAddPromo(false);
      toast.success(`Promotion "${added.nom}" ajoutée et sélectionnée !`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'ajout de la promotion");
    } finally {
      setCreatingPromo(false);
    }
  };

  const handleBulkImport = async (rows) => {
    try {
      try {
        const res = await api.post('/incubes/bulk', rows);
        toast.success(res.data?.message || `${rows.length} incubé(s) importé(s) avec succès !`);
        load();
        return;
      } catch (bulkErr) {
        if (bulkErr.response?.status === 404) {
          // Secours si le serveur backend n'a pas encore été redémarré
          let created = 0;
          for (const r of rows) {
            await api.post('/incubes', r);
            created++;
          }
          toast.success(`${created} incubé(s) importé(s) avec succès !`);
          load();
          return;
        }
        throw bulkErr;
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'importation Excel");
    }
  };

  const handleFillFormFromExcel = (row) => {
    if (!row) return;

    // Association automatique de l'accompagnateur si présent dans la liste des admins
    let matchingAdminId = '';
    if (row.accompagnateur && adminsList && adminsList.length > 0) {
      const clean = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
      const accClean = clean(row.accompagnateur);
      const matched = adminsList.find(a => {
        const full1 = clean(`${a.prenom} ${a.nom}`);
        const full2 = clean(`${a.nom} ${a.prenom}`);
        return full1.includes(accClean) || accClean.includes(full1) ||
               full2.includes(accClean) || accClean.includes(full2);
      });
      if (matched) {
        matchingAdminId = String(matched.id);
      }
    }

    setForm(prev => ({
      ...prev,
      nom_incube: row.nom_incube || prev.nom_incube,
      email: row.email || row.mail || prev.email,
      telephone: row.telephone || row.tel || prev.telephone,
      raison_sociale: row.raison_sociale || prev.raison_sociale,
      phase_projet: row.phase_projet || prev.phase_projet,
      statut_juridique: row.statut_juridique || prev.statut_juridique,
      pp_numero: row.pp_numero || prev.pp_numero,
      situation_familiale: row.situation_familiale || prev.situation_familiale,
      accompagnateur: row.accompagnateur || prev.accompagnateur,
      admin_id: matchingAdminId || prev.admin_id,
      date_demarrage: row.date_demarrage || prev.date_demarrage,
      promotion: row.promotion || row.promo || prev.promotion,
      secteur_activite: row.secteur_activite || row.secteur || prev.secteur_activite,
    }));
    toast.success(`Champs remplis pour ${row.nom_incube || "l'incubé"} !`);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/incubes', { params: search ? { search } : {} });
      setIncubes(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error('Impossible de charger les incubés depuis le serveur');
      setIncubes([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search]);

  useEffect(() => {
    if (accompagnateurParam) {
      setAccompagnateurFilterName(accompagnateurParam);
    }
  }, [accompagnateurParam]);

  useEffect(() => {
    if (isSuperAdmin) {
      api.get('/users/admins')
        .then(res => {
          setAdminsList(res.data);
          if (accompagnateurParam && Array.isArray(res.data)) {
            const cleanQ = accompagnateurParam.trim().toLowerCase();
            const matchedAdmin = res.data.find(a => {
              const full1 = `${a.prenom || ''} ${a.nom || ''}`.trim().toLowerCase();
              const full2 = `${a.nom || ''} ${a.prenom || ''}`.trim().toLowerCase();
              return full1 === cleanQ || full2 === cleanQ || (a.nom && cleanQ.includes(a.nom.toLowerCase()));
            });
            if (matchedAdmin) {
              setSelectedAdminFilter(String(matchedAdmin.id));
            }
          }
        })
        .catch(() => {});
    }
  }, [isSuperAdmin, accompagnateurParam]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      Object.keys(form).forEach(key => {
        if (form[key] !== undefined && form[key] !== null && form[key] !== '') {
          formData.append(key, form[key]);
        }
      });
      if (photoFile) {
        formData.append('photo', photoFile);
      }

      const token = localStorage.getItem('cgs_token');
      const res = await fetch(import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/incubes` : '/api/incubes', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || "Erreur lors de l'ajout de l'incubé");
      }

      if (form.email) {
        toast.success('Incubé ajouté ! Compte créé en attente — activez-le depuis sa fiche pour lui envoyer ses accès.');
      } else {
        toast.success('Incubé ajouté avec succès.');
      }

      setShowModal(false);
      setPhotoFile(null);
      setPreviewUrl(null);
      setForm({
        nom_incube: '',
        email: '',
        telephone: '',
        raison_sociale: '',
        phase_projet: 'Idéation',
        statut_juridique: 'SARL',
        situation_familiale: 'Célibataire',
        accompagnateur: '',
        admin_id: '',
        pp_numero: '',
        date_demarrage: '',
        promotion: 'Promotion 1',
        secteur_activite: '',
      });
      load();
    } catch (err) {
      toast.error(err.message || "Erreur lors de l'ajout de l'incubé");
    }
  };

  // Helper pour déduire le statut principal du Plan d'Action d'un incubé
  const getPlanStatus = (inc) => {
    if (inc.statut_action) return inc.statut_action;
    if (inc.plan_action_statut) return inc.plan_action_statut;
    if (!inc.plans || inc.plans.length === 0) return null;

    // Priorité 1 : Non atteint (blocage critique)
    const hasNonAtteint = inc.plans.some(p => p.realisation === 'Non atteint');
    if (hasNonAtteint) return 'Non atteint';

    // Priorité 2 : En cours (en cours de réalisation)
    const hasEnCours = inc.plans.some(p => p.realisation === 'En cours' || p.realisation === 'À jour' || p.realisation === 'En attente' || !p.realisation);

    // Priorité 3 : Atteint / Effectué / Validé
    const allValide = inc.plans.every(p => p.realisation === 'Atteint' || p.realisation === 'Validé' || p.realisation === 'Effectué');
    const hasValide = inc.plans.some(p => p.realisation === 'Atteint' || p.realisation === 'Validé' || p.realisation === 'Effectué');

    if (allValide && hasValide) return 'Atteint';
    if (hasEnCours) return 'En cours';
    if (hasValide) return 'Atteint';

    return 'En cours';
  };

  // Helper pour vérifier si un incubé correspond au filtre d'état de plan d'action sélectionné
  const matchesPlanStatus = (inc, status) => {
    if (status === 'all') return true;
    if (inc.statut_action === status || inc.plan_action_statut === status) return true;
    const plans = inc.plans || [];
    if (plans.length === 0) return false;

    if (status === 'Atteint' || status === 'Effectué') {
      return plans.some(p => p.realisation === 'Atteint' || p.realisation === 'Effectué' || p.realisation === 'Validé');
    }
    if (status === 'En cours') {
      return plans.some(p => p.realisation === 'En cours' || p.realisation === 'À jour' || p.realisation === 'En attente' || !p.realisation);
    }
    if (status === 'Non atteint') {
      return plans.some(p => p.realisation === 'Non atteint');
    }
    return false;
  };

  // Statistiques de comptage par état de plan d'action (En cours, Atteint, Non atteint)
  const planCounts = useMemo(() => {
    let atteint = 0;
    let enCours = 0;
    let nonAtteint = 0;

    incubes.forEach(inc => {
      const plans = inc.plans || [];
      if (plans.some(p => p.realisation === 'Atteint' || p.realisation === 'Effectué' || p.realisation === 'Validé')) atteint++;
      if (plans.some(p => p.realisation === 'En cours' || p.realisation === 'À jour' || p.realisation === 'En attente' || !p.realisation)) enCours++;
      if (plans.some(p => p.realisation === 'Non atteint')) nonAtteint++;
    });

    return { atteint, enCours, nonAtteint };
  }, [incubes]);

  // Vérifie si un incubé est affecté à un accompagnateur / admin
  const isIncubeAssignedToAdmin = (i, a) => {
    if (!a || !i) return false;
    if (i.admin_id && String(i.admin_id) === String(a.id)) return true;
    const adminFullName = `${a.prenom || ''} ${a.nom || ''}`.trim().toLowerCase();
    const adminReverseName = `${a.nom || ''} ${a.prenom || ''}`.trim().toLowerCase();
    const adminNom = (a.nom || '').trim().toLowerCase();
    const adminPrenom = (a.prenom || '').trim().toLowerCase();
    const accNorm = (i.accompagnateur || '').trim().toLowerCase();
    if (!accNorm) return false;
    return accNorm === adminFullName || 
           accNorm === adminReverseName || 
           (adminNom && accNorm.includes(adminNom)) ||
           (adminPrenom && accNorm.includes(adminPrenom));
  };

  // Vérifie si un incubé correspond à une promotion donnée
  const incubeMatchesPromo = (i, promoNom) => {
    if (!i || !i.promotion || !promoNom) return false;
    return i.promotion.trim().toLowerCase() === promoNom.trim().toLowerCase();
  };

  // Calcul du nombre d'incubés par accompagnateur pour la liste du Super Admin (compatibilité)
  const getIncubesCountForAdmin = (a) => {
    if (!a) return 0;
    return incubes.filter(i => isIncubeAssignedToAdmin(i, a)).length;
  };

  // Libellé épuré de l'option accompagnateur (ex: "Ayoub EL BOUCHIKHI (17)")
  const getAdminOptionLabel = (a) => {
    if (!a) return '';
    const prenomCap = a.prenom ? a.prenom.charAt(0).toUpperCase() + a.prenom.slice(1).toLowerCase() : '';
    const nomUpper = a.nom ? a.nom.toUpperCase() : '';
    const adminName = `${prenomCap} ${nomUpper}`.trim() || a.email || `Accompagnateur #${a.id}`;

    const adminIncubes = incubes.filter(i => isIncubeAssignedToAdmin(i, a));

    // Si une promotion spécifique est sélectionnée : afficher uniquement le nombre pour cette promotion
    if (selectedPromotionFilter !== 'all') {
      const countInPromo = adminIncubes.filter(i => incubeMatchesPromo(i, selectedPromotionFilter)).length;
      return `${adminName} (${countInPromo})`;
    }

    // Affichage direct et concis du nombre total d'incubés
    return `${adminName} (${adminIncubes.length})`;
  };

  // Libellé épuré de l'option "Tous les Incubés" (ex: "Tous les Incubés (58)")
  const getAllIncubesOptionLabel = () => {
    if (selectedPromotionFilter !== 'all') {
      const countInPromo = incubes.filter(i => incubeMatchesPromo(i, selectedPromotionFilter)).length;
      return `Tous les Incubés (${countInPromo})`;
    }
    return `Tous les Incubés (${incubes.length})`;
  };

  // Liste exclusive et stricte des accompagnateurs réels (exclut visiteurs, tests, super_admin et comptes sans incubé)
  const realAccompagnateurs = useMemo(() => {
    const list = (Array.isArray(adminsList) ? adminsList : []).filter(a => {
      if (!a) return false;
      const nom = (a.nom || '').toLowerCase();
      const prenom = (a.prenom || '').toLowerCase();
      const email = (a.email || '').toLowerCase();

      // Exclusions strictes : pas de visiteur, pas de compte test, pas de super administrateur
      if (a.id === 1 || a.role === 'super_admin' || a.role === 'incube') return false;
      if (nom.includes('visiteur') || prenom.includes('visiteur')) return false;
      if (nom.includes('test') || prenom.includes('test')) return false;
      if (nom.includes('administrateur') || email.startsWith('admin@')) return false;
      if (a.type === 'Visiteur' || a.type === 'Autre') return false;

      // Doit avoir au moins un incubé assigné ou avoir le rôle d'accompagnateur officiel
      const count = incubes.filter(i => isIncubeAssignedToAdmin(i, a)).length;
      return count > 0 || a.role === 'accompagnateur';
    });

    if (list.length > 0) return list;

    // Repli de secours : dériver les accompagnateurs directement depuis la liste des incubés chargés
    const distinctNames = Array.from(new Set(
      incubes
        .map(i => (i.accompagnateur || '').trim())
        .filter(n => n && !n.toLowerCase().includes('test') && !n.toLowerCase().includes('visiteur'))
    ));

    return distinctNames.map((name, idx) => ({
      id: `accomp_name_${idx + 1}`,
      nom: name,
      prenom: '',
      role: 'accompagnateur'
    }));
  }, [adminsList, incubes]);

  // Filtrage par nom, raison sociale, portefeuille (Admin) ou liste accompagnateur (Super Admin)
  const filtered = incubes.filter(i => {
    const matchesSearch = !search || 
      i.nom_incube?.toLowerCase().includes(search.toLowerCase()) ||
      i.raison_sociale?.toLowerCase().includes(search.toLowerCase()) ||
      i.pp_numero?.toLowerCase().includes(search.toLowerCase()) ||
      i.promotion?.toLowerCase().includes(search.toLowerCase()) ||
      i.secteur_activite?.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    // 1. Filtrage par accompagnateur (URL ou sélection Super Admin)
    if (accompagnateurFilterName) {
      const q = accompagnateurFilterName.trim().toLowerCase();
      const incAcc = (i.accompagnateur || '').trim().toLowerCase();
      const targetAdmin = adminsList.find(a => String(a.id) === String(selectedAdminFilter));
      const matchText = incAcc === q || incAcc.includes(q) || q.includes(incAcc);
      const matchAdmin = targetAdmin ? isIncubeAssignedToAdmin(i, targetAdmin) : false;
      if (!matchText && !matchAdmin) return false;
    } else if (isSuperAdmin && selectedAdminFilter && selectedAdminFilter !== 'all') {
      if (selectedAdminFilter === 'unassigned') {
        const hasAdmin = Boolean(i.admin_id) || Boolean((i.accompagnateur || '').trim());
        if (hasAdmin) return false;
      } else if (selectedAdminFilter === 'mine') {
        if (!user || !isIncubeAssignedToAdmin(i, user)) return false;
      } else {
        const targetAdmin = realAccompagnateurs.find(a => String(a.id) === String(selectedAdminFilter)) ||
                            adminsList.find(a => String(a.id) === String(selectedAdminFilter));
        if (!targetAdmin || !isIncubeAssignedToAdmin(i, targetAdmin)) return false;
      }
    } else if (!isSuperAdmin && filterSuivis && user) {
      // 2. Filtrage Admin classique (Mes Incubés)
      if (!isIncubeAssignedToAdmin(i, user)) return false;
    }

    // 3. Filtrage État du compte portail (Tous / En attente / Actifs)
    if (accountFilter === 'pending') {
      const isPending = (i.compteUtilisateur && !i.compteUtilisateur.actif) || (i.email && !i.compteUtilisateur);
      if (!isPending) return false;
    } else if (accountFilter === 'active') {
      const isActive = i.compteUtilisateur && i.compteUtilisateur.actif;
      if (!isActive) return false;
    }

    // 4. Filtrage par Promotion
    if (selectedPromotionFilter !== 'all') {
      if (!incubeMatchesPromo(i, selectedPromotionFilter)) return false;
    }

    // 5. Filtrage par État du Plan d'Action
    if (selectedPlanStatus !== 'all') {
      if (!matchesPlanStatus(i, selectedPlanStatus)) return false;
    }

    return true;
  });

  const pendingCount = incubes.filter(i => (i.compteUtilisateur && !i.compteUtilisateur.actif) || (i.email && !i.compteUtilisateur)).length;
  const activeCount = incubes.filter(i => i.compteUtilisateur && i.compteUtilisateur.actif).length;

  const myIncubesCount = useMemo(() => {
    if (!user) return 0;
    const myIncubes = incubes.filter(i => isIncubeAssignedToAdmin(i, user));
    if (selectedPromotionFilter !== 'all') {
      return myIncubes.filter(i => incubeMatchesPromo(i, selectedPromotionFilter)).length;
    }
    return myIncubes.length;
  }, [incubes, user, selectedPromotionFilter]);

  const allIncubesCountForPromo = useMemo(() => {
    if (selectedPromotionFilter !== 'all') {
      return incubes.filter(i => incubeMatchesPromo(i, selectedPromotionFilter)).length;
    }
    return incubes.length;
  }, [incubes, selectedPromotionFilter]);

  const hasActiveFilters = (isSuperAdmin ? selectedAdminFilter !== 'all' : filterSuivis) || 
    selectedPromotionFilter !== 'all' || 
    selectedPlanStatus !== 'all' || 
    accountFilter !== 'all' || 
    Boolean(search && search.trim());
  const statsList = hasActiveFilters ? filtered : incubes;
  const stats = {
    total: statsList.length,
    ideation: statsList.filter(i => i.phase_projet === 'Idéation').length,
    lancement: statsList.filter(i => i.phase_projet === 'Lancement').length,
    croissance: statsList.filter(i => i.phase_projet === 'Croissance').length,
  };

  // Helper pour calculer le statut de suivi (Option 1 : strictement basé sur le Jour de suivi dans le plan d'action)
  const getFollowUpStatus = (inc) => {
    const validDates = [];

    // 1. Examiner les dates de suivi dans les plans d'action (Jour de suivi)
    if (Array.isArray(inc.plans) && inc.plans.length > 0) {
      for (const p of inc.plans) {
        // Déterminer l'année de référence si absente dans le libellé
        let fallbackYear = new Date().getFullYear();
        const planCreated = p.created_at || p.createdAt;
        if (planCreated) {
          const cDate = new Date(planCreated);
          if (!isNaN(cDate.getTime())) fallbackYear = cDate.getFullYear();
        } else if (p.echeance) {
          const eDate = new Date(p.echeance);
          if (!isNaN(eDate.getTime())) fallbackYear = eDate.getFullYear();
        }

        // a) Analyser le champ mois (ex: "20 Septembre", "16/09/2026", etc.)
        if (p.mois) {
          const d = parseSuiviDate(p.mois, fallbackYear);
          if (d && !isNaN(d.getTime())) validDates.push(d);
        }

        // b) Si échéance renseignée
        if (p.echeance) {
          const ed = new Date(p.echeance);
          if (!isNaN(ed.getTime())) validDates.push(ed);
        }

        // c) Date de création du plan si aucune autre date
        if (!p.mois && !p.echeance && planCreated) {
          const cd = new Date(planCreated);
          if (!isNaN(cd.getTime())) validDates.push(cd);
        }
      }
    }

    // 2. Vérifier last_rdv_date si disponible
    if (inc.last_rdv_date) {
      const rdvDate = new Date(inc.last_rdv_date);
      if (!isNaN(rdvDate.getTime())) validDates.push(rdvDate);
    }

    // Option 1 : S'il n'y a AUCUNE date de suivi enregistrée dans le plan d'action ni de rdv,
    // on ne déclenche pas le chrono et aucune fausse alerte n'est affichée.
    if (validDates.length === 0) {
      return { hasSuivi: false, isLate: false, days: null, lastDate: null };
    }

    // Sélectionner la date de suivi la plus récente
    const latestDate = new Date(Math.max(...validDates.map(d => d.getTime())));
    const now = Date.now();
    const diffDays = Math.floor((now - latestDate.getTime()) / (1000 * 60 * 60 * 24));

    return {
      hasSuivi: true,
      isLate: diffDays > 30,
      days: Math.max(0, diffDays),
      lastDate: latestDate,
    };
  };

  // Icône de statut / notification sans texte (Validé en vert, Non atteint avec croix, En attente avec flèche synchro, Alerte en rouge, Aucun suivi neutre)
  const renderNotificationIcon = (inc, planStatut, followUp) => {
    if (planStatut === 'Atteint' || planStatut === 'Effectué' || planStatut === 'Validé') {
      return (
        <span
          className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-sm transition-transform hover:scale-110"
          title={`Dossier #${inc.id} — Objectif atteint`}
        >
          <CheckCircle2 size={16} className="stroke-[2.5]" />
        </span>
      );
    }

    if (planStatut === 'Non atteint') {
      return (
        <span
          className="w-7 h-7 rounded-lg flex items-center justify-center bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 shadow-sm transition-transform hover:scale-110"
          title={`Dossier #${inc.id} — Objectif non atteint`}
        >
          <XCircle size={16} className="stroke-[2.5]" />
        </span>
      );
    }

    if (planStatut === 'En cours') {
      return (
        <span
          className="w-7 h-7 rounded-lg flex items-center justify-center bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 shadow-sm transition-transform hover:scale-110"
          title={`Dossier #${inc.id} — Objectif en cours`}
        >
          <Bell size={15} className="stroke-[2.5]" />
        </span>
      );
    }

    if (!followUp.hasSuivi) {
      return (
        <span
          className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-dark-800 text-slate-400 dark:text-dark-400 border border-slate-200 dark:border-dark-700/60 transition-transform hover:scale-110"
          title={`Dossier #${inc.id} — Aucun suivi enregistré dans le plan d'action`}
        >
          <Clock size={14} />
        </span>
      );
    }

    if (followUp.isLate) {
      return (
        <span
          className="relative w-7 h-7 rounded-lg flex items-center justify-center bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 animate-pulse transition-transform hover:scale-110 shadow-sm"
          title={`Dossier #${inc.id} — Alerte : Plus de 30 jours sans suivi (${followUp.days} jours)`}
        >
          <BellRing size={15} className="stroke-[2.5]" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-rose-600 ring-2 ring-white dark:ring-dark-900"></span>
        </span>
      );
    }

    return (
      <span
        className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 transition-transform hover:scale-110"
        title={`Dossier #${inc.id} — Suivi à jour (il y a ${followUp.days} j)`}
      >
        <Bell size={14} />
      </span>
    );
  };

  return (
    <div className="slide-up space-y-6">
      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <div className="card flex items-center gap-3 sm:gap-4 p-3.5 sm:p-5">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center shrink-0">
            <Users size={22} />
          </div>
          <div className="min-w-0">
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white truncate">{stats.total}</div>
            <div className="text-[11px] sm:text-xs text-slate-500 dark:text-dark-400 font-medium truncate">Total Incubés</div>
          </div>
        </div>
        <div className="card flex items-center gap-3 sm:gap-4 p-3.5 sm:p-5">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-navy-500/10 text-navy-400 flex items-center justify-center shrink-0">
            <Briefcase size={22} />
          </div>
          <div className="min-w-0">
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white truncate">{stats.ideation}</div>
            <div className="text-[11px] sm:text-xs text-slate-500 dark:text-dark-400 font-medium truncate">En Idéation</div>
          </div>
        </div>
        <div className="card flex items-center gap-3 sm:gap-4 p-3.5 sm:p-5">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
            <TrendingUp size={22} />
          </div>
          <div className="min-w-0">
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white truncate">{stats.lancement}</div>
            <div className="text-[11px] sm:text-xs text-slate-500 dark:text-dark-400 font-medium truncate">En Lancement</div>
          </div>
        </div>
        <div className="card flex items-center gap-3 sm:gap-4 p-3.5 sm:p-5">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <Filter size={22} />
          </div>
          <div className="min-w-0">
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white truncate">{stats.croissance}</div>
            <div className="text-[11px] sm:text-xs text-slate-500 dark:text-dark-400 font-medium truncate">En Croissance</div>
          </div>
        </div>
      </div>

      {/* Bannière de filtrage dynamique par accompagnateur */}
      {accompagnateurFilterName && (
        <div className="flex items-center justify-between p-3.5 mb-2 rounded-2xl bg-gradient-to-r from-primary-500/15 via-primary-500/10 to-transparent border border-primary-500/30 text-primary-900 dark:text-primary-100 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary-600 text-white flex items-center justify-center font-bold shadow-sm shrink-0">
              <UserCheck size={18} />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-extrabold flex items-center gap-2 flex-wrap">
                <span>Portefeuille de : <span className="underline decoration-primary-500 font-black">{accompagnateurFilterName}</span></span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-primary-600 text-white shadow-xs">
                  {filtered.length} incubé{filtered.length > 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-dark-300">
                Affichage filtré depuis le Tableau de Bord (Contrôle du suivi mensuel).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setAccompagnateurFilterName('');
              setSelectedAdminFilter('all');
              setSearchParams(prev => {
                const next = new URLSearchParams(prev);
                next.delete('accompagnateur');
                return next;
              });
            }}
            className="btn btn-secondary btn-sm flex items-center gap-1.5 font-bold cursor-pointer hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 border border-slate-200 dark:border-dark-700 shrink-0"
            title="Réinitialiser pour voir tous les incubés"
          >
            <X size={14} />
            <span className="hidden sm:inline">Afficher tous les incubés</span>
            <span className="sm:hidden">Tous</span>
          </button>
        </div>
      )}

      {/* Barre d'outils & Filtres */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        <div className="flex flex-1 items-center gap-2.5 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-dark-400" />
            <input
              type="text"
              className="input pl-10"
              placeholder="Rechercher par nom, raison sociale, PP..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Filtre Accompagnateur : Liste déroulante pour Super Admin / Bouton toggle pour Admin classique */}
          {isSuperAdmin ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="relative flex items-center">
                <div className="absolute left-3 pointer-events-none text-primary-500 flex items-center">
                  <UserCheck size={16} />
                </div>
                <select
                  value={selectedAdminFilter}
                  onChange={(e) => {
                    setSelectedAdminFilter(e.target.value);
                    setAccompagnateurFilterName('');
                    setSearchParams(prev => {
                      const next = new URLSearchParams(prev);
                      next.delete('accompagnateur');
                      return next;
                    });
                  }}
                  className={`input pl-9 pr-8 py-2 text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-all border ${
                    selectedAdminFilter !== 'all' || Boolean(accompagnateurFilterName)
                      ? 'border-primary-500 bg-primary-50/70 dark:bg-primary-950/40 text-primary-800 dark:text-primary-200 ring-2 ring-primary-500/20'
                      : 'border-slate-200 dark:border-dark-700 bg-white dark:bg-dark-900 text-slate-800 dark:text-dark-100'
                  }`}
                  title="Filtrer les incubés par accompagnateur / admin"
                >
                  <option value="all">{getAllIncubesOptionLabel()}</option>
                  <optgroup label="── Accompagnateurs ──">
                    {realAccompagnateurs.map((a) => (
                      <option key={a.id} value={String(a.id)}>
                        {getAdminOptionLabel(a)}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {(selectedAdminFilter !== 'all' || Boolean(accompagnateurFilterName)) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAdminFilter('all');
                    setAccompagnateurFilterName('');
                    setSearchParams(prev => {
                      const next = new URLSearchParams(prev);
                      next.delete('accompagnateur');
                      return next;
                    });
                  }}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-slate-200 dark:border-dark-700 transition-colors"
                  title="Réinitialiser le filtre"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-dark-800 p-1 rounded-xl border border-slate-200 dark:border-dark-700/60 shrink-0 text-xs">
              <button
                type="button"
                onClick={() => setFilterSuivis(false)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  !filterSuivis
                    ? 'bg-white dark:bg-dark-900 text-primary-700 dark:text-primary-300 shadow-xs'
                    : 'text-slate-600 dark:text-dark-300 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Afficher tous les incubés de l'annuaire"
              >
                Tous ({allIncubesCountForPromo})
              </button>
              <button
                type="button"
                onClick={() => setFilterSuivis(true)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                  filterSuivis
                    ? 'bg-primary-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-dark-300 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Afficher uniquement les incubés de mon portefeuille"
              >
                Mes Incubés ({myIncubesCount})
              </button>
            </div>
          )}

          {/* Filtre Promotion */}
          <div className="relative flex items-center shrink-0">
            <div className="absolute left-3 pointer-events-none text-primary-500 flex items-center">
              <GraduationCap size={15} />
            </div>
            <select
              value={selectedPromotionFilter}
              onChange={(e) => setSelectedPromotionFilter(e.target.value)}
              className={`input pl-8 pr-7 py-2 text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-all border ${
                selectedPromotionFilter !== 'all'
                  ? 'border-primary-500 bg-primary-50/70 dark:bg-primary-950/40 text-primary-800 dark:text-primary-200 ring-2 ring-primary-500/20'
                  : 'border-slate-200 dark:border-dark-700 bg-white dark:bg-dark-900 text-slate-800 dark:text-dark-100'
              }`}
              title="Filtrer par promotion"
            >
              <option value="all">Toutes les promos</option>
              {promotionsList.map((p) => (
                <option key={p.id || p.nom} value={p.nom}>
                  {p.nom}
                </option>
              ))}
            </select>
          </div>

          {/* Filtre État Plan d'Action */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="relative flex items-center">
              <div className="absolute left-3 pointer-events-none text-primary-500 flex items-center">
                <ClipboardList size={15} />
              </div>
              <select
                value={selectedPlanStatus}
                onChange={(e) => setSelectedPlanStatus(e.target.value)}
                className={`input pl-8 pr-7 py-2 text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-all border ${
                  selectedPlanStatus !== 'all'
                    ? 'border-primary-500 bg-primary-50/70 dark:bg-primary-950/40 text-primary-800 dark:text-primary-200 ring-2 ring-primary-500/20'
                    : 'border-slate-200 dark:border-dark-700 bg-white dark:bg-dark-900 text-slate-800 dark:text-dark-100'
                }`}
                title="Filtrer par état du plan d'action"
              >
                <option value="all">Tous les plans</option>
                <option value="En cours">🔔 En cours ({planCounts.enCours})</option>
                <option value="Atteint">✅ Atteint ({planCounts.atteint})</option>
                <option value="Non atteint">❌ Non atteint ({planCounts.nonAtteint})</option>
              </select>
            </div>
            {selectedPlanStatus !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedPlanStatus('all')}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-slate-200 dark:border-dark-700 transition-colors"
                title="Réinitialiser le filtre plan d'action"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            className="btn btn-secondary flex items-center gap-2 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 font-semibold"
            onClick={() => setShowExcelModal(true)}
            title="Importer une liste complète d'incubés depuis un fichier Excel"
          >
            <FileSpreadsheet size={16} className="text-emerald-500" />
            <span>Importer Excel</span>
          </button>
          <button 
            className="btn btn-primary shrink-0" 
            onClick={() => {
              setPhotoFile(null);
              setPreviewUrl(null);
              setShowModal(true);
            }}
          >
            <Plus size={16} /> Nouvel incubé
          </button>
        </div>
      </div>

      {/* Liste / Grille des Incubés */}
      {loading ? (
        <div className="text-center py-20 text-slate-500 dark:text-dark-400">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <Users size={48} className="mx-auto text-slate-400 dark:text-dark-500 mb-4" />
          <h3 className="text-lg font-bold text-slate-700 dark:text-dark-300">Aucun incubé trouvé</h3>
          <p className="text-slate-500 dark:text-dark-400 text-sm mt-1">
            {selectedPlanStatus !== 'all' ? (
              `Aucun incubé n'a d'objectif dans le plan d'action avec l'état "${selectedPlanStatus}".`
            ) : isSuperAdmin && selectedAdminFilter !== 'all' ? (
              selectedAdminFilter === 'unassigned'
                ? "Tous les incubés sont actuellement assignés à un accompagnateur."
                : `Aucun incubé n'est actuellement assigné à ${
                    adminsList.find(a => String(a.id) === String(selectedAdminFilter))
                      ? (adminsList.find(a => String(a.id) === String(selectedAdminFilter)).prenom + ' ' + adminsList.find(a => String(a.id) === String(selectedAdminFilter)).nom)
                      : 'cet accompagnateur'
                  }.`
            ) : filterSuivis ? (
              'Aucun incubé ne correspond à votre portefeuille de suivi'
            ) : (
              'Ajoutez votre premier incubé pour commencer'
            )}
          </p>
          {selectedPlanStatus !== 'all' ? (
            <button
              onClick={() => setSelectedPlanStatus('all')}
              className="btn btn-secondary btn-sm mt-4 font-bold text-primary-600 inline-flex items-center gap-1.5"
            >
              <RotateCw size={14} /> Voir tous les plans ({incubes.length})
            </button>
          ) : isSuperAdmin && selectedAdminFilter !== 'all' ? (
            <button
              onClick={() => setSelectedAdminFilter('all')}
              className="btn btn-secondary btn-sm mt-4 font-bold text-primary-600 inline-flex items-center gap-1.5"
            >
              <Users size={14} /> Voir tous les incubés ({incubes.length})
            </button>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filtered.map((inc, idx) => {
            const followUp = getFollowUpStatus(inc);
            const planStatut = getPlanStatus(inc);

            return (
              <div 
                key={inc.id} 
                className="card cursor-pointer hover:scale-[1.01] hover:shadow-xl transition-all relative overflow-hidden flex flex-col justify-between"
                onClick={() => navigate(`/incube/${inc.id}`)}
              >
                <div>
                  <div className="flex items-start gap-3.5">
                    <div className="relative w-12 h-12 shrink-0">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${AVATAR_COLORS[idx % AVATAR_COLORS.length]} flex items-center justify-center text-white font-bold text-sm shadow-md absolute inset-0`}>
                        {getInitials(inc.nom_incube)}
                      </div>
                      {inc.photo_path && (
                        <img 
                          src={getPhotoUrl(inc.photo_path)} 
                          alt={inc.nom_incube} 
                          className="w-12 h-12 rounded-xl object-cover shadow-md border border-slate-200 dark:border-dark-700/60 relative z-10" 
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm truncate" title={inc.nom_incube}>{inc.nom_incube}</h3>
                      <p className="text-slate-500 dark:text-dark-400 text-xs truncate" title={inc.raison_sociale}>{inc.raison_sociale || '—'}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`badge ${PHASE_COLORS[inc.phase_projet] || 'badge-gray'}`}>
                        {inc.phase_projet}
                      </span>
                      {inc.compteUtilisateur ? (
                        inc.compteUtilisateur.actif ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20" title="Accès portail actif">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Actif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 ring-1 ring-amber-400/30 animate-pulse" title="Compte portail en attente d'activation">
                            <Clock size={10} /> En attente
                          </span>
                        )
                      ) : inc.email ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/30" title="Compte portail non encore activé">
                          <Clock size={10} /> Non activé
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <div className="min-w-0 truncate"><span className="text-slate-500 dark:text-dark-500">Statut :</span> <span className="text-slate-700 dark:text-dark-300 font-medium">{inc.statut_juridique}</span></div>
                    <div className="min-w-0 truncate"><span className="text-slate-500 dark:text-dark-500">N° PP :</span> <span className="text-slate-700 dark:text-dark-300 font-medium">{inc.pp_numero || '—'}</span></div>
                    <div className="min-w-0 truncate">
                      <span className="text-slate-500 dark:text-dark-500">Accomp. :</span>{' '}
                      <span className="text-slate-700 dark:text-dark-300 font-medium truncate inline-block max-w-full" title={inc.accompagnateurAdmin ? `${inc.accompagnateurAdmin.prenom} ${inc.accompagnateurAdmin.nom}` : (inc.accompagnateur || 'Non assigné')}>
                        {inc.accompagnateurAdmin
                          ? `${inc.accompagnateurAdmin.prenom} ${inc.accompagnateurAdmin.nom}`
                          : (inc.accompagnateur || 'Non assigné')}
                      </span>
                    </div>
                    <div className="min-w-0 truncate"><span className="text-slate-500 dark:text-dark-500">Début :</span> <span className="text-slate-700 dark:text-dark-300 font-medium">{inc.date_demarrage ? new Date(inc.date_demarrage).toLocaleDateString('fr-FR') : '—'}</span></div>
                    {inc.promotion && (
                      <div className="col-span-1 min-w-0 truncate">
                        <span className="text-slate-500 dark:text-dark-500">Promo :</span>{' '}
                        <span className="inline-flex items-center gap-1 font-bold text-primary-600 dark:text-primary-400">
                          <GraduationCap size={12} />
                          {inc.promotion}
                        </span>
                      </div>
                    )}
                    {inc.secteur_activite && (
                      <div className={`${inc.promotion ? "col-span-1" : "col-span-2"} min-w-0 truncate`}>
                        <span className="text-slate-500 dark:text-dark-500">Secteur :</span>{' '}
                        <span className="text-slate-700 dark:text-dark-300 font-medium truncate inline-block max-w-[130px]" title={inc.secteur_activite}>
                          {inc.secteur_activite}
                        </span>
                      </div>
                    )}
                    {inc.email && (
                      <div className="col-span-2 pt-1 border-t border-slate-100 dark:border-dark-800/60 text-[11px] text-slate-500 dark:text-dark-400 flex items-center gap-1.5 min-w-0 truncate">
                        <span>📧</span> <span className="font-mono text-slate-700 dark:text-dark-200 truncate">{inc.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Alerte et bouton d'activation rapide sur la carte pour les comptes en attente */}
                  {(inc.compteUtilisateur && !inc.compteUtilisateur.actif) && (
                    <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 dark:bg-amber-950/30 dark:border-amber-800/50 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0 shrink-0">
                        <Clock size={13} className="text-amber-500 shrink-0 animate-pulse" />
                        <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 whitespace-nowrap">
                          Accès en attente
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            toast.loading(`Activation des accès pour ${inc.nom_incube}...`, { id: `act-${inc.id}` });
                            const res = await api.post(`/incubes/${inc.id}/activer-compte`);
                            toast.success(res.data?.message || 'Compte activé et accès envoyés par email !', { id: `act-${inc.id}` });
                            load();
                          } catch (err) {
                            toast.error(err.response?.data?.message || "Erreur lors de l'activation", { id: `act-${inc.id}` });
                          }
                        }}
                        className="btn btn-primary btn-sm !py-1 !px-2.5 text-[11px] font-bold flex items-center gap-1 shadow-md shadow-primary-500/20 hover:scale-105 transition-transform whitespace-nowrap shrink-0 ml-auto sm:ml-0"
                        title="Valider immédiatement ce compte et expédier les accès par email"
                      >
                        <KeyRound size={12} />
                        <span>Valider & Envoyer</span>
                      </button>
                    </div>
                  )}
                  {/* Email présent mais aucun compte lié : activation rapide possible */}
                  {(inc.email && !inc.compteUtilisateur) && (
                    <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 dark:bg-amber-950/30 dark:border-amber-800/50 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0 shrink-0">
                        <Clock size={13} className="text-amber-500 shrink-0 animate-pulse" />
                        <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 whitespace-nowrap">
                          Compte non activé
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            toast.loading(`Activation des accès pour ${inc.nom_incube}...`, { id: `act-${inc.id}` });
                            const res = await api.post(`/incubes/${inc.id}/activer-compte`);
                            toast.success(res.data?.message || 'Compte activé et accès envoyés par email !', { id: `act-${inc.id}` });
                            load();
                          } catch (err) {
                            toast.error(err.response?.data?.message || "Erreur lors de l'activation", { id: `act-${inc.id}` });
                          }
                        }}
                        className="btn btn-primary btn-sm !py-1 !px-2.5 text-[11px] font-bold flex items-center gap-1 shadow-md shadow-primary-500/20 hover:scale-105 transition-transform whitespace-nowrap shrink-0 ml-auto sm:ml-0"
                        title="Créer le compte portail et envoyer les accès par email"
                      >
                        <KeyRound size={12} />
                        <span>Activer & Envoyer</span>
                      </button>
                    </div>
                  )}
                  {/* Si aucun email n'est renseigné pour cet incubé */}
                  {!inc.email && (
                    <div className="mt-3 p-2.5 rounded-xl bg-slate-100 dark:bg-dark-800/90 border border-slate-200 dark:border-dark-700 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0 shrink-0">
                        <AlertCircle size={13} className="text-amber-500 shrink-0" />
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-dark-300 whitespace-nowrap">
                          Email manquant
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEmailModalIncube(inc);
                          setInputEmail('');
                        }}
                        className="btn btn-secondary btn-sm !py-1 !px-2.5 text-[11px] font-bold text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/40 border-primary-500/40 shrink-0 flex items-center gap-1 shadow-xs hover:scale-105 transition-transform whitespace-nowrap ml-auto sm:ml-0"
                        title="Renseigner une adresse e-mail pour activer le compte"
                      >
                        <Mail size={12} />
                        <span>Ajouter email & Activer</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-dark-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    {renderNotificationIcon(inc, planStatut, followUp)}
                    {(planStatut === 'En cours' || !planStatut) && (
                      !followUp.hasSuivi ? (
                        <span
                          className="text-xs font-medium text-slate-400 dark:text-dark-500"
                          title="Aucun jour de suivi enregistré dans le plan d'action"
                        >
                          Aucun suivi
                        </span>
                      ) : (
                        <span
                          className={`text-xs font-bold ${
                            followUp.isLate
                              ? 'text-rose-600 dark:text-rose-400 font-black animate-pulse'
                              : 'text-slate-600 dark:text-dark-300'
                          }`}
                          title={`Dernier accompagnement : il y a ${followUp.days} jour(s)`}
                        >
                          {followUp.days === 0 ? "Aujourd'hui" : `${followUp.days} j`}
                        </span>
                      )
                    )}

                    {/* Badge État Plan d'Action */}
                    {planStatut && (
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full border shadow-2xs ${
                          planStatut === 'Atteint' || planStatut === 'Effectué'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                            : planStatut === 'En cours'
                            ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30'
                            : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
                        }`}
                        title={`Plan d'action : ${planStatut}`}
                      >
                        {(planStatut === 'Atteint' || planStatut === 'Effectué') && '✅ Atteint'}
                        {planStatut === 'En cours' && '🔔 En cours'}
                        {planStatut === 'Non atteint' && '❌ Non atteint'}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-primary-600 dark:text-primary-400 font-bold hover:underline shrink-0">
                    Consulter &rarr;
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Création */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal slide-up max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">Nouvel incubé</h3>
              <button className="btn btn-secondary btn-icon btn-sm" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body space-y-4">
                {/* Remplissage rapide depuis un fichier Excel */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                  <div className="flex items-center gap-2.5">
                    <FileSpreadsheet size={18} className="text-emerald-500 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Remplir les champs avec un fichier Excel ?</p>
                      <p className="text-[11px] text-slate-500 dark:text-dark-400">Importe les données directement dans ce formulaire</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-1 px-2.5 shrink-0"
                    onClick={() => setShowFormExcelModal(true)}
                  >
                    Remplir depuis Excel
                  </button>
                </div>
                
                {/* Section Téléchargement Photo */}
                <div className="space-y-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-900/60 border border-slate-200 dark:border-navy-700/60">
                  <div className="flex items-center gap-4">
                    <div className="relative group shrink-0">
                      {previewUrl ? (
                        <img 
                          src={previewUrl} 
                          alt="Aperçu" 
                          className="w-16 h-16 rounded-xl object-cover border-2 border-primary-500 shadow-md"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-slate-200 dark:bg-navy-800 border-2 border-dashed border-slate-300 dark:border-navy-600 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                          <Camera size={22} />
                          <span className="text-[9px] mt-1 font-semibold">Photo</span>
                        </div>
                      )}
                      {/* Overlay pour agrandir l'image (seulement si une image existe) */}
                      {previewUrl && (
                        <button 
                          type="button"
                          onClick={() => setEnlargedPhoto(previewUrl)}
                          className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          title="Agrandir la photo"
                        >
                          <Eye size={18} className="text-white" />
                        </button>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Photo du porteur / incubé</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Importer un fichier image (JPG, PNG, WebP)</p>
                      <label className="inline-flex items-center gap-1.5 mt-1.5 px-3 py-1 rounded-lg bg-primary-500/15 hover:bg-primary-500/25 text-primary-500 dark:text-primary-400 text-xs font-semibold cursor-pointer transition-colors">
                        <Upload size={12} />
                        {previewUrl ? 'Changer la photo' : 'Importer une photo'}
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setPhotoFile(file);
                              setPreviewUrl(URL.createObjectURL(file));
                            }
                          }} 
                        />
                      </label>
                    </div>

                    {previewUrl && (
                      <button 
                        type="button" 
                        onClick={() => { setPhotoFile(null); setPreviewUrl(null); setForm({ ...form, photo_path: '' }); }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Supprimer la photo sélectionnée"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="label">Nom de l'incubé *</label><input className="input" placeholder="Ex: Mohamed Alami" value={form.nom_incube} onChange={e => setForm({ ...form, nom_incube: e.target.value })} required /></div>
                  <div><label className="label">N° PP</label><input className="input" placeholder="Ex: PP-2024-001" value={form.pp_numero} onChange={e => setForm({ ...form, pp_numero: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">📧 Adresse Email (pour RDV & notifications)</label>
                    <input 
                      type="email" 
                      className="input" 
                      placeholder="Ex: m.alami@gmail.com" 
                      value={form.email || ''} 
                      onChange={e => setForm({ ...form, email: e.target.value })} 
                    />
                  </div>
                  <div>
                    <label className="label">📞 N° Téléphone</label>
                    <input 
                      type="tel" 
                      className="input" 
                      placeholder="Ex: 06 12 34 56 78" 
                      value={form.telephone || ''} 
                      onChange={e => setForm({ ...form, telephone: e.target.value })} 
                    />
                  </div>
                </div>
                <div><label className="label">Raison sociale</label><input className="input" placeholder="Ex: BioTech Solutions SARL" value={form.raison_sociale} onChange={e => setForm({ ...form, raison_sociale: e.target.value })} /></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="label">Phase du projet</label>
                    <select className="input" value={form.phase_projet} onChange={e => setForm({ ...form, phase_projet: e.target.value })}>
                      {PHASE_OPTS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div><label className="label">Statut juridique</label>
                    <select
                      className="input"
                      value={STATUT_OPTS.includes(form.statut_juridique) ? form.statut_juridique : (form.statut_juridique ? 'Autre' : '')}
                      onChange={(e) => {
                        if (e.target.value === 'Autre') {
                          setForm(prev => ({ ...prev, statut_juridique: '' }));
                        } else {
                          setForm(prev => ({ ...prev, statut_juridique: e.target.value }));
                        }
                      }}
                    >
                      <option value="" disabled>-- Sélectionner --</option>
                      {STATUT_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {(!STATUT_OPTS.includes(form.statut_juridique) && form.statut_juridique !== undefined) || form.statut_juridique === 'Autre' ? (
                      <input
                        type="text"
                        className="input mt-2"
                        placeholder="Spécifiez le statut juridique"
                        value={STATUT_OPTS.includes(form.statut_juridique) ? '' : form.statut_juridique}
                        onChange={e => setForm({ ...form, statut_juridique: e.target.value })}
                        autoFocus
                      />
                    ) : null}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Situation familiale</label>
                    <select
                      className="input"
                      value={form.situation_familiale}
                      onChange={e => setForm({ ...form, situation_familiale: e.target.value })}
                    >
                      {SITUATION_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Date de démarrage</label>
                    <input
                      type="date"
                      className="input"
                      value={form.date_demarrage}
                      onChange={e => setForm({ ...form, date_demarrage: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Promotion */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="label !mb-0 flex items-center gap-1.5">
                        <GraduationCap size={14} className="text-primary-500" />
                        Promotion
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowAddPromo(!showAddPromo)}
                        className="text-[11px] text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-0.5 font-semibold"
                        title="Ajouter une promotion"
                      >
                        <Plus size={11} />
                        {showAddPromo ? 'Fermer' : 'Nouvelle promo'}
                      </button>
                    </div>

                    {showAddPromo && (
                      <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-primary-500/10 border border-primary-500/30 mb-2">
                        <input
                          type="text"
                          className="input text-xs !py-1 !px-2 flex-1 bg-white dark:bg-dark-900"
                          placeholder="Ex: Promotion 3..."
                          value={newPromoName}
                          onChange={(e) => setNewPromoName(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddPromotion();
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleAddPromotion}
                          disabled={creatingPromo || !newPromoName.trim()}
                          className="btn btn-primary text-xs !py-1 !px-2.5 shrink-0"
                        >
                          {creatingPromo ? '...' : 'Ajouter'}
                        </button>
                      </div>
                    )}

                    <select
                      className="input"
                      value={form.promotion || ''}
                      onChange={e => setForm({ ...form, promotion: e.target.value })}
                    >
                      <option value="">— Sélectionner une promotion —</option>
                      {promotionsList.map((p) => (
                        <option key={p.id || p.nom} value={p.nom}>
                          {p.nom}
                        </option>
                      ))}
                      {form.promotion && !promotionsList.some(p => p.nom === form.promotion) && (
                        <option value={form.promotion}>{form.promotion}</option>
                      )}
                    </select>
                  </div>

                  {/* Secteur d'activité */}
                  <div>
                    <label className="label">Secteur d'activité</label>
                    <select
                      className="input"
                      value={
                        SECTEURS_ACTIVITE.includes(form.secteur_activite)
                          ? form.secteur_activite
                          : (form.secteur_activite ? 'Autre' : '')
                      }
                      onChange={(e) => {
                        if (e.target.value === 'Autre') {
                          setIsCustomSecteur(true);
                          setForm(prev => ({ ...prev, secteur_activite: '' }));
                        } else {
                          setIsCustomSecteur(false);
                          setForm(prev => ({ ...prev, secteur_activite: e.target.value }));
                        }
                      }}
                    >
                      <option value="">— Sélectionner un secteur —</option>
                      {SECTEURS_ACTIVITE.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                      <option value="Autre">Autre (préciser)...</option>
                    </select>
                    {(isCustomSecteur || (form.secteur_activite && !SECTEURS_ACTIVITE.includes(form.secteur_activite))) && (
                      <input
                        type="text"
                        className="input mt-2"
                        placeholder="Précisez le secteur d'activité..."
                        value={form.secteur_activite || ''}
                        onChange={e => setForm({ ...form, secteur_activite: e.target.value })}
                        autoFocus
                      />
                    )}
                  </div>
                </div>
                <div>
                  {isSuperAdmin ? (
                    <div>
                      <label className="label">Accompagnateur responsable *</label>
                      <select
                        className="input"
                        value={form.admin_id}
                        onChange={e => {
                          const selected = adminsList.find(a => String(a.id) === e.target.value);
                          setForm({
                            ...form,
                            admin_id: e.target.value,
                            accompagnateur: selected ? `${selected.prenom} ${selected.nom}` : '',
                          });
                        }}
                      >
                        <option value="">Sélectionner un accompagnateur</option>
                        {adminsList
                          .filter(a => a.role !== 'incube' && a.role !== 'super_admin' && a.id !== 1 && !a.nom?.toLowerCase().includes('administrateur') && !a.email?.toLowerCase().startsWith('admin@'))
                          .map(a => (
                          <option key={a.id} value={a.id}>
                            {a.prenom ? a.prenom.charAt(0).toUpperCase() + a.prenom.slice(1).toLowerCase() : ''} {a.nom ? a.nom.toUpperCase() : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="label">Accompagnateur</label>
                      <input className="input" value={form.accompagnateur || `${user?.prenom} ${user?.nom}`} disabled />
                    </div>
                  )}
                </div>

                {/* Informations sur l'activation — la case à cocher est supprimée : tout compte est inactif à la création */}
                <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-dark-800/60 border border-slate-200 dark:border-dark-700/60 flex items-start gap-3">
                  <div className="mt-0.5 w-7 h-7 rounded-lg bg-primary-500/10 flex items-center justify-center shrink-0">
                    <KeyRound size={14} className="text-primary-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-white">
                      Activation des accès différée
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-dark-400 mt-0.5 leading-relaxed">
                      Le compte portail sera créé en statut <strong>« En attente »</strong>.
                      Vous pourrez l'activer et envoyer les identifiants à tout moment depuis la fiche de l'incubé.
                    </p>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary"><Plus size={16} /> Créer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale d'importation en masse de tous les incubés avec leurs détails */}
      <ExcelGlobalImportModal
        isOpen={showExcelModal}
        onClose={() => setShowExcelModal(false)}
        onImportCompleted={load}
      />

      {/* Modale pour pré-remplir le formulaire de création d'un incubé */}
      <ExcelImportModal
        isOpen={showFormExcelModal}
        onClose={() => setShowFormExcelModal(false)}
        title="Remplir le formulaire depuis Excel"
        description="Choisissez un fichier Excel pour pré-remplir instantanément les champs du formulaire."
        templateType="incube"
        fillSingle={true}
        onImport={handleFillFormFromExcel}
      />

      {/* Modale d'ajout d'e-mail et activation immédiate pour incubés sans e-mail */}
      {emailModalIncube && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-navy-950/60 dark:bg-black/80 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setEmailModalIncube(null)}>
          <div className="w-full max-w-md bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-3xl p-6 shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-700/60 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center">
                  <Mail size={16} />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Ajouter un e-mail & Activer</h3>
              </div>
              <button type="button" onClick={() => setEmailModalIncube(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!inputEmail || !inputEmail.trim()) {
                toast.error("Veuillez saisir une adresse e-mail valide");
                return;
              }
              setActivatingEmail(true);
              try {
                const res = await api.post(`/incubes/${emailModalIncube.id}/activer-compte`, { email: inputEmail.trim() });
                toast.success(res.data?.message || 'E-mail enregistré, compte activé et accès envoyés !');
                setEmailModalIncube(null);
                load();
              } catch (err) {
                toast.error(err.response?.data?.message || "Erreur lors de l'activation");
              } finally {
                setActivatingEmail(false);
              }
            }} className="space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-dark-800/60 border border-slate-200 dark:border-dark-700/60 text-xs">
                <p className="text-slate-500 dark:text-dark-400">Porteur concerné :</p>
                <p className="font-bold text-slate-800 dark:text-dark-100 text-sm mt-0.5">{emailModalIncube.nom_incube}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{emailModalIncube.raison_sociale || 'Projet d\'incubation'}</p>
              </div>

              <p className="text-xs text-slate-600 dark:text-dark-300 leading-relaxed">
                Ce porteur n'avait pas encore d'e-mail enregistré. Indiquez son e-mail professionnel pour lui créer son compte d'accès et lui envoyer son mot de passe temporaire :
              </p>

              <div>
                <label className="label text-xs font-bold">Adresse e-mail du porteur *</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-3 text-slate-400 pointer-events-none" />
                  <input
                    type="email"
                    required
                    autoFocus
                    placeholder="ex: salima.aghriss@gmail.com"
                    value={inputEmail}
                    onChange={e => setInputEmail(e.target.value)}
                    className="input pl-10 !text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-dark-800">
                <button type="button" onClick={() => setEmailModalIncube(null)} className="btn btn-secondary text-xs">
                  Annuler
                </button>
                <button type="submit" disabled={activatingEmail} className="btn btn-primary text-xs font-bold flex items-center gap-1.5 shadow-md shadow-primary-500/20">
                  <KeyRound size={14} />
                  {activatingEmail ? "Activation en cours..." : "Enregistrer & Envoyer accès"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
      {/* MODAL POUR AGRANDIR LA PHOTO */}
      {enlargedPhoto && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            {/* Bouton Fermer */}
            <button
              onClick={() => setEnlargedPhoto(null)}
              className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
              title="Fermer"
            >
              <X size={28} />
            </button>
            
            {/* L'image agrandie */}
            <img 
              src={enlargedPhoto} 
              alt="Photo de l'incubé" 
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border-4 border-white/10"
            />
          </div>
        </div>
      )}
    </div>
  );
}
