import express, { Express, Request, Response } from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

import { env } from './config/env';
import { errorHandler } from './middleware/error';
import { requestLogger } from './middleware/logging';
import { validateAuth } from './middleware/auth';

import fansRoutes from './routes/fans';
import opsRoutes from './routes/ops';
import gatesRoutes from './routes/gates';
import healthRoutes from './routes/health';
import { createRateLimiter } from './middleware/rate-limit';
import hpp from 'hpp';

export function createApp(): Express {
  const app: Express = express();

  // ============================================================================
  // SECURITY MIDDLEWARE
  // ============================================================================

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts if needed, though we moved to external
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'", 'ws:', 'wss:'], // Allow websockets
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hidePoweredBy: true, // Strips X-Powered-By
    }),
  );
  app.use(hpp()); // Prevent HTTP Parameter Pollution
  app.use(compression());
  app.use(
    cors({
      origin: env.ALLOWED_ORIGINS,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Venue-ID', 'X-API-Key'],
    }),
  );

  // ============================================================================
  // BODY PARSING & LOGGING & RATE LIMITING
  // ============================================================================

  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ limit: '100kb', extended: true }));

  if (process.env.NODE_ENV !== 'test') {
    app.use(requestLogger);
    app.use(createRateLimiter());
  }

  // ====================================================================
  // ROUTES
  // ====================================================================

  // Root
  app.use(express.static(path.join(__dirname, '../public')));
  app.get('/', (_req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../index.html'));
  });

  // Health check (no auth)
  app.use('/api/health', healthRoutes);

  // Fan-facing API
  app.use('/api/fans', validateAuth, fansRoutes);

  // Ops console API
  app.use('/api/ops', validateAuth, opsRoutes);

  // Gate management API
  app.use('/api/gates', validateAuth, gatesRoutes);

  // ====================================================================
  // 404 HANDLER
  // ====================================================================

  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not found',
      path: req.path,
      method: req.method,
    });
  });

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
}
