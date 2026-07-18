"use strict";
// ============================================================================
// WebSocket Event Handlers & Connection Management
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.addConnection = addConnection;
exports.removeConnection = removeConnection;
exports.handleWebSocketMessage = handleWebSocketMessage;
exports.broadcastWaitTimes = broadcastWaitTimes;
exports.broadcastEvent = broadcastEvent;
exports.getConnectionCount = getConnectionCount;
const ws_1 = require("ws");
const logging_1 = require("../middleware/logging");
const connections = new Set();
function addConnection(ws) {
    connections.add(ws);
    logging_1.logger.info(`WebSocket connected. Total: ${connections.size}`);
}
function removeConnection(ws) {
    connections.delete(ws);
    logging_1.logger.info(`WebSocket disconnected. Total: ${connections.size}`);
}
async function handleWebSocketMessage(ws, data) {
    try {
        const message = JSON.parse(data.toString());
        const { type, payload } = message;
        switch (type) {
            case 'subscribe':
                ws.send(JSON.stringify({
                    type: 'subscribed',
                    channel: payload?.channel || 'wait_times',
                    timestamp: new Date().toISOString(),
                }));
                break;
            case 'ping':
                ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
                break;
            default:
                logging_1.logger.warn({ type }, 'Unknown WebSocket message type');
        }
    }
    catch (error) {
        logging_1.logger.error({ error }, 'WebSocket message parse error');
    }
}
function broadcastWaitTimes(waitTimes) {
    const message = JSON.stringify({
        type: 'wait_times_updated',
        data: waitTimes,
        timestamp: new Date().toISOString(),
    });
    let sent = 0;
    connections.forEach((ws) => {
        if (ws.readyState === ws_1.WebSocket.OPEN) {
            ws.send(message);
            sent++;
        }
        else {
            connections.delete(ws);
        }
    });
    if (sent > 0) {
        logging_1.logger.debug(`Broadcast wait times to ${sent} clients`);
    }
}
function broadcastEvent(eventType, payload) {
    const message = JSON.stringify({
        type: eventType,
        data: payload,
        timestamp: new Date().toISOString(),
    });
    connections.forEach((ws) => {
        if (ws.readyState === ws_1.WebSocket.OPEN) {
            ws.send(message);
        }
    });
}
function getConnectionCount() {
    return connections.size;
}
//# sourceMappingURL=handlers.js.map