import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  Calendar, 
  Clock, 
  Check, 
  X, 
  Printer, 
  Sparkles,
  CalendarCheck,
  GraduationCap,
  Users,
  Eye,
  Hash,
  ClipboardList,
  ArrowLeft,
  FolderOpen,
  UploadCloud,
  Image,
  Filter,
  UserCheck,
  UserX,
  QrCode,
  Copy,
  Mail,
  Send,
  Bell,
  Lock,
  Unlock,
  Hourglass
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import api, { getPhotoUrl } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import FeuilleEmargementPrint from '../components/common/FeuilleEmargementPrint';
import { exportAtelierPresencesToExcel } from '../utils/excelExport';

const currentYear = new Date().getFullYear();
const todayStr = new Date().toISOString().split('T')[0];
const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

const DEFAULT_FORMATIONS = [
  { id: 1, titre: 'Atelier Business Model Canvas & Proposition de Valeur', formateur: 'M. Benjelloun', intervenant: 'Consultant Fablab', date: todayStr, heureDebut: '10:00', heureFin: '11:30', duree: '1h30', statutOuverture: 'auto' },
  { id: 2, titre: 'Masterclass Stratégie Commerciale & Prospection B2B', formateur: 'Mme. Tazi', intervenant: '', date: tomorrowStr, heureDebut: '10:00', heureFin: '13:00', duree: '3h00', statutOuverture: 'auto' },
  { id: 3, titre: 'Workshop Gestion Financière, Trésorerie & Budget', formateur: 'M. Amrani', intervenant: 'Expert Financier', date: todayStr, heureDebut: '09:00', heureFin: '12:00', duree: '3h00', statutOuverture: 'auto' },
  { id: 4, titre: 'Atelier Pitch Deck & Prise de Parole en Public', formateur: 'Coach IDS', intervenant: '', date: `${currentYear}-10-15`, heureDebut: '09:00', heureFin: '12:30', duree: '3h30', statutOuverture: 'auto' },
  { id: 5, titre: 'Cadre Juridique, Fiscal & Propriété Intellectuelle', formateur: 'Me. Alaoui', intervenant: 'Avocat d\'Affaires', date: `${currentYear}-11-20`, heureDebut: '14:30', heureFin: '18:30', duree: '4h00', statutOuverture: 'auto' }
];

export default function Evenements() {
  const { user, isSuperAdmin } = useAuth();
  const navigate = useNavigate();

  // Liste de tous les incubés pour la feuille d'émargement
  const [allIncubes, setAllIncubes] = useState([]);
  const [loadingIncubes, setLoadingIncubes] = useState(false);
  const [presenceSearch, setPresenceSearch] = useState('');
  const [presenceFilter, setPresenceFilter] = useState('all'); // 'all', 'present', 'absent'

  // État des formations / ateliers
  const [formations, setFormations] = useState([]);
  const [loadingFormations, setLoadingFormations] = useState(true);

  useEffect(() => {
    fetchFormations();
  }, []);

  const fetchFormations = async () => {
    try {
      setLoadingFormations(true);
      const res = await api.get('/ateliers');
      setFormations(res.data || []);
      // Mettre à jour aussi le localStorage en cache si besoin, ou on l'enlève
      localStorage.setItem('ids_ateliers_list', JSON.stringify(res.data || []));
    } catch (err) {
      console.error('Erreur chargement ateliers', err);
      // Fallback au localstorage
      const saved = localStorage.getItem('ids_ateliers_list');
      if (saved) setFormations(JSON.parse(saved));
    } finally {
      setLoadingFormations(false);
    }
  };

  // Filtres ateliers
  const [searchWorkshop, setSearchWorkshop] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'passe', 'a_venir'

  // Atelier actuellement sélectionné pour la VU PAGE DÉTAILLÉE (null = vue liste)
  const [selectedAtelier, setSelectedAtelier] = useState(null);

  // Atelier pour lequel afficher le QR Code dans un modal dédié
  const [qrModalAtelier, setQrModalAtelier] = useState(null);

  // Modal Feuille d'émargement officielle A4 imprimable
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);

  // Modal Ajustement Horaire en temps réel (en cas de retard)
  const [adjustHoraireModal, setAdjustHoraireModal] = useState({
    open: false,
    heureDebut: '09:30',
    heureFin: '12:30',
    date: '',
    statutOuverture: 'auto'
  });

  // URL directe de la feuille d'émargement (avec paramètres d'horaires complets)
  const getAtelierQrUrl = (atelier) => {
    if (!atelier) return '';
    const baseUrl = import.meta.env.VITE_CLOUD_URL || window.location.origin;
    return `${baseUrl}/presence/${atelier.id}?nom_atelier=${encodeURIComponent(atelier.titre || '')}&date=${encodeURIComponent(atelier.date || '')}&heureDebut=${encodeURIComponent(atelier.heureDebut || '09:30')}&heureFin=${encodeURIComponent(atelier.heureFin || '12:30')}&duree=${encodeURIComponent(atelier.duree || '3h00')}`;
  };

  // Modal Ajout Atelier
  const [showAddModal, setShowAddModal] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newFormation, setNewFormation] = useState({
    titre: '',
    formateur: '',
    intervenant: '',
    date: new Date().toISOString().split('T')[0],
    heureDebut: '09:30',
    heureFin: '12:30',
    duree: '3h00',
    description: '',
    envoyerEmail: true,
    targetMode: 'all', // 'all' ou 'selection'
    selectedIncubes: []
  });

  // Sauvegarder dans localStorage
  useEffect(() => {
    try {
      localStorage.setItem('ids_ateliers_list', JSON.stringify(formations));
    } catch (e) {
      console.error(e);
      toast.error("Sauvegarde locale impossible (quota dépassé). Réduisez le nombre de photos.");
    }
  }, [formations]);

  // Déterminer si un atelier est passé ou à venir
  const isAtelierPasse = (dateStr) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    return d < today;
  };

  // Présences reçues du serveur backend (temps réel)
  const [serverPresences, setServerPresences] = useState([]);
  const [serverPresencesAtelierId, setServerPresencesAtelierId] = useState(null);

  // Headers avec token d'authentification
  const getAuthHeaders = () => {
    const token = localStorage.getItem('cgs_token');
    return {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      'Bypass-Tunnel-Reminder': 'true',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  };

  // Polling automatique des présences depuis le backend toutes les 3 secondes quand un atelier est sélectionné
  useEffect(() => {
    if (!selectedAtelier) {
      setServerPresences([]);
      setServerPresencesAtelierId(null);
      return;
    }

    const fetchServerPresences = () => {
      fetch(`/api/presence/atelier/${selectedAtelier.id}`, {
        headers: getAuthHeaders()
      })
        .then(res => {
          if (!res.ok) throw new Error('Erreur synchro');
          return res.json();
        })
        .then(data => {
          if (Array.isArray(data)) {
            setServerPresences(data);
            setServerPresencesAtelierId(selectedAtelier.id);
          }
        })
        .catch(() => {});
    };

    fetchServerPresences();
    const interval = setInterval(fetchServerPresences, 3000);
    return () => clearInterval(interval);
  }, [selectedAtelier]);

  // Récupérer les présences d'un atelier (fusion Local + Serveur Backend)
  const getPresences = (atelierId) => {
    let localList = [];
    try {
      const presencesStr = localStorage.getItem('ids_ateliers_presences');
      if (presencesStr) {
        const presences = JSON.parse(presencesStr);
        const atelierPresences = presences[atelierId];
        if (atelierPresences) {
          localList = Object.entries(atelierPresences).map(([incubeId, data]) => ({
            incubeId,
            ...data
          }));
        }
      }
    } catch {}

    const map = {};
    localList.forEach(p => { map[p.incubeId] = p; });
    if (String(serverPresencesAtelierId) === String(atelierId)) {
      serverPresences.forEach(p => { map[p.incubeId] = p; });
    }

    return Object.values(map);
  };

  // Compter le nombre de présents pour un atelier
  const getPresenceCount = (atelierId) => {
    return getPresences(atelierId).length;
  };

  // Ajouter un nouvel atelier
  const handleAddFormation = async (e) => {
    e.preventDefault();
    if (!newFormation.titre) return;

    setIsSubmitting(true);
    const newId = Date.now();

    // Déterminer la liste des incubés ciblés
    const targetIncubeIds = newFormation.targetMode === 'all'
      ? allIncubes.map(i => i.id)
      : (newFormation.selectedIncubes.length > 0 ? newFormation.selectedIncubes : allIncubes.map(i => i.id));

    const invitedNames = allIncubes
      .filter(i => targetIncubeIds.includes(i.id))
      .map(i => i.nom_incube)
      .filter(Boolean);

    const [hD, mD] = (newFormation.heureDebut || '09:30').split(':').map(Number);
    const [hF, mF] = (newFormation.heureFin || '12:30').split(':').map(Number);
    const diffMin = (hF * 60 + mF) - (hD * 60 + mD);
    if (diffMin <= 0) {
      toast.error("L'heure de fin doit être strictement postérieure à l'heure de début.");
      setIsSubmitting(false);
      return;
    }
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    const dureeCalc = m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h00`;

    const item = {
      titre: newFormation.titre.trim(),
      formateur: newFormation.formateur.trim(),
      intervenant: newFormation.intervenant.trim(),
      date: newFormation.date,
      heureDebut: newFormation.heureDebut || '09:30',
      heureFin: newFormation.heureFin || '12:30',
      duree: dureeCalc,
      description: newFormation.description?.trim() || '',
      statutOuverture: 'auto',
      targetMode: newFormation.targetMode,
      invitedCount: targetIncubeIds.length,
      invitedNames: invitedNames
    };

    let createdId = newId;
    try {
      const res = await api.post('/ateliers', item);
      createdId = res.data.id;
      setFormations([res.data, ...formations]);
      localStorage.setItem('ids_ateliers_list', JSON.stringify([res.data, ...formations]));
    } catch (err) {
      console.error('Erreur creation atelier api:', err);
      // Fallback
      item.id = newId;
      setFormations([item, ...formations]);
      localStorage.setItem('ids_ateliers_list', JSON.stringify([item, ...formations]));
    }

    // Envoi direct des invitations par email si l'option est cochée
    if (newFormation.envoyerEmail && targetIncubeIds.length > 0) {
      try {
        const res = await fetch(`/api/evenements/${newId}/notifier`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            evenement: {
              titre: item.titre,
              formateur: item.formateur,
              intervenant: item.intervenant,
              date: item.date,
              heureDebut: item.heureDebut || '09:30',
              heureFin: item.heureFin || '12:30',
              duree: item.duree || '3h00',
              description: item.description
            },
            incubeIds: newFormation.targetMode === 'all' ? undefined : targetIncubeIds
          })
        });
        const resData = await res.json();
        if (resData.success) {
          toast.success(`🎉 Atelier créé & invitations transmises par email (${resData.sentCount || targetIncubeIds.length} incubé(s)) !`, { duration: 5000 });
        } else {
          toast.success(`Atelier "${item.titre}" planifié avec succès !`);
        }
      } catch (err) {
        console.error("Erreur lors de l'envoi des invitations:", err);
        toast.success(`Atelier "${item.titre}" planifié avec succès !`);
      }
    } else {
      toast.success(`Atelier "${item.titre}" planifié avec succès !`);
    }

    setIsSubmitting(false);
    setShowAddModal(false);
    setNewFormation({
      titre: '',
      formateur: '',
      intervenant: '',
      date: new Date().toISOString().split('T')[0],
      heureDebut: '09:30',
      heureFin: '12:30',
      duree: '3h00',
      description: '',
      envoyerEmail: true,
      targetMode: 'all',
      selectedIncubes: []
    });
    setInviteSearch('');
  };

  // Supprimer un atelier
  const handleDeleteFormation = async (id, e) => {
    if (e) e.stopPropagation();
    if (window.confirm("Supprimer cet atelier de la liste ?")) {
      try {
        await api.delete(`/ateliers/${id}`);
      } catch (err) {
        console.error("Erreur api suppression:", err);
      }
      
      const newFormations = formations.filter(f => f.id !== id);
      setFormations(newFormations);
      localStorage.setItem('ids_ateliers_list', JSON.stringify(newFormations));
      
      if (selectedAtelier?.id === id) {
        setSelectedAtelier(null);
      }
      toast.success("Atelier supprimé");
    }
  };

  // Détection stricte des formations pédagogiques (réservées à la page Formations)
  const isPedagogiqueFormation = (item) => {
    if (!item) return false;
    if (item.description) {
      try {
        const meta = JSON.parse(item.description);
        if (meta && (meta.typeParcours === 'pre-creation' || meta.typeParcours === 'post-creation')) {
          return true;
        }
      } catch (e) {}
    }
    const titre = (item.titre || '').toLowerCase().trim();
    return (
      titre.startsWith('[pré-création]') ||
      titre.startsWith('[pre-creation]') ||
      titre.startsWith('[post-création]') ||
      titre.startsWith('[post-creation]')
    );
  };

  // Liste STRICTE des ateliers et événements IDS (en excluant les formations pédagogiques)
  const ateliersList = useMemo(() => {
    return formations.filter(f => !isPedagogiqueFormation(f));
  }, [formations]);

  // Filtrer les ateliers pour l'affichage
  const displayedFormations = useMemo(() => {
    return ateliersList.filter(f => {
      const matchSearch = !searchWorkshop || 
        f.titre?.toLowerCase().includes(searchWorkshop.toLowerCase()) ||
        f.formateur?.toLowerCase().includes(searchWorkshop.toLowerCase());
      
      const passe = isAtelierPasse(f.date);
      let matchStatus = true;
      if (filterStatus === 'passe') matchStatus = passe;
      if (filterStatus === 'a_venir') matchStatus = !passe;

      return matchSearch && matchStatus;
    });
  }, [ateliersList, searchWorkshop, filterStatus]);

  // Statistiques calculées UNIQUEMENT sur les vrais ateliers/événements
  const stats = useMemo(() => {
    const total = ateliersList.length;
    let passes = 0;
    ateliersList.forEach(f => {
      if (isAtelierPasse(f.date)) passes++;
    });
    const aVenir = total - passes;
    return { total, passes, aVenir };
  }, [ateliersList]);

  // Charger la liste des incubés depuis le backend
  useEffect(() => {
    let isMounted = true;
    const loadIncubes = async () => {
      setLoadingIncubes(true);
      try {
        const res = await api.get('/incubes');
        if (isMounted && Array.isArray(res.data)) {
          setAllIncubes(res.data);
          setLoadingIncubes(false);
          return;
        }
      } catch (err) {
        console.warn("api.get('/incubes') failed, fallback to public endpoint", err);
      }

      try {
        const resPub = await fetch('/api/presence/incubes');
        const data = await resPub.json();
        if (isMounted && Array.isArray(data)) {
          setAllIncubes(data);
        }
      } catch (e) {
        console.error("fetch('/api/presence/incubes') failed", e);
      } finally {
        if (isMounted) {
          setLoadingIncubes(false);
        }
      }
    };
    loadIncubes();
    return () => { isMounted = false; };
  }, []);

  // Basculer la présence d'un incubé (Présent / Absent)
  const handleTogglePresence = async (incube) => {
    if (!selectedAtelier) return;
    const currentPresences = getPresences(selectedAtelier.id);
    const isCurrentlyPresent = currentPresences.some(p => String(p.incubeId) === String(incube.id));
    const newStatus = !isCurrentlyPresent;

    // 1. Mise à jour synchrone dans localStorage
    try {
      const presencesStr = localStorage.getItem('ids_ateliers_presences');
      const presences = presencesStr ? JSON.parse(presencesStr) : {};
      if (!presences[selectedAtelier.id]) {
        presences[selectedAtelier.id] = {};
      }

      if (newStatus) {
        const timeStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        presences[selectedAtelier.id][String(incube.id)] = {
          incubeId: String(incube.id),
          present: true,
          time: timeStr,
          nom: incube.nom_incube?.split(' ')[0] || incube.nom_incube,
          prenom: incube.nom_incube?.split(' ').slice(1).join(' ') || '',
          pp_numero: incube.pp_numero || incube.raison_sociale || '—'
        };
      } else {
        delete presences[selectedAtelier.id][String(incube.id)];
      }
      localStorage.setItem('ids_ateliers_presences', JSON.stringify(presences));
    } catch (e) {
      console.error(e);
    }

    // 2. Synchronisation backend
    try {
      if (newStatus) {
        const timeStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const res = await fetch('/api/presence/enregistrer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            atelierId: selectedAtelier.id,
            incubeId: String(incube.id),
            nom: incube.nom_incube?.split(' ')[0] || incube.nom_incube,
            prenom: incube.nom_incube?.split(' ').slice(1).join(' ') || '',
            pp_numero: incube.pp_numero || incube.raison_sociale || '—',
            time: timeStr,
            present: true
          })
        });
        const resData = await res.json();
        if (resData.data) {
          setServerPresences(prev => [...prev.filter(p => String(p.incubeId) !== String(incube.id)), resData.data]);
        } else {
          setServerPresences(prev => [...prev.filter(p => String(p.incubeId) !== String(incube.id)), {
            incubeId: String(incube.id),
            present: true,
            time: timeStr,
            nom: incube.nom_incube,
            pp_numero: incube.pp_numero
          }]);
        }
        toast.success(`Présence validée : ${incube.nom_incube}`);
      } else {
        await fetch('/api/presence/enregistrer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            atelierId: selectedAtelier.id,
            incubeId: String(incube.id),
            present: false,
            action: 'remove'
          })
        });
        setServerPresences(prev => prev.filter(p => String(p.incubeId) !== String(incube.id)));
        toast(`Absence enregistrée : ${incube.nom_incube}`, { icon: 'ℹ️' });
      }
    } catch (err) {
      if (newStatus) {
        setServerPresences(prev => [...prev.filter(p => String(p.incubeId) !== String(incube.id)), {
          incubeId: String(incube.id),
          present: true,
          time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          nom: incube.nom_incube,
          pp_numero: incube.pp_numero
        }]);
        toast.success(`Présence validée : ${incube.nom_incube}`);
      } else {
        setServerPresences(prev => prev.filter(p => String(p.incubeId) !== String(incube.id)));
        toast(`Absence enregistrée : ${incube.nom_incube}`, { icon: 'ℹ️' });
      }
    }
  };

  // Envoyer convocations & rappels par email à tous les incubés
  const [sendingEmails, setSendingEmails] = useState(false);
  const handleSendConvocations = async () => {
    if (!selectedAtelier) return;
    setSendingEmails(true);
    try {
      const res = await fetch(`/api/evenements/${selectedAtelier.id}/notifier`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          evenement: {
            titre: selectedAtelier.titre,
            formateur: selectedAtelier.formateur,
            date: selectedAtelier.date,
            heureDebut: selectedAtelier.heureDebut || '09:30',
            heureFin: selectedAtelier.heureFin || '12:30',
            duree: selectedAtelier.duree || '3h00',
            description: selectedAtelier.description
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`📧 Convocations transmises avec succès par email (${data.sentCount || allIncubes.length} incubé(s)) !`, { duration: 4000 });
      } else {
        toast.success("Convocations transmises par email !");
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Erreur lors de l'envoi des invitations");
    } finally {
      setSendingEmails(false);
    }
  };

  // Envoyer un email de rappel amical pour l'atelier sélectionné
  const handleSendReminder = async () => {
    if (!selectedAtelier) return;
    setSendingReminder(true);
    try {
      const res = await fetch(`/api/evenements/${selectedAtelier.id}/rappel`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          evenement: {
            titre: selectedAtelier.titre,
            formateur: selectedAtelier.formateur,
            date: selectedAtelier.date,
            heureDebut: selectedAtelier.heureDebut || '09:30',
            heureFin: selectedAtelier.heureFin || '12:30',
            duree: selectedAtelier.duree || '3h00',
            description: selectedAtelier.description
          }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erreur envoi rappel');
      toast.success(data.message || 'Rappels envoyés par email aux participants !', { icon: '🔔' });
    } catch (err) {
      toast.error(err.message || 'Erreur lors de l\'envoi des rappels');
    } finally {
      setSendingReminder(false);
    }
  };

  // Ajuster l'horaire de l'atelier en temps réel (sauvegarde locale + serveur BDD)
  const handleSaveHoraire = async (e) => {
    e.preventDefault();
    if (!selectedAtelier) return;
    try {
      const [hD, mD] = (adjustHoraireModal.heureDebut || '09:30').split(':').map(Number);
      const [hF, mF] = (adjustHoraireModal.heureFin || '12:30').split(':').map(Number);
      const diffMin = (hF * 60 + mF) - (hD * 60 + mD);
      if (diffMin <= 0) {
        toast.error("L'heure de fin doit être strictement postérieure à l'heure de début.");
        return;
      }
      const h = Math.floor(diffMin / 60);
      const m = diffMin % 60;
      const dureeCalc = m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h00`;

      const updated = {
        ...selectedAtelier,
        date: adjustHoraireModal.date,
        heureDebut: adjustHoraireModal.heureDebut,
        heureFin: adjustHoraireModal.heureFin,
        duree: dureeCalc,
        statutOuverture: adjustHoraireModal.statutOuverture
      };

      const res = await fetch(`/api/presence/atelier/${updated.id}/horaire`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          date: updated.date,
          heureDebut: updated.heureDebut,
          heureFin: updated.heureFin,
          duree: dureeCalc,
          statutOuverture: updated.statutOuverture,
          titre: updated.titre,
          formateur: updated.formateur
        })
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      setSelectedAtelier(updated);
      setFormations(prev => prev.map(f => f.id === updated.id ? updated : f));

      toast.success("Horaire et statut d'émargement mis à jour !", { icon: '⏱️' });
      setAdjustHoraireModal({ open: false, heureDebut: '09:30', heureFin: '12:30', date: '', statutOuverture: 'auto' });
    } catch (err) {
      toast.error("Erreur lors de la mise à jour de l'horaire");
    }
  };

  // Forcer l'ouverture / fermeture immédiate du QR Code
  const handleToggleForceOpen = async () => {
    if (!selectedAtelier) return;
    const newStatus = selectedAtelier.statutOuverture === 'ouvert_force' ? 'auto' : 'ouvert_force';
    const updated = { ...selectedAtelier, statutOuverture: newStatus };

    try {
      const res = await fetch(`/api/presence/atelier/${updated.id}/horaire`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          statutOuverture: newStatus,
          heureDebut: updated.heureDebut,
          heureFin: updated.heureFin,
          date: updated.date
        })
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      setSelectedAtelier(updated);
      setFormations(prev => prev.map(f => f.id === updated.id ? updated : f));

      if (newStatus === 'ouvert_force') {
        toast.success("Émargement DÉBLOQUÉ immédiatement pour tous les incubés !", { icon: '🔓' });
      } else {
        toast.success("Mode automatique réactivé (ouverture à l'heure de début).", { icon: '🔒' });
      }
    } catch (err) {
      toast.error("Erreur mise à jour statut ouverture");
    }
  };

  // Marquer tous les incubés présents
  const handleMarkAllPresent = async () => {
    if (!selectedAtelier || allIncubes.length === 0) return;
    if (!window.confirm(`Marquer les ${allIncubes.length} incubés comme présents à cet atelier ?`)) return;

    const timeStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    try {
      const presencesStr = localStorage.getItem('ids_ateliers_presences');
      const presences = presencesStr ? JSON.parse(presencesStr) : {};
      if (!presences[selectedAtelier.id]) presences[selectedAtelier.id] = {};

      allIncubes.forEach(inc => {
        presences[selectedAtelier.id][String(inc.id)] = {
          incubeId: String(inc.id),
          present: true,
          time: timeStr,
          nom: inc.nom_incube?.split(' ')[0] || inc.nom_incube,
          prenom: inc.nom_incube?.split(' ').slice(1).join(' ') || '',
          pp_numero: inc.pp_numero || inc.raison_sociale || '—'
        };
      });
      localStorage.setItem('ids_ateliers_presences', JSON.stringify(presences));
    } catch (e) {}

    try {
      await fetch('/api/presence/bulk', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          atelierId: selectedAtelier.id,
          action: 'all',
          incubes: allIncubes
        })
      });
    } catch (e) {}

    setServerPresences(allIncubes.map(inc => ({
      incubeId: String(inc.id),
      present: true,
      time: timeStr,
      nom: inc.nom_incube,
      pp_numero: inc.pp_numero
    })));

    toast.success("Tous les incubés sont marqués présents !");
  };

  // Réinitialiser toutes les présences
  const handleClearAllPresences = async () => {
    if (!selectedAtelier) return;
    if (!window.confirm("Voulez-vous réinitialiser toutes les présences de cet atelier ?")) return;

    try {
      const presencesStr = localStorage.getItem('ids_ateliers_presences');
      if (presencesStr) {
        const presences = JSON.parse(presencesStr);
        delete presences[selectedAtelier.id];
        localStorage.setItem('ids_ateliers_presences', JSON.stringify(presences));
      }
    } catch (e) {}

    try {
      await fetch('/api/presence/bulk', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          atelierId: selectedAtelier.id,
          action: 'clear'
        })
      });
    } catch (e) {}

    setServerPresences([]);
    toast.success("Toutes les présences ont été réinitialisées");
  };

  /* =========================================================================
     MODAL PARTAGÉ : AFFICHAGE DU QR CODE DE L'ATELIER
     ========================================================================= */
  const renderQrModal = () => {
    if (!qrModalAtelier) return null;
    const atelierUrl = getAtelierQrUrl(qrModalAtelier);

    return (
      <>
        {/* MODAL ÉCRAN */}
        <div 
          className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" 
          onClick={() => setQrModalAtelier(null)}
        >
          <div 
            className="bg-white dark:bg-dark-900 text-slate-900 dark:text-white rounded-3xl border border-slate-200 dark:border-dark-700 shadow-2xl max-w-md w-full overflow-hidden slide-up" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-dark-800 bg-gradient-to-r from-[#02162B] to-[#0A2744] text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
                  <QrCode size={20} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">QR Code de l'Atelier</h3>
                  <p className="text-[11px] text-slate-300">Pointage & Émargement numérique</p>
                </div>
              </div>
              <button 
                onClick={() => setQrModalAtelier(null)} 
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                title="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5 text-center">
              {/* Infos atelier */}
              <div className="space-y-1">
                <h4 className="text-sm font-black text-slate-900 dark:text-white leading-snug">
                  {qrModalAtelier.titre}
                </h4>
                <p className="text-xs text-slate-500 dark:text-dark-400 font-medium">
                  📅 {new Date(qrModalAtelier.date).toLocaleDateString('fr-FR')} &nbsp;•&nbsp; ⏱️ {qrModalAtelier.duree} &nbsp;•&nbsp; 👨‍🏫 {qrModalAtelier.formateur}{qrModalAtelier.intervenant ? ` / ${qrModalAtelier.intervenant}` : ''}
                </p>
              </div>

              {/* QR Code SVG */}
              <div className="p-5 bg-white rounded-3xl border-2 border-dashed border-amber-500/40 inline-block shadow-md mx-auto">
                <QRCodeSVG
                  value={atelierUrl}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>

              {/* Lien direct et bouton copier */}
              <div className="p-3 bg-slate-50 dark:bg-dark-800 rounded-xl border border-slate-200 dark:border-dark-700 text-left space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                  <span>Lien direct d'émargement :</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(atelierUrl);
                      toast.success("Lien copié dans le presse-papier !");
                    }}
                    className="text-primary-600 font-bold hover:underline flex items-center gap-1"
                  >
                    <Copy size={12} /> Copier
                  </button>
                </div>
                <p className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400 break-all bg-white dark:bg-dark-900 p-2 rounded-lg border border-slate-200 dark:border-dark-700">
                  {atelierUrl}
                </p>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn btn-primary py-2.5 text-xs font-bold flex items-center justify-center gap-2 shadow-sm"
                >
                  <Printer size={15} /> Imprimer l'Affiche
                </button>
                <button
                  type="button"
                  onClick={() => setQrModalAtelier(null)}
                  className="btn btn-secondary py-2.5 text-xs font-bold"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION D'IMPRESSION DU QR CODE (VISIBLE UNIQUEMENT LORS DU PRINT QUAND LE MODAL EST OUVERT) */}
        <div className="hidden print:flex printable-qr-only">
          <div className="w-full text-center space-y-4">
            <div className="flex items-center justify-center gap-3 border-b-2 border-slate-900 pb-3">
              <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center p-1">
                <img src="/logo-ids.png" alt="IDS Logo" className="w-full h-full object-contain" />
              </div>
              <div className="text-left">
                <h2 className="text-base font-black uppercase text-slate-900">Incubateur Digital Solidaire</h2>
                <p className="text-xs font-bold text-primary-700">Plateforme IDS &amp; Fablab</p>
              </div>
            </div>

            <div className="space-y-1 pt-2">
              <span className="px-3 py-1 bg-amber-100 text-amber-900 text-xs font-black rounded-lg border border-amber-300 uppercase tracking-wider">
                Feuille de Présence Numérique
              </span>
              <h3 className="text-lg font-black text-slate-900 pt-2">{qrModalAtelier.titre}</h3>
              <p className="text-xs font-semibold text-slate-600">
                📅 {new Date(qrModalAtelier.date).toLocaleDateString('fr-FR')} &nbsp;|&nbsp; ⏱️ {qrModalAtelier.duree} &nbsp;|&nbsp; 👨‍🏫 {qrModalAtelier.formateur}{qrModalAtelier.intervenant ? ` / ${qrModalAtelier.intervenant}` : ''}
              </p>
            </div>

            <div className="p-4 bg-white border-2 border-slate-900 rounded-2xl inline-block my-2">
              <QRCodeSVG
                value={atelierUrl}
                size={250}
                level="H"
                includeMargin={true}
              />
            </div>

            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-900">
                Scannez ce QR Code pour valider votre présence à cet atelier
              </p>
              <p className="text-[10px] font-mono text-slate-500 break-all">
                {atelierUrl}
              </p>
            </div>
          </div>
        </div>
      </>
    );
  };

  /* =========================================================================
     PAGE DÉTAILS D'UN ATELIER (QUAND UN ATELIER EST SÉLECTIONNÉ)
     ========================================================================= */
  if (selectedAtelier) {
    const presencesList = getPresences(selectedAtelier.id);
    const presenceMap = {};
    presencesList.forEach(p => {
      presenceMap[String(p.incubeId)] = p;
    });

    // Identifier les participants ayant signé via QR code qui ne sont pas dans allIncubes
    const knownIncubeIds = new Set(allIncubes.map(i => String(i.id)));
    const extraAttendees = presencesList.filter(p => !knownIncubeIds.has(String(p.incubeId))).map(p => ({
      id: p.incubeId,
      nom_incube: p.nom && p.prenom ? `${p.nom} ${p.prenom}` : (p.nom || 'Participant QR'),
      pp_numero: p.pp_numero || p.ppNumero || '—',
      raison_sociale: 'Porteur de projet',
      email: '',
      telephone: ''
    }));

    const combinedIncubes = [...allIncubes, ...extraAttendees];

    // Liste consolidée pour la feuille d'émargement et l'export Excel
    const emargementList = combinedIncubes.map(inc => {
      const p = presenceMap[String(inc.id)];
      const nomParts = inc.nom_incube ? inc.nom_incube.split(' ') : ['—'];
      const derivedNom = p?.nom && p.nom !== '—' ? p.nom : nomParts[0];
      const derivedPrenom = p?.prenom && p.prenom !== '—' ? p.prenom : (nomParts.slice(1).join(' ') || '');
      return {
        incubeId: inc.id,
        pp_numero: inc.pp_numero || inc.raison_sociale || '—',
        nom: derivedNom || '—',
        prenom: derivedPrenom || '',
        present: !!p,
        time: p ? (p.time || 'Pointé') : '—',
        signedAt: p?.signedAt || (p ? new Date().toISOString() : null)
      };
    });

    const presentCount = presencesList.length;
    const totalCount = combinedIncubes.length;
    const absentCount = Math.max(0, totalCount - presentCount);
    const attendanceRate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

    // Filtrer les incubés selon la recherche et le filtre (Tous / Présents / Absents)
    const filteredIncubes = combinedIncubes.filter(inc => {
      const isPresent = !!presenceMap[String(inc.id)];
      if (presenceFilter === 'present' && !isPresent) return false;
      if (presenceFilter === 'absent' && isPresent) return false;

      if (presenceSearch.trim()) {
        const q = presenceSearch.toLowerCase();
        const matchName = inc.nom_incube?.toLowerCase().includes(q);
        const matchPP = inc.pp_numero?.toLowerCase().includes(q);
        const matchSociale = inc.raison_sociale?.toLowerCase().includes(q);
        const matchEmail = inc.email?.toLowerCase().includes(q);
        if (!matchName && !matchPP && !matchSociale && !matchEmail) return false;
      }
      return true;
    });

    return (
      <>
        {/* VUE ÉCRAN NORMALE (MASQUÉE AUTOMATIQUEMENT LORS DE L'IMPRESSION) */}
        <div className="no-print-on-page print:hidden slide-up space-y-6 w-full pb-12">
          {/* EN-TÊTE ÉPURÉ ET BOUTON RETOUR */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700/60 rounded-2xl shadow-sm">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedAtelier(null)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-dark-800 dark:hover:bg-dark-700 text-slate-700 dark:text-dark-200 font-bold text-xs transition-all shadow-sm shrink-0"
              >
                <ArrowLeft size={16} /> Retour
              </button>
              <div>
                <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug">
                  {selectedAtelier.titre}
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500 dark:text-dark-400 font-medium">
                  <span>📅 {new Date(selectedAtelier.date).toLocaleDateString('fr-FR')}</span>
                  <span>•</span>
                  <span className="font-extrabold text-primary-600 dark:text-primary-400">
                    ⏰ {selectedAtelier.heureDebut || '09:30'} - {selectedAtelier.heureFin || '12:30'}
                  </span>
                  <span>•</span>
                  <span>⏱️ {selectedAtelier.duree || '3h00'}</span>
                  <span>•</span>
                  <span>👨‍🏫 {selectedAtelier.formateur}{selectedAtelier.intervenant ? ` / ${selectedAtelier.intervenant}` : ''}</span>
                  {selectedAtelier.statutOuverture === 'ouvert_force' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500 text-white animate-pulse flex items-center gap-1">
                      <Unlock size={10} /> Émargement Débloqué
                    </span>
                  )}
                </div>
                {selectedAtelier.description && (
                  <div className="mt-2 p-3 rounded-xl bg-slate-50 dark:bg-dark-800/90 border border-slate-200/80 dark:border-dark-700 text-xs text-slate-600 dark:text-dark-300 max-w-2xl">
                    <strong className="text-primary-700 dark:text-primary-300 font-bold block mb-0.5">📝 Description de l'Atelier :</strong>
                    <p className="whitespace-pre-line leading-relaxed">{selectedAtelier.description}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-auto flex-wrap">
              <button
                type="button"
                onClick={() => setAdjustHoraireModal({
                  open: true,
                  heureDebut: selectedAtelier.heureDebut || '09:30',
                  heureFin: selectedAtelier.heureFin || '12:30',
                  date: selectedAtelier.date || new Date().toISOString().split('T')[0],
                  statutOuverture: selectedAtelier.statutOuverture || 'auto'
                })}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-dark-800 dark:hover:bg-dark-700 text-slate-700 dark:text-dark-200 text-xs font-bold transition-all border border-slate-200 dark:border-dark-700 cursor-pointer shadow-sm"
                title="Ajuster l'heure de début ou de fin en cas de retard"
              >
                <Clock size={14} className="text-primary-500" />
                <span>⏱️ Ajuster l'horaire</span>
              </button>

              <button
                type="button"
                onClick={handleToggleForceOpen}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer shadow-sm ${
                  selectedAtelier.statutOuverture === 'ouvert_force'
                    ? 'bg-emerald-500 text-white border-emerald-600'
                    : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30'
                }`}
                title="Débloquer immédiatement le QR code sans attendre l'heure de début"
              >
                {selectedAtelier.statutOuverture === 'ouvert_force' ? (
                  <>
                    <Unlock size={14} /> Émargement Actif
                  </>
                ) : (
                  <>
                    <Lock size={14} /> Débloquer maintenant
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setQrModalAtelier(selectedAtelier)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-bold transition-all border border-amber-500/30 shadow-sm cursor-pointer"
                title="Afficher et imprimer le QR Code de cet atelier"
              >
                <QrCode size={14} /> Voir QR Code
              </button>

              <button
                onClick={() => handleDeleteFormation(selectedAtelier.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold transition-all cursor-pointer"
              >
                <Trash2 size={14} /> Supprimer
              </button>
            </div>
          </div>

          {/* =========================================================================
             1. FEUILLE D'ÉMARGEMENT & GESTION COMPLÈTE DES PRÉSENCES
             ========================================================================= */}
          <div className="card p-6 border border-slate-200 dark:border-dark-700/60 shadow-md space-y-5 bg-white dark:bg-dark-900">
            {/* Titre de section + Indicateurs de participation + Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-dark-800">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shadow-sm shrink-0">
                  <ClipboardList size={22} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    Feuille d'Émargement & Présences
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-dark-400">
                    Cochez ou retirez la présence des incubés pour cet événement
                  </p>
                </div>
              </div>

              {/* Badge indicateur de présence */}
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-black shadow-sm shrink-0">
                <CheckCircle2 size={15} className="text-emerald-600" />
                <span>{presentCount} / {totalCount} Présents</span>
                <span className="text-[11px] opacity-75">({attendanceRate}%)</span>
              </div>
            </div>

            {/* Barre de progression d'assiduité */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-bold text-slate-500 dark:text-dark-400">
                <span>Taux de participation à cet atelier :</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{attendanceRate}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 dark:bg-dark-800 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-dark-700">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                  style={{ width: `${attendanceRate}%` }}
                />
              </div>
            </div>

            {/* Recherche & Filtres rapides + Bouton Imprimer */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2">
              <div className="relative w-full md:w-80">
                <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher un incubé (nom, projet, n° PP)..."
                  value={presenceSearch}
                  onChange={(e) => setPresenceSearch(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-dark-100 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-all shadow-xs"
                />
              </div>

              <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap justify-between md:justify-end">
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setPresenceFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      presenceFilter === 'all'
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                        : 'bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    Tous ({totalCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresenceFilter('present')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                      presenceFilter === 'present'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100'
                    }`}
                  >
                    <CheckCircle2 size={13} /> Présents ({presentCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresenceFilter('absent')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                      presenceFilter === 'absent'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 hover:bg-amber-100'
                    }`}
                  >
                    <X size={13} /> Absents ({absentCount})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSendConvocations}
                  disabled={sendingEmails}
                  className="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs font-bold border border-slate-300 dark:border-dark-700 bg-white dark:bg-dark-800 hover:bg-slate-50 dark:hover:bg-dark-700 text-slate-800 dark:text-slate-100 shadow-sm shrink-0 ml-auto sm:ml-0 transition-all cursor-pointer"
                  title="Envoyer la convocation officielle et le rappel par email à tous les incubés"
                >
                  <Mail size={14} className="text-amber-500" />
                  <span>{sendingEmails ? 'Envoi...' : '📧 Convocations'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSendReminder}
                  disabled={sendingReminder}
                  className="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs font-bold border border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/30 hover:bg-sky-100 dark:hover:bg-sky-900/40 text-sky-800 dark:text-sky-300 shadow-sm shrink-0 transition-all cursor-pointer"
                  title="Envoyer un email de rappel avec le lien d'émargement à tous les participants"
                >
                  <Bell size={14} className="text-sky-600" />
                  <span>{sendingReminder ? 'Envoi...' : '🔔 Rappel'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    exportAtelierPresencesToExcel(selectedAtelier, emargementList);
                    toast.success("Feuille d'émargement exportée en Excel (.xlsx) !", { icon: '📊' });
                  }}
                  className="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs font-bold border border-emerald-500/30 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 shadow-sm shrink-0 transition-all cursor-pointer"
                  title="Télécharger la feuille d'émargement au format Excel (.xlsx)"
                >
                  <span>📊 Exporter (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPrintModal(true)}
                  className="btn btn-primary btn-sm flex items-center gap-1.5 text-xs font-bold shadow-md shadow-primary-500/20 shrink-0 cursor-pointer"
                  title="Afficher la feuille d'émargement officielle A4 pour impression ou enregistrement PDF"
                >
                  <Printer size={14} /> Feuille d'émargement (PDF)
                </button>
              </div>
            </div>

            {/* Tableau interactif des incubés pour pointage */}
            <div className="table-container rounded-2xl border border-slate-200 dark:border-dark-700/60 overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-dark-300 border-b border-slate-200 dark:border-dark-700/60 text-[11px]">
                    <th className="py-3 px-4 font-bold w-12 text-center">#</th>
                    <th className="py-3 px-4 font-bold">Incubé / Porteur de projet</th>
                    <th className="py-3 px-4 font-bold">N° ID PP / Projet</th>
                    <th className="py-3 px-4 font-bold text-center w-36">Statut</th>
                    <th className="py-3 px-4 font-bold text-center w-40">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-dark-800">
                  {loadingIncubes ? (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-slate-400">
                        Chargement de la liste des incubés...
                      </td>
                    </tr>
                  ) : filteredIncubes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-slate-400">
                        <Users size={32} className="mx-auto mb-2 text-slate-300 dark:text-dark-600" />
                        <p className="font-bold text-sm">Aucun incubé trouvé pour ce filtre</p>
                      </td>
                    </tr>
                  ) : (
                    filteredIncubes.map((inc, idx) => {
                      const presence = presenceMap[String(inc.id)];
                      const isPresent = !!presence;
                      return (
                        <tr 
                          key={inc.id}
                          className={`transition-colors ${
                            isPresent 
                              ? 'bg-emerald-500/5 hover:bg-emerald-500/10 dark:bg-emerald-950/10' 
                              : 'hover:bg-slate-50 dark:hover:bg-dark-800/40'
                          }`}
                        >
                          <td className="py-3 px-4 text-center text-slate-400 font-bold text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              {inc.photo_path ? (
                                <img 
                                  src={getPhotoUrl(inc.photo_path)} 
                                  alt={inc.nom_incube} 
                                  className="w-8 h-8 rounded-xl object-cover shrink-0 border border-slate-200 dark:border-dark-700" 
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
                                  {inc.nom_incube?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </div>
                              )}
                              <div>
                                <p className="font-extrabold text-slate-900 dark:text-dark-100 text-xs">{inc.nom_incube}</p>
                                <p className="text-[11px] text-slate-500 dark:text-dark-400">{inc.email || inc.telephone || '—'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-slate-700 dark:text-dark-300">
                                <Hash size={11} className="text-amber-500" /> {inc.pp_numero || '—'}
                              </span>
                              <p className="text-[11px] text-slate-500 dark:text-dark-400 font-medium truncate max-w-[220px]">
                                {inc.raison_sociale || 'Porteur de projet'}
                              </p>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isPresent ? (
                              <div className="inline-flex flex-col items-center">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-extrabold text-[11px] border border-emerald-500/30">
                                  <CheckCircle2 size={12} /> Présent
                                </span>
                                {presence.time && (
                                  <span className="text-[10px] text-slate-400 mt-0.5 font-medium">
                                    à {presence.time}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-dark-800 text-slate-500 dark:text-slate-400 font-bold text-[11px]">
                                <X size={12} /> Absent
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleTogglePresence(inc)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 w-full max-w-[140px] mx-auto shadow-sm ${
                                isPresent
                                  ? 'bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/30 dark:hover:bg-red-900/40 dark:text-red-400 border border-red-200 dark:border-red-900/50'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              }`}
                            >
                              {isPresent ? (
                                <>
                                  <X size={13} /> Retirer
                                </>
                              ) : (
                                <>
                                  <Check size={13} /> Valider présence
                                </>
                              )}
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

          {/* =========================================================================
             2. DOCUMENTS & GALERIE DE L'ATELIER (GOOGLE DRIVE + PHOTOS)
             ========================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* LIEN GOOGLE DRIVE OFFICIEL */}
            <div className="card p-5 rounded-2xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-xs">
                  <FolderOpen size={16} className="text-amber-500" />
                  <span>Dossier Partagé Google Drive (Lien externe)</span>
                </div>
                {selectedAtelier.drive_link && (
                  <a
                    href={selectedAtelier.drive_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <span>📁 Ouvrir le dossier</span>
                  </a>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="Coller l'URL du dossier Google Drive (ex: https://drive.google.com/drive/folders/...)"
                  className="flex-1 input !py-2 !text-xs font-mono"
                  value={selectedAtelier.drive_link || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    const updated = { ...selectedAtelier, drive_link: val };
                    setSelectedAtelier(updated);
                    setFormations(prev => prev.map(f => f.id === updated.id ? updated : f));
                  }}
                />
                <button
                  type="button"
                  onClick={() => toast.success("Lien Google Drive sauvegardé !")}
                  className="btn btn-secondary text-xs px-3.5 py-2 font-bold shrink-0"
                >
                  Enregistrer
                </button>
              </div>
            </div>

            {/* GALERIE PHOTOS & DRAG AND DROP */}
            <div className="card p-5 rounded-2xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-xs">
                  <Image size={16} className="text-primary-500" />
                  <span>Galerie Photos de l'Atelier ({selectedAtelier.photos?.length || 0} photo(s))</span>
                </div>
              </div>

              {/* ZONE DRAG & DROP */}
              <label 
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                  if (files.length === 0) return;
                  
                  files.forEach(file => {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const dataUrl = event.target.result;
                      setSelectedAtelier(prev => {
                        const existingPhotos = prev.photos || [];
                        const updated = { ...prev, photos: [...existingPhotos, dataUrl] };
                        setFormations(all => all.map(f => f.id === updated.id ? updated : f));
                        return updated;
                      });
                    };
                    reader.readAsDataURL(file);
                  });
                  toast.success(`${files.length} photo(s) ajoutée(s) !`);
                }}
                className="border-2 border-dashed border-primary-500/40 hover:border-primary-500 dark:border-dark-600 rounded-2xl p-4 text-center flex flex-col items-center justify-center cursor-pointer bg-primary-500/5 transition-colors"
              >
                <UploadCloud size={24} className="text-primary-500 mb-1" />
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Glissez vos photos d'atelier ici ou cliquez
                </p>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
                    files.forEach(file => {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const dataUrl = event.target.result;
                        setSelectedAtelier(prev => {
                          const existingPhotos = prev.photos || [];
                          const updated = { ...prev, photos: [...existingPhotos, dataUrl] };
                          setFormations(all => all.map(f => f.id === updated.id ? updated : f));
                          return updated;
                        });
                      };
                      reader.readAsDataURL(file);
                    });
                    if (files.length > 0) toast.success(`${files.length} photo(s) ajoutée(s) !`);
                  }}
                />
              </label>

              {/* GRILLE D'AFFICHAGE DES PHOTOS */}
              {selectedAtelier.photos && selectedAtelier.photos.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 pt-1">
                  {selectedAtelier.photos.map((imgUrl, pIdx) => (
                    <div key={pIdx} className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-dark-700 aspect-video bg-black">
                      <img src={imgUrl} alt={`Photo ${pIdx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAtelier(prev => {
                            const newPhotos = prev.photos.filter((_, i) => i !== pIdx);
                            const updated = { ...prev, photos: newPhotos };
                            setFormations(all => all.map(f => f.id === updated.id ? updated : f));
                            return updated;
                          });
                          toast.success("Photo supprimée");
                        }}
                        className="absolute top-1 right-1 p-1 rounded-lg bg-black/60 text-white hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                        title="Supprimer la photo"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* =========================================================================
           FEUILLE D'ÉMARGEMENT OFFICIELLE IMPRIMABLE (SEULEMENT VISIBLE À L'IMPRESSION)
           ========================================================================= */}
        <div className="hidden print:flex text-slate-900 bg-white w-full mx-auto print-emargement-container">
          <div className="space-y-4 w-full">
            {/* En-tête IDS avec Logo & Titre */}
            <div className="w-full flex items-center justify-between pb-3 border-b-2 border-slate-900">
              <div className="flex items-center gap-3 text-left">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center p-1 shrink-0">
                  <img src="/logo-ids.png" alt="IDS Logo" className="w-full h-full object-contain rounded-lg" />
                </div>
                <div>
                  <h1 className="text-lg font-black uppercase tracking-wider text-slate-900">Incubateur Digital Solidaire</h1>
                  <p className="text-xs font-bold text-primary-700">Plateforme IDS &amp; Fablab</p>
                  <p className="text-[10px] font-mono text-slate-500">Code Atelier : IDS-ATELIER-{selectedAtelier.id}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[11px] font-black rounded-lg border border-emerald-300">
                  FEUILLE DE PRÉSENCE OFFICIELLE
                </span>
              </div>
            </div>

            {/* Informations Atelier */}
            <div className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-left space-y-1">
              <h2 className="text-base font-black text-slate-900">{selectedAtelier.titre}</h2>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 pt-0.5">
                <span>📅 Date : {new Date(selectedAtelier.date).toLocaleDateString('fr-FR')}</span>
                <span>⏱️ Durée : {selectedAtelier.duree}</span>
                <span>👨‍🏫 Formateur : {selectedAtelier.formateur}{selectedAtelier.intervenant ? ` / ${selectedAtelier.intervenant}` : ''}</span>
                <span>👥 Présents : {presentCount} / {totalCount} ({attendanceRate}%)</span>
              </div>
            </div>

            {/* Tableau d'émargement imprimable */}
            <table className="w-full text-left text-xs border border-slate-300 border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                  <th className="py-2 px-3 border-r border-slate-300 w-10 text-center">#</th>
                  <th className="py-2 px-3 border-r border-slate-300">Nom & Prénom de l'Incubé</th>
                  <th className="py-2 px-3 border-r border-slate-300">N° Porteur de Projet / Société</th>
                  <th className="py-2 px-3 border-r border-slate-300 text-center w-28">Heure Pointage</th>
                  <th className="py-2 px-3 text-center w-36">Signature</th>
                </tr>
              </thead>
              <tbody>
                {combinedIncubes.map((inc, idx) => {
                  const presence = presenceMap[String(inc.id)];
                  return (
                    <tr key={inc.id} className="border-b border-slate-200">
                      <td className="py-2 px-3 border-r border-slate-200 text-center font-bold">{idx + 1}</td>
                      <td className="py-2 px-3 border-r border-slate-200 font-bold">{inc.nom_incube}</td>
                      <td className="py-2 px-3 border-r border-slate-200 font-mono text-[11px]">{inc.pp_numero || inc.raison_sociale || '—'}</td>
                      <td className="py-2 px-3 border-r border-slate-200 text-center font-semibold text-emerald-800">
                        {presence ? `Présent (${presence.time})` : 'Absent'}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {presence ? '✓ Validé' : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pied de page officiel FIXÉ SUR TOUTES LES PAGES */}
          <div className="print-emargement-footer">
            <span>Incubateur Digital Solidaire — Document officiel d'émargement</span>
            <span>Date d'édition : {new Date().toLocaleDateString('fr-FR')}</span>
          </div>
        </div>

        {/* Modal d'affichage du QR Code */}
        {renderQrModal()}

        {/* Modal Feuille d'émargement officielle A4 imprimable */}
        <FeuilleEmargementPrint
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          atelier={selectedAtelier}
          presences={emargementList}
        />
      </>
    );
  }

  /* =========================================================================
     PAGE LISTE DES ATELIERS (VUE PAR DÉFAUT)
     ========================================================================= */
  return (
    <div className="slide-up space-y-6 w-full pb-10">


      {/* 2. STATS RAPIDES */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 border border-slate-200 dark:border-dark-700/60 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
            <CalendarCheck size={22} />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-dark-400 font-semibold uppercase tracking-wider">Total Ateliers</p>
            <p className="text-2xl font-black text-slate-900 dark:text-dark-100 mt-0.5">
              {stats.total} <span className="text-xs font-semibold text-slate-400">sessions</span>
            </p>
          </div>
        </div>

        <div className="card p-4 border border-slate-200 dark:border-dark-700/60 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <GraduationCap size={22} />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-dark-400 font-semibold uppercase tracking-wider">Sessions Passées</p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
              {stats.passes} <span className="text-xs font-semibold text-slate-400">terminées</span>
            </p>
          </div>
        </div>

        <div className="card p-4 border border-slate-200 dark:border-dark-700/60 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <Sparkles size={22} />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-dark-400 font-semibold uppercase tracking-wider">Sessions À Venir</p>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
              {stats.aVenir} <span className="text-xs font-semibold text-slate-400">programmées</span>
            </p>
          </div>
        </div>
      </div>

      {/* 3. BARRE DE RECHERCHE, FILTRES ET BOUTON PLANIFIER UN ATELIER */}
      <div className="card p-4 border border-slate-200 dark:border-dark-700/60 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-1">
          <div className="relative w-full sm:w-80">
            <Search size={15} className="absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par nom d'atelier ou formateur..."
              value={searchWorkshop}
              onChange={(e) => setSearchWorkshop(e.target.value)}
              className="input !py-2 !pl-9 !text-xs w-full bg-slate-50 dark:bg-dark-900 border-slate-300 dark:border-dark-700"
            />
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-dark-800 rounded-xl w-full sm:w-auto justify-center sm:justify-start">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterStatus === 'all'
                  ? 'bg-white dark:bg-dark-900 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-slate-600 dark:text-dark-400 hover:text-slate-900'
              }`}
            >
              Tous ({ateliersList.length})
            </button>
            <button
              onClick={() => setFilterStatus('passe')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterStatus === 'passe'
                  ? 'bg-white dark:bg-dark-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-600 dark:text-dark-400 hover:text-slate-900'
              }`}
            >
              Passés ({stats.passes})
            </button>
            <button
              onClick={() => setFilterStatus('a_venir')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterStatus === 'a_venir'
                  ? 'bg-white dark:bg-dark-900 text-amber-600 dark:text-amber-400 shadow-sm'
                  : 'text-slate-600 dark:text-dark-400 hover:text-slate-900'
              }`}
            >
              À venir ({stats.aVenir})
            </button>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary text-xs py-2.5 px-4 flex items-center gap-2 font-bold shadow-md shadow-primary-500/20 shrink-0 w-full sm:w-auto justify-center"
        >
          <Plus size={16} /> Planifier un atelier
        </button>
      </div>

      {/* 4. GRILLE DES ATELIERS */}
      {displayedFormations.length === 0 ? (
        <div className="card text-center py-16 border border-dashed border-slate-300 dark:border-dark-700">
          <Calendar size={40} className="mx-auto text-slate-400 mb-2" />
          <p className="text-sm font-bold text-slate-700 dark:text-dark-200">Aucun atelier trouvé</p>
          <p className="text-xs text-slate-500 mt-1">Modifiez vos critères de recherche ou planifiez une nouvelle session.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedFormations.map((f) => {
            const passe = isAtelierPasse(f.date);
            const nbPresents = getPresenceCount(f.id);

            return (
              <div 
                key={f.id} 
                onClick={() => setSelectedAtelier(f)}
                className={`p-5 rounded-2xl border transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer ${
                  passe
                    ? 'bg-emerald-500/[0.04] border-emerald-500/30 dark:bg-emerald-950/20 hover:border-emerald-500/60'
                    : 'bg-white dark:bg-dark-900/60 border-slate-200 dark:border-dark-700/60 hover:border-primary-500/60'
                } flex flex-col justify-between group`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-primary-600 dark:text-primary-400 text-[11px] font-extrabold uppercase tracking-wider mb-1">
                        <GraduationCap size={14} className="shrink-0" />
                        <span>Nom de l'atelier</span>
                      </div>
                      <h4 className="text-base font-black text-slate-900 dark:text-dark-100 leading-snug group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {f.titre}
                      </h4>
                    </div>
                    
                    <div className="flex items-center gap-1.5 shrink-0">
                      {passe ? (
                        <span className="badge badge-green shrink-0 flex items-center gap-1">
                          <Check size={12} /> Passé
                        </span>
                      ) : (
                        <span className="badge badge-gray shrink-0">
                          À venir
                        </span>
                      )}

                      <button
                        onClick={(e) => handleDeleteFormation(f.id, e)}
                        title="Supprimer cet atelier"
                        className="p-1 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3.5 flex flex-wrap items-center gap-3.5 text-xs text-slate-600 dark:text-dark-300">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Calendar size={13} className="text-slate-400" /> {new Date(f.date).toLocaleDateString('fr-FR')}
                    </span>
                    <span className="flex items-center gap-1.5 font-extrabold text-primary-600 dark:text-primary-400">
                      <Clock size={13} /> {f.heureDebut || '09:30'} - {f.heureFin || '12:30'}
                    </span>
                    <span className="flex items-center gap-1.5 font-medium text-slate-500">
                      <Clock size={13} className="text-slate-400" /> {f.duree || '3h00'}
                    </span>
                    <span className="flex items-center gap-1.5 truncate font-medium text-slate-700 dark:text-dark-200">
                      <GraduationCap size={13} className="text-slate-400" /> {f.formateur}{f.intervenant ? ` / ${f.intervenant}` : ''}
                    </span>
                  </div>

                  {f.description && (
                    <p className="mt-2.5 text-xs text-slate-600 dark:text-dark-300 line-clamp-2 leading-relaxed bg-slate-50/80 dark:bg-dark-800/60 p-2 rounded-xl border border-slate-200/60 dark:border-dark-700/60">
                      {f.description}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-dark-700/40 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {/* Compteur de présents */}
                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${
                      nbPresents > 0
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-100 dark:bg-dark-800 text-slate-500 dark:text-dark-400'
                    }`}>
                      <Users size={12} /> {nbPresents} présent{nbPresents !== 1 ? 's' : ''}
                    </span>

                    {/* Badge nombre d'invités */}
                    {f.invitedCount ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        ✉️ {f.invitedCount} invité{f.invitedCount > 1 ? 's' : ''}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Bouton Voir QR Code (ouvre le modal dédié) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setQrModalAtelier(f);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-bold transition-all border border-amber-500/30 shadow-sm"
                      title="Afficher et imprimer le QR Code de cet atelier"
                    >
                      <QrCode size={14} /> Voir QR Code
                    </button>

                    {/* Bouton Détails & Feuille d'émargement */}
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-500/10 group-hover:bg-primary-500/20 text-primary-700 dark:text-primary-300 text-xs font-bold transition-all border border-primary-500/30 shadow-sm">
                      <Eye size={14} /> Feuille d'Émargement
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. MODAL AJOUT D'UN ATELIER */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => !isSubmitting && setShowAddModal(false)}>
          <div className="modal slide-up max-w-lg max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header border-b border-slate-100 dark:border-dark-800 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold">
                  <GraduationCap size={20} />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-dark-100">Planifier un atelier / formation</h3>
                  <p className="text-[11px] text-slate-500 dark:text-dark-400">Créez l'événement et envoyez directement les invitations</p>
                </div>
              </div>
              <button 
                onClick={() => !isSubmitting && setShowAddModal(false)} 
                className="btn btn-secondary btn-icon btn-sm"
                disabled={isSubmitting}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddFormation} className="flex flex-col flex-1 overflow-hidden">
              <div className="modal-body space-y-4 overflow-y-auto p-5 flex-1 custom-scrollbar">
                <div>
                  <label className="label">Nom de l'atelier *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Atelier Business Model Canvas & Proposition de Valeur"
                    className="input font-semibold"
                    value={newFormation.titre}
                    onChange={(e) => setNewFormation({ ...newFormation, titre: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Formateur</label>
                    <input
                      type="text"
                      placeholder="Ex: M. Benjelloun"
                      className="input"
                      value={newFormation.formateur}
                      onChange={(e) => setNewFormation({ ...newFormation, formateur: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Intervenant</label>
                    <input
                      type="text"
                      placeholder="Ex: Consultant Fablab"
                      className="input"
                      value={newFormation.intervenant}
                      onChange={(e) => setNewFormation({ ...newFormation, intervenant: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label">Date de la session *</label>
                    <input
                      type="date"
                      required
                      className="input"
                      value={newFormation.date}
                      onChange={(e) => setNewFormation({ ...newFormation, date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Heure Début *</label>
                    <input
                      type="time"
                      required
                      className="input font-mono font-bold"
                      value={newFormation.heureDebut || '09:30'}
                      onChange={(e) => {
                        const hD = e.target.value;
                        const hF = newFormation.heureFin || '12:30';
                        const [hdH, hdM] = hD.split(':').map(Number);
                        const [hfH, hfM] = hF.split(':').map(Number);
                        let diff = (hfH * 60 + hfM) - (hdH * 60 + hdM);
                        if (diff <= 0) diff = 180;
                        const h = Math.floor(diff / 60);
                        const m = diff % 60;
                        const dStr = m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h00`;
                        setNewFormation({ ...newFormation, heureDebut: hD, duree: dStr });
                      }}
                    />
                  </div>
                  <div>
                    <label className="label">Heure Fin *</label>
                    <input
                      type="time"
                      required
                      className="input font-mono font-bold"
                      value={newFormation.heureFin || '12:30'}
                      onChange={(e) => {
                        const hF = e.target.value;
                        const hD = newFormation.heureDebut || '09:30';
                        const [hdH, hdM] = hD.split(':').map(Number);
                        const [hfH, hfM] = hF.split(':').map(Number);
                        let diff = (hfH * 60 + hfM) - (hdH * 60 + hdM);
                        if (diff <= 0) diff = 180;
                        const h = Math.floor(diff / 60);
                        const m = diff % 60;
                        const dStr = m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h00`;
                        setNewFormation({ ...newFormation, heureFin: hF, duree: dStr });
                      }}
                    />
                  </div>
                </div>

                {/* CHAMP DESCRIPTION DE L'ATELIER */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="label mb-0">Petite description de l'atelier</label>
                    <span className="text-[11px] text-slate-400">Optionnel</span>
                  </div>
                  <textarea
                    rows="3"
                    placeholder="Résumez en quelques lignes les objectifs de l'atelier, les sujets abordés et les prérequis..."
                    className="input resize-none text-xs leading-relaxed"
                    value={newFormation.description}
                    onChange={(e) => setNewFormation({ ...newFormation, description: e.target.value })}
                  />
                </div>

                {/* ENVOI DIRECT D'INVITATION EMAIL */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-primary-500/[0.04] to-indigo-500/[0.04] border border-primary-500/20 dark:border-primary-500/30 space-y-3">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newFormation.envoyerEmail}
                      onChange={(e) => setNewFormation({ ...newFormation, envoyerEmail: e.target.checked })}
                      className="mt-0.5 w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-slate-300 dark:border-dark-600"
                    />
                    <div>
                      <span className="block text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Mail size={14} className="text-primary-600 dark:text-primary-400" />
                        Envoyer directement l'invitation par email aux incubés
                      </span>
                      <span className="block text-[11px] text-slate-500 dark:text-dark-400 mt-0.5">
                        Une invitation personnalisée contenant la description, les horaires et le lien d'émargement leur sera transmise immédiatement.
                      </span>
                    </div>
                  </label>

                  {newFormation.envoyerEmail && (
                    <div className="pt-2.5 border-t border-slate-200/80 dark:border-dark-700/80 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 dark:text-dark-300">
                          Sélection des invités :
                        </span>
                        <span className="text-[11px] font-extrabold text-primary-600 dark:text-primary-400">
                          {newFormation.targetMode === 'all'
                            ? `${allIncubes.length} incubé(s) (Promotion entière)`
                            : `${newFormation.selectedIncubes.length} incubé(s) sélectionné(s)`}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setNewFormation({ ...newFormation, targetMode: 'all' })}
                          className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                            newFormation.targetMode === 'all'
                              ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                              : 'bg-white dark:bg-dark-900 border-slate-200 dark:border-dark-700 text-slate-600 dark:text-dark-400 hover:bg-slate-50'
                          }`}
                        >
                          <Users size={13} /> Tous ({allIncubes.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNewFormation(prev => ({
                              ...prev,
                              targetMode: 'selection',
                              selectedIncubes: prev.selectedIncubes.length > 0 ? prev.selectedIncubes : allIncubes.map(i => i.id)
                            }));
                          }}
                          className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                            newFormation.targetMode === 'selection'
                              ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                              : 'bg-white dark:bg-dark-900 border-slate-200 dark:border-dark-700 text-slate-600 dark:text-dark-400 hover:bg-slate-50'
                          }`}
                        >
                          <UserCheck size={13} /> Choisir les invités
                        </button>
                      </div>

                      {newFormation.targetMode === 'selection' && (
                        <div className="p-3 bg-white dark:bg-dark-900 rounded-xl border border-slate-200 dark:border-dark-700 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="relative flex-1">
                              <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                              <input
                                type="text"
                                placeholder="Filtrer par nom d'incubé..."
                                value={inviteSearch}
                                onChange={(e) => setInviteSearch(e.target.value)}
                                className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 text-slate-800 dark:text-dark-200 focus:outline-none focus:border-primary-500"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (newFormation.selectedIncubes.length === allIncubes.length) {
                                  setNewFormation({ ...newFormation, selectedIncubes: [] });
                                } else {
                                  setNewFormation({ ...newFormation, selectedIncubes: allIncubes.map(i => i.id) });
                                }
                              }}
                              className="text-[11px] font-bold text-primary-600 dark:text-primary-400 hover:underline shrink-0"
                            >
                              {newFormation.selectedIncubes.length === allIncubes.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                            </button>
                          </div>

                          <div className="max-h-40 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                            {allIncubes
                              .filter(inc => !inviteSearch || inc.nom_incube?.toLowerCase().includes(inviteSearch.toLowerCase()))
                              .map(inc => {
                                const isChecked = newFormation.selectedIncubes.includes(inc.id);
                                return (
                                  <label
                                    key={inc.id}
                                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                                      isChecked
                                        ? 'bg-primary-50/80 dark:bg-primary-950/30 text-primary-900 dark:text-primary-200 font-semibold'
                                        : 'hover:bg-slate-50 dark:hover:bg-dark-800 text-slate-700 dark:text-dark-300'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          const next = isChecked
                                            ? newFormation.selectedIncubes.filter(id => id !== inc.id)
                                            : [...newFormation.selectedIncubes, inc.id];
                                          setNewFormation({ ...newFormation, selectedIncubes: next });
                                        }}
                                        className="rounded text-primary-600 focus:ring-primary-500 border-slate-300 w-3.5 h-3.5"
                                      />
                                      <span className="truncate">{inc.nom_incube}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-2">
                                      {inc.email || 'Sans email'}
                                    </span>
                                  </label>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer border-t border-slate-100 dark:border-dark-800 p-4 shrink-0 bg-slate-50/50 dark:bg-dark-900/50">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)} 
                  className="btn btn-secondary text-xs" 
                  disabled={isSubmitting}
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary text-xs font-bold" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                      Création & Envoi des invitations...
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Plus size={15} /> Créer {newFormation.envoyerEmail ? '& Inviter' : "l'atelier"}
                    </span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL AJUSTEMENT HORAIRE (ADMIN) */}
      {adjustHoraireModal.open && (
        <div className="modal-overlay" onClick={() => setAdjustHoraireModal({ ...adjustHoraireModal, open: false })}>
          <div className="modal slide-up max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header border-b border-slate-100 dark:border-dark-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold">
                  <Clock size={20} />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-dark-100">Ajuster l'horaire de l'atelier</h3>
                  <p className="text-[11px] text-slate-500 dark:text-dark-400">Modifiez les horaires en cas de retard ou d'avance</p>
                </div>
              </div>
              <button 
                onClick={() => setAdjustHoraireModal({ ...adjustHoraireModal, open: false })} 
                className="btn btn-secondary btn-icon btn-sm cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveHoraire} className="p-5 space-y-4">
              <div>
                <label className="label">Date de l'atelier</label>
                <input
                  type="date"
                  required
                  className="input"
                  value={adjustHoraireModal.date}
                  onChange={(e) => setAdjustHoraireModal({ ...adjustHoraireModal, date: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Heure Début (Exacte) *</label>
                  <input
                    type="time"
                    required
                    className="input font-mono font-bold text-sm"
                    value={adjustHoraireModal.heureDebut}
                    onChange={(e) => setAdjustHoraireModal({ ...adjustHoraireModal, heureDebut: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Heure Fin *</label>
                  <input
                    type="time"
                    required
                    className="input font-mono font-bold text-sm"
                    value={adjustHoraireModal.heureFin}
                    onChange={(e) => setAdjustHoraireModal({ ...adjustHoraireModal, heureFin: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="label">Statut d'ouverture du QR Code</label>
                <select
                  className="input font-bold text-xs"
                  value={adjustHoraireModal.statutOuverture}
                  onChange={(e) => setAdjustHoraireModal({ ...adjustHoraireModal, statutOuverture: e.target.value })}
                >
                  <option value="auto">⏱️ Automatique (Ouverture à l'heure de début)</option>
                  <option value="ouvert_force">🔓 Débloqué immédiatement (Forcer l'ouverture)</option>
                  <option value="cloture">🔒 Clôturé (Émargement terminé)</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  En mode « Débloqué immédiatement », tout incubé scannant le QR code accèdera directement au formulaire même si l'heure n'est pas encore atteinte.
                </p>
              </div>

              <div className="modal-footer border-t border-slate-100 dark:border-dark-800 pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustHoraireModal({ ...adjustHoraireModal, open: false })}
                  className="btn btn-secondary text-xs cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn btn-primary text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-primary-500/20"
                >
                  <Check size={14} /> Enregistrer & Mettre à jour
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal d'affichage du QR Code */}
      {renderQrModal()}
    </div>
  );
}
