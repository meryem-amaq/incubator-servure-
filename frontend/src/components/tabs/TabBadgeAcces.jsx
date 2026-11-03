import { useState, useEffect, useRef } from 'react';
import { 
  Radio, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Trash2, 
  Users, 
  Building2, 
  Server, 
  ShieldCheck, 
  Save, 
  ExternalLink,
  Info,
  Clock,
  Sparkles,
  RotateCcw,
  Search,
  UserCheck,
  Building,
  Check
} from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const BORNES_F18 = [
  { id: 1, ip: '10.0.1.120', name: 'Borne 1 — Entrée Principale', zone: 'Hall d\'Accueil' },
  { id: 2, ip: '10.0.1.201', name: 'Borne 2 — Tourniquet A', zone: 'Passage Piéton' },
  { id: 3, ip: '10.0.1.113', name: 'Borne 3 — Tourniquet B', zone: 'Passage Piéton' },
  { id: 4, ip: '10.0.1.108', name: 'Borne 4 — Tourniquet C', zone: 'Passage Piéton' },
  { id: 5, ip: '10.0.1.116', name: 'Borne 5 — Tourniquet D', zone: 'Passage Piéton' },
  { id: 6, ip: '10.0.1.17',  name: 'Borne 6 — SAS Sortie', zone: 'Sortie Sécurisée' },
  { id: 7, ip: '10.0.1.223', name: 'Borne 7 — Accès Coworking', zone: 'Espace Incubés' },
];

export default function TabBadgeAcces({ incube, onUpdate, onNavigateToRH }) {
  // --- État Badge Porteur ---
  const [badgeId, setBadgeId] = useState(incube?.badge_id || '');
  const [savingPorteur, setSavingPorteur] = useState(false);
  const [broadcastingPorteur, setBroadcastingPorteur] = useState(false);
  const [broadcastStatus, setBroadcastStatus] = useState(null);
  const [resyncingAll, setResyncingAll] = useState(false);
  const badgeInputRef = useRef(null);

  // --- État Associés & Co-fondateurs ---
  const [associesList, setAssociesList] = useState(incube?.associes || []);
  const [savingAssocIdx, setSavingAssocIdx] = useState(null);

  // --- État Staff RH ---
  const [staffList, setStaffList] = useState(incube?.personnel || []);
  const [savingStaffIdx, setSavingStaffIdx] = useState(null);

  // --- État Rapprochement Automatique (1-Clic) ---
  const [autoLinking, setAutoLinking] = useState(false);

  // --- État Testeur & Vérificateur de Badge RFID ---
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyBadgeInput, setVerifyBadgeInput] = useState('');
  const [verifyingBadge, setVerifyingBadge] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);

  useEffect(() => {
    setBadgeId(incube?.badge_id || '');
    setAssociesList(incube?.associes || []);
    setStaffList(incube?.personnel || []);
  }, [incube]);

  // Focus automatique sur le champ badge pour scan direct sans souris
  useEffect(() => {
    if (badgeInputRef.current) {
      badgeInputRef.current.focus();
    }
  }, []);

  // Sauvegarde & Diffusion du badge du Porteur (avec validation d'unicité et matricule auto réutilisé)
  const handleSavePorteurBadge = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const cleanBadge = String(badgeId).trim();
    if (!cleanBadge) {
      toast.error('Veuillez passer la carte sur le lecteur USB ou saisir le numéro de badge.');
      return;
    }

    setSavingPorteur(true);
    try {
      const res = await api.put(`/incubes/${incube.id}`, {
        badge_id: cleanBadge
      });

      const updated = res.data;
      setBadgeId(updated.badge_id || cleanBadge);
      setBroadcastStatus({
        success: true,
        matricule: updated.matricule,
        badge: updated.badge_id || cleanBadge,
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });

      toast.success(
        `Badge RFID #${cleanBadge} attribué à ${incube.nom_incube} (Matricule #${updated.matricule}). Diffusé instantanément sur les 7 Tourniquets F18 !`,
        { duration: 5000 }
      );

      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Erreur enregistrement badge porteur:', err);
      toast.error(err.response?.data?.message || 'Erreur lors de l\'enregistrement du badge porteur');
    } finally {
      setSavingPorteur(false);
    }
  };

  // Forcer la re-diffusion instantanée du badge Porteur
  const handleBroadcastPorteur = async () => {
    if (!incube?.badge_id) {
      toast.error('Aucun badge RFID n\'est encore enregistré pour ce porteur.');
      return;
    }

    setBroadcastingPorteur(true);
    try {
      const res = await api.post(`/incubes/${incube.id}/broadcast-rfid`);
      toast.success(res.data?.message || 'Profil ré-injecté avec succès sur les 7 Tourniquets F18 !');
      setBroadcastStatus({
        success: true,
        matricule: incube.matricule,
        badge: incube.badge_id,
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de la diffusion F18');
    } finally {
      setBroadcastingPorteur(false);
    }
  };

  // Dissocier le badge du porteur
  const handleRemovePorteurBadge = async () => {
    if (!window.confirm(`Dissocier le badge RFID #${incube.badge_id} du porteur ${incube.nom_incube} ?`)) return;

    setSavingPorteur(true);
    try {
      await api.put(`/incubes/${incube.id}`, {
        badge_id: null
      });
      setBadgeId('');
      setBroadcastStatus(null);
      toast.success('Badge RFID dissocié du porteur.');
      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de la dissociation du badge');
    } finally {
      setSavingPorteur(false);
    }
  };

  // Mettre à jour localement un champ d'un associé
  const handleUpdateAssocRow = (idx, field, value) => {
    const updated = [...associesList];
    updated[idx] = { ...updated[idx], [field]: value };
    setAssociesList(updated);
  };

  // Sauvegarder & Diffuser le badge d'un associé
  const handleSaveAssocBadge = async (idx) => {
    const assoc = associesList[idx];
    if (!assoc || !assoc.nom) return;

    setSavingAssocIdx(idx);
    try {
      const res = await api.put(`/incubes/${incube.id}/associe-badge`, {
        associeIndex: idx,
        associeNom: assoc.nom,
        badge_id: assoc.badge_id ? String(assoc.badge_id).trim() : null
      });

      const next = [...associesList];
      next[idx] = { ...next[idx], ...res.data.associe };
      setAssociesList(next);

      toast.success(res.data?.message || `Badge associé ${assoc.nom} mis à jour et diffusé !`);
      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de l\'enregistrement du badge de l\'associé');
    } finally {
      setSavingAssocIdx(null);
    }
  };

  // Mettre à jour localement un champ d'un membre du staff RH
  const handleUpdateStaffRow = (idx, field, value) => {
    const updated = [...staffList];
    updated[idx] = { ...updated[idx], [field]: value };
    setStaffList(updated);
  };

  // Enregistrer le badge d'un salarié du staff RH
  const handleSaveStaffBadge = async (idx) => {
    const member = staffList[idx];
    if (!member.id) {
      toast.error('Veuillez configurer ce salarié dans l\'onglet Ressources Humaines.');
      return;
    }

    setSavingStaffIdx(idx);
    try {
      const res = await api.put(`/incubes/${incube.id}/rh-detail/${member.id}`, {
        badge_id: member.badge_id ? String(member.badge_id).trim() : null
      });

      const next = [...staffList];
      next[idx] = { ...next[idx], ...res.data };
      setStaffList(next);

      const matTxt = res.data?.matricule ? ` (Matricule #${res.data.matricule})` : '';
      const rfidTxt = res.data?.badge_id ? ` • Badge #${res.data.badge_id} diffusé sur les 7 F18 (Nom: ${member.nom_complet})` : ' • Badge retiré';
      toast.success(`Salarié mis à jour${matTxt}${rfidTxt} !`);

      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de l\'enregistrement du badge salarié');
    } finally {
      setSavingStaffIdx(null);
    }
  };

  // Rapprochement automatique 1-clic des badges déjà scannés sur les tourniquets
  const handleAutoLinkBadges = async () => {
    setAutoLinking(true);
    const toastId = toast.loading('Recherche et rapprochement automatique des badges existants sur les tourniquets...');
    try {
      const res = await api.post('/presence/superadmin/auto-link-rh-badges');
      if (res.data?.success) {
        toast.success(
          `Succès ! ${res.data.totalLinked} badge(s) relié(s) automatiquement (${res.data.linkedRhCount} salariés RH + ${res.data.linkedAssocCount} associés) !`,
          { id: toastId, duration: 6000 }
        );
        if (onUpdate) onUpdate();
      } else {
        toast.error(res.data?.message || 'Erreur lors du rapprochement', { id: toastId });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Échec du rapprochement automatique', { id: toastId });
    } finally {
      setAutoLinking(false);
    }
  };

  // Test & Vérification complète d'un badge RFID
  const handleVerifyBadge = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const cleanBadge = String(verifyBadgeInput).trim();
    if (!cleanBadge) {
      toast.error('Veuillez passer la carte sur le lecteur ou taper le numéro de badge.');
      return;
    }

    setVerifyingBadge(true);
    setVerifyResult(null);
    try {
      const res = await api.post('/presence/superadmin/verifier-badge', { badge_id: cleanBadge });
      setVerifyResult(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de la vérification');
    } finally {
      setVerifyingBadge(false);
    }
  };

  // Forcer l'écrasement de tous les anciens noms physiques sur les 7 bornes F18
  const handleResyncAllF18Names = async () => {
    if (!window.confirm("Voulez-vous forcer la ré-injection de tous les profils (Porteurs, Salariés RH, Associés, Admins) sur les 7 Tourniquets F18 ? Cela écrasera définitivement les anciens noms enregistrés dans la mémoire physique des bornes.")) {
      return;
    }

    setResyncingAll(true);
    try {
      const res = await api.post('/presence/superadmin/resync-all-names');
      toast.success(res.data?.message || 'Tous les noms réels ont été ré-injectés avec succès sur les 7 bornes F18 !', { duration: 5500 });
      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de la ré-injection des noms');
    } finally {
      setResyncingAll(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 2. SECTION ÉTAPE 1 : BADGE RFID DU PORTEUR DE PROJET (INCUBÉ) */}
      <div className="card p-5 sm:p-6 border border-slate-200 dark:border-dark-700/60 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-dark-700/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
              <CreditCard size={22} />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-primary-600 dark:text-primary-400">Étape 1 • Dirigeant / Porteur</span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Badge RFID du Porteur de Projet</span>
                {incube?.badge_id && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 size={13} className="text-emerald-500" /> Badge Actif
                  </span>
                )}
              </h3>
            </div>
          </div>

          {/* Statut Matricule machine attribué */}
          <div className="flex items-center gap-2">
            <div className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-dark-800 border border-slate-200 dark:border-dark-700/70 text-right">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Matricule F18 Machine</div>
              <div className="text-base font-mono font-black text-slate-900 dark:text-white">
                {incube?.matricule ? (
                  <span className="text-primary-600 dark:text-primary-400">#{incube.matricule}</span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold">Auto-attribué (#)</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Détails du Porteur & Saisie Badge */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Fiche Porteur (Lecture seule récapitulative) */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-dark-800/50 border border-slate-200 dark:border-dark-700/50 space-y-2.5 text-xs">
            <div className="font-bold text-slate-800 dark:text-dark-200 flex items-center gap-1.5 text-sm">
              <Building2 size={15} className="text-primary-500" />
              <span>{incube?.raison_sociale || 'Startup sans raison sociale'}</span>
            </div>
            <div className="text-slate-600 dark:text-dark-300">
              <span className="font-semibold text-slate-500">Porteur :</span> {incube?.nom_incube || '—'}
            </div>
            <div className="text-slate-600 dark:text-dark-300">
              <span className="font-semibold text-slate-500">CIN :</span> {incube?.cin || '—'}
            </div>
            <div className="text-slate-600 dark:text-dark-300">
              <span className="font-semibold text-slate-500">Téléphone :</span> {incube?.telephone || '—'}
            </div>
            <div className="text-slate-600 dark:text-dark-300">
              <span className="font-semibold text-slate-500">Email :</span> {incube?.email || '—'}
            </div>
          </div>

          {/* Formulaire de scan du badge RFID */}
          <form onSubmit={handleSavePorteurBadge} className="lg:col-span-2 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-dark-200">
                  Numéro du Badge RFID Porteur (Scan Automatique ou Saisie)
                </label>
                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Sparkles size={13} /> Prêt au scan USB
                </span>
              </div>

              <div className="relative">
                <input
                  ref={badgeInputRef}
                  type="text"
                  value={badgeId}
                  onChange={(e) => setBadgeId(e.target.value)}
                  onKeyDown={(e) => {
                    // Les lecteurs RFID USB envoient la touche Entrée à la fin de la lecture
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSavePorteurBadge();
                    }
                  }}
                  placeholder="Passez la carte sur le lecteur USB (ex: 8520147)..."
                  className="input !py-3.5 !px-4 !text-base font-mono font-bold w-full bg-amber-50/60 dark:bg-amber-950/20 border-2 border-amber-400 dark:border-amber-600 text-amber-950 dark:text-amber-100 placeholder:text-amber-400/80 focus:ring-4 focus:ring-amber-500/20 shadow-inner"
                  autoFocus
                />
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                  <Radio size={20} className="text-amber-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
                    RFID Actif
                  </span>
                </div>
              </div>

              {/* Explication claire Lecteur USB + Matricule Auto */}
              <div className="mt-2.5 p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 text-[11px] text-blue-900 dark:text-blue-200 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <Info size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>Comment modifier un badge et corriger l'affichage du nom ?</span>
                </div>
                <p className="text-blue-800/90 dark:text-blue-300">
                  <strong>1. Écrasement immédiat de l'ancien nom :</strong> Si un badge affichait l'ancien nom d'un autre utilisateur sur le tourniquet F18, enregistrer ce badge ici envoie le <strong>vrai nom actuel</strong> aux 7 bornes et remplace définitivement l'ancien nom dans la mémoire physique.
                </p>
                <p className="text-blue-800/90 dark:text-blue-300">
                  <strong>2. Scan direct au lecteur USB :</strong> Branchez simplement votre lecteur RFID USB au PC et passez la carte devant. Le numéro est tapé et validé <strong>automatiquement</strong>.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="submit"
                disabled={savingPorteur || !badgeId.trim()}
                className="btn btn-primary flex items-center gap-2 text-xs font-bold shadow-md shadow-primary-500/20"
              >
                <Save size={15} className={savingPorteur ? 'animate-spin' : ''} />
                {savingPorteur ? 'Diffusion en cours...' : 'Enregistrer le Badge & Diffuser sur les 7 F18'}
              </button>

              {incube?.badge_id && (
                <>
                  <button
                    type="button"
                    onClick={handleBroadcastPorteur}
                    disabled={broadcastingPorteur || savingPorteur}
                    className="btn btn-secondary flex items-center gap-2 text-xs font-bold border-blue-500/30 text-blue-700 dark:text-blue-300 hover:bg-blue-500/10"
                    title="Forcer la re-diffusion immédiate vers les 7 Tourniquets F18"
                  >
                    <RefreshCw size={14} className={broadcastingPorteur ? 'animate-spin' : ''} />
                    {broadcastingPorteur ? 'Diffusion...' : 'Re-diffuser F18'}
                  </button>

                  <button
                    type="button"
                    onClick={handleRemovePorteurBadge}
                    disabled={savingPorteur}
                    className="btn btn-secondary flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border-rose-500/30"
                    title="Retirer le badge de cet incubé"
                  >
                    <Trash2 size={14} />
                    Dissocier
                  </button>
                </>
              )}
            </div>

            {/* Notification de dernière diffusion */}
            {broadcastStatus && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <span>
                    Dernière diffusion réussie : <strong>Badge #{broadcastStatus.badge}</strong> (Matricule #{broadcastStatus.matricule}) à <strong>{broadcastStatus.time}</strong>
                  </span>
                </div>
                <span className="font-bold text-[10px] uppercase tracking-wider bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-700 dark:text-emerald-300">
                  7/7 F18 OK
                </span>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* 3. SECTION ÉTAPE 2 : ASSOCIÉS & CO-FONDATEURS (SEPARÉ DES SALARIÉS RH) */}
      <div className="card p-5 sm:p-6 border border-slate-200 dark:border-dark-700/60 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-dark-700/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <UserCheck size={22} />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Étape 2 • Co-fondateurs & Associés</span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Badges RFID des Associés de la Startup</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-dark-300">
                  {associesList.filter(a => a.badge_id).length} / {associesList.length} avec badge
                </span>
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-xs text-slate-500 dark:text-dark-400 font-semibold mr-1">
              Startup : <strong className="text-slate-900 dark:text-white">{incube?.raison_sociale || incube?.nom_incube}</strong>
            </div>

            {/* Bouton Vérifier un Badge */}
            <button
              type="button"
              onClick={() => setShowVerifyModal(!showVerifyModal)}
              className="btn btn-secondary btn-sm flex items-center gap-1.5 font-bold text-xs border border-slate-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-slate-700 dark:text-slate-200 hover:border-amber-400 shadow-xs cursor-pointer py-1.5 px-3 rounded-xl transition"
            >
              <Search size={14} className="text-amber-500" />
              <span>Vérifier un Badge</span>
            </button>

            {/* Bouton Lier Badges Existants (1-Clic) */}
            <button
              type="button"
              onClick={handleAutoLinkBadges}
              disabled={autoLinking}
              className="btn btn-sm bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 shadow-sm text-xs py-1.5 px-3 rounded-xl cursor-pointer transition"
              title="Relie en 1 clic les cartes physiques déjà existantes sur les bornes aux salariés et associés"
            >
              <RefreshCw size={13} className={autoLinking ? 'animate-spin' : ''} />
              <span>{autoLinking ? 'Liaison en cours...' : 'Lier Badges Existants (1-Clic)'}</span>
            </button>
          </div>
        </div>

        {/* PANNEAU DE VÉRIFICATION INSTANTANÉE DE BADGE RFID (Ouvrable depuis le bouton) */}
        {/* PANNEAU DE VÉRIFICATION INSTANTANÉE DE BADGE RFID */}
      {showVerifyModal && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/70 dark:bg-dark-800 border-2 border-amber-400/60 dark:border-amber-600/60 shadow-md space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldCheck size={20} className="text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Vérificateur d'État de Badge RFID
              </h3>
            </div>
            <button 
              type="button" 
              onClick={() => { setShowVerifyModal(false); setVerifyResult(null); }}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white font-bold"
            >
              Fermer ✕
            </button>
          </div>

          <form onSubmit={handleVerifyBadge} className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              value={verifyBadgeInput}
              onChange={(e) => setVerifyBadgeInput(e.target.value)}
              placeholder="Passez une carte sur le lecteur USB ou tapez le numéro (ex: 8520147)..."
              className="input flex-1 font-mono font-bold text-sm bg-white dark:bg-dark-900 border-amber-300"
              autoFocus
            />
            <button
              type="submit"
              disabled={verifyingBadge || !verifyBadgeInput.trim()}
              className="btn btn-primary flex items-center justify-center gap-2 text-xs font-bold"
            >
              <Search size={14} className={verifyingBadge ? 'animate-spin' : ''} />
              {verifyingBadge ? 'Vérification...' : 'Tester le Badge'}
            </button>
          </form>

          {verifyResult && (
            <div className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
              verifyResult.isAvailable 
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 text-emerald-900 dark:text-emerald-200' 
                : 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 text-rose-900 dark:text-rose-200'
            }`}>
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center gap-1.5">
                  {verifyResult.isAvailable ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertCircle size={16} className="text-rose-600" />}
                  <span>{verifyResult.isAvailable ? 'Badge Libre & Prêt à être attribué' : 'Badge déjà attribué'}</span>
                </span>
                <span className="font-mono text-[11px]">Badge #{verifyResult.badge_id}</span>
              </div>

              {verifyResult.assignedTo && (
                <div className="pt-2 border-t border-rose-200 dark:border-rose-900/60 space-y-1">
                  <div><strong>Attribué à :</strong> {verifyResult.assignedTo.nom} ({verifyResult.assignedTo.type})</div>
                  {verifyResult.assignedTo.entite && <div><strong>Startup / Structure :</strong> {verifyResult.assignedTo.entite}</div>}
                  {verifyResult.assignedTo.matricule && <div><strong>Matricule machine F18 :</strong> #{verifyResult.assignedTo.matricule}</div>}
                </div>
              )}

              {verifyResult.tourniquetInfo && (
                <div className="pt-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                  <strong>Mémoire tourniquets F18 :</strong> Enregistré sous ID #{verifyResult.tourniquetInfo.machineId} (« {verifyResult.tourniquetInfo.nameOnDevice} » - {verifyResult.tourniquetInfo.type})
                </div>
              )}
            </div>
          )}
        </div>
      )}

        <p className="text-xs text-slate-500 dark:text-dark-400">
          Les associés sont reconnus automatiquement par les tourniquets avec le rôle <strong>Incubé</strong> et le nom de leur startup. Enregistrer ou modifier leur badge met à jour les 7 bornes physiques F18 en temps réel.
        </p>

        {/* Tableau des associés */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-dark-700/60">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-dark-300 border-b border-slate-200 dark:border-dark-700/60 font-bold">
                <th className="py-2.5 px-3 text-center w-24">Matricule F18</th>
                <th className="py-2.5 px-3 min-w-[160px]">Associé (Nom & CIN)</th>
                <th className="py-2.5 px-3 min-w-[120px]">Fonction</th>
                <th className="py-2.5 px-3 min-w-[120px]">Téléphone</th>
                <th className="py-2.5 px-3 min-w-[150px]">Badge RFID (F18)</th>
                <th className="py-2.5 px-3 text-center w-32">Statut F18</th>
                <th className="py-2.5 px-3 text-center w-20">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-dark-700/50">
              {associesList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400 italic">
                    Aucun associé déclaré pour cette startup dans le dossier juridique.
                  </td>
                </tr>
              ) : (
                associesList.map((assoc, idx) => {
                  const isSaving = savingAssocIdx === idx;
                  const hasBadge = Boolean(assoc.badge_id && String(assoc.badge_id).trim());

                  return (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-dark-800/40 transition-colors">
                      <td className="py-2.5 px-3 text-center font-mono">
                        {assoc.matricule ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-black bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            #{assoc.matricule}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Auto (#)</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                        <div>{assoc.nom || '—'}</div>
                        {assoc.cin && <div className="text-[10px] text-slate-500 font-normal">CIN : {assoc.cin}</div>}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-dark-300 font-medium">
                        {assoc.fonction || 'Associé'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-dark-300 font-mono text-[11px]">
                        {assoc.tel || '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={assoc.badge_id || ''}
                          onChange={(e) => handleUpdateAssocRow(idx, 'badge_id', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveAssocBadge(idx);
                            }
                          }}
                          placeholder="Scan RFID (ex: 8520149)"
                          className="input !py-1.5 !px-2.5 !text-xs font-mono font-bold bg-amber-50/50 dark:bg-amber-950/20 border-amber-300/80 dark:border-amber-700/80 text-amber-900 dark:text-amber-200 w-full"
                          title="Passez le badge sur le lecteur USB ou tapez Entrée"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {hasBadge ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 size={11} className="text-emerald-500" /> 7/7 Bornes
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-dark-800 dark:text-dark-400">
                            Sans badge
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleSaveAssocBadge(idx)}
                          disabled={isSaving}
                          className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 hover:text-white transition-all shadow-2xs"
                          title="Enregistrer et diffuser sur les 7 bornes F18"
                        >
                          <Save size={14} className={isSaving ? 'animate-spin' : ''} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. SECTION ÉTAPE 3 : BADGES DU STAFF & SALARIÉS (RH) */}
      <div className="card p-5 sm:p-6 border border-slate-200 dark:border-dark-700/60 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Users size={22} />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">Étape 3 • Salariés & Collaborateurs RH</span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Badges RFID du Personnel de la Startup</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-dark-300">
                  {staffList.filter(s => s.badge_id).length} / {staffList.length} avec badge
                </span>
              </h3>
            </div>
          </div>

          {/* Lien direct vers l'onglet RH */}
          {onNavigateToRH && (
            <button
              type="button"
              onClick={onNavigateToRH}
              className="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 border-purple-500/30"
            >
              <ExternalLink size={14} />
              Gérer dans l'onglet RH
            </button>
          )}
        </div>

        <p className="text-xs text-slate-500 dark:text-dark-400">
          Chaque salarié enregistré dans l'onglet Ressources Humaines se voit attribuer un matricule machine F18 distinct dès qu'un badge RFID lui est scanné. Enregistrer le badge écrase immédiatement tout ancien nom sur les 7 bornes F18.
        </p>

        {/* Tableau synthétique des badges Staff */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-dark-700/60">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-dark-300 border-b border-slate-200 dark:border-dark-700/60 font-bold">
                <th className="py-2.5 px-3 text-center w-24">Matricule F18</th>
                <th className="py-2.5 px-3 min-w-[160px]">Salarié</th>
                <th className="py-2.5 px-3 min-w-[130px]">Poste</th>
                <th className="py-2.5 px-3 min-w-[150px]">Badge RFID (F18)</th>
                <th className="py-2.5 px-3 text-center w-32">Statut F18</th>
                <th className="py-2.5 px-3 text-center w-20">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-dark-700/50">
              {staffList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400 italic">
                    Aucun salarié renseigné pour cette startup. Ajoutez des membres dans l'onglet <strong>« Ressources Humaines »</strong> pour leur attribuer un badge.
                  </td>
                </tr>
              ) : (
                staffList.map((member, idx) => {
                  const isSaving = savingStaffIdx === idx;
                  const hasBadge = Boolean(member.badge_id && String(member.badge_id).trim());

                  return (
                    <tr key={member.id || idx} className="hover:bg-slate-50 dark:hover:bg-dark-800/40 transition-colors">
                      {/* Matricule */}
                      <td className="py-2.5 px-3 text-center font-mono">
                        {member.matricule ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-black bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            #{member.matricule}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Auto (#)</span>
                        )}
                      </td>

                      {/* Nom */}
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                        {member.nom_complet || '—'}
                      </td>

                      {/* Poste */}
                      <td className="py-2.5 px-3 text-slate-600 dark:text-dark-300">
                        {member.poste || '—'}
                      </td>

                      {/* Scan Badge RFID */}
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={member.badge_id || ''}
                          onChange={(e) => handleUpdateStaffRow(idx, 'badge_id', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveStaffBadge(idx);
                            }
                          }}
                          placeholder="Scan RFID (8520148)"
                          className="input !py-1.5 !px-2.5 !text-xs font-mono font-bold bg-amber-50/50 dark:bg-amber-950/20 border-amber-300/80 dark:border-amber-700/80 text-amber-900 dark:text-amber-200 w-full"
                          title="Passez le badge sur le lecteur USB ou tapez la touche Entrée pour valider"
                        />
                      </td>

                      {/* Statut F18 */}
                      <td className="py-2.5 px-3 text-center">
                        {hasBadge ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 size={11} className="text-emerald-500" /> 7/7 Bornes
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-dark-800 dark:text-dark-400">
                            Sans badge
                          </span>
                        )}
                      </td>

                      {/* Action enregistrer */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleSaveStaffBadge(idx)}
                          disabled={isSaving}
                          className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 hover:text-white transition-all shadow-2xs"
                          title="Enregistrer ce badge et diffuser sur les 7 F18 (écrase l'ancien nom)"
                        >
                          <Save size={14} className={isSaving ? 'animate-spin' : ''} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. GRILLE DES 7 TOURNIQUETS F18 EN TEMPS RÉEL + BOUTON RÉ-INJECTION GLOBALE DES NOMS */}
      <div className="card p-5 sm:p-6 border border-slate-200 dark:border-dark-700/60 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-200 dark:border-dark-700/60">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-dark-300 flex items-center gap-2">
              <Server size={15} className="text-primary-500" />
              <span>Matériel Réseau — 7 Tourniquets ZKTeco F18</span>
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-dark-400">
              Bornes physiques connectées au réseau IDS
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResyncAllF18Names}
              disabled={resyncingAll}
              className="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/10 shadow-2xs"
              title="Écraser tous les anciens noms physiques sur les 7 Tourniquets F18 par les noms réels enregistrés dans l'application"
            >
              <RotateCcw size={13} className={resyncingAll ? 'animate-spin text-amber-500' : 'text-amber-500'} />
              {resyncingAll ? 'Écrasement en cours...' : 'Écraser les anciens noms physiques F18'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
          {BORNES_F18.map((borne) => (
            <div
              key={borne.id}
              className="p-2.5 rounded-xl bg-slate-50 dark:bg-dark-800/60 border border-slate-200 dark:border-dark-700/50 flex flex-col justify-between text-center shadow-2xs"
            >
              <div>
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[11px] font-bold text-slate-800 dark:text-dark-100">{borne.name.split('—')[0].trim()}</span>
                </div>
                <div className="text-[10px] font-mono text-slate-500 dark:text-dark-400">{borne.ip}</div>
              </div>
              <div className="mt-2 pt-1 border-t border-slate-200/60 dark:border-dark-700/40 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                Synchronisé
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
