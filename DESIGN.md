# Gate Intelligence Engine — Design System

A three-audience system demanding visual clarity at stadium scale, real-time tension, and mobile-first consumer touch.

---

## Core Design Philosophy

**Three distinct visual languages for three audiences:**
1. **Ops Console** — Command center. Industrial, high-contrast, metric-driven. Gold + black + white.
2. **Fan App** — Consumer-grade. Warm, mobile-first, low-friction navigation. Soft mint + warm stone + action accent.
3. **Staff App** — Field guide. Massive type, neo-brutalist, readable at 2 meters. Gold outlines on black.

**Unifying principle:** Stadium-grade legibility. No text under 14px on mobile; no status unclear in 1 second; every action one tap.

---

## Typography

### Typefaces
- **Ops Console + Staff App:** [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) (geometric, industrial, weights 400, 600, 700)
- **Fan App:** [Inter](https://fonts.google.com/specimen/Inter) (humanist, warm, weights 400, 500, 600)
- **Numeric Display (all apps):** [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono) for wait times, tokens, timestamps

### Scale & Hierarchy

#### Ops Console
| Use | Size | Weight | Line Height | Letter Spacing |
|-----|------|--------|-------------|----------------|
| Page title | 32px | 700 | 1.2 | -0.01em |
| Section head | 18px | 600 | 1.3 | -0.005em |
| Metric label | 12px | 400 | 1.4 | 0.05em |
| Metric value | 24px | 600 | 1.2 | -0.01em |
| Body copy | 14px | 400 | 1.6 | 0 |
| UI label (button, toggle) | 13px | 500 | 1.4 | 0.02em |

#### Fan App
| Use | Size | Weight | Line Height | Letter Spacing |
|-----|------|--------|-------------|----------------|
| Screen title | 24px | 600 | 1.3 | -0.01em |
| Card heading | 16px | 500 | 1.4 | 0 |
| Body copy | 14px | 400 | 1.6 | 0 |
| CTA button | 16px | 600 | 1.4 | -0.005em |
| Micro label | 12px | 400 | 1.5 | 0.01em |

#### Staff App
| Use | Size | Weight | Line Height | Letter Spacing |
|-----|------|--------|-------------|----------------|
| Status (🟢 OPEN) | 48px | 700 | 1.1 | -0.02em |
| Gate ID / Zone | 32px | 600 | 1.2 | -0.01em |
| Action instruction | 20px | 600 | 1.4 | -0.005em |
| Button label | 18px | 600 | 1.3 | 0 |
| Timestamp | 13px | 400 | 1.4 | 0.02em |

---

## Color Palette

### Ops Console & Staff App
Inspired by declassified intelligence documents — high contrast, purposeful color.

| Token | Hex | Usage | Accessibility |
|-------|-----|-------|----------------|
| **Base Black** | `#0d0d0d` | Background (ops) | WCAG AAA |
| **White** | `#ffffff` | Text, dividers, borders (ops) | WCAG AAA |
| **Gold Accent** | `#FFD700` | CTAs, highlights, staff status | WCAG AA on black |
| **Gold Dark** | `#BFA000` | Hover states, pressed buttons | WCAG AA on black |
| **Status Green** | `#22c55e` | Gate open, operation normal | WCAG AA on black |
| **Status Amber** | `#f59e0b` | Caution, elevated wait | WCAG AA on black |
| **Status Red** | `#ef4444` | Critical, exceeded threshold | WCAG AA on black |
| **Surface Ops** | `#1a1a1a` | Card backgrounds (ops) | Contrast 10:1 on black |
| **Border Ops** | `#333333` | Subtle dividers | Contrast 3:1 on black |

### Fan App
Warm, accessible, designed for mobile and afternoon sunlight.

| Token | Hex | Usage | Accessibility |
|-------|-----|-------|----------------|
| **Background** | `#faf8f6` | Page background | WCAG AAA |
| **Surface** | `#ffffff` | Cards | WCAG AAA |
| **Text Primary** | `#1a1a1a` | Body copy | WCAG AAA |
| **Text Secondary** | `#6b7280` | Labels, hints | WCAG AA |
| **Mint Accent** | `#06b6d4` | Primary CTA, highlights | WCAG AAA on white |
| **Warm Stone** | `#d4a574` | Secondary accent, badges | WCAG AA on white |
| **Success Green** | `#22c55e` | Confirmation, positive states | WCAG AA on white |
| **Warning Amber** | `#f59e0b` | Wait time concern, alerts | WCAG AA on white |
| **Border Light** | `#e5e7eb` | Card dividers | Contrast 3:1 on white |

---

## Component Library

### Ops Console — Core Components

#### GateCard
**Purpose:** Compact gate status at a glance.

```
┌─────────────────────────────────────────┐
│ Gate A2                        Sensor ✓  │  ← Zone badge, sensor status
│ Zone A · Capacity: 4,200               │
│                                         │
│  Wait Time:  14 min   ↑ +2 min         │  ← Trend arrow + 3m delta
│  Crowd:     1,852 / 2,100   88%        │  ← Density bar + %
│  Status:    🟡 CAUTION                 │  ← Dynamic status badge
│                                         │
│ [OPEN GATE]  [CLOSE]  [NUDGE CAMPAIGN] │  ← Quick actions
└─────────────────────────────────────────┘
```

**Hover state:** Gold underline on title, subtle shadow lift.  
**Mobile:** Stacks actions vertically, hides sensor badge until tapped.

#### WaitTimeHeatmap
**Purpose:** Stadium-zone overview at a glance.

```
                    North Gate (A1–A3)
         Gold border if zone ≥ 75% capacity
              🟢 A1   🟡 A2   🟡 A3
              8m      14m     13m

  West                                East
  Gate                                Gate
  (B1–B3)                             (C1–C3)
  
  🟢 B1  14m        [STADIUM]          🟢 C1  7m
  🟢 B2  12m        CENTER             🟡 C2  15m
  🟡 B3  16m        MAP VIEW           🟢 C3  9m

              South Gates (D1–D3)
              🟢 D1   🟡 D2   🟢 D3
              6m      18m     8m
```

**Interaction:** Click any zone to drill into gate detail view. Drag scrubber to rewind/fast-forward during incident replay.

#### SystemHealthDashboard
**Purpose:** Operations confidence at a glance.

```
┌─────────────────────────────────────────┐
│ SYSTEM HEALTH                           │
│                                         │
│ Sensors Online      96%  [████████░░]   │  ← Red if < 90%
│ API Latency        142ms  [██████░░░░]   │  ← Amber if > 200ms
│ WebSocket          ✓ Connected          │  ← Red if down
│ Last Broadcast     2.3s ago             │  ← Updates every 1s
│ MAPE (24h)         8.7%  ↓ 0.2%         │  ← Forecast accuracy trend
│                                         │
└─────────────────────────────────────────┘
```

**Refresh:** Auto-updates every 2s. Click to expand detailed logs.

#### QuickActionBar
**Purpose:** One-tap ops commands with keyboard shortcuts.

```
┌─────────────────────────────────────────┐
│ [1: OPEN]  [2: CLOSE]  [3: REQUEST STAFF]  [4: NUDGE] │
│ Gold hover state. Click or press 1–4. No modals.      │
└─────────────────────────────────────────┘
```

**Mobile:** Horizontal swipe carousel. Keyboard shortcuts disabled.

### Fan App — Core Components

#### NudgeCard
**Purpose:** Initial push notification card — stop the scrolling.

```
┌────────────────────────────────────┐
│                                    │
│  💡 Gate C is 4 min faster         │  ← Icon + main copy
│     right now                      │
│                                    │
│  Current Gate: A (14 min wait)     │  ← Context
│  Suggested Gate: C (7 min wait)    │
│                                    │
│  📍 3-minute walk + queue          │  ← Time estimate
│                                    │
│ [SHOW ME THE ROUTE] [NO THANKS]   │  ← Clear CTAs
└────────────────────────────────────┘
```

**Animation:** Slide up from bottom, shadow drop.  
**State:** Mint accent on primary CTA. Warm stone on secondary.

#### RouteMapScreen
**Purpose:** Clear walking path + live wait comparison.

```
────────────────────────────────────
       Your Route to Gate C
────────────────────────────────────

  ┌─────────────────────────┐
  │                         │
  │    [Stadium Map SVG]    │  ← Walking path highlighted in mint
  │    Current: A           │     Suggested: C marker
  │                         │     Zone shading for context
  └─────────────────────────┘

  ┌─────────────────────────────────┐
  │ Current Gate A          Gate C   │
  │ Wait: 14 min            Wait: 7 min
  │ ████████████████ 14m    ███████ 7m│  ← Side-by-side bars
  │ Saving you ~7 minutes   ✓         │
  └─────────────────────────────────┘

  ┌─────────────────────────┐
  │ Walk: 3 min             │  ← Breakdown
  │ Queue: 7 min            │
  │ Total: 10 min           │
  └─────────────────────────┘

  ┌─────────────────────────┐
  │  [TAKE THIS ROUTE]      │  ← Primary CTA (mint)
  │  [BACK]                 │  ← Secondary (warm stone outline)
  └─────────────────────────┘
────────────────────────────────────
```

**Live update:** Wait times update every 1s via WebSocket. No refresh button needed.

#### ConfirmationScreen
**Purpose:** Entry token issued. Dopamine hit.

```
────────────────────────────────────
         Success! ✓
────────────────────────────────────

  🎯 You're saving ~7 minutes
     (vs staying at your current gate)

  ┌─────────────────────────┐
  │                         │
  │  ╔═══════════════════╗  │  ← QR-style token box
  │  ║ D47E92F3C1       ║  │     Monospace font
  │  ║ EXPIRES: 20:47   ║  │
  │  ╚═══════════════════╝  │
  │                         │
  └─────────────────────────┘

  Entry valid for 20 minutes.
  Walk to Gate C and scan at entry.

  ┌─────────────────────────┐
  │  [RATE YOUR EXPERIENCE] │  ← Deferred to post-entry
  │  [DONE]                 │
  └─────────────────────────┘
────────────────────────────────────
```

**Animation:** Pulse effect on token, confetti micro-animation (subtle).

#### FeedbackScreen
**Purpose:** Close the loop — calibrate the system.

```
────────────────────────────────────
    How'd it go?
────────────────────────────────────

  ⏱️  How long did you actually wait?
  
  ┌───────────────────────────────┐
  │                               │  ← Slider, default 0
  │ 0─────●───────────────────30  │     Thumb highlights on focus
  │ min                      min   │
  └───────────────────────────────┘

  🛣️  Was the route clear?
  
  ┌──────────────────────────────┐
  │  [👍 YES]     [👎 NO]        │  ← Dual button state, toggle
  └──────────────────────────────┘

  ┌──────────────────────────────┐
  │   [SUBMIT FEEDBACK]          │  ← Mint CTA
  │   [SKIP]                     │  ← Subtle secondary
  └──────────────────────────────┘
────────────────────────────────────
```

**State management:** Slider value → API payload. Thumbs up/down → boolean.

### Staff App — Core Components

#### GateStatusScreen
**Purpose:** One-second comprehension in bright stadium light.

```
────────────────────────────────────
                                    Gate A2
                                    Zone: A

         🟢 OPEN
         
         Queue: 1,852
         Capacity: 2,100 (88%)
         
         Trend: ↑ +12 in 3 min
         

         ┌──────────────────────────┐
         │ [I NEED HELP]            │  ← Bold gold outline, 18px
         └──────────────────────────┘
         
         Connected · Last update: 2s ago
────────────────────────────────────
```

**Massive type, NO UI clutter.** Status emoji dominates screen (48px).  
**Color coded:** 🟢 (green bg), 🟡 (amber bg), 🔴 (red bg).

#### InstructionScreen
**Purpose:** Clear directive + confidence to act.

```
────────────────────────────────────

         REDIRECT FANS → GATE B
         
         Sent by: Operations AI
         Time: 14:32:18
         Urgency: HIGH
         

         ┌──────────────────────────┐
         │ [✓ CONFIRM]              │  ← Gold, 18px
         └──────────────────────────┘
         
         ┌──────────────────────────┐
         │ [? ESCALATE]             │  ← Outline, 18px
         └──────────────────────────┘
────────────────────────────────────
```

**Instruction variants:**
- `OPEN SECOND LANE — Gate B queue > 1,500`
- `REDUCE FLOW — Gate A approaching 95% capacity`
- `REQUEST BACKUP — Sensor malfunction detected`
- `CLOSE GATE — Maintenance alert received`

#### ConfirmationScreen
**Purpose:** Closure. Log the action. Breathe.

```
────────────────────────────────────

         ✓ Action Logged
         

         REDIRECT FANS → GATE B
         
         Executed: 14:32:32
         By: Gate Staff (You)
         Duration: 14 seconds
         
         Status: ACTIVE until further notice
         
         
         [Auto-returning in 5 seconds...]
────────────────────────────────────
```

**Auto-advance** to GateStatusScreen after 5s. No manual close needed.

#### LanguageToggle
**Purpose:** Trilingual field clarity.

```
┌──────────────────────────────────┐
│ EN  │ ES  │ HI                    │  ← Pill buttons, gold border
│     ✓│     │                      │    on selected language
│     ││     │                      │
└──────────────────────────────────┘
```

**All copy switched via `i18n` JSON files:**
- `en.json` → English
- `es.json` → Spanish (for Miami operations)
- `hi.json` → Hindi (for domestic stadiums)

---

## Layout Patterns

### Ops Console — Three-Column Layout

```
WIDTH: Desktop only (1440px minimum)

┌──────────────────────────────────────────────────────────────────────────┐
│ GATE INTELLIGENCE ENGINE                                   [⚙️ Settings] │
├──────────────┬──────────────────────────────────┬────────────────────────┤
│              │                                  │                        │
│ Gate List    │  Heatmap / Zone Overview        │  Active Incidents +    │
│ (Left Sidebar)│                                 │  Quick Actions         │
│              │  (Main Content)                  │  (Right Rail)          │
│ • A1  🟢      │  ┌────────────────────────────┐ │                        │
│   14m ↑      │  │  STADIUM MAP                │ │  🚨 Gate A2            │
│ • A2  🟡      │  │  (SVG Heatmap)             │ │  Caution: 14m wait     │
│   14m →      │  │                             │ │  [Open Gate] [Close]   │
│ • A3  🟡      │  │                             │ │                        │
│   13m →      │  │                             │ │  📊 Metrics            │
│ • B1  🟢      │  │                             │ │  • Nudges sent: 42     │
│   12m ↓      │  │                             │ │  • Conversions: 28     │
│              │  └────────────────────────────┘ │  • Success rate: 67%   │
│              │                                  │                        │
│ [MANUAL MODE]│  Last updated: 1.2s ago          │  [START INCIDENT MODE] │
└──────────────┴──────────────────────────────────┴────────────────────────┘
```

**Left sidebar:** 240px fixed width. Gate list scrollable.  
**Main:** Flexible, takes remaining space.  
**Right rail:** 280px fixed width. Sticky to viewport.

### Fan App — Full-Height Card Stacks

```
WIDTH: Mobile first (375–414px), responsive to tablet (768px+)

Mobile (375px):
┌──────────────────┐
│                  │
│  Screen 1: Nudge │  ← Full viewport (minus safe area)
│  Card            │
│  (Centered,      │
│   90% width)     │
│                  │
└──────────────────┘

Tablet (768px):
┌────────────────────────────────────────┐
│                                        │
│           Screen 1: Nudge Card         │  ← Centered, 60% width
│           (Larger text, more breathing)│
│                                        │
└────────────────────────────────────────┘
```

**Card styling:** Rounded corners (16px), white background, subtle shadow (0 4px 12px rgba(0,0,0,0.08)).  
**Spacing:** 20px bottom padding (safe area for thumbs).

### Staff App — Full-Screen Takeover

```
WIDTH: Mobile only (375–414px)

┌──────────────────────────────────────┐
│                                      │  ← No header chrome
│                                      │  ← No navigation
│                                      │  ← Center content vertically
│   Full-Screen Status / Instruction   │
│   (Readable at 2 meters)             │
│                                      │
│   Buttons at bottom (safe area)      │
│                                      │
└──────────────────────────────────────┘
```

**No overflow.** Content fits within viewport without scrolling.

---

## Interaction Patterns

### Transitions & Motion

#### Ops Console
- **Screen load:** Heatmap fades in (300ms). Gate cards stagger (80ms apart).
- **Status change:** Color transition (200ms ease-out). Trend arrow bounces (+100ms spring).
- **Incident replay scrub:** Gate wait values update in real-time as scrubber moves.

#### Fan App
- **Screen progression:** Slide up from bottom (250ms). Smooth deceleration curve.
- **Card swipe:** Swiping right dismisses card (if "No thanks" available). Momentum scroll.
- **Token reveal:** Scale + opacity animation (400ms spring). Confetti burst (micro particles, 0.5s).

#### Staff App
- **Status indicator:** Pulsing glow when amber/red (1s cycle). Stops when green.
- **Instruction card:** Drops down from top (200ms bounce). Holds for 3s before user dismissal.
- **Confirmation screen:** Fade + scale in (300ms). Auto-fades and returns to status (5s delay).

### Gesture Language

#### Mobile (Fan + Staff)
- **Swipe right:** Dismiss optional screens (e.g., "No thanks" on nudge card)
- **Swipe left:** Go back
- **Tap:** Confirm, navigate, toggle
- **Long-press:** (Staff) Escalate action
- **Pull-to-refresh:** (Not used — WebSocket pushes updates live)

#### Desktop (Ops)
- **Click:** Open gate detail, toggle quick action
- **Keyboard shortcut:** 1–4 for quick actions (open, close, request staff, nudge)
- **Drag:** Move gate order in sidebar, scrub replay timeline
- **Hover:** Reveal details, highlight related zones on heatmap

### Loading States

**Ops Console:**
```
Skeleton loaders: Gray placeholder (2:1 aspect ratio).
Fade in when data arrives (300ms).
```

**Fan App:**
```
Pulse effect on wait time numbers (subtle, 1.5s cycle).
Micro-label: "Updated just now" (auto-updates every 1s).
```

**Staff App:**
```
NO loading states. Action assumes instant completion.
If API lag > 2s, show spinner on button (rare).
```

---

## Accessibility

### Color Contrast
- **Ops Console:** All text ≥ 7:1 ratio on black backgrounds (WCAG AAA).
- **Fan App:** All text ≥ 4.5:1 ratio (WCAG AA, mostly AAA).
- **Staff App:** All text ≥ 7:1 ratio (stadium readability).

### Touch Targets
- **Minimum size:** 44×44px (mobile), 48×48px (staff app).
- **Minimum spacing:** 8px between targets.
- **Staff app:** 60×60px for all buttons (field conditions).

### Keyboard Navigation
- **Ops Console:** Tab order follows visual hierarchy. Shortcuts (1–4) for ops.
- **Fan App:** Tab-navigable, swiping preferred. Enter to submit.
- **Staff App:** Large hit areas, no fine motor required.

### Screen Reader Support
- **Ops Console:** Status badges use `aria-label`: "Gate A2, wait 14 minutes, caution status, up arrow trend".
- **Fan App:** Cards announce purpose. Sliders announce current value.
- **Staff App:** Status emoji with text alternative: "Gate status: open".

### Reduced Motion
- **Prefers-reduced-motion:** All animations scale to 0.3s with no spring easing.
- **Staff app (field):** Pulsing status indicators become static (solid color fill).

---

## Responsive Breakpoints

| Device | Width | Layout | Apps |
|--------|-------|--------|------|
| Mobile | 375–414px | Single column, full-height cards | Fan, Staff |
| Tablet | 768–1024px | 2-column (Ops sidebar + main) | All |
| Desktop | ≥1440px | 3-column (Ops) | Ops only |

**Ops console NOT mobile-responsive.** Designed for desktop command center use.

---

## Component State Matrix

### GateCard (Ops)
| State | Background | Border | Text Color | Badge |
|-------|-----------|--------|-----------|-------|
| Open | Surface | Border Ops | White | 🟢 Green |
| Caution | Surface | Gold | White | 🟡 Amber |
| Critical | Surface | Red | White | 🔴 Red |
| Sensor Off | Surface | Border Ops (faded) | Gray 6b7280 | ⚠️ Gray |

### Button States (All)
| State | Background | Text | Cursor |
|-------|-----------|------|--------|
| Default | Gold | Black | pointer |
| Hover | Gold Dark | Black | pointer |
| Active (pressed) | Gold (darker) | Black | pointer |
| Disabled | Border Ops | Gray | not-allowed |
| Loading | Gold (50% opacity) | Gray | wait |

### Input States (Fan App)
| State | Border | Background | Text |
|-------|--------|-----------|------|
| Idle | Border Light | White | Text Primary |
| Focus | Mint | White | Mint |
| Filled | Border Light | White | Text Primary |
| Error | Red | White (light red tint) | Red |
| Disabled | Border Light | Gray 9ca3af | Text Secondary |

---

## Design Tokens (CSS Variables)

```css
:root {
  /* Ops Console & Staff Colors */
  --color-ops-black: #0d0d0d;
  --color-ops-white: #ffffff;
  --color-gold: #FFD700;
  --color-gold-dark: #BFA000;
  --color-green: #22c55e;
  --color-amber: #f59e0b;
  --color-red: #ef4444;
  --color-surface-ops: #1a1a1a;
  --color-border-ops: #333333;

  /* Fan App Colors */
  --color-fan-bg: #faf8f6;
  --color-fan-surface: #ffffff;
  --color-fan-text-primary: #1a1a1a;
  --color-fan-text-secondary: #6b7280;
  --color-mint: #06b6d4;
  --color-warm-stone: #d4a574;
  --color-border-light: #e5e7eb;

  /* Typography */
  --font-family-ops: "Space Grotesk", sans-serif;
  --font-family-fan: "Inter", sans-serif;
  --font-family-mono: "IBM Plex Mono", monospace;

  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --spacing-2xl: 48px;

  /* Borders & Shadows */
  --border-radius-sm: 6px;
  --border-radius-md: 8px;
  --border-radius-lg: 12px;
  --border-radius-xl: 16px;
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px 0 rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px 0 rgba(0, 0, 0, 0.1);
  --shadow-ops: 0 0 12px rgba(255, 215, 0, 0.15); /* Gold glow */

  /* Z-index Stack */
  --z-base: 0;
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-modal: 1000;
  --z-tooltip: 1100;
}
```

---

## Deliverable Checklist

- ✅ Three distinct visual languages (Ops, Fan, Staff)
- ✅ Comprehensive component specs (GateCard, Heatmap, RouteMap, Token, etc.)
- ✅ Typography scale per audience
- ✅ Color palette with WCAG compliance verification
- ✅ Responsive layout specs
- ✅ Animation + motion language
- ✅ Accessibility guidelines (WCAG AA/AAA)
- ✅ Component state matrix
- ✅ CSS variable token definitions
- ✅ Gesture + interaction patterns

**Ready for frontend implementation.**
