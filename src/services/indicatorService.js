const { EMA, RSI, ATR } = require("technicalindicators");

const extractSeries = (candles) => {
  if (!Array.isArray(candles) || candles.length === 0) {
    throw new Error("Candles array is required");
  }

  return {
    closes: candles.map((candle) => Number(candle.close)),
    highs: candles.map((candle) => Number(candle.high)),
    lows: candles.map((candle) => Number(candle.low)),
  };
};

const getLatestValue = (values, name) => {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error(`Unable to calculate ${name}. Not enough candle data.`);
  }

  return values[values.length - 1];
};

const calculateIndicators = (candles) => {
  if (!Array.isArray(candles) || candles.length < 200) {
    throw new Error(
      "At least 200 candles are required to calculate indicators",
    );
  }

  const { closes, highs, lows } = extractSeries(candles);

  const ema50Values = EMA.calculate({
    period: 50,
    values: closes,
  });

  const ema200Values = EMA.calculate({
    period: 200,
    values: closes,
  });

  const rsi14Values = RSI.calculate({
    period: 14,
    values: closes,
  });

  const atr14Values = ATR.calculate({
    period: 14,
    high: highs,
    low: lows,
    close: closes,
  });

  const ema50 = getLatestValue(ema50Values, "EMA 50");
  const ema200 = getLatestValue(ema200Values, "EMA 200");
  const rsi = getLatestValue(rsi14Values, "RSI 14");
  const atr = getLatestValue(atr14Values, "ATR 14");

  return {
    ema50: Number(ema50.toFixed(5)),
    ema200: Number(ema200.toFixed(5)),
    rsi: Number(rsi.toFixed(2)),
    atr: Number(atr.toFixed(5)),
  };
};

module.exports = {
  calculateIndicators,
};
