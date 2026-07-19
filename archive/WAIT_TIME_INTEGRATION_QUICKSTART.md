# Wait Time Calculation — Integration Quick Start

## What You Have
- **wait_time_calculation.ts** — Production-ready, zero-dependency TypeScript implementation
- **wait_time_calculation_spec.md** — Full documentation (formulas, edge cases, testing)

---

## Step 1: Wire Queue Observations

Your system needs to **ingest queue counts** every 10 seconds. Sources:

### Option A: Computer Vision (CCTV)
```typescript
// In your CCTV/AI pipeline
const observation: QueueObservation = {
  observed_queue_count: 187,      // AI detected 187 people
  observation_source: "cctv",
  confidence: 0.88,               // AI confidence score
  timestamp: new Date(),
};

// Store in PostgreSQL
await db.query(
  `INSERT INTO queue_observations (gate_id, observed_count, observation_source, confidence)
   VALUES ($1, $2, $3, $4)`,
  [gateId, observation.observed_queue_count, observation.observation_source, observation.confidence]
);

// Keep only last 60 observations (10 minutes) in memory
gate.queue_history = gate.queue_history.slice(0, 60).concat([observation]);
```

### Option B: Physical Sensors
```typescript
// From IR barriers or pressure mats
const observation: QueueObservation = {
  observed_queue_count: 185,      // Count from IR crossing events
  observation_source: "sensor",
  confidence: 0.95,               // Sensors are very reliable
  timestamp: new Date(),
};
```

### Option C: Manual Count (Fallback)
```typescript
// If sensors down, gate staff uses app to count
const observation: QueueObservation = {
  observed_queue_count: staffCountInput,
  observation_source: "manual",
  confidence: 0.65,               // Staff estimates are less precise
  timestamp: new Date(),
};
```

---

## Step 2: Set Up Gate Configuration

Define each gate's capacity parameters (do this **once per venue**):

```typescript
const gates: Gate[] = [
  {
    id: "gate_1",
    name: "North Entrance Gate 1",
    zone: "entry",
    location: { latitude: 40.7128, longitude: -74.006 },
    
    // CALIBRATE THESE NUMBERS
    throughput_per_min: 44,        // people/min (measure on a normal match day)
    max_queue_length: 800,         // when queue exceeds this, apply stress factor
    processing_time_sec: 10,       // seconds per person (ticket check + credential)
    crowd_slowdown_factor: 0.85,   // when >75% full, effective throughput *= 0.85
    
    gate_status: "open",
    queue_history: [],
    last_updated_at: new Date(),
  },
  // ... Gate 2, 3, etc.
];
```

**How to calibrate throughput:**
1. Pick a normal match day (no incidents)
2. Count gate entries every minute for 30 minutes during peak (2 hrs before kickoff)
3. Average the counts: `throughput = average`
4. Round down conservatively

---

## Step 3: Implement the Update Loop (Every 30 seconds)

```typescript
// In your API server (Express, Fastify, etc.)
setInterval(async () => {
  // For each gate, recalculate wait time
  for (const gate of gates) {
    // Get arrival forecast (Gemini or rule-based)
    const forecast = await getArrivalForecast(gate.id);
    
    // Calculate wait time
    const waitTime = calculateWaitTime(gate, forecast);
    
    // Store in database for historical analysis
    await db.query(
      `INSERT INTO wait_time_estimates (gate_id, estimated_wait_min, queue_count, confidence)
       VALUES ($1, $2, $3, $4)`,
      [gate.id, waitTime.estimated_wait_min, getReliableQueueCount(gate.queue_history), waitTime.confidence]
    );
    
    // Broadcast to all connected clients (WebSocket)
    io.emit('wait_times_updated', {
      gate_id: gate.id,
      estimated_wait_min: waitTime.estimated_wait_min,
      display_as: waitTime.display_as,
      confidence: waitTime.confidence,
      trend: waitTime.trend,
      updated_at: new Date().toISOString(),
    });
  }
}, 30000); // every 30 seconds
```

---

## Step 4: Arrival Forecast (Two Options)

### Option A: Gemini API (Recommended)
```typescript
async function getArrivalForecast(gateId: string): Promise<ArrivalForecast> {
  const gate = gates.find(g => g.id === gateId);
  
  const context = {
    current_queue_count: getReliableQueueCount(gate.queue_history),
    recent_arrivals: getRecentArrivalRate(gateId),
    time_to_kickoff: minutesToEvent(),
    weather: getCurrentWeather(),
  };
  
  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 200,
      messages: [{
        role: "user",
        content: `Stadium context: ${JSON.stringify(context)}
        
Predict arrivals in next 5 min. Respond ONLY as JSON:
{"predicted_arrivals": <number>, "confidence": <0.0-1.0>}`
      }]
    });
    
    const result = JSON.parse(message.content[0].text);
    return {
      time_window: "next_5_min",
      predicted_arrivals: result.predicted_arrivals,
      confidence: result.confidence,
      factors: { rule_based_forecast: 0 }
    };
  } catch (error) {
    console.warn('Gemini API failed, using fallback');
    return getArrivalForecast_RuleBased(context);
  }
}
```

### Option B: Rule-Based Fallback
```typescript
function getArrivalForecast_RuleBased(context: any): ArrivalForecast {
  return predictArrivalsRuleBased(
    new Date(),
    eventStartTime,
    historicalPatterns
  );
}
```

---

## Step 5: Fan-Facing Display

Send wait times to the fan app:

```typescript
// In your REST API endpoint
app.get('/api/wait-times', (req, res) => {
  const waitTimes = gates.map(gate => ({
    gate_id: gate.id,
    gate_name: gate.name,
    estimated_wait_min: calculateWaitTime(gate, forecast).estimated_wait_min,
    display_as: calculateWaitTime(gate, forecast).display_as,
    confidence: calculateWaitTime(gate, forecast).confidence,
  }));
  
  res.json(waitTimes);
});
```

**Fan app shows:**
```
┌─────────────────┐
│ Gate 2  4 min   │  ← Click to navigate to Gate 2
│ Gate 5  2 min   │
│ Gate 8 ~8 min   │  ← ~ indicates low confidence
└─────────────────┘
```

---

## Step 6: Ops Console Display

Show detailed breakdown + confidence:

```typescript
// In your ops dashboard
const waitTimeDetails = calculateWaitTime(gate, forecast);

console.log(`
Gate 2 Wait Time Breakdown
├─ Current Queue: 187 people
├─ Queue Wait: ${waitTimeDetails.breakdown.queue_wait.toFixed(1)} min
├─ Processing: ${waitTimeDetails.breakdown.processing_wait.toFixed(2)} min
├─ Stress Factor: ${waitTimeDetails.breakdown.stress_factor.toFixed(2)}x
├─ Forecast: +240 arrivals in 5 min
└─ Total Estimate: ${waitTimeDetails.estimated_wait_min} min
   Confidence: ${(waitTimeDetails.confidence * 100).toFixed(0)}%
   Trend: ${waitTimeDetails.trend}
`);
```

**Ops console shows:**
```
┌──────────────────────────┐
│ Gate 2                   │
├──────────────────────────┤
│ Queue: 187               │
│ Wait: 4.2 min            │
│ Confidence: 92% ✓        │
│ Trend: ↔ Stable          │
│                          │
│ [Slow Entry] [Close]     │
└──────────────────────────┘
```

---

## Step 7: Edge Cases & Error Handling

### Sensor Goes Down
```typescript
if (gate.queue_history[0].confidence < 0.3) {
  // Use forecast only
  const forecast = predictArrivalsRuleBased(...);
  const estimate = forecast.predicted_arrivals / gate.throughput_per_min;
  
  return {
    estimated_wait_min: estimate,
    display_as: `~${Math.round(estimate)} min`,  // ~ = low confidence
    confidence: 0.45,
  };
}
```

### Sudden Surge
```typescript
const surge = detectSurge(previousQueue, newQueue);
if (surge.isSurge && surge.severity === "high") {
  // Alert ops, bump up forecast priority
  io.emit('surge_detected', { gate_id, severity: surge.severity });
}
```

### Forecast Wrong
```typescript
// Log mismatches for continuous improvement
if (Math.abs(predictedArrivals - actualArrivals) > 50) {
  await db.query(
    `INSERT INTO forecast_accuracy (predicted, actual, error_percent)
     VALUES ($1, $2, $3)`,
    [predictedArrivals, actualArrivals, (actualArrivals - predictedArrivals) / predictedArrivals * 100]
  );
}
```

---

## Database Schema (Minimal)

```sql
CREATE TABLE queue_observations (
  id SERIAL PRIMARY KEY,
  gate_id VARCHAR(10),
  observed_count INT,
  observation_source VARCHAR(20),
  confidence FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE wait_time_estimates (
  id SERIAL PRIMARY KEY,
  gate_id VARCHAR(10),
  estimated_wait_min FLOAT,
  queue_count INT,
  confidence FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_queue_obs_gate_recent 
  ON queue_observations(gate_id, created_at DESC);

CREATE INDEX idx_wait_times_gate_recent 
  ON wait_time_estimates(gate_id, created_at DESC);
```

---

## Testing Checklist

- [ ] Queue observation ingestion works (every 10 sec)
- [ ] Wait time recalculates every 30 sec
- [ ] WebSocket broadcasts updated times to clients
- [ ] Stress factor applies when capacity > 75%
- [ ] Forecast integrates (Gemini or rule-based)
- [ ] Smoothing prevents wild swings
- [ ] Low confidence shows ~ prefix
- [ ] Sensor failure falls back gracefully
- [ ] Surge detection alerts ops
- [ ] Historical estimates stored for analysis

---

## Deployment Checklist

- [ ] Calibrate `throughput_per_min` per gate (stadium ops team)
- [ ] Connect CCTV / sensor pipeline to queue observation ingestion
- [ ] Set up WebSocket server for real-time updates
- [ ] Wire up Gemini API or use rule-based forecast
- [ ] Test with replay of KC/Miami incident
- [ ] Measure forecast accuracy vs. actual arrivals
- [ ] Train gate staff on new wait time app
- [ ] Monitor forecast MAPE (mean absolute percentage error)
- [ ] Plan continuous improvement loop

---

## Performance Targets

| Metric | Target | Your Result |
|--------|--------|-------------|
| Queue observation latency | <100ms | __ |
| Wait time recalc cycle | <20ms | __ |
| WebSocket push latency | <50ms | __ |
| Forecast accuracy (MAPE) | <15% | __ |
| System uptime | >99% | __ |
| Fan app wait time display | <2 sec from server | __ |

---

## Common Mistakes to Avoid

❌ **Don't** use raw queue count without smoothing → fans see wild swings  
✅ **Do** apply weighted median + outlier rejection  

❌ **Don't** assume constant arrival rate → peaks before kickoff  
✅ **Do** use time-to-event multiplier (1.0 → 2.2 as kickoff approaches)  

❌ **Don't** show false precision ("4.23 min") → implies accuracy you don't have  
✅ **Do** round to nearest 0.5 min, use ~ for low confidence  

❌ **Don't** ignore stress factor → crowds panic, move slower  
✅ **Do** apply 0.85x slowdown when >75% capacity  

❌ **Don't** trust a single sensor reading → outliers & noise  
✅ **Do** weight by confidence, reject outliers >2σ from median  

---

## Questions?

Refer to `wait_time_calculation_spec.md` for deep dives on:
- Formulas & math
- Edge case handling
- Unit tests
- Historical accuracy analysis
