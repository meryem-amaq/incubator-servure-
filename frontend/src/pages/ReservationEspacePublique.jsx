import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { getEquipementsEspace } from '../data/equipementsEspaces';
import { getJourFerieInfo } from '../utils/joursFeries';

export const SOUS_SALLES = {
  salle_reunion: [
    { id: 'Salle 1', nom: 'Salle 1', description: 'Salle de réunion 1 (6-8 pers.)' },
    { id: 'Salle 2', nom: 'Salle 2', description: 'Salle de réunion 2 (6-8 pers.)' },
    { id: 'Salle 3', nom: 'Salle 3', description: 'Salle 3 (Grande salle 20+ pers.)' }
  ],
  fablab: [
    { id: 'Fablab 1', nom: 'Fablab 1 (Étage)', description: 'Atelier Principal • Impression 3D & Laser' },
    { id: 'Sous-sol', nom: 'Fablab Sous-sol', description: 'Fraiseuse CNC & Prototypage lourd' }
  ],
  studio: [
    { id: 'Studio IDS', nom: 'Studio IDS', description: 'Plateau d\'enregistrement vidéo 4K & Podcast' }
  ]
};

const ESPACES_DETAILS = {
  fablab: {
    nom: 'Fablab',
    description: 'Atelier de fabrication numérique, prototypage, impression 3D & découpe laser',
    badge: 'Prototypage & Fabrication',
    color: 'from-amber-500 to-orange-600'
  },
  studio: {
    nom: 'Studio IDS',
    description: 'Studio d’enregistrement podcast, vidéo 4K, photographie de produits & streaming',
    badge: 'Média & Création de Contenu',
    color: 'from-purple-500 to-indigo-600'
  },
  salle_reunion: {
    nom: 'Les Salles',
    description: 'Espaces de réunion et de travail collaboratifs avec visioconférence 4K',
    badge: 'Collaboration & Formation',
    color: 'from-blue-500 to-cyan-600'
  }
};

// Configuration des créneaux et durées par type d'espace :
// - FabLab : de 08h à 16h (8 créneaux de 1h)
// - Studio : 09h à 13h & 14h à 18h (2 créneaux de 4h)
// - Salles : de 08h à 22h (7 créneaux de 2h)
const CRENEAUX_PAR_ESPACE = {
  fablab: [
    { debut: '08:00', fin: '09:00', label: '08h - 09h' },
    { debut: '09:00', fin: '10:00', label: '09h - 10h' },
    { debut: '10:00', fin: '11:00', label: '10h - 11h' },
    { debut: '11:00', fin: '12:00', label: '11h - 12h' },
    { debut: '12:00', fin: '13:00', label: '12h - 13h' },
    { debut: '13:00', fin: '14:00', label: '13h - 14h' },
    { debut: '14:00', fin: '15:00', label: '14h - 15h' },
    { debut: '15:00', fin: '16:00', label: '15h - 16h' },
  ],
  studio: [
    { debut: '09:00', fin: '13:00', label: '09h - 13h' },
    { debut: '14:00', fin: '18:00', label: '14h - 18h' },
  ],
  salle_reunion: [
    { debut: '08:00', fin: '10:00', label: '08h - 10h' },
    { debut: '10:00', fin: '12:00', label: '10h - 12h' },
    { debut: '12:00', fin: '14:00', label: '12h - 14h' },
    { debut: '14:00', fin: '16:00', label: '14h - 16h' },
    { debut: '16:00', fin: '18:00', label: '16h - 18h' },
    { debut: '18:00', fin: '20:00', label: '18h - 20h' },
    { debut: '20:00', fin: '22:00', label: '20h - 22h' },
  ]
};

const DUREE_PAR_ESPACE = {
  fablab: '1h',
  studio: '4h',
  salle_reunion: '2h'
};

export default function ReservationEspacePublique() {
  const { espace } = useParams();
  const espaceKey = espace ? espace.toLowerCase() : 'fablab';
  const espaceInfo = ESPACES_DETAILS[espaceKey] || ESPACES_DETAILS.fablab;

  const currentCreneaux = useMemo(() => {
    return CRENEAUX_PAR_ESPACE[espaceKey] || CRENEAUX_PAR_ESPACE.fablab;
  }, [espaceKey]);

  const currentDuree = DUREE_PAR_ESPACE[espaceKey] || '1h';

  const [searchParams, setSearchParams] = useSearchParams();
  const sousSallesList = SOUS_SALLES[espaceKey] || [];

  const initialSousSalle = (() => {
    const fromUrl = searchParams.get('salle');
    if (fromUrl && sousSallesList.some(s => s.id.toLowerCase() === fromUrl.toLowerCase())) {
      return sousSallesList.find(s => s.id.toLowerCase() === fromUrl.toLowerCase()).id;
    }
    return sousSallesList.length > 0 ? sousSallesList[0].id : '';
  })();

  const [selectedSousSalle, setSelectedSousSalle] = useState(initialSousSalle);
  const [isMaterielListOpen, setIsMaterielListOpen] = useState(false);

  useEffect(() => {
    const list = SOUS_SALLES[espaceKey] || [];
    const fromUrl = searchParams.get('salle');
    if (fromUrl && list.some(s => s.id.toLowerCase() === fromUrl.toLowerCase())) {
      setSelectedSousSalle(list.find(s => s.id.toLowerCase() === fromUrl.toLowerCase()).id);
    } else if (list.length > 0 && !list.some(s => s.id === selectedSousSalle)) {
      setSelectedSousSalle(list[0].id);
    }
  }, [espaceKey, searchParams]);

  const [form, setForm] = useState(() => {
    const slots = CRENEAUX_PAR_ESPACE[espaceKey] || CRENEAUX_PAR_ESPACE.fablab;
    return {
      nomComplet: '',
      email: '',
      telephone: '',
      invitesExternes: '',
      dateReservation: new Date().toISOString().split('T')[0],
      heureDebut: slots[0]?.debut || '08:00',
      heureFin: slots[0]?.fin || '09:00',
      motif: '',
      thematique: '',
      equipementsUtilises: ''
    };
  });

  const [hasInvites, setHasInvites] = useState(false);
  const [acceptConditions, setAcceptConditions] = useState(false);
  const [showConditions, setShowConditions] = useState(true);
  const [hasReadToBottom, setHasReadToBottom] = useState(false);
  const conditionsBoxRef = useRef(null);

  // Mettre à jour l'heure début/fin par défaut si l'espace change
  useEffect(() => {
    const slots = CRENEAUX_PAR_ESPACE[espaceKey] || CRENEAUX_PAR_ESPACE.fablab;
    if (slots && slots.length > 0) {
      setForm(prev => {
        const isValid = slots.some(s => s.debut === prev.heureDebut && s.fin === prev.heureFin);
        if (!isValid) {
          return { ...prev, heureDebut: slots[0].debut, heureFin: slots[0].fin };
        }
        return prev;
      });
    }
  }, [espaceKey]);

  const [submittedData, setSubmittedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [existingReservations, setExistingReservations] = useState([]);

  // Vérification si la date sélectionnée est un jour férié
  const jourFerieInfo = getJourFerieInfo(form.dateReservation);

  // Synchronisation avec l'inventaire matériel officiel en base de données
  const [dbEquipements, setDbEquipements] = useState(null);

  useEffect(() => {
    fetch('/api/equipements-espaces')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          setDbEquipements(data);
        }
      })
      .catch(() => { });
  }, []);

  // Gestion du matériel disponible selon espace et sous-salle
  const equipementsDisponibles = useMemo(() => {
    let list = (dbEquipements && dbEquipements[espaceKey]) || getEquipementsEspace(espaceKey, selectedSousSalle);
    if (selectedSousSalle && Array.isArray(list)) {
      const filtered = list.filter(eq => !eq.salle || eq.salle.toLowerCase() === selectedSousSalle.toLowerCase());
      if (filtered.length > 0) return filtered;
    }
    return list || [];
  }, [dbEquipements, espaceKey, selectedSousSalle]);

  const [selectedEquipements, setSelectedEquipements] = useState([]);
  const [customEquipement, setCustomEquipement] = useState('');

  // Réinitialiser la sélection de matériel quand on change de salle ou d'espace
  useEffect(() => {
    setSelectedEquipements([]);
    setForm(f => ({ ...f, equipementsUtilises: customEquipement ? customEquipement.trim() : '' }));
  }, [selectedSousSalle, espaceKey]);

  const toggleEquipement = (eqItem) => {
    const eqName = typeof eqItem === 'string' ? eqItem : eqItem.nom;
    const eqObj = typeof eqItem === 'object' ? eqItem : equipementsDisponibles.find(i => i.nom === eqName);

    // Vérifier si la machine est hors-service
    if (eqObj?.etatAvant === 'En maintenance / Bloqué' || eqObj?.incidents?.some(inc => !inc.resolu && inc.gravite === 'bloquant')) {
      toast.error(`"${eqName}" est actuellement en maintenance ou en réparation et ne peut pas être réservé.`, { icon: '⚠️' });
      return;
    }

    setSelectedEquipements(prev => {
      const exists = prev.includes(eqName);
      let updated;

      if (exists) {
        updated = prev.filter(e => e !== eqName);
      } else {
        // Détecter si un matériel de la même catégorie / famille est déjà sélectionné
        const groupeId = eqObj?.typeGroupe || eqObj?.categorie;
        const sameGroupEquipments = equipementsDisponibles.filter(i =>
          (eqObj?.typeGroupe && i.typeGroupe === eqObj.typeGroupe) ||
          (!eqObj?.typeGroupe && eqObj?.categorie && i.categorie === eqObj.categorie)
        ).map(i => i.nom);

        const alreadySelectedInGroup = prev.find(item => sameGroupEquipments.includes(item));

        if (alreadySelectedInGroup) {
          updated = [...prev.filter(item => item !== alreadySelectedInGroup), eqName];
          toast.success(`1 seul(e) autorisé(e) : modèle remplacé par ${eqName}`, { icon: '🔄' });
        } else {
          updated = [...prev, eqName];
        }
      }

      // Synchroniser avec le champ formulaire
      const fullList = [...updated];
      if (customEquipement.trim()) fullList.push(customEquipement.trim());
      setForm(f => ({ ...f, equipementsUtilises: fullList.join(', ') }));

      return updated;
    });
  };

  const handleCustomEquipementChange = (val) => {
    setCustomEquipement(val);
    const parts = [...selectedEquipements];
    if (val.trim()) parts.push(val.trim());
    setForm(f => ({ ...f, equipementsUtilises: parts.join(', ') }));
  };

  // Matériel disponible sélectionnable (non bloqué en maintenance)
  const availableEquipments = equipementsDisponibles.filter(eq =>
    eq.etatAvant !== 'En maintenance / Bloqué' &&
    (!eq.incidents || !eq.incidents.some(i => !i.resolu && i.gravite === 'bloquant'))
  );

  const isAllEquipementsSelected = availableEquipments.length > 0 &&
    availableEquipments.every(eq => selectedEquipements.includes(eq.nom));

  const handleToggleAllEquipements = () => {
    if (isAllEquipementsSelected) {
      setSelectedEquipements([]);
      const parts = customEquipement.trim() ? [customEquipement.trim()] : [];
      setForm(f => ({ ...f, equipementsUtilises: parts.join(', ') }));
    } else {
      const allNoms = availableEquipments.map(e => e.nom);
      setSelectedEquipements(allNoms);
      const parts = [...allNoms];
      if (customEquipement.trim()) parts.push(customEquipement.trim());
      setForm(f => ({ ...f, equipementsUtilises: parts.join(', ') }));
      setIsMaterielListOpen(true);
    }
  };

  // Chargement des réservations pour détection des créneaux occupés
  const loadReservations = () => {
    fetch('/api/reservations')
      .then(res => {
        if (!res.ok) throw new Error("Erreur chargement réservations");
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) setExistingReservations(data);
      })
      .catch(err => console.error("Erreur chargement réservations:", err));
  };

  useEffect(() => {
    loadReservations();
  }, []);

  // Nettoyage heure (ex: '09:00:00' -> '09:00')
  const cleanTime = (t) => (t ? String(t).trim().slice(0, 5) : '');

  // Réservations de la date et salle sélectionnées (comparaison insensible au format ISO / time)
  const reservationsDuJour = existingReservations.filter(r => {
    if (r.espace !== espaceKey) return false;
    const rDate = r.dateReservation ? String(r.dateReservation).split('T')[0] : '';
    const fDate = form.dateReservation ? String(form.dateReservation).split('T')[0] : '';
    if (rDate !== fDate) return false;
    // Exclure uniquement les réservations expressément annulées ou refusées
    if (r.statut && ['refuse', 'annule', 'annulee'].includes(r.statut)) return false;

    if (selectedSousSalle) {
      const rSalle = r.salleSpecifique || r.salle;
      if (rSalle) {
        return rSalle === selectedSousSalle;
      }
      const defaultSalle = (SOUS_SALLES[espaceKey] || [])[0]?.id;
      return selectedSousSalle === defaultSalle;
    }
    return true;
  });

  // Détection de chevauchement horaire strict : A < D et B > C
  const isTimeOverlap = (start1, end1, start2, end2) => {
    const s1 = cleanTime(start1);
    const e1 = cleanTime(end1);
    const s2 = cleanTime(start2);
    const e2 = cleanTime(end2);
    if (!s1 || !e1 || !s2 || !e2) return false;
    return s1 < e2 && e1 > s2;
  };

  // Vérifier si un créneau est déjà réservé
  const isSlotBooked = (debut, fin) => {
    return reservationsDuJour.some(r => isTimeOverlap(debut, fin, r.heureDebut, r.heureFin));
  };

  // Si le créneau actuellement sélectionné est réservé, basculer automatiquement sur le premier créneau libre
  useEffect(() => {
    if (!jourFerieInfo.isFerie && isSlotBooked(form.heureDebut, form.heureFin)) {
      const premierLibre = currentCreneaux.find(s => !isSlotBooked(s.debut, s.fin));
      if (premierLibre) {
        setForm(prev => ({ ...prev, heureDebut: premierLibre.debut, heureFin: premierLibre.fin }));
      }
    }
  }, [existingReservations, form.dateReservation, selectedSousSalle, jourFerieInfo.isFerie, currentCreneaux]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nomComplet.trim()) {
      toast.error("Veuillez renseigner votre nom et prénom");
      return;
    }
    if (!form.email.trim()) {
      toast.error("Veuillez renseigner votre adresse email");
      return;
    }
    if (jourFerieInfo.isFerie) {
      toast.error(`Impossible de réserver : le ${new Date(form.dateReservation).toLocaleDateString('fr-FR')} est un jour férié (${jourFerieInfo.nom}). L'établissement est fermé.`);
      return;
    }
    if (!form.heureDebut || !form.heureFin) {
      toast.error(`Veuillez sélectionner un créneau de ${currentDuree} dans la liste`);
      return;
    }
    if (isSlotBooked(form.heureDebut, form.heureFin)) {
      toast.error(`Le créneau ${form.heureDebut} à ${form.heureFin} est déjà réservé. Veuillez choisir un autre créneau libre dans la liste.`);
      return;
    }
    if (espaceKey === 'studio' && !form.thematique.trim()) {
      toast.error("Veuillez renseigner la thématique du podcast");
      return;
    }
    if (!form.motif.trim()) {
      toast.error(espaceKey === 'studio' ? "Veuillez préciser le sujet du podcast" : "Veuillez préciser le motif de votre réservation");
      return;
    }
    if (hasInvites && !form.invitesExternes.trim()) {
      toast.error("Veuillez renseigner les noms des personnes / invités externes");
      return;
    }
    if (!acceptConditions) {
      toast.error("Veuillez lire et accepter les conditions d'utilisation et le règlement intérieur");
      return;
    }

    setLoading(true);
    try {
      let finalMotif = form.motif.trim();
      if (espaceKey === 'studio' && form.thematique.trim()) {
        finalMotif = `[Thématique : ${form.thematique.trim()}] ${finalMotif}`;
      }
      if (hasInvites && form.invitesExternes.trim()) {
        finalMotif = `${finalMotif}\n👥 Invités externes : ${form.invitesExternes.trim()}`;
      }

      const res = await fetch('/api/reservations/demande', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          espace: espaceKey,
          salleSpecifique: selectedSousSalle || null,
          nomComplet: form.nomComplet.trim(),
          email: form.email.trim(),
          telephone: form.telephone ? form.telephone.trim() : '',
          dateReservation: form.dateReservation,
          heureDebut: form.heureDebut,
          heureFin: form.heureFin,
          duree: currentDuree,
          motif: finalMotif,
          equipementsUtilises: form.equipementsUtilises.trim()
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Erreur lors de l'envoi de la réservation");
      }

      setSubmittedData({
        ...form,
        motif: finalMotif,
        salle: selectedSousSalle
      });
      loadReservations();
      toast.success("Demande de réservation transmise avec succès !");
    } catch (err) {
      toast.error(err.message || "Erreur de transmission");
    } finally {
      setLoading(false);
    }
  };

  if (submittedData) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center font-black text-2xl">
            OK
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl font-black">Demande Enregistrée !</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Votre demande pour l'espace <strong>{espaceInfo.nom}</strong> ({submittedData.salle || 'Espace standard'}) le <strong>{new Date(submittedData.dateReservation).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong> de <strong>{submittedData.heureDebut} à {submittedData.heureFin}</strong> a été transmise aux accompagnateurs.
            </p>
          </div>

          <div className="bg-slate-800/80 rounded-2xl p-4 text-left space-y-2 border border-slate-700/60 text-xs">
            <div className="flex justify-between pb-2 border-b border-slate-700/60">
              <span className="text-slate-400">Demandeur :</span>
              <span className="font-bold text-white">{submittedData.nomComplet}</span>
            </div>
            <div className="flex justify-between pb-2 border-b border-slate-700/60">
              <span className="text-slate-400">Email :</span>
              <span className="font-bold text-white font-mono">{submittedData.email}</span>
            </div>
            {submittedData.motif && (
              <div className="pb-2 border-b border-slate-700/60">
                <span className="text-slate-400 block mb-1">
                  {espaceKey === 'studio' ? 'Thématique & Sujet :' : 'Motif / Projet :'}
                </span>
                <span className="text-white text-[11px] whitespace-pre-line leading-relaxed">
                  {submittedData.motif}
                </span>
              </div>
            )}
            {submittedData.equipementsUtilises && (
              <div className="pb-2 border-b border-slate-700/60">
                <span className="text-slate-400 block mb-1">Matériel demandé :</span>
                <span className="text-amber-400 font-semibold text-[11px]">{submittedData.equipementsUtilises}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-400">Statut initial :</span>
              <span className="font-black text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/30 uppercase text-[10px]">
                En attente de validation
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-normal">
            Un email de confirmation vous sera automatiquement adressé dès qu'un responsable aura validé votre créneau.
          </p>

          <button
            onClick={() => {
              setSubmittedData(null);
              setAcceptConditions(false);
              setHasReadToBottom(false);
              setHasInvites(false);
              setForm(f => ({ ...f, motif: '', thematique: '', invitesExternes: '', equipementsUtilises: '' }));
              setSelectedEquipements([]);
              setCustomEquipement('');
            }}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 font-bold text-xs rounded-xl transition text-slate-200 cursor-pointer"
          >
            Faire une autre réservation
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-amber-500 selection:text-navy-950 pb-16">
      {/* HEADER AVEC BANNIÈRE DYNAMIQUE DE L'ESPACE */}
      <header className="relative border-b border-slate-800 overflow-hidden">
        <div className={`absolute inset-0 bg-gradient-to-r ${espaceInfo.color} opacity-15 blur-xl`} />
        <div className="relative max-w-4xl mx-auto px-4 py-8 sm:py-10 text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-amber-400 text-xs font-bold uppercase tracking-wider">
            {espaceInfo.badge}
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            Réservation {espaceInfo.nom}
          </h1>
          <p className="text-sm text-slate-300 max-w-xl mx-auto">
            {espaceInfo.description}
          </p>
        </div>
      </header>

      {/* CONTAINER DU FORMULAIRE */}
      <div className="max-w-2xl mx-auto px-4 mt-8 space-y-6">

        <div className="text-center space-y-1">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            Réservation d'Espace ({currentDuree})
          </h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Sélectionnez votre créneau et vos options dans le formulaire ci-dessous
          </p>
        </div>

        {/* FORMULAIRE DE RÉSERVATION PRINCIPAL COMPACT & PARALLÈLE */}
        <form onSubmit={handleSubmit} className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-2xl backdrop-blur-sm">

          {/* LIGNE 1 : NOM & EMAIL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Nom & Prénom *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Mohamed Alami"
                value={form.nomComplet}
                onChange={e => setForm({ ...form, nomComplet: e.target.value })}
                className="w-full bg-slate-800/80 border border-slate-700 text-white text-xs rounded-xl px-3.5 py-2.5 focus:border-amber-500 outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Email officiel (Inscrit à l'incubateur) *
              </label>
              <input
                type="email"
                required
                placeholder="exemple@email.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full bg-slate-800/80 border border-slate-700 text-white text-xs rounded-xl px-3.5 py-2.5 focus:border-amber-500 outline-none transition-colors"
              />
            </div>
          </div>

          {/* LIGNE 2 : SALLE / ATELIER EXACT */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Salle / Atelier exact *
            </label>
            {sousSallesList.length > 1 ? (
              <div className="relative">
                <select
                  value={selectedSousSalle}
                  onChange={e => {
                    setSelectedSousSalle(e.target.value);
                    const nextParams = new URLSearchParams(searchParams);
                    nextParams.set('salle', e.target.value);
                    setSearchParams(nextParams, { replace: true });
                  }}
                  className="w-full bg-slate-800/80 border border-slate-700 text-white text-xs rounded-xl px-3.5 py-2.5 focus:border-amber-500 outline-none appearance-none transition-colors cursor-pointer"
                >
                  {sousSallesList.map(s => (
                    <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                      {s.nom} — {s.description}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            ) : (
              <div className="w-full bg-slate-800/40 border border-slate-700/60 text-slate-300 text-xs rounded-xl px-3.5 py-2.5 flex items-center justify-between">
                <span className="font-semibold text-white">
                  {sousSallesList[0]?.nom || espaceInfo.nom}
                </span>
                <span className="text-[11px] text-slate-400">
                  {sousSallesList[0]?.description || 'Espace principal'}
                </span>
              </div>
            )}
          </div>

          {/* LIGNE 3 : DATE DE RÉSERVATION */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-300">
              Date souhaitée *
            </label>
            <input
              type="date"
              required
              min={new Date().toISOString().split('T')[0]}
              value={form.dateReservation}
              onChange={e => setForm({ ...form, dateReservation: e.target.value })}
              className={`w-full bg-slate-800/80 border text-white text-xs rounded-xl px-3.5 py-2.5 outline-none transition-colors ${jourFerieInfo.isFerie ? 'border-red-500 focus:border-red-500 text-red-200' : 'border-slate-700 focus:border-amber-500'
                }`}
            />

            {/* ALERTE VISUELLE SI JOUR FÉRIÉ */}
            {jourFerieInfo.isFerie && (
              <div className="mt-2 p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200 flex items-start gap-2.5 text-xs animate-shake">
                <span className="text-base shrink-0">🚫</span>
                <div>
                  <p className="font-bold text-red-300">
                    Établissement fermé : {jourFerieInfo.nom}
                  </p>
                  <p className="text-[11px] text-red-300/80 mt-0.5">
                    Aucune réservation n'est possible les jours fériés officiels. Veuillez sélectionner un autre jour ouvré.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* SÉLECTEUR DE CRÉNEAU */}
          <div className="space-y-2 pt-1 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-300">
                Créneau horaire ({currentDuree}) *
              </label>
              <div className="flex items-center gap-3 text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Libre
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span> Réservé
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span> Sélectionné
                </span>
              </div>
            </div>

            {/* GRILLE DES CRÉNEAUX */}
            <div className={`grid gap-2 ${currentCreneaux.length <= 2 ? 'grid-cols-2' : currentCreneaux.length <= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-4'}`}>
              {currentCreneaux.map((slot) => {
                const isBooked = isSlotBooked(slot.debut, slot.fin);
                const isSelected = form.heureDebut === slot.debut && form.heureFin === slot.fin;
                const isDisabled = isBooked || jourFerieInfo.isFerie;

                return (
                  <button
                    key={slot.label}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      if (!isDisabled) {
                        setForm(prev => ({
                          ...prev,
                          heureDebut: slot.debut,
                          heureFin: slot.fin
                        }));
                      }
                    }}
                    className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 select-none ${isDisabled
                      ? 'bg-slate-900/80 border-slate-800/80 text-slate-500 cursor-not-allowed opacity-50 grayscale'
                      : isSelected
                        ? 'bg-amber-500 text-navy-950 border-amber-500 shadow-lg shadow-amber-500/20 font-bold scale-[1.02] cursor-pointer'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-800 cursor-pointer'
                      }`}
                  >
                    <span className="text-xs font-mono font-bold tracking-tight">
                      {slot.label}
                    </span>
                    <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${isDisabled
                      ? 'bg-slate-800/90 text-slate-400 border border-slate-700/80'
                      : isSelected
                        ? 'bg-navy-950/20 text-navy-950 font-black'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}>
                      {isDisabled ? 'Réservé' : isSelected ? 'Choisi' : 'Disponible'}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="text-[11px] text-slate-400 italic">
              Créneaux fixes de {currentDuree} non fractionnables. Les créneaux occupés sont automatiquement désactivés.
            </p>
          </div>

          {/* MATÉRIEL ET ÉQUIPEMENTS DISPONIBLES */}
          {equipementsDisponibles.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-300">
                    Matériel ou équipement spécifique
                  </label>
                  <p className="text-[10px] text-slate-400">
                    Sélectionnez les machines ou outils nécessaires pour votre session
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleAllEquipements}
                    className="text-xs text-amber-400 hover:text-amber-300 font-semibold cursor-pointer underline decoration-dotted whitespace-nowrap"
                  >
                    {isAllEquipementsSelected ? 'Tout décocher' : 'Tout cocher'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMaterielListOpen(!isMaterielListOpen)}
                    className="text-xs text-slate-300 hover:text-white font-semibold flex items-center gap-1 cursor-pointer bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700 whitespace-nowrap"
                  >
                    <span>{isMaterielListOpen ? 'Masquer' : 'Parcourir'}</span>
                    <ChevronDown
                      size={14}
                      className={`transition-transform duration-200 ${isMaterielListOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                </div>
              </div>

              {/* LISTE DÉROULANTE DU MATÉRIEL */}
              {isMaterielListOpen && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-slate-950/60 rounded-2xl border border-slate-800 max-h-60 overflow-y-auto">
                  {equipementsDisponibles.map(eq => {
                    const isSelected = selectedEquipements.includes(eq.nom);
                    const isMaintenance = eq.etatAvant === 'En maintenance / Bloqué' ||
                      (eq.incidents && eq.incidents.some(i => !i.resolu && i.gravite === 'bloquant'));

                    // Détecter si un autre équipement du même groupe est sélectionné
                    const isAnotherInGroupSelected = !isSelected && selectedEquipements.some(selNom => {
                      const selObj = equipementsDisponibles.find(i => i.nom === selNom);
                      if (eq.typeGroupe && selObj?.typeGroupe) return eq.typeGroupe === selObj.typeGroupe;
                      if (!eq.typeGroupe && eq.categorie && selObj?.categorie) return eq.categorie === selObj.categorie;
                      return false;
                    });

                    return (
                      <div
                        key={eq.id || eq.nom}
                        onClick={() => !isMaintenance && toggleEquipement(eq)}
                        className={`p-2 rounded-xl border transition-all flex items-center justify-between gap-2 select-none ${isMaintenance
                          ? 'opacity-50 cursor-not-allowed bg-red-950/20 border-red-900/40 text-slate-500'
                          : isSelected
                            ? 'bg-amber-500/20 border-amber-500 text-white shadow-sm cursor-pointer'
                            : isAnotherInGroupSelected
                              ? 'bg-slate-800/40 hover:bg-slate-800 border-dashed border-slate-700 text-slate-400 cursor-pointer'
                              : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/60 text-slate-300 cursor-pointer'
                          }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] shrink-0 font-black transition-colors ${isMaintenance
                            ? 'bg-red-500/30 text-red-400 border border-red-500/40'
                            : isSelected
                              ? 'bg-amber-500 text-navy-950'
                              : 'border border-slate-600 bg-slate-700/40 text-transparent'
                            }`}>
                            {isMaintenance ? '✕' : '✓'}
                          </div>
                          <div className="truncate">
                            <span className="text-xs font-medium block truncate">{eq.nom}</span>
                            {eq.desc && (
                              <span className="text-[10px] text-slate-400 block truncate">{eq.desc}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isMaintenance ? (
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40">
                              En maintenance
                            </span>
                          ) : isSelected ? (
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500 text-navy-950 font-mono">
                              1 réservé
                            </span>
                          ) : (
                            <span className="text-[9px] text-slate-500 font-medium">
                              {eq.quantiteTotale ? `${eq.quantiteTotale} dispo` : 'Disponible'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* BADGES DU MATÉRIEL SÉLECTIONNÉ */}
              {selectedEquipements.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {selectedEquipements.map(nom => (
                    <span
                      key={nom}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded-lg"
                    >
                      {nom}
                      <button
                        type="button"
                        onClick={() => toggleEquipement(nom)}
                        className="hover:text-red-400 ml-0.5 cursor-pointer"
                        title="Retirer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* CHAMP MATÉRIEL SUPPLÉMENTAIRE */}
              <input
                type="text"
                placeholder="Autre matériel spécifique ou consommable (ex: filament PLA, caméra...)"
                value={customEquipement}
                onChange={e => handleCustomEquipementChange(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 text-white text-xs rounded-xl px-3.5 py-2 focus:border-amber-500 outline-none placeholder:text-slate-500"
              />
            </div>
          )}

          {/* MOTIF / SUJET DU PODCAST */}
          {espaceKey === 'studio' ? (
            <div className="space-y-3 pt-1 border-t border-slate-800">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Sujet du podcast *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Décrivez précisément le sujet de l'épisode ou de l'enregistrement vidéo..."
                  value={form.motif}
                  onChange={e => setForm({ ...form, motif: e.target.value })}
                  className="w-full bg-slate-800/80 border border-slate-700 text-white text-xs rounded-xl p-2.5 focus:border-amber-500 outline-none placeholder:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Thématique *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Entrepreneuriat tech, IA appliquée, économie circulaire, insertion..."
                  value={form.thematique}
                  onChange={e => setForm({ ...form, thematique: e.target.value })}
                  className="w-full bg-slate-800/80 border border-slate-700 text-white text-xs rounded-xl px-3.5 py-2.5 focus:border-amber-500 outline-none placeholder:text-slate-500"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1 pt-1 border-t border-slate-800">
              <label className="block text-xs font-bold text-slate-300 mb-1">
                {espaceKey === 'salle_reunion'
                  ? 'Objet de la réunion / Ordre du jour *'
                  : 'Projet à réaliser / Objectif de la session *'}
              </label>
              <textarea
                required
                rows={2}
                placeholder={espaceKey === 'salle_reunion'
                  ? "Précisez l'objet de votre réunion ou les points à l'ordre du jour..."
                  : "Décrivez les travaux ou le prototypage à réaliser lors de votre session au FabLab..."}
                value={form.motif}
                onChange={e => setForm({ ...form, motif: e.target.value })}
                className="w-full bg-slate-800/80 border border-slate-700 text-white text-xs rounded-xl p-2.5 focus:border-amber-500 outline-none placeholder:text-slate-500"
              />
            </div>
          )}

          {/* SECTION INVITÉS EXTERNES */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasInvites}
                onChange={e => {
                  const checked = e.target.checked;
                  setHasInvites(checked);
                  if (!checked) {
                    setForm(f => ({ ...f, invitesExternes: '' }));
                  }
                }}
                className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900 cursor-pointer accent-amber-500"
              />
              <span className="text-xs font-bold text-slate-300">
                👥 Y aura-t-il des invités ou personnes externes ?
              </span>
            </label>

            {hasInvites && (
              <div className="space-y-1 pl-6 pt-1">
                <div className="flex items-center justify-between mb-0.5">
                  <label className="block text-xs font-semibold text-amber-400">
                    Noms et prénoms des personnes / invités *
                  </label>
                  <span className="text-[10px] text-slate-400">Clients, partenaires, intervenants</span>
                </div>
                <input
                  type="text"
                  required
                  placeholder="Ex: Karim Alami (Client), Sara Berrada (Intervenante)..."
                  value={form.invitesExternes || ''}
                  onChange={e => setForm({ ...form, invitesExternes: e.target.value })}
                  className="w-full bg-slate-800/80 border border-amber-500/50 text-white text-xs rounded-xl px-3.5 py-2.5 focus:border-amber-500 outline-none placeholder:text-slate-500"
                />
                <p className="text-[10px] text-slate-400">
                  Ce champ est obligatoire lorsque la case est cochée pour préparer l'accès physique des visiteurs.
                </p>
              </div>
            )}
          </div>

          {/* CONDITIONS D'UTILISATION & RÈGLEMENT INTÉRIEUR */}
          <div className="space-y-2.5 pt-3 border-t border-slate-800">
            <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-300 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-slate-200">
                  <span className="text-base">📜</span>
                  <span>ENGAGEMENT D'UTILISATION DU STUDIO DE CRÉATION DE CONTENU</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConditions(prev => !prev)}
                  className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-2 cursor-pointer"
                >
                  {showConditions ? 'Réduire' : 'Lire le règlement'}
                </button>
              </div>

              {showConditions && (
                <>
                  <div
                    ref={conditionsBoxRef}
                    onScroll={(e) => {
                      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
                      if (scrollTop + clientHeight >= scrollHeight - 30) {
                        setHasReadToBottom(true);
                      }
                    }}
                    className="max-h-60 sm:max-h-72 overflow-y-auto pr-2.5 text-[11px] text-slate-300 space-y-3 pt-2.5 border-t border-slate-800/80 leading-relaxed scrollbar-thin scrollbar-thumb-amber-500/40 scrollbar-track-slate-950"
                  >
                    <div className="text-center font-extrabold text-amber-400 text-xs uppercase tracking-wide border-b border-slate-800 pb-2">
                      ENGAGEMENT D'UTILISATION DU STUDIO DE CRÉATION DE CONTENU
                    </div>

                    <p className="text-slate-300 italic bg-slate-950/70 p-3 rounded-lg border border-slate-800 text-[11px] leading-relaxed">
                      Je reconnais que l’<strong>Incubateur Digital Solidaire</strong>, sis à l'angle de l’Avenue Assalam et route de Kénitra, qui relève du réseau du <strong>Centre des Très Petites Entreprises Solidaire (CTPES)</strong>, ci-après dénommé <strong>« IDS »</strong>, met gratuitement à la disposition de ma startup un studio de création de contenu équipé de matériel professionnel de grande valeur.<br /><br />
                      En contrepartie de cet accès privilégié, je m’engage personnellement et au nom de l’ensemble des collaborateurs et invités de ma startup, à respecter scrupuleusement les conditions d’utilisation suivantes :
                    </p>

                    <div className="space-y-1.5 pt-1">
                      <h4 className="font-extrabold text-amber-400 text-xs uppercase tracking-wide">
                        1. ACCÈS ET RÉSERVATION
                      </h4>
                      <ul className="space-y-1.5 pl-1 text-slate-300">
                        <li>• <strong>Autorisation :</strong> L’accès au studio étant soumis à une autorisation préalable, je m'engage à formuler une demande d’autorisation au moins <strong>48 heures ouvrables à l'avance</strong> via le formulaire établi par l’administration de l’IDS, qui peut accepter, proposer un autre créneau horaire, reporter ou refuser la demande.</li>
                        <li>• <strong>Annulation :</strong> Je m'engage à informer l'administration de l’IDS en cas d’annulation de la réservation au moins <strong>24 heures à l'avance</strong>.</li>
                        <li>• <strong>Tiers et Invités :</strong> Je m'engage à déclarer et à faire valider par l'administration, lors de la réservation, l'identité de toute personne externe à la startup amenée à entrer dans le studio, conformément à la procédure et aux formalités mises en place.</li>
                        <li>• <strong>Usage exclusif :</strong> Je m'engage à utiliser le studio uniquement pour les projets de ma startup incubée et je m’interdis formellement toute sous-location ou mise à disposition du studio à un tiers.</li>
                      </ul>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <h4 className="font-extrabold text-amber-400 text-xs uppercase tracking-wide">
                        2. UTILISATION ET PROTECTION DU MATÉRIEL DU STUDIO
                      </h4>
                      <ul className="space-y-1.5 pl-1 text-slate-300">
                        <li>• <strong>État du matériel :</strong> Je m'engage à effectuer une vérification contradictoire avec l’administration de l’IDS en signant l’inventaire du matériel du studio (inventaire d'entrée et de sortie) avant et après chaque session.</li>
                        <li>• <strong>Manipulation :</strong> Je m'engage à ce que le matériel ne soit manipulé que par des personnes formées ou autorisées.</li>
                        <li>• <strong>Notification :</strong> Je m'engage à informer immédiatement l'administration de l’IDS de tout incident, panne ou anomalie constatés sur le matériel.</li>
                        <li>• <strong>Matériel propre :</strong> En cas d’utilisation de matériel propre, je m’engage à notifier à l’administration de l’IDS la liste du matériel utilisé.</li>
                        <li>• <strong>Hygiène et sécurité :</strong> Je m'engage à respecter l'interdiction stricte d'introduire de la nourriture ou des boissons dans le studio.</li>
                        <li>• <strong>Remise à l’état initial :</strong> Je m'engage à restituer le studio dans un état de propreté irréprochable et selon la configuration technique d'origine à la fin de ma session.</li>
                      </ul>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <h4 className="font-extrabold text-amber-400 text-xs uppercase tracking-wide">
                        3. RESPONSABILITÉ FINANCIÈRE ET SANCTIONS
                      </h4>
                      <ul className="space-y-1.5 pl-1 text-slate-300">
                        <li>• <strong>Prise en charge des dégâts :</strong> Je reconnais que ma startup assume la responsabilité juridique et financière des équipements du studio durant la session d’utilisation. En cas de dégradation due à une mauvaise utilisation, une négligence ou le non-respect du présent engagement, je m'engage à rembourser l'intégralité des frais de réparation ou de remplacement à neuf dudit matériel.</li>
                        <li>• <strong>Sanctions :</strong> Je prends acte que tout manquement aux présents engagements et aux règles générales d’utilisation pourra entraîner la suspension immédiate de mon accès au studio.</li>
                      </ul>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <h4 className="font-extrabold text-amber-400 text-xs uppercase tracking-wide">
                        4. RESPONSABILITÉ LÉGALE DU CONTENU
                      </h4>
                      <ul className="space-y-1.5 pl-1 text-slate-300">
                        <li>• <strong>Information sur le contenu :</strong> Je m’engage à renseigner dans la demande d’autorisation les informations essentielles sur le contenu de chaque session d’utilisation du studio.</li>
                        <li>• <strong>Responsabilité Éditoriale :</strong> Je reconnais que ma startup assume de manière pleine et entière la qualité d'éditeur de tous les contenus audio, vidéo ou visuels (podcasts, interviews, vlogs, etc.) réalisés au sein du studio de l’IDS.  
                          <div className="my-1.5 p-2 rounded bg-slate-950/80 border border-slate-800 text-slate-400 italic">
                            L’IDS, en sa qualité d’incubateur, agit exclusivement en tant que facilitateur technique et fournisseur de moyens d’appui à ma startup et ne saurait être qualifié de co-éditeur ou de co-producteur. En conséquence, l'IDS décline toute responsabilité civile ou pénale quant aux messages, opinions et informations diffusés.
                          </div>
                        </li>
                        <li>• <strong>Conformité Légale :</strong> Je m'engage à ce que l'ensemble des productions réalisées dans le studio respectent scrupuleusement la législation marocaine. Le contenu ne doit comporter aucune incitation à la haine, discrimination, diffamation, injure, atteinte à la vie privée, à l'ordre public, etc.</li>
                        <li>• <strong>Clause de garantie et d'indemnisation :</strong> En cas d’action en justice, de plainte, de mise en demeure ou de réclamation d’un tiers (pour violation de droit d’auteur, diffamation, vol de propriété intellectuelle ou autre) visant un contenu produit dans le studio de l’IDS, ma startup s’engage à garantir, défendre et indemniser intégralement l’incubateur IDS contre toutes les conséquences financières (frais d'avocat, dommages et intérêts, amendes).</li>
                      </ul>
                    </div>

                    <div className="pt-2 text-center text-slate-400 font-mono text-[10px]">
                      — Fin du règlement intérieur et de la charte d'engagement IDS —
                    </div>
                  </div>

                  {/* GUIDE SCROLL / STATUT DE LECTURE */}
                  {!hasReadToBottom ? (
                    <div className="flex items-center justify-between text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="animate-bounce">👇</span>
                        <span>Faites défiler le texte jusqu'en bas pour débloquer l'acceptation</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (conditionsBoxRef.current) {
                            conditionsBoxRef.current.scrollTop = conditionsBoxRef.current.scrollHeight;
                            setHasReadToBottom(true);
                          }
                        }}
                        className="text-[10px] uppercase font-bold text-amber-300 underline hover:text-white cursor-pointer shrink-0 ml-2"
                      >
                        Aller en bas ↓
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5 animate-fadeIn">
                      <span>✅</span>
                      <span className="font-semibold">Règlement lu jusqu'au bout. Vous pouvez maintenant cocher la case d'acceptation ci-dessous.</span>
                    </div>
                  )}
                </>
              )}
            </div>

            <label className={`flex items-start gap-2.5 select-none transition-opacity ${!hasReadToBottom ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                required
                disabled={!hasReadToBottom}
                checked={acceptConditions}
                onChange={e => {
                  if (hasReadToBottom) {
                    setAcceptConditions(e.target.checked);
                  }
                }}
                className="w-4 h-4 mt-0.5 rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900 cursor-pointer accent-amber-500 disabled:cursor-not-allowed"
              />
              <span className="text-xs text-slate-300 leading-tight">
                J'ai lu l'intégralité du document et j'accepte sans réserve les conditions d'utilisation et le règlement intérieur de l'incubateur <span className="text-amber-400">*</span>
              </span>
            </label>
          </div>

          {/* BOUTON ENVOI */}
          <button
            type="submit"
            disabled={loading || jourFerieInfo.isFerie || isSlotBooked(form.heureDebut, form.heureFin) || !acceptConditions}
            className={`w-full py-3.5 font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${jourFerieInfo.isFerie || isSlotBooked(form.heureDebut, form.heureFin) || !acceptConditions
              ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60 shadow-none'
              : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-navy-950 shadow-amber-500/20'
              }`}
          >
            {jourFerieInfo.isFerie ? (
              <span>Fermé — Jour férié ({jourFerieInfo.nom})</span>
            ) : isSlotBooked(form.heureDebut, form.heureFin) ? (
              <span>Ce créneau est déjà réservé</span>
            ) : !acceptConditions ? (
              <span>Veuillez accepter le règlement intérieur</span>
            ) : (
              <span>{loading ? 'Envoi en cours...' : `Confirmer ma réservation (${currentDuree})`}</span>
            )}
          </button>
        </form>

        <p className="text-center text-[11px] text-slate-500 font-mono">
          Incubateur Digital Solidaire — Système officiel de réservation
        </p>
      </div>
    </div>
  );
}
