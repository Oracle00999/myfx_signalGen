const axios = require("axios");

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const isTelegramConfigured = () => {
  return Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID);
};

const escapeMarkdown = (text = "") => {
  return String(text).replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
};

const hasMetric = (value) => value !== null && value !== undefined;

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const roundMetric = (value) =>
  Number.isFinite(value) ? Number(value.toFixed(2)) : null;

const formatMetric = (value, digits = 2) => {
  const number = toNumber(value);
  if (number === null) return "N/A";
  return number.toFixed(digits);
};

const getSnapshotMetric = (signal, key) => {
  const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

  return (
    signal?.analysis_snapshot?.[key] ??
    signal?.analysis_snapshot?.[snakeKey] ??
    signal?.analysis_snapshot?.signal?.[key] ??
    signal?.analysis_snapshot?.signal?.[snakeKey] ??
    signal?.analysisSnapshot?.[key] ??
    signal?.analysisSnapshot?.[snakeKey] ??
    signal?.analysisSnapshot?.signal?.[key] ??
    signal?.analysisSnapshot?.signal?.[snakeKey] ??
    signal?.[key] ??
    signal?.[snakeKey] ??
    null
  );
};

const getLifecycleMetrics = (signal) => {
  const entry = toNumber(signal?.entry);
  const stopLoss = toNumber(signal?.stop_loss ?? signal?.stopLoss);
  const takeProfit = toNumber(signal?.take_profit ?? signal?.takeProfit);
  const risk =
    entry !== null && stopLoss !== null ? Math.abs(entry - stopLoss) : null;
  const reward =
    entry !== null && takeProfit !== null ? Math.abs(takeProfit - entry) : null;
  const calculatedRiskPercent =
    entry !== null && entry !== 0 && risk !== null
      ? roundMetric((risk / Math.abs(entry)) * 100)
      : null;
  const calculatedRr =
    risk !== null && risk !== 0 && reward !== null
      ? roundMetric(reward / risk)
      : null;

  return {
    rr: getSnapshotMetric(signal, "rr") ?? calculatedRr,
    riskPercent:
      getSnapshotMetric(signal, "riskPercent") ?? calculatedRiskPercent,
  };
};

const formatSignalLifecycleAlert = (signal, status) => {
  const isTpHit = status === "TP_HIT";
  const isTriggered = status === "TRIGGERED";

  if (!signal || (!isTriggered && !isTpHit && status !== "SL_HIT")) {
    return null;
  }

  const metrics = getLifecycleMetrics(signal);
  const stopLoss = signal.stop_loss ?? signal.stopLoss;
  const takeProfit = signal.take_profit ?? signal.takeProfit;
  const entryType = signal.entry_type ?? signal.entryType ?? "N/A";
  const entrySource = signal.entry_source ?? signal.entrySource ?? "N/A";

  if (isTriggered) {
    return [
      "🚀 SIGNAL TRIGGERED",
      "",
      `Symbol: ${signal.symbol}`,
      `Timeframe: ${signal.timeframe}`,
      `Type: ${signal.type}`,
      `Entry: ${signal.entry}`,
      `Stop Loss: ${stopLoss}`,
      `Take Profit: ${takeProfit}`,
      "",
      `Entry Type: ${entryType}`,
      `Entry Source: ${entrySource}`,
      "",
      "Stats:",
      `RR: ${formatMetric(metrics.rr, 1)}`,
      `Risk %: ${formatMetric(metrics.riskPercent, 2)}%`,
      "",
      `Signal ID: ${signal.id}`,
    ].join("\n");
  }

  return [
    isTpHit ? "🎯 TP HIT" : "🛑 SL HIT",
    "",
    `Symbol: ${signal.symbol}`,
    `Timeframe: ${signal.timeframe}`,
    `Type: ${signal.type}`,
    `Entry: ${signal.entry}`,
    isTpHit ? `Take Profit: ${takeProfit}` : `Stop Loss: ${stopLoss}`,
    "",
    "Result:",
    isTpHit ? "+ Profit secured" : "- Trade invalidated",
    "",
    "Stats:",
    `RR: ${formatMetric(metrics.rr, 1)}`,
    `Risk %: ${formatMetric(metrics.riskPercent, 2)}%`,
    "",
    `Signal ID: ${signal.id}`,
  ].join("\n");
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
    hasMetric(signal.risk) ? `Risk: *${escapeMarkdown(signal.risk)}*` : null,
    hasMetric(signal.reward)
      ? `Reward: *${escapeMarkdown(signal.reward)}*`
      : null,
    hasMetric(signal.rr) ? `RR: *${escapeMarkdown(signal.rr)}*` : null,
    hasMetric(signal.riskPercent)
      ? `Risk %: *${escapeMarkdown(`${signal.riskPercent}%`)}*`
      : null,
    hasMetric(signal.atrPercent)
      ? `ATR %: *${escapeMarkdown(`${signal.atrPercent}%`)}*`
      : null,
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
  formatSignalLifecycleAlert,
  sendTelegramMessage,
  sendTelegramSignalAlert,
};
