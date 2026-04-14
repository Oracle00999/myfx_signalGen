const { getCurrentPrice } = require("./dataService");
const { analyzeSingleTimeframeMarket } = require("./analyzerService");

const HIGHER_TIMEFRAME = "1h";
const MIDDLE_TIMEFRAME = "30m";
const ENTRY_TIMEFRAME = "15m";

const summarizeTimeframeAnalysis = (analysis) => ({
  timeframe: analysis.timeframe,
  trend: analysis.marketStructure?.trend ?? null,
  structure: analysis.marketStructure?.structure ?? null,
  alignment: analysis.marketStructure?.alignment ?? null,
});

const summarizeMultiTimeframeAnalysis = (analysis) => ({
  higherTimeframe: summarizeTimeframeAnalysis(analysis.higherTimeframe),
  middleTimeframe: summarizeTimeframeAnalysis(analysis.middleTimeframe),
  confirmation: analysis.confirmation,
});

const buildConfirmation = ({ higherTimeframe, middleTimeframe }) => {
  const higherTrend = higherTimeframe.marketStructure?.trend;
  const middleAlignment = middleTimeframe.marketStructure?.alignment;

  if (
    higherTrend === "BULLISH" &&
    middleAlignment === "BULLISH_ALIGNED"
  ) {
    return {
      bias: "BUY",
      confirmed: true,
      reason: "1h bullish and 30m bullish aligned",
    };
  }

  if (
    higherTrend === "BEARISH" &&
    middleAlignment === "BEARISH_ALIGNED"
  ) {
    return {
      bias: "SELL",
      confirmed: true,
      reason: "1h bearish and 30m bearish aligned",
    };
  }

  if (higherTrend === "BULLISH") {
    return {
      bias: null,
      confirmed: false,
      reason: "1h is bullish but 30m is not bullish aligned",
    };
  }

  if (higherTrend === "BEARISH") {
    return {
      bias: null,
      confirmed: false,
      reason: "1h is bearish but 30m is not bearish aligned",
    };
  }

  return {
    bias: null,
    confirmed: false,
    reason: "Higher timeframe trend is not directional enough for confirmation",
  };
};

const analyzeMultiTimeframe = async (
  symbol,
  { candleLimit = 250, minimumConfidence = 65 } = {},
) => {
  const normalizedSymbol = symbol?.toUpperCase();

  let currentMarketPrice;
  try {
    currentMarketPrice = await getCurrentPrice(normalizedSymbol);
  } catch (error) {
    currentMarketPrice = undefined;
  }

  const sharedOptions = {
    symbol: normalizedSymbol,
    candleLimit,
    minimumConfidence,
    currentMarketPrice,
  };

  const [higherTimeframe, middleTimeframe] = await Promise.all([
    analyzeSingleTimeframeMarket({
      ...sharedOptions,
      timeframe: HIGHER_TIMEFRAME,
    }),
    analyzeSingleTimeframeMarket({
      ...sharedOptions,
      timeframe: MIDDLE_TIMEFRAME,
    }),
  ]);

  const confirmation = buildConfirmation({
    higherTimeframe,
    middleTimeframe,
  });

  const entryTimeframe = await analyzeSingleTimeframeMarket({
    ...sharedOptions,
    timeframe: ENTRY_TIMEFRAME,
    multiTimeframeConfirmation: confirmation,
  });

  return {
    symbol: normalizedSymbol,
    higherTimeframe,
    middleTimeframe,
    entryTimeframe,
    confirmation,
  };
};

module.exports = {
  analyzeMultiTimeframe,
  summarizeMultiTimeframeAnalysis,
};
