import { Request, Response, NextFunction } from 'express';

/**
 * Escapes common HTML symbols to prevent basic XSS attacks.
 * Replaces <, >, &, ', and " with their HTML entity equivalents.
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Recursively sanitizes objects and arrays by escaping strings.
 */
function sanitizeObject(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return escapeHtml(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  if (obj !== null && typeof obj === 'object') {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitizedObj[key] = sanitizeObject(value);
    }
    return sanitizedObj;
  }
  return obj;
}

/**
 * Express middleware to sanitize req.body, req.query, and req.params
 * to prevent XSS and injection payloads globally.
 */
export const sanitizeInput = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body) req.body = sanitizeObject(req.body);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (req.query) req.query = sanitizeObject(req.query) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (req.params) req.params = sanitizeObject(req.params) as any;
  next();
};
