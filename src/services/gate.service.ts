import { db } from '../config/database';

export class GateService {
  static async getActiveGates() {
    const result = await db.query(`SELECT * FROM gates WHERE is_active = true ORDER BY gate_id`);
    return { gates: result.rows, count: result.rowCount };
  }

  static async getGateById(gateId: string) {
    const result = await db.query(`SELECT * FROM gates WHERE gate_id = $1`, [gateId]);
    return result.rows[0] || null;
  }
}
