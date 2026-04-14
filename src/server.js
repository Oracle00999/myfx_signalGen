const pool = require("./config/db");
require("dotenv").config();
const { getCandles } = require("./services/dataService");
const { calculateIndicators } = require("./services/indicatorService");
const { analyzeMarketStructure } = require("./services/marketStructureService");
const { generateSignal } = require("./services/strategyService");
const { analyzeMarket } = require("./services/analyzerService");
const { createSignalIfValid } = require("./services/signalService");
const { scanMarket } = require("./services/scannerService");
const { monitorSignals } = require("./services/signalMonitorService");
const { sendTelegramSignalAlert } = require("./services/notificationService");
const { runScanJob } = require("./jobs/scanJob");
const { runMonitorJob } = require("./jobs/monitorJob");
const { startScheduler } = require("./jobs/scheduler");

const app = require("./app");

pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.error("DB connection failed:", err);
  } else {
    console.log("DB connected at:", res.rows[0].now);
  }
});

// (async () => {
//   const result = await runMonitorJob();
//   console.log(JSON.stringify(result, null, 2));
// })();

// (async () => {
//   const result = await runScanJob();
//   console.log(JSON.stringify(result, null, 2));
// })();

// (async () => {
//   const result = await sendTelegramSignalAlert({
//     symbol: "XAUUSD",
//     timeframe: "15m",
//     type: "SELL",
//     entry: 4687.23,
//     stopLoss: 4697.23,
//     takeProfit: 4657.23,
//     confidence: 78,
//     reasons: [
//       "Trend is bearish",
//       "Price is near resistance zone",
//       "RSI is valid for sell setup",
//     ],
//   });

//   console.log(result);
// })();

// (async () => {
//   const result = await monitorSignals();
//   console.log(result);
// })();

// (async () => {
//   try {
//     const result = await scanMarket({
//       timeframe: "30m",
//     });

//     console.log(JSON.stringify(result, null, 2));
//   } catch (error) {
//     console.error("Scan failed:", error.message);
//   }
// })();

// (async () => {
//   const analysis = await analyzeMarket({
//     symbol: "XAUUSD",
//     timeframe: "30m",
//   });

//   if (analysis.validSignal) {
//     const saved = await createSignalIfValid({
//       symbol: analysis.symbol,
//       timeframe: analysis.timeframe,
//       ...analysis.signal,
//       source: "MANUAL",
//       analysisSnapshot: {
//         indicators: analysis.indicators,
//         structure: analysis.marketStructure,
//       },
//     });

//     console.log("Saved:", saved);
//   } else {
//     console.log("No valid signal:", analysis.reasons);
//   }
// })();

// (async () => {
//   try {
//     const result = await analyzeMarket({
//       symbol: "EURUSD",
//       timeframe: "30m",
//       candleLimit: 250,
//       minimumConfidence: 65,
//     });

//     console.log(JSON.stringify(result, null, 2));
//   } catch (error) {
//     console.error("Analyzer test failed:", error.message);
//   }
// })();

// (async () => {
//   try {
//     const candles = await getCandles("XAUUSD", "4h", 250);
//     const indicators = calculateIndicators(candles);
//     const structure = analyzeMarketStructure({ candles, indicators });

//     console.log("Indicators:", indicators);
//     console.log("Market Structure:", structure);
//   } catch (error) {
//     console.error("Market structure test failed:", error.message);
//   }
// })();

// (async () => {
//   try {
//     const timeframe = "30m";

//     const candles = await getCandles("XAUUSD", timeframe, 250);
//     const indicators = calculateIndicators(candles);
//     const marketStructure = analyzeMarketStructure({ candles, indicators });

//     const result = generateSignal({
//       symbol: "XAUUSD",
//       timeframe,
//       indicators,
//       marketStructure,
//     });

//     console.log("Indicators:", indicators);
//     console.log("Market Structure:", marketStructure);
//     console.log("Signal Result:", result);
//   } catch (error) {
//     console.error("Strategy test failed:", error.message);
//   }
// })();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startScheduler();
});
