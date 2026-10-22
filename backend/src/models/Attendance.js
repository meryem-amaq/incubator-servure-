const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Attendance = sequelize.define('Attendance', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  raw_badge_id: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  time: {
    type: DataTypes.DATE,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('IN', 'OUT'),
    defaultValue: 'IN'
  },
  device_ip: {
    type: DataTypes.STRING(45),
    allowNull: false
  }
}, {
  tableName: 'attendances',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    { fields: ['time'] },
    { fields: ['raw_badge_id'] },
    { fields: ['user_id'] }
  ]
});

module.exports = Attendance;
