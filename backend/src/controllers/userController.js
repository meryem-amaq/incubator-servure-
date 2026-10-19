const bcrypt = require('bcryptjs');
const { User, Incube } = require('../models');
const emailService = require('../services/emailService');

// GET /api/users — Liste de tous les utilisateurs avec nombre d'incubés
exports.getAll = async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const users = await User.findAll({
      attributes: { exclude: ['mot_de_passe'] },
      include: [
        {
          model: Incube,
          as: 'incubes',
          attributes: ['id'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    const formatted = users.map(u => ({
      id: u.id,
      nom: u.nom,
      prenom: u.prenom,
      email: u.email,
      role: u.role,
      photo_url: u.photo_url,
      actif: u.actif,
      createdAt: u.createdAt,
      totalIncubes: u.incubes ? u.incubes.length : 0,
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// GET /api/users/admins — Liste simplifiée des accompagnateurs pour les listes déroulantes
exports.getAdmins = async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const admins = await User.findAll({
      where: { 
        actif: true,
        role: { [Op.ne]: 'incube' }
      },
      attributes: ['id', 'nom', 'prenom', 'email', 'role', 'photo_url'],
      order: [['nom', 'ASC']],
    });
    // Filtrer pour ne garder strictement que les accompagnateurs réels (exclure le super admin et le compte Administrateur)
    const accompagnateurs = admins.filter(a => 
      a.id !== 1 && 
      a.role !== 'super_admin' && 
      !a.nom?.toLowerCase().includes('administrateur') &&
      !a.email?.toLowerCase().startsWith('admin@')
    );
    res.json(accompagnateurs);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// POST /api/users — Créer un nouvel accompagnateur/admin
exports.create = async (req, res) => {
  try {
    const { nom, prenom, email, mot_de_passe, role } = req.body;
    if (!nom || !prenom || !email || !mot_de_passe) {
      return res.status(400).json({ message: 'Tous les champs sont requis' });
    }

    const exists = await User.findOne({ where: { email } });
    if (exists) {
      return res.status(400).json({ message: 'Cette adresse e-mail est déjà utilisée' });
    }

    const hash = await bcrypt.hash(mot_de_passe, 12);
    const userRole = role === 'super_admin' ? 'super_admin' : (role === 'user' || role === 'incube' ? role : 'admin');

    const photo_url = req.file 
      ? `data:${req.file.mimetype || 'image/jpeg'};base64,${req.file.buffer.toString('base64')}` 
      : null;

    const newUser = await User.create({
      nom,
      prenom,
      email,
      mot_de_passe: hash,
      role: userRole,
      photo_url,
      actif: true,
    });

    res.status(201).json({
      id: newUser.id,
      nom: newUser.nom,
      prenom: newUser.prenom,
      email: newUser.email,
      role: newUser.role,
      photo_url: newUser.photo_url,
      actif: newUser.actif,
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la création du compte', error: err.message });
  }
};

// PUT /api/users/:id — Mettre à jour un utilisateur
exports.update = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    const { nom, prenom, email, role, actif, mot_de_passe } = req.body;

    if (email && email !== user.email) {
      const exists = await User.findOne({ where: { email } });
      if (exists) {
        return res.status(400).json({ message: 'Cette adresse e-mail est déjà utilisée' });
      }
      user.email = email;
    }

    if (nom) user.nom = nom;
    if (prenom) user.prenom = prenom;
    if (role) user.role = role;
    if (actif !== undefined) user.actif = actif;

    if (mot_de_passe && mot_de_passe.trim().length >= 6) {
      user.mot_de_passe = await bcrypt.hash(mot_de_passe, 12);
    }

    if (req.file) {
      const mime = req.file.mimetype || 'image/jpeg';
      user.photo_url = `data:${mime};base64,${req.file.buffer.toString('base64')}`;
    }

    await user.save();

    res.json({
      id: user.id,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      role: user.role,
      photo_url: user.photo_url,
      actif: user.actif,
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour', error: err.message });
  }
};

// DELETE /api/users/:id — Supprimer un utilisateur
exports.delete = async (req, res) => {
  try {
    if (Number(req.params.id) === req.user.id) {
      return res.status(400).json({ message: 'Vous ne pouvez pas supprimer votre propre compte Super Admin' });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    await user.destroy();
    res.json({ message: 'Utilisateur supprimé avec succès' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la suppression', error: err.message });
  }
};

// POST /api/users/:id/reset-password — Réinitialisation par le Super Admin
exports.resetPasswordByAdmin = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    const { mot_de_passe, envoyer_email = true } = req.body;
    if (!mot_de_passe || mot_de_passe.trim().length < 6) {
      return res.status(400).json({ message: 'Le mot de passe doit comporter au moins 6 caractères' });
    }

    user.mot_de_passe = await bcrypt.hash(mot_de_passe, 12);
    await user.save();

    let emailSent = false;
    if (envoyer_email && user.email) {
      try {
        await emailService.sendPasswordResetByAdminEmail(user, mot_de_passe);
        emailSent = true;
      } catch (mailErr) {
        console.error("Erreur envoi email réinitialisation admin:", mailErr);
      }
    }

    res.json({
      success: true,
      message: `Mot de passe réinitialisé avec succès pour ${user.prenom} ${user.nom}${emailSent ? ' et envoyé par email' : ''}.`,
      emailSent
    });
  } catch (err) {
    console.error("ADMIN RESET PASSWORD ERROR:", err);
    res.status(500).json({ message: 'Erreur lors de la réinitialisation du mot de passe', error: err.message });
  }
};

