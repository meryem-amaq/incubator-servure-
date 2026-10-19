const { Sequelize } = require('sequelize');
const remoteUrl = process.env.AIVEN_DATABASE_URL || 'mysql://localhost:3306/incubateur_cgs';
const remoteSeq = new Sequelize(remoteUrl, { dialect: 'mysql', dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }, logging: false });

async function clean() {
  try {
    const [tables] = await remoteSeq.query('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);
    
    for (const table of tableNames) {
      const [indexes] = await remoteSeq.query(`SHOW INDEX FROM ${table}`);
      // Drop keys like email_2, incubes_ibfk_1_2, etc
      const dropIndexes = indexes.filter(i => i.Key_name.match(/_\d+$/));
      
      const uniqueToDrop = [...new Set(dropIndexes.map(i => i.Key_name))];
      
      for (const idxName of uniqueToDrop) {
         try {
           await remoteSeq.query(`ALTER TABLE ${table} DROP INDEX ${idxName}`);
           console.log(`Dropped index ${idxName} on ${table}`);
         } catch(e) {
           console.log(`Failed to drop ${idxName} on ${table}: ${e.message}`);
         }
      }
    }
  } catch(e) {
    console.error(e);
  } finally {
    remoteSeq.close();
  }
}

clean();
