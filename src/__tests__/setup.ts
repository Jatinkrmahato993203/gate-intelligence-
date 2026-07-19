import { NextFunction } from 'express';

// Mock the Pino Logger so it doesn't clutter our test output
jest.mock('../middleware/logging', () => ({
  requestLogger: (_req: unknown, _res: unknown, next: NextFunction) => next(),
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock the Database Connection
jest.mock('../config/database', () => ({
  db: {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    connect: jest.fn(),
    end: jest.fn(),
  },
  initializeDatabase: jest.fn().mockResolvedValue(true),
}));

// Mock the Redis Connection
jest.mock('../config/redis', () => ({
  redis: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setEx: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    mGet: jest.fn().mockResolvedValue([]),
    connect: jest.fn(),
    quit: jest.fn(),
    isReady: true,
  },
  initializeRedis: jest.fn().mockResolvedValue(true),
}));

// Mock Rate Limiter to just pass through
jest.mock('../middleware/rate-limit', () => ({
  createRateLimiter: () => (_req: unknown, _res: unknown, next: NextFunction) => next(),
  authRateLimiter: () => (_req: unknown, _res: unknown, next: NextFunction) => next(),
}));

// Mock Gemini
jest.mock('../config/gemini', () => ({
  initializeGemini: jest.fn().mockResolvedValue(true),
  getGeminiModel: jest.fn().mockReturnValue({
    generateContent: jest.fn().mockResolvedValue({
      response: { text: () => 'Mocked Gemini Response' },
    }),
  }),
}));

// Automatically apply JWT verification mock
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn((token, _secret, callback) => {
    // If it's the test payload we expect, pass it
    if (token === 'Bearer valid-token' || token === 'valid-token') {
      const decoded = { id: 'test-user', role: 'ops' };
      if (callback) return callback(null, decoded);
      return decoded;
    }
    const err = new Error('Invalid token');
    if (callback) return callback(err, null);
    throw err;
  }),
}));
