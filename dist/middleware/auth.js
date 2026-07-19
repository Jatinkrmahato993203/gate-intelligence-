"use strict";
// ============================================================================
// API Authentication Middleware
// ============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAuth = validateAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const env_1 = require("../config/env");
function validateAuth(req, res, next) {
    // Bypass auth in development / demo mode
    if (!env_1.env.REQUIRE_AUTH) {
        return next();
    }
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'];
    if (!authHeader && !apiKey) {
        res.status(401).json({
            error: 'Unauthorized — provide Authorization header or X-API-Key',
        });
        return;
    }
    // API key validation (Timing safe comparison)
    if (apiKey) {
        const expectedKey = env_1.env.API_KEY || '';
        if (expectedKey.length > 0 &&
            apiKey.length === expectedKey.length &&
            crypto_1.default.timingSafeEqual(Buffer.from(apiKey), Buffer.from(expectedKey))) {
            return next();
        }
    }
    // Bearer token validation with JWT
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
            // Verify JWT token signature
            const decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET || '');
            // Can attach decoded token to req.user here if needed
            req.user = decoded;
            return next();
        }
        catch (err) {
            res.status(401).json({ error: 'Unauthorized — invalid or expired token' });
            return;
        }
    }
    res.status(403).json({ error: 'Forbidden — invalid credentials' });
}
//# sourceMappingURL=auth.js.map