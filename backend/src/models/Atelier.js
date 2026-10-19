const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Atelier = sequelize.define('Atelier', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  titre: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  formateur: {
    type: DataTypes.STRING(150),
    defaultValue: 'Formateur IDS'
  },
  intervenant: {
    type: DataTypes.STRING(150),
    allowNull: true
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  heureDebut: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: '09:30',
    field: 'heure_debut'
  },
  heureFin: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: '12:30',
    field: 'heure_fin'
  },
  duree: {
    type: DataTypes.STRING(20),
    defaultValue: '3h00'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  statutOuverture: {
    type: DataTypes.ENUM('auto', 'ouvert_force', 'cloture'),
    defaultValue: 'auto',
    field: 'statut_ouverture'
  },
  driveLink: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'drive_link'
  }
}, {
  tableName: 'ateliers',
  timestamps: true,
  underscored: true
});

module.exports = Atelier;
