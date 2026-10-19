const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SuiviEngagement = sequelize.define('SuiviEngagement', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  incube_id: { type: DataTypes.INTEGER, allowNull: false },
  mois: { type: DataTypes.STRING(20) },
  annee: { type: DataTypes.INTEGER },
  moyenne_heures_presence: { type: DataTypes.FLOAT },
  taux_presence_formation: { type: DataTypes.FLOAT },
  initiatives: { type: DataTypes.TEXT },
  observations: { type: DataTypes.TEXT },
}, { tableName: 'suivi_engagement' });

module.exports = SuiviEngagement;
