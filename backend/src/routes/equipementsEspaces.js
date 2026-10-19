const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireStaff = require('../middleware/requireStaff');
const { EquipementEspace } = require('../models');

// Données initiales par défaut si la base de données est vide
const DEFAULT_EQUIPEMENTS = [
  // FABLAB
  {
    espace: 'fablab',
    nom: 'Imprimante 3D Prusa i3 MK3S+ (Unité #1)',
    numeroSerie: 'SN-FAB-PRUSA-01',
    categorie: 'Impression 3D',
    salle: 'Fablab 1',
    desc: 'Impression filament PLA, PETG, ABS haute précision 0.05mm (Étage)',
    etatAvant: 'Opérationnel / Parfait état',
    etatApres: 'Conforme & Rendu propre',
    incidents: []
  },
  {
    espace: 'fablab',
    nom: 'Imprimante 3D Bambu Lab X1 Carbon (Unité #2)',
    numeroSerie: 'SN-FAB-BAMBU-02',
    categorie: 'Impression 3D',
    salle: 'Fablab 1',
    desc: 'Impression multi-couleurs haute vitesse et matériaux composites (Étage)',
    etatAvant: 'Opérationnel / Parfait état',
    etatApres: 'Conforme & Rendu propre',
    incidents: []
  },
  {
    espace: 'fablab',
    nom: 'Découpeuse Laser CO2 100W',
    numeroSerie: 'SN-FAB-LASER-100W',
    categorie: 'Découpe & Gravure',
    salle: 'Fablab 1',
    desc: 'Découpe bois, plexiglas, carton et gravure précise 900x600mm (Étage)',
    etatAvant: 'Opérationnel / Parfait état',
    etatApres: 'Conforme & Rendu propre',
    incidents: []
  },
  {
    espace: 'fablab',
    nom: 'Station de Soudage & Oscilloscope',
    numeroSerie: 'SN-FAB-SOUD-003',
    categorie: 'Électronique',
    salle: 'Fablab 1',
    desc: 'Fer à souder température régulée, oscilloscope 100MHz & multimètre (Étage)',
    etatAvant: 'Bon état / Prêt à l\'emploi',
    etatApres: 'Conforme & Rendu propre',
    incidents: []
  },
  {
    espace: 'fablab',
    nom: 'Scanner 3D Haute Définition',
    numeroSerie: 'SN-FAB-SCAN-3D',
    categorie: 'Numérisation',
    salle: 'Fablab 1',
    desc: 'Numérisation géométrique 3D pour modélisation CAO (Étage)',
    etatAvant: 'Opérationnel / Parfait état',
    etatApres: 'Conforme & Rendu propre',
    incidents: []
  },
  {
    espace: 'fablab',
    nom: 'Fraiseuse Numérique CNC Carvey',
    numeroSerie: 'SN-FAB-CNC-CARV',
    categorie: 'Usinage',
    salle: 'Sous-sol',
    desc: 'Usinage précis bois, résine et circuits imprimés PCB (Sous-sol)',
    etatAvant: 'Opérationnel / Parfait état',
    etatApres: 'Conforme & Rendu propre',
    incidents: []
  },
  {
    espace: 'fablab',
    nom: 'Découpeuse Métal & Plasma d\'Atelier',
    numeroSerie: 'SN-FAB-PLASM-MET',
    categorie: 'Usinage Lourd',
    salle: 'Sous-sol',
    desc: 'Découpe tôles et profilés métalliques d\'atelier (Sous-sol)',
    etatAvant: 'Opérationnel / Parfait état',
    etatApres: 'Conforme & Rendu propre',
    incidents: []
  },
  {
    espace: 'fablab',
    nom: 'Tour Mécanique & Perceuse à Colonne',
    numeroSerie: 'SN-FAB-TOUR-PERC',
    categorie: 'Usinage Mécanique',
    salle: 'Sous-sol',
    desc: 'Tournage de pièces métalliques & perçage de précision (Sous-sol)',
    etatAvant: 'Bon état / Prêt à l\'emploi',
    etatApres: 'Conforme & Rendu propre',
    incidents: []
  },

  // STUDIO
  {
    espace: 'studio',
    nom: 'Caméra Sony Alpha 7 IV 4K - Boîtier #1',
    numeroSerie: 'SN-STU-SONY-01',
    categorie: 'Caméra Vidéo',
    salle: 'Studio Média',
    desc: 'Capteur plein format 4K 60fps, objectif 24-70mm f/2.8 (Boîtier #1)',
    etatAvant: 'Opérationnel / Parfait état',
    etatApres: 'Conforme & Rendu propre',
    incidents: []
  },
  {
    espace: 'studio',
    nom: 'Caméra Sony Alpha 7 IV 4K - Boîtier #2',
    numeroSerie: 'SN-STU-SONY-02',
    categorie: 'Caméra Vidéo',
    salle: 'Studio Média',
    desc: 'Capteur plein format 4K 60fps, objectif 50mm f/1.4 (Boîtier #2)',
    etatAvant: 'Opérationnel / Parfait état',
    etatApres: 'Conforme & Rendu propre',
    incidents: []
  },
  {
    espace: 'studio',
    nom: 'Caméra Sony Alpha 7 IV 4K - Boîtier #3',
    numeroSerie: 'SN-STU-SONY-03',
    categorie: 'Caméra Vidéo',
    salle: 'Studio Média',
    desc: 'Capteur plein format 4K 60fps, objectif 16-35mm grand angle (Boîtier #3)',
    etatAvant: 'Opérationnel / Parfait état',
    etatApres: 'Conforme & Rendu propre',
    incidents: []
  },
  {
    espace: 'studio',
    nom: 'Kit Micro Podcast Rode RodeCaster Pro',
    numeroSerie: 'SN-STU-RODE-CAST',
    categorie: 'Audio & Podcast',
    salle: 'Studio Média',
    desc: 'Console de mixage podcast multipiste & 2 micros broadcast Shure SM7B',
    etatAvant: 'Opérationnel / Parfait état',
    etatApres: 'Conforme & Rendu propre',
    incidents: []
  },
  {
    espace: 'studio',
    nom: 'Kit Éclairage LED Softbox 300W',
    numeroSerie: 'SN-STU-LED-SOFT',
    categorie: 'Lumière & Projecteurs',
    salle: 'Studio Média',
    desc: 'Panneaux LED bicolores réglables avec diffuseurs softbox et trépieds',
    etatAvant: 'Opérationnel / Parfait état',
    etatApres: 'Conforme & Rendu propre',
    incidents: []
  },
  {
    espace: 'studio',
    nom: 'Fond Vert & Cyclorama Photo Réglable',
    numeroSerie: 'SN-STU-CYCLO-VERT',
    categorie: 'Décor & Fond',
    salle: 'Studio Média',
    desc: 'Fond vert rétractable 3x3m, fonds photo blanc et noir pour shooting',
    etatAvant: 'Opérationnel / Parfait état',
    etatApres: 'Conforme & Rendu propre',
    incidents: []
  },
  {
    espace: 'studio',
    nom: 'Téléprompteur Professionnel & Tablette',
    numeroSerie: 'SN-STU-PROMPTER-1',
    categorie: 'Présentation',
    salle: 'Studio Média',
    desc: 'Vitre semi-réfléchissante grand format avec application de défilement',
    etatAvant: 'Opérationnel / Parfait état',
    etatApres: 'Conforme & Rendu propre',
    incidents: []
  },

  // SALLE DE RÉUNION
  {
    espace: 'salle_reunion',
    nom: 'Écran Tactile Interactif 75 pouces 4K',
    numeroSerie: 'SN-REU-ECRAN-75',
    categorie: 'Affichage & Brainstorming',
    salle: 'Salle 1',
    desc: 'Tableau blanc interactif tactile multi-touch avec stylets haute sensibilité (Salle 1)',
    etatAvant: 'Opérationnel / Parfait état',
    etatApres: 'Conforme & Rendu propre',
    incidents: []
  },
  {
    espace: 'salle_reunion',
    nom: 'Barre de Visioconférence 4K Logitech MeetUp',
    numeroSerie: 'SN-REU-LOGI-MEET',
    categorie: 'Audio/Vidéo',
    salle: 'Salle 1',
    desc: 'Caméra grand angle 120°, réduction de bruit IA, micros de table (Salle 1)',
    etatAvant: 'Opérationnel / Parfait état',
    etatApres: 'Conforme & Rendu propre',
    incidents: []
  },
  {
    espace: 'salle_reunion',
    nom: 'Écran Collaboratif Tactile 65 pouces',
    numeroSerie: 'SN-REU-ECRAN-65',
    categorie: 'Affichage Collaboratif',
    salle: 'Salle 2',
    desc: 'Écran tactile dynamique pour présentations d\'équipes et réunions agiles (Salle 2)',
    etatAvant: 'Opérationnel / Parfait état',
    etatApres: 'Conforme & Rendu propre',
    incidents: []
  },
  {
    espace: 'salle_reunion',
    nom: 'Système de Présentation Sans Fil Barco ClickShare',
    numeroSerie: 'SN-REU-BARCO-CS',
    categorie: 'Connectivité',
    salle: 'Salle 2',
    desc: 'Partage d\'écran sans fil instantané multi-utilisateurs USB-C & HDMI (Salle 2)',
    etatAvant: 'Opérationnel / Parfait état',
    etatApres: 'Conforme & Rendu propre',
    incidents: []
  },
  {
    espace: 'salle_reunion',
    nom: 'Vidéoprojecteur Interactif Laser 4K',
    numeroSerie: 'SN-REU-VP-LASER',
    categorie: 'Projection Grand Format',
    salle: 'Salle de formation',
    desc: 'Projection très haute luminosité sur mur interactif 3m (Salle de formation)',
    etatAvant: 'Opérationnel / Parfait état',
    etatApres: 'Conforme & Rendu propre',
    incidents: []
  },
  {
    espace: 'salle_reunion',
    nom: 'Système de Sonorisation & Micro Conférence',
    numeroSerie: 'SN-REU-SONO-CONF',
    categorie: 'Audio & Voix',
    salle: 'Salle de formation',
    desc: 'Micros cravate sans fil, micro de table et sonorisation d\'amphithéâtre (Salle de formation)',
    etatAvant: 'Opérationnel / Parfait état',
    etatApres: 'Conforme & Rendu propre',
    incidents: []
  },
  {
    espace: 'salle_reunion',
    nom: 'Pupitre Multimédia & Pointeur Laser',
    numeroSerie: 'SN-REU-PUPITRE-01',
    categorie: 'Animation Formation',
    salle: 'Salle de formation',
    desc: 'Pupitre équipé prises HDMI, audio et retour écran pour formateur (Salle de formation)',
    etatAvant: 'Opérationnel / Parfait état',
    etatApres: 'Conforme & Rendu propre',
    incidents: []
  }
];

// Initialisation automatique si la table est vide
let isSeeded = false;
const ensureSeeded = async () => {
  if (isSeeded) return;
  try {
    const count = await EquipementEspace.count();
    if (count === 0) {
      console.log('🌱 Initialisation des équipements des espaces en BDD...');
      await EquipementEspace.bulkCreate(DEFAULT_EQUIPEMENTS);
      console.log('✅ Équipements des espaces créés en BDD avec succès !');
    }
    isSeeded = true;
  } catch (err) {
    // Ignore au boot si la BDD est en cours de synchronisation
  }
};

// GET /api/equipements-espaces : Récupérer tous les équipements groupés par espace
router.get('/', async (req, res) => {
  try {
    await ensureSeeded();
    let isAuthenticated = false;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const secret = process.env.JWT_SECRET;
        if (secret) {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, secret);
          if (decoded && decoded.id) {
            isAuthenticated = true;
          }
        }
      } catch {
        // Ignorer token invalide, traiter comme anonyme
      }
    }

    const items = await EquipementEspace.findAll({
      order: [['id', 'ASC']]
    });

    let currentReservations = [];
    if (isAuthenticated) {
      const { ReservationEspace, ChecklistMateriel } = require('../models');
      const { Op } = require('sequelize');
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toLocaleTimeString('fr-FR', { hour12: false, hour: '2-digit', minute: '2-digit' });
      
      currentReservations = await ReservationEspace.findAll({
        where: {
          statut: 'valide',
          dateReservation: today,
          heureDebut: { [Op.lte]: now },
          heureFin: { [Op.gte]: now }
        },
        include: [{ model: ChecklistMateriel, as: 'checklists' }]
      });
    }

    const itemsWithReservations = items.map(item => {
      const plainItem = item.toJSON ? item.toJSON() : { ...item };
      if (isAuthenticated) {
        // Find if there is an active reservation for this equipment's space & salle
        const activeRes = currentReservations.find(r => 
          r.espace === plainItem.espace && 
          (!r.salleSpecifique || r.salleSpecifique === plainItem.salle)
        );
        if (activeRes) {
          plainItem.reservationActive = {
            nom: activeRes.nomIncube || activeRes.nomComplet,
            heureDebut: activeRes.heureDebut,
            heureFin: activeRes.heureFin,
          };
          // Find the checklist for this specific equipment
          const checklist = activeRes.checklists.find(c => c.equipement_id === plainItem.id);
          if (checklist) {
            plainItem.checklist = checklist;
            // Override global status with the specific checklist status
            plainItem.etatAvant = checklist.etat_avant;
            plainItem.etatApres = checklist.etat_apres;
          }
        }
      }
      return plainItem;
    });

    const grouped = {
      fablab: [],
      studio: [],
      salle_reunion: []
    };

    itemsWithReservations.forEach(item => {
      const esp = item.espace || 'fablab';
      if (!grouped[esp]) grouped[esp] = [];

      if (!isAuthenticated) {
        // Pour les requêtes publiques anonymes (ex: page de réservation) :
        // Projeter les incidents uniquement aux champs nécessaires (gravite, resolu, id)
        // et exclure les données sensibles/lourdes (description, photo, etc.)
        const safeIncidents = Array.isArray(item.incidents)
          ? item.incidents.map(inc => ({
              id: inc.id,
              gravite: inc.gravite,
              resolu: Boolean(inc.resolu)
            }))
          : [];

        grouped[esp].push({
          ...item,
          incidents: safeIncidents
        });
      } else {
        grouped[esp].push(item);
      }
    });

    res.json(grouped);
  } catch (err) {
    console.error('Erreur récupération équipements:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/equipements-espaces (ADMIN - Création d'un équipement)
router.post('/', auth, requireStaff, async (req, res) => {
  try {
    const { espace, nom, numeroSerie, categorie, salle, desc, etatAvant, etatApres } = req.body;
    if (!nom || !espace) {
      return res.status(400).json({ message: 'Le nom et l\'espace sont obligatoires' });
    }

    if (numeroSerie && numeroSerie.trim()) {
      const existing = await EquipementEspace.findOne({
        where: { numeroSerie: numeroSerie.trim() }
      });
      if (existing) {
        return res.status(400).json({ message: `Le numéro de série "${numeroSerie}" est déjà utilisé par "${existing.nom}"` });
      }
    }

    const created = await EquipementEspace.create({
      espace,
      nom: nom.trim(),
      numeroSerie: numeroSerie ? numeroSerie.trim() : `SN-${espace.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`,
      categorie: categorie || 'Général',
      salle: salle || '',
      desc: desc || '',
      etatAvant: etatAvant || 'Opérationnel / Parfait état',
      etatApres: etatApres || 'Conforme & Rendu propre',
      incidents: []
    });

    res.status(201).json({ success: true, message: 'Équipement créé avec succès', data: created });
  } catch (err) {
    console.error('Erreur création équipement:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// PUT /api/equipements-espaces/:id (ADMIN - Mise à jour d'un équipement)
router.put('/:id', auth, requireStaff, async (req, res) => {
  try {
    const item = await EquipementEspace.findByPk(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Équipement non trouvé' });
    }

    const { nom, numeroSerie, categorie, salle, desc, etatAvant, etatApres } = req.body;

    if (numeroSerie && numeroSerie.trim() && numeroSerie.trim() !== item.numeroSerie) {
      const { Op } = require('sequelize');
      const existing = await EquipementEspace.findOne({
        where: { 
          numeroSerie: numeroSerie.trim(),
          id: { [Op.ne]: item.id }
        }
      });
      if (existing) {
        return res.status(400).json({ message: `Le numéro de série "${numeroSerie}" est déjà utilisé par "${existing.nom}"` });
      }
      item.numeroSerie = numeroSerie.trim();
    }

    if (nom !== undefined) item.nom = nom.trim();
    if (categorie !== undefined) item.categorie = categorie;
    if (salle !== undefined) item.salle = salle;
    if (desc !== undefined) item.desc = desc;
    if (etatAvant !== undefined) item.etatAvant = etatAvant;
    if (etatApres !== undefined) item.etatApres = etatApres;

    await item.save();

    res.json({ success: true, message: 'Équipement mis à jour', data: item });
  } catch (err) {
    console.error('Erreur mise à jour équipement:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// DELETE /api/equipements-espaces/:id (ADMIN - Suppression d'un équipement)
router.delete('/:id', auth, requireStaff, async (req, res) => {
  try {
    const item = await EquipementEspace.findByPk(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Équipement non trouvé' });
    }

    await item.destroy();
    res.json({ success: true, message: 'Équipement supprimé avec succès' });
  } catch (err) {
    console.error('Erreur suppression équipement:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/equipements-espaces/:id/incidents (Signaler un incident/panne avec photo)
router.post('/:id/incidents', auth, async (req, res) => {
  try {
    const item = await EquipementEspace.findByPk(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Équipement non trouvé' });
    }

    const { titre, description, gravite, photo, signalePar } = req.body;
    if (!description || !description.trim()) {
      return res.status(400).json({ message: 'Description du problème requise' });
    }

    const currentIncidents = Array.isArray(item.incidents) ? item.incidents : [];
    const newIncident = {
      id: Date.now(),
      titre: titre ? titre.trim() : 'Panne matériel',
      description: description.trim(),
      gravite: gravite || 'majeur',
      photo: photo || null,
      date: new Date().toISOString(),
      signalePar: signalePar || 'Utilisateur',
      resolu: false
    };

    const newEtat = gravite === 'bloquant' 
      ? 'En maintenance / Bloqué' 
      : 'Légère usure / À surveiller';

    item.etatAvant = newEtat;
    item.incidents = [newIncident, ...currentIncidents];
    await item.save();

    res.status(201).json({ success: true, message: 'Incident signalé avec succès', data: item });
  } catch (err) {
    console.error('Erreur signalement incident:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// PUT /api/equipements-espaces/:id/incidents/:incidentId/resoudre (ADMIN - Résoudre un incident)
router.put('/:id/incidents/:incidentId/resoudre', auth, requireStaff, async (req, res) => {
  try {
    const item = await EquipementEspace.findByPk(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Équipement non trouvé' });
    }

    const currentIncidents = Array.isArray(item.incidents) ? item.incidents : [];
    const targetId = Number(req.params.incidentId);

    const updatedIncidents = currentIncidents.map(inc => {
      if (inc.id === targetId || String(inc.id) === String(req.params.incidentId)) {
        return { ...inc, resolu: true, resoluLe: new Date().toISOString() };
      }
      return inc;
    });

    item.incidents = updatedIncidents;
    // Si tous les incidents sont résolus, on remet l'état à opérationnel
    const hasUnresolved = updatedIncidents.some(inc => !inc.resolu);
    if (!hasUnresolved) {
      item.etatAvant = 'Opérationnel / Parfait état';
    }

    await item.save();

    res.json({ success: true, message: 'Incident marqué comme résolu', data: item });
  } catch (err) {
    console.error('Erreur résolution incident:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
