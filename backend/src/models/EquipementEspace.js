const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const EquipementEspace = sequelize.define('EquipementEspace', {
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
  nom: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  numeroSerie: {
    type: DataTypes.STRING(150),
    allowNull: true,
    field: 'numero_serie'
  },
  categorie: {
    type: DataTypes.STRING(100),
    defaultValue: 'Général'
  },
  salle: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  desc: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  etatAvant: {
    type: DataTypes.STRING(255),
    defaultValue: 'Opérationnel / Parfait état',
    field: 'etat_avant'
  },
  etatApres: {
    type: DataTypes.STRING(255),
    defaultValue: 'Conforme & Rendu propre',
    field: 'etat_apres'
  },
  incidents: {
    type: DataTypes.TEXT('long'),
    allowNull: true,
    get() {
      const rawValue = this.getDataValue('incidents');
      if (!rawValue) return [];
      try {
        return typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
      } catch {
        return [];
      }
    },
    set(val) {
      this.setDataValue('incidents', typeof val === 'string' ? val : JSON.stringify(val || []));
    }
  }
}, {
  tableName: 'equipement_espace',
  timestamps: true
});

module.exports = EquipementEspace;
