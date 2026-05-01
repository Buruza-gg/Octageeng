const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

if (!process.env.BOT_TOKEN) {
  throw new Error('BOT_TOKEN не найден в .env файле!');
}

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

module.exports = bot;
