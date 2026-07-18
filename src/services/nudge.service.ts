// ============================================================================
// Nudge Service — Personalized Gate Recommendations
// ============================================================================

import { db } from '../config/database';
import { logger } from '../middleware/logging';
import { haversineDistance } from '../lib/geo';
import { WaitTimeService } from './wait-time.service';
import { NudgeRecord } from '../types';

export class NudgeService {
  /**
   * Generate a nudge recommendation for a fan.
   */
  static async generateNudge(
    userId: string,
    currentGateId: string,
    userLat: number,
    userLng: number
  ): Promise<NudgeRecord | { error: string }> {
    try {
      // Get all active gates with coordinates
      const allGates = await db.query(
        `SELECT gate_id, location_lat, location_lng
         FROM gates WHERE is_active = true`
      );

      // Find gates within 500m of the user
      const nearbyGates = allGates.rows
        .map((gate: any) => ({
          gate_id: gate.gate_id as string,
          distance_m: haversineDistance(userLat, userLng, gate.location_lat, gate.location_lng),
        }))
        .filter((g) => g.distance_m < 500 && g.gate_id !== currentGateId)
        .sort((a, b) => a.distance_m - b.distance_m);

      if (!nearbyGates.length) {
        return { error: 'No nearby alternative gates' };
      }

      // Calculate wait times
      const currentWait = await WaitTimeService.calculateWaitForGate(currentGateId);

      // Find the best alternative
      let bestAlternative: { gate_id: string; wait_min: number; confidence: number } | null = null;

      for (const gate of nearbyGates) {
        const wait = await WaitTimeService.calculateWaitForGate(gate.gate_id);
        if (
          !bestAlternative ||
          wait.estimated_wait_min < bestAlternative.wait_min
        ) {
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
      const result = await db.query(
        `INSERT INTO nudges
         (nudge_id, user_id, current_gate_id, recommended_gate_id,
          wait_time_current_min, wait_time_recommended_min, time_saved_min, forecast_confidence)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          nudgeId,
          userId,
          currentGateId,
          bestAlternative.gate_id,
          currentWait.estimated_wait_min,
          bestAlternative.wait_min,
          timeSaved,
          bestAlternative.confidence,
        ]
      );

      return result.rows[0] as NudgeRecord;
    } catch (error) {
      logger.error({ error, userId }, 'Nudge generation failed');
      return { error: String(error) };
    }
  }
}
