// ============================================================================
// FIFA 26 Gate Intelligence Engine — Main Server Entry Point
// ============================================================================

import http from 'http';
import { WebSocketServer } from 'ws';
import 'dotenv/config';

import { env } from './config/env';
import { initializeDatabase, db } from './config/database';
import { initializeRedis, redis } from './config/redis';
import { initializeGemini } from './config/gemini';

import { logger } from './middleware/logging';
import { createApp } from './app';

import { handleWebSocketMessage, addConnection, removeConnection } from './websocket/handlers';
import { startAggregationJob, startForecastCalibrateJob, startWaitTimeBroadcast } from './jobs';

const PORT = env.PORT;

// ============================================================================
// BOOTSTRAP & INITIALIZATION
// ============================================================================

async function bootstrap(): Promise<void> {
  try {
    // Step 1: Connect to PostgreSQL
    logger.info('Connecting to PostgreSQL...');
    await initializeDatabase();
    logger.info('✓ Database connected');

    // Step 2: Connect to Redis
    logger.info('Connecting to Redis...');
    await initializeRedis();
    logger.info('✓ Redis connected');

    // Step 3: Initialize Gemini API
    logger.info('Initializing Gemini API...');
    await initializeGemini();

    // Create the configured Express App
    const app = createApp();

    // ====================================================================
    // WEBSOCKET SERVER
    // ====================================================================

    const server = http.createServer(app);

    if (env.ENABLE_WEBSOCKET) {
      const wss = new WebSocketServer({
        server,
        perMessageDeflate: true,
        maxPayload: 100 * 1024, // 100KB
      });

      wss.on('connection', (ws) => {
        addConnection(ws);

        ws.on('message', async (data) => {
          try {
            await handleWebSocketMessage(ws, data as Buffer);
          } catch (error) {
            logger.error({ error }, 'WebSocket message error');
            ws.send(
              JSON.stringify({
                type: 'error',
                message: 'Failed to process message',
              }),
            );
          }
        });

        ws.on('close', () => removeConnection(ws));
        ws.on('error', (error) => logger.error({ error }, 'WebSocket error'));
      });

      logger.info('✓ WebSocket server attached');
    }

    // ====================================================================
    // SCHEDULED JOBS
    // ====================================================================

    if (env.ENABLE_SCHEDULED_JOBS) {
      startAggregationJob();
      startForecastCalibrateJob();
      startWaitTimeBroadcast();
      logger.info('✓ Scheduled jobs started');
    }

    // ====================================================================
    // START SERVER
    // ====================================================================

    server.listen(PORT, () => {
      logger.info(`⚽ FIFA 26 Gate Intelligence running on port ${PORT}`);
      logger.info(`   Health:    http://localhost:${PORT}/api/health`);
      logger.info(`   Fans:      http://localhost:${PORT}/api/fans`);
      logger.info(`   Ops:       http://localhost:${PORT}/api/ops`);
      logger.info(`   Gates:     http://localhost:${PORT}/api/gates`);
      logger.info(`   WebSocket: ws://localhost:${PORT}`);
    });

    // ====================================================================
    // GRACEFUL SHUTDOWN
    // ====================================================================

    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);
      server.close(async () => {
        await db.end();
        await redis.quit();
        logger.info('Server stopped');
        process.exit(0);
      });

      // Force exit after 10 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error({ error }, '❌ Bootstrap failed');
    process.exit(1);
  }
}

bootstrap();
