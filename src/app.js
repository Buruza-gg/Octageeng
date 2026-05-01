require('dotenv').config();
const bot = require('./bot');
const { initDb, User } = require('./models');
const { getMainMenu, HELP_TEXTS, ADMIN_ID } = require('./utils');
const { setupCron } = require('./cron');

// Импортируем хэндлеры
const groupHandler = require('./handlers/groups');
const adminHandler = require('./handlers/admin');
const taskHandler = require('./handlers/tasks');
const settingsHandler = require('./handlers/settings');

// Маршрутизатор текстовых команд из меню
const messageRouter = {
  'Задачи': (msg, user) => taskHandler.showTasks(msg, user),
  'Добавить задачу': (msg, user) => taskHandler.startTaskCreation(msg, user),
  'Сменить группу': (msg, user) => groupHandler.sendGroupSelection(msg, user),
  'Настройки': (msg, user) => settingsHandler.showSettings(msg, user),
  'Админ-панель': (msg, user) => { if (user.telegramId.toString() === ADMIN_ID) return adminHandler.startAdminPanel(msg, user); },
};

// Маршрутизатор колбэков по префиксам
const callbackRouter = {
  'adm': adminHandler.handleCallback,
  'admin': adminHandler.handleCallback,
  'settings': settingsHandler.handleCallback,
  'sel_grp': groupHandler.handleCallback,
  'pg_grp': groupHandler.handleCallback,
  'add_grp_req': groupHandler.handleCallback,
  'done_task': taskHandler.handleCallback,
  'sel_sbj': taskHandler.handleCallback,
  'add_new_sbj': taskHandler.handleCallback,
  'tsk_scp': taskHandler.handleCallback,
  'cancel_action': async (query) => {
    const { message } = query;
    await User.update({ state: null }, { where: { telegramId: message.chat.id } });
    await bot.deleteMessage(message.chat.id, message.message_id).catch(() => {});
    await bot.sendMessage(message.chat.id, 'Действие отменено.', getMainMenu(message.chat.id));
  },
  'ignore': () => {}
};

// Middleware для автоматического получения пользователя
const withUser = (handler) => async (msgOrQuery) => {
  const isQuery = !!msgOrQuery.message;
  const context = isQuery ? msgOrQuery.message : msgOrQuery;
  const from = isQuery ? msgOrQuery.from : context.from;
  try {
    const [user] = await User.findOrCreate({ where: { telegramId: from.id }, defaults: { username: from.username } });
    await handler(msgOrQuery, user);
  } catch (error) {
    console.error('Middleware withUser error:', error);
    bot.sendMessage(context.chat.id, 'Произошла внутренняя ошибка. Попробуйте позже.').catch(() => {});
  }
};

// Регистрация обработчиков
bot.on('message', withUser(async (msg, user) => {
  if (!msg.text) return;
  if (user.state) {
    const state = JSON.parse(user.state);
    if (state.step.startsWith('task_')) return taskHandler.handleState(msg, user, state);
    if (state.step.startsWith('group_')) return groupHandler.handleState(msg, user, state);
    return;
  }
  const commandHandler = messageRouter[msg.text];
  if (commandHandler) return commandHandler(msg, user);
  if (msg.text === '/start') {
    await User.update({ state: null }, { where: { id: user.id } });
    await bot.sendMessage(msg.chat.id, 'Привет! Выбери действие:', getMainMenu(msg.chat.id));
    if (!user.currentGroupId && msg.chat.id.toString() !== ADMIN_ID) return groupHandler.sendGroupSelection(msg, user);
  } else if (msg.text === '/help') {
    const isAdmin = msg.chat.id.toString() === ADMIN_ID;
    const helpMsg = HELP_TEXTS.user + (isAdmin ? HELP_TEXTS.admin : '');
    return bot.sendMessage(msg.chat.id, helpMsg, { parse_mode: 'HTML' });
  }
}));

bot.on('callback_query', withUser(async (query, user) => {
  const prefix = query.data.split('_')[0];
  const handler = callbackRouter[prefix];
  try {
    if (handler) await handler(query, user, query.data);
  } catch (e) {
    console.error(`Callback handler error for "${query.data}":`, e);
  } finally {
    bot.answerCallbackQuery(query.id).catch(() => {});
  }
}));

bot.on('polling_error', (error) => console.error(`Polling error: ${error.code} - ${error.message}`));

// Запуск приложения
(async () => {
  await initDb();
  setupCron(bot);
  console.log('Бот запущен...');
})();
