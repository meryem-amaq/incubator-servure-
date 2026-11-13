const sequelize = require('../src/config/database');

async function migrate() {
  try {
    await sequelize.authenticate();
    const [cols] = await sequelize.query("SHOW COLUMNS FROM ateliers LIKE 'photos'");
    if (cols.length === 0) {
      await sequelize.query("ALTER TABLE ateliers ADD COLUMN photos JSON NULL AFTER description");
      console.log('Added column photos to ateliers table successfully!');
    } else {
      console.log('Column photos already exists in ateliers.');
    }
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    process.exit(0);
  }
}

migrate();
