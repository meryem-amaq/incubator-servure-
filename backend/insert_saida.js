const mysql = require('mysql2/promise');

async function insertSaida() {
  const connLocal = await mysql.createConnection({
    host: 'localhost',
    port: 3307,
    user: 'root',
    password: '',
    database: 'incubateur_cgs'
  });

  try {
    await connLocal.query('SET GLOBAL max_allowed_packet=67108864');
  } catch (e) {
    console.log('Set global note:', e.message);
  }

  const aivenUrl = process.env.AIVEN_DATABASE_URL || 'mysql://localhost:3306/incubateur_cgs';
  const connAiven = await mysql.createConnection(aivenUrl);
  const [rows] = await connAiven.query('SELECT * FROM incubes WHERE id = 28');
  const saida = rows[0];

  const [cols] = await connLocal.query('SHOW COLUMNS FROM incubes');
  const colNames = cols.map(c => c.Field).filter(c => saida[c] !== undefined);
  
  // Reconnecter pour prendre en compte le nouveau max_allowed_packet si besoin
  const connLocal2 = await mysql.createConnection({
    host: 'localhost',
    port: 3307,
    user: 'root',
    password: '',
    database: 'incubateur_cgs'
  });

  const placeholders = colNames.map(() => '?').join(', ');
  const values = colNames.map(c => saida[c]);

  try {
    await connLocal2.query(`INSERT INTO incubes (${colNames.map(c => `\`${c}\``).join(', ')}) VALUES (${placeholders})`, values);
    console.log('✅ Saida ABOUDOURIB insérée avec succès !');
  } catch (err) {
    console.log('Tentative sans le gros photo_path si max_allowed_packet bloque...');
    const valuesNoPhoto = colNames.map(c => (c === 'photo_path' ? null : saida[c]));
    await connLocal2.query(`INSERT INTO incubes (${colNames.map(c => `\`${c}\``).join(', ')}) VALUES (${placeholders})`, valuesNoPhoto);
    console.log('✅ Saida ABOUDOURIB insérée avec succès (photo_path = null) !');
  }

  const [[{ count }]] = await connLocal2.query('SELECT COUNT(*) as count FROM incubes');
  console.log('Total incubés en local désormais :', count);

  await connAiven.end();
  await connLocal.end();
  await connLocal2.end();
}

insertSaida().catch(console.error);
