const RISK_REWARD_RATIO = 3;
const ENTRY_TOLERANCE_MULTIPLIER = 0.2;
const ZONE_DISTANCE_TOLERANCE_MULTIPLIER = 0.5;
const BASE_CONFIDENCE = 50;

const roundPrice = (value) => Number(value.toFixed(5));
const clampConfidence = (value) => Math.max(0, Math.min(100, Math.round(value)));

const calculateBuyLevels = (entry, atr) => {
  const risk = atr;

  return {
    entry: roundPrice(entry),
    stopLoss: roundPrice(entry - risk),
    takeProfit: roundPrice(entry + risk * RISK_REWARD_RATIO),
  };
};

const calculateSellLevels = (entry, atr) => {
  const risk = atr;

  return {
    entry: roundPrice(entry),
    stopLoss: roundPrice(entry + risk),
    takeProfit: roundPrice(entry - risk * RISK_REWARD_RATIO),
  };
};

const getEntryTolerance = (atr) => atr * ENTRY_TOLERANCE_MULTIPLIER;
const getZoneDistanceTolerance = (atr) =>
  atr * ZONE_DISTANCE_TOLERANCE_MULTIPLIER;
const getDirectionalZone = (signalType, marketStructure) =>
  signalType === "BUY"
    ? marketStructure.supportZone
    : marketStructure.resistanceZone;

const isAlignmentForSignal = (signalType, alignment) =>
  (signalType === "BUY" && alignment === "BULLISH_ALIGNED") ||
  (signalType === "SELL" && alignment === "BEARISH_ALIGNED");

const isRsiInContinuationRange = (signalType, rsi) =>
  signalType === "BUY" ? rsi >= 45 && rsi <= 60 : rsi >= 40 && rsi <= 55;

const isRsiTooExtended = (signalType, rsi) =>
  signalType === "BUY" ? rsi > 65 : rsi < 35;

const isPriceRespectingZone = (signalType, marketStructure) =>
  signalType === "BUY"
    ? marketStructure.currentPrice >= marketStructure.supportZone.mid
    : marketStructure.currentPrice <= marketStructure.resistanceZone.mid;

const getZoneDistance = (price, zone) => Math.abs(price - zone.mid);

const buildConfidenceScore = ({
  signalType,
  indicators,
  marketStructure,
  executionPrice,
}) => {
  let confidence = BASE_CONFIDENCE;
  const reasons = [];
  const zone = getDirectionalZone(signalType, marketStructure);
  const priceDistanceFromZone = getZoneDistance(executionPrice, zone);
  const zoneDistanceTolerance = getZoneDistanceTolerance(indicators.atr);

  if (isAlignmentForSignal(signalType, marketStructure.alignment)) {
    confidence += 15;
    reasons.push("Trend and structure are aligned");
  } else if (marketStructure.alignment === "CONFLICT") {
    confidence -= 20;
    reasons.push("Trend and structure are conflicting");
  }

  if (zone?.strong && priceDistanceFromZone <= zoneDistanceTolerance) {
    confidence += 10;
    reasons.push("Price is positioned near a strong zone");
  } else if (priceDistanceFromZone > zoneDistanceTolerance) {
    confidence -= 10;
    reasons.push(
      `Price is ${roundPrice(priceDistanceFromZone)} away from the zone which exceeds the ATR tolerance`,
    );
  }

  if (isRsiInContinuationRange(signalType, indicators.rsi)) {
    confidence += 10;
    reasons.push("RSI is in a continuation range");
  }

  if (isPriceRespectingZone(signalType, marketStructure)) {
    confidence += 10;
    reasons.push(
      signalType === "BUY"
        ? "Price is holding above support"
        : "Price is holding below resistance",
    );
  }

  if (marketStructure.structure === "RANGING_STRUCTURE") {
    confidence -= 10;
    reasons.push("Market structure is ranging");
  }

  if (isRsiTooExtended(signalType, indicators.rsi)) {
    confidence -= 10;
    reasons.push(
      signalType === "BUY"
        ? "RSI is too high for a buy"
        : "RSI is too low for a sell",
    );
  }

  return {
    confidence: clampConfidence(confidence),
    reasons,
  };
};

const getCandleMetrics = (candle) => {
  const open = Number(candle.open);
  const close = Number(candle.close);
  const high = Number(candle.high);
  const low = Number(candle.low);
  const body = Math.abs(close - open);
  const range = Math.max(high - low, 0);
  const effectiveBody = Math.max(body, range * 0.1, Number.EPSILON);
  const upperWick = Math.max(high - Math.max(open, close), 0);
  const lowerWick = Math.max(Math.min(open, close) - low, 0);

  return {
    open,
    close,
    effectiveBody,
    upperWick,
    lowerWick,
  };
};

const validateConfirmationCandle = ({ signalType, candle }) => {
  if (!candle) {
    return {
      valid: false,
      reason: "Missing last closed candle confirmation",
    };
  }

  const metrics = getCandleMetrics(candle);
  const strongBearishRejection =
    metrics.close <= metrics.open &&
    metrics.upperWick >= metrics.effectiveBody * 2 &&
    metrics.upperWick > metrics.lowerWick;
  const strongBullishRejection =
    metrics.close >= metrics.open &&
    metrics.lowerWick >= metrics.effectiveBody * 2 &&
    metrics.lowerWick > metrics.upperWick;

  if (signalType === "BUY" && strongBearishRejection) {
    return {
      valid: false,
      reason: "Last closed candle shows strong bearish rejection",
    };
  }

  if (signalType === "SELL" && strongBullishRejection) {
    return {
      valid: false,
      reason: "Last closed candle shows strong bullish rejection",
    };
  }

  return {
    valid: true,
    reason: "Last closed candle confirms the setup",
  };
};

const determineBuyEntry = ({
  marketStructure,
  executionPrice,
  atr,
  fvgContext,
}) => {
  if (fvgContext?.bullish) {
    return {
      entryType: "BUY_LIMIT",
      entrySource: "FVG",
      entryPrice: fvgContext.bullish.mid,
      reason: "Using bullish FVG midpoint as buy limit entry",
    };
  }

  const idealEntry = marketStructure.supportZone.mid;
  const tolerance = getEntryTolerance(atr);
  const closeEnough = Math.abs(executionPrice - idealEntry) <= tolerance;
  const shouldUseLimit = executionPrice > idealEntry + tolerance;

  if (closeEnough || !shouldUseLimit) {
    return {
      entryType: "MARKET",
      entrySource: "MARKET",
      entryPrice: executionPrice,
      reason: "Current price is close enough to support for market execution",
    };
  }

  return {
    entryType: "BUY_LIMIT",
    entrySource: "SUPPORT_ZONE",
    entryPrice: idealEntry,
    reason:
      "Current price is extended above support; using support midpoint as buy limit entry",
  };
};

const determineSellEntry = ({
  marketStructure,
  executionPrice,
  atr,
  fvgContext,
}) => {
  if (fvgContext?.bearish) {
    return {
      entryType: "SELL_LIMIT",
      entrySource: "FVG",
      entryPrice: fvgContext.bearish.mid,
      reason: "Using bearish FVG midpoint as sell limit entry",
    };
  }

  const idealEntry = marketStructure.resistanceZone.mid;
  const tolerance = getEntryTolerance(atr);
  const closeEnough = Math.abs(executionPrice - idealEntry) <= tolerance;
  const shouldUseLimit = executionPrice < idealEntry - tolerance;

  if (closeEnough || !shouldUseLimit) {
    return {
      entryType: "MARKET",
      entrySource: "MARKET",
      entryPrice: executionPrice,
      reason:
        "Current price is close enough to resistance for market execution",
    };
  }

  return {
    entryType: "SELL_LIMIT",
    entrySource: "RESISTANCE_ZONE",
    entryPrice: idealEntry,
    reason:
      "Current price is extended below resistance; using resistance midpoint as sell limit entry",
  };
};

const validateMultiTimeframeConfirmation = ({
  signalType,
  multiTimeframeConfirmation,
}) => {
  if (!multiTimeframeConfirmation) {
    return {
      valid: true,
      reason: null,
    };
  }

  if (!multiTimeframeConfirmation.confirmed || !multiTimeframeConfirmation.bias) {
    return {
      valid: false,
      reason:
        multiTimeframeConfirmation.reason ||
        "Higher timeframes are not aligned for this setup",
    };
  }

  if (multiTimeframeConfirmation.bias !== signalType) {
    return {
      valid: false,
      reason:
        multiTimeframeConfirmation.reason ||
        `Higher timeframes support ${multiTimeframeConfirmation.bias}, not ${signalType}`,
    };
  }

  return {
    valid: true,
    reason:
      multiTimeframeConfirmation.reason ||
      `Higher timeframes confirm ${signalType} bias`,
  };
};

const generateSignal = ({
  symbol,
  timeframe = "15m",
  indicators,
  marketStructure,
  minimumConfidence = 65,
  currentMarketPrice,
  multiTimeframeConfirmation = null,
  confirmationCandle = null,
  fvgContext = null,
}) => {
  if (!symbol) throw new Error("Symbol is required");
  if (
    !indicators ||
    typeof indicators.atr !== "number" ||
    typeof indicators.rsi !== "number"
  ) {
    throw new Error("Valid indicators are required");
  }
  if (!marketStructure || typeof marketStructure.currentPrice !== "number") {
    throw new Error("Valid market structure is required");
  }

  if (marketStructure.zonesOverlap) {
    return {
      valid: false,
      signal: null,
      reasons: [
        "Support and resistance zones overlap; market structure is unclear",
      ],
    };
  }

  if (marketStructure.nearSupport && marketStructure.nearResistance) {
    return {
      valid: false,
      signal: null,
      reasons: [
        "Price is near both support and resistance; setup is conflicted",
      ],
    };
  }

  const setupPrice = marketStructure.currentPrice;
  const executionPrice =
    typeof currentMarketPrice === "number" ? currentMarketPrice : setupPrice;
  const buyConditionsMet =
    marketStructure.trend === "BULLISH" && marketStructure.nearSupport;
  const sellConditionsMet =
    marketStructure.trend === "BEARISH" && marketStructure.nearResistance;

  if (buyConditionsMet) {
    const confidenceResult = buildConfidenceScore({
      signalType: "BUY",
      indicators,
      marketStructure,
      executionPrice,
    });

    if (confidenceResult.confidence < minimumConfidence) {
      return {
        valid: false,
        signal: null,
        reasons: [
          `BUY setup found but confidence is ${confidenceResult.confidence}, below ${minimumConfidence}`,
          ...confidenceResult.reasons,
        ],
      };
    }

    const confirmationCandleCheck = validateConfirmationCandle({
      signalType: "BUY",
      candle: confirmationCandle,
    });

    if (!confirmationCandleCheck.valid) {
      return {
        valid: false,
        signal: null,
        reasons: [
          "BUY setup rejected by closed-candle confirmation",
          confirmationCandleCheck.reason,
          ...confidenceResult.reasons,
        ],
      };
    }

    const confirmationCheck = validateMultiTimeframeConfirmation({
      signalType: "BUY",
      multiTimeframeConfirmation,
    });

    if (!confirmationCheck.valid) {
      return {
        valid: false,
        signal: null,
        reasons: [
          "BUY setup rejected by multi-timeframe confirmation",
          confirmationCheck.reason,
          ...confidenceResult.reasons,
        ],
      };
    }

    const entryDecision = determineBuyEntry({
      marketStructure,
      executionPrice,
      atr: indicators.atr,
      fvgContext,
    });
    const tradeLevels = calculateBuyLevels(
      entryDecision.entryPrice,
      indicators.atr,
    );

    return {
      valid: true,
      signal: {
        symbol: symbol.toUpperCase(),
        timeframe,
        type: "BUY",
        setupPrice: roundPrice(setupPrice),
        currentPrice: roundPrice(executionPrice),
        entryType: entryDecision.entryType,
        entrySource: entryDecision.entrySource,
        status: entryDecision.entryType === "MARKET" ? "TRIGGERED" : "PENDING",
        ...tradeLevels,
        confidence: confidenceResult.confidence,
        reasons: [
          ...confidenceResult.reasons,
          entryDecision.reason,
          confirmationCandleCheck.reason,
          ...(confirmationCheck.reason ? [confirmationCheck.reason] : []),
        ],
      },
    };
  }

  if (sellConditionsMet) {
    const confidenceResult = buildConfidenceScore({
      signalType: "SELL",
      indicators,
      marketStructure,
      executionPrice,
    });

    if (confidenceResult.confidence < minimumConfidence) {
      return {
        valid: false,
        signal: null,
        reasons: [
          `SELL setup found but confidence is ${confidenceResult.confidence}, below ${minimumConfidence}`,
          ...confidenceResult.reasons,
        ],
      };
    }

    const confirmationCandleCheck = validateConfirmationCandle({
      signalType: "SELL",
      candle: confirmationCandle,
    });

    if (!confirmationCandleCheck.valid) {
      return {
        valid: false,
        signal: null,
        reasons: [
          "SELL setup rejected by closed-candle confirmation",
          confirmationCandleCheck.reason,
          ...confidenceResult.reasons,
        ],
      };
    }

    const confirmationCheck = validateMultiTimeframeConfirmation({
      signalType: "SELL",
      multiTimeframeConfirmation,
    });

    if (!confirmationCheck.valid) {
      return {
        valid: false,
        signal: null,
        reasons: [
          "SELL setup rejected by multi-timeframe confirmation",
          confirmationCheck.reason,
          ...confidenceResult.reasons,
        ],
      };
    }

    const entryDecision = determineSellEntry({
      marketStructure,
      executionPrice,
      atr: indicators.atr,
      fvgContext,
    });
    const tradeLevels = calculateSellLevels(
      entryDecision.entryPrice,
      indicators.atr,
    );

    return {
      valid: true,
      signal: {
        symbol: symbol.toUpperCase(),
        timeframe,
        type: "SELL",
        setupPrice: roundPrice(setupPrice),
        currentPrice: roundPrice(executionPrice),
        entryType: entryDecision.entryType,
        entrySource: entryDecision.entrySource,
        status: entryDecision.entryType === "MARKET" ? "TRIGGERED" : "PENDING",
        ...tradeLevels,
        confidence: confidenceResult.confidence,
        reasons: [
          ...confidenceResult.reasons,
          entryDecision.reason,
          confirmationCandleCheck.reason,
          ...(confirmationCheck.reason ? [confirmationCheck.reason] : []),
        ],
      },
    };
  }

  return {
    valid: false,
    signal: null,
    reasons: ["No valid BUY or SELL setup found"],
  };
};

module.exports = {
  generateSignal,
};
