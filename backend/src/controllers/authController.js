const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { User, Incube } = require('../models');
const emailService = require('../services/emailService');
const { setAuthCookie, clearAuthCookie } = require('../utils/authCookie');
const { invalidateUserAuthCache } = require('../middleware/auth');

// POST /api/auth/logout : suppression du cookie httpOnly (impossible depuis le JavaScript du navigateur)
exports.logout = (req, res) => {
  clearAuthCookie(res, req);
  res.json({ success: true });
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, mot_de_passe } = req.body || {};
    if (typeof email !== 'string' || typeof mot_de_passe !== 'string' || !email.trim() || !mot_de_passe) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }
    const cleanEmail = email.trim();
    const emailAliases = [cleanEmail];
    const lowerEmail = cleanEmail.toLowerCase();

    // Tolérance orthographique pour Ilham LAHBOUB : si saisie avec 'e' (ilhame.lahboub@ctpes.ma), rediriger vers son compte officiel sans 'e' (ilham.lahboub@ctpes.ma)
    if (lowerEmail === 'ilhame.lahboub@ctpes.ma') {
      emailAliases.push('ilham.lahboub@ctpes.ma');
    }

    const user = await User.findOne({ where: { email: { [Op.in]: emailAliases }, actif: true } });
    if (!user) return res.status(401).json({ message: 'Email ou mot de passe incorrect' });

    const valid = await bcrypt.compare(mot_de_passe, user.mot_de_passe);
    if (!valid) return res.status(401).json({ message: 'Email ou mot de passe incorrect' });

    // Si le rôle est 'incube', récupérer l'identifiant du porteur de projet (pp_id)
    let ppId = null;
    if (user.role === 'incube') {
      let incube = await Incube.findOne({ where: { user_id: user.id } });
      // Rétrocompatibilité / synchro automatique par email uniquement si la correspondance est unique et sans ambiguïté
      if (!incube && user.email) {
        const matches = await Incube.findAll({ where: { email: user.email } });
        if (matches.length === 1) {
          incube = matches[0];
          if (!incube.user_id) {
            incube.user_id = user.id;
            await incube.save();
          }
        }
      }
      if (incube) {
        ppId = incube.id;
      }
    }

    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    if (user.role === 'incube') {
      payload.pp_id = ppId;
    }

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Jeton déposé dans un cookie httpOnly (Secure auto-détecté selon HTTP/HTTPS) : il n'est plus renvoyé dans le corps JSON
    setAuthCookie(res, token, req);

    res.json({
      user: {
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        telephone: user.telephone,
        role: user.role,
        photo_url: user.photo_url,
        pp_id: ppId,
      },
    });
  } catch (err) {
    console.error('❌ Erreur lors de la tentative de connexion:', err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// GET /api/auth/me
exports.me = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['mot_de_passe'] },
      include: req.user.role === 'incube' ? [{ model: Incube, as: 'porteurProjet' }] : [],
    });
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

    const userData = user.toJSON();
    if (req.user.role === 'incube') {
      userData.pp_id = req.user.pp_id || (user.porteurProjet ? user.porteurProjet.id : null);
    }

    res.json(userData);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// POST /api/auth/register (Super Admin uniquement)
exports.register = async (req, res) => {
  try {
    const { nom, prenom, email, mot_de_passe, role } = req.body;
    if (!nom || !prenom || !email || !mot_de_passe || String(mot_de_passe).length < 6) {
      return res.status(400).json({ message: 'Champs obligatoires manquants ou mot de passe trop court (min 6 caractères)' });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const exists = await User.findOne({ where: { email: cleanEmail } });
    if (exists) return res.status(400).json({ message: 'Email déjà utilisé' });

    const allowedRoles = ['super_admin', 'admin', 'incube'];
    const safeRole = allowedRoles.includes(role) ? role : 'admin';

    const hash = await bcrypt.hash(mot_de_passe, 12);
    const user = await User.create({ nom, prenom, email: cleanEmail, mot_de_passe: hash, role: safeRole });

    try {
      const { syncWhitelistCloud } = require('./incubeController');
      if (typeof syncWhitelistCloud === 'function') {
        syncWhitelistCloud().catch(err => console.warn('⚠️ [Whitelist] Erreur sync auto register:', err.message));
      }
    } catch (_) {}

    res.status(201).json({
      message: 'Utilisateur créé',
      user: { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email, telephone: user.telephone, role: user.role, photo_url: user.photo_url },
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// PUT /api/auth/me
exports.updateMe = async (req, res) => {
  try {
    const { nom, prenom, email, telephone, mot_de_passe } = req.body;
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

    if (nom) user.nom = nom;
    if (prenom) user.prenom = prenom;
    if (email) user.email = email;
    if (telephone !== undefined) user.telephone = telephone;

    if (mot_de_passe && mot_de_passe.trim().length >= 6) {
      user.mot_de_passe = await bcrypt.hash(mot_de_passe, 12);
    }

    if (req.file) {
      const allowedImageMimes = ['image/jpeg', 'image/png', 'image/webp'];
      const mime = allowedImageMimes.includes(req.file.mimetype) ? req.file.mimetype : null;
      if (!mime) {
        return res.status(400).json({ message: 'Format de photo non autorisé (JPEG, PNG ou WebP requis)' });
      }
      user.photo_url = `data:${mime};base64,${req.file.buffer.toString('base64')}`;
    }

    await user.save();
    invalidateUserAuthCache(user.id);

    res.json({
      id: user.id,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      telephone: user.telephone,
      role: user.role,
      photo_url: user.photo_url
    });
  } catch (err) {
    console.error("UPDATE ME ERROR:", err);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du profil', error: err.message });
  }
};

// POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string' || /[\r\n]/.test(email)) {
      return res.status(400).json({ message: "Veuillez fournir une adresse e-mail valide" });
    }

    const user = await User.findOne({ where: { email: email.trim().toLowerCase(), actif: true } });

    // Sécurité OWASP : Ne jamais divulguer si l'email existe ou pas
    if (!user) {
      return res.json({
        success: true,
        message: "Si cette adresse email est associée à un compte actif, vous recevrez un lien de réinitialisation d'ici quelques instants."
      });
    }

    // Clé secrète dynamique unique liée au mot de passe actuel de l'utilisateur (usage unique garanti)
    const secret = (process.env.JWT_SECRET || 'ids_default_secret_key') + user.mot_de_passe;
    const token = jwt.sign(
      { id: user.id, email: user.email, purpose: 'reset_password' },
      secret,
      { expiresIn: '30m' }
    );

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${baseUrl}/reset-password?token=${token}&id=${user.id}`;

    await emailService.sendForgotPasswordEmail(user, resetUrl);

    res.json({
      success: true,
      message: "Si cette adresse email est associée à un compte actif, vous recevrez un lien de réinitialisation d'ici quelques instants."
    });
  } catch (err) {
    console.error("FORGOT PASSWORD ERROR:", err);
    res.status(500).json({ message: "Une erreur est survenue lors du traitement de la demande", error: err.message });
  }
};

// POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const { id, token, nouveau_mot_de_passe } = req.body || {};

    if (!id || typeof token !== 'string' || typeof nouveau_mot_de_passe !== 'string') {
      return res.status(400).json({ message: "Informations incomplètes pour la réinitialisation" });
    }

    if (nouveau_mot_de_passe.length < 6) {
      return res.status(400).json({ message: "Le mot de passe doit comporter au moins 6 caractères" });
    }

    const user = await User.findByPk(id);
    if (!user || !user.actif) {
      return res.status(400).json({ message: "Ce lien de réinitialisation est invalide ou expiré" });
    }

    // Vérification de la signature cryptographique dynamique
    const secret = (process.env.JWT_SECRET || 'ids_default_secret_key') + user.mot_de_passe;
    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (jwtErr) {
      return res.status(400).json({ message: "Ce lien de réinitialisation est invalide ou a déjà été utilisé (validité 30 minutes)." });
    }

    if (decoded.purpose !== 'reset_password' || String(decoded.id) !== String(user.id)) {
      return res.status(400).json({ message: "Token de réinitialisation invalide" });
    }

    // Hachage du nouveau mot de passe avec bcrypt salt 12
    user.mot_de_passe = await bcrypt.hash(nouveau_mot_de_passe, 12);
    await user.save();
    invalidateUserAuthCache(user.id);

    res.json({
      success: true,
      message: "Votre mot de passe a été réinitialisé avec succès ! Vous pouvez maintenant vous connecter."
    });
  } catch (err) {
    console.error("RESET PASSWORD ERROR:", err);
    res.status(500).json({ message: "Erreur lors de la réinitialisation du mot de passe", error: err.message });
  }
};

