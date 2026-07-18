"use strict";
// ============================================================================
// Route Service — Walk Distance + Queue Wait Calculation
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.RouteService = void 0;
const database_1 = require("../config/database");
const logging_1 = require("../middleware/logging");
const geo_1 = require("../lib/geo");
const wait_time_service_1 = require("./wait-time.service");
class RouteService {
    /**
     * Calculate route from one gate to another.
     */
    static async calculateRoute(currentGateId, targetGateId) {
        try {
            const gatesResult = await database_1.db.query(`SELECT gate_id, location_lat, location_lng FROM gates
         WHERE gate_id IN ($1, $2)`, [currentGateId, targetGateId]);
            const gatesMap = Object.fromEntries(gatesResult.rows.map((g) => [g.gate_id, g]));
            const current = gatesMap[currentGateId];
            const target = gatesMap[targetGateId];
            if (!current || !target) {
                return { error: 'Gate not found' };
            }
            const walkDistance = (0, geo_1.haversineDistance)(current.location_lat, current.location_lng, target.location_lat, target.location_lng);
            // 1.4 m/s average walking pace
            const walkTimeMin = Math.round((walkDistance / 1.4 / 60) * 10) / 10;
            const targetWait = await wait_time_service_1.WaitTimeService.calculateWaitForGate(targetGateId);
            return {
                source_gate_id: currentGateId,
                target_gate_id: targetGateId,
                walk_distance_m: Math.round(walkDistance),
                walk_time_min: walkTimeMin,
                queue_wait_min: targetWait.estimated_wait_min,
                total_time_min: walkTimeMin + targetWait.estimated_wait_min,
            };
        }
        catch (error) {
            logging_1.logger.error({ error }, 'Route calculation failed');
            return { error: String(error) };
        }
    }
}
exports.RouteService = RouteService;
//# sourceMappingURL=route.service.js.map