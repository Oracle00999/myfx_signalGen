const { analyzeMarket } = require("./analyzerService");
const { createSignalIfValid } = require("./signalService");
const { getTradingStats } = require("./statsService");
const {
  SUPPORTED_SYMBOLS,
  SUPPORTED_TIMEFRAMES,
} = require("../utils/constants");

const normalizeSymbol = (value = "") => value.trim().toUpperCase();
const normalizeTimeframe = (value = "") => value.trim().toLowerCase();

const formatStatsReply = (stats) => {
  return [
    "Overall Trading Stats",
    "",
    `Total Signals: ${stats.totalSignals}`,
    `Closed Trades: ${stats.closedSignals}`,
    `Wins: ${stats.wins}`,
    `Losses: ${stats.losses}`,
    `Win Rate: ${stats.winRate}%`,
    "",
    `Pending: ${stats.pending}`,
    `Triggered: ${stats.triggered}`,
    `Expired: ${stats.expired}`,
  ].join("\n");
};

const parseTelegramCommand = (text = "") => {
  const cleaned = text.trim().toLowerCase();

  if (cleaned === "win rate" || cleaned === "winrate" || cleaned === "stats") {
    return {
      valid: true,
      type: "STATS",
    };
  }

  const parts = text.trim().split(/\s+/);

  if (parts.length < 2) {
    return {
      valid: false,
      message: "Use format: symbol timeframe\nExample: xauusd 15m",
    };
  }

  const symbol = normalizeSymbol(parts[0]);
  const timeframe = normalizeTimeframe(parts[1]);
  const shouldSave = parts[2]?.toLowerCase() === "save";

  if (!SUPPORTED_SYMBOLS.includes(symbol)) {
    return {
      valid: false,
      message: `Unsupported symbol. Supported: ${SUPPORTED_SYMBOLS.join(", ")}`,
    };
  }

  if (!SUPPORTED_TIMEFRAMES.includes(timeframe)) {
    return {
      valid: false,
      message: `Unsupported timeframe. Supported: ${SUPPORTED_TIMEFRAMES.join(", ")}`,
    };
  }

  return {
    valid: true,
    type: "ANALYSIS",
    symbol,
    timeframe,
    shouldSave,
  };
};

const formatAnalysisReply = (analysis, savedSignal = null) => {
  if (!analysis.validSignal || !analysis.signal) {
    return [
      `No valid signal for ${analysis.symbol} ${analysis.timeframe}`,
      "",
      `Trend: ${analysis.marketStructure.trend}`,
      `Structure: ${analysis.marketStructure.structure}`,
      `Alignment: ${analysis.marketStructure.alignment}`,
      `RSI: ${analysis.indicators.rsi}`,
      `ATR: ${analysis.indicators.atr}`,
      "",
      `Reason: ${analysis.reasons.join(", ")}`,
    ].join("\n");
  }

  const saveLine = savedSignal
    ? savedSignal.created
      ? "Saved: yes"
      : `Saved: no (${savedSignal.reason || "duplicate or skipped"})`
    : "Saved: no";

  return [
    `${analysis.signal.type} ${analysis.symbol} ${analysis.timeframe}`,
    "",
    `Entry: ${analysis.signal.entry}`,
    `SL: ${analysis.signal.stopLoss}`,
    `TP: ${analysis.signal.takeProfit}`,
    `Confidence: ${analysis.signal.confidence}`,
    `Entry Type: ${analysis.signal.entryType || "N/A"}`,
    `Current Price: ${analysis.signal.currentPrice || analysis.marketStructure.currentPrice}`,
    saveLine,
    "",
    "Reasons:",
    ...analysis.signal.reasons.map((reason) => `- ${reason}`),
  ].join("\n");
};

const handleTelegramCommand = async (text) => {
  const parsed = parseTelegramCommand(text);

  if (!parsed.valid) {
    return parsed.message;
  }

  if (parsed.type === "STATS") {
    const stats = await getTradingStats();
    return formatStatsReply(stats);
  }

  const analysis = await analyzeMarket({
    symbol: parsed.symbol,
    timeframe: parsed.timeframe,
    candleLimit: 250,
    minimumConfidence: 65,
  });

  let savedSignal = null;

  if (parsed.shouldSave && analysis.validSignal && analysis.signal) {
    savedSignal = await createSignalIfValid({
      symbol: analysis.symbol,
      timeframe: analysis.timeframe,
      ...analysis.signal,
      source: "MANUAL",
      analysisSnapshot: {
        indicators: analysis.indicators,
        structure: analysis.marketStructure,
        latestCandle: analysis.latestCandle,
        reasons: analysis.reasons,
      },
    });
  }

  return formatAnalysisReply(analysis, savedSignal);
};

module.exports = {
  parseTelegramCommand,
  handleTelegramCommand,
};
