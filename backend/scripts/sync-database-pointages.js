const { sequelize } = require('../src/models');

async function syncData() {
  console.log('🔄 1. Importation des identités des badges depuis zdkdb.users vers tourniquet_users...');
  const [zUsers] = await sequelize.query('SELECT badge_id, name, card_no, type FROM zdkdb.users WHERE badge_id IS NOT NULL');
  let tuCount = 0;
  for (const zu of zUsers) {
    const rawType = zu.type || 'Visiteur';
    const validType = ['Administration', 'Incube', 'Formation', 'Visiteur', 'Prestataire', 'Autre'].includes(rawType) ? rawType : 'Autre';
    await sequelize.query(
      'INSERT INTO incubateur_cgs.tourniquet_users (badge_id, name, cardno, type, created_at, updated_at) ' +
      'VALUES (?, ?, ?, ?, NOW(), NOW()) ' +
      'ON DUPLICATE KEY UPDATE name = VALUES(name), cardno = VALUES(cardno), type = VALUES(type), updated_at = NOW()',
      { replacements: [String(zu.badge_id).trim(), zu.name, zu.card_no || null, validType] }
    );
    tuCount++;
  }
  console.log(`✅ ${tuCount} identités de badges enregistrées dans tourniquet_users.`);

  console.log('🔄 2. Rapprochement des badge_id sur les utilisateurs incubateur_cgs.users...');
  const [upUsers] = await sequelize.query(`
    UPDATE incubateur_cgs.users u
    JOIN incubateur_cgs.tourniquet_users tu 
      ON LOWER(TRIM(tu.name)) = LOWER(TRIM(u.prenom)) 
      OR LOWER(TRIM(tu.name)) = LOWER(TRIM(u.nom))
      OR LOWER(TRIM(tu.name)) = LOWER(CONCAT(TRIM(u.prenom), ' ', TRIM(u.nom)))
    SET u.badge_id = tu.badge_id
    WHERE u.badge_id IS NULL
  `);
  console.log('✅ Rapprochement des utilisateurs terminé.');

  console.log('🔄 3. Transfert des pointages depuis platform.attendances vers incubateur_cgs.attendances avec sens strict...');
  await sequelize.query(`
    INSERT INTO incubateur_cgs.attendances (id, user_id, raw_badge_id, time, type, device_ip, created_at)
    SELECT 
      a.id,
      CASE WHEN u.id IS NOT NULL THEN a.user_id ELSE NULL END,
      a.raw_badge_id,
      a.time,
      CASE 
        WHEN a.device_ip IN ('10.0.1.17', '10.0.1.120', '10.0.1.113', '10.0.1.108') THEN 'OUT'
        WHEN a.device_ip IN ('10.0.1.116', '10.0.1.223', '10.0.1.201') THEN 'IN'
        ELSE a.type
      END as type,
      a.device_ip,
      a.created_at
    FROM platform.attendances a
    LEFT JOIN incubateur_cgs.users u ON a.user_id = u.id
    ON DUPLICATE KEY UPDATE 
      type = VALUES(type),
      device_ip = VALUES(device_ip),
      user_id = VALUES(user_id)
  `);

  const [attCount] = await sequelize.query('SELECT count(*) as c FROM incubateur_cgs.attendances');
  console.log(`📊 Total de pointages dans incubateur_cgs.attendances : ${attCount[0].c}`);

  const [byType] = await sequelize.query(`
    SELECT device_ip, type, count(*) as count 
    FROM incubateur_cgs.attendances 
    GROUP BY device_ip, type 
    ORDER BY device_ip, type
  `);
  console.log('📊 Répartition stricte des pointages par borne IP :');
  console.table(byType);

  console.log('🎉 Synchronisation terminée avec succès !');
  process.exit(0);
}

syncData().catch(err => {
  console.error('❌ Erreur lors de la synchronisation :', err);
  process.exit(1);
});
