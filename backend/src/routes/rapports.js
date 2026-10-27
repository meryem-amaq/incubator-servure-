const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const isSuperAdmin = require('../middleware/isSuperAdmin');
const rapportCtrl = require('../controllers/rapportController');

// Routes protégées par authentification (Réservées au Super Admin)
router.use(auth);
router.use(isSuperAdmin);

// Prévisualisation des données avant export
router.get('/preview-data', rapportCtrl.getPreviewData);

// Génération et téléchargement Word (.docx)
router.post('/generer-word', rapportCtrl.genererRapportWord);

module.exports = router;
