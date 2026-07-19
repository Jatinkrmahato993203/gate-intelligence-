// ============================================================================
// Gate Management API Endpoints
// ============================================================================

import { Router, Request, Response } from 'express';
import { GateService } from '../services/gate.service';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

/**
 * GET /api/gates
 * Get all active gates.
 */
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const result = await GateService.getActiveGates();
    res.json(result);
  }),
);

/**
 * GET /api/gates/:id
 * Get single gate details.
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const gate = await GateService.getGateById(req.params.id);

    if (!gate) {
      res.status(404).json({ error: 'Gate not found' });
      return;
    }

    res.json(gate);
  }),
);

export default router;
