const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const isSuperAdmin = require('../middleware/isSuperAdmin');
const userCtrl = require('../controllers/userController');

const upload = require('../middleware/upload');
const tourniquetService = require('../services/tourniquetService');

// GET /api/users/activite?type=Formation : Historique et total d'accès pour les catégories hors-incubés
router.get('/activite', auth, async (req, res) => {
  try {
    const { type = 'Formation', startDate, endDate } = req.query;
    const result = await tourniquetService.getActivityByType(type, startDate, endDate);
    res.json(result);
  } catch (err) {
    console.error('Erreur /users/activite:', err);
    res.status(500).json({ message: "Erreur lors de la récupération de l'activité usagers", error: err.message });
  }
});

// Toutes les routes utilisateurs d'administration nécessitent d'être Super Admin
router.use(auth);
router.use(isSuperAdmin);

router.get('/', userCtrl.getAll);
router.get('/admins', userCtrl.getAdmins);
router.post('/', upload.single('photo'), userCtrl.create);
router.put('/:id', upload.single('photo'), userCtrl.update);
router.post('/:id/reset-password', userCtrl.resetPasswordByAdmin);
router.delete('/:id', userCtrl.delete);

module.exports = router;
