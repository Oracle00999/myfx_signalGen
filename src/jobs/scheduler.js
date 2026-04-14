const cron = require("node-cron");
const { runScanJob } = require("./scanJob");
const { runMonitorJob } = require("./monitorJob");
const { runTelegramPollingJob } = require("./telegramPollingJob");

const startScheduler = () => {
  console.log("[Scheduler] Starting...");

  cron.schedule("*/5 * * * *", async () => {
    console.log("[Scheduler] Running Monitor Job...");
    await runMonitorJob();
  });

  cron.schedule("*/15 * * * *", async () => {
    console.log("[Scheduler] Running Scan Job...");
    await runScanJob();
  });

  cron.schedule("* * * * *", async () => {
    console.log("[Scheduler] Running Telegram Polling Job...");
    await runTelegramPollingJob();
  });

  console.log("[Scheduler] All jobs scheduled.");
};

module.exports = {
  startScheduler,
};
