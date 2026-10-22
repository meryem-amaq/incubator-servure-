const { Incube, GestionMateriel, SuiviEngagement, RhEmploi, RhDetail, PlanAction, AnalyseFinanciere, FicheSuivi, Formation, HistoriquePhase, HistoriqueStatut, sequelize } = require('../models');
const { Op } = require('sequelize');

/**
 * Vérifie si l'utilisateur courant a les droits d'accès ou d'écriture sur le dossier d'un incubé.
 * @param {number|string} incubeId - Identifiant unique de l'incubé
 * @param {Object} user - Objet utilisateur issu de la requête authentifiée (req.user)
 * @returns {Promise<boolean>} Renvoie true si l'accès est accordé, false sinon
 */
async function checkIncubeAccess(incubeId, user, isWrite = false) {
  if (!user) return false;
  const isSuper = ['super_admin', 'administrateur'].includes(user.role);
  if (isSuper) return true;

  if (user.role === 'incube') {
    return String(user.pp_id) === String(incubeId);
  }

  // Consultation en lecture seule : accessible à tous les coachs et gestionnaires
  if (!isWrite && ['admin', 'administrateur', 'gestionnaire', 'consultant'].includes(user.role)) {
    return true;
  }

  // Écriture / modification / suppression : réservé à l'accompagnateur assigné
  const incube = await Incube.findByPk(incubeId, { attributes: ['id', 'admin_id', 'accompagnateur'] });
  if (!incube) return false;
  if (incube.admin_id === user.id) return true;
  if (user.nom && incube.accompagnateur && incube.accompagnateur.toLowerCase().includes(user.nom.toLowerCase())) return true;
  return false;
}

/**
 * Fabrique de contrôleurs CRUD pour les sous-modèles associés à un incubé.
 * @param {Object} Model - Modèle Sequelize de la ressource enfant
 * @param {string} modelName - Nom lisible du modèle pour les retours d'erreurs
 * @returns {Object} Contrôleur contenant les méthodes getAll, create, bulkCreate, update, delete
 */
function createSubController(Model, modelName) {
  return {
    // GET /api/incubes/:incubeId/<resource>
    getAll: async (req, res) => {
      try {
        if (!(await checkIncubeAccess(req.params.incubeId, req.user, false))) {
          return res.status(403).json({ message: 'Accès non autorisé à ce dossier' });
        }
        const items = await Model.findAll({
          where: { incube_id: req.params.incubeId },
          order: [['created_at', 'DESC']],
        });
        res.json(items);
      } catch (err) { res.status(500).json({ message: err.message }); }
    },

    // POST /api/incubes/:incubeId/<resource>
    create: async (req, res) => {
      try {
        if (!(await checkIncubeAccess(req.params.incubeId, req.user, true))) {
          return res.status(403).json({ message: 'Accès non autorisé à ce dossier' });
        }

        // Unicité du numéro de série pour le matériel
        if (Model === GestionMateriel && req.body.numero_serie && String(req.body.numero_serie).trim()) {
          const trimmedSerial = String(req.body.numero_serie).trim();
          const existing = await GestionMateriel.findOne({
            where: { numero_serie: trimmedSerial }
          });
          if (existing) {
            return res.status(400).json({ message: `Le numéro de série "${trimmedSerial}" est déjà attribué à un autre matériel.` });
          }
        }

        const createData = { ...req.body, incube_id: req.params.incubeId };
        if (Model === SuiviEngagement && !req.body._forceTourniquetSync) {
          delete createData.moyenne_heures_presence;
        }

        const item = await Model.create(createData);
        res.status(201).json(item);
      } catch (err) { res.status(400).json({ message: err.message }); }
    },

    // POST /api/incubes/:incubeId/<resource>/bulk
    bulkCreate: async (req, res) => {
      try {
        if (!(await checkIncubeAccess(req.params.incubeId, req.user, true))) {
          return res.status(403).json({ message: 'Accès non autorisé à ce dossier' });
        }
        const items = Array.isArray(req.body) ? req.body : req.body.items;
        if (!Array.isArray(items) || items.length === 0) {
          return res.status(400).json({ message: 'Données vides ou invalides' });
        }

        // Unicité des numéros de série lors d'un import en masse
        if (Model === GestionMateriel) {
          const series = items.map(i => i.numero_serie && String(i.numero_serie).trim()).filter(Boolean);
          const duplicatesInBatch = series.filter((s, idx) => series.indexOf(s) !== idx);
          if (duplicatesInBatch.length > 0) {
            return res.status(400).json({ message: `Numéro(s) de série dupliqué(s) dans le lot : ${[...new Set(duplicatesInBatch)].join(', ')}` });
          }
          if (series.length > 0) {
            const existing = await GestionMateriel.findAll({
              where: { numero_serie: { [Op.in]: series } }
            });
            if (existing.length > 0) {
              return res.status(400).json({ message: `Numéro(s) de série déjà existant(s) : ${existing.map(e => e.numero_serie).join(', ')}` });
            }
          }
        }

        const withIncubeId = items.map(item => ({ ...item, incube_id: req.params.incubeId }));
        const created = await Model.bulkCreate(withIncubeId);
        res.status(201).json({ message: `${created.length} élément(s) importé(s)`, data: created });
      } catch (err) { res.status(400).json({ message: err.message }); }
    },

    // PUT /api/incubes/:incubeId/<resource>/:id
    update: async (req, res) => {
      try {
        if (!(await checkIncubeAccess(req.params.incubeId, req.user, true))) {
          return res.status(403).json({ message: 'Accès non autorisé à ce dossier' });
        }
        const item = await Model.findByPk(req.params.id);
        if (!item) return res.status(404).json({ message: `${modelName} non trouvé` });

        // Unicité du numéro de série pour le matériel (exclure le matériel en cours de modification)
        if (Model === GestionMateriel && req.body.numero_serie && String(req.body.numero_serie).trim()) {
          const trimmedSerial = String(req.body.numero_serie).trim();
          const existing = await GestionMateriel.findOne({
            where: {
              numero_serie: trimmedSerial,
              id: { [Op.ne]: req.params.id }
            }
          });
          if (existing) {
            return res.status(400).json({ message: `Le numéro de série "${trimmedSerial}" est déjà attribué à un autre matériel.` });
          }
        }

        const updateData = { ...req.body };
        // Pour SuiviEngagement : les heures de présence sont certifiées par les tourniquets et protégées
        if (Model === SuiviEngagement && req.body.moyenne_heures_presence !== undefined) {
          if (item.moyenne_heures_presence !== null && item.moyenne_heures_presence !== undefined && !req.body._forceTourniquetSync) {
            delete updateData.moyenne_heures_presence;
          }
        }

        await item.update(updateData);
        res.json(item);
      } catch (err) { res.status(400).json({ message: err.message }); }
    },

    // DELETE /api/incubes/:incubeId/<resource>/:id
    delete: async (req, res) => {
      try {
        if (!(await checkIncubeAccess(req.params.incubeId, req.user, true))) {
          return res.status(403).json({ message: 'Accès non autorisé à ce dossier' });
        }
        const item = await Model.findByPk(req.params.id);
        if (!item) return res.status(404).json({ message: `${modelName} non trouvé` });
        await item.destroy();
        res.json({ message: `${modelName} supprimé` });
      } catch (err) { res.status(500).json({ message: err.message }); }
    },
  };
}

const financeBase = createSubController(AnalyseFinanciere, 'Analyse financière');

const finance = {
  ...financeBase,

  // POST /api/incubes/:incubeId/analyse-financiere
  // Si le mois et l'année existent déjà pour cet incubé, mettre à jour au lieu de créer un doublon
  create: async (req, res) => {
    try {
      if (!(await checkIncubeAccess(req.params.incubeId, req.user, true))) {
        return res.status(403).json({ message: 'Accès non autorisé à ce dossier' });
      }
      const incube_id = req.params.incubeId;
      const mois = parseInt(req.body.mois);
      const annee = parseInt(req.body.annee) || new Date().getFullYear();

      let item = await AnalyseFinanciere.findOne({
        where: { incube_id, mois, annee }
      });

      if (item) {
        await item.update({ ...req.body, incube_id, mois, annee });
        return res.json(item);
      }

      item = await AnalyseFinanciere.create({ ...req.body, incube_id, mois, annee });
      res.status(201).json(item);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },

  // POST /api/incubes/:incubeId/analyse-financiere/bulk
  // Met à jour atomiquement les 12 mois existants ou les insère dans une transaction
  bulkCreate: async (req, res) => {
    try {
      if (!(await checkIncubeAccess(req.params.incubeId, req.user, true))) {
        return res.status(403).json({ message: 'Accès non autorisé à ce dossier' });
      }
      const items = Array.isArray(req.body) ? req.body : req.body.items;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'Données vides ou invalides' });
      }
      const incube_id = req.params.incubeId;

      const results = await sequelize.transaction(async (t) => {
        const batch = [];
        for (const item of items) {
          const mois = parseInt(item.mois);
          const annee = parseInt(item.annee) || new Date().getFullYear();
          if (isNaN(mois) || mois < 1 || mois > 12) continue;

          let existing = await AnalyseFinanciere.findOne({
            where: { incube_id, mois, annee },
            transaction: t,
          });

          if (existing) {
            await existing.update({ ...item, incube_id, mois, annee }, { transaction: t });
            batch.push(existing);
          } else {
            const created = await AnalyseFinanciere.create({ ...item, incube_id, mois, annee }, { transaction: t });
            batch.push(created);
          }
        }
        return batch;
      });

      res.status(201).json({ message: `${results.length} mois enregistrés`, data: results });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
};

module.exports = {
  materiel: createSubController(GestionMateriel, 'Matériel'),
  engagement: createSubController(SuiviEngagement, 'Engagement'),
  rhEmploi: createSubController(RhEmploi, 'Emploi'),
  rhDetail: createSubController(RhDetail, 'Personnel'),
  planAction: createSubController(PlanAction, 'Plan d\'action'),
  finance,
  ficheSuivi: createSubController(FicheSuivi, 'Fiche de suivi'),
  formation: createSubController(Formation, 'Formation'),
  historiquePhase: createSubController(HistoriquePhase, 'Historique de phase'),
  historiqueStatut: createSubController(HistoriqueStatut, 'Historique de statut juridique'),
};
