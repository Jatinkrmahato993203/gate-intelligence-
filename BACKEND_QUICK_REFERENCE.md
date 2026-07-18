# Backend Quick Reference Card

## 🚀 Start Development (1 minute)

```bash
# 1. Install
npm install

# 2. Copy env template
cp .env.example .env

# 3. Start services
docker-compose up -d

# 4. Initialize database
npm run db:seed

# 5. Run dev server
npm run dev

# ✓ Server running on http://localhost:3000
```

---

## 📍 API Endpoints Cheat Sheet

### Health Check
```bash
GET http://localhost:3000/api/health
# → { status: "operational", uptime: 5.234 }
```

### Fan App Endpoints
```bash
# Get nudge recommendation
GET /api/fans/nudge?user_id=fan1&current_gate_id=gate_2&lat=40.7128&lng=-74.0060

# Calculate route
POST /api/fans/route
{ "from_gate_id": "gate_2", "to_gate_id": "gate_5" }

# Confirm nudge (get entry token)
POST /api/fans/confirm
{ "nudge_id": "nudge_xyz", "user_id": "fan1", "selected_gate_id": "gate_5" }

# Submit feedback
POST /api/fans/feedback
{ "entry_token": "entr_xyz", "actual_wait_min": 5, "predictions_accurate": "close" }
```

### Ops Console Endpoints
```bash
# Get all wait times
GET /api/ops/wait-times?venue_id=stadiumA

# Get dashboard metrics
GET /api/ops/dashboard

# Log ops action
POST /api/ops/action
{ "action": "close_gate", "gate_id": "gate_2", "duration_min": 5 }
```

### Gate Management
```bash
# List all gates
GET /api/gates

# Get gate details
GET /api/gates/gate_2
```

---

## 🔌 WebSocket Connection

```javascript
// Connect
const ws = new WebSocket('ws://localhost:3000');

// Subscribe to wait times
ws.addEventListener('open', () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'wait_times'
  }));
});

// Receive updates (every 30 seconds)
ws.addEventListener('message', (event) => {
  const { type, data } = JSON.parse(event.data);
  if (type === 'wait_times_updated') {
    console.log('Wait times:', data);
    // {
    //   "gate_1": { "estimated_wait_min": 4, "confidence": 0.92 },
    //   "gate_2": { "estimated_wait_min": 8, "confidence": 0.85 }
    // }
  }
});
```

---

## 🗄️ Database Quick Refs

### Key Tables

```sql
-- Nudge events
SELECT * FROM nudges WHERE user_id = 'fan1';

-- Gate entries (outcomes)
SELECT * FROM gate_entries WHERE gate_id = 'gate_2' ORDER BY scanned_at DESC;

-- Daily metrics
SELECT * FROM outcome_summary_daily WHERE event_date = CURRENT_DATE;

-- Forecast accuracy
SELECT * FROM forecast_accuracy_by_gate;
```

### View Materialized Views

```bash
# Refresh manually (normally done hourly)
psql -U postgres -d gate_intelligence -c "REFRESH MATERIALIZED VIEW CONCURRENTLY journey_complete"
```

---

## 🧪 Common Test Scenarios

### Scenario 1: Full Nudge Flow
```bash
# 1. Get nudge
curl "http://localhost:3000/api/fans/nudge?user_id=fan1&current_gate_id=gate_2&lat=40.7128&lng=-74.0060"
# → nudge_id: "nudge_abc"

# 2. Get route
curl -X POST http://localhost:3000/api/fans/route \
  -H "Content-Type: application/json" \
  -d '{"from_gate_id":"gate_2","to_gate_id":"gate_5"}'
# → walk_time_min: 2.3, queue_wait_min: 3

# 3. Confirm
curl -X POST http://localhost:3000/api/fans/confirm \
  -H "Content-Type: application/json" \
  -d '{"nudge_id":"nudge_abc","user_id":"fan1","selected_gate_id":"gate_5"}'
# → entry_token: "entr_xyz"

# 4. Simulate gate scan (mock)
# INSERT INTO gate_entries (gate_id, entry_token, wait_time_actual_min) 
# VALUES ('gate_5', 'entr_xyz', 5);

# 5. Submit feedback
curl -X POST http://localhost:3000/api/fans/feedback \
  -H "Content-Type: application/json" \
  -d '{"entry_token":"entr_xyz","actual_wait_min":5,"predictions_accurate":"accurate"}'
```

### Scenario 2: Monitor Dashboard Metrics
```bash
# 1. Check wait times
curl "http://localhost:3000/api/ops/wait-times?venue_id=stadiumA" | jq

# 2. Check outcomes
curl "http://localhost:3000/api/ops/dashboard" | jq

# Expected output:
# {
#   "nudges_sent": 342,
#   "nudge_engagements": 287,
#   "confirmations": 256,
#   "entries_matched": 234,
#   "forecast_mape_pct": 12.4,
#   "avg_time_saved_min": 4.2
# }
```

### Scenario 3: Ops Console Action
```bash
# Log gate closure
curl -X POST http://localhost:3000/api/ops/action \
  -H "Content-Type: application/json" \
  -d '{"action":"close_gate","gate_id":"gate_2","duration_min":5}'

# Ops console receives broadcast via WebSocket
```

---

## 🔧 Development Commands

```bash
# Development (hot reload)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Database migrations
npm run db:migrate

# Seed demo data
npm run db:seed

# Full reset (migrate + seed)
npm run db:reset

# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run type-check
```

---

## 🐛 Debugging Tips

### Check Server Logs
```bash
npm run dev

# Look for:
# ✓ Database connected
# ✓ Redis connected
# ✓ Gemini API initialized
# 🚀 Server running on port 3000
```

### Test Database Connection
```bash
psql -h localhost -U postgres -d gate_intelligence -c "SELECT NOW();"
```

### Test Redis Connection
```bash
redis-cli ping
# → PONG
```

### Test Gemini API
```javascript
// In browser console:
const response = await fetch('http://localhost:3000/api/health');
console.log(await response.json());
```

### Monitor WebSocket Connections
```javascript
// In browser console:
const ws = new WebSocket('ws://localhost:3000');
ws.addEventListener('open', () => console.log('Connected'));
ws.addEventListener('message', (e) => console.log(JSON.parse(e.data)));
```

### Check Wait Time Calculation
```bash
# Query recent estimates
psql -U postgres -d gate_intelligence -c "
  SELECT gate_id, estimated_wait_min, confidence, created_at 
  FROM wait_time_estimates 
  ORDER BY created_at DESC 
  LIMIT 5;
"
```

---

## 📊 Performance Checklist

- [ ] Wait time calculation < 100ms (per gate)
- [ ] API endpoints < 200ms (p95)
- [ ] WebSocket broadcasts every 30s
- [ ] Forecast accuracy (MAPE) < 15%
- [ ] Database queries < 50ms
- [ ] Cache hit rate > 80%
- [ ] Uptime > 99%

---

## 🚀 Deployment Quick Start

### Docker
```bash
# Build
docker build -t gate-engine:1.0.0 .

# Run
docker run -p 3000:3000 \
  -e DB_HOST=prod-db \
  -e GEMINI_API_KEY=xxx \
  gate-engine:1.0.0
```

### Environment (Production)
```bash
NODE_ENV=production
DB_SSL=true
LOG_LEVEL=error
REQUIRE_AUTH=true
```

---

## 📞 Troubleshooting

| Issue | Solution |
|-------|----------|
| Database error | Check `docker-compose ps`, verify `.env` |
| Gemini API error | Verify `GEMINI_API_KEY`, logs show fallback |
| WebSocket not connecting | Check browser console, verify port 3000 |
| High wait time error | Check sensor data, review forecast calibration |
| API timeout | Check database latency, increase connection pool |

---

## 📖 Reference Files

| File | Purpose |
|------|---------|
| `BACKEND_COMPLETE.ts` | All code (2500+ lines) |
| `BACKEND_IMPLEMENTATION_GUIDE.md` | Full documentation |
| `wait_time_calculation.ts` | Wait time math (from uploads) |
| `OUTCOME_TRACKING_SCHEMA.sql` | Database schema |
| `.env.example` | Environment template |
| `docker-compose.yml` | Local development setup |

---

**TL;DR:** Clone → `npm install` → `docker-compose up -d` → `npm run db:seed` → `npm run dev` → Go build! 🚀
