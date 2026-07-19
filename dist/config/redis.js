"use strict";
// ============================================================================
// Redis Cache Client
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = exports.useMockRedis = exports.redisClient = void 0;
exports.initializeRedis = initializeRedis;
const redis_1 = require("redis");
const env_1 = require("./env");
const logging_1 = require("../middleware/logging");
exports.useMockRedis = false;
const mockStore = new Map();
async function initializeRedis() {
    try {
        exports.redisClient = (0, redis_1.createClient)({
            socket: {
                host: env_1.env.REDIS_HOST,
                port: env_1.env.REDIS_PORT,
                reconnectStrategy: false,
            },
            password: env_1.env.REDIS_PASSWORD || undefined,
        });
        exports.redisClient.on('error', (err) => {
            logging_1.logger.error({ err }, 'Redis client error');
            exports.useMockRedis = true;
        });
        exports.redisClient.on('connect', () => logging_1.logger.info('Redis connected'));
        await exports.redisClient.connect();
    }
    catch (error) {
        logging_1.logger.warn('Redis connection failed — falling back to in-memory Mock Redis mode');
        exports.useMockRedis = true;
    }
}
exports.redis = {
    get: (key) => {
        if (exports.useMockRedis) {
            const entry = mockStore.get(key);
            if (!entry)
                return Promise.resolve(null);
            if (entry.expires && entry.expires < Date.now()) {
                mockStore.delete(key);
                return Promise.resolve(null);
            }
            return Promise.resolve(entry.value);
        }
        return exports.redisClient.get(key);
    },
    set: (key, value, ttlSeconds) => {
        if (exports.useMockRedis) {
            const expires = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
            mockStore.set(key, { value, expires });
            return Promise.resolve('OK');
        }
        return ttlSeconds ? exports.redisClient.setEx(key, ttlSeconds, value) : exports.redisClient.set(key, value);
    },
    del: (key) => {
        if (exports.useMockRedis) {
            const existed = mockStore.has(key);
            mockStore.delete(key);
            return Promise.resolve(existed ? 1 : 0);
        }
        return exports.redisClient.del(key);
    },
    exists: (key) => {
        if (exports.useMockRedis) {
            const existed = mockStore.has(key);
            if (existed) {
                const entry = mockStore.get(key);
                if (entry.expires && entry.expires < Date.now()) {
                    mockStore.delete(key);
                    return Promise.resolve(0);
                }
                return Promise.resolve(1);
            }
            return Promise.resolve(0);
        }
        return exports.redisClient.exists(key);
    },
    quit: () => {
        if (exports.useMockRedis) {
            return Promise.resolve('OK');
        }
        return exports.redisClient.quit();
    },
};
//# sourceMappingURL=redis.js.map