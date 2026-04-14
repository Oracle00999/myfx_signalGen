const { monitorSignals } = require("../services/signalMonitorService");
const { sendTelegramMessage } = require("../services/notificationService");

const runMonitorJob = async () => {
  const formatStatusMessage = (signalId, status) => {
    const emojis = {
      TRIGGERED: "🚀",
      TP_HIT: "✅",
      SL_HIT: "❌",
      EXPIRED: "⌛",
    };

    return `${emojis[status] || ""} Signal ${signalId} → ${status}`;
  };
  try {
    console.log("[MonitorJob] Starting signal monitoring...");

    const result = await monitorSignals();

    for (const item of result.results) {
      if (item.error) {
        console.log(`[MonitorJob] Signal ${item.id} error: ${item.error}`);
        continue;
      }

      console.log(`[MonitorJob] Signal ${item.id} status: ${item.status}`);

      if (item.changed) {
        const message = formatStatusMessage(item.id, item.status);

        const telegramResult = await sendTelegramMessage(message);

        console.log(
          `[MonitorJob] Telegram update for ${item.id}:`,
          telegramResult.sent ? "sent" : telegramResult.reason,
        );
      }
    }

    console.log("[MonitorJob] Monitoring complete.");
    return result;
  } catch (error) {
    console.error("[MonitorJob] Failed:", error.message);

    return {
      success: false,
      error: error.message,
    };
  }
};

module.exports = {
  runMonitorJob,
};
