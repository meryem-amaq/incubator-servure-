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
    { id: 'Salle de formation', nom: 'Salle de formation', description: 'Grande salle (20+ pers.)' }
  ],
  fablab: [
    { id: 'Fablab 1', nom: 'Fablab 1 (Étage)', description: 'Atelier Principal • Impression 3D & Laser' },
    { id: 'Sous-sol', nom: 'Fablab Sous-sol', description: 'Fraiseuse CNC & Prototypage lourd' }
  ],
  studio: [
    { id: 'Studio Média', nom: 'Studio Média', description: 'Plateau d\'enregistrement vidéo 4K & Podcast' }
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
    nom: 'Studio Média',
    description: 'Studio d’enregistrement podcast, vidéo 4K, photographie de produits & streaming',
    badge: 'Média & Création de Contenu',
    color: 'from-purple-500 to-indigo-600'
  },
  salle_reunion: {
    nom: 'Salles & Formation',
    description: 'Espaces de réunion et de formation collaboratifs avec visioconférence 4K',
    badge: 'Collaboration & Formation',
    color: 'from-blue-500 to-cyan-600'
  }
};

// Configuration des créneaux et durées par type d'espace :
// - FabLab : de 08h à 16h (8 créneaux de 1h)
// - Studio : de 08h à 16h (4 créneaux de 2h)
// - Salles : de 08h à 20h (6 créneaux de 2h)
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
    { debut: '08:00', fin: '10:00', label: '08h - 10h' },
    { debut: '10:00', fin: '12:00', label: '10h - 12h' },
    { debut: '12:00', fin: '14:00', label: '12h - 14h' },
    { debut: '14:00', fin: '16:00', label: '14h - 16h' },
  ],
  salle_reunion: [
    { debut: '08:00', fin: '10:00', label: '08h - 10h' },
    { debut: '10:00', fin: '12:00', label: '10h - 12h' },
    { debut: '12:00', fin: '14:00', label: '12h - 14h' },
    { debut: '14:00', fin: '16:00', label: '14h - 16h' },
    { debut: '16:00', fin: '18:00', label: '16h - 18h' },
    { debut: '18:00', fin: '20:00', label: '18h - 20h' },
  ]
};

const DUREE_PAR_ESPACE = {
  fablab: '1h',
  studio: '2h',
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
      dateReservation: new Date().toISOString().split('T')[0],
      heureDebut: slots[0]?.debut || '08:00',
      heureFin: slots[0]?.fin || '09:00',
      motif: '',
      equipementsUtilises: ''
    };
  });

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
      .catch(() => {});
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

  // Réinitialiser les équipements sélectionnés lors du changement de sous-salle ou d'espace
  useEffect(() => {
    setSelectedEquipements([]);
    setForm(f => ({
      ...f,
      equipementsUtilises: customEquipement ? customEquipement.trim() : ''
    }));
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
      const isSelected = prev.includes(eqName);
      let next;

      if (isSelected) {
        next = prev.filter(item => item !== eqName);
      } else {
        // Détecter si un matériel de la même catégorie / famille est déjà sélectionné
        const groupeId = eqObj?.typeGroupe || eqObj?.categorie;
        const sameGroupEquipments = equipementsDisponibles.filter(i => 
          (eqObj?.typeGroupe && i.typeGroupe === eqObj.typeGroupe) ||
          (!eqObj?.typeGroupe && eqObj?.categorie && i.categorie === eqObj.categorie)
        ).map(i => i.nom);

        const alreadySelectedInGroup = prev.find(item => sameGroupEquipments.includes(item));
        if (alreadySelectedInGroup) {
          // Remplacement automatique du modèle pour respecter la règle (1 seul max par réservation)
          const filtered = prev.filter(item => item !== alreadySelectedInGroup);
          next = [...filtered, eqName];
          toast.success(`1 seul(e) autorisé(e) : modèle remplacé par ${eqName}`, { icon: '🔄' });
        } else {
          next = [...prev, eqName];
        }
      }

      const parts = [...next];
      if (customEquipement.trim()) parts.push(customEquipement.trim());
      setForm(f => ({ ...f, equipementsUtilises: parts.join(', ') }));
      return next;
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
      toast.error("Veuillez renseigner votre nom complet");
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
    if (!form.motif.trim()) {
      toast.error("Veuillez préciser le motif de votre réservation");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/reservations/demande', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          espace: espaceKey,
          salleSpecifique: selectedSousSalle || null,
          nomComplet: form.nomComplet.trim(),
          email: form.email.trim(),
          telephone: form.telephone.trim(),
          dateReservation: form.dateReservation,
          heureDebut: form.heureDebut,
          heureFin: form.heureFin,
          duree: currentDuree,
          motif: form.motif.trim(),
          equipementsUtilises: form.equipementsUtilises.trim()
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Erreur lors de l'envoi de la réservation");
      }

      setSubmittedData({
        ...form,
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
              Votre réservation pour <strong>{espaceInfo.nom}</strong> {submittedData.salle ? `(${submittedData.salle})` : ''} a bien été enregistrée.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80 text-left text-xs space-y-2">
            {submittedData.salle && (
              <p><strong>Salle / Atelier :</strong> <span className="font-bold text-amber-400">{submittedData.salle}</span></p>
            )}
            <p><strong>Date :</strong> {new Date(submittedData.dateReservation).toLocaleDateString('fr-FR')}</p>
            <p><strong>Créneau ({currentDuree}) :</strong> {submittedData.heureDebut} à {submittedData.heureFin}</p>
            <p><strong>Demandeur :</strong> {submittedData.nomComplet}</p>
            {submittedData.equipementsUtilises && (
              <p><strong>Matériel :</strong> {submittedData.equipementsUtilises}</p>
            )}
            {submittedData.motif && (
              <p><strong>Motif :</strong> {submittedData.motif}</p>
            )}
          </div>

          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs">
            Un email de confirmation vous sera envoyé dès validation de votre créneau.
          </div>

          <button
            onClick={() => setSubmittedData(null)}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-navy-950 font-black text-xs rounded-xl transition-all cursor-pointer shadow-lg shadow-amber-500/20"
          >
            Faire une autre réservation
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col justify-center py-10 px-4">
      <div className="max-w-xl w-full mx-auto space-y-5">

        {/* EN-TÊTE ÉPURÉ */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[11px] font-extrabold uppercase">
            <span>{espaceInfo.nom}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Réservation d'Espace ({currentDuree})
          </h1>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Sélectionnez votre créneau et votre matériel dans les listes ci-dessous
          </p>
        </div>

        {/* FORMULAIRE DE RÉSERVATION PRINCIPAL COMPACT & PARALLÈLE */}
        <form onSubmit={handleSubmit} className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-2xl backdrop-blur-sm">
          
          {/* LIGNE 1 : NOM & TÉLÉPHONE EN PARALLÈLE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Nom & Prénom de l'incubé *
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
                Téléphone
              </label>
              <input
                type="tel"
                placeholder="06 XX XX XX XX"
                value={form.telephone}
                onChange={e => setForm({ ...form, telephone: e.target.value })}
                className="w-full bg-slate-800/80 border border-slate-700 text-white text-xs rounded-xl px-3.5 py-2.5 focus:border-amber-500 outline-none transition-colors"
              />
            </div>
          </div>

          {/* LIGNE 2 : EMAIL & SALLE EN PARALLÈLE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Email de confirmation *
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
                      setSearchParams({ salle: e.target.value });
                    }}
                    className="w-full bg-slate-800/80 border border-slate-700 text-white text-xs rounded-xl px-3.5 pr-8 py-2.5 focus:border-amber-500 outline-none cursor-pointer appearance-none font-bold"
                  >
                    {sousSallesList.map(s => (
                      <option key={s.id} value={s.id} className="bg-slate-900 text-white font-sans">
                        {s.nom}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              ) : (
                <div className="flex items-center px-3.5 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/60 text-xs font-bold text-amber-400">
                  <span className="truncate">{selectedSousSalle || espaceInfo.nom}</span>
                </div>
              )}
            </div>
          </div>

          {/* LIGNE 3 : DATE DE RÉSERVATION & LISTE DÉROULANTE DES HEURES EN PARALLÈLE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-300">
                  Date de réservation *
                </label>
                {jourFerieInfo.isFerie && (
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                    Jour Férié
                  </span>
                )}
              </div>
              <input
                type="date"
                required
                min={new Date().toISOString().split('T')[0]}
                value={form.dateReservation}
                onChange={e => {
                  const newDate = e.target.value;
                  setForm({ ...form, dateReservation: newDate });
                  const ferie = getJourFerieInfo(newDate);
                  if (ferie.isFerie) {
                    toast.error(`Le ${new Date(newDate).toLocaleDateString('fr-FR')} est un jour férié (${ferie.nom}). L'établissement est fermé.`);
                  }
                }}
                className={`w-full border text-xs rounded-xl px-3.5 py-2.5 outline-none cursor-pointer font-mono transition-colors ${
                  jourFerieInfo.isFerie
                    ? 'bg-red-500/10 border-red-500/50 text-red-300 focus:border-red-500'
                    : 'bg-slate-800/80 border border-slate-700 text-white focus:border-amber-500'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Créneau horaire ({currentDuree} par réservation) *
              </label>
              <div className="relative">
                <select
                  required
                  disabled={jourFerieInfo.isFerie}
                  value={jourFerieInfo.isFerie ? '' : `${form.heureDebut}-${form.heureFin}`}
                  onChange={e => {
                    const [deb, fin] = e.target.value.split('-');
                    setForm(prev => ({ ...prev, heureDebut: deb, heureFin: fin }));
                  }}
                  className={`w-full border text-xs rounded-xl px-3.5 pr-8 py-2.5 outline-none font-bold font-mono transition-colors ${
                    jourFerieInfo.isFerie
                      ? 'bg-red-500/10 border-red-500/40 text-red-400 cursor-not-allowed appearance-none'
                      : 'bg-slate-800/80 border-slate-700 text-white focus:border-amber-500 cursor-pointer appearance-none'
                  }`}
                >
                  {jourFerieInfo.isFerie ? (
                    <option value="" disabled className="bg-slate-900 text-red-400 font-sans">
                      Établissement fermé ({jourFerieInfo.nom})
                    </option>
                  ) : (
                    currentCreneaux.map(slot => {
                      const booked = isSlotBooked(slot.debut, slot.fin);
                      return (
                        <option
                          key={slot.label}
                          value={`${slot.debut}-${slot.fin}`}
                          disabled={booked}
                          className={booked ? 'bg-slate-800 text-slate-500 font-normal line-through' : 'bg-slate-900 text-emerald-400 font-bold'}
                        >
                          {slot.label} {booked ? '[RÉSERVÉ - Indisponible]' : '[Libre]'}
                        </option>
                      );
                    })
                  )}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* BANDEAU JOUR FÉRIÉ OU ÉTAT DES CRÉNEAUX */}
          {jourFerieInfo.isFerie ? (
            <div className="p-3 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-200 text-xs font-bold animate-fadeIn">
              <p className="text-red-300 font-black">
                Jour Férié Officiel : {jourFerieInfo.nom}
              </p>
              <p className="text-[11px] text-red-200/80 font-medium mt-0.5">
                L'incubateur et ses espaces sont fermés le {new Date(form.dateReservation).toLocaleDateString('fr-FR')}. Veuillez choisir une autre date ouvrable.
              </p>
            </div>
          ) : reservationsDuJour.length > 0 ? (
            <div className="text-[11px] text-amber-300/90 font-mono bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl">
              <span>Créneau(x) déjà réservé(s) pour cette date : {reservationsDuJour.map(r => `${r.heureDebut}-${r.heureFin}`).join(', ')}</span>
            </div>
          ) : (
            <div className="text-[11px] text-emerald-300 font-mono bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
              <span>Tous les créneaux horaires sont actuellement libres pour cette date.</span>
            </div>
          )}

          {/* MATÉRIEL SOUS FORME DE LISTE DÉROULANTE INTERACTIVE */}
          {equipementsDisponibles.length > 0 && (
            <div className="space-y-1.5 pt-1 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-300">
                  Matériel & Équipements de la salle :
                </label>
                <span className="text-[10px] text-amber-400 font-bold">
                  {selectedEquipements.length} sélectionné(s)
                </span>
              </div>

              {/* BOUTON DÉROULANT DE LA LISTE DU MATÉRIEL */}
              <div className="relative">
                <div
                  onClick={() => setIsMaterielListOpen(!isMaterielListOpen)}
                  className={`w-full p-2.5 rounded-xl bg-slate-800/80 border cursor-pointer flex items-center justify-between gap-2 transition-all select-none ${
                    isMaterielListOpen ? 'border-amber-500 shadow-md' : 'border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate min-w-0">
                    <span className="text-xs text-slate-300 truncate">
                      {selectedEquipements.length === 0
                        ? "Cliquez pour afficher et choisir le matériel dans la liste..."
                        : `${selectedEquipements.length} équipement(s) : ${selectedEquipements.join(', ')}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] font-bold text-amber-400">
                      {isMaterielListOpen ? "Fermer" : "Ouvrir la liste"}
                    </span>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${isMaterielListOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {/* CONTENU DE LA LISTE DÉROULANTE */}
                {isMaterielListOpen && (
                  <div className="mt-2 p-2.5 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl space-y-1.5 z-20 relative animate-fadeIn max-h-60 overflow-y-auto">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-[11px] text-slate-400">
                      <span>Cochez le ou les équipements nécessaires :</span>
                      <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                        1 seul exemplaire par type (ex: 1 caméra max)
                      </span>
                    </div>
                    {equipementsDisponibles.map(eq => {
                      const isSelected = selectedEquipements.includes(eq.nom);
                      const isMaintenance = eq.etatAvant === 'En maintenance / Bloqué' || eq.incidents?.some(inc => !inc.resolu && inc.gravite === 'bloquant');
                      
                      // Détecter si un autre équipement du même groupe est sélectionné
                      const isAnotherInGroupSelected = !isSelected && selectedEquipements.some(selNom => {
                        const selObj = equipementsDisponibles.find(i => i.nom === selNom);
                        return selObj && (
                          (eq.typeGroupe && selObj.typeGroupe === eq.typeGroupe) ||
                          (!eq.typeGroupe && eq.categorie && selObj.categorie === eq.categorie)
                        );
                      });

                      return (
                        <div
                          key={eq.id || eq.nom}
                          onClick={() => !isMaintenance && toggleEquipement(eq)}
                          className={`p-2 rounded-xl border transition-all flex items-center justify-between gap-2 select-none ${
                            isMaintenance
                              ? 'opacity-50 cursor-not-allowed bg-red-950/20 border-red-900/40 text-slate-500'
                              : isSelected
                              ? 'bg-amber-500/20 border-amber-500 text-white shadow-sm cursor-pointer'
                              : isAnotherInGroupSelected
                              ? 'bg-slate-800/40 hover:bg-slate-800 border-dashed border-slate-700 text-slate-400 cursor-pointer'
                              : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/60 text-slate-300 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] shrink-0 font-black transition-colors ${
                              isMaintenance
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
                            ) : isAnotherInGroupSelected ? (
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-800 text-amber-300/90 border border-amber-500/30">
                                Échanger
                              </span>
                            ) : null}

                            {eq.categorie && (
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-700 shrink-0">
                                {eq.categorie}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* BADGES DES ÉQUIPEMENTS CHOISIS */}
              {selectedEquipements.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {selectedEquipements.map(nom => (
                    <span
                      key={nom}
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-amber-500/15 text-amber-200 border border-amber-500/30 text-[11px] font-semibold"
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

          {/* MOTIF DE LA RÉSERVATION */}
          <div className="space-y-1 pt-1 border-t border-slate-800">
            <label className="block text-xs font-bold text-slate-300">
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

          {/* BOUTON ENVOI */}
          <button
            type="submit"
            disabled={loading || jourFerieInfo.isFerie || isSlotBooked(form.heureDebut, form.heureFin)}
            className={`w-full py-3.5 font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
              jourFerieInfo.isFerie || isSlotBooked(form.heureDebut, form.heureFin)
                ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-70 shadow-none'
                : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-navy-950 shadow-amber-500/20'
            }`}
          >
            {jourFerieInfo.isFerie ? (
              <span>Fermé — Jour férié ({jourFerieInfo.nom})</span>
            ) : isSlotBooked(form.heureDebut, form.heureFin) ? (
              <span>Ce créneau est déjà réservé</span>
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
