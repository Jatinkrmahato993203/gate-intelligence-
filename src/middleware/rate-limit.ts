import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redisClient, useMockRedis } from '../config/redis';
import { env } from '../config/env';

export const createRateLimiter = () =>
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX_REQUESTS,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/api/health',
    // Only use RedisStore if a real Redis client is connected, otherwise fallback to memory store
    ...(!useMockRedis && redisClient
      ? {
          store: new RedisStore({
            sendCommand: (...args: string[]) => redisClient.sendCommand(args),
          }),
        }
      : {}),
  });

export const authRateLimiter = () =>
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs for auth routes
    message: { error: 'Too many authentication attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    ...(!useMockRedis && redisClient
      ? {
          store: new RedisStore({
            sendCommand: (...args: string[]) => redisClient.sendCommand(args),
          }),
        }
      : {}),
  });
