const { getCandles } = require("./dataService");
const { getActiveSignals, updateSignalStatus } = require("./signalService");

const isExpired = (signal) => {
  if (!signal.expires_at) return false;
  return new Date() > new Date(signal.expires_at);
};

const getEntryType = (signal) => {
  return (
    signal.entry_type ||
    signal.analysis_snapshot?.entryType ||
    signal.entryType ||
    "MARKET"
  );
};

const checkEntryTrigger = (signal, candle) => {
  const entryType = getEntryType(signal);

  if (signal.type === "BUY") {
    if (entryType === "BUY_LIMIT") {
      return candle.low <= signal.entry;
    }

    return candle.high >= signal.entry;
  }

  if (signal.type === "SELL") {
    if (entryType === "SELL_LIMIT") {
      return candle.high >= signal.entry;
    }

    return candle.low <= signal.entry;
  }

  return false;
};

const checkTpSlHit = (signal, candle) => {
  if (signal.type === "BUY") {
    if (candle.low <= signal.stop_loss) {
      return "SL_HIT";
    }
    if (candle.high >= signal.take_profit) {
      return "TP_HIT";
    }
  }

  if (signal.type === "SELL") {
    if (candle.high >= signal.stop_loss) {
      return "SL_HIT";
    }
    if (candle.low <= signal.take_profit) {
      return "TP_HIT";
    }
  }

  return null;
};

const processSignal = async (signal) => {
  try {
    // Expiration
    if (isExpired(signal)) {
      await updateSignalStatus(signal.id, {
        status: "EXPIRED",
        closedAt: new Date(),
      });

      return {
        id: signal.id,
        status: "EXPIRED",
        previousStatus: signal.status,
        changed: true,
      };
    }

    const candles = await getCandles(signal.symbol, signal.timeframe, 2);
    const latestCandle = candles[candles.length - 1];

    // PENDING → check trigger
    if (signal.status === "PENDING") {
      if (getEntryType(signal) === "MARKET") {
        await updateSignalStatus(signal.id, {
          status: "TRIGGERED",
          triggeredAt: new Date(),
        });

        return {
          id: signal.id,
          status: "TRIGGERED",
          previousStatus: "PENDING",
          changed: true,
        };
      }

      const triggered = checkEntryTrigger(signal, latestCandle);

      if (triggered) {
        await updateSignalStatus(signal.id, {
          status: "TRIGGERED",
          triggeredAt: new Date(),
        });

        return {
          id: signal.id,
          status: "TRIGGERED",
          previousStatus: "PENDING",
          changed: true,
        };
      }

      return {
        id: signal.id,
        status: "PENDING",
        changed: false,
      };
    }

    // TRIGGERED → check TP/SL
    if (signal.status === "TRIGGERED") {
      const result = checkTpSlHit(signal, latestCandle);

      if (result === "TP_HIT" || result === "SL_HIT") {
        await updateSignalStatus(signal.id, {
          status: result,
          closedAt: new Date(),
        });

        return {
          id: signal.id,
          status: result,
          previousStatus: "TRIGGERED",
          changed: true,
        };
      }

      return {
        id: signal.id,
        status: "TRIGGERED",
        changed: false,
      };
    }

    return {
      id: signal.id,
      status: signal.status,
      changed: false,
    };
  } catch (error) {
    return {
      id: signal.id,
      error: error.message,
      changed: false,
    };
  }
};
const monitorSignals = async () => {
  const activeSignals = await getActiveSignals();

  const results = [];

  for (const signal of activeSignals) {
    const result = await processSignal(signal);
    results.push(result);
  }

  return {
    checkedAt: new Date().toISOString(),
    total: activeSignals.length,
    results,
  };
};

module.exports = {
  monitorSignals,
};
