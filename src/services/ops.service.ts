import { db } from '../config/database';
import { broadcastEvent } from '../websocket/handlers';

export class OpsService {
  /**
   * Log an ops action (close gate, deploy staff, slow entry, etc.).
   */
  static async logAction(action: string, gateId: string, durationMin?: number): Promise<void> {
    await db.query(
      `INSERT INTO ops_actions (action_id, action, gate_id, duration_min, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [`act_${Date.now()}`, action, gateId, durationMin ?? null],
    );

    // Broadcast to all connected WebSocket clients
    broadcastEvent('ops_action', { action, gate_id: gateId, duration_min: durationMin });
  }
}
