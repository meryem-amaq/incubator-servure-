const sequelize = require('../src/config/database');

async function migrate() {
  try {
    await sequelize.authenticate();
    const [cols] = await sequelize.query("SHOW COLUMNS FROM incubes LIKE 'cible'");
    if (cols.length === 0) {
      await sequelize.query("ALTER TABLE incubes ADD COLUMN cible VARCHAR(255) NULL AFTER phase_projet");
      console.log('Added column cible to incubes table successfully!');
    } else {
      console.log('Column cible already exists.');
    }
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    process.exit(0);
  }
}

migrate();
