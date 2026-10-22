const sequelize = require('../config/database');
const User = require('./User');
const Incube = require('./Incube');
const GestionMateriel = require('./GestionMateriel');
const SuiviEngagement = require('./SuiviEngagement');
const RhEmploi = require('./RhEmploi');
const RhDetail = require('./RhDetail');
const PlanAction = require('./PlanAction');
const AnalyseFinanciere = require('./AnalyseFinanciere');
const RendezVous = require('./RendezVous');
const ReservationEspace = require('./ReservationEspace');
const EquipementEspace = require('./EquipementEspace');
const PresenceAtelier = require('./PresenceAtelier');
const Atelier = require('./Atelier');
const Promotion = require('./Promotion');
const ChecklistMateriel = require('./ChecklistMateriel');
const HistoriquePhase = require('./HistoriquePhase');
const HistoriqueStatut = require('./HistoriqueStatut');
const FicheSuivi = require('./FicheSuivi');
const Formation = require('./Formation');
const Attendance = require('./Attendance');
const TourniquetUser = require('./TourniquetUser');

// === Associations : User & Attendance (Tourniquets) ===
User.hasMany(Attendance, { foreignKey: 'user_id', as: 'attendances' });
Attendance.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// === Associations : User & Incube (Compte Utilisateur 1-to-1 - Porteur de Projet) ===
User.hasOne(Incube, { foreignKey: 'user_id', as: 'porteurProjet' });
Incube.belongsTo(User, { foreignKey: 'user_id', as: 'compteUtilisateur' });

// === Associations : User & Incube (Accompagnateur) ===
User.hasMany(Incube, { foreignKey: 'admin_id', as: 'incubes' });
Incube.belongsTo(User, { foreignKey: 'admin_id', as: 'accompagnateurAdmin' });

// === Associations : Incube hasMany ===
Incube.hasMany(GestionMateriel, { foreignKey: 'incube_id', as: 'materiels' });
GestionMateriel.belongsTo(Incube, { foreignKey: 'incube_id', as: 'incube' });

Incube.hasMany(SuiviEngagement, { foreignKey: 'incube_id', as: 'engagements' });
SuiviEngagement.belongsTo(Incube, { foreignKey: 'incube_id', as: 'incube' });

Incube.hasMany(RhEmploi, { foreignKey: 'incube_id', as: 'emplois' });
RhEmploi.belongsTo(Incube, { foreignKey: 'incube_id', as: 'incube' });

Incube.hasMany(RhDetail, { foreignKey: 'incube_id', as: 'personnel' });
RhDetail.belongsTo(Incube, { foreignKey: 'incube_id', as: 'incube' });

Incube.hasMany(PlanAction, { foreignKey: 'incube_id', as: 'plans' });
PlanAction.belongsTo(Incube, { foreignKey: 'incube_id', as: 'incube' });

Incube.hasMany(AnalyseFinanciere, { foreignKey: 'incube_id', as: 'finances' });
AnalyseFinanciere.belongsTo(Incube, { foreignKey: 'incube_id', as: 'incube' });

Incube.hasMany(HistoriquePhase, { foreignKey: 'incube_id', as: 'historique_phases' });
HistoriquePhase.belongsTo(Incube, { foreignKey: 'incube_id', as: 'incube' });

Incube.hasMany(HistoriqueStatut, { foreignKey: 'incube_id', as: 'historique_statuts' });
HistoriqueStatut.belongsTo(Incube, { foreignKey: 'incube_id', as: 'incube' });

Incube.hasMany(FicheSuivi, { foreignKey: 'incube_id', as: 'fiches_suivi' });
FicheSuivi.belongsTo(Incube, { foreignKey: 'incube_id', as: 'incube' });

Incube.hasMany(Formation, { foreignKey: 'incube_id', as: 'formations' });
Formation.belongsTo(Incube, { foreignKey: 'incube_id', as: 'incube' });

// Associations FicheSuivi & RendezVous
RendezVous.hasOne(FicheSuivi, { foreignKey: 'rendezvous_id', as: 'fiche_suivi' });
FicheSuivi.belongsTo(RendezVous, { foreignKey: 'rendezvous_id', as: 'rendezvous' });

// Associations PlanAction & RendezVous
RendezVous.hasMany(PlanAction, { foreignKey: 'rendezvous_id', as: 'plans_action' });
PlanAction.belongsTo(RendezVous, { foreignKey: 'rendezvous_id', as: 'rendezvous' });

// === Associations : ReservationEspace & EquipementEspace ===
ReservationEspace.belongsToMany(EquipementEspace, { through: ChecklistMateriel, foreignKey: 'reservation_id', as: 'equipements' });
EquipementEspace.belongsToMany(ReservationEspace, { through: ChecklistMateriel, foreignKey: 'equipement_id', as: 'reservations' });

ChecklistMateriel.belongsTo(ReservationEspace, { foreignKey: 'reservation_id', as: 'reservation' });
ChecklistMateriel.belongsTo(EquipementEspace, { foreignKey: 'equipement_id', as: 'equipement' });
ReservationEspace.hasMany(ChecklistMateriel, { foreignKey: 'reservation_id', as: 'checklists' });
EquipementEspace.hasMany(ChecklistMateriel, { foreignKey: 'equipement_id', as: 'checklists' });

module.exports = {
  sequelize,
  User,
  Incube,
  GestionMateriel,
  SuiviEngagement,
  RhEmploi,
  RhDetail,
  PlanAction,
  AnalyseFinanciere,
  RendezVous,
  ReservationEspace,
  EquipementEspace,
  PresenceAtelier,
  Atelier,
  Promotion,
  ChecklistMateriel,
  HistoriquePhase,
  HistoriqueStatut,
  FicheSuivi,
  Formation,
  Attendance,
  TourniquetUser
};
