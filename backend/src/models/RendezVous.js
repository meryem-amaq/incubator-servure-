const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RendezVous = sequelize.define('RendezVous', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  accompagnateurId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  accompagnateurNom: {
    type: DataTypes.STRING,
    allowNull: true
  },
  incubeIds: {
    type: DataTypes.TEXT, // Liste des IDs d'incubés (JSON ou séparés par virgule)
    allowNull: false
  },
  incubeNoms: {
    type: DataTypes.TEXT, // Liste des noms d'incubés
    allowNull: true
  },
  dateRdv: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  heureRdv: {
    type: DataTypes.STRING,
    allowNull: false
  },
  duree: {
    type: DataTypes.STRING,
    defaultValue: '1h'
  },
  sujet: {
    type: DataTypes.STRING,
    allowNull: false
  },
  commentaireEmail: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  statut: {
    type: DataTypes.ENUM('programme', 'effectue', 'annule'),
    defaultValue: 'programme'
  },
  lieu: {
    type: DataTypes.STRING,
    defaultValue: 'Bureaux Incubateur IDS / Fablab'
  }
}, {
  tableName: 'rendez_vous',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = RendezVous;
