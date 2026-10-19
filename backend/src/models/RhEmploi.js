const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RhEmploi = sequelize.define('RhEmploi', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  incube_id: { type: DataTypes.INTEGER, allowNull: false },
  mois: { type: DataTypes.STRING(20) },
  personnel_permanent: { type: DataTypes.INTEGER, defaultValue: 0 },
  personnel_temporaire: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: 'rh_emploi' });

module.exports = RhEmploi;
