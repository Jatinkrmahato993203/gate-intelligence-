// ============================================================================
// Shared TypeScript Interfaces — Gate Intelligence Engine
// ============================================================================

// --- Queue & Sensor Types ---

export interface QueueObservation {
  observed_queue_count: number;
  observation_source: 'cctv' | 'sensor' | 'manual' | 'extrapolated';
  confidence: number; // 0.0–1.0
  timestamp: Date;
}

// --- Gate Types ---

export interface Gate {
  id: string;
  name: string;
  zone: 'entry' | 'exit';
  location: { latitude: number; longitude: number };

  // Capacity parameters (calibrated once)
  throughput_per_min: number;
  max_queue_length: number;
  processing_time_sec: number;
  crowd_slowdown_factor: number;

  // Current state
  queue_history: QueueObservation[];
  gate_status: 'open' | 'slow' | 'hold' | 'closed';
  last_updated_at: Date;
}

export interface GateRow {
  id: number;
  gate_id: string;
  venue_id: string;
  name: string;
  zone: string;
  location_lat: number;
  location_lng: number;
  throughput_per_min: number;
  max_queue_length: number;
  processing_time_sec: number;
  crowd_slowdown_factor: number;
  is_active: boolean;
}

// --- Forecast Types ---

export interface ArrivalForecast {
  time_window: 'now' | 'next_5_min' | 'next_10_min';
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

export interface HistoricalPattern {
  minute_of_day: number; // 0–1439
  day_type: 'light' | 'normal' | 'heavy';
  arrival_rate_per_min: number;
}

// --- Wait Time Types ---

export interface WaitTimeResult {
  estimated_wait_min: number;
  display_as: string;
  breakdown: {
    queue_wait: number;
    processing_wait: number;
    stress_factor: number;
  };
  confidence: number;
  trend: 'stable' | 'increasing' | 'decreasing';
}

// --- Nudge Types ---

export interface NudgeRecord {
  id: number;
  nudge_id: string;
  user_id: string;
  current_gate_id: string;
  recommended_gate_id: string;
  wait_time_current_min: number;
  wait_time_recommended_min: number;
  time_saved_min: number;
  forecast_confidence: number;
  created_at: Date;
}

// --- Route Types ---

export interface RouteResult {
  source_gate_id: string;
  target_gate_id: string;
  walk_distance_m: number;
  walk_time_min: number;
  queue_wait_min: number;
  total_time_min: number;
}

// --- Outcome Types ---

export interface DailyMetrics {
  nudges_sent: number;
  nudge_engagements: number;
  confirmations: number;
  entries_matched: number;
  forecast_mape_pct: number;
  avg_time_saved_min: number;
}

// --- WebSocket Types ---

export interface WSMessage {
  type: string;
  payload?: any;
}

export interface WSBroadcast {
  type: string;
  data: any;
  timestamp: string;
}
