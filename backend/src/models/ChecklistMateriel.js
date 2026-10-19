const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ChecklistMateriel = sequelize.define('ChecklistMateriel', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  reservation_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  equipement_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  etat_avant: {
    type: DataTypes.STRING(255),
    defaultValue: 'Opérationnel / Parfait état'
  },
  etat_apres: {
    type: DataTypes.STRING(255),
    defaultValue: 'Conforme & Rendu propre'
  },
  signaler_probleme: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  commentaire: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'checklist_materiel',
  timestamps: true
});

module.exports = ChecklistMateriel;
