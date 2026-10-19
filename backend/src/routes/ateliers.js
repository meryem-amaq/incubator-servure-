const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireStaff = require('../middleware/requireStaff');
const { Atelier } = require('../models');
const syncService = require('../services/SyncService');

// GET /api/ateliers
// Retrieve all ateliers
router.get('/', auth, async (req, res) => {
  try {
    const ateliers = await Atelier.findAll({
      order: [['date', 'DESC'], ['heureDebut', 'DESC']]
    });
    res.json(ateliers);
  } catch (error) {
    console.error('Erreur récupération ateliers:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des ateliers' });
  }
});

// POST /api/ateliers
// Create a new atelier
router.post('/', auth, requireStaff, async (req, res) => {
  try {
    const {
      titre, formateur, intervenant, date,
      heureDebut, heureFin, duree, description, statutOuverture
    } = req.body;

    const atelier = await Atelier.create({
      titre: titre || 'Nouvel Atelier',
      formateur: formateur || 'Intervenant IDS',
      intervenant: intervenant || null,
      date: date || new Date().toISOString().split('T')[0],
      heureDebut: heureDebut || '09:30',
      heureFin: heureFin || '12:30',
      duree: duree || '3h00',
      description: description || null,
      statutOuverture: statutOuverture || 'auto'
    });

    // Pousser l'atelier vers le cloud relay (silencieux si hors ligne)
    syncService.pushAteliersToCloud(atelier).catch(() => {});

    res.status(201).json(atelier);
  } catch (error) {
    console.error('Erreur création atelier:', error);
    res.status(500).json({ message: 'Erreur lors de la création de l\'atelier' });
  }
});

// PUT /api/ateliers/:id
// Update an existing atelier
router.put('/:id', auth, requireStaff, async (req, res) => {
  try {
    const atelier = await Atelier.findByPk(req.params.id);
    if (!atelier) {
      return res.status(404).json({ message: 'Atelier non trouvé' });
    }

    const {
      titre, formateur, intervenant, date,
      heureDebut, heureFin, duree, description, statutOuverture
    } = req.body;

    if (titre !== undefined) atelier.titre = titre;
    if (formateur !== undefined) atelier.formateur = formateur;
    if (intervenant !== undefined) atelier.intervenant = intervenant;
    if (date !== undefined) atelier.date = date;
    if (heureDebut !== undefined) atelier.heureDebut = heureDebut;
    if (heureFin !== undefined) atelier.heureFin = heureFin;
    if (duree !== undefined) atelier.duree = duree;
    if (description !== undefined) atelier.description = description;
    if (statutOuverture !== undefined) atelier.statutOuverture = statutOuverture;

    await atelier.save();

    // Mettre à jour l'atelier sur le cloud relay
    syncService.pushAteliersToCloud(atelier).catch(() => {});

    res.json(atelier);

  } catch (error) {
    console.error('Erreur modification atelier:', error);
    res.status(500).json({ message: 'Erreur lors de la modification de l\'atelier' });
  }
});

// DELETE /api/ateliers/:id
// Delete an atelier
router.delete('/:id', auth, requireStaff, async (req, res) => {
  try {
    const atelier = await Atelier.findByPk(req.params.id);
    if (!atelier) {
      return res.status(404).json({ message: 'Atelier non trouvé' });
    }
    
    await atelier.destroy();
    res.json({ message: 'Atelier supprimé avec succès' });
  } catch (error) {
    console.error('Erreur suppression atelier:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression de l\'atelier' });
  }
});

module.exports = router;
