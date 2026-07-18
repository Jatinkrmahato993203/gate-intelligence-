"use strict";
// ============================================================================
// Real-Time Wait Time Broadcasting — Every 30 Seconds
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWaitTimeBroadcast = startWaitTimeBroadcast;
exports.stopWaitTimeBroadcast = stopWaitTimeBroadcast;
const wait_time_service_1 = require("../services/wait-time.service");
const handlers_1 = require("../websocket/handlers");
const logging_1 = require("../middleware/logging");
const env_1 = require("../config/env");
let broadcastInterval = null;
function startWaitTimeBroadcast() {
    const venueId = env_1.env.DEFAULT_VENUE_ID;
    broadcastInterval = setInterval(async () => {
        try {
            const waitTimes = await wait_time_service_1.WaitTimeService.getAllWaitTimes(venueId);
            (0, handlers_1.broadcastWaitTimes)(waitTimes);
        }
        catch (error) {
            logging_1.logger.error({ error }, 'Wait time broadcast failed');
        }
    }, 30000); // Every 30 seconds
    logging_1.logger.info(`Scheduled: wait time broadcast every 30s for venue ${venueId}`);
}
function stopWaitTimeBroadcast() {
    if (broadcastInterval) {
        clearInterval(broadcastInterval);
        broadcastInterval = null;
    }
}
//# sourceMappingURL=broadcast.js.map