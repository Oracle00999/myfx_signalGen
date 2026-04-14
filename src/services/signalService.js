const signalModel = require("../models/signalModel");

const EXPIRATION_HOURS = 8;

const resolveStoredEntryType = (signal, fallbackEntryType = null) => {
  return (
    signal?.entry_type ||
    signal?.analysis_snapshot?.entryType ||
    signal?.entryType ||
    fallbackEntryType ||
    "MARKET"
  );
};

const calculateExpiry = () => {
  const now = new Date();
  return new Date(now.getTime() + EXPIRATION_HOURS * 60 * 60 * 1000);
};

const createSignalIfValid = async ({
  symbol,
  timeframe,
  type,
  entryType,
  entry,
  stopLoss,
  takeProfit,
  confidence,
  source = "AUTO",
  analysisSnapshot = null,
}) => {
  if (!symbol || !type) {
    throw new Error("Symbol and type are required");
  }

  // Prevent duplicate active signal
  const existing = await signalModel.checkDuplicateSignal(symbol, type);

  if (existing) {
    return {
      created: false,
      reason: "Duplicate active signal exists",
      signal: {
        ...existing,
        entryType: resolveStoredEntryType(existing, entryType),
      },
    };
  }

  const expiresAt = calculateExpiry();
  const initialStatus = entryType === "MARKET" ? "TRIGGERED" : "PENDING";
  const triggeredAt = initialStatus === "TRIGGERED" ? new Date() : null;
  const persistedAnalysisSnapshot = {
    ...(analysisSnapshot || {}),
    entryType: entryType || null,
  };

  const newSignal = await signalModel.createSignal({
    symbol,
    type,
    entryType,
    entry,
    stopLoss,
    takeProfit,
    confidence,
    status: initialStatus,
    source,
    timeframe,
    triggeredAt,
    expiresAt,
    analysisSnapshot: persistedAnalysisSnapshot,
  });

  return {
    created: true,
    signal: {
      ...newSignal,
      entryType: resolveStoredEntryType(newSignal, entryType),
    },
  };
};

const getAllSignals = async () => {
  return await signalModel.getAllSignals();
};

const getSignalById = async (id) => {
  if (!id) throw new Error("Signal ID is required");
  return await signalModel.getSignalById(id);
};

const getActiveSignals = async () => {
  return await signalModel.getActiveSignals();
};

const updateSignalStatus = async (id, updates) => {
  if (!id) throw new Error("Signal ID is required");

  return await signalModel.updateSignalStatus(id, updates);
};

const getHighConfidenceSignals = async (minConfidence = 70) => {
  const signals = await signalModel.getAllSignals();

  return signals
    .filter((s) => s.confidence >= minConfidence)
    .sort((a, b) => b.confidence - a.confidence);
};

module.exports = {
  createSignalIfValid,
  getAllSignals,
  getSignalById,
  getActiveSignals,
  updateSignalStatus,
  getHighConfidenceSignals,
};
