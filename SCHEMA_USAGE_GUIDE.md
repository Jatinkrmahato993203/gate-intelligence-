# Outcome Tracking Schema — Usage Guide

## Overview

The schema captures **every step** of the fan journey, with aggregation tables for dashboard queries and triggers to maintain real-time metrics.

```
nudges
  ↓ (1 nudge → many interactions)
nudge_interactions
  
nudges
  ↓ (1 nudge → 1 route decision)
route_decisions
  ↓ (1 route → 1 confirmation)
confirmations
  ↓ (1 confirmation → matched via entry_token)
gate_entries (proof)
  
confirmations
  ↓ (1 confirmation → optional feedback)
feedback (calibration)
```

---

## Table Relationships

### Core Event Chain

```
nudges (PK: id, UK: nudge_id)
  ├─ FK nudge_interactions.nudge_id
  └─ FK route_decisions.nudge_id
      └─ FK confirmations.route_decision_id
          └─ FK confirmations.nudge_id
              └─ FK gate_entries.entry_token = confirmations.entry_token
              └─ FK feedback.confirmation_id
```

### Key Foreign Keys

| Source | Target | Purpose |
|--------|--------|---------|
| `route_decisions.nudge_id` | `nudges.id` | Trace back from decision to nudge |
| `confirmations.route_decision_id` | `route_decisions.id` | Trace route choice to confirmation |
| `confirmations.entry_token` | `gate_entries.entry_token` | **Outcome correlation** |
| `feedback.confirmation_id` | `confirmations.id` | Link feedback to journey |

---

## How to Query: Common Patterns

### 1. Conversion Funnel (Today's Event)

```sql
-- Show: nudges → routes → confirmations → gate entries
SELECT 
  COUNT(DISTINCT n.id) as nudges_sent,
  COUNT(DISTINCT rd.id) as routes_selected,
  COUNT(DISTINCT c.id) as confirmations_made,
  COUNT(DISTINCT ge.scan_id) as gate_entries,
  
  ROUND(100.0 * COUNT(DISTINCT rd.id) / COUNT(DISTINCT n.id), 1) as route_pct,
  ROUND(100.0 * COUNT(DISTINCT c.id) / COUNT(DISTINCT n.id), 1) as confirm_pct,
  ROUND(100.0 * COUNT(DISTINCT ge.scan_id) / COUNT(DISTINCT c.id), 1) as entry_pct

FROM nudges n
LEFT JOIN route_decisions rd ON n.id = rd.nudge_id
LEFT JOIN confirmations c ON rd.id = c.route_decision_id
LEFT JOIN gate_entries ge ON c.entry_token = ge.entry_token
WHERE n.event_id = (SELECT id FROM events ORDER BY scheduled_start DESC LIMIT 1)
  AND n.created_at::DATE = CURRENT_DATE;
```

**Result:**
```
nudges_sent | routes_selected | confirmations_made | gate_entries | route_pct | confirm_pct | entry_pct
    2847    |      1002       |       702          |      627     |   35.2    |   24.6      |   89.3
```

---

### 2. Forecast Accuracy (MAPE by Gate)

```sql
-- Show: How accurate was our wait time prediction?
SELECT 
  c.confirmed_gate_id as gate,
  COUNT(*) as predictions,
  ROUND(AVG(ABS(c.predicted_wait_min - ge.wait_time_actual_min)), 2) as mae_min,
  ROUND(AVG(ABS(c.predicted_wait_min - ge.wait_time_actual_min) / NULLIF(c.predicted_wait_min, 0)) * 100, 2) as mape_pct,
  ROUND(100.0 * COUNT(CASE WHEN ABS(c.predicted_wait_min - ge.wait_time_actual_min) <= 2 THEN 1 END) / COUNT(*), 1) as within_2min_pct

FROM confirmations c
JOIN gate_entries ge ON c.entry_token = ge.entry_token
WHERE ge.scanned_at::DATE >= CURRENT_DATE - 7
GROUP BY c.confirmed_gate_id
ORDER BY mape_pct ASC;
```

**Result:**
```
gate   | predictions | mae_min | mape_pct | within_2min_pct
gate_5 |     145     |  0.95   |  12.1%   |     78.6%
gate_2 |     152     |  1.12   |  13.8%   |     75.3%
gate_1 |     138     |  1.45   |  15.7%   |     71.0%
```

---

### 3. Impact: Time Saved per Nudge

```sql
-- Show: Average time saved when fans followed our nudge
SELECT 
  ROUND(AVG(n.time_saved_min), 2) as avg_time_saved_min,
  COUNT(*) as nudges_followed,
  ROUND(SUM(n.time_saved_min), 0) as total_time_saved_min,
  
  -- Only count if fan actually went to recommended gate
  COUNT(CASE WHEN ge.gate_id = n.recommended_gate_id THEN 1 END) as went_to_recommended,
  ROUND(100.0 * COUNT(CASE WHEN ge.gate_id = n.recommended_gate_id THEN 1 END) / COUNT(*), 1) as followed_nudge_pct

FROM nudges n
JOIN route_decisions rd ON n.id = rd.nudge_id
JOIN confirmations c ON rd.id = c.route_decision_id
JOIN gate_entries ge ON c.entry_token = ge.entry_token
WHERE ge.scanned_at::DATE = CURRENT_DATE;
```

**Result:**
```
avg_time_saved_min | nudges_followed | total_time_saved_min | went_to_recommended | followed_nudge_pct
      4.2          |       627       |       2,635          |        559          |       89.2%
```

---

### 4. Feedback Sentiment & Calibration

```sql
-- Show: Fan feedback on prediction accuracy
SELECT 
  predictions_accurate,
  COUNT(*) as responses,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as pct

FROM feedback
WHERE submitted_at::DATE >= CURRENT_DATE - 7
GROUP BY predictions_accurate
ORDER BY COUNT(*) DESC;
```

**Result:**
```
predictions_accurate | responses | pct
     accurate         |    78     | 52.0%
     off_low          |    45     | 30.0%
     off_high         |    21     | 14.0%
     unsure           |     6     |  4.0%
```

---

### 5. Direction Followed Rate (Nudge Effectiveness)

```sql
-- Show: Did fans actually follow the nudge recommendation?
SELECT 
  direction_followed,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as pct

FROM feedback
WHERE submitted_at::DATE >= CURRENT_DATE - 7
GROUP BY direction_followed;
```

**Result:**
```
direction_followed | count | pct
       yes         |  118  | 78.7%
      partial      |  22   | 14.7%
       no          |  10   |  6.7%
```

This means **78.7% of fans actually went to the recommended gate.**

---

### 6. Real-Time Dashboard Metrics

```sql
-- Single query for ops dashboard
WITH funnel AS (
  SELECT 
    COUNT(DISTINCT n.id) as nudges,
    COUNT(DISTINCT rd.id) as routes,
    COUNT(DISTINCT c.id) as confirms,
    COUNT(DISTINCT ge.scan_id) as entries
  FROM nudges n
  LEFT JOIN route_decisions rd ON n.id = rd.nudge_id
  LEFT JOIN confirmations c ON rd.id = c.route_decision_id
  LEFT JOIN gate_entries ge ON c.entry_token = ge.entry_token
  WHERE n.event_id = (SELECT id FROM events WHERE scheduled_start > NOW() ORDER BY scheduled_start LIMIT 1)
),

accuracy AS (
  SELECT ROUND(AVG(ABS(c.predicted_wait_min - ge.wait_time_actual_min) / c.predicted_wait_min) * 100, 2) as mape
  FROM confirmations c
  JOIN gate_entries ge ON c.entry_token = ge.entry_token
  WHERE c.created_at > NOW() - INTERVAL '1 hour'
),

feedback_sent AS (
  SELECT 
    COUNT(*) as feedback_count,
    ROUND(100.0 * COUNT(CASE WHEN direction_followed = 'yes' THEN 1 END) / COUNT(*), 1) as followed_pct
  FROM feedback
  WHERE submitted_at > NOW() - INTERVAL '1 hour'
)

SELECT 
  f.nudges, f.routes, f.confirms, f.entries,
  ROUND(100.0 * f.routes / NULLIF(f.nudges, 0), 1) as route_pct,
  ROUND(100.0 * f.confirms / NULLIF(f.nudges, 0), 1) as confirm_pct,
  ROUND(100.0 * f.entries / NULLIF(f.confirms, 0), 1) as entry_pct,
  a.mape,
  fs.feedback_count,
  fs.followed_pct
FROM funnel f, accuracy a, feedback_sent fs;
```

---

## Integration Points

### 1. Nudge Generation → `nudges` Table

When your recommendation engine creates a nudge:

```javascript
// Backend pseudocode
const nudge = {
  nudge_id: generateId('nudge'),
  user_id: hashUserId(fan.id),
  recommended_gate_id: recommendation.gate,
  current_gate_id: fan.current_gate,
  wait_time_current_min: waitTimes[fan.current_gate],
  wait_time_recommended_min: waitTimes[recommendation.gate],
  time_saved_min: waitTimes[fan.current_gate] - waitTimes[recommendation.gate],
  forecast_confidence: recommendation.confidence,
  event_id: currentEvent.id,
};

await db.query(
  `INSERT INTO nudges (nudge_id, user_id, recommended_gate_id, current_gate_id, 
     wait_time_current_min, wait_time_recommended_min, time_saved_min, 
     forecast_confidence, event_id)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
  [nudge.nudge_id, nudge.user_id, nudge.recommended_gate_id, nudge.current_gate_id,
   nudge.wait_time_current_min, nudge.wait_time_recommended_min, nudge.time_saved_min,
   nudge.forecast_confidence, nudge.event_id]
);

// Log interaction
await db.query(
  `INSERT INTO nudge_interactions (nudge_id, action, action_at) 
   SELECT id, $1, $2 FROM nudges WHERE nudge_id = $3`,
  ['received', new Date(), nudge.nudge_id]
);
```

### 2. Route Decision → `route_decisions` Table

When fan taps a route:

```javascript
const decision = {
  decision_id: generateId('decision'),
  nudge_id: getNudgeId(fan),
  user_id: hashUserId(fan.id),
  selected_gate_id: route.gate,
  reason: route.is_recommended ? 'recommended' : 'personal_preference',
  available_gates: JSON.stringify(allRoutes),
  time_to_decide_sec: screenTimeSeconds,
  device_id: fan.device_id,
};

await db.query(
  `INSERT INTO route_decisions 
   (decision_id, nudge_id, user_id, selected_gate_id, reason, available_gates, time_to_decide_sec, device_id)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
  [decision.decision_id, decision.nudge_id, decision.user_id, decision.selected_gate_id,
   decision.reason, decision.available_gates, decision.time_to_decide_sec, decision.device_id]
);
```

### 3. Confirmation → `confirmations` Table (KEY STEP)

When fan commits, **generate entry_token**:

```javascript
const entryToken = generateToken('entr');  // "entr_abc123xyz"

const confirmation = {
  confirmation_id: generateId('conf'),
  entry_token: entryToken,
  route_decision_id: getDecisionId(fan),
  nudge_id: getNudgeId(fan),
  user_id: hashUserId(fan.id),
  confirmed_gate_id: route.gate,
  predicted_wait_min: route.total_time,
  device_id: fan.device_id,
};

await db.query(
  `INSERT INTO confirmations 
   (confirmation_id, entry_token, route_decision_id, nudge_id, user_id, 
    confirmed_gate_id, predicted_wait_min, device_id, expires_at)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() + INTERVAL '1 hour')`,
  [confirmation.confirmation_id, confirmation.entry_token, confirmation.route_decision_id,
   confirmation.nudge_id, confirmation.user_id, confirmation.confirmed_gate_id,
   confirmation.predicted_wait_min, confirmation.device_id]
);

// Return token to app (stored in localStorage)
return { entry_token: entryToken, expires_at: now + 3600000 };
```

### 4. Gate Scan → `gate_entries` Table (OUTCOME)

When fan scans ticket at gate:

```javascript
// Gate scanner code
const scanData = readTurnstile();  // {ticket_id, timestamp}
const appEntryToken = getFromTicketMetadata(scanData);  // app can embed token

await db.query(
  `INSERT INTO gate_entries 
   (scan_id, gate_id, venue_id, ticket_id, entry_token, scanned_at, wait_time_actual_min, scanner_type)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
  [generateId('scan'), gateId, venueId, scanData.ticket_id, appEntryToken, 
   scanData.timestamp, measuredWaitTime, 'turnstile']
);

// This INSERT triggers the aggregation function automatically!
```

### 5. Feedback → `feedback` Table (LEARNING)

When fan submits feedback:

```javascript
const feedback = {
  feedback_id: generateId('fbk'),
  confirmation_id: getConfirmationId(fan),
  entry_token: entryToken,  // optional, for matching
  user_id: hashUserId(fan.id),
  predictions_accurate: feedbackForm.predictions,
  experience: feedbackForm.experience,
  direction_followed: feedbackForm.direction,
  additional_notes: feedbackForm.notes,
};

await db.query(
  `INSERT INTO feedback 
   (feedback_id, confirmation_id, entry_token, user_id, predictions_accurate, 
    experience, direction_followed, additional_notes)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
  [feedback.feedback_id, feedback.confirmation_id, feedback.entry_token,
   feedback.user_id, feedback.predictions_accurate, feedback.experience,
   feedback.direction_followed, feedback.additional_notes]
);
```

---

## Dashboard Query Patterns

### Pattern 1: Real-Time Metrics (Refresh every 30 sec)

```sql
-- Current event summary
SELECT 
  (SELECT COUNT(*) FROM nudges WHERE event_id = $1 AND created_at > NOW() - INTERVAL '1 hour') as nudges_last_hour,
  (SELECT COUNT(*) FROM confirmations WHERE created_at > NOW() - INTERVAL '1 hour') as confirmations_last_hour,
  (SELECT COUNT(*) FROM gate_entries WHERE scanned_at > NOW() - INTERVAL '1 hour') as entries_last_hour,
  (SELECT ROUND(AVG(ABS(predicted_wait_min - actual_wait_min)), 2) 
   FROM (SELECT c.predicted_wait_min, ge.wait_time_actual_min FROM confirmations c 
         JOIN gate_entries ge ON c.entry_token = ge.entry_token 
         WHERE ge.scanned_at > NOW() - INTERVAL '1 hour') t) as accuracy_mae;
```

### Pattern 2: Gate Performance Comparison

```sql
-- Compare gates: which nudges worked best?
SELECT 
  rd.selected_gate_id,
  COUNT(*) as nudges_sent_to_gate,
  COUNT(CASE WHEN ge.scan_id IS NOT NULL THEN 1 END) as actually_entered,
  ROUND(100.0 * COUNT(CASE WHEN ge.scan_id IS NOT NULL THEN 1 END) / COUNT(*), 1) as entry_rate,
  ROUND(AVG(ge.wait_time_actual_min), 1) as avg_actual_wait
FROM route_decisions rd
JOIN confirmations c ON c.route_decision_id = rd.id
LEFT JOIN gate_entries ge ON c.entry_token = ge.entry_token
WHERE ge.scanned_at::DATE = CURRENT_DATE
GROUP BY rd.selected_gate_id
ORDER BY entry_rate DESC;
```

### Pattern 3: Fan Engagement by Gate

```sql
-- Which gates get the most nudges? Most engagement?
SELECT 
  n.recommended_gate_id,
  COUNT(*) as nudges_sent,
  COUNT(CASE WHEN ni.action = 'tapped_route' THEN 1 END) as engaged,
  ROUND(100.0 * COUNT(CASE WHEN ni.action = 'tapped_route' THEN 1 END) / COUNT(*), 1) as engagement_pct,
  COUNT(DISTINCT n.user_id) as unique_fans
FROM nudges n
LEFT JOIN nudge_interactions ni ON n.id = ni.nudge_id AND ni.action = 'tapped_route'
WHERE n.created_at::DATE = CURRENT_DATE
GROUP BY n.recommended_gate_id
ORDER BY nudges_sent DESC;
```

---

## Performance Tuning

### Index Strategy

All critical queries are indexed:
- `nudges.event_id` + `created_at` — find nudges for an event
- `confirmations.entry_token` — match app token to gate scan (critical!)
- `gate_entries.scanned_at` — find recent entries
- `feedback.submitted_at` — find feedback by date

### Materialized Views

For repeated queries (ops dashboard):
```sql
REFRESH MATERIALIZED VIEW journey_complete;
REFRESH MATERIALIZED VIEW conversion_funnel;
```

Schedule this nightly or every 5 minutes:
```sql
SELECT cron.schedule('refresh-journey-view', '*/5 * * * *', 
  'REFRESH MATERIALIZED VIEW journey_complete');
```

### Partitioning (for scale)

If you have millions of rows, partition by date:

```sql
CREATE TABLE nudges_partitioned (
  -- same schema
) PARTITION BY RANGE (DATE(created_at));

CREATE TABLE nudges_2026_07 PARTITION OF nudges_partitioned
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
```

---

## Data Privacy & Compliance

### User Deletion (GDPR)

```sql
-- Delete all data for a user
SELECT delete_user_data('fan_xyz789');
```

This:
- Deletes nudges, route decisions, confirmations
- Deletes feedback
- Cascades via foreign keys
- Keeps gate scan data (for safety/security)

### Data Retention

Archive data older than 30 days:
```sql
SELECT archive_old_data(30);
```

---

## Troubleshooting

### Missing Gate Entry for a Confirmation

**Symptom:** Fan said they went to Gate 5, but no gate scan recorded.

**Debug:**
```sql
SELECT * FROM confirmations 
WHERE entry_token = 'entr_abc123xyz'
LIMIT 1;

-- Then check if there's a matching gate_entry
SELECT * FROM gate_entries 
WHERE entry_token = 'entr_abc123xyz';
```

**Possible causes:**
1. Fan didn't scan ticket (manual bypass)
2. Entry token mismatch (not passed to turnstile)
3. Turnstile offline (no scan recorded)

### Low Accuracy (MAPE > 20%)

**Symptom:** Forecast MAPE degraded for Gate 2.

**Debug:**
```sql
SELECT 
  c.predicted_wait_min,
  ge.wait_time_actual_min,
  (ge.wait_time_actual_min - c.predicted_wait_min) as error
FROM confirmations c
JOIN gate_entries ge ON c.entry_token = ge.entry_token
WHERE c.confirmed_gate_id = 'gate_2'
  AND ge.scanned_at > NOW() - INTERVAL '1 day'
ORDER BY ABS(error) DESC
LIMIT 20;
```

**Actions:**
1. Check if sensor data quality degraded (might be clogged)
2. Review external factors (weather, event change)
3. Recalibrate `throughput_per_min` if ops changed staffing

### Entry Token Collision

**Symptom:** Same entry_token used for two different fans.

**Debug:**
```sql
SELECT entry_token, COUNT(*) as cnt 
FROM confirmations 
GROUP BY entry_token 
HAVING COUNT(*) > 1;
```

**Prevention:**
- Entry tokens use `generateToken()` with cryptographic randomness
- Expires after 1 hour (low collision risk)
- Unique constraint on `confirmations.entry_token`

---

## Summary

| Task | Query | Time |
|------|-------|------|
| Daily funnel | `SELECT * FROM conversion_funnel WHERE event_date = CURRENT_DATE` | 50ms |
| Forecast accuracy | `SELECT * FROM forecast_accuracy_by_gate` | 100ms |
| Fan feedback sentiment | Aggregation query above | 75ms |
| Real-time metrics | Cached materialized view | 10ms |
| User deletion (GDPR) | `SELECT delete_user_data(user_id)` | 500ms |
