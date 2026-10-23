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
  PieChart as PieChartIcon,
  BarChart3,
  Coins
} from 'lucide-react';
import api from '../../api/axios';
import { useTheme } from '../../context/ThemeContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

// Palette de couleurs pour les catégories
const COLOR_PALETTE = [
  { bg: 'rgba(16, 185, 129, 0.85)', hover: '#059669', border: '#10b981', text: 'text-emerald-700 dark:text-emerald-300', bar: '#10b981' },
  { bg: 'rgba(99, 102, 241, 0.85)', hover: '#4f46e5', border: '#6366f1', text: 'text-indigo-700 dark:text-indigo-300', bar: '#6366f1' },
  { bg: 'rgba(245, 158, 11, 0.85)', hover: '#d97706', border: '#f59e0b', text: 'text-amber-700 dark:text-amber-300', bar: '#f59e0b' },
  { bg: 'rgba(14, 165, 233, 0.85)', hover: '#0284c7', border: '#0ea5e9', text: 'text-sky-700 dark:text-sky-300', bar: '#0ea5e9' },
  { bg: 'rgba(236, 72, 153, 0.85)', hover: '#db2777', border: '#ec4899', text: 'text-pink-700 dark:text-pink-300', bar: '#ec4899' },
  { bg: 'rgba(168, 85, 247, 0.85)', hover: '#9333ea', border: '#a855f7', text: 'text-purple-700 dark:text-purple-300', bar: '#a855f7' },
  { bg: 'rgba(249, 115, 22, 0.85)', hover: '#ea580c', border: '#f97316', text: 'text-orange-700 dark:text-orange-300', bar: '#f97316' },
  { bg: 'rgba(20, 184, 166, 0.85)', hover: '#0d9488', border: '#14b8a6', text: 'text-teal-700 dark:text-teal-300', bar: '#14b8a6' },
  { bg: 'rgba(148, 163, 184, 0.85)', hover: '#64748b', border: '#94a3b8', text: 'text-slate-700 dark:text-slate-300', bar: '#94a3b8' },
];

function formatDH(amount) {
  if (isNaN(amount) || amount === null || amount === undefined) return '0 DH';
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0
  }).format(Math.round(amount)) + ' DH';
}

export default function KpiMaterielInvestissement({ stats }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [chartMode, setChartMode] = useState('doughnut'); // 'doughnut' | 'bar'
  const [filterOrigine, setFilterOrigine] = useState('all'); // 'all' | 'ids' | 'propre'
  const [internalStats, setInternalStats] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fallback de sécurité : si stats?.materielStats n'est pas encore présent, charger directement
  useEffect(() => {
    if (!stats?.materielStats && !internalStats) {
      setLoading(true);
      api.get('/incubes/stats')
        .then(res => {
          if (res.data?.materielStats) {
            setInternalStats(res.data.materielStats);
          }
        })
        .catch(err => {
          console.warn('Erreur chargement materielStats fallback:', err);
        })
        .finally(() => setLoading(false));
    }
  }, [stats?.materielStats, internalStats]);

  const activeMaterielStats = stats?.materielStats || internalStats;
  const rawList = activeMaterielStats?.rawList || [];

  // Calculer et filtrer les données de répartition par catégorie
  const filteredData = useMemo(() => {
    if (filterOrigine === 'all' && activeMaterielStats?.categories) {
      const cats = activeMaterielStats.categories.map((c, idx) => ({
        ...c,
        palette: COLOR_PALETTE[idx % COLOR_PALETTE.length]
      }));
      return {
        totalInvestissement: activeMaterielStats.totalInvestissement || 0,
        totalArticles: activeMaterielStats.totalArticles || 0,
        totalIds: activeMaterielStats.totalIds || 0,
        totalPropre: activeMaterielStats.totalPropre || 0,
        categories: cats,
        hasData: cats.length > 0 && (activeMaterielStats.totalInvestissement || 0) > 0
      };
    }

    // Filtrer depuis rawList si filtre IDS ou Propre sélectionné
    let grandTotal = 0;
    let totalArticles = 0;
    let totalIds = 0;
    let totalPropre = 0;
    const catMap = {};

    rawList.forEach(m => {
      const isIds = m.type_origine === 'ids';
      if (filterOrigine === 'ids' && !isIds) return;
      if (filterOrigine === 'propre' && isIds) return;

      let raw = String(m.valeur || '').trim().replace(/(?:dh|mad|dhs|\$|€)/gi, '').replace(/\s+/g, '');
      if (/^\d+,\d{1,2}$/.test(raw)) raw = raw.replace(',', '.');
      else if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(raw)) raw = raw.replace(/\./g, '').replace(',', '.');
      else raw = raw.replace(/,/g, '.').replace(/[^\d.]/g, '');
      const val = parseFloat(raw) || 0;
      const qty = parseInt(m.quantite, 10) || 1;
      const cat = (m.secteur_action || '').trim() || 'Non catégorisé';

      grandTotal += val;
      totalArticles += qty;
      if (isIds) totalIds += val;
      else totalPropre += val;

      if (!catMap[cat]) {
        catMap[cat] = {
          nom: cat,
          montantTotal: 0,
          quantite: 0,
          countLignes: 0,
          idsMontant: 0,
          propreMontant: 0
        };
      }
      catMap[cat].montantTotal += val;
      catMap[cat].quantite += qty;
      catMap[cat].countLignes += 1;
      if (isIds) catMap[cat].idsMontant += val;
      else catMap[cat].propreMontant += val;
    });

    const categories = Object.values(catMap)
      .sort((a, b) => b.montantTotal - a.montantTotal)
      .map((c, idx) => ({
        ...c,
        palette: COLOR_PALETTE[idx % COLOR_PALETTE.length]
      }));

    return {
      totalInvestissement: grandTotal,
      totalArticles,
      totalIds,
      totalPropre,
      categories,
      hasData: categories.length > 0 && grandTotal > 0
    };
  }, [activeMaterielStats, rawList, filterOrigine]);

  // Données Chart.js
  const chartData = useMemo(() => {
    const labels = filteredData.categories.map(c => c.nom);
    const dataValues = filteredData.categories.map(c => c.montantTotal);
    const bgColors = filteredData.categories.map(c => c.palette.bg);
    const borderColors = filteredData.categories.map(c => c.palette.border);

    return {
      labels,
      datasets: [
        {
          label: 'Investissement Matériel (DH)',
          data: dataValues,
          backgroundColor: bgColors,
          borderColor: borderColors,
          borderWidth: chartMode === 'doughnut' ? 2 : 1.5,
          borderRadius: chartMode === 'bar' ? 8 : 0,
          cutout: chartMode === 'doughnut' ? '68%' : undefined,
          hoverOffset: chartMode === 'doughnut' ? 8 : 4
        }
      ]
    };
  }, [filteredData.categories, chartMode]);

  // Options Chart.js (sans doublon de pourcentage)
  const chartOptions = useMemo(() => {
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';

    if (chartMode === 'doughnut') {
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
              label: (ctx) => {
                const val = ctx.raw || 0;
                return ` Montant : ${formatDH(val)}`;
              }
            }
          }
        }
      };
    }

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
            label: (ctx) => {
              const val = ctx.raw || 0;
              return ` Montant : ${formatDH(val)}`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: textColor, font: { size: 11, weight: '600' } },
          grid: { display: false }
        },
        y: {
          ticks: {
            color: textColor,
            font: { size: 10 },
            callback: (v) => `${(v / 1000).toFixed(0)}k DH`
          },
          grid: { color: gridColor }
        }
      }
    };
  }, [isDark, chartMode]);

  return (
    <div className="card p-6 border border-slate-200 dark:border-dark-700 space-y-6 shadow-sm">
      {/* EN-TÊTE : TITRE + TOTAL DIRECT + CONTRÔLES */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-dark-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
            <Coins size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                Répartition des Investissements Matériel par Catégorie
              </h2>
              <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                Total : {formatDH(filteredData.totalInvestissement)}
              </span>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                {filteredData.categories.length} catégorie(s) • {filteredData.totalArticles} unité(s)
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-dark-400 mt-0.5">
              Consolidation des équipements par catégorie d'action (financement IDS & apport propre)
            </p>
          </div>
        </div>

        {/* CONTRÔLES : FILTRE ORIGINE & MODE DU GRAPHE */}
        <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
          {/* Filtre Origine */}
          <div className="flex items-center bg-slate-100 dark:bg-dark-800 p-1 rounded-xl text-xs font-bold border border-slate-200/80 dark:border-dark-700">
            <button
              type="button"
              onClick={() => setFilterOrigine('all')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                filterOrigine === 'all'
                  ? 'bg-white dark:bg-dark-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Tous
            </button>
            <button
              type="button"
              onClick={() => setFilterOrigine('ids')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                filterOrigine === 'ids'
                  ? 'bg-white dark:bg-dark-900 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              IDS
            </button>
            <button
              type="button"
              onClick={() => setFilterOrigine('propre')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                filterOrigine === 'propre'
                  ? 'bg-white dark:bg-dark-900 text-sky-600 dark:text-sky-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Propre
            </button>
          </div>

          {/* Bascule Donut / Bar */}
          <div className="flex items-center bg-slate-100 dark:bg-dark-800 p-1 rounded-xl text-xs font-bold border border-slate-200/80 dark:border-dark-700">
            <button
              type="button"
              onClick={() => setChartMode('doughnut')}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                chartMode === 'doughnut'
                  ? 'bg-white dark:bg-dark-900 text-primary-600 dark:text-primary-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Graphique Circulaire (Donut)"
            >
              <PieChartIcon size={14} />
              <span className="hidden sm:inline">Circulaire</span>
            </button>
            <button
              type="button"
              onClick={() => setChartMode('bar')}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                chartMode === 'bar'
                  ? 'bg-white dark:bg-dark-900 text-primary-600 dark:text-primary-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Histogramme (Barres)"
            >
              <BarChart3 size={14} />
              <span className="hidden sm:inline">Barres</span>
            </button>
          </div>
        </div>
      </div>

      {/* CHARGEMENT OU ÉTAT VIDE OU GRAPHIQUE AVEC LÉGENDES EN DESSOUS */}
      {loading && !filteredData.hasData ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500" />
        </div>
      ) : !filteredData.hasData ? (
        <div className="text-center py-12 bg-slate-50 dark:bg-dark-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-dark-700 text-slate-400 text-xs font-bold space-y-2">
          <Coins size={36} className="mx-auto text-slate-300 dark:text-dark-600" />
          <p className="text-sm">Aucun investissement en matériel enregistré sur cette sélection.</p>
          <p className="text-xs font-normal text-slate-400 dark:text-dark-500">
            Les valeurs renseignées dans les fiches matériel des incubés s'agrégeront automatiquement ici.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* GRAPHE UNIQUE CENTRÉ (DONUT OU HISTOGRAMME) */}
          <div className="flex flex-col items-center justify-center py-2">
            <div className={`relative w-full ${chartMode === 'doughnut' ? 'max-w-sm h-64 sm:h-72' : 'max-w-2xl h-64 sm:h-72'} flex items-center justify-center`}>
              {chartMode === 'doughnut' ? (
                <>
                  <Doughnut data={chartData} options={chartOptions} />
                  {/* Badge central sur le Donut */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-dark-400">
                      Total Investi
                    </span>
                    <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                      {formatDH(filteredData.totalInvestissement)}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-dark-400">
                      {filteredData.categories.length} catégorie(s)
                    </span>
                  </div>
                </>
              ) : (
                <Bar data={chartData} options={chartOptions} />
              )}
            </div>
          </div>

          {/* LÉGENDE EN DESSOUS DU GRAPHE SANS POURCENTAGES (SANS DOUBLONS) */}
          <div className="pt-4 border-t border-slate-100 dark:border-dark-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredData.categories.map((cat) => (
                <div
                  key={cat.nom}
                  className="p-3 rounded-2xl bg-slate-50/80 dark:bg-dark-800/60 border border-slate-200/70 dark:border-dark-700/70 hover:border-amber-500/40 transition-colors space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                        style={{ backgroundColor: cat.palette.bar }}
                      />
                      <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                        {cat.nom}
                      </span>
                    </div>

                    <span className="text-xs font-black text-slate-900 dark:text-white shrink-0">
                      {formatDH(cat.montantTotal)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-dark-400 font-medium">
                    <span>{cat.quantite} unité{cat.quantite > 1 ? 's' : ''}</span>
                    {cat.idsMontant > 0 && cat.propreMontant === 0 && (
                      <span className="text-amber-600 dark:text-amber-400 font-semibold text-[10px]">🏢 IDS</span>
                    )}
                    {cat.propreMontant > 0 && cat.idsMontant === 0 && (
                      <span className="text-sky-600 dark:text-sky-400 font-semibold text-[10px]">👤 Propre</span>
                    )}
                    {cat.idsMontant > 0 && cat.propreMontant > 0 && (
                      <span className="text-slate-400 text-[10px]">Mixte</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
