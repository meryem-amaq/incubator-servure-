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

// Middlewares
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
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

app.use('/uploads', express.static(uploadsDir));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

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
  syncService.startCron(10);

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

// Envoyer un RAPPEL d'atelier par email aux participants (ADMIN)
app.post(['/api/evenements/:id/rappel', '/api/presence/atelier/:id/rappel'], auth, requireStaff, async (req, res) => {
  try {
    const { Incube } = require('./models');
    const atelierId = req.params.id;
    const { evenement = {}, incubeIds } = req.body;

    let targetIncubes = [];
    if (Array.isArray(incubeIds) && incubeIds.length > 0) {
      const { Op } = require('sequelize');
      targetIncubes = await Incube.findAll({
        where: { id: { [Op.in]: incubeIds } },
        attributes: ['id', 'nom_incube', 'email']
      });
    } else {
      targetIncubes = await Incube.findAll({
        attributes: ['id', 'nom_incube', 'email']
      });
    }

    const eventData = {
      id: atelierId,
      titre: evenement.titre || req.body.titre || 'Atelier & Formation IDS',
      formateur: evenement.formateur || req.body.formateur || 'Intervenant IDS',
      date: evenement.date || req.body.date || new Date().toISOString().split('T')[0],
      heureDebut: evenement.heureDebut || req.body.heureDebut || '09:30',
      heureFin: evenement.heureFin || req.body.heureFin || '12:30',
      duree: evenement.duree || req.body.duree || '3h00',
      description: evenement.description || req.body.description || ''
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
    const { Incube } = require('./models');
    const atelierId = req.params.id;
    const { evenement = {}, incubeIds } = req.body;

    let targetIncubes = [];
    if (Array.isArray(incubeIds) && incubeIds.length > 0) {
      const { Op } = require('sequelize');
      targetIncubes = await Incube.findAll({
        where: { id: { [Op.in]: incubeIds } },
        attributes: ['id', 'nom_incube', 'email']
      });
    } else {
      targetIncubes = await Incube.findAll({
        attributes: ['id', 'nom_incube', 'email']
      });
    }

    const defaultNoms = targetIncubes.map(i => i.nom_incube).filter(Boolean).join(', ');

    const eventData = {
      id: atelierId,
      titre: evenement.titre || req.body.titre || 'Atelier & Formation IDS',
      formateur: evenement.formateur || req.body.formateur || 'Intervenant IDS',
      date: evenement.date || req.body.date || new Date().toISOString().split('T')[0],
      heureDebut: evenement.heureDebut || req.body.heureDebut || '09:30',
      heureFin: evenement.heureFin || req.body.heureFin || '12:30',
      duree: evenement.duree || req.body.duree || '3h00',
      description: evenement.description || req.body.description || ''
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

// Connexion à la base de données
sequelize.authenticate()
  .then(() => {
    console.log('✅ Base de données connectée (MariaDB/MySQL)');
    return sequelize.sync({ alter: true });
  })
  .then(async () => {
    console.log('✅ Modèles synchronisés');
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
  })
  .catch(err => {
    console.error('❌ Erreur de connexion à la base de données:', err.message);
  });

module.exports = app;
