// ============================================================================
// Gate Management API Endpoints
// ============================================================================

import { Router, Request, Response } from 'express';
import { db } from '../config/database';
import { logger } from '../middleware/logging';

const router = Router();

/**
 * GET /api/gates
 * Get all active gates.
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT * FROM gates WHERE is_active = true ORDER BY gate_id`
    );
    res.json({ gates: result.rows, count: result.rowCount });
  } catch (error) {
    logger.error({ error }, 'GET /api/gates failed');
    res.status(500).json({ error: String(error) });
  }
});

/**
 * GET /api/gates/:id
 * Get single gate details.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT * FROM gates WHERE gate_id = $1`,
      [req.params.id]
    );

    if (!result.rows.length) {
      res.status(404).json({ error: 'Gate not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error({ error }, 'GET /api/gates/:id failed');
    res.status(500).json({ error: String(error) });
  }
});

export default router;
