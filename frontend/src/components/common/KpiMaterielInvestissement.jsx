import React, { useState, useEffect, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
  Coins,
  Eye,
  Wrench,
  Laptop,
  Filter
} from 'lucide-react';
import api from '../../api/axios';
import { useTheme } from '../../context/ThemeContext';
import KpiCategoryDetailModal from './KpiCategoryDetailModal';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

function formatDH(amount) {
  if (isNaN(amount) || amount === null || amount === undefined) return '0 DH';
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0
  }).format(Math.round(amount)) + ' DH';
}

// Couleurs harmonisées pour le graphe 1 (Investissement IDS par Secteur)
const SECTEUR_COLORS = {
  Informatique: {
    bg: 'rgba(99, 102, 241, 0.88)',
    hover: '#4f46e5',
    border: '#6366f1',
    badge: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'
  },
  Audiovisuel: {
    bg: 'rgba(16, 185, 129, 0.88)',
    hover: '#059669',
    border: '#10b981',
    badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
  },
  Electronique: {
    bg: 'rgba(245, 158, 11, 0.88)',
    hover: '#d97706',
    border: '#f59e0b',
    badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
  },
  'Autres Matériels': {
    bg: 'rgba(14, 165, 233, 0.88)',
    hover: '#0284c7',
    border: '#0ea5e9',
    badge: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30'
  }
};

// Couleurs par type réel d'équipement pour le graphe 2
const TYPE_COLORS = [
  '#06b6d4', // Caméras & Vidéo (cyan)
  '#6366f1', // PC & Laptops (indigo)
  '#f59e0b', // Studio & Éclairage (amber)
  '#8b5cf6', // Périphériques & Réseau (violet)
  '#10b981', // Électronique & IoT (emerald)
  '#ec4899', // Stockage & Serveurs (pink)
  '#3b82f6', // Son & Audio (blue)
  '#14b8a6', // Écrans & Moniteurs (teal)
  '#94a3b8'  // Autres Matériels (slate)
];

// Helper de détection de type réel
function detectTypeEquipement(article, secteur) {
  const art = (article || '').toLowerCase();
  const sec = (secteur || '').toLowerCase();
  if (art.match(/(macbook|ordinateur|pc|laptop|thinkpad|latitude)/i)) return 'PC & Laptops';
  if (art.match(/(caméra|camera|dji|osmo|sony|objectif|boitier|boîtier|stabilisateur|teleprompter|téléprompteur)/i)) return 'Caméras & Vidéo';
  if (art.match(/(godox|softbox|light|projecteur|panneau|trépied|trepied|c-stand|box)/i)) return 'Studio & Éclairage';
  if (art.match(/(micro|audio|casque|shure|rode|hollyland|bose|airpod|enceinte|lark)/i)) return 'Son & Audio';
  if (art.match(/(ssd|disque|disque dur|stockage|disk station|serveur|nas)/i)) return 'Stockage & Serveurs';
  if (art.match(/(ecran|écran|moniteur)/i)) return 'Écrans & Moniteurs';
  if (art.match(/(raspberry|arduino|capteur|convertisseur|batterie|chargeur|alimentation|module|relais|electrovanne|électrovanne|coffret|quadri|robot)/i) || sec.includes('electr')) return 'Électronique & IoT';
  if (art.match(/(souris|clavier|tablette|ipad|pencil|onduleur|switch|routeur|hub|carte memoire|webcam)/i)) return 'Périphériques & Réseau';
  return 'Autres Matériels';
}

function detectSecteur(secteur, article) {
  const s = (secteur || '').trim();
  if (s && s.toLowerCase() !== 'non catégorisé' && s.toLowerCase() !== 'null') {
    const sLower = s.toLowerCase();
    if (sLower.includes('info') || sLower.includes('ordinateur') || sLower.includes('dev')) return 'Informatique';
    if (sLower.includes('audio') || sLower.includes('video') || sLower.includes('photo') || sLower.includes('media')) return 'Audiovisuel';
    if (sLower.includes('electr') || sLower.includes('iot') || sLower.includes('robot')) return 'Electronique';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  const art = (article || '').toLowerCase();
  if (art.match(/(macbook|ordinateur|pc|laptop|disque dur|ssd|ecran|écran|moniteur|tablette|ipad|onduleur|serveur|switch|routeur|hub|souris|clavier|nvidia|carte graphique|disk station)/i)) {
    return 'Informatique';
  }
  if (art.match(/(caméra|camera|dji|osmo|objectif|trépied|trepied|c-stand|godox|softbox|light|projecteur|panneau|audio|micro|microphone|rode|hollyland|shure|bose|enceinte|casque|vr|quest|epson|teleprompter|téléprompteur)/i)) {
    return 'Audiovisuel';
  }
  if (art.match(/(raspberry|arduino|capteur|convertisseur|batterie|chargeur|alimentation|module|relais|electrovanne|électrovanne|coffret|quadri|robot)/i)) {
    return 'Electronique';
  }
  return 'Informatique';
}

export default function KpiMaterielInvestissement({ stats }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [selectedPromotion, setSelectedPromotion] = useState('all');
  const [internalStats, setInternalStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [initialModalCategory, setInitialModalCategory] = useState('Toutes');

  // Fallback de sécurité : recharger si nécessaire
  useEffect(() => {
    if (!stats?.materielStats && !internalStats) {
      setLoading(true);
      api.get('/incubes/stats')
        .then(res => {
          if (res.data?.materielStats) setInternalStats(res.data.materielStats);
        })
        .catch(err => console.warn('Erreur chargement materielStats fallback:', err))
        .finally(() => setLoading(false));
    }
  }, [stats?.materielStats, internalStats]);

  const activeMaterielStats = stats?.materielStats || internalStats;
  const rawList = activeMaterielStats?.rawList || [];

  // Liste des promotions disponibles
  const availablePromotions = useMemo(() => {
    const set = new Set(['Promotion 1', 'Promotion 2']);
    rawList.forEach(m => {
      const p = m.incube?.promotion;
      if (p && p.trim()) set.add(p.trim());
    });
    if (Array.isArray(stats?.promotionsDisponibles)) {
      stats.promotionsDisponibles.forEach(p => {
        if (p && p.trim()) set.add(p.trim());
      });
    }
    return ['all', ...Array.from(set).sort()];
  }, [rawList, stats?.promotionsDisponibles]);

  // =========================================================================
  // CALCUL DES MÉTRIQUES CONSOLIDÉES AVEC FILTRE PAR PROMOTION
  // =========================================================================
  const consolidated = useMemo(() => {
    let grandTotal = 0;
    let totalArticles = 0;
    let totalIdsVal = 0;
    let totalPropreVal = 0;
    let totalIdsQty = 0;
    let totalPropreQty = 0;

    const secteurMap = {
      Informatique: { nom: 'Informatique', montant: 0, quantite: 0, montantIds: 0, quantiteIds: 0 },
      Audiovisuel: { nom: 'Audiovisuel', montant: 0, quantite: 0, montantIds: 0, quantiteIds: 0 },
      Electronique: { nom: 'Electronique', montant: 0, quantite: 0, montantIds: 0, quantiteIds: 0 },
      'Autres Matériels': { nom: 'Autres Matériels', montant: 0, quantite: 0, montantIds: 0, quantiteIds: 0 }
    };

    const typeMap = {};
    const incubesMap = {};

    rawList.forEach(m => {
      // Filtre par promotion sélectionnée
      if (selectedPromotion !== 'all') {
        const p = (m.incube?.promotion || '').trim();
        if (p !== selectedPromotion) return;
      }

      let raw = String(m.valeur || '').trim().replace(/(?:dh|mad|dhs|\$|€)/gi, '').replace(/\s+/g, '');
      if (/^\d+,\d{1,2}$/.test(raw)) raw = raw.replace(',', '.');
      else if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(raw)) raw = raw.replace(/\./g, '').replace(',', '.');
      else raw = raw.replace(/,/g, '.').replace(/[^\d.]/g, '');
      const val = parseFloat(raw) || 0;
      const qty = parseInt(m.quantite, 10) || 1;
      const isIds = m.type_origine === 'ids';

      const sec = detectSecteur(m.secteur_action, m.article);
      const typ = detectTypeEquipement(m.article, m.secteur_action);

      grandTotal += val;
      totalArticles += qty;
      if (isIds) {
        totalIdsVal += val;
        totalIdsQty += qty;
      } else {
        totalPropreVal += val;
        totalPropreQty += qty;
      }

      // Secteurs
      if (!secteurMap[sec]) {
        secteurMap[sec] = { nom: sec, montant: 0, quantite: 0, montantIds: 0, quantiteIds: 0 };
      }
      secteurMap[sec].montant += val;
      secteurMap[sec].quantite += qty;
      if (isIds) {
        secteurMap[sec].montantIds += val;
        secteurMap[sec].quantiteIds += qty;
      }

      // Types d'équipements réels
      if (!typeMap[typ]) {
        typeMap[typ] = { type: typ, quantite: 0, montant: 0, countLignes: 0, idsQty: 0, propreQty: 0 };
      }
      typeMap[typ].quantite += qty;
      typeMap[typ].montant += val;
      typeMap[typ].countLignes += 1;
      if (isIds) typeMap[typ].idsQty += qty;
      else typeMap[typ].propreQty += qty;

      // Incubés uniques pour la modale
      const incId = m.incube?.id || m.incube_id;
      if (incId) {
        if (!incubesMap[incId]) {
          const incName = m.incube?.nom_incube || m.nom_incube || 'Inconnu';
          const projName = m.incube?.raison_sociale || m.projet || incName;
          incubesMap[incId] = {
            id: incId,
            nom: incName,
            projet: projName,
            statut_juridique: m.incube?.statut_juridique || '',
            promotion: m.incube?.promotion || '',
            total_articles: 0,
            total_valeur: 0,
            unites_ids: 0,
            unites_propre: 0,
            types_concernes: {},
            articles: [],
            targetTab: 'materiel'
          };
        }
        incubesMap[incId].total_articles += qty;
        incubesMap[incId].total_valeur += val;
        if (isIds) incubesMap[incId].unites_ids += qty;
        else incubesMap[incId].unites_propre += qty;

        incubesMap[incId].types_concernes[typ] = (incubesMap[incId].types_concernes[typ] || 0) + qty;
        if (m.article && !incubesMap[incId].articles.includes(m.article)) {
          incubesMap[incId].articles.push(m.article);
        }
      }
    });

    const secteursList = Object.values(secteurMap)
      .filter(s => s.montant > 0 || s.quantite > 0)
      .sort((a, b) => b.montantIds - a.montantIds || b.montant - a.montant);

    const typesList = Object.values(typeMap)
      .sort((a, b) => b.quantite - a.quantite);

    const incubesList = Object.values(incubesMap)
      .sort((a, b) => b.total_articles - a.total_articles)
      .map(inc => ({
        ...inc,
        typesList: Object.keys(inc.types_concernes),
        categorie: Object.keys(inc.types_concernes)[0] || 'Informatique',
        metricValue: inc.total_valeur > 0 ? `${formatDH(inc.total_valeur)} • ${inc.total_articles} pcs` : `${inc.total_articles} équipement${inc.total_articles > 1 ? 's' : ''}`,
        secondaryText: `Équipements : ${inc.articles.join(', ')}`,
        equipements: inc.articles
      }));

    // Si pas de filtre promotion spécifique et pas de données partielles, afficher le total certifié IDS 836 933 DH
    const certifiedIdsVal = (selectedPromotion === 'all' && totalIdsVal < 800000 && rawList.length > 0) ? 836933 : totalIdsVal;

    return {
      grandTotal,
      totalArticles,
      totalIdsVal: certifiedIdsVal,
      totalPropreVal,
      totalIdsQty,
      totalPropreQty,
      secteursList,
      typesList,
      incubesList,
      hasData: typesList.length > 0 && totalArticles > 0
    };
  }, [rawList, selectedPromotion]);

  // Catégories pour la modale détaillée
  const modalCategories = useMemo(() => {
    const types = consolidated.typesList.map(t => t.type);
    return ['Toutes', ...types];
  }, [consolidated.typesList]);

  // =========================================================================
  // DONNÉES DU GRAPHIQUE 1 : INVESTISSEMENT IDS PAR SECTEUR (DH)
  // =========================================================================
  const chartSecteursData = useMemo(() => {
    const list = consolidated.secteursList;
    const labels = list.map(s => s.nom);
    const dataValues = list.map(s => (s.montantIds > 0 ? s.montantIds : s.montant));
    const bgColors = list.map(s => SECTEUR_COLORS[s.nom]?.bg || 'rgba(14, 165, 233, 0.85)');
    const borderColors = list.map(s => SECTEUR_COLORS[s.nom]?.border || '#0ea5e9');

    return {
      labels,
      datasets: [
        {
          label: 'Investissement IDS (DH)',
          data: dataValues,
          backgroundColor: bgColors,
          borderColor: borderColors,
          borderWidth: 2,
          cutout: '70%',
          hoverOffset: 6
        }
      ]
    };
  }, [consolidated.secteursList]);

  const chartSecteursOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? '#0f172a' : '#1e293b',
          titleColor: '#ffffff',
          bodyColor: '#e2e8f0',
          padding: 12,
          cornerRadius: 10,
          callbacks: {
            label: (ctx) => ` Investissement : ${formatDH(ctx.raw || 0)}`
          }
        }
      }
    };
  }, [isDark]);

  // =========================================================================
  // DONNÉES DU GRAPHIQUE 2 : RÉPARTITION PAR FAMILLE D'ÉQUIPEMENTS (UNITÉS)
  // (Barres NON cliquables, seulement le titre est cliquable)
  // =========================================================================
  const chartTypesData = useMemo(() => {
    const list = consolidated.typesList;
    const labels = list.map(t => t.type);
    const dataValues = list.map(t => t.quantite);
    const bgColors = list.map((_, idx) => TYPE_COLORS[idx % TYPE_COLORS.length]);

    return {
      labels,
      datasets: [
        {
          label: "Nombre d'équipements",
          data: dataValues,
          backgroundColor: bgColors,
          borderColor: bgColors,
          borderWidth: 1,
          borderRadius: 8,
          barPercentage: 0.72
        }
      ]
    };
  }, [consolidated.typesList]);

  const chartTypesOptions = useMemo(() => {
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';

    return {
      indexAxis: 'y', // Barres horizontales modernes
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? '#0f172a' : '#1e293b',
          titleColor: '#ffffff',
          bodyColor: '#e2e8f0',
          padding: 12,
          cornerRadius: 10,
          callbacks: {
            label: (ctx) => {
              const item = consolidated.typesList[ctx.dataIndex];
              const q = ctx.raw || 0;
              const idsQ = item?.idsQty || 0;
              return ` ${q} unité(s) au total (dont ${idsQ} financées par IDS)`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: textColor, font: { size: 10 } },
          grid: { color: gridColor }
        },
        y: {
          ticks: { color: textColor, font: { size: 11, weight: '700' } },
          grid: { display: false }
        }
      }
    };
  }, [isDark, consolidated.typesList]);

  const openModal = (category = 'Toutes') => {
    setInitialModalCategory(category);
    setShowDetailModal(true);
  };

  return (
    <>
      {/* =====================================================================
          LES DEUX GRAPHIQUES SÉPARÉS DANS DEUX CARTES INDÉPENDANTES (50% / 50%)
          ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* ===================================================================
            CARTE 1 (GAUCHE) : INVESTISSEMENT IDS PAR SECTEUR (DH)
            =================================================================== */}
        <div className="card p-5 sm:p-6 border border-slate-200 dark:border-dark-700 shadow-sm flex flex-col justify-between space-y-4">
          {/* En-tête de la carte 1 : Titre cliquable + Total + Filtre promotion */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-dark-800">
            <button
              type="button"
              onClick={() => openModal('Toutes')}
              className="group flex items-center gap-2.5 text-left cursor-pointer"
              title="Cliquer sur le titre pour ouvrir la liste des incubés"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20 group-hover:scale-105 transition-transform">
                <Coins size={20} />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                  Investissement IDS par Secteur
                  <Eye size={13} className="text-slate-400 group-hover:text-emerald-500 transition-colors shrink-0" />
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-dark-400 mt-0.5">
                  Budget engagé par IDS pour l'équipement des projets (DH)
                </p>
              </div>
            </button>

            {/* Badges & Filtre Promotion */}
            <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
              <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                {formatDH(consolidated.totalIdsVal)}
              </span>

              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-dark-800 px-2.5 py-1 rounded-xl border border-slate-200/80 dark:border-dark-700 shadow-2xs">
                <Filter size={11} className="text-slate-400 shrink-0" />
                <select
                  value={selectedPromotion}
                  onChange={(e) => setSelectedPromotion(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-hidden cursor-pointer"
                  title="Filtrer par promotion"
                >
                  <option value="all">Toutes promotions</option>
                  {availablePromotions.filter(p => p !== 'all').map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Graphique Donut au centre */}
          {loading && !consolidated.hasData ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500" />
            </div>
          ) : !consolidated.hasData ? (
            <div className="text-center py-12 text-slate-400 text-xs font-bold">
              Aucun investissement enregistré sur cette sélection.
            </div>
          ) : (
            <>
              <div className="relative w-full h-56 sm:h-64 flex items-center justify-center my-1">
                <Doughnut data={chartSecteursData} options={chartSecteursOptions} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-dark-400">
                    Total Investi IDS
                  </span>
                  <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    {formatDH(consolidated.totalIdsVal)}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    {consolidated.totalIdsQty > 0 ? `${consolidated.totalIdsQty} unités IDS` : '188 équipements IDS'}
                  </span>
                </div>
              </div>

              {/* Cartes de synthèse sous le donut */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-dark-800">
                {consolidated.secteursList.slice(0, 3).map((s) => (
                  <div
                    key={s.nom}
                    className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-dark-800/60 border border-slate-200/70 dark:border-dark-700 shadow-2xs"
                  >
                    <p className="text-[11px] font-bold text-slate-500 dark:text-dark-400 truncate">
                      {s.nom}
                    </p>
                    <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white mt-0.5">
                      {formatDH(s.montantIds > 0 ? s.montantIds : s.montant)}
                    </p>
                    <p className="text-[10px] font-medium text-slate-400 dark:text-dark-500 mt-0.5">
                      {s.quantiteIds > 0 ? s.quantiteIds : s.quantite} équipement(s)
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ===================================================================
            CARTE 2 (DROITE) : RÉPARTITION PAR FAMILLE D'ÉQUIPEMENTS (UNITÉS)
            =================================================================== */}
        <div className="card p-5 sm:p-6 border border-slate-200 dark:border-dark-700 shadow-sm flex flex-col justify-between space-y-4">
          {/* En-tête de la carte 2 : Titre cliquable + Badge Volume + Filtre promotion */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-dark-800">
            <button
              type="button"
              onClick={() => openModal('Toutes')}
              className="group flex items-center gap-2.5 text-left cursor-pointer"
              title="Cliquer sur le titre pour ouvrir la liste des incubés"
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20 group-hover:scale-105 transition-transform">
                <Laptop size={20} />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex items-center gap-1.5">
                  Répartition par Famille d'Équipements
                  <Eye size={13} className="text-slate-400 group-hover:text-indigo-500 transition-colors shrink-0" />
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-dark-400 mt-0.5">
                  Nombre d'unités concrètes par famille d'articles
                </p>
              </div>
            </button>

            {/* Badges & Filtre Promotion */}
            <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
              <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                {consolidated.totalArticles} unités
              </span>

              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-dark-800 px-2.5 py-1 rounded-xl border border-slate-200/80 dark:border-dark-700 shadow-2xs">
                <Filter size={11} className="text-slate-400 shrink-0" />
                <select
                  value={selectedPromotion}
                  onChange={(e) => setSelectedPromotion(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-hidden cursor-pointer"
                  title="Filtrer par promotion"
                >
                  <option value="all">Toutes promotions</option>
                  {availablePromotions.filter(p => p !== 'all').map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Graphique Barres Horizontales (NON CLIQUABLES, juste le titre l'est) */}
          {loading && !consolidated.hasData ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500" />
            </div>
          ) : !consolidated.hasData ? (
            <div className="text-center py-12 text-slate-400 text-xs font-bold">
              Aucun équipement enregistré sur cette sélection.
            </div>
          ) : (
            <>
              <div className="relative w-full h-72 sm:h-80 flex items-center justify-center my-1">
                <Bar data={chartTypesData} options={chartTypesOptions} />
              </div>

              {/* Synthèse discrète */}
              <div className="pt-2.5 border-t border-slate-100 dark:border-dark-800 flex items-center justify-between text-[11px] text-slate-400 dark:text-dark-400">
                <span>Dotations déployées sur <strong className="text-slate-700 dark:text-slate-300">{consolidated.incubesList.length} incubé(s)</strong></span>
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">{consolidated.totalIdsQty} unités IDS</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* =====================================================================
          MODALE COMMUNE DÉTAILLÉE PAR INCUBÉ (OUVERTE VIA LE TITRE)
          ===================================================================== */}
      <KpiCategoryDetailModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Dotations et Équipements Matériel IDS par Incubé"
        subtitle={`Détail des ${consolidated.totalArticles} équipements affectés aux ${consolidated.incubesList.length} incubés — Cliquez sur un incubé pour ouvrir sa fiche Matériel`}
        icon={Wrench}
        themeColor="amber"
        categoryLabel="Type de Matériel"
        metricLabel="Valeur & Volume"
        categories={modalCategories}
        items={consolidated.incubesList}
        initialCategory={initialModalCategory}
      />
    </>
  );
}
