// ============================================================================
// Ops Console API Endpoints
// ============================================================================

import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { WaitTimeService } from '../services/wait-time.service';
import { OutcomeService } from '../services/outcome.service';
import { OpsService } from '../services/ops.service';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';

const router = Router();

/**
 * Validation Schemas
 */
const waitTimesSchema = Joi.object({
  venue_id: Joi.string().optional(),
});

const dashboardSchema = Joi.object({
  event_date: Joi.string().optional(),
});

const funnelSchema = Joi.object({
  event_id: Joi.string().optional(),
});

const actionSchema = Joi.object({
  action: Joi.string().required(),
  gate_id: Joi.string().required(),
  duration_min: Joi.number().optional(),
});

/**
 * GET /api/ops/wait-times
 * Get current wait times for all gates at a venue.
 */
router.get(
  '/wait-times',
  validate(waitTimesSchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const venueId = (req.query.venue_id as string) || process.env.DEFAULT_VENUE_ID || 'stadiumA';
    const waitTimes = await WaitTimeService.getAllWaitTimes(venueId);
    res.json(waitTimes);
  }),
);

/**
 * GET /api/ops/dashboard
 * Get outcome metrics for the ops dashboard.
 */
router.get(
  '/dashboard',
  validate(dashboardSchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const eventDate = req.query.event_date as string | undefined;
    const metrics = await OutcomeService.getDailyMetrics(eventDate);
    res.json(metrics);
  }),
);

/**
 * GET /api/ops/funnel
 * Get conversion funnel data.
 */
router.get(
  '/funnel',
  validate(funnelSchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const eventId = req.query.event_id as string | undefined;
    const funnel = await OutcomeService.getConversionFunnel(eventId);
    res.json(funnel);
  }),
);

/**
 * POST /api/ops/action
 * Log an ops action (close gate, deploy staff, slow entry, etc.).
 */
router.post(
  '/action',
  validate(actionSchema, 'body'),
  asyncHandler(async (req: Request, res: Response) => {
    const { action, gate_id, duration_min } = req.body;

    await OpsService.logAction(action, gate_id, duration_min);

    res.json({ success: true, action, gate_id });
  }),
);

export default router;
