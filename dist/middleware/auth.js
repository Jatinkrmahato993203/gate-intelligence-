"use strict";
// ============================================================================
// API Authentication Middleware
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAuth = validateAuth;
function validateAuth(req, res, next) {
    // Bypass auth in development / demo mode
    if (!process.env.REQUIRE_AUTH || process.env.REQUIRE_AUTH === 'false') {
        return next();
    }
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'];
    if (!authHeader && !apiKey) {
        res.status(401).json({ error: 'Unauthorized — provide Authorization header or X-API-Key' });
        return;
    }
    // API key validation
    if (apiKey && apiKey === process.env.JWT_SECRET) {
        return next();
    }
    // Bearer token validation (placeholder — extend with JWT verification)
    if (authHeader?.startsWith('Bearer ')) {
        // In production, verify the JWT here
        return next();
    }
    res.status(403).json({ error: 'Forbidden — invalid credentials' });
}
//# sourceMappingURL=auth.js.map