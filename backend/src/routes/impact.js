const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const isSuperAdmin = require('../middleware/isSuperAdmin');
const { PresenceAtelier, ReservationEspace, EquipementEspace, Incube, Atelier, sequelize } = require('../models');
const { Op } = require('sequelize');

/**
 * GET /api/impact/stats
 * Statistiques d'assiduité, d'occupation des espaces et de santé du parc matériel (Super Admin)
 */
router.get('/stats', auth, isSuperAdmin, async (req, res) => {
  try {
    const { promotion } = req.query;
    const whereIncube = {};
    if (promotion && promotion !== 'all' && promotion !== 'Toutes' && promotion.trim() !== '') {
      whereIncube.promotion = sequelize.where(
        sequelize.fn('TRIM', sequelize.col('promotion')),
        promotion.trim()
      );
    }

    const promoIncubes = await Incube.findAll({ where: whereIncube, attributes: ['id', 'nom_incube', 'pp_numero'] });
    const totalIncubes = promoIncubes.length;

    // 2. STATS ATELIERS & ASSIDUITÉ
    let presenceWhere = { present: true };
    if (promotion && promotion !== 'all' && promotion !== 'Toutes') {
      const ids = promoIncubes.map(i => String(i.id));
      const noms = promoIncubes.map(i => i.nom_incube.trim());
      const ppNumbers = promoIncubes.map(i => i.pp_numero).filter(Boolean);
      presenceWhere = {
        present: true,
        [Op.or]: [
          { incubeId: { [Op.in]: ids.length > 0 ? ids : ['-1'] } },
          { ppNumero: { [Op.in]: ppNumbers.length > 0 ? ppNumbers : ['__none__'] } },
          { nom: { [Op.in]: noms.length > 0 ? noms : ['__none__'] } }
        ]
      };
    }

    const allPresences = await PresenceAtelier.findAll({
      where: presenceWhere
    });

    const totalPresences = allPresences.length;

    // Ateliers distincts ayant eu des émargements
    const distinctAtelierIds = [...new Set(allPresences.map(p => p.atelierId))];
    const totalAteliersActifs = distinctAtelierIds.length;

    // Top incubés les plus assidus
    const incubeCounts = {};
    allPresences.forEach(p => {
      const key = p.incubeId || p.nom;
      if (!incubeCounts[key]) {
        incubeCounts[key] = {
          incubeId: p.incubeId,
          nom: p.nom,
          prenom: p.prenom,
          ppNumero: p.ppNumero,
          count: 0
        };
      }
      incubeCounts[key].count += 1;
    });

    const topIncubes = Object.values(incubeCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(i => ({
        ...i,
        nomComplet: `${i.nom} ${i.prenom && i.prenom !== '—' ? i.prenom : ''}`.trim(),
        taux: totalAteliersActifs > 0 ? Math.min(100, Math.round((i.count / totalAteliersActifs) * 100)) : 0
      }));

    const globalAssiduiteRate = totalIncubes > 0 && totalAteliersActifs > 0
      ? Math.min(100, Math.round((totalPresences / (totalIncubes * totalAteliersActifs)) * 100))
      : 0;

    // Événements (pour filtrage dynamique côté client)
    const tousLesAteliers = await Atelier.findAll({
      attributes: ['id', 'titre', 'formateur', 'date', 'description'],
      raw: true
    });

    // 3. STATS ESPACES & RÉSERVATIONS
    let resWhere = {};
    if (promotion && promotion !== 'all' && promotion !== 'Toutes') {
      const ids = promoIncubes.map(i => i.id);
      const noms = promoIncubes.map(i => i.nom_incube.trim());
      resWhere = {
        [Op.or]: [
          { incubeId: { [Op.in]: ids.length > 0 ? ids : [-1] } },
          { nomIncube: { [Op.in]: noms.length > 0 ? noms : ['__none__'] } }
        ]
      };
    }
    const allReservations = await ReservationEspace.findAll({ where: resWhere });
    const totalReservations = allReservations.length;

    const reservationsParEspace = {
      fablab: allReservations.filter(r => r.espace === 'fablab').length,
      studio: allReservations.filter(r => r.espace === 'studio').length,
      salle_reunion: allReservations.filter(r => r.espace === 'salle_reunion').length
    };

    const reservationsParStatut = {
      valide: allReservations.filter(r => r.statut === 'valide').length,
      en_attente: allReservations.filter(r => r.statut === 'en_attente').length,
      refuse: allReservations.filter(r => r.statut === 'refuse').length
    };

    const reservationsListe = allReservations.map(r => ({
      id: r.id,
      espace: r.espace,
      salle: r.salleSpecifique,
      date: r.dateReservation,
      statut: r.statut,
      heureDebut: r.heureDebut,
      heureFin: r.heureFin
    }));

    // 4. STATS PARC MATÉRIEL & MAINTENANCE
    const allEquipements = await EquipementEspace.findAll();
    const totalEquipements = allEquipements.length;

    let operationnels = 0;
    let usure = 0;
    let maintenance = 0;
    let neMarchePlus = 0;
    let totalIncidents = 0;
    let incidentsResolus = 0;

    allEquipements.forEach(eq => {
      const etat = (eq.etatAvant || 'Opérationnel / Parfait état').toLowerCase();
      if (etat.includes('ne marche plus') || etat.includes('hors service') || etat.includes('hs') || etat.includes('critique') || etat.includes('défectueux') || etat.includes('arret')) {
        neMarchePlus += 1;
      } else if (etat.includes('maintenance') || etat.includes('bloqué') || etat.includes('réparation')) {
        maintenance += 1;
      } else if (etat.includes('usure') || etat.includes('surveiller')) {
        usure += 1;
      } else {
        operationnels += 1;
      }

      const incidents = Array.isArray(eq.incidents) ? eq.incidents : [];
      totalIncidents += incidents.length;
      incidentsResolus += incidents.filter(inc => inc.resolu).length;
    });

    const incidentsEnCours = totalIncidents - incidentsResolus;
    const santeMaterielPct = totalEquipements > 0
      ? Math.round((operationnels / totalEquipements) * 100)
      : 100;

    const equipementsParEspace = {
      fablab: allEquipements.filter(e => (e.espace || '').toLowerCase() === 'fablab').length,
      studio: allEquipements.filter(e => (e.espace || '').toLowerCase() === 'studio').length,
      salle_reunion: allEquipements.filter(e => {
        const esp = (e.espace || '').toLowerCase();
        return esp === 'salle_reunion' || esp.includes('salle') || esp.includes('reunion') || esp.includes('formation');
      }).length
    };

    res.json({
      success: true,
      assiduite: {
        totalIncubes,
        totalAteliersActifs,
        totalPresences,
        globalAssiduiteRate,
        topIncubes,
        tousLesAteliers
      },
      espaces: {
        totalReservations,
        parEspace: reservationsParEspace,
        parStatut: reservationsParStatut,
        liste: reservationsListe
      },
      equipements: {
        totalEquipements,
        parEspace: equipementsParEspace,
        operationnels,
        usure,
        maintenance,
        neMarchePlus,
        santeMaterielPct,
        totalIncidents,
        incidentsResolus,
        incidentsEnCours
      }
    });
  } catch (err) {
    console.error('Erreur stats impact:', err);
    res.status(500).json({ message: 'Erreur lors du calcul des statistiques d\'impact' });
  }
});

module.exports = router;
