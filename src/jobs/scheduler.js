const cron = require("node-cron");
const { runMonitorJob } = require("./monitorJob");
const { runTelegramPollingJob } = require("./telegramPollingJob");

const startScheduler = () => {
  console.log("[Scheduler] Starting...");

  cron.schedule("*/30 * * * *", async () => {
    console.log("[Scheduler] Running Monitor Job...");
    await runMonitorJob();
  });

  // Automatic scan job intentionally disabled to reduce Twelve Data usage.
  // The scan job code is preserved in src/jobs/scanJob.js for future reuse.

  cron.schedule("* * * * *", async () => {
    console.log("[Scheduler] Running Telegram Polling Job...");
    await runTelegramPollingJob();
  });

  console.log("[Scheduler] All jobs scheduled.");
};

module.exports = {
  startScheduler,
};
