// ============================================================================
// WebSocket Event Handlers & Connection Management
// ============================================================================

import { WebSocket } from 'ws';
import { logger } from '../middleware/logging';
import { WaitTimeResult } from '../types';

const connections = new Set<WebSocket>();

export function addConnection(ws: WebSocket): void {
  connections.add(ws);
  logger.info(`WebSocket connected. Total: ${connections.size}`);
}

export function removeConnection(ws: WebSocket): void {
  connections.delete(ws);
  logger.info(`WebSocket disconnected. Total: ${connections.size}`);
}

export async function handleWebSocketMessage(ws: WebSocket, data: Buffer): Promise<void> {
  try {
    const message = JSON.parse(data.toString());
    const { type, payload } = message;

    switch (type) {
      case 'subscribe':
        ws.send(
          JSON.stringify({
            type: 'subscribed',
            channel: payload?.channel || 'wait_times',
            timestamp: new Date().toISOString(),
          })
        );
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        break;

      default:
        logger.warn({ type }, 'Unknown WebSocket message type');
    }
  } catch (error) {
    logger.error({ error }, 'WebSocket message parse error');
  }
}

export function broadcastWaitTimes(waitTimes: { [gateId: string]: WaitTimeResult }): void {
  const message = JSON.stringify({
    type: 'wait_times_updated',
    data: waitTimes,
    timestamp: new Date().toISOString(),
  });

  let sent = 0;
  connections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
      sent++;
    } else {
      connections.delete(ws);
    }
  });

  if (sent > 0) {
    logger.debug(`Broadcast wait times to ${sent} clients`);
  }
}

export function broadcastEvent(eventType: string, payload: any): void {
  const message = JSON.stringify({
    type: eventType,
    data: payload,
    timestamp: new Date().toISOString(),
  });

  connections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

export function getConnectionCount(): number {
  return connections.size;
}
