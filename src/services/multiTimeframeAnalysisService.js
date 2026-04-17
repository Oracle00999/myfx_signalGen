const { getCurrentPrice } = require("./dataService");
const { analyzeSingleTimeframeMarket } = require("./analyzerService");

const HIGHER_TIMEFRAME = "1h";
const MIDDLE_TIMEFRAME = "30m";
const ENTRY_TIMEFRAME = "15m";
const ENTRY_POSITION_TOLERANCE_MULTIPLIER = 0.5;

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
  entryPositioning: analysis.entryPositioning,
});

const buildConfirmation = ({ higherTimeframe, middleTimeframe }) => {
  const higherTrend = higherTimeframe.marketStructure?.trend;
  const higherAlignment = higherTimeframe.marketStructure?.alignment;
  const middleAlignment = middleTimeframe.marketStructure?.alignment;

  if (
    higherAlignment === "BULLISH_ALIGNED" &&
    middleAlignment === "BULLISH_ALIGNED"
  ) {
    return {
      bias: "BUY",
      confirmed: true,
      reason: "1h and 30m are bullish aligned",
    };
  }

  if (
    higherAlignment === "BEARISH_ALIGNED" &&
    middleAlignment === "BEARISH_ALIGNED"
  ) {
    return {
      bias: "SELL",
      confirmed: true,
      reason: "1h and 30m are bearish aligned",
    };
  }

  if (higherTrend === "BULLISH") {
    if (higherAlignment !== "BULLISH_ALIGNED") {
      return {
        bias: "BUY",
        confirmed: false,
        reason: "1h bullish bias exists, but 1h structure is not aligned",
      };
    }

    return {
      bias: "BUY",
      confirmed: false,
      reason: "1h bullish bias exists, but 30m is not bullish aligned",
    };
  }

  if (higherTrend === "BEARISH") {
    if (higherAlignment !== "BEARISH_ALIGNED") {
      return {
        bias: "SELL",
        confirmed: false,
        reason: "1h bearish bias exists, but 1h structure is not aligned",
      };
    }

    return {
      bias: "SELL",
      confirmed: false,
      reason: "1h bearish bias exists, but 30m is not bearish aligned",
    };
  }

  return {
    bias: null,
    confirmed: false,
    reason: "Higher timeframe trend is not directional enough for confirmation",
  };
};

const validateEntryPositioning = ({ entryTimeframe, confirmation }) => {
  if (!confirmation?.confirmed || !confirmation?.bias) {
    return {
      valid: false,
      reason: "Higher timeframe confirmation is missing for entry positioning",
    };
  }

  const { indicators, marketStructure } = entryTimeframe;
  const currentPrice = marketStructure?.currentPrice;
  const atr = indicators?.atr;

  if (typeof currentPrice !== "number" || typeof atr !== "number") {
    return {
      valid: false,
      reason: "Entry timeframe is missing price or ATR context",
    };
  }

  const tolerance = atr * ENTRY_POSITION_TOLERANCE_MULTIPLIER;

  if (confirmation.bias === "BUY") {
    const zone = marketStructure.supportZone;
    const distanceFromZone = Math.abs(currentPrice - zone.mid);

    if (!marketStructure.nearSupport) {
      return {
        valid: false,
        reason: "15m buy entry is not positioned near support",
        distanceFromZone,
      };
    }

    if (distanceFromZone > tolerance) {
      return {
        valid: false,
        reason: "15m buy entry is too extended above support",
        distanceFromZone,
      };
    }

    return {
      valid: true,
      reason: "15m buy entry is well positioned near support",
      distanceFromZone,
    };
  }

  const zone = marketStructure.resistanceZone;
  const distanceFromZone = Math.abs(currentPrice - zone.mid);

  if (!marketStructure.nearResistance) {
    return {
      valid: false,
      reason: "15m sell entry is not positioned near resistance",
      distanceFromZone,
    };
  }

  if (distanceFromZone > tolerance) {
    return {
      valid: false,
      reason: "15m sell entry is too extended below resistance",
      distanceFromZone,
    };
  }

  return {
    valid: true,
    reason: "15m sell entry is well positioned near resistance",
    distanceFromZone,
  };
};

const applyEntryPositioning = (entryTimeframe, entryPositioning) => {
  if (!entryTimeframe.validSignal || !entryTimeframe.signal) {
    return entryTimeframe;
  }

  if (entryPositioning.valid) {
    return {
      ...entryTimeframe,
      signal: {
        ...entryTimeframe.signal,
        reasons: [...entryTimeframe.signal.reasons, entryPositioning.reason],
      },
    };
  }

  return {
    ...entryTimeframe,
    validSignal: false,
    signal: null,
    reasons: [
      "15m setup rejected by multi-timeframe entry positioning",
      entryPositioning.reason,
      ...entryTimeframe.reasons,
    ],
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
  const entryPositioning = validateEntryPositioning({
    entryTimeframe,
    confirmation,
  });
  const positionedEntryTimeframe = applyEntryPositioning(
    entryTimeframe,
    entryPositioning,
  );

  return {
    symbol: normalizedSymbol,
    higherTimeframe,
    middleTimeframe,
    entryTimeframe: positionedEntryTimeframe,
    confirmation,
    entryPositioning,
  };
};

module.exports = {
  analyzeMultiTimeframe,
  summarizeMultiTimeframeAnalysis,
};
