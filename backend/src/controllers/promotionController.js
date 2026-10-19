const { Promotion, Incube } = require('../models');
const { Op } = require('sequelize');

// GET /api/promotions — Récupérer toutes les promotions
exports.getAll = async (req, res) => {
  try {
    let promos = await Promotion.findAll({
      order: [['id', 'ASC']]
    });

    // Initialisation automatique par défaut si aucune promotion n'existe
    if (promos.length === 0) {
      await Promotion.bulkCreate([
        { nom: 'Promotion 1', description: 'Première cohorte IDS' },
        { nom: 'Promotion 2', description: 'Deuxième cohorte IDS' }
      ]);
      promos = await Promotion.findAll({ order: [['id', 'ASC']] });
    }

    res.json(promos);
  } catch (err) {
    console.error('Erreur chargement promotions:', err);
    res.status(500).json({ message: 'Erreur lors du chargement des promotions', error: err.message });
  }
};

// POST /api/promotions — Ajouter une nouvelle promotion
exports.create = async (req, res) => {
  try {
    const { nom, description } = req.body;
    if (!nom || !String(nom).trim()) {
      return res.status(400).json({ message: 'Le nom de la promotion est requis' });
    }

    const cleanNom = String(nom).trim();

    // Vérifier l'unicité
    const existing = await Promotion.findOne({
      where: {
        nom: { [Op.like]: cleanNom }
      }
    });

    if (existing) {
      return res.status(200).json(existing);
    }

    const created = await Promotion.create({
      nom: cleanNom,
      description: description ? String(description).trim() : null
    });

    res.status(201).json(created);
  } catch (err) {
    console.error('Erreur création promotion:', err);
    res.status(400).json({ message: "Erreur lors de l'ajout de la promotion", error: err.message });
  }
};

// DELETE /api/promotions/:id — Supprimer une promotion
exports.delete = async (req, res) => {
  try {
    const promo = await Promotion.findByPk(req.params.id);
    if (!promo) {
      return res.status(404).json({ message: 'Promotion non trouvée' });
    }

    await promo.destroy();
    res.json({ message: 'Promotion supprimée avec succès' });
  } catch (err) {
    console.error('Erreur suppression promotion:', err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};
