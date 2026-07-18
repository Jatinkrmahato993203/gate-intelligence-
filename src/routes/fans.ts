// ============================================================================
// Fan App API Endpoints
// ============================================================================

import { Router, Request, Response } from 'express';
import { NudgeService } from '../services/nudge.service';
import { RouteService } from '../services/route.service';
import { db } from '../config/database';
import { logger } from '../middleware/logging';

const router = Router();

/**
 * GET /api/fans/nudge
 * Get nudge recommendation for a fan at a specific location.
 */
router.get('/nudge', async (req: Request, res: Response) => {
  try {
    const { user_id, current_gate_id, lat, lng } = req.query;

    if (!user_id || !current_gate_id || !lat || !lng) {
      res.status(400).json({ error: 'Missing required parameters: user_id, current_gate_id, lat, lng' });
      return;
    }

    const nudge = await NudgeService.generateNudge(
      user_id as string,
      current_gate_id as string,
      parseFloat(lat as string),
      parseFloat(lng as string)
    );

    res.json(nudge);
  } catch (error) {
    logger.error({ error }, 'GET /api/fans/nudge failed');
    res.status(500).json({ error: String(error) });
  }
});

/**
 * POST /api/fans/route
 * Calculate route from one gate to another.
 */
router.post('/route', async (req: Request, res: Response) => {
  try {
    const { from_gate_id, to_gate_id } = req.body;

    if (!from_gate_id || !to_gate_id) {
      res.status(400).json({ error: 'Missing gate IDs: from_gate_id, to_gate_id' });
      return;
    }

    const route = await RouteService.calculateRoute(from_gate_id, to_gate_id);
    res.json(route);
  } catch (error) {
    logger.error({ error }, 'POST /api/fans/route failed');
    res.status(500).json({ error: String(error) });
  }
});

/**
 * POST /api/fans/confirm
 * Confirm nudge acceptance and issue entry token.
 */
router.post('/confirm', async (req: Request, res: Response) => {
  try {
    const { nudge_id, user_id, selected_gate_id, predicted_wait_min } = req.body;

    if (!nudge_id || !user_id || !selected_gate_id) {
      res.status(400).json({ error: 'Missing required fields: nudge_id, user_id, selected_gate_id' });
      return;
    }

    const entryToken = `entr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + 20 * 60000); // 20-minute expiry

    await db.query(
      `INSERT INTO confirmations
       (confirmation_id, entry_token, nudge_id, user_id, confirmed_gate_id, predicted_wait_min, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        `conf_${Date.now()}`,
        entryToken,
        nudge_id,
        user_id,
        selected_gate_id,
        predicted_wait_min || 0,
        expiresAt,
      ]
    );

    res.json({
      entry_token: entryToken,
      expires_at: expiresAt.toISOString(),
      expires_in_minutes: 20,
    });
  } catch (error) {
    logger.error({ error }, 'POST /api/fans/confirm failed');
    res.status(500).json({ error: String(error) });
  }
});

/**
 * POST /api/fans/feedback
 * Submit feedback and calibration data.
 */
router.post('/feedback', async (req: Request, res: Response) => {
  try {
    const { entry_token, actual_wait_min, predictions_accurate, experience } = req.body;

    if (!entry_token) {
      res.status(400).json({ error: 'Missing entry_token' });
      return;
    }

    await db.query(
      `INSERT INTO feedback
       (feedback_id, entry_token, actual_wait_min, predictions_accurate, experience, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        `fbk_${Date.now()}`,
        entry_token,
        actual_wait_min || null,
        predictions_accurate ?? null,
        experience || null,
      ]
    );

    res.json({ success: true, message: 'Thank you for your feedback!' });
  } catch (error) {
    logger.error({ error }, 'POST /api/fans/feedback failed');
    res.status(500).json({ error: String(error) });
  }
});

export default router;
