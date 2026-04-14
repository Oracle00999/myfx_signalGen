const axios = require("axios");
const { handleTelegramCommand } = require("../services/telegramCommandService");
const { sendTelegramMessage } = require("../services/notificationService");

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = String(process.env.TELEGRAM_CHAT_ID || "");

let lastUpdateId = 0;

const runTelegramPollingJob = async () => {
  try {
    if (!TELEGRAM_BOT_TOKEN) {
      console.log("[TelegramPollingJob] Missing TELEGRAM_BOT_TOKEN");
      return;
    }

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`;

    const response = await axios.get(url, {
      params: {
        offset: lastUpdateId + 1,
        timeout: 0,
      },
    });

    const updates = response.data?.result || [];

    for (const update of updates) {
      lastUpdateId = update.update_id;

      const message = update.message;
      const chatId = String(message?.chat?.id || "");
      const text = message?.text?.trim();

      if (!text) continue;

      // optional safety: respond only to your own configured chat
      if (TELEGRAM_CHAT_ID && chatId !== TELEGRAM_CHAT_ID) {
        continue;
      }

      const reply = await handleTelegramCommand(text);
      const sendResult = await sendTelegramMessage(reply, chatId);

      console.log(
        `[TelegramPollingJob] Reply to ${chatId}:`,
        sendResult.sent ? "sent" : sendResult.reason,
      );
    }
  } catch (error) {
    console.error("[TelegramPollingJob] Failed:", error.message);
  }
};

module.exports = {
  runTelegramPollingJob,
};
