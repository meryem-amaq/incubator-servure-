const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nom: { type: DataTypes.STRING(100), allowNull: false },
  prenom: { type: DataTypes.STRING(100), allowNull: false },
  email: { type: DataTypes.STRING(150), allowNull: false, unique: true },
  mot_de_passe: { type: DataTypes.STRING(255), allowNull: false },
  role: {
    type: DataTypes.ENUM('super_admin', 'admin', 'administrateur', 'gestionnaire', 'consultant', 'incube'),
    defaultValue: 'admin',
  },
  photo_url: { type: DataTypes.TEXT('medium'), allowNull: true },
  telephone: { type: DataTypes.STRING(20), allowNull: true },
  actif: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'users' });

module.exports = User;
