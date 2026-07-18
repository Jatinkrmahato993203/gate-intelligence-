"use strict";
// ============================================================================
// Fan App API Endpoints
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const nudge_service_1 = require("../services/nudge.service");
const route_service_1 = require("../services/route.service");
const database_1 = require("../config/database");
const logging_1 = require("../middleware/logging");
const router = (0, express_1.Router)();
/**
 * GET /api/fans/nudge
 * Get nudge recommendation for a fan at a specific location.
 */
router.get('/nudge', async (req, res) => {
    try {
        const { user_id, current_gate_id, lat, lng } = req.query;
        if (!user_id || !current_gate_id || !lat || !lng) {
            res.status(400).json({ error: 'Missing required parameters: user_id, current_gate_id, lat, lng' });
            return;
        }
        const nudge = await nudge_service_1.NudgeService.generateNudge(user_id, current_gate_id, parseFloat(lat), parseFloat(lng));
        res.json(nudge);
    }
    catch (error) {
        logging_1.logger.error({ error }, 'GET /api/fans/nudge failed');
        res.status(500).json({ error: String(error) });
    }
});
/**
 * POST /api/fans/route
 * Calculate route from one gate to another.
 */
router.post('/route', async (req, res) => {
    try {
        const { from_gate_id, to_gate_id } = req.body;
        if (!from_gate_id || !to_gate_id) {
            res.status(400).json({ error: 'Missing gate IDs: from_gate_id, to_gate_id' });
            return;
        }
        const route = await route_service_1.RouteService.calculateRoute(from_gate_id, to_gate_id);
        res.json(route);
    }
    catch (error) {
        logging_1.logger.error({ error }, 'POST /api/fans/route failed');
        res.status(500).json({ error: String(error) });
    }
});
/**
 * POST /api/fans/confirm
 * Confirm nudge acceptance and issue entry token.
 */
router.post('/confirm', async (req, res) => {
    try {
        const { nudge_id, user_id, selected_gate_id, predicted_wait_min } = req.body;
        if (!nudge_id || !user_id || !selected_gate_id) {
            res.status(400).json({ error: 'Missing required fields: nudge_id, user_id, selected_gate_id' });
            return;
        }
        const entryToken = `entr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const expiresAt = new Date(Date.now() + 20 * 60000); // 20-minute expiry
        await database_1.db.query(`INSERT INTO confirmations
       (confirmation_id, entry_token, nudge_id, user_id, confirmed_gate_id, predicted_wait_min, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
            `conf_${Date.now()}`,
            entryToken,
            nudge_id,
            user_id,
            selected_gate_id,
            predicted_wait_min || 0,
            expiresAt,
        ]);
        res.json({
            entry_token: entryToken,
            expires_at: expiresAt.toISOString(),
            expires_in_minutes: 20,
        });
    }
    catch (error) {
        logging_1.logger.error({ error }, 'POST /api/fans/confirm failed');
        res.status(500).json({ error: String(error) });
    }
});
/**
 * POST /api/fans/feedback
 * Submit feedback and calibration data.
 */
router.post('/feedback', async (req, res) => {
    try {
        const { entry_token, actual_wait_min, predictions_accurate, experience } = req.body;
        if (!entry_token) {
            res.status(400).json({ error: 'Missing entry_token' });
            return;
        }
        await database_1.db.query(`INSERT INTO feedback
       (feedback_id, entry_token, actual_wait_min, predictions_accurate, experience, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`, [
            `fbk_${Date.now()}`,
            entry_token,
            actual_wait_min || null,
            predictions_accurate ?? null,
            experience || null,
        ]);
        res.json({ success: true, message: 'Thank you for your feedback!' });
    }
    catch (error) {
        logging_1.logger.error({ error }, 'POST /api/fans/feedback failed');
        res.status(500).json({ error: String(error) });
    }
});
exports.default = router;
//# sourceMappingURL=fans.js.map