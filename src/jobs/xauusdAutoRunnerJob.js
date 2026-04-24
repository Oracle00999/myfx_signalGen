const { analyzeMarket } = require("../services/analyzerService");
const { createSignalIfValid } = require("../services/signalService");
const { sendTelegramSignalAlert } = require("../services/notificationService");

const SYMBOL = "XAUUSD";
const TIMEFRAMES = ["5m", "15m", "30m"];
const LAGOS_TIMEZONE = "Africa/Lagos";
const START_MINUTES = 3 * 60;
const END_MINUTES = 21 * 60 + 30;
const BETWEEN_RUN_DELAY_MS = 60000;

let isRunning = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getLagosTimeParts = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: LAGOS_TIMEZONE,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});

  return {
    weekday: parts.weekday,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
};

const isWithinRunWindow = (date = new Date()) => {
  const { weekday, hour, minute } = getLagosTimeParts(date);
  const weekdayIndex = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
  ].indexOf(weekday);
  const totalMinutes = hour * 60 + minute;

  return {
    allowed:
      weekdayIndex !== -1 &&
      totalMinutes >= START_MINUTES &&
      totalMinutes <= END_MINUTES,
    weekday,
    time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(
      2,
      "0",
    )}`,
    timezone: LAGOS_TIMEZONE,
  };
};

const runTimeframe = async (symbol, timeframe) => {
  console.log(`[AutoRunner] Running ${timeframe}...`);

  try {
    const analysis = await analyzeMarket({
      symbol,
      timeframe,
      candleLimit: 250,
      minimumConfidence: 65,
    });

    if (!analysis.validSignal || !analysis.signal) {
      console.log(
        `[AutoRunner] No signal for ${timeframe}: ${analysis.reasons.join(
          ", ",
        )}`,
      );

      return {
        timeframe,
        validSignal: false,
        saved: null,
        notification: null,
      };
    }

    const saved = await createSignalIfValid({
      symbol: analysis.symbol,
      timeframe: analysis.timeframe,
      ...analysis.signal,
      source: "AUTO",
      analysisSnapshot: {
        indicators: analysis.indicators,
        structure: analysis.marketStructure,
        fvgContext: analysis.fvgContext,
        latestCandle: analysis.latestCandle,
        reasons: analysis.reasons,
      },
    });

    if (!saved?.created) {
      console.log(
        `[AutoRunner] Signal not saved for ${timeframe}: ${
          saved?.reason || "duplicate or skipped"
        }`,
      );

      return {
        timeframe,
        validSignal: true,
        saved,
        notification: null,
      };
    }

    const notification = await sendTelegramSignalAlert(analysis.signal);
    console.log(
      notification.sent
        ? `[AutoRunner] Signal saved and sent for ${timeframe}`
        : `[AutoRunner] Signal saved but Telegram failed for ${timeframe}: ${notification.reason}`,
    );

    return {
      timeframe,
      validSignal: true,
      saved,
      notification,
    };
  } catch (error) {
    console.error(`[AutoRunner] Failed ${timeframe}: ${error.message}`);

    return {
      timeframe,
      validSignal: false,
      error: error.message,
      saved: null,
      notification: null,
    };
  }
};

const runXauusdAutoRunnerJob = async () => {
  const windowCheck = isWithinRunWindow();

  if (!windowCheck.allowed) {
    console.log(
      `[AutoRunner] Outside run window (${windowCheck.weekday} ${windowCheck.time} ${windowCheck.timezone}); skipping.`,
    );

    return {
      skipped: true,
      reason: "Outside run window",
      windowCheck,
    };
  }

  if (isRunning) {
    console.log("[AutoRunner] Previous run still active; skipping.");

    return {
      skipped: true,
      reason: "Previous run still active",
      windowCheck,
    };
  }

  isRunning = true;
  console.log("[AutoRunner] Starting XAUUSD sequential run.");

  try {
    const results = [];

    results.push(await runTimeframe(SYMBOL, TIMEFRAMES[0]));
    await sleep(BETWEEN_RUN_DELAY_MS);

    results.push(await runTimeframe(SYMBOL, TIMEFRAMES[1]));
    await sleep(BETWEEN_RUN_DELAY_MS);

    results.push(await runTimeframe(SYMBOL, TIMEFRAMES[2]));

    console.log("[AutoRunner] XAUUSD sequential run complete.");

    return {
      skipped: false,
      windowCheck,
      results,
    };
  } finally {
    isRunning = false;
  }
};

module.exports = {
  runXauusdAutoRunnerJob,
  runTimeframe,
  isWithinRunWindow,
  sleep,
};
