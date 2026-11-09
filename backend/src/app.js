// Configuration de l'environnement en heure locale GMT+0 (UTC)
process.env.TZ = process.env.APP_TIMEZONE || 'UTC';

// Bouclier de protection global anti-crash (ex: déconnexions TCP inopinées node-zklib)
process.on('uncaughtException', (err) => {
  console.warn('⚠️ [Sécurité Système] uncaughtException interceptée sans arrêt du serveur :', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.warn('⚠️ [Sécurité Système] unhandledRejection interceptée sans arrêt du serveur :', reason?.message || reason);
});

const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();

// Configuration de la clé secrète JWT avec repli sécurisé pour éviter un crash au démarrage
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'cgs_incubateur_secret_key_ids_production_platform';
  console.warn('⚠️ AVERTISSEMENT : JWT_SECRET non défini dans l\'environnement, clé de sécurité par défaut appliquée.');
}

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { sequelize } = require('./models');
const emailService = require('./services/emailService');

const app = express();

// Désactiver l'empreinte technologique Express (OWASP ASVS V14.4 / CIS)
app.disable('x-powered-by');

// Activer le proxy de confiance pour obtenir les vraies adresses IP clients derrière Nginx / reverse proxy
app.set('trust proxy', 1);

// En-têtes de sécurité HTTP (compatibles HTTP interne http://10.0.5.126:3030 et HTTPS)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  res.setHeader('X-XSS-Protection', '0');

  // HSTS activé uniquement si la connexion est réellement en HTTPS (ne bloque jamais le serveur HTTP interne)
  const isHttps = req.secure || String(req.headers['x-forwarded-proto'] || '').toLowerCase().includes('https');
  if (isHttps) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Middlewares CORS & Body Parser
const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Autoriser les requêtes same-origin / serveur-à-serveur (sans en-tête Origin)
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0 || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // Autoriser les origines du réseau local / intranet IDS (localhost, 127.0.0.1, 10.x.x.x, 192.168.x.x)
    if (/^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$/i.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origine non autorisée par la politique CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check pour DigitalOcean App Platform, Kubernetes et Load Balancers
app.get(['/health', '/api/health', '/healthz'], (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'IDS Incubateur API',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Uploads
const uploadsDir = process.env.UPLOAD_PATH
  ? path.resolve(process.env.UPLOAD_PATH)
  : path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const staticUploadOptions = {
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox");
  }
};
app.use('/uploads', express.static(uploadsDir, staticUploadOptions));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), staticUploadOptions));

const auth = require('./middleware/auth');
const requireStaff = require('./middleware/requireStaff');

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/incubes', require('./routes/incubes'));
app.use('/api/rendezvous', require('./routes/rendezvous'));
app.use('/api/reservations', require('./routes/reservations'));
app.use('/api/equipements-espaces', require('./routes/equipementsEspaces'));
app.use('/api/presence', require('./routes/presence'));
app.use('/api/ateliers', require('./routes/ateliers'));
app.use('/api/formations', require('./routes/formations'));
app.use('/api/impact', require('./routes/impact'));
app.use('/api/promotions', require('./routes/promotions'));
app.use('/api/rapports', require('./routes/rapports'));

// Service de synchronisation hybride (Local <-> Cloud Relay - actif uniquement si CLOUD_URL est défini)
if (process.env.CLOUD_URL) {
  const syncService = require('./services/SyncService');
  const syncInterval = parseInt(process.env.SYNC_INTERVAL_MINUTES || '1', 10);
  syncService.startCron(syncInterval);

  // Synchronisation automatique de la liste blanche (Incubés + Staff) vers Heroku au démarrage
  if (process.env.ACTIVER_SYNC_CLOUD === 'true') {
    const { syncWhitelistCloud } = require('./controllers/incubeController');
    setTimeout(() => {
      syncWhitelistCloud().catch(err => console.warn('⚠️ [Whitelist] Sync initiale:', err.message));
    }, 4000);
  }
}

// Endpoint manuel pour forcer la synchronisation immédiate (Admin / Staff)
app.post('/api/sync/trigger', auth, requireStaff, async (req, res) => {
  try {
    if (!process.env.CLOUD_URL) {
      return res.status(400).json({ success: false, message: 'Le service cloud relais n\'est pas configuré (CLOUD_URL manquant)' });
    }
    const syncService = require('./services/SyncService');
    const result = await syncService.pullAndSync();
    res.json({
      success: true,
      message: 'Synchronisation avec le relais cloud exécutée',
      result
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur lors de la synchronisation', error: err.message });
  }
});

// Middleware strict réservé aux Administrateurs pour la gestion des sauvegardes chiffrées
const requireAdminOnly = (req, res, next) => {
  const role = req.user?.role;
  if (role === 'super_admin' || role === 'administrateur') {
    return next();
  }
  return res.status(403).json({ message: 'Accès réservé aux administrateurs.' });
};

// Lister les sauvegardes chiffrées AES-256 disponibles (ADMIN)
app.get('/api/backups/status', auth, requireAdminOnly, (req, res) => {
  try {
    const backupService = require('./services/backupService');
    const backups = backupService.listEncryptedBackups();
    res.json({
      success: true,
      encryption: 'AES-256-GCM + GZIP',
      totalBackups: backups.length,
      backups,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur lecture des sauvegardes', error: err.message });
  }
});

// Déclencher immédiatement une sauvegarde chiffrée AES-256 (ADMIN)
app.post('/api/backups/trigger', auth, requireAdminOnly, async (req, res) => {
  try {
    const backupService = require('./services/backupService');
    const info = await backupService.createEncryptedBackup({ prefix: 'backup_auto' });
    res.json({
      success: true,
      message: 'Sauvegarde complète chiffrée (AES-256-GCM) créée avec succès',
      backup: {
        fileName: info.fileName,
        timestamp: info.timestamp,
        totalTables: info.totalTables,
        totalRows: info.totalRows,
        encryptedSizeBytes: info.encryptedSizeBytes,
        compressionRatioPercent: info.compressionRatioPercent,
        checksum: info.checksum,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur lors de la création de la sauvegarde', error: err.message });
  }
});

// Télécharger un fichier de sauvegarde chiffré .idsbak.enc (ADMIN)
app.get('/api/backups/download/:filename', auth, requireAdminOnly, (req, res) => {
  try {
    const backupService = require('./services/backupService');
    const safeName = path.basename(String(req.params.filename || ''));
    if (!safeName.endsWith('.idsbak.enc')) {
      return res.status(400).json({ message: 'Format de fichier de sauvegarde non autorisé.' });
    }
    const filePath = path.join(backupService.getPrimaryBackupDir(), safeName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Fichier de sauvegarde introuvable.' });
    }
    res.download(filePath, safeName);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors du téléchargement de la sauvegarde' });
  }
});

// Envoyer un RAPPEL d'atelier par email aux participants (ADMIN)
app.post(['/api/evenements/:id/rappel', '/api/presence/atelier/:id/rappel'], auth, requireStaff, async (req, res) => {
  try {
    const { Incube, Atelier } = require('./models');
    const atelierId = req.params.id;
    const { evenement = {}, incubeIds } = req.body;

    let dbAtelier = null;
    if (atelierId && Atelier) {
      try {
        dbAtelier = await Atelier.findByPk(atelierId);
      } catch (e) {
        console.warn('Erreur récupération atelier en BDD:', e.message);
      }
    }

    let targetIncubes = [];
    if (Array.isArray(incubeIds) && incubeIds.length > 0) {
      const { Op } = require('sequelize');
      targetIncubes = await Incube.findAll({
        where: { id: { [Op.in]: incubeIds } },
        attributes: ['id', 'nom_incube', 'email', 'statut_creation', 'phase', 'promotion']
      });
    } else {
      targetIncubes = await Incube.findAll({
        attributes: ['id', 'nom_incube', 'email', 'statut_creation', 'phase', 'promotion']
      });
    }

    const eventData = {
      id: atelierId,
      titre: evenement.titre || (dbAtelier ? dbAtelier.titre : null) || req.body.titre || 'Atelier & Formation IDS',
      formateur: evenement.formateur || (dbAtelier ? (dbAtelier.intervenant || dbAtelier.formateur) : null) || req.body.formateur || 'Intervenant IDS',
      intervenant: evenement.intervenant || (dbAtelier ? dbAtelier.intervenant : null) || req.body.intervenant || null,
      date: evenement.date || (dbAtelier ? dbAtelier.date : null) || req.body.date || new Date().toISOString().split('T')[0],
      heureDebut: evenement.heureDebut || (dbAtelier ? dbAtelier.heureDebut : null) || req.body.heureDebut || '09:30',
      heureFin: evenement.heureFin || (dbAtelier ? dbAtelier.heureFin : null) || req.body.heureFin || '12:30',
      duree: evenement.duree || (dbAtelier ? dbAtelier.duree : null) || req.body.duree || '3h00',
      description: evenement.description || (dbAtelier ? dbAtelier.description : null) || req.body.description || ''
    };

    let sentCount = 0;
    for (const inc of targetIncubes) {
      if (inc.email) {
        try {
          await emailService.sendWorkshopReminderEmail(eventData, inc);
          sentCount++;
        } catch (e) {
          console.error(`Erreur rappel atelier pour ${inc.email}:`, e.message);
        }
      }
    }

    res.json({
      success: true,
      message: `Rappels d'atelier envoyés par email à ${sentCount} incubé(s) !`,
      sentCount,
      totalIncubes: targetIncubes.length
    });
  } catch (err) {
    console.error('Erreur rappel atelier email:', err);
    res.status(500).json({ message: "Erreur lors de l'envoi des rappels", error: err.message });
  }
});

// Envoyer convocations & rappels d'atelier par email à toute la promotion ou une sélection (ADMIN)
app.post(['/api/evenements/:id/notifier', '/api/presence/atelier/:id/notifier'], auth, requireStaff, async (req, res) => {
  try {
    const { Incube, Atelier } = require('./models');
    const atelierId = req.params.id;
    const { evenement = {}, incubeIds } = req.body;

    let dbAtelier = null;
    if (atelierId && Atelier) {
      try {
        dbAtelier = await Atelier.findByPk(atelierId);
      } catch (e) {
        console.warn('Erreur récupération atelier en BDD:', e.message);
      }
    }

    let targetIncubes = [];
    if (Array.isArray(incubeIds) && incubeIds.length > 0) {
      const { Op } = require('sequelize');
      targetIncubes = await Incube.findAll({
        where: { id: { [Op.in]: incubeIds } },
        attributes: ['id', 'nom_incube', 'email', 'statut_creation', 'phase', 'promotion']
      });
    } else {
      targetIncubes = await Incube.findAll({
        attributes: ['id', 'nom_incube', 'email', 'statut_creation', 'phase', 'promotion']
      });
    }

    const defaultNoms = targetIncubes.map(i => i.nom_incube).filter(Boolean).join(', ');

    const eventData = {
      id: atelierId,
      titre: evenement.titre || (dbAtelier ? dbAtelier.titre : null) || req.body.titre || 'Atelier & Formation IDS',
      formateur: evenement.formateur || (dbAtelier ? (dbAtelier.intervenant || dbAtelier.formateur) : null) || req.body.formateur || 'Intervenant IDS',
      intervenant: evenement.intervenant || (dbAtelier ? dbAtelier.intervenant : null) || req.body.intervenant || null,
      date: evenement.date || (dbAtelier ? dbAtelier.date : null) || req.body.date || new Date().toISOString().split('T')[0],
      heureDebut: evenement.heureDebut || (dbAtelier ? dbAtelier.heureDebut : null) || req.body.heureDebut || '09:30',
      heureFin: evenement.heureFin || (dbAtelier ? dbAtelier.heureFin : null) || req.body.heureFin || '12:30',
      duree: evenement.duree || (dbAtelier ? dbAtelier.duree : null) || req.body.duree || '3h00',
      description: evenement.description || (dbAtelier ? dbAtelier.description : null) || req.body.description || ''
    };

    let sentCount = 0;
    const errors = [];

    for (const inc of targetIncubes) {
      if (inc.email) {
        try {
          await emailService.sendFormationInvitationEmail(eventData, inc);
          sentCount++;
        } catch (e) {
          errors.push({ email: inc.email, error: e.message });
        }
      }
    }

    res.json({
      success: true,
      message: `Convocations envoyées par email à ${sentCount} incubé(s) !`,
      sentCount,
      totalIncubes: targetIncubes.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    console.error('Erreur notification atelier email:', err);
    res.status(500).json({ message: "Erreur lors de l'envoi des convocations", error: err.message });
  }
});

// Health checks complets (DigitalOcean App Platform, Kubernetes, AWS, etc.)
app.get(['/health', '/api/health', '/healthz'], (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Servir le frontend React compilé en production
const distPaths = [
  path.resolve(__dirname, '../../frontend/dist'),
  path.resolve(__dirname, '../frontend/dist'),
  path.resolve(process.cwd(), 'frontend/dist'),
  path.resolve(process.cwd(), 'dist')
];

let activeDist = null;
for (const p of distPaths) {
  if (fs.existsSync(path.join(p, 'index.html'))) {
    activeDist = p;
    break;
  }
}

if (activeDist) {
  console.log(`📁 Frontend statique servi depuis : ${activeDist}`);
  app.use(express.static(activeDist));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return res.status(404).json({ message: 'Ressource non trouvée' });
    }
    
    // Intercepter les requêtes vers d'anciens fichiers JS/CSS du cache
    if (req.path.match(/\.(js|css|png|svg|ico|woff|woff2)$/)) {
      if (req.path.endsWith('.js')) {
        // Renvoyer un script JS valide qui force le navigateur à recharger la page
        res.type('application/javascript');
        return res.send("console.log('Ancienne version détectée, rechargement...'); window.location.reload();");
      }
      return res.status(404).send('Asset non trouvé');
    }

    // Désactiver complètement la mise en cache de index.html
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    
    res.sendFile(path.join(activeDist, 'index.html'));
  });
} else {
  // Répondre 200 OK sur la racine pour ne jamais faire échouer le Health Check DigitalOcean
  app.get('/', (req, res) => res.status(200).json({ status: 'OK', service: 'IDS Incubateur API' }));
  app.use((req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return res.status(404).json({ message: 'Ressource non trouvée' });
    }
    res.status(404).json({ message: 'Route non trouvée' });
  });
}

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: err.message || 'Erreur interne du serveur' });
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT} (0.0.0.0)`);
});

// Connexion à la base de données (Démarrage instantané 1s en production sans alter: true)
sequelize.authenticate()
  .then(async () => {
    console.log('✅ Base de données connectée (MariaDB/MySQL) - Démarrage instantané (1s)');

    // Auto-migration idempotente et légère au démarrage (ajoute les colonnes manquantes sans altérer les données existantes)
    try {
      const checkAndAddColumn = async (table, column, definition) => {
        try {
          const [results] = await sequelize.query(`SHOW COLUMNS FROM ${table} LIKE '${column}'`);
          if (!results || results.length === 0) {
            await sequelize.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
            console.log(`✅ Auto-migration : colonne '${column}' ajoutée à la table '${table}'`);
          }
        } catch (e) {
          // Ignorer si la colonne existe déjà
        }
      };

      await checkAndAddColumn('incubes', 'est_suspendu', 'TINYINT(1) DEFAULT 0');
      await checkAndAddColumn('incubes', 'matricule', 'INT NULL');
      await checkAndAddColumn('incubes', 'cin', 'VARCHAR(50) NULL');
      await checkAndAddColumn('suivi_engagement', 'heures_ateliers', 'FLOAT DEFAULT 0');
      await checkAndAddColumn('suivi_engagement', 'nb_ateliers', 'INT DEFAULT 0');
      await checkAndAddColumn('suivi_engagement', 'heures_ateliers_animes', 'FLOAT DEFAULT 0');
      await checkAndAddColumn('suivi_engagement', 'nb_ateliers_animes', 'INT DEFAULT 0');
      await checkAndAddColumn('ateliers', 'animateur_type', "ENUM('externe', 'incube') DEFAULT 'externe'");
      await checkAndAddColumn('ateliers', 'animateur_incube_id', 'INT NULL');
      await checkAndAddColumn('ateliers', 'intervenant', 'VARCHAR(150) NULL');
      await checkAndAddColumn('ateliers', 'statut_ouverture', "VARCHAR(50) DEFAULT 'auto'");
      await checkAndAddColumn('ateliers', 'drive_link', 'VARCHAR(500) NULL');
      await checkAndAddColumn('users', 'type', "VARCHAR(50) DEFAULT 'Incube'");
      await checkAndAddColumn('users', 'badge_id', 'VARCHAR(50) NULL');
      await checkAndAddColumn('rh_detail', 'badge_id', 'VARCHAR(50) NULL');
      await checkAndAddColumn('rh_detail', 'matricule', 'INT NULL');
      await checkAndAddColumn('reservation_espace', 'cloud_id', 'INT NULL');
    } catch (migErr) {
      console.warn('⚠️ Note auto-migration:', migErr.message);
    }
    try {
      const bcrypt = require('bcryptjs');
      const { User } = require('./models');
      const count = await User.count({
        where: { role: ['super_admin', 'administrateur'] }
      });
      if (count === 0) {
        const hash = await bcrypt.hash('Admin@2024', 12);
        await User.create({
          nom: 'Administrateur',
          prenom: 'IDS',
          email: 'admin@cgs-incubateur.ma',
          mot_de_passe: hash,
          role: 'super_admin',
          actif: true,
        });
        console.log('👤 Super Admin par défaut créé : admin@cgs-incubateur.ma / Admin@2024');
      }
    } catch (adminErr) {
      console.error('Initialisation admin:', adminErr.message);
    }

    // Démarrage immédiat de la collecte automatique des tourniquets ZKTeco (démarrage + toutes les 60 secondes)
    try {
      const { collectFromAllDevices } = require('./services/tourniquetCollector');
      setTimeout(() => {
        collectFromAllDevices().catch(err => console.warn('⚠️ Collecte tourniquets initiale:', err.message));
        setInterval(() => {
          collectFromAllDevices().catch(err => console.warn('⚠️ Collecte tourniquets interval:', err.message));
        }, 60 * 1000);
      }, 1000);
    } catch (collErr) {
      console.warn('⚠️ Erreur init collecteur tourniquets:', collErr.message);
    }

    // Planificateur de sauvegarde quotidienne chiffrée (AES-256-GCM + GZIP) en lecture seule
    try {
      const backupService = require('./services/backupService');
      backupService.startAutoBackupCron();
    } catch (bakErr) {
      console.warn('⚠️ Erreur init planificateur de sauvegarde:', bakErr.message);
    }
  })
  .catch(err => {
    console.error('❌ Erreur de connexion à la base de données:', err.message);
  });

module.exports = app;
