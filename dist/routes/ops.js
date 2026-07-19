"use strict";
// ============================================================================
// Ops Console API Endpoints
// ============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const joi_1 = __importDefault(require("joi"));
const wait_time_service_1 = require("../services/wait-time.service");
const outcome_service_1 = require("../services/outcome.service");
const ops_service_1 = require("../services/ops.service");
const asyncHandler_1 = require("../middleware/asyncHandler");
const validate_1 = require("../middleware/validate");
const router = (0, express_1.Router)();
/**
 * Validation Schemas
 */
const waitTimesSchema = joi_1.default.object({
    venue_id: joi_1.default.string().optional(),
});
const dashboardSchema = joi_1.default.object({
    event_date: joi_1.default.string().optional(),
});
const funnelSchema = joi_1.default.object({
    event_id: joi_1.default.string().optional(),
});
const actionSchema = joi_1.default.object({
    action: joi_1.default.string().required(),
    gate_id: joi_1.default.string().required(),
    duration_min: joi_1.default.number().optional(),
});
/**
 * GET /api/ops/wait-times
 * Get current wait times for all gates at a venue.
 */
router.get('/wait-times', (0, validate_1.validate)(waitTimesSchema, 'query'), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const venueId = req.query.venue_id || process.env.DEFAULT_VENUE_ID || 'stadiumA';
    const waitTimes = await wait_time_service_1.WaitTimeService.getAllWaitTimes(venueId);
    res.json(waitTimes);
}));
/**
 * GET /api/ops/dashboard
 * Get outcome metrics for the ops dashboard.
 */
router.get('/dashboard', (0, validate_1.validate)(dashboardSchema, 'query'), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const eventDate = req.query.event_date;
    const metrics = await outcome_service_1.OutcomeService.getDailyMetrics(eventDate);
    res.json(metrics);
}));
/**
 * GET /api/ops/funnel
 * Get conversion funnel data.
 */
router.get('/funnel', (0, validate_1.validate)(funnelSchema, 'query'), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const eventId = req.query.event_id;
    const funnel = await outcome_service_1.OutcomeService.getConversionFunnel(eventId);
    res.json(funnel);
}));
/**
 * POST /api/ops/action
 * Log an ops action (close gate, deploy staff, slow entry, etc.).
 */
router.post('/action', (0, validate_1.validate)(actionSchema, 'body'), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { action, gate_id, duration_min } = req.body;
    await ops_service_1.OpsService.logAction(action, gate_id, duration_min);
    res.json({ success: true, action, gate_id });
}));
exports.default = router;
//# sourceMappingURL=ops.js.map