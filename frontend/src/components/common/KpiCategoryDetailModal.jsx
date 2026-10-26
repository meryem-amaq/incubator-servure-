import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Search,
  ExternalLink,
  UsersRound,
  Wrench,
  MapPin,
  Scale,
  Rocket,
  Briefcase,
  Building2,
  ChevronRight,
  Filter
} from 'lucide-react';

/**
 * KpiCategoryDetailModal
 * Modale interactive et réutilisable pour afficher la liste des incubés
 * décomposée par catégorie pour n'importe quel KPI (Postes créés, Matériel, Province, Statut, Phase...).
 */
export default function KpiCategoryDetailModal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon = UsersRound,
  themeColor = 'primary', // 'emerald', 'blue', 'amber', 'purple', 'primary'
  categoryLabel = 'Catégorie',
  metricLabel = 'Détail',
  categories = [], // ['Toutes', 'Cat A', 'Cat B']
  items = [], // Array of { id, nom, projet, categorie, metricValue, secondaryText, targetTab }
  customCategoryCounts = null,
  initialCategory = 'Toutes',
}) {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState(initialCategory || 'Toutes');
  const [searchTerm, setSearchTerm] = useState('');

  // Réinitialiser la recherche et catégorie à l'ouverture
  React.useEffect(() => {
    if (isOpen) {
      setSelectedCategory(initialCategory || 'Toutes');
      setSearchTerm('');
    }
  }, [isOpen, initialCategory]);

  // Fermeture par touche Echap
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Calcul du nombre d'items ou total des employés par catégorie pour les badges
  const categoryCounts = useMemo(() => {
    if (customCategoryCounts) return customCategoryCounts;

    const hasContrats = items.some(it => it.contrats);
    const map = {};

    if (hasContrats) {
      let totalAll = 0;
      items.forEach(it => {
        totalAll += (Number(it.total_postes) || Number(it.metricValue) || 0);
      });
      map['Toutes'] = totalAll;

      categories.forEach(cat => {
        if (cat === 'Toutes') return;
        const catLower = cat.trim().toLowerCase();
        let sum = 0;
        items.forEach(it => {
          if (it.contrats) {
            if (catLower.includes('cdi')) sum += (Number(it.contrats.cdi) || 0);
            else if (catLower.includes('cdd')) sum += (Number(it.contrats.cdd) || 0);
            else if (catLower.includes('stage')) sum += (Number(it.contrats.stage) || 0);
            else if (catLower.includes('free') || catLower.includes('prest')) sum += (Number(it.contrats.freelance) || 0);
            else if (catLower.includes('autr')) sum += (Number(it.contrats.autre) || 0);
          }
        });
        map[cat] = sum;
      });
    } else {
      map['Toutes'] = items.length;
      categories.forEach(cat => {
        if (cat === 'Toutes') return;
        const catLower = cat.trim().toLowerCase();
        const count = items.filter(it => {
          if (Array.isArray(it.typesList) && it.typesList.length > 0) {
            return it.typesList.some(t => t.trim().toLowerCase() === catLower);
          }
          const itCat = (it.categorie || '').trim().toLowerCase();
          return itCat === catLower;
        }).length;
        map[cat] = count;
      });
    }

    return map;
  }, [items, categories, customCategoryCounts]);

  // Filtrage combiné : catégorie sélectionnée + recherche texte
  const filteredItems = useMemo(() => {
    let list = items;
    if (selectedCategory && selectedCategory !== 'Toutes') {
      const catLower = selectedCategory.trim().toLowerCase();
      list = list.filter(it => {
        if (it.contrats) {
          if (catLower.includes('cdi')) return (Number(it.contrats.cdi) || 0) > 0;
          if (catLower.includes('cdd')) return (Number(it.contrats.cdd) || 0) > 0;
          if (catLower.includes('stage')) return (Number(it.contrats.stage) || 0) > 0;
          if (catLower.includes('free') || catLower.includes('prest')) return (Number(it.contrats.freelance) || 0) > 0;
          if (catLower.includes('autr')) return (Number(it.contrats.autre) || 0) > 0;
        }
        if (Array.isArray(it.typesList) && it.typesList.length > 0) {
          return it.typesList.some(t => t.trim().toLowerCase() === catLower);
        }
        const itCat = (it.categorie || '').trim().toLowerCase();
        return itCat === catLower;
      });
    }
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(it => 
        (it.nom && it.nom.toLowerCase().includes(q)) ||
        (it.projet && it.projet.toLowerCase().includes(q)) ||
        (it.categorie && it.categorie.toLowerCase().includes(q)) ||
        (it.statut_juridique && it.statut_juridique.toLowerCase().includes(q)) ||
        (it.secondaryText && it.secondaryText.toLowerCase().includes(q)) ||
        (Array.isArray(it.equipements) && it.equipements.some(e => e.toLowerCase().includes(q))) ||
        (Array.isArray(it.articles) && it.articles.some(a => a.toLowerCase().includes(q)))
      );
    }
    return list;
  }, [items, selectedCategory, searchTerm]);

  // Valeur métrique dynamique adaptée selon la catégorie sélectionnée
  const displayItems = useMemo(() => {
    return filteredItems.map(item => {
      let metric = item.metricValue;
      if (item.contrats && selectedCategory && selectedCategory !== 'Toutes') {
        const catLower = selectedCategory.trim().toLowerCase();
        if (catLower.includes('cdi')) metric = `${item.contrats.cdi} CDI`;
        else if (catLower.includes('cdd')) metric = `${item.contrats.cdd} CDD`;
        else if (catLower.includes('stage')) metric = `${item.contrats.stage} Stage`;
        else if (catLower.includes('free') || catLower.includes('prest')) metric = `${item.contrats.freelance} Freelance`;
        else if (catLower.includes('autr')) metric = `${item.contrats.autre} Autre`;
      } else if (item.types_concernes && selectedCategory && selectedCategory !== 'Toutes') {
        const matchingKey = Object.keys(item.types_concernes).find(k => k.trim().toLowerCase() === selectedCategory.trim().toLowerCase());
        if (matchingKey) {
          const q = item.types_concernes[matchingKey];
          metric = `${q} équipement${q > 1 ? 's' : ''}`;
        }
      }
      return {
        ...item,
        displayMetric: metric
      };
    });
  }, [filteredItems, selectedCategory]);

  if (!isOpen) return null;

  // Configuration des couleurs selon le thème du KPI
  const colorConfigs = {
    emerald: {
      iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      activeTab: 'bg-emerald-600 text-white shadow-sm',
      badge: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
      btn: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      borderHover: 'hover:border-emerald-500/40'
    },
    blue: {
      iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      activeTab: 'bg-blue-600 text-white shadow-sm',
      badge: 'bg-blue-500/10 text-blue-800 dark:text-blue-300 border-blue-500/30',
      btn: 'bg-blue-600 hover:bg-blue-700 text-white',
      borderHover: 'hover:border-blue-500/40'
    },
    amber: {
      iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      activeTab: 'bg-amber-600 text-white shadow-sm',
      badge: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30',
      btn: 'bg-amber-600 hover:bg-amber-700 text-white',
      borderHover: 'hover:border-amber-500/40'
    },
    purple: {
      iconBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
      activeTab: 'bg-purple-600 text-white shadow-sm',
      badge: 'bg-purple-500/10 text-purple-800 dark:text-purple-300 border-purple-500/30',
      btn: 'bg-purple-600 hover:bg-purple-700 text-white',
      borderHover: 'hover:border-purple-500/40'
    },
    primary: {
      iconBg: 'bg-primary-500/10 text-primary-600 dark:text-primary-400 border-primary-500/20',
      activeTab: 'bg-primary-600 text-white shadow-sm',
      badge: 'bg-primary-500/10 text-primary-800 dark:text-primary-300 border-primary-500/30',
      btn: 'bg-primary-600 hover:bg-primary-700 text-white',
      borderHover: 'hover:border-primary-500/40'
    }
  };

  const themeCfg = colorConfigs[themeColor] || colorConfigs.primary;

  const handleRowClick = (item) => {
    if (!item.id) return;
    const url = item.targetTab ? `/incubes/${item.id}?tab=${item.targetTab}` : `/incubes/${item.id}`;
    navigate(url);
    onClose();
  };

  const modalContent = (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-700 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête de la modale */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-dark-700/80 bg-slate-50/70 dark:bg-dark-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={`p-2.5 rounded-xl border shrink-0 ${themeCfg.iconBg}`}>
              <Icon size={22} />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                {title}
              </h2>
              <p className="text-xs text-slate-500 dark:text-dark-400 mt-0.5">
                {subtitle || 'Cliquez sur un incubé pour accéder directement à sa fiche détaillée'}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="self-end sm:self-auto p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-dark-700 transition-colors cursor-pointer"
            title="Fermer (Échap)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Barre de Filtres par Catégorie & Recherche */}
        <div className="p-4 border-b border-slate-200/80 dark:border-dark-700/60 bg-white dark:bg-dark-850 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Onglets / Pills de Catégories */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none flex-1">
            <span className="text-xs font-bold text-slate-400 dark:text-dark-400 flex items-center gap-1 mr-1 shrink-0">
              <Filter size={13} /> {categoryLabel} :
            </span>
            {categories.map((cat) => {
              const count = categoryCounts[cat] ?? 0;
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? themeCfg.activeTab
                      : 'bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-dark-300 hover:bg-slate-200 dark:hover:bg-dark-700'
                  }`}
                >
                  <span>{cat}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    isSelected ? 'bg-white/25 text-white' : 'bg-slate-200/80 dark:bg-dark-700 text-slate-500 dark:text-dark-300'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Recherche */}
          <div className="relative min-w-[220px] sm:min-w-[260px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher incubé, projet..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl focus:outline-none focus:border-primary-500 text-slate-800 dark:text-white placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Tableau / Liste des incubés */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {filteredItems.length === 0 ? (
            <div className="text-center py-16 text-slate-400 dark:text-dark-400 space-y-2">
              <p className="text-sm font-semibold">Aucun incubé ne correspond à ces critères</p>
              <p className="text-xs opacity-75">Essayez de modifier la catégorie sélectionnée ou la recherche</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-dark-700 text-slate-400 uppercase tracking-wider font-bold">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Incubé & Projet</th>
                    <th className="py-2.5 px-3">{categoryLabel}</th>
                    <th className="py-2.5 px-3 text-right">
                      {selectedCategory && selectedCategory !== 'Toutes' && items.some(i => i.contrats) ? `Postes ${selectedCategory}` : metricLabel}
                    </th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-dark-800/80">
                  {displayItems.map((item, idx) => (
                    <tr
                      key={item.id || idx}
                      onClick={() => handleRowClick(item)}
                      className="group hover:bg-slate-50 dark:hover:bg-dark-800/50 transition-colors cursor-pointer"
                    >
                      {/* Numéro */}
                      <td className="py-3 px-3 text-slate-400 font-mono text-[11px] w-8">
                        {idx + 1}
                      </td>

                      {/* Incubé & Projet */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-dark-700 text-slate-700 dark:text-slate-200 font-extrabold flex items-center justify-center text-xs shrink-0 border border-slate-200/80 dark:border-dark-600">
                            {(item.nom || 'I').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors flex items-center gap-1.5">
                              {item.projet || item.nom}
                            </p>
                            {item.nom && item.nom !== item.projet && (
                              <p className="text-[11px] text-slate-500 dark:text-dark-400 truncate">
                                Porteur : <span className="font-semibold text-slate-600 dark:text-slate-300">{item.nom}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Catégorie & Détails / Équipements / Contrats */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {item.typesList && item.typesList.length > 0 ? (
                            item.typesList.map(t => (
                              <span key={t} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                                {t} {item.types_concernes?.[t] ? `(${item.types_concernes[t]})` : ''}
                              </span>
                            ))
                          ) : (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${themeCfg.badge}`}>
                              {item.categorie || 'Non spécifié'}
                            </span>
                          )}
                          {item.statut_juridique && item.statut_juridique !== item.categorie && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-dark-700">
                              {item.statut_juridique}
                            </span>
                          )}
                          {item.unites_ids > 0 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                              🏢 IDS : {item.unites_ids}
                            </span>
                          )}
                          {item.unites_propre > 0 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                              👤 Propre : {item.unites_propre}
                            </span>
                          )}
                        </div>

                        {/* Badges détaillés des contrats (CDI, CDD, Stage, Freelance, Autre) */}
                        {item.contrats && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {Number(item.contrats.cdi) > 0 && (
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                                {item.contrats.cdi} CDI
                              </span>
                            )}
                            {Number(item.contrats.cdd) > 0 && (
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                {item.contrats.cdd} CDD
                              </span>
                            )}
                            {Number(item.contrats.stage) > 0 && (
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                                {item.contrats.stage} Stage
                              </span>
                            )}
                            {Number(item.contrats.freelance) > 0 && (
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                {item.contrats.freelance} Freelance
                              </span>
                            )}
                            {Number(item.contrats.autre) > 0 && (
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30">
                                {item.contrats.autre} Autre
                              </span>
                            )}
                          </div>
                        )}

                        {item.equipements && item.equipements.length > 0 ? (
                          <div className="mt-1.5 flex flex-wrap gap-1 max-w-lg">
                            {item.equipements.slice(0, 4).map((eq, eqIdx) => (
                              <span key={eqIdx} className="inline-block text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-dark-700 font-medium truncate max-w-[200px]" title={eq}>
                                {eq}
                              </span>
                            ))}
                            {item.equipements.length > 4 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 self-center">
                                +{item.equipements.length - 4} autre(s)
                              </span>
                            )}
                          </div>
                        ) : item.secondaryText ? (
                          <p className="text-[11px] text-slate-500 dark:text-dark-400 mt-1 max-w-md line-clamp-2">
                            {item.secondaryText}
                          </p>
                        ) : null}
                      </td>

                      {/* Métrique / Valeur principale */}
                      <td className="py-3 px-3 text-right">
                        <span className="font-mono font-black text-xs text-slate-900 dark:text-white">
                          {item.displayMetric ?? item.metricValue ?? '—'}
                        </span>
                      </td>

                      {/* Bouton d'action */}
                      <td className="py-3 px-3 text-center w-28">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(item);
                          }}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shadow-2xs cursor-pointer ${themeCfg.btn}`}
                        >
                          <span>{item.targetTab === 'rh' ? 'Voir RH' : item.targetTab === 'materiel' ? 'Voir Matériel' : item.targetTab === 'financier' ? 'Voir Finance' : 'Voir Profil'}</span>
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

        {/* Pied de la modale */}
        <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-dark-700 bg-slate-50/50 dark:bg-dark-900/50 flex items-center justify-between text-xs text-slate-500 dark:text-dark-400">
          <span>
            {items.some(i => i.contrats) ? (
              <>
                Total : <strong className="text-slate-800 dark:text-white font-mono">{categoryCounts[selectedCategory] || 0}</strong> poste(s) / employé(s) créés répartis sur <strong className="text-slate-800 dark:text-white font-mono">{filteredItems.length}</strong> incubé(s)
              </>
            ) : (
              <>
                Affichage de <strong className="text-slate-800 dark:text-white font-mono">{filteredItems.length}</strong> sur <strong className="text-slate-800 dark:text-white font-mono">{items.length}</strong> incubé(s)
              </>
            )}
          </span>
          <span className="text-[11px] text-slate-400">
            Astuce : Cliquez directement sur une ligne pour ouvrir le dossier
          </span>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
