// ============================================================================
// Forecast Calibration Job — Recalculate MAPE Every 6 Hours
// ============================================================================

import cron from 'node-cron';
import { db } from '../config/database';
import { logger } from '../middleware/logging';

export function startForecastCalibrateJob(): void {
  cron.schedule('0 */6 * * *', async () => {
    logger.info('🎯 Calibrating forecast model...');
    try {
      const result = await db.query(`
        SELECT c.confirmed_gate_id as gate_id,
          ROUND(AVG(ABS(c.predicted_wait_min - ge.wait_time_actual_min)
            / NULLIF(c.predicted_wait_min, 0)) * 100, 2) as mape_pct
        FROM confirmations c
        JOIN gate_entries ge ON c.entry_token = ge.entry_token
        WHERE ge.scanned_at > NOW() - INTERVAL '6 hours'
        GROUP BY c.confirmed_gate_id
      `);

      result.rows.forEach((row: any) => {
        logger.info({ gate: row.gate_id, mape: row.mape_pct }, 'Gate accuracy');
        if (parseFloat(row.mape_pct) > 20) {
          logger.warn(
            { gate: row.gate_id, mape: row.mape_pct },
            '⚠️ Low forecast accuracy — gate needs recalibration',
          );
        }
      });
    } catch (error) {
      logger.error({ error }, '❌ Calibration failed');
    }
  });

  logger.info('Scheduled: 6-hourly forecast calibration');
}
