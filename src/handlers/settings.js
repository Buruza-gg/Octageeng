// /src/handlers/settings.js
const bot = require('../bot');
const { User, Group } = require('../models');
const { getMainMenu } = require('../utils');

async function showSettings(msg, user) {
    const chatId = msg.chat.id;
    const group = user.currentGroupId ? await Group.findByPk(user.currentGroupId) : null;
    const notifStatus = user.notificationsEnabled ? 'Включены' : 'Выключены';
    const groupStatus = group ? group.name : 'Не выбрана';

    const text = `<b>Настройки</b>\n\nУведомления: <b>${notifStatus}</b>\nТекущая группа: <b>${groupStatus}</b>\n\nВыберите действие:`;
    const buttons = [
        [{ text: `Переключить уведомления`, callback_data: 'settings_toggle_notif' }],
        [{ text: `Сбросить выбор группы`, callback_data: 'settings_reset_group' }]
    ];

    bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } });
}

async function handleCallback(query, user, data) {
    const chatId = query.message.chat.id;
    
    if (data === 'settings_toggle_notif') {
        user.notificationsEnabled = !user.notificationsEnabled;
        await user.save();
        const status = user.notificationsEnabled ? 'Включены' : 'Выключены';
        await bot.answerCallbackQuery(query.id, { text: `Уведомления ${status}` });
    }
    
    if (data === 'settings_reset_group') {
        user.currentGroupId = null;
        await user.save();
        await bot.answerCallbackQuery(query.id, { text: 'Группа сброшена' });
        await bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        return bot.sendMessage(chatId, 'Группа сброшена. Выберите новую в меню "Сменить группу".', getMainMenu(chatId));
    }
    
    // Update the message after any action
    const group = user.currentGroupId ? await Group.findByPk(user.currentGroupId) : null;
    const notifStatus = user.notificationsEnabled ? 'Включены' : 'Выключены';
    const groupStatus = group ? group.name : 'Не выбрана';
    const text = `<b>Настройки</b>\n\nУведомления: <b>${notifStatus}</b>\nТекущая группа: <b>${groupStatus}</b>\n\nВыберите действие:`;
    
    await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'HTML',
        reply_markup: query.message.reply_markup
    }).catch(() => {}); // Catch if message is not modified
}

module.exports = { showSettings, handleCallback };
