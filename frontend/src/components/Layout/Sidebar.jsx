import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  Users, 
  Settings, 
  LogOut, 
  UserCircle, 
  Menu, 
  ChevronLeft,
  LayoutDashboard,
  ShieldCheck,
  BarChart3,
  CalendarCheck,
  Calendar,
  Building2,
  FileText,
  GraduationCap,
  Sun,
  Moon,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getPhotoUrl } from '../../api/axios';

export default function Sidebar({ 
  isMobileOpen = false, 
  onMobileClose = () => {}, 
  isExpanded = true, 
  onToggleExpand = () => {} 
}) {
  const { user, isSuperAdmin, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef(null);

  // Close settings popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setIsSettingsOpen(false);
    logout();
    navigate('/login');
  };

  const handleProfileClick = () => {
    setIsSettingsOpen(false);
    onMobileClose();
    navigate('/profil');
  };

  const cleanPrenom = (user?.prenom || '').replace(/\bcgs\b/gi, '').trim();
  const cleanNom = (user?.nom || '').replace(/\bcgs\b/gi, '').trim();
  const userName = (cleanPrenom || cleanNom) 
    ? `${cleanPrenom} ${cleanNom}`.trim() 
    : (user ? (isSuperAdmin ? 'Administrateur' : 'Utilisateur') : 'Utilisateur');
  const isIncube = user?.role === 'incube';
  const userRole = isSuperAdmin ? 'Super Admin' : isIncube ? 'Porteur de Projet' : 'Accompagnateur';
  const userPhoto = user?.photo_url ? getPhotoUrl(user.photo_url) : null;
  const userInitials = (cleanPrenom?.[0] || '') + (cleanNom?.[0] || (!cleanPrenom ? (isSuperAdmin ? 'A' : 'U') : ''));

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" 
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar Container */}
      <nav 
        id="mobile-navigation-drawer"
        aria-label="Navigation principale"
        className={`fixed top-0 bottom-0 left-0 z-40 bg-[#02162B] border-r border-[#0A2744] flex flex-col transition-all duration-300 ease-in-out print:hidden ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${isExpanded ? 'w-72' : 'w-20'}`}
      >
        {/* 1. BRAND / LOGO HEADER */}
        <div className={`h-16 flex items-center ${isExpanded ? 'justify-between px-4' : 'justify-center'} border-b border-[#0A2744] shrink-0`}>
          
          {/* Logo (Visible uniquement si étendu) */}
          {isExpanded && (
            <div className="flex items-center gap-3 overflow-hidden cursor-pointer" onClick={() => navigate('/')}>
              <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shadow-md shrink-0">
                <img src="/logo-ids.png" alt="IDS Logo" className="w-full h-full object-cover rounded-xl" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-white font-black text-base tracking-tight truncate leading-tight">
                  IDS Incubateur
                </span>
                <span className="text-[10px] text-amber-400 font-semibold tracking-wide uppercase truncate">
                  Digital Solidaire
                </span>
              </div>
            </div>
          )}

          {/* Bouton Toggle Largeur sur Desktop */}
          <button 
            onClick={onToggleExpand} 
            className={`hidden lg:flex p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#0A2744] transition-colors ${!isExpanded ? 'mx-auto' : ''}`}
            title={isExpanded ? 'Réduire la barre latérale' : 'Agrandir la barre latérale'}
          >
            {isExpanded ? <ChevronLeft size={20} /> : <Menu size={20} />}
          </button>

          {/* Bouton fermeture sur Mobile */}
          <button 
            onClick={onMobileClose} 
            className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#0A2744] transition-colors ml-auto"
          >
            <X size={20} />
          </button>
        </div>

        {/* 2. NAVIGATION */}
        <div className="flex-1 mt-4 px-3 space-y-1.5 overflow-y-auto">
          {isSuperAdmin && (
            <NavLink 
              to="/dashboard" 
              onClick={onMobileClose}
              title={!isExpanded ? 'Tableau de Bord' : undefined}
              className={({ isActive }) => 
                `flex items-center px-3 py-3 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? 'bg-[#0A2744] text-amber-400 font-semibold shadow-inner' 
                    : 'text-gray-300 hover:text-white hover:bg-[#0A2744]/70'
                } ${!isExpanded ? 'justify-center' : ''}`
              }
            >
              <LayoutDashboard size={20} className="shrink-0" />
              {isExpanded && <span className="ml-3 font-medium text-sm truncate">Tableau de Bord</span>}
            </NavLink>
          )}

          {isIncube ? (
            <NavLink 
              to={user.pp_id ? `/incube/${user.pp_id}` : '/profil'} 
              onClick={onMobileClose}
              title={!isExpanded ? 'Mon Dossier Projet' : undefined}
              className={({ isActive }) => 
                `flex items-center px-3 py-3 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? 'bg-[#0A2744] text-amber-400 font-semibold shadow-inner' 
                    : 'text-gray-300 hover:text-white hover:bg-[#0A2744]/70'
                } ${!isExpanded ? 'justify-center' : ''}`
              }
            >
              <Users size={20} className="shrink-0 text-amber-400" />
              {isExpanded && (
                <span className="ml-3 font-medium text-sm truncate">
                  Mon Dossier Projet
                </span>
              )}
            </NavLink>
          ) : (
            <NavLink 
              to="/incubes" 
              onClick={onMobileClose}
              title={!isExpanded ? 'Annuaire des Incubés' : undefined}
              className={({ isActive }) => 
                `flex items-center px-3 py-3 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? 'bg-[#0A2744] text-amber-400 font-semibold shadow-inner' 
                    : 'text-gray-300 hover:text-white hover:bg-[#0A2744]/70'
                } ${!isExpanded ? 'justify-center' : ''}`
              }
            >
              <Users size={20} className="shrink-0" />
              {isExpanded && (
                <span className="ml-3 font-medium text-sm truncate">
                  Annuaire des Incubés
                </span>
              )}
            </NavLink>
          )}

          <NavLink 
            to="/booking" 
            onClick={onMobileClose}
            title={!isExpanded ? 'Calendrier & Rendez-vous' : undefined}
            className={({ isActive }) => 
              `flex items-center px-3 py-3 rounded-xl transition-all duration-200 ${
                isActive 
                  ? 'bg-[#0A2744] text-amber-400 font-semibold shadow-inner' 
                  : 'text-gray-300 hover:text-white hover:bg-[#0A2744]/70'
              } ${!isExpanded ? 'justify-center' : ''}`
            }
          >
            <Calendar size={20} className="shrink-0 text-amber-400" />
            {isExpanded && <span className="ml-3 font-medium text-sm truncate">{isIncube ? 'Mes Rendez-vous' : 'Calendrier'}</span>}
          </NavLink>

          {!isIncube && (
            <NavLink 
              to="/engagement" 
              onClick={onMobileClose}
              title={!isExpanded ? 'Engagement & Implication' : undefined}
              className={({ isActive }) => 
                `flex items-center px-3 py-3 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? 'bg-[#0A2744] text-amber-400 font-semibold shadow-inner' 
                    : 'text-gray-300 hover:text-white hover:bg-[#0A2744]/70'
                } ${!isExpanded ? 'justify-center' : ''}`
              }
            >
              <BarChart3 size={20} className="shrink-0" />
              {isExpanded && <span className="ml-3 font-medium text-sm truncate">Engagement & Implication</span>}
            </NavLink>
          )}

          {isSuperAdmin && (
            <NavLink 
              to="/rapports" 
              onClick={onMobileClose}
              title={!isExpanded ? 'Rapports d\'Activité' : undefined}
              className={({ isActive }) => 
                `flex items-center px-3 py-3 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? 'bg-[#0A2744] text-amber-400 font-semibold shadow-inner' 
                    : 'text-gray-300 hover:text-white hover:bg-[#0A2744]/70'
                } ${!isExpanded ? 'justify-center' : ''}`
              }
            >
              <FileText size={20} className="shrink-0 text-amber-400" />
              {isExpanded && <span className="ml-3 font-medium text-sm truncate">Rapports d'Activité</span>}
            </NavLink>
          )}

          <NavLink 
            to="/formations" 
            onClick={onMobileClose}
            title={!isExpanded ? 'Formations' : undefined}
            className={({ isActive }) => 
              `flex items-center px-3 py-3 rounded-xl transition-all duration-200 ${
                isActive 
                  ? 'bg-[#0A2744] text-amber-400 font-semibold shadow-inner' 
                  : 'text-gray-300 hover:text-white hover:bg-[#0A2744]/70'
              } ${!isExpanded ? 'justify-center' : ''}`
            }
          >
            <GraduationCap size={20} className="shrink-0 text-amber-400" />
            {isExpanded && <span className="ml-3 font-medium text-sm truncate">Formations</span>}
          </NavLink>

          <NavLink 
            to="/evenements" 
            onClick={onMobileClose}
            title={!isExpanded ? 'Événements & Ateliers' : undefined}
            className={({ isActive }) => 
              `flex items-center px-3 py-3 rounded-xl transition-all duration-200 ${
                isActive 
                  ? 'bg-[#0A2744] text-amber-400 font-semibold shadow-inner' 
                  : 'text-gray-300 hover:text-white hover:bg-[#0A2744]/70'
              } ${!isExpanded ? 'justify-center' : ''}`
            }
          >
            <CalendarCheck size={20} className="shrink-0" />
            {isExpanded && <span className="ml-3 font-medium text-sm truncate">Événements</span>}
          </NavLink>

          <NavLink 
            to="/espaces" 
            onClick={onMobileClose}
            title={!isExpanded ? 'Réservation Espaces' : undefined}
            className={({ isActive }) => 
              `flex items-center px-3 py-3 rounded-xl transition-all duration-200 ${
                isActive 
                  ? 'bg-[#0A2744] text-amber-400 font-semibold shadow-inner' 
                  : 'text-gray-300 hover:text-white hover:bg-[#0A2744]/70'
              } ${!isExpanded ? 'justify-center' : ''}`
            }
          >
            <Building2 size={20} className="shrink-0 text-amber-400" />
            {isExpanded && <span className="ml-3 font-medium text-sm truncate">Réservation Espaces</span>}
          </NavLink>

          {isSuperAdmin && (
            <NavLink 
              to="/utilisateurs" 
              onClick={onMobileClose}
              title={!isExpanded ? 'Gestion des Utilisateurs' : undefined}
              className={({ isActive }) => 
                `flex items-center px-3 py-3 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? 'bg-[#0A2744] text-amber-400 font-semibold shadow-inner' 
                    : 'text-gray-300 hover:text-white hover:bg-[#0A2744]/70'
                } ${!isExpanded ? 'justify-center' : ''}`
              }
            >
              <ShieldCheck size={20} className="shrink-0" />
              {isExpanded && <span className="ml-3 font-medium text-sm truncate">Gestion des Utilisateurs</span>}
            </NavLink>
          )}
        </div>

        {/* 3. ZONE PROFIL (Repoussée en bas avec mt-auto) */}
        <div className="mt-auto p-3 relative border-t border-[#0A2744]" ref={settingsRef}>
          
          {/* POPUP PARAMÈTRES (Mon Profil & Déconnexion) */}
          {isSettingsOpen && (
            <div 
              className={`absolute bottom-[75px] ${
                isExpanded ? 'right-3 w-52' : 'left-3 w-52'
              } bg-[#0A2744] border border-[#14395E] rounded-xl shadow-2xl py-1.5 z-50 overflow-hidden animate-in fade-in duration-150`}
            >
              <button 
                onClick={handleProfileClick}
                className="w-full flex items-center px-4 py-2.5 text-sm text-gray-200 hover:bg-[#14395E] hover:text-white transition-colors"
              >
                <UserCircle size={16} className="mr-3 text-amber-400 shrink-0" />
                Mon Profil
              </button>

              <button 
                onClick={toggleTheme}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-200 hover:bg-[#14395E] hover:text-white transition-colors"
                title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
              >
                <div className="flex items-center">
                  {theme === 'dark' ? (
                    <Sun size={16} className="mr-3 text-amber-400 shrink-0" />
                  ) : (
                    <Moon size={16} className="mr-3 text-blue-300 shrink-0" />
                  )}
                  <span>{theme === 'dark' ? 'Mode Clair' : 'Mode Sombre'}</span>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#14395E] text-amber-400">
                  {theme === 'dark' ? 'Sombre' : 'Clair'}
                </span>
              </button>

              <div className="h-px bg-[#14395E] my-1 mx-2"></div>
              <button 
                onClick={handleLogout}
                className="w-full flex items-center px-4 py-2.5 text-sm text-red-400 hover:bg-[#14395E] hover:text-red-300 transition-colors"
              >
                <LogOut size={16} className="mr-3 shrink-0" />
                Se déconnecter
              </button>
            </div>
          )}

          {/* CARTE UTILISATEUR EN BAS */}
          <div 
            className={`flex items-center justify-between p-2 rounded-xl bg-[#08223F] ${
              !isExpanded ? 'justify-center bg-transparent p-1' : ''
            }`}
          >
            <div 
              className="flex items-center overflow-hidden cursor-pointer"
              onClick={() => {
                if (!isExpanded) {
                  setIsSettingsOpen(!isSettingsOpen);
                } else {
                  handleProfileClick();
                }
              }}
              title={!isExpanded ? `${userName} - ${userRole}` : 'Voir mon profil'}
            >
              {userPhoto ? (
                <img 
                  src={userPhoto} 
                  alt={userName} 
                  className="w-9 h-9 rounded-full object-cover shrink-0 border border-[#14395E]" 
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center text-navy-950 font-bold text-sm shrink-0">
                  {userInitials || 'AD'}
                </div>
              )}
              
              {isExpanded && (
                <div className="ml-3 truncate">
                  <p className="text-sm font-semibold text-white truncate">{userName}</p>
                  <p className="text-xs text-blue-300 truncate">{userRole}</p>
                </div>
              )}
            </div>

            {/* Bouton Paramètres (Visible uniquement si la sidebar est ouverte) */}
            {isExpanded && (
              <button 
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className={`p-1.5 rounded-lg text-blue-300 hover:text-white hover:bg-[#14395E] transition-colors ml-1 ${
                  isSettingsOpen ? 'bg-[#14395E] text-white' : ''
                }`}
                title="Paramètres du compte"
              >
                <Settings size={18} />
              </button>
            )}
          </div>

        </div>
      </nav>
    </>
  );
}
