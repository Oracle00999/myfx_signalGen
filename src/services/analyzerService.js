const { getCandles, getCurrentPrice } = require("./dataService");
const { calculateIndicators } = require("./indicatorService");
const { analyzeMarketStructure } = require("./marketStructureService");
const { generateSignal } = require("./strategyService");

const getClosedCandles = (candles) => {
  if (!Array.isArray(candles) || candles.length < 2) {
    throw new Error("At least 2 candles are required to analyze closed candles");
  }

  const closedCandles = candles.slice(0, -1);
  const formingCandle = candles[candles.length - 1];
  const latestClosedCandle = closedCandles[closedCandles.length - 1];

  if (closedCandles.length < 200) {
    throw new Error(
      "At least 200 closed candles are required to calculate indicators",
    );
  }

  return {
    closedCandles,
    formingCandle,
    latestClosedCandle,
  };
};

const analyzeSingleTimeframeMarket = async ({
  symbol,
  timeframe = "15m",
  candleLimit = 250,
  minimumConfidence = 65,
  currentMarketPrice: providedCurrentMarketPrice,
  multiTimeframeConfirmation = null,
}) => {
  if (!symbol) {
    throw new Error("Symbol is required");
  }

  const normalizedSymbol = symbol.toUpperCase();

  const candles = await getCandles(normalizedSymbol, timeframe, candleLimit + 1);
  const { closedCandles, formingCandle, latestClosedCandle } =
    getClosedCandles(candles);

  const indicators = calculateIndicators(closedCandles);

  const marketStructure = analyzeMarketStructure({
    candles: closedCandles,
    indicators,
  });

  // Fetch current live price, fallback to latest candle close if unavailable
  let currentMarketPrice = providedCurrentMarketPrice;
  if (typeof currentMarketPrice !== "number") {
    currentMarketPrice = marketStructure.currentPrice;
  }

  if (typeof providedCurrentMarketPrice !== "number") {
    try {
      currentMarketPrice = await getCurrentPrice(normalizedSymbol);
    } catch (error) {
      // Fallback to the latest closed candle price when live price is unavailable
      currentMarketPrice =
        latestClosedCandle?.close || marketStructure.currentPrice;
    }
  }

  const signalResult = generateSignal({
    symbol: normalizedSymbol,
    timeframe,
    indicators,
    marketStructure,
    minimumConfidence,
    currentMarketPrice,
    multiTimeframeConfirmation,
    confirmationCandle: latestClosedCandle,
  });

  return {
    symbol: normalizedSymbol,
    timeframe,
    analyzedAt: new Date().toISOString(),
    candleCount: closedCandles.length,
    latestCandle: latestClosedCandle,
    formingCandle,
    indicators,
    marketStructure,
    multiTimeframeConfirmation,
    signal: signalResult.signal,
    validSignal: signalResult.valid,
    reasons: signalResult.reasons || signalResult.signal?.reasons || [],
  };
};

const analyzeMarket = async (options) => analyzeSingleTimeframeMarket(options);

module.exports = {
  analyzeMarket,
  analyzeSingleTimeframeMarket,
};
