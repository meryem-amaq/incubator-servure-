const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PlanAction = sequelize.define('PlanAction', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  incube_id: { type: DataTypes.INTEGER, allowNull: false },
  rendezvous_id: { type: DataTypes.INTEGER, allowNull: true },
  mois: { type: DataTypes.STRING(20) },
  objectifs: { type: DataTypes.TEXT },
  date_debut: { type: DataTypes.DATEONLY },
  echeance: { type: DataTypes.DATEONLY },
  realisation: { type: DataTypes.STRING(100) },
  problemes_rencontres: { type: DataTypes.TEXT },
  commentaires: { type: DataTypes.TEXT },
}, { tableName: 'plan_action' });

module.exports = PlanAction;
