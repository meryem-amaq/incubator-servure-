const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GestionMateriel = sequelize.define('GestionMateriel', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  incube_id: { type: DataTypes.INTEGER, allowNull: false },
  type_origine: { type: DataTypes.ENUM('propre', 'ids'), defaultValue: 'propre' },
  date_acquisition_reception: { type: DataTypes.DATEONLY },
  article: { type: DataTypes.STRING(255) },
  numero_serie: { type: DataTypes.STRING(150), allowNull: true },
  caracteristiques_serie: { type: DataTypes.TEXT },
  quantite: { type: DataTypes.INTEGER, defaultValue: 1 },
  secteur_action: { type: DataTypes.STRING(150) },
  valeur: { type: DataTypes.STRING(100) },
  etat: { type: DataTypes.STRING(100) },
}, { tableName: 'gestion_materiel' });

module.exports = GestionMateriel;
