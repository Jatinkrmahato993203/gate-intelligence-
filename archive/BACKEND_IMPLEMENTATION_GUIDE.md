# Gate Intelligence Engine Backend — Complete Implementation Guide

**Status:** Production-ready  
**Build Time:** 2 days  
**Total LOC:** ~2,500 (core services + API routes)  
**Stack:** Node.js 18+ | Express.js | TypeScript | PostgreSQL | Redis | WebSocket

---

## 📁 Project Structure

```
gate-intelligence-backend/
├── src/
│   ├── index.ts                      # Main server entry point
│   ├── config/
│   │   ├── database.ts               # PostgreSQL connection pool
│   │   ├── redis.ts                  # Redis client
│   │   ├── gemini.ts                 # Gemini API initialization
│   │   └── env.ts                    # Environment validation
│   ├── middleware/
│   │   ├── error.ts                  # Global error handler
│   │   ├── logging.ts                # Pino logger + request logging
│   │   ├── auth.ts                   # API key / JWT validation
│   │   └── rate-limit.ts             # Express rate limiter
│   ├── services/
│   │   ├── wait-time.service.ts      # Wait time calculation logic
│   │   ├── nudge.service.ts          # Nudge generation + sending
│   │   ├── route.service.ts          # Route calculation (Haversine)
│   │   └── outcome.service.ts        # Outcome tracking + aggregation
│   ├── routes/
│   │   ├── fans.ts                   # /api/fans/* — Fan app endpoints
│   │   ├── ops.ts                    # /api/ops/* — Ops console endpoints
│   │   ├── gates.ts                  # /api/gates/* — Gate management
│   │   └── health.ts                 # /api/health — Health checks
│   ├── websocket/
│   │   ├── handlers.ts               # WebSocket event handlers
│   │   └── broadcast.ts              # Publish wait times to clients
│   ├── jobs/
│   │   ├── index.ts                  # Scheduled job orchestration
│   │   ├── aggregation.ts            # Hourly: refresh materialized views
│   │   ├── calibration.ts            # 6-hourly: recalibrate forecast MAPE
│   │   └── broadcast.ts              # 30sec: broadcast wait times
│   ├── lib/
│   │   ├── wait-time-calculation.ts  # Core math (from WAIT_TIME_CALCULATION.ts)
│   │   └── geo.ts                    # Geofencing utilities
│   └── types/
│       └── index.ts                  # Shared TypeScript interfaces
├── migrations/
│   └── 001_initial_schema.sql        # PostgreSQL schema (from OUTCOME_TRACKING_SCHEMA.sql)
├── scripts/
│   ├── seed.ts                       # Seed demo data (gates, scenarios)
│   └── migrate.js                    # Run database migrations
├── tests/
│   ├── wait-time.test.ts
│   ├── nudge.test.ts
│   └── route.test.ts
├── docker-compose.yml                # PostgreSQL + Redis + dev server
├── Dockerfile                        # Production image
├── tsconfig.json                     # TypeScript configuration
├── .env.example                      # Environment template
├── package.json                      # Dependencies + scripts
└── README.md                         # Quick start guide
```

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Install & Setup
```bash
# Clone repository
git clone <repo> && cd gate-intelligence-backend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your settings
# - DB_PASSWORD=your_postgres_password
# - GEMINI_API_KEY=your_api_key
# - ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

### Step 2: Start Infrastructure (Docker)
```bash
# Start PostgreSQL + Redis in background
docker-compose up -d

# Verify containers running
docker-compose ps
# postgres — port 5432
# redis   — port 6379
```

### Step 3: Initialize Database
```bash
# Run migrations
npm run db:migrate

# Seed demo data (8 gates, historical patterns, incident replay)
npm run db:seed
```

### Step 4: Start Development Server
```bash
npm run dev

# Expected output:
# 🚀 Server running on port 3000
#    Health:   http://localhost:3000/api/health
#    Fans:     http://localhost:3000/api/fans
#    Ops:      http://localhost:3000/api/ops
#    WebSocket: ws://localhost:3000
```

### Step 5: Test Health Endpoint
```bash
curl http://localhost:3000/api/health

# Response:
# {
#   "service": "Gate Intelligence Engine",
#   "status": "operational",
#   "uptime": 5.234
# }
```

---

## 📋 Environment Variables (.env)

```bash
# Server
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Database (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gate_intelligence
DB_USER=postgres
DB_PASSWORD=secure_password_here
DB_SSL=false

# Redis (Caching + WebSocket)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Gemini API (Wait Time Forecasting)
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-1.5-flash

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Authentication
REQUIRE_AUTH=false
JWT_SECRET=your_jwt_secret_here

# Venue Config
DEFAULT_VENUE_ID=stadiumA
```

---

## 🔌 Core Services Overview

### 1. WaitTimeService
Calculates gate wait times with stress factors and forecasts.

**Key Methods:**
- `getAllWaitTimes(venueId)` — All gates in venue
- `calculateWaitForGate(gateId)` — Single gate (0.1s, cached)
- `getArrivalForecast(gateId)` — Gemini or rule-based

**Flow:**
```
queue_observations (CCTV/sensor) 
  → getReliableQueueCount (weighted median + outlier rejection)
  → apply stress factor (if >75% capacity)
  → add forecast (Gemini or rule-based)
  → return wait_time (rounded to 0.5 min)
```

### 2. NudgeService
Generates personalized nudge recommendations.

**Key Methods:**
- `generateNudge(userId, currentGateId, lat, lng)` — Create nudge

**Flow:**
```
user location (lat/lng)
  → find 5 closest gates (<500m)
  → get wait times (all gates)
  → compare: current vs recommended
  → if time_saved > 0 → create nudge
  → store in database + broadcast
```

### 3. RouteService
Calculates routes between gates with walk time + queue estimates.

**Key Methods:**
- `calculateRoute(from_gate_id, to_gate_id)` — Haversine distance + queue wait

**Returns:**
```json
{
  "source_gate_id": "gate_2",
  "target_gate_id": "gate_5",
  "walk_distance_m": 187,
  "walk_time_min": 2.3,
  "queue_wait_min": 3,
  "total_time_min": 5.3
}
```

### 4. OutcomeService
Aggregates outcome metrics for dashboard.

**Key Methods:**
- `getDailyMetrics(eventDate)` — Success rate, MAPE, time saved
- `getConversionFunnel(eventId)` — Nudge → route → confirm → feedback

**Metrics:**
```
- nudges_sent (total)
- nudge_engagements (% opened)
- confirmations (% accepted)
- entries_matched (% actually went there)
- forecast_mape_pct (prediction accuracy)
- avg_time_saved_min (actual time benefit)
```

---

## 🌐 API Endpoints

### Fan App (`/api/fans`)

#### GET `/api/fans/nudge`
Get nudge recommendation.

**Query Params:**
- `user_id` (string) — Anonymized user
- `current_gate_id` (string) — User's current gate
- `lat` (number) — User latitude
- `lng` (number) — User longitude

**Response:**
```json
{
  "nudge_id": "nudge_xyz",
  "recommended_gate_id": "gate_5",
  "time_saved_min": 7,
  "forecast_confidence": 0.89
}
```

#### POST `/api/fans/route`
Calculate route to recommended gate.

**Body:**
```json
{
  "from_gate_id": "gate_2",
  "to_gate_id": "gate_5"
}
```

**Response:**
```json
{
  "walk_distance_m": 187,
  "walk_time_min": 2.3,
  "queue_wait_min": 3,
  "total_time_min": 5.3
}
```

#### POST `/api/fans/confirm`
Confirm nudge and issue entry token.

**Body:**
```json
{
  "nudge_id": "nudge_xyz",
  "user_id": "fan_abc",
  "selected_gate_id": "gate_5"
}
```

**Response:**
```json
{
  "entry_token": "entr_abc123xyz",
  "expires_in_minutes": 20
}
```

#### POST `/api/fans/feedback`
Submit post-entry feedback for calibration.

**Body:**
```json
{
  "entry_token": "entr_abc123xyz",
  "actual_wait_min": 5,
  "predictions_accurate": "close",
  "experience": "good"
}
```

### Ops Console (`/api/ops`)

#### GET `/api/ops/wait-times`
Get all gate wait times.

**Response:**
```json
{
  "gate_1": { "estimated_wait_min": 4, "confidence": 0.92, "trend": "stable" },
  "gate_2": { "estimated_wait_min": 8, "confidence": 0.85, "trend": "increasing" },
  "gate_5": { "estimated_wait_min": 2, "confidence": 0.88, "trend": "decreasing" }
}
```

#### GET `/api/ops/dashboard`
Get outcome metrics.

**Response:**
```json
{
  "nudges_sent": 342,
  "nudge_engagements": 287,
  "confirmations": 256,
  "entries_matched": 234,
  "forecast_mape_pct": 12.4,
  "avg_time_saved_min": 4.2
}
```

#### POST `/api/ops/action`
Log an ops action (close gate, deploy staff, etc.).

**Body:**
```json
{
  "action": "close_gate",
  "gate_id": "gate_2",
  "duration_min": 5
}
```

### Gate Management (`/api/gates`)

#### GET `/api/gates`
Get all gates.

#### GET `/api/gates/:id`
Get single gate details.

---

## 🔌 WebSocket Events

### Connection
```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.addEventListener('open', () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'wait_times'
  }));
});
```

### Wait Time Updates (Every 30s)
```json
{
  "type": "wait_times_updated",
  "data": {
    "gate_1": { "estimated_wait_min": 4, "confidence": 0.92 },
    "gate_2": { "estimated_wait_min": 8, "confidence": 0.85 }
  },
  "timestamp": "2026-07-18T14:35:22Z"
}
```

### Ops Events
```json
{
  "type": "ops_action",
  "data": {
    "action": "close_gate",
    "gate_id": "gate_2",
    "duration_min": 5
  },
  "timestamp": "2026-07-18T14:35:22Z"
}
```

---

## 🗄️ Database Tables (Key Fields)

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `gates` | Gate configuration | gate_id, venue_id, throughput_per_min, max_queue_length |
| `queue_observations` | Sensor/CCTV readings | gate_id, observed_queue_count, confidence, created_at |
| `wait_time_estimates` | Calculated wait times | gate_id, estimated_wait_min, confidence, created_at |
| `nudges` | Nudge events | nudge_id, user_id, recommended_gate_id, time_saved_min |
| `confirmations` | User confirmations | confirmation_id, entry_token, nudge_id, predicted_wait_min |
| `gate_entries` | Gate scan records | scan_id, gate_id, entry_token, wait_time_actual_min, scanned_at |
| `feedback` | User feedback | feedback_id, entry_token, actual_wait_min, predictions_accurate |

---

## 📊 Real-Time Data Flow

```
Sensor/CCTV Pipeline
    ↓
queue_observations table (every 10s)
    ↓
WaitTimeService.calculateWaitForGate() (every 30s)
    ↓
broadcastWaitTimes() via WebSocket
    ↓
Ops console + Fan app (live updates)
    ↓
User confirms nudge → entry_token issued
    ↓
Fan scans at gate → gate_entries table
    ↓
Entry token matched → outcome recorded
    ↓
User submits feedback → calibration loop
    ↓
Forecast accuracy (MAPE) tracked & improved
```

---

## 🧪 Testing Checklist

### Unit Tests
```bash
npm test

# Tests for:
# ✓ wait-time calculation (stress factor, smoothing)
# ✓ nudge generation (closest gate logic)
# ✓ route calculation (Haversine distance)
# ✓ outcome aggregation (funnel, MAPE)
```

### Integration Tests
```bash
# 1. Test all API endpoints
npm run test:api

# 2. Test WebSocket real-time updates
npm run test:websocket

# 3. Test database transactions
npm run test:db
```

### Manual Testing
```bash
# 1. Health check
curl http://localhost:3000/api/health

# 2. Get wait times
curl http://localhost:3000/api/ops/wait-times?venue_id=stadiumA

# 3. Generate nudge
curl "http://localhost:3000/api/fans/nudge?user_id=fan1&current_gate_id=gate_2&lat=40.7128&lng=-74.0060"

# 4. WebSocket (in browser console)
const ws = new WebSocket('ws://localhost:3000');
ws.addEventListener('message', e => console.log(JSON.parse(e.data)));
```

---

## 🚢 Deployment

### Docker Build
```bash
# Build production image
docker build -t gate-engine:1.0.0 .

# Push to registry
docker push your-registry/gate-engine:1.0.0
```

### Environment Variables (Production)
```bash
NODE_ENV=production
DB_HOST=prod-db.internal
DB_SSL=true
GEMINI_API_KEY=prod-key
LOG_LEVEL=error
REQUIRE_AUTH=true
```

### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gate-engine-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: gate-engine
  template:
    metadata:
      labels:
        app: gate-engine
    spec:
      containers:
      - name: backend
        image: your-registry/gate-engine:1.0.0
        ports:
        - containerPort: 3000
        env:
        - name: DB_HOST
          valueFrom:
            configMapKeyRef:
              name: gate-engine-config
              key: db_host
        - name: GEMINI_API_KEY
          valueFrom:
            secretKeyRef:
              name: gate-engine-secrets
              key: gemini_api_key
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
```

---

## 📈 Monitoring & Observability

### Logs (Pino)
```bash
# View logs
npm run dev 2>&1 | grep -i "error\|warn"

# Log levels: trace, debug, info, warn, error, fatal
# Set via LOG_LEVEL=debug
```

### Metrics
```bash
# Prometheus metrics at /metrics
GET http://localhost:3000/metrics

# Key metrics:
# - nudges_sent_total
# - wait_time_accuracy_mape
# - forecast_cache_hits
# - api_request_latency_ms
```

### Alerts
```bash
# Set up alerts for:
# - Forecast MAPE > 20%
# - API latency > 500ms
# - WebSocket disconnection rate > 5%
# - Database query time > 1s
# - Gemini API failures
```

---

## 🎯 Performance Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Wait time calculation | <100ms | Benchmark `calculateWaitForGate()` |
| API endpoint latency | <200ms | Monitor response times |
| WebSocket push latency | <50ms | Measure message send time |
| Forecast accuracy (MAPE) | <15% | Track daily via calibration job |
| Database query time | <50ms | Monitor slow query logs |
| Cache hit rate | >80% | Redis stats |
| System uptime | >99% | Monitor server health |

---

## 🛠️ Troubleshooting

### "Database connection failed"
```bash
# Check PostgreSQL is running
docker-compose ps

# Verify credentials in .env
# Test connection manually
psql -h localhost -U postgres -d gate_intelligence
```

### "Gemini API error"
```bash
# Verify API key in .env
echo $GEMINI_API_KEY

# Fallback to rule-based (automatic if API fails)
# Check logs for fallback activation
```

### "WebSocket disconnections"
```bash
# Check browser console for errors
# Increase max payload in server (if needed)
# Monitor connection count: wss.clients.size
```

### "High forecast error (MAPE > 20%)"
```bash
# Check if sensor data is reliable
# Review feedback loop calibration
# Consider adjusting stress factors
```

---

## 📅 Development Timeline (2 Days)

**Day 1:**
- [ ] Set up project structure + dependencies
- [ ] Implement database config + migrations
- [ ] Implement WaitTimeService + RouteService
- [ ] Wire up all API routes
- [ ] Test all endpoints

**Day 2:**
- [ ] Implement WebSocket broadcasting
- [ ] Set up scheduled jobs (aggregation, calibration)
- [ ] Add comprehensive error handling + logging
- [ ] Integration testing
- [ ] Docker build + deployment testing

---

## 🎉 You're Ready!

Run these commands and you'll have a working backend in 5 minutes:

```bash
npm install && npm run db:reset && npm run dev
```

Then test the full flow:
1. Get wait times: `curl http://localhost:3000/api/ops/wait-times?venue_id=stadiumA`
2. Generate nudge: `curl "http://localhost:3000/api/fans/nudge?user_id=fan1&current_gate_id=gate_2&lat=40.7128&lng=-74.0060"`
3. Check WebSocket: `const ws = new WebSocket('ws://localhost:3000'); ws.onmessage = e => console.log(e.data);`

---

**Reference Files:**
- Complete implementation: `BACKEND_COMPLETE.ts`
- Wait time math: `wait_time_calculation_spec.md` + `wait_time_calculation.ts`
- Database schema: `OUTCOME_TRACKING_SCHEMA.sql`
- Environment template: `.env.example`

Go build! 🚀
