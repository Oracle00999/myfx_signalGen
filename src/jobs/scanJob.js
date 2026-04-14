const { scanMarket } = require("../services/scannerService");
const { sendTelegramSignalAlert } = require("../services/notificationService");

const runScanJob = async () => {
  try {
    console.log("[ScanJob] Starting market scan...");

    const result = await scanMarket({
      symbols: ["XAUUSD"],
      timeframe: "15m",
      candleLimit: 250,
      minimumConfidence: 65,
    });

    for (const item of result.results) {
      if (item.validSignal && item.saved && item.saved.created && item.signal) {
        const telegramResult = await sendTelegramSignalAlert(item.signal);

        console.log(
          `[ScanJob] Telegram alert for ${item.symbol}:`,
          telegramResult.sent ? "sent" : telegramResult.reason,
        );
      } else {
        console.log(
          `[ScanJob] No alert for ${item.symbol}:`,
          item.reasons?.join(", ") || "No new signal created",
        );
      }
    }

    console.log("[ScanJob] Scan complete.");
    return result;
  } catch (error) {
    console.error("[ScanJob] Failed:", error.message);

    return {
      success: false,
      error: error.message,
    };
  }
};

module.exports = {
  runScanJob,
};
