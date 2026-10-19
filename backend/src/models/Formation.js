const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Formation = sequelize.define('Formation', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  incube_id: { type: DataTypes.INTEGER, allowNull: false },
  theme: { type: DataTypes.STRING(200), allowNull: false },
  formateur: { type: DataTypes.STRING(150), allowNull: true },
  heures: { type: DataTypes.FLOAT, defaultValue: 0 },
  date_formation: { type: DataTypes.DATEONLY, allowNull: true },
  presence: { type: DataTypes.STRING(50), allowNull: true },
  attestation: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'formations' });

module.exports = Formation;
