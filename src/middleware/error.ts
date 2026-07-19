// ============================================================================
// Global Error Handler
// ============================================================================

import { Request, Response, NextFunction } from 'express';
import { logger } from './logging';

export function errorHandler(error: any, req: Request, res: Response, _next: NextFunction): void {
  logger.error({
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
  });

  const status = error.status || error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  res.status(status).json({
    error: message,
    path: req.path,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  });
}
