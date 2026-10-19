const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const isSuperAdmin = require('../middleware/isSuperAdmin');
const userCtrl = require('../controllers/userController');

const upload = require('../middleware/upload');

// Toutes les routes utilisateurs nécessitent d'être connecté ET d'être Super Admin
router.use(auth);
router.use(isSuperAdmin);

router.get('/', userCtrl.getAll);
router.get('/admins', userCtrl.getAdmins);
router.post('/', upload.single('photo'), userCtrl.create);
router.put('/:id', upload.single('photo'), userCtrl.update);
router.post('/:id/reset-password', userCtrl.resetPasswordByAdmin);
router.delete('/:id', userCtrl.delete);

module.exports = router;
