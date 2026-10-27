module.exports = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentification requise' });
  }

  const staffRoles = ['super_admin', 'admin', 'administrateur', 'superadmin', 'accompagnateur', 'gestionnaire', 'consultant'];
  if (staffRoles.includes(req.user.role)) {
    return next();
  }

  return res.status(403).json({
    message: 'Accès interdit : Cette action est réservée à l\'équipe d\'encadrement (Staff)',
  });
};
