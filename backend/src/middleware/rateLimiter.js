const { rateLimit } = require('express-rate-limit');

/**
 * Rate limiter pour la tentative de connexion (Brute-Force Protection)
 * - 5 tentatives échouées par tranche de 15 minutes par IP
 * - Les connexions réussies ne sont pas pénalisées (skipSuccessfulRequests: true)
 */
const loginLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes par défaut
  limit: parseInt(process.env.RATE_LIMIT_LOGIN_MAX, 10) || 5, // 5 tentatives échouées max
  skipSuccessfulRequests: true, // Seuls les échecs de connexion (status >= 400) sont comptabilisés
  standardHeaders: true, // En-têtes RateLimit-* standards
  legacyHeaders: false, // Désactive les anciens en-têtes X-RateLimit-*
  message: {
    message: 'Trop de tentatives de connexion échouées. Veuillez réessayer après 15 minutes.'
  }
});

/**
 * Rate limiter pour la réinitialisation de mot de passe (Anti-spam / Anti-énumération)
 * - 3 demandes par tranche de 15 minutes par IP
 */
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Trop de demandes de réinitialisation. Veuillez patienter avant de réessayer.'
  }
});

module.exports = {
  loginLimiter,
  passwordResetLimiter
};
