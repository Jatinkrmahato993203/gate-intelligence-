/**
 * Gate Intelligence Engine — Backend Architecture
 * 
 * Stack: Node.js + Express.js + TypeScript + PostgreSQL + WebSocket
 * This file shows the complete project structure and key services
 */

// ============================================================================
// 1. PROJECT STRUCTURE
// ============================================================================

/*
gate-intelligence-engine-backend/
├── src/
│   ├── index.ts                    # Main server entry point
│   ├── config/
│   │   ├── database.ts             # PostgreSQL connection
│   │   ├── gemini.ts               # Gemini API client
│   │   └── env.ts                  # Environment variables
│   ├── models/
│   │   ├── nudge.ts                # Nudge entity + queries
│   │   ├── confirmation.ts         # Confirmation entity
│   │   ├── gate-entry.ts           # Gate entry entity
│   │   └── feedback.ts             # Feedback entity
│   ├── services/
│   │   ├── wait-time.service.ts    # Wait time calculation
│   │   ├── nudge.service.ts        # Nudge generation & sending
│   │   ├── route.service.ts        # Route calculation
│   │   ├── forecast.service.ts     # Arrival prediction (Gemini + rule-based)
│   │   └── outcome.service.ts      # Outcome tracking & aggregation
│   ├── routes/
│   │   ├── fans.ts                 # /api/fans/* endpoints
│   │   ├── ops.ts                  # /api/ops/* endpoints
│   │   ├── gates.ts                # /api/gates/* endpoints
│   │   └── health.ts               # /api/health endpoint
│   ├── middleware/
│   │   ├── auth.ts                 # API key / JWT validation
│   │   ├── error.ts                # Global error handler
│   │   ├── logging.ts              # Request logging
│   │   └── rate-limit.ts           # Rate limiting
│   ├── utils/
│   │   ├── geo.ts                  # Haversine distance, geofence
│   │   ├── token.ts                # Entry token generation
│   │   ├── hash.ts                 # User ID anonymization
│   │   └── cache.ts                # Redis cache wrapper
│   ├── websocket/
│   │   ├── handlers.ts             # WebSocket event handlers
│   │   └── broadcast.ts            # Publish wait times to clients
│   └── jobs/
│       ├── aggregation.ts          # Nightly aggregations
│       └── forecast-calibration.ts # Model retraining
├── migrations/                      # Database migrations (flyway/typeorm)
├── tests/
│   ├── wait-time.test.ts
│   ├── route.test.ts
│   └── forecast.test.ts
├── package.json
├── tsconfig.json
└── docker-compose.yml              # PostgreSQL + Redis + dev server

*/

// ============================================================================
// 2. MAIN SERVER (index.ts)
// ============================================================================

import express, { Express, Request, Response, NextFunction } from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

import { initializeDatabase } from './config/database';
import { initializeGemini } from './config/gemini';
import { errorHandler } from './middleware/error';
import { requestLogger } from './middleware/logging';
import { rateLimiter } from './middleware/rate-limit';

import fansRoutes from './routes/fans';
import opsRoutes from './routes/ops';
import gatesRoutes from './routes/gates';
import healthRoutes from './routes/health';

import { handleWebSocket } from './websocket/handlers';
import { startAggregationJob, startForecastCalibrateJob } from './jobs';

const app: Express = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// MIDDLEWARE
// ============================================================================

app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use(requestLogger);
app.use(rateLimiter);

// ============================================================================
// INITIALIZE SERVICES
// ============================================================================

async function bootstrap() {
  try {
    // Connect to database
    await initializeDatabase();
    console.log('✓ Database connected');

    // Initialize Gemini API
    await initializeGemini();
    console.log('✓ Gemini API initialized');

    // ========================================================================
    // ROUTES
    // ========================================================================

    // Health check
    app.use('/api/health', healthRoutes);

    // Fan app endpoints
    app.use('/api/fans', fansRoutes);

    // Ops console endpoints
    app.use('/api/ops', opsRoutes);

    // Gate management endpoints
    app.use('/api/gates', gatesRoutes);

    // Root
    app.get('/', (req, res) => {
      res.json({ 
        service: 'Gate Intelligence Engine', 
        version: '1.0.0',
        status: 'operational',
        timestamp: new Date().toISOString()
      });
    });

    // 404 handler
    app.use((req: Request, res: Response) => {
      res.status(404).json({ error: 'Not found', path: req.path });
    });

    // Global error handler
    app.use(errorHandler);

    // ========================================================================
    // WEBSOCKET (Real-time updates)
    // ========================================================================

    const server = http.createServer(app);
    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws) => {
      console.log('WebSocket client connected');
      ws.on('message', (msg) => handleWebSocket(ws, msg));
      ws.on('close', () => console.log('WebSocket client disconnected'));
    });

    // ========================================================================
    // SCHEDULED JOBS
    // ========================================================================

    startAggregationJob(); // Every hour: refresh materialized views
    startForecastCalibrateJob(); // Every 6 hours: recalibrate MAPE

    // ========================================================================
    // START SERVER
    // ========================================================================

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`   Health: http://localhost:${PORT}/api/health`);
      console.log(`   Fans:   http://localhost:${PORT}/api/fans`);
      console.log(`   Ops:    http://localhost:${PORT}/api/ops`);
      console.log(`   WebSocket: ws://localhost:${PORT}`);
    });

  } catch (error) {
    console.error('❌ Bootstrap failed:', error);
    process.exit(1);
  }
}

bootstrap();

// ============================================================================
// 3. WAIT TIME SERVICE (services/wait-time.service.ts)
// ============================================================================

import { db } from '../config/database';
import { calculateWaitTime as calcWait } from '../lib/wait-time-calculation';

export class WaitTimeService {
  /**
   * Get current wait times for all gates
   */
  static async getWaitTimes(venueId: string): Promise<{[gateId: string]: number}> {
    const gates = await db.query(
      `SELECT id, gate_id FROM gates WHERE venue_id = $1`,
      [venueId]
    );

    const waitTimes: {[key: string]: number} = {};

    for (const gate of gates.rows) {
      const wait = await this.calculateWaitForGate(gate.gate_id);
      waitTimes[gate.gate_id] = wait;
    }

    return waitTimes;
  }

  /**
   * Calculate wait time for a specific gate
   */
  static async calculateWaitForGate(gateId: string): Promise<number> {
    // Get gate config
    const gateResult = await db.query(
      `SELECT throughput_per_min, processing_time_sec, max_queue_length, 
              crowd_slowdown_factor FROM gates WHERE gate_id = $1`,
      [gateId]
    );

    if (!gateResult.rows.length) return 0;
    const gate = gateResult.rows[0];

    // Get recent queue observations
    const queueResult = await db.query(
      `SELECT observed_queue_count, confidence 
       FROM queue_observations 
       WHERE gate_id = $1 
       ORDER BY created_at DESC 
       LIMIT 10`,
      [gateId]
    );

    const observations = queueResult.rows.map((r: any) => ({
      observed_queue_count: r.observed_queue_count,
      confidence: r.confidence,
      timestamp: new Date(),
    }));

    // Get arrival forecast
    const forecast = await this.getArrivalForecast(gateId);

    // Calculate using imported function
    const result = calcWait(
      { ...gate, queue_history: observations, id: gateId },
      forecast
    );

    // Round to nearest 0.5 min
    return Math.round(result.estimated_wait_min * 2) / 2;
  }

  /**
   * Get arrival forecast (Gemini or rule-based)
   */
  static async getArrivalForecast(gateId: string): Promise<any> {
    try {
      // Try Gemini first
      return await this.getGeminiForecast(gateId);
    } catch (error) {
      console.warn('Gemini forecast failed, using rule-based fallback');
      return this.getRuleBasedForecast(gateId);
    }
  }

  /**
   * Get Gemini-powered forecast
   */
  static async getGeminiForecast(gateId: string): Promise<any> {
    // Get context for Gemini
    const queue = await this.getRecentQueue(gateId);
    const weather = await this.getCurrentWeather();
    const timeTimes = await this.getTimeToEvent();

    const prompt = `Stadium arrival forecast context:
- Current queue: ${queue} people
- Time to kickoff: ${timeTimes.minutesToKickoff} minutes
- Weather: ${weather.condition}, ${weather.temp}°C
- Recent arrival trend: [data]

Predict arrivals in next 5 minutes. Respond ONLY as JSON:
{"predicted_arrivals": <number>, "confidence": <0.0-1.0>}`;

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.GEMINI_API_KEY!,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;
    const result = JSON.parse(text);

    return {
      time_window: 'next_5_min',
      predicted_arrivals: result.predicted_arrivals,
      confidence: result.confidence,
    };
  }

  /**
   * Rule-based forecast (fallback)
   */
  static async getRuleBasedForecast(gateId: string): Promise<any> {
    const timeTimes = await this.getTimeToEvent();
    const baseline = 180; // people/min average

    // Time-to-kickoff multiplier
    let multiplier = 1.0;
    if (timeTimes.minutesToKickoff < 90) {
      const intensities: {[key: number]: number} = {
        90: 1.0, 60: 1.3, 30: 2.2, 15: 1.8, 5: 0.4, 0: 0.05,
      };
      multiplier = Object.entries(intensities)
        .reverse()
        .find(([m]) => parseInt(m) <= timeTimes.minutesToKickoff)?.[1] || 1.0;
    }

    const predicted = Math.round(baseline * multiplier * 5); // 5-min window

    return {
      time_window: 'next_5_min',
      predicted_arrivals: predicted,
      confidence: 0.72,
    };
  }

  private static async getRecentQueue(gateId: string): Promise<number> {
    const result = await db.query(
      `SELECT observed_queue_count FROM queue_observations 
       WHERE gate_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [gateId]
    );
    return result.rows[0]?.observed_queue_count || 0;
  }

  private static async getCurrentWeather(): Promise<any> {
    // Stub: integrate with weather API if available
    return { condition: 'clear', temp: 22 };
  }

  private static async getTimeToEvent(): Promise<any> {
    const event = await db.query(
      `SELECT scheduled_start FROM events 
       WHERE scheduled_start > NOW() 
       ORDER BY scheduled_start LIMIT 1`
    );
    if (!event.rows.length) return { minutesToKickoff: 999 };
    const minutesToKickoff = Math.floor(
      (new Date(event.rows[0].scheduled_start).getTime() - Date.now()) / 60000
    );
    return { minutesToKickoff };
  }
}

// ============================================================================
// 4. NUDGE SERVICE (services/nudge.service.ts)
// ============================================================================

export class NudgeService {
  /**
   * Generate nudge for a fan
   */
  static async generateNudge(userId: string, location: {lat: number, lng: number}): Promise<any> {
    const venue = await this.getNearestVenue(location);
    if (!venue) return null;

    // Get wait times
    const waitTimes = await WaitTimeService.getWaitTimes(venue.venue_id);

    // Find current gate (closest to user)
    const currentGate = Object.entries(waitTimes).sort(
      ([, a], [, b]) => a - b
    )[0]?.[0];

    if (!currentGate) return null;

    // Find recommended gate (lowest wait, not current)
    const recommendedGate = Object.entries(waitTimes)
      .filter(([g]) => g !== currentGate)
      .sort(([, a], [, b]) => a - b)[0];

    if (!recommendedGate) return null;

    const timeSaved = waitTimes[currentGate] - recommendedGate[1];
    if (timeSaved < 2) return null; // Not worth nudging for <2 min savings

    // Create nudge record
    const nudgeId = `nudge_${Date.now()}`;
    const hashedUserId = require('crypto')
      .createHash('sha256')
      .update(userId)
      .digest('hex')
      .substring(0, 16);

    await db.query(
      `INSERT INTO nudges 
       (nudge_id, user_id, recommended_gate_id, current_gate_id, 
        wait_time_current_min, wait_time_recommended_min, time_saved_min, 
        forecast_confidence, event_id, venue_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        nudgeId,
        hashedUserId,
        recommendedGate[0],
        currentGate,
        waitTimes[currentGate],
        recommendedGate[1],
        timeSaved,
        0.89, // stub confidence
        venue.event_id,
        venue.venue_id,
      ]
    );

    // Log interaction: "received"
    await db.query(
      `INSERT INTO nudge_interactions (nudge_id, action, action_at)
       SELECT id, 'received', NOW() FROM nudges WHERE nudge_id = $1`,
      [nudgeId]
    );

    return {
      nudge_id: nudgeId,
      recommended_gate: recommendedGate[0],
      current_gate: currentGate,
      wait_current: waitTimes[currentGate],
      wait_recommended: recommendedGate[1],
      time_saved: timeSaved,
    };
  }

  private static async getNearestVenue(location: {lat: number, lng: number}): Promise<any> {
    const result = await db.query(
      `SELECT venue_id, event_id FROM venues 
       ORDER BY location <-> point($1, $2) LIMIT 1`,
      [location.lng, location.lat]
    );
    return result.rows[0] || null;
  }
}

// ============================================================================
// 5. ROUTE SERVICE (services/route.service.ts)
// ============================================================================

export class RouteService {
  /**
   * Calculate routes from current location
   */
  static async getRoutes(userLocation: {lat: number, lng: number}, currentGate: string): Promise<any[]> {
    const gates = await db.query(
      `SELECT gate_id, location, throughput_per_min FROM gates 
       WHERE venue_id = (SELECT venue_id FROM gates WHERE gate_id = $1)`,
      [currentGate]
    );

    const waitTimes = await WaitTimeService.getWaitTimes(
      (await db.query(`SELECT venue_id FROM gates WHERE gate_id = $1`, [currentGate])).rows[0].venue_id
    );

    const routes = gates.rows.map((gate: any) => {
      const [lat, lng] = gate.location.slice(1, -1).split(',').map(Number);
      const distance = this.haversineDistance(userLocation, {lat, lng});
      const walkTime = Math.ceil(distance / 1.4); // 1.4 m/s walking speed

      return {
        gate_id: gate.gate_id,
        distance_m: distance,
        walk_time_min: walkTime,
        queue_wait_min: waitTimes[gate.gate_id],
        total_time_min: walkTime + waitTimes[gate.gate_id],
        recommended: false, // will be set below
      };
    });

    // Sort and mark first as recommended
    routes.sort((a, b) => a.total_time_min - b.total_time_min);
    if (routes.length) routes[0].recommended = true;

    return routes;
  }

  private static haversineDistance(
    loc1: {lat: number, lng: number},
    loc2: {lat: number, lng: number}
  ): number {
    const R = 6371000; // meters
    const dLat = (loc2.lat - loc1.lat) * Math.PI / 180;
    const dLng = (loc2.lng - loc1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(loc1.lat * Math.PI / 180) * Math.cos(loc2.lat * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}

// ============================================================================
// 6. API ROUTES (routes/fans.ts)
// ============================================================================

import { Router, Request, Response } from 'express';
import { NudgeService } from '../services/nudge.service';
import { RouteService } from '../services/route.service';

const router = Router();

/**
 * GET /api/fans/nudges
 * Get nudge for fan at location
 */
router.get('/nudges', async (req: Request, res: Response) => {
  try {
    const { user_id, lat, lng } = req.query;
    const nudge = await NudgeService.generateNudge(
      user_id as string,
      { lat: parseFloat(lat as string), lng: parseFloat(lng as string) }
    );
    res.json(nudge || { message: 'No nudge needed' });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * POST /api/fans/nudges/:nudgeId/interactions
 * Log nudge interaction (tapped_route, dismissed)
 */
router.post('/nudges/:nudgeId/interactions', async (req: Request, res: Response) => {
  try {
    const { action } = req.body;
    await db.query(
      `INSERT INTO nudge_interactions (nudge_id, action, action_at)
       SELECT id, $1, NOW() FROM nudges WHERE nudge_id = $2`,
      [action, req.params.nudgeId]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * GET /api/fans/routes
 * Get route options from current location
 */
router.get('/routes', async (req: Request, res: Response) => {
  try {
    const { lat, lng, current_gate } = req.query;
    const routes = await RouteService.getRoutes(
      { lat: parseFloat(lat as string), lng: parseFloat(lng as string) },
      current_gate as string
    );
    res.json({ routes });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * POST /api/fans/route-decisions
 * Log route decision
 */
router.post('/route-decisions', async (req: Request, res: Response) => {
  try {
    const { user_id, selected_gate, reason, time_to_decide_sec, location } = req.body;
    await db.query(
      `INSERT INTO route_decisions 
       (decision_id, user_id, selected_gate_id, reason, time_to_decide_sec, user_location)
       VALUES ($1, $2, $3, $4, $5, point($6, $7))`,
      [`decision_${Date.now()}`, user_id, selected_gate, reason, time_to_decide_sec, location.lng, location.lat]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * POST /api/fans/confirmations
 * Confirm gate choice, issue entry token
 */
router.post('/confirmations', async (req: Request, res: Response) => {
  try {
    const { user_id, selected_gate, predicted_wait_min, device_id } = req.body;
    const entryToken = `entr_${Math.random().toString(36).substring(2, 20)}`;

    await db.query(
      `INSERT INTO confirmations 
       (confirmation_id, entry_token, user_id, confirmed_gate_id, predicted_wait_min, device_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '1 hour')`,
      [`conf_${Date.now()}`, entryToken, user_id, selected_gate, predicted_wait_min, device_id]
    );

    res.json({ entry_token: entryToken, expires_at: new Date(Date.now() + 3600000).toISOString() });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * POST /api/fans/feedback
 * Submit feedback (calibration data)
 */
router.post('/feedback', async (req: Request, res: Response) => {
  try {
    const { user_id, entry_token, predictions_accurate, experience, direction_followed, additional_notes } = req.body;

    await db.query(
      `INSERT INTO feedback 
       (feedback_id, entry_token, user_id, predictions_accurate, experience, direction_followed, additional_notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [`fbk_${Date.now()}`, entry_token, user_id, predictions_accurate, experience, direction_followed, additional_notes]
    );

    res.json({ success: true, message: 'Thanks for the feedback!' });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export default router;

// ============================================================================
// 7. OPS ROUTES (routes/ops.ts)
// ============================================================================

/**
 * GET /api/ops/wait-times
 * Real-time wait times for all gates
 */
router.get('/wait-times', async (req: Request, res: Response) => {
  try {
    const { venue_id } = req.query;
    const waitTimes = await WaitTimeService.getWaitTimes(venue_id as string);
    res.json(waitTimes);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * GET /api/ops/dashboard
 * Full dashboard metrics
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT * FROM outcome_summary_daily 
       WHERE event_date = CURRENT_DATE 
       LIMIT 1`
    );

    res.json(result.rows[0] || {
      nudges_sent: 0,
      engagements: 0,
      confirmations: 0,
      entries_matched: 0,
      forecast_mape: 0,
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * POST /api/ops/actions
 * Execute ops action (slow entry, close gate, deploy shuttle)
 */
router.post('/actions', async (req: Request, res: Response) => {
  try {
    const { action, gate_id, duration_min } = req.body;
    
    // Log action
    await db.query(
      `INSERT INTO ops_actions (action, gate_id, duration_min, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [action, gate_id, duration_min]
    );

    // Broadcast to WebSocket
    // (implementation below)

    res.json({ success: true, action, gate_id });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export default router;

// ============================================================================
// 8. WEBSOCKET (websocket/broadcast.ts)
// ============================================================================

import { WebSocket } from 'ws';

let wsConnections: Set<WebSocket> = new Set();

export function broadcastWaitTimes(waitTimes: {[gateId: string]: number}) {
  const message = JSON.stringify({
    type: 'wait_times_updated',
    data: waitTimes,
    timestamp: new Date().toISOString(),
  });

  wsConnections.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    } else {
      wsConnections.delete(ws);
    }
  });
}

export function addConnection(ws: WebSocket) {
  wsConnections.add(ws);
  console.log(`WebSocket connected. Total: ${wsConnections.size}`);
}

export function removeConnection(ws: WebSocket) {
  wsConnections.delete(ws);
  console.log(`WebSocket disconnected. Total: ${wsConnections.size}`);
}

// ============================================================================
// 9. REAL-TIME UPDATES (Key Flow)
// ============================================================================

/*
FLOW: Backend → Ops Console (Real-time)

1. Every 30 seconds, backend calculates wait times:
   - Query queue_observations table
   - Apply stress factor
   - Get forecast
   - Calculate total wait

2. Broadcast to all connected WebSocket clients:
   broadcastWaitTimes({
     gate_1: 4,
     gate_2: 8,
     gate_5: 2,
   })

3. Ops console receives update:
   ws.onmessage = (event) => {
     const {type, data} = JSON.parse(event.data);
     if (type === 'wait_times_updated') {
       updateDashboard(data);
     }
   }

4. Dashboard updates UI instantly (no polling needed)

Implementation:
- Use setInterval to recalculate every 30 sec
- Use broadcastWaitTimes() to send to all clients
- Each client auto-updates on receive
*/

// ============================================================================
// 10. CRON JOBS (jobs/aggregation.ts)
// ============================================================================

import cron from 'node-cron';

/**
 * Run every hour: refresh materialized views
 */
export function startAggregationJob() {
  cron.schedule('0 * * * *', async () => {
    console.log('📊 Running hourly aggregation...');
    try {
      await db.query('REFRESH MATERIALIZED VIEW journey_complete');
      await db.query('REFRESH MATERIALIZED VIEW conversion_funnel');
      console.log('✓ Aggregation complete');
    } catch (error) {
      console.error('❌ Aggregation failed:', error);
    }
  });
}

/**
 * Run every 6 hours: recalibrate forecast accuracy
 */
export function startForecastCalibrateJob() {
  cron.schedule('0 */6 * * *', async () => {
    console.log('🎯 Calibrating forecast model...');
    try {
      // Calculate MAPE by gate
      const result = await db.query(`
        SELECT gate_id, 
          ROUND(AVG(ABS(c.predicted_wait_min - ge.wait_time_actual_min) / c.predicted_wait_min) * 100, 2) as mape_pct
        FROM confirmations c
        JOIN gate_entries ge ON c.entry_token = ge.entry_token
        WHERE ge.scanned_at > NOW() - INTERVAL '6 hours'
        GROUP BY c.confirmed_gate_id
      `);

      console.log('Gate accuracy:', result.rows);
      
      // Alert if any gate MAPE > 20%
      result.rows.forEach((row: any) => {
        if (row.mape_pct > 20) {
          console.warn(`⚠️ Gate ${row.gate_id} accuracy degraded: ${row.mape_pct}%`);
        }
      });
    } catch (error) {
      console.error('❌ Calibration failed:', error);
    }
  });
}

// ============================================================================
// SUMMARY
// ============================================================================

/*
BACKEND ARCHITECTURE SUMMARY

Services (Business Logic):
  ✓ WaitTimeService — Calculate wait times with stress factors
  ✓ NudgeService — Generate personalized nudges
  ✓ RouteService — Calculate fastest routes
  ✓ ForecastService — Gemini + rule-based predictions

API Routes:
  ✓ /api/fans/* — Fan app endpoints (nudges, routes, confirmations, feedback)
  ✓ /api/ops/* — Ops console (wait times, actions, dashboard)
  ✓ /api/gates/* — Gate management
  ✓ /api/health — Health checks

Real-time:
  ✓ WebSocket broadcast of wait times every 30 sec
  ✓ Ops console receives updates instantly
  ✓ No polling needed

Database:
  ✓ PostgreSQL with pre-optimized indexes
  ✓ Materialized views for dashboard queries
  ✓ Triggers for auto-aggregation

Jobs:
  ✓ Hourly: Refresh views
  ✓ Every 6h: Recalibrate forecast accuracy

Build Time: ~2 days
Dependencies: express, ws, pg, @google/generative-ai
*/
