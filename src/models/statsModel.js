const pool = require("../config/db");

const getOverallStats = async () => {
  const query = `
    SELECT
      COUNT(*) AS total_signals,
      COUNT(*) FILTER (WHERE status IN ('TP_HIT', 'SL_HIT')) AS closed_signals,
      COUNT(*) FILTER (WHERE status = 'TP_HIT') AS wins,
      COUNT(*) FILTER (WHERE status = 'SL_HIT') AS losses,
      COUNT(*) FILTER (WHERE status = 'PENDING') AS pending,
      COUNT(*) FILTER (WHERE status = 'TRIGGERED') AS triggered,
      COUNT(*) FILTER (WHERE status = 'EXPIRED') AS expired
    FROM signals;
  `;

  const { rows } = await pool.query(query);
  return rows[0];
};

module.exports = {
  getOverallStats,
};
