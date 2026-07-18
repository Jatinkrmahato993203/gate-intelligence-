"use strict";
// ============================================================================
// Ops Console API Endpoints
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const wait_time_service_1 = require("../services/wait-time.service");
const outcome_service_1 = require("../services/outcome.service");
const database_1 = require("../config/database");
const logging_1 = require("../middleware/logging");
const handlers_1 = require("../websocket/handlers");
const router = (0, express_1.Router)();
/**
 * GET /api/ops/wait-times
 * Get current wait times for all gates at a venue.
 */
router.get('/wait-times', async (req, res) => {
    try {
        const venueId = req.query.venue_id || process.env.DEFAULT_VENUE_ID || 'stadiumA';
        const waitTimes = await wait_time_service_1.WaitTimeService.getAllWaitTimes(venueId);
        res.json(waitTimes);
    }
    catch (error) {
        logging_1.logger.error({ error }, 'GET /api/ops/wait-times failed');
        res.status(500).json({ error: String(error) });
    }
});
/**
 * GET /api/ops/dashboard
 * Get outcome metrics for the ops dashboard.
 */
router.get('/dashboard', async (req, res) => {
    try {
        const eventDate = req.query.event_date;
        const metrics = await outcome_service_1.OutcomeService.getDailyMetrics(eventDate);
        res.json(metrics);
    }
    catch (error) {
        logging_1.logger.error({ error }, 'GET /api/ops/dashboard failed');
        res.status(500).json({ error: String(error) });
    }
});
/**
 * GET /api/ops/funnel
 * Get conversion funnel data.
 */
router.get('/funnel', async (req, res) => {
    try {
        const eventId = req.query.event_id;
        const funnel = await outcome_service_1.OutcomeService.getConversionFunnel(eventId);
        res.json(funnel);
    }
    catch (error) {
        logging_1.logger.error({ error }, 'GET /api/ops/funnel failed');
        res.status(500).json({ error: String(error) });
    }
});
/**
 * POST /api/ops/action
 * Log an ops action (close gate, deploy staff, slow entry, etc.).
 */
router.post('/action', async (req, res) => {
    try {
        const { action, gate_id, duration_min } = req.body;
        if (!action || !gate_id) {
            res.status(400).json({ error: 'Missing action or gate_id' });
            return;
        }
        await database_1.db.query(`INSERT INTO ops_actions (action_id, action, gate_id, duration_min, created_at)
       VALUES ($1, $2, $3, $4, NOW())`, [`act_${Date.now()}`, action, gate_id, duration_min || null]);
        // Broadcast to all connected WebSocket clients
        (0, handlers_1.broadcastEvent)('ops_action', { action, gate_id, duration_min });
        res.json({ success: true, action, gate_id });
    }
    catch (error) {
        logging_1.logger.error({ error }, 'POST /api/ops/action failed');
        res.status(500).json({ error: String(error) });
    }
});
exports.default = router;
//# sourceMappingURL=ops.js.map