// ============================================================================
// Route Service — Walk Distance + Queue Wait Calculation
// ============================================================================

import { db } from '../config/database';
import { logger } from '../middleware/logging';
import { haversineDistance } from '../lib/geo';
import { WaitTimeService } from './wait-time.service';
import { RouteResult } from '../types';

export class RouteService {
  /**
   * Calculate route from one gate to another.
   */
  static async calculateRoute(
    currentGateId: string,
    targetGateId: string
  ): Promise<RouteResult | { error: string }> {
    try {
      const gatesResult = await db.query(
        `SELECT gate_id, location_lat, location_lng FROM gates
         WHERE gate_id IN ($1, $2)`,
        [currentGateId, targetGateId]
      );

      const gatesMap = Object.fromEntries(
        gatesResult.rows.map((g: any) => [g.gate_id, g])
      );

      const current = gatesMap[currentGateId];
      const target = gatesMap[targetGateId];

      if (!current || !target) {
        return { error: 'Gate not found' };
      }

      const walkDistance = haversineDistance(
        current.location_lat,
        current.location_lng,
        target.location_lat,
        target.location_lng
      );

      // 1.4 m/s average walking pace
      const walkTimeMin = Math.round((walkDistance / 1.4 / 60) * 10) / 10;

      const targetWait = await WaitTimeService.calculateWaitForGate(targetGateId);

      return {
        source_gate_id: currentGateId,
        target_gate_id: targetGateId,
        walk_distance_m: Math.round(walkDistance),
        walk_time_min: walkTimeMin,
        queue_wait_min: targetWait.estimated_wait_min,
        total_time_min: walkTimeMin + targetWait.estimated_wait_min,
      };
    } catch (error) {
      logger.error({ error }, 'Route calculation failed');
      return { error: String(error) };
    }
  }
}
