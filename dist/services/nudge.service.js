"use strict";
// ============================================================================
// Nudge Service — Personalized Gate Recommendations
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.NudgeService = void 0;
const database_1 = require("../config/database");
const logging_1 = require("../middleware/logging");
const geo_1 = require("../lib/geo");
const wait_time_service_1 = require("./wait-time.service");
class NudgeService {
    /**
     * Generate a nudge recommendation for a fan.
     */
    static async generateNudge(userId, currentGateId, userLat, userLng) {
        try {
            // Get all active gates with coordinates
            const allGates = await database_1.db.query(`SELECT gate_id, venue_id, location_lat, location_lng
         FROM gates WHERE is_active = true`);
            const currentGateInfo = allGates.rows.find((g) => g.gate_id === currentGateId);
            if (!currentGateInfo) {
                return { error: 'Invalid current gate ID' };
            }
            const venueId = currentGateInfo.venue_id;
            // Find gates within 500m of the user
            const nearbyGates = allGates.rows
                .map((gate) => ({
                gate_id: gate.gate_id,
                distance_m: (0, geo_1.haversineDistance)(userLat, userLng, gate.location_lat, gate.location_lng),
            }))
                .filter((g) => g.distance_m < 500 && g.gate_id !== currentGateId)
                .sort((a, b) => a.distance_m - b.distance_m);
            if (!nearbyGates.length) {
                return { error: 'No nearby alternative gates' };
            }
            // Fetch all wait times for the venue efficiently (hits cache if available)
            const waitTimesCache = await wait_time_service_1.WaitTimeService.getAllWaitTimes(venueId);
            const currentWait = waitTimesCache[currentGateId];
            if (!currentWait) {
                return { error: 'Current gate wait time unavailable' };
            }
            // Find the best alternative using O(1) dictionary lookups
            let bestAlternative = null;
            for (const gate of nearbyGates) {
                const wait = waitTimesCache[gate.gate_id];
                if (!wait)
                    continue;
                if (!bestAlternative || wait.estimated_wait_min < bestAlternative.wait_min) {
                    bestAlternative = {
                        gate_id: gate.gate_id,
                        wait_min: wait.estimated_wait_min,
                        confidence: wait.confidence,
                    };
                }
            }
            if (!bestAlternative) {
                return { error: 'No faster gate available' };
            }
            const timeSaved = currentWait.estimated_wait_min - bestAlternative.wait_min;
            if (timeSaved < 2) {
                return { error: 'Savings below threshold (< 2 min)' };
            }
            // Create nudge record
            const nudgeId = `nudge_${Date.now()}`;
            const result = await database_1.db.query(`INSERT INTO nudges
         (nudge_id, user_id, current_gate_id, recommended_gate_id,
          wait_time_current_min, wait_time_recommended_min, time_saved_min, forecast_confidence)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`, [
                nudgeId,
                userId,
                currentGateId,
                bestAlternative.gate_id,
                currentWait.estimated_wait_min,
                bestAlternative.wait_min,
                timeSaved,
                bestAlternative.confidence,
            ]);
            return result.rows[0];
        }
        catch (error) {
            logging_1.logger.error({ error, userId }, 'Nudge generation failed');
            return { error: String(error) };
        }
    }
}
exports.NudgeService = NudgeService;
//# sourceMappingURL=nudge.service.js.map