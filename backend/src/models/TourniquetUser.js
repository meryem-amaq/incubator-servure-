const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TourniquetUser = sequelize.define('TourniquetUser', {
  badge_id: {
    type: DataTypes.STRING(50),
    primaryKey: true,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING(150),
    allowNull: false,
  },
  cardno: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  type: {
    type: DataTypes.ENUM('Administration', 'Incube', 'Formation', 'Visiteur', 'Prestataire', 'Autre'),
    defaultValue: 'Visiteur',
  },
  device_ip: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
}, {
  tableName: 'tourniquet_users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = TourniquetUser;
