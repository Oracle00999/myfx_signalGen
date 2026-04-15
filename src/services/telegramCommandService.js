const { analyzeMarket } = require("./analyzerService");
const {
  analyzeMultiTimeframe,
  summarizeMultiTimeframeAnalysis,
} = require("./multiTimeframeAnalysisService");
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
  const symbol = normalizeSymbol(parts[0]);

  if (!SUPPORTED_SYMBOLS.includes(symbol)) {
    return {
      valid: false,
      message: `Unsupported symbol. Supported: ${SUPPORTED_SYMBOLS.join(", ")}`,
    };
  }

  if (parts.length === 1) {
    return {
      valid: true,
      type: "MULTI_TIMEFRAME_ANALYSIS",
      symbol,
      shouldSave: false,
    };
  }

  if (parts.length === 2 && parts[1]?.toLowerCase() === "save") {
    return {
      valid: true,
      type: "MULTI_TIMEFRAME_ANALYSIS",
      symbol,
      shouldSave: true,
    };
  }

  const timeframe = normalizeTimeframe(parts[1]);
  const shouldSave = parts[2]?.toLowerCase() === "save";

  if (!SUPPORTED_TIMEFRAMES.includes(timeframe)) {
    return {
      valid: false,
      message: `Unsupported timeframe. Supported: ${SUPPORTED_TIMEFRAMES.join(", ")}`,
    };
  }

  if (parts.length > 3 || (parts.length === 3 && !shouldSave)) {
    return {
      valid: false,
      message:
        "Use: symbol, symbol save, symbol timeframe, or symbol timeframe save",
    };
  }

  return {
    valid: true,
    type: "SINGLE_TIMEFRAME_ANALYSIS",
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

const formatMultiTimeframeReply = (
  multiTimeframe,
  entryAnalysis,
  savedSignal = null,
) => {
  const summary = summarizeMultiTimeframeAnalysis(multiTimeframe);
  const saveLine = savedSignal
    ? savedSignal.created
      ? "Saved: yes"
      : `Saved: no (${savedSignal.reason || "duplicate or skipped"})`
    : "Saved: no";

  if (!entryAnalysis.validSignal || !entryAnalysis.signal) {
    return [
      `No valid signal for ${entryAnalysis.symbol} ${entryAnalysis.timeframe}`,
      "",
      "Multi-timeframe Summary",
      `1h Trend: ${summary.higherTimeframe.trend}`,
      `1h Structure: ${summary.higherTimeframe.structure}`,
      `1h Alignment: ${summary.higherTimeframe.alignment}`,
      `30m Trend: ${summary.middleTimeframe.trend}`,
      `30m Structure: ${summary.middleTimeframe.structure}`,
      `30m Alignment: ${summary.middleTimeframe.alignment}`,
      "",
      "Confirmation",
      `Bias: ${summary.confirmation.bias || "NONE"}`,
      `Confirmed: ${summary.confirmation.confirmed ? "YES" : "NO"}`,
      `Reason: ${summary.confirmation.reason}`,
      saveLine,
      "",
      `15m Result: ${entryAnalysis.reasons.join(", ")}`,
    ].join("\n");
  }

  return [
    `${entryAnalysis.signal.type} ${entryAnalysis.symbol} ${entryAnalysis.timeframe}`,
    "",
    "Multi-timeframe Summary",
    `1h Trend: ${summary.higherTimeframe.trend}`,
    `1h Structure: ${summary.higherTimeframe.structure}`,
    `1h Alignment: ${summary.higherTimeframe.alignment}`,
    `30m Trend: ${summary.middleTimeframe.trend}`,
    `30m Structure: ${summary.middleTimeframe.structure}`,
    `30m Alignment: ${summary.middleTimeframe.alignment}`,
    "",
    "Confirmation",
    `Bias: ${summary.confirmation.bias || "NONE"}`,
    `Confirmed: ${summary.confirmation.confirmed ? "YES" : "NO"}`,
    `Reason: ${summary.confirmation.reason}`,
    "",
    "15m Signal",
    `Entry: ${entryAnalysis.signal.entry}`,
    `SL: ${entryAnalysis.signal.stopLoss}`,
    `TP: ${entryAnalysis.signal.takeProfit}`,
    `Confidence: ${entryAnalysis.signal.confidence}`,
    `Entry Type: ${entryAnalysis.signal.entryType || "N/A"}`,
    `Current Price: ${entryAnalysis.signal.currentPrice || entryAnalysis.marketStructure.currentPrice}`,
    saveLine,
    "",
    "Reasons:",
    ...entryAnalysis.signal.reasons.map((reason) => `- ${reason}`),
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

  if (parsed.type === "MULTI_TIMEFRAME_ANALYSIS") {
    const multiTimeframe = await analyzeMultiTimeframe(parsed.symbol, {
      candleLimit: 250,
      minimumConfidence: 65,
    });
    const entryAnalysis = multiTimeframe.entryTimeframe;

    let savedSignal = null;

    if (parsed.shouldSave && entryAnalysis.validSignal && entryAnalysis.signal) {
      savedSignal = await createSignalIfValid({
        symbol: entryAnalysis.symbol,
        timeframe: entryAnalysis.timeframe,
        ...entryAnalysis.signal,
        source: "MANUAL",
        analysisSnapshot: {
          indicators: entryAnalysis.indicators,
          structure: entryAnalysis.marketStructure,
          latestCandle: entryAnalysis.latestCandle,
          reasons: entryAnalysis.reasons,
          multiTimeframe: summarizeMultiTimeframeAnalysis(multiTimeframe),
          confirmation: multiTimeframe.confirmation,
        },
      });
    }

    return formatMultiTimeframeReply(multiTimeframe, entryAnalysis, savedSignal);
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
