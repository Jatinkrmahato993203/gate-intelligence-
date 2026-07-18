"use strict";
// ============================================================================
// Request Logging with Pino
// ============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = exports.logger = void 0;
const pino_1 = __importDefault(require("pino"));
const pino_http_1 = __importDefault(require("pino-http"));
exports.logger = (0, pino_1.default)({
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV !== 'production'
        ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                singleLine: false,
            },
        }
        : undefined,
});
exports.requestLogger = (0, pino_http_1.default)({
    logger: exports.logger,
    autoLogging: {
        ignore: (req) => (req.url === '/api/health'),
    },
});
//# sourceMappingURL=logging.js.map