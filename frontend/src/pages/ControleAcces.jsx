import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  DoorOpen, 
  Building2, 
  Users, 
  Search, 
  RefreshCw, 
  Calendar, 
  Filter, 
  Clock, 
  ArrowDownRight, 
  ArrowUpRight, 
  Download, 
  Radio, 
  X, 
  ShieldCheck, 
  GraduationCap, 
  Briefcase, 
  UserPlus, 
  HelpCircle,
  HardHat,
  Sparkles,
  Wifi
} from 'lucide-react';
import api, { getPhotoUrl } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

// Définition des couleurs et styles par catégorie
const CATEGORY_STYLES = {
  Administration: {
    label: 'Administration',
    bg: 'bg-blue-500/10 dark:bg-blue-500/20',
    border: 'border-blue-500/30',
    text: 'text-blue-700 dark:text-blue-300',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-300/40',
    kpiCard: 'hover:border-blue-500/60 dark:hover:border-blue-500/50',
    activeRing: 'ring-2 ring-blue-500 shadow-blue-500/20',
    icon: ShieldCheck,
    avatarBg: 'bg-blue-600 text-white'
  },
  Incube: {
    label: 'Incubé',
    bg: 'bg-amber-500/10 dark:bg-amber-500/20',
    border: 'border-amber-500/30',
    text: 'text-amber-700 dark:text-amber-400',
    badge: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300/40',
    kpiCard: 'hover:border-amber-500/60 dark:hover:border-amber-500/50',
    activeRing: 'ring-2 ring-amber-500 shadow-amber-500/20',
    icon: Sparkles,
    avatarBg: 'bg-amber-500 text-[#02162B]'
  },
  Formation: {
    label: 'Formation',
    bg: 'bg-purple-500/10 dark:bg-purple-500/20',
    border: 'border-purple-500/30',
    text: 'text-purple-700 dark:text-purple-300',
    badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-300/40',
    kpiCard: 'hover:border-purple-500/60 dark:hover:border-purple-500/50',
    activeRing: 'ring-2 ring-purple-500 shadow-purple-500/20',
    icon: GraduationCap,
    avatarBg: 'bg-purple-600 text-white'
  },
  Visiteur: {
    label: 'Visiteur',
    bg: 'bg-slate-500/10 dark:bg-slate-500/20',
    border: 'border-slate-500/30',
    text: 'text-slate-700 dark:text-slate-300',
    badge: 'bg-slate-100 text-slate-800 dark:bg-slate-800/80 dark:text-slate-300 border border-slate-300/40',
    kpiCard: 'hover:border-slate-500/60 dark:hover:border-slate-500/50',
    activeRing: 'ring-2 ring-slate-500 shadow-slate-500/20',
    icon: UserPlus,
    avatarBg: 'bg-slate-600 text-white'
  },
  Prestataire: {
    label: 'Prestataire',
    bg: 'bg-teal-500/10 dark:bg-teal-500/20',
    border: 'border-teal-500/30',
    text: 'text-teal-700 dark:text-teal-300',
    badge: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 border border-teal-300/40',
    kpiCard: 'hover:border-teal-500/60 dark:hover:border-teal-500/50',
    activeRing: 'ring-2 ring-teal-500 shadow-teal-500/20',
    icon: HardHat,
    avatarBg: 'bg-teal-600 text-white'
  },
  Autre: {
    label: 'Autre',
    bg: 'bg-zinc-500/10 dark:bg-zinc-500/20',
    border: 'border-zinc-500/30',
    text: 'text-zinc-700 dark:text-zinc-300',
    badge: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300 border border-zinc-300/40',
    kpiCard: 'hover:border-zinc-500/60 dark:hover:border-zinc-500/50',
    activeRing: 'ring-2 ring-zinc-500 shadow-zinc-500/20',
    icon: HelpCircle,
    avatarBg: 'bg-zinc-600 text-white'
  }
};

const CATEGORIES_LIST = [
  'Tous',
  'Administration',
  'Incube',
  'Formation',
  'Visiteur',
  'Prestataire',
  'Autre'
];

export default function ControleAcces() {
  const { user } = useAuth();
  
  // Date du jour par défaut (format YYYY-MM-DD en heure locale GMT+0)
  const getTodayDateString = () => {
    const d = new Date();
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [selectedType, setSelectedType] = useState('Tous');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('presents'); // 'presents' ou 'flux'
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(30);

  // Données retournées par le backend
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingClocks, setSyncingClocks] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    total_presents_sur_site: 0,
    stats_categories: {
      Administration: 0,
      Incube: 0,
      Formation: 0,
      Visiteur: 0,
      Prestataire: 0,
      Autre: 0
    },
    presents_actuellement: [],
    historique_flux: [],
    all_presents: [],
    all_flux: []
  });

  const abortControllerRef = useRef(null);

  // Filtrage côté client instantané et garanti sans incohérence visuelle
  const displayedPresents = useMemo(() => {
    const list = (dashboardData.all_presents && dashboardData.all_presents.length > 0)
      ? dashboardData.all_presents
      : (dashboardData.presents_actuellement || []);

    return list.filter((item) => {
      if (selectedType && selectedType !== 'Tous' && item.type !== selectedType) {
        return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const n = (item.name || '').toLowerCase();
        const b = String(item.badge_id || '').toLowerCase();
        if (!n.includes(q) && !b.includes(q)) return false;
      }
      return true;
    });
  }, [dashboardData, selectedType, searchQuery]);

  const displayedFlux = useMemo(() => {
    const list = (dashboardData.all_flux && dashboardData.all_flux.length > 0)
      ? dashboardData.all_flux
      : (dashboardData.historique_flux || []);

    return list.filter((item) => {
      if (selectedType && selectedType !== 'Tous' && item.type !== selectedType) {
        return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const n = (item.name || '').toLowerCase();
        const b = String(item.badge_id || '').toLowerCase();
        if (!n.includes(q) && !b.includes(q)) return false;
      }
      return true;
    });
  }, [dashboardData, selectedType, searchQuery]);

  // Chargement des données depuis l'API
  const fetchDashboardData = useCallback(async (isSilent = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (!isSilent) {
      setRefreshing(true);
    }
    try {
      const params = {
        date: selectedDate,
        type: selectedType,
        search: searchQuery
      };

      const res = await api.get('/presence/superadmin/dashboard', { 
        params,
        timeout: 30000,
        signal: controller.signal
      });
      if (res.data && res.data.success) {
        setDashboardData(res.data);
        setLastRefreshedAt(new Date());
        setSecondsUntilRefresh(30);
      }
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED' || err.message === 'canceled') {
        return;
      }
      if (!isSilent) {
        console.error('Erreur chargement contrôle d\'accès:', err);
        toast.error(err.response?.data?.message || 'Erreur lors du chargement des pointages');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate, selectedType, searchQuery]);

  // Chargement initial et à chaque changement de filtres
  useEffect(() => {
    fetchDashboardData(false);
  }, [fetchDashboardData]);

  // Intervalle de rafraîchissement automatique toutes les 30 secondes
  useEffect(() => {
    if (!autoRefresh) return;

    const timer = setInterval(() => {
      setSecondsUntilRefresh((prev) => {
        if (prev <= 1) {
          fetchDashboardData(true);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRefresh, fetchDashboardData]);

  // Export CSV du journal des flux
  const handleExportCSV = () => {
    const list = activeTab === 'presents' ? displayedPresents : displayedFlux;
    if (!list || list.length === 0) {
      toast.error('Aucune donnée à exporter');
      return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';
    if (activeTab === 'presents') {
      csvContent += 'Date,Heure Entrée,Badge,Nom & Prénom,Catégorie,Borne IP,Statut\n';
      list.forEach((item) => {
        csvContent += `"${selectedDate}","${item.heure_entree || ''}","${item.badge_id || ''}","${item.name || ''}","${item.type || ''}","${item.device_ip || ''}","Sur site"\n`;
      });
    } else {
      csvContent += 'Date,Heure,Badge,Nom & Prénom,Catégorie,Mouvement,Borne IP\n';
      list.forEach((item) => {
        const sens = item.mouvement === 'IN' ? 'Entrée' : 'Sortie';
        csvContent += `"${item.date || selectedDate}","${item.heure || ''}","${item.badge_id || ''}","${item.name || ''}","${item.type || ''}","${sens}","${item.device_ip || ''}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const filename = `controle_acces_${activeTab}_${selectedDate}.csv`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Fichier ${filename} exporté`);
  };

  const handleSyncClocks = async () => {
    setSyncingClocks(true);
    const toastId = toast.loading('Synchronisation des horloges des 7 bornes sur GMT+0...');
    try {
      const res = await api.post('/presence/superadmin/sync-clocks');
      if (res.data?.success) {
        const { successCount, totalDevices } = res.data.data;
        toast.success(`✓ ${successCount}/${totalDevices} bornes ZKTeco synchronisées sur l'heure locale GMT+0 !`, { id: toastId });
        await fetchDashboardData(false);
      } else {
        toast.error('Erreur lors de la synchronisation des horloges', { id: toastId });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Échec de communication avec les bornes', { id: toastId });
    } finally {
      setSyncingClocks(false);
    }
  };

  const isToday = selectedDate === getTodayDateString();

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      
      {/* 1. EN-TÊTE STANDARD CONFORME À LA CHARTE GRAPHIQUE IDS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-dark-700/60">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Contrôle d'Accès & Présence en Direct
          </h1>
          <p className="text-slate-500 dark:text-dark-400 text-xs sm:text-sm mt-1">
            Supervision temps réel des 7 tourniquets physiques ZKTeco et suivi des présences sur site.
          </p>
        </div>

        {/* Contrôles d'actualisation et export */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Badge Fuseau Horaire GMT+0 */}
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-dark-700/60 text-slate-700 dark:text-dark-200 text-xs font-bold border border-slate-200 dark:border-dark-600/60" title="Plateforme synchronisée sur le fuseau horaire local GMT+0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>GMT+0 (Heure Locale)</span>
          </div>

          {/* Bouton Synchroniser Horloges Bornes (SuperAdmin) */}
          {(user?.role === 'super_admin' || user?.role === 'admin') && (
            <button
              type="button"
              onClick={handleSyncClocks}
              disabled={syncingClocks}
              className="btn btn-secondary btn-sm flex items-center gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 font-bold"
              title="Ajuster et synchroniser les horloges internes des 7 tourniquets sur l'heure exacte locale GMT+0"
            >
              <Clock size={14} className={syncingClocks ? 'animate-spin text-emerald-500' : 'text-emerald-500'} />
              <span>{syncingClocks ? 'Synchro en cours...' : 'Synchroniser Horloges'}</span>
            </button>
          )}

          {/* Toggle Auto-Refresh */}
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`btn btn-sm ${
              autoRefresh 
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20' 
                : 'btn-secondary'
            }`}
            title="Activer ou désactiver l'actualisation automatique toutes les 30 secondes"
          >
            <Radio size={14} className={autoRefresh ? 'animate-pulse text-emerald-500' : ''} />
            <span>Auto {autoRefresh ? `${secondsUntilRefresh}s` : 'OFF'}</span>
          </button>

          {/* Bouton Rafraîchir Manuel */}
          <button
            type="button"
            onClick={() => fetchDashboardData(false)}
            disabled={refreshing}
            className="btn btn-secondary btn-sm"
            title="Actualiser les pointages maintenant"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin text-primary-500' : ''} />
            <span>Actualiser</span>
          </button>

          {/* Bouton Export */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="btn btn-primary btn-sm"
            title="Télécharger les données en CSV"
          >
            <Download size={14} />
            <span>Exporter</span>
          </button>
        </div>
      </div>

      {/* 2. CARTES KPI EN TEMPS RÉEL (1 PRINCIPALE + 6 PAR CATÉGORIE) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3.5">
        
        {/* CARTE PRINCIPALE : TOTAL SUR SITE */}
        <div 
          onClick={() => setSelectedType('Tous')}
          className={`p-4 rounded-2xl bg-white dark:bg-dark-800/80 border transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md ${
            selectedType === 'Tous' 
              ? 'ring-2 ring-primary-500 shadow-primary-500/20 border-transparent dark:border-transparent' 
              : 'border-slate-200 dark:border-dark-700/60 hover:border-primary-500/60'
          }`}
          title="Afficher tous les usagers présents sur site"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="p-1.5 rounded-lg bg-primary-500/10 text-primary-600 dark:text-primary-400">
              <Building2 size={16} />
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Sur site
            </span>
          </div>

          <div className="mt-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {loading ? '—' : dashboardData.total_presents_sur_site}
            </span>
          </div>

          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-dark-700/50 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 dark:text-dark-400 text-[10px]">
              Tous usagers
            </span>
            {selectedType === 'Tous' ? (
              <span className="text-[10px] font-bold text-primary-600 dark:text-primary-400 flex items-center gap-0.5">
                Actif ✓
              </span>
            ) : (
              <span className="text-[10px] font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                Filtrer
              </span>
            )}
          </div>
        </div>

        {/* 6 CARTES PAR CATÉGORIE */}
        {Object.entries(CATEGORY_STYLES).map(([catKey, style]) => {
          const count = dashboardData.stats_categories?.[catKey] || 0;
          const isSelected = selectedType === catKey;
          const IconComponent = style.icon;

          return (
            <div
              key={catKey}
              onClick={() => setSelectedType(isSelected ? 'Tous' : catKey)}
              className={`p-4 rounded-2xl bg-white dark:bg-dark-800/80 border transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md ${
                isSelected 
                  ? style.activeRing + ' border-transparent dark:border-transparent' 
                  : 'border-slate-200 dark:border-dark-700/60 ' + style.kpiCard
              }`}
              title={`Filtrer par catégorie ${style.label}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className={`p-1.5 rounded-lg ${style.bg} ${style.text}`}>
                  <IconComponent size={16} />
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${style.bg} ${style.text}`}>
                  {style.label}
                </span>
              </div>

              <div className="mt-2">
                <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {loading ? '—' : count}
                </span>
              </div>

              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-dark-700/50 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 dark:text-dark-400 text-[10px]">
                  Présents
                </span>
                {isSelected && (
                  <span className="text-[10px] font-bold text-amber-500 flex items-center gap-0.5">
                    Actif ✓
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. BARRE DE FILTRES ET RECHERCHE */}
      <div className="card p-4 bg-white dark:bg-dark-800/90 border border-slate-200 dark:border-dark-700/70 shadow-sm rounded-2xl">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3.5">
          
          {/* A. Sélecteur de date */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:flex-initial">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Calendar size={16} />
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input pl-9 pr-3 py-2 text-xs font-semibold w-full sm:w-44 bg-slate-50 dark:bg-dark-900/80 border-slate-300 dark:border-dark-700"
              />
            </div>

            {!isToday && (
              <button
                onClick={() => setSelectedDate(getTodayDateString())}
                className="px-2.5 py-2 rounded-xl text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/40 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors shrink-0"
                title="Revenir à la date d'aujourd'hui"
              >
                Aujourd'hui
              </button>
            )}
          </div>

          {/* B. Sélecteur Pills de Catégorie */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            {CATEGORIES_LIST.map((type) => {
              const isSelected = selectedType === type;
              return (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-primary-500 text-slate-900 font-black shadow-sm'
                      : 'bg-slate-100 dark:bg-dark-700/60 text-slate-600 dark:text-dark-300 hover:bg-slate-200 dark:hover:bg-dark-700 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {type}
                </button>
              );
            })}
          </div>

          {/* C. Recherche textuelle (Nom ou Badge) */}
          <div className="relative flex-1 lg:max-w-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search size={16} />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Nom, prénom ou n° badge..."
              className="input pl-9 pr-8 py-2 text-xs bg-slate-50 dark:bg-dark-900/80 border-slate-300 dark:border-dark-700"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

        </div>
      </div>

      {/* 4. ONGLETS DE VISUALISATION */}
      <div className="flex border-b border-slate-200 dark:border-dark-700/80 gap-3">
        {/* Onglet 1 */}
        <button
          onClick={() => setActiveTab('presents')}
          className={`flex items-center gap-2.5 py-3 px-5 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'presents'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-slate-500 dark:text-dark-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Users size={18} />
          <span>Présents sur site en ce moment</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
            activeTab === 'presents'
              ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300'
              : 'bg-slate-100 text-slate-600 dark:bg-dark-700 dark:text-dark-300'
          }`}>
            {displayedPresents.length}
          </span>
        </button>

        {/* Onglet 2 */}
        <button
          onClick={() => setActiveTab('flux')}
          className={`flex items-center gap-2.5 py-3 px-5 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'flux'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-slate-500 dark:text-dark-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Clock size={18} />
          <span>Historique complet des passages</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
            activeTab === 'flux'
              ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300'
              : 'bg-slate-100 text-slate-600 dark:bg-dark-700 dark:text-dark-300'
          }`}>
            {displayedFlux.length}
          </span>
        </button>
      </div>

      {/* 5. CONTENU DES ONGLETS */}

      {/* ======================================================== */}
      {/* ONGLET 1 : PRÉSENTS SUR SITE EN CE MOMENT                */}
      {/* ======================================================== */}
      {activeTab === 'presents' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-dark-400 px-1">
            <span>
              {displayedPresents.length} usager(s) présent(s) pour la date du {selectedDate}
              {selectedType !== 'Tous' && ` (Filtre: ${selectedType})`}
              {searchQuery && ` (Recherche: "${searchQuery}")`}
            </span>
            {lastRefreshedAt && (
              <span className="text-[11px] text-slate-400">
                Dernier scan synchronisé : {lastRefreshedAt.toLocaleTimeString('fr-FR', { timeZone: 'UTC' })} (GMT+0)
              </span>
            )}
          </div>

          <div className="card p-0 overflow-hidden border border-slate-200 dark:border-dark-700/60 shadow-sm rounded-2xl bg-white dark:bg-dark-800/90">
            <div className="table-container">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-dark-900/60 border-b border-slate-200 dark:border-dark-700/60">
                    <th className="py-3.5 px-4 text-xs font-bold text-slate-500 dark:text-dark-400 uppercase tracking-wider">
                      Usager
                    </th>
                    <th className="py-3.5 px-4 text-xs font-bold text-slate-500 dark:text-dark-400 uppercase tracking-wider">
                      Catégorie
                    </th>
                    <th className="py-3.5 px-4 text-xs font-bold text-slate-500 dark:text-dark-400 uppercase tracking-wider">
                      Badge RFID
                    </th>
                    <th className="py-3.5 px-4 text-xs font-bold text-slate-500 dark:text-dark-400 uppercase tracking-wider">
                      Heure d'Entrée
                    </th>
                    <th className="py-3.5 px-4 text-xs font-bold text-slate-500 dark:text-dark-400 uppercase tracking-wider">
                      Borne IP
                    </th>
                    <th className="py-3.5 px-4 text-xs font-bold text-slate-500 dark:text-dark-400 uppercase tracking-wider text-right">
                      Statut
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-dark-700/40">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <RefreshCw size={24} className="animate-spin text-amber-500" />
                          <span className="text-xs font-medium">Chargement des présences en direct...</span>
                        </div>
                      </td>
                    </tr>
                  ) : displayedPresents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center">
                        <div className="flex flex-col items-center justify-center gap-2.5 max-w-sm mx-auto text-slate-500 dark:text-dark-400">
                          <span className="p-3 bg-slate-100 dark:bg-dark-700 rounded-full text-slate-400">
                            <DoorOpen size={28} />
                          </span>
                          <p className="text-sm font-bold text-slate-700 dark:text-dark-200">
                            Aucun usager actuellement sur site
                          </p>
                          <p className="text-xs text-slate-500 dark:text-dark-400">
                            Aucune personne de cette catégorie n'a été détectée à l'intérieur pour le {selectedDate}.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    displayedPresents.map((item) => {
                      const style = CATEGORY_STYLES[item.type] || CATEGORY_STYLES.Autre;
                      const userPhoto = item.photo_url ? getPhotoUrl(item.photo_url) : null;
                      const initials = (item.name || 'U')
                        .split(' ')
                        .map(n => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase();

                      return (
                        <tr 
                          key={item.id + '_' + item.badge_id}
                          className="hover:bg-slate-50/70 dark:hover:bg-dark-700/30 transition-colors"
                        >
                          {/* Usager : Avatar + Nom */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              {userPhoto ? (
                                <img
                                  src={userPhoto}
                                  alt={item.name}
                                  className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-dark-600 shrink-0"
                                />
                              ) : (
                                <div className={`w-10 h-10 rounded-full ${style.avatarBg} font-bold text-xs flex items-center justify-center shrink-0 shadow-sm`}>
                                  {initials}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                  {item.name}
                                </p>
                                {item.email && (
                                  <p className="text-xs text-slate-400 truncate">
                                    {item.email}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Catégorie */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${style.badge}`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              {style.label}
                            </span>
                          </td>

                          {/* Numéro de Badge */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-dark-900 text-slate-700 dark:text-dark-200 border border-slate-200 dark:border-dark-700">
                              #{item.badge_id}
                            </span>
                          </td>

                          {/* Heure d'entrée */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-dark-200 font-semibold">
                              <Clock size={14} className="text-emerald-500 shrink-0" />
                              <span>{item.heure_entree || '—'}</span>
                            </div>
                          </td>

                          {/* Borne IP */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-dark-400 font-mono">
                              <Wifi size={13} className="text-blue-400 shrink-0" />
                              <span>{item.device_ip || '10.0.1.x'}</span>
                            </div>
                          </td>

                          {/* Statut : Sur site */}
                          <td className="py-3 px-4 whitespace-nowrap text-right">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              Sur site
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ONGLET 2 : HISTORIQUE COMPLET DES PASSAGES (FLUX CHRONO) */}
      {/* ======================================================== */}
      {activeTab === 'flux' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-dark-400 px-1">
            <span>
              {displayedFlux.length} passage(s) enregistré(s) pour la date du {selectedDate}
              {selectedType !== 'Tous' && ` (Filtre: ${selectedType})`}
              {searchQuery && ` (Recherche: "${searchQuery}")`}
            </span>
            <span className="text-[11px] text-slate-400">
              Passages triés par ordre antéchronologique (dernier scan en premier)
            </span>
          </div>

          <div className="card p-0 overflow-hidden border border-slate-200 dark:border-dark-700/60 shadow-sm rounded-2xl bg-white dark:bg-dark-800/90">
            <div className="table-container">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-dark-900/60 border-b border-slate-200 dark:border-dark-700/60">
                    <th className="py-3.5 px-4 text-xs font-bold text-slate-500 dark:text-dark-400 uppercase tracking-wider">
                      Heure
                    </th>
                    <th className="py-3.5 px-4 text-xs font-bold text-slate-500 dark:text-dark-400 uppercase tracking-wider">
                      Badge
                    </th>
                    <th className="py-3.5 px-4 text-xs font-bold text-slate-500 dark:text-dark-400 uppercase tracking-wider">
                      Nom & Prénom
                    </th>
                    <th className="py-3.5 px-4 text-xs font-bold text-slate-500 dark:text-dark-400 uppercase tracking-wider">
                      Catégorie
                    </th>
                    <th className="py-3.5 px-4 text-xs font-bold text-slate-500 dark:text-dark-400 uppercase tracking-wider">
                      Mouvement
                    </th>
                    <th className="py-3.5 px-4 text-xs font-bold text-slate-500 dark:text-dark-400 uppercase tracking-wider text-right">
                      Borne IP
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-dark-700/40">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <RefreshCw size={24} className="animate-spin text-amber-500" />
                          <span className="text-xs font-medium">Chargement du journal des passages...</span>
                        </div>
                      </td>
                    </tr>
                  ) : displayedFlux.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center">
                        <div className="flex flex-col items-center justify-center gap-2.5 max-w-sm mx-auto text-slate-500 dark:text-dark-400">
                          <span className="p-3 bg-slate-100 dark:bg-dark-700 rounded-full text-slate-400">
                            <Clock size={28} />
                          </span>
                          <p className="text-sm font-bold text-slate-700 dark:text-dark-200">
                            Aucun passage enregistré
                          </p>
                          <p className="text-xs text-slate-500 dark:text-dark-400">
                            Aucun mouvement de tourniquet n'a été enregistré pour le {selectedDate} avec ces filtres.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    displayedFlux.map((scan) => {
                      const style = CATEGORY_STYLES[scan.type] || CATEGORY_STYLES.Autre;
                      const isEntry = scan.mouvement === 'IN';

                      return (
                        <tr 
                          key={scan.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-dark-700/30 transition-colors"
                        >
                          {/* Heure */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                              <Clock size={14} className="text-slate-400 shrink-0" />
                              <span>{scan.heure}</span>
                            </div>
                          </td>

                          {/* Badge */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-dark-900 text-slate-700 dark:text-dark-200 border border-slate-200 dark:border-dark-700">
                              #{scan.badge_id}
                            </span>
                          </td>

                          {/* Nom & Prénom */}
                          <td className="py-3 px-4">
                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {scan.name}
                            </p>
                          </td>

                          {/* Catégorie */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${style.badge}`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              {style.label}
                            </span>
                          </td>

                          {/* Mouvement : Entrée ou Sortie */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {isEntry ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                <ArrowDownRight size={14} className="text-emerald-500 stroke-[2.5]" />
                                <span>Entrée</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                                <ArrowUpRight size={14} className="text-rose-500 stroke-[2.5]" />
                                <span>Sortie</span>
                              </span>
                            )}
                          </td>

                          {/* Borne IP */}
                          <td className="py-3 px-4 whitespace-nowrap text-right">
                            <span className="font-mono text-xs text-slate-500 dark:text-dark-400">
                              {scan.device_ip || '10.0.1.x'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
