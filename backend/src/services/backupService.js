const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const models = require('../models');

// En-tête magique 8 octets identifiant un fichier de sauvegarde chiffré IDS v1
const MAGIC_HEADER = Buffer.from('IDSBAK01', 'ascii');
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

// Ordre respectant les dépendances de clés étrangères (parents -> enfants)
const BACKUP_TABLES = [
  { key: 'promotions', modelName: 'Promotion' },
  { key: 'users', modelName: 'User' },
  { key: 'incubes', modelName: 'Incube' },
  { key: 'materiels', modelName: 'GestionMateriel' },
  { key: 'engagements', modelName: 'SuiviEngagement' },
  { key: 'rh_emploi', modelName: 'RhEmploi' },
  { key: 'rh_detail', modelName: 'RhDetail' },
  { key: 'rendez_vous', modelName: 'RendezVous' },
  { key: 'fiches_suivi', modelName: 'FicheSuivi' },
  { key: 'plans_action', modelName: 'PlanAction' },
  { key: 'finances', modelName: 'AnalyseFinanciere' },
  { key: 'formations', modelName: 'Formation' },
  { key: 'historique_phases', modelName: 'HistoriquePhase' },
  { key: 'historique_statuts', modelName: 'HistoriqueStatut' },
  { key: 'equipements_espace', modelName: 'EquipementEspace' },
  { key: 'reservations', modelName: 'ReservationEspace' },
  { key: 'checklists_materiel', modelName: 'ChecklistMateriel' },
  { key: 'ateliers', modelName: 'Atelier' },
  { key: 'presences_atelier', modelName: 'PresenceAtelier' },
  { key: 'attendances', modelName: 'Attendance' },
  { key: 'tourniquet_users', modelName: 'TourniquetUser' },
];

/**
 * Récupère la clé secrète de chiffrement des sauvegardes (avec repli sur JWT_SECRET / SYNC_SECRET)
 */
function getBackupSecret(customSecret) {
  const secret =
    customSecret ||
    process.env.BACKUP_SECRET ||
    process.env.SYNC_SECRET ||
    process.env.JWT_SECRET ||
    'cgs_incubateur_default_backup_secret_key_2026';
  return String(secret);
}

/**
 * Chiffre un Buffer (JSON) après compression GZIP via AES-256-GCM.
 * Format binaire de sortie :
 * [MAGIC_HEADER (8o)] [SALT (16o)] [IV (12o)] [AUTH_TAG (16o)] [GZIP_CIPHERTEXT (...)]
 */
function encryptBackupPayload(jsonString, secretKey) {
  const secret = getBackupSecret(secretKey);
  const compressed = zlib.gzipSync(Buffer.from(jsonString, 'utf-8'), {
    level: zlib.constants.Z_BEST_COMPRESSION,
  });

  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = crypto.scryptSync(secret, salt, 32);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([MAGIC_HEADER, salt, iv, authTag, encrypted]);
}

/**
 * Déchiffre et décompresse un Buffer .idsbak.enc généré par encryptBackupPayload.
 * Vérifie l'en-tête magique, le tag d'intégrité GCM (AuthTag) et le checksum SHA-256.
 */
function decryptBackupPayload(encryptedBuffer, secretKey) {
  if (!Buffer.isBuffer(encryptedBuffer) || encryptedBuffer.length < 8 + SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Fichier de sauvegarde invalide ou tronqué.');
  }

  const header = encryptedBuffer.subarray(0, 8);
  if (!header.equals(MAGIC_HEADER)) {
    throw new Error('En-tête de fichier non reconnu (attendu : IDSBAK01).');
  }

  const secret = getBackupSecret(secretKey);
  let offset = 8;
  const salt = encryptedBuffer.subarray(offset, offset + SALT_LENGTH);
  offset += SALT_LENGTH;
  const iv = encryptedBuffer.subarray(offset, offset + IV_LENGTH);
  offset += IV_LENGTH;
  const authTag = encryptedBuffer.subarray(offset, offset + AUTH_TAG_LENGTH);
  offset += AUTH_TAG_LENGTH;
  const ciphertext = encryptedBuffer.subarray(offset);

  const key = crypto.scryptSync(secret, salt, 32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let compressed;
  try {
    compressed = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (err) {
    throw new Error('Clé de déchiffrement invalide ou fichier de sauvegarde altéré (échec AuthTag GCM).');
  }

  const jsonBuffer = zlib.gunzipSync(compressed);
  const parsed = JSON.parse(jsonBuffer.toString('utf-8'));

  // Vérification du checksum SHA-256 interne si présent
  if (parsed.checksum && parsed.data) {
    const computedHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(parsed.data))
      .digest('hex');
    if (computedHash !== parsed.checksum) {
      throw new Error('Échec de vérification du checksum SHA-256 des données.');
    }
  }

  return parsed;
}

/**
 * Retourne le dossier principal des sauvegardes locales
 */
function getPrimaryBackupDir() {
  const dir = process.env.BACKUP_DIR
    ? path.resolve(process.env.BACKUP_DIR)
    : path.resolve(__dirname, '../../database/backups');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Supprime les anciennes sauvegardes automatiques (backup_auto_*.idsbak.enc)
 * au-delà de la limite de rétention (par défaut : 30 fichiers), sans jamais toucher
 * aux fichiers manuels (.json ou autres).
 */
function rotateAutoBackups(dirPath, maxKeep = 30) {
  try {
    if (!fs.existsSync(dirPath)) return 0;
    const files = fs
      .readdirSync(dirPath)
      .filter(f => /^backup_auto_.*\.idsbak\.enc$/i.test(f))
      .map(f => {
        const fullPath = path.join(dirPath, f);
        const stat = fs.statSync(fullPath);
        return { name: f, fullPath, mtimeMs: stat.mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs); // Du plus récent au plus ancien

    if (files.length <= maxKeep) return 0;

    let deleted = 0;
    for (let i = maxKeep; i < files.length; i++) {
      fs.unlinkSync(files[i].fullPath);
      deleted++;
    }
    return deleted;
  } catch (err) {
    console.warn('⚠️ [BackupService] Rotation:', err.message);
    return 0;
  }
}

/**
 * Exporte en LECTURE SEULE (SELECT) les 21 tables de la base de données,
 * les compresse en GZIP, les chiffre en AES-256-GCM et les écrit sur disque.
 */
async function createEncryptedBackup(options = {}) {
  const { prefix = 'backup_auto', secretKey } = options;
  const counts = {};
  const data = {};
  let totalRows = 0;

  for (const item of BACKUP_TABLES) {
    const Model = models[item.modelName];
    if (!Model || typeof Model.findAll !== 'function') {
      counts[item.key] = 0;
      data[item.key] = [];
      continue;
    }
    try {
      const rows = await Model.findAll({ raw: true });
      counts[item.key] = rows.length;
      data[item.key] = rows;
      totalRows += rows.length;
    } catch (tableErr) {
      // Si une table optionnelle n'existe pas encore, ne jamais faire échouer le backup
      counts[item.key] = 0;
      data[item.key] = [];
    }
  }

  const dataJson = JSON.stringify(data);
  const checksum = crypto.createHash('sha256').update(dataJson).digest('hex');

  const payloadObj = {
    version: '1.0',
    format: 'IDSBAK01-AES256GCM-GZIP',
    timestamp: new Date().toISOString(),
    site: process.env.SITE_ID || 'IDS_PRINCIPAL',
    totalTables: BACKUP_TABLES.length,
    totalRows,
    checksum,
    counts,
    data,
  };

  const jsonString = JSON.stringify(payloadObj);
  const rawBytes = Buffer.byteLength(jsonString, 'utf-8');
  const encryptedBuffer = encryptBackupPayload(jsonString, secretKey);

  const now = new Date();
  const datePart = now.toISOString().replace(/[:.]/g, '-');
  const fileName = `${prefix}_${datePart}.idsbak.enc`;

  const primaryDir = getPrimaryBackupDir();
  const primaryFilePath = path.join(primaryDir, fileName);
  fs.writeFileSync(primaryFilePath, encryptedBuffer);

  const retentionCount = parseInt(process.env.BACKUP_RETENTION_COUNT || '30', 10);
  rotateAutoBackups(primaryDir, retentionCount);

  // Copie automatique vers un dossier externe (Clé USB, 2ème PC réseau, OneDrive/Google Drive) si configuré
  let externalFilePath = null;
  if (process.env.BACKUP_EXTERNAL_DIR) {
    try {
      const extDir = path.resolve(process.env.BACKUP_EXTERNAL_DIR);
      if (!fs.existsSync(extDir)) {
        fs.mkdirSync(extDir, { recursive: true });
      }
      externalFilePath = path.join(extDir, fileName);
      fs.writeFileSync(externalFilePath, encryptedBuffer);
      rotateAutoBackups(extDir, retentionCount);
    } catch (extErr) {
      console.warn('⚠️ [BackupService] Impossible de copier vers BACKUP_EXTERNAL_DIR :', extErr.message);
    }
  }

  return {
    fileName,
    primaryFilePath,
    externalFilePath,
    timestamp: payloadObj.timestamp,
    totalTables: BACKUP_TABLES.length,
    totalRows,
    rawSizeBytes: rawBytes,
    encryptedSizeBytes: encryptedBuffer.length,
    compressionRatioPercent: rawBytes > 0 ? Math.round((1 - encryptedBuffer.length / rawBytes) * 100) : 0,
    checksum,
    counts,
  };
}

/**
 * Liste les sauvegardes chiffrées disponibles dans le dossier principal
 */
function listEncryptedBackups() {
  const primaryDir = getPrimaryBackupDir();
  if (!fs.existsSync(primaryDir)) return [];

  return fs
    .readdirSync(primaryDir)
    .filter(f => f.endsWith('.idsbak.enc'))
    .map(f => {
      const fullPath = path.join(primaryDir, f);
      const stat = fs.statSync(fullPath);
      return {
        fileName: f,
        sizeBytes: stat.size,
        sizeKo: Math.round((stat.size / 1024) * 10) / 10,
        createdAt: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Vérifie si une sauvegarde automatique a déjà été créée aujourd'hui (UTC YYYY-MM-DD)
 */
function hasBackupForToday() {
  const todayPrefix = `backup_auto_${new Date().toISOString().slice(0, 10)}`;
  const primaryDir = getPrimaryBackupDir();
  if (!fs.existsSync(primaryDir)) return false;
  return fs.readdirSync(primaryDir).some(f => f.startsWith(todayPrefix) && f.endsWith('.idsbak.enc'));
}

let backupIntervalHandle = null;

/**
 * Démarre le planificateur automatique de sauvegarde quotidienne (1 fois par 24h)
 * sans jamais impacter la vitesse de démarrage du serveur.
 */
function startAutoBackupCron() {
  if (backupIntervalHandle) return;

  // Vérification initiale différée de 10 secondes après le démarrage
  setTimeout(async () => {
    try {
      if (!hasBackupForToday()) {
        const info = await createEncryptedBackup({ prefix: 'backup_auto' });
        console.log(
          `🛡️ [Backup Auto AES-256] Sauvegarde quotidienne créée : ${info.fileName} (${Math.round(
            info.encryptedSizeBytes / 1024
          )} Ko, gain ${info.compressionRatioPercent}%, ${info.totalRows} lignes sur ${info.totalTables} tables)`
        );
      }
    } catch (err) {
      console.warn('⚠️ [Backup Auto AES-256] Erreur lors de la sauvegarde initiale :', err.message);
    }
  }, 10 * 1000);

  // Planification toutes les 24 heures
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  backupIntervalHandle = setInterval(async () => {
    try {
      if (!hasBackupForToday()) {
        const info = await createEncryptedBackup({ prefix: 'backup_auto' });
        console.log(
          `🛡️ [Backup Auto AES-256] Sauvegarde périodique créée : ${info.fileName} (${Math.round(
            info.encryptedSizeBytes / 1024
          )} Ko)`
        );
      }
    } catch (err) {
      console.warn('⚠️ [Backup Auto AES-256] Erreur sauvegarde périodique :', err.message);
    }
  }, TWENTY_FOUR_HOURS_MS);

  if (backupIntervalHandle.unref) {
    backupIntervalHandle.unref();
  }
}

module.exports = {
  BACKUP_TABLES,
  encryptBackupPayload,
  decryptBackupPayload,
  createEncryptedBackup,
  listEncryptedBackups,
  hasBackupForToday,
  startAutoBackupCron,
  getPrimaryBackupDir,
};

