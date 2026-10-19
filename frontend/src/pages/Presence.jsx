import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { 
  CheckCircle2, 
  Clock, 
  Calendar, 
  User, 
  GraduationCap, 
  QrCode, 
  Hourglass, 
  Sparkles, 
  AlertCircle, 
  Lock, 
  Unlock,
  ArrowLeft,
  Send,
  Hash,
  Mail
} 
from 'lucide-react';

// Fonction utilitaire pour convertir toute date (DD/MM/YYYY, YYYY-MM-DD, ISO) en format standard YYYY-MM-DD
function normalizeDateString(dateInput) {
  if (!dateInput) return new Date().toISOString().split('T')[0];
  let s = String(dateInput).trim();
  if (s.includes('T')) s = s.split('T')[0];
  if (s.includes('/')) {
    const p = s.split('/');
    if (p.length === 3) {
      return p[0].length === 4 
        ? `${p[0]}-${p[1].padStart(2, '0')}-${p[2].padStart(2, '0')}` 
        : `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
    }
  }
  if (s.includes('-')) {
    const p = s.split('-');
    if (p.length === 3 && p[0].length === 2 && p[2].length === 4) {
      return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
    }
  }
  return s;
}

export default function Presence() {
  const { id } = useParams(); // ID de l'atelier
  const [searchParams] = useSearchParams();

  // Données initiales de l'atelier
  const initialDate = normalizeDateString(searchParams.get('date') || new Date().toISOString().split('T')[0]);
  const initialDebut = searchParams.get('heureDebut') || '09:30';
  const initialFin = searchParams.get('heureFin') || '12:30';

  // Calcul préliminaire immédiat à l'initialisation
  const [hD_init, mD_init] = initialDebut.split(':').map(Number);
  const [hF_init, mF_init] = initialFin.split(':').map(Number);
  const tStart_init = new Date(`${initialDate}T${String(hD_init || 0).padStart(2, '0')}:${String(mD_init || 0).padStart(2, '0')}:00`).getTime();
  const tEnd_init = new Date(`${initialDate}T${String(hF_init || 0).padStart(2, '0')}:${String(mF_init || 0).padStart(2, '0')}:00`).getTime();
  const now_init = Date.now();
  const isPast_init = now_init > (tEnd_init + 2 * 60 * 60 * 1000);
  const isOpen_init = !isPast_init && (now_init >= tStart_init - 5 * 60 * 1000);

  const [atelierInfo, setAtelierInfo] = useState({
    titre: searchParams.get('nom_atelier') || 'Atelier & Formation IDS',
    date: initialDate,
    heureDebut: initialDebut,
    heureFin: initialFin,
    duree: searchParams.get('duree') || '3h00',
    formateur: searchParams.get('formateur') || 'Intervenant IDS',
    statutOuverture: 'auto',
    isOpen: isOpen_init,
    isPast: isPast_init,
    timeRemainingMs: 0
  });

  // Compte à rebours dynamique (Chrono)
  const [countdown, setCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    totalSecondsRemaining: 0
  });


  // Champs de saisie directe : Nom, Prénom, Email et ID PP
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [ppNumero, setPpNumero] = useState('');
  const [forceShowForm, setForceShowForm] = useState(searchParams.get('test') === '1');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSigned, setIsSigned] = useState(false);
  const [signedData, setSignedData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // 1. Polling des informations atelier (statut d'ouverture, changements d'horaire ou forçage par l'admin)
  useEffect(() => {
    const fetchInfo = () => {
      const q = new URLSearchParams({
        titre: searchParams.get('nom_atelier') || atelierInfo.titre || '',
        date: searchParams.get('date') || atelierInfo.date || '',
        heureDebut: searchParams.get('heureDebut') || atelierInfo.heureDebut || '',
        heureFin: searchParams.get('heureFin') || atelierInfo.heureFin || '',
        duree: searchParams.get('duree') || atelierInfo.duree || ''
      });

      fetch(`/api/presence/atelier/${id}/info?${q.toString()}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.atelier) {
            // Normaliser la date et recalculer les états avec certitude (priorité au planning officiel du backend)
            const sDate = normalizeDateString(data.atelier.date || searchParams.get('date') || atelierInfo.date);
            const sDebut = data.atelier.heureDebut || searchParams.get('heureDebut') || atelierInfo.heureDebut || '09:30';
            const sFin = data.atelier.heureFin || searchParams.get('heureFin') || atelierInfo.heureFin || '12:30';

            const [hD, mD] = sDebut.split(':').map(Number);
            const [hF, mF] = sFin.split(':').map(Number);

            const tStart = new Date(`${sDate}T${String(hD || 0).padStart(2, '0')}:${String(mD || 0).padStart(2, '0')}:00`).getTime();
            const tEnd = new Date(`${sDate}T${String(hF || 0).padStart(2, '0')}:${String(mF || 0).padStart(2, '0')}:00`).getTime();
            const now = Date.now();

            const cClose = tEnd + (2 * 60 * 60 * 1000); // +2h après la fin
            const cOpen = tStart - (5 * 60 * 1000);     // 5 min avant le début

            let calculatedIsOpen = false;
            let calculatedIsPast = false;

            if (data.atelier.statutOuverture === 'ouvert_force') {
              calculatedIsOpen = true;
              calculatedIsPast = false;
            } else if (data.atelier.statutOuverture === 'cloture' || now > cClose) {
              calculatedIsOpen = false;
              calculatedIsPast = true;
            } else if (now >= cOpen && now <= cClose) {
              calculatedIsOpen = true;
              calculatedIsPast = false;
            } else {
              calculatedIsOpen = false;
              calculatedIsPast = false;
            }

            setAtelierInfo(prev => ({
              ...prev,
              ...data.atelier,
              date: sDate,
              heureDebut: sDebut,
              heureFin: sFin,
              isOpen: calculatedIsOpen,
              isPast: calculatedIsPast
            }));
          }
        })
        .catch(() => {});
    };

    fetchInfo();
    const interval = setInterval(fetchInfo, 3000); // Polling toutes les 3s pour réactivité en cas de forçage ou décalage
    return () => clearInterval(interval);
  }, [id, searchParams]);

  // 2. Horloge du compte à rebours décomptant chaque seconde
  useEffect(() => {
    const updateCountdown = () => {
      // Cas 1 : Forcé ouvert par l'administrateur
      if (atelierInfo.statutOuverture === 'ouvert_force') {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0, totalSecondsRemaining: 0 });
        setAtelierInfo(prev => ({ ...prev, isOpen: true, isPast: false }));
        return;
      }

      // Cas 2 : Clôturé manuellement par l'administrateur
      if (atelierInfo.statutOuverture === 'cloture') {
        setAtelierInfo(prev => ({ ...prev, isOpen: false, isPast: true }));
        return;
      }

      // Calcul précis des dates et heures normalisées
      const rawDateStr = normalizeDateString(atelierInfo.date);
      const heureDebutStr = atelierInfo.heureDebut || '09:30';
      const heureFinStr = atelierInfo.heureFin || '12:30';

      const [hD, mD] = heureDebutStr.split(':').map(Number);
      const [hF, mF] = heureFinStr.split(':').map(Number);

      const targetStartTime = new Date(`${rawDateStr}T${String(hD || 0).padStart(2, '0')}:${String(mD || 0).padStart(2, '0')}:00`).getTime();
      const targetEndTime = new Date(`${rawDateStr}T${String(hF || 0).padStart(2, '0')}:${String(mF || 0).padStart(2, '0')}:00`).getTime();
      const now = Date.now();

      // Tolérance de fin : +2 heures après l'heure de fin de l'événement
      const closeTime = targetEndTime + (2 * 60 * 60 * 1000);
      const isPast = now > closeTime;

      // Cas 3 : Après l'événement (+2h après l'heure de fin) -> CLÔTURÉ AUTOMATIQUEMENT
      if (isPast) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0, totalSecondsRemaining: 0 });
        setAtelierInfo(prev => ({ ...prev, isOpen: false, isPast: true }));
        return;
      }

      // Tolérance de début : ouvert 5 minutes avant l'heure de début
      const openTime = targetStartTime - (5 * 60 * 1000);
      const diffStartMs = targetStartTime - now;

      // Cas 4 : Au moment de l'événement (entre openTime et closeTime) -> OUVERT
      if (now >= openTime) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0, totalSecondsRemaining: 0 });
        setAtelierInfo(prev => ({ ...prev, isOpen: true, isPast: false }));
      } else {
        // Cas 5 : Avant l'événement -> AFFICHER LE CHRONO / COMPTE À REBOURS
        const totalSec = Math.max(0, Math.floor(diffStartMs / 1000));
        const days = Math.floor(totalSec / 86400);
        const hours = Math.floor((totalSec % 86400) / 3600);
        const minutes = Math.floor((totalSec % 3600) / 60);
        const seconds = totalSec % 60;
        setCountdown({ days, hours, minutes, seconds, totalSecondsRemaining: totalSec });
        setAtelierInfo(prev => ({ ...prev, isOpen: false, isPast: false }));
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [atelierInfo.date, atelierInfo.heureDebut, atelierInfo.heureFin, atelierInfo.statutOuverture]);

  // Validation du formulaire : Nom, Prénom et Email sont obligatoires
  const isFormValid = nom.trim().length > 0 && prenom.trim().length > 0 && email.trim().length > 0 && email.includes('@');

  // Validation de l'émargement
  const handleConfirmPresence = async (e) => {
    if (e) e.preventDefault();
    if (!isFormValid) {
      setErrorMessage("Veuillez renseigner votre Nom, Prénom et un Email valide.");
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    const cleanNom = nom.trim().toUpperCase();
    const cleanPrenom = prenom.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPp = ppNumero.trim().toUpperCase();
    const timeStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    const payload = {
      atelierId: id,
      nom: cleanNom,
      prenom: cleanPrenom,
      email: cleanEmail,
      pp_numero: cleanPp || undefined,
      time: timeStr
    };

    setErrorMessage('');

    try {
      // 1. Envoi au serveur Backend (résolution et enregistrement de l'identité en BDD)
      const headers = {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'Bypass-Tunnel-Reminder': 'true'
      };
      const token = localStorage.getItem('token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/presence/enregistrer', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        let serverError = 'Échec de l\'enregistrement de la présence sur le serveur.';
        try {
          const errData = await res.json();
          if (errData.message) serverError = errData.message;
        } catch (_) {}
        throw new Error(serverError);
      }

      const resData = await res.json();
      const resolved = resData.data || {};
      const activeIncubeId = resolved.incubeId || `manual_${Date.now()}`;
      const finalPpNumero = resolved.pp_numero || cleanPp || '—';
      const finalNom = resolved.nom || cleanNom;
      const finalPrenom = resolved.prenom || cleanPrenom;
      const finalEmail = resolved.email || cleanEmail;
      const finalTime = resolved.time || timeStr;

      // 2. Sauvegarde dans le localStorage local pour résilience hors-ligne
      try {
        const presencesStr = localStorage.getItem('ids_ateliers_presences');
        const presences = presencesStr ? JSON.parse(presencesStr) : {};
        if (!presences[id]) presences[id] = {};
        presences[id][activeIncubeId] = {
          present: true,
          time: finalTime,
          nom: finalNom,
          prenom: finalPrenom,
          email: finalEmail,
          pp_numero: finalPpNumero
        };
        localStorage.setItem('ids_ateliers_presences', JSON.stringify(presences));
      } catch (storageErr) {
        console.warn("Erreur sauvegarde locale :", storageErr);
      }

      setSignedData({
        nom: finalNom,
        prenom: finalPrenom,
        email: finalEmail,
        pp_numero: finalPpNumero,
        time: finalTime
      });
      setIsSigned(true);
    } catch (err) {
      console.error("Erreur enregistrement présence :", err);
      setErrorMessage(err.message || "Erreur de connexion au serveur. Veuillez réessayer ou demander au formateur.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-[#02162B] to-[#0A2744] text-white flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md bg-white dark:bg-dark-900 text-slate-900 dark:text-dark-100 rounded-3xl shadow-2xl border border-slate-200 dark:border-dark-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* En-tête officiel Incubateur & Fablab */}
        <div className="bg-gradient-to-r from-[#02162B] to-[#0A2744] p-5 text-white text-center border-b border-[#0A2744]/80">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mx-auto mb-2 text-amber-400 shadow-inner">
            <QrCode size={26} />
          </div>
          <h1 className="text-base sm:text-lg font-black tracking-tight uppercase">
            Feuille d'Émargement Numérique
          </h1>
          <p className="text-[11px] text-slate-300 mt-0.5 font-medium">
            Incubateur Digital Solidaire (IDS) • Fablab & Innovation
          </p>
        </div>

        <div className="p-6 space-y-5">

          {/* =========================================================================
             1. CARTOUCHE DE L'ATELIER : TITRE, FORMATEUR & HORAIRES EXACTS
             ========================================================================= */}
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-[11px] font-extrabold uppercase tracking-wider">
                <GraduationCap size={15} /> Atelier & Formation
              </div>
              {atelierInfo.isOpen ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500 text-white flex items-center gap-1.5 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span> Émargement Ouvert
                </span>
              ) : atelierInfo.isPast ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-500/20 text-red-700 dark:text-red-400 border border-red-500/30 flex items-center gap-1.5">
                  <Lock size={11} /> Clôturé
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                  <Lock size={11} /> En Attente du Début
                </span>
              )}
            </div>

            <h2 className="text-base font-black text-slate-900 dark:text-white leading-snug">
              {atelierInfo.titre}
            </h2>

            {/* Plage horaire exacte : Heure Début - Heure Fin - Durée */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-xs">
              <div className="bg-white/80 dark:bg-dark-800/80 p-2 rounded-xl border border-slate-200 dark:border-dark-700">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">📅 Date</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200">
                  {new Date(atelierInfo.date).toLocaleDateString('fr-FR')}
                </span>
              </div>

              <div className="bg-white/80 dark:bg-dark-800/80 p-2 rounded-xl border border-slate-200 dark:border-dark-700">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">⏰ Horaires</span>
                <span className="font-extrabold text-primary-600 dark:text-primary-400">
                  {atelierInfo.heureDebut} - {atelierInfo.heureFin}
                </span>
              </div>

              <div className="bg-white/80 dark:bg-dark-800/80 p-2 rounded-xl border border-slate-200 dark:border-dark-700 col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">⏱️ Durée</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200">
                  {atelierInfo.duree || '3h00'}
                </span>
              </div>
            </div>
          </div>

          {/* =========================================================================
             CAS 1A : ÉVÉNEMENT TERMINÉ / CLÔTURÉ AUTOMATIQUEMENT (+2H APRÈS FIN)
             ========================================================================= */}
          {atelierInfo.isPast && !atelierInfo.isOpen && !forceShowForm ? (
            <div className="p-6 bg-slate-100 dark:bg-dark-800 border-2 border-dashed border-red-500/30 rounded-3xl text-center space-y-4 animate-in fade-in">
              <div className="w-16 h-16 rounded-2xl bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto shadow-md border border-red-500/20">
                <Lock size={32} />
              </div>
              <div className="space-y-1.5">
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30 inline-block mb-1">
                  ⛔ Émargement Clôturé
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Cet atelier est terminé
                </h3>
                <p className="text-xs text-slate-600 dark:text-dark-300 leading-relaxed max-w-sm mx-auto">
                  La feuille d'émargement est officiellement clôturée car l'événement a eu lieu le <strong>{new Date(atelierInfo.date).toLocaleDateString('fr-FR')}</strong> de <strong>{atelierInfo.heureDebut} à {atelierInfo.heureFin}</strong>.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setForceShowForm(true)}
                  className="btn btn-primary btn-sm w-full py-2.5 px-4 text-xs font-black bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  <User size={14} />
                  <span>Afficher le formulaire d'émargement</span>
                </button>
              </div>
            </div>
          ) : !atelierInfo.isOpen && !forceShowForm ? (
            /* =========================================================================
               CAS 1B : AVANT L'HEURE DE DÉBUT -> CHRONO / COMPTE À REBOURS DYNAMIQUE
               ========================================================================= */
            <div className="p-6 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-2 border-dashed border-amber-500/40 rounded-3xl text-center space-y-4 animate-in fade-in">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-md">
                <Hourglass size={28} className="animate-spin" style={{ animationDuration: '6s' }} />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  L'événement n'a pas encore commencé
                </h3>
                <p className="text-xs text-slate-500 dark:text-dark-400">
                  L'émargement s'ouvrira automatiquement à <strong>{atelierInfo.heureDebut}</strong>.
                </p>
              </div>

              {/* CHRONO / COMPTE À REBOURS DYNAMIQUE */}
              <div className="py-2">
                <p className="text-[11px] font-extrabold uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-2.5">
                  ⏱️ Temps restant avant le début :
                </p>

                <div className="flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap">
                  {/* Jours (si > 0) */}
                  {countdown.days > 0 && (
                    <>
                      <div className="bg-slate-900 dark:bg-black text-white p-2.5 sm:p-3 rounded-2xl min-w-[65px] shadow-lg border border-amber-500/30">
                        <span className="text-xl sm:text-2xl font-black font-mono">
                          {String(countdown.days).padStart(2, '0')}
                        </span>
                        <span className="text-[9px] block text-slate-400 uppercase font-bold mt-0.5">Jours</span>
                      </div>
                      <span className="text-xl sm:text-2xl font-black text-amber-500">:</span>
                    </>
                  )}

                  {/* Heures */}
                  <div className="bg-slate-900 dark:bg-black text-white p-2.5 sm:p-3 rounded-2xl min-w-[65px] shadow-lg border border-amber-500/30">
                    <span className="text-xl sm:text-2xl font-black font-mono">
                      {String(countdown.hours).padStart(2, '0')}
                    </span>
                    <span className="text-[9px] block text-slate-400 uppercase font-bold mt-0.5">Heures</span>
                  </div>

                  <span className="text-xl sm:text-2xl font-black text-amber-500">:</span>

                  {/* Minutes */}
                  <div className="bg-slate-900 dark:bg-black text-white p-2.5 sm:p-3 rounded-2xl min-w-[65px] shadow-lg border border-amber-500/30">
                    <span className="text-xl sm:text-2xl font-black font-mono">
                      {String(countdown.minutes).padStart(2, '0')}
                    </span>
                    <span className="text-[9px] block text-slate-400 uppercase font-bold mt-0.5">Minutes</span>
                  </div>

                  <span className="text-xl sm:text-2xl font-black text-amber-500">:</span>

                  {/* Secondes */}
                  <div className="bg-slate-900 dark:bg-black text-white p-2.5 sm:p-3 rounded-2xl min-w-[65px] shadow-lg border border-amber-500/30">
                    <span className="text-xl sm:text-2xl font-black font-mono text-amber-400">
                      {String(countdown.seconds).padStart(2, '0')}
                    </span>
                    <span className="text-[9px] block text-amber-400/80 uppercase font-bold mt-0.5">Secondes</span>
                  </div>
                </div>
              </div>

              {/* Bouton pour afficher et tester le formulaire */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setForceShowForm(true)}
                  className="btn btn-primary btn-sm w-full py-2.5 px-4 text-xs font-black bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  <User size={14} />
                  <span>Afficher le formulaire d'émargement</span>
                </button>
              </div>
            </div>
          ) : (
            /* =========================================================================
               CAS 2 : PENDANT L'ÉVÉNEMENT (OU EN MODE TEST) -> FORMULAIRE NOM, PRÉNOM, PP
               ========================================================================= */
            !isSigned ? (
              <form onSubmit={handleConfirmPresence} className="space-y-4">
                {forceShowForm && !atelierInfo.isOpen && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-700 dark:text-amber-300 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold">
                      <Sparkles size={14} className="text-amber-500 shrink-0" />
                      <span>Formulaire d'émargement ouvert</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {atelierInfo.isPast ? 'Session passée' : `Début officiel à ${atelierInfo.heureDebut}`}
                    </span>
                  </div>
                )}
                
                <div className="p-4 bg-slate-50 dark:bg-dark-800/80 border border-slate-200 dark:border-dark-700 rounded-2xl space-y-3.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-dark-200 border-b border-slate-200 dark:border-dark-700/60 pb-2">
                    <User size={15} className="text-primary-500" />
                    <span>Renseignez vos informations de présence :</span>
                  </div>

                  {errorMessage && (
                    <div className="p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5 font-semibold">
                      <AlertCircle size={14} className="shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Champ 1 : NOM */}
                  <div>
                    <label className="text-[11px] font-extrabold text-slate-700 dark:text-dark-200 uppercase tracking-wider block mb-1">
                      Nom de Famille <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="ex: BENJELLOUN"
                        value={nom}
                        onChange={(e) => setNom(e.target.value)}
                        className="w-full bg-white dark:bg-dark-900 border border-slate-300 dark:border-dark-700 text-sm font-bold rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white uppercase focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-400 placeholder:normal-case shadow-xs"
                      />
                    </div>
                  </div>

                  {/* Champ 2 : PRÉNOM */}
                  <div>
                    <label className="text-[11px] font-extrabold text-slate-700 dark:text-dark-200 uppercase tracking-wider block mb-1">
                      Prénom <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="ex: Mohamed"
                        value={prenom}
                        onChange={(e) => setPrenom(e.target.value)}
                        className="w-full bg-white dark:bg-dark-900 border border-slate-300 dark:border-dark-700 text-sm font-bold rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-400 shadow-xs"
                      />
                    </div>
                  </div>

                  {/* Champ 3 : EMAIL (OBLIGATOIRE) */}
                  <div>
                    <label className="text-[11px] font-extrabold text-slate-700 dark:text-dark-200 uppercase tracking-wider block mb-1">
                      Adresse Email <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3.5 top-3 text-slate-400" />
                      <input
                        type="email"
                        required
                        placeholder="ex: m.benjelloun@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-white dark:bg-dark-900 border border-slate-300 dark:border-dark-700 text-sm font-bold rounded-xl pl-10 pr-3.5 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-400 lowercase shadow-xs"
                      />
                    </div>
                  </div>

                  {/* Champ 4 : ID PP */}
                  <div>
                    <label className="text-[11px] font-extrabold text-slate-700 dark:text-dark-200 uppercase tracking-wider block mb-1">
                      Identifiant ID PP <span className="text-slate-400 font-normal">(ex: PP-05)</span>
                    </label>
                    <div className="relative">
                      <Hash size={14} className="absolute left-3.5 top-3 text-amber-500" />
                      <input
                        type="text"
                        placeholder="ex: PP-05"
                        value={ppNumero}
                        onChange={(e) => setPpNumero(e.target.value)}
                        className="w-full bg-white dark:bg-dark-900 border border-slate-300 dark:border-dark-700 text-sm font-mono font-bold rounded-xl pl-9 pr-3.5 py-2.5 text-slate-900 dark:text-white uppercase focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-400 shadow-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Bouton de confirmation de présence */}
                <button
                  type="submit"
                  disabled={!isFormValid || isSubmitting}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-sm shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all transform active:scale-98 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <span>Enregistrement en cours...</span>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      <span>Confirmer mon émargement à l'atelier</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* Écran de confirmation après validation */
              <div className="p-5 bg-emerald-500/15 border border-emerald-500/40 rounded-2xl text-center space-y-3 animate-in zoom-in-95">
                <div className="w-14 h-14 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
                  <CheckCircle2 size={32} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-emerald-700 dark:text-emerald-400">
                    Émargement Enregistré avec Succès !
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-dark-300 mt-1">
                    Présence confirmée pour <strong>{signedData?.prenom} {signedData?.nom}</strong> ({signedData?.pp_numero}) à <strong>{signedData?.time}</strong>.
                  </p>
                </div>

                <div className="p-3.5 bg-white dark:bg-dark-900 rounded-xl border border-emerald-500/30 text-xs text-left space-y-1.5 shadow-xs">
                  <div><strong>Atelier :</strong> {atelierInfo.titre}</div>
                  <div><strong>Participant :</strong> {signedData?.nom} {signedData?.prenom}</div>
                  <div><strong>Email :</strong> {signedData?.email}</div>
                  <div><strong>Identifiant :</strong> {signedData?.pp_numero}</div>
                  <div><strong>Heure d'émargement :</strong> {signedData?.time}</div>
                </div>

                <button
                  onClick={() => {
                    setIsSigned(false);
                    setNom('');
                    setPrenom('');
                    setEmail('');
                    setPpNumero('');
                  }}
                  className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer pt-1"
                >
                  Émarger pour un autre participant
                </button>
              </div>
            )
          )}

          <div className="pt-2 border-t border-slate-100 dark:border-dark-700/60 text-center">
            <Link 
              to="/evenements"
              className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft size={13} /> Revenir à l'application Événements
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
