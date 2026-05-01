const { DataTypes } = require('sequelize');
const sequelize = require('./db');

const User = sequelize.define('User', {
  telegramId: { type: DataTypes.BIGINT, unique: true, allowNull: false },
  username: { type: DataTypes.STRING },
  currentGroupId: { type: DataTypes.INTEGER, allowNull: true },
  state: { type: DataTypes.TEXT, allowNull: true },
  notificationsEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
});

const Group = sequelize.define('Group', {
  name: { type: DataTypes.STRING, allowNull: false },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: false },
});

const GroupUser = sequelize.define('GroupUser', {
  role: { type: DataTypes.ENUM('participant', 'curator'), defaultValue: 'participant' },
});

const Subject = sequelize.define('Subject', {
  name: { type: DataTypes.STRING, allowNull: false },
  isPrivate: { type: DataTypes.BOOLEAN, defaultValue: false },
  isApproved: { type: DataTypes.BOOLEAN, defaultValue: true },
});

const Task = sequelize.define('Task', {
  title: { type: DataTypes.STRING, allowNull: false },
  deadline: { type: DataTypes.DATE, allowNull: false },
  isPrivate: { type: DataTypes.BOOLEAN, defaultValue: false },
  isCompleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  isApproved: { type: DataTypes.BOOLEAN, defaultValue: true },
  creatorId: { type: DataTypes.INTEGER },
});

const TaskCompletion = sequelize.define('TaskCompletion', {
  isCompleted: { type: DataTypes.BOOLEAN, defaultValue: false },
});

User.belongsToMany(Group, { through: GroupUser, foreignKey: 'UserId' });
Group.belongsToMany(User, { through: GroupUser, foreignKey: 'GroupId' });
Group.hasMany(GroupUser, { foreignKey: 'GroupId' });
GroupUser.belongsTo(Group, { foreignKey: 'GroupId' });
User.hasMany(GroupUser, { foreignKey: 'UserId' });
GroupUser.belongsTo(User, { foreignKey: 'UserId' });

Group.hasMany(Subject, { foreignKey: 'GroupId' });
Subject.belongsTo(Group, { foreignKey: 'GroupId' });

Subject.hasMany(Task, { foreignKey: 'SubjectId' });
Task.belongsTo(Subject, { foreignKey: 'SubjectId' });

Group.hasMany(Task, { foreignKey: 'GroupId' });
Task.belongsTo(Group, { foreignKey: 'GroupId' });

User.hasMany(Task, { foreignKey: 'creatorId', as: 'createdTasks' });
Task.belongsTo(User, { foreignKey: 'creatorId', as: 'creator' });

User.belongsToMany(Task, { through: TaskCompletion, as: 'assignedTasks' });
Task.belongsToMany(User, { through: TaskCompletion, as: 'assignees' });

const initDb = async () => {
  try {
    await sequelize.sync();
    console.log('БД подключена и модели синхронизированы.');
  } catch (error) {
    console.error('Ошибка подключения к БД:', error);
    process.exit(1);
  }
};

module.exports = { initDb, User, Group, GroupUser, Task, Subject, TaskCompletion };
