const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AnalyseFinanciere = sequelize.define('AnalyseFinanciere', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  incube_id: { type: DataTypes.INTEGER, allowNull: false },
  mois: { type: DataTypes.INTEGER, validate: { min: 1, max: 12 } },
  annee: { type: DataTypes.INTEGER },
  ventes: { type: DataTypes.FLOAT, defaultValue: 0 },
  autres_revenus: { type: DataTypes.FLOAT, defaultValue: 0 },
  achats: { type: DataTypes.FLOAT, defaultValue: 0 },
  charges_personnel: { type: DataTypes.FLOAT, defaultValue: 0 },
  charges_cnss: { type: DataTypes.FLOAT, defaultValue: 0 },
  salaire_porteur: { type: DataTypes.FLOAT, defaultValue: 0 },
  loyer_coworking: { type: DataTypes.FLOAT, defaultValue: 0 },
  eau_electricite: { type: DataTypes.FLOAT, defaultValue: 0 },
  transport: { type: DataTypes.FLOAT, defaultValue: 0 },
  telephone: { type: DataTypes.FLOAT, defaultValue: 0 },
  taxes: { type: DataTypes.FLOAT, defaultValue: 0 },
  tva: { type: DataTypes.FLOAT, defaultValue: 0 },
  remboursement_credit: { type: DataTypes.FLOAT, defaultValue: 0 },
  autres_charges: { type: DataTypes.FLOAT, defaultValue: 0 },
  details_autres_charges: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'analyse_financiere' });

module.exports = AnalyseFinanciere;
