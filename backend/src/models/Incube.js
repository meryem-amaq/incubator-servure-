const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Incube = sequelize.define('Incube', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: true, unique: true },
  admin_id: { type: DataTypes.INTEGER, allowNull: true },
  photo_path: { type: DataTypes.TEXT('medium') },
  pp_numero: { type: DataTypes.STRING(50) },
  nom_incube: { type: DataTypes.STRING(200), allowNull: false },
  email: { type: DataTypes.STRING(150), allowNull: true },
  telephone: { type: DataTypes.STRING(50), allowNull: true },
  situation_familiale: { type: DataTypes.STRING(100) },
  accompagnateur: { type: DataTypes.STRING(200) },
  date_demarrage: { type: DataTypes.DATEONLY },
  statut_juridique: { type: DataTypes.STRING(100) },
  raison_sociale: { type: DataTypes.STRING(200) },
  rc: { type: DataTypes.STRING(100) },
  phase_projet: { type: DataTypes.STRING(100) },
  province: { type: DataTypes.STRING(100) },
  ville: { type: DataTypes.STRING(100) },
  genre: { type: DataTypes.STRING(50) },
  secteur_activite: { type: DataTypes.STRING(150) },
  promotion: { type: DataTypes.STRING(100), allowNull: true },
  age: { type: DataTypes.STRING(100) },
  date_naissance: { type: DataTypes.DATEONLY },
  niveau_etude: { type: DataTypes.STRING(150) },
  associes: { 
    type: DataTypes.JSON,
    get() {
      const raw = this.getDataValue('associes');
      if (!raw) return [];
      if (Array.isArray(raw)) return raw;
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
          return [];
        }
      }
      return [];
    },
    set(val) {
      if (typeof val === 'string') {
        try {
          this.setDataValue('associes', JSON.parse(val));
        } catch (e) {
          this.setDataValue('associes', []);
        }
      } else {
        this.setDataValue('associes', Array.isArray(val) ? val : []);
      }
    }
  },
}, { tableName: 'incubes' });

module.exports = Incube;
