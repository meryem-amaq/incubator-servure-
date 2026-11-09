const fs = require('fs');
const path = require('path');
const mysql = require('../node_modules/mysql2/promise');

const outputFile = path.join(__dirname, 'migration_ids_cgs_to_serveur.sql');

// Tables actives nécessaires pour l'application (dans l'ordre relationnel)
const TABLES_TO_EXPORT = [
  'promotions',
  'users',
  'incubes',
  'gestion_materiel',
  'checklist_materiel',
  'equipement_espace',
  'reservation_espace',
  'ateliers',
  'presence_atelier',
  'formations',
  'rh_emploi',
  'rh_detail',
  'rendez_vous',
  'fiches_suivi',
  'plan_action',
  'analyse_financiere',
  'historique_phases',
  'historique_statuts',
  'suivi_engagement',
  'tourniquet_users',
  'attendances'
];

async function exportDatabase() {
  console.log('=============================================================');
  console.log('🚀 EXPORTATION SÉCURISÉE DE LA BASE LOCALE [ids_cgs]');
  console.log('=============================================================');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '',
      database: 'ids_cgs'
    });
    console.log('✅ Connecté avec succès à MySQL [ids_cgs] !\n');

    await connection.query("SET SESSION sql_mode = 'NO_AUTO_VALUE_ON_ZERO'");

    const writeStream = fs.createWriteStream(outputFile, { encoding: 'utf8' });

    writeStream.write(`-- =============================================================\n`);
    writeStream.write(`-- MIGRATION OFFICIELLE IDS : Copie exacte de ids_cgs vers serveur\n`);
    writeStream.write(`-- Date : ${new Date().toISOString()}\n`);
    writeStream.write(`-- Contient : 58 incubés, 49 RH, 10 623 pointages réels, finances & espaces\n`);
    writeStream.write(`-- =============================================================\n\n`);
    writeStream.write(`SET NAMES utf8mb4;\n`);
    writeStream.write(`SET FOREIGN_KEY_CHECKS = 0;\n`);
    writeStream.write(`SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";\n\n`);

    for (const table of TABLES_TO_EXPORT) {
      process.stdout.write(`⏳ Export de la table [${table}]... `);

      // Structure de la table
      const [createResult] = await connection.query(`SHOW CREATE TABLE \`${table}\``);
      let createTableSql = createResult[0]['Create Table'];

      // Compatibilité MariaDB / MySQL 8
      createTableSql = createTableSql
        .replace(/COLLATE=utf8mb4_0900_ai_ci/gi, 'COLLATE=utf8mb4_unicode_ci')
        .replace(/COLLATE utf8mb4_0900_ai_ci/gi, 'COLLATE utf8mb4_unicode_ci');

      writeStream.write(`-- -------------------------------------------------------------\n`);
      writeStream.write(`-- Structure de la table \`${table}\`\n`);
      writeStream.write(`-- -------------------------------------------------------------\n`);
      writeStream.write(`DROP TABLE IF EXISTS \`${table}\`;\n`);
      writeStream.write(`${createTableSql};\n\n`);

      // Données de la table
      const [rows] = await connection.query(`SELECT * FROM \`${table}\``);
      if (rows.length > 0) {
        writeStream.write(`-- Données de la table \`${table}\` (${rows.length} lignes)\n`);
        writeStream.write(`LOCK TABLES \`${table}\` WRITE;\n`);

        const columns = Object.keys(rows[0]).map(c => `\`${c}\``).join(', ');

        // Pour les tables avec photos base64 (incubes, users), insérer 1 ligne par requête
        // pour éviter tout dépassement de max_allowed_packet dans MySQL
        const chunkSize = (table === 'incubes' || table === 'users') ? 1 : 100;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          const valuesSql = chunk.map(row => {
            const rowValues = Object.values(row).map(val => {
              if (val === null || val === undefined) return 'NULL';
              if (typeof val === 'number') return val;
              if (typeof val === 'boolean') return val ? 1 : 0;
              if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
              if (typeof val === 'object') return `'${JSON.stringify(val).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
              return `'${String(val).replace(/\\/g, "\\\\").replace(/'/g, "''").replace(/\n/g, "\\n").replace(/\r/g, "\\r")}'`;
            });
            return `(${rowValues.join(', ')})`;
          }).join(',\n  ');

          writeStream.write(`INSERT INTO \`${table}\` (${columns}) VALUES\n  ${valuesSql};\n`);
        }

        writeStream.write(`UNLOCK TABLES;\n\n`);
        console.log(`✅ ${rows.length} ligne(s) exportée(s).`);
      } else {
        console.log(`(table vide, structure exportée)`);
      }
    }

    writeStream.write(`SET FOREIGN_KEY_CHECKS = 1;\n`);
    writeStream.end();

    await new Promise(resolve => writeStream.on('finish', resolve));

    const stats = fs.statSync(outputFile);
    console.log('\n=============================================================');
    console.log(`🎉 Fichier de migration généré avec succès !`);
    console.log(`📁 Fichier : ${outputFile}`);
    console.log(`⚖️ Taille  : ${(stats.size / 1024 / 1024).toFixed(2)} Mo`);
    console.log('=============================================================');

  } catch (err) {
    console.error('\n❌ Erreur exportation :', err.message);
  } finally {
    if (connection) await connection.end();
  }
}

exportDatabase();

