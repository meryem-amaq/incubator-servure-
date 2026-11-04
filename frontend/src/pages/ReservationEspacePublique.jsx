import { useState, useEffect, useMemo } from 'react';
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
  const [showConditions, setShowConditions] = useState(false);

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

  // Réservations de la date et salle sélectionnées
  const reservationsDuJour = existingReservations.filter(r => {
    if (r.espace !== espaceKey) return false;
    if (r.dateReservation !== form.dateReservation) return false;
    if (r.statut !== 'valide' && r.statut !== 'en_attente') return false;

    if (selectedSousSalle) {
      if (r.salleSpecifique) {
        return r.salleSpecifique === selectedSousSalle;
      }
      const defaultSalle = (SOUS_SALLES[espaceKey] || [])[0]?.id;
      return selectedSousSalle === defaultSalle;
    }
    return true;
  });

  // Détection de chevauchement : A < D et B > C
  const isTimeOverlap = (start1, end1, start2, end2) => {
    if (!start1 || !end1 || !start2 || !end2) return false;
    return start1 < end2 && end1 > start2;
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
                      ? 'bg-slate-900/60 border-slate-800 text-slate-600 cursor-not-allowed opacity-60'
                      : isSelected
                        ? 'bg-amber-500 text-navy-950 border-amber-500 shadow-lg shadow-amber-500/20 font-bold scale-[1.02] cursor-pointer'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-800 cursor-pointer'
                      }`}
                  >
                    <span className="text-xs font-mono font-bold tracking-tight">
                      {slot.label}
                    </span>
                    <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${isDisabled
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : isSelected
                        ? 'bg-navy-950/20 text-navy-950 font-black'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}>
                      {isDisabled ? 'Occupé' : isSelected ? 'Choisi' : 'Disponible'}
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
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-bold text-slate-300">
                    Matériel ou équipement spécifique
                  </label>
                  <p className="text-[10px] text-slate-400">
                    Sélectionnez les machines ou outils nécessaires pour votre session
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMaterielListOpen(!isMaterielListOpen)}
                  className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>{isMaterielListOpen ? 'Masquer la liste' : 'Parcourir le matériel'}</span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${isMaterielListOpen ? 'rotate-180' : ''}`}
                  />
                </button>
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
            </div>
          ) : (
            <div className="space-y-1 pt-1 border-t border-slate-800">
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Motif de la réservation / Projet à réaliser *
              </label>
              <textarea
                required
                rows={2}
                placeholder="Décrivez brièvement votre projet (ex: Prototypage de pièce 3D, réunion partenaires, test électronique...)"
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
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-slate-200">
                  <span>📜 Règlement intérieur & Conditions d'utilisation</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConditions(prev => !prev)}
                  className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-2 cursor-pointer"
                >
                  {showConditions ? 'Masquer' : 'Lire le règlement'}
                </button>
              </div>

              {showConditions && (
                <div className="text-[11px] text-slate-400 space-y-1.5 pt-2 border-t border-slate-800 leading-relaxed">
                  <p>• <strong>Ponctualité & Présence :</strong> La présence de la personne ayant réservé est obligatoire. Tout retard supérieur à 15 minutes peut entraîner l'annulation du créneau.</p>
                  <p>• <strong>Respect du matériel :</strong> Tous les équipements mis à disposition (micros, caméras, machines FabLab, écrans) doivent être manipulés avec précaution. Tout dysfonctionnement ou incident doit être immédiatement signalé.</p>
                  <p>• <strong>Restitution propre :</strong> L'espace doit être restitué en parfait état de propreté et rangé à la fin du créneau horaire alloué.</p>
                  <p>• <strong>Règles de sécurité :</strong> Respect strict des consignes de sécurité, de civisme et du protocole d'accès de l'Incubateur Digital Solidaire.</p>
                </div>
              )}
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                required
                checked={acceptConditions}
                onChange={e => setAcceptConditions(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900 cursor-pointer accent-amber-500"
              />
              <span className="text-xs text-slate-300 leading-tight">
                J'ai lu et j'accepte les conditions d'utilisation et le règlement intérieur de l'incubateur <span className="text-amber-400">*</span>
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
