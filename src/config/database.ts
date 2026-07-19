// ============================================================================
// PostgreSQL Connection Pool
// ============================================================================

import { Pool, PoolClient, PoolConfig } from 'pg';
import { env } from './env';
import { logger } from '../middleware/logging';

let pool: Pool;
let useMockDb = false;

// Mock Data Store
const mockGates = [
  {
    gate_id: 'gate_1',
    venue_id: 'stadiumA',
    name: 'North Gate 1',
    zone: 'entry',
    location_lat: 40.8148,
    location_lng: -74.0742,
    throughput_per_min: 44,
    max_queue_length: 800,
    processing_time_sec: 10,
    crowd_slowdown_factor: 0.85,
    is_active: true,
  },
  {
    gate_id: 'gate_2',
    venue_id: 'stadiumA',
    name: 'North Gate 2',
    zone: 'entry',
    location_lat: 40.8148,
    location_lng: -74.0732,
    throughput_per_min: 38,
    max_queue_length: 600,
    processing_time_sec: 12,
    crowd_slowdown_factor: 0.82,
    is_active: true,
  },
  {
    gate_id: 'gate_3',
    venue_id: 'stadiumA',
    name: 'East Gate 3',
    zone: 'entry',
    location_lat: 40.8138,
    location_lng: -74.0722,
    throughput_per_min: 50,
    max_queue_length: 1000,
    processing_time_sec: 8,
    crowd_slowdown_factor: 0.88,
    is_active: true,
  },
  {
    gate_id: 'gate_4',
    venue_id: 'stadiumA',
    name: 'East Gate 4',
    zone: 'entry',
    location_lat: 40.8128,
    location_lng: -74.0722,
    throughput_per_min: 42,
    max_queue_length: 750,
    processing_time_sec: 11,
    crowd_slowdown_factor: 0.84,
    is_active: true,
  },
  {
    gate_id: 'gate_5',
    venue_id: 'stadiumA',
    name: 'South Gate 5',
    zone: 'entry',
    location_lat: 40.8108,
    location_lng: -74.0742,
    throughput_per_min: 46,
    max_queue_length: 850,
    processing_time_sec: 9,
    crowd_slowdown_factor: 0.86,
    is_active: true,
  },
  {
    gate_id: 'gate_6',
    venue_id: 'stadiumA',
    name: 'South Gate 6',
    zone: 'entry',
    location_lat: 40.8108,
    location_lng: -74.0752,
    throughput_per_min: 40,
    max_queue_length: 700,
    processing_time_sec: 10,
    crowd_slowdown_factor: 0.83,
    is_active: true,
  },
  {
    gate_id: 'gate_7',
    venue_id: 'stadiumA',
    name: 'West Gate 7',
    zone: 'entry',
    location_lat: 40.8118,
    location_lng: -74.0762,
    throughput_per_min: 48,
    max_queue_length: 900,
    processing_time_sec: 9,
    crowd_slowdown_factor: 0.87,
    is_active: true,
  },
  {
    gate_id: 'gate_8',
    venue_id: 'stadiumA',
    name: 'West Gate 8',
    zone: 'entry',
    location_lat: 40.8128,
    location_lng: -74.0762,
    throughput_per_min: 36,
    max_queue_length: 550,
    processing_time_sec: 13,
    crowd_slowdown_factor: 0.8,
    is_active: true,
  },
];

const mockEvents = [
  {
    event_id: 'fifa26_final',
    venue_id: 'stadiumA',
    name: 'FIFA 2026 Final',
    scheduled_start: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
    expected_attendance: 82500,
  },
];

const mockQueueObservations: Record<
  string,
  {
    observed_queue_count: number;
    observation_source: string;
    confidence: number;
    created_at: string;
  }[]
> = {};

// Initialize queue history with random fluctuating values
mockGates.forEach((g) => {
  let baseQueue = Math.floor(g.max_queue_length * (0.1 + Math.random() * 0.5));
  mockQueueObservations[g.gate_id] = Array.from({ length: 10 }, (_, i) => {
    // Add some random variation
    baseQueue = Math.max(10, baseQueue + Math.floor((Math.random() - 0.5) * 20));
    return {
      observed_queue_count: baseQueue,
      observation_source: 'sensor',
      confidence: 0.9 + Math.random() * 0.08,
      created_at: new Date(Date.now() - i * 10000).toISOString(),
    };
  });
});

const mockNudges: Record<string, unknown>[] = [];
const mockConfirmations: Record<string, unknown>[] = [];
const mockFeedback: Record<string, unknown>[] = [];
const mockOpsActions: Record<string, unknown>[] = [];
const mockWaitEstimates: Record<string, unknown>[] = [];

// Periodically update queue counts randomly to simulate active sensor data stream
setInterval(() => {
  mockGates.forEach((g) => {
    const list = mockQueueObservations[g.gate_id];
    const latest = list[0].observed_queue_count;
    // Walk queue up or down slightly
    const change = Math.floor((Math.random() - 0.5) * 14);
    const newVal = Math.max(10, Math.min(g.max_queue_length, latest + change));
    list.unshift({
      observed_queue_count: newVal,
      observation_source: 'sensor',
      confidence: 0.9 + Math.random() * 0.08,
      created_at: new Date().toISOString(),
    });
    if (list.length > 20) list.pop();
  });
}, 10000);

function simulateQuery(
  text: string,
  params: unknown[] = [],
): { rows: Record<string, unknown>[]; rowCount: number } {
  const normText = text.replace(/\s+/g, ' ').trim();

  // SELECT NOW()
  if (normText.startsWith('SELECT NOW()')) {
    return { rows: [{ now: new Date().toISOString() }], rowCount: 1 };
  }

  // SELECT gate_id FROM gates WHERE venue_id = $1 AND is_active = true
  if (normText.includes('FROM gates WHERE venue_id = $1 AND is_active = true')) {
    const rows = mockGates
      .filter((g) => g.venue_id === params[0] && g.is_active)
      .map((g) => ({ gate_id: g.gate_id }));
    return { rows, rowCount: rows.length };
  }

  // SELECT gate_id, throughput_per_min... FROM gates WHERE gate_id = $1
  if (normText.includes('FROM gates WHERE gate_id = $1')) {
    const rows = mockGates.filter((g) => g.gate_id === params[0]);
    return { rows, rowCount: rows.length };
  }

  // SELECT observed_queue_count... FROM queue_observations WHERE gate_id = $1 ORDER BY created_at DESC LIMIT 10
  if (normText.includes('FROM queue_observations WHERE gate_id = $1')) {
    const obs = mockQueueObservations[params[0] as string] || [];
    return { rows: obs.slice(0, 10), rowCount: Math.min(obs.length, 10) };
  }

  // SELECT scheduled_start FROM events WHERE scheduled_start > NOW()
  if (normText.includes('FROM events WHERE scheduled_start > NOW()')) {
    return { rows: mockEvents, rowCount: mockEvents.length };
  }

  // SELECT gate_id, location_lat, location_lng FROM gates WHERE is_active = true
  if (
    normText.includes(
      'SELECT gate_id, location_lat, location_lng FROM gates WHERE is_active = true',
    )
  ) {
    const rows = mockGates
      .filter((g) => g.is_active)
      .map((g) => ({
        gate_id: g.gate_id,
        location_lat: g.location_lat,
        location_lng: g.location_lng,
      }));
    return { rows, rowCount: rows.length };
  }

  // SELECT gate_id, name, location_lat, location_lng FROM gates WHERE gate_id IN ($1, $2)
  if (normText.includes('FROM gates WHERE gate_id IN ($1, $2)')) {
    const rows = mockGates.filter((g) => params.includes(g.gate_id));
    return { rows, rowCount: rows.length };
  }

  // SELECT * FROM gates WHERE is_active = true ORDER BY gate_id
  if (normText.includes('SELECT * FROM gates WHERE is_active = true')) {
    return { rows: mockGates, rowCount: mockGates.length };
  }

  // INSERT INTO wait_time_estimates
  if (normText.startsWith('INSERT INTO wait_time_estimates')) {
    const record = {
      gate_id: params[0],
      estimated_wait_min: params[1],
      queue_count: params[2],
      confidence: params[3],
      created_at: new Date().toISOString(),
    };
    mockWaitEstimates.push(record);
    return { rows: [record], rowCount: 1 };
  }

  // INSERT INTO nudges ... RETURNING *
  if (normText.startsWith('INSERT INTO nudges')) {
    const record = {
      id: mockNudges.length + 1,
      nudge_id: params[0],
      user_id: params[1],
      current_gate_id: params[2],
      recommended_gate_id: params[3],
      wait_time_current_min: params[4],
      wait_time_recommended_min: params[5],
      time_saved_min: params[6],
      forecast_confidence: params[7],
      created_at: new Date(),
    };
    mockNudges.push(record);
    return { rows: [record], rowCount: 1 };
  }

  // INSERT INTO confirmations
  if (normText.startsWith('INSERT INTO confirmations')) {
    const record = {
      confirmation_id: params[0],
      entry_token: params[1],
      nudge_id: params[2],
      user_id: params[3],
      confirmed_gate_id: params[4],
      predicted_wait_min: params[5],
      expires_at: params[6],
      created_at: new Date(),
    };
    mockConfirmations.push(record);
    return { rows: [record], rowCount: 1 };
  }

  // INSERT INTO feedback
  if (normText.startsWith('INSERT INTO feedback')) {
    const record = {
      feedback_id: params[0],
      entry_token: params[1],
      actual_wait_min: params[2],
      predictions_accurate: params[3],
      experience: params[4],
      created_at: new Date(),
    };
    mockFeedback.push(record);
    return { rows: [record], rowCount: 1 };
  }

  // INSERT INTO ops_actions
  if (normText.startsWith('INSERT INTO ops_actions')) {
    const record = {
      action_id: params[0],
      action: params[1],
      gate_id: params[2],
      duration_min: params[3],
      created_at: new Date(),
    };
    mockOpsActions.push(record);
    return { rows: [record], rowCount: 1 };
  }

  // SELECT FROM journey_complete / conversion_funnel / outcome metrics
  if (normText.includes('FROM nudges n LEFT JOIN nudge_interactions')) {
    // Return aggregated outcome summary
    const countNudges = mockNudges.length;
    const countConfirmations = mockConfirmations.length;
    return {
      rows: [
        {
          nudges_sent: countNudges,
          nudge_engagements: Math.round(countNudges * 0.45),
          confirmations: countConfirmations,
          entries_matched: Math.round(countConfirmations * 0.9),
          forecast_mape_pct: 12.4,
          avg_time_saved_min: 4.8,
        },
      ],
      rowCount: 1,
    };
  }

  if (normText.includes('FROM conversion_funnel')) {
    return {
      rows: [
        {
          event_date: new Date().toISOString().split('T')[0],
          nudges_sent: mockNudges.length || 120,
          nudge_engagements: Math.round((mockNudges.length || 120) * 0.45),
          confirmations: mockConfirmations.length || 45,
          gate_entries: Math.round((mockConfirmations.length || 45) * 0.9),
        },
      ],
      rowCount: 1,
    };
  }

  return { rows: [], rowCount: 0 };
}

export async function initializeDatabase(): Promise<void> {
  try {
    const poolConfig: PoolConfig = env.DATABASE_URL
      ? { connectionString: env.DATABASE_URL }
      : {
          host: env.DB_HOST,
          port: env.DB_PORT,
          database: env.DB_NAME,
          user: env.DB_USER,
          password: env.DB_PASSWORD,
        };

    // Most hosted PostgreSQL services require TLS. Keep certificate
    // verification relaxed for compatibility with provider-issued URLs.
    if (env.DB_SSL) {
      poolConfig.ssl = { rejectUnauthorized: false };
    }

    pool = new Pool({
      ...poolConfig,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      logger.error({ err }, 'Unexpected error on idle database client');
    });

    // Test connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    logger.info('✓ Connected to PostgreSQL');
  } catch {
    logger.warn(
      'PostgreSQL database connection failed — falling back to in-memory Mock Database mode',
    );
    useMockDb = true;
  }
}

export const db = {
  query: (text: string, params?: unknown[]) => {
    if (useMockDb) {
      return Promise.resolve(simulateQuery(text, params));
    }
    if (!pool) throw new Error('Database not initialized. Call initializeDatabase() first.');
    return pool.query(text, params);
  },

  transaction: async <T>(callback: (client: PoolClient) => Promise<T>): Promise<T> => {
    if (useMockDb) {
      const mockClient = {
        query: (text: string, params?: unknown[]) => Promise.resolve(simulateQuery(text, params)),
      } as unknown as PoolClient;
      return callback(mockClient);
    }
    if (!pool) throw new Error('Database not initialized.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (_error) {
      await client.query('ROLLBACK');
      throw _error;
    } finally {
      client.release();
    }
  },

  end: () => {
    if (pool) return pool.end();
    return Promise.resolve();
  },
};
