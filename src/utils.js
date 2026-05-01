const { GroupUser } = require('./models');

const ADMIN_ID = process.env.ADMIN_ID;

async function isCurator(userId, groupId) {
  if (!userId || !groupId) return false;
  if (userId.toString() === ADMIN_ID) return true;
  const link = await GroupUser.findOne({ where: { UserId: userId, GroupId: groupId } });
  return link && link.role === 'curator';
}

function getMainMenu(chatId) {
  const keyboard = [
    ['Задачи', 'Добавить задачу'],
    ['Сменить группу', 'Настройки'],
  ];
  if (chatId && chatId.toString() === ADMIN_ID) {
    keyboard.push(['Админ-панель']);
  }
  return { reply_markup: { keyboard: keyboard, resize_keyboard: true } };
}

const cancelKb = {
  reply_markup: { inline_keyboard: [[{ text: 'Отмена', callback_data: 'cancel_action' }]] }
};

const HELP_TEXTS = {
  user: `<b>Инструкция пользователя:</b>\n\n<b>Меню:</b>\n<b>Задачи</b> - Показать список активных задач в выбранной группе.\n<b>Добавить задачу</b> - Создать задачу (для себя или отправить запрос куратору).\n<b>Сменить группу</b> - Выбрать другую учебную группу.\n\n<b>Команды:</b>\n/start - Перезапуск бота.\n/help - Вызов этого сообщения.\n`,
  admin: `\n<b>Инструкция Администратора:</b>\n\n<b>Управление:</b>\n1. Нажмите кнопку <b>Админ-панель</b> в меню.\n2. В разделе <b>Заявки</b> одобряйте создание новых групп.\n3. В списке групп выберите нужную, затем пользователя, чтобы назначить его <b>Куратором</b>.`
};

module.exports = { isCurator, getMainMenu, cancelKb, ADMIN_ID, HELP_TEXTS };
