const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PresenceAtelier = sequelize.define('PresenceAtelier', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  atelierId: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'atelier_id'
  },
  incubeId: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'incube_id'
  },
  nom: {
    type: DataTypes.STRING(150),
    allowNull: false,
    defaultValue: '—'
  },
  prenom: {
    type: DataTypes.STRING(150),
    allowNull: true,
    defaultValue: '—'
  },
  ppNumero: {
    type: DataTypes.STRING(100),
    allowNull: true,
    defaultValue: '—',
    field: 'pp_numero'
  },
  email: {
    type: DataTypes.STRING(150),
    allowNull: true
  },
  present: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  time: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  signedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'signed_at'
  }
}, {
  tableName: 'presence_atelier',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['atelier_id', 'incube_id']
    }
  ]
});

module.exports = PresenceAtelier;
