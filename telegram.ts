
// import * as TelegramBot from 'node-telegram-bot-api';
import TelegramBot from 'node-telegram-bot-api';

const bot = new TelegramBot(process.env.TENNIS_TELEGRAM_BOT_TOKEN || '', { polling: true });

const sendTelegramMessage = async (text: string) => {
   await bot.sendMessage(process.env.TENNIS_TELEGRAM_BOT_CHAT_ID || '', text);
}

export { sendTelegramMessage }