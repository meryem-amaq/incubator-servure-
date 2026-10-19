const mysql = require('mysql2/promise');

async function checkSync() {
  const cloud = await mysql.createConnection({
    uri: process.env.AIVEN_DATABASE_URL || 'mysql://localhost:3306/incubateur_cgs',
    ssl: { rejectUnauthorized: false }
  });
  const local = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '',
    database: 'incubateur_cgs'
  });

  const [tables] = await cloud.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  const tableNames = tables.map(r => Object.values(r)[0]);

  console.log('TABLE                    | CLOUD (Aiven) | LOCAL (XAMPP) | STATUT');
  console.log('-------------------------+---------------+---------------+-------------');
  let totalMatch = true;
  let totalCloudRows = 0;
  let totalLocalRows = 0;

  for (const t of tableNames) {
    const [c] = await cloud.query(`SELECT count(*) as count FROM \`${t}\``);
    const [l] = await local.query(`SELECT count(*) as count FROM \`${t}\``);
    const cc = c[0].count;
    const lc = l[0].count;
    totalCloudRows += cc;
    totalLocalRows += lc;
    const match = cc === lc;
    if (!match) totalMatch = false;
    console.log(`${t.padEnd(24)} | ${String(cc).padStart(13)} | ${String(lc).padStart(13)} | ${match ? '✅ 100% IDENTIQUE' : '❌ DIFFÉRENCE'}`);
  }
  console.log('-------------------------+---------------+---------------+-------------');
  console.log(`TOTAL DES LIGNES         | ${String(totalCloudRows).padStart(13)} | ${String(totalLocalRows).padStart(13)} | ${totalMatch ? '✅ PARFAIT' : '❌ DIFF'}`);
  
  await cloud.end();
  await local.end();
}

checkSync().catch(console.error);
