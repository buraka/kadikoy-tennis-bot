
// import * as TelegramBot from 'node-telegram-bot-api';
import TelegramBot from 'node-telegram-bot-api';

let bot: TelegramBot;

const connectBot = () => {
   if (!bot) {
      console.log("🚀 ~ file: telegram.ts:9 ~ connectBot ~ bot:", bot)
      bot = new TelegramBot(process.env.TENNIS_TELEGRAM_BOT_TOKEN || '', { polling: true });
   }
   return bot;
}

const sendTelegramMessage = async (text: string) => {
   await bot.sendMessage(process.env.TENNIS_TELEGRAM_BOT_CHAT_ID || '', text);
}

const closeBot = () => {
   bot.close();
}

export { sendTelegramMessage, closeBot, connectBot }