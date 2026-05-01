const cron = require('node-cron');
const moment = require('moment');
const { Op } = require('sequelize');
const { Task, GroupUser, User, TaskCompletion } = require('./models');

function setupCron(bot) {
  cron.schedule('0 * * * *', async () => {
    console.log('Проверка дедлайнов...');
    try {
      const tasks = await Task.findAll({ where: { deadline: { [Op.gt]: new Date() }, isApproved: true } });
      for (const task of tasks) {
        const now = moment();
        const dl = moment(task.deadline);
        const diffDays = dl.diff(now, 'days');
        const diffHours = dl.diff(now, 'hours');
        let msg = '';
        if (diffDays === 6 && dl.hours() === now.hours()) msg = `<b>Напоминание (1 неделя):</b>\n${task.title}`;
        else if (diffDays < 3 && diffDays >= 0 && dl.hours() === now.hours()) msg = `<b>СКОРО ДЕДЛАЙН (${diffDays + 1} дн):</b>\n${task.title}`;
        if (!msg) continue;
        if (task.isPrivate) {
          const user = await User.findByPk(task.creatorId);
          if (user && user.notificationsEnabled && !task.isCompleted) bot.sendMessage(user.telegramId, msg, { parse_mode: 'HTML' }).catch(() => {});
        } else {
          const groupUsers = await GroupUser.findAll({ where: { GroupId: task.GroupId } });
          for (const link of groupUsers) {
            const completion = await TaskCompletion.findOne({ where: { UserId: link.UserId, TaskId: task.id, isCompleted: true } });
            if (!completion) {
              const user = await User.findByPk(link.UserId);
              if (user && user.notificationsEnabled) bot.sendMessage(user.telegramId, msg, { parse_mode: 'HTML' }).catch(() => {});
            }
          }
        }
      }
    } catch (error) { console.error('Ошибка в Cron:', error); }
  });
  console.log('Cron-задачи настроены.');
}

module.exports = { setupCron };
