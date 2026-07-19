"use strict";
// ============================================================================
// Fan App API Endpoints
// ============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const joi_1 = __importDefault(require("joi"));
const nudge_service_1 = require("../services/nudge.service");
const route_service_1 = require("../services/route.service");
const fan_service_1 = require("../services/fan.service");
const asyncHandler_1 = require("../middleware/asyncHandler");
const validate_1 = require("../middleware/validate");
const router = (0, express_1.Router)();
/**
 * Validation Schemas
 */
const nudgeSchema = joi_1.default.object({
    user_id: joi_1.default.string().required(),
    current_gate_id: joi_1.default.string().required(),
    lat: joi_1.default.number().required(),
    lng: joi_1.default.number().required(),
});
const routeSchema = joi_1.default.object({
    from_gate_id: joi_1.default.string().required(),
    to_gate_id: joi_1.default.string().required(),
});
const confirmSchema = joi_1.default.object({
    nudge_id: joi_1.default.string().required(),
    user_id: joi_1.default.string().required(),
    selected_gate_id: joi_1.default.string().required(),
    predicted_wait_min: joi_1.default.number().optional(),
});
const feedbackSchema = joi_1.default.object({
    entry_token: joi_1.default.string().required(),
    actual_wait_min: joi_1.default.number().optional(),
    predictions_accurate: joi_1.default.boolean().optional(),
    experience: joi_1.default.number().optional(),
});
/**
 * GET /api/fans/nudge
 * Get nudge recommendation for a fan at a specific location.
 */
router.get('/nudge', (0, validate_1.validate)(nudgeSchema, 'query'), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { user_id, current_gate_id, lat, lng } = req.query;
    const nudge = await nudge_service_1.NudgeService.generateNudge(user_id, current_gate_id, lat, lng);
    res.json(nudge);
}));
/**
 * POST /api/fans/route
 * Calculate route from one gate to another.
 */
router.post('/route', (0, validate_1.validate)(routeSchema, 'body'), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { from_gate_id, to_gate_id } = req.body;
    const route = await route_service_1.RouteService.calculateRoute(from_gate_id, to_gate_id);
    res.json(route);
}));
/**
 * POST /api/fans/confirm
 * Confirm nudge acceptance and issue entry token.
 */
router.post('/confirm', (0, validate_1.validate)(confirmSchema, 'body'), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { nudge_id, user_id, selected_gate_id, predicted_wait_min } = req.body;
    const result = await fan_service_1.FanService.confirmNudge(nudge_id, user_id, selected_gate_id, predicted_wait_min);
    res.json(result);
}));
/**
 * POST /api/fans/feedback
 * Submit feedback and calibration data.
 */
router.post('/feedback', (0, validate_1.validate)(feedbackSchema, 'body'), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { entry_token, actual_wait_min, predictions_accurate, experience } = req.body;
    await fan_service_1.FanService.submitFeedback(entry_token, actual_wait_min, predictions_accurate, experience);
    res.json({ success: true, message: 'Thank you for your feedback!' });
}));
exports.default = router;
//# sourceMappingURL=fans.js.map