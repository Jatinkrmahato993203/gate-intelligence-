// ============================================================================
// Ops Console API Endpoints
// ============================================================================

import { Router, Request, Response } from 'express';
import { WaitTimeService } from '../services/wait-time.service';
import { OutcomeService } from '../services/outcome.service';
import { db } from '../config/database';
import { logger } from '../middleware/logging';
import { broadcastEvent } from '../websocket/handlers';

const router = Router();

/**
 * GET /api/ops/wait-times
 * Get current wait times for all gates at a venue.
 */
router.get('/wait-times', async (req: Request, res: Response) => {
  try {
    const venueId = (req.query.venue_id as string) || process.env.DEFAULT_VENUE_ID || 'stadiumA';
    const waitTimes = await WaitTimeService.getAllWaitTimes(venueId);
    res.json(waitTimes);
  } catch (error) {
    logger.error({ error }, 'GET /api/ops/wait-times failed');
    res.status(500).json({ error: String(error) });
  }
});

/**
 * GET /api/ops/dashboard
 * Get outcome metrics for the ops dashboard.
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const eventDate = req.query.event_date as string | undefined;
    const metrics = await OutcomeService.getDailyMetrics(eventDate);
    res.json(metrics);
  } catch (error) {
    logger.error({ error }, 'GET /api/ops/dashboard failed');
    res.status(500).json({ error: String(error) });
  }
});

/**
 * GET /api/ops/funnel
 * Get conversion funnel data.
 */
router.get('/funnel', async (req: Request, res: Response) => {
  try {
    const eventId = req.query.event_id as string | undefined;
    const funnel = await OutcomeService.getConversionFunnel(eventId);
    res.json(funnel);
  } catch (error) {
    logger.error({ error }, 'GET /api/ops/funnel failed');
    res.status(500).json({ error: String(error) });
  }
});

/**
 * POST /api/ops/action
 * Log an ops action (close gate, deploy staff, slow entry, etc.).
 */
router.post('/action', async (req: Request, res: Response) => {
  try {
    const { action, gate_id, duration_min } = req.body;

    if (!action || !gate_id) {
      res.status(400).json({ error: 'Missing action or gate_id' });
      return;
    }

    await db.query(
      `INSERT INTO ops_actions (action_id, action, gate_id, duration_min, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [`act_${Date.now()}`, action, gate_id, duration_min || null]
    );

    // Broadcast to all connected WebSocket clients
    broadcastEvent('ops_action', { action, gate_id, duration_min });

    res.json({ success: true, action, gate_id });
  } catch (error) {
    logger.error({ error }, 'POST /api/ops/action failed');
    res.status(500).json({ error: String(error) });
  }
});

export default router;
