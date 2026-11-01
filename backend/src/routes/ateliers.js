const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireStaff = require('../middleware/requireStaff');
const { Atelier, Incube, PresenceAtelier } = require('../models');
const { Op } = require('sequelize');
const syncService = require('../services/SyncService');

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
// Retrieve all ateliers with optional animator incubé details
router.get('/', auth, async (req, res) => {
  try {
    const ateliers = await Atelier.findAll({
      include: [
        {
          model: Incube,
          as: 'animateurIncube',
          attributes: ['id', 'nom_incube', 'email', 'raison_sociale']
        }
      ],
      order: [['date', 'DESC'], ['heureDebut', 'DESC']]
    });
    res.json(ateliers);
  } catch (error) {
    console.error('Erreur récupération ateliers:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des ateliers' });
  }
});

// GET /api/ateliers/incube-stats/:incubeId
// Récupérer les statistiques d'ateliers (bénéficiaire & animateur) pour un incubé donné et une année
router.get('/incube-stats/:incubeId', auth, async (req, res) => {
  try {
    const incubeId = parseInt(req.params.incubeId, 10);
    const annee = parseInt(req.query.annee || new Date().getFullYear(), 10);

    const incube = await Incube.findByPk(incubeId);
    if (!incube) {
      return res.status(404).json({ message: 'Incubé introuvable' });
    }

    // 1. Récupérer tous les ateliers de l'année
    const ateliersAnnee = await Atelier.findAll({
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

// POST /api/ateliers
// Create a new atelier
router.post('/', auth, requireStaff, async (req, res) => {
  try {
    const {
      titre, formateur, intervenant, date,
      heureDebut, heureFin, duree, description, statutOuverture,
      animateurType, animateurIncubeId
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

    const atelier = await Atelier.create({
      titre: titre || 'Nouvel Atelier',
      formateur: formateur || 'Intervenant IDS',
      intervenant: finalIntervenant,
      animateurType: resolvedAnimateurType,
      animateurIncubeId: resolvedAnimateurIncubeId,
      date: date || new Date().toISOString().split('T')[0],
      heureDebut: heureDebut || '09:30',
      heureFin: heureFin || '12:30',
      duree: duree || '3h00',
      description: description || null,
      statutOuverture: statutOuverture || 'auto'
    });

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
      titre, formateur, intervenant, date,
      heureDebut, heureFin, duree, description, statutOuverture,
      animateurType, animateurIncubeId
    } = req.body;

    if (titre !== undefined) atelier.titre = titre;
    if (formateur !== undefined) atelier.formateur = formateur;
    if (intervenant !== undefined) atelier.intervenant = intervenant;
    if (date !== undefined) atelier.date = date;
    if (heureDebut !== undefined) atelier.heureDebut = heureDebut;
    if (heureFin !== undefined) atelier.heureFin = heureFin;
    if (duree !== undefined) atelier.duree = duree;
    if (description !== undefined) atelier.description = description;
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

    await atelier.save();

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
