import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Users, 
  ChevronDown, 
  Search, 
  CheckCircle2,
  Filter,
  UserCheck,
  X
} from 'lucide-react';
import api, { getPhotoUrl } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import TabEngagement from '../components/tabs/TabEngagement';
import toast from 'react-hot-toast';

export default function Engagement() {
  const { user, isSuperAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [incubes, setIncubes] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState(searchParams.get('incubeId') || null);
  const [currentIncube, setCurrentIncube] = useState(null);
  const [loadingIncube, setLoadingIncube] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Fermer le dropdown en cliquant à l'extérieur
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 1. Charger la liste des incubés
  const loadIncubes = async () => {
    setLoadingList(true);
    try {
      const res = await api.get('/incubes');
      const list = Array.isArray(res.data) ? res.data : [];
      setIncubes(list);

      // Si aucun incubé n'est sélectionné par URL, sélectionner le premier
      const urlId = searchParams.get('incubeId');
      if (urlId && list.some(i => String(i.id) === String(urlId))) {
        setSelectedId(urlId);
      } else if (list.length > 0) {
        setSelectedId(String(list[0].id));
      }
    } catch (err) {
      toast.error('Impossible de charger les incubés');
      setIncubes([]);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadIncubes();
  }, []);

  // 2. Charger les données détaillées de l'incubé sélectionné
  const loadSelectedIncube = async (id, isBackground = false) => {
    if (!id) return;
    if (!isBackground) setLoadingIncube(true);
    try {
      const res = await api.get(`/incubes/${id}`);
      setCurrentIncube(res.data);
    } catch (err) {
      console.error("Erreur chargement données incubé:", err);
      toast.error("Impossible de charger les données de cet incubé");
      if (!isBackground) {
        setCurrentIncube(null);
      }
    } finally {
      if (!isBackground) setLoadingIncube(false);
    }
  };

  useEffect(() => {
    if (selectedId) {
      setSearchParams({ incubeId: selectedId });
      loadSelectedIncube(selectedId);
    }
  }, [selectedId]);

  const [adminsList, setAdminsList] = useState([]);
  const [selectedAdminFilter, setSelectedAdminFilter] = useState('all');

  useEffect(() => {
    if (isSuperAdmin) {
      api.get('/users/admins')
        .then(res => setAdminsList(Array.isArray(res.data) ? res.data : []))
        .catch(() => {});
    }
  }, [isSuperAdmin]);

  const handleSelectIncube = (id) => {
    setSelectedId(String(id));
    setIsDropdownOpen(false);
  };

  const getMatchingIncubes = (list, filterVal) => {
    if (!filterVal || filterVal === 'all') return list;
    if (filterVal === 'unassigned') {
      return list.filter(i => !i.admin_id && !(i.accompagnateur || '').trim());
    }
    const targetAdmin = adminsList.find(a => String(a.id) === String(filterVal));
    const adminFullName = targetAdmin ? `${targetAdmin.prenom || ''} ${targetAdmin.nom || ''}`.trim().toLowerCase() : '';
    const adminReverseName = targetAdmin ? `${targetAdmin.nom || ''} ${targetAdmin.prenom || ''}`.trim().toLowerCase() : '';
    const adminNom = targetAdmin ? (targetAdmin.nom || '').trim().toLowerCase() : '';
    const adminPrenom = targetAdmin ? (targetAdmin.prenom || '').trim().toLowerCase() : '';

    return list.filter(i => {
      if (i.admin_id && String(i.admin_id) === String(filterVal)) return true;
      const accNorm = (i.accompagnateur || '').trim().toLowerCase();
      return Boolean(accNorm) && (
        accNorm === adminFullName || 
        accNorm === adminReverseName || 
        (adminNom && accNorm.includes(adminNom)) ||
        (adminPrenom && accNorm.includes(adminPrenom))
      );
    });
  };

  const adminFilteredList = isSuperAdmin ? getMatchingIncubes(incubes, selectedAdminFilter) : incubes;

  const filteredIncubes = adminFilteredList.filter(i => 
    !searchTerm || 
    i.nom_incube?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.raison_sociale?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.pp_numero?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sélecteur d'incubé compact et élégant avec filtre Super Admin
  const renderIncubeSelector = () => (
    <div className="flex flex-wrap items-center gap-2">

    <div ref={dropdownRef} className="relative z-50 min-w-[220px] sm:min-w-[260px]">
      <button
        type="button"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="w-full flex items-center justify-between p-2 bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl hover:border-amber-500/60 dark:hover:border-amber-500/60 transition-all text-left shadow-sm"
      >
        {currentIncube ? (
          <div className="flex items-center gap-2 overflow-hidden">
            {currentIncube.photo_path ? (
              <img 
                src={getPhotoUrl(currentIncube.photo_path)} 
                alt={currentIncube.nom_incube}
                className="w-7 h-7 rounded-lg object-cover shrink-0 border border-slate-200 dark:border-dark-600 shadow-sm"
              />
            ) : (
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 text-navy-950 flex items-center justify-center font-bold text-[10px] shrink-0 shadow-sm">
                {currentIncube.nom_incube?.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
            )}
            <div className="truncate">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Incubé :</span>
                <p className="text-xs font-bold text-slate-900 dark:text-dark-100 truncate">
                  {currentIncube.nom_incube}
                </p>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-dark-400 truncate">
                {currentIncube.raison_sociale || currentIncube.pp_numero || 'Porteur de projet'}
              </p>
            </div>
          </div>
        ) : (
          <span className="text-xs text-slate-400">Sélectionner un incubé...</span>
        )}
        <div className="flex items-center gap-1 text-slate-400 shrink-0 ml-1.5">
          <Filter size={13} />
          <ChevronDown size={13} className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Menu Déroulant */}
      {isDropdownOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 sm:w-80 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-2xl shadow-2xl z-[60] overflow-hidden animate-in fade-in ring-1 ring-black/5 dark:ring-white/10">
          <div className="p-2 border-b border-slate-100 dark:border-dark-700/60">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher un incubé..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 dark:bg-dark-900 text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-dark-700 focus:outline-none focus:border-amber-500 text-slate-900 dark:text-dark-100"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto p-1 space-y-1">
            {filteredIncubes.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-400">Aucun incubé trouvé</div>
            ) : (
              filteredIncubes.map((inc) => (
                <button
                  key={inc.id}
                  onClick={() => handleSelectIncube(inc.id)}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all ${
                    String(selectedId) === String(inc.id)
                      ? 'bg-primary-500/15 dark:bg-primary-500/25 text-primary-900 dark:text-primary-200 border border-primary-500/30 font-semibold'
                      : 'hover:bg-slate-100 dark:hover:bg-dark-700/50 text-slate-700 dark:text-dark-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    {inc.photo_path ? (
                      <img 
                        src={getPhotoUrl(inc.photo_path)} 
                        alt={inc.nom_incube} 
                        className="w-7 h-7 rounded-full object-cover shrink-0" 
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-amber-500 text-navy-950 flex items-center justify-center font-bold text-[10px] shrink-0">
                        {inc.nom_incube?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                    )}
                    <div className="truncate">
                      <p className="text-xs font-bold truncate">{inc.nom_incube}</p>
                      <p className={`text-[10px] truncate ${String(selectedId) === String(inc.id) ? 'text-primary-700 dark:text-primary-400 font-medium' : 'text-slate-500 dark:text-dark-400'}`}>
                        {inc.raison_sociale || inc.pp_numero}
                      </p>
                    </div>
                  </div>
                  {String(selectedId) === String(inc.id) && (
                    <CheckCircle2 size={16} className="text-primary-600 dark:text-primary-400 shrink-0 ml-2" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  </div>
  );

  return (
    <div className="slide-up space-y-6 w-full">
      {/* Affichage du contenu d'engagement */}
      {loadingList || loadingIncube ? (
        <div className="card text-center py-24 text-slate-500 dark:text-dark-400">
          <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-3"></div>
          Chargement des données d'engagement...
        </div>
      ) : !currentIncube ? (
        <div className="card text-center py-20 space-y-4">
          <Users size={48} className="mx-auto text-slate-400" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-dark-100">Aucun incubé sélectionné</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Veuillez sélectionner un incubé pour consulter et gérer son suivi d'engagement.
          </p>
          <div className="flex justify-center pt-2">
            {renderIncubeSelector()}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <TabEngagement 
            incubeId={currentIncube.id} 
            incube={currentIncube}
            data={currentIncube.engagements || []} 
            onUpdate={() => loadSelectedIncube(currentIncube.id, true)} 
            incubeSelector={renderIncubeSelector()}
          />
        </div>
      )}
    </div>
  );
}
