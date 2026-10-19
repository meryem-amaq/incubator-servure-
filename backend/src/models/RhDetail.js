const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RhDetail = sequelize.define('RhDetail', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  incube_id: { type: DataTypes.INTEGER, allowNull: false },
  mois: { type: DataTypes.STRING(50) },
  type_personnel: { type: DataTypes.STRING(100) },
  nom_complet: { type: DataTypes.STRING(200), allowNull: false },
  poste: { type: DataTypes.STRING(150) },
  nature_contrat: { type: DataTypes.STRING(100) },
  date_embauche: { type: DataTypes.DATEONLY },
  date_fin: { type: DataTypes.DATEONLY },
  salaire_mensuel: { type: DataTypes.FLOAT, defaultValue: 0 },
}, { tableName: 'rh_detail' });

module.exports = RhDetail;
