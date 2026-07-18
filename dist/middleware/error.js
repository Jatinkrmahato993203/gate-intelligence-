"use strict";
// ============================================================================
// Global Error Handler
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const logging_1 = require("./logging");
function errorHandler(error, req, res, _next) {
    logging_1.logger.error({
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method,
    });
    const status = error.status || error.statusCode || 500;
    const message = error.message || 'Internal Server Error';
    res.status(status).json({
        error: message,
        path: req.path,
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
}
//# sourceMappingURL=error.js.map