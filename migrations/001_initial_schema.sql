-- ============================================================================
-- FIFA 26 Gate Intelligence Engine — Initial Schema
-- ============================================================================
-- Run against PostgreSQL 15+
-- This file is auto-loaded by docker-compose via the /docker-entrypoint-initdb.d mount

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- VENUES
-- ============================================================================

CREATE TABLE IF NOT EXISTS venues (
  id SERIAL PRIMARY KEY,
  venue_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  city VARCHAR(100),
  capacity INTEGER,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- EVENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(50) UNIQUE NOT NULL,
  venue_id VARCHAR(50) REFERENCES venues(venue_id),
  name VARCHAR(200) NOT NULL,
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ,
  expected_attendance INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- GATES
-- ============================================================================

CREATE TABLE IF NOT EXISTS gates (
  id SERIAL PRIMARY KEY,
  gate_id VARCHAR(50) UNIQUE NOT NULL,
  venue_id VARCHAR(50) REFERENCES venues(venue_id),
  name VARCHAR(100) NOT NULL,
  zone VARCHAR(20) DEFAULT 'entry',
  location_lat DOUBLE PRECISION NOT NULL,
  location_lng DOUBLE PRECISION NOT NULL,
  throughput_per_min INTEGER NOT NULL DEFAULT 44,
  max_queue_length INTEGER NOT NULL DEFAULT 800,
  processing_time_sec NUMERIC(5,2) NOT NULL DEFAULT 10.0,
  crowd_slowdown_factor NUMERIC(4,2) NOT NULL DEFAULT 0.85,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gates_venue ON gates(venue_id);
CREATE INDEX idx_gates_active ON gates(is_active) WHERE is_active = true;

-- ============================================================================
-- QUEUE OBSERVATIONS (Sensor Data)
-- ============================================================================

CREATE TABLE IF NOT EXISTS queue_observations (
  id SERIAL PRIMARY KEY,
  gate_id VARCHAR(50) NOT NULL REFERENCES gates(gate_id),
  observed_queue_count INTEGER NOT NULL,
  observation_source VARCHAR(20) NOT NULL DEFAULT 'sensor',
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0.90,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_queue_obs_gate_time ON queue_observations(gate_id, created_at DESC);

-- ============================================================================
-- WAIT TIME ESTIMATES (Historical)
-- ============================================================================

CREATE TABLE IF NOT EXISTS wait_time_estimates (
  id SERIAL PRIMARY KEY,
  gate_id VARCHAR(50) NOT NULL REFERENCES gates(gate_id),
  estimated_wait_min NUMERIC(6,2),
  queue_count INTEGER,
  confidence NUMERIC(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wait_est_gate_time ON wait_time_estimates(gate_id, created_at DESC);

-- ============================================================================
-- NUDGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS nudges (
  id SERIAL PRIMARY KEY,
  nudge_id VARCHAR(50) UNIQUE NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  current_gate_id VARCHAR(50) REFERENCES gates(gate_id),
  recommended_gate_id VARCHAR(50) REFERENCES gates(gate_id),
  wait_time_current_min NUMERIC(6,2),
  wait_time_recommended_min NUMERIC(6,2),
  time_saved_min NUMERIC(6,2),
  forecast_confidence NUMERIC(3,2),
  event_id VARCHAR(50),
  venue_id VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_nudges_user ON nudges(user_id);
CREATE INDEX idx_nudges_created ON nudges(created_at DESC);

-- ============================================================================
-- NUDGE INTERACTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS nudge_interactions (
  id SERIAL PRIMARY KEY,
  nudge_id INTEGER REFERENCES nudges(id),
  action VARCHAR(30) NOT NULL,
  action_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_nudge_int_nudge ON nudge_interactions(nudge_id);

-- ============================================================================
-- ROUTE DECISIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS route_decisions (
  id SERIAL PRIMARY KEY,
  decision_id VARCHAR(50) UNIQUE NOT NULL,
  nudge_id INTEGER REFERENCES nudges(id),
  user_id VARCHAR(64),
  selected_gate_id VARCHAR(50) REFERENCES gates(gate_id),
  reason VARCHAR(100),
  time_to_decide_sec INTEGER,
  user_location_lat DOUBLE PRECISION,
  user_location_lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CONFIRMATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS confirmations (
  id SERIAL PRIMARY KEY,
  confirmation_id VARCHAR(50) UNIQUE NOT NULL,
  entry_token VARCHAR(100) UNIQUE NOT NULL,
  nudge_id VARCHAR(50),
  route_decision_id INTEGER REFERENCES route_decisions(id),
  user_id VARCHAR(64),
  confirmed_gate_id VARCHAR(50) REFERENCES gates(gate_id),
  predicted_wait_min NUMERIC(6,2),
  device_id VARCHAR(100),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_confirm_token ON confirmations(entry_token);
CREATE INDEX idx_confirm_nudge ON confirmations(nudge_id);

-- ============================================================================
-- GATE ENTRIES (Scan Proof)
-- ============================================================================

CREATE TABLE IF NOT EXISTS gate_entries (
  id SERIAL PRIMARY KEY,
  scan_id VARCHAR(50) UNIQUE NOT NULL,
  entry_token VARCHAR(100) REFERENCES confirmations(entry_token),
  gate_id VARCHAR(50) REFERENCES gates(gate_id),
  wait_time_actual_min NUMERIC(6,2),
  scanned_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gate_entries_token ON gate_entries(entry_token);
CREATE INDEX idx_gate_entries_scanned ON gate_entries(scanned_at DESC);

-- ============================================================================
-- FEEDBACK
-- ============================================================================

CREATE TABLE IF NOT EXISTS feedback (
  id SERIAL PRIMARY KEY,
  feedback_id VARCHAR(50) UNIQUE NOT NULL,
  entry_token VARCHAR(100),
  confirmation_id INTEGER REFERENCES confirmations(id),
  user_id VARCHAR(64),
  actual_wait_min NUMERIC(6,2),
  predictions_accurate BOOLEAN,
  experience VARCHAR(20),
  direction_followed BOOLEAN,
  additional_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- HISTORICAL PATTERNS
-- ============================================================================

CREATE TABLE IF NOT EXISTS historical_patterns (
  id SERIAL PRIMARY KEY,
  gate_id VARCHAR(50) REFERENCES gates(gate_id),
  minute_of_day INTEGER NOT NULL,
  day_type VARCHAR(10) NOT NULL DEFAULT 'normal',
  arrival_rate_per_min NUMERIC(8,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- OPS ACTIONS LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS ops_actions (
  id SERIAL PRIMARY KEY,
  action_id VARCHAR(50) UNIQUE NOT NULL,
  action VARCHAR(50) NOT NULL,
  gate_id VARCHAR(50) REFERENCES gates(gate_id),
  duration_min INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- MATERIALIZED VIEWS (for dashboard queries)
-- ============================================================================

-- Journey Complete: joins the full nudge→entry chain
CREATE MATERIALIZED VIEW IF NOT EXISTS journey_complete AS
SELECT
  n.nudge_id,
  n.user_id,
  n.current_gate_id,
  n.recommended_gate_id,
  n.time_saved_min,
  c.entry_token,
  c.confirmed_gate_id,
  c.predicted_wait_min,
  ge.wait_time_actual_min,
  ge.scanned_at,
  n.created_at as nudge_sent_at
FROM nudges n
LEFT JOIN confirmations c ON c.nudge_id = n.nudge_id
LEFT JOIN gate_entries ge ON ge.entry_token = c.entry_token;

CREATE UNIQUE INDEX IF NOT EXISTS idx_jc_nudge ON journey_complete(nudge_id);

-- Conversion Funnel
CREATE MATERIALIZED VIEW IF NOT EXISTS conversion_funnel AS
SELECT
  DATE(n.created_at) as event_date,
  COUNT(DISTINCT n.id) as nudges_sent,
  COUNT(DISTINCT ni.id) as nudge_engagements,
  COUNT(DISTINCT c.id) as confirmations,
  COUNT(DISTINCT ge.id) as gate_entries,
  n.created_at
FROM nudges n
LEFT JOIN nudge_interactions ni ON n.id = ni.nudge_id
LEFT JOIN confirmations c ON c.nudge_id = n.nudge_id
LEFT JOIN gate_entries ge ON ge.entry_token = c.entry_token
GROUP BY DATE(n.created_at), n.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cf_date ON conversion_funnel(event_date, created_at);

-- ============================================================================
-- SEED DATA — FIFA 26 Demo Venue + 8 Gates
-- ============================================================================

INSERT INTO venues (venue_id, name, city, capacity, location_lat, location_lng)
VALUES ('stadiumA', 'MetLife Stadium', 'East Rutherford, NJ', 82500, 40.8128, -74.0742)
ON CONFLICT (venue_id) DO NOTHING;

INSERT INTO events (event_id, venue_id, name, scheduled_start, expected_attendance)
VALUES ('fifa26_final', 'stadiumA', 'FIFA 2026 Final', NOW() + INTERVAL '2 hours', 82500)
ON CONFLICT (event_id) DO NOTHING;

INSERT INTO gates (gate_id, venue_id, name, zone, location_lat, location_lng, throughput_per_min, max_queue_length, processing_time_sec, crowd_slowdown_factor) VALUES
  ('gate_1', 'stadiumA', 'North Gate 1',     'entry', 40.8148, -74.0742, 44, 800, 10, 0.85),
  ('gate_2', 'stadiumA', 'North Gate 2',     'entry', 40.8148, -74.0732, 38, 600, 12, 0.82),
  ('gate_3', 'stadiumA', 'East Gate 3',      'entry', 40.8138, -74.0722, 50, 1000, 8, 0.88),
  ('gate_4', 'stadiumA', 'East Gate 4',      'entry', 40.8128, -74.0722, 42, 750, 11, 0.84),
  ('gate_5', 'stadiumA', 'South Gate 5',     'entry', 40.8108, -74.0742, 46, 850, 9, 0.86),
  ('gate_6', 'stadiumA', 'South Gate 6',     'entry', 40.8108, -74.0752, 40, 700, 10, 0.83),
  ('gate_7', 'stadiumA', 'West Gate 7',      'entry', 40.8118, -74.0762, 48, 900, 9, 0.87),
  ('gate_8', 'stadiumA', 'West Gate 8',      'entry', 40.8128, -74.0762, 36, 550, 13, 0.80)
ON CONFLICT (gate_id) DO NOTHING;

-- Seed some queue observations for demo
INSERT INTO queue_observations (gate_id, observed_queue_count, observation_source, confidence) VALUES
  ('gate_1', 187, 'sensor', 0.92),
  ('gate_1', 190, 'cctv', 0.88),
  ('gate_2', 340, 'sensor', 0.90),
  ('gate_2', 335, 'sensor', 0.91),
  ('gate_3', 45, 'sensor', 0.95),
  ('gate_3', 42, 'cctv', 0.87),
  ('gate_4', 220, 'sensor', 0.89),
  ('gate_5', 95, 'sensor', 0.93),
  ('gate_5', 100, 'cctv', 0.86),
  ('gate_6', 410, 'sensor', 0.88),
  ('gate_7', 60, 'sensor', 0.94),
  ('gate_8', 520, 'sensor', 0.87);
