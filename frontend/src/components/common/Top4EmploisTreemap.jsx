import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import { Trophy, Eye, ExternalLink, Briefcase } from 'lucide-react';

/**
 * Top4EmploisTreemap -> Graphique en Barres & Podium des Meilleurs Créateurs d'Emplois
 * Remplace la mosaïque Treemap par un histogramme à barres propre, structuré et interactif.
 * Clic sur une barre ou sur le nom d'un incubé redirige vers son dossier RH (/incubes/:id?tab=rh).
 */
export default function Top4EmploisTreemap({
  top4PostesList = [],
  isDark = false,
  className = '',
  onOpenModal = null
}) {
  const navigate = useNavigate();

  // 1. Calculs des totaux
  const totalTopPostes = useMemo(() => {
    return (top4PostesList || []).reduce((acc, c) => acc + (Number(c.total_postes) || 0), 0);
  }, [top4PostesList]);

  // 2. Configuration des rangs et couleurs des médailles
  const rankConfigs = [
    { rank: '1er', medal: '🥇', color: '#10b981', hoverColor: '#059669', badgeBg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
    { rank: '2ème', medal: '🥈', color: '#3b82f6', hoverColor: '#2563eb', badgeBg: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30' },
    { rank: '3ème', medal: '🥉', color: '#f59e0b', hoverColor: '#d97706', badgeBg: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30' },
    { rank: '4ème', medal: '4ème', medalIcon: '🎖️', color: '#8b5cf6', hoverColor: '#7c3aed', badgeBg: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30' }
  ];

  // 3. Préparation des données pour le Chart.js Bar Chart
  const chartData = useMemo(() => {
    const labels = (top4PostesList || []).map((item, idx) => {
      const cfg = rankConfigs[idx] || rankConfigs[3];
      const name = item.projet || item.nom || 'Inconnu';
      const shortName = name.length > 22 ? `${name.substring(0, 20)}…` : name;
      return `${cfg.medal || cfg.medalIcon || '🎖️'} ${shortName}`;
    });

    const data = (top4PostesList || []).map(item => Number(item.total_postes) || 0);
    const bgColors = (top4PostesList || []).map((_, idx) => rankConfigs[idx]?.color || '#8b5cf6');
    const hoverBgColors = (top4PostesList || []).map((_, idx) => rankConfigs[idx]?.hoverColor || '#7c3aed');

    return {
      labels,
      datasets: [
        {
          label: 'Postes créés',
          data,
          backgroundColor: bgColors,
          hoverBackgroundColor: hoverBgColors,
          borderRadius: 8,
          barPercentage: 0.65,
          categoryPercentage: 0.85
        }
      ]
    };
  }, [top4PostesList]);

  // 4. Options Chart.js adaptées (Histogramme Horizontal)
  const chartOptions = useMemo(() => {
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';

    return {
      indexAxis: 'y',
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
          cornerRadius: 8,
          callbacks: {
            title: (tooltipItems) => {
              const idx = tooltipItems[0]?.dataIndex;
              const item = top4PostesList[idx];
              if (!item) return '';
              return `${item.projet || item.nom}`;
            },
            label: (context) => {
              const idx = context.dataIndex;
              const item = top4PostesList[idx];
              if (!item) return '';
              const parts = [`Postes : ${item.total_postes || 0}`];
              const contratParts = [];
              if (Number(item.cdi_count) > 0) contratParts.push(`${item.cdi_count} CDI`);
              if (Number(item.cdd_count) > 0) contratParts.push(`${item.cdd_count} CDD`);
              if (Number(item.stage_count) > 0) contratParts.push(`${item.stage_count} Stage`);
              if (Number(item.freelance_count) > 0) contratParts.push(`${item.freelance_count} Freelance`);
              if (Number(item.autres_count) > 0) contratParts.push(`${item.autres_count} Autre`);
              if (contratParts.length > 0) parts.push(`Contrats : ${contratParts.join(', ')}`);
              return parts;
            },
            afterLabel: () => '👉 Cliquez pour voir le dossier RH'
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            stepSize: 1,
            precision: 0,
            font: { size: 11, family: "'Inter', sans-serif" }
          }
        },
        y: {
          grid: { display: false },
          ticks: {
            color: isDark ? '#f1f5f9' : '#1e293b',
            font: { size: 12, family: "'Inter', sans-serif", weight: '700' }
          }
        }
      },
      onClick: (_event, elements) => {
        if (elements && elements.length > 0) {
          const idx = elements[0].index;
          const item = top4PostesList[idx];
          const incId = item?.id || item?.incube_id;
          if (incId) {
            navigate(`/incubes/${incId}?tab=rh`);
          }
        }
      }
    };
  }, [isDark, top4PostesList, navigate]);

  const handleOpenIncube = (item) => {
    const incId = item?.id || item?.incube_id;
    if (incId) {
      navigate(`/incubes/${incId}?tab=rh`);
    }
  };

  return (
    <div className={`card p-5 flex flex-col justify-between min-w-0 hover:border-emerald-500/40 transition-all ${className}`}>
      
      {/* 1. EN-TÊTE : Titre cliquable + Bouton Voir par incubé + Total */}
      <div className="flex justify-between items-start mb-3">
        <button
          type="button"
          onClick={() => {
            if (onOpenModal) onOpenModal();
          }}
          className="group cursor-pointer select-none text-left"
          title="Cliquer pour voir la décomposition des postes créés par tous les incubés"
        >
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase flex items-center gap-2 group-hover:text-emerald-500 transition-colors">
            <Trophy size={16} className="text-emerald-500 shrink-0 group-hover:scale-110 transition-transform" />
            <span className="group-hover:underline underline-offset-2">TOP CRÉATEURS D'EMPLOIS</span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-2xs">
              <Eye size={11} /> Voir par incubé
            </span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-dark-400 mt-1">
            Classement des incubés par nombre de postes créés
          </p>
        </button>

        <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/40 shrink-0">
          Total Top 4 : {totalTopPostes} postes
        </div>
      </div>

      {/* 2. GRAPHIQUE EN BARRES (HISTOGRAMME HORIZONTAL) */}
      <div className="flex-1 min-h-[220px] py-2 flex items-center">
        {top4PostesList.length === 0 ? (
          <div className="h-full w-full flex items-center justify-center text-xs text-slate-400 dark:text-dark-400">
            Aucun poste créé enregistré
          </div>
        ) : (
          <div className="w-full h-full min-h-[200px]">
            <Bar data={chartData} options={chartOptions} />
          </div>
        )}
      </div>

    </div>
  );
}
