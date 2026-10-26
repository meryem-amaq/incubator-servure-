import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Building2, Wrench, BarChart3, UsersRound, ClipboardList, DollarSign, Camera, FileSpreadsheet, KeyRound, Mail, UserX, Clock, CheckCircle2, FileText, GraduationCap } from 'lucide-react';
import api, { getPhotoUrl } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import TabInfos from '../components/tabs/TabInfos';
import TabMateriel from '../components/tabs/TabMateriel';
import TabEngagement from '../components/tabs/TabEngagement';
import TabFormations from '../components/tabs/TabFormations';
import TabRH from '../components/tabs/TabRH';
import TabPlanAction from '../components/tabs/TabPlanAction';
import TabFinancier from '../components/tabs/TabFinancier';
import TabFicheSuivi from '../components/tabs/TabFicheSuivi';
import ExcelFullDossierModal from '../components/common/ExcelFullDossierModal';

const TABS = [
  { key: 'infos', label: 'Infos Générales', icon: Building2 },
  { key: 'materiel', label: 'Matériel', icon: Wrench },
  { key: 'engagement', label: 'Engagement & Présence', icon: BarChart3 },
  { key: 'formations', label: 'Formations Suivies', icon: GraduationCap },
  { key: 'rh', label: 'Ressources Humaines', icon: UsersRound },
  { key: 'plan', label: "Plan d'Action", icon: ClipboardList },
  { key: 'financier', label: 'Analyse Financière', icon: DollarSign },
  { key: 'suivi', label: 'Fiche de Suivi', icon: FileText },
];

export default function ProfilIncube() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [incube, setIncube] = useState(null);
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam && TABS.some(t => t.key === tabParam) ? tabParam : 'infos');

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && TABS.some(tab => tab.key === t)) {
      setActiveTab(t);
    }
  }, [searchParams]);
  const [loading, setLoading] = useState(true);
  const [showFullDossierModal, setShowFullDossierModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/incubes/${id}`);
      setIncube(res.data);
    } catch (err) {
      toast.error('Impossible de charger les données de cet incubé');
      setIncube(null);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handleActiverCompte = async () => {
    if (!incube.email) {
      toast.error("Veuillez renseigner une adresse email dans l'onglet 'Infos Générales' avant d'activer le compte");
      return;
    }
    setActionLoading(true);
    try {
      const res = await api.post(`/incubes/${incube.id}/activer-compte`);
      toast.success(res.data?.message || 'Compte activé et accès envoyés par email !');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'activation du compte");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDesactiverCompte = async () => {
    if (!window.confirm(`Êtes-vous sûr de vouloir suspendre l'accès portail de ${incube.nom_incube} ?`)) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/incubes/${incube.id}/desactiver-compte`);
      toast.success(res.data?.message || 'Accès suspendu.');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la suspension du compte");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRenvoyerAcces = async () => {
    if (!window.confirm(`Générer un nouveau mot de passe et réexpédier les accès par email à ${incube.email} ?`)) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/incubes/${incube.id}/renvoyer-acces`);
      toast.success(res.data?.message || 'Nouveaux identifiants envoyés par email !');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors du renvoi des identifiants");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="text-center py-20 text-slate-500 dark:text-dark-400">Chargement du profil...</div>;
  if (!incube) return <div className="text-center py-20 text-slate-500 dark:text-dark-400">Incubé non trouvé</div>;

  const isStaff = user?.role !== 'incube';
  const PHASE_COLORS = { 'Idéation': 'badge-navy', 'Lancement': 'badge-blue', 'Croissance': 'badge-green', 'Maturité': 'badge-orange' };

  const renderTab = () => {
    switch (activeTab) {
      case 'infos': return <TabInfos incube={incube} onUpdate={load} />;
      case 'materiel': return <TabMateriel incubeId={incube.id} incube={incube} data={incube.materiels || []} onUpdate={load} />;
      case 'engagement': return <TabEngagement incubeId={incube.id} incube={incube} data={incube.engagements || []} onUpdate={load} />;
      case 'formations': return <TabFormations incubeId={incube.id} formations={incube.formations || []} onUpdate={load} />;
      case 'rh': return <TabRH incubeId={incube.id} incube={incube} emplois={incube.emplois || []} personnel={incube.personnel || []} onUpdate={load} />;
      case 'plan': return <TabPlanAction incubeId={incube.id} incube={incube} data={incube.plans || []} onUpdate={load} />;
      case 'financier': return <TabFinancier incubeId={incube.id} incube={incube} data={incube.finances || []} onUpdate={load} />;
      case 'suivi': return <TabFicheSuivi incubeId={incube.id} incube={incube} fiches={incube.fiches_suivi || []} onUpdate={load} />;
      default: return null;
    }
  };

  return (
    <div className="slide-up space-y-6">
      {/* Header — profil */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
        <button className="btn btn-secondary btn-icon mt-1" onClick={() => navigate('/incubes')}>
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-4 sm:gap-5 flex-1 w-full">
          <div className="relative w-16 h-16 shrink-0">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-navy-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary-500/20 absolute inset-0">
              {incube.nom_incube?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            {incube.photo_path && (
              <img 
                src={getPhotoUrl(incube.photo_path)} 
                alt={incube.nom_incube} 
                className="w-16 h-16 rounded-2xl object-cover shadow-lg border-2 border-primary-500/40 relative z-10" 
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            )}
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">{incube.nom_incube}</h1>
            <p className="text-slate-500 dark:text-dark-400 text-sm">{incube.raison_sociale || '—'} · {incube.pp_numero}</p>
          </div>
          <div className="flex items-center gap-2.5 ml-auto flex-wrap justify-end">
            <span className={`badge ${PHASE_COLORS[incube.phase_projet] || 'badge-gray'}`}>
              {incube.phase_projet}
            </span>
            {incube.plans?.some(p => p.realisation === 'En attente') && (
              <span className="inline-flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 ring-1 ring-amber-400/40 animate-pulse" title="Objectif non atteint : En attente d'une 2ème séance">
                🟠 En attente (2ème séance)
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowFullDossierModal(true)}
              className="btn btn-secondary btn-sm flex items-center gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 font-bold shadow-sm"
              title="Remplir tout le dossier de l'incubé avec un fichier Excel"
            >
              <FileSpreadsheet size={15} className="text-emerald-500" />
              <span className="hidden sm:inline">Importer tout le dossier (Excel)</span>
              <span className="sm:hidden">Excel global</span>
            </button>
          </div>
        </div>
      </div>

      {/* Barre de statut du compte portail incubé & actions (Visible pour Coach / Super Admin) */}
      {isStaff && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-dark-900 rounded-2xl border border-slate-200 dark:border-dark-700/80 shadow-sm">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              incube.compteUtilisateur?.actif 
                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
            }`}>
              <KeyRound size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-bold text-slate-800 dark:text-dark-100">Compte Portail Incubé :</span>
                {incube.compteUtilisateur ? (
                  incube.compteUtilisateur.actif ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                      <CheckCircle2 size={13} className="text-emerald-500" /> Compte Actif & Opérationnel
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 ring-1 ring-amber-400/30 animate-pulse">
                      <Clock size={13} className="text-amber-500" /> En attente d'activation
                    </span>
                  )
                ) : incube.email ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                    <Clock size={13} className="text-amber-500" /> En attente de validation
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 dark:bg-dark-800 dark:text-dark-400">
                    Sans adresse email (non activable)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-dark-400 mt-1">
                {incube.email ? (
                  <>Adresse email de connexion : <span className="font-mono font-semibold text-slate-700 dark:text-dark-200">{incube.email}</span></>
                ) : (
                  "Renseignez une adresse e-mail dans l'onglet 'Infos Générales' pour créer et activer l'accès de l'incubé."
                )}
              </p>
            </div>
          </div>

          {/* Boutons d'actions pour le coach / super admin */}
          <div className="flex items-center gap-2 flex-wrap">
            {(!incube.compteUtilisateur || !incube.compteUtilisateur.actif) ? (
              <button
                type="button"
                onClick={handleActiverCompte}
                disabled={actionLoading || !incube.email}
                className="btn btn-primary btn-sm flex items-center gap-1.5 text-xs font-bold shadow-md shadow-primary-500/20"
                title={!incube.email ? "Renseignez d'abord un email" : "Valider le compte et envoyer les accès par email"}
              >
                <KeyRound size={14} />
                {actionLoading ? "Activation en cours..." : "Activer le compte & Envoyer les accès"}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleRenvoyerAcces}
                  disabled={actionLoading}
                  className="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs font-bold text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/40"
                  title="Générer un nouveau mot de passe et réexpédier les accès par email"
                >
                  <Mail size={14} />
                  {actionLoading ? "Envoi..." : "Renvoyer identifiants"}
                </button>
                <button
                  type="button"
                  onClick={handleDesactiverCompte}
                  disabled={actionLoading}
                  className="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                  title="Suspendre temporairement l'accès de cet incubé"
                >
                  <UserX size={14} />
                  Suspendre
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex overflow-x-auto pb-2 -mb-2 gap-2 p-1.5 bg-slate-50 dark:bg-dark-800/40 rounded-2xl border border-slate-200 dark:border-dark-700/30 hide-scrollbar">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              className={`tab flex items-center gap-2 ${activeTab === tab.key ? 'tab-active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon size={15} />
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="fade-in">
        {renderTab()}
      </div>

      {/* Modale d'importation du dossier complet Excel */}
      <ExcelFullDossierModal
        isOpen={showFullDossierModal}
        onClose={() => setShowFullDossierModal(false)}
        incubeId={incube.id}
        incubeName={incube.nom_incube}
        onApplied={load}
      />
    </div>
  );
}
