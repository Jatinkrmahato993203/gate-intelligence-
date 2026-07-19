# Gate Intelligence Engine — UX Flows & Interaction Patterns

A complete reference for navigating all three apps, including state machines, error handling, and real-time updates.

---

## 1. FAN APP — Four-Screen Nudge Flow

### State Machine

```
[IDLE]
  ↓ (nudge arrives)
[NUDGE_RECEIVED] — NudgeScreen
  ↓ "Show me the route"
[ROUTE_SHOWN] — RouteMapScreen (live wait updates)
  ↓ "Take this route"
[CONFIRMED] — ConfirmationScreen (token issued)
  ↓ "Rate your experience"
[FEEDBACK_PENDING] — FeedbackScreen
  ↓ "Submit feedback"
[DONE] ✓
  
OR at any point: "No thanks" / "Back" → [IDLE]
```

### Screen 1: NudgeScreen

**Purpose:** Initial push notification — answer in 3 seconds.

**Key Data:**
- `from_gate`: Current gate (e.g., "A")
- `to_gate`: Suggested gate (e.g., "C")
- `from_wait`: Current wait time in minutes (e.g., 14)
- `to_wait`: Suggested wait time in minutes (e.g., 7)
- `walk_time`: Estimated walking time (e.g., 3)

**Interaction:**
- **Primary CTA:** "Show me the route" → RouteMapScreen
- **Secondary CTA:** "No thanks" → IDLE (end flow, optionally track rejection)
- **Animation:** Slide up from bottom (250ms), shadow drop

**Live Updates:**
- Wait times on this screen DO NOT update (snapshot of decision point)
- Decide faster = more accurate savings estimate

**Error Handling:**
- If nudge expires (5 min) → Auto-dismiss to IDLE
- If network error → Show retry banner, allow dismissal

---

### Screen 2: RouteMapScreen

**Purpose:** Show walking path, validate decision, build confidence.

**Key Data:**
- Stadium map (SVG with walking path highlighted)
- Comparison: original wait vs. suggested wait
- Time breakdown: walk + queue = total
- Real-time wait updates (every 1s) on suggested gate

**Interaction:**
- **Primary CTA:** "Take this route" → ConfirmationScreen
- **Secondary CTA:** "Back" → NudgeScreen (restart flow)
- **Map interaction:** Clickable zone labels for context
- **Live updates:** Wait times refresh every 1s via WebSocket

**Visual Design:**
- Map: SVG stadium diagram (8 gates, 3 zones) with walking path in mint (#06b6d4)
- Comparison bars: side-by-side current vs. suggested
- Breakdown: walk + queue totals
- Badge: "Save 7 minutes" in green when savings are real

**Error Handling:**
- If wait time suddenly increases > 10 min → Show warning "Wait times rising" with option to reconsider
- If map fails to load → Show text-only route description
- If WebSocket disconnects → Freeze to last known values, show "Last updated X seconds ago"

---

### Screen 3: ConfirmationScreen

**Purpose:** Celebrate the decision, issue entry token.

**Key Data:**
- `entry_token`: UUID, expires in 20 minutes
- `expiry_time`: Timestamp (e.g., "20:47")
- `estimated_savings`: Minutes saved vs. current gate
- `token_url`: Deep link or QR code for scanning at gate

**Interaction:**
- **Primary CTA:** "Rate your experience" → FeedbackScreen
- **Secondary CTA:** "Done" → IDLE (skip feedback, close flow)
- **No dismissal:** User must actively choose next step (prevents accidental navigation)

**Animation:**
- Pulse effect on QR token (2s cycle, subtle)
- Confetti micro-animation on entrance (0.5s, ~20 particles, constrained to card bounds)

**Token Presentation:**
- Monospace font, high contrast (black background, mint text)
- Large enough to read at arm's length
- Copy to clipboard option (hidden on small screens)
- Warning: "Valid for 20 minutes — use soon"

**Behavior:**
- Token auto-stored in localStorage (key: `gate_token_{fan_id}`)
- Timestamp recorded for analytics
- If user closes app before feedback, token persists

---

### Screen 4: FeedbackScreen

**Purpose:** Close the feedback loop, calibrate future forecasts.

**Key Data:**
- `wait_slider`: Actual wait time (0–30 min), default = mid-point
- `route_clear`: Boolean toggle (was path walkable?)
- `nudge_id`: Reference to original nudge event

**Interaction:**
- **Slider:** Range 0–30 min, step = 1, real-time readout
- **Route Toggle:** Thumbs up/down, single toggle (only one selected at a time)
- **Primary CTA:** "Submit feedback" → closes flow + IDLE
- **Secondary CTA:** "Skip" → closes flow + IDLE (no data loss)

**Animation:**
- Slider thumb highlights on focus (mint color)
- Buttons change color on selection (mint background)

**Submission:**
- POST to `/api/feedback` with payload:
  ```json
  {
    "nudge_id": "uuid",
    "actual_wait_minutes": 7,
    "route_clear": true,
    "submitted_at": "2026-07-18T20:47:32Z"
  }
  ```
- On success: Toast "Thanks for the feedback" + fade to IDLE
- On failure: Retry banner, allow skip

**Local Fallback:**
- If offline, store in localStorage and retry on next open
- Do NOT force submission — always allow skip

---

## 2. OPS CONSOLE — Command Center Flows

### Main View: Three-Column Layout

**Left Sidebar (240px):**
- Gate list (scrollable)
- Click gate to drill into detail view
- Color-coded status badges (🟢 🟡 🔴)
- Current wait time (monospace, updates live)
- Hover: reveals secondary actions (open, close, nudge)

**Main Content (flexible):**
- Stadium heatmap (SVG zones, color-coded by congestion)
- Click zone to drill into gate list for that zone
- Metric dashboard row (nudges sent, conversions, success rate)
- Baseline comparison viewer (if incident replay active)

**Right Rail (280px):**
- Active incidents (flagged by AI)
- Quick actions (one-tap commands)
- System health dashboard
- Outcome metrics (live update every 2s)

### Incident Detection & Response Flow

```
[MONITORING]
  ↓ (AI detects surge: queue > 75% threshold)
[INCIDENT_FLAGGED]
  ↓ (red border on gate card, incident card in right rail)
[INCIDENT_EXPANDED] — Ops clicks incident card
  ↓ Incident detail: queue size, trend, AI recommendation
  ↓ Ops selects action:
    - [ACTION_OPEN_GATE] → gate opens
    - [ACTION_CLOSE_GATE] → gate closes
    - [ACTION_NUDGE_CAMPAIGN] → nudges fire
    - [ACTION_REQUEST_STAFF] → staff notified
  ↓
[ACTION_LOGGED] ✓
  ↓ (action persisted, WebSocket broadcasts update)
[INCIDENT_RESOLVED] — when queue normalizes
```

### Quick Action Keyboard Shortcuts

| Key | Action | Result |
|-----|--------|--------|
| 1 | Open Gate | Selected gate opens, WebSocket broadcasts status change |
| 2 | Close Gate | Selected gate closes |
| 3 | Request Staff | Sends alert to staff app for selected gate |
| 4 | Nudge Campaign | Fires nudge campaign to fans near selected gate |

**Workflow:**
1. Click gate in sidebar to select it
2. Press 1–4 (or click button in right rail)
3. Confirmation toast: "Gate A2 opened ✓"
4. Gate card updates in real-time via WebSocket

### Baseline Comparison Replay

**Activation:**
- Button in right rail: "Start Incident Replay"
- Loads `/demo/replay/kc_miami_incident.json` (90-minute timeline)

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ KC/Miami Incident Replay (90 min)                       │
├──────────────────┬──────────────────────────────────────┤
│ Without GIE      │ With GIE Enabled                     │
│ (Manual Ops)     │ (AI Gate Intelligence)               │
│                  │                                      │
│ [Timeline...]    │ [Timeline...]                        │
│                  │                                      │
│ Peak Queue: 2,340│ Peak Queue: 1,680  ← Lower peak      │
│ Avg Wait: 18 min │ Avg Wait: 11 min   ← Faster          │
│ Incidents: 2     │ Incidents: 0       ← Prevented       │
└──────────────────┴──────────────────────────────────────┘

[Scrubber: ▮──────●──────────────────────────────────── 42:15 / 90:00]
              ↑ Drag to rewind/fast-forward
```

**Interaction:**
- Scrubber: Drag to any point in timeline
- As you scrub, both sides update to show gate states at that timestamp
- Pause button: Freeze both replays
- Key callout box: Highlights divergence points (e.g., "System detected surge 42 min before incident. Nudges deployed 18 min before manual ops would have detected it.")

**Data Source:**
- `/api/replay/start` → initiates playback
- `/ws` (WebSocket) → emits gate events at accelerated speed (10× real-time)
- Left side simulates "no AI" decisions (manual ops decisions at fixed intervals)
- Right side shows "with AI" decisions (nudges + proactive redirects)

---

## 3. STAFF APP — Three-Screen Loop

### State Machine

```
[IDLE] — GateStatusScreen
  ↓ Instruction arrives (WebSocket)
[INSTRUCTION_RECEIVED] — InstructionScreen appears
  ↓ Staff taps "Confirm"
[ACTION_CONFIRMED] — ConfirmationScreen
  ↓ Auto-advance (5s) or manual tap
[IDLE] — Back to GateStatusScreen
```

### Screen 1: GateStatusScreen

**Purpose:** One-second comprehension of gate state.

**Key Data:**
- `gate_id`: "A2"
- `zone`: "North"
- `status`: "OPEN" / "CAUTION" / "CRITICAL"
- `queue_size`: 1,852
- `capacity`: 2,100
- `capacity_percent`: 88%
- `trend`: "+12 in 3 min" with arrow icon

**Design:**
- Massive status emoji (48px, takes up 20% of screen height)
- Color background: green (open) / amber (caution) / red (critical)
- Pulsing glow animation when amber/red
- All text large (24px+) readable at 2 meters
- Single button: "I Need Help" (60×60px, gold outline)

**Behavior:**
- Auto-refresh every 2s via WebSocket
- If status changes → Glow animation + soft beep (optional, if audio enabled)
- If instruction arrives → Slide InstructionScreen down from top

---

### Screen 2: InstructionScreen

**Purpose:** Clear directive with confidence to act.

**Key Data:**
- `instruction_text`: "REDIRECT FANS → GATE B"
- `sender`: "Operations AI" or "Ops Console"
- `timestamp`: "14:32:18"
- `urgency`: "NORMAL" / "HIGH" / "CRITICAL"
- `reasoning`: (optional) "Gate A queue > 1,500"

**Design:**
- Bold instruction text (32px, 700 weight, space 2px letter-spacing)
- Urgency badge (amber/red) if HIGH/CRITICAL
- Sender + time metadata (14px, gray)
- Brief reasoning line (16px, gray, optional)
- Two buttons:
  - **Confirm** (gold, primary) — logs action
  - **Escalate** (outline, secondary) — escalates to ops console

**Animation:**
- Drops down from top (200ms bounce easing)
- Holds on screen for 3s before auto-dismissing (if no interaction)

**Error Handling:**
- If Confirm fails (network) → Retry button appears
- If timeout → Auto-dismiss with "Not confirmed" log

---

### Screen 3: ConfirmationScreen

**Purpose:** Closure and confidence.

**Key Data:**
- `action`: "Redirect Fans → Gate B"
- `executed_at`: "14:32:32"
- `executed_by`: "Gate Staff (You)"
- `status`: "ACTIVE"

**Design:**
- Large checkmark (64px)
- "Action Logged" headline (36px, green)
- Action + execution details (monospace, 16px)
- "Auto-returning in 5 seconds..." (14px, gray)
- No buttons (auto-advance)

**Animation:**
- Fade + scale in (300ms spring)
- Auto-fades and returns to GateStatusScreen (5s delay)

**Local Storage:**
- Logs action to browser localStorage (key: `staff_actions`)
- Sends POST to `/api/staff/action` with payload:
  ```json
  {
    "gate_id": "A2",
    "action": "open_gate",
    "executed_by": "staff_token",
    "timestamp": "2026-07-18T20:47:32Z"
  }
  ```

---

## 4. Real-Time Data Sync Patterns

### WebSocket Events (All Apps)

**Channel:** `ws://` (same host, upgrades to wss:// on HTTPS)

**Subscription:**
```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'subscribe', channels: ['gates', 'nudges', 'instructions'] }));
};

ws.onmessage = (event) => {
  const { type, payload } = JSON.parse(event.data);
  // Dispatch to app state
};
```

**Event Types:**

| Event | Frequency | Payload | Apps |
|-------|-----------|---------|------|
| `gate:wait_update` | Every 1s | `{ gate_id, wait_minutes, confidence }` | Ops, Fan (RouteMap) |
| `gate:status_change` | On change | `{ gate_id, status, capacity_percent }` | Ops, Staff |
| `nudge:sent` | On event | `{ nudge_id, fan_token, from_gate, to_gate }` | Ops (metrics) |
| `nudge:confirmed` | On event | `{ nudge_id, fan_token, timestamp }` | Ops (metrics) |
| `instruction:new` | On event | `{ instruction_id, gate_id, text, urgency }` | Staff |
| `incident:detected` | On event | `{ incident_id, gate_id, type, severity }` | Ops |
| `incident:resolved` | On event | `{ incident_id, timestamp }` | Ops |
| `replay:event` | Accelerated | (varies by replay mode) | Ops (baseline comparison) |

### Error Resilience

**Ops Console (Desktop):**
- If WebSocket disconnects → Show banner "Connection lost" (retry in 5s)
- Freeze data at last known state (do not clear)
- Restore connection → Fetch fresh state, merge with local cache

**Fan App (Mobile):**
- If WebSocket disconnects during RouteMapScreen → Freeze wait times, show "Last updated X seconds ago"
- Allow user to proceed with "stale" data (assume wait times haven't changed much)
- If disconnects during Nudge/Confirmation → Allow offline submission (store in localStorage, retry on reconnect)

**Staff App (Field):**
- If WebSocket disconnects → Show "Offline mode" indicator
- GateStatusScreen frozen at last known state
- If instruction arrives while offline → Queue and display when reconnected
- Critical: Never lose logged actions (always persist to localStorage first)

---

## 5. Loading & Error States

### Loading States

**Ops Console:**
- Skeleton loaders on gate cards (gray placeholder, fade-in when data arrives)
- Heatmap zones: pulse animation until data loaded
- No spinners (data loads within 300ms)

**Fan App:**
- Nudge screen: appears immediately (pre-fetched)
- Route map: subtle pulse on wait time numbers (1.5s cycle) while live-updating
- No blocking loaders (always responsive)

**Staff App:**
- NO loading states (assume instant responsiveness)
- If action > 2s → Spinner appears on button
- If > 5s → "Connection error, retry?" option

### Error Messages

**Ops Console:**
- "Failed to open gate A2. Check network and retry."
- "Incident replay failed to load. Try another incident."
- Always offer manual action (don't require AI)

**Fan App:**
- "Couldn't fetch wait times. Using last known data."
- "Route offline — we'll sync when connected."
- Never block user (always allow progression)

**Staff App:**
- "Action not confirmed. Check network."
- "Instruction arrived late. Please refresh status manually."
- Keep it brief (field staff need clarity)

---

## 6. Accessibility & Inclusive Design

### Touch Target Size
- **Mobile (Fan, Staff):** 44–60px minimum
- **Desktop (Ops):** 36px minimum
- **Staff outdoor:** 60px (field conditions, wet gloves, bright sun)

### Color Contrast (WCAG AA)
- All status badges pass 4.5:1 on their background
- Ops console: 7:1 (high-contrast command center)
- Fan app: 4.5:1 minimum
- Staff app: 7:1 (outdoor legibility)

### Keyboard Navigation
- **Ops Console:** Tab through gate list, Shortcuts (1–4), Enter to confirm
- **Fan App:** Tab through buttons, Space/Enter to select, Swipe to navigate
- **Staff App:** Tab through buttons, swipe preferred

### Screen Reader Support
- **Ops:** "Gate A2, caution status, 14 minute wait, up trend"
- **Fan:** "Nudge card, save 7 minutes by going to gate C"
- **Staff:** "Gate A2 status open, queue 1852 of 2100"

### Reduced Motion (prefers-reduced-motion)
- All animations scale to 0.3s with no spring easing
- Pulsing status indicators become static
- Confetti disabled

---

## 7. Analytics & Telemetry

### Fan App Events

| Event | Payload | Purpose |
|-------|---------|---------|
| `nudge_received` | `{ nudge_id, from_gate, to_gate, wait_delta }` | Track nudge distribution |
| `nudge_accepted` | `{ nudge_id, decision_time_ms }` | Measure engagement |
| `nudge_rejected` | `{ nudge_id, reason? }` | Improve targeting |
| `route_confirmed` | `{ nudge_id, entry_token }` | Measure confirmations |
| `feedback_submitted` | `{ nudge_id, actual_wait, route_clear }` | Calibrate forecasts |

### Ops Console Events

| Event | Payload | Purpose |
|-------|---------|---------|
| `incident_detected` | `{ incident_id, gate_id, severity }` | Audit AI decisions |
| `action_taken` | `{ incident_id, action, timestamp }` | Track ops response |
| `nudge_campaign_fired` | `{ incident_id, nudges_sent, zone }` | Measure AI effectiveness |
| `baseline_comparison_viewed` | `{ incident_id, comparison_duration_s }` | Track learning |

### Staff App Events

| Event | Payload | Purpose |
|-------|---------|---------|
| `instruction_received` | `{ instruction_id, gate_id, urgency }` | Track field directives |
| `action_confirmed` | `{ instruction_id, action, exec_time_s }` | Measure field response time |
| `action_escalated` | `{ instruction_id, reason? }` | Identify ambiguous instructions |

---

## 8. Offline Fallback Strategy

### Fan App Offline Behavior

**Nudge Screen:**
- If offline when nudge arrives → Still show local nudge (pre-cached)
- Allow decision (route stored locally)
- Entry token generated locally, synced when online

**RouteMap Screen:**
- If WebSocket was online → Frozen at last known wait times
- Show "Last updated X seconds ago"
- Allow progression (assume minimal change)

**Feedback:**
- Store in localStorage if offline
- Retry POST when reconnected
- Silent sync (no notification needed)

### Ops Console Offline Behavior

**Not designed for offline use.** If disconnects:
- Show "Offline mode — data may be stale" banner
- Freeze all controls (no actions allowed)
- Retry WebSocket every 5s
- Recommend desktop browser for stability

### Staff App Offline Behavior

**Graceful degradation:**
- Last known gate status persists (don't clear)
- Instructions queued locally, displayed on reconnect
- Action confirmations stored offline, synced on reconnect
- Show "Offline — limited connectivity" indicator

---

## 9. Edge Cases & Recovery

### Clock Skew (User's device time out of sync)

**Problem:** Entry token expires based on server time; user's clock is 5 minutes behind.

**Solution:**
- Server sends `server_time` with every WebSocket message
- Client calculates offset: `local_offset = server_time - local_time`
- Token expiry shown with offset applied: `expiry_time + local_offset`
- Warn user if offset > 2 min: "Your device time may be incorrect"

### Gate Reopens During User Engagement

**Scenario:** User is on RouteMapScreen for Gate C. Gate C suddenly closes. What do we show?

**Behavior:**
1. Wait time for Gate C jumps to "Closed"
2. Show warning banner: "Gate C just closed. Would you like a new suggestion?"
3. Offer "Get new route" button
4. If user continues with closed gate → On confirmation, show warning: "This gate is no longer open."

### Lost Nudge Entry Window

**Scenario:** User was nudged to Gate C (7 min wait). Took 5 seconds to decide. Wait time now 4 min. Is the savings estimate still valid?

**Behavior:**
- Show "savings" as margin, not absolute: "Saving ~2–5 minutes"
- If wait time delta reversed (Gate C now slower) → Show warning: "Conditions have changed. Gate A may be faster now."
- Always let user decide (don't auto-reject)

### Feedback Accuracy Validation

**Scenario:** User says they waited 7 min, but other data suggests 14 min.

**Backend Logic:**
- Flag outliers (deviation > 50% from forecast) as `feedback_unreliable`
- Weight newer feedback higher (recent data more predictive)
- Continue using outlier data (don't reject) but downweight in aggregation
- Never show "you're wrong" to user (preserves trust)

---

## 10. Performance & Rendering

### Frame Rate Targets

| App | Primary Interaction | Target FPS |
|-----|-------------------|-----------|
| Ops Console | Heatmap pan/zoom | 60 FPS |
| Fan App | Slider (feedback) | 60 FPS |
| Staff App | Screen transitions | 60 FPS |

### Bundle Size Targets

| App | Target | Approach |
|-----|--------|----------|
| Ops Console | 180KB | Lazy-load heatmap SVG, tree-shake analytics |
| Fan App | 85KB | Minimal React, no animations library, inline SVG |
| Staff App | 60KB | No framework, vanilla JS, inlined styles |

### Live Update Optimization

**Ops Console (gate wait times):**
- Update only changed values (diff before render)
- Batch DOM updates (RAF for 60 FPS)
- Memoize gate cards to avoid re-renders

**Fan App (route wait times):**
- Update monospace numbers only (direct text-content mutation)
- No DOM diff (atomic, single-source-of-truth)

**Staff App (no live updates):**
- Static content, no optimization needed

---

## 11. A/B Testing Hooks

### Nudge Presentation Variants

| Variant | Description | Metrics |
|---------|-------------|---------|
| A (Current) | Emphasize time savings | Acceptance rate |
| B | Emphasize crowd comfort | Acceptance rate |
| C | Show live photos of queues | Acceptance rate |

**Tracking:**
- Add `variant` field to nudge event
- Track `nudge_accepted` and `nudge_rejected` by variant
- Measure `feedback_accuracy` (actual vs. forecast) by variant

### Route Presentation Variants

| Variant | Description | Metrics |
|---------|-------------|---------|
| A (Current) | Map + breakdown | Confirmation rate |
| B | Text-only directions | Confirmation rate |
| C | Augmented reality overlay (future) | Confirmation rate |

---

## 12. Rollout & Feature Flags

### Launch Phases

**Phase 1 — Staff + Ops (Internal):**
- Staff app live at 3 stadiums (test field experience)
- Ops console live at HQ (test command center)
- AI engine predictions internal only (no fan nudges)

**Phase 2 — Fan Nudges (Beta):**
- Enable nudges for 10% of fans (internal cohort first)
- Measure feedback accuracy, acceptance rate
- Ramp to 50% if metrics green

**Phase 3 — Full Launch:**
- 100% of fans eligible for nudges
- Monitor for system stress, escalate to ops if needed

### Feature Flags (Via `/api/config`)

```json
{
  "nudges_enabled": true,
  "nudges_percentage": 100,
  "incident_replay_enabled": true,
  "gemini_enabled": true,
  "staff_language_support": ["en", "es", "hi"],
  "max_concurrent_nudges": 500
}
```

**Client checks flags on app load and every 5 minutes.**

---

## Summary: Happy Path for Each App

### Fan App Happy Path (0–30 seconds)
1. User scrolling, nudge arrives (1s)
2. User reads nudge, taps "Show me the route" (3s)
3. Route screen loads with map (1s)
4. User reviews wait comparison, taps "Take this route" (3s)
5. Entry token issued, saved to localStorage (1s)
6. User sees "Rate your experience" prompt, taps "Done" (no feedback) (1s)
7. Flow closes

**Total: ~13 seconds to entry token**

### Ops Console Happy Path
1. Ops opens console (1s)
2. Heatmap loads, shows live wait times (2s)
3. AI detects incident on Gate A2 (incident card appears in right rail) (1s)
4. Ops clicks incident card, reads AI recommendation (1s)
5. Ops presses "1" key (open gate) (0.2s)
6. Confirmation toast: "Gate A2 opened ✓" (1s)
7. Wait times begin dropping, incident resolves (automated) (30s)

**Total: Decision to resolution in ~35 seconds**

### Staff App Happy Path
1. Staff sees GateStatusScreen (always-on) (0s)
2. Instruction arrives via WebSocket (1s)
3. InstructionScreen drops down with action (1s)
4. Staff reads instruction: "Redirect fans to Gate B" (2s)
5. Staff taps "Confirm" (0.5s)
6. ConfirmationScreen shows "Action logged" (1s)
7. Auto-advances to GateStatusScreen (5s)

**Total: Instruction to confirmation in ~10 seconds**

---

**This document is the definitive reference for frontend state management, navigation, and user flows. Implement in React, Vue, or vanilla JS using these patterns as the blueprint.**
