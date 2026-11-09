const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage();

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.jpg', '.jpeg', '.png', '.webp'
]);

const FORBIDDEN_MIMES = new Set([
  'text/html',
  'application/xhtml+xml',
  'image/svg+xml',
  'application/javascript',
  'text/javascript',
  'application/x-javascript',
  'application/x-msdownload',
  'application/x-sh',
  'text/xml'
]);

/**
 * Vérifie la signature binaire réelle (Magic Bytes) d'un buffer fichier
 * afin d'empêcher le contournement par renommage d'extension ou falsification du Content-Type.
 */
function detectAndValidateMagicBytes(buffer, ext) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
    return { valid: false, reason: 'Fichier vide ou tronqué' };
  }

  // Bloquer systématiquement tout contenu HTML / SVG / Script déguisé
  const headAscii = buffer.subarray(0, Math.min(buffer.length, 512)).toString('utf8').trimStart().toLowerCase();
  if (
    headAscii.startsWith('<!doctype html') ||
    headAscii.startsWith('<html') ||
    headAscii.startsWith('<script') ||
    headAscii.startsWith('<svg') ||
    headAscii.includes('<script')
  ) {
    return { valid: false, reason: 'Contenu actif (HTML/SVG/Script) interdit dans les fichiers importés' };
  }

  const cleanExt = String(ext || '').toLowerCase();

  // JPEG : FF D8 FF
  if (cleanExt === '.jpg' || cleanExt === '.jpeg') {
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { valid: true, mime: 'image/jpeg' };
    }
    return { valid: false, reason: 'Signature binaire JPEG invalide' };
  }

  // PNG : 89 50 4E 47 0D 0A 1A 0A
  if (cleanExt === '.png') {
    if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
      buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
    ) {
      return { valid: true, mime: 'image/png' };
    }
    return { valid: false, reason: 'Signature binaire PNG invalide' };
  }

  // WEBP : RIFF....WEBP
  if (cleanExt === '.webp') {
    if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return { valid: true, mime: 'image/webp' };
    }
    return { valid: false, reason: 'Signature binaire WebP invalide' };
  }

  // PDF : %PDF-
  if (cleanExt === '.pdf') {
    if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
      return { valid: true, mime: 'application/pdf' };
    }
    return { valid: false, reason: 'Signature binaire PDF invalide' };
  }

  // Formats Office modernes (OOXML ZIP : PK\x03\x04) ou anciens (OLE2 : D0 CF 11 E0)
  if (['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'].includes(cleanExt)) {
    const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
    const isOle2 =
      buffer.length >= 8 &&
      buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0;
    if (isZip || isOle2) {
      return { valid: true, mime: 'application/octet-stream' };
    }
    return { valid: false, reason: 'Signature binaire du document Office invalide' };
  }

  return { valid: false, reason: 'Extension de fichier non reconnue' };
}

/**
 * Nettoie une URL / Data-URI de photo pour interdire tout vecteur XSS (javascript:, data:text/html, data:image/svg+xml)
 */
function sanitizePhotoUrl(value) {
  if (value === undefined || value === null || value === '') return null;
  const str = String(value).trim();
  if (/^data:image\/(jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i.test(str)) {
    return str;
  }
  if (/^(\/uploads\/|https?:\/\/)/i.test(str) && !/[<>"'`]/.test(str)) {
    return str;
  }
  return null;
}

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = String(file.mimetype || '').toLowerCase().trim();

  if (FORBIDDEN_MIMES.has(mime)) {
    return cb(new Error('Type MIME dangereux ou non autorisé'), false);
  }
  if (ALLOWED_EXTENSIONS.has(ext)) {
    return cb(null, true);
  }
  cb(new Error('Type de fichier non autorisé'), false);
};

const baseMulter = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 15 * 1024 * 1024,
    fieldSize: 50 * 1024 * 1024, // 50MB pour supporter les images base64 dans les champs texte sans erreur 'Field value too long'
  },
});

const origSingle = baseMulter.single.bind(baseMulter);
baseMulter.single = (fieldName) => {
  const middleware = origSingle(fieldName);
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err.message || 'Fichier refusé' });
      }
      if (req.file && req.file.buffer) {
        const ext = path.extname(req.file.originalname || '').toLowerCase();
        const check = detectAndValidateMagicBytes(req.file.buffer, ext);
        if (!check.valid) {
          return res.status(400).json({ message: `Fichier rejeté par le contrôle de sécurité : ${check.reason}` });
        }
        // Forcer le type MIME certifié par les magic bytes (jamais celui déclaré par le client)
        req.file.mimetype = check.mime;
      }
      next();
    });
  };
};

baseMulter.detectAndValidateMagicBytes = detectAndValidateMagicBytes;
baseMulter.sanitizePhotoUrl = sanitizePhotoUrl;

module.exports = baseMulter;
