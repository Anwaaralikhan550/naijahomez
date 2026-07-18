const { query } = require('./postgres-client.cjs');

function toDay(date) {
  const d = date instanceof Date ? date : new Date(date || Date.now());
  return d.toISOString().slice(0, 10);
}

async function upsertDailyMetric({ day, metricName, dimensionKey = '', incrementBy = 1, data = {} }) {
  if (!metricName) throw new Error('metricName is required');

  const dayValue = toDay(day);
  const result = await query(
    `INSERT INTO analytics_daily (day, metric_name, dimension_key, count, data, updated_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
     ON CONFLICT (day, metric_name, dimension_key)
     DO UPDATE SET
       count = analytics_daily.count + EXCLUDED.count,
       data = analytics_daily.data || EXCLUDED.data,
       updated_at = NOW()
     RETURNING day, metric_name, dimension_key, count, data, updated_at`,
    [dayValue, metricName, dimensionKey, incrementBy, JSON.stringify(data || {})]
  );

  return result.rows[0];
}

function rowToMetric(row) {
  return {
    day: row.day instanceof Date ? row.day.toISOString().slice(0, 10) : row.day,
    metricName: row.metric_name,
    dimensionKey: row.dimension_key,
    count: Number(row.count),
    data: row.data || {},
    updatedAt: row.updated_at
  };
}

async function listDailyMetrics({ metricName, since, limit = 500 } = {}) {
  const conditions = [];
  const params = [];

  if (metricName) {
    params.push(metricName);
    conditions.push(`metric_name = $${params.length}`);
  }
  if (since) {
    params.push(toDay(since));
    conditions.push(`day >= $${params.length}`);
  }

  params.push(Math.min(Math.max(Number(limit) || 500, 1), 2000));
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT day, metric_name, dimension_key, count, data, updated_at
     FROM analytics_daily
     ${whereClause}
     ORDER BY day DESC, updated_at DESC
     LIMIT $${params.length}`,
    params
  );

  return result.rows.map(rowToMetric);
}

async function getHealthSummary() {
  const result = await query(
    `SELECT metric_name, COUNT(*) AS rows, SUM(count) AS total_count
     FROM analytics_daily
     GROUP BY metric_name
     ORDER BY metric_name`
  );
  return result.rows.map((row) => ({
    metricName: row.metric_name,
    rows: Number(row.rows),
    totalCount: Number(row.total_count)
  }));
}

module.exports = {
  upsertDailyMetric,
  listDailyMetrics,
  getHealthSummary,
  toDay
};
