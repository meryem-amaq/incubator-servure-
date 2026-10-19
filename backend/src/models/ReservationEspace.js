const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ReservationEspace = sequelize.define('ReservationEspace', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    espace: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'fablab'
    },
    salleSpecifique: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'salle_specifique'
    },
    incubeId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    nomIncube: {
      type: DataTypes.STRING,
      allowNull: false
    },
    emailIncube: {
      type: DataTypes.STRING,
      allowNull: true
    },
    telephoneIncube: {
      type: DataTypes.STRING,
      allowNull: true
    },
    dateReservation: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    heureDebut: {
      type: DataTypes.STRING,
      allowNull: false
    },
    heureFin: {
      type: DataTypes.STRING,
      allowNull: false
    },
    duree: {
      type: DataTypes.STRING,
      defaultValue: '2h'
    },
    motifUtilisation: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    statut: {
      type: DataTypes.ENUM('en_attente', 'valide', 'refuse'),
      defaultValue: 'en_attente'
    },
    motifRefus: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    etatAvant: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    etatApres: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    equipementsUtilises: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'reservation_espace',
    timestamps: true
  });

module.exports = ReservationEspace;
