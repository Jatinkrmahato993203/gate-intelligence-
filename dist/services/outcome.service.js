"use strict";
// ============================================================================
// Outcome Service — Dashboard Metrics & Conversion Funnel
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutcomeService = void 0;
const database_1 = require("../config/database");
const logging_1 = require("../middleware/logging");
const DEFAULT_METRICS = {
    nudges_sent: 0,
    nudge_engagements: 0,
    confirmations: 0,
    entries_matched: 0,
    forecast_mape_pct: 0,
    avg_time_saved_min: 0,
};
class OutcomeService {
    /**
     * Get daily outcome metrics.
     */
    static async getDailyMetrics(eventDate) {
        const date = eventDate || new Date().toISOString().split('T')[0];
        try {
            const result = await database_1.db.query(`SELECT
          COUNT(DISTINCT n.id) as nudges_sent,
          COUNT(DISTINCT ni.id) as nudge_engagements,
          COUNT(DISTINCT c.id) as confirmations,
          COUNT(DISTINCT ge.id) as entries_matched,
          ROUND(AVG(ABS(c.predicted_wait_min - ge.wait_time_actual_min)
            / NULLIF(c.predicted_wait_min, 0)) * 100, 2) as forecast_mape_pct,
          ROUND(AVG(n.time_saved_min), 2) as avg_time_saved_min
         FROM nudges n
         LEFT JOIN nudge_interactions ni ON n.id = ni.nudge_id
         LEFT JOIN confirmations c ON c.nudge_id = n.nudge_id
         LEFT JOIN gate_entries ge ON c.entry_token = ge.entry_token
         WHERE DATE(n.created_at) = $1`, [date]);
            const row = result.rows[0];
            if (!row)
                return DEFAULT_METRICS;
            return {
                nudges_sent: parseInt(row.nudges_sent, 10) || 0,
                nudge_engagements: parseInt(row.nudge_engagements, 10) || 0,
                confirmations: parseInt(row.confirmations, 10) || 0,
                entries_matched: parseInt(row.entries_matched, 10) || 0,
                forecast_mape_pct: parseFloat(row.forecast_mape_pct) || 0,
                avg_time_saved_min: parseFloat(row.avg_time_saved_min) || 0,
            };
        }
        catch (error) {
            logging_1.logger.error({ error }, 'getDailyMetrics failed');
            return DEFAULT_METRICS;
        }
    }
    /**
     * Get conversion funnel data.
     */
    static async getConversionFunnel(eventId) {
        try {
            const query = eventId
                ? `SELECT * FROM conversion_funnel WHERE event_id = $1`
                : `SELECT * FROM conversion_funnel ORDER BY created_at DESC LIMIT 1`;
            const result = await database_1.db.query(query, eventId ? [eventId] : []);
            return result.rows[0] || {};
        }
        catch (error) {
            logging_1.logger.error({ error }, 'getConversionFunnel failed');
            return {};
        }
    }
}
exports.OutcomeService = OutcomeService;
//# sourceMappingURL=outcome.service.js.map