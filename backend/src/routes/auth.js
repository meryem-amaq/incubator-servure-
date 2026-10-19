const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

const upload = require('../middleware/upload');
const { loginLimiter, passwordResetLimiter } = require('../middleware/rateLimiter');

router.post('/login', loginLimiter, authController.login);
router.post('/forgot-password', passwordResetLimiter, authController.forgotPassword);
router.post('/reset-password', passwordResetLimiter, authController.resetPassword);
router.get('/me', authMiddleware, authController.me);
router.put('/me', authMiddleware, upload.single('photo'), authController.updateMe);
router.post('/register', authMiddleware, authController.register); // admin only

module.exports = router;
