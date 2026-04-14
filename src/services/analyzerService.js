const { getCandles, getCurrentPrice } = require("./dataService");
const { calculateIndicators } = require("./indicatorService");
const { analyzeMarketStructure } = require("./marketStructureService");
const { generateSignal } = require("./strategyService");

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

  const candles = await getCandles(normalizedSymbol, timeframe, candleLimit);

  const indicators = calculateIndicators(candles);

  const marketStructure = analyzeMarketStructure({
    candles,
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
      // Fallback to latest candle close price
      currentMarketPrice =
        candles[candles.length - 1]?.close || marketStructure.currentPrice;
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
  });

  return {
    symbol: normalizedSymbol,
    timeframe,
    analyzedAt: new Date().toISOString(),
    candleCount: candles.length,
    latestCandle: candles[candles.length - 1],
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
