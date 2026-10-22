const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Promotion = sequelize.define('Promotion', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nom: { type: DataTypes.STRING(100), allowNull: false, unique: 'nom_unique' },
  description: { type: DataTypes.STRING(255), allowNull: true },
}, { tableName: 'promotions' });

module.exports = Promotion;
