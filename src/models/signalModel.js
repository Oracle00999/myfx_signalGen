const pool = require("../config/db");

const createSignal = async ({
  symbol,
  type,
  entryType = null,
  entrySource = null,
  entry,
  stopLoss,
  takeProfit,
  confidence,
  status = "PENDING",
  source,
  timeframe = "15m",
  triggeredAt = null,
  expiresAt = null,
  analysisSnapshot = null,
}) => {
  const query = `
    INSERT INTO signals (
      symbol,
      type,
      entry_type,
      entry_source,
      entry,
      stop_loss,
      take_profit,
      confidence,
      status,
      source,
      timeframe,
      triggered_at,
      expires_at,
      analysis_snapshot
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *;
  `;

  const values = [
    symbol,
    type,
    entryType,
    entrySource,
    entry,
    stopLoss,
    takeProfit,
    confidence,
    status,
    source,
    timeframe,
    triggeredAt,
    expiresAt,
    analysisSnapshot,
  ];

  try {
    const { rows } = await pool.query(query, values);
    return rows[0];
  } catch (error) {
    if (error.code !== "42703") {
      throw error;
    }

    const fallbackQuery = `
      INSERT INTO signals (
        symbol,
        type,
        entry_type,
        entry,
        stop_loss,
        take_profit,
        confidence,
        status,
        source,
        timeframe,
        triggered_at,
        expires_at,
        analysis_snapshot
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *;
    `;
    const fallbackValues = [
      symbol,
      type,
      entryType,
      entry,
      stopLoss,
      takeProfit,
      confidence,
      status,
      source,
      timeframe,
      triggeredAt,
      expiresAt,
      analysisSnapshot,
    ];
    const { rows } = await pool.query(fallbackQuery, fallbackValues);
    return rows[0];
  }
};

const getAllSignals = async () => {
  const query = `
    SELECT * FROM signals
    ORDER BY created_at DESC;
  `;

  const { rows } = await pool.query(query);
  return rows;
};

const getSignalById = async (id) => {
  const query = `
    SELECT * FROM signals
    WHERE id = $1;
  `;

  const { rows } = await pool.query(query, [id]);
  return rows[0];
};

const getActiveSignals = async () => {
  const query = `
    SELECT * FROM signals
    WHERE status IN ('PENDING', 'TRIGGERED')
    ORDER BY created_at DESC;
  `;

  const { rows } = await pool.query(query);
  return rows;
};

const checkDuplicateSignal = async (symbol, type) => {
  const query = `
    SELECT * FROM signals
    WHERE symbol = $1
      AND type = $2
      AND status IN ('PENDING', 'TRIGGERED')
    LIMIT 1;
  `;

  const { rows } = await pool.query(query, [symbol, type]);
  return rows[0] || null;
};

const updateSignalStatus = async (id, updates) => {
  const fields = [];
  const values = [];
  let index = 1;

  if (updates.status !== undefined) {
    fields.push(`status = $${index++}`);
    values.push(updates.status);
  }

  if (updates.triggeredAt !== undefined) {
    fields.push(`triggered_at = $${index++}`);
    values.push(updates.triggeredAt);
  }

  if (updates.closedAt !== undefined) {
    fields.push(`closed_at = $${index++}`);
    values.push(updates.closedAt);
  }

  if (fields.length === 0) {
    throw new Error("No fields provided for update");
  }

  values.push(id);

  const query = `
    UPDATE signals
    SET ${fields.join(", ")}
    WHERE id = $${index}
    RETURNING *;
  `;

  const { rows } = await pool.query(query, values);
  return rows[0];
};

module.exports = {
  createSignal,
  getAllSignals,
  getSignalById,
  getActiveSignals,
  checkDuplicateSignal,
  updateSignalStatus,
};
