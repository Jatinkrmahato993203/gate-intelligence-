"use strict";
// ============================================================================
// Wait Time Service — Orchestrates DB + Calculation + Caching
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaitTimeService = void 0;
const database_1 = require("../config/database");
const redis_1 = require("../config/redis");
const logging_1 = require("../middleware/logging");
const wait_time_calculation_1 = require("../lib/wait-time-calculation");
const CACHE_TTL_SEC = 10; // Cache wait times for 10 seconds
class WaitTimeService {
    /**
     * Get all wait times for a venue (with Redis caching).
     */
    static async getAllWaitTimes(venueId) {
        // Try cache first
        const cacheKey = `wait_times:${venueId}`;
        try {
            const cached = await redis_1.redis.get(cacheKey);
            if (cached)
                return JSON.parse(cached);
        }
        catch {
            // Redis unavailable — continue without cache
        }
        const result = await database_1.db.query(`SELECT gate_id FROM gates WHERE venue_id = $1 AND is_active = true`, [venueId]);
        const waitTimes = {};
        for (const row of result.rows) {
            waitTimes[row.gate_id] = await this.calculateWaitForGate(row.gate_id);
        }
        // Store in cache
        try {
            await redis_1.redis.set(cacheKey, JSON.stringify(waitTimes), CACHE_TTL_SEC);
        }
        catch {
            // Redis unavailable — skip cache write
        }
        return waitTimes;
    }
    /**
     * Calculate wait time for a specific gate.
     */
    static async calculateWaitForGate(gateId) {
        try {
            const gateResult = await database_1.db.query(`SELECT gate_id, throughput_per_min, processing_time_sec,
                max_queue_length, crowd_slowdown_factor
         FROM gates WHERE gate_id = $1`, [gateId]);
            if (!gateResult.rows.length) {
                return {
                    estimated_wait_min: 0,
                    display_as: '0 min',
                    breakdown: { queue_wait: 0, processing_wait: 0, stress_factor: 1 },
                    confidence: 0,
                    trend: 'stable',
                };
            }
            const gateConfig = gateResult.rows[0];
            // Get recent queue observations
            const queueResult = await database_1.db.query(`SELECT observed_queue_count, observation_source, confidence, created_at
         FROM queue_observations
         WHERE gate_id = $1
         ORDER BY created_at DESC
         LIMIT 10`, [gateId]);
            const observations = queueResult.rows.map((r) => ({
                observed_queue_count: r.observed_queue_count,
                observation_source: r.observation_source,
                confidence: parseFloat(r.confidence),
                timestamp: new Date(r.created_at),
            }));
            // Build gate object for the calculation lib
            const gate = {
                queue_history: observations,
                throughput_per_min: gateConfig.throughput_per_min,
                processing_time_sec: gateConfig.processing_time_sec,
                max_queue_length: gateConfig.max_queue_length,
                crowd_slowdown_factor: gateConfig.crowd_slowdown_factor,
            };
            // Get arrival forecast
            const forecast = await this.getArrivalForecast(gateId);
            // Calculate
            const waitResult = (0, wait_time_calculation_1.calculateWaitTime)(gate, forecast);
            // Persist estimate for history
            await database_1.db.query(`INSERT INTO wait_time_estimates (gate_id, estimated_wait_min, queue_count, confidence, created_at)
         VALUES ($1, $2, $3, $4, NOW())`, [
                gateId,
                waitResult.estimated_wait_min,
                observations[0]?.observed_queue_count || 0,
                waitResult.confidence,
            ]).catch((err) => logging_1.logger.warn({ err, gateId }, 'Failed to persist wait time estimate'));
            return waitResult;
        }
        catch (error) {
            logging_1.logger.error({ error, gateId }, 'Wait time calculation failed');
            return {
                estimated_wait_min: 0,
                display_as: '? min',
                breakdown: { queue_wait: 0, processing_wait: 0, stress_factor: 1 },
                confidence: 0,
                trend: 'stable',
            };
        }
    }
    /**
     * Get arrival forecast — rule-based (Gemini extension point).
     */
    static async getArrivalForecast(_gateId) {
        // Get next event start time
        const eventResult = await database_1.db.query(`SELECT scheduled_start FROM events
       WHERE scheduled_start > NOW()
       ORDER BY scheduled_start LIMIT 1`);
        const eventStartTime = eventResult.rows.length
            ? new Date(eventResult.rows[0].scheduled_start)
            : new Date(Date.now() + 60 * 60000); // Default: 1 hour from now
        return (0, wait_time_calculation_1.predictArrivalsRuleBased)(new Date(), eventStartTime, []);
    }
}
exports.WaitTimeService = WaitTimeService;
//# sourceMappingURL=wait-time.service.js.map