import React, { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';

/**
 * NiveauEtudeChart
 * Composant autonome et réutilisable pour le KPI « NIVEAU D'ÉTUDE ».
 * Donut centré moderne avec compteur au cœur et légende horizontale épurée.
 */
export default function NiveauEtudeChart({ stats, isDark = false, className = '' }) {
  // 1. Normalisation et agrégation des niveaux d'étude
  const etudeNormalized = useMemo(() => {
    const rawList = stats?.etudeStats || [];
    const map = {};

    rawList.forEach(item => {
      let lvl = (item.niveau_etude || '').trim();
      if (!lvl || lvl.toLowerCase() === 'null') {
        lvl = 'Non spécifié';
      } else if (
        lvl.toLowerCase().includes('doct') ||
        lvl.toLowerCase().includes('master') ||
        lvl.toLowerCase().includes('bac+5') ||
        lvl.toLowerCase().includes('bac +5') ||
        lvl.toLowerCase().includes('ingénieur') ||
        lvl.toLowerCase().includes('ingenieur') ||
        lvl.includes('Bac+5 et plus') ||
        lvl.includes('Bac+5+')
      ) {
        lvl = 'Bac+5 et plus';
      } else if (
        lvl.toLowerCase().includes('licence') ||
        lvl.toLowerCase().includes('bac+3') ||
        lvl.toLowerCase().includes('bac +3') ||
        lvl.toLowerCase().includes('bac+4') ||
        lvl.toLowerCase().includes('bac +4')
      ) {
        lvl = 'Bac+3';
      } else if (
        lvl.toLowerCase().startsWith('ts') ||
        lvl.toLowerCase().includes('technicien') ||
        lvl.toLowerCase().includes('bac+2') ||
        lvl.toLowerCase().includes('bac +2') ||
        lvl.toLowerCase().includes('bts') ||
        lvl.toLowerCase().includes('dut')
      ) {
        lvl = 'Bac+2';
      } else if (
        lvl.toLowerCase() === 'bac' ||
        lvl.toLowerCase() === 'baccalauréat' ||
        lvl.toLowerCase().includes('bac+1') ||
        lvl.toLowerCase().includes('bac +1')
      ) {
        lvl = 'Bac';
      } else if (lvl.toLowerCase().includes('niveau bac')) {
        lvl = 'Niveau Bac';
      } else {
        map[lvl] = (map[lvl] || 0) + (Number(item.count) || 0);
        return;
      }
      map[lvl] = (map[lvl] || 0) + (Number(item.count) || 0);
    });

    const hierarchy = ['Bac+5 et plus', 'Bac+3', 'Bac+2', 'Bac', 'Niveau Bac', 'Non spécifié'];
    const colorsMap = {
      'Bac+5 et plus': '#8b5cf6', // Violet
      'Bac+3': '#10b981',        // Vert émeraude
      'Bac+2': '#14b8a6',        // Turquoise
      'Bac': '#6366f1',          // Indigo
      'Niveau Bac': '#f97316',   // Orange
      'Non spécifié': '#94a3b8', // Gris ardoise
    };

    const sortedKeys = Object.keys(map).sort((a, b) => {
      const idxA = hierarchy.indexOf(a);
      const idxB = hierarchy.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    const total = Object.values(map).reduce((sum, v) => sum + v, 0);

    const breakdown = sortedKeys.map(key => ({
      label: key,
      count: map[key],
      pct: total > 0 ? Math.round((map[key] / total) * 100) : 0,
      color: colorsMap[key] || '#6366f1',
    }));

    return {
      labels: breakdown.map(b => b.label),
      values: breakdown.map(b => b.count),
      colors: breakdown.map(b => b.color),
      breakdown,
      total,
    };
  }, [stats?.etudeStats]);

  // 2. Configuration du Donut
  const doughnutData = useMemo(() => ({
    labels: etudeNormalized.labels,
    datasets: [{
      data: etudeNormalized.values,
      backgroundColor: etudeNormalized.colors,
      borderWidth: isDark ? 2 : 1,
      borderColor: isDark ? '#1e293b' : '#ffffff',
      cutout: '62%',
    }]
  }), [etudeNormalized, isDark]);

  const doughnutOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? '#0f172a' : '#1e293b',
        titleColor: '#ffffff',
        bodyColor: '#e2e8f0',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
        borderWidth: 1,
        padding: 10,
        boxPadding: 4,
        cornerRadius: 8,
        callbacks: {
          label: (ctx) => {
            const count = ctx.raw || 0;
            const pct = etudeNormalized.total > 0 ? Math.round((count / etudeNormalized.total) * 100) : 0;
            return ` ${ctx.label} : ${count} incubé${count > 1 ? 's' : ''} (${pct}%)`;
          }
        }
      }
    }
  }), [isDark, etudeNormalized.total]);

  return (
    <div className={`card p-5 flex flex-col justify-between h-auto min-h-[340px] min-w-0 hover:border-primary-500/40 transition-all shadow-sm ${className}`}>
      {/* En-tête : Titre & Badge Total */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase flex items-center gap-1.5">
            <span>🎓</span>
            <span>NIVEAU D'ÉTUDE</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-dark-400">
            Profil académique des incubés
          </p>
        </div>
        <div className="bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-bold px-2.5 py-0.5 rounded-full border border-primary-200 dark:border-primary-800/40 shrink-0 shadow-2xs">
          Total : {etudeNormalized.total} incubés
        </div>
      </div>

      {/* Au milieu : Doughnut centré avec compteur au cœur */}
      <div className="flex-1 w-full flex items-center justify-center my-auto min-h-[160px] py-0.5">
        <div className="relative w-full max-w-[280px] sm:max-w-[320px] h-[165px] sm:h-[175px] flex items-center justify-center">
          <Doughnut data={doughnutData} options={doughnutOptions} />

          {/* Compteur central d'incubés */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-3xl font-black text-slate-900 dark:text-white leading-none tracking-tight">
              {etudeNormalized.total}
            </span>
            <span className="text-[11px] font-bold text-slate-400 dark:text-dark-400 uppercase tracking-widest mt-1">
              Incubés
            </span>
          </div>
        </div>
      </div>

      {/* En dessous du graphe : Légende horizontale épurée */}
      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-dark-700/60 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
        {etudeNormalized.breakdown.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-dark-800 bg-slate-50/80 dark:bg-dark-900/50 hover:bg-slate-100/80 transition-all cursor-pointer text-xs"
          >
            <span className="w-2.5 h-2.5 rounded-sm shrink-0 shadow-xs" style={{ backgroundColor: item.color }} />
            <span className="font-bold text-slate-800 dark:text-slate-200">{item.label}</span>
            <span className="font-mono font-black" style={{ color: item.color }}>
              {item.count} ({item.pct}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
