import React, { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

/**
 * Composant RÉPARTITION PAR GENRE
 * - En haut : Titre "RÉPARTITION PAR GENRE" à gauche + Badge "Total : 58 incubé(s)" à droite
 * - Au milieu : Grand demi-cercle (semi-circle donut) centré et bien mis en valeur
 *   - Compteur centré sous l'arche : "58" en grand et "INCUBÉS" en dessous
 * - En dessous du graphe : Légende épurée horizontale :
 *   🔵 Hommes : 46 (79%) │ 🟣 Femmes : 10 (17%) │ ⚪ Autre : 2 (4%)
 */
export default function RepartitionGenre({
  stats = null,
  femmesCount: propFemmesCount = null,
  hommesCount: propHommesCount = null,
  nonSpecifieCount: propNonSpecifieCount = null,
  isDark = false,
  className = ''
}) {
  // 1. Extraction dynamique des données réelles
  const { femmesCount, hommesCount, nonSpecifieCount, total } = useMemo(() => {
    let fCount = 0;
    let hCount = 0;
    let nsCount = 0;

    if (stats?.genreStats && Array.isArray(stats.genreStats)) {
      stats.genreStats.forEach(item => {
        const rawGenre = (item.genre || '').trim().toLowerCase();
        const cnt = Number(item.count) || 0;
        if (rawGenre === 'femme' || rawGenre === 'femmes' || rawGenre === 'f') {
          fCount += cnt;
        } else if (rawGenre === 'homme' || rawGenre === 'hommes' || rawGenre === 'h' || rawGenre === 'm') {
          hCount += cnt;
        } else {
          nsCount += cnt;
        }
      });
    } else {
      fCount = propFemmesCount != null ? Number(propFemmesCount) : 0;
      hCount = propHommesCount != null ? Number(propHommesCount) : 0;
      nsCount = propNonSpecifieCount != null ? Number(propNonSpecifieCount) : 0;
    }

    const t = fCount + hCount + nsCount;
    return {
      femmesCount: fCount,
      hommesCount: hCount,
      nonSpecifieCount: nsCount,
      total: t,
    };
  }, [stats?.genreStats, propFemmesCount, propHommesCount, propNonSpecifieCount]);

  // 2. Pourcentages
  const femmesPct = total > 0 ? Math.round((femmesCount / total) * 100) : 0;
  const hommesPct = total > 0 ? Math.round((hommesCount / total) * 100) : 0;
  const nonSpecifiePct = total > 0 ? Math.max(0, 100 - femmesPct - hommesPct) : 0;

  // 3. Configuration du demi-cercle Chart.js
  const chartData = useMemo(() => {
    const labels = ['Hommes', 'Femmes'];
    const data = [hommesCount, femmesCount];
    const backgroundColor = ['#3b82f6', '#8b5cf6'];
    const hoverBackgroundColor = ['#2563eb', '#7c3aed'];

    if (nonSpecifieCount > 0) {
      labels.push('Autre');
      data.push(nonSpecifieCount);
      backgroundColor.push(isDark ? '#64748b' : '#94a3b8');
      hoverBackgroundColor.push(isDark ? '#475569' : '#64748b');
    }

    return {
      labels,
      datasets: [
        {
          data: total > 0 ? data : [1],
          backgroundColor: total > 0 ? backgroundColor : [isDark ? '#334155' : '#e2e8f0'],
          hoverBackgroundColor: total > 0 ? hoverBackgroundColor : [isDark ? '#334155' : '#e2e8f0'],
          borderWidth: 0,
          borderRadius: 4,
        }
      ]
    };
  }, [hommesCount, femmesCount, nonSpecifieCount, total, isDark]);

  // Options du demi-cercle parfait
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    rotation: 270,        // Démarre à gauche (9h)
    circumference: 180,   // Trace un demi-cercle jusqu'à droite (3h)
    cutout: '72%',        // Arche fine et aérée
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: total > 0,
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        titleColor: isDark ? '#f8fafc' : '#0f172a',
        bodyColor: isDark ? '#cbd5e1' : '#334155',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        borderWidth: 1,
        padding: 10,
        boxPadding: 4,
        usePointStyle: true,
        callbacks: {
          label: (ctx) => {
            const count = ctx.raw || 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return ` ${ctx.label} : ${count} incubé${count > 1 ? 's' : ''} (${pct}%)`;
          }
        }
      }
    }
  }), [isDark, total]);

  return (
    <div className={`card p-5 flex flex-col justify-between min-w-0 hover:border-violet-500/40 transition-all ${className}`}>
      
      {/* 1. EN-TÊTE : Titre à gauche + Badge Total à droite */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
          <span className="text-base">👥</span>
          <span>RÉPARTITION PAR GENRE</span>
        </h3>

        <div className="bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 text-xs font-black px-3 py-1 rounded-full border border-violet-200/80 dark:border-violet-800/40 shrink-0 shadow-xs">
          Total : {total} incubé(s)
        </div>
      </div>

      {/* 2. AU MILIEU : GRAND Demi-cercle centré et bien mis en valeur */}
      <div className="flex-1 w-full flex items-center justify-center my-auto min-h-[170px] sm:min-h-[190px] py-1">
        <div className="relative w-full max-w-[320px] sm:max-w-[360px] h-[160px] sm:h-[180px] flex items-center justify-center">
          <Doughnut data={chartData} options={chartOptions} />
          
          {/* Nombre total d'incubés centré directement sous l'arche */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-center pointer-events-none">
            <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white leading-none block tracking-tight">
              {total}
            </span>
            <span className="text-[11px] sm:text-xs font-bold text-slate-400 dark:text-dark-400 uppercase tracking-widest block mt-1">
              Incubés
            </span>
          </div>
        </div>
      </div>

      {/* 3. EN DESSOUS DU GRAPHE : Hommes, Femmes, Autre épuré en ligne */}
      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-dark-700/60 flex flex-wrap items-center justify-center gap-x-3 sm:gap-x-5 md:gap-x-7 gap-y-2">
        {/* Hommes */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-dark-800 bg-slate-50/80 dark:bg-dark-900/50 hover:bg-slate-100/80 transition-all cursor-pointer">
          <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] shadow-xs shrink-0" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Hommes</span>
          <span className="font-mono text-xs font-black text-blue-600 dark:text-blue-400">
            {hommesCount} ({hommesPct}%)
          </span>
        </div>

        {/* Femmes */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-dark-800 bg-slate-50/80 dark:bg-dark-900/50 hover:bg-slate-100/80 transition-all cursor-pointer">
          <span className="w-2.5 h-2.5 rounded-full bg-[#8b5cf6] shadow-xs shrink-0" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Femmes</span>
          <span className="font-mono text-xs font-black text-violet-600 dark:text-violet-400">
            {femmesCount} ({femmesPct}%)
          </span>
        </div>

        {/* Autre / Non renseigné si existant */}
        {nonSpecifieCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-dark-800 bg-slate-50/80 dark:bg-dark-900/50 hover:bg-slate-100/80 transition-all cursor-pointer">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400 dark:bg-dark-400 shadow-xs shrink-0" />
            <span className="text-xs font-bold text-slate-500 dark:text-dark-400">Autre</span>
            <span className="font-mono text-xs font-black text-slate-600 dark:text-slate-400">
              {nonSpecifieCount} ({nonSpecifiePct}%)
            </span>
          </div>
        )}
      </div>

    </div>
  );
}
