import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  DollarSign,
  Briefcase,
  TrendingUp,
  Award,
  ArrowRight,
  PlusCircle,
  UserPlus,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Building2,
  Wrench,
  AlertTriangle,
  Clock,
  Sparkles,
  BarChart3,
  CheckCircle,
  ExternalLink,
  Download,
  CalendarCheck,
  CalendarPlus,
  MapPin,
  User
} from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { KpiEconomique, KpiDemographie, KpiAssiduite, KpiMaterielChart } from '../components/common/KpiCharts';
import DashboardPdfStage from '../components/common/DashboardPdfStage';

const PHASE_COLORS = {
  Idéation: { badge: 'badge-navy', bar: 'bg-navy-500' },
  Lancement: { badge: 'badge-blue', bar: 'bg-blue-500' },
  Croissance: { badge: 'badge-green', bar: 'bg-emerald-500' },
  Maturité: { badge: 'badge-orange', bar: 'bg-amber-500' },
};

export default function Dashboard() {
  const { user, isSuperAdmin } = useAuth();
  const navigate = useNavigate();

  // Redirection automatique des accompagnateurs/admins non Super Admin vers /incubes
  useEffect(() => {
    if (!isSuperAdmin) {
      navigate('/incubes', { replace: true });
    }
  }, [isSuperAdmin, navigate]);

  // Onglet actif : 'economique' ou 'impact'
  const [activeTab, setActiveTab] = useState('economique');

  // Filtre par promotion (pour Super Admin / Admin)
  const [selectedPromotion, setSelectedPromotion] = useState('all');
  const [promotionsList, setPromotionsList] = useState([]);

  // Stats économiques (dossiers incubés)
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Stats d'assiduité & impact des espaces
  const [impactStats, setImpactStats] = useState(null);
  const [loadingImpact, setLoadingImpact] = useState(false);



  const [exportingPdf, setExportingPdf] = useState(false);
  const dashboardRef = useRef(null);

  const handleExportPdf = useCallback(async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    const toastId = toast.loading('Préparation du rapport PDF officiel (2 pages)...');

    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      // Attendre 450ms que React affiche DashboardPdfStage et que Chart.js peigne les canvas
      await new Promise((r) => setTimeout(r, 450));

      const p1 = document.getElementById('pdf-stage-page-1');
      const p2 = document.getElementById('pdf-stage-page-2');

      if (!p1 || !p2) {
        toast.error("Impossible de préparer les sections du tableau de bord.", { id: toastId });
        return;
      }

      // Capture Page 1 (1240px x 780px)
      const canvas1 = await html2canvas(p1, {
        scale: 2,
        width: 1240,
        height: 780,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
      });

      // Capture Page 2 (1240px x 780px)
      const canvas2 = await html2canvas(p2, {
        scale: 2,
        width: 1240,
        height: 780,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
      });

      // Format Paysage A4 (297mm x 210mm)
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const pageWidth = 297;
      const pageHeight = 210;
      const marginX = 8;
      const contentWidth = pageWidth - (marginX * 2); // 281mm
      const contentStartY = 18; // Sous l'en-tête vectoriel (y = 16.5mm)
      const contentHeight = (780 * contentWidth) / 1240; // 176.7mm

      const promoLabel = selectedPromotion === 'all' ? 'Toutes les promotions' : selectedPromotion;
      const dateStr = `Édité le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

      const renderHeaderFooter = (pageNum) => {
        // Fond blanc
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pageWidth, pageHeight, 'F');

        // Header bandeau
        pdf.setFillColor(248, 250, 252);
        pdf.rect(0, 0, pageWidth, 16.5, 'F');

        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(0.35);
        pdf.line(marginX, 16.5, pageWidth - marginX, 16.5);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(15, 23, 42);
        pdf.text("Tableau de Bord Exécutif & Indicateurs d'Impact — IDS", marginX, 8.5);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        pdf.setTextColor(100, 116, 139);
        const pageSubtitle = activeTab === 'economique'
          ? (pageNum === 1
            ? `Page 1 sur 2 : Indicateurs Clés & Analyse Financière Globale  •  Promotion : ${promoLabel}`
            : `Page 2 sur 2 : Performance des Projets & Démographie  •  Promotion : ${promoLabel}`)
          : (pageNum === 1
            ? `Page 1 sur 2 : Assiduité & Participation aux Ateliers  •  Promotion : ${promoLabel}`
            : `Page 2 sur 2 : Occupation des Espaces & Santé du Matériel  •  Promotion : ${promoLabel}`);
        pdf.text(pageSubtitle, marginX, 13.5);

        pdf.text(dateStr, pageWidth - marginX - pdf.getTextWidth(dateStr), 13.5);

        // Footer
        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(0.3);
        pdf.line(marginX, pageHeight - 9, pageWidth - marginX, pageHeight - 9);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        pdf.setTextColor(100, 116, 139);
        pdf.text('Incubateur CGS — Programme Digital Solidaire (IDS) • Document Officiel Confidentiel', marginX, pageHeight - 4);

        const pageLabel = `Page ${pageNum} sur 2`;
        pdf.text(pageLabel, pageWidth - marginX - pdf.getTextWidth(pageLabel), pageHeight - 4);
      };

      // ==========================================
      // PAGE 1 : Indicateurs Clés + Analyse Financière
      // ==========================================
      renderHeaderFooter(1);
      pdf.addImage(canvas1.toDataURL('image/png'), 'PNG', marginX, contentStartY, contentWidth, contentHeight);

      // ==========================================
      // PAGE 2 : Performance & Démographie
      // ==========================================
      pdf.addPage('landscape', 'a4');
      renderHeaderFooter(2);
      pdf.addImage(canvas2.toDataURL('image/png'), 'PNG', marginX, contentStartY, contentWidth, contentHeight);

      const cleanFileName = `dashboard-ids-${activeTab}-${selectedPromotion !== 'all' ? selectedPromotion.toLowerCase().replace(/\s+/g, '-') : 'global'}.pdf`;
      pdf.save(cleanFileName);
      toast.success('Rapport PDF officiel (2 pages) généré avec succès !', { id: toastId });
    } catch (err) {
      console.error('Erreur export PDF:', err);
      toast.error('Erreur lors de la génération du PDF', { id: toastId });
    } finally {
      setExportingPdf(false);
    }
  }, [exportingPdf, activeTab, selectedPromotion]);

  // Charger la liste des promotions enregistrées
  const loadPromotions = async () => {
    try {
      const res = await api.get('/promotions');
      const list = Array.isArray(res.data) ? res.data : (res.data?.promotions || []);
      setPromotionsList(list);
    } catch (err) {
      console.warn('Erreur chargement promotions:', err);
    }
  };

  useEffect(() => {
    loadPromotions();
  }, []);

  // Options combinées de promotions disponibles
  const allPromoOptions = useMemo(() => {
    const list = new Set();
    // Depuis la table promotions
    (promotionsList || []).forEach(p => {
      const name = typeof p === 'string' ? p : p?.nom;
      if (name && name.trim()) list.add(name.trim());
    });
    // Depuis les données déjà présentes en BDD
    (stats?.promotionsDisponibles || []).forEach(p => {
      if (p && p.trim()) list.add(p.trim());
    });
    return Array.from(list).sort();
  }, [promotionsList, stats?.promotionsDisponibles]);

  // Charger les stats économiques selon le filtre promotion
  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const params = {};
        if (selectedPromotion && selectedPromotion !== 'all') {
          params.promotion = selectedPromotion;
        }
        const res = await api.get('/incubes/stats', { params });
        setStats(res.data);
      } catch (err) {
        console.error('Erreur stats dashboard:', err);
        toast.error('Impossible de charger les statistiques du tableau de bord');
        setStats({
          total: 0,
          caTotal: 0,
          totalEmplois: 0,
          phases: [],
          recentIncubes: [],
          promotionsDisponibles: []
        });
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [selectedPromotion]);

  // Charger les stats d'assiduité & impact dès l'affichage ou changement de promotion
  useEffect(() => {
    if (activeTab === 'impact') {
      setLoadingImpact(true);
      const params = {};
      if (selectedPromotion && selectedPromotion !== 'all') {
        params.promotion = selectedPromotion;
      }
      api.get('/impact/stats', { params })
        .then(res => setImpactStats(res.data))
        .catch(() => toast.error("Impossible de charger les statistiques d'impact"))
        .finally(() => setLoadingImpact(false));
    }
  }, [activeTab, selectedPromotion]);


  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-500" />
      </div>
    );
  }

  const total = stats?.total || 0;
  const caTotal = stats?.caTotal || 0;
  const totalEmplois = stats?.totalEmplois || 0;
  const phases = stats?.phases || [];
  const recentIncubes = stats?.recentIncubes || [];

  const formatDH = (amount) => {
    return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12" ref={dashboardRef}>
      {/* Header avec Titre, Filtre Promotion & Sélecteur d'onglets (masqué dans la capture PDF pour laisser place à l'en-tête officiel) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-dark-700/60" data-html2canvas-ignore="true">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Tableau de Bord & Impact
          </h1>
          <p className="text-slate-500 dark:text-dark-400 text-xs sm:text-sm mt-1">
            Indicateurs de performance économique, assiduité aux ateliers et utilisation des espaces.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Filtre Promotion */}
          <div className="relative">
            <select
              value={selectedPromotion}
              onChange={(e) => setSelectedPromotion(e.target.value)}
              className="appearance-none bg-slate-50 dark:bg-dark-800 text-slate-900 dark:text-white text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 dark:border-dark-700 px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary-500/50 cursor-pointer shadow-sm transition-all"
            >
              <option value="all">Toutes les promotions</option>
              {allPromoOptions.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-dark-400">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>

          {/* Bouton de téléchargement PDF en JAUNE */}
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exportingPdf}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-amber-400 text-amber-950 hover:bg-amber-500 shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={14} />
            {exportingPdf ? 'Génération...' : 'Télécharger en PDF'}
          </button>

          {/* Boutons de bascule d'onglets */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-dark-800/80 p-1 rounded-2xl border border-slate-200 dark:border-dark-700">
            <button
              type="button"
              onClick={() => setActiveTab('economique')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'economique'
                ? 'bg-white dark:bg-dark-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:text-dark-300'
                }`}
            >
              <TrendingUp size={14} className="text-primary-600" />
              <span>Impact Économique</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('impact')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'impact'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:text-dark-300'
                }`}
            >
              <Award size={14} className={activeTab === 'impact' ? 'text-white' : 'text-emerald-500'} />
              <span>Assiduité & Espaces</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bannière récapitulative si un filtre promotion est actif */}
      {selectedPromotion !== 'all' && (
        <div className="flex items-center justify-between bg-primary-50/80 dark:bg-primary-950/30 border border-primary-200 dark:border-primary-800/50 px-4 py-2.5 rounded-2xl text-xs font-medium text-primary-900 dark:text-primary-200 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-primary-500 animate-ping" />
            <span>
              Indicateurs et graphiques filtrés pour : <strong className="font-black text-primary-700 dark:text-primary-300">{selectedPromotion}</strong> ({total} incubé{total > 1 ? 's' : ''})
            </span>
          </div>
          <button
            type="button"
            data-html2canvas-ignore="true"
            onClick={() => setSelectedPromotion('all')}
            className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline cursor-pointer"
          >
            Réinitialiser (Toutes les promotions)
          </button>
        </div>
      )}

      {/* =========================================================================
         VUE 1 : IMPACT ÉCONOMIQUE & PROJETS
         ========================================================================= */}
      {activeTab === 'economique' && (
        <div className="space-y-6 slide-up">
          {/* KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Incubés */}
            <div className="card p-5 hover:border-primary-500/40 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-dark-400 uppercase tracking-wider">Total Incubés</span>
                <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-500/20 flex items-center justify-center">
                  <Users size={20} />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{total}</div>
                <p className="text-xs text-slate-500 dark:text-dark-400 mt-1 flex items-center gap-1">
                  <CheckCircle2 size={13} className="text-emerald-500 dark:text-emerald-400" /> Dossiers enregistrés
                </p>
              </div>
            </div>

            {/* Card 2: CA Cumulé */}
            <div className="card p-5 hover:border-emerald-500/40 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-dark-400 uppercase tracking-wider">CA Cumulé</span>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center">
                  <DollarSign size={20} />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-2xl md:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
                  {formatDH(caTotal)}
                </div>
                <p className="text-xs text-slate-500 dark:text-dark-400 mt-1 flex items-center gap-1">
                  <TrendingUp size={13} className="text-emerald-500 dark:text-emerald-400" /> T1 à T4 consolidés
                </p>
              </div>
            </div>

            {/* Card 3: Emplois Créés */}
            <div className="card p-5 hover:border-navy-500/40 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-dark-400 uppercase tracking-wider">Emplois Créés</span>
                <div className="w-10 h-10 rounded-xl bg-navy-50 dark:bg-navy-500/10 text-navy-600 dark:text-navy-400 border border-navy-200 dark:border-navy-500/20 flex items-center justify-center">
                  <Briefcase size={20} />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{totalEmplois}</div>
                <p className="text-xs text-slate-500 dark:text-dark-400 mt-1">
                  Personnel recruté (CDI, CDD)
                </p>
              </div>
            </div>

            {/* Card 4: Taux d'Accompagnement */}
            <div className="card p-5 hover:border-amber-500/40 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-dark-400 uppercase tracking-wider">Taux d'Activité</span>
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center">
                  <Award size={20} />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {total > 0 ? '100%' : '0%'}
                </div>
                <p className="text-xs text-slate-500 dark:text-dark-400 mt-1">
                  Suivi actif des projets
                </p>
              </div>
            </div>
          </div>


          {/* Graphiques Économiques & Financiers */}
          <KpiEconomique stats={stats} />

          {/* Démographie */}
          <KpiDemographie stats={stats} />
        </div>
      )}

      {/* =========================================================================
         VUE 2 : ASSIDUITÉ AUX ATELIERS & UTILISATION DES ESPACES (NOUVEAU)
         ========================================================================= */}
      {activeTab === 'impact' && (
        <div className="space-y-6 slide-up">
          {loadingImpact && !impactStats ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500" />
            </div>
          ) : (
            <>
              {/* BLOC PAGE 1 : KPIs Clés d'Impact + Assiduité */}
              <div id="dashboard-pdf-page-1" className="space-y-6 bg-transparent">
                {/* 4 KPIs Clés d'Impact */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* KPI 1 : Assiduité Globale */}
                  <div className="card p-5 border border-emerald-200 dark:border-emerald-800/40 bg-gradient-to-br from-emerald-50/40 to-teal-50/20 dark:from-emerald-950/20 dark:to-dark-900">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                        Assiduité Globale
                      </span>
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <Award size={20} />
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="text-3xl font-black text-emerald-700 dark:text-emerald-300 tracking-tight">
                        {impactStats?.assiduite?.globalAssiduiteRate || 0}%
                      </div>
                      <p className="text-xs text-slate-500 dark:text-dark-400 mt-1 flex items-center gap-1 font-medium">
                        <CheckCircle2 size={13} className="text-emerald-500" />
                        {impactStats?.assiduite?.totalPresences || 0} signatures certifiées en BDD
                      </p>
                    </div>
                  </div>

                  {/* KPI 2 : Réservations d'Espaces */}
                  <div className="card p-5 border border-sky-200 dark:border-sky-800/40 bg-gradient-to-br from-sky-50/40 to-blue-50/20 dark:from-sky-950/20 dark:to-dark-900">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-sky-800 dark:text-sky-300 uppercase tracking-wider">
                        Réservations Espaces
                      </span>
                      <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                        <Building2 size={20} />
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="text-3xl font-black text-sky-700 dark:text-sky-300 tracking-tight">
                        {impactStats?.espaces?.totalReservations || 0}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-dark-400 mt-1 font-medium">
                        {impactStats?.espaces?.parStatut?.valide || 0} validée(s) • {impactStats?.espaces?.parStatut?.en_attente || 0} en attente
                      </p>
                    </div>
                  </div>

                  {/* KPI 3 : État du Matériel (4 Critères) */}
                  <div className="card p-5 border border-emerald-200 dark:border-emerald-800/40 bg-gradient-to-br from-emerald-50/40 to-teal-50/20 dark:from-emerald-950/20 dark:to-dark-900">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Wrench size={15} className="text-emerald-600 dark:text-emerald-400" />
                        État du Matériel
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                        {impactStats?.equipements?.santeMaterielPct ?? 100}% dispo
                      </span>
                    </div>
                    <div className="mt-3">
                      <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                        {impactStats?.equipements?.totalEquipements || 0} <span className="text-xs font-bold text-slate-400">machine(s)</span>
                      </div>
                      {/* Les 4 critères d'état affichés directement */}
                      <div className="grid grid-cols-2 gap-1.5 mt-2.5 pt-2 border-t border-slate-200/60 dark:border-dark-700/60">
                        <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                          <span>{impactStats?.equipements?.operationnels || 0} Prêts</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                          <span>{impactStats?.equipements?.usure || 0} Usure</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] font-bold text-orange-700 dark:text-orange-400">
                          <span>{impactStats?.equipements?.maintenance || 0} Maint.</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] font-bold text-red-700 dark:text-red-400">
                          <span>{impactStats?.equipements?.neMarchePlus || 0} HS</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* KPI 4 : Incidents Matériels */}
                  <div className="card p-5 border border-slate-200 dark:border-dark-700">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500 dark:text-dark-400 uppercase tracking-wider">
                        Incidents Matériels
                      </span>
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                        <ShieldCheck size={20} />
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                        {impactStats?.equipements?.incidentsResolus || 0} <span className="text-xs font-bold text-slate-400">/ {impactStats?.equipements?.totalIncidents || 0} résolue(s)</span>
                      </div>
                      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100 dark:border-dark-800 text-[11px] font-medium">
                        <span className="text-slate-500 dark:text-dark-400">Pannes en cours :</span>
                        <span className={`font-bold px-2 py-0.5 rounded-full ${((impactStats?.equipements?.incidentsEnCours || 0) + (impactStats?.equipements?.neMarchePlus || 0)) > 0
                          ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                          : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          }`}>
                          {(impactStats?.equipements?.incidentsEnCours || 0) + (impactStats?.equipements?.neMarchePlus || 0)} active(s)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <KpiAssiduite impactStats={impactStats} stats={stats} />
              </div>

              {/* Grille principale : Top Incubés & Répartition Espaces / Matériel */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Colonne gauche : Top 5 des Incubés les plus Assidus */}
                <div className="card p-6 lg:col-span-1 flex flex-col h-full">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-3">
                      <div>
                        <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                          Top Incubés Assidus
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-dark-400">
                          Porteurs de projets les plus présents aux ateliers
                        </p>
                      </div>
                    </div>

                    {(!impactStats?.assiduite?.topIncubes || impactStats.assiduite.topIncubes.length === 0) ? (
                      <div className="text-center py-10 text-slate-400 text-xs">
                        Aucun émargement enregistré pour le moment.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {impactStats.assiduite.topIncubes.map((inc, idx) => (
                          <div key={inc.incubeId || idx} className="p-3 rounded-xl bg-slate-50 dark:bg-dark-800/60 border border-slate-200/60 dark:border-dark-700/60 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${idx === 0 ? 'bg-amber-500 text-white shadow-sm' :
                                  idx === 1 ? 'bg-slate-300 text-slate-800' :
                                    idx === 2 ? 'bg-amber-700 text-white' :
                                      'bg-slate-200 dark:bg-dark-700 text-slate-600 dark:text-dark-300'
                                  }`}>
                                  {idx + 1}
                                </span>
                                <div className="min-w-0">
                                  <p className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                                    {inc.nomComplet}
                                  </p>
                                  <span className="font-mono text-[10px] text-slate-400">
                                    {inc.ppNumero || 'PP-IDS'}
                                  </span>
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-black text-xs shrink-0">
                                {inc.count} atelier{inc.count > 1 ? 's' : ''}
                              </span>
                            </div>

                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] font-bold text-slate-400">
                                <span>Taux d'assiduité :</span>
                                <span className="text-emerald-600 font-extrabold">{inc.taux}%</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-200 dark:bg-dark-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                                  style={{ width: `${inc.taux}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-2" data-html2canvas-ignore="true">
                    <button
                      type="button"
                      onClick={() => navigate('/evenements')}
                      className="w-full btn btn-secondary py-2 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Gérer les Ateliers & Émargements</span>
                      <ExternalLink size={13} />
                    </button>
                  </div>
                </div>

                {/* Colonne droite : Santé Matériel */}
                <div className="card p-6 lg:col-span-2 flex flex-col justify-between h-full space-y-6">
                  {/* Parc Matériel & Maintenance */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-2">
                      <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                        État du Parc Matériel & Équipements
                      </h3>
                      <button
                        type="button"
                        data-html2canvas-ignore="true"
                        onClick={() => navigate('/espaces')}
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
                      >
                        <span>Gérer le matériel</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>

                    <KpiMaterielChart equipements={impactStats?.equipements} />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Scène de rendu PDF Dédié Haute Définition (Visible uniquement pendant l'export pour html2canvas) */}
      <div
        id="pdf-export-stage"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '1240px',
          zIndex: exportingPdf ? 99990 : -9999,
          opacity: exportingPdf ? 1 : 0.001,
          pointerEvents: 'none',
          backgroundColor: '#ffffff',
        }}
      >
        <DashboardPdfStage
          stats={stats}
          impactStats={impactStats}
          activeTab={activeTab}
          selectedPromotion={selectedPromotion}
        />
      </div>

      {/* Overlay de chargement pendant la génération du PDF */}
      {exportingPdf && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[99999] flex flex-col items-center justify-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber-400 border-t-transparent mb-4" />
          <p className="text-base font-extrabold tracking-wide">Génération du rapport PDF officiel en haute définition...</p>
          <p className="text-xs text-slate-300 mt-1">Calibrage vectoriel A4 Paysage (2 pages certifiées IDS)</p>
        </div>
      )}

    </div>
  );
}
