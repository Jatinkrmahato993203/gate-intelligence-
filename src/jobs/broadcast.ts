// ============================================================================
// Real-Time Wait Time Broadcasting — Every 30 Seconds
// ============================================================================

import { WaitTimeService } from '../services/wait-time.service';
import { broadcastWaitTimes } from '../websocket/handlers';
import { logger } from '../middleware/logging';
import { env } from '../config/env';

let broadcastInterval: ReturnType<typeof setInterval> | null = null;

export function startWaitTimeBroadcast(): void {
  const venueId = env.DEFAULT_VENUE_ID;

  broadcastInterval = setInterval(async () => {
    try {
      const waitTimes = await WaitTimeService.getAllWaitTimes(venueId);
      broadcastWaitTimes(waitTimes);
    } catch (error) {
      logger.error({ error }, 'Wait time broadcast failed');
    }
  }, 30000); // Every 30 seconds

  logger.info(`Scheduled: wait time broadcast every 30s for venue ${venueId}`);
}

export function stopWaitTimeBroadcast(): void {
  if (broadcastInterval) {
    clearInterval(broadcastInterval);
    broadcastInterval = null;
  }
}
