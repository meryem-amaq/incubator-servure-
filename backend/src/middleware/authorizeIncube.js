const jwt = require('jsonwebtoken');

/**
 * Middleware Express : authorizeIncube
 * 
 * Objectif :
 * 1. Vérifie que l'utilisateur est authentifié (utilise req.user ou valide le token JWT s'il n'est pas encore décodé).
 * 2. Vérifie qu'il possède impérativement le rôle 'incube'.
 * 3. Vérifie la présence de son identifiant porteur de projet (req.user.pp_id).
 * 4. Cloisonnement strict (Anti-IDOR) : Empêche toute tentative d'accès aux données d'un autre porteur de projet.
 *    Si un paramètre :id, :incubeId ou :pp_id est présent dans l'URL, il doit correspondre exactement à req.user.pp_id.
 * 5. Injecte req.incubeId et req.ppId pour simplifier et sécuriser l'accès aux données dans les contrôleurs.
 */
module.exports = (req, res, next) => {
  // 1. Vérification de l'authentification préalable
  if (!req.user) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentification requise : token manquant' });
    }
    const token = authHeader.split(' ')[1];
    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) return res.status(500).json({ message: 'Configuration de sécurité du serveur incomplète' });
      req.user = jwt.verify(token, secret);
    } catch (err) {
      return res.status(401).json({ message: 'Session expirée ou token invalide' });
    }
  }

  // 2. Vérification du rôle 'incube'
  if (req.user.role !== 'incube') {
    return res.status(403).json({
      message: 'Accès refusé : cette ressource est strictement réservée aux porteurs de projet (incubés)',
    });
  }

  // 3. Vérification de la présence de l'ID porteur de projet (pp_id)
  const userPpId = req.user.pp_id ? Number(req.user.pp_id) : null;
  if (!userPpId) {
    return res.status(403).json({
      message: 'Accès refusé : aucun dossier incubé (PP) n\'est rattaché à ce compte utilisateur',
    });
  }

  // 4. Cloisonnement strict des données (Anti-IDOR)
  // Détection des identifiants incubé passés dans l'URL (:id, :incubeId, :pp_id, :ppId)
  const targetIdParam = req.params.incubeId || req.params.pp_id || req.params.ppId || req.params.id;

  if (targetIdParam !== undefined) {
    const targetId = Number(targetIdParam);

    // Si le paramètre cible n'est pas son propre pp_id, interdiction formelle
    if (isNaN(targetId) || targetId !== userPpId) {
      return res.status(403).json({
        message: 'Accès interdit : vous n\'avez pas l\'autorisation de consulter ou modifier les données d\'un autre porteur de projet',
      });
    }
  }

  // 5. Injection de l'identifiant pour les contrôleurs suivants
  req.incubeId = userPpId;
  req.ppId = userPpId;

  next();
};
