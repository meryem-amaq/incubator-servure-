const { rateLimit } = require('express-rate-limit');

/**
 * Détection des adresses IP locales, privées ou de boucle locale (LAN IDS / Intranet)
 */
const isPrivateOrLocalIP = (ip) => {
  if (!ip) return false;
  const cleanIp = String(ip).replace(/^::ffff:/, '').trim();
  return (
    cleanIp === '127.0.0.1' ||
    cleanIp === '::1' ||
    cleanIp === 'localhost' ||
    cleanIp.startsWith('10.') ||
    cleanIp.startsWith('192.168.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(cleanIp)
  );
};

/**
 * Rate limiter pour la tentative de connexion (Brute-Force Protection)
 * - Exemption totale pour les adresses du réseau local / intranet IDS (10.x.x.x, 192.168.x.x, localhost)
 * - Désactivable via la variable DISABLE_RATE_LIMIT=true ou en environnement de développement
 * - 50 tentatives échouées max par minute pour les connexions externes
 * - Les connexions réussies ne sont jamais pénalisées (skipSuccessfulRequests: true)
 */
const loginLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW_MS, 10) || 60 * 1000, // 1 minute
  limit: parseInt(process.env.RATE_LIMIT_LOGIN_MAX, 10) || 50, // 50 tentatives max
  skip: (req) => {
    if (process.env.DISABLE_RATE_LIMIT === 'true') return true;
    if (process.env.NODE_ENV === 'development') return true;
    if (isPrivateOrLocalIP(req.ip)) return true;
    return false;
  },
  skipSuccessfulRequests: true, // Seuls les échecs de connexion (status >= 400) sont comptabilisés
  standardHeaders: true, // En-têtes RateLimit-* standards
  legacyHeaders: false, // Désactive les anciens en-têtes X-RateLimit-*
  message: {
    message: 'Trop de tentatives de connexion échouées. Veuillez réessayer dans quelques instants.'
  }
});

/**
 * Rate limiter pour la réinitialisation de mot de passe (Anti-spam / Anti-énumération)
 */
const passwordResetLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 20,
  skip: (req) => {
    if (process.env.DISABLE_RATE_LIMIT === 'true') return true;
    if (process.env.NODE_ENV === 'development') return true;
    if (isPrivateOrLocalIP(req.ip)) return true;
    return false;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Trop de demandes de réinitialisation. Veuillez patienter avant de réessayer.'
  }
});

module.exports = {
  loginLimiter,
  passwordResetLimiter,
  isPrivateOrLocalIP
};
