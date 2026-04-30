const { monitorSignals } = require("../services/signalMonitorService");
const {
  formatSignalLifecycleAlert,
  sendTelegramMessage,
} = require("../services/notificationService");

const shouldSendLifecycleNotification = (item) => {
  return (
    item.changed &&
    (["TP_HIT", "SL_HIT"].includes(item.status) ||
      (item.status === "TRIGGERED" && item.previousStatus === "PENDING"))
  );
};

const runMonitorJob = async () => {
  try {
    console.log("[MonitorJob] Starting signal monitoring...");

    const result = await monitorSignals();

    for (const item of result.results) {
      if (item.error) {
        console.log(`[MonitorJob] Signal ${item.id} error: ${item.error}`);
        continue;
      }

      console.log(`[MonitorJob] Signal ${item.id} status: ${item.status}`);

      if (shouldSendLifecycleNotification(item)) {
        const message = formatSignalLifecycleAlert(item.signal, item.status);

        if (!message) {
          console.log(
            `[MonitorJob] Telegram update skipped for ${item.id}: unsupported lifecycle status`,
          );
          continue;
        }

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
