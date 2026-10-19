const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireStaff = require('../middleware/requireStaff');
const { Formation, Incube } = require('../models');

// GET /api/formations - Récupère toutes les formations avec les infos de l'incubé
router.get('/', auth, async (req, res) => {
  try {
    const where = {};
    if (req.user.role === 'incube' && req.user.pp_id) {
      where.incube_id = req.user.pp_id;
    } else if (req.query.incube_id) {
      where.incube_id = req.query.incube_id;
    }

    const formations = await Formation.findAll({
      where,
      include: [
        {
          model: Incube,
          as: 'incube',
          attributes: ['id', 'nom_incube', 'raison_sociale', 'pp_numero', 'email', 'promotion', 'photo_path']
        }
      ],
      order: [['date_formation', 'DESC'], ['id', 'DESC']]
    });

    res.json(formations);
  } catch (error) {
    console.error('Erreur récupération formations:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des formations' });
  }
});

// POST /api/formations - Créer une ou plusieurs formations (pour un ou plusieurs incubés)
router.post('/', auth, requireStaff, async (req, res) => {
  try {
    const {
      theme,
      formateur,
      heures,
      date_formation,
      presence,
      attestation,
      incube_id,
      incube_ids
    } = req.body;

    if (!theme) {
      return res.status(400).json({ message: 'Le thème de la formation est requis' });
    }

    // Création en lot si incube_ids est fourni
    if (Array.isArray(incube_ids) && incube_ids.length > 0) {
      const records = incube_ids.map(id => ({
        incube_id: id,
        theme: theme.trim(),
        formateur: formateur?.trim() || null,
        heures: parseFloat(heures) || 0,
        date_formation: date_formation || new Date().toISOString().split('T')[0],
        presence: presence || 'Présent',
        attestation: !!attestation
      }));

      const created = await Formation.bulkCreate(records);
      return res.status(201).json(created);
    }

    // Création individuelle
    if (!incube_id) {
      return res.status(400).json({ message: 'Veuillez spécifier au moins un incubé' });
    }

    const formation = await Formation.create({
      incube_id,
      theme: theme.trim(),
      formateur: formateur?.trim() || null,
      heures: parseFloat(heures) || 0,
      date_formation: date_formation || new Date().toISOString().split('T')[0],
      presence: presence || 'Présent',
      attestation: !!attestation
    });

    // Recharger avec l'association
    const reloaded = await Formation.findByPk(formation.id, {
      include: [{ model: Incube, as: 'incube', attributes: ['id', 'nom_incube', 'raison_sociale', 'pp_numero', 'email', 'promotion'] }]
    });

    res.status(201).json(reloaded);
  } catch (error) {
    console.error('Erreur création formation:', error);
    res.status(500).json({ message: 'Erreur lors de la création de la formation' });
  }
});

// PUT /api/formations/:id - Mettre à jour une formation
router.put('/:id', auth, requireStaff, async (req, res) => {
  try {
    const formation = await Formation.findByPk(req.params.id);
    if (!formation) {
      return res.status(404).json({ message: 'Formation non trouvée' });
    }

    const {
      theme,
      formateur,
      heures,
      date_formation,
      presence,
      attestation,
      incube_id
    } = req.body;

    if (theme !== undefined) formation.theme = theme.trim();
    if (formateur !== undefined) formation.formateur = formateur ? formateur.trim() : null;
    if (heures !== undefined) formation.heures = parseFloat(heures) || 0;
    if (date_formation !== undefined) formation.date_formation = date_formation;
    if (presence !== undefined) formation.presence = presence;
    if (attestation !== undefined) formation.attestation = !!attestation;
    if (incube_id !== undefined) formation.incube_id = incube_id;

    await formation.save();

    const reloaded = await Formation.findByPk(formation.id, {
      include: [{ model: Incube, as: 'incube', attributes: ['id', 'nom_incube', 'raison_sociale', 'pp_numero', 'email', 'promotion'] }]
    });

    res.json(reloaded);
  } catch (error) {
    console.error('Erreur modification formation:', error);
    res.status(500).json({ message: 'Erreur lors de la modification de la formation' });
  }
});

// DELETE /api/formations/:id - Supprimer une formation
router.delete('/:id', auth, requireStaff, async (req, res) => {
  try {
    const formation = await Formation.findByPk(req.params.id);
    if (!formation) {
      return res.status(404).json({ message: 'Formation non trouvée' });
    }

    await formation.destroy();
    res.json({ message: 'Formation supprimée avec succès' });
  } catch (error) {
    console.error('Erreur suppression formation:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression de la formation' });
  }
});

module.exports = router;
