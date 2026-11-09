const jwt = require('jsonwebtoken');
const { getTokenFromRequest } = require('../utils/authCookie');
const { User } = require('../models');

// Cache mémoire court (3s) pour vérifier l'état actif et le rôle en base sans surcharger MySQL
const userStateCache = new Map();
const CACHE_TTL_MS = 3000;

function invalidateUserAuthCache(userId) {
  if (userId === undefined || userId === null) {
    userStateCache.clear();
  } else {
    userStateCache.delete(Number(userId));
  }
}

const authMiddleware = async (req, res, next) => {
  // Jeton lu depuis le cookie httpOnly (navigateur) ou l'en-tête Bearer (scripts / tests)
  const token = getTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ message: 'Token manquant ou invalide' });
  }
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ message: 'Configuration de sécurité du serveur incomplète' });
    const decoded = jwt.verify(token, secret);

    if (decoded && decoded.id) {
      const uid = Number(decoded.id);
      const now = Date.now();
      let cached = userStateCache.get(uid);
      if (!cached || cached.expiresAt <= now) {
        const dbUser = await User.findByPk(uid, { attributes: ['id', 'role', 'actif', 'nom'] });
        if (!dbUser) {
          userStateCache.delete(uid);
          return res.status(401).json({ message: 'Compte utilisateur introuvable ou révoqué' });
        }
        cached = {
          actif: Boolean(dbUser.actif),
          role: dbUser.role,
          nom: dbUser.nom,
          expiresAt: now + CACHE_TTL_MS,
        };
        userStateCache.set(uid, cached);
      }

      if (!cached.actif) {
        return res.status(401).json({ message: 'Compte désactivé ou suspendu' });
      }
      decoded.role = cached.role;
      if (cached.nom && !decoded.nom) decoded.nom = cached.nom;
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token expiré ou invalide' });
  }
};

authMiddleware.invalidateUserAuthCache = invalidateUserAuthCache;
module.exports = authMiddleware;
