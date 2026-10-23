const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FicheSuivi = sequelize.define('FicheSuivi', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  incube_id: { type: DataTypes.INTEGER, allowNull: false },
  rendezvous_id: { type: DataTypes.INTEGER, allowNull: true },
  numero_ordre: { type: DataTypes.STRING(50), allowNull: true },
  date_suivi: { type: DataTypes.DATEONLY, allowNull: true },
  objet_reunion: { type: DataTypes.STRING(255), allowNull: true },
  statut_juridique: { type: DataTypes.STRING(100), allowNull: true },
  statut_avancement: { type: DataTypes.STRING(100), allowNull: true },
  anomalie_signalee: { type: DataTypes.TEXT, allowNull: true },
  declaration_echec: { type: DataTypes.TEXT, allowNull: true },
  observations: { type: DataTypes.TEXT, allowNull: true },
  type_interaction: { type: DataTypes.STRING(100), allowNull: true },
}, { tableName: 'fiches_suivi' });

module.exports = FicheSuivi;

