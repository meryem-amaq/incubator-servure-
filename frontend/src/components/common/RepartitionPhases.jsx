import React, { useMemo, useState } from 'react';
import { Layers } from 'lucide-react';

/**
 * Composant RÉPARTITION PAR PHASE D'INCUBATION
 * - Utilise tout l'espace disponible en largeur et en hauteur (pas de vide à gauche ni à droite)
 * - Grand format circulaire asymétrique au centre
 * - Légende épurée en dessous : 🔵 Croissance │ 🟠 Lancement │ 🟢 Idéation │ 🟣 Maturité
 */

const PHASE_CONFIG = {
  croissance: {
    key: 'croissance',
    name: 'Croissance',
    color: '#3b82f6',
    hoverColor: '#2563eb',
    dotClass: 'bg-[#3b82f6]',
  },
  lancement: {
    key: 'lancement',
    name: 'Lancement',
    color: '#f59e0b',
    hoverColor: '#d97706',
    dotClass: 'bg-[#f59e0b]',
  },
  ideation: {
    key: 'ideation',
    name: 'Idéation',
    color: '#10b981',
    hoverColor: '#059669',
    dotClass: 'bg-[#10b981]',
  },
  maturite: {
    key: 'maturite',
    name: 'Maturité',
    color: '#8b5cf6',
    hoverColor: '#7c3aed',
    dotClass: 'bg-[#8b5cf6]',
  },
};

export default function RepartitionPhases({
  stats = null,
  phasesData = null,
  isDark = false,
  className = ''
}) {
  const [hoveredPhase, setHoveredPhase] = useState(null);

  // 1. Extraction dynamique des données réelles depuis stats.phases
  const { phasesList, total } = useMemo(() => {
    const rawPhases = phasesData || stats?.phases || [];
    
    const counts = {
      croissance: 0,
      lancement: 0,
      ideation: 0,
      maturite: 0,
    };

    let autresCount = 0;

    rawPhases.forEach(p => {
      const nom = (p.phase_projet || '').trim().toLowerCase();
      const val = Number(p.count) || 0;

      if (nom.includes('lanc')) {
        counts.lancement += val;
      } else if (nom.includes('croiss')) {
        counts.croissance += val;
      } else if (nom.includes('id') || nom.includes('cadr')) {
        counts.ideation += val;
      } else if (nom.includes('matur')) {
        counts.maturite += val;
      } else if (val > 0) {
        autresCount += val;
      }
    });

    const totalCount = Object.values(counts).reduce((a, b) => a + b, 0) + autresCount;

    // Ordre d'affichage demandé : 🔵 Croissance │ 🟠 Lancement │ 🟢 Idéation │ 🟣 Maturité
    const listOrder = ['croissance', 'lancement', 'ideation', 'maturite'];

    const items = listOrder.map(key => {
      const cfg = PHASE_CONFIG[key];
      const count = counts[key];
      const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
      return {
        ...cfg,
        count,
        pct,
      };
    });

    if (autresCount > 0) {
      items.push({
        key: 'autre',
        name: 'Autre',
        color: '#94a3b8',
        hoverColor: '#64748b',
        dotClass: 'bg-slate-400',
        count: autresCount,
        pct: totalCount > 0 ? Math.round((autresCount / totalCount) * 100) : 0,
      });
    }

    return {
      phasesList: items,
      total: totalCount,
    };
  }, [stats?.phases, phasesData]);

  // 2. Géométrie du Polar Area SVG (Rayons asymétriques & plein format)
  const svgSize = 240;
  const cx = 120;
  const cy = 120;
  const rIn = 22; // Cœur central

  const sectors = useMemo(() => {
    const polarOrder = ['lancement', 'croissance', 'ideation', 'maturite'];
    const totalSectors = polarOrder.length;
    const angleSpan = 360 / totalSectors; // 90° par phase
    const gap = 3; // Écart de 3° entre secteurs

    return polarOrder.map((key, idx) => {
      const item = phasesList.find(p => p.key === key) || PHASE_CONFIG[key];
      const pct = item?.pct || 0;

      // Rayons asymétriques équilibrés pour occuper pleinement la gauche et la droite :
      // - Lancement (53%) -> rayon ~104px (très grand et étendu)
      // - Croissance (28%) -> rayon ~78px (moyen)
      // - Idéation (12%) -> rayon ~60px (présent et bien visible à gauche)
      // - Maturité (7%) -> rayon ~54px (présent et bien visible à gauche)
      const rOut = Math.max(50, Math.min(106, 48 + (pct / 60) * 64));

      const startAngleDeg = idx * angleSpan + gap / 2 - 90;
      const endAngleDeg = (idx + 1) * angleSpan - gap / 2 - 90;

      const startRad = (startAngleDeg * Math.PI) / 180;
      const endRad = (endAngleDeg * Math.PI) / 180;

      const x1 = cx + rIn * Math.cos(startRad);
      const y1 = cy + rIn * Math.sin(startRad);
      const x2 = cx + rOut * Math.cos(startRad);
      const y2 = cy + rOut * Math.sin(startRad);
      const x3 = cx + rOut * Math.cos(endRad);
      const y3 = cy + rOut * Math.sin(endRad);
      const x4 = cx + rIn * Math.cos(endRad);
      const y4 = cy + rIn * Math.sin(endRad);

      const pathD = `M ${x1} ${y1} L ${x2} ${y2} A ${rOut} ${rOut} 0 0 1 ${x3} ${y3} L ${x4} ${y4} A ${rIn} ${rIn} 0 0 0 ${x1} ${y1} Z`;

      const midRad = (startRad + endRad) / 2;
      const rLabel = rIn + (rOut - rIn) * 0.58;
      const xLabel = cx + rLabel * Math.cos(midRad);
      const yLabel = cy + rLabel * Math.sin(midRad);

      return {
        ...item,
        rOut,
        pathD,
        xLabel,
        yLabel,
      };
    });
  }, [phasesList]);

  return (
    <div className={`card p-5 flex flex-col justify-between min-w-0 hover:border-blue-500/40 transition-all ${className}`}>
      
      {/* 1. EN-TÊTE : Titre à gauche + Badge Total à droite */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
          <Layers size={16} className="text-primary-500 shrink-0" />
          <span>RÉPARTITION PAR PHASE D'INCUBATION</span>
        </h3>

        <div className="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-black px-3 py-1 rounded-full border border-blue-200/80 dark:border-blue-800/40 shrink-0 shadow-xs">
          Total : {total} incubé(s)
        </div>
      </div>

      {/* 2. AU MILIEU : GRAND Graphique circulaire qui occupe toute la largeur et la hauteur */}
      <div className="flex-1 w-full flex items-center justify-center my-auto min-h-[240px] sm:min-h-[270px] py-1">
        <div className="relative w-full max-w-[420px] sm:max-w-[480px] h-[250px] sm:h-[280px] flex items-center justify-center">
          <svg
            viewBox={`0 0 ${svgSize} ${svgSize}`}
            className="w-full h-full max-h-[280px] overflow-visible"
          >
            {/* Lignes guides en pointillés adaptées aux nouveaux rayons */}
            <circle
              cx={cx}
              cy={cy}
              r={54}
              fill="none"
              stroke={isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}
              strokeDasharray="3 3"
            />
            <circle
              cx={cx}
              cy={cy}
              r={78}
              fill="none"
              stroke={isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}
              strokeDasharray="3 3"
            />
            <circle
              cx={cx}
              cy={cy}
              r={104}
              fill="none"
              stroke={isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}
              strokeDasharray="3 3"
            />

            {/* Secteurs asymétriques du polar area */}
            {sectors.map((sec) => {
              const isHovered = hoveredPhase === sec.key;
              const isDimmed = hoveredPhase && !isHovered;

              return (
                <g
                  key={sec.key}
                  onMouseEnter={() => setHoveredPhase(sec.key)}
                  onMouseLeave={() => setHoveredPhase(null)}
                  className="cursor-pointer transition-all duration-300"
                  style={{
                    transformOrigin: `${cx}px ${cy}px`,
                    transform: isHovered ? 'scale(1.06)' : 'scale(1)',
                    opacity: isDimmed ? 0.45 : 1,
                  }}
                >
                  <path
                    d={sec.pathD}
                    fill={sec.color}
                    className="transition-all duration-300"
                    style={{
                      filter: isHovered ? 'drop-shadow(0px 6px 14px rgba(0,0,0,0.28))' : 'none',
                    }}
                  />

                  {/* Pourcentage bien visible au cœur de chaque secteur */}
                  <text
                    x={sec.xLabel}
                    y={sec.yLabel}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#ffffff"
                    fontWeight="900"
                    fontSize="13"
                    className="pointer-events-none select-none font-sans"
                    style={{
                      filter: 'drop-shadow(0px 1px 3px rgba(0,0,0,0.8))',
                    }}
                  >
                    {sec.pct}%
                  </text>
                </g>
              );
            })}

            {/* Cœur central neutre */}
            <circle
              cx={cx}
              cy={cy}
              r={rIn - 2}
              className="fill-white dark:fill-dark-800"
              stroke={isDark ? '#334155' : '#e2e8f0'}
              strokeWidth="1.5"
            />
            <circle
              cx={cx}
              cy={cy}
              r={3.5}
              className="fill-slate-400 dark:fill-dark-400"
            />
          </svg>

          {/* Infobulle centrale au survol */}
          {hoveredPhase && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-slate-900/95 dark:bg-dark-900/95 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xl backdrop-blur-xs text-center border border-slate-700/60 animate-fade-in">
                <span>{phasesList.find(p => p.key === hoveredPhase)?.name}</span> :{' '}
                <span className="font-mono text-amber-400 font-black">
                  {phasesList.find(p => p.key === hoveredPhase)?.count} incubés ({phasesList.find(p => p.key === hoveredPhase)?.pct}%)
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. EN DESSOUS DU GRAPHE : Légende horizontale épurée déployée sur toute la largeur */}
      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-dark-700/60 flex flex-wrap items-center justify-center gap-x-3 sm:gap-x-5 md:gap-x-7 gap-y-2">
        {phasesList.map((item) => {
          const isHovered = hoveredPhase === item.key;
          const isDimmed = hoveredPhase && !isHovered;

          return (
            <div
              key={item.key}
              onMouseEnter={() => setHoveredPhase(item.key)}
              onMouseLeave={() => setHoveredPhase(null)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                isHovered
                  ? 'bg-slate-100 dark:bg-dark-700/90 border-slate-300 dark:border-dark-600 shadow-sm scale-105'
                  : 'bg-slate-50/80 dark:bg-dark-900/50 border-slate-200/60 dark:border-dark-800 hover:bg-slate-100/80'
              }`}
              style={{ opacity: isDimmed ? 0.45 : 1 }}
            >
              {/* Point de couleur */}
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                style={{ backgroundColor: item.color }}
              />

              {/* Nom de la phase */}
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {item.name}
              </span>

              {/* Chiffre et pourcentage */}
              <span
                className="font-mono text-xs font-black"
                style={{ color: item.color }}
              >
                {item.count} ({item.pct}%)
              </span>
            </div>
          );
        })}
      </div>

    </div>
  );
}
