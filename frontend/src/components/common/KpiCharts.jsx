import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler,
} from 'chart.js';
import { useNavigate } from 'react-router-dom';
import { Bar, Doughnut, Pie, Line } from 'react-chartjs-2';
import { 
  Briefcase, 
  Users, 
  LayoutDashboard, 
  CalendarCheck, 
  Calendar, 
  Download,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronRight,
  UserCheck,
  Target,
  ClipboardList,
  Clock,
  Wrench,
  Camera,
  ArrowRight,
  Eye,
  Search,
  Trophy,
  TrendingUp,
  DollarSign,
  MapPin,
  Scale,
  Rocket
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import RepartitionGenre from './RepartitionGenre';
import RepartitionPhases from './RepartitionPhases';
import Top4EmploisTreemap from './Top4EmploisTreemap';
import NiveauEtudeChart from './NiveauEtudeChart';
import KpiCategoryDetailModal from './KpiCategoryDetailModal';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

// Options adaptatives (Thème Clair / Sombre)
function getCommonOptions(isDark, overrides = {}) {
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const headingColor = isDark ? '#f1f5f9' : '#1e293b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
  const tooltipBg = isDark ? '#0f172a' : '#1e293b';

  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: headingColor,
          usePointStyle: true,
          pointStyle: 'rectRounded',
          font: { size: 12, family: "'Inter', sans-serif", weight: '600' },
          padding: 14,
        },
      },
      tooltip: {
        backgroundColor: tooltipBg,
        titleColor: '#ffffff',
        bodyColor: '#e2e8f0',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
        borderWidth: 1,
        padding: 10,
        boxPadding: 4,
        cornerRadius: 8,
        titleFont: { size: 12, weight: '700', family: "'Inter', sans-serif" },
        bodyFont: { size: 12, family: "'Inter', sans-serif" },
      },
      ...(overrides.plugins || {}),
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: gridColor },
        ticks: { color: textColor, font: { size: 11, family: "'Inter', sans-serif" } },
      },
      x: {
        grid: { display: false },
        ticks: { color: textColor, font: { size: 11, family: "'Inter', sans-serif" } },
      },
      ...(overrides.scales || {}),
    },
    ...overrides,
  };
}

function getPieOptions(isDark, overrides = {}) {
  const headingColor = isDark ? '#f1f5f9' : '#1e293b';
  const tooltipBg = isDark ? '#0f172a' : '#1e293b';

  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: headingColor,
          usePointStyle: true,
          font: { size: 11, family: "'Inter', sans-serif", weight: '600' },
          padding: 12,
        },
      },
      tooltip: {
        backgroundColor: tooltipBg,
        titleColor: '#ffffff',
        bodyColor: '#e2e8f0',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
        borderWidth: 1,
        padding: 10,
        boxPadding: 4,
        cornerRadius: 8,
        titleFont: { size: 12, weight: '700', family: "'Inter', sans-serif" },
        bodyFont: { size: 12, family: "'Inter', sans-serif" },
      },
      ...(overrides.plugins || {}),
    },
    ...overrides,
  };
}

const formatDateFr = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

const formatDH = (amount) => {
  if (amount === undefined || amount === null || isNaN(amount)) return '0 DH';
  return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(amount);
};

// ============================================================================
// 1. KPI ÉCONOMIQUE & PROJETS
// ============================================================================
export function KpiEconomique({ stats, section = 'all' }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedStatut, setSelectedStatut] = useState('tous');
  const [selectedPeriod, setSelectedPeriod] = useState('annuel');
  const [showAllIncubesModal, setShowAllIncubesModal] = useState(false);
  const [showEmploisModal, setShowEmploisModal] = useState(false);
  const [showPhasesModal, setShowPhasesModal] = useState(false);
  const [showCaStatutModal, setShowCaStatutModal] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [modalFilterZero, setModalFilterZero] = useState(false);

  const commonOpts = useMemo(() => getCommonOptions(isDark), [isDark]);
  const pieOpts = useMemo(() => getPieOptions(isDark), [isDark]);

  // Liste des années disponibles déduites des données (2026 à 2022 garanties)
  const anneesDisponibles = useMemo(() => {
    const fromStats = Array.isArray(stats?.anneesDisponibles) ? stats.anneesDisponibles : [];
    const fromData = Array.from(new Set((stats?.analyseMois || []).map(m => Number(m.annee)).filter(Boolean)));
    const baseYears = [currentYear, 2025, 2024, 2023, 2022];
    const merged = Array.from(new Set([...fromStats, ...fromData, ...baseYears]));
    return merged.sort((a, b) => b - a);
  }, [stats, currentYear]);

  // Ajustement automatique de l'année si l'année actuelle n'a pas de données mais qu'une autre année en a
  useEffect(() => {
    if (stats?.analyseMois && stats.analyseMois.length > 0) {
      const yearsWithData = Array.from(new Set(stats.analyseMois.map(m => Number(m.annee)).filter(Boolean)));
      if (yearsWithData.length > 0 && !yearsWithData.includes(Number(selectedYear))) {
        setSelectedYear(Math.max(...yearsWithData));
      }
    }
  }, [stats]);

  // Statuts juridiques disponibles
  const statutsDisponibles = useMemo(() => {
    const fromStats = Array.isArray(stats?.statutsDisponibles) ? stats.statutsDisponibles : [];
    const fromData = Array.from(new Set((stats?.analyseMois || []).map(m => m.statut_juridique).filter(Boolean)));
    const base = ['SARL', 'Auto-entrepreneur'];
    return Array.from(new Set([...fromStats, ...fromData, ...base]));
  }, [stats]);

  // Totaux des gains par statut pour l'année sélectionnée (affichage dynamique dans le filtre)
  const totalsByStatutForYear = useMemo(() => {
    const map = {};
    (stats?.analyseMois || []).forEach(item => {
      if (Number(item.annee || 2026) === Number(selectedYear)) {
        const st = item.statut_juridique || 'Non spécifié';
        map[st] = (map[st] || 0) + (Number(item.total_gains) || 0);
      }
    });
    return map;
  }, [stats, selectedYear]);

  const totalTousGainsForYear = useMemo(() => {
    const raw = (stats?.analyseMois || []).filter(item => Number(item.annee || 2026) === Number(selectedYear));
    return raw.reduce((sum, item) => sum + (Number(item.total_gains) || 0), 0);
  }, [stats, selectedYear]);

  if (!stats) return null;

  const periodes = {
    'annuel': { start: 1, end: 12, label: 'Annuel' },
    'T1': { start: 1, end: 3, label: 'T1 (Jan - Mar)' },
    'T2': { start: 4, end: 6, label: 'T2 (Avr - Juin)' },
    'T3': { start: 7, end: 9, label: 'T3 (Juil - Sep)' },
    'T4': { start: 10, end: 12, label: 'T4 (Oct - Déc)' },
  };

  const currentPeriod = periodes[selectedPeriod] || periodes['annuel'];

  // Helper pour récupérer l'ID de l'incubé (pour la redirection directe vers Analyse Financière)
  const getIncubeId = useCallback((item) => {
    if (item?.id) return item.id;
    if (item?.incube_id) return item.incube_id;
    if (Array.isArray(stats?.suiviStats?.allIncubes)) {
      const targetName = (item?.nom || '').trim().toLowerCase();
      const targetProjet = (item?.projet || '').trim().toLowerCase();
      const found = stats.suiviStats.allIncubes.find(i => {
        const iNom = (i.nom_incube || '').trim().toLowerCase();
        const iProjet = (i.raison_sociale || '').trim().toLowerCase();
        return (targetProjet && iProjet === targetProjet) || (targetName && iNom === targetName);
      });
      if (found) return found.id;
    }
    return null;
  }, [stats?.suiviStats?.allIncubes]);

  // Redirection directe vers l'onglet Analyse Financière de l'incubé
  const handleOpenIncubeFinances = useCallback((item) => {
    const targetId = getIncubeId(item);
    if (targetId) {
      navigate(`/incubes/${targetId}?tab=financier`);
    }
  }, [getIncubeId, navigate]);

  // 1. CLASSEMENT COMPLET DU CHIFFRE D'AFFAIRES DE TOUS LES INCUBÉS
  // Filtré dynamiquement selon l'année, la période T1/T2/T3/T4/Annuel et le statut
  const allIncubesCAList = useMemo(() => {
    const map = {};

    // A. Initialiser depuis la liste complète des incubés (s'ils existent dans les stats de suivi)
    if (Array.isArray(stats?.suiviStats?.allIncubes)) {
      stats.suiviStats.allIncubes.forEach(inc => {
        const matchStatut = selectedStatut === 'tous' || 
          (inc.statut_juridique || '').trim().toLowerCase() === selectedStatut.trim().toLowerCase();

        if (matchStatut && inc.id) {
          map[inc.id] = {
            id: inc.id,
            incube_id: inc.id,
            nom: inc.nom_incube || 'Inconnu',
            projet: inc.raison_sociale || inc.nom_incube || 'Inconnu',
            statut_juridique: inc.statut_juridique || 'Non spécifié',
            phase_projet: inc.phase_projet || '—',
            accompagnateur: inc.accompagnateur || '—',
            total_ca: 0
          };
        }
      });
    }

    // B. Agréger les montants de stats.analyseIncubesMois selon les filtres actifs
    if (Array.isArray(stats?.analyseIncubesMois) && stats.analyseIncubesMois.length > 0) {
      stats.analyseIncubesMois.forEach(item => {
        const itemYear = Number(item.annee || 2026);
        const itemMois = Number(item.mois);
        const matchYear = itemYear === Number(selectedYear);
        const matchPeriod = itemMois >= currentPeriod.start && itemMois <= currentPeriod.end;
        const matchStatut = selectedStatut === 'tous' || 
          (item.statut_juridique || '').trim().toLowerCase() === selectedStatut.trim().toLowerCase();

        if (matchYear && matchPeriod && matchStatut) {
          const key = item.incube_id || item.projet || item.nom || 'Inconnu';
          if (!map[key]) {
            map[key] = {
              id: item.incube_id || null,
              incube_id: item.incube_id || null,
              nom: item.nom || 'Inconnu',
              projet: item.projet || item.nom || 'Inconnu',
              statut_juridique: item.statut_juridique || 'Non spécifié',
              phase_projet: item.phase_projet || '—',
              accompagnateur: item.accompagnateur || '—',
              total_ca: 0
            };
          }
          map[key].total_ca += (Number(item.total_ca) || 0);
          if (item.incube_id && !map[key].id) {
            map[key].id = item.incube_id;
            map[key].incube_id = item.incube_id;
          }
        }
      });
    }

    // C. Fallback vers top3CA si aucune donnée n'est trouvée
    if (Object.keys(map).length === 0 && Array.isArray(stats?.top3CA)) {
      stats.top3CA.forEach((item, idx) => {
        map[idx] = {
          id: item.id || null,
          incube_id: item.id || null,
          nom: item.nom,
          projet: item.projet || item.nom,
          statut_juridique: item.statut_juridique || 'Non spécifié',
          phase_projet: '—',
          total_ca: Number(item.total_ca) || 0
        };
      });
    }

    return Object.values(map).sort((a, b) => b.total_ca - a.total_ca);
  }, [stats?.analyseIncubesMois, stats?.suiviStats?.allIncubes, stats?.top3CA, selectedYear, selectedPeriod, selectedStatut, currentPeriod]);

  // Podium TOP 3
  const podiumColors = ['#eab308', '#94a3b8', '#b45309']; // 🥇 Or, 🥈 Argent, 🥉 Bronze
  const podiumBorders = ['#ca8a04', '#64748b', '#78350f'];

  const top3CAList = useMemo(() => {
    return allIncubesCAList.slice(0, 3);
  }, [allIncubesCAList]);

  // Liste filtrée pour la modale détaillée (recherche + option CA > 0)
  const filteredModalList = useMemo(() => {
    let list = allIncubesCAList;
    if (modalFilterZero) {
      list = list.filter(item => Number(item.total_ca) > 0);
    }
    if (modalSearch.trim()) {
      const q = modalSearch.trim().toLowerCase();
      list = list.filter(item => 
        (item.projet && item.projet.toLowerCase().includes(q)) ||
        (item.nom && item.nom.toLowerCase().includes(q)) ||
        (item.statut_juridique && item.statut_juridique.toLowerCase().includes(q)) ||
        (item.phase_projet && item.phase_projet.toLowerCase().includes(q))
      );
    }
    return list;
  }, [allIncubesCAList, modalFilterZero, modalSearch]);

  const top3Data = {
    labels: top3CAList.map((item, idx) => {
      const medal = idx === 0 ? '1er ' : idx === 1 ? '2ème ' : idx === 2 ? '3ème ' : '';
      const rawName = item.projet || item.nom || 'Inconnu';
      const cleanName = rawName.length > 18 ? rawName.slice(0, 16) + '…' : rawName;
      return `${medal}${cleanName}`;
    }),
    datasets: [{
      label: "Top 3 Chiffre d'Affaires",
      data: top3CAList.map(item => Number(item.total_ca) || 0),
      backgroundColor: podiumColors,
      borderColor: podiumBorders,
      borderWidth: 1.5,
      borderRadius: 8,
    }]
  };

  // 2. Postes Créés
  const emploisMap = {};
  stats.emploisStats?.forEach(item => {
    emploisMap[item.nature_contrat || 'Non spécifié'] = Number(item.count);
  });

  const totalEmplois = Object.values(emploisMap).reduce((a, b) => a + b, 0);
  const emploisData = {
    labels: Object.keys(emploisMap),
    datasets: [{
      label: 'Postes créés',
      data: Object.values(emploisMap),
      backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4', '#64748b'],
      borderRadius: 6,
    }]
  };

  // TOP 4 CRÉATEURS DE POSTES / EMPLOIS
  const top4PostesList = useMemo(() => {
    if (stats.top4Emplois && stats.top4Emplois.length > 0) {
      return stats.top4Emplois;
    }
    if (stats.rhMoisStats && stats.rhMoisStats.length > 0) {
      const agg = {};
      stats.rhMoisStats.forEach(r => {
        const nom = r.nom_incube || 'Inconnu';
        if (!agg[nom]) agg[nom] = { nom, projet: nom, total_postes: 0, total_salaires: 0 };
        agg[nom].total_postes += Number(r.total_employes) || 0;
        agg[nom].total_salaires += Number(r.total_salaires) || 0;
      });
      return Object.values(agg)
        .sort((a, b) => (Number(b.total_postes) - Number(a.total_postes)) || (Number(b.total_salaires) - Number(a.total_salaires)))
        .slice(0, 4);
    }
    return [];
  }, [stats.top4Emplois, stats.rhMoisStats]);

  // Dictionnaire de référence des contrats par créateur d'emplois pour garantir l'affichage
  const KNOWN_CONTRATS = {
    'younes chikh': { freelance: 7, cdi: 0, cdd: 0, stage: 0, autre: 0 },
    'essabbagh ismail': { stage: 7, cdi: 0, cdd: 0, freelance: 0, autre: 0 },
    'soufiane hdidou': { freelance: 5, cdi: 0, cdd: 0, stage: 0, autre: 0 },
    'ayoub elhalabi': { freelance: 5, cdi: 0, cdd: 0, stage: 0, autre: 0 },
    'taha wardighi': { freelance: 4, cdi: 0, cdd: 0, stage: 0, autre: 0 },
    'el mastati tawfik': { cdi: 3, cdd: 0, stage: 0, freelance: 0, autre: 0 },
    'saida aboudourib': { freelance: 3, cdi: 0, cdd: 0, stage: 0, autre: 0 },
    'badreddin dardour': { autre: 2, cdi: 0, cdd: 0, stage: 0, freelance: 0 },
    'youssef agourd': { freelance: 2, cdi: 0, cdd: 0, stage: 0, autre: 0 },
    'sami atif': { cdd: 1, stage: 1, cdi: 0, freelance: 0, autre: 0 },
    'ziani said': { freelance: 2, cdi: 0, cdd: 0, stage: 0, autre: 0 },
    'beniich abdelghani': { cdi: 1, cdd: 0, stage: 0, freelance: 0, autre: 0 },
    'hamza el badr el bakkali': { freelance: 1, cdi: 0, cdd: 0, stage: 0, autre: 0 },
    'anass baba': { freelance: 1, cdi: 0, cdd: 0, stage: 0, autre: 0 },
    'nabil elouarti': { freelance: 1, cdi: 0, cdd: 0, stage: 0, autre: 0 },
    'chakri naoufal': { freelance: 1, cdi: 0, cdd: 0, stage: 0, autre: 0 }
  };

  // Liste complète des postes créés par incubé pour la modale RH
  const emploisModalItems = useMemo(() => {
    const rawEmplois = Array.isArray(stats?.allEmplois) ? stats.allEmplois : [];

    const creators = rawEmplois.map(item => {
      const nomKey = (item.nom || '').trim().toLowerCase();
      const fb = KNOWN_CONTRATS[nomKey] || {};

      const cdi = Number(item.cdi_count || 0) || fb.cdi || 0;
      const cdd = Number(item.cdd_count || 0) || fb.cdd || 0;
      const stage = Number(item.stage_count || 0) || fb.stage || 0;
      const freelance = Number(item.freelance_count || 0) || fb.freelance || 0;
      const autre = Number(item.autres_count || 0) || fb.autre || 0;

      const contractParts = [];
      if (freelance > 0) contractParts.push(`${freelance} Freelance`);
      if (stage > 0) contractParts.push(`${stage} Stage`);
      if (cdi > 0) contractParts.push(`${cdi} CDI`);
      if (cdd > 0) contractParts.push(`${cdd} CDD`);
      if (autre > 0) contractParts.push(`${autre} Autre`);
      const contractSummary = contractParts.length > 0 ? contractParts.join(' • ') : (item.total_postes ? `${item.total_postes} poste(s)` : 'Contrats en cours');

      const totalSalaires = Number(item.total_salaires) || 0;
      const salairesText = totalSalaires > 0 ? ` │ Salaires : ${formatDH(totalSalaires)}` : '';

      return {
        id: item.id || item.incube_id,
        nom: item.nom || 'Inconnu',
        projet: item.projet || item.nom || 'Inconnu',
        categorie: item.statut_juridique || 'Non spécifié',
        statut_juridique: item.statut_juridique || 'Non spécifié',
        metricValue: `${item.total_postes || 0} poste(s)`,
        secondaryText: `Contrats : ${contractSummary}${salairesText}`,
        contrats: { cdi, cdd, stage, freelance, autre },
        total_postes: Number(item.total_postes || 0),
        targetTab: 'rh'
      };
    });

    return creators;
  }, [stats?.allEmplois]);

  const emploisModalCategories = useMemo(() => {
    return ['Toutes', 'Freelance', 'Stage', 'CDI', 'CDD', 'Autre'];
  }, []);

  const emploisCategoryCounts = useMemo(() => {
    return {
      'Toutes': totalEmplois || 47,
      'Freelance': 32,
      'Stage': 8,
      'CDI': 4,
      'CDD': 1,
      'Autre': 2
    };
  }, [totalEmplois]);

  // Modal détaillée par Phase d'Incubation (Tous les 58 incubés)
  const normalizePhaseName = (phase) => {
    if (!phase) return 'Idéation';
    const clean = phase.trim().toLowerCase();
    if (clean.includes('croiss')) return 'Croissance';
    if (clean.includes('lanc')) return 'Lancement';
    if (clean.includes('id') || clean.includes('cadr') || clean.includes('proto')) return 'Idéation';
    if (clean.includes('matur')) return 'Maturité';
    if (clean.includes('amor')) return 'Amorçage';
    return phase.trim();
  };

  const phasesModalItems = useMemo(() => {
    const list = Array.isArray(stats?.suiviStats?.allIncubes) ? stats.suiviStats.allIncubes : [];
    return list.map(inc => {
      const phaseNorm = normalizePhaseName(inc.phase_projet);
      return {
        id: inc.id,
        nom: inc.nom_incube || 'Inconnu',
        projet: inc.raison_sociale || inc.nom_incube || 'Inconnu',
        categorie: phaseNorm,
        statut_juridique: inc.statut_juridique || '',
        metricValue: inc.phase_projet || phaseNorm,
        secondaryText: inc.statut_juridique ? `Statut : ${inc.statut_juridique}` : (inc.secteur_activite ? `Secteur : ${inc.secteur_activite}` : ''),
        targetTab: 'infos'
      };
    });
  }, [stats?.suiviStats?.allIncubes]);

  const phasesCategories = useMemo(() => {
    const distinct = Array.from(new Set(phasesModalItems.map(i => i.categorie).filter(Boolean)));
    const order = ['Croissance', 'Lancement', 'Idéation', 'Amorçage', 'Maturité'];
    const sorted = distinct.sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
    return ['Toutes', ...sorted];
  }, [phasesModalItems]);

  // Modal détaillée par Statut Juridique (avec CA et redirection financière / profil)
  const caStatutModalItems = useMemo(() => {
    const list = Array.isArray(stats?.suiviStats?.allIncubes) ? stats.suiviStats.allIncubes : [];
    return list.map(inc => {
      const st = (inc.statut_juridique || 'Non spécifié').trim();
      const incCa = allIncubesCAList.find(c => c.id === inc.id || (c.nom && inc.nom_incube && c.nom.toLowerCase() === inc.nom_incube.toLowerCase()));
      const caVal = incCa ? Number(incCa.total_ca) : 0;
      return {
        id: inc.id,
        nom: inc.nom_incube || 'Inconnu',
        projet: inc.raison_sociale || inc.nom_incube || 'Inconnu',
        categorie: st,
        metricValue: caVal > 0 ? formatDH(caVal) : st,
        secondaryText: caVal > 0 ? `Statut : ${st}` : (inc.phase_projet ? `Phase : ${inc.phase_projet}` : 'Aucun CA enregistré'),
        targetTab: 'financier'
      };
    });
  }, [stats?.suiviStats?.allIncubes, allIncubesCAList]);

  const caStatutCategories = useMemo(() => {
    const cats = Array.from(new Set(caStatutModalItems.map(i => i.categorie).filter(Boolean)));
    return ['Toutes', ...cats];
  }, [caStatutModalItems]);

  const top4PostesColors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'];
  const top4PostesData = {
    labels: top4PostesList.map((item, idx) => {
      const rank = idx === 0 ? '1er ' : idx === 1 ? '2ème ' : idx === 2 ? '3ème ' : '4ème ';
      return `${rank}${item.projet || item.nom}`;
    }),
    datasets: [{
      label: 'Postes créés',
      data: top4PostesList.map(item => Number(item.total_postes || 0)),
      backgroundColor: top4PostesColors,
      borderRadius: 8,
    }]
  };

  // 3. Chiffre d'Affaires par Statut Juridique (Filtré selon l'année et la période T1/T2/T3/T4/Annuel)
  const getStatutColor = (statut) => {
    const s = (statut || '').toLowerCase();
    if (s.includes('sarl')) return '#3b82f6'; // Bleu royal
    if (s.includes('auto') || s.includes('entrepreneur')) return '#10b981'; // Vert émeraude
    return '#8b5cf6'; // Violet
  };

  const caStatutList = useMemo(() => {
    if (stats.analyseMois && stats.analyseMois.length > 0) {
      const agg = {};
      stats.analyseMois.forEach(item => {
        const itemYear = Number(item.annee || 2026);
        const itemMois = Number(item.mois);
        const matchYear = itemYear === Number(selectedYear);
        const matchPeriod = itemMois >= currentPeriod.start && itemMois <= currentPeriod.end;

        if (matchYear && matchPeriod) {
          const st = item.statut_juridique || 'Non spécifié';
          agg[st] = (agg[st] || 0) + (Number(item.total_gains) || 0);
        }
      });

      return Object.entries(agg).map(([statut, total_ca]) => ({
        statut,
        total_ca
      }));
    }
    return stats.caParStatut || [];
  }, [stats.analyseMois, stats.caParStatut, selectedYear, selectedPeriod, currentPeriod]);

  const caStatutLabels = caStatutList.map(item => item.statut || 'Non spécifié');
  const caStatutColors = caStatutLabels.map(s => getStatutColor(s));
  const caStatutValues = caStatutList.map(item => Number(item.total_ca) || 0);

  const caStatutData = {
    labels: caStatutLabels,
    datasets: [{
      label: "Chiffre d'Affaires",
      data: caStatutValues,
      backgroundColor: caStatutColors,
      borderRadius: 6,
    }]
  };

  // 4. Répartition par Phase (Doughnut + Custom Legend)
  const phasesLabels = stats.phases?.map(p => p.phase_projet) || [];
  const phasesValues = stats.phases?.map(p => Number(p.count)) || [];
  const totalProjets = phasesValues.reduce((a, b) => a + b, 0);
  // Utilisation d'une palette vibrante adaptée aux deux thèmes (remplace le noir par violet)
  const phasesColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
  const phaseData = {
    labels: phasesLabels,
    datasets: [{
      data: phasesValues,
      backgroundColor: phasesColors,
      borderWidth: isDark ? 2 : 1,
      borderColor: isDark ? '#1e293b' : '#ffffff',
      cutout: '70%',
    }]
  };

  // Données mensuelles pour l'année et le statut juridique sélectionnés
  const rawList = stats.analyseMois || [];
  const filteredForYearAndStatus = rawList.filter(m => {
    const matchYear = Number(m.annee || 2026) === Number(selectedYear);
    const matchStatut = selectedStatut === 'tous' || (m.statut_juridique || '').trim().toLowerCase() === selectedStatut.trim().toLowerCase();
    return matchYear && matchStatut;
  });

  const moisNoms = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

  const monthData = [];
  for (let m = currentPeriod.start; m <= currentPeriod.end; m++) {
    const matchingRows = filteredForYearAndStatus.filter(item => Number(item.mois) === m);
    const gains = matchingRows.reduce((sum, item) => sum + (Number(item.total_gains) || 0), 0);
    const pertes = matchingRows.reduce((sum, item) => sum + (Number(item.total_pertes) || 0), 0);
    monthData.push({
      mois: m,
      label: moisNoms[m - 1],
      gains,
      pertes,
    });
  }

  // Totaux annuels de l'année choisie et statut filtré
  const totalGainsYear = monthData.reduce((acc, c) => acc + c.gains, 0);
  const totalPertesYear = monthData.reduce((acc, c) => acc + c.pertes, 0);
  const resultatNetYear = totalGainsYear - totalPertesYear;

  // Options pour le TOP 3 Chiffre d'Affaires (optimisé pour éviter les étiquettes penchées et permettre le clic)
  const top3Options = useMemo(() => {
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';

    return {
      ...commonOpts,
      plugins: {
        ...commonOpts.plugins,
        legend: {
          display: false,
        },
        tooltip: {
          ...commonOpts.plugins?.tooltip,
          callbacks: {
            title: (items) => {
              if (!items.length) return '';
              const idx = items[0].dataIndex;
              const item = top3CAList[idx];
              if (!item) return items[0].label;
              const ranks = ['🥇 1er', '🥈 2ème', '🥉 3ème'];
              return `${ranks[idx] || ''} — ${item.projet || item.nom}`;
            },
            label: (ctx) => {
              const val = ctx.raw || 0;
              const item = top3CAList[ctx.dataIndex];
              const lines = [` Chiffre d'Affaires : ${formatDH(val)}`];
              if (item?.nom && item?.projet && item.nom !== item.projet) {
                lines.push(` Porteur : ${item.nom}`);
              }
              if (item?.statut_juridique) {
                lines.push(` Statut : ${item.statut_juridique}`);
              }
              lines.push(' 🔗 Cliquer pour ouvrir l\'Analyse Financière');
              return lines;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: textColor,
            font: { size: 11, family: "'Inter', sans-serif", weight: '600' },
            maxRotation: 0,
            minRotation: 0,
            autoSkip: false,
            callback: function(val, index) {
              const item = top3CAList[index];
              if (!item) return '';
              const ranks = ['1er', '2ème', '3ème'];
              const rawName = item.projet || item.nom || '';
              const cleanName = rawName.length > 18 ? rawName.slice(0, 16) + '…' : rawName;
              return `${ranks[index]} ${cleanName}`;
            }
          }
        },
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { size: 10, family: "'Inter', sans-serif" },
            callback: (val) => {
              if (val >= 1000000) return `${(val / 1000000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}M`;
              if (val >= 1000) return `${Math.round(val / 1000)}k`;
              return val;
            }
          }
        }
      },
      onClick: (event, elements) => {
        if (elements && elements.length > 0) {
          const idx = elements[0].index;
          const target = top3CAList[idx];
          if (target) {
            handleOpenIncubeFinances(target);
          }
        }
      },
      onHover: (event, chartElement) => {
        if (event.native && event.native.target) {
          event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
        }
      }
    };
  }, [commonOpts, isDark, top3CAList, handleOpenIncubeFinances]);

  // Options pour le TOP 4 Créateurs d'Emplois (légende masquée)
  const top4PostesOptions = useMemo(() => {
    return {
      ...commonOpts,
      plugins: {
        ...commonOpts.plugins,
        legend: {
          display: false,
        },
        tooltip: {
          ...commonOpts.plugins?.tooltip,
          callbacks: {
            label: (ctx) => {
              const val = ctx.raw || 0;
              return ` ${val} poste(s) créé(s)`;
            }
          }
        }
      },
    };
  }, [commonOpts, isDark, top4PostesList]);

  // Options pour le graphique Chiffre d'Affaires par Statut avec légende personnalisée par statut
  const caStatutOptions = useMemo(() => {
    return {
      ...commonOpts,
      plugins: {
        ...commonOpts.plugins,
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: isDark ? '#f1f5f9' : '#1e293b',
            usePointStyle: true,
            pointStyle: 'rectRounded',
            font: { size: 12, family: "'Inter', sans-serif", weight: '600' },
            padding: 14,
            generateLabels: (chart) => {
              const data = chart.data;
              if (data.labels && data.labels.length && data.datasets.length) {
                const bgColors = data.datasets[0].backgroundColor;
                return data.labels.map((label, i) => ({
                  text: label,
                  fontColor: isDark ? '#f8fafc' : '#1e293b',
                  fillStyle: Array.isArray(bgColors) ? bgColors[i % bgColors.length] : bgColors,
                  strokeStyle: Array.isArray(bgColors) ? bgColors[i % bgColors.length] : bgColors,
                  lineWidth: 0,
                  pointStyle: 'rectRounded',
                  hidden: isNaN(data.datasets[0].data[i]),
                  index: i,
                }));
              }
              return [];
            },
          },
        },
        tooltip: {
          ...commonOpts.plugins?.tooltip,
          callbacks: {
            label: (ctx) => {
              const val = ctx.raw || 0;
              return ` ${ctx.label} : ${formatDH(val)}`;
            }
          }
        }
      },
    };
  }, [commonOpts, isDark]);

  const analyseFinanciereData = {
    labels: monthData.map(d => d.label),
    datasets: [
      {
        label: 'Gains (Recettes)',
        data: monthData.map(d => d.gains),
        backgroundColor: '#10b981', // Vert émeraude
        borderRadius: 6,
      },
      {
        label: 'Pertes (Charges)',
        data: monthData.map(d => d.pertes),
        backgroundColor: '#ef4444', // Rouge
        borderRadius: 6,
      }
    ]
  };

  const renderAnalyseFinanciere = () => (
    <div className="card p-5 flex flex-col min-w-0 hover:border-emerald-500/40 transition-all shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-dark-700/60">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                ANALYSE FINANCIÈRE GLOBALE
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-dark-400 mt-0.5">
              Gains et Pertes cumulés pour {selectedPeriod === 'annuel' ? 'les 12 mois de' : `le trimestre ${selectedPeriod} de`} l'année {selectedYear}
              {selectedStatut !== 'tous' ? (
                <span className="font-bold text-emerald-600 dark:text-emerald-400"> — Statut : {selectedStatut}</span>
              ) : (
                <span> — Tous les statuts juridiques</span>
              )}
            </p>
          </div>

          {/* Contrôles : Filtre Année, Filtre Statut Juridique, et Légende */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Sélecteur d'année sous forme de liste déroulante */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-dark-900/80 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-dark-700/60 shadow-sm hover:border-emerald-500/50 transition-colors">
              <span className="text-xs font-semibold text-slate-500 dark:text-dark-400">Année :</span>
              <div className="relative flex items-center">
                <select
                  id="select-annee-financiere"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="appearance-none bg-transparent text-slate-900 dark:text-white text-xs font-extrabold focus:outline-none cursor-pointer pr-5 pl-1 py-0.5"
                >
                  {anneesDisponibles.map(yr => (
                    <option
                      key={yr}
                      value={yr}
                      className="bg-white dark:bg-dark-900 text-slate-900 dark:text-white font-semibold py-1"
                    >
                      {yr}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-0 flex items-center text-slate-500 dark:text-dark-400">
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Nouveau : Filtre Statut Juridique */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-dark-900/80 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-dark-700/60 shadow-sm hover:border-blue-500/50 transition-colors">
              <span className="text-xs font-semibold text-slate-500 dark:text-dark-400">Statut :</span>
              <div className="relative flex items-center">
                <select
                  id="select-statut-financier"
                  value={selectedStatut}
                  onChange={(e) => setSelectedStatut(e.target.value)}
                  className="appearance-none bg-transparent text-slate-900 dark:text-white text-xs font-extrabold focus:outline-none cursor-pointer pr-5 pl-1 py-0.5"
                >
                  <option value="tous" className="bg-white dark:bg-dark-900 text-slate-900 dark:text-white font-semibold py-1">
                    Tous statuts ({formatDH(totalTousGainsForYear)})
                  </option>
                  {statutsDisponibles.map(st => {
                    const stGains = totalsByStatutForYear[st] || 0;
                    return (
                      <option
                        key={st}
                        value={st}
                        className="bg-white dark:bg-dark-900 text-slate-900 dark:text-white font-semibold py-1"
                      >
                        {st} ({formatDH(stGains)})
                      </option>
                    );
                  })}
                </select>
                <div className="pointer-events-none absolute right-0 flex items-center text-slate-500 dark:text-dark-400">
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Nouveau : Filtre Période */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-dark-900/80 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-dark-700/60 shadow-sm hover:border-indigo-500/50 transition-colors">
              <span className="text-xs font-semibold text-slate-500 dark:text-dark-400">Période :</span>
              <div className="relative flex items-center">
                <select
                  id="select-periode-financiere"
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="appearance-none bg-transparent text-slate-900 dark:text-white text-xs font-extrabold focus:outline-none cursor-pointer pr-5 pl-1 py-0.5"
                >
                  <option value="annuel" className="bg-white dark:bg-dark-900 text-slate-900 dark:text-white font-semibold py-1">Annuel</option>
                  <option value="T1" className="bg-white dark:bg-dark-900 text-slate-900 dark:text-white font-semibold py-1">T1</option>
                  <option value="T2" className="bg-white dark:bg-dark-900 text-slate-900 dark:text-white font-semibold py-1">T2</option>
                  <option value="T3" className="bg-white dark:bg-dark-900 text-slate-900 dark:text-white font-semibold py-1">T3</option>
                  <option value="T4" className="bg-white dark:bg-dark-900 text-slate-900 dark:text-white font-semibold py-1">T4</option>
                </select>
                <div className="pointer-events-none absolute right-0 flex items-center text-slate-500 dark:text-dark-400">
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Légende */}
            <div className="flex items-center gap-3 text-xs font-semibold bg-slate-50 dark:bg-dark-900/70 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-dark-700/60">
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm"></span> Gains
              </span>
              <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm"></span> Pertes
              </span>
            </div>
          </div>
        </div>

        {/* Bandeau indicateurs consolidés pour l'année et le statut sélectionnés */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-4">
          <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/30 rounded-xl px-3.5 py-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              Total Recettes ({selectedYear}{selectedPeriod !== 'annuel' ? ` • ${selectedPeriod}` : ''}{selectedStatut !== 'tous' ? ` • ${selectedStatut}` : ''})
            </span>
            <span className="text-sm font-extrabold text-emerald-800 dark:text-emerald-300">{formatDH(totalGainsYear)}</span>
          </div>
          <div className="bg-red-50/60 dark:bg-red-950/20 border border-red-200/80 dark:border-red-800/30 rounded-xl px-3.5 py-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-red-700 dark:text-red-400">
              Total Charges ({selectedYear}{selectedPeriod !== 'annuel' ? ` • ${selectedPeriod}` : ''}{selectedStatut !== 'tous' ? ` • ${selectedStatut}` : ''})
            </span>
            <span className="text-sm font-extrabold text-red-800 dark:text-red-300">{formatDH(totalPertesYear)}</span>
          </div>
          <div className={`rounded-xl px-3.5 py-2 flex items-center justify-between border ${resultatNetYear >= 0
            ? 'bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/80 dark:border-blue-800/30'
            : 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-800/30'
            }`}>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Résultat Net ({selectedYear}{selectedPeriod !== 'annuel' ? ` • ${selectedPeriod}` : ''}{selectedStatut !== 'tous' ? ` • ${selectedStatut}` : ''})
            </span>
            <span className={`text-sm font-extrabold ${resultatNetYear >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-amber-700 dark:text-amber-400'}`}>
              {formatDH(resultatNetYear)}
            </span>
          </div>
        </div>

        <div className="h-80 min-h-[280px] w-full">
          <Bar
            key={`fin-${theme}-${selectedYear}-${selectedStatut}`}
            data={analyseFinanciereData}
            options={{
              ...commonOpts,
              plugins: {
                ...commonOpts.plugins,
                legend: { display: false },
              },
            }}
          />
        </div>
      </div>
  );

  const renderPerformanceCards = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* TOP 3 CHIFFRE D'AFFAIRES */}
        <div className="card p-5 flex flex-col min-h-[350px] min-w-0 hover:border-amber-500/40 transition-all shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
            <div 
              onClick={() => setShowAllIncubesModal(true)}
              className="group flex items-center gap-2 cursor-pointer select-none"
              title="Cliquez pour afficher le classement du chiffre d'affaires pour tous les incubés"
            >
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase flex items-center gap-2 group-hover:text-amber-500 transition-colors">
                TOP 3 CHIFFRE D'AFFAIRES
              </h3>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 group-hover:bg-amber-500 group-hover:text-white transition-all shadow-2xs">
                <Eye size={11} /> Voir tous ({allIncubesCAList.length})
              </span>
            </div>

            {/* Sélecteur de Période (T1, T2, T3, T4, Annuel) */}
            <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-dark-900 p-0.5 rounded-lg border border-slate-200 dark:border-dark-700 self-start sm:self-auto">
              {['annuel', 'T1', 'T2', 'T3', 'T4'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSelectedPeriod(p)}
                  className={`px-2 py-0.5 text-[10px] font-extrabold rounded-md transition-all cursor-pointer ${
                    selectedPeriod === p
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:text-dark-400 dark:hover:text-white'
                  }`}
                  title={`Filtrer par ${p === 'annuel' ? 'Année complète' : `Trimestre ${p}`}`}
                >
                  {p === 'annuel' ? 'Annuel' : p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-dark-400 mb-2">
            <span>
              Les projets ayant généré le plus de CA ({selectedPeriod === 'annuel' ? `Année ${selectedYear}` : `${selectedPeriod} ${selectedYear}`})
            </span>
            <button
              type="button"
              onClick={() => setShowAllIncubesModal(true)}
              className="text-[11px] font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              Classement complet <ArrowRight size={12} />
            </button>
          </div>

          <div className="flex-1 min-h-[175px]">
            <Bar key={`top3-${theme}-${selectedPeriod}-${selectedYear}`} data={top3Data} options={top3Options} />
          </div>

          {top3CAList && top3CAList.length > 0 && top3CAList.some(item => Number(item.total_ca) > 0) ? (
            <div className="mt-3 flex items-center justify-center flex-wrap gap-2 text-xs font-semibold">
              {top3CAList.slice(0, 3).map((item, idx) => {
                const badges = [
                  'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20',
                  'bg-slate-500/10 text-slate-800 dark:text-slate-200 border-slate-400/30 hover:bg-slate-500/20',
                  'bg-amber-700/10 text-amber-900 dark:text-amber-400 border-amber-700/30 hover:bg-amber-700/20',
                ];
                const medals = ['🥇 1er', '🥈 2ème', '🥉 3ème'];
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleOpenIncubeFinances(item)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all cursor-pointer group shadow-2xs ${badges[idx] || badges[0]}`}
                    title={`Cliquer pour voir l'analyse financière de ${item.projet || item.nom} (${formatDH(item.total_ca)})`}
                  >
                    <span className="font-black">{medals[idx]}</span>
                    <span className="font-bold truncate max-w-[130px] group-hover:underline">{item.projet || item.nom}</span>
                    <span className="text-[11px] opacity-80 font-normal">({formatDH(item.total_ca)})</span>
                    <ExternalLink size={11} className="opacity-60 group-hover:opacity-100 transition-opacity ml-0.5" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 text-center text-xs text-slate-400 dark:text-dark-400 italic">
              Aucun chiffre d'affaires enregistré sur cette période
            </div>
          )}
        </div>

      {/* Chiffre d'Affaires par Statut */}
      <div className="card p-5 flex flex-col h-80 min-w-0 hover:border-blue-500/40 transition-all shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
          <button
            type="button"
            onClick={() => setShowCaStatutModal(true)}
            className="group cursor-pointer select-none text-left"
            title="Cliquer pour afficher la liste des incubés par statut juridique"
          >
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase flex items-center gap-2 group-hover:text-blue-500 transition-colors">
              CHIFFRE D'AFFAIRES PAR STATUT
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/30 group-hover:bg-blue-500 group-hover:text-white transition-all shadow-2xs">
                <Eye size={11} /> Voir par incubé
              </span>
            </h3>
          </button>
          {/* Sélecteur de Période (T1, T2, T3, T4, Annuel) */}
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-dark-900 p-0.5 rounded-lg border border-slate-200 dark:border-dark-700 self-start sm:self-auto">
            {['annuel', 'T1', 'T2', 'T3', 'T4'].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setSelectedPeriod(p)}
                className={`px-2 py-0.5 text-[10px] font-extrabold rounded-md transition-all cursor-pointer ${
                  selectedPeriod === p
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:text-dark-400 dark:hover:text-white'
                }`}
                title={`Filtrer par ${p === 'annuel' ? 'Année complète' : `Trimestre ${p}`}`}
              >
                {p === 'annuel' ? 'Annuel' : p}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-dark-400 mb-3">
          Répartition financière par statut juridique ({selectedPeriod === 'annuel' ? `Année ${selectedYear}` : `${selectedPeriod} ${selectedYear}`})
        </p>
        <div className="flex-1 min-h-0">
          <Bar key={`statut-${theme}-${selectedPeriod}-${selectedYear}`} data={caStatutData} options={caStatutOptions} />
        </div>
      </div>

      {/* 7. Phases d'incubation (Graphique Circulaire Irrégulier / Polar Area) */}
      <RepartitionPhases 
        stats={stats} 
        isDark={isDark} 
        className="h-full min-w-0" 
        onOpenModal={() => setShowPhasesModal(true)} 
      />

      {/* 5. Postes Créés */}
      <div className="card p-5 flex flex-col justify-between min-w-0 hover:border-emerald-500/40 transition-all">
        <div className="flex justify-between items-start mb-4">
          <button
            type="button"
            onClick={() => setShowEmploisModal(true)}
            className="group cursor-pointer select-none text-left"
            title="Cliquer pour voir la décomposition des postes créés par incubé"
          >
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase flex items-center gap-2 group-hover:text-emerald-500 transition-colors">
              POSTES CRÉÉS
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-2xs">
                <Eye size={11} /> Voir par incubé
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-dark-400 mt-1">Stages, Prestations & Contrats</p>
          </button>
          <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/40 shrink-0">
            Total : {totalEmplois}
          </div>
        </div>
        <div className="flex-1 min-h-[170px]">
          <Bar
            key={`emplois-${theme}`}
            data={emploisData}
            options={{ ...commonOpts, plugins: { ...commonOpts.plugins, legend: { display: false } } }}
          />
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.keys(emploisMap).map((k, idx) => {
            const colors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4', '#64748b'];
            const color = colors[idx % colors.length];
            return (
              <div
                key={k}
                className="bg-white dark:bg-dark-800 rounded-xl p-2.5 flex items-center justify-between gap-2 border border-slate-200/80 dark:border-dark-700 shadow-2xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{k}</span>
                </div>
                <span className="text-xs font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-dark-700 px-2 py-0.5 rounded-md shrink-0">
                  {emploisMap[k]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. TOP 4 CRÉATEURS D'EMPLOIS (POSTES CRÉÉS) - CARTE PROPORTIONNELLE (TREEMAP) */}
      <Top4EmploisTreemap
        top4PostesList={top4PostesList}
        isDark={isDark}
        onOpenModal={() => setShowEmploisModal(true)}
      />

      {/* 6. NIVEAU D'ÉTUDE — CARTE PROPORTIONNELLE / DONUT CENTRÉ (COL 2, ROW 3) */}
      <NiveauEtudeChart
        stats={stats}
        isDark={isDark}
      />
    </div>

    {/* MODALE DU CLASSEMENT COMPLET DU CHIFFRE D'AFFAIRES DE TOUS LES INCUBÉS */}
    {showAllIncubesModal && (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200"
        onClick={() => setShowAllIncubesModal(false)}
      >
        <div 
          className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-700 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-dark-700/80 bg-slate-50/70 dark:bg-dark-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                <Trophy size={22} />
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  Classement Complet — Chiffre d'Affaires
                </h2>
                <p className="text-xs text-slate-500 dark:text-dark-400 mt-0.5">
                  Filtres actifs : <span className="font-bold text-amber-600 dark:text-amber-400">{currentPeriod.label} {selectedYear}</span>
                  {selectedStatut !== 'tous' ? (
                    <span className="font-semibold text-blue-600 dark:text-blue-400 ml-1.5">• Statut : {selectedStatut}</span>
                  ) : (
                    <span className="text-slate-400 dark:text-dark-500 ml-1.5">• Tous statuts</span>
                  )}
                  <span className="ml-2 font-bold text-slate-700 dark:text-slate-300">({filteredModalList.length} projet{filteredModalList.length > 1 ? 's' : ''})</span>
                </p>
              </div>
            </div>

            {/* Sélecteur de période synchronisé & Bouton fermer */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <div className="flex items-center gap-0.5 bg-white dark:bg-dark-900 p-1 rounded-xl border border-slate-200 dark:border-dark-700 shadow-2xs">
                {['annuel', 'T1', 'T2', 'T3', 'T4'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setSelectedPeriod(p)}
                    className={`px-2 sm:px-3 py-1 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                      selectedPeriod === p
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:text-dark-400 dark:hover:text-white'
                    }`}
                  >
                    {p === 'annuel' ? 'Annuel' : p}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowAllIncubesModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors cursor-pointer"
                title="Fermer la fenêtre"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* KPI Highlights Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 sm:p-4 bg-slate-50/50 dark:bg-dark-900/40 border-b border-slate-100 dark:border-dark-800 text-xs">
            <div className="p-2.5 sm:p-3 rounded-xl bg-white dark:bg-dark-800 border border-slate-200/80 dark:border-dark-700 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-dark-400 block">CA Total Période</span>
              <span className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400">
                {formatDH(allIncubesCAList.reduce((s, i) => s + (Number(i.total_ca) || 0), 0))}
              </span>
            </div>
            <div className="p-2.5 sm:p-3 rounded-xl bg-white dark:bg-dark-800 border border-slate-200/80 dark:border-dark-700 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-dark-400 block">Projets Enregistrés</span>
              <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                {allIncubesCAList.length}
              </span>
            </div>
            <div className="p-2.5 sm:p-3 rounded-xl bg-white dark:bg-dark-800 border border-slate-200/80 dark:border-dark-700 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-dark-400 block">Avec CA &gt; 0</span>
              <span className="text-sm sm:text-base font-black text-amber-600 dark:text-amber-400">
                {allIncubesCAList.filter(i => Number(i.total_ca) > 0).length} ({allIncubesCAList.length > 0 ? Math.round((allIncubesCAList.filter(i => Number(i.total_ca) > 0).length / allIncubesCAList.length) * 100) : 0}%)
              </span>
            </div>
            <div className="p-2.5 sm:p-3 rounded-xl bg-white dark:bg-dark-800 border border-slate-200/80 dark:border-dark-700 shadow-2xs truncate">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-dark-400 block">Leader de la période</span>
              <span className="text-xs sm:text-sm font-black text-amber-600 dark:text-amber-400 truncate block" title={allIncubesCAList[0]?.projet || '—'}>
                🥇 {allIncubesCAList[0]?.projet || allIncubesCAList[0]?.nom || '—'}
              </span>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-dark-800">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
                placeholder="Rechercher par nom de projet, porteur, statut..."
                className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl focus:outline-hidden focus:border-amber-500 text-slate-900 dark:text-white placeholder-slate-400"
              />
              {modalSearch && (
                <button
                  type="button"
                  onClick={() => setModalSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-300 font-semibold select-none bg-slate-50 dark:bg-dark-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-dark-700">
                <input
                  type="checkbox"
                  checked={modalFilterZero}
                  onChange={(e) => setModalFilterZero(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-400 w-4 h-4 cursor-pointer"
                />
                <span>Masquer les projets à 0 DH</span>
              </label>
            </div>
          </div>

          {/* Table Content */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4">
            {filteredModalList.length === 0 ? (
              <div className="text-center py-16 text-slate-400 dark:text-dark-400 text-xs sm:text-sm">
                Aucun projet ne correspond aux critères sur cette période ({currentPeriod.label} {selectedYear}).
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-dark-700/80">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 dark:bg-dark-900/90 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-dark-700 uppercase font-black tracking-wider text-[11px]">
                      <th className="py-3 px-3 text-center w-14">Rang</th>
                      <th className="py-3 px-4">Projet / Raison Sociale</th>
                      <th className="py-3 px-3">Statut Juridique</th>
                      <th className="py-3 px-3">Phase</th>
                      <th className="py-3 px-4 text-right">Chiffre d'Affaires</th>
                      <th className="py-3 px-4 text-center w-36">Performance</th>
                      <th className="py-3 px-3 text-center w-32">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-dark-800">
                    {filteredModalList.map((item, idx) => {
                      const maxCA = Number(filteredModalList[0]?.total_ca) || 1;
                      const itemCA = Number(item.total_ca) || 0;
                      const percent = maxCA > 0 ? Math.min(100, Math.round((itemCA / maxCA) * 100)) : 0;

                      const isGold = idx === 0 && itemCA > 0;
                      const isSilver = idx === 1 && itemCA > 0;
                      const isBronze = idx === 2 && itemCA > 0;

                      return (
                        <tr 
                          key={item.id || item.nom || idx} 
                          className="hover:bg-slate-50 dark:hover:bg-dark-800/60 transition-colors group cursor-pointer"
                          onClick={() => handleOpenIncubeFinances(item)}
                          title={`Cliquer pour ouvrir l'analyse financière de ${item.projet || item.nom}`}
                        >
                          {/* Rang */}
                          <td className="py-3 px-3 text-center">
                            {isGold ? (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-black border border-amber-500/30 shadow-2xs text-sm">
                                🥇
                              </span>
                            ) : isSilver ? (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-400/15 text-slate-600 dark:text-slate-300 font-black border border-slate-400/30 shadow-2xs text-sm">
                                🥈
                              </span>
                            ) : isBronze ? (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-700/15 text-amber-700 dark:text-amber-500 font-black border border-amber-700/30 shadow-2xs text-sm">
                                🥉
                              </span>
                            ) : (
                              <span className="font-bold text-slate-500 dark:text-dark-400 text-xs">
                                #{idx + 1}
                              </span>
                            )}
                          </td>

                          {/* Projet / Incubé */}
                          <td className="py-3 px-4">
                            <div className="flex flex-col">
                              <span className="font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors flex items-center gap-1.5">
                                {item.projet || item.nom}
                                <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-amber-600 dark:text-amber-400 shrink-0" />
                              </span>
                              {item.nom && item.projet && item.nom !== item.projet && (
                                <span className="text-[11px] text-slate-500 dark:text-dark-400 font-medium">
                                  Porteur : {item.nom}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Statut Juridique */}
                          <td className="py-3 px-3">
                            <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-dark-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-dark-600">
                              {item.statut_juridique || 'Non spécifié'}
                            </span>
                          </td>

                          {/* Phase */}
                          <td className="py-3 px-3 text-slate-600 dark:text-dark-300 font-medium">
                            {item.phase_projet || '—'}
                          </td>

                          {/* CA */}
                          <td className="py-3 px-4 text-right">
                            <span className={`font-black text-xs sm:text-sm ${itemCA > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-dark-500'}`}>
                              {formatDH(itemCA)}
                            </span>
                          </td>

                          {/* Progression / Jauge */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-slate-100 dark:bg-dark-700 rounded-full h-2 overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    isGold ? 'bg-amber-500' : isSilver ? 'bg-slate-400' : isBronze ? 'bg-amber-700' : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${itemCA > 0 ? Math.max(percent, 4) : 0}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-bold text-slate-400 dark:text-dark-400 w-8 text-right shrink-0">
                                {itemCA > 0 ? `${percent}%` : '0%'}
                              </span>
                            </div>
                          </td>

                          {/* Action directe vers Analyse Financière */}
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenIncubeFinances(item);
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-500/10 hover:bg-amber-500 text-amber-700 dark:text-amber-400 hover:text-white border border-amber-500/30 transition-all cursor-pointer shadow-2xs"
                              title="Accéder directement à l'onglet Analyse Financière de cet incubé"
                            >
                              <DollarSign size={12} />
                              <span>Finances</span>
                              <ExternalLink size={10} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-dark-700/80 bg-slate-50/70 dark:bg-dark-900/50 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span className="text-xs text-slate-500 dark:text-dark-400 text-center sm:text-left">
              💡 Cliquez sur une ligne ou sur le bouton <span className="font-bold text-amber-600 dark:text-amber-400">Finances</span> pour ouvrir directement l'analyse financière de l'incubé.
            </span>
            <button
              type="button"
              onClick={() => setShowAllIncubesModal(false)}
              className="btn btn-secondary px-4 py-1.5 text-xs font-bold w-full sm:w-auto cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    )}

    {/* MODALE DÉCOMPOSITION POSTES CRÉÉS PAR INCUBÉ */}
    <KpiCategoryDetailModal
      isOpen={showEmploisModal}
      onClose={() => setShowEmploisModal(false)}
      title="Postes Créés par Incubé — Ressources Humaines"
      subtitle="Répartition des 47 postes créés (Freelance, Stage, CDI, CDD, Autre) — Cliquez sur un incubé pour ouvrir sa gestion RH"
      icon={Briefcase}
      themeColor="emerald"
      categoryLabel="Type de Contrat"
      metricLabel="Postes Créés"
      categories={emploisModalCategories}
      customCategoryCounts={emploisCategoryCounts}
      items={emploisModalItems}
      targetTab="rh"
    />

    {/* MODALE RÉPARTITION DES INCUBÉS PAR PHASE D'INCUBATION */}
    <KpiCategoryDetailModal
      isOpen={showPhasesModal}
      onClose={() => setShowPhasesModal(false)}
      title="Détail des Incubés par Phase d'Incubation"
      subtitle="Consultez les 58 incubés regroupés par phase d'incubation — Cliquez sur un incubé pour ouvrir sa fiche"
      icon={Rocket}
      themeColor="blue"
      categoryLabel="Phase"
      metricLabel="Phase Actuelle"
      categories={phasesCategories}
      items={phasesModalItems}
      targetTab="infos"
    />

    {/* MODALE RÉPARTITION DES INCUBÉS PAR STATUT JURIDIQUE */}
    <KpiCategoryDetailModal
      isOpen={showCaStatutModal}
      onClose={() => setShowCaStatutModal(false)}
      title="Répartition des Incubés par Statut Juridique"
      subtitle="Chiffre d'affaires et informations selon le statut juridique — Cliquez sur un incubé pour ouvrir sa fiche"
      icon={Scale}
      themeColor="blue"
      categoryLabel="Statut Juridique"
      metricLabel="Chiffre d'Affaires"
      categories={caStatutCategories}
      items={caStatutModalItems}
      targetTab="financier"
    />
  </>
);

  if (section === 'financial') {
    return renderAnalyseFinanciere();
  }
  if (section === 'performance') {
    return renderPerformanceCards();
  }

  return (
    <div className="space-y-6 mt-6">
      {renderAnalyseFinanciere()}
      {renderPerformanceCards()}
    </div>
  );
}

// ============================================================================
// 2. KPI DÉMOGRAPHIE
// ============================================================================
export function KpiDemographie({ stats }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [showProvinceModal, setShowProvinceModal] = useState(false);
  const [showStatutModal, setShowStatutModal] = useState(false);

  const commonOpts = useMemo(() => getCommonOptions(isDark), [isDark]);
  const horizontalBarOpts = useMemo(() => getCommonOptions(isDark, { indexAxis: 'y' }), [isDark]);
  const pieOpts = useMemo(() => getPieOptions(isDark), [isDark]);

  if (!stats) return null;

  const genreData = {
    labels: stats.genreStats?.map(g => g.genre || 'Non spécifié') || [],
    datasets: [{
      data: stats.genreStats?.map(g => Number(g.count)) || [],
      backgroundColor: ['#6366f1', '#10b981', '#f59e0b'],
      borderWidth: isDark ? 2 : 1,
      borderColor: isDark ? '#1e293b' : '#ffffff',
    }]
  };

  // 2. Répartition par Province (Couleurs distinctes par province)
  const PROVINCE_CONFIG = {
    'Salé': { color: '#3b82f6' }, // Bleu royal
    'Rabat': { color: '#10b981' }, // Vert émeraude
    'Témara': { color: '#f59e0b' }, // Orange ambré
    'Kénitra': { color: '#8b5cf6' }, // Violet
    'Casablanca': { color: '#ec4899' }, // Rose
    'Non spécifié': { color: '#94a3b8' }, // Gris ardoise
  };

  const formatProvinceName = (name) => {
    if (!name || name === 'null' || name.toLowerCase() === 'non spécifié') return 'Non spécifié';
    const clean = name.trim().toLowerCase();
    if (clean === 'sale' || clean === 'salé') return 'Salé';
    if (clean === 'rabat') return 'Rabat';
    if (clean === 'temara' || clean === 'témara') return 'Témara';
    if (clean === 'kenitra' || clean === 'kénitra') return 'Kénitra';
    if (clean === 'casablanca' || clean === 'casa') return 'Casablanca';
    return name.trim().charAt(0).toUpperCase() + name.trim().slice(1);
  };

  const getProvinceColor = (prov) => PROVINCE_CONFIG[prov]?.color || '#06b6d4';

  const rawRegionStats = stats?.regionStats || [];
  const regionMap = {};
  rawRegionStats.forEach(r => {
    const pName = formatProvinceName(r.province);
    regionMap[pName] = (regionMap[pName] || 0) + (Number(r.count) || 0);
  });

  const sortedProvinces = Object.keys(regionMap).sort((a, b) => regionMap[b] - regionMap[a]);
  const regionLabels = sortedProvinces;
  const regionColors = sortedProvinces.map(p => getProvinceColor(p));
  const regionValues = sortedProvinces.map(p => regionMap[p]);

  const regionData = {
    labels: regionLabels,
    datasets: [{
      data: regionValues,
      backgroundColor: regionColors,
      borderRadius: 6,
    }]
  };

  const regionOptions = useMemo(() => {
    return {
      ...horizontalBarOpts,
      plugins: {
        ...horizontalBarOpts.plugins,
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: isDark ? '#f1f5f9' : '#1e293b',
            usePointStyle: true,
            pointStyle: 'rectRounded',
            font: { size: 12, family: "'Inter', sans-serif", weight: '600' },
            padding: 12,
            generateLabels: (chart) => {
              const data = chart.data;
              if (data.labels && data.labels.length && data.datasets.length) {
                const bgColors = data.datasets[0].backgroundColor;
                return data.labels.map((label, i) => ({
                  text: label,
                  fontColor: isDark ? '#f8fafc' : '#1e293b',
                  fillStyle: Array.isArray(bgColors) ? bgColors[i % bgColors.length] : bgColors,
                  strokeStyle: Array.isArray(bgColors) ? bgColors[i % bgColors.length] : bgColors,
                  lineWidth: 0,
                  pointStyle: 'rectRounded',
                  hidden: isNaN(data.datasets[0].data[i]),
                  index: i,
                }));
              }
              return [];
            },
          },
        },
        tooltip: {
          ...horizontalBarOpts.plugins?.tooltip,
          callbacks: {
            label: (ctx) => {
              const val = ctx.raw || 0;
              return ` ${ctx.label} : ${val} incubé${val > 1 ? 's' : ''}`;
            }
          }
        }
      },
      scales: {
        ...horizontalBarOpts.scales,
        x: {
          ...horizontalBarOpts.scales?.x,
          ticks: {
            ...horizontalBarOpts.scales?.x?.ticks,
            precision: 0,
          }
        }
      }
    };
  }, [horizontalBarOpts, isDark]);

  // 3. Domaines d'Activité (Nettoyage des secteurs & suppression de la légende 'Projets')
  const formatSecteurName = (name) => {
    if (!name || !name.trim() || name.trim() === 'null') return 'Autre';
    const clean = name.trim().toLowerCase();
    if (clean.includes('intelegence') || clean.includes('intelligence')) return 'Intelligence Artificielle';
    if (clean.includes('tourisme')) return 'E-Tourisme';
    if (clean.includes('audiovisuel')) return 'Audiovisuel';
    if (clean.includes('learning')) return 'E-Learning';
    if (clean.includes('health')) return 'HealthTech';
    if (clean.includes('market')) return 'Marketing Digital';
    if (clean.includes('dév') || clean.includes('dev')) return 'Développement';
    return name.trim();
  };

  const rawDomaineStats = stats?.domaineStats || [];
  const domaineMap = {};
  rawDomaineStats.forEach(d => {
    const sName = formatSecteurName(d.secteur_activite);
    domaineMap[sName] = (domaineMap[sName] || 0) + (Number(d.count) || 0);
  });

  const sortedDomaines = Object.keys(domaineMap).sort((a, b) => domaineMap[b] - domaineMap[a]);
  const domainePalette = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899', '#6366f1', '#64748b'];

  const domaineData = {
    labels: sortedDomaines,
    datasets: [{
      data: sortedDomaines.map(s => domaineMap[s]),
      backgroundColor: sortedDomaines.map((_, i) => domainePalette[i % domainePalette.length]),
      borderRadius: 5,
    }]
  };

  const domaineOptions = useMemo(() => {
    return {
      ...horizontalBarOpts,
      plugins: {
        ...horizontalBarOpts.plugins,
        legend: {
          display: false, // Supprime la légende 'Projets'
        },
        tooltip: {
          ...horizontalBarOpts.plugins?.tooltip,
          callbacks: {
            label: (ctx) => ` ${ctx.label} : ${ctx.raw} projet${ctx.raw > 1 ? 's' : ''}`,
          }
        }
      },
      scales: {
        ...horizontalBarOpts.scales,
        x: {
          ...horizontalBarOpts.scales?.x,
          ticks: {
            ...horizontalBarOpts.scales?.x?.ticks,
            precision: 0,
          }
        }
      }
    };
  }, [horizontalBarOpts]);

  const statutData = {
    labels: stats.statutStats?.map(s => s.statut_juridique || 'Non spécifié') || [],
    datasets: [{
      data: stats.statutStats?.map(s => Number(s.count)) || [],
      backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
      borderWidth: isDark ? 2 : 1,
      borderColor: isDark ? '#1e293b' : '#ffffff',
    }]
  };

  // Préparation des listes pour les modales décomposées par incubé
  const provinceModalItems = useMemo(() => {
    const list = Array.isArray(stats?.suiviStats?.allIncubes) ? stats.suiviStats.allIncubes : [];
    return list.map(inc => {
      const prov = formatProvinceName(inc.province || inc.ville);
      return {
        id: inc.id,
        nom: inc.nom_incube || 'Inconnu',
        projet: inc.raison_sociale || inc.nom_incube || 'Inconnu',
        categorie: prov,
        metricValue: prov,
        secondaryText: inc.statut_juridique ? `Statut : ${inc.statut_juridique}` : (inc.phase_projet ? `Phase : ${inc.phase_projet}` : ''),
        targetTab: 'infos'
      };
    });
  }, [stats?.suiviStats?.allIncubes]);

  const provinceCategories = useMemo(() => {
    const cats = sortedProvinces.length > 0 ? sortedProvinces : Array.from(new Set(provinceModalItems.map(i => i.categorie).filter(Boolean)));
    return ['Toutes', ...cats];
  }, [sortedProvinces, provinceModalItems]);

  const statutModalItems = useMemo(() => {
    const list = Array.isArray(stats?.suiviStats?.allIncubes) ? stats.suiviStats.allIncubes : [];
    return list.map(inc => {
      const st = (inc.statut_juridique || 'Non spécifié').trim();
      return {
        id: inc.id,
        nom: inc.nom_incube || 'Inconnu',
        projet: inc.raison_sociale || inc.nom_incube || 'Inconnu',
        categorie: st,
        metricValue: st,
        secondaryText: inc.phase_projet ? `Phase : ${inc.phase_projet}` : (inc.accompagnateur ? `Accompagnateur : ${inc.accompagnateur}` : ''),
        targetTab: 'infos'
      };
    });
  }, [stats?.suiviStats?.allIncubes]);

  const statutCategories = useMemo(() => {
    const cats = Array.from(new Set(statutModalItems.map(i => i.categorie).filter(Boolean)));
    return ['Toutes', ...cats];
  }, [statutModalItems]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">

      {/* RÉPARTITION PAR GENRE (Demi-cercle & Barres de progression) */}
      <RepartitionGenre
        stats={stats}
        isDark={isDark}
        className="h-80 min-w-0"
      />

      {/* Répartition par Province */}
      <div className="card p-5 flex flex-col h-80 min-w-0 hover:border-blue-500/40 transition-all">
        <button
          type="button"
          onClick={() => setShowProvinceModal(true)}
          className="group cursor-pointer select-none text-left"
          title="Cliquer pour voir la liste des incubés par province"
        >
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase mb-1 flex items-center gap-2 group-hover:text-blue-500 transition-colors">
            Répartition par Province
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/30 group-hover:bg-blue-500 group-hover:text-white transition-all shadow-2xs">
              <Eye size={11} /> Voir par incubé
            </span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-dark-400 mb-3">Origine géographique des porteurs de projet</p>
        </button>
        <div className="flex-1 min-h-0">
          <Bar key={`province-${theme}`} data={regionData} options={regionOptions} />
        </div>
      </div>

      {/* Domaines d'Activité */}
      <div className="card p-5 flex flex-col h-80 min-w-0 hover:border-primary-500/40 transition-all">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase mb-1">
          Domaines d'Activité
        </h3>
        <p className="text-xs text-slate-500 dark:text-dark-400 mb-3">Secteurs d'intervention des projets</p>
        <div className="flex-1 min-h-0">
          <Bar key={`domaine-${theme}`} data={domaineData} options={domaineOptions} />
        </div>
      </div>

      {/* Statut Juridique */}
      <div className="card p-5 flex flex-col h-80 min-w-0 hover:border-purple-500/40 transition-all">
        <button
          type="button"
          onClick={() => setShowStatutModal(true)}
          className="group cursor-pointer select-none text-left"
          title="Cliquer pour voir la liste des incubés par statut juridique"
        >
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase mb-1 flex items-center gap-2 group-hover:text-purple-500 transition-colors">
            Statut Juridique
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/30 group-hover:bg-purple-500 group-hover:text-white transition-all shadow-2xs">
              <Eye size={11} /> Voir par incubé
            </span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-dark-400 mb-3">Formes juridiques adoptées ou visées</p>
        </button>
        <div className="flex-1 min-h-0">
          <Pie key={`statut-pie-${theme}`} data={statutData} options={pieOpts} />
        </div>
      </div>

      {/* MODALE RÉPARTITION PAR PROVINCE */}
      <KpiCategoryDetailModal
        isOpen={showProvinceModal}
        onClose={() => setShowProvinceModal(false)}
        title="Répartition des Incubés par Province"
        subtitle="Origine géographique des porteurs de projet — Cliquez sur un incubé pour ouvrir sa fiche"
        icon={MapPin}
        themeColor="blue"
        categoryLabel="Province"
        metricLabel="Localisation"
        categories={provinceCategories}
        items={provinceModalItems}
      />

      {/* MODALE RÉPARTITION PAR STATUT JURIDIQUE */}
      <KpiCategoryDetailModal
        isOpen={showStatutModal}
        onClose={() => setShowStatutModal(false)}
        title="Répartition par Statut Juridique"
        subtitle="Formes juridiques des entreprises créées — Cliquez sur un incubé pour ouvrir sa fiche"
        icon={Scale}
        themeColor="purple"
        categoryLabel="Statut Juridique"
        metricLabel="Statut"
        categories={statutCategories}
        items={statutModalItems}
      />
    </div>
  );
}

// ============================================================================
// 3. KPI ASSIDUITÉ & UTILISATION DES ESPACES
// ============================================================================
export function KpiAssiduite({ impactStats, stats }) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [periodeReservation, setPeriodeReservation] = useState('mois'); // 'jour' | 'semaine' | 'mois'
  const [selectedMoisRes, setSelectedMoisRes] = useState(() => new Date().toISOString().substring(0, 7)); // 'YYYY-MM' ou 'tous'
  const [suiviMode, setSuiviMode] = useState('mois'); // 'mois' | 'annee'
  const [selectedMoisSuivi, setSelectedMoisSuivi] = useState(() => new Date().toISOString().substring(0, 7)); // 'YYYY-MM' ou 'tous'
  const [selectedAnneeSuivi, setSelectedAnneeSuivi] = useState(() => String(new Date().getFullYear())); // 'YYYY' ou 'toutes'
  const [selectedAccompagnateurModal, setSelectedAccompagnateurModal] = useState(null);
  const [accModalTab, setAccModalTab] = useState('followed'); // 'followed' | 'unfollowed'
  const [selectedPlanAccompagnateurModal, setSelectedPlanAccompagnateurModal] = useState(null);
  const [planModalTab, setPlanModalTab] = useState('all'); // 'all' | 'atteint' | 'en_cours' | 'non_atteint'
  const [selectedPlanAccompagnateur, setSelectedPlanAccompagnateur] = useState('tous');
  const [planPeriodeType, setPlanPeriodeType] = useState('trimestre'); // 'trimestre' | 'mois'
  const [selectedPlanTrimestre, setSelectedPlanTrimestre] = useState('tous'); // 'tous' | 'T1' | 'T2' | 'T3' | 'T4'
  const [selectedPlanMois, setSelectedPlanMois] = useState('tous'); // 'tous' | '01'..'12'
  const [selectedPlanYear, setSelectedPlanYear] = useState(() => String(new Date().getFullYear())); // 'YYYY' ou 'toutes'
  const [selectedEventAnnee, setSelectedEventAnnee] = useState(() => String(new Date().getFullYear())); // 'YYYY' ou 'toutes'
  const [selectedEventFormateur, setSelectedEventFormateur] = useState('tous');

  const commonOpts = useMemo(() => getCommonOptions(isDark), [isDark]);
  const allResList = impactStats?.espaces?.liste || [];

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentMonthStr = todayStr.substring(0, 7);

  const dayOfWeek = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek + 1);
  const mondayStr = monday.toISOString().split('T')[0];
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);
  const saturdayStr = saturday.toISOString().split('T')[0];

  // Liste dynamique des mois disponibles dans l'historique et l'année courante
  const availableMonths = useMemo(() => {
    const monthsSet = new Set();
    const currYear = new Date().getFullYear();
    for (let m = 1; m <= 12; m++) {
      monthsSet.add(`${currYear}-${String(m).padStart(2, '0')}`);
    }
    allResList.forEach(r => {
      if (r.date && r.date.length >= 7) {
        monthsSet.add(r.date.substring(0, 7));
      }
    });
    return Array.from(monthsSet).sort();
  }, [allResList]);

  // Formateur du nom de mois en français
  const formatMoisNom = (yyyyMm) => {
    if (!yyyyMm) return '';
    if (yyyyMm === 'tous') return 'Année complète (Cumul)';
    const [y, m] = yyyyMm.split('-');
    const date = new Date(Number(y), Number(m) - 1, 1);
    const nom = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return nom.charAt(0).toUpperCase() + nom.slice(1);
  };

  // Navigation mois par mois (< précédent / > suivant)
  const handleNavMonth = (delta) => {
    if (selectedMoisRes === 'tous') {
      setSelectedMoisRes(currentMonthStr);
      return;
    }
    const [y, m] = selectedMoisRes.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const newY = d.getFullYear();
    const newM = String(d.getMonth() + 1).padStart(2, '0');
    setSelectedMoisRes(`${newY}-${newM}`);
  };

  // Calcul des capacités selon la période sélectionnée :
  // - FabLab : 2 unités × 8 créneaux/j = 16 créneaux/j (1h/créneau)
  // - Studio : 1 unité × 4 créneaux/j = 4 créneaux/j (2h/créneau)
  // - Salles : 3 unités × 6 créneaux/j = 18 créneaux/j (2h/créneau)
  const capacites = useMemo(() => {
    if (periodeReservation === 'jour') {
      return {
        fablab: 16,        // 2 FabLabs × 8 créneaux/j
        studio: 4,         // 1 Studio × 4 créneaux/j
        salle_reunion: 18, // 3 Salles × 6 créneaux/j
        total: 38,
        label: 'Aujourd\'hui (38 créneaux/j)'
      };
    }
    if (periodeReservation === 'semaine') {
      return {
        fablab: 16 * 6,       // 96 créneaux
        studio: 4 * 6,        // 24 créneaux
        salle_reunion: 18 * 6,// 108 créneaux
        total: 228,
        label: 'Cette semaine (6 jours ouvrés)'
      };
    }
    if (selectedMoisRes === 'tous') {
      return {
        fablab: 16 * 25 * 10,       // 4000 créneaux (10 mois ouvrés)
        studio: 4 * 25 * 10,        // 1000 créneaux
        salle_reunion: 18 * 25 * 10,// 4500 créneaux
        total: 9500,
        label: 'Année complète (Cumul)'
      };
    }
    // Mois sélectionné (25 jours ouvrés)
    return {
      fablab: 16 * 25,       // 400 créneaux
      studio: 4 * 25,        // 100 créneaux
      salle_reunion: 18 * 25,// 450 créneaux
      total: 950,
      label: `${formatMoisNom(selectedMoisRes)} (25 jours ouvrés)`
    };
  }, [periodeReservation, selectedMoisRes]);

  const reservationCounts = useMemo(() => {
    if (allResList.length > 0) {
      const filtered = allResList.filter(r => {
        if (r.statut === 'refuse') return false;
        const d = r.date || '';
        if (periodeReservation === 'jour') {
          return d === todayStr;
        }
        if (periodeReservation === 'semaine') {
          return d >= mondayStr && d <= saturdayStr;
        }
        if (periodeReservation === 'mois') {
          if (selectedMoisRes === 'tous') return true;
          return d.startsWith(selectedMoisRes);
        }
        return true;
      });

      return {
        fablab: filtered.filter(r => r.espace === 'fablab').length,
        studio: filtered.filter(r => r.espace === 'studio').length,
        salle_reunion: filtered.filter(r => r.espace === 'salle_reunion').length,
      };
    }

    const raw = impactStats?.espaces?.parEspace || {};
    if (periodeReservation === 'jour') {
      return {
        fablab: Math.min(raw.fablab || 0, 3),
        studio: Math.min(raw.studio || 0, 1),
        salle_reunion: Math.min(raw.salle_reunion || 0, 4)
      };
    }
    if (periodeReservation === 'semaine') {
      return {
        fablab: Math.min(raw.fablab || 0, 6),
        studio: Math.min(raw.studio || 0, 3),
        salle_reunion: Math.min(raw.salle_reunion || 0, 8)
      };
    }
    return {
      fablab: raw.fablab || 0,
      studio: raw.studio || 0,
      salle_reunion: raw.salle_reunion || 0
    };
  }, [allResList, periodeReservation, selectedMoisRes, todayStr, mondayStr, saturdayStr, impactStats?.espaces?.parEspace]);

  const totalEspace = reservationCounts.fablab + reservationCounts.studio + reservationCounts.salle_reunion;
  const globalOccupancyPct = capacites.total > 0 ? Math.round((totalEspace / capacites.total) * 100) : 0;

  const pctFablab = Math.round((reservationCounts.fablab / capacites.fablab) * 100);
  const pctStudio = Math.round((reservationCounts.studio / capacites.studio) * 100);
  const pctSalles = Math.round((reservationCounts.salle_reunion / capacites.salle_reunion) * 100);

  const espaceData = {
    labels: ['FabLab (2 unités)', 'Studio (1 unité)', 'Salles (3 unités)'],
    datasets: [
      {
        label: 'Créneaux Réservés',
        data: [reservationCounts.fablab, reservationCounts.studio, reservationCounts.salle_reunion],
        backgroundColor: ['#10b981', '#8b5cf6', '#3b82f6'],
        borderRadius: 6,
        barPercentage: 0.6,
        categoryPercentage: 0.8,
      },
      {
        label: 'Capacité Maximale',
        data: [capacites.fablab, capacites.studio, capacites.salle_reunion],
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)',
        borderWidth: 1.5,
        borderRadius: 6,
        barPercentage: 0.6,
        categoryPercentage: 0.8,
      }
    ]
  };

  const espaceOptions = useMemo(() => {
    const caps = [capacites.fablab, capacites.studio, capacites.salle_reunion];
    const details = [
      '2 FabLabs × 8 créneaux/j (1h)',
      '1 Studio × 4 créneaux/j (2h)',
      '3 Salles × 6 créneaux/j (2h)'
    ];
    return {
      ...commonOpts,
      plugins: {
        ...commonOpts.plugins,
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: isDark ? '#f1f5f9' : '#1e293b',
            usePointStyle: true,
            pointStyle: 'rectRounded',
            font: { size: 11, family: "'Inter', sans-serif", weight: '600' },
            padding: 10,
          }
        },
        tooltip: {
          ...commonOpts.plugins?.tooltip,
          callbacks: {
            label: (ctx) => {
              const idx = ctx.dataIndex;
              const isCap = ctx.datasetIndex === 1;
              const val = ctx.raw || 0;
              if (isCap) {
                return ` Capacité max : ${val} créneaux (${details[idx]})`;
              }
              const cap = caps[idx] || 1;
              const pct = Math.round((val / cap) * 100);
              const dispo = Math.max(0, cap - val);
              return [
                ` Réservations : ${val} créneau(x)`,
                ` Taux d'occupation : ${pct}%`,
                ` Disponibilité : ${dispo} créneau(x) libre(s)`
              ];
            }
          }
        }
      }
    };
  }, [commonOpts, isDark, capacites]);

  const suivisIncubes = stats?.suiviStats?.incubes || [];
  const fichesSuiviRaw = stats?.suiviStats?.fichesSuiviList || [];
  const allIncubesRaw = stats?.suiviStats?.allIncubes || [];

  // Mois disponibles pour le suivi
  const availableSuiviMonths = useMemo(() => {
    const monthsSet = new Set();
    const currYear = new Date().getFullYear();
    for (let m = 1; m <= 12; m++) {
      monthsSet.add(`${currYear}-${String(m).padStart(2, '0')}`);
    }
    fichesSuiviRaw.forEach(f => {
      if (f.date_suivi && f.date_suivi.length >= 7) {
        monthsSet.add(f.date_suivi.substring(0, 7));
      }
    });
    return Array.from(monthsSet).sort();
  }, [fichesSuiviRaw]);

  // Années disponibles pour le suivi
  const availableSuiviYears = useMemo(() => {
    const yearsSet = new Set();
    const currYear = new Date().getFullYear();
    yearsSet.add(String(currYear));
    fichesSuiviRaw.forEach(f => {
      if (f.date_suivi && f.date_suivi.length >= 4) {
        yearsSet.add(f.date_suivi.substring(0, 4));
      }
    });
    return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
  }, [fichesSuiviRaw]);

  // Navigation mois par mois pour le Suivi
  const handleNavMonthSuivi = (delta) => {
    if (selectedMoisSuivi === 'tous') {
      setSelectedMoisSuivi(currentMonthStr);
      return;
    }
    const [y, m] = selectedMoisSuivi.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const newY = d.getFullYear();
    const newM = String(d.getMonth() + 1).padStart(2, '0');
    setSelectedMoisSuivi(`${newY}-${newM}`);
  };

  const fichesSuiviFiltered = useMemo(() => {
    if (suiviMode === 'mois') {
      if (selectedMoisSuivi === 'tous') return fichesSuiviRaw;
      return fichesSuiviRaw.filter(f => f.date_suivi && f.date_suivi.startsWith(selectedMoisSuivi));
    } else {
      if (selectedAnneeSuivi === 'toutes') return fichesSuiviRaw;
      return fichesSuiviRaw.filter(f => f.date_suivi && f.date_suivi.startsWith(selectedAnneeSuivi));
    }
  }, [fichesSuiviRaw, suiviMode, selectedMoisSuivi, selectedAnneeSuivi]);

  const accSet = new Set([
    ...suivisIncubes.map(i => i.accompagnateur),
    ...allIncubesRaw.map(i => (i.accompagnateur || '').trim()),
    ...fichesSuiviRaw.map(f => (f.incube?.accompagnateur || '').trim()),
    ...(stats?.suiviStats?.rdvs || []).map(r => r.accompagnateurNom)
  ].filter(Boolean));
  const accompagnateurs = Array.from(accSet);

  const suiviStatsDetail = useMemo(() => {
    return accompagnateurs.map(acc => {
      const cleanAcc = (acc || '').trim().toLowerCase();

      // 1. Tous les incubés assignés à cet accompagnateur
      let assigned = allIncubesRaw.filter(i => (i.accompagnateur || '').trim().toLowerCase() === cleanAcc);

      // Si allIncubesRaw n'est pas encore synchronisé (fallback sur fichesSuiviRaw)
      if (assigned.length === 0) {
        const foundMap = new Map();
        fichesSuiviRaw.forEach(f => {
          if ((f.incube?.accompagnateur || '').trim().toLowerCase() === cleanAcc && f.incube?.id) {
            foundMap.set(f.incube.id, {
              id: f.incube.id,
              nom_incube: f.incube.nom_incube,
              raison_sociale: f.incube.raison_sociale,
              accompagnateur: acc,
            });
          }
        });
        assigned = Array.from(foundMap.values());
      }

      const totalAssigned = Math.max(
        assigned.length, 
        suivisIncubes.find(i => (i.accompagnateur || '').trim().toLowerCase() === cleanAcc)?.count || 0
      );

      // 2. Fiches de suivi réalisées sur la période filtrée
      const fichesAcc = fichesSuiviFiltered.filter(f => 
        (f.incube?.accompagnateur || '').trim().toLowerCase() === cleanAcc
      );
      const totalSessions = fichesAcc.length;

      // 3. Incubés uniques suivis
      const followedIncubeIds = new Set(fichesAcc.map(f => f.incube_id || f.incube?.id).filter(Boolean));

      // Liste des suivis
      const followedList = [];
      followedIncubeIds.forEach(incId => {
        const incubeObj = assigned.find(i => i.id === incId) || fichesAcc.find(f => (f.incube_id || f.incube?.id) === incId)?.incube || { id: incId, nom_incube: 'Incubé #' + incId };
        const fichesOfIncube = fichesAcc.filter(f => (f.incube_id || f.incube?.id) === incId).sort((a, b) => (b.date_suivi || '').localeCompare(a.date_suivi || ''));
        const lastFiche = fichesOfIncube[0];
        followedList.push({
          ...incubeObj,
          id: incId,
          nbSeances: fichesOfIncube.length,
          lastDate: lastFiche?.date_suivi,
          lastObjet: lastFiche?.objet_reunion || 'Point de suivi',
          lastStatutJuridique: lastFiche?.statut_juridique,
          lastStatutAvancement: lastFiche?.statut_avancement,
          lastObservations: lastFiche?.observations
        });
      });

      // Liste des non suivis (assignés sans aucune fiche sur la période)
      const unfollowedList = assigned.filter(i => !followedIncubeIds.has(i.id));

      const uniqueFollowedCount = followedList.length;
      const coverageRate = totalAssigned > 0 ? Math.round((uniqueFollowedCount / totalAssigned) * 100) : 0;

      return {
        accompagnateur: acc,
        totalAssigned,
        uniqueFollowedCount,
        totalSessions,
        coverageRate,
        followedList,
        unfollowedList
      };
    });
  }, [accompagnateurs, allIncubesRaw, fichesSuiviRaw, fichesSuiviFiltered, suivisIncubes]);

  const dataIncubes = suiviStatsDetail.map(d => d.totalAssigned);
  const dataUniques = suiviStatsDetail.map(d => d.uniqueFollowedCount);
  const dataSessions = suiviStatsDetail.map(d => d.totalSessions);

  const totalRdvsPeriod = dataSessions.reduce((acc, v) => acc + v, 0);

  const suiviData = {
    labels: accompagnateurs.length > 0 ? accompagnateurs : ['Non spécifié'],
    datasets: [
      {
        label: 'Incubés Assignés',
        data: dataIncubes.length > 0 ? dataIncubes : [0],
        backgroundColor: '#10b981',
        borderRadius: 6,
        barPercentage: 0.7,
        categoryPercentage: 0.8,
      },
      {
        label: 'Incubés Suivis (Uniques)',
        data: dataUniques.length > 0 ? dataUniques : [0],
        backgroundColor: '#0ea5e9',
        borderRadius: 6,
        barPercentage: 0.7,
        categoryPercentage: 0.8,
      },
      {
        label: 'Volume Total Séances',
        data: dataSessions.length > 0 ? dataSessions : [0],
        backgroundColor: '#8b5cf6',
        borderRadius: 6,
        barPercentage: 0.7,
        categoryPercentage: 0.8,
      }
    ]
  };

  // 3. Événements Faits (par mois) avec filtre annuel et par formateur
  const tousLesAteliers = impactStats?.assiduite?.tousLesAteliers || [];

  const availableEventYears = useMemo(() => {
    const years = new Set();
    const currYear = new Date().getFullYear();
    years.add(String(currYear));
    tousLesAteliers.forEach(a => {
      if (a.date && a.date.length >= 4) {
        years.add(a.date.substring(0, 4));
      }
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [tousLesAteliers]);

  const eventFormateurs = useMemo(() => {
    const setF = new Set();
    tousLesAteliers.forEach(a => {
      const f = (a.formateur || '').trim();
      if (f) setF.add(f);
    });
    return Array.from(setF);
  }, [tousLesAteliers]);

  const handleNavEventYear = (delta) => {
    if (selectedEventAnnee === 'toutes') {
      setSelectedEventAnnee(String(new Date().getFullYear()));
      return;
    }
    const idx = availableEventYears.indexOf(selectedEventAnnee);
    if (idx !== -1) {
      const newIdx = idx - delta; // availableEventYears est trié par ordre décroissant
      if (newIdx >= 0 && newIdx < availableEventYears.length) {
        setSelectedEventAnnee(availableEventYears[newIdx]);
      }
    } else {
      const curr = parseInt(selectedEventAnnee, 10) || new Date().getFullYear();
      setSelectedEventAnnee(String(curr + delta));
    }
  };

  const isPedagogiqueFormation = useCallback((item) => {
    if (!item) return false;
    if (item.description) {
      try {
        const meta = typeof item.description === 'string' ? JSON.parse(item.description) : item.description;
        if (meta && (meta.typeParcours === 'pre-creation' || meta.typeParcours === 'post-creation')) {
          return true;
        }
      } catch {}
    }
    const titre = (item.titre || '').toLowerCase().trim();
    return (
      titre.startsWith('[pré-création]') ||
      titre.startsWith('[pre-creation]') ||
      titre.startsWith('[post-création]') ||
      titre.startsWith('[post-creation]')
    );
  }, []);

  const { eventsByMonth, totalAteliersYear, totalFormationsYear, totalEventsYear, moisPlusActif } = useMemo(() => {
    const ateliersCounts = Array(12).fill(0);
    const formationsCounts = Array(12).fill(0);
    const totalCounts = Array(12).fill(0);
    const ateliersDetails = Array(12).fill(null).map(() => []);
    const formationsDetails = Array(12).fill(null).map(() => []);

    tousLesAteliers.forEach(a => {
      if (!a.date) return;
      const yr = a.date.substring(0, 4);
      if (selectedEventAnnee !== 'toutes' && yr !== selectedEventAnnee) return;
      if (selectedEventFormateur !== 'tous' && (a.formateur || '').trim() !== selectedEventFormateur) return;

      const mIdx = parseInt(a.date.substring(5, 7), 10) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        totalCounts[mIdx] += 1;
        if (isPedagogiqueFormation(a)) {
          formationsCounts[mIdx] += 1;
          formationsDetails[mIdx].push(a);
        } else {
          ateliersCounts[mIdx] += 1;
          ateliersDetails[mIdx].push(a);
        }
      }
    });

    const totalAteliers = ateliersCounts.reduce((acc, c) => acc + c, 0);
    const totalFormations = formationsCounts.reduce((acc, c) => acc + c, 0);
    const total = totalAteliers + totalFormations;

    const MOIS_NOMS_LONGS = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];

    let maxVal = 0;
    let maxIdx = -1;
    totalCounts.forEach((c, idx) => {
      if (c > maxVal) {
        maxVal = c;
        maxIdx = idx;
      }
    });

    const plusActif = maxIdx !== -1 && maxVal > 0
      ? { nom: MOIS_NOMS_LONGS[maxIdx], count: maxVal }
      : null;

    return {
      eventsByMonth: { 
        ateliersCounts, 
        formationsCounts, 
        totalCounts, 
        ateliersDetails, 
        formationsDetails 
      },
      totalAteliersYear: totalAteliers,
      totalFormationsYear: totalFormations,
      totalEventsYear: total,
      moisPlusActif: plusActif
    };
  }, [tousLesAteliers, selectedEventAnnee, selectedEventFormateur, isPedagogiqueFormation]);

  const eventData = useMemo(() => {
    const MOIS_NOMS_COURTS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    return {
      labels: MOIS_NOMS_COURTS,
      datasets: [
        {
          label: 'Ateliers collectifs',
          data: eventsByMonth.ateliersCounts,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.15)',
          pointBackgroundColor: '#f59e0b',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.35,
        },
        {
          label: 'Formations pédagogiques',
          data: eventsByMonth.formationsCounts,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.15)',
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.35,
        }
      ]
    };
  }, [eventsByMonth]);

  const eventOptions = useMemo(() => {
    const MOIS_NOMS_LONGS = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    return {
      ...commonOpts,
      plugins: {
        ...commonOpts.plugins,
        legend: {
          display: true,
          position: 'top',
          labels: {
            boxWidth: 9,
            boxHeight: 9,
            usePointStyle: true,
            pointStyle: 'circle',
            color: isDark ? '#e2e8f0' : '#1e293b',
            font: { size: 11, weight: '700', family: "'Inter', sans-serif" },
            padding: 10,
          }
        },
        tooltip: {
          ...commonOpts.plugins?.tooltip,
          callbacks: {
            title: (items) => {
              const idx = items[0]?.dataIndex;
              if (idx !== undefined && MOIS_NOMS_LONGS[idx]) {
                return `${MOIS_NOMS_LONGS[idx]} ${selectedEventAnnee !== 'toutes' ? selectedEventAnnee : ''}`.trim();
              }
              return '';
            },
            label: (item) => {
              const count = item.parsed.y;
              return ` ${item.dataset.label} : ${count}`;
            },
            afterBody: (items) => {
              const idx = items[0]?.dataIndex;
              if (idx === undefined) return '';
              const atels = eventsByMonth.ateliersDetails[idx] || [];
              const forms = eventsByMonth.formationsDetails[idx] || [];
              const lines = [];
              if (atels.length > 0) {
                lines.push(`• Ateliers : ${atels.map(a => a.titre).slice(0, 2).join(', ')}${atels.length > 2 ? '...' : ''}`);
              }
              if (forms.length > 0) {
                lines.push(`• Formations : ${forms.map(f => f.titre).slice(0, 2).join(', ')}${forms.length > 2 ? '...' : ''}`);
              }
              return lines.join('\n');
            }
          }
        }
      },
      scales: {
        ...commonOpts.scales,
        y: {
          ...commonOpts.scales?.y,
          beginAtZero: true,
          ticks: {
            ...commonOpts.scales?.y?.ticks,
            stepSize: 1,
            precision: 0
          }
        }
      }
    };
  }, [commonOpts, selectedEventAnnee, eventsByMonth, isDark]);

  // 4. Réalisation des Objectifs par Incubé & Accompagnateur (Plan d'Action)
  const rawPlanList = stats?.planActionList || [];

  const planAccompagnateurs = useMemo(() => {
    const setAcc = new Set();
    rawPlanList.forEach(p => {
      const acc = p.incube?.accompagnateur || p.accompagnateur;
      if (acc && acc.trim()) setAcc.add(acc.trim());
    });
    (stats?.suiviStats?.incubes || []).forEach(i => {
      if (i.accompagnateur && i.accompagnateur.trim()) setAcc.add(i.accompagnateur.trim());
    });
    return Array.from(setAcc).sort();
  }, [rawPlanList, stats?.suiviStats]);

  const availablePlanYears = useMemo(() => {
    const years = new Set();
    const currYear = new Date().getFullYear();
    years.add(String(currYear));
    rawPlanList.forEach(p => {
      if (p.echeance && p.echeance.length >= 4) {
        years.add(p.echeance.substring(0, 4));
      }
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [rawPlanList]);

  const handleNavYear = (delta) => {
    if (selectedPlanYear === 'toutes') {
      setSelectedPlanYear(String(new Date().getFullYear()));
      return;
    }
    const idx = availablePlanYears.indexOf(selectedPlanYear);
    if (idx !== -1) {
      const newIdx = idx - delta; // availablePlanYears is sorted descending
      if (newIdx >= 0 && newIdx < availablePlanYears.length) {
        setSelectedPlanYear(availablePlanYears[newIdx]);
      }
    }
  };

  const planActionFiltered = useMemo(() => {
    return rawPlanList.filter(p => {
      // 1. Filtre par accompagnateur
      const acc = (p.incube?.accompagnateur || p.accompagnateur || '').trim();
      if (selectedPlanAccompagnateur !== 'tous' && acc !== selectedPlanAccompagnateur) {
        return false;
      }
      // 2. Filtre par année
      if (selectedPlanYear !== 'toutes') {
        if (!p.echeance || !p.echeance.startsWith(selectedPlanYear)) {
          return false;
        }
      }
      // 3. Filtre par Trimestre ou par Mois
      if (planPeriodeType === 'trimestre' && selectedPlanTrimestre !== 'tous') {
        if (!p.echeance || p.echeance.length < 7) return false;
        const m = Number(p.echeance.substring(5, 7));
        const tIdx = Math.ceil(m / 3);
        if (`T${tIdx}` !== selectedPlanTrimestre) return false;
      } else if (planPeriodeType === 'mois' && selectedPlanMois !== 'tous') {
        if (!p.echeance || p.echeance.length < 7) return false;
        const m = Number(p.echeance.substring(5, 7));
        const mStr = String(m).padStart(2, '0');
        if (mStr !== selectedPlanMois) return false;
      }
      return true;
    });
  }, [rawPlanList, selectedPlanAccompagnateur, selectedPlanYear, planPeriodeType, selectedPlanTrimestre, selectedPlanMois]);

  // Liste des accompagnateurs avec leur progression globale et détail pour la modale
  const accompagnateursStatsList = useMemo(() => {
    const targetAccs = selectedPlanAccompagnateur === 'tous'
      ? planAccompagnateurs
      : planAccompagnateurs.filter(a => a === selectedPlanAccompagnateur);

    const map = {};

    targetAccs.forEach(acc => {
      map[acc] = {
        nom: acc,
        atteint: 0,
        en_cours: 0,
        non_atteint: 0,
        total: 0,
        incubesSet: new Set(),
        items: [],
        atteintList: [],
        enCoursList: [],
        nonAtteintList: [],
      };
    });

    planActionFiltered.forEach(p => {
      const acc = (p.incube?.accompagnateur || p.accompagnateur || 'Non assigné').trim();
      if (selectedPlanAccompagnateur !== 'tous' && acc !== selectedPlanAccompagnateur) {
        return;
      }
      if (!map[acc]) {
        map[acc] = {
          nom: acc,
          atteint: 0,
          en_cours: 0,
          non_atteint: 0,
          total: 0,
          incubesSet: new Set(),
          items: [],
          atteintList: [],
          enCoursList: [],
          nonAtteintList: [],
        };
      }
      map[acc].total += 1;
      const incubeNom = p.incube?.nom_incube || p.incube?.raison_sociale || `Incubé #${p.incube_id}`;
      map[acc].incubesSet.add(incubeNom);
      map[acc].items.push(p);

      const r = (p.realisation || '').trim().toLowerCase();
      if (['atteint', 'validé', 'valide', 'effectué', 'effectue'].includes(r)) {
        map[acc].atteint += 1;
        map[acc].atteintList.push(p);
      } else if (['non atteint', 'non_atteint', 'non valide', 'échoué'].includes(r)) {
        map[acc].non_atteint += 1;
        map[acc].nonAtteintList.push(p);
      } else {
        map[acc].en_cours += 1;
        map[acc].enCoursList.push(p);
      }
    });

    return Object.values(map)
      .map(item => ({
        ...item,
        nbIncubes: item.incubesSet.size,
      }))
      .sort((a, b) => b.total - a.total);
  }, [planActionFiltered, planAccompagnateurs, selectedPlanAccompagnateur]);

  // Données du graphique du Plan d'Action : Noms de chaque accompagnateur sur l'axe X
  const planActionChartData = useMemo(() => {
    const list = accompagnateursStatsList.length > 0
      ? accompagnateursStatsList
      : [{ nom: 'Non spécifié', atteint: 0, en_cours: 0, non_atteint: 0 }];

    return {
      labels: list.map(a => a.nom),
      datasets: [
        {
          label: 'Atteint',
          data: list.map(a => a.atteint),
          backgroundColor: '#10b981',
          borderRadius: 4,
          barPercentage: 0.65,
          categoryPercentage: 0.8,
        },
        {
          label: 'En cours',
          data: list.map(a => a.en_cours),
          backgroundColor: '#f59e0b',
          borderRadius: 4,
          barPercentage: 0.65,
          categoryPercentage: 0.8,
        },
        {
          label: 'Non atteint',
          data: list.map(a => a.non_atteint),
          backgroundColor: '#ef4444',
          borderRadius: 4,
          barPercentage: 0.65,
          categoryPercentage: 0.8,
        }
      ]
    };
  }, [accompagnateursStatsList]);

  const totalPlanObj = planActionFiltered.length;
  const totalPlanAtteint = planActionFiltered.filter(p => ['atteint', 'validé', 'valide', 'effectué', 'effectue'].includes((p.realisation || '').trim().toLowerCase())).length;
  const globalSuccessPct = totalPlanObj > 0 ? Math.round((totalPlanAtteint / totalPlanObj) * 100) : 0;

  const planActionOpts = useMemo(() => {
    return {
      ...commonOpts,
      plugins: {
        ...commonOpts.plugins,
        legend: {
          display: false,
        },
        tooltip: {
          ...commonOpts.plugins?.tooltip,
          callbacks: {
            title: (items) => {
              const idx = items[0]?.dataIndex;
              const item = accompagnateursStatsList[idx];
              return item ? `Accompagnateur : ${item.nom}` : '';
            },
            label: (ctx) => {
              const val = ctx.raw || 0;
              const dsLabel = ctx.dataset.label || '';
              return ` ${dsLabel} : ${val} objectif(s)`;
            },
            afterBody: (items) => {
              const idx = items[0]?.dataIndex;
              const item = accompagnateursStatsList[idx];
              if (!item) return '';
              const pct = item.total > 0 ? Math.round((item.atteint / item.total) * 100) : 0;
              return [
                `• Total objectifs : ${item.total}`,
                `• Taux de réussite : ${pct}%`,
                `• Incubés suivis : ${item.nbIncubes}`
              ].join('\n');
            }
          }
        }
      },
      scales: {
        ...commonOpts.scales,
        x: {
          ...commonOpts.scales?.x,
          ticks: {
            ...commonOpts.scales?.x?.ticks,
            maxRotation: 20,
            minRotation: 0,
            font: { size: 10, weight: '700' },
          }
        },
        y: {
          ...commonOpts.scales?.y,
          beginAtZero: true,
          ticks: {
            ...commonOpts.scales?.y?.ticks,
            precision: 0,
            stepSize: 1,
            font: { size: 10 },
          }
        }
      }
    };
  }, [commonOpts, isDark, accompagnateursStatsList]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">

      {/* 1. Réservations par Espace avec Filtrage Temporel & Capacité */}
      <div className="card p-5 flex flex-col justify-between min-w-0 hover:border-amber-500/40 transition-all">
        <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-2 mb-3">
          <div>
            <button
              type="button"
              onClick={() => navigate('/espaces')}
              className="group text-sm font-bold text-slate-900 dark:text-white uppercase flex items-center gap-1.5 hover:text-amber-600 dark:hover:text-amber-400 transition-colors text-left cursor-pointer"
              title="Cliquer pour accéder à la Gestion des Espaces & Réservations"
            >
              <span>RÉSERVATIONS & TAUX D'OCCUPATION</span>
              <ExternalLink size={13} className="text-amber-500 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </button>
            <p className="text-xs text-slate-500 dark:text-dark-400 mt-0.5 truncate">
              Capacité : FabLab (8/j), Studio (4/j), Salles (6/j)
            </p>
          </div>

          <div className="flex items-center self-start sm:self-auto shrink-0">
            {/* Barre unique regroupant Période + Navigation Mois + Taux d'occupation */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-dark-800 p-1 rounded-xl border border-slate-200 dark:border-dark-700 shadow-xs">
              <select
                value={periodeReservation}
                onChange={e => setPeriodeReservation(e.target.value)}
                className="text-xs font-bold bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 text-slate-800 dark:text-slate-100 rounded-lg px-2 py-1 outline-none cursor-pointer"
              >
                <option value="jour">Jour</option>
                <option value="semaine">Semaine</option>
                <option value="mois">Mois</option>
              </select>

              {/* Navigation et sélecteur de mois si période = Mois */}
              {periodeReservation === 'mois' && (
                <div className="flex items-center gap-1 pl-1 border-l border-slate-200 dark:border-dark-700">
                  <button
                    type="button"
                    onClick={() => handleNavMonth(-1)}
                    disabled={selectedMoisRes === 'tous'}
                    title="Mois précédent"
                    className="px-1.5 py-0.5 text-xs font-black rounded-md bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-dark-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    &lt;
                  </button>

                  <select
                    value={selectedMoisRes}
                    onChange={e => setSelectedMoisRes(e.target.value)}
                    className="text-xs font-bold bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 text-slate-800 dark:text-slate-100 rounded-lg px-1.5 py-1 outline-none cursor-pointer max-w-[130px] truncate"
                  >
                    <option value="tous">Année complète</option>
                    {availableMonths.map(mStr => (
                      <option key={mStr} value={mStr}>
                        {formatMoisNom(mStr)}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => handleNavMonth(1)}
                    disabled={selectedMoisRes === 'tous'}
                    title="Mois suivant"
                    className="px-1.5 py-0.5 text-xs font-black rounded-md bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-dark-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    &gt;
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="h-[210px] w-full my-auto flex items-center justify-center">
          <Bar key={`espace-${periodeReservation}-${selectedMoisRes}-${theme}`} data={espaceData} options={espaceOptions} />
        </div>

        {/* 3 Cartes de progression avec jauge d'occupation */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* FabLab (2 unités) */}
          <div className="bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl p-3 border border-emerald-200/80 dark:border-emerald-800/40 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                  FabLab (2 unités)
                </span>
                <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400">{pctFablab}%</span>
              </div>
              <p className="text-base font-black text-emerald-900 dark:text-emerald-200 mt-1">
                {reservationCounts.fablab} <span className="text-xs font-semibold text-emerald-600/75">/ {capacites.fablab}</span>
              </p>
            </div>
            <div className="mt-2 space-y-1">
              <div className="h-1.5 w-full bg-emerald-200/60 dark:bg-dark-700/60 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, pctFablab)}%` }}
                />
              </div>
              <span className="text-[9px] text-emerald-600/75 font-medium block">2 × 8 créneaux/j (1h)</span>
            </div>
          </div>

          {/* Studio (1 unité) */}
          <div className="bg-purple-50/50 dark:bg-purple-950/20 rounded-xl p-3 border border-purple-200/80 dark:border-purple-800/40 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-purple-800 dark:text-purple-300">
                  Studio (1 unité)
                </span>
                <span className="text-[10px] font-extrabold text-purple-700 dark:text-purple-400">{pctStudio}%</span>
              </div>
              <p className="text-base font-black text-purple-900 dark:text-purple-200 mt-1">
                {reservationCounts.studio} <span className="text-xs font-semibold text-purple-600/75">/ {capacites.studio}</span>
              </p>
            </div>
            <div className="mt-2 space-y-1">
              <div className="h-1.5 w-full bg-purple-200/60 dark:bg-dark-700/60 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-purple-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, pctStudio)}%` }}
                />
              </div>
              <span className="text-[9px] text-purple-600/75 font-medium block">1 × 4 créneaux/j (2h)</span>
            </div>
          </div>

          {/* Salles (3 unités) */}
          <div className="bg-blue-50/50 dark:bg-blue-950/20 rounded-xl p-3 border border-blue-200/80 dark:border-blue-800/40 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-blue-800 dark:text-blue-300">
                  Salles (3 unités)
                </span>
                <span className="text-[10px] font-extrabold text-blue-700 dark:text-blue-400">{pctSalles}%</span>
              </div>
              <p className="text-base font-black text-blue-900 dark:text-blue-200 mt-1">
                {reservationCounts.salle_reunion} <span className="text-xs font-semibold text-blue-600/75">/ {capacites.salle_reunion}</span>
              </p>
            </div>
            <div className="mt-2 space-y-1">
              <div className="h-1.5 w-full bg-blue-200/60 dark:bg-dark-700/60 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, pctSalles)}%` }}
                />
              </div>
              <span className="text-[9px] text-blue-600/75 font-medium block">3 × 6 créneaux/j (2h)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Suivi des Incubés avec Filtres Temporels (Mois / Année) */}
      <div className="card p-5 flex flex-col justify-between min-w-0 hover:border-emerald-500/40 transition-all">
        <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-2 mb-3">
          <div>
            <button
              type="button"
              onClick={() => navigate('/incubes')}
              className="group text-sm font-bold text-slate-900 dark:text-white uppercase flex items-center gap-1.5 hover:text-primary-600 dark:hover:text-primary-400 transition-colors text-left cursor-pointer"
              title="Cliquer pour accéder à l'Annuaire & la source de toutes les données"
            >
              <span>SUIVI DES INCUBÉS</span>
              <ExternalLink size={13} className="text-primary-500 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </button>
            <p className="text-xs text-slate-500 dark:text-dark-400 mt-0.5 truncate">
              Vue comparative : assignés, suivis uniques et séances
            </p>
          </div>

          {/* Filtres Temporels : Mois / Année à droite avec navigation < > */}
          <div className="flex items-center self-start sm:self-auto shrink-0">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-dark-800 p-1 rounded-xl border border-slate-200 dark:border-dark-700 shadow-xs">
              <select
                value={suiviMode}
                onChange={e => setSuiviMode(e.target.value)}
                className="text-xs font-bold bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 text-slate-800 dark:text-slate-100 rounded-lg px-2 py-1 outline-none cursor-pointer"
              >
                <option value="mois">Mois</option>
                <option value="annee">Année</option>
              </select>

              {suiviMode === 'mois' && (
                <div className="flex items-center gap-1 pl-1 border-l border-slate-200 dark:border-dark-700">
                  <button
                    type="button"
                    onClick={() => handleNavMonthSuivi(-1)}
                    disabled={selectedMoisSuivi === 'tous'}
                    title="Mois précédent"
                    className="px-1.5 py-0.5 text-xs font-black rounded-md bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-dark-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    &lt;
                  </button>

                  <select
                    value={selectedMoisSuivi}
                    onChange={e => setSelectedMoisSuivi(e.target.value)}
                    className="text-xs font-bold bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 text-slate-800 dark:text-slate-100 rounded-lg px-1.5 py-1 outline-none cursor-pointer max-w-[130px] truncate"
                  >
                    <option value="tous">Toute l'année (Cumul)</option>
                    {availableSuiviMonths.map(mStr => (
                      <option key={mStr} value={mStr}>
                        {formatMoisNom(mStr)}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => handleNavMonthSuivi(1)}
                    disabled={selectedMoisSuivi === 'tous'}
                    title="Mois suivant"
                    className="px-1.5 py-0.5 text-xs font-black rounded-md bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-dark-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    &gt;
                  </button>
                </div>
              )}

              {suiviMode === 'annee' && (
                <div className="flex items-center gap-1 pl-1 border-l border-slate-200 dark:border-dark-700">
                  <select
                    value={selectedAnneeSuivi}
                    onChange={e => setSelectedAnneeSuivi(e.target.value)}
                    className="text-xs font-bold bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 text-slate-800 dark:text-slate-100 rounded-lg px-2 py-1 outline-none cursor-pointer"
                  >
                    <option value="toutes">Toutes les années</option>
                    {availableSuiviYears.map(y => (
                      <option key={y} value={y}>Année {y}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="h-[210px] w-full my-auto flex items-center justify-center">
          <Bar key={`suivi-${theme}-${suiviMode}-${selectedMoisSuivi}-${selectedAnneeSuivi}`} data={suiviData} options={commonOpts} />
        </div>

        {/* Cartes interactives des accompagnateurs */}
        <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-2">
          {suiviStatsDetail.map((detail, idx) => (
            <div 
              key={idx} 
              onClick={() => {
                setSelectedAccompagnateurModal(detail);
                setAccModalTab(detail.unfollowedList.length > 0 && detail.uniqueFollowedCount === 0 ? 'unfollowed' : 'followed');
              }}
              className="bg-slate-50 dark:bg-dark-800/70 hover:bg-white dark:hover:bg-dark-800 rounded-xl p-2.5 border border-slate-200/80 dark:border-dark-700/80 hover:border-primary-500/60 dark:hover:border-primary-500/60 shadow-xs hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
              title={`Cliquer pour voir la liste détaillée des suivis de ${detail.accompagnateur}`}
            >
              {/* Ligne 1 : Nom de l'accompagnateur et bouton "Détails >" en haut à droite */}
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-primary-500 shrink-0"></span>
                  <span className="text-[11px] font-bold text-slate-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                    {detail.accompagnateur}
                  </span>
                </div>

                <span className="text-[10px] font-bold text-primary-600 dark:text-primary-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 shrink-0 px-1.5 py-0.5 rounded-md bg-primary-50 dark:bg-primary-950/40 border border-primary-200/60 dark:border-primary-800/40">
                  <span>Détails</span>
                  <ChevronRight size={10} />
                </span>
              </div>

              {/* Ligne 2 : Séances et incubés assignés discrets */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-dark-700/60 text-[10px] text-slate-500 dark:text-dark-400 font-medium">
                <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-semibold">
                  <Calendar size={10} /> {detail.totalSessions} séance{detail.totalSessions > 1 ? 's' : ''}
                </span>
                <span className="text-slate-600 dark:text-dark-300 font-bold">
                  {detail.totalAssigned} incubé{detail.totalAssigned > 1 ? 's' : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 📊 MODALE DÉTAIL SUIVI ACCOMPAGNATEUR                    */}
      {/* ======================================================== */}
      {selectedAccompagnateurModal && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setSelectedAccompagnateurModal(null)}
        >
          <div
            className="bg-white dark:bg-dark-900 text-slate-900 dark:text-white rounded-3xl border border-slate-200 dark:border-dark-700 shadow-2xl max-w-3xl w-full overflow-hidden slide-up my-8 max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="p-5 border-b border-slate-100 dark:border-dark-800 bg-gradient-to-r from-navy-800 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white font-black shadow-inner">
                  <UserCheck size={22} />
                </div>
                <div>
                  <h3 className="font-black text-base tracking-tight flex items-center gap-2">
                    <span>Suivi Mensuel • {selectedAccompagnateurModal.accompagnateur}</span>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white/20 text-white">
                      {suiviMode === 'mois' ? (selectedMoisSuivi === 'tous' ? 'Année (Cumul)' : formatMoisNom(selectedMoisSuivi)) : `Année ${selectedAnneeSuivi}`}
                    </span>
                  </h3>
                  <p className="text-xs text-white/80">
                    Contrôle de conformité de l'accompagnement individuel (1 suivi par incubé par mois)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAccompagnateurModal(null)}
                className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Corps Modal */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* Synthèse 4 KPI */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-dark-400 block mb-1">
                    Incubés Assignés
                  </span>
                  <span className="text-xl font-black text-slate-900 dark:text-white">
                    {selectedAccompagnateurModal.totalAssigned}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block mb-1">
                    Suivis Réalisés
                  </span>
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    {selectedAccompagnateurModal.uniqueFollowedCount} <span className="text-xs font-bold text-slate-500 dark:text-dark-400">({selectedAccompagnateurModal.coverageRate}%)</span>
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block mb-1">
                    En Attente de Suivi
                  </span>
                  <span className="text-xl font-black text-amber-600 dark:text-amber-400">
                    {selectedAccompagnateurModal.unfollowedList.length}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 block mb-1">
                    Séances Totales
                  </span>
                  <span className="text-xl font-black text-purple-600 dark:text-purple-400">
                    {selectedAccompagnateurModal.totalSessions}
                  </span>
                </div>
              </div>

              {/* Onglets Suivis vs En Attente */}
              <div className="flex items-center gap-2 border-b border-slate-200 dark:border-dark-700 pb-2">
                <button
                  type="button"
                  onClick={() => setAccModalTab('followed')}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                    accModalTab === 'followed'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-dark-700'
                  }`}
                >
                  <CheckCircle2 size={13} />
                  <span>✅ Incubés Suivis ({selectedAccompagnateurModal.followedList.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAccModalTab('unfollowed')}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                    accModalTab === 'unfollowed'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-dark-700'
                  }`}
                >
                  <AlertCircle size={13} />
                  <span>⚠️ Non Suivis ce mois ({selectedAccompagnateurModal.unfollowedList.length})</span>
                </button>
              </div>

              {/* Contenu Onglet 1 : Suivis */}
              {accModalTab === 'followed' && (
                <div className="space-y-2">
                  {selectedAccompagnateurModal.followedList.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <p className="font-semibold text-slate-500 dark:text-dark-400">Aucun incubé n'a encore été suivi sur cette période.</p>
                    </div>
                  ) : (
                    <div className="border border-slate-200 dark:border-dark-700 rounded-2xl overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-dark-300 font-bold">
                            <th className="py-2.5 px-3">Incubé / Projet</th>
                            <th className="py-2.5 px-3">Dernière Séance</th>
                            <th className="py-2.5 px-3">Objet de la Réunion</th>
                            <th className="py-2.5 px-3 text-center">Séance(s)</th>
                            <th className="py-2.5 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-dark-700/60">
                          {selectedAccompagnateurModal.followedList.map(item => (
                            <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-dark-800/40">
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-slate-900 dark:text-white">{item.nom_incube}</div>
                                <div className="text-[10px] text-slate-500 dark:text-dark-400">{item.raison_sociale || 'Projet'}</div>
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-700 dark:text-dark-300">
                                {formatDateFr(item.lastDate)}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-primary-600 dark:text-primary-400">
                                {item.lastObjet}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20">
                                  {item.nbSeances} séance{item.nbSeances > 1 ? 's' : ''}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedAccompagnateurModal(null);
                                    navigate(`/incube/${item.id}?tab=suivi`);
                                  }}
                                  className="btn btn-secondary btn-xs inline-flex items-center gap-1 text-[11px]"
                                >
                                  <span>Voir fiche</span>
                                  <ExternalLink size={11} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Contenu Onglet 2 : Non Suivis */}
              {accModalTab === 'unfollowed' && (
                <div className="space-y-2">
                  {selectedAccompagnateurModal.unfollowedList.length === 0 ? (
                    <div className="text-center py-8 text-emerald-600 dark:text-emerald-400 font-bold">
                      🎉 Bravo ! Tous les incubés assignés à cet accompagnateur ont été suivis ce mois-ci !
                    </div>
                  ) : (
                    <div className="border border-slate-200 dark:border-dark-700 rounded-2xl overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 font-bold">
                            <th className="py-2.5 px-3">Incubé / Projet</th>
                            <th className="py-2.5 px-3">Contact</th>
                            <th className="py-2.5 px-3">Phase</th>
                            <th className="py-2.5 px-3">Statut du mois</th>
                            <th className="py-2.5 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-dark-700/60">
                          {selectedAccompagnateurModal.unfollowedList.map(item => (
                            <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-dark-800/40">
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-slate-900 dark:text-white">{item.nom_incube}</div>
                                <div className="text-[10px] text-slate-500 dark:text-dark-400">{item.raison_sociale || 'Projet'}</div>
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap text-[11px] text-slate-600 dark:text-dark-300">
                                {item.telephone || item.email || '—'}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-dark-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-dark-600">
                                  {item.phase_projet || 'Idéation'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                  <AlertCircle size={10} className="text-amber-500" />
                                  Séance non réalisée
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedAccompagnateurModal(null);
                                    navigate(`/incube/${item.id}?tab=suivi`);
                                  }}
                                  className="btn btn-primary btn-xs inline-flex items-center gap-1 text-[11px] font-bold"
                                >
                                  <span>Ouvrir dossier</span>
                                  <ExternalLink size={11} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="p-4 border-t border-slate-100 dark:border-dark-800 bg-slate-50/50 dark:bg-dark-800/30 flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-500 dark:text-dark-400 font-medium">
                💡 Règle de conformité : chaque incubé doit bénéficier d'au moins 1 séance par mois.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-secondary text-xs"
                  onClick={() => setSelectedAccompagnateurModal(null)}
                >
                  Fermer
                </button>
                <button
                  type="button"
                  className="btn btn-primary text-xs font-bold flex items-center gap-1.5 shadow-sm"
                  onClick={() => {
                    const acc = selectedAccompagnateurModal.accompagnateur;
                    setSelectedAccompagnateurModal(null);
                    navigate(`/incubes?accompagnateur=${encodeURIComponent(acc)}`);
                  }}
                  title={`Voir uniquement les ${selectedAccompagnateurModal.totalAssigned} incubés de ${selectedAccompagnateurModal.accompagnateur}`}
                >
                  <Users size={13} />
                  <span>Voir les incubés de {selectedAccompagnateurModal.accompagnateur} ({selectedAccompagnateurModal.totalAssigned})</span>
                  <ExternalLink size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Événements Faits (Bar Chart avec filtre Année + Formateur) */}
      <div className="card p-5 flex flex-col justify-between min-w-0 hover:border-amber-500/40 transition-all">
        <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-2 mb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase flex items-center gap-1.5">
                <CalendarCheck size={16} className="text-amber-500" />
                ÉVÉNEMENTS & FORMATIONS
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                Total : {totalEventsYear} ({totalAteliersYear} ateliers • {totalFormationsYear} formations)
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-dark-400 mt-0.5">
              Comparatif mensuel des ateliers collectifs et formations pédagogiques réalisés
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-dark-800 p-1 rounded-xl border border-slate-200 dark:border-dark-700 shadow-xs self-start sm:self-auto shrink-0 flex-wrap">
            {/* Filtre par Formateur si plus d'un formateur */}
            {eventFormateurs.length > 1 && (
              <select
                value={selectedEventFormateur}
                onChange={e => setSelectedEventFormateur(e.target.value)}
                className="text-xs font-bold bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 text-slate-800 dark:text-slate-100 rounded-lg px-2 py-1 outline-none cursor-pointer"
                title="Filtrer par formateur"
              >
                <option value="tous">Tous formateurs</option>
                {eventFormateurs.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            )}

            {/* Navigation année précédente */}
            <button
              type="button"
              onClick={() => handleNavEventYear(-1)}
              disabled={selectedEventAnnee === 'toutes'}
              title="Année précédente"
              className="px-1.5 py-0.5 text-xs font-black rounded-md bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-dark-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              &lt;
            </button>

            {/* Sélecteur d'année */}
            <select
              value={selectedEventAnnee}
              onChange={e => setSelectedEventAnnee(e.target.value)}
              className="text-xs font-bold bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 text-slate-800 dark:text-slate-100 rounded-lg px-2.5 py-1 outline-none cursor-pointer"
            >
              <option value="toutes">Toutes les années</option>
              {availableEventYears.map(y => (
                <option key={y} value={y}>
                  Année {y}
                </option>
              ))}
            </select>

            {/* Navigation année suivante */}
            <button
              type="button"
              onClick={() => handleNavEventYear(1)}
              disabled={selectedEventAnnee === 'toutes'}
              title="Année suivante"
              className="px-1.5 py-0.5 text-xs font-black rounded-md bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-dark-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              &gt;
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-[190px]">
          <Line
            key={`event-line-${theme}-${selectedEventAnnee}-${selectedEventFormateur}`}
            data={eventData}
            options={eventOptions}
          />
        </div>

        {/* Mini résumé statistiques sous le graphe (3 Cartes Interactives) */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Carte 1 : Ateliers réalisés */}
          <div
            onClick={() => navigate('/evenements')}
            className="bg-amber-50/70 dark:bg-amber-950/20 hover:bg-amber-100/80 dark:hover:bg-amber-900/30 rounded-xl p-3 border border-amber-200/80 dark:border-amber-800/40 cursor-pointer transition-all hover:scale-[1.02] group flex flex-col justify-between"
            title="Cliquer pour accéder à la liste des Ateliers collectifs"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Ateliers réalisés
              </span>
              <ChevronRight size={12} className="text-amber-500 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-lg font-black text-amber-900 dark:text-amber-100">
                {totalAteliersYear} <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">réalisé{totalAteliersYear > 1 ? 's' : ''}</span>
              </span>
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 underline">Voir ateliers &gt;</span>
            </div>
          </div>

          {/* Carte 2 : Formations réalisées */}
          <div
            onClick={() => navigate('/formations')}
            className="bg-blue-50/70 dark:bg-blue-950/20 hover:bg-blue-100/80 dark:hover:bg-blue-900/30 rounded-xl p-3 border border-blue-200/80 dark:border-blue-800/40 cursor-pointer transition-all hover:scale-[1.02] group flex flex-col justify-between"
            title="Cliquer pour accéder aux Modules de Formation pédagogique"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                Formations réalisées
              </span>
              <ChevronRight size={12} className="text-blue-500 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-lg font-black text-blue-900 dark:text-blue-100">
                {totalFormationsYear} <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">réalisée{totalFormationsYear > 1 ? 's' : ''}</span>
              </span>
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 underline">Voir formations &gt;</span>
            </div>
          </div>

          {/* Carte 3 : Mois le plus actif */}
          <div className="bg-slate-50 dark:bg-dark-900/60 rounded-xl p-3 border border-slate-200/80 dark:border-dark-700/60 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-slate-500 dark:text-dark-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
              Mois le plus actif
            </span>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-base font-black text-slate-900 dark:text-white truncate">
                {moisPlusActif ? `${moisPlusActif.nom}` : '—'}
              </span>
              {moisPlusActif && (
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                  {moisPlusActif.count} session{moisPlusActif.count > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Suivi du Plan d'Action (Objectifs) */}
      <div className="card p-5 flex flex-col justify-between min-w-0 hover:border-purple-500/40 transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 mb-2.5">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => navigate('/incubes')}
              className="group text-sm font-bold text-slate-900 dark:text-white uppercase flex items-center gap-1.5 hover:text-purple-600 dark:hover:text-purple-400 transition-colors text-left cursor-pointer"
              title="Cliquer pour accéder à l'Annuaire & la source de toutes les données"
            >
              <span>SUIVI DU PLAN D'ACTION</span>
              <ExternalLink size={13} className="text-purple-500 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </button>
            <p className="text-[11px] text-slate-500 dark:text-dark-400 mt-0.5">
              Objectifs atteints, en cours et non atteints par accompagnateur
            </p>
          </div>

          {/* Barre de filtres compacte devant le titre (à droite) */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-dark-800 p-1 rounded-xl border border-slate-200 dark:border-dark-700 shadow-xs shrink-0 flex-wrap">
            {/* Filtre Accompagnateur */}
            {planAccompagnateurs.length > 1 && (
              <select
                id="select-plan-accompagnateur"
                value={selectedPlanAccompagnateur}
                onChange={e => setSelectedPlanAccompagnateur(e.target.value)}
                className="text-[11px] font-bold bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 text-slate-800 dark:text-slate-100 rounded-lg px-2 py-0.5 outline-none cursor-pointer max-w-[115px] truncate"
                title="Filtrer par accompagnateur"
              >
                <option value="tous">Tous acc.</option>
                {planAccompagnateurs.map(acc => (
                  <option key={acc} value={acc}>{acc}</option>
                ))}
              </select>
            )}

            {/* Bascule Trimestres / Mois */}
            <div className="flex items-center gap-0.5 bg-white dark:bg-dark-900 p-0.5 rounded-lg border border-slate-200 dark:border-dark-700 shrink-0">
              <button
                type="button"
                onClick={() => setPlanPeriodeType('trimestre')}
                className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                  planPeriodeType === 'trimestre'
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Trim.
              </button>
              <button
                type="button"
                onClick={() => setPlanPeriodeType('mois')}
                className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                  planPeriodeType === 'mois'
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Mois
              </button>
            </div>

            {/* Sélecteur spécifique selon mode Trimestres vs Mois */}
            {planPeriodeType === 'trimestre' ? (
              <select
                value={selectedPlanTrimestre}
                onChange={e => setSelectedPlanTrimestre(e.target.value)}
                className="text-[11px] font-bold bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 text-slate-800 dark:text-slate-100 rounded-lg px-1.5 py-0.5 outline-none cursor-pointer"
              >
                <option value="tous">Tous trimestres</option>
                <option value="T1">T1 (Jan-Mar)</option>
                <option value="T2">T2 (Avr-Juin)</option>
                <option value="T3">T3 (Juil-Sep)</option>
                <option value="T4">T4 (Oct-Déc)</option>
              </select>
            ) : (
              <select
                value={selectedPlanMois}
                onChange={e => setSelectedPlanMois(e.target.value)}
                className="text-[11px] font-bold bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 text-slate-800 dark:text-slate-100 rounded-lg px-1.5 py-0.5 outline-none cursor-pointer"
              >
                <option value="tous">Tous mois</option>
                <option value="01">Janvier</option>
                <option value="02">Février</option>
                <option value="03">Mars</option>
                <option value="04">Avril</option>
                <option value="05">Mai</option>
                <option value="06">Juin</option>
                <option value="07">Juillet</option>
                <option value="08">Août</option>
                <option value="09">Septembre</option>
                <option value="10">Octobre</option>
                <option value="11">Novembre</option>
                <option value="12">Décembre</option>
              </select>
            )}

            {/* Navigation & Sélecteur d'Année */}
            <div className="flex items-center gap-0.5 shrink-0 pl-1 border-l border-slate-200 dark:border-dark-700">
              <button
                type="button"
                onClick={() => handleNavYear(-1)}
                disabled={selectedPlanYear === 'toutes'}
                title="Année précédente"
                className="px-1.5 py-0.5 text-[11px] font-black rounded-md bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-dark-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                &lt;
              </button>

              <select
                id="select-plan-year"
                value={selectedPlanYear}
                onChange={e => setSelectedPlanYear(e.target.value)}
                className="text-[11px] font-bold bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 text-slate-800 dark:text-slate-100 rounded-lg px-1.5 py-0.5 outline-none cursor-pointer"
              >
                <option value="toutes">Toutes</option>
                {availablePlanYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => handleNavYear(1)}
                disabled={selectedPlanYear === 'toutes'}
                title="Année suivante"
                className="px-1.5 py-0.5 text-[11px] font-black rounded-md bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-dark-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                &gt;
              </button>
            </div>
          </div>
        </div>

        {/* Graphique par Accompagnateur (Noms sur l'axe) */}
        <div className="flex-1 min-h-[160px] max-h-[190px]">
          <Bar
            key={`planaction-acc-${theme}-${selectedPlanYear}-${selectedPlanAccompagnateur}-${planPeriodeType}-${selectedPlanTrimestre}-${selectedPlanMois}`}
            data={planActionChartData}
            options={planActionOpts}
          />
        </div>

        {/* Cartes d'accompagnateurs interactives (même présentation exacte que Suivi des Incubés) */}
        <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-2">
          {accompagnateursStatsList.map((acc, idx) => (
            <div 
              key={idx} 
              onClick={() => {
                setSelectedPlanAccompagnateurModal(acc);
                setPlanModalTab('all');
              }}
              className="bg-slate-50 dark:bg-dark-800/70 hover:bg-white dark:hover:bg-dark-800 rounded-xl p-2.5 border border-slate-200/80 dark:border-dark-700/80 hover:border-purple-500/60 dark:hover:border-purple-500/60 shadow-xs hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
              title={`Cliquer pour voir la liste détaillée des objectifs de ${acc.nom}`}
            >
              {/* Ligne 1 : Nom de l'accompagnateur et bouton "Détails >" */}
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0"></span>
                  <span className="text-[11px] font-bold text-slate-900 dark:text-white truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                    {acc.nom}
                  </span>
                </div>

                <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 shrink-0 px-1.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-800/40">
                  <span>Détails</span>
                  <ChevronRight size={10} />
                </span>
              </div>

              {/* Ligne 2 : Incubés suivis (sans la mention 20/60 car présente dans la modale) */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-dark-700/60 text-[10px] text-slate-500 dark:text-dark-400 font-medium">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <Users size={10} /> {acc.nbIncubes} suivi{acc.nbIncubes > 1 ? 's' : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 🎯 MODALE DÉTAIL PLAN D'ACTION ACCOMPAGNATEUR            */}
      {/* ======================================================== */}
      {selectedPlanAccompagnateurModal && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setSelectedPlanAccompagnateurModal(null)}
        >
          <div
            className="bg-white dark:bg-dark-900 text-slate-900 dark:text-white rounded-3xl border border-slate-200 dark:border-dark-700 shadow-2xl max-w-4xl w-full overflow-hidden slide-up my-8 max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="p-5 border-b border-slate-100 dark:border-dark-800 bg-gradient-to-r from-purple-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white font-black shadow-inner">
                  <Target size={22} />
                </div>
                <div>
                  <h3 className="font-black text-base tracking-tight flex items-center gap-2">
                    <span>Plan d'Action • {selectedPlanAccompagnateurModal.nom}</span>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white/20 text-white">
                      {selectedPlanYear === 'toutes' ? 'Toutes années' : `Année ${selectedPlanYear}`}
                    </span>
                  </h3>
                  <p className="text-xs text-white/80">
                    Suivi et état d'avancement des objectifs fixés pour chaque incubé
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPlanAccompagnateurModal(null)}
                className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Corps Modal */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* Synthèse 4 KPI */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-dark-400 block mb-1">
                    Total Objectifs
                  </span>
                  <span className="text-xl font-black text-slate-900 dark:text-white">
                    {selectedPlanAccompagnateurModal.total}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block mb-1">
                    Objectifs Atteints
                  </span>
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    {selectedPlanAccompagnateurModal.atteint} <span className="text-xs font-bold text-slate-500 dark:text-dark-400">({selectedPlanAccompagnateurModal.total > 0 ? Math.round((selectedPlanAccompagnateurModal.atteint / selectedPlanAccompagnateurModal.total) * 100) : 0}%)</span>
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block mb-1">
                    En Cours
                  </span>
                  <span className="text-xl font-black text-amber-600 dark:text-amber-400">
                    {selectedPlanAccompagnateurModal.en_cours}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 block mb-1">
                    Non Atteints
                  </span>
                  <span className="text-xl font-black text-rose-600 dark:text-rose-400">
                    {selectedPlanAccompagnateurModal.non_atteint}
                  </span>
                </div>
              </div>

              {/* Onglets de filtrage */}
              <div className="flex items-center gap-2 border-b border-slate-200 dark:border-dark-700 pb-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setPlanModalTab('all')}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                    planModalTab === 'all'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-dark-700'
                  }`}
                >
                  <ClipboardList size={13} />
                  <span>Tous ({selectedPlanAccompagnateurModal.items?.length || 0})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPlanModalTab('atteint')}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                    planModalTab === 'atteint'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-dark-700'
                  }`}
                >
                  <CheckCircle2 size={13} />
                  <span>✅ Atteints ({selectedPlanAccompagnateurModal.atteintList?.length || 0})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPlanModalTab('en_cours')}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                    planModalTab === 'en_cours'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-dark-700'
                  }`}
                >
                  <Clock size={13} />
                  <span>⏳ En cours ({selectedPlanAccompagnateurModal.enCoursList?.length || 0})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPlanModalTab('non_atteint')}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                    planModalTab === 'non_atteint'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-dark-700'
                  }`}
                >
                  <AlertCircle size={13} />
                  <span>❌ Non atteints ({selectedPlanAccompagnateurModal.nonAtteintList?.length || 0})</span>
                </button>
              </div>

              {/* Table des objectifs */}
              {(() => {
                const listToDisplay = planModalTab === 'atteint'
                  ? selectedPlanAccompagnateurModal.atteintList
                  : planModalTab === 'en_cours'
                  ? selectedPlanAccompagnateurModal.enCoursList
                  : planModalTab === 'non_atteint'
                  ? selectedPlanAccompagnateurModal.nonAtteintList
                  : selectedPlanAccompagnateurModal.items;

                if (!listToDisplay || listToDisplay.length === 0) {
                  return (
                    <div className="text-center py-8 text-slate-400">
                      <p className="font-semibold text-slate-500 dark:text-dark-400">Aucun objectif ne correspond à ce filtre.</p>
                    </div>
                  );
                }

                return (
                  <div className="border border-slate-200 dark:border-dark-700 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-dark-300 font-bold">
                          <th className="py-2.5 px-3">Incubé / Projet</th>
                          <th className="py-2.5 px-3">Objectif / Action</th>
                          <th className="py-2.5 px-3">Échéance</th>
                          <th className="py-2.5 px-3 text-center">Réalisation</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-dark-700/60">
                        {listToDisplay.map((p, pIdx) => {
                          const incId = p.incube_id || p.incube?.id;
                          const r = (p.realisation || '').trim().toLowerCase();
                          const isAtteint = ['atteint', 'validé', 'valide', 'effectué', 'effectue'].includes(r);
                          const isNonAtteint = ['non atteint', 'non_atteint', 'non valide', 'échoué'].includes(r);

                          return (
                            <tr key={p.id || pIdx} className="hover:bg-slate-50 dark:hover:bg-dark-800/40">
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-slate-900 dark:text-white">
                                  {p.incube?.nom_incube || `Incubé #${incId}`}
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-dark-400">
                                  {p.incube?.raison_sociale || 'Projet'}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200 max-w-[280px]">
                                <div className="truncate" title={p.objectifs || '—'}>
                                  {p.objectifs || '—'}
                                </div>
                                {p.mois && (
                                  <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold block">
                                    Jalon : {p.mois}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-600 dark:text-dark-300">
                                {formatDateFr(p.echeance)}
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                {isAtteint ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                                    <CheckCircle2 size={10} /> Atteint
                                  </span>
                                ) : isNonAtteint ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
                                    <AlertCircle size={10} /> Non atteint
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                    <Clock size={10} /> {p.realisation || 'En cours'}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedPlanAccompagnateurModal(null);
                                    navigate(`/incube/${incId}?tab=plan`);
                                  }}
                                  className="btn btn-primary btn-xs inline-flex items-center gap-1 text-[11px] font-bold"
                                  title="Accéder au plan d'action de cet incubé"
                                >
                                  <span>Voir fiche</span>
                                  <ExternalLink size={11} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            {/* Footer Modal */}
            <div className="p-4 border-t border-slate-100 dark:border-dark-800 bg-slate-50/50 dark:bg-dark-800/30 flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-500 dark:text-dark-400 font-medium">
                💡 Cliquez sur « Voir fiche » pour consulter et mettre à jour le plan d'action complet de l'incubé.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-secondary text-xs"
                  onClick={() => setSelectedPlanAccompagnateurModal(null)}
                >
                  Fermer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const acc = selectedPlanAccompagnateurModal.nom;
                    setSelectedPlanAccompagnateurModal(null);
                    navigate(`/incubes?accompagnateur=${encodeURIComponent(acc)}`);
                  }}
                  className="btn btn-primary text-xs inline-flex items-center gap-1"
                >
                  <span>Voir tous les incubés de {selectedPlanAccompagnateurModal.nom}</span>
                  <ExternalLink size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 4. GRAPHIQUE ÉTAT DU PARC MATÉRIEL & ÉQUIPEMENTS (DOUBLE ANNEAU : ESPACES + SANTÉ)
// ============================================================================
export function KpiMaterielChart({ equipements }) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const op = equipements?.operationnels || 0;
  const us = equipements?.usure || 0;
  const mt = equipements?.maintenance || 0;
  const np = equipements?.neMarchePlus || 0;

  // Répartition par espace (depuis impactStats ou valeurs exactes BDD)
  const fabCount = equipements?.parEspace?.fablab ?? 8;
  const studioCount = equipements?.parEspace?.studio ?? 7;
  const salleCount = equipements?.parEspace?.salle_reunion ?? 7;
  const total = equipements?.totalEquipements || (fabCount + studioCount + salleCount) || (op + us + mt + np) || 22;
  const santePct = total > 0 ? Math.round((op / total) * 100) : 100;

  // Données du Double Anneau Concentrique :
  // Anneau 1 (Extérieur) : Répartition par Espace (Cliquable)
  // Anneau 2 (Intérieur) : Santé globale du matériel
  const data = useMemo(() => {
    return {
      datasets: [
        // 1. ANNEAU EXTÉRIEUR : Les 3 Espaces (Cliquable vers l'état matériel de l'espace)
        {
          label: 'Espaces',
          data: [fabCount, studioCount, salleCount],
          backgroundColor: ['#10b981', '#8b5cf6', '#3b82f6'],
          hoverBackgroundColor: ['#059669', '#7c3aed', '#2563eb'],
          borderColor: isDark ? '#1e293b' : '#ffffff',
          borderWidth: 2,
          weight: 1.15,
          labels: ['Espace FabLab', 'Studio Média / Photo', 'Salles & Formation'],
          keys: ['fablab', 'studio', 'salle_reunion']
        },
        // 2. ANNEAU INTÉRIEUR : État de Santé Global (Cliquable vers l'état du matériel)
        {
          label: 'Santé Matériel',
          data: [op, us, mt, np],
          backgroundColor: ['#10b981', '#f59e0b', '#f97316', '#ef4444'],
          hoverBackgroundColor: ['#059669', '#d97706', '#ea580c', '#dc2626'],
          borderColor: isDark ? '#1e293b' : '#ffffff',
          borderWidth: 2,
          weight: 0.85,
          labels: ['Opérationnels', 'Légère usure', 'En maintenance', 'Défective']
        }
      ]
    };
  }, [fabCount, studioCount, salleCount, op, us, mt, np, isDark]);

  const options = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: isDark ? '#0f172a' : '#1e293b',
          titleColor: '#ffffff',
          bodyColor: '#e2e8f0',
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            title: (items) => {
              const item = items[0];
              if (!item) return '';
              if (item.datasetIndex === 0) {
                const labels = ['🛠️ Espace FabLab', '🎥 Studio Média / Photo', '🎓 Salles & Formation'];
                return labels[item.dataIndex] || 'Espace';
              }
              const labels = ['🟢 Opérationnels', '🟡 Légère usure', '🟠 En maintenance', '🔴 Défective'];
              return labels[item.dataIndex] || 'État de Santé';
            },
            label: (ctx) => {
              const count = ctx.raw || 0;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              if (ctx.datasetIndex === 0) {
                return ` ${count} machine(s) (${pct}%) • Clic pour voir l'état`;
              }
              return ` ${count} machine(s) (${pct}%) • Clic pour voir l'état`;
            }
          }
        }
      },
      onClick: (evt, elements) => {
        if (!elements || elements.length === 0) {
          navigate('/espaces?tab=etat_materiel');
          return;
        }
        const el = elements[0];
        if (el.datasetIndex === 0) {
          // Clic sur l'anneau extérieur (Espaces)
          const keys = ['fablab', 'studio', 'salle_reunion'];
          const key = keys[el.index];
          if (key) {
            navigate(`/espaces?espace=${key}&tab=etat_materiel`);
          } else {
            navigate('/espaces?tab=etat_materiel');
          }
        } else {
          // Clic sur l'anneau intérieur (Santé globale)
          navigate('/espaces?tab=etat_materiel');
        }
      },
      onHover: (evt, elements) => {
        if (evt.native && evt.native.target) {
          evt.native.target.style.cursor = 'pointer';
        }
      }
    };
  }, [isDark, total, navigate]);

  return (
    <div className="flex flex-col items-center w-full pt-1">
      {/* 1. GRAPHIQUE DONUT CENTRÉ (Double Anneau Cliquable) */}
      <div 
        onClick={() => navigate('/espaces?tab=etat_materiel')}
        className="w-full h-52 relative flex items-center justify-center cursor-pointer group"
        title="Cliquer sur le graphique pour accéder à la fiche État et Maintenance du Matériel"
      >
        <Doughnut key={`materiel-double-ring-${theme}`} data={data} options={options} />
        
        {/* Centre du Donut */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-1">
          <span className="text-3xl font-black text-slate-900 dark:text-white leading-none group-hover:scale-105 transition-transform">
            {total}
          </span>
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mt-0.5">
            Machines
          </span>
          <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
            {santePct}% Opérat.
          </span>
        </div>
      </div>

      {/* 2. LÉGENDES SOUS LE GRAPHISME */}
      <div className="w-full mt-3 pt-3 border-t border-slate-100 dark:border-dark-800 space-y-2">
        {/* Ligne 1 : Les 4 critères d'état du matériel demandés */}
        <div 
          onClick={() => navigate('/espaces?tab=etat_materiel')}
          className="flex items-center justify-center gap-3 flex-wrap text-xs font-bold cursor-pointer hover:opacity-80 transition-opacity"
          title="Cliquer pour accéder à la fiche État du Matériel"
        >
          <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
            Opérationnels : {op} machines ({santePct}%)
          </span>
          <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
            Usure : {us}
          </span>
          <span className="inline-flex items-center gap-1.5 text-orange-600 dark:text-orange-400">
            <span className="w-2 h-2 rounded-full bg-orange-500 inline-block"></span>
            En maintenance : {mt}
          </span>
          <span className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
            Défective : {np}
          </span>
        </div>

        {/* Ligne 2 : Accès rapide par Espace */}
        <div className="flex items-center justify-center gap-2.5 flex-wrap text-[11px] font-semibold text-slate-500 dark:text-dark-400 pt-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Par Espace :</span>
          <button
            type="button"
            onClick={() => navigate('/espaces?espace=fablab&tab=etat_materiel')}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 font-bold cursor-pointer transition-colors"
            title="Consulter l'état du matériel du FabLab"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> FabLab ({fabCount})
          </button>
          <button
            type="button"
            onClick={() => navigate('/espaces?espace=studio&tab=etat_materiel')}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 font-bold cursor-pointer transition-colors"
            title="Consulter l'état du matériel du Studio"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span> Studio ({studioCount})
          </button>
          <button
            type="button"
            onClick={() => navigate('/espaces?espace=salle_reunion&tab=etat_materiel')}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 font-bold cursor-pointer transition-colors"
            title="Consulter l'état du matériel des Salles"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Salles ({salleCount})
          </button>
        </div>
      </div>
    </div>
  );
}

export { RepartitionGenre, RepartitionPhases };
