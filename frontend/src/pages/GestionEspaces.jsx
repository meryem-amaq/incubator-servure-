import { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  QrCode, 
  Check, 
  X, 
  Clock, 
  Calendar, 
  User, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  Trash2, 
  ShieldCheck, 
  Copy, 
  Printer, 
  Wrench,
  Camera,
  Users,
  Mail,
  AlertCircle,
  Sparkles,
  Info,
  Search,
  Edit3,
  ChevronDown,
  AlertTriangle,
  Upload,
  Eye,
  Image as ImageIcon,
  Bell
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_EQUIPEMENTS } from '../data/equipementsEspaces';
import { exportReservationsToExcel, exportEquipementsToExcel } from '../utils/excelExport';

const ESPACES = [
  { 
    id: 'fablab', 
    nom: 'Espace Fablab', 
    desc: 'Atelier Fablab 1 (Étage) & Sous-sol • Prototypage, Impression 3D & Fraisage CNC',
    salles: ['Fablab 1', 'Sous-sol']
  },
  { 
    id: 'studio', 
    nom: 'Studio Média / Photo', 
    desc: 'Plateau tournage, Caméras 4K, Micros studio & Podcasting',
    salles: ['Studio Média']
  },
  { 
    id: 'salle_reunion', 
    nom: 'Salles & Formation', 
    desc: 'Salle 1, Salle 2 & Salle de formation • Écrans interactifs 4K & Visioconférence',
    salles: ['Salle 1', 'Salle 2', 'Salle de formation']
  }
];

export const ETATS_AVANT = [
  { value: 'Opérationnel / Parfait état', label: '🟢 Bon état / Opérationnel' },
  { value: 'Bon état / Prêt à l\'emploi', label: '🔵 Bon état / Prêt à l\'emploi' },
  { value: 'Légère usure / À surveiller', label: '🟡 Légère usure / À surveiller' },
  { value: 'En maintenance / Bloqué', label: '🔴 En maintenance / Panne' }
];

export const ETATS_APRES = [
  { value: 'Conforme & Rendu propre', label: '🟢 Conforme & Rendu propre' },
  { value: 'Vérifié & Restitué', label: '🔵 Vérifié & Restitué' },
  { value: 'À nettoyer / Entretien requis', label: '🟡 À nettoyer / Entretien requis' },
  { value: 'Dégradé / Dysfonctionnement', label: '🔴 Dégradé / Dysfonctionnement' },
  { value: 'Non utilisé', label: '⚪ Non utilisé' }
];

export default function GestionEspaces() {
  const { user, isSuperAdmin } = useAuth();
  const [selectedEspace, setSelectedEspace] = useState('fablab');
  const currentEsp = useMemo(() => ESPACES.find(e => e.id === selectedEspace) || ESPACES[0], [selectedEspace]);
  const [selectedSousSalleFilter, setSelectedSousSalleFilter] = useState('all');
  const [qrSousSalle, setQrSousSalle] = useState('all');
  const [activeTab, setActiveTab] = useState('demandes'); // 'demandes', 'materiel', 'qr'
  
  // Demandes de réservations & états
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notifyEmailDefault, setNotifyEmailDefault] = useState(true);
  const [refusModal, setRefusModal] = useState({ open: false, reservationId: null, motif: '', notifyEmail: true });
  const [detailsModal, setDetailsModal] = useState({ open: false, reservation: null });
  const [etatModal, setEtatModal] = useState({ 
    open: false, 
    reservationId: null, 
    nomIncube: '', 
    emailIncube: '', 
    telephoneIncube: '', 
    dateReservation: '', 
    heureDebut: '', 
    heureFin: '', 
    salleSpecifique: '',
    equipementsUtilises: '', 
    etatAvant: '', 
    etatApres: '' 
  });

  const [resSearch, setResSearch] = useState('');
  const [resStatusFilter, setResStatusFilter] = useState('all'); // 'all', 'en_attente', 'valide', 'refuse'
  const [resMoisFilter, setResMoisFilter] = useState('all'); // 'all' ou 'YYYY-MM'

  // Modal de réservation directe par l'administrateur
  const [adminBookingModal, setAdminBookingModal] = useState({
    open: false,
    espace: 'fablab',
    salleSpecifique: '',
    dateReservation: new Date().toISOString().split('T')[0],
    heureDebut: '09:00',
    heureFin: '12:00',
    duree: '3h',
    motifUtilisation: 'Réservation administrative / Équipe IDS',
    equipementsUtilises: '',
    nomPersonnalise: ''
  });

  const handleCreateAdminReservation = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/reservations/directe', adminBookingModal);
      toast.success(res.data?.message || 'Réservation administrative validée !', { icon: '✅' });
      setAdminBookingModal({
        open: false,
        espace: selectedEspace,
        salleSpecifique: '',
        dateReservation: new Date().toISOString().split('T')[0],
        heureDebut: '09:00',
        heureFin: '12:00',
        duree: '3h',
        motifUtilisation: 'Réservation administrative / Équipe IDS',
        equipementsUtilises: '',
        nomPersonnalise: ''
      });
      fetchReservations();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de la réservation directe');
    }
  };

  // Liste des mois présents dans l'historique des réservations
  const availableReservationMonths = useMemo(() => {
    const set = new Set();
    const currMonth = new Date().toISOString().substring(0, 7);
    set.add(currMonth);
    reservations.forEach(r => {
      if (r.dateReservation && r.dateReservation.length >= 7) {
        set.add(r.dateReservation.substring(0, 7));
      }
    });
    return Array.from(set).sort().reverse();
  }, [reservations]);
  const [problemModal, setProblemModal] = useState({
    open: false,
    equipementId: null,
    equipementNom: '',
    espace: '',
    titre: '',
    description: '',
    gravite: 'majeur', // 'mineur', 'majeur', 'bloquant'
    photo: null,
    photoName: ''
  });

  // Modal de Consultation & Résolution d'un Incident avec Photo Agrandie
  const [viewProblemModal, setViewProblemModal] = useState({
    open: false,
    equipement: null,
    espace: '',
    incident: null
  });

  // Formulaire d'ajout d'équipement par l'administrateur
  const [newEquipement, setNewEquipement] = useState({
    nom: '',
    numeroSerie: '',
    categorie: 'Général',
    salle: '',
    etatAvant: 'Opérationnel / Parfait état'
  });

  const handleOpenEtatModal = (res) => {
    setEtatModal({
      open: true,
      reservationId: res.id,
      nomIncube: res.nomIncube,
      emailIncube: res.emailIncube,
      telephoneIncube: res.telephoneIncube,
      dateReservation: res.dateReservation,
      heureDebut: res.heureDebut,
      heureFin: res.heureFin,
      salleSpecifique: res.salleSpecifique || '',
      equipementsUtilises: res.equipementsUtilises,
      etatAvant: res.etatAvant || '',
      etatApres: res.etatApres || ''
    });
  };

  // Horloge en temps réel pour actualiser l'occupation des espaces
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(new Date());
    }, 15000); // Actualisation toutes les 15 secondes
    return () => clearInterval(timer);
  }, []);

  // Informations d'état et d'occupation pour chaque espace (Qui a réservé ?)
  const getEspaceStatusInfo = (espaceId) => {
    const espRes = reservations.filter(r => r.espace === espaceId);
    
    // Date et heure courantes au format local YYYY-MM-DD et HH:mm
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    
    const curHours = String(currentDate.getHours()).padStart(2, '0');
    const curMins = String(currentDate.getMinutes()).padStart(2, '0');
    const curTimeStr = `${curHours}:${curMins}`;

    // 1. Réservation RÉELLEMENT EN COURS (Validée, Date = Aujourd'hui, et heureDebut <= maintenant <= heureFin)
    const activeNow = espRes.find(r => {
      if (r.statut !== 'valide' || r.dateReservation !== todayStr) return false;
      const debut = (r.heureDebut || '').trim();
      const fin = (r.heureFin || '').trim();
      if (!debut || !fin) return false;
      return curTimeStr >= debut && curTimeStr <= fin;
    });

    const pendingCount = espRes.filter(r => r.statut === 'en_attente').length;
    
    // 2. Prochaine réservation à venir :
    // - soit aujourd'hui mais à une heure future (debut > curTimeStr)
    // - soit un jour futur (dateReservation > todayStr)
    const upcoming = espRes
      .filter(r => {
        if (r.statut !== 'valide') return false;
        if (r.dateReservation > todayStr) return true;
        if (r.dateReservation === todayStr) {
          const debut = (r.heureDebut || '').trim();
          return debut > curTimeStr;
        }
        return false;
      })
      .sort((a, b) => {
        const aKey = `${a.dateReservation}T${(a.heureDebut || '00:00').trim()}`;
        const bKey = `${b.dateReservation}T${(b.heureDebut || '00:00').trim()}`;
        return aKey.localeCompare(bKey);
      })[0];

    return { activeNow, pendingCount, nextRes: upcoming, totalCount: espRes.length };
  };

  // Équipements par espace (avec état avant et après la réservation)
  const [equipements, setEquipements] = useState(() => {
    try {
      const saved = localStorage.getItem('ids_equipements_espaces');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Normaliser les données existantes
        Object.keys(parsed).forEach(k => {
          if (Array.isArray(parsed[k])) {
            parsed[k] = parsed[k].map(item => ({
              ...item,
              numeroSerie: item.numeroSerie || item.serie || '',
              etatAvant: item.etatAvant || item.etat || 'Opérationnel / Parfait état',
              etatApres: item.etatApres || 'Conforme & Rendu propre'
            }));
          }
        });
        return parsed;
      }
      return DEFAULT_EQUIPEMENTS;
    } catch {
      return DEFAULT_EQUIPEMENTS;
    }
  });

  // Charger les réservations depuis le backend API
  const fetchReservations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reservations');
      if (Array.isArray(res.data)) setReservations(res.data);
    } catch (err) {
      console.error('Erreur chargement réservations:', err);
    } finally {
      setLoading(false);
    }
  };

  // Charger les équipements depuis le backend API (BDD)
  const fetchEquipements = async () => {
    try {
      const res = await api.get('/equipements-espaces');
      if (res.data && typeof res.data === 'object') {
        setEquipements(res.data);
        localStorage.setItem('ids_equipements_espaces', JSON.stringify(res.data));
      }
    } catch (err) {
      console.error('Erreur chargement équipements:', err);
    }
  };

  useEffect(() => {
    fetchReservations();
    fetchEquipements();
  }, []);

  // Vérifier l'unicité du numéro de série
  const findEquipmentBySerial = (serial, excludeId = null) => {
    if (!serial || !String(serial).trim()) return null;
    const target = String(serial).trim().toLowerCase();
    for (const espKey of Object.keys(equipements)) {
      const list = equipements[espKey] || [];
      const found = list.find(eq => eq.id !== excludeId && eq.numeroSerie && String(eq.numeroSerie).trim().toLowerCase() === target);
      if (found) return { equipment: found, espace: espKey };
    }
    return null;
  };

  // Ajouter un équipement dans l'espace sélectionné (Admin)
  const handleAddEquipement = async (e) => {
    e.preventDefault();
    if (!newEquipement.nom.trim()) return;

    const candidateSerial = newEquipement.numeroSerie.trim() || `SN-${selectedEspace.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    const duplicate = findEquipmentBySerial(candidateSerial);
    if (duplicate) {
      toast.error(`Le numéro de série "${candidateSerial}" est déjà utilisé par "${duplicate.equipment.nom}".`);
      return;
    }

    try {
      const res = await api.post('/equipements-espaces', {
        espace: selectedEspace,
        nom: newEquipement.nom.trim(),
        numeroSerie: candidateSerial,
        categorie: newEquipement.categorie || 'Général',
        salle: newEquipement.salle || '',
        etatAvant: newEquipement.etatAvant || 'Opérationnel / Parfait état',
        etatApres: 'Conforme & Rendu propre'
      });

      toast.success(`Équipement "${res.data?.data?.nom || newEquipement.nom}" ajouté à ${selectedEspace.toUpperCase()} !`);
      setNewEquipement({ 
        nom: '', 
        numeroSerie: '', 
        categorie: 'Général', 
        salle: '',
        etatAvant: 'Opérationnel / Parfait état' 
      });
      fetchEquipements();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur ajout équipement");
    }
  };

  // Mettre à jour un champ ou l'état d'un équipement en BDD
  const handleUpdateEquipementField = async (espaceId, id, field, value, showToast = true) => {
    if (field === 'numeroSerie' && value && String(value).trim()) {
      const duplicate = findEquipmentBySerial(value, id);
      if (duplicate) {
        toast.error(`Le numéro de série "${String(value).trim()}" est déjà attribué à "${duplicate.equipment.nom}".`);
        return;
      }
    }

    // Mise à jour optimiste dans le state React
    setEquipements(prev => ({
      ...prev,
      [espaceId]: (prev[espaceId] || []).map(eq => eq.id === id ? { ...eq, [field]: value } : eq)
    }));

    try {
      await api.put(`/equipements-espaces/${id}`, { [field]: value });
      if (showToast) {
        toast.success(field === 'numeroSerie' ? "N° de série enregistré !" : "État du matériel enregistré !");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur mise à jour équipement");
      fetchEquipements();
    }
  };

  // Supprimer un équipement en BDD
  const handleDeleteEquipement = async (espaceId, id) => {
    if (!window.confirm("Voulez-vous vraiment supprimer cet équipement ?")) return;

    try {
      await api.delete(`/equipements-espaces/${id}`);
      toast.success("Équipement supprimé avec succès !");
      fetchEquipements();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur suppression équipement");
    }
  };

  // Ouvrir le modal pour signaler un problème avec photo
  const handleOpenProblemModal = (eq) => {
    setProblemModal({
      open: true,
      equipementId: eq.id,
      equipementNom: eq.nom,
      espace: selectedEspace,
      titre: '',
      description: '',
      gravite: 'majeur',
      photo: null,
      photoName: ''
    });
  };

  // Ouvrir le modal pour signaler un problème constaté par un incubé avant utilisation
  const handleOpenProblemModalForReservation = (res) => {
    const listEq = equipements[res.espace] || [];
    const matchedEq = listEq.find(e => 
      res.equipementsUtilises && (
        res.equipementsUtilises.toLowerCase().includes(e.nom.toLowerCase()) ||
        e.nom.toLowerCase().includes(res.equipementsUtilises.toLowerCase())
      )
    ) || listEq[0] || { id: res.id, nom: res.equipementsUtilises || 'Matériel de l\'espace' };

    setProblemModal({
      open: true,
      equipementId: matchedEq.id,
      equipementNom: `${matchedEq.nom} (Constaté par ${res.nomIncube})`,
      espace: res.espace,
      titre: 'Problème constaté avant utilisation',
      description: '',
      gravite: 'majeur',
      photo: null,
      photoName: ''
    });
  };

  // Traitement et compression d'image pour le problème (Base64 JPEG)
  const handleProblemImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image valide (JPG, PNG, WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 800;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const optimizedBase64 = canvas.toDataURL('image/jpeg', 0.8);
        setProblemModal(prev => ({
          ...prev,
          photo: optimizedBase64,
          photoName: file.name
        }));
        toast.success("Photo du problème chargée avec succès !");
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Enregistrer le signalement de problème avec photo en BDD
  const handleSaveProblem = async (e) => {
    e.preventDefault();
    if (!problemModal.description.trim()) {
      toast.error('Veuillez décrire le problème rencontré.');
      return;
    }

    try {
      await api.post(`/equipements-espaces/${problemModal.equipementId}/incidents`, {
        titre: problemModal.titre.trim() || 'Panne matériel',
        description: problemModal.description.trim(),
        gravite: problemModal.gravite,
        photo: problemModal.photo,
        signalePar: user?.nom ? `${user.prenom || ''} ${user.nom}`.trim() : 'Responsable Espace'
      });

      toast.success('Problème et photo enregistrés !', { icon: '⚠️' });
      setProblemModal({
        open: false,
        equipementId: null,
        equipementNom: '',
        espace: '',
        titre: '',
        description: '',
        gravite: 'majeur',
        photo: null,
        photoName: ''
      });
      fetchEquipements();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur enregistrement problème");
    }
  };

  // Ouvrir les détails et la photo agrandie du problème
  const handleOpenViewProblemModal = (eq) => {
    const activeIncident = (eq.incidents || []).find(inc => !inc.resolu) || (eq.incidents || [])[0];
    setViewProblemModal({
      open: true,
      equipement: eq,
      espace: selectedEspace,
      incident: activeIncident
    });
  };

  // Marquer l'incident comme résolu / réparé en BDD
  const handleResoudreIncident = async (espaceKey, equipementId, incidentId = null) => {
    try {
      const incId = incidentId || viewProblemModal.incident?.id;
      if (incId) {
        await api.put(`/equipements-espaces/${equipementId}/incidents/${incId}/resoudre`);
      }
      toast.success('Matériel remis en bon état : incident résolu !', { icon: '✅' });
      setViewProblemModal({ open: false, equipement: null, espace: '', incident: null });
      fetchEquipements();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur résolution incident");
    }
  };

  // Valider une demande de réservation (Envoi d'email automatique)
  const handleValiderReservation = async (id, notify = notifyEmailDefault) => {
    try {
      const res = await api.put(`/reservations/${id}/valider`, {
        statut: 'valide',
        notifyEmail: notify
      });
      const emailMsg = res.data?.emailNotification?.sent ? " • Email de confirmation transmis !" : "";
      toast.success(`Réservation VALIDÉE !${emailMsg}`);
      fetchReservations();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur validation");
    }
  };

  // Refuser une demande de réservation avec motif (Envoi d'email automatique)
  const handleRefuserReservation = async () => {
    if (!refusModal.motif.trim()) {
      toast.error("Veuillez indiquer le motif du refus !");
      return;
    }

    const notify = refusModal.notifyEmail !== false;

    try {
      const res = await api.put(`/reservations/${refusModal.reservationId}/valider`, { 
        statut: 'refuse', 
        motifRefus: refusModal.motif.trim(),
        notifyEmail: notify
      });
      const emailMsg = res.data?.emailNotification?.sent ? " • Email d'explication transmis !" : "";
      toast.success(`Réservation REFUSÉE !${emailMsg}`);
      setRefusModal({ open: false, reservationId: null, motif: '', notifyEmail: true });
      fetchReservations();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur refus");
    }
  };

  // Enregistrer l'état Avant / Après utilisation
  const handleSaveEtat = async () => {
    try {
      await api.put(`/reservations/${etatModal.reservationId}/etat`, {
        etatAvant: etatModal.etatAvant,
        etatApres: etatModal.etatApres
      });
      toast.success("Fiche d'état du matériel enregistrée avec succès !");
      setEtatModal({ open: false, reservationId: null, etatAvant: '', etatApres: '' });
      fetchReservations();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur enregistrement état");
    }
  };

  // URL directe du QR Code de Réservation pour un espace (avec sous-salle facultative)
  const getEspaceQrUrl = (espaceId, sousSalle = null) => {
    if (sousSalle && sousSalle !== 'all') {
      return `${window.location.origin}/reserver-espace/${espaceId}?salle=${encodeURIComponent(sousSalle)}`;
    }
    return `${window.location.origin}/reserver-espace/${espaceId}`;
  };

  const filteredReservations = reservations.filter(r => {
    if (r.espace !== selectedEspace) return false;
    if (selectedSousSalleFilter !== 'all') {
      if (r.salleSpecifique) {
        return r.salleSpecifique === selectedSousSalleFilter;
      }
      const currentEsp = ESPACES.find(e => e.id === selectedEspace);
      return selectedSousSalleFilter === currentEsp?.salles?.[0];
    }
    return true;
  });

  return (
    <div className="slide-up space-y-6 w-full pb-12">


      {/* SÉLECTEUR D'ESPACES (FABLAB / STUDIO / SALLE DE RÉUNION) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ESPACES.map(esp => {
          const statusInfo = getEspaceStatusInfo(esp.id);
          return (
            <button
              key={esp.id}
              onClick={() => {
                setSelectedEspace(esp.id);
                setSelectedSousSalleFilter('all');
                setQrSousSalle('all');
              }}
              className={`card p-5 text-left border-2 transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                selectedEspace === esp.id
                  ? 'border-primary-500 bg-primary-500/10 dark:bg-primary-500/10 shadow-lg scale-[1.02]'
                  : 'border-slate-200 dark:border-dark-700/60 hover:border-slate-300 dark:hover:border-dark-600'
              }`}
            >
              <div>
                <div className="flex items-center justify-end mb-2">
                  <div className="flex items-center gap-1.5">
                    {statusInfo.pendingCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500 text-white animate-pulse">
                        {statusInfo.pendingCount} En attente
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                      selectedEspace === esp.id
                        ? 'bg-primary-500 text-[#001633] font-bold'
                        : 'bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-dark-300'
                    }`}>
                      {statusInfo.totalCount} rés.
                    </span>
                  </div>
                </div>
                <h3 className="font-black text-slate-900 dark:text-white text-base">
                  {esp.nom}
                </h3>
                <p className="text-xs text-slate-500 dark:text-dark-400 mt-1 leading-relaxed">
                  {esp.desc}
                </p>
              </div>

              {/* STATUT D'OCCUPATION : QUI A RÉSERVÉ L'ESPACE ? */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-dark-800 text-xs">
                {statusInfo.activeNow ? (
                  <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-bold">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 animate-ping"></span>
                    <span className="truncate">
                      Occupé {statusInfo.activeNow.salleSpecifique ? `(${statusInfo.activeNow.salleSpecifique})` : ''} par <strong className="underline">{statusInfo.activeNow.nomIncube}</strong> ({statusInfo.activeNow.heureDebut}-{statusInfo.activeNow.heureFin})
                    </span>
                  </div>
                ) : statusInfo.nextRes ? (
                  <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium">
                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
                    <span className="truncate">
                      Prochaine rés. : <strong>{statusInfo.nextRes.nomIncube}</strong> ({
                        statusInfo.nextRes.dateReservation === `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`
                          ? `Aujourd'hui à ${statusInfo.nextRes.heureDebut}`
                          : `${new Date(statusInfo.nextRes.dateReservation).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à ${statusInfo.nextRes.heureDebut}`
                      })
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                    <span>Espace actuellement libre</span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* BARRE D'ACTION UNIFIÉE SUR UNE SEULE LIGNE (ONGLETS + RECHERCHE & FILTRES) */}
      <div className="flex flex-col xl:flex-row items-center justify-between gap-3 border-b border-slate-200 dark:border-dark-700 pb-2.5">
        {/* SOUS-ONGLETS À GAUCHE */}
        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
          <button
            onClick={() => setActiveTab('demandes')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'demandes'
                ? 'bg-gradient-to-r from-primary-400 to-primary-500 text-[#001633] shadow-md shadow-primary-500/25 border border-primary-300/40'
                : 'bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-dark-300 hover:bg-slate-200 dark:hover:bg-dark-700/60'
            }`}
          >
            <Calendar size={14} /> Réservation des Personnes ({filteredReservations.length})
          </button>

          <button
            onClick={() => setActiveTab('materiel')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'materiel'
                ? 'bg-gradient-to-r from-primary-400 to-primary-500 text-[#001633] shadow-md shadow-primary-500/25 border border-primary-300/40'
                : 'bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-dark-300 hover:bg-slate-200 dark:hover:bg-dark-700/60'
            }`}
          >
            <Plus size={14} /> Matériel de l'Espace ({(equipements[selectedEspace] || []).length})
          </button>

          <button
            onClick={() => setActiveTab('etat_materiel')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'etat_materiel'
                ? 'bg-gradient-to-r from-primary-400 to-primary-500 text-[#001633] shadow-md shadow-primary-500/25 border border-primary-300/40'
                : 'bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-dark-300 hover:bg-slate-200 dark:hover:bg-dark-700/60'
            }`}
          >
            <Wrench size={14} /> État du Matériel
          </button>

          <button
            onClick={() => setActiveTab('qr')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'qr'
                ? 'bg-gradient-to-r from-primary-400 to-primary-500 text-[#001633] shadow-md shadow-primary-500/25 border border-primary-300/40'
                : 'bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-dark-300 hover:bg-slate-200 dark:hover:bg-dark-700/60'
            }`}
          >
            <QrCode size={14} /> QR Code Officiel
          </button>
        </div>

        {/* RECHERCHE ET LISTES DÉROULANTES À DROITE (SUR LA MÊME LIGNE) QUAND ON EST SUR L'ONGLET RÉSERVATIONS */}
        {activeTab === 'demandes' && (
          <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto justify-start xl:justify-end">
            {/* 1. RECHERCHE INCUBÉ / MOTIF */}
            <div className="relative w-full sm:w-48 xl:w-56">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher incubé, motif..."
                value={resSearch}
                onChange={(e) => setResSearch(e.target.value)}
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-primary-500 transition-colors"
              />
            </div>

            {/* 2. LISTE DÉROULANTE ZONE / SALLE */}
            {(() => {
              const currentEsp = ESPACES.find(e => e.id === selectedEspace);
              if (!currentEsp?.salles || currentEsp.salles.length <= 1) return null;
              return (
                <div className="relative w-full sm:w-44">
                  <select
                    value={selectedSousSalleFilter}
                    onChange={(e) => setSelectedSousSalleFilter(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl pl-3 pr-8 py-1.5 text-xs font-bold text-slate-700 dark:text-dark-200 outline-none focus:border-primary-500 cursor-pointer appearance-none"
                  >
                    <option value="all">
                      Toutes les salles ({reservations.filter(r => r.espace === selectedEspace).length})
                    </option>
                    {currentEsp.salles.map(s => {
                      const count = reservations.filter(r => 
                        r.espace === selectedEspace && 
                        (r.salleSpecifique === s || (!r.salleSpecifique && s === currentEsp.salles[0]))
                      ).length;
                      return (
                        <option key={s} value={s}>
                          {s} ({count})
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              );
            })()}

            {/* 3. LISTE DÉROULANTE STATUT */}
            <div className="relative w-full sm:w-40">
              <select
                value={resStatusFilter}
                onChange={(e) => setResStatusFilter(e.target.value)}
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl pl-3 pr-8 py-1.5 text-xs font-bold text-slate-700 dark:text-dark-200 outline-none focus:border-primary-500 cursor-pointer appearance-none"
              >
                <option value="all">
                  Tous les statuts ({filteredReservations.length})
                </option>
                <option value="en_attente">
                  En attente ({filteredReservations.filter(r => r.statut === 'en_attente').length})
                </option>
                <option value="valide">
                  Validées ({filteredReservations.filter(r => r.statut === 'valide').length})
                </option>
                <option value="refuse">
                  Refusées ({filteredReservations.filter(r => r.statut === 'refuse').length})
                </option>
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* 3b. LISTE DÉROULANTE HISTORIQUE / MOIS */}
            <div className="relative w-full sm:w-44">
              <select
                value={resMoisFilter}
                onChange={(e) => setResMoisFilter(e.target.value)}
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl pl-3 pr-8 py-1.5 text-xs font-bold text-slate-700 dark:text-dark-200 outline-none focus:border-primary-500 cursor-pointer appearance-none"
              >
                <option value="all">Historique complet</option>
                {availableReservationMonths.map(mStr => {
                  const [y, m] = mStr.split('-');
                  const d = new Date(Number(y), Number(m) - 1, 1);
                  const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
                  const formatted = label.charAt(0).toUpperCase() + label.slice(1);
                  return (
                    <option key={mStr} value={mStr}>
                      {formatted}
                    </option>
                  );
                })}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* 4. BOUTON EXPORT EXCEL (.XLSX) */}
            <button
              type="button"
              onClick={() => {
                const currentEsp = ESPACES.find(e => e.id === selectedEspace);
                exportReservationsToExcel(displayedReservations, currentEsp?.nom || selectedEspace);
                toast.success("Réservations exportées en Excel (.xlsx) !", { icon: '📊' });
              }}
              className="btn btn-secondary py-1.5 px-3 rounded-xl text-xs font-bold border border-emerald-500/30 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 shadow-xs cursor-pointer transition-all shrink-0"
              title="Exporter les réservations en fichier Excel (.xlsx)"
            >
              <span>📊 Exporter (.xlsx)</span>
            </button>

            {/* 5. BOUTON NOUVELLE RÉSERVATION DIRECTE ADMIN */}
            <button
              type="button"
              onClick={() => {
                const currentEsp = ESPACES.find(e => e.id === selectedEspace);
                setAdminBookingModal({
                  open: true,
                  espace: selectedEspace,
                  salleSpecifique: selectedSousSalleFilter !== 'all' ? selectedSousSalleFilter : (currentEsp?.salles?.[0] || ''),
                  dateReservation: new Date().toISOString().split('T')[0],
                  heureDebut: '09:00',
                  heureFin: '12:00',
                  duree: '3h',
                  motifUtilisation: 'Réservation administrative / Équipe IDS',
                  equipementsUtilises: '',
                  nomPersonnalise: user?.nom ? `${user.prenom || ''} ${user.nom} (Admin)`.trim() : 'Administration'
                });
              }}
              className="btn py-1.5 px-3 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white flex items-center gap-1.5 shadow-sm shadow-emerald-500/25 cursor-pointer transition-all shrink-0 border border-emerald-400/30"
              title="Créer une réservation directe immédiate pour l'administration"
            >
              <Plus size={14} /> Réserver pour l'Admin
            </button>
          </div>
        )}
      </div>

      {/* =========================================================================
         ONGLET 1 : SUIVI DES RÉSERVATIONS & ÉTAT DU MATÉRIEL
         ========================================================================= */}
      {activeTab === 'demandes' && (() => {
        const displayedReservations = filteredReservations.filter(r => {
          if (resStatusFilter !== 'all' && r.statut !== resStatusFilter) return false;
          if (resMoisFilter !== 'all' && (!r.dateReservation || !r.dateReservation.startsWith(resMoisFilter))) return false;
          if (resSearch.trim()) {
            const q = resSearch.toLowerCase();
            const mNom = r.nomIncube?.toLowerCase().includes(q);
            const mMat = r.equipementsUtilises?.toLowerCase().includes(q);
            const mMotif = r.motifUtilisation?.toLowerCase().includes(q);
            if (!mNom && !mMat && !mMotif) return false;
          }
          return true;
        });

        return (
          <div className="space-y-4">
            {/* VUE TABLEAU SYNTHÉTIQUE ET STRUCTURÉ DES RÉSERVATIONS */}
            <div className="card p-0 border border-slate-200 dark:border-dark-700/60 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-dark-700/60 bg-slate-50 dark:bg-dark-800/60 text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
                        <th className="py-3 px-3 w-8 text-center">#</th>
                        <th className="py-3 px-3">Personne ayant réservé</th>
                        <th className="py-3 px-3">Date & Créneau</th>
                        <th className="py-3 px-3">Matériel Demandé & Motif</th>
                        <th className="py-3 px-3 text-center">Statut & Décision</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-dark-800/60">
                      {displayedReservations.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-400">
                            <User size={32} className="mx-auto mb-2 opacity-40" />
                            <p className="font-bold text-sm">Aucune réservation trouvée pour ce critère</p>
                          </td>
                        </tr>
                      ) : (
                        displayedReservations.map((res, idx) => (
                          <tr key={res.id} className="hover:bg-slate-50 dark:hover:bg-dark-800/40 transition-colors">
                            <td className="py-3 px-3 font-mono font-bold text-slate-400 text-center">{idx + 1}</td>
                            
                            {/* 1. Personne qui a réservé */}
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-slate-900 text-white dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                                  <User size={14} />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <p 
                                      className="font-black text-slate-900 dark:text-white text-xs truncate max-w-[150px] cursor-pointer hover:underline hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                      onClick={() => setDetailsModal({ open: true, reservation: res })}
                                      title="Voir les détails de la personne et de la réservation"
                                    >
                                      {res.nomIncube}
                                    </p>
                                    {res.salleSpecifique && (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                        📍 {res.salleSpecifique}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-500 dark:text-dark-400 font-medium truncate max-w-[160px]">
                                    {res.emailIncube || res.telephoneIncube || 'Contact non renseigné'}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* 2. Date & Créneau */}
                            <td className="py-3 px-3 whitespace-nowrap">
                              <div className="space-y-0.5">
                                <p className="font-extrabold text-slate-900 dark:text-dark-100 text-xs">
                                  📅 {new Date(res.dateReservation).toLocaleDateString('fr-FR')}
                                </p>
                                <p className="text-[11px] text-slate-500 dark:text-dark-400 font-semibold">
                                  ⏱️ {res.heureDebut} - {res.heureFin} ({res.duree || '1h'})
                                </p>
                              </div>
                            </td>

                            {/* 3. Matériel Demandé & Motif */}
                            <td className="py-3 px-3">
                              <div className="space-y-0.5 max-w-[220px]">
                                <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-dark-200 font-bold text-[11px] inline-block truncate max-w-full">
                                  {res.equipementsUtilises || 'Équipements généraux'}
                                </span>
                                {res.motifUtilisation && (
                                  <p className="text-[10px] text-slate-400 truncate" title={res.motifUtilisation}>
                                    {res.motifUtilisation}
                                  </p>
                                )}
                              </div>
                            </td>

                            {/* 4. Statut & Décision (Valider / Refuser avec motif & commentaire obligatoire) */}
                            <td className="py-3 px-3 text-center">
                              {res.statut === 'en_attente' ? (
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleValiderReservation(res.id)}
                                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-sm cursor-pointer"
                                    title="Valider la réservation (Email automatique à l'incubé)"
                                  >
                                    <Check size={13} /> Valider
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRefusModal({ open: true, reservationId: res.id, motif: '', notifyEmail: true })}
                                    className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1 shadow-sm cursor-pointer"
                                    title="Refuser avec commentaire / raison du refus (Email automatique)"
                                  >
                                    <X size={13} /> Refuser
                                  </button>
                                </div>
                              ) : res.statut === 'valide' ? (
                                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1">
                                    <CheckCircle2 size={12} /> Validée
                                  </span>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        const resp = await api.post(`/reservations/${res.id}/rappel`);
                                        toast.success(resp.data?.message || 'Rappel de réservation envoyé !', { icon: '🔔' });
                                      } catch (err) {
                                        toast.error(err.response?.data?.message || 'Erreur envoi rappel');
                                      }
                                    }}
                                    className="px-2 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/30 hover:bg-sky-100 text-sky-700 dark:text-sky-300 font-bold text-[10px] border border-sky-300 dark:border-sky-800 flex items-center gap-1 transition-colors cursor-pointer"
                                    title="Envoyer un rappel par email à l'incubé (consignes et accès)"
                                  >
                                    <Bell size={11} /> Rappel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRefusModal({ open: true, reservationId: res.id, motif: '', notifyEmail: true })}
                                    className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-dark-800 hover:bg-red-500/15 text-slate-500 hover:text-red-600 dark:text-dark-400 font-bold text-[10px] border border-slate-200 dark:border-dark-700 flex items-center gap-1 transition-colors cursor-pointer"
                                    title="Modifier la décision : Refuser cette réservation"
                                  >
                                    <X size={11} /> Refuser
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-1 max-w-[140px] mx-auto">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30 inline-flex items-center gap-1">
                                      <XCircle size={12} /> Refusée
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleValiderReservation(res.id)}
                                      className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-dark-800 hover:bg-emerald-500/15 text-slate-500 hover:text-emerald-600 dark:text-dark-400 font-bold text-[10px] border border-slate-200 dark:border-dark-700 flex items-center gap-1 transition-colors cursor-pointer"
                                      title="Modifier la décision : Valider cette réservation"
                                    >
                                      <Check size={11} /> Valider
                                    </button>
                                  </div>
                                  {res.motifRefus && (
                                    <p className="text-[10px] text-slate-500 italic truncate" title={res.motifRefus}>
                                      Raison: "{res.motifRefus}"
                                    </p>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

      {/* =========================================================================
         ONGLET 2 : AJOUT ET GESTION DU MATÉRIEL PAR L'ADMIN POUR CHAQUE ESPACE
         ========================================================================= */}
      {activeTab === 'materiel' && (() => {
        const currentEsp = ESPACES.find(e => e.id === selectedEspace);
        const listEq = equipements[selectedEspace] || [];

        return (
          <div className="space-y-6">
            {/* Formulaire d'ajout d'équipement par l'administrateur - TOUT SUR UNE SEULE LIGNE HORIZONTALE */}
            <div className="card p-4 border border-slate-200 dark:border-dark-700/60 bg-slate-50/50 dark:bg-dark-900/40">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm flex items-center gap-2">
                  <Plus size={16} className="text-emerald-500" /> Ajouter un Matériel dans : <span className="text-emerald-600 dark:text-emerald-400">{currentEsp?.nom}</span>
                </h3>
                <span className="text-[11px] text-slate-400 font-medium">
                  {listEq.length} matériel{listEq.length > 1 ? 's' : ''} enregistré{listEq.length > 1 ? 's' : ''}
                </span>
              </div>

              <form onSubmit={handleAddEquipement} className="flex flex-col lg:flex-row items-stretch lg:items-end gap-2.5">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-dark-300 block mb-1">
                    Nom du matériel / équipement *
                  </label>
                  <input
                    type="text"
                    placeholder="ex: Imprimante 3D Bambu Lab, Caméra 4K, Fraiseuse..."
                    value={newEquipement.nom}
                    onChange={(e) => setNewEquipement({ ...newEquipement, nom: e.target.value })}
                    className="input !py-2 !text-xs w-full font-semibold"
                    required
                  />
                </div>

                <div className="w-full lg:w-44 shrink-0">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-dark-300 block mb-1">
                    Numéro de Série (Unique)
                  </label>
                  <input
                    type="text"
                    placeholder="ex: SN-FAB-001"
                    value={newEquipement.numeroSerie}
                    onChange={(e) => setNewEquipement({ ...newEquipement, numeroSerie: e.target.value })}
                    className="input !py-2 !text-xs w-full font-mono font-bold"
                  />
                </div>

                <div className="w-full lg:w-36 shrink-0">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-dark-300 block mb-1">
                    Catégorie
                  </label>
                  <input
                    type="text"
                    placeholder="ex: Général"
                    value={newEquipement.categorie}
                    onChange={(e) => setNewEquipement({ ...newEquipement, categorie: e.target.value })}
                    className="input !py-2 !text-xs w-full"
                  />
                </div>

                {currentEsp?.salles && currentEsp.salles.length > 1 && (
                  <div className="w-full lg:w-44 shrink-0">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-dark-300 block mb-1">
                      Affecter à la salle
                    </label>
                    <select
                      value={newEquipement.salle}
                      onChange={(e) => setNewEquipement({ ...newEquipement, salle: e.target.value })}
                      className="input !py-2 !text-xs w-full font-bold cursor-pointer"
                    >
                      <option value="">Toutes les salles</option>
                      {currentEsp.salles.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="w-full lg:w-auto shrink-0">
                  <button
                    type="submit"
                    className="btn btn-primary text-xs font-bold py-2 px-4 w-full lg:w-auto h-[38px] flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap cursor-pointer"
                  >
                    <Plus size={15} /> Ajouter ce matériel
                  </button>
                </div>
              </form>
            </div>

            {/* LISTE DES MATÉRIELS DE L'ESPACE */}
            <div className="card p-5 border border-slate-200 dark:border-dark-700/60 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-slate-900 dark:text-white text-sm">
                  Matériels disponibles dans {currentEsp?.nom}
                </h3>
                <span className="badge badge-green">{listEq.length} Équipements</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-dark-700/60 text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Nom du Matériel</th>
                      <th className="py-2.5 px-3">Numéro de Série</th>
                      <th className="py-2.5 px-3">Catégorie</th>
                      <th className="py-2.5 px-3">Salle Affectée</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-dark-800/60">
                    {listEq.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                          Aucun matériel n'a encore été ajouté dans cet espace. Utilisez le formulaire ci-dessus pour en créer un.
                        </td>
                      </tr>
                    ) : (
                      listEq.map((eq, idx) => (
                        <tr key={eq.id} className="hover:bg-slate-50 dark:hover:bg-dark-800/40 transition-colors">
                          <td className="py-3 px-3 font-mono font-bold text-slate-400 text-center">{idx + 1}</td>
                          <td className="py-3 px-3 font-extrabold text-slate-900 dark:text-white">
                            {eq.nom}
                          </td>
                          <td className="py-3 px-3">
                            <input
                              type="text"
                              defaultValue={eq.numeroSerie || ''}
                              key={`${eq.id}-${eq.numeroSerie || ''}`}
                              onBlur={(e) => {
                                if (e.target.value.trim() !== (eq.numeroSerie || '').trim()) {
                                  handleUpdateEquipementField(selectedEspace, eq.id, 'numeroSerie', e.target.value.trim(), true);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.target.blur();
                                }
                              }}
                              placeholder="SN-..."
                              title="Tapez le N° de série puis appuyez sur Entrée ou cliquez ailleurs pour enregistrer"
                              className="text-[11px] font-mono font-bold py-1 px-2 rounded-lg border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-900 text-slate-700 dark:text-dark-200 w-36 focus:outline-none focus:border-emerald-500 transition-colors"
                            />
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold text-[10px]">
                              {eq.categorie || 'Général'}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-bold text-slate-600 dark:text-dark-300">
                            {eq.salle ? (
                              <span className="text-amber-600 dark:text-amber-400">📍 {eq.salle}</span>
                            ) : (
                              <span className="text-slate-400 font-normal italic">Espace complet</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteEquipement(selectedEspace, eq.id)}
                              title="Supprimer ce matériel"
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-red-500/10 text-slate-400 hover:text-red-500 dark:bg-dark-800 transition-colors cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* =========================================================================
         ONGLET 3 : ÉTAT DU MATÉRIEL (BON ÉTAT, PANNE, PHOTO & QUI RÉSERVE)
         ========================================================================= */}
      {activeTab === 'etat_materiel' && (() => {
        const currentEsp = ESPACES.find(e => e.id === selectedEspace);
        const listEq = equipements[selectedEspace] || [];

        return (
          <div className="card p-5 border border-slate-200 dark:border-dark-700/60 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-dark-800">
              <div>
                <h3 className="font-black text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <Wrench size={16} className="text-amber-500" /> État et Maintenance du Matériel — {currentEsp?.nom}
                </h3>
                <p className="text-xs text-slate-500 dark:text-dark-400 mt-0.5">
                  Vérifiez le bon état du matériel, son utilisation en temps réel et signalez tout problème avec photo.
                </p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    exportEquipementsToExcel(listEq, currentEsp?.nom || selectedEspace);
                    toast.success("Inventaire et états exportés en Excel (.xlsx) !", { icon: '📊' });
                  }}
                  className="btn btn-secondary py-1 px-2.5 rounded-xl text-xs font-bold border border-emerald-500/30 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                  title="Exporter l'inventaire et les états du matériel en Excel (.xlsx)"
                >
                  <span>📊 Exporter (.xlsx)</span>
                </button>
                <span className="badge badge-green">
                  {listEq.length} Matériel{listEq.length > 1 ? 's' : ''} suivi{listEq.length > 1 ? 's' : ''}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-dark-700/60 text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                    <th className="py-2.5 px-3 w-8 text-center">#</th>
                    <th className="py-2.5 px-3">Matériel & N° Série</th>
                    <th className="py-2.5 px-3">Salle</th>
                    <th className="py-2.5 px-3">Occupant / Réservation liée</th>
                    <th className="py-2.5 px-3">État Avant Utilisation</th>
                    <th className="py-2.5 px-3">État Après (Restitution)</th>
                    <th className="py-2.5 px-3">Panne / Photo</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-dark-800/60">
                  {listEq.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                        Aucun matériel dans cet espace pour le moment. Ajoutez-en un dans l'onglet "Matériel de l'Espace".
                      </td>
                    </tr>
                  ) : (
                    listEq.map((eq, idx) => {
                      const activeIncident = (eq.incidents || []).find(inc => !inc.resolu);
                      const statusInfo = getEspaceStatusInfo(selectedEspace);
                      
                      // Détection précise si CET équipement précis est utilisé dans la réservation
                      const isEquipmentUsed = (res, item) => {
                        if (!res || !item) return false;
                        if (res.salleSpecifique && item.salle && res.salleSpecifique.toLowerCase() !== item.salle.toLowerCase()) return false;
                        const used = (res.equipementsUtilises || '').toLowerCase();
                        const itemNom = (item.nom || '').toLowerCase();
                        if (!used || used.includes('tous') || used.includes('général') || used.includes('espace entier')) return true;
                        return used.includes(itemNom) || itemNom.includes(used) || (item.categorie && used.includes(item.categorie.toLowerCase()));
                      };

                      const currentBooking = statusInfo?.activeNow && isEquipmentUsed(statusInfo.activeNow, eq) ? statusInfo.activeNow : null;
                      const nextBooking = statusInfo?.nextRes && isEquipmentUsed(statusInfo.nextRes, eq) ? statusInfo.nextRes : null;

                      return (
                        <tr key={eq.id} className="hover:bg-slate-50 dark:hover:bg-dark-800/40 transition-colors">
                          <td className="py-3 px-3 font-mono font-bold text-slate-400 text-center">{idx + 1}</td>
                          
                          {/* Matériel & N° Série */}
                          <td className="py-3 px-3">
                            <p className="font-black text-slate-900 dark:text-white text-xs">{eq.nom}</p>
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-dark-300 font-bold border border-slate-200 dark:border-dark-700 inline-block mt-0.5">
                              N°: {eq.numeroSerie || 'SN-NON-DEFINI'}
                            </span>
                          </td>

                          {/* Salle */}
                          <td className="py-3 px-3">
                            {eq.salle ? (
                              <span className="text-amber-600 dark:text-amber-400 font-bold text-[11px]">📍 {eq.salle}</span>
                            ) : (
                              <span className="text-slate-500 font-medium text-[11px]">{currentEsp?.nom}</span>
                            )}
                          </td>

                          {/* Personne ayant réservé l'espace / matériel */}
                          <td className="py-3 px-3">
                            {currentBooking ? (
                              <div className="space-y-0.5">
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1 w-fit">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> En cours d'utilisation
                                </span>
                                <p className="font-extrabold text-slate-900 dark:text-white text-xs truncate max-w-[150px]">
                                  {currentBooking.nomIncube}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  ⏱️ {currentBooking.heureDebut} - {currentBooking.heureFin}
                                </p>
                              </div>
                            ) : nextBooking ? (
                              <div className="space-y-0.5">
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/25 flex items-center gap-1 w-fit">
                                  Prochaine rés.
                                </span>
                                <p className="font-bold text-slate-700 dark:text-slate-300 text-[11px] truncate max-w-[150px]">
                                  {nextBooking.nomIncube}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  📅 {new Date(nextBooking.dateReservation).toLocaleDateString('fr-FR')} • {nextBooking.heureDebut}
                                </p>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 italic">
                                Libre / Disponible
                              </span>
                            )}
                          </td>

                          {/* État Avant Utilisation */}
                          <td className="py-3 px-3">
                            <select
                              value={eq.etatAvant || 'Opérationnel / Parfait état'}
                              onChange={(e) => handleUpdateEquipementField(selectedEspace, eq.id, 'etatAvant', e.target.value)}
                              className={`text-xs font-bold py-1.5 px-2 rounded-xl border outline-none cursor-pointer shadow-sm transition-all ${
                                (eq.etatAvant || '').includes('Opérationnel')
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                  : (eq.etatAvant || '').includes('Bon état')
                                  ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30'
                                  : (eq.etatAvant || '').includes('usure')
                                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                  : 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30'
                              }`}
                            >
                              <option value="Opérationnel / Parfait état">🟢 Opérationnel / Parfait</option>
                              <option value="Bon état / Prêt à l'emploi">🔵 Bon état / Prêt</option>
                              <option value="Légère usure / À surveiller">🟡 Légère usure</option>
                              <option value="En maintenance / Bloqué">🔴 En maintenance</option>
                            </select>
                          </td>

                          {/* État Après Utilisation (Restitution) */}
                          <td className="py-3 px-3">
                            <select
                              value={eq.etatApres || 'Conforme & Rendu propre'}
                              onChange={(e) => handleUpdateEquipementField(selectedEspace, eq.id, 'etatApres', e.target.value)}
                              className={`text-xs font-bold py-1.5 px-2 rounded-xl border outline-none cursor-pointer shadow-sm transition-all ${
                                (eq.etatApres || '').includes('Conforme')
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                  : (eq.etatApres || '').includes('nettoyé')
                                  ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30'
                                  : (eq.etatApres || '').includes('manquante')
                                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                  : (eq.etatApres || '').includes('Dégradé')
                                  ? 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30'
                                  : 'bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-dark-300 border-slate-300 dark:border-dark-700'
                              }`}
                            >
                              <option value="Conforme & Rendu propre">🟢 Conforme & Propre</option>
                              <option value="Rendu nettoyé">🔵 Rendu nettoyé</option>
                              <option value="Pièce manquante / À vérifier">🟡 Pièce manquante</option>
                              <option value="Dégradé / Cassé">🔴 Dégradé / Cassé</option>
                              <option value="En attente restitution">⚪ En attente restitution</option>
                            </select>
                          </td>

                          {/* Constat / Incident & Photo */}
                          <td className="py-3 px-3">
                            {activeIncident ? (
                              <div className="flex items-center gap-2">
                                {activeIncident.photo ? (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenViewProblemModal(eq)}
                                    className="w-10 h-10 rounded-xl overflow-hidden border border-red-500/40 shrink-0 relative group shadow-sm cursor-pointer"
                                    title="Cliquez pour agrandir la photo du problème"
                                  >
                                    <img
                                      src={activeIncident.photo}
                                      alt="Problème"
                                      className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                    />
                                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Eye size={12} className="text-white" />
                                    </div>
                                  </button>
                                ) : (
                                  <div className="w-8 h-8 rounded-xl bg-red-500/15 text-red-600 flex items-center justify-center shrink-0">
                                    <AlertTriangle size={15} />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 flex items-center gap-1 w-fit">
                                    <AlertTriangle size={10} /> Problème signalé
                                  </span>
                                  <p className="text-[10px] text-slate-700 dark:text-slate-300 font-medium truncate max-w-[130px] mt-0.5" title={activeIncident.description}>
                                    {activeIncident.titre || activeIncident.description}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-dark-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-dark-700">
                                <CheckCircle2 size={11} className="text-emerald-500" /> Bon état (Aucun problème)
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {activeIncident ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenViewProblemModal(eq)}
                                  className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 font-bold text-xs flex items-center gap-1 shadow-sm cursor-pointer"
                                  title="Voir la photo du problème et résoudre"
                                >
                                  <Eye size={13} /> Photo & Résoudre
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenProblemModal(eq)}
                                  className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 font-bold text-xs flex items-center gap-1 shadow-sm cursor-pointer"
                                  title="Signaler une panne ou casse avec photo"
                                >
                                  <AlertTriangle size={13} /> Signaler problème
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* =========================================================================
         ONGLET 4 : QR CODE UNIQUE DE RÉSERVATION D'ESPACE
         ========================================================================= */}
      {activeTab === 'qr' && (() => {
        const baseUrl = import.meta.env.VITE_CLOUD_URL || 'https://ids-production-app-6aba82b6af10.herokuapp.com';
        const qrUrl = `${baseUrl}/booking/${selectedEspace}`;
        const afficheTitle = `QR Code Officiel — ${currentEsp?.nom || 'Espace'}`;

        return (
          <div className="card p-8 border-2 border-emerald-500/30 text-center space-y-6 max-w-md mx-auto bg-white dark:bg-dark-900 shadow-xl">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                Affiche Officielle de Réservation
              </span>
              <h3 className="font-black text-2xl text-slate-900 dark:text-white pt-2">
                {afficheTitle}
              </h3>
              <p className="text-xs text-slate-500 dark:text-dark-400">
                Scannez ce QR code pour réserver directement cet espace
              </p>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-dark-800 rounded-3xl border-2 border-dashed border-emerald-500/40 inline-block shadow-inner mx-auto my-1">
              <QRCodeSVG
                value={qrUrl}
                size={240}
                level="H"
              />
            </div>

            <button
              onClick={() => window.print()}
              className="btn btn-primary w-full py-2.5 text-xs font-bold shadow-lg cursor-pointer flex items-center justify-center gap-2"
            >
              <Printer size={15} /> Imprimer l'Affiche QR Code ({currentEsp?.nom || 'Espace'})
            </button>
          </div>
        );
      })()}

      {/* MODAL REFUS AVEC MOTIF OBLIGATOIRE */}
      {refusModal.open && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-900 text-slate-900 dark:text-white rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-dark-700 space-y-4 shadow-2xl">
            <h3 className="font-black text-lg text-red-600 flex items-center gap-2">
              <XCircle size={20} /> Refuser la demande de réservation
            </h3>
            <p className="text-xs text-slate-600 dark:text-dark-300">
              Veuillez indiquer le motif du refus. Ce motif sera transmis automatiquement par email à l'incubé.
            </p>

            <textarea
              rows={3}
              placeholder="ex: Le créneau demandé est réservé pour une formation officielle IDS..."
              value={refusModal.motif}
              onChange={(e) => setRefusModal({ ...refusModal, motif: e.target.value })}
              className="w-full bg-slate-50 dark:bg-dark-800 border border-slate-300 dark:border-dark-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
              required
            />

            <label className="flex items-center gap-2.5 text-xs font-bold text-slate-700 dark:text-dark-200 cursor-pointer select-none bg-slate-50 dark:bg-dark-800/80 p-2.5 rounded-xl border border-slate-200 dark:border-dark-700">
              <input
                type="checkbox"
                checked={refusModal.notifyEmail !== false}
                onChange={(e) => setRefusModal(prev => ({ ...prev, notifyEmail: e.target.checked }))}
                className="w-4 h-4 rounded text-red-600 focus:ring-red-500 cursor-pointer"
              />
              <span>📧 Notifier l'incubé par email avec ce motif (Coché par défaut)</span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRefusModal({ open: false, reservationId: null, motif: '' })}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-dark-800 text-xs font-bold text-slate-600 dark:text-dark-300"
              >
                Annuler
              </button>
              <button
                onClick={handleRefuserReservation}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
              >
                Confirmer le refus & Envoyer Email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FICHE ÉTAT AVANT / APRÈS */}
      {etatModal.open && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-900 text-slate-900 dark:text-white rounded-3xl p-6 max-w-lg w-full border border-slate-200 dark:border-dark-700 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-3">
              <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Wrench size={18} className="text-emerald-600" /> Fiche d'État Matériel & Espace
              </h3>
              <button 
                onClick={() => setEtatModal({ open: false, reservationId: null, etatAvant: '', etatApres: '' })}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* BANNIÈRE : PERSONNE AYANT RÉSERVÉ L'ESPACE */}
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white dark:bg-emerald-600 flex items-center justify-center font-black text-sm shrink-0 shadow-sm">
                <User size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-black text-slate-900 dark:text-white text-xs truncate">
                    Réservé par : <span className="underline text-emerald-700 dark:text-emerald-300">{etatModal.nomIncube || 'Incubé'}</span>
                  </h4>
                  {etatModal.dateReservation && (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 shrink-0">
                      📅 {new Date(etatModal.dateReservation).toLocaleDateString('fr-FR')}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 dark:text-dark-300 mt-0.5">
                  ⏱️ Créneau : <strong>{etatModal.heureDebut || '—'} à {etatModal.heureFin || '—'}</strong>
                  {etatModal.salleSpecifique && (
                    <span> • 📍 <strong className="text-amber-600 dark:text-amber-400">{etatModal.salleSpecifique}</strong></span>
                  )}
                  {etatModal.equipementsUtilises && (
                    <span> • 🧰 <strong>{etatModal.equipementsUtilises}</strong></span>
                  )}
                </p>
                {(etatModal.emailIncube || etatModal.telephoneIncube) && (
                  <p className="text-[10px] text-slate-500 dark:text-dark-400 mt-0.5 truncate">
                    📧 {etatModal.emailIncube || '—'} • 📞 {etatModal.telephoneIncube || '—'}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    🟢 État du matériel AVANT utilisation (Prise en main) :
                  </label>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    '✓ Opérationnel & Propre',
                    '✓ Accessoires & Câblage complets',
                    '⚠️ Légère usure constatée',
                    '⚠️ Consommables à moitié'
                  ].map(tmpl => (
                    <button
                      key={tmpl}
                      type="button"
                      onClick={() => setEtatModal(prev => ({
                        ...prev,
                        etatAvant: prev.etatAvant ? `${prev.etatAvant} • ${tmpl}` : tmpl
                      }))}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 transition-colors"
                    >
                      {tmpl}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={2}
                  placeholder="ex: Matériel au complet, imprimante 3D chargée en filament vert, câbles rangés."
                  value={etatModal.etatAvant}
                  onChange={(e) => setEtatModal({ ...etatModal, etatAvant: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-dark-800 border border-slate-300 dark:border-dark-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    🔵 État du matériel APRÈS utilisation (Restitution) :
                  </label>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    '✓ Restitué conforme & propre',
                    '✓ Aucun dommage constaté',
                    '⚠️ Nécessite nettoyage / consommables',
                    '🚨 Matériel dégradé / Panne signalée'
                  ].map(tmpl => (
                    <button
                      key={tmpl}
                      type="button"
                      onClick={() => setEtatModal(prev => ({
                        ...prev,
                        etatApres: prev.etatApres ? `${prev.etatApres} • ${tmpl}` : tmpl
                      }))}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/20 transition-colors"
                    >
                      {tmpl}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={2}
                  placeholder="ex: Matériel restitué propre, découpeuse laser éteinte, aucun dommage à signaler."
                  value={etatModal.etatApres}
                  onChange={(e) => setEtatModal({ ...etatModal, etatApres: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-dark-800 border border-slate-300 dark:border-dark-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setEtatModal({ open: false, reservationId: null, etatAvant: '', etatApres: '' })}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-dark-800 text-xs font-bold text-slate-600 dark:text-dark-300"
              >
                Fermer
              </button>
              <button
                onClick={handleSaveEtat}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
              >
                Enregistrer les états
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
         MODAL 1 : SIGNALER UN PROBLÈME SUR UN ÉQUIPEMENT AVEC PHOTO
         ========================================================================= */}
      {problemModal.open && (
        <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-900 text-slate-900 dark:text-white rounded-3xl p-6 max-w-lg w-full border border-slate-200 dark:border-dark-700 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-3">
              <div>
                <h3 className="font-black text-lg text-red-600 flex items-center gap-2">
                  <AlertTriangle size={20} /> Signaler un problème / Panne
                </h3>
                <p className="text-xs text-slate-500 dark:text-dark-400 mt-0.5">
                  Matériel : <strong className="text-slate-800 dark:text-white">{problemModal.equipementNom}</strong>
                </p>
              </div>
              <button
                onClick={() => setProblemModal({ open: false, equipementId: null, equipementNom: '', espace: '', titre: '', description: '', gravite: 'majeur', photo: null, photoName: '' })}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-800 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProblem} className="space-y-4">
              {/* Type / Titre de la panne */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-dark-300 block mb-1">
                  Type de problème / Titre de la panne *
                </label>
                <input
                  type="text"
                  placeholder="ex: Buse bouchée, Câble coupé, Écran fissuré, Surchauffe..."
                  value={problemModal.titre}
                  onChange={(e) => setProblemModal({ ...problemModal, titre: e.target.value })}
                  className="input w-full !py-2 !text-xs font-medium"
                  required
                />
              </div>

              {/* Gravité */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-dark-300 block mb-1">
                  Niveau de gravité du problème *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'mineur', label: '🟡 Mineur', desc: 'Utilisable avec précaution' },
                    { id: 'majeur', label: '🟠 Majeur', desc: 'Fonction dégradée' },
                    { id: 'bloquant', label: '🔴 Bloquant', desc: 'Machine hors-service' }
                  ].map(g => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setProblemModal({ ...problemModal, gravite: g.id })}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        problemModal.gravite === g.id
                          ? 'border-red-500 bg-red-500/15 text-red-700 dark:text-red-300 shadow-sm font-bold'
                          : 'border-slate-200 dark:border-dark-700 hover:bg-slate-50 dark:hover:bg-dark-800 text-slate-600 dark:text-dark-400'
                      }`}
                    >
                      <span className="text-xs block">{g.label}</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">{g.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Description détaillée */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-dark-300 block mb-1">
                  Description détaillée du constat / problème *
                </label>
                <textarea
                  rows={3}
                  placeholder="Expliquez exactement ce qui ne fonctionne pas, le comportement inhabituel ou les dégâts constatés..."
                  value={problemModal.description}
                  onChange={(e) => setProblemModal({ ...problemModal, description: e.target.value })}
                  className="input w-full !p-2.5 !text-xs"
                  required
                />
              </div>

              {/* Téléversement de la photo */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-dark-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ImageIcon size={14} className="text-amber-500" /> Photo / Image du matériel affichant le problème
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">JPG, PNG, WebP</span>
                </label>

                {problemModal.photo ? (
                  <div className="relative rounded-2xl border-2 border-dashed border-emerald-500/50 bg-emerald-50/10 p-3 flex items-center gap-3">
                    <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-900 shrink-0 border border-slate-700 shadow-md">
                      <img src={problemModal.photo} alt="Prévisualisation" className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 truncate">
                        ✓ Image enregistrée
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-dark-400 truncate mt-0.5">
                        {problemModal.photoName || 'Photo du matériel'}
                      </p>
                      <button
                        type="button"
                        onClick={() => setProblemModal(prev => ({ ...prev, photo: null, photoName: '' }))}
                        className="text-[11px] font-bold text-red-500 hover:text-red-700 mt-2 flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 size={12} /> Retirer la photo
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed border-slate-300 dark:border-dark-700 bg-slate-50 dark:bg-dark-800/50 hover:bg-slate-100 dark:hover:bg-dark-800 hover:border-emerald-500 transition-all cursor-pointer group">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      <Upload size={18} />
                    </div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Cliquez pour choisir une photo du problème
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">
                      Prenez une photo de la pièce endommagée ou de la panne
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProblemImageUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Boutons d'action */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-dark-800">
                <button
                  type="button"
                  onClick={() => setProblemModal({ open: false, equipementId: null, equipementNom: '', espace: '', titre: '', description: '', gravite: 'majeur', photo: null, photoName: '' })}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-dark-800 text-xs font-bold text-slate-600 dark:text-dark-300 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-red-600/20 cursor-pointer"
                >
                  <AlertTriangle size={14} /> Enregistrer le signalement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
         MODAL 2 : CONSULTATION DU PROBLÈME & RÉSOLUTION (PHOTO EN GRAND)
         ========================================================================= */}
      {viewProblemModal.open && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-900 text-slate-900 dark:text-white rounded-3xl p-6 max-w-lg w-full border border-slate-200 dark:border-dark-700 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-3">
              <div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30">
                  Incident en cours • {viewProblemModal.incident?.gravite?.toUpperCase() || 'MAJEUR'}
                </span>
                <h3 className="font-black text-base text-slate-900 dark:text-white mt-1">
                  {viewProblemModal.equipement?.nom}
                </h3>
              </div>
              <button
                onClick={() => setViewProblemModal({ open: false, equipement: null, espace: '', incident: null })}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-800 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* PHOTO DU MATÉRIEL AVEC LE PROBLÈME EN GRAND */}
            {viewProblemModal.incident?.photo ? (
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  📷 Photo de la panne / casse constatée :
                </span>
                <div className="rounded-2xl overflow-hidden border-2 border-red-500/40 bg-slate-950 shadow-lg max-h-72 flex items-center justify-center">
                  <img
                    src={viewProblemModal.incident.photo}
                    alt="Panne constatée"
                    className="max-h-72 w-auto object-contain"
                  />
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-medium flex items-center gap-2">
                <Info size={16} /> Aucune photo n'avait été jointe lors du signalement de cet incident.
              </div>
            )}

            {/* DÉTAILS DE L'INCIDENT */}
            <div className="bg-slate-50 dark:bg-dark-800/60 p-4 rounded-2xl border border-slate-200 dark:border-dark-700/60 space-y-2 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Titre du problème</span>
                <p className="font-extrabold text-slate-900 dark:text-white text-sm">
                  {viewProblemModal.incident?.titre || 'Panne signalée'}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Description constatée</span>
                <p className="text-slate-700 dark:text-dark-200 mt-0.5 leading-relaxed font-medium">
                  {viewProblemModal.incident?.description}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-dark-700/60 flex items-center justify-between text-[11px] text-slate-500">
                <span>
                  📅 Signalé le : <strong>{viewProblemModal.incident?.date ? new Date(viewProblemModal.incident.date).toLocaleString('fr-FR') : 'Récemment'}</strong>
                </span>
                <span>
                  👤 Par : <strong>{viewProblemModal.incident?.signalePar || 'Responsable'}</strong>
                </span>
              </div>
            </div>

            {/* BOUTONS D'ACTION DONT RÉSOLUTION */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-dark-800">
              <button
                type="button"
                onClick={() => setViewProblemModal({ open: false, equipement: null, espace: '', incident: null })}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-dark-800 text-xs font-bold text-slate-600 dark:text-dark-300 cursor-pointer"
              >
                Fermer
              </button>

              <button
                type="button"
                onClick={() => handleResoudreIncident(viewProblemModal.espace, viewProblemModal.equipement.id)}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/25 cursor-pointer"
              >
                <CheckCircle2 size={16} /> ✅ Marquer comme réparé / Résolu
              </button>
            </div>
          </div>
        </div>
      )}
      {/* =========================================================================
         MODAL 3 : DÉTAILS DE LA RÉSERVATION ET DE LA PERSONNE
         ========================================================================= */}
      {detailsModal.open && detailsModal.reservation && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-900 text-slate-900 dark:text-white rounded-3xl p-6 max-w-lg w-full border border-slate-200 dark:border-dark-700 shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-4 mb-4">
              <h3 className="font-black text-lg flex items-center gap-2">
                <User size={20} className="text-blue-500" />
                Détails de la réservation
              </h3>
              <button
                onClick={() => setDetailsModal({ open: false, reservation: null })}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-800 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-6">
              {/* Infos Personne */}
              <div className="bg-slate-50 dark:bg-dark-800/60 p-4 rounded-2xl border border-slate-200 dark:border-dark-700/60">
                <h4 className="text-xs font-bold uppercase text-slate-400 mb-3 flex items-center gap-2">
                  <User size={14} /> Informations du demandeur
                </h4>
                <div className="space-y-2 text-sm">
                  <p><span className="text-slate-500 dark:text-dark-400 font-medium w-24 inline-block">Nom :</span> <strong className="font-black">{detailsModal.reservation.nomIncube}</strong></p>
                  <p><span className="text-slate-500 dark:text-dark-400 font-medium w-24 inline-block">Email :</span> <strong>{detailsModal.reservation.emailIncube || 'Non renseigné'}</strong></p>
                  <p><span className="text-slate-500 dark:text-dark-400 font-medium w-24 inline-block">Téléphone :</span> <strong>{detailsModal.reservation.telephoneIncube || 'Non renseigné'}</strong></p>
                </div>
              </div>

              {/* Infos Réservation */}
              <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-800/30">
                <h4 className="text-xs font-bold uppercase text-blue-500 mb-3 flex items-center gap-2">
                  <Calendar size={14} /> Détails de la demande
                </h4>
                <div className="space-y-2 text-sm">
                  <p><span className="text-slate-500 dark:text-dark-400 font-medium w-24 inline-block align-top">Espace :</span> <strong className="text-blue-600 dark:text-blue-400 inline-block w-[200px] break-words">{ESPACES.find(e => e.id === detailsModal.reservation.espace)?.nom || detailsModal.reservation.espace} {detailsModal.reservation.salleSpecifique ? `(${detailsModal.reservation.salleSpecifique})` : ''}</strong></p>
                  <p><span className="text-slate-500 dark:text-dark-400 font-medium w-24 inline-block">Date :</span> <strong>{new Date(detailsModal.reservation.dateReservation).toLocaleDateString('fr-FR')}</strong></p>
                  <p><span className="text-slate-500 dark:text-dark-400 font-medium w-24 inline-block">Créneau :</span> <strong>{detailsModal.reservation.heureDebut} - {detailsModal.reservation.heureFin} ({detailsModal.reservation.duree || '1h'})</strong></p>
                  <p><span className="text-slate-500 dark:text-dark-400 font-medium w-24 inline-block align-top">Matériel :</span> <span className="inline-block font-medium w-[200px] break-words">{detailsModal.reservation.equipementsUtilises || 'Équipements généraux'}</span></p>
                  {detailsModal.reservation.motifUtilisation && (
                    <p><span className="text-slate-500 dark:text-dark-400 font-medium w-24 inline-block align-top">Motif :</span> <span className="inline-block text-slate-700 dark:text-dark-200 italic max-h-24 overflow-y-auto">{detailsModal.reservation.motifUtilisation}</span></p>
                  )}
                  <p><span className="text-slate-500 dark:text-dark-400 font-medium w-24 inline-block mt-2">Statut :</span> 
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold uppercase ${
                      detailsModal.reservation.statut === 'en_attente' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30' :
                      detailsModal.reservation.statut === 'valide' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' :
                      'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30'
                    }`}>
                      {detailsModal.reservation.statut === 'en_attente' ? 'En attente' : detailsModal.reservation.statut === 'valide' ? 'Validée' : 'Refusée'}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailsModal({ open: false, reservation: null })}
                className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-dark-800 text-sm font-bold text-slate-700 dark:text-dark-200 hover:bg-slate-200 dark:hover:bg-dark-700 transition-colors cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
         MODAL : RÉSERVATION DIRECTE PAR L'ADMINISTRATEUR (SUPER ADMIN)
         ========================================================================= */}
      {adminBookingModal.open && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-900 text-slate-900 dark:text-white rounded-3xl p-6 max-w-lg w-full border border-slate-200 dark:border-dark-700 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-3">
              <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck size={18} className="text-emerald-500" />
                Nouvelle Réservation Directe (Administration)
              </h3>
              <button
                type="button"
                onClick={() => setAdminBookingModal(prev => ({ ...prev, open: false }))}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-800 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateAdminReservation} className="space-y-3.5 text-xs">
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[11px] font-medium leading-relaxed">
                ℹ️ Cette réservation sera <strong>immédiatement validée</strong> dans le planning sans passer par la file d'attente, et le créneau sera bloqué contre tout conflit.
              </div>

              {/* Choix Espace & Salle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-dark-300 block mb-1">
                    Espace principal *
                  </label>
                  <select
                    value={adminBookingModal.espace}
                    onChange={(e) => {
                      const esp = ESPACES.find(item => item.id === e.target.value);
                      setAdminBookingModal(prev => ({
                        ...prev,
                        espace: e.target.value,
                        salleSpecifique: esp?.salles?.[0] || ''
                      }));
                    }}
                    className="input w-full !py-2 !text-xs font-bold cursor-pointer"
                    required
                  >
                    {ESPACES.map(esp => (
                      <option key={esp.id} value={esp.id}>{esp.nom}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-dark-300 block mb-1">
                    Zone / Salle spécifique
                  </label>
                  <select
                    value={adminBookingModal.salleSpecifique}
                    onChange={(e) => setAdminBookingModal(prev => ({ ...prev, salleSpecifique: e.target.value }))}
                    className="input w-full !py-2 !text-xs font-bold cursor-pointer"
                  >
                    <option value="">Espace complet</option>
                    {(ESPACES.find(esp => esp.id === adminBookingModal.espace)?.salles || []).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Nom du demandeur */}
              <div>
                <label className="font-bold text-slate-700 dark:text-dark-300 block mb-1">
                  Nom du demandeur / Responsable *
                </label>
                <input
                  type="text"
                  placeholder="ex: Direction IDS, Formateur externe, Maintenance..."
                  value={adminBookingModal.nomPersonnalise}
                  onChange={(e) => setAdminBookingModal(prev => ({ ...prev, nomPersonnalise: e.target.value }))}
                  className="input w-full !py-2 !text-xs font-semibold"
                  required
                />
              </div>

              {/* Date & Horaires */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-dark-300 block mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={adminBookingModal.dateReservation}
                    onChange={(e) => setAdminBookingModal(prev => ({ ...prev, dateReservation: e.target.value }))}
                    className="input w-full !py-2 !text-xs font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-dark-300 block mb-1">
                    Heure début *
                  </label>
                  <input
                    type="time"
                    value={adminBookingModal.heureDebut}
                    onChange={(e) => setAdminBookingModal(prev => ({ ...prev, heureDebut: e.target.value }))}
                    className="input w-full !py-2 !text-xs font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-dark-300 block mb-1">
                    Heure fin *
                  </label>
                  <input
                    type="time"
                    value={adminBookingModal.heureFin}
                    onChange={(e) => setAdminBookingModal(prev => ({ ...prev, heureFin: e.target.value }))}
                    className="input w-full !py-2 !text-xs font-bold"
                    required
                  />
                </div>
              </div>

              {/* Motif */}
              <div>
                <label className="font-bold text-slate-700 dark:text-dark-300 block mb-1">
                  Motif / Raison de la réservation
                </label>
                <input
                  type="text"
                  placeholder="ex: Session officielle d'accompagnement, Maintenance mensuelle..."
                  value={adminBookingModal.motifUtilisation}
                  onChange={(e) => setAdminBookingModal(prev => ({ ...prev, motifUtilisation: e.target.value }))}
                  className="input w-full !py-2 !text-xs"
                />
              </div>

              {/* Matériel */}
              <div>
                <label className="font-bold text-slate-700 dark:text-dark-300 block mb-1">
                  Matériel ou équipement réservé
                </label>
                <input
                  type="text"
                  placeholder="ex: Tous les équipements, Imprimantes 3D, Fraiseuse..."
                  value={adminBookingModal.equipementsUtilises}
                  onChange={(e) => setAdminBookingModal(prev => ({ ...prev, equipementsUtilises: e.target.value }))}
                  className="input w-full !py-2 !text-xs"
                />
              </div>

              {/* Boutons d'action */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-dark-800">
                <button
                  type="button"
                  onClick={() => setAdminBookingModal(prev => ({ ...prev, open: false }))}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-dark-800 text-xs font-bold text-slate-600 dark:text-dark-300 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 cursor-pointer flex items-center gap-1.5"
                >
                  <Check size={14} /> Confirmer la Réservation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
