import { DailyMetrics } from '../types';
export declare class OutcomeService {
    /**
     * Get daily outcome metrics.
     */
    static getDailyMetrics(eventDate?: string): Promise<DailyMetrics>;
    /**
     * Get conversion funnel data.
     */
    static getConversionFunnel(eventId?: string): Promise<any>;
}
//# sourceMappingURL=outcome.service.d.ts.map