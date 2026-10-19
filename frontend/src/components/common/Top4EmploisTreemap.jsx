import React, { useState, useMemo } from 'react';

/**
 * Top4EmploisTreemap
 * Format semi-cadre (1 colonne) : Carte proportionnelle (Treemap) pure
 * Style épuré conforme à l'image de référence avec blocs colorés pleins et séparateurs blancs fins.
 */
export default function Top4EmploisTreemap({ top4PostesList = [], isDark = false, className = '' }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  // 1. Calculs des totaux
  const totalPostes = useMemo(() => {
    return (top4PostesList || []).reduce((acc, c) => acc + (Number(c.total_postes) || 0), 0);
  }, [top4PostesList]);

  // 2. Palette de couleurs plates et harmonieuses (inspirée de l'image de référence)
  const palette = [
    {
      color: '#70ab94', // Vert sauge / menthe (comme "Asia")
      medal: '🥇 1er'
    },
    {
      color: '#de5254', // Rouge corail / brique (comme "Africa")
      medal: '🥈 2ème'
    },
    {
      color: '#9b88be', // Lavande / violet pastel (comme "Europe")
      medal: '🥉 3ème'
    },
    {
      color: '#edc153', // Jaune doré / ambre (comme "North America")
      medal: '🎖️ 4ème'
    }
  ];

  // 3. Partitionnement proportionnel Treemap (adapté pour 1 colonne / semi-cadre)
  const layout = useMemo(() => {
    if (!top4PostesList || top4PostesList.length === 0) return null;

    const count = top4PostesList.length;
    const items = top4PostesList.map((item, idx) => {
      const postes = Number(item.total_postes) || 0;
      const pct = totalPostes > 0 ? Math.round((postes / totalPostes) * 100) : 0;
      const pal = palette[idx % palette.length];
      return {
        ...item,
        postes,
        pct,
        pal,
        idx,
        nomProjet: item.projet || item.nom,
        nomIncube: item.nom && item.nom !== item.projet ? item.nom : null
      };
    });

    if (count === 1) {
      return { type: 'single', item: items[0] };
    }

    if (count === 2) {
      const w0 = items[0].postes || 1;
      const w1 = items[1].postes || 1;
      const sum = w0 + w1;
      return {
        type: 'two',
        left: { item: items[0], widthPct: (w0 / sum) * 100 },
        right: { item: items[1], widthPct: (w1 / sum) * 100 }
      };
    }

    if (count === 3) {
      const w0 = items[0].postes || 1;
      const wRight = (items[1].postes || 1) + (items[2].postes || 1);
      const sum = w0 + wRight;
      const leftWidth = (w0 / sum) * 100;
      const rightWidth = 100 - leftWidth;

      const h1 = ((items[1].postes || 1) / wRight) * 100;
      const h2 = 100 - h1;

      return {
        type: 'three',
        left: { item: items[0], widthPct: leftWidth },
        right: {
          widthPct: rightWidth,
          top: { item: items[1], heightPct: h1 },
          bottom: { item: items[2], heightPct: h2 }
        }
      };
    }

    // 4 items : Disposition Treemap exacte inspirée de l'image de référence
    // - Gauche (Item 0) : toute la hauteur
    // - Droite Haut (Item 1) : toute la largeur droite
    // - Droite Bas (Item 2 & Item 3) : côte à côte
    const wLeft = items[0].postes || 1;
    const wRight = (items[1].postes || 1) + (items[2].postes || 1) + (items[3].postes || 1);
    const totalW = wLeft + wRight;

    // Proportions équilibrées pour affichage en demi-cadre
    const rawLeftWidth = (wLeft / totalW) * 100;
    const leftWidth = Math.max(38, Math.min(52, rawLeftWidth));
    const rightWidth = 100 - leftWidth;

    const wTopRight = items[1].postes || 1;
    const wBottomRight = (items[2].postes || 1) + (items[3].postes || 1);
    const totalRight = wTopRight + wBottomRight;

    const topHeight = Math.max(38, Math.min(55, (wTopRight / totalRight) * 100));
    const bottomHeight = 100 - topHeight;

    const bottomItem2Width = ((items[2].postes || 1) / wBottomRight) * 100;
    const bottomItem3Width = 100 - bottomItem2Width;

    return {
      type: 'four',
      left: {
        widthPct: leftWidth,
        item: items[0]
      },
      right: {
        widthPct: rightWidth,
        top: {
          heightPct: topHeight,
          item: items[1]
        },
        bottom: {
          heightPct: bottomHeight,
          item2: {
            widthPct: bottomItem2Width,
            item: items[2]
          },
          item3: {
            widthPct: bottomItem3Width,
            item: items[3]
          }
        }
      }
    };
  }, [top4PostesList, totalPostes]);

  // Rendu d'une tuile Treemap
  const renderTile = (item, extraClasses = '') => {
    if (!item) return null;
    const isHovered = hoveredIdx === item.idx;

    return (
      <div
        key={item.idx}
        onMouseEnter={() => setHoveredIdx(item.idx)}
        onMouseLeave={() => setHoveredIdx(null)}
        style={{ backgroundColor: item.pal.color }}
        className={`relative p-2.5 sm:p-3 flex flex-col justify-start text-white transition-all duration-200 cursor-pointer select-none overflow-hidden ${
          isHovered ? 'brightness-105 z-10' : ''
        } ${extraClasses}`}
        title={`${item.nomProjet} : ${item.postes} poste(s) créé(s) (${item.pct}%)`}
      >
        {/* Titre du projet en blanc et gras */}
        <span className="font-bold text-white text-xs sm:text-sm md:text-base tracking-tight leading-tight line-clamp-2">
          {item.nomProjet}
        </span>

        {/* Valeur numérique & pourcentage */}
        <span className="text-white/95 text-[11px] sm:text-xs font-semibold mt-0.5">
          {item.postes} {item.postes > 1 ? 'postes' : 'poste'} <span className="text-white/80 font-normal">({item.pct}%)</span>
        </span>

        {/* Porteur (s'il existe et diffère du projet) */}
        {item.nomIncube && (
          <span className="text-white/75 text-[10px] truncate mt-0.5 hidden sm:block">
            {item.nomIncube}
          </span>
        )}

        {/* Médaille discrète dans le coin */}
        <span className="absolute top-1.5 right-1.5 text-[10px] opacity-70 font-bold">
          {item.pal.medal}
        </span>
      </div>
    );
  };

  return (
    <div className={`card p-5 flex flex-col justify-between h-auto min-h-[340px] min-w-0 hover:border-emerald-500/40 transition-all shadow-sm ${className}`}>
      
      {/* 1. EN-TÊTE : Titre & Badge Total (sans boutons de barres) */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase flex items-center gap-1.5">
            <span>🏆</span>
            <span>TOP 4 CRÉATEURS D'EMPLOIS</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-dark-400">
            Carte proportionnelle des recrutements générés
          </p>
        </div>

        {/* Badge Total */}
        <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-1.5 shadow-2xs shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>{totalPostes} postes (Top 4)</span>
        </div>
      </div>

      {/* 2. CARTE PROPORTIONNELLE (TREEMAP 2D) */}
      {top4PostesList && top4PostesList.length > 0 ? (
        <div className="w-full flex-1 flex flex-col justify-between my-auto">
          {/* Mosaïque Treemap avec séparateurs blancs nets (gap-[2px]) */}
          <div className="w-full h-[200px] sm:h-[220px] rounded-xl overflow-hidden bg-white dark:bg-dark-900 p-[2px] shadow-2xs my-1">
            <div className="w-full h-full flex flex-row gap-[2px]">
              {layout?.type === 'four' && (
                <>
                  {/* Bloc Gauche : 1er (comme "Asia") */}
                  <div
                    style={{ width: `${layout.left.widthPct}%` }}
                    className="h-full"
                  >
                    {renderTile(layout.left.item, 'h-full w-full')}
                  </div>

                  {/* Bloc Droit : Découpé en Haut (2ème) et Bas (3ème & 4ème) */}
                  <div
                    style={{ width: `${layout.right.widthPct}%` }}
                    className="h-full flex flex-col gap-[2px]"
                  >
                    {/* Haut Droite : 2ème (comme "Africa") */}
                    <div
                      style={{ height: `${layout.right.top.heightPct}%` }}
                      className="w-full"
                    >
                      {renderTile(layout.right.top.item, 'h-full w-full')}
                    </div>

                    {/* Bas Droite : 3ème & 4ème côte à côte (comme "North America" & "South America") */}
                    <div
                      style={{ height: `${layout.right.bottom.heightPct}%` }}
                      className="w-full flex flex-row gap-[2px]"
                    >
                      <div
                        style={{ width: `${layout.right.bottom.item2.widthPct}%` }}
                        className="h-full"
                      >
                        {renderTile(layout.right.bottom.item2.item, 'h-full w-full')}
                      </div>
                      <div
                        style={{ width: `${layout.right.bottom.item3.widthPct}%` }}
                        className="h-full"
                      >
                        {renderTile(layout.right.bottom.item3.item, 'h-full w-full')}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {layout?.type === 'three' && (
                <>
                  <div style={{ width: `${layout.left.widthPct}%` }} className="h-full">
                    {renderTile(layout.left.item, 'h-full w-full')}
                  </div>
                  <div
                    className="flex flex-col gap-[2px] h-full"
                    style={{ width: `${layout.right.widthPct}%` }}
                  >
                    <div style={{ height: `${layout.right.top.heightPct}%` }} className="w-full">
                      {renderTile(layout.right.top.item, 'h-full w-full')}
                    </div>
                    <div style={{ height: `${layout.right.bottom.heightPct}%` }} className="w-full">
                      {renderTile(layout.right.bottom.item, 'h-full w-full')}
                    </div>
                  </div>
                </>
              )}

              {layout?.type === 'two' && (
                <>
                  <div style={{ width: `${layout.left.widthPct}%` }} className="h-full">
                    {renderTile(layout.left.item, 'h-full w-full')}
                  </div>
                  <div style={{ width: `${layout.right.widthPct}%` }} className="h-full">
                    {renderTile(layout.right.item, 'h-full w-full')}
                  </div>
                </>
              )}

              {layout?.type === 'single' && (
                <div className="w-full h-full">
                  {renderTile(layout.item, 'h-full w-full')}
                </div>
              )}
            </div>
          </div>

          {/* 3. LÉGENDE HORIZONTALE ÉPURÉE EN DESSOUS */}
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-dark-700/60 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
            {top4PostesList.map((item, idx) => {
              const pal = palette[idx % palette.length];
              const count = Number(item.total_postes) || 0;
              const pct = totalPostes > 0 ? Math.round((count / totalPostes) * 100) : 0;
              const label = item.projet || item.nom;

              return (
                <div
                  key={idx}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer text-xs ${
                    hoveredIdx === idx
                      ? 'bg-slate-200/80 dark:bg-dark-700 border-slate-400 dark:border-dark-500 scale-105'
                      : 'bg-slate-50/80 dark:bg-dark-900/50 border-slate-200/60 dark:border-dark-800 hover:bg-slate-100/80'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0 shadow-xs" style={{ backgroundColor: pal.color }} />
                  <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[120px] sm:max-w-[150px]" title={label}>
                    {label}
                  </span>
                  <span className="font-mono font-black" style={{ color: pal.color }}>
                    {count} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>

        </div>
      ) : (
        <div className="py-10 text-center text-xs text-slate-400 dark:text-dark-400 italic">
          Aucune donnée de recrutement disponible actuellement
        </div>
      )}
    </div>
  );
}
