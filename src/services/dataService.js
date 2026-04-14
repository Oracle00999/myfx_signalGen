const axios = require("axios");
const { isValidSymbol, isValidTimeframe } = require("../utils/helpers");

const BASE_URL = process.env.TWELVEDATA_BASE_URL;
const API_KEY = process.env.TWELVEDATA_API_KEY;

const timeframeMap = {
  "5m": "5min",
  "15m": "15min",
  "30m": "30min",
  "1h": "1h",
  "4h": "4h",
};

const formatSymbol = (symbol) => {
  // TwelveData uses slash format
  return symbol.replace(/([A-Z]{3})([A-Z]{3})/, "$1/$2");
};

const normalizeCandle = (candle) => {
  return {
    time: candle.datetime,
    open: Number(candle.open),
    high: Number(candle.high),
    low: Number(candle.low),
    close: Number(candle.close),
  };
};

const getCandles = async (symbol, timeframe = "15m", limit = 200) => {
  if (!API_KEY) throw new Error("Missing TWELVEDATA_API_KEY");

  const normalizedSymbol = symbol?.toUpperCase();

  if (!isValidSymbol(normalizedSymbol)) {
    throw new Error(`Unsupported symbol: ${normalizedSymbol}`);
  }

  const interval = timeframeMap[timeframe];
  if (!interval) {
    throw new Error(`Unsupported timeframe: ${timeframe}`);
  }

  const formattedSymbol = formatSymbol(normalizedSymbol);

  try {
    const response = await axios.get(`${BASE_URL}/time_series`, {
      params: {
        symbol: formattedSymbol,
        interval,
        outputsize: limit,
        apikey: API_KEY,
      },
    });

    if (!response.data.values) {
      throw new Error(response.data.message || "No data returned");
    }

    // API returns newest first → reverse it
    return response.data.values.reverse().map(normalizeCandle);
  } catch (error) {
    throw new Error(
      `Failed to fetch candles: ${
        error.response?.data?.message || error.message
      }`,
    );
  }
};

const getCurrentPrice = async (symbol) => {
  if (!API_KEY) throw new Error("Missing TWELVEDATA_API_KEY");

  const normalizedSymbol = symbol?.toUpperCase();

  if (!isValidSymbol(normalizedSymbol)) {
    throw new Error(`Unsupported symbol: ${normalizedSymbol}`);
  }

  const formattedSymbol = formatSymbol(normalizedSymbol);

  try {
    const response = await axios.get(`${BASE_URL}/quote`, {
      params: {
        symbol: formattedSymbol,
        apikey: API_KEY,
      },
    });

    if (!response.data.last_price) {
      throw new Error(response.data.message || "No price data returned");
    }

    return Number(response.data.last_price);
  } catch (error) {
    throw new Error(
      `Failed to fetch current price: ${
        error.response?.data?.message || error.message
      }`,
    );
  }
};

module.exports = {
  getCandles,
  getCurrentPrice,
};
