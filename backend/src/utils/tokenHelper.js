const crypto = require('crypto');

/**
 * Récupère le secret de signature depuis les variables d'environnement.
 */
function getSecret() {
  return process.env.SYNC_SECRET || process.env.CONFIRMATION_SECRET || 'ids_secret_sync_key_987654321_secure';
}

/**
 * Génère un token cryptographique signé HMAC-SHA256 à usage unique
 * @param {Object} params
 * @param {string|number} params.reservationId - ID ou identifiant unique de réservation
 * @param {string} params.action - 'valide' ou 'refuse'
 * @param {string} params.email - Email de l'accompagnateur ou administrateur
 * @param {number} [params.expiresInHours=48] - Durée de validité en heures (défaut: 48h)
 * @returns {string} Token sécurisé au format URL-safe (payloadBase64.signature)
 */
function generateConfirmationToken({ reservationId, action, email, expiresInHours = 48 }) {
  const secret = getSecret();
  const exp = Math.floor(Date.now() / 1000) + (expiresInHours * 3600);
  const nonce = crypto.randomBytes(6).toString('hex');

  const payload = {
    rid: String(reservationId),
    act: action === 'refuse' ? 'refuse' : 'valide',
    eml: email ? String(email).trim().toLowerCase() : '',
    exp,
    nonce
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');

  return `${payloadStr}.${signature}`;
}

/**
 * Vérifie et décode un token de confirmation avec protection contre les attaques temporelles
 * @param {string} token - Token reçu dans l'URL
 * @returns {{ valid: boolean, payload?: Object, error?: string }}
 */
function verifyConfirmationToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return { valid: false, error: 'Format de token invalide' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Format de token invalide' };
  }

  const [payloadStr, signature] = parts;
  const secret = getSecret();
  const expectedSig = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSig);

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return { valid: false, error: 'Signature de sécurité invalide ou lien corrompu' };
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      return { valid: false, error: 'Ce lien de confirmation a expiré (validité de 48h dépassée)' };
    }

    return { valid: true, payload };
  } catch (err) {
    return { valid: false, error: 'Données du token illisibles' };
  }
}

module.exports = {
  generateConfirmationToken,
  verifyConfirmationToken
};
