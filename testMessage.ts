import { sendTelegramMessage } from './telegram.js';

const testMessage = () => {
    sendTelegramMessage('test message');
    return process.exit(0);
}

export { testMessage };