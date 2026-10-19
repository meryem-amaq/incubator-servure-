const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const rapportCtrl = require('../controllers/rapportController');

// Routes protégées par authentification (Super Admin et Coachs/Admins)
router.use(auth);

// Prévisualisation des données avant export
router.get('/preview-data', rapportCtrl.getPreviewData);

// Génération et téléchargement Word (.docx)
router.post('/generer-word', rapportCtrl.genererRapportWord);

module.exports = router;
