"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRateLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const rate_limit_redis_1 = require("rate-limit-redis");
const redis_1 = require("../config/redis");
const env_1 = require("../config/env");
const createRateLimiter = () => (0, express_rate_limit_1.default)({
    windowMs: env_1.env.RATE_LIMIT_WINDOW_MS,
    max: env_1.env.RATE_LIMIT_MAX_REQUESTS,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/api/health',
    // Only use RedisStore if a real Redis client is connected, otherwise fallback to memory store
    ...(!redis_1.useMockRedis && redis_1.redisClient ? {
        store: new rate_limit_redis_1.RedisStore({
            sendCommand: (...args) => redis_1.redisClient.sendCommand(args),
        })
    } : {}),
});
exports.createRateLimiter = createRateLimiter;
//# sourceMappingURL=rate-limit.js.map