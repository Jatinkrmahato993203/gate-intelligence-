// ============================================================================
// Outcome Service — Dashboard Metrics & Conversion Funnel
// ============================================================================

import { db } from '../config/database';
import { logger } from '../middleware/logging';
import { DailyMetrics } from '../types';

const DEFAULT_METRICS: DailyMetrics = {
  nudges_sent: 0,
  nudge_engagements: 0,
  confirmations: 0,
  entries_matched: 0,
  forecast_mape_pct: 0,
  avg_time_saved_min: 0,
};

export class OutcomeService {
  /**
   * Get daily outcome metrics.
   */
  static async getDailyMetrics(eventDate?: string): Promise<DailyMetrics> {
    const date = eventDate || new Date().toISOString().split('T')[0];

    try {
      const result = await db.query(
        `SELECT
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
         WHERE DATE(n.created_at) = $1`,
        [date],
      );

      const row = result.rows[0];
      if (!row) return DEFAULT_METRICS;

      return {
        nudges_sent: parseInt(row.nudges_sent, 10) || 0,
        nudge_engagements: parseInt(row.nudge_engagements, 10) || 0,
        confirmations: parseInt(row.confirmations, 10) || 0,
        entries_matched: parseInt(row.entries_matched, 10) || 0,
        forecast_mape_pct: parseFloat(row.forecast_mape_pct) || 0,
        avg_time_saved_min: parseFloat(row.avg_time_saved_min) || 0,
      };
    } catch (error) {
      logger.error({ error }, 'getDailyMetrics failed');
      return DEFAULT_METRICS;
    }
  }

  /**
   * Get conversion funnel data.
   */
  static async getConversionFunnel(eventId?: string): Promise<unknown> {
    try {
      const query = eventId
        ? `SELECT * FROM conversion_funnel WHERE event_id = $1`
        : `SELECT * FROM conversion_funnel ORDER BY created_at DESC LIMIT 1`;

      const result = await db.query(query, eventId ? [eventId] : []);
      return result.rows[0] || {};
    } catch (error) {
      logger.error({ error }, 'getConversionFunnel failed');
      return {};
    }
  }
}
