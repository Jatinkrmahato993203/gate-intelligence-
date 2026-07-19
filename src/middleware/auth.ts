// ============================================================================
// API Authentication Middleware
// ============================================================================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';

export function validateAuth(req: Request, res: Response, next: NextFunction): void {
  // Bypass auth in development / demo mode
  if (!env.REQUIRE_AUTH) {
    return next();
  }

  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (!authHeader && !apiKey) {
    res.status(401).json({
      error: 'Unauthorized — provide Authorization header or X-API-Key',
    });
    return;
  }

  // API key validation (Timing safe comparison)
  if (apiKey) {
    const expectedKey = env.API_KEY || '';
    if (
      expectedKey.length > 0 &&
      apiKey.length === expectedKey.length &&
      crypto.timingSafeEqual(Buffer.from(apiKey), Buffer.from(expectedKey))
    ) {
      return next();
    }
  }

  // Bearer token validation with JWT
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      // Verify JWT token signature
      const decoded = jwt.verify(token, env.JWT_SECRET || '');
      // Can attach decoded token to req.user here if needed
      (req as any).user = decoded;
      return next();
    } catch (err) {
      res.status(401).json({ error: 'Unauthorized — invalid or expired token' });
      return;
    }
  }

  res.status(403).json({ error: 'Forbidden — invalid credentials' });
}
