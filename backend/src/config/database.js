const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
const path = require('path');
const { Sequelize } = require('sequelize');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const rawDbUrl = process.env.JAWSDB_MARIA_URL || process.env.JAWSDB_URL || process.env.DATABASE_URL;
let dbUrl = rawDbUrl;
if (dbUrl && typeof dbUrl === 'string' && dbUrl.includes('ssl-mode=')) {
  dbUrl = dbUrl.replace(/[?&]ssl-mode=[^&]+/g, '').replace(/\?$/, '');
}

const dialectOptions = dbUrl
  ? { ssl: { require: true, rejectUnauthorized: false } }
  : (process.env.DB_SSL === 'true' ? { ssl: { require: true, rejectUnauthorized: false } } : {});

const sequelize = dbUrl
  ? new Sequelize(dbUrl, {
      dialect: 'mysql',
      dialectOptions,
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
      define: {
        timestamps: true,
        underscored: true,
      },
    })
  : new Sequelize(
      process.env.DB_NAME || 'incubateur_cgs',
      process.env.DB_USER || 'root',
      process.env.DB_PASSWORD || '',
      {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        dialect: 'mysql',
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        pool: {
          max: 10,
          min: 0,
          acquire: 30000,
          idle: 10000,
        },
        define: {
          timestamps: true,
          underscored: true,
        },
      }
    );

module.exports = sequelize;
