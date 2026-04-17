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

    if (isPivotHigh) {
      pivots.highs.push({
        price: Number(current.high),
        index: i,
        time: current.time,
      });
    }

    if (isPivotLow) {
      pivots.lows.push({
        price: Number(current.low),
        index: i,
        time: current.time,
      });
    }
  }

  return pivots;
};

const getNextOpposingPivot = (pivots, currentIndex, type) => {
  const opposingPivots = type === "high" ? pivots.lows : pivots.highs;
  return opposingPivots.find((pivot) => pivot.index > currentIndex) || null;
};

const filterStrongPivots = (pivots, atr) => {
  const minimumMove = atr;

  return {
    highs: pivots.highs.filter((pivot) => {
      const nextSwing = getNextOpposingPivot(pivots, pivot.index, "high");

      if (!nextSwing) {
        return false;
      }

      return Math.abs(pivot.price - nextSwing.price) >= minimumMove;
    }),
    lows: pivots.lows.filter((pivot) => {
      const nextSwing = getNextOpposingPivot(pivots, pivot.index, "low");

      if (!nextSwing) {
        return false;
      }

      return Math.abs(pivot.price - nextSwing.price) >= minimumMove;
    }),
  };
};

const buildZone = (pivot, atr, multiplier = 0.25) => {
  const level = pivot?.price ?? 0;
  const buffer = atr * multiplier;

  return {
    low: Number((level - buffer).toFixed(5)),
    high: Number((level + buffer).toFixed(5)),
    mid: Number(level.toFixed(5)),
    strong: Boolean(pivot?.strong),
    pivotTime: pivot?.time || null,
  };
};

const selectMostRecentPivot = (pivots, predicate) => {
  const candidates = pivots.filter(predicate);

  if (candidates.length === 0) {
    return null;
  }

  return candidates.sort((a, b) => b.index - a.index)[0];
};

const getKeyLevelsFromPivots = (pivots, strongPivots, currentPrice) => {
  const support =
    selectMostRecentPivot(
      strongPivots.lows,
      (pivot) => pivot.price < currentPrice,
    ) ||
    selectMostRecentPivot(pivots.lows, (pivot) => pivot.price < currentPrice) ||
    selectMostRecentPivot(strongPivots.lows, () => true) ||
    selectMostRecentPivot(pivots.lows, () => true);

  const resistance =
    selectMostRecentPivot(
      strongPivots.highs,
      (pivot) => pivot.price > currentPrice,
    ) ||
    selectMostRecentPivot(
      pivots.highs,
      (pivot) => pivot.price > currentPrice,
    ) ||
    selectMostRecentPivot(strongPivots.highs, () => true) ||
    selectMostRecentPivot(pivots.highs, () => true);

  if (!support || !resistance) {
    throw new Error("Not enough pivot data");
  }

  return {
    support: {
      ...support,
      strong: strongPivots.lows.some(
        (pivot) => pivot.index === support.index && pivot.price === support.price,
      ),
    },
    resistance: {
      ...resistance,
      strong: strongPivots.highs.some(
        (pivot) =>
          pivot.index === resistance.index && pivot.price === resistance.price,
      ),
    },
  };
};

const detectStructure = (pivots) => {
  const { highs, lows } = pivots;

  if (highs.length < 2 || lows.length < 2) return "UNKNOWN";

  const lastHigh = highs[highs.length - 1].price;
  const prevHigh = highs[highs.length - 2].price;
  const lastLow = lows[lows.length - 1].price;
  const prevLow = lows[lows.length - 2].price;

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
  const strongPivots = filterStrongPivots(pivots, indicators.atr);
  const structurePivots =
    strongPivots.highs.length >= 2 && strongPivots.lows.length >= 2
      ? strongPivots
      : pivots;
  const structure = detectStructure(structurePivots);
  const alignment =
    trend === "BULLISH" && structure === "UPTREND_STRUCTURE"
      ? "BULLISH_ALIGNED"
      : trend === "BEARISH" && structure === "DOWNTREND_STRUCTURE"
        ? "BEARISH_ALIGNED"
        : "CONFLICT";
  const { support, resistance } = getKeyLevelsFromPivots(
    pivots,
    strongPivots,
    currentPrice,
  );

  const supportZone = buildZone(support, indicators.atr, 0.25);
  const resistanceZone = buildZone(resistance, indicators.atr, 0.25);

  const zonesOverlap = doZonesOverlap(supportZone, resistanceZone);

  let nearSupport = supportZone.strong && isPriceNearZone(currentPrice, supportZone);
  let nearResistance =
    resistanceZone.strong && isPriceNearZone(currentPrice, resistanceZone);

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
    strongPivots: {
      highs: strongPivots.highs.length,
      lows: strongPivots.lows.length,
    },
  };
};

module.exports = {
  analyzeMarketStructure,
};
