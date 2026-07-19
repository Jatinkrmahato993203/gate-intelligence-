// ============================================================================
// Fan App API Endpoints
// ============================================================================

import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { NudgeService } from '../services/nudge.service';
import { RouteService } from '../services/route.service';
import { FanService } from '../services/fan.service';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';

const router = Router();

/**
 * Validation Schemas
 */
const nudgeSchema = Joi.object({
  user_id: Joi.string().required(),
  current_gate_id: Joi.string().required(),
  lat: Joi.number().required(),
  lng: Joi.number().required(),
});

const routeSchema = Joi.object({
  from_gate_id: Joi.string().required(),
  to_gate_id: Joi.string().required(),
});

const confirmSchema = Joi.object({
  nudge_id: Joi.string().required(),
  user_id: Joi.string().required(),
  selected_gate_id: Joi.string().required(),
  predicted_wait_min: Joi.number().optional(),
});

const feedbackSchema = Joi.object({
  entry_token: Joi.string().required(),
  actual_wait_min: Joi.number().optional(),
  predictions_accurate: Joi.boolean().optional(),
  experience: Joi.number().optional(),
});

/**
 * GET /api/fans/nudge
 * Get nudge recommendation for a fan at a specific location.
 */
router.get(
  '/nudge',
  validate(nudgeSchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const { user_id, current_gate_id, lat, lng } = req.query as any;

    const nudge = await NudgeService.generateNudge(
      user_id,
      current_gate_id,
      lat,
      lng,
    );

    res.json(nudge);
  }),
);

/**
 * POST /api/fans/route
 * Calculate route from one gate to another.
 */
router.post(
  '/route',
  validate(routeSchema, 'body'),
  asyncHandler(async (req: Request, res: Response) => {
    const { from_gate_id, to_gate_id } = req.body;

    const route = await RouteService.calculateRoute(from_gate_id, to_gate_id);
    res.json(route);
  }),
);

/**
 * POST /api/fans/confirm
 * Confirm nudge acceptance and issue entry token.
 */
router.post(
  '/confirm',
  validate(confirmSchema, 'body'),
  asyncHandler(async (req: Request, res: Response) => {
    const { nudge_id, user_id, selected_gate_id, predicted_wait_min } = req.body;

    const result = await FanService.confirmNudge(
      nudge_id,
      user_id,
      selected_gate_id,
      predicted_wait_min,
    );

    res.json(result);
  }),
);

/**
 * POST /api/fans/feedback
 * Submit feedback and calibration data.
 */
router.post(
  '/feedback',
  validate(feedbackSchema, 'body'),
  asyncHandler(async (req: Request, res: Response) => {
    const { entry_token, actual_wait_min, predictions_accurate, experience } = req.body;

    await FanService.submitFeedback(entry_token, actual_wait_min, predictions_accurate, experience);

    res.json({ success: true, message: 'Thank you for your feedback!' });
  }),
);

export default router;
