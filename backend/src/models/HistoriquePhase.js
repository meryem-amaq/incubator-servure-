const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const HistoriquePhase = sequelize.define('HistoriquePhase', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  incube_id: { type: DataTypes.INTEGER, allowNull: false },
  ancienne_phase: { type: DataTypes.STRING(100), allowNull: true },
  nouvelle_phase: { type: DataTypes.STRING(100), allowNull: false },
  date_changement: { type: DataTypes.DATEONLY, allowNull: false },
}, { tableName: 'historique_phases' });

module.exports = HistoriquePhase;
