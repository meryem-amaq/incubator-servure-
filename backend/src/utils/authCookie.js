const jwt = require('jsonwebtoken');

/**
 * Gestion centralisée du jeton d'authentification (JWT) via cookie httpOnly.
 *
 * - Le jeton n'est JAMAIS exposé au JavaScript du navigateur (httpOnly) :
 *   une faille XSS ne permet pas de le lire ni de l'exfiltrer.
 * - Secure : le cookie n'est transmis que sur HTTPS (localhost est toléré par les navigateurs).
 *   Peut être désactivé UNIQUEMENT pour un déploiement HTTP interne via COOKIE_SECURE=false.
 * - SameSite=Strict : le cookie n'est jamais envoyé depuis un site tiers (protection CSRF).
 */
const AUTH_COOKIE_NAME = 'ids_auth';

/**
 * Détermine si l'attribut `Secure` doit être activé sur le cookie :
 * - Si COOKIE_SECURE=true ou COOKIE_SECURE=false est explicitement défini dans .env, cette valeur prime.
 * - Sinon (auto-détection par requête) : activé uniquement si la requête est en HTTPS
 *   (req.secure ou X-Forwarded-Proto: https). Cela garantit que la connexion fonctionne
 *   sur le serveur HTTP interne (ex: http://10.0.5.126:3030) tout en activant automatiquement
 *   Secure dès que la plateforme est servie en HTTPS.
 */
const isSecureCookie = (req) => {
  const envVal = String(process.env.COOKIE_SECURE || '').trim().toLowerCase();
  if (envVal === 'true' || envVal === '1') return true;
  if (envVal === 'false' || envVal === '0') return false;
  if (req) {
    const proto = String(req.headers?.['x-forwarded-proto'] || '').toLowerCase();
    return Boolean(req.secure || proto.includes('https'));
  }
  return false;
};

const baseCookieOptions = (req) => ({
  httpOnly: true,
  secure: isSecureCookie(req),
  sameSite: 'lax',
  path: '/',
});

// Lecture d'un cookie depuis l'en-tête brut (évite une dépendance supplémentaire à cookie-parser)
const readCookie = (req, name) => {
  const header = req.headers && req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      try {
        return decodeURIComponent(part.slice(idx + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
};

/**
 * Récupère le jeton : cookie httpOnly en priorité (navigateur),
 * puis en-tête Authorization: Bearer (scripts serveur, tests automatisés).
 */
const getTokenFromRequest = (req) => {
  const fromCookie = readCookie(req, AUTH_COOKIE_NAME);
  if (fromCookie) return fromCookie;
  const authHeader = req.headers && req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1] || null;
  }
  return null;
};

// Dépose le jeton dans un cookie httpOnly dont la durée de vie correspond à l'expiration du JWT
const setAuthCookie = (res, token, req = null) => {
  const options = baseCookieOptions(req || res.req);
  const decoded = jwt.decode(token);
  if (decoded && decoded.exp) {
    options.maxAge = Math.max(decoded.exp * 1000 - Date.now(), 0);
  }
  res.cookie(AUTH_COOKIE_NAME, token, options);
};

const clearAuthCookie = (res, req = null) => {
  res.clearCookie(AUTH_COOKIE_NAME, baseCookieOptions(req || res.req));
};

module.exports = {
  AUTH_COOKIE_NAME,
  isSecureCookie,
  getTokenFromRequest,
  setAuthCookie,
  clearAuthCookie,
};

