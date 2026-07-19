require('dotenv').config();
const http = require('http');
const { Client } = require('pg');

const jwt = require('jsonwebtoken');

const baseURL = 'http://localhost:3000/api';
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
});

const token = jwt.sign({ user_id: 'simulator', role: 'fan' }, process.env.JWT_SECRET || 'default-dev-jwt-secret');

async function fetchAPI(endpoint, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseURL + endpoint);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
             resolve(JSON.parse(data));
          } else {
             reject(new Error(`API Error ${res.statusCode}: ${data}`));
          }
        } catch (e) {
          resolve(data);
        }
      });
    });
    
    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function makeGateBusy(gateId) {
  console.log(`Setting ${gateId} to be very busy...`);
  await client.query(`
    INSERT INTO queue_observations (gate_id, observed_queue_count, observation_source, confidence, created_at)
    VALUES ($1, 500, 'manual', 1.0, NOW())
  `, [gateId]);
  
  // Make gate 2 very fast
  await client.query(`
    INSERT INTO queue_observations (gate_id, observed_queue_count, observation_source, confidence, created_at)
    VALUES ($1, 5, 'manual', 1.0, NOW())
  `, ['gate_2']);
}

async function simulateFan(fanId) {
  console.log(`\n--- Simulating Fan ${fanId} ---`);
  try {
    const user_id = `fan_${Date.now()}_${fanId}`;
    const current_gate = 'gate_1';
    
    // 1. Get a nudge via API
    console.log(`1. Requesting nudge via API...`);
    const nudge = await fetchAPI(`/fans/nudge?user_id=${user_id}&current_gate_id=${current_gate}&lat=40.8148&lng=-74.0742`);
    
    if (nudge.error) {
      console.log(`   No nudge generated: ${nudge.error}`);
      return;
    }
    console.log(`   Received nudge. ID: ${nudge.nudge_id}, Rec Gate: ${nudge.recommended_gate_id}`);
    
    // 1.1 Direct DB: Nudge Interaction
    await client.query(`
      INSERT INTO nudge_interactions (nudge_id, action, action_at)
      VALUES ((SELECT id FROM nudges WHERE nudge_id = $1 LIMIT 1), 'tapped_route', NOW())
    `, [nudge.nudge_id]);
    
    // 2. Select route via API
    console.log(`2. Calculating route via API...`);
    const route = await fetchAPI(`/fans/route`, 'POST', {
      from_gate_id: current_gate,
      to_gate_id: nudge.recommended_gate_id
    });
    
    // 2.1 Direct DB: Route Decision
    const decision_id = `decision_${Date.now()}_${fanId}`;
    await client.query(`
      INSERT INTO route_decisions (decision_id, nudge_id, user_id, selected_gate_id, reason)
      VALUES ($1, (SELECT id FROM nudges WHERE nudge_id = $2 LIMIT 1), $3, $4, 'recommended')
    `, [decision_id, nudge.nudge_id, user_id, nudge.recommended_gate_id]);
    
    // 3. Confirm decision via API
    console.log(`3. Confirming decision via API...`);
    const confirmation = await fetchAPI(`/fans/confirm`, 'POST', {
      nudge_id: nudge.nudge_id,
      user_id: user_id,
      selected_gate_id: nudge.recommended_gate_id,
      predicted_wait_min: route.eta_minutes || 5
    });
    console.log(`   Received entry token: ${confirmation.entry_token}`);
    
    // 3.1 Direct DB: Link route decision to confirmation
    await client.query(`
      UPDATE confirmations 
      SET route_decision_id = (SELECT id FROM route_decisions WHERE decision_id = $1 LIMIT 1)
      WHERE entry_token = $2
    `, [decision_id, confirmation.entry_token]);

    // 4. Direct DB: Simulate Gate Scan (Turnstile hardware simulation)
    console.log(`4. Simulating physical gate scan (Direct DB Insert)...`);
    const scanId = `scan_${Date.now()}_${fanId}`;
    await client.query(`
      INSERT INTO gate_entries (scan_id, gate_id, entry_token, scanned_at, wait_time_actual_min)
      VALUES ($1, $2, $3, NOW(), $4)
    `, [scanId, nudge.recommended_gate_id, confirmation.entry_token, Math.floor(Math.random() * 5) + 1]);
    
    // 5. Submit feedback via API
    console.log(`5. Submitting feedback via API...`);
    await fetchAPI(`/fans/feedback`, 'POST', {
      entry_token: confirmation.entry_token,
      actual_wait_min: Math.floor(Math.random() * 5) + 1,
      predictions_accurate: true,
      experience: 5
    });
    console.log(`   Feedback submitted.`);
    
  } catch (err) {
    console.error(`Fan ${fanId} Simulation Failed:`, err.message);
  }
}

async function run() {
  console.log("Starting Fan Journey Simulation (API + Direct DB)...");
  await client.connect();
  
  await makeGateBusy('gate_1');
  
  for(let i=1; i<=15; i++) {
    await simulateFan(i);
    await new Promise(r => setTimeout(r, 500));
  }
  
  await client.end();
  console.log("\nSimulation Complete! Your tables are now populated.");
  process.exit(0);
}

run();
