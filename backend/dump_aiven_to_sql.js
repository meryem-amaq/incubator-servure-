/**
 * Script d'exportation de la base de données Aiven vers un fichier .sql
 * Compatible MySQL 8 et MariaDB (XAMPP)
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

// Récupération des identifiants Aiven depuis l'URL ou les variables
const cloudUrl = process.env.AIVEN_DATABASE_URL || process.env.DATABASE_URL || 'mysql://localhost:3306/incubateur_cgs';

async function exportDatabase() {
  const outputFile = path.join(__dirname, '..', 'backup_aiven.sql');
  console.log("=============================================================");
  console.log("🚀 TÉLÉCHARGEMENT DE LA BASE DE DONNÉES DEPUIS AIVEN");
  console.log("=============================================================");

  let connection;
  try {
    console.log("📡 Connexion au serveur Aiven...");
    connection = await mysql.createConnection({
      uri: cloudUrl,
      ssl: { rejectUnauthorized: false }
    });
    console.log("✅ Connecté avec succès à Aiven !");

    // Désactiver ANSI_QUOTES sur la session Aiven pour que SHOW CREATE TABLE produise des backticks ` ` au lieu de guillemets " "
    await connection.query("SET SESSION sql_mode = 'NO_AUTO_VALUE_ON_ZERO'");

    const writeStream = fs.createWriteStream(outputFile, { encoding: 'utf8' });

    // En-têtes SQL
    writeStream.write(`-- =============================================================\n`);
    writeStream.write(`-- Export de la base de données Aiven : defaultdb\n`);
    writeStream.write(`-- Date : ${new Date().toISOString()}\n`);
    writeStream.write(`-- =============================================================\n\n`);
    writeStream.write(`SET NAMES utf8mb4;\n`);
    writeStream.write(`SET FOREIGN_KEY_CHECKS = 0;\n`);
    writeStream.write(`SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";\n\n`);

    // Récupération de la liste des tables
    const [tablesResult] = await connection.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
    const orderedPredefined = [
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
    const tables = tablesResult
      .map(r => Object.values(r)[0])
      .sort((a, b) => {
        const ia = orderedPredefined.indexOf(a);
        const ib = orderedPredefined.indexOf(b);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.localeCompare(b);
      });
    console.log(`📋 ${tables.length} tables détectées à exporter dans l'ordre relationnel.\n`);

    for (const table of tables) {
      process.stdout.write(`⏳ Export de la table [${table}]... `);

      // Structure de la table
      const [createResult] = await connection.query(`SHOW CREATE TABLE \`${table}\``);
      let createTableSql = createResult[0]['Create Table'];
      
      // Assurer la compatibilité XAMPP (MariaDB 10.x ne supporte pas le collation MySQL 8 utf8mb4_0900_ai_ci)
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

        // Insérer par paquets de 100 lignes
        const chunkSize = 100;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          const valuesSql = chunk.map(row => {
            const rowValues = Object.values(row).map(val => {
              if (val === null || val === undefined) return 'NULL';
              if (typeof val === 'number') return val;
              if (typeof val === 'boolean') return val ? 1 : 0;
              if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
              if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''").replace(/\\/g, "\\\\")}'`;
              return `'${String(val).replace(/\\/g, "\\\\").replace(/'/g, "''").replace(/\n/g, "\\n").replace(/\r/g, "\\r")}'`;
            });
            return `(${rowValues.join(', ')})`;
          }).join(',\n  ');

          writeStream.write(`INSERT INTO \`${table}\` (${columns}) VALUES\n  ${valuesSql};\n`);
        }

        writeStream.write(`UNLOCK TABLES;\n\n`);
        console.log(`✅ ${rows.length} lignes exportées.`);
      } else {
        console.log(`(vide)`);
      }
    }

    writeStream.write(`SET FOREIGN_KEY_CHECKS = 1;\n`);
    writeStream.end();

    await new Promise(resolve => writeStream.on('finish', resolve));

    // Si incubation.sql existe ou est utilisé, synchroniser également
    const incubationFile = path.join(__dirname, '..', 'incubation.sql');
    try {
      fs.copyFileSync(outputFile, incubationFile);
    } catch (_) {}

    console.log("\n=============================================================");
    console.log(`🎉 Téléchargement terminé avec succès !`);
    console.log(`📁 Fichier généré : ${outputFile}`);
    console.log(`📁 Fichier synchronisé : ${incubationFile}`);
    console.log("=============================================================");

  } catch (err) {
    console.error("\n❌ Erreur lors du téléchargement :", err.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

exportDatabase();
