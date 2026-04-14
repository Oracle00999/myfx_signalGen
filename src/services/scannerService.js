const { analyzeMarket } = require("./analyzerService");
const {
  analyzeMultiTimeframe,
  summarizeMultiTimeframeAnalysis,
} = require("./multiTimeframeAnalysisService");
const { createSignalIfValid } = require("./signalService");

const DEFAULT_SYMBOLS = [
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "XAUUSD",
  //   "USDCAD",
  //   "AUDUSD",
  //   "USDCHF",
];

const scanMarket = async ({
  symbols = DEFAULT_SYMBOLS,
  timeframe = "15m",
  candleLimit = 250,
  minimumConfidence = 65,
}) => {
  if (!Array.isArray(symbols) || symbols.length === 0) {
    throw new Error("Symbols array is required");
  }

  const results = [];
  const normalizedTimeframe = String(timeframe).toLowerCase();
  const useMultiTimeframe = normalizedTimeframe === "15m";

  const analyses = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const multiTimeframeAnalysis = useMultiTimeframe
          ? await analyzeMultiTimeframe(symbol, {
              candleLimit,
              minimumConfidence,
            })
          : null;
        const analysis =
          multiTimeframeAnalysis?.entryTimeframe ||
          (await analyzeMarket({
            symbol,
            timeframe: normalizedTimeframe,
            candleLimit,
            minimumConfidence,
          }));

        return {
          symbol,
          success: true,
          analysis,
          multiTimeframe: multiTimeframeAnalysis
            ? summarizeMultiTimeframeAnalysis(multiTimeframeAnalysis)
            : null,
        };
      } catch (error) {
        return {
          symbol,
          success: false,
          error: error.message,
        };
      }
    }),
  );

  for (const item of analyses) {
    if (!item.success) {
      results.push(item);
      continue;
    }

    const { analysis, multiTimeframe } = item;

    if (analysis.validSignal && analysis.signal) {
      const saved = await createSignalIfValid({
        symbol: analysis.symbol,
        timeframe: analysis.timeframe,
        ...analysis.signal,
        source: "AUTO",
        analysisSnapshot: {
          indicators: analysis.indicators,
          structure: analysis.marketStructure,
          multiTimeframe,
        },
      });

      results.push({
        symbol: analysis.symbol,
        validSignal: true,
        saved,
        signal: analysis.signal,
        multiTimeframe,
      });
    } else {
      results.push({
        symbol: analysis.symbol,
        validSignal: false,
        reasons: analysis.reasons,
        multiTimeframe,
      });
    }
  }

  return {
    scannedAt: new Date().toISOString(),
    timeframe: normalizedTimeframe,
    total: symbols.length,
    results,
  };
};

module.exports = {
  scanMarket,
};
