const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const {
  BACKUP_TABLES,
  encryptBackupPayload,
  decryptBackupPayload,
} = require('../src/services/backupService');

describe('Sauvegarde Sécurisée AES-256-GCM + GZIP (backupService)', () => {
  it('1. Inclut les 21 tables complètes de la plateforme IDS', () => {
    assert.equal(BACKUP_TABLES.length, 21);
    const keys = BACKUP_TABLES.map(t => t.key);
    assert.ok(keys.includes('incubes'));
    assert.ok(keys.includes('users'));
    assert.ok(keys.includes('rh_detail'));
    assert.ok(keys.includes('attendances'));
    assert.ok(keys.includes('ateliers'));
    assert.ok(keys.includes('promotions'));
  });

  it('2. Compresse (GZIP) et chiffre (AES-256-GCM) puis déchiffre avec vérification SHA-256', () => {
    const sampleData = {
      incubes: Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        nom_incube: `Porteur Test ${i + 1}`,
        raison_sociale: `Startup IDS ${i + 1}`,
      })),
      rh_detail: [{ id: 1, nom_complet: 'Salarié Test', type_contrat: 'CDI' }],
    };
    const checksum = crypto.createHash('sha256').update(JSON.stringify(sampleData)).digest('hex');
    const payload = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      totalTables: 21,
      totalRows: 51,
      checksum,
      data: sampleData,
    };

    const rawJson = JSON.stringify(payload);
    const secret = 'cle_test_ultra_secrete_2026';
    const encrypted = encryptBackupPayload(rawJson, secret);

    // Vérifier l'en-tête magique IDSBAK01
    assert.equal(encrypted.subarray(0, 8).toString('ascii'), 'IDSBAK01');
    // Vérifier que la compression + chiffrement réduit fortement la taille sur données répétitives
    assert.ok(encrypted.length < Buffer.byteLength(rawJson, 'utf-8'));

    // Vérifier que le texte en clair n'apparaît nulle part dans le buffer chiffré
    assert.equal(encrypted.includes(Buffer.from('Startup IDS')), false);

    // Déchiffrer et vérifier l'égalité stricte
    const decrypted = decryptBackupPayload(encrypted, secret);
    assert.equal(decrypted.checksum, checksum);
    assert.equal(decrypted.data.incubes.length, 50);
    assert.equal(decrypted.data.rh_detail[0].nom_complet, 'Salarié Test');
  });

  it('3. Rejette le déchiffrement si la clé secrète est incorrecte', () => {
    const rawJson = JSON.stringify({ data: { incubes: [] } });
    const encrypted = encryptBackupPayload(rawJson, 'vraie_cle_secrete');

    assert.throws(
      () => decryptBackupPayload(encrypted, 'mauvaise_cle_pirate'),
      /Clé de déchiffrement invalide ou fichier de sauvegarde altéré/
    );
  });

  it('4. Rejette le fichier si un seul octet chiffré a été modifié (Protection AuthTag GCM)', () => {
    const rawJson = JSON.stringify({ data: { incubes: [{ id: 1 }] } });
    const encrypted = Buffer.from(encryptBackupPayload(rawJson, 'cle_integrite'));

    // Altérer le dernier octet du payload chiffré
    encrypted[encrypted.length - 1] ^= 0xff;

    assert.throws(
      () => decryptBackupPayload(encrypted, 'cle_integrite'),
      /Clé de déchiffrement invalide ou fichier de sauvegarde altéré/
    );
  });
});

