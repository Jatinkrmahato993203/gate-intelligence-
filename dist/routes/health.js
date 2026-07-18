"use strict";
// ============================================================================
// Health Check Route
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const handlers_1 = require("../websocket/handlers");
const router = (0, express_1.Router)();
router.get('/', async (_req, res) => {
    try {
        const dbCheck = await database_1.db.query('SELECT NOW() as now');
        res.json({
            service: 'FIFA 26 Gate Intelligence',
            version: '1.0.0',
            status: 'operational',
            uptime: Math.round(process.uptime()),
            websocket_clients: (0, handlers_1.getConnectionCount)(),
            db_time: dbCheck.rows[0].now,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        res.status(503).json({
            service: 'FIFA 26 Gate Intelligence',
            status: 'degraded',
            error: String(error),
            timestamp: new Date().toISOString(),
        });
    }
});
exports.default = router;
//# sourceMappingURL=health.js.map