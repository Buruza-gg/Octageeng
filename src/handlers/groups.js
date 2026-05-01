const bot = require('../bot');
const { User, Group, GroupUser } = require('../models');
const { mainMenu, cancelKb, ADMIN_ID, getMainMenu } = require('../utils');

async function sendGroupSelection(msg, user, page = 0) {
    const chatId = msg.chat.id;
    const limit = 5;
    const offset = page * limit;
    const { count, rows } = await Group.findAndCountAll({ where: { isActive: true }, limit, offset });

    const buttons = rows.map(g => [{ text: g.name, callback_data: `sel_grp_${g.id}` }]);
    const navRow = [];
    if (page > 0) navRow.push({ text: '◀️ Назад', callback_data: `pg_grp_${page - 1}` });
    if (offset + limit < count) navRow.push({ text: 'Вперед ▶️', callback_data: `pg_grp_${page + 1}` });
    if (navRow.length > 0) buttons.push(navRow);
    
    buttons.push([{ text: '➕ Добавить свою группу', callback_data: 'add_grp_req' }]);
    if (chatId.toString() === ADMIN_ID) buttons.push([{ text: 'Группы на одобрении', callback_data: 'admin_pending_grps' }]);
    
    await bot.sendMessage(chatId, 'Выберите группу из списка:', { reply_markup: { inline_keyboard: buttons } });
}

async function handleState(msg, user, state) {
    const text = msg.text;
    const chatId = msg.chat.id;
    if (state.step === 'group_create_name') {
        await Group.create({ name: text, isActive: false });
        await User.update({ state: null }, { where: { id: user.id } });
        await bot.sendMessage(ADMIN_ID, `Новая заявка на группу: ${text}`, { reply_markup: { inline_keyboard: [[{ text: 'К админ-панели', callback_data: 'admin_pending_grps' }]] } });
        await bot.sendMessage(chatId, 'Заявка на создание группы отправлена администратору.', getMainMenu(chatId));
    }
}

async function handleCallback(query, user, data) {
    const chatId = query.message.chat.id;
    const parts = data.split('_');

    if (data === 'add_grp_req') {
        await User.update({ state: JSON.stringify({ step: 'group_create_name' }) }, { where: { id: user.id } });
        await bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        return bot.sendMessage(chatId, 'Напишите название вашей новой группы:', cancelKb);
    }

    if (data.startsWith('pg_grp_')) {
        const page = parseInt(parts[2], 10);
        await bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        return sendGroupSelection(query.message, user, page);
    }

    if (data.startsWith('sel_grp_')) {
        const groupId = parseInt(parts[2], 10);
        await User.update({ currentGroupId: groupId }, { where: { id: user.id } });
        await GroupUser.findOrCreate({ where: { UserId: user.id, GroupId: groupId } });
        await bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        const group = await Group.findByPk(groupId);
        return bot.sendMessage(chatId, `Выбрана группа: ${group.name}.`, getMainMenu(chatId));
    }
}

module.exports = { sendGroupSelection, handleState, handleCallback };
