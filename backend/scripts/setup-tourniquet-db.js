
const sequelize = require('../src/config/database');

async function run() {
  try {
    const qi = sequelize.getQueryInterface();
    const userCols = await qi.describeTable('users');
    if (!userCols.type) {
      console.log('Adding column `type` to users...');
      await sequelize.query("ALTER TABLE users ADD COLUMN type VARCHAR(50) DEFAULT 'Incube'");
    } else {
      console.log('Column `type` already exists in users.');
    }

    if (!userCols.badge_id) {
      console.log('Adding column `badge_id` to users...');
      await sequelize.query("ALTER TABLE users ADD COLUMN badge_id VARCHAR(50) NULL");
    } else {
      console.log('Column `badge_id` already exists in users.');
    }

    const incubeCols = await qi.describeTable('incubes');
    if (!incubeCols.badge_id) {
      console.log('Adding column `badge_id` to incubes...');
      await sequelize.query("ALTER TABLE incubes ADD COLUMN badge_id VARCHAR(50) NULL");
    } else {
      console.log('Column `badge_id` already exists in incubes.');
    }

    // Set default user types based on role if not set
    await sequelize.query(`
      UPDATE users SET type = 
        CASE 
          WHEN role IN ('super_admin', 'admin', 'administrateur', 'gestionnaire') THEN 'Administration'
          WHEN role = 'consultant' THEN 'Formation'
          WHEN role = 'incube' THEN 'Incube'
          ELSE 'Incube'
        END
      WHERE type IS NULL OR type = '' OR type = 'Incube'
    `);

    console.log('✅ Database migration for Tourniquets completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration error:', err);
    process.exit(1);
  }
}

run();
