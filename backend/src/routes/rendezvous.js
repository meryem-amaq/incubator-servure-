const express = require('express');
const router = express.Router();
const { RendezVous, Incube } = require('../models');
const { Op } = require('sequelize');
const emailService = require('../services/emailService');
const auth = require('../middleware/auth');

// Tous les endpoints de rendez-vous nécessitent une authentification
router.use(auth);

// GET /api/rendezvous - Liste tous les rendez-vous avec filtrage optionnel
router.get('/', async (req, res) => {
  try {
    const { incubeId, accompagnateurId, statut } = req.query;
    const where = {};

    if (statut) {
      where.statut = statut;
    }

    if (accompagnateurId) {
      where.accompagnateurId = accompagnateurId;
    }

    let list = await RendezVous.findAll({
      where,
      order: [['dateRdv', 'ASC'], ['heureRdv', 'ASC']]
    });

    if (incubeId) {
      // Filtrer les RDV contenant cet incubé
      list = list.filter(r => {
        try {
          const ids = Array.isArray(r.incubeIds) ? r.incubeIds : JSON.parse(r.incubeIds);
          return ids.includes(Number(incubeId)) || ids.includes(String(incubeId));
        } catch {
          return String(r.incubeIds).includes(String(incubeId));
        }
      });
    }

    res.json(list);
  } catch (err) {
    console.error('Erreur récupération rendez-vous:', err);
    res.status(500).json({ message: 'Erreur lors du chargement des rendez-vous', error: err.message });
  }
});

// POST /api/rendezvous/creer - Créer un nouveau rendez-vous
router.post('/creer', async (req, res) => {
  try {
    const {
      accompagnateurId,
      accompagnateurNom,
      incubeIds,
      incubeNoms,
      dateRdv,
      heureRdv,
      duree,
      sujet,
      commentaireEmail,
      lieu
    } = req.body;

    if (!sujet || !dateRdv || !heureRdv) {
      return res.status(400).json({ message: 'Date, heure et sujet sont obligatoires' });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!dateRegex.test(dateRdv)) {
      return res.status(400).json({ message: 'Format de date invalide (attendu: AAAA-MM-JJ)' });
    }
    if (!timeRegex.test(heureRdv)) {
      return res.status(400).json({ message: 'Format d\'heure invalide (attendu: HH:MM)' });
    }

    const incIdsStr = typeof incubeIds === 'object' ? JSON.stringify(incubeIds) : String(incubeIds || '[]');

    const rdv = await RendezVous.create({
      accompagnateurId: accompagnateurId || null,
      accompagnateurNom: accompagnateurNom || 'Accompagnateur IDS',
      incubeIds: incIdsStr,
      incubeNoms: incubeNoms || '',
      dateRdv,
      heureRdv,
      duree: duree || '1h',
      sujet: sujet.trim(),
      commentaireEmail: commentaireEmail ? commentaireEmail.trim() : null,
      lieu: lieu || 'Bureaux Incubateur IDS / Fablab',
      statut: 'programme'
    });

    // Répondre immédiatement au client pour ne pas bloquer l'UI
    res.status(201).json({ success: true, message: 'Rendez-vous créé avec succès et invitations transmises par email', data: rdv });

    // Envoi asynchrone des emails et mise à jour en arrière-plan hors cycle HTTP
    (async () => {
      try {
        const parsedIds = typeof incubeIds === 'object' && Array.isArray(incubeIds) ? incubeIds : JSON.parse(incIdsStr);
        if (Array.isArray(parsedIds) && parsedIds.length > 0) {
          await Incube.update(
            { last_rdv_date: dateRdv },
            { where: { id: { [Op.in]: parsedIds } } }
          ).catch(() => {});

          const incubesConcerned = await Incube.findAll({
            where: { id: { [Op.in]: parsedIds } },
            attributes: ['id', 'nom_incube', 'email']
          });

          await Promise.allSettled(
            incubesConcerned
              .filter(inc => Boolean(inc.email))
              .map(inc => emailService.sendRdvConfirmationEmail(rdv, inc).catch(err => {
                console.warn(`Avertissement envoi email RDV à ${inc.email}:`, err.message);
              }))
          );
        }
      } catch (notifErr) {
        console.warn('Notification email RDV non transmise:', notifErr.message);
      }
    })();
  } catch (err) {
    console.error('Erreur création rendez-vous:', err);
    res.status(500).json({ message: 'Erreur lors de la création du rendez-vous', error: err.message });
  }
});

// PUT /api/rendezvous/:id - Modifier un rendez-vous (statut, date, notes)
router.put('/:id', async (req, res) => {
  try {
    const rdv = await RendezVous.findByPk(req.params.id);
    if (!rdv) {
      return res.status(404).json({ message: 'Rendez-vous introuvable' });
    }

    await rdv.update(req.body, {
      fields: ['dateRdv', 'heureRdv', 'duree', 'sujet', 'statut', 'commentaireEmail', 'lieu']
    });
    res.json({ success: true, message: 'Rendez-vous mis à jour', data: rdv });
  } catch (err) {
    console.error('Erreur mise à jour rendez-vous:', err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// DELETE /api/rendezvous/:id - Supprimer un rendez-vous
router.delete('/:id', async (req, res) => {
  try {
    const rdv = await RendezVous.findByPk(req.params.id);
    if (!rdv) {
      return res.status(404).json({ message: 'Rendez-vous introuvable' });
    }

    await rdv.destroy();
    res.json({ success: true, message: 'Rendez-vous supprimé' });
  } catch (err) {
    console.error('Erreur suppression rendez-vous:', err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

module.exports = router;
