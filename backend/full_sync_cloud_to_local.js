const { Sequelize } = require('sequelize');
require('dotenv').config();

const cloudUrl = process.env.AIVEN_DATABASE_URL || 'mysql://localhost:3306/incubateur_cgs';
const seqCloud = new Sequelize(cloudUrl, {
  dialect: 'mysql',
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  logging: false,
  pool: { max: 5, min: 0, acquire: 60000, idle: 10000 }
});

const seqLocal = new Sequelize(
  process.env.DB_NAME || 'incubateur_cgs',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3307,
    dialect: 'mysql',
    logging: false,
    pool: { max: 5, min: 0, acquire: 60000, idle: 10000 }
  }
);

async function runFullSync() {
  console.log("=============================================================");
  console.log("🚀 SYNCHRONISATION COMPLÈTE : CLOUD AIVEN -> LOCAL (PORT 3307)");
  console.log("=============================================================");

  try {
    await seqCloud.authenticate();
    console.log("✅ Connecté à la base Cloud (Aiven)");
    await seqLocal.authenticate();
    console.log("✅ Connecté à la base Locale (MariaDB/MySQL)");

    // 1. Désactiver les contraintes de clés étrangères GLOBALEMENT et localement
    await seqLocal.query('SET GLOBAL FOREIGN_KEY_CHECKS = 0;');
    await seqLocal.query('SET FOREIGN_KEY_CHECKS = 0;');
    await seqLocal.query('SET GLOBAL max_allowed_packet = 1073741824;');
    console.log("🛡️ Clés étrangères désactivées globalement pour l'importation.");

    // 2. Création des tables manquantes
    console.log("\n📦 Étape 1 : Vérification de la création des tables manquantes...");
    await seqLocal.query(`
      CREATE TABLE IF NOT EXISTS \`historique_statuts\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`incube_id\` int NOT NULL,
        \`ancien_statut\` varchar(100) DEFAULT NULL,
        \`nouveau_statut\` varchar(100) NOT NULL,
        \`date_changement\` date NOT NULL,
        \`created_at\` datetime NOT NULL,
        \`updated_at\` datetime NOT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`incube_id\` (\`incube_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("   -> Table historique_statuts prête.");

    // 3. Mise à jour des colonnes manquantes
    console.log("\n🔧 Étape 2 : Harmonisation des colonnes locales...");
    const columnUpdates = [
      { table: 'promotions', col: 'created_at', type: 'DATETIME NULL' },
      { table: 'promotions', col: 'updated_at', type: 'DATETIME NULL' },
      { table: 'checklist_materiel', col: 'created_at', type: 'DATETIME NULL' },
      { table: 'checklist_materiel', col: 'updated_at', type: 'DATETIME NULL' },
      { table: 'formations', col: 'heures', type: 'FLOAT DEFAULT 0' },
      { table: 'fiches_suivi', col: 'numero_ordre', type: 'VARCHAR(50) NULL' },
      { table: 'fiches_suivi', col: 'statut_juridique', type: 'VARCHAR(100) NULL' },
      { table: 'fiches_suivi', col: 'anomalie_signalee', type: 'TEXT NULL' },
      { table: 'fiches_suivi', col: 'declaration_echec', type: 'TEXT NULL' },
    ];

    for (const update of columnUpdates) {
      try {
        const [existing] = await seqLocal.query(`SHOW COLUMNS FROM \`${update.table}\` LIKE '${update.col}'`);
        if (existing.length === 0) {
          await seqLocal.query(`ALTER TABLE \`${update.table}\` ADD COLUMN \`${update.col}\` ${update.type}`);
          console.log(`   -> Colonne ajoutée : ${update.table}.${update.col}`);
        } else {
          console.log(`   -> Colonne déjà présente : ${update.table}.${update.col}`);
        }
      } catch (err) {
        console.warn(`   ⚠️ Colonne ${update.table}.${update.col} : ${err.message}`);
      }
    }

    // 4. Liste ordonnée des 19 tables à copier
    const tables = [
      'users',
      'promotions',
      'incubes',
      'ateliers',
      'presence_atelier',
      'equipement_espace',
      'reservation_espace',
      'checklist_materiel',
      'rendez_vous',
      'fiches_suivi',
      'formations',
      'analyse_financiere',
      'gestion_materiel',
      'plan_action',
      'rh_detail',
      'rh_emploi',
      'suivi_engagement',
      'historique_phases',
      'historique_statuts'
    ];

    console.log("\n📥 Étape 3 : Copie des données (Cloud -> Local)...");

    for (const table of tables) {
      process.stdout.write(`   Table [${table}]... `);
      const [remoteRows] = await seqCloud.query(`SELECT * FROM \`${table}\``);

      // Vider la table locale
      await seqLocal.query(`DELETE FROM \`${table}\``);

      if (remoteRows.length === 0) {
        console.log(`0 enregistrement.`);
        continue;
      }

      // Obtenir les colonnes réelles de la table locale pour filtrer si besoin
      const [localCols] = await seqLocal.query(`SHOW COLUMNS FROM \`${table}\``);
      const allowedCols = new Set(localCols.map(c => c.Field));

      let insertedCount = 0;
      for (const row of remoteRows) {
        const fields = [];
        const values = [];

        for (const [key, val] of Object.entries(row)) {
          if (!allowedCols.has(key)) continue;
          fields.push(`\`${key}\``);

          if (val === null || val === undefined) {
            values.push('NULL');
          } else if (typeof val === 'string') {
            values.push(seqLocal.escape(val));
          } else if (val instanceof Date) {
            values.push(seqLocal.escape(val.toISOString().slice(0, 19).replace('T', ' ')));
          } else if (typeof val === 'object') {
            values.push(seqLocal.escape(JSON.stringify(val)));
          } else if (typeof val === 'boolean') {
            values.push(val ? 1 : 0);
          } else {
            values.push(val);
          }
        }

        const sql = `INSERT INTO \`${table}\` (${fields.join(', ')}) VALUES (${values.join(', ')})`;
        try {
          await seqLocal.query(sql);
          insertedCount++;
        } catch (insertErr) {
          console.error(`\n   ❌ Erreur sur ligne table ${table}:`, insertErr.message);
        }
      }

      console.log(`✅ ${insertedCount}/${remoteRows.length} copiés.`);
    }

    // 5. Réactivation des clés étrangères
    await seqLocal.query('SET GLOBAL FOREIGN_KEY_CHECKS = 1;');
    await seqLocal.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log("\n🛡️ Clés étrangères réactivées avec succès.");

    // 6. Vérification finale des totaux
    console.log("\n=============================================================");
    console.log("📊 VÉRIFICATION FINALE DES TOTAUX (Cloud vs Local)");
    console.log("=============================================================");
    let allMatches = true;
    for (const table of tables) {
      const [resCloud] = await seqCloud.query(`SELECT count(*) as count FROM \`${table}\``);
      const [resLocal] = await seqLocal.query(`SELECT count(*) as count FROM \`${table}\``);
      const c = resCloud[0].count;
      const l = resLocal[0].count;
      const isMatch = c === l;
      if (!isMatch) allMatches = false;
      const status = isMatch ? '✅ 100% CONFORME' : '⚠️ DIFFÉRENCE';
      console.log(`   ${table.padEnd(22)} : Cloud = ${String(c).padStart(4)} | Local = ${String(l).padStart(4)} -> ${status}`);
    }

    if (allMatches) {
      console.log("\n🎉 TOUTES LES DONNÉES ET TABLES SONT 100% IDENTIQUES ET SYNCHRONISÉES !");
    } else {
      console.log("\n⚠️ Synchronisation terminée avec quelques différences.");
    }

  } catch (err) {
    console.error("❌ ERREUR FATALE DE SYNCHRONISATION:", err);
  } finally {
    try {
      await seqLocal.query('SET GLOBAL FOREIGN_KEY_CHECKS = 1;');
      await seqLocal.query('SET FOREIGN_KEY_CHECKS = 1;');
    } catch(e){}
    await seqCloud.close();
    await seqLocal.close();
  }
}

runFullSync();
