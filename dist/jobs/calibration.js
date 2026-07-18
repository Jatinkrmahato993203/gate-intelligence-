"use strict";
// ============================================================================
// Forecast Calibration Job — Recalculate MAPE Every 6 Hours
// ============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startForecastCalibrateJob = startForecastCalibrateJob;
const node_cron_1 = __importDefault(require("node-cron"));
const database_1 = require("../config/database");
const logging_1 = require("../middleware/logging");
function startForecastCalibrateJob() {
    node_cron_1.default.schedule('0 */6 * * *', async () => {
        logging_1.logger.info('🎯 Calibrating forecast model...');
        try {
            const result = await database_1.db.query(`
        SELECT c.confirmed_gate_id as gate_id,
          ROUND(AVG(ABS(c.predicted_wait_min - ge.wait_time_actual_min)
            / NULLIF(c.predicted_wait_min, 0)) * 100, 2) as mape_pct
        FROM confirmations c
        JOIN gate_entries ge ON c.entry_token = ge.entry_token
        WHERE ge.scanned_at > NOW() - INTERVAL '6 hours'
        GROUP BY c.confirmed_gate_id
      `);
            result.rows.forEach((row) => {
                logging_1.logger.info({ gate: row.gate_id, mape: row.mape_pct }, 'Gate accuracy');
                if (parseFloat(row.mape_pct) > 20) {
                    logging_1.logger.warn({ gate: row.gate_id, mape: row.mape_pct }, '⚠️ Low forecast accuracy — gate needs recalibration');
                }
            });
        }
        catch (error) {
            logging_1.logger.error({ error }, '❌ Calibration failed');
        }
    });
    logging_1.logger.info('Scheduled: 6-hourly forecast calibration');
}
//# sourceMappingURL=calibration.js.map