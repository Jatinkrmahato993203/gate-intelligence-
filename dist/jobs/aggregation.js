"use strict";
// ============================================================================
// Hourly Aggregation Job — Refresh Materialized Views
// ============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startAggregationJob = startAggregationJob;
const node_cron_1 = __importDefault(require("node-cron"));
const database_1 = require("../config/database");
const logging_1 = require("../middleware/logging");
function startAggregationJob() {
    node_cron_1.default.schedule('0 * * * *', async () => {
        logging_1.logger.info('📊 Running hourly aggregation...');
        try {
            // CONCURRENTLY allows reads during refresh
            await database_1.db.query('REFRESH MATERIALIZED VIEW CONCURRENTLY journey_complete');
            await database_1.db.query('REFRESH MATERIALIZED VIEW CONCURRENTLY conversion_funnel');
            logging_1.logger.info('✓ Aggregation complete');
        }
        catch (error) {
            logging_1.logger.error({ error }, '❌ Aggregation failed');
        }
    });
    logging_1.logger.info('Scheduled: hourly materialized view refresh');
}
//# sourceMappingURL=aggregation.js.map