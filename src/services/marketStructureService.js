const getTrendFromEMA = ({ ema50, ema200 }) => {
  if (ema50 > ema200) return "BULLISH";
  if (ema50 < ema200) return "BEARISH";
  return "SIDEWAYS";
};

const detectPivots = (candles, lookback = 100, left = 3, right = 3) => {
  const pivots = { highs: [], lows: [] };
  const sliced = candles.slice(-lookback);

  for (let i = left; i < sliced.length - right; i++) {
    const current = sliced[i];

    let isPivotHigh = true;
    let isPivotLow = true;

    for (let j = 1; j <= left; j++) {
      if (Number(current.high) <= Number(sliced[i - j].high))
        isPivotHigh = false;
      if (Number(current.low) >= Number(sliced[i - j].low)) isPivotLow = false;
    }

    for (let j = 1; j <= right; j++) {
      if (Number(current.high) <= Number(sliced[i + j].high))
        isPivotHigh = false;
      if (Number(current.low) >= Number(sliced[i + j].low)) isPivotLow = false;
    }

    if (isPivotHigh) pivots.highs.push(Number(current.high));
    if (isPivotLow) pivots.lows.push(Number(current.low));
  }

  return pivots;
};

const buildZone = (level, atr, multiplier = 0.25) => {
  const buffer = atr * multiplier;

  return {
    low: Number((level - buffer).toFixed(5)),
    high: Number((level + buffer).toFixed(5)),
    mid: Number(level.toFixed(5)),
  };
};

const getKeyLevelsFromPivots = (pivots, currentPrice) => {
  const { highs, lows } = pivots;

  if (!highs.length || !lows.length) {
    throw new Error("Not enough pivot data");
  }

  const resistanceCandidates = highs.filter((h) => h > currentPrice);
  const supportCandidates = lows.filter((l) => l < currentPrice);

  const resistance =
    resistanceCandidates.length > 0
      ? Math.min(...resistanceCandidates)
      : Math.max(...highs);

  const support =
    supportCandidates.length > 0
      ? Math.max(...supportCandidates)
      : Math.min(...lows);

  return { support, resistance };
};

const detectStructure = (pivots) => {
  const { highs, lows } = pivots;

  if (highs.length < 2 || lows.length < 2) return "UNKNOWN";

  const lastHigh = highs[highs.length - 1];
  const prevHigh = highs[highs.length - 2];
  const lastLow = lows[lows.length - 1];
  const prevLow = lows[lows.length - 2];

  if (lastHigh > prevHigh && lastLow > prevLow) return "UPTREND_STRUCTURE";
  if (lastHigh < prevHigh && lastLow < prevLow) return "DOWNTREND_STRUCTURE";

  return "RANGING_STRUCTURE";
};

const isPriceNearZone = (price, zone) => {
  return price >= zone.low && price <= zone.high;
};

const doZonesOverlap = (supportZone, resistanceZone) => {
  return supportZone.high >= resistanceZone.low;
};

const analyzeMarketStructure = ({ candles, indicators }) => {
  if (!Array.isArray(candles) || candles.length < 100) {
    throw new Error("At least 100 candles required");
  }

  const currentPrice = Number(candles[candles.length - 1].close);

  const trend = getTrendFromEMA(indicators);
  const pivots = detectPivots(candles, 100);
  const structure = detectStructure(pivots);
  const alignment =
    trend === "BULLISH" && structure === "UPTREND_STRUCTURE"
      ? "BULLISH_ALIGNED"
      : trend === "BEARISH" && structure === "DOWNTREND_STRUCTURE"
        ? "BEARISH_ALIGNED"
        : "CONFLICT";
  const { support, resistance } = getKeyLevelsFromPivots(pivots, currentPrice);

  const supportZone = buildZone(support, indicators.atr, 0.25);
  const resistanceZone = buildZone(resistance, indicators.atr, 0.25);

  const zonesOverlap = doZonesOverlap(supportZone, resistanceZone);

  let nearSupport = isPriceNearZone(currentPrice, supportZone);
  let nearResistance = isPriceNearZone(currentPrice, resistanceZone);

  if (zonesOverlap) {
    nearSupport = false;
    nearResistance = false;
  }

  return {
    trend,
    structure,
    alignment,
    currentPrice: Number(currentPrice.toFixed(5)),
    supportZone,
    resistanceZone,
    nearSupport,
    nearResistance,
    zonesOverlap,
  };
};

module.exports = {
  analyzeMarketStructure,
};
