
// import * as TelegramBot from 'node-telegram-bot-api';
import TelegramBot from 'node-telegram-bot-api';
import { COURT_TYPE } from './constants';

let bot: TelegramBot;

const connectBot = () => {
   if (!bot) {
      console.log("🚀 ~ file: telegram.ts:9 ~ connectBot ~ bot:", bot)
      bot = new TelegramBot(process.env.TENNIS_TELEGRAM_BOT_TOKEN || '', { polling: true });
   }
   return bot;
}

const getChatId = (type: string): string => {
   return type && type === COURT_TYPE.TENNIS ?
      process.env.TENNIS_TELEGRAM_BOT_CHAT_ID
      : process.env.FOOTBALL_TELEGRAM_BOT_CHAT_ID;
}

const sendTelegramMessage = async (text: string, type?: string) => {
   await bot.sendMessage(getChatId(type), text, { parse_mode: 'Markdown' });
}

const closeBot = () => {
   bot.close();
}

export { sendTelegramMessage, closeBot, connectBot }