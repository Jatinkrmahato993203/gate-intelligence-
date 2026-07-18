"use strict";
// ============================================================================
// Gate Management API Endpoints
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const logging_1 = require("../middleware/logging");
const router = (0, express_1.Router)();
/**
 * GET /api/gates
 * Get all active gates.
 */
router.get('/', async (_req, res) => {
    try {
        const result = await database_1.db.query(`SELECT * FROM gates WHERE is_active = true ORDER BY gate_id`);
        res.json({ gates: result.rows, count: result.rowCount });
    }
    catch (error) {
        logging_1.logger.error({ error }, 'GET /api/gates failed');
        res.status(500).json({ error: String(error) });
    }
});
/**
 * GET /api/gates/:id
 * Get single gate details.
 */
router.get('/:id', async (req, res) => {
    try {
        const result = await database_1.db.query(`SELECT * FROM gates WHERE gate_id = $1`, [req.params.id]);
        if (!result.rows.length) {
            res.status(404).json({ error: 'Gate not found' });
            return;
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        logging_1.logger.error({ error }, 'GET /api/gates/:id failed');
        res.status(500).json({ error: String(error) });
    }
});
exports.default = router;
//# sourceMappingURL=gates.js.map