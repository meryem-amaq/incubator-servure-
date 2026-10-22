module.exports = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentification requise' });
  }

  const role = req.user.role;
  if (['super_admin', 'admin', 'administrateur', 'superadmin'].includes(role)) {
    return next();
  }

  return res.status(403).json({
    message: 'Accès interdit : Cette action est réservée à l\'administration',
  });
};
