const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireStaff = require('../middleware/requireStaff');
const upload = require('../middleware/upload');
const { Atelier, Incube, PresenceAtelier, sequelize } = require('../models');
const { Op } = require('sequelize');
const syncService = require('../services/SyncService');
const fs = require('fs');
const path = require('path');

const MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

function parseDurationToHours(dureeStr) {
  if (!dureeStr) return 3.0;
  const s = String(dureeStr).trim().toLowerCase();
  const match = s.match(/^(\d+(?:[.,]\d+)?)\s*h(?:(\d+))?/i);
  if (match) {
    const hours = parseFloat(match[1].replace(',', '.'));
    const minutes = match[2] ? parseFloat(match[2]) : 0;
    return hours + (minutes / 60);
  }
  const floatVal = parseFloat(s);
  return !isNaN(floatVal) ? floatVal : 3.0;
}

// GET /api/ateliers
// Retrieve all ateliers with optional animator incubé details and live presence count
router.get('/', auth, async (req, res) => {
  try {
    let ateliers;
    try {
      ateliers = await Atelier.findAll({
        include: [
          {
            model: Incube,
            as: 'animateurIncube',
            attributes: ['id', 'nom_incube', 'email', 'raison_sociale'],
            required: false
          }
        ],
        order: [['date', 'DESC'], ['heureDebut', 'DESC']]
      });
    } catch (e1) {
      console.warn('⚠️ Erreur association atelier/incube, tentative sans include:', e1.message);
      try {
        ateliers = await Atelier.findAll({
          order: [['date', 'DESC'], ['heureDebut', 'DESC']]
        });
      } catch (e2) {
        console.warn('⚠️ Erreur Sequelize findAll, passage en requête brute SQL directe:', e2.message);
        const [rows] = await sequelize.query('SELECT * FROM ateliers ORDER BY date DESC');
        ateliers = rows.map(r => {
          let parsedPhotos = [];
          if (r.photos) {
            try {
              parsedPhotos = typeof r.photos === 'string' ? JSON.parse(r.photos) : r.photos;
            } catch (_) {
              parsedPhotos = [r.photos];
            }
          }
          return {
            id: r.id,
            titre: r.titre,
            formateur: r.formateur || 'Formateur IDS',
            intervenant: r.intervenant || null,
            animateurType: r.animateur_type || 'externe',
            animateurIncubeId: r.animateur_incube_id || null,
            date: r.date,
            dateFin: r.date_fin || null,
            heureDebut: r.heure_debut || '09:30',
            heureFin: r.heure_fin || '12:30',
            duree: r.duree || '3h00',
            description: r.description || '',
            photos: Array.isArray(parsedPhotos) ? parsedPhotos : [],
            statutOuverture: r.statut_ouverture || 'auto',
            driveLink: r.drive_link || null,
            toJSON() { return this; }
          };
        });
      }
    }

    // Calculer le nombre réel de présents pour chaque atelier depuis la base de données
    const atelierIds = ateliers.map(a => String(a.id));
    const presenceCountMap = {};
    if (atelierIds.length > 0) {
      try {
        const presences = await PresenceAtelier.findAll({
          where: {
            atelierId: { [Op.in]: atelierIds },
            present: true
          },
          attributes: ['atelierId', 'incubeId']
        });
        presences.forEach(p => {
          const aId = String(p.atelierId);
          presenceCountMap[aId] = (presenceCountMap[aId] || 0) + 1;
        });
      } catch (errP) {
        console.warn('Erreur calcul presences ateliers:', errP.message);
      }
    }

    const result = ateliers.map(a => {
      const plain = a.toJSON();
      plain.nbPresents = presenceCountMap[String(a.id)] || 0;
      return plain;
    });

    res.json(result);
  } catch (error) {
    console.error('Erreur récupération ateliers:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des ateliers', error: error.message });
  }
});

// GET /api/ateliers/incube-stats/:incubeId
// Récupérer les statistiques d'ateliers (bénéficiaire & animateur) pour un incubé donné et une année
router.get('/incube-stats/:incubeId', auth, async (req, res) => {
  try {
    const incubeId = parseInt(req.params.incubeId, 10);
    if (req.user.role === 'incube' && Number(req.user.pp_id) !== incubeId) {
      return res.status(403).json({
        message: 'Accès interdit : vous ne pouvez consulter que vos propres statistiques d\'ateliers'
      });
    }
    const annee = parseInt(req.query.annee || new Date().getFullYear(), 10);

    const incube = await Incube.findByPk(incubeId);
    if (!incube) {
      return res.status(404).json({ message: 'Incubé introuvable' });
    }

    // 1. Récupérer tous les ateliers de l'année
    let ateliersAnnee;
    try {
      ateliersAnnee = await Atelier.findAll({
        where: {
          date: {
            [Op.between]: [`${annee}-01-01`, `${annee}-12-31`]
          }
        },
        include: [
          {
            model: Incube,
            as: 'animateurIncube',
            attributes: ['id', 'nom_incube', 'email', 'raison_sociale']
          }
        ],
        order: [['date', 'ASC']]
      });
    } catch (dbErr) {
      ateliersAnnee = await Atelier.findAll({
        attributes: { exclude: ['dateFin'] },
        where: {
          date: {
            [Op.between]: [`${annee}-01-01`, `${annee}-12-31`]
          }
        },
        include: [
          {
            model: Incube,
            as: 'animateurIncube',
            attributes: ['id', 'nom_incube', 'email', 'raison_sociale']
          }
        ],
        order: [['date', 'ASC']]
      });
    }

    // 2. Récupérer les présences de cet incubé pour ces ateliers
    const atelierIds = ateliersAnnee.map(a => String(a.id));
    const presences = await PresenceAtelier.findAll({
      where: {
        incubeId: String(incubeId),
        present: true,
        atelierId: { [Op.in]: atelierIds }
      }
    });

    const presentAtelierIds = new Set(presences.map(p => String(p.atelierId)));

    // 3. Organiser par mois
    const monthlyStats = {};
    MOIS.forEach((m, idx) => {
      monthlyStats[m] = {
        mois: m,
        moisIdx: idx,
        // En tant que bénéficiaire (suivi)
        nb_ateliers: 0,
        heures_ateliers: 0,
        ateliers_suivis: [],
        // En tant qu'animateur (dispensé)
        nb_ateliers_animes: 0,
        heures_ateliers_animes: 0,
        ateliers_animes: []
      };
    });

    ateliersAnnee.forEach(atelier => {
      const aDate = new Date(atelier.date);
      const mIdx = aDate.getMonth();
      const mName = MOIS[mIdx];
      const hours = parseDurationToHours(atelier.duree);

      // Vérifier si l'incubé est l'animateur
      const isAnimateur = (
        (atelier.animateurType === 'incube' && Number(atelier.animateurIncubeId) === incubeId) ||
        (atelier.intervenant && atelier.intervenant.toLowerCase().includes(incube.nom_incube.toLowerCase()))
      );

      if (isAnimateur) {
        monthlyStats[mName].nb_ateliers_animes += 1;
        monthlyStats[mName].heures_ateliers_animes += hours;
        monthlyStats[mName].ateliers_animes.push({
          id: atelier.id,
          titre: atelier.titre,
          date: atelier.date,
          heureDebut: atelier.heureDebut,
          heureFin: atelier.heureFin,
          duree: atelier.duree,
          heures: hours
        });
      }

      // Vérifier si l'incubé est présent en tant que bénéficiaire
      if (presentAtelierIds.has(String(atelier.id))) {
        monthlyStats[mName].nb_ateliers += 1;
        monthlyStats[mName].heures_ateliers += hours;
        monthlyStats[mName].ateliers_suivis.push({
          id: atelier.id,
          titre: atelier.titre,
          date: atelier.date,
          heureDebut: atelier.heureDebut,
          heureFin: atelier.heureFin,
          duree: atelier.duree,
          heures: hours,
          formateur: atelier.formateur || atelier.intervenant
        });
      }
    });

    // 4. Totaux annuels
    let totalNbSuivis = 0;
    let totalHeuresSuivies = 0;
    let totalNbAnimes = 0;
    let totalHeuresAnimees = 0;

    Object.values(monthlyStats).forEach(s => {
      totalNbSuivis += s.nb_ateliers;
      totalHeuresSuivies += s.heures_ateliers;
      totalNbAnimes += s.nb_ateliers_animes;
      totalHeuresAnimees += s.heures_ateliers_animes;
    });

    res.json({
      incube: {
        id: incube.id,
        nom_incube: incube.nom_incube,
        email: incube.email
      },
      annee,
      monthly: monthlyStats,
      totals: {
        nb_ateliers_suivis: totalNbSuivis,
        heures_ateliers_suivies: Math.round(totalHeuresSuivies * 10) / 10,
        nb_ateliers_animes: totalNbAnimes,
        heures_ateliers_animes: Math.round(totalHeuresAnimees * 10) / 10
      }
    });
  } catch (error) {
    console.error('Erreur incube-stats ateliers:', error);
    res.status(500).json({ message: "Erreur lors du calcul des statistiques d'ateliers", error: error.message });
  }
});

// POST /api/ateliers/upload-photos
// Upload multiple photos for an atelier
router.post('/upload-photos', auth, requireStaff, upload.array('photos', 10), async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ message: 'Aucun fichier photo fourni' });
    }

    const uploadsBase = process.env.UPLOAD_PATH || path.join(__dirname, '../../uploads');
    const atelierUploadDir = path.join(uploadsBase, 'ateliers');
    if (!fs.existsSync(atelierUploadDir)) {
      fs.mkdirSync(atelierUploadDir, { recursive: true });
    }

    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    const urls = [];

    for (const file of files) {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const check = typeof upload.detectAndValidateMagicBytes === 'function'
        ? upload.detectAndValidateMagicBytes(file.buffer, ext)
        : { valid: true, mime: file.mimetype };

      if (!check.valid || !allowedMimes.includes(check.mime)) {
        continue;
      }

      const safeExt = check.mime === 'image/png' ? '.png' : check.mime === 'image/webp' ? '.webp' : '.jpg';
      const filename = `atelier_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${safeExt}`;
      const filePath = path.join(atelierUploadDir, filename);

      fs.writeFileSync(filePath, file.buffer);
      urls.push(`/uploads/ateliers/${filename}`);
    }

    if (urls.length === 0) {
      return res.status(400).json({ message: 'Aucune image valide (formats autorisés : JPEG, PNG, WebP)' });
    }

    res.json({ urls });
  } catch (error) {
    console.error('Erreur upload photos atelier:', error);
    res.status(500).json({ message: "Erreur lors de l'enregistrement des photos", error: error.message });
  }
});

// POST /api/ateliers/:id/photos
// Append photos to an existing atelier
router.post('/:id/photos', auth, requireStaff, upload.array('photos', 10), async (req, res) => {
  try {
    let atelier = await Atelier.findByPk(req.params.id);
    if (!atelier) {
      try {
        atelier = await Atelier.findOne({ where: { id: req.params.id } });
      } catch (_) {}
    }
    if (!atelier && req.body.titre) {
      try {
        atelier = await Atelier.findOne({ where: { titre: req.body.titre } });
      } catch (_) {}
    }
    if (!atelier) {
      try {
        atelier = await Atelier.create({
          id: req.params.id,
          titre: req.body.titre || 'Atelier IDS',
          date: req.body.date || new Date().toISOString().split('T')[0],
          heureDebut: req.body.heureDebut || '09:30',
          heureFin: req.body.heureFin || '12:30',
          duree: req.body.duree || '3h00',
          statutOuverture: 'auto',
          photos: []
        });
      } catch (errCreate) {
        console.warn('Création auto atelier pour photos:', errCreate.message);
      }
    }
    if (!atelier) {
      return res.status(404).json({ message: 'Atelier non trouvé' });
    }

    const files = req.files || [];
    let newUrls = [];

    if (files.length > 0) {
      const uploadsBase = process.env.UPLOAD_PATH || path.join(__dirname, '../../uploads');
      const atelierUploadDir = path.join(uploadsBase, 'ateliers');
      if (!fs.existsSync(atelierUploadDir)) {
        fs.mkdirSync(atelierUploadDir, { recursive: true });
      }

      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
      for (const file of files) {
        const ext = path.extname(file.originalname || '').toLowerCase();
        const check = typeof upload.detectAndValidateMagicBytes === 'function'
          ? upload.detectAndValidateMagicBytes(file.buffer, ext)
          : { valid: true, mime: file.mimetype };

        if (!check.valid || !allowedMimes.includes(check.mime)) continue;

        const safeExt = check.mime === 'image/png' ? '.png' : check.mime === 'image/webp' ? '.webp' : '.jpg';
        const filename = `atelier_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${safeExt}`;
        fs.writeFileSync(path.join(atelierUploadDir, filename), file.buffer);
        newUrls.push(`/uploads/ateliers/${filename}`);
      }
    } else if (Array.isArray(req.body.photos)) {
      newUrls = req.body.photos.filter(p => typeof p === 'string' && p.trim());
    }

    const currentPhotos = Array.isArray(atelier.photos) ? [...atelier.photos] : [];
    const updatedPhotos = [...currentPhotos, ...newUrls];
    atelier.photos = updatedPhotos;
    try {
      await atelier.save();
    } catch (saveErr) {
      if (String(saveErr.message || '').includes('date_fin')) {
        try {
          await sequelize.query('ALTER TABLE ateliers ADD COLUMN date_fin DATE NULL AFTER date');
          await atelier.save();
        } catch (_) {
          atelier.dateFin = undefined;
          await atelier.save();
        }
      } else {
        throw saveErr;
      }
    }

    syncService.pushAteliersToCloud(atelier).catch(() => {});

    const updatedWithAssoc = await Atelier.findByPk(atelier.id, {
      include: [{ model: Incube, as: 'animateurIncube', attributes: ['id', 'nom_incube', 'email', 'raison_sociale'] }]
    });

    res.json(updatedWithAssoc || atelier);
  } catch (error) {
    console.error('Erreur ajout photos atelier:', error);
    res.status(500).json({ message: "Erreur lors de l'ajout des photos", error: error.message });
  }
});

// DELETE /api/ateliers/:id/photos
// Remove a photo from an atelier
router.delete('/:id/photos', auth, requireStaff, async (req, res) => {
  try {
    const { photoUrl } = req.body;
    let atelier = await Atelier.findByPk(req.params.id);
    if (!atelier) {
      try {
        atelier = await Atelier.findOne({ where: { id: req.params.id } });
      } catch (_) {}
    }

    if (!atelier) {
      if (photoUrl) {
        const filename = path.basename(photoUrl);
        const uploadsBase = process.env.UPLOAD_PATH || path.join(__dirname, '../../uploads');
        const filePath = path.join(uploadsBase, 'ateliers', filename);
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch (_) {}
        }
      }
      return res.json({ success: true, message: 'Photo supprimée', photos: [] });
    }
    if (!photoUrl) {
      return res.status(400).json({ message: 'URL de la photo requise' });
    }

    const currentPhotos = Array.isArray(atelier.photos) ? atelier.photos : [];
    atelier.photos = currentPhotos.filter(u => u !== photoUrl);
    try {
      await atelier.save();
    } catch (saveErr) {
      if (String(saveErr.message || '').includes('date_fin')) {
        try {
          await sequelize.query('ALTER TABLE ateliers ADD COLUMN date_fin DATE NULL AFTER date');
          await atelier.save();
        } catch (_) {
          atelier.dateFin = undefined;
          await atelier.save();
        }
      } else {
        throw saveErr;
      }
    }

    // Supprimer le fichier local si c'est un fichier hébergé dans /uploads/ateliers
    if (typeof photoUrl === 'string' && photoUrl.startsWith('/uploads/ateliers/')) {
      const filename = path.basename(photoUrl);
      const uploadsBase = process.env.UPLOAD_PATH || path.join(__dirname, '../../uploads');
      const filePath = path.join(uploadsBase, 'ateliers', filename);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (_) {}
      }
    }

    syncService.pushAteliersToCloud(atelier).catch(() => {});

    const updatedWithAssoc = await Atelier.findByPk(atelier.id, {
      include: [{ model: Incube, as: 'animateurIncube', attributes: ['id', 'nom_incube', 'email', 'raison_sociale'] }]
    });

    res.json(updatedWithAssoc);
  } catch (error) {
    console.error('Erreur suppression photo atelier:', error);
    res.status(500).json({ message: "Erreur lors de la suppression de la photo", error: error.message });
  }
});

// POST /api/ateliers
// Create a new atelier
router.post('/', auth, requireStaff, async (req, res) => {
  try {
    const {
      titre, formateur, intervenant, date, dateFin,
      heureDebut, heureFin, duree, description, statutOuverture,
      animateurType, animateurIncubeId, photos
    } = req.body;

    let finalIntervenant = intervenant || null;
    let resolvedAnimateurType = animateurType || 'externe';
    let resolvedAnimateurIncubeId = animateurIncubeId ? parseInt(animateurIncubeId, 10) : null;

    if (resolvedAnimateurType === 'incube' && resolvedAnimateurIncubeId) {
      const inc = await Incube.findByPk(resolvedAnimateurIncubeId);
      if (inc) {
        finalIntervenant = `Incubé : ${inc.nom_incube}`;
      }
    }

    let atelier;
    const atelierData = {
      titre: titre || 'Nouvel Atelier',
      formateur: formateur || 'Intervenant IDS',
      intervenant: finalIntervenant,
      animateurType: resolvedAnimateurType,
      animateurIncubeId: resolvedAnimateurIncubeId,
      date: date || new Date().toISOString().split('T')[0],
      dateFin: dateFin || null,
      heureDebut: heureDebut || '09:30',
      heureFin: heureFin || '12:30',
      duree: duree || '3h00',
      description: description || null,
      photos: Array.isArray(photos) ? photos : [],
      statutOuverture: statutOuverture || 'auto'
    };

    try {
      atelier = await Atelier.create(atelierData);
    } catch (createErr) {
      if (String(createErr.message || '').includes('date_fin')) {
        try {
          await sequelize.query('ALTER TABLE ateliers ADD COLUMN date_fin DATE NULL AFTER date');
          atelier = await Atelier.create(atelierData);
        } catch (_) {
          delete atelierData.dateFin;
          atelier = await Atelier.create(atelierData);
        }
      } else {
        throw createErr;
      }
    }

    // Pousser l'atelier vers le cloud relay (silencieux si hors ligne)
    syncService.pushAteliersToCloud(atelier).catch(() => {});

    // Recharger avec l'association pour la réponse
    const createdWithAssoc = await Atelier.findByPk(atelier.id, {
      include: [{ model: Incube, as: 'animateurIncube', attributes: ['id', 'nom_incube', 'email', 'raison_sociale'] }]
    });

    res.status(201).json(createdWithAssoc);
  } catch (error) {
    console.error('Erreur création atelier:', error);
    res.status(500).json({ message: "Erreur lors de la création de l'atelier", error: error.message });
  }
});

// PUT /api/ateliers/:id
// Update an existing atelier
router.put('/:id', auth, requireStaff, async (req, res) => {
  try {
    const atelier = await Atelier.findByPk(req.params.id);
    if (!atelier) {
      return res.status(404).json({ message: 'Atelier non trouvé' });
    }

    const {
      titre, formateur, intervenant, date, dateFin,
      heureDebut, heureFin, duree, description, statutOuverture,
      animateurType, animateurIncubeId, photos
    } = req.body;

    if (titre !== undefined) atelier.titre = titre;
    if (formateur !== undefined) atelier.formateur = formateur;
    if (intervenant !== undefined) atelier.intervenant = intervenant;
    if (date !== undefined) atelier.date = date;
    if (dateFin !== undefined) atelier.dateFin = dateFin || null;
    if (heureDebut !== undefined) atelier.heureDebut = heureDebut;
    if (heureFin !== undefined) atelier.heureFin = heureFin;
    if (duree !== undefined) atelier.duree = duree;
    if (description !== undefined) atelier.description = description;
    if (photos !== undefined) atelier.photos = Array.isArray(photos) ? photos : [];
    if (statutOuverture !== undefined) atelier.statutOuverture = statutOuverture;

    if (animateurType !== undefined) atelier.animateurType = animateurType;
    if (animateurIncubeId !== undefined) {
      atelier.animateurIncubeId = animateurIncubeId ? parseInt(animateurIncubeId, 10) : null;
      if (atelier.animateurType === 'incube' && atelier.animateurIncubeId) {
        const inc = await Incube.findByPk(atelier.animateurIncubeId);
        if (inc && (!intervenant || intervenant.startsWith('Incubé :'))) {
          atelier.intervenant = `Incubé : ${inc.nom_incube}`;
        }
      }
    }

    try {
      await atelier.save();
    } catch (saveErr) {
      if (String(saveErr.message || '').includes('date_fin')) {
        try {
          await sequelize.query('ALTER TABLE ateliers ADD COLUMN date_fin DATE NULL AFTER date');
          await atelier.save();
        } catch (_) {
          atelier.dateFin = undefined;
          await atelier.save();
        }
      } else {
        throw saveErr;
      }
    }

    // Mettre à jour l'atelier sur le cloud relay
    syncService.pushAteliersToCloud(atelier).catch(() => {});

    const updatedWithAssoc = await Atelier.findByPk(atelier.id, {
      include: [{ model: Incube, as: 'animateurIncube', attributes: ['id', 'nom_incube', 'email', 'raison_sociale'] }]
    });

    res.json(updatedWithAssoc);
  } catch (error) {
    console.error('Erreur modification atelier:', error);
    res.status(500).json({ message: "Erreur lors de la modification de l'atelier", error: error.message });
  }
});

// DELETE /api/ateliers/:id
// Delete an atelier
router.delete('/:id', auth, requireStaff, async (req, res) => {
  try {
    const atelier = await Atelier.findByPk(req.params.id);
    if (!atelier) {
      return res.status(404).json({ message: 'Atelier non trouvé' });
    }
    
    await atelier.destroy();
    res.json({ message: 'Atelier supprimé avec succès' });
  } catch (error) {
    console.error('Erreur suppression atelier:', error);
    res.status(500).json({ message: "Erreur lors de la suppression de l'atelier" });
  }
});

module.exports = router;
