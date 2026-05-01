const bot = require('../bot');
const moment = require('moment');
const { User, Group, GroupUser, Task, Subject } = require('../models');
const { ADMIN_ID } = require('../utils');

async function startAdminPanel(msg, user) {
    const chatId = msg.chat.id;
    if (chatId.toString() !== ADMIN_ID) return bot.sendMessage(chatId, 'Доступ запрещен.');
    try {
        const pendingGroupsCount = await Group.count({ where: { isActive: false } });
        const pendingTasksCount = await Task.count({ where: { isApproved: false, isPrivate: false } });
        const activeGroupsCount = await Group.count({ where: { isActive: true } });

        const buttons = [
            [{ text: `Заявки на Группы (${pendingGroupsCount})`, callback_data: 'admin_pending_grps' }],
            [{ text: `Задачи на проверку (${pendingTasksCount})`, callback_data: 'admin_pending_tasks' }]
        ];
        const groups = await Group.findAll({ where: { isActive: true } });
        let row = [];
        groups.forEach((g, index) => {
            row.push({ text: g.name, callback_data: `adm_mod_grp_${g.id}` });
            if (row.length === 2 || index === groups.length - 1) {
                buttons.push(row);
                row = [];
            }
        });
        const text = `<b>Админ-панель</b>\n\nАктивных групп: ${activeGroupsCount}\nЗаявок на группы: ${pendingGroupsCount}\nЗадач на проверку: ${pendingTasksCount}`;
        bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } });
    } catch (e) {
        console.error('Admin panel error:', e);
        bot.sendMessage(chatId, 'Ошибка запуска панели.');
    }
}

async function handleCallback(query, user, data) {
    const chatId = query.message.chat.id;
    if (chatId.toString() !== ADMIN_ID) return;

    const parts = data.split('_');
    await bot.deleteMessage(chatId, query.message.message_id).catch(() => {});

    // Show pending tasks
    if (data === 'admin_pending_tasks') {
        const tasks = await Task.findAll({ where: { isApproved: false, isPrivate: false }, include: [Group, Subject, {model: User, as: 'creator'}] });
        if (!tasks.length) return bot.sendMessage(chatId, 'Задач на проверку нет.', { reply_markup: { inline_keyboard: [[{ text: 'В меню', callback_data: 'back_to_admin' }]] } });
        
        for (const t of tasks) {
            const msgText = `<b>Задача на проверку</b>\n\n<b>Название:</b> ${t.title}\n<b>Предмет:</b> ${t.Subject?.name || '-'}\n<b>Группа:</b> ${t.Group?.name || '-'}\n<b>Дедлайн:</b> ${moment(t.deadline).format('DD.MM HH:mm')}\n<b>От:</b> ${t.creator?.username ? `@${t.creator.username}` : `ID ${t.creatorId}`}`;
            await bot.sendMessage(chatId, msgText, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: 'Одобрить', callback_data: `adm_apr_tsk_${t.id}` }, { text: 'Удалить', callback_data: `adm_del_tsk_${t.id}` }]] } });
        }
        return bot.sendMessage(chatId, '--- Конец списка ---', { reply_markup: { inline_keyboard: [[{ text: 'В меню админа', callback_data: 'back_to_admin' }]] } });
    }
    // Approve task
    if (data.startsWith('adm_apr_tsk_')) {
        await Task.update({ isApproved: true }, { where: { id: parts[3] } });
        return bot.sendMessage(chatId, 'Задача одобрена!', { reply_markup: { inline_keyboard: [[{ text: 'В меню админа', callback_data: 'back_to_admin' }]] } });
    }
    // Delete task
    if (data.startsWith('adm_del_tsk_')) {
        await Task.destroy({ where: { id: parts[3] } });
        return bot.sendMessage(chatId, 'Задача удалена.', { reply_markup: { inline_keyboard: [[{ text: 'В меню админа', callback_data: 'back_to_admin' }]] } });
    }
    // Back to admin menu
    if (data === 'back_to_admin') {
        return startAdminPanel(query.message, user);
    }
    // Show pending groups
    if (data === 'admin_pending_grps') {
        const pending = await Group.findAll({ where: { isActive: false } });
        if (!pending.length) return bot.sendMessage(chatId, 'Заявок на создание групп нет.', { reply_markup: { inline_keyboard: [[{ text: 'Назад', callback_data: 'back_to_admin' }]] } });
        for (const g of pending) {
            await bot.sendMessage(chatId, `Заявка: ${g.name}`, { reply_markup: { inline_keyboard: [[{ text: 'Принять', callback_data: `adm_apr_grp_${g.id}` }, { text: 'Отказ', callback_data: `adm_rej_grp_${g.id}` }]] } });
        }
        return bot.sendMessage(chatId, '--- Конец списка ---', { reply_markup: { inline_keyboard: [[{ text: 'Назад', callback_data: 'back_to_admin' }]] } });
    }
    // Approve group
    if (data.startsWith('adm_apr_grp_')) {
        await Group.update({ isActive: true }, { where: { id: parts[3] } });
        return bot.sendMessage(chatId, 'Группа одобрена.', { reply_markup: { inline_keyboard: [[{ text: 'В меню админа', callback_data: 'back_to_admin' }]] } });
    }
    // Reject group
    if (data.startsWith('adm_rej_grp_')) {
        await Group.destroy({ where: { id: parts[3] } });
        return bot.sendMessage(chatId, 'Группа отклонена и удалена.', { reply_markup: { inline_keyboard: [[{ text: 'В меню админа', callback_data: 'back_to_admin' }]] } });
    }
    // Modify group (show users)
    if (data.startsWith('adm_mod_grp_')) {
        const group = await Group.findByPk(parts[3], { include: [{ model: User, through: { attributes: ['role'] } }] });
        if (!group) return startAdminPanel(query.message, user);
        const btns = group.Users.map(u => [{ text: `${u.username || `ID ${u.id}`} (${u.GroupUser.role})`, callback_data: `adm_mod_usr_${group.id}_${u.id}` }]);
        btns.push([{ text: 'Назад', callback_data: 'back_to_admin' }]);
        return bot.sendMessage(chatId, `Пользователи группы ${group.name}:`, { reply_markup: { inline_keyboard: btns } });
    }
    // Modify user (show role selection)
    if (data.startsWith('adm_mod_usr_')) {
        const [, , , gid, uid] = parts;
        const btns = [
            [{ text: 'Участник', callback_data: `adm_setrole_${gid}_${uid}_participant` }],
            [{ text: 'Куратор', callback_data: `adm_setrole_${gid}_${uid}_curator` }],
            [{ text: 'Назад к группе', callback_data: `adm_mod_grp_${gid}` }]
        ];
        return bot.sendMessage(chatId, `Выберите роль для пользователя ID ${uid}:`, { reply_markup: { inline_keyboard: btns } });
    }
    // Set user role
    if (data.startsWith('adm_setrole_')) {
        const [, , , gid, uid, role] = parts;
        await GroupUser.update({ role }, { where: { GroupId: gid, UserId: uid } });
        bot.sendMessage(chatId, `Роль ${role} установлена для пользователя ID ${uid}.`);
        return handleCallback({...query, data: `adm_mod_grp_${gid}`}, user, `adm_mod_grp_${gid}`);
    }
}

module.exports = { startAdminPanel, handleCallback };
