const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { ReservationEspace, Incube } = require('../models');
const { Op } = require('sequelize');
const emailService = require('../services/emailService');
const auth = require('../middleware/auth');
const requireStaff = require('../middleware/requireStaff');
const { getJourFerieInfo } = require('../utils/joursFeries');

/**
 * Helper : Vérifie si la requête possède un token d'authentification valide
 */
function getAuthenticatedUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  const secret1 = process.env.JWT_SECRET || 'cgs_incubateur_secret_key_super_secure_jwt_2024_ids';
  const secret2 = 'cgs_incubateur_secret_key_ids_production_platform';
  try {
    return jwt.verify(token, secret1);
  } catch {
    try {
      return jwt.verify(token, secret2);
    } catch {
      return null;
    }
  }
}

// GET /api/reservations (Toutes les réservations ou par espace/incubé)
// Authentifié (Admin / Staff / Incubé) : Retourne toutes les informations complètes
// Non-authentifié (Public) : Retourne les créneaux avec nom pour affichage du calendrier
router.get('/', async (req, res) => {
  try {
    const user = getAuthenticatedUser(req);
    const { incubeId, espace } = req.query;

    const where = {};
    if (espace && espace !== 'all') {
      where.espace = espace;
    }
    if (incubeId) {
      const idNum = Number(incubeId);
      const inc = await Incube.findByPk(idNum);
      const or = [{ incubeId: idNum }];
      if (inc?.email) or.push({ emailIncube: inc.email });
      if (inc?.nom_incube) or.push({ nomIncube: { [Op.like]: `%${inc.nom_incube}%` } });
      where[Op.or] = or;
    }

    const reservations = await ReservationEspace.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });

    if (user) {
      return res.json(reservations);
    }

    // Protection des données privées pour le public anonyme
    const publicSlots = reservations.map(r => ({
      id: r.id,
      incubeId: r.incubeId,
      espace: r.espace,
      salleSpecifique: r.salleSpecifique,
      nomIncube: r.nomIncube || 'Occupé',
      dateReservation: r.dateReservation,
      heureDebut: r.heureDebut,
      heureFin: r.heureFin,
      duree: r.duree,
      statut: r.statut
    }));

    res.json(publicSlots);
  } catch (err) {
    console.error('Erreur get reservations:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/reservations/demande (PUBLIC - Demande de réservation via QR Code ou App)
router.post('/demande', async (req, res) => {
  try {
    const nom = (req.body.nomIncube || req.body.nomComplet || '').trim();
    const email = (req.body.emailIncube || req.body.email || '').trim();
    const telephone = (req.body.telephoneIncube || req.body.telephone || '').trim();
    const motif = (req.body.motifUtilisation || req.body.motif || '').trim();
    const salleSpecifique = (req.body.salleSpecifique || req.body.salle || '').trim() || null;
    const { espace, dateReservation, heureDebut, heureFin, duree, equipementsUtilises } = req.body;
    
    if (!nom || !dateReservation || !heureDebut || !heureFin) {
      return res.status(400).json({ message: 'Champs obligatoires manquants (nom, dateReservation, heureDebut, heureFin)' });
    }

    // Validation du format de date (YYYY-MM-DD) et heures (HH:mm)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!dateRegex.test(dateReservation)) {
      return res.status(400).json({ message: 'Format de date invalide (attendu: AAAA-MM-JJ)' });
    }
    const todayStr = new Date().toISOString().split('T')[0];
    if (dateReservation < todayStr) {
      return res.status(400).json({ message: 'La date de réservation ne peut pas être dans le passé' });
    }

    // Vérification jour férié
    const ferieInfo = getJourFerieInfo(dateReservation);
    if (ferieInfo.isFerie) {
      return res.status(400).json({
        message: `Impossible de réserver le ${dateReservation} : ce jour est un jour férié officiel (${ferieInfo.nom}). L'établissement est fermé.`
      });
    }

    if (!timeRegex.test(heureDebut) || !timeRegex.test(heureFin)) {
      return res.status(400).json({ message: 'Format d\'heure invalide (attendu: HH:MM)' });
    }
    if (heureDebut >= heureFin) {
      return res.status(400).json({ message: 'L\'heure de début doit être antérieure à l\'heure de fin' });
    }

    // Vérifier les conflits de créneau horaire :
    // Si une salle spécifique est demandée, le conflit se vérifie sur cette salle
    const conflictWhere = {
      espace: espace || 'fablab',
      dateReservation,
      statut: { [Op.in]: ['valide', 'en_attente'] },
      heureDebut: { [Op.lt]: heureFin },
      heureFin: { [Op.gt]: heureDebut }
    };

    if (salleSpecifique) {
      conflictWhere[Op.or] = [
        { salleSpecifique: salleSpecifique },
        { salleSpecifique: null },
        { salleSpecifique: '' }
      ];
    }

    const conflict = await ReservationEspace.findOne({ where: conflictWhere });

    if (conflict) {
      const precisionSalle = salleSpecifique ? ` pour la ${salleSpecifique}` : '';
      return res.status(409).json({
        message: `Le créneau ${heureDebut} à ${heureFin}${precisionSalle} est déjà réservé ou en cours de validation. Veuillez choisir un autre horaire.`
      });
    }

    // Auto-lier l'incubé correspondant si présent dans la base de données
    let matchedIncubeId = req.body.incubeId ? Number(req.body.incubeId) : null;
    try {
      if (!matchedIncubeId && email) {
        const inc = await Incube.findOne({ where: { email } });
        if (inc) matchedIncubeId = inc.id;
      }
      if (!matchedIncubeId && nom) {
        const inc = await Incube.findOne({ where: { nom_incube: nom } });
        if (inc) matchedIncubeId = inc.id;
      }
    } catch (lookupErr) {}

    const reservation = await ReservationEspace.create({
      espace: espace || 'fablab',
      salleSpecifique: salleSpecifique,
      incubeId: matchedIncubeId,
      nomIncube: nom,
      emailIncube: email || null,
      telephoneIncube: telephone || null,
      dateReservation,
      heureDebut,
      heureFin,
      duree: duree || '2h',
      motifUtilisation: motif || null,
      equipementsUtilises: equipementsUtilises ? String(equipementsUtilises).trim() : null,
      statut: 'en_attente'
    });

    const displaySalle = salleSpecifique ? ` (${salleSpecifique})` : '';
    console.log(`📌 Nouvelle Demande de Réservation Espace [${(espace || 'FABLAB').toUpperCase()}${displaySalle}] pour ${nom}`);
    res.status(201).json({ success: true, message: 'Demande de réservation envoyée !', reservation });
  } catch (err) {
    console.error('Erreur création réservation:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// PUT /api/reservations/:id/valider (ADMIN - Valider ou Refuser la demande avec motif & Envoi Email)
router.put('/:id/valider', auth, requireStaff, async (req, res) => {
  try {
    const { statut, motifRefus } = req.body; // 'valide' ou 'refuse'
    if (!['valide', 'refuse', 'en_attente'].includes(statut)) {
      return res.status(400).json({ message: 'Statut invalide' });
    }

    const reservation = await ReservationEspace.findByPk(req.params.id);

    if (!reservation) {
      return res.status(404).json({ message: 'Réservation non trouvée' });
    }

    // Vérification anti-conflit lors de la validation
    if (statut === 'valide') {
      const { Op } = require('sequelize');
      const whereCondition = {
        id: { [Op.ne]: reservation.id },
        statut: 'valide',
        dateReservation: reservation.dateReservation,
        espace: reservation.espace,
        [Op.and]: [
          { heureDebut: { [Op.lt]: reservation.heureFin } },
          { heureFin: { [Op.gt]: reservation.heureDebut } }
        ]
      };

      if (reservation.salleSpecifique) {
        whereCondition[Op.or] = [
          { salleSpecifique: reservation.salleSpecifique },
          { salleSpecifique: null },
          { salleSpecifique: '' }
        ];
      }

      const conflict = await ReservationEspace.findOne({
        where: whereCondition
      });

      if (conflict) {
        return res.status(409).json({
          message: `Conflit horaire : le créneau ${reservation.heureDebut}-${reservation.heureFin} le ${new Date(reservation.dateReservation).toLocaleDateString('fr-FR')} est déjà validé pour "${conflict.nomIncube}" (${conflict.salleSpecifique || conflict.espace}) !`
        });
      }
    }

    reservation.statut = statut;
    if (statut === 'refuse') {
      reservation.motifRefus = motifRefus || 'Motif non précisé par l\'administration';
    }
    await reservation.save();

    // NOUVEAU: Générer la checklist matériel si la réservation est validée
    if (statut === 'valide') {
      const { EquipementEspace, ChecklistMateriel } = require('../models');
      const equipWhere = { espace: reservation.espace };
      if (reservation.salleSpecifique) {
        equipWhere.salle = reservation.salleSpecifique;
      }
      
      const equipements = await EquipementEspace.findAll({ where: equipWhere });
      if (equipements.length > 0) {
        // Supprime d'abord les anciennes checklists éventuelles pour cette réservation
        await ChecklistMateriel.destroy({ where: { reservation_id: reservation.id } });
        
        const checklists = equipements.map(e => ({
          reservation_id: reservation.id,
          equipement_id: e.id,
          etat_avant: e.etatAvant || 'Opérationnel / Parfait état',
          etat_apres: e.etatApres || 'Conforme & Rendu propre'
        }));
        await ChecklistMateriel.bulkCreate(checklists);
      }
    }

    // Envoi d'Email automatique (HTML moderne) à l'incubé
    const notifyEmail = req.body.notifyEmail !== false;
    let emailResult = { sent: false };

    if (notifyEmail) {
      emailResult = await emailService.sendReservationStatusEmail(
        reservation,
        statut,
        reservation.motifRefus
      );
    }

    res.json({ 
      success: true, 
      message: `Réservation ${statut === 'valide' ? 'validée' : 'refusée'} ${notifyEmail ? 'et email transmis avec succès !' : ''}`, 
      reservation, 
      emailNotification: { 
        sent: !!emailResult.success, 
        simulated: emailResult.simulated,
        recipient: reservation.emailIncube || reservation.email 
      } 
    });
  } catch (err) {
    console.error('Erreur validation réservation:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// PUT /api/reservations/:id/etat (ADMIN - Mise à jour Fiche État Avant / Après utilisation)
router.put('/:id/etat', auth, requireStaff, async (req, res) => {
  try {
    const { etatAvant, etatApres } = req.body;
    const reservation = await ReservationEspace.findByPk(req.params.id);

    if (!reservation) {
      return res.status(404).json({ message: 'Réservation non trouvée' });
    }

    if (etatAvant !== undefined) reservation.etatAvant = etatAvant;
    if (etatApres !== undefined) reservation.etatApres = etatApres;
    await reservation.save();

    res.json({ success: true, message: 'États matériel et espace enregistrés !', reservation });
  } catch (err) {
    console.error('Erreur état reservation:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/reservations/:id/rappel (ADMIN - Envoi manuel d'un email de rappel avec consignes)
router.post('/:id/rappel', auth, requireStaff, async (req, res) => {
  try {
    const reservation = await ReservationEspace.findByPk(req.params.id);
    if (!reservation) {
      return res.status(404).json({ message: 'Réservation non trouvée' });
    }

    if (reservation.statut !== 'valide') {
      return res.status(400).json({ message: 'Seules les réservations validées peuvent recevoir un rappel.' });
    }

    const emailResult = await emailService.sendReservationReminderEmail(reservation);

    res.json({
      success: true,
      message: `Email de rappel transmis avec succès à ${reservation.nomIncube} !`,
      emailNotification: {
        sent: !!emailResult.success,
        simulated: emailResult.simulated,
        recipient: reservation.emailIncube || reservation.email
      }
    });
  } catch (err) {
    console.error('Erreur envoi rappel réservation:', err.message);
    res.status(500).json({ message: 'Erreur lors de l\'envoi du rappel' });
  }
});

// POST /api/reservations/directe (ADMIN / STAFF - Réservation directe immédiate validée)
router.post('/directe', auth, requireStaff, async (req, res) => {
  try {
    const { 
      espace, 
      salleSpecifique, 
      dateReservation, 
      heureDebut, 
      heureFin, 
      duree, 
      motifUtilisation, 
      equipementsUtilises,
      nomPersonnalise
    } = req.body;

    if (!dateReservation || !heureDebut || !heureFin) {
      return res.status(400).json({ message: 'Champs obligatoires manquants (dateReservation, heureDebut, heureFin)' });
    }

    if (heureDebut >= heureFin) {
      return res.status(400).json({ message: 'L\'heure de début doit être antérieure à l\'heure de fin' });
    }

    // Vérifier les conflits de créneau horaire
    const conflictWhere = {
      espace: espace || 'fablab',
      dateReservation,
      statut: 'valide',
      heureDebut: { [Op.lt]: heureFin },
      heureFin: { [Op.gt]: heureDebut }
    };

    if (salleSpecifique) {
      conflictWhere[Op.or] = [
        { salleSpecifique: salleSpecifique },
        { salleSpecifique: null },
        { salleSpecifique: '' }
      ];
    }

    const conflict = await ReservationEspace.findOne({ where: conflictWhere });

    if (conflict) {
      const precisionSalle = salleSpecifique ? ` pour la ${salleSpecifique}` : '';
      return res.status(409).json({
        message: `Conflit horaire : le créneau ${heureDebut}-${heureFin}${precisionSalle} est déjà réservé par "${conflict.nomIncube}".`
      });
    }

    const staffNom = req.user ? `${req.user.prenom || ''} ${req.user.nom || ''}`.trim() : 'Administration';
    const nomAffiche = nomPersonnalise && nomPersonnalise.trim() 
      ? nomPersonnalise.trim() 
      : `${staffNom} (Administration)`;

    let directIncubeId = req.body.incubeId ? Number(req.body.incubeId) : null;
    try {
      if (!directIncubeId && req.user?.email) {
        const inc = await Incube.findOne({ where: { email: req.user.email } });
        if (inc) directIncubeId = inc.id;
      }
      if (!directIncubeId && nomPersonnalise) {
        const inc = await Incube.findOne({ where: { nom_incube: nomPersonnalise.trim() } });
        if (inc) directIncubeId = inc.id;
      }
    } catch (lookupErr) {}

    const reservation = await ReservationEspace.create({
      espace: espace || 'fablab',
      salleSpecifique: salleSpecifique || null,
      incubeId: directIncubeId,
      nomIncube: nomAffiche,
      emailIncube: req.user?.email || 'admin@cgs.dz',
      telephoneIncube: req.user?.telephone || null,
      dateReservation,
      heureDebut,
      heureFin,
      duree: duree || '2h',
      motifUtilisation: motifUtilisation || 'Réservation administrative / Équipe IDS',
      equipementsUtilises: equipementsUtilises ? String(equipementsUtilises).trim() : 'Tous les équipements',
      statut: 'valide'
    });

    // Générer la checklist matériel automatiquement
    try {
      const { EquipementEspace, ChecklistMateriel } = require('../models');
      const equipWhere = { espace: reservation.espace };
      if (reservation.salleSpecifique) {
        equipWhere.salle = reservation.salleSpecifique;
      }
      const equipements = await EquipementEspace.findAll({ where: equipWhere });
      if (equipements.length > 0) {
        const checklists = equipements.map(e => ({
          reservation_id: reservation.id,
          equipement_id: e.id,
          etat_avant: e.etatAvant || 'Opérationnel / Parfait état',
          etat_apres: e.etatApres || 'Conforme & Rendu propre'
        }));
        await ChecklistMateriel.bulkCreate(checklists);
      }
    } catch (checklistErr) {
      console.warn('Checklist non générée:', checklistErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Réservation administrative créée et validée avec succès !',
      reservation
    });
  } catch (err) {
    console.error('Erreur réservation directe:', err.message);
    res.status(500).json({ message: 'Erreur lors de la création de la réservation' });
  }
});

module.exports = router;

