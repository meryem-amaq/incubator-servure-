import { useState, useEffect } from 'react';
import {
  Wrench,
  Plus,
  Trash2,
  Search,
  AlertTriangle,
  Upload,
  Eye,
  CheckCircle2,
  X,
  Image as ImageIcon,
  Building2,
  Camera,
  Users,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_EQUIPEMENTS } from '../data/equipementsEspaces';

const ESPACES = [
  { 
    id: 'fablab', 
    nom: 'Espace Fablab', 
    desc: 'Atelier Fablab 1 (Étage) & Sous-sol • Prototypage, Impression 3D & Fraisage CNC',
    salles: ['Fablab 1', 'Sous-sol'],
    icon: Wrench
  },
  { 
    id: 'studio', 
    nom: 'Studio Média / Photo', 
    desc: 'Plateau tournage, Caméras 4K, Micros studio & Podcasting',
    salles: ['Studio Média'],
    icon: Camera
  },
  { 
    id: 'salle_reunion', 
    nom: 'Salles & Formation', 
    desc: 'Salle 1, Salle 2 & Salle de formation • Écrans interactifs 4K & Visioconférence',
    salles: ['Salle 1', 'Salle 2', 'Salle de formation'],
    icon: Users
  }
];

export const ETATS_AVANT = [
  { value: 'Opérationnel / Parfait état', label: '🟢 Opérationnel / Parfait état' },
  { value: 'Bon état / Prêt à l\'emploi', label: '🔵 Bon état / Prêt à l\'emploi' },
  { value: 'Légère usure / À surveiller', label: '🟡 Légère usure / À surveiller' },
  { value: 'En maintenance / Bloqué', label: '🟠 En maintenance / Bloqué' },
  { value: 'Ne marche plus / Hors service', label: '🔴 Ne marche plus / Hors service' }
];

export default function GestionMateriel() {
  const { user, isSuperAdmin } = useAuth();
  const [selectedEspace, setSelectedEspace] = useState('fablab');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSalleFilter, setSelectedSalleFilter] = useState('all');
  const [selectedEtatFilter, setSelectedEtatFilter] = useState('all');

  // Équipements synchronisés avec le backend BDD et persistés
  const [equipements, setEquipements] = useState(() => {
    try {
      const saved = localStorage.getItem('ids_equipements_espaces');
      if (saved) return JSON.parse(saved);
      return DEFAULT_EQUIPEMENTS;
    } catch {
      return DEFAULT_EQUIPEMENTS;
    }
  });

  // Indicateur de synchronisation avec le serveur
  const [isSynced, setIsSynced] = useState(false);

  // Chargement initial depuis l'API backend MariaDB
  useEffect(() => {
    let isMounted = true;
    api.get('/equipements-espaces')
      .then(res => {
        if (isMounted && res.data && typeof res.data === 'object' && Object.keys(res.data).length > 0) {
          setEquipements(res.data);
          localStorage.setItem('ids_equipements_espaces', JSON.stringify(res.data));
          setIsSynced(true);
        }
      })
      .catch(err => {
        console.warn("Échec chargement équipements API, utilisation du cache :", err.message);
      });
    return () => { isMounted = false; };
  }, []);

  // Sauvegarde automatique dans localStorage
  useEffect(() => {
    localStorage.setItem('ids_equipements_espaces', JSON.stringify(equipements));
  }, [equipements]);

  // Modal d'ajout de matériel
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEquipement, setNewEquipement] = useState({
    nom: '',
    numeroSerie: '',
    categorie: 'Général',
    salle: '',
    desc: '',
    etatAvant: 'Opérationnel / Parfait état'
  });

  // Modal de signalement de problème avec photo
  const [problemModal, setProblemModal] = useState({
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

  // Modal de consultation d'incident et résolution
  const [viewProblemModal, setViewProblemModal] = useState({
    open: false,
    equipement: null,
    espace: '',
    incident: null
  });

  // Vérifier unicité du N° de série
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

  // Ajouter un équipement
  const handleAddEquipement = async (e) => {
    e.preventDefault();
    if (!newEquipement.nom.trim()) {
      toast.error("Veuillez renseigner le nom du matériel.");
      return;
    }

    const candidateSerial = newEquipement.numeroSerie.trim() || `SN-${selectedEspace.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    const duplicate = findEquipmentBySerial(candidateSerial);
    if (duplicate) {
      toast.error(`Le numéro de série "${candidateSerial}" est déjà utilisé par "${duplicate.equipment.nom}". Chaque matériel doit avoir un numéro unique !`);
      return;
    }

    const currentEspObj = ESPACES.find(e => e.id === selectedEspace);
    const salleParDefaut = currentEspObj?.salles ? currentEspObj.salles[0] : '';

    const item = {
      id: Date.now(),
      nom: newEquipement.nom.trim(),
      numeroSerie: candidateSerial,
      categorie: newEquipement.categorie || 'Général',
      salle: newEquipement.salle || salleParDefaut,
      desc: newEquipement.desc.trim(),
      etatAvant: newEquipement.etatAvant || 'Opérationnel / Parfait état',
      incidents: []
    };

    let createdItem = item;
    // Persistance API backend
    try {
      const res = await api.post('/equipements-espaces', {
        espace: selectedEspace,
        nom: item.nom,
        numeroSerie: item.numeroSerie,
        categorie: item.categorie,
        salle: item.salle,
        desc: item.desc,
        etatAvant: item.etatAvant,
        etatApres: 'Conforme & Rendu propre'
      });
      if (res.data?.data) {
        createdItem = res.data.data;
      }
    } catch (err) {
      console.error("Erreur création équipement backend:", err.message);
      toast.error(err.response?.data?.message || "Erreur lors de la création de l'équipement dans la base de données");
      return;
    }

    setEquipements(prev => ({
      ...prev,
      [selectedEspace]: [...(prev[selectedEspace] || []), createdItem]
    }));

    setNewEquipement({
      nom: '',
      numeroSerie: '',
      categorie: 'Général',
      salle: '',
      desc: '',
      etatAvant: 'Opérationnel / Parfait état'
    });

    setIsAddModalOpen(false);
    toast.success(`Matériel "${createdItem.nom}" ajouté avec succès à l'inventaire !`);
  };

  // Mettre à jour un champ direct du matériel (onChange en direct, toast et vérification onBlur pour n° de série)
  const handleUpdateEquipementField = async (espaceId, id, field, value, commit = true) => {
    if (!isSynced) {
      toast.error("L'inventaire n'est pas synchronisé avec le serveur. Modifications temporairement bloquées.");
      return;
    }

    if (field === 'numeroSerie') {
      if (!commit) {
        setEquipements(prev => ({
          ...prev,
          [espaceId]: (prev[espaceId] || []).map(eq => eq.id === id ? { ...eq, [field]: value } : eq)
        }));
        return;
      }

      const trimmed = String(value || '').trim();
      if (trimmed) {
        const duplicate = findEquipmentBySerial(trimmed, id);
        if (duplicate) {
          toast.error(`Le numéro de série "${trimmed}" est déjà attribué à "${duplicate.equipment.nom}".`);
          return;
        }
      }
    }

    const prevItem = (equipements[espaceId] || []).find(eq => eq.id === id);
    const previousVal = prevItem ? prevItem[field] : undefined;

    setEquipements(prev => ({
      ...prev,
      [espaceId]: (prev[espaceId] || []).map(eq => eq.id === id ? { ...eq, [field]: value } : eq)
    }));

    // Synchronisation backend
    try {
      await api.put(`/equipements-espaces/${id}`, { [field]: value });
      toast.success(field === 'numeroSerie' ? "N° de série mis à jour" : "État du matériel mis à jour");
    } catch (err) {
      console.warn("Erreur mise à jour équipement API:", err.message);
      if (previousVal !== undefined) {
        setEquipements(prev => ({
          ...prev,
          [espaceId]: (prev[espaceId] || []).map(eq => eq.id === id ? { ...eq, [field]: previousVal } : eq)
        }));
      }
      toast.error(err.response?.data?.message || "Erreur lors de la mise à jour de l'équipement");
    }
  };

  // Supprimer un équipement
  const handleDeleteEquipement = async (espaceId, id) => {
    if (!isSynced) {
      toast.error("L'inventaire n'est pas synchronisé avec le serveur. Suppression impossible.");
      return;
    }

    if (window.confirm("Voulez-vous vraiment supprimer cet équipement de l'inventaire ?")) {
      try {
        await api.delete(`/equipements-espaces/${id}`);
        setEquipements(prev => ({
          ...prev,
          [espaceId]: (prev[espaceId] || []).filter(eq => eq.id !== id)
        }));
        toast.success("Équipement retiré de l'inventaire");
      } catch (err) {
        console.error("Erreur suppression équipement:", err.message);
        toast.error(err.response?.data?.message || "Erreur lors de la suppression de l'équipement");
      }
    }
  };

  // Ouvrir modal signalement
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

  // Upload et compression Canvas de l'image de la panne
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
        toast.success("Photo du matériel chargée avec succès !");
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Enregistrer le problème avec sa photo
  const handleSaveProblem = async (e) => {
    e.preventDefault();
    if (!problemModal.description.trim()) {
      toast.error('Veuillez décrire le problème rencontré.');
      return;
    }

    try {
      const res = await api.post(`/equipements-espaces/${problemModal.equipementId}/incidents`, {
        titre: problemModal.titre.trim() || 'Panne signalée',
        description: problemModal.description.trim(),
        gravite: problemModal.gravite,
        photo: problemModal.photo,
        signalePar: user?.nom ? `${user.prenom || ''} ${user.nom}`.trim() : 'Responsable Espace'
      });

      const updatedEquipment = res.data?.data;
      if (updatedEquipment) {
        setEquipements(prev => ({
          ...prev,
          [problemModal.espace]: (prev[problemModal.espace] || []).map(item =>
            item.id === problemModal.equipementId ? updatedEquipment : item
          )
        }));
      }

      toast.success('Problème et photo enregistrés avec succès !', { icon: '⚠️' });
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
    } catch (err) {
      console.error("Erreur signalement incident:", err.message);
      toast.error(err.response?.data?.message || "Erreur lors de l'enregistrement de l'incident");
    }
  };

  // Ouvrir la vue détaillée de l'incident avec photo agrandie
  const handleOpenViewProblemModal = (eq) => {
    const activeIncident = (eq.incidents || []).find(inc => !inc.resolu) || (eq.incidents || [])[0];
    setViewProblemModal({
      open: true,
      equipement: eq,
      espace: selectedEspace,
      incident: activeIncident
    });
  };

  // Marquer l'incident comme réparé / résolu
  const handleResoudreIncident = async (espaceKey, equipementId) => {
    const targetEq = (equipements[espaceKey] || []).find(e => e.id === equipementId);
    const incidentToResolve = viewProblemModal?.incident || (targetEq?.incidents || []).find(inc => !inc.resolu);

    try {
      let updatedEquipment = null;
      if (incidentToResolve?.id) {
        const res = await api.put(`/equipements-espaces/${equipementId}/incidents/${incidentToResolve.id}/resoudre`);
        updatedEquipment = res.data?.data;
      } else {
        const res = await api.put(`/equipements-espaces/${equipementId}`, {
          etatAvant: 'Opérationnel / Parfait état'
        });
        updatedEquipment = res.data?.data;
      }

      if (updatedEquipment) {
        setEquipements(prev => ({
          ...prev,
          [espaceKey]: (prev[espaceKey] || []).map(item => item.id === equipementId ? updatedEquipment : item)
        }));
      }

      toast.success('Matériel remis en état : problème résolu et statut opérationnel rétabli !', { icon: '✅' });
      setViewProblemModal({ open: false, equipement: null, espace: '', incident: null });
    } catch (err) {
      console.error("Erreur résolution incident:", err.message);
      toast.error(err.response?.data?.message || "Erreur lors de la résolution de l'incident");
    }
  };

  // Filtrage du matériel de l'espace sélectionné
  const currentList = equipements[selectedEspace] || [];
  const filteredList = currentList.filter(eq => {
    if (selectedSalleFilter !== 'all' && eq.salle !== selectedSalleFilter) return false;
    if (selectedEtatFilter === 'panne') {
      const hasActive = (eq.incidents || []).some(inc => !inc.resolu);
      if (!hasActive && eq.etatAvant !== 'En maintenance / Bloqué') return false;
    } else if (selectedEtatFilter === 'operationnel') {
      if (eq.etatAvant !== 'Opérationnel / Parfait état' && eq.etatAvant !== 'Bon état / Prêt à l\'emploi') return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const mNom = eq.nom.toLowerCase().includes(q);
      const mSerie = (eq.numeroSerie || '').toLowerCase().includes(q);
      const mCat = (eq.categorie || '').toLowerCase().includes(q);
      if (!mNom && !mSerie && !mCat) return false;
    }
    return true;
  });

  const currentEspObj = ESPACES.find(e => e.id === selectedEspace);

  return (
    <div className="slide-up space-y-6 w-full pb-12">
      {/* EN-TÊTE DE PAGE AVEC BOUTON D'ACTION AJOUTER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <Wrench className="text-amber-500" size={26} /> Inventaire & Gestion du Matériel
          </h1>
          <p className="text-xs text-slate-500 dark:text-dark-400 mt-1">
            Gérez l'inventaire exact de chaque espace, suivez l'état opérationnel et signalez les pannes avec photos
          </p>
        </div>

        <button
          onClick={() => {
            const defaultSalle = currentEspObj?.salles ? currentEspObj.salles[0] : '';
            setNewEquipement(prev => ({ ...prev, salle: defaultSalle }));
            setIsAddModalOpen(true);
          }}
          className="btn btn-primary text-xs font-bold py-2.5 px-4 flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer self-start sm:self-auto"
        >
          <Plus size={16} /> Ajouter un Équipement
        </button>
      </div>

      {/* SÉLECTEUR D'ESPACES (FABLAB / STUDIO / SALLES) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ESPACES.map(esp => {
          const count = (equipements[esp.id] || []).length;
          const pannesCount = (equipements[esp.id] || []).filter(eq => 
            eq.etatAvant === 'En maintenance / Bloqué' || (eq.incidents || []).some(inc => !inc.resolu)
          ).length;

          return (
            <button
              key={esp.id}
              onClick={() => {
                setSelectedEspace(esp.id);
                setSelectedSalleFilter('all');
              }}
              className={`card p-5 text-left border-2 transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                selectedEspace === esp.id
                  ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-lg scale-[1.02]'
                  : 'border-slate-200 dark:border-dark-700/60 hover:border-slate-300 dark:hover:border-dark-600'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="w-9 h-9 rounded-xl bg-slate-900 text-white dark:bg-dark-800 flex items-center justify-center font-bold text-sm">
                    <esp.icon size={18} />
                  </span>
                  <div className="flex items-center gap-1.5">
                    {pannesCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-500 text-white animate-pulse">
                        {pannesCount} Panne{pannesCount > 1 ? 's' : ''}
                      </span>
                    )}
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-dark-200">
                      {count} machine{count > 1 ? 's' : ''}
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
            </button>
          );
        })}
      </div>

      {/* BARRE D'OUTILS ET DE FILTRAGE DU MATÉRIEL */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-200 dark:border-dark-700 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
            Parc de l'espace : {currentEspObj?.nom}
          </span>
          <span className="badge badge-green text-xs font-bold">
            {filteredList.length} équipement{filteredList.length > 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
          {/* Recherche */}
          <div className="relative w-full sm:w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher machine, n° série..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
            />
          </div>

          {/* Filtre par salle */}
          {currentEspObj?.salles && currentEspObj.salles.length > 1 && (
            <select
              value={selectedSalleFilter}
              onChange={(e) => setSelectedSalleFilter(e.target.value)}
              className="bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-dark-200 outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">Toutes les salles ({currentList.length})</option>
              {currentEspObj.salles.map(s => (
                <option key={s} value={s}>
                  {s} ({currentList.filter(eq => eq.salle === s).length})
                </option>
              ))}
            </select>
          )}

          {/* Filtre par état */}
          <select
            value={selectedEtatFilter}
            onChange={(e) => setSelectedEtatFilter(e.target.value)}
            className="bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-dark-200 outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="all">Tous les états ({currentList.length})</option>
            <option value="operationnel">Opérationnels</option>
            <option value="panne">En panne / Incident</option>
          </select>
        </div>
      </div>

      {/* TABLEAU PRINCIPAL DU MATÉRIEL */}
      <div className="card p-0 border border-slate-200 dark:border-dark-700/60 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-dark-700/60 bg-slate-50 dark:bg-dark-800/60 text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                <th className="py-3 px-3.5 w-10 text-center">#</th>
                <th className="py-3 px-3.5">Équipement & N° de Série</th>
                <th className="py-3 px-3.5">Catégorie & Salle</th>
                <th className="py-3 px-3.5">Occupant / Réservation</th>
                <th className="py-3 px-3.5">État (Avant / Après)</th>
                <th className="py-3 px-3.5">Statut Panne / Incident & Photo</th>
                <th className="py-3 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-800/60">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Wrench size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="font-bold text-sm">Aucun équipement trouvé pour ce critère</p>
                  </td>
                </tr>
              ) : (
                filteredList.map((eq, idx) => {
                  const currentEtat = eq.etatAvant || 'Opérationnel / Parfait état';
                  const activeIncident = (eq.incidents || []).find(inc => !inc.resolu);

                  return (
                    <tr key={eq.id} className="hover:bg-slate-50 dark:hover:bg-dark-800/40 transition-colors">
                      <td className="py-3 px-3.5 font-mono font-bold text-slate-400 text-center">{idx + 1}</td>
                      
                      {/* Équipement & N° de série */}
                      <td className="py-3 px-3.5">
                        <p className="font-black text-slate-900 dark:text-white text-xs">{eq.nom}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <input
                            type="text"
                            value={eq.numeroSerie || ''}
                            onChange={(e) => handleUpdateEquipementField(selectedEspace, eq.id, 'numeroSerie', e.target.value, false)}
                            onBlur={(e) => handleUpdateEquipementField(selectedEspace, eq.id, 'numeroSerie', e.target.value, true)}
                            placeholder="SN-..."
                            className="text-[10px] font-mono font-bold py-0.5 px-2 rounded-lg border border-slate-200 dark:border-dark-700 bg-slate-50/70 dark:bg-dark-900/50 text-slate-600 dark:text-dark-200 w-36 focus:bg-white dark:focus:bg-dark-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                          {eq.desc && (
                            <span className="text-[10px] text-slate-400 truncate max-w-[200px]" title={eq.desc}>
                              {eq.desc}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Catégorie & Salle */}
                      <td className="py-3 px-3.5 font-semibold text-slate-600 dark:text-dark-300">
                        <div className="space-y-1">
                          <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-dark-200 font-bold text-[11px] inline-block">
                            {eq.categorie || 'Général'}
                          </span>
                          {eq.salle && (
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                              📍 {eq.salle}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Occupant / Réservation */}
                      <td className="py-3 px-3.5">
                        {eq.reservationActive ? (
                          <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 p-1.5 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
                            <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-[10px]">
                              {eq.reservationActive.nom.charAt(0)}
                            </div>
                            <div>
                              <p className="text-[11px] font-bold text-slate-800 dark:text-emerald-400 leading-none">
                                {eq.reservationActive.nom}
                              </p>
                              <span className="text-[9px] text-emerald-600 dark:text-emerald-300 font-bold block mt-0.5">
                                Réservé : {eq.reservationActive.heureDebut} - {eq.reservationActive.heureFin}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-400 bg-slate-50 dark:bg-dark-800 border border-slate-100 dark:border-dark-700">
                            Libre / Disponible
                          </span>
                        )}
                      </td>

                      {/* État actuel modifiable (Avant / Après) */}
                      <td className="py-3 px-3.5">
                        <div className="space-y-1.5">
                          <select
                            value={currentEtat}
                            onChange={(e) => handleUpdateEquipementField(selectedEspace, eq.id, 'etatAvant', e.target.value)}
                            className="text-[10px] font-bold py-1 px-2 rounded-lg border border-slate-200 dark:border-dark-700 bg-white dark:bg-dark-900 text-slate-800 dark:text-dark-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer shadow-sm w-full max-w-[180px]"
                            title="État AVANT utilisation"
                          >
                            {ETATS_AVANT.map(opt => (
                              <option key={opt.value} value={opt.value}>[AVANT] {opt.label.replace(/^[^\s]+\s/, '')}</option>
                            ))}
                          </select>
                          
                          {eq.reservationActive && (
                            <select
                              value={eq.etatApres || 'Conforme & Rendu propre'}
                              onChange={(e) => handleUpdateEquipementField(selectedEspace, eq.id, 'etatApres', e.target.value)}
                              className="text-[10px] font-bold py-1 px-2 rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-900/10 text-emerald-800 dark:text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer shadow-sm w-full max-w-[180px]"
                              title="État APRÈS utilisation (Restitution)"
                            >
                              <option value="Conforme & Rendu propre">[APRÈS] Conforme & Propre</option>
                              <option value="Légèrement dégradé">[APRÈS] Légèrement dégradé</option>
                              <option value="Panne ou Casse confirmée">[APRÈS] Panne ou Casse confirmée</option>
                            </select>
                          )}
                        </div>
                      </td>

                      {/* Statut Problème / Incident & Photo */}
                      <td className="py-3 px-3.5">
                        {activeIncident ? (
                          <div className="flex items-center gap-2.5">
                            {activeIncident.photo ? (
                              <button
                                type="button"
                                onClick={() => handleOpenViewProblemModal(eq)}
                                className="relative group w-11 h-11 rounded-xl overflow-hidden border-2 border-red-500 shrink-0 shadow-md cursor-pointer hover:scale-105 transition-transform"
                                title="Cliquer pour voir la photo du problème en grand"
                              >
                                <img src={activeIncident.photo} alt="Panne" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                                  <Eye size={14} />
                                </div>
                              </button>
                            ) : (
                              <div className="w-9 h-9 rounded-xl bg-red-500/15 text-red-600 flex items-center justify-center shrink-0">
                                <AlertTriangle size={16} />
                              </div>
                            )}
                            <div className="min-w-0">
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 flex items-center gap-1 w-fit">
                                <AlertTriangle size={10} /> Problème signalé
                              </span>
                              <p className="text-[11px] text-slate-800 dark:text-slate-200 font-bold truncate max-w-[150px] mt-0.5" title={activeIncident.description}>
                                {activeIncident.titre || activeIncident.description}
                              </p>
                              <span className="text-[10px] text-slate-400 block">
                                {new Date(activeIncident.date).toLocaleDateString('fr-FR')}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-dark-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-dark-700">
                            <CheckCircle2 size={11} className="text-emerald-500" /> Aucun problème
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {activeIncident ? (
                            <button
                              type="button"
                              onClick={() => handleOpenViewProblemModal(eq)}
                              className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 font-bold text-xs flex items-center gap-1 shadow-sm cursor-pointer"
                              title="Voir la photo du problème et marquer comme résolu"
                            >
                              <Eye size={13} /> Voir & Résoudre
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenProblemModal(eq)}
                              className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 font-bold text-xs flex items-center gap-1 shadow-sm cursor-pointer"
                              title="Signaler une panne avec photo"
                            >
                              <AlertTriangle size={13} /> Signaler problème
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteEquipement(selectedEspace, eq.id)}
                            title="Supprimer cet équipement"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-red-500/10 text-slate-400 hover:text-red-500 dark:bg-dark-800 transition-colors cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
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

      {/* =========================================================================
         MODAL 1 : AJOUTER UN ÉQUIPEMENT
         ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-900 text-slate-900 dark:text-white rounded-3xl p-6 max-w-lg w-full border border-slate-200 dark:border-dark-700 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-3">
              <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Plus size={18} className="text-emerald-500" /> Ajouter un Équipement dans l'Espace {currentEspObj?.nom}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddEquipement} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-dark-300 block mb-1">
                  Nom de l'équipement *
                </label>
                <input
                  type="text"
                  placeholder="Nom (ex: Imprimante 3D Prusa, Caméra 4K...)"
                  value={newEquipement.nom}
                  onChange={(e) => setNewEquipement({ ...newEquipement, nom: e.target.value })}
                  className="input w-full !py-2 !text-xs font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-dark-300 block mb-1">
                    N° de Série
                  </label>
                  <input
                    type="text"
                    placeholder="ex: SN-FAB-001"
                    value={newEquipement.numeroSerie}
                    onChange={(e) => setNewEquipement({ ...newEquipement, numeroSerie: e.target.value })}
                    className="input w-full !py-2 !text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-dark-300 block mb-1">
                    Catégorie
                  </label>
                  <input
                    type="text"
                    placeholder="ex: Impression 3D, Audio, Usinage"
                    value={newEquipement.categorie}
                    onChange={(e) => setNewEquipement({ ...newEquipement, categorie: e.target.value })}
                    className="input w-full !py-2 !text-xs"
                  />
                </div>
              </div>

              {currentEspObj?.salles && currentEspObj.salles.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-dark-300 block mb-1">
                    Salle / Zone
                  </label>
                  <select
                    value={newEquipement.salle}
                    onChange={(e) => setNewEquipement({ ...newEquipement, salle: e.target.value })}
                    className="input w-full !py-2 !text-xs font-bold cursor-pointer"
                  >
                    {currentEspObj.salles.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-dark-300 block mb-1">
                  État Initial
                </label>
                <select
                  value={newEquipement.etatAvant}
                  onChange={(e) => setNewEquipement({ ...newEquipement, etatAvant: e.target.value })}
                  className="input w-full !py-2 !text-xs font-bold cursor-pointer"
                >
                  {ETATS_AVANT.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-dark-300 block mb-1">
                  Description / Caractéristiques (Optionnel)
                </label>
                <input
                  type="text"
                  placeholder="ex: Buse 0.4mm, filaments compatibles PLA/PETG..."
                  value={newEquipement.desc}
                  onChange={(e) => setNewEquipement({ ...newEquipement, desc: e.target.value })}
                  className="input w-full !py-2 !text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-dark-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-dark-800 text-xs font-bold text-slate-600 dark:text-dark-300 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn btn-primary text-xs font-bold py-2 px-5 shadow-sm cursor-pointer"
                >
                  Ajouter à l'inventaire
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
         MODAL 2 : SIGNALER UN PROBLÈME AVEC PHOTO
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

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-dark-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ImageIcon size={14} className="text-amber-500" /> Photo / Image du matériel affichant le problème
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">JPG, PNG, WebP (Recommandé)</span>
                </label>

                {problemModal.photo ? (
                  <div className="relative rounded-2xl border-2 border-dashed border-emerald-500/50 bg-emerald-50/10 p-3 flex items-center gap-3">
                    <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-900 shrink-0 border border-slate-700 shadow-md">
                      <img src={problemModal.photo} alt="Prévisualisation" className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 truncate">
                        ✓ Image du problème enregistrée
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-dark-400 truncate mt-0.5">
                        {problemModal.photoName || 'Photo du matériel defectueux'}
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
                      Prenez une photo nette de la pièce endommagée ou de la panne
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
         MODAL 3 : CONSULTATION DE L'INCIDENT & RÉSOLUTION (PHOTO EN GRAND)
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

            {/* Photo agrandie */}
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
                <Info size={16} /> Aucune photo n'avait été jointe lors du signalement.
              </div>
            )}

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
    </div>
  );
}
