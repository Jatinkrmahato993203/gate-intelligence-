// ============================================================================
// Health Check Route
// ============================================================================

import { Router, Request, Response } from 'express';
import { db } from '../config/database';
import { getConnectionCount } from '../websocket/handlers';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const dbCheck = await db.query('SELECT NOW() as now');

    res.json({
      service: 'FIFA 26 Gate Intelligence',
      version: '1.0.0',
      status: 'operational',
      uptime: Math.round(process.uptime()),
      websocket_clients: getConnectionCount(),
      db_time: dbCheck.rows[0].now,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      service: 'FIFA 26 Gate Intelligence',
      status: 'degraded',
      error: String(error),
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
