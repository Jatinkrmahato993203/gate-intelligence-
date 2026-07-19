import { db } from '../config/database';
import crypto from 'crypto';

export class FanService {
  /**
   * Confirm nudge acceptance and issue entry token.
   */
  static async confirmNudge(
    nudgeId: string,
    userId: string,
    selectedGateId: string,
    predictedWaitMin: number = 0,
  ): Promise<{ entry_token: string; expires_at: string; expires_in_minutes: number }> {
    const entryToken = `entr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 20 * 60000); // 20-minute expiry

    await db.query(
      `INSERT INTO confirmations
       (confirmation_id, entry_token, nudge_id, user_id, confirmed_gate_id, predicted_wait_min, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        `conf_${Date.now()}`,
        entryToken,
        nudgeId,
        userId,
        selectedGateId,
        predictedWaitMin,
        expiresAt,
      ],
    );

    return {
      entry_token: entryToken,
      expires_at: expiresAt.toISOString(),
      expires_in_minutes: 20,
    };
  }

  /**
   * Submit feedback and calibration data.
   */
  static async submitFeedback(
    entryToken: string,
    actualWaitMin?: number,
    predictionsAccurate?: boolean,
    experience?: number,
  ): Promise<void> {
    await db.query(
      `INSERT INTO feedback
       (feedback_id, entry_token, actual_wait_min, predictions_accurate, experience, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        `fbk_${Date.now()}`,
        entryToken,
        actualWaitMin ?? null,
        predictionsAccurate ?? null,
        experience ?? null,
      ],
    );
  }
}
