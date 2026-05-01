// /src/handlers/tasks.js
const moment = require('moment');
const bot = require('../bot');
const { User, Task, Subject, TaskCompletion, Group } = require('../models');
const { cancelKb, isCurator } = require('../utils');
const { Op } = require('sequelize');

async function showTasks(msg, user) {
    const chatId = msg.chat.id;
    if (!user.currentGroupId) return bot.sendMessage(chatId, 'Сначала выберите группу.');

    const tasks = await Task.findAll({
        where: {
            GroupId: user.currentGroupId,
            [Op.or]: [
                { isPrivate: false, isApproved: true },
                { isPrivate: true, creatorId: user.id }
            ],
            deadline: { [Op.gte]: new Date() }
        },
        include: [{ model: Subject }],
        order: [['deadline', 'ASC']]
    });

    if (!tasks.length) return bot.sendMessage(chatId, 'Активных задач нет.');

    await bot.sendMessage(chatId, '--- Активные задачи ---');
    for (const task of tasks) {
        const done = await TaskCompletion.findOne({ where: { UserId: user.id, TaskId: task.id, isCompleted: true } });
        if ((task.isPrivate && task.isCompleted) || done) continue;

        const deadline = moment(task.deadline).format('DD.MM HH:mm');
        const msgText = `*${task.title}*\nПредмет: ${task.Subject?.name || 'Без предмета'}\nДедлайн: ${deadline}`;
        bot.sendMessage(chatId, msgText, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '✅ Выполнено', callback_data: `done_task_${task.id}` }]] } });
    }
}

async function startTaskCreation(msg, user) {
    const chatId = msg.chat.id;
    if (!user.currentGroupId) return bot.sendMessage(chatId, 'Сначала выберите группу!');
    await User.update({ state: JSON.stringify({ step: 'task_title' }) }, { where: { id: user.id } });
    await bot.sendMessage(chatId, 'Введите название задачи:', cancelKb);
}

async function handleState(msg, user, state) {
    const text = msg.text;
    const chatId = msg.chat.id;
    switch (state.step) {
        case 'task_title':
            state.title = text;
            state.step = 'task_date';
            await User.update({ state: JSON.stringify(state) }, { where: { id: user.id } });
            await bot.sendMessage(chatId, 'Дедлайн (YYYY-MM-DD HH:mm):', cancelKb);
            break;
        case 'task_date':
            const date = moment(text, 'YYYY-MM-DD HH:mm');
            if (!date.isValid()) return bot.sendMessage(chatId, 'Неверный формат даты. Попробуйте еще раз.');
            state.date = date.toDate();
            state.step = 'task_subject';
            await User.update({ state: JSON.stringify(state) }, { where: { id: user.id } });
            const subjects = await Subject.findAll({ where: { GroupId: user.currentGroupId } });
            const buttons = subjects.map(s => [{ text: s.name, callback_data: `sel_sbj_${s.id}` }]);
            buttons.push([{ text: 'Новый предмет', callback_data: 'add_new_sbj' }]);
            await bot.sendMessage(chatId, 'Выберите предмет:', { reply_markup: { inline_keyboard: buttons } });
            break;
        case 'task_new_subject_name':
            state.newSubjectName = text;
            await User.update({ state: JSON.stringify(state) }, { where: { id: user.id } });
            // This now triggers the next step via a callback, see handleCallback
            await handleCallback({ message: msg, data: 'tsk_scp_trigger' }, user, 'tsk_scp_trigger');
            break;
    }
}

async function handleCallback(query, user, data) {
    const parts = data.split('_');
    const chatId = query.message.chat.id;
    const state = user.state ? JSON.parse(user.state) : {};

    if (data.startsWith('done_task_')) {
        const task = await Task.findByPk(parts[2]);
        if (!task) return bot.answerCallbackQuery(query.id, { text: 'Задача не найдена' });
        if (task.isPrivate) await Task.update({ isCompleted: true }, { where: { id: task.id } });
        else await TaskCompletion.findOrCreate({ where: { UserId: user.id, TaskId: task.id }, defaults: { isCompleted: true } });
        await bot.answerCallbackQuery(query.id, { text: 'Выполнено!' });
        await bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        return;
    }

    if (state.step === 'task_subject') {
        await bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        if (data === 'add_new_sbj') {
            state.step = 'task_new_subject_name';
            await User.update({ state: JSON.stringify(state) }, { where: { id: user.id } });
            await bot.sendMessage(chatId, 'Введите название нового предмета:', cancelKb);
        } else if (data.startsWith('sel_sbj_')) {
            state.subjectId = parts[2];
            await User.update({ state: JSON.stringify(state) }, { where: { id: user.id } });
            await handleCallback({ message: query.message, data: 'tsk_scp_trigger' }, user, 'tsk_scp_trigger');
        }
    } else if (data === 'tsk_scp_trigger') {
        state.step = 'task_finish';
        await User.update({ state: JSON.stringify(state) }, { where: { id: user.id } });
        const isCur = await isCurator(user.id, user.currentGroupId);
        const buttons = [[{ text: 'Для себя (приватно)', callback_data: 'tsk_scp_self' }]];
        if (isCur) buttons.push([{ text: 'Для всей группы', callback_data: 'tsk_scp_force' }]);
        else buttons.push([{ text: 'Запросить для группы', callback_data: 'tsk_scp_req' }]);
        await bot.sendMessage(chatId, 'Для кого эта задача?', { reply_markup: { inline_keyboard: buttons } });
    } else if (state.step === 'task_finish' && data.startsWith('tsk_scp_')) {
        const type = parts[2]; // self, force, req
        let { title, date, subjectId, newSubjectName } = state;
        const isCur = await isCurator(user.id, user.currentGroupId);
        if (newSubjectName) {
            const newSubj = await Subject.create({ name: newSubjectName, GroupId: user.currentGroupId, isPrivate: type === 'self', isApproved: (type === 'self' || isCur) });
            subjectId = newSubj.id;
        }
        await Task.create({ title, deadline: date, SubjectId: subjectId, GroupId: user.currentGroupId, creatorId: user.id, isPrivate: type === 'self', isApproved: (type === 'self' || isCur) });
        await User.update({ state: null }, { where: { id: user.id } });
        await bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        await bot.sendMessage(chatId, (type === 'self' || isCur) ? 'Задача успешно создана!' : 'Задача отправлена на модерацию куратору.');
    }
}

module.exports = { showTasks, startTaskCreation, handleState, handleCallback };
