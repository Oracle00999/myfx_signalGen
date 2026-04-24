const axios = require("axios");

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const isTelegramConfigured = () => {
  return Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID);
};

const escapeMarkdown = (text = "") => {
  return String(text).replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
};

const formatSignalAlert = (signal) => {
  const reasonsText =
    Array.isArray(signal.reasons) && signal.reasons.length > 0
      ? signal.reasons.map((reason) => `• ${reason}`).join("\n")
      : "• No reasons provided";

  return [
    `*${escapeMarkdown(signal.type)} ${escapeMarkdown(signal.symbol)}*`,
    "",
    `Timeframe: *${escapeMarkdown(signal.timeframe)}*`,
    `Entry: *${escapeMarkdown(signal.entry)}*`,
    `Stop Loss: *${escapeMarkdown(signal.stopLoss)}*`,
    `Take Profit: *${escapeMarkdown(signal.takeProfit)}*`,
    `Confidence: *${escapeMarkdown(signal.confidence)}*`,
    signal.entryType
      ? `Entry Type: *${escapeMarkdown(signal.entryType)}*`
      : null,
    signal.entrySource
      ? `Entry Source: *${escapeMarkdown(signal.entrySource)}*`
      : null,
    signal.currentPrice
      ? `Current Price: *${escapeMarkdown(signal.currentPrice)}*`
      : null,
    "",
    "*Reasons:*",
    escapeMarkdown(reasonsText),
  ]
    .filter(Boolean)
    .join("\n");
};

const sendTelegramMessage = async (
  text,
  chatId = TELEGRAM_CHAT_ID,
  options = {},
) => {
  if (!isTelegramConfigured()) {
    return {
      sent: false,
      reason: "Telegram credentials are not configured",
    };
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    const payload = {
      chat_id: chatId,
      text,
      ...options,
    };

    const response = await axios.post(url, payload);

    return {
      sent: true,
      data: response.data,
    };
  } catch (error) {
    return {
      sent: false,
      reason:
        error.response?.data?.description ||
        error.message ||
        "Failed to send Telegram message",
    };
  }
};

const sendTelegramSignalAlert = async (signal) => {
  const message = formatSignalAlert(signal);
  return sendTelegramMessage(message, TELEGRAM_CHAT_ID, {
    parse_mode: "MarkdownV2",
  });
};

module.exports = {
  isTelegramConfigured,
  formatSignalAlert,
  sendTelegramMessage,
  sendTelegramSignalAlert,
};
