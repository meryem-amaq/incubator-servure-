const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const HistoriqueStatut = sequelize.define('HistoriqueStatut', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  incube_id: { type: DataTypes.INTEGER, allowNull: false },
  ancien_statut: { type: DataTypes.STRING(100), allowNull: true },
  nouveau_statut: { type: DataTypes.STRING(100), allowNull: false },
  date_changement: { type: DataTypes.DATEONLY, allowNull: false },
}, { tableName: 'historique_statuts' });

module.exports = HistoriqueStatut;
