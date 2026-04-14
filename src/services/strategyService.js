const RISK_REWARD_RATIO = 3;
const ENTRY_TOLERANCE_MULTIPLIER = 0.2;

const roundPrice = (value) => Number(value.toFixed(5));

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

const determineBuyEntry = ({ marketStructure, executionPrice, atr }) => {
  const idealEntry = marketStructure.supportZone.mid;
  const tolerance = getEntryTolerance(atr);
  const closeEnough = Math.abs(executionPrice - idealEntry) <= tolerance;
  const shouldUseLimit = executionPrice > idealEntry + tolerance;

  if (closeEnough || !shouldUseLimit) {
    return {
      entryType: "MARKET",
      entryPrice: executionPrice,
      reason: "Current price is close enough to support for market execution",
    };
  }

  return {
    entryType: "BUY_LIMIT",
    entryPrice: idealEntry,
    reason: "Current price is extended above support; using support midpoint as buy limit entry",
  };
};

const determineSellEntry = ({ marketStructure, executionPrice, atr }) => {
  const idealEntry = marketStructure.resistanceZone.mid;
  const tolerance = getEntryTolerance(atr);
  const closeEnough = Math.abs(executionPrice - idealEntry) <= tolerance;
  const shouldUseLimit = executionPrice < idealEntry - tolerance;

  if (closeEnough || !shouldUseLimit) {
    return {
      entryType: "MARKET",
      entryPrice: executionPrice,
      reason:
        "Current price is close enough to resistance for market execution",
    };
  }

  return {
    entryType: "SELL_LIMIT",
    entryPrice: idealEntry,
    reason:
      "Current price is extended below resistance; using resistance midpoint as sell limit entry",
  };
};

const scoreBuySetup = ({ indicators, marketStructure }) => {
  let confidence = 0;
  const reasons = [];

  if (marketStructure.trend === "BULLISH") {
    confidence += 20;
    reasons.push("Trend is bullish");
  }

  if (marketStructure.structure === "UPTREND_STRUCTURE") {
    confidence += 15;
    reasons.push("Market structure supports upside continuation");
  }

  if (marketStructure.nearSupport) {
    confidence += 25;
    reasons.push("Price is near support zone");
  }

  if (indicators.rsi < 65) {
    confidence += 15;
    reasons.push("RSI is not overheated for a buy");
  }

  if (indicators.rsi >= 45 && indicators.rsi <= 60) {
    confidence += 10;
    reasons.push("RSI is in a favorable continuation range");
  }

  if (marketStructure.currentPrice > marketStructure.supportZone.mid) {
    confidence += 5;
    reasons.push("Price is holding above support midpoint");
  }

  return {
    confidence,
    reasons,
  };
};

const scoreSellSetup = ({ indicators, marketStructure }) => {
  let confidence = 0;
  const reasons = [];

  if (marketStructure.trend === "BEARISH") {
    confidence += 20;
    reasons.push("Trend is bearish");
  }

  if (marketStructure.structure === "DOWNTREND_STRUCTURE") {
    confidence += 15;
    reasons.push("Market structure supports downside continuation");
  }

  if (marketStructure.nearResistance) {
    confidence += 25;
    reasons.push("Price is near resistance zone");
  }

  if (indicators.rsi > 35) {
    confidence += 15;
    reasons.push("RSI is not exhausted for a sell");
  }

  if (indicators.rsi >= 40 && indicators.rsi <= 55) {
    confidence += 10;
    reasons.push("RSI is in a favorable continuation range");
  }

  if (marketStructure.currentPrice < marketStructure.resistanceZone.mid) {
    confidence += 5;
    reasons.push("Price is holding below resistance midpoint");
  }

  return {
    confidence,
    reasons,
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

  if (marketStructure.alignment === "CONFLICT") {
    return {
      valid: false,
      signal: null,
      reasons: ["Trend and structure are not aligned"],
    };
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
    marketStructure.trend === "BULLISH" &&
    marketStructure.structure === "UPTREND_STRUCTURE" &&
    marketStructure.nearSupport &&
    indicators.rsi < 65;

  const sellConditionsMet =
    marketStructure.trend === "BEARISH" &&
    marketStructure.structure === "DOWNTREND_STRUCTURE" &&
    marketStructure.nearResistance &&
    indicators.rsi > 35;

  if (buyConditionsMet) {
    const { confidence, reasons } = scoreBuySetup({
      indicators,
      marketStructure,
    });

    if (confidence < minimumConfidence) {
      return {
        valid: false,
        signal: null,
        reasons: ["BUY setup found but confidence below threshold", ...reasons],
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
          ...reasons,
        ],
      };
    }

    const entryDecision = determineBuyEntry({
      marketStructure,
      executionPrice,
      atr: indicators.atr,
    });
    const tradeLevels = calculateBuyLevels(entryDecision.entryPrice, indicators.atr);

    return {
      valid: true,
      signal: {
        symbol: symbol.toUpperCase(),
        timeframe,
        type: "BUY",
        setupPrice: roundPrice(setupPrice),
        currentPrice: roundPrice(executionPrice),
        entryType: entryDecision.entryType,
        status: entryDecision.entryType === "MARKET" ? "TRIGGERED" : "PENDING",
        ...tradeLevels,
        confidence,
        reasons: [
          ...reasons,
          entryDecision.reason,
          ...(confirmationCheck.reason ? [confirmationCheck.reason] : []),
        ],
      },
    };
  }

  if (sellConditionsMet) {
    const { confidence, reasons } = scoreSellSetup({
      indicators,
      marketStructure,
    });

    if (confidence < minimumConfidence) {
      return {
        valid: false,
        signal: null,
        reasons: [
          "SELL setup found but confidence below threshold",
          ...reasons,
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
          ...reasons,
        ],
      };
    }

    const entryDecision = determineSellEntry({
      marketStructure,
      executionPrice,
      atr: indicators.atr,
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
        status: entryDecision.entryType === "MARKET" ? "TRIGGERED" : "PENDING",
        ...tradeLevels,
        confidence,
        reasons: [
          ...reasons,
          entryDecision.reason,
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
