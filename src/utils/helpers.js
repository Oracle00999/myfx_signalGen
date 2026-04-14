const {
  SUPPORTED_SYMBOLS,
  SUPPORTED_TIMEFRAMES,
  SYMBOL_TO_OANDA_INSTRUMENT,
  TIMEFRAME_TO_OANDA_GRANULARITY,
} = require("./constants");

const isValidSymbol = (symbol) => {
  return SUPPORTED_SYMBOLS.includes(symbol);
};

const isValidTimeframe = (timeframe) => {
  return SUPPORTED_TIMEFRAMES.includes(timeframe);
};

const toOandaInstrument = (symbol) => {
  return SYMBOL_TO_OANDA_INSTRUMENT[symbol];
};

const toOandaGranularity = (timeframe) => {
  return TIMEFRAME_TO_OANDA_GRANULARITY[timeframe];
};

module.exports = {
  isValidSymbol,
  isValidTimeframe,
  toOandaInstrument,
  toOandaGranularity,
};
