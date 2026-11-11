const express = require('express');
const router = express.Router();
const { RendezVous, Incube } = require('../models');
const { Op } = require('sequelize');
const emailService = require('../services/emailService');
const auth = require('../middleware/auth');
const requireStaff = require('../middleware/requireStaff');

// Tous les endpoints de rendez-vous nécessitent une authentification
router.use(auth);

// GET /api/rendezvous - Liste tous les rendez-vous avec filtrage optionnel
router.get('/', async (req, res) => {
  try {
    let { incubeId, accompagnateurId, statut } = req.query;
    const where = {};

    // Cloisonnement strict : un incubé ne peut voir que ses propres rendez-vous
    if (req.user.role === 'incube') {
      if (!req.user.pp_id) return res.json([]);
      incubeId = req.user.pp_id;
    }

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

// POST /api/rendezvous/creer - Créer un nouveau rendez-vous (Staff uniquement)
router.post('/creer', requireStaff, async (req, res) => {
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
      lieu,
      customMessage,
      customSubject,
      cc,
      envoyerEmail = true
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
      duree: duree || '1h00',
      sujet: sujet.trim(),
      commentaireEmail: commentaireEmail ? commentaireEmail.trim() : null,
      lieu: lieu || 'Bureaux Incubateur IDS — Salé',
      statut: 'programme'
    });

    // Répondre immédiatement au client pour ne pas bloquer l'UI
    res.status(201).json({ success: true, message: 'Rendez-vous créé avec succès' + (envoyerEmail ? ' et invitations transmises par email' : ''), data: rdv });

    // Envoi asynchrone des emails et mise à jour en arrière-plan hors cycle HTTP
    if (envoyerEmail) {
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
                .map(inc => emailService.sendRdvConfirmationEmail(rdv, inc, {
                  customMessage,
                  customSubject,
                  cc
                }).catch(err => {
                  console.warn(`Avertissement envoi email RDV à ${inc.email}:`, err.message);
                }))
            );
          }
        } catch (notifErr) {
          console.warn('Notification email RDV non transmise:', notifErr.message);
        }
      })();
    }
  } catch (err) {
    console.error('Erreur création rendez-vous:', err);
    res.status(500).json({ message: 'Erreur lors de la création du rendez-vous', error: err.message });
  }
});

// POST /api/rendezvous/:id/notifier - Notifier / relancer manuellement les incubés pour un RDV
router.post('/:id/notifier', requireStaff, async (req, res) => {
  try {
    const rdv = await RendezVous.findByPk(req.params.id);
    if (!rdv) {
      return res.status(404).json({ message: 'Rendez-vous introuvable' });
    }

    const { customMessage, customSubject, cc, incubeIds } = req.body;
    let targetIds = incubeIds;
    if (!targetIds || !Array.isArray(targetIds) || targetIds.length === 0) {
      try {
        targetIds = JSON.parse(rdv.incubeIds || '[]');
      } catch (e) {
        targetIds = [];
      }
    }

    const incubesConcerned = await Incube.findAll({
      where: { id: { [Op.in]: targetIds } },
      attributes: ['id', 'nom_incube', 'email']
    });

    const targetsWithEmail = incubesConcerned.filter(inc => Boolean(inc.email));
    if (targetsWithEmail.length === 0) {
      return res.status(400).json({ message: "Aucun incubé concerné ne possède d'adresse email valide" });
    }

    await Promise.allSettled(
      targetsWithEmail.map(inc => emailService.sendRdvConfirmationEmail(rdv, inc, {
        customMessage,
        customSubject,
        cc
      }))
    );

    res.json({
      success: true,
      message: `Invitation envoyée avec succès à ${targetsWithEmail.length} participant(s)`
    });
  } catch (err) {
    console.error('Erreur notification RDV:', err);
    res.status(500).json({ message: 'Erreur lors de la notification', error: err.message });
  }
});

// PUT /api/rendezvous/:id - Modifier un rendez-vous (statut, date, notes) (Staff uniquement)
router.put('/:id', requireStaff, async (req, res) => {
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

// DELETE /api/rendezvous/:id - Supprimer un rendez-vous (Staff uniquement)
router.delete('/:id', requireStaff, async (req, res) => {
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
