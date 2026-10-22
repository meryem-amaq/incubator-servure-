const { Incube, User, GestionMateriel, SuiviEngagement, RhEmploi, RhDetail, PlanAction, AnalyseFinanciere, RendezVous, HistoriquePhase, HistoriqueStatut, FicheSuivi, Formation, sequelize } = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const emailService = require('../services/emailService');
const tourniquetService = require('../services/tourniquetService');

// Fonction utilitaire pour synchroniser la liste blanche avec le Cloud
const syncWhitelistCloud = async () => {
  if (process.env.ACTIVER_SYNC_CLOUD !== 'true') return;

  try {
    // 1. Récupérer tous les incubés avec un email valide
    const incubes = await Incube.findAll({ attributes: ['email', 'pp_numero'] });
    const listIncubes = incubes
      .filter(i => i.email && i.email.trim() !== '')
      .map(i => ({ 
        email: i.email.trim().toLowerCase(), 
        pp_numero: i.pp_numero || 'INCUBE' 
      }));

    // 2. Récupérer les accompagnateurs, administrateurs et super_admins
    const staffUsers = await User.findAll({
      where: {
        role: { [Op.in]: ['super_admin', 'administrateur', 'accompagnateur'] }
      },
      attributes: ['email', 'role']
    });
    const listStaff = staffUsers
      .filter(u => u.email && u.email.trim() !== '')
      .map(u => ({ 
        email: u.email.trim().toLowerCase(), 
        pp_numero: (u.role || 'STAFF').toUpperCase() 
      }));

    // 3. Fusionner les deux listes sans doublons
    const emailMap = new Map();
    [...listIncubes, ...listStaff].forEach(p => {
      if (!emailMap.has(p.email)) {
        emailMap.set(p.email, p);
      }
    });
    const porteurs = Array.from(emailMap.values());

    console.log(`📡 [Whitelist] Envoi de ${porteurs.length} comptes autorisés vers Heroku (${listIncubes.length} incubés + ${listStaff.length} staff)...`);

    // 4. Envoi vers Heroku
    const cloudUrl = (process.env.CLOUD_URL || process.env.CLOUD_API_URL || 'https://ids-production-app-6aba82b6af10.herokuapp.com').replace(/\/+$/, '');
    const response = await fetch(`${cloudUrl}/api/sync/whitelist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: process.env.WHITELIST_SECRET || process.env.SYNC_SECRET || 'MON_SECRET_DE_SYNC_123',
        porteurs
      })
    });

    if (response.ok) {
      console.log(`✅ Synchronisation de la liste blanche réussie (${porteurs.length} personnes autorisées sur Heroku).`);
    } else {
      console.error('⚠️ Échec de la synchronisation avec le Cloud :', await response.text());
    }
  } catch (err) {
    console.error('⚠️ Impossible de joindre le Cloud pour la synchronisation de la liste blanche.', err.message);
  }
};

// Export pour pouvoir l'appeler au démarrage ou depuis d'autres controllers
exports.syncWhitelistCloud = syncWhitelistCloud;

// GET /api/incubes — Liste avec filtrage multi-tenant
exports.getAll = async (req, res) => {
  try {
    const { search, promotion, secteur_activite } = req.query;

    const conditions = [];

    // Un incubé ne voit que son propre dossier
    if (req.user.role === 'incube') {
      if (!req.user.pp_id) return res.json([]);
      conditions.push({ id: req.user.pp_id });
    }

    if (promotion && promotion.trim() && promotion !== 'all') {
      conditions.push({ promotion: promotion.trim() });
    }

    if (secteur_activite && secteur_activite.trim() && secteur_activite !== 'all') {
      conditions.push({ secteur_activite: secteur_activite.trim() });
    }

    if (search && search.trim()) {
      conditions.push({
        [Op.or]: [
          { nom_incube: { [Op.like]: `%${search}%` } },
          { raison_sociale: { [Op.like]: `%${search}%` } },
          { pp_numero: { [Op.like]: `%${search}%` } },
          { accompagnateur: { [Op.like]: `%${search}%` } },
          { promotion: { [Op.like]: `%${search}%` } },
          { secteur_activite: { [Op.like]: `%${search}%` } },
        ],
      });
    }

    const where = conditions.length > 0 ? { [Op.and]: conditions } : {};

    const incubes = await Incube.findAll({
      where,
      include: [
        {
          model: User,
          as: 'accompagnateurAdmin',
          attributes: ['id', 'nom', 'prenom', 'email'],
        },
        {
          model: User,
          as: 'compteUtilisateur',
          attributes: ['id', 'email', 'actif', 'role', 'photo_url'],
        },
        {
          model: PlanAction,
          as: 'plans',
          attributes: ['id', 'incube_id', 'realisation', 'objectifs', 'echeance', 'mois', 'created_at', 'updated_at'],
          separate: true,
        },
      ],
      order: [['created_at', 'DESC']],
    });

    res.json(incubes);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors du chargement des incubés', error: err.message });
  }
};

// GET /api/incubes/stats — Statistiques consolidées pour le Dashboard (Réservé au Super Admin)
exports.getStats = async (req, res) => {
  try {
    const isSuper = ['super_admin', 'admin', 'administrateur', 'superadmin'].includes(req.user.role);
    if (!isSuper) {
      return res.status(403).json({ message: 'Accès interdit : Les KPIs consolidés sont réservés au Super Administrateur' });
    }
    const whereIncube = {};

    const { promotion } = req.query;
    if (promotion && promotion !== 'all' && promotion !== 'Toutes' && promotion.trim() !== '') {
      whereIncube.promotion = sequelize.where(
        sequelize.fn('TRIM', sequelize.col('promotion')),
        promotion.trim()
      );
    }

    // Phase 1 : Requêtes de base sur les incubés en parallèle
    const [
      total,
      phases,
      myIncubes,
      recentIncubes,
      genreStats,
      regionStats,
      domaineStats,
      statutStats,
      rawEtudeStats,
      incubesParAccompagnateur
    ] = await Promise.all([
      Incube.count({ where: whereIncube }),
      Incube.findAll({
        where: whereIncube,
        attributes: ['phase_projet', [sequelize.fn('COUNT', 'id'), 'count']],
        group: ['phase_projet'],
        raw: true,
      }),
      (!isSuper || (promotion && promotion !== 'all' && promotion !== 'Toutes'))
        ? Incube.findAll({ where: whereIncube, attributes: ['id'] })
        : Promise.resolve([]),
      Incube.findAll({
        where: whereIncube,
        include: [{
          model: User,
          as: 'accompagnateurAdmin',
          attributes: ['id', 'nom', 'prenom', 'email'],
        }],
        order: [['created_at', 'DESC']],
        limit: 5,
      }),
      Incube.findAll({
        where: whereIncube,
        attributes: ['genre', [sequelize.fn('COUNT', 'id'), 'count']],
        group: ['genre'],
        raw: true,
      }),
      Incube.findAll({
        where: whereIncube,
        attributes: ['province', [sequelize.fn('COUNT', 'id'), 'count']],
        group: ['province'],
        raw: true,
      }),
      Incube.findAll({
        where: whereIncube,
        attributes: ['secteur_activite', [sequelize.fn('COUNT', 'id'), 'count']],
        group: ['secteur_activite'],
        raw: true,
      }),
      Incube.findAll({
        where: whereIncube,
        attributes: ['statut_juridique', [sequelize.fn('COUNT', 'id'), 'count']],
        group: ['statut_juridique'],
        raw: true,
      }),
      Incube.findAll({
        where: whereIncube,
        attributes: ['niveau_etude', [sequelize.fn('COUNT', 'id'), 'count']],
        group: ['niveau_etude'],
        raw: true,
      }),
      Incube.findAll({
        where: whereIncube,
        attributes: ['accompagnateur', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
        group: ['accompagnateur'],
        raw: true
      })
    ]);

    let incubeIds = myIncubes.map(i => i.id);
    const whereRelations = (!isSuper || (promotion && promotion !== 'all' && promotion !== 'Toutes'))
      ? { incube_id: { [Op.in]: incubeIds.length > 0 ? incubeIds : [-1] } }
      : {};

    // Traitement du niveau d'étude
    const etudeMap = {};
    rawEtudeStats.forEach(item => {
      let lvl = (item.niveau_etude || '').trim();
      if (!lvl || lvl.toLowerCase() === 'null') {
        lvl = 'Non spécifié';
      } else if (lvl.toLowerCase().includes('doct') || lvl.toLowerCase().includes('master') || lvl.toLowerCase().includes('bac+5') || lvl.toLowerCase().includes('bac +5') || lvl.toLowerCase().includes('ingénieur')) {
        lvl = 'Bac+5 et plus (Master, Ingénieur, Doctorat)';
      } else if (lvl.toLowerCase().includes('licence') || lvl.toLowerCase().includes('bac+3') || lvl.toLowerCase().includes('bac +3') || lvl.toLowerCase().includes('bac+4') || lvl.toLowerCase().includes('bac +4')) {
        lvl = 'Bac+3 (Licence)';
      } else if (lvl.toLowerCase().startsWith('ts') || lvl.toLowerCase().includes('technicien') || lvl.toLowerCase().includes('bac+2') || lvl.toLowerCase().includes('bac +2') || lvl.toLowerCase().includes('bts') || lvl.toLowerCase().includes('dut')) {
        lvl = 'Bac+2 (DEUG, BTS, DUT, TS)';
      } else if (lvl.toLowerCase() === 'bac' || lvl.toLowerCase() === 'baccalauréat' || lvl.toLowerCase().includes('bac+1') || lvl.toLowerCase().includes('bac +1')) {
        lvl = 'Bac (Baccalauréat)';
      } else if (lvl.toLowerCase().includes('niveau bac')) {
        lvl = 'Niveau Bac (Secondaire)';
      } else {
        etudeMap[lvl] = (etudeMap[lvl] || 0) + Number(item.count);
        return;
      }
      etudeMap[lvl] = (etudeMap[lvl] || 0) + Number(item.count);
    });

    const orderHierarchy = [
      'Bac+5 et plus (Master, Ingénieur, Doctorat)',
      'Bac+3 (Licence)',
      'Bac+2 (DEUG, BTS, DUT, TS)',
      'Bac (Baccalauréat)',
      'Niveau Bac (Secondaire)',
      'Non spécifié'
    ];
    const etudeStats = Object.keys(etudeMap)
      .sort((a, b) => {
        const idxA = orderHierarchy.indexOf(a);
        const idxB = orderHierarchy.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
      })
      .map(lvl => ({
        niveau_etude: lvl,
        count: etudeMap[lvl]
      }));

    // Clause SQL pour les requêtes brutes
    let whereSql = '';
    const replacements = {};
    if (promotion && promotion !== 'all' && promotion !== 'Toutes' && promotion.trim() !== '') {
      whereSql += ' WHERE TRIM(i.promotion) = :promo';
      replacements.promo = promotion.trim();
    }
    if (!isSuper) {
      whereSql += (whereSql ? ' AND' : ' WHERE') + ' i.admin_id = :adminId';
      replacements.adminId = req.user.id;
    }

    // Phase 2 : Requêtes relationnelles lourdes exécutées en parallèle
    const [
      totalPersonnel,
      emploisStats,
      top4Emplois,
      finances,
      caParStatut,
      top3CA,
      planActionStats,
      planActionList,
      allRdvsRaw,
      analyseMois,
      [yearsRows],
      [promoRows],
      rhMoisStats,
      analyseIncubesMois
    ] = await Promise.all([
      RhDetail.count({ where: whereRelations }),
      RhDetail.findAll({
        where: whereRelations,
        attributes: ['nature_contrat', [sequelize.fn('COUNT', 'id'), 'count']],
        group: ['nature_contrat'],
        raw: true,
      }),
      RhDetail.findAll({
        where: whereRelations,
        attributes: [
          [sequelize.col('incube.nom_incube'), 'nom'],
          [sequelize.col('incube.raison_sociale'), 'projet'],
          [sequelize.fn('COUNT', sequelize.col('RhDetail.id')), 'total_postes'],
          [sequelize.fn('SUM', sequelize.literal('COALESCE(salaire_mensuel, 0)')), 'total_salaires']
        ],
        include: [{ model: Incube, as: 'incube', attributes: [] }],
        group: ['incube.id', 'incube.nom_incube', 'incube.raison_sociale'],
        order: [[sequelize.literal('total_postes'), 'DESC'], [sequelize.literal('total_salaires'), 'DESC']],
        limit: 4,
        raw: true,
      }),
      AnalyseFinanciere.findAll({
        where: whereRelations,
        attributes: ['ventes', 'autres_revenus'],
        raw: true,
      }),
      AnalyseFinanciere.findAll({
        where: whereRelations,
        attributes: [
          [sequelize.col('incube.statut_juridique'), 'statut'],
          [sequelize.fn('SUM', sequelize.literal('COALESCE(ventes, 0) + COALESCE(autres_revenus, 0)')), 'total_ca']
        ],
        include: [{ model: Incube, as: 'incube', attributes: [] }],
        group: ['incube.statut_juridique'],
        raw: true,
      }),
      AnalyseFinanciere.findAll({
        where: whereRelations,
        attributes: [
          [sequelize.col('incube.nom_incube'), 'nom'],
          [sequelize.col('incube.raison_sociale'), 'projet'],
          [sequelize.fn('SUM', sequelize.literal('COALESCE(ventes, 0) + COALESCE(autres_revenus, 0)')), 'total_ca']
        ],
        include: [{ model: Incube, as: 'incube', attributes: [] }],
        group: ['incube.id', 'incube.nom_incube', 'incube.raison_sociale'],
        order: [[sequelize.literal('total_ca'), 'DESC']],
        limit: 3,
        raw: true,
      }),
      PlanAction.findAll({
        where: whereRelations,
        attributes: [
          [sequelize.col('incube.accompagnateur'), 'accompagnateur'],
          [sequelize.fn('COUNT', sequelize.col('PlanAction.id')), 'total_plans'],
          [sequelize.fn('SUM', sequelize.literal("CASE WHEN realisation = 'Validé' OR realisation = 'Effectué' OR realisation = 'Atteint' THEN 1 ELSE 0 END")), 'valide_plans']
        ],
        include: [{ model: Incube, as: 'incube', attributes: [] }],
        group: ['incube.accompagnateur'],
        raw: true,
      }),
      PlanAction.findAll({
        where: whereRelations,
        include: [{ model: Incube, as: 'incube', attributes: ['id', 'nom_incube', 'raison_sociale', 'accompagnateur'] }],
        raw: true,
        nest: true
      }),
      FicheSuivi.findAll({
        where: whereRelations,
        include: [{ model: Incube, as: 'incube', attributes: ['id', 'nom_incube', 'raison_sociale', 'accompagnateur', 'promotion'] }],
        raw: true,
        nest: true
      }),
      sequelize.query(`
        SELECT 
          COALESCE(af.annee, 2026) AS annee,
          af.mois,
          COALESCE(i.statut_juridique, 'Non spécifié') AS statut_juridique,
          SUM(COALESCE(af.ventes, 0) + COALESCE(af.autres_revenus, 0)) AS total_gains,
          SUM(COALESCE(af.achats, 0) + COALESCE(af.charges_personnel, 0) + COALESCE(af.charges_cnss, 0) + COALESCE(af.salaire_porteur, 0) + COALESCE(af.loyer_coworking, 0) + COALESCE(af.eau_electricite, 0) + COALESCE(af.transport, 0) + COALESCE(af.telephone, 0) + COALESCE(af.taxes, 0) + COALESCE(af.tva, 0) + COALESCE(af.remboursement_credit, 0) + COALESCE(af.autres_charges, 0)) AS total_pertes
        FROM analyse_financiere af
        INNER JOIN incubes i ON af.incube_id = i.id
        ${whereSql}
        GROUP BY COALESCE(af.annee, 2026), af.mois, COALESCE(i.statut_juridique, 'Non spécifié')
        ORDER BY annee DESC, af.mois ASC
      `, { replacements, type: sequelize.QueryTypes.SELECT }),
      sequelize.query(`
        SELECT DISTINCT YEAR(date_demarrage) as y FROM incubes WHERE date_demarrage IS NOT NULL
        UNION
        SELECT DISTINCT YEAR(created_at) as y FROM incubes
        UNION
        SELECT DISTINCT annee as y FROM analyse_financiere WHERE annee IS NOT NULL
      `),
      sequelize.query(`
        SELECT DISTINCT TRIM(nom) as promotion FROM promotions WHERE nom IS NOT NULL AND TRIM(nom) != ''
        UNION
        SELECT DISTINCT TRIM(promotion) as promotion FROM incubes WHERE promotion IS NOT NULL AND TRIM(promotion) != ''
      `),
      sequelize.query(`
        SELECT 
          COALESCE(rd.mois, 'Non spécifié') AS mois,
          i.nom_incube,
          COUNT(rd.id) AS total_employes,
          SUM(COALESCE(rd.salaire_mensuel, 0)) AS total_salaires
        FROM rh_detail rd
        INNER JOIN incubes i ON rd.incube_id = i.id
        ${whereSql}
        GROUP BY rd.mois, i.nom_incube
        ORDER BY rd.mois DESC, total_employes DESC
      `, { replacements, type: sequelize.QueryTypes.SELECT }),
      sequelize.query(`
        SELECT 
          COALESCE(af.annee, 2026) AS annee,
          af.mois,
          i.id AS incube_id,
          i.nom_incube AS nom,
          i.raison_sociale AS projet,
          COALESCE(i.statut_juridique, 'Non spécifié') AS statut_juridique,
          SUM(COALESCE(af.ventes, 0) + COALESCE(af.autres_revenus, 0)) AS total_ca
        FROM analyse_financiere af
        INNER JOIN incubes i ON af.incube_id = i.id
        ${whereSql}
        GROUP BY COALESCE(af.annee, 2026), af.mois, i.id, i.nom_incube, i.raison_sociale, COALESCE(i.statut_juridique, 'Non spécifié')
        ORDER BY annee DESC, af.mois ASC
      `, { replacements, type: sequelize.QueryTypes.SELECT })
    ]);

    const caTotal = finances.reduce((sum, f) => sum + (Number(f.ventes) || 0) + (Number(f.autres_revenus) || 0), 0);

    // 1 ligne dans FicheSuivi = 1 RDV Réalisé prouvé par l'accompagnateur
    const allFichesSuivi = allRdvsRaw || [];
    const rdvCounts = {};
    allFichesSuivi.forEach(f => {
      const nom = (f.incube?.accompagnateur || '').trim() || 'Non spécifié';
      rdvCounts[nom] = (rdvCounts[nom] || 0) + 1;
    });

    const rdvParAccompagnateur = Object.keys(rdvCounts).map(nom => ({
      accompagnateurNom: nom,
      count: rdvCounts[nom]
    }));

    // Statuts et années disponibles
    const distinctStatuts = Array.from(new Set(analyseMois.map(m => m.statut_juridique).filter(Boolean)));
    const allYears = yearsRows.map(r => Number(r.y)).filter(y => y && !Number.isNaN(y) && y >= 2020);
    const currentYear = new Date().getFullYear();
    for (let yr = currentYear; yr >= currentYear - 4; yr--) {
      if (!allYears.includes(yr)) allYears.push(yr);
    }
    const distinctAnnees = Array.from(new Set(allYears)).sort((a, b) => b - a);
    const distinctPromos = Array.from(new Set(promoRows.map(r => r.promotion).filter(Boolean))).sort();

    res.json({
      total,
      phases,
      totalEmplois: totalPersonnel,
      caTotal,
      promotionsDisponibles: distinctPromos,
      recentIncubes,
      genreStats,
      regionStats,
      domaineStats,
      statutStats,
      etudeStats,
      caParStatut,
      top3CA,
      top4Emplois,
      emploisStats,
      planActionStats,
      planActionList,
      suiviStats: {
        incubes: incubesParAccompagnateur,
        rdvs: rdvParAccompagnateur,
        fichesSuiviList: allFichesSuivi
      },
      analyseMois,
      analyseIncubesMois,
      rhMoisStats,
      anneesDisponibles: distinctAnnees,
      statutsDisponibles: distinctStatuts
    });
  } catch (err) {
    console.error('Erreur getStats:', err);
    res.status(500).json({ message: 'Erreur lors du calcul des statistiques', error: err.message });
  }
};

// GET /api/incubes/mon-profil — Espace réservé à l'incubé connecté (PP)
exports.getMonProfil = async (req, res) => {
  try {
    // Identifiant sécurisé garanti par le middleware authorizeIncube
    const ppId = req.incubeId || (req.user && req.user.pp_id);

    if (!ppId) {
      return res.status(403).json({ message: 'Aucun dossier porteur de projet associé à votre compte' });
    }

    const profil = await Incube.findByPk(ppId, {
      include: [
        {
          model: User,
          as: 'accompagnateurAdmin',
          attributes: ['id', 'nom', 'prenom', 'email', 'telephone'],
        },
        {
          model: User,
          as: 'compteUtilisateur',
          attributes: ['id', 'nom', 'prenom', 'email', 'telephone', 'photo_url', 'role'],
        },
        { model: GestionMateriel, as: 'materiels', separate: true },
        { model: SuiviEngagement, as: 'engagements', separate: true, order: [['annee', 'DESC'], ['mois', 'DESC']] },
        { model: RhEmploi, as: 'emplois', separate: true },
        { model: RhDetail, as: 'personnel', separate: true },
        { model: PlanAction, as: 'plans', separate: true },
        { model: AnalyseFinanciere, as: 'finances', separate: true, order: [['annee', 'DESC'], ['mois', 'ASC']] },
        { model: HistoriquePhase, as: 'historique_phases', separate: true, order: [['created_at', 'DESC']] },
        { model: HistoriqueStatut, as: 'historique_statuts', separate: true, order: [['created_at', 'DESC']] },
        { model: FicheSuivi, as: 'fiches_suivi', separate: true, order: [['date_suivi', 'DESC']] },
        { model: Formation, as: 'formations', separate: true, order: [['date_formation', 'DESC']] },
      ],
    });

    if (!profil) {
      return res.status(404).json({ message: 'Dossier porteur de projet introuvable' });
    }

    res.json(profil);
  } catch (err) {
    console.error('❌ Erreur getMonProfil:', err);
    res.status(500).json({ message: 'Erreur lors de la récupération de votre profil', error: err.message });
  }
};

// GET /api/incubes/:id — Profil complet avec toutes les relations
exports.getOne = async (req, res) => {
  try {
    const incube = await Incube.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'accompagnateurAdmin',
          attributes: ['id', 'nom', 'prenom', 'email'],
        },
        {
          model: User,
          as: 'compteUtilisateur',
          attributes: ['id', 'nom', 'prenom', 'email', 'telephone', 'photo_url', 'role', 'actif'],
        },
        { model: GestionMateriel, as: 'materiels', separate: true },
        { model: SuiviEngagement, as: 'engagements', separate: true, order: [['annee', 'DESC'], ['mois', 'DESC']] },
        { model: RhEmploi, as: 'emplois', separate: true },
        { model: RhDetail, as: 'personnel', separate: true },
        { model: PlanAction, as: 'plans', separate: true },
        { model: AnalyseFinanciere, as: 'finances', separate: true, order: [['annee', 'DESC'], ['mois', 'ASC']] },
        { model: HistoriquePhase, as: 'historique_phases', separate: true, order: [['created_at', 'DESC']] },
        { model: HistoriqueStatut, as: 'historique_statuts', separate: true, order: [['created_at', 'DESC']] },
        { model: FicheSuivi, as: 'fiches_suivi', separate: true, order: [['date_suivi', 'DESC']] },
        { model: Formation, as: 'formations', separate: true, order: [['date_formation', 'DESC']] },
      ],
    });

    if (!incube) return res.status(404).json({ message: 'Incubé non trouvé' });

    // Un incubé ne peut consulter que son propre dossier
    if (req.user.role === 'incube') {
      if (incube.id !== req.user.pp_id) {
        return res.status(403).json({ message: 'Accès non autorisé à ce dossier' });
      }
    }

    res.json(incube);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// POST /api/incubes — Créer un incubé avec son compte utilisateur (inactif par défaut)
// Utilise une transaction Sequelize managée pour garantir l'atomicité User + Incube
exports.create = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const isSuper = req.user.role === 'super_admin' || req.user.role === 'administrateur';
    const data = { ...req.body };

    // --- Gestion de la photo (upload multipart ou base64 inline) ---
    if (req.file) {
      const mime = req.file.mimetype || 'image/jpeg';
      data.photo_path = `data:${mime};base64,${req.file.buffer.toString('base64')}`;
    } else if (req.body.photo_path) {
      data.photo_path = req.body.photo_path;
    } else if (req.body.photo) {
      data.photo_path = req.body.photo;
    }

    // --- Résolution sécurisée de l'admin_id (vérification FK) ---
    let validAdmin = null;
    if (req.user?.id) validAdmin = await User.findByPk(req.user.id, { transaction: t });
    if (!validAdmin && req.user?.email) {
      validAdmin = await User.findOne({ where: { email: req.user.email }, transaction: t });
    }

    if (!isSuper) {
      // Un admin classique ne peut créer que pour son propre portefeuille
      if (validAdmin) {
        data.admin_id = validAdmin.id;
        data.accompagnateur = `${validAdmin.prenom} ${validAdmin.nom}`;
      } else {
        const defaultAdmin = await User.findOne({
          where: { role: ['super_admin', 'admin', 'administrateur'] },
          transaction: t
        });
        data.admin_id = defaultAdmin?.id ?? null;
        if (defaultAdmin) data.accompagnateur = `${defaultAdmin.prenom} ${defaultAdmin.nom}`;
      }
    } else {
      // Le Super Admin peut désigner librement l'accompagnateur
      if (data.admin_id) {
        data.admin_id = Number(data.admin_id);
        const assignedUser = await User.findByPk(data.admin_id, { transaction: t });
        if (assignedUser) {
          data.accompagnateur = `${assignedUser.prenom} ${assignedUser.nom}`;
        } else {
          data.admin_id = validAdmin?.id ?? null;
        }
      } else {
        data.admin_id = validAdmin?.id ?? null;
      }
    }

    // --- Création du compte User (TOUJOURS inactif à la création) ---
    // Aucun mot de passe réel n'est défini à ce stade.
    // L'activation et l'envoi des accès se font via POST /:id/activer-compte.
    let userAccount = null;
    if (data.email && data.email.trim()) {
      const emailClean = data.email.trim().toLowerCase();

      // Vérifier si un compte existe déjà pour cet email
      userAccount = await User.findOne({ where: { email: emailClean }, transaction: t });

      if (!userAccount) {
        const parts = (data.nom_incube || 'Incubé').trim().split(' ');
        const prenom = parts[0] || 'Incubé';
        const nom = parts.slice(1).join(' ') || 'Projet';

        // Mot de passe temporaire aléatoire (invalide fonctionnellement — sera réinitialisé à l'activation)
        const tempHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

        userAccount = await User.create({
          nom,
          prenom,
          email: emailClean,
          mot_de_passe: tempHash, // Mot de passe invalide — ne permet pas de connexion
          role: 'incube',
          actif: false,           // INACTIF : aucun accès immédiat
          photo_url: data.photo_path || null,
          telephone: data.telephone || null,
        }, { transaction: t });
      } else {
        // Le compte existe déjà : on le laisse tel quel, on le lie simplement à l'incubé
        console.log(`ℹ️ Compte User existant (${emailClean}) détecté — liaison sans modification.`);
      }

      // Lier user_id directement dans data (sera passé à Incube.create dans la même transaction)
      data.user_id = userAccount.id;
    }

    // Nettoyer les champs non-modèle avant Incube.create
    delete data.activer_immediatement;
    delete data.photo;
    delete data.password;

    // --- Création de l'Incube avec user_id lié — tout dans la même transaction ---
    const incube = await Incube.create(data, { transaction: t });

    // --- Commit atomique : User + Incube créés ensemble ou annulés ensemble ---
    await t.commit();

    console.log(`✅ Incubé créé : ${incube.nom_incube} (id=${incube.id}, user_id=${incube.user_id ?? 'aucun'})`);

    // Récupérer l'incubé avec ses relations pour une réponse complète au frontend
    const createdIncube = await Incube.findByPk(incube.id, {
      include: [
        { model: User, as: 'accompagnateurAdmin', attributes: ['id', 'nom', 'prenom', 'email'] },
        { model: User, as: 'compteUtilisateur', attributes: ['id', 'email', 'actif', 'role'] }
      ]
    });

    res.status(201).json(createdIncube || incube);

    // Synchronisation avec le Cloud en arrière-plan
    syncWhitelistCloud();
  } catch (err) {
    // Annuler la transaction en cas d'erreur (rollback automatique)
    await t.rollback();
    console.error('❌ Erreur lors de la création d\'incubé (rollback):', err.message);
    res.status(400).json({ message: 'Erreur lors de la création', error: err.message });
  }
};

// POST /api/incubes/bulk — Importation en masse (ex: fichier Excel)
exports.bulkCreate = async (req, res) => {
  try {
    const isSuper = ['super_admin', 'administrateur'].includes(req.user.role);
    const items = Array.isArray(req.body) ? req.body : req.body.items;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Liste d\'incubés vide ou invalide' });
    }

    let defaultAdminId = null;
    let defaultAccompagnateur = '';
    let me = null;
    if (req.user && req.user.id) {
      me = await User.findByPk(req.user.id);
    }
    if (!me && req.user && req.user.email) {
      me = await User.findOne({ where: { email: req.user.email } });
    }
    if (me) {
      defaultAdminId = me.id;
      defaultAccompagnateur = `${me.prenom} ${me.nom}`;
    } else {
      const defaultAdmin = await User.findOne({ where: { role: ['super_admin', 'admin', 'administrateur'] } });
      if (defaultAdmin) {
        defaultAdminId = defaultAdmin.id;
        defaultAccompagnateur = `${defaultAdmin.prenom} ${defaultAdmin.nom}`;
      }
    }

    const toInsert = [];
    for (const item of items) {
      if (!item.nom_incube || !String(item.nom_incube).trim()) continue;

      let admin_id = defaultAdminId;
      let accompagnateur = defaultAccompagnateur;

      if (isSuper && item.admin_id) {
        const checkId = Number(item.admin_id);
        const assigned = await User.findByPk(checkId);
        if (assigned) {
          admin_id = assigned.id;
          accompagnateur = `${assigned.prenom} ${assigned.nom}`;
        }
      } else if (item.accompagnateur) {
        accompagnateur = item.accompagnateur;
      }

      toInsert.push({
        nom_incube: String(item.nom_incube).trim(),
        email: item.email || item.mail || null,
        telephone: item.telephone || item.tel || null,
        raison_sociale: item.raison_sociale || '',
        phase_projet: item.phase_projet || 'Idéation',
        statut_juridique: item.statut_juridique || 'SARL',
        province: item.province || '',
        ville: item.ville || '',
        genre: item.genre || '',
        secteur_activite: item.secteur_activite || '',
        promotion: item.promotion || item.promo || '',
        age: item.age || null,
        date_naissance: item.date_naissance || null,
        pp_numero: item.pp_numero || '',
        situation_familiale: item.situation_familiale || '',
        accompagnateur,
        admin_id,
        date_demarrage: item.date_demarrage || null,
      });
    }

    if (toInsert.length === 0) {
      return res.status(400).json({ message: 'Aucun nom d\'incubé valide trouvé' });
    }

    const created = await Incube.bulkCreate(toInsert);
    res.status(201).json({
      message: `${created.length} incubé(s) importé(s) avec succès`,
      count: created.length,
      data: created,
    });

    // Synchronisation avec le Cloud en arrière-plan
    syncWhitelistCloud();
  } catch (err) {
    res.status(400).json({ message: 'Erreur lors de l\'importation en masse', error: err.message });
  }
};


// PUT /api/incubes/:id
exports.update = async (req, res) => {
  try {
    const isSuper = ['super_admin', 'administrateur'].includes(req.user.role);
    const incube = await Incube.findByPk(req.params.id);
    if (!incube) return res.status(404).json({ message: 'Incubé non trouvé' });

    if (!isSuper) {
      const isOwner = incube.admin_id === req.user.id ||
        (req.user.nom && incube.accompagnateur && incube.accompagnateur.toLowerCase().includes(req.user.nom.toLowerCase()));
      if (!isOwner) {
        return res.status(403).json({ message: 'Action non autorisée sur ce dossier' });
      }
    }

    const data = { ...req.body };

    if (req.file) {
      const mime = req.file.mimetype || 'image/jpeg';
      data.photo_path = `data:${mime};base64,${req.file.buffer.toString('base64')}`;
    } else if (req.body.photo_path !== undefined) {
      data.photo_path = req.body.photo_path || null;
    } else if (req.body.photo !== undefined) {
      data.photo_path = req.body.photo || null;
    } else {
      delete data.photo_path;
    }

    // Nettoyer les valeurs vides pour la base de données
    if (data.date_demarrage === '' || data.date_demarrage === 'null') {
      data.date_demarrage = null;
    }

    // Parser associes si c'est une string
    if (typeof data.associes === 'string') {
      try {
        data.associes = JSON.parse(data.associes);
      } catch (e) {
        data.associes = [];
      }
    }

    if (data.admin_id === '' || data.admin_id === 'null' || data.admin_id === undefined || data.admin_id === null) {
      delete data.admin_id;
    } else {
      const parsed = Number(data.admin_id);
      if (Number.isNaN(parsed)) {
        return res.status(400).json({ message: 'admin_id invalide' });
      }
      data.admin_id = parsed;
    }

    // Un simple visiteur ne peut pas modifier son propre admin_id
    if (!isSuper) {
      delete data.admin_id;
    }

    // Retirer les associations si présentes dans le corps de la requête
    delete data.materiels;
    delete data.engagements;
    delete data.emplois;
    delete data.personnel;
    delete data.plans;
    delete data.finances;
    delete data.accompagnateurAdmin;

    // Enregistrer l'ancienne phase et ancien statut pour comparaison
    const oldPhase = incube.phase_projet;
    const oldStatut = incube.statut_juridique;

    await incube.update(data);

    // Historiser si la phase a changé
    if (data.phase_projet && data.phase_projet !== oldPhase) {
      await HistoriquePhase.create({
        incube_id: incube.id,
        ancienne_phase: oldPhase,
        nouvelle_phase: data.phase_projet,
        date_changement: new Date().toISOString().split('T')[0]
      });
    }

    // Historiser si le statut juridique a changé
    if (data.statut_juridique && data.statut_juridique !== oldStatut) {
      await HistoriqueStatut.create({
        incube_id: incube.id,
        ancien_statut: oldStatut,
        nouveau_statut: data.statut_juridique,
        date_changement: new Date().toISOString().split('T')[0]
      });
    }

    res.json(incube);

    // Synchronisation avec le Cloud en arrière-plan
    syncWhitelistCloud();
  } catch (err) {
    console.error("❌ Erreur mise à jour incubé:", err);
    res.status(400).json({ message: 'Erreur lors de la mise à jour', error: err.message });
  }
};

// PUT /api/incubes/:id/assigner — Réassigner un incubé à un admin (Réservé aux super_admin / administrateurs)
exports.assigner = async (req, res) => {
  try {
    const admin_id = req.body.admin_id || req.body.new_admin_id;
    const incube = await Incube.findByPk(req.params.id);
    if (!incube) return res.status(404).json({ message: 'Incubé non trouvé' });

    if (admin_id) {
      const targetAdmin = await User.findByPk(admin_id);
      if (!targetAdmin) return res.status(404).json({ message: 'Accompagnateur cible non trouvé' });
      incube.admin_id = targetAdmin.id;
      incube.accompagnateur = `${targetAdmin.prenom} ${targetAdmin.nom}`.trim();
    } else {
      incube.admin_id = null;
      incube.accompagnateur = null;
    }

    await incube.save();
    res.json({ message: 'Incubé réassigné avec succès', incube });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la réassignation', error: err.message });
  }
};

// DELETE /api/incubes/:id
exports.delete = async (req, res) => {
  try {
    const isSuper = ['super_admin', 'administrateur'].includes(req.user.role);
    const incube = await Incube.findByPk(req.params.id);
    if (!incube) return res.status(404).json({ message: 'Incubé non trouvé' });

    if (!isSuper) {
      const isOwner = incube.admin_id === req.user.id ||
        (req.user.nom && incube.accompagnateur && incube.accompagnateur.toLowerCase().includes(req.user.nom.toLowerCase()));
      if (!isOwner) {
        return res.status(403).json({ message: 'Action non autorisée sur ce dossier' });
      }
    }

    await incube.destroy();
    res.json({ message: 'Incubé supprimé avec succès' });

    // Synchronisation avec le Cloud en arrière-plan
    syncWhitelistCloud();
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la suppression', error: err.message });
  }
};

// POST /api/incubes/:id/alerte-assiduite
exports.envoyerAlerteAssiduite = async (req, res) => {
  try {
    const incube = await Incube.findByPk(req.params.id);
    if (!incube) return res.status(404).json({ message: 'Incubé non trouvé' });
    if (!incube.email) return res.status(400).json({ message: "L'incubé n'a pas d'adresse email enregistrée" });

    const { tauxPresence = 0, moyenneHeures = 0, annee = 2026 } = req.body;

    const emailResult = await emailService.sendAlerteAssiduiteEmail(incube, {
      tauxPresence,
      moyenneHeures,
      annee
    });

    res.json({
      success: true,
      message: `Alerte d'assiduité envoyée à ${incube.email}`,
      emailNotification: emailResult
    });
  } catch (err) {
    console.error('Erreur alerte assiduité:', err);
    res.status(500).json({ message: "Erreur lors de l'envoi de l'alerte", error: err.message });
  }
};

// GET & POST /api/incubes/:id/sync-tourniquet
exports.syncTourniquet = async (req, res) => {
  try {
    const incubeId = req.params.id;
    const annee = parseInt(req.query.annee || req.body?.annee || new Date().getFullYear(), 10);
    const result = await tourniquetService.syncIncubeTourniquet(incubeId, annee);
    res.json({
      success: true,
      message: `Pointages synchronisés avec succès depuis les tourniquets pour ${result.incube.nom_incube}`,
      ...result
    });
  } catch (err) {
    console.error('Erreur syncTourniquet:', err);
    res.status(500).json({ message: "Erreur lors de la synchronisation des tourniquets", error: err.message });
  }
};

// POST /api/incubes/:id/activer-compte — Activer le compte de l'incubé et envoyer les identifiants
// Les opérations DB (mot de passe + actif=true) et l'envoi email sont séparés intentionnellement :
// un échec SMTP ne doit pas annuler l'activation en base.
exports.activerCompte = async (req, res) => {
  try {
    // --- 1. Vérifications préliminaires ---
    const incube = await Incube.findByPk(req.params.id);
    if (!incube) return res.status(404).json({ message: 'Incubé introuvable' });

    const isSuper = ['super_admin', 'admin', 'administrateur', 'superadmin'].includes(req.user.role);
    if (!isSuper) {
      const isOwner = incube.admin_id === req.user.id ||
        (req.user.nom && incube.accompagnateur && incube.accompagnateur.toLowerCase().includes(req.user.nom.toLowerCase()));
      if (!isOwner) {
        return res.status(403).json({ message: 'Vous n\'êtes pas autorisé à activer ce compte' });
      }
    }

    // Permettre de renseigner/corriger l'email au moment de l'activation
    if (req.body.email && req.body.email.trim()) {
      incube.email = req.body.email.trim().toLowerCase();
      await incube.save();
    }

    if (!incube.email || !incube.email.trim()) {
      return res.status(400).json({
        message: 'Veuillez renseigner une adresse email valide avant d\'activer ce compte'
      });
    }

    // --- 2. Résolution du compte User associé ---
    const emailClean = incube.email.trim().toLowerCase();
    let userAccount = null;

    // Priorité : user_id déjà lié à l'incubé
    if (incube.user_id) {
      userAccount = await User.findByPk(incube.user_id);
    }
    // Fallback : recherche par email (cas où user_id n'est pas encore défini)
    if (!userAccount) {
      userAccount = await User.findOne({ where: { email: emailClean } });
    }

    // --- 3. Génération du mot de passe temporaire sécurisé ---
    // Format mémorisable : XXXX@IdsNN (ex: A3F2@Ids47)
    const rawPassword = crypto.randomBytes(4).toString('hex').toUpperCase() + '@Ids' + Math.floor(10 + Math.random() * 90);
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    // --- 4. Mise à jour ou création du compte User en base (logique DB isolée) ---
    if (!userAccount) {
      // Aucun compte existant : création avec statut actif
      const parts = (incube.nom_incube || 'Incubé').trim().split(' ');
      userAccount = await User.create({
        nom: parts.slice(1).join(' ') || 'Projet',
        prenom: parts[0] || 'Incubé',
        email: emailClean,
        mot_de_passe: hashedPassword,
        role: 'incube',
        actif: true,
        photo_url: incube.photo_path || null,
        telephone: incube.telephone || null,
      });
      // Lier le nouvel User à l'Incube
      incube.user_id = userAccount.id;
      await incube.save();
    } else {
      // Compte existant : régénération du mot de passe et activation
      userAccount.mot_de_passe = hashedPassword;
      userAccount.actif = true;
      if (!['super_admin', 'admin', 'administrateur'].includes(userAccount.role)) {
        userAccount.role = 'incube';
      }
      await userAccount.save();

      // S'assurer que le lien user_id est cohérent dans incubes
      if (incube.user_id !== userAccount.id) {
        incube.user_id = userAccount.id;
        await incube.save();
      }
    }

    console.log(`✅ Compte activé : ${emailClean} (user_id=${userAccount.id}, incube_id=${incube.id})`);

    // --- 5. Envoi de l'email de bienvenue (hors transaction DB, erreur non bloquante) ---
    let emailResult = { success: false, skipped: true };
    try {
      emailResult = await emailService.sendWelcomeEmail(incube, rawPassword);
      console.log(`📧 Email de bienvenue envoyé à ${emailClean}`);
    } catch (emailErr) {
      // L'activation est déjà enregistrée en DB — l'admin peut renvoyer manuellement via /renvoyer-acces
      console.error(`⚠️ Activation OK mais échec email vers ${emailClean}:`, emailErr.message);
      emailResult = { success: false, error: emailErr.message };
    }

    res.json({
      success: true,
      message: emailResult.success
        ? `Compte activé et identifiants envoyés par email à ${incube.email}.`
        : `Compte activé avec succès. L'email n'a pas pu être envoyé (${emailResult.error || 'SMTP indisponible'}). Utilisez « Renvoyer les accès » pour réessayer.`,
      compteUtilisateur: {
        id: userAccount.id,
        email: userAccount.email,
        actif: userAccount.actif,
        role: userAccount.role,
      },
      emailNotification: emailResult
    });
  } catch (err) {
    console.error('❌ Erreur activerCompte:', err.message);
    res.status(500).json({ message: 'Erreur lors de l\'activation du compte', error: err.message });
  }
};

// POST /api/incubes/:id/desactiver-compte — Suspendre l'accès de l'incubé
exports.desactiverCompte = async (req, res) => {
  try {
    const incube = await Incube.findByPk(req.params.id);
    if (!incube) return res.status(404).json({ message: 'Incubé introuvable' });

    const isSuper = ['super_admin', 'administrateur'].includes(req.user.role);
    if (!isSuper) {
      const isOwner = incube.admin_id === req.user.id ||
        (req.user.nom && incube.accompagnateur && incube.accompagnateur.toLowerCase().includes(req.user.nom.toLowerCase()));
      if (!isOwner) {
        return res.status(403).json({ message: 'Vous n\'êtes pas autorisé à modifier ce compte' });
      }
    }

    if (!incube.user_id) {
      return res.status(400).json({ message: 'Aucun compte utilisateur associé à cet incubé' });
    }

    const userAccount = await User.findByPk(incube.user_id);
    if (!userAccount) {
      return res.status(404).json({ message: 'Compte utilisateur introuvable' });
    }

    userAccount.actif = false;
    await userAccount.save();

    res.json({
      success: true,
      message: `Accès au portail suspendu pour ${incube.nom_incube}.`,
      compteUtilisateur: {
        id: userAccount.id,
        email: userAccount.email,
        actif: userAccount.actif,
        role: userAccount.role,
      }
    });
  } catch (err) {
    console.error('❌ Erreur desactiverCompte:', err);
    res.status(500).json({ message: 'Erreur lors de la désactivation du compte', error: err.message });
  }
};

// POST /api/incubes/:id/renvoyer-acces — Régénérer le mot de passe et réexpédier l'email
exports.renvoyerAcces = async (req, res) => {
  try {
    const incube = await Incube.findByPk(req.params.id);
    if (!incube) return res.status(404).json({ message: 'Incubé introuvable' });

    const isSuper = ['super_admin', 'administrateur'].includes(req.user.role);
    if (!isSuper) {
      const isOwner = incube.admin_id === req.user.id ||
        (req.user.nom && incube.accompagnateur && incube.accompagnateur.toLowerCase().includes(req.user.nom.toLowerCase()));
      if (!isOwner) {
        return res.status(403).json({ message: 'Vous n\'êtes pas autorisé à réexpédier les accès' });
      }
    }

    if (!incube.email || !incube.email.trim()) {
      return res.status(400).json({ message: 'Adresse email manquante pour cet incubé' });
    }

    let userAccount = null;
    if (incube.user_id) {
      userAccount = await User.findByPk(incube.user_id);
    }
    if (!userAccount) {
      userAccount = await User.findOne({ where: { email: incube.email.trim().toLowerCase() } });
    }

    const rawPassword = req.body.password || (crypto.randomBytes(4).toString('hex').toUpperCase() + '@Ids' + Math.floor(10 + Math.random() * 90));
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    if (userAccount) {
      userAccount.mot_de_passe = hashedPassword;
      userAccount.actif = true;
      await userAccount.save();
    } else {
      const parts = (incube.nom_incube || 'Incubé').trim().split(' ');
      userAccount = await User.create({
        nom: parts.slice(1).join(' ') || 'Projet',
        prenom: parts[0] || 'Incubé',
        email: incube.email.trim().toLowerCase(),
        mot_de_passe: hashedPassword,
        role: 'incube',
        actif: true
      });
      incube.user_id = userAccount.id;
      await incube.save();
    }

    const emailResult = await emailService.sendWelcomeEmail(incube, rawPassword);

    res.json({
      success: true,
      message: `Nouveaux identifiants générés et transmis avec succès à ${incube.email} !`,
      compteUtilisateur: {
        id: userAccount.id,
        email: userAccount.email,
        actif: userAccount.actif,
        role: userAccount.role,
      },
      emailNotification: emailResult
    });
  } catch (err) {
    console.error('❌ Erreur renvoyerAcces:', err);
    res.status(500).json({ message: 'Erreur lors du renvoi des identifiants', error: err.message });
  }
};

// POST /api/incubes/:id/welcome-email (alias vers activerCompte / renvoi pour rétrocompatibilité)
exports.envoyerWelcomeEmail = async (req, res) => {
  return exports.renvoyerAcces(req, res);
};


