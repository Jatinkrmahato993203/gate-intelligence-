"use strict";
// ============================================================================
// FIFA 26 Gate Intelligence Engine — Main Server Entry Point
// ============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const ws_1 = require("ws");
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
require("dotenv/config");
const env_1 = require("./config/env");
const database_1 = require("./config/database");
const redis_1 = require("./config/redis");
const gemini_1 = require("./config/gemini");
const error_1 = require("./middleware/error");
const logging_1 = require("./middleware/logging");
const rate_limit_1 = require("./middleware/rate-limit");
const auth_1 = require("./middleware/auth");
const fans_1 = __importDefault(require("./routes/fans"));
const ops_1 = __importDefault(require("./routes/ops"));
const gates_1 = __importDefault(require("./routes/gates"));
const health_1 = __importDefault(require("./routes/health"));
const handlers_1 = require("./websocket/handlers");
const jobs_1 = require("./jobs");
const app = (0, express_1.default)();
const PORT = env_1.env.PORT;
// ============================================================================
// SECURITY MIDDLEWARE
// ============================================================================
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use((0, compression_1.default)());
app.use((0, cors_1.default)({
    origin: env_1.env.ALLOWED_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Venue-ID', 'X-API-Key'],
}));
// ============================================================================
// BODY PARSING & LOGGING
// ============================================================================
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ limit: '10mb', extended: true }));
app.use(logging_1.requestLogger);
app.use(rate_limit_1.rateLimiter);
// ============================================================================
// BOOTSTRAP & INITIALIZATION
// ============================================================================
async function bootstrap() {
    try {
        // Step 1: Connect to PostgreSQL
        logging_1.logger.info('Connecting to PostgreSQL...');
        await (0, database_1.initializeDatabase)();
        logging_1.logger.info('✓ Database connected');
        // Step 2: Connect to Redis
        logging_1.logger.info('Connecting to Redis...');
        await (0, redis_1.initializeRedis)();
        logging_1.logger.info('✓ Redis connected');
        // Step 3: Initialize Gemini API
        logging_1.logger.info('Initializing Gemini API...');
        await (0, gemini_1.initializeGemini)();
        // ====================================================================
        // ROUTES
        // ====================================================================
        // Root
        app.get('/', (_req, res) => {
            res.json({
                service: 'FIFA 26 Gate Intelligence',
                version: '1.0.0',
                status: 'operational',
                timestamp: new Date().toISOString(),
            });
        });
        // Health check (no auth)
        app.use('/api/health', health_1.default);
        // Fan-facing API
        app.use('/api/fans', auth_1.validateAuth, fans_1.default);
        // Ops console API
        app.use('/api/ops', auth_1.validateAuth, ops_1.default);
        // Gate management API
        app.use('/api/gates', auth_1.validateAuth, gates_1.default);
        // ====================================================================
        // 404 HANDLER
        // ====================================================================
        app.use((req, res) => {
            res.status(404).json({
                error: 'Not found',
                path: req.path,
                method: req.method,
            });
        });
        // Global error handler (must be last)
        app.use(error_1.errorHandler);
        // ====================================================================
        // WEBSOCKET SERVER
        // ====================================================================
        const server = http_1.default.createServer(app);
        if (env_1.env.ENABLE_WEBSOCKET) {
            const wss = new ws_1.WebSocketServer({
                server,
                perMessageDeflate: true,
                maxPayload: 100 * 1024, // 100KB
            });
            wss.on('connection', (ws) => {
                (0, handlers_1.addConnection)(ws);
                ws.on('message', async (data) => {
                    try {
                        await (0, handlers_1.handleWebSocketMessage)(ws, data);
                    }
                    catch (error) {
                        logging_1.logger.error({ error }, 'WebSocket message error');
                        ws.send(JSON.stringify({ type: 'error', message: 'Failed to process message' }));
                    }
                });
                ws.on('close', () => (0, handlers_1.removeConnection)(ws));
                ws.on('error', (error) => logging_1.logger.error({ error }, 'WebSocket error'));
            });
            logging_1.logger.info('✓ WebSocket server attached');
        }
        // ====================================================================
        // SCHEDULED JOBS
        // ====================================================================
        if (env_1.env.ENABLE_SCHEDULED_JOBS) {
            (0, jobs_1.startAggregationJob)();
            (0, jobs_1.startForecastCalibrateJob)();
            (0, jobs_1.startWaitTimeBroadcast)();
            logging_1.logger.info('✓ Scheduled jobs started');
        }
        // ====================================================================
        // START SERVER
        // ====================================================================
        server.listen(PORT, () => {
            logging_1.logger.info(`⚽ FIFA 26 Gate Intelligence running on port ${PORT}`);
            logging_1.logger.info(`   Health:    http://localhost:${PORT}/api/health`);
            logging_1.logger.info(`   Fans:      http://localhost:${PORT}/api/fans`);
            logging_1.logger.info(`   Ops:       http://localhost:${PORT}/api/ops`);
            logging_1.logger.info(`   Gates:     http://localhost:${PORT}/api/gates`);
            logging_1.logger.info(`   WebSocket: ws://localhost:${PORT}`);
        });
        // ====================================================================
        // GRACEFUL SHUTDOWN
        // ====================================================================
        const shutdown = async (signal) => {
            logging_1.logger.info(`${signal} received, shutting down gracefully...`);
            server.close(async () => {
                await database_1.db.end();
                await redis_1.redis.quit();
                logging_1.logger.info('Server stopped');
                process.exit(0);
            });
            // Force exit after 10 seconds
            setTimeout(() => {
                logging_1.logger.error('Could not close connections in time, forcefully shutting down');
                process.exit(1);
            }, 10000);
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }
    catch (error) {
        logging_1.logger.error({ error }, '❌ Bootstrap failed');
        process.exit(1);
    }
}
bootstrap();
//# sourceMappingURL=index.js.map