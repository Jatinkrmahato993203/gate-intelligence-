import { WaitTimeResult } from '../types';
export declare class WaitTimeService {
    private static cachedEventStart;
    /**
     * Get all wait times for a venue (with Redis caching).
     */
    static getAllWaitTimes(venueId: string): Promise<{
        [key: string]: WaitTimeResult;
    }>;
    /**
     * Calculate wait time for a specific gate.
     */
    static calculateWaitForGate(gateId: string): Promise<WaitTimeResult>;
    /**
     * Get arrival forecast — rule-based (Gemini extension point).
     */
    private static getArrivalForecast;
}
//# sourceMappingURL=wait-time.service.d.ts.map