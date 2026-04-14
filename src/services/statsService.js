const { getOverallStats } = require("../models/statsModel");

const toNumber = (value) => Number(value || 0);

const calculateWinRate = (wins, losses) => {
  const totalClosed = wins + losses;

  if (totalClosed === 0) {
    return 0;
  }

  return Number(((wins / totalClosed) * 100).toFixed(2));
};

const getTradingStats = async () => {
  const rawStats = await getOverallStats();

  const totalSignals = toNumber(rawStats.total_signals);
  const closedSignals = toNumber(rawStats.closed_signals);
  const wins = toNumber(rawStats.wins);
  const losses = toNumber(rawStats.losses);
  const pending = toNumber(rawStats.pending);
  const triggered = toNumber(rawStats.triggered);
  const expired = toNumber(rawStats.expired);

  const winRate = calculateWinRate(wins, losses);

  return {
    totalSignals,
    closedSignals,
    wins,
    losses,
    pending,
    triggered,
    expired,
    winRate,
  };
};

module.exports = {
  getTradingStats,
};
