const { sequelize } = require('../src/models');

async function cleanAttendances() {
  console.log('--- Nettoyage et dédoublonnage de la table attendances ---');

  // 1. Compter les lignes actuelles
  const [initialCountRes] = await sequelize.query('SELECT COUNT(*) as cnt FROM attendances');
  const initialCount = initialCountRes[0].cnt;
  console.log(`Lignes actuelles dans attendances : ${initialCount}`);

  // 2. Créer la table temporaire propre
  await sequelize.query('DROP TABLE IF EXISTS attendances_clean');
  await sequelize.query(`
    CREATE TABLE attendances_clean (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id INT NULL,
      raw_badge_id VARCHAR(50) NOT NULL,
      time DATETIME NOT NULL,
      type ENUM('IN','OUT') DEFAULT 'IN',
      device_ip VARCHAR(45) NOT NULL,
      created_at DATETIME NOT NULL,
      INDEX idx_att_time (time),
      INDEX idx_att_raw_badge (raw_badge_id),
      INDEX idx_att_user_id (user_id),
      UNIQUE KEY uq_scan (raw_badge_id, time, device_ip)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log('Extraction et insertion des pointages uniques...');
  await sequelize.query(`
    INSERT IGNORE INTO attendances_clean (id, user_id, raw_badge_id, time, type, device_ip, created_at)
    SELECT 
      MIN(id) AS id,
      MAX(user_id) AS user_id,
      raw_badge_id,
      time,
      MAX(type) AS type,
      device_ip,
      MIN(created_at) AS created_at
    FROM attendances
    GROUP BY raw_badge_id, time, device_ip
    ORDER BY time ASC
  `);

  const [cleanCountRes] = await sequelize.query('SELECT COUNT(*) as cnt FROM attendances_clean');
  const cleanCount = cleanCountRes[0].cnt;
  console.log(`✅ Pointages uniques insérés dans attendances_clean : ${cleanCount} (Doublons supprimés : ${initialCount - cleanCount})`);

  if (cleanCount === 0 && initialCount > 0) {
    throw new Error('Sécurité : attendances_clean est vide alors que la table originale contenait des données. Annulation.');
  }

  // 3. Basculer les tables en sécurité
  console.log('Bascule sécurisée des tables...');
  await sequelize.query('DROP TABLE IF EXISTS attendances_old_backup');
  await sequelize.query('RENAME TABLE attendances TO attendances_old_backup, attendances_clean TO attendances');

  // 4. Vérifier la nouvelle table attendances
  const [finalCountRes] = await sequelize.query('SELECT COUNT(*) as cnt FROM attendances');
  console.log(`🎉 SUCCÈS : La table attendances est maintenant parfaitement propre avec ${finalCountRes[0].cnt} enregistrements indexés.`);
  console.log('Une copie de sécurité complète est conservée dans attendances_old_backup.');
  process.exit(0);
}

cleanAttendances().catch(err => {
  console.error('❌ Erreur lors du nettoyage:', err);
  process.exit(1);
});

