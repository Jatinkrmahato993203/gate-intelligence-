/**
 * Gate Intelligence Engine — Wait Time Calculation Logic
 * 
 * Production-ready TypeScript implementation
 * - No external dependencies (uses native JavaScript)
 * - Handles sensor failures gracefully
 * - Forecasts arrival surges
 * - Applies stress factors under high crowd density
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface QueueObservation {
  observed_queue_count: number;
  observation_source: "cctv" | "sensor" | "manual" | "extrapolated";
  confidence: number; // 0.0-1.0
  timestamp: Date;
}

interface Gate {
  id: string;
  name: string;
  zone: "entry" | "exit";
  location: { latitude: number; longitude: number };
  
  // Capacity parameters (calibrated once)
  throughput_per_min: number;     // people/min
  max_queue_length: number;       // people
  processing_time_sec: number;    // seconds/person
  crowd_slowdown_factor: number;  // 0.85 when stressed
  
  // Current state
  queue_history: QueueObservation[]; // last 60 observations
  gate_status: "open" | "slow" | "hold" | "closed";
  last_updated_at: Date;
}

interface ArrivalForecast {
  time_window: "now" | "next_5_min" | "next_10_min";
  predicted_arrivals: number;
  confidence: number;
  factors: {
    historical_pattern: number;
    event_triggered: boolean;
    external_signal: string | null;
    gemini_forecast?: number;
    rule_based_forecast: number;
  };
}

interface WaitTimeResult {
  estimated_wait_min: number;
  display_as: string; // "4 min" or "~4 min" if low confidence
  breakdown: {
    queue_wait: number;
    processing_wait: number;
    stress_factor: number;
  };
  confidence: number;
  trend: "stable" | "increasing" | "decreasing";
}

interface HistoricalPattern {
  minute_of_day: number; // 0-1439 (minutes since midnight)
  day_type: "light" | "normal" | "heavy";
  arrival_rate_per_min: number;
}

// ============================================================================
// CORE CALCULATION FUNCTIONS
// ============================================================================

/**
 * Get reliable queue count from noisy observations
 * Uses weighted median + outlier rejection
 */
export function getReliableQueueCount(
  observations: QueueObservation[]
): number {
  if (observations.length === 0) return 0;

  // Use last 10 observations (100 seconds of data)
  const recent = observations
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 10);

  // Extract counts
  const counts = recent.map((o) => o.observed_queue_count);

  // Calculate median and standard deviation
  const median = percentile(counts, 0.5);
  const stddev = calculateStddev(counts);

  // Filter outliers (> 2σ from median)
  const filtered = recent.filter(
    (o) => Math.abs(o.observed_queue_count - median) < 2 * stddev
  );

  // If all filtered out, return median
  if (filtered.length === 0) return Math.round(median);

  // Weighted average of remaining observations
  const sumWeights = filtered.reduce((sum, o) => sum + o.confidence, 0);
  if (sumWeights === 0) return Math.round(median);

  return Math.round(
    filtered.reduce(
      (sum, o) => sum + o.observed_queue_count * o.confidence,
      0
    ) / sumWeights
  );
}

/**
 * Calculate wait time for a gate
 * Main function for core estimation logic
 */
export function calculateWaitTime(
  gate: Gate,
  arrivalForecast: ArrivalForecast
): WaitTimeResult {
  // Step 1: Get reliable queue count
  const queue_count = getReliableQueueCount(gate.queue_history);

  // Step 2: Determine stress level
  const capacity_utilization = queue_count / gate.max_queue_length;
  let stress_factor = 1.0;
  let processing_time = gate.processing_time_sec;

  if (capacity_utilization > 0.75) {
    // Apply crowd panic slowdown
    stress_factor = gate.crowd_slowdown_factor;
    processing_time *= stress_factor;
  }

  // Step 3: Calculate queue wait
  const effective_throughput = gate.throughput_per_min * stress_factor;
  const queue_wait = queue_count / effective_throughput;

  // Step 4: Calculate processing wait
  const processing_wait = processing_time / 60;

  // Step 5: Add forecasted arrivals
  const forecasted_queue = Math.min(
    queue_count + arrivalForecast.predicted_arrivals,
    gate.max_queue_length
  );

  // Total wait includes both current queue AND forecasted arrivals
  const total_wait_sec =
    (forecasted_queue / effective_throughput) * 60 + processing_time;
  const total_wait_min = total_wait_sec / 60;

  // Step 6: Round to nearest 0.5 min to avoid false precision
  const rounded_wait = Math.round(total_wait_min * 2) / 2;

  // Step 7: Calculate trend vs. previous estimate
  const trend = calculateTrend(gate.queue_history);

  // Step 8: Compute confidence
  const observation_confidence =
    gate.queue_history.length > 0
      ? gate.queue_history[0].confidence
      : 0.5;
  const overall_confidence =
    observation_confidence * 0.6 + arrivalForecast.confidence * 0.4;

  // Step 9: Determine display format
  let display_as = `${Math.round(rounded_wait)} min`;
  if (overall_confidence < 0.65) {
    display_as = `~${Math.round(rounded_wait)} min`; // low confidence
  }

  return {
    estimated_wait_min: rounded_wait,
    display_as,
    breakdown: {
      queue_wait,
      processing_wait,
      stress_factor,
    },
    confidence: overall_confidence,
    trend,
  };
}

/**
 * Rule-based arrival forecast (fallback when Gemini API unavailable)
 */
export function predictArrivalsRuleBased(
  currentTime: Date,
  eventStartTime: Date,
  historicalData: HistoricalPattern[],
  weather?: { condition: string; temperature: number }
): ArrivalForecast {
  const minutesToKickoff = Math.floor(
    (eventStartTime.getTime() - currentTime.getTime()) / 60000
  );

  // Step 1: Get baseline from historical pattern
  const minuteOfDay = currentTime.getHours() * 60 + currentTime.getMinutes();
  const dayType = determineDayType(currentTime);
  
  const historicalEntry = historicalData.find(
    (p) =>
      p.minute_of_day === minuteOfDay && p.day_type === dayType
  );

  const baselineArrivals = historicalEntry?.arrival_rate_per_min || 180; // default 180/min

  // Step 2: Apply time-to-event multiplier
  let eventMultiplier = 1.0;
  if (minutesToKickoff >= 0 && minutesToKickoff < 90) {
    // Use lookup table for intensity
    const intensities: { [key: number]: number } = {
      90: 1.0,   // 90 min out: normal
      60: 1.3,   // 60 min out: 30% surge
      30: 2.2,   // 30 min out: 120% surge (PEAK)
      15: 1.8,   // 15 min out: still high
      5: 0.4,    // 5 min out: late arrivals
      0: 0.05,   // kickoff: almost nobody
    };

    eventMultiplier = interpolate(minutesToKickoff, intensities);
  }

  // Step 3: Apply weather factor
  let weatherFactor = 1.0;
  if (weather?.condition === "rain") {
    weatherFactor = 0.85; // 15% fewer arrivals in rain
  }

  // Step 4: Compute final forecast
  const predictedArrivals = Math.round(
    baselineArrivals * eventMultiplier * weatherFactor * 5 // multiply by 5 for 5-min window
  );

  return {
    time_window: "next_5_min",
    predicted_arrivals: predictedArrivals,
    confidence: 0.72, // rule-based is less confident
    factors: {
      historical_pattern: baselineArrivals,
      event_triggered: minutesToKickoff < 90,
      external_signal:
        minutesToKickoff < 10 && minutesToKickoff >= 0
          ? `Kickoff in ${minutesToKickoff} min`
          : null,
      rule_based_forecast: predictedArrivals,
    },
  };
}

/**
 * Smooth wait time to avoid wild swings from sensor noise
 */
export function smoothWaitTime(
  newEstimate: number,
  previousEstimate: number,
  confidence: number
): number {
  const maxChange = 2; // max 2 min change per update

  if (confidence > 0.85) {
    // High confidence: allow larger swings
    return previousEstimate + Math.max(-maxChange, Math.min(maxChange, newEstimate - previousEstimate));
  } else if (confidence > 0.60) {
    // Medium confidence: blend old and new
    return previousEstimate * 0.7 + newEstimate * 0.3;
  } else {
    // Low confidence: very conservative
    return previousEstimate * 0.9 + newEstimate * 0.1;
  }
}

/**
 * Detect surge conditions and adjust strategy
 */
export function detectSurge(
  previousQueueCount: number,
  newQueueCount: number
): { isSurge: boolean; severity: "low" | "medium" | "high" } {
  const ratio = newQueueCount / (previousQueueCount + 1); // +1 to avoid divide by zero

  if (ratio > 3) {
    return { isSurge: true, severity: "high" };
  } else if (ratio > 1.8) {
    return { isSurge: true, severity: "medium" };
  } else if (ratio > 1.2) {
    return { isSurge: true, severity: "low" };
  }

  return { isSurge: false, severity: "low" };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate standard deviation
 */
function calculateStddev(values: number[]): number {
  if (values.length < 2) return 0;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    values.length;

  return Math.sqrt(variance);
}

/**
 * Calculate percentile (for median, use p=0.5)
 */
function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = p * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) return sorted[lower];

  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Linear interpolation between lookup table points
 */
function interpolate(
  x: number,
  lookupTable: { [key: number]: number }
): number {
  const keys = Object.keys(lookupTable)
    .map(Number)
    .sort((a, b) => a - b);

  // Find surrounding keys
  const lower = keys.findLast((k) => k <= x) ?? keys[0];
  const upper = keys.find((k) => k >= x) ?? keys[keys.length - 1];

  if (lower === upper) return lookupTable[lower];

  const x1 = lower,
    x2 = upper;
  const y1 = lookupTable[x1],
    y2 = lookupTable[x2];

  return y1 + ((x - x1) / (x2 - x1)) * (y2 - y1);
}

/**
 * Determine day type for historical lookup
 */
function determineDayType(date: Date): "light" | "normal" | "heavy" {
  // This is a stub—in production, use actual historical data
  // For now: weekends + holidays = normal, off-peak weekdays = light
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return "normal";
  return "light";
}

/**
 * Calculate trend: is queue growing or shrinking?
 */
function calculateTrend(
  observations: QueueObservation[]
): "stable" | "increasing" | "decreasing" {
  if (observations.length < 2) return "stable";

  const recent = observations.slice(0, 2);
  const change = recent[0].observed_queue_count - recent[1].observed_queue_count;

  if (Math.abs(change) < 10) return "stable";
  return change > 0 ? "increasing" : "decreasing";
}

// ============================================================================
// EXAMPLE USAGE
// ============================================================================

export function exampleUsage() {
  // Create a gate
  const gate: Gate = {
    id: "gate_2",
    name: "North Entrance Gate 2",
    zone: "entry",
    location: { latitude: 40.7128, longitude: -74.006 },
    throughput_per_min: 44,
    max_queue_length: 800,
    processing_time_sec: 10,
    crowd_slowdown_factor: 0.85,
    gate_status: "open",
    last_updated_at: new Date(),
    queue_history: [
      {
        observed_queue_count: 187,
        observation_source: "sensor",
        confidence: 0.9,
        timestamp: new Date(),
      },
      {
        observed_queue_count: 185,
        observation_source: "sensor",
        confidence: 0.91,
        timestamp: new Date(Date.now() - 10000),
      },
      {
        observed_queue_count: 190,
        observation_source: "cctv",
        confidence: 0.85,
        timestamp: new Date(Date.now() - 20000),
      },
    ],
  };

  // Get reliable queue count
  const queueCount = getReliableQueueCount(gate.queue_history);
  console.log(`Reliable queue count: ${queueCount}`);

  // Forecast arrivals (rule-based)
  const eventStartTime = new Date(Date.now() + 30 * 60000); // 30 min from now
  const forecast = predictArrivalsRuleBased(new Date(), eventStartTime, []);
  console.log(`Forecasted arrivals: ${forecast.predicted_arrivals}`);

  // Calculate wait time
  const waitTime = calculateWaitTime(gate, forecast);
  console.log(`Wait time: ${waitTime.display_as}`);
  console.log(`Confidence: ${(waitTime.confidence * 100).toFixed(0)}%`);
  console.log(`Trend: ${waitTime.trend}`);
}
