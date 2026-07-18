import { WebSocket } from 'ws';
import { WaitTimeResult } from '../types';
export declare function addConnection(ws: WebSocket): void;
export declare function removeConnection(ws: WebSocket): void;
export declare function handleWebSocketMessage(ws: WebSocket, data: Buffer): Promise<void>;
export declare function broadcastWaitTimes(waitTimes: {
    [gateId: string]: WaitTimeResult;
}): void;
export declare function broadcastEvent(eventType: string, payload: any): void;
export declare function getConnectionCount(): number;
//# sourceMappingURL=handlers.d.ts.map