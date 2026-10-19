import { useState, useEffect } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { 
  CheckCircle2, 
  Clock, 
  Calendar, 
  User, 
  GraduationCap, 
  QrCode, 
  Sparkles, 
  AlertCircle, 
  Send,
  Building,
  Lightbulb,
  FileText,
  Briefcase,
  Layers,
  Award,
  Mail
} from 'lucide-react';

const BASE_MODULES_DATA = {
  'Post-Création': [
    { code: 'GFC', label: 'GFC – Gestion Comptable et Financière', desc: 'Comptabilité, trésorerie, états financiers & fiscalité' },
    { code: 'MDC', label: 'MDC – Marketing et Développement Commercial', desc: 'Stratégie marketing, prospection, fidélisation & vente' },
    { code: 'RH', label: 'RH – Ressources Humaines', desc: 'Gestion des équipes, cadres contractuels & motivation' },
    { code: 'SS', label: 'SS – Soft Skills', desc: 'Communication, leadership, gestion du stress & posture' }
  ],
  'Pré-Création': [
    { code: 'BMC', label: 'BMC – Business Model Canvas', desc: 'Proposition de valeur, segments clients & modèle de revenus' },
    { code: 'BP', label: 'BP – Business Plan', desc: 'Faisabilité financière, prévisions & stratégie de démarrage' },
    { code: 'SJ', label: 'SJ – Statut Juridique', desc: 'Choix de la forme juridique, cadre légal & immatriculation' }
  ]
};

function getMergedModulesData() {
  const result = {
    'Post-Création': [...BASE_MODULES_DATA['Post-Création']],
    'Pré-Création': [...BASE_MODULES_DATA['Pré-Création']]
  };

  try {
    const saved = localStorage.getItem('ids_formation_parcours_modules');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed['post-creation']?.modules)) {
        parsed['post-creation'].modules.forEach(m => {
          if (!result['Post-Création'].some(ex => ex.code === m.code)) {
            result['Post-Création'].push({ code: m.code, label: `${m.code} – ${m.name}`, desc: m.duree || '' });
          }
        });
      }
      if (Array.isArray(parsed['pre-creation']?.modules)) {
        parsed['pre-creation'].modules.forEach(m => {
          if (!result['Pré-Création'].some(ex => ex.code === m.code)) {
            result['Pré-Création'].push({ code: m.code, label: `${m.code} – ${m.name}`, desc: m.duree || '' });
          }
        });
      }
    }
  } catch (e) {
    // Fallback
  }

  return result;
}

export default function PresenceFormation() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();

  // Détection automatique si pré-rempli via QR code URL
  const initialTypeFromUrl = searchParams.get('type') || (
    id && (id.toUpperCase() === 'BMC' || id.toUpperCase() === 'BP' || id.toUpperCase() === 'SJ')
      ? 'Pré-Création'
      : id && (id.toUpperCase() === 'GFC' || id.toUpperCase() === 'MDC' || id.toUpperCase() === 'RH' || id.toUpperCase() === 'SS')
      ? 'Post-Création'
      : 'Post-Création'
  );

  const initialModuleCode = searchParams.get('module') || (id ? id.toUpperCase() : '');

  // Formulaire avec Email obligatoire
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [ppNumero, setPpNumero] = useState('');
  const [typeFormation, setTypeFormation] = useState(initialTypeFromUrl);
  const [selectedModule, setSelectedModule] = useState(initialModuleCode);

  const modulesData = useMemo(() => getMergedModulesData(), []);

  // État de soumission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Quand le type change, réinitialiser ou ajuster le module sélectionné
  useEffect(() => {
    const available = modulesData[typeFormation] || [];
    const exists = available.some(m => m.code === selectedModule);
    if (!exists && available.length > 0) {
      setSelectedModule(available[0].code);
    }
  }, [typeFormation, modulesData]);

  // Validation stricte incluant l'email obligatoire
  const isFormValid = nom.trim().length > 0 && prenom.trim().length > 0 && email.trim().length > 0 && email.includes('@') && ppNumero.trim().length > 0 && selectedModule;

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!isFormValid) {
      setErrorMessage("Veuillez renseigner votre Nom, Prénom, une adresse Email valide, votre N° de projet et choisir un module.");
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    const cleanNom = nom.trim().toUpperCase();
    const cleanPrenom = prenom.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPp = ppNumero.trim().toUpperCase();
    const timeStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const moduleObj = (modulesData[typeFormation] || []).find(m => m.code === selectedModule);
    const moduleLabel = moduleObj ? moduleObj.label : selectedModule;

    const payload = {
      atelierId: `formation_${selectedModule}`,
      nom: cleanNom,
      prenom: cleanPrenom,
      email: cleanEmail,
      pp_numero: cleanPp,
      time: timeStr,
      type: 'formation',
      typeFormation,
      moduleCode: selectedModule,
      moduleLabel
    };

    try {
      const headers = {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'Bypass-Tunnel-Reminder': 'true'
      };

      const res = await fetch('/api/presence/enregistrer', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        let errTxt = "Échec lors de l'enregistrement de votre présence.";
        try {
          const errData = await res.json();
          if (errData.message) errTxt = errData.message;
        } catch (_) {}
        throw new Error(errTxt);
      }

      setReceiptData({
        nom: cleanNom,
        prenom: cleanPrenom,
        email: cleanEmail,
        pp_numero: cleanPp,
        typeFormation,
        moduleLabel,
        time: timeStr,
        date: new Date().toLocaleDateString('fr-FR')
      });
      setIsSuccess(true);
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message || "Erreur de connexion avec le serveur.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col justify-between py-6 px-4 sm:px-6">
      <div className="max-w-md w-full mx-auto space-y-6">
        
        {/* En-tête Badge IDS */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold tracking-wide shadow-sm">
            <GraduationCap size={16} />
            <span>ÉMARGEMENT FORMATION OFFICIEL</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Incubateur Digital Solidaire
          </h1>
          <p className="text-xs text-slate-400">
            Feuille d'émargement et assiduité aux parcours pédagogiques
          </p>
        </div>

        {/* Écran Succès */}
        {isSuccess && receiptData ? (
          <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-3xl p-6 text-center space-y-4 shadow-2xl backdrop-blur-md">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/30 shadow-inner">
              <CheckCircle2 size={36} />
            </div>

            <div>
              <h3 className="text-xl font-black text-white">Présence Validée !</h3>
              <p className="text-xs text-emerald-300/90 mt-1">
                Votre émargement pour ce module a bien été enregistré.
              </p>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-left space-y-2.5 text-xs">
              <div className="flex justify-between border-b border-slate-800/60 pb-2">
                <span className="text-slate-400">Participant :</span>
                <span className="font-bold text-white">{receiptData.prenom} {receiptData.nom}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-2">
                <span className="text-slate-400">Email :</span>
                <span className="font-bold text-sky-400">{receiptData.email}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-2">
                <span className="text-slate-400">N° Projet / PP :</span>
                <span className="font-bold text-amber-400">{receiptData.pp_numero}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-2">
                <span className="text-slate-400">Parcours :</span>
                <span className="font-semibold text-slate-200">{receiptData.typeFormation}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-2">
                <span className="text-slate-400">Module :</span>
                <span className="font-bold text-emerald-400 text-right max-w-[200px] truncate">
                  {receiptData.moduleLabel}
                </span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-slate-400">Date & Heure :</span>
                <span className="font-mono text-slate-300">{receiptData.date} à {receiptData.time}</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              Votre assiduité est enregistrée dans le système de suivi de l'incubateur.
            </p>
          </div>
        ) : (
          /* Formulaire Mobile */
          <form onSubmit={handleSubmit} className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl backdrop-blur-md space-y-4">
            
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-sm font-bold text-slate-200">
              <User size={16} className="text-amber-400" />
              <span>Vos Coordonnées</span>
            </div>

            {errorMessage && (
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Nom & Prénom */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Nom <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder="Ex: BENNANI"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Prénom <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  placeholder="Ex: Yassine"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                />
              </div>
            </div>

            {/* Email obligatoire */}
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Adresse Email <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ex: porteur@gmail.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                />
              </div>
            </div>

            {/* Numéro de projet */}
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Numéro de Projet / N° PP <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={ppNumero}
                onChange={(e) => setPpNumero(e.target.value)}
                placeholder="Ex: PP-07 ou Nom de la startup"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
              />
            </div>

            {/* 1. Choix du Type de formation (Post ou Pré-Création) */}
            <div className="pt-2">
              <label className="block text-[11px] font-bold text-slate-300 mb-1.5">
                Type de formation <span className="text-rose-400">*</span>
              </label>
              
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setTypeFormation('Post-Création')}
                  className={`p-3 rounded-2xl border text-left transition-all flex flex-col gap-1 cursor-pointer ${
                    typeFormation === 'Post-Création'
                      ? 'bg-amber-500/15 border-amber-500 text-white shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <Building size={14} className={typeFormation === 'Post-Création' ? 'text-amber-400' : ''} />
                    <span>Post-Création</span>
                  </div>
                  <span className="text-[10px] text-slate-400">4 modules disponibles</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTypeFormation('Pré-Création')}
                  className={`p-3 rounded-2xl border text-left transition-all flex flex-col gap-1 cursor-pointer ${
                    typeFormation === 'Pré-Création'
                      ? 'bg-blue-500/15 border-blue-500 text-white shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <Lightbulb size={14} className={typeFormation === 'Pré-Création' ? 'text-blue-400' : ''} />
                    <span>Pré-Création</span>
                  </div>
                  <span className="text-[10px] text-slate-400">3 modules disponibles</span>
                </button>
              </div>
            </div>

            {/* 2. Choix du Module (Affiché dynamiquement selon le type) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1.5">
                Module de formation ({typeFormation}) <span className="text-rose-400">*</span>
              </label>
              
              <div className="space-y-2">
                {(modulesData[typeFormation] || []).map((mod) => (
                  <label
                    key={mod.code}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                      selectedModule === mod.code
                        ? 'bg-slate-800/90 border-amber-500/80 text-white shadow-sm'
                        : 'bg-slate-950 border-slate-800/80 text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    <input
                      type="radio"
                      name="selectedModule"
                      value={mod.code}
                      checked={selectedModule === mod.code}
                      onChange={() => setSelectedModule(mod.code)}
                      className="mt-1 text-amber-500 focus:ring-amber-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-white">{mod.label}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                        {mod.desc}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Bouton de confirmation */}
            <button
              type="submit"
              disabled={isSubmitting || !isFormValid}
              className="w-full py-3.5 px-4 rounded-2xl font-bold text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-2"
            >
              {isSubmitting ? (
                <>
                  <Clock size={16} className="animate-spin" />
                  <span>Validation en cours...</span>
                </>
              ) : (
                <>
                  <Send size={16} />
                  <span>Valider mon Émargement</span>
                </>
              )}
            </button>
          </form>
        )}

        <div className="text-center text-[11px] text-slate-500">
          Système Sécurisé d'Assiduité Pédagogique • Incubateur CGS / IDS
        </div>
      </div>
    </div>
  );
}
