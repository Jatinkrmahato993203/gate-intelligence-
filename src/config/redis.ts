// ============================================================================
// Redis Cache Client
// ============================================================================

import { createClient, RedisClientType } from 'redis';
import { env } from './env';
import { logger } from '../middleware/logging';

export let redisClient: RedisClientType;
export let useMockRedis = false;
const mockStore = new Map<string, { value: string; expires?: number }>();

export async function initializeRedis(): Promise<void> {
  try {
    redisClient = createClient({
      socket: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        reconnectStrategy: false,
      },
      password: env.REDIS_PASSWORD || undefined,
    });

    redisClient.on('error', (err) => {
      logger.error({ err }, 'Redis client error');
      useMockRedis = true;
    });
    redisClient.on('connect', () => logger.info('Redis connected'));

    await redisClient.connect();
  } catch (error) {
    logger.warn('Redis connection failed — falling back to in-memory Mock Redis mode');
    useMockRedis = true;
  }
}

export const redis = {
  get: (key: string): Promise<string | null> => {
    if (useMockRedis) {
      const entry = mockStore.get(key);
      if (!entry) return Promise.resolve(null);
      if (entry.expires && entry.expires < Date.now()) {
        mockStore.delete(key);
        return Promise.resolve(null);
      }
      return Promise.resolve(entry.value);
    }
    return redisClient.get(key);
  },

  set: (key: string, value: string, ttlSeconds?: number): Promise<string | null> => {
    if (useMockRedis) {
      const expires = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
      mockStore.set(key, { value, expires });
      return Promise.resolve('OK');
    }
    return ttlSeconds ? redisClient.setEx(key, ttlSeconds, value) : redisClient.set(key, value);
  },

  del: (key: string): Promise<number> => {
    if (useMockRedis) {
      const existed = mockStore.has(key);
      mockStore.delete(key);
      return Promise.resolve(existed ? 1 : 0);
    }
    return redisClient.del(key);
  },

  exists: (key: string): Promise<number> => {
    if (useMockRedis) {
      const existed = mockStore.has(key);
      if (existed) {
        const entry = mockStore.get(key)!;
        if (entry.expires && entry.expires < Date.now()) {
          mockStore.delete(key);
          return Promise.resolve(0);
        }
        return Promise.resolve(1);
      }
      return Promise.resolve(0);
    }
    return redisClient.exists(key);
  },

  quit: (): Promise<string> => {
    if (useMockRedis) {
      return Promise.resolve('OK');
    }
    return redisClient.quit();
  },
};
