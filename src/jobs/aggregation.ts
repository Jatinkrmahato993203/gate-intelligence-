// ============================================================================
// Hourly Aggregation Job — Refresh Materialized Views
// ============================================================================

import cron from 'node-cron';
import { db } from '../config/database';
import { logger } from '../middleware/logging';

export function startAggregationJob(): void {
  cron.schedule('0 * * * *', async () => {
    logger.info('📊 Running hourly aggregation...');
    try {
      // CONCURRENTLY allows reads during refresh
      await db.query('REFRESH MATERIALIZED VIEW CONCURRENTLY journey_complete');
      await db.query('REFRESH MATERIALIZED VIEW CONCURRENTLY conversion_funnel');
      logger.info('✓ Aggregation complete');
    } catch (error) {
      logger.error({ error }, '❌ Aggregation failed');
    }
  });

  logger.info('Scheduled: hourly materialized view refresh');
}
