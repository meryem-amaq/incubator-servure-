import React, { useState, useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Menu } from 'lucide-react';

export default function Layout() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const menuButtonRef = useRef(null);

  // Gérer le verrouillage du scroll (body) et le retour du focus
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      // Retourner le focus au bouton hamburger lorsqu'on le ferme
      if (menuButtonRef.current) {
        menuButtonRef.current.focus();
      }
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

  // Gérer la fermeture avec la touche Echap
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isMobileOpen) {
        setIsMobileOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-dark-950 text-slate-900 dark:text-white transition-colors duration-200 flex flex-col">
      {/* En-tête mobile */}
      <div className="lg:hidden print:hidden flex items-center justify-between bg-[#02162B] border-b border-[#0A2744] p-3 shadow-md sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button 
            ref={menuButtonRef}
            onClick={() => setIsMobileOpen(true)}
            aria-expanded={isMobileOpen}
            aria-controls="mobile-navigation-drawer"
            aria-label="Ouvrir le menu de navigation"
            className="flex flex-col justify-center items-center gap-[5px] p-2 w-10 h-10 text-gray-300 hover:text-white hover:bg-[#0A2744] rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
          >
            <span className="w-5 h-[2px] bg-current rounded-full transition-transform"></span>
            <span className="w-5 h-[2px] bg-current rounded-full transition-opacity"></span>
            <span className="w-5 h-[2px] bg-current rounded-full transition-transform"></span>
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl overflow-hidden flex items-center justify-center shadow-sm shrink-0">
              <img src="/logo-ids.png" alt="IDS Logo" className="w-full h-full object-cover rounded-xl" />
            </div>
            <h1 className="text-xs font-black text-white tracking-tight">IDS Incubateur</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <img 
            src="/logo-ctpes-dark.png" 
            alt="Centre Des Très Petites Entreprises Solidaires" 
            className="h-8 max-w-[150px] object-contain rounded-md p-0.5"
            title="Centre Des Très Petites Entreprises Solidaires"
          />
        </div>
      </div>

      {/* Sidebar Rétractable */}
      <Sidebar 
        isMobileOpen={isMobileOpen} 
        onMobileClose={() => setIsMobileOpen(false)}
        isExpanded={isExpanded}
        onToggleExpand={() => setIsExpanded(!isExpanded)}
      />
      
      {/* Contenu Principal avec marge dynamique selon la largeur de la sidebar */}
      <main 
        className={`flex-1 min-h-screen flex flex-col bg-slate-50 dark:bg-dark-950 transition-all duration-300 ease-in-out ${
          isExpanded ? 'lg:ml-72' : 'lg:ml-20'
        }`}
      >
        {/* Desktop Header - Logo institutionnel partenaire agrandi dans un header h-16 fixe */}
        <header className="hidden lg:flex print:hidden items-center justify-between gap-4 h-16 px-6 border-b border-slate-200/80 dark:border-dark-800 bg-white/80 dark:bg-dark-950/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-dark-400">
              Incubateur Digital Solidaire
            </span>
          </div>

          <div className="flex items-center">
            <div className="bg-white dark:bg-dark-900/80 px-3 py-1 rounded-xl border border-slate-200/80 dark:border-dark-700/80 shadow-xs flex items-center justify-center transition-all hover:shadow-sm">
              <img 
                src="/logo-ctpes.png" 
                alt="Centre Des Très Petites Entreprises Solidaires" 
                className="h-11 md:h-12 max-h-[50px] w-auto object-contain dark:hidden"
                title="Centre Des Très Petites Entreprises Solidaires - Fondation Mohammed V pour la Solidarité"
              />
              <img 
                src="/logo-ctpes-dark.png" 
                alt="Centre Des Très Petites Entreprises Solidaires" 
                className="h-11 md:h-12 max-h-[50px] w-auto object-contain hidden dark:block"
                title="Centre Des Très Petites Entreprises Solidaires - Fondation Mohammed V pour la Solidarité"
              />
            </div>
          </div>
        </header>

        {/* Zone de contenu de la page */}
        <div className="p-4 md:p-6 flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
