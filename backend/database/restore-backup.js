const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const models = require('../src/models');
const {
  BACKUP_TABLES,
  decryptBackupPayload,
  listEncryptedBackups,
  getPrimaryBackupDir,
} = require('../src/services/backupService');

async function main() {
  const args = process.argv.slice(2);
  const isList = args.includes('--list') || args.length === 0;
  const verifyIdx = args.indexOf('--verify');
  const restoreIdx = args.indexOf('--restore');
  const isConfirm = args.includes('--confirm');

  console.log('================================================================');
  console.log('🔐 OUTIL DE VÉRIFICATION & RESTAURATION DE SAUVEGARDE AES-256');
  console.log('================================================================\n');

  const backups = listEncryptedBackups();

  if (isList && verifyIdx === -1 && restoreIdx === -1) {
    console.log(`📂 Dossier des sauvegardes : ${getPrimaryBackupDir()}`);
    if (backups.length === 0) {
      console.log('⚠️ Aucune sauvegarde chiffrée (.idsbak.enc) trouvée.');
    } else {
      console.log(`✅ ${backups.length} sauvegarde(s) chiffrée(s) disponible(s) :\n`);
      backups.forEach((b, idx) => {
        console.log(`  [${idx + 1}] ${b.fileName}  —  ${b.sizeKo} Ko  (${b.createdAt})`);
      });
    }
    console.log('\nCommandes disponibles :');
    console.log('  • Vérifier l\'intégrité d\'une sauvegarde (sans toucher à la base) :');
    console.log('    node database/restore-backup.js --verify <nom_du_fichier.idsbak.enc>');
    console.log('  • Restaurer une sauvegarde dans la base MySQL :');
    console.log('    node database/restore-backup.js --restore <nom_du_fichier.idsbak.enc> --confirm\n');
    process.exit(0);
  }

  const targetArg = verifyIdx !== -1 ? args[verifyIdx + 1] : args[restoreIdx + 1];
  let filePath = null;

  if (!targetArg || targetArg.startsWith('--')) {
    // Par défaut, prendre la sauvegarde la plus récente pour --verify
    if (verifyIdx !== -1 && backups.length > 0) {
      filePath = path.join(getPrimaryBackupDir(), backups[0].fileName);
    } else {
      console.error('❌ Veuillez préciser le fichier .idsbak.enc à traiter.');
      process.exit(1);
    }
  } else {
    filePath = fs.existsSync(targetArg)
      ? path.resolve(targetArg)
      : path.join(getPrimaryBackupDir(), path.basename(targetArg));
  }

  if (!fs.existsSync(filePath)) {
    console.error(`❌ Fichier introuvable : ${filePath}`);
    process.exit(1);
  }

  console.log(`📄 Lecture et déchiffrement AES-256-GCM de : ${path.basename(filePath)}...`);
  const encryptedBuf = fs.readFileSync(filePath);
  const parsed = decryptBackupPayload(encryptedBuf);

  console.log('✅ Déchiffrement et vérification d\'intégrité (AuthTag GCM + SHA-256) RÉUSSIS !');
  console.log(`   • Date de sauvegarde : ${parsed.timestamp}`);
  console.log(`   • Site               : ${parsed.site || 'IDS_PRINCIPAL'}`);
  console.log(`   • Tables incluses    : ${parsed.totalTables}`);
  console.log(`   • Total d'entrées    : ${parsed.totalRows}`);
  console.log(`   • Empreinte SHA-256  : ${parsed.checksum}\n`);

  if (verifyIdx !== -1) {
    console.log('📊 Détail par table :');
    for (const [key, count] of Object.entries(parsed.counts || {})) {
      console.log(`   - ${key.padEnd(22)} : ${count} ligne(s)`);
    }
    console.log('\n✅ Vérification terminée (aucune modification sur la base de données).');
    process.exit(0);
  }

  if (restoreIdx !== -1) {
    if (!isConfirm) {
      console.warn('⚠️ Mode simulation : ajoutez --confirm pour exécuter réellement la restauration dans MySQL.');
      process.exit(0);
    }

    await models.sequelize.authenticate();
    const t = await models.sequelize.transaction();
    try {
      await models.sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { transaction: t });

      for (const item of BACKUP_TABLES) {
        const Model = models[item.modelName];
        const rows = parsed.data?.[item.key];
        if (!Model || !Array.isArray(rows) || rows.length === 0) continue;

        await Model.bulkCreate(rows, {
          updateOnDuplicate: Object.keys(Model.rawAttributes),
          transaction: t,
        });
        console.log(`   ✓ Table ${item.key} restaurée (${rows.length} lignes)`);
      }

      await models.sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { transaction: t });
      await t.commit();
      console.log('\n🎉 Restauration complète terminée avec succès !');
      process.exit(0);
    } catch (err) {
      await t.rollback();
      console.error('❌ Erreur lors de la restauration (Transaction annulée, base intacte) :', err.message);
      process.exit(1);
    }
  }
}

main().catch(err => {
  console.error('❌ Erreur :', err.message);
  process.exit(1);
});

