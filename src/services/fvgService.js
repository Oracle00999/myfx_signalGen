const DEFAULT_LOOKBACK_CANDLES = 50;
const MIN_GAP_ATR_MULTIPLIER = 0.1;
const MAX_DISTANCE_ATR_MULTIPLIER = 2;

const roundPrice = (value) => Number(value.toFixed(5));

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeCandle = (candle) => ({
  high: toNumber(candle?.high),
  low: toNumber(candle?.low),
  time: candle?.time || candle?.datetime || null,
});

const isValidCandle = (candle) =>
  typeof candle.high === "number" && typeof candle.low === "number";

const getDistanceFromZone = (price, zone) => {
  if (price >= zone.low && price <= zone.high) return 0;
  if (price < zone.low) return zone.low - price;
  return price - zone.high;
};

const isFullyFilled = ({ candles, fvg, candle3Index }) => {
  const laterCandles = candles.slice(candle3Index + 1);

  if (fvg.type === "BULLISH") {
    return laterCandles.some((candle) => candle.low <= fvg.low);
  }

  return laterCandles.some((candle) => candle.high >= fvg.high);
};

const rankFvgs = (fvgs) =>
  [...fvgs].sort((a, b) => {
    if (b.candle3Index !== a.candle3Index) {
      return b.candle3Index - a.candle3Index;
    }

    return a.distanceFromCurrentPrice - b.distanceFromCurrentPrice;
  });

const buildFvg = ({ type, low, high, candle1, candle3, candle3Index }) => {
  const roundedLow = roundPrice(low);
  const roundedHigh = roundPrice(high);

  return {
    type,
    low: roundedLow,
    high: roundedHigh,
    mid: roundPrice((roundedLow + roundedHigh) / 2),
    gapSize: roundPrice(roundedHigh - roundedLow),
    candle1Time: candle1.time,
    candle3Time: candle3.time,
    candle3Index,
  };
};

const detectFairValueGaps = ({
  candles,
  atr,
  currentPrice,
  lookback = DEFAULT_LOOKBACK_CANDLES,
}) => {
  if (
    !Array.isArray(candles) ||
    candles.length < 3 ||
    !Number.isFinite(atr) ||
    !Number.isFinite(currentPrice)
  ) {
    return {
      bullish: null,
      bearish: null,
      all: [],
    };
  }

  const normalizedCandles = candles.map(normalizeCandle);
  const firstRecentCandle3Index = Math.max(
    2,
    normalizedCandles.length - lookback,
  );
  const minimumGapSize = atr * MIN_GAP_ATR_MULTIPLIER;
  const maximumDistance = atr * MAX_DISTANCE_ATR_MULTIPLIER;
  const candidates = [];

  for (
    let index = firstRecentCandle3Index;
    index < normalizedCandles.length;
    index++
  ) {
    const candle1 = normalizedCandles[index - 2];
    const candle3 = normalizedCandles[index];

    if (!isValidCandle(candle1) || !isValidCandle(candle3)) {
      continue;
    }

    if (candle1.high < candle3.low) {
      candidates.push(
        buildFvg({
          type: "BULLISH",
          low: candle1.high,
          high: candle3.low,
          candle1,
          candle3,
          candle3Index: index,
        }),
      );
    }

    if (candle1.low > candle3.high) {
      candidates.push(
        buildFvg({
          type: "BEARISH",
          low: candle3.high,
          high: candle1.low,
          candle1,
          candle3,
          candle3Index: index,
        }),
      );
    }
  }

  const validFvgs = candidates
    .map((fvg) => ({
      ...fvg,
      ageCandles: normalizedCandles.length - 1 - fvg.candle3Index,
      distanceFromCurrentPrice: roundPrice(
        getDistanceFromZone(currentPrice, fvg),
      ),
    }))
    .filter((fvg) => fvg.gapSize >= minimumGapSize)
    .filter((fvg) => fvg.distanceFromCurrentPrice <= maximumDistance)
    .filter(
      (fvg) =>
        !isFullyFilled({
          candles: normalizedCandles,
          fvg,
          candle3Index: fvg.candle3Index,
        }),
    );

  const all = rankFvgs(validFvgs);
  const bullish = all.filter((fvg) => fvg.type === "BULLISH");
  const bearish = all.filter((fvg) => fvg.type === "BEARISH");

  return {
    bullish: bullish[0] || null,
    bearish: bearish[0] || null,
    all,
  };
};

module.exports = {
  detectFairValueGaps,
};
