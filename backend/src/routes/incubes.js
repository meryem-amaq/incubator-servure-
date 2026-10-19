const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorizeIncube = require('../middleware/authorizeIncube');
const isSuperAdmin = require('../middleware/isSuperAdmin');
const upload = require('../middleware/upload');
const incubeCtrl = require('../controllers/incubeController');
const sub = require('../controllers/subControllers');

// === Incubés ===
router.get('/mon-profil', auth, authorizeIncube, incubeCtrl.getMonProfil);
router.get('/stats', auth, isSuperAdmin, incubeCtrl.getStats);
router.get('/', auth, incubeCtrl.getAll);
router.get('/:id', auth, incubeCtrl.getOne);
router.post('/', auth, upload.single('photo'), incubeCtrl.create);
router.post('/bulk', auth, incubeCtrl.bulkCreate);
router.put('/:id/assigner', auth, isSuperAdmin, incubeCtrl.assigner);
router.put('/:id', auth, upload.single('photo'), incubeCtrl.update);
router.post('/:id/activer-compte', auth, incubeCtrl.activerCompte);
router.post('/:id/desactiver-compte', auth, incubeCtrl.desactiverCompte);
router.post('/:id/renvoyer-acces', auth, incubeCtrl.renvoyerAcces);
router.post('/:id/alerte-assiduite', auth, incubeCtrl.envoyerAlerteAssiduite);
router.post('/:id/welcome-email', auth, incubeCtrl.envoyerWelcomeEmail);
router.delete('/:id', auth, incubeCtrl.delete);

// === Matériel ===
router.get('/:incubeId/materiel', auth, sub.materiel.getAll);
router.post('/:incubeId/materiel', auth, sub.materiel.create);
router.post('/:incubeId/materiel/bulk', auth, sub.materiel.bulkCreate);
router.put('/:incubeId/materiel/:id', auth, sub.materiel.update);
router.delete('/:incubeId/materiel/:id', auth, sub.materiel.delete);

// === Engagement ===
router.get('/:incubeId/engagement', auth, sub.engagement.getAll);
router.post('/:incubeId/engagement', auth, sub.engagement.create);
router.post('/:incubeId/engagement/bulk', auth, sub.engagement.bulkCreate);
router.put('/:incubeId/engagement/:id', auth, sub.engagement.update);
router.delete('/:incubeId/engagement/:id', auth, sub.engagement.delete);

// === RH Emploi ===
router.get('/:incubeId/rh-emploi', auth, sub.rhEmploi.getAll);
router.post('/:incubeId/rh-emploi', auth, sub.rhEmploi.create);
router.post('/:incubeId/rh-emploi/bulk', auth, sub.rhEmploi.bulkCreate);
router.put('/:incubeId/rh-emploi/:id', auth, sub.rhEmploi.update);
router.delete('/:incubeId/rh-emploi/:id', auth, sub.rhEmploi.delete);

// === RH Détail personnel ===
router.get('/:incubeId/rh-detail', auth, sub.rhDetail.getAll);
router.post('/:incubeId/rh-detail', auth, sub.rhDetail.create);
router.post('/:incubeId/rh-detail/bulk', auth, sub.rhDetail.bulkCreate);
router.put('/:incubeId/rh-detail/:id', auth, sub.rhDetail.update);
router.delete('/:incubeId/rh-detail/:id', auth, sub.rhDetail.delete);

// === Plan d'action ===
router.get('/:incubeId/plan-action', auth, sub.planAction.getAll);
router.post('/:incubeId/plan-action', auth, sub.planAction.create);
router.post('/:incubeId/plan-action/bulk', auth, sub.planAction.bulkCreate);
router.put('/:incubeId/plan-action/:id', auth, sub.planAction.update);
router.delete('/:incubeId/plan-action/:id', auth, sub.planAction.delete);

// === Analyse financière ===
router.get('/:incubeId/analyse-financiere', auth, sub.finance.getAll);
router.post('/:incubeId/analyse-financiere', auth, sub.finance.create);
router.post('/:incubeId/analyse-financiere/bulk', auth, sub.finance.bulkCreate);
router.put('/:incubeId/analyse-financiere/:id', auth, sub.finance.update);
router.delete('/:incubeId/analyse-financiere/:id', auth, sub.finance.delete);

// === Fiche Technique & Suivi ===
router.get(['/:incubeId/fiche-suivi', '/:incubeId/fiche-technique'], auth, sub.ficheSuivi.getAll);
router.post(['/:incubeId/fiche-suivi', '/:incubeId/fiche-technique'], auth, sub.ficheSuivi.create);
router.post(['/:incubeId/fiche-suivi/bulk', '/:incubeId/fiche-technique/bulk'], auth, sub.ficheSuivi.bulkCreate);
router.put(['/:incubeId/fiche-suivi/:id', '/:incubeId/fiche-technique/:id'], auth, sub.ficheSuivi.update);
router.delete(['/:incubeId/fiche-suivi/:id', '/:incubeId/fiche-technique/:id'], auth, sub.ficheSuivi.delete);

// === Formation ===
router.get('/:incubeId/formation', auth, sub.formation.getAll);
router.post('/:incubeId/formation', auth, sub.formation.create);
router.post('/:incubeId/formation/bulk', auth, sub.formation.bulkCreate);
router.put('/:incubeId/formation/:id', auth, sub.formation.update);
router.delete('/:incubeId/formation/:id', auth, sub.formation.delete);

// === Historique Phase ===
router.get('/:incubeId/historique-phase', auth, sub.historiquePhase.getAll);

// === Historique Statut Juridique ===
router.get('/:incubeId/historique-statut', auth, sub.historiqueStatut.getAll);

module.exports = router;
