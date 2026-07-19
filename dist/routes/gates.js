"use strict";
// ============================================================================
// Gate Management API Endpoints
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const gate_service_1 = require("../services/gate.service");
const asyncHandler_1 = require("../middleware/asyncHandler");
const router = (0, express_1.Router)();
/**
 * GET /api/gates
 * Get all active gates.
 */
router.get('/', (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const result = await gate_service_1.GateService.getActiveGates();
    res.json(result);
}));
/**
 * GET /api/gates/:id
 * Get single gate details.
 */
router.get('/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const gate = await gate_service_1.GateService.getGateById(req.params.id);
    if (!gate) {
        res.status(404).json({ error: 'Gate not found' });
        return;
    }
    res.json(gate);
}));
exports.default = router;
//# sourceMappingURL=gates.js.map