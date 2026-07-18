"use strict";
// ============================================================================
// Environment Variable Validation
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
exports.loadEnv = loadEnv;
function getEnvString(key, fallback) {
    return process.env[key] || fallback;
}
function getEnvNumber(key, fallback) {
    const val = process.env[key];
    return val ? parseInt(val, 10) : fallback;
}
function getEnvBool(key, fallback) {
    const val = process.env[key];
    if (!val)
        return fallback;
    return val === 'true' || val === '1';
}
function loadEnv() {
    return {
        NODE_ENV: getEnvString('NODE_ENV', 'development'),
        PORT: getEnvNumber('PORT', 3000),
        DB_HOST: getEnvString('DB_HOST', 'localhost'),
        DB_PORT: getEnvNumber('DB_PORT', 5432),
        DB_NAME: getEnvString('DB_NAME', 'gate_intelligence'),
        DB_USER: getEnvString('DB_USER', 'postgres'),
        DB_PASSWORD: getEnvString('DB_PASSWORD', 'postgres'),
        DB_SSL: getEnvBool('DB_SSL', false),
        REDIS_HOST: getEnvString('REDIS_HOST', 'localhost'),
        REDIS_PORT: getEnvNumber('REDIS_PORT', 6379),
        REDIS_PASSWORD: getEnvString('REDIS_PASSWORD', ''),
        GEMINI_API_KEY: getEnvString('GEMINI_API_KEY', ''),
        ALLOWED_ORIGINS: getEnvString('ALLOWED_ORIGINS', 'http://localhost:3000').split(','),
        REQUIRE_AUTH: getEnvBool('REQUIRE_AUTH', false),
        RATE_LIMIT_WINDOW_MS: getEnvNumber('RATE_LIMIT_WINDOW_MS', 900000),
        RATE_LIMIT_MAX_REQUESTS: getEnvNumber('RATE_LIMIT_MAX_REQUESTS', 100),
        DEFAULT_VENUE_ID: getEnvString('DEFAULT_VENUE_ID', 'stadiumA'),
        LOG_LEVEL: getEnvString('LOG_LEVEL', 'info'),
        ENABLE_GEMINI_FORECASTING: getEnvBool('ENABLE_GEMINI_FORECASTING', true),
        ENABLE_WEBSOCKET: getEnvBool('ENABLE_WEBSOCKET', true),
        ENABLE_SCHEDULED_JOBS: getEnvBool('ENABLE_SCHEDULED_JOBS', true),
    };
}
exports.env = loadEnv();
//# sourceMappingURL=env.js.map